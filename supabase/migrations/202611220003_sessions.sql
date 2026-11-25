alter table public.planner_items
 add column category text not null default 'Personal',
 add column status text not null default 'confirmed' check(status in ('confirmed','tentative','cancelled')),
 add column locked boolean not null default false,
 add column buffer_before integer not null default 0 check(buffer_before between 0 and 1440),
 add column buffer_after integer not null default 0 check(buffer_after between 0 and 1440),
 add column duration integer not null default 60 check(duration between 1 and 1440),
 add column priority text not null default 'medium' check(priority in ('low','medium','high')),
 add column due_at timestamptz,
 add column daily boolean not null default false,
 add column template_id uuid,
 add column planning_week date,
 add column session_number integer,
 add constraint single_recurrence check(not (weekly and daily)),
 add constraint item_owner_key unique(user_id,id);

create table public.task_templates(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 title text not null check(length(title) between 1 and 200),
 duration integer not null check(duration between 1 and 1440),
 frequency integer not null check(frequency between 1 and 21),
 priority text not null check(priority in ('low','medium','high')),
 archived boolean not null default false,
 unique(user_id,id)
);
alter table public.planner_items add constraint template_owner foreign key(user_id,template_id) references public.task_templates(user_id,id);
create unique index template_week_session on public.planner_items(user_id,template_id,planning_week,session_number);

create table public.occurrence_changes(
 user_id uuid not null,
 item_id uuid not null,
 occurrence_date date not null,
 cancelled boolean not null default false,
 completed boolean not null default false,
 start_at timestamptz,
 end_at timestamptz,
 primary key(user_id,item_id,occurrence_date),
 foreign key(user_id,item_id) references public.planner_items(user_id,id),
 check((start_at is null and end_at is null) or (start_at is not null and end_at > start_at))
);
alter table public.task_templates enable row level security;
alter table public.occurrence_changes enable row level security;
grant select,insert,update on public.task_templates,public.occurrence_changes to authenticated;
create policy own_templates on public.task_templates for all to authenticated using ((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy own_occurrences on public.occurrence_changes for all to authenticated using ((select auth.uid())=user_id) with check((select auth.uid())=user_id);

create function public.guard_planner_item() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Invalid time zone'; end if;
 if TG_OP='UPDATE' then
  if old.locked and (to_jsonb(new)-'locked'-'version') is distinct from (to_jsonb(old)-'locked'-'version') then raise exception 'Unlock the activity before editing'; end if;
  if (new.start_at,new.end_at,new.timezone,new.weekly,new.daily) is distinct from (old.start_at,old.end_at,old.timezone,old.weekly,old.daily) and exists(select 1 from public.occurrence_changes where item_id=old.id and user_id=old.user_id) then raise exception 'Edit individual occurrences after recording session history'; end if;
  new.version:=old.version+1;
 end if;
 return new;
end;
$$;
create trigger guard_planner before insert or update on public.planner_items for each row execute function public.guard_planner_item();

create function public.generate_template_week(target_week date) returns void language plpgsql security invoker set search_path='' as $$
begin
 if extract(dow from target_week) <> 0 then raise exception 'Week must start Sunday'; end if;
 insert into public.planner_items(user_id,title,kind,timezone,duration,priority,template_id,planning_week,session_number)
 select t.user_id,t.title,'task',p.timezone,t.duration,t.priority,t.id,target_week,n
 from public.task_templates t join public.profiles p on p.user_id=t.user_id
 cross join lateral generate_series(1,t.frequency) n
 where t.user_id=auth.uid() and not t.archived
 on conflict (user_id,template_id,planning_week,session_number) do nothing;
end;
$$;
revoke all on function public.generate_template_week(date) from public,anon;
grant execute on function public.generate_template_week(date) to authenticated;
create function public.edit_occurrence(target_id uuid, target_date date, operation text, new_start timestamptz default null, new_end timestamptz default null) returns void language plpgsql security invoker set search_path='' as $$
declare item public.planner_items; anchor date; step integer;
begin
 select * into item from public.planner_items where id=target_id and user_id=auth.uid() for update;
 if item.id is null or item.locked then raise exception 'Activity unavailable or locked'; end if;
 if operation not in ('complete','reopen','cancel','restore','move') then raise exception 'Invalid operation'; end if;
 if item.start_at is null then
  if not item.daily then raise exception 'Activity has no recurrence'; end if;
 else
  anchor := (item.start_at at time zone item.timezone)::date;
  step := case when item.daily then 1 when item.weekly then 7 else 0 end;
  if target_date < anchor or (step=0 and target_date<>anchor) or (step=7 and (target_date-anchor)%7<>0) then raise exception 'Invalid occurrence date'; end if;
 end if;
 if operation='move' and (new_start is null or new_end is null or new_end<=new_start or (item.due_at is not null and new_end>item.due_at)) then raise exception 'Invalid range'; end if;
 insert into public.occurrence_changes(user_id,item_id,occurrence_date) values(auth.uid(),target_id,target_date) on conflict do nothing;
 update public.occurrence_changes set
  completed=case when operation='complete' then true when operation='reopen' then false else completed end,
  cancelled=case when operation='cancel' then true when operation='restore' then false else cancelled end,
  start_at=case when operation='move' then new_start else start_at end,
  end_at=case when operation='move' then new_end else end_at end
 where user_id=auth.uid() and item_id=target_id and occurrence_date=target_date;
end;
$$;
revoke all on function public.edit_occurrence(uuid,date,text,timestamptz,timestamptz) from public,anon;
grant execute on function public.edit_occurrence(uuid,date,text,timestamptz,timestamptz) to authenticated;

create function public.guard_occurrence() returns trigger language plpgsql set search_path='' as $$
declare item public.planner_items; anchor date;
begin
 select * into item from public.planner_items where id=new.item_id and user_id=new.user_id for update;
 if item.id is null or item.locked then raise exception 'Activity unavailable or locked'; end if;
 if item.start_at is not null then
  anchor:=(item.start_at at time zone item.timezone)::date;
  if new.occurrence_date<anchor or (not item.daily and not item.weekly and new.occurrence_date<>anchor) or (item.weekly and (new.occurrence_date-anchor)%7<>0) then raise exception 'Invalid occurrence date'; end if;
 elsif not item.daily then raise exception 'Activity has no recurrence';
 end if;
 if item.due_at is not null and new.end_at>item.due_at then raise exception 'Session misses deadline'; end if;
 return new;
end;
$$;
create trigger guard_occurrence before insert or update on public.occurrence_changes for each row execute function public.guard_occurrence();
create function public.sync_single_completion() returns trigger language plpgsql set search_path='' as $$
begin
 update public.planner_items set completed=new.completed where id=new.item_id and user_id=new.user_id and not weekly and not daily and completed is distinct from new.completed;
 return new;
end;
$$;
create trigger sync_single_completion after insert or update on public.occurrence_changes for each row execute function public.sync_single_completion();
