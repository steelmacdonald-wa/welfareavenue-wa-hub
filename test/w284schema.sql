-- wave284: what build/data/wa284_import.sql, its undo and the wave284 assertions touch beyond test/w281schema.sql, for the offline proof in
-- test/w284sql.mjs (PGlite). Loaded after test/w281schema.sql and build/data/wa281_rules.sql (wave281 is built on this branch, not live yet).
-- The column lists follow live (zwnmulmnvopclzcvytce, read 06/11/26) for the columns the import reads or writes; storage and net are the
-- slices of Supabase's own schemas the migration touches. Every row in section 3 is invented (Test ..., example.com / example.invalid,
-- 555 numbers, Keela ids KT... and KC...). Not a copy of live: do not apply it anywhere but the offline PGlite database.

-- 1. Supabase's storage and pg_net (only what the migration and the guard use)
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;
create table if not exists storage.buckets (
  id text primary key, name text not null, owner uuid, created_at timestamptz default now(), updated_at timestamptz default now(),
  public boolean default false, file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (id bigserial primary key, bucket_id text references storage.buckets(id), name text, owner uuid, metadata jsonb);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated, service_role;
grant select on storage.buckets to authenticated, service_role;

create schema if not exists net;
create table if not exists net.http_request_queue (id bigserial primary key, method text not null, url text not null, headers jsonb, body bytea, timeout_milliseconds int);

-- 2. live tables the import reads or guards (the columns that matter)
-- crm_contacts.primary_email is generated on live (lower(nullif(btrim(emails[1]), ''))); test/w281schema.sql has it as a plain column, so it is
-- rebuilt here as live has it (the wave281 view crm_contacts_v and crm_contact_match, which depend on it, are dropped with it: wave284 uses neither)
alter table public.crm_contacts drop column primary_email cascade;
alter table public.crm_contacts add column primary_email text generated always as (lower(nullif(btrim(emails[1]), ''::text))) stored;
create table public.team_members (id bigint primary key, name text not null, email text, active boolean not null default true);
create table public.volunteer_role_guides (role text primary key, label_en text, label_fr text);
create table public.dept_requests (id bigserial primary key, department text, title text, body text, status text not null default 'open', created_at timestamptz not null default now());
create table public.hub_notifications_sent (id bigserial primary key, event text, email text, created_at timestamptz not null default now());

-- 3. fixture rows (invented)
insert into public.team_members (id, name, email) values (901, 'Test Staff One', 'w284.staff@example.invalid'), (902, 'Test Staff Two', 'w284.staff2@example.invalid');
insert into public.volunteer_role_guides (role, label_en) values
  ('server', 'Server'), ('cook', 'Cook'), ('driver', 'Driver'), ('photographer', 'Photographer'), ('team_leader', 'Team leader'),
  ('community_talker', 'Community welcome'), ('dishwasher', 'Dishwasher');
insert into public.crm_fields (key, label, type, options, sort, created_by) values
  ('volunteer_positions', 'Volunteer positions', 'multi', '["Server", "Cook", "Driver", "Photographer", "Team Leader", "Community Talker", "Dishwasher"]', 200, 'S6 wave269a'),
  ('volunteer_availability', 'Volunteer availability', 'long_text', '[]', 210, 'S6 wave269a'),
  ('dates_volunteered', 'Dates volunteered', 'long_text', '[]', 220, 'S6 wave269a'),
  ('rally_paper_team', 'Rally Paper team', 'choice', '["Challengers (Live Physical Challenges)", "Logic & Trivia", "Quest", "Treasurer", "Online Challenges"]', 230, 'wave156'),
  ('donor_readiness', 'Donor readiness', 'choice', '["R", "SP", "NR"]', 240, 'wave156');

-- Hub contacts the Keela rows meet
insert into public.crm_contacts (id, full_name, first_name, emails, email_status, notes, legacy_refs) overriding system value values
  (3001, 'Test Alpha Keela', null, array['alpha@example.com'], 'subscribed', 'A Hub note',
   '{"keela": {"contact_id": "KT001", "positions": ["Volunteer Cook, Volunteer Server", "Juggler"], "availability": ["Sundays May to August"], "dates_volunteered": ["2025-06-01", "2025-07-06"], "rally_paper_team": "Quest", "donor_readiness": "Shows potential", "assignee": "Test Staff One"}}');
insert into public.crm_contacts (id, full_name, first_name, emails, phones, city, legacy_refs) overriding system value values
  (3002, 'Test Beta', 'Beta', array['beta@example.com'], array['+1 514 555 0202'], 'Montreal', '{}');
-- that phone texted START to the Hub on 01/06/25, after its Keela text opt-out (batch 6 keeps texts on)
insert into public.quo_messages (batch_id, phone, body, status, direction, kind, handled, created_at) values
  (gen_random_uuid(), '+15145550202', 'START', 'received', 'in', 'inbound', 'opted_in', '2025-06-01 12:00:00+00');
-- a Keela person whose history has an undated unsubscribe that a dated opt-in clearly follows (the list runs oldest first)
insert into public.crm_contacts (id, full_name, emails, email_status, legacy_refs) overriding system value values
  (3006, 'Test Theta Order', array['theta@example.com'], 'subscribed', '{"keela": {"contact_id": "KT010"}}');
insert into public.crm_contacts (id, full_name, phones, legacy_refs) overriding system value values
  (3003, 'gamma@example.com', array['+1 514 555 0303'], '{}');
insert into public.crm_contacts (id, full_name, emails, email_status, legacy_refs) overriding system value values
  (3004, 'Test Delta', array['delta@example.com'], 'unsubscribed', '{"keela": {"contact_id": "KT004", "donor_readiness": "Ready", "assignee": "Test Nobody"}}'),
  (3005, 'Test Epsilon', array['epsilon@example.com'], 'subscribed', '{"keela": {"contact_id": "KT005"}}');
insert into public.crm_contact_private (contact_id, birth_date, source, updated_at, updated_by) values (3002, '1970-01-01', 'set by HR in the CRM', now(), 'w281.hr@example.invalid');
insert into public.crm_contact_fields (contact_id, field_id, value, source) select 3004, f.id, '"NR"', 'keela' from public.crm_fields f where f.key = 'donor_readiness';
insert into public.crm_interactions (contact_id, kind, direction, channel, subject, body, occurred_at, source, source_ref, meta) values
  (3005, 'form', 'in', 'website', 'Test earlier form', 'Shift: Sunday', '2025-04-01 16:00:00+00', 'keela', 'keela:R003', '{"type": "Form Response"}');

-- organisations already in the Hub
insert into public.wa_partners (id, name, category, status, visibility) overriding system value values
  (4001, 'Test Bakery', 'partner', 'active', 'everyone'), (4002, 'Test Foundation', 'sponsor', 'past', 'everyone');
