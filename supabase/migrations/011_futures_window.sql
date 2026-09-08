-- Commissioner-controlled futures betting window (open/close overrides).

alter table public.league_settings
  add column if not exists futures_opens_at timestamptz,
  add column if not exists futures_closes_at timestamptz;

create or replace function public.futures_is_locked(p_league_id uuid)
returns boolean
language sql
stable
as $$
  with settings as (
    select futures_opens_at, futures_closes_at
    from public.league_settings
    where league_id = p_league_id
  ),
  schedule as (
    select
      (
        select reveal_at
        from public.weeks
        where league_id = p_league_id
          and phase = 'futures'
        order by week_number
        limit 1
      ) as default_opens,
      (
        select reveal_at
        from public.weeks
        where league_id = p_league_id
          and phase = 'regular'
          and week_number = 1
        limit 1
      ) as default_closes
  )
  select not (
    now() >= coalesce((select futures_opens_at from settings), (select default_opens from schedule))
    and (
      coalesce((select futures_closes_at from settings), (select default_closes from schedule)) is null
      or now() < coalesce((select futures_closes_at from settings), (select default_closes from schedule))
    )
  );
$$;
