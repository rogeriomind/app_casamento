**Análise de performance — Nosso Álbum — 12/09/2026**

É possível acelerar o portal preservando os arquivos originais. As maiores oportunidades encontradas são eliminar imagens baixadas sem necessidade, reaproveitar os bytes já recebidos e preparar versões de exibição adequadas à tela. Aumentar o servidor ou reduzir a qualidade dos arquivos não é a primeira medida indicada pelos dados locais.

Foram examinados o código, o PostgreSQL local, a compilação de produção e o tráfego de um navegador Edge automatizado. As orientações foram conferidas na documentação instalada do Next.js **16.3.4**, conforme o AGENTS.md.

**Estado após a implementação**

As melhorias prioritárias foram aplicadas em 12/09/2026. No novo teste móvel, as fotos decorativas passaram de 5,59 MB e três requisições para **zero bytes e zero requisições**. Nas mesmas condições simuladas, o evento `load` da primeira visita caiu de 12,05 s para **1,21 s**; o LCP observado foi de 0,77 s. No desktop, os três recursos passaram de 5,59 MB para **4,14 MB**, mantendo igualdade de pixels decodificados.

As 19 fotos locais encontradas agora têm miniaturas derivadas. Os arquivos usados na grade somam 2,78 MB, contra 8,55 MB das versões maiores correspondentes, uma redução medida de **67,5%**. Os arquivos maiores foram preservados. Novas importações também arquivam os bytes originais e registram sua chave e tipo no banco.

A API privada de fotos, capas e logos agora usa ETag e `private, no-cache`: cada resposta continua exigindo autenticação, enquanto o navegador pode receber 304 e reaproveitar os bytes. A busca das mídias remotas usa o cache de dados do Next por 30 dias. Fotos HEIC/HEIF abertas no visualizador são convertidas a partir do arquivo em resolução integral para WebP compatível, em vez de ampliar sua miniatura.

A sincronização automática passou a respeitar um intervalo de cinco minutos. Ela compara o acervo recebido com o salvo, atualiza apenas registros alterados e chama a atualização da página apenas quando há mudança real. A galeria deixou de pré-carregar as 24 páginas de detalhe, prioriza a primeira linha visível e mantém carregamento adiado para o restante. As consultas de tags foram transferidas para agregações no PostgreSQL, e a contagem padrão da galeria é reaproveitada.

Um estado de carregamento no nível da rota foi experimentado e removido: ele fazia o Next iniciar a resposta 200 antes de concluir a autorização, quebrando o 404 esperado para álbuns de outro usuário. Preservamos a semântica de autorização e a suíte voltou a passar.

**O que foi medido**

| Verificação | Resultado | Interpretação |
| --- | --- | --- |
| Imagens decorativas do login | 5.590.803 bytes, ou 5,59 MB | Três PNGs dominam a transferência inicial |
| Login em viewport móvel, cache vazio | 5,84 MB de subrecursos; evento `load` em 12,05 s | As três imagens são baixadas mesmo com o painel escondido |
| Conteúdo principal do login móvel | LCP de 0,80 s nessa execução | Os 12,05 s não significam que o formulário ficou bloqueado durante todo esse tempo |
| Mesma página móvel, recarregamento | `load` em 0,46 s; imagens respondem 304 | As imagens públicas já são revalidadas e reaproveitadas; isso difere da API privada |
| Login desktop, cache vazio | LCP de 0,60 s em rede local sem limitação | Não representa o desempenho de uma conexão externa |
| Conversão dos três PNGs para WebP lossless | 4.139.662 bytes; redução de 25,96% | Mesmas dimensões e igualdade dos pixels decodificados, verificada em cada imagem |
| 24 miniaturas mais recentes do álbum da captura | 1.289.932 bytes; 21–132 kB por imagem | A origem já fornece miniaturas relativamente leves |
| Busca direta dessas 24 miniaturas no CDN | 24 respostas 200; mediana de 165 ms e máximo de 599 ms | Tempos por arquivo, com três buscas concorrentes; não são tempos de renderização da galeria |
| Cache informado pelo CDN | `public, max-age=2592000` | O CDN permite reaproveitamento por 30 dias, mas o portal devolve `private, no-store` |
| Acervo local examinado | 61 mídias da captura: 58 fotos e 3 vídeos; mais 16 fotos locais | As fotos locais somam 8,14 MB e variam de 136 kB a 1,64 MB |
| Consultas SQL de tags, contagem e 24 registros recentes | 0,076–0,090 ms de execução no PostgreSQL | O processamento dessas consultas não explica sozinho a lentidão atual; conexão, autenticação e renderização são custos adicionais |

