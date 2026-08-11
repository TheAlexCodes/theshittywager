-- The Shitty Wager — initial schema (GREENFIELD ONLY)
--
-- ⚠️  DO NOT RUN if you already have Profiles, Weeks, Bets, and Futures tables.
--     Use introspect_schema.sql and wait for 002_extend_existing_schema.sql instead.
--
-- Run in Supabase SQL Editor or via Supabase CLI

-- ---------------------------------------------------------------------------
-- Enums (as check constraints for portability)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Leagues
-- ---------------------------------------------------------------------------
create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  season_year int not null,
  phase text not null default 'futures'
    check (phase in ('futures', 'regular', 'playoff', 'completed')),
  current_week int check (current_week is null or (current_week >= 1 and current_week <= 22)),
  weekly_budget numeric(10, 2) not null default 100 check (weekly_budget > 0),
  playoff_budget numeric(10, 2) not null default 200 check (playoff_budget > 0),
  futures_budget numeric(10, 2) not null default 300 check (futures_budget > 0),
  starting_bankroll numeric(10, 2) not null default 0,
  futures_locked_at timestamptz,
  season_locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- League members
-- ---------------------------------------------------------------------------
create table public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  bankroll numeric(10, 2) not null default 0,
  is_commissioner boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create index league_members_league_id_idx on public.league_members (league_id);
create index league_members_user_id_idx on public.league_members (user_id);

-- ---------------------------------------------------------------------------
-- Bets
-- ---------------------------------------------------------------------------
create table public.bets (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  phase text not null check (phase in ('futures', 'regular', 'playoff')),
  week int check (week is null or (week >= 1 and week <= 22)),
  description text not null check (char_length(trim(description)) > 0),
  odds text not null check (odds ~ '^[+-][0-9]+$'),
  stake numeric(10, 2) not null check (stake > 0),
  profit numeric(10, 2),
  status text not null default 'pending'
    check (status in ('pending', 'won', 'lost', 'push', 'void')),
  settled_at timestamptz,
  settled_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (phase = 'futures' and week is null)
    or (phase in ('regular', 'playoff') and week is not null)
  )
);

create index bets_league_id_idx on public.bets (league_id);
create index bets_user_id_idx on public.bets (user_id);
create index bets_league_user_period_idx on public.bets (league_id, user_id, phase, week);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger leagues_set_updated_at
  before update on public.leagues
  for each row execute function public.set_updated_at();

create trigger bets_set_updated_at
  before update on public.bets
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Set member bankroll from league starting_bankroll on join
create or replace function public.set_member_starting_bankroll()
returns trigger
language plpgsql
as $$
begin
  select starting_bankroll into new.bankroll
  from public.leagues
  where id = new.league_id;

  return new;
end;
$$;

create trigger league_members_set_starting_bankroll
  before insert on public.league_members
  for each row execute function public.set_member_starting_bankroll();

-- Lock futures when league leaves futures phase
create or replace function public.lock_futures_on_phase_change()
returns trigger
language plpgsql
as $$
begin
  if old.phase = 'futures' and new.phase <> 'futures' and new.futures_locked_at is null then
    new.futures_locked_at = now();
  end if;

  if new.phase = 'completed' and new.season_locked_at is null then
    new.season_locked_at = now();
  end if;

  return new;
end;
$$;

create trigger leagues_lock_futures
  before update on public.leagues
  for each row execute function public.lock_futures_on_phase_change();

-- American odds profit calculation
create or replace function public.american_odds_profit(p_stake numeric, p_odds text)
returns numeric
language plpgsql
immutable
as $$
declare
  odds_val int;
begin
  odds_val := p_odds::int;

  if odds_val = 0 then
    raise exception 'Invalid odds: %', p_odds;
  end if;

  if odds_val < 0 then
    return round(p_stake * (100.0 / abs(odds_val)), 2);
  end if;

  return round(p_stake * (odds_val / 100.0), 2);
end;
$$;

-- Budget for a bet period (use-it-or-lose-it)
create or replace function public.period_budget(p_league_id uuid, p_phase text)
returns numeric
language sql
stable
as $$
  select case p_phase
    when 'futures' then futures_budget
    when 'regular' then weekly_budget
    when 'playoff' then playoff_budget
  end
  from public.leagues
  where id = p_league_id;
$$;

-- Enforce spending limits and phase rules on new bets
create or replace function public.validate_bet_insert()
returns trigger
language plpgsql
as $$
declare
  v_league public.leagues%rowtype;
  v_spent numeric;
  v_budget numeric;
