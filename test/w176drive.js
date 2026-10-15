/* w176drive.js: wave176, MTL volunteering as its own app (the Volunteer Manager in the launcher: the rail, the app bar's
   Text volunteers, the Hub menu without it, a serving inside the app) and one record with the CRM (the editor says so and links). */
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
  fx.volunteer_people = (fx.volunteer_people || []).slice(0, 5).map((p, i) => Object.assign({}, p, { contact_id: 7000 + i }));
  if (!fx.volunteer_people.length) fx.volunteer_people = [{ id: 501, full_name: 'Eriana Example', emails: ['e@gmail.com'], phones: ['5145550004'], roles: ['server'], tags: ['server'], notes: null, address: null, needs_review: false, contact_id: 7000 }];
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
    let f = await fresh(browser, { who: 'admin', hash: '#volunteering', fixture: fixture(), rpcs: RPCS_ADMIN, init: INIT, wait: 4500 });
    await f.ev(INSTALL);
    let st = await f.ev(() => ({ app: document.body.classList.contains('w153volunteer'), inApp: document.body.classList.contains('w153app'), rail: (document.getElementById('w153rail') || {}).innerText || '', bar: (document.getElementById('w153bar') || {}).innerText || '', tab: (function () { const t = document.querySelector('#tabBar .tab[data-tab="volunteering"]'); return t ? getComputedStyle(t).display : 'none'; })(), chips: (function () { const c = document.querySelector('#volunteering .vl-sub'); return c ? getComputedStyle(c).display : 'none'; })() }));
    ok('#volunteering opens the Volunteer Manager app', st.app && st.inApp, st);
    ok('rail: servings and people', /Volunteer Manager/i.test(st.rail + st.bar) && /Calendar/.test(st.rail) && /The SOP/.test(st.rail) && /Recipes/.test(st.rail) && /Inventory/.test(st.rail) && /Volunteers/.test(st.rail), st.rail);
    ok('the Hub menu no longer lists MTL volunteering', st.tab === 'none', st.tab);
    ok('the page chips give way to the rail on a computer', st.chips === 'none', st.chips);
    ok('Text volunteers in the page header (wave197: no app bar on a computer)', await f.ev(() => /Text volunteers/.test((document.querySelector('.panel.active > .w118mast [data-w197proxy="text"]') || {}).textContent || '')), st.bar);
    await f.ev(() => { window.__tx = 0; window.waTxtModal = function () { window.__tx++; }; });
    await f.page.click('.panel.active > .w118mast [data-w197proxy="text"]'); await f.page.waitForTimeout(300);
    ok('Text volunteers opens the texting window', await f.ev(() => window.__tx === 1));
    await f.hash('#volunteering/people', 1800);
    ok('rail marks Volunteers', await f.ev(() => { const on = document.querySelector('#w153rail .w153it.on, #w153rail [aria-current="page"]'); return !!on && /Volunteers/.test(on.textContent); }));
    const pid = await f.ev(() => { const a = document.querySelector('[data-w26e]'); return a ? a.getAttribute('data-w26e') : null; });
    if (pid) {
      await f.page.click('[data-w26e="' + pid + '"]'); await f.page.waitForTimeout(400);
      const m = await text(f, '#modalBox');
      ok('edit: one record with the CRM, and a link to it', /One record: these details are also this person.s contact in the CRM/.test(m) && await f.ev(() => /^#crm\/c\/70\d\d$/.test((document.querySelector('[data-w176crm]') || {}).getAttribute ? document.querySelector('[data-w176crm]').getAttribute('href') : '')), m.slice(0, 300));
      await f.ev(() => closeModal());
    } else ok('edit: a volunteer row to edit', false);
    await f.hash('#volunteering', 1500);
    ok('refresh: the repeat title and intro give way to the masthead in the app', await f.ev(() => { const h = document.querySelector('#volunteering > .card > h2[data-w118slim]'); const r = h && h.nextElementSibling && h.nextElementSibling.nextElementSibling; return !!h && getComputedStyle(h).display === 'none' && (!r || !r.classList.contains('read') || getComputedStyle(r).display === 'none') && getComputedStyle(document.querySelector('#volunteering .w118mast')).display !== 'none'; }));
    /* the CRM contact's button opens the same person in the Volunteer Manager */
    if (pid) {
      await f.hash('#crm', 2500);
      await f.ev(p => { const root = document.querySelector('.w152root'); const b = document.createElement('button'); b.id = 't176go'; b.className = 'w152mini'; b.setAttribute('data-w152go', '#volunteering/people'); b.setAttribute('data-w176vid', p); b.textContent = 'Open in the Volunteer Manager'; (root || document.body).appendChild(b); }, pid);
      const hasRoot = await f.ev(() => !!document.querySelector('.w152root #t176go'));
      if (hasRoot) {
        await f.page.click('#t176go'); await f.page.waitForTimeout(2500);
        const m2 = await text(f, '#modalBox');
        ok('CRM: Open in the Volunteer Manager lands on that person\'s editor', /#volunteering\/people/.test(await f.ev(() => location.hash)) && /Edit volunteer/i.test(m2) && /One record/.test(m2), { h: await f.ev(() => location.hash), m2 });
        await f.ev(() => { try { closeModal(); } catch (e) { /* fine */ } });
      } else ok('CRM: its page renders', false);
    }
    await f.hash('#volunteering/e/900', 2200);
    ok('a serving opens inside the app with Servings marked (wave257: Calendar is its own page)', await f.ev(() => document.body.classList.contains('w153volunteer') && /Servings/.test((document.querySelector('#w153rail .w153it.on') || {}).textContent || '')));
    await f.hash('#mypage', 1500);
    ok('a Hub page leaves the app', await f.ev(() => !document.body.classList.contains('w153app')));
    await f.page.click('#w153dock .w153grid'); await f.page.waitForTimeout(300);
    ok('the launcher lists the Volunteer Manager', /Volunteer Manager/.test(await text(f, '#w153pop')));
    ok('no page errors', f.errs.length === 0, f.errs);
    await f.close();
  } finally { await browser.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
