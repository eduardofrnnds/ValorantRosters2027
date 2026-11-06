-- Task 08: structure only. No seed, users, credentials or published roster data.
-- Requires Supabase's auth.users and anon/authenticated/service_role roles.
begin;

create type public.publication_status as enum ('draft', 'published');
create type public.partner_status as enum ('partner', 'qualifier', 'visitor');
create type public.roster_status as enum ('starter', 'reserve', 'inactive', 'coach');
create type public.player_role as enum ('duelist', 'initiator', 'controller', 'sentinel', 'flex', 'coach');
create type public.roster_draft_status as enum ('draft', 'published', 'archived');
create type public.roster_change_type as enum ('joined', 'left', 'transferred', 'status_changed', 'corrected');

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (btrim(name) <> ''),
  publication_status public.publication_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((publication_status = 'published') = (published_at is not null))
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique check (year between 2000 and 9999),
  name text not null check (btrim(name) <> ''),
  publication_status public.publication_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((publication_status = 'published') = (published_at is not null))
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (btrim(name) <> ''),
  short_name text check (short_name is null or btrim(short_name) <> ''),
  logo_url text check (logo_url is null or btrim(logo_url) <> ''),
  publication_status public.publication_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((publication_status = 'published') = (published_at is not null))
);

create table public.team_seasons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  season_id uuid not null references public.seasons(id) on delete restrict,
  region_id uuid not null references public.regions(id) on delete restrict,
  partner_status public.partner_status not null,
  roster_revision bigint not null default 0 check (roster_revision >= 0),
  publication_status public.publication_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, season_id),
  check ((publication_status = 'published') = (published_at is not null))
);
create index team_seasons_region_season_idx on public.team_seasons(region_id, season_id);
create index team_seasons_season_idx on public.team_seasons(season_id);
comment on table public.team_seasons is 'Participation category and region belong to a season. No eight-team cap.';

create table public.players (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nickname text not null check (btrim(nickname) <> ''),
  name text check (name is null or btrim(name) <> ''),
  photo_url text check (photo_url is null or btrim(photo_url) <> ''),
  nationality text check (nationality is null or btrim(nationality) <> ''),
  role public.player_role,
  publication_status public.publication_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((publication_status = 'published') = (published_at is not null))
);
create index players_nickname_idx on public.players(lower(nickname));
comment on column public.players.nickname is 'Display name, intentionally not unique. Relationships use the immutable UUID.';

-- Includes the current slug: one shared namespace prevents reuse of another
-- player's historical URL. Trigger-maintained; clients cannot write this table.
create table public.player_slug_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  was_published boolean not null default false,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (retired_at is null or retired_at >= created_at)
);
create unique index player_slug_history_current_idx on public.player_slug_history(player_id) where retired_at is null;
create index player_slug_history_player_idx on public.player_slug_history(player_id);

create table public.roster_memberships (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete restrict,
  team_season_id uuid not null references public.team_seasons(id) on delete restrict,
  status public.roster_status not null,
  start_date date not null,
  end_date date,
  publication_status public.publication_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, player_id),
  unique (player_id, team_season_id, start_date),
  check (isfinite(start_date) and (end_date is null or isfinite(end_date))),
  check (end_date is null or end_date >= start_date),
  check ((publication_status = 'published') = (published_at is not null))
);
create index roster_memberships_team_status_idx on public.roster_memberships(team_season_id, status, start_date desc);
create index roster_memberships_player_dates_idx on public.roster_memberships(player_id, start_date desc, end_date);
comment on column public.roster_memberships.end_date is 'Inclusive last day. NULL means no recorded end. Close and insert on transfer; never reassign identity.';

create table public.roster_drafts (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null references public.team_seasons(id) on delete restrict,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  status public.roster_draft_status not null default 'draft',
  base_revision bigint not null default 0 check (base_revision >= 0),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'published') = (published_at is not null))
);
create index roster_drafts_team_status_idx on public.roster_drafts(team_season_id, status, updated_at desc);
create index roster_drafts_creator_idx on public.roster_drafts(created_by);
comment on table public.roster_drafts is 'Private proposed data, never a public roster. Payload validation and atomic publication belong to later tasks.';

create table public.roster_changes (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete restrict,
  from_membership_id uuid,
  to_membership_id uuid,
  change_type public.roster_change_type not null,
  occurred_on date not null check (isfinite(occurred_on)),
  summary text not null check (btrim(summary) <> ''),
  publication_status public.publication_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (from_membership_id, player_id) references public.roster_memberships(id, player_id) on delete restrict,
  foreign key (to_membership_id, player_id) references public.roster_memberships(id, player_id) on delete restrict,
  check (
    (change_type = 'joined' and from_membership_id is null and to_membership_id is not null) or
    (change_type = 'left' and from_membership_id is not null and to_membership_id is null) or
    (change_type = 'transferred' and from_membership_id is not null and to_membership_id is not null and from_membership_id <> to_membership_id) or
    (change_type in ('status_changed', 'corrected') and (from_membership_id is not null or to_membership_id is not null))
  ),
  check ((publication_status = 'published') = (published_at is not null))
);
create index roster_changes_player_date_idx on public.roster_changes(player_id, occurred_on desc);
create index roster_changes_from_idx on public.roster_changes(from_membership_id);
create index roster_changes_to_idx on public.roster_changes(to_membership_id);
create index roster_changes_public_feed_idx on public.roster_changes(published_at desc) where publication_status = 'published';

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.admin_users is 'Explicit allowlist. Only trusted SQL/service provisioning may change administrators; no client self-enrollment.';

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete restrict,
  db_role text not null,
  table_name text not null,
  record_id uuid not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  old_record jsonb,
  new_record jsonb,
  transaction_id bigint not null default txid_current(),
  created_at timestamptz not null default clock_timestamp(),
  check ((operation = 'INSERT' and old_record is null and new_record is not null)
      or (operation = 'UPDATE' and old_record is not null and new_record is not null)
      or (operation = 'DELETE' and old_record is not null and new_record is null))
);
create index audit_logs_record_idx on public.audit_logs(table_name, record_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs(actor_id, created_at desc);
comment on table public.audit_logs is 'Private append-only snapshots, including draft content. Never part of the public change feed.';

-- Default deny from the first migration, even before policies are installed.
do $$
declare t text;
begin
  foreach t in array array['regions','seasons','organizations','team_seasons','players','player_slug_history','roster_memberships','roster_drafts','roster_changes','admin_users','audit_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', t);
  end loop;
end $$;

commit;
