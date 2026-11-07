-- Welfare Avenue Hub: wave289, 07/11/26. The email history scan (design "03 email history, interactions and insights" v2, 11.3; 5.1 to 5.6; 6).
-- The first of three waves that bring Steel's mailbox and hub@ (info@ arrives there) since April 2020 into the CRM. This wave builds only the scan
-- and its private holding area: nothing reaches the CRM. It adds: crm_import_runs.source (keela or email_history); crm_mail_scans (one row per run
-- and mailbox: phase, page token, counts, estimate, spend, cap, the step lease; admins read it); crm_email_suppressions (the table only, hashes of
-- addresses; wave292 fills and checks it); the staging tables import_stage.mail_messages, mail_people, mail_orgs (purged with the run) and
-- import_stage.mail_seen, mail_left_alone (kept: hashes and ids only); the wa289_* functions (the service role only: the mail-history edge function
-- calls them); ai_routes.provider (the no-retention provider setting llm v1.7 passes to OpenRouter) and the four mail_history_* routes carrying it;
-- the mail_ settings of 11.2; and a release line.
-- Never kept anywhere: a body, a quoted history, an attachment, a signature block, a snippet or a page's text. Every save refuses keys named body,
-- text, snippet, html, payload or raw.
-- Needs wave284 first (crm_import_runs, import_stage, wa284_contact): the file stops at the top without it. It changes no live function. Every step
-- is guarded, so the file is safe to run twice. Undo: build/data/wa289_undo.sql. No transaction control. Proved offline first: node test/w289sql.mjs
-- (PGlite). Built 07/11/26, not released. Rule for Claude sessions: never query import_stage; read wa289_status (counts only) instead.

do $wa289$
begin
  if to_regclass('public.crm_import_runs') is null or to_regnamespace('import_stage') is null or to_regprocedure('public.wa284_contact(text,text)') is null
     or to_regprocedure('public.wa284_cfg(text)') is null or to_regprocedure('public.wa_can(text)') is null then
    raise exception 'wave289 needs wave284 first (crm_import_runs, import_stage, wa284_contact and wa_can are missing)';
  end if;
end $wa289$;

-- ============================================================================================ 1. the run's source
alter table public.crm_import_runs add column if not exists source text not null default 'keela';
do $wa289$
begin
  if not exists (select 1 from pg_constraint where conname = 'crm_import_runs_source_check' and conrelid = 'public.crm_import_runs'::regclass) then
    alter table public.crm_import_runs add constraint crm_import_runs_source_check check (source in ('keela', 'email_history'));
  end if;
end $wa289$;
comment on column public.crm_import_runs.source is 'wave289: where the run''s rows come from: keela (wave284''s uploaded exports, the default) or email_history (the mail-history scan of Steel''s mailbox and hub@).';

-- ============================================================================================ 2. crm_mail_scans
create table if not exists public.crm_mail_scans (
  id bigserial primary key,
  run_id bigint not null references public.crm_import_runs(id) on delete cascade,
  mailbox text not null check (mailbox in ('steel', 'hub')),
  phase text not null default 'count' check (phase in ('count', 'headers', 'dedupe', 'bounces', 'sample', 'waiting', 'threads', 'people', 'orgs', 'done', 'summaries', 'summarised', 'failed')),
  page_token text,
  counts jsonb not null default '{}'::jsonb,
  oldest_at timestamptz,
  estimate_usd numeric(10, 4),
  spend_usd numeric(10, 4) not null default 0,
  cap_usd numeric(10, 2) not null default 0,
  paused boolean not null default false,
  started_by text,
  started_at timestamptz not null default now(),
  go_by text,
  go_at timestamptz,
  step_at timestamptz,
  finished_at timestamptz,
  last_error text,
  unique (run_id, mailbox)
);
alter table public.crm_mail_scans enable row level security;
revoke all on table public.crm_mail_scans from public, anon, authenticated;
grant select on table public.crm_mail_scans to authenticated;
grant all on table public.crm_mail_scans to service_role;
revoke all on sequence public.crm_mail_scans_id_seq from public, anon, authenticated;
drop policy if exists crm_mail_scans_admin_read on public.crm_mail_scans;
create policy crm_mail_scans_admin_read on public.crm_mail_scans for select to authenticated using (public.wa_can('import_admin'));
comment on table public.crm_mail_scans is 'wave289: one email-history scan per run and mailbox (steel, hub): its phase, page token, counts, estimate, spend and cap, and the step lease. Counts, money and times only: never an address, subject or line. Admins (wa_can import_admin) read it; only the wa289_* functions write it (the mail-history edge function).';
comment on column public.crm_mail_scans.id is 'wave289: the scan''s number.';
comment on column public.crm_mail_scans.run_id is 'wave289: the run (crm_import_runs, source email_history).';
comment on column public.crm_mail_scans.mailbox is 'wave289: steel (steel.macdonald@) or hub (hub@, where info@ arrives).';
comment on column public.crm_mail_scans.phase is 'wave289: count, headers, dedupe, bounces, sample (free phases), waiting (for go), threads, people, orgs (paid), done; summaries and summarised belong to wave292; failed stops the scan.';
comment on column public.crm_mail_scans.page_token is 'wave289: Gmail''s nextPageToken saved after each listed page, so a step resumes where the last one stopped.';
comment on column public.crm_mail_scans.counts is 'wave289: counts by state and reason, people and organisations (wa289_status refreshes it). Numbers only.';
comment on column public.crm_mail_scans.oldest_at is 'wave289: the date of the oldest email staged for the mailbox (hub@''s answers H5).';
comment on column public.crm_mail_scans.estimate_usd is 'wave289: the calibrated estimate for the paid phases, from the 50-thread sample (section 7).';
comment on column public.crm_mail_scans.spend_usd is 'wave289: what the router reported for this mailbox''s calls (_wa.cost), in US dollars.';
comment on column public.crm_mail_scans.cap_usd is 'wave289: the run''s cap (the same on every row): go sets 1.5 times the estimate, never above mail_history_cap_usd. The run pauses when its spend reaches it.';
comment on column public.crm_mail_scans.paused is 'wave289: true when paused by an admin or by the cap; continue does nothing while it is true.';
comment on column public.crm_mail_scans.started_by is 'wave289: the email of the admin who started the run.';
comment on column public.crm_mail_scans.started_at is 'wave289: when the run was started.';
comment on column public.crm_mail_scans.go_by is 'wave289: the email of the admin who said go to the paid phases.';
comment on column public.crm_mail_scans.go_at is 'wave289: when go was said; before it only the sample may spend (mail_history_sample_cap_usd).';
comment on column public.crm_mail_scans.step_at is 'wave289: the step lease: when the current step started (null when no step runs). A lease older than its length (mail_history_step_seconds) has run out, and the pump restarts it.';
comment on column public.crm_mail_scans.finished_at is 'wave289: when the scan reached done.';
comment on column public.crm_mail_scans.last_error is 'wave289: the last error, as the step''s name and an error code or HTTP status; never a value from the mail.';

-- ============================================================================================ 3. crm_email_suppressions (the table only; wave292 fills and checks it)
create table if not exists public.crm_email_suppressions (
  addr_md5 text not null check (addr_md5 ~ '^[0-9a-f]{32}$'),
  kind text not null check (kind in ('unsubscribed', 'bounced', 'asked_to_stop', 'deleted', 'undo')),
  at date,
  source text,
  created_at timestamptz not null default now(),
  primary key (addr_md5, kind)
);
alter table public.crm_email_suppressions enable row level security;
revoke all on table public.crm_email_suppressions from public, anon, authenticated;
grant select on table public.crm_email_suppressions to authenticated;
grant all on table public.crm_email_suppressions to service_role;
drop policy if exists crm_email_suppressions_admin_read on public.crm_email_suppressions;
create policy crm_email_suppressions_admin_read on public.crm_email_suppressions for select to authenticated using (public.wa_can('import_admin'));
comment on table public.crm_email_suppressions is 'wave289: one suppression list for email addresses (design 6.4), kept across runs and Purge: an md5 of the lower-cased, trimmed address, never the address. Admins read it; no write policies (written by the import functions and wave292''s triggers). wave289 creates it empty; the email-history scan never groups an address suppressed as deleted.';
comment on column public.crm_email_suppressions.addr_md5 is 'wave289: md5 of the address, lower case and trimmed (the key wa284_contact compares).';
comment on column public.crm_email_suppressions.kind is 'wave289: unsubscribed, bounced, asked_to_stop, deleted (a staff deletion: blocks the email-history import only) or undo (an import undo deletion: blocks nothing).';
comment on column public.crm_email_suppressions.at is 'wave289: the date of the request, bounce or deletion.';
comment on column public.crm_email_suppressions.source is 'wave289: where it came from (Email history, a form, the unsubscribe page, a deletion); never a value from the mail.';
comment on column public.crm_email_suppressions.created_at is 'wave289: when the row was added.';

-- ============================================================================================ 4. staging (import_stage: no grants at all)
create table if not exists import_stage.mail_messages (
  run_id bigint not null references public.crm_import_runs(id) on delete cascade,
  mailbox text not null check (mailbox in ('steel', 'hub')),
  gmail_id text not null,
  thread_id text,
  msg_md5 text,
  sent_at timestamptz,
  state text not null default 'listed' check (state in ('listed', 'kept', 'skipped', 'left_alone', 'done')),
  reason text,
  direction text check (direction in ('in', 'out')),
  box text check (box in ('steel', 'hub', 'info')),
  writer text,
  writer_name text,
  outside text[],
  recipients text[],
  subject text,
  line text,
  topic text,
  lang text,
  asks_to_stop boolean not null default false,
  sig jsonb,
  read_at timestamptz,
  read_fail int not null default 0,
  bounce_addr text,
  bounce_code text,
  bounce_read_at timestamptz,
  primary key (run_id, mailbox, gmail_id)
);
create index if not exists mail_messages_state_idx on import_stage.mail_messages (run_id, mailbox, state);
create index if not exists mail_messages_thread_idx on import_stage.mail_messages (run_id, thread_id);
create index if not exists mail_messages_writer_idx on import_stage.mail_messages (run_id, writer);
create table if not exists import_stage.mail_people (
  run_id bigint not null references public.crm_import_runs(id) on delete cascade,
  key text not null,
  writer boolean not null default false,
  addresses text[],
  name text,
  names jsonb,
  rel_type text,
  rel_conf numeric(4, 3),
  typed_at timestamptz,
  lang text,
  sig jsonb,
  domain text,
  general_inbox boolean not null default false,
  counts jsonb,
  first_at timestamptz,
  last_at timestamptz,
  mailboxes text[],
  topics text[],
  optout text check (optout in ('asked_to_stop', 'bounced')),
  optout_at date,
  not_optout boolean not null default false,
  excluded boolean not null default false,
  match_id bigint,
  match_kind text check (match_kind in ('email', 'merged', 'phone_only', 'internal', 'none')),
  primary key (run_id, key)
);
create table if not exists import_stage.mail_orgs (
  run_id bigint not null references public.crm_import_runs(id) on delete cascade,
  domain text not null,
  partner_id bigint,
  robots text check (robots in ('allowed', 'refused', 'missing')),
  fetched_at timestamptz,
  url text,
  facts jsonb,
  conf numeric(4, 3),
  outcome text check (outcome in ('found', 'none_found', 'robots', 'refused_address', 'fetch_failed', 'not_html', 'over_cap')),
  primary key (run_id, domain)
);
create table if not exists import_stage.mail_seen (
  msg_md5 text primary key,
  mailbox text not null,
  gmail_id text not null,
  run_id bigint,
  seen_at timestamptz not null default now()
);
create index if not exists mail_seen_id_idx on import_stage.mail_seen (mailbox, gmail_id);
create table if not exists import_stage.mail_left_alone (
  mailbox text not null,
  gmail_id text not null,
  why text not null,
  at timestamptz not null default now(),
  primary key (mailbox, gmail_id)
);
do $wa289$
declare t text;
begin
  foreach t in array array['mail_messages', 'mail_people', 'mail_orgs', 'mail_seen', 'mail_left_alone'] loop
    execute format('alter table import_stage.%I enable row level security', t);
    execute format('revoke all on table import_stage.%I from public, anon, authenticated, service_role', t);
  end loop;
