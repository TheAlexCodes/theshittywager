-- Weekly betting closes at the first weekend kickoff (Sat/Sun ET), not the first mid-week game.

alter table public.weeks
  add column if not exists betting_closes_at timestamptz;

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

  if v_week.betting_closes_at is not null and v_week.betting_closes_at <= now() then
    raise exception 'Betting for this week is closed';
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
