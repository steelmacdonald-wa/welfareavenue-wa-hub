# -*- coding: utf-8 -*-
"""Welfare Avenue website copy, English and French (wave162, 28/09/26). Voice: wa-brand and wa-writing (people we
serve, community, support, youth-powered, food as a starting point; no em dashes; impact first). Figures (www3,
01/10/26, Steel: "give all your best estimate off the data the hub provides"): best estimates from the Hub, April 2020
to September 2026, rounded down; the method and every input are in the project doc claude/www3-impact-figures.md.
Story: the Hub's Our story highlights (wa_history, published, everyone). Partners: wa_partners with status active and
visibility everyone. Press: the old website's press page."""

HUB = 'https://hub.welfareavenue.com'
GIVE = HUB + '/give'
EMAIL = 'info@welfareavenue.com'
# www3 (01/10/26): Welfare Avenue's phone line (Steel, 01/10/26), shown the North American way in English and the
# Quebec way in French
PHONE = {'tel': '+14388087754', 'en': '(438) 808-7754', 'fr': '438 808-7754', 'ld': '+1-438-808-7754'}
CHARITY = '713048502RR0001'
SOCIAL = [('Instagram', 'https://www.instagram.com/welfareavenue/'), ('TikTok', 'https://www.tiktok.com/@welfareavenue'),
          ('LinkedIn', 'https://www.linkedin.com/company/75487020/')]
REVIEW = 'https://g.page/r/CVcrTC0okpYpEB0/review'

PATHS = {
    'home': {'en': '/', 'fr': '/fr/'},
    'about': {'en': '/about/', 'fr': '/fr/a-propos/'},
    'volunteer': {'en': '/volunteer/', 'fr': '/fr/benevolat/'},
    'events': {'en': '/events/', 'fr': '/fr/evenements/'},
    'press': {'en': '/press/', 'fr': '/fr/presse/'},
    'contact': {'en': '/contact/', 'fr': '/fr/contact/'},
    'donate': {'en': '/donate/', 'fr': '/fr/donner/'},
    # wave194 (02/10/26): the website accounts (not in the menu or the sitemap) and the privacy notice
    'account': {'en': '/account/', 'fr': '/fr/compte/'},
    'privacy': {'en': '/privacy/', 'fr': '/fr/confidentialite/'},
}
# The menu, in the order of Edison's design (www2, 01/10/26). Contact and Sign up sit in the header's side group.
NAV = ['home', 'volunteer', 'donate', 'events', 'press', 'about']

UI = {
    'en': {
        'nav': {'home': 'Home', 'about': 'About us', 'volunteer': 'Volunteer', 'events': 'Our activities', 'press': 'Press', 'contact': 'Contact', 'donate': 'Donate'},
        'signup': 'Sign up',
        'skip': 'Skip to content', 'menu': 'Menu', 'home_label': 'Welfare Avenue, home', 'main_nav': 'Main',
        'other_lang': 'Français', 'other_code': 'fr',
        'hint': 'Ce site est aussi offert en français.', 'hint_link': 'Voir la version française', 'hint_close': 'Fermer',
        'desc': 'Building pathways', 'desc_gold': 'in our community',
        'foot_about': 'A youth-powered registered charity fighting food insecurity and poverty through direct community action, in Montreal, Toronto and beyond.',
        'foot_explore': 'Explore', 'foot_involved': 'Get involved', 'foot_follow': 'Stay in touch',
        'foot_links_involved': [('volunteer', 'Volunteer'), ('donate', 'Donate'), ('contact#newsletter', 'Newsletter'), ('contact', 'Host a fundraiser')],
        'charity': 'Registered charity', 'review': 'Leave us a Google review', 'rights': 'Welfare Avenue',
        'site_name': 'Welfare Avenue',
        'noscript_forms': 'This form needs JavaScript. You can write to us at',
        'logo_alt': 'Welfare Avenue, building pathways in our community',
        'account': 'My account', 'privacy': 'Privacy',
    },
    'fr': {
        'nav': {'home': 'Accueil', 'about': 'À propos', 'volunteer': 'Bénévolat', 'events': 'Nos activités', 'press': 'Presse', 'contact': 'Contact', 'donate': 'Faire un don'},
        'signup': 'S’inscrire',
        'skip': 'Aller au contenu', 'menu': 'Menu', 'home_label': 'Welfare Avenue, accueil', 'main_nav': 'Principal',
        'other_lang': 'English', 'other_code': 'en',
        'hint': '', 'hint_link': '', 'hint_close': '',
        'desc': 'Bâtir des chemins', 'desc_gold': 'dans notre communauté',
        'foot_about': 'Un organisme de bienfaisance enregistré, porté par les jeunes, qui lutte contre l’insécurité alimentaire et la pauvreté par l’action directe dans la communauté, à Montréal, à Toronto et au-delà.',
        'foot_explore': 'Explorer', 'foot_involved': 'S’impliquer', 'foot_follow': 'Restez en contact',
        'foot_links_involved': [('volunteer', 'Devenir bénévole'), ('donate', 'Faire un don'), ('contact#newsletter', 'Infolettre'), ('contact', 'Organiser une collecte de fonds')],
        'charity': 'Organisme de bienfaisance enregistré', 'review': 'Laissez-nous un avis Google', 'rights': 'Welfare Avenue (Avenue du Bien-Être)',
        'site_name': 'Welfare Avenue',
        'noscript_forms': 'Ce formulaire a besoin de JavaScript. Vous pouvez nous écrire à',
        'logo_alt': 'Welfare Avenue, bâtir des chemins dans notre communauté',
        'account': 'Mon compte', 'privacy': 'Confidentialité',
    },
}

# www3 (01/10/26): our best estimates from the Hub, April 2020 to September 2026, each rounded down (method and inputs in
# claude/www3-impact-figures.md). Meals ~14,700: WA's own count of more than 10,000 by October 2023, then the servings the
# Hub records since at their recorded or typical meals. Servings 258: WA's count of 180 by October 2023, then 69 Montreal
# servings and 9 Toronto, Ottawa and partner food events in the Hub. Raised ~$76,400: the compiled statements for FY2022 to
# FY2025 ($55,484), the bank to July 2026 ($12,909) and about $8,000 before incorporation (WA's own $40,000 to date in
# October 2023, less FY2022 and FY2023). Gifts: 1,500+ in December 2024 and 3,000+ in December 2025. Fundraisers: WA's 25
# by October 2023 and 12 since. Partners: 119 organizations in the Hub's register (active or past; 102 without suppliers,
# venues and media). Volunteers: WA's own 600+ (March 2026); the Hub holds 510 volunteer records, most of 2020 to 2022 not.
IMPACT = {
    'en': {'meals': ('14,000+', 'meals served since April 2020'),
           'servings': ('250+', 'servings since April 2020, in Montreal, Toronto and Ottawa'),
           'gifts': ('4,500+', 'holiday gifts hand-delivered in 2024 and 2025'),
           'volunteers': ('600+', 'volunteers since 2020'),
           'raised': ('$75,000+', 'given by our community since 2020'),
           'fundraisers': ('35+', 'fundraising events'),
           'partners': ('100+', 'partners: schools, businesses, community groups and shelters')},
    'fr': {'meals': ('14 000+', 'repas servis depuis avril 2020'),
           'servings': ('250+', 'distributions de repas depuis avril 2020, à Montréal, à Toronto et à Ottawa'),
           'gifts': ('4 500+', 'cadeaux des fêtes livrés en main propre en 2024 et 2025'),
           'volunteers': ('600+', 'bénévoles depuis 2020'),
           'raised': ('75 000 $+', 'donnés par notre communauté depuis 2020'),
           'fundraisers': ('35+', 'activités de collecte de fonds'),
           'partners': ('100+', 'partenaires : écoles, entreprises, groupes communautaires et refuges')},
}
def _impact(keys): return {l: [IMPACT[l][k] for k in keys] for l in ('en', 'fr')}
# The four tiles beside the pillars (home and About), the volunteer page's two, the donate page's six
STATS = _impact(['meals', 'servings', 'gifts', 'volunteers'])
STATS_VOLUNTEER = _impact(['volunteers', 'servings'])
STATS_DONATE = _impact(['raised', 'meals', 'servings', 'gifts', 'fundraisers', 'partners'])
STATS_NOTE = {'en': 'Our best estimates from our records, April 2020 to September 2026, rounded down.',
              'fr': 'Nos meilleures estimations, tirées de nos registres d’avril 2020 à septembre 2026, arrondies à la baisse.'}

