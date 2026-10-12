#!/usr/bin/env python3
"""wave232 (Steel, 12/10/26) for welfareavenue.com, applied to the live files (see build/www/LIVE_IS_SOURCE.md).

  python3 232_legal_frlogo_faces.py <live dir> <out dir>

<live dir> holds the site's files as www_files serves them (text and binary). <out dir> receives every file this patch
changes or adds; nothing else. Steel's words:
  - "you can put the terms data deletion and privacy section on welfareavenue.com. Just keep it very, very subtle in the
    footer": /terms/, /data-deletion/ and their French pages, a social-media section in the privacy notice, and the three
    links in the footer's small legal line.
  - "Go ahead with the French website afterwards and swap in the Avenue du Bien-Etre" logo: every French page's header and
    footer carry the French lockup (assets/logo-fr-green.png on the white header, assets/logo-fr-cream.png in the green footer).
  - "just put our logo if they don't have a profile picture set up yet": the team section's initials become the logo
    (assets/face-logo.svg), and site.js fills in a team member's professional website photo, or their Hub photo where the
    site has no photo for them (rpc www_team_photos).
"""
import hashlib, os, re, sys, shutil

LIVE, OUT = sys.argv[1], sys.argv[2]
DATE_EN, DATE_FR = 'October 12, 2026', '12 octobre 2026'
changed = {}

def rd(p):
    return open(os.path.join(LIVE, p), encoding='utf-8').read()
def put(p, s):
    changed[p] = s
def cur(p):
    return changed[p] if p in changed else rd(p)
def html_pages():
    for root, _, files in os.walk(LIVE):
        for f in files:
            if f.endswith('.html'):
                yield os.path.relpath(os.path.join(root, f), LIVE).replace(os.sep, '/')
def is_fr(rel, t):
    return rel.startswith('fr/') or '<html lang="fr"' in t

# ---------- 1. the new pages (from the privacy pages' chrome) ----------
TERMS_EN = '''<p class="upd">Last updated %s</p><p class="lede">These terms cover welfareavenue.com, your account on it, our forms and our donation page. By using the site, you agree to them.</p>
<h2>Who we are</h2><p>Welfare Avenue (Avenue du Bien-&Ecirc;tre) is a youth-powered registered charity in Canada (713048502RR0001), at 8200 av Bloomfield, Montr&eacute;al QC H3N 2H9.</p>
<h2>Using the site</h2><ul><li>Use the site for your own, non-commercial purposes: to learn about us, volunteer, give, or get in touch.</li><li>Give us true information, and only share someone else&rsquo;s details with their permission.</li><li>Do not try to get around the site&rsquo;s security, overload it, or copy it in bulk.</li></ul>
<h2>Your account</h2><p>An account is for one person. You sign in with Google or a code we email you, so keep your email account safe. We may pause an account that is used to misuse the site. You can delete your account at any time: see <a href="/data-deletion/">Data deletion</a>.</p>
<h2>Volunteering</h2><p>Volunteering with us is unpaid and does not create a job. On a serving day, please follow the team leader&rsquo;s instructions, including on food safety. We may move or cancel a serving; we will tell you as soon as we can.</p>
<h2>Donations</h2><p>Online gifts are processed by Stripe. We send an official receipt for income tax purposes for eligible gifts, as the Canada Revenue Agency requires. You can stop a monthly gift at any time by writing to us. If something went wrong with a gift, write to us and we will sort it out.</p>
<h2>Our content</h2><p>The words, photos, logos and designs on this site belong to Welfare Avenue or are used with permission. You are welcome to share our pages and quote us with credit. Please do not use our name or logo in a way that suggests we endorse something without asking us first.</p>
<h2>What you send us</h2><p>What you send through our forms stays yours. You let us use it to answer you and to run our programs. Please never include the names of the people we serve.</p>
<h2>Our social media tools</h2><p>We publish on our own Instagram, Facebook, Threads, TikTok, YouTube and LinkedIn accounts with our own tool, the Welfare Avenue Hub. It connects only to Welfare Avenue&rsquo;s accounts and never posts for anyone else. When you use those platforms, their own terms apply. How we handle what we see there is in our <a href="/privacy/#social">privacy notice</a>.</p>
<h2>Other sites</h2><p>Links to other sites are there to help; we are not responsible for their content.</p>
<h2>Our responsibility</h2><p>We work to keep the site accurate and available, but it is provided as it is. To the extent the law allows, we are not responsible for indirect losses from using it. Nothing in these terms limits rights you have under Quebec law.</p>
<h2>Changes</h2><p>We may update these terms; the date at the top says when. The laws of Quebec and of Canada apply.</p>
<h2>Questions</h2><p>Write to <a href="mailto:info@welfareavenue.com">info@welfareavenue.com</a> or call <a href="tel:+14388087754">(438) 808-7754</a>.</p>''' % DATE_EN

