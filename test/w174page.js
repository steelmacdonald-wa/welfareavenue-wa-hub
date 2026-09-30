/* w174page.js: the volunteer confirm page (build/c/index.html), wave174, offline: the role's times (the When row and timed
   calendar entries), the itinerary by role from the day before (servers, the pickup driver, the only driver, the team
   leader, the Community lead; none for cooks), and the survey tailored to the role (required answers, other answers, a
   0 rating, French, changing answers, closed, test links save nothing). Screenshots with SHOTS=<dir>. */
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


const SQ = [
  { key: 'overall', kind: 'choice', en: 'Overall, how was your experience?', fr: 'Dans l’ensemble, comment s’est passée votre expérience?', required: true, options: [{ v: 'excellent', en: 'Excellent', fr: 'Excellente' }, { v: 'good', en: 'Good', fr: 'Bonne' }] },
  { key: 'needs', kind: 'multi', en: 'Which needs did the people you served tell you about?', fr: 'Quels besoins?', required: true, other: true, options: [{ v: 'food', en: 'Food insecurity', fr: 'Insécurité alimentaire' }, { v: 'clothing', en: 'Clothing', fr: 'Vêtements' }] },
  { key: 'meal_rating', kind: 'scale', en: 'How did people rate the meal?', fr: 'Évaluation du repas', required: true, min: 0, max: 5, help_en: '0 = very poor, 5 = excellent', help_fr: '0 = très mauvais' },
  { key: 'portions', kind: 'number', en: 'About how many portions?', fr: 'Portions?', min: 0, max: 500 },
  { key: 'voices', kind: 'text', en: 'Anything someone told you that we should know?', fr: 'Quelque chose?', help_en: 'Please leave out names.' }
];
const TEAM = [{ name: 'Melissa Keza', role: 'team_leader', role_en: 'Team leader', role_fr: 'Responsable', phone: '4382212053', me: false },
  { name: 'Andres Villate', role: 'driver', role_en: 'Driver', role_fr: 'Chauffeur', kind: 'main', phone: '5148949230', me: false },
  { name: 'Thomas L', role: 'driver', role_en: 'Driver', role_fr: 'Chauffeur', kind: 'pickup', phone: '2028360316', me: false }];
function itin(kind, over) {
  return Object.assign({ kind: kind, serve: '12:00', place: '1500 Rue Berri, Montréal, QC H2L 2C4', meet_spot: 'Maisonneuve side', team: TEAM, format: 'home_cooked',
    notes_en: ['Sanitize your hands and wear gloves when serving.'], notes_fr: ['Lavez-vous les mains.'], times: { start: '12:00', end: '14:00', at: 'serving', serve: '12:00' } }, over || {});
}
function base(role, over) {
  return Object.assign({ first: 'Sam', name: 'Sam Example', role: role, role_en: role, role_fr: role, event_date: '2026-10-04', event_title: 'Sunday serving', location: 'Montreal', code: 'WA-26-21', lang: 'en',
    format: 'home_cooked', past: false, cancelled: false, state: 'confirmed', confirmed_at: '2026-09-28T14:00:00Z', opens_on: '2026-09-27', confirm_days: 7, start_time: '12:00',
    times: { start: '12:00', end: '14:00', at: 'serving', serve: '12:00' }, details: {}, recipes: [], events: [], photo: null,
    guide: { expect_en: ['Serve with a smile.'], expect_fr: ['Servez.'], bring_en: '', bring_fr: '', arrive_en: '', arrive_fr: '', links: [] } }, over || {});
}

const noScroll = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

