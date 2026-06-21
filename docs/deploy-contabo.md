# Deploy GitHub Actions para VPS Contabo

Este projeto usa o fluxo:

Local -> GitHub -> GitHub Actions -> VPS Contabo -> Docker Compose.

## Arquivos criados

- `.github/workflows/deploy.yml`: roda lint, testes, build e deploy na branch `main`.
- `Dockerfile`: build da aplicacao Next.js com Prisma.
- `docker-compose.yml`: sobe `app` e `db` Postgres.
- `deploy/deploy.sh`: publica o pacote enviado pelo GitHub Actions e recria os containers.
- `scripts/bootstrap-contabo.sh`: prepara Docker, usuario `deploy`, firewall e pasta da aplicacao.
- `.env.production.example`: modelo do `.env` que deve existir somente na VPS.

## Secrets do GitHub

Cadastre em `Settings -> Secrets and variables -> Actions`:

```text
VPS_HOST=155.133.27.226
VPS_USER=deploy
VPS_PORT=22
VPS_SSH_KEY=conteudo_da_chave_privada_ssh
APP_PATH=/opt/apps/app_casamento
```

O workflow envia um pacote do codigo para a VPS via SSH. A VPS nao precisa clonar o repositorio no GitHub, o que funciona melhor para repositorios privados.

## Criar chave SSH para o GitHub Actions

No PowerShell local:

```powershell
ssh-keygen -t ed25519 -C "github-actions-app-casamento" -f "$env:USERPROFILE\.ssh\app_casamento_actions"
```

Use o conteudo da chave privada como secret `VPS_SSH_KEY`:

```powershell
Get-Content "$env:USERPROFILE\.ssh\app_casamento_actions" -Raw
```

Depois copie a chave publica para a VPS:

```powershell
scp "$env:USERPROFILE\.ssh\app_casamento_actions.pub" root@155.133.27.226:/root/app_casamento_actions.pub
```

## Preparar a VPS

Copie o script para a VPS e rode como root:

```powershell
scp scripts/bootstrap-contabo.sh root@155.133.27.226:/root/bootstrap-contabo.sh
ssh root@155.133.27.226 "APP_PATH=/opt/apps/app_casamento APP_PORT=3010 bash /root/bootstrap-contabo.sh"
```

Associe a chave publica ao usuario `deploy`:

```powershell
ssh root@155.133.27.226 "install -d -m 700 -o deploy -g deploy /home/deploy/.ssh && cat /root/app_casamento_actions.pub > /home/deploy/.ssh/authorized_keys && chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys"
```

A senha root deve ser usada apenas no bootstrap inicial. Nao cadastre senha da VPS como secret do GitHub.

## Criar o .env de producao na VPS

Na VPS:

```bash
cd /opt/apps/app_casamento
nano .env
```

Use `.env.production.example` como referencia. Nao envie `.env` para o GitHub.

Para producao com o Postgres do `docker-compose.yml`, o `DATABASE_URL` deve apontar para o host `db`.

## Primeiro push

Se o `git` nao estiver instalado no Windows:

```powershell
winget install --id Git.Git -e
```

Depois reabra o terminal e rode:

```bash
git init
git add .
git commit -m "chore: initial deploy pipeline"
git branch -M main
git remote add origin https://github.com/rogeriomind/app_casamento.git
git push -u origin main
```

O push para `main` dispara a esteira.

## Validar na VPS

```bash
cd /opt/apps/app_casamento
docker compose ps
docker compose logs -f app
```

Se `APP_PORT=3010`, o app deve responder em:

```text
http://155.133.27.226:3010
```

## Rollback manual

Na VPS:

```bash
cd /opt/apps/app_casamento
docker compose logs -f app
```

Para rollback por commit, rode novamente o workflow no GitHub a partir do commit desejado.
