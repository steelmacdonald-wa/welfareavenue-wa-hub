-- wa323_slack_ask (12/11/26, wave323): Ask the Hub in Slack. Two small tables for the slack-command function.
-- Both are for the service role only: row level security is on with no policy, and anon and authenticated hold no grant.
-- Nothing a person types and nothing the Hub answers is stored in either.
--
-- slack_ask_log: one line per Slack event (kind 'seen', with Slack's event id, so a repeat delivery is answered once) and one
--   line per question asked (kind 'dm' or 'slash': who and when), which is what the limit of 25 questions a day counts.
-- slack_ask_pending: a Confirm card waiting for its button. The action's content (input) is wiped as soon as the card is
--   confirmed, cancelled or older than a day; the function removes old rows itself.
create table if not exists public.slack_ask_log (
  id bigint generated always as identity primary key,
  event_id text unique,
  email text,
  slack_user text,
  kind text not null,
  at timestamptz not null default now()
);
create index if not exists slack_ask_log_email_at on public.slack_ask_log (email, at desc);
alter table public.slack_ask_log enable row level security;
revoke all on public.slack_ask_log from anon, authenticated;
grant all on public.slack_ask_log to service_role;
comment on table public.slack_ask_log is 'wave323: Ask the Hub in Slack. One line per Slack event (so a repeat is answered once) and one per question (who, when, dm or slash) for the daily limit. No question or answer text. Service role only.';

create table if not exists public.slack_ask_pending (
  id uuid primary key default gen_random_uuid(),
  slack_user text not null,
  email text not null,
  name text not null,
  input jsonb,
  summary text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  outcome text
);
alter table public.slack_ask_pending enable row level security;
revoke all on public.slack_ask_pending from anon, authenticated;
grant all on public.slack_ask_pending to service_role;
comment on table public.slack_ask_pending is 'wave323: Ask the Hub in Slack. A Confirm card waiting for its button: who asked, the action and its content. The content is wiped once decided or after a day. Service role only.';

-- Undo (only if needed): drop table public.slack_ask_pending; drop table public.slack_ask_log;
-- and redeploy slack-command and ask from the commit before wave323.