TERMS_FR = '''<p class="upd">Mis &agrave; jour le %s</p><p class="lede">Les pr&eacute;sentes conditions s&rsquo;appliquent &agrave; welfareavenue.com, &agrave; votre compte, &agrave; nos formulaires et &agrave; notre page de dons. En utilisant le site, vous les acceptez.</p>
<h2>Qui nous sommes</h2><p>Welfare Avenue (Avenue du Bien-&Ecirc;tre) est un organisme de bienfaisance enregistr&eacute; au Canada (713048502RR0001), port&eacute; par les jeunes, situ&eacute; au 8200, av. Bloomfield, Montr&eacute;al (Qu&eacute;bec) H3N 2H9.</p>
<h2>Utiliser le site</h2><ul><li>Utilisez le site &agrave; des fins personnelles et non commerciales&nbsp;: pour nous d&eacute;couvrir, faire du b&eacute;n&eacute;volat, donner ou nous &eacute;crire.</li><li>Donnez-nous des renseignements exacts et ne partagez ceux d&rsquo;une autre personne qu&rsquo;avec sa permission.</li><li>N&rsquo;essayez pas de contourner la s&eacute;curit&eacute; du site, de le surcharger ou de le copier en masse.</li></ul>
<h2>Votre compte</h2><p>Un compte est personnel. Vous vous connectez avec Google ou avec un code re&ccedil;u par courriel&nbsp;: gardez donc votre compte courriel en s&eacute;curit&eacute;. Nous pouvons suspendre un compte qui sert &agrave; un usage abusif du site. Vous pouvez supprimer votre compte en tout temps&nbsp;: voyez <a href="/fr/suppression-des-donnees/">Suppression des donn&eacute;es</a>.</p>
<h2>B&eacute;n&eacute;volat</h2><p>Le b&eacute;n&eacute;volat n&rsquo;est pas r&eacute;mun&eacute;r&eacute; et ne cr&eacute;e pas d&rsquo;emploi. Le jour d&rsquo;un service, suivez les consignes de la personne responsable de l&rsquo;&eacute;quipe, notamment en mati&egrave;re de salubrit&eacute; alimentaire. Nous pouvons d&eacute;placer ou annuler un service&nbsp;; nous vous pr&eacute;viendrons d&egrave;s que possible.</p>
<h2>Dons</h2><p>Les dons en ligne sont trait&eacute;s par Stripe. Nous remettons un re&ccedil;u officiel aux fins de l&rsquo;imp&ocirc;t pour les dons admissibles, selon les r&egrave;gles de l&rsquo;Agence du revenu du Canada. Vous pouvez arr&ecirc;ter un don mensuel en tout temps en nous &eacute;crivant. Si un don ne s&rsquo;est pas pass&eacute; comme pr&eacute;vu, &eacute;crivez-nous et nous r&eacute;glerons la situation.</p>
<h2>Notre contenu</h2><p>Les textes, photos, logos et visuels du site appartiennent &agrave; Welfare Avenue ou sont utilis&eacute;s avec permission. Vous pouvez partager nos pages et nous citer en nous mentionnant. N&rsquo;utilisez pas notre nom ou notre logo d&rsquo;une mani&egrave;re qui laisse croire que nous appuyons quelque chose sans nous le demander.</p>
<h2>Ce que vous nous envoyez</h2><p>Ce que vous nous envoyez par nos formulaires vous appartient. Vous nous permettez de l&rsquo;utiliser pour vous r&eacute;pondre et pour mener nos programmes. N&rsquo;y inscrivez jamais le nom des personnes que nous servons.</p>
<h2>Nos outils de m&eacute;dias sociaux</h2><p>Nous publions sur nos propres comptes Instagram, Facebook, Threads, TikTok, YouTube et LinkedIn avec notre propre outil, le Hub de Welfare Avenue. Il se connecte seulement aux comptes de Welfare Avenue et ne publie jamais pour quelqu&rsquo;un d&rsquo;autre. Quand vous utilisez ces plateformes, leurs propres conditions s&rsquo;appliquent. Ce que nous faisons de ce que nous y voyons est expliqu&eacute; dans notre <a href="/fr/confidentialite/#social">avis de confidentialit&eacute;</a>.</p>
<h2>Autres sites</h2><p>Les liens vers d&rsquo;autres sites sont l&agrave; pour vous aider&nbsp;; nous ne sommes pas responsables de leur contenu.</p>
<h2>Notre responsabilit&eacute;</h2><p>Nous veillons &agrave; ce que le site soit exact et accessible, mais il est fourni tel quel. Dans la mesure permise par la loi, nous ne sommes pas responsables des pertes indirectes li&eacute;es &agrave; son utilisation. Rien dans ces conditions ne limite les droits que vous accorde la loi au Qu&eacute;bec.</p>
<h2>Changements</h2><p>Nous pouvons mettre ces conditions &agrave; jour&nbsp;; la date en haut l&rsquo;indique. Les lois du Qu&eacute;bec et du Canada s&rsquo;appliquent.</p>
<h2>Questions</h2><p>&Eacute;crivez &agrave; <a href="mailto:info@welfareavenue.com">info@welfareavenue.com</a> ou appelez au <a href="tel:+14388087754">438 808-7754</a>.</p>''' % DATE_FR

