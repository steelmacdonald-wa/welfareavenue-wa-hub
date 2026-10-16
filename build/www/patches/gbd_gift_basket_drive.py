#!/usr/bin/env python3
"""15/10/26 - The Holiday Gift Basket Drive page (Steel's promise to Amanda Zoldak's fundraising team, 15/10/26 meeting).

Since 09/10/26 the live files are the website's source (build/www/LIVE_IS_SOURCE.md), so this patch works on a copy of the
live files (pulled from www_files) and writes:
  gift-basket-drive/index.html     the English page (new)
  fr/paniers-cadeaux/index.html    the French page (new)
  assets/drive.css, assets/drive.js  the campaign page's styles and its progress block (new; this script only stamps their
                                   ?v= from the files in build/www/live/assets/)
  events/index.html, fr/evenements/index.html  the Holiday Gift Basket Drive card in "Fundraisers coming up" links to the page
  sitemap.xml                      the two new pages
The header, menu and footer are copied from the live Donate pages (donate/, fr/donner/), so they match every other page.

Usage: python3 build/www/patches/gbd_gift_basket_drive.py <dir with the live files> <out dir>
Every donate button on the page carries data-wa-campaign="gift-basket-drive": give/embed.js opens the Hub's donation page with
?c=gift-basket-drive, which locks the gift to the drive and tags it with the campaign (donate v5, app_config donate_campaigns).
"""
import hashlib, os, re, sys

SRC, OUT = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'live', 'assets')
SLUG = 'gift-basket-drive'
HUB_GIVE = 'https://hub.welfareavenue.com/give/?c=' + SLUG
MAIL = 'info@welfareavenue.com'


def rd(p):
    return open(os.path.join(SRC, p), encoding='utf8').read()


def wr(p, s):
    full = os.path.join(OUT, p)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, 'w', encoding='utf8').write(s)
    print('wrote', p, len(s.encode('utf8')), hashlib.md5(s.encode('utf8')).hexdigest())


def ver(name):
    return hashlib.md5(open(os.path.join(ASSETS, name), 'rb').read()).hexdigest()[:8]


def one(s, old, new):
    assert s.count(old) == 1, (old[:100], s.count(old))
    return s.replace(old, new)


AR = ('<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" '
      'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg>')


def ic(paths):
    return ('<svg class="dd-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" '
            'stroke-width="1.8" stroke-linecap="square">' + paths + '</g></svg>')


IC_GIFT = ic('<rect x="3.5" y="8.5" width="17" height="4"/><path d="M5 12.5v8h14v-8M12 8.5v12"/>'
             '<path d="M12 8.5C10.5 5 6.5 4.3 6.5 6.9c0 1.6 3 1.6 5.5 1.6zM12 8.5c1.5-3.5 5.5-4.2 5.5-1.6 0 1.6-3 1.6-5.5 1.6z"/>')
IC_HEART = ic('<path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.4 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>')
IC_WRAP = ic('<circle cx="6.5" cy="17.5" r="2.5"/><circle cx="6.5" cy="6.5" r="2.5"/><path d="M8.6 8 20 18M8.6 16 20 6"/>')


def donate_btn(label, cls='btn', lang=''):
    href = HUB_GIVE + ('&amp;lang=fr' if lang == 'fr' else '')
    return ('<a class="' + cls + '" href="' + href + '" data-wa-donate data-wa-campaign="' + SLUG + '">' + label + AR + '</a>')


def img(name, w, h, alt, sizes, big=True, extra=''):
    sets = ['/img/' + name + '-480.jpg 480w', '/img/' + name + '-960.jpg 960w'] + (['/img/' + name + '-1600.jpg 1600w'] if big else [])
    return ('<img src="/img/' + name + '-960.jpg" srcset="' + ', '.join(sets) + '" sizes="' + sizes + '" width="' + str(w) +
            '" height="' + str(h) + '" alt="' + alt + '"' + extra + '>')


