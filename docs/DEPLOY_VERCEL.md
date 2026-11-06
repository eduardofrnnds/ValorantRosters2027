# Deploy da versão 1.0 na Vercel

Este é um roteiro de implantação, não um registro de deploy realizado. A revisão
local está em [REVISAO_FINAL_V1.md](REVISAO_FINAL_V1.md). Não há projeto Vercel,
domínio ou Supabase real configurado neste workspace. Use um Supabase de
homologação separado do banco de produção para testar alterações administrativas.

## 1. Preparar o banco

Em um projeto Supabase novo, aplique estes arquivos de `supabase/migrations`,
na ordem abaixo, com o operador autorizado do banco:

1. `20261104000100_vct_schema.sql`
2. `20261104000200_vct_security_history.sql`
3. `20261105000100_admin_access_hardening.sql`
4. `20261106000100_organization_management.sql`
5. `20261106000200_player_management.sql`
6. `20261106000300_roster_draft_editor.sql`
7. `20261106000400_roster_publication.sql`
8. `20261106000500_manual_transfers.sql`

O banco deve fornecer `auth.users`, `auth.uid()` e os papéis do Supabase. Não use
um PostgreSQL vazio sem essa infraestrutura. Os testes PGlite criam substitutos
isolados desses elementos; eles não provisionam a infraestrutura remota.

Para usar a CLI Supabase instalada, inicialize a configuração local uma única
vez com `supabase init`, preservando os arquivos de migrations existentes. Faça
login, vincule o projeto correto e confira o histórico antes de aplicar:

```powershell
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase migration list --remote
supabase db push --remote
supabase migration list --remote
```

