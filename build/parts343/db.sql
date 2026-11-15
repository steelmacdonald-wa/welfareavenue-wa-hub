-- 14/11/26 - wave343 (WhatsApp for volunteers): the database part.
-- Steel, 14/11/26: "for the creating of groups for the volunteer events, allow this for the operations team to do and share the link
-- with the hub so that it could add confirmed volunteers to the group", and, asked how: a person presses Send (nothing automatic).
-- Meta cannot add anyone to a group (people join through the invite link), so the Hub sends confirmed volunteers the link.
--   1. crm_contacts.whatsapp_consent (+ source, at): express WhatsApp consent, ticked on a Hub form (crm_forms.consent.whatsapp).
--      Meta's rules: a business messages someone on WhatsApp only after they opt in, and a STOP always wins.
--   2. crm_form_apply: the WhatsApp box, the same guards as the text box (wave288 5b).
--   3. the consent log and the merge carry it.
--   4. wa343_wa_ok(person, phone): may this person get WhatsApp from us (consent, no STOP, not do-not-contact).
--   5. the confirmation mirror (wa254_mirror) now goes only to people who opted in.
--   6. whatsapp_messages.kind 'group_invite'; wa343_group_invite(event, send): the confirmed volunteers of an event with a WhatsApp
--      group link who opted in and have not had the link, queued as wa_group_invite when a person presses Send.
-- Nothing is sent by this file. WhatsApp stays as app_config sms_whatsapp_mode says (off on 14/11/26).

alter table public.crm_contacts add column if not exists whatsapp_consent text check (whatsapp_consent in ('express'));
alter table public.crm_contacts add column if not exists whatsapp_consent_source text;
alter table public.crm_contacts add column if not exists whatsapp_consent_at timestamptz;
comment on column public.crm_contacts.whatsapp_consent is 'wave343 (14/11/26): express WhatsApp consent (a ticked box on a Hub form). Only these contacts get WhatsApp messages; whatsapp_opt_out (a STOP) always wins.';

-- 3. the consent log: whatsapp_consent joins the watched columns
drop trigger if exists trg_wa281_consent_log on public.crm_contacts;
create trigger trg_wa281_consent_log after insert or update of email_status, email_consent, sms_opt_out, sms_consent, whatsapp_opt_out, whatsapp_consent, do_not_contact
  on public.crm_contacts for each row execute function public.crm_consent_log();
do $c$
declare d text := pg_get_functiondef('public.crm_consent_log'::regproc); o text := $o$'sms_consent', 'whatsapp_opt_out'] loop$o$;
begin
  if position('whatsapp_consent''' in d) > 0 then return; end if;
  if (length(d) - length(replace(d, o, ''))) / length(o) <> 1 then raise exception 'crm_consent_log: anchor not found once'; end if;
  execute replace(d, o, $n$'sms_consent', 'whatsapp_opt_out', 'whatsapp_consent'] loop$n$);
end $c$;

-- the merge keeps the consent of either record (a STOP still wins at send time)
do $m$
declare d text := pg_get_functiondef('public.crm_merge_contacts'::regproc);
        o text := $o$whatsapp_opt_out = coalesce(k.whatsapp_opt_out, false) or coalesce(d.whatsapp_opt_out, false)$o$;
begin
  if position('whatsapp_consent' in d) > 0 then return; end if;
  if (length(d) - length(replace(d, o, ''))) / length(o) <> 1 then raise exception 'crm_merge_contacts: anchor not found once'; end if;
  execute replace(d, o, o || $n$,
    whatsapp_consent = coalesce(k.whatsapp_consent, d.whatsapp_consent),
    whatsapp_consent_source = case when k.whatsapp_consent is null and d.whatsapp_consent is not null then d.whatsapp_consent_source else k.whatsapp_consent_source end,
    whatsapp_consent_at = case when k.whatsapp_consent is null and d.whatsapp_consent is not null then d.whatsapp_consent_at else k.whatsapp_consent_at end$n$);
end $m$;

-- 2. the form box (crm_forms.consent.whatsapp; form-submit v11 stores consent.whatsapp {asked, given})
do $f$
declare d text := pg_get_functiondef('public.crm_form_apply'::regproc);
        o text := $o$    update public.crm_contacts set sms_consent = 'express',
      sms_consent_source = 'Hub form: ' || f.slug || ' (' || to_char(s.created_at at time zone 'America/Toronto', 'DD Mon YYYY') || ')', sms_consent_at = s.created_at
    where id = v_cid;
  end if;
