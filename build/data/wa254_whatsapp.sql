-- wave254 (15/10/26): WhatsApp as a second channel next to Quo SMS, for serving reminders and "still in?" re-confirmations.
-- Steel, 14/10/26 (the Meta additions): "WhatsApp — reminders and re-confirm texts as a second channel next to Quo SMS
-- (quo-send, quo_messages): a whatsapp-send edge function using the Cloud API, message templates created via
-- POST /{WABA-id}/message_templates (they need Meta approval), and a wa_messages table. Build it against the test number;
-- production waits on Steel's three items" (a dedicated number, business verification, a payment method).
-- The table is named whatsapp_messages (not wa_messages): in this database the wa_ prefix means Welfare Avenue.
--
-- What this migration does:
--   1. whatsapp_messages: every WhatsApp message the Hub queues, sends or receives (templates out, the person's replies and
--      button taps in, our short thank-you after a reply), with Meta's delivery statuses.
--   2. crm_contacts.whatsapp_opt_out: STOP on WhatsApp stops WhatsApp (an SMS STOP stops WhatsApp too).
--   3. Settings, admin-only through wa_app_config_guard (the sms_ prefix): sms_whatsapp_mode off | test | live (off: nothing
--      is sent; test: only the numbers in sms_whatsapp_test_phones, which must also be added as test recipients in the Meta
--      app while the test number is used; live: everyone), sms_whatsapp_channel off | also (also: every confirmation and
--      "still in?" text queued for Quo is mirrored as a WhatsApp template), sms_whatsapp_phone_id (the sending number's id).
--      All start off: nothing is sent until Steel switches them.
--   4. trg_wa254_mirror on quo_messages (after insert): when the channel is "also" and the mode is not off, a queued
--      confirmation (kind confirm) or re-confirmation (kind reconfirm) is copied into whatsapp_messages as a template with
--      its parameters. It never stops the SMS: any error inside is swallowed.
--   5. wa254_inbound(p): a WhatsApp reply (text or button) from meta-events through whatsapp-send: stored, STOP honoured
--      always, YES / NO acted on (the serving confirmation through volunteer_confirm_submit, a "still in?" through
--      wa239_pool_answer) only in live mode or from a test phone in test mode, and a short thank-you queued on WhatsApp.
--   6. Cron wa-whatsapp-drain every 15 minutes: whatsapp-send drain, only while something is queued.

create table if not exists public.whatsapp_messages (
  id bigint generated always as identity primary key,
  batch_id uuid,
  person_id bigint,
  phone text not null,
  direction text not null default 'out',
  kind text not null,
  template text,
  lang text,
  params jsonb not null default '[]'::jsonb,
  body text,
  status text not null default 'queued',
  wamid text,
  error text,
  event_id bigint,
  roster_id bigint,
  pool_check_id bigint,
  quo_message_id bigint,
  sent_by text,
  handled text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  constraint whatsapp_messages_direction_chk check (direction in ('out', 'in')),
  constraint whatsapp_messages_kind_chk check (kind in ('confirm', 'reconfirm', 'ack', 'manual', 'test', 'inbound')),
  constraint whatsapp_messages_status_chk check (status in ('queued', 'sent', 'delivered', 'read', 'failed', 'skipped', 'received'))
);
create unique index if not exists whatsapp_messages_wamid_once on public.whatsapp_messages (wamid) where wamid is not null;
create unique index if not exists whatsapp_messages_quo_once on public.whatsapp_messages (quo_message_id) where quo_message_id is not null;
create index if not exists whatsapp_messages_phone_idx on public.whatsapp_messages (phone, created_at desc);
create index if not exists whatsapp_messages_status_idx on public.whatsapp_messages (status) where status = 'queued';
create index if not exists whatsapp_messages_person_idx on public.whatsapp_messages (person_id);
create index if not exists whatsapp_messages_roster_idx on public.whatsapp_messages (roster_id);
create index if not exists whatsapp_messages_event_idx on public.whatsapp_messages (event_id);
comment on table public.whatsapp_messages is 'wave254: every WhatsApp message the Hub queued, sent or received through the WhatsApp Cloud API (the second channel beside quo_messages): templates out (kind confirm, reconfirm, test), the person''s replies and button taps in (kind inbound), our thank-you after a reply (kind ack). Written by whatsapp-send and wa254_inbound with the service key, and by trg_wa254_mirror; read by staff. No foreign keys, as quo_messages (ids only).';
comment on column public.whatsapp_messages.phone is 'wave254: the number in E.164 (+1...).';
comment on column public.whatsapp_messages.template is 'wave254: the approved template''s name for an outbound template (wa_serving_reminder, wa_still_in, hello_world); null for free text (ack, manual) and inbound.';
comment on column public.whatsapp_messages.params is 'wave254: the template''s body parameters in order ({{1}}, {{2}}, ...).';
comment on column public.whatsapp_messages.body is 'wave254: the message as the person sees it (the template filled in, the free text, or the reply / button text received).';
comment on column public.whatsapp_messages.status is 'wave254: queued, sent, delivered, read, failed (error says why), skipped (mode off, not a test phone, opted out, no number) or received (inbound).';
comment on column public.whatsapp_messages.wamid is 'wave254: Meta''s message id (wamid...), how statuses find the row.';
comment on column public.whatsapp_messages.quo_message_id is 'wave254: the quo_messages row this template mirrors (trg_wa254_mirror), so a text is mirrored once.';
comment on column public.whatsapp_messages.pool_check_id is 'wave254: the volunteer_pool_checks row a reconfirm belongs to (wave239''s "still in?").';
comment on column public.whatsapp_messages.handled is 'wave254: what the Hub did with an inbound message: confirmed, declined, pool_yes, pool_no, opted_out, stored, question, unmatched.';
alter table public.whatsapp_messages enable row level security;
create policy whatsapp_messages_staff_read on public.whatsapp_messages for select to authenticated using (public.is_wa_staff());
grant select on public.whatsapp_messages to authenticated;

alter table public.crm_contacts add column if not exists whatsapp_opt_out boolean not null default false;
comment on column public.crm_contacts.whatsapp_opt_out is 'wave254: the person replied STOP on WhatsApp; whatsapp-send never messages them (sms_opt_out stops WhatsApp too).';

insert into public.app_config (key, value) values
  ('sms_whatsapp_mode', 'off'), ('sms_whatsapp_channel', 'off'), ('sms_whatsapp_test_phones', ''), ('sms_whatsapp_phone_id', '1442123962307619')
on conflict (key) do nothing;

-- role words for the templates
create or replace function public.wa254_role_words(p_role text, p_lang text default 'en')
 returns text language sql immutable set search_path to '' as $$
  select case when p_lang = 'fr' then
    case lower(coalesce(p_role, '')) when 'server' then 'serveur·se' when 'cook' then 'cuisinier·ère' when 'driver' then 'chauffeur·se'
      when 'photographer' then 'photographe' when 'videographer' then 'vidéaste' when 'dishwasher' then 'plongeur·se' when 'team_leader' then 'chef d''équipe'
      when 'community_debrief' then 'responsable communauté' when 'community_talker' then 'accueil communauté' else 'bénévole' end
  else
    case lower(coalesce(p_role, '')) when 'server' then 'a server' when 'cook' then 'a cook' when 'driver' then 'a driver'
      when 'photographer' then 'a photographer' when 'videographer' then 'a videographer' when 'dishwasher' then 'a dishwasher' when 'team_leader' then 'team leader'
      when 'community_debrief' then 'community lead' when 'community_talker' then 'community welcome' else 'a volunteer' end
  end;
$$;
comment on function public.wa254_role_words(text, text) is 'wave254: a roster role key in words for the WhatsApp templates (a server, a cook, team leader...; French: serveur·se, cuisinier·ère...).';

-- the mirror: a queued confirmation or "still in?" text for Quo becomes a WhatsApp template too
create or replace function public.wa254_mirror()
 returns trigger language plpgsql security definer set search_path to '' as $$
declare v_mode text; v_chan text; v_lang text; v_first text; v_role text; v_when text; r record; c record;
begin
  if new.direction <> 'out' or new.status <> 'queued' or new.kind not in ('confirm', 'reconfirm') then return new; end if;
  v_mode := coalesce((select value from public.app_config where key = 'sms_whatsapp_mode'), 'off');
  v_chan := coalesce((select value from public.app_config where key = 'sms_whatsapp_channel'), 'off');
  if v_mode = 'off' or v_chan <> 'also' then return new; end if;
  begin
    v_lang := coalesce(public.wa171_lang(new.person_id), 'en');
    v_first := nullif(split_part(trim(coalesce((select vp.full_name from public.volunteer_people vp where vp.id = new.person_id), '')), ' ', 1), '');
    if new.kind = 'confirm' then
      select er.role, ve.event_date, ve.start_time into r from public.event_roster er join public.volunteer_events ve on ve.id = er.event_id where er.id = new.roster_id;
      if r.event_date is null then return new; end if;
      v_when := public.wa171_date_words(r.event_date, v_lang) || case when r.start_time is not null then (case when v_lang = 'fr' then ' à ' || to_char(r.start_time, 'HH24"h"MI') else ' at ' || to_char(r.start_time, 'FMHH12:MI am') end) else '' end;
      insert into public.whatsapp_messages (batch_id, person_id, phone, kind, template, lang, params, body, event_id, roster_id, quo_message_id, sent_by)
      values (new.batch_id, new.person_id, new.phone, 'confirm', 'wa_serving_reminder', v_lang,
              jsonb_build_array(coalesce(v_first, case when v_lang = 'fr' then 'bonjour' else 'there' end), public.wa254_role_words(r.role, v_lang), v_when),
              null, new.event_id, new.roster_id, new.id, coalesce(new.sent_by, 'trg_wa254_mirror'));
    else
      select pc.id, pc.role into c from public.volunteer_pool_checks pc where pc.message_id = new.id order by pc.id desc limit 1;
      insert into public.whatsapp_messages (batch_id, person_id, phone, kind, template, lang, params, body, pool_check_id, quo_message_id, sent_by)
      values (new.batch_id, new.person_id, new.phone, 'reconfirm', 'wa_still_in', v_lang,
              jsonb_build_array(coalesce(v_first, case when v_lang = 'fr' then 'bonjour' else 'there' end), public.wa254_role_words(coalesce(c.role, 'volunteer'), v_lang)),
              null, c.id, new.id, coalesce(new.sent_by, 'trg_wa254_mirror'));
    end if;
  exception when others then
    -- the SMS must never fail because of WhatsApp
    return new;
  end;
  return new;
end $$;
comment on function public.wa254_mirror() is 'wave254: trigger on quo_messages: a queued confirmation (confirm) or "still in?" (reconfirm) text is copied into whatsapp_messages as the matching template (wa_serving_reminder or wa_still_in, in the person''s language), only while sms_whatsapp_mode is test or live and sms_whatsapp_channel is also. Errors never block the SMS.';
create or replace trigger trg_wa254_mirror after insert on public.quo_messages for each row execute function public.wa254_mirror();

-- a WhatsApp reply
create or replace function public.wa254_inbound(p jsonb)
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_phone text; v_digits text; v_text text; v_word text; v_mode text; v_act boolean; v_last record; v_pid bigint; v_id bigint; v_handled text;
        v_lang text; v_first text; v_reply text; v_tok text; v_btn text;
begin
  if not (session_user <> 'authenticator' or coalesce(auth.role(), '') = 'service_role') then raise exception 'not allowed'; end if;
  v_digits := public.wa171_digits(p->>'phone');
  if v_digits is null then return jsonb_build_object('handled', 'ignored'); end if;
  v_phone := '+1' || v_digits;
  v_text := left(coalesce(nullif(p->>'text', ''), p->>'button', ''), 2000);
  v_btn := lower(coalesce(p->>'button', ''));
  v_mode := coalesce((select value from public.app_config where key = 'sms_whatsapp_mode'), 'off');
  v_act := v_mode = 'live' or (v_mode = 'test' and exists (select 1 from public.app_config c, unnest(string_to_array(c.value, ',')) t(x)
                                                           where c.key = 'sms_whatsapp_test_phones' and public.wa171_digits(t.x) = v_digits));
  -- the last template we sent that number in the last 14 days
  select w.* into v_last from public.whatsapp_messages w
   where w.direction = 'out' and w.kind in ('confirm', 'reconfirm') and w.status in ('sent', 'delivered', 'read')
     and public.wa171_digits(w.phone) = v_digits and w.created_at > now() - interval '14 days'
   order by w.created_at desc limit 1;
  v_pid := coalesce(v_last.person_id, (select vp.id from public.volunteer_people vp where exists (select 1 from unnest(vp.phones) ph where public.wa171_digits(ph) = v_digits) order by vp.id limit 1));
  insert into public.whatsapp_messages (person_id, phone, direction, kind, body, status, wamid, event_id, roster_id, pool_check_id, sent_by, created_at)
  values (v_pid, v_phone, 'in', 'inbound', v_text, 'received', nullif(p->>'wamid', ''), v_last.event_id, v_last.roster_id, v_last.pool_check_id, 'whatsapp', coalesce((p->>'at')::timestamptz, now()))
  on conflict do nothing returning id into v_id;
  if v_id is null then return jsonb_build_object('handled', 'duplicate'); end if;

  v_word := upper(regexp_replace(split_part(trim(v_text), ' ', 1), '[^[:alpha:]]', '', 'g'));
  v_word := translate(v_word, 'ÊÉÈË', 'EEEE');
  if v_btn <> '' then
    v_word := case when v_btn ~ '(yes|oui|count me in|comptez|be there|serai)' then 'YES' when v_btn ~ '(can''t|cannot|not any more|plus maintenant|ne peux|no$|non$)' then 'NO' else v_word end;
  end if;
  if v_word in ('STOP', 'STOPALL', 'ARRET', 'ARRETER', 'UNSUBSCRIBE', 'DESABONNER') then
    update public.crm_contacts c set whatsapp_opt_out = true, updated_at = now()
     where c.merged_into is null and (c.volunteer_id = v_pid or exists (select 1 from unnest(c.phones) ph where public.wa171_digits(ph) = v_digits));
    v_handled := 'opted_out';
  elsif not v_act then
    v_handled := case when v_pid is null then 'unmatched' else 'stored' end;
  elsif v_word in ('YES', 'Y', 'YEP', 'YEAH', 'OUI', 'OK', 'OKAY', 'CONFIRM', 'CONFIRMED') and v_last.kind = 'confirm' and v_last.roster_id is not null then
    select er.confirm_token into v_tok from public.event_roster er where er.id = v_last.roster_id;
    if v_tok is not null then perform public.volunteer_confirm_submit(v_tok, jsonb_build_object('attending', 'yes', 'via', 'whatsapp')); end if;
    v_handled := 'confirmed';
  elsif v_word in ('NO', 'N', 'NON', 'NOPE') and v_last.kind = 'confirm' and v_last.roster_id is not null then
    select er.confirm_token into v_tok from public.event_roster er where er.id = v_last.roster_id;
    if v_tok is not null then perform public.volunteer_confirm_submit(v_tok, jsonb_build_object('attending', 'no', 'via', 'whatsapp')); end if;
    v_handled := 'declined';
  elsif v_word in ('YES', 'Y', 'YEP', 'YEAH', 'OUI', 'OK', 'OKAY', 'NO', 'N', 'NON', 'NOPE') and v_last.kind = 'reconfirm' and v_last.pool_check_id is not null then
    select pc.token into v_tok from public.volunteer_pool_checks pc where pc.id = v_last.pool_check_id and pc.answer is null;
    if v_tok is not null then perform public.wa239_pool_answer(v_tok, jsonb_build_object('answer', case when v_word in ('NO', 'N', 'NON', 'NOPE') then 'no' else 'yes' end, 'via', 'whatsapp')); end if;
    v_handled := case when v_word in ('NO', 'N', 'NON', 'NOPE') then 'pool_no' else 'pool_yes' end;
  elsif v_pid is null then
    v_handled := 'unmatched';
  else
    v_handled := 'question';
  end if;
  update public.whatsapp_messages set handled = v_handled where id = v_id;

  if v_handled in ('confirmed', 'declined', 'pool_yes', 'pool_no') then
    v_lang := coalesce(public.wa171_lang(v_pid), 'en');
    v_first := nullif(split_part(trim(coalesce((select vp.full_name from public.volunteer_people vp where vp.id = v_pid), '')), ' ', 1), '');
    v_reply := case v_handled
      when 'confirmed' then case when v_lang = 'fr' then 'Merci' || coalesce(' ' || v_first, '') || ', c''est confirmé. À bientôt!' else 'Thanks' || coalesce(' ' || v_first, '') || ', you''re confirmed. See you there!' end
      when 'declined' then case when v_lang = 'fr' then 'Merci de nous avoir prévenus' || coalesce(', ' || v_first, '') || '. Au plaisir de vous voir à un autre service!' else 'Thanks for letting us know' || coalesce(', ' || v_first, '') || '. We hope to see you at another serving!' end
      when 'pool_yes' then case when v_lang = 'fr' then 'Formidable, merci' || coalesce(' ' || v_first, '') || '! Nous vous écrirons pour les prochains services.' else 'Wonderful, thanks' || coalesce(' ' || v_first, '') || '! We''ll be in touch about the next servings.' end
      else case when v_lang = 'fr' then 'Merci de nous l''avoir dit' || coalesce(', ' || v_first, '') || '. La porte reste ouverte.' else 'Thanks for letting us know' || coalesce(', ' || v_first, '') || '. You''re welcome back any time.' end
    end;
    insert into public.whatsapp_messages (person_id, phone, direction, kind, lang, body, event_id, roster_id, pool_check_id, sent_by)
    values (v_pid, v_phone, 'out', 'ack', v_lang, v_reply, v_last.event_id, v_last.roster_id, v_last.pool_check_id, 'wa254_inbound');
  end if;
  return jsonb_build_object('handled', v_handled, 'message_id', v_id, 'ack', v_reply is not null);
end $$;
comment on function public.wa254_inbound(jsonb) is 'wave254: files a WhatsApp reply ({phone, text, button, wamid, at}) from whatsapp-send: stored in whatsapp_messages, STOP always honoured (crm_contacts.whatsapp_opt_out); YES / NO (or the template''s buttons) act on the last template sent to that number in 14 days (a serving confirmation through volunteer_confirm_submit, a "still in?" through wa239_pool_answer) only when sms_whatsapp_mode is live, or test and the number is a test phone; a thank-you is queued on WhatsApp. Service role only.';
revoke all on function public.wa254_inbound(jsonb) from public, anon, authenticated;
grant execute on function public.wa254_inbound(jsonb) to service_role;

select cron.schedule('wa-whatsapp-drain', '7,22,37,52 * * * *', $c$select public.call_edge('whatsapp-send', '{"action":"drain"}'::jsonb) where exists (select 1 from public.whatsapp_messages where status = 'queued')$c$);

-- wa254b (same day): the trigger function is not callable through the API (security advisor)
revoke all on function public.wa254_mirror() from public, anon, authenticated;
