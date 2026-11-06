-- Task 10: permission checks remain database-backed, never user_metadata claims.
begin;

-- A signed-in admin can inspect only their own active authorization via PostgREST.
-- private.is_admin() remains SECURITY DEFINER with fixed search_path and sees the
-- trusted allowlist without a recursive RLS lookup.
drop policy admin_read on public.admin_users;
create policy admin_read on public.admin_users for select to authenticated
using (user_id = (select auth.uid()) and is_active);
create policy admin_self_read_guard on public.admin_users as restrictive for select to authenticated
using (user_id = (select auth.uid()) and is_active);

-- Restrictive guards cannot be bypassed by an additional permissive policy.
do $$
declare t text;
begin
  foreach t in array array['regions','seasons','organizations','team_seasons','players','roster_memberships','roster_drafts','roster_changes'] loop
    execute format('create policy admin_insert_guard on public.%I as restrictive for insert to authenticated with check ((select private.is_admin()))', t);
    execute format('create policy admin_update_guard on public.%I as restrictive for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
  end loop;
  foreach t in array array['roster_drafts','audit_logs'] loop
    execute format('create policy private_admin_read_guard on public.%I as restrictive for select to authenticated using ((select private.is_admin()))', t);
  end loop;
end $$;

drop policy admin_insert_guard on public.roster_drafts;
create policy admin_insert_guard on public.roster_drafts as restrictive for insert to authenticated
with check ((select private.is_admin()) and created_by = (select auth.uid()));

-- Reassert that provisioning and technical history are unavailable to app users.
revoke insert, update, delete, truncate on public.admin_users, public.audit_logs, public.player_slug_history from anon, authenticated;
comment on policy admin_read on public.admin_users is 'Only the current active authorization is exposed; no list of other administrators.';
commit;
