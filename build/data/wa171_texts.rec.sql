-- wa171_texts (30/09/26): volunteers confirm by text (wave171, planned as wave169a) and the serving's format. First applied as
-- wa169a_texts; this renames its wa169_* functions to wa171_* (a parallel session shipped a different wave169) and drops the old names.
-- Steel (29/09/26): "confirm with volunteers using a Quo text function in the hub. It sends them a personalized message to
-- confirm their volunteer date and position via a link for them to press confirm on their phone which then opens up what
-- they should expect in their position in Welfare Avenue branding and photos". Confirmations go 7 days before the serving.
-- Nothing is texted until an admin switches sms_mode from off (the assistant never does).

-- ---------- 1. settings (admins only, like mail_*) ----------
insert into public.app_config (key, value, updated_at) values
  ('sms_mode', 'off', now()),
  ('sms_test_phones', '4388694539', now()),
  ('sms_confirm_days', '7', now()),
  ('sms_confirm_hour', '10', now()),
  ('sms_link_base', 'https://hub.welfareavenue.com/c/', now())
on conflict (key) do nothing;

create or replace function public.wa_app_config_guard()
 returns trigger language plpgsql security definer set search_path to '' as $function$
declare k text := coalesce(new.key, old.key);
begin
  if (k like 'mail\_%' or k like 'receipt\_%' or k like 'donate\_%' or k like 'loom\_%' or k like 'sms\_%') and coalesce(auth.role(), '') = 'authenticated' and not coalesce(public.is_wa_admin(), false) then
    raise exception 'Only an admin can change % (email, receipt, donation page, Loom pull and text settings).', k;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $function$;

-- ---------- 2. the text log gains direction, kind and the roster row ----------
alter table public.quo_messages
  add column if not exists direction text not null default 'out',
  add column if not exists kind text not null default 'manual',
  add column if not exists roster_id bigint references public.event_roster(id) on delete set null,
  add column if not exists quo_id text,
  add column if not exists handled text,
  add column if not exists sent_at timestamptz;
alter table public.quo_messages drop constraint if exists quo_messages_direction_check;
alter table public.quo_messages add constraint quo_messages_direction_check check (direction in ('out', 'in'));
alter table public.quo_messages drop constraint if exists quo_messages_kind_check;
alter table public.quo_messages add constraint quo_messages_kind_check check (kind in ('manual', 'confirm', 'confirm_test', 'inbound', 'ack'));
alter table public.quo_messages drop constraint if exists quo_messages_status_check;
alter table public.quo_messages add constraint quo_messages_status_check check (status in ('dry_run', 'queued', 'sent', 'failed', 'skipped', 'received'));
create index if not exists quo_messages_roster_idx on public.quo_messages (roster_id);
create index if not exists quo_messages_event_idx on public.quo_messages (event_id, created_at desc);
create unique index if not exists quo_messages_confirm_once on public.quo_messages (roster_id) where direction = 'out' and kind = 'confirm' and status in ('queued', 'sent');
create unique index if not exists quo_messages_in_once on public.quo_messages (quo_id) where direction = 'in' and quo_id is not null;
comment on table public.quo_messages is 'Every text to or from the ops line through Quo (OpenPhone): staff sends (quo-send), the automatic confirmation texts (wave171, kind confirm), acknowledgements (ack) and every incoming text (direction in, from the quo-events webhook). Written by quo-send, quo-events and wa171_* functions with the service role; staff read.';
comment on column public.quo_messages.direction is 'wave171: out (the ops line texted someone) or in (someone texted the ops line).';
comment on column public.quo_messages.kind is 'wave171: manual (a staff send), confirm (the confirmation text with the personal link, at most one live per roster row), confirm_test (a test to the test phones), inbound (a text received), ack (the short thank-you after a YES or NO).';
comment on column public.quo_messages.status is 'dry_run, queued (waiting for quo-send drain), sent, failed, skipped (sms_mode or the rules held it back; error says why) or received (inbound).';
comment on column public.quo_messages.roster_id is 'wave171: the event_roster row the text is about (a confirmation, or the row an incoming reply was matched to).';
comment on column public.quo_messages.quo_id is 'wave171: Quo''s id for the message (incoming: used to ignore a webhook delivered twice).';
comment on column public.quo_messages.handled is 'wave171, incoming texts: what the Hub did: confirmed, declined, opted_out, opted_in, question (for a person to answer), stored (texts are off, or test mode and not a test phone) or unmatched (no volunteer with that number).';
comment on column public.quo_messages.sent_at is 'wave171: when Quo accepted the text.';