# the five photos of the 2025 drive (Photo library 102 to 110, all marked ready; alt text from the library)
PHOTOS = [
    ('2025-12-gift-baskets-the-crew', 1600, 1200, True,
     'About twenty volunteers hold up wrapped gifts behind tables in a bright room with city windows.', 'The gift basket crew, December 2025',
     'Une vingtaine de bénévoles brandissent des cadeaux emballés derrière des tables, dans une salle lumineuse aux grandes fenêtres.', 'L’équipe de la collecte, décembre 2025'),
    ('2025-12-gift-baskets-wrapping', 960, 1280, False,
     'Volunteers sit on the floor wrapping gifts beside large windows and stacks of boxes.', 'Wrapping gifts, December 2025',
     'Des bénévoles assis par terre emballent des cadeaux près de grandes fenêtres et de piles de boîtes.', 'L’emballage des cadeaux, décembre 2025'),
    ('2025-12-gift-baskets-bags', 960, 1707, False,
     'Brown paper gift bags filled with presents line a green table.', 'Gift bags ready to go, December 2025',
     'Des sacs-cadeaux en papier brun remplis de présents s’alignent sur une table verte.', 'Des sacs-cadeaux prêts à partir, décembre 2025'),
    ('2025-12-gift-baskets-elf-hat', 960, 1280, False,
     'A smiling volunteer in a green elf hat holds up a wrapped gift.', 'A volunteer in an elf hat, December 2025',
     'Une bénévole souriante coiffée d’un bonnet de lutin vert tient un cadeau emballé.', 'Une bénévole en bonnet de lutin, décembre 2025'),
    ('2025-12-gift-baskets-delivery', 1600, 1204, True,
     'Five volunteers stand with carts piled high with gift bags in a lobby.', 'Gifts delivered, December 2025',
     'Cinq bénévoles posent dans un hall avec des chariots remplis de sacs-cadeaux.', 'Les cadeaux livrés, décembre 2025'),
]


def gallery(fr):
    out = []
    for name, w, h, big, alt_en, t_en, alt_fr, t_fr in PHOTOS:
        alt, title = (alt_fr, t_fr) if fr else (alt_en, t_en)
        full = '/img/' + name + ('-1600.jpg' if big else '-960.jpg')
        out.append('<button type="button" data-full="' + full + '" data-title="' + title + '" data-alt="' + alt + '">' +
                   img(name, w, h, alt, '(min-width: 860px) 20vw, 50vw', big, ' loading="lazy" decoding="async"') + '</button>')
    return '<div class="gallery drg mt2" data-lb-group>' + ''.join(out) + '</div>'


EN = {
    'title': 'Holiday Gift Basket Drive · Welfare Avenue',
    'desc': 'Every December, Welfare Avenue volunteers fill, wrap and hand-deliver holiday gifts across Montreal. This year we are aiming for 6,000 gifts: give, donate essentials or wrap with us.',
    'path': '/gift-basket-drive/', 'other': '/fr/paniers-cadeaux/', 'locale': 'en_CA',
}
FRW = {
    'title': 'Collecte de paniers-cadeaux des Fêtes · Welfare Avenue',
    'desc': 'Chaque décembre, les bénévoles de Welfare Avenue remplissent, emballent et livrent des cadeaux partout à Montréal. Cette année, nous visons 6 000 cadeaux : donnez, offrez des articles ou venez emballer avec nous.',
    'path': '/fr/paniers-cadeaux/', 'other': '/gift-basket-drive/', 'locale': 'fr_CA',
}


