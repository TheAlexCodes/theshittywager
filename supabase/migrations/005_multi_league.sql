-- Multi-league support: leagues, members, invites, per-league commissioners
-- Migrates existing single-league data into a default league

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------
create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  bankroll integer not null default 0,
  is_commissioner boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create index if not exists league_members_league_id_idx on public.league_members (league_id);
create index if not exists league_members_user_id_idx on public.league_members (user_id);

create table if not exists public.league_invites (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid references public.profiles (id),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists league_invites_league_id_idx on public.league_invites (league_id);
create index if not exists league_invites_token_idx on public.league_invites (token);

-- ---------------------------------------------------------------------------
-- Add league_id columns
-- ---------------------------------------------------------------------------
alter table public.weeks add column if not exists league_id uuid references public.leagues (id);
alter table public.bets add column if not exists league_id uuid references public.leagues (id);
alter table public.futures add column if not exists league_id uuid references public.leagues (id);

alter table public.league_settings add column if not exists league_id uuid references public.leagues (id);

-- ---------------------------------------------------------------------------
-- Migrate existing data into a default league
-- ---------------------------------------------------------------------------
do $$
declare
  v_league_id uuid;
begin
  if not exists (select 1 from public.leagues limit 1) then
    insert into public.leagues (name, created_by)
    select 'The Shitty Wager', id
    from public.profiles
    where is_commissioner = true
    order by created_at nulls last
    limit 1;

    if not found then
      insert into public.leagues (name) values ('The Shitty Wager');
    end if;
  end if;

  select id into v_league_id from public.leagues order by created_at limit 1;

  insert into public.league_members (league_id, user_id, bankroll, is_commissioner)
  select
    v_league_id,
    p.id,
    coalesce(p.bankroll, 0),
    coalesce(p.is_commissioner, false)
  from public.profiles p
  on conflict (league_id, user_id) do update
    set bankroll = excluded.bankroll,
        is_commissioner = excluded.is_commissioner;

  update public.weeks set league_id = v_league_id where league_id is null;
  update public.bets set league_id = v_league_id where league_id is null;
  update public.futures set league_id = v_league_id where league_id is null;

  update public.league_settings
  set league_id = v_league_id
  where league_id is null;

  insert into public.league_settings (
    league_id, weekly_allowance, futures_allowance, playoff_allowance, season_year
  )
  select v_league_id, 100, 300, 200, 2026
  where not exists (
    select 1 from public.league_settings where league_id = v_league_id
  );
end $$;

-- ---------------------------------------------------------------------------
-- Enforce league_id + update constraints
-- ---------------------------------------------------------------------------
alter table public.weeks alter column league_id set not null;
alter table public.bets alter column league_id set not null;
alter table public.futures alter column league_id set not null;

alter table public.league_settings drop constraint if exists league_settings_pkey;
alter table public.league_settings drop constraint if exists league_settings_id_check;

alter table public.league_settings
  drop column if exists id;

alter table public.league_settings
  add constraint league_settings_league_id_pkey primary key (league_id);

alter table public.weeks drop constraint if exists weeks_phase_week_number_unique;
alter table public.weeks
  add constraint weeks_league_phase_week_number_unique unique (league_id, phase, week_number);

-- ---------------------------------------------------------------------------
-- League helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_league_member(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.league_members
    where league_id = p_league_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_league_commissioner(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.league_members
    where league_id = p_league_id
      and user_id = auth.uid()
      and is_commissioner = true
  );
$$;

create or replace function public.is_commissioner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.league_members
    where user_id = auth.uid()
      and is_commissioner = true
  );
$$;

-- ---------------------------------------------------------------------------
-- League RPCs
-- ---------------------------------------------------------------------------
create or replace function public.create_league(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.leagues (name, created_by)
  values (trim(p_name), auth.uid())
  returning id into v_league_id;

  insert into public.league_members (league_id, user_id, is_commissioner)
  values (v_league_id, auth.uid(), true);

  insert into public.league_settings (
    league_id, weekly_allowance, futures_allowance, playoff_allowance, season_year
  )
  values (v_league_id, 100, 300, 200, 2026);

  insert into public.league_invites (league_id, created_by)
  values (v_league_id, auth.uid());

  return v_league_id;
end;
$$;

grant execute on function public.create_league(text) to authenticated;

create or replace function public.join_league_by_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.league_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite
  from public.league_invites
  where token = p_token;

  if not found then
    raise exception 'Invalid invite link';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    raise exception 'Invite link has expired';
  end if;

  insert into public.league_members (league_id, user_id)
  values (v_invite.league_id, auth.uid())
  on conflict (league_id, user_id) do nothing;

  return v_invite.league_id;
end;
$$;

grant execute on function public.join_league_by_invite(text) to authenticated;

create or replace function public.create_league_invite(p_league_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if not public.is_league_commissioner(p_league_id) then
    raise exception 'Commissioner access required';
  end if;

  insert into public.league_invites (league_id, created_by)
  values (p_league_id, auth.uid())
  returning token into v_token;

  return v_token;
end;
$$;

grant execute on function public.create_league_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Budget helpers (league-scoped)
-- ---------------------------------------------------------------------------
create or replace function public.futures_allowance(p_league_id uuid)
returns integer
language sql
stable
as $$
  select coalesce(
    (
      select allowance
      from public.weeks
      where league_id = p_league_id
        and phase = 'futures'
      order by week_number
      limit 1
    ),
    (
      select futures_allowance
      from public.league_settings
      where league_id = p_league_id
    ),
    300
  );
$$;

create or replace function public.futures_is_locked(p_league_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.weeks
    where league_id = p_league_id
      and phase = 'regular'
      and reveal_at <= now()
  );
$$;

create or replace function public.apply_league_allowances(p_league_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league_id uuid;
  v_settings public.league_settings%rowtype;
begin
  if p_league_id is null then
    for v_settings in select * from public.league_settings loop
      update public.weeks w
      set allowance = v_settings.futures_allowance
      where w.league_id = v_settings.league_id and w.phase = 'futures';

      update public.weeks w
      set allowance = v_settings.weekly_allowance
      where w.league_id = v_settings.league_id and w.phase = 'regular';

      update public.weeks w
      set allowance = v_settings.playoff_allowance
      where w.league_id = v_settings.league_id and w.phase = 'playoff';
    end loop;
    return;
  end if;

  select * into v_settings from public.league_settings where league_id = p_league_id;
  if not found then return; end if;

  update public.weeks w set allowance = v_settings.futures_allowance
  where w.league_id = p_league_id and w.phase = 'futures';

  update public.weeks w set allowance = v_settings.weekly_allowance
  where w.league_id = p_league_id and w.phase = 'regular';

  update public.weeks w set allowance = v_settings.playoff_allowance
  where w.league_id = p_league_id and w.phase = 'playoff';
end;
$$;

create or replace function public.league_settings_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  perform public.apply_league_allowances(new.league_id);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Bet / futures validation + settlement (league bankroll)
-- ---------------------------------------------------------------------------
create or replace function public.validate_bet_insert()
returns trigger
language plpgsql
as $$
declare
  v_week public.weeks%rowtype;
  v_spent integer;
begin
  if new.week_id is null then
    raise exception 'week_id is required for bets';
  end if;

  select * into v_week from public.weeks where id = new.week_id;

  if not found then
    raise exception 'Week not found';
  end if;

  if new.league_id is null then
    new.league_id := v_week.league_id;
  elsif new.league_id <> v_week.league_id then
    raise exception 'Bet league does not match week league';
  end if;

  if not public.is_league_member(new.league_id) then
    raise exception 'Not a member of this league';
  end if;

  if v_week.phase = 'futures' then
    raise exception 'Use the futures table for futures wagers';
  end if;

  if v_week.reveal_at > now() then
    raise exception 'Betting for this week is not open yet';
  end if;

  select coalesce(sum(stake), 0) into v_spent
  from public.bets
  where league_id = new.league_id
    and player_id = new.player_id
    and week_id = new.week_id
    and status <> 'void';

  if v_spent + new.stake > v_week.allowance then
    raise exception 'Exceeds week allowance of % (already staked %)',
      v_week.allowance, v_spent;
  end if;

  return new;
end;
$$;

create or replace function public.validate_futures_insert()
returns trigger
language plpgsql
as $$
declare
  v_allowance integer;
  v_spent integer;
begin
  if new.league_id is null then
    raise exception 'league_id is required for futures';
  end if;

  if not public.is_league_member(new.league_id) then
    raise exception 'Not a member of this league';
  end if;

  if public.futures_is_locked(new.league_id) then
    raise exception 'Futures betting is closed';
  end if;

  v_allowance := public.futures_allowance(new.league_id);

  select coalesce(sum(stake), 0) into v_spent
  from public.futures
  where league_id = new.league_id
    and player_id = new.player_id
    and status <> 'void';

  if v_spent + new.stake > v_allowance then
    raise exception 'Exceeds futures allowance of % (already staked %)',
      v_allowance, v_spent;
  end if;

  return new;
end;
$$;

create or replace function public.settle_bet()
returns trigger
language plpgsql
as $$
declare
  v_profit integer;
  v_league_id uuid;
begin
  if old.status <> 'pending' then
    raise exception 'Bet has already been settled';
  end if;

  if new.status = old.status then
    return new;
  end if;

  if new.status not in ('won', 'lost', 'push', 'void') then
    raise exception 'Invalid settlement status: %', new.status;
  end if;

  if new.player_id <> old.player_id
    or new.week_id is distinct from old.week_id
    or new.league_id <> old.league_id
    or new.bet_type is distinct from old.bet_type
    or new.selection is distinct from old.selection
    or new.stake <> old.stake
    or new.american_odds is distinct from old.american_odds
  then
    raise exception 'Cannot modify bet details during settlement';
  end if;

  v_league_id := new.league_id;
  new.settled_at = now();
  new.settled_by = auth.uid();

  if new.status = 'won' then
    v_profit := public.american_odds_profit(new.stake, new.american_odds);
    new.payout := new.stake + v_profit;

    update public.league_members
    set bankroll = bankroll + new.payout
    where league_id = v_league_id and user_id = new.player_id;
  elsif new.status = 'lost' then
    new.payout := 0;

    update public.league_members
    set bankroll = bankroll - new.stake
    where league_id = v_league_id and user_id = new.player_id;
  else
    new.payout := 0;
  end if;

  return new;
end;
$$;

create or replace function public.settle_future()
returns trigger
language plpgsql
as $$
declare
  v_profit integer;
begin
  if old.status <> 'pending' then
    raise exception 'Future has already been settled';
  end if;

  if new.status = old.status then
    return new;
  end if;

  if new.status not in ('won', 'lost', 'push', 'void') then
    raise exception 'Invalid settlement status: %', new.status;
  end if;

  if new.player_id <> old.player_id
    or new.league_id <> old.league_id
    or new.category is distinct from old.category
    or new.selection is distinct from old.selection
    or new.stake <> old.stake
    or new.american_odds is distinct from old.american_odds
  then
    raise exception 'Cannot modify future details during settlement';
  end if;

  new.settled_at = now();
  new.settled_by = auth.uid();

  if new.status = 'won' then
    v_profit := public.american_odds_profit(new.stake, new.american_odds);
    new.payout := new.stake + v_profit;

    update public.league_members
    set bankroll = bankroll + new.payout
    where league_id = new.league_id and user_id = new.player_id;
  elsif new.status = 'lost' then
    new.payout := 0;

    update public.league_members
    set bankroll = bankroll - new.stake
    where league_id = new.league_id and user_id = new.player_id;
  else
    new.payout := 0;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Standings (per league)
-- ---------------------------------------------------------------------------
drop view if exists public.standings;

create view public.standings
with (security_invoker = true)
as
select
  lm.league_id,
  lm.user_id as player_id,
  p.display_name,
  lm.bankroll,
  lm.is_commissioner,
  rank() over (
    partition by lm.league_id
    order by lm.bankroll desc, p.display_name asc
  ) as standing_rank
from public.league_members lm
join public.profiles p on p.id = lm.user_id;

grant select on public.standings to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.league_invites enable row level security;

drop policy if exists "Members can read their leagues" on public.leagues;
create policy "Members can read their leagues"
  on public.leagues for select
  to authenticated
  using (public.is_league_member(id));

drop policy if exists "Authenticated users can create leagues" on public.leagues;
create policy "Authenticated users can create leagues"
  on public.leagues for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "Commissioners can update leagues" on public.leagues;
create policy "Commissioners can update leagues"
  on public.leagues for update
  to authenticated
  using (public.is_league_commissioner(id))
  with check (public.is_league_commissioner(id));

drop policy if exists "Members can read league roster" on public.league_members;
create policy "Members can read league roster"
  on public.league_members for select
  to authenticated
  using (public.is_league_member(league_id));

drop policy if exists "Commissioners can update league members" on public.league_members;
create policy "Commissioners can update league members"
  on public.league_members for update
  to authenticated
  using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

drop policy if exists "Commissioners can read league invites" on public.league_invites;
create policy "Commissioners can read league invites"
  on public.league_invites for select
  to authenticated
  using (public.is_league_commissioner(league_id));

drop policy if exists "Commissioners can create league invites" on public.league_invites;
create policy "Commissioners can create league invites"
  on public.league_invites for insert
  to authenticated
  with check (public.is_league_commissioner(league_id));

-- Weeks
drop policy if exists "Authenticated users can read weeks" on public.weeks;
create policy "Members can read league weeks"
  on public.weeks for select
  to authenticated
  using (public.is_league_member(league_id));

drop policy if exists "Commissioners can manage weeks" on public.weeks;
create policy "Commissioners can manage league weeks"
  on public.weeks for all
  to authenticated
  using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

-- Bets
drop policy if exists "Authenticated users can read bets" on public.bets;
create policy "Members can read league bets"
  on public.bets for select
  to authenticated
  using (public.is_league_member(league_id));

drop policy if exists "Players can place own bets" on public.bets;
create policy "Players can place own league bets"
  on public.bets for insert
  to authenticated
  with check (
    player_id = auth.uid()
    and public.is_league_member(league_id)
  );

drop policy if exists "Commissioners can settle bets" on public.bets;
create policy "Commissioners can settle league bets"
  on public.bets for update
  to authenticated
  using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

-- Futures
drop policy if exists "Authenticated users can read futures" on public.futures;
create policy "Members can read league futures"
  on public.futures for select
  to authenticated
  using (public.is_league_member(league_id));

drop policy if exists "Players can place own futures" on public.futures;
create policy "Players can place own league futures"
  on public.futures for insert
  to authenticated
  with check (
    player_id = auth.uid()
    and public.is_league_member(league_id)
  );

drop policy if exists "Commissioners can settle futures" on public.futures;
create policy "Commissioners can settle league futures"
  on public.futures for update
  to authenticated
  using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

-- League settings
drop policy if exists "Authenticated users can read league settings" on public.league_settings;
create policy "Members can read league settings"
  on public.league_settings for select
  to authenticated
  using (public.is_league_member(league_id));

drop policy if exists "Commissioners can update league settings" on public.league_settings;
create policy "Commissioners can update league settings"
  on public.league_settings for update
  to authenticated
  using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

drop policy if exists "Commissioners can insert league settings" on public.league_settings;
create policy "Commissioners can insert league settings"
  on public.league_settings for insert
  to authenticated
  with check (public.is_league_commissioner(league_id));

-- Profiles: remove global commissioner update policy
drop policy if exists "Commissioners can update profiles" on public.profiles;

-- Allow reading profiles of people in shared leagues
drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Users can read profiles in shared leagues"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.league_members mine
      join public.league_members theirs on mine.league_id = theirs.league_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );
