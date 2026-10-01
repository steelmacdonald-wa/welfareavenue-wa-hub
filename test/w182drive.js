/* w182drive.js: wave182 in the Hub, offline against the candidate (CAND=build/<file>.html): the Itineraries block on the
   Survey and itinerary card (sent counts, the modes, the season), Send itineraries (who is ticked, quick picks, text and/or
   email, now / the day before / a set time, the note, update, the text, email and page previews, a test email, the RPC as
   called), Sent and scheduled (cancel), This serving's itinerary (WhatsApp link check, the photo, the automatic send),
   Text settings (the season's photos and what to always bring), roster tags, a leader, the phone, board viewers. */
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
    if (fn === 'wa182_itinerary_status') return Promise.resolve({ data: window.__W182SENDS || [], error: null });
    if (fn === 'wa182_look') return Promise.resolve({ data: { season: 'autumn', hero: { id: 49, path: 'photos/web/c.jpg' }, band: { id: 28, path: 'photos/web/b.jpg' } }, error: null });
    if (fn === 'wa182_preview_text') return Promise.resolve({ data: 'Hi there, here is your itinerary for Friday, October 2 (' + (args.p_update ? 'update' : 'new') + ', note: ' + (args.p_note || '') + ')', error: null });
    if (fn === 'wa182_send_itineraries') return Promise.resolve({ data: { people: args.p_roster.length, texts: args.p_roster.length, emails: 1, no_way_to_reach: 0, send_at: args.p_send_at, tick: args.p_send_at ? null : { texts: args.p_roster.length, emails: 1, skipped: 0, waiting_for_8am: 0 } }, error: null });
    if (fn === 'wa182_cancel_itineraries') return Promise.resolve({ data: 1, error: null });
    return r0(fn, args);
  };
  db.functions.invoke = function (name, opts) {
    window.__W171.fn.push({ name: name, body: opts && opts.body });
    const b = (opts && opts.body) || {};
    if (name === 'mail-send' && b.action === 'itinerary_preview') return Promise.resolve({ data: { subject: 'Your itinerary for Friday, October 2', from: 'Welfare Avenue <info@welfareavenue.com>', html: '<html><body style="background:#151614;color:#fff"><h1>EMAIL ' + b.roster_id + ' ' + (b.note || '') + '</h1></body></html>' }, error: null });
    if (name === 'mail-send' && b.action === 'itinerary_test') return Promise.resolve({ data: { status: 'sent', to: 'steel.macdonald@welfareavenue.com' }, error: null });
    return Promise.resolve({ data: { text: 'Hi Nasim...', results: [{ to: '+1438***39', ok: true }] }, error: null });
  };
};
const INIT = '';
const RPCS_ADMIN = { wa_org_editor: true, is_wa_admin: true, is_wa_leader: true, wa_is_hr: false, is_wa_staff: true };
const RPCS_LEADER = { is_wa_admin: false, is_wa_leader: true, wa_is_hr: false, is_wa_staff: true };
const text = (f, sel) => f.ev(s => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);



