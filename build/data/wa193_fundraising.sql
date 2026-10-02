-- wa193_fundraising (02/10/26): the Fundraising app's grants data.
-- Steel (01/10/26): "build out a grant tracker and scanner that looks for grants that Welfare Avenue can win ... also build a tool
-- that helps with grant writing and the approach we should take to winning grants going forward ... under a new app called
-- Fundraising". Then: "Using our past grant applications for reference on future ones, also for new grants that come in they
-- should be sent to the grants channel on slack".
-- 1. fund_funders: every funder we know (the watchlist the scanner re-reads, the ones we applied to, the ones screened out).
-- 2. fund_grants: the pipeline, one row per opportunity or application, with its stage, fit score, owner, dates and links.
-- 3. fund_grant_log: what happened on a grant (notes, calls, stage changes, decisions).
-- 4. fund_sources: the pages and searches the scanner checks; fund_scan_runs and fund_scan_finds: what each run found
--    (Found for you: keep or dismiss).
-- 5. fund_facts: the fact base the writer drafts from (WA's own words, each with its source and a verified flag).
-- 6. fund_documents: past applications and letters, searchable, the writer's reference material.
-- 7. fund_drafts: the writer's drafts (the funder's questions and the answers, edited in place).
-- 8. fund_settings: the donor program, the scanner (the Slack channel) and the playbook.
-- Access: the Fundraising app's page is 'fund' (the Fundraising, Executive and Admin profiles); the database follows it
-- (wa_page_ok('fund')), as the CRM tables follow 'crm'. Delete is for leaders and admins.

-- ---------- helpers ----------
create or replace function public.wa_fund_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_wa_staff() and coalesce(public.wa_page_ok('fund'), true);
$$;
comment on function public.wa_fund_ok() is 'wave193: can this person open the Fundraising app (the fund page)? Staff whose profile allows it; the built-in gate when the profile does not decide. The fund_* policies use it.';
revoke all on function public.wa_fund_ok() from public, anon;
grant execute on function public.wa_fund_ok() to authenticated;

create or replace function public.wa_fund_lead()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.wa_fund_ok() and exists (select 1 from public.hub_roles r where r.email = public.wa_email() and r.role in ('leader', 'admin'));
$$;
comment on function public.wa_fund_lead() is 'wave193: a leader or admin who can open the Fundraising app (may delete grants, funders, facts and documents).';
revoke all on function public.wa_fund_lead() from public, anon;
grant execute on function public.wa_fund_lead() to authenticated;

-- ---------- 1. funders ----------
create table if not exists public.fund_funders (
  id bigint generated always as identity primary key,
  name text not null,
  aliases text[] not null default '{}',
  kind text not null default 'foundation' check (kind in ('government_federal', 'government_provincial', 'municipal', 'foundation', 'community_foundation', 'corporate', 'student_fund', 'in_kind', 'network', 'other')),
  region text not null default 'canada' check (region in ('canada', 'quebec', 'montreal', 'ontario', 'toronto', 'international', 'other')),
  url text,
  portal text,
  contact text,
  eligibility text,
  funds_what text,
  cycle text,
  next_deadline date,
  amount_min numeric,
  amount_max numeric,
  currency text not null default 'CAD',
  fit text not null default 'unknown' check (fit in ('good', 'possible', 'weak', 'unknown')),
  fit_note text,
  relationship text,
  notes text,
  watch boolean not null default false,
  screened_out boolean not null default false,
  screened_reason text,
  source text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now()
);
create unique index if not exists fund_funders_name_key on public.fund_funders (lower(name));
comment on table public.fund_funders is 'wave193: every funder Welfare Avenue knows: the ones it applied to since 2022 (from the Drive trackers, the meeting transcripts and Steel''s mailbox), the watchlist researched on 02/10/26, and the ones the scanner finds. watch: the scanner re-reads its page. screened_out: not for us, with the reason (the scanner stops proposing it). fit: good, possible or weak for a small volunteer-run food-security charity, with the reason. Staff with the Fundraising app read and write; leaders and admins delete.';
comment on column public.fund_funders.aliases is 'Other names the funder goes by (French, short forms), so the scanner matches a find to the row.';
comment on column public.fund_funders.portal is 'How one applies: the portal (Benevity, SmartSimple, CyberGrants, GCOS...), an LOI, a web form, in person.';
comment on column public.fund_funders.contact is 'The funder''s office contact: a grants address or a program page, never a person''s private details.';
comment on column public.fund_funders.relationship is 'Our history with them in a few lines: applied, declined, met, a program officer''s advice.';
comment on column public.fund_funders.source is 'Where the row came from: research 02/10/26, the team''s grant lists, the scanner (run id), a person.';

