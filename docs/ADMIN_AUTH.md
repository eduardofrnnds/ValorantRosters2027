# Acesso administrativo — Tarefa 10

`/admin/login` autentica e-mail/senha no Supabase Auth. `/admin` exige tanto
identidade confirmada pelo Auth quanto registro ativo em `public.admin_users`.
Sem configuração, o formulário fica indisponível e as rotas protegidas redirecionam
para o login. Não existe conta automática, senha fixa, cadastro público, login
de demonstração ou acesso administrativo pelo fallback local.

## Configuração e primeiro administrador

1. No projeto Supabase correto, aplique **as oito migrations da versão 1.0** em
   ordem, conforme o [guia de deploy](DEPLOY_VERCEL.md). As três primeiras
   estabelecem o schema, RLS e a proteção administrativa; as seguintes habilitam
   cadastros, rascunhos, publicação e transferências.
2. Configure `NEXT_PUBLIC_SUPABASE_URL` e
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` conforme `.env.example`. São as mesmas
   variáveis da leitura pública. O app não precisa de `service_role` nem de
   `DATABASE_URL` para autenticar. Configure essas variáveis antes do build.
3. No painel de usuários do Supabase Auth, crie ou selecione a conta real do
   administrador com e-mail/senha. Confirme a identidade e a situação do e-mail
   antes de conceder acesso. Não coloque a senha em SQL, seed, código ou logs.
4. Copie o **UUID do usuário Auth**, não o e-mail nem um ID gerado localmente.
   No SQL Editor do projeto, com uma sessão de operador confiável, confirme a
   conta. Substitua o marcador abaixo pelo UUID real:

```sql
select id, email, email_confirmed_at
from auth.users
where id = 'UUID_REAL_DO_USUARIO'::uuid;
```

5. Depois de confirmar a conta, conceda acesso explicitamente:

```sql
begin;

insert into public.admin_users (user_id, is_active)
values ('UUID_REAL_DO_USUARIO'::uuid, true)
on conflict (user_id) do update
set is_active = true
where admin_users.is_active is distinct from true;

select user_id, is_active
from public.admin_users
where user_id = 'UUID_REAL_DO_USUARIO'::uuid;

commit;
```

O UUID deve existir em `auth.users`, por FK. Repetir a concessão de uma conta já
ativa não produz uma atualização desnecessária. Inserção/reativação passa pelos
triggers de auditoria existentes; operações técnicas sem `auth.uid()` registram
autor nulo e o papel SQL. Nunca execute esse SQL com credenciais de navegador
nem crie uma rota pública de provisionamento.

6. Acesse `/admin/login`, autentique e confirme que `/admin` mostra
   “Acesso autorizado”. Uma conta Auth sem concessão continua bloqueada.
   Use “Sair” para encerrar o acesso neste navegador.

Nenhum desses passos foi executado contra um projeto remoto nesta entrega.
O fluxo usa a [gestão de usuários do Supabase](https://supabase.com/docs/guides/auth/managing-user-data)
e a [autenticação por senha](https://supabase.com/docs/guides/auth/passwords).
Convites, recuperação de senha e criação de contas não foram implementados no app.

## Revogação

Para remover o privilégio sem apagar o histórico:

```sql
begin;
update public.admin_users
set is_active = false
where user_id = 'UUID_REAL_DO_USUARIO'::uuid
  and is_active;

