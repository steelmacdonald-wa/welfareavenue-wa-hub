-- wa172_roles (30/09/26): each role's own questions and links on the confirm page, the sign-up notice, and the survey text.
-- Steel (30/09/26): cooks choose what recipe they plan to cook from our options; "confirmation texts should only be 7 days
-- before the event they signed up to. When volunteers sign up for more than one event or an event one month in the future
-- they should only be notified that they have the event(s) coming up and that they have the option to add it in their
-- calendar"; servers can bring donations and get a quick survey after the event; new drivers give their car model and type;
-- photographers get the ways to share their photos (from the SOP); the Community Lead (community debrief) gets a run-down
-- and the forms to capture data at the events; and the team leader. Links from the master SOP (sop_template).

-- ---------- 1. settings ----------
insert into public.app_config (key, value, updated_at) values
  ('sms_survey_url', 'https://docs.google.com/forms/d/e/1FAIpQLSdanXK0Ud8RnKOZuzA8Cob_WL6NiayKHHMzo0BkmXHsEELIyg/viewform', now()),
  ('sms_survey_roles', 'server', now()),
  ('sms_survey_hour', '18', now())
on conflict (key) do nothing;

-- ---------- 2. the roster: when a row was added, and the sign-up notice ----------
alter table public.event_roster add column if not exists created_at timestamptz;
alter table public.event_roster alter column created_at set default now();
alter table public.event_roster add column if not exists signup_noticed_at timestamptz;
alter table public.event_roster alter column confirm_token set default substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 20);
comment on column public.event_roster.created_at is 'wave172: when the row was added (null for rows from before 30/09/26). The sign-up notice text goes only for rows added in the last 3 days.';
comment on column public.event_roster.signup_noticed_at is 'wave172: when the volunteer was texted that they are on the list for this serving (the sign-up notice, for servings more than 7 days away; the confirmation text follows 7 days before).';
comment on column public.event_roster.confirm_token is 'The personal link''s key (hub.welfareavenue.com/c/<token>): set on every new row since wave172. Anonymous pages read the row only through volunteer_confirm_get.';

-- ---------- 3. the text kinds ----------
alter table public.quo_messages drop constraint if exists quo_messages_kind_check;
alter table public.quo_messages add constraint quo_messages_kind_check check (kind in ('manual', 'confirm', 'confirm_test', 'inbound', 'ack', 'signup', 'survey'));
create unique index if not exists quo_messages_survey_once on public.quo_messages (roster_id) where direction = 'out' and kind = 'survey' and status in ('queued', 'sent');
comment on column public.quo_messages.kind is 'manual (a staff send), confirm (the confirmation text with the personal link, 7 days before; one live per roster row), confirm_test (a test to the test phones), inbound (a text received), ack (the short thank-you after a YES or NO), signup (wave172: "you are on the list for ...", sent when someone is added to servings more than 7 days away), survey (wave172: the quick survey after the serving, for the roles in sms_survey_roles).';

-- ---------- 4. links per role ----------
alter table public.volunteer_role_guides add column if not exists links jsonb not null default '[]'::jsonb;
comment on column public.volunteer_role_guides.links is 'wave172: the forms and documents the role needs, [{label_en, label_fr, url, when: before | during | after}], shown on the confirm page after confirming (from the master SOP).';

update public.volunteer_role_guides set
  expect_en = array['Cook your dish at home before the serving, as agreed with your team leader.', 'Choose your dish below from our recipes, so the meal is balanced.', 'Your driver texts you about 10 minutes before picking up your food: have it packed and ready at the door.', 'Tell us if you need containers and we will bring some.', 'You are welcome to come and serve with the team too.'],
  expect_fr = array['Préparez votre plat à la maison avant le service, comme convenu avec votre responsable d''équipe.', 'Choisissez votre plat ci-dessous parmi nos recettes, pour un repas équilibré.', 'Votre chauffeur vous texte environ 10 minutes avant de passer prendre votre plat : ayez-le emballé et prêt à la porte.', 'Dites-nous si vous avez besoin de contenants et nous en apporterons.', 'Vous êtes aussi le bienvenu ou la bienvenue au service avec l''équipe.'],
  updated_at = now(), updated_by = 'wa172'
where role = 'cook';

update public.volunteer_role_guides set
  expect_en = array['Meet the team at the serving spot and help set up the tables.', 'Get a pinny from the team leaders.', 'Sanitize your hands, wear gloves and serve with care and a smile.', 'Have clothes, toiletries or anything else you would like to donate? Bring them along, and tell us below so the team can plan for them.', 'Dirty containers go in the gray bin; help pack up at the end.', 'After the serving we text you a two-minute survey: it helps us get better.'],
  expect_fr = array['Rejoignez l''équipe sur le lieu du service et aidez à monter les tables.', 'Prenez un dossard auprès des responsables d''équipe.', 'Lavez-vous les mains, portez des gants et servez avec soin et le sourire.', 'Vous avez des vêtements, des articles d''hygiène ou autre chose à donner? Apportez-les et dites-le-nous ci-dessous pour que l''équipe s''organise.', 'Les contenants sales vont dans le bac gris; aidez à ranger à la fin.', 'Après le service, nous vous textons un sondage de deux minutes : il nous aide à nous améliorer.'],
  links = '[{"label_en":"Volunteer survey (after the serving)","label_fr":"Sondage des bénévoles (après le service)","url":"https://docs.google.com/forms/d/e/1FAIpQLSdanXK0Ud8RnKOZuzA8Cob_WL6NiayKHHMzo0BkmXHsEELIyg/viewform","when":"after"}]'::jsonb,
  updated_at = now(), updated_by = 'wa172'
where role = 'server';

update public.volunteer_role_guides set
  expect_en = array['Main driver: meet the team leader at the storage unit (888 Rue Saint-Antoine Ouest) at the time in your itinerary.', 'Pickup driver: follow the route through each cook''s address and text each cook 10 minutes before you arrive.', 'Bring the food to the serving, then help bring everything back after.', 'Gas is reimbursed after the serving (up to $15, from the kilometres of the route).', 'Driving with us for the first time? Tell us your car below so we can plan the pickups.'],
  expect_fr = array['Chauffeur principal : rejoignez la ou le responsable d''équipe à l''entrepôt (888, rue Saint-Antoine Ouest) à l''heure de votre itinéraire.', 'Chauffeur de collecte : suivez le trajet chez chaque bénévole en cuisine et textez chacun 10 minutes avant d''arriver.', 'Apportez la nourriture au service, puis aidez à tout ramener après.', 'L''essence est remboursée après le service (jusqu''à 15 $, selon les kilomètres du trajet).', 'Vous conduisez avec nous pour la première fois? Indiquez votre voiture ci-dessous pour que nous planifiions les collectes.'],
  links = '[{"label_en":"The driver role","label_fr":"Le rôle de chauffeur","url":"https://docs.google.com/document/d/1GN4LE1fFrhFZImSN8ytKQBhTW1sliJ3lh-AOmiVdFik/edit?usp=sharing","when":"before"}]'::jsonb,
  updated_at = now(), updated_by = 'wa172'
where role = 'driver';

