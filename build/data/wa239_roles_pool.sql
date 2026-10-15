-- =====================================================================
-- wave239 (15/10/26): the volunteer roles set right
-- =====================================================================
-- Steel, 14/10/26 marketing meeting: the Volunteers list's role filters (photographer, server, community lead, driver) must
-- work; the people who apply as photographers on the website must land in Applicants received; "we should text the people
-- who signed up as photographers to see if they are still in", and the text must say it is Welfare Avenue; a videographer
-- role; and the photographer applicant alerts go to whoever owns the photographer step in the SOP.
--
-- 1. quo_messages kind reconfirm: migration wa239_reconfirm_kind (apply_migration, 15/10/26), the two statements:
--      alter table public.quo_messages drop constraint if exists quo_messages_kind_check;
--      alter table public.quo_messages add constraint quo_messages_kind_check check (kind = any (array['manual', 'confirm',
--        'confirm_test', 'inbound', 'ack', 'signup', 'survey', 'itinerary', 'recruit', 'reply', 'reconfirm']));
-- 2. The videographer role: wa209_volunteer_apply's role list, wa209_volunteer_roles (video, film), volunteer_role_guides
--    (a row copied from the photographer's, no spot by default), the website forms' "How would you like to help?" option.
-- 3. crm_form_apply step 7c: a website volunteer form (one that keeps a volunteering record) also files the application in
--    Applicants received through wa209_volunteer_apply; v_role knows videographer. Then the 15 submissions of 02/10 to 15/10
--    are backfilled (one per person a day).
-- 4. The "Still in?" texts (volunteer_pool_checks, wa239_pool_send, wa239_pool_text, wa239_pool_get, wa239_pool_answer,
--    wa239_pool_list); a YES or NO reply to one is understood by wa171_inbound when the person has no serving coming.
-- 5. A photographer or videographer applicant alerts the SOP's photographer owner (wa239_photo_owner, the trigger on
--    volunteer_applications, event volunteer_applied through wa_notify_call: notify v14 on Slack, hub-push v3 on devices).
-- The functions are patched in place from their live definitions (pg_get_functiondef + replace), so the rest of each one is
-- exactly what was there. No row is deleted anywhere. ASCII apart from the French words.
-- =====================================================================

-- ---------- 2. the videographer role ----------
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'wa209_volunteer_apply';
  if position('''videographer''' in d) = 0 then
    d := replace(d, '''photographer'', ''community_talker'', ''community_debrief'', ''volunteer'')',
                    '''photographer'', ''videographer'', ''community_talker'', ''community_debrief'', ''volunteer'')');
    if position('''videographer''' in d) = 0 then raise exception 'wa209_volunteer_apply: the role list was not found'; end if;
    execute d;
  end if;
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'wa209_volunteer_roles';
  if position('videographer' in d) = 0 then
    d := replace(d, 'if t ~ ''(photo)'' then r := r || ''photographer''::text; end if;',
                    'if t ~ ''(photo)'' then r := r || ''photographer''::text; end if;' || E'\n' ||
                    '  if t ~ ''(video|film|cinema|tournage)'' then r := r || ''videographer''::text; end if;');
    if position('videographer' in d) = 0 then raise exception 'wa209_volunteer_roles: the photo line was not found'; end if;
    execute d;
  end if;
end $$;

insert into public.volunteer_role_guides (role, label_en, label_fr, photo_id, expect_en, expect_fr, bring_en, bring_fr, arrive_en, arrive_fr, links, arrive_offset_min, duration_min, itinerary, target)
select 'videographer', 'Videographer', 'Vidéaste', g.photo_id,
  array['Read the content guide before the serving (below): what we like to capture and how.',
        'Film the team, the food and the setup: short clips (10 to 20 seconds, vertical for Instagram and TikTok) and a few wider shots.',
        'No close-ups of the people we serve, and ask before filming anyone.',
        'Within 24 hours, send us everything you captured: add it to the shared Google Photos album or the Drive folder, or email it to marketing@welfareavenue.com.'],
  array['Lisez le guide de contenu avant le service (ci-dessous) : ce que nous aimons saisir et comment.',
        'Filmez l''équipe, la nourriture et l''installation : de courts extraits (10 à 20 secondes, à la verticale pour Instagram et TikTok) et quelques plans larges.',
        'Pas de gros plans des personnes que nous servons, et demandez avant de filmer quelqu''un.',
        'Dans les 24 heures, envoyez-nous tout ce que vous avez filmé : ajoutez-le à l''album Google Photos partagé ou au dossier Drive, ou écrivez à marketing@welfareavenue.com.'],
  'Your phone or camera, charged, with room for video.', 'Votre téléphone ou votre appareil, chargé, avec de l''espace pour la vidéo.',
  g.arrive_en, g.arrive_fr, g.links, g.arrive_offset_min, g.duration_min, g.itinerary, 0
