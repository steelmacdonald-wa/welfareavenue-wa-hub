#!/usr/bin/env python3
"""wave261 (16/10/26): the four Holiday Gift Basket Drive forms, in English and in French (eight crm_forms rows).

Steel, 16/10/26: "I think we should have a new volunteer application form via the hub so that we can collect them on that
page as a pop-up form, to donate gifts and essentials, to volunteer with us. I don't want it to bring people to a different
page. I want it to pop up a form for each of those actions that they can take. Same thing for companies and sponsors and
schools and groups."

Prints the SQL that wa261_drive_forms.sql carries (section 6). Edit the words here, run it, and paste the output there.
Each form: purpose (the CRM's form groups), settings.campaign gift-basket-drive (tagged, counted in the Fundraising app),
settings.request (a Request for Fundraising, assigned to the request type's default: Amanda), and for the donation pledge
settings.gift_pledge (a pledged row in campaign_gifts that waits for a staff Confirm). The volunteer form keeps a
volunteering record and lands in Applicants received (crm_form_apply step 7c), with role_text naming the drive.
"""
import json

CONSENT = {
    'en': 'Yes, Welfare Avenue can email me news, volunteer call-outs and ways to help. I can unsubscribe at any time.',
    'fr': 'Oui, Welfare Avenue peut m’envoyer par courriel des nouvelles, des appels aux bénévoles et des façons d’aider. Je peux me désabonner en tout temps.',
}
CAMPAIGN = 'gift-basket-drive'


def q(id, type, label, required=False, to=None, help=None, options=None, **extra):
    o = {'id': id, 'type': type, 'label': label, 'required': required}
    if to: o['to'] = to
    if help: o['help'] = help
    if options is not None: o['options'] = [dict(zip(('v', 'l', 'd'), x)) if len(x) == 3 else {'v': x[0], 'l': x[1]} for x in options]
    o.update(extra)
    return o


def names(lang, you=False):
    if lang == 'fr':
        return [q('first_name', 'text', 'Votre prénom' if you else 'Prénom', True, 'contact.first_name'),
                q('last_name', 'text', 'Votre nom' if you else 'Nom', True, 'contact.last_name'),
                q('email', 'email', 'Courriel', True, 'contact.email')]
    return [q('first_name', 'text', 'Your first name' if you else 'First name', True, 'contact.first_name'),
            q('last_name', 'text', 'Your last name' if you else 'Last name', True, 'contact.last_name'),
            q('email', 'email', 'Email', True, 'contact.email')]


FORMS = []