(async () => {
  const browser = await launch();
  try {
    const fx = fixture();
    fx.volunteer_role_guides.push({ role: 'driver', label_en: 'Driver', label_fr: 'Chauffeur', arrive_offset_min: -60, duration_min: 210, itinerary: 'lead_driver', expect_en: [], expect_fr: [] });
    fx.volunteer_role_guides.forEach(g => { if (g.role === 'server') g.itinerary = 'serve'; });
    fx.volunteer_events.forEach(e => { if (e.id === 900) Object.assign(e, { whatsapp_url: null, itinerary_photo_id: null, itinerary_auto: true, itinerary_channels: 'both' }); });
    fx.app_config.push({ key: 'mail_mode', value: 'test' }, { key: 'mail_test_recipients', value: 'steelmacdonald@gmail.com, steel.macdonald@welfareavenue.com' });
    fx.wa_photos.forEach(p => { p.season = p.id === 49 ? 'autumn' : 'summer'; });
    const SENDS = [{ id: 501, batch: 'x', roster_id: 9006, channel: 'text', send_at: '2026-10-01T21:00:00Z', status: 'sent', reason: null, note: null, is_update: false, auto: true, to_addr: '5145550006', created_by: 'automation', created_at: '2026-10-01T21:00:00Z', delivery: 'sent' },
                   { id: 502, batch: 'y', roster_id: 9003, channel: 'email', send_at: '2026-10-01T21:00:00Z', status: 'scheduled', reason: null, note: 'Bring a coat', is_update: false, auto: false, to_addr: null, created_by: 'steel.macdonald@welfareavenue.com', created_at: '2026-09-30T12:00:00Z', delivery: null }];
    let f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fx, rpcs: RPCS_ADMIN, init: 'window.__W182SENDS = ' + JSON.stringify(SENDS) + ';', wait: 4500 });
    await f.ev(INSTALL);
    await f.ev(s => { window.__W182SENDS = s; return window.w171.w182.loadSends(900, true); }, SENDS);
    await f.ev(() => { const c = document.getElementById('w174card'); if (c) c.__h = ''; return window.w171 && window.w171.paintW174 && window.w171.paintW174(); });
    await f.page.waitForTimeout(1200);
    let blk = await text(f, '#w182blk');
    ok('block: on the card, above the survey', await f.ev(() => { const b = document.getElementById('w182blk'), c = document.getElementById('w174card'); if (!b || !c) return false; const sv = Array.from(c.querySelectorAll('.w171h')).filter(x => /Survey/.test(x.textContent))[0]; return !!sv && !!(b.compareDocumentPosition(sv) & Node.DOCUMENT_POSITION_FOLLOWING); }), blk);
    ok('block: sent count and season', /Itineraries · Autumn look/i.test(blk) && /1 of 4 sent/i.test(blk), blk);
    ok('block: modes, scheduled, WhatsApp', /Texts on/.test(blk) && /Email in test mode/.test(blk) && /1 scheduled/.test(blk) && /No WhatsApp group yet/.test(blk), blk);
    ok('block: automatic send line', /day before at 5:00 pm/.test(blk) && /by text and email/.test(blk) && /cooks don’t/.test(blk), blk);
    ok('previews open the itinerary', await f.ev(() => !!document.querySelector('#w174card a[href="https://hub.welfareavenue.com/c/tok9003abcdefghijk?test=1&it=1"]')));
    ok('roster tags: itinerary sent and scheduled', await f.ev(() => { const a = document.querySelector('[data-w119card="9006"]'), b = document.querySelector('[data-w119card="9003"]'); return !!a && /Itinerary: Texted/.test(a.innerText) && !!b && /Itinerary: Email scheduled/.test(b.innerText); }));
    // Send itineraries
    await f.ev(() => document.querySelector('[data-w182send]').click());
    await f.page.waitForTimeout(1500);
    let m = await text(f, '#modalBox');
    ok('send: title, season and sender', /Send itineraries/i.test(m) && /autumn photo/.test(m) && /info@welfareavenue.com/.test(m), m.slice(0, 400));
    ok('send: test-mode notes', /Email is in test mode/.test(m) && !/Texts are in test mode/.test(m), m.slice(0, 600));
    const ids0 = await f.ev(() => Array.from(document.querySelectorAll('[data-w182pick]')).map(c => +c.getAttribute('data-w182pick')).sort());
    ok('send: people with an itinerary, cooks left out', JSON.stringify(ids0) === JSON.stringify([9003, 9004, 9005, 9006]) && /1 cook not listed/.test(m), { ids0, m: m.slice(-700) });
    ok('send: default ticks (confirmed, not sent yet)', await f.ev(() => Array.from(document.querySelectorAll('[data-w182pick]:checked')).map(c => +c.getAttribute('data-w182pick')).join() === ''));
    await f.ev(() => document.querySelector('[data-w182sel="all"]').click());
    await f.page.waitForTimeout(500);
    ok('send: everyone picks all and marks an update (someone already had it)', await f.ev(() => document.querySelectorAll('[data-w182pick]:checked').length === 4 && document.getElementById('w182upd').checked));
    await f.ev(() => document.querySelector('[data-w182sel="new"]').click());
    await f.page.waitForTimeout(400);
    ok('send: not sent yet', await f.ev(() => Array.from(document.querySelectorAll('[data-w182pick]:checked')).map(c => +c.getAttribute('data-w182pick')).sort().join() === '9004,9005'));
    await f.ev(() => { document.getElementById('w182note').value = 'Bring gloves'; document.getElementById('w182note').dispatchEvent(new Event('input', { bubbles: true })); });
    await f.page.waitForTimeout(900);
    ok('send: text preview with the note', /Bring gloves/.test(await text(f, '#w182prev .sms')), await text(f, '#w182prev'));
    await f.ev(() => document.querySelector('[data-w182tab="email"]').click());
    await f.page.waitForTimeout(900);
    ok('send: email preview in a frame', await f.ev(() => { const i = document.querySelector('#w182prev iframe'); return !!i && /EMAIL 9004 Bring gloves/.test(i.srcdoc); }) && /Subject:\s*Your itinerary/.test(await text(f, '#w182prev')));
    await f.ev(() => document.querySelector('[data-w182tab="page"]').click());
    await f.page.waitForTimeout(300);
    ok('send: page preview link', await f.ev(() => !!document.querySelector('#w182prev a[href*="/c/tok9004abcdefghijk?test=1&it=1"]')));
    await f.ev(() => document.querySelector('[data-w182test]').click());
    await f.page.waitForTimeout(600);
    ok('send: test email to me', await f.ev(() => window.__W171.fn.some(x => x.name === 'mail-send' && x.body.action === 'itinerary_test' && x.body.roster_id === 9004 && x.body.note === 'Bring gloves')));
    // email only, the day before
    await f.ev(() => { const r = document.querySelector('input[name="w182ch"][value="email"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); const w = document.querySelector('input[name="w182when"][value="daybefore"]'); if (w) { w.checked = true; w.dispatchEvent(new Event('change', { bubbles: true })); } });
    const hasDB = await f.ev(() => !!document.querySelector('input[name="w182when"][value="daybefore"]'));
    await f.ev(() => document.querySelector('[data-w182go]').click());
    await f.page.waitForTimeout(800);
    const call = await f.ev(() => window.__W171.rpc.filter(x => x.fn === 'wa182_send_itineraries').pop());
    ok('send: the RPC as called', !!call && JSON.stringify(call.args.p_roster.slice().sort()) === '[9004,9005]' && call.args.p_channel === 'email' && call.args.p_note === 'Bring gloves' && call.args.p_event === 900 && (hasDB ? /T2[01]:00:00/.test(String(call.args.p_send_at)) : call.args.p_send_at === null), call);
    ok('send: closes after', await f.ev(() => { const b = document.getElementById('modalBack'); return !b || b.style.display !== 'flex' || !document.querySelector('#modalBox .w182m'); }));
    // set time in the past is refused
    await f.ev(() => document.querySelector('[data-w182send]').click());
    await f.page.waitForTimeout(1500);
    await f.ev(() => { document.querySelector('[data-w182sel="all"]').click(); const w = document.querySelector('input[name="w182when"][value="at"]'); w.checked = true; w.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('w182at').value = '2020-01-01T10:00'; });
    ok('send: set time shows the picker', await f.ev(() => document.getElementById('w182at').style.display !== 'none'));
    const n0 = await f.ev(() => window.__W171.rpc.filter(x => x.fn === 'wa182_send_itineraries').length);
    await f.ev(() => document.querySelector('[data-w182go]').click());
    await f.page.waitForTimeout(500);
    ok('send: a past time is refused', await f.ev(n => window.__W171.rpc.filter(x => x.fn === 'wa182_send_itineraries').length === n, n0));
    await f.ev(() => document.querySelector('[data-w171close]').click());
    // history
    await f.ev(() => document.querySelector('[data-w182hist]').click());
    await f.page.waitForTimeout(900);
    m = await text(f, '#modalBox');
    ok('history: both rows, note, cancel', /Sam Handmade/.test(m) && /Alex Example/.test(m) && /Bring a coat/.test(m) && await f.ev(() => !!document.querySelector('[data-w182cancel="502"]')), m);
    await f.ev(() => document.querySelector('[data-w182cancel="502"]').click());
    await f.page.waitForTimeout(700);
    ok('history: cancel calls the RPC', await f.ev(() => window.__W171.rpc.some(x => x.fn === 'wa182_cancel_itineraries' && x.args.p_ids[0] === 502)));
    // this serving's itinerary
    await f.ev(() => { const c = document.querySelector('[data-w171close]'); if (c) c.click(); document.querySelector('[data-w182ev]').click(); });
    await f.page.waitForTimeout(1200);
    m = await text(f, '#modalBox');
    ok('serving: the window', /This serving’s itinerary/i.test(m) && /WhatsApp group invite link/.test(m) && /The photo at the top/.test(m), m.slice(0, 300));
    await f.ev(() => { document.getElementById('w182wa').value = 'https://example.com/x'; document.querySelector('[data-w182evsave]').click(); });
    await f.page.waitForTimeout(400);
    ok('serving: a wrong WhatsApp link is refused', await f.ev(() => !window.__W171.up.some(x => x.t === 'volunteer_events' && 'whatsapp_url' in x.p)));
    await f.ev(() => { document.getElementById('w182wa').value = 'https://chat.whatsapp.com/ABCdef123'; const n = document.querySelector('input[name="w182auto"][value="0"]'); n.checked = true; document.querySelector('[data-w182pic="49"]').click(); document.querySelector('[data-w182evsave]').click(); });
    await f.page.waitForTimeout(900);
    const up = await f.ev(() => window.__W171.up.filter(x => x.t === 'volunteer_events' && 'whatsapp_url' in x.p).pop());
    ok('serving: saved', !!up && up.p.whatsapp_url === 'https://chat.whatsapp.com/ABCdef123' && up.p.itinerary_auto === false && up.p.itinerary_photo_id === 49 && up.p.itinerary_channels === 'both', up);
    // Text settings: the season's photos and what to always bring
    await f.ev(() => { const s = document.querySelector('[data-w171set]'); if (s) s.click(); });
    await f.page.waitForTimeout(2200);
    m = await text(f, '#modalBox');
    ok('settings: the look and always bring', /The itinerary’s look/i.test(m) && /Winter \(Dec to Feb\)/.test(m) && /Always bring/.test(m), m.slice(0, 200));
    await f.ev(() => document.querySelector('[data-w182seas="photo_winter"]').click());
    await f.page.waitForTimeout(300);
    await f.ev(() => document.querySelector('[data-w182seasset="photo_winter:49"]').click());
    ok('settings: a season photo picked', await f.ev(() => document.querySelector('input[data-w174it="photo_winter"]').value === '49'));
    await f.ev(() => document.querySelector('[data-w174itsave]').click());
    await f.page.waitForTimeout(900);
    ok('settings: saved with the itineraries', await f.ev(() => window.__W171.up.some(x => x.t === 'volunteer_itinerary_settings' && x.upsert && x.p.some(r => r.key === 'photo_winter' && r.value === '49'))));
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/settings.png' });
    await f.page.close();
    // a leader
    f = await fresh(browser, { who: 'member', hash: '#volunteering/e/900', fixture: fx, rpcs: RPCS_LEADER, init: '', wait: 4500 });
    await f.ev(INSTALL);
    await f.ev(() => { const c = document.getElementById('w174card'); if (c) c.__h = ''; return window.w171 && window.w171.paintW174 && window.w171.paintW174(); });
    await f.page.waitForTimeout(1200);
    ok('leader: can send', await f.ev(() => !!document.querySelector('[data-w182send]')));
    await f.page.close();
    // the phone
    f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fx, rpcs: RPCS_ADMIN, init: '', wait: 4500, width: 390 });
    await f.ev(INSTALL);
    await f.ev(() => { const c = document.getElementById('w174card'); if (c) c.__h = ''; return window.w171 && window.w171.paintW174 && window.w171.paintW174(); });
    await f.page.waitForTimeout(1000);
    await f.ev(() => { const b = document.querySelector('[data-w182send]'); if (b) b.click(); });
    await f.page.waitForTimeout(1500);
    ok('phone: the send window fits', await f.ev(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && !!document.querySelector('#modalBox .w182m')));
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/phone-send.png', fullPage: false });
    await f.page.close();
    // a board viewer sees nothing
    f = await fresh(browser, { who: 'board', hash: '#volunteering/e/900', fixture: fx, rpcs: { is_wa_admin: false, is_wa_leader: false, wa_is_hr: false, is_wa_staff: false }, init: '', wait: 4000 });
    ok('board viewer: no block', await f.ev(() => !document.getElementById('w182blk')));
    await f.page.close();
  } catch (e) { fail++; console.log('FAIL exception ' + (e && e.stack || e)); }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
