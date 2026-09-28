-- wa156_forms (28/09/26): the CRM's own forms and custom fields.
-- Steel, 28/09/26: public forms live at hub.welfareavenue.com/f/<slug>; the volunteer applications and the newsletter
-- sign-up come first; the Toronto form's birth date and health questions are replaced (16 or older, and an optional
-- "anything we should know to support you?"); built-in spam checks (a hidden field, a minimum time, rate limits).
-- The public side is the form-submit function (verify_jwt off); it validates, stores the submission and calls
-- crm_form_apply(), which does the database work in one transaction.

-- ---------- custom fields ----------
create table if not exists public.crm_fields (
  id bigint generated always as identity primary key,
  key text not null unique check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  label text not null check (length(label) between 1 and 120),
  type text not null default 'text' check (type in ('text', 'long_text', 'number', 'date', 'choice', 'multi', 'yes_no')),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  help text,
  sort int not null default 100,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.crm_fields is 'Custom fields on contacts (wave156): what the Hub has no column for (a Rally Paper team, the part of the GTA, photo consent). type is text, long_text, number, date, choice, multi or yes_no; options lists the choices of a choice or multi field. An archived field keeps its values but leaves the forms and the contact page. Staff with the CRM page read and write.';
comment on column public.crm_fields.key is 'The stable name forms and imports use (field:<key> in a form question); lower case, digits and underscores.';
comment on column public.crm_fields.options is 'The choices of a choice or multi field, in order: strings, or {"v": value, "l": label} objects.';
alter table public.crm_fields enable row level security;
drop policy if exists crm_fields_staff_read on public.crm_fields;
create policy crm_fields_staff_read on public.crm_fields for select to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
drop policy if exists crm_fields_staff_insert on public.crm_fields;
create policy crm_fields_staff_insert on public.crm_fields for insert to authenticated with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
drop policy if exists crm_fields_staff_update on public.crm_fields;
create policy crm_fields_staff_update on public.crm_fields for update to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)) with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
grant select, insert, update on public.crm_fields to authenticated;
grant usage, select on sequence public.crm_fields_id_seq to authenticated;

create table if not exists public.crm_contact_fields (
  contact_id bigint not null references public.crm_contacts(id) on delete cascade,
  field_id bigint not null references public.crm_fields(id) on delete cascade,
  value jsonb not null,
  source text,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (contact_id, field_id)
);
create index if not exists crm_contact_fields_field_idx on public.crm_contact_fields (field_id);
comment on table public.crm_contact_fields is 'A contact''s custom field values (wave156): one row per contact and field. value is JSON: a string, a number, true or false (yes_no), or an array (multi). source says where it came from (form:<slug>, keela, or the staff member who typed it). Merging two contacts moves the values (crm_merge_contacts). Staff with the CRM page read and write.';
alter table public.crm_contact_fields enable row level security;
drop policy if exists crm_contact_fields_staff on public.crm_contact_fields;
create policy crm_contact_fields_staff on public.crm_contact_fields for all to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)) with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
grant select, insert, update, delete on public.crm_contact_fields to authenticated;