Os MB da análise usam base decimal. O teste móvel usou viewport 390 × 844, DPR 3, limitação configurada de 4 Mbps, latência de 80 ms e CPU 4× mais lenta. São medições de laboratório locais, com uma navegação inicial e um recarregamento por cenário, sem distribuição estatística de usuários reais. Recursos HTML não estão incluídos no total de subrecursos. O DPR foi configurado, mas o dispositivo continuou sendo Edge desktop automatizado.

O navegador também abriu uma galeria autenticada no banco de testes: ela estava vazia. Esse resultado valida apenas a abertura da página, e não o desempenho de uma galeria real cheia. As leituras do acervo real e do CDN foram separadas desse teste. Não foi executada sincronização do álbum real, nem medido o tempo até o primeiro quadro de vídeo.

**Prioridades e mudanças recomendadas**

| Ordem | Mudança | Benefício esperado | Esforço relativo |
| --- | --- | --- | --- |
| 1 | Evitar as fotos decorativas no tráfego móvel e converter os PNGs sem perda | Elimina 5,59 MB desnecessários no login móvel; economiza 26% nos arquivos desktop, mesmo sem redimensionamento | Baixo |
| 2 | Implementar cache privado de mídia e revalidação autenticada | Evita buscar e transferir repetidamente a mesma imagem | Médio |
| 3 | Criar miniaturas reais para as fotos locais e capas | A grade passa a receber arquivos compatíveis com seu tamanho de exibição | Médio |
| 4 | Separar carregamento inicial, detalhe da mídia e atualização da captura | Reduz espera percebida e trabalho repetido durante a navegação | Médio |
| 5 | Confirmar execução em produção para uso cotidiano | Evita compilação de rotas durante o acesso | Baixo |
| 6 | Refinar consultas e fontes, guiado por novas medições | Melhora a escala do acervo e reduz custos menores | Baixo a médio |

**1. Login: imagens grandes e downloads invisíveis.** Em [editorial-panel.tsx](D:/app_casamento_oficial/src/features/auth/components/editorial-panel.tsx:32), os três PNGs são imagens comuns, sem variantes responsivas. Em [login.module.css](D:/app_casamento_oficial/src/features/auth/components/login.module.css:115), o painel desaparece abaixo de 1.001 px, mas o navegador continua baixando seus arquivos. O teste confirmou zero imagens visíveis e 5,59 MB transferidos por elas no celular. No desktop de 1.440 px, elas aparecem com aproximadamente 200–326 px de largura, embora os arquivos tenham 1.122–1.254 px de largura.

A primeira correção deve selecionar recursos com `<picture>` e condições de mídia, de modo que o layout móvel não solicite as fotos escondidas. A prioridade alta da foto principal deve valer apenas quando ela for exibida. Para desktop, a conversão lossless testada já reduz o peso mantendo os pixels. Nomes versionados por conteúdo permitem cache longo para esses arquivos públicos. Variantes por largura e DPR podem trazer ganhos adicionais; são versões de exibição e exigem verificação visual em telas de alta densidade. O PNG original deve permanecer preservado.

**2. A API de imagens repete o caminho até o CDN.** Em [route.ts](D:/app_casamento_oficial/src/app/api/eventos/[id]/fotos/[photoId]/route.ts:16), cada requisição autentica o usuário, consulta a mídia, busca o arquivo remoto com `cache: "no-store"`, acumula todo o corpo em memória e só então o devolve com `Cache-Control: private, no-store`. Isso acrescenta uma passagem pelo servidor e impede o navegador de reaproveitar a resposta em acessos posteriores. As tentativas de recuperação também podem alongar bastante a espera quando a origem falha. Uma rerenderização não necessariamente baixa imagens novamente; o desperdício ocorre quando o navegador efetivamente faz uma nova requisição ao endpoint.