# www3 (01/10/26): what a gift buys, from the Hub's grocery orders and the 2026 recipe book (Steel: "make them based on how
# much a recipe can provide"). A volunteer cook's grocery order: median $72.52 (46 orders, September 2025 to July 2026),
# for 30 to 35 people (the cook's role description), so about $2.10 to $2.40 a portion. A recipe in the book serves 8 to 10
# (fruit salad 8 to 10, oatmeal bars 16, tacos 12). A Sunday serving: about $220 to $245 of groceries for about 50 plates
# (January to July 2026, 13 servings, $3,156). Gifts are not earmarked: the note under the list says so.
LADDER = {
    'en': [('$25', 'One recipe from our cookbook', 'The groceries for a fruit salad for 8 to 10 people, or a tray of 16 no-bake oatmeal bars.'),
           ('$75', 'One volunteer cook’s batch', 'A dish for 30 to 35 people, cooked at home by a volunteer, like our sweet potato and black bean salad.'),
           ('$250', 'A whole Sunday serving', 'Groceries for about 50 plates downtown, each with a main, a side and fruit or dessert.'),
           ('$20 a month', 'A recipe every month', 'About 100 portions over a year, served every second Sunday.')],
    'fr': [('25 $', 'Une recette de notre livre', 'L’épicerie d’une salade de fruits pour 8 à 10 personnes, ou d’un plateau de 16 barres d’avoine sans cuisson.'),
           ('75 $', 'Le plat d’un cuisinier bénévole','Un plat pour 30 à 35 personnes, cuisiné à la maison par un bénévole, comme notre salade de patates douces et de haricots noirs.'),
           ('250 $', 'Tout un repas du dimanche', 'L’épicerie d’environ 50 assiettes au centre-ville, chacune avec un plat, un accompagnement et des fruits ou un dessert.'),
           ('20 $ par mois', 'Une recette chaque mois', 'Environ 100 portions par année, servies un dimanche sur deux.')],
}
LADDER_NOTE = {'en': 'Estimates from our 2026 grocery orders and recipe book. Every gift supports all of our programs.',
               'fr': 'Estimations tirées de nos commandes d’épicerie et de notre livre de recettes 2026. Chaque don soutient l’ensemble de nos programmes.'}

PILLARS = {
    'en': [
        ('Food security mobilization', 'Home-cooked meals, served every second Sunday in downtown Montreal by youth volunteers who cook, drive and serve. In Toronto, our team brings free food events to shelters and drop-in centres.'),
        ('Dignified resource distribution', 'Clothing, hygiene baskets and seasonal essentials, offered with care and choice. Our Holiday Gift Basket Drive hand-delivered more than 3,000 gifts in 2025.'),
        ('Dismantling social isolation', 'A meal is also a conversation. Many of our volunteers come back again and again, so the people we serve see familiar faces and a community that knows them.'),
        ('Integrating the care ecosystem', 'We build trust through food, then connect people with the services they need, alongside shelters and community organizations across the city.'),
    ],
    'fr': [
        ('Mobiliser pour la sécurité alimentaire', 'Des repas maison, servis un dimanche sur deux au centre-ville de Montréal par de jeunes bénévoles qui cuisinent, conduisent et servent. À Toronto, notre équipe organise des repas gratuits dans des refuges et des centres de jour.'),
        ('Distribuer des ressources avec dignité', 'Vêtements, trousses d’hygiène et articles de saison, offerts avec soin et en laissant le choix. Notre collecte de paniers-cadeaux des fêtes a livré plus de 3 000 cadeaux en 2025.'),
        ('Briser l’isolement social', 'Un repas, c’est aussi une conversation. Beaucoup de nos bénévoles reviennent encore et encore : les personnes que nous servons retrouvent des visages familiers et une communauté qui les connaît.'),
        ('Relier l’écosystème de soutien', 'Nous bâtissons la confiance autour de la nourriture, puis nous orientons les gens vers les services dont ils ont besoin, avec des refuges et des organismes communautaires de partout en ville.'),
    ],
}

QUOTE_PARTNER = {
    'orig': '« Cet organisme est actuellement un maillon essentiel dans la réponse collective alimentaire que les organismes communautaires construisent face à cette crise. »',
    'orig_lang': 'fr',
    'tr': {'en': 'Translation: This organization is currently an essential link in the collective food response that community organizations are building in the face of this crisis.', 'fr': ''},
    'who': 'François Bergeron', 'role': {'en': 'Executive Director, CDC Centre-Sud', 'fr': 'directeur général, CDC Centre-Sud'},
}
QUOTE_VOLUNTEER = {
    'orig': '“Being part of the Welfare Avenue’s project gives me a sense of accomplishment. I have learned how important [it] is for those in need to be seen, to be acknowledged and to feel that we all are part of the same community.”',
    'orig_lang': 'en',
    'tr': {'en': '', 'fr': 'Traduction : Faire partie du projet de Welfare Avenue me donne un sentiment d’accomplissement. J’ai appris à quel point il est important pour les personnes dans le besoin d’être vues, d’être reconnues et de sentir que nous faisons tous partie de la même communauté.'},
    'who': 'Alejandra M.', 'role': {'en': 'volunteer cook', 'fr': 'bénévole en cuisine'},
}

STORY = {
    'en': [
        ('April 2020', 'Welfare Avenue begins in Montreal. With a few friends and 100 sandwiches, our founder Steel MacDonald starts bringing food downtown during the first lockdown.'),
        ('Spring 2020', 'Weekly servings begin, run from the trunk of a car with donated groceries and meals.'),
        ('March 2021', 'Our first large public event, with Sportira, brings food and essentials to hundreds of people outside Berri-UQAM metro.'),
        ('June 2021', 'We get our own tent, and setting it up becomes part of every downtown serving.'),
        ('October 2021', 'Welfare Avenue incorporates as a Quebec non-profit.'),
        ('May 2022', 'CBC News features our student volunteers, the start of a year of news coverage.'),
        ('October 2023', 'The Canada Revenue Agency registers Welfare Avenue as a charity.'),
        ('September 2024', 'Our first Toronto serving: 36 meals, with a new student chapter.'),
        ('December 2024', 'Our biggest cook yet: with Adaptavist, 15 volunteers cook more than 250 homemade meals in under six hours for local shelters.'),
        ('December 2025', 'Our second Holiday Gift Basket Drive, with Scattered and CEP, hand-delivers more than 3,000 gifts across Montreal.'),
        ('March 2026', 'Our first Ottawa event, with about 20 University of Ottawa student volunteers.'),
        ('August 2026', 'Our first Community Kitchen, with DESTA Black Community Network, and a new brand built on one idea: service is solidarity, not charity.'),
    ],
    'fr': [
        ('Avril 2020', 'Welfare Avenue voit le jour à Montréal. Avec quelques amis et 100 sandwichs, notre fondateur Steel MacDonald commence à apporter de la nourriture au centre-ville pendant le premier confinement.'),
        ('Printemps 2020', 'Les distributions hebdomadaires commencent, depuis le coffre d’une voiture, avec des denrées et des repas donnés.'),
        ('Mars 2021', 'Notre premier grand événement public, avec Sportira, apporte nourriture et essentiels à des centaines de personnes devant le métro Berri-UQAM.'),
        ('Juin 2021', 'Nous obtenons notre propre tente, et la monter devient un rituel de chaque repas au centre-ville.'),
        ('Octobre 2021', 'Welfare Avenue est constitué en organisme à but non lucratif au Québec.'),
        ('Mai 2022', 'CBC News présente nos bénévoles étudiants, le début d’une année de couverture médiatique.'),
        ('Octobre 2023', 'L’Agence du revenu du Canada enregistre Welfare Avenue (Avenue du Bien-Être) comme organisme de bienfaisance.'),
        ('Septembre 2024', 'Notre première distribution à Toronto : 36 repas, avec une nouvelle section étudiante.'),
        ('Décembre 2024', 'Notre plus grosse journée en cuisine : avec Adaptavist, 15 bénévoles cuisinent plus de 250 repas maison en moins de six heures pour des refuges locaux.'),
        ('D\u00e9cembre 2025', 'Notre deuxième collecte de paniers-cadeaux des fêtes, avec Scattered et CEP, livre en main propre plus de 3 000 cadeaux à Montréal.'),
        ('Mars 2026', 'Notre premier événement à Ottawa, avec une vingtaine d’étudiants bénévoles de l’Université d’Ottawa.'),
        ('Août 2026', 'Notre première Cuisine communautaire, avec le DESTA Black Community Network, et une nouvelle image de marque bâtie sur une idée : servir, c’est de la solidarité, pas de la charité.'),
    ],
}

