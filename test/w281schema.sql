-- wave281: the slice of the live schema that build/data/wa281_rules.sql, its undo and the wave281 assertions touch, for the offline proof in
-- test/w281sql.mjs (PGlite). Copied read-only from live (zwnmulmnvopclzcvytce) on 06/11/26: column lists, constraints, policies and triggers that matter,
-- and in section 5 the pg_get_functiondef / pg_get_viewdef text of every live object wave281 changes (taken from build/data/wa281_undo.sql, which
-- holds the same text; test/w281sql.mjs checks each md5 against live). No foreign keys to tables outside this slice. volunteer_people is a view on
-- live; here it is a plain table with the columns the slice reads. Every row in section 6 is invented (Test ..., example.invalid, 555 numbers).
-- Not a copy of live: do not apply it anywhere but the offline PGlite database.

-- 1. roles and the Supabase defaults for new objects in public (tables and functions are open to the API roles until revoked)
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

-- 2. the auth helpers (claims come from the request.jwt.claims setting)
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;
create or replace function auth.jwt() returns jsonb language sql stable as
$$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create or replace function auth.role() returns text language sql stable as
$$ select nullif(auth.jwt() ->> 'role', '') $$;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
create or replace function auth.email() returns text language sql stable as
$$ select nullif(auth.jwt() ->> 'email', '') $$;
grant execute on function auth.jwt(), auth.role(), auth.uid(), auth.email() to anon, authenticated, service_role;

-- 3. tables (live columns; foreign keys only inside this slice)
create table public.app_config (key text primary key, value text, updated_at timestamptz default now());
create table public.change_log (
  id bigint generated always as identity primary key, entity_type text, entity_id text, field text, old_value text, new_value text, changed_by text,
  changed_at timestamptz not null default now(), board_only boolean not null default false, visibility text, allowed_people jsonb
);
create table public.hub_access_profiles (
  key text primary key, label text not null, tier text not null default 'member', team text, sort integer not null default 0, color text, summary text,
  lead_note text, can jsonb not null default '[]', pages jsonb not null default '{}', updated_by text, updated_at timestamptz not null default now()
);
create table public.hub_roles (
  email text primary key,
  role text not null default 'member' check (role = any (array['admin', 'leader', 'member', 'viewer', 'blocked'])),
  tabs jsonb, note text, updated_by text, updated_at timestamptz default now(),
  profile text references public.hub_access_profiles(key)
);
create table public.wa_hr_access (email text primary key);
create table public.board_viewers (email text primary key);
create table public.volunteer_people (   -- live: a view on volunteer_profiles
  id bigint primary key, full_name text, emails text[], phones text[], roles text[], address text, notes text, needs_review boolean, review_note text,
  created_at timestamptz, quo_contact_id text, quo_synced_at timestamptz, tags text[], organization text, car_type text, joined_note text, last_applied date, contact_id bigint
);
create table public.crm_contacts (
  id bigint generated always as identity primary key,
  full_name text not null, first_name text, last_name text,
  emails text[] not null default '{}'::text[], phones text[] not null default '{}'::text[], primary_email text,
  address text, city text, province text, postal_code text, country text, language text,
  kinds text[] not null default '{}'::text[], tags text[] not null default '{}'::text[], source text not null default 'manual'::text,
  volunteer_id bigint unique, member_id bigint, auth_user_id uuid unique, legacy_refs jsonb not null default '{}'::jsonb,
  email_status text not null default 'unknown'::text check (email_status = any (array['unknown'::text, 'subscribed'::text, 'unsubscribed'::text, 'bounced'::text, 'complained'::text])),
  email_consent text check (email_consent = any (array['express'::text, 'implied'::text, 'none'::text])),
  consent_source text, consent_at timestamptz, implied_consent_until date, sms_opt_out boolean not null default false, notes text,
  owner_member_id bigint, last_activity_at timestamptz, merged_into bigint references public.crm_contacts(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by text, updated_by text,
  organization text, pronouns text, whatsapp_opt_out boolean not null default false, org_id bigint
);
create table public.wa_partners (
  id bigint generated always as identity primary key, key text unique, name text not null, aka text[] not null default '{}'::text[], kind text, city text,
  relationship text not null default 'partner'::text, status text not null default 'past'::text check (status = any (array['active'::text, 'past'::text, 'prospect'::text, 'declined'::text])),
  first_year integer, last_year integer, summary text, contact_role text, website text,
  visibility text not null default 'everyone'::text check (visibility = any (array['everyone'::text, 'leadership'::text])),
  sources jsonb not null default '[]'::jsonb, notes text, created_by text, updated_by text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  category text not null default 'partner'::text check (category = any (array['partner'::text, 'collaborator'::text, 'sponsor'::text]))
);
create table public.crm_contact_orgs (
  id bigint generated always as identity primary key, contact_id bigint not null references public.crm_contacts(id) on delete cascade,
  partner_id bigint not null references public.wa_partners(id) on delete cascade, role_title text, is_primary boolean not null default false, notes text,
  created_at timestamptz not null default now(), created_by text
);
create table public.crm_donations (
  id bigint generated always as identity primary key, contact_id bigint references public.crm_contacts(id) on delete set null, amount numeric not null check (amount >= 0),
  currency text not null default 'CAD'::text, donated_at timestamptz not null, platform text not null default 'other'::text, campaign text, designation text, external_id text,
  recurring boolean not null default false, fee numeric, net_amount numeric, receipt_eligible boolean, receipt_number text, receipt_issued_at timestamptz, receipt_url text,
  receipt_source text, finance_transaction_id bigint, notes text, raw jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by text, kind text not null default 'donation'::text, method text, advantage_amount numeric not null default 0, advantage_desc text, in_kind_desc text,
  appraiser text, tribute_kind text, tribute_name text, updated_by text, refunded_amount numeric not null default 0, refunded_at timestamptz, plan_id bigint
);
create table public.volunteer_events (
  id bigserial primary key, code text, event_date date not null, season text, location text, notes text, status text not null default 'planned'::text,
  created_at timestamptz not null default now(), kind text not null default 'service'::text, title text
);
create table public.event_roster (
  id bigserial primary key, event_id bigint not null references public.volunteer_events(id) on delete cascade, person_id bigint, person_name text, role text not null,
  status text, notes text, detail jsonb not null default '{}'::jsonb, sort integer not null default 0,
  confirm_token text default substr(md5(((gen_random_uuid())::text || (clock_timestamp())::text)), 1, 20), confirm_status text, confirmed_at timestamptz, confirm jsonb,
  recipe_id bigint, created_at timestamptz default now(), signup_noticed_at timestamptz
);
create table public.crm_volunteer_history (
  id bigint generated always as identity primary key, contact_id bigint references public.crm_contacts(id) on delete set null, volunteer_id bigint,
  source text not null default 'django'::text, legacy_assignment_id bigint, legacy_event_id bigint, legacy_volunteer_id bigint, event_at timestamptz, event_title text,
  city text, location text, position text, approved boolean, confirmed boolean, attended boolean, hours numeric, withdrawn boolean, waitlisted boolean,
  imported_at timestamptz not null default now(), volunteer_event_id bigint
);
create table public.crm_forms (
  id bigint generated always as identity primary key, slug text not null unique, title text not null, intro text, lang text not null default 'en'::text,
  kind text not null default 'general'::text, status text not null default 'draft'::text, questions jsonb not null default '[]'::jsonb, consent jsonb not null default '{}'::jsonb,
  thank_you text, settings jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), created_by text, updated_at timestamptz not null default now(),
  updated_by text, published_at timestamptz, published_by text, closed_at timestamptz, cover_photo_id bigint, purpose text not null default 'other'::text
);
create table public.crm_form_submissions (
  id bigint generated always as identity primary key, form_id bigint not null references public.crm_forms(id) on delete cascade,
  contact_id bigint references public.crm_contacts(id) on delete set null, status text not null default 'received'::text, answers jsonb not null default '{}'::jsonb,
  display jsonb not null default '[]'::jsonb, mapped jsonb not null default '{}'::jsonb, consent jsonb, result jsonb not null default '{}'::jsonb, lang text, ip_hash text,
  user_agent text, is_test boolean not null default false, error text, created_at timestamptz not null default now(), processed_at timestamptz, auth_user_id uuid
);
create table public.volunteer_applications (
  id bigserial primary key, person_id bigint, contact_id bigint references public.crm_contacts(id) on delete set null, name text not null, email text, phone text,
  roles text[] not null default '{}'::text[], role_text text, source text not null default 'manual'::text, source_ref text, applied_at timestamptz not null default now(),
  message text, status text not null default 'received'::text, created_at timestamptz not null default now(), created_by text
);
create table public.crm_fields (
  id bigint generated always as identity primary key, key text not null unique check (key ~ '^[a-z][a-z0-9_]{1,40}$'::text),
  label text not null check (length(label) >= 1 and length(label) <= 120),
  type text not null default 'text'::text check (type = any (array['text'::text, 'long_text'::text, 'number'::text, 'date'::text, 'choice'::text, 'multi'::text, 'yes_no'::text])),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'::text), help text, sort integer not null default 100, archived_at timestamptz,
  created_at timestamptz not null default now(), created_by text, updated_at timestamptz not null default now(), updated_by text
);
create table public.crm_contact_fields (
  contact_id bigint not null references public.crm_contacts(id) on delete cascade, field_id bigint not null references public.crm_fields(id) on delete cascade,
  value jsonb not null, source text, updated_at timestamptz not null default now(), updated_by text, primary key (contact_id, field_id)
);
create table public.crm_interactions (
  id bigint generated always as identity primary key, contact_id bigint not null references public.crm_contacts(id) on delete cascade, kind text not null, direction text,
  channel text, subject text, body text, occurred_at timestamptz not null default now(), source text not null default 'manual'::text, source_ref text,
  meta jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), created_by text
);
create table public.crm_email_sends (
  id bigserial primary key, contact_id bigint references public.crm_contacts(id) on delete set null, to_email text not null, template_key text, kind text not null,
  subject text, status text not null default 'queued'::text, is_test boolean not null default false, created_at timestamptz not null default now(), campaign_id bigint
);
create table public.crm_automation_runs (
  id bigint generated always as identity primary key, automation_id bigint not null, contact_id bigint not null references public.crm_contacts(id) on delete cascade,
  run_key text not null default 'once'::text, status text not null default 'active'::text
);
create table public.crm_dupe_dismissals (a_id bigint not null, b_id bigint not null, dismissed_by text, dismissed_at timestamptz not null default now());
create table public.quo_messages (
  id bigint generated always as identity primary key, batch_id uuid not null, person_id bigint, phone text not null, body text not null,
  status text not null default 'dry_run'::text, error text, event_id bigint, sent_by text, created_at timestamptz not null default now(),
  direction text not null default 'out'::text, kind text not null default 'manual'::text, roster_id bigint, quo_id text, handled text, sent_at timestamptz,
  delivery text, delivery_at timestamptz
);
create unique index quo_messages_in_once on public.quo_messages using btree (quo_id) where ((direction = 'in'::text) and (quo_id is not null));
create table public.whatsapp_messages (
  id bigint generated always as identity primary key, batch_id uuid, person_id bigint, phone text not null, direction text not null default 'out'::text,
  kind text not null, template text, lang text, params jsonb not null default '[]'::jsonb, body text, status text not null default 'queued'::text, wamid text,
  error text, event_id bigint, roster_id bigint, pool_check_id bigint, quo_message_id bigint, sent_by text, handled text,
  created_at timestamptz not null default now(), sent_at timestamptz, delivered_at timestamptz, read_at timestamptz
);
create unique index whatsapp_messages_wamid_once on public.whatsapp_messages using btree (wamid) where (wamid is not null);
create table public.volunteer_pool_checks (id bigserial primary key, phone text, token text, answer text, created_at timestamptz not null default now());