from public.volunteer_role_guides g where g.role = 'photographer'
on conflict (role) do nothing;

-- the website forms: "Filming video" / "Filmer des vidéos" after "Taking photos"
do $$
declare f record; v jsonb; i int; qq jsonb; opts jsonb; changed boolean;
begin
  for f in select id, lang, questions from public.crm_forms where kind = 'volunteer' and questions is not null loop
    v := f.questions; i := 0; changed := false;
    for qq in select * from jsonb_array_elements(f.questions) loop
      if qq ->> 'to' = 'volunteer.roles' and jsonb_typeof(qq -> 'options') = 'array'
         and not exists (select 1 from jsonb_array_elements(qq -> 'options') o where o ->> 'v' = 'videographer')
         and exists (select 1 from jsonb_array_elements(qq -> 'options') o where o ->> 'v' = 'photographer') then
        select jsonb_agg(s.x order by s.n, s.k) into opts from (
          select t.n, 0 as k, t.o as x from jsonb_array_elements(qq -> 'options') with ordinality t(o, n)
          union all
          select t.n, 1, case when f.lang = 'fr' then '{"l": "Filmer des vidéos", "v": "videographer"}'::jsonb else '{"l": "Filming video", "v": "videographer"}'::jsonb end
            from jsonb_array_elements(qq -> 'options') with ordinality t(o, n) where t.o ->> 'v' = 'photographer') s;
        v := jsonb_set(v, array[i::text, 'options'], opts);
        changed := true;
      end if;
      i := i + 1;
    end loop;
    if changed then update public.crm_forms set questions = v where id = f.id; end if;
  end loop;
end $$;

-- ---------- 3. website volunteer forms land in Applicants received (crm_form_apply step 7c) ----------
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'crm_form_apply';
  if position('7c. wave239' in d) > 0 then return; end if;
  d := replace(d, '''photographer'', ''community_debrief'', ''community_talker'']) with ordinality',
                  '''photographer'', ''videographer'', ''community_debrief'', ''community_talker'']) with ordinality');
  d := replace(d, '  -- 8. the timeline', $s$  -- 7c. wave239: a volunteer form that keeps a volunteering record also files the application in Applicants received
  --     (wa209_volunteer_apply: the application, its timeline line, the person tagged "volunteer applicant"), so the
  --     Volunteer Manager sees every applicant in one place. Not for a test, and not twice in a week for one person.
  if f.kind = 'volunteer' and coalesce((f.settings ->> 'volunteer_record')::boolean, false) and not s.is_test
     and not exists (select 1 from public.volunteer_applications a where lower(coalesce(a.email, '')) = v_em and a.applied_at > s.created_at - interval '7 days') then
    begin
      perform public.wa209_volunteer_apply(jsonb_build_object(
        'name', coalesce(v_full, v_em), 'email', v_em, 'phone', v_ph, 'roles', to_jsonb(v_roles),
        'role_text', array_to_string((select array_agg(public.wa171_role_label(x, 'en') order by o) from unnest(v_roles) with ordinality t(x, o)), ', '),
        'source', 'website', 'source_ref', 'form:' || s.id, 'applied_at', s.created_at, 'message', nullif(m ->> 'note', ''),
        'language', coalesce(f.lang, 'en'), 'by', v_src));
    exception when others then
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('form_submission', s.id::text, 'applicant', null, 'Applicants received: ' || left(sqlerrm, 300), v_src);
    end;
  end if;

  -- 8. the timeline$s$);
  if position('7c. wave239' in d) = 0 or position('''videographer''' in d) = 0 then raise exception 'crm_form_apply: an anchor was not found'; end if;
  execute d;
end $$;

