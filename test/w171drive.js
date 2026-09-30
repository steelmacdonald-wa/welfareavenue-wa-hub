/* w171drive.js: wave171 in the Hub, offline against the candidate (CAND=build/<file>.html).
   An upcoming serving (7 days out on the test clock) with a roster in every state: confirmed by the text link, declined by
   a NO reply, texted and waiting, not texted, no phone. Checks: the Texts card (mode, the four numbers, the note, the
   buttons by role), the tags on the roster cards, the masthead (format not set, x of y confirmed, by text), the format
   editor (community kitchen fields, saved to volunteer_events), Text to confirm (who is ticked, the call to
   wa171_text_to_confirm with the ticked rows, the result), Send me a test (quo-send test_confirm), Text settings (the
   mode for admins with a confirm step, the role guide editor and its save), the live refresh (a roster row confirmed
   in the database shows without reloading), the calendar's format gap, the next serving card on Home and the
   Executive dashboard (staff; not for board viewers), a leader without admin (no test, no mode switch), the phone
   width, and no page errors. Screenshots with SHOTS=<dir>. */
const { launch, fresh, loadFixture } = require('./boot');
const fs = require('fs');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 500) : '')); } }

function fixture() {
  const fx = loadFixture();
  const EV = 900, DAY = '2026-10-02';
  fx.volunteer_events = (fx.volunteer_events || []).concat([{ id: EV, code: 'WA-26-90', kind: 'service', notes: null, title: null, season: 'Fall', status: 'planned', location: 'Montreal', event_date: DAY, itinerary_url: null, planned_meals: 120, format: null, kitchen_place: null, kitchen_shift: null, kitchen_contact: null, ingredients_note: null }]);
  fx.volunteer_event_summary = (fx.volunteer_event_summary || []).concat([{ id: EV, code: 'WA-26-90', event_date: DAY, season: 'Fall', location: 'Montreal', notes: null, status: 'planned', kind: 'service', title: 'Sunday serving', roster_confirmed: 2, roster_count: 5, steps_done: 0, steps_total: 0, extras_total: 0, extras_open: 0, format: null, roster_by_link: 1, roster_declined: 1, roster_texted: 1 }]);
  const R = (id, name, role, status, extra) => Object.assign({ id, event_id: EV, person_id: null, person_name: name, role, status, sort: id, notes: null, detail: { phone: '5145550' + String(id).slice(-3) }, confirm_token: 'tok' + id + 'abcdefghijk', confirm_status: null, confirmed_at: null, confirm: null, recipe_id: null }, extra || {});
  fx.event_roster = (fx.event_roster || []).concat([
    R(9001, 'Nasim Example', 'cook', 'Confirmed', { confirm_status: 'confirmed', confirmed_at: '2026-09-25T18:32:00Z', confirm: { attending: 'yes', via: 'link' } }),
    R(9002, 'Iman Example', 'cook', 'Unavailable', { confirm_status: 'declined', confirmed_at: '2026-09-25T19:00:00Z', confirm: { attending: 'no', via: 'reply' } }),
    R(9003, 'Alex Example', 'driver', 'TBD'),
    R(9004, 'Eriana Example', 'server', 'Waiting For Response'),
    R(9005, 'Noa Nophone', 'server', 'TBD', { detail: {} }),
    R(9006, 'Sam Handmade', 'team_leader', 'Confirmed')
  ]);
  fx.quo_messages = (fx.quo_messages || []).concat([
    { id: 7001, batch_id: 'b1', person_id: null, phone: '+15145550003', body: 'Hi Alex, ...', status: 'sent', error: null, event_id: EV, sent_by: 'automation', created_at: '2026-09-25T14:00:00Z', direction: 'out', kind: 'confirm', roster_id: 9003, quo_id: 'AC1', handled: null, sent_at: '2026-09-25T14:00:05Z' },
    { id: 7002, batch_id: 'b2', person_id: null, phone: '+15145550002', body: 'no sorry, exams', status: 'received', error: null, event_id: EV, sent_by: 'quo-events', created_at: '2026-09-25T19:00:00Z', direction: 'in', kind: 'inbound', roster_id: 9002, quo_id: 'AC2', handled: 'declined', sent_at: null },
    { id: 7003, batch_id: 'b3', person_id: null, phone: '+15145550003', body: 'What time should I be at the storage unit?', status: 'received', error: null, event_id: EV, sent_by: 'quo-events', created_at: '2026-09-25T19:30:00Z', direction: 'in', kind: 'inbound', roster_id: 9003, quo_id: 'AC3', handled: 'question', sent_at: null }
  ]);
  fx.app_config = (fx.app_config || []).filter(x => !/^sms_|^quo_webhook/.test(x.key)).concat([
    { key: 'sms_mode', value: 'live' }, { key: 'sms_test_phones', value: '4388694539' }, { key: 'sms_confirm_days', value: '7' }, { key: 'sms_confirm_hour', value: '10' }, { key: 'quo_webhook_id', value: '41951 (quo-2026-03-30)' }]);
  fx.volunteer_role_guides = [
    { role: 'cook', label_en: 'Cook', label_fr: 'Bénévole en cuisine', photo_id: 47, expect_en: ['Cook at home.', 'Driver texts 10 minutes before.'], expect_fr: ['Cuisinez à la maison.'], bring_en: 'Your dish.', bring_fr: 'Votre plat.', arrive_en: 'Ready for pickup.', arrive_fr: 'Prêt.' },
    { role: 'server', label_en: 'Server', label_fr: 'Bénévole au service', photo_id: 28, expect_en: ['Set up.'], expect_fr: ['Installez.'], bring_en: null, bring_fr: null, arrive_en: null, arrive_fr: null }
  ];
  fx.wa_photos = [
    { id: 47, title: 'A home-cooked tray', path_thumb: 'photos/thumb/a.jpg', path_web: 'photos/web/a.jpg', orientation: 'portrait', scene: 'food', status: 'ready', usage: 'ready' },
    { id: 28, title: 'Servers at the table', path_thumb: 'photos/thumb/b.jpg', path_web: 'photos/web/b.jpg', orientation: 'portrait', scene: 'serving', status: 'ready', usage: 'ready' },
    { id: 49, title: 'Drivers on the way', path_thumb: 'photos/thumb/c.jpg', path_web: 'photos/web/c.jpg', orientation: 'landscape', scene: 'volunteers', status: 'ready', usage: 'ready' }
  ];
  return fx;
}
const INSTALL = () => {
  window.__W171 = { rpc: [], fn: [], up: [] };
  const f0 = db.from.bind(db);
  db.from = function (t) { const b = f0(t); const u = b.update.bind(b); b.update = function (p) { window.__W171.up.push({ t: t, p: p }); return u(p); }; return b; };
  const r0 = db.rpc.bind(db);
  db.rpc = function (fn, args) {
    window.__W171.rpc.push({ fn: fn, args: args });
    if (fn === 'wa171_text_to_confirm') return Promise.resolve({ data: { queued: (args.p_roster || []).length, mode: 'live', already_texted: 0, no_phone: 0, opted_out: 0, held_by_test_mode: 0 }, error: null });
    if (fn === 'wa171_sms_mode_set') return Promise.resolve({ data: args.p_mode, error: null });
    return r0(fn, args);
  };
  db.functions.invoke = function (name, opts) { window.__W171.fn.push({ name: name, body: opts && opts.body }); return Promise.resolve({ data: { text: 'Hi Nasim...', results: [{ to: '+1438***39', ok: true }] }, error: null }); };
};
const INIT = '';
const RPCS_ADMIN = { wa_org_editor: true, is_wa_admin: true, is_wa_leader: true, wa_is_hr: false, is_wa_staff: true };
const RPCS_LEADER = { is_wa_admin: false, is_wa_leader: true, wa_is_hr: false, is_wa_staff: true };
const text = (f, sel) => f.ev(s => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);

