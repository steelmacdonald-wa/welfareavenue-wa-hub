#!/usr/bin/env python3
"""16/10/26 - wave261 on welfareavenue.com: the Holiday Gift Basket Drive page's pop-up forms and its gift counter.

Steel, 16/10/26: "I think we should have a new volunteer application form via the hub so that we can collect them on that
page as a pop-up form, to donate gifts and essentials, to volunteer with us. I don't want it to bring people to a different
page. I want it to pop up a form for each of those actions that they can take. Same thing for companies and sponsors and
schools and groups." And earlier the same day, the gift counter: "this should be editable".

Works on the live files (build/www/LIVE_IS_SOURCE.md) in place: python3 build/www/patches/261_drive_popups.py build/www/live
  gift-basket-drive/index.html, fr/paniers-cadeaux/index.html
    - each non-money action opens a Hub form in a pop-up (assets/forms.js, wave236's mechanism; wave261 adds
      data-wa-popup-id, several pop-ups in one section, and data-wa-popup-bare, the card's own link or button as the
      launcher): Donate gifts and essentials (#give-items), Wrap with us (#wrap-with-us), Companies and sponsors (#sponsor),
      Schools and groups (#groups-drive). The page's own link stays as the fallback without JavaScript. The green band's
      "Volunteer with us" opens the volunteer pop-up. The online donation keeps the Stripe pop-up (give/embed.js).
    - the gift counter under the 6,000-gift goal (data-dr-gifts, drawn by assets/drive.js from www_campaign_totals gifts_in;
      hidden while it is 0).
    - forms.js is loaded; the ?v= values of forms.js and drive.js and drive.css are stamped from the files.
  assets/forms.js: CSS_V is stamped from assets/forms.css.
The forms are the CRM's gift-drive-give / paniers-donner, gift-drive-volunteer / paniers-benevole, gift-drive-sponsor /
paniers-entreprises and gift-drive-group / paniers-groupes (build/data/wa261_forms.py); the French page asks for the French
form first and falls back to the English one.
"""
import hashlib, os, re, sys

D = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'live')
A = os.path.join(D, 'assets')


def rd(p):
    return open(os.path.join(D, p), encoding='utf8').read()


def wr(p, s):
    open(os.path.join(D, p), 'w', encoding='utf8').write(s)
    print('wrote', p, len(s.encode('utf8')), hashlib.md5(s.encode('utf8')).hexdigest())


def md5(p):
    return hashlib.md5(open(os.path.join(A, p), 'rb').read()).hexdigest()


def one(s, old, new):
    assert s.count(old) == 1, (old[:120], s.count(old))
    return s.replace(old, new)


AR = ('<svg class="ar" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 7h15M10.5 1.5 16 7l-5.5 5.5" '
      'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg>')


def pop(slugs, pid, label, title, bare, fallback):
    return ('<div data-wa-form="' + slugs + '" data-wa-popup="' + label + '" data-wa-popup-id="' + pid + '" data-wa-popup-bare="' + bare + '"'
            ' data-wa-popup-title="' + title + '">' + fallback + '</div>')


# 1. forms.js loads the forms.css it ships with
fj = rd('assets/forms.js')
fj = re.sub(r"var CSS_V = '[0-9a-f]{8}'", "var CSS_V = '" + md5('forms.css')[:8] + "'", fj, count=1)
wr('assets/forms.js', fj)

