-- Link manually-created profiles to auth accounts on first login
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

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());
