-- Welfare Avenue Hub: wave286 undo, 06/11/26. Reverses build/data/wa286_vm_chapter.sql (Toronto crews in the CRM), in reverse order.
-- It drops the trigger and its two functions, then removes the chapter rows wave286 added: Toronto rows with source serving whose source note starts
-- "Toronto crew:" (the trigger's and the backfill's; no other writer uses that note). Every other chapter row stays, including a Toronto row a person
-- had before wave286. One case to know: a row wave286 added stays tagged as wave286's even if other Toronto evidence (a Toronto form, the import)
-- came later, because crm_add_chapter keeps the row already there; the undo removes it too, and a later Toronto form, application or import run
-- adds it again (evidence that came before is not replayed). What stays: the release line in change_log (an undo line is added). Nothing here
-- touches Montreal, a serving or a roster row. No transaction control (see the migration). Safe to run twice, and safe after wave281's undo (it then
-- has nothing to remove).

drop trigger if exists trg_wa286_toronto_crew on public.event_roster;
drop function if exists public.wa286_toronto_crew();
drop function if exists public.wa286_crew_contact(jsonb, bigint);

do $u286$
declare n int := 0;
begin
  if to_regclass('public.crm_contact_chapters') is not null then
    delete from public.crm_contact_chapters where chapter = 'toronto' and source = 'serving' and source_ref like 'Toronto crew:%';
    get diagnostics n = row_count;
  end if;
  raise notice 'wave286 undo: % Toronto chapter rows from Toronto crews removed', n;
end $u286$;

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave286', 'wave286 undo', null, 'wave286 undone: the Toronto crew trigger and wa286_crew_contact are gone, and the Toronto chapter rows they added (source note Toronto crew:) are removed.', 'wave286 undo'
 where not exists (select 1 from public.change_log where entity_type = 'release' and entity_id = 'wave286' and field = 'wave286 undo');
