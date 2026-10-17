# AcmeCommerce API demo

A small read-only REST API for fictitious customers, orders and inventory. It runs on
.NET 10 with Entity Framework Core and PostgreSQL. Docker Compose starts both services
and loads sample data.

## Run locally

Requires Docker with Compose v2. Python 3 is needed for the smoke test.

```sh
cp .env.example .env
docker compose up --build -d
python3 tests/smoke.py
```

The API is available at `http://localhost:5080`. Stop it with `docker compose down`.
The database volume is retained; the sample data is loaded only when the volume is empty.

## Endpoints

| Request | Result |
| --- | --- |
| `GET /customers?query=Alice` | Up to 20 customers matching a name, email or exact ID, including the latest order ID |
| `GET /orders/1002` | Order details, items and calculated total |
| `GET /inventory/ABC-123` | Product and available quantity |
| `GET /health/live` | API process status |
| `GET /health/ready` | API and database readiness |

The sample data includes Alice's order `1002` (BRL 300) and 12 available units of
`ABC-123`. The schema and sample data are in `database/001-init.sql`.

## Current limits

The API has no authentication and should only run locally with the supplied fictitious
data. It does not yet expose an MCP server. The database is initialized with a SQL
script, not EF Core migrations. This repository has no open-source license.
