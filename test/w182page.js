/* w182page.js: the itinerary booklet on the volunteer's page (build/c/index.html, ?it=1), wave182, offline: the season's photo
   and its name, the start chip, the details strip, the route with pins and a checkered final stop, the storage unit with
   its codes and the bins with their photos, what to always bring, the serving, the team leader's steps, after the serving,
   the team with call and text, the notes, the WhatsApp button, the forecast (stubbed open-meteo), French, the update chip,
   print and back, the teaser on the page, ?it=1 before it is sent, cooks, the phone width. Screenshots with SHOTS=<dir>. */
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
/* wave182: the itinerary lives in its own view now (the teaser opens it): the text includes it, then goes back */
const text = async p => {
  const a = await p.evaluate(() => document.getElementById('app').innerText + '\n' + document.body.innerText);
  if (!(await p.evaluate(() => !!document.querySelector('[data-open-it]')))) return a;
  await p.click('[data-open-it]'); await p.waitForTimeout(120);
  const b = await p.evaluate(() => document.getElementById('itv').innerText);
  await p.click('[data-iv="back"]'); await p.waitForTimeout(80);
  return a + '\n' + b;
};
const inItv = async (p, fn) => { const has = await p.evaluate(() => !!document.querySelector('[data-open-it]')); if (has) { await p.click('[data-open-it]'); await p.waitForTimeout(120); } const r = await p.evaluate(fn); if (has) { await p.click('[data-iv="back"]'); await p.waitForTimeout(80); } return r; };
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
const LOOK = { season: 'autumn', hero: { id: 26, path: 'photos/web/2022-10-autumn-crew-at-the-tent.jpg', alt: 'The autumn crew', fx: 0.52, fy: 0.58 }, band: { id: 58, path: 'photos/web/2023-10-autumn-crew-behind-the-table.jpg', alt: '', fx: 0.5, fy: 0.5 } };
const BINS = [{ name_en: 'Dinnerware bin', name_fr: 'Bac de vaisselle', items_en: 'Napkins, plates', items_fr: 'Serviettes, assiettes', photo: 'photos/itinerary/bin-dinnerware.jpg' }, { name_en: 'Clean serving utensils bin', name_fr: 'Bac d’ustensiles', items_en: 'Spoons, tongs', items_fr: 'Cuillères', photo: '' }];
const btxt = p => p.evaluate(() => document.getElementById('itv').innerText);
(async () => {
  const browser = await chromium.launch();
  try {
    const tl = itin('lead_driver', { look: LOOK, times: { start: '11:00', end: '14:30', at: 'storage', serve: '12:00' }, pickups: [], dropoffs: [{ name: 'Fabrice', stay: true }],
      storage_place: '888 Rue Saint-Antoine W, Montréal, QC H3C 4G3. Unit 1253: as you enter, turn right.', storage_access: 'Door *8694539#; Locker 2665', dish_place: 'Old Brewery Mission, 915 Clark Street, Montréal, QC H2Z 1J2. Ask for Rafael.',
      audit_url: 'https://forms.gle/1FqxfNeVq1ZorJUj8', bins: BINS, carry_en: ['The tent', 'Tables (3 at most)'], carry_fr: ['La tente'], whatsapp_url: 'https://chat.whatsapp.com/ABC123', updated: false });
    const wx = async page => { await page.route('https://api.open-meteo.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ daily: { time: ['2026-10-04'], weather_code: [61], temperature_2m_max: [13.4], temperature_2m_min: [6.2], precipitation_probability_max: [60] } }) })); };
    /* 1. the team leader, opened straight from the text (?it=1) */
    let f = await open(browser, TOK, () => ({ body: base('team_leader', { role_en: 'Team leader', itinerary: tl, times: tl.times, look: LOOK, event_date: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10) }) }), { viewport: { width: 420, height: 900 } }, '?it=1');
    await wx(f.page); await f.page.reload(); await f.page.waitForTimeout(900);
    let t = await btxt(f.page);
    ok('opens straight on the itinerary', await f.page.evaluate(() => document.body.classList.contains('itv') && getComputedStyle(document.querySelector('main')).display === 'none'));
    ok('hero: the season and the role', /Your itinerary · Autumn/i.test(t) && /Team leader/i.test(t), t.slice(0, 300));
    ok('hero: the season photo', await f.page.evaluate(() => /2022-10-autumn-crew-at-the-tent\.jpg/.test(document.querySelector('.ih').getAttribute('style'))));
    ok('hero: you start at 11:00 am', /You start at 11:00 am/.test(t));
    ok('strip: date, serving, location, you start', /Serving time 12:00 pm/i.test(t) && /1500 Rue Berri/.test(t) && /At the storage unit/.test(t), t.slice(0, 700));
    ok('actions: directions, WhatsApp, the ops line', await f.page.evaluate(() => !!document.querySelector('.acts a.pri[href*="maps/dir"]') && !!document.querySelector('.acts a.wa[href="https://chat.whatsapp.com/ABC123"]') && !!document.querySelector('.acts a[href="sms:+14388087754"]')));
    ok('forecast for the day', /Light rain, High 13°, low 6°/.test(t) && /60% chance of rain/.test(t), t.slice(0, 900));
    ok('route: storage stop with the codes, a checkered final stop', /Storage unit/i.test(t) && await f.page.evaluate(() => Array.from(document.querySelectorAll('.code span')).map(x => x.textContent).join('|') === 'Door *8694539#|Locker 2665' && !!document.querySelector('ol.route .pin.flag svg')));
    ok('storage: the bins with their photos, and always bring', /Dinnerware bin/.test(t) && /Napkins, plates/.test(t) && /Always bring/i.test(t) && /Tables \(3 at most\)/.test(t)
      && await f.page.evaluate(() => /bin-dinnerware\.jpg/.test(document.querySelector('.bin .im').getAttribute('style') || '') && !!document.querySelectorAll('.bin .im')[1].querySelector('svg')));
    ok('the serving: drop-offs', /Cooks dropping off their food: Fabrice \(staying to serve\)/.test(t));
    ok('team leader: the extra steps and the audit form', /Your extra steps/i.test(t) && /scans the QR code/.test(t) && await f.page.evaluate(() => !!document.querySelector('#itv a[href="https://forms.gle/1FqxfNeVq1ZorJUj8"]')));
    ok('after: Old Brewery Mission, then storage', /Old Brewery Mission/.test(t) && /915 Clark Street/.test(t) && /Bring the equipment back/.test(t));
    ok('team: call and text, not for me', /Melissa Keza/.test(t) && await f.page.evaluate(() => !!document.querySelector('.team a[href="tel:+14382212053"]') && !!document.querySelector('.team a[href="sms:+14382212053"]')));
    ok('notes and the thank-you band', /Important notes/i.test(t) && /Sanitize your hands/.test(t) && /Thank you for being a crucial part/i.test(t) && await f.page.evaluate(() => /2023-10-autumn-crew-behind-the-table/.test(document.querySelector('.ifoot').getAttribute('style'))));
    ok('test-free: no test banner', !/Test link/.test(t));
    ok('no sideways scroll (phone width)', await noScroll(f.page));
    ok('no page errors', f.errors.length === 0, f.errors);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/01-team-leader-booklet.png', fullPage: true });
    await f.page.click('[data-l="fr"]'); await f.page.waitForTimeout(150);
    t = await btxt(f.page);
    ok('French', /Votre itinéraire · Automne/i.test(t) && /Bac de vaisselle/.test(t) && /Début pour vous : 11 h/.test(t) && /Groupe WhatsApp/.test(t) && /Max\. 13°, min\. 6°/.test(t), t.slice(0, 500));
    await f.page.click('[data-l="en"]'); await f.page.waitForTimeout(100);
    await f.page.click('[data-iv="back"]'); await f.page.waitForTimeout(150);
    ok('back to the page: the teaser', await f.page.evaluate(() => !document.body.classList.contains('itv') && !!document.querySelector('[data-open-it]') && !/it=1/.test(location.search)));
    await f.page.click('[data-open-it]'); await f.page.waitForTimeout(150);
    ok('the teaser opens it again', await f.page.evaluate(() => document.body.classList.contains('itv') && /it=1/.test(location.search)));
    ok('print button', await f.page.evaluate(() => !!document.querySelector('[data-iv="print"]')));
    await f.ctx.close();

    /* 2. the pickup driver: numbered stops, call and text each cook, the route; no bins */
    const pick = itin('lead_driver', { look: LOOK, times: { start: '10:45', end: '14:30', at: 'pickup', serve: '12:00', driver_kind: 'pickup' }, route_url: 'https://www.google.com/maps/dir/a/b/c',
      pickups: [{ name: 'Navpreet', phone: '5142990421', address: '3867 Boulevard de la Concorde Est', neighbourhood: 'Laval', dish: 'Butter chicken' }, { name: 'Navjot', phone: '2638804854', address: '7570 Av. Stuart #1', postal_code: 'H3N 2R4' }],
      dropoffs: [], bins: BINS, carry_en: ['The tent'], storage_place: '888 Rue Saint-Antoine W', dish_place: 'Old Brewery Mission', updated: true });
    f = await open(browser, TOK, () => ({ body: base('driver', { role_en: 'Driver', itinerary: pick, times: pick.times, look: LOOK }) }), { viewport: { width: 1100, height: 900 } }, '?it=1');
    t = await btxt(f.page);
    ok('pickup driver: the role, updated chip', /Pickup driver/i.test(t) && /Updated/.test(t));
    ok('pickup driver: numbered stops and tools', await f.page.evaluate(() => { const p = Array.from(document.querySelectorAll('ol.route .pin')).map(x => x.textContent.trim()); return p[0] === '1' && p[1] === '2' && !!document.querySelector('ol.route a[href="sms:+15142990421"]') && !!document.querySelector('.acts a.pri[href="https://www.google.com/maps/dir/a/b/c"]'); }));
    ok('pickup driver: no storage bins, pack up after', !/Pick up the equipment/i.test(t) && /Help the team pack up/.test(t));
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/02-pickup-driver-desktop.png', fullPage: true });
    await f.ctx.close();

    /* 3. a server: meet the team; ?it=1 before it is sent shows the page with a note; cooks have none */
    const sv = itin('serve', { look: Object.assign({}, LOOK, { season: 'winter' }) });
    f = await open(browser, TOK, () => ({ body: base('server', { role_en: 'Server', itinerary: sv, look: sv.look }) }), { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, '?it=1');
    t = await btxt(f.page);
    ok('server: winter, meet the team, the survey note', /Your itinerary · Winter/i.test(t) && /Meet the team/i.test(t) && /Bringing donations/.test(t) && /survey comes by text/.test(t));
    ok('server: no storage', !/Storage unit/i.test(t) && !/Door/.test(t));
    ok('server: no sideways scroll', await noScroll(f.page));
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/03-server-phone.png', fullPage: true });
    await f.ctx.close();
    f = await open(browser, TOK, () => ({ body: base('server', { role_en: 'Server', itinerary: null }) }), null, '?it=1');
    t = await text(f.page);
    ok('not sent yet: the page with a note', /Your itinerary will be here from the day before/.test(t) && await f.page.evaluate(() => !document.body.classList.contains('itv')));
    await f.ctx.close();
    f = await open(browser, TOK, () => ({ body: base('cook', { role_en: 'Cook', itinerary: null, times: { start: '10:45', end: '12:00', at: 'home', serve: '12:00' }, cook_pickup: { areas: [], dropoff_place: '1500 Rue Berri', dropoff_time: '12:00' } }) }));
    ok('cook: no teaser', await f.page.evaluate(() => !document.querySelector('[data-open-it]')));
    await f.ctx.close();
    /* 4. a test link shows the banner in the booklet */
    f = await open(browser, TOK, () => ({ body: base('team_leader', { itinerary: tl, times: tl.times, look: LOOK }) }), null, '?test=1&it=1');
    ok('test link: the banner', /Test link: nothing is saved/.test(await btxt(f.page)));
    await f.ctx.close();
  } catch (e) { fail++; console.log('FAIL exception ' + (e && e.stack || e)); }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
