// wave162: the new welfareavenue.com, offline. Serves build/www/out the way Netlify will (test/www_serve.js: pretty
// URLs, _redirects, _headers with the real CSP, 404.html), with the Hub mocked: rpc www_upcoming and form-submit
// (published, draft, errors, the thank-you). Nothing reaches the live database.
// Run: NODE_PATH=/home/claude/.npm-global/lib/node_modules node test/w162www.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { attach, ORIGIN, OUT } = require('./www_serve.js');
const SUPA = 'https://zwnmulmnvopclzcvytce.supabase.co';
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('FAIL ' + m); } }
const PAGES = { home: ['/', '/fr/'], about: ['/about/', '/fr/a-propos/'], volunteer: ['/volunteer/', '/fr/benevolat/'], events: ['/events/', '/fr/evenements/'],
  press: ['/press/', '/fr/presse/'], contact: ['/contact/', '/fr/contact/'], donate: ['/donate/', '/fr/donner/'],
  account: ['/account/', '/fr/compte/'], privacy: ['/privacy/', '/fr/confidentialite/'], join: ['/join/', '/fr/rejoindre/'] }; // wave194: the account page and the privacy notice; wave216: Join our team
const ALL = Object.values(PAGES).flat();
const FORM = { slug: 'newsletter', title: 'Get the Welfare Avenue newsletter', intro: 'About once a month.', lang: 'en', thank_you: 'You are on the list.',
  consent: { ask: true, required: true, label: 'Yes, email me.' },
  questions: [{ id: 'first_name', type: 'text', label: 'First name', required: true }, { id: 'email', type: 'email', label: 'Email', required: true },
    { id: 'language', type: 'choice', label: 'Language', required: false, options: [{ v: 'en', l: 'English' }, { v: 'fr', l: 'Français' }] }] };
const ORG = { name: 'Welfare Avenue', email: 'info@welfareavenue.com', address: 'Welfare Avenue, Montreal', charity: '713048502RR0001' };

