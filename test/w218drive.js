/* w218drive.js: wave218, Volunteer instead: an applicant in the HR centre who would rather volunteer goes to the Volunteer Manager.
   Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26). wa218_to_volunteer is answered and recorded by a wrapper on db.rpc.
   CAND=<file>; SHOTS=1 saves screenshots in test/shots_w218/. */
const fs = require('fs');
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }
const SHOTS = process.env.SHOTS ? path.join(__dirname, 'shots_w218') : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
async function shot(f, name, full) { if (SHOTS) await f.page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!full }); }

function fixture() {
  const FX = loadFixture();
  const now = '2026-09-20T12:00:00Z';
  FX.hub_positions = [
    { id: 35, title: 'Operations Manager', dept: 'opsmtl', folder_id: 'F35', resumes_id: 'R35', stage: 'interviewing', gone: false },
    { id: 33, title: 'Volunteer Cook', dept: 'opsmtl', folder_id: 'F33', resumes_id: 'R33', stage: 'posted', gone: false }
  ];
  FX.hub_position_files = []; FX.hub_position_people = []; FX.hub_candidate_grades = []; FX.hub_candidate_calls = []; FX.hub_candidate_interviews = [];
  FX.hub_candidates = [
    { id: 9301, name: 'Maya Ops', email: 'maya@example.com', phone: '514 555 0110', role: 'Operations Manager', position_id: 35, status: 'reviewing', owner: null, source: 'website', created_at: now },
    { id: 9302, name: 'Sophie Cook', role: 'Volunteer Cook', position_id: 33, status: 'new', source: 'email', created_at: now },
    { id: 9303, name: 'Nina New', role: 'Operations Manager', position_id: 35, status: 'new', source: 'website', created_at: now },
    { id: 9304, name: 'Victor Volunteering', role: 'Operations Manager', position_id: 35, status: 'volunteering', close_reason: 'Volunteering: Driver', volunteer_id: 701, source: 'website', created_at: now },
    { id: 9305, name: 'Erin Error', role: 'Operations Manager', position_id: 35, status: 'new', source: 'website', created_at: now }
  ];
  FX.volunteer_events = [
    { id: 801, code: 'WA-26-21', title: null, event_date: '2026-10-04', start_time: '12:00:00', status: 'planned', kind: 'service', location: 'Montreal' },
    { id: 802, code: 'WA-26-28', title: "TEST - Don't sign up", event_date: '2026-10-11', start_time: '12:00:00', status: 'planned', kind: 'service', location: 'Berri-Uqam' },
    { id: 803, code: 'WA-26-22', title: 'Oberoi Financial partnership', event_date: '2026-10-18', start_time: '12:00:00', status: 'planned', kind: 'service', location: 'Montreal' },
    { id: 804, code: 'WA-26-23', title: null, event_date: '2026-11-01', start_time: '12:00:00', status: 'planned', kind: 'service', location: 'Montreal' }
  ];
  return FX;
}
const WRAP = () => { if (db.__w218) return; window.__RPC = []; window.__UPD = []; var orig = db.rpc.bind(db); db.rpc = function (fn, args) { window.__RPC.push({ fn: fn, args: args });
  if (fn === 'wa218_to_volunteer') {
    if (args.p_id === 9305) return Promise.resolve({ data: null, error: { message: 'Pick at least one volunteer role.' } });
    var L = { cook: 'Cook', driver: 'Driver', server: 'Server', team_leader: 'Team leader' };
    var labels = args.p_roles.map(function (k) { return L[k] || k; }).join(', ');
    return Promise.resolve({ data: { ok: true, person_id: 700, contact_id: 7700, application_id: 64, labels: labels, added: (args.p_events || []).length, close_reason: 'Volunteering: ' + labels }, error: null });
  }
  return orig(fn, args); };
  var from = db.from.bind(db); db.from = function (t) { var b = from(t); if (t === 'hub_candidates') { var u = b.update; b.update = function (p) { window.__UPD.push(p); return u.call(b, p); }; } return b; };
  db.__w218 = true; };

