-- wave257 (15/10/26): place a volunteer on servings from Applicants received and Volunteers, tell them by text and email,
-- and let them confirm right away.
-- Steel: "when we get the application, we can assign them to an event and they get the notification on text and email
-- saying, hey, we just confirmed ... that you are volunteering as a server or a dishwasher"; "Once I assign her to an event
-- or a few ... that confirmation goes to them ... please confirm ... we can have her confirmed early."

-- 1. the volunteer's page: a serving someone was placed on by the team (detail.confirm_early) can be confirmed at once,
--    not only from 7 days before (the same rule as an invitation, detail.source recruit)
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.volunteer_confirm_get(text, boolean)'::regprocedure);
  if position('confirm_early' in d) = 0 then
    d := replace(d, $a$when r.event_date - v_today > v_days and coalesce(r.detail->>'source', '') <> 'recruit' then 'early'$a$,
                    $a$when r.event_date - v_today > v_days and coalesce(r.detail->>'source', '') <> 'recruit' and coalesce(r.detail->>'confirm_early', '') <> 'true' then 'early'$a$);
    d := replace(d, $a$when e2.event_date - v_today > v_days and coalesce(o.detail->>'source', '') <> 'recruit' then 'early'$a$,
                    $a$when e2.event_date - v_today > v_days and coalesce(o.detail->>'source', '') <> 'recruit' and coalesce(o.detail->>'confirm_early', '') <> 'true' then 'early'$a$);
    if (length(d) - length(replace(d, 'confirm_early', ''))) / length('confirm_early') <> 2 then raise exception 'volunteer_confirm_get changed: confirm_early not placed twice'; end if;
    execute d;
  end if;
end $do$;

-- 2. the servings to place someone on: the next upcoming servings with each role's spots and who is on them, and the
--    person's own rows (staff)
create or replace function public.wa257_assign_options(p_person bigint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb; v_today date := (now() at time zone 'America/Toronto')::date; p record;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  select id, full_name, roles, phones, emails into p from public.volunteer_people where id = p_person;
  if not found then raise exception 'No such volunteer'; end if;
  with ev as (
    select e.* from public.volunteer_events e
     where e.kind = 'service' and e.status not in ('cancelled', 'completed') and e.event_date >= v_today
     order by e.event_date limit 10
  ), tgt as (
    select g.role, coalesce(g.target, 0) t from public.volunteer_role_guides g where coalesce(g.target, 0) > 0
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', ev.id, 'code', ev.code, 'date', ev.event_date, 'title', ev.title, 'format', ev.format,
           'start', to_char(coalesce(ev.start_time, '12:00'::time), 'HH24:MI'),
           'spots', (select coalesce(jsonb_object_agg(x.role, x.n), '{}'::jsonb) from (
                      select t.role, coalesce((ev.spot_counts->>t.role)::int, t.t) n from tgt t
                      union all
                      select k, (ev.spot_counts->>k)::int from jsonb_object_keys(coalesce(ev.spot_counts, '{}'::jsonb)) k where k not in (select role from tgt)) x),
           'filled', (select coalesce(jsonb_object_agg(f.role, f.n), '{}'::jsonb) from (
                      select lower(r.role) role, count(*) n from public.event_roster r where r.event_id = ev.id
                         and lower(coalesce(r.status, '')) not in ('unavailable', 'cancelled', 'declined') group by 1) f),
           'confirmed', (select count(*) from public.event_roster r where r.event_id = ev.id and (lower(coalesce(r.status, '')) = 'confirmed' or r.confirm_status = 'confirmed')),
           'mine', (select jsonb_build_object('id', r.id, 'role', r.role, 'status', r.status, 'cs', r.confirm_status, 'choices', r.detail->'role_choices')
                      from public.event_roster r where r.event_id = ev.id and r.person_id = p_person and lower(coalesce(r.status, '')) <> 'cancelled' order by r.id limit 1)
         ) order by ev.event_date), '[]'::jsonb)
    into v from ev;
  return jsonb_build_object('person', jsonb_build_object('id', p.id, 'name', p.full_name, 'roles', to_jsonb(p.roles),
           'phone', (select public.wa171_digits(x) from unnest(p.phones) x where public.wa171_digits(x) is not null limit 1),
           'email', (p.emails)[1], 'lang', public.wa171_lang(p.id)),
         'servings', v, 'can_tell', public.wa256_can_text(),
         'sms_mode', (select value from public.app_config where key = 'sms_mode'), 'mail_mode', (select value from public.app_config where key = 'mail_mode'),
         'window', public.wa191_sms_window());
end $$;
comment on function public.wa257_assign_options(bigint) is 'wave257: Assign to servings (staff): the person (name, roles, phone, email, language), the next 10 upcoming servings with each role''s spots (volunteer_role_guides.target, the serving''s spot_counts first), how many are on each role, confirmed, and the person''s own row on each; can_tell (leaders, HR, admins), the text and email modes, whether texts send now.';

-- 3. the text they get (also shown on the Hub before sending)
create or replace function public.wa257_text(p_person bigint, p_rows bigint[]) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_lang text := public.wa171_lang(p_person); v_first text; v_list text; v_role text; v_roles int; v_link text; v_n int;
begin
  select nullif(split_part(trim(coalesce(full_name, '')), ' ', 1), '') into v_first from public.volunteer_people where id = p_person;
  select count(*), count(distinct lower(r.role)),
         string_agg(public.wa171_date_words(e.event_date, v_lang), case when v_lang = 'fr' then ' et ' else ' and ' end order by e.event_date),
         lower(public.wa171_role_label((array_agg(r.role order by e.event_date))[1], v_lang)),
         (array_agg(r.confirm_token order by e.event_date))[1]
    into v_n, v_roles, v_list, v_role, v_link
    from public.event_roster r join public.volunteer_events e on e.id = r.event_id where r.id = any (p_rows);
  if v_n = 0 then return null; end if;
  if v_roles > 1 then
    select string_agg(public.wa171_date_words(e.event_date, v_lang) || ' (' || lower(public.wa171_role_label(r.role, v_lang)) || ')', case when v_lang = 'fr' then ' et ' else ' and ' end order by e.event_date)
      into v_list from public.event_roster r join public.volunteer_events e on e.id = r.event_id where r.id = any (p_rows);
  end if;
  v_link := coalesce((select value from public.app_config where key = 'sms_link_base'), 'https://hub.welfareavenue.com/c/') || v_link;
  if v_lang = 'fr' then
    return 'Bonjour ' || coalesce(v_first, '') || ', ici Welfare Avenue! Bonne nouvelle : vous faites partie de l''équipe'
      || case when v_roles > 1 then ' le ' || v_list else ' comme ' || v_role || ' le ' || v_list end
      || '. Confirmez votre présence ici' || case when v_n > 1 then ' (une fois par date)' else '' end || ' : ' || v_link
      || case when v_n = 1 then ' (ou répondez OUI ou NON)' else '' end || '. Répondez STOP pour ne plus recevoir de textos.';
  end if;
  return 'Hi ' || coalesce(v_first, 'there') || ', it''s Welfare Avenue! Good news: you''re on the team'
    || case when v_roles > 1 then ' on ' || v_list else ' as a' || case when v_role ~ '^[aeiou]' then 'n ' else ' ' end || v_role || ' on ' || v_list end
    || '. Please confirm you''ll be there' || case when v_n > 1 then ' (one tap for each date)' else '' end || ': ' || v_link
    || case when v_n = 1 then ' (or reply YES or NO)' else '' end || '. Reply STOP to stop texts.';
end $$;
comment on function public.wa257_text(bigint, bigint[]) is 'wave257: the text a volunteer gets when the team places them on servings (English or French by their contact''s language): the role, the dates, their confirmation link, STOP. Internal (wa257_assign).';

