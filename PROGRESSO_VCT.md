# Progresso — VCT Roster Tracker

Atualizado em: 06/11/2026.

## Status

- [x] TAREFA 00 — Auditoria do workspace e plano técnico.
- [x] TAREFA 01 — Inicialização e estrutura Next.js.
- [x] TAREFA 02 — Design system, Magic UI e layout base.
- [x] TAREFA 03 — Dados iniciais e tipos — 32 parceiros VCT 2027.
- [x] TAREFA 04 — Página inicial pública.
- [x] TAREFA 05 — Páginas públicas das quatro regiões.
- [x] TAREFA 06 — Página pública de organização.
- [x] TAREFA 07 — Página pública individual de jogador.
- [x] TAREFA 08 — Schema PostgreSQL e migrations.
- [x] TAREFA 09 — Supabase e seed idempotente de 2027 (implementação e validação local).
- [x] TAREFA 10 — Login administrativo e políticas de segurança (validação local).
- [x] TAREFA 11 — Dashboard administrativo (implementação e validação local).
- [x] TAREFA 12 — CRUD de organizações e temporadas (implementação e validação local).
- [x] TAREFA 13 — CRUD de jogadores (implementação e validação local).
- [x] TAREFA 14 — Editor de rosters e rascunhos (implementação e validação local).
- [x] TAREFA 15 — Publicação segura e atômica de rosters (implementação e validação local).
- [x] TAREFA 16 — Transferência manual e linha do tempo (implementação e validação local).
- [x] TAREFA 17 — Revisão final, testes e preparo para Vercel (revisão local; pendências externas documentadas).
- Próxima tarefa: **nenhuma numerada; plano 00–17 concluído**. Próxima etapa operacional: homologação externa e deploy, mediante novo pedido.
- Próximo passo autorizado: publicar repositório público no GitHub e fazer deploy
  na Vercel, conforme pedido posterior à Tarefa 17; commits somente de Eduardo
  Fernandes. Estado atual em [docs/PUBLICACAO.md](docs/PUBLICACAO.md).

## Tarefa 17 — revisão concluída em 06/11/2026

- [x] `npm run check`, `npm test` (**130/130**), build e lint final aprovados.
  Auditoria npm sem vulnerabilidades conhecidas reportadas.
- [x] Integração HTTP pública/local e com adaptador isolado aprovada; admin
  validou RLS, sessão, CRUD, rascunhos, publicação, transferência e histórico.
- [x] Auditoria da entrega: **44 rotas, 13 assets, sete pares de contraste**,
  metadados, estados vazios, proteção admin e 404 em português aprovados.
- [x] `npm run test:e2e`: navegador público passou em 320/390/768/1440 px,
  incluindo axe, teclado, toque e cenários sem JavaScript. Perfis preenchidos
  de jogador são componentes SSR isolados, sem dados reais publicados.
- [x] README, `.env.example`, `.vercelignore`, guias Auth/seed e scripts de
  verificação atualizados; versão local 1.0.0 no pacote/lockfile. Oito migrations
  e seed revisados pelos testes, sem alteração retroativa de SQL.
- Correção: página 404 geral localizada em português, com retorno ao início.
- Relatório: [docs/REVISAO_FINAL_V1.md](docs/REVISAO_FINAL_V1.md).
  Implantação: [docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md).
  Evidências: `artifacts/task-17/`.
- Pendências: navegador administrativo bloqueado por `spawn EPERM`; Supabase
  real, Storage opcional, concorrência entre conexões e homologação HTTPS.
  Uma tentativa de testes com redirecionamento foi bloqueada; execução direta
  posterior passou. Nenhum bloqueio foi contabilizado como teste aprovado.
- Nenhum deploy, escrita remota, repositório Git ou configuração externa criado.
  **Plano encerrado; aguardar novo pedido para homologação/deploy.**

## Tarefa 16 — implementação concluída em 06/11/2026

- [x] Formulário manual em `/admin/transfers`: vínculo de origem, destino,
  data, status, observação pública e fonte opcional. Revisão GET e confirmação
  POST nativas, com melhoria por JavaScript e autorização revalidada.
- [x] Migration `20261106000500_manual_transfers.sql`: transferência transacional
  sob RLS, versões dos dois elencos/vínculo, validação de visibilidade, datas,
  sobreposições futuras e rascunhos. UUID do jogador e carreira preservados.
- [x] Origem encerrada, destino criado, evento com antes/depois, fonte, nota,
  autor, revisões e auditoria no mesmo commit. Pedido privado impede duplicação
  por replay; falha injetada desfaz todas as gravações.
- [x] `/transfers` com filtros de região/equipe/data/tipo, paginação e estados
  de vazio/erro. RPC pública de leitura com RLS e projeção sem pedidos privados.
  Linhas do tempo em equipe/jogador e mudanças recentes reais na home.
- [x] `npm test`: **130/130**; lint/TypeScript e build aprovados. Onze testes
  novos incluem ida/volta, rollback, permissões/revogação, replay, conflitos,
  funções históricas, filtros inclusivos, paginação e privacidade.
- [x] HTTP de produção local com SDK, Auth/PostgREST isolados e PostgreSQL/RLS:
  formulário nativo, confirmação, mudanças nas duas equipes, perfil/carreira,
  feed/home, filtros, nota escapada, replay e falha de leitura aprovados.
  Regressão pública local/integrada aprovada, incluindo `/transfers` vazio.
- Arquivos: migration, página/handler admin de transferências, módulos `transfer-*`
  e `features/transfers`, perfis/home/header públicos, tipos, testes e verificadores.
  Textos antigos do editor de rascunhos e acentuação da função na carreira corrigidos.
- Guia: `docs/ADMIN_TRANSFERS.md`. Evidências: `artifacts/task-16/`.
- Limites: navegador bloqueado por `spawn EPERM`, sem aprovação visual/axe/interação.
  Supabase remoto e concorrência entre conexões reais não validados. Nova migration
  ainda não aplicada ao banco real; nenhum deploy ou escrita remota.
- **Tarefa 17 não iniciada.** Aguardar novo comando.

## Tarefa 15 — implementação concluída em 06/11/2026

- [x] Revisão da versão salva, fonte opcional e confirmação explícita; POST
  nativo/JSON com verificação de origem, campos, sessão e autorização atual.
- [x] Migration `20261106000400_roster_publication.sql`: RPC transacional sob
  RLS, autorização dentro da operação, locks, snapshot/revisão, visibilidade
  e conflitos de intervalos revalidados. Replay confirmado não duplica gravações.
- [x] Fecha vínculos no dia anterior à vigência, cria entradas/substitutos e
  preserva os inalterados. Função por vínculo, estados anterior/posterior,
  fonte, autor, data, revisão e auditoria persistidos no mesmo commit.
- [x] Rascunho publicado imutável; cache público revalidado somente após sucesso.
  Equipe pública e carreira refletem vínculos e funções publicados, preservando
  passagens anteriores. Sem workflow de transferência interequipes.
- [x] `npm test`: **119/119**; lint/TypeScript e build aprovados. Nove testes
  novos incluem falha injetada com rollback integral, replay, permissões,
  versões, datas, conflitos futuros, funções e metadados históricos.
- [x] Integração HTTP de produção local com SDK, Auth/PostgREST isolados e
  PostgreSQL/RLS: confirmação, atualização pública, histórico e replay aprovados.
  Regressão pública local/integrada: home, quatro regiões, 32 equipes e 404.
- Arquivos: migration, revisão/handler de publicação, módulos `roster-publication-*`,
  modelos/leitores de vínculos, cards e carreira, tipos, testes e verificadores.
- Guia: `docs/ADMIN_ROSTER_PUBLICATION.md`. Evidências: `artifacts/task-15/`.
- Limites: navegador bloqueado por `spawn EPERM`; sem aprovação visual/axe/teclado.
  Sem validação Supabase remoto ou concorrência entre conexões reais; sem deploy
  ou escrita remota. Aplicação da nova migration no banco real permanece pendente.
- Etapa posterior: tarefa 16 concluída acima após autorização do usuário.

## Tarefa 14 — implementação concluída em 06/11/2026

- [x] Seleção por temporada/região/equipe; grupos de titulares, reservas,
  inativos e técnicos; adição de jogadores, status/função e saídas propostas.
- [x] Rascunho privado com snapshot da base, data fixa, prévia de diferenças,
  edição por versão e arquivamento com histórico. Sem publicação ou transferência.
- [x] Migration `20261106000300_roster_draft_editor.sql`: snapshot e RPCs sob RLS,
  revisão/base verificadas, disputa de titular entre equipes/rascunhos bloqueada.
- [x] Página de equipe lê vínculos/perfis publicados; teste confirma que salvar
  rascunhos não muda jogadores, vínculos, revisão, eventos nem elenco público.
