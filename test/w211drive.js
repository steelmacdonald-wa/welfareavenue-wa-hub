/* w211drive.js: wave211, recruitment: stage gates (w211g), the still-interested text, the offer letter at Offer, the CV box.
   Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26 16:00 Toronto). recruit-actions is answered by window.__WA_INVOKE.
   CAND=<file>; SHOTS=1 saves screenshots in test/shots_w211/. */
const fs = require('fs');
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }
const SHOTS = process.env.SHOTS ? path.join(__dirname, 'shots_w211') : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
async function shot(f, name, full) { if (SHOTS) await f.page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!full }); }

function fixture() {
  const FX = loadFixture();
  const now = '2026-09-20T12:00:00Z';
  FX.hub_positions = [
    { id: 35, title: 'Operations Manager', dept: 'opsmtl', folder_id: 'F35', resumes_id: 'R35', stage: 'interviewing', gone: false },
    { id: 5, title: 'Kitchen Coordinator', dept: 'opsto', folder_id: 'F5', resumes_id: 'R5', stage: 'offer', gone: false }
  ];
  FX.hub_position_files = []; FX.hub_position_people = []; FX.hub_candidate_grades = []; FX.hub_candidate_interviews = [];
  FX.hub_candidate_calls = [{ id: 1, candidate_id: 9403, outcome: 'reached', by_name: 'Valex', called_at: '2026-09-21T15:00:00Z', stage: 'reviewing' }];
  FX.hub_candidates = [
    { id: 9401, name: 'Nadia New', role: 'Operations Manager', status: 'new', phone: '514 555 0101', source: 'email', created_at: now },
    { id: 9402, name: 'Ravi Review', role: 'Operations Manager', status: 'reviewing', owner: 'Steel MacDonald', phone: '514 555 0102', source: 'email', created_at: now },
    { id: 9403, name: 'Ines Ready', role: 'Operations Manager', position_id: 35, status: 'reviewing', owner: 'Steel MacDonald', interview_at: '2026-09-23T18:00:00Z', email: 'ines@example.com', source: 'email', created_at: now },
    { id: 9404, name: 'Omar Offer', role: 'Kitchen Coordinator', position_id: 5, status: 'offer', owner: 'Steel MacDonald', interview_at: '2026-09-22T18:00:00Z', email: 'omar@example.com', impressions: 'Strong, warm, organised.', source: 'email', created_at: now },
    { id: 9405, name: 'Fay Future', role: 'Kitchen Coordinator', position_id: 5, status: 'interview', owner: 'Steel MacDonald', interview_at: '2026-10-02T18:00:00Z', source: 'email', created_at: now },
    { id: 9406, name: 'Nick Nobody', role: 'Operations Manager', status: 'new', source: 'email', created_at: now }
  ];
  FX.hub_candidate_calls.push({ id: 3, candidate_id: 9404, outcome: 'reached', by_name: 'Valex', called_at: '2026-09-20T15:00:00Z', stage: 'reviewing' });
  FX.hub_candidate_calls.push({ id: 2, candidate_id: 9405, outcome: 'reached', by_name: 'Valex', called_at: '2026-09-21T15:00:00Z', stage: 'reviewing' });
  return FX;
}
const INIT = `window.__INV = []; window.__WA_INVOKE = function (name, opts) { var b = (opts && opts.body) || {}; window.__INV.push({ name: name, body: b });
  if (name !== 'recruit-actions') return { data: null, error: null };
  if (b.action === 'quo_calls') return { data: { ok: true, phone: '+15145550102', calls: [
    { id: 'AC1', at: '2026-09-24T14:00:00Z', direction: 'outgoing', status: 'completed', duration: 420, line: 'Ops', answered: true, summary: 'Talked about the role; free on Tuesdays.', logged: false },
    { id: 'AC2', at: '2026-09-23T14:00:00Z', direction: 'outgoing', status: 'no-answer', duration: 0, line: 'Ops', answered: false, logged: false } ] }, error: null };
  if (b.action === 'quo_log') return { data: { ok: true, call: { id: 77, candidate_id: b.id, outcome: 'reached', quo_call_id: b.call_id, summary: 'Talked about the role', transcript: 'Us: hi', called_at: '2026-09-24T14:00:00Z' } }, error: null };
  if (b.action === 'offer_preview') return { data: { ok: true, html: '<p>Letter</p>', role: 'Operations Manager', mail_mode: 'test', test_to: 'test@x', signer: 'Steel', signer_title: 'Chair' }, error: null };
  return { data: { ok: true }, error: null }; };`;
