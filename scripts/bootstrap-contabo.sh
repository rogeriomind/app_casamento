#!/usr/bin/env bash
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_PATH="${APP_PATH:-/opt/apps/app_casamento}"
APP_PORT="${APP_PORT:-3010}"
SSH_PORT="${SSH_PORT:-22}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Execute este script como root."
  exit 1
fi

echo "Atualizando servidor..."
apt-get update -y
apt-get upgrade -y

echo "Instalando dependencias basicas..."
apt-get install -y ca-certificates curl gnupg git ufw

. /etc/os-release
case "${ID:-}" in
  ubuntu|debian)
    DOCKER_DISTRO="$ID"
    ;;
  *)
    echo "Distribuicao nao suportada automaticamente: ${ID:-desconhecida}"
    echo "Instale Docker e Docker Compose Plugin manualmente."
    exit 1
    ;;
esac

echo "Instalando Docker..."
install -m 0755 -d /etc/apt/keyrings
if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
  curl -fsSL "https://download.docker.com/linux/$DOCKER_DISTRO/gpg" \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
fi
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$DOCKER_DISTRO ${VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "Criando usuario de deploy..."
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi

usermod -aG docker "$DEPLOY_USER"

if [ -n "${SSH_PUBLIC_KEY:-}" ]; then
  echo "Configurando chave SSH para $DEPLOY_USER..."
  install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
  printf '%s\n' "$SSH_PUBLIC_KEY" > "/home/$DEPLOY_USER/.ssh/authorized_keys"
  chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
  chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
fi

echo "Criando pasta da aplicacao..."
mkdir -p "$APP_PATH"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_PATH"

echo "Configurando firewall basico..."
ufw allow "$SSH_PORT/tcp"
ufw allow "$APP_PORT/tcp"
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "Bootstrap finalizado."
echo "Usuario: $DEPLOY_USER"
echo "App path: $APP_PATH"
echo "Porta app: $APP_PORT"