(async () => {
  // ---------- static checks on the build ----------
  const htmlFiles = [];
  (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.html')) htmlFiles.push(p); } })(OUT);
  ok(htmlFiles.length === 21, 'twenty-one pages built (' + htmlFiles.length + ')');
  for (const f of htmlFiles) {
    const s = fs.readFileSync(f, 'utf8'), rel = path.relative(OUT, f);
    ok(!/—/.test(s), rel + ': no em dash');
    ok(!/\sstyle="/i.test(s), rel + ': no inline style attribute');
    ok(!/<script(?![^>]*\b(src=|type="application\/(ld\+)?json"))[^>]*>/i.test(s), rel + ': no inline executable script');
    ok(!/\son[a-z]+="/i.test(s), rel + ': no inline event handler');
    const donate = s.match(/<a [^>]*data-wa-donate[^>]*>/g) || [];
    const giveHref = rel.startsWith('fr/') ? 'href="https://hub.welfareavenue.com/give/?lang=fr"' : 'href="https://hub.welfareavenue.com/give"';
    ok(donate.length > 0 && donate.every(a => a.includes(giveHref)), rel + ': every donate button goes to the Hub donation page in the page’s language');
    ok(rel === '404.html' || /<meta name="robots" content="noindex">/.test(s), rel + ': preview build is noindex');
  }
  const headers = fs.readFileSync(path.join(OUT, '_headers'), 'utf8');
  ok(/X-Robots-Tag: noindex/.test(headers), '_headers: preview X-Robots-Tag');
  ok(/frame-ancestors 'none'/.test(headers) && /object-src 'none'/.test(headers), '_headers: frame-ancestors and object-src');
  ok(!/'unsafe-inline'|'unsafe-eval'/.test(headers), '_headers: no unsafe-inline or unsafe-eval');
  ok(/Disallow: \//.test(fs.readFileSync(path.join(OUT, 'robots.txt'), 'utf8')), 'robots.txt: preview disallows');
  const sitemap = fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8');
  ok((sitemap.match(/<loc>/g) || []).length === 18 && /hreflang="fr"/.test(sitemap) && !/account|compte/.test(sitemap), 'sitemap: 18 pages with alternates, never the account page');

  // ---------- in the browser ----------
  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
  async function context(opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: opts.width || 1280, height: 900 }, locale: opts.locale || 'en-CA' });
    await attach(ctx);
    const calls = [];
    // wave194: the accounts switch (site.js and forms.js ask it; the account page's own flows are test/w194www.js)
    await ctx.route(SUPA + '/rest/v1/rpc/site_account_config**', route => { calls.push('cfg'); return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: JSON.stringify({ mode: opts.mode || 'off', google_client_id: '', receipts: false }) }); });
    await ctx.route(SUPA + '/rest/v1/rpc/www_upcoming**', route => {
      calls.push('rpc');
      if (opts.rpcFail) return route.fulfill({ status: 500, body: '{}' });
      return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify(opts.rpc || { servings: [{ date: '2031-05-04', city: 'Montreal', title: null }, { date: '2031-05-18', city: 'Montreal', title: 'Holiday serving' }], events: [{ slug: 'gala', title: 'Spring Gala', starts_at: '2031-05-10T23:00:00Z', location: 'Hall', city: 'Montreal', ticket_url: 'https://example.org/t' }] }) });
    });
    await ctx.route(SUPA + '/functions/v1/form-submit**', async route => {
      const req = route.request(), cors = { 'access-control-allow-origin': ORIGIN, 'content-type': 'application/json' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...cors, 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' } });
      if (req.method() === 'GET') {
        const slug = new URL(req.url()).searchParams.get('slug'); calls.push('get:' + slug);
        const pub = opts.published || ['newsletter'];
        if (!pub.includes(slug)) return route.fulfill({ status: 404, headers: cors, body: '{"error":"not found"}' });
        return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ form: { ...FORM, slug }, org: ORG, token: 'tok-' + slug }) });
      }
      const body = JSON.parse(req.postData() || '{}'); calls.push('post:' + JSON.stringify(body));
      const r = opts.post ? opts.post(body) : { status: 200, body: { ok: true, thank_you: 'You are on the list.' } };
      return route.fulfill({ status: r.status, headers: cors, body: JSON.stringify(r.body) });
    });
    // the donation popup (wave161c): the Hub's script and styles from the build, the page inside as a small stand-in
    const GIVE = path.join(__dirname, '..', 'build', 'give');
    await ctx.route('https://hub.welfareavenue.com/give/embed.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(GIVE, 'embed.js')) }));
    await ctx.route('https://hub.welfareavenue.com/give/embed.css', r => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(path.join(GIVE, 'embed.css')) }));
    await ctx.route(/^https:\/\/hub\.welfareavenue\.com\/give\/\?embed=1(&lang=fr)?$/, r => { calls.push('give-frame'); return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Give</title><h1>Give to Welfare Avenue</h1><script>parent.postMessage({wa:"give",type:"height",height:620},"*")</script>' }); });
    // LinkedIn is never reached from the tests: a stand-in page answers for the company posts' embeds
    await ctx.route('https://www.linkedin.com/**', r => { calls.push('linkedin:' + r.request().url()); return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Post</title><p>LinkedIn post</p>' }); });
    const page = await ctx.newPage(); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/status of 404/.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', e => errors.push('pageerror ' + e.message));
    await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
    return { ctx, page, errors, calls };
  }

  // every page, both languages, three widths
  for (const W of [1280, 390, 320]) {
    const { ctx, page, errors } = await context({ width: W });
    for (const p of ALL) {
      errors.length = 0;
      const r = await page.goto(ORIGIN + p, { waitUntil: 'networkidle' });
      ok(r.status() === 200, W + ' ' + p + ': 200');
      const info = await page.evaluate(() => ({
        lang: document.documentElement.lang, h1: document.querySelectorAll('h1').length, title: document.title, sw: document.documentElement.scrollWidth,
        canon: (document.querySelector('link[rel=canonical]') || {}).href, alts: Array.from(document.querySelectorAll('link[rel=alternate][hreflang]')).map(l => l.hreflang + '=' + new URL(l.href).pathname),
        desc: (document.querySelector('meta[name=description]') || {}).content || '', noalt: Array.from(document.images).filter(i => !i.hasAttribute('alt')).length,
        other: (document.querySelector('.nav .lang') || {}).getAttribute ? document.querySelector('.nav .lang').getAttribute('href') : '', csp: window.__csp,
        skip: !!document.querySelector('a.skip[href="#main"]') && !!document.getElementById('main') }));
      const fr = p.startsWith('/fr/');
      ok(info.lang === (fr ? 'fr' : 'en'), W + ' ' + p + ': html lang');
      ok(info.h1 === 1, W + ' ' + p + ': one h1 (' + info.h1 + ')');
      ok(info.sw <= W, W + ' ' + p + ': no sideways scroll (' + info.sw + ')');
      ok(!errors.length, W + ' ' + p + ': no console errors ' + errors.join(' | '));
      ok(!info.csp.length, W + ' ' + p + ': no CSP violation ' + info.csp.join(' | '));
      if (W === 1280) {
        const key = Object.keys(PAGES).find(k => PAGES[k].includes(p));
        ok(info.title && info.desc.length > 60, p + ': title and description');
        ok(info.canon === 'https://welfareavenue.com' + p, p + ': canonical on welfareavenue.com');
        ok(info.alts.includes('en=' + PAGES[key][0]) && info.alts.includes('fr=' + PAGES[key][1]) && info.alts.includes('x-default=' + PAGES[key][0]), p + ': hreflang alternates');
        ok(info.other === PAGES[key][fr ? 0 : 1], p + ': the language switch goes to the same page in the other language');
        ok(info.noalt === 0, p + ': every image has alt');
        ok(info.skip, p + ': skip link');
      }
    }
    await ctx.close();
  }

  // internal links all resolve
  {
    const { ctx, page } = await context();
    const links = new Set();
    for (const p of ALL) { await page.goto(ORIGIN + p, { waitUntil: 'domcontentloaded' }); (await page.evaluate(() => Array.from(document.querySelectorAll('a[href^="/"]')).map(a => a.getAttribute('href')))).forEach(h => links.add(h.split('#')[0])); }
    for (const l of links) { const r = await page.goto(ORIGIN + l, { waitUntil: 'domcontentloaded' }); ok(r.status() === 200, 'internal link ' + l + ' resolves'); }
    ok(links.size >= 14, 'internal links found (' + links.size + ')');
    // old website addresses: every rule lands on a page that exists (Netlify applies them; checked live after deploy)
    const rules = fs.readFileSync(path.join(OUT, '_redirects'), 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => l.trim().split(/\s+/));
    ok(rules.length >= 18 && rules.every(r => r[2] === '301'), 'old addresses: ' + rules.length + ' permanent redirects');
    for (const [from, to] of rules) {
      const target = to.split('#')[0];
      const exists = target.startsWith('https://hub.welfareavenue.com/') || fs.existsSync(path.join(OUT, target, 'index.html'));
      ok(exists, 'old address ' + from + ' -> ' + to + ' lands on a page');
    }
    for (const must of ['/about/gallery', '/activity/volunteer/*', '/activity/fundraising/*', '/activity/donate-essentials', '/signup', '/signin']) ok(rules.some(r => r[0] === must), 'old address covered: ' + must);
    const r404 = await page.goto(ORIGIN + '/no-such-page', { waitUntil: 'domcontentloaded' });
    ok(r404.status() === 404 && /Page not found/.test(await page.textContent('h1')), 'unknown address: 404 page');
    await ctx.close();
  }

  // the menu on a phone
  {
    const { ctx, page } = await context({ width: 390 });
    await page.goto(ORIGIN + '/', { waitUntil: 'networkidle' });
    ok(await page.isVisible('.top .donate-m') && !(await page.isVisible('#nav')), 'phone: donate button shown, menu closed');
    await page.click('.menu-btn');
    ok(await page.isVisible('#nav') && (await page.getAttribute('.menu-btn', 'aria-expanded')) === 'true', 'phone: menu opens');
    await page.keyboard.press('Escape');
    ok(!(await page.isVisible('#nav')) && (await page.getAttribute('.menu-btn', 'aria-expanded')) === 'false', 'phone: Escape closes the menu');
    await ctx.close();
  }

  // the next servings: the build's copy first, the Hub's list next, and the copy stays if the Hub is down
  {
    const { ctx, page, calls } = await context();
    await page.goto(ORIGIN + '/events/', { waitUntil: 'networkidle' });
    const items = await page.$$eval('[data-upcoming] li', ls => ls.map(l => l.textContent));
    ok(calls.includes('rpc'), 'upcoming: asks the Hub');
    ok(items.length === 3 && /Sunday serving/.test(items[0]) && /Spring Gala/.test(items[1]) && /Holiday serving/.test(items[2]), 'upcoming: servings and fundraisers in date order (' + items.join(' / ') + ')');
    ok(await page.$eval('[data-upcoming] li:nth-child(2) a', a => a.href === 'https://example.org/t' && a.rel === 'noopener'), 'upcoming: a fundraiser links to its tickets');
    await page.goto(ORIGIN + '/', { waitUntil: 'networkidle' });
    ok((await page.$$('[data-upcoming] li')).length === 2 && !(await page.textContent('[data-upcoming]')).includes('Gala'), 'home: servings only');
    await ctx.close();
    const c2 = await context({ rpcFail: true });
    await c2.page.goto(ORIGIN + '/volunteer/', { waitUntil: 'networkidle' });
    const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', 'www', 'data', 'upcoming.json'), 'utf8'));
    const today = new Date().toISOString().slice(0, 10), future = seed.servings.filter(s => s.date >= today).length;
    const n = (await c2.page.$$('[data-upcoming] li')).length;
    ok(n === Math.min(5, future) && n > 0, 'upcoming: the build\'s copy stays when the Hub is down (' + n + ')');
    await c2.ctx.close();
    const c3 = await context({ rpc: { servings: [{ date: '2001-01-07', city: 'Montreal' }], events: [] } });
    await c3.page.goto(ORIGIN + '/fr/benevolat/', { waitUntil: 'networkidle' });
    ok((await c3.page.$$('[data-upcoming] li')).length === 0 && /bientôt/.test(await c3.page.textContent('[data-upcoming] .upcoming-note')), 'upcoming: past dates drop off, French note shows');
    await c3.ctx.close();
  }

  // forms from the Hub
  {
    const { ctx, page, calls } = await context({ published: ['newsletter'] });
    await page.goto(ORIGIN + '/contact/', { waitUntil: 'networkidle' });
    ok(calls.includes('get:contact') && calls.includes('get:newsletter'), 'forms: asks the Hub for each form');
    ok(/Write to us at/.test(await page.textContent('[data-wa-form="contact"]')), 'forms: a draft keeps the page\'s own message');
    ok(await page.isVisible('[data-wa-form="newsletter"] form') && !(await page.$('[data-wa-form="newsletter"] form h3')), 'forms: the published newsletter shows, compact (no second title)');
    await page.click('[data-wa-form="newsletter"] .waf-send');
    ok((await page.$$('[data-wa-form="newsletter"] .err')).length === 3 && /check the answers/.test(await page.textContent('[data-wa-form="newsletter"] .waf-banner')), 'forms: missing answers are marked (name, email, permission)');
    await page.fill('[data-wa-form="newsletter"] input[name="first_name"]', 'Test');
    await page.fill('[data-wa-form="newsletter"] input[name="email"]', 'test@example.org');
    await page.check('[data-wa-form="newsletter"] input[name="_consent"]');
    await page.click('[data-wa-form="newsletter"] .waf-send');
    await page.waitForSelector('[data-wa-form="newsletter"] .waf-done');
    const post = calls.find(c => c.startsWith('post:')), body = post && JSON.parse(post.slice(5));
    ok(body && body.slug === 'newsletter' && body.token === 'tok-newsletter' && body.consent === true && body.hp === '' && body.answers.email === 'test@example.org' && body.lang === 'en', 'forms: posts slug, token, answers, permission and the empty hidden field');
    ok(/You are on the list/.test(await page.textContent('[data-wa-form="newsletter"]')), 'forms: the thank-you shows');
    await ctx.close();
    const c2 = await context({ published: ['newsletter'], post: () => ({ status: 429, body: { error: 'rate' } }) });
    await c2.page.goto(ORIGIN + '/fr/', { waitUntil: 'networkidle' });
    ok(c2.calls.includes('get:infolettre') && c2.calls.includes('get:newsletter') && await c2.page.isVisible('[data-wa-form] form'), 'forms: French falls back to the English newsletter while the French one is a draft');
    await c2.page.fill('[data-wa-form] input[name="first_name"]', 'Test'); await c2.page.fill('[data-wa-form] input[name="email"]', 'a@b.co'); await c2.page.check('[data-wa-form] input[name="_consent"]');
    await c2.page.click('[data-wa-form] .waf-send'); await c2.page.waitForSelector('[data-wa-form] .waf-banner');
    ok(/Too many tries/.test(await c2.page.textContent('[data-wa-form] .waf-banner')) && (await c2.page.inputValue('[data-wa-form] input[name="email"]')) === 'a@b.co', 'forms: rate limit says so and keeps the answers');
    await c2.ctx.close();
    const c3 = await context({ published: ['volunteer', 'toronto-volunteer'] });
    await c3.page.goto(ORIGIN + '/volunteer/', { waitUntil: 'networkidle' });
    ok(await c3.page.isVisible('[data-wa-form="volunteer"] form h3'), 'forms: the volunteer form shows with its title');
    ok(!(await c3.page.isVisible('[data-wa-form="toronto-volunteer"] form')), 'forms: Toronto stays folded until asked');
    await c3.page.click('#toronto summary');
    ok(await c3.page.isVisible('[data-wa-form="toronto-volunteer"] form'), 'forms: Toronto opens');
    const ids = await c3.page.$$eval('[data-wa-form] input[id]', els => els.map(e => e.id));
    ok(new Set(ids).size === ids.length, 'forms: two forms on one page keep unique ids');
    await c3.ctx.close();
  }

  // photos, posters and videos
  {
    const { ctx, page } = await context();
    await page.goto(ORIGIN + '/events/', { waitUntil: 'networkidle' });
    ok((await page.$$('#photos [data-full]')).length === 24 && (await page.$$('#past li')).length === 16, 'events: 24 photos and 16 past events');
    ok((await page.$$('#fundraisers .fundnext li')).length === 4 && (await page.$$('#fundphotos [data-full]')).length === 12, 'events: 4 fundraisers coming up and 12 fundraiser photos');
    for (const im of await page.$$('#fundphotos img, #past img')) await im.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const brokenF = await page.evaluate(() => Array.from(document.querySelectorAll('#fundphotos img, #past img')).filter(i => !(i.complete && i.naturalWidth > 0)).map(i => i.getAttribute('src')));
    ok(!brokenF.length, 'events: every fundraiser photo and poster loads ' + brokenF.join(' '));
    /* wave168: the page opens on a photo; fundraisers coming up show their last edition or the brand's E; a past event with no poster is branded */
    const w168 = await page.evaluate(() => {
      const hero = document.querySelector('.hero'), him = hero && hero.querySelector('.bg img');
      const cards = Array.from(document.querySelectorAll('#fundraisers .fundnext li')).map(li => { const cm = li.querySelector('.cm'); const im = cm && cm.querySelector('img:not(.s)'); return { brand: !!(cm && cm.classList.contains('brand')), e: !!(cm && cm.querySelector('svg.e')), img: im ? { alt: im.alt, ok: im.complete && im.naturalWidth > 0, src: im.getAttribute('src') } : null, tag: (cm && cm.querySelector('.tag') || {}).textContent || '' }; });
      const ph = document.querySelector('#past .ph');
      return { hero: !!hero, heroImg: him && { alt: him.alt, ok: him.complete && him.naturalWidth > 0, eager: him.getAttribute('fetchpriority') === 'high' }, h1: (hero && hero.querySelector('h1') || {}).textContent, cards, ph: ph && { e: !!ph.querySelector('svg.e'), t: ph.textContent.trim() } };
    });
    ok(w168.hero && w168.heroImg && w168.heroImg.ok && w168.heroImg.eager && /celebrates/.test(w168.heroImg.alt) && w168.h1 === 'Our activities', 'events (www2): opens on a photo, the title over it ' + JSON.stringify(w168.heroImg));
    ok(w168.cards.length === 4 && w168.cards[0].brand && w168.cards[0].e && !w168.cards[0].img && w168.cards[1].img && w168.cards[1].img.ok && /gift-baskets-the-crew/.test(w168.cards[1].img.src) && w168.cards[1].tag === 'The 2025 drive' && w168.cards[1].img.alt.length > 20
      && w168.cards[2].img && /flag-football-team-in-yellow/.test(w168.cards[2].img.src) && w168.cards[2].tag === 'The 2026 tournament' && w168.cards[3].brand && w168.cards[3].e, 'events (wave168): fundraisers coming up with last year\'s photo (said so) or the brand\'s E ' + JSON.stringify(w168.cards));
    ok(w168.ph && w168.ph.e && w168.ph.t === 'Rally Paper 2026', 'events (wave168): a past event without a poster is branded with the E ' + JSON.stringify(w168.ph));
    const past = await page.evaluate(() => Array.from(document.querySelectorAll('#past li .t')).slice(0, 3).map(t => t.textContent));
    ok(past[0] === 'Rally Paper 2026' && /Flag Football Tournament/.test(past[1]) && past[2] === 'Holiday Gift Baskets', 'events: newest past events first (' + past.join(' | ') + ')');
    const dates = await page.$$eval('#past .m', ms => ms.map(m => m.textContent));
    ok(/2026/.test(dates[0]) && /2022/.test(dates[dates.length - 1]), 'events: newest fundraiser first');
    await page.click('#photos [data-full] >> nth=1');
    ok(await page.isVisible('.lb.open') && /2022/.test(await page.textContent('.lb figcaption')), 'viewer opens with the caption');
    await page.keyboard.press('ArrowRight');
    const src2 = await page.getAttribute('.lb img', 'src');
    ok(/2023-10-autumn-plate-served/.test(src2), 'viewer: arrow key moves to the next photo (' + src2 + ')');
    await page.keyboard.press('Escape');
    ok(!(await page.isVisible('.lb.open')) && await page.evaluate(() => document.activeElement.matches('[data-full]')), 'viewer: Escape closes and returns focus');
    await page.goto(ORIGIN + '/press/', { waitUntil: 'networkidle' });
    await page.click('[data-yt="5C7RoUmCMSI"]');
    ok(await page.$eval('.video iframe', f => f.src.startsWith('https://www.youtube-nocookie.com/embed/5C7RoUmCMSI')), 'press: the video loads only when asked, from youtube-nocookie');
    await ctx.close();
  }

  // Donate opens the Hub's donation page in a popup over the page (wave161c), on a computer and on a phone
  for (const W of [1280, 390]) {
    const { ctx, page, calls } = await context({ width: W });
    await page.goto(ORIGIN + '/volunteer/', { waitUntil: 'networkidle' });
    await page.click(W > 1139 ? 'footer [data-wa-donate]' : '.top .donate-m');
    await page.waitForSelector('.wa-dn-back iframe');
    ok(new URL(page.url()).pathname === '/volunteer/', W + ' donate: the visitor stays on the page');
    ok((await page.getAttribute('.wa-dn-back iframe', 'src')) === 'https://hub.welfareavenue.com/give/?embed=1' && (await page.getAttribute('.wa-dn-back iframe', 'allow')) === 'payment *', W + ' donate: the popup shows the Hub\'s donation page, payments allowed');
    const st = await page.evaluate(() => { const b = document.querySelector('.wa-dn-back'); const cs = getComputedStyle(b); return { pos: cs.position, csp: window.__csp.slice() }; });
    ok(st.pos === 'fixed', W + ' donate: the popup\'s styles loaded under the site\'s policy');
    ok(!st.csp.length, W + ' donate: nothing blocked by the policy ' + st.csp.join(' | '));
    await page.keyboard.press('Escape');
    ok(!(await page.$('.wa-dn-back')), W + ' donate: Escape closes it');
    await page.goto(ORIGIN + '/donate/', { waitUntil: 'networkidle' });
    await page.click('main a[data-wa-donate]');
    await page.waitForSelector('.wa-dn-back');
    ok(new URL(page.url()).pathname === '/donate/', W + ' donate page: Give now opens the popup too');
    await ctx.close();
  }

  // About: the team from the Hub and the companies' LinkedIn posts, which load only when asked (wave162)
  ok(/Permissions-Policy: [^\n]*payment=\(self "https:\/\/hub\.welfareavenue\.com"\)/.test(headers), '_headers: payments allowed for the Hub\'s donation frame only');
  ok(/frame-src [^;]*https:\/\/www\.linkedin\.com/.test(headers), '_headers: LinkedIn frames allowed for the company posts');
  for (const [W, lang] of [[1280, 'en'], [390, 'fr']]) {
    const { ctx, page, errors, calls } = await context({ width: W });
    await page.goto(ORIGIN + (lang === 'en' ? '/about/' : '/fr/a-propos/'), { waitUntil: 'networkidle' });
    const t = await page.evaluate(() => ({
      groups: document.querySelectorAll('#team .tgroup').length, people: document.querySelectorAll('#team .team li').length,
      photos: Array.from(document.querySelectorAll('#team img.face')).map(i => [i.getAttribute('src'), i.getAttribute('alt')]),
      initials: document.querySelectorAll('#team .ini').length,
      steel: Array.from(document.querySelectorAll('#team .team li')).map(li => li.textContent).find(x => x.startsWith('Steel')) || '',
      cards: document.querySelectorAll('#companies .lipost').length, frames: document.querySelectorAll('#companies iframe').length }));
    ok(t.groups === 8 && t.people === 41, W + ' about ' + lang + ': the team in 8 groups, 41 people (' + t.groups + ', ' + t.people + ')');
    ok(t.photos.length === 15 && t.initials === 26 && t.photos.every(([src, alt]) => /^\/img\/team\/[a-z]+\.jpg$/.test(src) && alt === ''), W + ' about ' + lang + ': 15 photos, initials for the other 26');
    await page.locator('#team').scrollIntoViewIfNeeded();
    for (const img of await page.$$('#team img.face')) await img.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const broken = await page.evaluate(() => Array.from(document.querySelectorAll('#team img.face')).filter(i => !(i.complete && i.naturalWidth === 192)).map(i => i.src));
    ok(!broken.length, W + ' about ' + lang + ': every team photo loads ' + broken.join(' '));
    ok(t.steel.includes(lang === 'en' ? '23 servings since 2020' : '23 repas du dimanche depuis 2020'), W + ' about ' + lang + ': servings from the volunteer record');
    ok(t.cards === 3 && t.frames === 3, W + ' about ' + lang + ': the three company posts are embedded');
    const fr = await page.evaluate(() => Array.from(document.querySelectorAll('#companies iframe')).map(i => [i.getAttribute('src'), i.getAttribute('height'), i.getAttribute('loading'), i.title]));
    ok(fr[2][0] === 'https://www.linkedin.com/embed/feed/update/urn:li:share:7086448235212328961?collapsed=1' && fr[2][1] === '1070' && /RBC/.test(fr[2][3]) && fr.every(f => f[2] === 'lazy' && /^https:\/\/www\.linkedin\.com\/embed\/feed\/update\/urn:li:(share|ugcPost):\d+\?collapsed=1$/.test(f[0])), W + ' about ' + lang + ': each post at its own address and height, loading lazily');
    await page.locator('#companies').scrollIntoViewIfNeeded();
    for (const f of await page.$$('#companies iframe')) await f.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    const widths = await page.evaluate(() => Array.from(document.querySelectorAll('#companies iframe')).map(i => Math.round(i.getBoundingClientRect().width)));
    ok(widths.every(w => w > 250 && w <= 504), W + ' about ' + lang + ': the posts keep LinkedIn\'s width (' + widths.join(', ') + ')');
    ok(calls.filter(c => c.startsWith('linkedin:')).length >= 3 && !(await page.evaluate(() => window.__csp.length)), W + ' about ' + lang + ': the posts load under the site\'s policy');
    ok(!errors.length, W + ' about ' + lang + ': no console errors ' + errors.join(' | '));
    ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= W, W + ' about ' + lang + ': no sideways scroll');
    await ctx.close();
  }

  // www2 (01/10/26): Edison's design built into the site
  {
    const BAD = /Sing Up|Sing In|teem|generosuty|Cordinator|tax-deductible|10\.000|\$ ?40[.,]000|—/, BAD_EN = /ressources/;  /* "ressources" is right in French */
    for (const f of htmlFiles) { const t = fs.readFileSync(f, 'utf8'), rel = path.relative(OUT, f); ok(!BAD.test(t) && (rel.startsWith('fr/') || !BAD_EN.test(t)), rel + ': no mockup typos, sample figures or em dashes'); }
    const { ctx, page, calls } = await context({ width: 1440 });
    await page.goto(ORIGIN + '/', { waitUntil: 'networkidle' });
    const h = await page.evaluate(() => ({
      logo: (document.querySelector('.top .brand img') || {}).getAttribute ? document.querySelector('.top .brand img').getAttribute('src') : '',
      bg: getComputedStyle(document.querySelector('.top')).backgroundColor,
      nav: Array.from(document.querySelectorAll('.nav .links a:not(.lang)')).map(a => a.textContent),
      cur: (document.querySelector('.nav .links a[aria-current=page]') || {}).textContent,
      side: Array.from(document.querySelectorAll('.nav .side a:not([hidden])')).map(a => [a.textContent, a.getAttribute('href')]),
      acct: Array.from(document.querySelectorAll('[data-acct-link]')).map(a => [a.hidden, getComputedStyle(a).display]),
      h1: document.querySelector('h1 .sr').textContent, heroBtn: !!document.querySelector('.hero [data-wa-donate]'),
      paths: Array.from(document.querySelectorAll('.paths li')).map(li => [li.querySelector('h2').textContent, li.querySelector('a.sq').getAttribute('href'), li.querySelector('a.sq').getAttribute('aria-label')]),
      tiles: document.querySelectorAll('.tiles .tile').length, give: (document.querySelector('.foot .give') || {}).textContent || '' }));
    ok(h.logo === '/assets/logo-green.svg' && h.bg === 'rgb(255, 255, 255)', 'www2 header: white, the logo in green');
    ok(JSON.stringify(h.nav) === JSON.stringify(['Home', 'Volunteer', 'Donate', 'Our activities', 'Press', 'About us']) && h.cur === 'Home', 'www2 header: the menu in Edison\'s order, Home current ' + JSON.stringify(h.nav));
    ok(h.side.length === 2 && h.side[0][1] === '/contact/' && h.side[1][1] === '/volunteer/#apply', 'www2 header: Contact and Sign up on the side ' + JSON.stringify(h.side));
    ok(h.acct.length === 2 && h.acct.every(a => a[0] === true && a[1] === 'none'), 'wave194: the "My account" links stay hidden while accounts are off ' + JSON.stringify(h.acct));
    ok(h.h1 === 'We meet people where they are' && h.heroBtn, 'www2 home: the headline and Make a donation in the hero');
    ok(h.paths.length === 3 && h.paths[0][1] === '/events/#upcoming' && h.paths[1][1] === '/volunteer/' && h.paths[2][1] === '/donate/' && h.paths.every(p => p[2]), 'www2 home: three ways in, each with a named arrow ' + JSON.stringify(h.paths));
    ok(h.tiles === 4 && /Your generosity helps us/.test(h.give), 'www2 home: four figure tiles; the footer asks for a gift');
    await page.goto(ORIGIN + '/volunteer/', { waitUntil: 'networkidle' });
    const v = await page.evaluate(() => ({ roles: Array.from(document.querySelectorAll('#roles .role')).map(r => [r.querySelector('h3').textContent, r.querySelector('.tag').textContent, r.querySelector('a.textlink').getAttribute('href')]),
      steps: Array.from(document.querySelectorAll('.steps li h3')).map(x => x.textContent), apply: !!document.querySelector('#apply [data-wa-form="volunteer"]'), figs: document.querySelectorAll('#apply .fig').length }));
    ok(v.roles.length === 6 && v.roles.every(r => r[1] === 'Montreal' && r[2] === '/volunteer/#apply'), 'www2 volunteer: six opportunity cards, tagged Montreal, each to the form ' + JSON.stringify(v.roles.map(r => r[0])));
    ok(JSON.stringify(v.steps) === JSON.stringify(['Sign up', 'Get confirmed', 'Show up and serve']) && v.apply && v.figs === 2, 'www2 volunteer: how to join, the form and two figures');
    await page.goto(ORIGIN + '/events/', { waitUntil: 'networkidle' });
    const a = await page.evaluate(() => ({ next: (document.querySelector('[data-next]') || {}).textContent, needs: Array.from(document.querySelectorAll('.needs li')).map(li => li.querySelector('.n').textContent + ' ' + li.querySelector('h3').textContent),
      navcur: (document.querySelector('.nav .links a[aria-current=page]') || {}).textContent }));
    ok(a.next === 'Next serving: Sunday, May 4', 'www2 activities: the gold tag shows the next serving from the Hub (' + a.next + ')');
    ok(JSON.stringify(a.needs) === JSON.stringify(['8 Servers', '4 Cooks', '2 Drivers', '2 Dishwashers', '2 Community welcome', '1 Photographer']) && a.navcur === 'Our activities', 'www2 activities: who we need at each serving, from the Hub\'s roster targets ' + JSON.stringify(a.needs));
    await page.goto(ORIGIN + '/donate/', { waitUntil: 'networkidle' });
    const d = await page.evaluate(() => ({ ladder: Array.from(document.querySelectorAll('#give .ladder li b')).map(b => b.textContent), box: !!document.querySelector('#give .givebox a[data-wa-donate]'),
      figs: Array.from(document.querySelectorAll('.figs.six .fig b')).map(b => b.textContent), cols: getComputedStyle(document.querySelector('.figs.six')).gridTemplateColumns.split(' ').length,
      note: (document.querySelector('#give .ladder + .fine') || {}).textContent || '' }));
    ok(JSON.stringify(d.ladder) === JSON.stringify(['$25', '$75', '$250', '$20 a month']) && /grocery orders and recipe book/.test(d.note) && /supports all of our programs/.test(d.note) && d.box,
      'www3 donate: the amounts costed from recipes, with the note that gifts support every program ' + JSON.stringify(d.ladder));
    ok(JSON.stringify(d.figs) === JSON.stringify(['$75,000+', '14,000+', '250+', '4,500+', '35+', '100+']) && d.cols === 3, 'www3 donate: six best-estimate figures, three across ' + JSON.stringify(d.figs));
    const ph = await page.evaluate(() => Array.from(document.querySelectorAll('.foot .who a[href^="tel:"]')).map(a => [a.getAttribute('href'), a.textContent]));
    ok(JSON.stringify(ph) === JSON.stringify([['tel:+14388087754', '(438) 808-7754']]), 'www3 footer: the phone number ' + JSON.stringify(ph));
    await page.click('#give .givebox a[data-wa-donate]'); await page.waitForSelector('.wa-dn-back iframe');
    ok(new URL(page.url()).pathname === '/donate/', 'www2 donate: Give now opens the popup on the page');
    await page.keyboard.press('Escape');
    await page.goto(ORIGIN + '/fr/evenements/', { waitUntil: 'networkidle' });
    const fr = await page.evaluate(() => ({ next: (document.querySelector('[data-next]') || {}).textContent, h1: document.querySelector('h1').textContent, nav: Array.from(document.querySelectorAll('.nav .links a:not(.lang)')).map(a => a.textContent) }));
    ok(/^Prochain repas : dimanche 4 mai$/.test(fr.next) && fr.h1 === 'Nos activités' && fr.nav[3] === 'Nos activités', 'www2 activités (fr): the next serving in French and the French menu (' + fr.next + ')');
    // www3 (01/10/26): the phone on Contact in both languages, the figures in French, the home page's structured data
    await page.goto(ORIGIN + '/contact/', { waitUntil: 'networkidle' });
    const ce = await page.evaluate(() => Array.from(document.querySelectorAll('main a[href^="tel:"]')).map(a => a.textContent));
    await page.goto(ORIGIN + '/fr/contact/', { waitUntil: 'networkidle' });
    const cf = await page.evaluate(() => Array.from(document.querySelectorAll('main a[href^="tel:"]')).map(a => a.textContent).concat(Array.from(document.querySelectorAll('.foot a[href^="tel:"]')).map(a => a.textContent)));
    ok(JSON.stringify(ce) === JSON.stringify(['(438) 808-7754']) && JSON.stringify(cf) === JSON.stringify(['438 808-7754', '438 808-7754']), 'www3 contact: the phone in English and French ' + JSON.stringify([ce, cf]));
    await page.goto(ORIGIN + '/fr/donner/', { waitUntil: 'networkidle' });
    const fd = await page.evaluate(() => ({ figs: Array.from(document.querySelectorAll('.figs.six .fig b')).map(b => b.textContent), ladder: Array.from(document.querySelectorAll('#give .ladder li b')).map(b => b.textContent) }));
    ok(JSON.stringify(fd.figs) === JSON.stringify(['75 000 $+', '14 000+', '250+', '4 500+', '35+', '100+']) && JSON.stringify(fd.ladder) === JSON.stringify(['25 $', '75 $', '250 $', '20 $ par mois']),
      'www3 donner (fr): the figures and amounts in French ' + JSON.stringify(fd));
    await page.goto(ORIGIN + '/', { waitUntil: 'networkidle' });
    const ld = await page.evaluate(() => { try { return JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent); } catch (e) { return {}; } });
    const tiles = await page.evaluate(() => Array.from(document.querySelectorAll('.tiles .tile b')).map(b => b.textContent));
    ok(ld.telephone === '+1-438-808-7754' && ld.email === 'info@welfareavenue.com' && JSON.stringify(tiles) === JSON.stringify(['14,000+', '250+', '4,500+', '600+']), 'www3 home: the four tiles and the phone in the structured data ' + JSON.stringify(tiles));
    await ctx.close();
  }

  // www3 (02/10/26): a browser holding George's old page in its cache asks for the old script; it now reloads into the new site, once
  {
    const OLD = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Welfare Avenue</title><script defer="defer" src="/static/react/static/js/main.35bf1a94.js"></script><link href="/static/react/static/css/main.aaf83bf2.css" rel="stylesheet"></head><body><div id="root"></div></body></html>';
    for (const storage of [true, false]) {
      const { ctx } = await context({ width: 1280 });
      if (!storage) await ctx.addInitScript(() => { Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('blocked'); } }); });
      let served = 0, navs = 0;
      await ctx.route(ORIGIN + '/volunteer/**', async (route) => {
        if (route.request().resourceType() === 'document') { navs++; if (served++ === 0) return route.fulfill({ status: 200, contentType: 'text/html', body: OLD }); }
        return route.fallback();
      });
      const page = await ctx.newPage();
      await page.goto(ORIGIN + '/volunteer/', { waitUntil: 'load' });
      await page.waitForFunction(() => !!document.querySelector('h1'), null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(800);
      const h1 = await page.evaluate(() => (document.querySelector('h1') || {}).textContent || '');
      ok(h1 === 'Volunteer' && navs === 2, 'www3 old cached page' + (storage ? '' : ' (no session storage)') + ': reloads once into the new site (' + h1 + ', ' + navs + ' loads)');
      await ctx.close();
    }
  }

  // accessibility (29/09/26): axe-core (npm i -g axe-core) finds no WCAG 2.1 A/AA or best-practice violation on any page
  {
    let AXE = null; try { AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); } catch (e) { console.log('skip: axe-core is not installed'); }
    if (AXE) for (const W of [1280, 390]) {
      const { ctx, page } = await context({ width: W });
      for (const key of Object.keys(PAGES)) for (const pth of PAGES[key]) {
        await page.goto(ORIGIN + pth, { waitUntil: 'load' }); await page.waitForTimeout(400);
        await page.evaluate(AXE);
        const v = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })).violations.map(x => x.id + ' (' + x.nodes.length + ')'));
        ok(!v.length, W + ' ' + pth + ': no accessibility violations ' + v.join(', '));
      }
      await ctx.close();
    }
  }

  // French pages open the French donation page in the popup (wave162b)
  {
    const { ctx, page, errors, calls } = await context({ width: 1280 });
    await page.goto(ORIGIN + '/fr/', { waitUntil: 'networkidle' });
    await page.locator('[data-wa-donate]:visible').first().click();
    await page.waitForSelector('.wa-dn-back iframe');
    const fr = await page.evaluate(() => ({ src: document.querySelector('.wa-dn-back iframe').getAttribute('src'), label: document.querySelector('.wa-dn-box').getAttribute('aria-label'), close: document.querySelector('.wa-dn-x').getAttribute('aria-label') }));
    ok(fr.src === 'https://hub.welfareavenue.com/give/?embed=1&lang=fr' && fr.label === 'Donner à Welfare Avenue' && fr.close === 'Fermer', 'fr donate: the popup opens the French donation page, its own words in French');
    await page.keyboard.press('Escape');
    await page.goto(ORIGIN + '/fr/donner/', { waitUntil: 'networkidle' });
    const note = await page.evaluate(() => document.body.innerText);
    ok(!/en anglais pour le moment/.test(note), 'fr donate page: no more note that the donation page is in English');
    ok(!errors.length, 'fr donate: no console errors ' + errors.join(' | '));
    await ctx.close();
  }

  // the French hint for French browsers on English pages
  {
    const { ctx, page } = await context({ locale: 'fr-CA' });
    await page.goto(ORIGIN + '/about/', { waitUntil: 'networkidle' });
    ok(await page.isVisible('#langhint') && (await page.getAttribute('#langhint a', 'href')) === '/fr/a-propos/', 'French browser: hint links to the French page');
    await page.click('#langhint button');
    await page.goto(ORIGIN + '/press/', { waitUntil: 'networkidle' });
    ok(!(await page.isVisible('#langhint')), 'French browser: the hint stays closed once dismissed');
    await ctx.close();
    const c2 = await context({ locale: 'en-CA' });
    await c2.page.goto(ORIGIN + '/', { waitUntil: 'networkidle' });
    ok(!(await c2.page.isVisible('#langhint')), 'English browser: no hint');
    await c2.ctx.close();
  }

  await browser.close();
  console.log('w162www: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