select user_id, is_active
from public.admin_users
where user_id = 'UUID_REAL_DO_USUARIO'::uuid;
commit;
```

A próxima requisição/consulta deixa de autorizar a conta, mesmo que seu JWT
continue válido. Para retirada de acesso administrativo, revogue essa permissão
antes de depender de encerramento de sessões no Auth. Não exclua `auth.users`
ou `admin_users` para simular revogação: FKs e auditoria preservam referências.
Administradores logados no aplicativo não podem conceder, reativar ou revogar
privilégios pelo cliente; isso continua sendo uma operação confiável de infraestrutura.

## Sessão e validação no servidor

- Login: `POST /admin/auth/login`, com formulário HTML nativo. Validação de
  e-mail/senha no servidor; a senha não é aparada nem devolvida na resposta.
- Identidade: `auth.getUser(accessToken)` consulta o Auth. Cookie, JWT decodificado,
  `user_metadata`, `app_metadata` e `getSession()` não concedem autorização.
- Permissão: consulta a `admin_users` com o JWT do próprio usuário, filtrando
  `user_id` confirmado e `is_active=true`, sob RLS. Falhas de Auth/banco negam acesso.
- Cookie: `vct-admin-access`, `HttpOnly`, `SameSite=Strict`, caminho `/admin`,
  sem `Domain`, `Secure` em produção. Contém somente o access token; tokens
  acima de 3500 caracteres são recusados para não truncar cookies.
- O cookie dura no máximo uma hora, limitada também pela expiração informada
  pelo Auth. Não há refresh token persistido nem renovação automática: ao expirar,
  é necessário entrar novamente. A validade criptográfica do JWT continua definida
  pelo Supabase, inclusive para clientes que guardem o bearer token separadamente.
- Nenhum token é colocado em HTML, props de Client Components ou `localStorage`.
  Páginas públicas continuam usando cliente anônimo separado.
- Logout: `POST /admin/auth/logout`, com revogação `scope=local` usando o JWT
  do próprio usuário. O método `auth.admin.signOut(jwt, 'local')` do SDK recebe
  esse JWT e chama `/auth/v1/logout`; não usa uma chave administrativa.
  O cookie é removido mesmo se o serviço falhar, com mensagem distinta nesse caso.

O [getUser](https://supabase.com/docs/reference/javascript/auth-getuser) faz
verificação no serviço de Auth. Como descrito no
[signOut](https://supabase.com/docs/reference/javascript/auth-signout), um JWT
de acesso já emitido pode continuar válido até expirar após logout. Apagar o
cookie encerra o acesso normal desse navegador; desativar `admin_users` é o
mecanismo de revogação administrativa imediata. O teste isolado de Auth não
substitui essa semântica do serviço real.

A dependência opcional `@supabase/ssr` não estava no cache e sua instalação
falhou com `ENOTCACHED` no ambiente offline. A solução usa o SDK já instalado
e uma sessão de access token sem renovação, sem reproduzir o protocolo de refresh
ou introduzir uma biblioteca local de autenticação. Nenhuma dependência foi adicionada.

## Proteções e pontos de extensão

O proxy protege `/admin/:path*`; login e os dois handlers de autenticação têm
tratamento próprio. Layout **e página** chamam `requireAdmin()`, inclusive para
renderização RSC. `React.cache` deduplica apenas dentro da renderização atual.

Futuras Server Actions/Route Handlers de escrita devem chamar
`withAdminMutation()` em `src/features/admin/server.ts` **dentro da operação**,
além de validar os dados e aplicar a proteção de origem apropriada ao endpoint.
Esse helper revalida Auth e autorização sem reutilizar o cache de renderização,
e entrega um cliente com o JWT do usuário. O layout não protege operações de
escrita sozinho. A projeção tipada atual do cliente contém a consulta de
autorização e os campos de leitura necessários às contagens do dashboard;
os contratos de CRUD serão adicionados nas tarefas correspondentes.

Login/logout aceitam somente POST de mesma origem. `Origin` é comparado ao
protocolo da requisição e ao `Host` recebido; `X-Forwarded-Host` não autoriza
requisições. Isso considera a normalização de hostname interno do Next observada
no teste de produção. Um proxy de implantação deve preservar o host e o protocolo
públicos; divergências falham de forma fechada. Respostas usam redirecionamentos
relativos fixos: parâmetros como `next` não controlam o destino.

O corpo do login aceita apenas `application/x-www-form-urlencoded`, limitado
a 16 KiB efetivamente lidos, e rejeita campos duplicados. As mensagens não expõem
erros brutos do provedor. Todas as rotas administrativas enviam `no-store`,
`noindex` e `nofollow`. Use HTTPS em produção para o cookie `Secure` funcionar.
As políticas de senha e limites do provedor permanecem no Supabase; o app não
implementa recuperação de senha, CAPTCHA, MFA ou um limitador distribuído próprio.

## RLS reforçada

A terceira migration preserva as 11 tabelas e o histórico:

- Administrador autenticado só consulta a própria autorização ativa; a lista
  completa de administradores permanece reservada a operadores confiáveis.
- Guardas restritivas exigem admin ativo para INSERT/UPDATE de conteúdo,
  mesmo que uma política permissiva adicional venha a ser criada.
- Rascunhos e auditoria têm guarda restritiva de leitura administrativa.
- Inserção de rascunho continua exigindo `created_by = auth.uid()`.
- Usuários da aplicação não escrevem diretamente em admins, aliases ou logs.
- Leitura pública exige publicação e dependências publicadas; usuários comuns
  e admins desativados continuam sem escrita. O papel técnico `service_role`
  conserva seus privilégios confiáveis, mas não é usado pelo aplicativo.

## Verificação

```powershell
npm test
npm run check
npm run build
npm run test:admin
# Opcional, em ambiente que permita abrir o navegador:
node scripts/verify-admin-access.mjs --browser
```

`test:admin` requer um build de produção sem variáveis públicas incorporadas de
outro projeto. Inicia Next na porta 3020 e serviços de teste em loopback, aplica
as três migrations a PostgreSQL/PGlite e cria usuários **exclusivos do teste**.
Nenhuma conta real é provisionada; o verificador não altera `.env.local` nem
publica rotas de simulação. Processos e banco são encerrados no `finally`.

Validação de 05/11/2026: 76 testes aprovados, lint/TypeScript/build aprovados,
fluxo HTTP real de login/logout e SSR/RSC com SDK Supabase e RLS PostgreSQL
aprovado. Cobertura inclui falta de configuração, usuário comum/desativado,
credenciais inválidas, token forjado/expirado, revogação, falhas de Auth/banco,
POST de outra origem, dados excessivos, métodos inválidos e redirecionamentos.
Os testes de escrita confirmam que o callback não é executado sem autorização;
nenhum endpoint de CRUD foi criado para isso.

Artefatos: `artifacts/task-10/results.json`, HTMLs de login/admin e
`browser.json`. O Edge headless foi bloqueado com `spawn EPERM`: não houve
aprovação visual, axe nem fluxo de navegador. O formulário sem JavaScript foi
validado como HTML e POST HTTP, sem alegar execução em navegador.

Supabase Auth/PostgREST reais, cookies em HTTPS real e configuração de produção
ainda precisam ser verificados com um projeto configurado. As substituições
HTTP isoladas não equivalem a uma implantação Supabase. Nenhum deploy foi feito.
O dashboard foi acrescentado na tarefa 11; veja [contagens, rotas e validação
atualizada](ADMIN_DASHBOARD.md). `test:admin` agora inclui essas verificações e
grava em `artifacts/task-11/`, preservando as evidências da tarefa 10.
CRUD pertence às tarefas seguintes.
