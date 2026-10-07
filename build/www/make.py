#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build the new welfareavenue.com into build/www/out: English at /, French at /fr/.

  python3 build/www/make.py            # preview build (noindex everywhere)
  python3 build/www/make.py --launch   # launch build (indexable, robots.txt allows, sitemap listed)

wave162 (28/09/26) built the site; www2 (01/10/26) rebuilt its look on Edison Casallas's Figma mockup ("Welfare Avenue
UX Web Redesign", 30/09/26): a white header with the menu in Edison's order, photo heroes with a green veil, square
buttons with an arrow, the three ways in on the home page, sand figure tiles, Edison's volunteer opportunity cards, "How
to join", "Who do we need?" at each serving (the Hub's roster targets), the donation layout and a deep green footer.
The copy, the two languages, the Hub's forms, the live servings and the donation popup are wave162's.
wave194 (02/10/26) adds the accounts (/account/ and /fr/compte/: sign in with Google or an emailed code, the profile, the
volunteering, the signed letters, the gifts and receipts, the newsletter; assets/account.js, behind the Hub's
site_accounts_mode switch), forms that fill in for a signed-in person, and the privacy notice (/privacy/,
/fr/confidentialite/).

Static pages with no inline script or style (strict CSP). Dynamic parts come from the Hub at view time:
/assets/site.js reads the next servings and fundraisers (rpc www_upcoming, anonymous) with the build's copy as the
first paint; /assets/forms.js shows the Hub's published forms (form-submit). Donate buttons open the Hub's donation
page (hub.welfareavenue.com/give) in a popup (give/embed.js) and carry data-wa-donate.
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
for a in ('site.css', 'site.js', 'forms.js', 'account.js', 'signin.js'):
    put('assets/' + a, open(os.path.join(HERE, 'assets', a), encoding='utf8').read())
put('assets/logo-cream.svg', svg_primary('#FFFAF2'))
put('assets/logo-green.svg', svg_primary('#103F39'))
put('assets/lockup-cream.svg', svg_lockup('#FFFAF2'))
put('favicon.svg', FAVICON)
V = {a: ver('assets/' + a) for a in ('site.css', 'site.js', 'forms.js', 'account.js', 'signin.js')}

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

def alt_of(key, lang):
    """The alt text the photo library gave a photo (content.PHOTOS, PHOTOS_NEW and FUND_PHOTOS)."""
    for k, _, alt in C.PHOTOS_NEW + C.PHOTOS:
        if k == key: return alt[lang]
    for k, _, _, alt in C.FUND_PHOTOS:
        if k == key: return alt[lang]
    raise KeyError(key)

def give(lang):
    """The Hub's donation page in the page's language (French since wave162b: the page and Stripe's form in French)."""
    return C.GIVE if lang == 'en' else C.GIVE + '/?lang=fr'

ARROW = ('<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" fill="none" '
         'stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg>')

def btn(href, label, cls='', donate=False, arrow=True):
    """Edison's button: square, green, the label and an arrow."""
    return '<a class="btn%s" href="%s"%s>%s%s</a>' % ((' ' + cls) if cls else '', e(href), ' data-wa-donate' if donate else '', e(label), ARROW if arrow else '')

def textlink(href, label):
    return '<a class="textlink" href="%s">%s%s</a>' % (e(href), e(label), ARROW)

def rule(): return ''

def mark(cls='mk'):
    """The brand's E in a gold square, where Edison's design puts the WEL/FAR mark beside a section title."""
    return ('<svg class="%s" viewBox="0 0 50 50" aria-hidden="true" focusable="false"><rect width="50" height="50" fill="#DCA527"/><g fill="#103F39">'
            '<rect x="15" y="12" width="5.5" height="26"/><rect x="15" y="12" width="21" height="5.5"/><rect x="15" y="22.25" width="17" height="5.5"/>'
            '<rect x="15" y="32.5" width="21" height="5.5"/></g></svg>') % cls

def tile_mark():
    """The brand's E in green, on the sand figure tiles."""
    return ('<svg class="mk" viewBox="0 0 30 30" aria-hidden="true" focusable="false"><g fill="currentColor"><rect x="6" y="3" width="4.4" height="24"/>'
            '<rect x="6" y="3" width="18" height="4.4"/><rect x="6" y="12.8" width="14.5" height="4.4"/><rect x="6" y="22.6" width="18" height="4.4"/></g></svg>')

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
              'logo': SITE + '/apple-touch-icon.png', 'email': C.EMAIL, 'telephone': C.PHONE['ld'], 'foundingDate': '2020', 'areaServed': ['Montreal', 'Toronto', 'Ottawa'],
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
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&amp;family=Space+Grotesk:wght@400;500;700&amp;display=swap">\n'
            '<link rel="stylesheet" href="/assets/site.css?v=%s">\n%s<script src="/assets/site.js?v=%s" defer></script>\n%s<script src="https://hub.welfareavenue.com/give/embed.js" async></script>\n</head>\n'
            % (lang, e(t), e(desc), '' if (LAUNCH and key != 'account') else '<meta name="robots" content="noindex">\n', e(canon), alt, e(t), e(desc), e(canon), og,
               'fr_CA' if lang == 'fr' else 'en_CA', V['site.css'], ld,
               V['site.js'], ('<script src="/assets/signin.js?v=%s" defer></script>\n' % V['signin.js']) +
               (('<script src="/assets/forms.js?v=%s" defer></script>\n' % V['forms.js']) if key in ('home', 'volunteer', 'contact', 'join') else '') +
               (('<script src="/assets/account.js?v=%s" defer></script>\n' % V['account.js']) if key == 'account' else '')))

def header(lang, key):
    u = C.UI[lang]; other = u['other_code']
    other_url = C.PATHS[key][other] if key in C.PATHS else C.PATHS['home'][other]
    hint = ''
    if lang == 'en':
        hint = ('<div class="langhint" id="langhint" hidden lang="fr"><div class="wrap"><span>%s</span> <a href="%s" hreflang="fr">%s</a>'
                '<button type="button" aria-label="%s">&times;</button></div></div>\n' % (e(u['hint']), e(other_url), e(u['hint_link']), e(u['hint_close'])))
    links = ''.join('<a href="%s"%s>%s</a>' % (e(url(k, lang)), ' aria-current="page"' if k == key else '', e(u['nav'][k])) for k in C.NAV)
    # wave194: "My account" shows once accounts are on, or for someone signed in (site.js)
    # wave202: Sign up opens the sign-up window once accounts are on (signin.js); until then it is the volunteer form
    side = ('<a href="%s" data-acct-link hidden%s>%s%s</a><a href="%s"%s>%s%s</a><a href="%s" data-signup>%s%s</a>'
            % (e(url('account', lang)), ' aria-current="page"' if key == 'account' else '', e(u['account']), ARROW,
               e(url('contact', lang)), ' aria-current="page"' if key == 'contact' else '', e(u['nav']['contact']), ARROW,
               e(url('volunteer#apply', lang)), e(u['signup']), ARROW))
    return ('<body data-lang="%s" data-supa="%s" data-key="%s">\n<a class="skip" href="#main">%s</a>\n%s'
            '<header class="top"><div class="wrap">\n<a class="brand" href="%s" aria-label="%s"><img src="/assets/logo-green.svg" alt="Welfare Avenue" width="130" height="44"></a>\n'
            '%s\n<button class="menu-btn" type="button" aria-expanded="false" aria-controls="nav"><span aria-hidden="true"></span><b class="sr">%s</b></button>\n'
            '<nav class="nav" id="nav" aria-label="%s"><div class="links">%s<a class="lang" href="%s" hreflang="%s" lang="%s">%s</a></div><div class="side">%s</div></nav>\n'
            '</div></header>\n<main id="main">\n'
            % (lang, SUPA, KEY, e(u['skip']), hint, e(url('home', lang)), e(u['home_label']),
               btn(give(lang), u['nav']['donate'], 'donate-m', donate=True, arrow=False), e(u['menu']), e(u['main_nav']), links, e(other_url), other, other,
               e(u['other_lang']), side))