-- ---------- 2. the pipeline ----------
create table if not exists public.fund_grants (
  id bigint generated always as identity primary key,
  funder_id bigint not null references public.fund_funders(id) on delete restrict,
  program text not null,
  title text,
  stage text not null default 'watching' check (stage in ('watching', 'found', 'screened', 'relationship', 'drafting', 'submitted', 'awarded', 'declined', 'not_eligible', 'dropped', 'reporting', 'closed')),
  amount_ask numeric,
  amount_awarded numeric,
  currency text not null default 'CAD',
  deadline date,
  deadline_note text,
  submitted_on date,
  decided_on date,
  decision_note text,
  report_due date,
  renewal_due date,
  fit_score integer check (fit_score between 0 and 100),
  fit jsonb,
  gates jsonb,
  owner_email text,
  owner_name text,
  partner text,
  program_area text,
  project_id bigint references public.projects(id) on delete set null,
  next_action text,
  next_action_due date,
  hours_spent numeric,
  links jsonb not null default '[]'::jsonb,
  source text,
  source_ref text,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now()
);
create index if not exists fund_grants_funder_idx on public.fund_grants (funder_id);
create index if not exists fund_grants_stage_idx on public.fund_grants (stage);
create index if not exists fund_grants_deadline_idx on public.fund_grants (deadline);
comment on table public.fund_grants is 'wave193: the grants pipeline, one row per opportunity or application. stage: watching (a future cycle), found (the scanner found it, to screen), screened (the go decision and the fit score), relationship (a call or an LOI), drafting, submitted, awarded, declined, not_eligible, dropped, reporting (an active grant with reports due), closed. Seeded from the team''s trackers (2024 to 2026), the transcripts and the mailbox on 02/10/26. Staff with the Fundraising app read and write; leaders and admins delete.';
comment on column public.fund_grants.title is 'Welfare Avenue''s project name for this application (Youth Harvest, Community Connections Initiative).';
comment on column public.fund_grants.fit is 'The fit score''s seven dimensions (eligibility, alignment, geography, amount, capacity, relationship, odds), each 0 to 5 with a note, from the playbook''s rubric; fit_score is the weighted total (70+ go, 55 to 69 conditional, under 55 no).';
comment on column public.fund_grants.gates is 'The hard gates (applicant type, geography, program exists, ask-to-budget ratio, cash-flow terms, compliance load, timing): pass, fail or unknown, with a note each.';
comment on column public.fund_grants.deadline_note is 'Words about the deadline: rolling, expected (projected from last cycle), the time of day.';
comment on column public.fund_grants.links is 'Links kept with the grant: [{label, url}] (the application doc in Drive, the confirmation, the funder''s page).';
comment on column public.fund_grants.source is 'How it came in: drive (the team''s trackers), transcript, email, scanner, research, person.';
comment on column public.fund_grants.program_area is 'What the money is for: community kitchen, Toronto, gift baskets, servings, equipment, general, capacity.';

create table if not exists public.fund_grant_log (
  id bigint generated always as identity primary key,
  grant_id bigint not null references public.fund_grants(id) on delete cascade,
  at timestamptz not null default now(),
  who text,
  kind text not null default 'note' check (kind in ('note', 'stage', 'call', 'email', 'submitted', 'decision', 'report', 'scan', 'draft')),
  text text not null
);
create index if not exists fund_grant_log_grant_idx on public.fund_grant_log (grant_id, at desc);
comment on table public.fund_grant_log is 'wave193: what happened on a grant, newest last: notes, calls, emails, stage changes (written by fund_grant_stage), decisions, reports, the scanner''s matches, drafts. Staff with the Fundraising app read and add; nothing is edited.';