end $wa289$;

comment on table import_stage.mail_messages is 'wave289: one email listed by the scan, per run, mailbox and Gmail id: its state and reason, and for kept mail the direction, outside addresses, cleaned subject, one validated line, topic and signature fields. No body, snippet or quoted text column: the text lives in the edge function''s memory for one call only. Purged with the run. Reached only through the wa289_* functions; never queried by Claude sessions.';
comment on column import_stage.mail_messages.run_id is 'wave289: the run.';
comment on column import_stage.mail_messages.mailbox is 'wave289: steel or hub.';
comment on column import_stage.mail_messages.gmail_id is 'wave289: Gmail''s message id in that mailbox.';
comment on column import_stage.mail_messages.thread_id is 'wave289: Gmail''s thread id.';
comment on column import_stage.mail_messages.msg_md5 is 'wave289: md5 of the Message-ID header (dedupe across mailboxes and runs, M4).';
comment on column import_stage.mail_messages.sent_at is 'wave289: the email''s date (Gmail''s internal date).';
comment on column import_stage.mail_messages.state is 'wave289: listed (headers not read yet), kept, skipped, left_alone (only the id matters) or done (already imported, left alone or seen in an earlier run).';
comment on column import_stage.mail_messages.reason is 'wave289: why it was skipped, left alone or done: personal, security, calendar, automated, list, internal, duplicate, seen, imported, draft, bounce, confidential, help_seeker, staff_hiring.';
comment on column import_stage.mail_messages.direction is 'wave289: in (from outside) or out (from the mailbox, info@, an alias or any welfareavenue.com address).';
comment on column import_stage.mail_messages.box is 'wave289: steel, hub, or info when info@ is in the addressing headers.';
comment on column import_stage.mail_messages.writer is 'wave289: the sender''s address as a key (lower case, trimmed) for incoming mail; null for outgoing mail.';
comment on column import_stage.mail_messages.writer_name is 'wave289: the sender''s display name as the From header gave it (incoming mail only).';
comment on column import_stage.mail_messages.outside is 'wave289: every address on the email that is not welfareavenue.com (rule h, internal mail, reads it).';
comment on column import_stage.mail_messages.recipients is 'wave289: for outgoing mail with at most mail_history_max_recipients visible outside addresses, those addresses as keys; empty for a larger send (a mailing adds no one, B1).';
comment on column import_stage.mail_messages.subject is 'wave289: the cleaned subject (prefixes and tags removed, addresses, phones and long numbers masked, at most 300 characters).';
comment on column import_stage.mail_messages.line is 'wave289: the validated one-line summary of what the email says or asks (at most 140 characters, no URL, address or phone). Never the email''s text.';
comment on column import_stage.mail_messages.topic is 'wave289: the thread''s topic: donation, partnership, volunteering, event, media, supplier, government, program or other.';
comment on column import_stage.mail_messages.lang is 'wave289: the writer''s language: en, fr or other.';
comment on column import_stage.mail_messages.asks_to_stop is 'wave289: the writer asks WA to stop emailing or to remove them. Kept even from a left-out thread, where it is the only thing kept (B3).';
comment on column import_stage.mail_messages.sig is 'wave289: structured fields from the writer''s own sign-off (name, title, organization, phone digits, website on their domain or linkedin.com). Never the signature block.';
comment on column import_stage.mail_messages.read_at is 'wave289: when the thread reader''s answer was staged (the threads phase only reads rows where it is empty, so a restart repeats no paid call).';
comment on column import_stage.mail_messages.read_fail is 'wave289: how many answers for this thread were rejected by validation; after two the thread is not read again.';
comment on column import_stage.mail_messages.bounce_addr is 'wave289: for a delivery report: the address that failed permanently (Final-Recipient with Action failed and Status 5.x.x, or one address with 550 or 5.1.x).';
comment on column import_stage.mail_messages.bounce_code is 'wave289: for a delivery report: the status or SMTP code (5.1.1, 550).';
comment on column import_stage.mail_messages.bounce_read_at is 'wave289: when the delivery report was parsed (with or without a result).';

comment on table import_stage.mail_people is 'wave289: one person per run and address key: the writers (at least one kept incoming email, B1) and the addresses with a staged opt-out (asked to stop, permanent bounce). Display names, dates, counts, mailboxes, topics, signature votes, the writer''s type, the match. Purged with the run. Reached only through the wa289_* functions.';
comment on column import_stage.mail_people.run_id is 'wave289: the run.';
comment on column import_stage.mail_people.key is 'wave289: the address, lower case and trimmed (no dot-folding, no merging).';
comment on column import_stage.mail_people.writer is 'wave289: true when they wrote in (a kept incoming email): only writers are created or enriched. False for an opt-out-only row.';
comment on column import_stage.mail_people.addresses is 'wave289: the addresses of this person (today the key alone).';
comment on column import_stage.mail_people.name is 'wave289: the display name seen most often.';
comment on column import_stage.mail_people.names is 'wave289: every display name with how often it was seen.';
comment on column import_stage.mail_people.rel_type is 'wave289: the writer''s type from one Jev decision: donor, partner, volunteer, supporter, vendor, media, government or other.';
comment on column import_stage.mail_people.rel_conf is 'wave289: Jev''s probability for that type (under mail_history_type_unsure the profile says Not sure).';
comment on column import_stage.mail_people.typed_at is 'wave289: when the type was staged (the people phase only types rows where it is empty).';
comment on column import_stage.mail_people.lang is 'wave289: the language of most of their threads.';
comment on column import_stage.mail_people.sig is 'wave289: the winning signature values (a value seen twice wins, latest first; a single value only when it is the only one).';
comment on column import_stage.mail_people.domain is 'wave289: the domain of the address.';
comment on column import_stage.mail_people.general_inbox is 'wave289: an organisation''s general address (info@, contact@, office@ and the like, not free mail).';
comment on column import_stage.mail_people.counts is 'wave289: {in, out, threads, by_year {year: emails}}.';
comment on column import_stage.mail_people.first_at is 'wave289: their first email in the history (in or out).';
comment on column import_stage.mail_people.last_at is 'wave289: their last email in the history (in or out).';
comment on column import_stage.mail_people.mailboxes is 'wave289: the mailboxes their emails were found in (steel, hub).';
comment on column import_stage.mail_people.topics is 'wave289: the topics of their threads.';
comment on column import_stage.mail_people.optout is 'wave289: a staged opt-out: asked_to_stop (wins) or bounced.';
comment on column import_stage.mail_people.optout_at is 'wave289: the date of the request or of the bounce.';
comment on column import_stage.mail_people.not_optout is 'wave289: an admin marked the staged opt-out as not one (Look at them).';
comment on column import_stage.mail_people.excluded is 'wave289: an admin left this person out (Look at them).';
comment on column import_stage.mail_people.match_id is 'wave289: the Hub contact wa289_match found when the people were grouped (a preview: the writers call it again at write time).';
comment on column import_stage.mail_people.match_kind is 'wave289: email, merged (followed merged_into), phone_only (listed, never merged), internal (a team member''s contact: left out) or none.';

comment on table import_stage.mail_orgs is 'wave289: one organisation domain per run: the matched Hub organisation, the robots answer, the homepage''s facts (name, kind, one sentence, printed address) and the outcome. The page''s text is never kept. Purged with the run.';
comment on column import_stage.mail_orgs.run_id is 'wave289: the run.';
comment on column import_stage.mail_orgs.domain is 'wave289: the writers'' email domain (never free mail, welfareavenue.com or a platform).';
comment on column import_stage.mail_orgs.partner_id is 'wave289: the matched Hub organisation (wa_partners), by the host of its website; null when none.';
comment on column import_stage.mail_orgs.robots is 'wave289: allowed, refused (Disallow: / for * or WelfareAvenueHub) or missing.';
comment on column import_stage.mail_orgs.fetched_at is 'wave289: when the homepage was fetched.';
comment on column import_stage.mail_orgs.url is 'wave289: the homepage address fetched (https://<domain>/ or https://www.<domain>/).';
comment on column import_stage.mail_orgs.facts is 'wave289: the validated org_facts answer: name, kind, description, street, city, province, postal_code, country. Nothing about people.';
comment on column import_stage.mail_orgs.conf is 'wave289: the model''s confidence in those facts.';
comment on column import_stage.mail_orgs.outcome is 'wave289: found, none_found, robots, refused_address (a private or odd address, or a port other than 443), fetch_failed, not_html or over_cap.';

comment on table import_stage.mail_seen is 'wave289: the Message-ID hashes of every kept email, kept across runs and never emptied by Purge, so a later run skips them (M4). Hashes and Gmail ids only.';
comment on column import_stage.mail_seen.msg_md5 is 'wave289: md5 of the Message-ID header.';
comment on column import_stage.mail_seen.mailbox is 'wave289: the mailbox of the copy that was kept (steel first).';
comment on column import_stage.mail_seen.gmail_id is 'wave289: that copy''s Gmail id.';
comment on column import_stage.mail_seen.run_id is 'wave289: the run that first kept it.';
comment on column import_stage.mail_seen.seen_at is 'wave289: when it was recorded.';

comment on table import_stage.mail_left_alone is 'wave289: the Gmail ids of mail left alone (personal, security, a left-out thread), kept across runs so a later run never reads them. The id and the category only.';
comment on column import_stage.mail_left_alone.mailbox is 'wave289: steel or hub.';
comment on column import_stage.mail_left_alone.gmail_id is 'wave289: Gmail''s message id.';
comment on column import_stage.mail_left_alone.why is 'wave289: personal, security, confidential, help_seeker or staff_hiring.';
comment on column import_stage.mail_left_alone.at is 'wave289: when it was left alone.';

-- ============================================================================================ 5. the llm provider setting and the four routes
alter table public.ai_routes add column if not exists provider jsonb;
comment on column public.ai_routes.provider is 'wave289: OpenRouter provider preferences llm v1.7 sends with every call on this route (for example {"data_collection": "deny", "zdr": true}: only providers that neither keep nor train on the data). Null sends none. The mail_history_* routes must carry it (design M2, a blocking release check).';
insert into public.ai_routes (task, label, chain, jev, mode, max_tokens, notes, provider)
select x.task, x.label, x.chain, x.jev, 'chain', x.max_tokens, x.notes, '{"data_collection": "deny", "zdr": true}'::jsonb
  from (values
    ('mail_history_thread', 'Email history: thread reader', array['openai/gpt-5-mini', 'anthropic/claude-haiku-4.5'], false, 1400,
     'wave289: one line per email, topic, language, the left-out call, asks-to-stop and signature fields (tool read_thread). No-retention providers only.'),
    ('mail_history_type', 'Email history: writer type (Jev)', array['~typesafe/jev-latest'], true, null,
     'wave289: one Jev decision per writer (choice). No-retention providers only.'),
    ('mail_history_org', 'Email history: organisation facts', array['openai/gpt-5-mini', 'anthropic/claude-haiku-4.5'], false, 800,
     'wave289: an organisation''s public facts from its homepage (tool org_facts). No-retention providers only.'),
    ('mail_history_insight', 'Email history: relationship summary', array['anthropic/claude-haiku-4.5', 'openai/gpt-5-mini'], false, 900,
     'wave289 (used by wave292): the relationship summary (tool relationship). No-retention providers only.')
  ) as x(task, label, chain, jev, max_tokens, notes)
 where not exists (select 1 from public.ai_routes r where r.task = x.task);
