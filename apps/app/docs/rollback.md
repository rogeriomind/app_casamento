# Rollback do app_casamento

Nunca restaure banco automaticamente sem confirmacao explicita do operador.

## Antes do rollback

Registre:

- commit atual e commit desejado;
- porta `APP_PORT`;
- arquivo Nginx ativo;
- valores antigos/novos do Bunny;
- migration Prisma aplicada;
- ultimo backup em `/opt/backups/app_casamento`.

## Codigo e release

As releases ficam em:

```text
/opt/apps/app_casamento/.releases
```

Para voltar para um pacote anterior:

```bash
cd /opt/apps/app_casamento
sudo install -d -m 700 /tmp/app_casamento_rollback
tar -xzf .releases/<release-anterior>.tar.gz -C /tmp/app_casamento_rollback
cp .env /tmp/app_casamento_rollback/.env
rsync -a --delete --exclude .env --exclude .releases /tmp/app_casamento_rollback/ ./
COMPOSE_PROJECT_NAME=app_casamento docker compose --env-file .env up -d --build --remove-orphans
curl -fsS "http://127.0.0.1:${APP_PORT}/api/health"
```

## Banco

Se a migration aplicada for incompativel com o codigo anterior, avalie restaurar `postgres.sql` de `/opt/backups/app_casamento/<data-commit>/`.

Restauracao exige janela de manutencao e confirmacao manual:

```bash
cd /opt/apps/app_casamento
COMPOSE_PROJECT_NAME=app_casamento docker compose --env-file .env exec -T db \
  psql -U "$POSTGRES_USER" "$POSTGRES_DB" < /opt/backups/app_casamento/<backup>/postgres.sql
```

## Bunny e imagens

O migrador nao apaga objetos antigos. Para rollback de Bunny, recoloque os valores anteriores no `.env` da VPS e rode:

```bash
docker run --rm --env-file .env -v "$PWD":/app -w /app node:24-bookworm-slim \
  node scripts/check-bunny-storage.mjs
```

Se a Pull Zone antiga voltar, imagens com `imageUrl` legado continuam como fallback quando nao houver `imageObjectPath`.

## Proxy e porta

Se a porta escolhida mudar, atualize o upstream Nginx para `127.0.0.1:<APP_PORT>` e recarregue:

```bash
sudo nginx -t
sudo systemctl reload nginx
```
