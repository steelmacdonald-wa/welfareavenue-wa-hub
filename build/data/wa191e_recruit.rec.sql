-- wa191e_recruit (01/10/26): Find volunteers, the recruiting tool in a serving's Recruit stage, and texts only 9 am to 7 pm.
-- Steel (01/10/26): "add a feature in the recruit section of the event to help recruit for upcoming event(s) and look through
-- our CRM to find people that signed up and never volunteered, volunteered a lot but haven't in a while, volunteered once
-- before, submitted a survey saying they liked the experience ... get them together for an event and then shoot them
-- personalized texts", and "It should use QUO to enable conversations with people and only message them throughout 9am to 7pm."
--
-- 1. Texts to volunteers go only between 9 am and 7 pm Toronto time (app_config sms_window_start 9, sms_window_end 19,
--    admin-only like every sms_ key). wa191_sms_window() is the one rule: the quarter-hour tick, the itinerary tick and the
--    automatic itineraries use it, and quo-send v5 holds every queued text (thank-yous after a YES included) until 9 am.
-- 2. wa191_recruit_pool(servings, days, servings-for-a-regular): every volunteer in the CRM with what the Hub knows (servings
--    in the Hub and on the old website, the last one, the role they do most, when they signed up, a survey or feedback form
--    saying they liked it, whether they are already on the chosen servings, the last text) and their groups: never (signed
--    up, never served), lapsed (3 or more servings, none in 60 days), once (served once), liked (Excellent or Good on the
--    Hub's survey or the volunteer feedback form, not "not at this time"). Staff only.
-- 3. wa191_recruit_send(servings, people, wording, dry run, text): invites people to one or more servings (Waiting For
--    Response, detail.source recruit; a CRM contact without a volunteer record gets one) and queues one personal text each
--    (quo_messages kind recruit) with their link to say yes or no; YES by text confirms. sms_mode decides as for every
--    automatic text (test: only the test phones; off: none), STOP is respected, nobody gets two invitations in 3 days.
--    Previews (dry run) for staff; adding and texting for leaders, HR and admins; logged per serving.
-- 4. The wording per group, English and French, in app_config recruit_templates (wa191_recruit_templates_save, staff, logged).
-- 5. Conversations: wa191_recruit_inbox (who texted or was texted lately, who waits for an answer), wa191_recruit_thread (one
--    number's texts), wa191_text_reply (an answer from the ops line through Quo, now or at 9 am; leaders, HR and admins).
-- 6. An invitation is not a sign-up: no sign-up text, no automatic 7-day confirmation text (they were asked already); their
--    link opens on Confirm or Can't make it whatever the date (volunteer_confirm_get: never "early", invited true); a YES by
--    text answers the invitation still open before a serving already answered (wa171_inbound).

/* ---------- 1. the window ---------- */
insert into public.app_config (key, value) values ('sms_window_start', '9'), ('sms_window_end', '19')
on conflict (key) do update set value = excluded.value;

create or replace function public.wa191_sms_window(p_at timestamptz default now()) returns boolean
language sql stable security definer set search_path to '' as $$
  select extract(hour from p_at at time zone 'America/Toronto') >= coalesce(nullif((select value from public.app_config where key = 'sms_window_start'), '')::int, 9)
     and extract(hour from p_at at time zone 'America/Toronto') < coalesce(nullif((select value from public.app_config where key = 'sms_window_end'), '')::int, 19)
$$;
comment on function public.wa191_sms_window(timestamptz) is 'wave191e: whether texts to volunteers may go now (Toronto time, app_config sms_window_start to sms_window_end, 9 am to 7 pm). Outside it they wait in the queue.';
revoke all on function public.wa191_sms_window(timestamptz) from public, anon;
grant execute on function public.wa191_sms_window(timestamptz) to authenticated;

alter table public.quo_messages drop constraint quo_messages_kind_check;
alter table public.quo_messages add constraint quo_messages_kind_check check (kind = any (array['manual', 'confirm', 'confirm_test', 'inbound', 'ack', 'signup', 'survey', 'itinerary', 'recruit', 'reply']));
comment on column public.quo_messages.kind is 'manual (Text volunteers), confirm (the 7-day confirmation), confirm_test, inbound, ack (thanks after YES or NO), signup, survey, itinerary, recruit (wave191e: an invitation from Find volunteers), reply (wave191e: an answer typed in the Hub''s conversations).';
create index if not exists quo_messages_phone_idx on public.quo_messages (right(regexp_replace(phone, '\D', '', 'g'), 10), created_at desc);

create or replace function public.wa171_sms_tick() returns jsonb
language plpgsql security definer set search_path to '' as $$
declare v_mode text; res jsonb := '{}'::jsonb;
begin
  v_mode := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  -- wave191e: nothing goes outside 9 am to 7 pm; what is queued waits for the first tick inside it
  if not public.wa191_sms_window() then return jsonb_build_object('mode', v_mode, 'reason', 'outside 9 am to 7 pm'); end if;
  if v_mode in ('test', 'live') then
    res := jsonb_build_object('confirm', public.wa171_queue_confirms(null, null, 'automation'), 'signup', public.wa172_queue_signups(), 'survey', public.wa172_queue_surveys(),
                              'itinerary', public.wa174_queue_itineraries());
  end if;
  if exists (select 1 from public.quo_messages where status = 'queued' and direction = 'out') then
    perform public.call_edge('quo-send', '{"action":"drain"}'::jsonb);
    res := res || jsonb_build_object('drain', true);
  end if;
  return res || jsonb_build_object('mode', v_mode);
end $$;
comment on function public.wa171_sms_tick() is 'wave171 (window from wave191e): every quarter hour between 9 am and 7 pm Toronto: queues the automatic texts (test or live) and asks quo-send to send what is queued (answers typed by staff outside the hours included). Cron wa-sms-tick.';

select cron.schedule('wa-sms-tick', '*/15 * * * *',
  $c$select public.wa171_sms_tick() where exists (select 1 from public.app_config where key = 'sms_mode' and value in ('test', 'live')) or exists (select 1 from public.quo_messages where direction = 'out' and status = 'queued')$c$);

do $p$
declare v text; n text;
begin
  -- the itinerary tick: the same window
  v := pg_get_functiondef('public.wa182_itinerary_tick()'::regprocedure);
  n := replace(v, 'if v_h < 8 or v_h >= 20 then n_wait := n_wait + 1; continue; end if;', 'if not public.wa191_sms_window() then n_wait := n_wait + 1; continue; end if;');
  if n = v then raise exception 'wa182_itinerary_tick: window pattern not found'; end if;
  v := n; n := replace(v, '''waiting_for_8am'', n_wait', '''waiting_for_8am'', n_wait, ''waiting_for_window'', n_wait');
  if n = v then raise exception 'wa182_itinerary_tick: return pattern not found'; end if;
  execute n;

  -- the automatic itineraries: from sms_itinerary_hour until the window closes
  v := pg_get_functiondef('public.wa182_auto_itineraries()'::regprocedure);
  n := replace(v, 'if extract(hour from v_now) < v_hour or extract(hour from v_now) >= 20 then', 'if extract(hour from v_now) < v_hour or not public.wa191_sms_window() then');
  if n = v then raise exception 'wa182_auto_itineraries: pattern not found'; end if;
  execute n;

  -- the 7-day confirmation: never automatically to an invitation (they were asked already); not twice in two days
  v := pg_get_functiondef('public.wa171_queue_confirms(bigint, bigint[], text)'::regprocedure);
  n := replace(v, E'       and er.confirm_status is null\n     order by e.event_date, er.id',
                  E'       and er.confirm_status is null\n       and (p_event is not null or p_roster is not null or coalesce(er.detail->>''source'', '''') <> ''recruit'')\n     order by e.event_date, er.id');
  if n = v then raise exception 'wa171_queue_confirms: where pattern not found'; end if;
  v := n; n := replace(v, 'q.roster_id = r.id and q.direction = ''out'' and q.kind = ''confirm'' and q.status in (''queued'', ''sent'')',
                          'q.roster_id = r.id and q.direction = ''out'' and (q.kind = ''confirm'' or (q.kind = ''recruit'' and q.created_at > now() - interval ''2 days'')) and q.status in (''queued'', ''sent'')');
  if n = v then raise exception 'wa171_queue_confirms: already-texted pattern not found'; end if;
  execute n;

  -- the sign-up text: not for an invitation either
  v := pg_get_functiondef('public.wa172_queue_signups()'::regprocedure);
  n := replace(v, 'coalesce(er.detail->>''source'', '''') <> ''sheet''', 'coalesce(er.detail->>''source'', '''') not in (''sheet'', ''recruit'')');
  if n = v then raise exception 'wa172_queue_signups: pattern not found'; end if;
  execute n;

  -- a reply: the invitation or confirmation still open first, then the texted serving, then the nearest
  v := pg_get_functiondef('public.wa171_inbound(jsonb)'::regprocedure);
  n := replace(v, 'order by (exists (select 1 from public.quo_messages q where q.roster_id = r.id and q.kind = ''confirm'' and q.status = ''sent'')) desc, e.event_date, r.id',
                  'order by (r.confirm_status is null and lower(coalesce(r.status, '''')) not in (''confirmed'', ''unavailable'') and exists (select 1 from public.quo_messages q where q.roster_id = r.id and q.kind in (''confirm'', ''recruit'') and q.status = ''sent'')) desc, (exists (select 1 from public.quo_messages q where q.roster_id = r.id and q.kind in (''confirm'', ''recruit'') and q.status = ''sent'')) desc, e.event_date, r.id');
  if n = v then raise exception 'wa171_inbound: order pattern not found'; end if;
  execute n;

  -- their link: an invitation is open whatever the date
  v := pg_get_functiondef('public.volunteer_confirm_get(text, boolean)'::regprocedure);
  n := replace(v, 'er.confirm, er.recipe_id,', 'er.confirm, er.recipe_id, er.detail,');
  if n = v then raise exception 'volunteer_confirm_get: select pattern not found'; end if;
  v := n; n := replace(v, 'when r.event_date - v_today > v_days then ''early'' else ''open'' end;', 'when r.event_date - v_today > v_days and coalesce(r.detail->>''source'', '''') <> ''recruit'' then ''early'' else ''open'' end;');
  if n = v then raise exception 'volunteer_confirm_get: state pattern not found'; end if;
  v := n; n := replace(v, 'when e2.event_date - v_today > v_days then ''early'' else ''open'' end)', 'when e2.event_date - v_today > v_days and coalesce(o.detail->>''source'', '''') <> ''recruit'' then ''early'' else ''open'' end)');
  if n = v then raise exception 'volunteer_confirm_get: events pattern not found'; end if;
  v := n; n := replace(v, '''state'', v_state, ''opens_on''', '''state'', v_state, ''invited'', coalesce(r.detail->>''source'', '''') = ''recruit'' and v_state = ''open'', ''opens_on''');
  if n = v then raise exception 'volunteer_confirm_get: output pattern not found'; end if;
  execute n;
end $p$;

comment on function public.wa171_queue_confirms(bigint, bigint[], text) is 'wave171: queues the confirmation texts (7 days before, or at once for a serving inside 7 days) for roster rows not yet confirmed; with p_event or p_roster, the ones staff pressed Text to confirm for. wave191e: the automatic pass skips invitations from Find volunteers (they were asked already), and nobody gets a confirmation within two days of an invitation.';
comment on function public.wa172_queue_signups() is 'wave172: the sign-up text (thanks, you are on the list for these servings, with the link) to people added to a roster in the last 3 days for servings more than sms_confirm_days out; test mode: test phones only. Never for rows from the operations sheet (wave191c) or invitations from Find volunteers (wave191e).';

/* ---------- 2. the wording ---------- */
create or replace function public.wa191_recruit_default_templates() returns jsonb
language sql immutable set search_path to '' as $$
  select jsonb_build_object(
    'never', jsonb_build_object(
      'en', 'Hi {first}, it''s Welfare Avenue! Thanks for signing up to volunteer with us. We''d love to have you at our serving on {dates}. No experience needed, we''ll show you everything. Can you join us? {answer}',
      'fr', 'Bonjour {first}, ici Welfare Avenue! Merci de votre intérêt pour le bénévolat avec nous. Nous aimerions vous accueillir le {dates}. Aucune expérience requise, on vous montre tout. Pouvez-vous venir? {answer}'),
    'lapsed', jsonb_build_object(
      'en', 'Hi {first}, it''s Welfare Avenue! We miss you. You''ve served with us {served} times and we''d love to have you back on {dates}. Can you join us? {answer}',
      'fr', 'Bonjour {first}, ici Welfare Avenue! Vous nous manquez. Vous avez servi avec nous {served} fois et nous aimerions vous revoir le {dates}. Pouvez-vous venir? {answer}'),
    'once', jsonb_build_object(
      'en', 'Hi {first}, it''s Welfare Avenue! Thanks again for serving with us in {last}. We''d love to have you back on {dates}. Can you join us? {answer}',
      'fr', 'Bonjour {first}, ici Welfare Avenue! Merci encore d''avoir servi avec nous en {last}. Nous aimerions vous revoir le {dates}. Pouvez-vous venir? {answer}'),
    'liked', jsonb_build_object(
      'en', 'Hi {first}, it''s Welfare Avenue! Thank you for your kind words after serving with us. We''d love to have you back on {dates}. Can you join us? {answer}',
      'fr', 'Bonjour {first}, ici Welfare Avenue! Merci pour vos bons mots après votre service avec nous. Nous aimerions vous revoir le {dates}. Pouvez-vous venir? {answer}'),
    'other', jsonb_build_object(
      'en', 'Hi {first}, it''s Welfare Avenue! We''re looking for volunteers for our serving on {dates}. Can you join us? {answer}',
      'fr', 'Bonjour {first}, ici Welfare Avenue! Nous cherchons des bénévoles pour notre service du {dates}. Pouvez-vous venir? {answer}'))
$$;
comment on function public.wa191_recruit_default_templates() is 'wave191e: the first wording of the Find volunteers texts, per group (never, lapsed, once, liked, other) in English and French. Placeholders: {first} {dates} {served} {last} {role} {answer} (reply YES or NO, or the link to pick dates) {link}.';

insert into public.app_config (key, value) values ('recruit_templates', public.wa191_recruit_default_templates()::text)
on conflict (key) do nothing;

create or replace function public.wa191_recruit_templates() returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare v jsonb; d jsonb := public.wa191_recruit_default_templates(); k text; out jsonb := '{}'::jsonb;
begin
  begin v := (select value from public.app_config where key = 'recruit_templates')::jsonb; exception when others then v := null; end;
  for k in select jsonb_object_keys(d) loop
    out := out || jsonb_build_object(k, jsonb_build_object(
      'en', coalesce(nullif(btrim(v->k->>'en'), ''), d->k->>'en'),
      'fr', coalesce(nullif(btrim(v->k->>'fr'), ''), d->k->>'fr')));
  end loop;
  return out;
end $$;
comment on function public.wa191_recruit_templates() is 'wave191e: the Find volunteers wording in use: app_config recruit_templates over the defaults, per group and language.';
revoke all on function public.wa191_recruit_templates() from public, anon;
grant execute on function public.wa191_recruit_templates() to authenticated;

create or replace function public.wa191_recruit_templates_save(p jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare v_cur jsonb; v_new jsonb; k text; l text; v_who text := coalesce(auth.jwt()->>'email', 'staff');
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'Nothing to save'; end if;
  v_cur := public.wa191_recruit_templates(); v_new := v_cur;
  for k in select jsonb_object_keys(p) loop
    if k not in ('never', 'lapsed', 'once', 'liked', 'other') then raise exception 'Unknown group %', k; end if;
    for l in select unnest(array['en', 'fr']) loop
      if p->k ? l then
        if length(btrim(coalesce(p->k->>l, ''))) < 20 then raise exception 'The % % text is too short', k, l; end if;
        if length(p->k->>l) > 600 then raise exception 'The % % text is too long (600 characters at most)', k, l; end if;
        if position('{answer}' in p->k->>l) = 0 and position('{link}' in p->k->>l) = 0 then raise exception 'The % % text needs {answer} or {link}, so they can say yes', k, l; end if;
        v_new := jsonb_set(v_new, array[k, l], to_jsonb(btrim(p->k->>l)));
      end if;
    end loop;
  end loop;
  insert into public.app_config (key, value) values ('recruit_templates', v_new::text) on conflict (key) do update set value = excluded.value;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('app_config', 'recruit_templates', 'wording', left(v_cur::text, 2000), left(v_new::text, 2000), v_who);
  return v_new;
end $$;
comment on function public.wa191_recruit_templates_save(jsonb) is 'wave191e: staff save the Find volunteers wording ({group: {en, fr}}): 20 to 600 characters, with {answer} or {link}; logged in change_log.';
revoke all on function public.wa191_recruit_templates_save(jsonb) from public, anon;
grant execute on function public.wa191_recruit_templates_save(jsonb) to authenticated;

create or replace function public.wa191_recruit_render(p_tmpl text, p_fr boolean, p_first text, p_dates date[], p_served int, p_last date, p_role text, p_link text)
returns text language plpgsql stable security definer set search_path to '' as $$
declare v text := coalesce(p_tmpl, ''); v_dates text; v_answer text; v_last text; v_role text; v_n int := coalesce(array_length(p_dates, 1), 0); i int;
  v_mfr text[] := array['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  v_year int := extract(year from (now() at time zone 'America/Toronto'))::int;
begin
  -- the dates: one in full (Sunday, October 18 / dimanche 18 octobre); several as a short list (October 18, November 1 or November 15)
  if v_n = 1 then v_dates := public.wa171_date_words(p_dates[1], case when p_fr then 'fr' else 'en' end);
  elsif v_n > 1 then
    v_dates := '';
    for i in 1 .. v_n loop
      v_dates := v_dates || case when i = 1 then '' when i = v_n then case when p_fr then ' ou ' else ' or ' end else ', ' end
        || case when p_fr then extract(day from p_dates[i])::int || case when extract(day from p_dates[i]) = 1 then 'er' else '' end || ' ' || v_mfr[extract(month from p_dates[i])::int]
                else trim(to_char(p_dates[i], 'FMMonth')) || ' ' || extract(day from p_dates[i])::int end;
    end loop;
  else v_dates := ''; end if;
  v_answer := case when v_n > 1 then case when p_fr then 'Choisissez vos dates ici : {link}' else 'Tap here to pick your dates: {link}' end
                   else case when p_fr then 'Répondez OUI ou NON, ou cliquez ici : {link}' else 'Reply YES or NO, or tap here: {link}' end end;
  if p_last is null then v := regexp_replace(v, '\s+(in|en)\s+\{last\}', '', 'g');
  else v_last := case when p_fr then v_mfr[extract(month from p_last)::int] else trim(to_char(p_last, 'FMMonth')) end
                 || case when extract(year from p_last)::int <> v_year then ' ' || extract(year from p_last)::int else '' end;
  end if;
  v_role := case when p_fr then lower(public.wa171_role_label(coalesce(p_role, 'volunteer'), 'fr'))
                 else (case when lower(public.wa171_role_label(coalesce(p_role, 'volunteer'), 'en')) ~ '^[aeiou]' then 'an ' else 'a ' end) || lower(public.wa171_role_label(coalesce(p_role, 'volunteer'), 'en')) end;
  v := replace(v, '{answer}', v_answer);
  v := replace(v, '{first}', coalesce(nullif(btrim(p_first), ''), case when p_fr then '' else 'there' end));
  v := replace(v, '{dates}', v_dates);
  v := replace(v, '{served}', coalesce(p_served, 0)::text);
  v := replace(v, '{last}', coalesce(v_last, ''));
  v := replace(v, '{role}', v_role);
  v := replace(v, '{link}', coalesce(p_link, ''));
  v := regexp_replace(regexp_replace(v, '[ \t]+([,.!?])', '\1', 'g'), '[ \t]{2,}', ' ', 'g');
  if v !~* '(stop|arr[eê]t)' then v := btrim(v) || E'\n' || case when p_fr then 'Répondez ARRET pour ne plus recevoir de textos.' else 'Reply STOP to stop texts.' end; end if;
  return left(btrim(v), 1000);
end $$;
comment on function public.wa191_recruit_render(text, boolean, text, date[], int, date, text, text) is 'wave191e: one Find volunteers text: the wording with {first} {dates} {served} {last} {role} {answer} {link} filled in, and the STOP line (Reply STOP / Répondez ARRET) when the wording has none.';
revoke all on function public.wa191_recruit_render(text, boolean, text, date[], int, date, text, text) from public, anon;
grant execute on function public.wa191_recruit_render(text, boolean, text, date[], int, date, text, text) to authenticated;

/* ---------- 3. who to ask ---------- */
create or replace function public.wa191_person_served(p_contact bigint, p_person bigint) returns jsonb
language sql stable security definer set search_path to '' as $$
  with hub as (
    select count(distinct e.id) n, max(e.event_date) last_on, mode() within group (order by lower(er.role)) top_role
      from public.event_roster er join public.volunteer_events e on e.id = er.event_id
     where p_person is not null and er.person_id = p_person and e.status = 'completed' and er.status = 'Confirmed'),
  leg as (
    select count(*) n, max((h.event_at at time zone 'America/Toronto')::date) last_on
      from public.crm_volunteer_history h where p_contact is not null and h.contact_id = p_contact and h.attended and h.volunteer_event_id is null)
  select jsonb_build_object('served', coalesce(hub.n, 0) + coalesce(leg.n, 0), 'last_on', greatest(hub.last_on, leg.last_on), 'top_role', hub.top_role) from hub, leg
$$;
comment on function public.wa191_person_served(bigint, bigint) is 'wave191e: how often a person served (confirmed at completed servings in the Hub, plus attended servings on the old website not already in the Hub, as the CRM counts), the last one and the role they did most.';
revoke all on function public.wa191_person_served(bigint, bigint) from public, anon, authenticated;

create or replace function public.wa191_recruit_pool(p_events bigint[] default null, p_lapsed_days int default 60, p_regular_min int default 3)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare v_today date := (now() at time zone 'America/Toronto')::date; v jsonb;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  p_lapsed_days := greatest(coalesce(p_lapsed_days, 60), 7);
  p_regular_min := greatest(coalesce(p_regular_min, 3), 2);
  with base as (
    select c.id cid, c.volunteer_id pid, c.full_name,
           coalesce(nullif(btrim(c.first_name), ''), nullif(split_part(btrim(coalesce(c.full_name, '')), ' ', 1), '')) first_name,
           (select public.wa171_digits(x) from unnest(c.phones) x where public.wa171_digits(x) is not null limit 1) phone,
           c.emails, lower(coalesce(c.language, '')) like 'fr%' fr, coalesce(c.sms_opt_out, false) opted_out, c.city,
           coalesce(vp.roles, '{}') roles, vp.needs_review, coalesce(vp.last_applied, (vp.created_at at time zone 'America/Toronto')::date, (c.created_at at time zone 'America/Toronto')::date) signed_up
      from public.crm_contacts c left join public.volunteer_profiles vp on vp.id = c.volunteer_id
     where c.merged_into is null
       and (c.volunteer_id is not null or 'volunteer' = any (c.kinds) or exists (select 1 from public.crm_volunteer_history h where h.contact_id = c.id))
  ), hub as (
    select er.person_id pid, count(distinct e.id) n, max(e.event_date) last_on, min(e.event_date) first_on, mode() within group (order by lower(er.role)) top_role
      from public.event_roster er join public.volunteer_events e on e.id = er.event_id
     where e.status = 'completed' and er.status = 'Confirmed' and er.person_id is not null
     group by er.person_id
  ), asked as (
    select er.person_id pid, count(*) n, count(*) filter (where lower(coalesce(er.status, '')) = 'unavailable') said_no
      from public.event_roster er join public.volunteer_events e on e.id = er.event_id
     where e.status = 'completed' and er.person_id is not null group by er.person_id
  ), leg as (
    select h.contact_id cid, count(*) n, max((h.event_at at time zone 'America/Toronto')::date) last_on, min((h.event_at at time zone 'America/Toronto')::date) first_on
      from public.crm_volunteer_history h where h.attended and h.volunteer_event_id is null group by h.contact_id
  ), fbf as (
    select lower(btrim((select x->>'a' from jsonb_array_elements(r.answers) x where x->>'q' ilike '%email%' limit 1))) email,
           (select x->>'a' from jsonb_array_elements(r.answers) x where x->>'q' ilike '%overall%' limit 1) overall,
           (select x->>'a' from jsonb_array_elements(r.answers) x where x->>'q' ilike '%continue volunteering%' limit 1) again,
           (r.submitted_at at time zone 'America/Toronto')::date on_day
      from public.form_responses r where r.kind = 'volunteer_feedback'
  ), liked_all as (
    select b.cid, f.on_day, f.overall word, f.again, 'form' src
      from fbf f join base b on f.email is not null and f.email like '%@%' and exists (select 1 from unnest(b.emails) e where lower(btrim(e)) = f.email)
     where lower(coalesce(f.overall, '')) in ('excellent', 'good')
    union all
    select b.cid, (s.submitted_at at time zone 'America/Toronto')::date, initcap(s.answers->>'overall'), replace(s.answers->>'again', '_', ' '), 'survey'
      from public.volunteer_survey_responses s join base b on b.pid = s.person_id
     where s.answers->>'overall' in ('excellent', 'good')
  ), lk as (
    select distinct on (cid) cid, on_day, word, again, src from liked_all order by cid, on_day desc nulls last
  ), onr as (
    select er.person_id pid, jsonb_agg(jsonb_build_object('e', er.event_id, 'st', coalesce(er.status, 'TBD'), 'r', er.role, 'src', er.detail->>'source') order by er.event_id) j
      from public.event_roster er
     where p_events is not null and er.event_id = any (p_events) and er.person_id is not null and lower(coalesce(er.status, '')) <> 'cancelled'
     group by er.person_id
  ), tx as (
    select q.person_id pid,
           max(q.created_at) filter (where q.direction = 'out' and q.status in ('queued', 'sent')) last_out,
           max(q.created_at) filter (where q.direction = 'in') last_in,
           max(q.created_at) filter (where q.direction = 'out' and q.kind = 'recruit' and q.status in ('queued', 'sent')) last_recruit
      from public.quo_messages q where q.person_id is not null group by q.person_id
  ), p as (
    select b.*, coalesce(hub.n, 0) + coalesce(leg.n, 0) served, greatest(hub.last_on, leg.last_on) last_on, least(hub.first_on, leg.first_on) first_on,
           hub.top_role, coalesce(asked.n, 0) asked, coalesce(asked.said_no, 0) said_no, lk.on_day lk_on, lk.word lk_word, lk.again lk_again, lk.src lk_src,
           onr.j on_roster, tx.last_out, tx.last_in, tx.last_recruit
      from base b left join hub on hub.pid = b.pid left join leg on leg.cid = b.cid left join asked on asked.pid = b.pid
      left join lk on lk.cid = b.cid left join onr on onr.pid = b.pid left join tx on tx.pid = b.pid
  )
  select jsonb_build_object('today', v_today, 'lapsed_days', p_lapsed_days, 'regular_min', p_regular_min,
           'mode', coalesce((select value from public.app_config where key = 'sms_mode'), 'off'), 'window_open', public.wa191_sms_window(),
           'people', coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'c', p.cid, 'p', p.pid, 'n', coalesce(nullif(btrim(p.full_name), ''), '(no name)'), 'f', p.first_name,
             'ph', case when p.phone is not null then '(' || substr(p.phone, 1, 3) || ') ' || substr(p.phone, 4, 3) || '-' || substr(p.phone, 7, 4) end,
             't', case when p.phone is not null and public.wa171_test_phone(p.phone) then true end,
             'fr', case when p.fr then true end, 'out', case when p.opted_out then true end, 'city', p.city,
             'roles', case when cardinality(p.roles) > 0 then to_jsonb(p.roles) end, 'top', p.top_role,
             's', p.served, 'l', p.last_on, 'f1', p.first_on, 'su', p.signed_up, 'ask', p.asked, 'no', p.said_no,
             'lk', case when p.lk_word is not null then jsonb_build_object('on', p.lk_on, 'w', p.lk_word, 'again', p.lk_again, 'src', p.lk_src) end,
             'g', to_jsonb(array_remove(array[
                    case when p.served = 0 then 'never' end,
                    case when p.served >= p_regular_min and p.last_on < v_today - p_lapsed_days then 'lapsed' end,
                    case when p.served = 1 then 'once' end,
                    case when p.lk_word is not null and lower(coalesce(p.lk_again, '')) not like 'not%' then 'liked' end], null)),
             'on', p.on_roster, 'tx', (p.last_out at time zone 'America/Toronto')::date, 'rx', (p.last_in at time zone 'America/Toronto')::date,
             'inv', (p.last_recruit at time zone 'America/Toronto')::date, 'rv', case when p.needs_review then true end))
           order by lower(coalesce(p.full_name, ''))), '[]'::jsonb))
    into v from p;
  return v;
end $$;
comment on function public.wa191_recruit_pool(bigint[], int, int) is 'wave191e: Find volunteers. Every volunteer in the CRM (a volunteer record, the volunteer kind, or old-website history) with servings (Hub and old website, as the CRM counts), the last and first, the role done most, how often asked and how often they said no, when they signed up, liked (Excellent or Good on the Hub survey, or on the volunteer feedback form matched by the email they left), their rows on the chosen servings, their last texts, and their groups: never, lapsed (p_regular_min or more servings, none in p_lapsed_days), once, liked (unless they answered not at this time). Staff only.';
revoke all on function public.wa191_recruit_pool(bigint[], int, int) from public, anon;
grant execute on function public.wa191_recruit_pool(bigint[], int, int) to authenticated;

/* ---------- 4. inviting and texting ---------- */
create or replace function public.wa191_recruit_send(p_events bigint[], p_people jsonb, p_texts jsonb default '{}'::jsonb, p_dry boolean default true, p_text boolean default true)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_who text := coalesce(auth.jwt()->>'email', 'staff');
  v_can boolean; v_mode text; v_today date := (now() at time zone 'America/Toronto')::date; v_tmpl jsonb; v_events bigint[];
  v_link_base text; v_batch uuid := gen_random_uuid(); x jsonb; ev record; c record;
  v_cid bigint; v_pid bigint; v_name text; v_group text; v_role text; v_stats jsonb; v_served int; v_last date;
  v_rows bigint[]; v_dates date[]; v_evs bigint[]; v_tok text; v_rid bigint; v_st text; v_body text; v_why text; v_tmp text;
  n_people int := 0; n_added int := 0; n_kept int := 0; n_conf int := 0; n_no int := 0; n_q int := 0; n_nophone int := 0; n_out int := 0;
  n_held int := 0; n_recent int := 0; n_notext int := 0; n_new_people int := 0; v_prev jsonb := '[]'::jsonb; v_by_ev jsonb := '{}'::jsonb;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  v_can := coalesce(public.is_wa_admin(), false) or coalesce(public.is_wa_leader(), false) or coalesce(public.wa_is_hr(), false);
  if not p_dry and p_text and not v_can then raise exception 'Only leaders, HR and admins can text volunteers. Untick "Text them" to add them without a text.'; end if;
  select array_agg(e.id order by e.event_date, e.id) into v_events from public.volunteer_events e
   where e.id = any (coalesce(p_events, '{}')) and e.kind = 'service' and e.status not in ('cancelled', 'completed') and e.event_date >= v_today;
  if v_events is null then raise exception 'Pick at least one upcoming serving.'; end if;
  if p_people is null or jsonb_typeof(p_people) <> 'array' or jsonb_array_length(p_people) = 0 then raise exception 'Pick at least one person.'; end if;
  if jsonb_array_length(p_people) > 200 then raise exception 'At most 200 people at a time.'; end if;
  v_mode := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  v_tmpl := public.wa191_recruit_templates();
  if p_texts is not null and jsonb_typeof(p_texts) = 'object' then
    for v_tmp in select jsonb_object_keys(p_texts) loop
      if v_tmp in ('never', 'lapsed', 'once', 'liked', 'other') and jsonb_typeof(p_texts->v_tmp) = 'object' then
        if length(btrim(coalesce(p_texts->v_tmp->>'en', ''))) >= 20 then v_tmpl := jsonb_set(v_tmpl, array[v_tmp, 'en'], to_jsonb(left(p_texts->v_tmp->>'en', 600))); end if;
        if length(btrim(coalesce(p_texts->v_tmp->>'fr', ''))) >= 20 then v_tmpl := jsonb_set(v_tmpl, array[v_tmp, 'fr'], to_jsonb(left(p_texts->v_tmp->>'fr', 600))); end if;
      end if;
    end loop;
  end if;
  v_link_base := coalesce((select value from public.app_config where key = 'sms_link_base'), 'https://hub.welfareavenue.com/c/');

  for x in select value from jsonb_array_elements(p_people) loop
    v_cid := nullif(x->>'contact_id', '')::bigint; v_pid := nullif(x->>'person_id', '')::bigint; v_why := null;
    select cc.id, cc.volunteer_id, coalesce(nullif(btrim(cc.full_name), ''), '(no name)') full_name,
           coalesce(nullif(btrim(cc.first_name), ''), nullif(split_part(btrim(coalesce(cc.full_name, '')), ' ', 1), '')) first_name,
           lower(coalesce(cc.language, '')) like 'fr%' fr,
           (select public.wa171_digits(y) from unnest(cc.phones) y where public.wa171_digits(y) is not null limit 1) phone
      into c from public.crm_contacts cc
     where cc.merged_into is null and ((v_pid is not null and cc.volunteer_id = v_pid) or (v_pid is null and v_cid is not null and cc.id = v_cid))
     order by cc.id limit 1;
    if c.id is null then continue; end if;
    n_people := n_people + 1; v_pid := c.volunteer_id; v_name := c.full_name;
    v_group := case when x->>'group' in ('never', 'lapsed', 'once', 'liked', 'other') then x->>'group' else 'other' end;
    v_stats := public.wa191_person_served(c.id, v_pid);
    v_served := coalesce((v_stats->>'served')::int, 0); v_last := (v_stats->>'last_on')::date;
    v_role := lower(coalesce(nullif(x->>'role', ''), v_stats->>'top_role', 'server'));
    if not exists (select 1 from public.volunteer_role_guides g where g.role = v_role) then v_role := 'server'; end if;

    -- a CRM contact with no volunteer record gets one, linked to their contact (never a second contact)
    if v_pid is null and not p_dry then
      v_pid := nextval('public.volunteer_people_id_seq');
      insert into public.volunteer_profiles (id, roles, needs_review, created_at, joined_note) values (v_pid, '{}', false, now(), 'Invited from Find volunteers (wave191e) by ' || v_who);
      update public.crm_contacts set volunteer_id = v_pid, kinds = case when 'volunteer' = any (kinds) then kinds else kinds || array['volunteer'] end, updated_by = v_who, updated_at = now()
       where id = c.id and volunteer_id is null;
      n_new_people := n_new_people + 1;
    end if;

    -- their rows on the servings: kept when waiting, left alone when confirmed or when they said no, added otherwise
    v_rows := '{}'; v_dates := '{}'; v_evs := '{}'; v_tok := null;
    for ev in select e.id, e.event_date from public.volunteer_events e where e.id = any (v_events) order by e.event_date, e.id loop
      v_rid := null; v_st := null;
      if v_pid is not null then
        select r.id, lower(coalesce(r.status, '')) || case when r.confirm_status is not null then ':' || r.confirm_status else '' end into v_rid, v_st
          from public.event_roster r where r.event_id = ev.id and r.person_id = v_pid and lower(coalesce(r.status, '')) <> 'cancelled' order by r.id limit 1;
      end if;
      if v_rid is not null and (v_st like 'confirmed%' or v_st like '%:confirmed') then n_conf := n_conf + 1; continue; end if;
      if v_rid is not null and (v_st like 'unavailable%' or v_st like '%:declined') then n_no := n_no + 1; continue; end if;
      if v_rid is not null then n_kept := n_kept + 1;
      elsif not p_dry then
        insert into public.event_roster (event_id, person_id, person_name, role, status, detail, sort)
        values (ev.id, v_pid, v_name, v_role, 'Waiting For Response',
                jsonb_strip_nulls(jsonb_build_object('source', 'recruit', 'group', v_group, 'by', v_who, 'at', now(),
                  'phone', case when c.phone is not null then '(' || substr(c.phone, 1, 3) || ') ' || substr(c.phone, 4, 3) || '-' || substr(c.phone, 7, 4) end)), 900)
        returning id into v_rid;
        n_added := n_added + 1;
        v_by_ev := jsonb_set(v_by_ev, array[ev.id::text], to_jsonb(coalesce((v_by_ev->>ev.id::text)::int, 0) + 1));
      else n_added := n_added + 1; end if;
      v_rows := v_rows || v_rid; v_dates := v_dates || ev.event_date; v_evs := v_evs || ev.id;
    end loop;
    if cardinality(v_dates) = 0 then
      v_prev := v_prev || jsonb_build_array(jsonb_build_object('n', v_name, 'g', v_group, 'why', 'already answered for these servings'));
      continue;
    end if;
    if v_rows[1] is not null then
      select r.confirm_token into v_tok from public.event_roster r where r.id = v_rows[1];
      if v_tok is null and not p_dry then
        v_tok := substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 20);
        update public.event_roster set confirm_token = v_tok where id = v_rows[1];
      end if;
    end if;

    -- the text
    v_body := public.wa191_recruit_render(v_tmpl->v_group->>(case when c.fr then 'fr' else 'en' end), c.fr, c.first_name, v_dates, v_served, v_last, v_role,
                                          v_link_base || coalesce(v_tok, 'PREVIEW'));
    if not p_text then v_why := 'added, no text'; n_notext := n_notext + 1;
    elsif c.phone is null then v_why := 'no phone number'; n_nophone := n_nophone + 1;
    elsif public.wa171_opted_out(v_pid, c.phone) then v_why := 'stopped texts (STOP)'; n_out := n_out + 1;
    elsif v_mode not in ('test', 'live') then v_why := 'texts are off'; n_held := n_held + 1;
    elsif v_mode = 'test' and not public.wa171_test_phone(c.phone) then v_why := 'test mode: only the test phone gets texts'; n_held := n_held + 1;
    elsif exists (select 1 from public.quo_messages q where q.direction = 'out' and q.kind = 'recruit' and q.status in ('queued', 'sent') and q.created_at > now() - interval '3 days'
                  and (q.person_id = v_pid or right(regexp_replace(q.phone, '\D', '', 'g'), 10) = c.phone)) then
      v_why := 'invited in the last 3 days'; n_recent := n_recent + 1;
    else
      if not p_dry then
        insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id)
        values (v_batch, v_pid, '+1' || c.phone, v_body, 'queued', v_evs[1], v_who, 'out', 'recruit', v_rows[1]);
      end if;
      n_q := n_q + 1;
    end if;
    if p_dry and jsonb_array_length(v_prev) < 60 then
      v_prev := v_prev || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('n', v_name, 'g', v_group, 'fr', case when c.fr then true end, 'text', v_body, 'why', v_why,
                 'dates', to_jsonb(v_dates), 'chars', length(v_body))));
    end if;
  end loop;

  if not p_dry then
    for ev in select e.id, e.code from public.volunteer_events e where e.id = any (v_events) loop
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('volunteer_event', ev.id::text, 'recruit', null,
              coalesce((v_by_ev->>ev.id::text)::int, 0) || ' added by Find volunteers; ' || n_q || ' invitation text' || case when n_q = 1 then '' else 's' end || ' queued (batch ' || v_batch || ', ' || n_people || ' people, ' || array_length(v_events, 1) || ' serving' || case when array_length(v_events, 1) = 1 then '' else 's' end || ')', v_who);
    end loop;
    if n_q > 0 and public.wa191_sms_window() then perform public.call_edge('quo-send', '{"action":"drain"}'::jsonb); end if;
    perform public.wa191_autotick(e) from unnest(v_events) e;
  end if;
  return jsonb_build_object('dry', p_dry, 'people', n_people, 'added', n_added, 'kept', n_kept, 'already_confirmed', n_conf, 'said_no', n_no,
    'texts', n_q, 'no_phone', n_nophone, 'opted_out', n_out, 'held', n_held, 'invited_recently', n_recent, 'not_texted', n_notext, 'new_records', n_new_people,
    'mode', v_mode, 'sends_now', public.wa191_sms_window(), 'batch', case when not p_dry then v_batch end, 'previews', v_prev);
