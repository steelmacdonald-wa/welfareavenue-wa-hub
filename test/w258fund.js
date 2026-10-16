/* w258fund.js (was w258drive.js until a parallel session's wave258 test took the name, 16/10/26): wave258, the Fundraising meeting's follow-through. Uses test/boot.js (stubbed Supabase, clock 25/09/26).
   Amanda (the Fundraising lead), Alexis (a Fundraising member), an admin, a marketing member (plain), the board, phone width.
   Home chips, requests first on the team page, the Grants page and the Fundraising page without grants, the task check's
   explainer and answered count, the Academy's Assign for someone who already finished.
   CAND=<file>; SHOTS=1 saves screenshots in test/shots_w258/. */
const fs = require('fs');
const path = require('path');
const { launch, fresh } = require('./boot');
const { fx258 } = require('./w258fx');
let pass = 0, fail = 0;
function ok(name, cond, info) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (info !== undefined ? '  ' + JSON.stringify(info).slice(0, 400) : '')); } }
const SHOTS = process.env.SHOTS ? path.join(__dirname, 'shots_w258') : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
async function shot(f, name, full) { if (SHOTS) await f.page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!full }); }

function fx() {
  const x = fx258();
  x.dept_requests = (x.dept_requests || []).concat([
    { id: 9019, done: false, title: 'Send Robert information on Rally Paper for LinkedIn credibility', status: 'requested', source: 'meeting', department: 'fundraising', type_key: 'grant-info', priority: 'normal', requested_by: 'Steel MacDonald (from a meeting)', requested_email: 'steel.macdonald@welfareavenue.com', created_at: '2026-09-22T03:05:41Z', needed_by: '2026-09-30', details: {} }
  ]);
  return x;
}
const INS = `window.__ins = []; (function () { var f = db.from.bind(db); db.from = function (t) { var b = f(t); if (t === 'dept_tasks') { var i = b.insert.bind(b); b.insert = function (p) { window.__ins.push(p); return i(p); }; } return b; }; })();`;
const DUE = [
  { task_id: 801, title: 'Print the door-to-door shirts', department: 'fundraising', owner: 'Alexis', due_date: '2026-09-20', why: 'overdue', meeting_title: 'Weekly Fundraising Meeting', meeting_date: '2026-09-16', next_meeting: '2026-09-30', following_meeting: '2026-10-07', suggested: '2026-09-30' },
  { task_id: 802, title: 'Send the shirt design to marketing', department: 'fundraising', owner: 'Alexis', due_date: null, why: 'owner_check', owner_unsure: true, meeting_title: null, meeting_date: null, next_meeting: '2026-09-30', following_meeting: '2026-10-07', suggested: '2026-09-30' },
  { task_id: 803, title: 'Gift basket drive sign-up sheet', department: 'fundraising', owner: 'Alexis', due_date: null, why: 'no_date', meeting_title: null, meeting_date: null, next_meeting: '2026-09-30', following_meeting: '2026-10-07', suggested: '2026-09-30' }
];