update public.ai_routes set provider = '{"data_collection": "deny", "zdr": true}'::jsonb where task like 'mail\_history\_%' and provider is null;
-- the two wording routes take wave226's confidentiality rule from reel when reel has one. Live (read 07/11/26) has no system_add on any route,
-- so this copies nothing there; wa289_ready reports it and mail-history refuses to start until both wording routes carry the rule.
update public.ai_routes r set system_add = s.system_add
  from (select system_add from public.ai_routes where task = 'reel' and nullif(btrim(coalesce(system_add, '')), '') is not null) s
 where r.task in ('mail_history_thread', 'mail_history_insight') and nullif(btrim(coalesce(r.system_add, '')), '') is null;

-- ============================================================================================ 6. the settings (11.2; mail_: admins only)
insert into public.app_config (key, value)
select x.k, x.v
  from (values
    ('mail_history_mailboxes', '["steel.macdonald@welfareavenue.com", "hub@welfareavenue.com"]'),
    ('mail_history_since', '2020-04-01'),
    ('mail_history_cap_usd', '60'),
    ('mail_history_sample_cap_usd', '0.25'),
    ('mail_history_read_rate', '{"per_second": 10, "parallel": 5, "backoff_ms": 2000}'),
    ('mail_history_step_seconds', '{"step": 100, "lease": 180}'),
    ('mail_history_max_recipients', '5'),
    ('mail_history_personal_words', '["birthday", "condolence", "condolences", "funeral", "wedding", "mom", "dad", "maman", "papa", "family dinner", "vacation photos", "anniversaire", "funérailles", "mariage", "souper de famille"]'),
    ('mail_history_platforms', '["stripe", "paypal", "zeffy", "canadahelps", "eventbrite", "square", "squareup", "interac", "shopify", "amazon", "zoom", "calendly", "wix", "squarespace", "canva", "mailchimp", "google", "facebookmail", "linkedin", "slack", "notion", "dropbox", "docusign", "quickbooks", "intuit", "gofundme", "benevity", "givebutter", "donorbox"]'),
    ('mail_history_freemail', '["gmail.com", "googlemail.com", "outlook", "hotmail", "live", "msn.com", "yahoo", "ymail.com", "icloud.com", "me.com", "mac.com", "aol", "proton.me", "protonmail.com", "gmx", "mail.com", "zoho.com", "videotron.ca", "bell.net", "sympatico.ca", "rogers.com", "shaw.ca", "telus.net", "cogeco.ca", "sfr.fr", "orange.fr", "free.fr", "laposte.net"]'),
    ('mail_history_type_unsure', '0.5'),
    ('mail_history_kind_min', '0.8'),
    ('mail_history_org_type_min', '0.6'),
    ('mail_history_org_cap', '{"domains": 600, "seconds": 8, "bytes": 1048576, "pause_ms": 1000}'),
    ('mail_history_org_map', '{"partner": {"relationship": "partner", "category": "partner"}, "donor": {"relationship": "donor organisation", "category": "sponsor"}, "government": {"relationship": "partner", "category": "partner"}, "vendor": {"relationship": "supplier", "category": "collaborator"}, "media": {"relationship": "collaborator", "category": "collaborator"}, "volunteer": {"relationship": "collaborator", "category": "collaborator"}, "supporter": {"relationship": "collaborator", "category": "collaborator"}, "other": null}'),
    ('mail_history_steel_open', 'false'),
    ('mail_insights_quiet_months', '12'),
    ('mail_history_clips', '{"subject": 300, "line": 140, "summary": 600, "fresh": 1200, "emails_per_call": 8, "rows_per_summary": 60}')
  ) as x(k, v)
 where not exists (select 1 from public.app_config c where c.key = x.k);

-- ============================================================================================ 7. helpers (the service role only)
create or replace function public.wa289_addr(p_mailbox text)
returns text language sql immutable set search_path to '' as $function$
  select case p_mailbox when 'steel' then 'steel.macdonald@welfareavenue.com' when 'hub' then 'hub@welfareavenue.com' end
$function$;
comment on function public.wa289_addr(text) is 'wave289: the address of an allow-listed mailbox (steel, hub); null for anything else. The allow-list is hard-coded here and in mail-history. The service role only.';

create or replace function public.wa289_num(p_key text, p_default numeric)
returns numeric language sql stable security definer set search_path to '' as $function$
  select coalesce((select case when btrim(c.value) ~ '^[0-9]+(\.[0-9]+)?$' then btrim(c.value)::numeric end from public.app_config c where c.key = p_key), p_default)
$function$;
comment on function public.wa289_num(text, numeric) is 'wave289: a numeric mail_ setting, or the default when it is missing or not a number. The service role only.';

create or replace function public.wa289_in_list(p_domain text, p_list jsonb)
returns boolean language sql immutable set search_path to '' as $function$
  select coalesce((select bool_or(case when position('.' in lower(btrim(x))) > 0 then lower(p_domain) = lower(btrim(x)) or lower(p_domain) like '%.' || lower(btrim(x))
                                       else split_part(lower(p_domain), '.', 1) = lower(btrim(x)) or lower(p_domain) like '%.' || lower(btrim(x)) || '.%' end)
                     from jsonb_array_elements_text(coalesce(p_list, '[]'::jsonb)) x where btrim(x) <> ''), false)
$function$;
comment on function public.wa289_in_list(text, jsonb) is 'wave289: true when a domain is in a list of domains (hotmail.com: that domain or a subdomain) or names (hotmail: any of its top-level domains or as a label). Used for mail_history_freemail and mail_history_platforms, as isFreemail does in fn/_shared/mail_rules.ts. The service role only.';

create or replace function public.wa289_internal(p_addr text)
returns boolean language sql stable security definer set search_path to '' as $function$
  select lower(btrim(coalesce(p_addr, ''))) like '%@welfareavenue.com'
      or exists (select 1 from public.team_members t where t.active and lower(btrim(t.email)) = lower(btrim(p_addr)))
      or exists (select 1 from public.wa_email_aliases a where lower(btrim(a.email)) = lower(btrim(p_addr))
                    or exists (select 1 from unnest(coalesce(a.aliases, '{}'::text[])) x where lower(btrim(x)) = lower(btrim(p_addr))))
$function$;
comment on function public.wa289_internal(text) is 'wave289: true for a welfareavenue.com address, an active team member''s address, or a staff alias (wa_email_aliases). Rule h and the match''s internal check use it. The service role only.';

create or replace function public.wa289_body_keys(j jsonb)
returns boolean language plpgsql immutable set search_path to '' as $function$
declare k text; v jsonb;
begin
  if j is null then return false; end if;
  if jsonb_typeof(j) = 'object' then
    for k, v in select * from jsonb_each(j) loop
      if lower(k) in ('body', 'text', 'snippet', 'html', 'payload', 'raw', 'body_text', 'page_text') then return true; end if;
      if public.wa289_body_keys(v) then return true; end if;
    end loop;
  elsif jsonb_typeof(j) = 'array' then
    for v in select * from jsonb_array_elements(j) loop
      if public.wa289_body_keys(v) then return true; end if;
    end loop;
  end if;
  return false;
end $function$;
comment on function public.wa289_body_keys(jsonb) is 'wave289: true when a JSON value holds, at any depth, a key named body, text, snippet, html, payload, raw, body_text or page_text. Every wa289 save refuses such input. The service role only.';

create or replace function public.wa289_vote(p_vals text[])
returns text language sql immutable set search_path to '' as $function$
  select coalesce(
    (select v from unnest(p_vals) with ordinality u(v, i) where v is not null and btrim(v) <> ''
       and (select count(*) from unnest(p_vals) w where w = u.v) >= 2 order by i limit 1),
    (select min(v) from unnest(p_vals) v where v is not null and btrim(v) <> '' having count(distinct v) = 1))
$function$;
comment on function public.wa289_vote(text[]) is 'wave289: the signature vote (5.4) over values listed latest first: the latest value seen at least twice wins; otherwise a value wins only when it is the only one. The service role only.';

create or replace function public.wa289_scan_of(p_run bigint, p_mailbox text)
returns public.crm_mail_scans language plpgsql stable security definer set search_path to '' as $function$
declare s public.crm_mail_scans;
begin
  select * into s from public.crm_mail_scans m where m.run_id = p_run and (p_mailbox is null or m.mailbox = p_mailbox) order by m.mailbox = 'hub', m.id limit 1;
  if not found then raise exception 'wa284: email history: there is no scan for run % mailbox %', p_run, coalesce(p_mailbox, 'any'); end if;
  return s;
end $function$;
comment on function public.wa289_scan_of(bigint, text) is 'wave289: the scan row of a run and mailbox (null: the first, steel before hub); raises when there is none. The service role only.';

-- ============================================================================================ 8. runs, leases, phases, spend
create or replace function public.wa289_ready()
returns jsonb language sql stable security definer set search_path to '' as $function$
  select coalesce(jsonb_agg(p order by p), '[]'::jsonb) from (
    select 'route ' || t || ' is missing' as p from unnest(array['mail_history_thread', 'mail_history_type', 'mail_history_org', 'mail_history_insight']) t
     where not exists (select 1 from public.ai_routes r where r.task = t)
    union all
    select 'route ' || r.task || ' has no no-retention provider setting' from public.ai_routes r
     where r.task like 'mail\_history\_%' and not (coalesce(r.provider ->> 'data_collection', '') = 'deny' or coalesce(r.provider ->> 'zdr', '') = 'true')
    union all
    select 'route ' || r.task || ' has no confidentiality rule (system_add)' from public.ai_routes r
     where r.task in ('mail_history_thread', 'mail_history_insight') and nullif(btrim(coalesce(r.system_add, '')), '') is null
  ) q
$function$;
comment on function public.wa289_ready() is 'wave289: what stops a scan from starting, as plain sentences (an empty list means ready): a mail_history_* route missing, without the no-retention provider setting (M2), or a wording route without wave226''s confidentiality rule. mail-history''s start refuses while the list is not empty. The service role only.';

create or replace function public.wa289_new_run(p_label text, p_by text, p_mailboxes text[] default array['steel', 'hub'])
returns bigint language plpgsql security definer set search_path to '' as $function$
declare v bigint; m text; v_boxes text[] := coalesce(p_mailboxes, array['steel', 'hub']);
begin
  if cardinality(v_boxes) = 0 or exists (select 1 from unnest(v_boxes) b where b not in ('steel', 'hub')) then
    raise exception 'wa284: email history: mailboxes must be steel, hub or both';
  end if;
  if exists (select 1 from public.crm_mail_scans s join public.crm_import_runs r on r.id = s.run_id
              where r.purged_at is null and s.phase not in ('done', 'failed', 'summarised')) then
    raise exception 'wa284: email history: another scan is still running; finish, fail or purge it first';
  end if;
  insert into public.crm_import_runs (label, created_by, source) values (left(nullif(btrim(coalesce(p_label, '')), ''), 120), nullif(p_by, ''), 'email_history') returning id into v;
  foreach m in array (select array_agg(distinct x) from unnest(v_boxes) x) loop
    insert into public.crm_mail_scans (run_id, mailbox, cap_usd, started_by) values (v, m, public.wa289_num('mail_history_sample_cap_usd', 0.25), nullif(p_by, ''));
  end loop;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('crm_mail_scans', v::text, 'start', null, 'Email history scan started for ' || array_to_string(v_boxes, ' and '), coalesce(nullif(p_by, ''), 'mail-history'));
  return v;
end $function$;
comment on function public.wa289_new_run(text, text, text[]) is 'wave289: starts an email-history run (crm_import_runs source email_history) with a scan per mailbox (steel, hub or both) at phase count; the cap starts at the sample cap until go. Refuses while another scan is unfinished. Logged in change_log. The service role only.';