end $$;
comment on function public.wa191_recruit_send(bigint[], jsonb, jsonb, boolean, boolean) is 'wave191e: Find volunteers. p_people [{person_id|contact_id, group, role}] are invited to the upcoming servings p_events: a row Waiting For Response (detail.source recruit) where they have none (a CRM contact without a volunteer record gets one), rows they already answered left alone; one personal text each (quo_messages kind recruit, the group''s wording from p_texts or recruit_templates in their language, their link) unless p_text is false. sms_mode, STOP and a 3-day gap between invitations decide who is texted; quo-send sends between 9 am and 7 pm. p_dry: previews only (staff). Adding: staff; texting: leaders, HR and admins. Logged per serving.';
revoke all on function public.wa191_recruit_send(bigint[], jsonb, jsonb, boolean, boolean) from public, anon;
grant execute on function public.wa191_recruit_send(bigint[], jsonb, jsonb, boolean, boolean) to authenticated;

/* ---------- 5. conversations ---------- */
create or replace function public.wa191_recruit_inbox(p_events bigint[] default null, p_days int default 21) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare v jsonb;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  with m as (
    select right(regexp_replace(q.phone, '\D', '', 'g'), 10) ph, q.*
      from public.quo_messages q
     where q.created_at > now() - make_interval(days => greatest(coalesce(p_days, 21), 1)) and q.status <> 'dry_run' and q.kind <> 'confirm_test'
  ), ppl as (
    select m.ph, max(m.person_id) pid from m group by m.ph
  ), last_m as (
    select distinct on (m.ph) m.ph, m.direction, m.body, m.created_at, m.handled, m.kind, m.status from m order by m.ph, m.created_at desc, m.id desc
  ), agg as (
    select m.ph, count(*) n, count(*) filter (where m.direction = 'in') n_in, array_agg(distinct m.event_id) filter (where m.event_id is not null) evs from m group by m.ph
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'ph', l.ph, 'phf', '(' || substr(l.ph, 1, 3) || ') ' || substr(l.ph, 4, 3) || '-' || substr(l.ph, 7, 4),
           'p', ppl.pid, 'n', coalesce((select vp.full_name from public.volunteer_people vp where vp.id = ppl.pid), (select cc.full_name from public.crm_contacts cc where cc.merged_into is null and exists (select 1 from unnest(cc.phones) y where public.wa171_digits(y) = l.ph) order by cc.id limit 1)),
           'at', l.created_at, 'dir', l.direction, 'last', left(l.body, 160), 'kind', l.kind, 'st', l.status, 'h', l.handled,
           'wait', case when l.direction = 'in' and coalesce(l.handled, '') not in ('confirmed', 'declined', 'opted_out', 'opted_in', 'duplicate', 'ignored') then true end,
           'cnt', a.n, 'cin', a.n_in, 'evs', to_jsonb(a.evs))) order by l.created_at desc), '[]'::jsonb)
    into v
    from last_m l join agg a on a.ph = l.ph join ppl on ppl.ph = l.ph
   where l.ph is not null and length(l.ph) = 10
     and (p_events is null or a.evs && p_events
          or exists (select 1 from public.event_roster r where r.event_id = any (p_events) and r.person_id = ppl.pid));
  return v;
