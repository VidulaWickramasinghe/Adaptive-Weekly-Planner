-- Atomic schedule revisions. Live chunks retain their original task identity.
create table public.schedule_slots (
 user_id uuid not null,
 task_id uuid not null,
 occurrence_key text not null,
 ordinal integer not null check(ordinal>=0),
 start_at timestamptz,
 end_at timestamptz,
 primary key(user_id,task_id,occurrence_key,ordinal),
 foreign key(user_id,task_id) references public.planner_items(user_id,id),
 check((ordinal=0 and start_at is null and end_at is null) or
       (ordinal>0 and start_at is not null and end_at is not null and end_at>start_at))
);
alter table public.schedule_slots enable row level security;
create policy own_slots on public.schedule_slots for select to authenticated using(user_id=(select auth.uid()));
grant select on public.schedule_slots to authenticated;
alter table public.schedule_proposals
 add column status text not null default 'review' check(status in ('review','accepted','rejected','undone')),
 add column base_fingerprint text,
 add column accepted_fingerprint text,
 add column start_hour integer not null default 0,
 add column end_hour integer not null default 23,
 add column decided_at timestamptz;
alter table public.proposal_entries add column occurrence_key text not null default 'single', add column before_spans jsonb not null default '[]';
create table public.revision_before (
 user_id uuid not null,
 proposal_id uuid not null,
 task_id uuid not null,
 occurrence_key text not null,
 slots jsonb not null,
 primary key(user_id,proposal_id,task_id,occurrence_key),
 foreign key(user_id,proposal_id) references public.schedule_proposals(user_id,id),
 foreign key(user_id,task_id) references public.planner_items(user_id,id)
);
alter table public.revision_before enable row level security;
create policy own_revision_before on public.revision_before for select to authenticated using(user_id=(select auth.uid()));
grant select on public.revision_before to authenticated;
-- Every planning mutation takes the same lock before locking individual rows.
create function public.lock_planning() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null then perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0)); end if;
 return null;
end $$;
create trigger planning_items_lock before insert or update or delete on public.planner_items for each statement execute function public.lock_planning();
create trigger planning_changes_lock before insert or update or delete on public.occurrence_changes for each statement execute function public.lock_planning();
create trigger planning_profiles_lock before insert or update or delete on public.profiles for each statement execute function public.lock_planning();
create trigger planning_templates_lock before insert or update or delete on public.task_templates for each statement execute function public.lock_planning();
-- A single MVCC snapshot supplies both inputs and their concurrency token.
create function public.planning_snapshot() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('profile',(select to_jsonb(p) from public.profiles p where user_id=auth.uid()),
 'items',coalesce((select jsonb_agg(to_jsonb(i) order by id) from public.planner_items i where user_id=auth.uid() and not archived),'[]'),
 'changes',coalesce((select jsonb_agg(to_jsonb(c) order by item_id,occurrence_date) from public.occurrence_changes c where user_id=auth.uid()),'[]'),
 'slots',coalesce((select jsonb_agg(to_jsonb(s) order by task_id,occurrence_key,ordinal) from public.schedule_slots s where user_id=auth.uid()),'[]'))
