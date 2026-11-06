-- Task 12. No seed or remote provisioning. RPCs run as the user, under RLS.
begin;

alter table public.team_seasons add column archived_at timestamptz;
alter table public.team_seasons add constraint archived_participation_is_private
  check (archived_at is null or (isfinite(archived_at) and publication_status = 'draft'));
comment on column public.team_seasons.archived_at is 'Archived participation, retained with all memberships and audit history. Restore explicitly.';

create function public.admin_save_team_season(payload jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  row_id uuid := nullif(payload->>'id', '')::uuid;
  old_row public.team_seasons;
  desired text := payload->>'state';
  org_id uuid := (payload->>'organization_id')::uuid;
  season_id_value uuid := (payload->>'season_id')::uuid;
  region_id_value uuid := (payload->>'region_id')::uuid;
begin
  if not private.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if desired is null or desired not in ('draft','published','archived')
    or org_id is null or season_id_value is null or region_id_value is null
    or payload->>'partner_status' is null then
    raise exception 'Invalid participation' using errcode = '22023';
  end if;
  if row_id is not null then
    select * into old_row from public.team_seasons where id = row_id for update;
    if not found then raise exception 'Missing participation' using errcode = 'P0002'; end if;
    if old_row.updated_at is distinct from nullif(payload->>'expected_updated_at','')::timestamptz then
      raise exception 'Stale participation' using errcode = '40001';
    end if;
    if old_row.organization_id <> org_id or old_row.season_id <> season_id_value then
      raise exception 'Immutable participation identity' using errcode = '23514';
    end if;
  end if;
  if desired = 'published' and (
    not exists(select 1 from public.organizations where id = org_id and publication_status = 'published')
    or not exists(select 1 from public.seasons where id = season_id_value and publication_status = 'published')
    or not exists(select 1 from public.regions where id = region_id_value and publication_status = 'published')
  ) then raise exception 'Publish dependencies first' using errcode = 'P0001'; end if;
  if row_id is null then
    insert into public.team_seasons(organization_id, season_id, region_id, partner_status, publication_status, published_at, archived_at)
    values (org_id, season_id_value, region_id_value, (payload->>'partner_status')::public.partner_status,
      (case when desired = 'published' then 'published' else 'draft' end)::public.publication_status,
      case when desired = 'published' then now() end, case when desired = 'archived' then now() end)
    returning id into row_id;
  else
    update public.team_seasons set region_id = region_id_value, partner_status = (payload->>'partner_status')::public.partner_status,
      publication_status = (case when desired = 'published' then 'published' else 'draft' end)::public.publication_status,
      published_at = case when desired = 'published' then coalesce(old_row.published_at, now()) end,
      archived_at = case when desired = 'archived' then coalesce(old_row.archived_at, now()) end
    where id = row_id;
  end if;
  return row_id;
end;
$$;

create function public.admin_save_organization(payload jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  row_id uuid := nullif(payload->>'id', '')::uuid;
  old_row public.organizations;
  desired public.publication_status := (payload->>'publication_status')::public.publication_status;
  logo text := nullif(btrim(payload->>'logo_url'), '');
begin
  if not private.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if desired is null or coalesce(length(btrim(payload->>'name')),0) not between 1 and 160
    or coalesce(length(payload->>'slug'),0) not between 1 and 100
    or length(coalesce(payload->>'short_name','')) > 24
    or (logo is not null and (length(logo) > 2048 or logo !~ '^(https://[^/@[:space:]]+[^[:space:]]*|/[^/[:space:]][^[:space:]]*)$')) then
    raise exception 'Invalid organization' using errcode = '22023';
  end if;
  if row_id is null then
    insert into public.organizations(name, slug, short_name, logo_url, publication_status, published_at)
    values(btrim(payload->>'name'), payload->>'slug', nullif(btrim(payload->>'short_name'),''), logo, desired,
      case when desired = 'published' then now() end) returning id into row_id;
    -- Initial participation is part of this transaction, including uniqueness and FK checks.
    perform public.admin_save_team_season(jsonb_build_object('organization_id',row_id,
      'season_id',payload->>'season_id','region_id',payload->>'region_id',
      'partner_status',payload->>'partner_status','state',desired));
  else
    select * into old_row from public.organizations where id = row_id for update;
    if not found then raise exception 'Missing organization' using errcode = 'P0002'; end if;
    if old_row.updated_at is distinct from nullif(payload->>'expected_updated_at','')::timestamptz then
      raise exception 'Stale organization' using errcode = '40001';
    end if;
    update public.organizations set name = btrim(payload->>'name'), slug = payload->>'slug',
      short_name = nullif(btrim(payload->>'short_name'),''), logo_url = logo, publication_status = desired,
      published_at = case when desired = 'published' then coalesce(old_row.published_at, now()) end where id = row_id;
  end if;
  return row_id;
end;
$$;

create function public.admin_save_season(payload jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  row_id uuid := nullif(payload->>'id','')::uuid;
  old_row public.seasons;
  desired public.publication_status := (payload->>'publication_status')::public.publication_status;
begin
  if not private.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if desired is null or coalesce(length(btrim(payload->>'name')),0) not between 1 and 160 or payload->>'year' is null then
    raise exception 'Invalid season' using errcode = '22023';
  end if;
  if row_id is null then
    insert into public.seasons(year,name,publication_status,published_at)
    values((payload->>'year')::integer,btrim(payload->>'name'),desired,case when desired = 'published' then now() end)
    returning id into row_id;
  else
    select * into old_row from public.seasons where id = row_id for update;
    if not found then raise exception 'Missing season' using errcode = 'P0002'; end if;
    if old_row.updated_at is distinct from nullif(payload->>'expected_updated_at','')::timestamptz then
      raise exception 'Stale season' using errcode = '40001';
    end if;
    -- A season year is its historical identity; rename or change visibility, never reassign its year.
    if old_row.year <> (payload->>'year')::integer then raise exception 'Immutable season year' using errcode = '23514'; end if;
    update public.seasons set name = btrim(payload->>'name'), publication_status = desired,
      published_at = case when desired = 'published' then coalesce(old_row.published_at, now()) end where id = row_id;
  end if;
  return row_id;
end;
$$;

revoke all on function public.admin_save_organization(jsonb), public.admin_save_team_season(jsonb), public.admin_save_season(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.admin_save_organization(jsonb), public.admin_save_team_season(jsonb), public.admin_save_season(jsonb) to authenticated;
commit;
