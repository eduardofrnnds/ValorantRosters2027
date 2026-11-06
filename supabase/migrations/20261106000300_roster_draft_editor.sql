-- Task 14: only private drafts change. No roster publication or transfer function.
begin;
create function private.roster_snapshot(team_id uuid, effective_on date) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'player_id',m.player_id,
    'status',m.status,'role',p.role,'start_date',m.start_date,'end_date',m.end_date,
    'updated_at',m.updated_at) order by m.id), '[]'::jsonb)
  from public.roster_memberships m join public.players p on p.id=m.player_id
  where m.team_season_id=team_id and m.publication_status='published'
    and m.start_date <= effective_on and (m.end_date is null or m.end_date >= effective_on);
$$;
revoke all on function private.roster_snapshot(uuid,date) from public, anon, authenticated, service_role;
grant execute on function private.roster_snapshot(uuid,date) to authenticated;

create function public.admin_save_roster_draft(input jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  row_id uuid := (input->>'id')::uuid;
  team_id uuid := (input->>'team_season_id')::uuid;
  expected timestamptz := nullif(input->>'expected_updated_at','')::timestamptz;
  revision bigint := (input->>'base_revision')::bigint;
  proposal jsonb := input->'payload';
  effective_on date := (proposal->>'effective_on')::date;
  season_id_value uuid;
  team public.team_seasons;
  old_row public.roster_drafts;
  snapshot jsonb;
  entry jsonb;
  player_id_value uuid;
  role_value public.player_role;
  status_value public.roster_status;
begin
  if not private.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if row_id is null or team_id is null or revision is null or revision < 0 or effective_on is null or not isfinite(effective_on)
    or jsonb_typeof(proposal) is distinct from 'object' or proposal->>'version' is distinct from '1'
    or jsonb_typeof(proposal->'members') is distinct from 'array'
    or jsonb_typeof(proposal->'base_members') is distinct from 'array' then
    raise exception 'Invalid draft' using errcode = '22023';
  end if;
  if jsonb_array_length(proposal->'members') > 200 or jsonb_array_length(proposal->'base_members') > 200 then
    raise exception 'Draft too large' using errcode = '22023';
  end if;
  select season_id into season_id_value from public.team_seasons where id=team_id;
  if not found then raise exception 'Missing participation' using errcode = '23503'; end if;
  -- Serialize saves across the season so two concurrent drafts cannot claim the same starter.
  perform 1 from public.seasons where id=season_id_value for update;
  select * into team from public.team_seasons where id=team_id for update;
  if team.archived_at is not null then raise exception 'Archived participation' using errcode = 'P0001'; end if;
  if team.roster_revision <> revision then raise exception 'Stale roster revision' using errcode = '40001'; end if;
  snapshot := private.roster_snapshot(team_id,effective_on);
  if snapshot is distinct from proposal->'base_members' then raise exception 'Stale roster snapshot' using errcode = '40001'; end if;
  if expected is null then
    if exists(select 1 from public.roster_drafts where team_season_id=team_id and status='draft') then
      raise exception 'Open draft exists' using errcode = '23505';
    end if;
  else
    select * into old_row from public.roster_drafts where id=row_id for update;
    if not found then raise exception 'Missing draft' using errcode = 'P0002'; end if;
    if old_row.updated_at is distinct from expected or old_row.status <> 'draft' or old_row.base_revision <> revision
      or old_row.team_season_id <> team_id or old_row.payload->>'version' is distinct from '1'
      or old_row.payload->>'effective_on' is distinct from proposal->>'effective_on'
      or old_row.payload->'base_members' is distinct from proposal->'base_members' then
      raise exception 'Stale or incompatible draft' using errcode = '40001';
    end if;
  end if;
  if (select count(*) from jsonb_array_elements(proposal->'members')) <>
     (select count(distinct value->>'player_id') from jsonb_array_elements(proposal->'members')) then
    raise exception 'Duplicate player' using errcode = '23514';
  end if;
  if exists(select 1 from public.roster_drafts d join public.team_seasons t on t.id=d.team_season_id
    where t.season_id=season_id_value and t.id<>team_id and d.status='draft'
      and d.payload <> '{}'::jsonb and d.payload->>'version' is distinct from '1') then
    raise exception 'Unknown draft format in season' using errcode = 'P0001';
  end if;
  for entry in select value from jsonb_array_elements(proposal->'members') loop
    if jsonb_typeof(entry) <> 'object' or entry->>'status' is null or entry->>'player_id' is null then
      raise exception 'Invalid member' using errcode = '22023';
    end if;
    player_id_value := (entry->>'player_id')::uuid;
    status_value := (entry->>'status')::public.roster_status;
    role_value := (entry->>'role')::public.player_role;
    if not exists(select 1 from public.players where id=player_id_value) then raise exception 'Player not registered' using errcode = '23503'; end if;
    if status_value = 'starter' and (
      exists(select 1 from public.roster_memberships m join public.team_seasons t on t.id=m.team_season_id
        where t.season_id=season_id_value and t.id<>team_id and m.player_id=player_id_value
          and m.publication_status='published' and m.status='starter' and m.start_date <= effective_on
          and (m.end_date is null or m.end_date >= effective_on))
      or exists(select 1 from public.roster_drafts d join public.team_seasons t on t.id=d.team_season_id
        where t.season_id=season_id_value and t.id<>team_id and d.status='draft' and d.payload->>'version'='1'
          and d.payload->'members' @> jsonb_build_array(jsonb_build_object('player_id',player_id_value,'status','starter')))
    ) then raise exception 'Starter conflict in another team' using errcode = 'P0001'; end if;
  end loop;
  if expected is null then
    insert into public.roster_drafts(id,team_season_id,created_by,base_revision,payload)
    values(row_id,team_id,auth.uid(),revision,proposal);
  else
    update public.roster_drafts set payload=proposal where id=row_id;
  end if;
  return row_id;
end;
$$;

create function public.admin_archive_roster_draft(draft_id uuid, expected_updated_at timestamptz) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare existing public.roster_drafts;
begin
  if not private.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  select * into existing from public.roster_drafts where id=draft_id for update;
  if not found then raise exception 'Missing draft' using errcode = 'P0002'; end if;
  if existing.updated_at is distinct from expected_updated_at or existing.status <> 'draft' then
    raise exception 'Stale draft' using errcode = '40001';
  end if;
  update public.roster_drafts set status='archived' where id=draft_id;
  return draft_id;
end;
$$;
revoke all on function public.admin_save_roster_draft(jsonb), public.admin_archive_roster_draft(uuid,timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.admin_save_roster_draft(jsonb), public.admin_archive_roster_draft(uuid,timestamptz) to authenticated;
commit;