end $$;
comment on function public.wa191_recruit_inbox(bigint[], int) is 'wave191e: the conversations on the ops line in the last p_days days, one per phone number: the person, the last text, how many, and wait (their text is the last and the Hub did not answer it by itself). With p_events, the numbers texted about those servings or of people on their rosters. Staff only.';
revoke all on function public.wa191_recruit_inbox(bigint[], int) from public, anon;
grant execute on function public.wa191_recruit_inbox(bigint[], int) to authenticated;

create or replace function public.wa191_recruit_thread(p_phone text) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare v_ph text := public.wa171_digits(p_phone); v jsonb; v_pid bigint;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  if v_ph is null then raise exception 'Which number?'; end if;
  select vp.id into v_pid from public.volunteer_people vp where exists (select 1 from unnest(vp.phones) y where public.wa171_digits(y) = v_ph) order by vp.id limit 1;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', q.id, 'dir', q.direction, 'kind', q.kind, 'st', q.status, 'body', q.body, 'at', q.created_at, 'sent', q.sent_at,
           'h', q.handled, 'by', case when q.direction = 'out' and q.sent_by not in ('automation', 'quo-events', 'system') then q.sent_by end, 'qid', q.quo_id, 'err', left(q.error, 160),
           'ev', (select e.code from public.volunteer_events e where e.id = q.event_id))) order by q.created_at, q.id), '[]'::jsonb)
    into v
    from (select * from public.quo_messages q2 where right(regexp_replace(q2.phone, '\D', '', 'g'), 10) = v_ph and q2.status <> 'dry_run' and q2.kind <> 'confirm_test'
          order by q2.created_at desc, q2.id desc limit 150) q;
  return jsonb_build_object('ph', v_ph, 'p', v_pid,
    'n', (select vp.full_name from public.volunteer_people vp where vp.id = v_pid),
    'out', public.wa171_opted_out(v_pid, v_ph), 'window_open', public.wa191_sms_window(), 'messages', v);
