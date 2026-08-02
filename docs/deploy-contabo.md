# Deploy seguro na VPS Contabo

Fluxo: GitHub Actions valida o codigo, empacota a release, envia por SSH e executa `deploy/deploy.sh` em `/opt/apps/app_casamento`.

## Isolamento

Use estes valores no `.env` da VPS:

```env
APP_PORT=3010
COMPOSE_PROJECT_NAME=app_casamento
```

Antes de escolher a porta na VPS:

```bash
docker compose ls
docker ps --format 'table {{.Names}}\t{{.Ports}}'
ss -lntp
```

Verifique primeiro `3010`. Se estiver ocupada por outra aplicacao, escolha a primeira livre entre `3011` e `3099`. Nao pare outra aplicacao para liberar porta.

O Compose publica somente `127.0.0.1:${APP_PORT}:3000`, usa rede `app_casamento_internal`, volume `app_casamento_postgres_data` e nao publica PostgreSQL no host.

## Nginx

Use `deploy/nginx/app-casamento.conf.example` como base. Substitua `${APP_PORT}` pela porta escolhida e mantenha o acesso externo apenas por HTTPS nas portas 80/443. Crie backup antes de substituir qualquer arquivo real:

```bash
sudo cp /etc/nginx/sites-available/app-casamento.conf \
  /etc/nginx/sites-available/app-casamento.conf.$(date -u +%Y%m%dT%H%M%SZ).bak
```

## Bunny Storage

No `.env` da VPS, preencha somente valores reais locais:

```env
BUNNY_STORAGE_ENDPOINT=<NOVO_ENDPOINT_BUNNY>
BUNNY_STORAGE_PASSWORD=<NOVA_SENHA_STORAGE_ZONE>
BUNNY_PUBLIC_BASE_URL=<URL_PUBLICA_DA_PULL_ZONE>
```

Valide antes do deploy:

```bash
cd /opt/apps/app_casamento
docker run --rm --env-file .env -v "$PWD":/app -w /app node:24-bookworm-slim \
  node scripts/check-bunny-storage.mjs
```

Se apenas endpoint regional/senha mudaram e a Pull Zone continua igual, nao altere URLs gravadas. Se Storage Zone ou Pull Zone mudarem, rode:

```bash
npm run bunny:migrate -- --dry-run --limit 20
npm run bunny:migrate -- --resume
```

O script de migracao nunca remove objetos da origem.

## GitHub Secrets

Configure:

```text
VPS_HOST=<host>
VPS_USER=deploy
VPS_PORT=22
VPS_SSH_KEY=<chave_privada_ssh>
APP_PATH=/opt/apps/app_casamento
```

Nao envie `.env` de producao pelo GitHub Actions.

## Bootstrap

Na VPS, como root:

```bash
APP_PATH=/opt/apps/app_casamento bash /root/bootstrap-contabo.sh
```

O firewall abre SSH, 80 e 443. A porta interna da aplicacao nao deve ser aberta publicamente. Para diagnostico temporario:

```bash
sudo ufw allow <APP_PORT>/tcp
sudo ufw delete allow <APP_PORT>/tcp
```

## Preflight do deploy

O script de deploy:

- exige `APP_PATH`, `.env`, `APP_PORT` e `COMPOSE_PROJECT_NAME`;
- executa `scripts/check-vps-port.sh`;
- executa `docker compose --project-name "$COMPOSE_PROJECT_NAME" --env-file "$APP_PATH/.env" config`;
- valida Bunny Storage;
- roda preflight Node em container temporario;
- registra `df -h` e `docker system df`;
- faz backup de `.env` e `pg_dump` em `/opt/backups/app_casamento`;
- sobe containers somente com projeto Compose explicito;
- faz healthcheck em `http://127.0.0.1:${APP_PORT}/api/health`;
- preserva releases recentes em `.releases`.

O deploy aborta antes de subir containers se a porta estiver ocupada por outro processo/projeto.

## Validacao

```bash
cd /opt/apps/app_casamento
COMPOSE_PROJECT_NAME=app_casamento docker compose --env-file .env ps
curl -fsS "http://127.0.0.1:${APP_PORT}/api/health"
```
