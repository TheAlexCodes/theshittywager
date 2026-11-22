-- Commissioner can force a single weekly board open (including past weeks).

alter table public.league_settings
  add column if not exists manual_betting_week_id bigint references public.weeks (id) on delete set null;

create or replace function public.league_settings_check_manual_week()
returns trigger
language plpgsql
as $$
begin
  if new.manual_betting_week_id is not null then
    if not exists (
      select 1
      from public.weeks w
      where w.id = new.manual_betting_week_id
        and w.league_id = new.league_id
        and w.phase <> 'futures'
    ) then
      raise exception 'manual_betting_week_id must be a weekly or playoff week in this league';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists league_settings_check_manual_week on public.league_settings;

create trigger league_settings_check_manual_week
  before insert or update of manual_betting_week_id, league_id
  on public.league_settings
  for each row
  execute function public.league_settings_check_manual_week();

create or replace function public.validate_bet_insert()
returns trigger
language plpgsql
as $$
declare
  v_week public.weeks%rowtype;
  v_spent integer;
  v_manual_week_id bigint;
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

  select ls.manual_betting_week_id into v_manual_week_id
  from public.league_settings ls
  where ls.league_id = new.league_id;

  if v_manual_week_id is not null then
    if v_week.id <> v_manual_week_id then
      raise exception 'Betting is only open for the commissioner-selected week';
    end if;
  else
    if v_week.reveal_at > now() then
      raise exception 'Betting for this week is not open yet';
    end if;

    if v_week.betting_closes_at is not null and v_week.betting_closes_at <= now() then
      raise exception 'Betting for this week is closed';
    end if;

    if exists (
      select 1
      from public.weeks w_next
      where w_next.league_id = v_week.league_id
        and w_next.phase <> 'futures'
        and w_next.week_number > v_week.week_number
        and w_next.reveal_at <= now()
    ) then
      raise exception 'Betting for this week is closed';
    end if;
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