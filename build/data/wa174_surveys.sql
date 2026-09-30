-- wa174_surveys (30/09/26): a survey for every volunteer, tailored to their role, on their own page; serving times per role;
-- and the itinerary by role, on the same page from the day before.
-- Steel (30/09/26): "Every volunteer should get a survey, each tailored to their role, the experience the had, especially
-- servers we need to know their thoughts on the beneficiaries very similar to the Google form one. Come up with the best
-- questions possible for all"; "Serving times are typically around 12-1230 but definitely check on the itineraries. Also
-- itineraries are sent out to driver and team lead. Servers and photographers get similar ones and then cooks don't usually
-- get one. The community lead should also get their own so that they are ready for the survey type role and community
-- building type role."
-- From the Canva itineraries (6 September 2026, 23 August 2026, 17 February 2024): the serving at 12:00 pm (1:00 pm for the
-- 23 August community kitchen pilot) at 1500 Rue Berri, Place Emilie-Gamelin; the main driver and the team leader start at
-- 11:00 am at the storage unit (888 Rue Saint-Antoine W, unit 1253); the pickup driver starts at 10:45 am and texts each cook
-- 10 minutes before; after the serving, dishwashing at the Old Brewery Mission (915 Clark Street, ask for Rafael), where
-- leftover food and clothing donations can be dropped too; servers meet at the Maisonneuve side of the park. The storage
-- codes are not copied here: staff type them in the Hub (volunteer_itinerary_settings, staff only), never the assistant.

-- 1. the serving's start time (the itineraries' 12:00 pm)
alter table public.volunteer_events add column if not exists start_time time not null default '12:00';
comment on column public.volunteer_events.start_time is 'wave174: when the serving starts (Toronto time; the itineraries'' 12:00 pm). Each role''s arrival is counted from it (volunteer_role_guides.arrive_offset_min).';

-- 2. per role: when to arrive, how long, which itinerary
alter table public.volunteer_role_guides add column if not exists arrive_offset_min int not null default 0;
alter table public.volunteer_role_guides add column if not exists duration_min int not null default 120;
alter table public.volunteer_role_guides add column if not exists itinerary text;
alter table public.volunteer_role_guides drop constraint if exists volunteer_role_guides_itinerary_check;
alter table public.volunteer_role_guides add constraint volunteer_role_guides_itinerary_check check (itinerary is null or itinerary in ('lead_driver', 'serve', 'community'));
comment on column public.volunteer_role_guides.arrive_offset_min is 'wave174: minutes from the serving''s start time to this role''s arrival (negative: before). Drivers and cooks follow their own rules (wa174_times).';
comment on column public.volunteer_role_guides.duration_min is 'wave174: how long the role''s calendar entry lasts, from the arrival.';
comment on column public.volunteer_role_guides.itinerary is 'wave174: which itinerary the role gets on its page from the day before: lead_driver (team leaders and drivers), serve (servers, photographers and the other serving roles), community (the Community lead), none (cooks).';
update public.volunteer_role_guides set arrive_offset_min = -60, duration_min = 210, itinerary = 'lead_driver' where role = 'team_leader';
update public.volunteer_role_guides set arrive_offset_min = -60, duration_min = 210, itinerary = 'lead_driver' where role = 'driver';
update public.volunteer_role_guides set arrive_offset_min = 0, duration_min = 120, itinerary = 'serve' where role in ('server', 'photographer', 'community_talker', 'volunteer');
update public.volunteer_role_guides set arrive_offset_min = 0, duration_min = 180, itinerary = 'serve' where role = 'dishwasher';
update public.volunteer_role_guides set arrive_offset_min = -15, duration_min = 150, itinerary = 'community' where role = 'community_debrief';
update public.volunteer_role_guides set arrive_offset_min = -75, duration_min = 75, itinerary = null where role = 'cook';

-- 3. the itinerary's places and notes (staff only: the storage codes live here)
create table if not exists public.volunteer_itinerary_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.volunteer_itinerary_settings is 'wave174: what the itineraries say (the meeting spot, the storage unit and its access, the dishwashing, the notes, the pickup driver''s lead time). Staff read and edit; volunteers see them only on their own page (volunteer_confirm_get), team leaders and drivers only for the storage access.';
alter table public.volunteer_itinerary_settings enable row level security;
drop policy if exists volunteer_itinerary_settings_staff on public.volunteer_itinerary_settings;
create policy volunteer_itinerary_settings_staff on public.volunteer_itinerary_settings for all to authenticated using ((select public.is_wa_staff())) with check ((select public.is_wa_staff()));
insert into public.volunteer_itinerary_settings (key, value, updated_by) values
  ('meet_spot', 'Place Émilie-Gamelin, on the Maisonneuve side of the park (between Berri and Saint-Hubert)', 'wa174'),
  ('storage_place', '888 Rue Saint-Antoine W, Montréal, QC H3C 4G3. Unit 1253: as you enter, turn right and go to the end.', 'wa174'),
  ('storage_access', null, 'wa174'),
  ('dish_place', 'Old Brewery Mission, 915 Clark Street, Montréal, QC H2Z 1J2. Use the door at 915 Clark Street and ask for Rafael. Leftover food and clothing donations can be dropped there too.', 'wa174'),
  ('pickup_lead_min', '75', 'wa174'),
  ('audit_url', 'https://forms.gle/1FqxfNeVq1ZorJUj8', 'wa174'),
  ('notes_en', E'Sanitize your hands and wear gloves when serving.\nFollow the team leader''s instructions and wait for their direction.\nAlways put equipment back in the right bin.\nUse the cleaning supplies in the bin to wipe up any mess.', 'wa174'),
  ('notes_fr', E'Lavez-vous les mains et portez des gants pour servir.\nSuivez les consignes du ou de la responsable d''équipe.\nRemettez toujours l''équipement dans le bon bac.\nUtilisez les produits de nettoyage du bac pour essuyer les dégâts.', 'wa174')
on conflict (key) do nothing;

-- 4. the day-before itinerary text and the survey for every role
insert into public.app_config (key, value, updated_at) values ('sms_itinerary_hour', '17', now()) on conflict (key) do nothing;
update public.app_config set value = '*', updated_at = now() where key = 'sms_survey_roles';
alter table public.quo_messages drop constraint if exists quo_messages_kind_check;
alter table public.quo_messages add constraint quo_messages_kind_check check (kind = any (array['manual', 'confirm', 'confirm_test', 'inbound', 'ack', 'signup', 'survey', 'itinerary']));
create unique index if not exists quo_messages_itinerary_once on public.quo_messages (roster_id) where kind = 'itinerary' and direction = 'out' and status in ('queued', 'sent');

-- 5. the survey: the questions (per role, '*' for everyone) and one answer set per roster row
create table if not exists public.volunteer_survey_questions (
  id bigint generated always as identity primary key,
  role text not null,
  qkey text not null,
  sort int not null default 100,
  kind text not null check (kind in ('choice', 'multi', 'scale', 'number', 'text')),
  label_en text not null,
  label_fr text not null,
  help_en text,
  help_fr text,
  options jsonb not null default '[]'::jsonb,
  required boolean not null default false,
  other boolean not null default false,
  min_v int,
  max_v int,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text,
  unique (role, qkey)
);
comment on table public.volunteer_survey_questions is 'wave174: the survey each volunteer answers on their page after the serving. role is the roster role, or * for every role; sort 10-90 open every survey, 100-699 are the role''s own, 800-999 close it. kind: choice (one of options), multi (several, other adds a free answer), scale (min_v to max_v), number, text. Options: [{v, en, fr}]. Staff read and switch questions on or off.';
alter table public.volunteer_survey_questions enable row level security;
drop policy if exists volunteer_survey_questions_staff_read on public.volunteer_survey_questions;
create policy volunteer_survey_questions_staff_read on public.volunteer_survey_questions for select to authenticated using ((select public.is_wa_staff()));
drop policy if exists volunteer_survey_questions_staff_write on public.volunteer_survey_questions;
create policy volunteer_survey_questions_staff_write on public.volunteer_survey_questions for update to authenticated using ((select public.is_wa_staff())) with check ((select public.is_wa_staff()));

create table if not exists public.volunteer_survey_responses (
  id bigint generated always as identity primary key,
  roster_id bigint not null unique references public.event_roster(id) on delete cascade,
  event_id bigint not null references public.volunteer_events(id) on delete cascade,
  person_id bigint,
  role text not null,
  lang text,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists volunteer_survey_responses_event on public.volunteer_survey_responses (event_id);
comment on table public.volunteer_survey_responses is 'wave174: a volunteer''s survey answers after a serving (answers: {qkey: value}; multi answers are arrays, an other answer is {"other": text} inside them). Written only by volunteer_survey_submit from the volunteer''s own page; staff read.';
alter table public.volunteer_survey_responses enable row level security;
drop policy if exists volunteer_survey_responses_staff_read on public.volunteer_survey_responses;
create policy volunteer_survey_responses_staff_read on public.volunteer_survey_responses for select to authenticated using ((select public.is_wa_staff()));
insert into public.volunteer_survey_questions (role, qkey, sort, kind, label_en, label_fr, help_en, help_fr, options, required, other, min_v, max_v) values
  ('*', 'overall', 10, 'choice', 'Overall, how was your experience?', 'Dans l’ensemble, comment s’est passée votre expérience?', null, null, '[{"v": "excellent", "en": "Excellent", "fr": "Excellente"}, {"v": "good", "en": "Good", "fr": "Bonne"}, {"v": "fair", "en": "Fair", "fr": "Passable"}, {"v": "poor", "en": "Poor", "fr": "Mauvaise"}]'::jsonb, true, false, null, null),
  ('*', 'prepared', 20, 'choice', 'Did you feel ready for your role?', 'Vous sentiez-vous prêt ou prête pour votre rôle?', null, null, '[{"v": "yes", "en": "Yes, I knew what to do", "fr": "Oui, je savais quoi faire"}, {"v": "mostly", "en": "Mostly", "fr": "En bonne partie"}, {"v": "no", "en": "Not really", "fr": "Pas vraiment"}]'::jsonb, true, false, null, null),
  ('*', 'communication', 30, 'choice', 'Communication before and during the serving was clear.', 'La communication avant et pendant le service était claire.', null, null, '[{"v": "strongly_agree", "en": "Strongly agree", "fr": "Tout à fait d’accord"}, {"v": "agree", "en": "Agree", "fr": "D’accord"}, {"v": "neutral", "en": "Neutral", "fr": "Neutre"}, {"v": "disagree", "en": "Disagree", "fr": "En désaccord"}, {"v": "strongly_disagree", "en": "Strongly disagree", "fr": "Tout à fait en désaccord"}]'::jsonb, true, false, null, null),
  ('*', 'best_moment', 800, 'text', 'What was the best moment of your day?', 'Quel a été le meilleur moment de votre journée?', null, null, '[]'::jsonb, false, false, null, null),
  ('*', 'improve', 810, 'text', 'What is one thing we could do better next time?', 'Qu’est-ce qu’on pourrait faire mieux la prochaine fois?', null, null, '[]'::jsonb, false, false, null, null),
  ('*', 'again', 900, 'choice', 'Would you like to volunteer with us again?', 'Aimeriez-vous refaire du bénévolat avec nous?', null, null, '[{"v": "yes", "en": "Yes", "fr": "Oui"}, {"v": "maybe", "en": "Maybe", "fr": "Peut-être"}, {"v": "not_now", "en": "Not at this time", "fr": "Pas pour le moment"}]'::jsonb, true, false, null, null),
  ('*', 'next_role', 910, 'multi', 'Would you like to try another role?', 'Aimeriez-vous essayer un autre rôle?', null, null, '[{"v": "cook", "en": "Cook", "fr": "Cuisine"}, {"v": "server", "en": "Server", "fr": "Service"}, {"v": "driver", "en": "Driver", "fr": "Chauffeur"}, {"v": "photographer", "en": "Photographer", "fr": "Photographie"}, {"v": "team_leader", "en": "Team leader", "fr": "Responsable d’équipe"}, {"v": "community_debrief", "en": "Community lead", "fr": "Responsable communautaire"}, {"v": "same", "en": "Happy where I am", "fr": "Je reste dans mon rôle"}]'::jsonb, false, false, null, null),
  ('*', 'shoutout', 920, 'text', 'Want to thank a teammate? Tell us who and why.', 'Vous voulez remercier quelqu’un de l’équipe? Dites-nous qui et pourquoi.', null, null, '[]'::jsonb, false, false, null, null),
  ('server', 'needs', 100, 'multi', 'Which needs did the people you served tell you about?', 'Quels besoins les personnes servies vous ont-elles confiés?', null, null, '[{"v": "food", "en": "Food insecurity", "fr": "Insécurité alimentaire"}, {"v": "clothing", "en": "Clothing", "fr": "Vêtements"}, {"v": "hygiene", "en": "Hygiene products", "fr": "Produits d’hygiène"}, {"v": "housing", "en": "Housing", "fr": "Logement"}, {"v": "social", "en": "Social connection", "fr": "Lien social"}, {"v": "employment", "en": "Employment", "fr": "Emploi"}, {"v": "mental_health", "en": "Mental health support", "fr": "Soutien en santé mentale"}, {"v": "health", "en": "Health care", "fr": "Soins de santé"}, {"v": "none", "en": "None mentioned", "fr": "Aucun besoin mentionné"}]'::jsonb, true, true, null, null),
  ('server', 'barriers', 110, 'multi', 'Did anything slow down the serving?', 'Est-ce que quelque chose a ralenti le service?', null, null, '[{"v": "language", "en": "Language barriers", "fr": "Barrières linguistiques"}, {"v": "intoxication", "en": "Someone intoxicated", "fr": "Une personne en état d’ébriété"}, {"v": "more_food", "en": "Requests for more food", "fr": "Demandes de portions supplémentaires"}, {"v": "escalation", "en": "Aggressive or escalated behaviour", "fr": "Comportement agressif ou tendu"}, {"v": "short_staffed", "en": "Not enough volunteers", "fr": "Pas assez de bénévoles"}, {"v": "none", "en": "Nothing, it went smoothly", "fr": "Rien, tout s’est bien passé"}]'::jsonb, true, true, null, null),
  ('server', 'meal_reaction', 120, 'choice', 'How did people react to the meal?', 'Comment les gens ont-ils réagi au repas?', null, null, '[{"v": "loved", "en": "They loved it", "fr": "Ils ont adoré"}, {"v": "liked", "en": "They liked it", "fr": "Ils ont aimé"}, {"v": "mixed", "en": "Mixed", "fr": "Mitigé"}, {"v": "disliked", "en": "They did not like it", "fr": "Ils n’ont pas aimé"}, {"v": "unsure", "en": "I could not tell", "fr": "Difficile à dire"}]'::jsonb, true, false, null, null),
  ('server', 'dignity', 130, 'choice', 'Did the serving feel welcoming and respectful for the people we served?', 'Le service était-il accueillant et respectueux pour les personnes servies?', null, null, '[{"v": "yes", "en": "Yes", "fr": "Oui"}, {"v": "mostly", "en": "Mostly", "fr": "En bonne partie"}, {"v": "no", "en": "Not really", "fr": "Pas vraiment"}]'::jsonb, true, false, null, null),
  ('server', 'enough_food', 140, 'choice', 'Was there enough food?', 'Y avait-il assez de nourriture?', null, null, '[{"v": "leftovers", "en": "Yes, with leftovers", "fr": "Oui, avec des restes"}, {"v": "just_enough", "en": "Just enough", "fr": "Juste assez"}, {"v": "ran_out", "en": "We ran out", "fr": "Il en a manqué"}]'::jsonb, true, false, null, null),
  ('server', 'voices', 150, 'text', 'Anything someone told you that we should know? A need, an idea, a concern or a thank-you.', 'Quelque chose qu’une personne vous a dit et qu’on devrait savoir? Un besoin, une idée, une inquiétude ou un merci.', 'Please leave out names.', 'Merci de ne pas inscrire de noms.', '[]'::jsonb, false, false, null, null),
  ('cook', 'recipe', 100, 'choice', 'How was the recipe?', 'Comment était la recette?', null, null, '[{"v": "clear", "en": "Clear, and the amounts were right", "fr": "Claire, et les quantités étaient justes"}, {"v": "amounts_off", "en": "Clear, but the amounts were off", "fr": "Claire, mais les quantités n’étaient pas justes"}, {"v": "hard", "en": "Hard to follow", "fr": "Difficile à suivre"}]'::jsonb, true, false, null, null),
  ('cook', 'portions', 110, 'number', 'About how many portions did you make?', 'Environ combien de portions avez-vous préparées?', null, null, '[]'::jsonb, false, false, 0, 500),
  ('cook', 'handoff', 120, 'choice', 'How did the pickup or drop-off go?', 'Comment s’est passée la collecte ou le dépôt?', null, null, '[{"v": "smooth", "en": "Smooth", "fr": "Sans problème"}, {"v": "hiccups", "en": "A few hiccups", "fr": "Quelques accrocs"}, {"v": "badly", "en": "It did not go well", "fr": "Ça ne s’est pas bien passé"}]'::jsonb, true, false, null, null),
  ('cook', 'had_needed', 130, 'choice', 'Did you have what you needed (ingredients, containers)?', 'Aviez-vous ce qu’il vous fallait (ingrédients, contenants)?', null, null, '[{"v": "yes", "en": "Yes", "fr": "Oui"}, {"v": "mostly", "en": "Mostly", "fr": "En bonne partie"}, {"v": "no", "en": "No", "fr": "Non"}]'::jsonb, true, false, null, null),
  ('cook', 'easier', 140, 'text', 'What was missing, or what would make cooking easier next time?', 'Qu’est-ce qui manquait, ou qu’est-ce qui rendrait la cuisine plus facile la prochaine fois?', null, null, '[]'::jsonb, false, false, null, null),
  ('driver', 'on_time', 100, 'choice', 'Did the route run on time?', 'Le trajet s’est-il fait à l’heure?', null, null, '[{"v": "yes", "en": "Yes", "fr": "Oui"}, {"v": "little_late", "en": "A little late (under 15 minutes)", "fr": "Un peu en retard (moins de 15 minutes)"}, {"v": "late", "en": "Late (15 minutes or more)", "fr": "En retard (15 minutes ou plus)"}]'::jsonb, true, false, null, null),
  ('driver', 'cooks_ready', 110, 'choice', 'Was the food ready at each pickup?', 'La nourriture était-elle prête à chaque collecte?', null, null, '[{"v": "always", "en": "Every time", "fr": "Chaque fois"}, {"v": "mostly", "en": "Most times", "fr": "La plupart du temps"}, {"v": "rarely", "en": "Rarely", "fr": "Rarement"}, {"v": "none", "en": "I had no pickups", "fr": "Je n’avais pas de collecte"}]'::jsonb, true, false, null, null),
  ('driver', 'itinerary_ok', 120, 'choice', 'Were the itinerary’s addresses and times right?', 'Les adresses et les heures de l’itinéraire étaient-elles justes?', null, null, '[{"v": "yes", "en": "Yes", "fr": "Oui"}, {"v": "some_wrong", "en": "Some were wrong", "fr": "Certaines étaient fausses"}]'::jsonb, true, false, null, null),
  ('driver', 'fix', 130, 'text', 'Anything about the route, parking, the storage unit or the equipment we should fix?', 'Quelque chose à corriger pour le trajet, le stationnement, l’entrepôt ou l’équipement?', null, null, '[]'::jsonb, false, false, null, null),
  ('photographer', 'shared', 100, 'choice', 'Have you shared your photos with us?', 'Nous avez-vous transmis vos photos?', null, null, '[{"v": "album", "en": "Yes, in the Google Photos album", "fr": "Oui, dans l’album Google Photos"}, {"v": "drive", "en": "Yes, in the Drive folder", "fr": "Oui, dans le dossier Drive"}, {"v": "email", "en": "Yes, by email", "fr": "Oui, par courriel"}, {"v": "this_week", "en": "Not yet, this week", "fr": "Pas encore, cette semaine"}]'::jsonb, true, false, null, null),
  ('photographer', 'photo_count', 110, 'number', 'About how many photos did you take?', 'Environ combien de photos avez-vous prises?', null, null, '[]'::jsonb, false, false, 0, 2000),
  ('photographer', 'consent', 120, 'choice', 'Did you ask before photographing anyone’s face?', 'Avez-vous demandé la permission avant de photographier un visage?', null, null, '[{"v": "always", "en": "Yes, every time", "fr": "Oui, chaque fois"}, {"v": "no_faces", "en": "I avoided faces", "fr": "J’ai évité les visages"}, {"v": "not_always", "en": "Not always", "fr": "Pas toujours"}]'::jsonb, true, false, null, null),
  ('photographer', 'story', 130, 'text', 'A moment or story worth sharing on our social media?', 'Un moment ou une histoire à partager sur nos réseaux sociaux?', null, null, '[]'::jsonb, false, false, null, null),
  ('team_leader', 'meals', 100, 'number', 'About how many meals were served?', 'Environ combien de repas ont été servis?', null, null, '[]'::jsonb, true, false, 0, 1000),
  ('team_leader', 'started', 110, 'choice', 'Did the serving start on time?', 'Le service a-t-il commencé à l’heure?', null, null, '[{"v": "on_time", "en": "On time", "fr": "À l’heure"}, {"v": "late_15", "en": "Up to 15 minutes late", "fr": "Jusqu’à 15 minutes de retard"}, {"v": "late_more", "en": "More than 15 minutes late", "fr": "Plus de 15 minutes de retard"}]'::jsonb, true, false, null, null),
  ('team_leader', 'turnout', 120, 'choice', 'Did the whole team show up?', 'Toute l’équipe était-elle présente?', null, null, '[{"v": "all", "en": "Everyone", "fr": "Tout le monde"}, {"v": "one_two", "en": "One or two missing", "fr": "Une ou deux absences"}, {"v": "several", "en": "Several missing", "fr": "Plusieurs absences"}]'::jsonb, true, false, null, null),
  ('team_leader', 'no_shows', 130, 'text', 'Who did not show up? (so we can follow up kindly)', 'Qui était absent? (pour faire un suivi bienveillant)', null, null, '[]'::jsonb, false, false, null, null),
  ('team_leader', 'needs', 140, 'multi', 'Which needs did people bring up today?', 'Quels besoins les gens ont-ils exprimés aujourd’hui?', null, null, '[{"v": "food", "en": "Food insecurity", "fr": "Insécurité alimentaire"}, {"v": "clothing", "en": "Clothing", "fr": "Vêtements"}, {"v": "hygiene", "en": "Hygiene products", "fr": "Produits d’hygiène"}, {"v": "housing", "en": "Housing", "fr": "Logement"}, {"v": "social", "en": "Social connection", "fr": "Lien social"}, {"v": "employment", "en": "Employment", "fr": "Emploi"}, {"v": "mental_health", "en": "Mental health support", "fr": "Soutien en santé mentale"}, {"v": "health", "en": "Health care", "fr": "Soins de santé"}, {"v": "none", "en": "None mentioned", "fr": "Aucun besoin mentionné"}]'::jsonb, true, true, null, null),
  ('team_leader', 'incidents', 150, 'text', 'Any incident or safety concern?', 'Un incident ou un enjeu de sécurité?', 'Say what happened, without the names of the people we served.', 'Décrivez ce qui s’est passé, sans le nom des personnes servies.', '[]'::jsonb, false, false, null, null),
  ('team_leader', 'equipment', 160, 'text', 'Anything missing, broken or to restock?', 'Quelque chose de manquant, de brisé ou à réapprovisionner?', 'Please also fill in the weekly audit and restock form.', 'Merci de remplir aussi le formulaire d’inventaire hebdomadaire.', '[]'::jsonb, false, false, null, null),
  ('community_debrief', 'clothes_before', 100, 'number', 'Clothing items counted before the serving', 'Vêtements comptés avant le service', null, null, '[]'::jsonb, true, false, 0, 5000),
  ('community_debrief', 'clothes_after', 110, 'number', 'Clothing items left after the serving', 'Vêtements restants après le service', null, null, '[]'::jsonb, true, false, 0, 5000),
  ('community_debrief', 'conversations', 120, 'number', 'About how many people did you have a real conversation with?', 'Avec environ combien de personnes avez-vous eu une vraie conversation?', null, null, '[]'::jsonb, false, false, 0, 500),
  ('community_debrief', 'needs', 130, 'multi', 'Which needs did people express?', 'Quels besoins les gens ont-ils exprimés?', null, null, '[{"v": "food", "en": "Food insecurity", "fr": "Insécurité alimentaire"}, {"v": "clothing", "en": "Clothing", "fr": "Vêtements"}, {"v": "hygiene", "en": "Hygiene products", "fr": "Produits d’hygiène"}, {"v": "housing", "en": "Housing", "fr": "Logement"}, {"v": "social", "en": "Social connection", "fr": "Lien social"}, {"v": "employment", "en": "Employment", "fr": "Emploi"}, {"v": "mental_health", "en": "Mental health support", "fr": "Soutien en santé mentale"}, {"v": "health", "en": "Health care", "fr": "Soins de santé"}, {"v": "none", "en": "None mentioned", "fr": "Aucun besoin mentionné"}]'::jsonb, true, true, null, null),
  ('community_debrief', 'barriers', 140, 'multi', 'Did anything slow down the serving?', 'Est-ce que quelque chose a ralenti le service?', null, null, '[{"v": "language", "en": "Language barriers", "fr": "Barrières linguistiques"}, {"v": "intoxication", "en": "Someone intoxicated", "fr": "Une personne en état d’ébriété"}, {"v": "more_food", "en": "Requests for more food", "fr": "Demandes de portions supplémentaires"}, {"v": "escalation", "en": "Aggressive or escalated behaviour", "fr": "Comportement agressif ou tendu"}, {"v": "short_staffed", "en": "Not enough volunteers", "fr": "Pas assez de bénévoles"}, {"v": "none", "en": "Nothing, it went smoothly", "fr": "Rien, tout s’est bien passé"}]'::jsonb, true, true, null, null),
  ('community_debrief', 'meal_rating', 150, 'scale', 'How did people rate the meal?', 'Comment les gens ont-ils évalué le repas?', '0 = very poor, 5 = excellent', '0 = très mauvais, 5 = excellent', '[]'::jsonb, true, false, 0, 5),
  ('community_debrief', 'service_rating', 160, 'scale', 'How well did the serving work for them?', 'Le service a-t-il bien fonctionné pour eux?', '0 = very ineffective, 5 = very effective', '0 = très inefficace, 5 = très efficace', '[]'::jsonb, true, false, 0, 5),
  ('community_debrief', 'uses_services', 170, 'choice', 'Did people describe other services they use?', 'Les gens ont-ils parlé d’autres services qu’ils utilisent?', null, null, '[{"v": "yes", "en": "Yes", "fr": "Oui"}, {"v": "no", "en": "No", "fr": "Non"}]'::jsonb, true, false, null, null),
  ('community_debrief', 'services', 180, 'text', 'If yes, which ones? (a shelter, a food bank, a clinic…)', 'Si oui, lesquels? (un refuge, une banque alimentaire, une clinique…)', null, null, '[]'::jsonb, false, false, null, null),
  ('community_debrief', 'regulars', 190, 'choice', 'Did you see familiar faces from past servings?', 'Avez-vous reconnu des visages des services précédents?', null, null, '[{"v": "many", "en": "Many", "fr": "Beaucoup"}, {"v": "few", "en": "A few", "fr": "Quelques-uns"}, {"v": "none", "en": "None that I noticed", "fr": "Aucun, à ma connaissance"}]'::jsonb, false, false, null, null),
  ('community_debrief', 'follow_up', 200, 'text', 'Did anyone ask for help we could follow up on?', 'Quelqu’un a-t-il demandé une aide pour laquelle on pourrait faire un suivi?', 'Describe the need, not the person.', 'Décrivez le besoin, pas la personne.', '[]'::jsonb, false, false, null, null),
  ('community_debrief', 'team_mood', 210, 'choice', 'How did the volunteer team feel today?', 'Comment l’équipe de bénévoles se sentait-elle aujourd’hui?', null, null, '[{"v": "energised", "en": "Energised", "fr": "Pleine d’énergie"}, {"v": "fine", "en": "Fine", "fr": "Bien"}, {"v": "stretched", "en": "Stretched thin", "fr": "Débordée"}]'::jsonb, false, false, null, null),
  ('dishwasher', 'dishes', 100, 'choice', 'How did the dishwashing go?', 'Comment s’est passée la vaisselle?', null, null, '[{"v": "smooth", "en": "Smooth", "fr": "Sans problème"}, {"v": "hiccups", "en": "A few hiccups", "fr": "Quelques accrocs"}, {"v": "badly", "en": "It did not go well", "fr": "Ça ne s’est pas bien passé"}]'::jsonb, true, false, null, null),
  ('dishwasher', 'dish_fix', 110, 'text', 'Anything we should fix (supplies, access, timing)?', 'Quelque chose à corriger (fournitures, accès, horaire)?', null, null, '[]'::jsonb, false, false, null, null),
  ('community_talker', 'needs', 100, 'multi', 'Which needs did people tell you about?', 'Quels besoins les gens vous ont-ils confiés?', null, null, '[{"v": "food", "en": "Food insecurity", "fr": "Insécurité alimentaire"}, {"v": "clothing", "en": "Clothing", "fr": "Vêtements"}, {"v": "hygiene", "en": "Hygiene products", "fr": "Produits d’hygiène"}, {"v": "housing", "en": "Housing", "fr": "Logement"}, {"v": "social", "en": "Social connection", "fr": "Lien social"}, {"v": "employment", "en": "Employment", "fr": "Emploi"}, {"v": "mental_health", "en": "Mental health support", "fr": "Soutien en santé mentale"}, {"v": "health", "en": "Health care", "fr": "Soins de santé"}, {"v": "none", "en": "None mentioned", "fr": "Aucun besoin mentionné"}]'::jsonb, true, true, null, null),
  ('community_talker', 'voices', 110, 'text', 'Anything someone told you that we should know?', 'Quelque chose qu’une personne vous a dit et qu’on devrait savoir?', 'Please leave out names.', 'Merci de ne pas inscrire de noms.', '[]'::jsonb, false, false, null, null)
on conflict (role, qkey) do nothing;

-- 6. helpers (not callable from outside)
create or replace function public.wa174_set(p_key text)
 returns text language sql stable security definer set search_path to '' as $$
  select nullif(trim(coalesce(value, '')), '') from public.volunteer_itinerary_settings where key = p_key;
$$;
create or replace function public.wa174_hm(p time)
 returns text language sql immutable set search_path to '' as $$ select to_char(p, 'HH24:MI'); $$;
create or replace function public.wa174_maps(p text)
 returns text language sql immutable set search_path to '' as $$
  select replace(replace(replace(replace(replace(trim(coalesce(p, '')), '%', '%25'), '#', '%23'), '/', ' '), '?', ''), ' ', '+');
$$;
-- a driver's part: main (the storage unit with the team leader), pickup (the cooks' food) or both (the only driver)
create or replace function public.wa174_driver_kind(p_roster bigint)
 returns text language sql stable security definer set search_path to '' as $$
  with me as (select event_id from public.event_roster where id = p_roster),
  d as (
    select er.id, er.detail->>'driver_role' as dr,
           row_number() over (order by case er.detail->>'driver_role' when 'main' then 0 when 'both' then 0 when 'pickup' then 1 else 2 end, er.sort nulls last, er.id) as rn,
           count(*) over () as n
      from public.event_roster er, me
     where er.event_id = me.event_id and lower(er.role) = 'driver'
       and lower(coalesce(er.status, '')) not in ('cancelled', 'unavailable') and coalesce(er.confirm_status, '') <> 'declined')
  select case when dr in ('main', 'pickup', 'both') then dr when n = 1 then 'both' when rn = 1 then 'main' else 'pickup' end from d where id = p_roster;
