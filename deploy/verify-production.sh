#!/usr/bin/env bash
set -euo pipefail

: "${APP_PATH:?APP_PATH nao informado.}"
: "${PORTAL_APP_PATH:?PORTAL_APP_PATH nao informado.}"
: "${COMMIT_SHA:?COMMIT_SHA nao informado.}"

read_env_value() {
  local key="$1" file="$2" line
  line="$(grep -E "^${key}=" "$file" | tail -n 1 || true)"
  [ -n "$line" ] || return 0
  printf '%s\n' "${line#*=}" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

verify_health() {
  local service="$1" port="$2" attempt body
  for attempt in $(seq 1 30); do
    body="$(curl -fsS "http://127.0.0.1:${port}/api/health" 2>/dev/null || true)"
    if printf '%s' "$body" | grep -Eq "\"commit\"[[:space:]]*:[[:space:]]*\"${COMMIT_SHA}\""; then
      printf '%s: %s\n' "$service" "$body"
      return 0
    fi
    sleep 3
  done
  printf 'Healthcheck de %s nao confirmou o commit %s na porta %s. Ultima resposta: %s\n' \
    "$service" "$COMMIT_SHA" "$port" "$body" >&2
  return 1
}

app_port="$(read_env_value APP_PORT "$APP_PATH/.env")"
portal_port="$(read_env_value APP_PORT "$PORTAL_APP_PATH/.env")"
[ -n "$app_port" ] || { echo "APP_PORT da captura ausente." >&2; exit 1; }
[ -n "$portal_port" ] || { echo "APP_PORT do portal ausente." >&2; exit 1; }

verify_health capture "$app_port"
verify_health portal "$portal_port"