-- 4. the helpers (live text, 06/11/26) and stand-ins for functions the slice never runs
create or replace function public.is_wa_staff() returns boolean language sql stable security definer set search_path to '' as $function$
  select case
    when lower(coalesce(auth.jwt()->>'email','')) = '' then false
    when exists (select 1 from public.hub_roles r
                 where r.email = lower(coalesce(auth.jwt()->>'email','')) and r.role = 'blocked') then false
    when exists (select 1 from public.hub_roles r
                 where r.email = lower(coalesce(auth.jwt()->>'email',''))
                   and r.role in ('admin','leader','member','viewer')) then true
    else coalesce(lower(auth.jwt()->>'email') like '%@welfareavenue.com', false)
  end;
$function$;
create or replace function public.wa_is_hr() returns boolean language sql stable security definer set search_path to 'public' as
$function$ select exists (select 1 from wa_hr_access where email = lower(coalesce(auth.jwt() ->> 'email', ''))) $function$;
create or replace function public.is_wa_leader() returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from public.hub_roles r where r.email = lower(coalesce(auth.jwt()->>'email', '')) and r.role in ('admin', 'leader'));
$function$;
create or replace function public.is_wa_admin() returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from public.hub_roles r where r.email = lower(coalesce(auth.jwt()->>'email', '')) and r.role = 'admin');
$function$;
create or replace function public.is_hub_admin() returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from public.hub_roles where email = lower(coalesce(auth.jwt() ->> 'email', '')) and role = 'admin')
$function$;
create or replace function public.is_hub_leader() returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from public.hub_roles r where r.email = lower(coalesce(auth.jwt()->>'email','')) and r.role in ('admin','leader'));
$function$;
create or replace function public.is_board_viewer() returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from public.board_viewers b where lower(b.email) = lower(coalesce(auth.jwt()->>'email','')));
$function$;
create or replace function public.wa_email() returns text language sql stable security definer set search_path to '' as
$function$ select lower(coalesce(auth.jwt()->>'email','')) $function$;
create or replace function public.wa_page_ok(p_tab text) returns boolean language sql stable security definer set search_path to '' as $function$
  select case
    when public.wa_email() = '' then false
    when r.email is null then null
    when r.role = 'blocked' then false
    when r.role = 'admin' then true
    when jsonb_typeof(r.tabs) = 'array' and jsonb_array_length(r.tabs) > 0 then null
    when p.key is null then null
    when (case r.role when 'viewer' then 0 when 'member' then 1 when 'leader' then 2 when 'admin' then 3 else -1 end)
       < (case p.tier when 'viewer' then 0 when 'member' then 1 when 'leader' then 2 when 'admin' then 3 else 9 end) then null
    when (p.pages -> p_tab) is null then null
    else case p.pages ->> p_tab when 'all' then true when 'lead' then r.role in ('leader', 'admin') else false end
  end
  from (select 1) one
  left join public.hub_roles r on r.email = public.wa_email()
  left join public.hub_access_profiles p on p.key = r.profile;
$function$;
create or replace function public.wa171_digits(p text) returns text language sql immutable set search_path to '' as $function$
  select case when length(regexp_replace(coalesce(p, ''), '\D', '', 'g')) >= 10 then right(regexp_replace(p, '\D', '', 'g'), 10) else null end;
$function$;
revoke all on function public.wa171_digits(text) from public, anon, authenticated;   -- as live: postgres and service_role only
create or replace function public.wa171_test_phone(p_phone text) returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from public.app_config c, unnest(string_to_array(c.value, ',')) t(x)
                 where c.key = 'sms_test_phones' and public.wa171_digits(t.x) = public.wa171_digits(p_phone));
$function$;
create or replace function public.crm_touch() returns trigger language plpgsql set search_path to '' as
$function$ begin new.updated_at := now(); return new; end $function$;
create trigger crm_contacts_touch before update on public.crm_contacts for each row execute function public.crm_touch();
create trigger crm_donations_touch before update on public.crm_donations for each row execute function public.crm_touch();
create or replace function public.volunteer_merge(p_keep bigint, p_drop bigint) returns jsonb language sql as $function$ select '{"stand_in": true}'::jsonb $function$;   -- stand-in