def main_en():
    hero = ('<section class="hero page"><div class="bg">' +
            img('2025-12-gift-baskets-the-crew', 1600, 1200, 'About twenty volunteers hold up wrapped gifts behind tables in a bright room with city windows.', '100vw', True, ' fetchpriority="high"') +
            '</div><div class="wrap"><p class="over">December 2026 · Montreal</p><h1>Holiday Gift Basket Drive</h1>'
            '<p class="lede">Every December, our volunteers fill, wrap and hand-deliver holiday gifts across Montreal. This year, for our third drive, we’re aiming for 6,000 gifts. Come be part of it.</p>'
            '<div class="btns">' + donate_btn('Give to the drive') + '<a class="btn ghost" href="#ways">Ways to get involved' + AR + '</a></div></div></section>')
    progress = ('<section class="band on-white" id="progress"><div class="wrap drp">'
                '<div class="drp-goal"><p class="over">Our goal this year</p><p class="drp-big">6,000</p><p>gifts, wrapped and hand-delivered across Montreal</p>'
                '<p class="fine">Last year: more than 3,000 gifts. The year before: more than 1,500.</p></div>'
                '<div class="drp-card" data-campaign="' + SLUG + '" aria-live="polite"><p class="over">So far this year</p>'
                '<p class="drp-raised"><b data-dr="raised">$0</b><span>given to the drive</span></p>'
                '<div class="drp-bar" data-dr="bar" role="progressbar" aria-label="Toward our goal" aria-valuemin="0" aria-valuemax="100" hidden><span data-dr="fill"></span></div>'
                '<p class="drp-people" data-dr="people">Be one of the first to give to this year’s drive.</p>' +
                donate_btn('Give to the drive') +
                '<p class="fine">Secure, through Stripe, without leaving this page. The total updates as gifts come in.</p></div></div></section>')
    about = ('<section class="band on-grey" id="about"><div class="wrap split"><div><p class="over">What the drive is</p><h2>A holiday tradition, three years in</h2>'
             '<p>The Holiday Gift Basket Drive is our biggest moment of the year. Donations come in through November, then our volunteers gather in December to wrap everything and hand-deliver it before the holidays.</p>'
             '<p>Cozy socks, warm hats, toys and care packages go to guests at Montreal shelters and to young patients in hospital, a small reminder that someone was thinking of them.</p>'
             '<p>Since 2024, we’ve run the drive with our partners at Scattered: more than 1,500 gifts that first year, then more than 3,000 last year.</p></div>'
             '<div class="pic">' + img('2025-12-gift-baskets-delivery', 1600, 1204, 'Five volunteers stand with carts piled high with gift bags in a lobby.', '(min-width: 900px) 50vw, 100vw', True, ' loading="lazy" decoding="async"') +
             '</div></div></section>')
    ways = ('<section class="band on-white drw" id="ways"><div class="wrap"><div class="ihead"><h2>Three ways to get involved</h2></div><ul class="ways">'
            '<li class="way"><p class="way-k">' + IC_GIFT + '<span>In kind</span></p><h3>Donate gifts and essentials</h3>'
            '<p>Clothing can be gently used. Hygiene essentials and toys must be brand new, so every gift feels like a gift.</p>'
            '<p class="fine">We’re collecting donations from mid-November to the end of November.</p>'
            '<a class="textlink" href="mailto:' + MAIL + '?subject=Holiday%20Gift%20Basket%20Drive%3A%20donating%20items">Write to us to give items' + AR + '</a></li>'
            '<li class="way"><p class="way-k">' + IC_HEART + '<span>Online</span></p><h3>Make a donation</h3>'
            '<p>Your gift goes straight to the Holiday Gift Basket Drive. It takes a minute, without leaving this page.</p>'
            '<p class="fine">Secure payment through Stripe.</p>' +
            donate_btn('Give to the drive', 'textlink') + '</li>'
            '<li class="way"><p class="way-k">' + IC_WRAP + '<span>Volunteer</span></p><h3>Wrap with us</h3>'
            '<p>Join our gift-wrapping event in December: good music, good company and a lot of tape.</p>'
            '<p class="fine">Dates are coming soon.</p>'
            '<a class="textlink" href="/volunteer/">Volunteer with us' + AR + '</a></li>'
            '</ul></div></section>')
    timeline = ('<section class="band on-grey" id="timeline"><div class="wrap"><h2>How the season runs</h2><ol class="drt mt2">'
                '<li><h3>Mid to end of November</h3><p>Donations of gifts, essentials and funds come in.</p></li>'
                '<li><h3>December</h3><p>Our gift-wrapping event, over one or two weekends. Dates are coming soon.</p></li>'
                '<li><h3>Before the holidays</h3><p>Volunteers hand-deliver the gifts across Montreal.</p></li>'
                '</ol></div></section>')
    partners = ('<section class="band on-white" id="sponsors"><div class="wrap cards2">'
                '<div class="card"><h2>Companies and sponsors</h2><p>Businesses help by donating products or wrapping supplies, or by bringing their team to wrap with us. Write to us and we’ll send you our sponsorship package.</p>'
                '<div class="btns"><a class="btn ghost" href="mailto:' + MAIL + '?subject=Holiday%20Gift%20Basket%20Drive%3A%20sponsorship">Write to us' + AR + '</a></div></div>'
                '<div class="card"><h2>Schools and groups</h2><p>Bring your class, club or team to help collect donations or wrap gifts. Tell us about your group and we’ll find the right fit.</p>'
                '<div class="btns"><a class="btn ghost" href="/volunteer/#groups">Bring your group' + AR + '</a></div></div>'
                '</div></section>')
    photos = ('<section class="band on-grey" id="photos"><div class="wrap"><h2>Last year’s drive</h2><p class="maxw mt1">December 2025, Montreal.</p>' + gallery(False) + '</div></section>')
    cta = ('<section class="band on-green"><div class="wrap cta"><div><h2>Help us reach 6,000 gifts</h2>'
           '<p class="lede mb0">Share this page with friends, family and your team. Every gift, big or small, ends up in someone’s hands this December.</p></div>'
           '<div class="btns">' + donate_btn('Give to the drive') + '<a class="btn ghost" href="/volunteer/">Volunteer with us' + AR + '</a></div></div></section>')
    return '<main id="main">\n' + '\n'.join([hero, progress, about, ways, timeline, partners, photos, cta]) + '\n</main>'