update public.volunteer_role_guides set
  expect_en = array['Read the content guide before the serving (below): what we like to capture and how.', 'Photograph the team, the food and the setup.', 'No close-ups of the people we serve, and ask before photographing anyone.', 'Within 24 hours, send us everything you captured: add it to the shared Google Photos album or the Drive folder, or email it to marketing@welfareavenue.com.'],
  expect_fr = array['Lisez le guide de contenu avant le service (ci-dessous) : ce que nous aimons saisir et comment.', 'Photographiez l''équipe, la nourriture et l''installation.', 'Pas de gros plans des personnes que nous servons, et demandez avant de photographier quelqu''un.', 'Dans les 24 heures, envoyez-nous tout ce que vous avez pris : ajoutez-le à l''album Google Photos partagé ou au dossier Drive, ou écrivez à marketing@welfareavenue.com.'],
  links = '[{"label_en":"Content guide","label_fr":"Guide de contenu","url":"https://drive.google.com/file/d/1we30El1jsDiDJ2W2kM2morwYHWlt1_n2/view?usp=sharing","when":"before"},
            {"label_en":"Add your photos to the Google Photos album","label_fr":"Ajouter vos photos à l''album Google Photos","url":"https://photos.app.goo.gl/JVctP4STEHSKzPfJ9","when":"after"},
            {"label_en":"Or upload them to the Drive folder","label_fr":"Ou les téléverser dans le dossier Drive","url":"https://drive.google.com/drive/folders/1KjFSKuszt-rXIDb9nuXg_2UTISY0IwqQ?usp=sharing","when":"after"},
            {"label_en":"Or email them to marketing@welfareavenue.com","label_fr":"Ou les envoyer à marketing@welfareavenue.com","url":"mailto:marketing@welfareavenue.com?subject=Photos%20from%20the%20serving","when":"after"}]'::jsonb,
  updated_at = now(), updated_by = 'wa172'
where role = 'photographer';

update public.volunteer_role_guides set
  label_en = 'Community lead', label_fr = 'Responsable communautaire',
  expect_en = array['You are the team''s link with the community. Arrive with the team and check in with the team leader.', 'While people wait and eat, talk with them: how they are doing, what they need, what they thought of the meal.', 'After the serving, run the short community debrief with the team leader.', 'The same day, fill in the Beneficiary form (below): it is how we capture who we served and what they told us.'],
  expect_fr = array['Vous êtes le lien de l''équipe avec la communauté. Arrivez avec l''équipe et présentez-vous à la ou au responsable d''équipe.', 'Pendant l''attente et le repas, parlez avec les gens : comment ils vont, ce dont ils ont besoin, ce qu''ils ont pensé du repas.', 'Après le service, animez le court bilan communautaire avec la ou le responsable d''équipe.', 'Le jour même, remplissez le formulaire des bénéficiaires (ci-dessous) : c''est ainsi que nous consignons qui nous avons servi et ce qu''on nous a dit.'],
  bring_en = 'Your phone, charged, for the form.', bring_fr = 'Votre téléphone, chargé, pour le formulaire.',
  links = '[{"label_en":"Beneficiary form","label_fr":"Formulaire des bénéficiaires","url":"https://docs.google.com/forms/d/e/1FAIpQLSdD1NPiQ1-XfsNXPG8HHJtqx0Yo9Yoxabfuvpz52Xtop77xJA/viewform","when":"after"}]'::jsonb,
  updated_at = now(), updated_by = 'wa172'
where role = 'community_debrief';

update public.volunteer_role_guides set
  expect_en = array['Meet the main driver at the storage unit at the time in your itinerary.', 'Share your ETA in the group chat and keep the team together.', 'At the serving, every cook and server scans the attendance QR code, you fill in the Tracking form, and you run the community debrief with the community lead.', 'After: dishwashing at Old Brewery Mission, back to the storage unit, then the Beneficiary form and the weekly audit and restock form.', 'Remind the volunteers about the survey before they leave.'],
  expect_fr = array['Rejoignez le chauffeur principal à l''entrepôt à l''heure de votre itinéraire.', 'Partagez votre heure d''arrivée dans le groupe et gardez l''équipe ensemble.', 'Au service, chaque bénévole scanne le code QR de présence, vous remplissez le formulaire de suivi et vous animez le bilan communautaire avec la ou le responsable communautaire.', 'Après : la vaisselle à la Mission Old Brewery, le retour à l''entrepôt, puis le formulaire des bénéficiaires et le formulaire d''inventaire de la semaine.', 'Rappelez le sondage aux bénévoles avant leur départ.'],
  links = '[{"label_en":"Tracking form (during the serving)","label_fr":"Formulaire de suivi (pendant le service)","url":"https://docs.google.com/forms/d/e/1FAIpQLSc9LSgnDhLJI3O9D4Ni4Xwz6FxtPXVbBtLznhizxZyJ_ye7Iw/viewform","when":"during"},
            {"label_en":"Beneficiary form (the same day)","label_fr":"Formulaire des bénéficiaires (le jour même)","url":"https://docs.google.com/forms/d/e/1FAIpQLSdD1NPiQ1-XfsNXPG8HHJtqx0Yo9Yoxabfuvpz52Xtop77xJA/viewform","when":"after"},
            {"label_en":"Weekly audit and restock form","label_fr":"Formulaire d''inventaire de la semaine","url":"https://forms.gle/1FqxfNeVq1ZorJUj8","when":"after"},
            {"label_en":"Volunteer survey (share it with the team)","label_fr":"Sondage des bénévoles (à partager avec l''équipe)","url":"https://docs.google.com/forms/d/e/1FAIpQLSdanXK0Ud8RnKOZuzA8Cob_WL6NiayKHHMzo0BkmXHsEELIyg/viewform","when":"after"}]'::jsonb,
  updated_at = now(), updated_by = 'wa172'
where role = 'team_leader';

-- ---------- 5. the confirm page's reads and writes ----------
create or replace function public.volunteer_confirm_get(p_token text)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare r record; g record; v_photo jsonb; v_lang text; v_days int; v_today date; v_state text; v_recipes jsonb; v_car text; v_events jsonb; v_survey text;
begin
  if p_token is null or length(p_token) < 12 then return null; end if;
  select er.id, er.person_id, er.person_name, er.role, er.status, er.confirm_status, er.confirmed_at, er.confirm, er.recipe_id,
         e.id as event_id, e.event_date, e.title, e.location, e.code, e.kind, e.status as ev_status, e.format, e.kitchen_place, e.kitchen_shift
    into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id
   where er.confirm_token = p_token;
  if not found then return null; end if;
  v_days := coalesce(nullif((select value from public.app_config where key = 'sms_confirm_days'), '')::int, 7);
  v_today := (now() at time zone 'America/Toronto')::date;
  select * into g from public.volunteer_role_guides where role = lower(r.role);
  if not found then select * into g from public.volunteer_role_guides where role = 'volunteer'; end if;
  select jsonb_build_object('path', p.path_web, 'alt', p.alt_text, 'fx', p.focal_x, 'fy', p.focal_y) into v_photo
    from public.wa_photos p where p.id = g.photo_id and p.status = 'ready' and p.usage = 'ready' and p.path_web is not null;
  v_lang := public.wa171_lang(r.person_id);
  v_state := case when r.confirm_status = 'confirmed' or lower(coalesce(r.status, '')) = 'confirmed' then 'confirmed'
                  when r.confirm_status = 'declined' or lower(coalesce(r.status, '')) = 'unavailable' then 'declined'
                  when r.event_date - v_today > v_days then 'early' else 'open' end;
  if lower(r.role) = 'cook' then
    select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'url', x.drive_url,
             'taken', (select count(*) from public.event_roster o where o.event_id = r.event_id and o.recipe_id = x.id and o.id <> r.id and lower(coalesce(o.status, '')) not in ('unavailable', 'cancelled')))
           order by x.sort, x.id), '[]'::jsonb) into v_recipes
      from public.recipes x where x.active and x.name !~* 'all recipes';
  end if;
  if lower(r.role) = 'driver' and r.person_id is not null then
    select nullif(trim(car_type), '') into v_car from public.volunteer_people where id = r.person_id;
  end if;
  if r.person_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('token', o.confirm_token, 'date', e2.event_date, 'role', o.role,
             'role_en', public.wa171_role_label(o.role, 'en'), 'role_fr', public.wa171_role_label(o.role, 'fr'),
             'location', coalesce(e2.location, 'Montreal'), 'format', e2.format, 'current', o.id = r.id,
             'state', case when o.confirm_status = 'confirmed' or lower(coalesce(o.status, '')) = 'confirmed' then 'confirmed'
                           when o.confirm_status = 'declined' or lower(coalesce(o.status, '')) = 'unavailable' then 'declined'
                           when e2.event_date - v_today > v_days then 'early' else 'open' end)
           order by e2.event_date), '[]'::jsonb) into v_events
      from public.event_roster o join public.volunteer_events e2 on e2.id = o.event_id
     where o.person_id = r.person_id and e2.kind = 'service' and e2.status not in ('cancelled') and e2.event_date >= v_today
       and lower(coalesce(o.status, '')) <> 'cancelled' and o.confirm_token is not null;
  end if;
  if r.event_date < v_today and lower(r.role) = any (string_to_array(coalesce((select value from public.app_config where key = 'sms_survey_roles'), 'server'), ',')) then
    v_survey := nullif((select value from public.app_config where key = 'sms_survey_url'), '');
  end if;
  return jsonb_build_object(
    'first', split_part(trim(coalesce(r.person_name, '')), ' ', 1),
    'name', r.person_name, 'role', r.role,
    'role_en', public.wa171_role_label(r.role, 'en'), 'role_fr', public.wa171_role_label(r.role, 'fr'),
    'event_date', r.event_date, 'event_title', coalesce(r.title, 'Sunday serving'), 'location', coalesce(r.location, 'Montreal'),
    'code', r.code, 'lang', v_lang,
    'format', r.format, 'kitchen_place', case when r.format = 'community_kitchen' then r.kitchen_place end,
    'kitchen_shift', case when r.format = 'community_kitchen' then r.kitchen_shift end,
    'past', r.event_date < v_today,
    'cancelled', r.ev_status = 'cancelled' or lower(coalesce(r.status, '')) = 'cancelled',
    'state', v_state, 'opens_on', r.event_date - v_days, 'confirm_days', v_days,
    'confirmed_at', r.confirmed_at,
    'already', r.confirm_status, 'answers', r.confirm,
    'details', jsonb_build_object('recipe_id', r.recipe_id, 'donations', r.confirm->>'donations', 'vehicle', r.confirm->>'vehicle', 'model', r.confirm->>'model',
                                  'car_on_file', v_car, 'photos_share', r.confirm->>'photos_share', 'note', r.confirm->>'note'),
    'recipes', v_recipes,
    'events', coalesce(v_events, '[]'::jsonb),
    'survey_url', v_survey,
    'photo', v_photo,
    'guide', jsonb_build_object('expect_en', to_jsonb(g.expect_en), 'expect_fr', to_jsonb(g.expect_fr),
       'bring_en', g.bring_en, 'bring_fr', g.bring_fr, 'arrive_en', g.arrive_en, 'arrive_fr', g.arrive_fr, 'links', g.links));
end $function$;
comment on function public.volunteer_confirm_get(text) is 'wave31, wave171, wave172: what the public confirm page (hub.welfareavenue.com/c/<token>) shows for one roster row: first name, role (both languages), date, place, the format, the state (early: more than 7 days away, confirming opens 7 days before; open; confirmed; declined), the role''s ready photo, what to expect and its links (forms, guides), the role''s own details (a cook''s recipe choices with how many cooks already chose each, a driver''s car on file, a server''s donations), the same person''s other upcoming servings (with their own links, for the calendar) and, after the serving, the survey for the survey roles. Anonymous by design; the unguessable token is the key. Never returns a phone, an email or anyone else''s name.';

create or replace function public.volunteer_confirm_details(p_token text, p jsonb)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare r record; v_add jsonb := '{}'::jsonb; v_recipe bigint; v_car text;
begin
  if p_token is null or length(p_token) < 12 or p is null then return jsonb_build_object('ok', false); end if;
  select er.id, er.person_id, er.role, er.recipe_id, e.event_date, e.status as ev_status into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.confirm_token = p_token;
  if not found then return jsonb_build_object('ok', false); end if;
  if r.event_date < (now() at time zone 'America/Toronto')::date or r.ev_status = 'cancelled' then return jsonb_build_object('ok', false, 'reason', 'past'); end if;
  if p ? 'recipe_id' and lower(r.role) = 'cook' then
    v_recipe := nullif(p->>'recipe_id', '')::bigint;
    if v_recipe is not null and not exists (select 1 from public.recipes where id = v_recipe and active) then return jsonb_build_object('ok', false, 'reason', 'recipe'); end if;
    update public.event_roster set recipe_id = v_recipe where id = r.id;
  end if;
  if p ? 'donations' then v_add := v_add || jsonb_build_object('donations', nullif(left(trim(p->>'donations'), 300), '')); end if;
  if p ? 'note' then v_add := v_add || jsonb_build_object('note', nullif(left(trim(p->>'note'), 500), '')); end if;
  if p ? 'photos_share' then v_add := v_add || jsonb_build_object('photos_share', nullif(left(trim(p->>'photos_share'), 60), '')); end if;
  if lower(r.role) = 'driver' and (p ? 'vehicle' or p ? 'model') then
    v_add := v_add || jsonb_build_object('vehicle', nullif(left(trim(p->>'vehicle'), 30), ''), 'model', nullif(left(trim(p->>'model'), 60), ''));
    v_car := nullif(trim(concat_ws(' ', nullif(left(trim(p->>'vehicle'), 30), ''), nullif(left(trim(p->>'model'), 60), ''))), '');
    if v_car is not null and r.person_id is not null then update public.volunteer_people set car_type = v_car where id = r.person_id; end if;
  end if;
  if v_add <> '{}'::jsonb then
    update public.event_roster set confirm = coalesce(confirm, '{}'::jsonb) || v_add where id = r.id;
  end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('event_roster', r.id::text, 'details', null, left((p - 'via')::text, 300), 'volunteer (link)');
  return jsonb_build_object('ok', true);
end $function$;
comment on function public.volunteer_confirm_details(text, jsonb) is 'wave172: the role''s own answers from the confirm page, any time before the serving: a cook''s recipe (event_roster.recipe_id, an active recipe), a server''s donations, a driver''s car type and model (also kept on volunteer_people.car_type), how a photographer will share, a note (all in event_roster.confirm). Anonymous by design; the token is the key; logged.';
revoke all on function public.volunteer_confirm_details(text, jsonb) from public;
grant execute on function public.volunteer_confirm_details(text, jsonb) to anon, authenticated;

