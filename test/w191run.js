/* w191run.js: wave191m, the worked-out run on the volunteer's page (build/c/index.html), offline.
   Steel (01/10/26): "we should provide them with a working google maps trajectory link of a starting point, all the stops on
   the way and how long in order to calculate their starting time". With a run from serving-run (wa174_itinerary.run/after):
   the pickup driver's booklet shows when they start, how many stops and how long, the whole route in Google Maps (from where
   they are, through every stop), each stop with its time and the drive before it, the cooks' own addresses (apartment
   included) with call, text and directions on the clean address; the main driver rides with the team leader and sees the
   storage unit, then after the serving the Old Brewery Mission and the storage unit with their times and a second Maps
   link; the team leader rides with the driver and does the inventory check; French; the cook's pickup time; a second
   driver who only meets the team; the phone width; no page errors. Screenshots with SHOTS=<dir>. */
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
  await page.route('https://api.open-meteo.com/**', r => r.fulfill({ status: 404, body: '' }));
  await page.route('https://zwnmulmnvopclzcvytce.supabase.co/storage/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082', 'hex') }));
  await page.route('https://zwnmulmnvopclzcvytce.supabase.co/rest/v1/rpc/**', async r => {
    const req = r.request();
    const call = { url: req.url(), body: req.postData() ? JSON.parse(req.postData()) : null };
    calls.push(call);
    const res = await handler(call, calls);
    await r.fulfill({ status: res.status || 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(res.body) });
  });
  await page.goto('https://hub.welfareavenue.com/c/' + tok + (qs || ''));
  await page.waitForTimeout(500);
  return { ctx, page, calls, errors };
}
const TOK = 'abcdef1234567890ab';
const TEAM = [{ name: 'Melissa Keza', role: 'team_leader', role_en: 'Team leader', role_fr: 'Responsable', phone: '4382212053', me: false },
  { name: 'Andres Villate', role: 'driver', role_en: 'Driver', role_fr: 'Chauffeur', kind: 'main', phone: '5148949230', me: false },
  { name: 'Thomas Latendresse', role: 'driver', role_en: 'Driver', role_fr: 'Chauffeur', kind: 'pickup', phone: '2028360316', me: false }];
const LOOK = { season: 'autumn', hero: { path: 'photos/web/2022-10-autumn-crew-at-the-tent.jpg', alt: '', fx: 0.5, fy: 0.5 } };
const MAPS = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=1500+Rue+Berri%2C+Montr%C3%A9al%2C+QC+H2L+2C4&waypoints=4450+Boulevard+des+sources%2C+Montr%C3%A9al%2C+QC%7C2140+rue+de+la+montagne%2C+Montreal%2C+Quebec%2C+H3G+1Z7';
const MAIN_MAPS = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=1500+Rue+Berri%2C+Montr%C3%A9al%2C+QC+H2L+2C4&waypoints=888+Rue+Saint-Antoine+Ouest%2C+Montr%C3%A9al%2C+QC+H3C+4G3';
const AFTER_MAPS = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=888+Rue+Saint-Antoine+Ouest%2C+Montr%C3%A9al%2C+QC+H3C+4G3&origin=1500+Rue+Berri%2C+Montr%C3%A9al%2C+QC+H2L+2C4&waypoints=915+Rue+Clark%2C+Montr%C3%A9al%2C+QC+H2Z+1J2';
const PICK_RUN = { kind: 'pickup', drivers: [1973], names: ['Thomas Latendresse'], with_tl: false, with_storage: false, start: '10:30', at: 'pickup', drive_min: 46, total_min: 60, end: '13:45', maps_url: MAPS,
  stops: [{ k: 'cook', rid: 449, label: 'Jagjit Singh', address: '4450 Boulevard des sources, Montréal, QC', arrive: '10:30', leave: '10:37', drive_min: 0, approx: false },
    { k: 'cook', rid: 2001, label: 'Nima Adinoyi', address: '2140 rue de la montagne, Montreal, Quebec, H3G 1Z7', arrive: '11:00', leave: '11:07', drive_min: 23, approx: true },
    { k: 'serving', label: 'Place Émilie-Gamelin', address: '1500 Rue Berri, Montréal, QC H2L 2C4', arrive: '11:30', drive_min: 23 }] };
const MAIN_RUN = { kind: 'main', drivers: [1974], names: ['Andres Villate'], with_tl: true, with_storage: true, start: '11:05', at: 'storage', drive_min: 8, total_min: 23, end: '14:58', maps_url: MAIN_MAPS,
  stops: [{ k: 'storage', label: 'Storage unit', address: '888 Rue Saint-Antoine Ouest, Montréal, QC H3C 4G3', arrive: '11:05', leave: '11:20', drive_min: 0 },
    { k: 'serving', label: 'Place Émilie-Gamelin', address: '1500 Rue Berri, Montréal, QC H2L 2C4', arrive: '11:28', drive_min: 8 }] };
