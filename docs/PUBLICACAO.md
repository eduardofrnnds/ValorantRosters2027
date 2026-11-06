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

**Vercel publicada:** [valorant-rosters-2027.vercel.app](https://valorant-rosters-2027.vercel.app).
Projeto `valorant-rosters-2027`, conectado ao repositório GitHub; push em `main`
disparou automaticamente a implantação de produção. Deploy confirmado como
`READY`: `dpl_AXtvXHkcbuN8edcUVJG9XMjhMAKw`, commit `e622b3e`.
Build Next.js e TypeScript aprovados na Vercel; runtime confirmado `nodejs24.x`.

O primeiro deploy falhou porque o projeto havia sido criado com preset genérico
e esperava uma pasta `public`. `vercel.json` passou a definir `nextjs`, `npm ci`
e `npm run build`; o novo build publicou corretamente. O campo `engines` do
pacote determina Node 24, mesmo com o padrão 26 do painel.

Verificação HTTPS anônima: home, quatro regiões, equipe 100 Thieves,
transferências e login retornaram 200; `/admin` redirecionou com 303; rota
inexistente retornou 404 em português; favicon, CSS e JavaScript responderam 200.
O login está desabilitado e protegido contra cache, conforme a falta de Supabase.
Evidências locais em `artifacts/deploy/`, excluídas do repositório.

O pedido de repositório público e deploy já está autorizado; não é necessária
uma nova confirmação de intenção.

Sem configuração Supabase, a implantação disponível é o catálogo público local
somente leitura, com administração indisponível. Nenhuma credencial Supabase foi
fornecida ou inventada. Configuração de banco/Auth/Storage permanece separada,
conforme [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md).

## Atualização de segurança pendente

O build remoto e uma nova execução local de `npm audit --json` reportaram
**nove pacotes vulneráveis: oito moderados e um crítico**. Isso substitui a
consulta de zero alertas registrada na Tarefa 17. O Next.js instalado é 16.3.4;
os avisos incluem execução remota de código em recursos de imagem/cache.
Não foi demonstrada exploração da aplicação. A auditoria também apontou a
dependência de desenvolvimento `minimatch` na cadeia do TypeScript ESLint.

A atualização para `next@16.4.5` e `eslint-config-next@16.4.5` foi tentada, mas
o npm deste executor recusou a consulta ao registry com `ENOTCACHED`, em modo
`only-if-cached`. O pacote/lockfile permaneceram inalterados. Não foi usado
`npm audit fix --force` nem feita migração automática para Next 15.

No PowerShell local, na raiz do projeto, execute:

```powershell
npm install --save-exact next@16.4.5 eslint-config-next@16.4.5
```

Depois, repetir `npm run check`, `npm test`, `npm run build`, os testes de
integração/release e `npm audit --json`; revisar qualquer alerta remanescente
antes de enviar o lockfile e promover o novo deploy. A atualização proposta
ainda não foi instalada ou validada, e não representa garantia de zero alertas.

Referências: [aviso de imagem Next.js](https://github.com/advisories/GHSA-2464-fhr4-w9xw),
[aviso de cache Next.js](https://github.com/advisories/GHSA-673q-mjm6-r5xr) e
[aviso minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249).
