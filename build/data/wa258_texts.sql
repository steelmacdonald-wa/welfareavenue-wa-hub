-- wave258 (15/10/26): the volunteer texts made clear and reliable, after the operations meeting of 15/10/26.
-- Steel: "all of them should be able to text"; "confirmations ... a week and a half before the event"; "another check-in
-- ... the Thursday before"; "when they try to click confirm, they need to check a box saying they must cancel four days
-- before ... All the roles should say that in the confirmation text"; "they should be able to fill out information and
-- have reviewed different documents ... the cooks should have been able to choose their recipe before then".
-- The meeting: a Monday-of reminder ("you are confirmed ... let us know four days in advance"), Ibrahim checks the texts
-- went (logs), "From the old sheet" rows checked by their owners, Mary owns cooks, drivers and team leaders, Terry owns
-- servers, the dishwasher and the photographer.

-- 1. settings
insert into public.app_config (key, value, updated_at) values
  ('text_staff', 'ibrahim.saoud@welfareavenue.com,marydilusha.celestine@welfareavenue.com,eleftherios.katsipis@welfareavenue.com', now()),
  ('texts_notify', 'ibrahim.saoud@welfareavenue.com,marydilusha.celestine@welfareavenue.com,eleftherios.katsipis@welfareavenue.com', now()),
  ('cancel_notice_days', '4', now()),
  ('sms_reminder_on', 'on', now()), ('sms_reminder_days', '6', now()),
  ('sms_checkin_on', 'on', now()), ('sms_checkin_days', '3', now()),
  ('volunteer_role_owners', '{"cook":"marydilusha.celestine@welfareavenue.com","driver":"marydilusha.celestine@welfareavenue.com","team_leader":"marydilusha.celestine@welfareavenue.com","server":"eleftherios.katsipis@welfareavenue.com","dishwasher":"eleftherios.katsipis@welfareavenue.com","photographer":"eleftherios.katsipis@welfareavenue.com","videographer":"eleftherios.katsipis@welfareavenue.com"}', now())
on conflict (key) do nothing;
-- confirmations about a week and a half before: 10 days before a Sunday is the Thursday before the week before (Nov 1: Thursday Oct 22, 10 am)
update public.app_config set value = '10', updated_at = now() where key = 'sms_confirm_days' and value <> '10';

-- 2. who may text: leaders, HR, admins, and the people app_config text_staff names (Ibrahim, Mary, Terry)
create or replace function public.wa256_can_text() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.is_wa_admin(), false) or coalesce(public.is_wa_leader(), false) or coalesce(public.wa_is_hr(), false)
      or lower(coalesce(auth.jwt()->>'email', '')) = any (string_to_array(replace(lower(coalesce((select value from public.app_config where key = 'text_staff'), '')), ' ', ''), ','))
$$;
comment on function public.wa256_can_text() is 'wave256, wave258: may the signed-in person text volunteers from the Hub (Text to confirm, replies, Find volunteers, Still in?, itineraries, Assign to servings): leaders, HR, admins, and the emails in app_config text_staff (wave258: Ibrahim, Mary, Terry). Every texting function asks it; quo-send v7 too.';

do $do$
declare f text; d text; n int;
  old1 text := 'coalesce(public.is_wa_admin(), false) or coalesce(public.is_wa_leader(), false) or coalesce(public.wa_is_hr(), false)';
  old2 text := 'public.is_wa_admin() or public.is_wa_leader() or public.wa_is_hr()';
begin
  foreach f in array array['wa171_text_to_confirm', 'wa191_recruit_send', 'wa191_text_done', 'wa191_text_reply', 'wa239_pool_send', 'wa182_staff_can_send'] loop
    select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = f;
    if d is null then raise exception 'wave258: % is missing', f; end if;
    if position('wa256_can_text' in d) > 0 then continue; end if;
    n := (length(d) - length(replace(d, old1, ''))) / length(old1) + (length(d) - length(replace(d, old2, ''))) / length(old2);
    if n <> 1 then raise exception 'wave258: % has % permission checks, expected 1', f, n; end if;
    d := replace(replace(d, old1, 'public.wa256_can_text()'), old2, 'public.wa256_can_text()');
    execute d;
  end loop;
end $do$;

-- 3. the texts table: two new automatic kinds (reminder, checkin) and what Quo says happened to each text
alter table public.quo_messages drop constraint if exists quo_messages_kind_check;
alter table public.quo_messages add constraint quo_messages_kind_check check (kind = any (array['manual', 'confirm', 'confirm_test', 'inbound', 'ack', 'signup', 'survey', 'itinerary', 'recruit', 'reply', 'reconfirm', 'reminder', 'checkin']));
alter table public.quo_messages add column if not exists delivery text;
alter table public.quo_messages add column if not exists delivery_at timestamptz;
comment on column public.quo_messages.delivery is 'wave258: what Quo says happened to a text the Hub sent (queued, sent, delivered, undelivered, failed), checked by quo-send v7 action delivery after it goes.';
comment on column public.quo_messages.delivery_at is 'wave258: when quo-send last read the delivery status from Quo.';
create unique index if not exists quo_messages_reminder_once on public.quo_messages (roster_id) where direction = 'out' and kind = 'reminder' and status in ('queued', 'sent');
create unique index if not exists quo_messages_checkin_once on public.quo_messages (roster_id) where direction = 'out' and kind = 'checkin' and status in ('queued', 'sent');

-- 4. the 4-day rule
create or replace function public.wa258_notice_days() returns int
language sql stable security definer set search_path = '' as $$
  select greatest(0, coalesce(nullif((select value from public.app_config where key = 'cancel_notice_days'), '')::int, 4))
