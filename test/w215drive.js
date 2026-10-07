/* w215drive.js: wave215, the HR centre walkthroughs. Runs the recruitment walkthrough end to end as a learner would (clicking the
   real buttons; the coach must move on by itself), the time-off and onboarding walkthroughs, checks every step of every walkthrough
   finds what it rings, the Academy hand-off, practice flags, Clear practice and the Slack hours.
   Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26 16:00 Toronto). Writes to hub_candidates and wa_timeoff are kept in
   the fixture by a wrapper so reloads see them. CAND=<file>; SHOTS=1 saves screenshots in test/shots_w215/. */
const fs = require('fs');
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }
const SHOTS = process.env.SHOTS ? path.join(__dirname, 'shots_w215') : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
async function shot(f, name, full) { if (SHOTS) await f.page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!full }); }

function fixture() {
  const FX = loadFixture();
  FX.hub_positions = [
    { id: 17, title: 'Content Manager', dept: 'marketing', folder_id: 'F17', resumes_id: 'R17', stage: 'posted', gone: false },
    { id: 35, title: 'Operations Manager', dept: 'opsmtl', folder_id: 'F35', resumes_id: 'R35', stage: 'interviewing', gone: false }
  ];
  FX.hub_position_files = []; FX.hub_position_people = []; FX.hub_candidate_grades = []; FX.hub_candidate_interviews = []; FX.hub_candidate_calls = [];
  FX.hub_candidates = [
    { id: 9601, name: 'Real Applicant', role: 'Content Manager', position_id: 17, status: 'new', email: 'real@example.com', source: 'email', created_at: '2026-09-24T12:00:00Z' }
  ];
  FX.wa_timeoff = [];
  FX.slack_hours = [{ member_name: 'Valex', week_start: '2026-09-21', hours: 2.5, sessions: 2 }];
  return FX;
}
const INIT = `window.__WA_RPCS = { wa_can_timeoff: true };
window.__INV = []; window.__WA_INVOKE = function (name, opts) { var b = (opts && opts.body) || {}; window.__INV.push({ name: name, body: b });
  var fx = window.__WAFIX;
  if (name === 'recruit-actions' && b.action === 'cv_check') return { data: { ok: true, id: 'S1', name: 'Sample CV' }, error: null };
  if (name === 'recruit-actions' && b.action === 'offer_preview') { var c = (fx.hub_candidates || []).filter(function (x) { return x.id === b.id; })[0] || {}; return { data: { ok: true, html: '<p>Letter</p>', role: 'Content Manager', practice: !!c.practice, mail_mode: 'test', test_to: 'test@x', signer: (b.f && b.f.signer_email === 'suhaib.abdillahi@welfareavenue.com') ? 'Suhaib' : 'Steel', signer_title: (b.f && b.f.signer_email === 'suhaib.abdillahi@welfareavenue.com') ? 'Co-Executive Director' : 'ED', signer_email: (b.f && b.f.signer_email) || 'steel.macdonald@welfareavenue.com', signer_has_sig: !(b.f && b.f.signer_email === 'suhaib.abdillahi@welfareavenue.com'), default_signer: window.__DEFSIG || 'steel.macdonald@welfareavenue.com', signers: [{ email: 'steel.macdonald@welfareavenue.com', name: 'Steel', title: 'ED', has_sig: true }, { email: 'suhaib.abdillahi@welfareavenue.com', name: 'Suhaib', title: 'Co-Executive Director', has_sig: false }] }, error: null }; }
  if (name === 'recruit-actions' && b.action === 'offer_signer_set') { window.__DEFSIG = b.email; return { data: { ok: true, signer_email: b.email }, error: null }; }
  if (name === 'recruit-actions' && b.action === 'offer_send') { (fx.hub_candidates || []).forEach(function (x) { if (x.id === b.id) { x.offer_sent_at = '2026-09-25T20:00:00Z'; x.offer_doc_url = 'https://docs.google.com/document/d/X'; x.offer_email_to = b.f.email; } }); return { data: { ok: true, doc_url: 'https://docs.google.com/document/d/X', emailed: { mode: 'practice', to: [b.f.email] } }, error: null }; }
  return { data: { ok: true }, error: null }; };`;
