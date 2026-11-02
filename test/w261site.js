/* w261site: the Holiday Gift Basket Drive page's pop-up forms and gift counter (wave261, 16/10/26), offline.
   The live files (build/www/live) are served like Netlify by test/www_serve.js (the real _headers, so the CSP applies);
   form-submit answers with the eight forms' definitions (test/w261forms.json, made from build/data/wa261_forms.py) and
   records each POST; www_campaign_totals answers with gifts_in (616, or 0). For each language and width: the four
   launchers, each pop-up opens on its button (a modal dialog, the form inside, its title), Escape and × close it and give
   the focus back, a link to #give-items opens it from the address, the answers are sent to the right slug with the hidden
   field and the consent, the thank-you shows, no sideways scroll on a phone, no page error, no CSP report; the counter shows
   616 with its bar and hides at 0; the Stripe donate buttons are untouched.
   node test/w261site.js   (SHOTS=<dir> saves screenshots) */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
process.env.WWW_OUT = process.env.WWW_OUT || path.join(__dirname, '..', 'build', 'www', 'live');
const { attach, ORIGIN } = require('./www_serve');
const FORMS = JSON.parse(fs.readFileSync(path.join(__dirname, 'w261forms.json'), 'utf8'));
const SHOTS = process.env.SHOTS || '';
let pass = 0, fail = 0; const out = [];
function ok(n, c, x) { if (c) { pass++; out.push('PASS ' + n); } else { fail++; out.push('FAIL ' + n + (x !== undefined ? ' :: ' + JSON.stringify(x).slice(0, 600) : '')); } }
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  async function open(p, width, giftsIn) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 } });
    await attach(ctx);
    const page = await ctx.newPage();
    const errs = [], posts = [], csp = [];
    page.on('pageerror', e => errs.push(String(e)));
    page.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text()); });
    await ctx.route('https://zwnmulmnvopclzcvytce.supabase.co/**', route => {
      const u = new URL(route.request().url());
      if (u.pathname.endsWith('/functions/v1/form-submit')) {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
        if (route.request().method() === 'POST') { const b = JSON.parse(route.request().postData() || '{}'); posts.push(b); return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, thank_you: (FORMS[b.slug] || {}).form ? FORMS[b.slug].form.thank_you : 'Thanks' }) }); }
        const s = u.searchParams.get('slug');
        if (FORMS[s]) return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(FORMS[s]) });
        return route.fulfill({ status: 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":"not_found"}' });
      }
      if (u.pathname.endsWith('/rpc/www_campaign_totals')) return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ slug: 'gift-basket-drive', raised: 750, donors: 1, gifts: 1, gifts_in: giftsIn, goal: null, gift_goal: 6000 }) });
      if (u.pathname.endsWith('/rpc/site_config') || u.pathname.includes('/rest/v1/')) return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' });
    });
    await ctx.route(/https:\/\/(hub\.welfareavenue\.com|fonts\.(googleapis|gstatic)\.com)\/.*/, route => route.fulfill({ status: 200, contentType: /\.js/.test(route.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
    await page.goto(ORIGIN + p); await page.waitForTimeout(1600);
    return { page, ctx, errs, posts, csp };
  }
  const PAGES = [
    { p: '/gift-basket-drive/', L: 'en', slugs: { 'give-items': 'gift-drive-give', 'wrap-with-us': 'gift-drive-volunteer', sponsor: 'gift-drive-sponsor', 'groups-drive': 'gift-drive-group' }, n: '616', word: 'gifts collected so far' },
    { p: '/fr/paniers-cadeaux/', L: 'fr', slugs: { 'give-items': 'paniers-donner', 'wrap-with-us': 'paniers-benevole', sponsor: 'paniers-entreprises', 'groups-drive': 'paniers-groupes' }, n: '616', word: 'cadeaux recueillis jusqu’ici' }
  ];
  for (const P of PAGES) for (const width of [1366, 390]) {
    const T = P.L + ' ' + width + ': ';
    const o = await open(P.p, width, 616), page = o.page;
    /* the counter */
    const g = await page.evaluate(() => { const b = document.querySelector('[data-dr-gifts]'); if (!b) return null; const bar = b.querySelector('[data-dr="gifts-bar"]'), f = b.querySelector('[data-dr="gifts-fill"]');
      return { hidden: b.hidden, text: b.innerText, bar: bar && !bar.hidden, now: bar && bar.getAttribute('aria-valuenow'), max: bar && bar.getAttribute('aria-valuemax'), w: f && f.style.width, vt: bar && bar.getAttribute('aria-valuetext') }; });
    ok(T + 'counter shows 616 gifts', g && !g.hidden && g.text.indexOf(P.n) >= 0 && g.text.indexOf(P.word) >= 0, g);
    ok(T + 'counter bar toward 6,000', g && g.bar && g.now === '616' && g.max === '6000' && /^10\.2\d*%$/.test(g.w), g);
    ok(T + 'counter says the share of the way', g && /10\s?%/.test(g.text), g && g.text);
    if (SHOTS && width === 1366) await page.locator('#progress').screenshot({ path: path.join(SHOTS, P.L + '_counter.png') });
    /* the launchers */
    const L = await page.evaluate(() => Array.from(document.querySelectorAll('.waf-open')).map(b => ({ t: b.textContent.trim(), c: b.className, ctl: b.getAttribute('aria-controls') })));
    ok(T + 'four launchers', L.length === 4 && ['give-items-form', 'wrap-with-us-form', 'sponsor-form', 'groups-drive-form'].every(id => L.some(x => x.ctl === id)), L);
    ok(T + 'no mailto left in the ways or sponsor cards', await page.evaluate(() => !document.querySelector('#ways a[href^="mailto:"], #sponsors a[href^="mailto:"]')), null);
    ok(T + 'donate buttons untouched (Stripe pop-up)', await page.evaluate(() => document.querySelectorAll('[data-wa-donate][data-wa-campaign="gift-basket-drive"]').length) === 4, null);
    if (SHOTS) await page.locator('#ways').screenshot({ path: path.join(SHOTS, P.L + '_' + width + '_ways.png') });
    for (const id of Object.keys(P.slugs)) {
      const btn = page.locator('[aria-controls="' + id + '-form"]');
      await btn.scrollIntoViewIfNeeded(); await btn.click(); await page.waitForTimeout(500);
      const st = await page.evaluate((id) => { const d = document.getElementById(id + '-form'); const f = d && d.querySelector('form'); const ae = document.activeElement;
        return { open: !!(d && d.open), modal: !!(d && d.matches(':modal')), title: f && f.querySelector('h3') ? f.querySelector('h3').textContent : '', inside: !!(d && d.contains(ae)), q: f ? f.querySelectorAll('[data-q]').length : 0, sx: document.documentElement.scrollWidth - window.innerWidth }; }, id);
      ok(T + id + ': opens as a modal with its form', st.open && st.modal && st.q >= 6 && st.title === FORMS[P.slugs[id]].form.title, st);
      ok(T + id + ': focus inside the pop-up', st.inside, st);
      if (width === 390) {
        const full = await page.evaluate((id) => { const r = document.getElementById(id + '-form').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight }; }, id);
        ok(T + id + ': full screen on a phone', full.w === full.vw && full.h === full.vh, full);
      }
      if (SHOTS && (id === 'give-items' || width === 390)) await page.screenshot({ path: path.join(SHOTS, P.L + '_' + width + '_' + id + '.png') });
      if (id === 'sponsor') { await page.click('#' + id + '-form .waf-x'); } else { await page.keyboard.press('Escape'); }
      await page.waitForTimeout(300);
      const cl = await page.evaluate((id) => ({ open: document.getElementById(id + '-form').open, focus: document.activeElement && document.activeElement.getAttribute('aria-controls'), locked: document.documentElement.classList.contains('waf-locked') }), id);
      ok(T + id + ': ' + (id === 'sponsor' ? '×' : 'Escape') + ' closes it and gives the focus back', !cl.open && cl.focus === id + '-form' && !cl.locked, cl);
    }
    /* send one: the drive's donation pledge (EN at 1366, FR at 390), the volunteer form for the other two */
    const which = width === 1366 ? 'give-items' : 'wrap-with-us', slug = P.slugs[which], sel = '#' + which + '-form';
    await page.click('[aria-controls="' + which + '-form"]'); await page.waitForTimeout(300);
    await page.fill(sel + ' input[name="first_name"]', 'Wa261'); await page.fill(sel + ' input[name="last_name"]', 'Offline');
    await page.fill(sel + ' input[name="email"]', 'wa261.offline@example.com');
    if (which === 'give-items') {
      await page.check(sel + ' input[name="what"][value="toys"]'); await page.fill(sel + ' input[name="how_many"]', '12');
      await page.check(sel + ' input[name="dropoff"][value="pickup"]');
      await page.waitForTimeout(3100);
      await page.click(sel + ' button[type="submit"]'); await page.waitForTimeout(500);
      ok(T + 'the used/new box is required', o.posts.length === 0 && await page.evaluate((s) => /answer|répondre/i.test(document.querySelector(s + ' [data-q="rule_ok"]').innerText), sel), o.posts.length);
      await page.check(sel + ' input[name="rule_ok"][value="yes"]');
    } else {
      await page.fill(sel + ' input[name="phone"]', '514 555 0161');
      await page.check(sel + ' input[name="tasks"][value="wrapping"]'); await page.check(sel + ' input[name="availability"][value="weekend"]');
      await page.check(sel + ' input[name="age_16"][value="yes"]');
      const desc = await page.evaluate((s) => document.querySelector(s + ' input[name="tasks"][value="wrapping"]').closest('label').innerText, sel);
      ok(T + 'the tasks say when', /December|décembre/.test(desc), desc);
      await page.waitForTimeout(3100);
    }
    await page.click(sel + ' button[type="submit"]'); await page.waitForTimeout(700);
    const sent = o.posts[o.posts.length - 1] || {};
    ok(T + which + ': sent to ' + slug, o.posts.length === 1 && sent.slug === slug && sent.answers && sent.answers.email === 'wa261.offline@example.com' && sent.hp === '' && sent.consent === false && sent.lang === P.L, sent);
    const done = await page.evaluate((s) => { const d = document.querySelector(s + ' .waf-done'); return d ? d.innerText : ''; }, sel);
    ok(T + which + ': thank-you shown', done.indexOf(FORMS[slug].form.thank_you.slice(0, 20)) >= 0, done);
    if (SHOTS && width === 1366) await page.screenshot({ path: path.join(SHOTS, P.L + '_thanks.png') });
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    ok(T + 'no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), null);
    ok(T + 'no page errors', o.errs.length === 0, o.errs);
    ok(T + 'no CSP report', o.csp.length === 0, o.csp);
    await o.ctx.close();
  }
  /* an address opens its pop-up; the green band's volunteer button opens the volunteer pop-up; 0 gifts hides the counter */
  {
    const o = await open('/gift-basket-drive/#give-items', 1366, 0), page = o.page;
    ok('address #give-items opens the pop-up', await page.evaluate(() => document.getElementById('give-items-form').open), null);
    ok('0 gifts: the counter stays hidden', await page.evaluate(() => document.querySelector('[data-dr-gifts]').hidden), null);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    await page.click('.on-green a[href="#wrap-with-us"]'); await page.waitForTimeout(400);
    ok('the green band opens the volunteer pop-up', await page.evaluate(() => document.getElementById('wrap-with-us-form').open && location.pathname === '/gift-basket-drive/'), null);
    await o.ctx.close();
  }
  /* without JavaScript the page's own links are there */
  {
    const ctx = await browser.newContext({ javaScriptEnabled: false }); await attach(ctx); const page = await ctx.newPage();
    await page.goto(ORIGIN + '/gift-basket-drive/');
    const links = await page.evaluate(() => Array.from(document.querySelectorAll('[data-wa-popup-id] a')).map(a => a.getAttribute('href')));
    ok('no JavaScript: the four fallback links', links.length === 4 && links.some(h => /^mailto:/.test(h)) && links.some(h => h === '/volunteer/#groups'), links);
    await ctx.close();
  }
  await browser.close();
  console.log(out.join('\n')); console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
