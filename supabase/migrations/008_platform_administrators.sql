-- Platform administrators: commissioner-level access to every league.

alter table public.profiles
  add column if not exists is_administrator boolean not null default false;

create or replace function public.is_administrator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_administrator from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_administrator() to authenticated;

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

create or replace function public.can_access_league(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_administrator()
    or public.is_league_member(p_league_id);
$$;

grant execute on function public.can_access_league(uuid) to authenticated;

create or replace function public.is_league_commissioner(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_administrator()
    or exists (
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
  select public.is_administrator()
    or exists (
      select 1
      from public.league_members
      where user_id = auth.uid()
        and is_commissioner = true
    );
$$;

create or replace function public.guard_administrator_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_administrator is distinct from old.is_administrator then
    -- SQL Editor / migrations run without a JWT; allow one-time bootstrap.
    if auth.uid() is null then
      return new;
    end if;

    if not public.is_administrator() then
      raise exception 'Only administrators can change administrator access';
    end if;

    if old.id = auth.uid() and not new.is_administrator then
      raise exception 'Cannot remove your own administrator access';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_administrator_flag_trigger on public.profiles;
create trigger guard_administrator_flag_trigger
  before update on public.profiles
  for each row
  execute function public.guard_administrator_flag();

-- RLS: read access for members and platform administrators
drop policy if exists "Members can read their leagues" on public.leagues;
create policy "Members can read their leagues"
  on public.leagues for select
  to authenticated
  using (public.can_access_league(id));

drop policy if exists "Members can read league roster" on public.league_members;
create policy "Members can read league roster"
  on public.league_members for select
  to authenticated
  using (public.can_access_league(league_id));

drop policy if exists "Members can read league weeks" on public.weeks;
create policy "Members can read league weeks"
  on public.weeks for select
  to authenticated
  using (public.can_access_league(league_id));

drop policy if exists "Members can read league bets" on public.bets;
create policy "Members can read league bets"
  on public.bets for select
  to authenticated
  using (public.can_access_league(league_id));

drop policy if exists "Members can read league futures" on public.futures;
create policy "Members can read league futures"
  on public.futures for select
  to authenticated
  using (public.can_access_league(league_id));

drop policy if exists "Members can read league settings" on public.league_settings;
create policy "Members can read league settings"
  on public.league_settings for select
  to authenticated
  using (public.can_access_league(league_id));

drop policy if exists "Users can read profiles in shared leagues" on public.profiles;
create policy "Users can read profiles in shared leagues"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or public.is_administrator()
    or exists (
      select 1
      from public.league_members mine
      join public.league_members theirs on mine.league_id = theirs.league_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );

drop policy if exists "Commissioners can update league member profiles" on public.profiles;
create policy "Commissioners can update league member profiles"
  on public.profiles for update
  to authenticated
  using (
    public.is_administrator()
    or id = auth.uid()
    or exists (
      select 1
      from public.league_members mine
      join public.league_members theirs on mine.league_id = theirs.league_id
      where mine.user_id = auth.uid()
        and mine.is_commissioner = true
        and theirs.user_id = profiles.id
    )
  )
  with check (
    public.is_administrator()
    or id = auth.uid()
    or exists (
      select 1
      from public.league_members mine
      join public.league_members theirs on mine.league_id = theirs.league_id
      where mine.user_id = auth.uid()
        and mine.is_commissioner = true
        and theirs.user_id = profiles.id
    )
  );
