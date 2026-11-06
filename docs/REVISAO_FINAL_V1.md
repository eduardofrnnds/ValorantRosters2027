# Revisão final — versão 1.0.0

> Atualização posterior: o site foi publicado. Uma nova consulta ao npm durante
> o deploy reportou nove pacotes vulneráveis (um crítico); a conclusão histórica
> de zero alertas abaixo não representa o estado atual. Consulte
> [PUBLICACAO.md](PUBLICACAO.md) para o resultado atual e a correção pendente.

Data: 06/11/2026. Escopo: Tarefa 17. Revisão local e preparação de deploy,
sem publicação, escrita remota ou criação de dados reais. O aceite desta tarefa
é o relatório verificável de resultados e pendências, não a homologação em produção.

Ambiente: Windows, Node v24.19.0, npm 11.17.0, Next.js 16.3.4, React 19.2.8.
Dependências diretas não foram alteradas. `package.json` e lockfile identificam
a versão local como 1.0.0; isso não representa uma release publicada.

## Resultados executados

| Comando/verificação | Resultado real |
| --- | --- |
| `npm run check` | Aprovado: ESLint e TypeScript com geração dos tipos de rotas. |
| `npm test` | **130/130 aprovados**, sem falhas ou skips; execução direta, 17,28 s. |
| `npm run build` | Aprovado: compilação, TypeScript e geração de 24/24 páginas estáticas; rotas dinâmicas disponíveis no servidor. |
| `npm run test:integration` | Aprovado: catálogo local, integração com adaptador isolado e fluxo administrativo HTTP. |
| `npm run test:release` | Aprovado: **44 rotas**, **13 assets** e **7 pares de contraste**. |
| `npm run test:e2e` | Aprovado: home, regiões, equipes e roteiros de jogadores em Edge 157.0.4341.42, nas larguras 320, 390, 768 e 1440 px. |
| `npm run test:admin -- --browser` | HTTP aprovado; inicialização do navegador bloqueada por `spawn EPERM`. Nenhuma verificação visual administrativa concluída. |
| `npm run lint` após os ajustes dos verificadores | Aprovado, sem warnings. |
| `npm audit --json` | Zero vulnerabilidades conhecidas reportadas; não equivale a auditoria de segurança completa. |

O navegador público iniciou nesta execução, apesar dos bloqueios de lançamento
em tarefas anteriores. O processo administrativo retorna zero após registrar o
bloqueio de lançamento: esse código
de saída aprova somente o HTTP, e não os fluxos visuais.

Nos roteiros públicos concluídos, axe não encontrou violações; teclado, busca,
ordenação, estados vazios, retorno de navegação, toque, movimento reduzido e
cenários sem JavaScript passaram, sem overflow ou erros de navegador nos casos
verificados. As 32 equipes foram conferidas por HTTP e perfis selecionados nas
quatro larguras. Os perfis preenchidos de jogador foram testados como componentes
SSR isolados: o catálogo local não tem jogadores publicados. Esses testes não
atestam hidratação/falha de foto nem navegação visual de um perfil remoto real.
As capturas da home em 390 e 1440 px também foram inspecionadas visualmente.

Uma primeira tentativa de `npm test` redirecionada por `Tee-Object` falhou ao
iniciar os processos de testes (`spawn EPERM`). A repetição direta executou os
130 testes com sucesso. O log da tentativa bloqueada foi preservado como
`artifacts/task-17/tests-piped-blocked.log`; ele não é o resultado final da suíte.
O resultado da execução direta e do build foi observado no terminal desta tarefa,
sem captura integral de log em disco.

## Cobertura funcional e de segurança

- As oito migrations foram aplicadas em bancos PGlite vazios durante os testes.
  Seed executado duas vezes, preservando identidades, edições e auditoria;
  equipes extras e temporadas adicionais aceitas, sem limite de oito.
- RLS e permissões exercitadas com papéis anon/authenticated: dados privados,
  rascunhos e auditoria protegidos; admin ativo permitido, usuário comum,
  admin revogado, sessão expirada/forjada e falta de configuração bloqueados.
- CRUD administrativo por HTTP nativo: criação/edição, publicação/arquivo,
  slugs e aliases, identidade estável, validação e conflitos de versão.
- Rascunhos: salvar/editar/arquivar não altera o elenco público; preview,
  conflitos de titular e base desatualizada verificados.
- Publicação: confirmação explícita, transação, origem/autorização, histórico,
  função por vínculo, fonte/autoria, idempotência e rollback com falha injetada.
- Transferência: origem e destino atualizados juntos, mesmo UUID do jogador,
  carreira preservada, conflitos e replay; feed, filtros, paginação e linhas do
  tempo refletem os eventos. Nota pública escapada e IDs de autores omitidos.
