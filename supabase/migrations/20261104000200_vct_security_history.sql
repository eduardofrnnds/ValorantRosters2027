-- Initial RLS and audit foundation. No login UI or publication RPC is introduced.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to authenticated, service_role;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active);
$$;
revoke all on function private.is_admin() from public, anon, authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;

create function private.prepare_row_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (to_jsonb(new)->tg_argv[0]) is distinct from (to_jsonb(old)->tg_argv[0]) then
    raise exception 'Stable identity cannot be changed' using errcode = '23514';
  end if;
  new.created_at := old.created_at;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create function private.protect_membership_identity() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.player_id <> old.player_id or new.team_season_id <> old.team_season_id then
    raise exception 'Close the membership and insert a new one; do not reassign history' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger protect_membership_identity before update on public.roster_memberships
for each row execute function private.protect_membership_identity();

-- Protect the identity indirectly referenced by memberships as well.
create function private.protect_team_season_identity() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.organization_id <> old.organization_id or new.season_id <> old.season_id then
    raise exception 'Organization and season of a participation are immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger protect_team_season_identity before update on public.team_seasons
for each row execute function private.protect_team_season_identity();

create function private.protect_draft_identity() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.team_season_id <> old.team_season_id or new.created_by <> old.created_by
     or new.base_revision <> old.base_revision then
    raise exception 'Draft origin, author and base revision are immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger protect_draft_identity before update on public.roster_drafts
for each row execute function private.protect_draft_identity();

create function private.remember_player_slug() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare affected integer;
begin
  if tg_op = 'UPDATE' and old.slug <> new.slug then
    update public.player_slug_history set retired_at = clock_timestamp()
    where player_id = new.id and slug = old.slug;
  end if;
  insert into public.player_slug_history (player_id, slug, was_published)
    values (new.id, new.slug, new.publication_status = 'published')
  on conflict (slug) do update
    set retired_at = null, was_published = public.player_slug_history.was_published or excluded.was_published
    where public.player_slug_history.player_id = excluded.player_id;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Slug reserved by another player' using errcode = '23505';
  end if;
  return new;
end;
$$;
create trigger remember_player_slug after insert or update of slug, publication_status on public.players
for each row execute function private.remember_player_slug();

create function private.audit_row_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare before_row jsonb; after_row jsonb;
begin
  if tg_op <> 'INSERT' then before_row := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then after_row := to_jsonb(new); end if;
  insert into public.audit_logs (actor_id, db_role, table_name, record_id, operation, old_record, new_record)
  values (auth.uid(), coalesce(nullif(current_setting('role', true), 'none'), session_user), tg_table_name,
    coalesce(after_row->>tg_argv[0], before_row->>tg_argv[0])::uuid, tg_op, before_row, after_row);
  return null;
end;
$$;

create function private.reject_audit_mutation() returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'Audit logs are append-only' using errcode = '23514';
end;
$$;
create trigger audit_logs_immutable before update or delete on public.audit_logs
for each row execute function private.reject_audit_mutation();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
for each statement execute function private.reject_audit_mutation();

do $$
declare t text; pk text;
begin
  foreach t in array array['regions','seasons','organizations','team_seasons','players','player_slug_history','roster_memberships','roster_drafts','roster_changes','admin_users'] loop
    pk := case when t = 'admin_users' then 'user_id' else 'id' end;
    execute format('create trigger prepare_row_update before update on public.%I for each row execute function private.prepare_row_update(%L)', t, pk);
    execute format('create trigger audit_row_change after insert or update or delete on public.%I for each row execute function private.audit_row_change(%L)', t, pk);
  end loop;
end $$;

revoke all on function private.prepare_row_update(), private.protect_membership_identity(),
  private.protect_team_season_identity(), private.protect_draft_identity(), private.remember_player_slug(),
  private.audit_row_change(), private.reject_audit_mutation() from public, anon, authenticated, service_role;

-- Public policies form a dependency DAG: no reciprocal RLS lookups.
do $$
declare t text;
begin
  foreach t in array array['regions','seasons','organizations','players'] loop
    execute format('create policy published_read on public.%I for select to anon, authenticated using (publication_status = ''published'')', t);
  end loop;
end $$;

create policy published_read on public.team_seasons for select to anon, authenticated using (
  publication_status = 'published'
  and exists (select 1 from public.organizations o where o.id = organization_id and o.publication_status = 'published')
  and exists (select 1 from public.seasons s where s.id = season_id and s.publication_status = 'published')
  and exists (select 1 from public.regions r where r.id = region_id and r.publication_status = 'published')
);
create policy published_read on public.player_slug_history for select to anon, authenticated using (
  was_published and exists (select 1 from public.players p where p.id = player_id and p.publication_status = 'published')
);
create policy published_read on public.roster_memberships for select to anon, authenticated using (
  publication_status = 'published'
  and exists (select 1 from public.players p where p.id = player_id and p.publication_status = 'published')
  and exists (select 1 from public.team_seasons t where t.id = team_season_id and t.publication_status = 'published')
);
create policy published_read on public.roster_changes for select to anon, authenticated using (
  publication_status = 'published'
  and exists (select 1 from public.players p where p.id = player_id and p.publication_status = 'published')
  and (from_membership_id is null or exists (select 1 from public.roster_memberships m where m.id = from_membership_id and m.publication_status = 'published'))
  and (to_membership_id is null or exists (select 1 from public.roster_memberships m where m.id = to_membership_id and m.publication_status = 'published'))
);

do $$
declare t text;
begin
  foreach t in array array['regions','seasons','organizations','team_seasons','players','player_slug_history','roster_memberships','roster_changes'] loop
    execute format('grant select on public.%I to anon, authenticated', t);
  end loop;
  foreach t in array array['regions','seasons','organizations','team_seasons','players','player_slug_history','roster_memberships','roster_drafts','roster_changes','admin_users','audit_logs'] loop
    execute format('grant select on public.%I to authenticated, service_role', t);
    execute format('create policy admin_read on public.%I for select to authenticated using ((select private.is_admin()))', t);
  end loop;
  foreach t in array array['regions','seasons','organizations','team_seasons','players','roster_memberships','roster_drafts','roster_changes'] loop
    execute format('grant insert, update on public.%I to authenticated, service_role', t);
    execute format('create policy admin_insert on public.%I for insert to authenticated with check ((select private.is_admin()))', t);
    execute format('create policy admin_update on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
  end loop;
end $$;

-- Provisioning is not available to signed-in users, even existing admins.
drop policy admin_insert on public.roster_drafts;
create policy admin_insert on public.roster_drafts for insert to authenticated
with check ((select private.is_admin()) and created_by = (select auth.uid()));
grant insert, update on public.admin_users to service_role;
-- No client/service grant for DELETE, TRUNCATE or direct audit/alias writes.
-- Supabase service_role bypasses RLS; keep its credential on trusted servers.
commit;