end $$;
comment on function public.wa191_recruit_thread(text) is 'wave191e: one number''s texts with the ops line as the Hub has them (the last 150, oldest first), the person, whether they stopped texts and whether a reply would go now. Staff only. quo-send v5 thread adds what was typed in the Quo app.';
revoke all on function public.wa191_recruit_thread(text) from public, anon;
grant execute on function public.wa191_recruit_thread(text) to authenticated;

create or replace function public.wa191_text_reply(p_phone text, p_body text) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare v_ph text := public.wa171_digits(p_phone); v_body text := btrim(coalesce(p_body, '')); v_pid bigint; v_row record; v_id bigint; v_who text := coalesce(auth.jwt()->>'email', 'staff'); v_now boolean;
begin
  if not (coalesce(public.is_wa_admin(), false) or coalesce(public.is_wa_leader(), false) or coalesce(public.wa_is_hr(), false)) then
    raise exception 'Only leaders, HR and admins can text volunteers.';
  end if;
  if v_ph is null then raise exception 'Which number?'; end if;
  if length(v_body) < 2 then raise exception 'Write the reply first.'; end if;
  if length(v_body) > 1000 then raise exception 'Keep it under 1,000 characters.'; end if;
  select vp.id into v_pid from public.volunteer_people vp where exists (select 1 from unnest(vp.phones) y where public.wa171_digits(y) = v_ph) order by vp.id limit 1;
  if public.wa171_opted_out(v_pid, v_ph) then raise exception 'They texted STOP, so the Hub cannot text them. They can text START to the ops line to get texts again.'; end if;
  -- the serving the conversation is about: their next one, if any
  select r.id, r.event_id into v_row from public.event_roster r join public.volunteer_events e on e.id = r.event_id
   where v_pid is not null and r.person_id = v_pid and e.kind = 'service' and e.status not in ('cancelled', 'completed') and e.event_date >= (now() at time zone 'America/Toronto')::date
     and lower(coalesce(r.status, '')) <> 'cancelled' order by e.event_date, r.id limit 1;
  insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id)
  values (gen_random_uuid(), v_pid, '+1' || v_ph, v_body, 'queued', v_row.event_id, v_who, 'out', 'reply', v_row.id)
  returning id into v_id;
  -- an answered question is no longer waiting
  update public.quo_messages set handled = 'answered' where direction = 'in' and right(regexp_replace(phone, '\D', '', 'g'), 10) = v_ph and coalesce(handled, '') in ('question', 'unmatched', 'stored');
  v_now := public.wa191_sms_window();
  if v_now then perform public.call_edge('quo-send', '{"action":"drain"}'::jsonb); end if;
  return jsonb_build_object('id', v_id, 'sends_now', v_now);
