-- wave297 undo: puts back every function wa297_channels.sql patched (the texts kept in wa297_undo_defs), drops the
-- wave297 functions and switches. Montreal goes back to the global texts_by_email switch (still 'on'), Toronto events
-- back out of every automation. Messages already sent stay sent.
begin;
do $$
declare x record;
begin
  if to_regclass('public.wa297_undo_defs') is null then raise exception 'wave297 undo: no saved definitions'; end if;
  for x in select fn, def from public.wa297_undo_defs loop execute x.def; end loop;
end $$;
drop function if exists public.wa297_send_now(bigint, text, text);
drop function if exists public.wa297_auto_set(text, boolean, boolean);
drop function if exists public.wa297_auto_get();
drop function if exists public.wa297_can(text);
drop function if exists public.wa297_email_copy(bigint, text, text);
drop function if exists public.wa297_email_ok(bigint);
drop function if exists public.wa297_reply_to(bigint, text);
drop function if exists public.wa297_toronto_people();
drop function if exists public.wa297_channel(bigint);
drop function if exists public.wa297_city(bigint);
delete from public.app_config where key in ('vol_auto_texts_montreal', 'vol_auto_emails_montreal', 'vol_auto_texts_toronto', 'vol_auto_emails_toronto', 'toronto_texts_notify', 'toronto_reply_to');
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('release', 'wave297', 'undo', null, 'wave297 undone: functions back as on 08/11/26, wave297 functions and switches removed', 'wave297');
drop table public.wa297_undo_defs;
commit;
