-- wave353 (18/11/26): simple onboarding. The switch only: onboard-run v11, onboard-link v6 and /o/index.html read it.
-- Run AFTER the functions and the /o/ page are live (absent or off, everything is wave275's as before).
insert into public.app_config (key, value) values ('onboard_simple', 'on')
on conflict (key) do update set value = excluded.value;
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('app_config', 'onboard_simple', 'value', null, 'on (wave353: no onboarding call or 1-on-1; manager and HR owner told at Accept and send the onboarding)', 'Claude for Steel');