-- ---------- forms ----------
create table if not exists public.crm_forms (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  title text not null check (length(title) between 1 and 140),
  intro text,
  lang text not null default 'en' check (lang in ('en', 'fr')),
  kind text not null default 'general' check (kind in ('volunteer', 'newsletter', 'general')),
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  questions jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array'),
  consent jsonb not null default '{}'::jsonb,
  thank_you text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text,
  published_at timestamptz,
  published_by text,
  closed_at timestamptz
);
comment on table public.crm_forms is 'The CRM''s forms (wave156), shown to the public at hub.welfareavenue.com/f/<slug> while status is published. A draft is only seen by staff; a closed form shows that it no longer takes answers. Staff with the CRM page create, edit and publish; every status change is in change_log.';
comment on column public.crm_forms.kind is 'volunteer (a volunteer application or registration), newsletter (a sign-up) or general.';
comment on column public.crm_forms.questions is 'The questions in order: {"id", "type" (text, long_text, email, phone, choice, multi, yes_no, date, number, serving_dates), "label", "help", "required", "options", "to"}. to says where the answer is saved: contact.first_name, contact.last_name, contact.email, contact.phone, contact.city, contact.province, contact.postal_code, contact.address, contact.language, volunteer.roles, volunteer.dates (serving_dates: a sign-up on each picked event''s roster), field:<crm_fields.key>, note (the timeline entry) or nothing (kept on the submission only).';
comment on column public.crm_forms.consent is 'The email permission question: {"ask": true, "required": false, "label": the words shown next to the box}. A ticked box records express consent with those words (CASL); the box is never ticked in advance.';
comment on column public.crm_forms.settings is 'volunteer_record (true: an application also creates or updates the MTL volunteering record), serving_location (the events a serving_dates question offers), city (written on new contacts), tags (added to the contact), confirm and confirm_template (a confirmation email through mail-send; off unless Steel turns it on).';
alter table public.crm_forms enable row level security;
drop policy if exists crm_forms_staff_read on public.crm_forms;
create policy crm_forms_staff_read on public.crm_forms for select to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
drop policy if exists crm_forms_staff_insert on public.crm_forms;
create policy crm_forms_staff_insert on public.crm_forms for insert to authenticated with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true) and status = 'draft');
drop policy if exists crm_forms_staff_update on public.crm_forms;
create policy crm_forms_staff_update on public.crm_forms for update to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true)) with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
drop policy if exists crm_forms_staff_delete on public.crm_forms;
create policy crm_forms_staff_delete on public.crm_forms for delete to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true) and status = 'draft');
grant select, insert, update, delete on public.crm_forms to authenticated;
grant usage, select on sequence public.crm_forms_id_seq to authenticated;