- [x] `npm test`: **110/110**; lint/TypeScript e build aprovados. Integração HTTP
  local com SDK, Auth/PostgREST isolados e PostgreSQL/RLS aprovada. Regressão
  pública local: home, quatro regiões, 32 equipes e 404 aprovados.
- Arquivos: páginas/handlers de `admin/rosters`, módulos `roster-draft-*`,
  leitura pública de elenco e página de equipe, tipos do cliente, migration,
  `tests/roster-drafts.test.mjs`, verificadores/helper, README e documentação.
- Guia: `docs/ADMIN_ROSTER_DRAFTS.md`. Evidências: `artifacts/task-14/`.
- Limites: navegador bloqueado por `spawn EPERM` (sem validação visual/axe/interação).
  Editor requer JavaScript; leitura/arquivamento têm HTML nativo. Sem validação
  Supabase remoto ou concorrência real entre conexões; sem deploy/escrita remota.
  Datas finais e publicação de vínculos serão revalidadas na tarefa 15.
- Etapa posterior: tarefa 15 concluída acima após autorização do usuário.

## Tarefa 13 — implementação concluída em 06/11/2026

- [x] Lista/busca, criação/edição de jogador: nickname, nome, país, função,
  foto, links e visibilidade. UUID fixo por formulário novo impede duplicação por replay.
- [x] Migration `20261106000200_player_management.sql`: links e RPC sob RLS,
  slugs automáticos únicos, reserva de aliases, versão otimista e auditoria.
- [x] Perfil público com dados persistidos e carreira publicada; aliases públicos
  redirecionam 307/no-store, aliases exclusivamente privados continuam 404.
- [x] Upload opcional de foto com limites/validação e políticas documentadas.
- [x] `npm test`: **99/99**; lint/TypeScript e build aprovados. HTTP de produção
  local confirma criação/edição, busca, replay, slugs, publicação, histórico e CSRF.
  Regressão pública local: home, quatro regiões, 32 equipes e 404 aprovados.
- Arquivos: páginas/handlers admin de jogadores, módulos `player-*`, editor
  compartilhado, tipos/clientes, perfil público e proxy, migration, testes,
  verificadores admin e helper `verify-players-admin.mjs`, docs e `.env.example`.
- Evidências: `artifacts/task-13/`. Guia: `docs/ADMIN_PLAYERS.md`.
- Limites: navegador bloqueado por `spawn EPERM`; sem aprovação visual/axe/teclado.
  Supabase/Storage remotos não validados; sem deploy ou escrita remota. Upload e
  SQL não são atômicos. Leituras públicas não compartilham snapshot transacional.
  Nenhuma transferência ou edição de elenco implementada nesta etapa.
- Próxima tarefa: **14**, autorizada pelo usuário durante o fechamento desta etapa.

## Tarefa 12 — implementação concluída em 06/11/2026

- [x] Listagem/busca, criação e edição de organizações, temporada/região/categoria,
  criação/edição de temporadas, publicação explícita e arquivamento/restauração.
- [x] Migration `20261106000100_organization_management.sql`: três RPCs sob RLS,
  criação atômica com primeira participação, `archived_at`, versões por `updated_at`.
  IDs/vínculos preservados; nenhum limite de oito equipes e nenhuma exclusão física.
- [x] Validação Zod, POST protegido, estados reais de erro e upload opcional com
  tamanho/MIME/assinatura, nomes aleatórios e bucket/políticas documentados.
- [x] `npm test`: **89/89**; lint/TypeScript e build aprovados.
- [x] HTTP de produção local com SDK, Auth/PostgREST isolados e PostgreSQL/RLS:
  nona equipe publicada aparece na região; renomear, arquivar/restaurar, temporada
  adicional, conflitos, CSRF e proteções anteriores aprovados.
- Arquivos: páginas/handlers em `src/app/admin`, módulos `organization-*` e
  `editor-form` em `src/features/admin`, tipos do cliente, navegação, migration,
  `tests/admin-organizations.test.mjs`, verificador admin e helper
  `scripts/lib/verify-organizations.mjs`, `.env.example`, README e documentação.
- Evidências: `artifacts/task-12/`. Guia: `docs/ADMIN_ORGANIZATIONS.md`.
- Limites: navegador bloqueado por `spawn EPERM` (sem aprovação visual/axe/teclado);
  Supabase e upload/políticas Storage remotos não validados. Sem deploy ou escrita
  remota. Storage/SQL não são uma transação única; resultado desconhecido pode
  deixar arquivo órfão. Slug antigo de organização retorna 404.
- Próxima tarefa: **13**, autorizada pelo usuário durante o fechamento desta etapa.

## Tarefa 11 — implementação concluída em 05/11/2026

### Revalidação em 06/11/2026

- [x] Implementação existente conferida: layout protegido, navegação desktop/mobile,
  contagens reais via Supabase e revalidação de autorização após a leitura.
- [x] `npm test`: **79/79 aprovados**, incluindo dashboard, autenticação e RLS.
- [x] `npm run check`: lint e TypeScript aprovados.
- Nenhuma alteração no código da aplicação; somente este registro atualizado.
- Build, integração HTTP e navegador não repetidos nesta retomada. As evidências
  de `artifacts/task-11/` são da execução anterior; continuam pendentes a validação
  visual/responsiva e a integração com Supabase remoto.
- Próxima tarefa recomendada: **12 — CRUD de organizações e temporadas**.
  Não iniciada; próximo passo autorizado: aguardar comando do usuário.

### Entrega

- [x] `/admin` com topbar, sidebar, menu mobile nativo e quatro cards de totais.
- [x] Contagens exatas via Supabase HEAD, sob RLS e com JWT do admin, sem
  carregar listagens. Abrangem todas as temporadas e incluem não publicados;
  Equipes conta organizações únicas, Rascunhos conta somente status `draft`.
- [x] Zero mostra “Sem dados”; falhas parciais/totais ficam indisponíveis, sem
  inventar valores. Atualização manual por GET e novas leituras a cada navegação.
- [x] Links para organizações, jogadores, elencos e transferências levam a
  resumos reais protegidos; navegação indica rota ativa. Sem novos CRUDs.
- [x] Guarda própria da leitura e revalidação após consultas, além de proxy e
  layout; sem chave privilegiada, cache persistente ou fallback de contagens.
- [x] Nenhuma dependência, migration, gráfico ou registro real adicionado.

### Arquivos

- `src/features/admin/{dashboard-model,dashboard-reader,dashboard-server}.ts`:
  contratos, consultas e guarda; `auth-model.ts`: projeção de leitura ampliada.
- `src/features/admin/{dashboard,navigation,section-page}.tsx`: cards, avisos,
  navegação e resumos compartilhados.
- `src/app/admin/(protected)/{layout,page}.tsx` e páginas
  `organizations`, `players`, `rosters`, `transfers`.
- `tests/admin-dashboard.test.mjs`, `scripts/verify-admin-access.mjs`;
  `scripts/verify-catalog-integration.mjs` aceita destino alternativo de artefatos.
- `docs/ADMIN_DASHBOARD.md`, README, docs de autenticação/design, plano e progresso.

### Testes reais

- `npm test`: **79/79 aprovados**; três novos testes de leitor/componentes
  verificam HEAD exato, filtros, token, zero, falhas, números grandes e links.
- `npm run check`: lint/TypeScript aprovados. `npm run build`: aprovado;
  dashboard e quatro áreas gerados como rotas dinâmicas.
- `node scripts/verify-admin-access.mjs --browser`: HTTP aprovado em produção
  local, com SDK real, Auth/PostgREST isolados e PostgreSQL/PGlite com RLS real.
  Valida vazio, dados publicados/não publicados, rascunhos publicados/arquivados,
  histórico, transferências, falhas parcial/total e atualização sem cache.
- Fixtures isoladas: 33 equipes/2 jogadores/2 alterações/2 rascunhos; após
  alterações no banco, 34 equipes/1 rascunho. Leituras preservam auditoria.
- Quatro rotas respondem para admin ativo e bloqueiam membro/desativado/revogado
  antes de contar. Fluxos de login/logout, SSR/RSC, CSRF e cookies preservados.
- Regressão pública HTTP: home, quatro regiões, 32 equipes e 404 aprovados.
- Evidências em `artifacts/task-11/`, incluindo HTMLs, relatórios e `public/`.
  Serviços e banco temporários encerrados; artefatos anteriores preservados.

### Pendências e limites

- Navegador bloqueado com `spawn EPERM`: sem aprovação visual/responsiva,
  axe, teclado ou execução do fluxo sem JavaScript em navegador nesta etapa.
- Sem credenciais reais: contagens no Supabase remoto, Auth/PostgREST reais e
  cookies HTTPS continuam pendentes. Não houve deploy ou escrita remota.
- Totais são leituras independentes, sem snapshot transacional único.
- **Tarefa 12 não iniciada.** Aguardar novo comando.

## Tarefa 10 — implementação concluída em 05/11/2026

### Entrega

- [x] `/admin/login` com e-mail/senha via Supabase Auth, mensagens em português,
  formulário HTML nativo e estado indisponível sem configuração.