-- 4. place them: add or update their roster rows, tell them (text and email), mark the application
create or replace function public.wa257_assign(p_person bigint, p_events bigint[], p_role text, p_text boolean default true, p_email boolean default true,
                                              p_app bigint default null, p_roles jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_by text := coalesce(auth.jwt()->>'email', 'staff'); v_today date := (now() at time zone 'America/Toronto')::date; p record; e record; r record;
        v_rows bigint[] := '{}'; v_new int := 0; v_upd int := 0; v_kept int := 0; v_role text; v_phone text; v_body text; v_text text := 'not asked'; v_mail text := 'not asked';
        v_em jsonb; v_lang text; v_items text; v_items_t text; v_rid bigint; v_conf boolean; v_can boolean := public.wa256_can_text(); v_sms text; v_mailmode text; v_first text; v_confirm text; v_role1 text;
        v_dates text[] := '{}'; v_valid text[] := array['team_leader','cook','driver','server','dishwasher','photographer','videographer','community_debrief'];
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  select id, full_name, roles into p from public.volunteer_people where id = p_person;
  if not found then raise exception 'No such volunteer'; end if;
  if coalesce(array_length(p_events, 1), 0) = 0 then raise exception 'Pick at least one serving.'; end if;
  if (p_text or p_email) and not v_can then raise exception 'Only leaders, HR and admins can text or email volunteers. Untick "Tell them" to place them without a message.'; end if;
  for e in select * from public.volunteer_events where id = any (p_events) order by event_date loop
    if e.kind <> 'service' or e.status in ('cancelled', 'completed') or e.event_date < v_today then raise exception 'The serving on % is past or closed.', e.event_date; end if;
    v_role := lower(coalesce(nullif(p_roles->>(e.id::text), ''), nullif(p_role, ''), (p.roles)[1], 'server'));
    if v_role = 'community_talker' then v_role := 'community_debrief'; end if;
    if not (v_role = any (v_valid)) then raise exception 'Unknown role: %', v_role; end if;
    v_rid := null; v_conf := false;
    select * into r from public.event_roster where event_id = e.id and person_id = p_person and lower(coalesce(status, '')) <> 'cancelled' order by id limit 1;
    if found then
      v_rid := r.id;
      v_conf := lower(coalesce(r.status, '')) = 'confirmed' or coalesce(r.confirm_status, '') = 'confirmed';
      if v_conf then
        if lower(r.role) <> v_role then
          update public.event_roster set role = v_role, detail = coalesce(detail, '{}'::jsonb) || jsonb_build_object('assigned_by', v_by, 'assigned_at', now()) where id = r.id;
        end if;
        v_kept := v_kept + 1;
      else
        update public.event_roster set role = v_role, status = 'Waiting For Response', confirm_status = null,
               detail = (coalesce(detail, '{}'::jsonb) - 'role_choices') || jsonb_build_object('confirm_early', true, 'assigned_by', v_by, 'assigned_at', now(), 'was', jsonb_build_object('role', r.role, 'status', r.status, 'choices', r.detail->'role_choices')),
               signup_noticed_at = coalesce(signup_noticed_at, now())
         where id = r.id;
        v_upd := v_upd + 1;
      end if;
    else
      insert into public.event_roster (event_id, person_id, person_name, role, status, detail, signup_noticed_at)
      values (e.id, p_person, p.full_name, v_role, 'Waiting For Response', jsonb_build_object('source', 'assigned', 'confirm_early', true, 'assigned_by', v_by, 'assigned_at', now(), 'application_id', p_app), now())
      returning id into v_rid;
      v_new := v_new + 1;
    end if;
    if not v_conf then v_rows := v_rows || v_rid; end if;
    v_dates := v_dates || (to_char(e.event_date, 'Dy Mon DD') || ' ' || v_role);
  end loop;

  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('volunteer_person', p_person::text, 'assigned', null, array_to_string(v_dates, ', '), v_by);

  -- the text: one for all the servings they still have to confirm (sms_mode decides; only 9 am to 7 pm; STOP respected)
  v_sms := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  if p_text and coalesce(array_length(v_rows, 1), 0) > 0 then
    v_phone := public.wa171_roster_phone(v_rows[1]);
    if v_phone is null then v_text := 'no phone number';
    elsif public.wa171_opted_out(p_person, v_phone) then v_text := 'they texted STOP';
    elsif v_sms = 'off' then v_text := 'texts are off';
    elsif v_sms = 'test' and not public.wa171_test_phone(v_phone) then v_text := 'test mode: only the test phone gets texts';
    else
      v_body := public.wa257_text(p_person, v_rows);
      insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id)
      values (gen_random_uuid(), p_person, '+1' || v_phone, v_body, 'queued', (select event_id from public.event_roster where id = v_rows[1]), v_by, 'out', 'signup', v_rows[1]);
      v_text := case when public.wa191_sms_window() then 'sent' else 'queued for 9 am' end;
      if public.wa191_sms_window() then perform public.call_edge('quo-send', '{"action":"drain"}'::jsonb); end if;
    end if;
  end if;

  -- the email (mail-send, template volunteer_assigned or volunteer_assigned_fr; mail_mode and the permission rule decide there)
  if p_email and coalesce(array_length(v_rows, 1), 0) > 0 then
    v_em := public.wa182_roster_email(v_rows[1]);
    v_mailmode := coalesce((select value from public.app_config where key = 'mail_mode'), 'test');
    if (v_em->>'contact_id') is null or coalesce(v_em->>'email', '') = '' then v_mail := 'no email address';
    else
      v_lang := public.wa171_lang(p_person);
      v_first := nullif(split_part(trim(coalesce(p.full_name, '')), ' ', 1), '');
      select string_agg('<li><strong>' || replace(replace(public.wa171_date_words(e2.event_date, v_lang), '&', '&amp;'), '<', '&lt;') || '</strong>, ' || lower(public.wa171_role_label(r2.role, v_lang))
               || ' (' || to_char(coalesce(e2.start_time, '12:00'::time), 'HH24:MI') || ', ' || replace(replace(coalesce(nullif(e2.location, ''), 'Montreal'), '&', '&amp;'), '<', '&lt;') || ')</li>', '' order by e2.event_date),
             string_agg('- ' || public.wa171_date_words(e2.event_date, v_lang) || ', ' || lower(public.wa171_role_label(r2.role, v_lang)), E'\n' order by e2.event_date),
             lower(public.wa171_role_label((array_agg(r2.role order by e2.event_date))[1], v_lang)),
             (array_agg(r2.confirm_token order by e2.event_date))[1]
        into v_items, v_items_t, v_role1, v_confirm
        from public.event_roster r2 join public.volunteer_events e2 on e2.id = r2.event_id where r2.id = any (v_rows);
      perform public.call_edge('mail-send', jsonb_build_object('action', 'send', 'template_key', case when v_lang = 'fr' then 'volunteer_assigned_fr' else 'volunteer_assigned' end,
        'contact_id', (v_em->>'contact_id')::bigint,
        'vars', jsonb_build_object('first_name', coalesce(v_first, ''), 'role', v_role1, 'extra_html', '<ul>' || v_items || '</ul>', 'extra_text', v_items_t,
                  'count', coalesce(array_length(v_rows, 1), 0)::text,
                  'confirm_url', coalesce((select value from public.app_config where key = 'sms_link_base'), 'https://hub.welfareavenue.com/c/') || v_confirm)));
      v_mail := case when v_mailmode = 'live' then 'sent' else 'test mode: only the test addresses get email' end;
    end if;
  end if;

  if p_app is not null then
    perform public.wa209_vol_app_status(p_app, 'welcomed', 'Placed on ' || array_to_string(v_dates, ', '));
  end if;
  return jsonb_build_object('ok', true, 'added', v_new, 'updated', v_upd, 'already_confirmed', v_kept, 'to_confirm', coalesce(array_length(v_rows, 1), 0),
    'text', v_text, 'email', v_mail, 'rows', to_jsonb(v_rows));
