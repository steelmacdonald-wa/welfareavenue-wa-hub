-- wa182_itineraries (30/09/26): itineraries that look like the Canva ones, sent by email and/or text, with a photo for the season.
-- Steel (30/09/26): "could you making them look as good as the ones in Canva. I want an easy function that allows us to send
-- them to our volunteers each event via email and/or text - there needs to be flexiblity. Also there should be a photo on
-- them depending on the time of the year/season".
-- What this adds:
--  1. per serving: the WhatsApp group link, a photo for its itinerary (else the season's), whether the itinerary goes by
--     itself the day before, and by text, email or both;
--  2. the season's photos (a hero and a band per season) and the storage bins, in volunteer_itinerary_settings;
--  3. volunteer_itinerary_sends: one row per person, channel and send (now or at a set time); the tick turns due rows into a
--     Quo text (quo_messages, kind itinerary) or an email (crm_email_sends, meta.source itinerary, sent by mail-send v4);
--  4. the itinerary on the volunteer's page as soon as it is sent to them (before: only the day before), and in a preview at any time;
--  5. the day-before automatic itinerary goes through the same rows, by the serving's channels.
-- The switches stay Steel's: sms_mode for texts, mail_mode for email. Nothing here changes either.

-- 1. the serving
alter table public.volunteer_events add column if not exists whatsapp_url text;
alter table public.volunteer_events add column if not exists itinerary_photo_id bigint references public.wa_photos(id) on delete set null;
alter table public.volunteer_events add column if not exists itinerary_auto boolean not null default true;
alter table public.volunteer_events add column if not exists itinerary_channels text not null default 'both';
alter table public.volunteer_events drop constraint if exists volunteer_events_itinerary_channels_check;
alter table public.volunteer_events add constraint volunteer_events_itinerary_channels_check check (itinerary_channels in ('text', 'email', 'both'));
alter table public.volunteer_events drop constraint if exists volunteer_events_whatsapp_url_check;
alter table public.volunteer_events add constraint volunteer_events_whatsapp_url_check check (whatsapp_url is null or whatsapp_url ~* '^https://(chat\.whatsapp\.com|wa\.me|whatsapp\.com)/');
comment on column public.volunteer_events.whatsapp_url is 'wave182: the serving''s WhatsApp group invite link (chat.whatsapp.com/...). Shown on every itinerary and in the itinerary text and email.';
comment on column public.volunteer_events.itinerary_photo_id is 'wave182: the photo at the top of this serving''s itineraries (a ready photo from the Photo library). Empty: the season''s photo (volunteer_itinerary_settings photo_<season>).';
comment on column public.volunteer_events.itinerary_auto is 'wave182: true: the itinerary goes by itself the day before (sms_itinerary_hour, Toronto) to everyone confirmed who has not had it yet.';
comment on column public.volunteer_events.itinerary_channels is 'wave182: how the automatic itinerary goes: text, email or both (each person by what we have for them).';

-- 2. the season's photos and the storage bins
insert into public.volunteer_itinerary_settings (key, value, updated_by) values
  ('photo_winter', '68', 'wa182'), ('band_winter', '14', 'wa182'),
  ('photo_spring', '48', 'wa182'), ('band_spring', '97', 'wa182'),
  ('photo_summer', '29', 'wa182'), ('band_summer', '83', 'wa182'),
  ('photo_autumn', '26', 'wa182'), ('band_autumn', '58', 'wa182'),
  ('bins', '[{"name_en":"Clean-up bin and volunteer belongings (2 bins in 1)","name_fr":"Bac de nettoyage et effets des bénévoles (2 bacs en 1)","items_en":"Gloves, paper towel, table wipes, garbage bags, masks, all-purpose cleaner, hand sanitizer, pinnies","items_fr":"Gants, essuie-tout, lingettes, sacs à ordures, masques, nettoyant tout usage, désinfectant pour les mains, dossards","photo":"photos/itinerary/bin-clean-up.jpg"},{"name_en":"Dinnerware bin","name_fr":"Bac de vaisselle","items_en":"Napkins, plates, bowls and lids, utensils, cups and lids","items_fr":"Serviettes, assiettes, bols et couvercles, ustensiles, verres et couvercles","photo":"photos/itinerary/bin-dinnerware.jpg"},{"name_en":"Coffee container and coffee","name_fr":"Contenant à café et café","items_en":"The big empty coffee container, and the packs of coffee beside it","items_fr":"Le grand contenant à café vide, et les paquets de café à côté","photo":"photos/itinerary/bin-coffee.jpg"},{"name_en":"Clean serving utensils bin","name_fr":"Bac d''ustensiles de service propres","items_en":"Clean spoons, tongs, spatulas and ladles for serving","items_fr":"Cuillères, pinces, spatules et louches propres pour servir","photo":""},{"name_en":"Clothes to donate bin","name_fr":"Bac de vêtements à donner","items_en":"Shoes and clothing to give away","items_fr":"Chaussures et vêtements à donner","photo":"photos/itinerary/bin-clothes.jpg"},{"name_en":"Utensils to donate bin","name_fr":"Bac d''ustensiles à donner","items_en":"Tongs, spatulas, ladles, spoons, can opener","items_fr":"Pinces, spatules, louches, cuillères, ouvre-boîte","photo":"photos/itinerary/bin-utensils.jpg"},{"name_en":"Dirty dishes bin","name_fr":"Bac de vaisselle sale","items_en":"For the dirty dishes after the serving","items_fr":"Pour la vaisselle sale après le service","photo":"photos/itinerary/bin-dirty-dishes.jpg"}]', 'wa182'),
  ('carry_en', E'The tent with our logo (at least 1)\nTables (3 at most)\nThe water jug\nThe speaker', 'wa182'),
  ('carry_fr', E'La tente avec notre logo (au moins 1)\nLes tables (3 au plus)\nLa cruche d''eau\nLe haut-parleur', 'wa182')
on conflict (key) do nothing;

-- the season of a date (Montreal): December to February winter, March to May spring, June to August summer, September to November autumn
create or replace function public.wa182_season(p_day date) returns text language sql immutable set search_path to '' as $$
  select case when extract(month from p_day) in (12, 1, 2) then 'winter' when extract(month from p_day) in (3, 4, 5) then 'spring'
              when extract(month from p_day) in (6, 7, 8) then 'summer' else 'autumn' end;
$$;
comment on function public.wa182_season(date) is 'wave182: the season of a serving''s date (December to February winter, March to May spring, June to August summer, September to November autumn).';

create or replace function public.wa182_photo(p_id bigint) returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('id', p.id, 'path', p.path_web, 'alt', coalesce(p.alt_text, p.title), 'fx', p.focal_x, 'fy', p.focal_y, 'season', p.season)
    from public.wa_photos p where p.id = p_id and p.status = 'ready' and p.usage = 'ready' and p.path_web is not null;
$$;
comment on function public.wa182_photo(bigint) is 'wave182: a ready photo (status and usage ready) as the itinerary page and email use it: path, alt text, focal point. Null when the photo is not ready.';

-- the look of a serving's itinerary: its season, the photo at the top and the band at the foot
create or replace function public.wa182_look(p_event bigint) returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare e record; v_season text; v_hero jsonb; v_band jsonb;
begin
  select id, event_date, itinerary_photo_id into e from public.volunteer_events where id = p_event;
  if not found then return null; end if;
  v_season := public.wa182_season(e.event_date);
  if e.itinerary_photo_id is not null then v_hero := public.wa182_photo(e.itinerary_photo_id); end if;
  if v_hero is null then v_hero := public.wa182_photo(nullif(public.wa174_set('photo_' || v_season), '')::bigint); end if;
  if v_hero is null then
    select public.wa182_photo(p.id) into v_hero from public.wa_photos p
     where p.season = v_season and p.status = 'ready' and p.usage = 'ready' and p.path_web is not null and coalesce(p.orientation, 'landscape') = 'landscape'
     order by p.is_pick desc, p.taken_on desc nulls last, p.id limit 1;
  end if;
  v_band := public.wa182_photo(nullif(public.wa174_set('band_' || v_season), '')::bigint);
  if v_band is null or (v_band->>'id') = (v_hero->>'id') then
    select public.wa182_photo(p.id) into v_band from public.wa_photos p
     where p.season = v_season and p.status = 'ready' and p.usage = 'ready' and p.path_web is not null and coalesce(p.orientation, 'landscape') = 'landscape'
       and p.id <> coalesce((v_hero->>'id')::bigint, 0)
     order by p.is_pick desc, p.taken_on desc nulls last, p.id limit 1;
  end if;
  return jsonb_build_object('season', v_season, 'hero', v_hero, 'band', coalesce(v_band, v_hero));
end $$;
comment on function public.wa182_look(bigint) is 'wave182: a serving''s itinerary look: its season, the hero photo (the serving''s own, else the season''s setting, else the best ready photo of that season) and the band photo at the foot.';

-- the itinerary, as wave174 builds it, plus the look, the WhatsApp link, the storage bins (team leaders and drivers)
create or replace function public.wa182_itinerary(p_roster bigint) returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare base jsonb; r record; v_bins jsonb;
begin
  select er.id, er.role, er.event_id, e.whatsapp_url, e.event_date, e.kitchen_contact, e.ingredients_note into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.id = p_roster;
  if not found then return null; end if;
  base := public.wa174_itinerary(p_roster);
  if base is null then return null; end if;
  if base->>'kind' = 'lead_driver' then
    begin v_bins := (public.wa174_set('bins'))::jsonb; exception when others then v_bins := '[]'::jsonb; end;
    base := base || jsonb_build_object('bins', coalesce(v_bins, '[]'::jsonb),
      'carry_en', to_jsonb(string_to_array(coalesce(public.wa174_set('carry_en'), ''), E'\n')),
      'carry_fr', to_jsonb(string_to_array(coalesce(public.wa174_set('carry_fr'), ''), E'\n')),
      'kitchen_contact', case when base->>'format' = 'community_kitchen' then r.kitchen_contact end,
      'ingredients_note', case when base->>'format' = 'community_kitchen' then r.ingredients_note end);
  end if;
  return base || jsonb_build_object('look', public.wa182_look(r.event_id), 'whatsapp_url', r.whatsapp_url, 'event_date', r.event_date,
    'sent', (select max(coalesce(s.done_at, s.created_at)) from public.volunteer_itinerary_sends s where s.roster_id = p_roster and s.status in ('queued', 'sent')),
    'updated', exists (select 1 from public.volunteer_itinerary_sends s where s.roster_id = p_roster and s.is_update and s.status in ('queued', 'sent')));
end $$;
comment on function public.wa182_itinerary(bigint) is 'wave182: wa174_itinerary plus the look (season and photos), the WhatsApp link, the storage bins and what to always carry (team leaders and drivers), the kitchen contact and ingredients (community kitchen), and when it was sent.';

-- 3. the sends
create table if not exists public.volunteer_itinerary_sends (
  id bigserial primary key,
  batch uuid not null default gen_random_uuid(),
  event_id bigint not null references public.volunteer_events(id) on delete cascade,
  roster_id bigint not null references public.event_roster(id) on delete cascade,
  channel text not null check (channel in ('text', 'email')),
  send_at timestamptz not null default now(),
  status text not null default 'scheduled' check (status in ('scheduled', 'queued', 'sent', 'failed', 'skipped', 'cancelled')),
  reason text,
  note text,
  is_update boolean not null default false,
  auto boolean not null default false,
  to_addr text,
  quo_message_id bigint references public.quo_messages(id) on delete set null,
  email_send_id bigint references public.crm_email_sends(id) on delete set null,
  created_by text,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists volunteer_itinerary_sends_event_idx on public.volunteer_itinerary_sends (event_id, created_at desc);
create index if not exists volunteer_itinerary_sends_due_idx on public.volunteer_itinerary_sends (send_at) where status = 'scheduled';
create index if not exists volunteer_itinerary_sends_roster_idx on public.volunteer_itinerary_sends (roster_id);
comment on table public.volunteer_itinerary_sends is 'wave182: each itinerary sent or scheduled for a volunteer: by text (a Quo text, quo_messages kind itinerary) or by email (crm_email_sends, meta.source itinerary, sent by mail-send v4). Written only by wa182_send_itineraries, wa182_auto_itineraries and wa182_itinerary_tick; staff read.';
comment on column public.volunteer_itinerary_sends.status is 'scheduled (waits for send_at), queued (handed to Quo or to mail-send), sent, failed, skipped (with the reason: texts off, test mode, no phone, no email, stopped texts, no permission), cancelled (by staff before it went).';
comment on column public.volunteer_itinerary_sends.is_update is 'true: sent as an updated itinerary ("your itinerary has changed").';
comment on column public.volunteer_itinerary_sends.auto is 'true: queued by the automatic day-before send.';
alter table public.volunteer_itinerary_sends enable row level security;
drop policy if exists volunteer_itinerary_sends_staff_read on public.volunteer_itinerary_sends;
create policy volunteer_itinerary_sends_staff_read on public.volunteer_itinerary_sends for select to authenticated using (public.is_wa_staff());
revoke all on public.volunteer_itinerary_sends from anon;
grant select on public.volunteer_itinerary_sends to authenticated;

-- quo_messages: one itinerary text per send now (an update can go again), so the old one-per-row guard goes
drop index if exists public.quo_messages_itinerary_once;

-- a volunteer's email: their CRM contact first, then the volunteer record, then what the roster row holds
create or replace function public.wa182_roster_email(p_roster bigint) returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('email', lower(coalesce(nullif(c.primary_email, ''), nullif(vp.emails[1], ''), nullif(er.detail->>'email', ''))), 'contact_id', coalesce(c.id, vp.contact_id))
    from public.event_roster er
    left join public.volunteer_people vp on vp.id = er.person_id
    left join public.crm_contacts c on c.id = vp.contact_id and c.merged_into is null
   where er.id = p_roster;
$$;
comment on function public.wa182_roster_email(bigint) is 'wave182: the email address for a roster row (the CRM contact''s, else the volunteer record''s, else the roster row''s detail) and the contact id.';

-- the text: the volunteer's own link, the role's start, the note, the WhatsApp group
create or replace function public.wa182_text_body(p_roster bigint, p_note text, p_update boolean) returns text language plpgsql stable security definer set search_path to '' as $$
declare r record; v_lang text; v_first text; v_t jsonb; v_hm text; v_base text; v_day text; v_link text; v_body text; v_role text;
  fr_days text[] := array['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  fr_months text[] := array['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
begin
  select er.id, er.person_id, er.person_name, er.confirm_token, er.role, e.event_date, e.whatsapp_url into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.id = p_roster;
  if not found or r.confirm_token is null then return null; end if;
  v_base := coalesce(nullif((select value from public.app_config where key = 'sms_link_base'), ''), 'https://hub.welfareavenue.com/c/');
  v_link := v_base || r.confirm_token || '?it=1';
  v_lang := public.wa171_lang(r.person_id);
  v_first := nullif(split_part(trim(coalesce(r.person_name, '')), ' ', 1), '');
  v_t := public.wa174_times(r.id); v_hm := v_t->>'start';
  v_role := public.wa171_role_label(r.role, v_lang);
  if v_lang = 'fr' then
    v_day := fr_days[extract(dow from r.event_date)::int + 1] || ' ' || extract(day from r.event_date)::int || case when extract(day from r.event_date) = 1 then 'er' else '' end || ' ' || fr_months[extract(month from r.event_date)::int];
    v_body := 'Bonjour' || coalesce(' ' || v_first, '') || ', ' || case when p_update then 'votre itinéraire du ' || v_day || ' a été mis à jour' else 'voici votre itinéraire pour le ' || v_day end
      || ' (' || lower(v_role) || ', début pour vous : ' || replace(replace(regexp_replace(v_hm, '^0', ''), ':', ' h '), ' h 00', ' h') || ') : ' || v_link;
    if nullif(trim(coalesce(p_note, '')), '') is not null then v_body := v_body || E'\n' || trim(p_note); end if;
    if r.whatsapp_url is not null then v_body := v_body || E'\nGroupe WhatsApp : ' || r.whatsapp_url; end if;
    v_body := v_body || E'\nRépondez STOP pour ne plus recevoir de textos.';
  else
    v_day := to_char(r.event_date, 'FMDay, FMMonth FMDD');
    v_body := 'Hi' || coalesce(' ' || v_first, '') || ', ' || case when p_update then 'your itinerary for ' || v_day || ' has been updated' else 'here is your itinerary for ' || v_day end
      || ' (' || lower(v_role) || ', you start at ' || lower(to_char(('2000-01-01 ' || v_hm)::timestamp, 'FMHH12:MI am')) || '): ' || v_link;
    if nullif(trim(coalesce(p_note, '')), '') is not null then v_body := v_body || E'\n' || trim(p_note); end if;
    if r.whatsapp_url is not null then v_body := v_body || E'\nWhatsApp group: ' || r.whatsapp_url; end if;
    v_body := v_body || E'\nReply STOP to stop texts.';
  end if;
  return v_body;
end $$;
comment on function public.wa182_text_body(bigint, text, boolean) is 'wave182: the itinerary text for a roster row (English or French by the contact''s language): the date, the role, when they start, their own link (?it=1 opens the itinerary), the team''s note, the WhatsApp group, STOP.';

-- the tick: due rows become a Quo text or a queued email; texts only 8 am to 8 pm Toronto
create or replace function public.wa182_itinerary_tick() returns jsonb language plpgsql security definer set search_path to '' as $$
declare s record; v_sms text; v_mail text; v_h int; v_phone text; v_body text; v_qid bigint; v_em jsonb; v_to text; v_perm record; v_eid bigint; v_tests text[];
  v_lang text; n_text int := 0; n_mail int := 0; n_skip int := 0; n_wait int := 0;
begin
  v_sms := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  v_mail := coalesce((select value from public.app_config where key = 'mail_mode'), 'test');
  v_tests := array(select lower(trim(x)) from unnest(regexp_split_to_array(coalesce((select value from public.app_config where key = 'mail_test_recipients'), ''), '[,;\s]+')) x where trim(x) <> '');
  v_h := extract(hour from now() at time zone 'America/Toronto');
  for s in
    select vis.*, er.person_id, er.person_name, er.confirm_token, er.status as r_status, er.confirm_status, e.status as e_status, e.event_date
      from public.volunteer_itinerary_sends vis join public.event_roster er on er.id = vis.roster_id join public.volunteer_events e on e.id = vis.event_id
     where vis.status = 'scheduled' and vis.send_at <= now()
     order by vis.send_at, vis.id
     for update of vis skip locked
  loop
    if s.e_status = 'cancelled' or lower(coalesce(s.r_status, '')) = 'cancelled' or s.event_date < (now() at time zone 'America/Toronto')::date then
      update public.volunteer_itinerary_sends set status = 'skipped', reason = 'the serving is past or cancelled', done_at = now() where id = s.id; n_skip := n_skip + 1; continue;
    end if;
    if s.confirm_token is null then update public.volunteer_itinerary_sends set status = 'skipped', reason = 'no link for this person', done_at = now() where id = s.id; n_skip := n_skip + 1; continue; end if;
    if s.channel = 'text' then
      if v_sms not in ('test', 'live') then update public.volunteer_itinerary_sends set status = 'skipped', reason = 'texts are off', done_at = now() where id = s.id; n_skip := n_skip + 1; continue; end if;
      if v_h < 8 or v_h >= 20 then n_wait := n_wait + 1; continue; end if;
      v_phone := public.wa171_roster_phone(s.roster_id);
      if v_phone is null then update public.volunteer_itinerary_sends set status = 'skipped', reason = 'no phone number', done_at = now() where id = s.id; n_skip := n_skip + 1; continue; end if;
      if public.wa171_opted_out(s.person_id, v_phone) then update public.volunteer_itinerary_sends set status = 'skipped', reason = 'they stopped texts', done_at = now() where id = s.id; n_skip := n_skip + 1; continue; end if;
      if v_sms = 'test' and not public.wa171_test_phone(v_phone) then update public.volunteer_itinerary_sends set status = 'skipped', reason = 'test mode: only the test phone gets texts', to_addr = v_phone, done_at = now() where id = s.id; n_skip := n_skip + 1; continue; end if;
      v_body := public.wa182_text_body(s.roster_id, s.note, s.is_update);
      insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id)
      values (s.batch, s.person_id, '+1' || v_phone, v_body, 'queued', s.event_id, coalesce(s.created_by, 'automation'), 'out', 'itinerary', s.roster_id)
      returning id into v_qid;
      update public.volunteer_itinerary_sends set status = 'queued', quo_message_id = v_qid, to_addr = v_phone, done_at = now() where id = s.id;
      n_text := n_text + 1;
    else
      v_em := public.wa182_roster_email(s.roster_id);
      v_to := v_em->>'email';
      if v_to is null or v_to !~ '^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$' then update public.volunteer_itinerary_sends set status = 'skipped', reason = 'no email address', done_at = now() where id = s.id; n_skip := n_skip + 1; continue; end if;
      if v_mail <> 'live' and not (v_to = any(v_tests)) then update public.volunteer_itinerary_sends set status = 'skipped', reason = 'test mode: only the test addresses get email', to_addr = v_to, done_at = now() where id = s.id; n_skip := n_skip + 1; continue; end if;
      if (v_em->>'contact_id') is not null then
        select * into v_perm from public.crm_email_permission((v_em->>'contact_id')::bigint, 'transactional') limit 1;
        if found and v_perm.allowed is false then update public.volunteer_itinerary_sends set status = 'skipped', reason = 'email: ' || coalesce(v_perm.basis, 'not allowed'), to_addr = v_to, done_at = now() where id = s.id; n_skip := n_skip + 1; continue; end if;
      end if;
      v_lang := public.wa171_lang(s.person_id);
      insert into public.crm_email_sends (contact_id, to_email, template_key, kind, status, is_test, permission_basis, meta, created_by)
      values ((v_em->>'contact_id')::bigint, v_to, 'volunteer_itinerary', 'transactional', 'queued', v_mail <> 'live', 'an itinerary for a serving they signed up for',
              jsonb_build_object('source', 'itinerary', 'itinerary_send_id', s.id, 'roster_id', s.roster_id, 'token', s.confirm_token, 'note', s.note, 'is_update', s.is_update, 'lang', v_lang),
              coalesce(s.created_by, 'automation'))
      returning id into v_eid;
      update public.volunteer_itinerary_sends set status = 'queued', email_send_id = v_eid, to_addr = v_to, done_at = now() where id = s.id;
      n_mail := n_mail + 1;
    end if;
  end loop;
  if n_text > 0 then perform public.call_edge('quo-send', '{"action":"drain"}'::jsonb); end if;
  if n_mail > 0 then perform public.call_edge('mail-send', '{"action":"campaign_pump"}'::jsonb); end if;
  return jsonb_build_object('texts', n_text, 'emails', n_mail, 'skipped', n_skip, 'waiting_for_8am', n_wait);
end $$;
comment on function public.wa182_itinerary_tick() is 'wave182: turns due itinerary sends into a Quo text (8 am to 8 pm Toronto, sms_mode test or live, the test phone only in test mode, never to someone who stopped texts) or a queued email (mail_mode live, or a test address in test mode; the CRM''s transactional permission), then wakes quo-send and mail-send. Cron wa-itinerary-tick.';

-- staff send (leaders, HR, admins): to the people picked, by text, email or both, now or at a set time
create or replace function public.wa182_send_itineraries(p_event bigint, p_roster bigint[], p_channel text, p_send_at timestamptz default null, p_note text default null, p_update boolean default false)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_who text; r record; v_batch uuid := gen_random_uuid(); v_at timestamptz; n int := 0; n_text int := 0; n_mail int := 0; v_none int := 0; v_tick jsonb; v_ph text; v_em text;
begin
  if not (public.is_wa_admin() or public.is_wa_leader() or public.wa_is_hr()) then raise exception 'Only leaders, HR and admins send itineraries'; end if;
  if p_channel not in ('text', 'email', 'both') then raise exception 'Choose text, email or both'; end if;
  if p_roster is null or array_length(p_roster, 1) is null then raise exception 'Pick at least one person'; end if;
  if p_note is not null and length(p_note) > 300 then raise exception 'The note is at most 300 characters'; end if;
  v_at := coalesce(p_send_at, now());
  if v_at < now() - interval '5 minutes' then v_at := now(); end if;
  v_who := coalesce((auth.jwt()->>'email'), 'staff');
  for r in select er.id, er.role from public.event_roster er where er.event_id = p_event and er.id = any(p_roster) and lower(coalesce(er.status, '')) <> 'cancelled' loop
    v_ph := public.wa171_roster_phone(r.id); v_em := public.wa182_roster_email(r.id)->>'email';
    if p_channel in ('text', 'both') and (v_ph is not null or p_channel = 'text') then
      insert into public.volunteer_itinerary_sends (batch, event_id, roster_id, channel, send_at, note, is_update, created_by) values (v_batch, p_event, r.id, 'text', v_at, nullif(trim(coalesce(p_note, '')), ''), coalesce(p_update, false), v_who);
      n_text := n_text + 1;
    end if;
    if p_channel in ('email', 'both') and (v_em is not null or p_channel = 'email') then
      insert into public.volunteer_itinerary_sends (batch, event_id, roster_id, channel, send_at, note, is_update, created_by) values (v_batch, p_event, r.id, 'email', v_at, nullif(trim(coalesce(p_note, '')), ''), coalesce(p_update, false), v_who);
      n_mail := n_mail + 1;
    end if;
    if p_channel = 'both' and v_ph is null and v_em is null then v_none := v_none + 1; end if;
    n := n + 1;
  end loop;
  insert into public.change_log (entity_type, entity_id, field, new_value, changed_by)
  values ('volunteer_event', p_event::text, 'itinerary_send', n || ' people, ' || n_text || ' texts and ' || n_mail || ' emails' || case when v_at > now() + interval '1 minute' then ', scheduled for ' || to_char(v_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') else ', now' end || case when p_update then ' (update)' else '' end, v_who);
  if v_at <= now() + interval '1 minute' then v_tick := public.wa182_itinerary_tick(); end if;
  return jsonb_build_object('batch', v_batch, 'people', n, 'texts', n_text, 'emails', n_mail, 'no_way_to_reach', v_none, 'send_at', v_at, 'tick', v_tick);
end $$;
comment on function public.wa182_send_itineraries(bigint, bigint[], text, timestamptz, text, boolean) is 'wave182: leaders, HR and admins send itineraries to the people they pick on a serving: by text, email or both (both: each way we have for the person), now or at a set time, with an optional note and as an update. Logged in change_log; sending now runs the tick at once.';

create or replace function public.wa182_cancel_itineraries(p_ids bigint[]) returns int language plpgsql security definer set search_path to '' as $$
declare n int;
begin
  if not (public.is_wa_admin() or public.is_wa_leader() or public.wa_is_hr()) then raise exception 'Only leaders, HR and admins change itinerary sends'; end if;
  update public.volunteer_itinerary_sends set status = 'cancelled', reason = 'cancelled by ' || coalesce(auth.jwt()->>'email', 'staff'), done_at = now()
   where id = any(p_ids) and status = 'scheduled';
  get diagnostics n = row_count;
  return n;
end $$;
comment on function public.wa182_cancel_itineraries(bigint[]) is 'wave182: cancels scheduled itinerary sends that have not gone yet (leaders, HR, admins).';

-- what each send became, for the event page
create or replace function public.wa182_itinerary_status(p_event bigint) returns table (id bigint, batch uuid, roster_id bigint, channel text, send_at timestamptz, status text, reason text, note text, is_update boolean, auto boolean, to_addr text, created_by text, created_at timestamptz, delivery text, delivered_at timestamptz, opened_at timestamptz)
language sql stable security definer set search_path to '' as $$
  select s.id, s.batch, s.roster_id, s.channel, s.send_at,
         case when s.status = 'queued' and s.channel = 'text' and q.status in ('sent', 'failed') then q.status
              when s.status = 'queued' and s.channel = 'email' and m.status in ('sent', 'delivered', 'delayed') then 'sent'
              when s.status = 'queued' and s.channel = 'email' and m.status in ('bounced', 'complained', 'failed', 'suppressed', 'cancelled') then 'failed'
              else s.status end,
         coalesce(s.reason, case when s.channel = 'text' then q.error else m.error end), s.note, s.is_update, s.auto, s.to_addr, s.created_by, s.created_at,
         case when s.channel = 'email' then m.status else q.status end, m.delivered_at, m.opened_at
    from public.volunteer_itinerary_sends s
    left join public.quo_messages q on q.id = s.quo_message_id
    left join public.crm_email_sends m on m.id = s.email_send_id
   where s.event_id = p_event and public.is_wa_staff()
   order by s.created_at desc, s.id desc;
$$;
comment on function public.wa182_itinerary_status(bigint) is 'wave182: every itinerary send of a serving with what it became (the Quo text''s or the email''s own status), for staff.';

-- 5. the day-before automatic itinerary, by the serving's channels, to the confirmed who have not had it (and only where it can go)
create or replace function public.wa182_auto_itineraries() returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_hour int; v_now timestamp; v_sms text; v_mail text; v_tests text[]; r record; v_ph text; v_em text; n int := 0;
begin
  v_hour := coalesce(nullif((select value from public.app_config where key = 'sms_itinerary_hour'), '')::int, 17);
  v_now := now() at time zone 'America/Toronto';
  if extract(hour from v_now) < v_hour or extract(hour from v_now) >= 20 then return jsonb_build_object('queued', 0, 'reason', 'not the hour'); end if;
  v_sms := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  v_mail := coalesce((select value from public.app_config where key = 'mail_mode'), 'test');
  v_tests := array(select lower(trim(x)) from unnest(regexp_split_to_array(coalesce((select value from public.app_config where key = 'mail_test_recipients'), ''), '[,;\s]+')) x where trim(x) <> '');
  for r in
    select er.id, er.person_id, e.id as event_id, e.itinerary_channels
      from public.event_roster er join public.volunteer_events e on e.id = er.event_id
      join public.volunteer_role_guides g on g.role = lower(er.role) and g.itinerary is not null
     where e.kind = 'service' and e.status <> 'cancelled' and e.itinerary_auto and er.confirm_token is not null and e.event_date = v_now::date + 1
       and lower(coalesce(er.status, '')) = 'confirmed'
  loop
    if r.itinerary_channels in ('text', 'both') and v_sms in ('test', 'live')
       and not exists (select 1 from public.volunteer_itinerary_sends s where s.roster_id = r.id and s.channel = 'text' and s.status in ('scheduled', 'queued', 'sent'))
       and not exists (select 1 from public.quo_messages q where q.roster_id = r.id and q.kind = 'itinerary' and q.direction = 'out' and q.status in ('queued', 'sent')) then
      v_ph := public.wa171_roster_phone(r.id);
      if v_ph is not null and not public.wa171_opted_out(r.person_id, v_ph) and (v_sms = 'live' or public.wa171_test_phone(v_ph)) then
        insert into public.volunteer_itinerary_sends (event_id, roster_id, channel, auto, created_by) values (r.event_id, r.id, 'text', true, 'automation'); n := n + 1;
      end if;
    end if;
    if r.itinerary_channels in ('email', 'both')
       and not exists (select 1 from public.volunteer_itinerary_sends s where s.roster_id = r.id and s.channel = 'email' and s.status in ('scheduled', 'queued', 'sent')) then
      v_em := public.wa182_roster_email(r.id)->>'email';
      if v_em is not null and (v_mail = 'live' or v_em = any(v_tests)) then
        insert into public.volunteer_itinerary_sends (event_id, roster_id, channel, auto, created_by) values (r.event_id, r.id, 'email', true, 'automation'); n := n + 1;
      end if;
    end if;
  end loop;
  return jsonb_build_object('queued', n);
end $$;
comment on function public.wa182_auto_itineraries() is 'wave182: the day before a serving, from sms_itinerary_hour (Toronto) to 8 pm, schedules the itinerary for everyone confirmed in a role with one, by the serving''s channels, where it can go (the modes and test lists) and when they have not had it by that channel. Off for a serving whose itinerary_auto is false.';

-- wave174's day-before queue now goes through the sends (kept for wa171_sms_tick)
create or replace function public.wa174_queue_itineraries() returns jsonb language plpgsql security definer set search_path to '' as $$
begin
  return public.wa182_auto_itineraries() || jsonb_build_object('tick', public.wa182_itinerary_tick());
end $$;
comment on function public.wa174_queue_itineraries() is 'wave174, rewritten by wave182: the day-before itinerary now schedules volunteer_itinerary_sends (wa182_auto_itineraries) and sends what is due (wa182_itinerary_tick), by text and email.';

revoke all on function public.wa182_season(date) from public, anon;
revoke all on function public.wa182_photo(bigint) from public, anon;
revoke all on function public.wa182_look(bigint) from public, anon;
revoke all on function public.wa182_itinerary(bigint) from public, anon, authenticated;
revoke all on function public.wa182_roster_email(bigint) from public, anon, authenticated;
revoke all on function public.wa182_text_body(bigint, text, boolean) from public, anon, authenticated;
revoke all on function public.wa182_itinerary_tick() from public, anon, authenticated;
revoke all on function public.wa182_auto_itineraries() from public, anon, authenticated;
revoke all on function public.wa174_queue_itineraries() from public, anon, authenticated;
revoke all on function public.wa182_send_itineraries(bigint, bigint[], text, timestamptz, text, boolean) from public, anon;
revoke all on function public.wa182_cancel_itineraries(bigint[]) from public, anon;
revoke all on function public.wa182_itinerary_status(bigint) from public, anon;
grant execute on function public.wa182_send_itineraries(bigint, bigint[], text, timestamptz, text, boolean) to authenticated;
grant execute on function public.wa182_cancel_itineraries(bigint[]) to authenticated;
grant execute on function public.wa182_itinerary_status(bigint) to authenticated;
grant execute on function public.wa182_look(bigint) to authenticated;

-- the email template the sends point at (mail-send v4 renders the itinerary itself; this row names it and holds the subject)
insert into public.crm_email_templates (key, name, kind, subject, preheader, html_body, text_body, active)
values ('volunteer_itinerary', 'Volunteer itinerary', 'transactional', 'Your itinerary for {{date}}', 'Where to be, when, and who is on your team.', '{{body_html}}', null, true)
on conflict (key) do nothing;

-- 4. the volunteer's page: the itinerary as soon as it is sent to them, and in a preview at any time; the look at the top
do $$
declare d text; old1 text; new1 text; old2 text; new2 text;
begin
  d := pg_get_functiondef('public.volunteer_confirm_get(text,boolean)'::regprocedure);
  old1 := $o$  if v_state = 'confirmed' and r.ev_status <> 'cancelled' and r.event_date >= v_today and (r.event_date - v_today <= 1 or p_preview) then
    v_itin := public.wa174_itinerary(r.id);
  end if;$o$;
  new1 := $n$  -- wave182: also as soon as the team sent it to them (by text or email), and in a preview whatever the answer
  if r.ev_status <> 'cancelled' and lower(coalesce(r.status, '')) <> 'cancelled' and r.event_date >= v_today
     and (p_preview
          or (v_state = 'confirmed' and r.event_date - v_today <= 1)
          or (v_state <> 'declined' and exists (select 1 from public.volunteer_itinerary_sends s where s.roster_id = r.id and s.status in ('queued', 'sent')))) then
    v_itin := public.wa182_itinerary(r.id);
  end if;$n$;
  old2 := $o$'photo', v_photo,$o$;
  new2 := $n$'photo', v_photo, 'look', public.wa182_look(r.event_id),$n$;
  if position(old1 in d) = 0 then raise exception 'volunteer_confirm_get: the itinerary block was not found'; end if;
  if position(old2 in d) = 0 then raise exception 'volunteer_confirm_get: the photo line was not found'; end if;
  d := replace(replace(d, old1, new1), old2, new2);
  execute d;
end $$;
comment on function public.volunteer_confirm_get(text, boolean) is 'The volunteer''s own page (hub.welfareavenue.com/c/<token>): who, what role, when, where, what to expect, the survey after the serving, and (wave182) the itinerary with its look as soon as the team sent it, or from the day before for the confirmed; a preview (p_preview) shows it at any time. Anonymous by token.';

-- the cron: every 5 minutes, the day-before schedule and anything due
select cron.unschedule(jobid) from cron.job where jobname = 'wa-itinerary-tick';
select cron.schedule('wa-itinerary-tick', '*/5 * * * *', $c$select public.wa182_auto_itineraries(), public.wa182_itinerary_tick() where exists (select 1 from public.volunteer_events e where e.event_date between (now() at time zone 'America/Toronto')::date and (now() at time zone 'America/Toronto')::date + 30)$c$);

-- the record
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261001030000', 'wa182_itineraries', array[$m$alter table public.volunteer_events add column if not exists whatsapp_url text$m$,$m$alter table public.volunteer_events add column if not exists itinerary_photo_id bigint references public.wa_photos(id) on delete set null$m$,$m$alter table public.volunteer_events add column if not exists itinerary_auto boolean not null default true$m$,$m$alter table public.volunteer_events add column if not exists itinerary_channels text not null default 'both'$m$,$m$alter table public.volunteer_events drop constraint if exists volunteer_events_itinerary_channels_check$m$,$m$alter table public.volunteer_events add constraint volunteer_events_itinerary_channels_check check (itinerary_channels in ('text', 'email', 'both'))$m$,$m$alter table public.volunteer_events drop constraint if exists volunteer_events_whatsapp_url_check$m$,$m$alter table public.volunteer_events add constraint volunteer_events_whatsapp_url_check check (whatsapp_url is null or whatsapp_url ~* '^https://(chat\.whatsapp\.com|wa\.me|whatsapp\.com)/')$m$,$m$comment on column public.volunteer_events.whatsapp_url is 'wave182: the serving''s WhatsApp group invite link (chat.whatsapp.com/...). Shown on every itinerary and in the itinerary text and email.'$m$,$m$comment on column public.volunteer_events.itinerary_photo_id is 'wave182: the photo at the top of this serving''s itineraries (a ready photo from the Photo library). Empty: the season''s photo (volunteer_itinerary_settings photo_<season>).'$m$,$m$comment on column public.volunteer_events.itinerary_auto is 'wave182: true: the itinerary goes by itself the day before (sms_itinerary_hour, Toronto) to everyone confirmed who has not had it yet.'$m$,$m$comment on column public.volunteer_events.itinerary_channels is 'wave182: how the automatic itinerary goes: text, email or both (each person by what we have for them).'$m$,$m$insert into public.volunteer_itinerary_settings (key, value, updated_by) values
  ('photo_winter', '68', 'wa182'), ('band_winter', '14', 'wa182'),
  ('photo_spring', '48', 'wa182'), ('band_spring', '97', 'wa182'),
  ('photo_summer', '29', 'wa182'), ('band_summer', '83', 'wa182'),
  ('photo_autumn', '26', 'wa182'), ('band_autumn', '58', 'wa182'),
  ('bins', '[{"name_en":"Clean-up bin and volunteer belongings (2 bins in 1)","name_fr":"Bac de nettoyage et effets des bénévoles (2 bacs en 1)","items_en":"Gloves, paper towel, table wipes, garbage bags, masks, all-purpose cleaner, hand sanitizer, pinnies","items_fr":"Gants, essuie-tout, lingettes, sacs à ordures, masques, nettoyant tout usage, désinfectant pour les mains, dossards","photo":"photos/itinerary/bin-clean-up.jpg"},{"name_en":"Dinnerware bin","name_fr":"Bac de vaisselle","items_en":"Napkins, plates, bowls and lids, utensils, cups and lids","items_fr":"Serviettes, assiettes, bols et couvercles, ustensiles, verres et couvercles","photo":"photos/itinerary/bin-dinnerware.jpg"},{"name_en":"Coffee container and coffee","name_fr":"Contenant à café et café","items_en":"The big empty coffee container, and the packs of coffee beside it","items_fr":"Le grand contenant à café vide, et les paquets de café à côté","photo":"photos/itinerary/bin-coffee.jpg"},{"name_en":"Clean serving utensils bin","name_fr":"Bac d''ustensiles de service propres","items_en":"Clean spoons, tongs, spatulas and ladles for serving","items_fr":"Cuillères, pinces, spatules et louches propres pour servir","photo":""},{"name_en":"Clothes to donate bin","name_fr":"Bac de vêtements à donner","items_en":"Shoes and clothing to give away","items_fr":"Chaussures et vêtements à donner","photo":"photos/itinerary/bin-clothes.jpg"},{"name_en":"Utensils to donate bin","name_fr":"Bac d''ustensiles à donner","items_en":"Tongs, spatulas, ladles, spoons, can opener","items_fr":"Pinces, spatules, louches, cuillères, ouvre-boîte","photo":"photos/itinerary/bin-utensils.jpg"},{"name_en":"Dirty dishes bin","name_fr":"Bac de vaisselle sale","items_en":"For the dirty dishes after the serving","items_fr":"Pour la vaisselle sale après le service","photo":"photos/itinerary/bin-dirty-dishes.jpg"}]', 'wa182'),
  ('carry_en', E'The tent with our logo (at least 1)\nTables (3 at most)\nThe water jug\nThe speaker', 'wa182'),
  ('carry_fr', E'La tente avec notre logo (au moins 1)\nLes tables (3 au plus)\nLa cruche d''eau\nLe haut-parleur', 'wa182')
on conflict (key) do nothing$m$,$m$create or replace function public.wa182_season(p_day date) returns text language sql immutable set search_path to '' as $$
  select case when extract(month from p_day) in (12, 1, 2) then 'winter' when extract(month from p_day) in (3, 4, 5) then 'spring'
              when extract(month from p_day) in (6, 7, 8) then 'summer' else 'autumn' end;
$$$m$,$m$comment on function public.wa182_season(date) is 'wave182: the season of a serving''s date (December to February winter, March to May spring, June to August summer, September to November autumn).'$m$,$m$create or replace function public.wa182_photo(p_id bigint) returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('id', p.id, 'path', p.path_web, 'alt', coalesce(p.alt_text, p.title), 'fx', p.focal_x, 'fy', p.focal_y, 'season', p.season)
    from public.wa_photos p where p.id = p_id and p.status = 'ready' and p.usage = 'ready' and p.path_web is not null;
$$$m$,$m$comment on function public.wa182_photo(bigint) is 'wave182: a ready photo (status and usage ready) as the itinerary page and email use it: path, alt text, focal point. Null when the photo is not ready.'$m$,$m$create or replace function public.wa182_look(p_event bigint) returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare e record; v_season text; v_hero jsonb; v_band jsonb;
begin
  select id, event_date, itinerary_photo_id into e from public.volunteer_events where id = p_event;
  if not found then return null; end if;
  v_season := public.wa182_season(e.event_date);
  if e.itinerary_photo_id is not null then v_hero := public.wa182_photo(e.itinerary_photo_id); end if;
  if v_hero is null then v_hero := public.wa182_photo(nullif(public.wa174_set('photo_' || v_season), '')::bigint); end if;
  if v_hero is null then
    select public.wa182_photo(p.id) into v_hero from public.wa_photos p
     where p.season = v_season and p.status = 'ready' and p.usage = 'ready' and p.path_web is not null and coalesce(p.orientation, 'landscape') = 'landscape'
     order by p.is_pick desc, p.taken_on desc nulls last, p.id limit 1;
  end if;
  v_band := public.wa182_photo(nullif(public.wa174_set('band_' || v_season), '')::bigint);
  if v_band is null or (v_band->>'id') = (v_hero->>'id') then
    select public.wa182_photo(p.id) into v_band from public.wa_photos p
     where p.season = v_season and p.status = 'ready' and p.usage = 'ready' and p.path_web is not null and coalesce(p.orientation, 'landscape') = 'landscape'
       and p.id <> coalesce((v_hero->>'id')::bigint, 0)
     order by p.is_pick desc, p.taken_on desc nulls last, p.id limit 1;
  end if;
  return jsonb_build_object('season', v_season, 'hero', v_hero, 'band', coalesce(v_band, v_hero));
end $$$m$,$m$comment on function public.wa182_look(bigint) is 'wave182: a serving''s itinerary look: its season, the hero photo (the serving''s own, else the season''s setting, else the best ready photo of that season) and the band photo at the foot.'$m$,$m$create or replace function public.wa182_itinerary(p_roster bigint) returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare base jsonb; r record; v_bins jsonb;
begin
  select er.id, er.role, er.event_id, e.whatsapp_url, e.event_date, e.kitchen_contact, e.ingredients_note into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.id = p_roster;
  if not found then return null; end if;
  base := public.wa174_itinerary(p_roster);
  if base is null then return null; end if;
  if base->>'kind' = 'lead_driver' then
    begin v_bins := (public.wa174_set('bins'))::jsonb; exception when others then v_bins := '[]'::jsonb; end;
    base := base || jsonb_build_object('bins', coalesce(v_bins, '[]'::jsonb),
      'carry_en', to_jsonb(string_to_array(coalesce(public.wa174_set('carry_en'), ''), E'\n')),
      'carry_fr', to_jsonb(string_to_array(coalesce(public.wa174_set('carry_fr'), ''), E'\n')),
      'kitchen_contact', case when base->>'format' = 'community_kitchen' then r.kitchen_contact end,
      'ingredients_note', case when base->>'format' = 'community_kitchen' then r.ingredients_note end);
  end if;
  return base || jsonb_build_object('look', public.wa182_look(r.event_id), 'whatsapp_url', r.whatsapp_url, 'event_date', r.event_date,
    'sent', (select max(coalesce(s.done_at, s.created_at)) from public.volunteer_itinerary_sends s where s.roster_id = p_roster and s.status in ('queued', 'sent')),
    'updated', exists (select 1 from public.volunteer_itinerary_sends s where s.roster_id = p_roster and s.is_update and s.status in ('queued', 'sent')));
end $$$m$,$m$comment on function public.wa182_itinerary(bigint) is 'wave182: wa174_itinerary plus the look (season and photos), the WhatsApp link, the storage bins and what to always carry (team leaders and drivers), the kitchen contact and ingredients (community kitchen), and when it was sent.'$m$,$m$create table if not exists public.volunteer_itinerary_sends (
  id bigserial primary key,
  batch uuid not null default gen_random_uuid(),
  event_id bigint not null references public.volunteer_events(id) on delete cascade,
  roster_id bigint not null references public.event_roster(id) on delete cascade,
  channel text not null check (channel in ('text', 'email')),
  send_at timestamptz not null default now(),
  status text not null default 'scheduled' check (status in ('scheduled', 'queued', 'sent', 'failed', 'skipped', 'cancelled')),
  reason text,
  note text,
  is_update boolean not null default false,
  auto boolean not null default false,
  to_addr text,
  quo_message_id bigint references public.quo_messages(id) on delete set null,
  email_send_id bigint references public.crm_email_sends(id) on delete set null,
  created_by text,
  created_at timestamptz not null default now(),
  done_at timestamptz
)$m$,$m$create index if not exists volunteer_itinerary_sends_event_idx on public.volunteer_itinerary_sends (event_id, created_at desc)$m$,$m$create index if not exists volunteer_itinerary_sends_due_idx on public.volunteer_itinerary_sends (send_at) where status = 'scheduled'$m$,$m$create index if not exists volunteer_itinerary_sends_roster_idx on public.volunteer_itinerary_sends (roster_id)$m$,$m$comment on table public.volunteer_itinerary_sends is 'wave182: each itinerary sent or scheduled for a volunteer: by text (a Quo text, quo_messages kind itinerary) or by email (crm_email_sends, meta.source itinerary, sent by mail-send v4). Written only by wa182_send_itineraries, wa182_auto_itineraries and wa182_itinerary_tick; staff read.'$m$,$m$comment on column public.volunteer_itinerary_sends.status is 'scheduled (waits for send_at), queued (handed to Quo or to mail-send), sent, failed, skipped (with the reason: texts off, test mode, no phone, no email, stopped texts, no permission), cancelled (by staff before it went).'$m$,$m$comment on column public.volunteer_itinerary_sends.is_update is 'true: sent as an updated itinerary ("your itinerary has changed").'$m$,$m$comment on column public.volunteer_itinerary_sends.auto is 'true: queued by the automatic day-before send.'$m$,$m$alter table public.volunteer_itinerary_sends enable row level security$m$,$m$drop policy if exists volunteer_itinerary_sends_staff_read on public.volunteer_itinerary_sends$m$,$m$create policy volunteer_itinerary_sends_staff_read on public.volunteer_itinerary_sends for select to authenticated using (public.is_wa_staff())$m$,$m$revoke all on public.volunteer_itinerary_sends from anon$m$,$m$grant select on public.volunteer_itinerary_sends to authenticated$m$,$m$drop index if exists public.quo_messages_itinerary_once$m$,$m$create or replace function public.wa182_roster_email(p_roster bigint) returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('email', lower(coalesce(nullif(c.primary_email, ''), nullif(vp.emails[1], ''), nullif(er.detail->>'email', ''))), 'contact_id', coalesce(c.id, vp.contact_id))
    from public.event_roster er
    left join public.volunteer_people vp on vp.id = er.person_id
    left join public.crm_contacts c on c.id = vp.contact_id and c.merged_into is null
   where er.id = p_roster;
$$$m$,$m$comment on function public.wa182_roster_email(bigint) is 'wave182: the email address for a roster row (the CRM contact''s, else the volunteer record''s, else the roster row''s detail) and the contact id.'$m$,$m$create or replace function public.wa182_text_body(p_roster bigint, p_note text, p_update boolean) returns text language plpgsql stable security definer set search_path to '' as $$
declare r record; v_lang text; v_first text; v_t jsonb; v_hm text; v_base text; v_day text; v_link text; v_body text; v_role text;
  fr_days text[] := array['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  fr_months text[] := array['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
begin
  select er.id, er.person_id, er.person_name, er.confirm_token, er.role, e.event_date, e.whatsapp_url into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.id = p_roster;
  if not found or r.confirm_token is null then return null; end if;
  v_base := coalesce(nullif((select value from public.app_config where key = 'sms_link_base'), ''), 'https://hub.welfareavenue.com/c/');
  v_link := v_base || r.confirm_token || '?it=1';
  v_lang := public.wa171_lang(r.person_id);
  v_first := nullif(split_part(trim(coalesce(r.person_name, '')), ' ', 1), '');
  v_t := public.wa174_times(r.id); v_hm := v_t->>'start';
  v_role := public.wa171_role_label(r.role, v_lang);
  if v_lang = 'fr' then
    v_day := fr_days[extract(dow from r.event_date)::int + 1] || ' ' || extract(day from r.event_date)::int || case when extract(day from r.event_date) = 1 then 'er' else '' end || ' ' || fr_months[extract(month from r.event_date)::int];
    v_body := 'Bonjour' || coalesce(' ' || v_first, '') || ', ' || case when p_update then 'votre itinéraire du ' || v_day || ' a été mis à jour' else 'voici votre itinéraire pour le ' || v_day end
      || ' (' || lower(v_role) || ', début pour vous : ' || replace(replace(regexp_replace(v_hm, '^0', ''), ':', ' h '), ' h 00', ' h') || ') : ' || v_link;
    if nullif(trim(coalesce(p_note, '')), '') is not null then v_body := v_body || E'\n' || trim(p_note); end if;
    if r.whatsapp_url is not null then v_body := v_body || E'\nGroupe WhatsApp : ' || r.whatsapp_url; end if;
    v_body := v_body || E'\nRépondez STOP pour ne plus recevoir de textos.';
  else
    v_day := to_char(r.event_date, 'FMDay, FMMonth FMDD');
    v_body := 'Hi' || coalesce(' ' || v_first, '') || ', ' || case when p_update then 'your itinerary for ' || v_day || ' has been updated' else 'here is your itinerary for ' || v_day end
      || ' (' || lower(v_role) || ', you start at ' || lower(to_char(('2000-01-01 ' || v_hm)::timestamp, 'FMHH12:MI am')) || '): ' || v_link;
    if nullif(trim(coalesce(p_note, '')), '') is not null then v_body := v_body || E'\n' || trim(p_note); end if;
    if r.whatsapp_url is not null then v_body := v_body || E'\nWhatsApp group: ' || r.whatsapp_url; end if;
    v_body := v_body || E'\nReply STOP to stop texts.';
  end if;
  return v_body;
end $$$m$,$m$comment on function public.wa182_text_body(bigint, text, boolean) is 'wave182: the itinerary text for a roster row (English or French by the contact''s language): the date, the role, when they start, their own link (?it=1 opens the itinerary), the team''s note, the WhatsApp group, STOP.'$m$,$m$create or replace function public.wa182_itinerary_tick() returns jsonb language plpgsql security definer set search_path to '' as $$
declare s record; v_sms text; v_mail text; v_h int; v_phone text; v_body text; v_qid bigint; v_em jsonb; v_to text; v_perm record; v_eid bigint; v_tests text[];
  v_lang text; n_text int := 0; n_mail int := 0; n_skip int := 0; n_wait int := 0;
begin
  v_sms := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  v_mail := coalesce((select value from public.app_config where key = 'mail_mode'), 'test');
  v_tests := array(select lower(trim(x)) from unnest(regexp_split_to_array(coalesce((select value from public.app_config where key = 'mail_test_recipients'), ''), '[,;\s]+')) x where trim(x) <> '');
  v_h := extract(hour from now() at time zone 'America/Toronto');
  for s in
    select vis.*, er.person_id, er.person_name, er.confirm_token, er.status as r_status, er.confirm_status, e.status as e_status, e.event_date
      from public.volunteer_itinerary_sends vis join public.event_roster er on er.id = vis.roster_id join public.volunteer_events e on e.id = vis.event_id
     where vis.status = 'scheduled' and vis.send_at <= now()
     order by vis.send_at, vis.id
     for update of vis skip locked
  loop
    if s.e_status = 'cancelled' or lower(coalesce(s.r_status, '')) = 'cancelled' or s.event_date < (now() at time zone 'America/Toronto')::date then
      update public.volunteer_itinerary_sends set status = 'skipped', reason = 'the serving is past or cancelled', done_at = now() where id = s.id; n_skip := n_skip + 1; continue;
    end if;
    if s.confirm_token is null then update public.volunteer_itinerary_sends set status = 'skipped', reason = 'no link for this person', done_at = now() where id = s.id; n_skip := n_skip + 1; continue; end if;
    if s.channel = 'text' then
      if v_sms not in ('test', 'live') then update public.volunteer_itinerary_sends set status = 'skipped', reason = 'texts are off', done_at = now() where id = s.id; n_skip := n_skip + 1; continue; end if;
      if v_h < 8 or v_h >= 20 then n_wait := n_wait + 1; continue; end if;
      v_phone := public.wa171_roster_phone(s.roster_id);
      if v_phone is null then update public.volunteer_itinerary_sends set status = 'skipped', reason = 'no phone number', done_at = now() where id = s.id; n_skip := n_skip + 1; continue; end if;
      if public.wa171_opted_out(s.person_id, v_phone) then update public.volunteer_itinerary_sends set status = 'skipped', reason = 'they stopped texts', done_at = now() where id = s.id; n_skip := n_skip + 1; continue; end if;
      if v_sms = 'test' and not public.wa171_test_phone(v_phone) then update public.volunteer_itinerary_sends set status = 'skipped', reason = 'test mode: only the test phone gets texts', to_addr = v_phone, done_at = now() where id = s.id; n_skip := n_skip + 1; continue; end if;
      v_body := public.wa182_text_body(s.roster_id, s.note, s.is_update);
      insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id)
      values (s.batch, s.person_id, '+1' || v_phone, v_body, 'queued', s.event_id, coalesce(s.created_by, 'automation'), 'out', 'itinerary', s.roster_id)
      returning id into v_qid;
      update public.volunteer_itinerary_sends set status = 'queued', quo_message_id = v_qid, to_addr = v_phone, done_at = now() where id = s.id;
      n_text := n_text + 1;
    else
      v_em := public.wa182_roster_email(s.roster_id);
      v_to := v_em->>'email';
      if v_to is null or v_to !~ '^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$' then update public.volunteer_itinerary_sends set status = 'skipped', reason = 'no email address', done_at = now() where id = s.id; n_skip := n_skip + 1; continue; end if;
      if v_mail <> 'live' and not (v_to = any(v_tests)) then update public.volunteer_itinerary_sends set status = 'skipped', reason = 'test mode: only the test addresses get email', to_addr = v_to, done_at = now() where id = s.id; n_skip := n_skip + 1; continue; end if;
      if (v_em->>'contact_id') is not null then
        select * into v_perm from public.crm_email_permission((v_em->>'contact_id')::bigint, 'transactional') limit 1;
        if found and v_perm.allowed is false then update public.volunteer_itinerary_sends set status = 'skipped', reason = 'email: ' || coalesce(v_perm.basis, 'not allowed'), to_addr = v_to, done_at = now() where id = s.id; n_skip := n_skip + 1; continue; end if;
      end if;
      v_lang := public.wa171_lang(s.person_id);
      insert into public.crm_email_sends (contact_id, to_email, template_key, kind, status, is_test, permission_basis, meta, created_by)
      values ((v_em->>'contact_id')::bigint, v_to, 'volunteer_itinerary', 'transactional', 'queued', v_mail <> 'live', 'an itinerary for a serving they signed up for',
              jsonb_build_object('source', 'itinerary', 'itinerary_send_id', s.id, 'roster_id', s.roster_id, 'token', s.confirm_token, 'note', s.note, 'is_update', s.is_update, 'lang', v_lang),
              coalesce(s.created_by, 'automation'))
      returning id into v_eid;
      update public.volunteer_itinerary_sends set status = 'queued', email_send_id = v_eid, to_addr = v_to, done_at = now() where id = s.id;
      n_mail := n_mail + 1;
    end if;
  end loop;
  if n_text > 0 then perform public.call_edge('quo-send', '{"action":"drain"}'::jsonb); end if;
  if n_mail > 0 then perform public.call_edge('mail-send', '{"action":"campaign_pump"}'::jsonb); end if;
  return jsonb_build_object('texts', n_text, 'emails', n_mail, 'skipped', n_skip, 'waiting_for_8am', n_wait);
end $$$m$,$m$comment on function public.wa182_itinerary_tick() is 'wave182: turns due itinerary sends into a Quo text (8 am to 8 pm Toronto, sms_mode test or live, the test phone only in test mode, never to someone who stopped texts) or a queued email (mail_mode live, or a test address in test mode; the CRM''s transactional permission), then wakes quo-send and mail-send. Cron wa-itinerary-tick.'$m$,$m$create or replace function public.wa182_send_itineraries(p_event bigint, p_roster bigint[], p_channel text, p_send_at timestamptz default null, p_note text default null, p_update boolean default false)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_who text; r record; v_batch uuid := gen_random_uuid(); v_at timestamptz; n int := 0; n_text int := 0; n_mail int := 0; v_none int := 0; v_tick jsonb; v_ph text; v_em text;
begin
  if not (public.is_wa_admin() or public.is_wa_leader() or public.wa_is_hr()) then raise exception 'Only leaders, HR and admins send itineraries'; end if;
  if p_channel not in ('text', 'email', 'both') then raise exception 'Choose text, email or both'; end if;
  if p_roster is null or array_length(p_roster, 1) is null then raise exception 'Pick at least one person'; end if;
  if p_note is not null and length(p_note) > 300 then raise exception 'The note is at most 300 characters'; end if;
  v_at := coalesce(p_send_at, now());
  if v_at < now() - interval '5 minutes' then v_at := now(); end if;
  v_who := coalesce((auth.jwt()->>'email'), 'staff');
  for r in select er.id, er.role from public.event_roster er where er.event_id = p_event and er.id = any(p_roster) and lower(coalesce(er.status, '')) <> 'cancelled' loop
    v_ph := public.wa171_roster_phone(r.id); v_em := public.wa182_roster_email(r.id)->>'email';
    if p_channel in ('text', 'both') and (v_ph is not null or p_channel = 'text') then
      insert into public.volunteer_itinerary_sends (batch, event_id, roster_id, channel, send_at, note, is_update, created_by) values (v_batch, p_event, r.id, 'text', v_at, nullif(trim(coalesce(p_note, '')), ''), coalesce(p_update, false), v_who);
      n_text := n_text + 1;
    end if;
    if p_channel in ('email', 'both') and (v_em is not null or p_channel = 'email') then
      insert into public.volunteer_itinerary_sends (batch, event_id, roster_id, channel, send_at, note, is_update, created_by) values (v_batch, p_event, r.id, 'email', v_at, nullif(trim(coalesce(p_note, '')), ''), coalesce(p_update, false), v_who);
      n_mail := n_mail + 1;
    end if;
    if p_channel = 'both' and v_ph is null and v_em is null then v_none := v_none + 1; end if;
    n := n + 1;
  end loop;
  insert into public.change_log (entity_type, entity_id, field, new_value, changed_by)
  values ('volunteer_event', p_event::text, 'itinerary_send', n || ' people, ' || n_text || ' texts and ' || n_mail || ' emails' || case when v_at > now() + interval '1 minute' then ', scheduled for ' || to_char(v_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') else ', now' end || case when p_update then ' (update)' else '' end, v_who);
  if v_at <= now() + interval '1 minute' then v_tick := public.wa182_itinerary_tick(); end if;
  return jsonb_build_object('batch', v_batch, 'people', n, 'texts', n_text, 'emails', n_mail, 'no_way_to_reach', v_none, 'send_at', v_at, 'tick', v_tick);
end $$$m$,$m$comment on function public.wa182_send_itineraries(bigint, bigint[], text, timestamptz, text, boolean) is 'wave182: leaders, HR and admins send itineraries to the people they pick on a serving: by text, email or both (both: each way we have for the person), now or at a set time, with an optional note and as an update. Logged in change_log; sending now runs the tick at once.'$m$,$m$create or replace function public.wa182_cancel_itineraries(p_ids bigint[]) returns int language plpgsql security definer set search_path to '' as $$
declare n int;
begin
  if not (public.is_wa_admin() or public.is_wa_leader() or public.wa_is_hr()) then raise exception 'Only leaders, HR and admins change itinerary sends'; end if;
  update public.volunteer_itinerary_sends set status = 'cancelled', reason = 'cancelled by ' || coalesce(auth.jwt()->>'email', 'staff'), done_at = now()
   where id = any(p_ids) and status = 'scheduled';
  get diagnostics n = row_count;
  return n;
end $$$m$,$m$comment on function public.wa182_cancel_itineraries(bigint[]) is 'wave182: cancels scheduled itinerary sends that have not gone yet (leaders, HR, admins).'$m$,$m$create or replace function public.wa182_itinerary_status(p_event bigint) returns table (id bigint, batch uuid, roster_id bigint, channel text, send_at timestamptz, status text, reason text, note text, is_update boolean, auto boolean, to_addr text, created_by text, created_at timestamptz, delivery text, delivered_at timestamptz, opened_at timestamptz)
language sql stable security definer set search_path to '' as $$
  select s.id, s.batch, s.roster_id, s.channel, s.send_at,
         case when s.status = 'queued' and s.channel = 'text' and q.status in ('sent', 'failed') then q.status
              when s.status = 'queued' and s.channel = 'email' and m.status in ('sent', 'delivered', 'delayed') then 'sent'
              when s.status = 'queued' and s.channel = 'email' and m.status in ('bounced', 'complained', 'failed', 'suppressed', 'cancelled') then 'failed'
              else s.status end,
         coalesce(s.reason, case when s.channel = 'text' then q.error else m.error end), s.note, s.is_update, s.auto, s.to_addr, s.created_by, s.created_at,
         case when s.channel = 'email' then m.status else q.status end, m.delivered_at, m.opened_at
    from public.volunteer_itinerary_sends s
    left join public.quo_messages q on q.id = s.quo_message_id
    left join public.crm_email_sends m on m.id = s.email_send_id
   where s.event_id = p_event and public.is_wa_staff()
   order by s.created_at desc, s.id desc;
$$$m$,$m$comment on function public.wa182_itinerary_status(bigint) is 'wave182: every itinerary send of a serving with what it became (the Quo text''s or the email''s own status), for staff.'$m$,$m$create or replace function public.wa182_auto_itineraries() returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_hour int; v_now timestamp; v_sms text; v_mail text; v_tests text[]; r record; v_ph text; v_em text; n int := 0;
begin
  v_hour := coalesce(nullif((select value from public.app_config where key = 'sms_itinerary_hour'), '')::int, 17);
  v_now := now() at time zone 'America/Toronto';
  if extract(hour from v_now) < v_hour or extract(hour from v_now) >= 20 then return jsonb_build_object('queued', 0, 'reason', 'not the hour'); end if;
  v_sms := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  v_mail := coalesce((select value from public.app_config where key = 'mail_mode'), 'test');
  v_tests := array(select lower(trim(x)) from unnest(regexp_split_to_array(coalesce((select value from public.app_config where key = 'mail_test_recipients'), ''), '[,;\s]+')) x where trim(x) <> '');
  for r in
    select er.id, er.person_id, e.id as event_id, e.itinerary_channels
      from public.event_roster er join public.volunteer_events e on e.id = er.event_id
      join public.volunteer_role_guides g on g.role = lower(er.role) and g.itinerary is not null
     where e.kind = 'service' and e.status <> 'cancelled' and e.itinerary_auto and er.confirm_token is not null and e.event_date = v_now::date + 1
       and lower(coalesce(er.status, '')) = 'confirmed'
  loop
    if r.itinerary_channels in ('text', 'both') and v_sms in ('test', 'live')
       and not exists (select 1 from public.volunteer_itinerary_sends s where s.roster_id = r.id and s.channel = 'text' and s.status in ('scheduled', 'queued', 'sent'))
       and not exists (select 1 from public.quo_messages q where q.roster_id = r.id and q.kind = 'itinerary' and q.direction = 'out' and q.status in ('queued', 'sent')) then
      v_ph := public.wa171_roster_phone(r.id);
      if v_ph is not null and not public.wa171_opted_out(r.person_id, v_ph) and (v_sms = 'live' or public.wa171_test_phone(v_ph)) then
        insert into public.volunteer_itinerary_sends (event_id, roster_id, channel, auto, created_by) values (r.event_id, r.id, 'text', true, 'automation'); n := n + 1;
      end if;
    end if;
    if r.itinerary_channels in ('email', 'both')
       and not exists (select 1 from public.volunteer_itinerary_sends s where s.roster_id = r.id and s.channel = 'email' and s.status in ('scheduled', 'queued', 'sent')) then
      v_em := public.wa182_roster_email(r.id)->>'email';
      if v_em is not null and (v_mail = 'live' or v_em = any(v_tests)) then
        insert into public.volunteer_itinerary_sends (event_id, roster_id, channel, auto, created_by) values (r.event_id, r.id, 'email', true, 'automation'); n := n + 1;
      end if;
    end if;
  end loop;
  return jsonb_build_object('queued', n);
end $$$m$,$m$comment on function public.wa182_auto_itineraries() is 'wave182: the day before a serving, from sms_itinerary_hour (Toronto) to 8 pm, schedules the itinerary for everyone confirmed in a role with one, by the serving''s channels, where it can go (the modes and test lists) and when they have not had it by that channel. Off for a serving whose itinerary_auto is false.'$m$,$m$create or replace function public.wa174_queue_itineraries() returns jsonb language plpgsql security definer set search_path to '' as $$
begin
  return public.wa182_auto_itineraries() || jsonb_build_object('tick', public.wa182_itinerary_tick());
end $$$m$,$m$comment on function public.wa174_queue_itineraries() is 'wave174, rewritten by wave182: the day-before itinerary now schedules volunteer_itinerary_sends (wa182_auto_itineraries) and sends what is due (wa182_itinerary_tick), by text and email.'$m$,$m$revoke all on function public.wa182_season(date) from public, anon$m$,$m$revoke all on function public.wa182_photo(bigint) from public, anon$m$,$m$revoke all on function public.wa182_look(bigint) from public, anon$m$,$m$revoke all on function public.wa182_itinerary(bigint) from public, anon, authenticated$m$,$m$revoke all on function public.wa182_roster_email(bigint) from public, anon, authenticated$m$,$m$revoke all on function public.wa182_text_body(bigint, text, boolean) from public, anon, authenticated$m$,$m$revoke all on function public.wa182_itinerary_tick() from public, anon, authenticated$m$,$m$revoke all on function public.wa182_auto_itineraries() from public, anon, authenticated$m$,$m$revoke all on function public.wa174_queue_itineraries() from public, anon, authenticated$m$,$m$revoke all on function public.wa182_send_itineraries(bigint, bigint[], text, timestamptz, text, boolean) from public, anon$m$,$m$revoke all on function public.wa182_cancel_itineraries(bigint[]) from public, anon$m$,$m$revoke all on function public.wa182_itinerary_status(bigint) from public, anon$m$,$m$grant execute on function public.wa182_send_itineraries(bigint, bigint[], text, timestamptz, text, boolean) to authenticated$m$,$m$grant execute on function public.wa182_cancel_itineraries(bigint[]) to authenticated$m$,$m$grant execute on function public.wa182_itinerary_status(bigint) to authenticated$m$,$m$grant execute on function public.wa182_look(bigint) to authenticated$m$,$m$insert into public.crm_email_templates (key, name, kind, subject, preheader, html_body, text_body, active)
values ('volunteer_itinerary', 'Volunteer itinerary', 'transactional', 'Your itinerary for {{date}}', 'Where to be, when, and who is on your team.', '{{body_html}}', null, true)
on conflict (key) do nothing$m$,$m$do $$
declare d text; old1 text; new1 text; old2 text; new2 text;
begin
  d := pg_get_functiondef('public.volunteer_confirm_get(text,boolean)'::regprocedure);
  old1 := $o$  if v_state = 'confirmed' and r.ev_status <> 'cancelled' and r.event_date >= v_today and (r.event_date - v_today <= 1 or p_preview) then
    v_itin := public.wa174_itinerary(r.id);
  end if;$o$;
  new1 := $n$  -- wave182: also as soon as the team sent it to them (by text or email), and in a preview whatever the answer
  if r.ev_status <> 'cancelled' and lower(coalesce(r.status, '')) <> 'cancelled' and r.event_date >= v_today
     and (p_preview
          or (v_state = 'confirmed' and r.event_date - v_today <= 1)
          or (v_state <> 'declined' and exists (select 1 from public.volunteer_itinerary_sends s where s.roster_id = r.id and s.status in ('queued', 'sent')))) then
    v_itin := public.wa182_itinerary(r.id);
  end if;$n$;
  old2 := $o$'photo', v_photo,$o$;
  new2 := $n$'photo', v_photo, 'look', public.wa182_look(r.event_id),$n$;
  if position(old1 in d) = 0 then raise exception 'volunteer_confirm_get: the itinerary block was not found'; end if;
  if position(old2 in d) = 0 then raise exception 'volunteer_confirm_get: the photo line was not found'; end if;
  d := replace(replace(d, old1, new1), old2, new2);
  execute d;
end $$$m$,$m$comment on function public.volunteer_confirm_get(text, boolean) is 'The volunteer''s own page (hub.welfareavenue.com/c/<token>): who, what role, when, where, what to expect, the survey after the serving, and (wave182) the itinerary with its look as soon as the team sent it, or from the day before for the confirmed; a preview (p_preview) shows it at any time. Anonymous by token.'$m$,$m$select cron.unschedule(jobid) from cron.job where jobname = 'wa-itinerary-tick'$m$,$m$select cron.schedule('wa-itinerary-tick', '*/5 * * * *', $c$select public.wa182_auto_itineraries(), public.wa182_itinerary_tick() where exists (select 1 from public.volunteer_events e where e.event_date between (now() at time zone 'America/Toronto')::date and (now() at time zone 'America/Toronto')::date + 30)$c$)$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