begin
  select * into v_league from public.leagues where id = new.league_id;

  if not found then
    raise exception 'League not found';
  end if;

  if v_league.phase = 'completed' then
    raise exception 'Season is complete; no new bets allowed';
  end if;

  if new.phase = 'futures' then
    if v_league.futures_locked_at is not null then
      raise exception 'Futures betting is closed';
    end if;

    if v_league.phase <> 'futures' then
      raise exception 'League is not in futures phase';
    end if;
  end if;

  if new.phase = 'regular' then
    if v_league.phase <> 'regular' then
      raise exception 'League is not in regular season';
    end if;

    if new.week is distinct from v_league.current_week then
      raise exception 'Bets must be placed for the current week (%)', v_league.current_week;
    end if;
  end if;

  if new.phase = 'playoff' then
    if v_league.phase <> 'playoff' then
      raise exception 'League is not in playoffs';
    end if;

    if new.week is distinct from v_league.current_week then
      raise exception 'Bets must be placed for the current playoff week (%)', v_league.current_week;
    end if;
  end if;

  if not exists (
    select 1
    from public.league_members
    where league_id = new.league_id and user_id = new.user_id
  ) then
    raise exception 'User is not a member of this league';
  end if;

  v_budget := public.period_budget(new.league_id, new.phase);

  select coalesce(sum(stake), 0) into v_spent
  from public.bets
  where league_id = new.league_id
    and user_id = new.user_id
    and phase = new.phase
    and week is not distinct from new.week
    and status <> 'void';

  if v_spent + new.stake > v_budget then
    raise exception 'Exceeds % budget of % (already staked %)',
      new.phase, v_budget, v_spent;
  end if;

  return new;
end;
$$;

create trigger bets_validate_insert
  before insert on public.bets
  for each row execute function public.validate_bet_insert();

-- Settle bets and update bankroll (commissioner action via RLS)
create or replace function public.settle_bet()
returns trigger
language plpgsql
as $$
declare
  v_profit numeric;
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

  -- Prevent tampering with bet details during settlement
  if new.league_id <> old.league_id
    or new.user_id <> old.user_id
    or new.phase <> old.phase
    or new.week is distinct from old.week
    or new.description <> old.description
    or new.odds <> old.odds
    or new.stake <> old.stake
  then
    raise exception 'Cannot modify bet details during settlement';
  end if;

  new.settled_at = now();
  new.settled_by = auth.uid();

  if new.status = 'won' then
    v_profit := public.american_odds_profit(new.stake, new.odds);
    new.profit = v_profit;

    update public.league_members
    set bankroll = bankroll + new.stake + v_profit
    where league_id = new.league_id and user_id = new.user_id;
  elsif new.status = 'lost' then
    new.profit = 0;

    update public.league_members
    set bankroll = bankroll - new.stake
    where league_id = new.league_id and user_id = new.user_id;
  else
    -- push or void: no bankroll change
    new.profit = 0;
  end if;

  return new;
end;
$$;

create trigger bets_settle
  before update on public.bets
  for each row execute function public.settle_bet();

-- Commissioner check helper (used in RLS)
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

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.bets enable row level security;

-- Profiles
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

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Leagues
create policy "Members can read their leagues"
  on public.leagues for select
  to authenticated
  using (public.is_league_member(id));

create policy "Authenticated users can create leagues"
  on public.leagues for insert
  to authenticated
  with check (true);

create policy "Commissioners can update leagues"
  on public.leagues for update
  to authenticated
  using (public.is_league_commissioner(id))
  with check (public.is_league_commissioner(id));

-- League members
create policy "Members can read league roster"
  on public.league_members for select
  to authenticated
  using (public.is_league_member(league_id));

create policy "Commissioners can add members"
  on public.league_members for insert
  to authenticated
  with check (public.is_league_commissioner(league_id));

create policy "Commissioners can update members"
  on public.league_members for update
  to authenticated
  using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

-- Bets
create policy "Members can read league bets"
  on public.bets for select
  to authenticated
  using (public.is_league_member(league_id));

create policy "Members can place own bets"
  on public.bets for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_league_member(league_id)
  );

create policy "Commissioners can settle bets"
  on public.bets for update
  to authenticated
  using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

-- Auto-add creator as commissioner when creating a league
create or replace function public.add_creator_as_commissioner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.league_members (league_id, user_id, is_commissioner)
  values (new.id, auth.uid(), true);
  return new;
end;
$$;

create trigger leagues_add_creator
  after insert on public.leagues
  for each row execute function public.add_creator_as_commissioner();

-- Standings view
create or replace view public.standings
with (security_invoker = true)
as
select
  lm.league_id,
  lm.user_id,
  p.display_name,
  lm.bankroll,
  lm.is_commissioner,
  rank() over (partition by lm.league_id order by lm.bankroll desc, p.display_name asc) as standing_rank
from public.league_members lm
join public.profiles p on p.id = lm.user_id;

grant select on public.standings to authenticated;