$$;
create function public.planning_fingerprint() returns text language sql stable security definer set search_path='' as $$ select md5(public.planning_snapshot()::text) $$;
-- Expand supported recurrences and exceptions for constraint checks, including
-- buffered boundaries and exceptions moved from outside the requested range.
create function public.calendar_spans(range_start timestamptz,range_end timestamptz)
returns table(task_id uuid,occurrence_key text,start_at timestamptz,end_at timestamptz,buffer_before integer,buffer_after integer,kind text,completed boolean,locked boolean)
language sql stable security definer set search_path='' as $$
 with items as (select * from public.planner_items where user_id=auth.uid() and not archived and status<>'cancelled'),
 dates as (
 select i.*,d::date as occurrence_date from items i cross join lateral generate_series(
 case when i.weekly or i.daily then greatest((i.start_at at time zone i.timezone)::date,(range_start at time zone i.timezone)::date - ceil(extract(epoch from(i.end_at-i.start_at))/86400)::integer-2) else (i.start_at at time zone i.timezone)::date end,
 case when i.weekly or i.daily then (range_end at time zone i.timezone)::date+2 else (i.start_at at time zone i.timezone)::date end,interval '1 day') d
 where i.start_at is not null and (not i.weekly or (d::date-(i.start_at at time zone i.timezone)::date)%7=0)
 ), manual as (
 select d.id as task_id,case when d.weekly or d.daily then d.occurrence_date::text else 'single' end as occurrence_key,
 coalesce(c.start_at,((d.start_at at time zone d.timezone)+(d.occurrence_date-(d.start_at at time zone d.timezone)::date)*interval '1 day') at time zone d.timezone) as start_at,
 coalesce(c.end_at,((d.end_at at time zone d.timezone)+(d.occurrence_date-(d.start_at at time zone d.timezone)::date)*interval '1 day') at time zone d.timezone) as end_at,
 d.buffer_before,d.buffer_after,d.kind,coalesce(c.completed,d.completed) as completed,d.locked
 from dates d left join public.occurrence_changes c on c.user_id=auth.uid() and c.item_id=d.id and c.occurrence_date=d.occurrence_date
 where not coalesce(c.cancelled,false)
 union
 select i.id,case when i.weekly or i.daily then c.occurrence_date::text else 'single' end,c.start_at,c.end_at,i.buffer_before,i.buffer_after,i.kind,c.completed,i.locked
 from items i join public.occurrence_changes c on c.item_id=i.id and c.user_id=auth.uid()
 where c.start_at is not null and not c.cancelled
 ), combined as (
 select m.* from manual m where not exists(select 1 from public.schedule_slots s where s.user_id=auth.uid() and s.task_id=m.task_id and s.occurrence_key=m.occurrence_key)
 union all
 select s.task_id,s.occurrence_key,s.start_at,s.end_at,i.buffer_before,i.buffer_after,i.kind,coalesce(c.completed,i.completed),i.locked
 from public.schedule_slots s join items i on i.id=s.task_id
 left join public.occurrence_changes c on c.user_id=auth.uid() and c.item_id=s.task_id and c.occurrence_date::text=s.occurrence_key
 where s.user_id=auth.uid() and s.ordinal>0 and not coalesce(c.cancelled,false)
 ) select * from combined where end_at+buffer_after*interval '1 minute'>range_start and start_at-buffer_before*interval '1 minute'<range_end
$$;
create function public.save_revision(week_start timestamptz,zone text,entries jsonb,fingerprint text,start_hour integer,end_hour integer) returns uuid language plpgsql security definer set search_path='' as $$
declare proposal uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if auth.uid() is null or fingerprint is distinct from public.planning_fingerprint() then raise exception 'Planning inputs changed. Generate a fresh proposal.'; end if;
 if start_hour<0 or end_hour>23 or end_hour<=start_hour or extract(dow from week_start at time zone zone)<>0 or (week_start at time zone zone)::time<>'00:00'::time then raise exception 'Invalid planning window'; end if;
 if jsonb_array_length(entries)>1000 then raise exception 'Too many proposal entries'; end if;
 insert into public.schedule_proposals(user_id,planning_week,timezone,base_fingerprint,start_hour,end_hour)
 values(auth.uid(),week_start,zone,fingerprint,start_hour,end_hour) returning id into proposal;
 insert into public.proposal_entries(user_id,proposal_id,task_id,title,start_at,end_at,reason,occurrence_key,before_spans)
 select auth.uid(),proposal,(e->>'id')::uuid,e->>'title',(e->>'start_at')::timestamptz,(e->>'end_at')::timestamptz,coalesce(e->>'reason','Fits availability, deadline and daily capacity'),coalesce(e->>'occurrence_key','single'),coalesce(e->'before_spans','[]') from jsonb_array_elements(entries)e;
 return proposal;