$$;
-- when a roster row starts and ends (Toronto time), and where it starts: storage, pickup, dropoff, home (a cook's pickup) or serving
create or replace function public.wa174_times(p_roster bigint)
 returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare r record; s time; st time; en time; v_at text; k text; lead int; dt time; g record;
begin
  select er.role, er.confirm, coalesce(e.start_time, '12:00'::time) as start_time into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.id = p_roster;
  if not found then return null; end if;
  s := r.start_time;
  lead := coalesce(nullif(public.wa174_set('pickup_lead_min'), '')::int, 75);
  select * into g from public.volunteer_role_guides where role = lower(r.role);
  if lower(r.role) = 'cook' then
    if r.confirm->>'cook_location' = 'drop off' then
      dt := coalesce(nullif((select value from public.app_config where key = 'cook_dropoff_time'), '')::time, s);
      st := dt - interval '15 minutes'; v_at := 'dropoff';
      en := case when (r.confirm->>'stay_to_serve')::boolean then s + interval '120 minutes' else dt end;
    else
      st := s - make_interval(mins => lead); en := s; v_at := 'home';
    end if;
  elsif lower(r.role) = 'driver' then
    k := public.wa174_driver_kind(p_roster);
    if k in ('pickup', 'both') then st := s - make_interval(mins => lead); v_at := 'pickup';
    else st := s - interval '60 minutes'; v_at := 'storage'; end if;
    en := s + make_interval(mins => coalesce(g.duration_min, 210) - 60);
  else
    st := s + make_interval(mins => coalesce(g.arrive_offset_min, 0));
    en := st + make_interval(mins => coalesce(g.duration_min, 120));
    v_at := case when lower(r.role) = 'team_leader' then 'storage' else 'serving' end;
  end if;
  return jsonb_build_object('start', public.wa174_hm(st), 'end', public.wa174_hm(en), 'at', v_at, 'serve', public.wa174_hm(s), 'driver_kind', k);
end $$;
-- the survey opens an hour after the serving starts and stays open 14 days
create or replace function public.wa174_survey_open(p_date date, p_start time)
 returns boolean language sql stable set search_path to '' as $$
  select (now() at time zone 'America/Toronto') >= (p_date + coalesce(p_start, '12:00'::time) + interval '60 minutes')
     and (now() at time zone 'America/Toronto')::date <= p_date + 14;
$$;
create or replace function public.wa174_questions(p_role text)
 returns jsonb language sql stable security definer set search_path to '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', q.qkey, 'kind', q.kind, 'en', q.label_en, 'fr', q.label_fr, 'help_en', q.help_en, 'help_fr', q.help_fr,
           'options', q.options, 'required', q.required, 'other', q.other, 'min', q.min_v, 'max', q.max_v) order by q.sort, q.id), '[]'::jsonb)
    from public.volunteer_survey_questions q
   where q.active and (q.role = '*' or q.role = lower(coalesce(p_role, 'volunteer')));
