-- =====================================================================
-- wave297: automatic texts and automatic emails, switched on or off per city, and Send now buttons (Steel, 08/11/26)
-- =====================================================================
-- Steel (08/11/26, after the Toronto meeting): "we should have the ability to confirm people via email as well, and
-- follow up via email as well, and not always have texts. So please set up both the optional ability to send out
-- automatic texts and automatic emails, and also have the button to send those out, both in Montreal and Toronto."
--
-- What it does
--   * Four switches in app_config: vol_auto_texts_montreal, vol_auto_emails_montreal, vol_auto_texts_toronto,
--     vol_auto_emails_toronto ('on' / 'off'). They decide how the automatic confirmation, Monday reminder, Thursday
--     check-in, sign-up message and thank-you (survey) reach volunteers: by text, by email, both, or not at all.
--     Montreal starts at emails on, texts off: exactly what wave266f (texts_by_email on) does today, so nothing in
--     Montreal changes until someone flips a switch. Toronto starts at emails on, texts off.
--   * wa297_channel(event): 'text' | 'email' | 'both' | 'none'. A Send now sets the GUC wa297.channel for its own
--     transaction; else the event's own confirm_channels (wave266e, none set today); else the city's two switches.
--   * The by-email trigger (wa266f_by_email) follows the channel instead of the global texts_by_email switch (which
--     nothing reads after this file): email turns a queued text into an email (a text only when there is no email
--     address); both keeps the text and sends the same words by email (wa297_email_copy); text keeps the text (an
--     email only when there is no phone number).
--   * Toronto events (kind meal) join the automations: confirmations, reminders, check-ins, sign-ups and thank-yous,
--     in Toronto words (event, not serving; no dish or pick-up for cooks, who cook in the kitchen), replies to
--     toronto@welfareavenue.com, and Tate and Sama hear when someone can't come (app_config toronto_texts_notify).
--   * Send now (wa297_send_now): confirmation, reminder, check-in or thank-you for one event, by text, email or both,
--     to the people who have not had that message yet. Montreal: leaders, HR, admins and the text staff
--     (wa256_can_text). Toronto: the same plus the Toronto team (opsto).
--   * The switches (wa297_auto_get, wa297_auto_set): the same people, for their city.
--   Every patch is by exact anchor on the live text of 08/11/26: the file stops (and keeps nothing) if an anchor moved.
-- Undo: build/data/wa297_undo.sql.

begin;

create or replace function pg_temp.sub(t text, a text, b text) returns text language plpgsql as $f$
declare n int;
begin
  n := (length(t) - length(replace(t, a, ''))) / greatest(length(a), 1);
  if n <> 1 then raise exception 'wave297: anchor found % times: %', n, left(a, 120); end if;
  return replace(t, a, b);
end $f$;

-- the undo keeps the live text of every function this file patches
create table if not exists public.wa297_undo_defs (fn text primary key, def text not null, saved_at timestamptz not null default now());
alter table public.wa297_undo_defs enable row level security;
revoke all on public.wa297_undo_defs from anon, authenticated;
grant all on public.wa297_undo_defs to service_role;
comment on table public.wa297_undo_defs is 'wave297: the live text of every function wa297_channels.sql patched, as it was before, for build/data/wa297_undo.sql. Written once by the migration; read by the undo only. No API access.';
insert into public.wa297_undo_defs (fn, def)
select p.oid::regprocedure::text, pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('wa171_queue_confirms', 'wa258_queue_nudges', 'wa266_confirm_email', 'wa266f_by_email', 'wa266f_email_drain',
   'wa171_confirm_text', 'wa258_nudge_text', 'wa258_needs', 'volunteer_confirm_get', 'volunteer_confirm_submit', 'wa172_queue_signups',
   'wa172_queue_surveys', 'wa258_round_notices')
on conflict (fn) do nothing;

-- the switches
insert into public.app_config (key, value) values
  ('vol_auto_texts_montreal', 'off'), ('vol_auto_emails_montreal', 'on'),
  ('vol_auto_texts_toronto', 'off'), ('vol_auto_emails_toronto', 'on'),
  ('toronto_texts_notify', 'tate.weinstein@welfareavenue.com,sama.saqib@welfareavenue.com'),
  ('toronto_reply_to', 'toronto@welfareavenue.com')
on conflict (key) do nothing;