end $$;
-- Validate only changed groups; pre-existing fixed/fixed conflicts remain visible.
create function public.validate_revision(target uuid,undoing boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare p public.schedule_proposals; g record; i public.planner_items; s record; count_chunks integer; total numeric; finish timestamptz; expected numeric;
begin
 select * into strict p from public.schedule_proposals where id=target and user_id=auth.uid();
 finish:=((p.planning_week at time zone p.timezone)+interval '7 days') at time zone p.timezone;
 for g in select distinct task_id,occurrence_key from public.proposal_entries where proposal_id=target and user_id=auth.uid() loop
  select * into strict i from public.planner_items where id=g.task_id and user_id=auth.uid();
  if i.kind<>'task' or i.locked or i.completed or i.archived or i.status='cancelled' then raise exception 'An activity is no longer eligible'; end if;
  if (i.weekly or i.daily) then
   if g.occurrence_key='single' or g.occurrence_key::date<(i.start_at at time zone i.timezone)::date or (i.weekly and (g.occurrence_key::date-(i.start_at at time zone i.timezone)::date)%7<>0) then raise exception 'Invalid occurrence'; end if;
  elsif g.occurrence_key<>'single' then raise exception 'Invalid task identity'; end if;
  if exists(select 1 from public.occurrence_changes c where c.user_id=auth.uid() and c.item_id=i.id and (c.occurrence_date::text=g.occurrence_key or (g.occurrence_key='single' and c.occurrence_date=(i.start_at at time zone i.timezone)::date)) and (c.completed or c.cancelled)) then raise exception 'Occurrence completed or skipped'; end if;
  select count(*),coalesce(sum(extract(epoch from(end_at-start_at))/60),0) into count_chunks,total from public.schedule_slots where user_id=auth.uid() and task_id=g.task_id and occurrence_key=g.occurrence_key and ordinal>0;
  if count_chunks>0 and exists(select 1 from public.schedule_slots where user_id=auth.uid() and task_id=g.task_id and occurrence_key=g.occurrence_key and ordinal=0) then raise exception 'Mixed allocated and unallocated entries'; end if;
  if exists(select 1 from public.schedule_slots where user_id=auth.uid() and task_id=g.task_id and occurrence_key=g.occurrence_key and ordinal>0 group by start_at having count(*)>1) then raise exception 'Duplicate chunks'; end if;
  if not undoing and exists(select 1 from public.schedule_slots where user_id=auth.uid() and task_id=g.task_id and occurrence_key=g.occurrence_key and ordinal>0 and (start_at<p.planning_week or end_at>finish)) then raise exception 'Placement outside planning week'; end if;
  if count_chunks>1 and not i.can_split then raise exception 'Splitting is disabled'; end if;
  expected:=i.duration;
  -- Moving a manually resized occurrence preserves its actual duration.
  if i.start_at is not null then expected:=extract(epoch from(i.end_at-i.start_at))/60; end if;
  if exists(select 1 from public.revision_before b where b.proposal_id=target and b.task_id=g.task_id and b.occurrence_key=g.occurrence_key and jsonb_array_length(b.slots)>0) then
   select coalesce(sum(extract(epoch from((x->>'end_at')::timestamptz-(x->>'start_at')::timestamptz))/60),expected) into expected from public.revision_before b cross join lateral jsonb_array_elements(b.slots)x where b.proposal_id=target and b.user_id=auth.uid() and b.task_id=g.task_id and b.occurrence_key=g.occurrence_key;
  elsif i.start_at is not null then
   select coalesce(extract(epoch from(c.end_at-c.start_at))/60,expected) into expected from (select 1) dummy left join public.occurrence_changes c on c.user_id=auth.uid() and c.item_id=i.id and c.occurrence_date=case when g.occurrence_key='single' then (i.start_at at time zone i.timezone)::date else g.occurrence_key::date end;
  end if;
  if not undoing and count_chunks>0 and total<>expected then raise exception 'Incomplete task allocation'; end if;
  for s in select * from public.calendar_spans(p.planning_week,finish) where task_id=g.task_id and occurrence_key=g.occurrence_key loop
   if not undoing and (s.start_at<greatest(p.planning_week,now()) or s.end_at>finish or (i.earliest_at is not null and s.start_at<i.earliest_at) or (i.due_at is not null and s.end_at>i.due_at) or (count_chunks>1 and extract(epoch from(s.end_at-s.start_at))/60<i.minimum_session) or (s.start_at at time zone p.timezone)::date<>(s.end_at at time zone p.timezone)::date or extract(hour from s.start_at at time zone p.timezone)<greatest(p.start_hour,i.preferred_start) or (s.end_at at time zone p.timezone)::time>make_time(least(p.end_hour,i.preferred_end),0,0)) then raise exception 'A placement violates task constraints'; end if;
   if exists(select 1 from public.calendar_spans(s.start_at-interval '2 days',s.end_at+interval '2 days') b where (b.task_id,b.occurrence_key,b.start_at) is distinct from (s.task_id,s.occurrence_key,s.start_at) and b.start_at-b.buffer_before*interval '1 minute'<s.end_at+s.buffer_after*interval '1 minute' and s.start_at-s.buffer_before*interval '1 minute'<b.end_at+b.buffer_after*interval '1 minute') then raise exception 'A placement overlaps another activity. Undo may be unsafe.'; end if;
  end loop;
 end loop;
 if not undoing and exists(select 1 from public.calendar_spans(p.planning_week,finish) b where b.kind='task' group by (b.start_at at time zone p.timezone)::date having sum(extract(epoch from(b.end_at-b.start_at))/60)>(select preferred_daily_capacity from public.profiles where user_id=auth.uid())) then raise exception 'Daily capacity exceeded'; end if;
end $$;
create table public.revision_events (
 user_id uuid not null,
 proposal_id uuid not null,
 operation text not null check(operation in ('accepted','rejected','undone')),
 created_at timestamptz not null default now(),
 primary key(user_id,proposal_id,operation),
 foreign key(user_id,proposal_id) references public.schedule_proposals(user_id,id)
);
alter table public.revision_events enable row level security;
create policy own_revision_events on public.revision_events for select to authenticated using(user_id=(select auth.uid()));
grant select on public.revision_events to authenticated;
create function public.decide_revision(target uuid,operation text) returns text language plpgsql security definer set search_path='' as $$
declare p public.schedule_proposals; g record;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into strict p from public.schedule_proposals where id=target and user_id=auth.uid() for update;
 if operation='accept' and p.status='accepted' then return 'accepted'; end if;
 if operation='reject' and p.status='rejected' then return 'rejected'; end if;
 if operation='undo' and p.status='undone' then return 'undone'; end if;
 if operation='reject' and p.status='review' then
  update public.schedule_proposals set status='rejected',decided_at=now() where id=target;
  insert into public.revision_events values(auth.uid(),target,'rejected',now()); return 'rejected';
 elsif operation='accept' and p.status='review' then
  if p.base_fingerprint is null or p.base_fingerprint<>public.planning_fingerprint() then raise exception 'Planning inputs changed. Generate a fresh proposal.'; end if;
  if not exists(select 1 from public.proposal_entries where proposal_id=target) then raise exception 'There are no changes to accept'; end if;
  for g in select distinct task_id,occurrence_key from public.proposal_entries where proposal_id=target loop
   if exists(select 1 from public.calendar_spans(p.planning_week,((p.planning_week at time zone p.timezone)+interval '7 days') at time zone p.timezone) b where b.task_id=g.task_id and b.occurrence_key=g.occurrence_key and (b.completed or b.locked or b.start_at<now())) then raise exception 'Past, completed or locked session cannot move'; end if;
   insert into public.revision_before(user_id,proposal_id,task_id,occurrence_key,slots)
   select auth.uid(),target,g.task_id,g.occurrence_key,coalesce(jsonb_agg(to_jsonb(s) order by ordinal),'[]') from public.schedule_slots s where s.user_id=auth.uid() and s.task_id=g.task_id and s.occurrence_key=g.occurrence_key;
   delete from public.schedule_slots where user_id=auth.uid() and task_id=g.task_id and occurrence_key=g.occurrence_key;
   insert into public.schedule_slots(user_id,task_id,occurrence_key,ordinal,start_at,end_at)
   select auth.uid(),g.task_id,g.occurrence_key,case when e.start_at is null then 0 else row_number() over(order by e.start_at,e.id)::integer end,e.start_at,e.end_at from public.proposal_entries e where e.proposal_id=target and e.task_id=g.task_id and e.occurrence_key=g.occurrence_key;
  end loop;
  perform public.validate_revision(target);
  update public.schedule_proposals set status='accepted',decided_at=now(),accepted_fingerprint=public.planning_fingerprint() where id=target;
  insert into public.revision_events values(auth.uid(),target,'accepted',now());
  return 'accepted';
 elsif operation='undo' and p.status='accepted' then
  if p.accepted_fingerprint<>public.planning_fingerprint() then raise exception 'Planning inputs changed since acceptance. Undo is blocked; generate a fresh proposal.'; end if;
  for g in select * from public.revision_before where proposal_id=target and user_id=auth.uid() loop
   delete from public.schedule_slots where user_id=auth.uid() and task_id=g.task_id and occurrence_key=g.occurrence_key;
   insert into public.schedule_slots select * from jsonb_populate_recordset(null::public.schedule_slots,g.slots);
  end loop;
  perform public.validate_revision(target,true);
  update public.schedule_proposals set status='undone',decided_at=now() where id=target;
  insert into public.revision_events values(auth.uid(),target,'undone',now());
  return 'undone';
 end if;
 raise exception 'This proposal cannot perform that operation';
end $$;
-- RPCs have explicit ownership filters and no arbitrary owner parameter.
revoke all on function public.lock_planning(),public.planning_snapshot(),public.planning_fingerprint(),public.calendar_spans(timestamptz,timestamptz),public.save_revision(timestamptz,text,jsonb,text,integer,integer),public.validate_revision(uuid,boolean),public.decide_revision(uuid,text) from public,anon,authenticated;
grant execute on function public.planning_snapshot(),public.planning_fingerprint(),public.save_revision(timestamptz,text,jsonb,text,integer,integer),public.decide_revision(uuid,text) to authenticated;

create function public.read_planning() returns jsonb language sql stable security definer set search_path='' as $$
 with s as materialized(select public.planning_snapshot() value) select jsonb_build_object('snapshot',value,'fingerprint',md5(value::text)) from s
$$;
revoke all on function public.read_planning() from public,anon;
grant execute on function public.read_planning() to authenticated;
create function public.guard_allocated_anchor() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.start_at,new.end_at,new.weekly,new.daily,new.timezone,new.kind) is distinct from (old.start_at,old.end_at,old.weekly,old.daily,old.timezone,old.kind) and exists(select 1 from public.schedule_slots where user_id=old.user_id and task_id=old.id) then raise exception 'Edit accepted chunks individually or undo their revision before changing the anchor'; end if;
 return new;