-- ---------- 6. the sign-up notice and the survey ----------
create or replace function public.wa172_queue_signups()
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_mode text; v_days int; v_today date; g record; v_lang text; v_first text; v_list text; v_link text; v_body text; n int := 0; v_first_row bigint; v_event bigint;
begin
  v_mode := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  if v_mode not in ('test', 'live') then return jsonb_build_object('queued', 0, 'mode', v_mode); end if;
  v_days := coalesce(nullif((select value from public.app_config where key = 'sms_confirm_days'), '')::int, 7);
  v_today := (now() at time zone 'America/Toronto')::date;
  for g in
    select public.wa171_roster_phone(er.id) as phone, min(er.person_id) as person_id, min(er.person_name) as person_name,
           array_agg(er.id order by e.event_date, er.id) as ids
      from public.event_roster er join public.volunteer_events e on e.id = er.event_id
     where e.kind = 'service' and e.status not in ('cancelled', 'completed') and e.event_date - v_today > v_days
       and er.created_at >= now() - interval '3 days' and er.created_at < now() - interval '10 minutes'
       and er.signup_noticed_at is null and lower(coalesce(er.status, '')) not in ('unavailable', 'cancelled')
       and public.wa171_roster_phone(er.id) is not null
     group by 1
  loop
    if public.wa171_opted_out(g.person_id, g.phone) then continue; end if;
    if v_mode = 'test' and not public.wa171_test_phone(g.phone) then continue; end if;
    v_lang := public.wa171_lang(g.person_id);
    v_first := coalesce(nullif(split_part(trim(coalesce(g.person_name, '')), ' ', 1), ''), case when v_lang = 'fr' then 'bonjour' else 'there' end);
    select string_agg(public.wa171_date_words(e.event_date, v_lang) || ' (' || lower(public.wa171_role_label(er.role, v_lang)) || ')', case when v_lang = 'fr' then ', ' else ', ' end order by e.event_date),
           (array_agg(er.id order by e.event_date))[1], (array_agg(e.id order by e.event_date))[1]
      into v_list, v_first_row, v_event
      from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.id = any (g.ids);
    v_link := coalesce((select value from public.app_config where key = 'sms_link_base'), 'https://hub.welfareavenue.com/c/') || (select confirm_token from public.event_roster where id = v_first_row);
    if v_lang = 'fr' then
      v_body := 'Bonjour ' || v_first || ', merci de votre inscription chez Welfare Avenue! Vous êtes sur la liste pour : ' || v_list || '. Voyez vos services et ajoutez-les à votre agenda : ' || v_link || ' . Nous vous texterons 7 jours avant chacun pour confirmer. Répondez ARRET pour ne plus recevoir de textos.';
    else
      v_body := 'Hi ' || v_first || ', thanks for signing up with Welfare Avenue! You''re on the list for: ' || v_list || '. See your servings and add them to your calendar: ' || v_link || ' . We''ll text you 7 days before each one to confirm. Reply STOP to stop texts.';
    end if;
    insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id)
    values (gen_random_uuid(), g.person_id, '+1' || g.phone, v_body, 'queued', v_event, 'automation', 'out', 'signup', v_first_row);
    update public.event_roster set signup_noticed_at = now() where id = any (g.ids);
    n := n + 1;
  end loop;
  return jsonb_build_object('queued', n, 'mode', v_mode);
end $function$;
comment on function public.wa172_queue_signups() is 'wave172: the sign-up notice. For roster rows added in the last 3 days (at least 10 minutes ago, so several sign-ups go together) to servings more than 7 days away and not yet noticed, one text per phone listing those servings with a link to see them and add them to a calendar; no confirmation is asked (that text comes 7 days before each serving). Marks the rows signup_noticed_at. sms_mode, STOP and the test phones as for the confirmations. Internal: called by wa171_sms_tick.';
revoke all on function public.wa172_queue_signups() from public, anon, authenticated;

create or replace function public.wa172_queue_surveys()
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_mode text; v_url text; v_roles text[]; v_hour int; v_now timestamp; v_today date; r record; v_phone text; v_lang text; v_first text; v_body text; n int := 0;
begin
  v_mode := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  v_url := nullif(trim(coalesce((select value from public.app_config where key = 'sms_survey_url'), '')), '');
  if v_mode not in ('test', 'live') or v_url is null then return jsonb_build_object('queued', 0, 'mode', v_mode); end if;
  v_roles := string_to_array(replace(lower(coalesce((select value from public.app_config where key = 'sms_survey_roles'), 'server')), ' ', ''), ',');
  v_hour := coalesce(nullif((select value from public.app_config where key = 'sms_survey_hour'), '')::int, 18);
  v_now := now() at time zone 'America/Toronto'; v_today := v_now::date;
  for r in
    select er.id, er.person_id, er.person_name, e.id as event_id, e.event_date
      from public.event_roster er join public.volunteer_events e on e.id = er.event_id
     where e.kind = 'service' and e.status <> 'cancelled'
       and ((e.event_date = v_today and extract(hour from v_now) >= v_hour) or e.event_date = v_today - 1)
       and lower(coalesce(er.status, '')) = 'confirmed' and lower(er.role) = any (v_roles)
       and not exists (select 1 from public.quo_messages q where q.roster_id = er.id and q.direction = 'out' and q.kind = 'survey' and q.status in ('queued', 'sent'))
  loop
    v_phone := public.wa171_roster_phone(r.id);
    if v_phone is null or public.wa171_opted_out(r.person_id, v_phone) then continue; end if;
    if v_mode = 'test' and not public.wa171_test_phone(v_phone) then continue; end if;
    v_lang := public.wa171_lang(r.person_id);
    v_first := coalesce(nullif(split_part(trim(coalesce(r.person_name, '')), ' ', 1), ''), case when v_lang = 'fr' then 'bonjour' else 'there' end);
    if v_lang = 'fr' then
      v_body := 'Merci d''avoir servi avec Welfare Avenue ' || case when r.event_date = v_today then 'aujourd''hui' else 'hier' end || ', ' || v_first || '! Comment ça s''est passé? Dites-le-nous en 2 minutes : ' || v_url;
    else
      v_body := 'Thank you for serving with Welfare Avenue ' || case when r.event_date = v_today then 'today' else 'yesterday' end || ', ' || v_first || '! How did it go? Tell us in 2 minutes: ' || v_url;
    end if;
    insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id)
    values (gen_random_uuid(), r.person_id, '+1' || v_phone, v_body, 'queued', r.event_id, 'automation', 'out', 'survey', r.id)
    on conflict do nothing;
    if found then n := n + 1; end if;
  end loop;
  return jsonb_build_object('queued', n, 'mode', v_mode);
end $function$;
comment on function public.wa172_queue_surveys() is 'wave172: the quick survey text after a serving (app_config sms_survey_url, the Volunteer Survey from the master SOP) to the confirmed volunteers whose role is in sms_survey_roles (server by default), from sms_survey_hour (18:00) Toronto on the day, or the next day if missed; once per roster row. sms_mode, STOP and the test phones as for the confirmations. Internal: called by wa171_sms_tick.';
revoke all on function public.wa172_queue_surveys() from public, anon, authenticated;

create or replace function public.wa171_sms_tick()
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_mode text; v_h int; res jsonb;
begin
  v_mode := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  if v_mode not in ('test', 'live') then return jsonb_build_object('mode', v_mode); end if;
  v_h := extract(hour from now() at time zone 'America/Toronto');
  if v_h < 8 or v_h >= 20 then return jsonb_build_object('mode', v_mode, 'reason', 'outside 8 am to 8 pm'); end if;
  res := jsonb_build_object('confirm', public.wa171_queue_confirms(null, null, 'automation'), 'signup', public.wa172_queue_signups(), 'survey', public.wa172_queue_surveys());
  if exists (select 1 from public.quo_messages where status = 'queued' and direction = 'out') then
    perform public.call_edge('quo-send', '{"action":"drain"}'::jsonb);
  end if;
  return res;