- [x] POSTs de login/logout com checagem de origem, validação, corpo limitado,
  respostas privadas e destinos fixos. Sem senha fixa, signup ou conta automática.
- [x] Sessão em cookie HttpOnly, SameSite Strict, Secure em produção e caminho
  `/admin`. Só access token, sem localStorage/refresh token; cookie limitado à
  expiração e no máximo uma hora. Exige novo login após expirar.
- [x] Proxy, layout e página protegidos. Identidade confirmada com `getUser`,
  autorização ativa consultada via RLS com JWT do usuário. Falhas negam acesso.
- [x] `withAdminMutation` para futuras escritas no servidor, com verificação
  própria e sem depender do layout; nenhum CRUD ou dashboard criado.
- [x] Terceira migration reforça RLS com guardas restritivas; admins consultam
  apenas a própria autorização ativa. Público continua lendo só publicações,
  rascunhos/logs permanecem privados e autopromoção continua proibida.
- [x] Fluxo de concessão/reativação e revogação do primeiro admin documentado
  em `docs/ADMIN_AUTH.md`, por UUID de usuário Auth real e SQL confiável.

A instalação de `@supabase/ssr` falhou com `ENOTCACHED` no ambiente offline.
O fluxo usa Supabase JS já instalado e sessão de access token sem renovação;
nenhuma dependência foi adicionada. Não houve criação de conta real,
aplicação de migration remota, envio de convite ou deploy.

### Arquivos

- `src/features/admin/{auth-model,http-security,server,proxy}.ts`: autenticação,
  autorização, sessão, proteção de POST e fronteira para futuras escritas.
- `src/app/admin/login/page.tsx`, `src/app/admin/auth/{login,logout}/route.ts`,
  `src/app/admin/(protected)/{layout,page}.tsx`: login, logout e área protegida.
- `src/proxy.ts`: adiciona `/admin/:path*`, preservando equipes/jogadores.
- `supabase/migrations/20261105000100_admin_access_hardening.sql`:
  nova migration; as duas anteriores foram preservadas.
- `tests/admin-auth.test.mjs`, `tests/admin-security.test.mjs`,
  `scripts/verify-admin-access.mjs`, comando `test:admin` e ampliação de `test:db`.
- `.env.example`, `README.md`, `docs/ADMIN_AUTH.md`, `docs/SCHEMA_POSTGRESQL.md`,
  `docs/SUPABASE_SEED.md`, plano e progresso. Lockfile sem alteração necessária.

### Testes reais

- `npm test`: **76/76 passaram** (68 anteriores + oito novos). Identidade
  verificada, negação por metadados/cookies forjados, revogação, validação,
  callback de escrita bloqueado, CSRF e RLS em PostgreSQL/PGlite.
- Teste de políticas restritivas adiciona uma política permissiva proposital
  dentro de transação isolada e confirma que ela não libera escrita/leitura
  privada para usuário comum; tudo é revertido ao final.
- `npm run check`: lint sem avisos e TypeScript aprovados.
- `npm run build`: aprovado sem credenciais; rotas administrativas dinâmicas.
- `node scripts/verify-admin-access.mjs --browser`: parte HTTP aprovada com
  Next de produção, SDK real, Auth/PostgREST substituídos por serviços isolados
  e RLS PostgreSQL real. Admin ativo entra; membro, desativado, expirado e
  forjado são bloqueados. Revogação afeta o mesmo token. SSR/RSC, métodos,
  origem, redirecionamentos, indisponibilidade e logout aprovados.
- Cookie recebeu HttpOnly/Secure/SameSite/Path/Max-Age; token e marca privada
  de DATABASE_URL ausentes do HTML e JS servido. Sem cache de respostas admin.
- Regressão HTTP pública: home, quatro regiões, 32 equipes e 404 aprovados.
- Evidências em `artifacts/task-10/`: resultados e HTMLs. Processos e banco
  temporários encerrados pelos verificadores.

O teste HTTP revelou a normalização do hostname interno do Next: a verificação
de origem passou a comparar Origin com Host recebido e protocolo da requisição,
sem confiar em X-Forwarded-Host; redirecionamentos dos handlers são relativos.
O teste RSC acompanha a canonicalização de `_rsc` antes de validar a resposta.

### Pendências e limites

- Sem credenciais Supabase reais: Auth/PostgREST remotos, provisionamento real,
  cookies em HTTPS de produção e configuração de implantação não foram testados.
- Edge headless bloqueado por `spawn EPERM`; nenhuma aprovação visual,
  axe ou navegação real de formulário foi declarada. HTML/POST foram testados.
- Logout remove o cookie e pede revogação local no Auth. Como no Supabase,
  um bearer JWT já emitido pode valer até expirar; `admin_users.is_active=false`
  é o mecanismo para revogar imediatamente o privilégio no banco e no app.
- Sessão sem renovação automática, MFA, recuperação de senha ou CAPTCHA.
  O app não implementa limitador distribuído; políticas do Auth são externas.

Próxima tarefa: **11 — Dashboard administrativo**, somente mediante novo
pedido. A página atual apenas confirma acesso; nenhuma tarefa posterior iniciada.

## Tarefa 09 — implementação concluída em 05/11/2026

### Entrega

- [x] Clientes públicos de servidor/navegador, sem sessão de administrador;
  configuração com URL + chave publishable/anon, rejeição de configuração
  parcial e chaves privilegiadas; `DATABASE_URL` exclusiva do seed.
- [x] Serviço compartilhado tipado para home, regiões e equipes, validado com
  Zod; paginação, filtro de publicação, RLS e mapeamento UUID/slug de região.
- [x] Fallback local somente leitura apenas sem configuração. Erro remoto,
  dados inconsistentes e ausência de temporada têm estados próprios.
- [x] Leitura por requisição, sem cache persistente ou acesso ao banco no build.
- [x] Seed manual transacional 4 regiões / 1 temporada / 32 organizações /
  32 participações; IDs estáveis, resolução de regiões existentes, inserção
  apenas de ausentes, lock consultivo e rollback integral em conflitos.
- [x] Reexecução preserva edições, rascunhos, timestamps, auditoria,
  categorias, outras temporadas e equipes extras. Não cria jogadores/admins.
- [x] Recuperação de 404 de equipe no HTML sem JavaScript, usando consulta
  pública curta no proxy e componente de recuperação na página.

A leitura e os clientes já estavam parcialmente presentes no workspace. Foram
revisados e integrados ao fechamento desta tarefa. Nenhuma migration da Tarefa 08
foi alterada, nenhum login/CRUD foi implementado, nenhum deploy foi feito.

### Arquivos

- Integração revisada: `src/lib/supabase/`,
  `src/features/organizations/public-catalog*.ts`, `catalog-state.tsx`,
  `src/app/page.tsx`, `src/app/[region]/page.tsx`,
  `src/app/team/[slug]/page.tsx`, `src/proxy.ts` e `.env.example`.
- Seed criado: `scripts/seed-vct-2027.mjs`,
  `scripts/lib/seed-vct-2027.mjs`; comando `db:seed` em `package.json`.
- Testes criados: `tests/seed.test.mjs`, `tests/public-catalog.test.mjs` e
  `scripts/verify-catalog-integration.mjs`. Os quatro verificadores anteriores
  aceitam diretório de artefatos por variável, preservando evidências passadas.
- Documentação: `docs/SUPABASE_SEED.md`, `README.md`,
  `docs/DADOS_VCT_2027.md`, `docs/SCHEMA_POSTGRESQL.md`, plano e este progresso.
- Dependências necessárias já estavam instaladas e fixadas: Supabase JS
  2.117.3, Zod 4.6.7, server-only 0.0.1 e postgres 3.4.9. Nenhum pacote novo
  foi instalado nesta execução; lockfile preservado.

### Testes reais

- `npm test`: **68/68 passaram** (57 anteriores + 11 novos). SQL real em
  PostgreSQL 18.6/PGlite 0.5.10; seed repetido mantém snapshots idênticos,
  inclusive auditoria. Testes de rollback, edições, RLS, transporte do SDK,
  configuração inválida, paginação e ausência de fallback em erro aprovados.
- `npm run check`: lint sem avisos e TypeScript aprovados. O `<a>` interno
  apontado na revalidação da Tarefa 08 foi corrigido para `Link`.
- `npm run build`: aprovado sem credenciais; catálogo renderizado por requisição.
- `node scripts/verify-catalog-integration.mjs --http-only`: home, quatro
  regiões, 32 equipes, 404 de equipe com HTML e recuperação de jogador aprovados.
- `node scripts/verify-catalog-integration.mjs --remote --http-only --skip-build`:
  PostgreSQL isolado + seed duas vezes + adaptador HTTP de teste + SDK Supabase +
  páginas de produção. Nome/metadados e contagens refletem alterações; RLS oculta
  participações despublicadas. Vazio, falha do serviço sem fallback, 404 e HTML
  de recuperação passaram. Marca privada de `DATABASE_URL` ausente do HTML/JS.
