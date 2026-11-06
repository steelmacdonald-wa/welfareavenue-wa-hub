-- Welfare Avenue Hub: wave288 undo, 06/11/26. Reverses build/data/wa288_toronto.sql, in reverse order.
-- crm_form_apply and wa209_volunteer_apply come back exactly as live had them on 06/11/26 (pg_get_functiondef, read with the Supabase connector;
-- the md5 of each definition is checked in test/w288sql.mjs), with their live grants and comment (wa209_volunteer_apply had none). The forms are
-- closed again: toronto-volunteer gets back the settings and consent live had on 06/11/26 and is closed; each of the three new forms is deleted if
-- nobody answered it, else closed (its answers stay). The request type toronto-volunteer is deleted if no Request uses it, else switched off (the
-- Requests stay). volunteer_applications.chapter is dropped and the French word removed. What people said stays as the record of it: the chapter
-- rows (crm_contact_chapters), sms_consent and the consent log rows the forms wrote, and the tags (toronto, toronto student) and custom fields
-- (gta_area, days_available, age_16_plus, photo_consent) their answers put on contacts, which wave274's Toronto Volunteers reads (the forms
-- wrote them through crm_form_apply's own tag and field steps, which this undo does not change). The release line stays; an undo line is added.
-- Run it before wave281's undo, never after (the undo order is 288, 286, 284, 283, 282, 281: docs/06-11-26 - CRM slice 1 release runbook.md). The page,
-- the /f/ page and form-submit go back as that runbook says: the page first (bae461b9 rebuilt from origin/wave287-projects-overview 940c905, and
-- f/index.html efdb9627), form-submit v9 (0c92b53) after the undo files; and take the Toronto forms off the website.
-- Comment statements here are indented on purpose: build/gen_data_model.py reads every file in build/data, and must keep reading the migration's text.
-- No transaction control (see the migration). Safe to run twice.

-- ============================================================================================ 1. the two functions back (live text, 06/11/26)
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
  comment on function public.wa209_volunteer_apply(jsonb) is null;

-- ============================================================================================ 2. the forms closed again
update public.crm_forms
   set settings = '{"city": "Toronto", "tags": ["toronto"], "confirm": false, "volunteer_record": true}',
       consent = '{"ask": true, "label": "Yes, Welfare Avenue can email me news, volunteer call-outs and ways to help. I can unsubscribe at any time.", "required": false}',
       status = 'closed', updated_by = 'wave288 undo'
 where slug = 'toronto-volunteer'
   and (settings is distinct from '{"city": "Toronto", "tags": ["toronto"], "confirm": false, "volunteer_record": true}'::jsonb
        or consent is distinct from '{"ask": true, "label": "Yes, Welfare Avenue can email me news, volunteer call-outs and ways to help. I can unsubscribe at any time.", "required": false}'::jsonb
        or status is distinct from 'closed');
delete from public.crm_forms f
 where f.slug in ('benevole-toronto', 'toronto-student', 'etudiant-toronto')
   and not exists (select 1 from public.crm_form_submissions s where s.form_id = f.id);
update public.crm_forms set status = 'closed', updated_by = 'wave288 undo'
 where slug in ('benevole-toronto', 'toronto-student', 'etudiant-toronto') and status is distinct from 'closed';

-- ============================================================================================ 3. the request type
delete from public.request_types r where r.key = 'toronto-volunteer' and not exists (select 1 from public.dept_requests d where d.type_key = r.key);
update public.request_types set enabled = false where key = 'toronto-volunteer' and enabled;

-- ============================================================================================ 4. volunteer_applications.chapter (after the functions, which no longer write it)
alter table public.volunteer_applications drop column if exists chapter;

-- ============================================================================================ 5. the French word wave288 seeded
delete from public.hub_i18n where lang = 'fr' and kind = 'seed' and en = 'Also ask for text consent' and tr = 'Demander aussi le consentement par texto';

-- the undo record (once per release)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave288', 'wave288 undo', null, 'wave288 undone: crm_form_apply and wa209_volunteer_apply back as live had them on 06/11/26; the Toronto forms closed (toronto-volunteer with its old settings and consent; unanswered new drafts deleted); the request type toronto-volunteer removed or switched off; volunteer_applications.chapter dropped; the French word removed.', 'wave288 undo'
 where not exists (select 1 from public.change_log u where u.entity_type = 'release' and u.entity_id = 'wave288' and u.field = 'wave288 undo'
                    and u.changed_at >= coalesce((select max(r.changed_at) from public.change_log r where r.entity_type = 'release' and r.entity_id = 'wave288' and r.field = 'wave288'), '-infinity'::timestamptz));
