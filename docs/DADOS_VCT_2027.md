# Dados iniciais — VCT 2027

O arquivo `src/features/organizations/data/vct-2027.ts` é um snapshot local
mantido manualmente: quatro regiões, temporada 2027, 32 organizações e 32
participações `partner`, exatamente oito por região. Ele não contém jogadores,
elencos, transferências ou estatísticas. Os logos estão em `public/images/teams/`,
obtidos das páginas das organizações no VLR.gg; fontes e hashes estão em `docs/VLR_ASSETS.json`.

Os jogadores e técnicos ficam em um snapshot separado, descrito em
[ELENCOS_VLR.md](ELENCOS_VLR.md), consultado em 07/11/2026. Não há garantia de
escalações finais de 2027 nem inferência de datas de contratos.

## Fontes e conferência

Conferência manual em **03/11/2026**, com anúncios de **22/10/2026**:

- [Riot — Introducing the VCT 2027 Partner Teams](https://valorantesports.com/en-US/valorantesports/news/introducing-the-vct-2027-partner-teams):
  confirma 32 parceiras e oito em cada uma das quatro regiões. O texto também
  distingue parceria de acesso a eventos por classificatórias.
- [Esports Charts — lista de parceiras por região](https://escharts.com/news/partner-teams-vct-2027):
  a tabela coincide com as 32 organizações enumeradas no plano do projeto.

Os nomes de exibição seguem o plano, incluindo `KRÜ Esports`, `Leviatán`,
`EDward Gaming`, `FULL SENSE` e `Gen.G`. A fonte secundária usa `Full Sense`;
a diferença é apenas de capitalização. `Rex Regum Qeon (RRQ)` no plano foi
armazenado como nome `Rex Regum Qeon`. Todas as siglas permanecem opcionais e
omitidas até conferência específica; não foram derivadas automaticamente dos nomes.
Slugs são identificadores de URL locais (ex.: `kru-esports`, `leviatan`, `gen-g`),
não alegações de URLs ou siglas oficiais.

As URLs e datas ficam também em `vct2027Sources`. Não há leitura de fontes na
execução ou sincronização automática. `node scripts/download-vlr-logos.mjs` permite
baixar novamente os logos sob demanda. A referência de formato incompleta
do plano não foi usada nem necessária para esta tarefa.

## Contratos

Os tipos compartilhados estão em `src/types/vct.ts`:

| Tipo | Responsabilidade |
| --- | --- |
| `Region` / `RegionId` | Americas, EMEA, China e Pacific, com ID, slug e nome |
| `Season` | Identidade da temporada, nome e ano |
| `Organization` | ID estável, nome, slug, sigla e logo opcionais |
| `PartnerStatus` | `partner`, `qualifier` ou `visitor` |
| `TeamSeason` | Organização + temporada + região + categoria |
| `VctCatalog` | Conjunto tipado das quatro coleções |

Região e categoria pertencem à participação por temporada. Uma organização
renomeada conserva seu ID; em uma temporada posterior, pode ter outra categoria.
Os UUIDs locais de organizações e temporada foram atribuídos uma vez e estão
fixos no arquivo, sem geração durante a execução. Preservá-los em futuras
renomeações e na integração com o banco. Não são IDs oficiais da Riot.

O catálogo e seus registros têm contratos TypeScript `readonly`. Não há API
de gravação, estado mutável de edição ou persistência simulada. Essa tipagem não
constitui uma barreira de segurança em runtime. Validação de entradas externas,
publicação, RLS e persistência pertencem às tarefas de backend. Este snapshot
contém apenas organizações anunciadas e não tem rascunhos privados.

## Uso e validação

```tsx
import { vct2027, DEFAULT_SEASON_YEAR } from "@/features/organizations/data/vct-2027";

const season = vct2027.seasons.find(({ year }) => year === DEFAULT_SEASON_YEAR);
const entries = vct2027.teamSeasons.filter(
  (entry) => entry.seasonId === season?.id && entry.regionId === "americas",
);
// Resolver cada entry.organizationId em vct2027.organizations.
```

- `npm run data:list`: lista nome, slug, sigla opcional, região, ano e categoria
  no terminal, sem alterar arquivos ou conectar ao Supabase.
- `npm test`: verifica totais, oito por região e correspondência exata com a
  lista do plano, além de unicidade e integridade dos vínculos. Inclui cenários
  inválidos e participações adicionais em cópias isoladas, fora do seed.
- `npm run check`: lint e TypeScript. Os testes usam o suporte nativo a
  TypeScript do Node 24; não foi adicionada dependência de testes.

O projeto declara `type: module` em `package.json`, coerente com os módulos
existentes e com a execução dos arquivos TypeScript pelo Node.

`validateCatalog` verifica dados locais já tipados: IDs/slugs duplicados,
slugs malformados, nomes vazios, anos inválidos, referências ausentes,
categorias desconhecidas e participação repetida da organização na temporada.
Não é um parser para dados arbitrários recebidos de formulários ou rede.

Os limites **32 totais / oito por região** existem somente na validação deste seed.
O validador geral permite mais de oito participantes e as categorias `qualifier`
e `visitor`. Não há equipes classificadas ou visitantes inventadas no catálogo.

A partir da Tarefa 04, a home consome o snapshot por `getRegionSummaries` em
`src/features/organizations/region-summaries.ts`. A função conta organizações
parceiras distintas por região e temporada, excluindo `qualifier`, `visitor`
e outras temporadas; uma temporada ausente gera erro explícito.
Na Tarefa 05, as quatro páginas regionais usam `getRegionOrganizations` em
`src/features/organizations/directory-model.ts` para resolver as participações
da região e temporada. A consulta inclui todas as categorias, não tem limite de
oito e retorna a identidade estável da organização junto com `partnerStatus`.
Referências ausentes ou temporada inexistente geram erros explícitos.

`filterOrganizations` realiza busca local por nome, sigla opcional e slug,
ignorando caixa/acentos e espaços externos; múltiplos termos precisam estar
presentes. A ordenação usa `Intl.Collator("pt-BR")` com ordem crescente ou
decrescente e não altera o catálogo. As categorias são apresentadas como
Parceira, Qualificatória e Visitante. Nenhuma equipe extra foi adicionada ao seed.

O servidor entrega ao componente interativo somente as organizações daquela
região/temporada. A listagem completa já está no HTML inicial. Os controles
dependem de JavaScript e são ocultos quando ele está desativado; os links de
navegação continuam funcionando. Busca/ordenação não são persistidas na URL.

Na Tarefa 06, `/team/[slug]` usa `getTeamProfile` para resolver identidade e
participação por ID estável e temporada. Mostra nome, região, categoria,
logo/fallback e ano; slug desconhecido retorna 404 com link de recuperação.

`src/features/rosters/roster-model.ts` define somente o contrato local de exibição:
`PlayerCardData` (ID, slug, nickname) e `RosterEntry` (organização, temporada,
status de elenco e status de publicação). Não substitui o schema futuro do banco.
`getPublishedRosterGroups` seleciona apenas `published` da organização/temporada
solicitadas e agrupa titulares, reservas, inativos e técnicos, ordenando por nickname
sem alterar a entrada. A página executa essa consulta no servidor.

A fonte `src/features/rosters/data/local-roster.ts` está vazia. As quatro seções
de elenco e o Histórico exibem ausência de publicações, sem afirmar que uma
organização real não tem jogadores. Não há fonte de mudanças integrada; o bloco
da home e o histórico permanecem vazios até as tarefas de publicação. Dados
sintéticos existem apenas em testes isolados, nunca no catálogo ou nas páginas.
O link do cartão reutilizável usa slug; sua chave usa ID. Na Tarefa 07,
`PlayerCardData` passou a derivar da identidade `Player` e a rota individual foi
implementada com fonte vazia. O [contrato de perfis](PERFIS_JOGADORES.md) descreve
identidade, datas e histórico de carreira. Autorização, RLS e publicação
persistida continuam dependendo das tarefas de backend.

A Tarefa 08 preparou [migrations PostgreSQL](SCHEMA_POSTGRESQL.md) com UUIDs,
participações sem limite de oito equipes, auditoria e RLS. A Tarefa 09 integra
home, regiões e equipes ao serviço `getPublicCatalog`, com leitura anônima
Supabase quando configurado e fallback local somente sem configuração.
`mapPublicCatalog` valida respostas externas com Zod e resolve UUIDs de regiões
para slugs do domínio. As funções de contagem e consulta descritas acima são
reutilizadas com a fonte selecionada pelo serviço.

O seed `npm run db:seed` preserva UUIDs de organizações/temporada, reutiliza
regiões pelo slug e insere apenas ausentes em transação. Não modifica edições,
rascunhos ou equipes extras. Foi executado em PostgreSQL isolado nos testes;
nenhum projeto remoto foi acessado. Consulte [SUPABASE_SEED.md](SUPABASE_SEED.md)
para execução real, limites e evidências.
