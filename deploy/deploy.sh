#!/usr/bin/env bash
set -Eeuo pipefail

# Run on the VM from /opt/acmecommerce/releases/<commit>/deploy/deploy.sh.
# The short-lived GHCR token is supplied on stdin, never saved in runtime.env.
tag=${1:?Pass the full commit SHA}
github_actor=${2:?Pass the GitHub actor}
public_host=${3:?Pass the public DNS host}
[[ $tag =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected a full lowercase commit SHA' >&2; exit 2; }
[[ $public_host =~ ^[a-z0-9.-]+$ ]] || { echo 'Invalid public DNS host' >&2; exit 2; }
read -r ghcr_token
[[ -n $ghcr_token ]] || { echo 'GHCR token is missing' >&2; exit 2; }

root=/opt/acmecommerce
release="$root/releases/$tag"
runtime="$root/runtime.env"
compose_file="$release/deploy/compose.production.yml"
[[ -f $compose_file ]] || { echo 'Release is missing' >&2; exit 2; }
runtime_backup=''
if [[ -f $runtime ]]; then
  runtime_backup=$(mktemp "$root/runtime.env.backup.XXXXXX")
  cp "$runtime" "$runtime_backup"
fi
cleanup() {
  [[ -z $runtime_backup ]] || rm -f "$runtime_backup"
  [[ -z ${docker_config:-} ]] || rm -rf "$docker_config"
}
trap cleanup EXIT
if [[ -f $root/vault.conf ]]; then
  bash "$release/deploy/sync-oci-vault.sh"
fi
[[ -f $runtime ]] || { echo 'runtime.env is missing' >&2; exit 2; }

previous=''
if [[ -L $root/current ]]; then
  previous=$(readlink -f "$root/current")
fi

docker_config=$(mktemp -d)
export DOCKER_CONFIG=$docker_config
printf '%s\n' "$ghcr_token" | docker login ghcr.io -u "$github_actor" --password-stdin >/dev/null
unset ghcr_token

run_compose() {
  local target=$1 image_tag=$2
  IMAGE_TAG=$image_tag docker compose --env-file "$runtime" \
    -f "$target/deploy/compose.production.yml" "${@:3}"
}

echo "Deploying $tag"
if run_compose "$release" "$tag" pull &&
   run_compose "$release" "$tag" up -d --wait --wait-timeout 120 --remove-orphans &&
   ACME_BASE_URL=http://127.0.0.1:5080 python3 "$release/tests/smoke.py" &&
   ACME_MCP_BASE_URL=http://127.0.0.1:5081 ACME_ENV_FILE="$runtime" \
     python3 "$release/tests/auth_smoke.py" &&
   curl --fail --silent --show-error --retry 12 --retry-delay 5 --retry-all-errors \
     "https://$public_host/health/ready" >/dev/null &&
   [[ $(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
     "https://$public_host/mcp") == 401 ]]; then
  ln -sfn "$release" "$root/current.next"
  mv -Tf "$root/current.next" "$root/current"
  echo "Deployed $tag"
else
  echo "Deployment failed; restoring the previous release" >&2
  if [[ -n $runtime_backup ]]; then
    mv -f "$runtime_backup" "$runtime"
    runtime_backup=''
  fi
  if [[ -n $previous && -f $previous/deploy/compose.production.yml ]]; then
    previous_tag=${previous##*/}
    run_compose "$previous" "$previous_tag" up -d --wait --wait-timeout 120 --remove-orphans
    ACME_BASE_URL=http://127.0.0.1:5080 python3 "$previous/tests/smoke.py"
  else
    run_compose "$release" "$tag" down
  fi
  exit 1
fi