PARTNERS = {
    'Montreal': ['Sportira', 'Scattered', 'Community Engagement Project (CEP)', 'DESTA Black Community Network', 'Montreal Flag Football League',
                 'Adaptavist', 'Enactus Concordia', 'Concordia University'],
    'Toronto': ['Daily Bread Food Bank', 'Aangen Kitchen', 'Not Far From The Tree', 'Toronto Youth Food Policy Council', 'Toronto Metropolitan University'],
    'Ottawa': ['University of Ottawa'],
}
CITY = {'en': {'Montreal': 'Montreal', 'Toronto': 'Toronto', 'Ottawa': 'Ottawa'},
        'fr': {'Montreal': 'Montréal', 'Toronto': 'Toronto', 'Ottawa': 'Ottawa', 'Old Port of Montreal': 'Vieux-Port de Montréal', 'Vanier College': 'Cégep Vanier',
               'Concordia University': 'Université Concordia', 'Reggie’s, Concordia': 'Reggie’s, Université Concordia', 'University of Ottawa': 'Université d’Ottawa'}}
PARTNER_FR = {'Concordia University': 'Université Concordia', 'University of Ottawa': 'Université d’Ottawa', 'Toronto Metropolitan University': 'Toronto Metropolitan University'}

ROLES = {
    'en': [('Serve', 'Set up the tent and serve meals with care. Servers arrive by noon on serving Sundays.'),
           ('Cook', 'Prepare home-cooked meals for the serving, from the main dish to dessert.'),
           ('Drive', 'Pick up and drop off food and supplies before and after the serving.'),
           ('Wash dishes', 'Keep the kitchen moving so the next meal is ready on time.'),
           ('Take photos', 'Capture the day for our stories, with care for everyone’s privacy.'),
           ('Not sure yet?', 'Tell us what you enjoy and what you are good at, and we will find the right spot for you.')],
    'fr': [('Servir', 'Monter la tente et servir les repas avec soin. L’équipe de service arrive au plus tard à midi.'),
           ('Cuisiner', 'Préparer des repas maison pour la distribution, du plat principal au dessert.'),
           ('Conduire', 'Aller chercher et déposer la nourriture et le matériel avant et après la distribution.'),
           ('Faire la vaisselle', 'Assurer le roulement en cuisine pour que le prochain repas soit prêt à temps.'),
           ('Prendre des photos', 'Raconter la journée en images, dans le respect de la vie privée de chacun.'),
           ('Pas encore sûr?', 'Dites-nous ce que vous aimez et ce que vous faites bien, et nous trouverons la place qui vous convient.')],
}

# Past fundraisers (site_events, kind fundraising, published). Titles and one-line notes written for the new site;
# dates and places from the Hub (event 5's date from its own poster: 17 March). Poster images: build/www/images.py.
EVENTS = [
    (16, '2026-09-19', {'en': 'Rally Paper 2026', 'fr': 'Rally Paper 2026'}, 'Montreal',
     {'en': 'Our Rally Paper challenge weekend, September 19 and 20, run together with partner organizations.',
      'fr': 'Notre fin de semaine défi Rally Paper, les 19 et 20 septembre, organisée avec des organismes partenaires.'}),
    (15, '2026-08-08', {'en': 'Flag Football Tournament, with the MFL', 'fr': 'Tournoi de football-drapeau, avec la MFL'}, 'Montreal',
     {'en': '13 teams and 78 players took the field with the Montreal Flag Football League and raised $2,800. Thank you to Guru, DOSE and Lush for their support in kind, and to La Licorne de Feu for the food.',
      'fr': '13 équipes et 78 joueurs et joueuses ont foulé le terrain avec la Montreal Flag Football League et amassé 2\u00a0800\u00a0$. Merci à Guru, DOSE et Lush pour leur soutien en nature, et à La Licorne de Feu pour la nourriture.'}),
    (14, '2025-12-21', {'en': 'Holiday Gift Baskets', 'fr': 'Paniers-cadeaux des fêtes'}, 'Montreal',
     {'en': 'Our second Holiday Gift Basket Drive, with Scattered and CEP: more than 3,000 gifts hand-delivered across Montreal.',
      'fr': 'Notre deuxième collecte de paniers-cadeaux des fêtes, avec Scattered et CEP : plus de 3 000 cadeaux livrés en main propre à Montréal.'}),
    (13, '2024-12-20', {'en': 'Holiday Variety Show, with Scattered', 'fr': 'Spectacle de variétés des fêtes, avec Scattered'}, 'Reggie’s, Concordia',
     {'en': 'A free talent show that raised funds for our holiday gift drive with Scattered: more than 1,500 gifts for kids in hospital.',
      'fr': 'Un spectacle de talents gratuit qui a financé notre collecte de cadeaux avec Scattered : plus de 1 500 cadeaux pour des enfants à l’hôpital.'}),
    (12, '2024-12-06', {'en': 'Cooking for a Community, with Adaptavist', 'fr': 'Cuisiner pour une communauté, avec Adaptavist'}, 'Union United Church',
     {'en': '15 volunteers from Adaptavist and Welfare Avenue cooked more than 250 homemade meals in under six hours for local shelters.',
      'fr': '15 bénévoles d’Adaptavist et de Welfare Avenue ont cuisiné plus de 250 repas maison en moins de six heures pour des refuges locaux.'}),
    (11, '2024-03-27', {'en': 'Cupcake Bake Sale', 'fr': 'Vente de petits gâteaux'}, 'Vanier College',
     {'en': 'Cupcakes at Jake’s Café on the Vanier College campus.', 'fr': 'Des petits gâteaux au Jake’s Café, sur le campus du Cégep Vanier.'}),
    (10, '2024-03-18', {'en': 'Easter Treat Fundraiser', 'fr': 'Vente de friandises de Pâques'}, None,
     {'en': 'Easter treats ordered online from Daniella’s Delights, with proceeds to our servings.', 'fr': 'Des friandises de Pâques commandées en ligne auprès de Daniella’s Delights, au profit de nos repas du dimanche.'}),
    (9, '2024-03-04', {'en': 'Cupcake Fundraiser, with Daniella’s Delights', 'fr': 'Vente de petits gâteaux, avec Daniella’s Delights'}, 'Concordia University',
     {'en': 'A day of cupcakes in Concordia’s Hall Building.', 'fr': 'Une journée de petits gâteaux au pavillon Hall de l’Université Concordia.'}),
    (8, '2024-02-05', {'en': 'Vanier Tabling Day', 'fr': 'Kiosque au Cégep Vanier'}, 'Vanier College',
     {'en': 'Meeting students at Vanier College, with the VCSA.', 'fr': 'À la rencontre des étudiants du Cégep Vanier, avec la VCSA.'}),
    (7, '2023-12-21', {'en': 'FlagPlus Football Charity Tournament', 'fr': 'Tournoi de football-drapeau FlagPlus'}, 'Stade Hébert',
     {'en': 'A fast 3-on-3 flag football tournament, with all proceeds to Welfare Avenue.', 'fr': 'Un tournoi de football-drapeau à 3 contre 3, dont tous les profits sont allés à Welfare Avenue.'}),
    (6, '2023-11-12', {'en': 'ID8: Vision to Venture', 'fr': 'ID8 : Vision to Venture'}, 'Old Port of Montreal',
     {'en': 'Our founder spoke at Enactus Concordia’s entrepreneurship conference.', 'fr': 'Notre fondateur a pris la parole au congrès d’entrepreneuriat d’Enactus Concordia.'}),
    (5, '2023-03-17', {'en': 'St. Patrick’s Party at Reggie’s', 'fr': 'Soirée de la Saint-Patrick chez Reggie’s'}, 'Reggie’s, Concordia',
     {'en': 'A St. Patrick’s night out with MASSA, for our servings.', 'fr': 'Une soirée de la Saint-Patrick avec MASSA, au profit de nos repas du dimanche.'}),
    (4, '2023-06-21', {'en': 'Hotel Zero1 Clothing Drive', 'fr': 'Collecte de vêtements à l’Hôtel Zero1'}, 'Hotel Zero1',
     {'en': 'A clothing drive at Hotel Zero1: bags and bags of donated clothing for the people we serve.', 'fr': 'Une collecte de vêtements à l’Hôtel Zero1 : de nombreux sacs de vêtements donnés pour les personnes que nous servons.'}),
    (3, '2022-11-22', {'en': 'Variety Show, with CEED', 'fr': 'Spectacle de variétés, avec CEED'}, 'Montreal',
     {'en': 'An evening of music and performances with CEED.', 'fr': 'Une soirée de musique et de prestations avec CEED.'}),
    (2, '2022-09-30', {'en': 'Party for a Good Cause, second edition', 'fr': 'Soirée pour une bonne cause, deuxième édition'}, 'Reggie’s, Concordia',
     {'en': 'The second edition of our party for a good cause.', 'fr': 'La deuxième édition de notre soirée pour une bonne cause.'}),
    (1, '2022-04-29', {'en': 'Party for a Good Cause', 'fr': 'Soirée pour une bonne cause'}, 'Reggie’s, Concordia',
     {'en': 'An end-of-semester party at Reggie’s, with all profits going to our servings.', 'fr': 'Une soirée de fin de session chez Reggie’s, dont tous les profits sont allés à nos repas du dimanche.'}),
]