end $function$;
comment on function public.wa171_sms_tick() is 'wave171, wave172: the every-15-minutes tick (cron wa-sms-tick): while sms_mode is test or live and between 8 am and 8 pm Toronto, queues the confirmation texts that are due (7 days before), the sign-up notices (servings further away) and the surveys after a serving, then asks quo-send to send what is queued.';
revoke all on function public.wa171_sms_tick() from public, anon, authenticated;

-- the record
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260930130000', 'wa172_roles', array[$m$insert into public.app_config (key, value, updated_at) values
  ('sms_survey_url', 'https://docs.google.com/forms/d/e/1FAIpQLSdanXK0Ud8RnKOZuzA8Cob_WL6NiayKHHMzo0BkmXHsEELIyg/viewform', now()),
  ('sms_survey_roles', 'server', now()),
  ('sms_survey_hour', '18', now())
on conflict (key) do nothing$m$,$m$alter table public.event_roster add column if not exists created_at timestamptz$m$,$m$alter table public.event_roster alter column created_at set default now()$m$,$m$alter table public.event_roster add column if not exists signup_noticed_at timestamptz$m$,$m$alter table public.event_roster alter column confirm_token set default substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 20)$m$,$m$comment on column public.event_roster.created_at is 'wave172: when the row was added (null for rows from before 30/09/26). The sign-up notice text goes only for rows added in the last 3 days.'$m$,$m$comment on column public.event_roster.signup_noticed_at is 'wave172: when the volunteer was texted that they are on the list for this serving (the sign-up notice, for servings more than 7 days away; the confirmation text follows 7 days before).'$m$,$m$comment on column public.event_roster.confirm_token is 'The personal link''s key (hub.welfareavenue.com/c/<token>): set on every new row since wave172. Anonymous pages read the row only through volunteer_confirm_get.'$m$,$m$alter table public.quo_messages drop constraint if exists quo_messages_kind_check$m$,$m$alter table public.quo_messages add constraint quo_messages_kind_check check (kind in ('manual', 'confirm', 'confirm_test', 'inbound', 'ack', 'signup', 'survey'))$m$,$m$create unique index if not exists quo_messages_survey_once on public.quo_messages (roster_id) where direction = 'out' and kind = 'survey' and status in ('queued', 'sent')$m$,$m$comment on column public.quo_messages.kind is 'manual (a staff send), confirm (the confirmation text with the personal link, 7 days before; one live per roster row), confirm_test (a test to the test phones), inbound (a text received), ack (the short thank-you after a YES or NO), signup (wave172: "you are on the list for ...", sent when someone is added to servings more than 7 days away), survey (wave172: the quick survey after the serving, for the roles in sms_survey_roles).'$m$,$m$alter table public.volunteer_role_guides add column if not exists links jsonb not null default '[]'::jsonb$m$,$m$comment on column public.volunteer_role_guides.links is 'wave172: the forms and documents the role needs, [{label_en, label_fr, url, when: before | during | after}], shown on the confirm page after confirming (from the master SOP).'$m$,$m$update public.volunteer_role_guides set
  expect_en = array['Cook your dish at home before the serving, as agreed with your team leader.', 'Choose your dish below from our recipes, so the meal is balanced.', 'Your driver texts you about 10 minutes before picking up your food: have it packed and ready at the door.', 'Tell us if you need containers and we will bring some.', 'You are welcome to come and serve with the team too.'],
  expect_fr = array['Préparez votre plat à la maison avant le service, comme convenu avec votre responsable d''équipe.', 'Choisissez votre plat ci-dessous parmi nos recettes, pour un repas équilibré.', 'Votre chauffeur vous texte environ 10 minutes avant de passer prendre votre plat : ayez-le emballé et prêt à la porte.', 'Dites-nous si vous avez besoin de contenants et nous en apporterons.', 'Vous êtes aussi le bienvenu ou la bienvenue au service avec l''équipe.'],
  updated_at = now(), updated_by = 'wa172'
where role = 'cook'$m$,$m$update public.volunteer_role_guides set
  expect_en = array['Meet the team at the serving spot and help set up the tables.', 'Get a pinny from the team leaders.', 'Sanitize your hands, wear gloves and serve with care and a smile.', 'Have clothes, toiletries or anything else you would like to donate? Bring them along, and tell us below so the team can plan for them.', 'Dirty containers go in the gray bin; help pack up at the end.', 'After the serving we text you a two-minute survey: it helps us get better.'],
  expect_fr = array['Rejoignez l''équipe sur le lieu du service et aidez à monter les tables.', 'Prenez un dossard auprès des responsables d''équipe.', 'Lavez-vous les mains, portez des gants et servez avec soin et le sourire.', 'Vous avez des vêtements, des articles d''hygiène ou autre chose à donner? Apportez-les et dites-le-nous ci-dessous pour que l''équipe s''organise.', 'Les contenants sales vont dans le bac gris; aidez à ranger à la fin.', 'Après le service, nous vous textons un sondage de deux minutes : il nous aide à nous améliorer.'],
  links = '[{"label_en":"Volunteer survey (after the serving)","label_fr":"Sondage des bénévoles (après le service)","url":"https://docs.google.com/forms/d/e/1FAIpQLSdanXK0Ud8RnKOZuzA8Cob_WL6NiayKHHMzo0BkmXHsEELIyg/viewform","when":"after"}]'::jsonb,
  updated_at = now(), updated_by = 'wa172'
where role = 'server'$m$,$m$update public.volunteer_role_guides set
  expect_en = array['Main driver: meet the team leader at the storage unit (888 Rue Saint-Antoine Ouest) at the time in your itinerary.', 'Pickup driver: follow the route through each cook''s address and text each cook 10 minutes before you arrive.', 'Bring the food to the serving, then help bring everything back after.', 'Gas is reimbursed after the serving (up to $15, from the kilometres of the route).', 'Driving with us for the first time? Tell us your car below so we can plan the pickups.'],
  expect_fr = array['Chauffeur principal : rejoignez la ou le responsable d''équipe à l''entrepôt (888, rue Saint-Antoine Ouest) à l''heure de votre itinéraire.', 'Chauffeur de collecte : suivez le trajet chez chaque bénévole en cuisine et textez chacun 10 minutes avant d''arriver.', 'Apportez la nourriture au service, puis aidez à tout ramener après.', 'L''essence est remboursée après le service (jusqu''à 15 $, selon les kilomètres du trajet).', 'Vous conduisez avec nous pour la première fois? Indiquez votre voiture ci-dessous pour que nous planifiions les collectes.'],
  links = '[{"label_en":"The driver role","label_fr":"Le rôle de chauffeur","url":"https://docs.google.com/document/d/1GN4LE1fFrhFZImSN8ytKQBhTW1sliJ3lh-AOmiVdFik/edit?usp=sharing","when":"before"}]'::jsonb,
  updated_at = now(), updated_by = 'wa172'