$$;
-- the itinerary for one roster row: the team, the times, and for team leaders and drivers the storage unit, the cooks' pickups and after
create or replace function public.wa174_itinerary(p_roster bigint)
 returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare r record; g record; v_kind text; v_team jsonb; v_pick jsonb; v_drop jsonb; v_route text; out jsonb; v_times jsonb; v_place text;
begin
  select er.id, er.role, er.event_id, e.location, e.format, e.kitchen_place, e.kitchen_shift, coalesce(e.start_time, '12:00'::time) as start_time
    into r from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.id = p_roster;
  if not found then return null; end if;
  select * into g from public.volunteer_role_guides where role = lower(r.role);
  v_kind := g.itinerary;
  if v_kind is null then return null; end if;
  v_times := public.wa174_times(p_roster);
  v_place := coalesce(nullif(nullif(trim(coalesce(r.location, '')), ''), 'Montreal'), (select value from public.app_config where key = 'cook_dropoff_place'), '1500 Rue Berri, Montréal, QC H2L 2C4');
  select coalesce(jsonb_agg(jsonb_build_object('name', t.person_name, 'role', lower(t.role),
           'role_en', public.wa171_role_label(t.role, 'en'), 'role_fr', public.wa171_role_label(t.role, 'fr'),
           'kind', case when lower(t.role) = 'driver' then public.wa174_driver_kind(t.id) end,
           'phone', public.wa171_roster_phone(t.id), 'me', t.id = r.id)
         order by case lower(t.role) when 'team_leader' then 0 when 'driver' then 1 else 2 end, t.sort nulls last, t.id), '[]'::jsonb) into v_team
    from public.event_roster t
   where t.event_id = r.event_id and lower(t.role) in ('team_leader', 'driver', 'community_debrief')
     and lower(coalesce(t.status, '')) not in ('cancelled', 'unavailable') and coalesce(t.confirm_status, '') <> 'declined';
  out := jsonb_build_object('kind', v_kind, 'serve', public.wa174_hm(r.start_time), 'place', v_place,
    'meet_spot', public.wa174_set('meet_spot'), 'times', v_times, 'team', v_team,
    'notes_en', to_jsonb(string_to_array(coalesce(public.wa174_set('notes_en'), ''), E'\n')), 'notes_fr', to_jsonb(string_to_array(coalesce(public.wa174_set('notes_fr'), ''), E'\n')),
    'format', r.format, 'kitchen_place', case when r.format = 'community_kitchen' then r.kitchen_place end, 'kitchen_shift', case when r.format = 'community_kitchen' then r.kitchen_shift end);
  if v_kind = 'lead_driver' then
    select coalesce(jsonb_agg(jsonb_build_object('name', c.person_name, 'phone', public.wa171_roster_phone(c.id),
             'address', coalesce(c.confirm->>'address', c.detail->>'address'), 'neighbourhood', c.confirm->>'neighbourhood', 'postal_code', c.confirm->>'postal_code',
             'dish', (select x.name from public.recipes x where x.id = c.recipe_id)) order by c.sort nulls last, c.id), '[]'::jsonb),
           string_agg(public.wa174_maps(concat_ws(', ', coalesce(c.confirm->>'address', c.detail->>'address'), c.confirm->>'postal_code', 'Montréal')), '/' order by c.sort nulls last, c.id)
      into v_pick, v_route
      from public.event_roster c
     where c.event_id = r.event_id and lower(c.role) = 'cook'
       and lower(coalesce(c.status, '')) not in ('cancelled', 'unavailable') and coalesce(c.confirm_status, '') <> 'declined'
       and (c.confirm->>'cook_location' = 'home' or (c.confirm->>'cook_location' is null and c.detail->>'pickup_dropoff' = 'Pick-up'))
       and coalesce(c.confirm->>'address', c.detail->>'address') is not null;
    select coalesce(jsonb_agg(jsonb_build_object('name', c.person_name, 'stay', c.confirm->'stay_to_serve', 'dish', (select x.name from public.recipes x where x.id = c.recipe_id)) order by c.sort nulls last, c.id), '[]'::jsonb)
      into v_drop
      from public.event_roster c
     where c.event_id = r.event_id and lower(c.role) = 'cook'
       and lower(coalesce(c.status, '')) not in ('cancelled', 'unavailable') and coalesce(c.confirm_status, '') <> 'declined'
       and (c.confirm->>'cook_location' = 'drop off' or (c.confirm->>'cook_location' is null and c.detail->>'pickup_dropoff' = 'Drop-off'));
    out := out || jsonb_build_object('pickups', v_pick, 'dropoffs', v_drop,
      'route_url', case when v_route is not null then 'https://www.google.com/maps/dir/' || v_route || '/' || public.wa174_maps(v_place) end,
      'storage_place', public.wa174_set('storage_place'), 'storage_access', public.wa174_set('storage_access'),
      'dish_place', public.wa174_set('dish_place'), 'audit_url', case when lower(r.role) = 'team_leader' then public.wa174_set('audit_url') end);
  elsif lower(r.role) = 'dishwasher' then
    out := out || jsonb_build_object('dish_place', public.wa174_set('dish_place'));
  end if;
  return out;
