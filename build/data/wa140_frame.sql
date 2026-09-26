-- wave140 (26/09/26): framing the mined Drive in the Hub. The refined results live in four tables the pages read:
-- wa_history (Our story: the timeline since March 2020), wa_partners (the organisations Welfare Avenue has worked
-- with), wa_lessons (what it learned) and wa_documents (the document finder). Every row carries its sources (the
-- document and the words it came from). Leaders correct and add; "leadership" rows are for leaders and directors.
-- Also the mine schema: flat views over drive_mined for the refine step (never exposed to the web app).

create schema if not exists mine;
revoke all on schema mine from public, anon, authenticated;
comment on schema mine is 'wave140: flat, read-only views over drive_mined (the mining results) for refining them into wa_history, wa_partners, wa_lessons and wa_documents. Not exposed to the web app.';

create or replace view mine.docs as
select m.file_id, i.name, i.path, i.source, i.drive_name, i.web_url, i.mime, i.created_time, i.modified_time, i.sensitivity,
       m.result->'doc'->>'date' as doc_date, m.result->'doc'->>'kind' as doc_kind, m.result->'doc'->>'summary' as summary,
       m.result->'doc'->>'department' as department, m.result->'doc'->>'language' as language,
       (m.result->'resource'->>'yes')::boolean as reusable, m.result->'resource'->>'title' as resource_title, m.result->'resource'->>'what' as resource_what,
       m.result->'resource'->>'kind' as resource_kind, (m.result->'resource'->>'still_useful')::boolean as still_useful, m.model
  from public.drive_mined m join public.drive_inventory i using (file_id)
 where m.stage = 'done';

create or replace view mine.events as
select m.file_id, (e.ord - 1)::int as i, i.name as doc, i.path, i.source, i.drive_name, i.web_url, m.result->'doc'->>'date' as doc_date,
       e.v->>'date' as date, e.v->>'date_end' as date_end, e.v->>'date_basis' as basis, e.v->>'title' as title, e.v->>'summary' as summary,
       e.v->>'kind' as kind, e.v->>'happened' as happened, e.v->>'city' as city, e.v->'partners' as partners, e.v->'numbers' as numbers,
       e.v->>'link' as link, e.v->>'quote' as quote,
       (select (c->>'supported')::numeric from jsonb_array_elements(coalesce(m.checked->'items', '[]')) c where c->>'kind' = 'event' and (c->>'i')::int = e.ord - 1 limit 1) as jev_supported,
       (select (c->>'date_ok')::numeric from jsonb_array_elements(coalesce(m.checked->'items', '[]')) c where c->>'kind' = 'event' and (c->>'i')::int = e.ord - 1 limit 1) as jev_date_ok,
       (select (c->>'quote_found')::boolean from jsonb_array_elements(coalesce(m.checked->'items', '[]')) c where c->>'kind' = 'event' and (c->>'i')::int = e.ord - 1 limit 1) as quote_found
  from public.drive_mined m join public.drive_inventory i using (file_id)
  cross join lateral jsonb_array_elements(coalesce(m.result->'events', '[]')) with ordinality e(v, ord)
 where m.stage = 'done';

create or replace view mine.partners as
select m.file_id, (p.ord - 1)::int as i, i.name as doc, i.path, i.source, i.web_url, m.result->'doc'->>'date' as doc_date,
       p.v->>'name' as name, p.v->>'kind' as kind, p.v->>'city' as city, p.v->>'relationship' as relationship, p.v->>'what' as what,
       p.v->>'when' as "when", p.v->>'contact_role' as contact_role, p.v->>'quote' as quote,
       (select (c->>'real')::numeric from jsonb_array_elements(coalesce(m.checked->'items', '[]')) c where c->>'kind' = 'partner' and (c->>'i')::int = p.ord - 1 limit 1) as jev_real
  from public.drive_mined m join public.drive_inventory i using (file_id)
  cross join lateral jsonb_array_elements(coalesce(m.result->'partners', '[]')) with ordinality p(v, ord)
 where m.stage = 'done';

