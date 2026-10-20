#!/usr/bin/env bash
set -Eeuo pipefail

# Run on the VM from /opt/acmecommerce/releases/<commit>/deploy/deploy.sh.
tag=${1:?Pass the full commit SHA}
public_host=${2:?Pass the public DNS host}
[[ $tag =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected a full lowercase commit SHA' >&2; exit 2; }
[[ $public_host =~ ^[a-z0-9.-]+$ ]] || { echo 'Invalid public DNS host' >&2; exit 2; }

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
}
trap cleanup EXIT
previous=''
if [[ -L $root/current ]]; then
  previous=$(readlink -f "$root/current")
fi

resolved=$(python3 "$release/deploy/image_versions.py" resolve "$tag")
mapfile -t image_tags <<< "$resolved"
[[ ${#image_tags[@]} -eq 2 ]] || { echo 'Could not resolve image tags' >&2; exit 2; }
backend_tag=${image_tags[0]}
web_tag=${image_tags[1]}
[[ $backend_tag =~ ^[0-9a-f]{40}$ && $web_tag =~ ^[0-9a-f]{40}$ ]] || {
  echo 'Invalid image tags' >&2; exit 2;
}

if [[ -f $root/vault.conf ]]; then
  bash "$release/deploy/sync-oci-vault.sh"
fi
[[ -f $runtime ]] || { echo 'runtime.env is missing' >&2; exit 2; }

run_compose() {
  local target=$1 backend_image_tag=$2 web_image_tag=$3
  IMAGE_TAG=$backend_image_tag BACKEND_IMAGE_TAG=$backend_image_tag WEB_IMAGE_TAG=$web_image_tag \
    docker compose --env-file "$runtime" \
    -f "$target/deploy/compose.production.yml" "${@:4}"
}

echo "Deploying $tag (backend $backend_tag, web $web_tag)"
if run_compose "$release" "$backend_tag" "$web_tag" pull &&
   run_compose "$release" "$backend_tag" "$web_tag" up -d --wait --wait-timeout 120 --remove-orphans &&
   ACME_BASE_URL=http://127.0.0.1:5080 python3 "$release/tests/smoke.py" &&
   ACME_MCP_BASE_URL=http://127.0.0.1:5081 ACME_ENV_FILE="$runtime" \
     python3 "$release/tests/auth_smoke.py" &&
   curl --fail --silent --show-error --connect-timeout 10 --max-time 20 \
     --retry 12 --retry-delay 5 --retry-all-errors \
     "https://$public_host/health/ready" >/dev/null &&
   curl --fail --silent --show-error --connect-timeout 10 --max-time 20 \
     "https://$public_host/app/" | grep '<app-root' >/dev/null &&
   curl --fail --silent --show-error --connect-timeout 10 --max-time 20 \
     "https://$public_host/app/orders/1002" | grep '<app-root' >/dev/null &&
   curl --fail --silent --show-error --connect-timeout 10 --max-time 20 \
     "https://$public_host/docs" >/dev/null &&
   [[ $(curl --silent --show-error --connect-timeout 10 --max-time 20 \
     --output /dev/null --write-out '%{http_code}' \
     -X POST -H 'Content-Type: application/json' \
     -H 'Accept: application/json, text/event-stream' -d '{}' \
     "https://$public_host/mcp") == 401 ]]; then
  printf 'BACKEND_IMAGE_TAG=%s\nWEB_IMAGE_TAG=%s\n' "$backend_tag" "$web_tag" > "$release/image-tags.env"
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
    previous_backend_tag=$previous_tag
    previous_web_tag=$previous_tag
    if [[ -f $previous/image-tags.env ]]; then
      previous_backend_tag=$(sed -n 's/^BACKEND_IMAGE_TAG=//p' "$previous/image-tags.env")
      previous_web_tag=$(sed -n 's/^WEB_IMAGE_TAG=//p' "$previous/image-tags.env")
      [[ $previous_backend_tag =~ ^[0-9a-f]{40}$ && $previous_web_tag =~ ^[0-9a-f]{40}$ ]] || {
        echo 'Previous release has invalid image tags' >&2; exit 2;
      }
    fi
    run_compose "$previous" "$previous_backend_tag" "$previous_web_tag" up -d --wait --wait-timeout 120 --remove-orphans
    ACME_BASE_URL=http://127.0.0.1:5080 python3 "$previous/tests/smoke.py"
  else
    run_compose "$release" "$backend_tag" "$web_tag" down
  fi
  exit 1
fi
