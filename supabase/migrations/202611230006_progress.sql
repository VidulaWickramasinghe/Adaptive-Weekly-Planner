create table public.workstreams (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 title text not null check(length(trim(title)) between 1 and 200),
 kind text not null check(kind in ('study','publication')),
 weekly_target integer not null default 120 check(weekly_target between 0 and 10080),
 archived boolean not null default false,
 version integer not null default 0,
 unique(user_id,id)
);
alter table public.workstreams enable row level security;
grant select,insert,update on public.workstreams to authenticated;
create policy own_workstreams on public.workstreams for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
alter table public.planner_items add column workstream_id uuid, add column stage text not null default '' check(stage in ('','research','draft','edit','fact-check','proofread','publish')), add column completed_at timestamptz,
 add foreign key(user_id,workstream_id) references public.workstreams(user_id,id);
alter table public.occurrence_changes add column completed_at timestamptz;
create function public.stamp_completion() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.completed then new.completed_at:=coalesce(new.completed_at,now()); else new.completed_at:=null; end if;
 elsif new.completed is distinct from old.completed then
  new.completed_at:=case when new.completed then now() else null end;
 else new.completed_at:=old.completed_at;
 end if;
 return new;
end $$;
create trigger stamp_item_completion before insert or update on public.planner_items for each row execute function public.stamp_completion();
create trigger stamp_occurrence_completion before insert or update on public.occurrence_changes for each row execute function public.stamp_completion();
create table public.screen_time (
 user_id uuid not null references auth.users(id),
 local_date date not null,
 kind text not null check(kind in ('productive','recreational')),
 minutes integer not null check(minutes between 0 and 1440),
 version integer not null default 0,
 primary key(user_id,local_date,kind)
);
alter table public.screen_time enable row level security;
grant select,insert,update on public.screen_time to authenticated;
create policy own_screen_time on public.screen_time for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create function public.progress_version() returns trigger language plpgsql set search_path='' as $$
begin new.version:=old.version+1; return new; end $$;
create trigger screen_version before update on public.screen_time for each row execute function public.progress_version();
create trigger stream_version before update on public.workstreams for each row execute function public.progress_version();
revoke all on function public.stamp_completion(),public.progress_version() from public,anon,authenticated;
