-- wa116n: model routing through OpenRouter (25/09/26)
-- ai_routes: one row per AI job in the Hub, with the chain of OpenRouter
-- model ids to try (first = primary, the rest = fallbacks). ai_calls: one
-- row per model call (model actually used, tokens, cost, time). The llm
-- edge function reads the routes and writes the log; the Admin card
-- "AI models" reads both.
create table if not exists ai_routes (
  task text primary key,
  label text not null,
  chain text[] not null,
  jev boolean not null default false,
  max_tokens int,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by text
);
create table if not exists ai_calls (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  task text not null,
  caller text,
  requested_model text,
  model text,
  ok boolean not null,
  status int,
  ms int,
  input_tokens int,
  output_tokens int,
  cost numeric(12,6),
  fallback_used boolean not null default false,
  error text
);
create index if not exists ai_calls_created_idx on ai_calls (created_at desc);
create index if not exists ai_calls_task_idx on ai_calls (task, created_at desc);

alter table ai_routes enable row level security;
alter table ai_calls enable row level security;
drop policy if exists ai_routes_read on ai_routes;
create policy ai_routes_read on ai_routes for select to authenticated using (is_wa_staff() or is_hub_admin());
drop policy if exists ai_calls_read on ai_calls;
create policy ai_calls_read on ai_calls for select to authenticated using (is_hub_admin());
-- writes: service role only (the llm function)

-- usage per task over the last N days, for the Admin card
create or replace function ai_usage(days int default 7)
returns table (task text, calls bigint, ok_calls bigint, avg_ms int, cost numeric, input_tokens bigint, output_tokens bigint, last_at timestamptz, last_model text, models text[])
language sql security definer set search_path = public as $$
  select task, count(*) as calls, count(*) filter (where ok) as ok_calls, round(avg(ms))::int as avg_ms,
         coalesce(sum(cost), 0)::numeric as cost, coalesce(sum(input_tokens), 0)::bigint as input_tokens, coalesce(sum(output_tokens), 0)::bigint as output_tokens,
         max(created_at) as last_at, (array_agg(model order by created_at desc))[1] as last_model,
         array(select distinct m from unnest(array_agg(model)) as m where m is not null) as models
  from ai_calls where created_at > now() - make_interval(days => greatest(days, 1)) group by task order by cost desc, calls desc;
$$;
revoke all on function ai_usage(int) from public;
grant execute on function ai_usage(int) to authenticated, service_role;

-- routes: the right model for the right job
insert into ai_routes (task, label, chain, jev, notes) values
  ('default',            'Anything unlabelled',                 array['anthropic/claude-sonnet-5','openai/gpt-5','moonshotai/kimi-k2.6'], false, 'Used when a caller names no task.'),
  ('brain',              'Ask the Hub (Brain)',                 array['anthropic/claude-sonnet-5','openai/gpt-5','moonshotai/kimi-k2.6'], false, 'Tool use, long context, careful proposals.'),
  ('brain_suggest',      'Ask the Hub: suggestions',            array['anthropic/claude-haiku-4.5','openai/gpt-5-mini','qwen/qwen3.8-flash'], false, 'Quick suggestions beside a proposal (owner, due date, project).'),
  ('transcript_extract', 'Transcripts: tasks and decisions',    array['anthropic/claude-sonnet-5','openai/gpt-5','moonshotai/kimi-k2.6'], true, 'Kimi K2.6 carries very long transcripts. Jev checks every extracted item.'),
  ('transcript_preview', 'Transcripts: preview',                array['anthropic/claude-haiku-4.5','openai/gpt-5-mini','qwen/qwen3.8-flash'], false, 'Fast first pass before the full extraction.'),
  ('leadership',         'Leadership meetings',                 array['anthropic/claude-sonnet-5','openai/gpt-5','moonshotai/kimi-k2.6'], true, 'Executive transcripts; Jev verifies owners and decisions.'),
  ('mail_triage',        'Email filing',                        array['anthropic/claude-haiku-4.5','openai/gpt-5-mini','google/gemini-3.8-flash'], true, 'Classifier; Jev double-checks the team and the kind.'),
  ('mail_recruit',       'Email: job applications',             array['anthropic/claude-haiku-4.5','openai/gpt-5-mini','google/gemini-3.8-flash'], true, 'Pulls the candidate, role and contact out of an application.'),
  ('decision',           'Decision recommendations',            array['anthropic/claude-sonnet-5','openai/gpt-5','moonshotai/kimi-k2.6'], true, 'Jev scores the options alongside the write-up.'),
  ('reason',             'Reason suggestions',                  array['anthropic/claude-haiku-4.5','qwen/qwen3.8-flash','openai/gpt-5-mini'], false, 'Short, cheap.'),
  ('draft',              'Drafts, agendas, reports',            array['anthropic/claude-sonnet-5','openai/gpt-5','moonshotai/kimi-k2.6'], false, 'Writing quality first.'),
  ('goals',              'Goal suggestions and proposals',      array['anthropic/claude-sonnet-5','openai/gpt-5','moonshotai/kimi-k2.6'], true, 'Jev ranks candidate goals.'),
  ('profile',            'Person profiles',                     array['anthropic/claude-haiku-4.5','openai/gpt-5-mini','qwen/qwen3.8-flash'], false, 'Summaries from hub data.'),
  ('digest',             'Digests and alerts',                  array['moonshotai/kimi-k2.6','google/gemini-3.8-flash','anthropic/claude-sonnet-5'], false, 'Long inputs, plain summaries.'),
  ('checkin',            'Check-in scope',                      array['anthropic/claude-haiku-4.5','openai/gpt-5-mini','qwen/qwen3.8-flash'], false, 'Small structured output.'),
  ('shoutout',           'Shout-outs',                          array['anthropic/claude-haiku-4.5','openai/gpt-5-mini','qwen/qwen3.8-flash'], false, 'One warm line about a finished project or a good week.'),
  ('decide',             'Jev decisions',                       array['~typesafe/jev-latest'], true, 'OpenRouter Decisions API: choices, scores, yes/no with probabilities. Not a chat model.')
on conflict (task) do update set label = excluded.label, chain = excluded.chain, jev = excluded.jev, notes = excluded.notes, updated_at = now(), updated_by = 'wa116n seed'
where ai_routes.updated_by is null or ai_routes.updated_by = 'wa116n seed';

-- keep the log to 90 days
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'wa-ai-calls-prune') then
      perform cron.schedule('wa-ai-calls-prune', '25 3 * * *', $c$delete from ai_calls where created_at < now() - interval '90 days'$c$);
    end if;
  end if;
end $$;