end $$;
comment on function public.wa191_text_reply(text, text) is 'wave191e: a reply typed in the Hub''s conversations, from the ops line through Quo (quo_messages kind reply): now between 9 am and 7 pm, otherwise at 9 am. Not to someone who texted STOP. Their open question counts as answered. Leaders, HR and admins; sms_mode does not hold a person''s own reply (as with Text volunteers).';
revoke all on function public.wa191_text_reply(text, text) from public, anon;
grant execute on function public.wa191_text_reply(text, text) to authenticated;

-- the record
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261001200000', 'wa191e_recruit', array[$m$/* ---------- 1. the window ---------- */
insert into public.app_config (key, value) values ('sms_window_start', '9'), ('sms_window_end', '19')
on conflict (key) do update set value = excluded.value$m$,$m$create or replace function public.wa191_sms_window(p_at timestamptz default now()) returns boolean
language sql stable security definer set search_path to '' as $$
  select extract(hour from p_at at time zone 'America/Toronto') >= coalesce(nullif((select value from public.app_config where key = 'sms_window_start'), '')::int, 9)
     and extract(hour from p_at at time zone 'America/Toronto') < coalesce(nullif((select value from public.app_config where key = 'sms_window_end'), '')::int, 19)
$$$m$,$m$comment on function public.wa191_sms_window(timestamptz) is 'wave191e: whether texts to volunteers may go now (Toronto time, app_config sms_window_start to sms_window_end, 9 am to 7 pm). Outside it they wait in the queue.'$m$,$m$revoke all on function public.wa191_sms_window(timestamptz) from public, anon$m$,$m$grant execute on function public.wa191_sms_window(timestamptz) to authenticated$m$,$m$alter table public.quo_messages drop constraint quo_messages_kind_check$m$,$m$alter table public.quo_messages add constraint quo_messages_kind_check check (kind = any (array['manual', 'confirm', 'confirm_test', 'inbound', 'ack', 'signup', 'survey', 'itinerary', 'recruit', 'reply']))$m$,$m$comment on column public.quo_messages.kind is 'manual (Text volunteers), confirm (the 7-day confirmation), confirm_test, inbound, ack (thanks after YES or NO), signup, survey, itinerary, recruit (wave191e: an invitation from Find volunteers), reply (wave191e: an answer typed in the Hub''s conversations).'$m$,$m$create index if not exists quo_messages_phone_idx on public.quo_messages (right(regexp_replace(phone, '\D', '', 'g'), 10), created_at desc)$m$,$m$create or replace function public.wa171_sms_tick() returns jsonb
language plpgsql security definer set search_path to '' as $$
declare v_mode text; res jsonb := '{}'::jsonb;
begin
  v_mode := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  -- wave191e: nothing goes outside 9 am to 7 pm; what is queued waits for the first tick inside it
  if not public.wa191_sms_window() then return jsonb_build_object('mode', v_mode, 'reason', 'outside 9 am to 7 pm'); end if;
  if v_mode in ('test', 'live') then
    res := jsonb_build_object('confirm', public.wa171_queue_confirms(null, null, 'automation'), 'signup', public.wa172_queue_signups(), 'survey', public.wa172_queue_surveys(),
                              'itinerary', public.wa174_queue_itineraries());
  end if;
  if exists (select 1 from public.quo_messages where status = 'queued' and direction = 'out') then
    perform public.call_edge('quo-send', '{"action":"drain"}'::jsonb);
    res := res || jsonb_build_object('drain', true);
  end if;
  return res || jsonb_build_object('mode', v_mode);
end $$$m$,$m$comment on function public.wa171_sms_tick() is 'wave171 (window from wave191e): every quarter hour between 9 am and 7 pm Toronto: queues the automatic texts (test or live) and asks quo-send to send what is queued (answers typed by staff outside the hours included). Cron wa-sms-tick.'$m$,$m$select cron.schedule('wa-sms-tick', '*/15 * * * *',
  $c$select public.wa171_sms_tick() where exists (select 1 from public.app_config where key = 'sms_mode' and value in ('test', 'live')) or exists (select 1 from public.quo_messages where direction = 'out' and status = 'queued')$c$)$m$,$m$do $p$
