# Dashboard administrativo — Tarefa 11

Atualização da tarefa 12: `/admin/organizations` agora contém a listagem e o editor
de organizações/temporadas. Veja [ADMIN_ORGANIZATIONS.md](ADMIN_ORGANIZATIONS.md).
As descrições e evidências abaixo registram a entrega original da tarefa 11.

`/admin` apresenta o resumo do cadastro para administradores ativos. A interface
tem barra superior com acesso ao site e saída, sidebar em telas a partir de
1024 px e menu nativo `details/summary` nas menores. Os links levam a resumos
protegidos em `/admin/organizations`, `/admin/players`, `/admin/rosters` e
`/admin/transfers`. Nenhum formulário ou endpoint de CRUD foi adicionado.

## Significado dos totais

| Card | Consulta | Abrangência |
| --- | --- | --- |
| Equipes | `organizations` | Identidades únicas cadastradas, incluindo não publicadas; sem limite de 8/32. |
| Jogadores | `players` | Todos os perfis cadastrados, incluindo técnicos e não publicados. |
| Alterações | `roster_changes` | Eventos de mudanças de elenco, publicados ou em rascunho; não conta `audit_logs`. |
| Rascunhos | `roster_drafts`, `status = draft` | Propostas de elenco em aberto; exclui publicadas e arquivadas. |
| Vínculos de elenco, no resumo de elencos | `roster_memberships` | Passagens atuais e encerradas, incluindo registros não publicados. |
| Transferências, no resumo de transferências | `roster_changes`, `change_type = transferred` | Apenas eventos de transferência, publicados ou em rascunho. |

As consultas abrangem todas as temporadas. Uma organização com várias
participações continua contando uma vez em Equipes. O painel não infere escalações,
mudanças ou estatísticas a partir do catálogo local. Os totais são consultas
independentes: não constituem um snapshot transacional único do banco.

## Leitura, falhas e atualização

`dashboard-reader.ts` usa o SDK Supabase com `select("id", { count: "exact",
head: true })`: o total vem do banco, sem carregar registros nem depender do
limite de uma página. Consulte a [referência oficial de select](https://supabase.com/docs/reference/javascript/select).
Os filtros são aplicados antes da contagem. As consultas são paralelas e têm
timeout de dez segundos, sem repetição automática.

- Contagem zero mostra **0**, **Sem dados** e uma descrição do cadastro ausente.
- Erro, timeout ou total ausente/inválido mostra **— / Não foi possível consultar**.
- Falha em uma consulta preserva os outros cards e produz um aviso parcial.
- Falha em todas mostra **Contagens indisponíveis**, sem substituir por zeros.
- **Atualizar contagens** envia um GET nativo para a página atual. A navegação
  também consulta novamente; não há polling, cache persistente ou fallback local.

`dashboard-server.ts` é exclusivo do servidor. Exige admin antes da leitura,
revalida Auth/allowlist pela operação e usa chave pública com o JWT do usuário,
sob RLS. A autorização é conferida novamente após as contagens para descartar
totais caso ocorra revogação durante a leitura. Falhas dessa conferência tornam
os totais indisponíveis. Tokens e erros do provedor não são enviados aos cards.
As páginas enviam `no-store` e continuam sob proxy, layout e guarda de dados.
Configuração e provisionamento: [ADMIN_AUTH.md](ADMIN_AUTH.md).

O menu mobile, atualização e saída usam controles HTML nativos. A navegação
marca a rota atual com `aria-current="page"`, usa links de pelo menos 48 px e
fecha o menu após navegação com JavaScript. O layout preserva o único `main`
da aplicação e o foco visível do design system. Nenhum gráfico foi acrescentado.

## Verificação local em 05/11/2026

- `npm test`: **79/79 aprovados**, incluindo três testes novos do leitor e dos
  componentes reais. Verificam HEAD exato, token, filtros, totais acima de mil,
  zero, falhas, números inválidos, formatação e destinos.
- `npm run check`: lint e TypeScript aprovados; `npm run build`: aprovado.
- `node scripts/verify-admin-access.mjs --browser`: HTTP aprovado com Next de
  produção, SDK Supabase, Auth/PostgREST de teste e PostgreSQL/PGlite com as três
  migrations reais. Sem contas ou dados remotos.
- Banco vazio retorna quatro zeros. Fixtures isoladas retornam **33 equipes,
  2 jogadores, 2 alterações e 2 rascunhos**, incluindo registros não publicados.
  Dois vínculos (um encerrado) e uma transferência aparecem nos resumos.
  Rascunhos publicados/arquivados ficam fora do total de abertos.
- Alterações no banco aparecem na próxima requisição (**34 equipes/1 rascunho**).
  Falhas parcial/total não geram zeros. As leituras não acrescentam auditoria.
- As quatro áreas respondem para admin ativo, indicam a rota atual e bloqueiam
  membros, desativados e revogados antes de consultar os totais. Login/logout,
  CSRF, SSR/RSC, cookies e ausência de token no HTML/JS continuam verificados.
- Regressão pública HTTP: home, quatro regiões, 32 equipes e 404 aprovados.

Evidências: `artifacts/task-11/results.json`, HTMLs dos estados e resumos,
`browser.json` e subpasta `public/`. Os arquivos de tarefas anteriores foram
preservados. Serviços e banco temporários são encerrados pelos verificadores.

**Limites:** o Edge headless foi bloqueado com `spawn EPERM`; não houve
validação visual/responsiva, axe ou navegação de teclado em navegador nesta
tarefa. Não há credenciais Supabase reais no workspace: integração remota,
cookies em HTTPS e contagens do projeto real ainda precisam ser validados.
As fixtures existem apenas no banco de teste. Nenhuma migration nova,
dependência, escrita de conteúdo pela aplicação ou implantação foi realizada.

Próxima etapa: tarefa 12, CRUD de organizações e temporadas, ainda não iniciada.