-- ---------- 3. what to expect, per role (the confirm page) ----------
create table if not exists public.volunteer_role_guides (
  role text primary key,
  label_en text not null,
  label_fr text not null,
  photo_id bigint references public.wa_photos(id) on delete set null,
  expect_en text[] not null default '{}',
  expect_fr text[] not null default '{}',
  bring_en text, bring_fr text,
  arrive_en text, arrive_fr text,
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists volunteer_role_guides_photo_idx on public.volunteer_role_guides (photo_id);
alter table public.volunteer_role_guides enable row level security;
drop policy if exists volunteer_role_guides_staff_read on public.volunteer_role_guides;
create policy volunteer_role_guides_staff_read on public.volunteer_role_guides for select to authenticated using ((select public.is_wa_staff()));
drop policy if exists volunteer_role_guides_staff_write on public.volunteer_role_guides;
create policy volunteer_role_guides_staff_write on public.volunteer_role_guides for update to authenticated using ((select public.is_wa_staff())) with check ((select public.is_wa_staff()));
grant select, update on public.volunteer_role_guides to authenticated;
comment on table public.volunteer_role_guides is 'wave171: what a volunteer sees after confirming on hub.welfareavenue.com/c/<token>: per roster role, the label (English and French), a Photo library photo (only a ready one is ever shown), what to expect, what to bring and when to arrive. Staff edit (Texts settings on an event); the public page reads it only through volunteer_confirm_get.';
comment on column public.volunteer_role_guides.photo_id is 'The role''s photo (wa_photos.id); shown only while that photo is ready.';

insert into public.volunteer_role_guides (role, label_en, label_fr, photo_id, expect_en, expect_fr, bring_en, bring_fr, arrive_en, arrive_fr) values
('cook', 'Cook', 'Bénévole en cuisine', 47,
 array['Cook your dish at home before the serving, as agreed with your team leader.', 'Your driver texts you about 10 minutes before picking up your food: have it packed and ready at the door.', 'Tell us if you need containers and we will bring some.', 'You are welcome to come and serve with the team too.'],
 array['Préparez votre plat à la maison avant le service, comme convenu avec votre responsable d''équipe.', 'Votre chauffeur vous texte environ 10 minutes avant de passer prendre votre plat : ayez-le emballé et prêt à la porte.', 'Dites-nous si vous avez besoin de contenants et nous en apporterons.', 'Vous êtes aussi le bienvenu ou la bienvenue au service avec l''équipe.'],
 'Your dish, packed, with a note of what is in it (allergens).', 'Votre plat, emballé, avec une note de ce qu''il contient (allergènes).',
 'Be ready for pickup at the time your driver gives you. The day before, we text you the itinerary and the WhatsApp group link.', 'Soyez prêt ou prête à l''heure que votre chauffeur vous donne. La veille, nous vous textons l''itinéraire et le lien du groupe WhatsApp.'),
('driver', 'Driver', 'Bénévole à la livraison', 49,
 array['Main driver: meet the team leader at the storage unit (888 Rue Saint-Antoine Ouest) at the time in your itinerary.', 'Pickup driver: follow the route through each cook''s address and text each cook 10 minutes before you arrive.', 'Bring the food to the serving, then help bring everything back after.'],
 array['Chauffeur principal : rejoignez la ou le responsable d''équipe à l''entrepôt (888, rue Saint-Antoine Ouest) à l''heure de votre itinéraire.', 'Chauffeur de collecte : suivez le trajet chez chaque bénévole en cuisine et textez chacun 10 minutes avant d''arriver.', 'Apportez la nourriture au service, puis aidez à tout ramener après.'],
 'A charged phone, your licence and a clean trunk.', 'Un téléphone chargé, votre permis et un coffre dégagé.',
 'The start time in your itinerary. The day before, we text you the itinerary and the WhatsApp group link.', 'L''heure de départ de votre itinéraire. La veille, nous vous textons l''itinéraire et le lien du groupe WhatsApp.'),
('server', 'Server', 'Bénévole au service', 28,
 array['Meet the team at the serving spot and help set up the tables.', 'Get a pinny from the team leaders.', 'Sanitize your hands, wear gloves and serve with care and a smile.', 'Dirty containers go in the gray bin; help pack up at the end.'],
 array['Rejoignez l''équipe sur le lieu du service et aidez à monter les tables.', 'Prenez un dossard auprès des responsables d''équipe.', 'Lavez-vous les mains, portez des gants et servez avec soin et le sourire.', 'Les contenants sales vont dans le bac gris; aidez à ranger à la fin.'],
 'Clothes for outside and the weather, and water for yourself.', 'Des vêtements pour l''extérieur et la météo, et de l''eau pour vous.',
 'The arrival time in your itinerary. The day before, we text you the itinerary and the WhatsApp group link.', 'L''heure d''arrivée de votre itinéraire. La veille, nous vous textons l''itinéraire et le lien du groupe WhatsApp.'),
('team_leader', 'Team leader', 'Responsable d''équipe', 58,
 array['Meet the main driver at the storage unit at the time in your itinerary.', 'Share your ETA in the group chat and keep the team together.', 'At the serving, every cook and server scans the attendance QR code, and you run the community debrief.', 'After: dishwashing at Old Brewery Mission, back to the storage unit, then the weekly audit and restock form.'],
 array['Rejoignez le chauffeur principal à l''entrepôt à l''heure de votre itinéraire.', 'Partagez votre heure d''arrivée dans le groupe et gardez l''équipe ensemble.', 'Au service, chaque bénévole scanne le code QR de présence, et vous animez le bilan communautaire.', 'Après : la vaisselle à la Mission Old Brewery, le retour à l''entrepôt, puis le formulaire d''inventaire de la semaine.'],
 'Your phone, charged. The codes are in your itinerary.', 'Votre téléphone, chargé. Les codes sont dans votre itinéraire.',
 'The storage unit, at the time in the Team Leader and Driver itinerary.', 'L''entrepôt, à l''heure de l''itinéraire des responsables et des chauffeurs.'),
('dishwasher', 'Dishwasher', 'Bénévole à la vaisselle', 35,
 array['After the serving, the dirty containers go to Old Brewery Mission (915 Clark); ask for Rafael.', 'Wash, dry and pack the containers for the storage unit.'],
 array['Après le service, les contenants sales vont à la Mission Old Brewery (915, rue Clark); demandez Rafael.', 'Lavez, séchez et rangez les contenants pour l''entrepôt.'],
 'Clothes that can get wet.', 'Des vêtements qui peuvent se mouiller.',
 'The time in your itinerary.', 'L''heure de votre itinéraire.'),
('photographer', 'Photographer', 'Photographe', 29,
 array['Photograph the team, the food and the setup.', 'No close-ups of the people we serve, and ask before photographing anyone.', 'Share your photos with the team after the serving.'],
 array['Photographiez l''équipe, la nourriture et l''installation.', 'Pas de gros plans des personnes que nous servons, et demandez avant de photographier quelqu''un.', 'Partagez vos photos avec l''équipe après le service.'],
 'Your camera or phone, charged.', 'Votre appareil ou votre téléphone, chargé.',
 'The arrival time in your itinerary.', 'L''heure d''arrivée de votre itinéraire.'),
('community_debrief', 'Community debrief', 'Bilan communautaire', 56,
 array['Help the team leader run the short debrief with the community after the serving.', 'Listen, note what people tell us, and thank them.'],
 array['Aidez la ou le responsable d''équipe à animer le court bilan avec la communauté après le service.', 'Écoutez, notez ce que les gens nous disent et remerciez-les.'],
 null, null, 'The arrival time in your itinerary.', 'L''heure d''arrivée de votre itinéraire.'),
('community_talker', 'Community welcome', 'Accueil', 26,
 array['Welcome people in the line and chat with them while they wait.', 'Point people to the table and to the clothes when there are some.'],
 array['Accueillez les gens dans la file et discutez avec eux pendant l''attente.', 'Orientez les gens vers la table et les vêtements quand il y en a.'],
 null, null, 'The arrival time in your itinerary.', 'L''heure d''arrivée de votre itinéraire.'),
('volunteer', 'Volunteer', 'Bénévole', 26,
 array['Meet the team at the serving spot and help where it is needed.', 'The team leader tells you what to do when you arrive.'],
 array['Rejoignez l''équipe sur le lieu du service et aidez là où c''est utile.', 'La ou le responsable d''équipe vous dit quoi faire à votre arrivée.'],
 'Clothes for outside and the weather.', 'Des vêtements pour l''extérieur et la météo.',
 'The arrival time in your itinerary. The day before, we text you the itinerary and the WhatsApp group link.', 'L''heure d''arrivée de votre itinéraire. La veille, nous vous textons l''itinéraire et le lien du groupe WhatsApp.')
on conflict (role) do nothing;

-- ---------- 4. the serving's format (wave171, planned as wave169 part 1) ----------
alter table public.volunteer_events
  add column if not exists format text,
  add column if not exists kitchen_place text,
  add column if not exists kitchen_contact text,
  add column if not exists kitchen_shift text,
  add column if not exists ingredients_note text;
alter table public.volunteer_events drop constraint if exists volunteer_events_format_check;
alter table public.volunteer_events add constraint volunteer_events_format_check check (format is null or format in ('home_cooked', 'community_kitchen'));
comment on column public.volunteer_events.format is 'wave171: how the food is made: home_cooked (cooks cook at home, the pickup driver collects it; the standard since 2023) or community_kitchen (volunteers cook together at a community kitchen, for example La Poubelle Magnifique, 1221 Rue Crescent). Null = not set yet (a gap on the calendar for an upcoming serving).';
comment on column public.volunteer_events.kitchen_place is 'wave171, community_kitchen servings: the kitchen (name and address).';
comment on column public.volunteer_events.kitchen_contact is 'wave171, community_kitchen servings: who to reach at the kitchen (a name; no personal phone numbers here).';
comment on column public.volunteer_events.kitchen_shift is 'wave171, community_kitchen servings: the cooking shift (for example 9:00 to 12:30).';
comment on column public.volunteer_events.ingredients_note is 'wave171, community_kitchen servings: when and where the ingredients arrive, and fridge space.';

create or replace view public.volunteer_event_summary with (security_invoker = on) as
 select id, code, event_date, season, location, status, kind,
    coalesce(title, case when kind = 'service' then 'Sunday serving' else initcap(kind) end) as title,
    notes,
    (select count(*) from public.event_roster r where r.event_id = e.id) as roster_count,
    (select count(*) from public.event_roster r where r.event_id = e.id and r.status ilike 'confirmed') as roster_confirmed,
    (select count(*) from public.sop_event_steps s where s.event_id = e.id) as steps_total,
    (select count(*) from public.sop_event_steps s where s.event_id = e.id and s.done) as steps_done,
    (select count(*) from public.sop_event_extras x where x.event_id = e.id) as extras_total,
    (select count(*) from public.sop_event_extras x where x.event_id = e.id and not x.done) as extras_open,
    format,
    (select count(*) from public.event_roster r where r.event_id = e.id and r.confirm_status = 'confirmed') as roster_by_link,
    (select count(*) from public.event_roster r where r.event_id = e.id and r.status ilike 'unavailable') as roster_declined,
    (select count(distinct q.roster_id) from public.quo_messages q where q.event_id = e.id and q.direction = 'out' and q.kind = 'confirm' and q.status = 'sent') as roster_texted
   from public.volunteer_events e;
comment on view public.volunteer_event_summary is 'One row per volunteering event with its roster and checklist counts (security invoker: staff read). wave171 adds format, roster_by_link (confirmed on the text link or by replying YES), roster_declined (Unavailable) and roster_texted (sent a confirmation text).';

-- ---------- 5. helpers ----------
create or replace function public.wa171_role_label(p_role text, p_lang text default 'en')
 returns text language sql stable security definer set search_path to '' as $$
  select coalesce(
    (select case when lower(coalesce(p_lang, 'en')) like 'fr%' then g.label_fr else g.label_en end from public.volunteer_role_guides g where g.role = lower(p_role)),
    initcap(replace(coalesce(p_role, 'volunteer'), '_', ' ')));
$$;
comment on function public.wa171_role_label(text, text) is 'wave171: a roster role''s label in English or French (volunteer_role_guides, else the role code in words).';

create or replace function public.wa171_date_words(p_day date, p_lang text default 'en')
 returns text language sql immutable set search_path to '' as $$
  select case when lower(coalesce(p_lang, 'en')) like 'fr%' then
      (array['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'])[extract(dow from p_day)::int + 1] || ' ' ||
      extract(day from p_day)::int || case when extract(day from p_day) = 1 then 'er' else '' end || ' ' ||
      (array['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'])[extract(month from p_day)::int]
    else trim(to_char(p_day, 'FMDay')) || ', ' || trim(to_char(p_day, 'FMMonth')) || ' ' || extract(day from p_day)::int end;
$$;
comment on function public.wa171_date_words(date, text) is 'wave171: a date in words for a text (Sunday, October 4 / dimanche 4 octobre).';

create or replace function public.wa171_digits(p text)
 returns text language sql immutable set search_path to '' as $$
  select case when length(regexp_replace(coalesce(p, ''), '\D', '', 'g')) >= 10 then right(regexp_replace(p, '\D', '', 'g'), 10) else null end;
$$;
comment on function public.wa171_digits(text) is 'wave171: a phone number''s last 10 digits (how every Hub table matches numbers), or null.';

create or replace function public.wa171_test_phone(p_phone text)
 returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.app_config c, unnest(string_to_array(c.value, ',')) t(x)
                 where c.key = 'sms_test_phones' and public.wa171_digits(t.x) = public.wa171_digits(p_phone));
