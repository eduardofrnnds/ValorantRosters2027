# Organizações e temporadas — tarefa 12

## Configuração

Com URL/chave pública Supabase e primeiro administrador configurados conforme
[ADMIN_AUTH.md](ADMIN_AUTH.md), aplique as migrations em ordem, incluindo
`20261106000100_organization_management.sql`. Não há novas dependências ou seed.
Sem configuração, o site mantém o catálogo local somente leitura e o admin
permanece bloqueado. Sem a migration, o cadastro mostra indisponibilidade.

## Fluxos

- `/admin/organizations`: listagem e busca por nome, sigla ou slug, ignorando acentos.
- `/admin/organizations/new`: organização e primeira participação salvas em uma
  transação. Não há limite de oito equipes por região.
- `/admin/organizations/[id]`: nome, slug, sigla, logo e visibilidade; participações
  por temporada com região e categoria parceira/qualificatória/visitante.
- `/admin/organizations/seasons`: criação, edição do nome e publicação da temporada.
  O ano fica fixo no editor após criar, para não reatribuir o histórico.

Novos registros começam privados. Selecionar **Publicado** e salvar é a confirmação
explícita de publicação imediata deste cadastro. A primeira participação acompanha
a visibilidade da nova organização. Para participações posteriores, a visibilidade
é independente. Publicar participação exige organização, região e temporada publicadas.
O site público continua usando 2027 como temporada padrão.

Arquivar participação define `archived_at` e a torna privada. A participação,
vínculos, rascunhos e auditoria permanecem no banco; a RLS também oculta os vínculos
dependentes do público. Restaurar para rascunho/publicado remove `archived_at`.
Não há exclusão física. Organização e temporada de uma participação não podem mudar.
Renomear uma organização preserva UUID e vínculos; mudar seu slug muda a URL e a
URL anterior retorna 404 (aliases de organização não fazem parte deste escopo).

O editor usa POST nativo e funciona sem JavaScript. Com JavaScript, erros preservam
os campos preenchidos. `updated_at` é verificado sob bloqueio de linha na RPC:
edição desatualizada exige recarregar e não sobrescreve alterações mais recentes.
Em falha de rede, a interface pede consultar o cadastro antes de repetir; não
declara sucesso nem garante que uma resposta perdida implique rollback.

## Segurança e leitura

Os handlers verificam mesma origem, limite real do corpo, duplicação de parâmetros,
Zod e autorização atual por `withAdminMutation`. As três RPCs são `SECURITY INVOKER`,
com `search_path` fixo, autorização interna, RLS e auditoria existente. Somente
`authenticated` pode executá-las; usuários comuns e desativados são negados.
UUIDs e `updated_at` vêm do banco; slug/ano/participação têm unicidade no PostgreSQL.
Não há chave privilegiada no aplicativo.

As leituras são sem cache persistente, paginadas até completar os registros,
com timeout e rechecagem de autorização. Uma falha não é substituída pelo seed.
A listagem é filtrada no servidor após a leitura completa: sem teto artificial,
mas catálogos muito grandes poderão precisar de busca/paginação na interface.

## Logo e Storage opcional

O campo de logo aceita arquivo local ou URL HTTPS sem credenciais. O servidor
não busca URLs fornecidas pelo usuário. Sem imagem, permanece o placeholder.

Para upload, crie **explicitamente** um bucket público `organization-logos` no
Supabase Storage, limitado a **2097152 bytes**, com MIME `image/png`, `image/jpeg`
e `image/webp`. O SDK envia para um bucket existente; consulte [upload](https://supabase.com/docs/reference/javascript/file-buckets-upload)
e [configuração de buckets](https://supabase.com/docs/reference/javascript/file-buckets-createbucket).
Não crie nem habilite um bucket genérico com escrita pública.

Depois de configurar o bucket, aplique estas políticas pelo SQL confiável:

```sql
begin;
create policy organization_logo_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'organization-logos' and (select private.is_admin())
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 2
  and exists (select 1 from public.organizations o
    where o.id::text = (storage.foldername(name))[2])
);
create policy organization_logo_read on storage.objects for select to authenticated
using (bucket_id = 'organization-logos' and (select private.is_admin())
  and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy organization_logo_cleanup on storage.objects for delete to authenticated
using (bucket_id = 'organization-logos' and (select private.is_admin())
  and (storage.foldername(name))[1] = (select auth.uid())::text);
commit;
```

Revise políticas permissivas preexistentes: políticas PostgreSQL permissivas se
combinam por OR. Estas instruções pressupõem que nenhuma outra política libera
escrita neste bucket. Não é necessária permissão UPDATE: upload usa `upsert: false`.

Defina `SUPABASE_ORGANIZATION_LOGOS_BUCKET=organization-logos` no servidor.
O envio limita o corpo antes de interpretar multipart, valida tamanho, MIME e
assinatura binária e rejeita SVG/HTML. Não faz decodificação completa de imagem.
O caminho é `UUID-admin/UUID-organização/UUID-aleatório.ext`, independente do nome
enviado. Arquivos são públicos, inclusive quando associados a um rascunho; isso é
informado no formulário. A gravação da URL usa a mesma RPC/versionamento do editor.

Storage e PostgreSQL não têm transação conjunta. Falha conhecida na gravação tenta
remover somente o novo arquivo. Resultado desconhecido de rede preserva o arquivo,
pois a URL pode já ter sido gravada. Limpeza que falhe pode deixar órfãos; imagens
anteriores são preservadas. Operação/limpeza remotas dependem das políticas reais.

## Validação local de 06/11/2026

- `npm test`: 89/89; dez testes novos de validação, SQL/RLS, atomicidade, histórico,
  edição obsoleta, unicidade, publicação, paginação e assinatura de logo.
- `npm run check` e `npm run build`: aprovados.
- `node scripts/verify-admin-access.mjs --browser`: parte HTTP aprovada com Next
  de produção, SDK Supabase, adaptadores Auth/PostgREST isolados e SQL/RLS reais
  via PGlite. Cria nona equipe, publica, busca, edita, renomeia, arquiva, restaura,
  cria/edita temporada e adiciona segunda participação. Verifica catálogo público,
  CSRF e configuração ausente. Não equivale a Supabase remoto.
- Navegador bloqueado por `spawn EPERM`: visual, responsividade, axe, teclado e
  fluxo real com/sem JavaScript não foram aprovados. Testes preparados no script.
- Evidências em `artifacts/task-12/`; nenhuma conta, migration remota ou deploy
  criado. Upload remoto e políticas Storage ainda precisam de validação no projeto real.
