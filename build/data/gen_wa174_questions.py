#!/usr/bin/env python3
"""wave174 (30/09/26): the survey questions after a serving, one set per role plus the common ones, as SQL inserts
into public.volunteer_survey_questions (build/data/wa174_questions.sql, applied inside wa174_surveys).

Steel (30/09/26): "Every volunteer should get a survey, each tailored to their role, the experience they had, especially
servers we need to know their thoughts on the beneficiaries very similar to the Google form one. Come up with the best
questions possible for all." The server set mirrors the Volunteer Survey (needs described, barriers, communication,
overall experience, suggestions, volunteering again); the Community lead set mirrors the Beneficiary debrief form
(clothing before and after, needs, barriers, meal rating 0-5, service delivery 0-5, services used). Sort: 10-90 open
every survey, 100-699 are the role's own, 800-999 close every survey."""
import json, os

def O(*pairs):
    return [{'v': v, 'en': en, 'fr': fr} for v, en, fr in pairs]

NEEDS = O(('food', 'Food insecurity', 'Insécurité alimentaire'), ('clothing', 'Clothing', 'Vêtements'),
          ('hygiene', 'Hygiene products', 'Produits d’hygiène'), ('housing', 'Housing', 'Logement'),
          ('social', 'Social connection', 'Lien social'), ('employment', 'Employment', 'Emploi'),
          ('mental_health', 'Mental health support', 'Soutien en santé mentale'), ('health', 'Health care', 'Soins de santé'),
          ('none', 'None mentioned', 'Aucun besoin mentionné'))
BARRIERS = O(('language', 'Language barriers', 'Barrières linguistiques'), ('intoxication', 'Someone intoxicated', 'Une personne en état d’ébriété'),
             ('more_food', 'Requests for more food', 'Demandes de portions supplémentaires'),
             ('escalation', 'Aggressive or escalated behaviour', 'Comportement agressif ou tendu'),
             ('short_staffed', 'Not enough volunteers', 'Pas assez de bénévoles'), ('none', 'Nothing, it went smoothly', 'Rien, tout s’est bien passé'))
SMOOTH = O(('smooth', 'Smooth', 'Sans problème'), ('hiccups', 'A few hiccups', 'Quelques accrocs'), ('badly', 'It did not go well', 'Ça ne s’est pas bien passé'))

Q = []
def q(role, key, sort, kind, en, fr, opts=None, required=False, other=False, mn=None, mx=None, help_en=None, help_fr=None):
    Q.append(dict(role=role, qkey=key, sort=sort, kind=kind, label_en=en, label_fr=fr, options=opts or [], required=required,
                  other=other, min_v=mn, max_v=mx, help_en=help_en, help_fr=help_fr))

# every role: how it felt (first) and whether they come back (last)
q('*', 'overall', 10, 'choice', 'Overall, how was your experience?', 'Dans l’ensemble, comment s’est passée votre expérience?',
  O(('excellent', 'Excellent', 'Excellente'), ('good', 'Good', 'Bonne'), ('fair', 'Fair', 'Passable'), ('poor', 'Poor', 'Mauvaise')), True)
q('*', 'prepared', 20, 'choice', 'Did you feel ready for your role?', 'Vous sentiez-vous prêt ou prête pour votre rôle?',
  O(('yes', 'Yes, I knew what to do', 'Oui, je savais quoi faire'), ('mostly', 'Mostly', 'En bonne partie'), ('no', 'Not really', 'Pas vraiment')), True)
q('*', 'communication', 30, 'choice', 'Communication before and during the serving was clear.', 'La communication avant et pendant le service était claire.',
  O(('strongly_agree', 'Strongly agree', 'Tout à fait d’accord'), ('agree', 'Agree', 'D’accord'), ('neutral', 'Neutral', 'Neutre'),
    ('disagree', 'Disagree', 'En désaccord'), ('strongly_disagree', 'Strongly disagree', 'Tout à fait en désaccord')), True)
q('*', 'best_moment', 800, 'text', 'What was the best moment of your day?', 'Quel a été le meilleur moment de votre journée?')
q('*', 'improve', 810, 'text', 'What is one thing we could do better next time?', 'Qu’est-ce qu’on pourrait faire mieux la prochaine fois?')
q('*', 'again', 900, 'choice', 'Would you like to volunteer with us again?', 'Aimeriez-vous refaire du bénévolat avec nous?',
  O(('yes', 'Yes', 'Oui'), ('maybe', 'Maybe', 'Peut-être'), ('not_now', 'Not at this time', 'Pas pour le moment')), True)