- Contagens, estados vazios, temporada não publicada e indisponibilidade
  exercitados. Falha do backend não ativa o snapshot local silenciosamente.

As integrações usam Next de produção, SDK Supabase, substitutos HTTP de
Auth/PostgREST e PostgreSQL/RLS em PGlite. O argumento `--remote` do teste de
catálogo significa **adaptador local**, não conexão a um projeto Supabase real.
PGlite não comprova concorrência entre conexões PostgreSQL independentes.

## SEO, acessibilidade e assets

A auditoria HTTP conferiu idioma `pt-BR`, viewport, título/descrição e um `h1`
e `main` nas 39 páginas regulares; também conferiu quatro 404 e o redirecionamento
protegido de `/admin`. Login e 404 têm `noindex`; o login e admin usam `no-store`.
Foram testados estados vazios de elencos, histórico e transferências.

Os 13 recursos locais referenciados responderam 200, incluindo favicon SVG,
CSS e JavaScript; o marcador privado de teste não apareceu no HTML nem nesses
recursos. Isso é uma verificação específica, não uma prova geral de ausência de
segredos. Não há dependência de fonte remota ou logos/jogadores inventados.

Os sete pares de tokens de texto avaliados superaram 4,5:1, com razões de 5,24:1
a 17,67:1. A análise matemática não cobre toda combinação renderizada, imagens,
opacidade, foco ou interações. A cobertura axe/teclado depende dos roteiros de
navegador efetivamente concluídos. Não há URL canônica inventada sem domínio final.

## Correções e preparação entregues

- Página 404 geral em português, com retorno ao início, substituindo a resposta
  padrão do framework. As páginas específicas de equipe/jogador permanecem.
- README atualizado para os fluxos implementados, configuração, comandos,
  limitações e documentação operacional; guias Auth/seed passaram a orientar
  aplicação das oito migrations, evitando configuração incompleta.
- `.env.example` explica ambientes, build e o uso privado/local de `DATABASE_URL`.
  `.vercelignore` exclui segredos, configurações locais e evidências do upload CLI.
- Scripts `test:integration` e `test:release` adicionados; `test:e2e` inicia e
  encerra seu servidor. Verificadores usam `artifacts/task-17/` por padrão.
- Guia [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md): Node 24, instalação/build, migrations,
  seed, primeiro admin, Storage opcional, ambientes, homologação e reversão.
- Migrations e seed existentes revisados pelos testes; nenhum SQL histórico
  reescrito. Hashes dos oito arquivos registrados em `release-http.json`.

## Pendências externas reais

1. **Supabase real:** provisionar e aplicar as oito migrations, executar seed,
   criar conta/allowlist, validar Auth, Data API, grants/RLS e Storage opcional.
   Somente `.env.example` existe; nenhuma credencial remota foi usada.
2. **Navegador administrativo:** executar os roteiros mobile, axe e interação do
   editor/publicação/transferência em ambiente que permita lançar o navegador.
   O bloqueio atual está em `admin/browser.json`; testes HTTP não o substituem.
3. **Concorrência real:** duas sessões/conexões em publicação e transferência,
   verificando conflitos, bloqueios e integridade no Supabase de homologação.
4. **Implantação HTTPS:** criar/importar projeto Vercel, configurar ambientes,
   validar cookies/origem das requisições e executar smoke test na URL final.
   Git, Vercel e domínio não foram configurados nem publicados nesta tarefa.

Nenhuma pendência acima foi apresentada como sucesso. Não há tarefa 18 no plano;
a próxima etapa operacional é homologação externa e deploy, mediante novo pedido.

## Evidências

- [Auditoria HTTP e hashes](../artifacts/task-17/release-http.json).
- [Dependências](../artifacts/task-17/npm-audit.json) e
  [lint/typecheck](../artifacts/task-17/check.log).
- Catálogo: [local](../artifacts/task-17/public/integration/local-http.json) e
  [integrado](../artifacts/task-17/public/integration/remote-http.json).
- Admin: [resultado HTTP](../artifacts/task-17/admin/results.json),
  [rascunhos](../artifacts/task-17/admin/drafts-http.json),
  [publicação](../artifacts/task-17/admin/publication-http.json),
  [transferências](../artifacts/task-17/admin/transfers-http.json) e
  [navegador bloqueado](../artifacts/task-17/admin/browser.json).
- Imagens e relatórios de navegador público em `artifacts/task-17/public/`.
  São dados isolados de teste; não são registros de produção.
  Resultados: [home](../artifacts/task-17/public/home/results.json),
  [regiões](../artifacts/task-17/public/regions/results.json),
  [equipes](../artifacts/task-17/public/teams/results.json) e
  [jogadores](../artifacts/task-17/public/players/results.json).
