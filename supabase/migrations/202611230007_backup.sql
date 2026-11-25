create function public.export_backup() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('format',1,'owner',auth.uid(),'exported_at',now(),'data',jsonb_build_object(
 'profiles',coalesce((select jsonb_agg(to_jsonb(t)) from public.profiles t where user_id=auth.uid()),'[]'),
 'workstreams',coalesce((select jsonb_agg(to_jsonb(t)) from public.workstreams t where user_id=auth.uid()),'[]'),
 'task_templates',coalesce((select jsonb_agg(to_jsonb(t)) from public.task_templates t where user_id=auth.uid()),'[]'),
 'planner_items',coalesce((select jsonb_agg(to_jsonb(t)) from public.planner_items t where user_id=auth.uid()),'[]'),
 'occurrence_changes',coalesce((select jsonb_agg(to_jsonb(t)) from public.occurrence_changes t where user_id=auth.uid()),'[]'),
 'schedule_proposals',coalesce((select jsonb_agg(to_jsonb(t)) from public.schedule_proposals t where user_id=auth.uid()),'[]'),
 'proposal_entries',coalesce((select jsonb_agg(to_jsonb(t)) from public.proposal_entries t where user_id=auth.uid()),'[]'),
 'schedule_slots',coalesce((select jsonb_agg(to_jsonb(t)) from public.schedule_slots t where user_id=auth.uid()),'[]'),
 'revision_before',coalesce((select jsonb_agg(to_jsonb(t)) from public.revision_before t where user_id=auth.uid()),'[]'),
 'revision_events',coalesce((select jsonb_agg(to_jsonb(t)) from public.revision_events t where user_id=auth.uid()),'[]'),
 'screen_time',coalesce((select jsonb_agg(to_jsonb(t)) from public.screen_time t where user_id=auth.uid()),'[]')))
$$;
create function public.restore_backup(backup jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare relation text; rows jsonb; inserted integer; total integer:=0;
begin
 if auth.uid() is null or backup->>'owner' is distinct from auth.uid()::text or backup->>'format' is distinct from '1' or jsonb_typeof(backup->'data') is distinct from 'object' or octet_length(backup::text)>2000000 then raise exception 'Invalid backup or account mismatch'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 foreach relation in array array['workstreams','task_templates','planner_items','occurrence_changes','schedule_proposals','proposal_entries','schedule_slots','revision_before','revision_events','screen_time'] loop
  rows:=coalesce(backup->'data'->relation,'[]');
  if jsonb_typeof(rows)<>'array' or jsonb_array_length(rows)>10000 then raise exception 'Invalid backup records'; end if;
  if exists(select 1 from jsonb_array_elements(rows)r where r->>'user_id' is distinct from auth.uid()::text) then raise exception 'Backup ownership mismatch'; end if;
  if relation='revision_before' and exists(select 1 from jsonb_array_elements(rows)r cross join lateral jsonb_array_elements(r->'slots')s where s->>'user_id' is distinct from auth.uid()::text or s->>'task_id' is distinct from r->>'task_id' or s->>'occurrence_key' is distinct from r->>'occurrence_key') then raise exception 'Invalid inverse revision ownership'; end if;
  execute format('insert into public.%I select * from jsonb_populate_recordset(null::public.%I,$1) on conflict do nothing',relation,relation) using rows;
  get diagnostics inserted=row_count; total:=total+inserted;
 end loop;
 return total;
end $$;
revoke all on function public.export_backup(),public.restore_backup(jsonb) from public,anon;
grant execute on function public.export_backup(),public.restore_backup(jsonb) to authenticated;