(async () => {
  const browser = await chromium.launch();
  try {
    /* 1. a server the day before: the serve itinerary and the time */
    let f = await open(browser, TOK, (c) => ({ body: base('server', { role_en: 'Server', itinerary: itin('serve') }) }));
    let t = await text(f.page);
    ok('server: the time row', /When\s*12:00 pm to 2:00 pm/.test(t), t.slice(0, 600));
    ok('server: the itinerary heading and date', /Your itinerary/i.test(t) && /Sunday, October 4 · the serving starts at 12:00 pm/.test(t), t);
    ok('server: meet the team at the spot', /Meet the team/.test(t) && /1500 Rue Berri, Montréal, QC H2L 2C4 \(Maisonneuve side\)/.test(t));
    ok('server: donations hint and the survey note', /Bringing donations\?/.test(t) && /survey comes by text/.test(t));
    ok('server: the team with phones', /Melissa Keza/.test(t) && /438-221-2053/.test(t) && /main driver/.test(t) && /pickup driver/.test(t), t);
    ok('server: the notes', /Sanitize your hands/.test(t));
    ok('server: no pickups or storage', !/storage unit/i.test(t) && !/Open the route/.test(t));
    const g = await f.page.$eval('.cal a', a => a.href);
    ok('calendar: timed in UTC (12:00 to 14:00 EDT)', /dates=20261004T160000Z%2F20261004T180000Z|dates=20261004T160000Z\/20261004T180000Z/.test(g), g);
    ok('no page errors (server)', f.errors.length === 0, f.errors);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/10-server-itinerary.png', fullPage: true });
    await f.ctx.close();

    /* 2. the pickup driver: the cooks, the route, no storage step; names escaped */
    const pick = itin('lead_driver', { times: { start: '10:45', end: '14:30', at: 'pickup', serve: '12:00', driver_kind: 'pickup' },
      pickups: [{ name: 'Navpreet <img src=x onerror=window.__x=1>', phone: '5142990421', address: '3867 Boulevard de la Concorde Est', neighbourhood: 'Laval', dish: 'Butter chicken' }, { name: 'Navjot', phone: '2638804854', address: '7570 Av. Stuart #1', postal_code: 'H3N 2R4' }],
      dropoffs: [{ name: 'Fabrice', stay: true }], route_url: 'https://www.google.com/maps/dir/a/b/c', storage_place: '888 Rue Saint-Antoine W', storage_access: null, dish_place: 'Old Brewery Mission' });
    f = await open(browser, TOK, () => ({ body: base('driver', { role_en: 'Driver', times: pick.times, itinerary: pick }) }));
    t = await text(f.page);
    ok('pickup driver: the start and the pickups', /10:45 am/.test(t) && /Pick up the cooks’ food/.test(t) && /Text each cook about 10 minutes/.test(t) && /Butter chicken/.test(t), t.slice(0, 1500));
    ok('pickup driver: cook phones as call links', await f.page.evaluate(() => !!document.querySelector('a[href="tel:+15142990421"]')));
    ok('pickup driver: the route link', await f.page.evaluate(() => { const a = document.querySelector('a.rt'); return !!a && a.href === 'https://www.google.com/maps/dir/a/b/c'; }));
    ok('pickup driver: no storage step, pack up after', !/Meet at the storage unit/.test(t) && /Help the team pack up/.test(t));
    ok('pickup driver: a name is text, not markup', await f.page.evaluate(() => !window.__x && !document.querySelector('.itin img')));
    ok('pickup driver: the time row 10:45 am to 2:30 pm (the serving 12:00 pm)', /10:45 am to 2:30 pm \(the serving starts at 12:00 pm\)/.test(t));
    await f.ctx.close();

    /* 3. the only driver does both; the team leader: storage with the access, drop-offs, the audit form */
    const both = Object.assign({}, pick, { times: { start: '10:45', end: '14:30', at: 'pickup', serve: '12:00', driver_kind: 'both' }, storage_access: 'Door *1234#' });
    f = await open(browser, TOK, () => ({ body: base('driver', { itinerary: both, times: both.times }) }));
    t = await text(f.page);
    ok('only driver: pickups then the storage unit', /Pick up the cooks’ food/.test(t) && /Then the storage unit/.test(t) && /Door \*1234#/.test(t) && /Old Brewery Mission/.test(t));
    await f.ctx.close();
    const tl = itin('lead_driver', { times: { start: '11:00', end: '14:30', at: 'storage', serve: '12:00' }, pickups: [], dropoffs: [{ name: 'Fabrice', stay: true }, { name: 'Ilias' }],
      storage_place: '888 Rue Saint-Antoine W, unit 1253', storage_access: null, dish_place: 'Old Brewery Mission, 915 Clark Street', audit_url: 'https://forms.gle/1FqxfNeVq1ZorJUj8' });
    f = await open(browser, TOK, () => ({ body: base('team_leader', { role_en: 'Team leader', itinerary: tl, times: tl.times }) }));
    t = await text(f.page);
    ok('team leader: storage at 11:00 am', /11:00 am\s*Meet at the storage unit/.test(t) && /unit 1253/.test(t) && /Text the ops line if you do not have the storage codes/.test(t), t.slice(0, 1500));
    ok('team leader: drop-offs and staying', /Cooks dropping off their food:\s*Fabrice \(staying to serve\), Ilias/.test(t), t.slice(0, 2000));
    ok('team leader: ETA, survey reminder, audit form', /Share your ETA/.test(t) && await f.page.evaluate(() => !!document.querySelector('a[href="https://forms.gle/1FqxfNeVq1ZorJUj8"]')));
    ok('team leader: after, dishwashing and back to storage', /Dishwashing: Old Brewery Mission, 915 Clark Street/.test(t) && /Bring the equipment back/.test(t));
    await f.ctx.close();

    /* 4. the community lead */
    const cl = itin('community', { times: { start: '11:45', end: '14:15', at: 'serving', serve: '12:00' } });
    f = await open(browser, TOK, () => ({ body: base('community_debrief', { role_en: 'Community lead', itinerary: cl, times: cl.times }) }));
    t = await text(f.page);
    ok('community lead: four steps', /11:45 am\s*Arrive and count the clothing/.test(t) && /Welcome people and listen/.test(t) && /Build the community/.test(t) && /Close the day/.test(t), t.slice(0, 1500));
    ok('community lead: the debrief is the survey', /fill in your survey on this page/.test(t));
    await f.ctx.close();

    /* 5. a cook: no itinerary, the pickup time */
    f = await open(browser, TOK, () => ({ body: base('cook', { role_en: 'Cook', times: { start: '10:45', end: '12:00', at: 'home', serve: '12:00' }, itinerary: null, cook_pickup: { areas: ['Mile End'], dropoff_place: '1500 Rue Berri', dropoff_time: '12:00' } }) }));
    t = await text(f.page);
    ok('cook: food ready for pickup from 10:45 am', /Food ready for pickup from 10:45 am/.test(t) && !/Your itinerary/i.test(t), t.slice(0, 600));
    await f.ctx.close();
    f = await open(browser, TOK, () => ({ body: base('cook', { role_en: 'Cook', times: { start: '11:45', end: '12:00', at: 'dropoff', serve: '12:00' }, cook_pickup: { areas: [], dropoff_place: '1500 Rue Berri', dropoff_time: '12:00' } }) }));
    t = await text(f.page);
    ok('cook: drop off by 12:00 pm', /Drop off your food by 12:00 pm/.test(t));
    await f.ctx.close();

    /* 6. the survey on the day: required first, then sent with the answers */
    const sv = { open: true, questions: SQ, answers: null, submitted_at: null };
    f = await open(browser, TOK, (c) => c.url.endsWith('volunteer_confirm_get') ? { body: base('server', { survey: sv, itinerary: itin('serve') }) } : { body: { ok: true } });
    t = await text(f.page);
    ok('survey: first on the day', await f.page.evaluate(() => { const s = document.getElementById('survey'), i = document.getElementById('itinerary'); return !!s && !!i && (s.compareDocumentPosition(i) & 4) > 0; }));
    ok('survey: the questions and the help', /How did it go\?/i.test(t) && /Which needs did the people you served tell you about\?/.test(t) && /0 = very poor, 5 = excellent/.test(t) && /Please leave out names/.test(t));
    await f.page.click('#svsend'); await f.page.waitForTimeout(200);
    t = await text(f.page);
    ok('survey: required ones flagged, nothing sent', /Please answer the questions marked in red/.test(t) && (await f.page.$$('.svq.err')).length === 3 && !f.calls.some(c => c.url.endsWith('volunteer_survey_submit')));
    await f.page.check('input[name="sv_overall"][value="good"]');
    await f.page.check('input[name="sv_needs"][value="food"]');
    await f.page.fill('[data-svother="needs"]', 'Winter boots');
    await f.page.click('.scale .sc:nth-child(5)');
    await f.page.fill('[data-svnum="portions"]', '40');
    await f.page.fill('[data-svtext="voices"]', 'A regular said thank you.');
    await f.page.click('#svsend'); await f.page.waitForTimeout(300);
    const s1 = f.calls.filter(c => c.url.endsWith('volunteer_survey_submit'))[0];
    const A = s1 && s1.body.p.answers;
    ok('survey: sent with the token and the answers', s1 && s1.body.p_token === TOK && A.overall === 'good' && JSON.stringify(A.needs) === JSON.stringify(['food', { other: 'Winter boots' }]) && A.meal_rating === 4 && A.portions === 40 && A.voices === 'A regular said thank you.' && s1.body.p.lang === 'en', s1 && s1.body);
    t = await text(f.page);
    ok('survey: thank you', /Thank you! We got your answers/i.test(t));
    await f.page.click('#svedit'); await f.page.waitForTimeout(200);
    ok('survey: change my answers keeps them', await f.page.evaluate(() => document.querySelector('input[name="sv_overall"][value="good"]').checked && document.querySelector('[data-svnum="portions"]').value === '40' && document.querySelector('[data-svother="needs"]').value === 'Winter boots'));
    ok('no page errors (survey)', f.errors.length === 0, f.errors);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/11-survey.png', fullPage: true });
    await f.ctx.close();

    /* 7. the server says a required answer is missing; the language switch keeps what was typed */
    f = await open(browser, TOK, (c) => c.url.endsWith('volunteer_confirm_get') ? { body: base('server', { past: true, survey: sv }) } : { body: { ok: false, reason: 'required', missing: ['needs'] } });
    await f.page.check('input[name="sv_overall"][value="excellent"]');
    await f.page.fill('[data-svtext="voices"]', 'Merci');
    await f.page.click('#langs button[data-l="fr"]'); await f.page.waitForTimeout(150);
    t = await text(f.page);
    ok('survey FR: the labels, the answers kept', /Comment ça s’est passé\?/i.test(t) && /Excellente/.test(t) && await f.page.evaluate(() => document.querySelector('input[name="sv_overall"][value="excellent"]').checked && document.querySelector('[data-svtext="voices"]').value === 'Merci'));
    await f.page.check('input[name="sv_needs"][value="food"]');
    await f.page.click('.scale .sc:nth-child(1)');
    await f.page.click('#svsend'); await f.page.waitForTimeout(300);
    ok('survey: a zero rating is an answer', (f.calls.filter(c => c.url.endsWith('volunteer_survey_submit'))[0] || { body: { p: { answers: {} } } }).body.p.answers.meal_rating === 0);
    ok('survey: the server’s missing answer is flagged', await f.page.evaluate(() => document.querySelector('[data-svq="needs"]').classList.contains('err')) && /Merci de répondre/.test(await text(f.page)));
    await f.ctx.close();

    /* 8. closed; answered; a test link previews and saves nothing */
    f = await open(browser, TOK, () => ({ body: base('server', { past: true, survey: { open: false, questions: SQ, answers: null } }) }));
    ok('survey closed', /The survey for this serving is closed/.test(await text(f.page)));
    await f.ctx.close();
    f = await open(browser, TOK, () => ({ body: base('server', { past: true, survey: { open: true, questions: SQ, answers: { overall: 'good' }, submitted_at: '2026-10-04T20:00:00Z' } }) }));
    ok('survey answered: thank you and a way to change', /Thank you! We got your answers/i.test(await text(f.page)) && !!(await f.page.$('#svedit')));
    await f.ctx.close();
    f = await open(browser, TOK, (c) => ({ body: base('server', { survey: { open: false, questions: SQ, answers: null }, itinerary: itin('serve') }) }), null, '?test=1');
    ok('test link: asks for the preview', f.calls[0].body.p_preview === true);
    t = await text(f.page);
    ok('test link: the survey preview under the page', /Test preview: the survey opens an hour after the serving starts/.test(t) && /Your itinerary/i.test(t));
    await f.page.check('input[name="sv_overall"][value="good"]'); await f.page.check('input[name="sv_needs"][value="clothing"]'); await f.page.click('.scale .sc:nth-child(3)');
    await f.page.click('#svsend'); await f.page.waitForTimeout(200);
    ok('test link: the survey saves nothing', /Thank you! We got your answers/i.test(await text(f.page)) && !f.calls.some(c => c.url.endsWith('volunteer_survey_submit')));
    await f.ctx.close();

    /* 9. the other servings carry their own times in the calendar */
    f = await open(browser, TOK, () => ({ body: base('server', { events: [
      { token: TOK, date: '2026-10-04', role: 'server', role_en: 'Server', location: 'Montreal', current: true, state: 'confirmed', times: { start: '12:00', end: '14:00' } },
      { token: 'zzzzzzzzzzzzzzzz12', date: '2026-12-13', role: 'server', role_en: 'Server', location: 'Montreal', current: false, state: 'early', times: { start: '12:00', end: '14:00' } }] }) }));
    const hrefs = await f.page.$$eval('.evs a[href*="calendar.google"]', as => as.map(a => a.href));
    ok('calendar: winter serving in EST (17:00Z)', hrefs.some(h => /20261213T170000Z/.test(h)), hrefs);
    await f.ctx.close();

    /* 10. phone width with the itinerary and the survey */
    f = await open(browser, TOK, () => ({ body: base('driver', { itinerary: both, times: both.times, survey: { open: true, questions: SQ } }) }), { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    ok('phone: no sideways scroll (itinerary and survey)', await noScroll(f.page));
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/12-phone-driver.png', fullPage: true });
    await f.ctx.close();
  } finally { await browser.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
