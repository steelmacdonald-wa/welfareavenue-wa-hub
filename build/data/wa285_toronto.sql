-- Welfare Avenue Hub: wave285, 06/11/26. Hub CRM slice 1, Phase 5a: the Toronto forms and the second consent box (design CRM-S1 v2, B.2 and
-- Phase 5a items 29 to 34; Part A.2 and A.5). Toronto volunteers and students sign up on Hub forms instead of Keela, and a form can ask a second
-- question: may we text you. It adds: the request type toronto-volunteer (Ops Toronto, assigned to Tate); volunteer_applications.chapter;
-- wa209_volunteer_apply saves the chapter on the application and puts the person in it; crm_form_apply puts the person in the form's chapter
-- (settings.chapter), passes it to wa209_volunteer_apply, no longer writes the form's settings.city on new contacts, tells the consent log the
-- form and the words, and records a ticked text box (consent.sms) as express text consent; the toronto-volunteer form gets the Toronto settings
-- and both boxes (it stays closed); three draft forms (benevole-toronto, toronto-student, etudiant-toronto); one French word for the form editor.
-- Needs wave281 first (crm_chapters, crm_add_chapter, the consent log, sms_consent): the file stops at the top without it. Live functions are
-- changed by exact replacement of an anchor in their live text (pg_get_functiondef), as wave273, wave281 and wave283 did: a missing anchor stops
-- the whole file. The toronto-volunteer form is changed only from the settings and consent live had on 06/11/26 (else the file stops). Each patch
-- skips when its wave285 text is already there and every other step is guarded, so the file is safe to run twice. The live text of the two
-- functions and of the form's settings and consent is in build/data/wa285_undo.sql. No transaction control: the release runs it through the
-- Supabase connector, and build/sql_rollback_test.py runs it inside a block that rolls back. Proved offline first: node test/w285sql.mjs (PGlite).
-- Built 06/11/26, not released.

do $wa285$
begin
  if to_regprocedure('public.crm_add_chapter(bigint,text,text,text)') is null or to_regclass('public.crm_chapters') is null
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'crm_contacts' and column_name = 'sms_consent') then
    raise exception 'wave285 needs wave281 first (crm_chapters, crm_add_chapter and crm_contacts.sms_consent are missing)';
  end if;
  if not exists (select 1 from public.crm_chapters where code = 'toronto' and active) then raise exception 'wave285: the toronto chapter is missing'; end if;
end $wa285$;

-- ============================================================================================ 1. the request type toronto-volunteer
-- Ops Toronto, assigned to Tate. Statuses, default status, channel and channel mode are copied from serving-signup. The assignee is the display
-- name of the one active Ops Toronto member whose first name is Tate, looked up when this runs: request_types.default_assignee and
-- dept_requests.assignee hold a display name, which notify, hub-push and team-inbox match to team_members by name. The file stops when there is not
-- exactly one. A type an undo switched off (it had Requests, so it was kept) is switched on again.
do $wa285$
declare v_n int; v_who text;
begin
  if not exists (select 1 from public.request_types where key = 'toronto-volunteer') then
    select count(*), min(name) into v_n, v_who from public.team_members
     where active and department = 'opsto' and split_part(lower(btrim(name)), ' ', 1) = 'tate';
    if v_n <> 1 then raise exception 'wave285: expected one active Ops Toronto member whose first name is Tate, found %', v_n; end if;
    if not exists (select 1 from public.request_types where key = 'serving-signup') then raise exception 'wave285: the serving-signup request type is missing'; end if;
    insert into public.request_types (key, label, department, description, fields, statuses, default_status, source, enabled, sort, default_assignee, channel, channel_mode)
    select 'toronto-volunteer', 'Toronto volunteer sign-up', 'opsto', 'Volunteer sign-ups from the Hub''s Toronto forms', '[]'::jsonb,
           s.statuses, s.default_status, 'form', true, 100, v_who, s.channel, s.channel_mode
      from public.request_types s where s.key = 'serving-signup';
  else
    update public.request_types set enabled = true where key = 'toronto-volunteer' and not enabled;
  end if;
end $wa285$;