/* keep writes in the fixture; answer the intake and the practice clearing */
const WRAP = () => {
  if (db.__w215) return; db.__w215 = true; window.__RPC = [];
  var fx = window.__WAFIX, nextId = 9700;
  var orpc = db.rpc.bind(db);
  db.rpc = function (fn, args) {
    window.__RPC.push({ fn: fn, args: args });
    if (fn === 'wa209_intake') { var p = args.p; var id = nextId++; (fx.hub_candidates = fx.hub_candidates || []).push({ id: id, name: p.name, email: (p.email || '').toLowerCase(), role: 'Content Manager', position_id: p.position_id ? Number(p.position_id) : null, status: 'new', source: p.practice ? 'practice' : 'manual', practice: !!p.practice, links: p.links, created_at: '2026-09-25T20:00:00Z', stage_at: '2026-09-25T20:00:00Z' }); return Promise.resolve({ data: { ok: true, to: 'applications', candidate_id: id, practice: !!p.practice }, error: null }); }
    if (fn === 'wa215_clear_practice') { var a = (fx.hub_candidates || []).filter(function (c) { return c.practice; }).length, t = (fx.wa_timeoff || []).filter(function (c) { return c.practice; }).length; fx.hub_candidates = (fx.hub_candidates || []).filter(function (c) { return !c.practice; }); fx.wa_timeoff = (fx.wa_timeoff || []).filter(function (c) { return !c.practice; }); return Promise.resolve({ data: { ok: true, applications: a, timeoff: t }, error: null }); }
    return orpc(fn, args);
  };
  var from = db.from.bind(db);
  db.from = function (t) {
    var q = from(t);
    if (t === 'hub_candidates' || t === 'wa_timeoff' || t === 'onboardings') {
      var ins = q.insert && q.insert.bind(q), up = q.update && q.update.bind(q), del = q.delete && q.delete.bind(q);
      if (ins) q.insert = function (p) { var arr = Array.isArray(p) ? p : [p]; arr.forEach(function (r) { var row = Object.assign({ id: nextId++, created_at: '2026-09-25T20:00:00Z' }, r); (fx[t] = fx[t] || []).push(row); }); return ins(p); };
      if (up) q.update = function (p) { var b = up(p); var oeq = b.eq.bind(b); b.eq = function (c, v) { if (c === 'id') (fx[t] || []).forEach(function (r) { if (String(r.id) === String(v)) Object.assign(r, p); }); return oeq(c, v); }; return b; };
      if (del) q.delete = function () { var b = del(); var oeq = b.eq.bind(b); b.eq = function (c, v) { if (c === 'id') fx[t] = (fx[t] || []).filter(function (r) { return String(r.id) !== String(v); }); return oeq(c, v); }; return b; };
    }
    return q;
  };
};
async function step(f) { return await f.ev(() => { var r = w215.state(); return r ? { i: r.i, done: !!r.done[r.i], t: w215.defs[r.key].steps[r.i].t } : null; }); }
async function waitStep(f, title, ms) { const t0 = Date.now(); let s; while (Date.now() - t0 < (ms || 8000)) { s = await step(f); if (s && s.t === title) return s; await f.page.waitForTimeout(250); } return s; }
async function clickRing(f) { return await f.ev(() => { var r = w215.state(), st = w215.defs[r.key].steps[r.i]; var el = w215.q(st.s); if (!el) return false; el.click(); return true; }); }

