/* w258drive.js: wave258, the volunteer texts made clear and checked, offline against the candidate (CAND=build/<file>.html).
   The serving page's Texts strip (the schedule with dates and counts, Text log, My roles, Role owners), More > Text log,
   the roster cards (4-day rule agreed, the last text and its delivery, No phone number, From the old sheet: Keep or Remove),
   My roles dims the other columns, the Text log window (filters, Check delivery now through quo-send delivery), Role owners
   (Save), Applicants received (My roles in the role filter, who last texted them), Volunteers (who last texted them), a phone. */
const { launch, fresh } = require('./boot');
const fs = require('fs');
const fx191 = require('./w191fx');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 700) : '')); } }
const shot = async (f, n) => { if (SHOTS) await f.page.screenshot({ path: SHOTS + '/' + n + '.png', fullPage: false }); };

function fixture() {
  const fx = fx191();
  fx.volunteer_people.push({ id: 705, full_name: 'Sophia Labrosse', roles: ['dishwasher', 'server'], phones: ['5147262676'], emails: ['labrosses30@gmail.com'], tags: ['volunteer applicant'], contact_id: 3071 });
  /* Nasim confirmed on the page with the 4-day box; Karim copied from the old sheet */
  fx.event_roster.forEach(r => { if (r.id === 9001) { r.confirm_status = 'confirmed'; r.confirm = { via: 'link', cancel_rule_ok: true }; } });
  fx.event_roster.push({ id: 9008, event_id: 900, person_id: null, person_name: 'Karim El Malki', role: 'team_leader', status: 'TBD', detail: { source: 'sheet', phone: '5149428965' } });
  fx.volunteer_applications = [
    { id: 81, person_id: 705, contact_id: 3071, name: 'Sophia Labrosse', email: 'labrosses30@gmail.com', phone: '5147262676', roles: ['dishwasher', 'server'], role_text: 'Dishwasher, Server', source: 'website', applied_at: '2026-09-24T03:11:47Z', status: 'received', language: 'en' },
    { id: 82, person_id: 2, contact_id: 7002, name: 'Abhigail Pascua-Matte', email: 'a@example.com', phone: '5145550002', roles: ['cook'], role_text: 'Cook', source: 'website', applied_at: '2026-09-23T12:00:00Z', status: 'received', language: 'en' }
  ];
  return fx;
}
const OWNERS = { owners: { cook: 'marydilusha.celestine@welfareavenue.com', driver: 'marydilusha.celestine@welfareavenue.com', team_leader: 'marydilusha.celestine@welfareavenue.com', server: 'eleftherios.katsipis@welfareavenue.com', dishwasher: 'eleftherios.katsipis@welfareavenue.com', photographer: 'eleftherios.katsipis@welfareavenue.com' },
  names: { 'marydilusha.celestine@welfareavenue.com': 'Mary', 'eleftherios.katsipis@welfareavenue.com': 'Eleftherios Katsipis' }, mine: ['cook', 'driver', 'team_leader'], can_edit: true };
const t = (kind, status, delivery, at, error, by) => ({ kind, status, delivery: delivery || null, error: error || '', at: at || '2026-09-22T14:02:00Z', by: by || 'automation' });
const LOG = { event: { id: 900, date: '2026-10-02', code: 'WA-26-90' }, mode: 'live', can_text: true, notice_days: 4, owners: OWNERS.owners,
  schedule: [
    { kind: 'confirm', label: 'Confirmation', at: '2026-09-22 10:00', who: 'Everyone on the list who has not answered', on: true },
    { kind: 'reminder', label: 'Monday reminder', at: '2026-09-26 10:00', who: 'Confirmed and not answered', on: true },
    { kind: 'deadline', label: 'Last day to cancel', at: '2026-09-28', who: '4 days before', on: true },
    { kind: 'checkin', label: 'Thursday check-in', at: '2026-09-29 10:00', who: 'Confirmed and not answered', on: true },
    { kind: 'itinerary', label: 'Itinerary', at: '2026-10-01 17:00', who: 'Team leaders and drivers', on: true },
    { kind: 'survey', label: 'Thank-you and survey', at: '2026-10-02 18:00', who: 'Everyone confirmed', on: true }],
  rows: [
    { id: 9001, name: 'Nasim Example', role: 'cook', status: 'Confirmed', cs: 'confirmed', via: 'link', rule: true, late: false, phone: true, partner: false, texts: [t('confirm', 'sent', 'delivered')], replies: 0 },
    { id: 9002, name: 'Iman Example', role: 'cook', status: 'Unavailable', cs: 'declined', via: 'reply', rule: false, late: true, phone: true, partner: false, texts: [t('confirm', 'sent', 'delivered')], replies: 1 },
    { id: 9003, name: 'Alex Example', role: 'driver', status: 'TBD', cs: null, rule: false, phone: true, partner: false, texts: [t('confirm', 'failed', null, null, '400 not approved for A2P')], replies: 0 },
    { id: 9004, name: 'Eriana Example', role: 'server', status: 'Waiting For Response', cs: null, rule: false, phone: true, partner: false, texts: [t('confirm', 'queued')], replies: 0 },
    { id: 9005, name: 'Noa Nophone', role: 'server', status: 'TBD', cs: null, rule: false, phone: false, partner: false, texts: [], replies: 0 },
    { id: 9006, name: 'Sam Handmade', role: 'team_leader', status: 'Confirmed', cs: 'confirmed', via: 'reply', rule: false, phone: true, partner: false, texts: [t('confirm', 'sent', 'delivered'), t('manual', 'sent', 'delivered', '2026-09-23T15:00:00Z', null, 'marydilusha.celestine@welfareavenue.com')], replies: 2 },
    { id: 9007, name: 'Old Brewery (Clark Street)', role: 'dishwasher', status: 'Confirmed', cs: null, phone: false, partner: true, texts: [], replies: 0 },
    { id: 9008, name: 'Karim El Malki', role: 'team_leader', status: 'TBD', cs: null, phone: true, partner: false, source: 'sheet', texts: [], replies: 0 }] };
