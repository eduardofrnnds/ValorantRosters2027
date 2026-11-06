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

**GitHub publicado:** [eduardofrnnds/ValorantRosters2027](https://github.com/eduardofrnnds/ValorantRosters2027).
Repositório público, branch `main`, origem HTTPS configurada e código enviado.
A API confirmou `private: false` e o commit inicial
`fbfd26039026fcc7e23ff207df88034a4ad3df7e`, com autor e committer
`eduardofrnnds`, sem coautores. O login GitHub foi confirmado após a ação do usuário.

**Vercel pendente:** nenhuma implantação ou URL confirmada. A CLI ainda precisa
ser instalada/autenticada; a continuação da instalação interativa foi recusada
pela política de permissões do executor. O usuário pode executar
`npx --yes vercel login` no PowerShell local para preparar o acesso. Nenhum token
ou senha deve ser colocado neste documento ou enviado pelo chat.

O pedido de repositório público e deploy já está autorizado; não é necessária
uma nova confirmação de intenção.

Sem configuração Supabase, a implantação disponível é o catálogo público local
somente leitura, com administração indisponível. Nenhuma credencial Supabase foi
fornecida ou inventada. Configuração de banco/Auth/Storage permanece separada,
conforme [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md).

Após preparar o acesso Vercel: conectar o projeto ao repositório, implantar com Node 24 e
verificar a URL HTTPS. Registrar aqui somente URLs e resultados confirmados.
