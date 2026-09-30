/* w172page.js: the volunteer confirm page (build/c/index.html, wave171 and wave172), offline. The page is served at
   https://hub.welfareavenue.com/c/<token> by route interception and the two RPCs are stubbed: an open spot shows the
   first name, role, date, place and format with Confirm and I can't make it; Confirm sends the token and attending yes
   and shows "You're confirmed" with what to expect, the role's photo, what to bring and when to arrive; reopening a
   confirmed link shows the confirmed state; I can't make it shows the decline and the way back; French follows the
   volunteer's language and the FR button; ?test=1 saves nothing; a past serving and an unknown link say so; nothing
   the page shows is a phone number but the ops line; the phone layout has no sideways scroll. Screenshots with SHOTS=<dir>. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PAGE = fs.readFileSync(path.join(__dirname, '..', 'build', 'c', 'index.html'), 'utf8');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 400) : '')); } }

function spot(over) {
  return Object.assign({
    first: 'Nasim', name: 'Nasim Example', role: 'cook', role_en: 'Cook', role_fr: 'Bénévole en cuisine', event_date: '2026-10-04',
    event_title: 'Sunday serving', location: 'Montreal', code: 'WA-26-21', lang: 'en', format: 'home_cooked', kitchen_place: null, kitchen_shift: null,
    past: false, cancelled: false, state: 'open', confirmed_at: null, already: null, answers: null, opens_on: '2026-09-27', confirm_days: 7,
    details: { recipe_id: null, donations: null, vehicle: null, model: null, car_on_file: null, photos_share: null }, recipes: [], events: [], survey_url: null,
    photo: { path: 'photos/web/2021-02-winter-home-cooked-tray.jpg', alt: 'A tray of food', fx: 0.5, fy: 0.5 },
    guide: { expect_en: ['Cook your dish at home.', 'Your driver texts you 10 minutes before.'], expect_fr: ['Préparez votre plat à la maison.', 'Votre chauffeur vous texte.'],
      bring_en: 'Your dish, packed.', bring_fr: 'Votre plat, emballé.', arrive_en: 'Be ready for pickup.', arrive_fr: 'Soyez prêt.', links: [] }
  }, over || {});
}

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
    const call = { url: req.url(), headers: req.headers(), body: req.postData() ? JSON.parse(req.postData()) : null };
    calls.push(call);
    const res = await handler(call, calls);
    await r.fulfill({ status: res.status || 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(res.body) });
  });
  await page.goto('https://hub.welfareavenue.com/c/' + tok + (qs || ''));
  await page.waitForTimeout(400);
  return { ctx, page, calls, errors };
}
const text = p => p.evaluate(() => document.getElementById('app').innerText + '\n' + document.body.innerText);
const TOK = 'abcdef1234567890ab';

(async () => {
  const browser = await chromium.launch();
  try {
    /* 1. open spot, then confirm */
    let f = await open(browser, TOK, (c) => c.url.endsWith('volunteer_confirm_get') ? { body: spot() } : { body: { ok: true, state: 'confirmed' } });
    let t = await text(f.page);
    ok('open: first name', /Hi Nasim!/i.test(t), t.slice(0, 300));
    ok('open: role, date, place, format', /Cook/.test(t) && /Sunday, October 4/.test(t) && /Montreal/.test(t) && /Home-cooked/.test(t), t.slice(0, 500));
    ok('open: the two answers', /Confirm, I will be there/.test(t) && /can.t make it/.test(t));
    ok('open: get sends the token with the publishable key', f.calls[0].body.p_token === TOK && /^Bearer /.test(f.calls[0].headers.authorization || '') && !!f.calls[0].headers.apikey);
    ok('open: the band shows the role photo', await f.page.evaluate(() => /home-cooked-tray/.test(document.getElementById('band').style.backgroundImage)));
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/01-open.png', fullPage: true });
    await f.page.click('#yes'); await f.page.waitForTimeout(300);
    const sub = f.calls.filter(c => c.url.endsWith('volunteer_confirm_submit'))[0];
    ok('confirm: submit sends attending yes via link', sub && sub.body.p_token === TOK && sub.body.p.attending === 'yes' && sub.body.p.via === 'link', sub && sub.body);
    t = await text(f.page);
    ok('confirmed: the state', /You.re confirmed!/i.test(t) && /The team can see it now/.test(t), t.slice(0, 300));
    ok('confirmed: what to expect as a cook', /What to expect as cook/i.test(t) && /Cook your dish at home/.test(t) && /Your dish, packed/.test(t) && /Be ready for pickup/.test(t), t.slice(0, 900));
    ok('confirmed: the photo', await f.page.evaluate(() => { const p = document.querySelector('.photo'); return !!p && /home-cooked-tray/.test(p.style.backgroundImage); }));
    ok('no phone number but the ops line', !/\d{3}[-. ]?\d{3}[-. ]?\d{4}/.test(t.replace(/438-808-7754/g, '').replace(/713048502RR0001/g, '')), t);
    ok('no page errors', f.errors.length === 0, f.errors);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/02-confirmed.png', fullPage: true });
    await f.ctx.close();

    /* 2. an already confirmed link, then a change of plan */
    f = await open(browser, TOK, (c) => c.url.endsWith('volunteer_confirm_get') ? { body: spot({ state: 'confirmed', confirmed_at: '2026-09-30T14:32:00Z' }) } : { body: { ok: true, state: 'declined' } });
    t = await text(f.page);
    ok('reopened: shows confirmed without asking again', /You.re confirmed!/i.test(t) && !/Confirm, I will be there/.test(t));
    await f.page.click('#cant'); await f.page.waitForTimeout(300);
    t = await text(f.page);
    const sub2 = f.calls.filter(c => c.url.endsWith('volunteer_confirm_submit'))[0];
    ok('decline: sends attending no', sub2 && sub2.body.p.attending === 'no');
    ok('decline: thanks and the way back', /Thanks for letting us know/i.test(t) && /I can come after all/.test(t), t.slice(0, 400));
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/03-declined.png', fullPage: true });
    await f.ctx.close();

    /* 3. French from the volunteer's language, and the EN button */
    f = await open(browser, TOK, (c) => ({ body: spot({ lang: 'fr' }) }));
    t = await text(f.page);
    ok('french: the volunteer’s language', /Bonjour Nasim/i.test(t) && /Bénévole en cuisine/.test(t) && /dimanche 4 octobre/.test(t) && /Je confirme/.test(t), t.slice(0, 400));
    await f.page.click('#langs [data-l="en"]'); await f.page.waitForTimeout(100);
    t = await text(f.page);
    ok('english on request', /Hi Nasim/i.test(t) && /Sunday, October 4/.test(t));
    await f.ctx.close();

    /* 4. test link: nothing saved */
    f = await open(browser, TOK, () => ({ body: spot() }), null, '?test=1');
    t = await text(f.page);
    ok('test: the banner', /Test link: nothing is saved/.test(t));
    await f.page.click('#yes'); await f.page.waitForTimeout(200);
    t = await text(f.page);
    ok('test: shows confirmed without calling submit', /You.re confirmed!/i.test(t) && f.calls.filter(c => c.url.endsWith('volunteer_confirm_submit')).length === 0);
    await f.ctx.close();

    /* 5. a past serving, an unknown link, a kitchen serving */
    f = await open(browser, TOK, () => ({ body: spot({ past: true }) }));
    t = await text(f.page);
    ok('past: says so, no buttons', /already happened/.test(t) && !(await f.page.$('#yes')));
    await f.ctx.close();
    f = await open(browser, TOK, () => ({ body: null }));
    t = await text(f.page);
    ok('unknown link: says so with the ops line', /could not find this link/i.test(t) && /438-808-7754/.test(t));
    await f.ctx.close();
    f = await open(browser, TOK, () => ({ body: spot({ format: 'community_kitchen', kitchen_place: 'La Poubelle Magnifique, 1221 Rue Crescent', kitchen_shift: '9:00 to 12:30' }) }));
    t = await text(f.page);
    ok('kitchen: the format, the kitchen and the shift', /Community kitchen/.test(t) && /1221 Rue Crescent/.test(t) && /9:00 to 12:30/.test(t));
    await f.ctx.close();

    /* 7 (wave172). a serving more than 7 days away: signed up, no confirm button, the calendar and the other servings */
    const EVS = [{ token: TOK, date: '2026-11-15', role: 'cook', role_en: 'Cook', role_fr: 'Bénévole en cuisine', location: 'Montreal', state: 'early', current: true },
                 { token: 'zzzz1234567890ab', date: '2026-12-13', role: 'server', role_en: 'Server', role_fr: 'Bénévole au service', location: 'Montreal', state: 'early', current: false }];
    const RECIPES = [{ id: 1, name: 'Chana Masala and Naan', url: 'https://drive.google.com/file/d/a/view', taken: 2 }, { id: 2, name: 'Pasta Primavera', url: 'https://drive.google.com/file/d/b/view', taken: 0 }];
    f = await open(browser, TOK, (c) => c.url.endsWith('volunteer_confirm_get') ? { body: spot({ state: 'early', event_date: '2026-11-15', opens_on: '2026-11-08', events: EVS, recipes: RECIPES }) } : { body: { ok: true } });
    t = await text(f.page);
    ok('early: signed up, confirming later', /You.re signed up!/i.test(t) && /We will text you on Sunday, November 8 to confirm/.test(t) && !(await f.page.$('#yes')), t.slice(0, 500));
    ok('early: I can’t make it stays', !!(await f.page.$('#cant')));
    ok('early: add to calendar', /Add to your calendar/i.test(t) && await f.page.evaluate(() => { const a = document.querySelector('.cal a'); return !!a && /calendar\.google\.com\/calendar\/render\?action=TEMPLATE/.test(a.href) && /dates=20261115\/20261116/.test(a.href); }));
    ok('early: the other servings with their links', /Your servings/i.test(t) && /Sunday, December 13/.test(t) && await f.page.evaluate(() => !!document.querySelector('.evs a[href="/c/zzzz1234567890ab"]')), t);
    let dl = f.page.waitForEvent('download', { timeout: 4000 }).catch(() => null);
    await f.page.click('.cal button[data-ics]'); const d1 = await dl;
    let icsText = ''; if (d1) { const pth = await d1.path(); icsText = fs.readFileSync(pth, 'utf8'); }
    ok('early: the .ics file', /BEGIN:VEVENT/.test(icsText) && /DTSTART;VALUE=DATE:20261115/.test(icsText) && /Welfare Avenue serving: Cook/.test(icsText), icsText.slice(0, 300));
    ok('cook: the recipes, with how many already chose them', /Which dish will you cook/i.test(t) && /Chana Masala and Naan/.test(t) && /2 cooks already/.test(t));
    await f.page.check('input[name="dish"][value="2"]'); await f.page.waitForTimeout(150);
    ok('cook: the chosen recipe links to itself', await f.page.evaluate(() => /Pasta Primavera/.test(document.body.innerText) && !!document.querySelector('a[href="https://drive.google.com/file/d/b/view"]')));
    await f.page.click('#save'); await f.page.waitForTimeout(300);
    let det = f.calls.filter(c => c.url.endsWith('volunteer_confirm_details'))[0];
    ok('cook: saves the recipe', det && det.body.p_token === TOK && det.body.p.recipe_id === 2, det && det.body);
    ok('cook: saved', /Saved\. Thank you!/.test(await text(f.page)));
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/06-early-cook.png', fullPage: true });
    await f.ctx.close();

    /* 8. server: donations; the links after confirming */
    f = await open(browser, TOK, (c) => c.url.endsWith('volunteer_confirm_get') ? { body: spot({ role: 'server', role_en: 'Server', role_fr: 'Bénévole au service', state: 'confirmed', confirmed_at: '2026-09-28T14:00:00Z',
      guide: { expect_en: ['Set up.'], expect_fr: ['Installez.'], links: [{ label_en: 'Volunteer survey (after the serving)', label_fr: 'Sondage', url: 'https://docs.google.com/forms/x', when: 'after' }, { label_en: 'Bad', url: 'javascript:alert(1)', when: 'after' }] } }) } : { body: { ok: true } });
    t = await text(f.page);
    ok('server: the donations question', /Bringing anything to donate/i.test(t));
    ok('links: grouped, only https and mailto', /Your forms and guides/i.test(t) && /After the serving/i.test(t) && /Volunteer survey/.test(t) && !/\bBad\b/.test(t));
    await f.page.fill('#don', 'Two bags of winter clothes'); await f.page.click('#save'); await f.page.waitForTimeout(300);
    det = f.calls.filter(c => c.url.endsWith('volunteer_confirm_details'))[0];
    ok('server: saves the donations', det && det.body.p.donations === 'Two bags of winter clothes', det && det.body);
    await f.ctx.close();

    /* 9. driver: new (no car on file) and known */
    f = await open(browser, TOK, (c) => c.url.endsWith('volunteer_confirm_get') ? { body: spot({ role: 'driver', role_en: 'Driver', role_fr: 'Bénévole à la livraison', state: 'confirmed' }) } : { body: { ok: true } });
    t = await text(f.page);
    ok('driver: asks for the car', /Your car/i.test(t) && !/Car on file/.test(t) && !!(await f.page.$('#vehicle')) && !!(await f.page.$('#model')));
    await f.page.selectOption('#vehicle', 'SUV'); await f.page.fill('#model', 'Toyota RAV4'); await f.page.click('#save'); await f.page.waitForTimeout(300);
    det = f.calls.filter(c => c.url.endsWith('volunteer_confirm_details'))[0];
    ok('driver: saves type and model', det && det.body.p.vehicle === 'SUV' && det.body.p.model === 'Toyota RAV4', det && det.body);
    ok('driver: then shows the car on file', /Car on file: SUV Toyota RAV4/.test(await text(f.page)));
    await f.ctx.close();
    f = await open(browser, TOK, () => ({ body: spot({ role: 'driver', role_en: 'Driver', state: 'confirmed', details: { car_on_file: 'Kia Soul' } }) }));
    ok('driver: a known car is shown', /Car on file: Kia Soul/.test(await text(f.page)));
    await f.ctx.close();

    /* 10. photographer: how they share */
    f = await open(browser, TOK, (c) => c.url.endsWith('volunteer_confirm_get') ? { body: spot({ role: 'photographer', role_en: 'Photographer', state: 'confirmed',
      guide: { expect_en: ['Shoot.'], links: [{ label_en: 'Add your photos to the Google Photos album', url: 'https://photos.app.goo.gl/x', when: 'after' }, { label_en: 'Or email them to marketing@welfareavenue.com', url: 'mailto:marketing@welfareavenue.com', when: 'after' }] } }) } : { body: { ok: true } });
    t = await text(f.page);
    ok('photographer: the ways to share', /How will you share your photos/i.test(t) && /Google Photos album/.test(t) && await f.page.evaluate(() => !!document.querySelector('a[href^="mailto:marketing@welfareavenue.com"]')));
    await f.page.check('input[name="share"][value="album"]'); await f.page.click('#save'); await f.page.waitForTimeout(300);
    det = f.calls.filter(c => c.url.endsWith('volunteer_confirm_details'))[0];
    ok('photographer: saves the choice', det && det.body.p.photos_share === 'album', det && det.body);
    await f.ctx.close();

    /* 11. after the serving: the survey */
    f = await open(browser, TOK, () => ({ body: spot({ role: 'server', role_en: 'Server', past: true, state: 'confirmed', survey_url: 'https://docs.google.com/forms/d/e/abc/viewform' }) }));
    t = await text(f.page);
    ok('past: the survey', /Take the two-minute survey/i.test(t) && await f.page.evaluate(() => !!document.querySelector('a[href="https://docs.google.com/forms/d/e/abc/viewform"]')));
    await f.ctx.close();

    /* 12. test link: details save nothing */
    f = await open(browser, TOK, () => ({ body: spot({ role: 'server', role_en: 'Server', state: 'confirmed' }) }), null, '?test=1');
    await f.page.fill('#don', 'x'); await f.page.click('#save'); await f.page.waitForTimeout(200);
    ok('test: details not sent', f.calls.filter(c => c.url.endsWith('volunteer_confirm_details')).length === 0 && /Saved/.test(await text(f.page)));
    await f.ctx.close();

    /* 6. phone width */
    f = await open(browser, TOK, (c) => c.url.endsWith('volunteer_confirm_get') ? { body: spot() } : { body: { ok: true, state: 'confirmed' } }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    ok('phone: no sideways scroll (open)', await f.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    const btn = await f.page.$eval('#yes', b => b.getBoundingClientRect().height);
    ok('phone: a big Confirm button', btn >= 48, btn);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/04-phone-open.png', fullPage: true });
    await f.page.click('#yes'); await f.page.waitForTimeout(300);
    ok('phone: no sideways scroll (confirmed)', await f.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/05-phone-confirmed.png', fullPage: true });
    await f.ctx.close();
  } finally { await browser.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
