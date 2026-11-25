alter table public.planner_items
 add column can_split boolean not null default false,
 add column minimum_session integer not null default 30 check(minimum_session between 1 and 1440),
 add column earliest_at timestamptz,
 add column preferred_start integer not null default 0 check(preferred_start between 0 and 22),
 add column preferred_end integer not null default 23 check(preferred_end between 1 and 23),
 add constraint task_window check(preferred_end>preferred_start);
create table public.schedule_proposals(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 planning_week timestamptz not null,
 timezone text not null,
 unique(user_id,id)
);
create table public.proposal_entries(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null,
 proposal_id uuid not null,
 task_id uuid not null,
 title text not null,
 start_at timestamptz,
 end_at timestamptz,
 reason text not null,
 foreign key(user_id,proposal_id) references public.schedule_proposals(user_id,id),
 foreign key(user_id,task_id) references public.planner_items(user_id,id),
 check((start_at is null and end_at is null) or end_at>start_at)
);
alter table public.schedule_proposals enable row level security;
alter table public.proposal_entries enable row level security;
grant select,insert on public.schedule_proposals,public.proposal_entries to authenticated;
create policy own_proposals on public.schedule_proposals for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_entries on public.proposal_entries for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create function public.save_proposal(week_start timestamptz,zone text,entries jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare proposal uuid;
begin
 insert into public.schedule_proposals(user_id,planning_week,timezone) values(auth.uid(),week_start,zone) returning id into proposal;
 insert into public.proposal_entries(user_id,proposal_id,task_id,title,start_at,end_at,reason)
 select auth.uid(),proposal,(e->>'id')::uuid,e->>'title',(e->>'start_at')::timestamptz,(e->>'end_at')::timestamptz,coalesce(e->>'reason','Fits availability, deadline and daily capacity')
 from jsonb_array_elements(entries) e;
 return proposal;
end;
$$;
revoke all on function public.save_proposal(timestamptz,text,jsonb) from public,anon;
grant execute on function public.save_proposal(timestamptz,text,jsonb) to authenticated;