A CLI acompanha as migrations aplicadas e executa as pendentes em ordem. Em um
banco que recebeu SQL manualmente, reconcilie o histórico antes de usar `db push`;
não reaplique arquivos às cegas nem execute reset no banco remoto. Fluxo baseado
na [documentação oficial de migrations](https://supabase.com/docs/guides/deployment/database-migrations).

Mantenha `private` fora dos schemas expostos pela Data API. Preserve as políticas
RLS e os grants definidos pelas migrations; a aplicação utiliza a chave pública
e o JWT do usuário, sem chave privilegiada. Veja a orientação de
[proteção da API Supabase](https://supabase.com/docs/guides/api/securing-your-api).

## 2. Seed e primeiro administrador

Copie `.env.example` para `.env.local`. Configure as variáveis públicas e a
conexão PostgreSQL privada `DATABASE_URL` apontando para o mesmo projeto. A
conexão remota do seed verifica o certificado TLS; não desative essa verificação.

```powershell
npm ci
npm run db:seed
npm run db:seed
```

Em um banco vazio, o resultado esperado é quatro regiões, a temporada 2027,
32 organizações e 32 participações parceiras. A segunda execução preserva IDs,
edições e histórico. O seed não cria jogadores, elencos ou administradores e não
remove equipes extras. Detalhes e tratamento de conflitos em
[SUPABASE_SEED.md](SUPABASE_SEED.md).

Crie a conta real de e-mail/senha no Supabase Auth e conceda a allowlist ativa
por UUID seguindo [ADMIN_AUTH.md](ADMIN_AUTH.md). Não há cadastro público nem
senha padrão. Teste também uma conta autenticada sem concessão e uma concessão
revogada.

Uploads são opcionais. Para habilitá-los, provisione os buckets públicos
`organization-logos` e `player-photos`, com as políticas e limites de 2 MB
descritos em [ADMIN_ORGANIZATIONS.md](ADMIN_ORGANIZATIONS.md) e
[ADMIN_PLAYERS.md](ADMIN_PLAYERS.md). Esses buckets não são criados pelas
migrations. Sem Storage configurado, deixe as variáveis de bucket vazias.

## 3. Configurar a Vercel

Importe o código por um repositório Git autorizado ou use a CLI Vercel quando
for solicitado publicar. O Git local foi inicializado após a revisão; o estado
da publicação está em [PUBLICACAO.md](PUBLICACAO.md). Arquivos
locais, segredos e relatórios estão excluídos do upload CLI por `.vercelignore`;
confira os arquivos enviados pelo fluxo escolhido.

| Configuração | Valor |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | Raiz deste projeto |
| Node.js Version | 24.x, compatível com `engines` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | Padrão do framework; não usar `out` |

O app usa renderização e handlers no servidor, portanto precisa da implantação
Next.js completa. A integração é descrita no
[guia Next.js da Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs).
Selecione explicitamente Node 24.x; a Vercel considera também o campo `engines`
do projeto, conforme a [documentação de versões Node.js](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

Defina por ambiente, **antes do build**:

| Variável | Valor/necessidade |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL HTTPS do projeto correspondente ao ambiente. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave publishable ou anon legada do mesmo projeto. |
| `SUPABASE_ORGANIZATION_LOGOS_BUCKET` | Opcional: `organization-logos`, depois do provisionamento. |
| `SUPABASE_PLAYER_PHOTOS_BUCKET` | Opcional: `player-photos`, depois do provisionamento. |

Não configure `DATABASE_URL` na Vercel: somente o comando local de seed a usa.
Nunca coloque `service_role`, `sb_secret_*`, senha de banco ou token de operador
em uma variável pública. Preview deve usar o projeto de homologação; Production,
o projeto de produção. Alterar variáveis exige nova implantação, e valores
`NEXT_PUBLIC_*` são incorporados no build. Veja
[variáveis de ambiente na Vercel](https://vercel.com/docs/environment-variables).

Sem as duas variáveis públicas, o site inicia com o catálogo local somente
leitura e o admin indisponível. Isso não comprova conexão ao Supabase. Migrations,
seed, contas e buckets são passos separados; não são executados pelo build.

## 4. Homologar antes da liberação

Execute localmente os comandos de verificação do [README](../README.md), depois
valide a implantação HTTPS com o Supabase de homologação:

1. Confirme catálogo remoto, quatro regiões, equipes, estados vazios e 404.
   Uma falha de serviço deve mostrar indisponibilidade, sem catálogo local falso.
2. Confira login/logout, expiração, cookie Secure/HttpOnly/SameSite, POST com
   origem correta e rejeição de conta sem privilégio. Revogue a allowlist e
   confirme bloqueio na requisição seguinte, inclusive nas RPCs.
3. Cadastre equipe extra `qualifier`/`visitor`, jogador de teste e rascunho.
   Antes da confirmação, o elenco público deve permanecer igual. Publique e
   confira equipe, perfil e histórico. Reenvie a confirmação: não deve duplicar.
4. Transfira o jogador entre duas equipes da mesma temporada. Confira UUID,
   encerramento da origem, destino, datas, histórico e feed. Exercite conflitos
   e duas sessões concorrentes; a revisão PGlite não testa conexões concorrentes.
5. Teste uploads e acesso anônimo aos objetos, se habilitados, e bloqueio de
   escrita por usuário não autorizado. Banco e Storage não compartilham uma
   transação; falhas podem deixar um objeto órfão, conforme os guias de upload.
6. Verifique 320, 390, 768 e 1440 px, toque, teclado, foco, movimento reduzido,
   axe e ausência de overflow. Confira o editor com JavaScript e os formulários
   nativos sem JavaScript. Consulte a cobertura e as limitações de navegador
   registradas no relatório final; a aprovação HTTP não substitui esses testes.

Use dados de teste apenas em homologação; o catálogo de produção continua manual.
O domínio final ainda não foi definido, portanto não foi inventada URL canônica.
As verificações locais de metadados não atestam indexação em buscadores.

## 5. Operação e reversão

Depois de validar, configure Production e faça a implantação solicitada.
Confirme as rotas públicas e login pela URL final. Registre versão implantada,
ambiente e migrations aplicadas sem incluir credenciais. Consulte logs sem
compartilhar tokens, cookies ou dados privados.

Se a aplicação precisar voltar à versão anterior, o código e o banco devem
continuar compatíveis: reverter uma implantação não desfaz migrations, seed,
publicações ou transferências. Não remova vínculos/auditoria para desfazer uma
operação. Interrompa novas edições quando necessário e revise a correção com o
operador do banco; esta entrega não fornece migrations destrutivas de reversão.
