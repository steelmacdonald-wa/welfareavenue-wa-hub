-- Welfare Avenue Hub: wave291, 06/11/26. The opted-out check, fast.
-- wa171_opted_out (the text schedule, Find volunteers and the other text queues) asks one question per person: is a live contact with this
-- volunteer or this number marked no texts? Its query starts with "c.sms_opt_out and c.merged_into is null", but no index matches that, so
-- every call read every contact (Seq Scan on crm_contacts): about 1.1 to 1.25 s for 1,802 calls. Two partial indexes, and no function change:
--   1. crm_contacts_wa291_opted_out_idx holds only the live contacts marked no texts, so each call reads that short list instead
--      (Index Scan using crm_contacts_wa291_opted_out_idx). This is the fix under today's text and under wave281's.
--   2. quo_messages_wa291_stop_digits_idx holds the STOP and START texts by their number's 10 digits (wa171_digits). wave281's text adds a check
--      against wa_stopped_phones_v, which otherwise works out the digits of every STOP and START text on each call; with this index it looks the
--      number up instead (Index Cond: wa171_digits(phone) = wa171_digits(p_phone)). Under today's text nothing reads it yet.
-- The planner picks the indexes for the same function text, so this works under today's wa171_opted_out and under wave281's, and the two waves
-- can go live in either order. No answer changes.
-- Safe to run twice: each index is created once, and if an index of either name exists with another definition the migration stops.
-- No transaction control in this file: the release runs it through the Supabase connector, and build/sql_rollback_test.py runs it inside a
-- block that rolls back. Proved offline first: node test/w291sql.mjs (PGlite, test/w291schema.sql).
-- Built 06/11/26, not released. Undo: build/data/wa291_undo.sql.

create index if not exists crm_contacts_wa291_opted_out_idx on public.crm_contacts (id) where sms_opt_out and merged_into is null;
create index if not exists quo_messages_wa291_stop_digits_idx on public.quo_messages (public.wa171_digits(phone)) where direction = 'in' and handled in ('opted_out', 'opted_in');

do $wa291$
begin
  -- pg_get_indexdef names wa171_digits with its schema only when public is not on the search path, so the check leaves the schema out
  if (select pg_get_indexdef(i.indexrelid) from pg_index i where i.indexrelid = to_regclass('public.crm_contacts_wa291_opted_out_idx'))
     is distinct from 'CREATE INDEX crm_contacts_wa291_opted_out_idx ON public.crm_contacts USING btree (id) WHERE (sms_opt_out AND (merged_into IS NULL))' then
    raise exception 'wave291: crm_contacts_wa291_opted_out_idx exists with another definition';
  end if;
  if (select replace(pg_get_indexdef(i.indexrelid), 'public.wa171_digits(', 'wa171_digits(') from pg_index i where i.indexrelid = to_regclass('public.quo_messages_wa291_stop_digits_idx'))
     is distinct from 'CREATE INDEX quo_messages_wa291_stop_digits_idx ON public.quo_messages USING btree (wa171_digits(phone)) WHERE ((direction = ''in''::text) AND (handled = ANY (ARRAY[''opted_out''::text, ''opted_in''::text])))' then
    raise exception 'wave291: quo_messages_wa291_stop_digits_idx exists with another definition';
  end if;
end $wa291$;

comment on index public.crm_contacts_wa291_opted_out_idx is 'wave291: the live contacts marked no texts (sms_opt_out true, merged_into null), so wa171_opted_out reads only them instead of every contact on each call. Postgres keeps it as contacts change; nobody writes it. The planner uses it for any query on crm_contacts that asks for sms_opt_out and merged_into is null.';
comment on index public.quo_messages_wa291_stop_digits_idx is 'wave291: the STOP and START texts received (direction in, handled opted_out or opted_in) by their number''s last 10 digits (wa171_digits), so the stopped-phones check (wa_stopped_phones_v, read by wa171_opted_out since wave281) looks one number up instead of working out the digits of every keyword text on each call. Postgres keeps it as texts arrive; nobody writes it. If wa171_digits ever changes, rebuild it (reindex).';

-- the release record (once)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave291', 'wave291', null,
       'The opted-out check is fast: wa171_opted_out reads crm_contacts_wa291_opted_out_idx (the '
       || (select count(*) from public.crm_contacts where sms_opt_out and merged_into is null) || ' live contacts marked no texts) instead of every contact, and the stopped-phones check reads quo_messages_wa291_stop_digits_idx ('
       || (select count(*) from public.quo_messages where direction = 'in' and handled in ('opted_out', 'opted_in')) || ' STOP and START texts). The function text and every answer are unchanged.', 'wave291'
 where not exists (select 1 from public.change_log where entity_type = 'release' and entity_id = 'wave291' and field = 'wave291');