# Photos (wa_photos, usage ready): key -> caption
PHOTOS = [
    ('2022-02-winter-volunteer-group-b', {'en': 'Our winter crew at Place Émilie-Gamelin, February 2022', 'fr': 'Notre équipe d’hiver à la place Émilie-Gamelin, février 2022'},
     {'en': 'Five volunteers in winter coats and green Welfare Avenue vests pose in the snow, one giving a thumbs up.', 'fr': 'Cinq bénévoles en manteau d’hiver et dossard vert Welfare Avenue posent dans la neige, l’un d’eux le pouce levé.'}),
    ('2024-07-summer-volunteer-team', {'en': 'At the supply table, summer 2024', 'fr': 'À la table du matériel, été 2024'},
     {'en': 'Four smiling volunteers pose at a table of plates, napkins and foil trays.', 'fr': 'Quatre bénévoles souriants posent devant une table d’assiettes, de serviettes et de plateaux.'}),
    ('food-salads-and-grapes', {'en': 'Fresh salads and grapes, ready for a serving', 'fr': 'Salades fraîches et raisins, prêts pour un service'},
     {'en': 'Foil trays of green salads with cucumber and red onion, and a tray of grapes, seen from above.', 'fr': 'Plateaux de salades vertes au concombre et à l’oignon rouge, et un plateau de raisins, vus de haut.'}),
    ('2024-10-autumn-volunteers-plating', {'en': 'Plating food side by side, autumn 2024', 'fr': 'Au dressage des assiettes, automne 2024'},
     {'en': 'Two volunteers plate food side by side at the serving table.', 'fr': 'Deux bénévoles dressent des assiettes côte à côte à la table de service.'}),
    ('2022-01-winter-serving-team', {'en': 'Serving under the tent, January 2022', 'fr': 'Service sous la tente, janvier 2022'},
     {'en': 'Volunteers in green vests, seen from behind, serve under the Welfare Avenue tent in winter.', 'fr': 'Des bénévoles en dossard vert, vus de dos, servent sous la tente Welfare Avenue en hiver.'}),
    ('2024-07-summer-salad-trays', {'en': 'The serving table, summer 2024', 'fr': 'La table de service, été 2024'},
     {'en': 'Foil trays of lettuce, salad and pasta with tongs on a green tablecloth.', 'fr': 'Plateaux de laitue, de salade et de pâtes avec des pinces sur une nappe verte.'}),
    ('2024-07-summer-volunteer-portrait', {'en': 'A volunteer at the tent, summer 2024', 'fr': 'Un bénévole à la tente, été 2024'},
     {'en': 'A smiling volunteer in a green Welfare Avenue vest stands at the tent.', 'fr': 'Un bénévole souriant en dossard vert Welfare Avenue, devant la tente.'}),
    ('2022-06-media-interview-b', {'en': 'Media day at a Sunday serving, June 2022', 'fr': 'Journée médias lors d’un service du dimanche, juin 2022'},
     {'en': 'A volunteer in a green vest holds a news microphone beside the tent.', 'fr': 'Une bénévole en dossard vert tient un micro de presse près de la tente.'}),
]

PRESS = [
    {'src': 'CBC News', 'yt': '5C7RoUmCMSI', 'url': 'https://www.cbc.ca/news/canada/montreal/montreal-homeless-welfare-avenue-1.6470047',
     'title': {'en': 'CBC Montreal meets our student volunteers', 'fr': 'CBC Montreal rencontre nos bénévoles étudiants'},
     'text': {'en': 'After three of our TikTok videos went viral in 2022, CBC Montreal reporter Chloe Ranaldi reached out and interviewed the team.', 'fr': 'Après que trois de nos vidéos TikTok sont devenues virales en 2022, la journaliste Chloe Ranaldi de CBC Montreal a communiqué avec nous et a interviewé l’équipe.'},
     'link': {'en': 'Read the CBC story', 'fr': 'Lire l’article de CBC (en anglais)'}},
    {'src': 'CTV News Montreal', 'yt': 'Vf-2SEKQEuM', 'url': None,
     'title': {'en': 'CTV News finds our team at Place Émilie-Gamelin', 'fr': 'CTV News rencontre notre équipe à la place Émilie-Gamelin'},
     'text': {'en': 'Reporter Luca Caruso met our volunteers during a serving downtown, and CTV later featured our founder.', 'fr': 'Le journaliste Luca Caruso a rencontré nos bénévoles pendant une distribution au centre-ville, et CTV a ensuite consacré un reportage à notre fondateur.'},
     'link': None},
    {'src': 'CityNews Montreal', 'yt': 'XXnRy4axqKY', 'url': None,
     'title': {'en': 'CityNews Montreal meets our student volunteers', 'fr': 'CityNews Montreal rencontre nos bénévoles étudiants'},
     'text': {'en': 'Reporter Pamela Pagano spoke with our student volunteers for CityNews Montreal.', 'fr': 'La journaliste Pamela Pagano s’est entretenue avec nos bénévoles étudiants pour CityNews Montreal (en anglais).'},
     'link': None},
]