DEL_EN = '''<p class="upd">Last updated %s</p><p class="lede">You can ask us to delete the information we keep about you at any time. Here is how, and what happens next.</p>
<h2>How to ask</h2><p>Write to <a href="mailto:info@welfareavenue.com?subject=Delete%%20my%%20data">info@welfareavenue.com</a> from the address we have for you, or text <a href="sms:+14388087754">(438) 808-7754</a>, and tell us what to delete: your website account, your volunteer and supporter record, or everything. If Facebook, Instagram or Threads gave you a confirmation code, include it.</p>
<h2>What we delete</h2><ul><li><b>Your website account</b>: your sign-in and what you saved to it. If you signed in with Google, you can also remove our access in your Google account, under Security, Your connections to third-party apps and services.</li><li><b>Your record</b>: your contact details, the servings you signed up for, your answers to our forms and surveys, and the messages you sent us.</li><li><b>Social media</b>: comments you left on our posts live on that platform, and you can delete them there. We also remove any copy our Hub keeps to answer them.</li></ul>
<h2>When</h2><p>We confirm we received your request within 2 business days and complete it within 30 days, then write to tell you it is done.</p>
<h2>What the law asks us to keep</h2><p>Records of gifts and official tax receipts are kept for as long as Canadian tax law requires (six years after the year they belong to), and nothing more about you. If you asked us to stop emailing you, we keep your address on a do-not-contact list so it stays that way, unless you ask us to remove that too.</p>
<h2>Questions</h2><p>Write to our person in charge of protecting personal information at <a href="mailto:info@welfareavenue.com">info@welfareavenue.com</a>. Read more in our <a href="/privacy/">privacy notice</a>.</p>''' % DATE_EN

