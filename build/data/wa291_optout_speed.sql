-- Welfare Avenue Hub: wave291, 06/11/26. The opted-out check, fast.
-- wa171_opted_out (the text schedule, Find volunteers and the other text queues) asks one question per person: is a live contact with this
-- volunteer or this number marked no texts? Its query starts with "c.sms_opt_out and c.merged_into is null", but no index matches that, so
-- every call read every contact (Seq Scan on crm_contacts): about 1.24 s for 1,802 calls. This adds one partial index that holds only the
-- opted-out live contacts, so each call reads that short list instead (Index Scan using crm_contacts_wa291_opted_out_idx).
-- No function is changed: the planner picks the index for the same text. So it works under today's wa171_opted_out and under wave281's
-- (which adds a check against wa_stopped_phones_v to the same query), and the two waves can go live in either order. No answer changes.
-- Safe to run twice: the index is created once, and if an index of this name exists with another definition the migration stops.
-- No transaction control in this file: the release runs it through the Supabase connector, and build/sql_rollback_test.py runs it inside a
-- block that rolls back. Proved offline first: node test/w291sql.mjs (PGlite, test/w291schema.sql).
-- Built 06/11/26, not released. Undo: build/data/wa291_undo.sql.

create index if not exists crm_contacts_wa291_opted_out_idx on public.crm_contacts (id) where sms_opt_out and merged_into is null;

do $wa291$
begin
  if (select pg_get_indexdef(i.indexrelid) from pg_index i where i.indexrelid = to_regclass('public.crm_contacts_wa291_opted_out_idx'))
     is distinct from 'CREATE INDEX crm_contacts_wa291_opted_out_idx ON public.crm_contacts USING btree (id) WHERE (sms_opt_out AND (merged_into IS NULL))' then
    raise exception 'wave291: crm_contacts_wa291_opted_out_idx exists with another definition';
  end if;
end $wa291$;

comment on index public.crm_contacts_wa291_opted_out_idx is 'wave291: the live contacts marked no texts (sms_opt_out true, merged_into null), so wa171_opted_out reads only them instead of every contact on each call. Postgres keeps it as contacts change; nobody writes it. The planner uses it for any query on crm_contacts that asks for sms_opt_out and merged_into is null.';

-- the release record (once)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave291', 'wave291', null,
       'The opted-out check is fast: wa171_opted_out reads the index crm_contacts_wa291_opted_out_idx (the '
       || (select count(*) from public.crm_contacts where sms_opt_out and merged_into is null) || ' opted-out live contacts) instead of every contact. The function text and every answer are unchanged.', 'wave291'
 where not exists (select 1 from public.change_log where entity_type = 'release' and entity_id = 'wave291' and field = 'wave291');
