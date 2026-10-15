/* w257drive.js: wave257, where everyone is placed and placing them, offline against the candidate (CAND=build/<file>.html).
   The rail's Servings and Calendar, the Calendar page (the month alone, bigger, the fill line, a click opens the serving), Servings
   without the month; Volunteers: each row's upcoming servings and where they stand, Assign, On a serving / Not placed yet;
   Applicants received: the card's servings or "Not on a serving yet", Assign to servings; the window (roles, servings with open
   spots, already on, a role per serving, Tell them, the preview's text, Welcomed); a staff member who cannot text; a phone. */
const { launch, fresh } = require('./boot');
const fs = require('fs');
const fx191 = require('./w191fx');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 700) : '')); } }
const shot = async (f, n) => { if (SHOTS) await f.page.screenshot({ path: SHOTS + '/' + n + '.png' }); };

function fixture() {
  const fx = fx191();
  /* Sophia applied on the website for two servings (Nov 15, Nov 29) as a server, not confirmed; Ahmed is confirmed on Oct 2 */
  fx.volunteer_people.push({ id: 705, full_name: 'Sophia Labrosse', roles: ['dishwasher', 'server'], phones: ['5147262676'], emails: ['labrosses30@gmail.com'], tags: ['volunteer applicant'], contact_id: 3071 });
  fx.event_roster.push({ id: 2265, event_id: 26, person_id: 705, person_name: 'Sophia Labrosse', role: 'server', status: 'TBD', detail: { source: 'hub_form' } });
  fx.event_roster.push({ id: 2266, event_id: 27, person_id: 705, person_name: 'Sophia Labrosse', role: 'server', status: 'TBD', detail: { source: 'hub_form' } });
  fx.event_roster.push({ id: 9101, event_id: 900, person_id: 3, person_name: 'Ahmed', role: 'driver', status: 'Confirmed', confirm_status: 'confirmed', detail: {} });
  fx.event_roster.push({ id: 9102, event_id: 24, person_id: 2, person_name: 'Abhigail Pascua-Matte', role: 'cook', status: 'Waiting For Response', detail: { source: 'assigned', confirm_early: true } });
  fx.volunteer_applications = [
    { id: 81, person_id: 705, contact_id: 3071, name: 'Sophia Labrosse', email: 'labrosses30@gmail.com', phone: '5147262676', roles: ['dishwasher', 'server'], role_text: 'Dishwasher, Server', source: 'website', applied_at: '2026-09-24T03:11:47Z', status: 'received', language: 'en' },
    { id: 82, person_id: 114, contact_id: 7114, name: 'Nicolas Yerachuk', email: 'n@example.com', phone: '5145550114', roles: ['server'], role_text: 'Server', source: 'website', applied_at: '2026-09-23T12:00:00Z', status: 'received', language: 'en' }
  ];
  return fx;
}
const SERVINGS = [
  { id: 900, code: 'WA-26-90', date: '2026-10-02', start: '11:30', spots: { server: 8, cook: 4, driver: 2, dishwasher: 1 }, filled: { server: 2, cook: 2, driver: 1, dishwasher: 1 }, confirmed: 3, mine: null },
  { id: 24, code: 'WA-26-22', date: '2026-10-18', title: 'Oberoi Financial partnership', start: '11:30', spots: { server: 8, dishwasher: 1 }, filled: { server: 4, dishwasher: 1 }, confirmed: 8, mine: null },
  { id: 26, code: 'WA-26-24', date: '2026-11-15', start: '12:00', spots: { server: 8, dishwasher: 1 }, filled: { server: 2, dishwasher: 1 }, confirmed: 0, mine: { id: 2265, role: 'server', status: 'TBD', cs: null } },
  { id: 27, code: 'WA-26-25', date: '2026-11-29', start: '12:00', spots: { server: 8, dishwasher: 1 }, filled: { server: 2, dishwasher: 1 }, confirmed: 0, mine: { id: 2266, role: 'server', status: 'TBD', cs: null } }
];
const OPTS = { person: { id: 705, name: 'Sophia Labrosse', roles: ['dishwasher', 'server'], phone: '5147262676', email: 'labrosses30@gmail.com', lang: 'en' }, servings: SERVINGS, can_tell: true, sms_mode: 'live', mail_mode: 'live', window: true };
const RPCS = { wa_org_editor: true, is_wa_admin: true, is_wa_leader: true, wa_is_hr: false, is_wa_staff: true, wa256_can_text: true,
  wa191_autotick: { ticked: 0 }, wa191_this_week: { today: '2026-09-25', me: 'Steel', servings: [], overdue: [], unassigned: [], mine: [] } };