- Evidências em `artifacts/task-09/integration/`. Servidores do verificador
  encerrados no `finally`; nenhuma gravação em banco remoto.

A verificação HTTP revelou que `notFound()` na página dinâmica de equipe
retornava um shell de erro sem conteúdo HTML, comportamento já observado na
Tarefa 07. O proxy agora define o status e a página retorna o componente de
recuperação diretamente; o teste passou depois da correção.

### Pendências e limites

- Não havia credenciais reais configuradas. Supabase remoto, PostgREST real,
  TLS/driver PostgreSQL pela rede e concorrência entre conexões não foram
  validados. O adaptador HTTP de teste não equivale à infraestrutura Supabase.
- Edge headless foi bloqueado pelo ambiente com `spawn EPERM`; não houve nova
  validação visual, hidratação, axe ou aprovação das quatro suítes de navegador.
- Tentativas de build com configuração pública fictícia encontraram `spawn EPERM`
  após a compilação. O build sem credenciais passou, e a leitura configurada foi
  validada no servidor de produção usando esse build; aquele build configurado
  não é apresentado como aprovado.
- Jogadores, elencos e feed continuam com fontes locais vazias. O proxy consulta
  existência de equipe separadamente do catálogo; as leituras não compartilham
  snapshot transacional. Nenhuma operação de publicação administrativa foi criada.

Próxima tarefa: **10 — Login administrativo e políticas de segurança**,
somente mediante novo pedido. Nenhuma tarefa posterior executada.

## Tarefa 08 — concluída em 04/11/2026

### Revalidação em 05/11/2026

Novo pedido da Tarefa 08: a implementação já estava presente e marcada como
concluída. As duas migrations e a documentação foram confirmadas; não houve
alteração de SQL, interface ou dependências nesta retomada.

- `npm test`: **57/57 passaram**, incluindo os 15 testes de banco que aplicam
  ambas as migrations em PostgreSQL vazio via PGlite e verificam integridade,
  histórico, auditoria, RLS e mais de oito equipes por região.
- `npm run typecheck`: aprovado.
- `npm run check`: falhou no lint por dois diagnósticos da mesma regra
  `@next/next/no-html-link-for-pages` em
  `src/features/organizations/catalog-state.tsx:13` (`<a href="/">`).
  Problema preexistente de interface, fora do escopo da Tarefa 08; não alterado.
- Build e testes de navegador não repetidos nesta revalidação documental.
- Único arquivo editado nesta retomada: `PROGRESSO_VCT.md`.

Sem pendências identificadas nas migrations. A validação em Supabase remoto
continua pendente da integração. A Tarefa 09 não foi executada nesta retomada;
o status acima registra o último fechamento das tarefas, sem certificar a
ausência de trabalho posterior no workspace.

### Checklist e decisões

- [x] Duas migrations SQL transacionais com as 11 tabelas solicitadas:
  `regions`, `seasons`, `organizations`, `team_seasons`, `players`,
  `player_slug_history`, `roster_memberships`, `roster_drafts`,
  `roster_changes`, `admin_users` e `audit_logs`.
- [x] UUIDs, timestamps, FKs restritivas, unicidade, checks e índices de consulta.
  IDs imutáveis; nickname não é chave e pode se repetir.
- [x] Categoria `partner/qualifier/visitor` na participação por temporada,
  separada de `starter/reserve/inactive/coach`. Nenhum limite de oito equipes.
- [x] Início/fim de vínculo com datas finitas, fim inclusivo e não anterior ao
  início. Transferências exigem fechar/inserir, sem reatribuir o vínculo antigo.
- [x] Slugs registrados automaticamente, incluindo o atual, com reserva de
  aliases antigos e proteção contra expor nomes usados somente em rascunhos.
- [x] Rascunhos privados com autor, participação, revisão de origem e payload
  JSON; campos para futura publicação, sem implementar editor ou RPC de publicação.
- [x] Auditoria privada por triggers com antes/depois, usuário, papel SQL e
  transação. Escrita direta negada aos papéis da aplicação; logs não editáveis.
- [x] RLS em todas as tabelas desde a primeira migration. Leitura pública exige
  conteúdo e dependências publicados; rascunhos/admins/auditoria ficam privados.
- [x] Admins ativos podem ler/editar conteúdo. Usuário comum ou admin desativado
  não escreve; ninguém autenticado pode se promover ou gerir admins pelo cliente.
- [x] Documentação de relações, permissões, execução e limites da integração.

Não houve conexão a banco remoto, seed, criação de usuários/credenciais, Auth,
editor administrativo ou alteração das fontes usadas pelas páginas. O futuro
seed deve preservar os UUIDs locais de organizações/temporada e mapear slugs de
região para UUIDs. A Tarefa 09 não foi iniciada.

### Arquivos criados/alterados

- `supabase/migrations/20261104000100_vct_schema.sql`: estrutura e default deny.
- `supabase/migrations/20261104000200_vct_security_history.sql`: triggers,
  histórico, auditoria, grants e RLS inicial.
- `tests/helpers/database.mjs`: PostgreSQL em memória com contrato mínimo de
  Auth/roles exclusivo dos testes e aplicação dos SQLs completos.
- `tests/database.test.mjs`: 15 testes de banco, com fixtures isoladas e rollback.
- `package.json` e `package-lock.json`: PGlite **0.5.10** fixo, somente em
  desenvolvimento; comando `test:db`. `npm test` inclui também os testes de banco.
- `docs/SCHEMA_POSTGRESQL.md`: contratos, diagrama, matriz RLS, execução e fontes.
- `README.md`, `docs/DADOS_VCT_2027.md`, `docs/PERFIS_JOGADORES.md`, este progresso
  e checkbox da Tarefa 08 no plano.
- Nenhum arquivo de interface ou dado do catálogo foi alterado.

### Testes reais

- `npm test`: **57/57 passaram**, incluindo os 42 testes anteriores e 15 de banco.
- Migrations aplicadas em banco vazio com **PostgreSQL 18.6 / PGlite 0.5.10**;
  verificadas 11 tabelas, PKs UUID, RLS habilitada e ausência de seed.
- Integridade: mais de oito participações na mesma região, categorias por
  temporada, FKs/duplicidades, datas, publicação incompleta e eventos de outro jogador.
- Identidade/histórico: renomeação, aliases reservados, retorno ao slug próprio,
  privacidade de slug nunca publicado, vínculos imutáveis e retorno à organização.
- RLS executada sob `anon`, autenticado comum, admin desativado e admin ativo;
  privacidade transitiva de pais, vínculos, feed e rascunhos confirmada.
- Tentativas de escrita, autopromoção, reativação, alteração de autoria/base de
  rascunho, escrita de aliases/logs e exclusão/truncamento foram rejeitadas.
- Auditoria confirmou autor real do statement, snapshots, timestamps controlados,
  operações técnicas sem usuário, imutabilidade e rollback transacional.
- `npm run check`: lint sem avisos e TypeScript aprovados.
- `npm run build`: aprovado, preservando as rotas e páginas existentes.
- Testes visuais/E2E não repetidos: nenhuma interface, rota ou fonte pública mudou.

O teste inicial de FK restritiva esperava apenas SQLSTATE `23503`; o PostgreSQL
usado devolveu `23001` (`restrict_violation`) corretamente. A expectativa passou
a aceitar os dois códigos de integridade aplicáveis; a suíte final passou.

### Pendências e limites

Sem bloqueios na Tarefa 08. PGlite executou o SQL real, mas o bootstrap de Auth
é isolado: Supabase Auth/PostgREST/Storage, conexão remota e concorrência entre
conexões não foram testados. O proprietário do banco permanece uma autoridade
confiável. Regras de conflitos temporais, revisão e publicação atômica devem
ser implementadas no fluxo correspondente; os campos atuais apenas o preparam.
Não há aplicação automática de migrations nem seed de 2027 nesta tarefa.

Próxima recomendação: **Tarefa 09 — Supabase e seed idempotente de 2027**,
somente mediante novo pedido. Trabalho local, sem deploy.

## Tarefa 07 — concluída em 04/11/2026

### Checklist e comportamento

- [x] Rota `/player/[slug]` e componente reutilizável de perfil individual.
- [x] Tipo `Player` com ID estável, slug, nickname, nome/foto opcionais,
  nacionalidade, função e estado de publicação. Campos desconhecidos não são inferidos.
- [x] Foto genérica acessível quando ausente, com fallback de erro de imagem.
- [x] Equipe atual e histórico de carreira com organizações, temporada, status
  de elenco, períodos e links reais para `/team/[slug]` quando existirem vínculos.
- [x] Vínculos por IDs, preservados após renomeação; carreira atravessa temporadas
  e mantém passagens separadas em caso de retorno à organização.