(async () => {
  const browser = await launch();
  try {
    /* ---------- 1. admin on the event page ---------- */
    let f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fixture(), rpcs: RPCS_ADMIN, init: INIT, wait: 4500 });
    await f.ev(INSTALL);
    await f.page.waitForSelector('#w171card', { timeout: 8000 }).catch(() => null);
    let card = await text(f, '#w171card');
    ok('card: in the rail', await f.ev(() => !!document.querySelector('#w119rail #w171card')), card);
    ok('card: texts on', /TEXTS ON|Texts on/i.test(card), card);
    ok('card: the numbers', /2\s*confirmed of 6/.test(card) && /1\s*by text/.test(card) && /3\s*waiting, 1 texted/.test(card) && /1\s*can.t make it/.test(card), card);
    ok('card: the automatic note', /automatically/.test(card) && /no phone number/.test(card), card);
    ok('card: admin buttons', /Text to confirm/.test(card) && /Send me a test/.test(card) && /Text settings/.test(card));
    ok('card: replies with their handling', /What time should I be at the storage unit/.test(card) && /Needs an answer/.test(card) && /Can.t make it/.test(card), card);
    const tags = await f.ev(() => { const o = {}; document.querySelectorAll('#w119 [data-w119card]').forEach(el => { const t = el.querySelector('.w171tag'); o[el.getAttribute('data-w119card')] = t ? t.innerText : ''; }); return o; });
    ok('tags: confirmed by text link', /Confirmed by text link/.test(tags['9001'] || ''), tags);
    ok('tags: replied NO', /replied NO/.test(tags['9002'] || ''), tags);
    ok('tags: texted, no answer', /Texted .* no answer yet/.test(tags['9003'] || ''), tags);
    ok('tags: no phone', /No phone number/.test(tags['9005'] || ''), tags);
    ok('tags: confirmed by hand has no text tag', (tags['9006'] || '') === '' && (tags['9004'] || '') === '', tags);
    let mast = await text(f, '#w119 .mast');
    ok('mast: format not set and x of y confirmed', /Format not set/i.test(mast) && /2 of 6 confirmed · 1 by text/i.test(mast), mast);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/01-event.png', fullPage: false });

    /* the format */
    await f.page.click('#w119 .mast [data-w171fmt]'); await f.page.waitForTimeout(500);
    ok('format: the editor opens', /How the food is made/i.test(await text(f, '#modalBox')));
    await f.page.check('input[name="w171f"][value="community_kitchen"]'); await f.page.waitForTimeout(150);
    ok('format: kitchen fields show', await f.ev(() => document.getElementById('w171kit').style.display !== 'none'));
    await f.page.fill('#w171kp', 'La Poubelle Magnifique, 1221 Rue Crescent'); await f.page.fill('#w171ks', '9:00 to 12:30');
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/02-format.png' });
    await f.page.click('[data-w171fsave]'); await f.page.waitForTimeout(600);
    mast = await text(f, '#w119 .mast');
    ok('format: saved and shown', /Community kitchen/i.test(mast), mast);
    const saved = await f.ev(() => window.__W171.up.filter(u => u.t === 'volunteer_events')[0]);
    ok('format: written to volunteer_events', saved && saved.p.format === 'community_kitchen' && /Crescent/.test(saved.p.kitchen_place || '') && saved.p.kitchen_shift === '9:00 to 12:30', saved);

    /* Text to confirm */
    await f.page.click('[data-w171send]'); await f.page.waitForTimeout(500);
    const picks = await f.ev(() => Array.prototype.map.call(document.querySelectorAll('[data-w171pick]'), c => ({ id: c.getAttribute('data-w171pick'), on: c.checked, off: c.disabled })));
    ok('send: only people who have not answered', picks.map(p => p.id).sort().join(',') === '9003,9004,9005', picks);
    ok('send: already texted is not ticked, no phone cannot be', picks.filter(p => p.id === '9003')[0].on === false && picks.filter(p => p.id === '9005')[0].off === true && picks.filter(p => p.id === '9004')[0].on === true, picks);
    ok('send: the preview', /Please confirm here/.test(await text(f, '#modalBox')));
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/03-send.png' });
    await f.page.click('[data-w171go]'); await f.page.waitForTimeout(600);
    let calls = await f.ev(() => window.__W171.rpc.filter(c => c.fn === 'wa171_text_to_confirm'));
    ok('send: calls wa171_text_to_confirm with the ticked rows', calls.length === 1 && calls[0].args.p_event === 900 && JSON.stringify(calls[0].args.p_roster) === '[9004]', calls);
    ok('send: the modal closes', await f.ev(() => document.getElementById('modalBack').style.display === 'none'));

    /* Send me a test */
    await f.page.click('[data-w171test]'); await f.page.waitForTimeout(600);
    const fns = await f.ev(() => window.__W171.fn);
    ok('test: quo-send test_confirm with a roster row', fns.length === 1 && fns[0].name === 'quo-send' && fns[0].body.action === 'test_confirm' && Number.isInteger(fns[0].body.roster_id), fns);

    /* Text settings */
    await f.page.click('[data-w171set]'); await f.page.waitForTimeout(900);
    let m = await text(f, '#modalBox');
    ok('settings: mode, test phone, role editor', /Text settings/i.test(m) && /Test phone/.test(m) && /What volunteers see after they confirm/i.test(m) && await f.ev(() => document.querySelectorAll('[data-w171pic]').length === 3), m.slice(0, 400));
    ok('settings: the webhook', /webhook 41951/.test(m), m.slice(0, 300));
    await f.page.check('input[name="w171mode"][value="off"]'); await f.page.waitForTimeout(200);
    ok('settings: switching asks first', /Switch texts off\?/.test(await text(f, '#w171mconf')));
    await f.page.click('[data-w171mset="off"]'); await f.page.waitForTimeout(500);
    calls = await f.ev(() => window.__W171.rpc.filter(c => c.fn === 'wa171_sms_mode_set'));
    ok('settings: the mode goes through wa171_sms_mode_set', calls.length === 1 && calls[0].args.p_mode === 'off', calls);
    await f.page.click('[data-w171pic="49"]');
    await f.page.fill('#w171een', 'Cook at home.\nPack it well.');
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/04-settings.png' });
    await f.page.click('[data-w171gsave]'); await f.page.waitForTimeout(600);
    const g = await f.ev(() => window.__W171.up.filter(u => u.t === 'volunteer_role_guides')[0]);
    ok('settings: the role guide saves', g && g.p.photo_id === 49 && JSON.stringify(g.p.expect_en) === '["Cook at home.","Pack it well."]' && g.p.label_fr === 'Bénévole en cuisine', g);
    await f.ev(() => closeModal());

    /* the live refresh: a tap on a phone */
    await f.ev(() => { const r = window.__WAFIX.event_roster.filter(x => x.id === 9004)[0]; r.status = 'Confirmed'; r.confirm_status = 'confirmed'; r.confirmed_at = '2026-09-25T20:05:00Z'; r.confirm = { attending: 'yes', via: 'link' }; });
    await f.ev(() => window.w171.tick()); await f.page.waitForTimeout(1200);
    const t4 = await f.ev(() => { const el = document.querySelector('#w119 [data-w119card="9004"] .w171tag'); return el ? el.innerText : ''; });
    ok('live: the tap shows without reloading', /Confirmed by text link/.test(t4), t4);
    ok('live: the card counts it', /3\s*confirmed of 6/.test(await text(f, '#w171card')));
    ok('admin: no page errors', f.errs.length === 0, f.errs);
    await f.close();

    /* ---------- 2. the calendar and Home ---------- */
    f = await fresh(browser, { who: 'admin', hash: '#volunteering', fixture: fixture(), rpcs: RPCS_ADMIN, init: INIT });
    await f.page.waitForTimeout(800);
    const gap = await f.ev(() => { const el = document.querySelector('#volunteering .vl-ev[data-vlev="900"]'); return el ? el.innerText : null; });
    ok('calendar: format not set on the serving', gap !== null && /format not set/.test(gap) && /1 by text/.test(gap), gap);
    await f.hash('#mypage', 2500);
    let nx = await text(f, '#w171next');
    ok('home: the next serving card', /Next serving/i.test(nx) && /2 of 6/.test(nx) && /confirmed · 1 by text/.test(nx) && /Still waiting: Alex \(driver\), Eriana \(server\), Noa \(server\)/.test(nx), nx);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/05-home.png' });
    await f.hash('#overview', 3000);
    nx = await text(f, '#w171next');
    ok('executive dashboard: the next serving card inside the dashboard', /Next serving/i.test(nx) && await f.ev(() => !!document.querySelector('#w128 > #w171next')), nx);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/06-exec.png' });
    await f.page.click('#w171next [data-w171open]'); await f.page.waitForTimeout(1500);
    ok('the card opens the serving', await f.ev(() => location.hash === '#volunteering/e/900'));
    ok('calendar and home: no page errors', f.errs.length === 0, f.errs);
    await f.close();

    /* ---------- 3. a leader (not an admin) ---------- */
    f = await fresh(browser, { who: 'leader', hash: '#volunteering/e/900', fixture: fixture(), rpcs: RPCS_LEADER, init: INIT, wait: 4500 });
    await f.page.waitForSelector('#w171card', { timeout: 8000 }).catch(() => null);
    card = await text(f, '#w171card');
    ok('leader: Text to confirm but no test', /Text to confirm/.test(card) && !/Send me a test/.test(card), card);
    await f.page.click('[data-w171set]'); await f.page.waitForTimeout(900);
    ok('leader: cannot switch the mode', await f.ev(() => Array.prototype.every.call(document.querySelectorAll('input[name="w171mode"]'), x => x.disabled)) && /Only an admin can switch texts/.test(await text(f, '#modalBox')));
    ok('leader: no page errors', f.errs.length === 0, f.errs);
    await f.close();

    /* ---------- 4. a board viewer: no card on the dashboard ---------- */
    f = await fresh(browser, { who: 'board', hash: '#overview', fixture: fixture(), rpcs: {}, init: INIT });
    await f.page.waitForTimeout(2500);
    ok('board: no next serving card', await f.ev(() => !document.getElementById('w171next')));
    ok('board: no page errors', f.errs.length === 0, f.errs);
    await f.close();

    /* ---------- 5. phone ---------- */
    f = await fresh(browser, { who: 'admin', width: 390, hash: '#volunteering/e/900', fixture: fixture(), rpcs: RPCS_ADMIN, init: INIT, wait: 4500 });
    await f.page.waitForSelector('#w171card', { timeout: 8000 }).catch(() => null);
    ok('phone: the card shows', await f.ev(() => { const c = document.getElementById('w171card'); return !!c && c.getBoundingClientRect().width > 250; }));
    ok('phone: no sideways scroll from the card', await f.ev(() => { const c = document.getElementById('w171card'); return !c || c.scrollWidth <= c.clientWidth + 2; }));
    if (SHOTS) { await f.ev(() => document.getElementById('w171card').scrollIntoView()); await f.page.screenshot({ path: SHOTS + '/07-phone.png' }); }
    ok('phone: no page errors', f.errs.length === 0, f.errs);
    await f.close();
  } finally { await browser.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