end $$;
create trigger allocated_anchor before update on public.planner_items for each row execute function public.guard_allocated_anchor();
create function public.edit_schedule_slot(target_id uuid,target_key text,chunk integer,operation text,new_start timestamptz default null,new_end timestamptz default null,expected_start timestamptz default null,expected_end timestamptz default null) returns void language plpgsql security definer set search_path='' as $$
declare i public.planner_items; s public.schedule_slots; zone text; capacity integer; day_start timestamptz; day_end timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into strict i from public.planner_items where user_id=auth.uid() and id=target_id;
 select * into strict s from public.schedule_slots where user_id=auth.uid() and task_id=target_id and occurrence_key=target_key and ordinal=chunk;
 if i.locked or i.archived then raise exception 'Activity unavailable or locked'; end if;
 if (s.start_at,s.end_at) is distinct from (expected_start,expected_end) then raise exception 'This chunk changed. Reload before editing.'; end if;
 if operation in ('complete','reopen') then
  if target_key='single' then
   update public.planner_items set completed=operation='complete' where user_id=auth.uid() and id=target_id;
   -- Existing single-occurrence history must agree with its parent.
   update public.occurrence_changes set completed=operation='complete' where user_id=auth.uid() and item_id=target_id;
  else perform public.edit_occurrence(target_id,target_key::date,operation); end if;
 elsif operation='move' then
  if i.completed or exists(select 1 from public.occurrence_changes where user_id=auth.uid() and item_id=i.id and occurrence_date::text=target_key and completed) then raise exception 'Reopen the session before moving it'; end if;
  if new_start is null or new_end is null or new_end-new_start<>s.end_at-s.start_at or new_start<now() or (i.earliest_at is not null and new_start<i.earliest_at) or (i.due_at is not null and new_end>i.due_at) then raise exception 'Preserve chunk duration and use a valid future range before the deadline'; end if;
  if exists(select 1 from public.calendar_spans(new_start-interval '2 days',new_end+interval '2 days') b where not(b.task_id=target_id and b.occurrence_key=target_key and b.start_at=s.start_at) and b.start_at-b.buffer_before*interval '1 minute'<new_end+i.buffer_after*interval '1 minute' and new_start-i.buffer_before*interval '1 minute'<b.end_at+b.buffer_after*interval '1 minute') then raise exception 'That time overlaps another activity'; end if;
  select timezone,preferred_daily_capacity into zone,capacity from public.profiles where user_id=auth.uid();
  if (new_start at time zone zone)::date<>(new_end at time zone zone)::date or (new_start at time zone zone)::time<make_time(i.preferred_start,0,0) or (new_end at time zone zone)::time>make_time(i.preferred_end,0,0) then raise exception 'Move outside allowed window'; end if;
  day_start:=date_trunc('day',new_start at time zone zone) at time zone zone;
  day_end:=(date_trunc('day',new_start at time zone zone)+interval '1 day') at time zone zone;
  if (select coalesce(sum(extract(epoch from(b.end_at-b.start_at))/60),0) from public.calendar_spans(day_start,day_end)b where b.kind='task' and not(b.task_id=target_id and b.occurrence_key=target_key and b.start_at=s.start_at)) + extract(epoch from(new_end-new_start))/60>capacity then raise exception 'Daily capacity exceeded'; end if;
  update public.schedule_slots set start_at=new_start,end_at=new_end where user_id=auth.uid() and task_id=target_id and occurrence_key=target_key and ordinal=chunk;
 else raise exception 'Unsupported operation'; end if;