- [x] Somente jogador/vínculos publicados. Vínculos futuros não são mostrados
  como atuais; datas finais são inclusivas. Data da consulta em UTC.
- [x] Estados sem equipe atual publicada e sem histórico, sem afirmar ausência
  de equipe na vida real. Nickname/nome longos quebram linha sem overflow.
- [x] Slug inexistente ou não publicado retorna HTTP 404, `noindex`, mensagem
  em português e recuperação para as regiões, inclusive sem JavaScript.
- [x] Fontes locais de jogadores e vínculos vazias, sem dados inventados no app.

Os cartões de elenco compartilham a identidade de `Player` via `Pick`, mantendo
seu contrato mínimo. A carreira individual e os elencos de organização continuam
com fontes locais vazias; a futura integração deve derivá-los dos mesmos vínculos
persistidos. Não há banco, API, autenticação, edição ou operação de transferência.

### Arquivos criados/alterados

- `src/types/player.ts`: identidade e contrato local de vínculos de carreira.
- `src/features/players/data/local-players.ts`: fontes vazias somente leitura.
- `src/features/players/player-profile-model.ts`: consulta pública por ID,
  seleção temporal, ordenação e formatação de datas.
- `src/features/players/player-profile.tsx` e `player-photo.tsx`: perfil e foto.
- `src/app/player/[slug]/page.tsx` e `not-found.tsx`: rota, metadados e fallback.
- `src/proxy.ts`: status HTTP da rota de jogador, usando a mesma fonte local.
- `src/features/rosters/roster-model.ts`: identidade compartilhada do cartão.
- `tests/player-profile.test.mjs`, `tests/fixtures/player-profile.mjs` e
  `tests/helpers/load-component.mjs`: dez testes novos e renderização isolada.
- `scripts/verify-players.mjs`, três verificadores anteriores e `package.json`:
  cobertura de navegador e evidências em `artifacts/task-07/`.
- `docs/PERFIS_JOGADORES.md`, `docs/DADOS_VCT_2027.md`, `docs/DESIGN_SYSTEM.md`,
  `README.md`, este progresso e checkbox da Tarefa 07 no plano.
- Nenhuma dependência adicionada; seed de organizações e lockfile preservados.

### Testes reais

- `npm test`: **42/42 passaram**. Dez novos casos cobrem zero registros,
  rascunhos, campos ausentes, renomeações, nicknames iguais, datas inclusivas,
  vínculos futuros, outras temporadas, retornos, referências inválidas e o
  componente real com foto, campos e links publicados em fixtures isoladas.
- `npm run check`: lint sem avisos e TypeScript aprovados na versão final.
- `npm run build`: aprovado; `/player/[slug]` dinâmica, demais páginas mantidas.
- `npm run test:e2e`: as quatro verificações passaram no Edge headless
  156.0.4314.58. Regressão de home, regiões e 32 organizações; jogador com 404
  público e recuperação em 320, 390, 768 e 1440 px.
- Componente real renderizado separadamente com CSS de produção: perfil sem
  vínculos/campos opcionais, carreira preenchida e nomes longos. Âncoras, foco,
  links para organizações e ausência de overflow passaram nas quatro larguras.
- Axe: zero violações automatizadas detectadas nos cenários testados.
  Recuperação do 404 sem JavaScript, toque e movimento reduzido passaram.
- Inspeção visual: carreira desktop/320 px, vazio mobile, nome longo e 404 mobile.
  Evidências e relatórios em `artifacts/task-07/{home,regions,teams,players}/`.
- Perfis de teste são SSR isolado, explicitamente identificados nas capturas,
  sem publicação ou rotas de demonstração. Não houve teste de hidratação de perfil,
  falha de foto em navegador ou uso manual de leitor de tela.
- Servidor local de produção da porta 3010 encerrado; nenhum listener restante.

A primeira verificação sem JavaScript revelou que `notFound()` na rota dinâmica
produzia um HTML de erro vazio no Next 16.3.4, apesar de HTTP 404. A solução final
usa um proxy restrito a `/player/:slug` para definir o status e renderiza o
fallback diretamente na página. O HTML passou a conter a mensagem e os links.
Build, lint/tipos e a verificação completa de navegador passaram após a correção.
O proxy não adiciona acesso remoto, autenticação ou persistência. Seu contrato deve
ser revisto junto com a leitura de jogadores na futura integração com o banco.

### Pendências

Sem bloqueios na Tarefa 07. Perfis reais dependem de dados autorizados e publicação.
Trabalho local, sem deploy. Próxima recomendação: **Tarefa 08 — Schema PostgreSQL
e migrations**, somente mediante novo pedido; nenhuma tarefa posterior iniciada.

## Tarefa 06 — concluída em 04/11/2026

### Checklist e comportamento

- [x] Perfis `/team/[slug]` para as 32 organizações, com nome, região,
  categoria, logo/fallback acessível e temporada 2027.
- [x] Seções Titulares, Reservas, Inativos, Técnicos e Histórico, com estados
  vazios de publicação e sem jogadores, técnicos ou eventos inventados.
- [x] Consulta de identidade/participação por ID estável e temporada;
  agrupamento de elenco filtra publicação, organização e temporada no servidor.
- [x] `PlayerCard` reutilizável com nickname, ícone genérico e link por slug
  para `/player/[slug]`. Nenhum cartão aparece com a fonte vazia.
- [x] Navegação por âncoras, foco no destino e retorno à região, inclusive
  sem JavaScript. Layout responsivo e nomes sem truncamento.
- [x] Organização desconhecida recebe HTTP 404, mensagem em português,
  `noindex` e link de recuperação para as regiões.

O contrato local de elenco serve somente à exibição e não substitui o schema
futuro. `localRosterEntries` permanece vazio. O histórico apresenta ausência de
registros publicados; não há persistência, edição, admin ou transferência.
Dados sintéticos usados nos testes são isolados e não entram nas páginas.
A rota individual de jogador pertence à Tarefa 07 e não foi iniciada.

### Arquivos criados/alterados

- `src/app/team/[slug]/page.tsx` e `not-found.tsx`: perfil e recuperação 404.
- `src/features/organizations/team-profile-model.ts` e `team-history.tsx`:
  resolução do perfil e histórico vazio.
- `src/features/rosters/roster-model.ts`, `data/local-roster.ts`,
  `player-card.tsx` e `roster-section.tsx`: contrato, fonte vazia e componentes.
- `tests/team-profile.test.mjs` e `tests/player-card.test.mjs`: oito testes novos.
- `scripts/verify-teams.mjs`: validação de perfis no navegador e por HTTP.
- `scripts/verify-design-system.mjs`, `scripts/verify-regions.mjs` e
  `package.json`: regressão das três áreas e evidências em `artifacts/task-06/`.
- `README.md`, `docs/DADOS_VCT_2027.md`, `docs/DESIGN_SYSTEM.md`, este progresso
  e checkbox da Tarefa 06 no plano.
- Nenhuma dependência adicionada; catálogo e `package-lock.json` preservados.

### Testes reais

- `npm test`: **32/32 passaram**. Os oito testes novos verificam as 32
  identidades, temporadas, participação ausente, slug desconhecido, configuração
  inválida, agrupamento/ordenação sem mutação, exclusão de rascunhos e registros
  de outras equipes/temporadas, além do link e escape de texto do cartão real.
- `npm run check`: lint sem avisos e TypeScript aprovados.
- `npm run build`: aprovado; os 32 perfis foram pré-renderizados.
- `npm run test:e2e`: as três verificações passaram no Edge headless
  156.0.4314.58. Regressão da home e das quatro regiões; perfis representativos
  das quatro regiões em 320, 390, 768 e 1440 px, sem overflow ou erros de console.
- Todos os 32 perfis responderam HTTP 200, contendo as cinco seções vazias e
  nenhum link de jogador fictício. Organização inexistente retornou HTTP 404.
- Metadados, teclado/foco, âncoras, retorno à região, toque, movimento reduzido
  e navegação sem JavaScript passaram.
- Axe: zero violações automatizadas detectadas nas páginas/estados testados,
  incluindo o novo 404. Não houve teste manual de leitor de tela.
- Capturas de perfil desktop, perfil mobile e 404 mobile inspecionadas.
  Evidências em `artifacts/task-06/{home,regions,teams}/`, com `results.json`.
- Servidor de produção usado na porta 3010 encerrado; nenhum listener restante.

### Pendências

Sem bloqueios na Tarefa 06. Logos oficiais e dados de elenco dependem de fontes
autorizadas e publicação futura. Trabalho local, sem deploy. Próxima recomendação:
**Tarefa 07 — Página pública individual de jogador**, somente mediante novo pedido.

## Tarefa 05 — concluída em 04/11/2026

### Checklist e comportamento

- [x] `/americas`, `/emea`, `/china` e `/pacific` listam as oito parceiras
  corretas de 2027, consultadas pelo vínculo de região/temporada.
