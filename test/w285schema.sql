-- wave285: what build/data/wa285_toronto.sql, its undo and the wave285 assertions touch beyond test/w281schema.sql and test/w283schema.sql, for the
-- offline proof in test/w285sql.mjs (PGlite). Loaded after test/w281schema.sql, build/data/wa281_rules.sql, test/w283schema.sql and
-- build/data/wa283_page.sql (both waves are built on this branch, not live yet); test/w285sql.mjs also loads it without wave281, to see the
-- migration stop. Copied read-only from live (zwnmulmnvopclzcvytce) on 06/11/26: the column lists and constraints that matter, the
-- toronto-volunteer form's settings, consent and questions, and in section 4 the pg_get_functiondef text of crm_form_apply and
-- wa209_volunteer_apply (the same text as build/data/wa285_undo.sql; test/w285sql.mjs checks each md5 against live) with their live grants and
-- comment (wa209_volunteer_apply has none on live). volunteer_people is a view on live whose write trigger keeps the volunteer profile and its
-- CRM contact in step; here a stand-in trigger does that part. wa171_role_label, wa209_volunteer_roles and account_link_user are stand-ins.
-- Every person in section 5 is invented (Fixture ..., Tate Fixture, example.invalid). Not a copy of live: do not apply it anywhere but the
-- offline PGlite database.

-- 1. tables (live columns, 06/11/26)
alter table public.volunteer_applications add column cv_url text, add column cv_path text, add column language text, add column mail_id bigint,
  add column candidate_id bigint, add column status_note text, add column handled_by text, add column handled_at timestamptz, add column org_id bigint, add column org_text text;