$$;
comment on function public.wa171_test_phone(text) is 'wave171: true when the number is one of app_config sms_test_phones (the only numbers texted while sms_mode is test).';

create or replace function public.wa171_lang(p_person bigint)
 returns text language sql stable security definer set search_path to '' as $$
  select case when exists (select 1 from public.crm_contacts c where c.volunteer_id = p_person and c.merged_into is null and lower(coalesce(c.language, '')) like 'fr%') then 'fr' else 'en' end;
$$;
comment on function public.wa171_lang(bigint) is 'wave171: the language to text a volunteer in (fr when their CRM contact says so, else en).';

create or replace function public.wa171_opted_out(p_person bigint, p_phone text)
 returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.crm_contacts c where c.sms_opt_out and c.merged_into is null
                 and (c.volunteer_id = p_person or exists (select 1 from unnest(c.phones) ph where public.wa171_digits(ph) = public.wa171_digits(p_phone))));
$$;
comment on function public.wa171_opted_out(bigint, text) is 'wave171: true when the volunteer (or anyone with that number) replied STOP or was marked no texts in the CRM (crm_contacts.sms_opt_out).';

create or replace function public.wa171_roster_phone(p_roster bigint)
 returns text language sql stable security definer set search_path to '' as $$
  select coalesce(
    (select public.wa171_digits(ph) from public.event_roster r join public.volunteer_people p on p.id = r.person_id, unnest(p.phones) ph
      where r.id = p_roster and public.wa171_digits(ph) is not null limit 1),
    (select public.wa171_digits(r.detail->>'phone') from public.event_roster r where r.id = p_roster));
$$;
comment on function public.wa171_roster_phone(bigint) is 'wave171: the number to text for a roster row (the volunteer''s first phone, else the phone on the row), 10 digits.';

create or replace function public.wa171_confirm_text(p_roster bigint, p_test boolean default false)
 returns text language plpgsql stable security definer set search_path to '' as $$
declare r record; v_lang text; v_first text; v_role text; v_day text; v_link text; v_art text;
begin
  select er.id, er.person_id, er.person_name, er.role, er.confirm_token, e.event_date into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.id = p_roster;
  if not found or r.confirm_token is null then return null; end if;
  v_lang := public.wa171_lang(r.person_id);
  v_first := coalesce(nullif(split_part(trim(coalesce(r.person_name, '')), ' ', 1), ''), case when v_lang = 'fr' then 'bonjour' else 'there' end);
  v_role := lower(public.wa171_role_label(r.role, v_lang));
  v_day := public.wa171_date_words(r.event_date, v_lang);
  v_link := coalesce((select value from public.app_config where key = 'sms_link_base'), 'https://hub.welfareavenue.com/c/') || r.confirm_token || case when p_test then '?test=1' else '' end;
  if v_lang = 'fr' then
    return 'Bonjour ' || v_first || ', ici Welfare Avenue! Vous êtes sur la liste comme ' || v_role || ' pour notre service du ' || v_day
      || '. Confirmez ici : ' || v_link || ' (ou répondez OUI ou NON). Répondez ARRET pour ne plus recevoir de textos.';
  end if;
  v_art := case when v_role ~ '^[aeiou]' then 'an ' else 'a ' end;
  return 'Hi ' || v_first || ', it''s Welfare Avenue! You''re on the list as ' || v_art || v_role || ' for our serving on ' || v_day
    || '. Please confirm here: ' || v_link || ' (or reply YES or NO). Reply STOP to stop texts.';
end $$;
comment on function public.wa171_confirm_text(bigint, boolean) is 'wave171: the confirmation text for a roster row, in the volunteer''s language, with their personal link (p_test adds ?test=1: the page then saves nothing).';

-- ---------- 6. the public confirm page's two calls (anonymous, by token only) ----------
create or replace function public.volunteer_confirm_get(p_token text)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare r record; g record; v_photo jsonb; v_lang text;
begin
  if p_token is null or length(p_token) < 12 then return null; end if;
  select er.id, er.person_id, er.person_name, er.role, er.status, er.confirm_status, er.confirmed_at, er.confirm,
         e.event_date, e.title, e.location, e.code, e.kind, e.status as ev_status, e.format, e.kitchen_place, e.kitchen_shift
    into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id
   where er.confirm_token = p_token;
  if not found then return null; end if;
  select * into g from public.volunteer_role_guides where role = lower(r.role);
  if not found then select * into g from public.volunteer_role_guides where role = 'volunteer'; end if;
  select jsonb_build_object('path', p.path_web, 'alt', p.alt_text, 'fx', p.focal_x, 'fy', p.focal_y) into v_photo
    from public.wa_photos p where p.id = g.photo_id and p.status = 'ready' and p.usage = 'ready' and p.path_web is not null;
  v_lang := public.wa171_lang(r.person_id);
  return jsonb_build_object(
    'first', split_part(trim(coalesce(r.person_name, '')), ' ', 1),
    'name', r.person_name, 'role', r.role,
    'role_en', public.wa171_role_label(r.role, 'en'), 'role_fr', public.wa171_role_label(r.role, 'fr'),
    'event_date', r.event_date, 'event_title', coalesce(r.title, 'Sunday serving'), 'location', coalesce(r.location, 'Montreal'),
    'code', r.code, 'lang', v_lang,
    'format', r.format, 'kitchen_place', case when r.format = 'community_kitchen' then r.kitchen_place end,
    'kitchen_shift', case when r.format = 'community_kitchen' then r.kitchen_shift end,
    'past', r.event_date < (now() at time zone 'America/Toronto')::date,
    'cancelled', r.ev_status = 'cancelled' or lower(coalesce(r.status, '')) = 'cancelled',
    'state', case when r.confirm_status = 'confirmed' or lower(coalesce(r.status, '')) = 'confirmed' then 'confirmed'
                  when r.confirm_status = 'declined' or lower(coalesce(r.status, '')) = 'unavailable' then 'declined' else 'open' end,
    'confirmed_at', r.confirmed_at,
    'already', r.confirm_status, 'answers', r.confirm,
    'photo', v_photo,
    'guide', jsonb_build_object('expect_en', to_jsonb(g.expect_en), 'expect_fr', to_jsonb(g.expect_fr),
       'bring_en', g.bring_en, 'bring_fr', g.bring_fr, 'arrive_en', g.arrive_en, 'arrive_fr', g.arrive_fr));
end $function$;
comment on function public.volunteer_confirm_get(text) is 'wave31, wave171: what the public confirm page (hub.welfareavenue.com/c/<token>) shows for one roster row: first name, role (both languages), date, place, the format, the state (open, confirmed, declined), the role''s ready photo and what to expect. Anonymous by design; the unguessable token is the key. Never returns a phone, an email or anyone else on the roster.';

create or replace function public.volunteer_confirm_submit(p_token text, p jsonb)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare r record; v_att text; v_via text;
begin
  if p_token is null or length(p_token) < 12 then return jsonb_build_object('ok', false); end if;
  select er.id, er.status, er.confirm_status, e.event_date, e.status as ev_status into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.confirm_token = p_token;
  if not found then return jsonb_build_object('ok', false); end if;
  if r.event_date < (now() at time zone 'America/Toronto')::date or r.ev_status = 'cancelled' then
    return jsonb_build_object('ok', false, 'reason', 'past');
  end if;
  v_att := lower(coalesce(p->>'attending', ''));
  if v_att not in ('yes', 'no') then return jsonb_build_object('ok', false, 'reason', 'attending'); end if;
  v_via := case when p->>'via' in ('link', 'reply', 'form') then p->>'via' else 'link' end;
  update public.event_roster
     set confirm = coalesce(confirm, '{}'::jsonb) || (p - 'via') || jsonb_build_object('via', v_via, 'at', now()),
         confirmed_at = now(),
         confirm_status = case when v_att = 'yes' then 'confirmed' else 'declined' end,
         status = case when v_att = 'yes' then 'Confirmed' else 'Unavailable' end
   where id = r.id;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('event_roster', r.id::text, 'status', r.status, case when v_att = 'yes' then 'Confirmed' else 'Unavailable' end, 'volunteer (' || v_via || ')');
  return jsonb_build_object('ok', true, 'state', case when v_att = 'yes' then 'confirmed' else 'declined' end);
end $function$;
comment on function public.volunteer_confirm_submit(text, jsonb) is 'wave31, wave171: the volunteer''s answer from the confirm page (or a YES/NO text, via reply): attending yes sets the roster row Confirmed, no sets it Unavailable, with confirmed_at, confirm_status and the answers (confirm, with via and at); logged in change_log. Refused for a past or cancelled serving. Anonymous by design; the token is the key.';
revoke all on function public.volunteer_confirm_get(text) from public;
revoke all on function public.volunteer_confirm_submit(text, jsonb) from public;
grant execute on function public.volunteer_confirm_get(text) to anon, authenticated;
grant execute on function public.volunteer_confirm_submit(text, jsonb) to anon, authenticated;

-- ---------- 7. queueing the confirmation texts ----------
create or replace function public.wa171_queue_confirms(p_event bigint default null, p_roster bigint[] default null, p_by text default 'automation')
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_mode text; v_days int; v_hour int; v_now timestamp; v_today date; r record; v_phone text; v_body text;
        n_q int := 0; n_skip_phone int := 0; n_skip_out int := 0; n_skip_test int := 0; n_done int := 0;
begin
  v_mode := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  if v_mode not in ('test', 'live') then return jsonb_build_object('queued', 0, 'mode', v_mode, 'reason', 'Texts are off'); end if;
  v_days := coalesce(nullif((select value from public.app_config where key = 'sms_confirm_days'), '')::int, 7);
  v_hour := coalesce(nullif((select value from public.app_config where key = 'sms_confirm_hour'), '')::int, 10);
  v_now := now() at time zone 'America/Toronto'; v_today := v_now::date;
  for r in
    select er.id, er.person_id, er.confirm_token, e.id as event_id, e.event_date
      from public.event_roster er join public.volunteer_events e on e.id = er.event_id
     where e.kind = 'service' and e.status not in ('cancelled', 'completed') and e.event_date > v_today
       and (p_event is null or e.id = p_event)
       and (p_roster is null or er.id = any (p_roster))
       and (p_event is not null or p_roster is not null or (e.event_date - v_today < v_days or (e.event_date - v_today = v_days and extract(hour from v_now) >= v_hour)))
       and lower(coalesce(er.status, '')) not in ('confirmed', 'unavailable', 'cancelled')
       and er.confirm_status is null
     order by e.event_date, er.id
  loop
    if exists (select 1 from public.quo_messages q where q.roster_id = r.id and q.direction = 'out' and q.kind = 'confirm' and q.status in ('queued', 'sent')) then
      n_done := n_done + 1; continue;
    end if;
    v_phone := public.wa171_roster_phone(r.id);
    if v_phone is null then n_skip_phone := n_skip_phone + 1; continue; end if;
    if public.wa171_opted_out(r.person_id, v_phone) then n_skip_out := n_skip_out + 1; continue; end if;
    if v_mode = 'test' and not public.wa171_test_phone(v_phone) then n_skip_test := n_skip_test + 1; continue; end if;
    if r.confirm_token is null then
      update public.event_roster set confirm_token = substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 20) where id = r.id;
    end if;
    v_body := public.wa171_confirm_text(r.id, false);
    insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id)
    values (gen_random_uuid(), r.person_id, '+1' || v_phone, v_body, 'queued', r.event_id, p_by, 'out', 'confirm', r.id)
    on conflict do nothing;
    if found then n_q := n_q + 1; end if;
  end loop;
  return jsonb_build_object('queued', n_q, 'mode', v_mode, 'already_texted', n_done, 'no_phone', n_skip_phone, 'opted_out', n_skip_out, 'held_by_test_mode', n_skip_test);
end $function$;
comment on function public.wa171_queue_confirms(bigint, bigint[], text) is 'wave171: queues the confirmation text (kind confirm, status queued) for roster rows of upcoming servings that are not confirmed, declined or cancelled and were never texted: with no event or rows, those 7 days out (from 10 am Toronto on day 7, sms_confirm_days and sms_confirm_hour) or closer; with an event or rows, just those. Skips rows with no phone, anyone who opted out, and in test mode every number but sms_test_phones. Nothing is queued while sms_mode is off. Internal: called by wa171_sms_tick and wa171_text_to_confirm.';
revoke all on function public.wa171_queue_confirms(bigint, bigint[], text) from public, anon, authenticated;

create or replace function public.wa171_sms_tick()
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_mode text; v_h int; res jsonb;
begin
  v_mode := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  if v_mode not in ('test', 'live') then return jsonb_build_object('mode', v_mode); end if;
  v_h := extract(hour from now() at time zone 'America/Toronto');
  if v_h < 8 or v_h >= 20 then return jsonb_build_object('mode', v_mode, 'reason', 'outside 8 am to 8 pm'); end if;
  res := public.wa171_queue_confirms(null, null, 'automation');
  if exists (select 1 from public.quo_messages where status = 'queued' and direction = 'out') then
    perform public.call_edge('quo-send', '{"action":"drain"}'::jsonb);
  end if;
  return res;
end $function$;
comment on function public.wa171_sms_tick() is 'wave171: the every-15-minutes tick (cron wa-sms-tick): while sms_mode is test or live and between 8 am and 8 pm Toronto, queues the confirmation texts that are due and asks quo-send to send what is queued.';
revoke all on function public.wa171_sms_tick() from public, anon, authenticated;

create or replace function public.wa171_text_to_confirm(p_event bigint, p_roster bigint[] default null)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare res jsonb; v_who text;
begin
  if not (coalesce(public.is_wa_admin(), false) or coalesce(public.is_wa_leader(), false) or coalesce(public.wa_is_hr(), false)) then
    raise exception 'Only leaders, HR and admins can text volunteers.';
  end if;
  if p_event is null then raise exception 'Which serving?'; end if;
  v_who := coalesce(auth.jwt()->>'email', 'staff');
  res := public.wa171_queue_confirms(p_event, p_roster, v_who);
  if coalesce((res->>'queued')::int, 0) > 0 then perform public.call_edge('quo-send', '{"action":"drain"}'::jsonb); end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('volunteer_event', p_event::text, 'text_to_confirm', null, res::text, v_who);
  return res;
end $function$;
comment on function public.wa171_text_to_confirm(bigint, bigint[]) is 'wave171: Text to confirm on an event page: queues the confirmation text now for the chosen roster rows (or everyone on the serving not yet confirmed and never texted) and asks quo-send to send. Leaders, HR and admins only; sms_mode still decides (off: nothing; test: the test phones only). Logged.';
revoke all on function public.wa171_text_to_confirm(bigint, bigint[]) from public, anon;
grant execute on function public.wa171_text_to_confirm(bigint, bigint[]) to authenticated;

create or replace function public.wa171_sms_mode_set(p_mode text)
 returns text language plpgsql security definer set search_path to '' as $function$
declare v_old text;
begin
  if not coalesce(public.is_wa_admin(), false) then raise exception 'Only an admin can switch texts on or off.'; end if;
  if p_mode not in ('off', 'test', 'live') then raise exception 'The mode is off, test or live.'; end if;
  v_old := (select value from public.app_config where key = 'sms_mode');
  update public.app_config set value = p_mode, updated_at = now() where key = 'sms_mode';
  if p_mode = 'off' then
    update public.quo_messages set status = 'skipped', error = 'texts switched off before sending' where status = 'queued' and direction = 'out';
  end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('app_config', 'sms_mode', 'value', v_old, p_mode, coalesce(auth.jwt()->>'email', 'admin'));
  return p_mode;
end $function$;
comment on function public.wa171_sms_mode_set(text) is 'wave171: an admin switches the volunteer texts off, test (only sms_test_phones get texts) or live; logged in change_log. Switching off skips anything still queued. The assistant never calls it.';
revoke all on function public.wa171_sms_mode_set(text) from public, anon;
grant execute on function public.wa171_sms_mode_set(text) to authenticated;

-- ---------- 8. an incoming text (from quo-events, the service role) ----------
create or replace function public.wa171_inbound(p jsonb)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
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
   order by (exists (select 1 from public.quo_messages q where q.roster_id = r.id and q.kind = 'confirm' and q.status = 'sent')) desc, e.event_date, r.id
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
  elsif v_pid is null then
    v_handled := 'unmatched';
  else
    v_handled := 'question';
  end if;
  update public.quo_messages set handled = v_handled where id = v_id;

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
end $function$;
comment on function public.wa171_inbound(jsonb) is 'wave171: files an incoming text ({phone, text, quo_id, at}) in quo_messages (direction in, once per quo_id) matched to the volunteer and their next serving, then acts on keywords: STOP/ARRET always sets crm_contacts.sms_opt_out; while sms_mode is live (or test, for the test phones) YES/OUI confirms the roster row, NO/NON marks it Unavailable (both queue a short thank-you, kind ack), START opts back in; anything else is a question for the team (wave169b). Service role only (quo-events).';
revoke all on function public.wa171_inbound(jsonb) from public, anon, authenticated;

-- ---------- 9. the tick ----------
select cron.schedule('wa-sms-tick', '*/15 * * * *', $c$select public.wa171_sms_tick() where exists (select 1 from public.app_config where key = 'sms_mode' and value in ('test', 'live'))$c$);

-- ---------- 10. the first names (wa169a_texts) go ----------
drop function if exists public.wa169_inbound(jsonb);
drop function if exists public.wa169_sms_mode_set(text);
drop function if exists public.wa169_text_to_confirm(bigint, bigint[]);
drop function if exists public.wa169_sms_tick();
drop function if exists public.wa169_queue_confirms(bigint, bigint[], text);
drop function if exists public.wa169_confirm_text(bigint, boolean);
drop function if exists public.wa169_roster_phone(bigint);
drop function if exists public.wa169_opted_out(bigint, text);
drop function if exists public.wa169_lang(bigint);
drop function if exists public.wa169_test_phone(text);
drop function if exists public.wa169_digits(text);
drop function if exists public.wa169_date_words(date, text);
drop function if exists public.wa169_role_label(text, text);

