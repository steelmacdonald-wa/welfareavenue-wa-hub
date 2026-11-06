-- wave286: the slice of the live schema that build/data/wa286_vm_chapter.sql, its undo and the wave286 assertions touch, on top of test/w281schema.sql
-- and build/data/wa281_rules.sql, for the offline proof in test/w286sql.mjs (PGlite). Copied read-only from live (zwnmulmnvopclzcvytce) on 06/11/26:
-- the columns that matter and volunteer_event_summary's pg_get_viewdef text (test/w286sql.mjs checks its md5 against live). The live text of
-- wa191_recruit_pool and wa266f_email_drain is not repeated here: test/w286sql.mjs creates both from build/data/wa286_undo.sql, which holds it, and
-- checks each md5 against live. Functions the slice calls but never tests are stand-ins, and extensions.http is a stand-in that keeps each request
-- in public.w286_http_log instead of sending it. Every row in section 4 is invented (Test ..., example.invalid, 555 numbers).
-- Not a copy of live: do not apply it anywhere but the offline PGlite database.

-- 1. tables and columns (live columns; foreign keys only inside this slice)
alter table public.volunteer_events add column if not exists format text;
alter table public.volunteer_events add column if not exists start_time time without time zone not null default '12:00:00'::time without time zone;
alter table public.volunteer_events add column if not exists spot_counts jsonb;
create table public.volunteer_profiles (
  id bigint primary key, roles text[] not null default '{}'::text[], needs_review boolean not null default false, review_note text,
  created_at timestamptz not null default now(), quo_contact_id text, quo_synced_at timestamptz, car_type text, joined_note text, last_applied date
);
create table public.sop_event_steps (
  id bigserial primary key, event_id bigint not null, template_id text not null, done boolean not null default false, owner text, due_date date, note text,
  done_at timestamptz, done_by text, done_source text
);
create table public.sop_event_extras (
  id bigserial primary key, event_id bigint not null, title text not null, detail text, owner text, due_date date, done boolean not null default false, source text,
  transcript_id bigint, created_at timestamptz not null default now()
);
create table public.form_responses (
  response_id text primary key, form_id text not null, kind text not null, submitted_at timestamptz not null, respondent_email text, name text,
  answers jsonb not null default '[]'::jsonb, score numeric, max_score numeric, event_id bigint, member_id bigint, volunteer_id bigint, done jsonb, synced_at timestamptz not null default now()
);
create table public.volunteer_survey_responses (
  id bigserial primary key, roster_id bigint not null, event_id bigint not null, person_id bigint, role text not null, lang text, answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(), updated_at timestamptz
);

-- 2. volunteer_event_summary, as live has it (pg_get_viewdef text, security invoker, live comment and grants)
create view public.volunteer_event_summary with (security_invoker = on) as
 SELECT id,
    code,
    event_date,
    season,
    location,
    status,
    kind,
    COALESCE(title,
        CASE
            WHEN kind = 'service'::text THEN 'Sunday serving'::text
            ELSE initcap(kind)
        END) AS title,
    notes,
    ( SELECT count(*) AS count
           FROM event_roster r
          WHERE r.event_id = e.id) AS roster_count,
    ( SELECT count(*) AS count
           FROM event_roster r
          WHERE r.event_id = e.id AND r.status ~~* 'confirmed'::text) AS roster_confirmed,
    ( SELECT count(*) AS count
           FROM sop_event_steps s
          WHERE s.event_id = e.id) AS steps_total,
    ( SELECT count(*) AS count
           FROM sop_event_steps s
          WHERE s.event_id = e.id AND s.done) AS steps_done,
    ( SELECT count(*) AS count
           FROM sop_event_extras x
          WHERE x.event_id = e.id) AS extras_total,
    ( SELECT count(*) AS count
           FROM sop_event_extras x
          WHERE x.event_id = e.id AND NOT x.done) AS extras_open,
    format,
    ( SELECT count(*) AS count
           FROM event_roster r
          WHERE r.event_id = e.id AND r.confirm_status = 'confirmed'::text) AS roster_by_link,
    ( SELECT count(*) AS count
           FROM event_roster r
          WHERE r.event_id = e.id AND r.status ~~* 'unavailable'::text) AS roster_declined,
    ( SELECT count(DISTINCT q.roster_id) AS count
           FROM quo_messages q
          WHERE q.event_id = e.id AND q.direction = 'out'::text AND q.kind = 'confirm'::text AND q.status = 'sent'::text) AS roster_texted
   FROM volunteer_events e;
revoke all on table public.volunteer_event_summary from public, anon;
grant all on table public.volunteer_event_summary to authenticated, service_role;
comment on view public.volunteer_event_summary is 'One row per volunteering event with its roster and checklist counts (security invoker: staff read). wave171 adds format, roster_by_link (confirmed on the text link or by replying YES), roster_declined (Unavailable) and roster_texted (sent a confirmation text).';

-- 3. stand-ins: the http extension (requests kept, never sent) and the helpers the drain and Find volunteers call
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create type extensions.http_header as (field character varying, value character varying);
create type extensions.http_request as (method text, uri character varying, headers extensions.http_header[], content_type character varying, content character varying);
create type extensions.http_response as (status integer, content_type character varying, headers extensions.http_header[], content character varying);
create table public.w286_http_log (id bigserial primary key, uri text, content text);
create function extensions.http_header(field character varying, value character varying) returns extensions.http_header language sql immutable as
$$ select row(field, value)::extensions.http_header $$;
create function extensions.http_set_curlopt(curlopt character varying, value character varying) returns boolean language sql as $$ select true $$;
create function extensions.http(request extensions.http_request) returns extensions.http_response language plpgsql as $$
begin
  insert into public.w286_http_log (uri, content) values (request.uri, request.content);
  return row(200, 'application/json', null, '{"status": "sent"}')::extensions.http_response;