def footer(lang):
    u = C.UI[lang]; en = lang == 'en'
    explore = ''.join('<li><a href="%s">%s</a></li>' % (e(url(k, lang)), e(u['nav'][k])) for k in ('home', 'events', 'volunteer', 'press', 'about', 'donate'))
    about = [('about#mission', 'Our mission' if en else 'Notre mission'), ('about#story', 'Our story' if en else 'Notre histoire'),
             ('about#team', 'Our team' if en else 'Notre équipe'), ('join', 'Join our team' if en else 'Rejoindre l’équipe'),
             ('contact#newsletter', 'Newsletter' if en else 'Infolettre'), ('contact', u['nav']['contact'])]
    aboutl = ''.join('<li><a href="%s">%s</a></li>' % (e(url(k, lang)), e(t)) for k, t in about)
    aboutl += '<li data-acct-link hidden><a href="%s">%s</a></li>' % (e(url('account', lang)), e(u['account']))
    soc = ''.join('<a href="%s" rel="noopener">%s</a>' % (e(h), e(n)) for n, h in C.SOCIAL)
    cities = 'Montreal, Quebec<br>Toronto, Ontario' if en else 'Montréal (Québec)<br>Toronto (Ontario)'
    return ('</main>\n<footer class="foot on-dark"><div class="wrap"><div class="cols">\n'
            '<div class="who"><a class="logo" href="%s" aria-label="%s"><img src="/assets/logo-cream.svg" alt="Welfare Avenue" width="120" height="40"></a>'
            '<p><a href="mailto:%s">%s</a><br>%s</p><p>%s</p></div>\n'
            '<div><h2>%s</h2><ul>%s</ul></div>\n<div><h2>%s</h2><ul>%s</ul></div>\n'
            '<div><h2>%s</h2><div class="social">%s</div><p class="mt2"><a href="%s" rel="noopener">%s</a></p></div>\n'
            '<div class="give"><p>%s</p>%s</div>\n</div>\n'
            '<div class="legal"><span>&copy; %d %s</span><span>%s %s</span><span><a href="%s">%s</a></span></div>\n</div></footer>\n</body>\n</html>\n'
            % (e(url('home', lang)), e(u['home_label']), C.EMAIL, C.EMAIL, phone(lang), cities,
               e('Explore' if en else 'Explorer'), explore, e('About' if en else 'À propos'), aboutl,
               e('Connect' if en else 'Nous suivre'), soc, e(C.REVIEW), e(u['review']),
               e('Your generosity helps us' if en else 'Votre générosité nous aide'), btn(give(lang), u['nav']['donate'], 'light', donate=True),
               datetime.date.today().year, e(u['rights']), e(u['charity']), C.CHARITY, e(url('privacy', lang)), e(u['privacy'])))

def page(lang, key, title, desc, body):
    return head(lang, key, title, desc) + header(lang, key) + body + footer(lang)

def hero(title_html, lede, key, alt, btns='', pos='', cls='page'):
    """Edison's hero: a photo with a green veil, 'Welfare Avenue' above the title, the words in white."""
    return ('<section class="hero %s"><div class="bg">%s</div><div class="wrap"><p class="over">Welfare Avenue</p>%s%s%s</div></section>\n'
            % (cls, img(key, alt, '100vw', cls=('pos-' + pos) if pos else '', eager=True), title_html,
               ('<p class="lede">%s</p>' % e(lede)) if lede else '', ('<div class="btns">%s</div>' % btns) if btns else ''))

def h1(text): return '<h1>%s</h1>' % e(text)

def e_svg(cls='e'):
    # the brand's E (the one that moves), drawn in the text colour; decorative
    return '<svg class="%s" viewBox="0 0 825 345" aria-hidden="true" focusable="false"><path fill="currentColor" d="%s"/></svg>' % (cls, E_PATH)

DOODLE = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/brand/'

def fund_alt(key, lang):
    for k, _, cap, alt in C.FUND_PHOTOS:
        if k == key: return alt[lang]
    return ''

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

def phone(lang):
    # www3 (01/10/26): Welfare Avenue's phone line, (438) 808-7754 in English and 438 808-7754 in French
    return '<a href="tel:%s">%s</a>' % (C.PHONE['tel'], e(C.PHONE[lang]))

def stats_note(lang):
    return '<p class="fine mt2">%s</p>' % e(C.STATS_NOTE[lang])

def figs(lang, items=None, cls=''):
    """Edison's figures: a thin rule, the number, the label (www3: our best estimates from the Hub, content.IMPACT)."""
    items = items if items is not None else C.STATS[lang]
    return '<ul class="figs%s">%s</ul>' % ((' ' + cls) if cls else '', ''.join('<li class="fig"><b>%s</b><span>%s</span></li>' % (e(n), e(t)) for n, t in items))

def focus(lang):
    """Edison's 'Our main focus': the figures in sand tiles beside the four pillars."""
    tiles = ''.join('<li class="tile">%s<b>%s</b><span>%s</span></li>' % (tile_mark(), e(n), e(t)) for n, t in C.STATS[lang])
    pills = ''.join('<li><h3>%s</h3><p>%s</p></li>' % (e(t), e(d)) for t, d in C.PILLARS[lang])
    return '<div class="focus"><div><ul class="tiles">%s</ul>%s</div><ul class="pillars">%s</ul></div>' % (tiles, stats_note(lang), pills)

def moving_where(lang):
    # The one E that moves on the site (home headline): wh≡re in English, rencontr≡ in French. Screen readers get the plain words.
    svg = '<span class="emove" aria-hidden="true"><svg viewBox="0 0 825 345" preserveAspectRatio="xMinYMax meet" focusable="false"><path fill="currentColor" d="%s"/></svg></span>' % E_PATH
    if lang == 'en':
        return '<h1><span class="sr">We meet people where they are</span><span aria-hidden="true">We meet people<br>wh%sre they are</span></h1>' % svg
    return '<h1><span class="sr">Aller à la rencontre des gens, là où ils sont</span><span aria-hidden="true">Aller à la rencontr%s<br>des gens, là où ils sont</span></h1>' % svg

MISSION = {
    'h': {'en': 'Solidarity, not charity', 'fr': 'La solidarité, pas la charité'},
    'p1': {'en': 'We lead with the person, not their circumstance. Everyone who comes to a serving is part of our community, and is welcomed that way.',
           'fr': 'Nous voyons d’abord la personne, pas sa situation. Toute personne qui se présente à un service fait partie de notre communauté et y est accueillie comme telle.'},
    'p2': {'en': 'Food is our starting point. From a first meal, we build trust and connect people with the support that can change what comes next: essentials, community services, housing and health resources, through the partners who provide them.',
           'fr': 'La nourriture est notre point de départ. À partir d’un premier repas, nous bâtissons la confiance et orientons les gens vers le soutien qui peut changer la suite : des articles essentiels, des services communautaires, des ressources en logement et en santé, grâce aux partenaires qui les offrent.'},
    'p3': {'en': 'And we are youth-powered. Students and young professionals cook, drive, serve and lead, and grow into the next generation of community leaders along the way.',
           'fr': 'Et nous sommes portés par les jeunes. Des étudiants et de jeunes professionnels cuisinent, conduisent, servent et dirigent, et deviennent en chemin la prochaine génération de leaders communautaires.'},
}

def newsletter_band(lang, photo):
    en = lang == 'en'
    fb = '<p class="waf-note">%s %s.</p>' % (e('Sign-ups open soon. In the meantime, write to us at' if en else 'Les inscriptions ouvrent bientôt. D’ici là, écrivez-nous à'), mail(lang))
    return ('<section class="band on-dark" id="newsletter"><div class="wrap split"><div class="pic">%s</div><div><p class="over">%s</p><h2>%s</h2>'
            '<p class="mt1">%s</p>%s</div></div></section>\n'
            % (img(photo, alt_of(photo, lang)), e('Newsletter' if en else 'Infolettre'),
               e('Occasional news. Meaningful updates.' if en else 'Des nouvelles de temps en temps. Des nouvelles qui comptent.'),
               e('News from our kitchens and the streets we serve, volunteer call-outs and ways to help, about once a month.' if en else
                 'Des nouvelles de nos cuisines et des rues où nous servons, des appels aux bénévoles et des façons d’aider, environ une fois par mois.'),
               form_box('newsletter' if en else 'infolettre,newsletter', fb, lang, heading=False)))

