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

BUNNY_STREAM_LIBRARY_ID="<ID_DA_STREAM_LIBRARY>"
BUNNY_STREAM_API_KEY="<API_KEY_DA_STREAM_LIBRARY>"
BUNNY_STREAM_PULL_ZONE_HOSTNAME="<HOSTNAME_DA_PULL_ZONE_STREAM>"
BUNNY_STREAM_WEBHOOK_SECRET="<READ_ONLY_API_KEY_DO_WEBHOOK_STREAM>"
BUNNY_STREAM_REQUEST_TIMEOUT_MS="10000"
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

## Bunny Stream

Videos usam Bunny Stream com upload TUS direto do navegador. A API Next.js cria o video, grava o registro como `uploading` e devolve apenas credenciais temporarias de TUS; o arquivo nunca passa como multipart completo pelo app.

Configure o webhook da Stream Library para:

```text
https://seu-dominio.com/api/webhooks/bunny-stream
```

Use `BUNNY_STREAM_WEBHOOK_SECRET` com a Read-Only API Key informada pela Bunny para validar `x-bunnystream-signature`. O webhook publica o video apenas quando o Bunny conclui o processamento, atualiza thumbnail/duracao/dimensoes e rejeita videos acima de 60 segundos, excluindo-os do Bunny Stream.

Limites da primeira versao:

- 1 video por selecao, ate 100 MB e 60 segundos.
- Ate 10 fotos por selecao continuam permitidas.
- Nao misturar fotos e video na mesma selecao.
- A grade sempre usa thumbnail; o player Bunny so carrega no modal.

Teste manual no celular:

1. Acesse o album por `/e/{clientHash}` em HTTPS.
2. Toque em `Adicionar` > `Tirar foto` e confirme que a foto aparece.
3. Toque em `Adicionar` > `Gravar video`, grave menos de 60s, adicione tags e publique.
4. Aguarde o processamento Bunny; atualize a galeria e confirme thumbnail, play e duracao.
5. Abra o video na galeria e confirme o player Bunny no modal.
6. Exclua uma foto e um video enviados pelo mesmo nome de convidado.
7. Tente selecionar fotos e video juntos; o app deve bloquear a selecao.

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
- Upload direto de videos para Bunny Stream com TUS.
- Persistencia em Postgres via Prisma.
