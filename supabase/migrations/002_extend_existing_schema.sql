-- The Shitty Wager — extend existing schema
-- Safe to run on projects that already have: profiles, weeks, bets, futures
-- Run in Supabase SQL Editor

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists bankroll integer not null default 0;

alter table public.bets
  add column if not exists settled_at timestamptz,
  add column if not exists settled_by uuid references public.profiles (id);

alter table public.futures
  add column if not exists settled_at timestamptz,
  add column if not exists settled_by uuid references public.profiles (id),
  add column if not exists created_at timestamptz default now();

-- ---------------------------------------------------------------------------
-- Constraints (skip if already present)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bets_player_id_fkey'
  ) then
    alter table public.bets
      add constraint bets_player_id_fkey
      foreign key (player_id) references public.profiles (id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bets_week_id_fkey'
  ) then
    alter table public.bets
      add constraint bets_week_id_fkey
      foreign key (week_id) references public.weeks (id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'futures_player_id_fkey'
  ) then
    alter table public.futures
      add constraint futures_player_id_fkey
      foreign key (player_id) references public.profiles (id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bets_status_check'
  ) then
    alter table public.bets
      add constraint bets_status_check
      check (status in ('pending', 'won', 'lost', 'push', 'void'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'futures_status_check'
  ) then
    alter table public.futures
      add constraint futures_status_check
      check (status in ('pending', 'won', 'lost', 'push', 'void'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bets_stake_positive'
  ) then
    alter table public.bets
      add constraint bets_stake_positive
      check (stake is null or stake > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'futures_stake_positive'
  ) then
    alter table public.futures
      add constraint futures_stake_positive
      check (stake is null or stake > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bets_american_odds_nonzero'
  ) then
    alter table public.bets
      add constraint bets_american_odds_nonzero
      check (american_odds is null or american_odds <> 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'futures_american_odds_nonzero'
  ) then
    alter table public.futures
      add constraint futures_american_odds_nonzero
      check (american_odds is null or american_odds <> 0);
  end if;
end $$;

create index if not exists bets_player_week_idx on public.bets (player_id, week_id);
create index if not exists bets_week_id_idx on public.bets (week_id);
create index if not exists futures_player_id_idx on public.futures (player_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_commissioner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_commissioner from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.american_odds_profit(p_stake integer, p_odds integer)
returns integer
language plpgsql
immutable
as $$
begin
  if p_stake is null or p_odds is null or p_odds = 0 then
    raise exception 'Invalid stake or odds';
  end if;

  if p_odds < 0 then
    return round(p_stake * (100.0 / abs(p_odds)));
  end if;

  return round(p_stake * (p_odds / 100.0));
end;
$$;

create or replace function public.futures_allowance()
returns integer
language sql
stable
as $$
  select coalesce(
    (select allowance from public.weeks where phase = 'futures' order by week_number limit 1),
    300
  );
$$;

create or replace function public.futures_is_locked()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.weeks
    where phase = 'regular'
      and reveal_at <= now()
  );
$$;

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup
-- ---------------------------------------------------------------------------
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
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Bet validation (use-it-or-lose-it weekly budget)
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

  if v_week.phase = 'futures' then
    raise exception 'Use the futures table for futures wagers';
  end if;

  if v_week.reveal_at > now() then
    raise exception 'Betting for this week is not open yet';
  end if;

  if not exists (select 1 from public.profiles where id = new.player_id) then
    raise exception 'Player not found';
  end if;

  select coalesce(sum(stake), 0) into v_spent
  from public.bets
  where player_id = new.player_id
    and week_id = new.week_id
    and status <> 'void';

  if v_spent + new.stake > v_week.allowance then
    raise exception 'Exceeds week allowance of % (already staked %)',
      v_week.allowance, v_spent;
  end if;

  return new;
end;
$$;

drop trigger if exists bets_validate_insert on public.bets;

create trigger bets_validate_insert
  before insert on public.bets
  for each row execute function public.validate_bet_insert();

-- ---------------------------------------------------------------------------
-- Futures validation (use-it-or-lose-it futures budget)
-- ---------------------------------------------------------------------------
create or replace function public.validate_futures_insert()
returns trigger
language plpgsql
as $$
declare
  v_allowance integer;
  v_spent integer;
begin
  if public.futures_is_locked() then
    raise exception 'Futures betting is closed';
  end if;

  if not exists (select 1 from public.profiles where id = new.player_id) then
    raise exception 'Player not found';
  end if;

  v_allowance := public.futures_allowance();

  select coalesce(sum(stake), 0) into v_spent
  from public.futures
  where player_id = new.player_id
    and status <> 'void';

  if v_spent + new.stake > v_allowance then
    raise exception 'Exceeds futures allowance of % (already staked %)',
      v_allowance, v_spent;
  end if;

  return new;
end;
$$;

drop trigger if exists futures_validate_insert on public.futures;

create trigger futures_validate_insert
  before insert on public.futures
  for each row execute function public.validate_futures_insert();

-- ---------------------------------------------------------------------------
-- Settlement (commissioner updates status → bankroll + payout)
-- ---------------------------------------------------------------------------
create or replace function public.settle_bet()
returns trigger
language plpgsql
as $$
declare
  v_profit integer;
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
    or new.bet_type is distinct from old.bet_type
    or new.selection is distinct from old.selection
    or new.stake <> old.stake
    or new.american_odds is distinct from old.american_odds
  then
    raise exception 'Cannot modify bet details during settlement';
  end if;

  new.settled_at = now();
  new.settled_by = auth.uid();

  if new.status = 'won' then
    v_profit := public.american_odds_profit(new.stake, new.american_odds);
    new.payout := new.stake + v_profit;

    update public.profiles
    set bankroll = bankroll + new.payout
    where id = new.player_id;
  elsif new.status = 'lost' then
    new.payout := 0;

    update public.profiles
    set bankroll = bankroll - new.stake
    where id = new.player_id;
  else
    new.payout := 0;
  end if;

  return new;
end;
$$;

drop trigger if exists bets_settle on public.bets;

create trigger bets_settle
  before update on public.bets
  for each row execute function public.settle_bet();

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

    update public.profiles
    set bankroll = bankroll + new.payout
    where id = new.player_id;
  elsif new.status = 'lost' then
    new.payout := 0;

    update public.profiles
    set bankroll = bankroll - new.stake
    where id = new.player_id;
  else
    new.payout := 0;
  end if;

  return new;
end;
$$;

drop trigger if exists futures_settle on public.futures;

create trigger futures_settle
  before update on public.futures
  for each row execute function public.settle_future();

-- ---------------------------------------------------------------------------
-- Standings
-- ---------------------------------------------------------------------------
create or replace view public.standings
with (security_invoker = true)
as
select
  id as player_id,
  display_name,
  bankroll,
  is_commissioner,
  rank() over (order by bankroll desc, display_name asc) as standing_rank
from public.profiles;

grant select on public.standings to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.weeks enable row level security;
alter table public.bets enable row level security;
alter table public.futures enable row level security;

-- Profiles
drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Commissioners can update profiles" on public.profiles;
create policy "Commissioners can update profiles"
  on public.profiles for update
  to authenticated
  using (public.is_commissioner())
  with check (public.is_commissioner());

-- Weeks
drop policy if exists "Authenticated users can read weeks" on public.weeks;
create policy "Authenticated users can read weeks"
  on public.weeks for select
  to authenticated
  using (true);

drop policy if exists "Commissioners can manage weeks" on public.weeks;
create policy "Commissioners can manage weeks"
  on public.weeks for all
  to authenticated
  using (public.is_commissioner())
  with check (public.is_commissioner());

-- Bets
drop policy if exists "Authenticated users can read bets" on public.bets;
create policy "Authenticated users can read bets"
  on public.bets for select
  to authenticated
  using (true);

drop policy if exists "Players can place own bets" on public.bets;
create policy "Players can place own bets"
  on public.bets for insert
  to authenticated
  with check (player_id = auth.uid());

drop policy if exists "Commissioners can settle bets" on public.bets;
create policy "Commissioners can settle bets"
  on public.bets for update
  to authenticated
  using (public.is_commissioner())
  with check (public.is_commissioner());

-- Futures
drop policy if exists "Authenticated users can read futures" on public.futures;
create policy "Authenticated users can read futures"
  on public.futures for select
  to authenticated
  using (true);

drop policy if exists "Players can place own futures" on public.futures;
create policy "Players can place own futures"
  on public.futures for insert
  to authenticated
  with check (player_id = auth.uid());

drop policy if exists "Commissioners can settle futures" on public.futures;
create policy "Commissioners can settle futures"
  on public.futures for update
  to authenticated
  using (public.is_commissioner())
  with check (public.is_commissioner());
