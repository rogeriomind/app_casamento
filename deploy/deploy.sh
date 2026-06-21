#!/usr/bin/env bash
set -euo pipefail

: "${APP_PATH:?APP_PATH nao informado.}"

BRANCH="${BRANCH:-main}"
TEMP_ENV=""

cleanup() {
  if [ -n "${TEMP_ENV:-}" ]; then
    rm -f "$TEMP_ENV"
  fi
}

trap cleanup EXIT

case "$APP_PATH" in
  ""|"/"|"/opt"|"/opt/apps"|"/home"|"/root")
    echo "APP_PATH inseguro: $APP_PATH"
    exit 1
    ;;
esac

echo "Preparando pasta da aplicacao..."
if [ -n "${RELEASE_TARBALL:-}" ]; then
  if [ ! -f "$RELEASE_TARBALL" ]; then
    echo "Pacote de release nao encontrado: $RELEASE_TARBALL"
    exit 1
  fi

  if [ ! -f "$APP_PATH/.env" ]; then
    echo "Arquivo .env nao encontrado na VPS em $APP_PATH."
    echo "Crie o .env a partir de .env.production.example antes do deploy."
    exit 1
  fi

  RELEASE_DIR="$(mktemp -d)"
  trap 'rm -rf "${RELEASE_DIR:-}"; cleanup' EXIT

  tar -xzf "$RELEASE_TARBALL" -C "$RELEASE_DIR"

  if [ ! -f "$RELEASE_DIR/docker-compose.yml" ] || [ ! -f "$RELEASE_DIR/Dockerfile" ]; then
    echo "Pacote de release invalido."
    exit 1
  fi

  find "$APP_PATH" -mindepth 1 -maxdepth 1 ! -name ".env" -exec rm -rf -- {} +
  cp -a "$RELEASE_DIR"/. "$APP_PATH"/
  rm -f "$RELEASE_TARBALL"
elif [ ! -d "$APP_PATH/.git" ]; then
  : "${REPO_URL:?REPO_URL nao informado.}"

  if [ -d "$APP_PATH" ]; then
    EXTRA_FILE="$(find "$APP_PATH" -mindepth 1 -maxdepth 1 ! -name .env | head -n 1)"
    if [ -n "$EXTRA_FILE" ]; then
      echo "APP_PATH existe, mas nao e um repositorio Git: $APP_PATH"
      echo "Arquivo inesperado encontrado: $EXTRA_FILE"
      exit 1
    fi

    if [ -f "$APP_PATH/.env" ]; then
      TEMP_ENV="$(mktemp)"
      cp "$APP_PATH/.env" "$TEMP_ENV"
    fi

    rm -rf "$APP_PATH"
  elif [ -e "$APP_PATH" ]; then
    echo "APP_PATH existe, mas nao e um repositorio Git: $APP_PATH"
    exit 1
  fi

  mkdir -p "$(dirname "$APP_PATH")"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_PATH"

  if [ -n "$TEMP_ENV" ]; then
    cp "$TEMP_ENV" "$APP_PATH/.env"
    cleanup
    TEMP_ENV=""
  fi
fi

cd "$APP_PATH"

if [ -d ".git" ] && [ -z "${RELEASE_TARBALL:-}" ]; then
  echo "Atualizando codigo..."
  git remote set-url origin "$REPO_URL"
  git fetch --prune origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
fi

if [ ! -f ".env" ]; then
  echo "Arquivo .env nao encontrado na VPS em $APP_PATH."
  echo "Crie o .env a partir de .env.production.example antes do deploy."
  exit 1
fi

echo "Subindo containers..."
docker compose build --pull
docker compose up -d --remove-orphans

echo "Status dos containers:"
docker compose ps
