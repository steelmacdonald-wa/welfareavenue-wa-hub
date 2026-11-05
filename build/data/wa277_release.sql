-- wave277 release SQL (applied once, after notify v19 is deployed). Idempotent. Run through the Supabase connector.
-- 1. the notification kind for an expiring connection; 2. the Academy lesson copy; 3. the release log line.

-- wave277 Task 5: the notification centre's kind registry (hub_notification_kinds) learns connection_expiring, so each person has a Hub and a Slack switch for it
-- (default on) and "Send me a sample" works. The notify function (v19) sends it. Idempotent. Applied at release, with the notify v19 deploy.
insert into public.hub_notification_kinds (key, grp, grp_title, sort, title, blurb, says, example_title, example_body, example_url, hub, slack, email, channel_only, audience, sender, active, updated_at) values
('connection_expiring', 'studio', 'Content Studio', 20, 'A social connection is about to expire',
 'When a connected social account (LinkedIn, TikTok and so on) will stop working within 7 days unless it is reconnected, so scheduled posts keep going out.',
 'Which platform is about to expire, in how many days, and a link to the Connections page.',
 'A social connection is about to expire', 'LinkedIn connection expires in 6 days. Reconnect it on the Connections page.', '#studio/connections',
 true, true, false, false, 'the people who publish to social media', 'notify', true, now())
on conflict (key) do update set grp = excluded.grp, grp_title = excluded.grp_title, sort = excluded.sort, title = excluded.title, blurb = excluded.blurb, says = excluded.says,
  example_title = excluded.example_title, example_body = excluded.example_body, example_url = excluded.example_url, hub = excluded.hub, slack = excluded.slack, email = excluded.email,
  channel_only = excluded.channel_only, audience = excluded.audience, sender = excluded.sender, active = excluded.active, updated_at = now();
-- undo: delete from public.hub_notification_kinds where key = 'connection_expiring';

-- the Academy lesson: the approvers are now set on the Approvals page, not named in the text
update public.trainings set body = replace(body::text, 'the named approvers (Ian and KK)', 'the approvers set on the Approvals page')::jsonb where key = 'lesson:studio';
update public.trainings set body = replace(body::text, 'how it goes to Ian and KK for approval', 'how it goes to the approvers')::jsonb where key = 'lesson:studio';
-- found at release (02/11/26): the quiz answer and three step texts named them too
update public.trainings set body = replace(body::text, 'The named approvers, Ian and KK, in the Hub and on Slack', 'The approvers set on the Approvals page, in the Hub and on Slack')::jsonb where key = 'lesson:studio';
update public.trainings set body = replace(body::text, 'Ian and KK hear', 'The approvers hear')::jsonb where key = 'lesson:studio';

select key, (body::text like '%Ian and KK%') as still_names_ian_and_kk from public.trainings where key = 'lesson:studio';

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'wave', 'wave277', 'release_copy', null, 'notify v19 kind, academy lesson copy', 'wave277'
where not exists (select 1 from public.change_log where entity_type = 'wave' and entity_id = 'wave277' and field = 'release_copy');
