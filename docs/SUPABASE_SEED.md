# Supabase e seed 2027 — Tarefa 09

Estado posterior: a [Tarefa 10](ADMIN_AUTH.md) adicionou login administrativo e
uma terceira migration de segurança. As notas abaixo descrevem a leitura pública
e o seed da Tarefa 09; esses clientes permanecem anônimos e separados da sessão
administrativa. Em um banco novo, aplique todas as migrations em ordem.

A home, as quatro regiões e `/team/[slug]` consultam o mesmo serviço
`getPublicCatalog`. Sem configuração pública, ele usa o snapshot local em modo
somente leitura. Com configuração, consulta o Supabase com chave pública e RLS.
Falha, configuração parcial/inválida ou resposta inconsistente exibem
“Dados indisponíveis”; nunca acionam fallback local. Sem temporada 2027 publicada,
a interface informa “Nenhuma temporada publicada”. Uma temporada publicada sem
equipes continua sendo um catálogo válido, com contagens zero.

## Configuração

Copie `.env.example` para `.env.local` e preencha no seu ambiente:

| Variável | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL HTTPS do projeto; HTTP permitido somente em loopback para desenvolvimento. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave publishable ou JWT anon legado do mesmo projeto. |
| `DATABASE_URL` | Conexão PostgreSQL privada, usada somente por `npm run db:seed`. |

As duas variáveis públicas devem estar ambas vazias ou ambas preenchidas.
Chaves `sb_secret_*` e JWTs com papel diferente de `anon` são rejeitados pela
configuração pública. Essa checagem identifica o tipo de chave; a validação da
assinatura e das permissões é responsabilidade do Supabase. Nunca coloque
credenciais privilegiadas em `NEXT_PUBLIC_*`.

