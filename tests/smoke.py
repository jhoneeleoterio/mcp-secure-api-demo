"""Black-box API checks against the PostgreSQL-backed Compose stack."""
import json
import os
import time
import urllib.error
import urllib.request

BASE = os.environ.get('ACME_BASE_URL', 'http://localhost:5080')

def get(path):
    try:
        with urllib.request.urlopen(BASE + path, timeout=7) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, None

for attempt in range(30):
    try:
        if get('/health/ready')[0] == 200:
            break
    except (OSError, ValueError):
        pass
    time.sleep(2)
else:
    raise RuntimeError('API readiness did not succeed within the startup window')

status, customers = get('/customers?query=Alice')
assert status == 200 and len(customers) == 1
assert customers[0]['id'] == 1 and customers[0]['latestOrderId'] == 1002
assert get('/customers?query=alice%40example.test')[1] == customers
assert get('/customers?query=1')[1] == customers
assert get('/customers?query=Bruno')[1][0]['latestOrderId'] is None
assert get('/customers?query=missing')[1] == []
assert get('/customers?query=%27%20OR%201%3D1--')[1] == []
assert get('/customers?query=%25')[1] == []
assert get('/customers?query=_')[1] == []
assert get('/customers?query=%5C')[1] == []
assert get('/customers?query=01')[1] == []
assert get('/customers')[0] == 400
assert get('/customers?query=%20')[0] == 400
assert get('/customers?query=' + 'a' * 101)[0] == 400
status, order = get('/orders/1002')
assert status == 200 and order['customerId'] == 1 and order['total'] == 300
assert order['items'][0]['sku'] == 'ABC-123' and order['currency'] == 'BRL'
assert get('/orders/9999')[0] == 404
assert get('/orders/0')[0] == 400
assert get('/inventory/ABC-123')[1]['availableQuantity'] == 12
assert get('/inventory/abc-123')[1]['availableQuantity'] == 12
assert get('/inventory/XYZ-999')[1]['availableQuantity'] == 0
assert get('/inventory/MISSING')[0] == 404
assert get('/inventory/bad_sku')[0] == 400
print('PASS: customer lookup, order mapping, inventory, validation and missing resources')