TXT = {
    'en': {
        'path': 'gift-basket-drive/index.html',
        'give_link': '<a class="textlink" href="mailto:info@welfareavenue.com?subject=Holiday%20Gift%20Basket%20Drive%3A%20donating%20items">Write to us to give items' + AR + '</a>',
        'give': ('gift-drive-give', 'Tell us what you’re giving', 'Donate gifts and essentials'),
        'vol_link': '<a class="textlink" href="/volunteer/">Volunteer with us' + AR + '</a>',
        'vol': ('gift-drive-volunteer', 'Sign up to help', 'Volunteer with the drive'),
        'sp_link': '<a class="btn ghost" href="mailto:info@welfareavenue.com?subject=Holiday%20Gift%20Basket%20Drive%3A%20sponsorship">Write to us' + AR + '</a>',
        'sp': ('gift-drive-sponsor', 'Tell us how you’d like to help', 'Companies and sponsors'),
        'gr_link': '<a class="btn ghost" href="/volunteer/#groups">Bring your group' + AR + '</a>',
        'gr': ('gift-drive-group', 'Bring your group', 'Schools and groups'),
        'band_vol': '<a class="btn ghost" href="/volunteer/">Volunteer with us' + AR + '</a></div></div></section>',
        'band_vol_new': '<a class="btn ghost" href="#wrap-with-us">Volunteer with us' + AR + '</a></div></div></section>',
        'sp_h': '<div class="card"><h2>Companies and sponsors</h2>', 'gr_h': '<div class="card"><h2>Schools and groups</h2>',
        'goal_fine': '<p class="fine">Last year: more than 3,000 gifts. The year before: more than 1,500.</p></div>',
        'gifts': ('<div class="drp-gifts" data-dr-gifts="gift-basket-drive" hidden><p class="drp-gn"><b data-dr="gifts-n">0</b><span>gifts collected so far</span></p>'
                  '<div class="drp-bar" data-dr="gifts-bar" role="progressbar" aria-label="Gifts collected toward our goal" aria-valuemin="0" aria-valuemax="6000" aria-valuenow="0" hidden><span data-dr="gifts-fill"></span></div>'
                  '<p class="fine" data-dr="gifts-way" hidden></p></div>'),
    },
    'fr': {
        'path': 'fr/paniers-cadeaux/index.html',
        'give_link': '<a class="textlink" href="mailto:info@welfareavenue.com?subject=Collecte%20de%20paniers-cadeaux%20%3A%20don%20d%E2%80%99articles">Écrivez-nous pour donner des articles' + AR + '</a>',
        'give': ('paniers-donner,gift-drive-give', 'Dites-nous ce que vous donnez', 'Donner des cadeaux et des articles'),
        'vol_link': '<a class="textlink" href="/fr/benevolat/">Faire du bénévolat avec nous' + AR + '</a>',
        'vol': ('paniers-benevole,gift-drive-volunteer', 'Je m’inscris pour aider', 'Faire du bénévolat pour la collecte'),
        'sp_link': '<a class="btn ghost" href="mailto:info@welfareavenue.com?subject=Collecte%20de%20paniers-cadeaux%20%3A%20commandite">Nous écrire' + AR + '</a>',
        'sp': ('paniers-entreprises,gift-drive-sponsor', 'Dites-nous comment vous aimeriez aider', 'Entreprises et commanditaires'),
        'gr_link': '<a class="btn ghost" href="/fr/benevolat/#groups">Inscrire votre groupe' + AR + '</a>',
        'gr': ('paniers-groupes,gift-drive-group', 'Inscrire votre groupe', 'Écoles et groupes'),
        'band_vol': '<a class="btn ghost" href="/fr/benevolat/">Faire du bénévolat' + AR + '</a></div></div></section>',
        'band_vol_new': '<a class="btn ghost" href="#wrap-with-us">Faire du bénévolat' + AR + '</a></div></div></section>',
        'sp_h': '<div class="card"><h2>Entreprises et commanditaires</h2>', 'gr_h': '<div class="card"><h2>Écoles et groupes</h2>',
        'goal_fine': '<p class="fine">L’an dernier&nbsp;: plus de 3&nbsp;000 cadeaux. L’année d’avant&nbsp;: plus de 1&nbsp;500.</p></div>',
        'gifts': ('<div class="drp-gifts" data-dr-gifts="gift-basket-drive" hidden><p class="drp-gn"><b data-dr="gifts-n">0</b><span>cadeaux recueillis jusqu’ici</span></p>'
                  '<div class="drp-bar" data-dr="gifts-bar" role="progressbar" aria-label="Cadeaux recueillis vers notre objectif" aria-valuemin="0" aria-valuemax="6000" aria-valuenow="0" hidden><span data-dr="gifts-fill"></span></div>'
                  '<p class="fine" data-dr="gifts-way" hidden></p></div>'),
    },
}

for lang, t in TXT.items():
    s = rd(t['path'])
    if 'data-wa-popup-id' in s:
        print('already patched:', t['path'])
    else:
        s = one(s, t['give_link'], pop(t['give'][0], 'give-items', t['give'][1], t['give'][2], 'textlink', t['give_link']))
        s = one(s, t['vol_link'] + '</li>', pop(t['vol'][0], 'wrap-with-us', t['vol'][1], t['vol'][2], 'textlink', t['vol_link']) + '</li>')
        s = one(s, t['sp_link'], pop(t['sp'][0], 'sponsor', t['sp'][1], t['sp'][2], 'btn ghost', t['sp_link']))
        s = one(s, t['gr_link'], pop(t['gr'][0], 'groups-drive', t['gr'][1], t['gr'][2], 'btn ghost', t['gr_link']))
        s = one(s, t['band_vol'], t['band_vol_new'])
        s = one(s, t['sp_h'], '<div class="card" id="sponsor">' + t['sp_h'][len('<div class="card">'):])
        s = one(s, t['gr_h'], '<div class="card" id="groups-drive">' + t['gr_h'][len('<div class="card">'):])
        # the cards in Three ways get the ids their pop-ups answer to (links from elsewhere land on the card without JavaScript)
        lis = [m.start() for m in re.finditer(r'<li class="way">', s)]
        assert len(lis) == 3, lis
        s = s[:lis[2]] + '<li class="way" id="wrap-with-us">' + s[lis[2] + len('<li class="way">'):]
        s = s[:lis[0]] + '<li class="way" id="give-items">' + s[lis[0] + len('<li class="way">'):]
        s = one(s, t['goal_fine'], t['goal_fine'][:-len('</div>')] + t['gifts'] + '</div>')
    # the scripts and styles, stamped from the files
    s = re.sub(r'/assets/drive\.js\?v=[0-9a-f]{8}', '/assets/drive.js?v=' + md5('drive.js')[:8], s)
    s = re.sub(r'/assets/drive\.css\?v=[0-9a-f]{8}', '/assets/drive.css?v=' + md5('drive.css')[:8], s)
    if '/assets/forms.js' not in s:
        s = one(s, '<script src="/assets/drive.js', '<script src="/assets/forms.js?v=' + md5('forms.js')[:8] + '" defer></script>\n<script src="/assets/drive.js')
    s = re.sub(r'/assets/forms\.js\?v=[0-9a-f]{8}', '/assets/forms.js?v=' + md5('forms.js')[:8], s)
    wr(t['path'], s)