$o$;
begin
  if position('wave343' in d) > 0 then return; end if;
  if (length(d) - length(replace(d, o, ''))) / length(o) <> 1 then raise exception 'crm_form_apply: anchor not found once'; end if;
  execute replace(d, o, o || $n$
  -- 5c. wave343: the WhatsApp box (crm_forms.consent.whatsapp), the same guards as the text box above. whatsapp_opt_out is never touched.
  if coalesce((s.consent -> 'whatsapp' ->> 'given')::boolean, false)
     and (v_created or v_own or exists (
           select 1 from public.crm_contacts c
            where c.id = v_cid and not coalesce(c.whatsapp_opt_out, false) and not coalesce(c.do_not_contact, false)
              and (cardinality(coalesce(c.phones, '{}'::text[])) = 0
                   or (regexp_replace(coalesce(v_ph, ''), '\D', '', 'g') <> ''
                       and exists (select 1 from unnest(c.phones) x
                                    where right(regexp_replace(x, '\D', '', 'g'), 10) = right(regexp_replace(v_ph, '\D', '', 'g'), 10)))))) then
    perform set_config('wa.consent_source', 'form: ' || f.slug, true);
    perform set_config('wa.consent_words', coalesce(s.consent -> 'whatsapp' ->> 'asked', ''), true);
    update public.crm_contacts set whatsapp_consent = 'express',
      whatsapp_consent_source = 'Hub form: ' || f.slug || ' (' || to_char(s.created_at at time zone 'America/Toronto', 'DD Mon YYYY') || ')', whatsapp_consent_at = s.created_at
    where id = v_cid;
  end if;
$n$);
end $f$;

-- 4. may this person get WhatsApp from us
create or replace function public.wa343_wa_ok(p_person bigint, p_phone text)
returns boolean language sql stable security definer set search_path to '' as $w$
  select exists (
    select 1 from public.crm_contacts c
     where c.merged_into is null and c.whatsapp_consent is not null
       and not coalesce(c.whatsapp_opt_out, false) and not coalesce(c.do_not_contact, false)
       and ((p_person is not null and c.volunteer_id = p_person)
            or (public.wa171_digits(p_phone) is not null and exists (select 1 from unnest(coalesce(c.phones, '{}'::text[])) ph where public.wa171_digits(ph) = public.wa171_digits(p_phone)))))
  and not exists (select 1 from public.crm_contacts c
     where c.merged_into is null and coalesce(c.whatsapp_opt_out, false)
       and public.wa171_digits(p_phone) is not null and exists (select 1 from unnest(coalesce(c.phones, '{}'::text[])) ph where public.wa171_digits(ph) = public.wa171_digits(p_phone)));
$w$;
revoke all on function public.wa343_wa_ok(bigint, text) from public, anon, authenticated;
grant execute on function public.wa343_wa_ok(bigint, text) to service_role;

-- 5. the confirmation mirror: only people who opted in to WhatsApp
do $mi$
declare d text := pg_get_functiondef('public.wa254_mirror'::regproc);
        o text := $o$  if v_mode = 'off' or v_chan <> 'also' then return new; end if;$o$;
begin
  if position('wa343_wa_ok' in d) > 0 then return; end if;
  if (length(d) - length(replace(d, o, ''))) / length(o) <> 1 then raise exception 'wa254_mirror: anchor not found once'; end if;
  execute replace(d, o, o || $n$
  if not public.wa343_wa_ok(new.person_id, new.phone) then return new; end if;   -- wave343: WhatsApp only to people who opted in$n$);
end $mi$;

-- 6. the group invite
alter table public.whatsapp_messages drop constraint if exists whatsapp_messages_kind_chk;
alter table public.whatsapp_messages add constraint whatsapp_messages_kind_chk check (kind = any (array['confirm', 'reconfirm', 'ack', 'manual', 'test', 'inbound', 'group_invite']));

create or replace function public.wa343_group_invite(p_event bigint, p_send boolean default false)
returns jsonb language plpgsql security definer set search_path to '' as $g$
declare e record; r record; v_lang text; v_first text; v_when text; v_phone text; v_by text;
        n_q int := 0; n_had int := 0; n_noconsent int := 0; n_nophone int := 0; v_list jsonb := '[]'::jsonb;