where role = 'driver'$m$,$m$update public.volunteer_role_guides set
  expect_en = array['Read the content guide before the serving (below): what we like to capture and how.', 'Photograph the team, the food and the setup.', 'No close-ups of the people we serve, and ask before photographing anyone.', 'Within 24 hours, send us everything you captured: add it to the shared Google Photos album or the Drive folder, or email it to marketing@welfareavenue.com.'],
  expect_fr = array['Lisez le guide de contenu avant le service (ci-dessous) : ce que nous aimons saisir et comment.', 'Photographiez l''équipe, la nourriture et l''installation.', 'Pas de gros plans des personnes que nous servons, et demandez avant de photographier quelqu''un.', 'Dans les 24 heures, envoyez-nous tout ce que vous avez pris : ajoutez-le à l''album Google Photos partagé ou au dossier Drive, ou écrivez à marketing@welfareavenue.com.'],
  links = '[{"label_en":"Content guide","label_fr":"Guide de contenu","url":"https://drive.google.com/file/d/1we30El1jsDiDJ2W2kM2morwYHWlt1_n2/view?usp=sharing","when":"before"},
            {"label_en":"Add your photos to the Google Photos album","label_fr":"Ajouter vos photos à l''album Google Photos","url":"https://photos.app.goo.gl/JVctP4STEHSKzPfJ9","when":"after"},
            {"label_en":"Or upload them to the Drive folder","label_fr":"Ou les téléverser dans le dossier Drive","url":"https://drive.google.com/drive/folders/1KjFSKuszt-rXIDb9nuXg_2UTISY0IwqQ?usp=sharing","when":"after"},
            {"label_en":"Or email them to marketing@welfareavenue.com","label_fr":"Ou les envoyer à marketing@welfareavenue.com","url":"mailto:marketing@welfareavenue.com?subject=Photos%20from%20the%20serving","when":"after"}]'::jsonb,
  updated_at = now(), updated_by = 'wa172'
where role = 'photographer'$m$,$m$update public.volunteer_role_guides set
  label_en = 'Community lead', label_fr = 'Responsable communautaire',
  expect_en = array['You are the team''s link with the community. Arrive with the team and check in with the team leader.', 'While people wait and eat, talk with them: how they are doing, what they need, what they thought of the meal.', 'After the serving, run the short community debrief with the team leader.', 'The same day, fill in the Beneficiary form (below): it is how we capture who we served and what they told us.'],
  expect_fr = array['Vous êtes le lien de l''équipe avec la communauté. Arrivez avec l''équipe et présentez-vous à la ou au responsable d''équipe.', 'Pendant l''attente et le repas, parlez avec les gens : comment ils vont, ce dont ils ont besoin, ce qu''ils ont pensé du repas.', 'Après le service, animez le court bilan communautaire avec la ou le responsable d''équipe.', 'Le jour même, remplissez le formulaire des bénéficiaires (ci-dessous) : c''est ainsi que nous consignons qui nous avons servi et ce qu''on nous a dit.'],
  bring_en = 'Your phone, charged, for the form.', bring_fr = 'Votre téléphone, chargé, pour le formulaire.',
  links = '[{"label_en":"Beneficiary form","label_fr":"Formulaire des bénéficiaires","url":"https://docs.google.com/forms/d/e/1FAIpQLSdD1NPiQ1-XfsNXPG8HHJtqx0Yo9Yoxabfuvpz52Xtop77xJA/viewform","when":"after"}]'::jsonb,
  updated_at = now(), updated_by = 'wa172'
where role = 'community_debrief'$m$,$m$update public.volunteer_role_guides set
  expect_en = array['Meet the main driver at the storage unit at the time in your itinerary.', 'Share your ETA in the group chat and keep the team together.', 'At the serving, every cook and server scans the attendance QR code, you fill in the Tracking form, and you run the community debrief with the community lead.', 'After: dishwashing at Old Brewery Mission, back to the storage unit, then the Beneficiary form and the weekly audit and restock form.', 'Remind the volunteers about the survey before they leave.'],
  expect_fr = array['Rejoignez le chauffeur principal à l''entrepôt à l''heure de votre itinéraire.', 'Partagez votre heure d''arrivée dans le groupe et gardez l''équipe ensemble.', 'Au service, chaque bénévole scanne le code QR de présence, vous remplissez le formulaire de suivi et vous animez le bilan communautaire avec la ou le responsable communautaire.', 'Après : la vaisselle à la Mission Old Brewery, le retour à l''entrepôt, puis le formulaire des bénéficiaires et le formulaire d''inventaire de la semaine.', 'Rappelez le sondage aux bénévoles avant leur départ.'],
  links = '[{"label_en":"Tracking form (during the serving)","label_fr":"Formulaire de suivi (pendant le service)","url":"https://docs.google.com/forms/d/e/1FAIpQLSc9LSgnDhLJI3O9D4Ni4Xwz6FxtPXVbBtLznhizxZyJ_ye7Iw/viewform","when":"during"},
            {"label_en":"Beneficiary form (the same day)","label_fr":"Formulaire des bénéficiaires (le jour même)","url":"https://docs.google.com/forms/d/e/1FAIpQLSdD1NPiQ1-XfsNXPG8HHJtqx0Yo9Yoxabfuvpz52Xtop77xJA/viewform","when":"after"},
            {"label_en":"Weekly audit and restock form","label_fr":"Formulaire d''inventaire de la semaine","url":"https://forms.gle/1FqxfNeVq1ZorJUj8","when":"after"},
            {"label_en":"Volunteer survey (share it with the team)","label_fr":"Sondage des bénévoles (à partager avec l''équipe)","url":"https://docs.google.com/forms/d/e/1FAIpQLSdanXK0Ud8RnKOZuzA8Cob_WL6NiayKHHMzo0BkmXHsEELIyg/viewform","when":"after"}]'::jsonb,
  updated_at = now(), updated_by = 'wa172'
