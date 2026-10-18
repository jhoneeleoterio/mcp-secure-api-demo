# Oracle VM and Neon deployment

The `main` branch builds and tests the local demo, then publishes `linux/amd64`
API and MCP images to GHCR. Deployment runs only when the GitHub repository
variable `DEPLOY_ENABLED` is `true`. The Oracle VM runs the API, MCP host and
Caddy; PostgreSQL runs in Neon. The deployment checks the new release and restores
the previous containers if a check fails. This does not roll back database changes.

## One-time setup

1. Create a Neon project on the Free plan. Select PostgreSQL 17 to match local
   development, and a region close to the Oracle VM if available. Use the
   **direct** connection URL from Neon's Connect dialog, not the pooled URL.
   In the Neon SQL Editor, run [`database/001-init.sql`](../database/001-init.sql)
   **once** to create the schema and fictional sample data. This script is not
   idempotent. The database name may be the Neon default; the API uses the name
   in the connection URL. Keep the URL and database password out of GitHub and
   chat. The API enforces TLS host verification and channel binding.
2. Create an Oracle Cloud Always Free `VM.Standard.E2.1.Micro` instance with an
   x86-64 image and public IP. It has 1 GB RAM, so check memory use on the VM
   after deployment. Allow inbound TCP 22 from your administration IP and 80/443
   from the internet in the VCN security list or NSG and OS firewall. Do not
   expose 5080, 5081 or PostgreSQL. The VM must be able to make outbound TCP
   connections to Neon's database endpoint on port 5432.
3. On the Ubuntu VM, copy `deploy/bootstrap-ubuntu.sh` to the machine and run
   `sudo bash bootstrap-ubuntu.sh`. It installs Docker Engine with the Compose
   plugin, Python 3 and curl, and creates the `deploy` user and
   `/opt/acmecommerce`. Add a **dedicated public SSH key** to
   `/home/deploy/.ssh/authorized_keys` (owner `deploy`, directory mode `700`,
   file mode `600`) and confirm you can log in as `deploy`. Docker group
   membership grants root-level host access; restrict that private key to
   trusted repository operators.
4. Create a DNS name, such as a DuckDNS subdomain, pointed at the VM public IP.
   If the IP can change, arrange updates using the
   [DuckDNS update API](https://www.duckdns.org/spec.jsp). Caddy obtains HTTPS
   certificates when DNS and ports 80/443 are working.
5. Copy `deploy/runtime.env.example` to `/opt/acmecommerce/runtime.env` on the
   VM. Paste the Neon direct URL into `NEON_DATABASE_URL`, keeping the surrounding
   single quotes. Set the public host and generate the JWT signing key with
   `openssl rand -base64 32`. Set the file owner to `deploy` and mode to `600`.
   Keep the URL and key out of GitHub and chat. The optional `vault.conf.example`
   and `sync-oci-vault.sh` describe a later move to OCI Vault; leave
   `vault.conf` absent when using the local file.
6. Add the public SSH key for `deploy` to the VM. In GitHub's `production`
   environment, save the private key as `DEPLOY_SSH_KEY`, the independently
   verified `known_hosts` line as `DEPLOY_KNOWN_HOSTS`, and the VM address and
   SSH user as `DEPLOY_HOST` and `DEPLOY_USER`. Set `PUBLIC_HOST` to the DNS
   name without `https://`. Set repository variable `DEPLOY_ENABLED=true` only
   when Neon, the VM, DNS and secrets are ready. A push to `main` then deploys
   after tests and image publication.

The deploy job passes a short-lived GHCR token over SSH and removes its
temporary Docker configuration after use. GitHub Actions needs permission to
publish and read the repository's GHCR packages.

## Operations

- Public API: `https://<PUBLIC_HOST>/customers?query=Alice`
- Protected MCP endpoint: `https://<PUBLIC_HOST>/mcp` (JWT required)
- Readiness: `https://<PUBLIC_HOST>/health/ready` checks the API and Neon.
- VM status: from `/opt/acmecommerce/current`, set `IMAGE_TAG` to that
  release directory's 40-character name and run
  `docker compose --env-file /opt/acmecommerce/runtime.env -f deploy/compose.production.yml ps`.
- Backups: use Neon's backup/export facilities before schema changes. The seed
  script runs manually once; it is not rerun on deployment. Container rollback
  does not restore the Neon database.

The REST routes contain fictional demo data and remain public. The MCP host
requires a JWT but has no tools or OAuth login flow yet. Do not put real customer
data into this demo.