declare v text; n text;
begin
  -- the itinerary tick: the same window
  v := pg_get_functiondef('public.wa182_itinerary_tick()'::regprocedure);
  n := replace(v, 'if v_h < 8 or v_h >= 20 then n_wait := n_wait + 1; continue; end if;', 'if not public.wa191_sms_window() then n_wait := n_wait + 1; continue; end if;');
  if n = v then raise exception 'wa182_itinerary_tick: window pattern not found'; end if;
  v := n; n := replace(v, '''waiting_for_8am'', n_wait', '''waiting_for_8am'', n_wait, ''waiting_for_window'', n_wait');
  if n = v then raise exception 'wa182_itinerary_tick: return pattern not found'; end if;
  execute n;

  -- the automatic itineraries: from sms_itinerary_hour until the window closes
  v := pg_get_functiondef('public.wa182_auto_itineraries()'::regprocedure);
  n := replace(v, 'if extract(hour from v_now) < v_hour or extract(hour from v_now) >= 20 then', 'if extract(hour from v_now) < v_hour or not public.wa191_sms_window() then');
  if n = v then raise exception 'wa182_auto_itineraries: pattern not found'; end if;
  execute n;

  -- the 7-day confirmation: never automatically to an invitation (they were asked already); not twice in two days
  v := pg_get_functiondef('public.wa171_queue_confirms(bigint, bigint[], text)'::regprocedure);
  n := replace(v, E'       and er.confirm_status is null\n     order by e.event_date, er.id',
                  E'       and er.confirm_status is null\n       and (p_event is not null or p_roster is not null or coalesce(er.detail->>''source'', '''') <> ''recruit'')\n     order by e.event_date, er.id');
  if n = v then raise exception 'wa171_queue_confirms: where pattern not found'; end if;
  v := n; n := replace(v, 'q.roster_id = r.id and q.direction = ''out'' and q.kind = ''confirm'' and q.status in (''queued'', ''sent'')',
                          'q.roster_id = r.id and q.direction = ''out'' and (q.kind = ''confirm'' or (q.kind = ''recruit'' and q.created_at > now() - interval ''2 days'')) and q.status in (''queued'', ''sent'')');
  if n = v then raise exception 'wa171_queue_confirms: already-texted pattern not found'; end if;
  execute n;

  -- the sign-up text: not for an invitation either
  v := pg_get_functiondef('public.wa172_queue_signups()'::regprocedure);
  n := replace(v, 'coalesce(er.detail->>''source'', '''') <> ''sheet''', 'coalesce(er.detail->>''source'', '''') not in (''sheet'', ''recruit'')');
  if n = v then raise exception 'wa172_queue_signups: pattern not found'; end if;
  execute n;

  -- a reply: the invitation or confirmation still open first, then the texted serving, then the nearest
  v := pg_get_functiondef('public.wa171_inbound(jsonb)'::regprocedure);
  n := replace(v, 'order by (exists (select 1 from public.quo_messages q where q.roster_id = r.id and q.kind = ''confirm'' and q.status = ''sent'')) desc, e.event_date, r.id',
                  'order by (r.confirm_status is null and lower(coalesce(r.status, '''')) not in (''confirmed'', ''unavailable'') and exists (select 1 from public.quo_messages q where q.roster_id = r.id and q.kind in (''confirm'', ''recruit'') and q.status = ''sent'')) desc, (exists (select 1 from public.quo_messages q where q.roster_id = r.id and q.kind in (''confirm'', ''recruit'') and q.status = ''sent'')) desc, e.event_date, r.id');
  if n = v then raise exception 'wa171_inbound: order pattern not found'; end if;
  execute n;

  -- their link: an invitation is open whatever the date
  v := pg_get_functiondef('public.volunteer_confirm_get(text, boolean)'::regprocedure);
  n := replace(v, 'er.confirm, er.recipe_id,', 'er.confirm, er.recipe_id, er.detail,');
  if n = v then raise exception 'volunteer_confirm_get: select pattern not found'; end if;
  v := n; n := replace(v, 'when r.event_date - v_today > v_days then ''early'' else ''open'' end;', 'when r.event_date - v_today > v_days and coalesce(r.detail->>''source'', '''') <> ''recruit'' then ''early'' else ''open'' end;');
  if n = v then raise exception 'volunteer_confirm_get: state pattern not found'; end if;
  v := n; n := replace(v, 'when e2.event_date - v_today > v_days then ''early'' else ''open'' end)', 'when e2.event_date - v_today > v_days and coalesce(o.detail->>''source'', '''') <> ''recruit'' then ''early'' else ''open'' end)');
  if n = v then raise exception 'volunteer_confirm_get: events pattern not found'; end if;
  v := n; n := replace(v, '''state'', v_state, ''opens_on''', '''state'', v_state, ''invited'', coalesce(r.detail->>''source'', '''') = ''recruit'' and v_state = ''open'', ''opens_on''');
  if n = v then raise exception 'volunteer_confirm_get: output pattern not found'; end if;
  execute n;
end $p$$m$,$m$comment on function public.wa171_queue_confirms(bigint, bigint[], text) is 'wave171: queues the confirmation texts (7 days before, or at once for a serving inside 7 days) for roster rows not yet confirmed; with p_event or p_roster, the ones staff pressed Text to confirm for. wave191e: the automatic pass skips invitations from Find volunteers (they were asked already), and nobody gets a confirmation within two days of an invitation.'$m$,$m$comment on function public.wa172_queue_signups() is 'wave172: the sign-up text (thanks, you are on the list for these servings, with the link) to people added to a roster in the last 3 days for servings more than sms_confirm_days out; test mode: test phones only. Never for rows from the operations sheet (wave191c) or invitations from Find volunteers (wave191e).'$m$,$m$/* ---------- 2. the wording ---------- */
create or replace function public.wa191_recruit_default_templates() returns jsonb
language sql immutable set search_path to '' as $$
  select jsonb_build_object(
    'never', jsonb_build_object(
      'en', 'Hi {first}, it''s Welfare Avenue! Thanks for signing up to volunteer with us. We''d love to have you at our serving on {dates}. No experience needed, we''ll show you everything. Can you join us? {answer}',
      'fr', 'Bonjour {first}, ici Welfare Avenue! Merci de votre intérêt pour le bénévolat avec nous. Nous aimerions vous accueillir le {dates}. Aucune expérience requise, on vous montre tout. Pouvez-vous venir? {answer}'),
    'lapsed', jsonb_build_object(
      'en', 'Hi {first}, it''s Welfare Avenue! We miss you. You''ve served with us {served} times and we''d love to have you back on {dates}. Can you join us? {answer}',
      'fr', 'Bonjour {first}, ici Welfare Avenue! Vous nous manquez. Vous avez servi avec nous {served} fois et nous aimerions vous revoir le {dates}. Pouvez-vous venir? {answer}'),
    'once', jsonb_build_object(
      'en', 'Hi {first}, it''s Welfare Avenue! Thanks again for serving with us in {last}. We''d love to have you back on {dates}. Can you join us? {answer}',
      'fr', 'Bonjour {first}, ici Welfare Avenue! Merci encore d''avoir servi avec nous en {last}. Nous aimerions vous revoir le {dates}. Pouvez-vous venir? {answer}'),
    'liked', jsonb_build_object(
      'en', 'Hi {first}, it''s Welfare Avenue! Thank you for your kind words after serving with us. We''d love to have you back on {dates}. Can you join us? {answer}',
      'fr', 'Bonjour {first}, ici Welfare Avenue! Merci pour vos bons mots après votre service avec nous. Nous aimerions vous revoir le {dates}. Pouvez-vous venir? {answer}'),
    'other', jsonb_build_object(
      'en', 'Hi {first}, it''s Welfare Avenue! We''re looking for volunteers for our serving on {dates}. Can you join us? {answer}',
      'fr', 'Bonjour {first}, ici Welfare Avenue! Nous cherchons des bénévoles pour notre service du {dates}. Pouvez-vous venir? {answer}'))
$$$m$,$m$comment on function public.wa191_recruit_default_templates() is 'wave191e: the first wording of the Find volunteers texts, per group (never, lapsed, once, liked, other) in English and French. Placeholders: {first} {dates} {served} {last} {role} {answer} (reply YES or NO, or the link to pick dates) {link}.'$m$,$m$insert into public.app_config (key, value) values ('recruit_templates', public.wa191_recruit_default_templates()::text)
on conflict (key) do nothing$m$,$m$create or replace function public.wa191_recruit_templates() returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare v jsonb; d jsonb := public.wa191_recruit_default_templates(); k text; out jsonb := '{}'::jsonb;
begin
  begin v := (select value from public.app_config where key = 'recruit_templates')::jsonb; exception when others then v := null; end;
  for k in select jsonb_object_keys(d) loop
    out := out || jsonb_build_object(k, jsonb_build_object(
      'en', coalesce(nullif(btrim(v->k->>'en'), ''), d->k->>'en'),
      'fr', coalesce(nullif(btrim(v->k->>'fr'), ''), d->k->>'fr')));
  end loop;
  return out;
end $$$m$,$m$comment on function public.wa191_recruit_templates() is 'wave191e: the Find volunteers wording in use: app_config recruit_templates over the defaults, per group and language.'$m$,$m$revoke all on function public.wa191_recruit_templates() from public, anon$m$,$m$grant execute on function public.wa191_recruit_templates() to authenticated$m$,$m$create or replace function public.wa191_recruit_templates_save(p jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare v_cur jsonb; v_new jsonb; k text; l text; v_who text := coalesce(auth.jwt()->>'email', 'staff');
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'Nothing to save'; end if;
  v_cur := public.wa191_recruit_templates(); v_new := v_cur;
  for k in select jsonb_object_keys(p) loop
    if k not in ('never', 'lapsed', 'once', 'liked', 'other') then raise exception 'Unknown group %', k; end if;
    for l in select unnest(array['en', 'fr']) loop
      if p->k ? l then
        if length(btrim(coalesce(p->k->>l, ''))) < 20 then raise exception 'The % % text is too short', k, l; end if;
        if length(p->k->>l) > 600 then raise exception 'The % % text is too long (600 characters at most)', k, l; end if;
        if position('{answer}' in p->k->>l) = 0 and position('{link}' in p->k->>l) = 0 then raise exception 'The % % text needs {answer} or {link}, so they can say yes', k, l; end if;
        v_new := jsonb_set(v_new, array[k, l], to_jsonb(btrim(p->k->>l)));
      end if;
    end loop;
  end loop;
  insert into public.app_config (key, value) values ('recruit_templates', v_new::text) on conflict (key) do update set value = excluded.value;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('app_config', 'recruit_templates', 'wording', left(v_cur::text, 2000), left(v_new::text, 2000), v_who);
  return v_new;
end $$$m$,$m$comment on function public.wa191_recruit_templates_save(jsonb) is 'wave191e: staff save the Find volunteers wording ({group: {en, fr}}): 20 to 600 characters, with {answer} or {link}; logged in change_log.'$m$,$m$revoke all on function public.wa191_recruit_templates_save(jsonb) from public, anon$m$,$m$grant execute on function public.wa191_recruit_templates_save(jsonb) to authenticated$m$,$m$create or replace function public.wa191_recruit_render(p_tmpl text, p_fr boolean, p_first text, p_dates date[], p_served int, p_last date, p_role text, p_link text)
returns text language plpgsql stable security definer set search_path to '' as $$
declare v text := coalesce(p_tmpl, ''); v_dates text; v_answer text; v_last text; v_role text; v_n int := coalesce(array_length(p_dates, 1), 0); i int;
  v_mfr text[] := array['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  v_year int := extract(year from (now() at time zone 'America/Toronto'))::int;
begin
  -- the dates: one in full (Sunday, October 18 / dimanche 18 octobre); several as a short list (October 18, November 1 or November 15)
  if v_n = 1 then v_dates := public.wa171_date_words(p_dates[1], case when p_fr then 'fr' else 'en' end);
  elsif v_n > 1 then
    v_dates := '';
    for i in 1 .. v_n loop
      v_dates := v_dates || case when i = 1 then '' when i = v_n then case when p_fr then ' ou ' else ' or ' end else ', ' end
        || case when p_fr then extract(day from p_dates[i])::int || case when extract(day from p_dates[i]) = 1 then 'er' else '' end || ' ' || v_mfr[extract(month from p_dates[i])::int]
                else trim(to_char(p_dates[i], 'FMMonth')) || ' ' || extract(day from p_dates[i])::int end;
    end loop;
  else v_dates := ''; end if;
  v_answer := case when v_n > 1 then case when p_fr then 'Choisissez vos dates ici : {link}' else 'Tap here to pick your dates: {link}' end
                   else case when p_fr then 'Répondez OUI ou NON, ou cliquez ici : {link}' else 'Reply YES or NO, or tap here: {link}' end end;
  if p_last is null then v := regexp_replace(v, '\s+(in|en)\s+\{last\}', '', 'g');
  else v_last := case when p_fr then v_mfr[extract(month from p_last)::int] else trim(to_char(p_last, 'FMMonth')) end
                 || case when extract(year from p_last)::int <> v_year then ' ' || extract(year from p_last)::int else '' end;
  end if;
  v_role := case when p_fr then lower(public.wa171_role_label(coalesce(p_role, 'volunteer'), 'fr'))
                 else (case when lower(public.wa171_role_label(coalesce(p_role, 'volunteer'), 'en')) ~ '^[aeiou]' then 'an ' else 'a ' end) || lower(public.wa171_role_label(coalesce(p_role, 'volunteer'), 'en')) end;
  v := replace(v, '{answer}', v_answer);
  v := replace(v, '{first}', coalesce(nullif(btrim(p_first), ''), case when p_fr then '' else 'there' end));
  v := replace(v, '{dates}', v_dates);
  v := replace(v, '{served}', coalesce(p_served, 0)::text);
  v := replace(v, '{last}', coalesce(v_last, ''));
  v := replace(v, '{role}', v_role);
  v := replace(v, '{link}', coalesce(p_link, ''));
  v := regexp_replace(regexp_replace(v, '[ \t]+([,.!?])', '\1', 'g'), '[ \t]{2,}', ' ', 'g');
  if v !~* '(stop|arr[eê]t)' then v := btrim(v) || E'\n' || case when p_fr then 'Répondez ARRET pour ne plus recevoir de textos.' else 'Reply STOP to stop texts.' end; end if;
  return left(btrim(v), 1000);
end $$$m$,$m$comment on function public.wa191_recruit_render(text, boolean, text, date[], int, date, text, text) is 'wave191e: one Find volunteers text: the wording with {first} {dates} {served} {last} {role} {answer} {link} filled in, and the STOP line (Reply STOP / Répondez ARRET) when the wording has none.'$m$,$m$revoke all on function public.wa191_recruit_render(text, boolean, text, date[], int, date, text, text) from public, anon$m$,$m$grant execute on function public.wa191_recruit_render(text, boolean, text, date[], int, date, text, text) to authenticated$m$,$m$/* ---------- 3. who to ask ---------- */
create or replace function public.wa191_person_served(p_contact bigint, p_person bigint) returns jsonb
language sql stable security definer set search_path to '' as $$
  with hub as (
    select count(distinct e.id) n, max(e.event_date) last_on, mode() within group (order by lower(er.role)) top_role
      from public.event_roster er join public.volunteer_events e on e.id = er.event_id
     where p_person is not null and er.person_id = p_person and e.status = 'completed' and er.status = 'Confirmed'),
  leg as (
    select count(*) n, max((h.event_at at time zone 'America/Toronto')::date) last_on
      from public.crm_volunteer_history h where p_contact is not null and h.contact_id = p_contact and h.attended and h.volunteer_event_id is null)
  select jsonb_build_object('served', coalesce(hub.n, 0) + coalesce(leg.n, 0), 'last_on', greatest(hub.last_on, leg.last_on), 'top_role', hub.top_role) from hub, leg
$$$m$,$m$comment on function public.wa191_person_served(bigint, bigint) is 'wave191e: how often a person served (confirmed at completed servings in the Hub, plus attended servings on the old website not already in the Hub, as the CRM counts), the last one and the role they did most.'$m$,$m$revoke all on function public.wa191_person_served(bigint, bigint) from public, anon, authenticated$m$,$m$create or replace function public.wa191_recruit_pool(p_events bigint[] default null, p_lapsed_days int default 60, p_regular_min int default 3)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare v_today date := (now() at time zone 'America/Toronto')::date; v jsonb;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  p_lapsed_days := greatest(coalesce(p_lapsed_days, 60), 7);
  p_regular_min := greatest(coalesce(p_regular_min, 3), 2);
  with base as (
    select c.id cid, c.volunteer_id pid, c.full_name,
           coalesce(nullif(btrim(c.first_name), ''), nullif(split_part(btrim(coalesce(c.full_name, '')), ' ', 1), '')) first_name,
           (select public.wa171_digits(x) from unnest(c.phones) x where public.wa171_digits(x) is not null limit 1) phone,
           c.emails, lower(coalesce(c.language, '')) like 'fr%' fr, coalesce(c.sms_opt_out, false) opted_out, c.city,
           coalesce(vp.roles, '{}') roles, vp.needs_review, coalesce(vp.last_applied, (vp.created_at at time zone 'America/Toronto')::date, (c.created_at at time zone 'America/Toronto')::date) signed_up
      from public.crm_contacts c left join public.volunteer_profiles vp on vp.id = c.volunteer_id
     where c.merged_into is null
       and (c.volunteer_id is not null or 'volunteer' = any (c.kinds) or exists (select 1 from public.crm_volunteer_history h where h.contact_id = c.id))
  ), hub as (
    select er.person_id pid, count(distinct e.id) n, max(e.event_date) last_on, min(e.event_date) first_on, mode() within group (order by lower(er.role)) top_role
      from public.event_roster er join public.volunteer_events e on e.id = er.event_id
     where e.status = 'completed' and er.status = 'Confirmed' and er.person_id is not null
     group by er.person_id
  ), asked as (
    select er.person_id pid, count(*) n, count(*) filter (where lower(coalesce(er.status, '')) = 'unavailable') said_no
      from public.event_roster er join public.volunteer_events e on e.id = er.event_id
     where e.status = 'completed' and er.person_id is not null group by er.person_id
  ), leg as (
    select h.contact_id cid, count(*) n, max((h.event_at at time zone 'America/Toronto')::date) last_on, min((h.event_at at time zone 'America/Toronto')::date) first_on
      from public.crm_volunteer_history h where h.attended and h.volunteer_event_id is null group by h.contact_id
  ), fbf as (
    select lower(btrim((select x->>'a' from jsonb_array_elements(r.answers) x where x->>'q' ilike '%email%' limit 1))) email,
           (select x->>'a' from jsonb_array_elements(r.answers) x where x->>'q' ilike '%overall%' limit 1) overall,
           (select x->>'a' from jsonb_array_elements(r.answers) x where x->>'q' ilike '%continue volunteering%' limit 1) again,
           (r.submitted_at at time zone 'America/Toronto')::date on_day
      from public.form_responses r where r.kind = 'volunteer_feedback'
  ), liked_all as (
    select b.cid, f.on_day, f.overall word, f.again, 'form' src
      from fbf f join base b on f.email is not null and f.email like '%@%' and exists (select 1 from unnest(b.emails) e where lower(btrim(e)) = f.email)
     where lower(coalesce(f.overall, '')) in ('excellent', 'good')
    union all
    select b.cid, (s.submitted_at at time zone 'America/Toronto')::date, initcap(s.answers->>'overall'), replace(s.answers->>'again', '_', ' '), 'survey'
      from public.volunteer_survey_responses s join base b on b.pid = s.person_id
     where s.answers->>'overall' in ('excellent', 'good')
  ), lk as (
    select distinct on (cid) cid, on_day, word, again, src from liked_all order by cid, on_day desc nulls last
  ), onr as (
    select er.person_id pid, jsonb_agg(jsonb_build_object('e', er.event_id, 'st', coalesce(er.status, 'TBD'), 'r', er.role, 'src', er.detail->>'source') order by er.event_id) j
      from public.event_roster er
     where p_events is not null and er.event_id = any (p_events) and er.person_id is not null and lower(coalesce(er.status, '')) <> 'cancelled'
     group by er.person_id
  ), tx as (
    select q.person_id pid,
           max(q.created_at) filter (where q.direction = 'out' and q.status in ('queued', 'sent')) last_out,
           max(q.created_at) filter (where q.direction = 'in') last_in,
           max(q.created_at) filter (where q.direction = 'out' and q.kind = 'recruit' and q.status in ('queued', 'sent')) last_recruit
      from public.quo_messages q where q.person_id is not null group by q.person_id
  ), p as (
    select b.*, coalesce(hub.n, 0) + coalesce(leg.n, 0) served, greatest(hub.last_on, leg.last_on) last_on, least(hub.first_on, leg.first_on) first_on,
           hub.top_role, coalesce(asked.n, 0) asked, coalesce(asked.said_no, 0) said_no, lk.on_day lk_on, lk.word lk_word, lk.again lk_again, lk.src lk_src,
           onr.j on_roster, tx.last_out, tx.last_in, tx.last_recruit
      from base b left join hub on hub.pid = b.pid left join leg on leg.cid = b.cid left join asked on asked.pid = b.pid
      left join lk on lk.cid = b.cid left join onr on onr.pid = b.pid left join tx on tx.pid = b.pid
  )
  select jsonb_build_object('today', v_today, 'lapsed_days', p_lapsed_days, 'regular_min', p_regular_min,
           'mode', coalesce((select value from public.app_config where key = 'sms_mode'), 'off'), 'window_open', public.wa191_sms_window(),
           'people', coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'c', p.cid, 'p', p.pid, 'n', coalesce(nullif(btrim(p.full_name), ''), '(no name)'), 'f', p.first_name,
             'ph', case when p.phone is not null then '(' || substr(p.phone, 1, 3) || ') ' || substr(p.phone, 4, 3) || '-' || substr(p.phone, 7, 4) end,
             't', case when p.phone is not null and public.wa171_test_phone(p.phone) then true end,
             'fr', case when p.fr then true end, 'out', case when p.opted_out then true end, 'city', p.city,
             'roles', case when cardinality(p.roles) > 0 then to_jsonb(p.roles) end, 'top', p.top_role,
             's', p.served, 'l', p.last_on, 'f1', p.first_on, 'su', p.signed_up, 'ask', p.asked, 'no', p.said_no,
             'lk', case when p.lk_word is not null then jsonb_build_object('on', p.lk_on, 'w', p.lk_word, 'again', p.lk_again, 'src', p.lk_src) end,
             'g', to_jsonb(array_remove(array[
                    case when p.served = 0 then 'never' end,
                    case when p.served >= p_regular_min and p.last_on < v_today - p_lapsed_days then 'lapsed' end,
                    case when p.served = 1 then 'once' end,
                    case when p.lk_word is not null and lower(coalesce(p.lk_again, '')) not like 'not%' then 'liked' end], null)),
             'on', p.on_roster, 'tx', (p.last_out at time zone 'America/Toronto')::date, 'rx', (p.last_in at time zone 'America/Toronto')::date,
             'inv', (p.last_recruit at time zone 'America/Toronto')::date, 'rv', case when p.needs_review then true end))
           order by lower(coalesce(p.full_name, ''))), '[]'::jsonb))
    into v from p;
  return v;