const INSTALL = (data) => {
  window.__REC = { calls: [] };
  const r0 = db.rpc.bind(db);
  db.rpc = function (fn, args) {
    window.__REC.calls.push({ fn: fn, args: JSON.parse(JSON.stringify(args || {})) });
    const ok = (d) => Promise.resolve({ data: d, error: null });
    if (fn === 'wa257_assign_options') return ok(JSON.parse(JSON.stringify(data.opts)));
    if (fn === 'wa257_preview') { const n = (args.p_events || []).length; return ok({ ok: true, added: (args.p_events || []).filter(x => x !== 26 && x !== 27).length, updated: (args.p_events || []).filter(x => x === 26 || x === 27).length, already_confirmed: 0, to_confirm: n, body: n ? 'Hi Sophia, it’s Welfare Avenue! Good news: you’re on the team as a ' + args.p_role + ' on Sunday, November 15. Please confirm you’ll be there: https://hub.welfareavenue.com/c/x (or reply YES or NO). Reply STOP to stop texts.' : null, text: 'sends now', email: 'sends now', phone: '5147262676', email_to: 'labrosses30@gmail.com' }); }
    if (fn === 'wa257_assign') return ok({ ok: true, added: 0, updated: (args.p_events || []).length, already_confirmed: 0, to_confirm: (args.p_events || []).length, text: 'sent', email: 'sent', rows: [2265] });
    if (fn === 'wa209_vol_app_status') return ok({ ok: true });
    return r0(fn, args);
  };
};
const calls = (f, fn) => f.ev(n => window.__REC.calls.filter(c => c.fn === n), fn);

