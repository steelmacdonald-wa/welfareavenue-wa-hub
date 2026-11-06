-- wave288: assertions on the live database, after build/data/wa281_rules.sql, build/data/wa283_page.sql, test/w288live_before.sql and
-- build/data/wa288_toronto.sql. Runs only inside the block build/sql_rollback_test.py prints, so everything rolls back. No transaction control.
-- Raises on the first failure, with the check's name and counts only; personal data never leaves the database (Tate's display name is compared
-- inside it, never printed). The two answers applied here are invented people at toronto-fixture.ca and montreal-fixture.ca (not reserved test
-- domains, so crm_form_apply files them as real); they roll back with everything else. Nothing is sent: before they are applied, the triggers
-- that would call an edge function (dept_requests: trg_wa123_request_new, trg_wa123_request_update, trg_wa89_request_filed; volunteer_applications:
-- trg_wa239_volunteer_applied) are switched off for this transaction only, and the file stops if any other trigger on a table the answers write
-- could call out.

-- ---------------------------------------------------------------- structure, as the database owner
do $live$
declare e record; fn record; r record; v_tate text;
begin
  select * into e from pg_temp.w288_expect;
  for fn in select b.*, md5(pg_get_functiondef(b.f::regprocedure)) as now_md5, (select proacl::text from pg_proc where oid = b.f::regprocedure) as now_acl,
                  obj_description(b.f::regprocedure, 'pg_proc') as now_cmt from pg_temp.w288_fn_before b loop
    if fn.now_md5 = fn.def_md5 then raise exception 'w288live: % was not patched', fn.f; end if;
    if fn.now_acl is distinct from fn.acl then raise exception 'w288live: % lost its live grants', fn.f; end if;
    if coalesce(fn.now_cmt, '') not like '%wave288%' then raise exception 'w288live: % has no comment saying what wave288 changed', fn.f; end if;
  end loop;
  if position($q$f.settings ->> 'city'$q$ in pg_get_functiondef('public.crm_form_apply(bigint)'::regprocedure)) > 0 then raise exception 'w288live: crm_form_apply still reads settings.city'; end if;
  if has_function_privilege('anon', 'public.crm_form_apply(bigint)', 'execute') or has_function_privilege('authenticated', 'public.crm_form_apply(bigint)', 'execute')
     or has_function_privilege('anon', 'public.wa209_volunteer_apply(jsonb)', 'execute') then
    raise exception 'w288live: a patched function is open to anon or more callers than before';
  end if;

  select name into v_tate from public.team_members where active and department = 'opsto' and split_part(lower(btrim(name)), ' ', 1) = 'tate';
  select * into r from public.request_types where key = 'toronto-volunteer';
  if not found or r.label <> 'Toronto volunteer sign-up' or r.department <> 'opsto' or r.description <> 'Volunteer sign-ups from the Hub''s Toronto forms' or r.fields <> '[]'::jsonb
     or not r.enabled or r.source <> 'form' or r.sort <> 100 then
    raise exception 'w288live: the request type toronto-volunteer is not as the brief gives';
  end if;
  if r.default_assignee is distinct from v_tate then raise exception 'w288live: the request type is not assigned to the one active Ops Toronto member named Tate'; end if;
  if not exists (select 1 from public.request_types s where s.key = 'serving-signup'
                   and (s.statuses, s.default_status, s.channel, s.channel_mode) is not distinct from (r.statuses, r.default_status, r.channel, r.channel_mode)) then
    raise exception 'w288live: the request type''s statuses, default status or channel are not serving-signup''s';
  end if;
  if (select count(*) from public.request_types) <> e.rtypes + 1 then raise exception 'w288live: more than one request type was added'; end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'volunteer_applications' and column_name = 'chapter'
                  and is_nullable = 'NO' and column_default = '''montreal''::text') then
    raise exception 'w288live: volunteer_applications.chapter is not there as not null default montreal';
  end if;
  if exists (select 1 from public.volunteer_applications where chapter <> 'montreal') then raise exception 'w288live: an existing application is not Montreal'; end if;

  if (select settings from public.crm_forms where slug = 'toronto-volunteer')
       <> '{"chapter":"toronto","serving_location":"Toronto","volunteer_record":true,"tags":["toronto"],"confirm":false,"request":{"type":"toronto-volunteer","title":"New Toronto volunteer"}}'::jsonb
     or (select consent from public.crm_forms where slug = 'toronto-volunteer')
       <> '{"ask":true,"required":false,"label":"Send me Welfare Avenue news by email. I can unsubscribe at any time.","sms":{"ask":true,"label":"Text me about volunteering. I can reply STOP at any time."}}'::jsonb
     or (select status from public.crm_forms where slug = 'toronto-volunteer') is distinct from (select status from pg_temp.w288_form_before where slug = 'toronto-volunteer') then
    raise exception 'w288live: toronto-volunteer does not have the Toronto settings and both boxes, or its status moved';
  end if;
  if (select md5((to_jsonb(f) - 'settings' - 'consent' - 'status' - 'updated_at' - 'updated_by' - 'closed_at')::text) from public.crm_forms f where slug = 'toronto-volunteer')
     <> (select rest_md5 from pg_temp.w288_form_before where slug = 'toronto-volunteer') then
    raise exception 'w288live: something else on toronto-volunteer changed';
  end if;
  if (select string_agg(slug || ':' || lang || ':' || status || ':' || kind || ':' || purpose, ',' order by slug) from public.crm_forms where slug in ('benevole-toronto', 'toronto-student', 'etudiant-toronto'))
     <> 'benevole-toronto:fr:draft:volunteer:volunteers,etudiant-toronto:fr:draft:volunteer:volunteers,toronto-student:en:draft:volunteer:volunteers' then
    raise exception 'w288live: the three new forms are not drafts as the brief gives';
  end if;
  if exists (select 1 from public.crm_forms f where slug in ('benevole-toronto', 'toronto-student', 'etudiant-toronto')
              and ((f.settings - 'tags') <> ((select settings from public.crm_forms where slug = 'toronto-volunteer') - 'tags')
                   or f.settings -> 'tags' <> case when f.slug like '%student%' or f.slug like 'etudiant%' then '["toronto student"]'::jsonb else '["toronto"]'::jsonb end or jsonb_array_length(f.questions) not in (10, 15) or not (f.consent -> 'sms' ->> 'ask')::boolean)) then
    raise exception 'w288live: a new form does not have toronto-volunteer''s settings, its questions or the text box';
  end if;
  if (select count(*) from public.crm_forms) <> e.forms + 3 then raise exception 'w288live: not exactly three forms added'; end if;
  if exists (select slug, all_md5 from pg_temp.w288_form_before where slug <> 'toronto-volunteer' except select slug, md5(to_jsonb(f)::text) from public.crm_forms f) then
    raise exception 'w288live: another form changed';
  end if;
  if (select tr || '/' || kind from public.hub_i18n where lang = 'fr' and en = 'Also ask for text consent') is distinct from 'Demander aussi le consentement par texto/seed'
     or (select count(*) from public.hub_i18n where lang = 'fr') <> e.i18n_rows + 1 - e.word_before then
    raise exception 'w288live: the French word is not there, or other words moved';
  end if;
  if (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave288' and field = 'wave288') <> 1 then raise exception 'w288live: not one release line'; end if;
end $live$;

-- ---------------------------------------------------------------- nothing may call out while the test answers are applied
alter table public.dept_requests disable trigger trg_wa123_request_new, disable trigger trg_wa123_request_update, disable trigger trg_wa89_request_filed;
alter table public.volunteer_applications disable trigger trg_wa239_volunteer_applied;
do $guard$
begin
  if exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_proc p on p.oid = t.tgfoid
              where not t.tgisinternal and t.tgenabled <> 'D' and c.relnamespace = 'public'::regnamespace
                and c.relname in ('crm_form_submissions', 'crm_contacts', 'volunteer_people', 'volunteer_profiles', 'crm_contact_fields', 'crm_interactions', 'crm_contact_chapters',
                                  'crm_consent_events', 'volunteer_applications', 'dept_requests', 'change_log', 'crm_automation_runs', 'event_roster', 'crm_contact_orgs')
                and pg_get_functiondef(p.oid) ~* '(call_edge|notify_call|net\.http|http_post|http_get|push_call)') then
    raise exception 'w288live: a trigger on a table the test answers write could call out; stopping before any answer is applied';
  end if;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $guard$;

-- ---------------------------------------------------------------- a Toronto sign-up with both boxes ticked, and a Montreal one, as form-submit applies them
do $a$
declare e record; s bigint; r jsonb; c bigint; c2 bigint; d record; v_tate text;
  e_label constant text := 'Send me Welfare Avenue news by email. I can unsubscribe at any time.';
  t_label constant text := 'Text me about volunteering. I can reply STOP at any time.';
begin
  select * into e from pg_temp.w288_expect;
  select name into v_tate from public.team_members where active and department = 'opsto' and split_part(lower(btrim(name)), ' ', 1) = 'tate';

  insert into public.crm_form_submissions (form_id, status, answers, display, mapped, consent, lang, user_agent, created_at)
  select f.id, 'received',
    '{"first_name": "Fixture", "last_name": "Person", "email": "fixture.person@toronto-fixture.ca", "phone": "+1 416 555 0101", "gta_area": "North York"}',
    '[{"label": "First name", "value": "Fixture"}, {"label": "Last name", "value": "Person"}, {"label": "Email", "value": "fixture.person@toronto-fixture.ca"}, {"label": "Phone", "value": "+1 416 555 0101"},
      {"label": "Which part of the GTA do you live in?", "value": "North York"}, {"label": "Email permission", "value": "Yes"}, {"label": "Text permission", "value": "Yes"}]',
    '{"contact": {"first_name": "Fixture", "last_name": "Person", "email": "fixture.person@toronto-fixture.ca", "phone": "+1 416 555 0101"}, "fields": {"gta_area": "North York", "days_available": ["Sunday"], "age_16_plus": true, "photo_consent": true}, "consent": true}',
    jsonb_build_object('asked', e_label, 'given', true, 'at', '2026-11-06T15:00:00.000Z', 'form', 'toronto-volunteer', 'sms', jsonb_build_object('asked', t_label, 'given', true)),
    'en', 'w288live', '2026-11-06 15:00:00+00'
    from public.crm_forms f where f.slug = 'toronto-volunteer'
  returning id into s;
  r := public.crm_form_apply(s);
  c := (r ->> 'contact_id')::bigint;
  if c is null or coalesce((r ->> 'test')::boolean, true) or (r ->> 'request_id') is null or (r ->> 'volunteer_id') is null then raise exception 'w288live: the Toronto answer was not applied as a real sign-up with a Request'; end if;
  if (select count(*) from public.volunteer_applications where lower(email) = 'fixture.person@toronto-fixture.ca') <> 1
     or (select chapter from public.volunteer_applications where lower(email) = 'fixture.person@toronto-fixture.ca') <> 'toronto' then
    raise exception 'w288live: the Toronto answer did not make one application with chapter toronto';
  end if;
  if (select string_agg(chapter || '/' || source, ',') from public.crm_contact_chapters where contact_id = c) is distinct from 'toronto/form' then
    raise exception 'w288live: the Toronto person does not have exactly one chapter row, toronto from the form';
  end if;
  select * into d from public.dept_requests where id = (r ->> 'request_id')::bigint;
  if d.type_key <> 'toronto-volunteer' or d.department <> 'opsto' or d.assignee is distinct from v_tate or d.requested_email is not null
     or position('toronto-fixture.ca' in d.details::text) > 0 or position('555 0101' in d.details::text) > 0 then
    raise exception 'w288live: the Request is not toronto-volunteer for Ops Toronto and Tate, or it carries the email or phone';
  end if;
  select * into d from public.crm_contacts where id = c;
  if d.sms_consent is distinct from 'express' or d.sms_consent_source is distinct from 'Hub form: toronto-volunteer (06 Nov 2026)' or d.sms_consent_at <> '2026-11-06 15:00:00+00'::timestamptz
     or d.sms_opt_out or d.email_consent is distinct from 'express' or d.email_status <> 'subscribed' then
    raise exception 'w288live: the Toronto person does not have express text and email consent as the brief gives';
  end if;
  if d.city is not null then raise exception 'w288live: a city was written on the new Toronto contact'; end if;
  -- what wave274's Toronto Volunteers reads: the tag and the four custom fields
  if not ('toronto' = any(d.tags)) or 'toronto student' = any(d.tags) then raise exception 'w288live: the Toronto person is not tagged toronto (or is tagged toronto student)'; end if;
  if (select string_agg(f.key || '=' || cf.value::text, ' | ' order by f.key) from public.crm_contact_fields cf join public.crm_fields f on f.id = cf.field_id where cf.contact_id = c)
     is distinct from 'age_16_plus=true | days_available=["Sunday"] | gta_area="North York" | photo_consent=true' then
    raise exception 'w288live: the Toronto person does not have the four custom fields from the answers';
  end if;
  if (select string_agg(column_name || '/' || source || '/' || coalesce(words, '-'), ' | ' order by column_name) from public.crm_consent_events where contact_id = c)
     is distinct from 'email_consent/form: toronto-volunteer/' || e_label || ' | email_status/form: toronto-volunteer/' || e_label || ' | sms_consent/form: toronto-volunteer/' || t_label then
    raise exception 'w288live: the consent log rows for the Toronto person are not the three from the form with their words';
  end if;

  insert into public.crm_form_submissions (form_id, status, answers, display, mapped, consent, lang, user_agent, created_at)
  select f.id, 'received', '{"first_name": "Fixture", "email": "fixture.montrealer@montreal-fixture.ca", "roles": ["server"]}',
    '[{"label": "First name", "value": "Fixture"}]',
    '{"contact": {"first_name": "Fixture", "last_name": "Montrealer", "email": "fixture.montrealer@montreal-fixture.ca"}, "fields": {}, "roles": ["server"], "consent": false}',
    jsonb_build_object('asked', f.consent ->> 'label', 'given', false, 'at', '2026-11-06T16:00:00.000Z', 'form', 'volunteer'), 'en', 'w288live', '2026-11-06 16:00:00+00'
    from public.crm_forms f where f.slug = 'volunteer'
  returning id into s;
  r := public.crm_form_apply(s);
  c2 := (r ->> 'contact_id')::bigint;
  if (select chapter from public.volunteer_applications where lower(email) = 'fixture.montrealer@montreal-fixture.ca') is distinct from 'montreal' then
    raise exception 'w288live: the Montreal answer''s application is not chapter montreal';
  end if;
  if exists (select 1 from public.crm_contact_chapters where contact_id = c2 and chapter = 'toronto') or (select city from public.crm_contacts where id = c2) is not null or (r ->> 'request_id') is not null then
    raise exception 'w288live: the Montreal answer got a Toronto row, a city from the form''s settings, or a Request';
  end if;

  -- nothing else moved
  if (select count(*) from public.dept_requests) <> e.requests + 1 then raise exception 'w288live: Requests other than the one test Request were filed'; end if;
  if (select count(*) from public.volunteer_applications) <> e.apps + 2 then raise exception 'w288live: applications other than the two test ones were added'; end if;
  if (select md5(string_agg((to_jsonb(a) - 'chapter')::text, '|' order by a.id)) from public.volunteer_applications a where lower(coalesce(a.email, '')) not like '%-fixture.ca') is distinct from e.apps_md5 then
    raise exception 'w288live: a real application changed';
  end if;
  if (select md5(string_agg(to_jsonb(x)::text, '|' order by x.id)) from public.crm_contacts x where x.id not in (c, c2)) is distinct from e.contacts_md5 then
    raise exception 'w288live: a real contact changed';
  end if;
  if (select count(*) from public.crm_consent_events where contact_id not in (c, c2)) <> e.consent_rows then raise exception 'w288live: consent log rows were written for someone else'; end if;
  if (select count(*) from public.crm_contact_fields where contact_id not in (c, c2)) <> e.field_rows then raise exception 'w288live: custom fields changed for someone else'; end if;
  if (select count(*) from public.crm_contact_chapters where contact_id not in (c, c2)) <> e.chapter_rows then raise exception 'w288live: chapter rows changed for someone else'; end if;
  perform set_config('request.jwt.claims', '', true);
end $a$;
