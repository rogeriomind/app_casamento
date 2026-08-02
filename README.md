# Album Colaborativo de Casamento

App mobile-first para convidados enviarem fotos para galerias colaborativas, com uma instancia isolada por cliente.

## Como rodar

Configure o `.env` com Postgres, segredos e Bunny:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/album_casamento"
APP_BASE_URL="http://localhost:3000"
ADMIN_API_KEY="troque-esta-chave-admin"
CLIENT_HASH_SECRET="troque-este-segredo-longo"

BUNNY_STORAGE_ENDPOINT="<NOVO_ENDPOINT_BUNNY>"
BUNNY_STORAGE_PASSWORD="<NOVA_SENHA_STORAGE_ZONE>"
BUNNY_PUBLIC_BASE_URL="<URL_PUBLICA_DA_PULL_ZONE>"
```

```powershell
npm.cmd install
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run db:seed
npm.cmd run dev
```

Acesse o demo legado em `http://localhost:3000/e/leticia-rogerio`.

Para testar no celular com melhor desempenho, use o build de producao na rede:

```powershell
npm.cmd run build
npm.cmd run start:wifi
```

## API Administrativa

As rotas administrativas exigem:

```http
Authorization: Bearer <ADMIN_API_KEY>
```

Criar ou consultar uma instancia de cliente:

```powershell
$headers = @{
  Authorization = "Bearer $env:ADMIN_API_KEY"
  "Content-Type" = "application/json"
}

$body = @{
  clientName = "Cliente XPTO"
  clientNumber = "CLI-001"
  coupleName = "Leticia e Rogerio"
  eventDate = "2026-09-12T18:00:00.000Z"
  albumName = "Galeria do Casamento"
  monogram = "L+R"
  isActive = $true
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/api/admin/clients" `
  -Headers $headers `
  -Body $body
```

O retorno inclui `id`, `clientHash`, `publicUrl`, `metricsUrl` e `storagePrefix`. Reenviar o mesmo `clientNumber` retorna a instancia existente.

Consultar metricas:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/admin/clients/{clientHash}/metrics" `
  -Headers @{ Authorization = "Bearer $env:ADMIN_API_KEY" }
```

## Bunny.net Storage

Use a senha da Storage Zone em `BUNNY_STORAGE_PASSWORD`, nao a API key da conta Bunny.
Nunca exponha essa senha como `NEXT_PUBLIC_`, em logs, endpoints ou arquivos versionados.

Novos uploads sao organizados por cliente:

```text
clients/{clientHash}/photos/{uuid}.jpg
clients/{clientHash}/thumbnails/{uuid}-thumb.jpg
```

Antes do deploy ou apos trocar endpoint/senha, valide a Storage Zone:

```powershell
npm.cmd run bunny:check
```

Se a Pull Zone ou Storage Zone mudar, rode primeiro a migracao em dry-run:

```powershell
npm.cmd run bunny:migrate -- --dry-run --limit 10
```

O migrador nao apaga objetos antigos automaticamente.

## Scripts

- `npm.cmd run dev`: inicia o app local.
- `npm.cmd run dev:wifi`: inicia o app local acessivel na rede.
- `npm.cmd run lint`: roda ESLint.
- `npm.cmd run test`: roda testes unitarios.
- `npm.cmd run build`: valida build de producao.
- `npm.cmd run prisma:migrate`: aplica migrations no Postgres local.
- `npm.cmd run db:seed`: recria o evento demo e prepara assets publicos.

## Deploy

A esteira GitHub Actions -> VPS Contabo esta documentada em `docs/deploy-contabo.md`.
O `.env` de producao deve existir somente na VPS e pode ser criado a partir de `.env.production.example`.
Em producao, a aplicacao fica isolada em `/opt/apps/app_casamento` com `COMPOSE_PROJECT_NAME=app_casamento`, rede `app_casamento_internal` e volume `app_casamento_postgres_data`.

## Recursos

- Criacao de instancia por API com hash publico por cliente.
- Link publico por cliente em `/e/{clientHash}`.
- Compatibilidade com o slug legado do demo.
- Sessao local por aparelho e evento.
- Heartbeat para usuarios online nos ultimos 2 minutos, com intervalo de cerca de 60 segundos e reducao de escritas redundantes.
- Metricas administrativas de fotos, usuarios online e usuarios que entraram.
- Upload da galeria do celular e captura por camera.
- Persistencia em Postgres via Prisma.
