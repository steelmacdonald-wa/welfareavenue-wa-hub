-- wave286: the live state just before the migration (after wave281), kept in temp tables for test/w286live.sql and test/w286live_undo.sql.
-- Runs only inside the block build/sql_rollback_test.py prints, after build/data/wa281_rules.sql and before build/data/wa286_vm_chapter.sql, so
-- everything rolls back. No transaction control. Reads only. Personal data stays in the database: the later files compare inside it and raise only
-- counts and names of checks.

-- every chapter row as it is before wave286
create temp table w286_rows_before as select contact_id, chapter, source, source_ref, added_by from public.crm_contact_chapters;

-- how many people the backfill should add: the distinct live contacts of the crews on Toronto events (wave274: kind meal, location Toronto), found by
-- detail.contact_id and then by the volunteer record, who are not in Toronto yet (the rule wa286_crew_contact holds, written out here)
create temp table w286_state_before as
  select (select count(*) from public.event_roster) as roster,
         (select count(*) from public.volunteer_events) as events,
         (select count(*) from public.volunteer_events where kind = 'meal' and location = 'Toronto') as toronto_events,
         (select count(distinct k.cid) from (
            select coalesce(
              (select c.id from public.crm_contacts c where c.id = case when (r.detail ->> 'contact_id') ~ '^[0-9]{1,18}$' then (r.detail ->> 'contact_id')::bigint end and c.merged_into is null),
              (select c.id from public.crm_contacts c where r.person_id is not null and c.volunteer_id = r.person_id and c.merged_into is null order by c.id limit 1)) as cid
              from public.event_roster r join public.volunteer_events e on e.id = r.event_id
             where e.kind = 'meal' and e.location = 'Toronto') k
           where k.cid is not null and not exists (select 1 from public.crm_contact_chapters x where x.contact_id = k.cid and x.chapter = 'toronto')) as expected;

do $before$
begin
  if to_regclass('public.crm_contact_chapters') is null then raise exception 'w286live_before: wave281 has not run first'; end if;
  if to_regprocedure('public.wa286_crew_contact(jsonb,bigint)') is not null then raise exception 'w286live_before: wave286 has run already'; end if;
  if exists (select 1 from public.crm_contact_chapters where source_ref like 'Toronto crew:%') then raise exception 'w286live_before: a chapter row already has wave286''s source note'; end if;
end $before$;