DEL_FR = '''<p class="upd">Mis &agrave; jour le %s</p><p class="lede">Vous pouvez nous demander en tout temps de supprimer les renseignements que nous conservons &agrave; votre sujet. Voici comment faire et ce qui se passe ensuite.</p>
<h2>Comment le demander</h2><p>&Eacute;crivez &agrave; <a href="mailto:info@welfareavenue.com?subject=Supprimer%%20mes%%20donn%%C3%%A9es">info@welfareavenue.com</a> &agrave; partir de l&rsquo;adresse que nous avons pour vous, ou textez le <a href="sms:+14388087754">438 808-7754</a>, en pr&eacute;cisant ce qu&rsquo;il faut supprimer&nbsp;: votre compte sur le site, votre dossier de b&eacute;n&eacute;vole et de sympathisant, ou tout. Si Facebook, Instagram ou Threads vous a donn&eacute; un code de confirmation, indiquez-le.</p>
<h2>Ce que nous supprimons</h2><ul><li><b>Votre compte sur le site</b>&nbsp;: votre connexion et ce que vous y avez enregistr&eacute;. Si vous vous connectez avec Google, vous pouvez aussi retirer notre acc&egrave;s dans votre compte Google, sous S&eacute;curit&eacute;, Vos connexions &agrave; des applications et services tiers.</li><li><b>Votre dossier</b>&nbsp;: vos coordonn&eacute;es, les services auxquels vous vous &ecirc;tes inscrit&middot;e, vos r&eacute;ponses &agrave; nos formulaires et sondages, et les messages que vous nous avez envoy&eacute;s.</li><li><b>M&eacute;dias sociaux</b>&nbsp;: les commentaires laiss&eacute;s sur nos publications restent sur la plateforme et vous pouvez les y supprimer. Nous retirons aussi toute copie que notre Hub conserve pour y r&eacute;pondre.</li></ul>
<h2>D&eacute;lais</h2><p>Nous confirmons la r&eacute;ception de votre demande dans les 2 jours ouvrables et la traitons dans les 30 jours, puis nous vous &eacute;crivons pour vous le confirmer.</p>
<h2>Ce que la loi nous demande de garder</h2><p>Les dossiers de dons et les re&ccedil;us officiels aux fins de l&rsquo;imp&ocirc;t sont conserv&eacute;s aussi longtemps que l&rsquo;exige la loi fiscale canadienne (six ans apr&egrave;s l&rsquo;ann&eacute;e concern&eacute;e), et rien d&rsquo;autre &agrave; votre sujet. Si vous nous avez demand&eacute; de ne plus vous &eacute;crire, nous gardons votre adresse sur une liste d&rsquo;exclusion pour que cela reste ainsi, sauf si vous nous demandez de la retirer aussi.</p>
<h2>Questions</h2><p>&Eacute;crivez &agrave; la personne responsable de la protection des renseignements personnels &agrave; <a href="mailto:info@welfareavenue.com">info@welfareavenue.com</a>. Pour en savoir plus, lisez notre <a href="/fr/confidentialite/">avis de confidentialit&eacute;</a>.</p>''' % DATE_FR

SOC_EN = '<h2 id="social">Our social media accounts</h2><p>We post on our own Instagram, Facebook, Threads, TikTok, YouTube and LinkedIn accounts through the Welfare Avenue Hub, our own tool. It connects only to Welfare Avenue&rsquo;s accounts, with the permissions those platforms give an account&rsquo;s owner. Through it we read the comments and messages people leave on our posts, with the public name and profile picture the platform shows, so that we can answer them, and our accounts&rsquo; statistics (views, followers, likes), which the platforms give us as totals. We do not use it to see anyone&rsquo;s private information and we never sell any of it. We keep comments only as long as we need them to answer. To have something removed, see <a href="/data-deletion/">Data deletion</a>.</p>'
SOC_FR = '<h2 id="social">Nos comptes de m&eacute;dias sociaux</h2><p>Nous publions sur nos propres comptes Instagram, Facebook, Threads, TikTok, YouTube et LinkedIn au moyen du Hub de Welfare Avenue, notre propre outil. Il se connecte seulement aux comptes de Welfare Avenue, avec les permissions que ces plateformes accordent au propri&eacute;taire d&rsquo;un compte. Par lui, nous lisons les commentaires et les messages laiss&eacute;s sur nos publications, avec le nom public et la photo de profil qu&rsquo;affiche la plateforme, afin d&rsquo;y r&eacute;pondre, ainsi que les statistiques de nos comptes (vues, abonn&eacute;s, mentions J&rsquo;aime), que les plateformes nous donnent en totaux. Nous ne nous en servons pas pour voir les renseignements priv&eacute;s de qui que ce soit et nous n&rsquo;en vendons jamais rien. Nous gardons les commentaires seulement le temps d&rsquo;y r&eacute;pondre. Pour faire retirer quelque chose, voyez <a href="/fr/suppression-des-donnees/">Suppression des donn&eacute;es</a>.</p>'

PAGES = [
    # (path, src template, lang, title, h1, description, body, alt path)
    ('terms/index.html', 'privacy/index.html', 'en', 'Terms of use', 'Terms of use', 'The terms for using welfareavenue.com, your account on it, our forms and our donation page.', TERMS_EN, 'fr/conditions/index.html'),
    ('data-deletion/index.html', 'privacy/index.html', 'en', 'Data deletion', 'Data deletion', 'How to ask Welfare Avenue to delete the information we keep about you, and what happens next.', DEL_EN, 'fr/suppression-des-donnees/index.html'),
    ('fr/conditions/index.html', 'fr/confidentialite/index.html', 'fr', 'Conditions d’utilisation', 'Conditions d’utilisation', 'Les conditions d’utilisation de welfareavenue.com, de votre compte, de nos formulaires et de notre page de dons.', TERMS_FR, 'terms/index.html'),
    ('fr/suppression-des-donnees/index.html', 'fr/confidentialite/index.html', 'fr', 'Suppression des données', 'Suppression des données', 'Comment demander à Welfare Avenue de supprimer les renseignements que nous conservons à votre sujet, et ce qui se passe ensuite.', DEL_FR, 'data-deletion/index.html'),
]
def url_of(p):
    return 'https://welfareavenue.com/' + p[:-len('index.html')]
