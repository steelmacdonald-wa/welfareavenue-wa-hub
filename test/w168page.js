/* w168page.js: the public form page's branding (wave168), offline, like w156page.js. The form's cover photo (from
   form-submit v4) sits behind the lockup with a gold star, what the form is for (by kind, in the form's language) and its
   title; no cover means the team under the tent; a photo that does not load leaves the green band; the thank-you shows the
   E that moves, a heart and the brand line; a French form has no English brand line; a closed form keeps its photo and
   names itself above "This form is closed."; the phone layout holds. Pictures are served from the scratchpad copies of the
   public storage (IMG=<dir>, default the session scratchpad's img/). Screenshots with SHOTS=<dir>. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PAGE = fs.readFileSync(path.join(__dirname, '..', 'build', 'f', 'index.html'), 'utf8');
const SHOTS = process.env.SHOTS || '';
const IMG = process.env.IMG || '/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/img';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 500) : '')); } }
const ST = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/';
const FORM = {
  slug: 'volunteer', title: 'Volunteer with Welfare Avenue', lang: 'en', kind: 'volunteer', thank_you: 'Thank you for signing up to serve.',
  intro: 'Welfare Avenue serves free, home-cooked meals in Montreal.',
  cover: { url: ST + 'photos/web/2024-10-autumn-volunteers-plating.jpg', fx: 0.42, fy: 0.45, alt: 'Two volunteers plate food side by side.' },
  questions: [
    { id: 'first_name', type: 'text', label: 'First name', required: true, help: '', options: [] },
    { id: 'email', type: 'email', label: 'Email', required: true, help: '', options: [] }
  ],
  consent: { ask: false }
};
const ORG = { name: 'Welfare Avenue', address: 'Welfare Avenue, 8200 av Bloomfield, Montreal QC H3N 2H9', email: 'info@welfareavenue.com', charity: '713048502RR0001' };

async function open(browser, slug, handler, opts, noImages) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1100, height: 900 } }, opts || {}));
  const page = await ctx.newPage();
  const calls = [], errs = [], imgs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('https://hub.welfareavenue.com/f/**', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PAGE }));
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', r => r.fulfill({ status: 404, body: '' }));
  await page.route('**/storage/v1/object/public/content-images/**', r => {
    const rel = r.request().url().split('/content-images/')[1].split('?')[0]; imgs.push(rel);
    const fp = path.join(IMG, rel);
    if (!noImages && fs.existsSync(fp)) return r.fulfill({ contentType: /\.png$/.test(fp) ? 'image/png' : 'image/jpeg', body: fs.readFileSync(fp) });
    return r.fulfill({ status: 404, body: '' });
  });
  await page.route('https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/form-submit**', async r => {
    const req = r.request();
    const call = { method: req.method(), body: req.postData() ? JSON.parse(req.postData()) : null };
    calls.push(call);
    const res = await handler(call, calls);
    await r.fulfill({ status: res.status || 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': 'https://hub.welfareavenue.com' }, body: JSON.stringify(res.body) });
  });
  await page.goto('https://hub.welfareavenue.com/f/' + slug);
  await page.waitForTimeout(900);
  return { ctx, page, calls, errs, imgs };
}
const band = p => p.evaluate(() => {
  const b = document.getElementById('band'), cs = getComputedStyle(b);
  return { cls: b.className, bg: b.style.backgroundImage, pos: b.style.backgroundPosition, ey: (document.getElementById('ey') || {}).textContent, h1: (document.getElementById('ht') || {}).textContent,
    lockup: !!b.querySelector('svg.lockup'), star: !!b.querySelector('img.star'), cardH1: document.querySelectorAll('#app h1').length, h1s: document.querySelectorAll('h1').length,
    foot: document.getElementById('foot').innerText, minH: parseFloat(cs.minHeight), bandH: b.getBoundingClientRect().height };
});

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  try {
    /* 1. the volunteer form with its own cover */
    let f = await open(browser, 'volunteer', c => c.method === 'GET' ? { body: { form: FORM, org: ORG, token: '1790000000.abc' } } : { body: { ok: true, message: FORM.thank_you } });
    let b = await band(f.page);
    ok('the form\'s cover sits behind the band once it has loaded, held where the Photo library says', /2024-10-autumn-volunteers-plating\.jpg/.test(b.bg) && b.pos === '42% 45%' && /ready/.test(b.cls) && !/\bph\b/.test(b.cls), b);
    ok('the band carries the lockup, a gold star, what the form is for and the title (one h1, not repeated in the card)', b.lockup && b.star && b.ey === 'Volunteer with us' && b.h1 === FORM.title && b.cardH1 === 0 && b.h1s === 1, b);
    ok('the card opens with the gold rule and the intro', await f.page.evaluate(() => { const a = document.getElementById('app'); const first = a.querySelector('form').firstElementChild; return first && first.classList.contains('rule') && /home-cooked meals/.test(a.querySelector('.intro').textContent); }));
    ok('the footer opens with the brand line', /^Service is solidarity, not charity\./i.test(b.foot), b.foot);
    ok('the title is the page\'s name', (await f.page.title()) === FORM.title + ' · Welfare Avenue');
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/w168_form_desktop.png' });
    /* the thank-you */
    await f.page.fill('#q_first_name', 'Amara'); await f.page.fill('#q_email', 'amara@example.com');
    await f.page.click('#waf button[type=submit]'); await f.page.waitForTimeout(900);
    b = await band(f.page);
    const done = await f.page.evaluate(() => { const d = document.querySelector('#app .done'); return d ? { e: !!d.querySelector('img.e[src$="brand/e-large-gold-600.png"]'), heart: !!d.querySelector('img.heart[src$="brand/doodle-heart-purple.png"]'), line: !!d.querySelector('.brandline'), text: d.innerText } : null; });
    ok('the thank-you: the title band says Thank you!, with the E that moves, a heart and the form\'s message (the brand line stays at the foot, once)', b.h1 === 'Thank you!' && done && done.e && done.heart && !done.line && /signing up to serve/.test(done.text) && /^Service is solidarity/i.test(b.foot), { b, done });
    ok('the thank-you keeps the form\'s photo', /2024-10-autumn-volunteers-plating\.jpg/.test(b.bg), b.bg);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/w168_form_thanks.png' });
    ok('no page errors (the volunteer form)', f.errs.length === 0, f.errs);
    await f.ctx.close();

    /* 2. no cover in the answer: the team under the tent; a newsletter says Stay in touch */
    const NL = Object.assign({}, FORM, { slug: 'newsletter', title: 'Get the Welfare Avenue newsletter', kind: 'newsletter' }); delete NL.cover;
    f = await open(browser, 'newsletter', () => ({ body: { form: NL, org: ORG, token: '1790000000.abc' } }));
    b = await band(f.page);
    ok('no cover: the team under the tent, centred; a newsletter says Stay in touch', /2024-07-summer-team-under-the-tent\.jpg/.test(b.bg) && b.pos === '50% 52%' && b.ey === 'Stay in touch', b);
    await f.ctx.close();

    /* 3. a photo that does not load: the green band stays, nothing breaks */
    f = await open(browser, 'volunteer', () => ({ body: { form: FORM, org: ORG, token: '1790000000.abc' } }), null, true);
    b = await band(f.page);
    ok('a photo that does not load leaves the green band with the title, and no error', /\bph\b/.test(b.cls) && /ready/.test(b.cls) && !b.bg && b.h1 === FORM.title && f.errs.length === 0, { b, errs: f.errs });
    await f.ctx.close();

    /* 4. French: Bénévolat, no English brand line */
    const FR = Object.assign({}, FORM, { slug: 'benevole', title: 'Devenez bénévole', lang: 'fr', thank_you: 'Merci de votre inscription.' });
    f = await open(browser, 'benevole', c => c.method === 'GET' ? { body: { form: FR, org: ORG, token: '1790000000.abc' } } : { body: { ok: true, message: FR.thank_you } });
    b = await band(f.page);
    ok('a French form says Bénévolat and has no English brand line', b.ey === 'Bénévolat' && b.h1 === FR.title && !/Service is solidarity/.test(b.foot), b);
    await f.page.fill('#q_first_name', 'Élodie'); await f.page.fill('#q_email', 'elodie@example.com');
    await f.page.click('#waf button[type=submit]'); await f.page.waitForTimeout(900);
    b = await band(f.page);
    const frDone = await f.page.evaluate(() => (document.querySelector('#app .done') || {}).innerText || '');
    ok('its thank-you is French, with the E and no English line', b.h1 === 'Merci!' && !/Service is solidarity/.test(frDone) && /Merci de votre inscription/.test(frDone), { h1: b.h1, frDone });
    await f.ctx.close();

    /* 5. closed: the form's photo, its title above This form is closed. */
    f = await open(browser, 'volunteer', () => ({ body: { closed: true, title: FORM.title, lang: 'en', kind: 'volunteer', cover: FORM.cover, org: ORG } }));
    b = await band(f.page);
    const closedText = await f.page.evaluate(() => document.getElementById('app').innerText);
    ok('a closed form keeps its photo and names itself above This form is closed.', /2024-10-autumn-volunteers-plating\.jpg/.test(b.bg) && b.ey === FORM.title && b.h1 === 'This form is closed.' && /no longer takes answers/.test(closedText), { b, closedText });
    await f.ctx.close();

    /* 6. not found: the default photo, no eyebrow */
    f = await open(browser, 'nothing-here', () => ({ status: 404, body: { error: 'not_found' } }));
    b = await band(f.page);
    ok('a form that is not there: the default photo, no eyebrow, the message', /summer-team-under-the-tent/.test(b.bg) && b.ey === '' && b.h1 === 'This form is not available.', b);
    await f.ctx.close();

    /* 7. the phone */
    f = await open(browser, 'volunteer', () => ({ body: { form: FORM, org: ORG, token: '1790000000.abc' } }), { viewport: { width: 375, height: 760 }, isMobile: true, hasTouch: true });
    const ph = await f.page.evaluate(() => { const h = document.getElementById('ht').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, w: window.innerWidth, h1right: h.right, h1fs: parseFloat(getComputedStyle(document.getElementById('ht')).fontSize), bandH: document.getElementById('band').getBoundingClientRect().height }; });
    ok('on a phone: no sideways scroll, the title fits, a smaller band', ph.sw <= ph.w && ph.h1right <= ph.w && ph.h1fs <= 36 && ph.bandH >= 250 && ph.bandH < 330, ph);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/w168_form_phone.png' });
    await f.ctx.close();
  } finally { await browser.close(); }
  console.log('\nw168page: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