end $$;
create or replace function public.wa171_lang(p_person bigint) returns text language sql stable set search_path to '' as $$ select 'en'::text $$;
create or replace function public.wa171_role_label(p_role text, p_lang text) returns text language sql immutable set search_path to '' as
$$ select initcap(replace(coalesce(p_role, ''), '_', ' ')) $$;
create or replace function public.wa171_date_words(p_date date, p_lang text) returns text language sql immutable set search_path to '' as
$$ select to_char(p_date, 'FMDay FMDD FMMonth') $$;
create or replace function public.wa266f_email_words(p_body text) returns text language sql immutable set search_path to '' as $$ select p_body $$;
create or replace function public.get_secret(p_name text) returns text language sql stable set search_path to '' as $$ select 'w286-test-secret'::text $$;
create or replace function public.wa182_roster_email(p_roster bigint) returns jsonb language sql stable set search_path to '' as
$$ select jsonb_build_object('contact_id', (select c.id from public.event_roster r join public.crm_contacts c on c.volunteer_id = r.person_id where r.id = p_roster order by c.id limit 1)) $$;
create or replace function public.wa258_role_owner(p_role text) returns text language sql stable set search_path to '' as $$ select 'w286.owner@example.invalid'::text $$;
create or replace function public.wa191_sms_window() returns boolean language sql stable set search_path to '' as $$ select true $$;

-- 4. fixture rows (invented). Chapters: 8601 none (Montreal by the rule), 8602 Toronto, 8603 Toronto and do-not-contact (set in the assertions),
-- 8604 both, 8605 none until confirmed on the Toronto serving, 8606 none and do-not-contact (set in the assertions), 8607 a montreal row.
insert into public.hub_roles (email, role, profile) values ('w286.staff@example.invalid', 'member', null);
insert into public.volunteer_profiles (id, roles, last_applied) values
  (8601, '{server}', date '2026-06-01'), (8602, '{cook}', date '2026-06-02'), (8603, '{driver}', date '2026-06-03'), (8604, '{server}', date '2026-06-04'),
  (8605, '{server}', date '2026-06-05'), (8606, '{cook}', date '2026-06-06'), (8607, '{server}', date '2026-06-07');
insert into public.crm_contacts (id, full_name, first_name, volunteer_id, phones, kinds, emails) overriding system value values
  (8601, 'Test Montreal Only', 'Test', 8601, array['+15145558601'], '{volunteer}', array['w286.8601@example.invalid']),
  (8602, 'Test Toronto Volunteer', 'Test', 8602, array['+14165558602'], '{volunteer}', array['w286.8602@example.invalid']),
  (8603, 'Test Toronto Stopped', 'Test', 8603, array['+14165558603'], '{volunteer}', array['w286.8603@example.invalid']),
  (8604, 'Test Both Chapters', 'Test', 8604, array['+14165558604'], '{volunteer}', array['w286.8604@example.invalid']),
  (8605, 'Test Toronto Recruit', 'Test', 8605, array['+14165558605'], '{volunteer}', array['w286.8605@example.invalid']),
  (8606, 'Test Montreal Stopped', 'Test', 8606, array['+15145558606'], '{volunteer}', array['w286.8606@example.invalid']),
  (8607, 'Test Montreal Row', 'Test', 8607, array['+15145558607'], '{volunteer}', array['w286.8607@example.invalid']);
insert into public.crm_contact_chapters (contact_id, chapter, source, source_ref, added_by) values
  (8602, 'toronto', 'hand', 'test', 'w286'), (8603, 'toronto', 'hand', 'test', 'w286'), (8604, 'toronto', 'hand', 'test', 'w286'),
  (8604, 'montreal', 'evidence', 'serving', 'w286'), (8607, 'montreal', 'hand', 'test', 'w286');
insert into public.volunteer_events (id, code, event_date, status, location, title) values
  (8611, 'WA-26-861', date '2026-09-27', 'completed', 'Montreal', 'Test past serving'),
  (8612, 'WA-26-862', date '2026-12-13', 'planned', 'Toronto', 'Test Toronto serving'),
  (8613, 'WA-26-863', date '2026-12-20', 'planned', 'Montreal', 'Test Montreal serving');
insert into public.event_roster (id, event_id, person_id, person_name, role, status, confirm_token) values
  (8621, 8612, 8605, 'Test Toronto Recruit', 'server', 'Waiting For Response', 'w286tok8621aaaaaaaaa'),
  (8622, 8613, 8601, 'Test Montreal Only', 'server', 'Confirmed', 'w286tok8622aaaaaaaaa'),
  (8623, 8612, 8602, 'Test Toronto Volunteer', 'cook', 'Confirmed', 'w286tok8623aaaaaaaaa'),
  (8624, 8611, 8604, 'Test Both Chapters', 'server', 'Confirmed', 'w286tok8624aaaaaaaaa');
-- two confirmation texts that wait as email: one for the Toronto serving, one for the Montreal serving
insert into public.quo_messages (batch_id, person_id, phone, body, status, direction, kind, roster_id, event_id, delivery, created_at) values
  (gen_random_uuid(), 8602, '+14165558602', 'Test confirmation', 'sent', 'out', 'confirm', 8623, 8612, 'email_pending', '2026-11-01 12:00:00+00'),
  (gen_random_uuid(), 8601, '+15145558601', 'Test confirmation', 'sent', 'out', 'confirm', 8622, 8613, 'email_pending', '2026-11-01 12:00:01+00');
