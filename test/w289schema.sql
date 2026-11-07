-- wave289: what build/data/wa289_scan.sql, its undo and the wave289 assertions touch beyond test/w281schema.sql, build/data/wa281_rules.sql,
-- test/w284schema.sql and build/data/wa284_import.sql, for the offline proof in test/w289sql.mjs (PGlite). The column lists follow live
-- (zwnmulmnvopclzcvytce, read 07/11/26) for ai_routes, mybox_owners, mybox_mail and wa_email_aliases; cron and call_edge are stand-ins.
-- Every row is invented (Test ..., example.invalid, example.org, 555 numbers). Not a copy of live: do not apply it anywhere but PGlite.

-- 1. pg_cron and call_edge stand-ins
create schema if not exists cron;
create table if not exists cron.job (jobid bigserial primary key, jobname text unique, schedule text not null, command text not null);
create or replace function cron.schedule(job_name text, schedule text, command text) returns bigint language plpgsql as $$
declare v bigint;
begin
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid into v;
  return v;
end $$;
create or replace function cron.unschedule(job_name text) returns boolean language plpgsql as $$
begin
  delete from cron.job where jobname = job_name;
  return found;
end $$;
create or replace function public.call_edge(fn text, payload jsonb default '{}'::jsonb) returns bigint language sql as $$ select 0::bigint $$;

-- 2. live tables wave289 reads (the columns that matter)
create table public.ai_routes (
  task text primary key, label text, chain text[] not null default '{}'::text[], jev boolean not null default false, max_tokens integer, notes text,
  updated_at timestamptz default now(), updated_by text, mode text not null default 'chain', system_add text
);
create table public.mybox_owners (
  email text primary key, name text, enabled boolean default true, auto_sort boolean default false, days_back integer default 3, archive_labels text[] default '{}',
  label_notes jsonb default '{}', skip_senders text[] default '{}', skip_words text[] default '{}', voice text, labels jsonb, labels_at timestamptz,
  last_sort_at timestamptz, last_result text, last_error text, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table public.mybox_mail (
  id bigserial primary key, owner text not null, gmail_id text not null, thread_id text, received_at timestamptz, skipped boolean default false,
  from_email text, from_name text, subject text, snippet text, state text, error text, created_at timestamptz default now(), unique (owner, gmail_id)
);
create table public.wa_email_aliases (email text primary key, aliases text[] default '{}', note text, updated_at timestamptz default now());

-- 3. fixture rows (invented)
insert into public.ai_routes (task, label, chain, mode, system_add) values
  ('default', 'Default', array['anthropic/claude-sonnet-5'], 'jev', null),
  ('reel', 'Loading lines', array['anthropic/claude-haiku-4.5'], 'chain', 'Test confidentiality rule: keep personal and HR matters out.');
insert into public.mybox_owners (email, name, skip_senders, skip_words) values
  ('steel.macdonald@welfareavenue.com', 'Test Owner Testerson', array['@family.example.invalid'], array['test private']);
insert into public.mybox_mail (owner, gmail_id, skipped, state) values ('steel.macdonald@welfareavenue.com', 'gmailSKIP0001', true, 'skipped');
insert into public.wa_email_aliases (email, aliases) values ('steel.macdonald@welfareavenue.com', array['test.owner.alias@example.invalid']),
  ('w284.staff@example.invalid', array['w289.staff.home@example.invalid']);
-- Hub contacts the matching meets
insert into public.crm_contacts (id, full_name, emails, phones) overriding system value values
  (4001, 'Test Existing Writer', array['existing.writer@org.example.org'], '{}'),
  (4002, 'Test Old Record', array['moved.writer@example.org'], '{}'),
  (4003, 'Test Kept Record', array['moved.new@example.org'], '{}'),
  (4004, 'Test Phone Person', array['other@example.org'], array['+1 514 555 0177']),
  (4005, 'Test Staff Contact', array['w289.staff.home@example.invalid'], '{}'),
  (4006, 'Test Loop A', array['loop.writer@example.org'], '{}'),
  (4007, 'Test Loop B', array['loop.b@example.org'], '{}');
update public.crm_contacts set merged_into = 4003 where id = 4002;
update public.crm_contacts set merged_into = 4007 where id = 4006;
update public.crm_contacts set merged_into = 4006 where id = 4007;
insert into public.wa_partners (name, website) values ('Test Partner Org', 'https://www.org.example.org/about');