def main_fr():
    hero = ('<section class="hero page"><div class="bg">' +
            img('2025-12-gift-baskets-the-crew', 1600, 1200, 'Une vingtaine de bénévoles brandissent des cadeaux emballés derrière des tables, dans une salle lumineuse aux grandes fenêtres.', '100vw', True, ' fetchpriority="high"') +
            '</div><div class="wrap"><p class="over">Décembre 2026 · Montréal</p><h1>Collecte de paniers-cadeaux des Fêtes</h1>'
            '<p class="lede">Chaque décembre, nos bénévoles remplissent, emballent et livrent des cadeaux partout à Montréal. Pour cette troisième édition, nous visons 6&nbsp;000 cadeaux. Joignez-vous à nous!</p>'
            '<div class="btns">' + donate_btn('Donner à la collecte', lang='fr') + '<a class="btn ghost" href="#ways">Comment participer' + AR + '</a></div></div></section>')
    progress = ('<section class="band on-white" id="progress"><div class="wrap drp">'
                '<div class="drp-goal"><p class="over">Notre objectif cette année</p><p class="drp-big">6&nbsp;000</p><p>cadeaux emballés et livrés partout à Montréal</p>'
                '<p class="fine">L’an dernier : plus de 3&nbsp;000 cadeaux. L’année d’avant : plus de 1&nbsp;500.</p></div>'
                '<div class="drp-card" data-campaign="' + SLUG + '" aria-live="polite"><p class="over">Jusqu’ici cette année</p>'
                '<p class="drp-raised"><b data-dr="raised">0&nbsp;$</b><span>donnés à la collecte</span></p>'
                '<div class="drp-bar" data-dr="bar" role="progressbar" aria-label="Vers notre objectif" aria-valuemin="0" aria-valuemax="100" hidden><span data-dr="fill"></span></div>'
                '<p class="drp-people" data-dr="people">Soyez parmi les premiers à donner à la collecte cette année.</p>' +
                donate_btn('Donner à la collecte', lang='fr') +
                '<p class="fine">Paiement sécurisé par Stripe, sans quitter cette page. Le total se met à jour au fil des dons.</p></div></div></section>')
    about = ('<section class="band on-grey" id="about"><div class="wrap split"><div><p class="over">La collecte en bref</p><h2>Une tradition des Fêtes, déjà trois ans</h2>'
             '<p>La collecte de paniers-cadeaux des Fêtes, c’est notre plus grand moment de l’année. Les dons arrivent en novembre, puis nos bénévoles se réunissent en décembre pour tout emballer et livrer les cadeaux avant les Fêtes.</p>'
             '<p>Bas douillets, tuques chaudes, jouets et trousses de soins vont aux personnes accueillies dans les refuges de Montréal et à de jeunes patients à l’hôpital, un petit rappel que quelqu’un a pensé à eux.</p>'
             '<p>Depuis 2024, nous organisons la collecte avec nos partenaires de Scattered : plus de 1&nbsp;500 cadeaux la première année, puis plus de 3&nbsp;000 l’an dernier.</p></div>'
             '<div class="pic">' + img('2025-12-gift-baskets-delivery', 1600, 1204, 'Cinq bénévoles posent dans un hall avec des chariots remplis de sacs-cadeaux.', '(min-width: 900px) 50vw, 100vw', True, ' loading="lazy" decoding="async"') +
             '</div></div></section>')
    ways = ('<section class="band on-white drw" id="ways"><div class="wrap"><div class="ihead"><h2>Trois façons de participer</h2></div><ul class="ways">'
            '<li class="way"><p class="way-k">' + IC_GIFT + '<span>En nature</span></p><h3>Donner des cadeaux et des articles</h3>'
            '<p>Les vêtements peuvent être usagés, en bon état. Les articles d’hygiène et les jouets doivent être neufs, pour que chaque cadeau en soit vraiment un.</p>'
            '<p class="fine">Nous recueillons les dons de la mi-novembre à la fin novembre.</p>'
            '<a class="textlink" href="mailto:' + MAIL + '?subject=Collecte%20de%20paniers-cadeaux%20%3A%20don%20d%E2%80%99articles">Écrivez-nous pour donner des articles' + AR + '</a></li>'
            '<li class="way"><p class="way-k">' + IC_HEART + '<span>En ligne</span></p><h3>Faire un don</h3>'
            '<p>Votre don va directement à la collecte de paniers-cadeaux des Fêtes. Ça prend une minute, sans quitter cette page.</p>'
            '<p class="fine">Paiement sécurisé par Stripe.</p>' +
            donate_btn('Donner à la collecte', 'textlink', lang='fr') + '</li>'
            '<li class="way"><p class="way-k">' + IC_WRAP + '<span>Bénévolat</span></p><h3>Emballer avec nous</h3>'
            '<p>Joignez-vous à notre événement d’emballage de cadeaux en décembre : de la bonne musique, du bon monde et beaucoup de ruban adhésif.</p>'
            '<p class="fine">Les dates seront annoncées bientôt.</p>'
            '<a class="textlink" href="/fr/benevolat/">Faire du bénévolat avec nous' + AR + '</a></li>'
            '</ul></div></section>')
    timeline = ('<section class="band on-grey" id="timeline"><div class="wrap"><h2>Le déroulement de la saison</h2><ol class="drt mt2">'
                '<li><h3>De la mi-novembre à la fin novembre</h3><p>Les dons de cadeaux, d’articles et d’argent arrivent.</p></li>'
                '<li><h3>Décembre</h3><p>Notre événement d’emballage, sur une ou deux fins de semaine. Les dates seront annoncées bientôt.</p></li>'
                '<li><h3>Avant les Fêtes</h3><p>Nos bénévoles livrent les cadeaux partout à Montréal.</p></li>'
                '</ol></div></section>')
    partners = ('<section class="band on-white" id="sponsors"><div class="wrap cards2">'
                '<div class="card"><h2>Entreprises et commanditaires</h2><p>Les entreprises peuvent donner des produits ou du matériel d’emballage, ou venir emballer en équipe avec nous. Écrivez-nous et nous vous enverrons notre trousse de commandite.</p>'
                '<div class="btns"><a class="btn ghost" href="mailto:' + MAIL + '?subject=Collecte%20de%20paniers-cadeaux%20%3A%20commandite">Nous écrire' + AR + '</a></div></div>'
                '<div class="card"><h2>Écoles et groupes</h2><p>Venez recueillir des dons ou emballer des cadeaux avec votre classe, votre club ou votre équipe. Parlez-nous de votre groupe et nous trouverons la bonne formule.</p>'
                '<div class="btns"><a class="btn ghost" href="/fr/benevolat/#groups">Inscrire votre groupe' + AR + '</a></div></div>'
                '</div></section>')
    photos = ('<section class="band on-grey" id="photos"><div class="wrap"><h2>La collecte de l’an dernier</h2><p class="maxw mt1">Décembre 2025, Montréal.</p>' + gallery(True) + '</div></section>')
    cta = ('<section class="band on-green"><div class="wrap cta"><div><h2>Aidez-nous à atteindre 6&nbsp;000 cadeaux</h2>'
           '<p class="lede mb0">Partagez cette page avec vos proches et votre équipe. Chaque don, petit ou grand, se retrouvera entre les mains de quelqu’un en décembre.</p></div>'
           '<div class="btns">' + donate_btn('Donner à la collecte', lang='fr') + '<a class="btn ghost" href="/fr/benevolat/">Faire du bénévolat' + AR + '</a></div></div></section>')
    html = '<main id="main">\n' + '\n'.join([hero, progress, about, ways, timeline, partners, photos, cta]) + '\n</main>'
    return html.replace(' : ', '&nbsp;: ')  # French typography: no line break before a colon


