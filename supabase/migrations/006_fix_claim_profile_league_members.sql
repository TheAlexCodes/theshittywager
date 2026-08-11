-- When claim_profile_by_email re-links a manual profile to auth.uid(),
-- also move league membership rows (commissioner status lives there after 005).

create or replace function public.claim_profile_by_email()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_profile public.profiles%rowtype;
  v_old_id uuid;
begin
  v_email := auth.jwt() ->> 'email';

  if auth.uid() is null or v_email is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile
  from public.profiles
  where id = auth.uid();

  if found then
    return v_profile;
  end if;

  select * into v_profile
  from public.profiles
  where lower(email) = lower(v_email)
  limit 1;

  if not found then
    insert into public.profiles (id, email, display_name)
    values (
      auth.uid(),
      v_email,
      split_part(v_email, '@', 1)
    )
    returning * into v_profile;

    return v_profile;
  end if;

  if v_profile.id = auth.uid() then
    return v_profile;
  end if;

  v_old_id := v_profile.id;

  update public.bets set player_id = auth.uid() where player_id = v_old_id;
  update public.futures set player_id = auth.uid() where player_id = v_old_id;
  update public.league_members set user_id = auth.uid() where user_id = v_old_id;
  update public.leagues set created_by = auth.uid() where created_by = v_old_id;
  update public.league_invites set created_by = auth.uid() where created_by = v_old_id;

  update public.profiles
  set id = auth.uid()
  where id = v_old_id;

  select * into v_profile
  from public.profiles
  where id = auth.uid();

  return v_profile;
end;
$$;

grant execute on function public.claim_profile_by_email() to authenticated;

-- Repair memberships orphaned by earlier profile re-links (005 ran before this fix).
update public.league_members lm
set user_id = p.id
from public.profiles p
where lm.is_commissioner = true
  and p.is_commissioner = true
  and lm.user_id <> p.id
  and not exists (
    select 1
    from public.profiles orphan
    where orphan.id = lm.user_id
  );

update public.league_members lm
set user_id = b.player_id
from (
  select lm2.id as membership_id, b.player_id
  from public.league_members lm2
  cross join lateral (
    select distinct player_id
    from public.bets
    where league_id = lm2.league_id
      and player_id in (select id from public.profiles)
  ) b
  where not exists (
    select 1
    from public.profiles p
    where p.id = lm2.user_id
  )
  group by lm2.id, b.player_id, lm2.league_id
  having (
    select count(distinct player_id)
    from public.bets
    where league_id = lm2.league_id
      and player_id in (select id from public.profiles)
  ) = 1
) b
where lm.id = b.membership_id
  and lm.user_id <> b.player_id;