where role = 'team_leader'$m$,$m$create or replace function public.volunteer_confirm_get(p_token text)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare r record; g record; v_photo jsonb; v_lang text; v_days int; v_today date; v_state text; v_recipes jsonb; v_car text; v_events jsonb; v_survey text;
begin
  if p_token is null or length(p_token) < 12 then return null; end if;
  select er.id, er.person_id, er.person_name, er.role, er.status, er.confirm_status, er.confirmed_at, er.confirm, er.recipe_id,
         e.id as event_id, e.event_date, e.title, e.location, e.code, e.kind, e.status as ev_status, e.format, e.kitchen_place, e.kitchen_shift
    into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id
   where er.confirm_token = p_token;
  if not found then return null; end if;
  v_days := coalesce(nullif((select value from public.app_config where key = 'sms_confirm_days'), '')::int, 7);
  v_today := (now() at time zone 'America/Toronto')::date;
  select * into g from public.volunteer_role_guides where role = lower(r.role);
  if not found then select * into g from public.volunteer_role_guides where role = 'volunteer'; end if;
  select jsonb_build_object('path', p.path_web, 'alt', p.alt_text, 'fx', p.focal_x, 'fy', p.focal_y) into v_photo
    from public.wa_photos p where p.id = g.photo_id and p.status = 'ready' and p.usage = 'ready' and p.path_web is not null;
  v_lang := public.wa171_lang(r.person_id);
  v_state := case when r.confirm_status = 'confirmed' or lower(coalesce(r.status, '')) = 'confirmed' then 'confirmed'
                  when r.confirm_status = 'declined' or lower(coalesce(r.status, '')) = 'unavailable' then 'declined'
                  when r.event_date - v_today > v_days then 'early' else 'open' end;
  if lower(r.role) = 'cook' then
    select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'url', x.drive_url,
             'taken', (select count(*) from public.event_roster o where o.event_id = r.event_id and o.recipe_id = x.id and o.id <> r.id and lower(coalesce(o.status, '')) not in ('unavailable', 'cancelled')))
           order by x.sort, x.id), '[]'::jsonb) into v_recipes
      from public.recipes x where x.active and x.name !~* 'all recipes';
  end if;
  if lower(r.role) = 'driver' and r.person_id is not null then
    select nullif(trim(car_type), '') into v_car from public.volunteer_people where id = r.person_id;
  end if;
  if r.person_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('token', o.confirm_token, 'date', e2.event_date, 'role', o.role,
             'role_en', public.wa171_role_label(o.role, 'en'), 'role_fr', public.wa171_role_label(o.role, 'fr'),
             'location', coalesce(e2.location, 'Montreal'), 'format', e2.format, 'current', o.id = r.id,
             'state', case when o.confirm_status = 'confirmed' or lower(coalesce(o.status, '')) = 'confirmed' then 'confirmed'
                           when o.confirm_status = 'declined' or lower(coalesce(o.status, '')) = 'unavailable' then 'declined'
                           when e2.event_date - v_today > v_days then 'early' else 'open' end)
           order by e2.event_date), '[]'::jsonb) into v_events
      from public.event_roster o join public.volunteer_events e2 on e2.id = o.event_id
     where o.person_id = r.person_id and e2.kind = 'service' and e2.status not in ('cancelled') and e2.event_date >= v_today
       and lower(coalesce(o.status, '')) <> 'cancelled' and o.confirm_token is not null;
  end if;
  if r.event_date < v_today and lower(r.role) = any (string_to_array(coalesce((select value from public.app_config where key = 'sms_survey_roles'), 'server'), ',')) then
    v_survey := nullif((select value from public.app_config where key = 'sms_survey_url'), '');
  end if;
  return jsonb_build_object(
    'first', split_part(trim(coalesce(r.person_name, '')), ' ', 1),
    'name', r.person_name, 'role', r.role,
    'role_en', public.wa171_role_label(r.role, 'en'), 'role_fr', public.wa171_role_label(r.role, 'fr'),
    'event_date', r.event_date, 'event_title', coalesce(r.title, 'Sunday serving'), 'location', coalesce(r.location, 'Montreal'),
    'code', r.code, 'lang', v_lang,
    'format', r.format, 'kitchen_place', case when r.format = 'community_kitchen' then r.kitchen_place end,
    'kitchen_shift', case when r.format = 'community_kitchen' then r.kitchen_shift end,
    'past', r.event_date < v_today,
    'cancelled', r.ev_status = 'cancelled' or lower(coalesce(r.status, '')) = 'cancelled',
    'state', v_state, 'opens_on', r.event_date - v_days, 'confirm_days', v_days,
    'confirmed_at', r.confirmed_at,
    'already', r.confirm_status, 'answers', r.confirm,
    'details', jsonb_build_object('recipe_id', r.recipe_id, 'donations', r.confirm->>'donations', 'vehicle', r.confirm->>'vehicle', 'model', r.confirm->>'model',
                                  'car_on_file', v_car, 'photos_share', r.confirm->>'photos_share', 'note', r.confirm->>'note'),
    'recipes', v_recipes,
    'events', coalesce(v_events, '[]'::jsonb),
    'survey_url', v_survey,
    'photo', v_photo,
    'guide', jsonb_build_object('expect_en', to_jsonb(g.expect_en), 'expect_fr', to_jsonb(g.expect_fr),
       'bring_en', g.bring_en, 'bring_fr', g.bring_fr, 'arrive_en', g.arrive_en, 'arrive_fr', g.arrive_fr, 'links', g.links));
end $function$$m$,$m$comment on function public.volunteer_confirm_get(text) is 'wave31, wave171, wave172: what the public confirm page (hub.welfareavenue.com/c/<token>) shows for one roster row: first name, role (both languages), date, place, the format, the state (early: more than 7 days away, confirming opens 7 days before; open; confirmed; declined), the role''s ready photo, what to expect and its links (forms, guides), the role''s own details (a cook''s recipe choices with how many cooks already chose each, a driver''s car on file, a server''s donations), the same person''s other upcoming servings (with their own links, for the calendar) and, after the serving, the survey for the survey roles. Anonymous by design; the unguessable token is the key. Never returns a phone, an email or anyone else''s name.'$m$,$m$create or replace function public.volunteer_confirm_details(p_token text, p jsonb)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare r record; v_add jsonb := '{}'::jsonb; v_recipe bigint; v_car text;
begin
  if p_token is null or length(p_token) < 12 or p is null then return jsonb_build_object('ok', false); end if;
  select er.id, er.person_id, er.role, er.recipe_id, e.event_date, e.status as ev_status into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.confirm_token = p_token;
  if not found then return jsonb_build_object('ok', false); end if;
  if r.event_date < (now() at time zone 'America/Toronto')::date or r.ev_status = 'cancelled' then return jsonb_build_object('ok', false, 'reason', 'past'); end if;
  if p ? 'recipe_id' and lower(r.role) = 'cook' then
    v_recipe := nullif(p->>'recipe_id', '')::bigint;
    if v_recipe is not null and not exists (select 1 from public.recipes where id = v_recipe and active) then return jsonb_build_object('ok', false, 'reason', 'recipe'); end if;
    update public.event_roster set recipe_id = v_recipe where id = r.id;
  end if;
  if p ? 'donations' then v_add := v_add || jsonb_build_object('donations', nullif(left(trim(p->>'donations'), 300), '')); end if;
  if p ? 'note' then v_add := v_add || jsonb_build_object('note', nullif(left(trim(p->>'note'), 500), '')); end if;
  if p ? 'photos_share' then v_add := v_add || jsonb_build_object('photos_share', nullif(left(trim(p->>'photos_share'), 60), '')); end if;
  if lower(r.role) = 'driver' and (p ? 'vehicle' or p ? 'model') then
    v_add := v_add || jsonb_build_object('vehicle', nullif(left(trim(p->>'vehicle'), 30), ''), 'model', nullif(left(trim(p->>'model'), 60), ''));
    v_car := nullif(trim(concat_ws(' ', nullif(left(trim(p->>'vehicle'), 30), ''), nullif(left(trim(p->>'model'), 60), ''))), '');
    if v_car is not null and r.person_id is not null then update public.volunteer_people set car_type = v_car where id = r.person_id; end if;
  end if;
  if v_add <> '{}'::jsonb then
    update public.event_roster set confirm = coalesce(confirm, '{}'::jsonb) || v_add where id = r.id;
  end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('event_roster', r.id::text, 'details', null, left((p - 'via')::text, 300), 'volunteer (link)');
  return jsonb_build_object('ok', true);