-- the backfill: the website volunteer submissions processed before this wave (02/10 to 15/10/26), one per person a day
do $$
declare sub record; m jsonb; v_full text; v_em text; v_ph text; v_roles text[]; n int := 0; seen text[] := '{}';
begin
  for sub in select s.id, s.mapped, s.created_at, f.slug, f.lang
               from public.crm_form_submissions s join public.crm_forms f on f.id = s.form_id
              where f.kind = 'volunteer' and coalesce((f.settings ->> 'volunteer_record')::boolean, false)
                and s.status = 'processed' and not s.is_test
                and not exists (select 1 from public.volunteer_applications a where a.source_ref = 'form:' || s.id)
              order by s.created_at loop
    m := coalesce(sub.mapped, '{}'::jsonb);
    v_em := lower(btrim(coalesce(m #>> '{contact,email}', '')));
    if v_em = '' or (v_em || '|' || (sub.created_at at time zone 'America/Toronto')::date) = any (seen) then continue; end if;
    seen := seen || (v_em || '|' || (sub.created_at at time zone 'America/Toronto')::date);
    v_full := nullif(btrim(concat_ws(' ', nullif(btrim(coalesce(m #>> '{contact,first_name}', '')), ''), nullif(btrim(coalesce(m #>> '{contact,last_name}', '')), ''))), '');
    v_ph := nullif(btrim(coalesce(m #>> '{contact,phone}', '')), '');
    v_roles := coalesce((select array_agg(distinct x) from jsonb_array_elements_text(coalesce(m -> 'roles', '[]'::jsonb)) x), '{}');
    perform public.wa209_volunteer_apply(jsonb_build_object(
      'name', coalesce(v_full, v_em), 'email', v_em, 'phone', v_ph, 'roles', to_jsonb(v_roles),
      'role_text', array_to_string((select array_agg(public.wa171_role_label(x, 'en') order by o) from unnest(v_roles) with ordinality t(x, o)), ', '),
      'source', 'website', 'source_ref', 'form:' || sub.id, 'applied_at', sub.created_at, 'message', nullif(m ->> 'note', ''),
      'language', coalesce(sub.lang, 'en'), 'by', 'form:' || sub.slug));
    n := n + 1;
  end loop;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('hub', 'wave239', 'backfill', null, n || ' website volunteer submissions filed in Applicants received', 'assistant');
end $$;

-- ---------- 4. the "Still in?" texts ----------
create table if not exists public.volunteer_pool_checks (
  id bigserial primary key,
  batch_id uuid not null,
  person_id bigint not null,
  role text not null,
  phone text,
  token text not null unique,
  message_id bigint,
  asked_by text,
  created_at timestamptz not null default now(),
  answer text check (answer in ('yes', 'no')),
  answered_at timestamptz,
  via text,
  note text
);
comment on table public.volunteer_pool_checks is 'wave239: one "Still in?" text to a past volunteer (the token is the /c/ link; answer yes or no from the page or a reply).';
create index if not exists volunteer_pool_checks_person_idx on public.volunteer_pool_checks (person_id, created_at desc);
alter table public.volunteer_pool_checks enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'volunteer_pool_checks' and policyname = 'volunteer_pool_checks_staff_read') then
    create policy volunteer_pool_checks_staff_read on public.volunteer_pool_checks for select to authenticated using (public.is_wa_staff());
  end if;
end $$;

-- the words of one text (the person's language; the link is the /c/ page)
create or replace function public.wa239_pool_text(p_id bigint, p_test boolean default false)
returns text language plpgsql stable security definer set search_path to '' as $$
declare r record; v_lang text; v_first text; v_role text; v_link text; v_art text;
begin
  select c.id, c.person_id, c.role, c.token, p.full_name into r
    from public.volunteer_pool_checks c join public.volunteer_people p on p.id = c.person_id where c.id = p_id;
  if not found then return null; end if;
  v_lang := public.wa171_lang(r.person_id);
  v_first := coalesce(nullif(split_part(trim(coalesce(r.full_name, '')), ' ', 1), ''), case when v_lang = 'fr' then 'bonjour' else 'there' end);
  v_role := lower(public.wa171_role_label(r.role, v_lang));
  v_link := coalesce((select value from public.app_config where key = 'sms_link_base'), 'https://hub.welfareavenue.com/c/') || r.token || case when p_test then '?test=1' else '' end;
  if v_lang = 'fr' then
    return 'Bonjour ' || v_first || ', ici Welfare Avenue! Il y a quelque temps, vous vous êtes inscrit(e) comme bénévole (' || v_role
      || ') avec nous. Êtes-vous toujours partant(e)? Dites-le-nous ici, un seul clic : ' || v_link
      || ' (ou répondez OUI ou NON). Répondez ARRET pour ne plus recevoir de textos.';
  end if;
  v_art := case when v_role ~ '^[aeiou]' then 'an ' else 'a ' end;
  return 'Hi ' || v_first || ', it''s Welfare Avenue! A while back you signed up to volunteer with us as ' || v_art || v_role
    || '. Are you still up for it? Tell us here, one tap: ' || v_link || ' (or reply YES or NO). Reply STOP to stop texts.';
end $$;

-- leaders, HR and admins: one text per person (not again within 14 days), queued like the confirmations (sms_mode, the
-- test phones, STOP, the 9 to 19 window through quo-send drain and the tick)
create or replace function public.wa239_pool_send(p_role text, p_people bigint[])
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_mode text; v_who text; v_batch uuid := gen_random_uuid(); v_role text; p record; v_person record; v_tok text; v_id bigint; v_mid bigint; v_body text;
        n_q int := 0; n_phone int := 0; n_out int := 0; n_test int := 0; n_recent int := 0; n_missing int := 0;
begin
  if not (coalesce(public.is_wa_admin(), false) or coalesce(public.is_wa_leader(), false) or coalesce(public.wa_is_hr(), false)) then
    raise exception 'Only leaders, HR and admins can text volunteers.';
  end if;
  v_role := lower(btrim(coalesce(p_role, '')));
  if v_role = '' then raise exception 'Which role?'; end if;
  if p_people is null or cardinality(p_people) = 0 then raise exception 'Who gets the text?'; end if;
  if cardinality(p_people) > 200 then raise exception 'At most 200 people at a time.'; end if;
  v_who := coalesce(auth.jwt() ->> 'email', 'staff');
  v_mode := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  if v_mode not in ('test', 'live') then return jsonb_build_object('queued', 0, 'mode', v_mode, 'reason', 'Texts are off'); end if;
  for p in select distinct x as id from unnest(p_people) x order by 1 loop
    select vp.id, vp.full_name, (select public.wa171_digits(ph) from unnest(vp.phones) ph where public.wa171_digits(ph) is not null limit 1) as phone
      into v_person from public.volunteer_people vp where vp.id = p.id;
    if not found then n_missing := n_missing + 1; continue; end if;
    if v_person.phone is null then n_phone := n_phone + 1; continue; end if;
    if public.wa171_opted_out(v_person.id, v_person.phone) then n_out := n_out + 1; continue; end if;
    if v_mode = 'test' and not public.wa171_test_phone(v_person.phone) then n_test := n_test + 1; continue; end if;
    if exists (select 1 from public.volunteer_pool_checks c where c.person_id = v_person.id and c.created_at > now() - interval '14 days') then n_recent := n_recent + 1; continue; end if;
    v_tok := substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 20);
    insert into public.volunteer_pool_checks (batch_id, person_id, role, phone, token, asked_by)
    values (v_batch, v_person.id, v_role, '+1' || v_person.phone, v_tok, v_who) returning id into v_id;
    v_body := public.wa239_pool_text(v_id, false);
    insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id)
    values (v_batch, v_person.id, '+1' || v_person.phone, v_body, 'queued', null, v_who, 'out', 'reconfirm', null) returning id into v_mid;
    update public.volunteer_pool_checks set message_id = v_mid where id = v_id;
    n_q := n_q + 1;
  end loop;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('volunteer_pool', v_batch::text, 'still_in_texts', null,
          v_role || ': ' || n_q || ' queued' || case when n_recent > 0 then ', ' || n_recent || ' asked in the last 14 days' else '' end
          || case when n_phone > 0 then ', ' || n_phone || ' without a phone' else '' end || case when n_out > 0 then ', ' || n_out || ' opted out' else '' end
          || case when n_test > 0 then ', ' || n_test || ' held by test mode' else '' end || case when n_missing > 0 then ', ' || n_missing || ' unknown' else '' end, v_who);
  if n_q > 0 then
    begin perform public.call_edge('quo-send', '{"action":"drain"}'::jsonb); exception when others then null; end;
  end if;
  return jsonb_build_object('queued', n_q, 'mode', v_mode, 'batch', v_batch, 'no_phone', n_phone, 'opted_out', n_out, 'held_by_test_mode', n_test,
                            'asked_recently', n_recent, 'unknown', n_missing, 'window_open', public.wa191_sms_window(now()));
end $$;

-- the /c/ page: the token is the key; only a first name and the role come back
create or replace function public.wa239_pool_get(p_token text)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare c record; v_lang text;
begin
  if p_token is null or length(p_token) < 20 then return null; end if;
  select pc.id, pc.person_id, pc.role, pc.answer, pc.answered_at, pc.created_at, pc.note, p.full_name into c
    from public.volunteer_pool_checks pc join public.volunteer_people p on p.id = pc.person_id where pc.token = p_token;
  if not found then return null; end if;
  v_lang := public.wa171_lang(c.person_id);
  return jsonb_build_object('kind', 'pool', 'first', nullif(split_part(trim(coalesce(c.full_name, '')), ' ', 1), ''), 'role', c.role,
    'role_en', public.wa171_role_label(c.role, 'en'), 'role_fr', public.wa171_role_label(c.role, 'fr'), 'lang', v_lang,
    'answer', c.answer, 'answered_at', c.answered_at, 'asked_at', c.created_at, 'note', c.note);
end $$;

create or replace function public.wa239_pool_answer(p_token text, p jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare c record; v_ans text; v_note text; v_via text;
begin
  if p_token is null or length(p_token) < 20 then return jsonb_build_object('ok', false, 'reason', 'token'); end if;
  select pc.id, pc.person_id, pc.role, pc.answer, p.full_name into c
    from public.volunteer_pool_checks pc join public.volunteer_people p on p.id = pc.person_id where pc.token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'token'); end if;
  v_ans := lower(btrim(coalesce(p ->> 'answer', '')));
  if v_ans not in ('yes', 'no') then return jsonb_build_object('ok', false, 'reason', 'answer'); end if;
  v_note := nullif(left(btrim(coalesce(p ->> 'note', '')), 500), '');
  v_via := case when coalesce(p ->> 'via', '') = 'reply' then 'reply' else 'page' end;
  update public.volunteer_pool_checks set answer = v_ans, answered_at = now(), via = v_via, note = coalesce(v_note, note) where id = c.id;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('volunteer_pool', c.id::text, 'answer', c.answer, v_ans || ' (' || v_via || ')' || coalesce(': ' || left(v_note, 200), ''),
          coalesce(nullif(c.full_name, ''), 'volunteer') || ' (' || c.person_id || ')');
  return jsonb_build_object('ok', true, 'answer', v_ans, 'changed', c.answer is not null and c.answer <> v_ans);
end $$;

-- the Volunteers list: the latest check per person, with the text's status
create or replace function public.wa239_pool_list()
returns jsonb language sql stable security definer set search_path to '' as $$
  select case when public.is_wa_staff() then coalesce(jsonb_agg(jsonb_build_object('person_id', x.person_id, 'role', x.role, 'asked_at', x.created_at,
                  'answer', x.answer, 'answered_at', x.answered_at, 'via', x.via, 'note', x.note, 'status', x.status, 'error', x.error, 'asked_by', x.asked_by)
                  order by x.created_at desc), '[]'::jsonb) else '[]'::jsonb end
    from (select distinct on (c.person_id) c.person_id, c.role, c.created_at, c.answer, c.answered_at, c.via, c.note, c.asked_by, q.status, q.error
            from public.volunteer_pool_checks c left join public.quo_messages q on q.id = c.message_id
           order by c.person_id, c.created_at desc) x;
$$;

-- a YES or NO reply with no serving coming answers the open "Still in?" (wa171_inbound, patched in place)
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'wa171_inbound';
  if position('pool_yes' in d) > 0 then return; end if;
  d := replace(d, E'  elsif v_pid is null then\n    v_handled := ''unmatched'';',
$s$  elsif v_word in ('YES', 'Y', 'YEP', 'YEAH', 'OUI', 'O', 'OK', 'OKAY', 'NO', 'N', 'NON', 'NOPE') and v_row.roster_id is null
        and exists (select 1 from public.volunteer_pool_checks c where c.phone = '+1' || v_phone and c.answer is null and c.created_at > now() - interval '30 days') then
    -- wave239: a "Still in?" text answered by a reply
    perform public.wa239_pool_answer((select c.token from public.volunteer_pool_checks c where c.phone = '+1' || v_phone and c.answer is null order by c.created_at desc limit 1),
                                     jsonb_build_object('answer', case when v_word in ('NO', 'N', 'NON', 'NOPE') then 'no' else 'yes' end, 'via', 'reply'));
    v_handled := case when v_word in ('NO', 'N', 'NON', 'NOPE') then 'pool_no' else 'pool_yes' end;
  elsif v_pid is null then
    v_handled := 'unmatched';$s$);
  d := replace(d, E'  if v_handled in (''confirmed'', ''declined'') then',
$s$  if v_handled in ('pool_yes', 'pool_no') then
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
  if v_handled in ('confirmed', 'declined') then$s$);
  if position('else ''pool_yes'' end' in d) = 0 or position('(''pool_yes'', ''pool_no'')' in d) = 0 then raise exception 'wa171_inbound: an anchor was not found'; end if;
  execute d;
end $$;

-- ---------- 5. a photographer or videographer applicant alerts the SOP's photographer owner ----------
-- whoever owns "Volunteer Photographers" (86e04vj8k) on the next serving, else the template's default owner (Ian)
create or replace function public.wa239_photo_owner()
returns jsonb language sql stable security definer set search_path to '' as $$
  with o as (
    select coalesce(
      (select nullif(btrim(s.owner), '') from public.sop_event_steps s join public.volunteer_events e on e.id = s.event_id
        where s.template_id = '86e04vj8k' and e.kind = 'service' and coalesce(e.status, '') not in ('cancelled', 'completed')
          and e.event_date >= (now() at time zone 'America/Toronto')::date and nullif(btrim(s.owner), '') is not null
        order by e.event_date limit 1),
      (select nullif(btrim(t.default_owner), '') from public.sop_template t where t.id = '86e04vj8k'),
      'Ian') as name)
  select jsonb_build_object('name', coalesce(m.name, o.name), 'email', m.email, 'step', 'Volunteer Photographers')
    from o left join lateral (
      select tm.name, tm.email from public.team_members tm
       where coalesce(tm.active, true) and tm.email is not null
         and (lower(tm.name) = lower(o.name) or lower(split_part(tm.name, ' ', 1)) = lower(split_part(o.name, ' ', 1))
              or lower(o.name) = any (select lower(x) from unnest(coalesce(tm.nicknames, '{}'::text[])) x))
       order by (lower(tm.name) = lower(o.name)) desc, tm.id limit 1) m on true;
$$;

create or replace function public.wa239_volunteer_applied()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_owner jsonb;
begin
  if new.roles && array['photographer', 'videographer']::text[] then
    v_owner := public.wa239_photo_owner();
    perform public.wa_notify_call(jsonb_build_object('event', 'volunteer_applied', 'application_id', new.id,
      'to_name', v_owner ->> 'name', 'to_email', v_owner ->> 'email', 'roles', to_jsonb(new.roles), 'name', new.name, 'source', new.source));
  end if;
  return new;
exception when others then
  return new;
end $$;
create or replace trigger trg_wa239_volunteer_applied after insert on public.volunteer_applications
  for each row execute function public.wa239_volunteer_applied();

-- wa_notify_call: the new event also goes to hub-push (wave219 wants)
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'wa_notify_call';
  if position('volunteer_applied' in d) > 0 then return; end if;
  d := replace(d, 'in (''request_filed'', ''task_reassigned'', ''suggestion_accepted'', ''mentioned'')',
                  'in (''request_filed'', ''task_reassigned'', ''suggestion_accepted'', ''mentioned'', ''volunteer_applied'')');
  if position('volunteer_applied' in d) = 0 then raise exception 'wa_notify_call: the event list was not found'; end if;
  execute d;
end $$;

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('hub', 'release', 'wave239', null,
        'The volunteer roles set right: working role filters and a videographer role; website volunteer forms land in Applicants received; "Still in?" texts by role (volunteer_pool_checks, kind reconfirm); photographer applicants alert the SOP''s photographer owner (volunteer_applied)',
        'assistant');