-- ---------- 4. the scanner ----------
create table if not exists public.fund_sources (
  id bigint generated always as identity primary key,
  funder_id bigint references public.fund_funders(id) on delete set null,
  name text not null,
  kind text not null default 'funder_page' check (kind in ('funder_page', 'aggregator', 'search')),
  url text,
  query text,
  active boolean not null default true,
  last_checked timestamptz,
  last_changed timestamptz,
  last_hash text,
  last_summary text,
  last_error text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.fund_sources is 'wave193: what the scanner checks each week. funder_page: a funder''s program page (fetched, hashed, read by the model only when its text changed); aggregator: a page that lists calls; search: a web search question the model runs (OpenRouter''s web search). Staff with the Fundraising app read and edit; the grant-scan function writes the check results.';

create table if not exists public.fund_scan_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  trigger text not null default 'schedule' check (trigger in ('schedule', 'person', 'test')),
  by_email text,
  status text not null default 'running' check (status in ('running', 'ok', 'partial', 'error')),
  pages_checked integer not null default 0,
  pages_changed integer not null default 0,
  searches integer not null default 0,
  found_new integer not null default 0,
  found_known integer not null default 0,
  cost numeric,
  errors jsonb not null default '[]'::jsonb,
  summary text,
  slack_channel text,
  slack_ts text
);
comment on table public.fund_scan_runs is 'wave193: every run of the grant scanner: why (the Monday schedule, Scan now by a person, a test that posts nothing), what it checked, what it found, what it cost, and the Slack post in #grants (slack_ts) when new finds were posted. Staff with the Fundraising app read; the grant-scan function writes.';

