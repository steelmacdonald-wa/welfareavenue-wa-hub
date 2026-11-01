-- 26/10/26 wave265: Ask the Hub for guests, database (applied: wa265a and wa265b; pending: wa265c)

-- wa265_ask_guests (26/10/26): Ask the Hub for guests.
-- Steel (26/10/26, after the JDCC case interview of 25/10/26 with Amanda, Tate and Misha): the JDCC 2027 Charity Case
-- delegates get a link to "the chatbot, not the Hub" where they can ask anything about Welfare Avenue, with confidential
-- information kept out; Amanda and Misha test it first; a ChatGPT/Claude-like page with chats and projects; Sonnet through
-- OpenRouter with the credits limited.
-- Design: every table here is read and written only by the ask-guest edge function with the service key. Nothing is granted to
-- anon or authenticated and no row policy opens anything, so no browser can reach these tables directly. Guests sign in with a
-- personal link (a code we keep only as a hash); the Hub only ever reads knowledge sections a manager has approved.
-- ASCII only.

create table public.ask_guest_spaces (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (length(name) between 2 and 80),
  tagline text check (length(tagline) <= 160),
  welcome text check (length(welcome) <= 600),
  status text not null default 'testing' check (status in ('testing', 'open', 'closed')),
  opens_at timestamptz,
  closes_at timestamptz,
  daily_limit int not null default 30 check (daily_limit between 1 and 500),
  total_limit int not null default 300 check (total_limit between 1 and 10000),
  monthly_budget numeric(8,2) not null default 20 check (monthly_budget between 0 and 1000),
  answer_tokens int not null default 700 check (answer_tokens between 200 and 900),
  facts_only boolean not null default true,
  suggestions jsonb not null default '[]'::jsonb check (jsonb_typeof(suggestions) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.ask_guest_spaces is
  'wave265: a group of guests who can use Ask the Hub from hub.welfareavenue.com/ask (first: jdcc-2027, the JDCC 2027 Charity Case delegates). Holds the switch (testing: testers and organizers only; open: delegates too; closed: nobody), the dates and the cost limits. Written by ask-guest (managers); never readable from a browser.';
comment on column public.ask_guest_spaces.status is 'testing = only testers and organizers can sign in; open = delegates too (from opens_at if set); closed = nobody.';
comment on column public.ask_guest_spaces.daily_limit is 'Answers a delegate can get per Toronto day (testers and organizers get twice as many).';
comment on column public.ask_guest_spaces.total_limit is 'Answers a delegate can get in all (testers and organizers twice as many).';
comment on column public.ask_guest_spaces.monthly_budget is 'US dollars of model spend per calendar month (Toronto) for the whole space; at the cap the Hub pauses for its guests.';
comment on column public.ask_guest_spaces.answer_tokens is 'max_tokens per answer sent to the router (the guest_ask route also caps at 900).';
comment on column public.ask_guest_spaces.facts_only is 'When true the Hub shares facts and context but does not write the teams'' case solution.';
comment on column public.ask_guest_spaces.suggestions is 'Up to six starter questions shown on an empty chat (JSON array of strings).';

create table public.ask_guests (
  id bigint generated always as identity primary key,
  space_id bigint not null references public.ask_guest_spaces(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  email text check (email is null or length(email) <= 200),
  team text check (team is null or length(team) <= 120),
  role text not null default 'delegate' check (role in ('delegate', 'organizer', 'tester')),
  code_hash text not null unique,
  code_hint text check (code_hint is null or length(code_hint) <= 8),
  status text not null default 'active' check (status in ('active', 'revoked')),
  note text check (note is null or length(note) <= 500),
  staff_email text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_seen_at timestamptz,
  last_seen_at timestamptz
);
create index ask_guests_space_idx on public.ask_guests (space_id);
create unique index ask_guests_staff_idx on public.ask_guests (space_id, staff_email) where staff_email is not null;
comment on table public.ask_guests is
  'wave265: a person who can use Ask the Hub as a guest (a delegate, an organizer or a tester). They sign in with a personal link; only the SHA-256 of its code is kept (code_hash), so a lost link is replaced, never shown again. Written by ask-guest; never readable from a browser.';
comment on column public.ask_guests.team is 'School or group. Guests with the same team in the same space can share projects with each other.';
comment on column public.ask_guests.code_hash is 'SHA-256 (hex) of the personal code in their link (12 characters). The code itself is shown once to the manager who made it.';
comment on column public.ask_guests.code_hint is 'Last four characters of the code, so managers can tell links apart.';
comment on column public.ask_guests.staff_email is 'Set when a Welfare Avenue manager uses Try it yourself: their own tester entry.';

create table public.ask_guest_sessions (
  id bigint generated always as identity primary key,
  guest_id bigint not null references public.ask_guests(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz,
  user_agent text check (user_agent is null or length(user_agent) <= 300),
  revoked_at timestamptz
);
create index ask_guest_sessions_guest_idx on public.ask_guest_sessions (guest_id);
comment on table public.ask_guest_sessions is
  'wave265: signed-in browsers of guests. The browser keeps a random token; only its SHA-256 is stored. Revoked when the guest is revoked or gets a new link. 30 days.';

create table public.ask_guest_projects (
  id bigint generated always as identity primary key,
  guest_id bigint not null references public.ask_guests(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  instructions text check (instructions is null or length(instructions) <= 2000),
  team_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index ask_guest_projects_guest_idx on public.ask_guest_projects (guest_id);
comment on table public.ask_guest_projects is
  'wave265: a guest''s project (a folder of chats with notes the Hub reads with every question in it). team_shared lets teammates (same space and team) read its chats and start their own in it.';

create table public.ask_guest_chats (
  id bigint generated always as identity primary key,
  guest_id bigint not null references public.ask_guests(id) on delete cascade,
  project_id bigint references public.ask_guest_projects(id) on delete set null,
  title text not null default 'New chat' check (length(title) between 1 and 120),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index ask_guest_chats_guest_idx on public.ask_guest_chats (guest_id, updated_at desc);
create index ask_guest_chats_project_idx on public.ask_guest_chats (project_id);
comment on table public.ask_guest_chats is 'wave265: a guest''s conversation with the Hub. Only its owner writes in it; deleted_at hides it.';

create table public.ask_guest_messages (
  id bigint generated always as identity primary key,
  chat_id bigint not null references public.ask_guest_chats(id) on delete cascade,
  guest_id bigint not null references public.ask_guests(id) on delete cascade,
  space_id bigint not null references public.ask_guest_spaces(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb not null default '[]'::jsonb,
  model text,
  input_tokens int,
  output_tokens int,
  cost numeric(10,6),
  status text not null default 'ok' check (status in ('ok', 'refused', 'error', 'stopped')),
  feedback smallint check (feedback in (-1, 1)),
  created_at timestamptz not null default now()
);
create index ask_guest_messages_chat_idx on public.ask_guest_messages (chat_id, id);
create index ask_guest_messages_guest_idx on public.ask_guest_messages (guest_id, created_at);
create index ask_guest_messages_space_idx on public.ask_guest_messages (space_id, created_at);
comment on table public.ask_guest_messages is
  'wave265: questions and answers in guest chats. An answer carries the model, tokens and cost (US dollars) of its model call, the knowledge sections it used (sources) and the guest''s thumbs up or down. status: ok, refused (an off-limits question: no model call), error, stopped (the guest pressed stop). Managers read the questions to improve the knowledge.';

create table public.ask_guest_kb (
  id bigint generated always as identity primary key,
  space_id bigint references public.ask_guest_spaces(id) on delete cascade,
  key text not null unique check (key ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  title text not null check (length(title) between 2 and 120),
  category text not null default 'about' check (category ~ '^[a-z-]{2,30}$'),
  body text not null check (length(body) between 1 and 20000),
  core boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'approved', 'off')),
  sensitivity text check (sensitivity in ('public', 'internal-ok', 'needs-steel')),
  sources text check (sources is null or length(sources) <= 2000),
  review_note text check (review_note is null or length(review_note) <= 2000),
  sort int not null default 100,
  fts tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  approved_at timestamptz,
  approved_by text
);
create index ask_guest_kb_fts_idx on public.ask_guest_kb using gin (fts);
create index ask_guest_kb_space_idx on public.ask_guest_kb (space_id, status);
comment on table public.ask_guest_kb is
  'wave265: what guests can learn from Ask the Hub. The Hub only ever reads sections with status approved (a manager''s OK); drafts wait for review and off sections are kept but never read. core sections go with every question; the others are picked by full-text search. space_id null = every space.';
comment on column public.ask_guest_kb.sensitivity is 'How the draft was labelled when written: public (already public), internal-ok (harmless internal facts), needs-steel (finances, plans, challenges and the like).';
comment on column public.ask_guest_kb.review_note is 'Note for the reviewer: what was left out or is uncertain. Never sent to the model.';

create table public.ask_guest_managers (
  email text primary key check (email = lower(email) and length(email) <= 200),
  role text not null default 'manager' check (role in ('owner', 'manager', 'coordinator')),
  added_by text,
  created_at timestamptz not null default now()
);
comment on table public.ask_guest_managers is
  'wave265: Welfare Avenue staff who manage Ask the Hub for guests from hub.welfareavenue.com/ask with their Hub sign-in. owner: everything incl. managers; manager: people, knowledge, questions, settings; coordinator: people and usage only (no knowledge, no questions).';

create table public.ask_guest_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index ask_guest_attempts_ip_idx on public.ask_guest_attempts (ip_hash, created_at);
comment on table public.ask_guest_attempts is 'wave265: sign-in attempts with a personal code, by a hash of the address (never the address), to slow down guessing. Pruned after 7 days by ask-guest.';

-- row security on, no policies: only the service role (the edge function) reads and writes
alter table public.ask_guest_spaces enable row level security;
alter table public.ask_guests enable row level security;
alter table public.ask_guest_sessions enable row level security;
alter table public.ask_guest_projects enable row level security;
alter table public.ask_guest_chats enable row level security;
alter table public.ask_guest_messages enable row level security;
alter table public.ask_guest_kb enable row level security;
alter table public.ask_guest_managers enable row level security;
alter table public.ask_guest_attempts enable row level security;

revoke all on public.ask_guest_spaces, public.ask_guests, public.ask_guest_sessions, public.ask_guest_projects, public.ask_guest_chats,
  public.ask_guest_messages, public.ask_guest_kb, public.ask_guest_managers, public.ask_guest_attempts from public, anon, authenticated;
grant all on public.ask_guest_spaces, public.ask_guests, public.ask_guest_sessions, public.ask_guest_projects, public.ask_guest_chats,
  public.ask_guest_messages, public.ask_guest_kb, public.ask_guest_managers, public.ask_guest_attempts to service_role;
grant usage, select on sequence public.ask_guest_spaces_id_seq, public.ask_guests_id_seq, public.ask_guest_sessions_id_seq,
  public.ask_guest_projects_id_seq, public.ask_guest_chats_id_seq, public.ask_guest_messages_id_seq, public.ask_guest_kb_id_seq,
  public.ask_guest_attempts_id_seq to service_role;

-- the knowledge a question gets: every approved core section, then the approved sections that share words with the question
create or replace function public.ask_guest_kb_pick(p_space bigint, p_q text, p_limit int default 6)
returns table (id bigint, key text, title text, category text, body text, core boolean, rank real)
language sql stable set search_path to '' as $$
  with q as (
    select (select to_tsquery('english', string_agg(quote_literal(u.lexeme) || ':*', ' | '))
              from unnest(to_tsvector('english', left(coalesce(p_q, ''), 3000))) as u(lexeme, positions, weights)
             where length(u.lexeme) > 2) as tsq
  ), base as (
    select k.id, k.key, k.title, k.category, k.body, k.core, k.sort,
           case when k.core then 1000::real else coalesce(ts_rank_cd(k.fts, q.tsq, 1), 0)::real end as rank
      from public.ask_guest_kb k cross join q
     where k.status = 'approved' and (k.space_id is null or k.space_id = p_space)
       and (k.core or (q.tsq is not null and k.fts @@ q.tsq))
  )
  (select b.id, b.key, b.title, b.category, b.body, b.core, b.rank from base b where b.core order by b.sort, b.id)
  union all
  (select b.id, b.key, b.title, b.category, b.body, b.core, b.rank from base b where not b.core order by b.rank desc, b.sort, b.id limit greatest(1, least(coalesce(p_limit, 6), 12)));
$$;
comment on function public.ask_guest_kb_pick(bigint, text, int) is
  'wave265: the knowledge sections a guest question gets: all approved core sections, then up to p_limit approved sections ranked by full-text match (any word of the question, word endings forgiven). Service role only (ask-guest).';

-- a guest's use so far (answers that called the model) and the space's spend this month, Toronto time
create or replace function public.ask_guest_usage(p_guest bigint)
returns jsonb language sql stable set search_path to '' as $$
  with g as (select id, space_id from public.ask_guests where id = p_guest),
  t as (select (date_trunc('day', now() at time zone 'America/Toronto') at time zone 'America/Toronto') as day0,
               (date_trunc('month', now() at time zone 'America/Toronto') at time zone 'America/Toronto') as month0)
  select jsonb_build_object(
    'today', (select count(*) from public.ask_guest_messages m, t where m.guest_id = p_guest and m.role = 'assistant' and m.status in ('ok', 'stopped') and m.created_at >= t.day0),
    'total', (select count(*) from public.ask_guest_messages m where m.guest_id = p_guest and m.role = 'assistant' and m.status in ('ok', 'stopped')),
    'month_cost', (select coalesce(sum(m.cost), 0) from public.ask_guest_messages m, t, g where m.space_id = g.space_id and m.created_at >= t.month0),
    'last_ask', (select max(m.created_at) from public.ask_guest_messages m where m.guest_id = p_guest and m.role = 'user')
  );
$$;
comment on function public.ask_guest_usage(bigint) is
  'wave265: answers a guest got today and in all (status ok or stopped, Toronto day), their last question time, and their space''s model spend this calendar month (US dollars). Service role only (ask-guest).';

-- what managers see: per person and for the space
create or replace function public.ask_guest_stats(p_space bigint)
returns jsonb language sql stable set search_path to '' as $$
  with t as (select (date_trunc('day', now() at time zone 'America/Toronto') at time zone 'America/Toronto') as day0,
                    (date_trunc('month', now() at time zone 'America/Toronto') at time zone 'America/Toronto') as month0),
  a as (select m.* from public.ask_guest_messages m where m.space_id = p_space and m.role = 'assistant')
  select jsonb_build_object(
    'month_cost', (select coalesce(sum(a.cost), 0) from a, t where a.created_at >= t.month0),
    'total_cost', (select coalesce(sum(a.cost), 0) from a),
    'answers_today', (select count(*) from a, t where a.status in ('ok', 'stopped') and a.created_at >= t.day0),
    'answers_total', (select count(*) from a where a.status in ('ok', 'stopped')),
    'refused_total', (select count(*) from a where a.status = 'refused'),
    'thumbs_up', (select count(*) from a where a.feedback = 1),
    'thumbs_down', (select count(*) from a where a.feedback = -1),
    'people', coalesce((select jsonb_object_agg(x.guest_id::text, jsonb_build_object('answers', x.n, 'today', x.today, 'cost', x.cost))
                          from (select a.guest_id, count(*) filter (where a.status in ('ok', 'stopped')) as n,
                                       count(*) filter (where a.status in ('ok', 'stopped') and a.created_at >= t.day0) as today,
                                       coalesce(sum(a.cost), 0) as cost
                                  from a, t group by a.guest_id) x), '{}'::jsonb)
  );
$$;
comment on function public.ask_guest_stats(bigint) is 'wave265: usage of one guest space for its managers (spend this month and in all, answers today and in all, refusals, thumbs, and per person). Service role only (ask-guest).';

revoke execute on function public.ask_guest_kb_pick(bigint, text, int) from public, anon, authenticated;
revoke execute on function public.ask_guest_usage(bigint) from public, anon, authenticated;
revoke execute on function public.ask_guest_stats(bigint) from public, anon, authenticated;
grant execute on function public.ask_guest_kb_pick(bigint, text, int) to service_role;
grant execute on function public.ask_guest_usage(bigint) to service_role;
grant execute on function public.ask_guest_stats(bigint) to service_role;

-- the model route: Sonnet, never anything heavier; Haiku only if Sonnet fails; answers capped at 900 tokens
insert into public.ai_routes (task, label, chain, mode, jev, max_tokens, notes, updated_at, updated_by)
values ('guest_ask', 'Ask the Hub for guests', array['anthropic/claude-sonnet-5', 'anthropic/claude-haiku-4.5'], 'chain', false, 900,
        'wave265 (Steel, 26/10/26): the JDCC delegates'' Ask the Hub (ask-guest). Sonnet, never anything heavier, with the credits limited: answers up to 900 tokens, Haiku 4.5 only if Sonnet fails, and the daily, total and monthly limits in ask_guest_spaces.',
        now(), 'wave265')
on conflict (task) do nothing;

-- the first space and its owners
insert into public.ask_guest_spaces (slug, name, tagline, welcome, status, suggestions, updated_by)
values ('jdcc-2027', 'JDCC 2027 Charity Case', 'Ask the Hub anything about Welfare Avenue',
        'Ask anything about Welfare Avenue: how it started, how a Sunday serving works, the Toronto branch, funding and more. The Hub answers from what Welfare Avenue shared for the case.',
        'testing',
        '["How did Welfare Avenue start?", "How does a Sunday serving work?", "What does the Toronto branch do today?", "Where does Welfare Avenue''s funding come from?"]'::jsonb,
        'wave265')
on conflict (slug) do nothing;

insert into public.ask_guest_managers (email, role, added_by)
values ('steel.macdonald@welfareavenue.com', 'owner', 'wave265'), ('steelmacdonald@gmail.com', 'owner', 'wave265')
on conflict (email) do nothing;

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('release', 'database', 'wave265', null,
        'Ask the Hub for guests: ask_guest_* tables (service role only), ask_guest_kb_pick, ask_guest_usage, ask_guest_stats, ai_routes guest_ask (Sonnet 5, Haiku 4.5 fallback, 900 tokens), space jdcc-2027 (testing), owners Steel x2',
        'wave265');

-- wa265b (26/10/26): an answer the guest asks the Hub to give again is kept as 'replaced' (hidden from the chat), so its cost
-- stays in the month's spend and it still counts toward the guest's limits. Applied 26/10/26. (Full text: the same as applied;
-- ask_guest_usage and ask_guest_stats count ok, stopped and replaced answers.)
alter table public.ask_guest_messages drop constraint if exists ask_guest_messages_status_check;
alter table public.ask_guest_messages add constraint ask_guest_messages_status_check check (status in ('ok', 'refused', 'error', 'stopped', 'replaced'));

-- wa265c (NOT RUN YET, waits for Steel): the build-test knowledge sections off and the build-test guest revoked.
update public.ask_guest_kb set status = 'off', review_note = 'Build test only (wave265). Safe to delete.', updated_at = now(), updated_by = 'wave265'
 where key like 'zz-build-test-%';
update public.ask_guests set status = 'revoked', note = 'Build test (wave265), revoked', updated_at = now() where id = 1 and created_by = 'wave265 build test';
update public.ask_guest_sessions set revoked_at = now() where guest_id = 1 and revoked_at is null;
-- or, to remove them for good (Steel's call):
-- delete from public.ask_guest_kb where key like 'zz-build-test-%';
-- delete from public.ask_guests where id = 1 and created_by = 'wave265 build test';   -- its chats, messages and projects go with it
