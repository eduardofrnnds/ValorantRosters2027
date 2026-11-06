-- Task 13. Player identity remains independent of nickname, team and current slug.
begin;
alter table public.players add column links jsonb not null default '{}'::jsonb
  check (jsonb_typeof(links) = 'object');

create function public.admin_save_player(payload jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  row_id uuid := (payload->>'id')::uuid;
  expected timestamptz := nullif(payload->>'expected_updated_at','')::timestamptz;
  old_row public.players;
  desired public.publication_status := (payload->>'publication_status')::public.publication_status;
  requested_slug text := nullif(payload->>'slug','');
  base_slug text := payload->>'slug_base';
  chosen_slug text;
  suffix integer := 1;
  profile_links jsonb := coalesce(payload->'links','{}'::jsonb);
  item record;
  photo text := nullif(btrim(payload->>'photo_url'),'');
begin
  if not private.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if row_id is null or desired is null or coalesce(length(btrim(payload->>'nickname')),0) not between 1 and 80
    or length(coalesce(payload->>'name','')) > 160 or length(coalesce(payload->>'nationality','')) > 80
    or (requested_slug is not null and (length(requested_slug) > 100 or requested_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'))
    or (photo is not null and (length(photo) > 2048 or photo !~ '^(https://[^/@[:space:]]+[^[:space:]]*|/[^/[:space:]][^[:space:]]*)$'))
    or jsonb_typeof(profile_links) <> 'object' then
    raise exception 'Invalid player' using errcode = '22023';
  end if;
  for item in select key, value from jsonb_each(profile_links) loop
    if item.key not in ('website','x','twitch','vlr') or jsonb_typeof(item.value) <> 'string'
      or length(item.value #>> '{}') > 2048 or (item.value #>> '{}') !~ '^https://[^/@[:space:]]+[^[:space:]]*$' then
      raise exception 'Invalid profile link' using errcode = '22023';
    end if;
  end loop;
  if expected is null then
    if requested_slug is null then
      if coalesce(length(base_slug),0) not between 1 and 80 or base_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
        raise exception 'Invalid slug base' using errcode = '22023';
      end if;
      -- Coordinate generated slugs; the unique trigger also handles manual writers.
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('player-slug:' || base_slug)::bigint);
    end if;
    loop
      chosen_slug := coalesce(requested_slug, base_slug || case when suffix = 1 then '' else '-' || suffix::text end);
      begin
        insert into public.players(id,nickname,name,slug,nationality,role,photo_url,links,publication_status,published_at)
        values(row_id,btrim(payload->>'nickname'),nullif(btrim(payload->>'name'),''),chosen_slug,
          nullif(btrim(payload->>'nationality'),''),nullif(payload->>'role','')::public.player_role,photo,profile_links,
          desired,case when desired = 'published' then now() end);
        exit;
      exception when unique_violation then
        -- Replaying the same new form must never create another identity.
        if requested_slug is not null or exists(select 1 from public.players where id = row_id) then raise; end if;
        suffix := suffix + 1;
      end;
    end loop;
  else
    if requested_slug is null then raise exception 'Slug required for edit' using errcode = '22023'; end if;
    select * into old_row from public.players where id = row_id for update;
    if not found then raise exception 'Missing player' using errcode = 'P0002'; end if;
    if old_row.updated_at is distinct from expected then raise exception 'Stale player' using errcode = '40001'; end if;
    update public.players set nickname = btrim(payload->>'nickname'), name = nullif(btrim(payload->>'name'),''),
      slug = requested_slug, nationality = nullif(btrim(payload->>'nationality'),''),
      role = nullif(payload->>'role','')::public.player_role, photo_url = photo, links = profile_links,
      publication_status = desired, published_at = case when desired = 'published' then coalesce(old_row.published_at,now()) end
    where id = row_id;
  end if;
  -- Existing remember_player_slug trigger reserves current and past slugs atomically.
  return row_id;
end;
$$;
revoke all on function public.admin_save_player(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.admin_save_player(jsonb) to authenticated;
commit;
