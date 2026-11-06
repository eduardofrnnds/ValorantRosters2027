# Transferência manual e linha do tempo — tarefa 16

## Configuração e uso

Aplique as migrations em ordem, incluindo
`20261106000500_manual_transfers.sql`, depois da publicação de rascunhos da
tarefa 15. Esta etapa não aplicou migrations nem gravou dados em Supabase remoto.

Em `/admin/transfers`:

1. Escolha o jogador pelo vínculo de origem, outra equipe da mesma temporada
   e a data de início no destino. Clique em **Revisar transferência**.
2. Confira jogador, equipes, último dia na origem, início/término no destino
   e função preservada. Escolha o status no destino.
3. Informe observação pública (até 1.000 caracteres) e fonte HTTPS opcionais.
4. Marque a confirmação e clique em **Confirmar e publicar transferência**.

Preparação e revisão usam GET, sem gravações. A confirmação usa POST protegido.
O fluxo funciona com HTML nativo; com JavaScript, erros mantêm os campos
preenchidos. Alterar a seleção inicial exige clicar novamente em **Revisar**
antes de confirmar. A seção de confirmação sempre identifica os valores usados.

O jogador mantém seu UUID, perfil e aliases. A origem termina no dia anterior
à transferência, com fim inclusivo, e um novo vínculo começa na data escolhida.
A função do vínculo de origem é preservada; o status pode mudar. Um término
previamente agendado passa ao destino. Para corrigir função ou outras mudanças
do elenco, use um novo rascunho. Não há exclusão de passagens anteriores.

Datas futuras são permitidas: o evento publicado aparece com **Vigência futura**,
mas o elenco atual continua seguindo o dia UTC. Uma volta posterior à organização
original cria outra passagem e preserva as duas anteriores. Não há transferência
automática nem movimentação entre temporadas diferentes neste fluxo.

## Integridade e publicação

O destino deve ser outra participação publicada da mesma temporada. Origem,
destino, jogador, organizações, regiões e temporada precisam estar publicados;
participações arquivadas não podem ser usadas. O vínculo de origem deve estar
ativo na data escolhida e ter começado antes dela.

Rascunhos abertos na origem ou no destino devem ser publicados ou arquivados
antes da transferência. O banco também verifica sobreposição no destino e
disputa de titular durante todo o intervalo proposto, inclusive vínculos futuros
e outros rascunhos da mesma temporada. Reservas, inativos e técnicos mantêm a
regra existente: a exclusividade entre equipes se aplica ao status de titular.

`admin_transfer_player(input)` é `SECURITY INVOKER`, com `search_path` fixo,
RLS e autorização interna. O handler revalida Auth/allowlist, mesma origem,
tamanho/campos do formulário e Zod. Não recebe um novo jogador nem autoria
arbitrária; o autor vem de `auth.uid()`.

A operação reutiliza o bloqueio da autorização ativa da tarefa 15, serializa
o UUID do pedido e bloqueia temporada, equipes em ordem de UUID, pais públicos,
perfil e vínculo. Compara as revisões dos dois elencos e o timestamp exato do
vínculo usados na revisão. Tudo ocorre na mesma transação:

- Encerra o vínculo original e cria o vínculo no destino.
- Insere um evento `transferred`, com origem/destino, vigência, nota, fonte,
  autor, data de publicação e snapshots anterior/posterior, incluindo função.
- Incrementa as revisões de ambas as equipes e registra auditoria imutável.
- Guarda o pedido em `private.roster_transfer_requests`, com RLS, sem grants
  públicos, sem UPDATE/DELETE para administradores e sem exposição na API.

Um erro desfaz todos esses registros, incluindo auditoria. Repetir o mesmo UUID
com o mesmo conteúdo retorna o evento confirmado sem novas gravações. Um pedido
alterado com esse UUID retorna conflito. Mesmo outro UUID com a revisão antiga
não reaplica a transferência. Resultado de rede inconclusivo exige consultar
elencos/histórico antes de preparar um novo pedido; a interface não inventa sucesso.