create table if not exists public.fund_scan_finds (
  id bigint generated always as identity primary key,
  run_id bigint not null references public.fund_scan_runs(id) on delete cascade,
  funder_name text not null,
  program text,
  url text,
  summary text,
  amount_min numeric,
  amount_max numeric,
  deadline date,
  deadline_text text,
  eligibility text,
  region text,
  kind text,
  fit_score integer check (fit_score between 0 and 100),
  fit_note text,
  matched_funder_id bigint references public.fund_funders(id) on delete set null,
  matched_grant_id bigint references public.fund_grants(id) on delete set null,
  status text not null default 'new' check (status in ('new', 'kept', 'dismissed', 'duplicate', 'known')),
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index if not exists fund_scan_finds_status_idx on public.fund_scan_finds (status, created_at desc);
comment on table public.fund_scan_finds is 'wave193: what the scanner found. new: waits in Found for you; kept: a person kept it (fund_find_decide made the funder and the grant); dismissed: not for us, with the reason; known: the funder and program were already in the pipeline (not posted again); duplicate: the same find from another source in the same run. Staff with the Fundraising app read; the function writes; decisions go through fund_find_decide.';

-- ---------- 5. the fact base ----------
create table if not exists public.fund_facts (
  id bigint generated always as identity primary key,
  key text not null unique,
  category text not null check (category in ('mission', 'history', 'programs', 'numbers', 'people', 'partners', 'budget', 'outcomes', 'equity', 'need', 'documents', 'answers', 'other')),
  title text not null,
  body text not null,
  body_fr text,
  source text,
  verified_on date,
  verified_by text,
  status text not null default 'needs_check' check (status in ('verified', 'needs_check', 'conflict', 'retired')),
  sort integer not null default 100,
  notes text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table public.fund_facts is 'wave193: the grant writer''s fact base: Welfare Avenue''s own words about its mission, history, programs, numbers, people, partners, budgets, outcomes and the standard answers it has given funders, each with its source and whether it is verified. The writing assistant drafts only from verified facts and flags the rest; conflict marks a figure the documents disagree on (meals, volunteers, the founding year). Staff with the Fundraising app read and edit; leaders and admins delete.';
comment on column public.fund_facts.status is 'verified: checked against the Hub or a signed document and dated; needs_check: taken from a document, not yet confirmed; conflict: documents disagree, do not use until settled; retired: no longer true.';

-- ---------- 6. past applications ----------
create table if not exists public.fund_documents (
  id bigint generated always as identity primary key,
  grant_id bigint references public.fund_grants(id) on delete set null,
  funder_id bigint references public.fund_funders(id) on delete set null,
  title text not null,
  kind text not null default 'application' check (kind in ('application', 'loi', 'letter', 'budget', 'confirmation', 'report', 'guide', 'plan', 'answers', 'other')),
  lang text not null default 'en',
  doc_date date,
  text text not null,
  words integer,
  source_url text,
  source text,
  fts tsvector generated always as (to_tsvector('simple', coalesce(title, '') || ' ' || text)) stored,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists fund_documents_fts_idx on public.fund_documents using gin (fts);
create index if not exists fund_documents_grant_idx on public.fund_documents (grant_id);
comment on table public.fund_documents is 'wave193: Welfare Avenue''s past grant applications, letters of intent, budgets, confirmations and the standard-answer bank, as text, with the grant and funder they belong to. The writing assistant searches them (fts) and shows the writer the three most relevant before drafting; Save as a past application adds a finished draft here. Staff with the Fundraising app read and add; leaders and admins delete.';

-- ---------- 7. drafts ----------
create table if not exists public.fund_drafts (
  id bigint generated always as identity primary key,
  grant_id bigint references public.fund_grants(id) on delete set null,
  title text not null,
  lang text not null default 'en',
  questions jsonb not null default '[]'::jsonb,
  notes text,
  status text not null default 'draft' check (status in ('draft', 'final', 'archived')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now()
);
create index if not exists fund_drafts_grant_idx on public.fund_drafts (grant_id);
comment on table public.fund_drafts is 'wave193: the grant writer''s drafts: the funder''s questions with their word limits and the answers, drafted by the assistant (grant-write) and edited by the writer in place. questions: [{q, limit, answer, facts [keys], refs [document ids], warnings [], words}]. Staff with the Fundraising app read and edit their team''s drafts; leaders and admins delete.';

-- ---------- 8. settings ----------
create table if not exists public.fund_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table public.fund_settings is 'wave193: the Fundraising app''s settings: donor_program (goals, tiers, cadence, roles, the launch plan), scanner (the Slack channel for new finds, the schedule, the questions it asks), playbook (the approach: the fit screen, the proposal sections, the rules, the calendar discipline, the readiness checklist, as markdown). Staff with the Fundraising app read; leaders and admins write.';

-- ---------- RLS ----------
alter table public.fund_funders enable row level security;
alter table public.fund_grants enable row level security;
alter table public.fund_grant_log enable row level security;
alter table public.fund_sources enable row level security;
alter table public.fund_scan_runs enable row level security;
alter table public.fund_scan_finds enable row level security;
alter table public.fund_facts enable row level security;
alter table public.fund_documents enable row level security;
alter table public.fund_drafts enable row level security;
alter table public.fund_settings enable row level security;
revoke all on public.fund_funders, public.fund_grants, public.fund_grant_log, public.fund_sources, public.fund_scan_runs, public.fund_scan_finds, public.fund_facts, public.fund_documents, public.fund_drafts, public.fund_settings from anon;
grant select, insert, update, delete on public.fund_funders, public.fund_grants, public.fund_grant_log, public.fund_sources, public.fund_facts, public.fund_documents, public.fund_drafts, public.fund_settings to authenticated;
grant select on public.fund_scan_runs, public.fund_scan_finds to authenticated;

do $$
declare t text; pol text;
begin
  foreach t in array array['fund_funders', 'fund_grants', 'fund_grant_log', 'fund_sources', 'fund_facts', 'fund_documents', 'fund_drafts'] loop
    pol := t || '_fund_read';
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = pol) then
      execute format('create policy %I on public.%I for select to authenticated using (public.wa_fund_ok())', pol, t);
    end if;
    pol := t || '_fund_insert';
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = pol) then
      execute format('create policy %I on public.%I for insert to authenticated with check (public.wa_fund_ok())', pol, t);
    end if;
    if t <> 'fund_grant_log' then
      pol := t || '_fund_update';
      if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = pol) then
        execute format('create policy %I on public.%I for update to authenticated using (public.wa_fund_ok()) with check (public.wa_fund_ok())', pol, t);
      end if;
    end if;
    pol := t || '_fund_delete';
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = pol) then
      execute format('create policy %I on public.%I for delete to authenticated using (public.wa_fund_lead())', pol, t);
    end if;
  end loop;
  foreach t in array array['fund_scan_runs', 'fund_scan_finds'] loop
    pol := t || '_fund_read';
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = pol) then
      execute format('create policy %I on public.%I for select to authenticated using (public.wa_fund_ok())', pol, t);
    end if;
  end loop;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'fund_settings' and policyname = 'fund_settings_fund_read') then
    create policy fund_settings_fund_read on public.fund_settings for select to authenticated using (public.wa_fund_ok());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'fund_settings' and policyname = 'fund_settings_lead_write') then
    create policy fund_settings_lead_write on public.fund_settings for all to authenticated using (public.wa_fund_lead()) with check (public.wa_fund_lead());
  end if;
