#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $EUID -ne 0 ]]; then
  echo 'Run this script as root (sudo bash bootstrap-ubuntu.sh).' >&2
  exit 2
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl python3

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

# Docker's official apt repository selects the VM's Ubuntu release and CPU architecture.
# shellcheck disable=SC1091
source /etc/os-release
codename=${UBUNTU_CODENAME:-$VERSION_CODENAME}
architecture=$(dpkg --print-architecture)
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $codename
Components: stable
Architectures: $architecture
Signed-By: /etc/apt/keyrings/docker.asc
EOF

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

if ! id deploy >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash deploy
fi
usermod -aG docker deploy
install -d -o deploy -g deploy -m 0750 /opt/acmecommerce /opt/acmecommerce/releases

docker compose version
echo 'VM prepared. Add a dedicated SSH public key for deploy and create runtime.env before deploying.'
