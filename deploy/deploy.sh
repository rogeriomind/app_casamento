#!/usr/bin/env bash
set -euo pipefail

: "${APP_PATH:?APP_PATH nao informado. Use /opt/apps/app_casamento.}"

BRANCH="${BRANCH:-main}"
COMMIT_SHA="${COMMIT_SHA:-unknown}"
RELEASE_TARBALL="${RELEASE_TARBALL:-}"
REPO_URL="${REPO_URL:-}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/backups/app_casamento}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
RUN_REMOTE_NODE_PREFLIGHT="${RUN_REMOTE_NODE_PREFLIGHT:-1}"
BUNNY_STREAM_ENV_FILE="${BUNNY_STREAM_ENV_FILE:-}"
TEMP_ENV=""
RELEASE_DIR=""

cleanup() {
  if [ -n "${TEMP_ENV:-}" ]; then
    rm -f "$TEMP_ENV"
  fi
  if [ -n "${RELEASE_DIR:-}" ] && [ -d "$RELEASE_DIR" ]; then
    rm -rf "$RELEASE_DIR"
  fi
  if [[ "${BUNNY_STREAM_ENV_FILE:-}" == /tmp/app_casamento_bunny_stream_*.env ]]; then
    rm -f -- "$BUNNY_STREAM_ENV_FILE"
  fi
}

trap cleanup EXIT

case "$APP_PATH" in
  ""|"/"|"/opt"|"/opt/apps"|"/home"|"/root")
    echo "APP_PATH inseguro: $APP_PATH" >&2
    exit 1
    ;;
esac

read_env_value() {
  local key="$1"
  local env_file="$2"
  if [ ! -f "$env_file" ]; then
    return 0
  fi
  local line
  line="$(grep -E "^${key}=" "$env_file" | tail -n 1 || true)"
  [ -n "$line" ] || return 0
  printf '%s\n' "${line#*=}" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

sync_bunny_stream_env() {
  local source_file="$1"
  local target_file="$2"
  local keys=(
    BUNNY_STREAM_LIBRARY_ID
    BUNNY_STREAM_API_KEY
    BUNNY_STREAM_PULL_ZONE_HOSTNAME
    BUNNY_STREAM_WEBHOOK_SECRET
  )
  local key count merged_env next_env

  if [ ! -f "$source_file" ]; then
    echo "Configuracao temporaria do Bunny Stream nao encontrada." >&2
    exit 1
  fi

  for key in "${keys[@]}"; do
    count="$(grep -Ec "^${key}=.+$" "$source_file" || true)"
    if [ "$count" -ne 1 ]; then
      echo "Configuracao invalida para $key." >&2
      exit 1
    fi
  done

  merged_env="$(mktemp "$APP_PATH/.env.merge.XXXXXX")"
  cp "$target_file" "$merged_env"

  for key in "${keys[@]}"; do
    next_env="${merged_env}.next"
    awk -v key="$key" -v source_file="$source_file" '
      BEGIN {
        while ((getline source_line < source_file) > 0) {
          if (index(source_line, key "=") == 1) {
            replacement = source_line
            break
          }
        }
        close(source_file)
      }
      index($0, key "=") == 1 {
        if (!replaced) {
          print replacement
          replaced = 1
        }
        next
      }
      { print }
      END {
        if (!replaced) {
          print replacement
        }
      }
    ' "$merged_env" > "$next_env"
    mv "$next_env" "$merged_env"
  done

  chmod 600 "$merged_env"
  mv "$merged_env" "$target_file"
  chmod 600 "$target_file"
  echo "Configuracao do Bunny Stream sincronizada no .env da VPS."
}

compose_cmd() {
  docker compose \
    --project-name "$COMPOSE_PROJECT_NAME" \
    --env-file "$APP_PATH/.env" \
    "$@"
}

echo "Preparando pasta da aplicacao..."
if [ -n "$RELEASE_TARBALL" ]; then
  if [ ! -f "$RELEASE_TARBALL" ]; then
    echo "Pacote de release nao encontrado: $RELEASE_TARBALL" >&2
    exit 1
  fi

  if [ ! -f "$APP_PATH/.env" ]; then
    echo "Arquivo .env nao encontrado na VPS em $APP_PATH." >&2
    echo "Crie o .env a partir de .env.production.example antes do deploy." >&2
    exit 1
  fi

  RELEASE_DIR="$(mktemp -d)"
  tar -xzf "$RELEASE_TARBALL" -C "$RELEASE_DIR"

  if [ ! -f "$RELEASE_DIR/docker-compose.yml" ] || [ ! -f "$RELEASE_DIR/Dockerfile" ]; then
    echo "Pacote de release invalido." >&2
    exit 1
  fi

  find "$APP_PATH" \
    -mindepth 1 \
    -maxdepth 1 \
    ! -name ".env" \
    ! -name ".releases" \
    ! -name ".deploy-state" \
    -exec rm -rf -- {} +
  cp -a "$RELEASE_DIR"/. "$APP_PATH"/
  rm -f "$RELEASE_TARBALL"
elif [ ! -d "$APP_PATH/.git" ]; then
  : "${REPO_URL:?REPO_URL nao informado.}"

  if [ -d "$APP_PATH" ]; then
    EXTRA_FILE="$(find "$APP_PATH" -mindepth 1 -maxdepth 1 ! -name .env | head -n 1)"
    if [ -n "$EXTRA_FILE" ]; then
      echo "APP_PATH existe, mas nao e um repositorio Git: $APP_PATH" >&2
      echo "Arquivo inesperado encontrado: $EXTRA_FILE" >&2
      exit 1
    fi

    if [ -f "$APP_PATH/.env" ]; then
      TEMP_ENV="$(mktemp)"
      cp "$APP_PATH/.env" "$TEMP_ENV"
    fi

    rm -rf "$APP_PATH"
  elif [ -e "$APP_PATH" ]; then
    echo "APP_PATH existe, mas nao e um repositorio Git: $APP_PATH" >&2
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

if [ -d ".git" ] && [ -z "$RELEASE_TARBALL" ]; then
  : "${REPO_URL:?REPO_URL nao informado.}"
  echo "Atualizando codigo..."
  git remote set-url origin "$REPO_URL"
  git fetch --prune origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
  COMMIT_SHA="$(git rev-parse HEAD)"
fi

if [ ! -f ".env" ]; then
  echo "Arquivo .env nao encontrado na VPS em $APP_PATH." >&2
  echo "Crie o .env a partir de .env.production.example antes do deploy." >&2
  exit 1
fi

if [ -n "$BUNNY_STREAM_ENV_FILE" ]; then
  case "$BUNNY_STREAM_ENV_FILE" in
    /tmp/app_casamento_bunny_stream_*.env) ;;
    *)
      echo "BUNNY_STREAM_ENV_FILE aponta para um caminho inseguro." >&2
      exit 1
      ;;
  esac
  sync_bunny_stream_env "$BUNNY_STREAM_ENV_FILE" "$APP_PATH/.env"
  rm -f -- "$BUNNY_STREAM_ENV_FILE"
  BUNNY_STREAM_ENV_FILE=""
