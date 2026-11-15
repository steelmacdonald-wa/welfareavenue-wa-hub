-- 15/11/26 - wave345 undo: puts the Hub page and the four email functions back as they were before wave345.
-- Run only if wave345 has to come out. One block: if any check fails, nothing changes. Nobody is messaged.
-- Stays as it is: the settings the team saved (numbers, the link) and any Photos marks. An event set to "nothing goes by itself"
-- goes back to the Montreal setting.
do $u$
declare v_n int; f text;
begin
  if not exists (select 1 from public.site_files_bak_wa345) then raise exception 'no page backup (site_files_bak_wa345): was wave345 run?'; end if;
  if (select count(*) from public.wa345_undo) < 4 then raise exception 'no database backup (wa345_undo): was wave345 run?'; end if;
  delete from public.site_files where path = 'index.html';
  insert into public.site_files select path, part, content, now() from public.site_files_bak_wa345;
  select count(*) into v_n from public.site_files where path = 'index.html';
  if v_n <> 10 then raise exception 'page restore: % parts', v_n; end if;
  for f in select v from public.wa345_undo where k like 'wa%' loop execute f; end loop;
  update public.volunteer_events set confirm_channels = null where confirm_channels = 'none';
  alter table public.volunteer_events drop constraint if exists volunteer_events_confirm_channels_check;
  alter table public.volunteer_events add constraint volunteer_events_confirm_channels_check check (confirm_channels is null or confirm_channels in ('text', 'email', 'both'));
  drop function if exists public.wa345_settings_get();
  drop function if exists public.wa345_settings_save(jsonb);
  drop function if exists public.wa345_event_channels(bigint, text);
  drop function if exists public.wa345_reply_to(bigint, text, text);
  drop function if exists public.wa346_photos(bigint, boolean);
  delete from public.app_config where key in ('vol_reply_default', 'mail_role_owner_ready');
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'index.html', 'wave345 undo', null, 'the page and the four email functions as before wave345', 'wave345');
end $u$;
select public.call_edge('host-sync', '{}'::jsonb) as host_sync, (select md5(string_agg(content, '' order by part)) from public.site_files where path = 'index.html') as hub_md5;