- [x] Cards com nome, placeholder acessível, identificação Parceira e link
  para `/team/[slug]`. Siglas e logos só aparecem se fornecidos no catálogo.
- [x] Busca por nome, sigla opcional ou slug, insensível a caixa e acentos;
  vários termos e espaços externos são tratados. Botões para limpar o filtro.
- [x] Ordenação A–Z/Z–A em PT-BR, sem alterar os dados de entrada.
- [x] Estados distintos para busca sem resultados e região sem participações.
- [x] Categorias Qualificatória e Visitante suportadas; sem limite de oito
  participantes. O seed permanece com suas 32 parceiras reais.
- [x] Navegação entre regiões com indicação da página atual; busca/ordenação
  retornam ao padrão ao mudar de região.
- [x] Responsividade, controles com labels, foco visível, contador anunciado
  por `role="status"` e links utilizáveis sem JavaScript.

O servidor resolve apenas os registros da região/temporada para o componente
interativo. A lista completa em A–Z já é entregue no HTML. Sem JavaScript,
busca/ordenação ficam ocultas e a navegação permanece disponível. Os filtros
são locais ao componente, não são gravados nem persistidos na URL.

Para a navegação solicitada funcionar, foram adicionados destinos mínimos para
as 32 organizações em `/team/[slug]`: nome, mensagem de perfil em preparação e
retorno à região de 2027. Não foram criadas seções de elenco, dados de jogadores,
histórico ou autenticação. O perfil completo pertence à Tarefa 06, ainda pendente.
Organização ou região desconhecida recebe 404 via `notFound()`.

### Arquivos criados/alterados

- `src/app/[region]/page.tsx`: páginas regionais com navegação e listagem.
- `src/features/organizations/directory-model.ts`: consulta, busca, ordenação
  e nomes de categorias, sem dependência de dados remotos.
- `src/features/organizations/organization-card.tsx` e
  `organization-directory.tsx`: cards, filtros, contador e estados vazios.
- `src/app/team/[slug]/page.tsx`: destinos simples para os links de organizações.
- `tests/organization-directory.test.mjs`: oito testes novos.
- `scripts/verify-regions.mjs`: verificação de navegador das quatro regiões.
- `scripts/verify-design-system.mjs`: evidências da regressão da home agora em
  `artifacts/task-05/home/`, preservando as capturas anteriores.
- `package.json`: `test:e2e` executa verificações de home e regiões.
- `README.md`, `docs/DADOS_VCT_2027.md`, `docs/DESIGN_SYSTEM.md`, este progresso
  e checkbox da Tarefa 05 no plano.
- Evidências: `artifacts/task-05/home/` e `artifacts/task-05/regions/`, incluindo
  capturas desktop/mobile, busca vazia e os respectivos `results.json`.
- Nenhuma dependência adicionada; `package-lock.json` e seed preservados.

### Testes reais

- `npm test`: **24/24 passaram**. Os oito testes novos cobrem as quatro listas,
  busca por acentos/caixa/sigla/slug, ordenação sem mutação, outras categorias,
  mais de oito equipes, temporadas, duplicidades, vazios e referências inválidas.
- `npm run check`: lint sem avisos e TypeScript aprovados.
- `npm run build`: aprovado; home, quatro regiões, ícone e os 32 destinos de
  organizações pré-renderizados, sem credenciais ou conexões externas.
- `npm run test:e2e`: aprovado com Edge headless 156.0.4314.58. Regressão da
  home e quatro regiões em 320, 390, 768 e 1440 px. Verificou nomes/ordem,
  categorias, placeholders, busca, limpeza/foco, troca de região, navegação
  de ida e volta, teclado, alvos de toque, ausência de overflow e console limpo.
- Axe: zero violações automatizadas detectadas na home e nas listagens regionais,
  incluindo estados sem resultados, nos tamanhos testados.
- Navegação de toque com movimento reduzido e navegação sem JavaScript passaram.
- Todos os 32 destinos `/team/[slug]` responderam HTTP 200; região e organização
  inexistentes responderam 404.
- Capturas Americas desktop/320 px, Pacific mobile e estado vazio mobile
  inspecionadas visualmente. Sem teste manual de leitor de tela.
- Servidor de produção usado para os testes na porta 3010 encerrado ao concluir.

### Pendências

Sem bloqueios nesta tarefa. Perfis de organizações ainda exibem preparação,
conforme o escopo delimitado; seções de elenco e histórico ficam para a Tarefa 06.
Siglas e logos opcionais dependem de dados/arquivos autorizados. O trabalho
permanece local, sem publicação. Próxima recomendação: **Tarefa 06**, somente
mediante novo pedido.

## Tarefa 04 — concluída em 03/11/2026

### Checklist e comportamento

- [x] Hero VCT Roster Tracker com temporada, CTA para regiões e totais
  derivados do catálogo. Elemento vetorial decorativo local, sem logos oficiais.
- [x] Navegação responsiva para Regiões, Mudanças e Sobre o projeto.
- [x] Quatro Magic Cards clicáveis: Americas, EMEA, China e Pacific.
- [x] Texto atual de oito equipes parceiras por card calculado pela temporada
  e categoria `partner`, sem números fixos na interface.
- [x] Seção Mudanças recentes com estado vazio real, sem histórico inventado.
- [x] Links `/americas`, `/emea`, `/china` e `/pacific` funcionando, com retorno
  à seção de regiões; slug desconhecido retorna 404.
- [x] Revisão visual desktop/mobile e testes de navegação e acessibilidade.

Para satisfazer o aceite de links funcionando sem antecipar as telas detalhadas,
`src/app/[region]/page.tsx` gera apenas quatro destinos simples com nome,
temporada, mensagem de preparação e link de retorno. Não há listagem, busca,
perfil de organização ou painel administrativo. A Tarefa 05 permanece pendente.

As contagens usam `getRegionSummaries`: organizações distintas, somente parceiras
da temporada solicitada; qualifiers, visitors e outras temporadas não entram.
O modelo não limita o resultado a oito. A fonte de mudanças de elenco ainda
não existe, portanto o bloco recente apresenta apenas o estado vazio até as
tarefas de publicação. Nenhuma fonte remota ou persistência foi adicionada.

### Arquivos criados/alterados

- `src/app/page.tsx`: home pública.
- `src/components/layout/site-header.tsx`: navegação responsiva e ano do catálogo.
- `src/features/home/region-card.tsx` e `recent-changes.tsx`: seções da home.
- `src/features/organizations/region-summaries.ts`: contagens derivadas.
- `src/app/[region]/page.tsx`: quatro destinos mínimos pré-renderizados.
- `tests/region-summaries.test.mjs`: quatro testes das contagens.
- `scripts/verify-design-system.mjs`: ampliado para navegação e estados da home,
  preservando verificações de teclado, movimento e responsividade.
- `README.md`, `docs/DADOS_VCT_2027.md`, `docs/DESIGN_SYSTEM.md`, este progresso
  e checkbox da Tarefa 04 no plano.
- `artifacts/task-04/`: capturas da home em 320, 390, 768 e 1440 px,
  capturas do destino Americas em 390/1440 px e relatório `results.json`.
- Nenhuma dependência adicionada e nenhum dado do seed alterado.

### Testes reais

- `npm test`: **16/16 passaram**, incluindo os 12 testes anteriores e quatro
  novos cenários: contagens do seed, outras categorias/temporadas, zero e mais
  de oito parceiras; organizações duplicadas não inflam o total.
- `npm run check`: lint sem avisos e TypeScript aprovados.
- `npm run build`: aprovado, com home, quatro regiões e ícone pré-renderizados.
- `npm run test:e2e`: aprovado no Edge headless em 320, 390, 768 e 1440 px.
  Validou contagens contra o catálogo, estado vazio, navegação nas quatro regiões,
  retorno à home, HTTP 200 dos destinos, 404 desconhecido, teclado/foco,
  âncoras, toque, movimento reduzido e navegação sem JavaScript.
- Axe na home: zero violações detectadas nos critérios automatizados selecionados
  nas quatro larguras; sem overflow horizontal ou erros de navegador.
- Capturas de desktop, mobile e destino regional inspecionadas visualmente.
  Não houve teste manual com leitor de tela nem aprovação visual do usuário.

A primeira execução E2E exigia `focus-visible` depois de foco programático
em modo mouse e falhou. O teste foi corrigido para usar Tab/Shift+Tab reais;
a execução completa posterior passou, sem mudança no comportamento da aplicação.

A opção `dynamicParams = false` provocou um log interno `NoFallbackError` do
Next ao testar a região inexistente, apesar do HTTP 404 correto. A opção foi
removida; a validação explícita contra o catálogo e `notFound()` tratam slugs
desconhecidos. Build e E2E foram repetidos com sucesso, mantendo as quatro
regiões pré-renderizadas e o 404, sem o log interno na execução final.
O servidor de teste da porta 3010 foi encerrado após a verificação.

### Pendências