for path, tpl, lang, title, h1, desc, body, alt in PAGES:
    t = rd(tpl)
    old_url = re.search(r'<link rel="canonical" href="([^"]+)">', t).group(1)
    old_title = re.search(r'<title>([^<]+)</title>', t).group(1)
    old_desc = re.search(r'<meta name="description" content="([^"]+)">', t).group(1)
    other_old = 'https://welfareavenue.com/fr/confidentialite/' if lang == 'en' else 'https://welfareavenue.com/privacy/'
    en_u, fr_u = (url_of(path), url_of(alt)) if lang == 'en' else (url_of(alt), url_of(path))
    t = t.replace(old_title, title + ' · Welfare Avenue').replace(old_desc, desc)
    t = t.replace('hreflang="en" href="https://welfareavenue.com/privacy/"', 'hreflang="en" href="%s"' % en_u)
    t = t.replace('hreflang="fr" href="https://welfareavenue.com/fr/confidentialite/"', 'hreflang="fr" href="%s"' % fr_u)
    t = t.replace('hreflang="x-default" href="https://welfareavenue.com/privacy/"', 'hreflang="x-default" href="%s"' % en_u)
    t = t.replace(old_url, url_of(path))
    # the language switch in the menu points at the page's twin
    t = re.sub(r'<a class="lang" href="[^"]*"', '<a class="lang" href="/%s"' % alt[:-len('index.html')], t, count=1)
    t = t.replace(' aria-current="page"', '')
    i = t.index('<main id="main">'); j = t.index('</main>')
    main = ('<main id="main">\n<section class="acct-top"><div class="wrap"><p class="over">Welfare Avenue</p><h1>%s</h1></div></section>\n'
            '<section class="band on-white"><div class="wrap"><div class="doc">%s</div></div></section>\n') % (h1, body)
    t = t[:i] + main + t[j:]
    assert '—' not in body, 'em dash in ' + path
    put(path, t)

# the privacy notices: the social media section, the new date
for p, soc, upd_old, upd_new, anchor in (('privacy/index.html', SOC_EN, r'Last updated [A-Z][a-z]+ \d+, 2026', 'Last updated ' + DATE_EN, '<h2>How long we keep it</h2>'),
                                         ('fr/confidentialite/index.html', SOC_FR, r'Mis à jour le \d+ [a-zéû]+ 2026', 'Mis à jour le ' + DATE_FR, None)):
    t = cur(p)
    if 'id="social"' not in t:
        if anchor and anchor in t:
            t = t.replace(anchor, soc + anchor, 1)
        else:
            m = re.search(r'<h2>[^<]*(?:Combien de temps|Durée de conservation|conservons-nous)[^<]*</h2>', t)
            assert m, 'no anchor in ' + p
            t = t[:m.start()] + soc + t[m.start():]
    t = re.sub(upd_old, upd_new, t, count=1)
    put(p, t)

