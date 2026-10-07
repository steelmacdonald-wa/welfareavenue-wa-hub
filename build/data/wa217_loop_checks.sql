-- wave217 (07/10/26): the light Still in? checks.
-- Steel: "After an hour, hour and a half, 2 hours, and 2.5 hours being in, I want you to do a light check to confirm if
-- they are still in." His choices: the checks are in the Hub (118b: at 1h, then every half hour), plus one Slack DM to the
-- person themselves at 3 hours; nothing happens when nobody answers; after 2.5 hours the Hub keeps asking every half hour.
-- This file: two columns on hub_checkins, the due list and the tick for the DM, the 5-minute cron, the on/off setting.
-- Applied as migration wa217_loop_checks.

alter table public.hub_checkins add column if not exists still_in_at timestamptz;
alter table public.hub_checkins add column if not exists loop_dm_at timestamptz;
comment on column public.hub_checkins.still_in_at is 'wave217: the last time the person answered Still in (the Hub''s check under the button, Still working in Welcome back, or the 3-hour DM''s link). Written by the person''s own page (hub_checkins_own_update). The 3-hour DM skips a session answered in the last 40 minutes; other devices treat that half-hour mark as answered. Never shared: read like the rest of the row (the person, admins, HR).';
comment on column public.hub_checkins.loop_dm_at is 'wave217: when checkin-post still_dm claimed this session for the one Still in? Slack DM at 3 hours (set before sending, so a session gets at most one, sent or not). Written by the service role only.';

-- the sessions due a DM: still open, between 3 and 4 hours in, not DMed yet, no Still in in the last 40 minutes
create or replace function public.wa217_loop_dm_due()
returns table (id bigint, email text, name text, started_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select c.id, lower(c.email), c.name, c.started_at
    from public.hub_checkins c
   where c.ended_at is null
     and c.loop_dm_at is null
     and c.started_at <= now() - interval '3 hours'
     and c.started_at > now() - interval '4 hours'
     and (c.still_in_at is null or c.still_in_at < now() - interval '40 minutes')
   order by c.started_at
   limit 25
$$;
comment on function public.wa217_loop_dm_due() is 'wave217: open sessions due the one Still in? Slack DM (3 to 4 hours in, none sent yet, no Still in in the last 40 minutes, so someone answering in the Hub gets no DM). Read by checkin-post still_dm with the service key and by wa217_loop_dm_tick. Closed to the API.';
revoke all on function public.wa217_loop_dm_due() from public, anon, authenticated;
grant execute on function public.wa217_loop_dm_due() to service_role;

-- the cron's tick: calls checkin-post only when a session is due and the setting is on
create or replace function public.wa217_loop_dm_tick()
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare rid bigint;
begin
  if coalesce((select value from public.app_config where key = 'loop_still_dm'), 'on') <> 'on' then return null; end if;
  if not exists (select 1 from public.wa217_loop_dm_due()) then return null; end if;
  select public.call_edge('checkin-post', '{"action":"still_dm"}'::jsonb) into rid;
  return rid;
end $$;
comment on function public.wa217_loop_dm_tick() is 'wave217: run every 5 minutes by cron wa-loop-still-dm; calls checkin-post {action: still_dm} (trigger secret) only when wa217_loop_dm_due() has a session and app_config loop_still_dm is on. Closed to the API.';
revoke all on function public.wa217_loop_dm_tick() from public, anon, authenticated;

-- the switch (on; an admin sets it to off to stop the DMs, the Hub's checks stay)
insert into public.app_config (key, value) values ('loop_still_dm', 'on') on conflict (key) do nothing;

-- the schedule (applied separately as wa217b_loop_dm_cron, once checkin-post v7 was live)
select cron.schedule('wa-loop-still-dm', '*/5 * * * *', 'select public.wa217_loop_dm_tick()');

-- the reading (training 216): a Good to know on the checks (applied as wa217c_loop_words)
do $$
declare d_old text; d_new text;
begin
  select description into d_old from public.trainings where id = 216;
  d_new := replace(d_old, E'\n\nTry it: take the one-minute walkthrough below.',
    E'\n\nGood to know: an hour after I''m in, and every half hour after that, a small Still in? note under the button checks that you are still working. One tap answers it, and only you see it. At three hours the Hub also sends you one Slack message, just to you. Nothing changes if you leave them.\n\nTry it: take the one-minute walkthrough below.');
  if d_new = d_old then raise exception 'wa217c: training 216 did not change'; end if;
  update public.trainings set description = d_new, updated_at = now() where id = 216;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('training', '216', 'description', d_old, 'wave217: a Good to know on the Still in? checks (1h, every half hour, one Slack message at 3 hours)', 'assistant (wave217 session)');
end $$;