(async () => {
  const browser = await launch();
  const FX = fixture();
  let f = await fresh(browser, { who: 'admin', width: 1440, hash: '#hrcentre/applications', fixture: JSON.parse(JSON.stringify(FX)), wait: 5000 });
  await f.page.waitForTimeout(1800); await f.ev(WRAP);
  await f.ev(() => { try { w197.paintBoard(); } catch (e) { /* fine */ } }); await f.page.waitForTimeout(300);
  ok('w218 is loaded', await f.ev(() => !!window.w218));

  /* a team applicant who would rather volunteer */
  await f.ev(() => w197.openSheet(9301)); await f.page.waitForTimeout(500);
  const s1 = await f.ev(() => { var s = document.getElementById('w197sheet'); return { t: s.textContent, b: !!s.querySelector('[data-w218open="9301"]'), st: Array.from(s.querySelectorAll('[data-w197st]')).map(b => b.textContent) }; });
  ok('Sheet: a team applicant is offered Volunteer instead', s1.b && /Would they rather volunteer\?/.test(s1.t), s1.t.slice(0, 300));
  ok('Sheet: the stage row has Volunteering with the closed stages', s1.st.join('|') === 'New|Reviewing|Interview|Offer|Hired|Declined|Withdrawn|Volunteering', s1.st);
  await shot(f, 'sheet_offer');
  await f.page.click('#w197sheet [data-w218open="9301"]'); await f.page.waitForTimeout(600);
  const d1 = await f.ev(() => { var d = document.getElementById('w218dlg'); return { open: d && d.classList.contains('open'), h: (d.querySelector('h3') || {}).textContent, roles: d.querySelectorAll('[data-w218role]').length, checked: d.querySelectorAll('[data-w218role]:checked').length,
    evs: Array.from(d.querySelectorAll('[data-w218ev]')).map(x => x.getAttribute('data-w218ev')), send: d.querySelector('[data-w218go="send"]').disabled, t: d.textContent }; });
  ok('Step: opens with their name', d1.open && /Maya Ops: volunteer instead/i.test(d1.h), d1);
  ok('Step: the eight roles, none ticked for a team role', d1.roles === 8 && d1.checked === 0, d1);
  ok('Step: the upcoming servings, a TEST serving left out', d1.evs.join() === '801,803,804', d1.evs);
  ok('Step: Move is disabled until a role is picked', d1.send === true && /Pick at least one role/.test(d1.t), d1.send);
  ok('Step: it says nobody is notified and nothing is texted', /Nobody is notified and nothing is texted/.test(d1.t) && /no text goes from here/.test(d1.t));
  await f.page.check('#w218dlg [data-w218role="cook"]'); await f.page.waitForTimeout(150);
  await f.page.check('#w218dlg [data-w218role="driver"]'); await f.page.waitForTimeout(150);
  await f.page.check('#w218dlg [data-w218ev="803"]');
  await f.page.fill('#w218note', 'Has a car, free Sundays');
  ok('Step: picking a role enables Move and keeps the ticks', await f.ev(() => !document.querySelector('#w218dlg [data-w218go="send"]').disabled && document.querySelectorAll('#w218dlg [data-w218role]:checked').length === 2 && document.querySelector('#w218dlg [data-w218ev="803"]').checked));
  await shot(f, 'step');
  await f.page.click('#w218dlg [data-w218go="send"]'); await f.page.waitForTimeout(800);
  const r1 = await f.ev(() => ({ rpc: window.__RPC.filter(x => x.fn === 'wa218_to_volunteer').pop(), c: w197.state().cands.filter(x => x.id === 9301)[0], dlg: document.getElementById('w218dlg').classList.contains('open'),
    sheet: document.getElementById('w197sheet').textContent, rec: !!document.querySelector('#w197sheet [data-w218rec="700"]'), onBoard: Array.from(document.querySelectorAll('#w197board .w197col [data-w197c="9301"], #w197board [data-w197c="9301"]')).filter(e => !e.closest('.w197closed')).length, upd: window.__UPD.length }));
  ok('Move: one call with the card, roles, serving and note', r1.rpc && r1.rpc.args.p_id === 9301 && r1.rpc.args.p_roles.join() === 'cook,driver' && r1.rpc.args.p_events.join() === '803' && r1.rpc.args.p_note === 'Has a car, free Sundays', r1.rpc);
  ok('Move: the card is Volunteering, linked to the volunteer record', r1.c.status === 'volunteering' && r1.c.volunteer_id === 700 && r1.c.close_reason === 'Volunteering: Cook, Driver', r1.c);
  ok('Move: the step closes and the sheet says where they are', !r1.dlg && /Volunteering: Cook, Driver/.test(r1.sheet) && /Applicants received/.test(r1.sheet) && r1.rec, r1.sheet.slice(0, 300));
  ok('Move: the card leaves the open columns', r1.onBoard === 0, r1.onBoard);
  ok('Move: the Hub did not write the card itself (the database step does)', r1.upd === 0, r1.upd);
  await shot(f, 'moved');
  ok('Board: the closed list counts volunteering', await f.ev(() => /closed \(declined, withdrawn or volunteering\)/.test(document.querySelector('#w197apps .w197closed').textContent)));

  /* a volunteer role keeps its wording and opens the same step, with the role ticked */
  await f.ev(() => { var s = document.getElementById('w197sheet'); if (s) s.classList.remove('open'); w197.openSheet(9302); }); await f.page.waitForTimeout(500);
  ok('Volunteer role: Cook is a volunteer role, Move to the Volunteer Manager', await f.ev(() => /Cook is a volunteer role/.test(document.getElementById('w197sheet').textContent) && /Move to the Volunteer Manager/.test(document.querySelector('#w197sheet [data-w218open="9302"]').textContent) && !document.querySelector('#w197sheet [data-w209move]')));
  await f.page.click('#w197sheet [data-w218open="9302"]'); await f.page.waitForTimeout(500);
  ok('Volunteer role: the step opens with Cook ticked', await f.ev(() => Array.from(document.querySelectorAll('#w218dlg [data-w218role]:checked')).map(x => x.getAttribute('data-w218role')).join() === 'cook'));
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(200);
  ok('Escape closes the step without moving them', await f.ev(() => !document.getElementById('w218dlg').classList.contains('open') && !window.__RPC.some(x => x.fn === 'wa218_to_volunteer' && x.args.p_id === 9302) && w197.state().cands.filter(x => x.id === 9302)[0].status === 'new'));

  /* the stage button opens the step instead of moving the card */
  await f.ev(() => { var s = document.getElementById('w197sheet'); if (s) s.classList.remove('open'); w197.openSheet(9303); }); await f.page.waitForTimeout(500);
  await f.page.click('#w197sheet [data-w197st="volunteering"]'); await f.page.waitForTimeout(600);
  ok('Stage button: Volunteering opens the step, the card does not move yet', await f.ev(() => document.getElementById('w218dlg').classList.contains('open') && /Nina New/.test(document.querySelector('#w218dlg h3').textContent) && w197.state().cands.filter(x => x.id === 9303)[0].status === 'new' && window.__UPD.length === 0));
  await f.page.click('#w218dlg .bk', { position: { x: 5, y: 5 } }); await f.page.waitForTimeout(200);

  /* an error is shown in the step, nothing changes */
  await f.ev(() => { var s = document.getElementById('w197sheet'); if (s) s.classList.remove('open'); w218.open(9305); }); await f.page.waitForTimeout(500);
  await f.page.check('#w218dlg [data-w218role="server"]'); await f.page.waitForTimeout(150);
  await f.page.click('#w218dlg [data-w218go="send"]'); await f.page.waitForTimeout(600);
  ok('Error: said in the step, the card stays', await f.ev(() => /Could not move them: Pick at least one volunteer role/.test(document.querySelector('#w218dlg .w218err').textContent) && w197.state().cands.filter(x => x.id === 9305)[0].status === 'new' && !document.querySelector('#w218dlg [data-w218go="send"]').disabled));
  await f.page.click('#w218dlg [data-w218x].x'); await f.page.waitForTimeout(200);

  /* a card already volunteering */
  await f.ev(() => w197.openSheet(9304)); await f.page.waitForTimeout(500);
  ok('Closed card: says Volunteering: Driver with their record and Applicants received', await f.ev(() => /Volunteering: Driver/.test(document.getElementById('w197sheet').textContent) && !!document.querySelector('#w197sheet [data-w218rec="701"]') && !!document.querySelector('#w197sheet [data-w218go="applicants"]') && !document.querySelector('#w197sheet [data-w218open]')));
  ok('Closed card: its Next line points to Applicants received', await f.ev(() => /With the Volunteer Manager/.test(document.querySelector('#w197sheet .next').textContent)));
  await f.page.click('#w197sheet [data-w218go="applicants"]'); await f.page.waitForTimeout(800);
  ok('Applicants received opens', await f.ev(() => location.hash === '#volunteering/applicants'));
  ok('No page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* a phone */
  f = await fresh(browser, { who: 'admin', width: 390, height: 844, hash: '#hrcentre/applications', fixture: JSON.parse(JSON.stringify(FX)), wait: 5000 });
  await f.page.waitForTimeout(1800); await f.ev(WRAP);
  await f.ev(() => w218.open(9301)); await f.page.waitForTimeout(600);
  ok('Phone: the step fits the screen', await f.ev(() => { var p = document.querySelector('#w218dlg .pn'); return p && p.getBoundingClientRect().width <= window.innerWidth && p.scrollWidth <= p.clientWidth + 2 && document.documentElement.scrollWidth <= window.innerWidth + 2; }));
  await shot(f, 'phone');
  ok('Phone: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* a board member is not staff: no Volunteer instead */
  f = await fresh(browser, { who: 'board', width: 1366, hash: '#hrcentre/applications', fixture: JSON.parse(JSON.stringify(FX)), wait: 5000 });
  await f.page.waitForTimeout(1800);
  ok('Not staff: w218.sheetBits is empty', await f.ev(() => !window.w218 || w218.sheetBits({ id: 1, status: 'new' }) === ''));
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw218drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
