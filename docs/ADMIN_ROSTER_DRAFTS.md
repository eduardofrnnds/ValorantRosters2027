# Editor de elencos e rascunhos — tarefa 14

Atualização: a tarefa 15 acrescentou [revisão e publicação transacional](ADMIN_ROSTER_PUBLICATION.md).
As notas abaixo registram o escopo e a validação da tarefa 14; salvar rascunhos
continua sem alterar o elenco publicado.

## Configuração e uso

Aplique todas as migrations em ordem, incluindo
`20261106000300_roster_draft_editor.sql`. Ela acrescenta um leitor de snapshot
privado e RPCs para salvar/arquivar rascunhos. Não cria tabelas, seed, contas,
publicação de elenco ou transferência. O acesso usa o mesmo administrador ativo,
JWT e políticas RLS das tarefas anteriores.

Em `/admin/rosters`, selecione temporada (2027 por padrão), região e equipe.
`/admin/rosters/[id]` usa o UUID da participação, não o nome da organização.
A data de referência começa no dia UTC atual e pode ser escolhida antes do
primeiro salvamento. A base contém vínculos publicados ativos nessa data:
início já alcançado, fim ausente ou maior/igual à data (fim inclusivo).

O editor apresenta Titulares, Reservas, Inativos e Técnicos. Permite buscar e
adicionar jogadores cadastrados, mudar status/função e preparar saídas. Novas
entradas começam como reservas. Uma remoção de jogador da base vira saída
proposta; remover uma entrada ainda nova apenas desfaz essa proposta.
Jogadores privados podem ser preparados, com aviso de que seu perfil precisa
estar publicado antes de uma publicação futura do elenco.

A prévia compara a proposta com a base e lista entradas, saídas e mudanças de
status/função. **Salvar rascunho não altera os jogadores, vínculos, revisões da
equipe nem registros de mudanças publicados.** A função proposta fica no JSON
privado e não edita a função global do jogador.

O editor interativo exige JavaScript. Sem JavaScript, seus controles ficam
desabilitados e a página explica isso; listagem, leitura e arquivamento continuam
disponíveis por HTML/POST. Alterações locais só persistem ao salvar. Fechar ou
recarregar uma página com alterações avisa o navegador; navegação interna pode
descartar alterações não salvas. Não há salvamento automático.

## Contrato de rascunho

`roster_drafts.payload` usa formato `version: 1`:

- `effective_on`: data de referência/proposta, fixa após o primeiro salvamento.
- `base_members`: snapshot de IDs de vínculos/jogadores, status, função atual,
  datas e `updated_at`, ordenado pelo ID do vínculo.
- `members`: elenco proposto com `player_id`, `status` e `role` opcional (`null`).

Cada jogador aparece uma vez na proposta; máximo de 200 entradas e corpo de
128 KiB por requisição. O limite protege o editor e não limita equipes por região.
IDs, `created_by` e `base_revision` são preservados. Um UUID por formulário novo
impede duplicação por replay. Só é criado um rascunho aberto por participação;
rascunhos antigos existentes não foram apagados nem convertidos automaticamente.

Rascunhos de formato anterior ficam somente leitura. É possível arquivá-los
explicitamente, com confirmação, para preparar outro. Rascunhos arquivados ou
publicados podem ser consultados pelo histórico, sem edição. Participações
arquivadas também são somente leitura; seu histórico permanece acessível.

Arquivamento altera apenas o status para `archived`. O JSON e auditoria ficam
preservados. Não há exclusão física nem botão de publicação nesta tarefa.

## Conflitos e segurança

O servidor verifica origem, tamanho do corpo, Zod e autorização atual. As RPCs
são `SECURITY INVOKER`, com `search_path` fixo, verificação interna de admin e
RLS. `created_by` é obtido de `auth.uid()`, nunca aceito como autor do cliente.

Ao salvar, a RPC verifica a revisão da equipe e compara o snapshot enviado com
os vínculos publicados atuais. Edições exigem o `updated_at` exato do rascunho;
data, base e autoria não podem ser substituídas. Se a base mudou, o rascunho fica
somente leitura no editor; arquive-o e crie outro com a base atual. Isso evita
sobrescrever mudanças de outro administrador ou preparar uma prévia enganosa.

Um titular proposto conflita com:

- Vínculo publicado de titular em outra participação da mesma temporada que
  esteja ativo na data de referência, mesmo que essa participação esteja privada.
- Outro rascunho aberto da mesma temporada que o proponha como titular em outra
  equipe. Esse bloqueio é conservador e independe da data do outro rascunho.

Reservas, inativos e técnicos não são tratados como titulares. Outra temporada
não entra nesse conflito. Uma saída proposta em outra equipe não libera uma
transferência: o vínculo publicado continua vigente. Rascunho não vazio de
formato desconhecido em outra equipe exige revisão antes de salvar.

As gravações via RPC bloqueiam primeiro a temporada e depois a participação,
serializando disputas de titulares entre equipes. Escritas externas que não
usem essas RPCs não seguem esse protocolo. A futura publicação precisa revalidar
permissões, revisão, snapshot, datas e conflitos dentro da própria transação.
Esta etapa não define/aplica datas finais de vínculo: a data da proposta é
referência para prévia/conflitos, não publicação automática de saída.

## Separação da leitura pública

O perfil de equipe agora lê vínculos e perfis publicados pelo cliente anônimo,
na temporada padrão, com filtro de atividade pelo dia UTC atual. Não consulta
`roster_drafts`. Rascunhos, perfis privados e vínculos encerrados/futuros ficam
fora dos grupos públicos. Erros de leitura mostram **Elenco indisponível**,
sem substituir falha por uma lista vazia. Sem configuração Supabase, a fonte
local de elencos continua vazia e somente leitura.

O perfil individual continua lendo apenas carreira publicada. O histórico de
eventos da equipe ainda pertence à etapa posterior; não foi inventado um feed.
Leituras de catálogo, perfis e vínculos são independentes, sem snapshot único.

## Validação local em 06/11/2026

- `npm test`: **110/110**. Onze testes novos cobrem snapshot, diff, gravação
  exclusiva de rascunho/auditoria, permissões, conflitos de titular, replay,
  edição obsoleta, arquivamento, SDK e leitura pública sem rascunhos.
- `npm run check` (lint/TypeScript) e `npm run build`: aprovados.
- `node scripts/verify-admin-access.mjs --browser`: HTTP de produção local
  aprovado com SDK, Auth/PostgREST isolados e PostgreSQL/RLS via PGlite.
  Testa criar/editar/arquivar, preview, CSRF, conflito, versão obsoleta e páginas
  públicas de equipe/jogador. Snapshots de jogadores, vínculos, revisões e
  mudanças permanecem iguais após salvar/arquivar rascunhos.
- Regressão pública local: home, quatro regiões, 32 equipes e 404 aprovados.
- Evidências em `artifacts/task-14/`, incluindo `drafts-http.json`, HTMLs de
  editor/prévia e `public-roster-unchanged.html`.
- Navegador bloqueado com `spawn EPERM`: visual, responsividade, axe, teclado
  e interação real do editor não aprovados. Testes de navegador estão preparados.
- Sem Supabase remoto ou teste de concorrência entre conexões reais; PGlite
  valida SQL/RLS em memória e as restrições sequenciais. Sem deploy ou escrita
  remota. Nenhuma publicação/transferência implementada.

Próxima tarefa: **15 — Publicação segura e atômica de rosters**, apenas quando solicitada.
