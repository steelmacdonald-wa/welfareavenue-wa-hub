/* w191runcard.js: wave191m, the run card on a serving (Prepare), offline against the candidate (CAND=build/<file>.html).
   The card shows the run serving-run worked out (wa191_run_get): which order the Hub picked and by how much, when everyone is
   at the serving, each driver's start with every stop and its time, the drive before it, Google Maps and their itinerary,
   after the serving (Old Brewery Mission, the storage unit and the inventory check), what needs a look (an address the map
   placed roughly, no team leader); the day card and the itinerary card take the starts from it; Work it out again asks the
   function with force; a run whose stops changed (stale) or no run yet is worked out by itself, once; Text settings has the
   run's addresses and minutes; the phone width; no page errors. */
const { launch, fresh } = require('./boot');
const fs = require('fs');
const fx191 = require('./w191fx');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 700) : '')); } }

const MAPS = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=1500+Rue+Berri%2C+Montr%C3%A9al%2C+QC+H2L+2C4&waypoints=2140+rue+de+la+montagne%2C+Montreal%7C888+Rue+Saint-Antoine+Ouest%2C+Montr%C3%A9al%2C+QC+H3C+4G3';
const AFTER_MAPS = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=888+Rue+Saint-Antoine+Ouest&origin=1500+Rue+Berri&waypoints=915+Rue+Clark';
function plan() {
  return { v: 2, computed_at: '2026-09-25T19:40:00Z', serve: '12:00', arrive_by: '11:30', order: 'cooks_first', compared: { storage_first: 108, cooks_first: 76 },
    minutes: { cook: 7, storage: 15, setup: 30, serve: 105, dish: 45, close: 20, factor: 1.25 },
    runs: [{ kind: 'both', drivers: [9003], names: ['Alex Example'], with_tl: true, with_storage: true, start: '10:50', at: 'pickup', drive_min: 23, total_min: 38, end: '14:58', maps_url: MAPS,
      stops: [{ k: 'cook', rid: 9001, label: 'Nasim Example', hood: 'Ville-Marie', address: '2140 rue de la montagne, Montreal', arrive: '10:50', leave: '10:57', drive_min: 0, approx: true },
        { k: 'storage', label: 'Storage unit', address: '888 Rue Saint-Antoine Ouest, Montréal, QC H3C 4G3', arrive: '11:05', leave: '11:20', drive_min: 8 },
        { k: 'serving', label: 'Place Émilie-Gamelin', address: '1500 Rue Berri, Montréal, QC H2L 2C4', arrive: '11:28', drive_min: 8 }] }],
    after: { leave: '13:45', end: '14:58', maps_url: AFTER_MAPS, stops: [{ k: 'serving', label: 'Place Émilie-Gamelin', address: '1500 Rue Berri', leave: '13:45' },
      { k: 'dish', label: 'Old Brewery Mission', address: '915 Rue Clark', arrive: '13:49', leave: '14:34', drive_min: 4 }, { k: 'storage', label: 'Storage unit', address: '888 Rue Saint-Antoine Ouest', arrive: '14:38', leave: '14:58', drive_min: 4 }] },
    cook_eta: { 9001: '10:50' }, warnings: [{ rid: 9001, name: 'Nasim Example', why: 'placed on its street, not the house' }], source: 'osm' };
}
const RPCS = (x) => ({ wa_org_editor: true, is_wa_admin: true, is_wa_leader: true, wa_is_hr: false, is_wa_staff: true, wa191_autotick: { ticked: 0 }, wa191_run_get: x });
/* records the serving-run calls only (other waves call their own functions on boot) */
const INV = 'window.__inv = []; window.__WA_INVOKE = function (name, opts) { if (name === "serving-run") { window.__inv.push({ name: name, body: opts && opts.body }); return { data: { event_id: 900, unchanged: false }, error: null }; } return { data: null, error: null }; };';
const openPrepare = f => f.ev(() => { const s = document.querySelector('#w119 .w191stage[data-stage="prepare"]'); if (s && !s.classList.contains('open')) s.querySelector(':scope > .h').click(); });
const txt = (f, sel) => f.ev(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : ''; }, sel);

