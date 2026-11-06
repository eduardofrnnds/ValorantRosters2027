begin;
alter table public.roster_changes add column note text check (length(note)<=1000);
create index roster_changes_timeline on public.roster_changes(occurred_on desc,id desc) where publication_status='published';

-- Request metadata is private, immutable and only used to recognize retries.
create table private.roster_transfer_requests (
  id uuid primary key,
  request jsonb not null,
  change_id uuid not null unique references public.roster_changes(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table private.roster_transfer_requests enable row level security;
revoke all on private.roster_transfer_requests from public,anon,authenticated,service_role;
grant select,insert on private.roster_transfer_requests to authenticated;
create policy transfer_request_read on private.roster_transfer_requests for select to authenticated using(private.is_admin());
create policy transfer_request_insert on private.roster_transfer_requests for insert to authenticated with check(private.is_admin() and created_by=auth.uid());

create function public.admin_transfer_player(input jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  request_id uuid := (input->>'id')::uuid;
  membership_id uuid := (input->>'from_membership_id')::uuid;
  destination_id uuid := (input->>'to_team_season_id')::uuid;
  expected timestamptz := (input->>'expected_membership_updated_at')::timestamptz;
  from_revision bigint := (input->>'expected_from_revision')::bigint;
  to_revision bigint := (input->>'expected_to_revision')::bigint;
  effective_on date := (input->>'effective_on')::date;
  status_value public.roster_status := (input->>'status')::public.roster_status;
  source_value text := nullif(btrim(input->>'source_url'),'');
  note_value text := nullif(btrim(input->>'note'),'');
  origin public.roster_memberships;
  source_team public.team_seasons;
  destination public.team_seasons;
  player public.players;
  previous_request private.roster_transfer_requests;
  role_value public.player_role;
  new_id uuid;
  event_id uuid;
  before_value jsonb;
  after_value jsonb;
begin
  perform private.lock_active_admin();
  if request_id is null or membership_id is null or destination_id is null or expected is null or not isfinite(expected)
    or from_revision is null or from_revision<0 or to_revision is null or to_revision<0
    or effective_on is null or not isfinite(effective_on) or status_value is null or input->>'confirm' is distinct from 'transfer'
    or length(note_value)>1000 or (source_value is not null and (length(source_value)>2048 or source_value !~ '^https://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$')) then
    raise exception 'Invalid transfer confirmation' using errcode='22023';
  end if;
  -- Same request serializes even when a caller changes the proposed season.
  perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
  select * into previous_request from private.roster_transfer_requests where id=request_id;
  if found then
    if previous_request.request is distinct from input then raise exception 'Different transfer request' using errcode='40001'; end if;
    return jsonb_build_object('id',request_id,'change_id',previous_request.change_id,'already_published',true);
  end if;
  select * into origin from public.roster_memberships where id=membership_id;
  if not found then raise exception 'Missing origin membership' using errcode='23503'; end if;
  select * into source_team from public.team_seasons where id=origin.team_season_id;
  perform 1 from public.seasons where id=source_team.season_id for update;
  perform 1 from public.team_seasons where id in (origin.team_season_id,destination_id) order by id for update;
  select * into source_team from public.team_seasons where id=origin.team_season_id;
  select * into destination from public.team_seasons where id=destination_id;
  if not found or destination.id=source_team.id or destination.season_id<>source_team.season_id then
    raise exception 'Destination must be another team in the same season' using errcode='P0001';
  end if;
  if source_team.roster_revision<>from_revision or destination.roster_revision<>to_revision then
    raise exception 'Stale team revision' using errcode='40001';
  end if;
  if source_team.publication_status<>'published' or destination.publication_status<>'published'
    or source_team.archived_at is not null or destination.archived_at is not null
    or not exists(select 1 from public.seasons where id=source_team.season_id and publication_status='published') then
    raise exception 'Participation not public' using errcode='P0001';
  end if;
  perform 1 from public.organizations where id in (source_team.organization_id,destination.organization_id) order by id for share;
  perform 1 from public.regions where id in (source_team.region_id,destination.region_id) order by id for share;
  if exists(select 1 from public.organizations where id in (source_team.organization_id,destination.organization_id) and publication_status<>'published')
    or exists(select 1 from public.regions where id in (source_team.region_id,destination.region_id) and publication_status<>'published') then
    raise exception 'Parent not public' using errcode='P0001';
  end if;
  select * into player from public.players where id=origin.player_id for share;
  if player.publication_status<>'published' then raise exception 'Player not public' using errcode='P0001'; end if;
  select * into origin from public.roster_memberships where id=membership_id for update;
  if origin.updated_at is distinct from expected then raise exception 'Stale membership' using errcode='40001'; end if;
  if origin.publication_status<>'published' or origin.start_date>=effective_on or (origin.end_date is not null and origin.end_date<effective_on) then
    raise exception 'Origin must be active and start before transfer date' using errcode='P0001';
  end if;
  if exists(select 1 from public.roster_drafts where team_season_id in (source_team.id,destination.id) and status='draft') then
    raise exception 'Resolve open drafts in origin and destination first' using errcode='P0001';
  end if;
  if exists(select 1 from public.roster_memberships where player_id=player.id and team_season_id=destination.id and publication_status='published'
    and (origin.end_date is null or start_date<=origin.end_date) and (end_date is null or end_date>=effective_on)) then
    raise exception 'Destination membership overlaps' using errcode='P0001';
  end if;
  if status_value='starter' and (
    exists(select 1 from public.roster_memberships m join public.team_seasons t on t.id=m.team_season_id
      where m.player_id=player.id and m.id<>origin.id and t.season_id=source_team.season_id and m.publication_status='published' and m.status='starter'
        and (origin.end_date is null or m.start_date<=origin.end_date) and (m.end_date is null or m.end_date>=effective_on))
    or exists(select 1 from public.roster_drafts d join public.team_seasons t on t.id=d.team_season_id
      where t.season_id=source_team.season_id and d.status='draft' and (
        (d.payload<>'{}'::jsonb and d.payload->>'version' is distinct from '1')
        or d.payload->'members' @> jsonb_build_array(jsonb_build_object('player_id',player.id,'status','starter'))))
  ) then raise exception 'Starter conflict in season' using errcode='P0001'; end if;
  role_value := case when origin.role_is_explicit then origin.role else player.role end;
  before_value := to_jsonb(origin) || jsonb_build_object('effective_role',role_value);
  update public.roster_memberships set end_date=effective_on-1,role=role_value,role_is_explicit=true where id=origin.id;
  insert into public.roster_memberships(player_id,team_season_id,status,role,role_is_explicit,start_date,end_date,publication_status,published_at)
    values(player.id,destination.id,status_value,role_value,true,effective_on,origin.end_date,'published',now()) returning id into new_id;
  select to_jsonb(m) || jsonb_build_object('effective_role',m.role) into after_value from public.roster_memberships m where id=new_id;
  insert into public.roster_changes(player_id,from_membership_id,to_membership_id,change_type,occurred_on,summary,note,
    publication_status,published_at,published_by,source_url,before_snapshot,after_snapshot)
    values(player.id,origin.id,new_id,'transferred',effective_on,'Transferência entre equipes',note_value,
      'published',now(),auth.uid(),source_value,before_value,after_value) returning id into event_id;
  update public.team_seasons set roster_revision=roster_revision+1 where id in (source_team.id,destination.id);
  insert into private.roster_transfer_requests(id,request,change_id,created_by) values(request_id,input,event_id,auth.uid());
  return jsonb_build_object('id',request_id,'change_id',event_id,'already_published',false);
end;
$$;
revoke all on function public.admin_transfer_player(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.admin_transfer_player(jsonb) to authenticated;

-- Anonymous read projection. Invoker RLS applies to events and every joined row.
-- No actor IDs, request metadata, private drafts or raw audit snapshots leave this RPC.
create function public.read_roster_timeline(filters jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare
  org_filter uuid := nullif(filters->>'organization_id','')::uuid;
  player_filter uuid := nullif(filters->>'player_id','')::uuid;
  region_filter text := nullif(filters->>'region','');
  team_filter text := nullif(filters->>'team','');
  kind_filter public.roster_change_type := nullif(filters->>'kind','')::public.roster_change_type;
  start_filter date := nullif(filters->>'from','')::date;
  end_filter date := nullif(filters->>'to','')::date;
  page_value integer := coalesce((filters->>'page')::integer,1);
  size_value integer := coalesce((filters->>'page_size')::integer,20);
  result jsonb;
begin
  if page_value<1 or page_value>10000 or size_value<1 or size_value>50 or (start_filter is not null and not isfinite(start_filter))
    or (end_filter is not null and not isfinite(end_filter)) or start_filter>end_filter then
    raise exception 'Invalid timeline filters' using errcode='22023';
  end if;
  with visible as (
    select c.id,c.occurred_on,jsonb_build_object(
      'id',c.id,'type',c.change_type,'date',c.occurred_on,'summary',c.summary,'note',c.note,'source_url',c.source_url,'published_at',c.published_at,
      'player',jsonb_build_object('id',p.id,'nickname',p.nickname,'slug',p.slug),
      'from',case when fm.id is null then null else jsonb_build_object('membership_id',fm.id,'organization_id',fo.id,'name',fo.name,'slug',fo.slug,'region',fr.slug,'season',fs.year,'status',fm.status,'role',case when fm.role_is_explicit then fm.role else p.role end) end,
      'to',case when tm.id is null then null else jsonb_build_object('membership_id',tm.id,'organization_id',tor.id,'name',tor.name,'slug',tor.slug,'region',tr.slug,'season',ts.year,'status',tm.status,'role',case when tm.role_is_explicit then tm.role else p.role end) end
    ) as event
    from public.roster_changes c join public.players p on p.id=c.player_id
    left join public.roster_memberships fm on fm.id=c.from_membership_id
    left join public.team_seasons ft on ft.id=fm.team_season_id
    left join public.organizations fo on fo.id=ft.organization_id
    left join public.regions fr on fr.id=ft.region_id
    left join public.seasons fs on fs.id=ft.season_id
    left join public.roster_memberships tm on tm.id=c.to_membership_id
    left join public.team_seasons tt on tt.id=tm.team_season_id
    left join public.organizations tor on tor.id=tt.organization_id
    left join public.regions tr on tr.id=tt.region_id
    left join public.seasons ts on ts.id=tt.season_id
    where c.publication_status='published' and p.publication_status='published'
      and (c.from_membership_id is null or (fm.publication_status='published' and ft.publication_status='published' and fo.publication_status='published' and fr.publication_status='published' and fs.publication_status='published'))
      and (c.to_membership_id is null or (tm.publication_status='published' and tt.publication_status='published' and tor.publication_status='published' and tr.publication_status='published' and ts.publication_status='published'))
      and (org_filter is null or fo.id=org_filter or tor.id=org_filter)
      and (player_filter is null or p.id=player_filter)
      and (region_filter is null or fr.slug=region_filter or tr.slug=region_filter)
      and (team_filter is null or fo.slug=team_filter or tor.slug=team_filter)
      and (kind_filter is null or c.change_type=kind_filter)
      and (start_filter is null or c.occurred_on>=start_filter)
      and (end_filter is null or c.occurred_on<=end_filter)
  ), page_rows as (select * from visible order by occurred_on desc,id desc limit size_value offset (page_value-1)*size_value)
  select jsonb_build_object('total',(select count(*) from visible),'events',coalesce((select jsonb_agg(event order by occurred_on desc,id desc) from page_rows),'[]'::jsonb)) into result;
  return result;
end;
$$;
revoke all on function public.read_roster_timeline(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.read_roster_timeline(jsonb) to anon,authenticated;
commit;
