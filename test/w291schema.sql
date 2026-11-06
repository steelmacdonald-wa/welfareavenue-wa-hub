-- wave291: the slice of the live schema that wa171_opted_out reads, for the offline proof in test/w291sql.mjs (PGlite). Copied read-only from live
-- (zwnmulmnvopclzcvytce) on 06/11/26: the columns and every index of crm_contacts, the columns of volunteer_profiles, quo_messages, whatsapp_messages
-- and change_log, and the pg_get_functiondef text of wa171_digits and wa171_opted_out with their live grants and comment (test/w291sql.mjs checks
-- each md5 against live). wave281's text for wa171_opted_out is loaded on top by test/w291_w281text.sql. No foreign keys to tables outside this slice.
-- Every row in section 4 is invented (Test ..., 555 numbers), shaped like live: about 2,000 contacts, about 300 pages, a few opted out, a few merged,
-- numbers written in every format the Hub sees, shared numbers, and STOP and START texts on the ops line and on WhatsApp.
-- Not a copy of live: do not apply it anywhere but the offline PGlite database.

-- 1. roles and the Supabase defaults for new objects in public
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- 2. tables and indexes (live columns; crm_contacts keeps every live index, so the planner sees the same choices)
create table public.change_log (
  id bigint generated always as identity primary key, entity_type text, entity_id text, field text, old_value text, new_value text, changed_by text,
  changed_at timestamptz not null default now(), board_only boolean not null default false, visibility text, allowed_people jsonb
);
create table public.volunteer_profiles (
  id bigserial primary key, roles text[] not null default '{}'::text[], needs_review boolean not null default false, review_note text,
  created_at timestamptz not null default now(), quo_contact_id text, quo_synced_at timestamptz, car_type text, joined_note text, last_applied date
);
create table public.crm_contacts (
  id bigint generated always as identity primary key,
  full_name text not null, first_name text, last_name text,
  emails text[] not null default '{}'::text[], phones text[] not null default '{}'::text[], primary_email text generated always as (lower(nullif(btrim(emails[1]), ''::text))) stored,
  address text, city text, province text, postal_code text, country text, language text,
  kinds text[] not null default '{}'::text[], tags text[] not null default '{}'::text[], source text not null default 'manual'::text,
  volunteer_id bigint unique references public.volunteer_profiles(id) on delete set null, member_id bigint, auth_user_id uuid unique,
  legacy_refs jsonb not null default '{}'::jsonb,
  email_status text not null default 'unknown'::text check (email_status = any (array['unknown'::text, 'subscribed'::text, 'unsubscribed'::text, 'bounced'::text, 'complained'::text])),
  email_consent text check (email_consent = any (array['express'::text, 'implied'::text, 'none'::text])),
  consent_source text, consent_at timestamptz, implied_consent_until date, sms_opt_out boolean not null default false, notes text,
  owner_member_id bigint, last_activity_at timestamptz, merged_into bigint references public.crm_contacts(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by text, updated_by text,
  organization text, pronouns text, whatsapp_opt_out boolean not null default false, org_id bigint
);
create index crm_contacts_primary_email_idx on public.crm_contacts using btree (primary_email) where (merged_into is null);
create index crm_contacts_member_idx on public.crm_contacts using btree (member_id);
create index crm_contacts_kinds_idx on public.crm_contacts using gin (kinds);
create index crm_contacts_tags_idx on public.crm_contacts using gin (tags);
create index crm_contacts_emails_idx on public.crm_contacts using gin (emails);
create index crm_contacts_org_idx on public.crm_contacts using btree (org_id) where (org_id is not null);
revoke all on table public.crm_contacts from anon;
create table public.quo_messages (
  id bigint generated always as identity primary key, batch_id uuid not null, person_id bigint, phone text not null, body text not null,
  status text not null default 'dry_run'::text, error text, event_id bigint, sent_by text, created_at timestamptz not null default now(),
  direction text not null default 'out'::text, kind text not null default 'manual'::text, roster_id bigint, quo_id text, handled text, sent_at timestamptz,
  delivery text, delivery_at timestamptz
);
create unique index quo_messages_in_once on public.quo_messages using btree (quo_id) where ((direction = 'in'::text) and (quo_id is not null));
create index quo_messages_phone_idx on public.quo_messages using btree ("right"(regexp_replace(phone, '\D'::text, ''::text, 'g'::text), 10), created_at desc);
create table public.whatsapp_messages (
  id bigint generated always as identity primary key, batch_id uuid, person_id bigint, phone text not null, direction text not null default 'out'::text,
  kind text not null, template text, lang text, params jsonb not null default '[]'::jsonb, body text, status text not null default 'queued'::text, wamid text,
  error text, event_id bigint, roster_id bigint, pool_check_id bigint, quo_message_id bigint, sent_by text, handled text,
  created_at timestamptz not null default now(), sent_at timestamptz, delivered_at timestamptz, read_at timestamptz
);
create unique index whatsapp_messages_wamid_once on public.whatsapp_messages using btree (wamid) where (wamid is not null);
create index whatsapp_messages_phone_idx on public.whatsapp_messages using btree (phone, created_at desc);

-- 3. the two live functions, as pg_get_functiondef prints them on live (md5 c6c319d1... and 48dadf06...), with their live grants and comments
CREATE OR REPLACE FUNCTION public.wa171_digits(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case when length(regexp_replace(coalesce(p, ''), '\D', '', 'g')) >= 10 then right(regexp_replace(p, '\D', '', 'g'), 10) else null end;
$function$
;
revoke all on function public.wa171_digits(text) from public, anon, authenticated;
grant execute on function public.wa171_digits(text) to service_role;
comment on function public.wa171_digits(text) is 'wave171: a phone number''s last 10 digits (how every Hub table matches numbers), or null.';

CREATE OR REPLACE FUNCTION public.wa171_opted_out(p_person bigint, p_phone text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.crm_contacts c where c.sms_opt_out and c.merged_into is null
                 and (c.volunteer_id = p_person or exists (select 1 from unnest(c.phones) ph where public.wa171_digits(ph) = public.wa171_digits(p_phone))));
$function$
;
revoke all on function public.wa171_opted_out(bigint, text) from public, anon, authenticated;
grant execute on function public.wa171_opted_out(bigint, text) to service_role;
comment on function public.wa171_opted_out(bigint, text) is 'wave171: true when the volunteer (or anyone with that number) replied STOP or was marked no texts in the CRM (crm_contacts.sms_opt_out).';

-- 4. invented rows
-- 700 volunteers; 2,000 contacts, every third one a volunteer. Contact i's number is 555 and i in seven digits, written six ways (with +1 and spaces,
-- with brackets, with a leading 1, plain plus an extension that is not a number, with dots, or none at all). Contacts 25, 525, 1025 and 1525 hold
-- the number of the contact two before them, written another way. 20 contacts are marked no texts (i = 7 mod 160; 23, 523, 1023, 1523; 47, 87,
-- 207); 22 are merged into the contact before them (i = 5 mod 97 from 102, and the marked 47 and 87, so a merged marked contact must not count,
-- for its number or its volunteer). Live has none marked today; a few here test every case. About 300 pages, as live has.
insert into public.volunteer_profiles (review_note) select 'Test W291 volunteer ' || i from generate_series(1, 700) i;
insert into public.crm_contacts (full_name, phones, volunteer_id, sms_opt_out, notes, source)
select 'Test W291 Contact ' || i,
       case when i % 6 = 0 then '{}'::text[]
            when i % 6 = 1 then array['+1 555 ' || substr(d, 4, 3) || ' ' || substr(d, 7, 4)]
            when i % 6 = 2 then array['(' || substr(d, 1, 3) || ') ' || substr(d, 4, 3) || '-' || substr(d, 7, 4)]
            when i % 6 = 3 then array['1' || d]
            when i % 6 = 4 then array[d, 'ext 12']
            else array[substr(d, 1, 3) || '.' || substr(d, 4, 3) || '.' || substr(d, 7, 4)] end,
       case when i % 3 = 0 then i / 3 end,
       i % 160 = 7 or i % 500 = 23 or i in (47, 87, 207),
       repeat('Test notes. ', 75), 'manual'
  from (select i, '555' || lpad(case when i % 500 = 25 then i - 2 else i end::text, 7, '0') as d from generate_series(1, 2000) i) s
 order by i;
update public.crm_contacts set merged_into = id - 1 where id > 5 and (id % 97 = 5 or id in (47, 87));

-- texts: 3,000 sent, 200 questions, and the keyword texts: 555 999 0001 STOP (no contact holds it); contact 10's number STOP then START; contact 11's
-- number STOP (not marked in the CRM); 555 999 0004 START then STOP, written two ways; on WhatsApp, 555 999 0005 STOP (not an ops-line STOP)
insert into public.quo_messages (batch_id, phone, body, status, direction, kind, created_at)
select '00000000-0000-0000-0000-000000000291', '555' || lpad((i % 2000 + 1)::text, 7, '0'), 'Test reminder', 'sent', 'out', 'confirm', now() - make_interval(mins => i)
  from generate_series(1, 3000) i;
insert into public.quo_messages (batch_id, phone, body, status, direction, kind, quo_id, created_at)
select '00000000-0000-0000-0000-000000000291', '555' || lpad((i * 7 % 2000 + 1)::text, 7, '0'), 'Test question', 'received', 'in', 'reply', 'test-q-' || i, now() - make_interval(mins => i)
  from generate_series(1, 200) i;
insert into public.quo_messages (batch_id, phone, body, status, direction, kind, quo_id, handled, created_at) values
  ('00000000-0000-0000-0000-000000000291', '+1 555 999 0001', 'STOP', 'received', 'in', 'reply', 'test-k-1', 'opted_out', now() - interval '3 days'),
  ('00000000-0000-0000-0000-000000000291', '5550000010', 'STOP', 'received', 'in', 'reply', 'test-k-2', 'opted_out', now() - interval '3 days'),
  ('00000000-0000-0000-0000-000000000291', '(555) 000-0010', 'START', 'received', 'in', 'reply', 'test-k-3', 'opted_in', now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000291', '555.000.0011', 'STOP', 'received', 'in', 'reply', 'test-k-4', 'opted_out', now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000291', '+1 555 999 0004', 'START', 'received', 'in', 'reply', 'test-k-5', 'opted_in', now() - interval '3 days'),
  ('00000000-0000-0000-0000-000000000291', '15559990004', 'STOP', 'received', 'in', 'reply', 'test-k-6', 'opted_out', now() - interval '1 day');
insert into public.whatsapp_messages (phone, direction, kind, body, status, handled, created_at) values
  ('5559990005', 'in', 'reply', 'STOP', 'received', 'opted_out', now() - interval '1 day');
analyze;
