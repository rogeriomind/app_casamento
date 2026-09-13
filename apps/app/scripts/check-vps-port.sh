#!/usr/bin/env bash
set -euo pipefail

: "${APP_PORT:?APP_PORT nao definido. Configure APP_PORT no .env da aplicacao.}"
: "${COMPOSE_PROJECT_NAME:?COMPOSE_PROJECT_NAME nao definido. Use COMPOSE_PROJECT_NAME=app_casamento.}"

case "$APP_PORT" in
  *[!0-9]*|"")
    echo "APP_PORT invalido: informe um numero entre 1 e 65535." >&2
    exit 2
    ;;
esac

if [ "$APP_PORT" -lt 1 ] || [ "$APP_PORT" -gt 65535 ]; then
  echo "APP_PORT fora do intervalo permitido: $APP_PORT." >&2
  exit 2
fi

if ! command -v ss >/dev/null 2>&1; then
  echo "Comando ss nao encontrado; instale iproute2 para validar portas." >&2
  exit 2
fi

if command -v docker >/dev/null 2>&1; then
  docker compose ls >/dev/null 2>&1 || true
fi

ss_lines="$(ss -H -lntp "( sport = :$APP_PORT )" 2>/dev/null || true)"
if [ -z "$ss_lines" ]; then
  echo "Porta $APP_PORT livre."
  exit 0
fi

own_project_match=0
other_project_match=0

if command -v docker >/dev/null 2>&1; then
  while IFS=$'\t' read -r name ports project; do
    [ -n "${name:-}" ] || continue
    case "$ports" in
      *":$APP_PORT->"*|*":$APP_PORT-"*|*":$APP_PORT/"*)
        if [ "$project" = "$COMPOSE_PROJECT_NAME" ]; then
          own_project_match=1
        else
          other_project_match=1
          echo "Porta $APP_PORT ja publicada pelo container $name do projeto ${project:-desconhecido}." >&2
        fi
        ;;
    esac
  done < <(docker ps --format '{{.Names}}\t{{.Ports}}\t{{.Label "com.docker.compose.project"}}' 2>/dev/null || true)
fi

if [ "$other_project_match" -eq 1 ]; then
  exit 1
fi

if [ "$own_project_match" -eq 1 ]; then
  echo "Porta $APP_PORT ja pertence ao projeto $COMPOSE_PROJECT_NAME; permitido para atualizacao."
  exit 0
fi

echo "Conflito: porta $APP_PORT esta em uso por outro processo." >&2
echo "$ss_lines" >&2
exit 1