Sem bloqueios na Tarefa 04. Listagem, busca e ordenação regionais pertencem à
Tarefa 05, não iniciada. Os destinos regionais ainda são páginas de preparação.
O trabalho permanece local, sem publicação. Próximo passo autorizado: aguardar
novo pedido do usuário.

## Tarefa 03 — concluída em 03/11/2026

### Checklist e decisões

- [x] Tipos `Region`, `Season`, `Organization` e `PartnerStatus`, com
  `RegionId`, `TeamSeason` e `VctCatalog` para as relações.
- [x] Catálogo local com quatro regiões, temporada padrão 2027 e as 32
  organizações do plano, exatamente oito por região e todas `partner`.
- [x] Nome, slug e ID estável de organização; região/categoria no vínculo com
  a temporada, cujo registro contém o ano. Sigla e logo opcionais e omitidos.
- [x] UUIDs locais atribuídos uma vez e fixos no arquivo, independentes de slugs.
- [x] Modelo aceita `qualifier` e `visitor`, sem participantes adicionais
  inventados. A regra de oito por região se aplica somente ao seed inicial.
- [x] Verificações de unicidade, integridade, quantidade e lista exata do plano.
- [x] Listagem local por terminal e documentação das fontes e contratos.

Conferência manual de fontes publicadas em 22/10/2026: o anúncio da Riot
confirma 32 parceiras, oito em cada região; a tabela do Esports Charts coincide
com os nomes enumerados no plano. URLs e datas registradas em `vct2027Sources`
e em `docs/DADOS_VCT_2027.md`. Mantida a capitalização `FULL SENSE` do plano;
`Rex Regum Qeon (RRQ)` foi armazenado como `Rex Regum Qeon`, sem sigla separada.
Nenhuma abreviação foi inferida automaticamente.

O catálogo tem contratos `readonly` e nenhuma operação de escrita. Não contém
jogadores, elencos, transferências, estatísticas, logos ou rascunhos. Não há
conexão com banco ou fontes externas durante a execução. A página provisória
não foi alterada, e a Tarefa 04 não foi iniciada.

### Arquivos criados/alterados

- `src/types/vct.ts`: contratos compartilhados.
- `src/features/organizations/data/vct-2027.ts`: snapshot estático e fontes.
- `src/features/organizations/validate-catalog.ts`: validador de integridade
  para dados locais tipados, sem limite global de equipes.
- `tests/vct-2027.test.mjs`: 12 testes, incluindo cenários inválidos e cópias
  isoladas com categorias adicionais, mais de oito participações e outra temporada.
- `scripts/list-vct-2027.mjs`: listagem somente leitura por região.
- `package.json`: scripts `test`/`data:list` e declaração ESM `type: module`
  para executar os módulos TypeScript no Node 24 sem aviso de reinterpretação.
- `README.md`, `docs/DADOS_VCT_2027.md`, este progresso e checkbox no plano.
- Nenhuma dependência adicionada; `package-lock.json` preservado.

### Testes reais

- `npm test`: **12/12 passaram**, sem falhas ou avisos na execução final.
  As listas por região são comparadas diretamente com o plano, não com uma
  segunda cópia do próprio fixture.
- `npm run data:list`: passou; listou oito organizações em cada região,
  total 32, ano 2027 e categoria `partner`, sem gravação de dados.
- `npm run check`: lint sem avisos e checagem TypeScript aprovados.
- `npm run build`: aprovado, com as rotas existentes `/`, `/_not-found` e
  `/icon.svg` pré-renderizadas; nenhuma rota nova de produto.
- Testes de navegador não repetidos: não houve alteração visual ou de navegação.

### Pendências

Sem bloqueios nesta tarefa. Siglas e logos dependem de conferência/arquivos
autorizados quando forem necessários. A referência incompleta de formato no
plano não foi utilizada. Integração com páginas e banco permanece para as tarefas
correspondentes. Git ainda não foi inicializado.

Próxima recomendação: **Tarefa 04 — Página inicial pública**, mediante novo pedido.

## Tarefa 02 — concluída em 03/11/2026

### Checklist

- [x] Tokens de tema com as quatro cores solicitadas: `#0B0D12`, `#151923`,
  `#1B202B` e `#FF4655`, com cores semânticas para texto, borda e foco.
- [x] shadcn/ui integrado manualmente: Button e Card, utilitário `cn` e
  configuração `components.json`; fontes e licenças documentadas.
- [x] Apenas Magic Card integrado do Magic UI, adaptado ao tema fixo e ao modo
  gradiente discreto, usando Motion. Sem animações contínuas ou `next-themes`.
- [x] Header, footer, container e página provisória usando a base compartilhada.
- [x] Placeholder genérico de liga/equipe com nome acessível, substituição por
  `src` e fallback em erro de imagem. Ícones Lucide; nenhum logo oficial inventado.
- [x] Foco visível, link de salto, controles com altura mínima de 44 px,
  semântica de landmarks e suporte a `prefers-reduced-motion`/toque.
- [x] Revisão visual das capturas desktop e mobile: hierarquia legível,
  espaçamentos consistentes e ausência de cortes/rolagem horizontal.

A página inicial permanece provisória. Os únicos links são para a raiz e
âncoras existentes. Não foram adicionados dados de equipes, regiões, telas
funcionais, admin, banco ou autenticação. Tarefa 03 não iniciada.

### Arquivos criados/alterados

- `src/app/globals.css`, `layout.tsx`, `page.tsx` e novo `icon.svg`.
- `src/components/layout/{container,site-header,site-footer}.tsx`.
- `src/components/ui/{button,card}.tsx` e `src/components/magicui/magic-card.tsx`.
- `src/components/logo-placeholder.tsx`, `src/lib/utils.ts`, `components.json`.
- `package.json` e `package-lock.json`: Radix Slot, CVA, clsx, tailwind-merge,
  Lucide e Motion; Playwright e axe-core somente para desenvolvimento.
- `scripts/verify-design-system.mjs`: verificação de navegador reproduzível
  por `npm run test:e2e` contra servidor local de produção.
- `README.md`, `docs/DESIGN_SYSTEM.md`, `THIRD_PARTY_NOTICES.md`, este progresso
  e checkbox da Tarefa 02 no plano.
- Evidências em `artifacts/task-02/{320,390,768,1440}.png` e `results.json`.

### Testes reais

- `npm run check`: lint sem avisos e TypeScript aprovados.
- `npm run build`: aprovado; rotas `/`, `/_not-found` e `/icon.svg` estáticas.
- `npm ls --depth=0`: aprovado, sem dependências ausentes ou inválidas.
- `npm run start -- --hostname 127.0.0.1 --port 3010`: produção iniciada.
- Servidor de teste da porta 3010 encerrado após a validação; encerramento
  confirmado por nova tentativa de conexão. Servidores de sessões anteriores
  não foram encerrados nesta tarefa.
- `npm run test:e2e`: aprovado com Microsoft Edge headless 156.0.4314.58
  em 320, 390, 768 e 1440 px. Verificou HTTP 200, idioma, main/h1 únicos,
  ausência de overflow horizontal, salto por teclado, âncoras funcionais,
  áreas de toque, movimento reduzido, toque e renderização sem JavaScript.
- Axe: zero violações nos critérios automatizados WCAG A/AA selecionados e
  boas práticas, nas quatro larguras. Console e erros de página: zero.
- Capturas de 320, 390 e 1440 px inspecionadas visualmente pelo agente.
  Não houve validação manual com leitor de tela nem aprovação visual do usuário.

### Ocorrências e pendências

O npm estava configurado offline e sem os arquivos dos novos pacotes no cache.
Os arquivos oficiais foram obtidos do registro npm com verificação de integridade;
a instalação final usou o cache local, mantendo versões fixas e lockfile.
Não houve alteração de configuração global. O aviso de script pendente de
`unrs-resolver` não impediu lint, build ou testes; nenhum script extra foi autorizado.

Tentativas de execução com variáveis/comandos combinados tiveram `spawn EPERM`;
os comandos finais isolados passaram. A primeira inspeção em navegador detectou
favicon ausente (404); `src/app/icon.svg` corrigiu o problema e o teste completo
posterior passou. Essas falhas não foram tratadas como validações aprovadas.

Sem bloqueios para esta tarefa. A integração é local, sem publicação. Git ainda
não foi inicializado. Próxima recomendação: Tarefa 03, somente mediante novo pedido.

## Tarefa 01 — concluída em 03/11/2026

A estrutura de aplicação já estava presente ao retomar o workspace, embora o
progresso ainda registrasse apenas a Tarefa 00. Os arquivos existentes foram
inspecionados e preservados; não foi necessário reescrever a aplicação.

### Checklist e estrutura validada

- [x] Next.js App Router, TypeScript estrito e Tailwind via PostCSS.
- [x] `src/app`, `src/components`, `src/features`, `src/lib` e `src/types`.
- [x] Página provisória em PT-BR, layout raiz e metadados básicos.
- [x] `.env.example` sem segredos; execução sem configuração Supabase.
- [x] README com comandos de instalação, desenvolvimento e produção.
- [x] Scripts `dev`, `build`, `start`, `lint`, `typecheck` e `check`.
- [x] Desenvolvimento e build funcionando, com verificações HTTP reais.