(async () => {
  const browser = await launch();
  try {
    /* ---------- Calendar, its own page ---------- */
    let f = await fresh(browser, { who: 'admin', hash: '#volunteering/calendar', fixture: fixture(), rpcs: RPCS, width: 1440, wait: 5200 });
    const rail = await f.ev(() => Array.from(document.querySelectorAll('#w153rail .w153it')).map(a => a.innerText.trim().split('\n')[0] + (a.classList.contains('on') ? '*' : '')));
    ok('the rail: Servings, then Calendar (current)', rail.indexOf('Servings') >= 0 && rail.indexOf('Calendar*') === rail.indexOf('Servings') + 1, rail);
    const cal = await f.ev(() => { const v = document.getElementById('volunteering'); const vis = s => { const e = v.querySelector(s); return !!e && getComputedStyle(e).display !== 'none'; }; return { mode: v.getAttribute('data-w257'), h1: v.querySelector('.w118mast h1').textContent, cal: vis('#w119cal'), week: vis('#w191week'), grid: vis('.vl-grid'), hero: vis('.vl-hero'), add: vis('#w106add'), h: (v.querySelector('#w119cal .d') || {}).offsetHeight || 0 }; });
    ok('Calendar page: the month alone (no This week, next event or upcoming cards), Add an event kept, bigger days', cal.mode === 'cal' && cal.h1 === 'Calendar' && cal.cal && !cal.week && !cal.grid && !cal.hero && cal.add && cal.h >= 100, cal);
    await shot(f, 'calendar');
    await f.page.click('#w119cal .ev[data-vlev="900"]'); await f.page.waitForTimeout(1500);
    const opened = await f.ev(() => location.hash);
    ok('a serving on the calendar opens its page', opened === '#volunteering/e/900', opened);
    await f.hash('#volunteering', 1800);
    const home = await f.ev(() => { const v = document.getElementById('volunteering'); const vis = s => { const e = v.querySelector(s); return !!e && getComputedStyle(e).display !== 'none'; }; return { mode: v.getAttribute('data-w257'), h1: v.querySelector('.w118mast h1').textContent, cal: vis('#w119cal'), grid: vis('.vl-grid') }; });
    ok('Servings: the upcoming servings without the month', home.mode === 'home' && home.h1 === 'Servings' && !home.cal && home.grid, home);
    /* ---------- Volunteers ---------- */
    await f.ev(INSTALL, { opts: OPTS });
    await f.hash('#volunteering/people', 2500);
    const ppl = await f.ev(() => Array.from(document.querySelectorAll('#volunteering tr[data-p26]')).map(tr => ({ id: tr.getAttribute('data-p26'), up: (tr.querySelector('.w257up') || {}).innerText || '', as: !!tr.querySelector('[data-w257assign]') })));
    const so = ppl.filter(p => p.id === '705')[0] || {}, ah = ppl.filter(p => p.id === '3')[0] || {}, ab = ppl.filter(p => p.id === '1')[0] || {}, ap = ppl.filter(p => p.id === '2')[0] || {};
    ok('Volunteers: Sophia’s two servings, server, signed up and not confirmed', /Nov 15/.test(so.up) && /Nov 29/.test(so.up) && /Server/.test(so.up) && /Signed up, not confirmed/.test(so.up) && so.as, so);
    ok('Volunteers: Ahmed confirmed as a driver; Abhigail placed, waiting; Abhigail (the other record) not on a serving', /Driver/.test(ah.up) && /Confirmed/.test(ah.up) && /Placed, waiting to confirm/.test(ap.up) && /Not on a serving yet/.test(ab.up), [ah, ap, ab]);
    const bar = await f.ev(() => (document.querySelector('.w257bar') || {}).innerText || '');
    ok('Placed filter: On a serving (3), Not placed yet', /On a serving \(3\)/.test(bar) && /Not placed yet \(\d+\)/.test(bar), bar);
    await f.page.click('[data-w257f="off"]'); await f.page.waitForTimeout(300);
    const offRows = await f.ev(() => Array.from(document.querySelectorAll('#volunteering tr[data-p26]')).filter(tr => getComputedStyle(tr).display !== 'none').map(tr => tr.getAttribute('data-p26')));
    ok('Not placed yet hides the placed', offRows.indexOf('705') < 0 && offRows.indexOf('3') < 0 && offRows.indexOf('1') >= 0, offRows);
    await f.page.click('[data-w257f=""]'); await f.page.waitForTimeout(300);
    await shot(f, 'volunteers');
    const href = await f.ev(() => { const a = document.querySelector('tr[data-p26="705"] .w257pl'); return a ? a.getAttribute('href') : ''; });
    ok('a serving on the row opens it', href === '#volunteering/e/26', href);
    /* ---------- the window ---------- */
    await f.page.click('tr[data-p26="705"] [data-w257assign]'); await f.page.waitForTimeout(900);
    let m = await f.ev(() => { const x = document.getElementById('w257m'); return x ? { h: x.querySelector('h3').textContent, roles: Array.from(x.querySelectorAll('[data-w257role]')).map(b => b.innerText.replace(/\s+/g, ' ') + (b.classList.contains('on') ? '*' : '')), sv: Array.from(x.querySelectorAll('.w257sv')).map(l => (l.querySelector('input').checked ? '[x] ' : '[ ] ') + l.innerText.replace(/\n/g, ' | ')), tell: x.querySelector('.w257tell').innerText, pv: (x.querySelector('.w257pv') || {}).innerText || '', go: x.querySelector('[data-w257do]').textContent } : null; });
    ok('the window: her roles marked applied, the role she is already on (server) chosen', m && m.h === 'Place Sophia Labrosse on servings' && m.roles.some(r => /Server applied\*/.test(r)) && m.roles.some(r => /Dishwasher applied/.test(r)), m && m.roles);
    ok('the servings: the ones she is on are ticked, with where she stands, and the open spots for the role', m && m.sv.length === 4 && /^\[ \]/.test(m.sv[0]) && /^\[x\]/.test(m.sv[2]) && /Already on: Server, signed up, not confirmed/.test(m.sv[2]) && /7 of 8 server spots open/.test(m.sv[2]) && /^\[x\]/.test(m.sv[3]), m && m.sv);
    ok('Tell them: text and email ticked with the number and address; the preview shows the text', m && /\(514\) 726-2676/.test(m.tell) && /labrosses30@gmail.com/.test(m.tell) && /Good news/.test(m.pv) && /2 servings to confirm/.test(m.pv) && /confirm right away/.test(m.pv) && m.go === 'Place on 2 servings and tell them', m);
    await f.page.click('#w257m [data-w257role="server"]'); await f.page.waitForTimeout(700);
    m = await f.ev(() => ({ sv: Array.from(document.querySelectorAll('#w257m .w257sv')).map(l => l.innerText.replace(/\n/g, ' | ')) }));
    ok('Server: the open server spots on each serving', /7 of 8 server spots open/.test(m.sv[2]) && /6 of 8 server spots open/.test(m.sv[0]), m.sv);
    await f.page.check('#w257m [data-w257pick="24"]'); await f.page.waitForTimeout(200);
    await f.page.selectOption('#w257m [data-w257rrole="24"]', 'dishwasher'); await f.page.waitForTimeout(700);
    const pv = await calls(f, 'wa257_preview');
    const lastPv = pv[pv.length - 1] || { args: {} };
    ok('a role per serving goes to the preview (Oct 18 as dishwasher)', JSON.stringify(lastPv.args.p_events.slice().sort()) === JSON.stringify([24, 26, 27]) && lastPv.args.p_role === 'server' && lastPv.args.p_roles && lastPv.args.p_roles['24'] === 'dishwasher', lastPv.args);
    await shot(f, 'assign');
    await f.page.click('#w257m [data-w257do]'); await f.page.waitForTimeout(1200);
    const as = await calls(f, 'wa257_assign');
    ok('Place sends the person, the servings, the role, text and email, no application from Volunteers', as.length === 1 && as[0].args.p_person === 705 && as[0].args.p_text === true && as[0].args.p_email === true && as[0].args.p_app === null && as[0].args.p_events.length === 3, as);
    ok('the window closes after placing', await f.ev(() => !document.getElementById('w257m') || getComputedStyle(document.getElementById('modalBack')).display === 'none'));
    let errs = f.errs.slice(); ok('no page errors (calendar, volunteers)', !errs.length, errs);
    await f.close();

    /* ---------- Applicants received ---------- */
    f = await fresh(browser, { who: 'admin', hash: '#volunteering/applicants', fixture: fixture(), rpcs: RPCS, width: 1440, wait: 5500 });
    await f.ev(INSTALL, { opts: OPTS });
    await f.page.waitForTimeout(800);
    const cards = await f.ev(() => Array.from(document.querySelectorAll('li.w209app')).map(li => ({ id: li.getAttribute('data-w209id'), up: (li.querySelector('.w257up') || {}).innerText || '', btn: !!li.querySelector('[data-w257assign]') })));
    const c81 = cards.filter(c => c.id === '81')[0] || {}, c82 = cards.filter(c => c.id === '82')[0] || {};
    ok('Applicants: Sophia’s card shows her two servings and Assign to servings', /Nov 15/.test(c81.up) && /Signed up, not confirmed/.test(c81.up) && c81.btn, c81);
    ok('Applicants: a card with no serving says so', /Not on a serving yet/.test(c82.up) && c82.btn, c82);
    await shot(f, 'applicants');
    await f.page.click('li.w209app[data-w209id="81"] [data-w257assign]'); await f.page.waitForTimeout(1000);
    const wel = await f.ev(() => { const c = document.querySelector('#w257m [data-w257t="welcome"]'); return c ? c.checked : null; });
    ok('from an application: Mark the application Welcomed, ticked', wel === true, wel);
    await f.page.click('#w257m [data-w257do]'); await f.page.waitForTimeout(1200);
    const as2 = await calls(f, 'wa257_assign');
    ok('Place from the application passes it (to Welcomed)', as2.length === 1 && as2[0].args.p_app === 81 && JSON.stringify(as2[0].args.p_events.slice().sort()) === JSON.stringify([26, 27]), as2);
    errs = f.errs.slice(); ok('no page errors (applicants)', !errs.length, errs);
    await f.close();

    /* ---------- a staff member who cannot text ---------- */
    f = await fresh(browser, { who: 'admin', hash: '#volunteering/people', fixture: fixture(), rpcs: Object.assign({}, RPCS, { is_wa_admin: false, is_wa_leader: false }), width: 1366, wait: 5200 });
    await f.ev(INSTALL, { opts: Object.assign({}, OPTS, { can_tell: false }) });
    await f.page.waitForTimeout(500);
    await f.page.click('tr[data-p26="705"] [data-w257assign]'); await f.page.waitForTimeout(900);
    const ct = await f.ev(() => { const x = document.getElementById('w257m'); return { text: x.querySelector('[data-w257t="text"]').disabled, email: x.querySelector('[data-w257t="email"]').disabled, note: x.querySelector('.w257tell').innerText, go: x.querySelector('[data-w257do]').textContent }; });
    ok('cannot text: Tell them greyed out, placed without a message', ct.text && ct.email && /Only leaders, HR and admins/.test(ct.note) && ct.go === 'Place on 2 servings', ct);
    await f.close();

    /* ---------- a phone ---------- */
    f = await fresh(browser, { who: 'admin', hash: '#volunteering/applicants', fixture: fixture(), rpcs: RPCS, width: 390, wait: 5500 });
    await f.ev(INSTALL, { opts: OPTS });
    await f.page.waitForTimeout(800);
    await f.page.click('li.w209app[data-w209id="81"] [data-w257assign]'); await f.page.waitForTimeout(1000);
    const ph = await f.ev(() => ({ sx: document.documentElement.scrollWidth <= window.innerWidth + 1, box: (document.getElementById('modalBox') || {}).scrollWidth <= ((document.getElementById('modalBox') || {}).clientWidth || 0) + 1 }));
    ok('phone: the card and the window fit, no sideways scroll', ph.sx && ph.box, ph);
    await shot(f, 'phone-assign');
    await f.close();
  } catch (e) { fail++; console.log('FAIL exception ' + (e && e.stack || e)); }
  await browser.close();
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
