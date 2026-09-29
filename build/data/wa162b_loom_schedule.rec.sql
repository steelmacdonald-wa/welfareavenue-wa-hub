-- =====================================================================================================================
-- wave162b (28/09/26): the Loom pull's schedule (Monday, Wednesday and Friday at 7:30, Toronto), its Slack line off by default,
-- and the Admin access profile. Until Loom is connected (Connect Loom on the card) each run records that it is waiting.
-- See wa162_loom_pull.sql and wa162c_loom_connect.sql.
-- =====================================================================================================================

-- ---------- 6b. the Slack line for meetings the Loom pull files: off until Steel says otherwise (process-transcript v15) ----------
insert into public.app_config (key, value, updated_at) values ('loom_pull_slack', 'off', now()) on conflict (key) do nothing;

-- ---------- 7. the schedule: Monday, Wednesday and Friday at 7:30 in Toronto, all year ----------
-- pg_cron runs in UTC: 11:30 UTC is 7:30 in Toronto in summer time and 12:30 UTC in winter, so the job wakes at both and only
-- the one where it is 7 in Toronto calls the function.
select cron.unschedule('wa-loom-pull') where exists (select 1 from cron.job where jobname = 'wa-loom-pull');
select cron.schedule('wa-loom-pull', '30 11,12 * * 1,3,5', $$select public.call_edge('loom-pull', '{"action":"sync","why":"schedule"}'::jsonb) where extract(hour from (now() at time zone 'America/Toronto')) = 7$$);

-- ---------- 8. access and the record (Hub module 3 waits for the first pull: build/parked/wave162-staff-lines) ----------
update public.hub_access_profiles set can = can || to_jsonb('The Loom pull in the Transcript archive: what came in from Loom on Monday, Wednesday and Friday mornings, filing or skipping a recording that needs a look, and Pull now'::text),
  updated_by = 'wave162', updated_at = now()
  where key = 'admin' and not (can::text like '%The Loom pull in the Transcript archive%');
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('loom', 'wave162', 'Loom pull', 'meetings uploaded by hand', 'pulled from Loom on Monday, Wednesday and Friday at 7:30 (Toronto)', 'wave162');

-- the record
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260929010600', 'wa162b_loom_schedule', array[$m$insert into public.app_config (key, value, updated_at) values ('loom_pull_slack', 'off', now()) on conflict (key) do nothing$m$,$m$select cron.unschedule('wa-loom-pull') where exists (select 1 from cron.job where jobname = 'wa-loom-pull')$m$,$m$select cron.schedule('wa-loom-pull', '30 11,12 * * 1,3,5', $$select public.call_edge('loom-pull', '{"action":"sync","why":"schedule"}'::jsonb) where extract(hour from (now() at time zone 'America/Toronto')) = 7$$)$m$,$m$update public.hub_access_profiles set can = can || to_jsonb('The Loom pull in the Transcript archive: what came in from Loom on Monday, Wednesday and Friday mornings, filing or skipping a recording that needs a look, and Pull now'::text),
  updated_by = 'wave162', updated_at = now()
  where key = 'admin' and not (can::text like '%The Loom pull in the Transcript archive%')$m$,$m$insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('loom', 'wave162', 'Loom pull', 'meetings uploaded by hand', 'pulled from Loom on Monday, Wednesday and Friday at 7:30 (Toronto)', 'wave162')$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
