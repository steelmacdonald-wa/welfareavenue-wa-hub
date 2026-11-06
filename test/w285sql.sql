-- Welfare Avenue Hub: wave285. Assertions for build/data/wa285_toronto.sql (Phase 5a of the Hub CRM slice 1: the Toronto forms and the second
-- consent box). Assumes test/w281schema.sql, build/data/wa281_rules.sql, test/w283schema.sql, build/data/wa283_page.sql, test/w285schema.sql and the
-- migration are loaded. Everything runs in one transaction and ends with a rollback; any failed assertion raises. Offline: node test/w285sql.mjs
-- (PGlite). Every person is invented. crm_form_apply treats an address at a reserved test domain (example.com, .invalid and so on) as a test and
-- files nothing for it (wa261_drive_forms.sql line 246), so the fixture people use toronto-fixture.ca and montreal-fixture.ca.

begin;

-- ---------------------------------------------------------------- the structure
do $$
declare r record; v text; q jsonb;
  c_set constant jsonb := '{"chapter":"toronto","serving_location":"Toronto","volunteer_record":true,"tags":["toronto"],"confirm":false,"request":{"type":"toronto-volunteer","title":"New Toronto volunteer"}}';
  c_en constant jsonb := '{"ask":true,"required":false,"label":"Send me Welfare Avenue news by email. I can unsubscribe at any time.","sms":{"ask":true,"label":"Text me about volunteering. I can reply STOP at any time."}}';
  c_fr constant jsonb := '{"ask":true,"required":false,"label":"Envoyez-moi les nouvelles de Welfare Avenue par courriel. Je peux me désabonner en tout temps.","sms":{"ask":true,"label":"Écrivez-moi par texto au sujet du bénévolat. Je peux répondre STOP en tout temps."}}';
