-- wave353 undo: switch simple onboarding off (the wave275 propose path comes back at once; nothing else to undo in the database).
update public.app_config set value = 'off' where key = 'onboard_simple';
