-- Welfare Avenue Hub: wave271 (271b), Task 6, 01/11/26. Notifications and reminders for HR onboarding automation.
-- 1. The notification centre's kind registry (hub_notification_kinds, wave245) learns three kinds, so each person has a Hub and a Slack switch for them:
--    onboard_date (the manager is told the new hire's call date and time), onboard_grid (the manager's link to mark their availability) and
--    onboard_remind (a grid still empty: HR about the new hire's, the manager about theirs). Nothing here is ever sent to the new hire.
-- 2. hub_onboard_flows remembers which manager got the grid link and when (manager_link_member_id, manager_link_sent_at), so the link goes once per manager
--    and the reminder counts its hours from it. reminded_hire_at and reminded_manager_at (271a) mark the reminders already sent.
-- 3. wa271_remind() calls the onboard-run action remind (through call_edge, as the other cron jobs do) and a pg_cron job runs it at 17 minutes past every hour.
-- Needs wa271a_onboard.sql first. Safe to run twice. Proved offline first: node test/w271sql.mjs (PGlite, with stand-ins for pg_cron and call_edge).
-- Undo: the first section of build/wa271a_undo.sql. Applying this sends nothing: the job only asks onboard-run, and onboard-run only writes to staff through notify.

-- 1. the three kinds (the group and the sort put them after the time off and applicant kinds in People and HR)
insert into public.hub_notification_kinds (key, grp, grp_title, sort, title, blurb, says, example_title, example_body, example_url, hub, slack, email, channel_only, audience, sender, active, updated_at) values
('onboard_date', 'people', 'People and HR', 30, 'A new hire I manage has their onboarding call',
 'When HR presses Start onboarding for a new hire you manage. The onboarding call is booked then, and the date of that call is their first day.',
 'Who is starting and in what role, the date and time of the onboarding call, and a link to Onboarding in the HR centre.',
 'Alex Tremblay starts 2026-11-02', 'Alex Tremblay (Program Coordinator) has their onboarding call on Monday, November 2, 2026 at 10:00 a.m. That is their first day. Open Onboarding.', '#hrcentre/onboarding',
 true, true, false, false, 'the new hire''s manager', 'onboard-run, notify', true, now()),
('onboard_grid', 'people', 'People and HR', 40, 'A new hire I manage needs my availability',
 'Soon after a new hire accepts their offer, once the Hub can tell who their manager is or HR has confirmed one (and again, to the new manager, if HR changes the manager). One message for each manager.',
 'Who is joining and in what role, and your own link to mark when you are free for your 1-on-1 with them. The link needs no sign-in.',
 'Mark your availability for Alex Tremblay', 'Alex Tremblay (Program Coordinator) is joining. Please mark when you are free for your 1-on-1 with them. It takes a minute. Mark my availability.', '#hrcentre/onboarding',
 true, true, false, false, 'the new hire''s manager', 'onboard-run, notify', true, now()),
('onboard_remind', 'people', 'People and HR', 50, 'An availability grid is still empty after two days',
 'After onboard_remind_hours (48 by default): HR hears that a new hire has not marked their availability, and the manager hears that theirs is still empty. One reminder each for each new hire. The new hire is never sent a reminder by the Hub.',
 'Who has not marked their grid and for how long, and a link to Onboarding in the HR centre (for HR) or to your own grid (for the manager).',
 'Alex Tremblay has not marked their availability', 'Alex Tremblay (Program Coordinator) has not marked their availability yet (they accepted on 2026-10-15). Open Onboarding to send the link again or pick a time.', '#hrcentre/onboarding',
 true, true, false, false, 'the HR notify list (for the new hire''s grid) and the manager (for theirs)', 'onboard-run, notify', true, now())
on conflict (key) do update set grp = excluded.grp, grp_title = excluded.grp_title, sort = excluded.sort, title = excluded.title, blurb = excluded.blurb, says = excluded.says,
  example_title = excluded.example_title, example_body = excluded.example_body, example_url = excluded.example_url, hub = excluded.hub, slack = excluded.slack, email = excluded.email,
  channel_only = excluded.channel_only, audience = excluded.audience, sender = excluded.sender, active = excluded.active, updated_at = now();

-- 2. who got the manager's grid link, and when
alter table public.hub_onboard_flows add column if not exists manager_link_member_id bigint references public.team_members (id) on delete set null;
alter table public.hub_onboard_flows add column if not exists manager_link_sent_at timestamptz;
comment on column public.hub_onboard_flows.manager_link_member_id is 'wave271b: the manager (team_members.id) who was sent the link to mark their availability grid. If HR confirms a different manager, the link goes to the new one too and the reminder starts again.';
comment on column public.hub_onboard_flows.manager_link_sent_at is 'wave271b: when that link was sent. Null until then. The manager''s reminder counts onboard_remind_hours from here.';
grant select (manager_link_member_id, manager_link_sent_at) on public.hub_onboard_flows to authenticated;   -- as every column but pw_nonce (271a); the service key has it all

-- 3. the hourly job: onboard-run action remind. Only the service key and the cron job call it.
create or replace function public.wa271_remind()
returns bigint language sql security definer set search_path to '' as $function$
  select public.call_edge('onboard-run', '{"action":"remind"}'::jsonb)
$function$;
revoke all on function public.wa271_remind() from public, anon, authenticated;
grant execute on function public.wa271_remind() to service_role;
comment on function public.wa271_remind() is 'wave271b: asks the onboard-run edge function to run its action remind (through call_edge, with the trigger secret): tell each manager their grid link once, then remind HR about a new hire''s empty grid and the manager about theirs after onboard_remind_hours, each once. Returns the request id. Run hourly by the cron job wa-onboard-remind. Access: service role only.';

do $cron$
begin
  if exists (select 1 from cron.job where jobname = 'wa-onboard-remind') then perform cron.unschedule('wa-onboard-remind'); end if;
  perform cron.schedule('wa-onboard-remind', '17 * * * *', 'select public.wa271_remind()');
end $cron$;