fi

COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$(read_env_value COMPOSE_PROJECT_NAME "$APP_PATH/.env")}"
APP_PORT="${APP_PORT:-$(read_env_value APP_PORT "$APP_PATH/.env")}"
POSTGRES_DB="${POSTGRES_DB:-$(read_env_value POSTGRES_DB "$APP_PATH/.env")}"
POSTGRES_USER="${POSTGRES_USER:-$(read_env_value POSTGRES_USER "$APP_PATH/.env")}"

: "${COMPOSE_PROJECT_NAME:?COMPOSE_PROJECT_NAME ausente no ambiente ou .env.}"
: "${APP_PORT:?APP_PORT ausente no ambiente ou .env.}"

export COMPOSE_PROJECT_NAME APP_PORT

echo "Validando porta $APP_PORT para o projeto $COMPOSE_PROJECT_NAME..."
bash "$APP_PATH/scripts/check-vps-port.sh"

echo "Validando Docker Compose..."
compose_cmd config >/dev/null

echo "Espaco em disco antes do deploy:"
df -h
docker system df || true

if [ "$RUN_REMOTE_NODE_PREFLIGHT" = "1" ]; then
  echo "Executando preflight Node dentro de container temporario..."
  docker run --rm \
    --env-file "$APP_PATH/.env" \
    -e NEXT_TELEMETRY_DISABLED=1 \
    -v "$APP_PATH":/src:ro \
    node:24-bookworm-slim \
    bash -lc "apt-get update >/dev/null && apt-get install -y --no-install-recommends openssl >/dev/null && mkdir -p /tmp/app && tar --exclude='.git' --exclude='.env' --exclude='.releases' --exclude='node_modules' --exclude='.next' -C /src -cf - . | tar -C /tmp/app -xf - && cd /tmp/app && npm ci && npm run prisma:generate && npm run lint && npm run test && npm run build"
fi

echo "Testando configuracao do Bunny Storage..."
docker run --rm \
  --env-file "$APP_PATH/.env" \
  -v "$APP_PATH":/app:ro \
  -w /app \
  node:24-bookworm-slim \
  node scripts/check-bunny-storage.mjs

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="$BACKUP_ROOT/$timestamp-$COMMIT_SHA"
install -d -m 700 "$backup_dir"
cp "$APP_PATH/.env" "$backup_dir/env.backup"
chmod 600 "$backup_dir/env.backup"

if [ -n "${POSTGRES_DB:-}" ] && [ -n "${POSTGRES_USER:-}" ] && [ -n "$(compose_cmd ps -q db 2>/dev/null || true)" ]; then
  echo "Criando backup do PostgreSQL..."
  compose_cmd exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
    < /dev/null > "$backup_dir/postgres.sql"
  chmod 600 "$backup_dir/postgres.sql"
else
  echo "Banco ainda nao esta ativo; pg_dump ignorado neste deploy inicial."
fi

install -d -m 755 "$APP_PATH/.releases"
tar \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.releases' \
  -czf "$APP_PATH/.releases/$timestamp-$COMMIT_SHA.tar.gz" .

echo "Subindo containers com projeto Compose explicito..."
compose_cmd up -d --build --remove-orphans

install -d -m 755 "$APP_PATH/.deploy-state"
echo "$COMMIT_SHA" > "$APP_PATH/.deploy-state/last-commit"
printf '%s\n' "$timestamp" > "$APP_PATH/.deploy-state/last-deploy-at"

echo "Aguardando healthcheck HTTP..."
health_url="http://127.0.0.1:$APP_PORT/api/health"
for attempt in $(seq 1 30); do
  if curl -fsS "$health_url" >/dev/null; then
    echo "Healthcheck OK: $health_url"
    break
  fi

  if [ "$attempt" -eq 30 ]; then
    echo "Healthcheck falhou; ultimos logs da aplicacao:" >&2
    compose_cmd logs --tail=120 app >&2 || true
    exit 1
  fi

  sleep 3
done

find "$APP_PATH/.releases" -maxdepth 1 -type f -name '*.tar.gz' \
  | sort -r \
  | tail -n "+$((KEEP_RELEASES + 1))" \
  | xargs -r rm -f

echo "Status dos containers:"
compose_cmd ps
echo "Deploy finalizado para commit $COMMIT_SHA."