# ---------- a. Donate gifts and essentials (a pledge) ----------
for lang, slug in (('en', 'gift-drive-give'), ('fr', 'paniers-donner')):
    fr = lang == 'fr'
    FORMS.append({
        'slug': slug, 'lang': lang, 'kind': 'general', 'purpose': 'gifts', 'cover_photo_id': 110,
        'title': 'Donner des cadeaux et des articles' if fr else 'Donate gifts and essentials',
        'intro': ('Merci de penser à notre collecte de paniers-cadeaux des Fêtes! Dites-nous ce que vous aimeriez donner et nous vous écrirons pour planifier le dépôt, ou une cueillette ensemble.'
                  if fr else 'Thank you for thinking of our Holiday Gift Basket Drive! Tell us what you’d like to give and we’ll write back to plan the drop-off, or a pick-up together.'),
        'questions': names(lang) + [
            q('phone', 'phone', 'Téléphone' if fr else 'Phone', False, 'contact.phone',
              'Seulement si vous voulez qu’on vous appelle ou vous texte pour le dépôt.' if fr else 'Only if you’d like us to call or text about the drop-off.'),
            q('organization', 'text', 'Entreprise ou organisme' if fr else 'Company or organization', False, None,
              'Si vous donnez au nom d’une entreprise, d’une école ou d’un groupe.' if fr else 'If you’re giving on behalf of a company, a school or a group.'),
            q('what', 'multi', 'Qu’aimeriez-vous donner?' if fr else 'What would you like to give?', True, None,
              'Les vêtements peuvent être usagés, en bon état. Les articles d’hygiène et les jouets doivent être neufs, pour que chaque cadeau en soit vraiment un.' if fr
              else 'Clothing can be gently used. Hygiene essentials and toys must be brand new, so every gift feels like a gift.',
              [('clothing', 'Vêtements (usagés en bon état, c’est parfait)' if fr else 'Clothing (gently used is fine)'),
               ('hygiene', 'Articles d’hygiène (neufs)' if fr else 'Hygiene essentials (brand new)'),
               ('toys', 'Jouets (neufs)' if fr else 'Toys (brand new)'),
               ('books', 'Livres' if fr else 'Books'),
               ('other', 'Autre chose' if fr else 'Something else')]),
            q('what_other', 'text', 'Autre chose? Dites-nous quoi' if fr else 'Something else? Tell us what', False),
            q('how_many', 'number', 'Environ combien d’articles?' if fr else 'Roughly how many items?', True, None,
              'Une estimation, c’est parfait.' if fr else 'An estimate is perfect.'),
            q('dropoff', 'choice', 'Comment aimeriez-vous nous les remettre?' if fr else 'How would you like to get them to us?', True, None, None,
              [('dropoff', 'Je vais les déposer' if fr else 'I’ll drop them off'),
               ('pickup', 'J’aurais besoin d’une cueillette' if fr else 'I’d need a pick-up'),
               ('not_sure', 'Je ne sais pas encore' if fr else 'Not sure yet')]),
            q('area', 'text', 'Votre quartier ou code postal' if fr else 'Your area or postal code', False, None,
              'Pour planifier un lieu de dépôt ou une cueillette près de chez vous.' if fr else 'So we can plan a drop-off spot or a pick-up near you.'),
            q('when', 'text', 'Quand vos articles seront-ils prêts?' if fr else 'When will your items be ready?', False, None,
              'Nous recueillons les dons de la mi-novembre à la fin novembre.' if fr else 'We’re collecting donations from mid-November to the end of November.'),
            q('comments', 'long_text', 'Autre chose que nous devrions savoir?' if fr else 'Anything else we should know?', False, 'note'),
            q('rule_ok', 'multi', 'Avant d’envoyer' if fr else 'Before you send', True, None, None,
              [('yes', 'Je comprends que les articles d’hygiène et les jouets doivent être neufs.' if fr else 'I understand that hygiene essentials and toys must be brand new.')]),
        ],
        'thank_you': ('Vos cadeaux vont rendre les Fêtes de quelqu’un un peu plus belles. Notre équipe vous écrira bientôt pour le dépôt ou la cueillette.'
                      if fr else 'Your gifts will make someone’s holidays a little brighter. Our team will write to you soon about the drop-off or a pick-up.'),
        'settings': {'tags': [CAMPAIGN], 'campaign': CAMPAIGN, 'gift_pledge': True, 'confirm': False,
                     'request': {'type': 'gift-drive', 'title': 'Gift drive, items', 'who': 'organization', 'count': 'how_many', 'count_word': 'items'}},
    })

# ---------- b. Volunteer for the drive (Applicants received) ----------
for lang, slug in (('en', 'gift-drive-volunteer'), ('fr', 'paniers-benevole')):
    fr = lang == 'fr'
    FORMS.append({
        'slug': slug, 'lang': lang, 'kind': 'volunteer', 'purpose': 'volunteers', 'cover_photo_id': 102,
        'title': 'Faire du bénévolat pour la collecte' if fr else 'Volunteer with the drive',
        'intro': ('Aidez-nous à trier, emballer et livrer 6 000 cadeaux cet hiver. Dites-nous comment vous aimeriez aider et quand vous êtes disponible; nous vous écrirons dès que les dates seront fixées.'
                  if fr else 'Help us sort, wrap and deliver 6,000 gifts this holiday season. Tell us how you’d like to help and when you’re free, and we’ll be in touch as soon as the dates are set.'),
        'questions': names(lang) + [
            q('phone', 'phone', 'Téléphone' if fr else 'Phone', True, 'contact.phone',
              'Pour vous joindre au sujet des dates.' if fr else 'So we can reach you about the dates.'),
            q('tasks', 'multi', 'Comment aimeriez-vous aider?' if fr else 'How would you like to help?', True, None, None,
              [('wrapping', 'Emballer des cadeaux à notre événement de décembre' if fr else 'Wrapping gifts at our December event',
                'Une ou deux fins de semaine en décembre. Les dates seront annoncées bientôt.' if fr else 'One or two weekends in December. Dates are coming soon.'),
               ('sorting', 'Recueillir et trier les dons' if fr else 'Collecting and sorting donations',
                'De la mi-novembre à la fin novembre.' if fr else 'From mid-November to the end of November.'),
               ('delivery', 'Livrer des cadeaux' if fr else 'Delivering gifts',
                'Avant les Fêtes, partout à Montréal.' if fr else 'Before the holidays, across Montreal.')]),
            q('availability', 'multi', 'Quand êtes-vous habituellement disponible?' if fr else 'When are you usually free?', True, None, None,
              [('weekday_day', 'En semaine, le jour' if fr else 'Weekdays, daytime'),
               ('weekday_evening', 'En semaine, le soir' if fr else 'Weekday evenings'),
               ('weekend', 'La fin de semaine' if fr else 'Weekends')]),
            q('age_16', 'yes_no', 'Avez-vous 16 ans ou plus?' if fr else 'Are you 16 or older?', True, 'field:age_16_plus',
              'Sinon, dites-le-nous plus bas et nous verrons ensemble comment vous pouvez participer.' if fr else 'If not, tell us below and we’ll figure out together how you can join in.'),
            q('heard', 'text', 'Comment avez-vous entendu parler de la collecte?' if fr else 'How did you hear about the drive?', False),
            q('comments', 'long_text', 'Autre chose que nous devrions savoir?' if fr else 'Anything else we should know?', False, 'note'),
        ],
        'thank_you': ('Nous avons bien reçu votre inscription pour aider à la collecte de paniers-cadeaux des Fêtes. Nous vous écrirons dès que les dates seront fixées.'
                      if fr else 'You’re signed up to help with the Holiday Gift Basket Drive. We’ll be in touch as soon as the dates are set.'),
        'settings': {'tags': [CAMPAIGN], 'campaign': CAMPAIGN, 'volunteer_record': True, 'city': 'Montreal', 'confirm': False,
                     'role_text': 'Holiday Gift Basket Drive', 'role_q': 'tasks',
                     'request': {'type': 'gift-drive', 'title': 'Gift drive, volunteer'}},
    })

