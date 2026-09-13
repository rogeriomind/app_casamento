#!/usr/bin/env bash
set -euo pipefail

: "${PORTAL_APP_PATH:?PORTAL_APP_PATH nao informado.}"
: "${RELEASE_TARBALL:?RELEASE_TARBALL nao informado.}"
COMMIT_SHA="${COMMIT_SHA:-unknown}"
PORTAL_ENV_FILE="${PORTAL_ENV_FILE:-}"
BACKUP_ROOT="${BACKUP_ROOT:-$PORTAL_APP_PATH/.backups}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
RELEASE_DIR=""

cleanup() {
  local status=$?
  set +e
  [ -z "${RELEASE_DIR:-}" ] || [ ! -d "$RELEASE_DIR" ] || rm -rf "$RELEASE_DIR"
  [[ "${PORTAL_ENV_FILE:-}" == /tmp/app_casamento_portal_*.env ]] && rm -f -- "$PORTAL_ENV_FILE" || true
  trap - EXIT
  exit "$status"
}
trap cleanup EXIT

case "$PORTAL_APP_PATH" in
  ""|"/"|"/opt"|"/opt/apps"|"/home"|"/root") echo "PORTAL_APP_PATH inseguro: $PORTAL_APP_PATH" >&2; exit 1 ;;
esac

read_env_value() {
  local key="$1" file="$2" line
  line="$(grep -E "^${key}=" "$file" | tail -n 1 || true)"
  [ -n "$line" ] || return 0
  printf '%s\n' "${line#*=}" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

merge_env() {
  local source="$1" target="$2" key tmp next
  [ -f "$source" ] || { echo "Arquivo de SMTP ausente." >&2; exit 1; }
  tmp="$(mktemp "$PORTAL_APP_PATH/.env.merge.XXXXXX")"
  cp "$target" "$tmp"
  for key in SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER SMTP_PASSWORD SMTP_FROM; do
    grep -Eq "^${key}=.+$" "$source" || { rm -f "$tmp"; echo "Variavel $key ausente." >&2; exit 1; }
    next="${tmp}.next"
    awk -v key="$key" -v source="$source" 'BEGIN { while ((getline line < source) > 0) if (index(line, key "=") == 1) replacement=line; close(source) } index($0, key "=") == 1 { if (!replaced) { print replacement; replaced=1 }; next } { print } END { if (!replaced) print replacement }' "$tmp" > "$next"
    mv "$next" "$tmp"
  done
  chmod 600 "$tmp"
  mv "$tmp" "$target"
  chmod 600 "$target"
}

[ -f "$RELEASE_TARBALL" ] || { echo "Pacote nao encontrado: $RELEASE_TARBALL" >&2; exit 1; }
[ -f "$PORTAL_APP_PATH/.env" ] || { echo "Crie $PORTAL_APP_PATH/.env antes do primeiro deploy." >&2; exit 1; }
RELEASE_DIR="$(mktemp -d)"
tar -xzf "$RELEASE_TARBALL" -C "$RELEASE_DIR"
[ -f "$RELEASE_DIR/docker-compose.yml" ] && [ -f "$RELEASE_DIR/Dockerfile" ] || { echo "Pacote de portal invalido." >&2; exit 1; }
if [ -n "$PORTAL_ENV_FILE" ]; then
  case "$PORTAL_ENV_FILE" in /tmp/app_casamento_portal_*.env) ;; *) echo "PORTAL_ENV_FILE inseguro." >&2; exit 1 ;; esac
  merge_env "$PORTAL_ENV_FILE" "$PORTAL_APP_PATH/.env"
fi

COMPOSE_PROJECT_NAME="$(read_env_value COMPOSE_PROJECT_NAME "$PORTAL_APP_PATH/.env")"
APP_PORT="$(read_env_value APP_PORT "$PORTAL_APP_PATH/.env")"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-app_casamento_portal}"
APP_PORT="${APP_PORT:-3011}"
case "$APP_PORT" in *[!0-9]*|"") echo "APP_PORT invalida." >&2; exit 1 ;; esac
export COMPOSE_PROJECT_NAME APP_PORT GIT_COMMIT="$COMMIT_SHA"
compose_cmd() {
  docker compose \
    --project-name "$COMPOSE_PROJECT_NAME" \
    --project-directory "$PORTAL_APP_PATH" \
    --env-file "$PORTAL_APP_PATH/.env" \
    -f "$PORTAL_APP_PATH/docker-compose.yml" \
    "$@"
}