(async () => {
  const browser = await launch();
  const CHIPS = () => Array.from(document.querySelectorAll('#mpBody .mp-chip')).map(c => ({ k: c.getAttribute('data-w258chip'), h: c.getAttribute('data-mphash'), t: c.textContent.replace(/\s+/g, ' ').trim() }));

  /* ---------- Amanda: the Fundraising lead ---------- */
  let f = await fresh(browser, { who: 'amanda', width: 1366, hash: '#mypage', fixture: fx(), wait: 5000 });
  let p = f.page;
  await f.ev(INS);
  let c = await f.ev(CHIPS);
  const dec = c.find(x => x.k === 'dec');
  ok('Amanda: open decisions counts Fundraising’s own decisions', dec && /^2\s*open decisions for Fundraising$/.test(dec.t), c);
  ok('Amanda: my open tasks and team tasks are marked', c.some(x => x.k === 'mine') && c.some(x => x.k === 'team'), c);
  ok('Amanda: incoming requests chip goes to the team', c.some(x => x.k === 'req' && /incoming requests/.test(x.t)), c);
  await shot(f, '1_home_amanda', true);
  await p.click('#mpBody [data-w258chip="mine"]'); await p.waitForTimeout(700);
  ok('my open tasks: My tasks lit up, still on Home', await f.ev(() => { const s = document.querySelector('#mpBody .mp-sec.w258hl'); return location.hash === '#mypage' && !!s && /^My tasks/.test(s.querySelector('h3').textContent); }));
  await p.click('#mpBody [data-w258chip="dec"]'); await p.waitForTimeout(2500);
  let r = await f.ev(() => ({ h: location.hash, lit: !!document.querySelector('#w116host .w116card.w258hl .w116dec'), ov: !!document.querySelector('.panel.active#overview') }));
  ok('open decisions: the Fundraising page at its decisions, not the executive view', r.h === '#team/fundraising' && r.lit && !r.ov, r);
  await shot(f, '2_team_decisions');
  r = await f.ev(() => { const h = document.getElementById('w116host'); const q = document.getElementById('w258req'); const seg = h && h.querySelector(':scope > .w116seg'); return { q: !!q, before: !!(q && seg && q.nextElementSibling === seg), rows: q ? q.querySelectorAll('[data-w258r]').length : 0, txt: q ? q.textContent : '' }; });
  ok('requests: at the top of the team page, above the tabs', r.q && r.before && r.rows === 1 && /Asked of Fundraising \(1\)/.test(r.txt) && /needed by Sep 30/.test(r.txt), r);
  await f.ev(() => window.scrollTo(0, 0)); await shot(f, '3_team_requests_top');
  await p.click('#w258req [data-w258r="9019"]'); await p.waitForTimeout(900);
  ok('a request opens in place (the request sheet)', await f.ev(() => { const s = document.getElementById('w123sheet'); return !!(s && s.classList.contains('on')) && location.hash === '#team/fundraising'; }));
  await f.ev(() => { try { window.w123.close(); } catch (e) { } });
  r = await f.ev(() => {
    const open = (window.w116TasksFor('fundraising', null, null) || []).filter(t => !t.done).length;
    const all = DB_TASKS.filter(t => t.department === 'fundraising' && !t.done).length;
    const tile = document.querySelector('#w116host .w116kpis > .w116kpi b');
    return { open, all, tile: tile && tile.textContent, grants: DB_TASKS.filter(t => t.department === 'fundraising' && !t.done && window.w258.isGrant(t)).length };
  });
  ok('Fundraising totals leave grants out', r.grants > 0 && r.open === r.all - r.grants && r.tile === String(r.open), r);
  r = await f.ev(() => ({ seg: Array.from(document.querySelectorAll('#w116host > .w116seg a')).map(a => a.textContent), row: Array.from(document.querySelectorAll('#tabBar .w42sub .tab[data-tab="grants"]')).filter(b => b.style.display !== 'none' && b.closest('.w42d').querySelector(':scope > .tab[data-tab="fundraising"]')).length }));
  ok('Grants in the team page tabs and in the Fundraising row of the menu', r.seg.indexOf('Grants') >= 0 && r.row === 1, r);
  await f.hash('#team/fundraising/tasks', 2200);
  r = await f.ev(() => ({ ptr: !!document.querySelector('#w116tasks .w258ptr a[data-w116go="#grants"]'), g: !!document.querySelector('#w116tasks .w116g[data-g="bgrants"]'), grantRows: Array.from(document.querySelectorAll('#w116tasks [data-tid]')).filter(el => window.w258.isGrant(DB_TASKS.find(t => String(t.id) === el.getAttribute('data-tid')))).length }));
  ok('Fundraising tasks: the Grants group is a pointer, no grants rows', r.ptr && !r.g && r.grantRows === 0, r);
  await shot(f, '4_team_tasks_pointer');
  await p.click('#w116tasks .w258ptr a'); await p.waitForTimeout(2000);
  r = await f.ev(() => ({ h: location.hash, act: (document.querySelector('.panel.active') || {}).id, over: (document.querySelector('#grants .w258over') || {}).textContent, pipe: !!document.querySelector('#grants [data-w258g="pipe"]'), rows: Array.from(document.querySelectorAll('#w258gtasks [data-tid]')).map(el => el.getAttribute('data-tid')), want: window.w116TasksFor('fundraising', WA_TEAMS.boards.fundraising[0], null).filter(t => !t.done).map(t => String(t.id)), crumb: (document.querySelector('#grants .w116crumb') || {}).textContent }));
  ok('Grants page: its own page, overseen by Suhaib, the pipeline button', r.h === '#grants' && r.act === 'grants' && /Overseen by Suhaib/.test(r.over) && r.pipe && /Teams . Fundraising . Grants/.test(r.crumb), r);
  ok('Grants page: the Grants workstream’s tasks on the standard board', r.rows.length === r.want.length && r.want.every(id => r.rows.indexOf(id) >= 0) && r.rows.length > 0, r);
  await shot(f, '5_grants_page', true);
  ok('Grants page: tick, open, the bank (drawer)', await f.ev(() => !!document.querySelector('#w258gtasks .w116r [data-act="toggle"]')));
  await p.click('#w258gtasks .w116r .w116t'); await p.waitForTimeout(700);
  ok('a grants task opens in the drawer with To the bank', await f.ev(() => { const d = document.getElementById('w116dr'); return !!d && d.getBoundingClientRect().width > 0 && /bank/i.test(d.textContent); }));
  await f.ev(() => window.w116Board.closeDrawer());
  await p.click('#grants [data-w258g="add"]'); await p.waitForTimeout(500);
  const inp = await p.$('#w258gtasks .w116qa:not([style*="none"]) input');
  ok('Add a grants task opens the quick add', !!inp);
  if (inp) { await inp.fill('Draft the Trillium letter of intent'); await inp.press('Enter'); await p.waitForTimeout(900); }
  r = await f.ev(() => window.__ins.slice(-1)[0]);
  const ins = Array.isArray(r) ? r[0] : r;
  ok('a new grants task is filed under fundraising / Grants', ins && ins.department === 'fundraising' && ins.subsection === 'Grants' && /Trillium/.test(ins.title), r);
  await p.click('#grants [data-w258g="pipe"]'); await p.waitForTimeout(1500);
  ok('Open the grants pipeline goes to the Fundraising app', await f.ev(() => /^#fund\/grants/.test(location.hash)));
  ok('Amanda: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------- Alexis: a Fundraising member ---------- */
  f = await fresh(browser, { who: 'alexis', width: 1366, hash: '#mypage', fixture: fx(), wait: 5000, rpcs: { wa237_due_check: DUE } });
  p = f.page;
  await p.waitForTimeout(6500);
  r = await f.ev(() => { const el = document.getElementById('w213pop'); if (!el) return null; return { how: (el.querySelector('.how') || {}).textContent, prog: (el.querySelector('.prog b') || {}).textContent, x: !!el.querySelector('[aria-label=Close], .x, [data-w213later]') }; });
  ok('task check: one line says how to carry on', r && /^Answer each task to carry on: Done, a new date, or Not mine\. The Hub opens right after you save\.$/.test(r.how), r);
  ok('task check: x of n answered, and still no way out', r && r.prog === '2 of 3 answered' && !r.x, r);
  await shot(f, '6_task_check');
  await p.click('[data-w213mine="802"][data-v="0"]'); await p.waitForTimeout(200);
  ok('answering the last one: All 3 answered', await f.ev(() => /^All 3 answered/.test(document.querySelector('#w213pop .prog b').textContent) && document.querySelector('#w213pop .prog').classList.contains('all')));
  await f.ev(() => { const i = document.querySelector('[data-w213date="801"]'); i.value = '2026-09-01'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  ok('a past date counts as not answered', await f.ev(() => document.querySelector('#w213pop .prog b').textContent === '2 of 3 answered'));
  await shot(f, '7_task_check_progress');
  await p.keyboard.press('Escape'); await p.mouse.click(5, 5); await p.waitForTimeout(200);
  ok('Escape and a click outside still leave it open', await f.ev(() => !!document.getElementById('w213pop')));
  await f.ev(() => { const el = document.getElementById('w213pop'); if (el) el.remove(); });
  c = await f.ev(CHIPS);
  ok('Alexis: decisions chip counts her team’s decisions', c.some(x => x.k === 'dec' && /for Fundraising/.test(x.t)), c);
  await p.click('#mpBody [data-w258chip="dec"]'); await p.waitForTimeout(2500);
  ok('Alexis: decisions open the Fundraising page, not the Dashboard', await f.ev(() => location.hash === '#team/fundraising' && !!document.querySelector('#w116host .w258hl')));
  ok('Alexis: sees Grants in the Fundraising row', await f.ev(() => { const b = document.querySelector('#tabBar .tab[data-tab="grants"]'); return !!b && b.style.display !== 'none'; }));
  ok('Alexis: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------- the admin keeps the executive view ---------- */
  f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(), wait: 5000 });
  p = f.page;
  c = await f.ev(CHIPS);
  ok('admin: open decisions untouched (the executive view)', c.some(x => x.h === '#overview' && x.k !== 'dec' && /open decisions$/.test(x.t)), c);
  await p.click('#mpBody [data-mphash="#overview"]'); await p.waitForTimeout(1200);
  ok('admin: open decisions still opens #overview', await f.ev(() => location.hash === '#overview'));
  await f.hash('#grants', 2000);
  ok('admin: the Grants page opens', await f.ev(() => (document.querySelector('.panel.active') || {}).id === 'grants' && document.querySelectorAll('#w258gtasks [data-tid]').length > 0));
  /* the Academy's Assign (Steel: "Weird, I can't assign Alex to it"): someone who already finished says so; email search */
  await f.hash('#training', 2500);
  await f.ev(async () => { try { if (typeof wa28Load === 'function') await wa28Load(true); } catch (e) { } try { await w122.load(true); } catch (e) { } w122.A.prog = w122.A.prog.filter(x => !(String(x.training_id) === '9' && x.person_name === 'Alexis')); w122.A.prog.push({ training_id: 9, person_name: 'Alexis', status: 'done', done_at: '2026-09-24T22:17:49Z' }); w122.openTraining(9); });
  await p.waitForTimeout(900);
  await p.click('#w122sheet [data-w122assign]'); await p.waitForTimeout(600);
  r = await f.ev(() => { const l = Array.from(document.querySelectorAll('#w122sheet .ppl label')).find(x => /^Alexis\b/.test(x.textContent.trim())); return { fin: !!(l && l.classList.contains('w258fin')), dis: !!(l && l.querySelector('input').disabled), em: l ? (l.querySelector('em.w258fint') || l.querySelector('em:last-child') || {}).textContent : '', prog: w122.A.prog.filter(x => String(x.training_id) === '9').map(x => x.person_name + ':' + x.status).join(','), note: (document.querySelector('#w122sheet .w258finnote') || {}).textContent }; });
  ok('Assign: someone who already finished says so, plainly', r.fin && r.dis && /^Already finished Sep 24$/.test(r.em) && /Alexis already finished this training/.test(r.note || ''), r);
  await shot(f, '11_assign_finished');
  await p.fill('#w122sheet [data-w122aq]', 'alexis.walter'); await p.waitForTimeout(700);
  ok('Assign: search finds people by their email too', await f.ev(() => Array.from(document.querySelectorAll('#w122sheet .ppl label')).map(x => x.textContent.trim()).some(t => /^Alexis/.test(t))));
  ok('admin: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------- a marketing member: no Grants ---------- */
  f = await fresh(browser, { who: 'plain', width: 1366, hash: '#mypage', fixture: (() => { const x = fx(); (x.hub_access_profiles || []).forEach(pp => { if (pp.key === 'marketing') pp.pages = Object.assign({}, pp.pages, { fundraising: 'none', grants: 'none' }); }); return x; })(), wait: 5000 });
  r = await f.ev(() => { const b = document.querySelector('#tabBar .tab[data-tab="grants"]'); return { b: !!b, shown: !!b && b.style.display !== 'none', allowed: wa40Allowed().indexOf('grants') >= 0 }; });
  ok('marketing member: no Grants in the menu', !r.shown && !r.allowed, r);
  await f.hash('#grants', 1500);
  ok('marketing member: the Grants page says who it is for', await f.ev(() => /people who can open the Fundraising team page/.test((document.getElementById('grants') || {}).textContent || '')));
  ok('marketing member: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------- the board ---------- */
  f = await fresh(browser, { who: 'board', width: 1366, hash: '', fixture: fx(), wait: 5000 });
  r = await f.ev(() => ({ grants: (() => { const b = document.querySelector('#tabBar .tab[data-tab="grants"]'); return !!b && b.style.display !== 'none'; })(), req: !!document.getElementById('w258req'), chips: document.querySelectorAll('[data-w258chip]').length }));
  ok('board: nothing of this wave shows', !r.grants && !r.req && r.chips === 0, r);
  ok('board: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------- phone width ---------- */
  f = await fresh(browser, { who: 'amanda', width: 390, hash: '#mypage', fixture: fx(), wait: 5000 });
  p = f.page;
  r = await f.ev(() => ({ sw: document.documentElement.scrollWidth, chips: document.querySelectorAll('#mpBody [data-w258chip]').length }));
  ok('phone: the chips, no sideways scroll', r.chips >= 3 && r.sw <= 392, r);
  await shot(f, '8_phone_home');
  await f.hash('#grants', 2200);
  r = await f.ev(() => ({ sw: document.documentElement.scrollWidth, rows: document.querySelectorAll('#w258gtasks [data-tid]').length, add: (document.querySelector('#grants [data-w258g="add"]') || { getBoundingClientRect: () => ({ width: 0 }) }).getBoundingClientRect().width }));
  ok('phone: the Grants page fits', r.rows > 0 && r.sw <= 392 && r.add > 100, r);
  await shot(f, '9_phone_grants', true);
  await f.hash('#team/fundraising', 2500);
  ok('phone: requests on top of the team page', await f.ev(() => !!document.getElementById('w258req') && document.documentElement.scrollWidth <= 392));
  await shot(f, '10_phone_team');
  ok('phone: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log('w258 ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
