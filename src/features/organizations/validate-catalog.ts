import type { VctCatalog } from "@/types/vct";

/** Checks local, typed data integrity; not an input parser or a database constraint. */
export function validateCatalog(catalog: VctCatalog): string[] {
  const errors: string[] = [];

  function unique(values: readonly (string | number)[], field: string) {
    const seen = new Set<string | number>();
    for (const value of values) {
      if (seen.has(value)) errors.push(`${field} duplicado: ${value}`);
      seen.add(value);
    }
  }

  for (const [label, records] of [
    ["Região", catalog.regions],
    ["Temporada", catalog.seasons],
    ["Organização", catalog.organizations],
  ] as const) {
    unique(records.map((record) => record.id), `${label}: ID`);
    for (const record of records) {
      if (!record.id.trim()) errors.push(`${label}: ID vazio`);
      if (!record.name.trim()) errors.push(`${label}: nome vazio (${record.id})`);
    }
  }

  for (const [label, records] of [
    ["Região", catalog.regions],
    ["Organização", catalog.organizations],
  ] as const) {
    unique(records.map((record) => record.slug), `${label}: slug`);
    for (const record of records) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.slug)) {
        errors.push(`${label}: slug inválido (${record.slug})`);
      }
    }
  }

  unique(catalog.seasons.map((season) => season.year), "Ano da temporada");
  for (const season of catalog.seasons) {
    if (!Number.isInteger(season.year) || season.year < 1) {
      errors.push(`Ano da temporada inválido: ${season.year}`);
    }
  }

  const organizationIds = new Set(catalog.organizations.map(({ id }) => id));
  const seasonIds = new Set(catalog.seasons.map(({ id }) => id));
  const regionIds = new Set(catalog.regions.map(({ id }) => id));
  const memberships = new Set<string>();

  for (const entry of catalog.teamSeasons) {
    const key = JSON.stringify([entry.organizationId, entry.seasonId]);
    if (memberships.has(key)) errors.push(`Participação duplicada: ${key}`);
    memberships.add(key);
    if (!organizationIds.has(entry.organizationId)) errors.push(`Organização inexistente: ${entry.organizationId}`);
    if (!seasonIds.has(entry.seasonId)) errors.push(`Temporada inexistente: ${entry.seasonId}`);
    if (!regionIds.has(entry.regionId)) errors.push(`Região inexistente: ${entry.regionId}`);
    if (!["partner", "qualifier", "visitor"].includes(entry.partnerStatus)) {
      errors.push(`Categoria inválida: ${entry.partnerStatus}`);
    }
  }

  // Counts belong to a specific seed, never to the general catalog model.
  return errors;
}