if command -v ss >/dev/null 2>&1 && ss -lnt | awk '{print $4}' | grep -Eq ":${APP_PORT}$"; then
  existing_app_id="$(compose_cmd ps -q app 2>/dev/null || true)"
  existing_app_port=""
  if [ -n "$existing_app_id" ]; then
    existing_app_port="$(docker port "$existing_app_id" 3000/tcp 2>/dev/null | awk -F: 'NR == 1 { print $NF }' || true)"
  fi
  if [ "$existing_app_port" != "$APP_PORT" ]; then
    selected=""
    for candidate in $(seq 3012 3099); do
      if ! ss -lnt | awk '{print $4}' | grep -Eq ":${candidate}$"; then selected="$candidate"; break; fi
    done
    [ -n "$selected" ] || { echo "Nenhuma porta livre entre 3012 e 3099." >&2; exit 1; }
    sed "s/^APP_PORT=.*/APP_PORT=${selected}/" "$PORTAL_APP_PATH/.env" > "$PORTAL_APP_PATH/.env.port"
    mv "$PORTAL_APP_PATH/.env.port" "$PORTAL_APP_PATH/.env"
    chmod 600 "$PORTAL_APP_PATH/.env"
    APP_PORT="$selected"
    export APP_PORT
    echo "APP_PORT ocupada; portal selecionado na porta $APP_PORT. Atualize o proxy HTTPS."
  fi
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="$BACKUP_ROOT/$timestamp-$COMMIT_SHA"
install -d -m 700 "$backup_dir" "$PORTAL_APP_PATH/.releases" "$PORTAL_APP_PATH/data/uploads" "$PORTAL_APP_PATH/data/media"
cp "$PORTAL_APP_PATH/.env" "$backup_dir/env.backup"
chmod 600 "$backup_dir/env.backup"
if [ -n "$(compose_cmd ps -q db 2>/dev/null || true)" ]; then
  db_name="$(read_env_value POSTGRES_DB "$PORTAL_APP_PATH/.env")"
  db_user="$(read_env_value POSTGRES_USER "$PORTAL_APP_PATH/.env")"
  [ -z "$db_name" ] || [ -z "$db_user" ] || compose_cmd exec -T db pg_dump -U "$db_user" "$db_name" > "$backup_dir/postgres.sql" || true
  [ -f "$backup_dir/postgres.sql" ] && chmod 600 "$backup_dir/postgres.sql" || true
fi

find "$PORTAL_APP_PATH" -mindepth 1 -maxdepth 1 ! -name .env ! -name data ! -name .backups ! -name .releases ! -name .deploy-state -exec rm -rf -- {} +
cp -a "$RELEASE_DIR"/. "$PORTAL_APP_PATH"/
rm -f "$RELEASE_TARBALL"
tar --exclude='.env' --exclude='data' --exclude='.backups' --exclude='.releases' --exclude='node_modules' --exclude='.next' -czf "$PORTAL_APP_PATH/.releases/$timestamp-$COMMIT_SHA.tar.gz" -C "$PORTAL_APP_PATH" .
compose_cmd config >/dev/null
compose_cmd up -d --build --remove-orphans
install -d -m 755 "$PORTAL_APP_PATH/.deploy-state"
printf '%s\n' "$COMMIT_SHA" > "$PORTAL_APP_PATH/.deploy-state/last-commit"
printf '%s\n' "$timestamp" > "$PORTAL_APP_PATH/.deploy-state/last-deploy-at"
for attempt in $(seq 1 30); do
  health_body="$(curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" 2>/dev/null || true)"
  if printf '%s' "$health_body" | grep -Eq "\"commit\"[[:space:]]*:[[:space:]]*\"${COMMIT_SHA}\""; then break; fi
  if [ "$attempt" -eq 30 ]; then compose_cmd logs --tail=120 app >&2 || true; exit 1; fi
  sleep 3
done
find "$PORTAL_APP_PATH/.releases" -maxdepth 1 -type f -name '*.tar.gz' | sort -r | tail -n "+$((KEEP_RELEASES + 1))" | xargs -r rm -f
compose_cmd ps
echo "Deploy do portal finalizado para commit $COMMIT_SHA na porta $APP_PORT."
