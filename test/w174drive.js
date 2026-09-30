/* w174drive.js: wave174 in the Hub, offline against the candidate (CAND=build/<file>.html): the Survey and itinerary
   card on the event (the start time and each role's arrival, previews as test links, the survey numbers and tallies,
   every answer), the driver tag (the only driver; click to switch, saved in detail), the start time save, Text settings
   (the itineraries, the survey for every role, the role's questions, switching one off), the phone, board viewers. */
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
    R(9001, 'Nasim Example', 'cook', 'Confirmed', { confirm_status: 'confirmed', confirmed_at: '2026-09-25T18:32:00Z', confirm: { attending: 'yes', via: 'link', cook_location: 'home', neighbourhood: 'Le Plateau', address: '123 Rue Rachel Est' }, recipe_id: 2 }),
    R(9002, 'Iman Example', 'cook', 'Unavailable', { confirm_status: 'declined', confirmed_at: '2026-09-25T19:00:00Z', confirm: { attending: 'no', via: 'reply' } }),
    R(9003, 'Alex Example', 'driver', 'TBD', { confirm: { vehicle: 'SUV', model: 'Toyota RAV4' } }),
    R(9004, 'Eriana Example', 'server', 'Waiting For Response', { confirm: { donations: 'Two bags of clothes' }, signup_noticed_at: '2026-09-20T15:00:00Z' }),
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
  fx.recipes = [{ id: 1, name: 'Chana Masala and Naan', sort: 1 }, { id: 2, name: 'Pasta Primavera', sort: 2 }];
  fx.app_config = fx.app_config.concat([{ key: 'sms_survey_url', value: 'https://docs.google.com/forms/d/e/x/viewform' }, { key: 'sms_survey_roles', value: 'server' }, { key: 'sms_survey_hour', value: '18' }, { key: 'cook_pickup_areas', value: 'Le Plateau\nVilleray' }, { key: 'cook_dropoff_place', value: '1500 Rue Berri' }, { key: 'cook_dropoff_time', value: '12:00' }]);
  fx.volunteer_role_guides = [
    { role: 'cook', label_en: 'Cook', label_fr: 'Bénévole en cuisine', photo_id: 47, links: [{ when: 'before', label_en: 'Recipe book', label_fr: 'Livre de recettes', url: 'https://docs.google.com/document/d/r' }], expect_en: ['Cook at home.', 'Driver texts 10 minutes before.'], expect_fr: ['Cuisinez à la maison.'], bring_en: 'Your dish.', bring_fr: 'Votre plat.', arrive_en: 'Ready for pickup.', arrive_fr: 'Prêt.' },
    { role: 'server', label_en: 'Server', label_fr: 'Bénévole au service', photo_id: 28, expect_en: ['Set up.'], expect_fr: ['Installez.'], bring_en: null, bring_fr: null, arrive_en: null, arrive_fr: null }
  ];
  fx.wa_photos = [
    { id: 47, title: 'A home-cooked tray', path_thumb: 'photos/thumb/a.jpg', path_web: 'photos/web/a.jpg', orientation: 'portrait', scene: 'food', status: 'ready', usage: 'ready' },
    { id: 28, title: 'Servers at the table', path_thumb: 'photos/thumb/b.jpg', path_web: 'photos/web/b.jpg', orientation: 'portrait', scene: 'serving', status: 'ready', usage: 'ready' },
    { id: 49, title: 'Drivers on the way', path_thumb: 'photos/thumb/c.jpg', path_web: 'photos/web/c.jpg', orientation: 'landscape', scene: 'volunteers', status: 'ready', usage: 'ready' }
  ];
  fx.volunteer_events.forEach(e => { if (e.id === EV) e.start_time = '12:00:00'; });
  fx.volunteer_role_guides.forEach(g => { g.arrive_offset_min = g.role === 'server' ? 0 : -75; g.duration_min = g.role === 'server' ? 120 : 75; });
  fx.volunteer_role_guides.push({ role: 'team_leader', label_en: 'Team leader', label_fr: 'Responsable', arrive_offset_min: -60, duration_min: 210, itinerary: 'lead_driver', expect_en: [], expect_fr: [] },
    { role: 'community_debrief', label_en: 'Community lead', label_fr: 'Responsable communautaire', arrive_offset_min: -15, duration_min: 150, itinerary: 'community', expect_en: [], expect_fr: [] });
  fx.volunteer_itinerary_settings = [{ key: 'meet_spot', value: 'Maisonneuve side' }, { key: 'storage_place', value: '888 Rue Saint-Antoine W' }, { key: 'storage_access', value: null }, { key: 'dish_place', value: 'Old Brewery Mission' }, { key: 'pickup_lead_min', value: '75' }, { key: 'audit_url', value: 'https://forms.gle/1FqxfNeVq1ZorJUj8' }, { key: 'notes_en', value: 'Gloves on.' }, { key: 'notes_fr', value: 'Des gants.' }];
  fx.app_config.push({ key: 'sms_itinerary_hour', value: '17' });
  const NEEDS = [{ v: 'food', en: 'Food insecurity', fr: 'x' }, { v: 'clothing', en: 'Clothing', fr: 'x' }, { v: 'housing', en: 'Housing', fr: 'x' }];
  fx.volunteer_survey_questions = [
    { id: 1, role: '*', qkey: 'overall', sort: 10, kind: 'choice', label_en: 'Overall, how was your experience?', label_fr: 'x', options: [{ v: 'excellent', en: 'Excellent', fr: 'x' }, { v: 'good', en: 'Good', fr: 'x' }], required: true, other: false, active: true },
    { id: 2, role: 'server', qkey: 'needs', sort: 100, kind: 'multi', label_en: 'Which needs did the people you served tell you about?', label_fr: 'x', options: NEEDS, required: true, other: true, active: true },
    { id: 3, role: 'server', qkey: 'meal_reaction', sort: 120, kind: 'choice', label_en: 'How did people react to the meal?', label_fr: 'x', options: [{ v: 'loved', en: 'They loved it', fr: 'x' }], required: true, other: false, active: true },
    { id: 4, role: 'team_leader', qkey: 'meals', sort: 100, kind: 'number', label_en: 'About how many meals were served?', label_fr: 'x', options: [], required: true, other: false, min_v: 0, max_v: 1000, active: true },
    { id: 5, role: 'cook', qkey: 'recipe', sort: 100, kind: 'choice', label_en: 'How was the recipe?', label_fr: 'x', options: [{ v: 'clear', en: 'Clear', fr: 'x' }], required: true, other: false, active: true },
    { id: 6, role: '*', qkey: 'improve', sort: 810, kind: 'text', label_en: 'What is one thing we could do better next time?', label_fr: 'x', options: [], required: false, other: false, active: true }
  ];
  fx.volunteer_survey_responses = [
    { id: 1, roster_id: 9004, event_id: EV, role: 'server', lang: 'en', answers: { overall: 'excellent', needs: ['food', 'clothing', { other: 'Winter boots' }], meal_reaction: 'loved', improve: 'More <b>gloves</b>' }, submitted_at: '2026-10-02T19:00:00Z', updated_at: null },
    { id: 2, roster_id: 9006, event_id: EV, role: 'team_leader', lang: 'fr', answers: { overall: 'good', meals: 110 }, submitted_at: '2026-10-02T19:30:00Z', updated_at: null }
  ];
  return fx;
}
const INSTALL = () => {
  window.__W171 = { rpc: [], fn: [], up: [] };
  const f0 = db.from.bind(db);
  db.from = function (t) { const b = f0(t); const u = b.update.bind(b); b.update = function (p) { window.__W171.up.push({ t: t, p: p }); return u(p); }; const us = b.upsert.bind(b); b.upsert = function (p) { window.__W171.up.push({ t: t, p: p, upsert: true }); return us(p); }; return b; };
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
    let f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fixture(), rpcs: RPCS_ADMIN, init: INIT, wait: 4500 });
    await f.ev(INSTALL);
    await f.page.waitForTimeout(800);
    let card = await text(f, '#w174card');
    ok('card: under the Texts card', await f.ev(() => { const a = document.getElementById('w171card'), b = document.getElementById('w174card'); return !!a && !!b && a.nextElementSibling === b; }), card);
    ok('card: the start time and each role', /Serving starts at/.test(card) && /11:00 am\s*Team leader and main driver at the storage unit/.test(card) && /10:45 am\s*Pickup driver/.test(card) && /11:45 am\s*Community lead/.test(card) && /12:00 pm\s*Serving: servers, photographers \(to 2:00 pm\)/.test(card), card);
    ok('card: itinerary text hour', /text with it at 5:00 pm/.test(card));
    ok('card: previews as test links', await f.ev(() => !!document.querySelector('#w174card a[href="https://hub.welfareavenue.com/c/tok9003abcdefghijk?test=1"]') && !document.querySelector('#w174card a[href*="tok9002"]')));
    ok('card: survey numbers', /2\s*answered of 2 confirmed/.test(card), card.slice(-450));
    ok('card: overall and needs, with the other answer', /Overall/i.test(card) && /Excellent/.test(card) && /Needs people told us about/i.test(card) && /Food insecurity/.test(card) && /Other: Winter boots/.test(card), card);
    ok('card: meals served from the team leader', /110\s*meals served/.test(card));
    const tags = await f.ev(() => ({ drv: (document.querySelector('#w119 [data-w119card="9003"] [data-w174drv]') || {}).innerText, sv: (document.querySelector('#w119 [data-w119card="9004"]') || {}).innerText }));
    ok('tags: the only driver, survey answered', tags.drv === 'Only driver' && /Survey answered/.test(tags.sv), tags);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/20-card.png', fullPage: true });

    await f.page.click('#w119 [data-w119card="9003"] [data-w174drv]'); await f.page.waitForTimeout(500);
    let up = await f.ev(() => window.__W171.up.filter(u => u.t === 'event_roster'));
    ok('driver: click switches the part (saved in detail)', up.length === 1 && up[0].p.detail.driver_role === 'main' && up[0].p.detail.phone, up);
    await f.page.fill('#w174st', '12:30'); await f.page.click('[data-w174st]'); await f.page.waitForTimeout(500);
    up = await f.ev(() => window.__W171.up.filter(u => u.t === 'volunteer_events'));
    ok('start time: saved', up.length === 1 && up[0].p.start_time === '12:30', up);
    card = await text(f, '#w174card');
    ok('start time: the roles move', /11:30 am\s*Team leader/.test(card) && /12:30 pm\s*Serving/.test(card), card);

    await f.page.click('[data-w174read]'); await f.page.waitForTimeout(300);
    let m = await text(f, '#modalBox');
    ok('answers: every answer with its question', /Survey answers/i.test(m) && /Eriana Example/.test(m) && /Which needs did the people you served tell you about\?\s*Food insecurity, Clothing, Other: Winter boots/.test(m) && /About how many meals were served\?\s*110/.test(m) && /in French/.test(m), m);
    ok('answers: text shown as text', await f.ev(() => !document.querySelector('#modalBox .w174ans b b')) && /More <b>gloves<\/b>/.test(m));
    await f.ev(() => closeModal());

    await f.page.click('[data-w171set]'); await f.page.waitForTimeout(1200);
    m = await text(f, '#modalBox');
    ok('settings: itineraries', /Itineraries/i.test(m) && await f.ev(() => document.querySelector('[data-w174it="storage_place"]').value === '888 Rue Saint-Antoine W' && document.querySelector('[data-w174it="notes_en"]').value === 'Gloves on.'), m.slice(0, 300));
    ok('settings: survey for every role, no link field', await f.ev(() => !document.getElementById('w171svu')));
    ok('settings: the role’s questions (cook)', /This role.s survey after the serving/i.test(m) && /How was the recipe\?/.test(m) && /Overall, how was your experience\?/.test(m) && !/How did people react/.test(m));
    await f.page.fill('[data-w174it="storage_access"]', 'Door *1234#');
    await f.page.click('[data-w174itsave]'); await f.page.waitForTimeout(600);
    up = await f.ev(() => window.__W171.up.filter(u => u.t === 'volunteer_itinerary_settings'));
    ok('settings: itineraries save', up.length === 1 && up[0].upsert && up[0].p.some(x => x.key === 'storage_access' && x.value === 'Door *1234#'), up);
    await f.page.uncheck('[data-w174q="5"]'); await f.page.waitForTimeout(500);
    up = await f.ev(() => window.__W171.up.filter(u => u.t === 'volunteer_survey_questions'));
    ok('settings: a question switched off', up.length === 1 && up[0].p.active === false, up);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/21-settings.png' });
    ok('no page errors', f.errs.length === 0, f.errs);
    await f.close();

    f = await fresh(browser, { who: 'admin', width: 390, hash: '#volunteering/e/900', fixture: fixture(), rpcs: RPCS_ADMIN, init: INIT, wait: 4500 });
    await f.page.waitForTimeout(600);
    ok('phone: the card and no sideways scroll', !!(await text(f, '#w174card')) && await f.ev(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await f.close();
    f = await fresh(browser, { who: 'board', hash: '#volunteering/e/900', fixture: fixture(), rpcs: {}, init: INIT, wait: 3500 });
    ok('board viewer: no card', !(await f.ev(() => !!document.getElementById('w174card'))));
    await f.close();
  } finally { await browser.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
