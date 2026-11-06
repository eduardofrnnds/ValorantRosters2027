import { DEFAULT_SEASON_YEAR, vct2027 } from "../src/features/organizations/data/vct-2027.ts";
import { validateCatalog } from "../src/features/organizations/validate-catalog.ts";

const errors = validateCatalog(vct2027);
if (errors.length) throw new Error(errors.join("\n"));

const season = vct2027.seasons.find(({ year }) => year === DEFAULT_SEASON_YEAR);
if (!season) throw new Error("Temporada padrão ausente.");
const organizations = new Map(vct2027.organizations.map((organization) => [organization.id, organization]));
const participations = vct2027.teamSeasons.filter(({ seasonId }) => seasonId === season.id);

console.log(`${season.name} — catálogo local, somente leitura`);
for (const region of vct2027.regions) {
  const entries = participations.filter(({ regionId }) => regionId === region.id);
  console.log(`\n${region.name}: ${entries.length} organizações`);
  console.table(entries.map((entry) => {
    const organization = organizations.get(entry.organizationId);
    return { nome: organization.name, sigla: organization.shortName ?? "—", slug: organization.slug, ano: season.year, categoria: entry.partnerStatus };
  }));
}
console.log(`\nTotal: ${participations.length} participações. Nenhum dado foi gravado.`);