end $$;
revoke all on function public.wa174_set(text) from public, anon, authenticated;
revoke all on function public.wa174_driver_kind(bigint) from public, anon, authenticated;
revoke all on function public.wa174_times(bigint) from public, anon, authenticated;
revoke all on function public.wa174_questions(text) from public, anon, authenticated;
revoke all on function public.wa174_itinerary(bigint) from public, anon, authenticated;
grant execute on function public.wa174_driver_kind(bigint) to authenticated;
grant execute on function public.wa174_times(bigint) to authenticated;

-- 7. the page's read: adds the times, the survey (an hour after the start, for 14 days) and the itinerary (from the day before)
drop function if exists public.volunteer_confirm_get(text);
create or replace function public.volunteer_confirm_get(p_token text, p_preview boolean default false)
 returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare r record; g record; v_photo jsonb; v_lang text; v_days int; v_today date; v_state text; v_recipes jsonb; v_car text; v_events jsonb;
        v_survey jsonb; v_itin jsonb; v_resp record; v_open boolean;
begin
  if p_token is null or length(p_token) < 12 then return null; end if;
  select er.id, er.person_id, er.person_name, er.role, er.status, er.confirm_status, er.confirmed_at, er.confirm, er.recipe_id,
         e.id as event_id, e.event_date, e.title, e.location, e.code, e.kind, e.status as ev_status, e.format, e.kitchen_place, e.kitchen_shift,
         coalesce(e.start_time, '12:00'::time) as start_time
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
             'location', coalesce(e2.location, 'Montreal'), 'format', e2.format, 'current', o.id = r.id, 'times', public.wa174_times(o.id),
             'state', case when o.confirm_status = 'confirmed' or lower(coalesce(o.status, '')) = 'confirmed' then 'confirmed'
                           when o.confirm_status = 'declined' or lower(coalesce(o.status, '')) = 'unavailable' then 'declined'
                           when e2.event_date - v_today > v_days then 'early' else 'open' end)
           order by e2.event_date), '[]'::jsonb) into v_events
      from public.event_roster o join public.volunteer_events e2 on e2.id = o.event_id
     where o.person_id = r.person_id and e2.kind = 'service' and e2.status not in ('cancelled') and e2.event_date >= v_today
       and lower(coalesce(o.status, '')) <> 'cancelled' and o.confirm_token is not null;
  end if;
  -- the survey: everyone who did not say they could not come, an hour after the start, for 14 days (preview: any time)
  v_open := public.wa174_survey_open(r.event_date, r.start_time);
  if (v_open or p_preview) and v_state <> 'declined' and r.ev_status <> 'cancelled' and lower(coalesce(r.status, '')) <> 'cancelled' then
    select answers, submitted_at, updated_at into v_resp from public.volunteer_survey_responses where roster_id = r.id;
    v_survey := jsonb_build_object('open', v_open, 'questions', public.wa174_questions(r.role),
      'answers', case when v_resp.answers is not null then v_resp.answers end, 'submitted_at', coalesce(v_resp.updated_at, v_resp.submitted_at));
  end if;
  -- the itinerary: confirmed, from the day before through the serving day (preview: any time before it)
  if v_state = 'confirmed' and r.ev_status <> 'cancelled' and r.event_date >= v_today and (r.event_date - v_today <= 1 or p_preview) then
    v_itin := public.wa174_itinerary(r.id);
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
    'start_time', public.wa174_hm(r.start_time), 'times', public.wa174_times(r.id),
    'cook_pickup', case when lower(r.role) = 'cook' then jsonb_build_object('areas', to_jsonb(public.wa173_cook_areas()),
        'dropoff_place', (select value from public.app_config where key = 'cook_dropoff_place'), 'dropoff_time', (select value from public.app_config where key = 'cook_dropoff_time')) end,
    'details', jsonb_build_object('recipe_id', r.recipe_id,
      'pickup', case when r.confirm->>'cook_location' = 'home' then 'pickup' when r.confirm->>'cook_location' = 'drop off' then 'dropoff' end,
      'address', case when lower(r.role) = 'cook' then coalesce(r.confirm->>'address', (select nullif(trim(vp.address), '') from public.volunteer_people vp where vp.id = r.person_id)) end,
      'neighbourhood', r.confirm->>'neighbourhood', 'postal_code', r.confirm->>'postal_code', 'stay_to_serve', r.confirm->'stay_to_serve', 'donations', r.confirm->>'donations', 'vehicle', r.confirm->>'vehicle', 'model', r.confirm->>'model',
      'car_on_file', v_car, 'photos_share', r.confirm->>'photos_share', 'note', r.confirm->>'note'),
    'recipes', v_recipes,
    'events', coalesce(v_events, '[]'::jsonb),
    'survey', v_survey, 'itinerary', v_itin,
    'photo', v_photo,
    'guide', jsonb_build_object('expect_en', to_jsonb(g.expect_en), 'expect_fr', to_jsonb(g.expect_fr),
       'bring_en', g.bring_en, 'bring_fr', g.bring_fr, 'arrive_en', g.arrive_en, 'arrive_fr', g.arrive_fr, 'links', g.links));
