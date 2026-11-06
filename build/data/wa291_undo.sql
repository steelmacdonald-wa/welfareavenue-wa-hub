-- Welfare Avenue Hub: wave291 undo, 06/11/26. Reverses build/data/wa291_optout_speed.sql.
-- wave291 adds two indexes and changes nothing else (no function, view, table, column, grant or row), so dropping them puts live back exactly
-- as it was: wa171_opted_out goes back to reading every contact on each call (slow again, the same answers).
-- The release line in change_log stays; an undo line is added, once per release.
-- No transaction control (see the migration). Safe to run twice.

drop index if exists public.crm_contacts_wa291_opted_out_idx;
drop index if exists public.quo_messages_wa291_stop_digits_idx;

-- the undo record (once per release)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave291', 'wave291 undo', null, 'wave291 undone: the indexes crm_contacts_wa291_opted_out_idx and quo_messages_wa291_stop_digits_idx dropped; wa171_opted_out reads every contact again.', 'wave291 undo'
 where not exists (select 1 from public.change_log u where u.entity_type = 'release' and u.entity_id = 'wave291' and u.field = 'wave291 undo'
                    and u.changed_at >= coalesce((select max(r.changed_at) from public.change_log r where r.entity_type = 'release' and r.entity_id = 'wave291' and r.field = 'wave291'), '-infinity'::timestamptz));