create or replace function public.wa289_lease(p_run bigint)
returns boolean language plpgsql security definer set search_path to '' as $function$
declare v_lease int := coalesce((public.wa284_cfg('mail_history_step_seconds') ->> 'lease')::int, 180); n int;
begin
  -- eh-289 I3: one taker at a time. The advisory lock (held to the end of this short transaction) makes a second caller give up at once, and the
  -- single update takes the lease only when no row holds a young one, so two steps never run together
  if not pg_try_advisory_xact_lock(hashtext('wa289_lease'), p_run::int) then return false; end if;
  update public.crm_mail_scans s set step_at = now()
   where s.run_id = p_run
     and not exists (select 1 from public.crm_mail_scans x where x.run_id = p_run and x.step_at is not null and x.step_at > now() - make_interval(secs => v_lease));
  get diagnostics n = row_count;
  return n > 0;
end $function$;
comment on function public.wa289_lease(bigint) is 'wave289: takes the run''s step lease (every scan row''s step_at) unless a step holds one younger than mail_history_step_seconds.lease (180 s), atomically (a transaction advisory lock on the run, then one update; eh-289 I3). Returns true when taken. The service role only.';

create or replace function public.wa289_scan_set(p_run bigint, p_mailbox text, p_patch jsonb)
returns void language plpgsql security definer set search_path to '' as $function$
declare k text;
begin
  for k in select jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)) loop
    if k not in ('phase', 'page_token', 'estimate_usd', 'last_error', 'release', 'finished') then raise exception 'wa284: email history: scan_set does not take %', k; end if;
  end loop;
  update public.crm_mail_scans s set
    phase = coalesce(p_patch ->> 'phase', s.phase),
    page_token = case when p_patch ? 'page_token' then p_patch ->> 'page_token' else s.page_token end,
    estimate_usd = case when p_patch ? 'estimate_usd' then (p_patch ->> 'estimate_usd')::numeric else s.estimate_usd end,
    last_error = case when p_patch ? 'last_error' then left(p_patch ->> 'last_error', 300) else s.last_error end,
    step_at = case when coalesce((p_patch ->> 'release')::boolean, false) then null else s.step_at end,
    finished_at = case when coalesce((p_patch ->> 'finished')::boolean, false) then now() else s.finished_at end
   where s.run_id = p_run and (p_mailbox is null or s.mailbox = p_mailbox);
end $function$;
comment on function public.wa289_scan_set(bigint, text, jsonb) is 'wave289: updates a scan (a mailbox, or every mailbox of the run when null): phase, page_token, estimate_usd, last_error (at most 300 characters; mail-history writes step names and codes only), release (frees the lease) and finished. Any other key raises. The service role only.';

create or replace function public.wa289_spend(p_run bigint, p_mailbox text, p_usd numeric)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare s public.crm_mail_scans := public.wa289_scan_of(p_run, p_mailbox); v_total numeric; v_go boolean; v_cap numeric; v_paused boolean;
begin
  update public.crm_mail_scans m set spend_usd = m.spend_usd + greatest(coalesce(p_usd, 0), 0) where m.id = s.id;
  select sum(m.spend_usd), bool_or(m.go_at is not null), max(m.cap_usd) into v_total, v_go, v_cap from public.crm_mail_scans m where m.run_id = p_run;
  if v_go and v_total >= v_cap then update public.crm_mail_scans m set paused = true where m.run_id = p_run; end if;
  select bool_or(m.paused) into v_paused from public.crm_mail_scans m where m.run_id = p_run;
  return jsonb_build_object('spend', v_total, 'cap', v_cap, 'paused', coalesce(v_paused, false),
                            'sample_over', not coalesce(v_go, false) and v_total >= public.wa289_num('mail_history_sample_cap_usd', 0.25));
end $function$;
comment on function public.wa289_spend(bigint, text, numeric) is 'wave289: adds a router call''s cost to a mailbox''s spend (null: the run''s first scan) and returns the run''s spend and cap; after go the run pauses when its spend reaches the cap; before go sample_over says the sample cap is reached. The service role only.';