end $$$m$,$m$comment on function public.wa191_recruit_pool(bigint[], int, int) is 'wave191e: Find volunteers. Every volunteer in the CRM (a volunteer record, the volunteer kind, or old-website history) with servings (Hub and old website, as the CRM counts), the last and first, the role done most, how often asked and how often they said no, when they signed up, liked (Excellent or Good on the Hub survey, or on the volunteer feedback form matched by the email they left), their rows on the chosen servings, their last texts, and their groups: never, lapsed (p_regular_min or more servings, none in p_lapsed_days), once, liked (unless they answered not at this time). Staff only.'$m$,$m$revoke all on function public.wa191_recruit_pool(bigint[], int, int) from public, anon$m$,$m$grant execute on function public.wa191_recruit_pool(bigint[], int, int) to authenticated$m$,$m$/* ---------- 4. inviting and texting ---------- */
create or replace function public.wa191_recruit_send(p_events bigint[], p_people jsonb, p_texts jsonb default '{}'::jsonb, p_dry boolean default true, p_text boolean default true)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_who text := coalesce(auth.jwt()->>'email', 'staff');
  v_can boolean; v_mode text; v_today date := (now() at time zone 'America/Toronto')::date; v_tmpl jsonb; v_events bigint[];
  v_link_base text; v_batch uuid := gen_random_uuid(); x jsonb; ev record; c record;
  v_cid bigint; v_pid bigint; v_name text; v_group text; v_role text; v_stats jsonb; v_served int; v_last date;
  v_rows bigint[]; v_dates date[]; v_evs bigint[]; v_tok text; v_rid bigint; v_st text; v_body text; v_why text; v_tmp text;
  n_people int := 0; n_added int := 0; n_kept int := 0; n_conf int := 0; n_no int := 0; n_q int := 0; n_nophone int := 0; n_out int := 0;
  n_held int := 0; n_recent int := 0; n_notext int := 0; n_new_people int := 0; v_prev jsonb := '[]'::jsonb; v_by_ev jsonb := '{}'::jsonb;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  v_can := coalesce(public.is_wa_admin(), false) or coalesce(public.is_wa_leader(), false) or coalesce(public.wa_is_hr(), false);
  if not p_dry and p_text and not v_can then raise exception 'Only leaders, HR and admins can text volunteers. Untick "Text them" to add them without a text.'; end if;
  select array_agg(e.id order by e.event_date, e.id) into v_events from public.volunteer_events e
   where e.id = any (coalesce(p_events, '{}')) and e.kind = 'service' and e.status not in ('cancelled', 'completed') and e.event_date >= v_today;
  if v_events is null then raise exception 'Pick at least one upcoming serving.'; end if;
  if p_people is null or jsonb_typeof(p_people) <> 'array' or jsonb_array_length(p_people) = 0 then raise exception 'Pick at least one person.'; end if;
  if jsonb_array_length(p_people) > 200 then raise exception 'At most 200 people at a time.'; end if;
  v_mode := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  v_tmpl := public.wa191_recruit_templates();
  if p_texts is not null and jsonb_typeof(p_texts) = 'object' then
    for v_tmp in select jsonb_object_keys(p_texts) loop
      if v_tmp in ('never', 'lapsed', 'once', 'liked', 'other') and jsonb_typeof(p_texts->v_tmp) = 'object' then
        if length(btrim(coalesce(p_texts->v_tmp->>'en', ''))) >= 20 then v_tmpl := jsonb_set(v_tmpl, array[v_tmp, 'en'], to_jsonb(left(p_texts->v_tmp->>'en', 600))); end if;
        if length(btrim(coalesce(p_texts->v_tmp->>'fr', ''))) >= 20 then v_tmpl := jsonb_set(v_tmpl, array[v_tmp, 'fr'], to_jsonb(left(p_texts->v_tmp->>'fr', 600))); end if;
      end if;
    end loop;
  end if;
  v_link_base := coalesce((select value from public.app_config where key = 'sms_link_base'), 'https://hub.welfareavenue.com/c/');

  for x in select value from jsonb_array_elements(p_people) loop
    v_cid := nullif(x->>'contact_id', '')::bigint; v_pid := nullif(x->>'person_id', '')::bigint; v_why := null;
    select cc.id, cc.volunteer_id, coalesce(nullif(btrim(cc.full_name), ''), '(no name)') full_name,
           coalesce(nullif(btrim(cc.first_name), ''), nullif(split_part(btrim(coalesce(cc.full_name, '')), ' ', 1), '')) first_name,
           lower(coalesce(cc.language, '')) like 'fr%' fr,
           (select public.wa171_digits(y) from unnest(cc.phones) y where public.wa171_digits(y) is not null limit 1) phone
      into c from public.crm_contacts cc
     where cc.merged_into is null and ((v_pid is not null and cc.volunteer_id = v_pid) or (v_pid is null and v_cid is not null and cc.id = v_cid))
     order by cc.id limit 1;
    if c.id is null then continue; end if;
    n_people := n_people + 1; v_pid := c.volunteer_id; v_name := c.full_name;
    v_group := case when x->>'group' in ('never', 'lapsed', 'once', 'liked', 'other') then x->>'group' else 'other' end;
    v_stats := public.wa191_person_served(c.id, v_pid);
    v_served := coalesce((v_stats->>'served')::int, 0); v_last := (v_stats->>'last_on')::date;
    v_role := lower(coalesce(nullif(x->>'role', ''), v_stats->>'top_role', 'server'));
    if not exists (select 1 from public.volunteer_role_guides g where g.role = v_role) then v_role := 'server'; end if;

    -- a CRM contact with no volunteer record gets one, linked to their contact (never a second contact)
    if v_pid is null and not p_dry then
      v_pid := nextval('public.volunteer_people_id_seq');
      insert into public.volunteer_profiles (id, roles, needs_review, created_at, joined_note) values (v_pid, '{}', false, now(), 'Invited from Find volunteers (wave191e) by ' || v_who);
      update public.crm_contacts set volunteer_id = v_pid, kinds = case when 'volunteer' = any (kinds) then kinds else kinds || array['volunteer'] end, updated_by = v_who, updated_at = now()
       where id = c.id and volunteer_id is null;
      n_new_people := n_new_people + 1;
    end if;

    -- their rows on the servings: kept when waiting, left alone when confirmed or when they said no, added otherwise
    v_rows := '{}'; v_dates := '{}'; v_evs := '{}'; v_tok := null;
    for ev in select e.id, e.event_date from public.volunteer_events e where e.id = any (v_events) order by e.event_date, e.id loop
      v_rid := null; v_st := null;
      if v_pid is not null then
        select r.id, lower(coalesce(r.status, '')) || case when r.confirm_status is not null then ':' || r.confirm_status else '' end into v_rid, v_st
          from public.event_roster r where r.event_id = ev.id and r.person_id = v_pid and lower(coalesce(r.status, '')) <> 'cancelled' order by r.id limit 1;
      end if;
      if v_rid is not null and (v_st like 'confirmed%' or v_st like '%:confirmed') then n_conf := n_conf + 1; continue; end if;
      if v_rid is not null and (v_st like 'unavailable%' or v_st like '%:declined') then n_no := n_no + 1; continue; end if;
      if v_rid is not null then n_kept := n_kept + 1;
      elsif not p_dry then
        insert into public.event_roster (event_id, person_id, person_name, role, status, detail, sort)
        values (ev.id, v_pid, v_name, v_role, 'Waiting For Response',
                jsonb_strip_nulls(jsonb_build_object('source', 'recruit', 'group', v_group, 'by', v_who, 'at', now(),
                  'phone', case when c.phone is not null then '(' || substr(c.phone, 1, 3) || ') ' || substr(c.phone, 4, 3) || '-' || substr(c.phone, 7, 4) end)), 900)
        returning id into v_rid;
        n_added := n_added + 1;
        v_by_ev := jsonb_set(v_by_ev, array[ev.id::text], to_jsonb(coalesce((v_by_ev->>ev.id::text)::int, 0) + 1));
      else n_added := n_added + 1; end if;
      v_rows := v_rows || v_rid; v_dates := v_dates || ev.event_date; v_evs := v_evs || ev.id;
    end loop;
    if cardinality(v_dates) = 0 then
      v_prev := v_prev || jsonb_build_array(jsonb_build_object('n', v_name, 'g', v_group, 'why', 'already answered for these servings'));
      continue;
    end if;
    if v_rows[1] is not null then
      select r.confirm_token into v_tok from public.event_roster r where r.id = v_rows[1];
      if v_tok is null and not p_dry then
        v_tok := substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 20);
        update public.event_roster set confirm_token = v_tok where id = v_rows[1];
      end if;
    end if;

    -- the text
    v_body := public.wa191_recruit_render(v_tmpl->v_group->>(case when c.fr then 'fr' else 'en' end), c.fr, c.first_name, v_dates, v_served, v_last, v_role,
                                          v_link_base || coalesce(v_tok, 'PREVIEW'));
    if not p_text then v_why := 'added, no text'; n_notext := n_notext + 1;
    elsif c.phone is null then v_why := 'no phone number'; n_nophone := n_nophone + 1;
    elsif public.wa171_opted_out(v_pid, c.phone) then v_why := 'stopped texts (STOP)'; n_out := n_out + 1;
    elsif v_mode not in ('test', 'live') then v_why := 'texts are off'; n_held := n_held + 1;
    elsif v_mode = 'test' and not public.wa171_test_phone(c.phone) then v_why := 'test mode: only the test phone gets texts'; n_held := n_held + 1;
    elsif exists (select 1 from public.quo_messages q where q.direction = 'out' and q.kind = 'recruit' and q.status in ('queued', 'sent') and q.created_at > now() - interval '3 days'
                  and (q.person_id = v_pid or right(regexp_replace(q.phone, '\D', '', 'g'), 10) = c.phone)) then
      v_why := 'invited in the last 3 days'; n_recent := n_recent + 1;
    else
      if not p_dry then
        insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id)
        values (v_batch, v_pid, '+1' || c.phone, v_body, 'queued', v_evs[1], v_who, 'out', 'recruit', v_rows[1]);
      end if;
      n_q := n_q + 1;
    end if;
    if p_dry and jsonb_array_length(v_prev) < 60 then
      v_prev := v_prev || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('n', v_name, 'g', v_group, 'fr', case when c.fr then true end, 'text', v_body, 'why', v_why,
                 'dates', to_jsonb(v_dates), 'chars', length(v_body))));
    end if;
  end loop;

  if not p_dry then
    for ev in select e.id, e.code from public.volunteer_events e where e.id = any (v_events) loop
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('volunteer_event', ev.id::text, 'recruit', null,
              coalesce((v_by_ev->>ev.id::text)::int, 0) || ' added by Find volunteers; ' || n_q || ' invitation text' || case when n_q = 1 then '' else 's' end || ' queued (batch ' || v_batch || ', ' || n_people || ' people, ' || array_length(v_events, 1) || ' serving' || case when array_length(v_events, 1) = 1 then '' else 's' end || ')', v_who);
    end loop;
    if n_q > 0 and public.wa191_sms_window() then perform public.call_edge('quo-send', '{"action":"drain"}'::jsonb); end if;
    perform public.wa191_autotick(e) from unnest(v_events) e;
  end if;
  return jsonb_build_object('dry', p_dry, 'people', n_people, 'added', n_added, 'kept', n_kept, 'already_confirmed', n_conf, 'said_no', n_no,
    'texts', n_q, 'no_phone', n_nophone, 'opted_out', n_out, 'held', n_held, 'invited_recently', n_recent, 'not_texted', n_notext, 'new_records', n_new_people,
    'mode', v_mode, 'sends_now', public.wa191_sms_window(), 'batch', case when not p_dry then v_batch end, 'previews', v_prev);