-- ---------- helpers ----------
create or replace function public.wa297_city(p_event bigint) returns text
language sql stable security definer set search_path to '' as $$
  select case when exists (select 1 from public.volunteer_events e where e.id = p_event and (e.kind = 'meal' or lower(coalesce(e.location, '')) = 'toronto')) then 'toronto' else 'montreal' end
$$;
comment on function public.wa297_city(bigint) is 'wave297: the city an event belongs to: toronto (kind meal or location Toronto) or montreal. Internal.';

create or replace function public.wa297_channel(p_event bigint) returns text
language plpgsql stable security definer set search_path to '' as $$
declare v text; c text; t boolean; m boolean;
begin
  v := nullif(current_setting('wa297.channel', true), '');
  if v in ('text', 'email', 'both') then return v; end if;
  select nullif(e.confirm_channels, '') into v from public.volunteer_events e where e.id = p_event;
  if v in ('text', 'email', 'both', 'none') then return v; end if;
  c := public.wa297_city(p_event);
  t := coalesce((select value from public.app_config where key = 'vol_auto_texts_' || c), 'off') = 'on';
  m := coalesce((select value from public.app_config where key = 'vol_auto_emails_' || c), 'off') = 'on';
  return case when t and m then 'both' when t then 'text' when m then 'email' else 'none' end;
end $$;
comment on function public.wa297_channel(bigint) is 'wave297: how automatic volunteer messages reach people for an event: text, email, both or none. A Send now sets wa297.channel for its transaction; else volunteer_events.confirm_channels; else the city switches vol_auto_texts_<city> and vol_auto_emails_<city>. Internal.';

create or replace function public.wa297_toronto_people() returns text[]
language sql stable security definer set search_path to '' as $$
  select array(select distinct x from unnest(string_to_array(replace(lower(coalesce((select value from public.app_config where key = 'toronto_texts_notify'), '')), ' ', ''), ',')) x where x like '%@%')
$$;
comment on function public.wa297_toronto_people() is 'wave297: who hears about Toronto volunteer messages and cancellations (app_config toronto_texts_notify). Internal.';

create or replace function public.wa297_reply_to(p_event bigint, p_role text) returns text
language sql stable security definer set search_path to '' as $$
  select case when public.wa297_city(p_event) = 'toronto' then coalesce(nullif((select value from public.app_config where key = 'toronto_reply_to'), ''), 'toronto@welfareavenue.com')
              else public.wa258_role_owner(p_role) end
$$;
comment on function public.wa297_reply_to(bigint, text) is 'wave297: the reply-to of a volunteer email: toronto@ for Toronto events, else the role owner (wave258). Internal.';

create or replace function public.wa297_email_ok(p_roster bigint) returns boolean
language sql stable security definer set search_path to '' as $$
  select (v->>'contact_id') is not null and coalesce(v->>'email', '') ~ '^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$'
    from (select public.wa182_roster_email(p_roster) v) x
$$;
comment on function public.wa297_email_ok(bigint) is 'wave297: whether a roster row has a CRM contact with a usable email address. Internal.';