-- the record
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260930020000', 'wa171_texts', array[$m$insert into public.app_config (key, value, updated_at) values
  ('sms_mode', 'off', now()),
  ('sms_test_phones', '4388694539', now()),
  ('sms_confirm_days', '7', now()),
  ('sms_confirm_hour', '10', now()),
  ('sms_link_base', 'https://hub.welfareavenue.com/c/', now())
on conflict (key) do nothing$m$,$m$create or replace function public.wa_app_config_guard()
 returns trigger language plpgsql security definer set search_path to '' as $function$
declare k text := coalesce(new.key, old.key);
begin
  if (k like 'mail\_%' or k like 'receipt\_%' or k like 'donate\_%' or k like 'loom\_%' or k like 'sms\_%') and coalesce(auth.role(), '') = 'authenticated' and not coalesce(public.is_wa_admin(), false) then
    raise exception 'Only an admin can change % (email, receipt, donation page, Loom pull and text settings).', k;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $function$$m$,$m$alter table public.quo_messages
  add column if not exists direction text not null default 'out',
  add column if not exists kind text not null default 'manual',
  add column if not exists roster_id bigint references public.event_roster(id) on delete set null,
  add column if not exists quo_id text,
  add column if not exists handled text,
  add column if not exists sent_at timestamptz$m$,$m$alter table public.quo_messages drop constraint if exists quo_messages_direction_check$m$,$m$alter table public.quo_messages add constraint quo_messages_direction_check check (direction in ('out', 'in'))$m$,$m$alter table public.quo_messages drop constraint if exists quo_messages_kind_check$m$,$m$alter table public.quo_messages add constraint quo_messages_kind_check check (kind in ('manual', 'confirm', 'confirm_test', 'inbound', 'ack'))$m$,$m$alter table public.quo_messages drop constraint if exists quo_messages_status_check$m$,$m$alter table public.quo_messages add constraint quo_messages_status_check check (status in ('dry_run', 'queued', 'sent', 'failed', 'skipped', 'received'))$m$,$m$create index if not exists quo_messages_roster_idx on public.quo_messages (roster_id)$m$,$m$create index if not exists quo_messages_event_idx on public.quo_messages (event_id, created_at desc)$m$,$m$create unique index if not exists quo_messages_confirm_once on public.quo_messages (roster_id) where direction = 'out' and kind = 'confirm' and status in ('queued', 'sent')$m$,$m$create unique index if not exists quo_messages_in_once on public.quo_messages (quo_id) where direction = 'in' and quo_id is not null$m$,$m$comment on table public.quo_messages is 'Every text to or from the ops line through Quo (OpenPhone): staff sends (quo-send), the automatic confirmation texts (wave171, kind confirm), acknowledgements (ack) and every incoming text (direction in, from the quo-events webhook). Written by quo-send, quo-events and wa171_* functions with the service role; staff read.'$m$,$m$comment on column public.quo_messages.direction is 'wave171: out (the ops line texted someone) or in (someone texted the ops line).'$m$,$m$comment on column public.quo_messages.kind is 'wave171: manual (a staff send), confirm (the confirmation text with the personal link, at most one live per roster row), confirm_test (a test to the test phones), inbound (a text received), ack (the short thank-you after a YES or NO).'$m$,$m$comment on column public.quo_messages.status is 'dry_run, queued (waiting for quo-send drain), sent, failed, skipped (sms_mode or the rules held it back; error says why) or received (inbound).'$m$,$m$comment on column public.quo_messages.roster_id is 'wave171: the event_roster row the text is about (a confirmation, or the row an incoming reply was matched to).'$m$,$m$comment on column public.quo_messages.quo_id is 'wave171: Quo''s id for the message (incoming: used to ignore a webhook delivered twice).'$m$,$m$comment on column public.quo_messages.handled is 'wave171, incoming texts: what the Hub did: confirmed, declined, opted_out, opted_in, question (for a person to answer), stored (texts are off, or test mode and not a test phone) or unmatched (no volunteer with that number).'$m$,$m$comment on column public.quo_messages.sent_at is 'wave171: when Quo accepted the text.'$m$,$m$create table if not exists public.volunteer_role_guides (
  role text primary key,
  label_en text not null,
  label_fr text not null,
  photo_id bigint references public.wa_photos(id) on delete set null,
  expect_en text[] not null default '{}',
  expect_fr text[] not null default '{}',
  bring_en text, bring_fr text,
  arrive_en text, arrive_fr text,
  updated_at timestamptz not null default now(),
  updated_by text
)$m$,$m$create index if not exists volunteer_role_guides_photo_idx on public.volunteer_role_guides (photo_id)$m$,$m$alter table public.volunteer_role_guides enable row level security$m$,$m$drop policy if exists volunteer_role_guides_staff_read on public.volunteer_role_guides$m$,$m$create policy volunteer_role_guides_staff_read on public.volunteer_role_guides for select to authenticated using ((select public.is_wa_staff()))$m$,$m$drop policy if exists volunteer_role_guides_staff_write on public.volunteer_role_guides$m$,$m$create policy volunteer_role_guides_staff_write on public.volunteer_role_guides for update to authenticated using ((select public.is_wa_staff())) with check ((select public.is_wa_staff()))$m$,$m$grant select, update on public.volunteer_role_guides to authenticated$m$,$m$comment on table public.volunteer_role_guides is 'wave171: what a volunteer sees after confirming on hub.welfareavenue.com/c/<token>: per roster role, the label (English and French), a Photo library photo (only a ready one is ever shown), what to expect, what to bring and when to arrive. Staff edit (Texts settings on an event); the public page reads it only through volunteer_confirm_get.'$m$,$m$comment on column public.volunteer_role_guides.photo_id is 'The role''s photo (wa_photos.id); shown only while that photo is ready.'$m$,$m$insert into public.volunteer_role_guides (role, label_en, label_fr, photo_id, expect_en, expect_fr, bring_en, bring_fr, arrive_en, arrive_fr) values
('cook', 'Cook', 'Bénévole en cuisine', 47,
 array['Cook your dish at home before the serving, as agreed with your team leader.', 'Your driver texts you about 10 minutes before picking up your food: have it packed and ready at the door.', 'Tell us if you need containers and we will bring some.', 'You are welcome to come and serve with the team too.'],
 array['Préparez votre plat à la maison avant le service, comme convenu avec votre responsable d''équipe.', 'Votre chauffeur vous texte environ 10 minutes avant de passer prendre votre plat : ayez-le emballé et prêt à la porte.', 'Dites-nous si vous avez besoin de contenants et nous en apporterons.', 'Vous êtes aussi le bienvenu ou la bienvenue au service avec l''équipe.'],
 'Your dish, packed, with a note of what is in it (allergens).', 'Votre plat, emballé, avec une note de ce qu''il contient (allergènes).',
 'Be ready for pickup at the time your driver gives you. The day before, we text you the itinerary and the WhatsApp group link.', 'Soyez prêt ou prête à l''heure que votre chauffeur vous donne. La veille, nous vous textons l''itinéraire et le lien du groupe WhatsApp.'),
('driver', 'Driver', 'Bénévole à la livraison', 49,
 array['Main driver: meet the team leader at the storage unit (888 Rue Saint-Antoine Ouest) at the time in your itinerary.', 'Pickup driver: follow the route through each cook''s address and text each cook 10 minutes before you arrive.', 'Bring the food to the serving, then help bring everything back after.'],
 array['Chauffeur principal : rejoignez la ou le responsable d''équipe à l''entrepôt (888, rue Saint-Antoine Ouest) à l''heure de votre itinéraire.', 'Chauffeur de collecte : suivez le trajet chez chaque bénévole en cuisine et textez chacun 10 minutes avant d''arriver.', 'Apportez la nourriture au service, puis aidez à tout ramener après.'],
 'A charged phone, your licence and a clean trunk.', 'Un téléphone chargé, votre permis et un coffre dégagé.',
 'The start time in your itinerary. The day before, we text you the itinerary and the WhatsApp group link.', 'L''heure de départ de votre itinéraire. La veille, nous vous textons l''itinéraire et le lien du groupe WhatsApp.'),
('server', 'Server', 'Bénévole au service', 28,
 array['Meet the team at the serving spot and help set up the tables.', 'Get a pinny from the team leaders.', 'Sanitize your hands, wear gloves and serve with care and a smile.', 'Dirty containers go in the gray bin; help pack up at the end.'],
 array['Rejoignez l''équipe sur le lieu du service et aidez à monter les tables.', 'Prenez un dossard auprès des responsables d''équipe.', 'Lavez-vous les mains, portez des gants et servez avec soin et le sourire.', 'Les contenants sales vont dans le bac gris; aidez à ranger à la fin.'],
 'Clothes for outside and the weather, and water for yourself.', 'Des vêtements pour l''extérieur et la météo, et de l''eau pour vous.',
 'The arrival time in your itinerary. The day before, we text you the itinerary and the WhatsApp group link.', 'L''heure d''arrivée de votre itinéraire. La veille, nous vous textons l''itinéraire et le lien du groupe WhatsApp.'),