end $$;
comment on function public.volunteer_confirm_get(text, boolean) is 'wave31, wave171-174: what the public confirm page (hub.welfareavenue.com/c/<token>) shows for one roster row: first name, role (both languages), date, place, the format, the start time and the role''s own times, the state (early: more than 7 days away; open; confirmed; declined), the role''s photo, what to expect and its links, the role''s own details (a cook''s recipe and pickup or drop-off, a driver''s car, a server''s donations), the person''s other upcoming servings, the role''s survey (an hour after the start, for 14 days) and, for a confirmed volunteer from the day before, the role''s itinerary (team leaders and drivers: the storage unit, the team''s phones and the cooks'' pickups; servers and photographers; the Community lead; none for cooks). p_preview (the admins'' test links) shows the survey and the itinerary early. Anonymous by design; the unguessable token is the key.';
grant execute on function public.volunteer_confirm_get(text, boolean) to anon, authenticated;

-- 8. the page's survey write: known questions only, checked against their options, required ones present; answering again replaces
create or replace function public.volunteer_survey_submit(p_token text, p jsonb)
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare r record; q record; a jsonb; v jsonb; clean jsonb := '{}'::jsonb; missing text[] := '{}'; vals text[]; x jsonb; n numeric; arr jsonb;
begin
  if p_token is null or length(p_token) < 12 or p is null or jsonb_typeof(p->'answers') <> 'object' then return jsonb_build_object('ok', false); end if;
  select er.id, er.person_id, er.role, er.status, er.confirm_status, er.event_id, e.event_date, e.status as ev_status, coalesce(e.start_time, '12:00'::time) as start_time into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.confirm_token = p_token;
  if not found then return jsonb_build_object('ok', false); end if;
  if r.ev_status = 'cancelled' or lower(coalesce(r.status, '')) in ('cancelled', 'unavailable') or r.confirm_status = 'declined' then return jsonb_build_object('ok', false, 'reason', 'not_on_it'); end if;
  if not public.wa174_survey_open(r.event_date, r.start_time) then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  a := p->'answers';
  for q in select * from public.volunteer_survey_questions where active and (role = '*' or role = lower(r.role)) order by sort, id loop
    v := a->q.qkey;
    if v is null or v = 'null'::jsonb or (jsonb_typeof(v) = 'string' and trim(v #>> '{}') = '') or (jsonb_typeof(v) = 'array' and jsonb_array_length(v) = 0) then
      if q.required then missing := missing || q.qkey; end if;
      continue;
    end if;
    select array_agg(o->>'v') into vals from jsonb_array_elements(q.options) o;
    if q.kind = 'choice' then
      if jsonb_typeof(v) <> 'string' or not ((v #>> '{}') = any (coalesce(vals, '{}'))) then return jsonb_build_object('ok', false, 'reason', 'bad', 'key', q.qkey); end if;
      clean := clean || jsonb_build_object(q.qkey, v);
    elsif q.kind = 'multi' then
      if jsonb_typeof(v) <> 'array' then return jsonb_build_object('ok', false, 'reason', 'bad', 'key', q.qkey); end if;
      arr := '[]'::jsonb;
      for x in select * from jsonb_array_elements(v) loop
        if jsonb_typeof(x) = 'string' and (x #>> '{}') = any (coalesce(vals, '{}')) then arr := arr || jsonb_build_array(x);
        elsif q.other and jsonb_typeof(x) = 'object' and nullif(trim(coalesce(x->>'other', '')), '') is not null then arr := arr || jsonb_build_array(jsonb_build_object('other', left(trim(x->>'other'), 200)));
        else return jsonb_build_object('ok', false, 'reason', 'bad', 'key', q.qkey); end if;
      end loop;
      if jsonb_array_length(arr) = 0 then if q.required then missing := missing || q.qkey; end if; continue; end if;
      clean := clean || jsonb_build_object(q.qkey, arr);
    elsif q.kind in ('scale', 'number') then
      begin n := (v #>> '{}')::numeric; exception when others then return jsonb_build_object('ok', false, 'reason', 'bad', 'key', q.qkey); end;
      if n <> trunc(n) or (q.min_v is not null and n < q.min_v) or (q.max_v is not null and n > q.max_v) then return jsonb_build_object('ok', false, 'reason', 'range', 'key', q.qkey); end if;
      clean := clean || jsonb_build_object(q.qkey, n::int);
    else
      clean := clean || jsonb_build_object(q.qkey, left(trim(v #>> '{}'), 1000));
    end if;
  end loop;
  if array_length(missing, 1) > 0 then return jsonb_build_object('ok', false, 'reason', 'required', 'missing', to_jsonb(missing)); end if;
  insert into public.volunteer_survey_responses (roster_id, event_id, person_id, role, lang, answers)
  values (r.id, r.event_id, r.person_id, lower(r.role), case when p->>'lang' in ('en', 'fr') then p->>'lang' end, clean)
  on conflict (roster_id) do update set answers = excluded.answers, lang = excluded.lang, updated_at = now();
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('event_roster', r.id::text, 'survey', null, 'answered (' || (select count(*) from jsonb_object_keys(clean)) || ' answers)', 'volunteer (link)');
  return jsonb_build_object('ok', true);
end $$;
comment on function public.volunteer_survey_submit(text, jsonb) is 'wave174: a volunteer''s survey answers from their own page (p: {answers: {qkey: value}, lang}), from an hour after the serving starts for 14 days: only the active questions for their role, each checked (a choice among its options, several among them plus an other answer when allowed, a whole number in range, text up to 1000 characters), the required ones present. Answering again replaces the answers. Anonymous by design; the token is the key; logged.';
grant execute on function public.volunteer_survey_submit(text, jsonb) to anon, authenticated;

-- 9. the survey text: every role (sms_survey_roles *), with the volunteer's own link, from the hour on the day (or the next day)
create or replace function public.wa172_queue_surveys()
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_mode text; v_base text; v_roles text[]; v_hour int; v_now timestamp; v_today date; r record; v_phone text; v_lang text; v_first text; v_body text; n int := 0;
begin
  v_mode := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  v_base := coalesce(nullif((select value from public.app_config where key = 'sms_link_base'), ''), 'https://hub.welfareavenue.com/c/');
  if v_mode not in ('test', 'live') then return jsonb_build_object('queued', 0, 'mode', v_mode); end if;
  v_roles := string_to_array(replace(lower(coalesce((select value from public.app_config where key = 'sms_survey_roles'), '*')), ' ', ''), ',');
  v_hour := coalesce(nullif((select value from public.app_config where key = 'sms_survey_hour'), '')::int, 18);
  v_now := now() at time zone 'America/Toronto'; v_today := v_now::date;
  for r in
    select er.id, er.person_id, er.person_name, er.confirm_token, e.id as event_id, e.event_date
      from public.event_roster er join public.volunteer_events e on e.id = er.event_id
     where e.kind = 'service' and e.status <> 'cancelled' and er.confirm_token is not null
       and ((e.event_date = v_today and extract(hour from v_now) >= v_hour) or e.event_date = v_today - 1)
       and lower(coalesce(er.status, '')) = 'confirmed' and ('*' = any (v_roles) or lower(er.role) = any (v_roles))
       and not exists (select 1 from public.quo_messages q where q.roster_id = er.id and q.direction = 'out' and q.kind = 'survey' and q.status in ('queued', 'sent'))
  loop
    v_phone := public.wa171_roster_phone(r.id);
    if v_phone is null or public.wa171_opted_out(r.person_id, v_phone) then continue; end if;
    if v_mode = 'test' and not public.wa171_test_phone(v_phone) then continue; end if;
    v_lang := public.wa171_lang(r.person_id);
    v_first := coalesce(nullif(split_part(trim(coalesce(r.person_name, '')), ' ', 1), ''), case when v_lang = 'fr' then 'bonjour' else 'there' end);
    if v_lang = 'fr' then
      v_body := 'Merci d''avoir été là avec Welfare Avenue ' || case when r.event_date = v_today then 'aujourd''hui' else 'hier' end || ', ' || v_first || '! Comment ça s''est passé? Dites-le-nous en 2 minutes : ' || v_base || r.confirm_token;
    else
      v_body := 'Thank you for being there with Welfare Avenue ' || case when r.event_date = v_today then 'today' else 'yesterday' end || ', ' || v_first || '! How did it go? Tell us in 2 minutes: ' || v_base || r.confirm_token;
    end if;
    insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id)
    values (gen_random_uuid(), r.person_id, '+1' || v_phone, v_body, 'queued', r.event_id, 'automation', 'out', 'survey', r.id)
    on conflict do nothing;
    if found then n := n + 1; end if;
  end loop;
  return jsonb_build_object('queued', n, 'mode', v_mode);
end $$;
comment on function public.wa172_queue_surveys() is 'wave172, wave174: after the serving, a thank-you text with the volunteer''s own link (their survey, tailored to their role, is on it) to the confirmed volunteers in app_config sms_survey_roles (* for every role), from sms_survey_hour on the day or the next day. Once per roster row; test mode texts the test phones only; STOP respected.';
revoke all on function public.wa172_queue_surveys() from public, anon, authenticated;

-- 10. the itinerary text: the day before, from sms_itinerary_hour, to the confirmed volunteers whose role has an itinerary
create or replace function public.wa174_queue_itineraries()
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_mode text; v_base text; v_hour int; v_now timestamp; v_today date; r record; v_phone text; v_lang text; v_first text; v_body text; v_t jsonb; v_hm text; n int := 0;
begin
  v_mode := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  v_base := coalesce(nullif((select value from public.app_config where key = 'sms_link_base'), ''), 'https://hub.welfareavenue.com/c/');
  if v_mode not in ('test', 'live') then return jsonb_build_object('queued', 0, 'mode', v_mode); end if;
  v_hour := coalesce(nullif((select value from public.app_config where key = 'sms_itinerary_hour'), '')::int, 17);
  v_now := now() at time zone 'America/Toronto'; v_today := v_now::date;
  if extract(hour from v_now) < v_hour then return jsonb_build_object('queued', 0, 'mode', v_mode, 'reason', 'before the hour'); end if;
  for r in
    select er.id, er.person_id, er.person_name, er.confirm_token, e.id as event_id, e.event_date
      from public.event_roster er join public.volunteer_events e on e.id = er.event_id
      join public.volunteer_role_guides g on g.role = lower(er.role) and g.itinerary is not null
     where e.kind = 'service' and e.status <> 'cancelled' and er.confirm_token is not null and e.event_date = v_today + 1
       and lower(coalesce(er.status, '')) = 'confirmed'
       and not exists (select 1 from public.quo_messages q where q.roster_id = er.id and q.direction = 'out' and q.kind = 'itinerary' and q.status in ('queued', 'sent'))
  loop
    v_phone := public.wa171_roster_phone(r.id);
    if v_phone is null or public.wa171_opted_out(r.person_id, v_phone) then continue; end if;
    if v_mode = 'test' and not public.wa171_test_phone(v_phone) then continue; end if;
    v_lang := public.wa171_lang(r.person_id);
    v_first := coalesce(nullif(split_part(trim(coalesce(r.person_name, '')), ' ', 1), ''), case when v_lang = 'fr' then 'bonjour' else 'there' end);
    v_t := public.wa174_times(r.id);
    v_hm := v_t->>'start';
    if v_lang = 'fr' then
      v_body := 'Bonjour ' || v_first || ', voici votre itinéraire pour le service de demain (début pour vous : ' || replace(regexp_replace(v_hm, '^0', ''), ':', ' h ') || ') : ' || v_base || r.confirm_token || ' À demain! Répondez STOP pour ne plus recevoir de textos.';
      v_body := replace(v_body, ' h 00)', ' h)');
    else
      v_body := 'Hi ' || v_first || ', here is your itinerary for tomorrow''s serving (you start at ' || to_char(('2000-01-01 ' || v_hm)::timestamp, 'FMHH12:MI am') || '): ' || v_base || r.confirm_token || ' See you there! Reply STOP to stop texts.';
    end if;
    insert into public.quo_messages (batch_id, person_id, phone, body, status, event_id, sent_by, direction, kind, roster_id)
    values (gen_random_uuid(), r.person_id, '+1' || v_phone, v_body, 'queued', r.event_id, 'automation', 'out', 'itinerary', r.id)
    on conflict do nothing;
    if found then n := n + 1; end if;
  end loop;
  return jsonb_build_object('queued', n, 'mode', v_mode);
end $$;
comment on function public.wa174_queue_itineraries() is 'wave174: the day before the serving, from app_config sms_itinerary_hour (Toronto), a text with the volunteer''s own link (their itinerary is on it) and their start time, to the confirmed volunteers whose role has an itinerary (volunteer_role_guides.itinerary: team leaders, drivers, servers, photographers, the Community lead; not cooks). Once per roster row; test mode texts the test phones only; STOP respected; nothing while sms_mode is off.';
revoke all on function public.wa174_queue_itineraries() from public, anon, authenticated;

create or replace function public.wa171_sms_tick()
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_mode text; v_h int; res jsonb;
begin
  v_mode := coalesce((select value from public.app_config where key = 'sms_mode'), 'off');
  if v_mode not in ('test', 'live') then return jsonb_build_object('mode', v_mode); end if;
  v_h := extract(hour from now() at time zone 'America/Toronto');
  if v_h < 8 or v_h >= 20 then return jsonb_build_object('mode', v_mode, 'reason', 'outside 8 am to 8 pm'); end if;
  res := jsonb_build_object('confirm', public.wa171_queue_confirms(null, null, 'automation'), 'signup', public.wa172_queue_signups(), 'survey', public.wa172_queue_surveys(),
                            'itinerary', public.wa174_queue_itineraries());
  if exists (select 1 from public.quo_messages where status = 'queued' and direction = 'out') then
    perform public.call_edge('quo-send', '{"action":"drain"}'::jsonb);
  end if;
  return res;
end $$;
revoke all on function public.wa171_sms_tick() from public, anon, authenticated;

-- 11. what the roles say about arriving now that the times are on the page
update public.volunteer_role_guides set arrive_en = 'At the serving spot at the time shown above. Your itinerary is on this page the day before.', arrive_fr = 'Au lieu du service à l''heure indiquée plus haut. Votre itinéraire est sur cette page la veille.', updated_at = now(), updated_by = 'wa174'
 where role in ('server', 'photographer', 'community_talker', 'volunteer', 'dishwasher');
update public.volunteer_role_guides set arrive_en = 'At the time shown above: the storage unit for the team leader and the main driver, the first cook''s pickup for the pickup driver. Your itinerary is on this page the day before.', arrive_fr = 'À l''heure indiquée plus haut : l''entrepôt pour le ou la responsable d''équipe et le chauffeur principal, la première collecte pour le chauffeur des collectes. Votre itinéraire est sur cette page la veille.', updated_at = now(), updated_by = 'wa174'
 where role in ('team_leader', 'driver');
update public.volunteer_role_guides set arrive_en = 'About 15 minutes before the serving, to count the clothing before it starts. Your itinerary is on this page the day before.', arrive_fr = 'Environ 15 minutes avant le service, pour compter les vêtements avant le début. Votre itinéraire est sur cette page la veille.', updated_at = now(), updated_by = 'wa174'
 where role = 'community_debrief';
