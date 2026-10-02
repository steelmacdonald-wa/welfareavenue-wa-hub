-- wa191h_quo_app_replies (01/10/26): the team's replies typed in the Quo app count in the Hub.
-- The first evening of Conversations showed 19 texts "waiting for an answer" while the team had answered several of them
-- in the Quo app, which the Hub never heard about (the Quo webhook only sends incoming texts). quo-send v6 'sync_threads'
-- reads the recent conversations from Quo and copies the team's own texts in (kind manual, sent_by 'Quo app', status sent,
-- never sent again), and marks the volunteer's earlier texts answered. Cron wa-quo-threads every 10 minutes while anyone has
-- texted the ops line in the last 21 days.
create unique index if not exists quo_messages_quo_app_once on public.quo_messages (quo_id) where sent_by = 'Quo app';
comment on index public.quo_messages_quo_app_once is 'wave191h: one copy of each text the team typed in the Quo app (quo-send sync_threads).';
select cron.schedule('wa-quo-threads', '3,13,23,33,43,53 * * * *',
  $c$select public.call_edge('quo-send', '{"action":"sync_threads"}'::jsonb) where exists (select 1 from public.quo_messages where direction = 'in' and created_at > now() - interval '21 days')$c$);
