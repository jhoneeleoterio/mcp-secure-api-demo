# AcmeCommerce API demo

A small read-only REST API for fictitious customers, orders and inventory, plus an
MCP host with JWT authentication. The API uses .NET 10, Entity Framework Core and
PostgreSQL. The Angular frontend offers a read-only view of the demo. The MCP host does not have tools yet.

## Run locally

Requires Docker with Compose v2. Python 3 is needed for the smoke test.

```sh
cp .env.example .env
python3 scripts/dev_token.py --init-key
docker compose up --build -d
python3 tests/smoke.py
python3 tests/auth_smoke.py
```

The API is available at `http://localhost:5080`; the protected MCP endpoint is at
`http://localhost:5081/mcp`. Generate a one-hour test token with
`python3 scripts/dev_token.py`. Both services bind to the local host only.
Stop them with `docker compose down`.
The database volume is retained; the sample data is loaded only when the volume is empty.

The API reference is available in ReDoc at `http://localhost:5080/docs`. Its
OpenAPI document is at `http://localhost:5080/swagger/v1/swagger.json`.

To run the Angular frontend locally, use Node.js 24.15+ (24.x) or 26.x and run
`npm ci` followed by `npm start` inside `frontend/`. Open
`http://localhost:4200/app/`; the dev server uses the API at `http://localhost:5080`.
The production frontend is also served at `/app/`.

## Deployment

On `main`, GitHub Actions runs the build and smoke tests, then publishes AMD64
API, MCP and web images to GHCR. An Oracle Cloud VM checks for the latest published
release every 10 minutes and deploys it without a GitHub SSH secret. The VM runs
the API, MCP host and Caddy; Neon hosts the database. Caddy serves HTTPS, with
the frontend at `/app/`, REST routes at the site root and protected MCP at `/mcp`. See the
[deployment overview](docs/deployment.md).

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

The REST API has no authentication and uses only the supplied fictitious data.
The MCP host requires a JWT for every protocol request, but has
no tools or per-tool scope checks yet. Its local token flow is not an OAuth login
flow for remote MCP clients. The database is initialized with a SQL script, not
EF Core migrations. This repository has no open-source license.
