-- Fix: allow setting the first administrator from Supabase SQL Editor (no auth JWT).

create or replace function public.guard_administrator_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_administrator is distinct from old.is_administrator then
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
