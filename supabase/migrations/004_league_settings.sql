-- League-wide budget settings (commissioner only)
create table if not exists public.league_settings (
  id int primary key default 1 check (id = 1),
  weekly_allowance int not null default 100 check (weekly_allowance > 0),
  futures_allowance int not null default 300 check (futures_allowance > 0),
  playoff_allowance int not null default 200 check (playoff_allowance > 0),
  season_year int not null default 2026,
  updated_at timestamptz not null default now()
);

insert into public.league_settings (id)
values (1)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'weeks_phase_week_number_unique'
  ) then
    alter table public.weeks
      add constraint weeks_phase_week_number_unique unique (phase, week_number);
  end if;
end $$;

create or replace function public.apply_league_allowances()
returns void
language sql
security definer
set search_path = public
as $$
  update public.weeks w
  set allowance = s.futures_allowance
  from public.league_settings s
  where s.id = 1 and w.phase = 'futures';

  update public.weeks w
  set allowance = s.weekly_allowance
  from public.league_settings s
  where s.id = 1 and w.phase = 'regular';

  update public.weeks w
  set allowance = s.playoff_allowance
  from public.league_settings s
  where s.id = 1 and w.phase = 'playoff';
$$;

grant execute on function public.apply_league_allowances() to authenticated;

create or replace function public.league_settings_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  perform public.apply_league_allowances();
  return new;
end;
$$;

drop trigger if exists league_settings_apply_allowances on public.league_settings;

create trigger league_settings_apply_allowances
  after update on public.league_settings
  for each row execute function public.league_settings_set_updated_at();

alter table public.league_settings enable row level security;

drop policy if exists "Authenticated users can read league settings" on public.league_settings;
create policy "Authenticated users can read league settings"
  on public.league_settings for select
  to authenticated
  using (true);

drop policy if exists "Commissioners can update league settings" on public.league_settings;
create policy "Commissioners can update league settings"
  on public.league_settings for update
  to authenticated
  using (public.is_commissioner())
  with check (public.is_commissioner());
