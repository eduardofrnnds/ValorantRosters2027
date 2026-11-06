import { vct2027 } from "../../src/features/organizations/data/vct-2027.ts";
import { validateCatalog } from "../../src/features/organizations/validate-catalog.ts";

/** Only the reviewed local snapshot is accepted. No remote/user input becomes SQL. */
export function buildSeedSql() {
  const errors = validateCatalog(vct2027);
  if (errors.length || vct2027.regions.length !== 4 || vct2027.seasons.length !== 1
    || vct2027.seasons[0].year !== 2027 || vct2027.organizations.length !== 32
    || vct2027.teamSeasons.length !== 32
    || vct2027.teamSeasons.some((entry) => entry.partnerStatus !== "partner")
    || vct2027.regions.some((region) => vct2027.teamSeasons.filter((entry) => entry.regionId === region.id).length !== 8)) {
    throw new Error("O snapshot do seed 2027 não corresponde ao contrato 4/1/32/32.");
  }
  const json = JSON.stringify(vct2027).replaceAll("\\", "\\\\").replaceAll("'", "''");
  // Caller MUST execute this entire body in one transaction. The transaction lock
  // serializes concurrent seed runs; uniqueness remains enforced by PostgreSQL.
  return `
set local lock_timeout = '10s';
set local statement_timeout = '30s';
select pg_advisory_xact_lock(2027, 9);
do $seed$
declare
  catalog jsonb := E'${json}'::jsonb;
  item jsonb;
  season_uuid uuid;
begin
  for item in select value from jsonb_array_elements(catalog->'regions') loop
    insert into public.regions (slug, name, publication_status, published_at)
      values (item->>'slug', item->>'name', 'published', now())
      on conflict (slug) do nothing;
  end loop;

  item := catalog->'seasons'->0;
  season_uuid := (item->>'id')::uuid;
  insert into public.seasons (id, year, name, publication_status, published_at)
    values (season_uuid, 2027, item->>'name', 'published', now())
    on conflict (id) do nothing;
  if not exists (select 1 from public.seasons where id = season_uuid and year = 2027) then
    raise exception 'Identidade da temporada incompatível com o seed.';
  end if;

  for item in select value from jsonb_array_elements(catalog->'organizations') loop
    insert into public.organizations (id, slug, name, short_name, logo_url, publication_status, published_at)
      values ((item->>'id')::uuid, item->>'slug', item->>'name', item->>'shortName', item->>'logoUrl', 'published', now())
      on conflict (id) do nothing;
  end loop;

  for item in select value from jsonb_array_elements(catalog->'teamSeasons') loop
    insert into public.team_seasons (organization_id, season_id, region_id, partner_status, publication_status, published_at)
      values ((item->>'organizationId')::uuid, (item->>'seasonId')::uuid,
        (select id from public.regions where slug = item->>'regionId'), 'partner', 'published', now())
      on conflict (organization_id, season_id) do nothing;
  end loop;
end
$seed$;
`;
}