('team_leader', 'Team leader', 'Responsable d''équipe', 58,
 array['Meet the main driver at the storage unit at the time in your itinerary.', 'Share your ETA in the group chat and keep the team together.', 'At the serving, every cook and server scans the attendance QR code, and you run the community debrief.', 'After: dishwashing at Old Brewery Mission, back to the storage unit, then the weekly audit and restock form.'],
 array['Rejoignez le chauffeur principal à l''entrepôt à l''heure de votre itinéraire.', 'Partagez votre heure d''arrivée dans le groupe et gardez l''équipe ensemble.', 'Au service, chaque bénévole scanne le code QR de présence, et vous animez le bilan communautaire.', 'Après : la vaisselle à la Mission Old Brewery, le retour à l''entrepôt, puis le formulaire d''inventaire de la semaine.'],
 'Your phone, charged. The codes are in your itinerary.', 'Votre téléphone, chargé. Les codes sont dans votre itinéraire.',
 'The storage unit, at the time in the Team Leader and Driver itinerary.', 'L''entrepôt, à l''heure de l''itinéraire des responsables et des chauffeurs.'),
('dishwasher', 'Dishwasher', 'Bénévole à la vaisselle', 35,
 array['After the serving, the dirty containers go to Old Brewery Mission (915 Clark); ask for Rafael.', 'Wash, dry and pack the containers for the storage unit.'],
 array['Après le service, les contenants sales vont à la Mission Old Brewery (915, rue Clark); demandez Rafael.', 'Lavez, séchez et rangez les contenants pour l''entrepôt.'],
 'Clothes that can get wet.', 'Des vêtements qui peuvent se mouiller.',
 'The time in your itinerary.', 'L''heure de votre itinéraire.'),
('photographer', 'Photographer', 'Photographe', 29,
 array['Photograph the team, the food and the setup.', 'No close-ups of the people we serve, and ask before photographing anyone.', 'Share your photos with the team after the serving.'],
 array['Photographiez l''équipe, la nourriture et l''installation.', 'Pas de gros plans des personnes que nous servons, et demandez avant de photographier quelqu''un.', 'Partagez vos photos avec l''équipe après le service.'],
 'Your camera or phone, charged.', 'Votre appareil ou votre téléphone, chargé.',
 'The arrival time in your itinerary.', 'L''heure d''arrivée de votre itinéraire.'),
('community_debrief', 'Community debrief', 'Bilan communautaire', 56,
 array['Help the team leader run the short debrief with the community after the serving.', 'Listen, note what people tell us, and thank them.'],
 array['Aidez la ou le responsable d''équipe à animer le court bilan avec la communauté après le service.', 'Écoutez, notez ce que les gens nous disent et remerciez-les.'],
 null, null, 'The arrival time in your itinerary.', 'L''heure d''arrivée de votre itinéraire.'),
('community_talker', 'Community welcome', 'Accueil', 26,
 array['Welcome people in the line and chat with them while they wait.', 'Point people to the table and to the clothes when there are some.'],
 array['Accueillez les gens dans la file et discutez avec eux pendant l''attente.', 'Orientez les gens vers la table et les vêtements quand il y en a.'],
 null, null, 'The arrival time in your itinerary.', 'L''heure d''arrivée de votre itinéraire.'),
('volunteer', 'Volunteer', 'Bénévole', 26,
 array['Meet the team at the serving spot and help where it is needed.', 'The team leader tells you what to do when you arrive.'],
 array['Rejoignez l''équipe sur le lieu du service et aidez là où c''est utile.', 'La ou le responsable d''équipe vous dit quoi faire à votre arrivée.'],
 'Clothes for outside and the weather.', 'Des vêtements pour l''extérieur et la météo.',
 'The arrival time in your itinerary. The day before, we text you the itinerary and the WhatsApp group link.', 'L''heure d''arrivée de votre itinéraire. La veille, nous vous textons l''itinéraire et le lien du groupe WhatsApp.')
on conflict (role) do nothing$m$,$m$alter table public.volunteer_events
  add column if not exists format text,
  add column if not exists kitchen_place text,
  add column if not exists kitchen_contact text,
  add column if not exists kitchen_shift text,
  add column if not exists ingredients_note text$m$,$m$alter table public.volunteer_events drop constraint if exists volunteer_events_format_check$m$,$m$alter table public.volunteer_events add constraint volunteer_events_format_check check (format is null or format in ('home_cooked', 'community_kitchen'))$m$,$m$comment on column public.volunteer_events.format is 'wave171: how the food is made: home_cooked (cooks cook at home, the pickup driver collects it; the standard since 2023) or community_kitchen (volunteers cook together at a community kitchen, for example La Poubelle Magnifique, 1221 Rue Crescent). Null = not set yet (a gap on the calendar for an upcoming serving).'$m$,$m$comment on column public.volunteer_events.kitchen_place is 'wave171, community_kitchen servings: the kitchen (name and address).'$m$,$m$comment on column public.volunteer_events.kitchen_contact is 'wave171, community_kitchen servings: who to reach at the kitchen (a name; no personal phone numbers here).'$m$,$m$comment on column public.volunteer_events.kitchen_shift is 'wave171, community_kitchen servings: the cooking shift (for example 9:00 to 12:30).'$m$,$m$comment on column public.volunteer_events.ingredients_note is 'wave171, community_kitchen servings: when and where the ingredients arrive, and fridge space.'$m$,$m$create or replace view public.volunteer_event_summary with (security_invoker = on) as
 select id, code, event_date, season, location, status, kind,
    coalesce(title, case when kind = 'service' then 'Sunday serving' else initcap(kind) end) as title,
    notes,
    (select count(*) from public.event_roster r where r.event_id = e.id) as roster_count,
    (select count(*) from public.event_roster r where r.event_id = e.id and r.status ilike 'confirmed') as roster_confirmed,
    (select count(*) from public.sop_event_steps s where s.event_id = e.id) as steps_total,
    (select count(*) from public.sop_event_steps s where s.event_id = e.id and s.done) as steps_done,
    (select count(*) from public.sop_event_extras x where x.event_id = e.id) as extras_total,
    (select count(*) from public.sop_event_extras x where x.event_id = e.id and not x.done) as extras_open,
    format,
    (select count(*) from public.event_roster r where r.event_id = e.id and r.confirm_status = 'confirmed') as roster_by_link,
    (select count(*) from public.event_roster r where r.event_id = e.id and r.status ilike 'unavailable') as roster_declined,
    (select count(distinct q.roster_id) from public.quo_messages q where q.event_id = e.id and q.direction = 'out' and q.kind = 'confirm' and q.status = 'sent') as roster_texted
   from public.volunteer_events e$m$,$m$comment on view public.volunteer_event_summary is 'One row per volunteering event with its roster and checklist counts (security invoker: staff read). wave171 adds format, roster_by_link (confirmed on the text link or by replying YES), roster_declined (Unavailable) and roster_texted (sent a confirmation text).'$m$,$m$create or replace function public.wa171_role_label(p_role text, p_lang text default 'en')
 returns text language sql stable security definer set search_path to '' as $$
  select coalesce(
    (select case when lower(coalesce(p_lang, 'en')) like 'fr%' then g.label_fr else g.label_en end from public.volunteer_role_guides g where g.role = lower(p_role)),
    initcap(replace(coalesce(p_role, 'volunteer'), '_', ' ')));
$$$m$,$m$comment on function public.wa171_role_label(text, text) is 'wave171: a roster role''s label in English or French (volunteer_role_guides, else the role code in words).'$m$,$m$create or replace function public.wa171_date_words(p_day date, p_lang text default 'en')
 returns text language sql immutable set search_path to '' as $$
  select case when lower(coalesce(p_lang, 'en')) like 'fr%' then
      (array['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'])[extract(dow from p_day)::int + 1] || ' ' ||
      extract(day from p_day)::int || case when extract(day from p_day) = 1 then 'er' else '' end || ' ' ||
      (array['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'])[extract(month from p_day)::int]
    else trim(to_char(p_day, 'FMDay')) || ', ' || trim(to_char(p_day, 'FMMonth')) || ' ' || extract(day from p_day)::int end;
$$$m$,$m$comment on function public.wa171_date_words(date, text) is 'wave171: a date in words for a text (Sunday, October 4 / dimanche 4 octobre).'$m$,$m$create or replace function public.wa171_digits(p text)
 returns text language sql immutable set search_path to '' as $$
  select case when length(regexp_replace(coalesce(p, ''), '\D', '', 'g')) >= 10 then right(regexp_replace(p, '\D', '', 'g'), 10) else null end;
$$$m$,$m$comment on function public.wa171_digits(text) is 'wave171: a phone number''s last 10 digits (how every Hub table matches numbers), or null.'$m$,$m$create or replace function public.wa171_test_phone(p_phone text)
 returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.app_config c, unnest(string_to_array(c.value, ',')) t(x)
                 where c.key = 'sms_test_phones' and public.wa171_digits(t.x) = public.wa171_digits(p_phone));
$$$m$,$m$comment on function public.wa171_test_phone(text) is 'wave171: true when the number is one of app_config sms_test_phones (the only numbers texted while sms_mode is test).'$m$,$m$create or replace function public.wa171_lang(p_person bigint)
 returns text language sql stable security definer set search_path to '' as $$
  select case when exists (select 1 from public.crm_contacts c where c.volunteer_id = p_person and c.merged_into is null and lower(coalesce(c.language, '')) like 'fr%') then 'fr' else 'en' end;
