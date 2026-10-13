-- Allow commissioners to adjust American odds when settling (e.g. parlay leg push).

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
  then
    raise exception 'Cannot modify bet details during settlement';
  end if;

  if new.status = 'won' and (new.american_odds is null or new.american_odds = 0) then
    raise exception 'Winning bets require valid American odds';
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
  then
    raise exception 'Cannot modify future details during settlement';
  end if;

  if new.status = 'won' and (new.american_odds is null or new.american_odds = 0) then
    raise exception 'Winning futures require valid American odds';
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
