# Deploy e migração

O workflow `.github/workflows/ci-deploy.yml` valida as duas aplicações em Pull Requests e publica a `main` na VPS após os testes. Os jobs de produção usam o ambiente `production` e o grupo de concorrência `production-app-casamento`.

## VPS

Mantenha a captura em `/opt/apps/app_casamento`, na porta `3010`, com o volume PostgreSQL 16 existente. O portal usa `/opt/apps/app_casamento_portal`, a porta interna `3011`, o projeto Compose `app_casamento_portal` e um volume PostgreSQL 18 separado. Os diretórios persistentes do portal ficam em `/opt/apps/app_casamento_portal/data`.

O DNS `portal.productpulse.com.br` deve apontar para `155.133.27.226`. A inspeção atual encontrou o Caddy no contêiner `pmo_agent-caddy-1`, lendo `/opt/pmo_agent/deploy/Caddyfile`, com `digax.productpulse.com.br` encaminhado para o Nginx do host em `172.19.0.1:8088`. Preserve essa topologia: adicione no Caddyfile `portal.productpulse.com.br { reverse_proxy 172.19.0.1:8088 }` e no Nginx um `server_name portal.productpulse.com.br` que encaminhe para `127.0.0.1:3011`. Faça backup antes da alteração e valide `caddy validate`, `nginx -t` e o certificado antes de recarregar.

## Secrets

No ambiente `production`, configure `VPS_HOST`, `VPS_USER`, `VPS_PORT`, `VPS_SSH_KEY`, `APP_PATH`, `PORTAL_APP_PATH`, `PORTAL_SMTP_HOST`, `PORTAL_SMTP_PORT`, `PORTAL_SMTP_USER`, `PORTAL_SMTP_PASSWORD` e `PORTAL_SMTP_FROM`. Mantenha no `.env` da VPS os segredos de banco, Better Auth, Bunny e a chave administrativa da captura; o workflow não imprime nem substitui o `.env` completo.

## Migração

Pare gravações do portal local durante o snapshot final. Exporte PostgreSQL 18 em formato custom, copie `UPLOAD_DIR` e `MEDIA_DIR` com manifesto SHA-256, restaure no banco vazio da instância do portal e valide as contagens antes de apontar o DNS. Os caminhos armazenados são basenames; configure `UPLOAD_DIR=/data/uploads` e `MEDIA_DIR=/data/media` dentro do contêiner e monte os diretórios persistentes. Cookies localhost expiram conceitualmente com o novo domínio; os usuários devem entrar novamente.

Não execute migrações do portal contra o banco da captura. O deploy cria backups do `.env`, do banco e da release antes de atualizar. O rollback restaura a imagem anterior e mantém o banco na versão atual.

Para uma recuperação manual, escolha uma release em `/opt/apps/app_casamento_portal/.releases` e execute, sem restaurar o banco automaticamente:

```bash
PORTAL_APP_PATH=/opt/apps/app_casamento_portal \
RELEASE_ARCHIVE=/opt/apps/app_casamento_portal/.releases/<release>.tar.gz \
bash deploy/portal-rollback.sh
```

## Sincronização

Na VPS, o serviço `app-casamento-capture-sync.service` executa `npm run capture:sync-all` no contêiner do portal a cada cinco minutos via `app-casamento-capture-sync.timer`. A execução usa lock para impedir sobreposição e sincroniza somente integrações já gravadas.

Instale `deploy/systemd/app-casamento-capture-sync.service` e `.timer` em `/etc/systemd/system/` e ative-os:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now app-casamento-capture-sync.timer
systemctl list-timers app-casamento-capture-sync.timer
journalctl -u app-casamento-capture-sync.service
```