-- row security as live on the tables the assertions reach as a signed-in user
alter table public.hub_roles enable row level security;
create policy hub_roles_admin_write on public.hub_roles for all to authenticated using (public.is_hub_admin()) with check (public.is_hub_admin());
create policy hub_roles_read on public.hub_roles for select to authenticated using ((public.is_wa_staff() or public.is_board_viewer()));
create policy hub_roles_self_member on public.hub_roles for insert to authenticated with check ((email = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (email ~~ '%@welfareavenue.com'::text) AND (role = 'member'::text) AND (profile IS NULL) AND (tabs IS NULL));
alter table public.app_config enable row level security;
create policy wa_staff_all_app_config on public.app_config for all to authenticated using (( select public.is_wa_staff() as is_wa_staff)) with check (( select public.is_wa_staff() as is_wa_staff));
alter table public.wa_partners enable row level security;
create policy wa_partners_read on public.wa_partners for select to authenticated using ((public.is_hub_leader() or public.is_board_viewer() or (public.is_wa_staff() and (visibility = 'everyone'::text))));
create policy wa_partners_write on public.wa_partners for all to authenticated using (public.is_hub_leader()) with check (public.is_hub_leader());
alter table public.crm_contacts enable row level security;
create policy crm_contacts_staff_read on public.crm_contacts for select to authenticated using ((public.is_wa_staff() and coalesce(public.wa_page_ok('crm'::text), true)));
create policy crm_contacts_staff_update on public.crm_contacts for update to authenticated using ((public.is_wa_staff() and coalesce(public.wa_page_ok('crm'::text), true))) with check ((public.is_wa_staff() and coalesce(public.wa_page_ok('crm'::text), true)));
create policy crm_contacts_admin_delete on public.crm_contacts for delete to authenticated using (public.is_wa_admin());

-- 5. the live objects wave281 changes, exactly as live has them (generated from build/data/wa281_undo.sql sections 1 and 3)

CREATE OR REPLACE FUNCTION public.crm_merge_contacts(p_keep bigint, p_drop bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  k public.crm_contacts%rowtype;
  d public.crm_contacts%rowtype;
  n_int int := 0; n_gift int := 0; n_hist int := 0; n_org int := 0;
  vol jsonb := null;
  who text := lower(coalesce(auth.jwt() ->> 'email', 'staff'));
begin
  if not (public.is_wa_staff() and (coalesce(public.wa_page_ok('crm'), true) or coalesce(current_setting('wa.merge_from_volunteers', true), '') = 'on')) then raise exception 'not allowed'; end if;
  if p_keep = p_drop then raise exception 'same contact'; end if;
  select * into k from public.crm_contacts where id = p_keep and merged_into is null;
  if not found then raise exception 'contact % is not in the CRM', p_keep; end if;
  select * into d from public.crm_contacts where id = p_drop and merged_into is null;
  if not found then raise exception 'contact % is not in the CRM', p_drop; end if;

  update public.crm_interactions set contact_id = p_keep where contact_id = p_drop; get diagnostics n_int = row_count;
  update public.crm_donations set contact_id = p_keep where contact_id = p_drop; get diagnostics n_gift = row_count;
  update public.crm_volunteer_history set contact_id = p_keep where contact_id = p_drop; get diagnostics n_hist = row_count;
  delete from public.crm_contact_orgs o where o.contact_id = p_drop
    and exists (select 1 from public.crm_contact_orgs x where x.contact_id = p_keep and x.partner_id = o.partner_id);
  update public.crm_contact_orgs set contact_id = p_keep where contact_id = p_drop; get diagnostics n_org = row_count;
  delete from public.crm_contact_fields cf where cf.contact_id = p_drop and exists (select 1 from public.crm_contact_fields x where x.contact_id = p_keep and x.field_id = cf.field_id);
  update public.crm_contact_fields set contact_id = p_keep where contact_id = p_drop;
  update public.crm_form_submissions set contact_id = p_keep where contact_id = p_drop;
  update public.crm_email_sends set contact_id = p_keep where contact_id = p_drop;
  delete from public.crm_automation_runs ar where ar.contact_id = p_drop and exists (select 1 from public.crm_automation_runs x where x.contact_id = p_keep and x.automation_id = ar.automation_id and x.run_key = ar.run_key);
  update public.crm_automation_runs set contact_id = p_keep where contact_id = p_drop;
  delete from public.crm_dupe_dismissals where a_id in (p_keep, p_drop) or b_id in (p_keep, p_drop);

  update public.crm_contacts set volunteer_id = null, member_id = null, auth_user_id = null where id = p_drop;

  update public.crm_contacts set
    emails = coalesce((select array_agg(x order by ord) from (select distinct on (lower(btrim(x))) btrim(x) as x, ord from unnest(coalesce(k.emails, '{}') || coalesce(d.emails, '{}')) with ordinality as t(x, ord) where btrim(coalesce(x, '')) <> '' order by lower(btrim(x)), ord) s), '{}'),
    phones = coalesce((select array_agg(x order by ord) from (select distinct on (btrim(x)) btrim(x) as x, ord from unnest(coalesce(k.phones, '{}') || coalesce(d.phones, '{}')) with ordinality as t(x, ord) where btrim(coalesce(x, '')) <> '' order by btrim(x), ord) s), '{}'),
    tags = coalesce((select array_agg(x order by ord) from (select distinct on (lower(btrim(x))) btrim(x) as x, ord from unnest(coalesce(k.tags, '{}') || coalesce(d.tags, '{}')) with ordinality as t(x, ord) where btrim(coalesce(x, '')) <> '' order by lower(btrim(x)), ord) s), '{}'),
    kinds = coalesce((select array_agg(x order by ord) from (select distinct on (x) x, ord from unnest(coalesce(k.kinds, '{}') || coalesce(d.kinds, '{}')) with ordinality as t(x, ord) where btrim(coalesce(x, '')) <> '' order by x, ord) s), '{}'),
    first_name = coalesce(nullif(k.first_name, ''), d.first_name),
    last_name = coalesce(nullif(k.last_name, ''), d.last_name),
    address = coalesce(nullif(k.address, ''), d.address),
    city = coalesce(nullif(k.city, ''), d.city),
    province = coalesce(nullif(k.province, ''), d.province),
    postal_code = coalesce(nullif(k.postal_code, ''), d.postal_code),
    country = coalesce(nullif(k.country, ''), d.country),
    language = coalesce(nullif(k.language, ''), d.language),
    email_status = case when k.email_status in ('unsubscribed', 'complained', 'bounced') then k.email_status
                        when d.email_status in ('unsubscribed', 'complained', 'bounced') then d.email_status else k.email_status end,
    email_consent = case when 'express' in (k.email_consent, d.email_consent) then 'express'
                         when 'implied' in (k.email_consent, d.email_consent) then 'implied' else coalesce(k.email_consent, d.email_consent) end,
    consent_source = case when k.email_consent = 'express' then k.consent_source when d.email_consent = 'express' then d.consent_source else coalesce(k.consent_source, d.consent_source) end,
    consent_at = greatest(k.consent_at, d.consent_at),
    implied_consent_until = greatest(k.implied_consent_until, d.implied_consent_until),
    sms_opt_out = coalesce(k.sms_opt_out, false) or coalesce(d.sms_opt_out, false),
    notes = case when coalesce(d.notes, '') = '' then k.notes when coalesce(k.notes, '') = '' then d.notes else k.notes || E'\n' || d.notes end,
    legacy_refs = coalesce(k.legacy_refs, '{}'::jsonb) || coalesce(d.legacy_refs, '{}'::jsonb) || jsonb_build_object('merged_contact_ids', coalesce(k.legacy_refs -> 'merged_contact_ids', '[]'::jsonb) || to_jsonb(p_drop)),
    member_id = coalesce(k.member_id, d.member_id),
    auth_user_id = coalesce(k.auth_user_id, d.auth_user_id),
    owner_member_id = coalesce(k.owner_member_id, d.owner_member_id),
    last_activity_at = greatest(k.last_activity_at, d.last_activity_at),
    volunteer_id = coalesce(k.volunteer_id, d.volunteer_id),
    updated_by = who
  where id = p_keep;

  if k.volunteer_id is not null and d.volunteer_id is not null and k.volunteer_id <> d.volunteer_id then
    vol := public.volunteer_merge(k.volunteer_id, d.volunteer_id);
  end if;

  update public.crm_contacts set merged_into = p_keep, updated_by = who where id = p_drop;
  begin
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('crm_contact', p_keep::text, 'merged', d.full_name || ' (#' || p_drop || ')', k.full_name || ' (+' || (n_int + n_gift + n_hist + n_org) || ' rows of history)', who);
  exception when others then null; end;
  return jsonb_build_object('ok', true, 'keep', p_keep, 'drop', p_drop, 'interactions', n_int, 'donations', n_gift, 'history', n_hist, 'organizations', n_org, 'volunteers', vol);
end $function$
;
revoke all on function public.crm_merge_contacts(bigint, bigint) from public, anon;
grant execute on function public.crm_merge_contacts(bigint, bigint) to authenticated, service_role;
  comment on function public.crm_merge_contacts(bigint, bigint) is 'Keep one contact and merge the other into it: the history, gifts, old website history and organizations move, the lists join up, the copy fills the gaps in the details, two volunteer records become one (volunteer_merge). Staff with the CRM page; logged in change_log.';

CREATE OR REPLACE FUNCTION public.wa_app_config_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare k text := coalesce(new.key, old.key);
begin
  if (k like 'mail\_%' or k like 'receipt\_%' or k like 'donate\_%' or k like 'loom\_%' or k like 'sms\_%' or k like 'cert\_%'
      or k in ('dashboard_people', 'page_gate', 'page_gate_exempt', 'page_gate_map'))
     and coalesce(auth.role(), '') = 'authenticated' and not coalesce(public.is_wa_admin(), false) then
    raise exception 'Only an admin can change % (email, receipt, donation page, Loom pull, text, certificate, Dashboard and page tour settings).', k;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $function$
;
revoke all on function public.wa_app_config_guard() from public, anon, authenticated;
grant execute on function public.wa_app_config_guard() to service_role;
  comment on function public.wa_app_config_guard() is 'Trigger on app_config: only admins (or the service role) change the mail_, receipt_, donate_, loom_, sms_ and cert_ settings and, since wave260, dashboard_people, page_gate, page_gate_exempt and page_gate_map. Other staff keep their existing app_config rights.';

CREATE OR REPLACE FUNCTION public.wa171_inbound(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_phone text; v_text text; v_word text; v_mode text; v_pid bigint; v_row record; v_id bigint; v_handled text; v_lang text; v_first text; v_reply text; v_act boolean;
begin
  v_phone := public.wa171_digits(p->>'phone');
  v_text := left(coalesce(p->>'text', ''), 2000);
  if v_phone is null then return jsonb_build_object('handled', 'ignored'); end if;
  v_mode := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  -- the volunteer: the person with that number who has the nearest upcoming serving, else anyone with it
  select r.id as roster_id, r.person_id, r.person_name, r.event_id, r.status, r.confirm_status, r.confirm_token, e.event_date into v_row
    from public.event_roster r join public.volunteer_events e on e.id = r.event_id
    join public.volunteer_people vp on vp.id = r.person_id
   where exists (select 1 from unnest(vp.phones) ph where public.wa171_digits(ph) = v_phone)
     and e.kind = 'service' and e.status not in ('cancelled', 'completed') and e.event_date >= (now() at time zone 'America/Toronto')::date
     and lower(coalesce(r.status, '')) <> 'cancelled'
   order by (r.confirm_status is null and lower(coalesce(r.status, '')) not in ('confirmed', 'unavailable') and exists (select 1 from public.quo_messages q where q.roster_id = r.id and q.kind in ('confirm', 'recruit') and q.status = 'sent')) desc, (exists (select 1 from public.quo_messages q where q.roster_id = r.id and q.kind in ('confirm', 'recruit') and q.status = 'sent')) desc, e.event_date, r.id
   limit 1;
  v_pid := v_row.person_id;
  if v_pid is null then
    select vp.id into v_pid from public.volunteer_people vp where exists (select 1 from unnest(vp.phones) ph where public.wa171_digits(ph) = v_phone) order by vp.id limit 1;
  end if;
  insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id, quo_id, created_at)
  values (gen_random_uuid(), v_pid, '+1' || v_phone, v_text, 'received', v_row.event_id, 'quo-events', 'in', 'inbound', v_row.roster_id,
          nullif(p->>'quo_id', ''), coalesce((p->>'at')::timestamptz, now()))
  on conflict do nothing returning id into v_id;
  if v_id is null then return jsonb_build_object('handled', 'duplicate'); end if;

  v_act := v_mode = 'live' or (v_mode = 'test' and public.wa171_test_phone(v_phone));
  v_word := upper(regexp_replace(split_part(trim(v_text), ' ', 1), '[^[:alpha:]]', '', 'g'));
  v_word := translate(v_word, 'ÊÉÈË', 'EEEE');
  if v_word in ('STOP', 'STOPALL', 'ARRET', 'ARRETER', 'UNSUBSCRIBE', 'DESABONNER', 'END', 'QUIT', 'CANCEL') then
    -- an opt-out is always honoured, whatever the mode
    update public.crm_contacts c set sms_opt_out = true, updated_at = now()
     where c.merged_into is null and (c.volunteer_id = v_pid or exists (select 1 from unnest(c.phones) ph where public.wa171_digits(ph) = v_phone));
    v_handled := 'opted_out';
  elsif not v_act then
    v_handled := case when v_pid is null then 'unmatched' else 'stored' end;
  elsif v_word in ('START', 'UNSTOP') then
    update public.crm_contacts c set sms_opt_out = false, updated_at = now()
     where c.merged_into is null and (c.volunteer_id = v_pid or exists (select 1 from unnest(c.phones) ph where public.wa171_digits(ph) = v_phone));
    v_handled := 'opted_in';
  elsif v_word in ('YES', 'Y', 'YEP', 'YEAH', 'OUI', 'O', 'CONFIRM', 'CONFIRMED', 'CONFIRME', 'CONFIRMEE', 'OK', 'OKAY') and v_row.roster_id is not null then
    perform public.volunteer_confirm_submit(v_row.confirm_token, jsonb_build_object('attending', 'yes', 'via', 'reply'))
      where v_row.confirm_token is not null;
    if v_row.confirm_token is null then
      update public.event_roster set status = 'Confirmed', confirm_status = 'confirmed', confirmed_at = now(), confirm = coalesce(confirm, '{}'::jsonb) || jsonb_build_object('attending', 'yes', 'via', 'reply', 'at', now()) where id = v_row.roster_id;
    end if;
    v_handled := 'confirmed';
  elsif v_word in ('NO', 'N', 'NON', 'NOPE') and v_row.roster_id is not null then
    if v_row.confirm_token is not null then
      perform public.volunteer_confirm_submit(v_row.confirm_token, jsonb_build_object('attending', 'no', 'via', 'reply'));
    else
      update public.event_roster set status = 'Unavailable', confirm_status = 'declined', confirmed_at = now(), confirm = coalesce(confirm, '{}'::jsonb) || jsonb_build_object('attending', 'no', 'via', 'reply', 'at', now()) where id = v_row.roster_id;
    end if;
    v_handled := 'declined';
  elsif v_word in ('YES', 'Y', 'YEP', 'YEAH', 'OUI', 'O', 'OK', 'OKAY', 'NO', 'N', 'NON', 'NOPE') and v_row.roster_id is null
        and exists (select 1 from public.volunteer_pool_checks c where c.phone = '+1' || v_phone and c.answer is null and c.created_at > now() - interval '30 days') then
    -- wave239: a "Still in?" text answered by a reply
    perform public.wa239_pool_answer((select c.token from public.volunteer_pool_checks c where c.phone = '+1' || v_phone and c.answer is null order by c.created_at desc limit 1),
                                     jsonb_build_object('answer', case when v_word in ('NO', 'N', 'NON', 'NOPE') then 'no' else 'yes' end, 'via', 'reply'));
    v_handled := case when v_word in ('NO', 'N', 'NON', 'NOPE') then 'pool_no' else 'pool_yes' end;
  elsif v_pid is null then
    v_handled := 'unmatched';
  else
    v_handled := 'question';
  end if;
  update public.quo_messages set handled = v_handled where id = v_id;

  if v_handled in ('pool_yes', 'pool_no') then
    v_lang := public.wa171_lang(v_pid);
    v_first := nullif(split_part(trim(coalesce((select vp.full_name from public.volunteer_people vp where vp.id = v_pid), '')), ' ', 1), '');
    if v_handled = 'pool_yes' then
      v_reply := case when v_lang = 'fr' then 'Formidable, merci' || coalesce(' ' || v_first, '') || '! Nous vous écrirons pour les prochains services. Welfare Avenue'
                 else 'Wonderful, thanks' || coalesce(' ' || v_first, '') || '! We''ll be in touch about the next servings. Welfare Avenue' end;
    else
      v_reply := case when v_lang = 'fr' then 'Merci de nous l''avoir dit' || coalesce(', ' || v_first, '') || '. La porte reste ouverte. Welfare Avenue'
                 else 'Thanks for letting us know' || coalesce(', ' || v_first, '') || '. You''re welcome back any time. Welfare Avenue' end;
    end if;
    insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id)
    values (gen_random_uuid(), v_pid, '+1' || v_phone, v_reply, 'queued', null, 'quo-events', 'out', 'ack', null);
  end if;
  if v_handled in ('confirmed', 'declined') then
    v_lang := public.wa171_lang(v_pid);
    v_first := nullif(split_part(trim(coalesce(v_row.person_name, '')), ' ', 1), '');
    if v_handled = 'confirmed' then
      v_reply := case when v_lang = 'fr' then 'Merci' || coalesce(' ' || v_first, '') || ', c''est confirmé pour le ' || public.wa171_date_words(v_row.event_date, 'fr') || '. À bientôt! Welfare Avenue'
                 else 'Thanks' || coalesce(' ' || v_first, '') || ', you''re confirmed for ' || public.wa171_date_words(v_row.event_date, 'en') || '. See you there! Welfare Avenue' end;
    else
      v_reply := case when v_lang = 'fr' then 'Merci de nous avoir prévenus' || coalesce(', ' || v_first, '') || '. Au plaisir de vous voir à un autre service! Welfare Avenue'
                 else 'Thanks for letting us know' || coalesce(', ' || v_first, '') || '. We hope to see you at another serving! Welfare Avenue' end;
    end if;
    insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id)
    values (gen_random_uuid(), v_pid, '+1' || v_phone, v_reply, 'queued', v_row.event_id, 'quo-events', 'out', 'ack', v_row.roster_id);
  end if;
  return jsonb_build_object('handled', v_handled, 'message_id', v_id, 'roster_id', v_row.roster_id, 'ack', v_reply is not null);