create table if not exists public.crm_form_submissions (
  id bigint generated always as identity primary key,
  form_id bigint not null references public.crm_forms(id) on delete restrict,
  contact_id bigint references public.crm_contacts(id) on delete set null,
  status text not null default 'received' check (status in ('received', 'processed', 'spam', 'error', 'test')),
  answers jsonb not null default '{}'::jsonb,
  display jsonb not null default '[]'::jsonb,
  mapped jsonb not null default '{}'::jsonb,
  consent jsonb,
  result jsonb not null default '{}'::jsonb,
  lang text,
  ip_hash text,
  user_agent text,
  is_test boolean not null default false,
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists crm_form_submissions_form_idx on public.crm_form_submissions (form_id, created_at desc);
create index if not exists crm_form_submissions_ip_idx on public.crm_form_submissions (ip_hash, created_at desc);
create index if not exists crm_form_submissions_contact_idx on public.crm_form_submissions (contact_id);
comment on table public.crm_form_submissions is 'Every answer to a CRM form (wave156), kept as sent: answers by question id, display (label and answer as shown), mapped (what goes where), consent (the words shown and whether the box was ticked), result (what the Hub did: the contact, a new or updated volunteer record, roster sign-ups, fields). status: received, processed, spam (a hidden-field or timing check failed), error (kept for the team to look at), test (a test against a draft). ip_hash is a keyed hash for rate limits, never the address. Staff with the CRM page read; only form-submit writes.';
alter table public.crm_form_submissions enable row level security;
drop policy if exists crm_form_submissions_staff_read on public.crm_form_submissions;
create policy crm_form_submissions_staff_read on public.crm_form_submissions for select to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
grant select on public.crm_form_submissions to authenticated;

create or replace view public.crm_form_stats_v with (security_invoker = true) as
  select f.id as form_id,
         count(s.id) filter (where not s.is_test and s.status in ('received', 'processed')) as submissions,
         count(s.id) filter (where not s.is_test and s.status in ('received', 'processed') and s.created_at > now() - interval '7 days') as last_7_days,
         max(s.created_at) filter (where not s.is_test and s.status in ('received', 'processed')) as last_at,
         count(s.id) filter (where s.status = 'spam') as spam,
         count(s.id) filter (where s.status = 'error') as errors,
         count(s.id) filter (where s.is_test) as tests
    from public.crm_forms f left join public.crm_form_submissions s on s.form_id = f.id
   group by f.id;
comment on view public.crm_form_stats_v is 'Per-form counts (wave156): real submissions, the last seven days, the last one, spam, errors and tests.';
grant select on public.crm_form_stats_v to authenticated;

-- ---------- status changes: stamps, the go-live checks, change_log ----------
create or replace function public.crm_forms_stamp()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare who text := coalesce(nullif(lower(auth.jwt() ->> 'email'), ''), new.updated_by, 'staff');
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'published' then
      if not jsonb_path_exists(new.questions, '$[*] ? (@.to == "contact.email")') then
        raise exception 'A form needs an email question before it can go live.';
      end if;
      if new.kind = 'newsletter' and not coalesce((new.consent ->> 'ask')::boolean, false) then
        raise exception 'A newsletter sign-up needs the email permission question.';
      end if;
      new.published_at := now(); new.published_by := who; new.closed_at := null;
    elsif new.status = 'closed' then
      new.closed_at := now();
    end if;
    begin
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('crm_form', new.id::text, 'status', old.status, new.status || ' (' || new.slug || ')', who);
    exception when others then null; end;
  end if;
  return new;
end $function$;
drop trigger if exists crm_forms_stamp on public.crm_forms;
create trigger crm_forms_stamp before update on public.crm_forms for each row execute function public.crm_forms_stamp();

-- ---------- the database side of a submission ----------
create or replace function public.crm_form_apply(p_submission_id bigint)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  s record; f record; m jsonb;
  v_em text; v_fn text; v_ln text; v_full text; v_ph text; v_city text; v_src text;
  v_roles text[]; v_tags text[]; v_role text; v_consent boolean;
  v_cid bigint; v_created boolean := false; v_vid bigint; v_vcreated boolean := false;
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_roster jsonb := '[]'::jsonb; v_fields jsonb := '[]'::jsonb; v_body text; v_result jsonb;
  fk text; fid bigint; ev record; rid bigint;
begin
  select * into s from public.crm_form_submissions where id = p_submission_id for update;
  if not found then raise exception 'no such submission'; end if;
  if s.status in ('processed', 'test') then return s.result; end if;
  select * into f from public.crm_forms where id = s.form_id;
  m := coalesce(s.mapped, '{}'::jsonb);
  v_em := lower(btrim(coalesce(m #>> '{contact,email}', '')));
  if v_em !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'an email address is needed'; end if;
  v_fn := nullif(btrim(coalesce(m #>> '{contact,first_name}', '')), '');
  v_ln := nullif(btrim(coalesce(m #>> '{contact,last_name}', '')), '');
  v_full := nullif(btrim(concat_ws(' ', v_fn, v_ln)), '');
  v_ph := nullif(btrim(coalesce(m #>> '{contact,phone}', '')), '');
  v_city := nullif(btrim(coalesce(m #>> '{contact,city}', f.settings ->> 'city', '')), '');
  v_roles := coalesce((select array_agg(distinct x) from jsonb_array_elements_text(coalesce(m -> 'roles', '[]'::jsonb)) x), '{}');
  v_tags := coalesce((select array_agg(distinct x) from jsonb_array_elements_text(coalesce(f.settings -> 'tags', '[]'::jsonb)) x), '{}');
  v_consent := coalesce((m ->> 'consent')::boolean, false);
  v_src := 'form:' || f.slug;
  v_role := coalesce((select x from unnest(array['cook', 'driver', 'server', 'dishwasher', 'photographer', 'community_debrief', 'community_talker']) with ordinality t(x, o)
                       where x = any(v_roles) order by o limit 1), 'server');

  -- 1. the contact with this email (never a merged one)
  select c.id into v_cid from public.crm_contacts c
   where c.merged_into is null
     and (lower(btrim(c.primary_email)) = v_em or exists (select 1 from unnest(c.emails) x where lower(btrim(x)) = v_em))
   order by (lower(btrim(c.primary_email)) = v_em) desc, c.id
   limit 1;

  -- 2. MTL volunteering: the volunteer record (its trigger keeps the contact in step)
  if f.kind = 'volunteer' and coalesce((f.settings ->> 'volunteer_record')::boolean, false) then
    if v_cid is not null then select volunteer_id into v_vid from public.crm_contacts where id = v_cid; end if;
    if v_vid is null then
      select vp.id into v_vid from public.volunteer_people vp
       where exists (select 1 from unnest(vp.emails) x where lower(btrim(x)) = v_em) order by vp.id limit 1;
    end if;
    if v_vid is null then
      insert into public.volunteer_people (full_name, emails, phones, roles, needs_review, review_note, last_applied, joined_note, tags)
      values (coalesce(v_full, v_em), array[v_em], case when v_ph is null then '{}'::text[] else array[v_ph] end, v_roles, true,
              'Applied through the Hub form "' || f.title || '" on ' || to_char(v_today, 'DD Mon YYYY'), v_today, 'Hub form: ' || f.title, v_tags)
      returning id into v_vid;
      v_vcreated := true;
    else
      update public.volunteer_people vp set
        roles = (select coalesce(array_agg(distinct x), '{}') from unnest(coalesce(vp.roles, '{}') || v_roles) x),
        emails = case when exists (select 1 from unnest(vp.emails) x where lower(btrim(x)) = v_em) then vp.emails else coalesce(vp.emails, '{}') || v_em end,
        phones = case when v_ph is not null and cardinality(coalesce(vp.phones, '{}')) = 0 then array[v_ph] else vp.phones end,
        tags = (select coalesce(array_agg(distinct x), '{}') from unnest(coalesce(vp.tags, '{}') || v_tags) x),
        last_applied = v_today
      where vp.id = v_vid;
    end if;
    if v_cid is null then
      select id into v_cid from public.crm_contacts where volunteer_id = v_vid and merged_into is null order by id limit 1;
      v_created := v_cid is not null and v_vcreated;
    end if;
  end if;

  -- 3. a new contact, or 4. fill in what the contact is missing (never erase what the team entered)
  if v_cid is null then
    insert into public.crm_contacts (full_name, first_name, last_name, emails, phones, city, province, postal_code, address, language, kinds, tags, source, created_by, updated_by)
    values (coalesce(v_full, v_em), v_fn, v_ln, array[v_em], case when v_ph is null then '{}'::text[] else array[v_ph] end, v_city,
            nullif(btrim(coalesce(m #>> '{contact,province}', '')), ''), nullif(btrim(coalesce(m #>> '{contact,postal_code}', '')), ''),
            nullif(btrim(coalesce(m #>> '{contact,address}', '')), ''), nullif(btrim(coalesce(m #>> '{contact,language}', '')), ''),
            array[case when f.kind = 'volunteer' then 'volunteer' else 'supporter' end], v_tags, 'hub_form', v_src, v_src)
    returning id into v_cid;
    v_created := true;
  else
    update public.crm_contacts c set
      first_name = coalesce(nullif(c.first_name, ''), v_fn),
      last_name = coalesce(nullif(c.last_name, ''), v_ln),
      full_name = case when coalesce(c.full_name, '') in ('', '(no name)') or lower(c.full_name) = v_em then coalesce(v_full, c.full_name) else c.full_name end,
      emails = case when exists (select 1 from unnest(c.emails) x where lower(btrim(x)) = v_em) then c.emails else coalesce(c.emails, '{}') || v_em end,
      phones = case when v_ph is not null and cardinality(coalesce(c.phones, '{}')) = 0 then array[v_ph] else c.phones end,
      city = coalesce(nullif(c.city, ''), v_city),
      province = coalesce(nullif(c.province, ''), nullif(btrim(coalesce(m #>> '{contact,province}', '')), '')),
      postal_code = coalesce(nullif(c.postal_code, ''), nullif(btrim(coalesce(m #>> '{contact,postal_code}', '')), '')),
      address = coalesce(nullif(c.address, ''), nullif(btrim(coalesce(m #>> '{contact,address}', '')), '')),
      language = coalesce(nullif(c.language, ''), nullif(btrim(coalesce(m #>> '{contact,language}', '')), '')),
      kinds = case when f.kind = 'volunteer' and not ('volunteer' = any(coalesce(c.kinds, '{}'))) then coalesce(c.kinds, '{}') || array['volunteer']
                   when f.kind <> 'volunteer' and cardinality(coalesce(c.kinds, '{}')) = 0 then array['supporter'] else c.kinds end,
      tags = (select coalesce(array_agg(x order by x), '{}') from (select distinct x from unnest(coalesce(c.tags, '{}') || v_tags) x) t),
      source = case when v_created then 'hub_form' else c.source end,
      created_by = case when v_created then v_src else c.created_by end,
      updated_by = v_src
    where c.id = v_cid;
  end if;

  -- 5. the email permission: a ticked box is express consent, recorded with the form's name and the day. Someone who
  --    unsubscribed stays unsubscribed (the box could have been ticked by anyone who typed their address); the
  --    timeline entry shows the tick, and the team confirms with them before changing anything.
  if v_consent and (v_created or coalesce((select email_status from public.crm_contacts where id = v_cid), '') <> 'unsubscribed') then
    update public.crm_contacts set email_consent = 'express',
      consent_source = 'Hub form: ' || f.title || ' (' || to_char(v_today, 'DD Mon YYYY') || ')', consent_at = now(),
      email_status = case when email_status in ('bounced', 'complained') then email_status else 'subscribed' end
    where id = v_cid;
  end if;

  -- 6. custom fields: the latest answer wins
  for fk in select jsonb_object_keys(coalesce(m -> 'fields', '{}'::jsonb)) loop
    select id into fid from public.crm_fields where key = fk and archived_at is null;
    if fid is null then continue; end if;
    insert into public.crm_contact_fields (contact_id, field_id, value, source, updated_at, updated_by)
    values (v_cid, fid, m -> 'fields' -> fk, v_src, now(), v_src)
    on conflict (contact_id, field_id) do update set value = excluded.value, source = excluded.source, updated_at = now(), updated_by = excluded.updated_by;
    v_fields := v_fields || to_jsonb(fk);
  end loop;

  -- 7. the dates they picked: a sign-up on each event's roster, to be confirmed by the team (status TBD)
  if v_vid is not null then
    for ev in select e.id, e.event_date from public.volunteer_events e
               where e.id in (select x::bigint from jsonb_array_elements_text(coalesce(m -> 'dates', '[]'::jsonb)) x where x ~ '^[0-9]+$')
                 and e.status = 'planned' and e.event_date >= v_today
               order by e.event_date loop
      if exists (select 1 from public.event_roster r where r.event_id = ev.id and r.person_id = v_vid) then
        v_roster := v_roster || jsonb_build_object('event_id', ev.id, 'date', ev.event_date, 'already', true);
        continue;
      end if;
      insert into public.event_roster (event_id, person_id, person_name, role, status, notes, detail)
      values (ev.id, v_vid, coalesce(v_full, v_em), v_role, 'TBD',
              'Signed up through the Hub form "' || f.title || '" on ' || to_char(v_today, 'DD Mon YYYY'),
              jsonb_build_object('source', 'hub_form', 'form', f.slug, 'submission_id', s.id))
      returning id into rid;
      v_roster := v_roster || jsonb_build_object('event_id', ev.id, 'date', ev.event_date, 'roster_id', rid, 'role', v_role);
    end loop;
  end if;

  -- 8. the timeline
  select string_agg(coalesce(d ->> 'label', '') || ': ' || coalesce(d ->> 'value', ''), E'\n' order by o) into v_body
    from jsonb_array_elements(coalesce(s.display, '[]'::jsonb)) with ordinality t(d, o);
  insert into public.crm_interactions (contact_id, kind, direction, channel, subject, body, occurred_at, source, source_ref, meta, created_by)
  values (v_cid, 'form', 'in', 'web', 'Filled in "' || f.title || '"' || case when s.is_test then ' (test)' else '' end, v_body, s.created_at, 'hub_form', 'form:' || s.id,
          jsonb_build_object('form_id', f.id, 'slug', f.slug, 'submission_id', s.id, 'consent', v_consent, 'is_test', s.is_test), v_src);
  update public.crm_contacts set last_activity_at = greatest(coalesce(last_activity_at, s.created_at), s.created_at) where id = v_cid;

  v_result := jsonb_build_object('contact_id', v_cid, 'created', v_created, 'volunteer_id', v_vid, 'volunteer_created', v_vcreated,
                                 'roster', v_roster, 'fields', v_fields, 'consent', v_consent);
  update public.crm_form_submissions set contact_id = v_cid, status = case when s.is_test then 'test' else 'processed' end,
         processed_at = now(), result = v_result, error = null
   where id = s.id;
  return v_result;
end $function$;
comment on function public.crm_form_apply(bigint) is 'Applies one stored form submission (wave156) in one transaction: finds the contact by email (or creates one, source hub_form), creates or updates the MTL volunteering record when the form says so, fills in what the contact is missing without erasing anything (a phone only when they have none, so a form cannot add a number to someone else''s record), records express consent with the form''s name when the box was ticked (never for someone who unsubscribed), writes custom fields, signs the person up (status TBD) for the events they picked, and adds a timeline entry. Idempotent: a processed submission returns its result. Service role only (form-submit).';
revoke all on function public.crm_form_apply(bigint) from public, anon, authenticated;
grant execute on function public.crm_form_apply(bigint) to service_role;

-- ---------- merging two contacts also moves their fields and submissions ----------
do $$
declare def text;
begin
  select pg_get_functiondef('public.crm_merge_contacts(bigint, bigint)'::regprocedure) into def;
  if position('crm_contact_fields' in def) = 0 then
    def := replace(def, 'update public.crm_contact_orgs set contact_id = p_keep where contact_id = p_drop; get diagnostics n_org = row_count;',
      'update public.crm_contact_orgs set contact_id = p_keep where contact_id = p_drop; get diagnostics n_org = row_count;' || E'\n' ||
      '  delete from public.crm_contact_fields cf where cf.contact_id = p_drop and exists (select 1 from public.crm_contact_fields x where x.contact_id = p_keep and x.field_id = cf.field_id);' || E'\n' ||
      '  update public.crm_contact_fields set contact_id = p_keep where contact_id = p_drop;' || E'\n' ||
      '  update public.crm_form_submissions set contact_id = p_keep where contact_id = p_drop;' || E'\n' ||
      '  update public.crm_email_sends set contact_id = p_keep where contact_id = p_drop;');
    if position('crm_contact_fields' in def) = 0 then raise exception 'crm_merge_contacts: the anchor line was not found'; end if;
    execute def;
  end if;
end $$;

-- ---------- the fields forms and Keela need ----------
insert into public.crm_fields (key, label, type, options, help, sort, created_by) values
  ('instagram', 'Instagram', 'text', '[]', 'Their handle, so the team can tag them in event photos.', 10, 'wave156'),
  ('photo_consent', 'Photos and videos on social media', 'yes_no', '[]', 'Yes if they are okay with photos or videos of them being shared on our social media. Not a requirement to volunteer.', 20, 'wave156'),
  ('age_16_plus', '16 or older', 'yes_no', '[]', 'Asked instead of a birth date.', 30, 'wave156'),
  ('gta_area', 'Part of the GTA', 'choice', '["Downtown Toronto", "Midtown (Yonge-Eglinton)", "North York", "East York", "York", "Etobicoke", "Scarborough"]', null, 40, 'wave156'),
  ('days_available', 'Days available', 'multi', '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]', null, 50, 'wave156'),
  ('food_nonprofit_experience', 'Food non-profit experience', 'long_text', '[]', null, 60, 'wave156'),
  ('support_note', 'Anything we should know to support them', 'long_text', '[]', 'Asked instead of health concerns. Only staff with the CRM see it.', 70, 'wave156'),
  ('rally_paper_team', 'Rally Paper team', 'choice', '["Challengers (Live Physical Challenges)", "Logic & Trivia", "Quest", "Treasurer", "Online Challenges"]', 'From Keela.', 80, 'wave156'),
  ('donor_readiness', 'Donor readiness', 'choice', '["R", "SP", "NR"]', 'Keela''s code as the team entered it (R, SP or NR).', 90, 'wave156')
on conflict (key) do nothing;

insert into public.crm_contact_fields (contact_id, field_id, value, source, updated_by)
select c.id, f.id, to_jsonb(btrim(c.legacy_refs -> 'keela' ->> f.key)), 'keela', 'wave156'
  from public.crm_contacts c join public.crm_fields f on f.key in ('rally_paper_team', 'donor_readiness')
 where c.merged_into is null and nullif(btrim(coalesce(c.legacy_refs -> 'keela' ->> f.key, '')), '') is not null
on conflict (contact_id, field_id) do nothing;

-- ---------- the first three forms, as drafts: the team reviews them and publishes ----------
insert into public.crm_forms (slug, title, intro, lang, kind, status, questions, consent, thank_you, settings, created_by, updated_by) values
('volunteer', 'Volunteer with Welfare Avenue',
 'Welfare Avenue serves free, home-cooked meals to unhoused and low-income neighbours in Montreal. Tell us how you would like to help and which Sundays work for you.',
 'en', 'volunteer', 'draft',
 '[{"id": "first_name", "type": "text", "label": "First name", "required": true, "to": "contact.first_name"},
   {"id": "last_name", "type": "text", "label": "Last name", "required": true, "to": "contact.last_name"},
   {"id": "email", "type": "email", "label": "Email", "required": true, "to": "contact.email"},
   {"id": "phone", "type": "phone", "label": "Phone", "help": "We text the week of a serving.", "required": true, "to": "contact.phone"},
   {"id": "roles", "type": "multi", "label": "How would you like to help?", "required": true, "to": "volunteer.roles",
    "options": [{"v": "server", "l": "Serving food"}, {"v": "cook", "l": "Cooking"}, {"v": "driver", "l": "Driving (picking up and dropping off food)"}, {"v": "dishwasher", "l": "Washing dishes"}, {"v": "photographer", "l": "Taking photos"}, {"v": "community_debrief", "l": "Community debrief"}]},
   {"id": "dates", "type": "serving_dates", "label": "Which Sundays can you serve?", "help": "Servers arrive by 12:00. Pick as many as you like; we confirm each one before the day.", "required": false, "to": "volunteer.dates"},
   {"id": "instagram", "type": "text", "label": "Instagram", "help": "So we can tag you in event photos.", "required": false, "to": "field:instagram"},
   {"id": "comments", "type": "long_text", "label": "Anything else we should know?", "required": false, "to": "note"}]',
 '{"ask": true, "required": false, "label": "Yes, Welfare Avenue can email me news, volunteer call-outs and ways to help. I can unsubscribe at any time."}',
 'Thank you for signing up to serve with Welfare Avenue. Our team will confirm your Sundays before the day.',
 '{"volunteer_record": true, "serving_location": "Montreal", "city": "Montreal", "tags": [], "confirm": false}', 'wave156', 'wave156'),
('toronto-volunteer', 'Volunteer in Toronto',
 'Welfare Avenue is bringing free food events to Toronto. We are looking for volunteers to help serve food to unhoused and low-income communities across the GTA.',
 'en', 'volunteer', 'draft',
 '[{"id": "first_name", "type": "text", "label": "First name", "required": true, "to": "contact.first_name"},
   {"id": "last_name", "type": "text", "label": "Last name", "required": true, "to": "contact.last_name"},
   {"id": "email", "type": "email", "label": "Email", "required": true, "to": "contact.email"},
   {"id": "phone", "type": "phone", "label": "Phone", "required": true, "to": "contact.phone"},
   {"id": "gta_area", "type": "choice", "label": "Which part of the GTA do you live in?", "required": true, "to": "field:gta_area",
    "options": ["Downtown Toronto", "Midtown (Yonge-Eglinton)", "North York", "East York", "York", "Etobicoke", "Scarborough"]},
   {"id": "age_16", "type": "yes_no", "label": "Are you 16 or older?", "required": true, "to": "field:age_16_plus"},
   {"id": "photos", "type": "yes_no", "label": "Are you okay with photos or videos of you being shared on our social media?", "help": "Not a requirement to volunteer.", "required": true, "to": "field:photo_consent"},
   {"id": "days", "type": "multi", "label": "Which days of the week are you available to volunteer?", "required": true, "to": "field:days_available",
    "options": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]},
   {"id": "experience", "type": "long_text", "label": "Have you volunteered with a food non-profit before?", "help": "A line or two is plenty.", "required": false, "to": "field:food_nonprofit_experience"},
   {"id": "support", "type": "long_text", "label": "Anything we should know to support you?", "help": "Only our team sees this.", "required": false, "to": "field:support_note"}]',
 '{"ask": true, "required": false, "label": "Yes, Welfare Avenue can email me news, volunteer call-outs and ways to help. I can unsubscribe at any time."}',
 'Thank you for registering to volunteer with Welfare Avenue in Toronto. We will be in touch as events are planned.',
 '{"volunteer_record": false, "city": "Toronto", "tags": ["toronto"], "confirm": false}', 'wave156', 'wave156'),
('newsletter', 'Get the Welfare Avenue newsletter',
 'News from our kitchens and the streets we serve, volunteer call-outs and ways to help, about once a month.',
 'en', 'newsletter', 'draft',
 '[{"id": "first_name", "type": "text", "label": "First name", "required": true, "to": "contact.first_name"},
   {"id": "last_name", "type": "text", "label": "Last name", "required": false, "to": "contact.last_name"},
   {"id": "email", "type": "email", "label": "Email", "required": true, "to": "contact.email"},
   {"id": "language", "type": "choice", "label": "Which language would you like?", "required": false, "to": "contact.language", "options": [{"v": "en", "l": "English"}, {"v": "fr", "l": "Français"}]}]',
 '{"ask": true, "required": true, "label": "Yes, Welfare Avenue can email me its newsletter, volunteer call-outs and ways to help. I can unsubscribe at any time."}',
 'You are on the list. Watch your inbox for our next newsletter.',
 '{"tags": [], "confirm": false}', 'wave156', 'wave156')
on conflict (slug) do nothing;

-- the trigger function is not callable on its own (security advisor, 28/09/26)
revoke all on function public.crm_forms_stamp() from public, anon, authenticated;
comment on function public.crm_forms_stamp() is 'Trigger on crm_forms (wave156): updated_at, the go-live checks (an email question; a newsletter asks for permission), published_at/by and closed_at, and a change_log line for every status change.';