# ---------- 2. every page: the legal line, the French logo, the team's faces ----------
LEG_EN_OLD = '<span><a href="/privacy/">Privacy</a></span>'
LEG_EN_NEW = '<span><a href="/privacy/">Privacy</a> &middot; <a href="/terms/">Terms</a> &middot; <a href="/data-deletion/">Data deletion</a></span>'
LEG_FR_OLD = '<span><a href="/fr/confidentialite/">Confidentialité</a></span>'
LEG_FR_NEW = '<span><a href="/fr/confidentialite/">Confidentialité</a> &middot; <a href="/fr/conditions/">Conditions d’utilisation</a> &middot; <a href="/fr/suppression-des-donnees/">Suppression des données</a></span>'
HDR_EN = '<img src="/assets/logo-green.svg" alt="Welfare Avenue" width="130" height="44">'
HDR_FR = '<img src="/assets/logo-fr-green.png" alt="Avenue du Bien-Être" width="107" height="44">'
FTR_EN = '<img src="/assets/logo-cream.svg" alt="Welfare Avenue" width="120" height="40">'
FTR_FR = '<img src="/assets/logo-fr-cream.png" alt="Avenue du Bien-Être" width="120" height="49">'
FACE = '<img class="face" src="/assets/face-logo.svg" alt="" width="96" height="96" loading="lazy" decoding="async" data-face-logo>'
for rel in list(html_pages()) + [p for p, *_ in PAGES]:
    t = cur(rel); o = t
    fr = is_fr(rel, t)
    if fr:
        t = t.replace(LEG_FR_OLD, LEG_FR_NEW)
        t = t.replace(HDR_EN, HDR_FR).replace(FTR_EN, FTR_FR)
        t = t.replace('aria-label="Welfare Avenue, accueil"', 'aria-label="Avenue du Bien-Être, accueil"')
    else:
        t = t.replace(LEG_EN_OLD, LEG_EN_NEW)
    t = re.sub(r'<span class="face ini c\d" aria-hidden="true">[^<]*</span>', FACE, t)
    if t != o:
        put(rel, t)

# ---------- 3. site.js: the team's photos from the Hub ----------
SJ = 'assets/site.js'
s = rd(SJ)
ADD = r'''
  /* wave232 (Steel, 12/10/26): the team's photos. A team or board member's professional website photo, set in the Hub, always
     shows; their Hub photo only fills a face that still shows our logo. First name and photo addresses only (www_team_photos). */
  (function () {
    var lis = document.querySelectorAll('ul.team li'); if (!lis.length || !SUPA || !KEY) return;
    fetch(SUPA + '/rest/v1/rpc/www_team_photos', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Accept: 'application/json' }, body: '{}' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var ok = /^https:\/\/zwnmulmnvopclzcvytce\.supabase\.co\/storage\/v1\/object\/public\/avatars\//, map = {};
        (rows || []).forEach(function (x) { if (x && x.first_name) map[x.first_name] = { w: ok.test(x.website_photo || '') ? x.website_photo : '', h: ok.test(x.hub_photo || '') ? x.hub_photo : '' }; });
        Array.prototype.forEach.call(lis, function (li) {
          var nm = li.querySelector('.nm'), face = li.querySelector('.face'); if (!nm || !face) return;
          var p = map[(nm.textContent || '').trim().split(/\s+/)[0].toLowerCase()]; if (!p) return;
          var url = p.w || (face.hasAttribute('data-face-logo') ? p.h : ''); if (!url) return;
          var img = new Image(); img.className = 'face'; img.alt = ''; img.width = 96; img.height = 96; img.decoding = 'async';
          img.onload = function () { if (face.parentNode) face.parentNode.replaceChild(img, face); };
          img.src = url;
        });
      }).catch(function () { /* the logo stays */ });
  })();
'''
assert 'www_team_photos' not in s
k = s.rstrip().rfind('})();')
assert k > 0
s = s[:k] + ADD.lstrip('\n') + s[k:]
put(SJ, s)
new_v = hashlib.md5(s.encode('utf-8')).hexdigest()[:8]
for rel in set(list(html_pages()) + [p for p, *_ in PAGES]):
    t = cur(rel)
    t2 = re.sub(r'/assets/site\.js\?v=[0-9a-f]{8}', '/assets/site.js?v=' + new_v, t)
    if t2 != t:
        put(rel, t2)

# ---------- 4. the sitemap ----------
sm = cur('sitemap.xml')
if '/terms/' not in sm:
    add = ''
    for a, b in (('terms/', 'fr/conditions/'), ('data-deletion/', 'fr/suppression-des-donnees/')):
        for loc in (a, b):
            add += ('\n  <url><loc>https://welfareavenue.com/%s</loc><xhtml:link rel="alternate" hreflang="en" href="https://welfareavenue.com/%s"/>'
                    '<xhtml:link rel="alternate" hreflang="fr" href="https://welfareavenue.com/%s"/></url>') % (loc, a, b)
    k = sm.rindex('</urlset>')
    sm = sm[:k].rstrip('\n') + add + '\n' + sm[k:]
    put('sitemap.xml', sm)

# ---------- write ----------
for p, s in changed.items():
    fp = os.path.join(OUT, p); os.makedirs(os.path.dirname(fp) or OUT, exist_ok=True)
    open(fp, 'w', encoding='utf-8').write(s)
print(len(changed), 'files:', ', '.join(sorted(changed)))
