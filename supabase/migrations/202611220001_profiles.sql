create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'Australia/Melbourne',
  week_start_day smallint not null default 0 check (week_start_day = 0),
  preferred_daily_capacity integer not null default 240 check (preferred_daily_capacity between 0 and 1440),
  version integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (timezone, preferred_daily_capacity) on public.profiles to authenticated;
create policy "Read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "Update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.validate_profile() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'Invalid time zone';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
create trigger validate_profile before update on public.profiles for each row execute function public.validate_profile();

create function public.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.create_profile() from public, anon, authenticated;
create trigger create_profile after insert on auth.users for each row execute function public.create_profile();
insert into public.profiles (user_id) select id from auth.users on conflict do nothing;