create or replace view mine.lessons as
select m.file_id, (l.ord - 1)::int as i, i.name as doc, i.path, i.source, i.web_url, m.result->'doc'->>'date' as doc_date,
       l.v->>'topic' as topic, l.v->>'lesson' as lesson, l.v->>'context' as context, l.v->>'area' as area, l.v->>'year' as year, l.v->>'quote' as quote,
       (select (c->>'grounded')::numeric from jsonb_array_elements(coalesce(m.checked->'items', '[]')) c where c->>'kind' = 'learning' and (c->>'i')::int = l.ord - 1 limit 1) as jev_grounded
  from public.drive_mined m join public.drive_inventory i using (file_id)
  cross join lateral jsonb_array_elements(coalesce(m.result->'learnings', '[]')) with ordinality l(v, ord)
 where m.stage = 'done';

create or replace view mine.facts as
select m.file_id, (f.ord - 1)::int as i, i.name as doc, i.path, i.source, i.web_url, m.result->'doc'->>'date' as doc_date,
       f.v->>'topic' as topic, f.v->>'fact' as fact, f.v->>'as_of' as as_of, f.v->>'quote' as quote
  from public.drive_mined m join public.drive_inventory i using (file_id)
  cross join lateral jsonb_array_elements(coalesce(m.result->'facts', '[]')) with ordinality f(v, ord)
 where m.stage = 'done';

revoke all on all tables in schema mine from public, anon, authenticated;

