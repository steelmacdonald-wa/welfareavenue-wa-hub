-- 12/11/26 - wave320 undo (only if needed): puts back the Hub page from before this release (31637730c5e8f2bfad8137fa6b3a5de3).
-- The release carried: wave 320 and wave 322. The undo takes all of it back.
-- It refuses when a later release sits on top, so that release is not undone by accident:
-- undo the later one first, or take the blocks out with a new release.
do $u$ declare v text; begin
  if not exists (select 1 from public.site_files_bak_wa320) then raise exception 'no backup'; end if;
  select md5(string_agg(content, '' order by part)) into v from public.site_files where path = 'index.html';
  if v <> 'df214de0edc63747bb29d013bffdec0d' then raise exception 'the live page is not the page this release made (%): a later release is on top', v; end if;
  update public.site_files f set content = b.content, updated_at = now() from public.site_files_bak_wa320 b where f.path = b.path and f.part = b.part and f.path = 'index.html';
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('release', 'index.html', 'wave320-undo', 'df214de0edc63747bb29d013bffdec0d', '31637730c5e8f2bfad8137fa6b3a5de3: the wave320 release undone, the page as it was before', 'Claude for Steel (12/11/26)');
end $u$;
select public.call_edge('host-sync', '{}'::jsonb) as rid, md5(string_agg(content, '' order by part)) as live_md5 from public.site_files where path = 'index.html';