q('*', 'next_role', 910, 'multi', 'Would you like to try another role?', 'Aimeriez-vous essayer un autre rôle?',
  O(('cook', 'Cook', 'Cuisine'), ('server', 'Server', 'Service'), ('driver', 'Driver', 'Chauffeur'), ('photographer', 'Photographer', 'Photographie'),
    ('team_leader', 'Team leader', 'Responsable d’équipe'), ('community_debrief', 'Community lead', 'Responsable communautaire'),
    ('same', 'Happy where I am', 'Je reste dans mon rôle')))
q('*', 'shoutout', 920, 'text', 'Want to thank a teammate? Tell us who and why.', 'Vous voulez remercier quelqu’un de l’équipe? Dites-nous qui et pourquoi.')

# servers: what the people we served told them (the Volunteer Survey)
q('server', 'needs', 100, 'multi', 'Which needs did the people you served tell you about?', 'Quels besoins les personnes servies vous ont-elles confiés?', NEEDS, True, True)
q('server', 'barriers', 110, 'multi', 'Did anything slow down the serving?', 'Est-ce que quelque chose a ralenti le service?', BARRIERS, True, True)
q('server', 'meal_reaction', 120, 'choice', 'How did people react to the meal?', 'Comment les gens ont-ils réagi au repas?',
  O(('loved', 'They loved it', 'Ils ont adoré'), ('liked', 'They liked it', 'Ils ont aimé'), ('mixed', 'Mixed', 'Mitigé'),
    ('disliked', 'They did not like it', 'Ils n’ont pas aimé'), ('unsure', 'I could not tell', 'Difficile à dire')), True)
q('server', 'dignity', 130, 'choice', 'Did the serving feel welcoming and respectful for the people we served?', 'Le service était-il accueillant et respectueux pour les personnes servies?',
  O(('yes', 'Yes', 'Oui'), ('mostly', 'Mostly', 'En bonne partie'), ('no', 'Not really', 'Pas vraiment')), True)
q('server', 'enough_food', 140, 'choice', 'Was there enough food?', 'Y avait-il assez de nourriture?',
  O(('leftovers', 'Yes, with leftovers', 'Oui, avec des restes'), ('just_enough', 'Just enough', 'Juste assez'), ('ran_out', 'We ran out', 'Il en a manqué')), True)
q('server', 'voices', 150, 'text', 'Anything someone told you that we should know? A need, an idea, a concern or a thank-you.', 'Quelque chose qu’une personne vous a dit et qu’on devrait savoir? Un besoin, une idée, une inquiétude ou un merci.',
  help_en='Please leave out names.', help_fr='Merci de ne pas inscrire de noms.')

# cooks
q('cook', 'recipe', 100, 'choice', 'How was the recipe?', 'Comment était la recette?',
  O(('clear', 'Clear, and the amounts were right', 'Claire, et les quantités étaient justes'), ('amounts_off', 'Clear, but the amounts were off', 'Claire, mais les quantités n’étaient pas justes'),
    ('hard', 'Hard to follow', 'Difficile à suivre')), True)
q('cook', 'portions', 110, 'number', 'About how many portions did you make?', 'Environ combien de portions avez-vous préparées?', mn=0, mx=500)
q('cook', 'handoff', 120, 'choice', 'How did the pickup or drop-off go?', 'Comment s’est passée la collecte ou le dépôt?', SMOOTH, True)
q('cook', 'had_needed', 130, 'choice', 'Did you have what you needed (ingredients, containers)?', 'Aviez-vous ce qu’il vous fallait (ingrédients, contenants)?',
  O(('yes', 'Yes', 'Oui'), ('mostly', 'Mostly', 'En bonne partie'), ('no', 'No', 'Non')), True)
q('cook', 'easier', 140, 'text', 'What was missing, or what would make cooking easier next time?', 'Qu’est-ce qui manquait, ou qu’est-ce qui rendrait la cuisine plus facile la prochaine fois?')

# drivers
q('driver', 'on_time', 100, 'choice', 'Did the route run on time?', 'Le trajet s’est-il fait à l’heure?',
  O(('yes', 'Yes', 'Oui'), ('little_late', 'A little late (under 15 minutes)', 'Un peu en retard (moins de 15 minutes)'), ('late', 'Late (15 minutes or more)', 'En retard (15 minutes ou plus)')), True)
