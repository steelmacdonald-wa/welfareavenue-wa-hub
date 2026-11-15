-- 15/11/26 - wave347 undo: puts the Hub page, the volunteer page and the two count functions back as they were before wave347.
-- Run only if wave347 has to come out. One block. Nobody is messaged. Counts already taken stay (their added answers too).
do $u$
declare f text;
begin
  if (select count(*) from public.site_files_bak_wa347) <> 11 or (select count(*) from public.wa347_undo) <> 2 then raise exception 'no backup: was wave347 run?'; end if;
  delete from public.site_files where path in ('index.html', 'c/index.html');
  insert into public.site_files select path, part, content, now() from public.site_files_bak_wa347;
  for f in select v from public.wa347_undo loop execute f; end loop;
  drop function if exists public.pb_count_live(bigint);
  drop function if exists public.pb_form_save(text, jsonb);
  drop function if exists public.pb_form_get(text);
  drop function if exists public.pb_form_public(text);
  drop function if exists public.pb_may_count(bigint);
  drop function if exists public.pb_can_edit();
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'index.html', 'wave347 undo', null, 'both pages and the two count functions as before wave347', 'wave347');
end $u$;
select public.call_edge('host-sync', '{}'::jsonb) as host_sync;
