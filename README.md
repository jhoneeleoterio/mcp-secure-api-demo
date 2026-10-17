# AcmeCommerce — AgentBridge demo, increment 1

Initial implementation of the API foundation described in AgentBridge SDD v0.1.
This increment contains .NET 10, EF Core with PostgreSQL, deterministic fictitious data, read-only
REST endpoints, Docker Compose and a CI workflow. MCP, JWT/scopes and OpenTelemetry
are the next increment; this is **not yet the secure MCP demo**.

## Run

Prerequisites: Docker with Compose v2. Python 3 is needed only for smoke tests.
From this directory (PowerShell also supports `cp`):

```sh
cp .env.example .env
docker compose up --build -d
python3 tests/smoke.py
```

On Windows, use `python tests/smoke.py` if Python is exposed as `python`.
The first run needs internet access to pull images and NuGet packages.
API: http://localhost:5080/health/ready

```sh
curl "http://localhost:5080/customers?query=Alice"
curl "http://localhost:5080/orders/1002"
curl "http://localhost:5080/inventory/ABC-123"
```

Expected: Alice has `latestOrderId=1002`; that order totals BRL 300;
ABC-123 has 12 units available. Bruno has no orders. XYZ-999 exists with zero stock.

The API host port binds only to loopback. PostgreSQL has no published host port.
REST authentication is not implemented in this increment: use only locally with
the supplied fictitious data. The MCP boundary will require JWT and per-tool scopes.
Do not deploy this starter to a public endpoint.

## Build without Docker

Requires .NET 10 SDK:

```sh
dotnet restore AcmeCommerce.slnx
dotnet build AcmeCommerce.slnx -c Release --no-restore
```

Running outside Compose also requires a PostgreSQL database initialized with
`database/001-init.sql` and `ConnectionStrings__AcmeCommerce` set in the process environment.

## Persistence and troubleshooting

The database initialization script runs only when the PostgreSQL volume is empty.
Restarting preserves data. Do not rerun the schema script against an initialized database.
Use `docker compose logs api postgres` to diagnose startup issues and
`docker compose down` to stop the stack while retaining the database volume.
The API exposes `/health/live` and database-backed `/health/ready`.

## Verification status

The API was built with the local .NET 10 SDK and through Docker, and the smoke script
passed against the Compose stack on 17 October 2026. The CI workflow runs on pushes
and pull requests; check its latest run on GitHub.
The local restore used `-p:NuGetAudit=false` because the environment could not reach
NuGet's vulnerability feed; the Docker restore completed without that override.

## Design and boundaries

EF Core queries use the Npgsql PostgreSQL provider; customer search is a literal, case-insensitive
substring match for name/email or exact ID, limited to 20 results. Order reads include
items and a calculated total. Currency is explicit. Missing order/SKU returns 404;
invalid input returns 400. Cancellation tokens reach the database calls.
PostgreSQL schema setup remains a demo-only SQL initialization script, not an EF migration system.

This public demo is specific to AcmeCommerce. There is no generic registry,
OpenAPI parser, commercial connector engine or dependency on AgentBridge.Core.
Do not mix private commercial code into this directory. This repository has no
open-source license; terms for reuse remain undecided.

See `docs/implementation-plan.md` for scope, tool contracts and next acceptance gates.

Technical references consulted:
- https://www.npgsql.org/efcore/mapping/translations.html
- https://www.nuget.org/packages/Npgsql.EntityFrameworkCore.PostgreSQL/10.0.3
- https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/docker/building-net-docker-images?view=aspnetcore-10.0