def page(template_path, w, main_html, fr):
    s = rd(template_path)
    head_end = s.index('</head>')
    head, rest = s[:head_end], s[head_end:]
    # head: title, description, canonical, alternates, Open Graph (the drive's own photo for shared links), the page's assets
    head = re.sub(r'<title>[^<]*</title>', '<title>' + w['title'] + '</title>', head, count=1)
    head = re.sub(r'(<meta name="description" content=")[^"]*', lambda m: m.group(1) + w['desc'], head, count=1)
    head = re.sub(r'(<meta property="og:description" content=")[^"]*', lambda m: m.group(1) + w['desc'], head, count=1)
    head = re.sub(r'(<meta property="og:title" content=")[^"]*', lambda m: m.group(1) + w['title'], head, count=1)
    en_url, fr_url = 'https://welfareavenue.com/gift-basket-drive/', 'https://welfareavenue.com/fr/paniers-cadeaux/'
    head = re.sub(r'<link rel="canonical" href="[^"]*">', '<link rel="canonical" href="https://welfareavenue.com' + w['path'] + '">', head, count=1)
    head = re.sub(r'<link rel="alternate" hreflang="en" href="[^"]*">', '<link rel="alternate" hreflang="en" href="' + en_url + '">', head, count=1)
    head = re.sub(r'<link rel="alternate" hreflang="fr" href="[^"]*">', '<link rel="alternate" hreflang="fr" href="' + fr_url + '">', head, count=1)
    head = re.sub(r'<link rel="alternate" hreflang="x-default" href="[^"]*">', '<link rel="alternate" hreflang="x-default" href="' + en_url + '">', head, count=1)
    head = re.sub(r'<meta property="og:url" content="[^"]*">', '<meta property="og:url" content="https://welfareavenue.com' + w['path'] + '">', head, count=1)
    head = re.sub(r'<meta property="og:image" content="[^"]*">', '<meta property="og:image" content="https://welfareavenue.com/img/2025-12-gift-baskets-the-crew-1600.jpg">', head, count=1)
    head = one(head, '<meta property="og:image:width" content="1200">', '<meta property="og:image:width" content="1600">')
    head = one(head, '<meta property="og:image:height" content="630">', '<meta property="og:image:height" content="1200">')
    css = re.search(r'<link rel="stylesheet" href="/assets/site\.css\?v=[0-9a-f]+">', head).group(0)
    head = one(head, css, css + '\n<link rel="stylesheet" href="/assets/drive.css?v=' + ver('drive.css') + '">')
    js = re.search(r'<script src="/assets/site\.js\?v=[0-9a-f]+" defer></script>', head).group(0)
    head = one(head, js, js + '\n<script src="/assets/drive.js?v=' + ver('drive.js') + '" defer></script>')
    # body: the Donate button in the header is not this page; the language links point at the twin page
    rest = rest.replace(' aria-current="page" href="https://hub.welfareavenue.com/give', ' href="https://hub.welfareavenue.com/give')
    old_other = '/fr/donner/' if not fr else '/donate/'
    rest = one(rest, '<a class="lang" href="' + old_other + '"', '<a class="lang" href="' + w['other'] + '"')
    if not fr:
        rest = one(rest, '<a href="/fr/donner/" hreflang="fr">', '<a href="' + w['other'] + '" hreflang="fr">')
    a, b = rest.index('<main id="main">'), rest.index('</main>') + len('</main>')
    rest = rest[:a] + main_html + rest[b:]
    out = head + rest
    assert 'aria-current="page"' not in out
    assert '—' not in out, 'no em dashes'
    assert ' style="' not in out and '<script>' not in out, 'CSP: no inline style or script'
    return out


