#!/usr/bin/env bash
set -euo pipefail

: "${PORTAL_APP_PATH:?PORTAL_APP_PATH nao informado.}"
: "${RELEASE_ARCHIVE:?RELEASE_ARCHIVE nao informado.}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-app_casamento_portal}"

case "$PORTAL_APP_PATH" in
  ""|"/"|"/opt"|"/opt/apps"|"/home"|"/root") echo "PORTAL_APP_PATH inseguro: $PORTAL_APP_PATH" >&2; exit 1 ;;
esac
[ -f "$PORTAL_APP_PATH/.env" ] || { echo "Arquivo .env ausente." >&2; exit 1; }
[ -f "$RELEASE_ARCHIVE" ] || { echo "Release ausente: $RELEASE_ARCHIVE" >&2; exit 1; }

read_env_value() {
  local key="$1" file="$2" line
  line="$(grep -E "^${key}=" "$file" | tail -n 1 || true)"
  [ -n "$line" ] || return 0
  printf '%s\n' "${line#*=}" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

APP_PORT="$(read_env_value APP_PORT "$PORTAL_APP_PATH/.env")"
: "${APP_PORT:?APP_PORT ausente no .env.}"
export COMPOSE_PROJECT_NAME APP_PORT GIT_COMMIT="${ROLLBACK_COMMIT:-rollback}"

tmp="$(mktemp -d)"
cleanup() { rm -rf "$tmp"; }
trap cleanup EXIT
tar -xzf "$RELEASE_ARCHIVE" -C "$tmp"
[ -f "$tmp/docker-compose.yml" ] && [ -f "$tmp/Dockerfile" ] || { echo "Release invalida." >&2; exit 1; }

find "$PORTAL_APP_PATH" -mindepth 1 -maxdepth 1 ! -name .env ! -name data ! -name .releases ! -name .deploy-state -exec rm -rf -- {} +
cp -a "$tmp"/. "$PORTAL_APP_PATH"/
docker compose --project-name "$COMPOSE_PROJECT_NAME" --env-file "$PORTAL_APP_PATH/.env" config >/dev/null
docker compose --project-name "$COMPOSE_PROJECT_NAME" --env-file "$PORTAL_APP_PATH/.env" up -d --build --remove-orphans

for attempt in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null; then
    echo "Rollback do portal concluido: ${RELEASE_ARCHIVE}"
    exit 0
  fi
  if [ "$attempt" -eq 30 ]; then
    docker compose --project-name "$COMPOSE_PROJECT_NAME" --env-file "$PORTAL_APP_PATH/.env" logs --tail=120 app >&2 || true
    exit 1
  fi
  sleep 3
done