const AFTER = { leave: '13:45', end: '14:58', maps_url: AFTER_MAPS, stops: [{ k: 'serving', label: 'Place Émilie-Gamelin', address: '1500 Rue Berri, Montréal, QC H2L 2C4', leave: '13:45' },
  { k: 'dish', label: 'Old Brewery Mission', address: '915 Rue Clark, Montréal, QC H2Z 1J2', arrive: '13:49', leave: '14:34', drive_min: 4 },
  { k: 'storage', label: 'Storage unit', address: '888 Rue Saint-Antoine Ouest, Montréal, QC H3C 4G3', arrive: '14:38', leave: '14:58', drive_min: 4 }] };
const PICKUPS = [{ rid: 449, name: 'Jagjit Singh', phone: '5142990421', address: '4450 Blvd des Sources', neighbourhood: 'Pierrefonds', postal_code: null, dish: 'Butter chicken' },
  { rid: 2001, name: 'Nima Adinoyi', phone: '2638804854', address: '2140 rue de la montagne, apt. 217, buzzer code 233462#', postal_code: 'H3G 1Z7', dish: null }];
function itin(over) {
  return Object.assign({ kind: 'lead_driver', serve: '12:00', place: '1500 Rue Berri, Montréal, QC H2L 2C4', meet_spot: 'Maisonneuve side', team: TEAM, format: 'home_cooked', look: LOOK,
    notes_en: [], notes_fr: [], pickups: PICKUPS, dropoffs: [{ name: 'Mandeep Kaur', stay: false }], route_url: 'https://www.google.com/maps/dir/old/route',
    storage_place: '888 Rue Saint-Antoine W, Montréal, QC H3C 4G3. Unit 1253: as you enter, turn right.', storage_access: 'Door *1111#; Locker 2222', dish_place: 'Old Brewery Mission, 915 Clark Street, Montréal, QC H2Z 1J2. Ask for Rafael.',
    bins: [{ name_en: 'Dinnerware bin', name_fr: 'Bac de vaisselle', items_en: 'Napkins, plates', items_fr: 'Serviettes', photo: '' }], carry_en: ['The tent'], carry_fr: ['La tente'], run_order: 'cooks_first', run_at: '2026-10-02T02:58:10Z' }, over || {});
}
function base(role, over) {
  return Object.assign({ first: 'Sam', name: 'Sam Example', role: role, role_en: role, role_fr: role, event_date: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10), event_title: 'Sunday serving', location: 'Montreal', code: 'WA-26-21', lang: 'en',
    format: 'home_cooked', past: false, cancelled: false, state: 'confirmed', confirmed_at: '2026-09-28T14:00:00Z', opens_on: '2026-09-27', confirm_days: 7, start_time: '12:00',
    times: { start: '12:00', end: '14:00', at: 'serving', serve: '12:00' }, details: {}, recipes: [], events: [], photo: null, look: LOOK,
    guide: { expect_en: ['Drive safe.'], expect_fr: ['Prudence.'], bring_en: '', bring_fr: '', arrive_en: '', arrive_fr: '', links: [] } }, over || {});
}
const btxt = p => p.evaluate(() => document.getElementById('itv').innerText);
const noScroll = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

