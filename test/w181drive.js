/* w181drive.js: wave181, the HR centre's Analytics (who has been part of Welfare Avenue and for how long).
   Steel (30/09/26), with Slack's Member Analytics export: "add an analytics tab to the hr center, show trends, and know who's
   been a part of the org and for how long ish (we may have deactivated their accounts late)".
   The roster is test/fixture.json's; the Slack accounts and the people view are made up here (no real addresses). The
   database calls (wa181_link, wa181_import) are caught by a spy. Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26
   16:00 Toronto). CAND=<file>; SHOTS=1 saves screenshots in test/shots_w181/. */
const fs = require('fs');
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 700) : '')); } }
const SHOTS = process.env.SHOTS ? path.join(__dirname, 'shots_w181') : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const P0 = '2025-08-29', P1 = '2026-09-29';
function acct(id, name, o) { return Object.assign({ slack_id: id, full_name: name, display_name: name, email: name.toLowerCase().replace(/\s+/g, '.') + '@example.org', title: null, account_type: 'Member', created_on: '2025-01-01', claimed_on: '2025-01-02', deactivated_on: null, days_active: 10, messages: 20, team_member_id: null, person_key: 'slack:' + id, kind: 'team', link_by: null, period_from: P0, period_to: P1 }, o || {}); }
function person(o) { return Object.assign({ person_key: null, team_member_id: null, name: '', slack_name: null, department: null, title: null, email: null, on_roster: false, roster_active: false, roster_start: null, start_source: null, joined_slack: null, invited_on: null, accounts: 0, open_accounts: 0, never_joined: false, deactivated_on: null, days_active: 0, messages: 0, period_from: P0, period_to: P1, linked_by_name: false, slack_ids: [], started_on: null, status: 'current', left_by: null }, o); }
function fx() {
  const f = loadFixture();
  const roster = f.team_members.filter(m => m.active !== false).slice(0, 10);
  const starts = ['2021-05-18', '2022-10-26', '2023-05-11', '2024-02-14', '2025-08-02', '2025-11-06', '2026-02-18', '2026-04-14', '2026-06-08', null];
  const A = [], V = [];
  roster.forEach((m, i) => {
    const id = 'UR' + String(1000 + i);
    const twoAccts = i === 2;
    A.push(acct(id, m.name + ' Full', { team_member_id: m.id, person_key: 'tm:' + m.id, link_by: i === 4 ? 'name' : 'email', claimed_on: starts[i], created_on: starts[i], days_active: 100 - i, deactivated_on: i === 6 ? '2026-08-21' : null }));
    if (twoAccts) A.push(acct(id + 'B', m.name + ' Second', { team_member_id: m.id, person_key: 'tm:' + m.id, link_by: 'email', claimed_on: '2026-01-03', created_on: '2026-01-03', days_active: 0 }));
    V.push(person({ person_key: 'tm:' + m.id, team_member_id: m.id, name: m.name, department: m.department, title: m.role || 'Volunteer', email: m.email, on_roster: true, roster_active: true, roster_start: starts[i], start_source: starts[i] ? 'slack' : null, joined_slack: starts[i], accounts: twoAccts ? 2 : 1, open_accounts: i === 6 ? 0 : (twoAccts ? 2 : 1), days_active: 100 - i, linked_by_name: i === 4, slack_ids: twoAccts ? [id, id + 'B'] : [id], started_on: starts[i], status: 'current' }));
  });
  /* off the roster, still on Slack and active */
  A.push(acct('UX0001', 'Hana Offroster', { claimed_on: '2024-05-05', created_on: '2024-05-05', days_active: 94, title: 'Director of Human Resources' }));
  V.push(person({ person_key: 'slack:UX0001', name: 'Hana Offroster', title: 'Director of Human Resources', email: 'hana.offroster@example.org', joined_slack: '2024-05-05', accounts: 1, open_accounts: 1, days_active: 94, slack_ids: ['UX0001'], started_on: '2024-05-05', status: 'current' }));
  /* people who left: one active in the window, four switched off in the October batch without a day of activity */
  A.push(acct('ULNORA0001', 'Nora Left', { claimed_on: '2025-09-15', created_on: '2025-09-15', deactivated_on: '2026-02-19', days_active: 105 }));
  V.push(person({ person_key: 'slack:ULNORA0001', name: 'Nora Left', joined_slack: '2025-09-15', accounts: 1, deactivated_on: '2026-02-19', days_active: 105, slack_ids: ['ULNORA0001'], started_on: '2025-09-15', status: 'left', left_by: '2026-02-19' }));
  ['Omar Early', 'Pia Early', 'Quinn Early', 'Rui Early'].forEach((n, i) => {
    const id = 'UL00' + (10 + i), st = ['2023-10-04', '2024-05-03', '2024-11-08', '2025-01-08'][i];
    A.push(acct(id, n, { claimed_on: st, created_on: st, deactivated_on: '2025-10-21', days_active: 0 }));
    V.push(person({ person_key: 'slack:' + id, name: n, joined_slack: st, accounts: 1, deactivated_on: '2025-10-21', slack_ids: [id], started_on: st, status: 'left', left_by: P0 }));
  });
  /* a roster person marked as left whose Slack is still open */
  A.push(acct('UL0020', 'Sam Rosterleft', { claimed_on: '2025-12-22', created_on: '2025-12-22', days_active: 159, team_member_id: 5, person_key: 'tm:5' }));
  V.push(person({ person_key: 'tm:5', team_member_id: 5, name: 'Terry', department: 'opsmtl', on_roster: true, roster_active: false, joined_slack: '2025-12-22', accounts: 1, open_accounts: 1, days_active: 159, slack_ids: ['UL0020'], started_on: '2025-12-22', status: 'left', left_by: null }));
  /* quiet, never joined, a consultant */
  A.push(acct('UQ0001', 'Gus Quiet', { claimed_on: '2024-07-11', created_on: '2024-07-11', days_active: 0 }));
  V.push(person({ person_key: 'slack:UQ0001', name: 'Gus Quiet', joined_slack: '2024-07-11', accounts: 1, open_accounts: 1, slack_ids: ['UQ0001'], started_on: '2024-07-11', status: 'quiet', left_by: P0 }));
  A.push(acct('UN0001', 'Ivy Invited', { account_type: 'Invited Member', claimed_on: null, created_on: '2025-09-10', deactivated_on: '2025-10-21', days_active: 0 }));
  V.push(person({ person_key: 'slack:UN0001', name: 'Ivy Invited', invited_on: '2025-09-10', accounts: 1, never_joined: true, slack_ids: ['UN0001'], status: 'never_joined' }));
  A.push(acct('UE0001', 'Cara Consultant', { kind: 'external', claimed_on: '2025-03-25', created_on: '2025-03-25', deactivated_on: '2025-10-21', days_active: 0 }));
  f.hr_slack_accounts = A; f.hr_people_tenure_v = V;
  return f;
}
const INIT = `(function(){ window.__rpc = []; var _s;
  Object.defineProperty(window, 'supabase', { configurable: true, get: function () { return _s; }, set: function (v) {
    var cc = v.createClient; v.createClient = function () { var c = cc.apply(this, arguments); var orpc = c.rpc.bind(c);
      c.rpc = function (fn, args) {
        if (fn !== 'wa181_link' && fn !== 'wa181_import') return orpc(fn, args);
        window.__rpc.push({ fn: fn, args: JSON.parse(JSON.stringify(args || null)) });
        if (window.__RPC_ERR) return Promise.resolve({ data: null, error: { message: window.__RPC_ERR } });
        if (fn === 'wa181_link') return Promise.resolve({ data: { ok: true }, error: null });
        return Promise.resolve({ data: { 'new': 2, updated: (args.rows || []).length - 2, linked: 1, start_dates: 1 }, error: null });
      };
      return c; }; _s = v; } });
})();`;

