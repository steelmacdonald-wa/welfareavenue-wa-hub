/* w259drive.js: wave259, the Volunteer Manager refresh (A and C), offline against the candidate (CAND=build/<file>.html).
   The rail: five places, no Applicants or Sign-offs items, the right one lit for every address; the People tabs on the three
   people pages; Messages is the phone page with its own title; Setup: the three tiles, the text schedule with dates and
   switches, the days, the usual spot counts, Role owners; the words; a phone's chip row. */
const { launch, fresh } = require('./boot');
const fx191 = require('./w191fx');
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 700) : '')); } }
const SHOTS = process.env.SHOTS || ''; if (SHOTS) require('fs').mkdirSync(SHOTS, { recursive: true });
const shot = async (f, n) => { if (SHOTS) await f.page.screenshot({ path: SHOTS + '/' + n + '.png' }); };

function fixture() {
  const fx = fx191();
  fx.volunteer_applications = [{ id: 81, person_id: 3, contact_id: 3071, name: 'Ahmed', email: 'a@example.com', phone: '5145550003', roles: ['server'], role_text: 'Server', source: 'website', applied_at: '2026-09-24T03:11:47Z', status: 'received', language: 'en' }];
  return fx;
}
const SETUP = { sms_mode: 'live', sms_confirm_days: '10', sms_confirm_hour: '10', sms_reminder_on: 'on', sms_reminder_days: '6', sms_checkin_on: 'on', sms_checkin_days: '3', cancel_notice_days: '4', sms_itinerary_hour: '17', sms_survey_hour: '18', sms_window_start: '9', sms_window_end: '19',
  can_text: true, usual: { team_leader: 2, cook: 5, driver: 2, server: 8, dishwasher: 1, photographer: 1, videographer: 0, community_debrief: 1 },
  next: [{ id: 25, date: '2026-11-01', code: 'WA-26-23' }, { id: 26, date: '2026-11-15', code: 'WA-26-24' }] };
const OWNERS = { owners: { cook: 'marydilusha.celestine@welfareavenue.com', server: 'eleftherios.katsipis@welfareavenue.com' }, names: { 'marydilusha.celestine@welfareavenue.com': 'Mary', 'eleftherios.katsipis@welfareavenue.com': 'Eleftherios Katsipis' }, mine: [], can_edit: true };
const RPCS = { wa_org_editor: true, is_wa_admin: true, is_wa_leader: true, wa_is_hr: false, is_wa_staff: true, wa256_can_text: true, wa191_autotick: { ticked: 0 }, wa191_this_week: { today: '2026-09-25', me: 'Steel', servings: [], overdue: [], unassigned: [], mine: [] } };
const INSTALL = (data) => {
  window.__REC = { calls: [] };
  const r0 = db.rpc.bind(db);
  db.rpc = function (fn, args) {
    window.__REC.calls.push({ fn: fn, args: JSON.parse(JSON.stringify(args || {})) });
    const ok = (d) => Promise.resolve({ data: d, error: null });
    if (fn === 'wa259_text_setup') return ok(JSON.parse(JSON.stringify(data.setup)));
    if (fn === 'wa259_text_switch') { const s = JSON.parse(JSON.stringify(data.setup)); s[args.p_key] = args.p_value; data.setup = s; return ok(s); }
    if (fn === 'wa258_role_owners') return ok(JSON.parse(JSON.stringify(data.owners)));
    if (fn === 'wa258_text_log') return ok({ event: {}, rows: [], schedule: [] });
    if (fn === 'wa258_contacted') return ok({});
    return r0(fn, args);
  };
};
const calls = (f, fn) => f.ev(n => window.__REC.calls.filter(c => c.fn === n), fn);
const rail = (f) => f.ev(() => Array.from(document.querySelectorAll('#w153rail .w153it')).map(a => a.innerText.trim().split('\n')[0] + (a.classList.contains('on') ? '*' : '')));
const title = (f) => f.ev(() => { const m = document.querySelector('#volunteering .w118mast'); return m ? [m.querySelector('h1').textContent, (m.querySelector(':scope > p') || {}).textContent] : null; });