-- the same words by email, alongside a text (channel both); once per person and kind (event_roster.detail emailed_<kind>_at)
create or replace function public.wa297_email_copy(p_roster bigint, p_kind text, p_body text) returns boolean
language plpgsql security definer set search_path to '' as $$
declare r record; v_lang text; v_link text; v_msg text; v_subject text; v_button text; v_key text; v_meal boolean;
begin
  if p_kind = 'confirm' then return public.wa266_confirm_email(p_roster, 'wave297: text and email'); end if;
  if p_kind not in ('signup', 'reminder', 'checkin', 'survey') then return false; end if;
  select er.id, er.person_id, er.role, er.confirm_token, er.detail, e.id as event_id, e.kind into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.id = p_roster;
  if not found or r.confirm_token is null or coalesce(r.detail, '{}'::jsonb) ? ('emailed_' || p_kind || '_at') then return false; end if;
  if not public.wa297_email_ok(p_roster) then return false; end if;
  v_meal := r.kind = 'meal';
  v_lang := public.wa171_lang(r.person_id);
  v_link := coalesce((select value from public.app_config where key = 'sms_link_base'), 'https://hub.welfareavenue.com/c/') || r.confirm_token;
  v_msg := public.wa266f_email_words(p_body);
  v_subject := case p_kind
    when 'signup' then case when v_lang = 'fr' then 'Merci de votre inscription chez Welfare Avenue' else 'Thanks for signing up with Welfare Avenue' end
    when 'reminder' then case when v_lang = 'fr' then 'Un rappel pour votre prochain service' when v_meal then 'A reminder for your next Welfare Avenue event' else 'A reminder for your next serving' end
    when 'checkin' then case when v_lang = 'fr' then 'À bientôt chez Welfare Avenue' else 'See you soon at Welfare Avenue' end
    else case when v_lang = 'fr' then 'Comment ça s''est passé?' else 'How did it go?' end end;
  v_button := case when p_kind = 'survey' then case when v_lang = 'fr' then 'Donner mon avis' else 'Share my feedback' end
                   else case when v_lang = 'fr' then 'Ouvrir ma page' else 'Open my page' end end;
  v_key := case when v_lang = 'fr' then 'volunteer_update_fr' else 'volunteer_update' end;
  update public.event_roster set detail = coalesce(detail, '{}'::jsonb) || jsonb_build_object('emailed_' || p_kind || '_at', now()) where id = p_roster;
  perform public.call_edge('mail-send', jsonb_build_object('action', 'send', 'template_key', v_key,
    'contact_id', (public.wa182_roster_email(p_roster)->>'contact_id')::bigint, 'reply_to', public.wa297_reply_to(r.event_id, r.role),
    'vars', jsonb_build_object('subject_line', v_subject, 'button', v_button, 'confirm_url', v_link, 'extra_text', v_msg,
      'extra_html', '<p>' || replace(replace(v_msg, '&', '&amp;'), '<', '&lt;') || '</p>')));
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('event_roster', p_roster::text, 'email_' || p_kind, null, 'the same words as the text, by email (channel both)', 'wave297');
  return true;
end $$;
comment on function public.wa297_email_copy(bigint, text, text) is 'wave297: sends the words of a volunteer text by email too (channel both), once per roster row and kind (detail emailed_<kind>_at; confirm uses wa266_confirm_email). Called by wa266f_by_email. Internal.';

-- ---------- the by-email trigger follows the channel ----------
create or replace function public.wa266f_by_email()
 returns trigger language plpgsql security definer set search_path to '' as $function$
declare v_ch text; v_mail boolean; v_phone boolean;
begin
  if new.direction <> 'out' or new.status <> 'queued' or new.roster_id is null
     or new.kind not in ('confirm', 'signup', 'reminder', 'checkin', 'survey') then return new; end if;
  -- wave297: the event's channel (city switches), not the global texts_by_email switch
  v_ch := public.wa297_channel(new.event_id);
  v_phone := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g') <> '';
  if v_phone and v_ch in ('text', 'none') then return new; end if;
  v_mail := public.wa297_email_ok(new.roster_id);
  if v_phone and v_ch = 'both' then
    if v_mail and not (new.kind = 'confirm' and exists (select 1 from public.event_roster x where x.id = new.roster_id and coalesce(x.detail, '{}'::jsonb) ? 'confirm_emailed_at')) then
      begin perform public.wa297_email_copy(new.roster_id, new.kind, new.body); exception when others then raise warning 'wave297 email copy: %', sqlerrm; end;
    end if;
    return new;
  end if;
  if not v_mail then return new; end if;   -- no email address: it stays a text (or goes nowhere without a phone: quo-send fails it)
  new.status := 'sent'; new.sent_at := now(); new.delivery := 'email_pending';
  return new;
end $function$;

