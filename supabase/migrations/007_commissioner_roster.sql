-- Allow commissioners to edit team names for players in their leagues.
-- Prevent removing the last commissioner from a league.

drop policy if exists "Commissioners can update league member profiles" on public.profiles;
create policy "Commissioners can update league member profiles"
  on public.profiles for update
  to authenticated
  using (
    exists (
      select 1
      from public.league_members mine
      join public.league_members theirs on mine.league_id = theirs.league_id
      where mine.user_id = auth.uid()
        and mine.is_commissioner = true
        and theirs.user_id = profiles.id
    )
  )
  with check (
    exists (
      select 1
      from public.league_members mine
      join public.league_members theirs on mine.league_id = theirs.league_id
      where mine.user_id = auth.uid()
        and mine.is_commissioner = true
        and theirs.user_id = profiles.id
    )
  );

create or replace function public.guard_last_commissioner()
returns trigger
language plpgsql
as $$
declare
  v_commissioner_count integer;
begin
  if tg_op = 'UPDATE'
    and old.is_commissioner = true
    and new.is_commissioner = false then
    select count(*) into v_commissioner_count
    from public.league_members
    where league_id = old.league_id
      and is_commissioner = true;

    if v_commissioner_count <= 1 then
      raise exception 'Cannot remove the last commissioner from a league';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_last_commissioner_trigger on public.league_members;
create trigger guard_last_commissioner_trigger
  before update on public.league_members
  for each row
  execute function public.guard_last_commissioner();