Ambiente verificado: Node.js 24.19.0 e npm 11.17.0. Dependências instaladas:
Next.js/eslint-config-next 16.3.4, React/React DOM 19.2.8, Tailwind e plugin
PostCSS 4.3.3, PostCSS 8.5.30, TypeScript 5.9.3 e ESLint 9.39.5.
Versões diretas fixas e `package-lock.json` presentes. Nenhuma dependência foi
adicionada ou atualizada nesta retomada.

### Testes executados

- `npm ls --depth=0`: passou, sem dependências ausentes ou inválidas.
- `npm run check`: lint sem avisos e typecheck aprovados, incluindo geração dos
  tipos de rotas pelo Next.js.
- `npm run build`: passou; `/` e `/_not-found` pré-renderizadas.
- `npm run dev`: iniciou em `http://localhost:3000`.
- `npm run start -- --hostname 127.0.0.1 --port 3006`: iniciou o build de produção.
- Verificação HTTP com `fetch` e `node:assert/strict`, nos dois servidores:
  página inicial 200, idioma `pt-BR`, título e temporada 2027 corretos;
  folha CSS 200 com utilitários Tailwind `.flex` e `.text-3xl` compilados;
  caminho inexistente retornou 404. Todas as asserções passaram.
- Uma tentativa inicial de `dev` com hostname e porta 3005 falhou com
  `spawn EPERM`. A execução padrão posterior e os testes HTTP passaram.
  Nenhuma alteração no código foi necessária.
- Ao finalizar, o envio de Ctrl+C via `write_stdin` foi rejeitado pela política
  de aprovação do ambiente; a consulta de processos via CIM também teve acesso
  negado. Os servidores ainda respondiam com HTTP 200 nas portas 3000 e 3006
  na última verificação. Não foi possível confirmar seu encerramento.
- Não foi criada suíte de testes nem realizada revisão visual completa:
  esta tarefa contém apenas a estrutura e a página provisória.

### Arquivos e pendências

Arquivos da estrutura revisados: `package.json`, `package-lock.json`,
`tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`,
`.gitignore`, `.env.example`, `README.md`, `src/app/{layout.tsx,page.tsx,globals.css}`
e os `.gitkeep` das quatro pastas reservadas.

Nesta retomada, `PROGRESSO_VCT.md` foi atualizado e a Tarefa 01 foi marcada no
plano. O Next.js gerou `AGENTS.md`, `CLAUDE.md`, `next-env.d.ts` e artefatos em
`.next/`; o TypeScript gerou seu cache incremental. Os artefatos de compilação
já estão cobertos pelo `.gitignore`.

Não há bloqueios para a Tarefa 01. Git ainda não foi inicializado. Banco,
autenticação, dados de equipes e telas completas continuam para as respectivas
tarefas. Próxima recomendação: Tarefa 02, somente mediante novo pedido.

## Registro histórico — Tarefa 00 (02/11/2026)

As observações abaixo retratam a auditoria anterior à estrutura validada na
Tarefa 01; as ausências de aplicação e dependências não descrevem o estado atual.

### Diagnóstico do workspace

O projeto está na etapa de planejamento. Antes desta tarefa, havia apenas
`PLANO_VCT_ROSTER_TRACKER_2027.txt` e os 18 arquivos em
`TAREFAS_INDIVIDUAIS_VCT_2027/`. `PROGRESSO_VCT.md` não existia.

Não há aplicação existente, `package.json`, lockfile, `tsconfig.json`, `src/`,
`app/`, `node_modules/`, `.env.example` ou diretório `supabase/`.
Portanto, não há dependências declaradas, configuração TypeScript, migrations,
scripts de execução ou testes de aplicação para auditar.

Não existe `.git` no workspace; `git status --short` retornou
“not a git repository”. Nenhum repositório foi inicializado.
O ambiente disponibiliza Node.js **v24.19.0** e npm **11.17.0**.

## Arquitetura prevista — ainda não implementada

| Área | Responsabilidade prevista |
| --- | --- |
| `src/app/` | Next.js App Router: rotas públicas, layouts e área administrativa protegida. |
| `src/components/` | Componentes compartilhados, shadcn/ui, componentes selecionados do Magic UI e estados vazios. |
| `src/features/` | Domínios de organizações, temporadas, jogadores, rosters e transferências. |
| `src/lib/` | Camada compartilhada de dados, validação e clientes Supabase separados entre servidor e navegador. |
| `src/types/` | Tipos de domínio e contratos de dados, com TypeScript estrito. |
| `supabase/` | Migrations, políticas de acesso e seed idempotente, nas tarefas de banco. |

Fluxo previsto: rotas públicas consultam uma camada de dados tipada que expõe
somente conteúdo publicado. Antes da integração remota, dados locais servem
apenas para leitura. Escritas administrativas exigem autenticação, autorização
no servidor, validação e políticas RLS no PostgreSQL.

Organizações e jogadores terão identidade estável. A participação de uma equipe
será associada à temporada, região e categoria (`partner`, `qualifier`, `visitor`).
Os vínculos de elenco terão início, fim e função/status próprios. Rascunhos serão
privados; publicação e transferências deverão ser transacionais, com auditoria
e preservação dos vínculos anteriores. Slugs não serão usados como identidade
persistente de jogadores.

## Dependências previstas

- Base: Next.js, React, React DOM, TypeScript, tipos correspondentes, Tailwind CSS e ESLint.
- Interface: shadcn/ui, Magic UI, Lucide e Motion, adicionados conforme os componentes necessários.
- Dados: Supabase PostgreSQL/Auth/Storage, clientes `@supabase/supabase-js` e `@supabase/ssr`.
- Validação: Zod; infraestrutura de testes a definir conforme cada funcionalidade.
- Hospedagem prevista no plano: Vercel.

Nenhum pacote foi instalado. npm é a escolha inicial proposta, pois está
disponível e não há gerenciador ou lockfile preexistente. Versões e compatibilidade
com o Node instalado devem ser conferidas na inicialização e registradas no
lockfile; esta auditoria não seleciona versões de bibliotecas.

## Decisões e restrições

- Interface preferencialmente PT-BR; atualizações exclusivamente manuais.
- Temporada inicial 2027 e seed previsto de 32 parceiras, oito por região,
  conforme o plano fornecido. Esse número é uma regra de validação do seed,
  não um limite de cadastro ou de participação em competições.
- Permitir equipes adicionais de qualificatória e visitantes; manter histórico.
- Não inventar jogadores, elencos, transferências, estatísticas ou logos oficiais.
- Usar estados vazios e placeholders quando não houver dados ou assets autorizados.
- Sem configuração Supabase, manter somente leitura; nunca simular gravações.
- Não expor credenciais privilegiadas no navegador. Rascunhos e logs ficam privados.
- Cada tarefa depende de um novo pedido; nenhuma tela ou código foi desenvolvido nesta etapa.

## Riscos e pendências

- A aplicação ainda precisa ser inicializada na Tarefa 01; não há build executável.
- Compatibilidade e versões das dependências ainda precisam ser verificadas na instalação.
- Não há configuração Supabase local; conexão, autenticação, Storage e políticas
  dependerão das tarefas correspondentes e de configuração externa real.
- A lista de equipes foi tratada como requisito do plano, não como informação
  independentemente verificada. Conferir as fontes antes do seed na Tarefa 03.
  O plano contém uma URL de formato incompleta (`https://valorantesports.com/en-US/news/vct-`),
  cuja referência correta precisa ser localizada quando essa conferência ocorrer.
- Git ainda não foi inicializado; não há histórico de versionamento neste workspace.
- Nenhum bloqueio impede a conclusão documental da Tarefa 00.

## Validação e arquivos

- Inspeção real com `rg --files --hidden`, `Get-ChildItem -Force` e `Test-Path`:
  confirmou o inventário e a ausência dos arquivos de aplicação citados acima.
- `node --version`: v24.19.0; `npm --version`: 11.17.0.
- `git status --short`: falhou por ausência de repositório; resultado registrado,
  não tratado como teste aprovado.
- Verificação documental em PowerShell: progresso presente, somente Tarefa 00
  marcada no plano, outras 17 tarefas pendentes e nenhum `package.json` criado.
- Build, lint, typecheck e testes de aplicação não executados: não existem
  aplicação, configuração ou scripts para executá-los.

Arquivos desta tarefa:

- `PROGRESSO_VCT.md`: criado com diagnóstico, arquitetura, decisões e pendências.
- `PLANO_VCT_ROSTER_TRACKER_2027.txt`: apenas checkbox da Tarefa 00 marcado.

Tarefa 00 concluída. A Tarefa 01 permanece pendente e não foi executada.