# Added 28/09/26 from Steel's "Good photos" upload (labelled in the photo library; usage ready only)
PHOTOS_NEW = [
    ('2022-10-autumn-crew-at-the-tent', {'en': 'The autumn crew in front of the tents, October 2022', 'fr': 'L’équipe d’automne devant les tentes, octobre 2022'},
     {'en': 'About twenty volunteers, many in green Welfare Avenue vests, pose in front of two green tents under yellow autumn trees.', 'fr': 'Une vingtaine de bénévoles, plusieurs en dossard vert Welfare Avenue, posent devant deux tentes vertes sous des arbres jaunis par l’automne.'}),
    ('2023-10-autumn-plate-served', {'en': 'A plate served, October 2023', 'fr': 'Une assiette servie, octobre 2023'},
     {'en': 'Volunteers in green vests serve food onto a plate held out across the table, beside a drink dispenser.', 'fr': 'Des bénévoles en dossard vert servent une assiette tendue de l’autre côté de la table, près d’une distributrice de boissons.'}),
    ('2021-11-volunteer-portrait-blue-beanie', {'en': 'A volunteer at the serving, November 2021', 'fr': 'Une bénévole lors d’un repas, novembre 2021'},
     {'en': 'A smiling volunteer in a blue beanie and white coat over a green Welfare Avenue vest, downtown.', 'fr': 'Une bénévole souriante en tuque bleue et manteau blanc, par-dessus un dossard vert Welfare Avenue, au centre-ville.'}),
    ('2024-07-summer-team-under-the-tent', {'en': 'The team under the tent, summer 2024', 'fr': 'L’équipe sous la tente, été 2024'},
     {'en': 'Thirteen volunteers in green Welfare Avenue vests pose under the green tent in a leafy park.', 'fr': 'Treize bénévoles en dossard vert Welfare Avenue posent sous la tente verte, dans un parc feuillu.'}),
    ('2022-04-spring-soup-from-the-pot', {'en': 'Soup from the pot, April 2022', 'fr': 'De la soupe servie à la louche, avril 2022'},
     {'en': 'Two masked volunteers in green vests ladle soup from a large pot into cups under the tent.', 'fr': 'Deux bénévoles masqués en dossard vert versent de la soupe d’une grande marmite dans des tasses, sous la tente.'}),
    ('2021-06-drivers-selfie', {'en': 'Drivers on the way, June 2021', 'fr': 'Les chauffeurs en route, juin 2021'},
     {'en': 'Two smiling volunteers in green vests take a selfie in a car, seatbelts on.', 'fr': 'Deux bénévoles souriants en dossard vert prennent un égoportrait en voiture, ceinture bouclée.'}),
    ('2022-01-winter-crew-in-the-snow', {'en': 'The winter crew, January 2022', 'fr': 'L’équipe d’hiver, janvier 2022'},
     {'en': 'About thirteen volunteers in winter coats and green vests pose in the snow in front of the green tent under bare trees.', 'fr': 'Une treizaine de bénévoles en manteau d’hiver et dossard vert posent dans la neige devant la tente verte, sous des arbres dénudés.'}),
    ('2024-07-summer-servers-at-the-table', {'en': 'Servers at the salad table, summer 2024', 'fr': 'À la table des salades, été 2024'},
     {'en': 'Four volunteers in green vests and gloves serve salad from foil trays along the table under the tent.', 'fr': 'Quatre bénévoles en dossard vert et gants servent de la salade à partir de plateaux, le long de la table sous la tente.'}),
    ('2021-02-winter-sandwich-prep', {'en': 'Sandwiches ready to go, February 2021', 'fr': 'Des sandwichs prêts à partir, février 2021'},
     {'en': 'A masked volunteer in a grey hoodie holds up a large bag of wrapped sandwiches in a small kitchen.', 'fr': 'Un bénévole masqué en kangourou gris tient un grand sac de sandwichs emballés dans une petite cuisine.'}),
    ('2023-10-autumn-crew-behind-the-table', {'en': 'The crew behind the table, October 2023', 'fr': 'L’équipe derrière la table, octobre 2023'},
     {'en': 'Six volunteers in green vests smile behind the serving table in a park.', 'fr': 'Six bénévoles en dossard vert sourient derrière la table de service, dans un parc.'}),
    ('2021-11-two-volunteers-at-the-tent', {'en': 'Two volunteers at the tent, November 2021', 'fr': 'Deux bénévoles à la tente, novembre 2021'},
     {'en': 'Two volunteers in green vests smile side by side under the green Welfare Avenue tent.', 'fr': 'Deux bénévoles en dossard vert sourient côte à côte sous la tente verte de Welfare Avenue.'}),
    ('2022-10-autumn-student-group', {'en': 'A student group behind the tables, October 2022', 'fr': 'Un groupe d’étudiants derrière les tables, octobre 2022'},
     {'en': 'About twenty-five young volunteers stand smiling behind folding tables under the green Welfare Avenue tent.', 'fr': 'Environ vingt-cinq jeunes bénévoles sourient derrière des tables pliantes, sous la tente verte de Welfare Avenue.'}),
    ('2022-04-spring-crew-at-the-table', {'en': 'The crew at the table, April 2022', 'fr': 'L’équipe à la table, avril 2022'},
     {'en': 'Five volunteers in green vests, some masked, pose behind the serving table under the tent.', 'fr': 'Cinq bénévoles en dossard vert, certains masqués, posent derrière la table de service sous la tente.'}),
    ('2023-05-spring-crew-under-the-tent', {'en': 'The crew under the tent, May 2023', 'fr': 'L’équipe sous la tente, mai 2023'},
     {'en': 'About twelve volunteers, most in green vests, pose in front of the green tent in a downtown park.', 'fr': 'Une douzaine de bénévoles, la plupart en dossard vert, posent devant la tente verte dans un parc du centre-ville.'}),
    ('2021-11-volunteer-portrait-under-the-tent', {'en': 'A volunteer under the tent, November 2021', 'fr': 'Une bénévole sous la tente, novembre 2021'},
     {'en': 'A smiling volunteer in a green vest over a brown jacket stands under the tent flap printed with the @welfareavenue handle.', 'fr': 'Une bénévole souriante en dossard vert par-dessus un manteau brun, sous le rabat de la tente où figure @welfareavenue.'}),
    ('2022-05-spring-grill-master', {'en': 'The grill master, May 2022', 'fr': 'Le maître du barbecue, mai 2022'},
     {'en': 'A volunteer in sunglasses and a Welfare Avenue vest flexes his arm with tongs in hand beside a grill of hot dogs.', 'fr': 'Un bénévole en lunettes de soleil et dossard Welfare Avenue fléchit le bras, pinces à la main, à côté d’un gril couvert de hot-dogs.'}),
]