end $$$m$,$m$comment on function public.wa191_recruit_send(bigint[], jsonb, jsonb, boolean, boolean) is 'wave191e: Find volunteers. p_people [{person_id|contact_id, group, role}] are invited to the upcoming servings p_events: a row Waiting For Response (detail.source recruit) where they have none (a CRM contact without a volunteer record gets one), rows they already answered left alone; one personal text each (quo_messages kind recruit, the group''s wording from p_texts or recruit_templates in their language, their link) unless p_text is false. sms_mode, STOP and a 3-day gap between invitations decide who is texted; quo-send sends between 9 am and 7 pm. p_dry: previews only (staff). Adding: staff; texting: leaders, HR and admins. Logged per serving.'$m$,$m$revoke all on function public.wa191_recruit_send(bigint[], jsonb, jsonb, boolean, boolean) from public, anon$m$,$m$grant execute on function public.wa191_recruit_send(bigint[], jsonb, jsonb, boolean, boolean) to authenticated$m$,$m$/* ---------- 5. conversations ---------- */
create or replace function public.wa191_recruit_inbox(p_events bigint[] default null, p_days int default 21) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare v jsonb;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  with m as (
    select right(regexp_replace(q.phone, '\D', '', 'g'), 10) ph, q.*
      from public.quo_messages q
     where q.created_at > now() - make_interval(days => greatest(coalesce(p_days, 21), 1)) and q.status <> 'dry_run' and q.kind <> 'confirm_test'
  ), ppl as (
    select m.ph, max(m.person_id) pid from m group by m.ph
  ), last_m as (
    select distinct on (m.ph) m.ph, m.direction, m.body, m.created_at, m.handled, m.kind, m.status from m order by m.ph, m.created_at desc, m.id desc
  ), agg as (
    select m.ph, count(*) n, count(*) filter (where m.direction = 'in') n_in, array_agg(distinct m.event_id) filter (where m.event_id is not null) evs from m group by m.ph
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'ph', l.ph, 'phf', '(' || substr(l.ph, 1, 3) || ') ' || substr(l.ph, 4, 3) || '-' || substr(l.ph, 7, 4),
           'p', ppl.pid, 'n', coalesce((select vp.full_name from public.volunteer_people vp where vp.id = ppl.pid), (select cc.full_name from public.crm_contacts cc where cc.merged_into is null and exists (select 1 from unnest(cc.phones) y where public.wa171_digits(y) = l.ph) order by cc.id limit 1)),
           'at', l.created_at, 'dir', l.direction, 'last', left(l.body, 160), 'kind', l.kind, 'st', l.status, 'h', l.handled,
           'wait', case when l.direction = 'in' and coalesce(l.handled, '') not in ('confirmed', 'declined', 'opted_out', 'opted_in', 'duplicate', 'ignored') then true end,
           'cnt', a.n, 'cin', a.n_in, 'evs', to_jsonb(a.evs))) order by l.created_at desc), '[]'::jsonb)
    into v
    from last_m l join agg a on a.ph = l.ph join ppl on ppl.ph = l.ph
   where l.ph is not null and length(l.ph) = 10
     and (p_events is null or a.evs && p_events
          or exists (select 1 from public.event_roster r where r.event_id = any (p_events) and r.person_id = ppl.pid));
  return v;
end $$$m$,$m$comment on function public.wa191_recruit_inbox(bigint[], int) is 'wave191e: the conversations on the ops line in the last p_days days, one per phone number: the person, the last text, how many, and wait (their text is the last and the Hub did not answer it by itself). With p_events, the numbers texted about those servings or of people on their rosters. Staff only.'$m$,$m$revoke all on function public.wa191_recruit_inbox(bigint[], int) from public, anon$m$,$m$grant execute on function public.wa191_recruit_inbox(bigint[], int) to authenticated$m$,$m$create or replace function public.wa191_recruit_thread(p_phone text) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare v_ph text := public.wa171_digits(p_phone); v jsonb; v_pid bigint;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  if v_ph is null then raise exception 'Which number?'; end if;
  select vp.id into v_pid from public.volunteer_people vp where exists (select 1 from unnest(vp.phones) y where public.wa171_digits(y) = v_ph) order by vp.id limit 1;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', q.id, 'dir', q.direction, 'kind', q.kind, 'st', q.status, 'body', q.body, 'at', q.created_at, 'sent', q.sent_at,
           'h', q.handled, 'by', case when q.direction = 'out' and q.sent_by not in ('automation', 'quo-events', 'system') then q.sent_by end, 'qid', q.quo_id, 'err', left(q.error, 160),
           'ev', (select e.code from public.volunteer_events e where e.id = q.event_id))) order by q.created_at, q.id), '[]'::jsonb)
    into v
    from (select * from public.quo_messages q2 where right(regexp_replace(q2.phone, '\D', '', 'g'), 10) = v_ph and q2.status <> 'dry_run' and q2.kind <> 'confirm_test'
          order by q2.created_at desc, q2.id desc limit 150) q;
  return jsonb_build_object('ph', v_ph, 'p', v_pid,
    'n', (select vp.full_name from public.volunteer_people vp where vp.id = v_pid),
    'out', public.wa171_opted_out(v_pid, v_ph), 'window_open', public.wa191_sms_window(), 'messages', v);
end $$$m$,$m$comment on function public.wa191_recruit_thread(text) is 'wave191e: one number''s texts with the ops line as the Hub has them (the last 150, oldest first), the person, whether they stopped texts and whether a reply would go now. Staff only. quo-send v5 thread adds what was typed in the Quo app.'$m$,$m$revoke all on function public.wa191_recruit_thread(text) from public, anon$m$,$m$grant execute on function public.wa191_recruit_thread(text) to authenticated$m$,$m$create or replace function public.wa191_text_reply(p_phone text, p_body text) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare v_ph text := public.wa171_digits(p_phone); v_body text := btrim(coalesce(p_body, '')); v_pid bigint; v_row record; v_id bigint; v_who text := coalesce(auth.jwt()->>'email', 'staff'); v_now boolean;
begin
  if not (coalesce(public.is_wa_admin(), false) or coalesce(public.is_wa_leader(), false) or coalesce(public.wa_is_hr(), false)) then
    raise exception 'Only leaders, HR and admins can text volunteers.';
  end if;
  if v_ph is null then raise exception 'Which number?'; end if;
  if length(v_body) < 2 then raise exception 'Write the reply first.'; end if;
  if length(v_body) > 1000 then raise exception 'Keep it under 1,000 characters.'; end if;
  select vp.id into v_pid from public.volunteer_people vp where exists (select 1 from unnest(vp.phones) y where public.wa171_digits(y) = v_ph) order by vp.id limit 1;
  if public.wa171_opted_out(v_pid, v_ph) then raise exception 'They texted STOP, so the Hub cannot text them. They can text START to the ops line to get texts again.'; end if;
  -- the serving the conversation is about: their next one, if any
  select r.id, r.event_id into v_row from public.event_roster r join public.volunteer_events e on e.id = r.event_id
   where v_pid is not null and r.person_id = v_pid and e.kind = 'service' and e.status not in ('cancelled', 'completed') and e.event_date >= (now() at time zone 'America/Toronto')::date
     and lower(coalesce(r.status, '')) <> 'cancelled' order by e.event_date, r.id limit 1;
  insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id)
  values (gen_random_uuid(), v_pid, '+1' || v_ph, v_body, 'queued', v_row.event_id, v_who, 'out', 'reply', v_row.id)
  returning id into v_id;
  -- an answered question is no longer waiting
  update public.quo_messages set handled = 'answered' where direction = 'in' and right(regexp_replace(phone, '\D', '', 'g'), 10) = v_ph and coalesce(handled, '') in ('question', 'unmatched', 'stored');
  v_now := public.wa191_sms_window();
  if v_now then perform public.call_edge('quo-send', '{"action":"drain"}'::jsonb); end if;
  return jsonb_build_object('id', v_id, 'sends_now', v_now);
end $$$m$,$m$comment on function public.wa191_text_reply(text, text) is 'wave191e: a reply typed in the Hub''s conversations, from the ops line through Quo (quo_messages kind reply): now between 9 am and 7 pm, otherwise at 9 am. Not to someone who texted STOP. Their open question counts as answered. Leaders, HR and admins; sms_mode does not hold a person''s own reply (as with Text volunteers).'$m$,$m$revoke all on function public.wa191_text_reply(text, text) from public, anon$m$,$m$grant execute on function public.wa191_text_reply(text, text) to authenticated$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