$$;
comment on function public.wa258_notice_days() is 'wave258: how many days before a serving a volunteer must tell us they cannot come (app_config cancel_notice_days, 4). Internal.';

-- what a role still has to fill in before confirming on their page
create or replace function public.wa258_needs(p_roster bigint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r record; v jsonb := '[]'::jsonb; v_car text;
begin
  select er.role, er.recipe_id, er.confirm, er.person_id into r from public.event_roster er where er.id = p_roster;
  if not found then return v; end if;
  if lower(r.role) = 'cook' then
    if r.recipe_id is null and exists (select 1 from public.recipes x where x.active and x.name !~* 'all recipes') then v := v || '["recipe"]'::jsonb; end if;
    if coalesce(r.confirm->>'cook_location', '') = '' then v := v || '["pickup"]'::jsonb; end if;
  elsif lower(r.role) = 'driver' then
    select nullif(trim(car_type), '') into v_car from public.volunteer_people where id = r.person_id;
    if v_car is null and coalesce(r.confirm->>'vehicle', '') = '' then v := v || '["car"]'::jsonb; end if;
  elsif lower(r.role) = 'community_debrief' then
    if coalesce(r.confirm->>'briefed_at', '') = '' then v := v || '["briefing"]'::jsonb; end if;
  end if;
  return v;
end $$;
comment on function public.wa258_needs(bigint) is 'wave258: what a volunteer must fill in on their page before Confirm: a cook their dish and pick-up or drop-off, a driver their car (when none is on file), a Community lead the briefing. Internal (volunteer_confirm_get, volunteer_confirm_submit).';

-- 5. the confirmation text: every role carries the 4-day rule; a cook is asked for the dish and pick-up or drop-off
create or replace function public.wa171_confirm_text(p_roster bigint, p_test boolean default false) returns text
language plpgsql stable security definer set search_path = '' as $$
declare r record; v_lang text; v_first text; v_role text; v_day text; v_link text; v_art text; v_album text; v_by text; v_n int := public.wa258_notice_days();
begin
  select er.id, er.person_id, er.person_name, er.role, er.confirm_token, e.event_date into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.id = p_roster;
  if not found or r.confirm_token is null then return null; end if;
  v_lang := public.wa171_lang(r.person_id);
  if lower(r.role) in ('photographer', 'videographer') then   -- wave240: the serving's own album
    select nullif(btrim(e.photos_album_url), '') into v_album from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.id = p_roster;
  end if;
  v_first := coalesce(nullif(split_part(trim(coalesce(r.person_name, '')), ' ', 1), ''), case when v_lang = 'fr' then 'bonjour' else 'there' end);
  v_role := lower(public.wa171_role_label(r.role, v_lang));
  v_day := public.wa171_date_words(r.event_date, v_lang);
  v_by := public.wa171_date_words(r.event_date - v_n, v_lang);
  v_link := coalesce((select value from public.app_config where key = 'sms_link_base'), 'https://hub.welfareavenue.com/c/') || r.confirm_token || case when p_test then '?test=1' else '' end;
  if v_lang = 'fr' then
    return 'Bonjour ' || v_first || ', ici Welfare Avenue! Vous êtes sur la liste comme ' || v_role || ' pour notre service du ' || v_day
      || case when lower(r.role) = 'community_debrief' then '. Lisez vos consignes de responsable et confirmez ici : '
              when lower(r.role) = 'cook' then '. Choisissez votre plat et le ramassage ou le dépôt, puis confirmez ici : '
              else '. Confirmez ici : ' end || v_link || ' (ou répondez OUI ou NON).'
      || ' Si vous ne pouvez pas venir, prévenez-nous au moins ' || v_n || ' jours avant (d''ici le ' || v_by || ') : chaque rôle compte.'
      || ' Répondez ARRET pour ne plus recevoir de textos.' || case when v_album is not null then ' Album pour vos photos : ' || v_album else '' end;
  end if;
  v_art := case when v_role ~ '^[aeiou]' then 'an ' else 'a ' end;
  return 'Hi ' || v_first || ', it''s Welfare Avenue! You''re on the list as ' || v_art || v_role || ' for our serving on ' || v_day
    || case when lower(r.role) = 'community_debrief' then '. Please read your Community lead briefing and confirm here: '
            when lower(r.role) = 'cook' then '. Choose your dish and pick-up or drop-off, then confirm here: '
            else '. Please confirm here: ' end || v_link || ' (or reply YES or NO).'
    || ' If you can''t make it, please tell us at least ' || v_n || ' days before (by ' || v_by || '): every role counts.'
    || ' Reply STOP to stop texts.' || case when v_album is not null then ' Album for your photos: ' || v_album else '' end;
end $$;
comment on function public.wa171_confirm_text(bigint, boolean) is 'wave171, wave240, wave258: the confirmation text for one roster row (English or French): the role, the date, the personal link (a cook is asked for the dish and pick-up or drop-off, a Community lead to read the briefing), YES or NO, and (wave258) the rule for every role: tell us at least 4 days before (app_config cancel_notice_days) if you cannot come, with that date. Internal.';

-- the assignment text (wave257) carries the rule too
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.wa257_text(bigint, bigint[])'::regprocedure);
  if position('wa258_notice_days' in d) = 0 then
    d := replace(d, $a$|| case when v_n = 1 then ' (ou répondez OUI ou NON)' else '' end || '. Répondez STOP pour ne plus recevoir de textos.';$a$,
                    $a$|| case when v_n = 1 then ' (ou répondez OUI ou NON)' else '' end || '. Si vous ne pouvez pas venir, prévenez-nous au moins ' || public.wa258_notice_days() || ' jours avant chaque service. Répondez STOP pour ne plus recevoir de textos.';$a$);
    d := replace(d, $a$|| case when v_n = 1 then ' (or reply YES or NO)' else '' end || '. Reply STOP to stop texts.';$a$,
                    $a$|| case when v_n = 1 then ' (or reply YES or NO)' else '' end || '. If you can''t make it, please tell us at least ' || public.wa258_notice_days() || ' days before each serving. Reply STOP to stop texts.';$a$);
    if (length(d) - length(replace(d, 'wa258_notice_days', ''))) / length('wa258_notice_days') <> 2 then raise exception 'wave258: wa257_text changed'; end if;
    execute d;
  end if;
end $do$;

-- 6. the Monday reminder and the Thursday check-in
create or replace function public.wa258_nudge_text(p_roster bigint, p_kind text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare r record; v_lang text; v_first text; v_role text; v_day text; v_by text; v_link text; v_conf boolean; v_art text;
begin
  select er.id, er.person_id, er.person_name, er.role, er.status, er.confirm_status, er.confirm_token, e.event_date into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.id = p_roster;
  if not found or r.confirm_token is null then return null; end if;
  v_conf := lower(coalesce(r.status, '')) = 'confirmed' or r.confirm_status = 'confirmed';
  v_lang := public.wa171_lang(r.person_id);
  v_first := coalesce(nullif(split_part(trim(coalesce(r.person_name, '')), ' ', 1), ''), case when v_lang = 'fr' then 'bonjour' else 'there' end);
  v_role := lower(public.wa171_role_label(r.role, v_lang));
  v_day := public.wa171_date_words(r.event_date, v_lang);
  v_by := public.wa171_date_words(r.event_date - public.wa258_notice_days(), v_lang);
  v_link := coalesce((select value from public.app_config where key = 'sms_link_base'), 'https://hub.welfareavenue.com/c/') || r.confirm_token;
  v_art := case when v_role ~ '^[aeiou]' then 'an ' else 'a ' end;
  if v_lang = 'fr' then
    if p_kind = 'reminder' and v_conf then
      return 'Bonjour ' || v_first || ', un petit rappel de Welfare Avenue : vous êtes confirmé(e) comme ' || v_role || ' le ' || v_day || '. Merci! Si quelque chose change, prévenez-nous d''ici le ' || v_by || ' (' || public.wa258_notice_days() || ' jours avant). Vos détails : ' || v_link || '. Répondez ARRET pour ne plus recevoir de textos.';
    elsif p_kind = 'reminder' then
      return 'Bonjour ' || v_first || ', ici Welfare Avenue. Il nous manque votre réponse pour le ' || v_day || ' (' || v_role || ') : ' || v_link || ' (ou répondez OUI ou NON). Merci de répondre d''ici le ' || v_by || '. Répondez ARRET pour ne plus recevoir de textos.';
    elsif v_conf then
      return 'Bonjour ' || v_first || ', à ' || v_day || '! Vous êtes notre ' || v_role || '. L''heure, le lieu et vos détails : ' || v_link || '. Un imprévu? Appelez-nous ou écrivez-nous tout de suite au (438) 808-7754. Répondez ARRET pour ne plus recevoir de textos.';
    else
      return 'Bonjour ' || v_first || ', ici Welfare Avenue. Nous n''avons pas eu votre réponse pour le ' || v_day || ' (' || v_role || '). Pouvez-vous toujours venir? Répondez OUI ou NON aujourd''hui, ou ici : ' || v_link || '. Répondez ARRET pour ne plus recevoir de textos.';
    end if;
  end if;
  if p_kind = 'reminder' and v_conf then
    return 'Hi ' || v_first || ', a reminder from Welfare Avenue: you''re confirmed as ' || v_art || v_role || ' on ' || v_day || '. Thank you! If anything changes, please tell us by ' || v_by || ' (' || public.wa258_notice_days() || ' days before). Your details: ' || v_link || '. Reply STOP to stop texts.';
  elsif p_kind = 'reminder' then
    return 'Hi ' || v_first || ', it''s Welfare Avenue. We still need your answer for ' || v_day || ' (' || v_role || '): ' || v_link || ' (or reply YES or NO). Please answer by ' || v_by || '. Reply STOP to stop texts.';
  elsif v_conf then
    return 'Hi ' || v_first || ', see you ' || v_day || '! You''re our ' || v_role || '. Your time, place and details: ' || v_link || '. If something came up, call or text us right away at (438) 808-7754. Reply STOP to stop texts.';
  end if;
  return 'Hi ' || v_first || ', it''s Welfare Avenue. We haven''t heard back about ' || v_day || ' (' || v_role || '). Can you still come? Reply YES or NO today, or answer here: ' || v_link || '. Reply STOP to stop texts.';
end $$;
comment on function public.wa258_nudge_text(bigint, text) is 'wave258: the Monday reminder (kind reminder: confirmed "you are confirmed, tell us by Wednesday if anything changes"; not answered "we still need your answer by Wednesday") and the Thursday check-in (kind checkin: confirmed "see you Sunday, your details, call us if something came up"; not answered "can you still come? reply today"), English or French. Internal.';

create or replace function public.wa258_queue_nudges(p_event bigint default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_mode text; v_hour int; v_now timestamp; v_today date; k text; v_days int; r record; v_phone text; v_body text;
        res jsonb := '{}'::jsonb; n_q int; n_skip int;
begin
  v_mode := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  if v_mode not in ('test', 'live') then return jsonb_build_object('queued', 0, 'mode', v_mode); end if;
  v_hour := coalesce(nullif((select value from public.app_config where key = 'sms_confirm_hour'), '')::int, 10);
  v_now := now() at time zone 'America/Toronto'; v_today := v_now::date;
  foreach k in array array['reminder', 'checkin'] loop
    n_q := 0; n_skip := 0;
    if coalesce((select value from public.app_config where key = 'sms_' || k || '_on'), 'on') <> 'on' then res := res || jsonb_build_object(k, 'off'); continue; end if;
    v_days := coalesce(nullif((select value from public.app_config where key = 'sms_' || k || '_days'), '')::int, case when k = 'reminder' then 6 else 3 end);
    if p_event is null and extract(hour from v_now) < v_hour then res := res || jsonb_build_object(k, 'not the hour'); continue; end if;
    for r in
      select er.id, er.person_id, er.confirm_token, e.id as event_id
        from public.event_roster er join public.volunteer_events e on e.id = er.event_id
       where e.kind = 'service' and e.status not in ('cancelled', 'completed')
         and (case when p_event is null then e.event_date - v_today = v_days else e.id = p_event and e.event_date > v_today end)
         and lower(coalesce(er.status, '')) not in ('unavailable', 'cancelled') and coalesce(er.confirm_status, '') <> 'declined'
         and coalesce(er.detail->>'partner', '') <> 'true' and er.confirm_token is not null
         and not (lower(coalesce(er.role, '')) = 'volunteer' and er.detail ? 'role_choices')
         and (lower(coalesce(er.status, '')) = 'confirmed' or er.confirm_status = 'confirmed'
              or exists (select 1 from public.quo_messages q where q.roster_id = er.id and q.direction = 'out' and q.kind in ('confirm', 'signup', 'recruit') and q.status = 'sent'))
         and not exists (select 1 from public.quo_messages q where q.roster_id = er.id and q.direction = 'out' and q.kind = k and q.status in ('queued', 'sent'))
       order by e.event_date, er.id
    loop
      v_phone := public.wa171_roster_phone(r.id);
      if v_phone is null or public.wa171_opted_out(r.person_id, v_phone) or (v_mode = 'test' and not public.wa171_test_phone(v_phone)) then n_skip := n_skip + 1; continue; end if;
      v_body := public.wa258_nudge_text(r.id, k);
      if v_body is null then continue; end if;
      insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id)
      values (gen_random_uuid(), r.person_id, '+1' || v_phone, v_body, 'queued', r.event_id, 'automation', 'out', k, r.id)
      on conflict do nothing;
      if found then n_q := n_q + 1; end if;
    end loop;
    res := res || jsonb_build_object(k, jsonb_build_object('queued', n_q, 'skipped', n_skip, 'days_before', v_days));
  end loop;
  return res || jsonb_build_object('mode', v_mode);
end $$;
comment on function public.wa258_queue_nudges(bigint) is 'wave258: queues the Monday reminder (app_config sms_reminder_days, 6 days before) and the Thursday check-in (sms_checkin_days, 3 days before), from sms_confirm_hour (10 am), once each per roster row, to everyone confirmed or texted for that serving who has not said no (not partners, not people waiting for a role); sms_mode, STOP and test phones as for every automatic text; sms_reminder_on and sms_checkin_on switch them. Called by wa171_sms_tick. Internal.';

-- 7. a Hub notification (hub-push relay, kind volunteer_texts): never Slack, never email
create or replace function public.wa258_notify(p_to text[], p_title text, p_body text, p_url text, p_tag text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_to text[];
begin
  v_to := array(select distinct lower(trim(x)) from unnest(coalesce(p_to, '{}'::text[])) x where trim(coalesce(x, '')) like '%@%');
  if coalesce(array_length(v_to, 1), 0) = 0 then return; end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('notification', 'volunteer_texts', p_tag, array_to_string(v_to, ','), left(p_title || ': ' || p_body, 400), 'wave258');
  if coalesce((select value from public.app_config where key = 'push_on'), 'on') <> 'on' then return; end if;
  perform public.call_edge('hub-push', jsonb_build_object('event', 'relay', 'kind', 'volunteer_texts', 'to', to_jsonb(v_to), 'title', p_title, 'body', p_body, 'url', p_url, 'tag', p_tag));
exception when others then
  null;
end $$;
comment on function public.wa258_notify(text[], text, text, text, text) is 'wave258: a Hub notification about volunteer texts (hub-push relay, kind volunteer_texts, each person''s switch for it; no Slack, no email), logged in change_log. Internal.';

create or replace function public.wa258_texts_people() returns text[]
language sql stable security definer set search_path = '' as $$
  select array(select distinct x from unnest(string_to_array(replace(lower(coalesce((select value from public.app_config where key = 'texts_notify'), '')), ' ', ''), ',')) x where x like '%@%')
$$;
comment on function public.wa258_texts_people() is 'wave258: who hears when a round of volunteer texts goes out or someone cancels late (app_config texts_notify: Ibrahim, Mary, Terry). Internal.';

create or replace function public.wa258_role_owner(p_role text) returns text
language sql stable security definer set search_path = '' as $$
  select nullif(lower(trim((select value from public.app_config where key = 'volunteer_role_owners')::jsonb ->> lower(coalesce(p_role, '')))), '')
$$;
comment on function public.wa258_role_owner(text) is 'wave258: the email of the person who owns a volunteer role (app_config volunteer_role_owners: Mary cooks, drivers, team leaders; Terry servers, dishwasher, photographer). Internal.';

-- after each round went out: who got it, in one notification
create or replace function public.wa258_round_notices() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_today date := (now() at time zone 'America/Toronto')::date; x record; v_title text; v_body text; v_label text; n int := 0; v_fail text;
begin
  for x in
    select q.event_id, q.kind, e.event_date,
           count(*) filter (where q.status = 'sent') sent, count(*) filter (where q.status = 'failed') failed, count(*) filter (where q.status = 'skipped') skipped
      from public.quo_messages q join public.volunteer_events e on e.id = q.event_id
     where q.direction = 'out' and q.sent_by = 'automation' and q.kind in ('confirm', 'reminder', 'checkin')
       and (q.created_at at time zone 'America/Toronto')::date = v_today
     group by q.event_id, q.kind, e.event_date
    having count(*) filter (where q.status = 'queued') = 0
  loop
    if exists (select 1 from public.change_log c where c.entity_type = 'volunteer_event' and c.entity_id = x.event_id::text and c.field = 'texts_round_' || x.kind and c.new_value like v_today::text || '%') then continue; end if;
    v_label := case x.kind when 'confirm' then 'Confirmation texts' when 'reminder' then 'Monday reminders' else 'Thursday check-ins' end;
    select string_agg(split_part(coalesce(er.person_name, 'someone'), ' ', 1), ', ') into v_fail
      from public.quo_messages q left join public.event_roster er on er.id = q.roster_id
     where q.event_id = x.event_id and q.kind = x.kind and q.status = 'failed' and (q.created_at at time zone 'America/Toronto')::date = v_today;
    v_title := v_label || ' went out for ' || to_char(x.event_date, 'Dy Mon FMDD');
    v_body := x.sent || ' sent' || case when x.failed > 0 then ', ' || x.failed || ' failed (' || coalesce(v_fail, '') || ')' else '' end
              || case when x.skipped > 0 then ', ' || x.skipped || ' skipped' else '' end || '. Open the serving''s Text log to see who got it and who confirmed.';
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('volunteer_event', x.event_id::text, 'texts_round_' || x.kind, null, v_today::text || ' ' || v_body, 'wave258');
    perform public.wa258_notify(public.wa258_texts_people(), v_title, v_body, '/#volunteering/e/' || x.event_id, 'texts-' || x.kind || '-' || x.event_id);
    n := n + 1;
  end loop;
  return jsonb_build_object('notices', n);
end $$;
comment on function public.wa258_round_notices() is 'wave258: once a day''s automatic round (confirmations, Monday reminders, Thursday check-ins) for a serving has left the queue, one Hub notification to app_config texts_notify (Ibrahim, Mary, Terry): how many went, failed (who) or were skipped, and a link to the serving. Called by wa171_sms_tick. Internal.';

-- 8. the quarter-hour tick: the two new rounds, the notices, and Quo's delivery status
create or replace function public.wa171_sms_tick() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_mode text; res jsonb := '{}'::jsonb;
begin
  v_mode := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  -- wave191e: nothing goes outside 9 am to 7 pm; what is queued waits for the first tick inside it
  if not public.wa191_sms_window() then return jsonb_build_object('mode', v_mode, 'reason', 'outside 9 am to 7 pm'); end if;
  if v_mode in ('test', 'live') then
    res := jsonb_build_object('confirm', public.wa171_queue_confirms(null, null, 'automation'), 'signup', public.wa172_queue_signups(), 'survey', public.wa172_queue_surveys(),
                              'itinerary', public.wa174_queue_itineraries(), 'nudges', public.wa258_queue_nudges(null));   -- wave258
  end if;
  if exists (select 1 from public.quo_messages where status = 'queued' and direction = 'out') then
    perform public.call_edge('quo-send', '{"action":"drain"}'::jsonb);
    res := res || jsonb_build_object('drain', true);
  end if;
  -- wave258: the notice after a round, and what Quo says happened to the texts of the last two days
  begin res := res || jsonb_build_object('notices', public.wa258_round_notices()); exception when others then null; end;
  if exists (select 1 from public.quo_messages where direction = 'out' and status = 'sent' and quo_id is not null and sent_at > now() - interval '2 days'
               and sent_at < now() - interval '2 minutes' and coalesce(delivery, '') not in ('delivered', 'undelivered', 'failed', 'unknown')
               and (delivery_at is null or delivery_at < now() - interval '25 minutes')) then
    perform public.call_edge('quo-send', '{"action":"delivery"}'::jsonb);
    res := res || jsonb_build_object('delivery', true);
  end if;
  return res || jsonb_build_object('mode', v_mode);
end $$;
comment on function public.wa171_sms_tick() is 'wave171, wave191e, wave258: the quarter-hour text tick (cron wa-sms-tick), 9 am to 7 pm only: queues the confirmations (10 days before), sign-up notices, surveys, itineraries, and (wave258) the Monday reminders and Thursday check-ins; drains the queue through quo-send; then the round notices and the delivery check (quo-send delivery).';

-- 9. the volunteer's page: Confirm opens as soon as their confirmation text went; the rule, the date and what is missing
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.volunteer_confirm_get(text, boolean)'::regprocedure);
  if position('wa258_needs' in d) = 0 then
    d := replace(d, $a$and coalesce(r.detail->>'confirm_early', '') <> 'true' then 'early'$a$,
                    $a$and coalesce(r.detail->>'confirm_early', '') <> 'true' and not exists (select 1 from public.quo_messages q where q.roster_id = r.id and q.direction = 'out' and q.kind = 'confirm' and q.status in ('queued', 'sent')) then 'early'$a$);
    d := replace(d, $a$and coalesce(o.detail->>'confirm_early', '') <> 'true' then 'early'$a$,
                    $a$and coalesce(o.detail->>'confirm_early', '') <> 'true' and not exists (select 1 from public.quo_messages q where q.roster_id = o.id and q.direction = 'out' and q.kind = 'confirm' and q.status in ('queued', 'sent')) then 'early'$a$);
    d := replace(d, $a$'photo', v_photo, 'look', public.wa182_look(r.event_id),$a$,
                    $a$'photo', v_photo, 'look', public.wa182_look(r.event_id),
    'cancel_days', public.wa258_notice_days(), 'cancel_by', r.event_date - public.wa258_notice_days(), 'late', r.event_date - v_today < public.wa258_notice_days(),
    'needs', public.wa258_needs(r.id), 'rule_ok', coalesce(r.confirm->>'cancel_rule_ok', '') = 'true',$a$);
    if (length(d) - length(replace(d, 'kind = ''confirm'' and q.status', ''))) / length('kind = ''confirm'' and q.status') <> 2 or position('wa258_needs' in d) = 0 then
      raise exception 'wave258: volunteer_confirm_get changed';
    end if;
    execute d;
  end if;
end $do$;

-- Confirm on the page needs the box ticked and the role's details; a late "can't make it" tells the role's owner
create or replace function public.volunteer_confirm_submit(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r record; v_att text; v_via text; v_needs jsonb; v_was_conf boolean; v_late boolean; v_n int := public.wa258_notice_days(); v_to text[];
begin
  if p_token is null or length(p_token) < 12 then return jsonb_build_object('ok', false); end if;
  select er.id, er.status, er.confirm_status, er.role, er.person_name, e.id as event_id, e.event_date, e.status as ev_status into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.confirm_token = p_token;
  if not found then return jsonb_build_object('ok', false); end if;
  if r.event_date < (now() at time zone 'America/Toronto')::date or r.ev_status = 'cancelled' then
    return jsonb_build_object('ok', false, 'reason', 'past');
  end if;
  v_att := lower(coalesce(p->>'attending', ''));
  if v_att not in ('yes', 'no') then return jsonb_build_object('ok', false, 'reason', 'attending'); end if;
  v_via := case when p->>'via' in ('link', 'reply', 'form') then p->>'via' else 'link' end;
  -- wave258: on the page, Confirm needs the 4-day box and the role's details (a reply YES to the text, which states the rule, does not)
  if v_att = 'yes' and coalesce(p->>'via', '') = 'link' then   -- the /c/ page says via link; the old wave31 page sends no via
    if coalesce(p->>'cancel_rule_ok', '') <> 'true' then return jsonb_build_object('ok', false, 'reason', 'rule'); end if;
    v_needs := public.wa258_needs(r.id);
    if jsonb_array_length(v_needs) > 0 then return jsonb_build_object('ok', false, 'reason', 'needs', 'needs', v_needs); end if;
  end if;
  v_was_conf := lower(coalesce(r.status, '')) = 'confirmed' or r.confirm_status = 'confirmed';
  v_late := v_att = 'no' and v_was_conf and r.event_date - (now() at time zone 'America/Toronto')::date < v_n;
  update public.event_roster
     set confirm = coalesce(confirm, '{}'::jsonb) || (p - 'via') || jsonb_build_object('via', v_via, 'at', now())
                   || case when v_att = 'yes' and coalesce(p->>'cancel_rule_ok', '') = 'true' then jsonb_build_object('cancel_rule_at', now()) else '{}'::jsonb end
                   || case when v_late then jsonb_build_object('late_cancel', true) else '{}'::jsonb end,
         confirmed_at = now(),
         confirm_status = case when v_att = 'yes' then 'confirmed' else 'declined' end,
         status = case when v_att = 'yes' then 'Confirmed' else 'Unavailable' end
   where id = r.id;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('event_roster', r.id::text, 'status', r.status, case when v_att = 'yes' then 'Confirmed' else 'Unavailable' end || case when v_late then ' (late: under ' || v_n || ' days)' else '' end, 'volunteer (' || v_via || ')');
  -- a confirmed volunteer who cannot come any more: the role's owner and the texts people hear at once
  if v_att = 'no' and v_was_conf then
    v_to := public.wa258_texts_people() || coalesce(public.wa258_role_owner(r.role), '');
    perform public.wa258_notify(v_to, coalesce(nullif(split_part(r.person_name, ' ', 1), ''), 'A volunteer') || ' can''t make it ' || to_char(r.event_date, 'Dy Mon FMDD'),
      coalesce(r.person_name, 'A volunteer') || ' (' || lower(public.wa171_role_label(r.role, 'en')) || ') said on their page they can''t come'
        || case when v_late then ', under ' || v_n || ' days before: find someone for the role.' else '.' end,
      '/#volunteering/e/' || r.event_id, 'cancel-' || r.id);
  end if;
  return jsonb_build_object('ok', true, 'state', case when v_att = 'yes' then 'confirmed' else 'declined' end, 'late', v_late);
end $$;
comment on function public.volunteer_confirm_submit(text, jsonb) is 'The volunteer''s answer on their page (public, by token): yes or no, saved on the roster row. wave258: Confirm on the page needs cancel_rule_ok (the box: tell us at least 4 days before) and the role''s details (wa258_needs), else reason rule or needs; a confirmed volunteer who now cannot come tells the role''s owner and app_config texts_notify (a Hub notification), marked late_cancel under 4 days.';

-- 10. the serving's Text log (staff): every person, every text, what Quo says happened, and the schedule
create or replace function public.wa258_text_log(p_event bigint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e record; v_hour int; v_days int; v_rem int; v_chk int; v_n int := public.wa258_notice_days(); v jsonb; s jsonb;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  select * into e from public.volunteer_events where id = p_event;
  if not found then raise exception 'No such serving'; end if;
  v_hour := coalesce(nullif((select value from public.app_config where key = 'sms_confirm_hour'), '')::int, 10);
  v_days := coalesce(nullif((select value from public.app_config where key = 'sms_confirm_days'), '')::int, 7);
  v_rem := coalesce(nullif((select value from public.app_config where key = 'sms_reminder_days'), '')::int, 6);
  v_chk := coalesce(nullif((select value from public.app_config where key = 'sms_checkin_days'), '')::int, 3);
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', er.id, 'name', er.person_name, 'role', er.role, 'status', er.status, 'cs', er.confirm_status, 'confirmed_at', er.confirmed_at,
           'via', er.confirm->>'via', 'rule', coalesce(er.confirm->>'cancel_rule_ok', '') = 'true', 'late', coalesce(er.confirm->>'late_cancel', '') = 'true',
           'phone', public.wa171_roster_phone(er.id) is not null, 'partner', coalesce(er.detail->>'partner', '') = 'true', 'source', er.detail->>'source',
           'texts', (select coalesce(jsonb_agg(jsonb_build_object('kind', q.kind, 'status', q.status, 'delivery', q.delivery, 'error', left(coalesce(q.error, ''), 140),
                       'at', coalesce(q.sent_at, q.created_at), 'by', q.sent_by) order by q.created_at), '[]'::jsonb)
                       from public.quo_messages q where q.roster_id = er.id and q.direction = 'out' and q.status <> 'dry_run'),
           'replies', (select count(*) from public.quo_messages q where q.roster_id = er.id and q.direction = 'in')
         ) order by er.role, er.person_name), '[]'::jsonb) into v
    from public.event_roster er where er.event_id = p_event and lower(coalesce(er.status, '')) <> 'cancelled';
  s := jsonb_build_array(
    jsonb_build_object('kind', 'confirm', 'label', 'Confirmation', 'at', (e.event_date - v_days)::text || ' ' || lpad(v_hour::text, 2, '0') || ':00', 'who', 'Everyone on the list who has not answered', 'on', true),
    jsonb_build_object('kind', 'reminder', 'label', 'Monday reminder', 'at', (e.event_date - v_rem)::text || ' ' || lpad(v_hour::text, 2, '0') || ':00', 'who', 'Confirmed: you are confirmed, tell us by the deadline. Not answered: we still need your answer', 'on', coalesce((select value from public.app_config where key = 'sms_reminder_on'), 'on') = 'on'),
    jsonb_build_object('kind', 'deadline', 'label', 'Last day to cancel', 'at', (e.event_date - v_n)::text, 'who', v_n || ' days before', 'on', true),
    jsonb_build_object('kind', 'checkin', 'label', 'Thursday check-in', 'at', (e.event_date - v_chk)::text || ' ' || lpad(v_hour::text, 2, '0') || ':00', 'who', 'Confirmed: see you Sunday, your details. Not answered: can you still come?', 'on', coalesce((select value from public.app_config where key = 'sms_checkin_on'), 'on') = 'on'),
    jsonb_build_object('kind', 'itinerary', 'label', 'Itinerary', 'at', (e.event_date - 1)::text || ' ' || lpad(coalesce(nullif((select value from public.app_config where key = 'sms_itinerary_hour'), ''), '17'), 2, '0') || ':00', 'who', 'Confirmed team leaders, drivers and the roles with an itinerary', 'on', coalesce(e.itinerary_auto, false)),
    jsonb_build_object('kind', 'survey', 'label', 'Thank-you and survey', 'at', e.event_date::text || ' ' || lpad(coalesce(nullif((select value from public.app_config where key = 'sms_survey_hour'), ''), '18'), 2, '0') || ':00', 'who', 'Everyone confirmed', 'on', true));
  return jsonb_build_object('event', jsonb_build_object('id', e.id, 'date', e.event_date, 'code', e.code), 'rows', v, 'schedule', s,
    'mode', (select value from public.app_config where key = 'sms_mode'), 'can_text', public.wa256_can_text(), 'notice_days', v_n,
    'owners', coalesce((select value from public.app_config where key = 'volunteer_role_owners')::jsonb, '{}'::jsonb));
end $$;
comment on function public.wa258_text_log(bigint) is 'wave258: a serving''s Text log (staff; Ibrahim''s check): each person on it (role, answer, the 4-day box, a phone or not), every text the Hub sent them (kind, status, what Quo says happened, error, when, by whom) and their replies; the serving''s text schedule (confirmation, Monday reminder, the last day to cancel, Thursday check-in, itinerary, survey) and the role owners.';

-- 11. rows copied from the old sheet: their owner keeps or removes each one
create or replace function public.wa258_sheet_keep(p_roster bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_by text := coalesce(auth.jwt()->>'email', 'staff'); r record;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  select id, detail into r from public.event_roster where id = p_roster;
  if not found then raise exception 'No such roster row'; end if;
  update public.event_roster set detail = coalesce(detail, '{}'::jsonb) || jsonb_build_object('sheet_checked', jsonb_build_object('by', v_by, 'at', now())) where id = p_roster;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('event_roster', p_roster::text, 'sheet_checked', null, 'kept', v_by);
  return jsonb_build_object('ok', true);
end $$;
comment on function public.wa258_sheet_keep(bigint) is 'wave258: a row copied from the old Excel sheet (detail.source sheet) is checked and kept by the role''s owner (detail.sheet_checked {by, at}); removing it is the roster''s own Take off. Staff.';

-- 12. role owners, and who already contacted someone (to avoid texting twice)
create or replace function public.wa258_role_owners() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb; v_me text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  v := coalesce((select value from public.app_config where key = 'volunteer_role_owners')::jsonb, '{}'::jsonb);
  return jsonb_build_object('owners', v,
    'names', (select coalesce(jsonb_object_agg(x.email, coalesce(tm.name, x.email)), '{}'::jsonb) from (select distinct lower(value) email from jsonb_each_text(v)) x
               left join lateral (select t.name from public.team_members t where lower(t.email) = x.email limit 1) tm on true),
    'mine', (select coalesce(jsonb_agg(key order by key), '[]'::jsonb) from jsonb_each_text(v) where lower(value) = v_me),
    'can_edit', coalesce(public.is_wa_admin(), false) or coalesce(public.is_wa_leader(), false));
end $$;
comment on function public.wa258_role_owners() is 'wave258: who owns each volunteer role (app_config volunteer_role_owners) with their names, the roles the signed-in person owns (My roles), and whether they may change it (leaders, admins). Staff.';

create or replace function public.wa258_role_owners_set(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_by text := coalesce(auth.jwt()->>'email', 'staff'); v jsonb := '{}'::jsonb; k text; e text; v_old text;
begin
  if not (coalesce(public.is_wa_admin(), false) or coalesce(public.is_wa_leader(), false)) then raise exception 'Only leaders and admins can change who owns a role.'; end if;
  for k, e in select key, value from jsonb_each_text(coalesce(p, '{}'::jsonb)) loop
    if k !~ '^[a-z_]{3,30}$' then continue; end if;
    e := lower(trim(coalesce(e, '')));
    if e = '' then continue; end if;
    if e !~ '^[^@\s]+@[^@\s]+$' then raise exception 'Not an email: %', e; end if;
    v := v || jsonb_build_object(k, e);
  end loop;
  select value into v_old from public.app_config where key = 'volunteer_role_owners';
  insert into public.app_config (key, value, updated_at) values ('volunteer_role_owners', v::text, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('app_config', 'volunteer_role_owners', 'value', v_old, v::text, v_by);
  return public.wa258_role_owners();
end $$;
comment on function public.wa258_role_owners_set(jsonb) is 'wave258: sets who owns each volunteer role ({role: email}); leaders and admins; change_log keeps the old value.';

create or replace function public.wa258_contacted(p_people bigint[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  select coalesce(jsonb_object_agg(x.person_id::text, jsonb_build_object('by', x.by, 'name', x.name, 'at', x.at, 'kind', x.kind)), '{}'::jsonb) into v
    from (
      select distinct on (q.person_id) q.person_id, lower(q.sent_by) by,
             coalesce((select t.name from public.team_members t where lower(t.email) = lower(q.sent_by) limit 1), split_part(q.sent_by, '@', 1)) name,
             coalesce(q.sent_at, q.created_at) at, q.kind
        from public.quo_messages q
       where q.person_id = any (coalesce(p_people, '{}'::bigint[])) and q.direction = 'out' and q.status in ('sent', 'queued')
         and q.sent_by like '%@%' and q.created_at > now() - interval '30 days'
       order by q.person_id, q.created_at desc) x;
  return v;
end $$;
comment on function public.wa258_contacted(bigint[]) is 'wave258: for each volunteer, the last text a team member sent them from the Hub in the last 30 days (who, when, what kind), so two people do not text the same volunteer. Staff.';

-- 13. the notification kind (Hub only: no Slack, no email)
insert into public.hub_notification_kinds (key, grp, grp_title, sort, title, blurb, says, hub, slack, email, channel_only, audience, sender, active, updated_at)
select 'volunteer_texts', 'volunteers', 'Volunteers', 20, 'Volunteer texts went out, or a volunteer cancels',
       'After each automatic round (confirmations, Monday reminders, Thursday check-ins) and when a confirmed volunteer says they cannot come.',
       'The serving, how many texts went, failed (who) or were skipped, or who cancelled and whether it is under 4 days, and a link to the serving.',
       true, false, false, false, 'Ibrahim, Mary, Terry (texts_notify) and the role''s owner', 'wa258_notify, hub-push', true, now()
 where not exists (select 1 from public.hub_notification_kinds where key = 'volunteer_texts');

-- 14. grants
revoke execute on function public.wa258_notice_days() from public, anon, authenticated;
revoke execute on function public.wa258_needs(bigint) from public, anon, authenticated;
revoke execute on function public.wa258_nudge_text(bigint, text) from public, anon, authenticated;
revoke execute on function public.wa258_queue_nudges(bigint) from public, anon, authenticated;
revoke execute on function public.wa258_notify(text[], text, text, text, text) from public, anon, authenticated;
revoke execute on function public.wa258_texts_people() from public, anon, authenticated;
revoke execute on function public.wa258_role_owner(text) from public, anon, authenticated;
revoke execute on function public.wa258_round_notices() from public, anon, authenticated;
revoke execute on function public.wa171_sms_tick() from public, anon, authenticated;
revoke execute on function public.wa258_text_log(bigint) from public, anon, authenticated;
revoke execute on function public.wa258_sheet_keep(bigint) from public, anon, authenticated;
revoke execute on function public.wa258_role_owners() from public, anon, authenticated;
revoke execute on function public.wa258_role_owners_set(jsonb) from public, anon, authenticated;
revoke execute on function public.wa258_contacted(bigint[]) from public, anon, authenticated;
grant execute on function public.wa258_text_log(bigint) to authenticated;
grant execute on function public.wa258_sheet_keep(bigint) to authenticated;
grant execute on function public.wa258_role_owners() to authenticated;
grant execute on function public.wa258_role_owners_set(jsonb) to authenticated;
grant execute on function public.wa258_contacted(bigint[]) to authenticated;