# The team (wave162, 28/09/26): everyone active in the Hub's team list, by team. First names only; the roles are the
# Hub's, written for the public (French in épicène forms). 'photo' is the file under img/team (from the Hub's avatars;
# Slack's letter placeholders and a two-person photo left out, so those show initials). 'serv' and 'first' count the
# servings in the member's linked volunteer record (event rosters confirmed plus legacy attendance, past dates only);
# 'since' is the year of the member's start date in the Hub, left out where that date is the Google workspace's
# setup day (17/01/2024) and so not the day they joined. Anyone can ask to be left off.
TEAM_GROUPS = [
    ('exec', {'en': 'Leadership', 'fr': 'Direction'}),
    ('board', {'en': 'Board of directors', 'fr': 'Conseil d’administration'}),
    ('opsmtl', {'en': 'Operations, Montreal', 'fr': 'Opérations, Montréal'}),
    ('opsto', {'en': 'Toronto', 'fr': 'Toronto'}),
    ('progdev', {'en': 'Program development', 'fr': 'Développement des programmes'}),
    ('fundraising', {'en': 'Fundraising and events', 'fr': 'Collecte de fonds et événements'}),
    ('marketing', {'en': 'Marketing and content', 'fr': 'Marketing et contenu'}),
    ('hr', {'en': 'People and logistics', 'fr': 'Ressources humaines et logistique'}),
]
TEAM = [  # (hub id, team, name, role en, role fr, photo, servings, first serving year, since year)
    (37, 'exec', 'Steel', 'Founder and board president', 'Personne fondatrice, présidence du CA', 'steel', 23, 2020, None),
    (38, 'exec', 'Suhaib', 'Co-executive director', 'Codirection générale', None, 0, None, 2026),
    (32, 'board', 'Daniela', 'Treasurer', 'Trésorerie', 'daniela', 0, None, 2025),
    (39, 'board', 'Kellian', 'Board member', 'Membre du CA', None, 0, None, 2025),
    (40, 'board', 'Mohamed', 'Board member', 'Membre du CA', None, 0, None, None),
    (41, 'board', 'Tamara', 'Board member', 'Membre du CA', 'tamara', 0, None, None),
    (42, 'board', 'Rima', 'Board adviser', 'Conseil auprès du CA', None, 0, None, None),
    (1, 'opsmtl', 'Ahmed', 'Operations lead, Montreal', 'Responsable des opérations, Montréal', 'ahmed', 0, None, 2025),
    (49, 'opsmtl', 'Eno', 'Operations co-lead', 'Coresponsable des opérations', 'eno', 0, None, 2026),
    (6, 'opsmtl', 'Mary', 'Cook coordination', 'Coordination de la cuisine', 'mary', 0, None, 2026),
    (43, 'opsmtl', 'Eleftherios (Terry)', 'Operations', 'Opérations', 'eleftherios', 0, None, 2026),
    (45, 'opsmtl', 'Ibrahim', 'Operations', 'Opérations', None, 0, None, 2025),
    (9, 'opsto', 'Tate', 'Operations manager, Toronto', 'Gestion des opérations, Toronto', None, 0, None, 2025),
    (10, 'opsto', 'Melvina', 'Programs, Toronto', 'Programmes, Toronto', None, 0, None, 2026),
    (11, 'opsto', 'Mandeep', 'Partnerships', 'Partenariats', None, 0, None, None),
    (8, 'opsto', 'Gamze', 'Operations, Toronto', 'Opérations, Toronto', None, 0, None, None),
    (12, 'opsto', 'Sama', 'Toronto team', 'Équipe de Toronto', None, 0, None, 2025),
    (14, 'opsto', 'Bela', 'Toronto team', 'Équipe de Toronto', None, 0, None, None),
    (15, 'opsto', 'Gabe', 'Student relations and the Community Closet', 'Relations étudiantes et vestiaire communautaire', None, 0, None, None),
    (16, 'opsto', 'Karan', 'Volunteer driver', 'Transport bénévole', None, 0, None, 2026),
    (3, 'progdev', 'Shima', 'Program development lead', 'Responsable du développement des programmes', 'shima', 0, None, 2026),
    (4, 'progdev', 'Brianna', 'Program development and community coordination', 'Développement des programmes et coordination communautaire', 'brianna', 6, 2026, 2026),
    (46, 'progdev', 'Zachee', 'Community team lead', 'Responsable de l’équipe communautaire', None, 0, None, 2026),
    (7, 'progdev', 'Ola', 'Program development', 'Développement des programmes', None, 0, None, 2026),
    (27, 'fundraising', 'Amanda', 'Events co-lead', 'Coresponsable des événements', 'amanda', 0, None, 2026),
    (29, 'fundraising', 'Jemeela', 'Event coordinator', 'Coordination des événements', None, 0, None, None),
    (50, 'fundraising', 'Alyx', 'Event coordinator', 'Coordination des événements', None, 0, None, 2026),
    (30, 'fundraising', 'Alexis', 'Donor relations', 'Relations avec les personnes donatrices', 'alexis', 0, None, 2026),
    (33, 'fundraising', 'Cindy', 'Grants', 'Subventions', None, 0, None, None),
    (17, 'marketing', 'Ian', 'Director of marketing', 'Direction du marketing', 'ian', 0, None, None),
    (18, 'marketing', 'Kahkashan', 'Marketing co-director', 'Codirection du marketing', 'kahkashan', 0, None, 2026),
    (20, 'marketing', 'Eduardo', 'Brand lead', 'Responsable de l’image de marque', None, 0, None, 2025),
    (22, 'marketing', 'Joy', 'Content and collaborations', 'Contenu et collaborations', 'joy', 2, 2024, 2024),
    (23, 'marketing', 'Soraya', 'Design and newsletters', 'Design et infolettres', None, 2, 2026, 2024),
    (21, 'marketing', 'Alejandra', 'Designer', 'Design graphique', None, 0, None, 2025),
    (25, 'marketing', 'Patricia', 'Content and video', 'Contenu et vidéo', None, 0, None, 2025),
    (26, 'marketing', 'Edison', 'Website and photography', 'Site web et photographie', None, 0, None, 2026),
    (24, 'marketing', 'Robert', 'Copywriting', 'Rédaction', None, 0, None, None),
    (34, 'hr', 'Valex', 'Human resources lead', 'Responsable des ressources humaines', 'valex', 0, None, 2025),
    (36, 'hr', 'Samson', 'Onboarding', 'Accueil et intégration', None, 0, None, 2026),
    (2, 'hr', 'Tuna', 'Logistics', 'Logistique', None, 1, 2026, 2025),
]

# Companies that worked with us, in their own LinkedIn posts (Steel, 28/09/26). The dates come from the posts' ids.
# The posts load from LinkedIn only when a visitor asks.
COMPANY_POSTS = [
    ('Adaptavist', 'urn:li:ugcPost:7286722679879958528', 539, '2025-01',
     {'en': 'Bryan’s post about the work Adaptavist did with us.', 'fr': 'La publication de Bryan sur le travail d’Adaptavist avec nous.'}),
    ('GHD', 'urn:li:share:7335712650166759425', 668, '2025-06',
     {'en': 'GHD’s post about a day with Welfare Avenue.', 'fr': 'La publication de GHD sur une journée avec Welfare Avenue.'}),
    ('RBC', 'urn:li:share:7086448235212328961', 1070, '2023-07',
     {'en': 'A post about our collaboration with RBC.', 'fr': 'Une publication sur notre collaboration avec RBC.'}),
]

# Fundraiser photos (wave162, 28/09/26): picked from content-images 'Flagfootball 2026' (the tournament on 08/08/26;
# the Canon's clock reads May 2025, the leaves and the phones' dates say August 2026) and 'Gift basket drive'
# (December 2025, WhatsApp copies). Sources are downloaded into build/www/ev-src (not in git). Volunteers,
# players, partners and gifts only. The pictures not right for the website were moved into a 'Not for website'
# folder beside them (photo-library sideline) for Steel to review and delete.
FUND_PHOTOS = [  # (key, source under ev-src, caption, alt)
    ('2026-08-flag-football-team-in-yellow', 'flag/BN0A8586.JPG', {'en': 'A team in yellow, August 2026', 'fr': 'Une équipe en jaune, août 2026'},
     {'en': 'A team in yellow jerseys poses on the grass, the front row kneeling around a football.', 'fr': 'Une équipe en maillot jaune pose sur la pelouse, la première rangée à genoux autour d’un ballon.'}),
    ('2025-12-gift-baskets-the-crew', 'gift/motion_photo_3185939658622393109.jpg', {'en': 'The gift basket crew, December 2025', 'fr': 'L’équipe des paniers-cadeaux, décembre 2025'},
     {'en': 'About twenty volunteers hold up wrapped gifts behind tables in a bright room with city windows.', 'fr': 'Une vingtaine de bénévoles tiennent des cadeaux emballés derrière des tables, dans une pièce lumineuse qui donne sur la ville.'}),
    ('2026-08-flag-football-on-the-run', 'flag/BN0A8540.JPG', {'en': 'On the run, August 2026', 'fr': 'À la course, août 2026'},
     {'en': 'Players in yellow and white chase the play across the field, flags at their hips.', 'fr': 'Des joueurs en jaune et en blanc suivent le jeu sur le terrain, les fanions à la taille.'}),
    ('2025-12-gift-baskets-wrapping', 'gift/motion_photo_5583711275468760194.jpg', {'en': 'Wrapping gifts, December 2025', 'fr': 'L’emballage des cadeaux, décembre 2025'},
     {'en': 'Volunteers sit on the floor wrapping gifts beside large windows and stacks of boxes.', 'fr': 'Des bénévoles assis par terre emballent des cadeaux près de grandes fenêtres et de piles de boîtes.'}),
    ('2026-08-flag-football-celebration', 'flag/BN0A8601.JPG', {'en': 'Celebrating on the field, August 2026', 'fr': 'La fête sur le terrain, août 2026'},
     {'en': 'A team in yellow celebrates on the field, arms raised.', 'fr': 'Une équipe en jaune célèbre sur le terrain, les bras levés.'}),
    ('2025-12-gift-baskets-bags', 'gift/motion_photo_3336655848881728989.jpg', {'en': 'Gift bags ready to go, December 2025', 'fr': 'Des sacs-cadeaux prêts à partir, décembre 2025'},
     {'en': 'Brown paper gift bags filled with presents line a green table.', 'fr': 'Des sacs-cadeaux en papier brun remplis de présents sur une table verte.'}),
    ('2026-08-flag-football-team-photo', 'flag/27953746-b6cc-41ec-8724-9de3949d37d1.jpg', {'en': 'A team on the field, August 2026', 'fr': 'Une équipe sur le terrain, août 2026'},
     {'en': 'A group of players poses on the field under a blue sky, some crouching in front with a football.', 'fr': 'Un groupe de joueurs pose sur le terrain sous un ciel bleu, certains accroupis devant avec un ballon.'}),
    ('2025-12-gift-baskets-elf-hat', 'gift/motion_photo_2911787912436395858.jpg', {'en': 'A volunteer in an elf hat, December 2025', 'fr': 'Une bénévole au bonnet de lutin, décembre 2025'},
     {'en': 'A smiling volunteer in a green elf hat holds up a wrapped gift.', 'fr': 'Une bénévole souriante au bonnet de lutin vert tient un cadeau emballé.'}),
    ('2026-08-flag-football-referee', 'flag/BN0A8550.JPG', {'en': 'The referee, August 2026', 'fr': 'L’arbitre, août 2026'},
     {'en': 'A referee in a striped shirt and a cream cap stands by the field.', 'fr': 'Un arbitre en chandail rayé et casquette crème se tient au bord du terrain.'}),
    ('2025-12-gift-baskets-delivery', 'gift/IMG-20251223-WA0008.jpg', {'en': 'Gifts delivered, December 2025', 'fr': 'Des cadeaux livrés, décembre 2025'},
     {'en': 'Five volunteers stand with carts piled high with gift bags in a lobby.', 'fr': 'Cinq bénévoles avec des chariots chargés de sacs-cadeaux, dans un hall d’entrée.'}),
    ('2026-08-flag-football-our-tent', 'flag/20260808_113416.jpg', {'en': 'Our tent at the tournament, August 2026', 'fr': 'Notre tente au tournoi, août 2026'},
     {'en': 'Our green tent with the Welfare Avenue table banner and a red GURU drinks bin, bleachers behind.', 'fr': 'Notre tente verte avec la bannière Welfare Avenue sur la table et un bac rouge de boissons GURU, des gradins derrière.'}),
    ('2026-08-flag-football-food-truck', 'flag/BN0A8513.JPG', {'en': 'La Licorne de Feu fed the players, August 2026', 'fr': 'La Licorne de Feu a nourri les joueurs, août 2026'},
     {'en': 'A smiling man holding a can stands beside the black La Licorne de Feu food trailer, a cook at its window.', 'fr': 'Un homme souriant, une canette à la main, près de la remorque noire de La Licorne de Feu, un cuisinier à la fenêtre.'}),
]
EVENT_PHOTO = {14: '2025-12-gift-baskets-bags', 15: '2026-08-flag-football-team-in-yellow'}  # past events without a poster