end $$;
comment on function public.wa257_assign(bigint, bigint[], text, boolean, boolean, bigint, jsonb) is 'wave257: places a volunteer on one or more upcoming servings (staff): a new roster row (Waiting For Response, detail.source assigned) or their existing row moved to that role and back to waiting (a confirmed row keeps its answer); detail.confirm_early lets them confirm on their page at once; signup_noticed_at set so the sign-up notice does not text them again. Tells them (leaders, HR, admins): one text (quo_messages kind signup, wa257_text; sms_mode, 9 am to 7 pm, STOP) and one email (mail-send send, template volunteer_assigned / _fr; mail_mode and the permission rule). p_app marks the application welcomed with the dates. p_roles: a role per serving id. change_log volunteer_person assigned.';

-- 5. the preview: the same placement inside a block that is rolled back, so the Hub shows the real text and who gets what
create or replace function public.wa257_preview(p_person bigint, p_events bigint[], p_role text, p_roles jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb; v_det text; v_phone text; v_sms text := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
        v_mail text := coalesce((select value from public.app_config where key = 'mail_mode'), 'test'); v_em text; v_contact bigint;
begin
  if not public.is_wa_staff() then raise exception 'Staff only'; end if;
  begin
    declare res jsonb; v_rws bigint[];
    begin
      res := public.wa257_assign(p_person, p_events, p_role, false, false, null, p_roles);
      v_rws := array(select jsonb_array_elements_text(res->'rows')::bigint);
      res := res || jsonb_build_object('body', public.wa257_text(p_person, v_rws));
      raise exception using errcode = 'P0001', message = 'wa257preview', detail = res::text;
    end;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_det = pg_exception_detail;
    if sqlerrm <> 'wa257preview' then raise; end if;
    v := v_det::jsonb;
  end;
  v_phone := (select public.wa171_digits(x) from public.volunteer_people vp, unnest(vp.phones) x where vp.id = p_person and public.wa171_digits(x) is not null limit 1);
  select vp.contact_id into v_contact from public.volunteer_people vp where vp.id = p_person;
  v_em := (select coalesce(c.primary_email, (c.emails)[1]) from public.crm_contacts c where c.id = v_contact);
  return v - 'rows' || jsonb_build_object(
    'text', case when (v->>'to_confirm')::int = 0 then 'nothing to confirm' when v_phone is null then 'no phone number' when public.wa171_opted_out(p_person, v_phone) then 'they texted STOP'
                 when v_sms = 'off' then 'texts are off' when v_sms = 'test' and not public.wa171_test_phone(v_phone) then 'test mode: only the test phone gets texts'
                 when public.wa191_sms_window() then 'sends now' else 'waits for 9 am' end,
    'phone', v_phone, 'email_to', v_em,
    'email', case when (v->>'to_confirm')::int = 0 then 'nothing to confirm' when v_em is null then 'no email address' when v_mail <> 'live' then 'test mode: only the test addresses get email' else 'sends now' end);
end $$;
comment on function public.wa257_preview(bigint, bigint[], text, jsonb) is 'wave257: what Assign to servings would do (staff): the counts, the exact text (wa257_text), whether the text and the email would go; runs wa257_assign in a block that is rolled back, so nothing is kept or sent.';

revoke execute on function public.wa257_assign_options(bigint) from public, anon, authenticated;
revoke execute on function public.wa257_text(bigint, bigint[]) from public, anon, authenticated;
revoke execute on function public.wa257_assign(bigint, bigint[], text, boolean, boolean, bigint, jsonb) from public, anon, authenticated;
revoke execute on function public.wa257_preview(bigint, bigint[], text, jsonb) from public, anon, authenticated;
grant execute on function public.wa257_assign_options(bigint) to authenticated;
grant execute on function public.wa257_assign(bigint, bigint[], text, boolean, boolean, bigint, jsonb) to authenticated;
grant execute on function public.wa257_preview(bigint, bigint[], text, jsonb) to authenticated;

-- 5. the email (two languages), in the house style of serving_reminder
insert into public.crm_email_templates (key, name, kind, subject, preheader, html_body, text_body, vars, active, sort, lang, description, created_by)
values
('volunteer_assigned', 'You are on a serving (placed by the team)', 'transactional', 'You''re on the team, {{first_name|friend}}: please confirm',
 'We placed you on a Welfare Avenue serving. One tap to confirm.',
 '<h1>You''re on the team</h1>
<p>Hi {{first_name|there}},</p>
<p>Thank you for volunteering with Welfare Avenue! We have placed you on:</p>
{{extra_html}}
<p>Please confirm you''ll be there. On your page you''ll also see what to expect in your role, what to bring and when to arrive.</p>
<a class="btn" href="{{confirm_url}}">Confirm my servings</a>
<p>Can''t make it after all? Say so on the same page, or reply to this email, so we can plan around it.</p>
<p>See you on Sunday!</p>',
 'Hi {{first_name|there}},

Thank you for volunteering with Welfare Avenue! We have placed you on:

{{extra_text}}

Please confirm you''ll be there: {{confirm_url}}
On your page you''ll also see what to expect in your role, what to bring and when to arrive.

Can''t make it after all? Say so on the same page, or reply to this email, so we can plan around it.

See you on Sunday!',
 '["first_name","role","extra_html","extra_text","confirm_url","count"]'::jsonb, true, 60, 'en',
 'wave257: sent when the team places a volunteer on servings (Assign to servings in Applicants received or Volunteers).', 'wave257'),
('volunteer_assigned_fr', 'Vous êtes sur un service (placé par l''équipe)', 'transactional', 'Vous faites partie de l''équipe, {{first_name|}} : confirmez svp',
 'Nous vous avons placé sur un service de Welfare Avenue. Un clic pour confirmer.',
 '<h1>Vous faites partie de l''équipe</h1>
<p>Bonjour {{first_name|}},</p>
<p>Merci de faire du bénévolat avec Welfare Avenue! Nous vous avons placé sur :</p>
{{extra_html}}
<p>Confirmez votre présence, s''il vous plaît. Votre page vous dit aussi à quoi vous attendre dans votre rôle, quoi apporter et quand arriver.</p>
<a class="btn" href="{{confirm_url}}">Confirmer mes services</a>
<p>Finalement, vous ne pouvez pas venir? Dites-le sur la même page ou répondez à ce courriel, pour que nous puissions nous organiser.</p>
<p>À dimanche!</p>',
 'Bonjour {{first_name|}},

Merci de faire du bénévolat avec Welfare Avenue! Nous vous avons placé sur :

{{extra_text}}

Confirmez votre présence ici : {{confirm_url}}
Votre page vous dit aussi à quoi vous attendre dans votre rôle, quoi apporter et quand arriver.

Finalement, vous ne pouvez pas venir? Dites-le sur la même page ou répondez à ce courriel.

À dimanche!',
 '["first_name","role","extra_html","extra_text","confirm_url","count"]'::jsonb, true, 61, 'fr',
 'wave257 : envoyé quand l''équipe place un bénévole sur des services.', 'wave257')
on conflict (key) do nothing;