# ---------- c. Companies and sponsors ----------
for lang, slug in (('en', 'gift-drive-sponsor'), ('fr', 'paniers-entreprises')):
    fr = lang == 'fr'
    FORMS.append({
        'slug': slug, 'lang': lang, 'kind': 'general', 'purpose': 'sponsors', 'cover_photo_id': 110,
        'title': 'Entreprises et commanditaires' if fr else 'Companies and sponsors',
        'intro': ('Les entreprises rendent la collecte possible : des produits, du matériel d’emballage, une boîte de collecte ou une équipe qui vient emballer avec nous. Parlez-nous de votre entreprise et nous vous enverrons notre trousse de commandite.'
                  if fr else 'Businesses make the drive possible, with products, wrapping supplies, a collection bin or a team that wraps with us. Tell us a little about your company and we’ll send you our sponsorship package.'),
        'questions': [q('company', 'text', 'Entreprise ou organisme' if fr else 'Company or organization', True)] + names(lang, True) + [
            q('role', 'text', 'Votre poste' if fr else 'Your role', False),
            q('phone', 'phone', 'Téléphone' if fr else 'Phone', False, 'contact.phone'),
            q('help_how', 'multi', 'Comment aimeriez-vous aider?' if fr else 'How would you like to help?', True, None, None,
              [('products', 'Donner des produits (en nature)' if fr else 'Donating products (in kind)'),
               ('supplies', 'Du matériel d’emballage' if fr else 'Wrapping supplies'),
               ('team', 'Du bénévolat d’équipe (emballer avec nous)' if fr else 'Employee volunteering (wrap with us)'),
               ('bin', 'Une boîte de collecte à vos bureaux' if fr else 'A collection bin at your location'),
               ('money', 'Une commandite financière' if fr else 'A financial sponsorship')]),
            q('size', 'text', 'Quelle ampleur de soutien envisagez-vous?' if fr else 'What size of support do you have in mind?', False, None,
              'Un nombre d’articles, un budget ou la taille de votre équipe : tout nous aide à planifier.' if fr else 'A number of items, a budget or a team size: anything helps us plan.'),
            q('message', 'long_text', 'Votre message' if fr else 'Your message', False, 'note'),
        ],
        'thank_you': ('Nous vous enverrons notre trousse de commandite et vous écrirons pour planifier la suite ensemble.'
                      if fr else 'We’ll send you our sponsorship package and be in touch to plan it together.'),
        'settings': {'tags': [CAMPAIGN, 'sponsor prospect'], 'campaign': CAMPAIGN, 'confirm': False,
                     'request': {'type': 'gift-drive', 'title': 'Gift drive, company', 'who': 'company'}},
    })

# ---------- d. Schools and groups ----------
AGES = {'en': [('adults', 'Everyone is 18 or older'), ('mixed', 'Some are under 18, with adult supervisors'), ('youth', 'Mostly under 18, with adult supervisors')],
        'fr': [('adults', 'Tout le monde a 18 ans ou plus'), ('mixed', 'Certains ont moins de 18 ans, avec des adultes responsables'), ('youth', 'La plupart ont moins de 18 ans, avec des adultes responsables')]}
