-- Task 15: one transaction publishes a saved draft. No inter-team transfer RPC.
begin;
alter table public.roster_memberships
  add column role public.player_role,
  add column role_is_explicit boolean not null default false,
  add constraint membership_explicit_role check (role_is_explicit or role is null);
alter table public.roster_drafts
  add column published_by uuid references auth.users(id),
  add column publication_source_url text,
  add column publication_expected_at timestamptz;
alter table public.roster_changes
  add column draft_id uuid references public.roster_drafts(id),
  add column published_by uuid references auth.users(id),
  add column source_url text,
  add column before_snapshot jsonb,
  add column after_snapshot jsonb,
  add constraint change_once_per_draft unique(draft_id,player_id);

create or replace function private.roster_snapshot(team_id uuid, effective_on date) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'player_id',m.player_id,
    'status',m.status,'role',case when m.role_is_explicit then m.role else p.role end,
    'start_date',m.start_date,'end_date',m.end_date,'updated_at',m.updated_at) order by m.id),'[]'::jsonb)
  from public.roster_memberships m join public.players p on p.id=m.player_id
  where m.team_season_id=team_id and m.publication_status='published'
    and m.start_date<=effective_on and (m.end_date is null or m.end_date>=effective_on);
$$;

-- Only this tiny helper needs elevated rights: authenticated has no UPDATE grant
-- on the allowlist, required by SELECT FOR SHARE. Revocation waits for commit.
create function private.lock_active_admin() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.admin_users where user_id=auth.uid() and is_active for share;
  if not found then raise exception 'Admin required' using errcode='42501'; end if;
end;
$$;
revoke all on function private.lock_active_admin() from public,anon,authenticated,service_role;
grant execute on function private.lock_active_admin() to authenticated;

create function private.preserve_published_draft() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if old.status='published' then raise exception 'Published draft is immutable' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function private.preserve_published_draft() from public,anon,authenticated,service_role;
create trigger preserve_published_draft before update on public.roster_drafts
for each row execute function private.preserve_published_draft();