q('driver', 'cooks_ready', 110, 'choice', 'Was the food ready at each pickup?', 'La nourriture était-elle prête à chaque collecte?',
  O(('always', 'Every time', 'Chaque fois'), ('mostly', 'Most times', 'La plupart du temps'), ('rarely', 'Rarely', 'Rarement'), ('none', 'I had no pickups', 'Je n’avais pas de collecte')), True)
q('driver', 'itinerary_ok', 120, 'choice', 'Were the itinerary’s addresses and times right?', 'Les adresses et les heures de l’itinéraire étaient-elles justes?',
  O(('yes', 'Yes', 'Oui'), ('some_wrong', 'Some were wrong', 'Certaines étaient fausses')), True)
q('driver', 'fix', 130, 'text', 'Anything about the route, parking, the storage unit or the equipment we should fix?', 'Quelque chose à corriger pour le trajet, le stationnement, l’entrepôt ou l’équipement?')

# photographers
q('photographer', 'shared', 100, 'choice', 'Have you shared your photos with us?', 'Nous avez-vous transmis vos photos?',
  O(('album', 'Yes, in the Google Photos album', 'Oui, dans l’album Google Photos'), ('drive', 'Yes, in the Drive folder', 'Oui, dans le dossier Drive'),
    ('email', 'Yes, by email', 'Oui, par courriel'), ('this_week', 'Not yet, this week', 'Pas encore, cette semaine')), True)
q('photographer', 'photo_count', 110, 'number', 'About how many photos did you take?', 'Environ combien de photos avez-vous prises?', mn=0, mx=2000)
q('photographer', 'consent', 120, 'choice', 'Did you ask before photographing anyone’s face?', 'Avez-vous demandé la permission avant de photographier un visage?',
  O(('always', 'Yes, every time', 'Oui, chaque fois'), ('no_faces', 'I avoided faces', 'J’ai évité les visages'), ('not_always', 'Not always', 'Pas toujours')), True)
q('photographer', 'story', 130, 'text', 'A moment or story worth sharing on our social media?', 'Un moment ou une histoire à partager sur nos réseaux sociaux?')

# team leaders
q('team_leader', 'meals', 100, 'number', 'About how many meals were served?', 'Environ combien de repas ont été servis?', required=True, mn=0, mx=1000)
q('team_leader', 'started', 110, 'choice', 'Did the serving start on time?', 'Le service a-t-il commencé à l’heure?',
  O(('on_time', 'On time', 'À l’heure'), ('late_15', 'Up to 15 minutes late', 'Jusqu’à 15 minutes de retard'), ('late_more', 'More than 15 minutes late', 'Plus de 15 minutes de retard')), True)
q('team_leader', 'turnout', 120, 'choice', 'Did the whole team show up?', 'Toute l’équipe était-elle présente?',
  O(('all', 'Everyone', 'Tout le monde'), ('one_two', 'One or two missing', 'Une ou deux absences'), ('several', 'Several missing', 'Plusieurs absences')), True)
q('team_leader', 'no_shows', 130, 'text', 'Who did not show up? (so we can follow up kindly)', 'Qui était absent? (pour faire un suivi bienveillant)')
q('team_leader', 'needs', 140, 'multi', 'Which needs did people bring up today?', 'Quels besoins les gens ont-ils exprimés aujourd’hui?', NEEDS, True, True)
q('team_leader', 'incidents', 150, 'text', 'Any incident or safety concern?', 'Un incident ou un enjeu de sécurité?',
  help_en='Say what happened, without the names of the people we served.', help_fr='Décrivez ce qui s’est passé, sans le nom des personnes servies.')
q('team_leader', 'equipment', 160, 'text', 'Anything missing, broken or to restock?', 'Quelque chose de manquant, de brisé ou à réapprovisionner?',
  help_en='Please also fill in the weekly audit and restock form.', help_fr='Merci de remplir aussi le formulaire d’inventaire hebdomadaire.')

