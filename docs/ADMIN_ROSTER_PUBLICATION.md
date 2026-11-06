# Publicação de elencos — tarefa 15

Atualização: a tarefa 16 acrescentou [transferência manual e linhas do tempo](ADMIN_TRANSFERS.md).
As notas abaixo preservam o escopo e a validação da tarefa 15.

A migration `20261106000400_roster_publication.sql` acrescenta a publicação
transacional de um rascunho salvo. Aplique todas as migrations anteriores em
ordem. Nenhuma migration foi aplicada a Supabase remoto nesta etapa.

## Uso

1. Em `/admin/rosters`, abra a participação e salve o rascunho.
2. Escolha **Revisar publicação**. A página usa somente a versão salva;
   alterações locais ainda não salvas não são incluídas.
3. Confira entradas, saídas, status/função e datas. Informe uma fonte HTTPS
   opcional, marque a confirmação e escolha **Confirmar e publicar elenco**.

A revisão e o POST de confirmação funcionam sem JavaScript. O editor de
rascunhos continua exigindo JavaScript. Erros de versão ou conflito não
publicam parcialmente; recarregue e revise o rascunho. Se a resposta de rede
for inconclusiva, consulte seu estado antes de repetir. O mesmo pedido pode
ser reenviado sem duplicar vínculos, eventos, revisão ou auditoria.

Um rascunho publicado fica somente leitura, com data, autor e fonte. Seu
payload e os vínculos anteriores permanecem disponíveis. Correções exigem
outro rascunho baseado no elenco atual. Propostas sem mudanças são rejeitadas.

## Datas e funções

`effective_on` é o primeiro dia do estado proposto. Vínculos substituídos ou
removidos terminam em `effective_on - 1`, com fim inclusivo. O início antigo
precisa ser anterior à vigência; não se fabricam períodos negativos nem se
sobrescreve um vínculo iniciado nesse mesmo dia. Escolha a data correta antes
de salvar; para mudar a data, arquive o rascunho e prepare outro.

Uma mudança de status ou função fecha o vínculo anterior e cria outro UUID,
mantendo jogador e participação. Se havia um término agendado, ele passa ao
substituto. Vínculos sem mudança mantêm IDs, datas e timestamps. Uma entrada
nova começa sem término definido. Outros vínculos futuros permanecem intactos;
sobreposições na mesma equipe ou de titular em outra equipe da mesma temporada
bloqueiam a publicação. Remover o vínculo atual não cancela um retorno futuro
já registrado. Reservas, inativos e técnicos não têm a exclusividade de titular.

`roster_memberships.role` e `role_is_explicit` guardam a função por passagem,
inclusive `null` (não informada). Vínculos legados continuam usando a função
global enquanto não forem substituídos/encerrados; ao encerrá-los, a função
vigente é congelada. Não há backfill nem alteração automática do perfil global.
Cards públicos mostram a função do vínculo e a carreira preserva a função de
cada passagem. A função geral no cabeçalho do perfil segue o cadastro do jogador.

Uma publicação com data futura é persistida na confirmação, mas os grupos do
elenco público continuam seguindo o dia UTC atual. Não existe publicação
automática de rascunhos ou agendador. A leitura pública usa `no-store`.

## Transação e segurança

O handler `/admin/rosters/publish` exige mesma origem, corpo limitado, campos
únicos, validação Zod e autorização atual por Auth/allowlist. Recebe somente
ID, versão esperada, fonte e confirmação; não recebe uma nova proposta nem
autor escolhido pelo cliente. A RPC usa o JWT do administrador, RLS,
`SECURITY INVOKER` e `search_path` fixo, sem chave de serviço.

`private.lock_active_admin()` é um helper mínimo `SECURITY DEFINER` que verifica
e bloqueia para leitura a própria entrada ativa da allowlist. Isso serializa a
operação com revogação de acesso. O helper precisa desses direitos porque
`SELECT FOR SHARE` exige privilégio de UPDATE, ausente para admins nessa tabela.
Anônimos não podem executá-lo; ele não altera nem provisiona administradores.

A RPC bloqueia temporada, participação e rascunho nessa ordem; perfis, pais
públicos e vínculos envolvidos são bloqueados antes da validação final. Reusa
as validações SQL de salvamento: formato, jogadores, revisão, snapshot exato,
disputa de titulares e rascunhos incompatíveis. Também exige perfis/participação
e seus pais publicados e verifica intervalos completos contra vínculos futuros.

Em um único commit:

- Encerra vínculos antigos e cria os substitutos/entradas necessários.
- Insere um `roster_changes` por jogador afetado, com tipo, data de vigência,
  resumo, `draft_id`, fonte opcional, `published_by = auth.uid()`, timestamp e
  `before_snapshot`/`after_snapshot`. Snapshots incluem `effective_role` para
  preservar a função resolvida dos vínculos legados. Na saída, o estado posterior
  é o vínculo encerrado; na entrada, o anterior é nulo.
- Incrementa `team_seasons.roster_revision` e marca o rascunho publicado,
  guardando autor, fonte e versão usada na confirmação.
- Registra a auditoria existente na mesma transação, incluindo a revalidação
  do rascunho antes da publicação.

Qualquer erro desfaz todas essas gravações. Um índice único por
`(draft_id, player_id)`, a verificação do estado e a imutabilidade de rascunhos
publicados impedem reaplicar a proposta. Repetir o pedido original retorna
`already_published`; mudar versão/fonte num replay retorna conflito.

Somente após uma resposta confirmada da RPC o handler chama
`revalidatePath("/", "layout")`, invalidando as páginas dependentes. Uma falha
posterior de invalidação é reportada como publicação concluída com cache
pendente; não é tratada como rollback de uma transação já confirmada.

O protocolo de bloqueio cobre salvamentos/publicações pelas RPCs. Gravações
administrativas diretas em tabelas que ignorem esse protocolo não têm a mesma
garantia contra conflitos concorrentes. Leituras públicas de catálogo, perfil e
vínculos continuam sendo consultas independentes, sem snapshot compartilhado.

## Validação local — 06/11/2026

- Suíte completa: **119/119 testes**, incluindo nove testes de publicação.
  Cobrem rollback após falha injetada ao final, replay sem novas gravações,
  permissões/revogação, confirmação, fonte, snapshot/revisão obsoletos,
  visibilidade, sobreposições futuras, datas e funções históricas.
- Lint/TypeScript e build de produção aprovados.
- HTTP local de produção com SDK, doubles Auth/PostgREST e SQL/RLS reais via
  PGlite: revisão, POST nativo/JSON, proteções, atualização do elenco após
  confirmação, carreira anterior, metadados e replay aprovados.
- Regressão pública de home, quatro regiões, 32 equipes e 404 aprovada em modo
  local e com a integração isolada. O argumento `--remote` do verificador usa
  doubles locais; não representa validação de um Supabase real.
- Evidências: `artifacts/task-15/publication-http.json`, HTMLs de revisão,
  publicação, equipe e carreira; relatórios gerais e pasta `public/`.
- Playwright bloqueado por `spawn EPERM`: sem aprovação visual, axe, teclado
  ou interação no navegador. O roteiro está preparado para quatro larguras.
- Sem credenciais/validação Supabase remoto, teste de concorrência entre
  conexões reais, deploy ou escrita remota. PGlite verifica a transação e
  restrições sequenciais, não simula múltiplas conexões concorrentes.

Workflow de transferência interequipes e linhas do tempo públicas de eventos
permanecem na tarefa 16. Nenhum jogador foi inserido no catálogo real.
