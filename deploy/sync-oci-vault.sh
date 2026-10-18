#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

root=/opt/acmecommerce
config=$root/vault.conf
[[ -f $config ]] || { echo 'vault.conf is missing' >&2; exit 2; }
# vault.conf is an administrator-owned local configuration file.
# shellcheck disable=SC1090
source "$config"
: "${OCI_VAULT_NEON_DATABASE_URL_SECRET_OCID:?}"
: "${OCI_VAULT_JWT_SECRET_OCID:?}"
: "${JWT_ISSUER:?}"
: "${JWT_AUDIENCE:?}"
: "${PUBLIC_HOST:?}"

read_secret() {
  oci secrets secret-bundle get --secret-id "$1" --auth instance_principal --output json |
    python3 -c 'import base64,json,sys; data=json.load(sys.stdin); print(base64.b64decode(data["data"]["secret-bundle-content"]["content"]).decode(), end="")'
}

neon_database_url=$(read_secret "$OCI_VAULT_NEON_DATABASE_URL_SECRET_OCID")
jwt_key=$(read_secret "$OCI_VAULT_JWT_SECRET_OCID")
[[ $neon_database_url == postgres://* || $neon_database_url == postgresql://* ]] || { echo 'Vault Neon URL must be a PostgreSQL URL' >&2; exit 2; }
[[ $neon_database_url != *$'\n'* && $neon_database_url != *$'\r'* && $neon_database_url != *"'"* ]] || { echo 'Vault Neon URL contains an unsupported character' >&2; exit 2; }
[[ $jwt_key =~ ^[A-Za-z0-9+/=]+$ ]] || { echo 'Vault JWT key must be base64' >&2; exit 2; }
[[ $JWT_ISSUER =~ ^[A-Za-z0-9._:/-]+$ && $JWT_AUDIENCE =~ ^[A-Za-z0-9._:/-]+$ ]] || exit 2
[[ $PUBLIC_HOST =~ ^[a-z0-9.-]+$ ]] || exit 2
JWT_KEY="$jwt_key" python3 -c 'import base64,os; assert len(base64.b64decode(os.environ["JWT_KEY"], validate=True)) >= 32'

temporary=$(mktemp "$root/runtime.env.XXXXXX")
trap 'rm -f "$temporary"' EXIT
printf 'NEON_DATABASE_URL=%s\nJWT_ISSUER=%s\nJWT_AUDIENCE=%s\nJWT_SIGNING_KEY_BASE64=%s\nPUBLIC_HOST=%s\n' \
  "'$neon_database_url'" "$JWT_ISSUER" "$JWT_AUDIENCE" "$jwt_key" "$PUBLIC_HOST" > "$temporary"
mv -f "$temporary" "$root/runtime.env"
echo 'Refreshed runtime.env from OCI Vault'