Os clientes de servidor e navegador usam `@supabase/supabase-js` com sessão,
renovação de token e captura de token da URL desativadas. A leitura pública
não usa cookies de administrador. O cliente de servidor e o serviço são
`server-only`; o cliente de navegador está disponível, mas as páginas atuais
carregam o catálogo no servidor. Login, SSR de sessões e CRUD não fazem parte
desta tarefa. A separação segue a [documentação de chaves do Supabase](https://supabase.com/docs/guides/getting-started/api-keys)
e a [inicialização do cliente](https://supabase.com/docs/reference/javascript/initializing).

O Next.js incorpora variáveis públicas definidas durante o build. Configure-as
antes do build de implantação e refaça o build ao trocar de projeto/chave.
As leituras aguardam a requisição via `connection()` e usam `cache: no-store`;
`React.cache` deduplica página/metadados apenas na mesma renderização.
O build não precisa conectar ao banco. Não existe cache persistente do catálogo
local que substitua uma configuração disponível no servidor.

## Aplicação das migrations e seed

1. Provisione o projeto Supabase e aplique **todas as oito migrations da versão 1.0**,
   em ordem, pelo fluxo de migrations do projeto. Veja
   [SCHEMA_POSTGRESQL.md](SCHEMA_POSTGRESQL.md). O seed não aplica migrations.
2. Defina `DATABASE_URL` para esse mesmo banco com um usuário autorizado a
   inserir nas quatro tabelas. Use conexão direta ou pooler de sessão conforme
   a conectividade do ambiente; a conexão não é uma chave de API.
3. Execute na raiz do projeto:

```powershell
npm run db:seed
npm run db:seed
```

O comando carrega `.env.local` pelo Node 24 e exige `DATABASE_URL`. Sua ausência
retorna código 1, sem declarar sucesso nem simular gravação. A conexão remota
usa TLS com validação de certificado; não desative a verificação. Se necessário,
configure a CA confiável do projeto no ambiente Node. A URL aceita somente o
parâmetro opcional `sslmode=verify-full`; senhas devem estar codificadas para URL.
Não há impressão de URLs, senhas, erros brutos do driver ou conteúdo das tabelas.

O seed usa exclusivamente o snapshot revisado em `vct-2027.ts`: quatro regiões,
uma temporada, 32 organizações e 32 participações `partner`. Preserva os UUIDs
locais de organizações e temporada. Regiões são resolvidas pelo slug, aproveitando
UUIDs existentes; IDs novos de região/participação são gerados pelo PostgreSQL
apenas na primeira inserção.

Todas as inserções ocorrem na mesma transação, com lock consultivo para serializar
execuções do seed e limites de espera. O seed **só insere ausentes**:

- Regiões: conflito por slug mantém o registro existente.
- Temporada/organizações: conflito pelo UUID mantém o registro existente.
- Participações: conflito por organização + temporada mantém o vínculo existente.
- IDs diferentes para o mesmo ano/slug impedem a inserção e revertem a transação.
  A temporada com UUID do snapshot deve continuar sendo 2027.
- Reexecução preserva renomeações, categorias, revisões, rascunhos, timestamps,
  equipes extras, outras temporadas e a trilha de auditoria. Não republica um
  registro que foi despublicado. Não cria jogadores, vínculos de elenco ou admins.

Novos registros do catálogo são publicados pelo seed. Em banco vazio são oito
parceiras por região; essa contagem valida o snapshot, não limita o banco nem
força um banco já editado a voltar à composição inicial. Conflitos de identidade
exigem revisão dos dados existentes; não há limpeza destrutiva automática.
Se a conexão cair durante o commit, o resultado pode ser incerto: reconecte e
execute novamente; a operação é idempotente.

## Leitura e limites

`PublicDatabase` descreve apenas a projeção de leitura das quatro tabelas;
`Insert`/`Update` são `never`, mas a proteção efetiva continua sendo grants/RLS.
As consultas pedem somente colunas do catálogo e `publication_status=published`,
com paginação ordenada e timeout. Zod valida os dados recebidos, e o adaptador
resolve UUID de região para o slug do domínio, sem mudar IDs de organizações.
Qualificatórias, visitantes e mais de oito equipes continuam permitidos.

O proxy das equipes faz uma consulta pública curta de existência para definir
HTTP 404; a página renderiza o componente de recuperação diretamente. Isso
contorna o HTML vazio de `notFound()` observado no Next 16.3.4 em rotas dinâmicas.
Falha nessa consulta resulta em HTTP 503. Home/regiões exibem indisponibilidade
com HTTP 200. As consultas por tabela e a verificação do proxy não compartilham
um snapshot transacional: alterações simultâneas podem exigir nova requisição;
uma resposta inconsistente é recusada, sem inventar dados.

Jogadores, elencos e mudanças recentes continuam com fontes locais vazias.
Esta tarefa integra somente regiões, temporadas, organizações e participações.
Não há interface de escrita, login, criação de admins nem sincronização automática.

## Verificações e evidências

```powershell
npm test
npm run check
npm run build
node scripts/verify-catalog-integration.mjs --http-only
node scripts/verify-catalog-integration.mjs --remote --http-only --skip-build
```

O último comando usa o build existente, inicia um PostgreSQL/PGlite isolado,
aplica migrations e o seed duas vezes e fornece um adaptador HTTP de teste para
as consultas públicas. O servidor Next recebe configuração somente no processo
de teste. Nenhum arquivo `.env.local` é criado. Portas temporárias: 3019 para
Next e 54329 para o adaptador; os processos são encerrados no `finally`.
Use um build sem configuração pública para esse teste isolado: variáveis já
incorporadas em outro build podem apontar para outro projeto.

Em ambiente que permita subprocessos de build, omitir `--skip-build` compila
com a configuração do adaptador antes do teste. Omitir `--http-only` executa
Playwright; no modo local, roda as quatro suítes existentes. Evidências são
gravadas em `artifacts/task-09/`, preservando as tarefas anteriores.

Validação realizada em 05/11/2026:

- 68 testes passaram, incluindo seed repetido com igualdade de snapshots/logs,
  rollback, RLS real e SDK Supabase com transporte controlado.
- Lint, TypeScript e build sem credenciais passaram.
- HTTP local: home, quatro regiões, 32 perfis e 404 com HTML de recuperação.
- HTTP integrado: seed + RLS + cliente Supabase + páginas reais; nome e metadados
  atualizados, contagens após despublicação, ausência de rascunhos, 404,
  temporada vazia, falha do serviço e recuperação sem JavaScript. Uma marca
  privada em `DATABASE_URL` não apareceu no HTML nem no JavaScript servido.
- Edge headless foi bloqueado por `spawn EPERM`; nenhuma nova validação visual,
  hidratação ou axe foi concluída nesta tarefa.
- A tentativa de build com configuração fictícia também encontrou `spawn EPERM`
  após compilar. A integração HTTP passou usando o build sem credenciais com
  configuração no processo servidor; não se alega aprovação daquele build.

Não havia credenciais reais nem conexão Supabase disponível. O adaptador HTTP
não é PostgREST real; testes com projeto remoto, TLS real, driver PostgreSQL
pela rede e concorrência entre conexões permanecem pendentes. O SQL do seed
foi executado de verdade no PostgreSQL isolado, sem persistência fictícia no app.
