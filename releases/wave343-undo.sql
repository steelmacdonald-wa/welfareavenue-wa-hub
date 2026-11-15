-- 14/11/26 - wave343 undo: puts the welcome automation's steps back as they were (placeholders) and removes the stored WhatsApp link.
-- Run only if wave343 has to come out. Refuses while the series is switched on: pause it in the CRM first.
do $u343$
declare a record; v_old text;
begin
  if (select count(*) from public.wa343_undo where k = 'steps') <> 1 then raise exception 'no backup (wa343_undo): was wave343 run?'; end if;
  select * into a from public.crm_automations where id = 1 for update;
  if a.status = 'on' then raise exception 'the welcome series is on: pause it in the CRM first'; end if;
  update public.crm_automations set steps = (select v::jsonb from public.wa343_undo where k = 'steps'), description = (select v from public.wa343_undo where k = 'description'), updated_at = now() where id = 1;
  select v into v_old from public.wa343_undo where k = 'link';
  if v_old is null then delete from public.app_config where key = 'vol_whatsapp_community_url'; else update public.app_config set value = v_old where key = 'vol_whatsapp_community_url'; end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('crm_automation', '1', 'wave343 undo', null, 'steps restored from wa343_undo', 'Claude for Steel (14/11/26)');
end $u343$;
select name, status, jsonb_array_length(steps) as steps from public.crm_automations where id = 1;