for lang, slug in (('en', 'gift-drive-group'), ('fr', 'paniers-groupes')):
    fr = lang == 'fr'
    FORMS.append({
        'slug': slug, 'lang': lang, 'kind': 'volunteer', 'purpose': 'groups', 'cover_photo_id': 102,
        'title': 'Écoles et groupes' if fr else 'Schools and groups',
        'intro': ('Venez avec votre classe, votre club ou votre équipe pour recueillir des dons, emballer des cadeaux ou faire du bénévolat ensemble. Parlez-nous de votre groupe et nous trouverons la bonne formule.'
                  if fr else 'Bring your class, club or team to collect donations, wrap gifts or volunteer together. Tell us about your group and we’ll find the right fit.'),
        'questions': [
            q('group_name', 'text', 'Nom de votre groupe ou organisme' if fr else 'Name of your group or organization', True),
            q('group_type', 'choice', 'De quel type de groupe s’agit-il?' if fr else 'What kind of group is it?', True, None, None,
              [('school', 'École, cégep ou université' if fr else 'School, college or university'),
               ('club', 'Club ou association' if fr else 'Club or association'),
               ('team', 'Équipe sportive' if fr else 'Sports team'),
               ('company', 'Équipe d’entreprise' if fr else 'Company team'),
               ('faith', 'Groupe confessionnel' if fr else 'Faith group'),
               ('other', 'Autre chose' if fr else 'Something else')]),
        ] + names(lang, True) + [
            q('phone', 'phone', 'Téléphone' if fr else 'Phone', True, 'contact.phone',
              'Pour vous joindre pendant la planification.' if fr else 'So we can reach you while we plan.'),
            q('size', 'number', 'Combien de personnes?' if fr else 'How many people?', True, None, 'Une estimation suffit.' if fr else 'An estimate is fine.'),
            q('activities', 'multi', 'Que voudrait faire votre groupe?' if fr else 'What would your group like to do?', True, None, None,
              [('collect', 'Recueillir des dons (une collecte à votre école ou à vos bureaux)' if fr else 'Collect donations (a drive at your school or workplace)'),
               ('wrap', 'Emballer des cadeaux à notre événement de décembre' if fr else 'Wrap gifts at our December event'),
               ('volunteer', 'Faire du bénévolat en groupe' if fr else 'Volunteer as a group')]),
            q('ages', 'choice', 'L’âge des membres du groupe' if fr else 'Ages in your group', True, None, None, AGES[lang]),
            q('timing', 'text', 'Quand cela conviendrait-il à votre groupe?' if fr else 'When would suit your group?', False, None,
              'Les dons arrivent de la mi-novembre à la fin novembre; l’emballage a lieu en décembre.' if fr else 'Donations come in from mid to end of November; wrapping is in December.'),
            q('comments', 'long_text', 'Autre chose à nous dire?' if fr else 'Anything else we should know?', False, 'note'),
        ],
        'thank_you': ('Nous avons les détails de votre groupe et notre équipe vous écrira pour planifier le tout avec vous.'
                      if fr else 'We have your group’s details, and our team will be in touch to plan it with you.'),
        'settings': {'tags': [CAMPAIGN, 'group sign-up'], 'campaign': CAMPAIGN, 'volunteer_record': False, 'confirm': False,
                     'request': {'type': 'gift-drive', 'title': 'Gift drive, group', 'who': 'group_name', 'count': 'size', 'count_word': 'people'}},
    })


def lit(v):
    return '$j$' + v + '$j$'


def sql():
    out = []
    for f in FORMS:
        consent = {'ask': True, 'required': False, 'label': CONSENT[f['lang']]}
        out.append(
            "insert into public.crm_forms (slug, title, intro, lang, kind, status, questions, consent, thank_you, settings, cover_photo_id, purpose, created_by, updated_by, published_at, published_by)\n"
            "select {slug}, {title}, {intro}, {lang}, {kind}, 'published', {qs}::jsonb, {consent}::jsonb, {ty}, {st}::jsonb, {cover}, {purpose}, 'Claude (16/10 drive forms)', 'Claude (16/10 drive forms)', now(), 'Claude for Steel (16/10/26: \"pop up a form for each of those actions\")'\n"
            " where not exists (select 1 from public.crm_forms where slug = {slug});".format(
                slug=lit(f['slug']), title=lit(f['title']), intro=lit(f['intro']), lang=lit(f['lang']), kind=lit(f['kind']),
                qs=lit(json.dumps(f['questions'], ensure_ascii=False)), consent=lit(json.dumps(consent, ensure_ascii=False)),
                ty=lit(f['thank_you']), st=lit(json.dumps(f['settings'], ensure_ascii=False)), cover=f['cover_photo_id'], purpose=lit(f['purpose'])))
    return '\n'.join(out)


if __name__ == '__main__':
    print(sql())
