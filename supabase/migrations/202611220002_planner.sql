create table public.planner_items (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 title text not null check(length(title) between 1 and 200),
 kind text not null check(kind in ('commitment','task','routine','protected')),
 start_at timestamptz,
 end_at timestamptz,
 timezone text not null,
 weekly boolean not null default false,
 completed boolean not null default false,
 archived boolean not null default false,
 version integer not null default 0,
 check ((start_at is null and end_at is null) or (start_at is not null and end_at > start_at)),
 check (kind in ('task','routine') or start_at is not null),
 check (not weekly or start_at is not null)
);
alter table public.planner_items enable row level security;
grant select,insert,update on public.planner_items to authenticated;
create policy own_items on public.planner_items for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create index planner_owner on public.planner_items(user_id);