begin
  -- the request type
  select * into r from public.request_types where key = 'toronto-volunteer';
  assert found, 'the request type toronto-volunteer is there';
  assert r.label = 'Toronto volunteer sign-up' and r.department = 'opsto' and r.description = 'Volunteer sign-ups from the Hub''s Toronto forms' and r.fields = '[]'::jsonb
     and r.enabled and r.source = 'form' and r.sort = 100, 'toronto-volunteer: its label, Ops Toronto, its description, no fields, enabled, source form, sort 100';
  assert exists (select 1 from public.request_types s where s.key = 'serving-signup'
                   and (s.statuses, s.default_status, s.channel, s.channel_mode) is not distinct from (r.statuses, r.default_status, r.channel, r.channel_mode)),
    'toronto-volunteer: the statuses, default status, channel and channel mode of serving-signup';
  assert r.default_assignee = 'Tate Fixture', 'toronto-volunteer: assigned to the one active Ops Toronto member whose first name is Tate, by display name (' || coalesce(r.default_assignee, 'none') || ')';

  -- the column
  assert (select is_nullable = 'NO' and column_default = '''montreal''::text' from information_schema.columns
           where table_schema = 'public' and table_name = 'volunteer_applications' and column_name = 'chapter'), 'volunteer_applications.chapter: not null, default montreal';
  assert exists (select 1 from pg_constraint where conrelid = 'public.volunteer_applications'::regclass and contype = 'f' and confrelid = 'public.crm_chapters'::regclass),
    'volunteer_applications.chapter points at crm_chapters';
  assert col_description('public.volunteer_applications'::regclass, (select attnum::int from pg_attribute where attrelid = 'public.volunteer_applications'::regclass and attname = 'chapter')) like 'wave285:%',
    'the chapter column has a comment';
  assert not exists (select 1 from public.volunteer_applications where chapter <> 'montreal'), 'every application already there is Montreal';

  -- the two functions: what changed, their grants and comments
  v := pg_get_functiondef('public.crm_form_apply(bigint)'::regprocedure);
  assert position($q$f.settings ->> 'city'$q$ in v) = 0, 'crm_form_apply no longer reads the form''s settings.city';
  assert position($q$v_city := nullif(btrim(coalesce(m #>> '{contact,city}', '')), '');$q$ in v) > 0, 'crm_form_apply: the city comes from the answers only';
  assert position($q$perform public.crm_add_chapter(v_cid, f.settings ->> 'chapter', 'form', s.id::text);$q$ in v) > 0, 'crm_form_apply puts the person in the form''s chapter';
  assert position($q$'by', v_src, 'chapter', f.settings ->> 'chapter'));$q$ in v) > 0, 'crm_form_apply passes the chapter to wa209_volunteer_apply';
  assert position($q$perform set_config('wa.consent_words', coalesce(s.consent ->> 'asked', ''), true);
    update public.crm_contacts set email_consent = 'express',$q$ in v) > 0, 'crm_form_apply tells the consent log the words before writing the email permission';
  assert v !~ 'sms_opt_out\s*=', 'crm_form_apply never sets sms_opt_out';
  v := pg_get_functiondef('public.wa209_volunteer_apply(jsonb)'::regprocedure);
  assert position($q$v_chapter := coalesce(nullif(p ->> 'chapter', ''), 'montreal');$q$ in v) > 0, 'wa209_volunteer_apply reads the chapter, Montreal by default';
  assert position($q$candidate_id, created_by, chapter)$q$ in v) > 0 and position($q$v_by, v_chapter)$q$ in v) > 0, 'wa209_volunteer_apply saves the chapter on the application';
  assert position($q$perform public.crm_add_chapter(v_cid, v_chapter, 'application', v_app::text)$q$ in v) > 0, 'wa209_volunteer_apply puts the person in the chapter';
  assert not has_function_privilege('anon', 'public.crm_form_apply(bigint)', 'execute') and not has_function_privilege('authenticated', 'public.crm_form_apply(bigint)', 'execute')
     and has_function_privilege('service_role', 'public.crm_form_apply(bigint)', 'execute'), 'crm_form_apply keeps its live grants (the service role only)';
  assert not has_function_privilege('anon', 'public.wa209_volunteer_apply(jsonb)', 'execute') and has_function_privilege('authenticated', 'public.wa209_volunteer_apply(jsonb)', 'execute')
     and has_function_privilege('service_role', 'public.wa209_volunteer_apply(jsonb)', 'execute'), 'wa209_volunteer_apply keeps its live grants (staff and the service role)';
  assert not has_function_privilege('anon', 'public.crm_add_chapter(bigint,text,text,text)', 'execute') and not has_function_privilege('authenticated', 'public.crm_add_chapter(bigint,text,text,text)', 'execute'),
    'crm_add_chapter stays service-role only';
  assert obj_description('public.crm_form_apply(bigint)'::regprocedure, 'pg_proc') like '%wave285 (06/11/26)%' and obj_description('public.wa209_volunteer_apply(jsonb)'::regprocedure, 'pg_proc') like '%wave285:%',
    'both functions have a comment that says what wave285 changed';

  -- toronto-volunteer
  select * into r from public.crm_forms where slug = 'toronto-volunteer';
  assert r.settings = c_set and not (r.settings ? 'city') and not (r.settings ? 'campaign_id'), 'toronto-volunteer: the Toronto settings, no settings.city, no campaign';
  assert r.consent = c_en, 'toronto-volunteer: the two boxes with the brief''s words';
  assert r.status = 'closed', 'toronto-volunteer stays closed until the release publishes it';

  -- the three new forms
  assert (select string_agg(slug || ':' || lang || ':' || status || ':' || kind || ':' || purpose, ',' order by slug) from public.crm_forms where slug in ('benevole-toronto', 'toronto-student', 'etudiant-toronto'))
    = 'benevole-toronto:fr:draft:volunteer:volunteers,etudiant-toronto:fr:draft:volunteer:volunteers,toronto-student:en:draft:volunteer:volunteers', 'three drafts: volunteer forms in the Volunteers group, one English, two French';
  assert (select bool_and(f.settings = c_set and f.cover_photo_id = 58) from public.crm_forms f where slug in ('benevole-toronto', 'toronto-student', 'etudiant-toronto')), 'the same settings and cover photo as toronto-volunteer';
  assert (select consent from public.crm_forms where slug = 'toronto-student') = c_en and (select bool_and(consent = c_fr) from public.crm_forms where slug in ('benevole-toronto', 'etudiant-toronto')),
    'the English boxes on toronto-student, the French ones on the French forms';
  -- benevole-toronto: toronto-volunteer's questions, in French
  q := (select questions from public.crm_forms where slug = 'benevole-toronto');
  assert (select string_agg(x ->> 'id' || '>' || coalesce(x ->> 'to', '') || '>' || (x ->> 'type') || '>' || (x ->> 'required'), ',' order by o) from jsonb_array_elements(q) with ordinality t(x, o))
       = (select string_agg(x ->> 'id' || '>' || coalesce(x ->> 'to', '') || '>' || (x ->> 'type') || '>' || (x ->> 'required'), ',' order by o) from public.crm_forms f, jsonb_array_elements(f.questions) with ordinality t(x, o) where f.slug = 'toronto-volunteer'),
    'benevole-toronto asks what toronto-volunteer asks, saved to the same places';
  assert (select string_agg(x ->> 'label', '|' order by o) from jsonb_array_elements(q) with ordinality t(x, o) where x ->> 'id' in ('first_name', 'last_name', 'email', 'phone', 'gta_area', 'age_16'))
       = 'Prénom|Nom|Courriel|Téléphone|Dans quelle partie du Grand Toronto habitez-vous?|Avez-vous 16 ans ou plus?', 'benevole-toronto: the benevole form''s labels and the two the brief gives';
  assert (select intro from public.crm_forms where slug = 'benevole-toronto') = 'Version française à venir.' || E'\n\n' || (select intro from public.crm_forms where slug = 'toronto-volunteer'),
    'benevole-toronto: the English intro under Version française à venir.';
  -- toronto-student and etudiant-toronto: the brief's fifteen questions
  for v in select unnest(array['toronto-student', 'etudiant-toronto']) loop
    q := (select questions from public.crm_forms where slug = v);
    assert (select string_agg(x ->> 'id' || '>' || coalesce(x ->> 'to', '') || '>' || (x ->> 'type') || '>' || (x ->> 'required'), ',' order by o) from jsonb_array_elements(q) with ordinality t(x, o))
      = 'first_name>contact.first_name>text>true,last_name>contact.last_name>text>true,email>contact.email>email>true,phone>contact.phone>phone>true,gta_area>field:gta_area>choice>true,'
        || 'age_16>field:age_16_plus>yes_no>true,student_now>>yes_no>true,student_next>>yes_no>false,school>>text>true,role>volunteer.roles>choice>true,days>field:days_available>multi>true,'
        || 'photos>field:photo_consent>yes_no>true,experience>field:food_nonprofit_experience>long_text>false,reach>>multi>false,support>field:support_note>long_text>false',
      v || ': the questions, where each is saved and which are required, in the brief''s order';
    assert (select string_agg(coalesce(o ->> 'v', o #>> '{}'), ',') from jsonb_array_elements(q) x, jsonb_array_elements(x -> 'options') o where x ->> 'id' = 'role') = 'cook,server,both', v || ': the role choice saves cook, server or both';
    assert (select string_agg(coalesce(o ->> 'v', o #>> '{}'), ',') from jsonb_array_elements(q) x, jsonb_array_elements(x -> 'options') o where x ->> 'id' = 'days') = 'Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday',
      v || ': the days, Sunday to Saturday (the same values in both languages)';
  end loop;
  q := (select questions from public.crm_forms where slug = 'toronto-student');
  assert (select string_agg(x ->> 'label', '|' order by o) from jsonb_array_elements(q) with ordinality t(x, o) where x ->> 'id' in ('student_now', 'student_next', 'school', 'support'))
       = 'Are you a student in the 2026/2027 school year?|Will you be a student in 2027/2028?|Which school, college or university do you go to?|Anything we should know to support you?', 'toronto-student: the brief''s words';
  assert (select string_agg(coalesce(o ->> 'l', o #>> '{}'), '/') from jsonb_array_elements(q) x, jsonb_array_elements(x -> 'options') o where x ->> 'id' = 'role') = 'Cook/Server/Either', 'toronto-student: Cook, Server or Either';
  assert (select string_agg(coalesce(o ->> 'l', o #>> '{}'), '/') from jsonb_array_elements(q) x, jsonb_array_elements(x -> 'options') o where x ->> 'id' = 'reach') = 'Email/WhatsApp group/Slack/Discord', 'toronto-student: how to reach them';
  assert (select intro from public.crm_forms where slug = 'toronto-student') like 'Welfare Avenue and the Toronto Youth Food Policy Council (TYFPC) are partnering to launch the Cook & Support Program,%people who need them.',
    'toronto-student: the Keela form''s intro';
  q := (select questions from public.crm_forms where slug = 'etudiant-toronto');
  assert (select string_agg(x ->> 'label', '|' order by o) from jsonb_array_elements(q) with ordinality t(x, o) where x ->> 'id' in ('gta_area', 'age_16', 'student_now', 'student_next', 'school', 'role', 'reach'))
       = 'Dans quelle partie du Grand Toronto habitez-vous?|Avez-vous 16 ans ou plus?|Êtes-vous aux études pendant l''année scolaire 2026-2027?|Serez-vous aux études en 2027-2028?|'
         || 'Quelle école, quel collège ou quelle université fréquentez-vous?|Préférez-vous cuisiner ou servir?|Comment préférez-vous recevoir nos communications?', 'etudiant-toronto: the brief''s French labels';
  assert (select string_agg(coalesce(o ->> 'l', o #>> '{}'), '/') from jsonb_array_elements(q) x, jsonb_array_elements(x -> 'options') o where x ->> 'id' = 'role') = 'Cuisine/Service/Les deux', 'etudiant-toronto: Cuisine, Service or Les deux';
  assert (select string_agg(coalesce(o ->> 'l', o #>> '{}'), '/') from jsonb_array_elements(q) x, jsonb_array_elements(x -> 'options') o where x ->> 'id' = 'reach') = 'Courriel/Groupe WhatsApp/Slack/Discord', 'etudiant-toronto: Courriel, Groupe WhatsApp, Slack or Discord';
  assert (select intro from public.crm_forms where slug = 'etudiant-toronto') = 'Version française à venir.' || E'\n\n' || (select intro from public.crm_forms where slug = 'toronto-student'),
    'etudiant-toronto: the English intro under Version française à venir.';

  -- the French word and the release line
  assert (select tr || '/' || kind from public.hub_i18n where lang = 'fr' and en = 'Also ask for text consent') = 'Demander aussi le consentement par texto/seed', 'the French word for the editor''s text box';
  assert (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave285' and field = 'wave285') = 1, 'one release line';
end $$;

-- ---------------------------------------------------------------- form answers, applied as form-submit applies them (the service role)
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- 1. toronto-volunteer, both boxes ticked
do $$
declare s bigint; r jsonb; c bigint; d record; e text := 'Send me Welfare Avenue news by email. I can unsubscribe at any time.'; t text := 'Text me about volunteering. I can reply STOP at any time.';
begin
  insert into public.crm_form_submissions (form_id, status, answers, display, mapped, consent, lang, created_at) values (851, 'received',
    '{"first_name": "Fixture", "last_name": "Person", "email": "fixture.person@toronto-fixture.ca", "phone": "+1 416 555 0101", "gta_area": "North York", "age_16": true, "photos": true, "days": ["Sunday"]}',
    '[{"label": "First name", "value": "Fixture"}, {"label": "Last name", "value": "Person"}, {"label": "Email", "value": "fixture.person@toronto-fixture.ca"}, {"label": "Phone", "value": "+1 416 555 0101"},
      {"label": "Which part of the GTA do you live in?", "value": "North York"}, {"label": "Email permission", "value": "Yes: \"Send me Welfare Avenue news by email. I can unsubscribe at any time.\""},
      {"label": "Text permission", "value": "Yes: \"Text me about volunteering. I can reply STOP at any time.\""}]',
    '{"contact": {"first_name": "Fixture", "last_name": "Person", "email": "fixture.person@toronto-fixture.ca", "phone": "+1 416 555 0101"},
      "fields": {"gta_area": "North York", "age_16_plus": true, "photo_consent": true, "days_available": ["Sunday"]}, "consent": true}',
    jsonb_build_object('asked', e, 'given', true, 'at', '2026-11-06T15:00:00.000Z', 'form', 'toronto-volunteer', 'sms', jsonb_build_object('asked', t, 'given', true)),
    'en', '2026-11-06 15:00:00+00') returning id into s;
  r := public.crm_form_apply(s);
  c := (r ->> 'contact_id')::bigint;
  assert c is not null and (r ->> 'test')::boolean = false and (r ->> 'volunteer_id') is not null and (r ->> 'request_id') is not null, 'toronto 1: applied, a volunteer record and a Request (' || r::text || ')';
  assert (select status from public.crm_form_submissions where id = s) = 'processed', 'toronto 1: the submission is processed';
  -- the application, with its chapter
  assert (select count(*) from public.volunteer_applications where lower(email) = 'fixture.person@toronto-fixture.ca') = 1, 'toronto 1: one application';
  assert (select chapter || '/' || source || '/' || source_ref from public.volunteer_applications where lower(email) = 'fixture.person@toronto-fixture.ca') = 'toronto/website/form:' || s,
    'toronto 1: the application is for Toronto, from the website form';
  -- the chapter row: once, from the form (the application finds it there)
  assert (select string_agg(chapter || '/' || source || '/' || source_ref, ',') from public.crm_contact_chapters where contact_id = c) = 'toronto/form/' || s,
    'toronto 1: one crm_contact_chapters row, toronto, from the form (and no montreal row)';
  assert public.crm_in_chapter(c, 'toronto') and not public.crm_in_chapter(c, 'montreal'), 'toronto 1: in the Toronto filter, not in the Montreal one';
  -- the Request for Tate, without the email or phone
  select * into d from public.dept_requests where id = (r ->> 'request_id')::bigint;
  assert d.type_key = 'toronto-volunteer' and d.department = 'opsto' and d.assignee = 'Tate Fixture' and d.status = 'requested' and d.source = 'form:toronto-volunteer'
     and d.title = 'New Toronto volunteer: Fixture' and d.requested_email is null, 'toronto 1: one Request, toronto-volunteer, Ops Toronto, for Tate (' || to_jsonb(d)::text || ')';
  assert position('toronto-fixture.ca' in d.details::text) = 0 and position('555 0101' in d.details::text) = 0 and position('Email permission' in d.details::text) = 0,
    'toronto 1: the Request leaves out the email, the phone and the email permission';
  assert (select count(*) from public.dept_requests) = 1, 'toronto 1: only that Request';
  -- the contact: both consents, no city from the form, the toronto tag
  select * into d from public.crm_contacts where id = c;
  assert d.sms_consent = 'express' and d.sms_consent_source = 'Hub form: toronto-volunteer (06 Nov 2026)' and d.sms_consent_at = '2026-11-06 15:00:00+00'::timestamptz and not d.sms_opt_out,
    'toronto 1: express text consent, with the form and the day as its source (' || coalesce(d.sms_consent_source, 'none') || ')';
  assert d.email_consent = 'express' and d.email_status = 'subscribed', 'toronto 1: express email consent';
  assert d.city is null, 'toronto 1: no city written from the form';
  assert 'toronto' = any(d.tags), 'toronto 1: the toronto tag';
  -- the consent log: three rows, all from the form, each with the words they saw
  assert (select string_agg(column_name || '=' || new_value || '/' || channel || '/' || source || '/' || coalesce(words, '-'), ' | ' order by column_name) from public.crm_consent_events where contact_id = c)
       = 'email_consent=express/email/form: toronto-volunteer/' || e || ' | email_status=subscribed/email/form: toronto-volunteer/' || e || ' | sms_consent=express/sms/form: toronto-volunteer/' || t,
    'toronto 1: the consent log has the email and text changes, source form: toronto-volunteer, with the words';
  -- applying it again changes nothing
  perform public.crm_form_apply(s);
  assert (select count(*) from public.volunteer_applications where lower(email) = 'fixture.person@toronto-fixture.ca') = 1 and (select count(*) from public.dept_requests) = 1
     and (select count(*) from public.crm_consent_events where contact_id = c) = 3, 'toronto 1: a second apply adds nothing';
end $$;

-- 2. the Montreal volunteer form, the email box ticked (no text box on it): still Montreal, and its settings.city is no longer written
do $$
declare s bigint; r jsonb; c bigint; d record; e text := 'Yes, Welfare Avenue can email me news, volunteer call-outs and ways to help. I can unsubscribe at any time.';
begin
  insert into public.crm_form_submissions (form_id, status, answers, display, mapped, consent, lang, created_at) values (852, 'received',
    '{"first_name": "Fixture", "last_name": "Montrealer", "email": "fixture.montrealer@montreal-fixture.ca", "phone": "+1 514 555 0102", "roles": ["server"]}',
    '[{"label": "First name", "value": "Fixture"}, {"label": "Email", "value": "fixture.montrealer@montreal-fixture.ca"}]',
    '{"contact": {"first_name": "Fixture", "last_name": "Montrealer", "email": "fixture.montrealer@montreal-fixture.ca", "phone": "+1 514 555 0102"}, "fields": {}, "roles": ["server"], "consent": true}',
    jsonb_build_object('asked', e, 'given', true, 'at', '2026-11-06T16:00:00.000Z', 'form', 'volunteer'), 'en', '2026-11-06 16:00:00+00') returning id into s;
  r := public.crm_form_apply(s);
  c := (r ->> 'contact_id')::bigint;
  assert (select chapter from public.volunteer_applications where lower(email) = 'fixture.montrealer@montreal-fixture.ca') = 'montreal', 'montreal: the application gets chapter montreal';
  assert (select string_agg(chapter || '/' || source, ',') from public.crm_contact_chapters where contact_id = c) = 'montreal/application', 'montreal: a montreal row from the application, no toronto row';
  assert (r ->> 'request_id') is null and (select count(*) from public.dept_requests) = 1, 'montreal: no Request';
  select * into d from public.crm_contacts where id = c;
  assert d.city is null, 'montreal: the form''s settings.city (Montreal) is no longer written on a new contact';
  assert d.sms_consent is null and d.email_consent = 'express', 'montreal: email consent only';
  assert (select string_agg(column_name || '/' || source || '/' || words, ' | ' order by column_name) from public.crm_consent_events where contact_id = c)
       = 'email_consent/form: volunteer/' || e || ' | email_status/form: volunteer/' || e, 'montreal: the consent log says form: volunteer, with the words';
end $$;

-- 3. toronto-volunteer, the email box ticked and the text box not: no text consent
do $$
declare s bigint; r jsonb; c bigint;
begin
  insert into public.crm_form_submissions (form_id, status, answers, display, mapped, consent, lang, created_at) values (851, 'received', '{}',
    '[{"label": "First name", "value": "Fixture"}]',
    '{"contact": {"first_name": "Fixture", "last_name": "Notext", "email": "fixture.notext@toronto-fixture.ca"}, "fields": {}, "consent": true}',
    jsonb_build_object('asked', 'Send me Welfare Avenue news by email. I can unsubscribe at any time.', 'given', true, 'at', '2026-11-06T17:00:00.000Z', 'form', 'toronto-volunteer',
                       'sms', jsonb_build_object('asked', 'Text me about volunteering. I can reply STOP at any time.', 'given', false)), 'en', '2026-11-06 17:00:00+00') returning id into s;
  r := public.crm_form_apply(s);
  c := (r ->> 'contact_id')::bigint;
  assert (select sms_consent is null and sms_consent_source is null from public.crm_contacts where id = c), 'no text box ticked: no text consent';
  assert not exists (select 1 from public.crm_consent_events where contact_id = c and channel = 'sms'), 'no text box ticked: no text row in the consent log';
  assert (select count(*) from public.crm_consent_events where contact_id = c and source = 'form: toronto-volunteer') = 2, 'the email box still writes its two rows';
  assert (select chapter from public.volunteer_applications where lower(email) = 'fixture.notext@toronto-fixture.ca') = 'toronto' and (select count(*) from public.dept_requests) = 2,
    'a second Toronto sign-up: its own application (Toronto) and Request';
end $$;

-- 4. a reserved test address on toronto-volunteer: a test, nothing filed
do $$
declare s bigint; r jsonb;
begin
  insert into public.crm_form_submissions (form_id, status, answers, display, mapped, consent, lang, created_at) values (851, 'received', '{}', '[]',
    '{"contact": {"first_name": "Test", "email": "w285.test@example.com"}, "fields": {}, "consent": true}',
    jsonb_build_object('asked', 'x', 'given', true, 'form', 'toronto-volunteer', 'sms', jsonb_build_object('asked', 'y', 'given', true)), 'en', '2026-11-06 18:00:00+00') returning id into s;
  r := public.crm_form_apply(s);
  assert (r ->> 'test')::boolean and (r ->> 'request_id') is null, 'example.com is a test';
  assert not exists (select 1 from public.volunteer_applications where lower(email) = 'w285.test@example.com') and (select count(*) from public.dept_requests) = 2, 'a test files no application and no Request';
end $$;

-- a toronto-volunteer answer with both boxes ticked, applied: the submission id (fix round 1's cases below use it)
create function pg_temp.w285_answer(p_email text, p_phone text, p_at timestamptz) returns bigint language plpgsql as $f$
declare s bigint;
begin
  insert into public.crm_form_submissions (form_id, status, answers, display, mapped, consent, lang, created_at) values (851, 'received', '{}',
    '[{"label": "Text permission", "value": "Yes"}]',
    jsonb_build_object('contact', jsonb_strip_nulls(jsonb_build_object('first_name', 'Fixture', 'email', p_email, 'phone', p_phone)), 'fields', '{}'::jsonb, 'consent', true),
    jsonb_build_object('asked', 'Send me Welfare Avenue news by email. I can unsubscribe at any time.', 'given', true, 'form', 'toronto-volunteer',
                       'sms', jsonb_build_object('asked', 'Text me about volunteering. I can reply STOP at any time.', 'given', true)), 'en', p_at) returning id into s;
  perform public.crm_form_apply(s);
  return s;
end $f$;

-- 5. someone already in the CRM who unsubscribed and said STOP ticks both boxes (with the phone on file): email stays unsubscribed, STOP stays,
--    and no text consent is written; the tick stays in the answer and the timeline for the team to confirm
do $$
declare s bigint; d record;
begin
  s := pg_temp.w285_answer('fixture.stopped@stopped-fixture.ca', '+1 416 555 0109', '2026-11-06 19:00:00+00');
  assert (select contact_id from public.crm_form_submissions where id = s) = 1851, 'the person already in the CRM is used';
  select * into d from public.crm_contacts where id = 1851;
  assert d.email_status = 'unsubscribed' and d.email_consent is null, 'an unsubscribe is never undone by a form';
  assert d.sms_opt_out and d.sms_consent is null and d.sms_consent_source is null, 'STOP stays on, and the text box does not write text consent over it';
  assert not exists (select 1 from public.crm_consent_events where contact_id = 1851 and source like 'form:%'), 'the form wrote nothing to the consent log for a stopped person';
  assert (select consent -> 'sms' ->> 'given' from public.crm_form_submissions where id = s) = 'true'
     and exists (select 1 from public.crm_interactions where contact_id = 1851 and source_ref = 'form:' || s and body like '%Text permission: Yes%'), 'the tick stays in the answer and the timeline';
  assert exists (select 1 from public.crm_contact_chapters where contact_id = 1851 and chapter = 'toronto' and source = 'form'), 'and the person joins Toronto';
end $$;

-- 6 to 10 (fix round 1): who the text box counts for
do $$
declare s bigint; c bigint; d record;
begin
  -- 6. do-not-contact (not stopped, the same phone): no text consent
  insert into public.crm_contacts (full_name, emails, phones, do_not_contact) values ('Fixture Dnc', array['fixture.dnc@toronto-fixture.ca'], array['+14165550111'], true) returning id into c;
  s := pg_temp.w285_answer('fixture.dnc@toronto-fixture.ca', '+1 416 555 0111', '2026-11-06 19:10:00+00');
  select * into d from public.crm_contacts where id = c;
  assert (select contact_id from public.crm_form_submissions where id = s) = c and d.sms_consent is null and not d.sms_opt_out
     and not exists (select 1 from public.crm_consent_events where contact_id = c and channel = 'sms'), 'do-not-contact: no text consent, sms_opt_out untouched, nothing in the log';
  assert (select consent -> 'sms' ->> 'given' from public.crm_form_submissions where id = s) = 'true', 'do-not-contact: the tick stays in the answer';
  -- 7. a different phone typed than the one on file: no text consent, the phone on file kept
  insert into public.crm_contacts (full_name, emails, phones) values ('Fixture Otherphone', array['fixture.otherphone@toronto-fixture.ca'], array['+14165550120']) returning id into c;
  s := pg_temp.w285_answer('fixture.otherphone@toronto-fixture.ca', '+1 416 555 0199', '2026-11-06 19:20:00+00');
  select * into d from public.crm_contacts where id = c;
  assert d.sms_consent is null and d.phones = array['+14165550120'] and not exists (select 1 from public.crm_consent_events where contact_id = c and channel = 'sms'),
    'another phone typed: no text consent, and the phone on file is kept';
  assert exists (select 1 from public.crm_interactions where contact_id = c and source_ref = 'form:' || s), 'another phone typed: the answer is on the timeline';
  -- 8. the phone on file, written differently: text consent
  insert into public.crm_contacts (full_name, emails, phones) values ('Fixture Samephone', array['fixture.samephone@toronto-fixture.ca'], array['416-555-0130']) returning id into c;
  s := pg_temp.w285_answer('fixture.samephone@toronto-fixture.ca', '+1 (416) 555-0130', '2026-11-06 19:30:00+00');
  assert (select sms_consent from public.crm_contacts where id = c) = 'express'
     and (select string_agg(column_name || '/' || source, ',') from public.crm_consent_events where contact_id = c and channel = 'sms') = 'sms_consent/form: toronto-volunteer', 'the phone on file (any format): text consent, logged';
  -- 9. no phone on file, one typed: text consent, and the phone is saved
  insert into public.crm_contacts (full_name, emails) values ('Fixture Nophone', array['fixture.nophone@toronto-fixture.ca']) returning id into c;
  s := pg_temp.w285_answer('fixture.nophone@toronto-fixture.ca', '+1 416 555 0140', '2026-11-06 19:40:00+00');
  select * into d from public.crm_contacts where id = c;
  assert d.sms_consent = 'express' and d.phones = array['+1 416 555 0140'], 'no phone on file: the typed phone is saved and the text consent recorded';
  -- 10. a new person at 21:30 in Toronto (02:30 UTC the next day): the source carries the Toronto day
  s := pg_temp.w285_answer('fixture.late@toronto-fixture.ca', '+1 416 555 0150', '2026-11-07 02:30:00+00');
  select * into d from public.crm_contacts where id = (select contact_id from public.crm_form_submissions where id = s);
  assert d.sms_consent = 'express' and d.sms_consent_source = 'Hub form: toronto-volunteer (06 Nov 2026)' and d.sms_consent_at = '2026-11-07 02:30:00+00'::timestamptz,
    'a new person in the evening: the day in Toronto (' || coalesce(d.sms_consent_source, 'none') || ')';
end $$;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------- staff call wa209_volunteer_apply directly (the Volunteer Manager): Montreal unless they say
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.member@example.invalid","sub":"00000000-0000-0000-0000-000000000001"}', true);
do $$
declare r jsonb;
begin
  r := public.wa209_volunteer_apply('{"name": "Fixture Byhand", "email": "fixture.byhand@toronto-fixture.ca", "role_text": "server", "source": "manual"}');
  assert (select chapter from public.volunteer_applications where id = (r ->> 'application_id')::bigint) = 'montreal', 'by hand with no chapter: Montreal';
  r := public.wa209_volunteer_apply('{"name": "Fixture Byhand Two", "email": "fixture.byhand2@toronto-fixture.ca", "role_text": "server", "source": "manual", "chapter": "toronto"}');
  assert (select chapter from public.volunteer_applications where id = (r ->> 'application_id')::bigint) = 'toronto', 'by hand with chapter toronto: Toronto';
  assert exists (select 1 from public.crm_contact_chapters where contact_id = (r ->> 'contact_id')::bigint and chapter = 'toronto' and source = 'application'), 'and the person joins Toronto (source application)';
end $$;
select set_config('request.jwt.claims', '', true);

select 'w285sql: all assertions passed' as result;
rollback;
