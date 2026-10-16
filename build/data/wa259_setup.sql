-- wave259 (15/10/26): the Volunteer Manager refresh. The Setup page reads the text schedule and switches the two
-- optional rounds; leaders, HR, admins and text_staff (wa256_can_text). Applied as migration wa259_setup.
-- (the two functions as applied; see migration wa259_setup in supabase_migrations)
create or replace function public.wa259_text_setup() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v from public.app_config
   where key in ('sms_mode', 'sms_confirm_days', 'sms_confirm_hour', 'sms_reminder_on', 'sms_reminder_days', 'sms_checkin_on', 'sms_checkin_days',
                 'cancel_notice_days', 'sms_itinerary_hour', 'sms_survey_hour', 'sms_window_start', 'sms_window_end', 'text_staff', 'texts_notify');
  return v || jsonb_build_object('can_text', public.wa256_can_text(),
    'usual', (select coalesce(jsonb_object_agg(role, coalesce(target, 0)), '{}'::jsonb) from public.volunteer_role_guides where role <> 'volunteer'),
    'next', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'date', e.event_date, 'code', e.code) order by e.event_date), '[]'::jsonb)
               from (select * from public.volunteer_events where kind = 'service' and status not in ('cancelled', 'completed') and event_date >= (now() at time zone 'America/Toronto')::date order by event_date limit 3) e));
end $$;
comment on function public.wa259_text_setup() is 'wave259: the Setup page''s Texts section: the schedule settings (app_config sms_* and cancel_notice_days), who may text, the usual spot counts and the next three servings. Staff.';

create or replace function public.wa259_text_switch(p_key text, p_value text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_by text := coalesce(auth.jwt()->>'email', 'staff'); v_old text;
begin
  if not public.wa256_can_text() then raise exception 'Only leaders, HR, admins and the volunteer team can change the text schedule.'; end if;
  if p_key not in ('sms_reminder_on', 'sms_checkin_on', 'sms_reminder_days', 'sms_checkin_days', 'sms_confirm_days', 'cancel_notice_days') then raise exception 'Not a setting the Setup page changes: %', p_key; end if;
  if p_key like '%\_on' and p_value not in ('on', 'off') then raise exception 'on or off'; end if;
  if p_key like '%\_days' and (p_value !~ '^\d{1,2}$' or p_value::int < 1 or p_value::int > 30) then raise exception '1 to 30 days'; end if;
  select value into v_old from public.app_config where key = p_key;
  insert into public.app_config (key, value, updated_at) values (p_key, p_value, now()) on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('app_config', p_key, 'value', v_old, p_value, v_by);
  return public.wa259_text_setup();
end $$;
comment on function public.wa259_text_switch(text, text) is 'wave259: Setup > Texts: switch the Monday reminder or the Thursday check-in on or off, or move a round''s days (confirmation, reminder, check-in, the cancel notice); leaders, HR, admins and text_staff; change_log keeps the old value.';

revoke execute on function public.wa259_text_setup() from public, anon, authenticated;
revoke execute on function public.wa259_text_switch(text, text) from public, anon, authenticated;
grant execute on function public.wa259_text_setup() to authenticated;
grant execute on function public.wa259_text_switch(text, text) to authenticated;
