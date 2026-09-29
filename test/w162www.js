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
  press: ['/press/', '/fr/presse/'], contact: ['/contact/', '/fr/contact/'], donate: ['/donate/', '/fr/donner/'] };
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
  ok(htmlFiles.length === 15, 'fifteen pages built (' + htmlFiles.length + ')');
  for (const f of htmlFiles) {
    const s = fs.readFileSync(f, 'utf8'), rel = path.relative(OUT, f);
    ok(!/—/.test(s), rel + ': no em dash');
    ok(!/\sstyle="/i.test(s), rel + ': no inline style attribute');
    ok(!/<script(?![^>]*\b(src=|type="application\/(ld\+)?json"))[^>]*>/i.test(s), rel + ': no inline executable script');
    ok(!/\son[a-z]+="/i.test(s), rel + ': no inline event handler');
    const donate = s.match(/<a [^>]*data-wa-donate[^>]*>/g) || [];
    ok(donate.every(a => a.includes('href="https://hub.welfareavenue.com/give"')), rel + ': every donate button goes to the Hub donation page');
    ok(rel === '404.html' || /<meta name="robots" content="noindex">/.test(s), rel + ': preview build is noindex');
  }
  const headers = fs.readFileSync(path.join(OUT, '_headers'), 'utf8');
  ok(/X-Robots-Tag: noindex/.test(headers), '_headers: preview X-Robots-Tag');
  ok(/frame-ancestors 'none'/.test(headers) && /object-src 'none'/.test(headers), '_headers: frame-ancestors and object-src');
  ok(!/'unsafe-inline'|'unsafe-eval'/.test(headers), '_headers: no unsafe-inline or unsafe-eval');
  ok(/Disallow: \//.test(fs.readFileSync(path.join(OUT, 'robots.txt'), 'utf8')), 'robots.txt: preview disallows');
  const sitemap = fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8');
  ok((sitemap.match(/<loc>/g) || []).length === 14 && /hreflang="fr"/.test(sitemap), 'sitemap: 14 pages with alternates');

  // ---------- in the browser ----------
  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
  async function context(opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: opts.width || 1280, height: 900 }, locale: opts.locale || 'en-CA' });
    await attach(ctx);
    const calls = [];
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
    ok((await page.$$('#photos [data-full]')).length === 24 && (await page.$$('#past li')).length === 14, 'events: 24 photos and 14 past events');
    const dates = await page.$$eval('#past .m', ms => ms.map(m => m.textContent));
    ok(/2025/.test(dates[0]) && /2022/.test(dates[dates.length - 1]), 'events: newest fundraiser first');
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
