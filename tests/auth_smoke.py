"""Black-box JWT checks for the local MCP Streamable HTTP endpoint."""

import json
import os
from pathlib import Path
import sys
import time
import urllib.error
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.dev_token import create_token, read_env, setting, signing_key  # noqa: E402


BASE = os.environ.get("ACME_MCP_BASE_URL", "http://localhost:5081")
MCP_REQUEST = json.dumps({
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
        "protocolVersion": "2025-11-25",
        "capabilities": {},
        "clientInfo": {"name": "auth-smoke", "version": "1.0"},
    },
}).encode()


def post(payload, token=None, path="/mcp"):
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "MCP-Protocol-Version": "2025-11-25",
    }
    if token is not None:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(BASE + path, payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=7) as response:
            return response.status, response.read().decode()
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode()


def response_json(body):
    if body.lstrip().startswith("{"):
        return json.loads(body)
    events = [line[5:].strip() for line in body.splitlines() if line.startswith("data:")]
    if not events:
        raise AssertionError(f"MCP response has no JSON event: {body[:200]}")
    return json.loads(events[-1])


for attempt in range(30):
    try:
        with urllib.request.urlopen(BASE + "/health/live", timeout=3) as response:
            if response.status == 200:
                break
    except (OSError, ValueError):
        pass
    time.sleep(2)
else:
    raise RuntimeError("MCP host did not become ready within the startup window")

values = read_env(Path(os.environ.get("ACME_ENV_FILE", ROOT / ".env")))
key = signing_key(values)
issuer = setting("JWT_ISSUER", values)
audience = setting("JWT_AUDIENCE", values)
now = int(time.time())
valid = create_token(key, issuer, audience, issued_at=now)
bad_signature = create_token(b"wrong-signing-key-with-at-least-32-bytes", issuer, audience)
expired = create_token(key, issuer, audience, issued_at=now - 3600, expires_at=now - 60)
wrong_issuer = create_token(key, "other-issuer", audience)
wrong_audience = create_token(key, issuer, "other-audience")

for label, token in [
    ("missing", None),
    ("bad signature", bad_signature),
    ("expired", expired),
    ("wrong issuer", wrong_issuer),
    ("wrong audience", wrong_audience),
]:
    status, _ = post(MCP_REQUEST, token)
    assert status == 401, f"{label}: expected 401, got {status}"

status, body = post(MCP_REQUEST, valid)
assert status == 200, f"valid token: expected 200, got {status}: {body[:200]}"
message = response_json(body)
assert message.get("id") == 1 and "result" in message, message

list_request = json.dumps({"jsonrpc": "2.0", "id": 2, "method": "tools/list"}).encode()
status, body = post(list_request, valid)
assert status == 200, f"tools/list: expected 200, got {status}: {body[:200]}"
message = response_json(body)
assert message.get("id") == 2 and message.get("result", {}).get("tools") == [], message
print("PASS: MCP JWT authentication and empty tool list")

scoped = create_token(key, issuer, audience, scopes=[
    "customers.read", "orders.read", "inventory.read",
])
status, body = post(list_request, scoped)
assert status == 200
tools = response_json(body)["result"]["tools"]
assert {tool["name"] for tool in tools} == {
    "search_customer", "get_order", "check_inventory",
}


def call(name, arguments, token):
    payload = json.dumps({
        "jsonrpc": "2.0", "id": 3, "method": "tools/call",
        "params": {"name": name, "arguments": arguments},
    }).encode()
    status, body = post(payload, token)
    assert status == 200, (name, status, body[:200])
    return response_json(body)


denied = call("get_order", {"orderId": 1002}, create_token(
    key, issuer, audience, scopes=["customers.read"],
))
assert denied.get("error") or denied.get("result", {}).get("isError"), denied

customer = call("search_customer", {"query": "Alice"}, scoped)["result"]["structuredContent"]
assert customer["status"] == "ok" and customer["data"][0]["latestOrderId"] == 1002
order = call("get_order", {"orderId": 1002}, scoped)["result"]["structuredContent"]
assert order["status"] == "ok" and order["data"]["total"] == 300
inventory = call("check_inventory", {"sku": "ABC-123"}, scoped)["result"]["structuredContent"]
assert inventory["status"] == "ok" and inventory["data"]["availableQuantity"] == 12
assert inventory["traceId"]
print("TRACE_ID=" + inventory["traceId"])
assert call("get_order", {"orderId": 9999}, scoped)["result"]["structuredContent"]["status"] == "not_found"
assert call("check_inventory", {"sku": "bad/sku"}, scoped)["result"]["structuredContent"]["status"] == "invalid_input"

demo_status, demo_body = post(b"{}", path="/mcp/demo-token")
assert demo_status == 200, f"demo token endpoint returned {demo_status}"
demo_token = json.loads(demo_body)["accessToken"]
assert call("check_inventory", {"sku": "ABC-123"}, demo_token)["result"]["structuredContent"]["status"] == "ok"
oversized_request = json.dumps({"jsonrpc": "2.0", "id": 4, "method": "tools/list", "padding": "x" * 17000}).encode()
oversized_status, _ = post(oversized_request, demo_token)
assert oversized_status == 413, f"oversized MCP request: expected 413, got {oversized_status}"

durations = []
for _ in range(20):
    started = time.perf_counter()
    result = call("check_inventory", {"sku": "ABC-123"}, scoped)
    assert result["result"]["structuredContent"]["status"] == "ok"
    durations.append(time.perf_counter() - started)
p95 = sorted(durations)[18]
print(f"MCP inventory P95: {p95 * 1000:.1f} ms (20 local samples)")
assert p95 < 1.0, f"MCP inventory P95 exceeded 1 second: {p95:.3f}s"
print("PASS: scoped MCP tools, REST results, denial and controlled errors")
