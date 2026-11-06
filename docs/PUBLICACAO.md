# Publicação GitHub e Vercel

Pedido de 06/11/2026: publicar o código em repositório **público** no GitHub e
implantar na Vercel. O usuário solicitou ser o único autor dos commits.

## Preparação local

- Git inicializado na branch `main`.
- Autor e committer configurados localmente como `Eduardo Fernandes`, com
  `118359738+eduardofrnnds@users.noreply.github.com`.
- Nenhum trailer de coautoria adicionado.
- Artefatos de teste, arquivos de ambiente reais, credenciais, caches e
  configurações locais excluídos pelo `.gitignore`/`.vercelignore`.
- Aplicação validada na [revisão final](REVISAO_FINAL_V1.md); o código da
  aplicação não foi alterado nesta preparação de publicação.

## Estado da publicação

**Ainda não publicado.** Não há URL de repositório remoto ou de implantação
confirmada. O acesso CLI ao GitHub falhou ao conectar ao proxy do ambiente
(`127.0.0.1:9`). O diagnóstico de autenticação também informou token inválido,
mas, com a conectividade bloqueada, sua validade precisa ser reconferida.
A continuação da instalação/execução da CLI Vercel foi recusada pela política
de permissões do executor.
O comando `git add .` também foi bloqueado ao criar `.git/index.lock`
(`Permission denied`), portanto nenhum commit foi criado. A identidade local
foi configurada, mas a gravação do índice e o commit ainda precisam ser feitos.

As integrações GitHub e Vercel foram encontradas, porém não estavam instaladas
nem conectadas na verificação. A publicação depende de disponibilizar essas
conexões ou um executor com acesso aos serviços. O pedido de publicação já está
autorizado; não é necessária uma nova confirmação de intenção.

Sem configuração Supabase, a implantação disponível é o catálogo público local
somente leitura, com administração indisponível. Nenhuma credencial Supabase foi
fornecida ou inventada. Configuração de banco/Auth/Storage permanece separada,
conforme [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md).

Após restabelecer o acesso: criar o commit somente com a identidade acima,
verificar a conta, criar o repositório público,
enviar `main`, conectar o projeto Vercel ao repositório, implantar com Node 24 e
verificar a URL HTTPS. Registrar aqui somente URLs e resultados confirmados.