end $function$$m$,$m$comment on function public.volunteer_confirm_details(text, jsonb) is 'wave172: the role''s own answers from the confirm page, any time before the serving: a cook''s recipe (event_roster.recipe_id, an active recipe), a server''s donations, a driver''s car type and model (also kept on volunteer_people.car_type), how a photographer will share, a note (all in event_roster.confirm). Anonymous by design; the token is the key; logged.'$m$,$m$revoke all on function public.volunteer_confirm_details(text, jsonb) from public$m$,$m$grant execute on function public.volunteer_confirm_details(text, jsonb) to anon, authenticated$m$,$m$create or replace function public.wa172_queue_signups()
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_mode text; v_days int; v_today date; g record; v_lang text; v_first text; v_list text; v_link text; v_body text; n int := 0; v_first_row bigint; v_event bigint;
begin
  v_mode := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  if v_mode not in ('test', 'live') then return jsonb_build_object('queued', 0, 'mode', v_mode); end if;
  v_days := coalesce(nullif((select value from public.app_config where key = 'sms_confirm_days'), '')::int, 7);
  v_today := (now() at time zone 'America/Toronto')::date;
  for g in
    select public.wa171_roster_phone(er.id) as phone, min(er.person_id) as person_id, min(er.person_name) as person_name,
           array_agg(er.id order by e.event_date, er.id) as ids
      from public.event_roster er join public.volunteer_events e on e.id = er.event_id
     where e.kind = 'service' and e.status not in ('cancelled', 'completed') and e.event_date - v_today > v_days
       and er.created_at >= now() - interval '3 days' and er.created_at < now() - interval '10 minutes'
       and er.signup_noticed_at is null and lower(coalesce(er.status, '')) not in ('unavailable', 'cancelled')
       and public.wa171_roster_phone(er.id) is not null
     group by 1
  loop
    if public.wa171_opted_out(g.person_id, g.phone) then continue; end if;
    if v_mode = 'test' and not public.wa171_test_phone(g.phone) then continue; end if;
    v_lang := public.wa171_lang(g.person_id);
    v_first := coalesce(nullif(split_part(trim(coalesce(g.person_name, '')), ' ', 1), ''), case when v_lang = 'fr' then 'bonjour' else 'there' end);
    select string_agg(public.wa171_date_words(e.event_date, v_lang) || ' (' || lower(public.wa171_role_label(er.role, v_lang)) || ')', case when v_lang = 'fr' then ', ' else ', ' end order by e.event_date),
           (array_agg(er.id order by e.event_date))[1], (array_agg(e.id order by e.event_date))[1]
      into v_list, v_first_row, v_event
      from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.id = any (g.ids);
    v_link := coalesce((select value from public.app_config where key = 'sms_link_base'), 'https://hub.welfareavenue.com/c/') || (select confirm_token from public.event_roster where id = v_first_row);
    if v_lang = 'fr' then
      v_body := 'Bonjour ' || v_first || ', merci de votre inscription chez Welfare Avenue! Vous êtes sur la liste pour : ' || v_list || '. Voyez vos services et ajoutez-les à votre agenda : ' || v_link || ' . Nous vous texterons 7 jours avant chacun pour confirmer. Répondez ARRET pour ne plus recevoir de textos.';
    else
      v_body := 'Hi ' || v_first || ', thanks for signing up with Welfare Avenue! You''re on the list for: ' || v_list || '. See your servings and add them to your calendar: ' || v_link || ' . We''ll text you 7 days before each one to confirm. Reply STOP to stop texts.';
    end if;
    insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id)
    values (gen_random_uuid(), g.person_id, '+1' || g.phone, v_body, 'queued', v_event, 'automation', 'out', 'signup', v_first_row);
    update public.event_roster set signup_noticed_at = now() where id = any (g.ids);
    n := n + 1;
  end loop;
  return jsonb_build_object('queued', n, 'mode', v_mode);
end $function$$m$,$m$comment on function public.wa172_queue_signups() is 'wave172: the sign-up notice. For roster rows added in the last 3 days (at least 10 minutes ago, so several sign-ups go together) to servings more than 7 days away and not yet noticed, one text per phone listing those servings with a link to see them and add them to a calendar; no confirmation is asked (that text comes 7 days before each serving). Marks the rows signup_noticed_at. sms_mode, STOP and the test phones as for the confirmations. Internal: called by wa171_sms_tick.'$m$,$m$revoke all on function public.wa172_queue_signups() from public, anon, authenticated$m$,$m$create or replace function public.wa172_queue_surveys()
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_mode text; v_url text; v_roles text[]; v_hour int; v_now timestamp; v_today date; r record; v_phone text; v_lang text; v_first text; v_body text; n int := 0;
begin
  v_mode := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  v_url := nullif(trim(coalesce((select value from public.app_config where key = 'sms_survey_url'), '')), '');
  if v_mode not in ('test', 'live') or v_url is null then return jsonb_build_object('queued', 0, 'mode', v_mode); end if;
  v_roles := string_to_array(replace(lower(coalesce((select value from public.app_config where key = 'sms_survey_roles'), 'server')), ' ', ''), ',');
  v_hour := coalesce(nullif((select value from public.app_config where key = 'sms_survey_hour'), '')::int, 18);
  v_now := now() at time zone 'America/Toronto'; v_today := v_now::date;
  for r in
    select er.id, er.person_id, er.person_name, e.id as event_id, e.event_date
      from public.event_roster er join public.volunteer_events e on e.id = er.event_id
     where e.kind = 'service' and e.status <> 'cancelled'
       and ((e.event_date = v_today and extract(hour from v_now) >= v_hour) or e.event_date = v_today - 1)
       and lower(coalesce(er.status, '')) = 'confirmed' and lower(er.role) = any (v_roles)
       and not exists (select 1 from public.quo_messages q where q.roster_id = er.id and q.direction = 'out' and q.kind = 'survey' and q.status in ('queued', 'sent'))
  loop
    v_phone := public.wa171_roster_phone(r.id);
    if v_phone is null or public.wa171_opted_out(r.person_id, v_phone) then continue; end if;
    if v_mode = 'test' and not public.wa171_test_phone(v_phone) then continue; end if;
    v_lang := public.wa171_lang(r.person_id);
    v_first := coalesce(nullif(split_part(trim(coalesce(r.person_name, '')), ' ', 1), ''), case when v_lang = 'fr' then 'bonjour' else 'there' end);
    if v_lang = 'fr' then
      v_body := 'Merci d''avoir servi avec Welfare Avenue ' || case when r.event_date = v_today then 'aujourd''hui' else 'hier' end || ', ' || v_first || '! Comment ça s''est passé? Dites-le-nous en 2 minutes : ' || v_url;
    else
      v_body := 'Thank you for serving with Welfare Avenue ' || case when r.event_date = v_today then 'today' else 'yesterday' end || ', ' || v_first || '! How did it go? Tell us in 2 minutes: ' || v_url;
    end if;
    insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id)
    values (gen_random_uuid(), r.person_id, '+1' || v_phone, v_body, 'queued', r.event_id, 'automation', 'out', 'survey', r.id)
    on conflict do nothing;
    if found then n := n + 1; end if;
  end loop;
  return jsonb_build_object('queued', n, 'mode', v_mode);
end $function$$m$,$m$comment on function public.wa172_queue_surveys() is 'wave172: the quick survey text after a serving (app_config sms_survey_url, the Volunteer Survey from the master SOP) to the confirmed volunteers whose role is in sms_survey_roles (server by default), from sms_survey_hour (18:00) Toronto on the day, or the next day if missed; once per roster row. sms_mode, STOP and the test phones as for the confirmations. Internal: called by wa171_sms_tick.'$m$,$m$revoke all on function public.wa172_queue_surveys() from public, anon, authenticated$m$,$m$create or replace function public.wa171_sms_tick()
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_mode text; v_h int; res jsonb;
begin
  v_mode := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  if v_mode not in ('test', 'live') then return jsonb_build_object('mode', v_mode); end if;
  v_h := extract(hour from now() at time zone 'America/Toronto');
  if v_h < 8 or v_h >= 20 then return jsonb_build_object('mode', v_mode, 'reason', 'outside 8 am to 8 pm'); end if;
  res := jsonb_build_object('confirm', public.wa171_queue_confirms(null, null, 'automation'), 'signup', public.wa172_queue_signups(), 'survey', public.wa172_queue_surveys());
  if exists (select 1 from public.quo_messages where status = 'queued' and direction = 'out') then
    perform public.call_edge('quo-send', '{"action":"drain"}'::jsonb);
  end if;
  return res;
end $function$$m$,$m$comment on function public.wa171_sms_tick() is 'wave171, wave172: the every-15-minutes tick (cron wa-sms-tick): while sms_mode is test or live and between 8 am and 8 pm Toronto, queues the confirmation texts that are due (7 days before), the sign-up notices (servings further away) and the surveys after a serving, then asks quo-send to send what is queued.'$m$,$m$revoke all on function public.wa171_sms_tick() from public, anon, authenticated$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
