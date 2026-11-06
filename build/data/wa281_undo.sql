-- Welfare Avenue Hub: wave281 undo, 06/11/26. Reverses build/data/wa281_rules.sql, in reverse order.
-- The seven patched functions, crm_contacts_v (with crm_contact_match, which takes its row type and must be dropped and recreated with it) and the
-- hub_roles_self_member policy come back exactly as live had them on 06/11/26 (pg_get_functiondef, pg_get_viewdef and pg_get_expr, read with the
-- Supabase connector; md5 of each definition in test/w281sql.mjs), with their live grants and comments. Then wave281's functions, triggers,
-- policies, views and grants are dropped.
-- What stays, as data only (Steel's rule: an undo never undoes opt-outs or consent, and evidence is not thrown away): the consent log
-- (crm_consent_events) and its rows, the do-not-contact flag with its reason, time and author, text consent with its source and date, and the chapters
-- (crm_chapters, crm_contact_chapters) with their rows. Nothing of wave281 acts on them any more, and no API role can read or write them (the append-only
-- guard goes, so the log's write rights go with it). Running build/data/wa281_rules.sql again brings back the functions, triggers, policies and grants
-- around them without duplicating a row.
-- What goes: birth dates, job titles, Campaigns and their people, gift and form campaign links, hub_roles.caps, the four custom fields and their
-- values, the organisation columns. Take a copy of anything set since the release before running it. Gifts, forms and contacts themselves are never
-- deleted. The release line in change_log stays; an undo line is added.
-- Comment statements here are indented on purpose: build/gen_data_model.py reads every file in build/data, and must keep reading the migration's text.
-- No transaction control (see the migration). Safe to run twice.

-- ============================================================================================ 1. the live functions back (live text, 06/11/26)
CREATE OR REPLACE FUNCTION public.crm_merge_contacts(p_keep bigint, p_drop bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  k public.crm_contacts%rowtype;
  d public.crm_contacts%rowtype;
  n_int int := 0; n_gift int := 0; n_hist int := 0; n_org int := 0;
  vol jsonb := null;
  who text := lower(coalesce(auth.jwt() ->> 'email', 'staff'));
begin
  if not (public.is_wa_staff() and (coalesce(public.wa_page_ok('crm'), true) or coalesce(current_setting('wa.merge_from_volunteers', true), '') = 'on')) then raise exception 'not allowed'; end if;
  if p_keep = p_drop then raise exception 'same contact'; end if;
  select * into k from public.crm_contacts where id = p_keep and merged_into is null;
  if not found then raise exception 'contact % is not in the CRM', p_keep; end if;
  select * into d from public.crm_contacts where id = p_drop and merged_into is null;
  if not found then raise exception 'contact % is not in the CRM', p_drop; end if;

  update public.crm_interactions set contact_id = p_keep where contact_id = p_drop; get diagnostics n_int = row_count;
  update public.crm_donations set contact_id = p_keep where contact_id = p_drop; get diagnostics n_gift = row_count;
  update public.crm_volunteer_history set contact_id = p_keep where contact_id = p_drop; get diagnostics n_hist = row_count;
  delete from public.crm_contact_orgs o where o.contact_id = p_drop
    and exists (select 1 from public.crm_contact_orgs x where x.contact_id = p_keep and x.partner_id = o.partner_id);
  update public.crm_contact_orgs set contact_id = p_keep where contact_id = p_drop; get diagnostics n_org = row_count;
  delete from public.crm_contact_fields cf where cf.contact_id = p_drop and exists (select 1 from public.crm_contact_fields x where x.contact_id = p_keep and x.field_id = cf.field_id);
  update public.crm_contact_fields set contact_id = p_keep where contact_id = p_drop;
  update public.crm_form_submissions set contact_id = p_keep where contact_id = p_drop;
  update public.crm_email_sends set contact_id = p_keep where contact_id = p_drop;
  delete from public.crm_automation_runs ar where ar.contact_id = p_drop and exists (select 1 from public.crm_automation_runs x where x.contact_id = p_keep and x.automation_id = ar.automation_id and x.run_key = ar.run_key);
  update public.crm_automation_runs set contact_id = p_keep where contact_id = p_drop;
  delete from public.crm_dupe_dismissals where a_id in (p_keep, p_drop) or b_id in (p_keep, p_drop);

  update public.crm_contacts set volunteer_id = null, member_id = null, auth_user_id = null where id = p_drop;

  update public.crm_contacts set
    emails = coalesce((select array_agg(x order by ord) from (select distinct on (lower(btrim(x))) btrim(x) as x, ord from unnest(coalesce(k.emails, '{}') || coalesce(d.emails, '{}')) with ordinality as t(x, ord) where btrim(coalesce(x, '')) <> '' order by lower(btrim(x)), ord) s), '{}'),
    phones = coalesce((select array_agg(x order by ord) from (select distinct on (btrim(x)) btrim(x) as x, ord from unnest(coalesce(k.phones, '{}') || coalesce(d.phones, '{}')) with ordinality as t(x, ord) where btrim(coalesce(x, '')) <> '' order by btrim(x), ord) s), '{}'),
    tags = coalesce((select array_agg(x order by ord) from (select distinct on (lower(btrim(x))) btrim(x) as x, ord from unnest(coalesce(k.tags, '{}') || coalesce(d.tags, '{}')) with ordinality as t(x, ord) where btrim(coalesce(x, '')) <> '' order by lower(btrim(x)), ord) s), '{}'),
    kinds = coalesce((select array_agg(x order by ord) from (select distinct on (x) x, ord from unnest(coalesce(k.kinds, '{}') || coalesce(d.kinds, '{}')) with ordinality as t(x, ord) where btrim(coalesce(x, '')) <> '' order by x, ord) s), '{}'),
    first_name = coalesce(nullif(k.first_name, ''), d.first_name),
    last_name = coalesce(nullif(k.last_name, ''), d.last_name),
    address = coalesce(nullif(k.address, ''), d.address),
    city = coalesce(nullif(k.city, ''), d.city),
    province = coalesce(nullif(k.province, ''), d.province),
    postal_code = coalesce(nullif(k.postal_code, ''), d.postal_code),
    country = coalesce(nullif(k.country, ''), d.country),
    language = coalesce(nullif(k.language, ''), d.language),
    email_status = case when k.email_status in ('unsubscribed', 'complained', 'bounced') then k.email_status
                        when d.email_status in ('unsubscribed', 'complained', 'bounced') then d.email_status else k.email_status end,
    email_consent = case when 'express' in (k.email_consent, d.email_consent) then 'express'
                         when 'implied' in (k.email_consent, d.email_consent) then 'implied' else coalesce(k.email_consent, d.email_consent) end,
    consent_source = case when k.email_consent = 'express' then k.consent_source when d.email_consent = 'express' then d.consent_source else coalesce(k.consent_source, d.consent_source) end,
    consent_at = greatest(k.consent_at, d.consent_at),
    implied_consent_until = greatest(k.implied_consent_until, d.implied_consent_until),
    sms_opt_out = coalesce(k.sms_opt_out, false) or coalesce(d.sms_opt_out, false),
    notes = case when coalesce(d.notes, '') = '' then k.notes when coalesce(k.notes, '') = '' then d.notes else k.notes || E'\n' || d.notes end,
    legacy_refs = coalesce(k.legacy_refs, '{}'::jsonb) || coalesce(d.legacy_refs, '{}'::jsonb) || jsonb_build_object('merged_contact_ids', coalesce(k.legacy_refs -> 'merged_contact_ids', '[]'::jsonb) || to_jsonb(p_drop)),
    member_id = coalesce(k.member_id, d.member_id),
    auth_user_id = coalesce(k.auth_user_id, d.auth_user_id),
    owner_member_id = coalesce(k.owner_member_id, d.owner_member_id),
    last_activity_at = greatest(k.last_activity_at, d.last_activity_at),
    volunteer_id = coalesce(k.volunteer_id, d.volunteer_id),
    updated_by = who
  where id = p_keep;

  if k.volunteer_id is not null and d.volunteer_id is not null and k.volunteer_id <> d.volunteer_id then
    vol := public.volunteer_merge(k.volunteer_id, d.volunteer_id);
  end if;

  update public.crm_contacts set merged_into = p_keep, updated_by = who where id = p_drop;
  begin
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('crm_contact', p_keep::text, 'merged', d.full_name || ' (#' || p_drop || ')', k.full_name || ' (+' || (n_int + n_gift + n_hist + n_org) || ' rows of history)', who);
  exception when others then null; end;
  return jsonb_build_object('ok', true, 'keep', p_keep, 'drop', p_drop, 'interactions', n_int, 'donations', n_gift, 'history', n_hist, 'organizations', n_org, 'volunteers', vol);
end $function$
;
revoke all on function public.crm_merge_contacts(bigint, bigint) from public, anon;
grant execute on function public.crm_merge_contacts(bigint, bigint) to authenticated, service_role;
  comment on function public.crm_merge_contacts(bigint, bigint) is 'Keep one contact and merge the other into it: the history, gifts, old website history and organizations move, the lists join up, the copy fills the gaps in the details, two volunteer records become one (volunteer_merge). Staff with the CRM page; logged in change_log.';

CREATE OR REPLACE FUNCTION public.wa_app_config_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare k text := coalesce(new.key, old.key);
begin
  if (k like 'mail\_%' or k like 'receipt\_%' or k like 'donate\_%' or k like 'loom\_%' or k like 'sms\_%' or k like 'cert\_%'
      or k in ('dashboard_people', 'page_gate', 'page_gate_exempt', 'page_gate_map'))
     and coalesce(auth.role(), '') = 'authenticated' and not coalesce(public.is_wa_admin(), false) then
    raise exception 'Only an admin can change % (email, receipt, donation page, Loom pull, text, certificate, Dashboard and page tour settings).', k;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $function$
;
revoke all on function public.wa_app_config_guard() from public, anon, authenticated;
grant execute on function public.wa_app_config_guard() to service_role;
  comment on function public.wa_app_config_guard() is 'Trigger on app_config: only admins (or the service role) change the mail_, receipt_, donate_, loom_, sms_ and cert_ settings and, since wave260, dashboard_people, page_gate, page_gate_exempt and page_gate_map. Other staff keep their existing app_config rights.';

CREATE OR REPLACE FUNCTION public.wa171_inbound(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_phone text; v_text text; v_word text; v_mode text; v_pid bigint; v_row record; v_id bigint; v_handled text; v_lang text; v_first text; v_reply text; v_act boolean;
begin
  v_phone := public.wa171_digits(p->>'phone');
  v_text := left(coalesce(p->>'text', ''), 2000);
  if v_phone is null then return jsonb_build_object('handled', 'ignored'); end if;
  v_mode := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  -- the volunteer: the person with that number who has the nearest upcoming serving, else anyone with it
  select r.id as roster_id, r.person_id, r.person_name, r.event_id, r.status, r.confirm_status, r.confirm_token, e.event_date into v_row
    from public.event_roster r join public.volunteer_events e on e.id = r.event_id
    join public.volunteer_people vp on vp.id = r.person_id
   where exists (select 1 from unnest(vp.phones) ph where public.wa171_digits(ph) = v_phone)
     and e.kind = 'service' and e.status not in ('cancelled', 'completed') and e.event_date >= (now() at time zone 'America/Toronto')::date
     and lower(coalesce(r.status, '')) <> 'cancelled'
   order by (r.confirm_status is null and lower(coalesce(r.status, '')) not in ('confirmed', 'unavailable') and exists (select 1 from public.quo_messages q where q.roster_id = r.id and q.kind in ('confirm', 'recruit') and q.status = 'sent')) desc, (exists (select 1 from public.quo_messages q where q.roster_id = r.id and q.kind in ('confirm', 'recruit') and q.status = 'sent')) desc, e.event_date, r.id
   limit 1;
  v_pid := v_row.person_id;
  if v_pid is null then
    select vp.id into v_pid from public.volunteer_people vp where exists (select 1 from unnest(vp.phones) ph where public.wa171_digits(ph) = v_phone) order by vp.id limit 1;
  end if;
  insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id, quo_id, created_at)
  values (gen_random_uuid(), v_pid, '+1' || v_phone, v_text, 'received', v_row.event_id, 'quo-events', 'in', 'inbound', v_row.roster_id,
          nullif(p->>'quo_id', ''), coalesce((p->>'at')::timestamptz, now()))
  on conflict do nothing returning id into v_id;
  if v_id is null then return jsonb_build_object('handled', 'duplicate'); end if;

  v_act := v_mode = 'live' or (v_mode = 'test' and public.wa171_test_phone(v_phone));
  v_word := upper(regexp_replace(split_part(trim(v_text), ' ', 1), '[^[:alpha:]]', '', 'g'));
  v_word := translate(v_word, 'ÊÉÈË', 'EEEE');
  if v_word in ('STOP', 'STOPALL', 'ARRET', 'ARRETER', 'UNSUBSCRIBE', 'DESABONNER', 'END', 'QUIT', 'CANCEL') then
    -- an opt-out is always honoured, whatever the mode
    update public.crm_contacts c set sms_opt_out = true, updated_at = now()
     where c.merged_into is null and (c.volunteer_id = v_pid or exists (select 1 from unnest(c.phones) ph where public.wa171_digits(ph) = v_phone));
    v_handled := 'opted_out';
  elsif not v_act then
    v_handled := case when v_pid is null then 'unmatched' else 'stored' end;
  elsif v_word in ('START', 'UNSTOP') then
    update public.crm_contacts c set sms_opt_out = false, updated_at = now()
     where c.merged_into is null and (c.volunteer_id = v_pid or exists (select 1 from unnest(c.phones) ph where public.wa171_digits(ph) = v_phone));
    v_handled := 'opted_in';
  elsif v_word in ('YES', 'Y', 'YEP', 'YEAH', 'OUI', 'O', 'CONFIRM', 'CONFIRMED', 'CONFIRME', 'CONFIRMEE', 'OK', 'OKAY') and v_row.roster_id is not null then
    perform public.volunteer_confirm_submit(v_row.confirm_token, jsonb_build_object('attending', 'yes', 'via', 'reply'))
      where v_row.confirm_token is not null;
    if v_row.confirm_token is null then
      update public.event_roster set status = 'Confirmed', confirm_status = 'confirmed', confirmed_at = now(), confirm = coalesce(confirm, '{}'::jsonb) || jsonb_build_object('attending', 'yes', 'via', 'reply', 'at', now()) where id = v_row.roster_id;
    end if;
    v_handled := 'confirmed';
  elsif v_word in ('NO', 'N', 'NON', 'NOPE') and v_row.roster_id is not null then
    if v_row.confirm_token is not null then
      perform public.volunteer_confirm_submit(v_row.confirm_token, jsonb_build_object('attending', 'no', 'via', 'reply'));
    else
      update public.event_roster set status = 'Unavailable', confirm_status = 'declined', confirmed_at = now(), confirm = coalesce(confirm, '{}'::jsonb) || jsonb_build_object('attending', 'no', 'via', 'reply', 'at', now()) where id = v_row.roster_id;
    end if;
    v_handled := 'declined';
  elsif v_word in ('YES', 'Y', 'YEP', 'YEAH', 'OUI', 'O', 'OK', 'OKAY', 'NO', 'N', 'NON', 'NOPE') and v_row.roster_id is null
        and exists (select 1 from public.volunteer_pool_checks c where c.phone = '+1' || v_phone and c.answer is null and c.created_at > now() - interval '30 days') then
    -- wave239: a "Still in?" text answered by a reply
    perform public.wa239_pool_answer((select c.token from public.volunteer_pool_checks c where c.phone = '+1' || v_phone and c.answer is null order by c.created_at desc limit 1),
                                     jsonb_build_object('answer', case when v_word in ('NO', 'N', 'NON', 'NOPE') then 'no' else 'yes' end, 'via', 'reply'));
    v_handled := case when v_word in ('NO', 'N', 'NON', 'NOPE') then 'pool_no' else 'pool_yes' end;
  elsif v_pid is null then
    v_handled := 'unmatched';
  else
    v_handled := 'question';
  end if;
  update public.quo_messages set handled = v_handled where id = v_id;

  if v_handled in ('pool_yes', 'pool_no') then
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
  if v_handled in ('confirmed', 'declined') then
    v_lang := public.wa171_lang(v_pid);
    v_first := nullif(split_part(trim(coalesce(v_row.person_name, '')), ' ', 1), '');
    if v_handled = 'confirmed' then
      v_reply := case when v_lang = 'fr' then 'Merci' || coalesce(' ' || v_first, '') || ', c''est confirmé pour le ' || public.wa171_date_words(v_row.event_date, 'fr') || '. À bientôt! Welfare Avenue'
                 else 'Thanks' || coalesce(' ' || v_first, '') || ', you''re confirmed for ' || public.wa171_date_words(v_row.event_date, 'en') || '. See you there! Welfare Avenue' end;
    else
      v_reply := case when v_lang = 'fr' then 'Merci de nous avoir prévenus' || coalesce(', ' || v_first, '') || '. Au plaisir de vous voir à un autre service! Welfare Avenue'
                 else 'Thanks for letting us know' || coalesce(', ' || v_first, '') || '. We hope to see you at another serving! Welfare Avenue' end;
    end if;
    insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id)
    values (gen_random_uuid(), v_pid, '+1' || v_phone, v_reply, 'queued', v_row.event_id, 'quo-events', 'out', 'ack', v_row.roster_id);
  end if;
  return jsonb_build_object('handled', v_handled, 'message_id', v_id, 'roster_id', v_row.roster_id, 'ack', v_reply is not null);
end $function$
;
revoke all on function public.wa171_inbound(jsonb) from public, anon, authenticated;
grant execute on function public.wa171_inbound(jsonb) to service_role;
  comment on function public.wa171_inbound(jsonb) is 'wave171: files an incoming text ({phone, text, quo_id, at}) in quo_messages (direction in, once per quo_id) matched to the volunteer and their next serving, then acts on keywords: STOP/ARRET always sets crm_contacts.sms_opt_out; while sms_mode is live (or test, for the test phones) YES/OUI confirms the roster row, NO/NON marks it Unavailable (both queue a short thank-you, kind ack), START opts back in; anything else is a question for the team (wave169b). Service role only (quo-events).';

CREATE OR REPLACE FUNCTION public.wa254_inbound(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;
revoke all on function public.wa254_inbound(jsonb) from public, anon, authenticated;
grant execute on function public.wa254_inbound(jsonb) to service_role;
  comment on function public.wa254_inbound(jsonb) is 'wave254: files a WhatsApp reply ({phone, text, button, wamid, at}) from whatsapp-send: stored in whatsapp_messages, STOP always honoured (crm_contacts.whatsapp_opt_out); YES / NO (or the template''s buttons) act on the last template sent to that number in 14 days (a serving confirmation through volunteer_confirm_submit, a "still in?" through wa239_pool_answer) only when sms_whatsapp_mode is live, or test and the number is a test phone; a thank-you is queued on WhatsApp. Service role only.';

CREATE OR REPLACE FUNCTION public.crm_refresh_implied_consent()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n_set int := 0; out jsonb;
begin
  if not (public.is_wa_admin() or auth.role() is null or auth.role() = 'service_role') then
    raise exception 'admins only';
  end if;
  with act as (
    select c.id,
      (select max(d.donated_at)::date from public.crm_donations d where d.contact_id = c.id) as last_gift,
      (select max(y.d) from (
         select e.event_date as d from public.event_roster r join public.volunteer_events e on e.id = r.event_id
           where c.volunteer_id is not null and r.person_id = c.volunteer_id and r.status = 'Confirmed' and e.status = 'completed'
         union all
         select h.event_at::date from public.crm_volunteer_history h where h.contact_id = c.id and h.attended) y) as last_serve
    from public.crm_contacts c
    where c.merged_into is null and coalesce(c.email_consent, 'none') <> 'express'
      and coalesce(c.email_status, 'unknown') not in ('unsubscribed', 'bounced', 'complained')
  ), calc as (
    select id, greatest(last_gift, last_serve) as last_act, last_gift, (greatest(last_gift, last_serve) + interval '2 years')::date as until_day
    from act where greatest(last_gift, last_serve) is not null
  ), upd as (
    update public.crm_contacts c
      set email_consent = 'implied', implied_consent_until = calc.until_day,
          consent_source = 'implied: ' || case when calc.last_act = calc.last_gift then 'gift on ' else 'volunteered on ' end || to_char(calc.last_act, 'YYYY-MM-DD') || ' (registered charity, CASL s.10(13))',
          updated_at = now(), updated_by = 'crm_refresh_implied_consent'
    from calc where c.id = calc.id
      and (c.email_consent is distinct from 'implied' or c.implied_consent_until is null or c.implied_consent_until < calc.until_day)
    returning c.id
  ) select count(*) into n_set from upd;
  select jsonb_build_object(
    'updated', n_set,
    'express', count(*) filter (where email_consent = 'express' and coalesce(email_status, 'unknown') not in ('unsubscribed', 'bounced', 'complained')),
    'implied', count(*) filter (where email_consent = 'implied' and implied_consent_until >= current_date and coalesce(email_status, 'unknown') not in ('unsubscribed', 'bounced', 'complained')),
    'implied_expired', count(*) filter (where email_consent = 'implied' and implied_consent_until < current_date and coalesce(email_status, 'unknown') not in ('unsubscribed', 'bounced', 'complained')),
    'unsubscribed', count(*) filter (where email_status in ('unsubscribed', 'complained')),
    'bounced', count(*) filter (where email_status = 'bounced'),
    'not_recorded', count(*) filter (where coalesce(email_consent, 'none') in ('none') and coalesce(email_status, 'unknown') not in ('unsubscribed', 'bounced', 'complained')),
    'ran_at', now())
    into out from public.crm_contacts where merged_into is null;
  return out;
end $function$
;
revoke all on function public.crm_refresh_implied_consent() from public, anon;
grant execute on function public.crm_refresh_implied_consent() to authenticated, service_role;
  comment on function public.crm_refresh_implied_consent() is 'Writes implied consent onto the contacts (wave154): every live contact who is not express, unsubscribed, bounced or complained and who gave or served within two years gets email_consent implied, implied_consent_until two years after that last gift or serving, and a consent_source that says so. Never shortens a consent recorded by the team. Admins (the Email tab) and the daily cron job wa-crm-consent run it; returns the counts.';

CREATE OR REPLACE FUNCTION public.wa171_opted_out(p_person bigint, p_phone text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.crm_contacts c where c.sms_opt_out and c.merged_into is null
                 and (c.volunteer_id = p_person or exists (select 1 from unnest(c.phones) ph where public.wa171_digits(ph) = public.wa171_digits(p_phone))));
$function$
;
revoke all on function public.wa171_opted_out(bigint, text) from public, anon, authenticated;
grant execute on function public.wa171_opted_out(bigint, text) to service_role;
  comment on function public.wa171_opted_out(bigint, text) is 'wave171: true when the volunteer (or anyone with that number) replied STOP or was marked no texts in the CRM (crm_contacts.sms_opt_out).';

CREATE OR REPLACE FUNCTION public.crm_email_permission(p_contact_id bigint, p_kind text DEFAULT 'newsletter'::text)
 RETURNS TABLE(allowed boolean, basis text, until date, email text, status text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  c record; last_gift date; last_serve date; last_act date; imp_until date; exemption text;
begin
  select x.id, coalesce(x.primary_email, x.emails[1]) as em, coalesce(x.email_status, 'unknown') as st, x.email_consent, x.consent_source, x.implied_consent_until, x.merged_into, x.volunteer_id
    into c from public.crm_contacts x where x.id = p_contact_id;
  if c.id is null then return query select false, 'no such contact', null::date, null::text, null::text; return; end if;
  if c.merged_into is not null then return query select false, 'merged into another contact', null::date, c.em::text, c.st::text; return; end if;
  if c.em is null or c.em = '' then return query select false, 'no email address', null::date, null::text, c.st::text; return; end if;
  if c.st in ('bounced', 'complained') then return query select false, c.st::text, null::date, c.em::text, c.st::text; return; end if;
  if p_kind = 'transactional' or p_kind = 'test' then return query select true, 'transactional: a confirmation, reminder or receipt, not a commercial message'::text, null::date, c.em::text, c.st::text; return; end if;
  if c.st = 'unsubscribed' then return query select false, 'unsubscribed'::text, null::date, c.em::text, c.st::text; return; end if;
  if c.email_consent = 'express' then
    return query select true, ('express consent' || coalesce(' (' || c.consent_source || ')', ''))::text, null::date, c.em::text, c.st::text; return;
  end if;
  /* a volunteer call-out goes to everyone with a working address who has not unsubscribed (Steel, 27/09/26: "Keela's way", opted in and unknown) */
  if p_kind = 'volunteer' then
    return query select true, 'volunteer message: not unsubscribed (the team''s rule since 27/09/26)'::text, null::date, c.em::text, c.st::text; return;
  end if;
  /* implied consent (CASL s.10(13)): a gift to, or volunteering for, a registered charity within the last two years */
  select max(d.donated_at)::date into last_gift from public.crm_donations d where d.contact_id = p_contact_id;
  select max(y.d) into last_serve from (
    select e.event_date as d from public.event_roster r join public.volunteer_events e on e.id = r.event_id
      where c.volunteer_id is not null and r.person_id = c.volunteer_id and r.status = 'Confirmed' and e.status = 'completed'
    union all
    select h.event_at::date from public.crm_volunteer_history h where h.contact_id = p_contact_id and h.attended
  ) y;
  last_act := greatest(last_gift, last_serve);
  if c.email_consent = 'implied' and c.implied_consent_until is not null then
    imp_until := greatest(c.implied_consent_until, (last_act + interval '2 years')::date);
  elsif last_act is not null then
    imp_until := (last_act + interval '2 years')::date;
  end if;
  if imp_until is not null and imp_until >= current_date then
    return query select true, ('implied consent until ' || to_char(imp_until, 'DD Mon YYYY') || case when last_act = last_gift then ' (gift on ' when last_act is not null then ' (volunteered on ' else ' (' end
      || coalesce(to_char(last_act, 'DD Mon YYYY'), coalesce(c.consent_source, 'recorded by the team')) || ')')::text, imp_until, c.em::text, c.st::text;
    return;
  end if;
  if p_kind = 'fundraising' then
    select value into exemption from public.app_config where key = 'mail_fundraising_exemption';
    if exemption = 'on' then
      return query select true, 'fundraising by a registered charity (CASL s.6 does not apply); no consent on file'::text, null::date, c.em::text, c.st::text; return;
    end if;
  end if;
  return query select false, (case when imp_until is not null then 'implied consent ran out on ' || to_char(imp_until, 'DD Mon YYYY') else 'no consent recorded' end)::text, imp_until, c.em::text, c.st::text;
end $function$
;
revoke all on function public.crm_email_permission(bigint, text) from public, anon;
grant execute on function public.crm_email_permission(bigint, text) to authenticated, service_role;
  comment on function public.crm_email_permission(bigint, text) is 'The CASL rule for one contact and one kind of message (wave154; the volunteer kind wave155b). transactional/test: any working address. volunteer: any working address that has not unsubscribed (Steel, 27/09/26). newsletter/fundraising: express consent, or implied consent within two years of a gift or a serving; fundraising also under the exemption setting. Bounced and complained get nothing.';

-- ============================================================================================ 2. hub_roles_self_member back to the live check
alter policy hub_roles_self_member on public.hub_roles with check ((email = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (email ~~ '%@welfareavenue.com'::text) AND (role = 'member'::text) AND (profile IS NULL) AND (tabs IS NULL));

-- ============================================================================================ 3. crm_contacts_v back to the live definition
-- crm_contact_match takes the view's row type, so it is dropped first and recreated after (live text). It has no dependants; crm_list_preview calls it
-- by name at run time.
drop function if exists public.crm_contact_match(public.crm_contacts_v, jsonb);
drop view if exists public.crm_contacts_v;
create view public.crm_contacts_v with (security_invoker = true) as   -- live stores true
 SELECT c.id,
    c.full_name,
    c.first_name,
    c.last_name,
    c.emails,
    c.phones,
    c.primary_email,
    c.address,
    c.city,
    c.province,
    c.postal_code,
    c.country,
    c.language,
    c.kinds,
    c.tags,
    c.source,
    c.volunteer_id,
    c.member_id,
    c.auth_user_id,
    c.legacy_refs,
    c.email_status,
    c.email_consent,
    c.consent_source,
    c.consent_at,
    c.implied_consent_until,
    c.sms_opt_out,
    c.notes,
    c.owner_member_id,
    c.last_activity_at,
    c.merged_into,
    c.created_at,
    c.updated_at,
    c.created_by,
    c.updated_by,
    vp.roles AS volunteer_roles,
    vp.tags AS volunteer_tags,
    vp.organization AS volunteer_organization,
    vp.last_applied,
    vp.needs_review AS volunteer_needs_review,
    vp.quo_contact_id IS NOT NULL AS in_quo,
    COALESCE(h.legacy_servings, 0::bigint) AS legacy_servings,
    COALESCE(h.legacy_hours, 0::numeric) AS legacy_hours,
    COALESCE(r.hub_servings, 0::bigint) AS hub_servings,
    r.last_serving_on,
    COALESCE(d.donation_total, 0::numeric) AS donation_total,
    COALESCE(d.donation_count, 0::bigint) AS donation_count,
    d.last_donation_at,
    o.org_names
   FROM public.crm_contacts c
     LEFT JOIN public.volunteer_people vp ON vp.id = c.volunteer_id
     LEFT JOIN LATERAL ( SELECT count(*) FILTER (WHERE x.attended AND x.volunteer_event_id IS NULL) AS legacy_servings,
            sum(x.hours) FILTER (WHERE x.attended) AS legacy_hours
           FROM public.crm_volunteer_history x
          WHERE x.contact_id = c.id) h ON true
     LEFT JOIN LATERAL ( SELECT count(*) AS hub_servings,
            max(e.event_date) AS last_serving_on
           FROM public.event_roster er
             JOIN public.volunteer_events e ON e.id = er.event_id
          WHERE c.volunteer_id IS NOT NULL AND er.person_id = c.volunteer_id AND er.status = 'Confirmed'::text AND e.status = 'completed'::text) r ON true
     LEFT JOIN LATERAL ( SELECT sum(x.amount) AS donation_total,
            count(*) AS donation_count,
            max(x.donated_at) AS last_donation_at
           FROM public.crm_donations x
          WHERE x.contact_id = c.id) d ON true
     LEFT JOIN LATERAL ( SELECT array_agg(p.name ORDER BY co.is_primary DESC, p.name) AS org_names
           FROM public.crm_contact_orgs co
             JOIN public.wa_partners p ON p.id = co.partner_id
          WHERE co.contact_id = c.id) o ON true
  WHERE c.merged_into IS NULL;
revoke all on table public.crm_contacts_v from public, anon, authenticated;
grant select, truncate, references, trigger, maintain on table public.crm_contacts_v to authenticated;   -- as live: rDxtm
grant all on table public.crm_contacts_v to service_role;
  comment on view public.crm_contacts_v is 'The live contacts (not merged) with their volunteer roles and tags, Hub servings (confirmed at completed events, the old website''s events included since wave 152), the old website''s servings not yet in the Hub and its recorded hours, gift totals and organization names. The CRM page reads this.';

CREATE OR REPLACE FUNCTION public.crm_contact_match(c public.crm_contacts_v, k jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  f text := k->>'f'; op text := coalesce(k->>'op', ''); v text := coalesce(k->>'v', ''); n numeric; r boolean; w text;
begin
  if f is null or f = '' then return true; end if;
  begin n := nullif(trim(v), '')::numeric; exception when others then n := null; end;
  if f = 'kind' then
    r := case v when 'donor' then ('donor' = any(coalesce(c.kinds, '{}')) or coalesce(c.donation_count, 0) > 0)
                when 'partner' then ('partner' = any(coalesce(c.kinds, '{}')) or coalesce(array_length(c.org_names, 1), 0) > 0)
                else v = any(coalesce(c.kinds, '{}')) end;
  elsif f = 'role' then r := v = any(coalesce(c.volunteer_roles, '{}')) or v = any(coalesce(c.volunteer_tags, '{}'));
  elsif f = 'tag' then r := exists (select 1 from unnest(coalesce(c.tags, '{}')) t where public.crm_fold(t) = public.crm_fold(v));
  elsif f = 'perm' then
    w := public.crm_perm_key(c.email_status, c.email_consent, c.implied_consent_until);
    r := w = v or (v = 'unsub' and w = 'bounced');
  elsif f = 'email' then r := coalesce(array_length(c.emails, 1), 0) > 0 or coalesce(c.primary_email, '') <> '';
  elsif f = 'served' then
    r := case op when 'never' then coalesce(c.hub_servings, 0) + coalesce(c.legacy_servings, 0) = 0
                 when 'within' then c.last_serving_on >= current_date - coalesce(n, 365)::int
                 when 'count_gte' then coalesce(c.hub_servings, 0) + coalesce(c.legacy_servings, 0) >= coalesce(n, 1)
                 else coalesce(c.hub_servings, 0) + coalesce(c.legacy_servings, 0) > 0 end;
  elsif f = 'gave' then
    r := case op when 'never' then coalesce(c.donation_count, 0) = 0
                 when 'within' then c.last_donation_at >= now() - make_interval(days => coalesce(n, 365)::int)
                 when 'lapsed' then c.last_donation_at < now() - make_interval(days => coalesce(n, 365)::int)
                 when 'total_gte' then coalesce(c.donation_total, 0) >= coalesce(n, 0)
                 when 'count_gte' then coalesce(c.donation_count, 0) >= coalesce(n, 1)
                 else coalesce(c.donation_count, 0) > 0 end;
  elsif f = 'city' then r := public.crm_fold(c.city) like '%' || public.crm_fold(v) || '%';
  elsif f = 'language' then r := lower(coalesce(c.language, '')) like lower(v) || '%';
  elsif f = 'source' then r := coalesce(c.source, '') = v;
  elsif f = 'added' then r := c.created_at >= now() - make_interval(days => coalesce(n, 30)::int);
  elsif f = 'active' then r := c.last_activity_at >= now() - make_interval(days => coalesce(n, 90)::int);
  elsif f = 'opened' then r := exists (select 1 from public.crm_email_sends s where s.contact_id = c.id and not s.is_test and s.opened_at >= now() - make_interval(days => coalesce(n, 90)::int));
  elsif f = 'clicked' then r := exists (select 1 from public.crm_email_sends s where s.contact_id = c.id and not s.is_test and s.clicked_at >= now() - make_interval(days => coalesce(n, 90)::int));
  elsif f = 'review' then r := coalesce(c.volunteer_needs_review, false);
  elsif f = 'search' then
    r := not exists (
      select 1 from unnest(string_to_array(public.crm_fold(trim(v)), ' ')) x
      where x <> '' and position(x in public.crm_fold(coalesce(c.full_name, '') || ' ' || array_to_string(coalesce(c.emails, '{}'), ' ') || ' ' || array_to_string(coalesce(c.phones, '{}'), ' ') || ' ' || coalesce(c.city, '') || ' ' || coalesce(c.volunteer_organization, '') || ' ' || array_to_string(coalesce(c.org_names, '{}'), ' ') || ' ' || array_to_string(coalesce(c.tags, '{}'), ' '))) = 0);
  else r := true;
  end if;
  r := coalesce(r, false);
  if op in ('not', 'none') then return not r; end if;
  return r;
end $function$
;
revoke all on function public.crm_contact_match(public.crm_contacts_v, jsonb) from public, anon;
grant execute on function public.crm_contact_match(public.crm_contacts_v, jsonb) to authenticated, service_role;
  comment on function public.crm_contact_match(public.crm_contacts_v, jsonb) is 'One list condition {f, op, v} against one contact (wave155b). Fields: kind, role, tag, perm, email, served (ever, never, within days, count_gte), gave (ever, never, within days, lapsed days, total_gte, count_gte), city, language, source, added (days), active (days), opened and clicked (a Hub email within days), review, search. op not/none negates.';

-- ============================================================================================ 4. organisations
drop policy if exists wa_partners_staff_insert on public.wa_partners;
alter table public.wa_partners drop column if exists goals;
alter table public.wa_partners drop column if exists keela_company_id;

-- ============================================================================================ 5. Campaigns: the form and gift links, the trigger, the tables
update public.crm_forms set settings = settings - 'campaign_id' where settings ->> 'campaign' = 'gift-basket-drive' and settings ? 'campaign_id';
drop trigger if exists trg_wa281_gift_campaign on public.crm_donations;
drop function if exists public.wa281_gift_campaign();
alter table public.crm_donations drop column if exists campaign_id;
drop function if exists public.crm_gift_campaign_id(text);
drop table if exists public.wa_campaign_people;
drop table if exists public.wa_campaigns;

-- ============================================================================================ 6. access (the policy is already back, so caps can go)
drop function if exists public.wa_my_caps();
drop function if exists public.wa_can(text);
alter table public.hub_roles drop column if exists caps;

-- ============================================================================================ 7. private data and fields
delete from public.crm_contact_fields where field_id in (select id from public.crm_fields where created_by = 'wave281' and key in ('linkedin', 'car_make_model', 'car_seats', 'food_licence'));
delete from public.crm_fields where created_by = 'wave281' and key in ('linkedin', 'car_make_model', 'car_seats', 'food_licence');
drop function if exists public.crm_age_band(bigint);
drop table if exists public.crm_contact_private;
alter table public.crm_contacts drop column if exists job_title;

-- ============================================================================================ 8. STOP
drop view if exists public.wa_stopped_phones_v;
drop index if exists public.quo_messages_wa281_keyword_idx;
drop index if exists public.whatsapp_messages_wa281_keyword_idx;

-- ============================================================================================ 9. do-not-contact (the flag, dnc_reason, dnc_at and dnc_by stay)
drop trigger if exists trg_wa281_dnc_hold on public.crm_contacts;
drop function if exists public.crm_dnc_hold();
drop function if exists public.crm_set_do_not_contact(bigint, text);

-- ============================================================================================ 10. the consent log (the table, its rows and the text-consent columns stay)
drop trigger if exists trg_wa281_consent_log on public.crm_contacts;
drop function if exists public.crm_consent_log();
do $t$ begin
  if to_regclass('public.crm_consent_events') is not null then
    drop trigger if exists trg_wa281_consent_guard on public.crm_consent_events;
    drop trigger if exists trg_wa281_consent_no_truncate on public.crm_consent_events;
    drop policy if exists crm_consent_events_staff_read on public.crm_consent_events;
    -- with the append-only guard gone, no API role keeps any right on the log, so it stays untouched (wave281's run gives them back)
    revoke all on table public.crm_consent_events from public, anon, authenticated, service_role;
    comment on table public.crm_consent_events is 'wave281, kept by its undo: the consent log and its rows, as data only. Nothing writes it and no API role can read or write it; running wa281_rules.sql again brings back its trigger, append-only guard, policy and grants.';
  end if;
end $t$;
drop function if exists public.crm_consent_guard();

-- ============================================================================================ 11. chapters (both tables and their rows stay)
drop function if exists public.crm_in_chapter(bigint, text);
drop function if exists public.crm_add_chapter(bigint, text, text, text);
do $t$ begin
  if to_regclass('public.crm_contact_chapters') is not null then
    drop policy if exists crm_contact_chapters_staff_read on public.crm_contact_chapters;
    drop policy if exists crm_contact_chapters_staff_insert on public.crm_contact_chapters;
    drop policy if exists crm_contact_chapters_staff_delete on public.crm_contact_chapters;
    revoke all on table public.crm_contact_chapters from public, anon, authenticated, service_role;
    comment on table public.crm_contact_chapters is 'wave281, kept by its undo: which chapter each person belongs to, with its evidence, as data only. No API role can read or write it; running wa281_rules.sql again brings back its functions, policies and grants.';
  end if;
  if to_regclass('public.crm_chapters') is not null then
    drop policy if exists crm_chapters_staff_read on public.crm_chapters;
    drop policy if exists crm_chapters_admin_write on public.crm_chapters;
    revoke all on table public.crm_chapters from public, anon, authenticated, service_role;
    comment on table public.crm_chapters is 'wave281, kept by its undo: the chapters (Montreal, Toronto) that crm_contact_chapters points to, as data only. No API role can read or write it; running wa281_rules.sql again brings back its policies and grants.';
  end if;
end $t$;

-- the undo record (once per release)
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave281', 'wave281 undo', null, 'wave281 undone: the CRM rules removed and the seven functions, crm_contacts_v and hub_roles_self_member back as live had them on 06/11/26. The consent log, do-not-contact, text consent and the chapter rows are kept as data.', 'wave281 undo'
 where not exists (select 1 from public.change_log u where u.entity_type = 'release' and u.entity_id = 'wave281' and u.field = 'wave281 undo'
                    and u.changed_at >= coalesce((select max(r.changed_at) from public.change_log r where r.entity_type = 'release' and r.entity_id = 'wave281' and r.field = 'wave281'), '-infinity'::timestamptz));
