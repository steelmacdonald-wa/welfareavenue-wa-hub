-- wave149: the loading screen is rebuilt every morning (the news banner) and once a week (the lessons, learnings and
-- milestones: the first run of each week, Monday in Toronto); the admin profile says where to manage it
select cron.unschedule('wa-hub-reel') where exists (select 1 from cron.job where jobname = 'wa-hub-reel');
select cron.schedule('wa-hub-reel', '21 10 * * *', $$select public.call_edge('hub-reel', '{"action":"build"}'::jsonb)$$);
update public.hub_access_profiles
   set can = can || to_jsonb('The loading screen in Admin: this week''s lessons, learnings and milestones, the news banner, taking a line off and adding an update'::text),
       updated_by = 'Claude (for Steel)', updated_at = now()
 where key = 'admin' and not (can::text like '%The loading screen in Admin%');
-- the loading screen lines get their own model route (Sonnet first: one call a week, seen by everyone)
insert into public.ai_routes (task, label, chain, jev, max_tokens, notes, updated_at, updated_by, mode)
values ('reel', 'Loading screen lines', array['anthropic/claude-sonnet-5','anthropic/claude-haiku-4.5','openai/gpt-5-mini'], false, null,
  'wave149: once a week, the lessons, learnings and milestones that rotate on the loading screen (hub-reel), in Welfare Avenue''s voice and under 115 characters each. Sonnet first: it is one call a week and the lines are seen by everyone.', now(), 'Hub release (wave149)', 'chain')
on conflict (task) do update set label = excluded.label, chain = excluded.chain, notes = excluded.notes, updated_at = now(), updated_by = excluded.updated_by, mode = excluded.mode;