# ---------- pages ----------
def home(lang):
    en = lang == 'en'
    T = {
        'title': 'Welfare Avenue · Youth-powered action against food insecurity' if en else 'Welfare Avenue · Des jeunes en action contre l’insécurité alimentaire',
        'desc': 'Welfare Avenue is a youth-powered charity fighting food insecurity and poverty in Montreal and Toronto through direct community action: meals, essentials and a pathway to support.' if en else
                'Welfare Avenue est un organisme de bienfaisance porté par les jeunes qui lutte contre l’insécurité alimentaire et la pauvreté à Montréal et à Toronto par l’action directe : repas, essentiels et un chemin vers le soutien.',
        'lede': 'Welfare Avenue is a youth-powered charity fighting food insecurity and poverty through direct community action. We bring meals and essential support to people where they are, then connect them with the services they need.' if en else
                'Welfare Avenue est un organisme de bienfaisance porté par les jeunes qui lutte contre l’insécurité alimentaire et la pauvreté par l’action directe. Nous apportons des repas et du soutien essentiel aux gens, là où ils sont, puis nous les orientons vers les services dont ils ont besoin.',
        'hero_btn': 'Make a donation' if en else 'Faire un don',
        'paths': ([('Find support', 'Free home-cooked meals every second Sunday in downtown Montreal, and a hand finding the services you need.', 'events#upcoming', 'See when we serve next'),
                   ('Volunteer', 'Give a few hours on a Sunday: serve, cook, drive or take photos with a youth-powered team.', 'volunteer', 'Volunteer with us'),
                   ('Donate', 'Your gift puts home-cooked meals on the table and keeps essentials moving all year.', 'donate', 'Ways to give')] if en else
                  [('Trouver du soutien', 'Des repas maison gratuits un dimanche sur deux au centre-ville de Montréal, et un coup de main pour trouver les services dont vous avez besoin.', 'events#upcoming', 'Voir les prochains repas'),
                   ('Devenir bénévole', 'Donnez quelques heures un dimanche : servez, cuisinez, conduisez ou prenez des photos avec une équipe portée par les jeunes.', 'volunteer', 'Faire du bénévolat avec nous'),
                   ('Faire un don', 'Votre don met des repas maison sur la table et assure la distribution d’articles essentiels toute l’année.', 'donate', 'Les façons de donner')]),
        'vol_over': 'Volunteers' if en else 'Bénévoles',
        'vol_h': 'A few hours can make a meaningful difference.' if en else 'Quelques heures peuvent faire une vraie différence.',
        'vol_p': 'Cook, drive, serve or take photos. Be part of the engine connecting people to the help they need, and build leadership skills while creating measurable impact.' if en else
                 'Cuisinez, conduisez, servez ou prenez des photos. Contribuez à relier les gens à l’aide dont ils ont besoin, et développez votre leadership en ayant un impact mesurable.',
        'vol_btn': 'Become a volunteer' if en else 'Devenir bénévole',
        'mis_over': 'Our mission' if en else 'Notre mission',
        'mis_btn': 'Discover our mission' if en else 'Découvrir notre mission',
        'focus_h': 'Our main focus' if en else 'Ce sur quoi nous nous concentrons',
        'act_over': 'Our activities' if en else 'Nos activités',
        'act_h': 'How and where we work' if en else 'Comment et où nous agissons',
        'act_p': 'Every second Sunday, our volunteers serve home-cooked meals in downtown Montreal. Pick a Sunday and join the team.' if en else
                 'Un dimanche sur deux, nos bénévoles servent des repas maison au centre-ville de Montréal. Choisissez un dimanche et joignez-vous à l’équipe.',
        'act_note': 'Servings run every second Sunday in downtown Montreal.' if en else 'Les repas ont lieu un dimanche sur deux au centre-ville de Montréal.',
        'act_btn': 'Discover our activities' if en else 'Découvrir nos activités',
        'partner_over': 'What partners say' if en else 'Ce qu’en disent nos partenaires',
        'press_over': 'In the news' if en else 'Dans les médias', 'press_p': 'CBC News, CTV News and CityNews have covered our volunteers since 2022.' if en else 'CBC News, CTV News et CityNews parlent de nos bénévoles depuis 2022.',
        'press_btn': 'See the coverage' if en else 'Voir les reportages',
    }
    paths = ''.join('<li><h2>%s</h2><p>%s</p><a class="sq" href="%s" aria-label="%s">%s</a></li>' % (e(t), e(d), e(url(k, lang)), e(lbl), ARROW) for t, d, k, lbl in T['paths'])
    body = (
        hero(moving_where(lang), T['lede'], '2022-10-autumn-crew-at-the-tent', alt_of('2022-10-autumn-crew-at-the-tent', lang),
             btn(give(lang), T['hero_btn'], donate=True), cls='home') +
        '<section class="paths" aria-label="%s"><div class="wrap"><ul>%s</ul></div></section>\n' % (e('Ways in' if en else 'Par où commencer'), paths) +
        '<section class="band on-white"><div class="wrap split"><div class="pic">%s</div><div><p class="over">%s</p><h2>%s</h2><p class="mt1">%s</p><div class="btns">%s</div></div></div></section>\n'
        % (img('2024-07-summer-team-under-the-tent', alt_of('2024-07-summer-team-under-the-tent', lang)), e(T['vol_over']), e(T['vol_h']), e(T['vol_p']),
           btn(url('volunteer', lang), T['vol_btn'])) +
        '<section class="band on-grey"><div class="wrap split flip"><div class="pic">%s</div><div><p class="over">%s</p><h2>%s</h2><p class="mt1">%s</p><p>%s</p><div class="btns">%s</div></div></div></section>\n'
        % (img('2022-04-spring-soup-from-the-pot', alt_of('2022-04-spring-soup-from-the-pot', lang)), e(T['mis_over']), e(MISSION['h'][lang]), e(MISSION['p1'][lang]),
           e(MISSION['p2'][lang]), btn(url('about#mission', lang), T['mis_btn'])) +
        '<section class="band on-white"><div class="wrap"><h2 class="over sec-h">%s</h2>%s</div></section>\n' % (e(T['focus_h']), focus(lang)) +
        '<section class="band on-grey"><div class="wrap center narrow"><div class="circle">%s</div><p class="over">%s</p><h2>%s</h2><p class="mt1">%s</p>%s<div class="btns center-btns">%s</div></div></section>\n'
        % (img('2023-10-autumn-crew-behind-the-table', alt_of('2023-10-autumn-crew-behind-the-table', lang), '220px'), e(T['act_over']), e(T['act_h']), e(T['act_p']),
           upcoming_box(lang, 'servings', 3, 'volunteer#apply', T['act_note']), btn(url('events', lang), T['act_btn'])) +
        '<section class="band on-white"><div class="wrap"><p class="over">%s</p>%s</div></section>\n' % (e(T['partner_over']), quote(C.QUOTE_PARTNER, lang)) +
        '<section class="band on-mist"><div class="wrap cta"><div><p class="over">%s</p><p class="lede mb0">%s</p></div><div class="btns">%s</div></div></section>\n'
        % (e(T['press_over']), e(T['press_p']), btn(url('press', lang), T['press_btn'], 'ghost')) +
        newsletter_band(lang, '2023-10-autumn-plate-served') +
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
    return ('<section class="band on-white" id="companies"><div class="wrap"><h2>%s</h2><p class="maxw mt1">%s</p><ul class="liposts mt2">%s</ul>'
            '<p class="mt2">%s <a href="%s">%s</a></p></div></section>\n'
            % (e('Companies that work with us' if en else 'Des entreprises à nos côtés'),
               e('Teams from these companies have worked alongside us. Here it is in their own words, on LinkedIn.' if en else
                 'Des équipes de ces entreprises ont travaillé à nos côtés. Voici ce qu’elles en disent, sur LinkedIn.'),
               ''.join(cards),
               e('Want to bring your team?' if en else 'Vous voulez venir avec votre équipe ?'), e(url('volunteer', lang) + '#groups'),
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
    return ('<section class="band on-white" id="team"><div class="wrap"><p class="over">%s</p><h2>%s</h2><p class="maxw mt1">%s</p>%s'
            '<p class="small mt2">%s</p></div></section>\n'
            % (e('Our team' if en else 'Notre équipe'), e('The people behind every serving' if en else 'Les gens derrière chaque repas'),
               e('Meet the youth-powered team that makes every serving happen, from the kitchens and the streets to the board.' if en else
                 'Voici l’équipe portée par les jeunes qui rend chaque repas possible, des cuisines à la rue jusqu’au conseil d’administration.'),
               ''.join(groups),
               e('Serving counts come from our volunteer records. On the team and want your profile changed or taken down? Write to %s.' % C.EMAIL if en else
                 'Le nombre de repas vient de nos registres de bénévolat. Vous faites partie de l’équipe et voulez modifier ou retirer votre profil ? Écrivez à %s.' % C.EMAIL)))

def about(lang):
    en = lang == 'en'
    T = {
        'title': 'About us' if en else 'À propos',
        'desc': 'Welfare Avenue is a youth-powered registered charity, founded in Montreal in 2020, delivering meals and essential support directly to people where they are.' if en else
                'Welfare Avenue est un organisme de bienfaisance enregistré porté par les jeunes, fondé à Montréal en 2020, qui apporte repas et soutien essentiel directement aux gens, là où ils sont.',
        'lede': 'A youth-powered non-profit fighting food insecurity and poverty through direct community action, delivering meals and essential support directly to people where they are.' if en else
                'Un organisme à but non lucratif porté par les jeunes qui lutte contre l’insécurité alimentaire et la pauvreté par l’action directe, en apportant repas et soutien essentiel directement aux gens, là où ils sont.',
        'mis_over': 'Our mission' if en else 'Notre mission',
        'pillars_h': 'Four pillars' if en else 'Quatre piliers',
        'story_over': 'Our story' if en else 'Notre histoire', 'story_h': 'Since 2020' if en else 'Depuis 2020',
        'partners_h': 'Who we work with' if en else 'Avec qui nous travaillons',
        'partners_p': 'We collaborate with shelters, community organizations, schools and businesses, because no one does this work alone.' if en else
                      'Nous collaborons avec des refuges, des organismes communautaires, des établissements d’enseignement et des entreprises, parce que personne ne fait ce travail seul.',
        'charity_h': 'A registered charity' if en else 'Un organisme de bienfaisance enregistré',
        'charity_p': ('Welfare Avenue (Avenue du Bien-Être) has been a registered Canadian charity since October 2023. Registration number: %s.' % C.CHARITY) if en else
                     ('Welfare Avenue (Avenue du Bien-Être) est un organisme de bienfaisance canadien enregistré depuis octobre 2023. Numéro d’enregistrement : %s.' % C.CHARITY),
    }
    story = ''.join('<li><span class="when">%s</span><p>%s</p></li>' % (e(w), e(t)) for w, t in C.STORY[lang])
    partners = ''.join('<p class="city">%s</p><ul class="chips">%s</ul>' % (e(C.CITY[lang][c]), ''.join('<li>%s</li>' % e(C.PARTNER_FR.get(n, n) if lang == 'fr' else n) for n in names)) for c, names in C.PARTNERS.items())
    body = (hero(h1(T['title']), T['lede'], '2022-10-autumn-student-group', alt_of('2022-10-autumn-student-group', lang)) +
        '<section class="band on-white" id="mission"><div class="wrap split"><div><p class="over">%s</p><h2>%s</h2><p class="mt1">%s</p><p>%s</p><p class="mb0">%s</p></div><div class="pic">%s</div></div></section>\n'
        % (e(T['mis_over']), e(MISSION['h'][lang]), e(MISSION['p1'][lang]), e(MISSION['p2'][lang]), e(MISSION['p3'][lang]),
           img('2022-01-winter-serving-team', alt_of('2022-01-winter-serving-team', lang))) +
        '<section class="band on-grey"><div class="wrap"><h2 class="sec-h">%s</h2>%s</div></section>\n' % (e(T['pillars_h']), focus(lang)) +
        '<section class="band on-white" id="story"><div class="wrap"><p class="over">%s</p><h2>%s</h2><ol class="timeline mt2">%s</ol></div></section>\n' % (e(T['story_over']), e(T['story_h']), story) +
        '<section class="band on-grey"><div class="wrap"><h2>%s</h2><p class="maxw mt1">%s</p>%s</div></section>\n' % (e(T['partners_h']), e(T['partners_p']), partners) +
        companies_section(lang) +
        '<section class="band on-dark"><div class="wrap">%s</div></section>\n' % quote(C.QUOTE_PARTNER, lang) +
        team_section(lang) +
        '<section class="band on-grey"><div class="wrap cta"><div><h2>%s</h2><p class="mb0">%s</p></div><div class="btns">%s%s</div></div></section>\n'
        % (e(T['charity_h']), e(T['charity_p']), btn(url('volunteer', lang), 'Volunteer' if en else 'Devenir bénévole'), btn(give(lang), 'Donate' if en else 'Faire un don', 'ghost', donate=True)))
    return page(lang, 'about', T['title'], T['desc'], body)

ROLE_CHIP = {'en': 'Every second Sunday', 'fr': 'Un dimanche sur deux'}

def volunteer(lang):
    en = lang == 'en'
    T = {
        'title': 'Volunteer' if en else 'Bénévolat',
        'desc': 'Volunteer with Welfare Avenue: serve, cook, drive or take photos at our Sunday servings in Montreal, or join our team in Toronto.' if en else
                'Faites du bénévolat avec Welfare Avenue : servez, cuisinez, conduisez ou prenez des photos lors de nos services du dimanche à Montréal, ou joignez-vous à notre équipe de Toronto.',
        'lede': 'Be part of the engine connecting people to the help they need. Build leadership skills while creating measurable impact.' if en else
                'Contribuez à relier les gens à l’aide dont ils ont besoin. Développez votre leadership en ayant un impact mesurable.',
        'hero_btn': 'Apply now' if en else 'S’inscrire',
        'why_over': 'Why volunteer' if en else 'Pourquoi devenir bénévole',
        'why_h': 'Join a youth-powered movement' if en else 'Joignez-vous à un mouvement porté par les jeunes',
        'why_p': 'Volunteering with Welfare Avenue is more than giving back: it is belonging to something bigger. No experience needed; our team leads show you the ropes on the day.' if en else
                 'Faire du bénévolat avec Welfare Avenue, c’est plus que donner de son temps : c’est faire partie de quelque chose de plus grand. Aucune expérience requise ; nos chefs d’équipe vous montrent tout sur place.',
        'ticks': (['Build real connections in your community', 'Learn new skills in a supportive, welcoming team', 'See the difference you make at every serving'] if en else
                  ['Tisser de vrais liens dans votre communauté', 'Apprendre de nouvelles compétences dans une équipe accueillante', 'Voir la différence que vous faites à chaque repas']),
        'roles_h': 'Volunteer opportunities' if en else 'Occasions de bénévolat',
        'apply_role': 'Apply for this role' if en else 'S’inscrire pour ce rôle',
        'how_h': 'How to join' if en else 'Comment s’inscrire',
        'how': ([('Sign up', 'Tell us how you would like to help and pick the Sundays that work for you.'), ('Get confirmed', 'We confirm each date by text the week of the serving.'), ('Show up and serve', 'Servers arrive by noon. Dress for the weather; the rest is teamwork.')] if en else
                [('Inscrivez-vous', 'Dites-nous comment vous aimeriez aider et choisissez les dimanches qui vous conviennent.'), ('Recevez la confirmation', 'Nous confirmons chaque date par texto la semaine de la distribution.'), ('Venez servir', 'L’équipe de service arrive au plus tard à midi. Habillez-vous selon la météo ; le reste, c’est du travail d’équipe.')]),
        'apply_over': 'Sign up to volunteer' if en else 'Inscription',
        'apply_h2': 'Ready to make a difference?' if en else 'Envie de faire une différence ?',
        'apply_p': 'Pick the Sundays that work for you. We confirm each date by text the week of the serving.' if en else
                   'Choisissez les dimanches qui vous conviennent. Nous confirmons chaque date par texto la semaine de la distribution.',
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
        'team_h': 'Want to do more? Join our team' if en else 'Envie d’en faire plus? Rejoignez l’équipe',
        'team_p': 'Our team runs Welfare Avenue behind the servings: operations, marketing, fundraising, HR and more, a few hours a week. See the open roles and apply with your CV.' if en else
                  'Notre équipe fait vivre Welfare Avenue au-delà des repas : opérations, marketing, collecte de fonds, RH et plus, quelques heures par semaine. Voyez les postes ouverts et postulez avec votre CV.',
        'team_btn': 'See the open roles' if en else 'Voir les postes ouverts',
    }
    city = C.CITY[lang]['Montreal']
    roles = ''.join('<li class="role"><div class="hd"><h3>%s</h3><ul class="tags"><li class="tag">%s</li></ul></div><p>%s</p><ul class="chips2"><li>%s</li></ul>%s</li>'
                    % (e(t), e(city), e(d), e(ROLE_CHIP[lang]), textlink(url('volunteer#apply', lang), T['apply_role'])) for t, d in C.ROLES[lang])
    how = ''.join('<li><p class="n" aria-hidden="true">0%d</p><h3>%s</h3><p>%s</p></li>' % (i + 1, e(t), e(d)) for i, (t, d) in enumerate(T['how']))
    ticks = ''.join('<li>%s</li>' % e(t) for t in T['ticks'])
    fb = '<p class="waf-note">%s %s.</p>' % (e(T['apply_fb']), mail(lang))
    body = (hero(h1(T['title']), T['lede'], '2022-01-winter-crew-in-the-snow', alt_of('2022-01-winter-crew-in-the-snow', lang),
                 btn(url('volunteer#apply', lang), T['hero_btn'])) +
        '<section class="band on-grey"><div class="wrap split"><div><p class="over">%s</p><h2>%s</h2><p class="mt1">%s</p><ul class="ticks">%s</ul></div><div class="pic">%s</div></div></section>\n'
        % (e(T['why_over']), e(T['why_h']), e(T['why_p']), ticks, img('2024-07-summer-servers-at-the-table', alt_of('2024-07-summer-servers-at-the-table', lang))) +
        '<section class="band on-white" id="roles"><div class="wrap"><div class="ihead">%s<h2>%s</h2></div><ul class="roles">%s</ul></div></section>\n'
        % (mark(), e(T['roles_h']), roles) +
        '<section class="band on-grey"><div class="wrap"><div class="ihead">%s<h2>%s</h2></div><ol class="steps">%s</ol></div></section>\n' % (mark(), e(T['how_h']), how) +
        '<section class="band on-white" id="apply"><div class="wrap split top"><div><p class="over">%s</p><h2>%s</h2><p class="mt1">%s</p>%s'
        '<h3 class="mt3">%s</h3>%s</div><div>%s</div></div></section>\n'
        % (e(T['apply_over']), e(T['apply_h2']), e(T['apply_p']), figs(lang, C.STATS_VOLUNTEER[lang], 'two mt2'),
           e(T['next_h']), upcoming_box(lang, 'servings', 5, 'volunteer#apply', T['next_note']),
           form_box('volunteer' if en else 'benevole,volunteer', '<h3>%s</h3>%s' % (e(T['apply_h']), fb), lang)) +
        '<section class="band on-grey" id="toronto"><div class="wrap split"><div><h2>%s</h2><p class="mt1 mb0">%s</p></div><div>'
        '<details class="more"><summary>%s</summary><div class="in">%s</div></details></div></div></section>\n'
        % (e(T['to_h']), e(T['to_p']), e(T['to_btn']), form_box('toronto-volunteer', fb, lang, heading=False)) +
        '<section class="band on-white"><div class="wrap">%s</div></section>\n' % quote(C.QUOTE_VOLUNTEER, lang) +
        '<section class="band on-grey" id="team"><div class="wrap cta"><div><h2>%s</h2><p class="mb0">%s</p></div><div class="btns">%s</div></div></section>\n'
        % (e(T['team_h']), e(T['team_p']), btn(url('join', lang), T['team_btn'])) +
        '<section class="band on-dark" id="groups"><div class="wrap cta"><div><h2>%s</h2><p class="lede mb0">%s</p></div><div class="btns">%s</div></div></section>\n'
        % (e(T['groups_h']), e(T['groups_p']), btn(url('contact', lang), T['groups_btn'])) + seed_script())
    return page(lang, 'volunteer', T['title'], T['desc'], body)

def join(lang):
    """wave216 (07/10/26), Steel: "I'd like for individuals to also have a spot to apply to join our team on the website. It should be a
    form built through the CRM that links new applicants to the applications section of the hr center." The open roles come live
    from the HR centre (site.js, wa216_open_positions); the form is the CRM's join / rejoindre (kind application), whose answers
    land on the Applications board with the CV."""
    en = lang == 'en'
    T = {
        'title': 'Join our team' if en else 'Rejoindre l’équipe',
        'desc': 'Join the Welfare Avenue team: volunteer roles in operations, marketing, fundraising and HR. See the open roles and apply with your CV.' if en else
                'Rejoignez l’équipe de Welfare Avenue : des rôles bénévoles en opérations, marketing, collecte de fonds et RH. Voyez les postes ouverts et postulez avec votre CV.',
        'lede': 'Welfare Avenue is youth-powered. The people who plan the servings, run the kitchen, tell our story and raise the funds are volunteers like you.' if en else
                'Welfare Avenue est porté par les jeunes. Les personnes qui planifient les repas, font tourner la cuisine, racontent notre histoire et collectent les fonds sont des bénévoles comme vous.',
        'hero_btn': 'See the open roles' if en else 'Voir les postes ouverts',
        'why_over': 'Why join' if en else 'Pourquoi nous rejoindre',
        'why_h': 'Lead, learn and make it happen' if en else 'Diriger, apprendre et passer à l’action',
        'why_p': 'Team roles take about four hours a week, mostly online, with a weekly team meeting. You get real responsibility, a team that has your back and work you can point to.' if en else
                 'Les rôles d’équipe demandent environ quatre heures par semaine, surtout en ligne, avec une réunion d’équipe chaque semaine. Vous avez de vraies responsabilités, une équipe qui vous soutient et un travail dont vous serez fier.',
        'ticks': (['Real responsibility from your first week', 'Leadership and project experience for your CV', 'A reference letter and a record of your hours'] if en else
                  ['De vraies responsabilités dès la première semaine', 'De l’expérience en leadership et en gestion de projet', 'Une lettre de référence et un relevé de vos heures']),
        'roles_h': 'Open roles' if en else 'Postes ouverts',
        'roles_fb': 'The roles we are recruiting for are in the form below. Not sure which fits? Send a general application.' if en else
                    'Les postes que nous recrutons sont dans le formulaire ci-dessous. Vous hésitez? Envoyez une candidature générale.',
        'how_h': 'How it works' if en else 'Comment ça marche',
        'how': ([('Apply', 'Pick a role, attach your CV and tell us why Welfare Avenue.'), ('We get in touch', 'Our HR team reads every application and calls or texts to set up a conversation.'),
                 ('Meet the team', 'A short interview with the people you would work with.'), ('Welcome aboard', 'An offer, then onboarding with your team lead.')] if en else
                [('Postulez', 'Choisissez un poste, joignez votre CV et dites-nous pourquoi Welfare Avenue.'), ('Nous vous écrivons', 'Notre équipe des RH lit chaque candidature et vous appelle ou vous texte pour fixer une conversation.'),
                 ('Rencontrez l’équipe', 'Une courte entrevue avec les personnes avec qui vous travailleriez.'), ('Bienvenue', 'Une offre, puis l’intégration avec votre responsable d’équipe.')]),
        'apply_over': 'Apply' if en else 'Postuler',
        'apply_h2': 'Ready to join us?' if en else 'Prêt à nous rejoindre?',
        'apply_p': 'It takes about five minutes. Have your CV ready as a PDF, a Word document or a photo.' if en else
                   'Cela prend environ cinq minutes. Ayez votre CV sous la main en PDF, en document Word ou en photo.',
        'apply_fb': ('Applications open here soon. In the meantime, send your CV to' if en else 'Les candidatures ouvriront ici bientôt. D’ici là, envoyez votre CV à'),
        'serve_h': 'Rather serve on Sundays?' if en else 'Vous préférez servir le dimanche?',
        'serve_p': 'Serving, cooking and driving at our Sunday servings needs no application: sign up on the volunteer page.' if en else
                   'Servir, cuisiner ou conduire lors de nos repas du dimanche ne demande pas de candidature : inscrivez-vous sur la page Bénévolat.',
        'serve_btn': 'Volunteer at a serving' if en else 'Faire du bénévolat',
    }
    how = ''.join('<li><p class="n" aria-hidden="true">0%d</p><h3>%s</h3><p>%s</p></li>' % (i + 1, e(t), e(d)) for i, (t, d) in enumerate(T['how']))
    ticks = ''.join('<li>%s</li>' % e(t) for t in T['ticks'])
    fb = '<h3>%s</h3><p class="waf-note">%s %s.</p>' % (e(T['apply_over']), e(T['apply_fb']), mail(lang))
    body = (hero(h1(T['title']), T['lede'], '2025-12-gift-baskets-the-crew', alt_of('2025-12-gift-baskets-the-crew', lang), btn('#roles', T['hero_btn'])) +
        '<section class="band on-grey"><div class="wrap split"><div><p class="over">%s</p><h2>%s</h2><p class="mt1">%s</p><ul class="ticks">%s</ul></div><div class="pic">%s</div></div></section>\n'
        % (e(T['why_over']), e(T['why_h']), e(T['why_p']), ticks, img('2022-10-autumn-crew-at-the-tent', alt_of('2022-10-autumn-crew-at-the-tent', lang))) +
        '<section class="band on-white" id="roles"><div class="wrap"><div class="ihead">%s<h2>%s</h2></div><div data-open-roles><p>%s</p></div></div></section>\n'
        % (mark(), e(T['roles_h']), e(T['roles_fb'])) +
        '<section class="band on-grey"><div class="wrap"><div class="ihead">%s<h2>%s</h2></div><ol class="steps">%s</ol></div></section>\n' % (mark(), e(T['how_h']), how) +
        '<section class="band on-white" id="apply"><div class="wrap split top"><div><p class="over">%s</p><h2>%s</h2><p class="mt1">%s</p></div><div>%s</div></div></section>\n'
        % (e(T['apply_over']), e(T['apply_h2']), e(T['apply_p']), form_box('join' if en else 'rejoindre,join', fb, lang)) +
        '<section class="band on-dark"><div class="wrap cta"><div><h2>%s</h2><p class="lede mb0">%s</p></div><div class="btns">%s</div></div></section>\n'
        % (e(T['serve_h']), e(T['serve_p']), btn(url('volunteer#apply', lang), T['serve_btn'])))
    return page(lang, 'join', T['title'], T['desc'], body)

def fmt_date(iso, lang):
    d = datetime.date.fromisoformat(iso)
    M_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    M_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
    return ('%s %d, %d' % (M_EN[d.month - 1], d.day, d.year)) if lang == 'en' else ('%d %s %d' % (d.day, M_FR[d.month - 1], d.year))

def events(lang):
    en = lang == 'en'
    T = {
        'title': 'Our activities' if en else 'Nos activités',
        'desc': 'Welfare Avenue’s activities: our Sunday servings in Montreal, fundraisers with our partners, and photos from the community.' if en else
                'Les activités de Welfare Avenue : nos services du dimanche à Montréal, nos collectes de fonds avec nos partenaires et des photos de la communauté.',
        'lede': 'Every second Sunday we serve in downtown Montreal, and through the year we host fundraisers with our partners. Come to one, or bring one to life.' if en else
                'Un dimanche sur deux, nous servons au centre-ville de Montréal, et tout au long de l’année nous organisons des collectes de fonds avec nos partenaires. Venez à l’une d’elles, ou créez la vôtre.',
        'hero_btn': 'Get involved' if en else 'S’impliquer',
        'feat_h': 'Sunday servings in downtown Montreal' if en else 'Les repas du dimanche au centre-ville de Montréal',
        'feat_tag': 'Every second Sunday' if en else 'Un dimanche sur deux',
        'feat_p': 'Every second Sunday, our volunteers set up the tent downtown and serve home-cooked meals to everyone who comes.' if en else
                  'Un dimanche sur deux, nos bénévoles montent la tente au centre-ville et servent des repas maison à toutes les personnes qui se présentent.',
        'feat_btn': 'Become a volunteer' if en else 'Devenir bénévole',
        'next_h': 'Coming up' if en else 'À venir', 'next_note': 'Servings run every second Sunday in downtown Montreal.' if en else 'Les repas ont lieu un dimanche sur deux au centre-ville de Montréal.',
        'need_over': 'At every serving' if en else 'À chaque repas',
        'need_h': 'Who do we need?' if en else 'De qui avons-nous besoin ?',
        'need_p': 'The team we aim for at each Sunday serving. Pick the role that suits you.' if en else 'L’équipe que nous visons pour chaque repas du dimanche. Choisissez le rôle qui vous convient.',
        'need_link': 'Sign up' if en else 'S’inscrire',
        'photos_h': 'From our servings' if en else 'Nos repas du dimanche en images',
        'photos_p': 'Photos from our Sunday servings. We only share photos of volunteers, food and moments where no one we serve can be recognized without their consent.' if en else
                    'Des photos de nos repas du dimanche. Nous ne publions que des photos de bénévoles, de nourriture et de moments où personne parmi les gens que nous servons ne peut être reconnu sans son consentement.',
        'past_h': 'Past events' if en else 'Événements passés',
        'fund_h': 'Fundraisers coming up' if en else 'Collectes à venir',
        'fund_p': 'Dates firm up as each one gets closer. Want to take part, sponsor or bring a team?' if en else
                  'Les dates se précisent à l’approche de chacune. Vous voulez participer, commanditer ou inscrire une équipe ?',
        'fund_btn': 'Write to us' if en else 'Écrivez-nous',
        'fphotos_h': 'From our fundraisers' if en else 'Nos collectes en images',
        'fphotos_p': 'Flag Football 2026 with the Montreal Flag Football League, and our 2025 Holiday Gift Basket Drive.' if en else
                     'Le tournoi de football-drapeau 2026 avec la Montreal Flag Football League, et nos paniers-cadeaux des fêtes 2025.',
        'host_h': 'Host a fundraiser with us' if en else 'Organisez une collecte avec nous',
        'host_p': 'Parties, bake sales, tournaments, talent shows: our best fundraisers started as someone’s idea. Tell us yours.' if en else
                  'Soirées, ventes de pâtisseries, tournois, spectacles de talents : nos meilleures collectes ont commencé par l’idée de quelqu’un. Parlez-nous de la vôtre.',
        'host_btn': 'Tell us your idea' if en else 'Proposer une idée',
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
            pic = '<div class="ph" aria-hidden="true">%s<span>%s</span></div>' % (e_svg(), e(title[lang]))
        posters.append('<li>%s<p class="t">%s</p><p class="m">%s</p><p class="fine mb0">%s</p></li>' % (pic, e(title[lang]), e(meta), e(note[lang])))
    def fund_card(i, item):
        ti, w, no = item
        m = C.FUND_NEXT_MEDIA[i] if i < len(C.FUND_NEXT_MEDIA) else None
        if m:
            top = '<div class="cm">%s<span class="tag">%s</span></div>' % (img(m[0], fund_alt(m[0], lang), '(min-width: 1080px) 25vw, (min-width: 560px) 50vw, 100vw'), e(m[1][lang]))
        else:
            top = '<div class="cm brand" aria-hidden="true">%s<img class="s" src="%s%s" alt="" width="40" height="42" loading="lazy"></div>' % (e_svg(), DOODLE, ['doodle-star-gold.png', 'doodle-flowers-gold.png', 'doodle-heart-purple.png', 'doodle-asterisk-cream.png'][i % 4])
        return '<li class="card media">%s<p class="num">%s</p><h3>%s</h3><p>%s</p></li>' % (top, e(w[lang]), e(ti[lang]), e(no[lang]))
    needs = ''.join('<li><p class="n">%d</p><h3>%s</h3><p>%s</p>%s</li>' % (n, e(t[lang]), e(d[lang]), textlink(url('volunteer#apply', lang), T['need_link']))
                    for _, n, t, d in C.SERVING_TEAM)
    body = (hero(h1(T['title']), T['lede'], C.EVENTS_HERO, fund_alt(C.EVENTS_HERO, lang), btn(url('volunteer', lang), T['hero_btn']), pos='top') +
        '<section class="band on-white" id="upcoming"><div class="wrap"><div class="split"><div>%s<h2 class="mt2">%s</h2><p class="dtag" data-next>%s</p><p>%s</p><div class="btns">%s</div></div>'
        '<div class="pic wide">%s</div></div><h3 class="mt3">%s</h3><div class="cols2">%s</div></div></section>\n'
        % (mark(), e(T['feat_h']), e(T['feat_tag']), e(T['feat_p']), btn(url('volunteer#apply', lang), T['feat_btn']),
           img('2024-10-autumn-volunteers-plating', alt_of('2024-10-autumn-volunteers-plating', lang), eager=True),
           e(T['next_h']), upcoming_box(lang, 'all', 6, 'volunteer#apply', T['next_note'])) +
        '<section class="band on-grey" id="team-needed"><div class="wrap"><p class="over">%s</p><h2>%s</h2><p class="maxw mt1">%s</p><ul class="needs mt3">%s</ul></div></section>\n'
        % (e(T['need_over']), e(T['need_h']), e(T['need_p']), needs) +
        '<section class="band on-dark" id="fundraisers"><div class="wrap"><h2>%s</h2><ul class="fundnext mt2">%s</ul><div class="cta mt3"><p class="lede mb0">%s</p><div class="btns">%s</div></div></div></section>\n'
        % (e(T['fund_h']), ''.join(fund_card(i, x) for i, x in enumerate(C.FUNDRAISERS_NEXT)),
           e(T['fund_p']), btn(url('contact', lang), T['fund_btn'])) +
        '<section class="band on-white" id="photos"><div class="wrap"><h2>%s</h2><p class="maxw mt1">%s</p><div class="gallery mt2" data-lb-group>%s</div></div></section>\n'
        % (e(T['photos_h']), e(T['photos_p']), gal) +
        '<section class="band on-grey" id="fundphotos"><div class="wrap"><h2>%s</h2><p class="maxw mt1">%s</p><div class="gallery mt2" data-lb-group>%s</div></div></section>\n'
        % (e(T['fphotos_h']), e(T['fphotos_p']), ''.join('<button type="button" data-full="%s" data-title="%s" data-alt="%s">%s</button>'
            % (big(k), e(cap[lang]), e(alt[lang]), img(k, alt[lang], '(min-width: 760px) 33vw, 50vw')) for k, _, cap, alt in C.FUND_PHOTOS)) +
        '<section class="band on-white" id="past"><div class="wrap"><h2>%s</h2><ul class="posters mt2" data-lb-group>%s</ul></div></section>\n'
        % (e(T['past_h']), ''.join(posters)) +
        '<section class="band on-green"><div class="wrap cta"><div><h2>%s</h2><p class="lede mb0">%s</p></div><div class="btns">%s</div></div></section>\n'
        % (e(T['host_h']), e(T['host_p']), btn(url('contact', lang), T['host_btn'])) + seed_script())
    return page(lang, 'events', T['title'], T['desc'], body)

def press(lang):
    en = lang == 'en'
    T = {
        'title': 'Press' if en else 'Presse', 'h1': 'In the news' if en else 'Dans les médias',
        'desc': 'Welfare Avenue in the news: CBC News, CTV News and interviews about our youth-powered work in Montreal.' if en else
                'Welfare Avenue dans les médias : CBC News, CTV News et des entrevues sur notre travail porté par les jeunes à Montréal.',
        'lede': 'Stories about Welfare Avenue and the volunteers who make it run.' if en else 'Des reportages sur Welfare Avenue et les bénévoles qui le font vivre.',
        'media_h': 'For media' if en else 'Pour les médias',
        'media_p': 'For interviews, photos or our logo, write to us and we will get back to you quickly.' if en else 'Pour une entrevue, des photos ou notre logo, écrivez-nous et nous vous répondrons rapidement.',
        'play': 'Play the video' if en else 'Lire la vidéo',
    }
    cards = []
    for pi, p in enumerate(C.PRESS):
        src = p['src'][lang] if isinstance(p['src'], dict) else p['src']
        vid = ('<div class="video"><button type="button" data-yt="%s" aria-label="%s%s%s"><img src="https://i.ytimg.com/vi/%s/hqdefault.jpg" alt="" width="480" height="360"%s>'
               '<span class="play" aria-hidden="true"></span></button></div>' % (p['yt'], e(T['play']), ': ' if en else ' : ', e(p['title'][lang]), p['yt'], ' fetchpriority="high"' if pi == 0 else ' loading="lazy"'))
        link = ('<p><a href="%s" rel="noopener">%s</a></p>' % (e(p['url']), e(p['link'][lang]))) if p.get('url') and p.get('link') else ''
        cards.append('<article>%s<p class="src">%s</p><h3>%s</h3><p>%s</p>%s</article>' % (vid, e(src), e(p['title'][lang]), e(p['text'][lang]), link))
    body = (hero(h1(T['h1']), T['lede'], '2022-06-media-interview-b', alt_of('2022-06-media-interview-b', lang)) +
        '<section class="band on-white"><div class="wrap"><h2 class="sr">%s</h2><div class="press">%s</div></div></section>\n' % (e('News stories' if en else 'Reportages'), ''.join(cards)) +
        '<section class="band on-grey"><div class="wrap split"><div><h2>%s</h2><p class="mt1">%s</p><p><a href="mailto:%s">%s</a></p><div class="btns">%s</div></div><div class="pic">%s</div></div></section>\n'
        % (e(T['media_h']), e(T['media_p']), C.EMAIL, C.EMAIL, btn('mailto:' + C.EMAIL, 'Write to us' if en else 'Écrivez-nous'),
           img('2021-11-volunteer-portrait-blue-beanie', alt_of('2021-11-volunteer-portrait-blue-beanie', lang))))
    return page(lang, 'press', T['title'], T['desc'], body)

def contact(lang):
    en = lang == 'en'
    T = {
        'title': 'Contact us' if en else 'Nous joindre',
        'desc': 'Contact Welfare Avenue about volunteering, partnerships, media or donations, and sign up for our newsletter.' if en else
                'Écrivez à Welfare Avenue au sujet du bénévolat, des partenariats, des médias ou des dons, et abonnez-vous à notre infolettre.',
        'lede': 'Questions, partnerships, media or a group that wants to serve: we read every message.' if en else
                'Questions, partenariats, médias ou un groupe qui veut servir : nous lisons chaque message.',
        'form_h': 'Write to us' if en else 'Écrivez-nous',
        'form_fb': 'Write to us at' if en else 'Écrivez-nous à',
        'direct_h': 'Or reach us directly' if en else 'Ou joignez-nous directement',
        'email': 'Email' if en else 'Courriel', 'phone': 'Phone' if en else 'Téléphone', 'social': 'Social media' if en else 'Réseaux sociaux',
        'partner_h': 'Partners and sponsors' if en else 'Partenaires et commanditaires',
        'partner_p': 'Invest in youth-powered, measurable impact. We build partnerships with visibility and a clear report of what your support made possible.' if en else
                     'Investissez dans un impact mesurable, porté par les jeunes. Nous bâtissons des partenariats qui offrent de la visibilité, avec un compte rendu clair de ce que votre soutien a rendu possible.',
    }
    soc = ''.join('<li><a href="%s" rel="noopener">%s</a></li>' % (e(h), e(n)) for n, h in C.SOCIAL)
    body = (hero(h1(T['title']), T['lede'], '2021-11-two-volunteers-at-the-tent', alt_of('2021-11-two-volunteers-at-the-tent', lang)) +
        '<section class="band on-white"><div class="wrap split top"><div><h2 class="sr">' + e('Contact form' if en else 'Formulaire de contact') + '</h2>%s</div><div><h2>%s</h2><h3 class="mt2">%s</h3><p><a href="mailto:%s">%s</a></p>'
        '<h3 class="mt2">%s</h3><p>%s</p>'
        '<h3 class="mt2">%s</h3><ul class="chips">%s</ul><p class="mt2"><a href="%s" rel="noopener">%s</a></p>'
        '<div class="card mt3"><h3>%s</h3><p class="mb0">%s</p></div></div></div></section>\n'
        % (form_box('contact' if en else 'nous-joindre,contact', '<h3>%s</h3><p class="waf-note">%s %s.</p>' % (e(T['form_h']), e(T['form_fb']), mail(lang)), lang),
           e(T['direct_h']), e(T['email']), C.EMAIL, C.EMAIL, e(T['phone']), phone(lang), e(T['social']), soc, e(C.REVIEW), e(C.UI[lang]['review']), e(T['partner_h']), e(T['partner_p'])) +
        newsletter_band(lang, '2024-07-summer-salad-trays'))
    return page(lang, 'contact', T['title'], T['desc'], body)

def donate(lang):
    en = lang == 'en'
    T = {
        'title': 'Donate' if en else 'Faire un don',
        'desc': 'Give to Welfare Avenue, a youth-powered registered charity: your gift supports home-cooked meals, essentials and a pathway to support in Montreal and Toronto.' if en else
                'Donnez à Welfare Avenue, un organisme de bienfaisance enregistré porté par les jeunes : votre don soutient des repas maison, des essentiels et un chemin vers le soutien à Montréal et à Toronto.',
        'lede': 'Your gift turns into home-cooked meals every second Sunday and essentials all year. Thank you for standing with our community.' if en else
                'Votre don devient des repas maison un dimanche sur deux et des articles essentiels toute l’année. Merci d’être aux côtés de notre communauté.',
        'hero_btn': 'Donate' if en else 'Faire un don',
        'figs_h': 'Our impact' if en else 'Notre impact',
        'make_over': 'Make a donation' if en else 'Faire un don',
        'what_h': 'What your gift makes possible' if en else 'Ce que votre don rend possible',
        'give_h': 'Give online' if en else 'Donner en ligne',
        'give_p': 'Give once, or every month to keep it steady. It takes a minute, securely through Stripe, without leaving this page.' if en else
                  'Donnez une fois, ou chaque mois pour un soutien constant. Cela prend une minute, de façon sécurisée avec Stripe, sans quitter cette page.',
        'facts': (['Once, or every month', 'Choose your amount', 'Secure payment through Stripe'] if en else
                  ['Une fois, ou chaque mois', 'Le montant de votre choix', 'Paiement sécurisé avec Stripe']),
        'give_btn': 'Give now' if en else 'Donner maintenant',
        'ess_h': 'Give essentials' if en else 'Donner des essentiels',
        'ess_p': 'We welcome new or gently used warm clothing, hygiene products and non-perishable food. Write to us to arrange a drop-off.' if en else
                 'Nous acceptons des vêtements chauds neufs ou en bon état, des produits d’hygiène et des aliments non périssables. Écrivez-nous pour organiser un dépôt.',
        'corp_h': 'Companies and foundations' if en else 'Entreprises et fondations',
        'corp_p': 'Invest in youth-powered, measurable impact, from sponsoring a serving to a season-long partnership.' if en else
                  'Investissez dans un impact mesurable, porté par les jeunes, de la commandite d’un service à un partenariat d’une saison.',
        'talk': 'Talk to us' if en else 'Parlons-en',
    }
    # www3 (01/10/26): the amounts, costed from the Hub's grocery orders and the 2026 recipe book (content.LADDER)
    ladder = ''.join('<li><b>%s</b><span><strong>%s</strong>%s</span></li>' % (e(a), e(t), e(d)) for a, t, d in C.LADDER[lang])
    facts = ''.join('<li>%s</li>' % e(f) for f in T['facts'])
    body = (hero(h1(T['title']), T['lede'], '2023-05-spring-crew-under-the-tent', alt_of('2023-05-spring-crew-under-the-tent', lang),
                 btn(give(lang), T['hero_btn'], donate=True)) +
        '<section class="band on-white"><div class="wrap"><h2 class="sr">%s</h2>%s%s</div></section>\n' % (e(T['figs_h']), figs(lang, C.STATS_DONATE[lang], 'six'), stats_note(lang)) +
        '<section class="band on-grey" id="give"><div class="wrap split"><div><p class="over">%s</p><h2>%s</h2><ul class="ladder">%s</ul><p class="fine mt2">%s</p></div>'
        '<div class="givebox"><h3>%s</h3><p>%s</p><ul class="facts">%s</ul>%s<p class="fine">%s</p></div></div></section>\n'
        % (e(T['make_over']), e(T['what_h']), ladder, e(C.LADDER_NOTE[lang]), e(T['give_h']), e(T['give_p']), facts, btn(give(lang), T['give_btn'], donate=True), e(receipt_line(lang))) +
        '<section class="band on-white" id="essentials"><div class="wrap cards2"><div class="card"><h2>%s</h2><p>%s</p><div class="btns">%s</div></div>'
        '<div class="card"><h2>%s</h2><p>%s</p><div class="btns">%s</div></div></div></section>\n'
        % (e(T['ess_h']), e(T['ess_p']), btn(url('contact', lang), T['talk'], 'ghost'), e(T['corp_h']), e(T['corp_p']), btn(url('contact', lang), T['talk'], 'ghost')))
    return page(lang, 'donate', T['title'], T['desc'], body)

def account(lang):
    """wave194 (02/10/26): the account page. The page is a slim green band and the box that assets/account.js fills: signing
    in (Google or a code by email), then the profile. Never indexed, not in the sitemap."""
    en = lang == 'en'
    T = {'title': 'Your account' if en else 'Votre compte',
         'desc': ('Sign in to your Welfare Avenue account: your volunteering, your gifts and receipts, and your email preferences.' if en else
                  'Connectez-vous à votre compte Welfare Avenue : votre bénévolat, vos dons et vos reçus, et vos préférences de courriel.'),
         'loading': 'Loading your account…' if en else 'Chargement de votre compte…',
         'noscript': 'Your account needs JavaScript. You can write to us at' if en else 'Votre compte a besoin de JavaScript. Vous pouvez nous écrire à'}
    body = ('<section class="acct-top"><div class="wrap"><p class="over">Welfare Avenue</p><h1>%s</h1></div></section>\n'
            '<section class="band on-grey acct-band"><div class="wrap"><div class="acct" id="acct"><p class="loading">%s</p>'
            '<noscript><p>%s %s.</p></noscript></div></div></section>\n'
            % (e(T['title']), e(T['loading']), e(T['noscript']), mail(lang)))
    return page(lang, 'account', T['title'], T['desc'], body)

def privacy(lang):
    """wave194 (02/10/26): the privacy notice (content.PRIVACY), linked from every page's footer, the forms, the account page
    and Google's sign-in screen."""
    P = C.PRIVACY[lang]
    links = {'{email}': mail(lang), '{phone}': '<a href="sms:%s">%s</a>' % (C.PHONE['tel'], e(C.PHONE[lang]))}
    def fill(s):
        out = e(s)
        for k, v in links.items(): out = out.replace(k, v)
        return out
    secs = ''.join('<h2>%s</h2>%s%s' % (e(h), ''.join('<p>%s</p>' % fill(x) for x in ps), ('<ul>%s</ul>' % ''.join('<li>%s</li>' % fill(x) for x in items)) if items else '')
                   for h, ps, items in P['sections'])
    body = ('<section class="acct-top"><div class="wrap"><p class="over">Welfare Avenue</p><h1>%s</h1></div></section>\n'
            '<section class="band on-white"><div class="wrap"><div class="doc"><p class="upd">%s</p><p class="lede">%s</p>%s</div></div></section>\n'
            % (e(P['title']), e(C.PRIVACY_UPDATED[lang]), e(P['intro']), secs))
    return page(lang, 'privacy', P['title'], P['desc'], body)

def notfound():
    body = ('<section class="band on-white notfound"><div class="wrap"><p class="over">404</p><h1>Page not found</h1>'
            '<p class="lede mt1">The page you are looking for has moved or no longer exists. <span lang="fr">La page que vous cherchez a été déplacée ou n’existe plus.</span></p>'
            '<div class="btns">%s%s</div></div></section>\n' % (btn('/', 'Home'), btn('/fr/', 'Accueil', 'ghost')))
    return head('en', '404', 'Page not found', 'Welfare Avenue') .replace('<link rel="canonical" href="https://welfareavenue.com/">\n', '') + header('en', '404').replace(' aria-current="page"', '') + body + footer('en')

# ---------- build ----------
BUILDERS = {'home': home, 'about': about, 'volunteer': volunteer, 'events': events, 'press': press, 'contact': contact, 'donate': donate,
            'account': account, 'privacy': privacy, 'join': join}
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
    ('/thank-you-newsletter', '/'), ('/signup', '/volunteer/'), ('/confirm-participation', '/volunteer/'),
    # wave194: the old website's account pages open the new account page (old accounts connect by their email)
    ('/signin', '/account/'), ('/user-profile', '/account/'), ('/password-reset/*', '/account/'), ('/reset-password/*', '/account/'),
    ('/login', '/account/'), ('/profile', '/account/'),
    ('/gallery', '/events/#photos'), ('/give', C.GIVE), ('/fr/donate', '/fr/donner/'),
    ('/activities', '/events/'), ('/fr/activites', '/fr/evenements/'),
    # wave216: the usual addresses for jobs
    ('/careers', '/join/'), ('/jobs', '/join/'), ('/fr/carrieres', '/fr/rejoindre/'), ('/fr/emplois', '/fr/rejoindre/'),
]
put('_redirects', '# Welfare Avenue website (wave162, www2): the old website\'s addresses\n' + ''.join('%s  %s  301\n' % (a, b) for a, b in REDIRECTS))

# wave194: Google's sign-in button (Google Identity Services: its script, its styles, its frame and its calls) for the account page
CSP = ("default-src 'self'; script-src 'self' https://hub.welfareavenue.com https://accounts.google.com/gsi/client; "
       "style-src 'self' https://fonts.googleapis.com https://hub.welfareavenue.com https://accounts.google.com/gsi/style; font-src https://fonts.gstatic.com; "
       "img-src 'self' data: https://zwnmulmnvopclzcvytce.supabase.co https://i.ytimg.com; connect-src 'self' https://zwnmulmnvopclzcvytce.supabase.co https://accounts.google.com/gsi/; "
       "frame-src https://www.youtube-nocookie.com https://hub.welfareavenue.com https://www.linkedin.com https://accounts.google.com/gsi/; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests")
HEADERS = ('# Welfare Avenue website (wave162): security headers for every page. One CSP for the whole site.\n/*\n'
           '  Content-Security-Policy: ' + CSP + '\n'
           '  Strict-Transport-Security: max-age=31536000\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n'
           '  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self \"https://hub.welfareavenue.com\")\n'
           + ('' if LAUNCH else '  X-Robots-Tag: noindex\n') +
           '/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/img/*\n  Cache-Control: public, max-age=604800\n'
           '/static/react/*\n  Cache-Control: no-cache\n')
put('_headers', HEADERS)

# www3 (02/10/26), after the switch from George's site: browsers that kept the old site's page in their cache (it was
# served without Cache-Control, so a browser may keep it for days) ask this address for the old site's script and showed
# a blank screen. The script that now answers there asks the network for the page once more and reloads into the new
# site (once per page and tab; a ?wa_r=1 mark stands in when the browser keeps no session storage). The old stylesheet's address
# answers with an empty stylesheet so the old page fails quietly while it reloads.
OLD_SCRIPT = ('/* Welfare Avenue: the old website\'s script lived here until 02/10/26. A browser still showing the old page from its\n'
              '   cache lands here: it fetches the page again and reloads into the new site, once. */\n'
              '(function () {\n'
              '  var key = "wa_old_site_reload:" + window.location.pathname + window.location.search, url = window.location.href, marked = /[?&]wa_r=1(&|$)/.test(window.location.search), store = true;\n'
              '  try { if (window.sessionStorage.getItem(key)) return; window.sessionStorage.setItem(key, "1"); } catch (e) { store = false; }\n'
              '  if (!store && marked) return;\n'
              '  function go() {\n'
              '    if (store) { window.location.reload(); return; }\n'
              '    var l = window.location; l.replace(l.pathname + l.search + (l.search ? "&" : "?") + "wa_r=1" + l.hash);\n'
              '  }\n'
              '  try { window.fetch(url, { cache: "reload", credentials: "same-origin" }).then(go, go); } catch (e) { go(); }\n'
              '})();\n')
put('static/react/static/js/main.35bf1a94.js', OLD_SCRIPT)
put('static/react/static/css/main.aaf83bf2.css', '/* Welfare Avenue: the old website\'s stylesheet lived here until 02/10/26. */\n')
if LAUNCH:
    put('robots.txt', 'User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n' % SITE)
else:
    put('robots.txt', '# Preview: not for search engines yet\nUser-agent: *\nDisallow: /\n')
urls = []
for key in BUILDERS:
    if key == 'account': continue  # the account page is never indexed
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
