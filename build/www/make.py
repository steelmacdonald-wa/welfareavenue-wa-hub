#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build the new welfareavenue.com (wave162, 28/09/26) into build/www/out: English at /, French at /fr/.

  python3 build/www/make.py            # preview build (noindex everywhere)
  python3 build/www/make.py --launch   # launch build (indexable, robots.txt allows, sitemap listed)

Static pages with no inline script or style (strict CSP). Dynamic parts come from the Hub at view time:
/assets/site.js reads the next servings and fundraisers (rpc www_upcoming, anonymous) with the build's copy as the
first paint; /assets/forms.js shows the Hub's published forms (form-submit). Donate buttons go to the Hub's
donation page (hub.welfareavenue.com/give) and carry data-wa-donate so the parked popup (wave161c) can take them.
Images: build/www/images.py (vetted photos and posters) -> out/img. Copy: build/www/content.py."""
import hashlib, html, json, os, re, shutil, sys, datetime
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import content as C

LAUNCH = '--launch' in sys.argv
SITE = 'https://welfareavenue.com'
SUPA = 'https://zwnmulmnvopclzcvytce.supabase.co'
KEY = open('/tmp/anon.key').read().strip()
OUT = os.path.join(HERE, 'out')
IMG = json.load(open(os.path.join(HERE, 'img.json')))
SEED = json.load(open(os.path.join(HERE, 'data', 'upcoming.json')))
e = lambda s: html.escape(str(s), quote=True)

# ---------- logo files from the Hub's wave117 constants ----------
seg = open(os.path.join(HERE, '..', 'src', '117_wave117.seg'), encoding='utf8').read()
def const(name):
    m = re.search(name + r"\s*=\s*'([^']*)'", seg)
    if not m: sys.exit('missing ' + name)
    return m.group(1)
VB_P, VB_L = const('VB_PRIMARY'), const('VB_LOCKUP')
def svg_primary(fill):
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + VB_P + '"><path fill="' + fill + '" fill-rule="evenodd" d="' + const('PRIMARY_D') + '"/></svg>'
def svg_lockup(fill):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + VB_L + '"><path fill="' + fill + '" fill-rule="evenodd" d="' + const('PRIMARY_D') + '"/>'
            '<path fill="' + fill + '" d="' + const('LOCKUP_TAG_D') + '"/><path fill="#DCA527" d="' + const('LOCKUP_GOLD_D') + '"/></svg>')
E_BARS = open(os.path.join(HERE, 'brand', 'e-medium.svg'), encoding='utf8').read()
E_PATH = re.search(r' d="([^"]+)"', E_BARS).group(1)
FAVICON = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#103F39"/>'
           '<g fill="#FFFAF2"><rect x="17" y="15" width="7" height="34" rx="1.5"/><rect x="17" y="15" width="30" height="7" rx="1.5"/>'
           '<rect x="17" y="28.5" width="26" height="7" rx="1.5"/><rect x="17" y="42" width="30" height="7" rx="1.5"/></g></svg>')

files = {}  # path -> bytes or str
def put(path, data): files[path] = data

def ver(path):
    return hashlib.md5(files[path].encode('utf8') if isinstance(files[path], str) else files[path]).hexdigest()[:8]

# ---------- assets ----------
for a in ('site.css', 'site.js', 'forms.js'):
    put('assets/' + a, open(os.path.join(HERE, 'assets', a), encoding='utf8').read())
put('assets/logo-cream.svg', svg_primary('#FFFAF2'))
put('assets/logo-green.svg', svg_primary('#103F39'))
put('assets/lockup-cream.svg', svg_lockup('#FFFAF2'))
put('favicon.svg', FAVICON)
V = {a: ver('assets/' + a) for a in ('site.css', 'site.js', 'forms.js')}

def url(key, lang):
    k, _, frag = key.partition('#')
    return C.PATHS[k][lang] + ('#' + frag if frag else '')

def img(name, alt, sizes='(min-width: 900px) 50vw, 100vw', cls='', eager=False):
    m = IMG[name]; ws = m['w']; w = ws[-1]; h = round(w * m['ratio'])
    src = '/img/%s-%d.jpg' % (name, ws[min(1, len(ws) - 1)])
    srcset = ', '.join('/img/%s-%d.jpg %dw' % (name, x, x) for x in ws)
    return ('<img src="%s" srcset="%s" sizes="%s" width="%d" height="%d" alt="%s"%s%s>' %
            (src, srcset, sizes, w, h, e(alt), (' class="%s"' % cls) if cls else '', ' fetchpriority="high"' if eager else ' loading="lazy" decoding="async"'))

def big(name):
    ws = IMG[name]['w']; return '/img/%s-%d.jpg' % (name, ws[-1])

def give(lang):
    """The Hub's donation page in the page's language (French since wave162b: the page and Stripe's form in French)."""
    return C.GIVE if lang == 'en' else C.GIVE + '/?lang=fr'

def btn(href, label, cls='', donate=False, ext=False):
    return '<a class="btn%s" href="%s"%s%s>%s</a>' % ((' ' + cls) if cls else '', e(href), ' data-wa-donate' if donate else '', '', e(label))

def rule(): return '<span class="rule" aria-hidden="true"></span>'

# ---------- page chrome ----------
def head(lang, key, title, desc, image=None):
    other = 'fr' if lang == 'en' else 'en'
    canon = SITE + C.PATHS[key][lang] if key in C.PATHS else SITE + '/'
    t = (title + ' · Welfare Avenue') if key != 'home' else title
    og = SITE + '/img/og-' + lang + '.jpg'
    alt = ''
    if key in C.PATHS:
        alt = ('<link rel="alternate" hreflang="en" href="%s">\n<link rel="alternate" hreflang="fr" href="%s">\n<link rel="alternate" hreflang="x-default" href="%s">\n'
               % (SITE + C.PATHS[key]['en'], SITE + C.PATHS[key]['fr'], SITE + C.PATHS[key]['en']))
    ld = ''
    if key == 'home':
        ld = {'@context': 'https://schema.org', '@type': 'NGO', 'name': 'Welfare Avenue', 'alternateName': 'Avenue du Bien-Être', 'url': SITE + '/',
              'logo': SITE + '/apple-touch-icon.png', 'email': C.EMAIL, 'foundingDate': '2020', 'areaServed': ['Montreal', 'Toronto', 'Ottawa'],
              'sameAs': [u for _, u in C.SOCIAL]}
        ld = '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + '</script>\n'
    return ('<!doctype html>\n<html lang="%s">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            '<title>%s</title>\n<meta name="description" content="%s">\n%s<link rel="canonical" href="%s">\n%s'
            '<meta property="og:type" content="website">\n<meta property="og:site_name" content="Welfare Avenue">\n<meta property="og:title" content="%s">\n'
            '<meta property="og:description" content="%s">\n<meta property="og:url" content="%s">\n<meta property="og:image" content="%s">\n'
            '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta property="og:locale" content="%s">\n'
            '<meta name="twitter:card" content="summary_large_image">\n<meta name="theme-color" content="#103F39">\n'
            '<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">\n'
            '<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n'
            '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600&amp;family=Space+Grotesk:wght@400;500;700&amp;display=swap">\n'
            '<link rel="stylesheet" href="/assets/site.css?v=%s">\n%s<script src="/assets/site.js?v=%s" defer></script>\n%s<script src="https://hub.welfareavenue.com/give/embed.js" async></script>\n</head>\n'
            % (lang, e(t), e(desc), '' if LAUNCH else '<meta name="robots" content="noindex">\n', e(canon), alt, e(t), e(desc), e(canon), og,
               'fr_CA' if lang == 'fr' else 'en_CA', V['site.css'], ld,
               V['site.js'], ('<script src="/assets/forms.js?v=%s" defer></script>\n' % V['forms.js']) if key in ('home', 'volunteer', 'contact') else ''))

def header(lang, key):
    u = C.UI[lang]; other = u['other_code']
    other_url = C.PATHS[key][other] if key in C.PATHS else C.PATHS['home'][other]
    hint = ''
    if lang == 'en':
        hint = ('<div class="langhint" id="langhint" hidden lang="fr"><div class="wrap"><span>%s</span> <a href="%s" hreflang="fr">%s</a>'
                '<button type="button" aria-label="%s">&times;</button></div></div>\n' % (e(u['hint']), e(other_url), e(u['hint_link']), e(u['hint_close'])))
    links = ''.join('<a href="%s"%s>%s</a>' % (e(url(k, lang)), ' aria-current="page"' if k == key else '', e(u['nav'][k])) for k in C.NAV)
    return ('<body data-lang="%s" data-supa="%s" data-key="%s">\n<a class="skip" href="#main">%s</a>\n%s'
            '<header class="top"><div class="wrap">\n<a class="brand" href="%s" aria-label="%s"><img src="/assets/logo-cream.svg" alt="Welfare Avenue" width="160" height="54"></a>\n'
            '%s\n<button class="menu-btn" type="button" aria-expanded="false" aria-controls="nav"><span aria-hidden="true"></span><b class="sr">%s</b></button>\n'
            '<nav class="nav" id="nav" aria-label="%s">%s<a class="lang" href="%s" hreflang="%s" lang="%s">%s</a>%s</nav>\n</div></header>\n<main id="main">\n'
            % (lang, SUPA, KEY, e(u['skip']), hint, e(url('home', lang)), e(u['home_label']),
               btn(give(lang), u['nav']['donate'], 'donate-m', donate=True), e(u['menu']), e(u['main_nav']), links, e(other_url), other, other, e(u['other_lang']),
               btn(give(lang), u['nav']['donate'], 'desk', donate=True)))

def footer(lang):
    u = C.UI[lang]
    explore = ''.join('<li><a href="%s">%s</a></li>' % (e(url(k, lang)), e(u['nav'][k])) for k in ['home'] + C.NAV if k != 'home')
    explore = '<li><a href="%s">%s</a></li>' % (e(url('home', lang)), 'Home' if lang == 'en' else 'Accueil') + explore
    inv = ''.join('<li><a href="%s">%s</a></li>' % (e(give(lang) if k == 'donate' else url(k, lang)), e(t)) for k, t in u['foot_links_involved'])
    soc = ''.join('<li><a href="%s" rel="noopener">%s</a></li>' % (e(h), e(n)) for n, h in C.SOCIAL)
    return ('</main>\n<footer class="foot"><div class="wrap"><div class="cols">\n'
            '<div><a class="logo" href="%s" aria-label="%s"><img src="/assets/lockup-cream.svg" alt="%s" width="200" height="90"></a>'
            '<p class="mt2">%s</p></div>\n'
            '<div><h2>%s</h2><ul>%s</ul></div>\n<div><h2>%s</h2><ul>%s</ul></div>\n'
            '<div><h2>%s</h2><ul><li><a href="mailto:%s">%s</a></li>%s<li><a href="%s" rel="noopener">%s</a></li></ul></div>\n</div>\n'
            '<div class="legal"><span>&copy; %d %s</span><span>%s %s</span></div>\n</div></footer>\n</body>\n</html>\n'
            % (e(url('home', lang)), e(u['home_label']), e(u['logo_alt']), e(u['foot_about']), e(u['foot_explore']), explore, e(u['foot_involved']), inv,
               e(u['foot_follow']), C.EMAIL, C.EMAIL, soc, e(C.REVIEW), e(u['review']), datetime.date.today().year, e(u['rights']), e(u['charity']), C.CHARITY))

def page(lang, key, title, desc, body):
    return head(lang, key, title, desc) + header(lang, key) + body + footer(lang)

def page_hero(over, title, lede):
    return ('<section class="page-hero"><div class="wrap"><p class="over">%s</p><h1>%s</h1>%s</div></section>\n'
            % (e(over), e(title), ('<p class="lede">%s</p>' % e(lede)) if lede else ''))

def quote(q, lang):
    tr = q['tr'][lang]
    return ('<figure class="quote"><blockquote lang="%s"><p>%s</p></blockquote>%s<figcaption><b>%s</b>, %s</figcaption></figure>'
            % (q['orig_lang'], e(q['orig']), ('<p class="tr">%s</p>' % e(tr)) if tr else '', e(q['who']), e(q['role'][lang])))

def upcoming_box(lang, show='all', limit=4, sign_key='volunteer#apply', seed_note=''):
    return ('<div data-upcoming data-show="%s" data-limit="%d" data-sign="%s"><ul class="upcoming"></ul><p class="upcoming-note fine" hidden></p>'
            '<noscript><p>%s</p></noscript></div>' % (show, limit, e(url(sign_key, lang)), e(seed_note)))

def seed_script():
    return '<script type="application/json" id="upcoming-seed">%s</script>\n' % json.dumps(SEED, ensure_ascii=False).replace('</', '<\\/')

def form_box(slugs, fallback_html, lang, heading=True, anchor=''):
    return ('<div class="form-card"%s data-wa-form="%s"%s><div class="waf-fallback">%s</div></div>'
            % ((' id="%s"' % anchor) if anchor else '', e(slugs), '' if heading else ' data-heading="none"', fallback_html))

def mail(lang):
    return '<a href="mailto:%s">%s</a>' % (C.EMAIL, C.EMAIL)

def stats(lang, dark=False):
    items = ''.join('<div class="stat"><b>%s</b><span>%s</span></div>' % (e(n), e(t)) for n, t in C.STATS[lang])
    return '<div class="stats">%s</div><p class="fine mt2">%s</p>' % (items, e(C.STATS_NOTE[lang]))

def pillars(lang):
    return '<div class="grid4 mt2">' + ''.join('<div class="card"><p class="num">0%d</p><h3>%s</h3><p>%s</p></div>' % (i + 1, e(t), e(d)) for i, (t, d) in enumerate(C.PILLARS[lang])) + '</div>'

def moving_where(lang):
    # The one E that moves on the site (home headline): WH≡RE in English, RENCONTR≡ in French. Screen readers get the plain words.
    svg = '<span class="emove" aria-hidden="true"><svg viewBox="0 0 825 345" preserveAspectRatio="xMinYMid meet" focusable="false"><path fill="currentColor" d="%s"/></svg></span>' % E_PATH
    if lang == 'en':
        return '<h1><span class="sr">We meet people where they are</span><span aria-hidden="true">We meet people<br><span class="gold">wh%sre they are</span></span></h1>' % svg
    return '<h1><span class="sr">Aller à la rencontre des gens, là où ils sont</span><span aria-hidden="true">Aller à la rencontr%s<br><span class="gold">des gens, là où ils sont</span></span></h1>' % svg

# ---------- pages ----------
def home(lang):
    en = lang == 'en'
    T = {
        'title': 'Welfare Avenue · Youth-powered action against food insecurity' if en else 'Welfare Avenue · Des jeunes en action contre l’insécurité alimentaire',
        'desc': 'Welfare Avenue is a youth-powered charity fighting food insecurity and poverty in Montreal and Toronto through direct community action: meals, essentials and a pathway to support.' if en else
                'Welfare Avenue est un organisme de bienfaisance porté par les jeunes qui lutte contre l’insécurité alimentaire et la pauvreté à Montréal et à Toronto par l’action directe : repas, essentiels et un chemin vers le soutien.',
        'over': 'Youth-powered · Montreal · Toronto' if en else 'Porté par les jeunes · Montréal · Toronto',
        'lede': 'Welfare Avenue is a youth-powered charity fighting food insecurity and poverty through direct community action. We bring meals and essential support to people where they are, then connect them with the services they need.' if en else
                'Welfare Avenue est un organisme de bienfaisance porté par les jeunes qui lutte contre l’insécurité alimentaire et la pauvreté par l’action directe. Nous apportons des repas et du soutien essentiel aux gens, là où ils sont, puis nous les orientons vers les services dont ils ont besoin.',
        'vol': 'Volunteer with us' if en else 'Devenir bénévole', 'don': 'Donate' if en else 'Faire un don',
        'impact_over': 'Our impact' if en else 'Notre impact', 'impact_h': 'Food as a starting point' if en else 'La nourriture comme point de départ',
        'impact_p': 'Food opens the door to what comes next: connection, essentials and the services people need. Our work rests on four pillars.' if en else
                    'La nourriture ouvre la porte à la suite : des liens, des articles essentiels et les services dont les gens ont besoin. Notre travail repose sur quatre piliers.',
        'next_over': 'Every second Sunday' if en else 'Un dimanche sur deux', 'next_h': 'Next servings' if en else 'Prochains repas du dimanche',
        'next_p': 'Our volunteers serve home-cooked meals in downtown Montreal. Pick a Sunday and join the team.' if en else 'Nos bénévoles servent des repas maison au centre-ville de Montréal. Choisissez un dimanche et joignez-vous à l’équipe.',
        'next_note': 'Servings run every second Sunday in downtown Montreal.' if en else 'Les repas ont lieu un dimanche sur deux au centre-ville de Montréal.',
        'all_events': 'All events and photos' if en else 'Tous les événements et photos',
        'move_h': 'Join a youth-powered movement' if en else 'Joignez-vous à un mouvement porté par les jeunes',
        'move_p': 'Cook, drive, serve or take photos. Be part of the engine connecting people to the help they need, and build leadership skills while creating measurable impact.' if en else
                  'Cuisinez, conduisez, servez ou prenez des photos. Contribuez à relier les gens à l’aide dont ils ont besoin, et développez votre leadership en ayant un impact mesurable.',
        'partner_over': 'What partners say' if en else 'Ce qu’en disent nos partenaires',
        'press_over': 'In the news' if en else 'Dans les médias', 'press_p': 'CBC News, CTV News and CityNews have covered our volunteers since 2022.' if en else 'CBC News, CTV News et CityNews parlent de nos bénévoles depuis 2022.',
        'press_btn': 'See the coverage' if en else 'Voir les reportages',
        'news_h': 'Stay close to the work' if en else 'Restez près de l’action',
        'news_p': 'News from our kitchens and the streets we serve, volunteer call-outs and ways to help, about once a month.' if en else
                  'Des nouvelles de nos cuisines et des rues où nous servons, des appels aux bénévoles et des façons d’aider, environ une fois par mois.',
        'give_h': 'Keep the pathway open' if en else 'Gardez le chemin ouvert',
        'give_p': 'Your gift puts home-cooked meals on the table every second Sunday and keeps essentials moving all year. Give once or every month.' if en else
                  'Votre don met des repas maison sur la table un dimanche sur deux et assure la distribution d’articles essentiels toute l’année. Donnez une fois ou chaque mois.',
        'give_btn': 'Give now' if en else 'Donner maintenant',
        'alt_hero': 'About twenty Welfare Avenue volunteers pose in front of two green tents under yellow autumn trees.' if en else 'Une vingtaine de bénévoles de Welfare Avenue posent devant deux tentes vertes sous des arbres jaunis par l’automne.',
        'alt_food': 'Two masked volunteers in green vests ladle soup from a large pot into cups under the tent.' if en else 'Deux bénévoles masqués en dossard vert versent de la soupe d’une grande marmite dans des tasses, sous la tente.',
    }
    news_fallback = '<p class="waf-note">%s %s.</p>' % (e('Sign-ups open soon. In the meantime, write to us at' if en else 'Les inscriptions ouvrent bientôt. D’ici là, écrivez-nous à'), mail(lang))
    body = (
        '<section class="hero"><div class="wrap grid">\n<div><p class="over">%s</p>%s<p class="lede">%s</p><div class="btns">%s%s</div></div>\n'
        '<div class="photo">%s<img class="doodle" src="https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/brand/doodle-star-gold.png" alt="" width="74" height="74" loading="lazy"></div>\n</div></section>\n'
        % (e(T['over']), moving_where(lang), e(T['lede']), btn(url('volunteer', lang), T['vol']), btn(give(lang), T['don'], 'ghost', donate=True),
           img('2022-10-autumn-crew-at-the-tent', T['alt_hero'], '(min-width: 900px) 40vw, 100vw', eager=True)) +
        '<section class="band on-cream"><div class="wrap"><p class="over">%s</p><h2>%s</h2>%s<p class="lede">%s</p>%s<div class="mt3">%s</div></div></section>\n'
        % (e(T['impact_over']), e(T['impact_h']), rule(), e(T['impact_p']), pillars(lang), stats(lang)) +
        '<section class="band on-soft"><div class="wrap split"><div><p class="over">%s</p><h2>%s</h2>%s<p>%s</p>%s<div class="btns">%s</div></div><div>%s</div></div></section>\n'
        % (e(T['next_over']), e(T['next_h']), rule(), e(T['next_p']), upcoming_box(lang, 'servings', 3, 'volunteer#apply', T['next_note']),
           btn(url('events', lang), T['all_events'], 'ghost dark'), img('2022-04-spring-soup-from-the-pot', T['alt_food'])) +
        '<section class="band on-green"><div class="wrap cta"><div><h2>%s</h2>%s<p class="lede">%s</p></div><div class="btns">%s</div></div></section>\n'
        % (e(T['move_h']), rule(), e(T['move_p']), btn(url('volunteer', lang), T['vol'])) +
        '<section class="band on-cream"><div class="wrap"><p class="over">%s</p>%s</div></section>\n' % (e(T['partner_over']), quote(C.QUOTE_PARTNER, lang)) +
        '<section class="band on-soft"><div class="wrap cta"><div><p class="over">%s</p><p class="lede mb0">%s</p></div><div class="btns">%s</div></div></section>\n'
        % (e(T['press_over']), e(T['press_p']), btn(url('press', lang), T['press_btn'], 'ghost dark')) +
        '<section class="band on-cream"><div class="wrap grid2"><div id="newsletter"><h2>%s</h2>%s<p>%s</p>%s</div>'
        '<div class="card"><h2 class="h2">%s</h2>%s<p>%s</p><div class="btns">%s</div><p class="fine mt2">%s</p></div></div></section>\n'
        % (e(T['news_h']), rule(), e(T['news_p']), form_box('newsletter' if en else 'infolettre,newsletter', news_fallback, lang, heading=False),
           e(T['give_h']), rule(), e(T['give_p']), btn(give(lang), T['give_btn'], donate=True), e(receipt_line(lang))) +
        seed_script())
    return page(lang, 'home', T['title'], T['desc'], body)

def receipt_line(lang):
    return ('Welfare Avenue is a registered charity in Canada (%s). Eligible gifts receive an official receipt for income tax purposes.' % C.CHARITY if lang == 'en' else
            'Welfare Avenue est un organisme de bienfaisance enregistré au Canada (%s). Les dons admissibles donnent droit à un reçu officiel aux fins de l’impôt.' % C.CHARITY)

MONTHS = {'en': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
          'fr': ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']}

def companies_section(lang):
    """Companies that worked with us, each in its own LinkedIn post, embedded (Steel, 28/09/26); the frames load as the visitor scrolls to them."""
    en = lang == 'en'
    cards = []
    for name, urn, h, ym, line in C.COMPANY_POSTS:
        y, m = ym.split('-')
        when = '%s %s' % (MONTHS[lang][int(m) - 1], y)
        when = when[0].upper() + when[1:]
        cards.append('<li class="lipost card"><p class="over">%s · LinkedIn</p><h3>%s</h3><p>%s</p>'
                     '<iframe src="https://www.linkedin.com/embed/feed/update/%s?collapsed=1" height="%d" title="%s" loading="lazy" allowfullscreen></iframe>'
                     '<p class="mb0"><a class="lilink" href="https://www.linkedin.com/feed/update/%s/" target="_blank" rel="noopener">%s</a></p></li>'
                     % (e(when), e(name), e(line[lang]), e(urn), h, e(('%s on LinkedIn' if en else '%s sur LinkedIn') % name),
                        e(urn), e('Open on LinkedIn' if en else 'Ouvrir sur LinkedIn')))
    return ('<section class="band on-cream" id="companies"><div class="wrap"><h2>%s</h2>%s<p class="maxw">%s</p><ul class="liposts mt2">%s</ul>'
            '<p class="mt2">%s <a href="%s">%s</a></p></div></section>\n'
            % (e('Companies that work with us' if en else 'Des entreprises à nos côtés'), rule(),
               e('Teams from these companies have worked alongside us. Here it is in their own words, on LinkedIn.' if en else
                 'Des équipes de ces entreprises ont travaillé à nos côtés. Voici ce qu’elles en disent, sur LinkedIn.'),
               ''.join(cards),
               e('Want to bring your team?' if en else 'Vous voulez venir avec votre équipe\u00a0?'), e(url('volunteer', lang) + '#groups'),
               e('Serve with us as a group' if en else 'Venir en groupe')))

def team_section(lang):
    """The team from the Hub (content.TEAM): photo or initials, first name, role, and servings or the year they joined."""
    en = lang == 'en'
    groups = []
    for key, label in C.TEAM_GROUPS:
        items = []
        for hid, _, name, ren, rfr, photo, serv, first, since in [t for t in C.TEAM if t[1] == key]:
            if photo:
                pic = '<img class="face" src="/img/team/%s.jpg" alt="" width="96" height="96" loading="lazy" decoding="async">' % photo
            else:
                pic = '<span class="face ini c%d" aria-hidden="true">%s</span>' % (hid % 3, e(name[0].upper()))
            if serv > 1: note = ('%d servings since %d' % (serv, first)) if en else ('%d repas du dimanche depuis %d' % (serv, first))
            elif serv == 1: note = ('First serving in %d' % first) if en else ('Premier repas du dimanche en %d' % first)
            elif since: note = ('On the team since %d' % since) if en else ('Dans l’équipe depuis %d' % since)
            else: note = ''
            items.append('<li>%s<div><p class="nm">%s</p><p class="rl">%s</p>%s</div></li>'
                         % (pic, e(name), e(ren if en else rfr), ('<p class="sv">%s</p>' % e(note)) if note else ''))
        groups.append('<div class="tgroup"><h3>%s</h3><ul class="team">%s</ul></div>' % (e(label[lang]), ''.join(items)))
    return ('<section class="band on-soft" id="team"><div class="wrap"><p class="over">%s</p><h2>%s</h2>%s<p class="maxw">%s</p>%s'
            '<p class="small mt2">%s</p></div></section>\n'
            % (e('Our team' if en else 'Notre équipe'), e('The people behind every serving' if en else 'Les gens derrière chaque repas'), rule(),
               e('Meet the youth-powered team that makes every serving happen, from the kitchens and the streets to the board.' if en else
                 'Voici l’équipe portée par les jeunes qui rend chaque repas possible, des cuisines à la rue jusqu’au conseil d’administration.'),
               ''.join(groups),
               e('Serving counts come from our volunteer records. On the team and want your profile changed or taken down? Write to %s.' % C.EMAIL if en else
                 'Le nombre de repas vient de nos registres de bénévolat. Vous faites partie de l’équipe et voulez modifier ou retirer votre profil ? Écrivez à %s.' % C.EMAIL)))

def about(lang):
    en = lang == 'en'
    T = {
        'title': 'About us' if en else 'À propos', 'over': 'Who we are' if en else 'Qui nous sommes',
        'desc': 'Welfare Avenue is a youth-powered registered charity, founded in Montreal in 2020, delivering meals and essential support directly to people where they are.' if en else
                'Welfare Avenue est un organisme de bienfaisance enregistré porté par les jeunes, fondé à Montréal en 2020, qui apporte repas et soutien essentiel directement aux gens, là où ils sont.',
        'lede': 'A youth-powered non-profit fighting food insecurity and poverty through direct community action, delivering meals and essential support directly to people where they are.' if en else
                'Un organisme à but non lucratif porté par les jeunes qui lutte contre l’insécurité alimentaire et la pauvreté par l’action directe, en apportant repas et soutien essentiel directement aux gens, là où ils sont.',
        'mission_h': 'Solidarity, not charity' if en else 'La solidarité, pas la charité',
        'mission_p1': 'We lead with the person, not their circumstance. Everyone who comes to a serving is part of our community, and is welcomed that way.' if en else
                      'Nous voyons d’abord la personne, pas sa situation. Toute personne qui se présente à un service fait partie de notre communauté et y est accueillie comme telle.',
        'mission_p2': 'Food is our starting point. From a first meal, we build trust and connect people with the support that can change what comes next: essentials, community services, housing and health resources, through the partners who provide them.' if en else
                      'La nourriture est notre point de départ. À partir d’un premier repas, nous bâtissons la confiance et orientons les gens vers le soutien qui peut changer la suite : des articles essentiels, des services communautaires, des ressources en logement et en santé, grâce aux partenaires qui les offrent.',
        'mission_p3': 'And we are youth-powered. Students and young professionals cook, drive, serve and lead, and grow into the next generation of community leaders along the way.' if en else
                      'Et nous sommes portés par les jeunes. Des étudiants et de jeunes professionnels cuisinent, conduisent, servent et dirigent, et deviennent en chemin la prochaine génération de leaders communautaires.',
        'pillars_h': 'Four pillars' if en else 'Quatre piliers',
        'story_over': 'Our story' if en else 'Notre histoire', 'story_h': 'Since 2020' if en else 'Depuis 2020',
        'partners_h': 'Who we work with' if en else 'Avec qui nous travaillons',
        'partners_p': 'We collaborate with shelters, community organizations, schools and businesses, because no one does this work alone.' if en else
                      'Nous collaborons avec des refuges, des organismes communautaires, des établissements d’enseignement et des entreprises, parce que personne ne fait ce travail seul.',
        'charity_h': 'A registered charity' if en else 'Un organisme de bienfaisance enregistré',
        'charity_p': ('Welfare Avenue (Avenue du Bien-Être) has been a registered Canadian charity since October 2023. Registration number: %s.' % C.CHARITY) if en else
                     ('Welfare Avenue (Avenue du Bien-Être) est un organisme de bienfaisance canadien enregistré depuis octobre 2023. Numéro d’enregistrement : %s.' % C.CHARITY),
        'join_h': 'Be part of it' if en else 'Faites-en partie',
        'alt1': 'Volunteers in green vests, seen from behind, serve under the Welfare Avenue tent in winter.' if en else 'Des bénévoles en dossard vert, vus de dos, servent sous la tente Welfare Avenue en hiver.',
    }
    story = ''.join('<li><span class="when">%s</span><p>%s</p></li>' % (e(w), e(t)) for w, t in C.STORY[lang])
    partners = ''.join('<p class="city">%s</p><ul class="chips">%s</ul>' % (e(C.CITY[lang][c]), ''.join('<li>%s</li>' % e(C.PARTNER_FR.get(n, n) if lang == 'fr' else n) for n in names)) for c, names in C.PARTNERS.items())
    body = (page_hero(T['over'], T['title'], T['lede']) +
        '<section class="band on-cream"><div class="wrap split"><div><h2>%s</h2>%s<p>%s</p><p>%s</p><p>%s</p></div><div>%s</div></div></section>\n'
        % (e(T['mission_h']), rule(), e(T['mission_p1']), e(T['mission_p2']), e(T['mission_p3']), img('2022-01-winter-serving-team', T['alt1'], eager=True)) +
        '<section class="band on-soft"><div class="wrap"><h2>%s</h2>%s%s<div class="mt3">%s</div></div></section>\n' % (e(T['pillars_h']), rule(), pillars(lang), stats(lang)) +
        '<section class="band on-cream"><div class="wrap"><p class="over">%s</p><h2>%s</h2>%s<ol class="timeline mt2">%s</ol></div></section>\n' % (e(T['story_over']), e(T['story_h']), rule(), story) +
        '<section class="band on-soft"><div class="wrap"><h2>%s</h2>%s<p class="maxw">%s</p>%s</div></section>\n' % (e(T['partners_h']), rule(), e(T['partners_p']), partners) +
        companies_section(lang) +
        '<section class="band on-green"><div class="wrap">%s</div></section>\n' % quote(C.QUOTE_PARTNER, lang) +
        team_section(lang) +
        '<section class="band on-cream"><div class="wrap cta"><div><h2>%s</h2>%s<p class="mb0">%s</p></div><div class="btns">%s%s</div></div></section>\n'
        % (e(T['charity_h']), rule(), e(T['charity_p']), btn(url('volunteer', lang), 'Volunteer' if en else 'Devenir bénévole'), btn(give(lang), 'Donate' if en else 'Faire un don', 'ghost dark', donate=True)))
    return page(lang, 'about', T['title'], T['desc'], body)

def volunteer(lang):
    en = lang == 'en'
    T = {
        'title': 'Volunteer' if en else 'Bénévolat', 'over': 'Volunteer' if en else 'Bénévolat',
        'h1': 'Join a youth-powered movement' if en else 'Joignez-vous à un mouvement porté par les jeunes',
        'desc': 'Volunteer with Welfare Avenue: serve, cook, drive or take photos at our Sunday servings in Montreal, or join our team in Toronto.' if en else
                'Faites du bénévolat avec Welfare Avenue : servez, cuisinez, conduisez ou prenez des photos lors de nos services du dimanche à Montréal, ou joignez-vous à notre équipe de Toronto.',
        'lede': 'Be part of the engine connecting people to the help they need. Build leadership skills while creating measurable impact.' if en else
                'Contribuez à relier les gens à l’aide dont ils ont besoin. Développez votre leadership en ayant un impact mesurable.',
        'roles_h': 'Ways to help' if en else 'Façons d’aider',
        'roles_p': 'No experience needed. Our team leads show you the ropes on the day.' if en else 'Aucune expérience requise. Nos chefs d’équipe vous montrent tout sur place.',
        'how_h': 'How it works' if en else 'Comment ça marche',
        'how': ([('Sign up', 'Tell us how you would like to help and pick the Sundays that work for you.'), ('Get confirmed', 'We confirm each date by text the week of the serving.'), ('Show up and serve', 'Servers arrive by noon. Dress for the weather; the rest is teamwork.')] if en else
                [('Inscrivez-vous', 'Dites-nous comment vous aimeriez aider et choisissez les dimanches qui vous conviennent.'), ('Recevez la confirmation', 'Nous confirmons chaque date par texto la semaine de la distribution.'), ('Venez servir', 'L’équipe de service arrive au plus tard à midi. Habillez-vous selon la météo ; le reste, c’est du travail d’équipe.')]),
        'next_h': 'Next servings in Montreal' if en else 'Prochains repas à Montréal',
        'next_note': 'Servings run every second Sunday in downtown Montreal.' if en else 'Les repas ont lieu un dimanche sur deux au centre-ville de Montréal.',
        'apply_h': 'Sign up to serve' if en else 'Inscrivez-vous pour servir',
        'apply_fb': ('Sign-ups open here soon. In the meantime, write to us at' if en else 'Les inscriptions ouvriront ici bientôt. D’ici là, écrivez-nous à'),
        'to_h': 'Volunteer in Toronto' if en else 'Faire du bénévolat à Toronto',
        'to_p': 'In Toronto, our volunteers run free food events at shelters and drop-in centres, with food from partners like Daily Bread Food Bank and Aangen Kitchen. Register and we will be in touch as events are planned.' if en else
                'À Toronto, nos bénévoles organisent des repas gratuits dans des refuges et des centres de jour, avec la nourriture de partenaires comme Daily Bread Food Bank et Aangen Kitchen. Inscrivez-vous et nous vous écrirons dès que des événements seront prévus (formulaire en anglais).',
        'to_btn': 'Register for Toronto' if en else 'S’inscrire pour Toronto',
        'groups_h': 'Bring your team' if en else 'Venez en équipe',
        'groups_p': 'Schools, clubs and companies can serve together, 10 to 15 people at a time. Write to us at least four weeks ahead and we will find a Sunday that works.' if en else
                    'Écoles, clubs et entreprises peuvent servir ensemble, de 10 à 15 personnes à la fois. Écrivez-nous au moins quatre semaines à l’avance et nous trouverons un dimanche qui convient.',
        'groups_btn': 'Plan a group serving' if en else 'Planifier un service de groupe',
        'alt_team': 'Thirteen volunteers in green Welfare Avenue vests pose under the green tent in a leafy park.' if en else 'Treize bénévoles en dossard vert Welfare Avenue posent sous la tente verte, dans un parc feuillu.',
    }
    roles = ''.join('<div class="card"><h3>%s</h3><p>%s</p></div>' % (e(t), e(d)) for t, d in C.ROLES[lang])
    how = ''.join('<div class="card"><p class="num">0%d</p><h3>%s</h3><p>%s</p></div>' % (i + 1, e(t), e(d)) for i, (t, d) in enumerate(T['how']))
    fb = '<p class="waf-note">%s %s.</p>' % (e(T['apply_fb']), mail(lang))
    body = (page_hero(T['over'], T['h1'], T['lede']) +
        '<section class="band on-cream"><div class="wrap split"><div><h2>%s</h2>%s<p>%s</p></div><div>%s</div></div>'
        '<div class="wrap grid3 mt3">%s</div></section>\n' % (e(T['roles_h']), rule(), e(T['roles_p']), img('2024-07-summer-team-under-the-tent', T['alt_team'], eager=True), roles) +
        '<section class="band on-soft"><div class="wrap"><h2>%s</h2>%s<div class="grid3 mt2">%s</div></div></section>\n' % (e(T['how_h']), rule(), how) +
        '<section class="band on-cream" id="apply"><div class="wrap grid2"><div><h2>%s</h2>%s%s<div class="mt3">%s</div></div><div>%s</div></div></section>\n'
        % (e(T['next_h']), rule(), upcoming_box(lang, 'servings', 5, 'volunteer#apply', T['next_note']), quote(C.QUOTE_VOLUNTEER, lang),
           form_box('volunteer' if en else 'benevole,volunteer', '<h3>%s</h3>%s' % (e(T['apply_h']), fb), lang)) +
        '<section class="band on-soft" id="toronto"><div class="wrap grid2"><div><h2>%s</h2>%s<p>%s</p></div><div>'
        '<details class="more"><summary>%s</summary><div class="in">%s</div></details></div></div></section>\n'
        % (e(T['to_h']), rule(), e(T['to_p']), e(T['to_btn']), form_box('toronto-volunteer', fb, lang, heading=False)) +
        '<section class="band on-green" id="groups"><div class="wrap cta"><div><h2>%s</h2>%s<p class="lede mb0">%s</p></div><div class="btns">%s</div></div></section>\n'
        % (e(T['groups_h']), rule(), e(T['groups_p']), btn(url('contact', lang), T['groups_btn'])) + seed_script())
    return page(lang, 'volunteer', T['title'], T['desc'], body)

def fmt_date(iso, lang):
    d = datetime.date.fromisoformat(iso)
    M_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    M_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
    return ('%s %d, %d' % (M_EN[d.month - 1], d.day, d.year)) if lang == 'en' else ('%d %s %d' % (d.day, M_FR[d.month - 1], d.year))

def events(lang):
    en = lang == 'en'
    T = {
        'title': 'Events and photos' if en else 'Événements et photos', 'over': 'Events' if en else 'Événements',
        'desc': 'Welfare Avenue events: our Sunday servings in Montreal, fundraisers with our partners, and photos from the community.' if en else
                'Les événements de Welfare Avenue : nos services du dimanche à Montréal, nos collectes de fonds avec nos partenaires et des photos de la communauté.',
        'lede': 'Every second Sunday we serve in downtown Montreal, and through the year we host fundraisers with our partners. Come to one, or bring one to life.' if en else
                'Un dimanche sur deux, nous servons au centre-ville de Montréal, et tout au long de l’année nous organisons des collectes de fonds avec nos partenaires. Venez à l’une d’elles, ou créez la vôtre.',
        'next_h': 'Coming up' if en else 'À venir', 'next_note': 'Servings run every second Sunday in downtown Montreal.' if en else 'Les repas ont lieu un dimanche sur deux au centre-ville de Montréal.',
        'photos_h': 'From our servings' if en else 'Nos repas du dimanche en images',
        'photos_p': 'Photos from our Sunday servings. We only share photos of volunteers, food and moments where no one we serve can be recognized without their consent.' if en else
                    'Des photos de nos repas du dimanche. Nous ne publions que des photos de bénévoles, de nourriture et de moments où personne parmi les gens que nous servons ne peut être reconnu sans son consentement.',
        'past_h': 'Past events' if en else 'Événements passés',
        'fund_h': 'Fundraisers coming up' if en else 'Collectes à venir',
        'fund_p': 'Dates firm up as each one gets closer. Want to take part, sponsor or bring a team?' if en else
                  'Les dates se précisent à l’approche de chacune. Vous voulez participer, commanditer ou inscrire une équipe\u00a0?',
        'fund_btn': 'Write to us' if en else 'Écrivez-nous',
        'fphotos_h': 'From our fundraisers' if en else 'Nos collectes en images',
        'fphotos_p': 'Flag Football 2026 with the Montreal Flag Football League, and our 2025 Holiday Gift Basket Drive.' if en else
                     'Le tournoi de football-drapeau 2026 avec la Montreal Flag Football League, et nos paniers-cadeaux des fêtes 2025.',
        'host_h': 'Host a fundraiser with us' if en else 'Organisez une collecte avec nous',
        'host_p': 'Parties, bake sales, tournaments, talent shows: our best fundraisers started as someone’s idea. Tell us yours.' if en else
                  'Soirées, ventes de pâtisseries, tournois, spectacles de talents : nos meilleures collectes ont commencé par l’idée de quelqu’un. Parlez-nous de la vôtre.',
        'host_btn': 'Tell us your idea' if en else 'Proposer une idée',
        'view': 'View' if en else 'Voir',
    }
    mixed = [p for pair in __import__('itertools').zip_longest(C.PHOTOS_NEW, C.PHOTOS) for p in pair if p]
    gal = ''.join('<button type="button" data-full="%s" data-title="%s" data-alt="%s">%s</button>'
                  % (big(k), e(cap[lang]), e(alt[lang]), img(k, alt[lang], '(min-width: 760px) 33vw, 50vw')) for k, cap, alt in mixed)
    posters = []
    for i, d, title, place, note in sorted(C.EVENTS, key=lambda ev: ev[1], reverse=True):
        name = 'event-%d' % i if ('event-%d' % i) in IMG else C.EVENT_PHOTO.get(i, 'event-%d' % i)
        meta = fmt_date(d, lang) + ((' · ' + (C.CITY[lang].get(place, place))) if place else '')
        if name in IMG:
            pic = '<button type="button" data-full="%s" data-title="%s" data-caption="%s" data-alt="%s">%s</button>' % (
                big(name), e(title[lang]), e(meta + '. ' + note[lang]), e(title[lang]), img(name, title[lang], '(min-width: 1080px) 25vw, (min-width: 760px) 33vw, 50vw'))
        else:
            pic = '<div class="ph" aria-hidden="true">%s</div>' % e(title[lang])
        posters.append('<li>%s<p class="t">%s</p><p class="m">%s</p><p class="fine mb0">%s</p></li>' % (pic, e(title[lang]), e(meta), e(note[lang])))
    body = (page_hero(T['over'], T['title'], T['lede']) +
        '<section class="band on-cream"><div class="wrap grid2"><div><h2>%s</h2>%s%s</div><div>%s</div></div></section>\n'
        % (e(T['next_h']), rule(), upcoming_box(lang, 'all', 6, 'volunteer#apply', T['next_note']), img('2023-10-autumn-crew-behind-the-table', C.PHOTOS_NEW[9][2][lang], eager=True)) +
        '<section class="band on-green" id="fundraisers"><div class="wrap"><h2>%s</h2>%s<ul class="fundnext mt2">%s</ul><div class="cta mt3"><p class="lede mb0">%s</p><div class="btns">%s</div></div></div></section>\n'
        % (e(T['fund_h']), rule(), ''.join('<li class="card"><p class="num">%s</p><h3>%s</h3><p>%s</p></li>' % (e(w[lang]), e(ti[lang]), e(no[lang])) for ti, w, no in C.FUNDRAISERS_NEXT),
           e(T['fund_p']), btn(url('contact', lang), T['fund_btn'])) +
        '<section class="band on-soft" id="photos"><div class="wrap"><h2>%s</h2>%s<p class="maxw">%s</p><div class="gallery mt2" data-lb-group>%s</div></div></section>\n'
        % (e(T['photos_h']), rule(), e(T['photos_p']), gal) +
        '<section class="band on-cream" id="fundphotos"><div class="wrap"><h2>%s</h2>%s<p class="maxw">%s</p><div class="gallery mt2" data-lb-group>%s</div></div></section>\n'
        % (e(T['fphotos_h']), rule(), e(T['fphotos_p']), ''.join('<button type="button" data-full="%s" data-title="%s" data-alt="%s">%s</button>'
            % (big(k), e(cap[lang]), e(alt[lang]), img(k, alt[lang], '(min-width: 760px) 33vw, 50vw')) for k, _, cap, alt in C.FUND_PHOTOS)) +
        '<section class="band on-soft" id="past"><div class="wrap"><h2>%s</h2>%s<ul class="posters mt2" data-lb-group>%s</ul></div></section>\n'
        % (e(T['past_h']), rule(), ''.join(posters)) +
        '<section class="band on-green"><div class="wrap cta"><div><h2>%s</h2>%s<p class="lede mb0">%s</p></div><div class="btns">%s</div></div></section>\n'
        % (e(T['host_h']), rule(), e(T['host_p']), btn(url('contact', lang), T['host_btn'])) + seed_script())
    return page(lang, 'events', T['title'], T['desc'], body)

def press(lang):
    en = lang == 'en'
    T = {
        'title': 'Press' if en else 'Presse', 'over': 'Press' if en else 'Presse', 'h1': 'In the news' if en else 'Dans les médias',
        'desc': 'Welfare Avenue in the news: CBC News, CTV News and interviews about our youth-powered work in Montreal.' if en else
                'Welfare Avenue dans les médias : CBC News, CTV News et des entrevues sur notre travail porté par les jeunes à Montréal.',
        'lede': 'Stories about Welfare Avenue and the volunteers who make it run.' if en else 'Des reportages sur Welfare Avenue et les bénévoles qui le font vivre.',
        'media_h': 'For media' if en else 'Pour les médias',
        'media_p': 'For interviews, photos or our logo, write to us and we will get back to you quickly.' if en else 'Pour une entrevue, des photos ou notre logo, écrivez-nous et nous vous répondrons rapidement.',
        'play': 'Play the video' if en else 'Lire la vidéo',
        'alt_media': 'A volunteer holds a news microphone at a Sunday serving.' if en else 'Une bénévole tient un micro de presse lors d’un service du dimanche.',
    }
    cards = []
    for pi, p in enumerate(C.PRESS):
        src = p['src'][lang] if isinstance(p['src'], dict) else p['src']
        vid = ('<div class="video"><button type="button" data-yt="%s" aria-label="%s%s%s"><img src="https://i.ytimg.com/vi/%s/hqdefault.jpg" alt="" width="480" height="360"%s>'
               '<span class="play" aria-hidden="true"></span></button></div>' % (p['yt'], e(T['play']), ': ' if en else '\u00a0: ', e(p['title'][lang]), p['yt'], ' fetchpriority="high"' if pi == 0 else ' loading="lazy"'))
        link = ('<p><a href="%s" rel="noopener">%s</a></p>' % (e(p['url']), e(p['link'][lang]))) if p.get('url') and p.get('link') else ''
        cards.append('<article>%s<p class="src">%s</p><h3>%s</h3><p>%s</p>%s</article>' % (vid, e(src), e(p['title'][lang]), e(p['text'][lang]), link))
    body = (page_hero(T['over'], T['h1'], T['lede']) +
        '<section class="band on-cream"><div class="wrap"><h2 class="sr">%s</h2><div class="press">%s</div></div></section>\n' % (e('News stories' if en else 'Reportages'), ''.join(cards)) +
        '<section class="band on-soft"><div class="wrap split"><div><h2>%s</h2>%s<p>%s</p><p><a href="mailto:%s">%s</a></p></div><div>%s</div></div></section>\n'
        % (e(T['media_h']), rule(), e(T['media_p']), C.EMAIL, C.EMAIL, img('2022-06-media-interview-b', T['alt_media'])))
    return page(lang, 'press', T['title'], T['desc'], body)

def contact(lang):
    en = lang == 'en'
    T = {
        'title': 'Contact us' if en else 'Nous joindre', 'over': 'Contact' if en else 'Contact',
        'desc': 'Contact Welfare Avenue about volunteering, partnerships, media or donations, and sign up for our newsletter.' if en else
                'Écrivez à Welfare Avenue au sujet du bénévolat, des partenariats, des médias ou des dons, et abonnez-vous à notre infolettre.',
        'lede': 'Questions, partnerships, media or a group that wants to serve: we read every message.' if en else
                'Questions, partenariats, médias ou un groupe qui veut servir : nous lisons chaque message.',
        'form_h': 'Write to us' if en else 'Écrivez-nous',
        'form_fb': 'Write to us at' if en else 'Écrivez-nous à',
        'direct_h': 'Or reach us directly' if en else 'Ou joignez-nous directement',
        'email': 'Email' if en else 'Courriel', 'social': 'Social media' if en else 'Réseaux sociaux',
        'partner_h': 'Partners and sponsors' if en else 'Partenaires et commanditaires',
        'partner_p': 'Invest in youth-powered, measurable impact. We build partnerships with visibility and a clear report of what your support made possible.' if en else
                     'Investissez dans un impact mesurable, porté par les jeunes. Nous bâtissons des partenariats qui offrent de la visibilité, avec un compte rendu clair de ce que votre soutien a rendu possible.',
        'news_h': 'Newsletter' if en else 'Infolettre',
        'news_fb': 'Sign-ups open soon. In the meantime, write to us at' if en else 'Les inscriptions ouvrent bientôt. D’ici là, écrivez-nous à',
    }
    soc = ''.join('<li><a href="%s" rel="noopener">%s</a></li>' % (e(h), e(n)) for n, h in C.SOCIAL)
    body = (page_hero(T['over'], T['title'], T['lede']) +
        '<section class="band on-cream"><div class="wrap grid2"><div><h2 class="sr">' + e('Contact form' if en else 'Formulaire de contact') + '</h2>%s</div><div><h2>%s</h2>%s<h3 class="mt2">%s</h3><p><a href="mailto:%s">%s</a></p>'
        '<h3 class="mt2">%s</h3><ul class="chips">%s</ul><p class="mt2"><a href="%s" rel="noopener">%s</a></p>'
        '<div class="card mt3"><h3>%s</h3><p class="mb0">%s</p></div></div></div></section>\n'
        % (form_box('contact' if en else 'nous-joindre,contact', '<h3>%s</h3><p class="waf-note">%s %s.</p>' % (e(T['form_h']), e(T['form_fb']), mail(lang)), lang),
           e(T['direct_h']), rule(), e(T['email']), C.EMAIL, C.EMAIL, e(T['social']), soc, e(C.REVIEW), e(C.UI[lang]['review']), e(T['partner_h']), e(T['partner_p'])) +
        '<section class="band on-soft" id="newsletter"><div class="wrap grid2"><div><h2>%s</h2>%s<p>%s</p></div><div>%s</div></div></section>\n'
        % (e(T['news_h']), rule(), e('News from our kitchens and the streets we serve, volunteer call-outs and ways to help, about once a month.' if en else
                                         'Des nouvelles de nos cuisines et des rues où nous servons, des appels aux bénévoles et des façons d’aider, environ une fois par mois.'),
           form_box('newsletter' if en else 'infolettre,newsletter', '<p class="waf-note">%s %s.</p>' % (e(T['news_fb']), mail(lang)), lang, heading=False)))
    return page(lang, 'contact', T['title'], T['desc'], body)

def donate(lang):
    en = lang == 'en'
    T = {
        'title': 'Donate' if en else 'Faire un don', 'over': 'Donate' if en else 'Faire un don', 'h1': 'Keep the pathway open' if en else 'Gardez le chemin ouvert',
        'desc': 'Give to Welfare Avenue, a youth-powered registered charity: your gift supports home-cooked meals, essentials and a pathway to support in Montreal and Toronto.' if en else
                'Donnez à Welfare Avenue, un organisme de bienfaisance enregistré porté par les jeunes : votre don soutient des repas maison, des essentiels et un chemin vers le soutien à Montréal et à Toronto.',
        'lede': 'Your gift turns into home-cooked meals every second Sunday and essentials all year. Thank you for standing with our community.' if en else
                'Votre don devient des repas maison un dimanche sur deux et des articles essentiels toute l’année. Merci d’être aux côtés de notre communauté.',
        'give_h': 'Give online' if en else 'Donner en ligne',
        'give_p': 'Give once, or every month to keep it steady. It takes a minute, securely through Stripe, without leaving this page.' if en else
                  'Donnez une fois, ou chaque mois pour un soutien constant. Cela prend une minute, de façon sécurisée avec Stripe, sans quitter cette page.',
        'give_btn': 'Give now' if en else 'Donner maintenant',
        'what_h': 'What your gift makes possible' if en else 'Ce que votre don rend possible',
        'what': ([('Sunday servings', 'Ingredients, containers and supplies for home-cooked meals served in downtown Montreal.'),
                  ('Essentials', 'Hygiene baskets, warm clothing and seasonal gifts, offered with dignity and choice.'),
                  ('A pathway to support', 'The time, transport and partnerships that connect people with the services they need.')] if en else
                 [('Les repas du dimanche', 'Ingrédients, contenants et matériel pour les repas maison servis au centre-ville de Montréal.'),
                  ('Les articles essentiels', 'Paniers d’hygiène, vêtements chauds et cadeaux de saison, offerts avec dignité et en laissant le choix.'),
                  ('Un chemin vers le soutien', 'Le temps, le transport et les partenariats qui relient les gens aux services dont ils ont besoin.')]),
        'ess_h': 'Give essentials' if en else 'Donner des essentiels',
        'ess_p': 'We welcome new or gently used warm clothing, hygiene products and non-perishable food. Write to us to arrange a drop-off.' if en else
                 'Nous acceptons des vêtements chauds neufs ou en bon état, des produits d’hygiène et des aliments non périssables. Écrivez-nous pour organiser un dépôt.',
        'corp_h': 'Companies and foundations' if en else 'Entreprises et fondations',
        'corp_p': 'Invest in youth-powered, measurable impact, from sponsoring a serving to a season-long partnership.' if en else
                  'Investissez dans un impact mesurable, porté par les jeunes, de la commandite d’un service à un partenariat d’une saison.',
        'talk': 'Talk to us' if en else 'Parlons-en',
        'alt': 'Volunteers in green vests serve food onto a plate held out across the table.' if en else 'Des bénévoles en dossard vert servent une assiette tendue de l’autre côté de la table.',
    }
    what = ''.join('<div class="card"><h3>%s</h3><p>%s</p></div>' % (e(t), e(d)) for t, d in T['what'])
    body = (page_hero(T['over'], T['h1'], T['lede']) +
        '<section class="band on-cream"><div class="wrap split"><div><h2>%s</h2>%s<p class="lede">%s</p><div class="btns">%s</div><p class="fine mt2">%s</p></div><div>%s</div></div></section>\n'
        % (e(T['give_h']), rule(), e(T['give_p']), btn(give(lang), T['give_btn'], donate=True), e(receipt_line(lang)), img('2023-10-autumn-plate-served', T['alt'], eager=True)) +
        '<section class="band on-soft"><div class="wrap"><h2>%s</h2>%s<div class="grid3 mt2">%s</div><div class="mt3">%s</div></div></section>\n' % (e(T['what_h']), rule(), what, stats(lang)) +
        '<section class="band on-cream" id="essentials"><div class="wrap grid2"><div class="card"><h2 class="h2">%s</h2>%s<p>%s</p><div class="btns">%s</div></div>'
        '<div class="card"><h2 class="h2">%s</h2>%s<p>%s</p><div class="btns">%s</div></div></div></section>\n'
        % (e(T['ess_h']), rule(), e(T['ess_p']), btn(url('contact', lang), T['talk'], 'ghost dark'), e(T['corp_h']), rule(), e(T['corp_p']), btn(url('contact', lang), T['talk'], 'ghost dark')))
    return page(lang, 'donate', T['title'], T['desc'], body)

def notfound():
    body = ('<section class="band on-cream notfound"><div class="wrap"><p class="over">404</p><h1>Page not found</h1>%s'
            '<p class="lede">The page you are looking for has moved or no longer exists. <span lang="fr">La page que vous cherchez a été déplacée ou n’existe plus.</span></p>'
            '<div class="btns">%s%s</div></div></section>\n' % (rule(), btn('/', 'Home'), btn('/fr/', 'Accueil', 'ghost dark')))
    return head('en', '404', 'Page not found', 'Welfare Avenue') .replace('<link rel="canonical" href="https://welfareavenue.com/">\n', '') + header('en', 'home').replace(' aria-current="page"', '') + body + footer('en')

# ---------- build ----------
BUILDERS = {'home': home, 'about': about, 'volunteer': volunteer, 'events': events, 'press': press, 'contact': contact, 'donate': donate}
for key, fn in BUILDERS.items():
    for lang in ('en', 'fr'):
        p = C.PATHS[key][lang].strip('/')
        put((p + '/' if p else '') + 'index.html', fn(lang))
put('404.html', notfound())

# Old website routes -> new pages (301), then the Hub's form pages for anyone holding an old link
REDIRECTS = [
    ('/about/gallery', '/events/#photos'), ('/activity', '/events/'), ('/activity/volunteer/*', '/volunteer/'), ('/activity/volunteer', '/volunteer/'),
    ('/activity/weekly-volunteering', '/volunteer/'), ('/activity/fundraising/*', '/events/#past'), ('/activity/fundraising', '/events/#past'),
    ('/activity/club-volunteering', '/volunteer/#groups'), ('/activity/donate-essentials', '/donate/#essentials'), ('/thank-you', '/'),
    ('/thank-you-newsletter', '/'), ('/signup', '/volunteer/'), ('/signin', '/'), ('/confirm-participation', '/volunteer/'), ('/user-profile', '/'),
    ('/password-reset/*', '/'), ('/reset-password/*', '/'), ('/gallery', '/events/#photos'), ('/give', C.GIVE), ('/fr/donate', '/fr/donner/'),
]
put('_redirects', '# Welfare Avenue website (wave162): the old website\'s addresses\n' + ''.join('%s  %s  301\n' % (a, b) for a, b in REDIRECTS))

CSP = ("default-src 'self'; script-src 'self' https://hub.welfareavenue.com; style-src 'self' https://fonts.googleapis.com https://hub.welfareavenue.com; font-src https://fonts.gstatic.com; "
       "img-src 'self' data: https://zwnmulmnvopclzcvytce.supabase.co https://i.ytimg.com; connect-src 'self' https://zwnmulmnvopclzcvytce.supabase.co; "
       "frame-src https://www.youtube-nocookie.com https://hub.welfareavenue.com https://www.linkedin.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests")
HEADERS = ('# Welfare Avenue website (wave162): security headers for every page. One CSP for the whole site.\n/*\n'
           '  Content-Security-Policy: ' + CSP + '\n'
           '  Strict-Transport-Security: max-age=31536000\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n'
           '  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self \"https://hub.welfareavenue.com\")\n'
           + ('' if LAUNCH else '  X-Robots-Tag: noindex\n') +
           '/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/img/*\n  Cache-Control: public, max-age=604800\n')
put('_headers', HEADERS)
if LAUNCH:
    put('robots.txt', 'User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n' % SITE)
else:
    put('robots.txt', '# Preview: not for search engines yet\nUser-agent: *\nDisallow: /\n')
urls = []
for key in BUILDERS:
    for lang in ('en', 'fr'):
        urls.append('  <url><loc>%s%s</loc><xhtml:link rel="alternate" hreflang="en" href="%s%s"/><xhtml:link rel="alternate" hreflang="fr" href="%s%s"/></url>\n'
                    % (SITE, C.PATHS[key][lang], SITE, C.PATHS[key]['en'], SITE, C.PATHS[key]['fr']))
put('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + ''.join(urls) + '</urlset>\n')

# write out (keep out/img from images.py and the icons from icons.py)
for p in list(os.listdir(OUT)) if os.path.isdir(OUT) else []:
    full = os.path.join(OUT, p)
    if p in ('img',) or p in ('favicon-32.png', 'apple-touch-icon.png'): continue
    shutil.rmtree(full) if os.path.isdir(full) else os.remove(full)
for p, data in files.items():
    full = os.path.join(OUT, p); os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, 'wb').write(data.encode('utf8') if isinstance(data, str) else data)
tot = sum(len(d.encode('utf8') if isinstance(d, str) else d) for d in files.values())
print('built %d files (%d bytes of text), %s' % (len(files), tot, 'LAUNCH' if LAUNCH else 'preview'))
