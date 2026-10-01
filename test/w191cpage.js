/* w191cpage.js: wave191e on the volunteer's page (build/c/index.html), offline: an invitation from Find volunteers opens on
   Yes or Can't make it whatever the date (state open, invited), in English and French; a sign-up more than 7 days out still
   says there is nothing to confirm yet; Yes saves through volunteer_confirm_submit. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PAGE = fs.readFileSync(path.join(__dirname, '..', 'build', 'c', 'index.html'), 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 400) : '')); } }
function spot(over) {
  return Object.assign({ first: 'Ana', name: 'Ana Novak', role: 'server', role_en: 'Server', role_fr: 'Bénévole au service', event_date: '2026-10-18', event_title: 'Sunday serving', location: 'Montreal', code: 'WA-26-22',
    lang: 'en', format: 'home_cooked', past: false, cancelled: false, state: 'open', invited: true, confirmed_at: null, already: null, answers: null, opens_on: '2026-10-11', confirm_days: 7, start_time: '12:00',
    times: { start: '12:00', end: '14:00', at: 'serving', serve: '12:00' }, details: {}, recipes: [], photo: null,
    events: [{ token: 'abcdef1234567890ab', date: '2026-10-18', role: 'server', role_en: 'Server', role_fr: 'Bénévole au service', location: 'Montreal', current: true, state: 'open' },
             { token: 'zzzzzz1234567890ab', date: '2026-11-01', role: 'server', role_en: 'Server', role_fr: 'Bénévole au service', location: 'Montreal', current: false, state: 'open' }],
    guide: { expect_en: ['Serve with a smile.'], expect_fr: ['Servez avec le sourire.'], bring_en: '', bring_fr: '', arrive_en: '', arrive_fr: '', links: [] } }, over || {});
}
async function open(browser, d, lang) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage(); const calls = []; const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://hub.welfareavenue.com/c/**', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PAGE }));
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', r => r.fulfill({ status: 404, body: '' }));
  await page.route('https://zwnmulmnvopclzcvytce.supabase.co/storage/**', r => r.fulfill({ status: 404, body: '' }));
  await page.route('https://api.open-meteo.com/**', r => r.fulfill({ status: 404, body: '' }));
  await page.route('https://zwnmulmnvopclzcvytce.supabase.co/rest/v1/rpc/**', async r => {
    const req = r.request(); const fn = req.url().split('/rpc/')[1]; const body = req.postData() ? JSON.parse(req.postData()) : null; calls.push({ fn, body });
    let res = null;
    if (fn === 'volunteer_confirm_get') res = Object.assign({}, d, lang ? { lang } : {});
    if (fn === 'volunteer_confirm_submit') res = { ok: true, state: body.p.attending === 'yes' ? 'confirmed' : 'declined' };
    await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(res) });
  });
  await page.goto('https://hub.welfareavenue.com/c/abcdef1234567890ab'); await page.waitForTimeout(600);
  return { ctx, page, calls, errors };
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  try {
    let o = await open(browser, spot());
    let t = await o.page.evaluate(() => document.getElementById('app').innerText);
    ok('an invitation: a warm ask, Yes and Can’t make it, three weeks out', /love to have you on this serving/.test(t) && /Can you make it\?/.test(t) && /Yes, I’ll be there/.test(t) && /I can’t make it/.test(t) && !/nothing to confirm yet/i.test(t), t.slice(0, 400));
    ok('an invitation: the other invited serving is listed to answer', /Your servings/i.test(t) && /To confirm/.test(t), t.slice(-400));
    await o.page.click('#yes'); await o.page.waitForTimeout(500);
    t = await o.page.evaluate(() => document.getElementById('app').innerText);
    const sub = o.calls.filter(c => c.fn === 'volunteer_confirm_submit');
    ok('Yes confirms (through volunteer_confirm_submit, via the link)', sub.length === 1 && sub[0].body.p.attending === 'yes' && sub[0].body.p.via === 'link' && /You’re confirmed!/i.test(t), { sub, t: t.slice(0, 200) });
    ok('no page errors', o.errors.length === 0, o.errors); await o.ctx.close();
    o = await open(browser, spot({ lang: 'fr' }), 'fr');
    t = await o.page.evaluate(() => document.getElementById('app').innerText);
    ok('an invitation in French', /Nous aimerions beaucoup vous compter parmi nous/.test(t) && /Oui, je serai là/.test(t), t.slice(0, 300)); await o.ctx.close();
    o = await open(browser, spot({ invited: false, state: 'early' }));
    t = await o.page.evaluate(() => document.getElementById('app').innerText);
    ok('a sign-up more than 7 days out: still nothing to confirm yet', /signed up/i.test(t) && /nothing to confirm yet/i.test(t), t.slice(0, 300)); await o.ctx.close();
    o = await open(browser, spot({ invited: false, state: 'open', event_date: '2026-10-04' }));
    t = await o.page.evaluate(() => document.getElementById('app').innerText);
    ok('a sign-up inside 7 days: the usual confirm wording', /Please confirm your spot/.test(t) && /Confirm, I will be there/.test(t), t.slice(0, 300)); await o.ctx.close();
  } catch (e) { fail++; console.log('FAIL crashed :: ' + (e && e.stack || e)); }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
