# Cadastro de jogadores — tarefa 13

Atualização da tarefa 14: a página de equipe também lê vínculos publicados e o
[editor de rascunhos](ADMIN_ROSTER_DRAFTS.md) prepara mudanças privadas. As notas
abaixo registram o fechamento da tarefa 13.

## Configuração e uso

Aplique todas as migrations em ordem, incluindo
`20261106000200_player_management.sql`, que acrescenta `players.links` e a RPC
`admin_save_player`. Use o mesmo Supabase Auth/administrador ativo documentado em
[ADMIN_AUTH.md](ADMIN_AUTH.md). Não há novas dependências nem jogadores de seed.

- `/admin/players`: listagem e busca por nickname, nome, país ou slug, sem acentos.
- `/admin/players/new`: nickname obrigatório; nome, país/nacionalidade, função,
  foto e links Site/X/Twitch/VLR opcionais. O cadastro começa privado.
- `/admin/players/[id]`: edição da mesma identidade, visibilidade, foto opcional
  por upload e relação de endereços reservados.

Sem slug informado na criação, o nickname é normalizado para um endereço e a RPC
resolve colisões com sufixos. Nicknames iguais podem representar pessoas diferentes:
não são uma chave de identidade. O formulário novo recebe um UUID; repetir seu
POST não cria outra identidade. A interface orienta consultar antes de cadastrar
novamente. Não há deduplicação por nome presumido nem exclusão física.

Edições verificam `updated_at` com bloqueio da linha e preservam UUID, vínculos,
auditoria e aliases. Slugs explicitamente escolhidos precisam estar livres,
inclusive no histórico de outros jogadores. Renomear nickname não muda o slug
automaticamente. Um jogador pode voltar a um slug de sua própria identidade.

Salvar como **Publicado** confirma a publicação imediata do perfil. Rascunhos
ficam privados; torná-lo privado também oculta seus aliases e vínculos na RLS.
Nenhuma transferência, remoção de equipe ou editor de elenco foi criado nesta tarefa.

## Perfil público e URLs antigas

`/player/[slug]` resolve a identidade pelo cliente anônimo, sem cookies admin.
O perfil apresenta os campos confirmados, links HTTPS, foto/fallback e vínculos
já publicados. Sem vínculos, informa ausência de registros; falhas de consulta
não viram carreira vazia. As fontes locais continuam vazias e são usadas somente
quando não há configuração Supabase. A leitura persistida da página de equipe
continua dependendo da etapa de elencos; não foi criada uma escalação fictícia.

Aliases com `was_published=true` redirecionam para o slug atual com **307** e
`no-store`. O redirecionamento é temporário para permitir voltar a um slug sem
loops de cache permanente. Aliases usados só em rascunhos retornam 404.
Perfil privado ou inexistente retorna 404; falha no resolvedor retorna 503.
Se o perfil existe e somente a carreira falha depois da checagem do proxy,
a página mostra indisponibilidade, podendo responder 200. As leituras de proxy,
perfil e carreira não compartilham snapshot transacional.

## Segurança

POSTs verificam origem, tamanho real do corpo, parâmetros duplicados, Zod e
autorização atual. RPC `SECURITY INVOKER` revalida admin, aplica RLS e usa
`search_path` fixo. As constraints/triggers existentes garantem unicidade,
imutabilidade do ID, reserva de slugs e auditoria transacional.
Nenhuma chave privilegiada é usada pelo aplicativo. Links externos aceitam
HTTPS sem credenciais e recebem `noopener noreferrer` na interface pública.

## Foto e Storage opcional

Sem Storage, o campo aceita URL HTTPS ou arquivo local e o upload informa
indisponibilidade. Para habilitá-lo, crie um bucket público **player-photos**,
com limite **2097152 bytes**, MIME `image/png`, `image/jpeg` e `image/webp`.
Depois de configurar o bucket, aplique pelo SQL confiável:

```sql
begin;
create policy player_photo_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'player-photos' and (select private.is_admin())
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 2
  and exists (select 1 from public.players p
    where p.id::text = (storage.foldername(name))[2])
);
create policy player_photo_read on storage.objects for select to authenticated
using (bucket_id = 'player-photos' and (select private.is_admin())
  and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy player_photo_cleanup on storage.objects for delete to authenticated
using (bucket_id = 'player-photos' and (select private.is_admin())
  and (storage.foldername(name))[1] = (select auth.uid())::text);
commit;
```

Revise políticas permissivas preexistentes que poderiam liberar escrita no bucket.
Defina `SUPABASE_PLAYER_PHOTOS_BUCKET=player-photos` no servidor. As políticas
são instruções de provisionamento manual, não migrations executadas automaticamente.

O handler limita o corpo antes de ler multipart, valida tamanho/MIME/assinatura,
rejeita SVG/HTML, usa caminho `UUID-admin/UUID-jogador/UUID-aleatório.ext` e
`upsert: false`. Não faz decodificação completa da imagem. A URL persistida precisa
ser HTTPS; use Storage HTTPS para esse fluxo. O arquivo é público mesmo para
rascunhos, como informa o formulário. Use somente fotos autorizadas.

Não há transação conjunta Storage/PostgreSQL. Falha conhecida tenta remover apenas
o novo arquivo; erro de rede com resultado desconhecido o preserva, pois a gravação
pode ter sido concluída. Limpeza que falhe pode deixar órfãos; fotos antigas são
preservadas. Isso também se aplica ao [upload de logos](ADMIN_ORGANIZATIONS.md).

## Validação local em 06/11/2026

- `npm test`: **99/99**, incluindo dez novos testes de jogadores: validação,
  slugs automáticos/históricos, replay, identidade/vínculos, rollback/auditoria,
  edição obsoleta, RLS, SDK, paginação, aliases e falhas da carreira.
- `npm run check` e `npm run build`: aprovados.
- `node scripts/verify-admin-access.mjs --browser`: HTTP de produção local
  aprovado para organizações e jogadores, usando SDK, Auth/PostgREST de teste e
  PostgreSQL/RLS via PGlite. Criação, edição, busca, publicação, redirecionamentos,
  aliases privados, despublicação, histórico e CSRF verificados.
- Regressão pública HTTP local: home, quatro regiões, 32 equipes e 404 aprovados.
- Navegador bloqueado por `spawn EPERM`: sem aprovação visual, responsiva, axe,
  teclado ou interação com/sem JavaScript. Testes de navegador estão preparados.
- Evidências: `artifacts/task-13/`. Sem credenciais reais, upload e políticas
  Storage, Auth/PostgREST remotos e concorrência real entre conexões não validados.
  Nenhuma conta real, escrita remota ou deploy realizado.
