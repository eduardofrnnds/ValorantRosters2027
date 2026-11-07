# VCT Roster Tracker — 1.0.0

Aplicação de acompanhamento **manual** de equipes, jogadores e elencos do VCT.
Next.js App Router, React, TypeScript, Tailwind, shadcn/ui, Magic UI e Supabase.
O catálogo inicial contém quatro regiões e 32 organizações parceiras de 2027.
Oito equipes por região é uma regra desse seed, não um limite de cadastro.
Qualificatórias, visitantes e outras temporadas são aceitas.

O projeto tem leitura pública, cadastro administrativo, rascunhos, publicação
atômica e transferências com histórico. A versão pública inclui um snapshot dos
elencos atuais do VLR.gg, consultado em 07/11/2026: 186 jogadores e técnicos,
157 fotos disponíveis e os 32 logos. Ao abrir uma região, os elencos já aparecem
nos cartões. A fonte não fornece datas de contrato; nenhum histórico foi inferido.
Consulte [a origem dos elencos](docs/ELENCOS_VLR.md). Não há coleta automática em produção.

**Estado da entrega:** implementação e revisão local da versão 1.0 concluídas;
o [código está público no GitHub](https://github.com/eduardofrnnds/ValorantRosters2027).
O [site está publicado na Vercel](https://valorant-rosters-2027.vercel.app),
em modo somente leitura. Há uma atualização de segurança pendente no Next.js e
a configuração Supabase ainda não foi feita; veja o [estado da publicação](docs/PUBLICACAO.md).
Consulte o
[relatório final](docs/REVISAO_FINAL_V1.md), o [progresso](PROGRESSO_VCT.md) e o
[guia de deploy Vercel](docs/DEPLOY_VERCEL.md) antes de liberar produção.

## Executar

Use Node.js **24.x** e npm. As versões diretas estão fixadas no lockfile.

```powershell
npm ci
npm run dev
```

Abra `http://localhost:3000`; outra porta pode ser escolhida com
`npm run dev -- --port 3001`.

Sem variáveis Supabase, o site usa o catálogo local somente leitura e o admin
fica indisponível. Para persistência, copie `.env.example` para `.env.local`,
configure URL/chave pública do mesmo projeto e aplique **as oito migrations em
ordem** antes de usar o aplicativo. Configuração parcial ou falha de serviço
mostra indisponibilidade, sem substituir dados remotos pelo snapshot local.

`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` devem existir
antes do build de implantação. Nunca use chave `service_role` ou `sb_secret_*`
nessas variáveis. `DATABASE_URL` pertence somente ao seed manual e não precisa
ser configurada na Vercel. Upload de logos/fotos é opcional e depende dos buckets
e políticas descritos nos guias administrativos.

## Fluxos

| Área | Comportamento |
| --- | --- |
| `/`, `/americas`, `/emea`, `/china`, `/pacific` | Catálogo publicado, contagens, busca e ordenação; home com mudanças recentes. |
| `/team/[slug]` | Elenco da temporada padrão 2027, agrupado por status; histórico publicado da organização. |
| `/player/[slug]` | Perfil, vínculos atuais, carreira e linha do tempo; URLs antigas públicas redirecionam ao slug atual. |
| `/transfers` | Eventos publicados com filtros de região/equipe/data/tipo e paginação. |
| `/admin/login` | E-mail/senha Supabase Auth e allowlist de administrador ativo; sem conta ou senha padrão. |
| `/admin/organizations`, `/admin/players` | Criação/edição manual, visibilidade e identidade estável. |
| `/admin/rosters` | Rascunhos privados, prévia, revisão e confirmação de publicação. |
| `/admin/transfers` | Revisão/confirmação da transferência, atualizando origem e destino no mesmo commit. |

Salvar um rascunho não modifica o elenco público. Publicar ou transferir exige
confirmação e revalida permissões, versões, datas e conflitos dentro da transação.
Repetir a mesma confirmação não duplica registros. O jogador mantém o UUID;
passagens anteriores, função por vínculo, autoria, fonte e auditoria são preservadas.

Datas de fim são inclusivas. Um novo estado começa na vigência escolhida e o
anterior termina na véspera. Movimentos futuros aparecem identificados no histórico;
os elencos atuais seguem o dia UTC. Transferências exigem a mesma temporada e
resolução dos rascunhos abertos nas duas equipes.

O editor de rascunhos exige JavaScript. Revisão/publicação, transferência e os
demais formulários possuem POST HTML nativo. Busca/ordenação regional são locais
à página; sem JavaScript, a lista completa continua disponível.

## Banco e operação

As migrations não provisionam contas, não fazem seed e não são executadas no
build. Depois de aplicá-las no projeto correto, configure a conexão PostgreSQL
privada no ambiente local e rode:

```powershell
npm run db:seed
```

O seed é idempotente: insere ausentes sem sobrescrever edições, republicar
rascunhos, apagar equipes extras ou criar jogadores. Uma reexecução confirma
esse comportamento. Sem `DATABASE_URL`, termina com erro sem escrever.
Use os guias de [schema](docs/SCHEMA_POSTGRESQL.md),
[seed](docs/SUPABASE_SEED.md) e [primeiro administrador](docs/ADMIN_AUTH.md).

O admin usa JWT do próprio usuário e RLS. A leitura pública usa cliente anônimo
separado. O schema `private` não deve ser exposto pela Data API. Logout remove o
cookie; revogação imediata de autorização ocorre ao desativar a allowlist. A sessão
expira em até uma hora, sem renovação automática.

## Verificar

```powershell
npm run check
npm test
npm run build
npm run test:integration
npm run test:release
npm run test:e2e
npm run test:admin -- --browser
```

- `check`: ESLint e geração de tipos de rota seguida de TypeScript.
- `test`: domínio, componentes, migrations, RLS, seed, CRUD, rascunhos,
  publicação, transferência, replay e rollback em PGlite. Inclui `test:db`.
- `test:integration`: catálogo local, catálogo via adaptador isolado e fluxos
  administrativos HTTP. Inicia/encerra os servidores necessários nas portas 3019/3020.
- `test:release`: auditoria HTTP de metadados, 404, estados vazios, assets,
  proteção admin e contraste matemático dos tokens, na porta 3021.
- `test:e2e`: inicia produção local na porta 3019 e executa os roteiros públicos
  em Playwright. Não precisa manter outro servidor aberto.
- `test:admin -- --browser`: HTTP administrativo e tentativa dos roteiros visuais,
  inclusive edição de rascunho, publicação e transferência em quatro larguras.

Os últimos quatro comandos exigem build prévio. Os adaptadores usam SDK e
PostgreSQL/RLS reais em memória, mas **não são um Supabase remoto**. Mesmo o
argumento `--remote` do verificador de catálogo se refere a um adaptador local.
Nenhum desses testes usa contas, tokens ou dados reais de produção.

No Windows, Playwright usa Edge por padrão; `PLAYWRIGHT_CHANNEL` escolhe outro
canal instalado. Em outros sistemas, instale o navegador com
`npx playwright install chromium`. Há roteiros para 320, 390, 768 e 1440 px,
axe, teclado, foco, toque, movimento reduzido e leitura sem JavaScript.
Teste bloqueado ou não executado não significa aprovação visual.

Para guardar evidências em outro diretório, use `UI_ARTIFACT_ROOT` para o público,
`ADMIN_ARTIFACTS` para admin e `RELEASE_ARTIFACTS` para a auditoria de entrega.
Evidências finais desta revisão: `artifacts/task-17/`. `npm audit --json` consulta
vulnerabilidades conhecidas e exige rede; não é uma auditoria de segurança completa.

## Estrutura e guias

| Caminho | Conteúdo |
| --- | --- |
| `src/app` | Rotas, handlers, layout, metadados e favicon SVG local. |
| `src/features` | Catálogo, jogadores, elencos, timeline e administração. |
| `src/lib/supabase` | Configuração, clientes e projeções tipadas. |
| `supabase/migrations` | Oito migrations versionadas; nenhuma alteração retroativa. |
| `scripts` / `tests` | Seed manual, verificadores e testes isolados. |
| `docs` | Operação, contratos, configuração e entrega. |

Guias: [organizações/temporadas](docs/ADMIN_ORGANIZATIONS.md),
[jogadores](docs/ADMIN_PLAYERS.md), [rascunhos](docs/ADMIN_ROSTER_DRAFTS.md),
[publicação](docs/ADMIN_ROSTER_PUBLICATION.md), [transferências](docs/ADMIN_TRANSFERS.md),
[design system](docs/DESIGN_SYSTEM.md) e [fontes do catálogo](docs/DADOS_VCT_2027.md).
Licenças em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Não há dependência de fontes remotas nem logos fabricados. Sem foto/logo fornecido,
a interface usa um ícone genérico local. `.gitignore` e `.vercelignore` excluem
segredos, configurações locais e/ou evidências conforme o meio de envio.

As tarefas 00–17 estão registradas em `PROGRESSO_VCT.md`. Executar somente a
tarefa solicitada; novo deploy ou configuração externa exige um pedido específico.
