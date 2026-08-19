-- Platform administrators can permanently delete a league and all related data.

create or replace function public.delete_league(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_administrator() then
    raise exception 'Platform administrator access required';
  end if;

  if not exists (select 1 from public.leagues where id = p_league_id) then
    raise exception 'League not found';
  end if;

  delete from public.bets where league_id = p_league_id;
  delete from public.futures where league_id = p_league_id;
  delete from public.weeks where league_id = p_league_id;
  delete from public.league_settings where league_id = p_league_id;
  delete from public.leagues where id = p_league_id;
end;
$$;

grant execute on function public.delete_league(uuid) to authenticated;