const RPCS = { wa_org_editor: true, is_wa_admin: true, is_wa_leader: true, wa_is_hr: false, is_wa_staff: true, wa256_can_text: true,
  wa191_autotick: { ticked: 0 }, wa191_this_week: { today: '2026-09-25', me: 'Steel', servings: [], overdue: [], unassigned: [], mine: [] } };
const INSTALL = (data) => {
  window.__REC = { calls: [], inv: [] };
  const r0 = db.rpc.bind(db);
  db.rpc = function (fn, args) {
    window.__REC.calls.push({ fn: fn, args: JSON.parse(JSON.stringify(args || {})) });
    const ok = (d) => Promise.resolve({ data: d, error: null });
    if (fn === 'wa258_role_owners') return ok(JSON.parse(JSON.stringify(data.owners)));
    if (fn === 'wa258_role_owners_set') { const o = JSON.parse(JSON.stringify(data.owners)); o.owners = args.p; return ok(o); }
    if (fn === 'wa258_text_log') return ok(JSON.parse(JSON.stringify(data.log)));
    if (fn === 'wa258_sheet_keep') return ok({ ok: true });
    if (fn === 'wa258_contacted') return ok({ '705': { by: 'marydilusha.celestine@welfareavenue.com', name: 'Mary', at: '2026-09-24T18:30:00Z', kind: 'manual' } });
    return r0(fn, args);
  };
  window.__WA_INVOKE = function (name, opts) { window.__REC.inv.push({ name: name, body: JSON.parse(JSON.stringify((opts && opts.body) || {})) }); return { data: { checked: 3, counts: { delivered: 3 } }, error: null }; };
};
const calls = (f, fn) => f.ev(n => window.__REC.calls.filter(c => c.fn === n), fn);

