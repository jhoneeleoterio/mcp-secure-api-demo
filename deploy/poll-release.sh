#!/usr/bin/env bash
set -Eeuo pipefail

# Run as deploy on the VM. Images and source archives are public; no GitHub
# credential or inbound SSH access from GitHub Actions is needed.
root=/opt/acmecommerce
runtime="$root/runtime.env"
[[ -f $runtime ]] || { echo 'runtime.env is missing' >&2; exit 2; }

exec 9>"$root/deploy.lock"
flock -n 9 || exit 0

public_host=$(python3 - "$runtime" <<'PY'
from pathlib import Path
import sys

for line in Path(sys.argv[1]).read_text().splitlines():
    if line.startswith('PUBLIC_HOST='):
        print(line.split('=', 1)[1].strip().strip("'\""))
        break
PY
)
[[ $public_host =~ ^[a-z0-9.-]+$ ]] || { echo 'Invalid PUBLIC_HOST' >&2; exit 2; }

tag=$(curl --fail --silent --show-error --location --max-time 20 \
  -H 'Accept: application/vnd.github+json' \
  'https://api.github.com/repos/jhoneeleoterio/mcp-secure-api-demo/commits/main' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["sha"])')
[[ $tag =~ ^[0-9a-f]{40}$ ]] || { echo 'GitHub returned an invalid commit SHA' >&2; exit 2; }

if [[ -L $root/current && $(readlink -f "$root/current") == "$root/releases/$tag" ]]; then
  echo "Already deployed $tag"
  exit 0
fi

release="$root/releases/$tag"
if [[ ! -f $release/deploy/deploy.sh ]]; then
  [[ ! -e $release ]] || { echo "Incomplete release directory: $release" >&2; exit 2; }
  staging=$(mktemp -d "$root/releases/.incoming-$tag.XXXXXX")
  archive=$(mktemp "$root/incoming-$tag.XXXXXX.tar.gz")
  cleanup() { rm -f "$archive"; [[ -z ${staging:-} ]] || rm -rf "$staging"; }
  trap cleanup EXIT
  curl --fail --silent --show-error --location --max-time 90 \
    "https://github.com/jhoneeleoterio/mcp-secure-api-demo/archive/$tag.tar.gz" \
    -o "$archive"
  tar -xzf "$archive" --strip-components=1 -C "$staging"
  [[ -f $staging/deploy/deploy.sh && -f $staging/deploy/compose.production.yml ]] || {
    echo 'Downloaded release is incomplete' >&2; exit 2;
  }
  mv -T "$staging" "$release"
  staging=''
  rm -f "$archive"
  trap - EXIT
fi

bash "$release/deploy/deploy.sh" "$tag" "$public_host"