$$$m$,$m$comment on function public.wa171_lang(bigint) is 'wave171: the language to text a volunteer in (fr when their CRM contact says so, else en).'$m$,$m$create or replace function public.wa171_opted_out(p_person bigint, p_phone text)
 returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.crm_contacts c where c.sms_opt_out and c.merged_into is null
                 and (c.volunteer_id = p_person or exists (select 1 from unnest(c.phones) ph where public.wa171_digits(ph) = public.wa171_digits(p_phone))));
$$$m$,$m$comment on function public.wa171_opted_out(bigint, text) is 'wave171: true when the volunteer (or anyone with that number) replied STOP or was marked no texts in the CRM (crm_contacts.sms_opt_out).'$m$,$m$create or replace function public.wa171_roster_phone(p_roster bigint)
 returns text language sql stable security definer set search_path to '' as $$
  select coalesce(
    (select public.wa171_digits(ph) from public.event_roster r join public.volunteer_people p on p.id = r.person_id, unnest(p.phones) ph
      where r.id = p_roster and public.wa171_digits(ph) is not null limit 1),
    (select public.wa171_digits(r.detail->>'phone') from public.event_roster r where r.id = p_roster));
$$$m$,$m$comment on function public.wa171_roster_phone(bigint) is 'wave171: the number to text for a roster row (the volunteer''s first phone, else the phone on the row), 10 digits.'$m$,$m$create or replace function public.wa171_confirm_text(p_roster bigint, p_test boolean default false)
 returns text language plpgsql stable security definer set search_path to '' as $$
declare r record; v_lang text; v_first text; v_role text; v_day text; v_link text; v_art text;
begin
  select er.id, er.person_id, er.person_name, er.role, er.confirm_token, e.event_date into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.id = p_roster;
  if not found or r.confirm_token is null then return null; end if;
  v_lang := public.wa171_lang(r.person_id);
  v_first := coalesce(nullif(split_part(trim(coalesce(r.person_name, '')), ' ', 1), ''), case when v_lang = 'fr' then 'bonjour' else 'there' end);
  v_role := lower(public.wa171_role_label(r.role, v_lang));
  v_day := public.wa171_date_words(r.event_date, v_lang);
  v_link := coalesce((select value from public.app_config where key = 'sms_link_base'), 'https://hub.welfareavenue.com/c/') || r.confirm_token || case when p_test then '?test=1' else '' end;
  if v_lang = 'fr' then
    return 'Bonjour ' || v_first || ', ici Welfare Avenue! Vous êtes sur la liste comme ' || v_role || ' pour notre service du ' || v_day
      || '. Confirmez ici : ' || v_link || ' (ou répondez OUI ou NON). Répondez ARRET pour ne plus recevoir de textos.';
  end if;
  v_art := case when v_role ~ '^[aeiou]' then 'an ' else 'a ' end;
  return 'Hi ' || v_first || ', it''s Welfare Avenue! You''re on the list as ' || v_art || v_role || ' for our serving on ' || v_day
    || '. Please confirm here: ' || v_link || ' (or reply YES or NO). Reply STOP to stop texts.';
end $$$m$,$m$comment on function public.wa171_confirm_text(bigint, boolean) is 'wave171: the confirmation text for a roster row, in the volunteer''s language, with their personal link (p_test adds ?test=1: the page then saves nothing).'$m$,$m$create or replace function public.volunteer_confirm_get(p_token text)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare r record; g record; v_photo jsonb; v_lang text;
begin
  if p_token is null or length(p_token) < 12 then return null; end if;
  select er.id, er.person_id, er.person_name, er.role, er.status, er.confirm_status, er.confirmed_at, er.confirm,
         e.event_date, e.title, e.location, e.code, e.kind, e.status as ev_status, e.format, e.kitchen_place, e.kitchen_shift
    into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id
   where er.confirm_token = p_token;
  if not found then return null; end if;
  select * into g from public.volunteer_role_guides where role = lower(r.role);
  if not found then select * into g from public.volunteer_role_guides where role = 'volunteer'; end if;
  select jsonb_build_object('path', p.path_web, 'alt', p.alt_text, 'fx', p.focal_x, 'fy', p.focal_y) into v_photo
    from public.wa_photos p where p.id = g.photo_id and p.status = 'ready' and p.usage = 'ready' and p.path_web is not null;
  v_lang := public.wa171_lang(r.person_id);
  return jsonb_build_object(
    'first', split_part(trim(coalesce(r.person_name, '')), ' ', 1),
    'name', r.person_name, 'role', r.role,
    'role_en', public.wa171_role_label(r.role, 'en'), 'role_fr', public.wa171_role_label(r.role, 'fr'),
    'event_date', r.event_date, 'event_title', coalesce(r.title, 'Sunday serving'), 'location', coalesce(r.location, 'Montreal'),
    'code', r.code, 'lang', v_lang,
    'format', r.format, 'kitchen_place', case when r.format = 'community_kitchen' then r.kitchen_place end,
    'kitchen_shift', case when r.format = 'community_kitchen' then r.kitchen_shift end,
    'past', r.event_date < (now() at time zone 'America/Toronto')::date,
    'cancelled', r.ev_status = 'cancelled' or lower(coalesce(r.status, '')) = 'cancelled',
    'state', case when r.confirm_status = 'confirmed' or lower(coalesce(r.status, '')) = 'confirmed' then 'confirmed'
                  when r.confirm_status = 'declined' or lower(coalesce(r.status, '')) = 'unavailable' then 'declined' else 'open' end,
    'confirmed_at', r.confirmed_at,
    'already', r.confirm_status, 'answers', r.confirm,
    'photo', v_photo,
    'guide', jsonb_build_object('expect_en', to_jsonb(g.expect_en), 'expect_fr', to_jsonb(g.expect_fr),
       'bring_en', g.bring_en, 'bring_fr', g.bring_fr, 'arrive_en', g.arrive_en, 'arrive_fr', g.arrive_fr));
end $function$$m$,$m$comment on function public.volunteer_confirm_get(text) is 'wave31, wave171: what the public confirm page (hub.welfareavenue.com/c/<token>) shows for one roster row: first name, role (both languages), date, place, the format, the state (open, confirmed, declined), the role''s ready photo and what to expect. Anonymous by design; the unguessable token is the key. Never returns a phone, an email or anyone else on the roster.'$m$,$m$create or replace function public.volunteer_confirm_submit(p_token text, p jsonb)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare r record; v_att text; v_via text;
begin
  if p_token is null or length(p_token) < 12 then return jsonb_build_object('ok', false); end if;
  select er.id, er.status, er.confirm_status, e.event_date, e.status as ev_status into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.confirm_token = p_token;
  if not found then return jsonb_build_object('ok', false); end if;
  if r.event_date < (now() at time zone 'America/Toronto')::date or r.ev_status = 'cancelled' then
    return jsonb_build_object('ok', false, 'reason', 'past');
  end if;
  v_att := lower(coalesce(p->>'attending', ''));
  if v_att not in ('yes', 'no') then return jsonb_build_object('ok', false, 'reason', 'attending'); end if;
  v_via := case when p->>'via' in ('link', 'reply', 'form') then p->>'via' else 'link' end;
  update public.event_roster
     set confirm = coalesce(confirm, '{}'::jsonb) || (p - 'via') || jsonb_build_object('via', v_via, 'at', now()),
         confirmed_at = now(),
         confirm_status = case when v_att = 'yes' then 'confirmed' else 'declined' end,
         status = case when v_att = 'yes' then 'Confirmed' else 'Unavailable' end
   where id = r.id;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('event_roster', r.id::text, 'status', r.status, case when v_att = 'yes' then 'Confirmed' else 'Unavailable' end, 'volunteer (' || v_via || ')');
  return jsonb_build_object('ok', true, 'state', case when v_att = 'yes' then 'confirmed' else 'declined' end);
end $function$$m$,$m$comment on function public.volunteer_confirm_submit(text, jsonb) is 'wave31, wave171: the volunteer''s answer from the confirm page (or a YES/NO text, via reply): attending yes sets the roster row Confirmed, no sets it Unavailable, with confirmed_at, confirm_status and the answers (confirm, with via and at); logged in change_log. Refused for a past or cancelled serving. Anonymous by design; the token is the key.'$m$,$m$revoke all on function public.volunteer_confirm_get(text) from public$m$,$m$revoke all on function public.volunteer_confirm_submit(text, jsonb) from public$m$,$m$grant execute on function public.volunteer_confirm_get(text) to anon, authenticated$m$,$m$grant execute on function public.volunteer_confirm_submit(text, jsonb) to anon, authenticated$m$,$m$create or replace function public.wa171_queue_confirms(p_event bigint default null, p_roster bigint[] default null, p_by text default 'automation')
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_mode text; v_days int; v_hour int; v_now timestamp; v_today date; r record; v_phone text; v_body text;
        n_q int := 0; n_skip_phone int := 0; n_skip_out int := 0; n_skip_test int := 0; n_done int := 0;
