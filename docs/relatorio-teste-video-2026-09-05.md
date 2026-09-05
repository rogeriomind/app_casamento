# Relatorio de teste de upload de video

Data: 05/09/2026 (America/Sao_Paulo)

Ambiente: producao

URL: https://digax.productpulse.com.br/e/leticia-rogerio

## Resultado

**Falha confirmada — severidade alta.** O evento aceita a selecao do video, reconhece o arquivo e exibe a etapa de tags, mas nao consegue iniciar a publicacao.

## Arquivo usado

- Nome: `VID_20260905_130202040.mp4`
- Formato reconhecido: MP4 (`video/mp4`)
- Tamanho: 7.538.792 bytes (aproximadamente 7,19 MiB)
- Duracao detectada pela interface: 4 segundos
- Limites exibidos/aplicados pelo produto: ate 60 segundos e ate 100 MiB

O arquivo esta dentro dos limites aceitos pela aplicacao.

## Passos para reproduzir

1. Acessar o album do evento.
2. Informar o nome do convidado e entrar.
3. Selecionar **Adicionar** > **Enviar da galeria**.
4. Escolher o arquivo MP4 informado acima.
5. Confirmar que a tela **Adicionar tags** mostra o video e a duracao de 4 segundos.
6. Adicionar a tag `#festa`.
7. Selecionar **Publicar video**.

## Resultado esperado

O upload TUS deve ser iniciado no Bunny Stream, a interface deve exibir o progresso e, ao final, informar que o video aparecera na galeria depois do processamento.

## Resultado obtido

A interface retorna para **Minhas fotos** e exibe:

> Nao foi possivel publicar as fotos agora.

O video nao e enviado nem aparece na galeria.

## Evidencia da API

Uma chamada controlada ao mesmo endpoint usado pela interface, com sessao valida e os metadados do arquivo, retornou:

- Endpoint: `POST /api/events/cms0ycape0000pi677kakz9g6/videos/init`
- HTTP: `500`
- Codigo: `BUNNY_STREAM_NOT_CONFIGURED`
- Mensagem: `Envio de video nao configurado.`

## Causa provavel

A producao nao possui uma configuracao valida do Bunny Stream. O backend exige as seguintes variaveis:

- `BUNNY_STREAM_LIBRARY_ID`
- `BUNNY_STREAM_API_KEY`
- `BUNNY_STREAM_PULL_ZONE_HOSTNAME`
- `BUNNY_STREAM_WEBHOOK_SECRET`

Nenhum valor secreto foi coletado ou registrado durante o teste.

## Correcao recomendada

1. Configurar as quatro variaveis do Bunny Stream no ambiente de producao conforme `.env.production.example`.
2. Confirmar que `BUNNY_STREAM_LIBRARY_ID` contem apenas o identificador numerico da biblioteca.
3. Configurar no Bunny Stream o webhook HTTPS da aplicacao e usar a chave de leitura correspondente em `BUNNY_STREAM_WEBHOOK_SECRET`.
4. Reiniciar ou republicar o servico para carregar as novas variaveis.
5. Repetir este teste e acompanhar as fases: inicializacao, upload TUS, processamento e publicacao na galeria.

## Reteste apos cadastro de GitHub Secrets

Foi executado um novo teste depois da inclusao dos secrets de video no GitHub. O ambiente publico continuou retornando:

- HTTP: `500`
- Codigo: `BUNNY_STREAM_NOT_CONFIGURED`
- Mensagem: `Envio de video nao configurado.`

O ultimo workflow de deploy disponivel no repositorio e de 03/08/2026; adicionar um secret nao inicia automaticamente um novo workflow.

Mais importante: o workflow `.github/workflows/deploy.yml` nao injeta os secrets `BUNNY_STREAM_*` no container. Ele exclui o `.env` do pacote e preserva o arquivo `/opt/apps/app_casamento/.env` existente na VPS. O `docker-compose.yml` carrega a configuracao do servico a partir desse arquivo.

Portanto, no fluxo de deploy atual, os valores precisam ser adicionados ao `.env` da VPS e o container da aplicacao precisa ser recriado/reiniciado. Apenas cadastrar os valores na area de GitHub Secrets nao altera a producao.

## Observacao de UX

A mensagem apresentada ao convidado fala em "fotos" mesmo quando o item selecionado e um video e oculta o erro especifico retornado pela API. Depois de corrigir a configuracao, recomenda-se ajustar o texto para mencionar `video`/`midia` e preservar uma mensagem acionavel para falhas de inicializacao.

## Validacao local apos configuracao do Bunny Stream

O webhook foi configurado e permaneceu salvo na biblioteca Stream `casamento` (`745183`) com o destino:

`https://digax.productpulse.com.br/api/webhooks/bunny-stream`

O `.env` local foi completado com a chave somente leitura, sem expor o valor, e o hostname da Pull Zone foi alinhado ao exibido pela biblioteca.

Um novo teste local com `VID_20260905_130202040.mp4` apresentou:

- criacao de sessao: sucesso;
- inicializacao do video: HTTP `201`;
- upload TUS: sucesso;
- mensagem da interface: `Video enviado. Ele aparecera na galeria apos o processamento.`;
- video localizado no painel Bunny com miniatura, resolucao `1920x1080` e duracao processada de 2 segundos;
- webhook assinado simulado localmente: HTTP `200`;
- video publicado e visivel em **Minhas fotos**, com miniatura, duracao `0:02` e controles de reproducao/exclusao.

Isso confirma que as credenciais locais e o fluxo de upload estao funcionais. A producao ainda precisa receber as quatro variaveis `BUNNY_STREAM_*` em `/opt/apps/app_casamento/.env` e ter o container recriado. A tentativa de conexao SSH direta a VPS expirou, portanto essa etapa nao foi aplicada durante o reteste.

## Reteste final como convidado

Depois da confirmacao de que a configuracao havia sido concluida, foi realizado outro teste completo pela interface publica, simulando um convidado real:

- sessao utilizada: `Teste Codex Video`;
- origem: **Adicionar** > **Enviar da galeria**;
- arquivo: `VID_20260905_130202040.mp4`;
- duracao reconhecida: 4 segundos;
- tag selecionada: `#festa`;
- acao executada: **Publicar video**.

Resultado: **falha reproduzida novamente em producao**. A aplicacao retornou para **Minhas fotos**, exibiu `Nao foi possivel publicar as fotos agora.` e ofereceu o botao **Tentar novamente**. O video nao apareceu na galeria.

Como o mesmo arquivo concluiu todo o fluxo no ambiente local, este reteste reforca que a pendencia esta no ambiente de producao: as variaveis precisam estar disponiveis para o processo em execucao e o container deve ter sido recriado apos a alteracao do `.env`. Tambem deve ser verificado se o `.env` alterado e exatamente `/opt/apps/app_casamento/.env`, que e o arquivo carregado pelo `docker-compose.yml`.