create function public.admin_publish_roster_draft(input jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  draft_id_value uuid := (input->>'id')::uuid;
  expected timestamptz := (input->>'expected_updated_at')::timestamptz;
  source_value text := nullif(btrim(input->>'source_url'),'');
  draft public.roster_drafts;
  team public.team_seasons;
  team_id uuid;
  season_id_value uuid;
  effective_on date;
  old_entry jsonb;
  new_entry jsonb;
  before_value jsonb;
  after_value jsonb;
  old_id uuid;
  new_id uuid;
  player_id_value uuid;
  end_value date;
  status_value public.roster_status;
  role_value public.player_role;
  changed_count integer := 0;
begin
  perform private.lock_active_admin();
  if input->>'confirm' is distinct from 'publish' or draft_id_value is null or expected is null
    or not isfinite(expected) or (source_value is not null and
      (length(source_value)>2048 or source_value !~ '^https://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$')) then
    raise exception 'Invalid publication confirmation' using errcode='22023';
  end if;
  select d.team_season_id,t.season_id into team_id,season_id_value
    from public.roster_drafts d join public.team_seasons t on t.id=d.team_season_id where d.id=draft_id_value;
  if not found then raise exception 'Missing draft' using errcode='P0002'; end if;
  -- Same lock order as draft saves, serializing publications in one season.
  perform 1 from public.seasons where id=season_id_value for update;
  select * into team from public.team_seasons where id=team_id for update;
  select * into draft from public.roster_drafts where id=draft_id_value for update;
  if draft.status='published' then
    if draft.publication_expected_at is distinct from expected or draft.publication_source_url is distinct from source_value then
      raise exception 'Different publication request' using errcode='40001';
    end if;
    return jsonb_build_object('id',draft.id,'team_season_id',team.id,'already_published',true);
  end if;
  if draft.status<>'draft' or draft.updated_at is distinct from expected then
    raise exception 'Stale draft' using errcode='40001';
  end if;
  perform 1 from public.organizations where id=team.organization_id and publication_status='published' for share;
  if not found then raise exception 'Organization not published' using errcode='P0001'; end if;
  perform 1 from public.regions where id=team.region_id and publication_status='published' for share;
  if not found or team.publication_status<>'published' or team.archived_at is not null
    or not exists(select 1 from public.seasons where id=season_id_value and publication_status='published') then
    raise exception 'Participation not public' using errcode='P0001';
  end if;
  -- Lock profiles and existing memberships before taking the authoritative snapshot.
  perform 1 from public.players p where p.id in (
    select (value->>'player_id')::uuid from jsonb_array_elements(draft.payload->'members')
    union select m.player_id from public.roster_memberships m where m.team_season_id=team.id
  ) order by p.id for share;
  perform 1 from public.roster_memberships where team_season_id=team.id order by id for update;
  -- Reuse all SQL draft validation, including revision, snapshot and starter conflicts.
  perform public.admin_save_roster_draft(jsonb_build_object('id',draft.id,'team_season_id',team.id,
    'expected_updated_at',expected,'base_revision',draft.base_revision,'payload',draft.payload));
  effective_on := (draft.payload->>'effective_on')::date;

  for player_id_value in
    select (value->>'player_id')::uuid from jsonb_array_elements(draft.payload->'base_members')
    union select (value->>'player_id')::uuid from jsonb_array_elements(draft.payload->'members')
  loop
    select value into old_entry from jsonb_array_elements(draft.payload->'base_members') where (value->>'player_id')::uuid=player_id_value;
    select value into new_entry from jsonb_array_elements(draft.payload->'members') where (value->>'player_id')::uuid=player_id_value;
    if new_entry is not null and not exists(select 1 from public.players where id=player_id_value and publication_status='published') then
      raise exception 'Player not published' using errcode='P0001';
    end if;
    if old_entry is not null and new_entry is not null and old_entry->'status'=new_entry->'status' and old_entry->'role'=new_entry->'role' then continue; end if;
    old_id := (old_entry->>'id')::uuid;
    new_id := null; before_value := null; after_value := null;
    end_value := (old_entry->>'end_date')::date;
    status_value := (new_entry->>'status')::public.roster_status;
    role_value := (new_entry->>'role')::public.player_role;
    if old_id is not null then
      if (old_entry->>'start_date')::date>=effective_on then
        raise exception 'Existing membership needs a later effective date' using errcode='P0001';
      end if;
      select to_jsonb(m) into before_value from public.roster_memberships m where id=old_id;
      before_value := before_value || jsonb_build_object('effective_role',old_entry->'role');
      -- Freeze the legacy fallback when closing a membership, preserving its role.
      update public.roster_memberships set end_date=effective_on-1,role=(old_entry->>'role')::public.player_role,role_is_explicit=true where id=old_id;
    end if;
    if new_entry is not null then
      if exists(select 1 from public.roster_memberships m where m.player_id=player_id_value
        and m.team_season_id=team.id and m.publication_status='published'
        and (end_value is null or m.start_date<=end_value) and (m.end_date is null or m.end_date>=effective_on)) then
        raise exception 'Overlapping membership in this team' using errcode='P0001';
      end if;
      if status_value='starter' and exists(select 1 from public.roster_memberships m join public.team_seasons t on t.id=m.team_season_id
        where m.player_id=player_id_value and t.season_id=season_id_value and t.id<>team.id
          and m.publication_status='published' and m.status='starter'
          and (end_value is null or m.start_date<=end_value) and (m.end_date is null or m.end_date>=effective_on)) then
        raise exception 'Starter interval conflicts in another team' using errcode='P0001';
      end if;
      insert into public.roster_memberships(player_id,team_season_id,status,role,role_is_explicit,start_date,end_date,publication_status,published_at)
        values(player_id_value,team.id,status_value,role_value,true,effective_on,end_value,'published',now()) returning id into new_id;
      select to_jsonb(m) into after_value from public.roster_memberships m where id=new_id;
    else
      select to_jsonb(m) into after_value from public.roster_memberships m where id=old_id;
    end if;
    after_value := after_value || jsonb_build_object('effective_role',after_value->'role');
    insert into public.roster_changes(player_id,from_membership_id,to_membership_id,change_type,occurred_on,summary,
      publication_status,published_at,draft_id,published_by,source_url,before_snapshot,after_snapshot)
    values(player_id_value,old_id,new_id,
      case when old_id is null then 'joined'::public.roster_change_type when new_id is null then 'left'::public.roster_change_type else 'status_changed'::public.roster_change_type end,
      effective_on,case when old_id is null then 'Entrada no elenco' when new_id is null then 'Saída do elenco' else 'Alteração de status ou função no elenco' end,
      'published',now(),draft.id,auth.uid(),source_value,before_value,after_value);
    changed_count := changed_count+1;
  end loop;
  if changed_count=0 then raise exception 'No roster changes to publish' using errcode='22023'; end if;
  update public.team_seasons set roster_revision=roster_revision+1 where id=team.id;
  update public.roster_drafts set status='published',published_at=now(),published_by=auth.uid(),
    publication_source_url=source_value,publication_expected_at=expected where id=draft.id;
  return jsonb_build_object('id',draft.id,'team_season_id',team.id,'already_published',false);
end;
$$;
revoke all on function public.admin_publish_roster_draft(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.admin_publish_roster_draft(jsonb) to authenticated;
commit;
