# Nosso Álbum

Aplicação local Next.js com cadastro, confirmação por código, login real e criação de álbuns. Contas, sessões e rascunhos ficam no PostgreSQL 18.

## Executar

A instância instalada usa o serviço Windows `postgresql-nossoalbum18`, em `127.0.0.1:5432`. Os binários ficam em `C:\Program Files\PostgreSQL\18`, e os dados em `C:\ProgramData\NossoAlbumPostgres18`.

```sh
npm install
npm run db:start
npm run db:deploy
npm run dev
```

`npm run dev` compila páginas sob demanda e deve ser usado somente durante o desenvolvimento. Para usar o portal com as otimizações de produção:

```sh
npm run build
npm run start
```

Abra [Criar conta](http://127.0.0.1:3000/cadastro) ou [Entrar](http://127.0.0.1:3000/login).

Cadastre seu nome, e-mail e senha de pelo menos oito caracteres. Use **A1B2C3** para confirmar. Depois, o login aceita o e-mail e a senha que você cadastrou. Se a conta estiver pendente, o login com a senha correta retoma a confirmação.

O código fixo só é habilitado quando `BETTER_AUTH_URL` aponta para localhost/127.0.0.1 e `MOCK_EMAIL_CODE` está configurado. Em produção, remova `MOCK_EMAIL_CODE` e configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_FROM`; a confirmação é enviada pelo SMTP.

## Configuração e banco

As credenciais estão no arquivo local `.env`, ignorado pelo versionamento. Use `.env.example` como modelo em outra máquina. O arquivo preexistente `.env.txt` foi preservado.

- `DATABASE_URL`: banco `nosso_album`.
- `TEST_DATABASE_URL`: banco separado `nosso_album_test`.
- `BETTER_AUTH_SECRET`: segredo da autenticação.
- `UPLOAD_DIR`: diretório privado de capas, atualmente `.local/uploads`.
- `MEDIA_DIR`: diretório privado das fotos importadas, atualmente `.local/media`.
- `BUNNY_STORAGE_ENDPOINT`, `BUNNY_STORAGE_PASSWORD`, `BUNNY_IMPORT_EVENT_PATH`: origem opcional para sincronizar fotos reais do storage.
- `MEDIA_IMPORT_EVENT_ID`: opcional; fixa qual álbum criado de Rogério recebe a sincronização. Sem ele, é usado o álbum criado mais recentemente.

```sh
npm run db:start
npm run db:stop
npm run db:status
npm run db:deploy
npm run media:thumbnails
npm run db:migrate
npm run db:generate
```

Iniciar/parar o serviço pode solicitar elevação do Windows. Migrações e comandos da aplicação não exigem executar o editor como administrador.

## Jornada

1. `/cadastro`: validação de nome, e-mail e senha.
2. `/cadastro/confirmar-email`: código de seis caracteres, colagem, reenvio e correção do e-mail.
3. `/cadastro/concluido`: conta confirmada e sessão iniciada.
4. `/eventos/novo/tipo`: seis tipos de evento.
5. `/eventos/novo/informacoes`: nome, data e descrição de até 300 caracteres.
6. `/eventos/novo/personalizacao`: capa opcional e seis cores.
7. `/eventos/[id]/criado`: confirmação com os dados reais.
8. `/eventos/[id]`: dashboard privado do álbum, com fotos e métricas derivadas dos dados salvos.

Voltar permite editar etapas anteriores. O preenchimento salva automaticamente no banco; uma cópia temporária por rascunho na aba protege digitação imediatamente antes de recarregar. A navegação aguarda as gravações. Concluir repetidamente retorna o mesmo álbum.

Capas JPG, PNG e WEBP de até 5 MB são decodificadas e validadas no servidor, normalizadas para WEBP e servidas somente ao proprietário. Personalizar depois usa azul-marinho e a fotografia padrão de celebração, mesmo que uma capa já tenha sido escolhida.

Google, recuperação de senha, Explorar primeiro, convites, QR Code e envio de fotos continuam indisponíveis nesta etapa. O dashboard trata álbuns vazios e guarda fotos importadas em storage privado, acessível apenas ao proprietário.

Para popular o álbum criado mais recente do usuário confirmado **Rogério**, execute:

```sh
npm run media:seed-rogerio
```

O importador é idempotente, normaliza os arquivos para WEBP, registra a origem de cada mídia e serve o resultado apenas ao proprietário. Quando as chaves Bunny estão configuradas, ele baixa as fotos reais da pasta definida em `BUNNY_IMPORT_EVENT_PATH`; sem elas, usa as três fotografias locais de demonstração. As imagens são baixadas e processadas uma a uma, com limite de 12 MB por origem. A sincronização do storage substitui somente os registros de demonstração que o próprio importador criou.

## Verificação

```sh
npm run typecheck
npm run test
npm run test:e2e
```

O comando E2E gera o build, aplica as migrações ao banco isolado e executa o Playwright no Chromium em `127.0.0.1:3001`. Ele recusa configuração que reutilize o banco da aplicação. Os uploads de teste usam `.local/test-uploads`. Capturas das sete telas e do login ficam em `artifacts/`.

Para administrar a integração com a captura, use `npm run capture:link -- --owner-email ... --portal-event-id ... --capture-event-id ... --capture-client-hash ...`. O comando faz simulação por padrão; acrescente `--apply` depois de validar o resultado. `npm run capture:sync-all` percorre as integrações existentes e é executado pelo timer de cinco minutos em produção.

Os componentes de autenticação, cadastro e etapas do evento ficam em `src/features/`. Fontes e fotografias são locais. APIs de cadastro usam cookie HttpOnly opaco, temporário, vinculado ao usuário pendente; a alteração de e-mail invalida o código anterior. APIs de evento verificam sessão, confirmação de e-mail e propriedade.