# wave168 (29/09/26): the events page opens on a photo, and each fundraiser coming up shows its last edition's photo when we
# have one (said so on the photo), or the brand's green with the E that moves when we do not. Same order as FUNDRAISERS_NEXT.
EVENTS_HERO = '2026-08-flag-football-celebration'
FUND_NEXT_MEDIA = [
    None,
    ('2025-12-gift-baskets-the-crew', {'en': 'The 2025 drive', 'fr': 'La collecte 2025'}),
    ('2026-08-flag-football-team-in-yellow', {'en': 'The 2026 tournament', 'fr': 'Le tournoi 2026'}),
    None,
]

# Fundraisers coming up (wave162, 28/09/26), from the Hub's fundraising calendar (fund_events 3, 4, 13 and 14, the
# 2026-27 plan). Only the recurring ones with a season set; dates firm up closer to each event.
FUNDRAISERS_NEXT = [
    ({'en': 'One Bag Challenge', 'fr': 'One Bag Challenge'}, {'en': 'November to December 2026', 'fr': 'Novembre et décembre 2026'},
     {'en': 'Our fundraiser for the Holiday Gift Basket Drive, with clothing donated by thrift stores and brands.',
      'fr': 'Notre collecte au profit des paniers-cadeaux des fêtes, avec des vêtements donnés par des friperies et des marques.'}),
    ({'en': 'Holiday Gift Basket Drive', 'fr': 'Paniers-cadeaux des fêtes'}, {'en': 'December 2026', 'fr': 'Décembre 2026'},
     {'en': 'Our third drive: gifts collected, wrapped and hand-delivered across Montreal before the holidays.',
      'fr': 'Notre troisième collecte : des cadeaux recueillis, emballés et livrés en main propre à Montréal avant les fêtes.'}),
    ({'en': 'Flag Football Tournament', 'fr': 'Tournoi de football-drapeau'}, {'en': 'Summer 2027', 'fr': 'Été 2027'},
     {'en': 'The tournament returns with the Montreal Flag Football League. Teams can start planning now.',
      'fr': 'Le tournoi revient avec la Montreal Flag Football League. Les équipes peuvent déjà s’y préparer.'}),
    ({'en': 'Rally Paper', 'fr': 'Rally Paper'}, {'en': 'Summer 2027', 'fr': 'Été 2027'},
     {'en': 'Our challenge weekend returns, run together with partner organizations.',
      'fr': 'Notre fin de semaine défi revient, organisée avec des organismes partenaires.'}),
]

# Who we need at each serving (www2, 01/10/26, Edison's "Who do we need?"): the roster board's target for each role, from the
# Hub's app_config vol_role_targets (30/09/26: server 8, cook 4, driver 2, dishwasher 2, photographer 1, community welcome 2;
# team leaders and the community debrief are staff roles and left off). A rebuild picks up a change of targets.
SERVING_TEAM = [  # (role key in the Hub, target, title, what they do)
    ('server', 8, {'en': 'Servers', 'fr': 'Service'},
     {'en': 'Set up the tent and serve meals with care.', 'fr': 'Monter la tente et servir les repas avec soin.'}),
    ('cook', 4, {'en': 'Cooks', 'fr': 'Cuisine'},
     {'en': 'Prepare the home-cooked meals for the serving.', 'fr': 'Préparer les repas maison pour la distribution.'}),
    ('driver', 2, {'en': 'Drivers', 'fr': 'Transport'},
     {'en': 'Bring the food and supplies there and back.', 'fr': 'Apporter la nourriture et le matériel, aller-retour.'}),
    ('dishwasher', 2, {'en': 'Dishwashers', 'fr': 'Vaisselle'},
     {'en': 'Keep the kitchen moving so every meal is ready on time.', 'fr': 'Assurer le roulement en cuisine pour que chaque repas soit prêt à temps.'}),
    ('community_talker', 2, {'en': 'Community welcome', 'fr': 'Accueil'},
     {'en': 'Welcome people as they arrive: a meal is also a conversation.', 'fr': 'Accueillir les gens à leur arrivée : un repas, c’est aussi une conversation.'}),
    ('photographer', 1, {'en': 'Photographer', 'fr': 'Photographie'},
     {'en': 'Capture the day, with care for everyone’s privacy.', 'fr': 'Raconter la journée en images, dans le respect de la vie privée de chacun.'}),
]