alter table public.volunteer_applications add constraint volunteer_applications_source_ref_key unique (source_ref);
create table public.team_members (
  id bigint generated always as identity primary key, name text not null, email text, department text, role text, active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.request_types (
  id bigint generated always as identity primary key, key text not null unique, label text not null, department text not null, description text,
  fields jsonb not null default '[]'::jsonb, statuses jsonb not null default '["Requested", "In progress", "Done"]'::jsonb, default_status text default 'Requested'::text,
  source text, enabled boolean not null default true, sort integer default 0, default_assignee text, channel text, channel_mode text not null default 'full'::text
);
create table public.dept_requests (
  id bigint generated always as identity primary key, type_key text references public.request_types(key), department text not null, title text not null,
  details jsonb not null default '{}'::jsonb, status text, requested_by text, created_at timestamptz default now(), updated_at timestamptz, updated_by text,
  done boolean not null default false, done_at timestamptz, assignee text, requested_email text, needed_by date, priority text not null default 'normal'::text,
  source text, mail_id bigint, slack jsonb
);

-- 2. volunteer_people: new rows get an id, and (as live's write trigger does) a CRM contact: the one with that email that has no volunteer yet, or a
--    new one; contact_id and crm_contacts.volunteer_id link the two, so crm_form_apply and wa209_volunteer_apply find the contact as they do on live
create sequence public.volunteer_people_w285_seq start 9001;
alter table public.volunteer_people alter column id set default nextval('public.volunteer_people_w285_seq');
create or replace function public.w285_vp_write() returns trigger language plpgsql set search_path to '' as $f$
declare v_cid bigint;
begin
  if new.contact_id is null then
    select c.id into v_cid from public.crm_contacts c
     where c.merged_into is null and c.volunteer_id is null
       and exists (select 1 from unnest(c.emails) e where lower(btrim(e)) in (select lower(btrim(x)) from unnest(coalesce(new.emails, '{}'::text[])) x))
     order by c.id limit 1;
    if v_cid is null then
      insert into public.crm_contacts (full_name, emails, phones, kinds, tags, source)
      values (coalesce(new.full_name, '(no name)'), coalesce(new.emails, '{}'::text[]), coalesce(new.phones, '{}'::text[]), array['volunteer'], coalesce(new.tags, '{}'::text[]), 'hub_volunteers')
      returning id into v_cid;
    end if;
    update public.crm_contacts set volunteer_id = new.id where id = v_cid;
    new.contact_id := v_cid;
  end if;
  return new;
end $f$;
create trigger w285_vp_write before insert on public.volunteer_people for each row execute function public.w285_vp_write();

-- 3. stand-ins for functions the slice calls but never needs the real work of
create or replace function public.wa171_role_label(p_role text, p_lang text) returns text language sql immutable set search_path to '' as
$f$ select initcap(replace(coalesce(p_role, ''), '_', ' ')) $f$;   -- stand-in
create or replace function public.wa209_volunteer_roles(p_text text) returns text[] language sql immutable set search_path to '' as
$f$ select '{}'::text[] $f$;   -- stand-in
create or replace function public.account_link_user(p_uid uuid, p_lang text) returns bigint language sql stable set search_path to '' as
$f$ select null::bigint $f$;   -- stand-in (no test submission is from a website account)

-- live, these triggers call edge functions (team-inbox and notify, through call_edge); test/w285live.sql switches them off by name before its test
-- answers, so they are here too, doing nothing
create or replace function public.w285_noop_trigger() returns trigger language plpgsql set search_path to '' as $f$ begin return null; end $f$;
create trigger trg_wa123_request_new after insert on public.dept_requests for each row execute function public.w285_noop_trigger();
create trigger trg_wa123_request_update after update on public.dept_requests for each row execute function public.w285_noop_trigger();
create trigger trg_wa89_request_filed after insert on public.dept_requests for each row execute function public.w285_noop_trigger();
create trigger trg_wa239_volunteer_applied after insert on public.volunteer_applications for each row execute function public.w285_noop_trigger();

-- 4. the two live functions wave285 changes (pg_get_functiondef, 06/11/26), with their live grants and comment
CREATE OR REPLACE FUNCTION public.crm_form_apply(p_submission_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  s record; f record; m jsonb;
  v_em text; v_fn text; v_ln text; v_full text; v_ph text; v_city text; v_src text;
  v_roles text[]; v_tags text[]; v_role text; v_pick text[]; v_consent boolean;
  v_cid bigint; v_created boolean := false; v_vid bigint; v_vcreated boolean := false;
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_roster jsonb := '[]'::jsonb; v_fields jsonb := '[]'::jsonb; v_body text; v_result jsonb;
  fk text; fid bigint; ev record; rid bigint;
  v_uid uuid; v_acid bigint; v_own boolean := false;   -- wave194: a signed-in website account
  v_cand bigint; v_pos_id bigint; v_pos_title text; v_app text; v_dup bigint; v_links text[];   -- wave216: an application
  v_test boolean; v_rtext text; v_req jsonb; v_rtype record; v_rid bigint; v_who text; v_cnt text; v_det jsonb; v_rtitle text;   -- wave261
  v_qty int; v_what text; v_gift bigint; v_gnote text;
begin
  select * into s from public.crm_form_submissions where id = p_submission_id for update;
  if not found then raise exception 'no such submission'; end if;
  if s.status in ('processed', 'test') then return s.result; end if;
  select * into f from public.crm_forms where id = s.form_id;
  m := coalesce(s.mapped, '{}'::jsonb);
  v_em := lower(btrim(coalesce(m #>> '{contact,email}', '')));
  if v_em !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'an email address is needed'; end if;
  -- wave261: an address at a reserved test domain (RFC 2606 and 6761: example.com/.org/.net, .test, .example, .invalid)
  -- can never be a real person: it is handled as a test everywhere (no Request, no pledge, no applicant), so a check of
  -- a live page never reaches Slack, the gift count or Applicants received
  v_test := coalesce(s.is_test, false) or v_em ~ '@([a-z0-9-]+\.)*(example\.(com|org|net)|[a-z0-9-]+\.(test|example|invalid))$';
  if v_test and not coalesce(s.is_test, false) then update public.crm_form_submissions set is_test = true where id = s.id; end if;
  v_fn := nullif(btrim(coalesce(m #>> '{contact,first_name}', '')), '');
  v_ln := nullif(btrim(coalesce(m #>> '{contact,last_name}', '')), '');
  v_full := nullif(btrim(concat_ws(' ', v_fn, v_ln)), '');
  v_ph := nullif(btrim(coalesce(m #>> '{contact,phone}', '')), '');
  v_city := nullif(btrim(coalesce(m #>> '{contact,city}', f.settings ->> 'city', '')), '');
  v_roles := coalesce((select array_agg(distinct x) from jsonb_array_elements_text(coalesce(m -> 'roles', '[]'::jsonb)) x), '{}');
  v_tags := coalesce((select array_agg(distinct x) from jsonb_array_elements_text(coalesce(f.settings -> 'tags', '[]'::jsonb)) x), '{}');
  v_consent := coalesce((m ->> 'consent')::boolean, false);
  v_src := 'form:' || f.slug;
  v_role := coalesce((select x from unnest(array['cook', 'driver', 'server', 'dishwasher', 'photographer', 'videographer', 'community_debrief', 'community_talker']) with ordinality t(x, o)
                       where x = any(v_roles) order by o limit 1), 'server');
  -- wave244: two roles picked (the forms allow 2): the roster row waits as 'volunteer' and the coordinator chooses
  v_pick := coalesce((select array_agg(x order by o) from unnest(array['cook', 'driver', 'server', 'dishwasher', 'photographer', 'videographer', 'community_debrief']) with ordinality t(x, o) where x = any(v_roles)), '{}');
  if cardinality(v_pick) > 1 then v_role := 'volunteer'; end if;

  -- 1. wave194: a signed-in website account fills in its own record (form-submit checked the sign-in);
  --    otherwise the contact with this email (never a merged one)
  v_uid := s.auth_user_id;
  if v_uid is not null then v_acid := public.account_link_user(v_uid, s.lang); end if;
  if v_acid is not null then
    v_cid := v_acid; v_own := true;
  else
  select c.id into v_cid from public.crm_contacts c
   where c.merged_into is null
     and (lower(btrim(c.primary_email)) = v_em or exists (select 1 from unnest(c.emails) x where lower(btrim(x)) = v_em))
   order by (lower(btrim(c.primary_email)) = v_em) desc, c.id
   limit 1;
  end if;

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
      first_name = case when v_own then coalesce(v_fn, c.first_name) else coalesce(nullif(c.first_name, ''), v_fn) end,
      last_name = case when v_own then coalesce(v_ln, c.last_name) else coalesce(nullif(c.last_name, ''), v_ln) end,
      full_name = case when v_own and (v_fn is not null or v_ln is not null) then btrim(concat_ws(' ', coalesce(v_fn, c.first_name), coalesce(v_ln, c.last_name)))
                       when coalesce(c.full_name, '') in ('', '(no name)') or lower(c.full_name) = v_em then coalesce(v_full, c.full_name) else c.full_name end,
      emails = case when exists (select 1 from unnest(c.emails) x where lower(btrim(x)) = v_em) then c.emails else coalesce(c.emails, '{}') || v_em end,
      phones = case when v_own and v_ph is not null then array[v_ph] || array_remove(coalesce(c.phones, '{}'), v_ph)
                    when v_ph is not null and cardinality(coalesce(c.phones, '{}')) = 0 then array[v_ph] else c.phones end,
      city = case when v_own then coalesce(nullif(btrim(coalesce(m #>> '{contact,city}', '')), ''), c.city) else coalesce(nullif(c.city, ''), v_city) end,
      province = case when v_own then coalesce(nullif(btrim(coalesce(m #>> '{contact,province}', '')), ''), c.province)
                      else coalesce(nullif(c.province, ''), nullif(btrim(coalesce(m #>> '{contact,province}', '')), '')) end,
      postal_code = case when v_own then coalesce(nullif(upper(btrim(coalesce(m #>> '{contact,postal_code}', ''))), ''), c.postal_code)
                         else coalesce(nullif(c.postal_code, ''), nullif(btrim(coalesce(m #>> '{contact,postal_code}', '')), '')) end,
      address = case when v_own then coalesce(nullif(btrim(coalesce(m #>> '{contact,address}', '')), ''), c.address)
                     else coalesce(nullif(c.address, ''), nullif(btrim(coalesce(m #>> '{contact,address}', '')), '')) end,
      language = case when v_own then coalesce(nullif(btrim(coalesce(m #>> '{contact,language}', '')), ''), c.language)
                      else coalesce(nullif(c.language, ''), nullif(btrim(coalesce(m #>> '{contact,language}', '')), '')) end,
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
  if v_consent and (v_created or v_own or coalesce((select email_status from public.crm_contacts where id = v_cid), '') <> 'unsubscribed') then
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
              jsonb_build_object('source', 'hub_form', 'form', f.slug, 'submission_id', s.id) || case when v_role = 'volunteer' and cardinality(v_pick) > 1 then jsonb_build_object('role_choices', to_jsonb(v_pick)) else '{}'::jsonb end)
      returning id into rid;
      v_roster := v_roster || jsonb_build_object('event_id', ev.id, 'date', ev.event_date, 'roster_id', rid, 'role', v_role);
    end loop;
  end if;

  -- 7b. wave216: an application form puts the person on the Applications board (HR centre) as a New card, with the
  --     role they picked, their CV (hub-mail, read later by recruit-actions cv_scan), links and why. A second application
  --     for the same role in 90 days adds to the open card instead. A test submission is a practice card (Clear practice).
  if f.kind = 'application' then
    v_app := coalesce(m #>> '{application,position}', '');
    if v_app ~ '^p:[0-9]+$' then select p.id, p.title into v_pos_id, v_pos_title from public.hub_positions p where p.id = substr(v_app, 3)::bigint; end if;
    v_links := coalesce((select array_agg(btrim(x)) from jsonb_array_elements_text(coalesce(m #> '{application,links}', '[]'::jsonb)) x where btrim(x) <> ''), '{}');
    if not v_test then
      select c.id into v_dup from public.hub_candidates c
       where lower(c.email) = v_em and not coalesce(c.practice, false) and c.created_at > now() - interval '90 days'
         and coalesce(c.status, 'new') not in ('declined', 'withdrawn') and c.position_id is not distinct from v_pos_id
       order by c.created_at desc limit 1;
    end if;
    if v_dup is not null then
      update public.hub_candidates c set
        notes = btrim(coalesce(c.notes, '') || E'\n' || 'Applied again on the website ("' || f.title || '", ' || to_char(v_today, 'DD Mon YYYY') || ').'),
        cv_path = coalesce(m #>> '{application,cv,path}', c.cv_path), cv_name = coalesce(m #>> '{application,cv,name}', c.cv_name),
        cv_read_at = case when m #>> '{application,cv,path}' is not null then null else c.cv_read_at end,
        links = (select coalesce(array_agg(distinct x), '{}') from unnest(coalesce(c.links, '{}') || v_links) x),
        phone = coalesce(nullif(c.phone, ''), v_ph), updated_at = now(), updated_by = v_src
       where c.id = v_dup;
      v_cand := v_dup;
    else
      insert into public.hub_candidates (name, email, phone, role, position_id, source, summary, links, cv_path, cv_name, status, stage_at, created_at, notes, updated_at, updated_by, practice)
      values (left(coalesce(v_full, v_em), 120), v_em, v_ph, coalesce(v_pos_title, case when f.lang = 'fr' then 'Candidature générale' else 'General application' end), v_pos_id, 'website',
              nullif(left(coalesce(m #>> '{application,why}', ''), 4000), ''), v_links, m #>> '{application,cv,path}', m #>> '{application,cv,name}',
              'new', now(), s.created_at, 'Applied on the website ("' || f.title || '", ' || to_char(v_today, 'DD Mon YYYY') || ').' || coalesce(E'\n' || coalesce((select q ->> 'label' from jsonb_array_elements(f.questions) q where q ->> 'to' = 'note' limit 1) || ': ', '') || nullif(m ->> 'note', ''), ''),
              now(), v_src, v_test)
      returning id into v_cand;
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('candidate', v_cand::text, 'added', null, coalesce(v_full, v_em) || ' for ' || coalesce(v_pos_title, 'a general application') || ' (website form ' || f.slug || case when v_test then ', test' else '' end || ')', v_src);
    end if;
  end if;

  -- 7c. wave239: a volunteer form that keeps a volunteering record also files the application in Applicants received
  --     (wa209_volunteer_apply: the application, its timeline line, the person tagged "volunteer applicant"), so the
  --     Volunteer Manager sees every applicant in one place. Not for a test, and not twice in a week for one person.
  --     wave261: a form outside the servings (the Holiday Gift Basket Drive) names what they applied for with
  --     settings.role_text and the choices of the question settings.role_q ("Holiday Gift Basket Drive: Wrapping gifts").
  if f.kind = 'volunteer' and coalesce((f.settings ->> 'volunteer_record')::boolean, false) and not v_test
     and not exists (select 1 from public.volunteer_applications a where lower(coalesce(a.email, '')) = v_em and a.applied_at > s.created_at - interval '7 days') then
    v_rtext := nullif(btrim(coalesce(f.settings ->> 'role_text', '')), '');
    if v_rtext is not null and coalesce(f.settings ->> 'role_q', '') <> '' then
      v_rtext := v_rtext || coalesce(': ' || (select string_agg(coalesce(o ->> 'l', x), ', ' order by ord)
                   from jsonb_array_elements_text(case when jsonb_typeof(s.answers -> (f.settings ->> 'role_q')) = 'array' then s.answers -> (f.settings ->> 'role_q') else '[]'::jsonb end) with ordinality t(x, ord)
                   left join lateral (select o from jsonb_array_elements(coalesce((select q -> 'options' from jsonb_array_elements(f.questions) q where q ->> 'id' = f.settings ->> 'role_q' limit 1), '[]'::jsonb)) o where o ->> 'v' = x limit 1) oo on true), '');
    end if;
    begin
      perform public.wa209_volunteer_apply(jsonb_build_object(
        'name', coalesce(v_full, v_em), 'email', v_em, 'phone', v_ph, 'roles', to_jsonb(v_roles),
        'role_text', coalesce(v_rtext, array_to_string((select array_agg(public.wa171_role_label(x, 'en') order by o) from unnest(v_roles) with ordinality t(x, o)), ', ')),
        'source', 'website', 'source_ref', 'form:' || s.id, 'applied_at', s.created_at, 'message', nullif(m ->> 'note', ''),
        'language', coalesce(f.lang, 'en'), 'by', v_src));
    exception when others then
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('form_submission', s.id::text, 'applicant', null, 'Applicants received: ' || left(sqlerrm, 300), v_src);
    end;
  end if;

  -- 7d. wave261: a pledge of gifts in kind (settings.gift_pledge, the campaign in settings.campaign): a pledged
  --     campaign_gifts row that waits for a staff Confirm (an unconfirmed pledge is never counted on the website)
  if coalesce((f.settings ->> 'gift_pledge')::boolean, false) and coalesce(f.settings ->> 'campaign', '') ~ '^[a-z0-9][a-z0-9-]{0,39}$' and not v_test then
    v_qty := case when coalesce(s.answers ->> 'how_many', '') ~ '^[0-9]{1,7}(\.[0-9]+)?$' then round((s.answers ->> 'how_many')::numeric)::int end;
    if v_qty is not null and v_qty > 0 and v_qty <= 1000000 then
      v_what := nullif(concat_ws(', ', (select string_agg(coalesce(o ->> 'l', x), ', ' order by ord)
                   from jsonb_array_elements_text(case when jsonb_typeof(s.answers -> 'what') = 'array' then s.answers -> 'what' else '[]'::jsonb end) with ordinality t(x, ord)
                   left join lateral (select o from jsonb_array_elements(coalesce((select q -> 'options' from jsonb_array_elements(f.questions) q where q ->> 'id' = 'what' limit 1), '[]'::jsonb)) o where o ->> 'v' = x limit 1) oo on true),
                 nullif(btrim(coalesce(s.answers ->> 'what_other', '')), '')), '');
      v_gnote := 'Pledged on the website form "' || f.title || '" on ' || to_char(v_today, 'DD/MM/YY') || '.'
        || coalesce(' ' || (select d ->> 'label' || ': ' || (d ->> 'value') from jsonb_array_elements(coalesce(s.display, '[]'::jsonb)) d
                             where d ->> 'label' = (select q ->> 'label' from jsonb_array_elements(f.questions) q where q ->> 'id' = 'dropoff' limit 1) limit 1) || '.', '')
        || coalesce(' Area: ' || nullif(btrim(coalesce(s.answers ->> 'area', '')), '') || '.', '')
        || coalesce(' Ready: ' || nullif(btrim(coalesce(s.answers ->> 'when', '')), '') || '.', '');
      insert into public.campaign_gifts (slug, quantity, what, given_by, contact_id, status, note, source_response_id, logged_by, updated_by)
      values (f.settings ->> 'campaign', v_qty, left(v_what, 300), left(coalesce(nullif(btrim(coalesce(s.answers ->> 'organization', '')), ''), v_full, v_em), 200), v_cid, 'pledged', left(v_gnote, 2000), s.id, v_src, v_src)
      on conflict do nothing
      returning id into v_gift;
      if v_gift is not null then
        insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
        values ('campaign_gift', v_gift::text, 'added', null, v_qty || ' ' || coalesce(v_what, 'gifts') || ' (pledged on the website, waiting to confirm) for ' || (f.settings ->> 'campaign'), v_src);
      end if;
    end if;
  end if;

  -- 7e. wave261: settings.request files a Request for the team (request_types: department, assignee), announced the way
  --     every new Request is; the details leave out the email and the phone (they are on the CRM contact)
  v_req := case when jsonb_typeof(f.settings -> 'request') = 'object' then f.settings -> 'request' end;
  if v_req is not null and not v_test then
    select * into v_rtype from public.request_types where key = v_req ->> 'type' and enabled;
    if found then
      v_who := coalesce(nullif(btrim(coalesce(s.answers ->> (v_req ->> 'who'), '')), ''), v_fn, v_full, split_part(v_em, '@', 1));
      v_cnt := case when coalesce(v_req ->> 'count', '') <> '' and coalesce(s.answers ->> (v_req ->> 'count'), '') ~ '^[0-9]{1,7}(\.[0-9]+)?$'
                    then round((s.answers ->> (v_req ->> 'count'))::numeric)::text || ' ' || coalesce(nullif(v_req ->> 'count_word', ''), '') end;
      v_rtitle := left(coalesce(nullif(v_req ->> 'title', ''), f.title) || ': ' || v_who || coalesce(' (' || btrim(v_cnt) || ')', ''), 200);
      select coalesce(jsonb_object_agg(k, val), '{}'::jsonb) into v_det from (
        select left(d ->> 'label', 80) as k, left(coalesce(d ->> 'value', ''), 500) as val
          from jsonb_array_elements(coalesce(s.display, '[]'::jsonb)) with ordinality t(d, ord)
         where d ->> 'label' not in (select q ->> 'label' from jsonb_array_elements(f.questions) q where q ->> 'to' in ('contact.email', 'contact.phone') or q ->> 'type' in ('email', 'phone'))
           and d ->> 'label' not in ('Email permission', 'Permission courriel')
           and d ->> 'label' not in (select q ->> 'label' from jsonb_array_elements(f.questions) q where q ->> 'id' = 'rule_ok')
         order by ord) x;
      v_det := v_det || jsonb_build_object('Form', f.title, 'In the CRM', 'Contact ' || v_cid || ' (email and phone there)');
      insert into public.dept_requests (type_key, department, title, details, status, requested_by, requested_email, source, assignee)
      values (v_rtype.key, v_rtype.department, v_rtitle, v_det, coalesce(v_rtype.default_status, 'requested'), left(coalesce(v_full, v_em), 120) || ' (website)', null, v_src, v_rtype.default_assignee)
      returning id into v_rid;
    end if;
  end if;

  -- 8. the timeline
  select string_agg(coalesce(d ->> 'label', '') || ': ' || coalesce(d ->> 'value', ''), E'\n' order by o) into v_body
    from jsonb_array_elements(coalesce(s.display, '[]'::jsonb)) with ordinality t(d, o);
  insert into public.crm_interactions (contact_id, kind, direction, channel, subject, body, occurred_at, source, source_ref, meta, created_by)
  values (v_cid, 'form', 'in', 'web', 'Filled in "' || f.title || '"' || case when v_test then ' (test)' else '' end, v_body, s.created_at, 'hub_form', 'form:' || s.id,
          jsonb_build_object('form_id', f.id, 'slug', f.slug, 'submission_id', s.id, 'consent', v_consent, 'is_test', v_test, 'account', v_own), v_src);
  update public.crm_contacts set last_activity_at = greatest(coalesce(last_activity_at, s.created_at), s.created_at) where id = v_cid;

  v_result := jsonb_build_object('contact_id', v_cid, 'created', v_created, 'volunteer_id', v_vid, 'volunteer_created', v_vcreated,
                                 'candidate_id', v_cand, 'roster', v_roster, 'fields', v_fields, 'consent', v_consent, 'account', v_own,
                                 'gift_id', v_gift, 'request_id', v_rid, 'test', v_test);
  update public.crm_form_submissions set contact_id = v_cid, status = case when v_test then 'test' else 'processed' end,
         processed_at = now(), result = v_result, error = null
   where id = s.id;
  return v_result;
end $function$
;
revoke all on function public.crm_form_apply(bigint) from public, anon, authenticated;
grant execute on function public.crm_form_apply(bigint) to service_role;
comment on function public.crm_form_apply(bigint) is 'Applies one form submission (wave156): the contact, the MTL volunteering record, roster sign-ups, custom fields, the consent and a timeline entry, in one transaction. wave194: a submission from a signed-in website account (auth_user_id) uses that account''s own record and saves what they typed to it (names, phone first, address, city, province, postal code, language); its ticked permission box counts even after an unsubscribe. Anyone else''s submission only fills gaps and never re-subscribes. wave216: an application form adds a card to the Applications board; wave239: a volunteer form with a volunteering record files the application in Applicants received. wave261 (16/10/26): settings.request files a Request (request_types, assigned to its default assignee) without the email or phone; settings.gift_pledge adds a pledged campaign_gifts row waiting for a Confirm; settings.role_text names what a volunteer applied for; an address at a reserved test domain (example.com/.org/.net, .test, .example, .invalid) is a test (no Request, pledge or applicant; the submission is marked is_test). Called by form-submit with the service role.';
CREATE OR REPLACE FUNCTION public.wa209_volunteer_apply(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ref text := nullif(btrim(p->>'source_ref'), '');
  v_name text := btrim(coalesce(p->>'name', ''));
  v_email text := lower(nullif(btrim(p->>'email'), ''));
  v_phone text := nullif(btrim(p->>'phone'), '');
  v_digits text; v_roles text[]; v_keys text[]; v_src text; v_when timestamptz; v_tags text[]; v_note text; v_lang text;
  v_pid bigint; v_cid bigint; v_new boolean := false; v_app bigint; v_by text; v_existing record; v_role_label text;
begin
  if not (session_user <> 'authenticator' or coalesce(auth.role(), '') = 'service_role' or public.is_wa_staff()) then raise exception 'not allowed'; end if;
  v_by := coalesce(nullif(p->>'by', ''), lower(auth.jwt() ->> 'email'), 'applications-intake');
  if v_ref is not null then
    select id, person_id, contact_id into v_existing from public.volunteer_applications where source_ref = v_ref;
    if found then return jsonb_build_object('ok', true, 'to', 'volunteers', 'duplicate', true, 'application_id', v_existing.id, 'person_id', v_existing.person_id, 'contact_id', v_existing.contact_id); end if;
  end if;
  if v_name = '' then v_name := coalesce(split_part(v_email, '@', 1), 'Volunteer applicant'); end if;
  v_digits := right(regexp_replace(coalesce(v_phone, ''), '\D', '', 'g'), 10);
  select coalesce(array_agg(distinct x), '{}') into v_roles from jsonb_array_elements_text(coalesce(p->'roles', '[]'::jsonb)) x
   where x in ('team_leader', 'cook', 'driver', 'server', 'dishwasher', 'photographer', 'videographer', 'community_talker', 'community_debrief', 'volunteer');
  if cardinality(v_roles) = 0 then v_roles := public.wa209_volunteer_roles(coalesce(p->>'role_text', '')); end if;
  if cardinality(v_roles) = 0 then v_roles := array['volunteer']; end if;
  v_keys := array_remove(v_roles, 'volunteer');
  v_src := lower(coalesce(nullif(btrim(p->>'source'), ''), 'manual'));
  v_when := coalesce(nullif(p->>'applied_at', '')::timestamptz, now());
  v_tags := array['volunteer applicant', v_src, 'applied ' || to_char(v_when at time zone 'America/Toronto', 'YYYY-MM')];
  v_role_label := coalesce(nullif(btrim(p->>'role_text'), ''), array_to_string(v_roles, ', '));
  v_note := 'Applied for ' || v_role_label || ' (' || case v_src when 'cabm' then 'CABM' when 'fcabq' then 'Je Bénévole' when 'email' then 'by email' when 'manual' then 'added by hand' else v_src end || ') on ' || to_char(v_when at time zone 'America/Toronto', 'DD/MM/YY');
  v_lang := case when coalesce(p->>'language', '') ~* '^(fr|fran|french)' then 'fr' when coalesce(p->>'language', '') ~* '^(en|eng|angl)' then 'en' else null end;
  if v_email is not null then
    select vp.id, vp.contact_id into v_pid, v_cid from public.volunteer_people vp
     where exists (select 1 from unnest(vp.emails) e where lower(btrim(e)) = v_email) order by vp.id limit 1;
  end if;
  if v_pid is null and length(v_digits) = 10 then
    select vp.id, vp.contact_id into v_pid, v_cid from public.volunteer_people vp
     where exists (select 1 from unnest(vp.phones) ph where right(regexp_replace(ph, '\D', '', 'g'), 10) = v_digits) order by vp.id limit 1;
  end if;
  if v_pid is null then
    insert into public.volunteer_people (full_name, emails, phones, roles, tags, needs_review, review_note, last_applied, joined_note)
    values (v_name, case when v_email is null then '{}' else array[v_email] end, case when v_phone is null then '{}' else array[v_phone] end,
            v_keys, v_tags, true, v_note, (v_when at time zone 'America/Toronto')::date, v_note)
    returning id, contact_id into v_pid, v_cid;
    v_new := true;
    update public.crm_contacts set source = v_src, created_by = coalesce(created_by, v_by) where id = v_cid and source = 'hub_volunteers';
  else
    update public.volunteer_people vp set
      roles = coalesce((select array_agg(distinct x) from unnest(coalesce(vp.roles, '{}') || v_keys) x), '{}'),
      tags = coalesce((select array_agg(distinct x) from unnest(coalesce(vp.tags, '{}') || v_tags) x), '{}'),
      phones = case when v_phone is not null and not exists (select 1 from unnest(vp.phones) ph where right(regexp_replace(ph, '\D', '', 'g'), 10) = v_digits) then vp.phones || v_phone else vp.phones end,
      emails = case when v_email is not null and not exists (select 1 from unnest(vp.emails) e where lower(btrim(e)) = v_email) then vp.emails || v_email else vp.emails end,
      last_applied = greatest(coalesce(vp.last_applied, '1900-01-01'::date), (v_when at time zone 'America/Toronto')::date),
      needs_review = true, review_note = v_note
    where vp.id = v_pid;
  end if;
  if v_lang is not null then update public.crm_contacts set language = coalesce(language, v_lang) where id = v_cid; end if;
  insert into public.crm_interactions (contact_id, kind, direction, channel, subject, body, occurred_at, source, source_ref, meta, created_by)
  values (v_cid, 'form', 'in', case when v_src in ('cabm', 'fcabq') then v_src when v_src = 'email' then 'email' else 'hub' end, left(v_note, 200), nullif(p->>'message', ''), v_when, v_src, v_ref,
          jsonb_strip_nulls(jsonb_build_object('roles', v_roles, 'role_text', p->>'role_text', 'cv_url', nullif(p->>'cv_url', ''), 'language', p->>'language', 'mail_id', p->'mail_id', 'candidate_id', p->'candidate_id', 'wave', 'wave209')), v_by);
  insert into public.volunteer_applications (person_id, contact_id, name, email, phone, roles, role_text, source, source_ref, applied_at, message, cv_url, cv_path, language, mail_id, candidate_id, created_by)
  values (v_pid, v_cid, v_name, v_email, v_phone, v_roles, nullif(p->>'role_text', ''), v_src, v_ref, v_when, nullif(p->>'message', ''), nullif(p->>'cv_url', ''), nullif(p->>'cv_path', ''), v_lang,
          nullif(p->>'mail_id', '')::bigint, nullif(p->>'candidate_id', '')::bigint, v_by)
  returning id into v_app;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('volunteer_application', v_app::text, 'received', null, v_name || ': ' || v_role_label || ' (' || v_src || ')' || case when v_new then ', new volunteer' else '' end, v_by);
  return jsonb_build_object('ok', true, 'to', 'volunteers', 'application_id', v_app, 'person_id', v_pid, 'contact_id', v_cid, 'new_person', v_new, 'roles', v_roles);
end $function$
;
revoke all on function public.wa209_volunteer_apply(jsonb) from public, anon;
grant execute on function public.wa209_volunteer_apply(jsonb) to authenticated, service_role;

-- 5. fixture rows (invented people; the forms are live's wording)
insert into public.team_members (name, email, department, role, active) values
  ('Tate Fixture', 'tate.fixture@example.invalid', 'opsto', 'Ops Toronto', true),
  ('Tate Elsewhere', null, 'opsmtl', null, true),    -- another team: never picked
  ('Tate Former', null, 'opsto', null, false),       -- not active: never picked
  ('Other Fixture', null, 'opsto', null, true);
insert into public.request_types (key, label, department, description, fields, statuses, default_status, source, enabled, sort, default_assignee, channel, channel_mode) values
  ('serving-signup', 'Serving sign-up', 'opsmtl', null, '[]', '["Requested", "In progress", "Done"]', 'requested', 'wave191p', true, 20, null, null, 'full'),
  ('gift-drive', 'Gift Basket Drive', 'fundraising', null, '[]', '["Requested", "In progress", "Done"]', 'requested', 'wave261', true, 30, 'Amanda', null, 'brief');
insert into public.crm_fields (key, label, type, options, sort, created_by) values
  ('gta_area', 'GTA area', 'choice', '["Downtown Toronto", "Midtown (Yonge-Eglinton)", "North York", "East York", "York", "Etobicoke", "Scarborough"]', 100, 'wave156'),
  ('age_16_plus', '16 or older', 'yes_no', '[]', 100, 'wave156'),
  ('photo_consent', 'Photos on social media', 'yes_no', '[]', 100, 'wave156'),
  ('days_available', 'Days available', 'multi', '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]', 100, 'wave156'),
  ('food_nonprofit_experience', 'Food non-profit experience', 'long_text', '[]', 100, 'wave156'),
  ('support_note', 'Support note', 'long_text', '[]', 100, 'wave156');
insert into public.crm_forms (id, slug, title, intro, lang, kind, status, questions, consent, thank_you, settings, cover_photo_id, purpose) overriding system value values
  (851, 'toronto-volunteer', 'Volunteer in Toronto',
   'Welfare Avenue is bringing free food events to Toronto. We are looking for volunteers to help serve food to unhoused and low-income communities across the GTA.',
   'en', 'volunteer', 'closed',
   '[{"id": "first_name", "to": "contact.first_name", "type": "text", "label": "First name", "required": true},
     {"id": "last_name", "to": "contact.last_name", "type": "text", "label": "Last name", "required": true},
     {"id": "email", "to": "contact.email", "type": "email", "label": "Email", "required": true},
     {"id": "phone", "to": "contact.phone", "type": "phone", "label": "Phone", "required": true},
     {"id": "gta_area", "to": "field:gta_area", "type": "choice", "label": "Which part of the GTA do you live in?", "options": ["Downtown Toronto", "Midtown (Yonge-Eglinton)", "North York", "East York", "York", "Etobicoke", "Scarborough"], "required": true},
     {"id": "age_16", "to": "field:age_16_plus", "type": "yes_no", "label": "Are you 16 or older?", "required": true},
     {"id": "photos", "to": "field:photo_consent", "help": "Not a requirement to volunteer.", "type": "yes_no", "label": "Are you okay with photos or videos of you being shared on our social media?", "required": true},
     {"id": "days", "to": "field:days_available", "type": "multi", "label": "Which days of the week are you available to volunteer?", "options": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], "required": true},
     {"id": "experience", "to": "field:food_nonprofit_experience", "help": "A line or two is plenty.", "type": "long_text", "label": "Have you volunteered with a food non-profit before?", "required": false},
     {"id": "support", "to": "field:support_note", "help": "Only our team sees this.", "type": "long_text", "label": "Anything we should know to support you?", "required": false}]',
   '{"ask": true, "label": "Yes, Welfare Avenue can email me news, volunteer call-outs and ways to help. I can unsubscribe at any time.", "required": false}',
   'Thank you for registering to volunteer with Welfare Avenue in Toronto. We will be in touch as events are planned.',
   '{"city": "Toronto", "tags": ["toronto"], "confirm": false, "volunteer_record": true}', 58, 'volunteers'),
  (852, 'volunteer', 'Volunteer with Welfare Avenue', null, 'en', 'volunteer', 'published',
   '[{"id": "first_name", "to": "contact.first_name", "type": "text", "label": "First name", "required": true},
     {"id": "last_name", "to": "contact.last_name", "type": "text", "label": "Last name", "required": true},
     {"id": "email", "to": "contact.email", "type": "email", "label": "Email", "required": true},
     {"id": "phone", "to": "contact.phone", "type": "phone", "label": "Phone", "required": true},
     {"id": "roles", "to": "volunteer.roles", "max": 2, "type": "multi", "label": "How would you like to help?", "options": [{"l": "Serving food", "v": "server"}, {"l": "Cooking (at home)", "v": "cook"}], "required": true}]',
   '{"ask": true, "label": "Yes, Welfare Avenue can email me news, volunteer call-outs and ways to help. I can unsubscribe at any time.", "required": false}',
   'Thank you for signing up to serve with Welfare Avenue.', '{"city": "Montreal", "tags": [], "confirm": false, "serving_location": "Montreal", "volunteer_record": true}', 9, 'volunteers');
-- someone already in the CRM who said STOP to texts and unsubscribed from email (the text box never undoes either)
insert into public.crm_contacts (id, full_name, emails, phones, email_status, sms_opt_out) overriding system value values
  (1851, 'Fixture Stopped Person', array['fixture.stopped@stopped-fixture.ca'], array['+14165550109'], 'unsubscribed', true);