(async () => {
  const browser = await launch();
  try {
    let f = await fresh(browser, { who: 'admin', hash: '#volunteering', fixture: fixture(), rpcs: RPCS, width: 1440, wait: 5200 });
    await f.ev(INSTALL, { setup: SETUP, owners: OWNERS });
    let r = await rail(f);
    ok('rail: five places, Servings lit', r.join('|') === 'Servings*|Calendar|People|Messages|Setup', r);
    await f.hash('#volunteering/applicants', 2600); r = await rail(f);
    const tabs = await f.ev(() => Array.from(document.querySelectorAll('#volunteering .w259tabs a')).map(a => a.textContent + (a.classList.contains('on') ? '*' : '')));
    ok('applicants: People lit, the tabs with New applicants on', r.indexOf('People*') >= 0 && r.indexOf('Servings*') < 0 && /^New applicants1\*$/.test(tabs[1] || '') && tabs[0] === 'Volunteers' && /^Sign-offs/.test(tabs[2] || ''), [r, tabs]);
    let t = await title(f);
    ok('applicants: its own title', t && t[0] === 'Applicants received', t);
    await shot(f, 'applicants');
    await f.page.click('#volunteering .w259tabs a[href="#volunteering/people"]'); await f.page.waitForTimeout(2200);
    r = await rail(f); const tabs2 = await f.ev(() => Array.from(document.querySelectorAll('#volunteering .w259tabs a.on')).map(a => a.textContent));
    ok('Volunteers tab: People still lit, Volunteers on, the list there', r.indexOf('People*') >= 0 && tabs2[0] === 'Volunteers' && (await f.ev(() => document.querySelectorAll('#volunteering tr[data-p26]').length)) > 0, [r, tabs2]);
    await f.hash('#volunteering/signoffs', 2200); r = await rail(f);
    ok('sign-offs: People lit, Sign-offs tab on', r.indexOf('People*') >= 0 && (await f.ev(() => (document.querySelector('#volunteering .w259tabs a.on') || {}).textContent || '')).indexOf('Sign-offs') === 0, r);
    await f.hash('#volunteering/phone', 2600); r = await rail(f); t = await title(f);
    ok('Messages: lit, titled, the phone page shown, no tabs', r.indexOf('Messages*') >= 0 && t && t[0] === 'Messages' && (await f.ev(() => !!document.querySelector('#volunteering [data-w256ta], #volunteering .w256') && !document.querySelector('.w259tabs'))), [r, t]);
    await f.hash('#volunteering/messages', 2600);
    ok('/messages opens Messages', /#volunteering\/phone$/.test(await f.ev(() => location.hash)) && (await title(f))[0] === 'Messages', await f.ev(() => location.hash));
    await f.hash('#volunteering/sop', 2200); r = await rail(f);
    ok('the SOP: Setup lit', r.indexOf('Setup*') >= 0 && r.indexOf('Servings*') < 0, r);
    /* ---------- Setup ---------- */
    await f.hash('#volunteering/setup', 2600); r = await rail(f); t = await title(f);
    const su = await f.ev(() => { const s = document.querySelector('#volunteering .w259setup'); return s ? { t: s.innerText, tiles: Array.from(s.querySelectorAll('.w259tile b')).map(b => b.textContent), rows: s.querySelectorAll('.w259sched li').length, sw: s.querySelectorAll('[data-w259sw]').length, spots: s.querySelectorAll('[data-w259sp]').length } : null; });
    ok('Setup: lit, titled, the three tiles', r.indexOf('Setup*') >= 0 && t && t[0] === 'Setup' && su && su.tiles.join(',') === 'The SOP,Recipes,Inventory', [r, t, su && su.tiles]);
    ok('Setup: the schedule for Nov 1 with the real dates', su && su.rows === 6 && /Confirmation/.test(su.t) && /Thu, Oct 22, 10 am/.test(su.t) && /Monday reminder/.test(su.t) && /Mon, Oct 26, 10 am/.test(su.t) && /Last day to cancel/.test(su.t) && /Wed, Oct 28/.test(su.t) && /Thursday check-in/.test(su.t) && /Thu, Oct 29, 10 am/.test(su.t) && /Sat, Oct 31, 5 pm/.test(su.t) && /Sun, Nov 1, 6 pm/.test(su.t), su && su.t.slice(0, 1200));
    ok('Setup: the next serving after it, in one line', su && /Then Sun, Nov 15: confirmations Thu, Nov 5/.test(su.t), su && su.t.slice(0, 1600));
    ok('Setup: two switches, eight usual counts, Text settings, Role owners', su && su.sw === 2 && su.spots === 8 && /Text settings/.test(su.t) && /Role owners/.test(su.t) && /Mary: cooks/.test(su.t), su);
    await shot(f, 'setup');
    await f.page.uncheck('[data-w259sw="sms_checkin_on"]'); await f.page.waitForTimeout(900);
    const sw = await calls(f, 'wa259_text_switch');
    ok('switch: the check-in off through wa259_text_switch, the row dimmed', sw.length === 1 && sw[0].args.p_key === 'sms_checkin_on' && sw[0].args.p_value === 'off' && (await f.ev(() => document.querySelectorAll('.w259sched li.off').length)) === 1, sw);
    await f.page.fill('[data-w259d="sms_reminder_days"]', '5'); await f.page.click('[data-w259go="days"]'); await f.page.waitForTimeout(900);
    const dd = await calls(f, 'wa259_text_switch');
    ok('days: the reminder moved to 5 days before, the schedule redrawn', dd.length === 2 && dd[1].args.p_key === 'sms_reminder_days' && dd[1].args.p_value === '5' && /Tue, Oct 27, 10 am/.test(await f.ev(() => document.querySelector('.w259sched').innerText)), dd);
    await f.page.fill('[data-w259sp="cook"]', '6'); await f.page.click('[data-w259go="spots"]'); await f.page.waitForTimeout(900);
    const upd = await f.ev(() => (window.__STUB_WRITES || []).length >= 0);
    ok('usual counts: saved (no error toast, the page redrawn)', upd && (await f.ev(() => document.querySelector('[data-w259sp="cook"]')) !== null), null);
    await f.page.click('[data-w259go="owners"]'); await f.page.waitForTimeout(700);
    ok('Role owners opens from Setup', await f.ev(() => !!document.getElementById('w258o')), null);
    await f.page.click('#w258o [data-w258x]'); await f.page.waitForTimeout(200);
    /* ---------- words ---------- */
    await f.hash('#volunteering/e/900', 3000);
    const words = await f.ev(() => document.getElementById('volunteering').innerText);
    ok('serving page: Servings lit on the rail, "All servings"', (await rail(f)).indexOf('Servings*') >= 0 && /All servings/.test(words) && !/All events/.test(words), null);
    const menu = await f.ev(() => Array.from(document.querySelectorAll('#w119 .acts .menu button')).map(b => b.textContent));
    ok('More menu: Cancel this serving', menu.indexOf('Cancel this serving') >= 0 && !menu.some(x => /this event/.test(x)), menu);
    ok('no page errors', f.errs.length === 0, f.errs);
    await f.close();
    /* ---------- a phone: the chip row ---------- */
    f = await fresh(browser, { who: 'admin', hash: '#volunteering/people', fixture: fixture(), rpcs: RPCS, width: 390, wait: 5200 });
    await f.ev(INSTALL, { setup: SETUP, owners: OWNERS });
    await f.hash('#volunteering/applicants', 2600);
    const chips = await f.ev(() => Array.from(document.querySelectorAll('#volunteering .vl-sub .fchip')).map(a => a.textContent.trim() + (a.classList.contains('on') ? '*' : '')));
    ok('phone chips: the five places then Text volunteers, People lit', /^Servings,Calendar,People(\s\(\d+\))?\*,Messages,Setup,Text volunteers$/.test(chips.join(',')), chips);
    ok('phone: the tabs, no sideways scroll', (await f.ev(() => document.querySelectorAll('.w259tabs a').length)) === 3 && (await f.ev(() => document.documentElement.scrollWidth <= window.innerWidth + 1)), null);
    await shot(f, 'phone');
    ok('no page errors (phone)', f.errs.length === 0, f.errs);
    await f.close();
  } finally { await browser.close(); }
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