# community leads: the Beneficiary debrief form, and the community they built
q('community_debrief', 'clothes_before', 100, 'number', 'Clothing items counted before the serving', 'Vêtements comptés avant le service', required=True, mn=0, mx=5000)
q('community_debrief', 'clothes_after', 110, 'number', 'Clothing items left after the serving', 'Vêtements restants après le service', required=True, mn=0, mx=5000)
q('community_debrief', 'conversations', 120, 'number', 'About how many people did you have a real conversation with?', 'Avec environ combien de personnes avez-vous eu une vraie conversation?', mn=0, mx=500)
q('community_debrief', 'needs', 130, 'multi', 'Which needs did people express?', 'Quels besoins les gens ont-ils exprimés?', NEEDS, True, True)
q('community_debrief', 'barriers', 140, 'multi', 'Did anything slow down the serving?', 'Est-ce que quelque chose a ralenti le service?', BARRIERS, True, True)
q('community_debrief', 'meal_rating', 150, 'scale', 'How did people rate the meal?', 'Comment les gens ont-ils évalué le repas?', required=True, mn=0, mx=5,
  help_en='0 = very poor, 5 = excellent', help_fr='0 = très mauvais, 5 = excellent')
q('community_debrief', 'service_rating', 160, 'scale', 'How well did the serving work for them?', 'Le service a-t-il bien fonctionné pour eux?', required=True, mn=0, mx=5,
  help_en='0 = very ineffective, 5 = very effective', help_fr='0 = très inefficace, 5 = très efficace')
q('community_debrief', 'uses_services', 170, 'choice', 'Did people describe other services they use?', 'Les gens ont-ils parlé d’autres services qu’ils utilisent?',
  O(('yes', 'Yes', 'Oui'), ('no', 'No', 'Non')), True)
q('community_debrief', 'services', 180, 'text', 'If yes, which ones? (a shelter, a food bank, a clinic…)', 'Si oui, lesquels? (un refuge, une banque alimentaire, une clinique…)')
q('community_debrief', 'regulars', 190, 'choice', 'Did you see familiar faces from past servings?', 'Avez-vous reconnu des visages des services précédents?',
  O(('many', 'Many', 'Beaucoup'), ('few', 'A few', 'Quelques-uns'), ('none', 'None that I noticed', 'Aucun, à ma connaissance')))
q('community_debrief', 'follow_up', 200, 'text', 'Did anyone ask for help we could follow up on?', 'Quelqu’un a-t-il demandé une aide pour laquelle on pourrait faire un suivi?',
  help_en='Describe the need, not the person.', help_fr='Décrivez le besoin, pas la personne.')
q('community_debrief', 'team_mood', 210, 'choice', 'How did the volunteer team feel today?', 'Comment l’équipe de bénévoles se sentait-elle aujourd’hui?',
  O(('energised', 'Energised', 'Pleine d’énergie'), ('fine', 'Fine', 'Bien'), ('stretched', 'Stretched thin', 'Débordée')))

# dishwashers and the community welcome
q('dishwasher', 'dishes', 100, 'choice', 'How did the dishwashing go?', 'Comment s’est passée la vaisselle?', SMOOTH, True)
q('dishwasher', 'dish_fix', 110, 'text', 'Anything we should fix (supplies, access, timing)?', 'Quelque chose à corriger (fournitures, accès, horaire)?')
q('community_talker', 'needs', 100, 'multi', 'Which needs did people tell you about?', 'Quels besoins les gens vous ont-ils confiés?', NEEDS, True, True)
q('community_talker', 'voices', 110, 'text', 'Anything someone told you that we should know?', 'Quelque chose qu’une personne vous a dit et qu’on devrait savoir?',
  help_en='Please leave out names.', help_fr='Merci de ne pas inscrire de noms.')

def lit(s):
    return 'null' if s is None else "'" + str(s).replace("'", "''") + "'"
rows = []
for x in Q:
    rows.append('(' + ', '.join([lit(x['role']), lit(x['qkey']), str(x['sort']), lit(x['kind']), lit(x['label_en']), lit(x['label_fr']),
        lit(x['help_en']), lit(x['help_fr']), lit(json.dumps(x['options'], ensure_ascii=False)) + '::jsonb', 'true' if x['required'] else 'false',
        'true' if x['other'] else 'false', 'null' if x['min_v'] is None else str(x['min_v']), 'null' if x['max_v'] is None else str(x['max_v'])]) + ')')
sql = ('insert into public.volunteer_survey_questions (role, qkey, sort, kind, label_en, label_fr, help_en, help_fr, options, required, other, min_v, max_v) values\n  '
       + ',\n  '.join(rows) + '\non conflict (role, qkey) do nothing;\n')
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'wa174_questions.sql'), 'w', encoding='utf8').write(sql)
print(len(Q), 'questions')