begin
  if not coalesce(public.is_wa_staff(), false) then raise exception 'not allowed'; end if;
  v_by := coalesce(nullif(lower(coalesce(auth.jwt() ->> 'email', '')), ''), 'staff');
  select * into e from public.volunteer_events where id = p_event;
  if e.id is null then raise exception 'no such event'; end if;
  if coalesce(e.whatsapp_url, '') !~* '^https://(chat\.whatsapp\.com|wa\.me|whatsapp\.com)/' then
    return jsonb_build_object('ok', false, 'reason', 'Paste the WhatsApp group link first');
  end if;
  if e.status in ('cancelled', 'completed') then return jsonb_build_object('ok', false, 'reason', 'This event is ' || e.status); end if;
  for r in
    select er.id, er.person_id, er.person_name, er.role from public.event_roster er
     where er.event_id = p_event and er.status = 'Confirmed' order by er.sort nulls last, er.id
  loop
    if exists (select 1 from public.whatsapp_messages w where w.roster_id = r.id and w.kind = 'group_invite' and w.status in ('queued', 'sent', 'delivered', 'read')) then
      n_had := n_had + 1; continue;
    end if;
    v_phone := public.wa171_roster_phone(r.id);
    if v_phone is null then n_nophone := n_nophone + 1; continue; end if;
    if not public.wa343_wa_ok(r.person_id, v_phone) then n_noconsent := n_noconsent + 1; continue; end if;
    v_list := v_list || jsonb_build_object('roster_id', r.id, 'name', r.person_name, 'role', r.role);
    if p_send then
      v_lang := coalesce(public.wa171_lang(r.person_id), 'en');
      v_first := nullif(split_part(trim(coalesce((select vp.full_name from public.volunteer_people vp where vp.id = r.person_id), r.person_name, '')), ' ', 1), '');
      v_when := public.wa171_date_words(e.event_date, v_lang) || case when e.start_time is not null then (case when v_lang = 'fr' then ' à ' || to_char(e.start_time, 'HH24"h"MI') else ' at ' || to_char(e.start_time, 'FMHH12:MI am') end) else '' end;
      insert into public.whatsapp_messages (person_id, phone, kind, template, lang, params, body, event_id, roster_id, sent_by)
      values (r.person_id, '+1' || v_phone, 'group_invite', 'wa_group_invite', v_lang,
              jsonb_build_array(coalesce(v_first, case when v_lang = 'fr' then 'bonjour' else 'there' end), public.wa254_role_words(r.role, v_lang), v_when, e.whatsapp_url),
              null, p_event, r.id, v_by);
      n_q := n_q + 1;
    end if;
  end loop;
  if p_send and n_q > 0 then
    insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('volunteer_event', p_event::text, 'whatsapp group invite', null, n_q || ' confirmed volunteers sent the group link on WhatsApp', v_by);
  end if;
  return jsonb_build_object('ok', true, 'queued', n_q, 'ready', jsonb_array_length(v_list), 'people', v_list, 'already', n_had,
    'not_opted_in', n_noconsent, 'no_phone', n_nophone,
    'mode', coalesce((select value from public.app_config where key = 'sms_whatsapp_mode'), 'off'));
end $g$;
revoke all on function public.wa343_group_invite(bigint, boolean) from public, anon;
grant execute on function public.wa343_group_invite(bigint, boolean) to authenticated, service_role;
comment on function public.wa343_group_invite(bigint, boolean) is 'wave343 (14/11/26): the confirmed volunteers of an event with a WhatsApp group link who opted in to WhatsApp and have not had the link. p_send false: who would get it; true: queue wa_group_invite for them (a person pressed Send). Staff only.';

-- the event's WhatsApp messages for the Volunteer Manager rows (replies and what was sent), staff only
create or replace function public.wa343_event_whatsapp(p_event bigint)
returns table (roster_id bigint, direction text, kind text, body text, status text, at timestamptz, consent boolean)
language sql stable security definer set search_path to '' as $q$
  select w.roster_id, w.direction, w.kind, coalesce(w.body, w.template), w.status, coalesce(w.sent_at, w.created_at), null::boolean
    from public.whatsapp_messages w
   where coalesce(public.is_wa_staff(), false) and w.event_id = p_event and w.roster_id is not null
  union all
  select er.id, null, 'consent', null, null, null, public.wa343_wa_ok(er.person_id, public.wa171_roster_phone(er.id))
    from public.event_roster er where coalesce(public.is_wa_staff(), false) and er.event_id = p_event
  order by 6 nulls first;
$q$;
revoke all on function public.wa343_event_whatsapp(bigint) from public, anon;
grant execute on function public.wa343_event_whatsapp(bigint) to authenticated, service_role;