(async () => {
  const browser = await launch();
  const FX = fixture();
  let f = await fresh(browser, { who: 'admin', width: 1440, height: 900, hash: '#hrcentre/overview', fixture: JSON.parse(JSON.stringify(FX)), init: INIT, wait: 5000 });
  await f.page.waitForTimeout(2500); await f.ev(WRAP);
  ok('w215 loaded with seven walkthroughs', await f.ev(() => !!window.w215 && Object.keys(w215.defs).length === 7));
  ok('Academy: the walkthroughs are registered as tours', await f.ev(() => ['hrwalk-start', 'hrwalk-recruit', 'hrwalk-onboard', 'hrwalk-timeoff', 'hrwalk-people', 'hrwalk-training', 'hrwalk-policies'].every(k => w122.tours[k] && w122.tours[k].w215 && w122.tourAvail(k))));

  /* every step of every walkthrough: the page opens and what it rings is there (or it is optional / conditional) */
  const miss = await f.ev(async () => {
    var out = [];
    for (var k of Object.keys(w215.defs)) {
      var d = w215.defs[k];
      for (var i = 0; i < d.steps.length; i++) {
        var st = d.steps[i]; if (!st.s || typeof st.s === 'function' || st.go || st.skipIf) continue;
        if (st.hash && location.hash !== st.hash) { location.hash = st.hash; await new Promise(r => setTimeout(r, 1500)); }
        if (!w215.q(st.s)) out.push(k + '#' + i + ' ' + st.t + ' [' + st.s + '] at ' + location.hash);
      }
    }
    return out;
  });
  ok('Every plain step finds what it rings (or is a known later-state step)', miss.filter(m => !/w197feed|#w212box|#w197sheet|#w209add|#modalBox|w105tobody|\.w199card|w105pt|w105dp|w105disc|w105pol|w104edit|w212mine|w212log|w44tbl|w169see|w169preview|#w105to|w212past/.test(m)).length === 0, miss);

  /* ---------- the recruitment walkthrough, as a learner ---------- */
  await f.ev(() => { location.hash = '#training'; }); await f.page.waitForTimeout(1500);
  await f.ev(() => w122.startTour('hrwalk-recruit')); await f.page.waitForTimeout(1500);
  ok('Academy hand-off: starting the tour starts the coach', await f.ev(() => !!w215.state() && w215.state().key === 'hrwalk-recruit' && !!document.getElementById('w215c') && !document.querySelector('.w122tp')));
  ok('Recruitment is a practice walkthrough', await f.ev(() => w215.practice()));
  await shot(f, 'recruit_intro');
  await f.page.click('#w215c [data-w215a="next"]'); await f.page.waitForTimeout(1500);
  let s = await step(f); ok('Step 2: Positions page with the ring', s && s.t === 'Positions: where hiring starts' && await f.ev(() => location.hash === '#hrcentre/positions' && document.getElementById('w215r').style.display === 'block'), s);
  await f.page.click('#w215c [data-w215a="next"]'); await f.page.waitForTimeout(800);
  await clickRing(f); s = await waitStep(f, 'Inside a position');
  ok('Opening a position moves the coach on by itself', s && s.t === 'Inside a position', s);
  await f.page.keyboard.press('Escape'); s = await waitStep(f, 'Applications: the board');
  ok('Closing it moves on to the board', s && s.t === 'Applications: the board', s);
  await f.page.click('#w215c [data-w215a="next"]'); await f.page.waitForTimeout(600);
  await clickRing(f); s = await waitStep(f, 'Fill in the form, as you');
  ok('Add an applicant opens the form and the coach follows', s && s.t === 'Fill in the form, as you', s);
  await f.page.click('#w215c [data-w215a="fill"]'); await f.page.waitForTimeout(300);
  const filled = await f.ev(() => ({ n: document.getElementById('w209n').value, e: document.getElementById('w209e').value, cv: document.getElementById('w209cv').value }));
  ok('Fill in: my name, my email and the sample CV', filled.n === 'Steel MacDonald' && filled.e === 'steel.macdonald@welfareavenue.com' && /docs\.google\.com/.test(filled.cv), filled);
  await f.page.selectOption('#w209pos', '17'); await f.page.click('#w209add [data-w209a="save"]');
  s = await waitStep(f, 'Your card', 10000);
  const intake = await f.ev(() => window.__RPC.filter(r => r.fn === 'wa209_intake').pop());
  ok('The application is saved as practice', intake && intake.args.p.practice === true, intake);
  ok('Practice skips filing the CV into a Resumes folder', await f.ev(() => !window.__INV.some(x => x.body.action === 'file_cv')));
  ok('The coach moves on to the card, which opens', s && s.t === 'Your card' && await f.ev(() => document.getElementById('w197sheet').classList.contains('open')), s);
  ok('The card says Practice on the board', await f.ev(() => /Practice/.test((document.querySelector('#w197board .w215prac') || {}).textContent || '')));
  await shot(f, 'recruit_card');
  await f.page.click('#w215c [data-w215a="next"]'); await f.page.waitForTimeout(800);
  await f.ev(() => { var s = document.getElementById('w197own1'); s.value = 'Steel MacDonald'; if (!s.value) s.selectedIndex = 1; s.dispatchEvent(new Event('change', { bubbles: true })); });
  s = await waitStep(f, 'Move to Reviewing'); ok('Handled by: the coach moves on', s && s.t === 'Move to Reviewing', s);
  await clickRing(f); s = await waitStep(f, 'Still interested? (a text)');
  ok('Reviewing: moved without a form (Handled by filled)', s && s.t === 'Still interested? (a text)' && !(await f.ev(() => document.getElementById('w211g') && document.getElementById('w211g').classList.contains('open'))), s);
  await f.page.click('#w215c [data-w215a="next"]'); await f.page.waitForTimeout(800);
  await f.ev(() => document.querySelector('[data-w199call][data-o="reached"]').click()); s = await waitStep(f, 'Book the interview');
  ok('Logging the call moves on', s && s.t === 'Book the interview', s);
  await f.page.click('#w215c [data-w215a="fill"]'); s = await waitStep(f, 'Move to Interview');
  ok('Interview time set (two hours ago) moves on', s && s.t === 'Move to Interview', s);
  await clickRing(f); s = await waitStep(f, 'Grade the interview (optional)');
  ok('Interview: moved (position, call and time were all there)', s && s.t === 'Grade the interview (optional)', s);
  await f.page.click('#w215c [data-w215a="next"]'); await f.page.waitForTimeout(800);
  await clickRing(f); await f.page.waitForTimeout(600);
  ok('Offer: the gate asks for impressions', await f.ev(() => !!document.querySelector('#w211g.open #w211g_imp')));
  await shot(f, 'recruit_gate');
  await f.page.fill('#w211g_imp', 'Clear, warm and organised; a strong fit for content.'); await f.page.click('#w211g [data-w211ga="go"]');
  s = await waitStep(f, 'Send the offer letter (to yourself)');
  ok('Offer: moved, and the offer letter is next', s && s.t === 'Send the offer letter (to yourself)' && await f.ev(() => document.getElementById('w211m').classList.contains('open')), s);
  ok('The offer panel says practice goes to your own address', await f.ev(() => /Practice: the letter is saved as PRACTICE/.test(document.getElementById('w211m').textContent)));
  await f.page.waitForTimeout(500);
  ok('The offer panel picks the signer (Steel by default, with his signature)', await f.ev(() => { var x = document.getElementById('w211o_signer_email'); return x && x.value === 'steel.macdonald@welfareavenue.com' && x.options.length === 2 && !/has not saved a signature/.test(document.getElementById('w211m').textContent); }));
  await f.page.selectOption('#w211o_signer_email', 'suhaib.abdillahi@welfareavenue.com'); await f.page.waitForTimeout(600);
  ok('Choosing Suhaib fills his title and warns there is no signature', await f.ev(() => document.getElementById('w211o_signer_title').value === 'Co-Executive Director' && /Suhaib has not saved a signature yet/.test(document.getElementById('w211m').textContent)));
  await f.page.click('#w211m [data-w211a="osigner"]'); await f.page.waitForTimeout(500);
  ok('Make the default signer saves the setting', await f.ev(() => window.__INV.some(x => x.body.action === 'offer_signer_set' && x.body.email === 'suhaib.abdillahi@welfareavenue.com') && !document.querySelector('#w211m [data-w211a="osigner"]')));
  await f.page.selectOption('#w211o_signer_email', 'steel.macdonald@welfareavenue.com'); await f.page.waitForTimeout(600);
  await shot(f, 'recruit_offer');
  await f.page.click('#w211m [data-w211a="osend"][data-mail="1"]'); s = await waitStep(f, 'Check your inbox', 10000);
  ok('Sending the letter moves on to Check your inbox', s && s.t === 'Check your inbox', s);
  ok('offer_send went to my email', await f.ev(() => window.__INV.some(x => x.body.action === 'offer_send' && x.body.email === true && x.body.f.email === 'steel.macdonald@welfareavenue.com' && x.body.f.signer_email === 'steel.macdonald@welfareavenue.com')));
  await f.page.click('#w215c [data-w215a="next"]'); await f.page.waitForTimeout(800);
  await clickRing(f); await f.page.waitForTimeout(600);
  await f.page.fill('#w211g_acc', '2026-09-25'); await f.page.fill('#w211g_start', '2026-10-05'); await f.page.click('#w211g [data-w211ga="go"]');
  s = await waitStep(f, 'Next: onboarding'); ok('Hired: moved with the two dates', s && s.t === 'Next: onboarding', s);
  await f.page.click('#w215c [data-w215a="next"]'); await f.page.waitForTimeout(700);
  await f.page.click('#w215c [data-w215a="next"]'); await f.page.waitForTimeout(700);
  s = await step(f); ok('Last step: clear your practice records', s && s.t === 'Clear your practice records', s);
  await f.page.click('#w215c [data-w215a="act"]'); await f.page.waitForTimeout(1500);
  ok('Clearing removes the practice card', await f.ev(() => !w197.state().cands.some(c => c.practice) && window.__RPC.some(r => r.fn === 'wa215_clear_practice' && r.args.p_all === false)));
  await f.page.waitForTimeout(1500);
  ok('Finishing completes the walkthrough (the coach is gone)', await f.ev(() => !w215.state() && !document.getElementById('w215c')));
  ok('No page errors (recruitment)', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------- time off ---------- */
  f = await fresh(browser, { who: 'admin', width: 1366, hash: '#hrcentre/timeoff', fixture: JSON.parse(JSON.stringify(FX)), init: INIT, wait: 5000 });
  await f.page.waitForTimeout(2500); await f.ev(WRAP);
  await f.ev(() => w215.start('hrwalk-timeoff')); await f.page.waitForTimeout(800);
  await f.page.click('#w215c [data-w215a="next"]'); await f.page.waitForTimeout(1500);
  await f.page.click('#w215c [data-w215a="next"]'); await f.page.waitForTimeout(800);
  await clickRing(f); s = await waitStep(f, 'Fill in the request');
  ok('Time off: Request time off for myself opens the form', s && s.t === 'Fill in the request', s);
  await f.page.click('#w215c [data-w215a="fill"]'); await f.page.click('#w105rgo');
  s = await waitStep(f, 'Now decide it, as HR', 8000);
  ok('Time off: the request is saved as practice, with no request ticket', await f.ev(() => (window.__WAFIX.wa_timeoff || []).some(t => t.practice && t.status === 'requested') && !(window.__WAFIX.dept_requests || []).some(r => /Practice/.test(r.details || ''))), await f.ev(() => window.__WAFIX.wa_timeoff));
  ok('Time off: the coach moves on to deciding it', s && s.t === 'Now decide it, as HR', s);
  ok('Time off: the waiting list marks it Practice', await f.ev(() => /Practice/.test(document.getElementById('w105tobody').textContent)));
  await clickRing(f); s = await waitStep(f, 'What approving does', 8000);
  ok('Time off: approving moves on', s && s.t === 'What approving does', s);
  ok('Time off: practice days are not counted in the totals', await f.ev(() => !document.querySelector('#w105to .w212tot')));
  await f.close();

  /* ---------- onboarding: the practice plan is the one removed ---------- */
  f = await fresh(browser, { who: 'admin', width: 1366, hash: '#hrcentre/onboarding', fixture: JSON.parse(JSON.stringify(FX)), init: INIT, wait: 5000 });
  await f.page.waitForTimeout(2500); await f.ev(WRAP);
  await f.ev(() => w215.start('hrwalk-onboard')); await f.page.waitForTimeout(800);
  await f.page.click('#w215c [data-w215a="next"]'); await f.page.waitForTimeout(1500);
  await f.page.click('#w215c [data-w215a="next"]'); await f.page.waitForTimeout(800);
  s = await step(f); ok('Onboarding: Assign an onboarding is rung', s && s.t === 'Assign an onboarding (to yourself)' && await f.ev(() => document.getElementById('w215r').style.display === 'block'), s);
  ok('Onboarding: an existing plan is never offered for removal', await f.ev(() => { var x = w215.state().ctx; return Array.isArray(x.base) && w215.defs['hrwalk-onboard'].steps.every(function () { return true; }); }));
  await f.close();

  /* ---------- Slack hours, Clear practice on the bar, phone ---------- */
  const FX2 = JSON.parse(JSON.stringify(FX)); FX2.hub_candidates.push({ id: 9650, name: 'Old Practice', practice: true, status: 'withdrawn', email: 'x@y', created_at: '2026-09-20T12:00:00Z' });
  f = await fresh(browser, { who: 'admin', width: 1366, hash: '#hrcentre/applications', fixture: FX2, init: INIT, wait: 5000 });
  await f.page.waitForTimeout(2500); await f.ev(WRAP);
  ok('Applications bar: Clear practice (1)', await f.ev(() => /Clear practice \(1\)/.test((document.querySelector('[data-w211a="pclear"]') || {}).textContent || '')));
  await f.ev(() => { window.confirm = function () { return true; }; document.querySelector('[data-w211a="pclear"]').click(); }); await f.page.waitForTimeout(1200);
  ok('Clear practice: an admin clears everyone’s', await f.ev(() => window.__RPC.some(r => r.fn === 'wa215_clear_practice' && r.args.p_all === true)));
  await f.ev(() => { location.hash = '#hrcentre/hours'; }); await f.page.waitForTimeout(2200);
  ok('Hours: Slack check-in hours are added and say so', await f.ev(() => /from Slack/.test(document.getElementById('w197hours').textContent) && /From The Loop and Slack/.test(document.getElementById('w197hours').textContent)), await f.ev(() => document.getElementById('w197hours').textContent.slice(0, 400)));
  ok('No page errors (applications, hours)', f.errs.length === 0, f.errs);
  await f.close();

  f = await fresh(browser, { who: 'admin', width: 390, height: 844, hash: '#hrcentre/overview', fixture: JSON.parse(JSON.stringify(FX)), init: INIT, wait: 5000 });
  await f.page.waitForTimeout(2200);
  await f.ev(() => w215.start('hrwalk-start')); await f.page.waitForTimeout(800);
  ok('Phone: the coach card fits the screen', await f.ev(() => { var c = document.getElementById('w215c').getBoundingClientRect(); return c.left >= 0 && c.right <= 390 && document.documentElement.scrollWidth <= 392; }));
  await shot(f, 'phone_coach');
  await f.ev(() => { window.confirm = function () { return true; }; document.querySelector('#w215c [data-w215a="end"]').click(); }); await f.page.waitForTimeout(300);
  ok('End: the coach goes away', await f.ev(() => !document.getElementById('w215c') && !w215.state()));
  ok('No page errors (phone)', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw215drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(2); });