do $$
declare d text;
begin
  -- ---------- confirmations ----------
  d := pg_get_functiondef('public.wa171_queue_confirms(bigint,bigint[],text)'::regprocedure);
  d := pg_temp.sub(d, $a$coalesce(nullif(e.confirm_channels, ''), (select value from public.app_config where key = 'confirm_channels_default'), 'text') as ch   -- wave266e$a$,
                      $a$public.wa297_channel(e.id) as ch   -- wave297 (was wave266e's confirm_channels)$a$);
  d := pg_temp.sub(d, $a$where e.kind = 'service' and e.status not in ('cancelled', 'completed') and e.event_date > v_today$a$,
                      $a$where e.kind in ('service', 'meal') and e.status not in ('cancelled', 'completed') and e.event_date > v_today   -- wave297: Toronto too$a$);
  d := pg_temp.sub(d, $a$    if r.ch in ('email', 'both') and public.wa266_confirm_email(r.id, 'serving set to ' || r.ch) then n_mail := n_mail + 1; end if;
    if r.ch = 'email' or (r.ch = 'text' and r.emailed) then n_done := n_done + 1; continue; end if;$a$,
                      $a$    -- wave297: none = no automatic message (Send now sets the channel); email goes as a text the trigger turns into an
    -- email, so the Text log shows it; both emails here and texts below; someone already emailed is not emailed again
    if r.ch = 'none' then continue; end if;
    if r.ch = 'both' and not r.emailed and public.wa266_confirm_email(r.id, 'channel both') then n_mail := n_mail + 1; end if;
    if r.emailed and r.ch in ('text', 'email') then n_done := n_done + 1; continue; end if;$a$);
  d := pg_temp.sub(d, $a$      if v_fb and public.wa266_confirm_email(r.id, 'no phone number') then n_mail := n_mail + 1; end if;   -- wave266e$a$,
                      $a$      if (v_fb or r.ch in ('email', 'both')) and public.wa266_confirm_email(r.id, 'no phone number') then n_mail := n_mail + 1; end if;   -- wave266e, wave297$a$);
  d := pg_temp.sub(d, $a$    if public.wa171_opted_out(r.person_id, v_phone) then n_skip_out := n_skip_out + 1; continue; end if;$a$,
                      $a$    if public.wa171_opted_out(r.person_id, v_phone) then
      n_skip_out := n_skip_out + 1;
      if r.ch in ('email', 'both') and public.wa266_confirm_email(r.id, 'texts stopped, email on') then n_mail := n_mail + 1; end if;   -- wave297: STOP stops texts, not emails
      continue;
    end if;$a$);
  execute d;

  -- ---------- reminders and check-ins ----------
  d := pg_temp.sub(pg_get_functiondef('public.wa258_queue_nudges(bigint)'::regprocedure),
                   $a$foreach k in array array['reminder', 'checkin'] loop$a$,
                   $a$foreach k in array coalesce(nullif(string_to_array(nullif(current_setting('wa297.kinds', true), ''), ','), '{}'::text[]), array['reminder', 'checkin']) loop   -- wave297: Send now picks one$a$);
  d := pg_temp.sub(d, $a$if coalesce((select value from public.app_config where key = 'sms_' || k || '_on'), 'on') <> 'on' then$a$,
                      $a$if p_event is null and coalesce((select value from public.app_config where key = 'sms_' || k || '_on'), 'on') <> 'on' then$a$);
  d := pg_temp.sub(d, $a$where e.kind = 'service' and e.status not in ('cancelled', 'completed')$a$,
                      $a$where e.kind in ('service', 'meal') and e.status not in ('cancelled', 'completed')   -- wave297: Toronto too$a$);
  d := pg_temp.sub(d, $a$and coalesce(nullif(e.confirm_channels, ''), (select value from public.app_config where key = 'confirm_channels_default'), 'text') <> 'email'   -- wave266e$a$,
                      $a$and (p_event is not null or public.wa297_channel(e.id) <> 'none')   -- wave297: email events get their reminders too$a$);
  d := pg_temp.sub(d, $a$or exists (select 1 from public.quo_messages q where q.roster_id = er.id and q.direction = 'out' and q.kind in ('confirm', 'signup', 'recruit') and q.status = 'sent'))$a$,
                      $a$or coalesce(er.detail, '{}'::jsonb) ? 'confirm_emailed_at'   -- wave297: confirmed by email
              or exists (select 1 from public.quo_messages q where q.roster_id = er.id and q.direction = 'out' and q.kind in ('confirm', 'signup', 'recruit') and q.status = 'sent'))$a$);
  d := pg_temp.sub(d, $a$      if v_phone is null or public.wa171_opted_out(r.person_id, v_phone) or (v_mode = 'test' and not public.wa171_test_phone(v_phone)) then n_skip := n_skip + 1; continue; end if;$a$,
                      $a$      if v_phone is null and public.wa297_channel(r.event_id) in ('email', 'both') and public.wa297_email_ok(r.id) then
        v_phone := '';   -- wave297: no phone, but an email: the trigger sends it by email
      elsif v_phone is null or public.wa171_opted_out(r.person_id, v_phone) or (v_mode = 'test' and not public.wa171_test_phone(v_phone)) then n_skip := n_skip + 1; continue; end if;$a$);
  d := pg_temp.sub(d, $a$values (gen_random_uuid(), r.person_id, '+1' || v_phone, v_body, 'queued', r.event_id, 'automation', 'out', k, r.id)$a$,
                      $a$values (gen_random_uuid(), r.person_id, case when v_phone = '' then '' else '+1' || v_phone end, v_body, 'queued', r.event_id, coalesce(nullif(current_setting('wa297.by', true), ''), 'automation'), 'out', k, r.id)$a$);
  execute d;

  -- ---------- sign-up messages ----------
  d := pg_temp.sub(pg_get_functiondef('public.wa172_queue_signups()'::regprocedure),
                   $a$where e.kind = 'service' and e.status not in ('cancelled', 'completed') and e.event_date - v_today > v_days$a$,
                   $a$where e.kind in ('service', 'meal') and e.status not in ('cancelled', 'completed') and e.event_date - v_today > v_days
       and public.wa297_channel(e.id) <> 'none'   -- wave297$a$);
  d := pg_temp.sub(d, $a$'. See your servings and add them to your calendar: '$a$,
                      $a$'. See your ' || case when public.wa297_city(v_event) = 'toronto' then 'events' else 'servings' end || ' and add them to your calendar: '$a$);
  execute d;

  -- ---------- thank-you and survey ----------
  d := pg_temp.sub(pg_get_functiondef('public.wa172_queue_surveys()'::regprocedure),
                   $a$where e.kind = 'service' and e.status <> 'cancelled' and er.confirm_token is not null$a$,
                   $a$where e.kind in ('service', 'meal') and e.status <> 'cancelled' and er.confirm_token is not null and public.wa297_channel(e.id) <> 'none'   -- wave297$a$);
  execute d;

  -- ---------- the confirmation email ----------
  d := pg_temp.sub(pg_get_functiondef('public.wa266_confirm_email(bigint,text)'::regprocedure),
                   $a$if not found or r.kind <> 'service' or$a$, $a$if not found or r.kind not in ('service', 'meal') or$a$);
  d := pg_temp.sub(d, $a$'reply_to', public.wa258_role_owner(r.role),$a$, $a$'reply_to', public.wa297_reply_to(r.event_id, r.role),   -- wave297$a$);
  d := pg_temp.sub(d, $a$e.event_date, e.start_time, e.location, e.status as e_status, e.kind$a$,
                      $a$e.event_date, e.start_time, e.location, e.status as e_status, e.kind, e.id as event_id$a$);
  execute d;

  -- ---------- the email drain: Toronto's reply-to and words ----------
  d := pg_temp.sub(pg_get_functiondef('public.wa266f_email_drain(integer)'::regprocedure),
                   $a$select er.id, er.person_id, er.person_name, er.role, er.confirm_token, e.event_date, e.start_time, e.location into r$a$,
                   $a$select er.id, er.person_id, er.person_name, er.role, er.confirm_token, e.event_date, e.start_time, e.location, e.id as event_id, e.kind into r$a$);
  d := pg_temp.sub(d, $a$when 'reminder' then case when v_lang = 'fr' then 'Un rappel pour votre prochain service' else 'A reminder for your next serving' end$a$,
                      $a$when 'reminder' then case when v_lang = 'fr' then 'Un rappel pour votre prochain service' when r.kind = 'meal' then 'A reminder for your next Welfare Avenue event' else 'A reminder for your next serving' end$a$);
  d := pg_temp.sub(d, $a$'reply_to', public.wa258_role_owner(r.role), 'vars', v_vars)$a$, $a$'reply_to', public.wa297_reply_to(r.event_id, r.role), 'vars', v_vars)$a$);
  execute d;

  -- ---------- the words: Toronto events, Toronto cooks ----------
  d := pg_temp.sub(pg_get_functiondef('public.wa171_confirm_text(bigint,boolean)'::regprocedure),
                   $a$select er.id, er.person_id, er.person_name, er.role, er.confirm_token, e.event_date into r$a$,
                   $a$select er.id, er.person_id, er.person_name, er.role, er.confirm_token, e.event_date, e.kind into r$a$);
  d := pg_temp.sub(d, $a$' for our serving on ' || v_day
    || case when lower(r.role) = 'community_debrief' then '. Please read your Community lead briefing and confirm here: '
            when lower(r.role) = 'cook' then '. Choose your dish$a$,
                      $a$' for our ' || case when r.kind = 'meal' then 'Toronto event' else 'serving' end || ' on ' || v_day
    || case when lower(r.role) = 'community_debrief' then '. Please read your Community lead briefing and confirm here: '
            when lower(r.role) = 'cook' and r.kind = 'service' then '. Choose your dish$a$);
  execute d;

  d := pg_temp.sub(pg_get_functiondef('public.wa258_nudge_text(bigint,text)'::regprocedure),
                   $a$select er.id, er.person_id, er.person_name, er.role, er.status, er.confirm_status, er.confirm_token, e.event_date into r$a$,
                   $a$select er.id, er.person_id, er.person_name, er.role, er.status, er.confirm_status, er.confirm_token, e.event_date, e.kind into r$a$);
  d := pg_temp.sub(d, $a$'. Your time, place and details: ' || v_link || '. If something came up, call or text us right away at (438) 808-7754. Reply STOP to stop texts.'$a$,
                      $a$'. Your time, place and details: ' || v_link || '. If something came up, ' || case when r.kind = 'meal' then 'tell us right away at toronto@welfareavenue.com' else 'call or text us right away at (438) 808-7754' end || '. Reply STOP to stop texts.'$a$);
  execute d;

  d := pg_temp.sub(pg_get_functiondef('public.wa258_needs(bigint)'::regprocedure),
                   $a$select er.role, er.recipe_id, er.confirm, er.person_id into r from public.event_roster er where er.id = p_roster;$a$,
                   $a$select er.role, er.recipe_id, er.confirm, er.person_id, e.kind into r from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.id = p_roster;$a$);
  d := pg_temp.sub(d, $a$if lower(r.role) = 'cook' then$a$, $a$if lower(r.role) = 'cook' and r.kind = 'service' then   -- wave297: Toronto cooks cook in the kitchen$a$);
  execute d;

  -- ---------- the volunteer's page ----------
  d := pg_temp.sub(pg_get_functiondef('public.volunteer_confirm_get(text,boolean)'::regprocedure),
                   $a$if lower(r.role) = 'cook' then
    select coalesce(jsonb_agg$a$, $a$if lower(r.role) = 'cook' and r.kind = 'service' then   -- wave297: no recipe pick for Toronto cooks
    select coalesce(jsonb_agg$a$);
  d := pg_temp.sub(d, $a$'cook_pickup', case when lower(r.role) = 'cook' then$a$, $a$'cook_pickup', case when lower(r.role) = 'cook' and r.kind = 'service' then$a$);
  d := pg_temp.sub(d, $a$where o.person_id = r.person_id and e2.kind = 'service' and$a$, $a$where o.person_id = r.person_id and e2.kind in ('service', 'meal') and$a$);
  execute d;

  d := pg_temp.sub(pg_get_functiondef('public.volunteer_confirm_submit(text,jsonb)'::regprocedure),
                   $a$select er.id, er.status, er.confirm_status, er.role, er.person_name, e.id as event_id, e.event_date, e.status as ev_status into r$a$,
                   $a$select er.id, er.status, er.confirm_status, er.role, er.person_name, e.id as event_id, e.event_date, e.status as ev_status, e.kind into r$a$);
  d := pg_temp.sub(d, $a$v_to := public.wa258_texts_people() || coalesce(public.wa258_role_owner(r.role), '');$a$,
                      $a$v_to := case when r.kind = 'meal' then public.wa297_toronto_people() else public.wa258_texts_people() || coalesce(public.wa258_role_owner(r.role), '') end;   -- wave297$a$);
  d := pg_temp.sub(d, $a$'/#volunteering/e/' || r.event_id, 'cancel-' || r.id);$a$,
                      $a$case when r.kind = 'meal' then '/#toronto/e/' else '/#volunteering/e/' end || r.event_id, 'cancel-' || r.id);$a$);
  execute d;

  d := pg_temp.sub(pg_get_functiondef('public.wa258_round_notices()'::regprocedure),
                   $a$perform public.wa258_notify(public.wa258_texts_people(), v_title, v_body, '/#volunteering/e/' || x.event_id, 'texts-' || x.kind || '-' || x.event_id);$a$,
                   $a$perform public.wa258_notify(case when public.wa297_city(x.event_id) = 'toronto' then public.wa297_toronto_people() else public.wa258_texts_people() end, v_title, v_body,
      case when public.wa297_city(x.event_id) = 'toronto' then '/#toronto/e/' else '/#volunteering/e/' end || x.event_id, 'texts-' || x.kind || '-' || x.event_id);   -- wave297$a$);
  execute d;
end $$;

-- ---------- who may send and switch ----------
create or replace function public.wa297_can(p_city text) returns boolean
language sql stable security definer set search_path to '' as $$
  select coalesce(public.is_wa_staff(), false) and (coalesce(public.wa256_can_text(), false)
    or (p_city = 'toronto' and exists (select 1 from public.team_members m where m.active and m.department = 'opsto'
                                        and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')))))
$$;
comment on function public.wa297_can(text) is 'wave297: may this person send volunteer messages and change the automatic switches for a city: leaders, HR, admins and the text staff (wa256_can_text); for Toronto also the Toronto team (opsto).';

create or replace function public.wa297_auto_get() returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare o jsonb := '{}'::jsonb; c text;
begin
  if not coalesce(public.is_wa_staff(), false) then raise exception 'Staff only'; end if;
  foreach c in array array['montreal', 'toronto'] loop
    o := o || jsonb_build_object(c, jsonb_build_object(
      'texts', coalesce((select value from public.app_config where key = 'vol_auto_texts_' || c), 'off') = 'on',
      'emails', coalesce((select value from public.app_config where key = 'vol_auto_emails_' || c), 'off') = 'on',
      'can', public.wa297_can(c)));
  end loop;
  return o || jsonb_build_object('confirm_days', coalesce(nullif((select value from public.app_config where key = 'sms_confirm_days'), '')::int, 10),
    'reminder_days', coalesce(nullif((select value from public.app_config where key = 'sms_reminder_days'), '')::int, 6),
    'checkin_days', coalesce(nullif((select value from public.app_config where key = 'sms_checkin_days'), '')::int, 3),
    'hour', coalesce(nullif((select value from public.app_config where key = 'sms_confirm_hour'), '')::int, 10));
end $$;
comment on function public.wa297_auto_get() is 'wave297: the automatic texts and emails switches of both cities, whether the reader may change each, and the schedule days. Staff.';

create or replace function public.wa297_auto_set(p_city text, p_texts boolean, p_emails boolean) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare v_who text := coalesce(auth.jwt() ->> 'email', 'staff'); k text; v text; o text;
begin
  if p_city not in ('montreal', 'toronto') then raise exception 'Which city?'; end if;
  if not public.wa297_can(p_city) then raise exception 'Only the team that runs % volunteers can change this.', initcap(p_city); end if;
  foreach k in array array['texts', 'emails'] loop
    v := case when (case when k = 'texts' then p_texts else p_emails end) then 'on' else 'off' end;
    select value into o from public.app_config where key = 'vol_auto_' || k || '_' || p_city;
    if o is distinct from v then
      insert into public.app_config (key, value) values ('vol_auto_' || k || '_' || p_city, v) on conflict (key) do update set value = excluded.value;
      insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
      values ('app_config', 'vol_auto_' || k || '_' || p_city, 'value', o, v || ' (automatic ' || k || ', ' || initcap(p_city) || ')', v_who);
    end if;
  end loop;
  return public.wa297_auto_get();
end $$;
comment on function public.wa297_auto_set(text, boolean, boolean) is 'wave297: switch the automatic texts and emails of a city on or off (wa297_can), logged in change_log.';

create or replace function public.wa297_send_now(p_event bigint, p_kind text, p_channel text) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare e record; v_who text := coalesce(auth.jwt() ->> 'email', 'staff'); res jsonb; r record; v_phone text; v_body text; v_lang text; v_first text;
        v_base text; n int := 0; n_skip int := 0;
begin
  select id, event_date, status, kind, start_time into e from public.volunteer_events where id = p_event;
  if e.id is null then raise exception 'No such event.'; end if;
  if not public.wa297_can(public.wa297_city(e.id)) then raise exception 'Only the team that runs these volunteers can send this.'; end if;
  if p_kind not in ('confirm', 'reminder', 'checkin', 'thanks') then raise exception 'Which message?'; end if;
  if p_channel not in ('text', 'email', 'both') then raise exception 'By text, by email, or both?'; end if;
  if e.status = 'cancelled' then raise exception 'This event is cancelled.'; end if;
  if p_kind <> 'thanks' and e.event_date <= (now() at time zone 'America/Toronto')::date then raise exception 'This event is today or past: only the thank-you can go now.'; end if;
  perform set_config('wa297.channel', p_channel, true);
  perform set_config('wa297.by', v_who, true);
  if p_kind = 'confirm' then
    res := public.wa171_queue_confirms(e.id, null, v_who);
  elsif p_kind in ('reminder', 'checkin') then
    perform set_config('wa297.kinds', p_kind, true);
    res := public.wa258_queue_nudges(e.id);
  else
    v_base := coalesce(nullif((select value from public.app_config where key = 'sms_link_base'), ''), 'https://hub.welfareavenue.com/c/');
    for r in
      select er.id, er.person_id, er.person_name, er.confirm_token from public.event_roster er
       where er.event_id = e.id and er.confirm_token is not null and lower(coalesce(er.status, '')) = 'confirmed'
         and not exists (select 1 from public.quo_messages q where q.roster_id = er.id and q.direction = 'out' and q.kind = 'survey' and q.status in ('queued', 'sent', 'blocked'))
    loop
      v_phone := public.wa171_roster_phone(r.id);
      if v_phone is not null and public.wa171_opted_out(r.person_id, v_phone) then v_phone := null; end if;
      if v_phone is null then
        if p_channel in ('email', 'both') and public.wa297_email_ok(r.id) then v_phone := ''; else n_skip := n_skip + 1; continue; end if;
      end if;
      v_lang := public.wa171_lang(r.person_id);
      v_first := coalesce(nullif(split_part(trim(coalesce(r.person_name, '')), ' ', 1), ''), case when v_lang = 'fr' then 'bonjour' else 'there' end);
      v_body := case when v_lang = 'fr' then 'Merci d''avoir été là avec Welfare Avenue, ' || v_first || '! Comment ça s''est passé? Dites-le-nous en 2 minutes : ' || v_base || r.confirm_token
                     else 'Thank you for being there with Welfare Avenue, ' || v_first || '! How did it go? Tell us in 2 minutes: ' || v_base || r.confirm_token end;
      insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id)
      values (gen_random_uuid(), r.person_id, case when v_phone = '' then '' else '+1' || v_phone end, v_body, 'queued', e.id, v_who, 'out', 'survey', r.id)
      on conflict do nothing;
      if found then n := n + 1; end if;
    end loop;
    res := jsonb_build_object('queued', n, 'skipped', n_skip);
  end if;
  if exists (select 1 from public.quo_messages where event_id = e.id and direction = 'out' and status = 'queued') then
    perform public.call_edge('quo-send', '{"action":"drain"}'::jsonb);
  end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('volunteer_event', e.id::text, 'send_now_' || p_kind, p_channel, left(res::text, 400), v_who);
  return res || jsonb_build_object('kind', p_kind, 'channel', p_channel);
end $$;
comment on function public.wa297_send_now(bigint, text, text) is 'wave297: Send now on an event page: the confirmation, reminder, check-in or thank-you, by text, email or both, to the people who have not had it yet (each message once per person). Texts wait for 9 am to 7 pm; emails go within a minute. wa297_can for the event''s city; logged.';

-- grants: internal helpers for nobody; the three page calls for signed-in staff (each checks inside)
revoke execute on function public.wa297_city(bigint) from public, anon, authenticated;
revoke execute on function public.wa297_channel(bigint) from public, anon, authenticated;
revoke execute on function public.wa297_toronto_people() from public, anon, authenticated;
revoke execute on function public.wa297_reply_to(bigint, text) from public, anon, authenticated;
revoke execute on function public.wa297_email_ok(bigint) from public, anon, authenticated;
revoke execute on function public.wa297_email_copy(bigint, text, text) from public, anon, authenticated;
revoke execute on function public.wa297_can(text) from public, anon, authenticated;
revoke execute on function public.wa297_auto_get() from public, anon, authenticated;
revoke execute on function public.wa297_auto_set(text, boolean, boolean) from public, anon, authenticated;
revoke execute on function public.wa297_send_now(bigint, text, text) from public, anon, authenticated;
grant execute on function public.wa297_auto_get() to authenticated;
grant execute on function public.wa297_auto_set(text, boolean, boolean) to authenticated;
grant execute on function public.wa297_send_now(bigint, text, text) to authenticated;

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('release', 'wave297', 'wave297', null, 'Automatic texts and emails per city (vol_auto_texts_/vol_auto_emails_ montreal and toronto; Montreal emails on, texts off as before; Toronto emails on, texts off), Send now (wa297_send_now), Toronto events in the confirmations, reminders, check-ins, sign-ups and thank-yous in Toronto words, Tate and Sama told of cancellations. Undo: build/data/wa297_undo.sql.', 'wave297');

commit;