(async () => {
  const browser = await chromium.launch();
  try {
    /* 1. the pickup driver, on a phone, straight from the text */
    const pick = itin({ times: { start: '10:30', end: '13:45', at: 'pickup', serve: '12:00', driver_kind: 'pickup', run: true }, run: PICK_RUN, after: null });
    let f = await open(browser, TOK, () => ({ body: base('driver', { role_en: 'Driver', itinerary: pick, times: pick.times }) }), { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, '?it=1');
    let t = await btxt(f.page);
    ok('pickup driver: you start at 10:30 am', /You start at 10:30 am/.test(t), t.slice(0, 400));
    const sum = await f.page.evaluate(() => Array.from(document.querySelectorAll('.rsum div')).map(d => d.innerText.replace(/\s+/g, ' ').trim()));
    ok('summary: the start, 3 stops, 60 minutes with the driving', sum.length === 3 && /10:30 am/.test(sum[0]) && /^3 stops$/.test(sum[1]) && /60 min in all, 46 min driving/.test(sum[2]), sum);
    ok('the whole route in Google Maps (the run\'s own link, from where they are)', await f.page.evaluate(m => { const a = document.querySelector('#itv a.rbig'); return !!a && a.getAttribute('href') === m && a.target === '_blank' && /Open the whole route in Google Maps/.test(a.textContent); }, MAPS));
    ok('the top button opens the same route (not the old one)', await f.page.evaluate(m => { const a = document.querySelector('.acts a.pri'); return !!a && a.getAttribute('href') === m; }, MAPS));
    ok('how long: Google shows the time to the first stop', /Google shows how long you need to reach the first stop/.test(t));
    const stops = await f.page.evaluate(() => Array.from(document.querySelectorAll('#itv ol.route')[0].querySelectorAll(':scope > li')).map(li => li.innerText.replace(/\s+/g, ' ').trim()));
    ok('three stops in order with their times', stops.length === 3 && /^1 10:30 am to 10:37 am Jagjit Singh/.test(stops[0]) && /23 min drive 11:00 am to 11:07 am \(about\) Nima Adinoyi/.test(stops[1]) && /23 min drive 11:30 am Final stop: the serving/.test(stops[2]), stops);
    ok('the cook\'s own address (apartment and door code for the driver), dish, neighbourhood', /apt\. 217, buzzer code 233462#, H3G 1Z7/.test(stops[1]) && /Butter chicken/.test(stops[0]) && /\(Pierrefonds\)/.test(stops[0]), stops);
    ok('call, text and directions per cook; directions on the clean address', await f.page.evaluate(() => {
      const li = document.querySelectorAll('#itv ol.route')[0].querySelectorAll(':scope > li')[1];
      const d = Array.from(li.querySelectorAll('.tools a')).map(a => a.getAttribute('href'));
      return d.indexOf('tel:+12638804854') >= 0 && d.indexOf('sms:+12638804854') >= 0 && d.some(h => /maps\/dir\/\?api=1&destination=2140%20rue%20de%20la%20montagne%2C%20Montreal/.test(h) && !/buzzer/.test(h));
    }));
    ok('text each cook before arriving', /Text each cook about 10 minutes before you arrive/.test(t));
    ok('pickup driver: no storage stop, no bins, pack up after', !/Storage unit/.test(stops.join(' ')) && !/Dinnerware bin/.test(t) && /Help the team pack up/.test(t));
    ok('pickup driver: no drop-off list (the main driver has it)', !/Mandeep Kaur/.test(t));
    ok('phone: nothing scrolls sideways', await noScroll(f.page));
    ok('no page errors', f.errors.length === 0, f.errors);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/01-pickup-driver-phone.png', fullPage: true });
    await f.page.click('[data-l="fr"]'); await f.page.waitForTimeout(150);
    t = await btxt(f.page);
    ok('French: the summary, the button, the stops', /Ouvrir tout le trajet dans Google Maps/.test(t) && /au total, dont 46 min de route/.test(t) && /De 10 h 30 à 10 h 37/.test(t) && /23 min de route/.test(t) && /\(environ\)/.test(t), t.slice(0, 1200));
    await f.ctx.close();

    /* 2. the main driver with the team leader: the storage unit, then after the serving */
    const main = itin({ times: { start: '11:05', end: '14:58', at: 'storage', serve: '12:00', driver_kind: 'main', run: true }, run: MAIN_RUN, after: AFTER });
    f = await open(browser, TOK, () => ({ body: base('driver', { role_en: 'Driver', itinerary: main, times: main.times }) }), { viewport: { width: 1100, height: 900 } }, '?it=1');
    t = await btxt(f.page);
    ok('main driver: the team leader rides with them', /Melissa Keza, the team leader, rides with you\./.test(t), t.slice(0, 900));
    const ms = await f.page.evaluate(() => Array.from(document.querySelectorAll('#itv ol.route')[0].querySelectorAll(':scope > li')).map(li => li.innerText.replace(/\s+/g, ' ').trim()));
    ok('main driver: the storage unit (codes) then the serving', ms.length === 2 && /11:05 am to 11:20 am Storage unit/.test(ms[0]) && /8 min drive 11:28 am Final stop: the serving/.test(ms[1])
      && await f.page.evaluate(() => Array.from(document.querySelectorAll('#itv .code span')).map(x => x.textContent).join('|') === 'Door *1111#|Locker 2222'), ms);
    ok('main driver: the bins and the drop-offs', /Dinnerware bin/.test(t) && /Cooks dropping off their food: Mandeep Kaur/.test(t));
    const af = await f.page.evaluate(() => { const l = document.querySelectorAll('#itv ol.route'); return Array.from(l[l.length - 1].querySelectorAll(':scope > li')).map(li => li.innerText.replace(/\s+/g, ' ').trim()); });
    ok('after: leave at 1:45 pm, the Old Brewery Mission, the storage unit, with times', af.length === 3 && /1:45 pm Leave the serving/.test(af[0]) && /4 min drive 1:49 pm to 2:34 pm Old Brewery Mission The dishes/.test(af[1]) && /2:38 pm to 2:58 pm Storage unit Put everything back/.test(af[2]) && /team leader checks the inventory/.test(af[2]), af);
    ok('after: its own Google Maps link (from the serving)', await f.page.evaluate(m => Array.from(document.querySelectorAll('#itv a.rbig.ghost')).some(a => a.getAttribute('href') === m), AFTER_MAPS));
    ok('no page errors (main driver)', f.errors.length === 0, f.errors);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/02-main-driver-desktop.png', fullPage: true });
    await f.ctx.close();

    /* 3. the team leader rides with the main driver; the inventory check is theirs */
    const tl = itin({ times: { start: '11:05', end: '14:58', at: 'storage', serve: '12:00', run: true }, run: MAIN_RUN, after: AFTER, audit_url: 'https://forms.gle/x' });
    f = await open(browser, TOK, () => ({ body: base('team_leader', { role_en: 'Team leader', itinerary: tl, times: tl.times }) }), { viewport: { width: 420, height: 900 } }, '?it=1');
    t = await btxt(f.page);
    ok('team leader: rides with Andres', /You ride with Andres Villate\./.test(t));
    ok('team leader: the quick inventory check after', /quick inventory check on your page/.test(t));
    ok('team leader: starts at the storage unit at 11:05 am', /You start at 11:05 am/.test(t) && /At the storage unit/.test(t));
    ok('no page errors (team leader)', f.errors.length === 0, f.errors);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/03-team-leader-phone.png', fullPage: true });
    /* back on the page, the teaser opens the booklet again */
    await f.page.click('[data-iv="back"]'); await f.page.waitForTimeout(200);
    ok('back on the page: the teaser', await f.page.evaluate(() => !!document.querySelector('[data-open-it]') && !document.body.classList.contains('itv')));
    await f.ctx.close();

    /* 4. a second main driver: only the serving */
    const extra = itin({ times: { start: '11:30', end: '13:45', at: 'serving', serve: '12:00', driver_kind: 'main', run: true }, after: null,
      run: { kind: 'main', drivers: [3], names: ['Extra'], with_tl: false, with_storage: false, start: '11:30', at: 'serving', drive_min: 0, total_min: 0, end: '13:45', maps_url: 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=1500+Rue+Berri', stops: [{ k: 'serving', label: 'Place Émilie-Gamelin', address: '1500 Rue Berri, Montréal, QC H2L 2C4', arrive: '11:30', drive_min: 0 }] } });
    f = await open(browser, TOK, () => ({ body: base('driver', { role_en: 'Driver', itinerary: extra, times: extra.times }) }), null, '?it=1');
    t = await btxt(f.page);
    ok('a second driver: 1 stop, at the serving, no whole-route button', /1\s*stop/.test(t) && /Final stop: the serving/.test(t) && await f.page.evaluate(() => !document.querySelector('#itv a.rbig')), t.slice(0, 600));
    await f.ctx.close();

    /* 5. the cook: their own pickup time from the run */
    f = await open(browser, TOK, () => ({ body: base('cook', { role_en: 'Cook', itinerary: null, times: { start: '10:20', end: '10:30', eta: '10:30', at: 'home', serve: '12:00' }, cook_pickup: { areas: [], dropoff_place: '1500 Rue Berri', dropoff_time: '12:00' } }) }));
    t = await f.page.evaluate(() => document.getElementById('app').innerText);
    ok('cook: food ready by 10:20 am, the driver at about 10:30 am', /Food ready by 10:20 am: your driver comes at about 10:30 am and texts you first/.test(t), t.slice(0, 800));
    await f.page.click('#langs [data-l="fr"]').catch(() => {}); await f.page.waitForTimeout(150);
    t = await f.page.evaluate(() => document.getElementById('app').innerText);
    ok('cook, French', /Plat prêt pour 10 h 20 : votre chauffeur passe vers 10 h 30/.test(t), t.slice(0, 800));
    await f.ctx.close();
    /* without a run the cook keeps the old line */
    f = await open(browser, TOK, () => ({ body: base('cook', { role_en: 'Cook', itinerary: null, times: { start: '10:45', end: '12:00', at: 'home', serve: '12:00' }, cook_pickup: { areas: [], dropoff_place: '1500 Rue Berri', dropoff_time: '12:00' } }) }));
    t = await f.page.evaluate(() => document.getElementById('app').innerText);
    ok('cook without a run: the old line', /Food ready for pickup from 10:45 am/.test(t));
    await f.ctx.close();
  } catch (e) { fail++; console.log('FAIL exception ' + (e && e.stack || e)); }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