Recomendo cache dos bytes validados em armazenamento privado do servidor, com chave contendo origem, variante e versão, deduplicação de buscas simultâneas e limites de espaço/expiração. O endpoint pode usar `ETag` e `Cache-Control: private, no-cache`: a autorização continua sendo verificada antes de responder, inclusive antes de um 304, e o navegador reutiliza o conteúdo quando ele não mudou. Alterações, remoção e perda de acesso precisam invalidar a resposta correspondente. Esse fluxo preserva os mesmos bytes das imagens. A distinção entre armazenamento privado, revalidação e proibição de armazenamento é documentada pelo [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching).

Após resolver o cache, vale avaliar entrega por streaming para arquivos grandes, mantendo validação de tipo, tamanho e origem. Outra alternativa futura é entrega direta por URLs assinadas e temporárias, quando a configuração do provedor permitir. As miniaturas de vídeo têm proteção contra hotlinking; o código atual depende do `Referer` esperado pela origem. Uma troca direta de URL precisa preservar esse funcionamento.

Trocar todas as tags por `next/image` não resolve automaticamente essa parte: o otimizador padrão não encaminha os cabeçalhos de autenticação. As rotas privadas exigem uma estratégia própria de variantes e autorização. O componente é uma opção apropriada para os recursos públicos, observando `sizes` e a configuração de qualidade. [Documentação do Next.js](https://nextjs.org/docs/app/api-reference/components/image).

**3. Fotos locais e qualidade do original.** O ramo local de [route.ts](D:/app_casamento_oficial/src/app/api/eventos/[id]/fotos/[photoId]/route.ts:87) ignora a distinção entre miniatura e original e lê sempre o mesmo arquivo. A criação de variantes deve ocorrer na importação ou em processamento posterior, com tamanhos escolhidos pelo espaço visual e DPR. A capa precisa de uma variante pequena para o ícone lateral. O visualizador deve receber uma versão de resolução suficiente para a ampliação, com acesso separado ao original.

Há dois cuidados concretos com qualidade no fluxo atual. O [importador local](D:/app_casamento_oficial/scripts/import-rogerio-event-media.ts:128) reduz para no máximo 2.400 × 2.400 e grava WebP com qualidade 88; o arquivo servido localmente já é uma versão processada. Além disso, [a rota da captura](D:/app_casamento_oficial/src/app/api/eventos/[id]/fotos/[photoId]/route.ts:80) entrega a miniatura quando o original é HEIC/HEIF, inclusive na ampliação. Existem duas fotos HEIC/HEIF no acervo examinado. Para garantir preservação, o processo deve guardar o original intacto e gerar uma versão compatível em resolução integral para visualização, validando o suporte ao formato no processamento. A análise não comprovou a política de retenção dos originais no provedor externo.

**4. Navegação e sincronização.** A galeria já pagina em 24 itens e usa carregamento adiado e decodificação assíncrona em [gallery-thumbnail.tsx](D:/app_casamento_oficial/src/features/dashboard/components/gallery-thumbnail.tsx:14). Esses recursos devem ser mantidos. Convém priorizar apenas as imagens visíveis da primeira linha e adiar as demais. No dashboard, os cards usam carregamento imediato, inclusive os destaques inferiores.

Não há `loading.tsx` nem fronteiras de `Suspense` nas páginas examinadas. A galeria aguarda autenticação, evento, tags/contadores, contagem filtrada e registros antes de entregar a interface. Abrir uma mídia muda `?foto=...` e volta a executar a página, incluindo consultas da grade. Recomendo um estado de carregamento de rota e um visualizador que aproveite a grade já montada, mantendo URL compartilhável e verificação de acesso para o detalhe. Isso melhora a resposta percebida sem alterar os arquivos.

O [CaptureSync](D:/app_casamento_oficial/src/features/dashboard/components/capture-sync.tsx:29) sincroniza ao montar, ao voltar à aba e a cada 60 segundos. A [integração](D:/app_casamento_oficial/src/lib/capture-integration.ts:226) percorre o acervo remoto e faz um `upsert` sequencial por mídia; ao terminar, chama `router.refresh()` mesmo sem detectar alteração de conteúdo. Com 61 mídias e limite de 60 por página, uma sincronização completa normalmente exige duas páginas remotas e 61 operações de upsert. Ela ocorre depois da montagem e não bloqueia diretamente a primeira renderização, mas pode disputar recursos com o carregamento e repetir trabalho.

Recomendo respeitar a atualização já recente, evitar novas sincronizações em remontagens próximas, aplicar atualização incremental quando a origem oferecer suporte e retornar um indicador de mudança real. Atualizar a interface somente quando houver diferença; manter atualização manual e a proteção de concorrência existente. A medição do custo da sincronização real fica pendente, pois executá-la alteraria o acervo e não foi necessário para esta análise.

**5. Modo de execução.** O README orienta `npm run dev`. Em medição HTTP local, a primeira abertura de `/login` após iniciar o desenvolvimento levou 712 ms até os cabeçalhos, e a seguinte 102 ms; o servidor de produção já aquecido respondeu em 17 e 11 ms. O Next também informou filesystem lento durante a inicialização do modo de desenvolvimento. Isso é evidência local, não prova de que o portal usado no dia a dia esteja em desenvolvimento ou de que o disco seja a causa principal. O Next compila rotas sob demanda em desenvolvimento. [Documentação](https://nextjs.org/docs/app/guides/local-development).

Para uso cotidiano, executar `npm run build` ao preparar a versão e `npm run start` para servi-la. O build realizado nesta auditoria passou, incluindo a checagem TypeScript. O servidor de produção informou prontidão em 392 ms; esse número é de inicialização do processo, não do carregamento das imagens.

**6. Banco, fontes e vídeos.** A galeria lê as tags de todas as fotos; o dashboard repete esse padrão e consulta uma imagem para cada uma das quatro tags de destaque. A contagem da galeria padrão também repete a contagem total. São oportunidades para agregação no banco, reaproveitamento de resultados e cache com invalidação, especialmente quando o álbum crescer. Com 61 registros e os tempos medidos, não há justificativa para priorizar novos índices ou uma troca de banco sem novos planos de execução. As fontes somaram cerca de 147 kB no login desktop, contra 5,59 MB de imagens; otimizar pesos e carregamento pode vir depois.

O player de vídeo só é montado quando a mídia é aberta em [album-gallery.tsx](D:/app_casamento_oficial/src/features/dashboard/components/album-gallery.tsx:230), o que já evita carregar vários players na grade. Manter esse comportamento e melhorar o cache das capas é a prioridade. Depois, medir o primeiro quadro e eventuais interrupções na reprodução. Conferir no Bunny a retenção do original e as resoluções disponíveis antes de alterar codificação. Versões de reprodução podem ser diferentes do original; preservá-lo e manter uma opção de alta qualidade atende à exigência de conservação do acervo. A documentação do provedor distingue as versões codificadas e a opção de guardar o arquivo original. [Bunny Stream](https://docs.bunny.net/docs/stream-best-practices).

**Como validar a implementação futura**

- Confirmar que nenhuma das três imagens decorativas é solicitada na primeira abertura móvel.
- Comparar os pixels dos recursos lossless e os hashes dos originais antes e depois; revisar cor, orientação, nitidez e zoom em telas com DPR 1, 2 e 3.
- Medir a galeria real autenticada com cache vazio e aquecido, separando tempo do HTML, primeira linha visível, abertura de foto e primeiro quadro de vídeo. Repetir as navegações para obter mediana e percentis.
- Verificar revalidação 304, deduplicação no cache e bloqueio de conteúdo após perda de autorização ou remoção da mídia.
- Confirmar que ausência de mudanças na captura não provoca regravação de todo o acervo nem atualização desnecessária da página.

Os resultados brutos estão em [browser-results.json](D:/app_casamento_oficial/artifacts/performance-audit/browser-results.json), [lossless-images.json](D:/app_casamento_oficial/artifacts/performance-audit/lossless-images.json), [media-results.json](D:/app_casamento_oficial/artifacts/performance-audit/media-results.json), [database-results.json](D:/app_casamento_oficial/artifacts/performance-audit/database-results.json) e [server-mode-results.json](D:/app_casamento_oficial/artifacts/performance-audit/server-mode-results.json). Os scripts de navegador, comparação lossless e amostragem de mídia estão na mesma pasta de artefatos. Nenhum percentual de aceleração global foi prometido: as economias de bytes medidas e as hipóteses de melhora estão identificadas separadamente.