(async () => {
  const browser = await launch();
  try {
    /* 1. a worked-out run, up to date */
    let f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fx191(), rpcs: RPCS({ plan: plan(), computed_at: '2026-09-25T19:40:00Z', computed_by: 'cron', stale: false, cooks: 1, no_address: 0, drivers: 1, team_leaders: 1 }), init: INV, width: 1440, wait: 5200 });
    await openPrepare(f); await f.page.waitForTimeout(500);
    const where = await f.ev(() => { const c = document.getElementById('w191run'); if (!c) return null; const st = c.closest('.w191stage'); const prev = c.previousElementSibling; return { stage: st && st.getAttribute('data-stage'), afterItin: !!(prev && prev.id === 'w174card'), beforeSteps: !!c.parentNode.querySelector(':scope > #w191run ~ .w191steps') }; });
    ok('the run card sits in Prepare, after the itinerary card, before the steps', where && where.stage === 'prepare' && where.afterItin && where.beforeSteps, where);
    let t = await txt(f, '#w191run');
    ok('the order the Hub picked and by how much', /Cooks first, then the storage unit: 76 min, against 108 the other way/.test(t), t.slice(0, 600));
    ok('everyone at the serving by 11:30 am; up to date', /Everyone at the serving by 11:30 am/.test(t) && /Up to date/.test(t));
    ok('traffic: OpenStreetMap plus 25%', /OpenStreetMap, plus 25% for traffic/.test(t));
    const rn = await f.ev(() => { const r = document.querySelector('#w191run .rn[data-w191runkind="both"]'); if (!r) return null; return { text: r.innerText.replace(/\s+/g, ' '), times: Array.from(r.querySelectorAll('ol.rs .t')).map(x => x.textContent), maps: (r.querySelector('a[href*="google.com/maps"]') || {}).href || '', it: (Array.from(r.querySelectorAll('a')).filter(a => /Their itinerary/.test(a.textContent))[0] || {}).href || '' }; });
    ok('the driver: name, part, with the team leader, the start', rn && /Alex Example/.test(rn.text) && /Only driver, with Sam Handmade \(team leader\)/.test(rn.text) && /10:50 am starts at Nasim Example’s/.test(rn.text), rn);
    ok('every stop with its time, the drive, when it leaves, the rough address', rn && rn.times.join('|') === '10:50 am|11:05 am|11:28 am' && /8 min drive · leaves 11:20 am/.test(rn.text) && /placed roughly on the map/.test(rn.text) && /Ville-Marie/.test(rn.text), rn);
    ok('Google Maps (the run\'s link) and their itinerary (a test link)', rn && rn.maps === MAPS && /\/c\/tok9003[^?]*\?test=1&it=1$/.test(rn.it), rn);
    ok('minutes in all and driving', rn && /38 min in all, 23 driving/.test(rn.text), rn);
    const af = await txt(f, '#w191run .rn.after');
    ok('after the serving: who, the times, the inventory check, Maps', /After the serving/.test(af) && /Alex Example and Sam Handmade/.test(af) && /2:58 pm back and locked up/.test(af) && /1:45 pm Leave the serving/.test(af) && /1:49 pm Old Brewery Mission: the dishes/.test(af) && /2:38 pm Storage unit: put away, then the inventory check/.test(af)
      && await f.ev(m => !!document.querySelector('#w191run .rn.after a[href="' + m + '"]'), AFTER_MAPS), af);
    ok('needs a look: the address placed on its street', /Needs a look/i.test(t) && /Nasim Example: placed on the street, not the house number/.test(t));
    ok('no "no team leader" note when there is one', !/No team leader yet/i.test(t));
    const day = await txt(f, '.w191stage[data-stage="day_of"] .w191own');
    ok('the day card: the driver and the team leader start from the run', /Alex Example[^·]*starts 10:50 am/.test(day) && /Sam Handmade[^·]*starts 10:50 am/.test(day), day.slice(0, 500));
    const it4 = await txt(f, '#w174card');
    ok('the itinerary card: the starts from the run', /10:50 am Only driver Alex Example and the team leader at the first pickup \(to 2:58 pm\)/.test(it4), it4.slice(0, 600));
    ok('nothing asked of the function while up to date', (await f.ev(() => window.__inv.length)) === 0);
    await f.page.click('#w191run [data-w191run="again"]'); await f.page.waitForTimeout(600);
    const inv = await f.ev(() => window.__inv);
    ok('Work it out again asks serving-run with force', inv.length === 1 && inv[0].name === 'serving-run' && inv[0].body.action === 'plan' && inv[0].body.event_id === 900 && inv[0].body.force === true, inv);
    if (SHOTS) { await f.ev(() => document.getElementById('w191run').scrollIntoView({ block: 'start' })); await f.page.waitForTimeout(200); await (await f.page.$('#w191run')).screenshot({ path: SHOTS + '/run_card.png' }); }
    ok('no page errors', f.errors ? f.errors.length === 0 : f.errs.length === 0, f.errs);
    /* Text settings: the run's addresses and minutes */
    await f.ev(() => { try { window.w171.settingsModal(); } catch (e) { window.__setErr = String(e); } });
    await f.page.waitForTimeout(900);
    const set = await f.ev(() => { const m = document.getElementById('modalBox') || document.body; return { txt: m.innerText.replace(/\s+/g, ' '), inputs: Array.from(m.querySelectorAll('[data-w174it]')).map(i => i.getAttribute('data-w174it')) }; });
    ok('Text settings: the drivers\' run, with its addresses and minutes', /The drivers’ run/i.test(set.txt) && ['storage_address', 'serving_address', 'dish_address', 'run_cook_min', 'run_storage_min', 'run_setup_min', 'run_serve_min', 'run_dish_min', 'run_close_min', 'run_drive_factor'].every(k => set.inputs.indexOf(k) >= 0), set.inputs);
    await f.close();

    /* 2. the stops changed (stale): worked out by itself, once, without force */
    f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fx191(), rpcs: RPCS({ plan: plan(), computed_at: '2026-09-25T19:40:00Z', stale: true, cooks: 1, drivers: 1, team_leaders: 1 }), init: INV, width: 1440, wait: 5200 });
    await openPrepare(f); await f.page.waitForTimeout(800);
    let inv2 = await f.ev(() => window.__inv);
    ok('stale: worked out again by itself, without force', inv2.length >= 1 && inv2.every(x => x.name === 'serving-run' && x.body.force === false && x.body.event_id === 900), inv2);
    await f.ev(() => { if (window.w191) window.w191.refresh(false); }); await f.page.waitForTimeout(700);
    inv2 = await f.ev(() => window.__inv);
    ok('stale: not again within the minute', inv2.length === 1, inv2);
    t = await txt(f, '#w191run');
    ok('stale: says the stops changed', /The stops changed since it was worked out/.test(t), t.slice(0, 300));
    await f.close();

    /* 3. no run yet, no team leader: worked out by itself; the note */
    const fx3 = fx191(); fx3.event_roster = fx3.event_roster.filter(r => r.id !== 9006);
    f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fx3, rpcs: RPCS({ plan: null, computed_at: null, stale: null, cooks: 1, drivers: 1, team_leaders: 0 }), init: INV, width: 1440, wait: 5200 });
    await openPrepare(f); await f.page.waitForTimeout(800);
    const inv3 = await f.ev(() => window.__inv);
    ok('no run yet: asked once, without force', inv3.length === 1 && inv3[0].body.force === false, inv3);
    t = await txt(f, '#w191run');
    ok('no run yet: a calm line and a button', /The Hub works out the drivers’ run|Working out the drivers’ run/.test(t) && /The run/i.test(t), t);
    await f.close();
    const fx4 = fx191(); fx4.event_roster = fx4.event_roster.filter(r => r.id !== 9006);
    f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fx4, rpcs: RPCS({ plan: plan(), computed_at: '2026-09-25T19:40:00Z', stale: false, cooks: 1, drivers: 1, team_leaders: 0 }), init: INV, width: 390, wait: 5200 });
    await openPrepare(f); await f.page.waitForTimeout(600);
    t = await txt(f, '#w191run');
    ok('no team leader: the note, and the seat in the run', /No team leader yet/i.test(t) && /with the team leader \(none on the roster yet\)/.test(t), t.slice(0, 800));
    const over = await f.ev(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok('phone: nothing scrolls sideways', over <= 1, over);
    if (SHOTS) { await f.ev(() => document.getElementById('w191run').scrollIntoView({ block: 'start' })); await f.page.waitForTimeout(200); await (await f.page.$('#w191run')).screenshot({ path: SHOTS + '/run_card_phone.png' }); }
    ok('no page errors (phone)', f.errs.length === 0, f.errs);
    await f.close();
  } catch (e) { fail++; console.log('FAIL crashed :: ' + (e && e.stack || e)); }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