def link_card(path, card_h3, label):
    s = rd(path)
    i = s.index('<h3>' + card_h3 + '</h3>')
    j = s.index('</li>', i)
    assert 'gift-basket-drive' not in s[i:j] and 'paniers-cadeaux' not in s[i:j]
    href = '/gift-basket-drive/' if not path.startswith('fr/') else '/fr/paniers-cadeaux/'
    s = s[:j] + '<a class="textlink" href="' + href + '">' + label + AR + '</a>' + s[j:]
    return s


def sitemap():
    s = rd('sitemap.xml')
    assert 'gift-basket-drive' not in s
    m = re.search(r'<url>(?:(?!</url>).)*?<loc>https://welfareavenue\.com/donate/</loc>.*?</url>', s, re.S)
    assert m, 'donate entry not found in sitemap'
    entry = m.group(0)
    en = entry.replace('https://welfareavenue.com/donate/', 'https://welfareavenue.com/gift-basket-drive/').replace('https://welfareavenue.com/fr/donner/', 'https://welfareavenue.com/fr/paniers-cadeaux/')
    m2 = re.search(r'<url>(?:(?!</url>).)*?<loc>https://welfareavenue\.com/fr/donner/</loc>.*?</url>', s, re.S)
    add = '  ' + en
    if m2:
        add += '\n  ' + m2.group(0).replace('https://welfareavenue.com/donate/', 'https://welfareavenue.com/gift-basket-drive/').replace('https://welfareavenue.com/fr/donner/', 'https://welfareavenue.com/fr/paniers-cadeaux/')
    assert s.count('</urlset>') == 1
    return s.replace('</urlset>', add + '\n</urlset>')


if __name__ == '__main__':
    wr('gift-basket-drive/index.html', page('donate/index.html', EN, main_en(), False))
    wr('fr/paniers-cadeaux/index.html', page('fr/donner/index.html', FRW, main_fr(), True))
    wr('events/index.html', link_card('events/index.html', 'Holiday Gift Basket Drive', 'Give or volunteer'))
    fr_ev = rd('fr/evenements/index.html')
    m = re.search(r'<h3>([^<]*(?:paniers|cadeaux)[^<]*)</h3>', fr_ev)
    assert m, 'the French card was not found'
    wr('fr/evenements/index.html', link_card('fr/evenements/index.html', m.group(1), 'Donner ou faire du bénévolat'))
    wr('sitemap.xml', sitemap())
