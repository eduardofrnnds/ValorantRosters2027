# Perfis de jogadores — Tarefa 07

Atualização da tarefa 13: o perfil agora lê jogadores e vínculos publicados via
Supabase, com aliases antigos e cadastro administrativo. Consulte
[ADMIN_PLAYERS.md](ADMIN_PLAYERS.md). A descrição abaixo registra a etapa local
original da tarefa 07; os dados locais continuam vazios.

`/player/[slug]` consulta dados locais no servidor e renderiza `PlayerProfile`.
`localPlayers` e `localPlayerMemberships`, em
`src/features/players/data/local-players.ts`, permanecem vazios. Qualquer slug
sem jogador publicado retorna HTTP 404, `noindex` e recuperação para as regiões.
Não há cadastro, API, transferência ou autenticação integrados ao perfil.
A Tarefa 08 adicionou [schema e migrations](SCHEMA_POSTGRESQL.md), ainda sem
conexão com a página. O contrato local descrito aqui permanece em uso.

`src/proxy.ts` atua somente em `/player/:slug`: consulta a mesma fonte local
de perfis publicados e define HTTP 404 antes de renderizar o fallback. A página
devolve diretamente o componente `not-found`, com título e `noindex` próprios.
Isso contorna um comportamento observado no Next 16.3.4: `notFound()` na rota
dinâmica gerava um HTML de erro vazio, exibindo a mensagem apenas com JavaScript.
O proxy não faz requisições, gravações, autenticação ou consultas de banco.
Ao integrar a fonte persistida, revisar essa resolução em conjunto com a página;
não manter duas fontes de verdade nem adicionar consultas remotas ao proxy sem
reavaliar a estratégia. As demais rotas não entram no matcher.

## Identidade e campos

`src/types/player.ts` contém os contratos de leitura:

| Campo de Player | Regra |
| --- | --- |
| `id` | Identidade persistente; não gerar a partir de nickname ou slug. |
| `slug` | Endereço do perfil; independente do ID. |
| `nickname` | Nome de exibição, não uma chave de relacionamento. |
| `name`, `photoUrl` | Opcionais; não completar com dados presumidos. |
| `nationality` | Texto de nacionalidade publicado; ausente mostra “Não informada”. |
| `role` | `duelist`, `initiator`, `controller`, `sentinel`, `flex` ou `coach`; opcional. |
| `publicationStatus` | `draft` ou `published`; somente o segundo é público. |

`PlayerCardData` deriva de `Pick<Player, "id" | "slug" | "nickname">`.
Renomeações preservam o ID e seus vínculos. Não há implementação de aliases ou
redirecionamento de slugs antigos nesta etapa; o schema de histórico de slugs
foi criado na Tarefa 08, mas ainda não está conectado às rotas. Fotos devem vir de arquivos/URLs autorizados; a interface
usa ícone genérico na ausência ou falha da imagem.

## Carreira e equipe atual

`PlayerMembership` tem ID próprio, `playerId`, `organizationId`, `seasonId`,
status de elenco (`starter`, `reserve`, `inactive`, `coach`), `startDate`,
`endDate` opcional e status de publicação. Datas usam `YYYY-MM-DD`; a data final
é inclusiva. Este contrato é local, não uma migration ou modelo final do banco.

`getPlayerProfile`:

1. Resolve somente jogador publicado pelo slug.
2. Filtra vínculos publicados pelo ID do jogador antes de resolver referências.
3. Resolve organizações e temporadas pelos IDs; referências/datas inválidas geram
   erro explícito, sem preencher valores fictícios.
4. Considera atual um vínculo já iniciado cuja data final esteja ausente ou seja
   igual/posterior à data consultada. Não deduz que inativo/reserva perdeu o vínculo.
5. Mostra passagens encerradas em ordem decrescente de início, sem filtrar a
   temporada. Retornos à mesma organização preservam registros separados.
6. Omite vínculos ainda não iniciados de equipe atual e histórico. Não há seção
   de anúncios futuros nesta tarefa.

A rota usa a data UTC da requisição, sem pré-renderizar uma identidade fictícia.
Datas são formatadas em PT-BR com UTC para evitar deslocamento de dia. Um vínculo
antigo sem data final continua atual: não inferir desligamento pela troca de
temporada. Se existirem vários vínculos atuais publicados, todos aparecem; a
camada não escolhe arbitrariamente uma equipe. Regras de conflito e publicação
persistida dependem das tarefas de backend.

As fontes locais de elenco por organização e de carreira individual continuam
vazias. A futura integração deverá ler ambas a partir dos mesmos vínculos
persistidos, para manter consistência; não foi criada sincronização simulada.

## Verificação

- `npm test`: testa zero registros, rascunhos, identidade após renomeação,
  nicknames iguais, outras temporadas, retornos, datas e renderização dos campos.
- `npm run test:e2e`: verifica o 404 real e a recuperação em quatro larguras,
  incluindo teclado, toque, movimento reduzido e ausência de JavaScript.
- O mesmo comando renderiza o componente real com dados sintéticos isolados em
  `tests/fixtures/`, via `renderToStaticMarkup`, usando o CSS do build. Confere
  vazios, carreira, nomes longos, âncoras, links de equipe, overflow e axe.
- As capturas desses cenários contêm “Cenário isolado de teste — não publicado”.
  Não são evidência de jogadores reais cadastrados, hidratação do perfil ou
  tratamento de falha de imagem em navegador. Não houve teste de leitor de tela.

Nenhum teste insere registros no app. O helper de TSX usa o TypeScript já
instalado, em memória. Nenhuma dependência foi adicionada.