end $$;

-- ---------- updated_at ----------
create or replace function public.wa_fund_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.updated_by is null or new.updated_by = coalesce(old.updated_by, '') then new.updated_by := nullif(public.wa_email(), ''); end if;
  return new;
end $$;
comment on function public.wa_fund_touch() is 'wave193: keeps updated_at and updated_by on the fund_* tables.';
do $$
declare t text;
begin
  foreach t in array array['fund_funders', 'fund_grants', 'fund_sources', 'fund_facts', 'fund_drafts', 'fund_settings'] loop
    if not exists (select 1 from pg_trigger where tgname = 'trg_' || t || '_touch') then
      execute format('create trigger %I before update on public.%I for each row execute function public.wa_fund_touch()', 'trg_' || t || '_touch', t);
    end if;
  end loop;
end $$;

-- ---------- checked functions ----------
create or replace function public.fund_grant_stage(p_grant bigint, p_stage text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare g public.fund_grants; em text := nullif(public.wa_email(), '');
begin
  if not public.wa_fund_ok() then raise exception 'The Fundraising app is not open to you.'; end if;
  select * into g from public.fund_grants where id = p_grant for update;
  if g.id is null then raise exception 'No such grant.'; end if;
  if p_stage is null or p_stage = g.stage then
    if p_note is not null and btrim(p_note) <> '' then insert into public.fund_grant_log (grant_id, who, kind, text) values (g.id, em, 'note', btrim(p_note)); end if;
    return;
  end if;
  update public.fund_grants set stage = p_stage,
    submitted_on = case when p_stage = 'submitted' and submitted_on is null then current_date else submitted_on end,
    decided_on = case when p_stage in ('awarded', 'declined', 'not_eligible') and decided_on is null then current_date else decided_on end,
    decision_note = case when p_stage in ('awarded', 'declined', 'not_eligible', 'dropped') and p_note is not null and btrim(p_note) <> '' then btrim(p_note) else decision_note end,
    updated_by = em, updated_at = now()
  where id = g.id;
  insert into public.fund_grant_log (grant_id, who, kind, text)
  values (g.id, em, case when p_stage in ('awarded', 'declined', 'not_eligible') then 'decision' when p_stage = 'submitted' then 'submitted' else 'stage' end,
    'Moved from ' || replace(g.stage, '_', ' ') || ' to ' || replace(p_stage, '_', ' ') || coalesce(': ' || nullif(btrim(p_note), ''), ''));
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('fund_grant', g.id::text, 'stage', g.stage, p_stage, coalesce(em, 'hub'));
end $$;
comment on function public.fund_grant_stage(bigint, text, text) is 'wave193: moves a grant to a stage (or adds a note when the stage is the same), stamps submitted_on and decided_on, writes the grant log and change_log. Staff with the Fundraising app.';
revoke all on function public.fund_grant_stage(bigint, text, text) from public, anon;
grant execute on function public.fund_grant_stage(bigint, text, text) to authenticated;

create or replace function public.fund_find_decide(p_find bigint, p_action text, p_note text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare f public.fund_scan_finds; fid bigint; gid bigint; em text := nullif(public.wa_email(), ''); k text; r text;
begin
  if not public.wa_fund_ok() then raise exception 'The Fundraising app is not open to you.'; end if;
  select * into f from public.fund_scan_finds where id = p_find for update;
  if f.id is null then raise exception 'No such find.'; end if;
  if p_action = 'dismiss' then
    update public.fund_scan_finds set status = 'dismissed', decided_by = em, decided_at = now(), decision_note = nullif(btrim(coalesce(p_note, '')), '') where id = f.id;
    return null;
  end if;
  if p_action = 'screen_out' then
    -- not for us, and the funder stops being proposed
    update public.fund_scan_finds set status = 'dismissed', decided_by = em, decided_at = now(), decision_note = nullif(btrim(coalesce(p_note, '')), '') where id = f.id;
    if f.matched_funder_id is not null then
      update public.fund_funders set screened_out = true, screened_reason = coalesce(nullif(btrim(coalesce(p_note, '')), ''), screened_reason, 'Screened out from a scanner find'), watch = false, updated_by = em where id = f.matched_funder_id;
    else
      insert into public.fund_funders (name, kind, region, url, fit, fit_note, screened_out, screened_reason, watch, source, created_by, updated_by)
      values (btrim(f.funder_name), coalesce(nullif(f.kind, ''), 'other'), coalesce(nullif(f.region, ''), 'canada'), f.url, 'weak', f.fit_note, true, coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'Screened out from a scanner find'), false, 'scanner run ' || f.run_id, em, em)
      on conflict ((lower(name))) do update set screened_out = true, screened_reason = coalesce(excluded.screened_reason, public.fund_funders.screened_reason), watch = false, updated_by = em;
    end if;
    return null;
  end if;
  if p_action <> 'keep' then raise exception 'Unknown action.'; end if;
  k := case when f.kind in ('government_federal', 'government_provincial', 'municipal', 'foundation', 'community_foundation', 'corporate', 'student_fund', 'in_kind', 'network', 'other') then f.kind else 'other' end;
  r := case when f.region in ('canada', 'quebec', 'montreal', 'ontario', 'toronto', 'international', 'other') then f.region else 'canada' end;
  if f.matched_funder_id is not null then fid := f.matched_funder_id;
  else
    insert into public.fund_funders (name, kind, region, url, eligibility, amount_min, amount_max, fit, fit_note, watch, source, created_by, updated_by)
    values (btrim(f.funder_name), k, r, f.url, f.eligibility, f.amount_min, f.amount_max, case when coalesce(f.fit_score, 0) >= 70 then 'good' when coalesce(f.fit_score, 0) >= 55 then 'possible' else 'weak' end, f.fit_note, true, 'scanner run ' || f.run_id, em, em)
    on conflict ((lower(name))) do update set url = coalesce(public.fund_funders.url, excluded.url), updated_by = em
    returning id into fid;
  end if;
  if f.matched_grant_id is not null then
    gid := f.matched_grant_id;
    insert into public.fund_grant_log (grant_id, who, kind, text) values (gid, em, 'scan', 'The scanner found this again: ' || coalesce(f.summary, f.program, '') || coalesce(' (' || f.url || ')', ''));
  else
    insert into public.fund_grants (funder_id, program, stage, amount_ask, deadline, deadline_note, fit_score, fit, links, source, source_ref, notes, created_by, updated_by)
    values (fid, coalesce(nullif(f.program, ''), 'Grant'), 'found', f.amount_max, f.deadline, f.deadline_text, f.fit_score, case when f.fit_note is not null then jsonb_build_object('scanner_note', f.fit_note) else null end,
      case when f.url is not null then jsonb_build_array(jsonb_build_object('label', 'The call', 'url', f.url)) else '[]'::jsonb end,
      'scanner', 'run ' || f.run_id || ', find ' || f.id, f.summary || coalesce(E'\n\nEligibility: ' || f.eligibility, ''), em, em)
    returning id into gid;
    insert into public.fund_grant_log (grant_id, who, kind, text) values (gid, em, 'scan', 'Kept from the scanner (run ' || f.run_id || ')' || coalesce(': ' || nullif(btrim(coalesce(p_note, '')), ''), ''));
  end if;
  update public.fund_scan_finds set status = 'kept', decided_by = em, decided_at = now(), decision_note = nullif(btrim(coalesce(p_note, '')), ''), matched_funder_id = fid, matched_grant_id = gid where id = f.id;
  return gid;
end $$;
comment on function public.fund_find_decide(bigint, text, text) is 'wave193: a person''s decision on a scanner find: keep (the funder is made or matched, the grant enters the pipeline at found; returns the grant id), dismiss (the find is set aside with the reason), screen_out (dismissed, and the funder is marked not for us so the scanner stops proposing it). Staff with the Fundraising app.';
revoke all on function public.fund_find_decide(bigint, text, text) from public, anon;
grant execute on function public.fund_find_decide(bigint, text, text) to authenticated;

-- the Overview and the Donor program read the CRM's giving as totals only (the CRM tables keep their own access)
create or replace function public.fund_giving_summary()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare fy_start date; out jsonb;
begin
  if not public.wa_fund_ok() then raise exception 'The Fundraising app is not open to you.'; end if;
  fy_start := case when extract(month from current_date) >= 10 then make_date(extract(year from current_date)::int, 10, 1) else make_date(extract(year from current_date)::int - 1, 10, 1) end;
  select jsonb_build_object(
    'fy_start', fy_start,
    'fy_raised', coalesce((select sum(amount) from public.crm_donations d where d.donated_at >= fy_start and coalesce(d.kind, 'donation') = 'donation' and d.refunded_at is null), 0),
    'fy_gifts', (select count(*) from public.crm_donations d where d.donated_at >= fy_start and coalesce(d.kind, 'donation') = 'donation' and d.refunded_at is null),
    'fy_donors', (select count(distinct contact_id) from public.crm_donations d where d.donated_at >= fy_start and coalesce(d.kind, 'donation') = 'donation' and d.refunded_at is null),
    'last_fy_raised', coalesce((select sum(amount) from public.crm_donations d where d.donated_at >= fy_start - interval '1 year' and d.donated_at < fy_start and coalesce(d.kind, 'donation') = 'donation' and d.refunded_at is null), 0),
    'last_fy_donors', (select count(distinct contact_id) from public.crm_donations d where d.donated_at >= fy_start - interval '1 year' and d.donated_at < fy_start and coalesce(d.kind, 'donation') = 'donation' and d.refunded_at is null),
    'monthly_active', (select count(*) from public.crm_gift_plans p where p.status = 'active'),
    'monthly_amount', coalesce((select sum(amount) from public.crm_gift_plans p where p.status = 'active' and p.frequency = 'month'), 0),
    'lapsed', (select count(*) from (select distinct contact_id from public.crm_donations d where d.donated_at >= fy_start - interval '1 year' and d.donated_at < fy_start and coalesce(d.kind, 'donation') = 'donation' and d.refunded_at is null) x where not exists (select 1 from public.crm_donations e where e.contact_id = x.contact_id and e.donated_at >= fy_start)),
    'donors_all', (select count(distinct contact_id) from public.crm_donations d where coalesce(d.kind, 'donation') = 'donation' and d.refunded_at is null),
    'online_live', coalesce((select value from public.app_config where key = 'donate_mode') = 'live', false)
  ) into out;
  return out;
end $$;
comment on function public.fund_giving_summary() is 'wave193: the giving totals the Fundraising app shows (this fiscal year''s donations and donors, last year''s, monthly donors and their monthly total, donors who gave last year and not yet this year, whether the donation page is live): counts and sums only, no names. Staff with the Fundraising app.';
revoke all on function public.fund_giving_summary() from public, anon;
grant execute on function public.fund_giving_summary() to authenticated;

-- ---------- the model route ----------
insert into public.ai_routes (task, label, chain, jev, mode, max_tokens, notes, updated_by)
values ('grant_write', 'Grants: the writing assistant', array['anthropic/claude-sonnet-5', 'openai/gpt-5', 'anthropic/claude-sonnet-4.5'], false, 'chain', 8000, 'wave193: drafts and reviews grant answers from the fact base, the past applications and the playbook''s rules, in Welfare Avenue''s voice. Sonnet first: writing that leaves the organization.', 'wave193')
on conflict (task) do update set chain = excluded.chain, label = excluded.label, mode = excluded.mode, max_tokens = excluded.max_tokens, notes = excluded.notes, updated_by = excluded.updated_by, updated_at = now();
