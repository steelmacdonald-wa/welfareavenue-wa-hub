/* w191pjoin.js: wave191o, a partner's form on the volunteer page (build/c/index.html, /c/<the partner's link>), offline.
   A link that is not a volunteer's spot asks volunteer_partner_get: the form says who with and when, how many of the group
   signed up, asks the name, an email or a mobile (one of the two), the role when they cover more than one; checks them; sends
   volunteer_partner_join; then "You are on the team!" with their own page; already on it; closed; French; a test link saves
   nothing; an unknown link is not found; the phone width; no page errors. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PAGE = fs.readFileSync(path.join(__dirname, '..', 'build', 'c', 'index.html'), 'utf8');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 500) : '')); } }
async function open(browser, tok, handler, opts, qs) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1100, height: 900 } }, opts || {}));
  const page = await ctx.newPage();
  const calls = []; const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://hub.welfareavenue.com/c/**', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PAGE }));
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', r => r.fulfill({ status: 404, body: '' }));
  await page.route('https://zwnmulmnvopclzcvytce.supabase.co/storage/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082', 'hex') }));
  await page.route('https://zwnmulmnvopclzcvytce.supabase.co/rest/v1/rpc/**', async r => {
    const req = r.request();
    const call = { fn: req.url().split('/rpc/')[1], body: req.postData() ? JSON.parse(req.postData()) : null };
    calls.push(call);
    const res = await handler(call, calls);
    await r.fulfill({ status: res.status || 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(res.body) });
  });
  await page.goto('https://hub.welfareavenue.com/c/' + tok + (qs || ''));
  await page.waitForTimeout(600);
  return { ctx, page, calls, errors };
}
const TOK = 'abcdef0123456789abcdef01';
const PJ = (over) => Object.assign({ partner: 'Oberoi Financial Group', event_date: '2026-10-18', start: '12:00', location: 'Montreal', code: 'WA-26-22', open: true, joined: 3,
  roles: [{ role: 'server', en: 'Server', fr: 'Bénévole au service' }, { role: 'cook', en: 'Cook', fr: 'Bénévole en cuisine' }] }, over || {});
const handler = (pj, join) => (call) => {
  if (call.fn === 'volunteer_confirm_get') return { body: null };
  if (call.fn === 'volunteer_partner_get') return { body: pj };
  if (call.fn === 'volunteer_partner_join') return { body: join || { ok: true, token: 'newtok1234567890ab', new: true, already: false } };
  return { body: null };
};
const app = p => p.evaluate(() => document.getElementById('app').innerText);
(async () => {
  const browser = await chromium.launch();
  try {
    let f = await open(browser, TOK, handler(PJ()), { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    let t = await app(f.page);
    ok('a partner link: asks for the form after the spot', f.calls.map(c => c.fn).join(',') === 'volunteer_confirm_get,volunteer_partner_get' && f.calls[1].body.p_token === TOK, f.calls.map(c => c.fn));
    ok('who with, when, how many already', /Join us with Oberoi Financial Group/i.test(t) && /Sunday, October 18 · the serving starts at 12:00 pm · Montreal/.test(t) && /3 from your group already signed up/.test(t), t.slice(0, 500));
    ok('the header: Volunteer with Welfare Avenue, the partner', await f.page.evaluate(() => document.getElementById('ey').textContent === 'Volunteer with Welfare Avenue' && document.getElementById('ht').textContent === 'Oberoi Financial Group'));
    ok('the roles they cover, the first chosen', await f.page.evaluate(() => { const r = Array.from(document.querySelectorAll('input[name="pjrole"]')); return r.length === 2 && r[0].checked && r[0].value === 'server'; }));
    ok('why we keep their details', /keeps your name and contact details to organize this serving/.test(t));
    await f.page.click('#pjsend'); await f.page.waitForTimeout(150);
    ok('the first name is needed', /Please enter your first name/.test(await app(f.page)) && !f.calls.some(c => c.fn === 'volunteer_partner_join'));
    await f.page.fill('#pjfirst', 'Priya'); await f.page.fill('#pjlast', 'Shah');
    await f.page.click('#pjsend'); await f.page.waitForTimeout(150);
    ok('an email or a mobile is needed', /Please enter an email or a mobile phone/.test(await app(f.page)));
    await f.page.fill('#pjphone', '514 55'); await f.page.click('#pjsend'); await f.page.waitForTimeout(150);
    ok('the phone is checked', /Please check the phone number/.test(await app(f.page)) && await f.page.evaluate(() => document.getElementById('pjfirst').value === 'Priya'));
    await f.page.fill('#pjphone', '(514) 555-0123'); await f.page.fill('#pjemail', 'priya@oberoi.example'); await f.page.check('input[name="pjrole"][value="cook"]');
    await f.page.click('#pjsend'); await f.page.waitForTimeout(300);
    const j = f.calls.filter(c => c.fn === 'volunteer_partner_join');
    ok('sends the sign-up', j.length === 1 && j[0].body.p_token === TOK && j[0].body.p.first === 'Priya' && j[0].body.p.last === 'Shah' && j[0].body.p.email === 'priya@oberoi.example' && j[0].body.p.phone === '5145550123' && j[0].body.p.role === 'cook' && j[0].body.p.lang === 'en', j);
    t = await app(f.page);
    ok('on the team, with their own page', /You are on the team!/i.test(t) && await f.page.evaluate(() => { const a = document.querySelector('a.pjopen'); return !!a && a.getAttribute('href') === '/c/newtok1234567890ab'; }), t.slice(0, 300));
    ok('phone: nothing scrolls sideways', await f.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/pjoin-done.png', fullPage: true });
    ok('no page errors', f.errors.length === 0, f.errors);
    await f.ctx.close();

    f = await open(browser, TOK, handler(PJ({ roles: [{ role: 'server', en: 'Server', fr: 'Bénévole au service' }] }), { ok: true, token: 'oldtok1234567890ab', new: false, already: true }));
    ok('one role: no question about it', !(await f.page.evaluate(() => !!document.querySelector('input[name="pjrole"]'))));
    await f.page.click('[data-l="fr"]'); await f.page.waitForTimeout(150);
    t = await app(f.page);
    ok('French', /Joignez-vous à nous avec Oberoi Financial Group/i.test(t) && /dimanche 18 octobre · le service commence à 12 h/.test(t) && /Je m’inscris/.test(t), t.slice(0, 400));
    await f.page.fill('#pjfirst', 'Marc'); await f.page.fill('#pjemail', 'marc@oberoi.example'); await f.page.click('#pjsend'); await f.page.waitForTimeout(300);
    const j2 = f.calls.filter(c => c.fn === 'volunteer_partner_join');
    ok('the only role is sent; French is kept', j2.length === 1 && j2[0].body.p.role === 'server' && j2[0].body.p.lang === 'fr', j2);
    ok('already on the team', /Vous faisiez déjà partie de l’équipe/.test(await app(f.page)));
    await f.ctx.close();

    f = await open(browser, TOK, handler(PJ({ open: false })));
    ok('closed: says so, no form', /Sign-ups for this serving are closed/.test(await app(f.page)) && !(await f.page.evaluate(() => !!document.getElementById('pjsend'))));
    await f.ctx.close();
    f = await open(browser, TOK, handler(PJ(), { ok: false, reason: 'closed' }));
    await f.page.fill('#pjfirst', 'Late'); await f.page.fill('#pjemail', 'late@example.com'); await f.page.click('#pjsend'); await f.page.waitForTimeout(300);
    ok('closed while filling it in: says so', /Sign-ups for this serving are closed/.test(await app(f.page)));
    await f.ctx.close();
    f = await open(browser, TOK, handler(PJ()), null, '?test=1');
    await f.page.fill('#pjfirst', 'Test'); await f.page.fill('#pjemail', 'test@example.com'); await f.page.click('#pjsend'); await f.page.waitForTimeout(250);
    ok('a test link: nothing saved', !f.calls.some(c => c.fn === 'volunteer_partner_join') && /You are on the team!/i.test(await app(f.page)));
    await f.ctx.close();
    f = await open(browser, TOK, handler(null));
    ok('an unknown link: not found', /We couldn’t find that link|could not find|We did not find/i.test(await app(f.page)) || /find/i.test(await app(f.page)), await app(f.page));
    await f.ctx.close();
  } catch (e) { fail++; console.log('FAIL exception ' + (e && e.stack || e)); }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