# wave194 (02/10/26): the privacy notice on welfareavenue.com, from the Hub's volunteer notice (wave175b,
# hub.welfareavenue.com/privacy/) widened to the website: accounts (Google or a code by email), forms, the newsletter,
# gifts and receipts, signed letters, what the browser keeps. Google's sign-in screen links to it. Each section is
# (heading, [paragraphs], [list items]).
PRIVACY_UPDATED = {'en': 'Last updated October 2, 2026', 'fr': 'Mis à jour le 2 octobre 2026'}
PRIVACY = {
    'en': {
        'title': 'Privacy',
        'desc': 'How Welfare Avenue handles the information of the people who volunteer with us, give to us, write to us or sign up for our newsletter.',
        'intro': 'Welfare Avenue is a youth-powered registered charity (713048502RR0001) based in Montreal. This notice explains what we keep about the '
                 'people who volunteer with us, give to us, write to us or sign up for our newsletter, and how we use it. It covers this website, your '
                 'account on it, our forms, our donation page and the links we send by text.',
        'sections': [
            ('What we keep', [], [
                'Your name, email, phone number, the language you prefer and, if you give them, your pronouns and your address.',
                'If you volunteer: the servings you sign up for, your role, whether you confirmed, your hours, what you tell us for your role (a cook’s '
                'pickup address, a driver’s car), and your answers to the survey after a serving. We ask you not to include the names of the people we serve.',
                'If you give: the amount and date of each gift and what we need for your official tax receipt. Payments go through Stripe: we never see '
                'or keep your full card number.',
                'What you send us through our forms and by email, and the texts you exchange with our phone line.',
                'If you ask for a signed letter: the details of your request, the form you upload for us to sign, if any, and the signed letter.',
                'If you have an account: how you sign in. With Google, we receive your Google account’s name and email address, never your password, and '
                'we do not access your Gmail, Drive or contacts. With a code by email, we keep a record of the codes we send (the address, when, and a '
                'scrambled form of the internet address it was asked from) to stop misuse.',
            ]),
            ('Why we keep it', [
                'To organise our servings and keep in touch with the people who make them happen; to send you the messages you asked for, like reminders, '
                'receipts and, if you said yes, our newsletter; to issue official tax receipts; to show you your own record when you sign in; to confirm '
                'your volunteer hours when you ask us to; and to learn from your feedback.'], []),
            ('Who sees it', [
                'Only the Welfare Avenue team members whose work needs it. On a serving day, the team leader and drivers see the names, phone numbers '
                'and pickup addresses they need for that day. We do not sell or rent your information, and we do not use it for advertising.',
                'We use a few service providers to run all this: Supabase (our database, sign-in and file storage), Netlify (hosting this website), '
                'Stripe (donations), Resend (our emails), Quo (our phone line and texts) and Google (sign-in with Google, and the fonts on our pages). '
                'Their servers may be outside Quebec, including in the United States.'], []),
            ('In your browser', [
                'We do not use advertising or tracking cookies on this website. When you sign in, your browser keeps your sign-in so you stay signed in; '
                'signing out removes it. The website also remembers a few choices, like closing the banner that offers the French version.',
                'Some pages show posts from LinkedIn, press videos load from YouTube only when you press play, and our donation page uses Stripe, which '
                'sets its own cookies to prevent fraud. Those services have their own privacy policies.'], []),
            ('How long we keep it', [
                'We keep your volunteer and supporter record while you are involved with us, so we can count your servings and hours and keep your '
                'history. Gift and receipt records are kept as long as Canadian tax law requires. If you ask, we delete your record, except what the '
                'law requires us to keep.'], []),
            ('Your choices', [], [
                'Every newsletter has a link to stop it, and you can turn it off on your account.',
                'Reply STOP to any of our texts to stop them; START turns them back on.',
                'You do not need an account to volunteer or to give. The links in our texts work without one.',
                'You can see and correct most of your details on your account. To see everything we keep, correct it, or delete your record or your '
                'account, write to {email} or text {phone}.',
            ]),
            ('Questions or concerns', [
                'Write to our person in charge of protecting personal information at {email}. If you are not satisfied with our answer, you can contact '
                'the Commission d’accès à l’information du Québec.'], []),
        ],
    },
    'fr': {
        'title': 'Confidentialité',
        'desc': 'Comment Welfare Avenue traite les renseignements des personnes qui font du bénévolat avec nous, nous font un don, nous écrivent ou s’abonnent à notre infolettre.',
        'intro': 'Welfare Avenue est un organisme de bienfaisance enregistré (713048502RR0001) porté par les jeunes et établi à Montréal. Le présent avis '
                 'explique ce que nous conservons au sujet des personnes qui font du bénévolat avec nous, nous font un don, nous écrivent ou s’abonnent '
                 'à notre infolettre, et comment nous l’utilisons. Il couvre ce site, votre compte, nos formulaires, notre page de dons et les liens que '
                 'nous envoyons par texto.',
        'sections': [
            ('Ce que nous conservons', [], [
                'Votre nom, votre courriel, votre numéro de téléphone, votre langue de préférence et, si vous nous les donnez, vos pronoms et votre adresse.',
                'Si vous faites du bénévolat : les services auxquels vous vous inscrivez, votre rôle, votre confirmation, vos heures, ce que vous nous '
                'indiquez pour votre rôle (l’adresse de collecte d’un cuisinier, la voiture d’un chauffeur) et vos réponses au sondage après un service. '
                'Nous vous demandons de ne pas y inscrire le nom des personnes servies.',
                'Si vous faites un don : le montant et la date de chaque don, et ce qu’il faut pour votre reçu officiel aux fins de l’impôt. Les paiements '
                'passent par Stripe : nous ne voyons ni ne conservons jamais le numéro complet de votre carte.',
                'Ce que vous nous envoyez par nos formulaires et par courriel, et les textos échangés avec notre ligne téléphonique.',
                'Si vous demandez une lettre signée : les détails de votre demande, le formulaire que vous téléversez pour signature, le cas échéant, et '
                'la lettre signée.',
                'Si vous avez un compte : votre façon de vous connecter. Avec Google, nous recevons le nom et l’adresse courriel de votre compte Google, '
                'jamais votre mot de passe, et nous n’accédons pas à votre Gmail, à votre Drive ni à vos contacts. Avec un code par courriel, nous gardons '
                'une trace des codes envoyés (l’adresse, le moment et une forme brouillée de l’adresse Internet d’où vient la demande) pour prévenir les abus.',
            ]),
            ('Pourquoi', [
                'Pour organiser nos services et garder le contact avec les personnes qui les rendent possibles; vous envoyer les messages que vous avez '
                'demandés, comme des rappels, des reçus et, si vous avez dit oui, notre infolettre; émettre des reçus officiels aux fins de l’impôt; vous '
                'montrer votre propre dossier quand vous vous connectez; confirmer vos heures de bénévolat à votre demande; et apprendre de vos commentaires.'], []),
            ('Qui y a accès', [
                'Seuls les membres de l’équipe de Welfare Avenue dont le travail l’exige. Le jour d’un service, la ou le responsable d’équipe et les '
                'chauffeurs voient les noms, les numéros de téléphone et les adresses de collecte nécessaires ce jour-là. Nous ne vendons ni ne louons vos '
                'renseignements, et nous ne les utilisons pas à des fins publicitaires.',
                'Nous faisons appel à quelques fournisseurs : Supabase (notre base de données, la connexion et le stockage des fichiers), Netlify '
                '(l’hébergement de ce site), Stripe (les dons), Resend (nos courriels), Quo (notre ligne téléphonique et nos textos) et Google (la '
                'connexion avec Google et les polices de nos pages). Leurs serveurs peuvent se trouver à l’extérieur du Québec, notamment aux États-Unis.'], []),
            ('Dans votre navigateur', [
                'Nous n’utilisons aucun témoin (cookie) publicitaire ou de suivi sur ce site. Quand vous vous connectez, votre navigateur garde votre '
                'connexion pour que votre session reste ouverte; la déconnexion l’efface. Le site retient aussi quelques choix, comme la fermeture du '
                'bandeau de langue.',
                'Certaines pages affichent des publications LinkedIn, les vidéos de presse ne se chargent depuis YouTube que lorsque vous appuyez sur '
                'lecture, et notre page de dons utilise Stripe, qui dépose ses propres témoins pour prévenir la fraude. Ces services ont leurs propres '
                'politiques de confidentialité.'], []),
            ('Combien de temps', [
                'Nous conservons votre dossier de bénévole et de sympathisant tant que vous participez à nos activités, pour compter vos services et vos '
                'heures et garder votre historique. Les dossiers de dons et de reçus sont conservés aussi longtemps que l’exige la loi fiscale canadienne. '
                'Sur demande, nous supprimons votre dossier, sauf ce que la loi nous oblige à conserver.'], []),
            ('Vos choix', [], [
                'Chaque infolettre contient un lien pour l’arrêter, et vous pouvez aussi la désactiver dans votre compte.',
                'Répondez STOP à l’un de nos textos pour ne plus en recevoir; START les réactive.',
                'Aucun compte n’est nécessaire pour faire du bénévolat ou un don. Les liens de nos textos fonctionnent sans compte.',
                'Vous pouvez consulter et corriger la plupart de vos coordonnées dans votre compte. Pour voir tout ce que nous conservons, le corriger, ou '
                'supprimer votre dossier ou votre compte, écrivez à {email} ou textez le {phone}.',
            ]),
            ('Questions ou préoccupations', [
                'Écrivez à la personne responsable de la protection des renseignements personnels à {email}. Si notre réponse ne vous satisfait pas, '
                'vous pouvez vous adresser à la Commission d’accès à l’information du Québec.'], []),
        ],
    },
}