(async () => {
  const browser = await launch();
  try {
    let f = await fresh(browser, { who: 'admin', hash: '#volunteering', fixture: fixture(), rpcs: RPCS, width: 1440, wait: 5000 });
    await f.ev(INSTALL, { owners: OWNERS, log: LOG });
    await f.hash('#volunteering/e/900', 3500);
    /* ---------- the Texts strip ---------- */
    const strip = await f.ev(() => { const s = document.querySelector('#w119 .w258strip'); return s ? { t: s.innerText, items: s.querySelectorAll('.sch li').length, after: !!(s.previousElementSibling && s.previousElementSibling.querySelector('.w191bar')), done: s.querySelectorAll('.sch li.done').length, dl: s.querySelectorAll('.sch li.dl').length } : null; });
    ok('strip: under the stages, six steps', strip && strip.after && strip.items === 6, strip);
    ok('strip: the dates and the counts', strip && /Confirmation/.test(strip.t) && /Tue, Sep 22, 10 am/.test(strip.t) && /3 sent/.test(strip.t) && /Monday reminder/.test(strip.t) && /Last day to cancel/.test(strip.t) && /Thursday check-in/.test(strip.t) && /Itinerary/.test(strip.t) && /survey/i.test(strip.t) && strip.done === 1 && strip.dl === 1, strip);
    ok('strip: the owners and the buttons', strip && /Mary: cooks, drivers, team leaders/.test(strip.t) && /Eleftherios: servers, dishwashers, photographers/.test(strip.t) && /Text log/.test(strip.t) && /My roles/.test(strip.t) && /Role owners/.test(strip.t), strip && strip.t);
    const menu = await f.ev(() => Array.from(document.querySelectorAll('#w119 .acts .menu button')).map(b => b.textContent));
    ok('More: Text log after Text to confirm', menu.indexOf('Text log') === menu.indexOf('Text to confirm') + 1, menu);
    /* ---------- the cards ---------- */
    const cards = await f.ev(() => { const o = {}; document.querySelectorAll('#w119 .pc[data-w119card]').forEach(pc => { o[pc.getAttribute('data-w119card')] = (pc.querySelector('.w258c') || {}).innerText || ''; }); return o; });
    ok('card: 4-day rule agreed and delivered', /4-day rule agreed/.test(cards['9001']) && /Confirmation: delivered/.test(cards['9001']), cards['9001']);
    ok('card: a failed text says why', /Confirmation: failed: 400 not approved/.test(cards['9003']), cards['9003']);
    ok('card: waiting to send, no phone', /waiting to send/.test(cards['9004']) && /No phone number/.test(cards['9005']), [cards['9004'], cards['9005']]);
    ok('card: the partner row has no flags', !cards['9007'], cards['9007']);
    ok('card: from the old sheet, Keep and Remove', /From the old sheet: check/.test(cards['9008']) && /Keep/.test(cards['9008']) && /Remove/.test(cards['9008']), cards['9008']);
    await shot(f, 'serving');
    await f.page.click('#w119 [data-w258keep="9008"]'); await f.page.waitForTimeout(700);
    const kept = await calls(f, 'wa258_sheet_keep');
    const after = await f.ev(() => (document.querySelector('#w119 .pc[data-w119card="9008"] .w258sheet') || null) === null);
    ok('Keep: saved and the flag goes', kept.length === 1 && kept[0].args.p_roster === 9008 && after, kept);
    /* ---------- My roles ---------- */
    await f.page.click('#w119 [data-w258go="mine"]'); await f.page.waitForTimeout(600);
    const dim = await f.ev(() => Array.from(document.querySelectorAll('#w119 .rc[data-w119role]')).map(rc => rc.getAttribute('data-w119role') + (rc.classList.contains('w258dim') ? ':dim' : '') + (rc.querySelector('.w258yours') ? ':yours' : '')));
    ok('My roles: servers dimmed, cooks yours', dim.some(x => x === 'server:dim') && dim.some(x => /^cook:yours/.test(x)) && !dim.some(x => /^cook:dim/.test(x)), dim);
    await f.page.click('#w119 [data-w258go="mine"]'); await f.page.waitForTimeout(500);
    const undim = await f.ev(() => document.querySelectorAll('#w119 .rc.w258dim').length);
    ok('My roles off: nothing dimmed', undim === 0, undim);
    /* ---------- the Text log ---------- */
    await f.page.click('#w119 .w258strip [data-w258go="log"]'); await f.page.waitForTimeout(900);
    let lg = await f.ev(() => { const m = document.getElementById('w258m'); return m ? { t: m.innerText, n: m.querySelectorAll('.w258list li').length } : null; });
    ok('Text log: everyone but the partner, with answers and texts', lg && lg.n === 7 && /Confirmed, 4-day rule agreed/.test(lg.t) && /Can.t make it \(late\)/.test(lg.t) && /Not answered yet/.test(lg.t) && /Text from Mary: delivered/.test(lg.t) && /2 replies/.test(lg.t), lg);
    await shot(f, 'textlog');
    await f.page.click('#w258m [data-w258f="noans"]'); await f.page.waitForTimeout(300);
    lg = await f.ev(() => Array.from(document.querySelectorAll('#w258m .w258list .who b')).map(b => b.textContent));
    ok('Not answered: Alex, Eriana, Noa, Karim', lg.length === 4 && lg.indexOf('Nasim Example') < 0, lg);
    await f.page.click('#w258m [data-w258f="undel"]'); await f.page.waitForTimeout(300);
    lg = await f.ev(() => Array.from(document.querySelectorAll('#w258m .w258list .who b')).map(b => b.textContent));
    ok('Not delivered or no phone: Alex (failed), Noa (no phone)', lg.indexOf('Alex Example') >= 0 && lg.indexOf('Noa Nophone') >= 0 && lg.indexOf('Nasim Example') < 0, lg);
    await f.page.click('#w258m [data-w258f="mine"]'); await f.page.waitForTimeout(300);
    lg = await f.ev(() => Array.from(document.querySelectorAll('#w258m .w258list .who span')).map(b => b.textContent.split(' · ')[0]));
    ok('My roles in the log: cooks, drivers, team leaders only', lg.length > 0 && lg.every(x => /Cook|Driver|Team leader/.test(x)), lg);
    await f.page.click('#w258m [data-w258go="check"]'); await f.page.waitForTimeout(900);
    const inv = await f.ev(() => window.__REC.inv.filter(x => x.name === 'quo-send'));
    ok('Check delivery now: quo-send delivery for this serving', inv.length === 1 && inv[0].name === 'quo-send' && inv[0].body.action === 'delivery' && inv[0].body.event_id === 900, inv);
    ok('the log reloads after the check', (await calls(f, 'wa258_text_log')).length >= 2, null);
    await f.page.click('#w258m [data-w258x]'); await f.page.waitForTimeout(300);
    /* ---------- Role owners ---------- */
    await f.page.click('#w119 .w258strip [data-w258go="owners"]'); await f.page.waitForTimeout(700);
    const own = await f.ev(() => { const m = document.getElementById('w258o'); return m ? { n: m.querySelectorAll('select[data-w258own]').length, cook: (m.querySelector('select[data-w258own="cook"]') || {}).value } : null; });
    ok('Role owners: a select per role, the cook owner chosen', own && own.n === 8 && own.cook === 'marydilusha.celestine@welfareavenue.com', own);
    await f.page.click('#w258o [data-w258go="ownsave"]'); await f.page.waitForTimeout(600);
    const set = await calls(f, 'wa258_role_owners_set');
    ok('Role owners: saved', set.length === 1 && set[0].args.p.cook === 'marydilusha.celestine@welfareavenue.com' && set[0].args.p.server === 'eleftherios.katsipis@welfareavenue.com', set);
    /* ---------- Applicants received ---------- */
    await f.hash('#volunteering/applicants', 2600);
    const sel = await f.ev(() => Array.from(document.querySelectorAll('#w209role option')).map(o => o.value + '=' + o.textContent));
    ok('Applicants: My roles in the role filter', sel.some(x => /^__mine=My roles: Cook, Driver, Team leader \(1\)/.test(x)), sel);
    const ct = await f.ev(() => Array.from(document.querySelectorAll('li.w209app')).map(li => li.getAttribute('data-w209id') + ':' + ((li.querySelector('.w258ct') || {}).innerText || '')));
    ok('Applicants: who last texted Sophia', ct.some(x => /^81:Texted by Mary Sep 24/.test(x)) && ct.some(x => x === '82:'), ct);
    await f.page.selectOption('#w209role', '__mine'); await f.page.waitForTimeout(500);
    const shownApps = await f.ev(() => Array.from(document.querySelectorAll('li.w209app')).map(li => li.getAttribute('data-w209id')));
    ok('My roles: only the cook applicant', shownApps.length === 1 && shownApps[0] === '82', shownApps);
    /* ---------- Volunteers ---------- */
    await f.hash('#volunteering/people', 2600);
    const vrow = await f.ev(() => { const tr = document.querySelector('#volunteering tr[data-p26="705"]'); return tr ? (tr.querySelector('.w258ct') || {}).innerText || '' : null; });
    ok('Volunteers: who last texted Sophia', /Texted by Mary/.test(vrow || ''), vrow);
    ok('no page errors', f.errs.length === 0, f.errs);
    await f.close();
    /* ---------- a phone ---------- */
    f = await fresh(browser, { who: 'admin', hash: '#volunteering', fixture: fixture(), rpcs: RPCS, width: 390, wait: 5000 });
    await f.ev(INSTALL, { owners: OWNERS, log: LOG });
    await f.hash('#volunteering/e/900', 3500);
    const ph = await f.ev(() => ({ strip: !!document.querySelector('#w119 .w258strip'), sw: document.documentElement.scrollWidth <= window.innerWidth + 1 }));
    ok('phone: the strip, no sideways scroll', ph.strip && ph.sw, ph);
    await shot(f, 'phone');
    await f.page.click('#w119 .w258strip [data-w258go="log"]'); await f.page.waitForTimeout(800);
    const pl = await f.ev(() => ({ n: document.querySelectorAll('#w258m .w258list li').length, sw: document.documentElement.scrollWidth <= window.innerWidth + 1 }));
    ok('phone: the log fits', pl.n === 7 && pl.sw, pl);
    ok('no page errors (phone)', f.errs.length === 0, f.errs);
    await f.close();
  } finally { await browser.close(); }
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
