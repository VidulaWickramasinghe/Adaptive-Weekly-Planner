-- Preserve existing rows without firing their insertion guards.
create or replace function public.restore_backup(backup jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare relation text; key_match text; rows jsonb; inserted integer; total integer:=0;
begin
 if auth.uid() is null or backup->>'owner' is distinct from auth.uid()::text or backup->>'format' is distinct from '1' or jsonb_typeof(backup->'data') is distinct from 'object' or octet_length(backup::text)>2000000 then raise exception 'Invalid backup or account mismatch'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 foreach relation in array array['workstreams','task_templates','planner_items','occurrence_changes','schedule_proposals','proposal_entries','schedule_slots','revision_before','revision_events','screen_time'] loop
  rows:=coalesce(backup->'data'->relation,'[]');
  if jsonb_typeof(rows)<>'array' or jsonb_array_length(rows)>10000 then raise exception 'Invalid backup records'; end if;
  if exists(select 1 from jsonb_array_elements(rows)r where r->>'user_id' is distinct from auth.uid()::text) then raise exception 'Backup ownership mismatch'; end if;
  if relation='revision_before' and exists(select 1 from jsonb_array_elements(rows)r cross join lateral jsonb_array_elements(r->'slots')s where s->>'user_id' is distinct from auth.uid()::text or s->>'task_id' is distinct from r->>'task_id' or s->>'occurrence_key' is distinct from r->>'occurrence_key') then raise exception 'Invalid inverse revision ownership'; end if;
  key_match:=case relation
   when 'occurrence_changes' then 'existing.item_id=incoming.item_id and existing.occurrence_date=incoming.occurrence_date'
   when 'schedule_slots' then 'existing.task_id=incoming.task_id and existing.occurrence_key=incoming.occurrence_key and existing.ordinal=incoming.ordinal'
   when 'revision_before' then 'existing.proposal_id=incoming.proposal_id and existing.task_id=incoming.task_id and existing.occurrence_key=incoming.occurrence_key'
   when 'revision_events' then 'existing.proposal_id=incoming.proposal_id and existing.operation=incoming.operation'
   when 'screen_time' then 'existing.local_date=incoming.local_date and existing.kind=incoming.kind'
   else 'existing.id=incoming.id' end;
  -- Skip existing rows before BEFORE INSERT triggers run: locked activities and
  -- accepted occurrence overlays must not invalidate a no-op restore.
  execute format('insert into public.%I select incoming.* from jsonb_populate_recordset(null::public.%I,$1) incoming where not exists(select 1 from public.%I existing where existing.user_id=incoming.user_id and %s) on conflict do nothing',relation,relation,relation,key_match) using rows;
  get diagnostics inserted=row_count; total:=total+inserted;
 end loop;
 return total;
end $$;