create or replace function public.wa289_go(p_run bigint, p_by text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_est numeric; v_cap numeric;
begin
  if exists (select 1 from public.crm_mail_scans s where s.run_id = p_run and s.phase <> 'waiting') or not exists (select 1 from public.crm_mail_scans s where s.run_id = p_run) then
    raise exception 'wa284: email history: go needs every scan of run % waiting after its sample', p_run;
  end if;
  if jsonb_array_length(public.wa289_ready()) > 0 then
    raise exception 'wa284: email history: not ready (%)', (select string_agg(x, '; ') from jsonb_array_elements_text(public.wa289_ready()) x);
  end if;
  select sum(s.estimate_usd) into v_est from public.crm_mail_scans s where s.run_id = p_run;
  if v_est is null then raise exception 'wa284: email history: run % has no estimate yet', p_run; end if;
  v_cap := least(round(v_est * 1.5, 2), public.wa289_num('mail_history_cap_usd', 60));
  update public.crm_mail_scans s set go_by = nullif(p_by, ''), go_at = now(), cap_usd = v_cap, paused = false, phase = 'threads' where s.run_id = p_run;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('crm_mail_scans', p_run::text, 'go', null, 'Email history paid phases started: estimate $' || round(v_est, 2) || ', cap $' || v_cap, coalesce(nullif(p_by, ''), 'mail-history'));
  return jsonb_build_object('estimate', round(v_est, 2), 'cap', v_cap);
end $function$;
comment on function public.wa289_go(bigint, text) is 'wave289: Steel''s yes to the paid phases: wa289_ready must list nothing (eh-289 I5), every scan of the run must be waiting with an estimate; sets the cap to 1.5 times the estimate, never above mail_history_cap_usd (H2), and moves the scans to threads. Logged. The service role only.';

create or replace function public.wa289_set_cap(p_run bigint, p_usd numeric, p_by text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_cap numeric := least(greatest(coalesce(p_usd, 0), 0), public.wa289_num('mail_history_cap_usd', 60)); v_spend numeric;
begin
  if not exists (select 1 from public.crm_mail_scans s where s.run_id = p_run and s.go_at is not null) then raise exception 'wa284: email history: the cap is set by go first'; end if;
  select sum(s.spend_usd) into v_spend from public.crm_mail_scans s where s.run_id = p_run;
  update public.crm_mail_scans s set cap_usd = v_cap, paused = case when v_spend >= v_cap then true else s.paused end where s.run_id = p_run;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('crm_mail_scans', p_run::text, 'cap', null, 'Email history cap set to $' || v_cap, coalesce(nullif(p_by, ''), 'mail-history'));
  return jsonb_build_object('cap', v_cap, 'spend', v_spend);
end $function$;
comment on function public.wa289_set_cap(bigint, numeric, text) is 'wave289: changes the run''s cap after go, never above mail_history_cap_usd; pauses the run when the spend already reaches it. Logged. The service role only.';

create or replace function public.wa289_pause(p_run bigint, p_on boolean, p_by text)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  if p_on is false and exists (select 1 from public.crm_mail_scans s where s.run_id = p_run and s.go_at is not null
                                  and (select sum(x.spend_usd) from public.crm_mail_scans x where x.run_id = p_run) >= s.cap_usd) then
    raise exception 'wa284: email history: the spend has reached the cap; raise the cap first';
  end if;
  update public.crm_mail_scans s set paused = p_on, step_at = case when p_on then s.step_at else null end where s.run_id = p_run;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('crm_mail_scans', p_run::text, case when p_on then 'pause' else 'resume' end, null, case when p_on then 'Email history scan paused' else 'Email history scan resumed' end, coalesce(nullif(p_by, ''), 'mail-history'));
end $function$;
comment on function public.wa289_pause(bigint, boolean, text) is 'wave289: pauses or resumes a run (resume is refused while the spend has reached the cap). Logged. The service role only.';

create or replace function public.wa289_active()
returns jsonb language sql stable security definer set search_path to '' as $function$
  select coalesce(jsonb_agg(distinct s.run_id), '[]'::jsonb) from public.crm_mail_scans s join public.crm_import_runs r on r.id = s.run_id
   where r.purged_at is null and not s.paused and s.phase in ('count', 'headers', 'dedupe', 'bounces', 'sample', 'threads', 'people', 'orgs')
     and (s.step_at is null or s.step_at < now() - make_interval(secs => coalesce((public.wa284_cfg('mail_history_step_seconds') ->> 'lease')::int, 180)))
$function$;
comment on function public.wa289_active() is 'wave289: the runs the pump should continue: a scan in a working phase, not paused, whose lease is free or has run out. The service role only.';

create or replace function public.wa289_pump(p_on boolean)
returns text language plpgsql security definer set search_path to '' as $function$
begin
  if p_on then
    if not exists (select 1 from cron.job where jobname = 'wa-mail-history-pump') then
      perform cron.schedule('wa-mail-history-pump', '* * * * *', $c$select public.call_edge('mail-history', '{"action": "pump"}'::jsonb)$c$);
    end if;
    return 'on';
  end if;
  if exists (select 1 from cron.job where jobname = 'wa-mail-history-pump') then perform cron.unschedule('wa-mail-history-pump'); end if;
  return 'off';
end $function$;
comment on function public.wa289_pump(boolean) is 'wave289: puts the cron job wa-mail-history-pump (every minute: call_edge mail-history pump) on or off. It exists only while a run is active: mail-history turns it on at start and resume and off when no run is left working. The service role only.';

-- ============================================================================================ 9. the free phases
create or replace function public.wa289_context(p_run bigint)
returns jsonb language sql stable security definer set search_path to '' as $function$
  select jsonb_build_object(
    'owner', (select jsonb_build_object('skip_senders', to_jsonb(coalesce(o.skip_senders, '{}'::text[])), 'skip_words', to_jsonb(coalesce(o.skip_words, '{}'::text[])),
                                        'family', nullif(lower(regexp_replace(btrim(coalesce(o.name, '')), '^.*\s', '')), ''))
                from public.mybox_owners o where o.email = 'steel.macdonald@welfareavenue.com'),
    'aliases', (select coalesce(jsonb_agg(distinct lower(btrim(x))), '[]'::jsonb) from public.wa_email_aliases a,
                       lateral unnest(array[a.email] || coalesce(a.aliases, '{}'::text[])) x where nullif(btrim(x), '') is not null),
    'own', jsonb_build_object(
       'steel', (select coalesce(jsonb_agg(distinct lower(btrim(x))), '[]'::jsonb) from public.wa_email_aliases a, lateral unnest(coalesce(a.aliases, '{}'::text[])) x
                  where lower(btrim(a.email)) = 'steel.macdonald@welfareavenue.com' and nullif(btrim(x), '') is not null),
       'hub', (select coalesce(jsonb_agg(distinct lower(btrim(x))), '[]'::jsonb) from public.wa_email_aliases a, lateral unnest(coalesce(a.aliases, '{}'::text[])) x
                  where lower(btrim(a.email)) = 'hub@welfareavenue.com' and nullif(btrim(x), '') is not null)),
    'since', coalesce((select value from public.app_config where key = 'mail_history_since'), '2020-04-01'),
    'personal_words', coalesce(public.wa284_cfg('mail_history_personal_words'), '[]'::jsonb),
    'platforms', coalesce(public.wa284_cfg('mail_history_platforms'), '[]'::jsonb),
    'freemail', coalesce(public.wa284_cfg('mail_history_freemail'), '[]'::jsonb),
    'max_recipients', public.wa289_num('mail_history_max_recipients', 5),
    'read_rate', coalesce(public.wa284_cfg('mail_history_read_rate'), '{}'::jsonb),
    'step', coalesce(public.wa284_cfg('mail_history_step_seconds'), '{}'::jsonb),
    'org_cap', coalesce(public.wa284_cfg('mail_history_org_cap'), '{}'::jsonb),
    'clips', coalesce(public.wa284_cfg('mail_history_clips'), '{}'::jsonb),
    'type_unsure', public.wa289_num('mail_history_type_unsure', 0.5),
    'run', p_run)
$function$;
comment on function public.wa289_context(bigint) is 'wave289: what mail-history needs to apply the rules: Steel''s mybox senders, words and family name (rules a and b), every staff alias (direction) and each mailbox''s own aliases (B2), and the mail_ settings. Goes to the edge function only, never to a page or a Claude session. The service role only.';

create or replace function public.wa289_stage_ids(p_run bigint, p_mailbox text, p_ids jsonb, p_token text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_added int; v_done int;
begin
  perform public.wa289_scan_of(p_run, p_mailbox);
  if jsonb_typeof(coalesce(p_ids, '[]'::jsonb)) <> 'array' then raise exception 'wa284: email history: ids must be a list'; end if;
  insert into import_stage.mail_messages (run_id, mailbox, gmail_id, thread_id)
  select p_run, p_mailbox, x ->> 'id', x ->> 'thread' from jsonb_array_elements(coalesce(p_ids, '[]'::jsonb)) x
   where coalesce(x ->> 'id', '') ~ '^[A-Za-z0-9_-]{6,64}$'
  on conflict do nothing;
  get diagnostics v_added = row_count;
  update import_stage.mail_messages m set state = 'done',
         reason = case when exists (select 1 from import_stage.mail_left_alone l where l.mailbox = m.mailbox and l.gmail_id = m.gmail_id) then 'left_alone'
                       when exists (select 1 from import_stage.mail_seen s where s.mailbox = m.mailbox and s.gmail_id = m.gmail_id) then 'seen' else 'imported' end
   where m.run_id = p_run and m.mailbox = p_mailbox and m.state = 'listed'
     and (exists (select 1 from import_stage.mail_left_alone l where l.mailbox = m.mailbox and l.gmail_id = m.gmail_id)
          or exists (select 1 from import_stage.mail_seen s where s.mailbox = m.mailbox and s.gmail_id = m.gmail_id)
          or exists (select 1 from public.crm_interactions i where i.source = 'gmail' and i.source_ref like m.mailbox || ':' || m.gmail_id || ':%'));
  get diagnostics v_done = row_count;
  update public.crm_mail_scans s set page_token = p_token where s.run_id = p_run and s.mailbox = p_mailbox;
  return jsonb_build_object('added', v_added, 'done', v_done);
end $function$;
comment on function public.wa289_stage_ids(bigint, text, jsonb, text) is 'wave289: the count phase: stages a page of Gmail ids ([{id, thread}]; ids are idempotent, so a restarted listing doubles nothing), marks done at once the ids already imported (crm_interactions source gmail), left alone or seen in an earlier run, and saves the next page token. The service role only.';

create or replace function public.wa289_newest(p_run bigint, p_mailbox text)
returns timestamptz language sql stable security definer set search_path to '' as $function$
  select max(m.sent_at) from import_stage.mail_messages m where m.run_id = p_run and m.mailbox = p_mailbox
$function$;
comment on function public.wa289_newest(bigint, text) is 'wave289: the newest date staged for a mailbox: when Gmail refuses a saved page token, listing restarts one day before it. The service role only.';

create or replace function public.wa289_todo(p_run bigint, p_mailbox text, p_phase text, p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_lim int := least(greatest(coalesce(p_limit, 100), 1), 500);
begin
  if p_phase = 'headers' then
    return (select coalesce(jsonb_agg(m.gmail_id order by m.gmail_id), '[]'::jsonb) from (select gmail_id from import_stage.mail_messages
             where run_id = p_run and mailbox = p_mailbox and state = 'listed' order by gmail_id limit v_lim) m);
  elsif p_phase = 'bounces' then
    return (select coalesce(jsonb_agg(m.gmail_id order by m.gmail_id), '[]'::jsonb) from (select gmail_id from import_stage.mail_messages
             where run_id = p_run and mailbox = p_mailbox and reason = 'bounce' and bounce_read_at is null order by gmail_id limit v_lim) m);
  elsif p_phase in ('threads', 'sample') then
    return (select coalesce(jsonb_agg(t.thread_id order by t.o), '[]'::jsonb) from (
             select m.thread_id, case when p_phase = 'sample' then md5(m.thread_id || p_run::text) else min(m.gmail_id) end as o from import_stage.mail_messages m
              where m.run_id = p_run and m.mailbox = p_mailbox and m.state = 'kept' and m.read_at is null and m.read_fail < 2 and m.thread_id is not null
              group by m.thread_id order by 2 limit v_lim) t);
  elsif p_phase = 'people' then
    return (select coalesce(jsonb_agg(jsonb_build_object('key', p.key, 'name', p.name, 'domain', p.domain, 'sig', p.sig, 'counts', p.counts,
              'first_at', p.first_at, 'last_at', p.last_at, 'topics', to_jsonb(p.topics),
              'recent', (select coalesce(jsonb_agg(jsonb_build_object('subject', r.subject, 'line', r.line) order by r.sent_at desc), '[]'::jsonb)
                           from (select subject, line, sent_at from import_stage.mail_messages m where m.run_id = p_run and m.state = 'kept'
                                    and (m.writer = p.key or p.key = any(coalesce(m.recipients, '{}'::text[]))) order by m.sent_at desc limit 5) r)) order by p.key), '[]'::jsonb)
              from (select * from import_stage.mail_people where run_id = p_run and writer and not excluded and typed_at is null
                       and coalesce(match_kind, 'none') <> 'internal' order by key limit v_lim) p);
  end if;
  raise exception 'wa284: email history: unknown phase %', p_phase;
end $function$;
comment on function public.wa289_todo(bigint, text, text, int) is 'wave289: the next work of a phase, at most 500: headers (listed ids), bounces (unread delivery reports), threads or sample (threads with a kept, unread email; the sample in a fixed random order), people (untyped writers with what the type may see: name, domain, signature, counts, dates, topics, the last five cleaned subjects and lines; never a body). Goes to the edge function only. The service role only.';

create or replace function public.wa289_thread_rows(p_run bigint, p_mailbox text, p_thread text)
returns jsonb language sql stable security definer set search_path to '' as $function$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.gmail_id, 'direction', m.direction, 'writer', m.writer) order by m.sent_at, m.gmail_id), '[]'::jsonb)
    from import_stage.mail_messages m where m.run_id = p_run and m.mailbox = p_mailbox and m.thread_id = p_thread and m.state = 'kept' and m.read_at is null
$function$;
comment on function public.wa289_thread_rows(bigint, text, text) is 'wave289: the kept, unread emails of a thread (id, direction, writer): only these are sent to the thread reader. The service role only.';

create or replace function public.wa289_save_headers(p_run bigint, p_mailbox text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare r jsonb; n int := 0; k int; v_state text; v_reason text; v_owner text := public.wa289_addr(p_mailbox); v_clip int := coalesce((public.wa284_cfg('mail_history_clips') ->> 'subject')::int, 300);
begin
  perform public.wa289_scan_of(p_run, p_mailbox);
  if public.wa289_body_keys(p_rows) then raise exception 'wa284: email history: a save may not carry body, text, snippet or html'; end if;
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_state := r ->> 'state'; v_reason := nullif(r ->> 'reason', '');
    if v_state not in ('kept', 'skipped', 'left_alone') then raise exception 'wa284: email history: unknown state %', v_state; end if;
    -- rule a, also on the database side: a mybox_mail row with skipped true for Steel's mailbox is left alone, whatever the function decided
    if p_mailbox = 'steel' and exists (select 1 from public.mybox_mail b where b.owner = v_owner and b.gmail_id = r ->> 'id' and b.skipped) then
      v_state := 'left_alone'; v_reason := 'personal';
    end if;
    if v_state = 'left_alone' then
      update import_stage.mail_messages m set state = 'left_alone', reason = coalesce(v_reason, 'personal'), msg_md5 = null, direction = null, box = null, writer = null, writer_name = null,
             outside = null, recipients = null, subject = null, sent_at = nullif(r ->> 'sent_at', '')::timestamptz
       where m.run_id = p_run and m.mailbox = p_mailbox and m.gmail_id = r ->> 'id' and m.state = 'listed';
      get diagnostics k = row_count;
      if k > 0 then insert into import_stage.mail_left_alone (mailbox, gmail_id, why) values (p_mailbox, r ->> 'id', coalesce(v_reason, 'personal')) on conflict do nothing; end if;
    else
      update import_stage.mail_messages m set state = v_state, reason = case when v_state = 'kept' then null else v_reason end,
             thread_id = coalesce(nullif(r ->> 'thread', ''), m.thread_id),
             msg_md5 = case when nullif(btrim(r ->> 'message_id'), '') is not null then md5(lower(btrim(r ->> 'message_id')))
                            when coalesce(r ->> 'msg_md5', '') ~ '^[0-9a-f]{32}$' then r ->> 'msg_md5' end,
             sent_at = nullif(r ->> 'sent_at', '')::timestamptz,
             direction = case when v_state = 'kept' then r ->> 'direction' end,
             box = case when v_state = 'kept' then r ->> 'box' end,
             writer = case when v_state = 'kept' and r ->> 'direction' = 'in' then nullif(lower(btrim(r ->> 'writer')), '') end,
             writer_name = case when v_state = 'kept' and r ->> 'direction' = 'in' then left(nullif(btrim(r ->> 'writer_name'), ''), 120) end,
             outside = case when v_state = 'kept' then (select array_agg(distinct lower(btrim(x))) from jsonb_array_elements_text(coalesce(r -> 'outside', '[]'::jsonb)) x where x like '%@%') end,
             recipients = case when v_state = 'kept' and r ->> 'direction' = 'out' then (select array_agg(distinct lower(btrim(x))) from jsonb_array_elements_text(coalesce(r -> 'recipients', '[]'::jsonb)) x where x like '%@%') end,
             subject = case when v_state = 'kept' then left(r ->> 'subject', v_clip) end
       where m.run_id = p_run and m.mailbox = p_mailbox and m.gmail_id = r ->> 'id' and m.state = 'listed';
      get diagnostics k = row_count;
    end if;
    n := n + k;
  end loop;
  update public.crm_mail_scans s set oldest_at = (select min(m.sent_at) from import_stage.mail_messages m where m.run_id = p_run and m.mailbox = p_mailbox)
   where s.run_id = p_run and s.mailbox = p_mailbox;
  return jsonb_build_object('saved', n);
end $function$;
comment on function public.wa289_save_headers(bigint, text, jsonb) is 'wave289: the headers phase: saves the rule outcome of each listed email ({id, thread, state kept|skipped|left_alone, reason, message_id (stored only as its md5) or msg_md5, sent_at, direction, box, writer, writer_name, outside, recipients, subject}). Left-alone mail keeps its id only (and goes to mail_left_alone); Steel''s mail that mybox skipped is left alone here too (rule a). Refuses body-like keys. The service role only.';

create or replace function public.wa289_dedupe(p_run bigint)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_int int; v_dup int; v_seen int;
begin
  if exists (select 1 from public.crm_mail_scans s where s.run_id = p_run and s.phase <> 'dedupe') then
    raise exception 'wa284: email history: dedupe waits until every mailbox of run % has finished its headers', p_run;
  end if;
  -- rule h: internal mail (every outside address a team member or an alias; no outside address at all)
  update import_stage.mail_messages m set state = 'skipped', reason = 'internal', writer = null, writer_name = null, recipients = null, subject = null
   where m.run_id = p_run and m.state = 'kept'
     and not exists (select 1 from unnest(coalesce(m.outside, '{}'::text[])) a where not public.wa289_internal(a));
  get diagnostics v_int = row_count;
  -- duplicates across mailboxes: Steel's copy first
  with ranked as (
    select m.mailbox, m.gmail_id, row_number() over (partition by m.msg_md5 order by m.mailbox = 'hub', m.sent_at, m.gmail_id) as rn
      from import_stage.mail_messages m where m.run_id = p_run and m.state = 'kept' and m.msg_md5 is not null)
  update import_stage.mail_messages m set state = 'skipped', reason = 'duplicate', writer = null, writer_name = null, recipients = null, outside = null, subject = null
    from ranked r where r.rn > 1 and m.run_id = p_run and m.mailbox = r.mailbox and m.gmail_id = r.gmail_id;
  get diagnostics v_dup = row_count;
  -- already kept by an earlier run
  update import_stage.mail_messages m set state = 'done', reason = 'seen', writer = null, writer_name = null, recipients = null, outside = null, subject = null
   where m.run_id = p_run and m.state = 'kept' and m.msg_md5 is not null
     and exists (select 1 from import_stage.mail_seen s where s.msg_md5 = m.msg_md5 and coalesce(s.run_id, -1) <> p_run);
  get diagnostics v_seen = row_count;
  insert into import_stage.mail_seen (msg_md5, mailbox, gmail_id, run_id)
  select m.msg_md5, m.mailbox, m.gmail_id, p_run from import_stage.mail_messages m where m.run_id = p_run and m.state = 'kept' and m.msg_md5 is not null
  on conflict (msg_md5) do nothing;
  update public.crm_mail_scans s set phase = 'bounces' where s.run_id = p_run;
  return jsonb_build_object('internal', v_int, 'duplicate', v_dup, 'seen', v_seen);
end $function$;
comment on function public.wa289_dedupe(bigint) is 'wave289: once every mailbox has finished its headers, one set-based pass: rule h (internal mail skipped), later copies of the same Message-ID skipped as duplicate (Steel''s copy first), mail kept by an earlier run marked seen, and every kept hash recorded in mail_seen (kept across runs and Purge, M4). Moves the scans to bounces. The service role only.';

create or replace function public.wa289_save_bounce(p_run bigint, p_mailbox text, p_id text, p_addr text, p_code text)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  update import_stage.mail_messages m set bounce_read_at = now(),
         bounce_addr = case when p_addr like '%@%' and (p_code ~ '^5\.\d{1,3}\.\d{1,3}$' or p_code = '550') then lower(btrim(p_addr)) end,
         bounce_code = case when p_addr like '%@%' and (p_code ~ '^5\.\d{1,3}\.\d{1,3}$' or p_code = '550') then p_code end
   where m.run_id = p_run and m.mailbox = p_mailbox and m.gmail_id = p_id and m.reason = 'bounce';
end $function$;
comment on function public.wa289_save_bounce(bigint, text, text, text, text) is 'wave289: the bounce parser''s result for a delivery report: a permanent failure (an address with a 5.x.x status or 550) is staged against that address; anything else marks the report read with nothing staged (M6). The service role only.';

create or replace function public.wa289_leave_alone(p_mailbox text, p_id text, p_why text)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  if p_mailbox not in ('steel', 'hub') or p_why not in ('personal', 'security', 'confidential', 'help_seeker', 'staff_hiring') then raise exception 'wa284: email history: leave_alone takes steel or hub and a known category'; end if;
  insert into import_stage.mail_left_alone (mailbox, gmail_id, why) values (p_mailbox, p_id, p_why) on conflict do nothing;
end $function$;
comment on function public.wa289_leave_alone(text, text, text) is 'wave289: records a Gmail id as left alone (personal, security, confidential, help_seeker, staff_hiring), kept across runs. The service role only.';

create or replace function public.wa289_sizes(p_run bigint)
returns jsonb language sql stable security definer set search_path to '' as $function$
  select jsonb_build_object(
    'threads_left', (select count(distinct (m.mailbox, m.thread_id)) from import_stage.mail_messages m where m.run_id = p_run and m.state = 'kept' and m.read_at is null and m.read_fail < 2),
    'threads_read', (select count(distinct (m.mailbox, m.thread_id)) from import_stage.mail_messages m where m.run_id = p_run and m.read_at is not null),
    'writers', (select count(distinct m.writer) from import_stage.mail_messages m where m.run_id = p_run and m.state = 'kept' and m.direction = 'in'),
    'domains', (select count(distinct split_part(m.writer, '@', 2)) from import_stage.mail_messages m where m.run_id = p_run and m.state = 'kept' and m.direction = 'in'
                   and not public.wa289_in_list(split_part(m.writer, '@', 2), public.wa284_cfg('mail_history_freemail'))),
    'multi', (select count(*) from (select m.writer from import_stage.mail_messages m where m.run_id = p_run and m.state = 'kept' and m.direction = 'in' group by m.writer having count(*) >= 2) q))
$function$;
comment on function public.wa289_sizes(bigint) is 'wave289: the sizes the estimate needs (section 7): threads left to read and read, writers, non-free-mail writer domains, writers with two or more emails. Counts only. The service role only.';

-- ============================================================================================ 10. the paid phases
create or replace function public.wa289_save_thread(p_run bigint, p_mailbox text, p_thread text, p_result jsonb, p_cost numeric)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_lo text; v_topic text; v_lang text; e jsonb; v_line int := coalesce((public.wa284_cfg('mail_history_clips') ->> 'line')::int, 140);
begin
  if public.wa289_body_keys(p_result) then raise exception 'wa284: email history: a save may not carry body, text, snippet or html'; end if;
  if p_result is null then
    -- a rejected answer stages nothing; after two the thread is not read again
    update import_stage.mail_messages m set read_fail = m.read_fail + 1 where m.run_id = p_run and m.mailbox = p_mailbox and m.thread_id = p_thread and m.state = 'kept' and m.read_at is null;
    return public.wa289_spend(p_run, p_mailbox, p_cost) || jsonb_build_object('rejected', true);
  end if;
  v_lo := p_result ->> 'leave_out'; v_topic := p_result ->> 'topic'; v_lang := p_result ->> 'lang';
  if v_lo not in ('none', 'personal', 'confidential', 'help_seeker', 'staff_hiring')
     or v_topic not in ('donation', 'partnership', 'volunteering', 'event', 'media', 'supplier', 'government', 'program', 'other')
     or coalesce(v_lang, 'other') not in ('en', 'fr', 'other') then
    raise exception 'wa284: email history: the thread answer has an unknown value';
  end if;
  if v_lo = 'none' then
    for e in select * from jsonb_array_elements(coalesce(p_result -> 'emails', '[]'::jsonb)) loop
      update import_stage.mail_messages m set line = left(nullif(btrim(e ->> 'line'), ''), v_line),
             asks_to_stop = m.direction = 'in' and coalesce((e ->> 'asks_to_stop')::boolean, false),
             sig = case when m.direction = 'in' and jsonb_typeof(e -> 'sig') = 'object' then
                     (select jsonb_object_agg(k, left(v, 160)) from jsonb_each_text(e -> 'sig') x(k, v) where k in ('name', 'title', 'organization', 'phone', 'website') and btrim(v) <> '') end
       where m.run_id = p_run and m.mailbox = p_mailbox and m.thread_id = p_thread and m.gmail_id = e ->> 'id' and m.state = 'kept';
    end loop;
    -- eh-289 M3: only the emails in this answer are marked read, so a thread cut short by the step's deadline is finished by the next step
    update import_stage.mail_messages m set topic = v_topic, lang = coalesce(v_lang, 'other'), read_at = now()
     where m.run_id = p_run and m.mailbox = p_mailbox and m.thread_id = p_thread and m.state = 'kept' and m.read_at is null
       and m.gmail_id in (select j.v ->> 'id' from jsonb_array_elements(coalesce(p_result -> 'emails', '[]'::jsonb)) as j(v));
  else
    -- a left-out thread: only the id (in mail_left_alone) and an asks-to-stop flag from outside are kept
    for e in select * from jsonb_array_elements(coalesce(p_result -> 'emails', '[]'::jsonb)) loop
      update import_stage.mail_messages m set asks_to_stop = m.direction = 'in' and coalesce((e ->> 'asks_to_stop')::boolean, false)
       where m.run_id = p_run and m.mailbox = p_mailbox and m.thread_id = p_thread and m.gmail_id = e ->> 'id' and m.state = 'kept';
    end loop;
    insert into import_stage.mail_left_alone (mailbox, gmail_id, why)
    select p_mailbox, m.gmail_id, v_lo from import_stage.mail_messages m where m.run_id = p_run and m.mailbox = p_mailbox and m.thread_id = p_thread and m.state = 'kept'
    on conflict do nothing;
    update import_stage.mail_messages m set state = 'left_alone', reason = v_lo, read_at = now(), subject = null, line = null, sig = null, topic = null, lang = null,
           outside = null, recipients = null, writer_name = null, writer = case when m.asks_to_stop then m.writer end
     where m.run_id = p_run and m.mailbox = p_mailbox and m.thread_id = p_thread and m.state = 'kept';
  end if;
  return public.wa289_spend(p_run, p_mailbox, p_cost);
end $function$;
comment on function public.wa289_save_thread(bigint, text, text, jsonb, numeric) is 'wave289: stages a validated read_thread answer ({leave_out, topic, lang, emails [{id, line, asks_to_stop, sig}]}) and adds its cost. A left-out thread keeps only its ids (mail_left_alone) and an asks-to-stop flag from outside (with the writer''s key, so it can act). A null answer (rejected by validation) stages nothing and counts a failure. Refuses body-like keys. The service role only.';

create or replace function public.wa289_match(p_email text, p_phone text default null)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare k text := lower(btrim(coalesce(p_email, ''))); v bigint; v_kind text := 'email'; v_id bigint; v_next bigint; seen bigint[] := '{}'; d text;
begin
  if k <> '' then
    v := public.wa284_contact(null, k);
    if v is null then
      select x.id, x.merged_into into v_id, v_next from public.crm_contacts x
       where x.merged_into is not null and (lower(btrim(x.primary_email)) = k or exists (select 1 from unnest(x.emails) e where lower(btrim(e)) = k)) order by x.id limit 1;
      if v_id is not null then
        v_kind := 'merged';
        while v_next is not null loop
          if v_id = any(seen) then raise exception 'wa284: email history: merge loop at contact %', v_id; end if;
          seen := seen || v_id;
          select x.id, x.merged_into into v_id, v_next from public.crm_contacts x where x.id = v_next;
          if not found then v_id := null; exit; end if;
        end loop;
        v := v_id;
      end if;
    end if;
    if v is not null then
      if exists (select 1 from public.crm_contacts x, unnest(x.emails || x.primary_email) e where x.id = v and e is not null and public.wa289_internal(e)) then v_kind := 'internal'; end if;
      return jsonb_build_object('id', v, 'kind', v_kind);
    end if;
  end if;
  d := right(public.wa171_digits(coalesce(p_phone, '')), 10);
  if length(d) = 10 then
    select x.id into v from public.crm_contacts x
     where x.merged_into is null and exists (select 1 from unnest(x.phones) ph where right(public.wa171_digits(ph), 10) = d) order by x.id limit 1;
    if v is not null then return jsonb_build_object('id', v, 'kind', 'phone_only'); end if;
  end if;
  return jsonb_build_object('id', null, 'kind', 'none');
end $function$;
comment on function public.wa289_match(text, text) is 'wave289: the Hub contact for an email-history address (5.6): wave284''s wa284_contact (active contacts, primary or any email, lower case and trimmed, the lowest id), then a merged contact''s merged_into followed to the active record (a loop raises), then the signature phone''s last 10 digits against active contacts (phone_only: listed, never merged or enriched). A team member''s contact is internal. Returns {id, kind}. The service role only.';

create or replace function public.wa289_group(p_run bigint)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_free jsonb := public.wa284_cfg('mail_history_freemail'); r record; m jsonb; n_writers int; n_opt int; n_out int; n_supp int;
begin
  if exists (select 1 from public.crm_mail_scans s where s.run_id = p_run and s.phase <> 'people') then
    raise exception 'wa284: email history: grouping waits until every mailbox of run % has read its threads', p_run;
  end if;
  create temp table if not exists wa289_keys (key text primary key, writer boolean, optout text, optout_at date) on commit drop;
  truncate pg_temp.wa289_keys;
  insert into pg_temp.wa289_keys (key, writer)
  select distinct m.writer, true from import_stage.mail_messages m where m.run_id = p_run and m.state = 'kept' and m.direction = 'in' and m.writer is not null
     and not exists (select 1 from public.crm_email_suppressions s where s.addr_md5 = md5(m.writer) and s.kind = 'deleted');
  select count(distinct m.writer) into n_supp from import_stage.mail_messages m where m.run_id = p_run and m.state = 'kept' and m.direction = 'in'
     and exists (select 1 from public.crm_email_suppressions s where s.addr_md5 = md5(m.writer) and s.kind = 'deleted');
  -- opt-outs: asked to stop (from any incoming email, a left-out thread included), then permanent bounces
  insert into pg_temp.wa289_keys as w (key, writer, optout, optout_at)
  select m.writer, false, 'asked_to_stop', max(m.sent_at)::date from import_stage.mail_messages m
   where m.run_id = p_run and m.asks_to_stop and m.writer is not null group by m.writer
  on conflict (key) do update set optout = 'asked_to_stop', optout_at = excluded.optout_at;
  insert into pg_temp.wa289_keys as w (key, writer, optout, optout_at)
  select m.bounce_addr, false, 'bounced', max(m.sent_at)::date from import_stage.mail_messages m
   where m.run_id = p_run and m.bounce_addr is not null group by m.bounce_addr
  on conflict (key) do update set optout = coalesce(w.optout, 'bounced'), optout_at = case when w.optout is null then excluded.optout_at else w.optout_at end;
  select count(*) filter (where writer), count(*) filter (where optout is not null) into n_writers, n_opt from pg_temp.wa289_keys;
  select count(distinct x) into n_out from import_stage.mail_messages m, unnest(coalesce(m.recipients, '{}'::text[])) x
   where m.run_id = p_run and m.state = 'kept' and m.direction = 'out' and not exists (select 1 from pg_temp.wa289_keys k where k.key = x and k.writer);

  for r in select * from pg_temp.wa289_keys loop
    insert into import_stage.mail_people as p (run_id, key, writer, addresses, name, names, lang, sig, domain, general_inbox, counts, first_at, last_at, mailboxes, topics, optout, optout_at, match_id, match_kind)
    select p_run, r.key, r.writer, array[r.key],
           (select m.writer_name from import_stage.mail_messages m where m.run_id = p_run and m.writer = r.key and m.state = 'kept' and m.writer_name is not null
             group by m.writer_name order by count(*) desc, max(m.sent_at) desc limit 1),
           (select jsonb_object_agg(q.nm, q.n) from (select m.writer_name nm, count(*) n from import_stage.mail_messages m where m.run_id = p_run and m.writer = r.key and m.state = 'kept' and m.writer_name is not null group by 1) q),
           (select m.lang from import_stage.mail_messages m where m.run_id = p_run and m.writer = r.key and m.state = 'kept' and m.lang is not null group by m.lang order by count(*) desc limit 1),
           (select nullif(jsonb_strip_nulls(jsonb_build_object(
               'name', public.wa289_vote(array_agg(m.sig ->> 'name' order by m.sent_at desc)),
               'title', public.wa289_vote(array_agg(m.sig ->> 'title' order by m.sent_at desc)),
               'organization', public.wa289_vote(array_agg(m.sig ->> 'organization' order by m.sent_at desc)),
               'phone', public.wa289_vote(array_agg(m.sig ->> 'phone' order by m.sent_at desc)),
               'website', public.wa289_vote(array_agg(m.sig ->> 'website' order by m.sent_at desc)))), '{}'::jsonb)
              from import_stage.mail_messages m where m.run_id = p_run and m.writer = r.key and m.state = 'kept' and m.sig is not null),
           split_part(r.key, '@', 2),
           split_part(r.key, '@', 1) in ('info', 'contact', 'office', 'hello', 'admin', 'bonjour', 'reception', 'general', 'mail', 'team', 'inquiries', 'enquiries', 'communications')
             and not public.wa289_in_list(split_part(r.key, '@', 2), v_free),
           (select jsonb_build_object('in', count(*) filter (where q.direction = 'in'), 'out', count(*) filter (where q.direction = 'out'),
                     'threads', count(distinct (q.mailbox, q.thread_id)),
                     'by_year', (select jsonb_object_agg(y, c) from (select extract(year from q2.sent_at)::int::text y, count(*) c from import_stage.mail_messages q2
                                   where q2.run_id = p_run and q2.state = 'kept' and (q2.writer = r.key or r.key = any(coalesce(q2.recipients, '{}'::text[]))) group by 1) yy))
              from import_stage.mail_messages q where q.run_id = p_run and q.state = 'kept' and (q.writer = r.key or r.key = any(coalesce(q.recipients, '{}'::text[])))),
           (select min(q.sent_at) from import_stage.mail_messages q where q.run_id = p_run and q.state = 'kept' and (q.writer = r.key or r.key = any(coalesce(q.recipients, '{}'::text[])))),
           (select max(q.sent_at) from import_stage.mail_messages q where q.run_id = p_run and q.state = 'kept' and (q.writer = r.key or r.key = any(coalesce(q.recipients, '{}'::text[])))),
           (select array_agg(distinct q.mailbox) from import_stage.mail_messages q where q.run_id = p_run and q.state in ('kept', 'left_alone', 'skipped')
               and (q.writer = r.key or r.key = any(coalesce(q.recipients, '{}'::text[])) or q.bounce_addr = r.key)),
           (select array_agg(distinct q.topic) from import_stage.mail_messages q where q.run_id = p_run and q.state = 'kept' and q.topic is not null and (q.writer = r.key or r.key = any(coalesce(q.recipients, '{}'::text[])))),
           r.optout, r.optout_at, null, null
    on conflict (run_id, key) do update set writer = excluded.writer, addresses = excluded.addresses, name = excluded.name, names = excluded.names, lang = excluded.lang,
           sig = excluded.sig, domain = excluded.domain, general_inbox = excluded.general_inbox, counts = excluded.counts, first_at = excluded.first_at, last_at = excluded.last_at,
           mailboxes = excluded.mailboxes, topics = excluded.topics, optout = excluded.optout, optout_at = excluded.optout_at;
    m := public.wa289_match(r.key, (select p.sig ->> 'phone' from import_stage.mail_people p where p.run_id = p_run and p.key = r.key));
    update import_stage.mail_people p set match_id = (m ->> 'id')::bigint, match_kind = m ->> 'kind' where p.run_id = p_run and p.key = r.key;
  end loop;
  delete from import_stage.mail_people p where p.run_id = p_run and not exists (select 1 from pg_temp.wa289_keys k where k.key = p.key);
  update public.crm_mail_scans s set counts = s.counts || jsonb_build_object('run', jsonb_build_object('writers', n_writers, 'optouts', n_opt, 'outbound_only', n_out, 'suppressed', n_supp))
   where s.run_id = p_run;
  return jsonb_build_object('writers', n_writers, 'optouts', n_opt, 'outbound_only', n_out, 'suppressed', n_supp);
end $function$;
comment on function public.wa289_group(bigint) is 'wave289: groups the run''s people (5.2): a writer for each address with a kept incoming email (never one suppressed as deleted), plus every address with a staged opt-out (asked to stop, wins; or a permanent bounce). Per person: the most frequent display name, dates, counts by year, threads, mailboxes, topics, signature votes, general inbox, the match preview. Outbound-only recipients are counted, never grouped. Keeps an admin''s type, Leave out and Not an opt-out on a re-run. Returns counts only. The service role only.';

create or replace function public.wa289_save_person(p_run bigint, p_key text, p_type text, p_conf numeric, p_cost numeric)
returns jsonb language plpgsql security definer set search_path to '' as $function$
begin
  if p_type is not null and p_type not in ('donor', 'partner', 'volunteer', 'supporter', 'vendor', 'media', 'government', 'other') then
    raise exception 'wa284: email history: unknown type %', p_type;
  end if;
  if p_type is not null and not (p_conf >= 0 and p_conf <= 1) then raise exception 'wa284: email history: a confidence must be between 0 and 1'; end if;
  update import_stage.mail_people p set rel_type = p_type, rel_conf = case when p_type is null then null else round(p_conf, 3) end, typed_at = now()
   where p.run_id = p_run and p.key = lower(btrim(p_key));
  return public.wa289_spend(p_run, null, p_cost);
end $function$;
comment on function public.wa289_save_person(bigint, text, text, numeric, numeric) is 'wave289: stages a writer''s type and confidence from one Jev decision (null when Jev gave no usable answer) and adds its cost. The service role only.';

create or replace function public.wa289_orgs_todo(p_run bigint, p_limit int default 20)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_cap int := coalesce((public.wa284_cfg('mail_history_org_cap') ->> 'domains')::int, 600); v_done int; v_min numeric := public.wa289_num('mail_history_org_type_min', 0.6);
begin
  select count(*) into v_done from import_stage.mail_orgs o where o.run_id = p_run and o.outcome <> 'over_cap';
  return (select coalesce(jsonb_agg(jsonb_build_object('domain', q.domain, 'partner_id',
            (select w.id from public.wa_partners w where lower(regexp_replace(regexp_replace(coalesce(w.website, ''), '^[a-z]+://(www\.)?', '', 'i'), '[/:?#].*$', '')) = q.domain order by w.id limit 1),
            'over_cap', q.rn > greatest(v_cap - v_done, 0))), '[]'::jsonb)
    from (select d.domain, row_number() over (order by d.writers desc, d.domain) rn from (
            select p.domain, count(*) writers from import_stage.mail_people p
             where p.run_id = p_run and p.writer and not p.excluded and coalesce(p.match_kind, 'none') <> 'internal' and p.domain is not null
               and p.domain not like '%welfareavenue.com'
               and not public.wa289_in_list(p.domain, public.wa284_cfg('mail_history_freemail'))
               and not public.wa289_in_list(p.domain, public.wa284_cfg('mail_history_platforms'))
               and not exists (select 1 from import_stage.mail_orgs o where o.run_id = p_run and o.domain = p.domain)
             group by p.domain
            having bool_or(p.rel_type in ('partner', 'donor', 'vendor', 'media', 'government') and p.rel_conf >= v_min)
                or bool_or(p.sig ->> 'organization' is not null) or count(*) >= 2) d
          order by d.writers desc, d.domain limit least(greatest(coalesce(p_limit, 20), 1), 100)) q);
end $function$;
comment on function public.wa289_orgs_todo(bigint, int) is 'wave289: the next organisation domains to look up (5.5): writers'' domains that are not free mail, welfareavenue.com or a platform, where a writer is typed partner, donor, vendor, media or government above mail_history_org_type_min, a signature names an organisation, or two or more writers share it; with the Hub organisation whose website has that host, and over_cap past mail_history_org_cap. The service role only.';

create or replace function public.wa289_save_org(p_run bigint, p_domain text, p_row jsonb, p_cost numeric)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare k text;
begin
  if public.wa289_body_keys(p_row) then raise exception 'wa284: email history: a save may not carry body, text, snippet or html'; end if;
  if p_row ->> 'outcome' not in ('found', 'none_found', 'robots', 'refused_address', 'fetch_failed', 'not_html', 'over_cap') then raise exception 'wa284: email history: unknown outcome'; end if;
  if jsonb_typeof(p_row -> 'facts') = 'object' then
    for k in select jsonb_object_keys(p_row -> 'facts') loop
      if k not in ('name', 'kind', 'description', 'street', 'city', 'province', 'postal_code', 'country') then raise exception 'wa284: email history: facts may not carry %', k; end if;
    end loop;
  end if;
  insert into import_stage.mail_orgs (run_id, domain, partner_id, robots, fetched_at, url, facts, conf, outcome)
  values (p_run, lower(btrim(p_domain)), (p_row ->> 'partner_id')::bigint, p_row ->> 'robots', case when p_row ->> 'outcome' in ('found', 'none_found', 'not_html') then now() end,
          left(p_row ->> 'url', 300), case when jsonb_typeof(p_row -> 'facts') = 'object' then p_row -> 'facts' end, (p_row ->> 'conf')::numeric, p_row ->> 'outcome')
  on conflict (run_id, domain) do update set partner_id = excluded.partner_id, robots = excluded.robots, fetched_at = excluded.fetched_at, url = excluded.url,
         facts = excluded.facts, conf = excluded.conf, outcome = excluded.outcome;
  return public.wa289_spend(p_run, null, p_cost);
end $function$;
comment on function public.wa289_save_org(bigint, text, jsonb, numeric) is 'wave289: stages an organisation lookup ({partner_id, robots, url, facts {name, kind, description, street, city, province, postal_code, country}, conf, outcome}) and adds its cost. Any other fact key, or a body-like key, raises: nothing about people and no page text. The service role only.';

-- ============================================================================================ 11. Look at them (personal data to the admin's browser only)
create or replace function public.wa289_is_steel(p_caller text)
returns boolean language sql stable security definer set search_path to '' as $function$
  select lower(btrim(coalesce(p_caller, ''))) = 'steel.macdonald@welfareavenue.com'
      or exists (select 1 from public.wa_email_aliases a where lower(btrim(a.email)) = 'steel.macdonald@welfareavenue.com'
                    and exists (select 1 from unnest(coalesce(a.aliases, '{}'::text[])) x where lower(btrim(x)) = lower(btrim(coalesce(p_caller, ''))) and btrim(x) <> ''))
$function$;
comment on function public.wa289_is_steel(text) is 'wave289: true when the caller is Steel (steel.macdonald@ or one of his aliases): only he sees people found in his mailbox (M3). The service role only.';

create or replace function public.wa289_people(p_run bigint, p_filter jsonb, p_offset int, p_caller text)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_steel boolean := public.wa289_is_steel(p_caller); f jsonb := coalesce(p_filter, '{}'::jsonb); v_hidden int;
begin
  if f ? 'mailbox' and f ->> 'mailbox' = 'steel' and not v_steel then raise exception 'wa284: email history: only Steel sees people from his mailbox'; end if;
  select count(*) into v_hidden from import_stage.mail_people p where p.run_id = p_run and not v_steel and 'steel' = any(coalesce(p.mailboxes, '{}'::text[]));
  return (select jsonb_build_object('hidden', v_hidden, 'total', coalesce(max(q.total), 0), 'rows', coalesce(jsonb_agg(q.j order by q.ord), '[]'::jsonb)) from (
           select jsonb_build_object('key', p.key, 'name', p.name, 'type', p.rel_type, 'conf', p.rel_conf, 'in', p.counts -> 'in', 'out', p.counts -> 'out',
                    'first_at', p.first_at, 'last_at', p.last_at, 'organization', p.sig ->> 'organization', 'match', p.match_kind, 'match_id', p.match_id,
                    'optout', p.optout, 'not_optout', p.not_optout, 'excluded', p.excluded, 'writer', p.writer, 'mailboxes', to_jsonb(p.mailboxes)) j,
                  row_number() over (order by p.last_at desc nulls last, p.key) ord, count(*) over () total
             from import_stage.mail_people p
            where p.run_id = p_run and (v_steel or not ('steel' = any(coalesce(p.mailboxes, '{}'::text[]))))
              and (not f ? 'type' or p.rel_type = f ->> 'type')
              and (not f ? 'match' or (f ->> 'match' = 'new' and coalesce(p.match_kind, 'none') in ('none', 'phone_only')) or (f ->> 'match' = 'existing' and p.match_kind in ('email', 'merged')))
              and (coalesce((f ->> 'asked_to_stop')::boolean, false) = false or p.optout = 'asked_to_stop')
              and (coalesce((f ->> 'bounced')::boolean, false) = false or p.optout = 'bounced')
              and (coalesce((f ->> 'phone_only')::boolean, false) = false or p.match_kind = 'phone_only')
            order by p.last_at desc nulls last, p.key offset greatest(coalesce(p_offset, 0), 0) limit 50) q);
end $function$;
comment on function public.wa289_people(bigint, jsonb, int, text) is 'wave289: Look at them (5.7): 50 people of a run at a time (name, address, type and confidence, emails in and out, first and last, organisation, match, opt-out, left out), with filters type, match new|existing, asked_to_stop, bounced, phone_only. People found in Steel''s mailbox reach only Steel (M3): for anyone else they are counted as hidden. For the admin''s browser only (mail-history''s people action, which never takes the trigger secret). The service role only.';

create or replace function public.wa289_exclude(p_run bigint, p_key text, p_what text, p_on boolean, p_caller text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare p import_stage.mail_people;
begin
  select * into p from import_stage.mail_people x where x.run_id = p_run and x.key = lower(btrim(p_key));
  if not found then raise exception 'wa284: email history: no such person in run %', p_run; end if;
  if 'steel' = any(coalesce(p.mailboxes, '{}'::text[])) and not public.wa289_is_steel(p_caller) then raise exception 'wa284: email history: only Steel changes people from his mailbox'; end if;
  if p_what = 'person' then update import_stage.mail_people x set excluded = coalesce(p_on, true) where x.run_id = p_run and x.key = p.key;
  elsif p_what = 'optout' then
    if p.optout is null then raise exception 'wa284: email history: this person has no staged opt-out'; end if;
    update import_stage.mail_people x set not_optout = coalesce(p_on, true) where x.run_id = p_run and x.key = p.key;
  else raise exception 'wa284: email history: exclude takes person or optout'; end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('crm_mail_scans', p_run::text, 'exclude ' || p_what, null, case when coalesce(p_on, true) then 'on' else 'off' end, coalesce(nullif(p_caller, ''), 'mail-history'));
  return jsonb_build_object('ok', true);
end $function$;
comment on function public.wa289_exclude(bigint, text, text, boolean, text) is 'wave289: Leave out (what person) or Not an opt-out (what optout) for one person of a run, or put back (p_on false); people from Steel''s mailbox only by Steel. Logged without the address. Changes the batches'' basis (wave292). The service role only.';

-- ============================================================================================ 12. status (counts only)
create or replace function public.wa289_status(p_run bigint)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare s record; v_boxes jsonb := '[]'::jsonb; c jsonb;
begin
  if not exists (select 1 from public.crm_mail_scans x where x.run_id = p_run) then raise exception 'wa284: email history: there is no scan for run %', p_run; end if;
  for s in select * from public.crm_mail_scans x where x.run_id = p_run order by x.mailbox = 'hub' loop
    c := jsonb_build_object(
      'listed', (select count(*) from import_stage.mail_messages m where m.run_id = p_run and m.mailbox = s.mailbox),
      'by_state', (select coalesce(jsonb_object_agg(q.k, q.n), '{}'::jsonb) from (select m.state k, count(*) n from import_stage.mail_messages m where m.run_id = p_run and m.mailbox = s.mailbox group by 1) q),
      'by_reason', (select coalesce(jsonb_object_agg(q.k, q.n), '{}'::jsonb) from (select m.reason k, count(*) n from import_stage.mail_messages m where m.run_id = p_run and m.mailbox = s.mailbox and m.reason is not null group by 1) q),
      'by_box', (select coalesce(jsonb_object_agg(q.k, q.n), '{}'::jsonb) from (select m.box k, count(*) n from import_stage.mail_messages m where m.run_id = p_run and m.mailbox = s.mailbox and m.box is not null group by 1) q),
      'bounces_staged', (select count(*) from import_stage.mail_messages m where m.run_id = p_run and m.mailbox = s.mailbox and m.bounce_addr is not null),
      'asks_to_stop', (select count(*) from import_stage.mail_messages m where m.run_id = p_run and m.mailbox = s.mailbox and m.asks_to_stop),
      'threads_read', (select count(distinct m.thread_id) from import_stage.mail_messages m where m.run_id = p_run and m.mailbox = s.mailbox and m.read_at is not null),
      'threads_rejected', (select count(distinct m.thread_id) from import_stage.mail_messages m where m.run_id = p_run and m.mailbox = s.mailbox and m.read_fail >= 2))
      || case when s.counts ? 'run' then jsonb_build_object('run', s.counts -> 'run') else '{}'::jsonb end;   -- eh-289 I2: no empty run object
    update public.crm_mail_scans x set counts = c where x.id = s.id;
    v_boxes := v_boxes || jsonb_build_array(jsonb_build_object('mailbox', s.mailbox, 'phase', s.phase, 'counts', c, 'oldest_at', s.oldest_at, 'estimate_usd', s.estimate_usd,
               'spend_usd', s.spend_usd, 'cap_usd', s.cap_usd, 'paused', s.paused, 'go_at', s.go_at, 'finished_at', s.finished_at, 'last_error', s.last_error,
               'stepping', s.step_at is not null));
  end loop;
  return jsonb_build_object('run_id', p_run, 'mailboxes', v_boxes,
    'spend_usd', (select sum(x.spend_usd) from public.crm_mail_scans x where x.run_id = p_run),
    'cap_usd', (select max(x.cap_usd) from public.crm_mail_scans x where x.run_id = p_run),
    'people', (select jsonb_build_object('writers', count(*) filter (where p.writer), 'typed', count(*) filter (where p.typed_at is not null),
                 'optouts', count(*) filter (where p.optout is not null), 'phone_only', count(*) filter (where p.match_kind = 'phone_only'),
                 'existing', count(*) filter (where p.match_kind in ('email', 'merged')), 'internal', count(*) filter (where p.match_kind = 'internal'),
                 'excluded', count(*) filter (where p.excluded), 'by_type', (select coalesce(jsonb_object_agg(q.k, q.n), '{}'::jsonb) from (select p2.rel_type k, count(*) n from import_stage.mail_people p2 where p2.run_id = p_run and p2.rel_type is not null group by 1) q))
                 from import_stage.mail_people p where p.run_id = p_run),
    'orgs', (select coalesce(jsonb_object_agg(q.k, q.n), '{}'::jsonb) from (select o.outcome k, count(*) n from import_stage.mail_orgs o where o.run_id = p_run group by 1) q),
    'ready', public.wa289_ready());
end $function$;
comment on function public.wa289_status(bigint) is 'wave289: a run''s progress as counts only (per mailbox: phase, counts by state, reason and box, bounces and asks-to-stop staged, threads read and rejected, oldest date, estimate, spend, cap, paused; people by type and match; organisations by outcome; what blocks a start). Refreshes crm_mail_scans.counts. What Claude sessions read instead of import_stage. The service role only.';

-- ============================================================================================ 13. every wa289_ function: the service role only
do $wa289$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'wa289\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $wa289$;

-- ============================================================================================ 14. the release record (once)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave289', 'wave289', null,
       'The email history scan''s database: crm_import_runs.source, crm_mail_scans, crm_email_suppressions (empty), the import_stage mail tables, ai_routes.provider and the four mail_history routes, the mail_ settings and the wa289_ functions (service role only). Nothing reaches the CRM.', 'wave289'
 where not exists (select 1 from public.change_log where entity_type = 'release' and entity_id = 'wave289' and field = 'wave289');