Somente após confirmação da RPC o handler invalida o layout público/admin com
`revalidatePath`. Falha posterior de cache é informada como publicação concluída
com atualização pendente, sem alegar rollback. As garantias de serialização
dependem do uso das RPCs; escritas SQL externas que ignorem o protocolo não são
protegidas contra todos os conflitos concorrentes.

## Histórico público

`/transfers` começa nas transferências e permite selecionar todas as mudanças
ou apenas entradas, saídas, status/função e correções. Os filtros GET funcionam
sem JavaScript: região e equipe de qualquer ponta, intervalo de datas inclusivo
e tipo. Links dos perfis podem acrescentar um filtro por jogador.

A página mostra 20 eventos por página, ordenados por vigência decrescente e
UUID decrescente para desempate. A RPC aceita até 50 por página e páginas de
1 a 10.000. Filtros inválidos, resultado vazio e falha de leitura são estados
distintos. A paginação preserva os filtros. O histórico abrange as temporadas
publicadas; os grupos atuais das equipes continuam na temporada padrão 2027.

Equipes e jogadores mostram os 20 primeiros eventos e um link para o histórico
paginado. A página inicial mostra os cinco primeiros eventos publicados. Os
cards oferecem perfil do jogador, origem/destino, temporada, status/função,
vigência, observação e fonte. Nomes e slugs usam a identidade atual, enquanto
vínculos e eventos continuam relacionados por UUID.

`read_roster_timeline(filters)` é uma projeção de leitura `SECURITY INVOKER`,
executada pelo cliente público anônimo. RLS e filtros explícitos excluem eventos
e dependências privados, inclusive quando a RPC recebe uma sessão administrativa.
Totais e página são calculados na mesma consulta. A projeção não devolve IDs de
autores, pedidos privados nem snapshots brutos de auditoria. Texto é escapado por
React; links de fonte são HTTPS, sem credenciais. Renomeações não duplicam perfis.

Sem Supabase configurado, não há eventos inventados: o histórico local permanece
vazio. Com configuração e falha de consulta, aparece **Histórico indisponível**.
O catálogo público continua sendo necessário para os filtros. Se uma dependência
for despublicada, o evento deixa a leitura pública sem ser apagado do banco.

## Validação local — 06/11/2026

- **130/130 testes**: onze novos cenários cobrem ida/volta, preservação de UUID
  e carreira, rollback com falha injetada, permissões/revogação, pedidos privados,
  replay, versões, visibilidade, datas, conflitos futuros, rascunhos, filtros,
  paginação, RLS e contratos dos SDKs.
- Lint, TypeScript e build de produção aprovados.
- Integração HTTP com Next em produção, SDK, doubles locais de Auth/PostgREST
  e SQL/RLS via PGlite: revisão/POST nativo, CSRF, autenticação, confirmação,
  versões, elencos atualizados, carreira, linhas do tempo, filtros, replay e
  indisponibilidade aprovados. Observação escapada e ausência de autor na projeção
  pública verificadas no HTML.
- Regressão pública: home, quatro regiões, 32 equipes, `/transfers` e 404 no
  modo local; integração isolada verifica leitura, publicação, vazio e falhas.
  O modo `--remote` do verificador usa um adaptador local, não Supabase real.
- Evidências: `artifacts/task-16/`, incluindo `transfers-http.json`, HTMLs de
  revisão/equipes/carreira/feed/home, `results.json` e `public/`.
- Navegador bloqueado por `spawn EPERM`: sem aprovação visual, responsiva,
  axe ou interação no navegador. Roteiro preparado para 320, 390, 768 e 1440 px.
- PGlite valida transações/restrições sequenciais; concorrência entre conexões
  reais e Supabase remoto permanecem sem validação. Sem deploy ou escrita remota.

A tarefa 17 (revisão final e preparo para Vercel) permanece pendente.