end $$;
revoke all on function public.guard_allocated_anchor(),public.edit_schedule_slot(uuid,text,integer,text,timestamptz,timestamptz,timestamptz,timestamptz) from public,anon;
grant execute on function public.edit_schedule_slot(uuid,text,integer,text,timestamptz,timestamptz,timestamptz,timestamptz) to authenticated;

revoke insert on public.schedule_proposals,public.proposal_entries from authenticated;
alter function public.save_proposal(timestamptz,text,jsonb) security definer;

create or replace function public.edit_occurrence(target_id uuid, target_date date, operation text, new_start timestamptz default null, new_end timestamptz default null) returns void language plpgsql security invoker set search_path='' as $$
declare item public.planner_items; anchor date; step integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
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

-- Prevent invisible manual exceptions beneath an accepted allocation overlay.
create function public.guard_allocated_exception() returns trigger language plpgsql security definer set search_path='' as $$
declare series boolean;
begin
 select weekly or daily into series from public.planner_items where user_id=new.user_id and id=new.item_id;
 if ((tg_op='INSERT' and new.start_at is not null) or (tg_op='UPDATE' and (new.start_at,new.end_at) is distinct from (old.start_at,old.end_at))) and exists(select 1 from public.schedule_slots where user_id=new.user_id and task_id=new.item_id and occurrence_key=case when series then new.occurrence_date::text else 'single' end) then raise exception 'Move the accepted chunk instead of its original occurrence'; end if;
 return new;
end $$;
create trigger allocated_exception before insert or update on public.occurrence_changes for each row execute function public.guard_allocated_exception();
revoke all on function public.guard_allocated_exception() from public,anon,authenticated;