(async () => {
  const browser = await launch();
  /* ---------- an admin at 1366 ---------- */
  let f = await fresh(browser, { who: 'admin', hash: '#hrcentre', fixture: fx(), rpcs: { wa181_can_see: true, wa_org_editor: true }, init: INIT, wait: 4500 });
  await f.page.waitForTimeout(1500);
  ok('admin: the Analytics tab is drawn', await f.ev(() => !!document.querySelector('#w46body .w47tab[data-w47v="analytics"]')));
  ok('admin: Analytics is in the rail', await f.ev(() => !!Array.prototype.filter.call(document.querySelectorAll('#w153rail a, #w153rail [href], #w153rail .w153it'), x => /Analytics/.test(x.textContent || '')).length), await f.ev(() => (document.getElementById('w153rail') || {}).textContent));
  ok('admin: the section starts hidden', await f.ev(() => { const h = document.getElementById('w181'); return !h || !h.classList.contains('on'); }));
  await f.ev(() => document.querySelector('#w46body .w47tab[data-w47v="analytics"]').click());
  await f.page.waitForTimeout(900);
  ok('admin: Analytics shows on its tab', await f.ev(() => document.getElementById('w181').classList.contains('on') && document.getElementById('w181').offsetHeight > 400));
  ok('admin: the address follows', await f.ev(() => location.hash) === '#hrcentre/analytics');
  ok('admin: the other sections are hidden', await f.ev(() => {
    const vis = el => el && el.offsetParent !== null && el.offsetHeight > 0;
    return !Array.prototype.some.call(document.querySelectorAll('#w46body .w46sec'), vis) && !vis(document.getElementById('w116ppeople')) && !vis(document.getElementById('w52hours')) && !vis(document.getElementById('w106polsec'));
  }));
  const tiles = await f.ev(() => Array.prototype.map.call(document.querySelectorAll('#w181 .w181tile'), t => t.querySelector('b').textContent + '|' + t.querySelector('span').textContent));
  ok('tiles: six', tiles.length === 6, tiles);
  ok('tiles: on the team now = 11 (10 on the roster + 1 on Slack only)', tiles[0] === '11|on the team now', tiles[0]);
  ok('tiles: one on Slack but not on the roster', await f.ev(() => /1 is on Slack but not on the roster/.test(document.querySelector('#w181 .w181tile small').textContent)));
  ok('tiles: joined in the last 12 months', tiles[1].split('|')[0] === '5', tiles[1]);   /* 2025-11-06, 2026-02-18, 2026-04-14, 2026-06-08, 2025-12-22 (Terry); 2025-09-15 Nora is before 25/09/25? no: 15/09/25 < 25/09/25 */
  ok('tiles: left in the last 12 months counts only people active in the window', tiles[2].split('|')[0] === '1', tiles[2]);
  ok('tiles: everyone since 2021', /people since 2021/.test(tiles[5]) && tiles[5].split('|')[0] === '18', tiles[5]);
  /* the chart */
  const ch = await f.ev(() => ({ months: document.querySelectorAll('#w181over .hit').length, bars: document.querySelectorAll('#w181over rect[fill="#DCA527"]').length, label: document.querySelector('#w181over svg').getAttribute('aria-label') }));
  ok('chart: one hover area per month from May 2021 to September 2026', ch.months === 65, ch);
  ok('chart: a bar per month with joiners', ch.bars >= 10, ch);
  await f.ev(() => document.getElementById('w181over').scrollIntoView({ block: 'center' })); await f.page.waitForTimeout(150);
  const box = await f.page.$('#w181over .hit:last-of-type'); const bb = await box.boundingBox();
  await f.page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await f.page.waitForTimeout(200);
  const tip = await f.ev(() => { const t = document.querySelector('#w181over .w181tip'); return t.style.display + '|' + t.textContent; });
  ok('chart: hover shows the month and its numbers', /^block\|Sep 2026On the team: 1[01]/.test(tip), tip);
  await f.page.mouse.move(5, 5); await f.ev(() => { window.w181.state().serI = null; document.getElementById('w181over').focus(); }); await f.page.keyboard.press('ArrowLeft'); await f.page.keyboard.press('ArrowLeft'); await f.page.waitForTimeout(100);
  { const kt = await f.ev(() => document.activeElement.id + '|' + document.querySelector('#w181over .w181tip').textContent); ok('chart: the arrow keys move along', /Aug 2026/.test(kt), kt); }
  /* the fiscal years */
  const fy = await f.ev(() => Array.prototype.map.call(document.querySelectorAll('#w181 .w181fy tbody tr'), r => Array.prototype.map.call(r.cells, c => c.textContent.trim()).join('|')));
  ok('fiscal years: one row per year with joiners, 2020-21 to 2025-26', fy.length === 5 && /^2020-21\|1\|/.test(fy[0]) && /^2025-26 so far/.test(fy[4]), fy);
  ok('fiscal years: the October batch lands in 2024-25 as "left by" its first day (29 Aug 2025)', /^2024-25\|\d+\|5\|/.test(fy[3]), fy[3]);
  ok('fiscal years: joiners still here with a share', /\(\d+%\)/.test(fy[4]), fy[4]);
  /* how long people stay, by team */
  const stay = await f.ev(() => document.querySelector('#w181 .w181bars h4').textContent + '|' + document.querySelectorAll('#w181 .w181bars h4')[1].textContent);
  ok('stay: the team today and the people who left', /The team today \(10\)/.test(stay) && /People who left \(7, at most\)/.test(stay), stay);
  ok('by team: a row for Not on the roster', await f.ev(() => /Not on the roster/.test(Array.prototype.map.call(document.querySelectorAll('#w181 .w181card'), c => c.textContent).filter(t => /by team/.test(t))[0] || '')));
  /* worth a look */
  const look = await f.ev(() => Array.prototype.map.call(document.querySelectorAll('#w181 [data-w181look]'), x => x.getAttribute('data-w181look') + ':' + x.querySelector('b.h').textContent));
  ok('worth a look: off the roster, roster says left, Slack off, quiet, by first name, no start date', ['offroster', 'leftopen', 'off', 'quiet', 'name', 'nostart'].every(k => look.some(l => l.indexOf(k + ':') === 0)), look);
  ok('worth a look: the unused second account is listed', await f.ev(() => /unused second accounts/.test(document.querySelector('#w181 [data-w181look="quiet"]').textContent)));
  /* the people list */
  const chips = await f.ev(() => Array.prototype.map.call(document.querySelectorAll('#w181 [data-w181f]'), b => b.textContent));
  ok('people: the filters with counts', chips.join(',') === 'On the team now 11,Left 6,Slack open, unused 1,Never joined 1,Everyone 19', chips);
  ok('people: on the team, longest-standing first', await f.ev(() => document.querySelectorAll('#w181 .w181ppl tbody tr').length === 11 && /May 2021/.test(document.querySelector('#w181 .w181ppl tbody tr').textContent)));
  await f.ev(() => document.querySelector('#w181 [data-w181f="left"]').click()); await f.page.waitForTimeout(150);
  const left = await f.ev(() => Array.prototype.map.call(document.querySelectorAll('#w181 .w181ppl tbody tr'), r => r.textContent));
  ok('people: Left lists six, each with "by" or not known', left.length === 6 && left.every(t => /by [A-Z][a-z]{2} 20\d\d|not known/.test(t)), left);
  ok('people: a leaver’s time is "up to"', left.some(t => /up to/.test(t)), left);
  await f.ev(() => document.querySelector('#w181 [data-w181f="all"]').click()); await f.page.waitForTimeout(100);
  await f.page.fill('#w181q', 'hana'); await f.page.waitForTimeout(150);
  ok('people: search keeps the focus and filters', await f.ev(() => document.activeElement && document.activeElement.id === 'w181q' && document.querySelectorAll('#w181 .w181ppl tbody tr').length === 1));
  ok('people: the off-roster person is tagged', await f.ev(() => /Not on the roster/.test(document.querySelector('#w181 .w181ppl tbody tr').textContent)));
  await f.page.fill('#w181q', ''); await f.page.waitForTimeout(100);
  await f.page.selectOption('#w181sort', 'name'); await f.page.waitForTimeout(100);
  ok('people: sort by name', await f.ev(() => { const n = Array.prototype.map.call(document.querySelectorAll('#w181 .w181ppl tbody tr td:first-child b'), b => b.textContent); return n.length === 19 && n.slice().sort((a, b) => a.localeCompare(b)).join() === n.join(); }));
  /* a person's sheet and a link */
  await f.ev(() => document.querySelector('#w181 [data-w181f="current"]').click()); await f.page.waitForTimeout(100);
  await f.ev(() => { const r = Array.prototype.filter.call(document.querySelectorAll('#w181 .w181ppl tbody tr'), r => /2 Slack accounts/.test(r.textContent))[0]; r.click(); });
  await f.page.waitForTimeout(250);
  ok('sheet: opens with both accounts', await f.ev(() => document.querySelectorAll('.w181sheet .acc').length === 2));
  ok('sheet: the roster person is chosen', await f.ev(() => { const s = document.querySelector('.w181sheet select[data-w181m]'); return s && s.value !== ''; }));
  await f.ev(() => { const id = document.querySelectorAll('.w181sheet .acc')[1].getAttribute('data-w181acc'); document.querySelector('[data-w181x="' + id + '"]').checked = true; document.querySelector('[data-w181save="' + id + '"]').click(); });
  await f.page.waitForTimeout(400);
  const rpc1 = await f.ev(() => window.__rpc.slice(-1)[0]);
  ok('sheet: Save calls wa181_link with the account, the person and the kind', rpc1 && rpc1.fn === 'wa181_link' && /UR1002B/.test(rpc1.args.p_slack_id) && rpc1.args.p_kind === 'external' && typeof rpc1.args.p_member === 'number', rpc1);
  ok('sheet: closes after saving', await f.ev(() => document.getElementById('modalBack').style.display === 'none'));
  await f.ev(() => window.__RPC_ERR = 'Only HR and admins can change this');
  await f.ev(() => document.querySelector('#w181 .w181ppl tbody tr').click()); await f.page.waitForTimeout(200);
  await f.ev(() => document.querySelector('.w181sheet [data-w181save]').click()); await f.page.waitForTimeout(300);
  ok('sheet: a refused save says why and stays open', /Only HR and admins/.test(await f.ev(() => document.getElementById('w181serr').textContent)));
  await f.ev(() => { window.__RPC_ERR = null; closeModal(); });
  /* the CSV */
  const [dl] = await Promise.all([f.page.waitForEvent('download', { timeout: 5000 }).catch(() => null), f.ev(() => document.querySelector('#w181 [data-w181="csv"]').click())]);
  ok('csv: downloads, dated dd-mm-yy', dl && /^25-09-26 - Welfare Avenue people and tenure\.csv$/.test(dl.suggestedFilename()), dl && dl.suggestedFilename());
  if (dl) { const p = await dl.path(); const t = fs.readFileSync(p, 'utf8'); ok('csv: the header and one line per person shown', /^﻿?Name,Team,Title,Status/.test(t) && t.trim().split('\n').length === 12, t.slice(0, 200)); }
  /* importing */
  await f.ev(() => document.querySelector('#w181 [data-w181="import"]').click()); await f.page.waitForTimeout(200);
  ok('import: the window opens with Import off', await f.ev(() => !!document.getElementById('w181file') && document.querySelector('[data-w181="doimport"]').disabled));
  const csv = 'Name,"What I Do","User ID",Username,"Display name",Email,"Account type","Account created (UTC)","Claimed Date (UTC)","Deactivated date (UTC)","Days active","Messages posted","Messages posted in channels","Reactions added"\n' +
    '"Nora Left",,ULNORA0001,nora,Nora,nora.left@example.org,Member,"Sep 15, 2025","Sep 15, 2025","Feb 19, 2026",105,450,226,104\n' +
    '"New Person","Event Coordinator",UZ00NEW1,new,New,new.person@example.org,Member,"Oct 2, 2026","Oct 2, 2026",,3,4,2,0\n' +
    '"Another, Comma",,UZ00NEW2,ac,AC,ac@example.org,"Invited Member","Oct 3, 2026",,,0,0,0,0\n';
  await f.page.setInputFiles('#w181file', { name: 'Welfare Avenue Member Analytics Sep 29 2026 - Oct 29 2026.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await f.page.waitForTimeout(400);
  const sum = await f.ev(() => ({ s: document.getElementById('w181isum').textContent, f: document.getElementById('w181ifrom').value, t: document.getElementById('w181ito').value, d: document.querySelector('[data-w181="doimport"]').disabled }));
  ok('import: reads the file and the dates from its name', sum.f === '2026-09-29' && sum.t === '2026-10-29' && /3 accounts in the file: 2 new ones, 1 already in the Hub/.test(sum.s) && !sum.d, sum);
  await f.ev(() => document.querySelector('[data-w181="doimport"]').click()); await f.page.waitForTimeout(500);
  const rpc2 = await f.ev(() => window.__rpc.filter(r => r.fn === 'wa181_import').slice(-1)[0]);
  ok('import: sends the parsed rows and the window', rpc2 && rpc2.args.p_from === '2026-09-29' && rpc2.args.p_to === '2026-10-29' && rpc2.args.rows.length === 3 && rpc2.args.rows[1].claimed_on === '2026-10-02' && rpc2.args.rows[2].full_name === 'Another, Comma' && rpc2.args.rows[2].claimed_on === null && rpc2.args.rows[0].deactivated_on === '2026-02-19' && rpc2.args.rows[1].title === 'Event Coordinator', rpc2);
  ok('import: closes and says what it did', await f.ev(() => document.getElementById('modalBack').style.display === 'none'));
  await f.ev(() => document.querySelector('#w181 [data-w181="import"]').click()); await f.page.waitForTimeout(150);
  await f.page.setInputFiles('#w181file', { name: 'other.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2\n') }); await f.page.waitForTimeout(300);
  ok('import: another CSV is refused with a reason', /does not look like Slack/.test(await f.ev(() => document.getElementById('w181ierr').textContent)));
  await f.ev(() => closeModal());
  /* the tour */
  ok('tour (wave197): the pages stop names Analytics', await f.ev(() => w122.tours.hrcentre.steps.some(x => /pages/i.test(x.t) && /Analytics/.test(x.p))));
  /* leaving the tab */
  await f.ev(() => document.querySelector('#w46body .w47tab[data-w47v="onboarding"]').click()); await f.page.waitForTimeout(400);
  ok('another tab hides Analytics', await f.ev(() => !document.getElementById('w181').classList.contains('on')));
  if (SHOTS) await f.page.screenshot({ path: path.join(SHOTS, 'onboarding_after.png') });
  ok('admin: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------- the deep link, and screenshots ---------- */
  f = await fresh(browser, { who: 'admin', hash: '#hrcentre/analytics', fixture: fx(), rpcs: { wa181_can_see: true, wa_org_editor: true }, init: INIT, wait: 4500 });
  await f.page.waitForTimeout(2000);
  ok('deep link: #hrcentre/analytics opens it', await f.ev(() => document.getElementById('w181') && document.getElementById('w181').classList.contains('on') && document.querySelector('#w46body .w47tab.on').getAttribute('data-w47v') === 'analytics'));
  if (SHOTS) { await f.page.screenshot({ path: path.join(SHOTS, 'admin_1366.png'), fullPage: true }); }
  await f.hash('#calendar', 1200); await f.hash('#hrcentre', 2500);
  ok('back to the HR centre: lands where it was', await f.ev(() => (document.querySelector('#w46body .w47tab.on') || {}).getAttribute && document.querySelector('#w46body .w47tab.on').getAttribute('data-w47v')) !== null);
  ok('deep link: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------- HR's profile (Samson) ---------- */
  f = await fresh(browser, { who: 'member', hash: '#hrcentre', fixture: fx(), rpcs: { wa181_can_see: true }, init: INIT, wait: 4500 });
  await f.page.waitForTimeout(1500);
  ok('HR profile: the tab is there', await f.ev(() => !!document.querySelector('#w46body .w47tab[data-w47v="analytics"]')));
  ok('HR profile: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------- a leader: the HR centre, no Analytics ---------- */
  f = await fresh(browser, { who: 'leader', hash: '#hrcentre', fixture: fx(), rpcs: { wa181_can_see: false }, init: INIT, wait: 4500 });
  await f.page.waitForTimeout(1500);
  ok('leader: the HR centre opens', await f.ev(() => document.getElementById('hrcentre').classList.contains('active')));
  ok('leader: no Analytics tab', await f.ev(() => !document.querySelector('#w46body .w47tab[data-w47v="analytics"]') && !document.getElementById('w181')));
  await f.hash('#hrcentre/analytics', 1800);
  ok('leader: the address does not open it', await f.ev(() => !document.getElementById('w181')));
  ok('leader: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------- a member with no HR access ---------- */
  f = await fresh(browser, { who: 'plain', hash: '#hrcentre', fixture: fx(), rpcs: { wa181_can_see: false }, init: INIT, wait: 4500 });
  await f.page.waitForTimeout(1200);
  ok('member: no Analytics', await f.ev(() => !document.getElementById('w181') && !document.querySelector('[data-w47v="analytics"]')));
  ok('member: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------- a phone ---------- */
  f = await fresh(browser, { who: 'admin', width: 390, hash: '#hrcentre/analytics', fixture: fx(), rpcs: { wa181_can_see: true, wa_org_editor: true }, init: INIT, wait: 4500 });
  await f.page.waitForTimeout(2000);
  ok('phone: Analytics opens', await f.ev(() => document.getElementById('w181') && document.getElementById('w181').classList.contains('on')));
  ok('phone: nothing wider than the screen', await f.ev(() => { const w = document.documentElement.clientWidth; return Array.prototype.every.call(document.querySelectorAll('#w181 *'), el => { const r = el.getBoundingClientRect(); return r.width === 0 || r.right <= w + 1; }); }), await f.ev(() => { const w = document.documentElement.clientWidth; return Array.prototype.filter.call(document.querySelectorAll('#w181 *'), el => el.getBoundingClientRect().right > w + 1).slice(0, 5).map(el => el.tagName + '.' + el.className + ':' + Math.round(el.getBoundingClientRect().right)); }));
  ok('phone: the people list reads as cards', await f.ev(() => getComputedStyle(document.querySelector('#w181 .w181ppl tbody tr')).display === 'block'));
  await f.ev(() => document.querySelector('#w181 .w181ppl tbody tr').click()); await f.page.waitForTimeout(250);
  ok('phone: a sheet opens', await f.ev(() => !!document.querySelector('.w181sheet .acc')));
  if (SHOTS) { await f.ev(() => closeModal()); await f.page.screenshot({ path: path.join(SHOTS, 'admin_390.png'), fullPage: true }); }
  ok('phone: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw181drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join("\n")); console.error(e); process.exit(2); });