end $function$
;
revoke all on function public.wa171_inbound(jsonb) from public, anon, authenticated;
grant execute on function public.wa171_inbound(jsonb) to service_role;
  comment on function public.wa171_inbound(jsonb) is 'wave171: files an incoming text ({phone, text, quo_id, at}) in quo_messages (direction in, once per quo_id) matched to the volunteer and their next serving, then acts on keywords: STOP/ARRET always sets crm_contacts.sms_opt_out; while sms_mode is live (or test, for the test phones) YES/OUI confirms the roster row, NO/NON marks it Unavailable (both queue a short thank-you, kind ack), START opts back in; anything else is a question for the team (wave169b). Service role only (quo-events).';

CREATE OR REPLACE FUNCTION public.wa254_inbound(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_phone text; v_digits text; v_text text; v_word text; v_mode text; v_act boolean; v_last record; v_pid bigint; v_id bigint; v_handled text;
        v_lang text; v_first text; v_reply text; v_tok text; v_btn text;
begin
  if not (session_user <> 'authenticator' or coalesce(auth.role(), '') = 'service_role') then raise exception 'not allowed'; end if;
  v_digits := public.wa171_digits(p->>'phone');
  if v_digits is null then return jsonb_build_object('handled', 'ignored'); end if;
  v_phone := '+1' || v_digits;
  v_text := left(coalesce(nullif(p->>'text', ''), p->>'button', ''), 2000);
  v_btn := lower(coalesce(p->>'button', ''));
  v_mode := coalesce((select value from public.app_config where key = 'sms_whatsapp_mode'), 'off');
  v_act := v_mode = 'live' or (v_mode = 'test' and exists (select 1 from public.app_config c, unnest(string_to_array(c.value, ',')) t(x)
                                                           where c.key = 'sms_whatsapp_test_phones' and public.wa171_digits(t.x) = v_digits));
  select w.* into v_last from public.whatsapp_messages w
   where w.direction = 'out' and w.kind in ('confirm', 'reconfirm') and w.status in ('sent', 'delivered', 'read')
     and public.wa171_digits(w.phone) = v_digits and w.created_at > now() - interval '14 days'
   order by w.created_at desc limit 1;
  v_pid := coalesce(v_last.person_id, (select vp.id from public.volunteer_people vp where exists (select 1 from unnest(vp.phones) ph where public.wa171_digits(ph) = v_digits) order by vp.id limit 1));
  insert into public.whatsapp_messages (person_id, phone, direction, kind, body, status, wamid, event_id, roster_id, pool_check_id, sent_by, created_at)
  values (v_pid, v_phone, 'in', 'inbound', v_text, 'received', nullif(p->>'wamid', ''), v_last.event_id, v_last.roster_id, v_last.pool_check_id, 'whatsapp', coalesce((p->>'at')::timestamptz, now()))
  on conflict do nothing returning id into v_id;
  if v_id is null then return jsonb_build_object('handled', 'duplicate'); end if;

  v_word := upper(regexp_replace(split_part(trim(v_text), ' ', 1), '[^[:alpha:]]', '', 'g'));
  v_word := translate(v_word, 'ÊÉÈË', 'EEEE');
  if v_btn <> '' then
    v_word := case when v_btn ~ '(yes|oui|count me in|comptez|be there|serai)' then 'YES' when v_btn ~ '(can''t|cannot|not any more|plus maintenant|ne peux|no$|non$)' then 'NO' else v_word end;
  end if;
  if v_word in ('STOP', 'STOPALL', 'ARRET', 'ARRETER', 'UNSUBSCRIBE', 'DESABONNER') then
    update public.crm_contacts c set whatsapp_opt_out = true, updated_at = now()
     where c.merged_into is null and (c.volunteer_id = v_pid or exists (select 1 from unnest(c.phones) ph where public.wa171_digits(ph) = v_digits));
    v_handled := 'opted_out';
  elsif not v_act then
    v_handled := case when v_pid is null then 'unmatched' else 'stored' end;
  elsif v_word in ('YES', 'Y', 'YEP', 'YEAH', 'OUI', 'OK', 'OKAY', 'CONFIRM', 'CONFIRMED') and v_last.kind = 'confirm' and v_last.roster_id is not null then
    select er.confirm_token into v_tok from public.event_roster er where er.id = v_last.roster_id;
    if v_tok is not null then perform public.volunteer_confirm_submit(v_tok, jsonb_build_object('attending', 'yes', 'via', 'whatsapp')); end if;
    v_handled := 'confirmed';
  elsif v_word in ('NO', 'N', 'NON', 'NOPE') and v_last.kind = 'confirm' and v_last.roster_id is not null then
    select er.confirm_token into v_tok from public.event_roster er where er.id = v_last.roster_id;
    if v_tok is not null then perform public.volunteer_confirm_submit(v_tok, jsonb_build_object('attending', 'no', 'via', 'whatsapp')); end if;
    v_handled := 'declined';
  elsif v_word in ('YES', 'Y', 'YEP', 'YEAH', 'OUI', 'OK', 'OKAY', 'NO', 'N', 'NON', 'NOPE') and v_last.kind = 'reconfirm' and v_last.pool_check_id is not null then
    select pc.token into v_tok from public.volunteer_pool_checks pc where pc.id = v_last.pool_check_id and pc.answer is null;
    if v_tok is not null then perform public.wa239_pool_answer(v_tok, jsonb_build_object('answer', case when v_word in ('NO', 'N', 'NON', 'NOPE') then 'no' else 'yes' end, 'via', 'whatsapp')); end if;
    v_handled := case when v_word in ('NO', 'N', 'NON', 'NOPE') then 'pool_no' else 'pool_yes' end;
  elsif v_pid is null then
    v_handled := 'unmatched';
  else
    v_handled := 'question';
  end if;
  update public.whatsapp_messages set handled = v_handled where id = v_id;

  if v_handled in ('confirmed', 'declined', 'pool_yes', 'pool_no') then
    v_lang := coalesce(public.wa171_lang(v_pid), 'en');
    v_first := nullif(split_part(trim(coalesce((select vp.full_name from public.volunteer_people vp where vp.id = v_pid), '')), ' ', 1), '');
    v_reply := case v_handled
      when 'confirmed' then case when v_lang = 'fr' then 'Merci' || coalesce(' ' || v_first, '') || ', c''est confirmé. À bientôt!' else 'Thanks' || coalesce(' ' || v_first, '') || ', you''re confirmed. See you there!' end
      when 'declined' then case when v_lang = 'fr' then 'Merci de nous avoir prévenus' || coalesce(', ' || v_first, '') || '. Au plaisir de vous voir à un autre service!' else 'Thanks for letting us know' || coalesce(', ' || v_first, '') || '. We hope to see you at another serving!' end
      when 'pool_yes' then case when v_lang = 'fr' then 'Formidable, merci' || coalesce(' ' || v_first, '') || '! Nous vous écrirons pour les prochains services.' else 'Wonderful, thanks' || coalesce(' ' || v_first, '') || '! We''ll be in touch about the next servings.' end
      else case when v_lang = 'fr' then 'Merci de nous l''avoir dit' || coalesce(', ' || v_first, '') || '. La porte reste ouverte.' else 'Thanks for letting us know' || coalesce(', ' || v_first, '') || '. You''re welcome back any time.' end
    end;
    insert into public.whatsapp_messages (person_id, phone, direction, kind, lang, body, event_id, roster_id, pool_check_id, sent_by)
    values (v_pid, v_phone, 'out', 'ack', v_lang, v_reply, v_last.event_id, v_last.roster_id, v_last.pool_check_id, 'wa254_inbound');
  end if;
  return jsonb_build_object('handled', v_handled, 'message_id', v_id, 'ack', v_reply is not null);
end $function$
;
revoke all on function public.wa254_inbound(jsonb) from public, anon, authenticated;
grant execute on function public.wa254_inbound(jsonb) to service_role;
  comment on function public.wa254_inbound(jsonb) is 'wave254: files a WhatsApp reply ({phone, text, button, wamid, at}) from whatsapp-send: stored in whatsapp_messages, STOP always honoured (crm_contacts.whatsapp_opt_out); YES / NO (or the template''s buttons) act on the last template sent to that number in 14 days (a serving confirmation through volunteer_confirm_submit, a "still in?" through wa239_pool_answer) only when sms_whatsapp_mode is live, or test and the number is a test phone; a thank-you is queued on WhatsApp. Service role only.';

CREATE OR REPLACE FUNCTION public.crm_refresh_implied_consent()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n_set int := 0; out jsonb;
begin
  if not (public.is_wa_admin() or auth.role() is null or auth.role() = 'service_role') then
    raise exception 'admins only';
  end if;
  with act as (
    select c.id,
      (select max(d.donated_at)::date from public.crm_donations d where d.contact_id = c.id) as last_gift,
      (select max(y.d) from (
         select e.event_date as d from public.event_roster r join public.volunteer_events e on e.id = r.event_id
           where c.volunteer_id is not null and r.person_id = c.volunteer_id and r.status = 'Confirmed' and e.status = 'completed'
         union all
         select h.event_at::date from public.crm_volunteer_history h where h.contact_id = c.id and h.attended) y) as last_serve
    from public.crm_contacts c
    where c.merged_into is null and coalesce(c.email_consent, 'none') <> 'express'
      and coalesce(c.email_status, 'unknown') not in ('unsubscribed', 'bounced', 'complained')
  ), calc as (
    select id, greatest(last_gift, last_serve) as last_act, last_gift, (greatest(last_gift, last_serve) + interval '2 years')::date as until_day
    from act where greatest(last_gift, last_serve) is not null
  ), upd as (
    update public.crm_contacts c
      set email_consent = 'implied', implied_consent_until = calc.until_day,
          consent_source = 'implied: ' || case when calc.last_act = calc.last_gift then 'gift on ' else 'volunteered on ' end || to_char(calc.last_act, 'YYYY-MM-DD') || ' (registered charity, CASL s.10(13))',
          updated_at = now(), updated_by = 'crm_refresh_implied_consent'
    from calc where c.id = calc.id
      and (c.email_consent is distinct from 'implied' or c.implied_consent_until is null or c.implied_consent_until < calc.until_day)
    returning c.id
  ) select count(*) into n_set from upd;
  select jsonb_build_object(
    'updated', n_set,
    'express', count(*) filter (where email_consent = 'express' and coalesce(email_status, 'unknown') not in ('unsubscribed', 'bounced', 'complained')),
    'implied', count(*) filter (where email_consent = 'implied' and implied_consent_until >= current_date and coalesce(email_status, 'unknown') not in ('unsubscribed', 'bounced', 'complained')),
    'implied_expired', count(*) filter (where email_consent = 'implied' and implied_consent_until < current_date and coalesce(email_status, 'unknown') not in ('unsubscribed', 'bounced', 'complained')),
    'unsubscribed', count(*) filter (where email_status in ('unsubscribed', 'complained')),
    'bounced', count(*) filter (where email_status = 'bounced'),
    'not_recorded', count(*) filter (where coalesce(email_consent, 'none') in ('none') and coalesce(email_status, 'unknown') not in ('unsubscribed', 'bounced', 'complained')),
    'ran_at', now())
    into out from public.crm_contacts where merged_into is null;
  return out;
end $function$
;
revoke all on function public.crm_refresh_implied_consent() from public, anon;
grant execute on function public.crm_refresh_implied_consent() to authenticated, service_role;
  comment on function public.crm_refresh_implied_consent() is 'Writes implied consent onto the contacts (wave154): every live contact who is not express, unsubscribed, bounced or complained and who gave or served within two years gets email_consent implied, implied_consent_until two years after that last gift or serving, and a consent_source that says so. Never shortens a consent recorded by the team. Admins (the Email tab) and the daily cron job wa-crm-consent run it; returns the counts.';

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

CREATE OR REPLACE FUNCTION public.crm_email_permission(p_contact_id bigint, p_kind text DEFAULT 'newsletter'::text)
 RETURNS TABLE(allowed boolean, basis text, until date, email text, status text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  c record; last_gift date; last_serve date; last_act date; imp_until date; exemption text;
begin
  select x.id, coalesce(x.primary_email, x.emails[1]) as em, coalesce(x.email_status, 'unknown') as st, x.email_consent, x.consent_source, x.implied_consent_until, x.merged_into, x.volunteer_id
    into c from public.crm_contacts x where x.id = p_contact_id;
  if c.id is null then return query select false, 'no such contact', null::date, null::text, null::text; return; end if;
  if c.merged_into is not null then return query select false, 'merged into another contact', null::date, c.em::text, c.st::text; return; end if;
  if c.em is null or c.em = '' then return query select false, 'no email address', null::date, null::text, c.st::text; return; end if;
  if c.st in ('bounced', 'complained') then return query select false, c.st::text, null::date, c.em::text, c.st::text; return; end if;
  if p_kind = 'transactional' or p_kind = 'test' then return query select true, 'transactional: a confirmation, reminder or receipt, not a commercial message'::text, null::date, c.em::text, c.st::text; return; end if;
  if c.st = 'unsubscribed' then return query select false, 'unsubscribed'::text, null::date, c.em::text, c.st::text; return; end if;
  if c.email_consent = 'express' then
    return query select true, ('express consent' || coalesce(' (' || c.consent_source || ')', ''))::text, null::date, c.em::text, c.st::text; return;
  end if;
  /* a volunteer call-out goes to everyone with a working address who has not unsubscribed (Steel, 27/09/26: "Keela's way", opted in and unknown) */
  if p_kind = 'volunteer' then
    return query select true, 'volunteer message: not unsubscribed (the team''s rule since 27/09/26)'::text, null::date, c.em::text, c.st::text; return;
  end if;
  /* implied consent (CASL s.10(13)): a gift to, or volunteering for, a registered charity within the last two years */
  select max(d.donated_at)::date into last_gift from public.crm_donations d where d.contact_id = p_contact_id;
  select max(y.d) into last_serve from (
    select e.event_date as d from public.event_roster r join public.volunteer_events e on e.id = r.event_id
      where c.volunteer_id is not null and r.person_id = c.volunteer_id and r.status = 'Confirmed' and e.status = 'completed'
    union all
    select h.event_at::date from public.crm_volunteer_history h where h.contact_id = p_contact_id and h.attended
  ) y;
  last_act := greatest(last_gift, last_serve);
  if c.email_consent = 'implied' and c.implied_consent_until is not null then
    imp_until := greatest(c.implied_consent_until, (last_act + interval '2 years')::date);
  elsif last_act is not null then
    imp_until := (last_act + interval '2 years')::date;
  end if;
  if imp_until is not null and imp_until >= current_date then
    return query select true, ('implied consent until ' || to_char(imp_until, 'DD Mon YYYY') || case when last_act = last_gift then ' (gift on ' when last_act is not null then ' (volunteered on ' else ' (' end
      || coalesce(to_char(last_act, 'DD Mon YYYY'), coalesce(c.consent_source, 'recorded by the team')) || ')')::text, imp_until, c.em::text, c.st::text;
    return;
  end if;
  if p_kind = 'fundraising' then
    select value into exemption from public.app_config where key = 'mail_fundraising_exemption';
    if exemption = 'on' then
      return query select true, 'fundraising by a registered charity (CASL s.6 does not apply); no consent on file'::text, null::date, c.em::text, c.st::text; return;
    end if;
  end if;
  return query select false, (case when imp_until is not null then 'implied consent ran out on ' || to_char(imp_until, 'DD Mon YYYY') else 'no consent recorded' end)::text, imp_until, c.em::text, c.st::text;
end $function$
;
revoke all on function public.crm_email_permission(bigint, text) from public, anon;
grant execute on function public.crm_email_permission(bigint, text) to authenticated, service_role;
  comment on function public.crm_email_permission(bigint, text) is 'The CASL rule for one contact and one kind of message (wave154; the volunteer kind wave155b). transactional/test: any working address. volunteer: any working address that has not unsubscribed (Steel, 27/09/26). newsletter/fundraising: express consent, or implied consent within two years of a gift or a serving; fundraising also under the exemption setting. Bounced and complained get nothing.';

-- crm_contact_match takes the view's row type, so it is dropped first and recreated after (live text). It has no dependants; crm_list_preview calls it
-- by name at run time.
drop function if exists public.crm_contact_match(public.crm_contacts_v, jsonb);
drop view if exists public.crm_contacts_v;
create view public.crm_contacts_v with (security_invoker = on) as
 SELECT c.id,
    c.full_name,
    c.first_name,
    c.last_name,
    c.emails,
    c.phones,
    c.primary_email,
    c.address,
    c.city,
    c.province,
    c.postal_code,
    c.country,
    c.language,
    c.kinds,
    c.tags,
    c.source,
    c.volunteer_id,
    c.member_id,
    c.auth_user_id,
    c.legacy_refs,
    c.email_status,
    c.email_consent,
    c.consent_source,
    c.consent_at,
    c.implied_consent_until,
    c.sms_opt_out,
    c.notes,
    c.owner_member_id,
    c.last_activity_at,
    c.merged_into,
    c.created_at,
    c.updated_at,
    c.created_by,
    c.updated_by,
    vp.roles AS volunteer_roles,
    vp.tags AS volunteer_tags,
    vp.organization AS volunteer_organization,
    vp.last_applied,
    vp.needs_review AS volunteer_needs_review,
    vp.quo_contact_id IS NOT NULL AS in_quo,
    COALESCE(h.legacy_servings, 0::bigint) AS legacy_servings,
    COALESCE(h.legacy_hours, 0::numeric) AS legacy_hours,
    COALESCE(r.hub_servings, 0::bigint) AS hub_servings,
    r.last_serving_on,
    COALESCE(d.donation_total, 0::numeric) AS donation_total,
    COALESCE(d.donation_count, 0::bigint) AS donation_count,
    d.last_donation_at,
    o.org_names
   FROM public.crm_contacts c
     LEFT JOIN public.volunteer_people vp ON vp.id = c.volunteer_id
     LEFT JOIN LATERAL ( SELECT count(*) FILTER (WHERE x.attended AND x.volunteer_event_id IS NULL) AS legacy_servings,
            sum(x.hours) FILTER (WHERE x.attended) AS legacy_hours
           FROM public.crm_volunteer_history x
          WHERE x.contact_id = c.id) h ON true
     LEFT JOIN LATERAL ( SELECT count(*) AS hub_servings,
            max(e.event_date) AS last_serving_on
           FROM public.event_roster er
             JOIN public.volunteer_events e ON e.id = er.event_id
          WHERE c.volunteer_id IS NOT NULL AND er.person_id = c.volunteer_id AND er.status = 'Confirmed'::text AND e.status = 'completed'::text) r ON true
     LEFT JOIN LATERAL ( SELECT sum(x.amount) AS donation_total,
            count(*) AS donation_count,
            max(x.donated_at) AS last_donation_at
           FROM public.crm_donations x
          WHERE x.contact_id = c.id) d ON true
     LEFT JOIN LATERAL ( SELECT array_agg(p.name ORDER BY co.is_primary DESC, p.name) AS org_names
           FROM public.crm_contact_orgs co
             JOIN public.wa_partners p ON p.id = co.partner_id
          WHERE co.contact_id = c.id) o ON true
  WHERE c.merged_into IS NULL;
revoke all on table public.crm_contacts_v from public, anon, authenticated;
grant select, truncate, references, trigger, maintain on table public.crm_contacts_v to authenticated;   -- as live: rDxtm
grant all on table public.crm_contacts_v to service_role;
  comment on view public.crm_contacts_v is 'The live contacts (not merged) with their volunteer roles and tags, Hub servings (confirmed at completed events, the old website''s events included since wave 152), the old website''s servings not yet in the Hub and its recorded hours, gift totals and organization names. The CRM page reads this.';

CREATE OR REPLACE FUNCTION public.crm_contact_match(c public.crm_contacts_v, k jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  f text := k->>'f'; op text := coalesce(k->>'op', ''); v text := coalesce(k->>'v', ''); n numeric; r boolean; w text;
begin
  if f is null or f = '' then return true; end if;
  begin n := nullif(trim(v), '')::numeric; exception when others then n := null; end;
  if f = 'kind' then
    r := case v when 'donor' then ('donor' = any(coalesce(c.kinds, '{}')) or coalesce(c.donation_count, 0) > 0)
                when 'partner' then ('partner' = any(coalesce(c.kinds, '{}')) or coalesce(array_length(c.org_names, 1), 0) > 0)
                else v = any(coalesce(c.kinds, '{}')) end;
  elsif f = 'role' then r := v = any(coalesce(c.volunteer_roles, '{}')) or v = any(coalesce(c.volunteer_tags, '{}'));
  elsif f = 'tag' then r := exists (select 1 from unnest(coalesce(c.tags, '{}')) t where public.crm_fold(t) = public.crm_fold(v));
  elsif f = 'perm' then
    w := public.crm_perm_key(c.email_status, c.email_consent, c.implied_consent_until);
    r := w = v or (v = 'unsub' and w = 'bounced');
  elsif f = 'email' then r := coalesce(array_length(c.emails, 1), 0) > 0 or coalesce(c.primary_email, '') <> '';
  elsif f = 'served' then
    r := case op when 'never' then coalesce(c.hub_servings, 0) + coalesce(c.legacy_servings, 0) = 0
                 when 'within' then c.last_serving_on >= current_date - coalesce(n, 365)::int
                 when 'count_gte' then coalesce(c.hub_servings, 0) + coalesce(c.legacy_servings, 0) >= coalesce(n, 1)
                 else coalesce(c.hub_servings, 0) + coalesce(c.legacy_servings, 0) > 0 end;
  elsif f = 'gave' then
    r := case op when 'never' then coalesce(c.donation_count, 0) = 0
                 when 'within' then c.last_donation_at >= now() - make_interval(days => coalesce(n, 365)::int)
                 when 'lapsed' then c.last_donation_at < now() - make_interval(days => coalesce(n, 365)::int)
                 when 'total_gte' then coalesce(c.donation_total, 0) >= coalesce(n, 0)
                 when 'count_gte' then coalesce(c.donation_count, 0) >= coalesce(n, 1)
                 else coalesce(c.donation_count, 0) > 0 end;
  elsif f = 'city' then r := public.crm_fold(c.city) like '%' || public.crm_fold(v) || '%';
  elsif f = 'language' then r := lower(coalesce(c.language, '')) like lower(v) || '%';
  elsif f = 'source' then r := coalesce(c.source, '') = v;
  elsif f = 'added' then r := c.created_at >= now() - make_interval(days => coalesce(n, 30)::int);
  elsif f = 'active' then r := c.last_activity_at >= now() - make_interval(days => coalesce(n, 90)::int);
  elsif f = 'opened' then r := exists (select 1 from public.crm_email_sends s where s.contact_id = c.id and not s.is_test and s.opened_at >= now() - make_interval(days => coalesce(n, 90)::int));
  elsif f = 'clicked' then r := exists (select 1 from public.crm_email_sends s where s.contact_id = c.id and not s.is_test and s.clicked_at >= now() - make_interval(days => coalesce(n, 90)::int));
  elsif f = 'review' then r := coalesce(c.volunteer_needs_review, false);
  elsif f = 'search' then
    r := not exists (
      select 1 from unnest(string_to_array(public.crm_fold(trim(v)), ' ')) x
      where x <> '' and position(x in public.crm_fold(coalesce(c.full_name, '') || ' ' || array_to_string(coalesce(c.emails, '{}'), ' ') || ' ' || array_to_string(coalesce(c.phones, '{}'), ' ') || ' ' || coalesce(c.city, '') || ' ' || coalesce(c.volunteer_organization, '') || ' ' || array_to_string(coalesce(c.org_names, '{}'), ' ') || ' ' || array_to_string(coalesce(c.tags, '{}'), ' '))) = 0);
  else r := true;
  end if;
  r := coalesce(r, false);
  if op in ('not', 'none') then return not r; end if;
  return r;
end $function$
;
revoke all on function public.crm_contact_match(public.crm_contacts_v, jsonb) from public, anon;
grant execute on function public.crm_contact_match(public.crm_contacts_v, jsonb) to authenticated, service_role;
  comment on function public.crm_contact_match(public.crm_contacts_v, jsonb) is 'One list condition {f, op, v} against one contact (wave155b). Fields: kind, role, tag, perm, email, served (ever, never, within days, count_gte), gave (ever, never, within days, lapsed days, total_gte, count_gte), city, language, source, added (days), active (days), opened and clicked (a Hub email within days), review, search. op not/none negates.';

create trigger wa_app_config_guard before insert or delete or update on public.app_config for each row execute function public.wa_app_config_guard();

-- 6. fixture rows (invented). They exist before the migration, so its backfills have something to read.
insert into public.hub_access_profiles (key, label, tier, pages) values ('w281nocrm', 'Test profile without the CRM', 'member', '{"crm": "none"}');
insert into public.hub_roles (email, role, profile) values
  ('w281.admin@example.invalid', 'admin', null), ('w281.leader@example.invalid', 'leader', null), ('w281.member@example.invalid', 'member', null),
  ('w281.finance@example.invalid', 'member', null), ('w281.hr@example.invalid', 'member', null), ('w281.blocked@example.invalid', 'blocked', null),
  ('w281.nocrm@example.invalid', 'member', 'w281nocrm');
insert into public.wa_hr_access (email) values ('w281.hr@example.invalid');
insert into public.app_config (key, value) values ('sms_mode', 'off'), ('keela_notice_days', '30'),
  ('mail_senders', '{"routes": {"volunteer": "volunteer@welfareavenue.com", "toronto": "toronto@welfareavenue.com"}}');

-- chapters: 40 contacts tagged Toronto in tags[], 4 tagged only in Keela's tags, and three that must not count
insert into public.crm_contacts (id, full_name, tags) overriding system value
select g, 'Test Toronto ' || g, array['Volunteer', case g % 3 when 0 then 'Toronto' when 1 then 'toronto volunteers' else 'Gift drive TORONTO 2026' end]
  from generate_series(1001, 1040) g;
insert into public.crm_contacts (id, full_name, legacy_refs) overriding system value
select g, 'Test Keela Toronto ' || g, '{"keela": {"tags": ["Newsletter", "Toronto team"]}}'::jsonb from generate_series(1041, 1044) g;
insert into public.crm_contacts (id, full_name, tags, merged_into) overriding system value values (1045, 'Test Merged Toronto', array['Toronto'], 1001);
insert into public.crm_contacts (id, full_name, legacy_refs) overriding system value values (1046, 'Test Keela Tags Not A List', '{"keela": {"tags": "Toronto"}}');
insert into public.crm_contacts (id, full_name, tags) overriding system value values (1047, 'Test Montreal Only Tag', array['Montreal', 'Volunteer']);

-- Montreal evidence
insert into public.volunteer_people (id, full_name, phones) values (501, 'Test Served Volunteer', array['+15145550201']), (505, 'Test Applicant Volunteer', null), (506, 'Test Planned Volunteer', null);
insert into public.volunteer_events (id, event_date, status) values (701, date '2026-09-20', 'completed'), (702, date '2026-12-20', 'planned');
insert into public.crm_contacts (id, full_name, volunteer_id, phones) overriding system value values (1101, 'Test Served', 501, array['+1 (514) 555-0201']);
insert into public.crm_contacts (id, full_name) overriding system value values (1102, 'Test Old Website'), (1103, 'Test Montreal Form'), (1104, 'Test Applicant By Contact');
insert into public.crm_contacts (id, full_name, volunteer_id) overriding system value values (1105, 'Test Applicant By Person', 505), (1106, 'Test Planned Only', 506);
insert into public.crm_contacts (id, full_name) overriding system value values (1107, 'Test Spam Form');
insert into public.event_roster (event_id, person_id, role, status) values (701, 501, 'server', 'Confirmed'), (702, 506, 'server', 'Confirmed');
insert into public.crm_volunteer_history (contact_id, attended, event_at) values (1102, true, '2025-06-01'), (1001, true, '2025-06-08'), (1106, false, '2025-06-08');
insert into public.volunteer_applications (contact_id, person_id, name) values (1104, null, 'Test Applicant By Contact'), (null, 505, 'Test Applicant By Person');

-- forms, form answers with consent (backfill a) and the drive forms
insert into public.crm_forms (id, slug, title, settings, consent) overriding system value values
  (801, 'test-montreal-form', 'Test Montreal form', '{"city": "Montreal"}', '{"ask": true, "label": "Yes, email me"}'),
  (802, 'test-plain-form', 'Test plain form', '{}', '{"ask": true, "label": "Yes, email me"}'),
  (803, 'test-gbd-give', 'Test gift drive give', '{"campaign": "gift-basket-drive"}', '{}'),
  (804, 'test-gbd-volunteer', 'Test gift drive volunteer', '{"campaign": "gift-basket-drive", "city": "Montreal"}', '{}');
insert into public.crm_contacts (id, full_name, email_status) overriding system value values
  (1108, 'Test Said No', 'unknown'), (1109, 'Test Test Answer', 'unknown'), (1110, 'Test Spam Answer', 'unknown'), (1111, 'Test No Consent', 'unknown'), (1112, 'Test No At', 'unknown');
insert into public.crm_form_submissions (form_id, contact_id, status, is_test, consent, created_at) values
  (801, 1103, 'processed', false, '{"asked": "Yes, email me", "given": true, "at": "2026-10-02T18:58:54.085Z", "form": "test-montreal-form"}', '2026-10-02 18:58:55+00'),
  (802, 1108, 'processed', false, '{"asked": "Yes, email me", "given": false, "at": "2026-10-03T12:00:00.000Z", "form": "test-plain-form"}', '2026-10-03 12:00:01+00'),
  (802, 1109, 'processed', true, '{"asked": "Yes, email me", "given": true, "at": "2026-10-04T12:00:00.000Z", "form": "test-plain-form"}', '2026-10-04 12:00:01+00'),
  (801, 1107, 'spam', false, '{"asked": "Yes, email me", "given": true, "at": "2026-10-05T12:00:00.000Z", "form": "test-montreal-form"}', '2026-10-05 12:00:01+00'),
  (802, null, 'processed', false, '{"asked": "Yes, email me", "given": true, "at": "2026-10-06T12:00:00.000Z", "form": "test-plain-form"}', '2026-10-06 12:00:01+00'),
  (802, 1111, 'processed', false, null, '2026-10-07 12:00:01+00'),
  (802, 1112, 'processed', false, '{"asked": "Yes, email me", "given": true, "form": "test-plain-form"}', '2026-10-08 12:00:01+00');

-- change_log rows on contacts (backfill b): two that count, three that must not
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by, changed_at) values
  ('crm_contact', '1108', 'email_status', 'unknown', 'unsubscribed', 'w281.member@example.invalid', '2026-10-05 10:00:00+00'),
  ('crm_contacts', '1112', 'sms_opt_out', 'false', 'true', 'w281.member@example.invalid', '2026-10-06 10:00:00+00'),
  ('crm_contact', '999999', 'email_status', 'unknown', 'unsubscribed', 'w281.member@example.invalid', '2026-10-07 10:00:00+00'),
  ('crm_contact', 'not-a-number', 'email_status', 'unknown', 'unsubscribed', 'w281.member@example.invalid', '2026-10-07 11:00:00+00'),
  ('crm_contact', '1108', 'notes', null, 'a note', 'w281.member@example.invalid', '2026-10-07 12:00:00+00');

-- gifts with campaign texts: five that link, two that must not
insert into public.crm_contacts (id, full_name) overriding system value values (1201, 'Test Donor');
insert into public.crm_donations (contact_id, amount, donated_at, campaign) values
  (1201, 25, '2026-05-01', 'Football Fundraiser 2026'), (1201, 30, '2026-05-02', 'Football Fundraiser 2026'), (1201, 20, '2025-05-01', 'football fundraiser 2025'),
  (1201, 50, '2025-12-01', 'Holiday Gift Baskets'), (1201, 40, '2026-10-20', 'Holiday Gift Basket Drive 2026'), (1201, 10, '2026-01-01', 'fundraising campaign'), (1201, 15, '2026-01-02', null);
-- a recent donor with no consent yet, for the implied-consent refresh
insert into public.crm_contacts (id, full_name, emails, email_status) overriding system value values (1301, 'Test Recent Donor', array['w281.recent@example.invalid'], 'subscribed');
insert into public.crm_donations (contact_id, amount, donated_at) values (1301, 20, now() - interval '30 days');

-- texts: one phone stopped and held by nobody, one stopped then started again, one with only a question; WhatsApp: one stopped
insert into public.quo_messages (batch_id, phone, body, status, direction, kind, handled, created_at) values
  (gen_random_uuid(), '+15145550101', 'STOP', 'received', 'in', 'inbound', 'opted_out', '2026-10-02 12:00:00+00'),
  (gen_random_uuid(), '+15145550102', 'STOP', 'received', 'in', 'inbound', 'opted_out', '2026-10-02 12:00:00+00'),
  (gen_random_uuid(), '+15145550102', 'START', 'received', 'in', 'inbound', 'opted_in', '2026-10-03 12:00:00+00'),
  (gen_random_uuid(), '+15145550104', 'What time?', 'received', 'in', 'inbound', 'question', '2026-10-03 12:00:00+00'),
  (gen_random_uuid(), '+15145550103', 'Reminder', 'sent', 'out', 'confirm', null, '2026-10-03 12:00:00+00');
insert into public.whatsapp_messages (phone, direction, kind, body, status, handled, created_at) values
  ('+15145550105', 'in', 'inbound', 'STOP', 'received', 'opted_out', '2026-10-04 12:00:00+00');

-- custom fields already there
insert into public.crm_fields (key, label, type, sort, created_by) values ('instagram', 'Instagram', 'text', 10, 'wave156'), ('partner_status', 'Relationship status', 'choice', 180, 'S6 wave269a');
