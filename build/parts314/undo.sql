-- 13/11/26 - wave314 undo: puts index.html back as it was before wave314 and publishes it. Run only if needed.
-- The edge function social-ads-manage stays (only marketing leads can call it); to switch it off as well, delete it in
-- Supabase, Edge Functions. The table social_ad_actions keeps the record of what was done.
do $u$ begin
  if not exists (select 1 from public.site_files_bak_wa314) then raise exception 'no wave314 backup'; end if;
  update public.site_files f set content = b.content, updated_at = now() from public.site_files_bak_wa314 b where f.path = b.path and f.part = b.part;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'index.html', 'wave314 undo', null, (select md5(string_agg(content, '' order by part)) from public.site_files where path = 'index.html'), 'Claude for Steel (13/11/26)');
end $u$;
select public.call_edge('host-sync', '{}'::jsonb) as host_sync;