-- ---------------------------------------------------------------- Our story
create table if not exists public.wa_history (
  id bigint generated always as identity primary key,
  key text unique,
  date_start date not null,
  date_end date,
  date_precision text not null default 'day' check (date_precision in ('day', 'month', 'season', 'year')),
  title text not null,
  summary text,
  kind text not null check (kind in ('milestone', 'event', 'program', 'partnership', 'funding', 'recognition', 'governance', 'team', 'media', 'expansion')),
  city text,
  partners text[] not null default '{}',
  numbers jsonb,
  highlight boolean not null default false,
  visibility text not null default 'everyone' check (visibility in ('everyone', 'leadership')),
  confidence numeric,
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_wa_history_date on public.wa_history (date_start);
alter table public.wa_history enable row level security;
drop policy if exists wa_history_read on public.wa_history;
create policy wa_history_read on public.wa_history for select to authenticated using (
  public.is_hub_leader() or (status = 'published' and (public.is_board_viewer() or (public.is_wa_staff() and visibility = 'everyone'))));
drop policy if exists wa_history_write on public.wa_history;
create policy wa_history_write on public.wa_history for all to authenticated using (public.is_hub_leader()) with check (public.is_hub_leader());
revoke all on public.wa_history from anon;
grant select, insert, update, delete on public.wa_history to authenticated;
comment on table public.wa_history is 'Our story (page #ourstory): what Welfare Avenue has done since March 2020, refined from its Drive, Canva designs and posts (wave140). sources lists the documents and the words each entry came from. Staff read everyone rows, directors and leaders read all published rows, leaders also see hidden ones and write.';
comment on column public.wa_history.visibility is 'everyone: all staff and directors. leadership: leaders (admin or leader role) and directors only, for entries from board and leadership documents that are not public.';
comment on column public.wa_history.highlight is 'One of the milestones shown at the top of Our story and in the Welfare Avenue foundations reading.';
comment on column public.wa_history.sources is 'Array of {file_id, name, url, quote}: where the entry came from.';

-- ---------------------------------------------------------------- Partners
create table if not exists public.wa_partners (
  id bigint generated always as identity primary key,
  key text unique,
  name text not null,
  aka text[] not null default '{}',
  kind text,
  city text,
  relationship text not null default 'partner' check (relationship in ('partner', 'sponsor', 'funder', 'donor organisation', 'venue', 'supplier', 'collaborator')),
  status text not null default 'past' check (status in ('active', 'past', 'prospect', 'declined')),
  first_year int,
  last_year int,
  summary text,
  contact_role text,
  website text,
  visibility text not null default 'everyone' check (visibility in ('everyone', 'leadership')),
  sources jsonb not null default '[]'::jsonb,
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_wa_partners_name on public.wa_partners (lower(name));
alter table public.wa_partners enable row level security;
drop policy if exists wa_partners_read on public.wa_partners;
create policy wa_partners_read on public.wa_partners for select to authenticated using (
  public.is_hub_leader() or public.is_board_viewer() or (public.is_wa_staff() and visibility = 'everyone'));
drop policy if exists wa_partners_write on public.wa_partners;
create policy wa_partners_write on public.wa_partners for all to authenticated using (public.is_hub_leader()) with check (public.is_hub_leader());
revoke all on public.wa_partners from anon;
grant select, insert, update, delete on public.wa_partners to authenticated;
comment on table public.wa_partners is 'Partners (page #partners): every organisation Welfare Avenue has worked with, sponsored by or approached, refined from its Drive, Canva designs and posts (wave140), with what they did, the years and the sources. Leaders correct and add.';
comment on column public.wa_partners.status is 'active: working together now; past: worked together before; prospect: approached or planned, nothing yet; declined: said no.';

-- ---------------------------------------------------------------- Lessons
create table if not exists public.wa_lessons (
  id bigint generated always as identity primary key,
  key text unique,
  lesson text not null,
  context text,
  area text not null check (area in ('events', 'volunteers', 'food and meals', 'fundraising', 'partnerships', 'marketing', 'operations', 'governance', 'programs', 'team', 'other')),
  topic text,
  years text,
  sources jsonb not null default '[]'::jsonb,
  visibility text not null default 'everyone' check (visibility in ('everyone', 'leadership')),
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.wa_lessons enable row level security;
drop policy if exists wa_lessons_read on public.wa_lessons;
create policy wa_lessons_read on public.wa_lessons for select to authenticated using (
  public.is_hub_leader() or (status = 'published' and (public.is_board_viewer() or (public.is_wa_staff() and visibility = 'everyone'))));
drop policy if exists wa_lessons_write on public.wa_lessons;
create policy wa_lessons_write on public.wa_lessons for all to authenticated using (public.is_hub_leader()) with check (public.is_hub_leader());
revoke all on public.wa_lessons from anon;
grant select, insert, update, delete on public.wa_lessons to authenticated;
comment on table public.wa_lessons is 'Lessons learned (Our story, Lessons): what Welfare Avenue learned, as advice the team can act on, with what happened and the sources (wave140). Leaders correct and add.';

-- ---------------------------------------------------------------- Documents
create table if not exists public.wa_documents (
  file_id text primary key,
  title text not null,
  summary text,
  doc_date text,
  year int,
  kind text,
  team text,
  source text,
  location text,
  url text,
  organisations text[] not null default '{}',
  topics text[] not null default '{}',
  reusable boolean not null default false,
  resource_title text,
  resource_what text,
  visibility text not null default 'everyone' check (visibility in ('everyone', 'leadership')),
  fts tsvector,
  updated_at timestamptz not null default now()
);
create index if not exists idx_wa_documents_fts on public.wa_documents using gin (fts);
create or replace function public.wa_documents_fts()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.fts := to_tsvector('simple', coalesce(new.title, '') || ' ' || coalesce(new.summary, '') || ' ' || coalesce(new.doc_date, '') || ' ' || coalesce(new.kind, '') || ' ' ||
    coalesce(new.location, '') || ' ' || coalesce(array_to_string(new.organisations, ' '), '') || ' ' || coalesce(array_to_string(new.topics, ' '), '') || ' ' ||
    coalesce(new.resource_title, '') || ' ' || coalesce(new.resource_what, ''));
  return new;
end;
$$;
revoke all on function public.wa_documents_fts() from public, anon, authenticated;
drop trigger if exists trg_wa_documents_fts on public.wa_documents;
create trigger trg_wa_documents_fts before insert or update on public.wa_documents for each row execute function public.wa_documents_fts();
comment on function public.wa_documents_fts() is 'Keeps wa_documents.fts (the search words: title, summary, date, kind, place, organisations, topics, resource) current on every write.';
alter table public.wa_documents enable row level security;
drop policy if exists wa_documents_read on public.wa_documents;
create policy wa_documents_read on public.wa_documents for select to authenticated using (
  public.is_hub_leader() or (public.is_wa_staff() and visibility = 'everyone'));
revoke all on public.wa_documents from anon;
grant select on public.wa_documents to authenticated;
comment on table public.wa_documents is 'The document finder (page #documents): every useful Drive file, Canva design and quarter of posts the wave140 mining read, with a summary, the date it covers, the team, the kind and the organisations and topics in it, so the Hub finds documents by meaning. Private files are never here. leadership rows (board, management, HR and finance drives, Steel''s own drive) are for leaders. The mining writes it (service role).';

-- the Brain''s search over the four (security invoker: each caller sees what the policies above let them see)
create or replace function public.wa_story_search(p_q text, p_limit int default 8)
returns jsonb
language sql
stable
security invoker
set search_path to ''
as $$
  with q as (select websearch_to_tsquery('simple', coalesce(p_q, '')) as tq, lower(coalesce(p_q, '')) as raw)
  select jsonb_build_object(
    'history', coalesce((select jsonb_agg(h) from (
        select to_char(x.date_start, 'YYYY-MM-DD') as date, x.date_precision as precision, x.title, x.summary, x.kind, x.city, x.partners, x.numbers,
               (select jsonb_agg(jsonb_build_object('name', s->>'name', 'url', s->>'url')) from jsonb_array_elements(x.sources) s) as sources
          from public.wa_history x, q
         where x.status = 'published' and to_tsvector('simple', x.title || ' ' || coalesce(x.summary, '') || ' ' || array_to_string(x.partners, ' ') || ' ' || coalesce(x.city, '') || ' ' || to_char(x.date_start, 'YYYY')) @@ q.tq
         order by ts_rank(to_tsvector('simple', x.title || ' ' || coalesce(x.summary, '')), q.tq) desc, x.date_start
         limit least(coalesce(p_limit, 8), 20)) h), '[]'::jsonb),
    'partners', coalesce((select jsonb_agg(p) from (
        select x.name, x.relationship, x.status, x.first_year, x.last_year, x.summary, x.city
          from public.wa_partners x, q
         where to_tsvector('simple', x.name || ' ' || array_to_string(x.aka, ' ') || ' ' || coalesce(x.summary, '') || ' ' || coalesce(x.kind, '')) @@ q.tq
         limit least(coalesce(p_limit, 8), 20)) p), '[]'::jsonb),
    'lessons', coalesce((select jsonb_agg(l) from (
        select x.lesson, x.context, x.area, x.years
          from public.wa_lessons x, q
         where x.status = 'published' and to_tsvector('simple', x.lesson || ' ' || coalesce(x.context, '') || ' ' || coalesce(x.topic, '') || ' ' || x.area) @@ q.tq
         limit least(coalesce(p_limit, 8), 20)) l), '[]'::jsonb),
    'documents', coalesce((select jsonb_agg(d) from (
        select x.title, x.summary, x.doc_date, x.kind, x.url
          from public.wa_documents x, q
         where x.fts @@ q.tq
         order by ts_rank(x.fts, q.tq) desc
         limit least(coalesce(p_limit, 8), 20)) d), '[]'::jsonb));
$$;
revoke all on function public.wa_story_search(text, int) from public, anon;
grant execute on function public.wa_story_search(text, int) to authenticated, service_role;
comment on function public.wa_story_search(text, int) is 'Searches Our story, Partners, Lessons and the document finder for words in a question (websearch syntax) and returns the best matches of each as JSON; used by Ask the Hub. Security invoker: callers see only what the tables'' policies allow.';
