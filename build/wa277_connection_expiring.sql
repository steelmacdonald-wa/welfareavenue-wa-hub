-- wave277 Task 5: the notification centre's kind registry (hub_notification_kinds) learns connection_expiring, so each person has a Hub and a Slack switch for it
-- (default on) and "Send me a sample" works. The notify function (v19) sends it. Idempotent. Not yet applied to the live database.
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