-- ============================================================================================ 2. which chapter an application is for
alter table public.volunteer_applications add column if not exists chapter text not null default 'montreal' references public.crm_chapters(code);
comment on column public.volunteer_applications.chapter is 'wave285: the chapter the application is for (crm_chapters code): montreal unless the form that sent it names another (crm_form_apply passes the form''s settings.chapter to wa209_volunteer_apply, which saves it here and puts the person in that chapter).';

-- ============================================================================================ 3. the two live functions, by exact anchor
-- wa209_volunteer_apply: reads {chapter} (montreal when there is none), saves it on the application, and after the insert puts the person in that
-- chapter (crm_add_chapter, source application). The signature is unchanged.
-- crm_form_apply: v_city comes only from the answers (the form's settings.city is no longer written on new contacts); a form with
-- settings.chapter puts the person in that chapter (crm_add_chapter, source form, once the contact is known) and passes it to
-- wa209_volunteer_apply; before the email permission is written, the consent log is told the form (form: <slug>) and the words they saw; a ticked
-- text box (crm_form_submissions.consent.sms.given) sets sms_consent express, its source (with the day in Toronto) and time, with the text box's
-- words in the log, but only for a contact the answer created, a signed-in person's own record, or a contact who has not said STOP, is not
-- do-not-contact and whose phone is the one typed (or who had none); otherwise the tick stays in the answer for the team to confirm.
-- sms_opt_out is never touched here: STOP stays the stop switch.
do $wa285$
declare v text; a text; b text;
begin
  v := pg_get_functiondef('public.wa209_volunteer_apply(jsonb)'::regprocedure);
  if position('v_chapter' in v) = 0 then
    foreach a in array array[
      $x$  v_pid bigint; v_cid bigint; v_new boolean := false; v_app bigint; v_by text; v_existing record; v_role_label text;$x$,
      $x$  v_lang := case when coalesce(p->>'language', '') ~* '^(fr|fran|french)' then 'fr' when coalesce(p->>'language', '') ~* '^(en|eng|angl)' then 'en' else null end;$x$,
      $x$insert into public.volunteer_applications (person_id, contact_id, name, email, phone, roles, role_text, source, source_ref, applied_at, message, cv_url, cv_path, language, mail_id, candidate_id, created_by)$x$,
      $x$          nullif(p->>'mail_id', '')::bigint, nullif(p->>'candidate_id', '')::bigint, v_by)
  returning id into v_app;$x$] loop
      if length(v) - length(replace(v, a, '')) <> length(a) then raise exception 'wave285: a live function moved: wa209_volunteer_apply'; end if;
    end loop;
    v := replace(v, $x$  v_pid bigint; v_cid bigint; v_new boolean := false; v_app bigint; v_by text; v_existing record; v_role_label text;$x$,
                    $x$  v_pid bigint; v_cid bigint; v_new boolean := false; v_app bigint; v_by text; v_existing record; v_role_label text; v_chapter text;$x$);
    v := replace(v, $x$  v_lang := case when coalesce(p->>'language', '') ~* '^(fr|fran|french)' then 'fr' when coalesce(p->>'language', '') ~* '^(en|eng|angl)' then 'en' else null end;$x$,
                    $x$  v_lang := case when coalesce(p->>'language', '') ~* '^(fr|fran|french)' then 'fr' when coalesce(p->>'language', '') ~* '^(en|eng|angl)' then 'en' else null end;
  v_chapter := coalesce(nullif(p ->> 'chapter', ''), 'montreal');   -- wave285: the chapter the application is for (crm_chapters)$x$);
    v := replace(v, $x$insert into public.volunteer_applications (person_id, contact_id, name, email, phone, roles, role_text, source, source_ref, applied_at, message, cv_url, cv_path, language, mail_id, candidate_id, created_by)$x$,
                    $x$insert into public.volunteer_applications (person_id, contact_id, name, email, phone, roles, role_text, source, source_ref, applied_at, message, cv_url, cv_path, language, mail_id, candidate_id, created_by, chapter)$x$);
    v := replace(v, $x$          nullif(p->>'mail_id', '')::bigint, nullif(p->>'candidate_id', '')::bigint, v_by)
  returning id into v_app;$x$,
                    $x$          nullif(p->>'mail_id', '')::bigint, nullif(p->>'candidate_id', '')::bigint, v_by, v_chapter)
  returning id into v_app;
  if v_cid is not null then perform public.crm_add_chapter(v_cid, v_chapter, 'application', v_app::text); end if;   -- wave285$x$);
    execute v;
  end if;

  v := pg_get_functiondef('public.crm_form_apply(bigint)'::regprocedure);
  if position('wave285' in v) = 0 then
    foreach a in array array[
      $x$  v_city := nullif(btrim(coalesce(m #>> '{contact,city}', f.settings ->> 'city', '')), '');$x$,
      $x$  -- 5. the email permission: a ticked box is express consent, recorded with the form's name and the day. Someone who$x$,
      $x$    update public.crm_contacts set email_consent = 'express',$x$,
      $x$      email_status = case when email_status in ('bounced', 'complained') then email_status else 'subscribed' end
    where id = v_cid;
  end if;$x$,
      $x$        'language', coalesce(f.lang, 'en'), 'by', v_src));$x$] loop
      if length(v) - length(replace(v, a, '')) <> length(a) then raise exception 'wave285: a live function moved: crm_form_apply'; end if;
    end loop;
    v := replace(v, $x$  v_city := nullif(btrim(coalesce(m #>> '{contact,city}', f.settings ->> 'city', '')), '');$x$,
                    $x$  v_city := nullif(btrim(coalesce(m #>> '{contact,city}', '')), '');   -- wave285: from the answers only, never the form's settings$x$);
    v := replace(v, $x$  -- 5. the email permission: a ticked box is express consent, recorded with the form's name and the day. Someone who$x$,
                    $x$  -- 4b. wave285: a form with settings.chapter (montreal, toronto) puts the person in that chapter
  if coalesce(f.settings ->> 'chapter', '') <> '' and exists (select 1 from public.crm_chapters ch where ch.code = f.settings ->> 'chapter') then
    perform public.crm_add_chapter(v_cid, f.settings ->> 'chapter', 'form', s.id::text);
  end if;

  -- 5. the email permission: a ticked box is express consent, recorded with the form's name and the day. Someone who$x$);
    v := replace(v, $x$    update public.crm_contacts set email_consent = 'express',$x$,
                    $x$    perform set_config('wa.consent_source', 'form: ' || f.slug, true);   -- wave285: the consent log's source and words
    perform set_config('wa.consent_words', coalesce(s.consent ->> 'asked', ''), true);
    update public.crm_contacts set email_consent = 'express',$x$);
    v := replace(v, $x$      email_status = case when email_status in ('bounced', 'complained') then email_status else 'subscribed' end
    where id = v_cid;
  end if;$x$,
                    $x$      email_status = case when email_status in ('bounced', 'complained') then email_status else 'subscribed' end
    where id = v_cid;
  end if;

  -- 5b. wave285: the text box (crm_forms.consent.sms): a ticked box is express text consent, recorded with the form and the day (in Toronto); the
  --     consent log keeps the words they saw. As with the email permission, the box could have been ticked by anyone who typed this email, so it
  --     counts only for a contact this answer created, a signed-in person's own record, or a contact who has not said STOP, is not do-not-contact
  --     and whose phone is the one typed (or who had no phone). Otherwise the tick stays in the answer and the timeline for the team to confirm.
  --     sms_opt_out is never touched: a STOP stays a STOP.
  if coalesce((s.consent -> 'sms' ->> 'given')::boolean, false)
     and (v_created or v_own or exists (
           select 1 from public.crm_contacts c
            where c.id = v_cid and not coalesce(c.sms_opt_out, false) and not coalesce(c.do_not_contact, false)
              and (cardinality(coalesce(c.phones, '{}'::text[])) = 0
                   or (regexp_replace(coalesce(v_ph, ''), '\D', '', 'g') <> ''
                       and exists (select 1 from unnest(c.phones) x
                                    where right(regexp_replace(x, '\D', '', 'g'), 10) = right(regexp_replace(v_ph, '\D', '', 'g'), 10)))))) then
    perform set_config('wa.consent_source', 'form: ' || f.slug, true);
    perform set_config('wa.consent_words', coalesce(s.consent -> 'sms' ->> 'asked', ''), true);
    update public.crm_contacts set sms_consent = 'express',
      sms_consent_source = 'Hub form: ' || f.slug || ' (' || to_char(s.created_at at time zone 'America/Toronto', 'DD Mon YYYY') || ')', sms_consent_at = s.created_at
    where id = v_cid;
  end if;$x$);
    v := replace(v, $x$        'language', coalesce(f.lang, 'en'), 'by', v_src));$x$,
                    $x$        'language', coalesce(f.lang, 'en'), 'by', v_src, 'chapter', f.settings ->> 'chapter'));   -- wave285: the form's chapter$x$);
    execute v;
  end if;
end $wa285$;

-- the patched functions keep their live grants (re-applied) and get comments that say what wave285 changed
revoke all on function public.wa209_volunteer_apply(jsonb) from public, anon;
grant execute on function public.wa209_volunteer_apply(jsonb) to authenticated, service_role;
revoke all on function public.crm_form_apply(bigint) from public, anon, authenticated;
grant execute on function public.crm_form_apply(bigint) to service_role;
comment on function public.wa209_volunteer_apply(jsonb) is 'wave209: files a volunteer application ({name, email, phone, roles | role_text, source, source_ref, applied_at, message, cv_url, cv_path, language, mail_id, candidate_id, by, chapter}): the person found by email or phone in volunteer_people or added there (so they are in the CRM and the directory), roles and tags (volunteer applicant, the source, applied YYYY-MM) merged, last_applied and Review set, a timeline entry in crm_interactions, and the row in volunteer_applications (Applicants received). A source_ref files an application once. wave239: the videographer role. wave285: the chapter (montreal when none is given) is saved on the application (volunteer_applications.chapter) and puts the person in that chapter (crm_add_chapter, source application). Staff and the service role.';
comment on function public.crm_form_apply(bigint) is 'Applies one form submission (wave156): the contact, the volunteering record, roster sign-ups, custom fields, the consent and a timeline entry, in one transaction. wave194: a submission from a signed-in website account (auth_user_id) uses that account''s own record and saves what they typed to it (names, phone first, address, city, province, postal code, language); its ticked permission box counts even after an unsubscribe. Anyone else''s submission only fills gaps and never re-subscribes. wave216: an application form adds a card to the Applications board; wave239: a volunteer form with a volunteering record files the application in Applicants received. wave261 (16/10/26): settings.request files a Request (request_types, assigned to its default assignee) without the email or phone; settings.gift_pledge adds a pledged campaign_gifts row waiting for a Confirm; settings.role_text names what a volunteer applied for; an address at a reserved test domain (example.com/.org/.net, .test, .example, .invalid) is a test (no Request, pledge or applicant; the submission is marked is_test). wave285 (06/11/26): settings.chapter puts the person in that chapter (crm_add_chapter, source form) and goes with the application to wa209_volunteer_apply; a new contact''s city comes only from the answers, never the form''s settings.city; the consent log records the form (form: <slug>) and the words shown; a ticked text box (consent.sms) is express text consent (sms_consent, its source with the day in Toronto, and time) for a contact the answer created, the person''s own record, or a contact who has not said STOP, is not do-not-contact and whose phone is the one typed (or who had none); otherwise the tick stays in the answer for the team to confirm; sms_opt_out is never touched. Called by form-submit with the service role.';

-- ============================================================================================ 4. the forms
-- toronto-volunteer: the Toronto settings (chapter, serving location, the Request for Tate; no settings.city) and both boxes. It stays closed (its
-- live status); publishing it and the three new drafts is step 7.7 of the release. It is changed only from what live had on 06/11/26.
do $wa285$
declare v_s jsonb; v_c jsonb;
  c_old_s constant jsonb := '{"city": "Toronto", "tags": ["toronto"], "confirm": false, "volunteer_record": true}';
  c_old_c constant jsonb := '{"ask": true, "label": "Yes, Welfare Avenue can email me news, volunteer call-outs and ways to help. I can unsubscribe at any time.", "required": false}';
  c_new_s constant jsonb := '{"chapter":"toronto","serving_location":"Toronto","volunteer_record":true,"tags":["toronto"],"confirm":false,"request":{"type":"toronto-volunteer","title":"New Toronto volunteer"}}';
  c_new_c constant jsonb := '{"ask":true,"required":false,"label":"Send me Welfare Avenue news by email. I can unsubscribe at any time.","sms":{"ask":true,"label":"Text me about volunteering. I can reply STOP at any time."}}';
begin
  select settings, consent into v_s, v_c from public.crm_forms where slug = 'toronto-volunteer';
  if not found then raise exception 'wave285: the toronto-volunteer form is missing'; end if;
  if v_s is distinct from c_new_s or v_c is distinct from c_new_c then
    if v_s is distinct from c_old_s or v_c is distinct from c_old_c then
      raise exception 'wave285: the toronto-volunteer form''s settings or consent changed since 06/11/26; read them again and update this file and its undo';
    end if;
    update public.crm_forms set settings = c_new_s, consent = c_new_c, updated_by = 'wave285' where slug = 'toronto-volunteer';
  end if;
end $wa285$;

-- benevole-toronto (its French twin), toronto-student and etudiant-toronto: drafts with the same settings (and cover photo) as toronto-volunteer
-- and the same two boxes. The student intro is the Keela form's ([FORMS], Toronto Student Registration). The wording of all three is for Steel and
-- Tate to approve (E10): the French intros are the English ones under "Version française à venir." until Tate's draft; the French labels the
-- brief does not give (photos, days, experience, support, their help lines, the thank-you) are a draft. Added once (a slug already there is kept).
do $wa285$
declare
  t record;
  v_si text := 'Welfare Avenue and the Toronto Youth Food Policy Council (TYFPC) are partnering to launch the Cook & Support Program, bringing together volunteers and students from across Toronto to prepare and provide meals for low-income and unhoused communities.'
    || E'\n\n' || 'Welfare Avenue is a nonprofit operating in Toronto and Montreal that provides meals to unhoused communities two to three times per month, with plans to expand its poverty-alleviation work to additional Canadian cities such as Ottawa, Vancouver and Calgary.'
    || E'\n\n' || 'TYFPC works with Toronto’s diverse youth communities to build a more sustainable and equitable food system through youth engagement, education, advocacy, and community partnerships. TYFPC creates opportunities for young people to take action on local food policy and food insecurity.'
    || E'\n\n' || 'Together, we are combining youth engagement and food security to make a direct impact in Toronto.'
    || E'\n\n' || 'By registering to join the Cook & Support Program, volunteers will gain hands-on community experience, connect with other young people, learn more about food insecurity, and help prepare and provide meals to people who need them.';
  v_fr text := 'Version française à venir.' || E'\n\n';
  c_fr constant jsonb := $j${"ask":true,"required":false,"label":"Envoyez-moi les nouvelles de Welfare Avenue par courriel. Je peux me désabonner en tout temps.","sms":{"ask":true,"label":"Écrivez-moi par texto au sujet du bénévolat. Je peux répondre STOP en tout temps."}}$j$;
  c_thanks_fr constant text := 'Merci de vous être inscrit pour faire du bénévolat avec Welfare Avenue à Toronto. Nous vous écrirons dès que des événements seront prévus.';
  q_benevole constant jsonb := $j$[
    {"id": "first_name", "to": "contact.first_name", "type": "text", "label": "Prénom", "required": true},
    {"id": "last_name", "to": "contact.last_name", "type": "text", "label": "Nom", "required": true},
    {"id": "email", "to": "contact.email", "type": "email", "label": "Courriel", "required": true},
    {"id": "phone", "to": "contact.phone", "type": "phone", "label": "Téléphone", "required": true},
    {"id": "gta_area", "to": "field:gta_area", "type": "choice", "label": "Dans quelle partie du Grand Toronto habitez-vous?", "required": true,
     "options": [{"v": "Downtown Toronto", "l": "Centre-ville de Toronto"}, "Midtown (Yonge-Eglinton)", "North York", "East York", "York", "Etobicoke", "Scarborough"]},
    {"id": "age_16", "to": "field:age_16_plus", "type": "yes_no", "label": "Avez-vous 16 ans ou plus?", "required": true},
    {"id": "photos", "to": "field:photo_consent", "type": "yes_no", "label": "Êtes-vous à l'aise que des photos ou des vidéos de vous soient partagées sur nos réseaux sociaux?", "help": "Ce n'est pas obligatoire pour faire du bénévolat.", "required": true},
    {"id": "days", "to": "field:days_available", "type": "multi", "label": "Quels jours de la semaine êtes-vous disponible pour faire du bénévolat?", "required": true,
     "options": [{"v": "Monday", "l": "Lundi"}, {"v": "Tuesday", "l": "Mardi"}, {"v": "Wednesday", "l": "Mercredi"}, {"v": "Thursday", "l": "Jeudi"}, {"v": "Friday", "l": "Vendredi"}, {"v": "Saturday", "l": "Samedi"}, {"v": "Sunday", "l": "Dimanche"}]},
    {"id": "experience", "to": "field:food_nonprofit_experience", "type": "long_text", "label": "Avez-vous déjà fait du bénévolat auprès d'un organisme alimentaire à but non lucratif?", "help": "Une ligne ou deux suffisent.", "required": false},
    {"id": "support", "to": "field:support_note", "type": "long_text", "label": "Y a-t-il quelque chose que nous devrions savoir pour bien vous accompagner?", "help": "Seule notre équipe voit cette réponse.", "required": false}]$j$;
  q_student constant jsonb := $j$[
    {"id": "first_name", "to": "contact.first_name", "type": "text", "label": "First name", "required": true},
    {"id": "last_name", "to": "contact.last_name", "type": "text", "label": "Last name", "required": true},
    {"id": "email", "to": "contact.email", "type": "email", "label": "Email", "required": true},
    {"id": "phone", "to": "contact.phone", "type": "phone", "label": "Phone", "required": true},
    {"id": "gta_area", "to": "field:gta_area", "type": "choice", "label": "Which part of the GTA do you live in?", "required": true,
     "options": ["Downtown Toronto", "Midtown (Yonge-Eglinton)", "North York", "East York", "York", "Etobicoke", "Scarborough"]},
    {"id": "age_16", "to": "field:age_16_plus", "type": "yes_no", "label": "Are you 16 or older?", "required": true},
    {"id": "student_now", "type": "yes_no", "label": "Are you a student in the 2026/2027 school year?", "required": true},
    {"id": "student_next", "type": "yes_no", "label": "Will you be a student in 2027/2028?", "required": false},
    {"id": "school", "type": "text", "label": "Which school, college or university do you go to?", "required": true},
    {"id": "role", "to": "volunteer.roles", "type": "choice", "label": "Would you prefer to cook or serve?", "required": true,
     "options": [{"v": "cook", "l": "Cook"}, {"v": "server", "l": "Server"}, {"v": "both", "l": "Either"}]},
    {"id": "days", "to": "field:days_available", "type": "multi", "label": "Which days of the week are you available to volunteer?", "required": true,
     "options": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]},
    {"id": "photos", "to": "field:photo_consent", "type": "yes_no", "label": "Are you okay with photos or videos of you being shared on our social media?", "help": "Not a requirement to volunteer.", "required": true},
    {"id": "experience", "to": "field:food_nonprofit_experience", "type": "long_text", "label": "Have you volunteered with a food non-profit before?", "help": "A line or two is plenty.", "required": false},
    {"id": "reach", "type": "multi", "label": "How would you prefer to get communications from us?", "required": false,
     "options": ["Email", "WhatsApp group", "Slack", "Discord"]},
    {"id": "support", "to": "field:support_note", "type": "long_text", "label": "Anything we should know to support you?", "help": "Only our team sees this.", "required": false}]$j$;
  q_etudiant constant jsonb := $j$[
    {"id": "first_name", "to": "contact.first_name", "type": "text", "label": "Prénom", "required": true},
    {"id": "last_name", "to": "contact.last_name", "type": "text", "label": "Nom", "required": true},
    {"id": "email", "to": "contact.email", "type": "email", "label": "Courriel", "required": true},
    {"id": "phone", "to": "contact.phone", "type": "phone", "label": "Téléphone", "required": true},
    {"id": "gta_area", "to": "field:gta_area", "type": "choice", "label": "Dans quelle partie du Grand Toronto habitez-vous?", "required": true,
     "options": [{"v": "Downtown Toronto", "l": "Centre-ville de Toronto"}, "Midtown (Yonge-Eglinton)", "North York", "East York", "York", "Etobicoke", "Scarborough"]},
    {"id": "age_16", "to": "field:age_16_plus", "type": "yes_no", "label": "Avez-vous 16 ans ou plus?", "required": true},
    {"id": "student_now", "type": "yes_no", "label": "Êtes-vous aux études pendant l'année scolaire 2026-2027?", "required": true},
    {"id": "student_next", "type": "yes_no", "label": "Serez-vous aux études en 2027-2028?", "required": false},
    {"id": "school", "type": "text", "label": "Quelle école, quel collège ou quelle université fréquentez-vous?", "required": true},
    {"id": "role", "to": "volunteer.roles", "type": "choice", "label": "Préférez-vous cuisiner ou servir?", "required": true,
     "options": [{"v": "cook", "l": "Cuisine"}, {"v": "server", "l": "Service"}, {"v": "both", "l": "Les deux"}]},
    {"id": "days", "to": "field:days_available", "type": "multi", "label": "Quels jours de la semaine êtes-vous disponible pour faire du bénévolat?", "required": true,
     "options": [{"v": "Sunday", "l": "Dimanche"}, {"v": "Monday", "l": "Lundi"}, {"v": "Tuesday", "l": "Mardi"}, {"v": "Wednesday", "l": "Mercredi"}, {"v": "Thursday", "l": "Jeudi"}, {"v": "Friday", "l": "Vendredi"}, {"v": "Saturday", "l": "Samedi"}]},
    {"id": "photos", "to": "field:photo_consent", "type": "yes_no", "label": "Êtes-vous à l'aise que des photos ou des vidéos de vous soient partagées sur nos réseaux sociaux?", "help": "Ce n'est pas obligatoire pour faire du bénévolat.", "required": true},
    {"id": "experience", "to": "field:food_nonprofit_experience", "type": "long_text", "label": "Avez-vous déjà fait du bénévolat auprès d'un organisme alimentaire à but non lucratif?", "help": "Une ligne ou deux suffisent.", "required": false},
    {"id": "reach", "type": "multi", "label": "Comment préférez-vous recevoir nos communications?", "required": false,
     "options": [{"v": "Email", "l": "Courriel"}, {"v": "WhatsApp group", "l": "Groupe WhatsApp"}, "Slack", "Discord"]},
    {"id": "support", "to": "field:support_note", "type": "long_text", "label": "Y a-t-il quelque chose que nous devrions savoir pour bien vous accompagner?", "help": "Seule notre équipe voit cette réponse.", "required": false}]$j$;
begin
  select settings, consent, intro, thank_you, cover_photo_id into t from public.crm_forms where slug = 'toronto-volunteer';
  insert into public.crm_forms (slug, title, intro, lang, kind, purpose, status, questions, consent, thank_you, settings, cover_photo_id, created_by, updated_by) values
    ('benevole-toronto', 'Faire du bénévolat à Toronto', v_fr || t.intro, 'fr', 'volunteer', 'volunteers', 'draft', q_benevole, c_fr, c_thanks_fr, t.settings, t.cover_photo_id, 'wave285', 'wave285'),
    ('toronto-student', 'Toronto student registration', v_si, 'en', 'volunteer', 'volunteers', 'draft', q_student, t.consent, t.thank_you, t.settings, t.cover_photo_id, 'wave285', 'wave285'),
    ('etudiant-toronto', 'Inscription étudiante à Toronto', v_fr || v_si, 'fr', 'volunteer', 'volunteers', 'draft', q_etudiant, c_fr, c_thanks_fr, t.settings, t.cover_photo_id, 'wave285', 'wave285')
  on conflict (slug) do nothing;
end $wa285$;

-- ============================================================================================ 5. the French word for the form editor (wave198)
insert into public.hub_i18n (lang, en, tr, kind)
values ('fr', 'Also ask for text consent', 'Demander aussi le consentement par texto', 'seed')
on conflict (lang, en) do update set tr = excluded.tr, kind = 'seed', updated_at = now()
 where public.hub_i18n.tr is distinct from excluded.tr or public.hub_i18n.kind is distinct from 'seed';

-- ============================================================================================ 6. the release record (once)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave285', 'wave285', null,
       'Toronto forms and the second consent box: request type toronto-volunteer (Ops Toronto, Tate); volunteer_applications.chapter; wa209_volunteer_apply and crm_form_apply put people in the form''s chapter, tell the consent log the form and the words, and record the text box; the toronto-volunteer form gets the Toronto settings and both boxes; three draft forms; one French word.', 'wave285'
 where not exists (select 1 from public.change_log where entity_type = 'release' and entity_id = 'wave285' and field = 'wave285');
