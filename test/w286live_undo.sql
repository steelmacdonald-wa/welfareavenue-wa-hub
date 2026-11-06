-- wave286: checks on the live database after build/data/wa286_vm_chapter.sql and then build/data/wa286_undo.sql (run twice). Runs only inside the
-- block build/sql_rollback_test.py prints, after build/data/wa281_rules.sql and test/w286live_before.sql, so everything rolls back. No transaction
-- control. It proves the undo removes exactly what wave286 added: the trigger, both functions and the rows with its source note, and that every
-- chapter row of before is back as it was, with no roster row or event touched. Raises on the first failure, with names and counts only.

do $undo$
declare s record; n bigint;
begin
  select * into s from pg_temp.w286_state_before;
  if exists (select 1 from pg_trigger where tgname = 'trg_wa286_toronto_crew') or to_regprocedure('public.wa286_toronto_crew()') is not null
     or to_regprocedure('public.wa286_crew_contact(jsonb,bigint)') is not null then raise exception 'w286live_undo: a wave286 trigger or function is left'; end if;
  if exists (select 1 from public.crm_contact_chapters where source_ref like 'Toronto crew:%') then raise exception 'w286live_undo: a row with wave286''s source note is left'; end if;
  select count(*) into n from ((select contact_id, chapter, source, source_ref, added_by from pg_temp.w286_rows_before
                                except all select contact_id, chapter, source, source_ref, added_by from public.crm_contact_chapters)
                               union all (select contact_id, chapter, source, source_ref, added_by from public.crm_contact_chapters
                                except all select contact_id, chapter, source, source_ref, added_by from pg_temp.w286_rows_before)) x;
  if n <> 0 then raise exception 'w286live_undo: % chapter rows differ from before', n; end if;
  if (select count(*) from public.event_roster) <> s.roster or (select count(*) from public.volunteer_events) <> s.events then raise exception 'w286live_undo: a roster row or an event moved'; end if;
  if (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave286' and field = 'wave286 undo') <> 1 then raise exception 'w286live_undo: not one undo line'; end if;
end $undo$;