begin
  v_mode := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  if v_mode not in ('test', 'live') then return jsonb_build_object('queued', 0, 'mode', v_mode, 'reason', 'Texts are off'); end if;
  v_days := coalesce(nullif((select value from public.app_config where key = 'sms_confirm_days'), '')::int, 7);
  v_hour := coalesce(nullif((select value from public.app_config where key = 'sms_confirm_hour'), '')::int, 10);
  v_now := now() at time zone 'America/Toronto'; v_today := v_now::date;
  for r in
    select er.id, er.person_id, er.confirm_token, e.id as event_id, e.event_date
      from public.event_roster er join public.volunteer_events e on e.id = er.event_id
     where e.kind = 'service' and e.status not in ('cancelled', 'completed') and e.event_date > v_today
       and (p_event is null or e.id = p_event)
       and (p_roster is null or er.id = any (p_roster))
       and (p_event is not null or p_roster is not null or (e.event_date - v_today < v_days or (e.event_date - v_today = v_days and extract(hour from v_now) >= v_hour)))
       and lower(coalesce(er.status, '')) not in ('confirmed', 'unavailable', 'cancelled')
       and er.confirm_status is null
     order by e.event_date, er.id
  loop
    if exists (select 1 from public.quo_messages q where q.roster_id = r.id and q.direction = 'out' and q.kind = 'confirm' and q.status in ('queued', 'sent')) then
      n_done := n_done + 1; continue;
    end if;
    v_phone := public.wa171_roster_phone(r.id);
    if v_phone is null then n_skip_phone := n_skip_phone + 1; continue; end if;
    if public.wa171_opted_out(r.person_id, v_phone) then n_skip_out := n_skip_out + 1; continue; end if;
    if v_mode = 'test' and not public.wa171_test_phone(v_phone) then n_skip_test := n_skip_test + 1; continue; end if;
    if r.confirm_token is null then
      update public.event_roster set confirm_token = substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 20) where id = r.id;
    end if;
    v_body := public.wa171_confirm_text(r.id, false);
    insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id)
    values (gen_random_uuid(), r.person_id, '+1' || v_phone, v_body, 'queued', r.event_id, p_by, 'out', 'confirm', r.id)
    on conflict do nothing;
    if found then n_q := n_q + 1; end if;
  end loop;
  return jsonb_build_object('queued', n_q, 'mode', v_mode, 'already_texted', n_done, 'no_phone', n_skip_phone, 'opted_out', n_skip_out, 'held_by_test_mode', n_skip_test);
end $function$$m$,$m$comment on function public.wa171_queue_confirms(bigint, bigint[], text) is 'wave171: queues the confirmation text (kind confirm, status queued) for roster rows of upcoming servings that are not confirmed, declined or cancelled and were never texted: with no event or rows, those 7 days out (from 10 am Toronto on day 7, sms_confirm_days and sms_confirm_hour) or closer; with an event or rows, just those. Skips rows with no phone, anyone who opted out, and in test mode every number but sms_test_phones. Nothing is queued while sms_mode is off. Internal: called by wa171_sms_tick and wa171_text_to_confirm.'$m$,$m$revoke all on function public.wa171_queue_confirms(bigint, bigint[], text) from public, anon, authenticated$m$,$m$create or replace function public.wa171_sms_tick()
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_mode text; v_h int; res jsonb;
begin
  v_mode := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  if v_mode not in ('test', 'live') then return jsonb_build_object('mode', v_mode); end if;
  v_h := extract(hour from now() at time zone 'America/Toronto');
  if v_h < 8 or v_h >= 20 then return jsonb_build_object('mode', v_mode, 'reason', 'outside 8 am to 8 pm'); end if;
  res := public.wa171_queue_confirms(null, null, 'automation');
  if exists (select 1 from public.quo_messages where status = 'queued' and direction = 'out') then
    perform public.call_edge('quo-send', '{"action":"drain"}'::jsonb);
  end if;
  return res;
end $function$$m$,$m$comment on function public.wa171_sms_tick() is 'wave171: the every-15-minutes tick (cron wa-sms-tick): while sms_mode is test or live and between 8 am and 8 pm Toronto, queues the confirmation texts that are due and asks quo-send to send what is queued.'$m$,$m$revoke all on function public.wa171_sms_tick() from public, anon, authenticated$m$,$m$create or replace function public.wa171_text_to_confirm(p_event bigint, p_roster bigint[] default null)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare res jsonb; v_who text;
begin
  if not (coalesce(public.is_wa_admin(), false) or coalesce(public.is_wa_leader(), false) or coalesce(public.wa_is_hr(), false)) then
    raise exception 'Only leaders, HR and admins can text volunteers.';
  end if;
  if p_event is null then raise exception 'Which serving?'; end if;
  v_who := coalesce(auth.jwt()->>'email', 'staff');
  res := public.wa171_queue_confirms(p_event, p_roster, v_who);
  if coalesce((res->>'queued')::int, 0) > 0 then perform public.call_edge('quo-send', '{"action":"drain"}'::jsonb); end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('volunteer_event', p_event::text, 'text_to_confirm', null, res::text, v_who);
  return res;
end $function$$m$,$m$comment on function public.wa171_text_to_confirm(bigint, bigint[]) is 'wave171: Text to confirm on an event page: queues the confirmation text now for the chosen roster rows (or everyone on the serving not yet confirmed and never texted) and asks quo-send to send. Leaders, HR and admins only; sms_mode still decides (off: nothing; test: the test phones only). Logged.'$m$,$m$revoke all on function public.wa171_text_to_confirm(bigint, bigint[]) from public, anon$m$,$m$grant execute on function public.wa171_text_to_confirm(bigint, bigint[]) to authenticated$m$,$m$create or replace function public.wa171_sms_mode_set(p_mode text)
 returns text language plpgsql security definer set search_path to '' as $function$
declare v_old text;
begin
  if not coalesce(public.is_wa_admin(), false) then raise exception 'Only an admin can switch texts on or off.'; end if;
  if p_mode not in ('off', 'test', 'live') then raise exception 'The mode is off, test or live.'; end if;
  v_old := (select value from public.app_config where key = 'sms_mode');
  update public.app_config set value = p_mode, updated_at = now() where key = 'sms_mode';
  if p_mode = 'off' then
    update public.quo_messages set status = 'skipped', error = 'texts switched off before sending' where status = 'queued' and direction = 'out';
  end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('app_config', 'sms_mode', 'value', v_old, p_mode, coalesce(auth.jwt()->>'email', 'admin'));
  return p_mode;
end $function$$m$,$m$comment on function public.wa171_sms_mode_set(text) is 'wave171: an admin switches the volunteer texts off, test (only sms_test_phones get texts) or live; logged in change_log. Switching off skips anything still queued. The assistant never calls it.'$m$,$m$revoke all on function public.wa171_sms_mode_set(text) from public, anon$m$,$m$grant execute on function public.wa171_sms_mode_set(text) to authenticated$m$,$m$create or replace function public.wa171_inbound(p jsonb)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
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
   order by (exists (select 1 from public.quo_messages q where q.roster_id = r.id and q.kind = 'confirm' and q.status = 'sent')) desc, e.event_date, r.id
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
  elsif v_pid is null then
    v_handled := 'unmatched';
  else
    v_handled := 'question';
  end if;
  update public.quo_messages set handled = v_handled where id = v_id;

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
end $function$$m$,$m$comment on function public.wa171_inbound(jsonb) is 'wave171: files an incoming text ({phone, text, quo_id, at}) in quo_messages (direction in, once per quo_id) matched to the volunteer and their next serving, then acts on keywords: STOP/ARRET always sets crm_contacts.sms_opt_out; while sms_mode is live (or test, for the test phones) YES/OUI confirms the roster row, NO/NON marks it Unavailable (both queue a short thank-you, kind ack), START opts back in; anything else is a question for the team (wave169b). Service role only (quo-events).'$m$,$m$revoke all on function public.wa171_inbound(jsonb) from public, anon, authenticated$m$,$m$select cron.schedule('wa-sms-tick', '*/15 * * * *', $c$select public.wa171_sms_tick() where exists (select 1 from public.app_config where key = 'sms_mode' and value in ('test', 'live'))$c$)$m$,$m$drop function if exists public.wa169_inbound(jsonb)$m$,$m$drop function if exists public.wa169_sms_mode_set(text)$m$,$m$drop function if exists public.wa169_text_to_confirm(bigint, bigint[])$m$,$m$drop function if exists public.wa169_sms_tick()$m$,$m$drop function if exists public.wa169_queue_confirms(bigint, bigint[], text)$m$,$m$drop function if exists public.wa169_confirm_text(bigint, boolean)$m$,$m$drop function if exists public.wa169_roster_phone(bigint)$m$,$m$drop function if exists public.wa169_opted_out(bigint, text)$m$,$m$drop function if exists public.wa169_lang(bigint)$m$,$m$drop function if exists public.wa169_test_phone(text)$m$,$m$drop function if exists public.wa169_digits(text)$m$,$m$drop function if exists public.wa169_date_words(date, text)$m$,$m$drop function if exists public.wa169_role_label(text, text)$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