const cand = (id) => `w197.state().cands.filter(function (c) { return c.id === ${id}; })[0]`;

(async () => {
  const browser = await launch();
  const FX = fixture();
  let f = await fresh(browser, { who: 'admin', width: 1440, hash: '#hrcentre/applications', fixture: JSON.parse(JSON.stringify(FX)), init: INIT, wait: 5000 });
  await f.page.waitForTimeout(2000);
  ok('w211 and the gates are loaded', await f.ev(() => !!window.w211 && !!window.w211g && typeof w197.moveTo === 'function'));
  ok('Rules: New to Reviewing needs Handled by', await f.ev(() => w211g.missing(w197.state().cands.filter(c => c.id === 9401)[0], 'reviewing').join() === 'owner'));
  ok('Rules: New to Offer needs everything before it', await f.ev(() => w211g.missing(w197.state().cands.filter(c => c.id === 9401)[0], 'offer').join() === 'owner,position_id,call,interview_at,email,impressions'));
  ok('Rules: moving back a stage asks nothing', await f.ev(() => w211g.missing(w197.state().cands.filter(c => c.id === 9404)[0], 'reviewing').length === 0));
  ok('Rules: closing always needs a reason', await f.ev(() => w211g.missing(w197.state().cands.filter(c => c.id === 9404)[0], 'declined').join() === 'reason'));

  /* New -> Reviewing */
  f.ev(() => { w197.moveTo(9401, 'reviewing'); }); await f.page.waitForTimeout(400);
  ok('Reviewing: the gate opens asking only for Handled by', await f.ev(() => { var g = document.getElementById('w211g'); return g && g.classList.contains('open') && !!g.querySelector('#w211g_owner') && !g.querySelector('#w211g_pos') && /who handles them/.test(g.textContent); }));
  await shot(f, 'gate_reviewing');
  await f.page.click('#w211g [data-w211ga="go"]'); await f.page.waitForTimeout(200);
  ok('Reviewing: it will not move without Handled by', await f.ev((s) => eval(s).status === 'new' && /Still needed: who handles them/.test(document.getElementById('w211g').textContent), cand(9401)));
  await f.page.click('#w211g [data-w211ga="cancel"]'); await f.page.waitForTimeout(300);
  ok('Reviewing: Cancel leaves the card where it was', await f.ev((s) => eval(s).status === 'new' && !document.getElementById('w211g').classList.contains('open'), cand(9401)));
  f.ev(() => { w197.moveTo(9401, 'reviewing'); }); await f.page.waitForTimeout(400);
  const owner = await f.ev(() => { var o = Array.from(document.querySelectorAll('#w211g_owner option')).map(x => x.value).filter(Boolean); return o[0]; });
  await f.page.selectOption('#w211g_owner', owner); await f.page.click('#w211g [data-w211ga="go"]'); await f.page.waitForTimeout(500);
  ok('Reviewing: with Handled by, it moves and saves the handler', await f.ev((a) => { var c = eval(a[0]); return c.status === 'reviewing' && c.owner === a[1]; }, [cand(9401), owner]));

  /* Reviewing -> Interview: position, call from Quo, day and time */
  f.ev(() => { w197.moveTo(9402, 'interview'); }); await f.page.waitForTimeout(400);
  ok('Interview: asks for the position, the call log and the day and time (not Handled by, already set)', await f.ev(() => { var g = document.getElementById('w211g'); return !!g.querySelector('#w211g_pos') && !!g.querySelector('[data-w211ga="quo"]') && !!g.querySelector('#w211g_iv') && !g.querySelector('#w211g_owner'); }));
  await f.page.click('#w211g [data-w211ga="quo"]'); await f.page.waitForTimeout(400);
  ok('Interview: Quo calls are listed with their summary', await f.ev(() => { var g = document.getElementById('w211g'); return g.querySelectorAll('.w211gq li').length === 2 && /free on Tuesdays/.test(g.textContent) && window.__INV.some(x => x.body.action === 'quo_calls' && x.body.id === 9402); }));
  await shot(f, 'gate_interview_quo');
  await f.page.click('#w211g [data-w211gq="AC1"]'); await f.page.waitForTimeout(400);
  ok('Interview: Use this call logs it through quo_log and it counts', await f.ev(() => window.__INV.some(x => x.body.action === 'quo_log' && x.body.call_id === 'AC1' && x.body.id === 9402) && w199.state().calls.some(k => k.candidate_id === 9402 && k.quo_call_id === 'AC1') && /Logged/.test(document.querySelector('#w211g .w211gq').textContent)));
  await f.page.selectOption('#w211g_pos', '35'); await f.page.fill('#w211g_iv', '2026-09-29T14:30'); await f.page.click('#w211g [data-w211ga="go"]'); await f.page.waitForTimeout(500);
  ok('Interview: it moves with the position and the interview time', await f.ev((s) => { var c = eval(s); return c.status === 'interview' && c.position_id === 35 && c.role === 'Operations Manager' && /^2026-09-29T18:30/.test(c.interview_at); }, cand(9402)));

  /* a card with everything moves at once */
  await f.ev(() => w197.moveTo(9403, 'interview')); await f.page.waitForTimeout(400);
  ok('Interview: a card with everything moves straight away (no form)', await f.ev((s) => eval(s).status === 'interview' && !document.getElementById('w211g').classList.contains('open'), cand(9403)));

  /* Interview -> Offer: impressions; a future interview must have happened; the offer letter opens after */
  f.ev(() => { w197.moveTo(9405, 'offer'); }); await f.page.waitForTimeout(400);
  ok('Offer: asks for the email, the impressions, and flags an interview that has not happened yet', await f.ev(() => { var g = document.getElementById('w211g'); return !!g.querySelector('#w211g_email') && !!g.querySelector('#w211g_imp') && /has not happened yet/.test(g.textContent); }));
  await f.page.fill('#w211g_email', 'fay@example'); await f.page.fill('#w211g_imp', 'Thoughtful and organised, a good fit for the team.'); await f.page.fill('#w211g_iv', '2026-09-24T10:00');
  await f.page.click('#w211g [data-w211ga="go"]'); await f.page.waitForTimeout(300);
  ok('Offer: a bad email is refused', await f.ev(() => /email does not look right/.test(document.getElementById('w211g').textContent)));
  await f.page.fill('#w211g_email', 'fay@example.com'); await f.page.click('#w211g [data-w211ga="go"]'); await f.page.waitForTimeout(700);
  ok('Offer: it moves with the email, impressions and the corrected time', await f.ev((s) => { var c = eval(s); return c.status === 'offer' && c.email === 'fay@example.com' && /good fit/.test(c.impressions) && /^2026-09-24T14:00/.test(c.interview_at); }, cand(9405)));
  ok('Offer: the offer letter opens next', await f.ev(() => { var m = document.getElementById('w211m'); return m && m.classList.contains('open') && /Send the offer letter to Fay Future/.test(m.textContent); }));
  await shot(f, 'offer_letter');
  await f.ev(() => { var m = document.getElementById('w211m'); if (m) m.classList.remove('open'); });

  /* Offer -> Hired */
  f.ev(() => { w197.moveTo(9404, 'hired'); }); await f.page.waitForTimeout(400);
  ok('Hired: asks for the offer letter, the day they accepted and the start date', await f.ev(() => { var g = document.getElementById('w211g'); return !!g.querySelector('[data-w211ga="offer"]') && !!g.querySelector('#w211g_acc') && !!g.querySelector('#w211g_start'); }));
  await f.page.check('#w211g [data-w211gf="offer_outside"]'); await f.page.waitForTimeout(150);
  await f.page.fill('#w211g_acc', '2026-09-24'); await f.page.fill('#w211g_start', '2026-09-20'); await f.page.click('#w211g [data-w211ga="go"]'); await f.page.waitForTimeout(300);
  ok('Hired: a start date before the acceptance is refused', await f.ev(() => /start date is before/.test(document.getElementById('w211g').textContent)));
  await f.page.fill('#w211g_start', '2026-10-05'); await f.page.click('#w211g [data-w211ga="go"]'); await f.page.waitForTimeout(500);
  ok('Hired: it moves with the dates', await f.ev((s) => { var c = eval(s); return c.status === 'hired' && c.accepted_on === '2026-09-24' && c.start_date === '2026-10-05'; }, cand(9404)), await f.ev((s) => ({ c: eval(s), g: document.getElementById('w211g').textContent.slice(0, 400), v: w211g.state().v }), cand(9404)));

  /* Declined: a reason; Other needs a note */
  f.ev(() => { w197.moveTo(9406, 'declined'); }); await f.page.waitForTimeout(400);
  await f.page.selectOption('#w211g_reason', 'Other'); await f.page.waitForTimeout(150); await f.page.click('#w211g [data-w211ga="go"]'); await f.page.waitForTimeout(200);
  ok('Declined: Other needs a note', await f.ev((s) => eval(s).status === 'new' && /Say why in the note/.test(document.getElementById('w211g').textContent), cand(9406)));
  await f.page.fill('#w211g_rnote', 'Looking for full-time pay'); await f.page.click('#w211g [data-w211ga="go"]'); await f.page.waitForTimeout(500);
  ok('Declined: it closes with the reason saved', await f.ev((s) => { var c = eval(s); return c.status === 'declined' && c.close_reason === 'Other: Looking for full-time pay'; }, cand(9406)));
  await f.ev(() => w197.openSheet(9406)); await f.page.waitForTimeout(300);
  ok('Sheet: the reason shows on a closed card', await f.ev(() => /Why closed\s*Other: Looking for full-time pay/.test(document.getElementById('w197sheet').textContent)));
  await f.ev(() => w197.openSheet(9405)); await f.page.waitForTimeout(300);
  ok('Sheet: interview impressions show, and the offer box', await f.ev(() => { var t = document.getElementById('w197sheet').textContent; return /Interview impressions/.test(t) && /Offer letter/.test(t); }));
  ok('Card: Offer not sent shows on the board', await f.ev(() => /Offer not sent/.test((document.querySelector('#w197board [data-w197c="9405"]') || {}).textContent || '')));
  await f.ev(() => { var s = document.getElementById('w197sheet'); if (s) s.classList.remove('open'); });

  /* backward: no form */
  await f.ev(() => w197.moveTo(9405, 'interview')); await f.page.waitForTimeout(400);
  ok('Back a stage: moves without a form', await f.ev((s) => eval(s).status === 'interview' && !document.getElementById('w211g').classList.contains('open'), cand(9405)));

  /* the selection bar: ready ones move, the rest are listed */
  await f.ev(() => { var st = w199.state(); st.sel = {}; st.sel[9401] = true; st.sel[9403] = true; st.sel[9402] = true; });
  await f.ev(() => { var c = w197.state().cands.filter(x => x.id === 9401)[0]; c.status = 'new'; });
  f.ev(() => { w199.bulkApply('status', 'interview'); }); await f.page.waitForTimeout(400);
  ok('Bulk: the cards missing something are listed with what they need', await f.ev(() => { var g = document.getElementById('w211g'); return g.classList.contains('open') && /Nadia New/.test(g.textContent) && /needs .*the position/.test(g.textContent) && !g.querySelector('[data-w211ga="go"]'); }), await f.ev(() => document.getElementById('w211g').textContent.slice(0, 300)));
  await shot(f, 'bulk');
  await f.page.click('#w211g [data-w211ga="cancel"]'); await f.page.waitForTimeout(300);
  ok('Bulk: Cancel moves nothing', await f.ev((s) => eval(s).status === 'new', cand(9401)));
  await f.ev(() => { var st = w199.state(); st.sel = {}; st.sel[9401] = true; st.sel[9402] = true; });
  f.ev(() => { w199.bulkApply('status', 'withdrawn'); }); await f.page.waitForTimeout(400);
  ok('Bulk: closing several asks one reason', await f.ev(() => !!document.querySelector('#w211g #w211g_reason')));
  await f.page.selectOption('#w211g_reason', 'Took another role'); await f.page.click('#w211g [data-w211ga="go"]'); await f.page.waitForTimeout(600);
  ok('Bulk: both close with the reason', await f.ev((a) => { var x = eval(a[0]), y = eval(a[1]); return x.status === 'withdrawn' && y.status === 'withdrawn' && x.close_reason === 'Took another role'; }, [cand(9401), cand(9402)]));
  ok('No page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* phone width: the gate fits */
  f = await fresh(browser, { who: 'admin', width: 390, height: 844, hash: '#hrcentre/applications', fixture: JSON.parse(JSON.stringify(FX)), init: INIT, wait: 5000 });
  await f.page.waitForTimeout(1800);
  f.ev(() => { w197.moveTo(9402, 'interview'); }); await f.page.waitForTimeout(400);
  ok('Phone: the gate fits the screen', await f.ev(() => { var p = document.querySelector('#w211g .pn'); return p && p.getBoundingClientRect().width <= 390 && document.documentElement.scrollWidth <= 392; }));
  await shot(f, 'phone_gate');
  ok('Phone: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw211drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(2); });
