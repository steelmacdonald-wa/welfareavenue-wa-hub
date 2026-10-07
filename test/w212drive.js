/* w212drive.js: wave212, the HR centre: brighter colours (HR centre only), the bell, time off that works.
   Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26 16:00 Toronto). CAND=<file>; SHOTS=1 saves screenshots. */
const fs = require('fs');
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }
const SHOTS = process.env.SHOTS ? path.join(__dirname, 'shots_w212') : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
async function shot(f, name, full) { if (SHOTS) await f.page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!full }); }

function fixture() {
  const FX = loadFixture();
  const now = '2026-09-24T12:00:00Z';
  FX.wa_timeoff = [
    { id: 1, email: 'amanda.zoldak@welfareavenue.com', name: 'Amanda', category: 'vacation', start_date: '2026-10-12', end_date: '2026-10-16', days: 5, status: 'requested', note: 'family trip', created_at: '2026-09-25T13:00:00Z' },
    { id: 2, email: 'samson.jules@welfareavenue.com', name: 'Samson', category: 'sick', start_date: '2026-09-02', end_date: '2026-09-03', days: 2, status: 'approved', created_at: '2026-09-01T12:00:00Z' },
    { id: 3, email: 'shima.butera@welfareavenue.com', name: 'Shima', category: 'sick', start_date: '2026-09-10', end_date: '2026-09-15', days: 6, status: 'approved', created_at: '2026-09-09T12:00:00Z' },
    { id: 4, email: 'shima.butera@welfareavenue.com', name: 'Shima', category: 'vacation', start_date: '2026-10-01', end_date: '2026-10-02', days: 2, status: 'approved', created_at: '2026-09-20T12:00:00Z' }
  ];
  FX.hub_candidate_calls = [];
  FX.hub_candidates = [
    { id: 9501, name: 'Nora New', role: 'Operations Manager', status: 'new', source: 'email', created_at: '2026-09-25T10:00:00Z' },
    { id: 9502, name: 'Ivan Interview', role: 'Operations Manager', status: 'interview', owner: 'Steel MacDonald', interview_at: '2026-09-26T15:00:00Z', created_at: now, stage_at: '2026-09-25T12:00:00Z' },
    { id: 9503, name: 'Olga Offer', role: 'Operations Manager', status: 'offer', owner: 'Steel MacDonald', created_at: now, stage_at: '2026-09-25T11:00:00Z' },
    { id: 9504, name: 'Rita Review', role: 'Operations Manager', status: 'reviewing', owner: 'Steel MacDonald', created_at: now, stage_at: '2026-09-25T09:00:00Z' }
  ];
  return FX;
}
const INIT = 'window.__WA_RPCS = { wa_can_timeoff: true };';

(async () => {
  const browser = await launch();
  const FX = fixture();
  let f = await fresh(browser, { who: 'admin', width: 1440, hash: '#hrcentre/applications', fixture: JSON.parse(JSON.stringify(FX)), init: INIT, wait: 5000 });
  await f.page.waitForTimeout(2500);
  ok('w212 is loaded', await f.ev(() => !!window.w212 && !!document.getElementById('w212css')));
  const col = await f.ev(() => { var c = document.querySelector('#hrcentre .w197col[data-w197col="interview"]'); if (!c) return null; var s = getComputedStyle(c); return { top: s.borderTopColor, w: s.borderTopWidth, card: getComputedStyle(c.querySelector('.w197cand') || c).borderLeftColor }; });
  ok('Colours: each stage column has its colour (Interview purple)', col && col.top === 'rgb(111, 100, 171)' && col.w === '4px' && col.card === 'rgb(111, 100, 171)', col);
  ok('Colours: only inside the HR centre (no rule outside #hrcentre for the board)', await f.ev(() => !/(^|\})\s*\.w197col\[/.test(document.getElementById('w212css').textContent)));
  /* the bell */
  await f.ev(() => { try { w197.show && w197.show('applications'); } catch (e) { /* fine */ } });
  await f.page.waitForTimeout(400);
  const bell = await f.ev(() => { var b = document.getElementById('w212bell'); return b ? { lab: b.getAttribute('aria-label'), n: (b.querySelector('.w212n') || {}).textContent || '' } : null; });
  ok('Bell: in the masthead with a count', bell && /Notifications: \d+ things need you/.test(bell.lab) && Number(bell.n) >= 3, bell);
  const its = await f.ev(() => w212.items().map(i => i.k + ':' + i.t));
  ok('Bell: a new application, a call to make, an interview tomorrow, an offer to send', its.some(s => /^new:New application: Nora New/.test(s)) && its.some(s => /^call:Call Rita Review/.test(s)) && its.some(s => /^iv:Interview: Ivan Interview/.test(s)) && its.some(s => /^offer:Send the offer letter to Olga Offer/.test(s)), its);
  await f.page.click('#w212bell'); await f.page.waitForTimeout(300);
  ok('Bell: opens the list and clears the count', await f.ev(() => document.getElementById('w212box').classList.contains('open') && !document.querySelector('#w212bell .w212n')));
  await shot(f, 'bell');
  await f.page.click('#w212box button.w212k-offer'); await f.page.waitForTimeout(600);
  ok('Bell: a line opens the card', await f.ev(() => document.getElementById('w197sheet').classList.contains('open') && /Olga Offer/.test(document.querySelector('#w197sheet h3').textContent) && !document.getElementById('w212box').classList.contains('open')));
  await f.ev(() => { var s = document.getElementById('w197sheet'); if (s) s.classList.remove('open'); });
  ok('No page errors (applications)', f.errs.length === 0, f.errs);

  /* time off */
  await f.hash('#hrcentre/timeoff', 2500);
  const to = await f.ev(() => { var c = document.getElementById('w105to'); return c ? c.textContent : null; });
  ok('Time off: the request waits with Approve and Decline', /Waiting on a decision \(1\)/.test(to || ''), (to || '').slice(0, 200));
  ok('Time off: totals with a Total and sick days left of 7', /Total/.test(to) && /Sick days left/.test(to) && /1 of 7/.test(to) && /5 of 7/.test(to), (to || '').slice(0, 600));
  ok('Time off: the low one is flagged', await f.ev(() => !!document.querySelector('#w105to td.w212low')));
  ok('Time off: recent decisions fold open', await f.ev(() => !!document.querySelector('#w105to details.w212past')));
  await shot(f, 'timeoff', true);
  await f.page.click('#hrcentre .w197pact[data-w197main="logto"]'); await f.page.waitForTimeout(500);
  ok('Log time off: the masthead button opens a form (not just the cursor)', await f.ev(() => !!document.getElementById('w212lp') && !!document.getElementById('w212ls') && !!document.getElementById('w212lst')));
  await f.ev(() => { window.__INS = []; var from = db.from.bind(db); db.from = function (t) { var q = from(t); var ins = q.insert && q.insert.bind(q); if (ins) q.insert = function (p) { window.__INS.push({ t: t, p: p }); return ins(p); }; return q; }; });
  await f.page.click('#w212lgo'); await f.page.waitForTimeout(200);
  ok('Log time off: needs the person', await f.ev(() => window.__INS.length === 0 && !!document.getElementById('w212lp')));
  await f.ev(() => { var s = document.getElementById('w212lp'); s.selectedIndex = 1; });
  await f.page.fill('#w212ls', '2026-11-02'); await f.page.dispatchEvent('#w212ls', 'change'); await f.page.fill('#w212le', '2026-11-04'); await f.page.dispatchEvent('#w212le', 'change');
  ok('Log time off: says how many days', await f.ev(() => /3 days/.test(document.getElementById('w212ldays').textContent)));
  await f.page.click('#w212lgo'); await f.page.waitForTimeout(500);
  const ins = await f.ev(() => window.__INS.filter(x => x.t === 'wa_timeoff').map(x => x.p));
  ok('Log time off: saved as approved, with the days', ins.length === 1 && ins[0].status === 'approved' && ins[0].days === 3 && ins[0].start_date === '2026-11-02' && !!ins[0].decided_by, ins);
  /* decline needs a reason */
  await f.ev(() => { window.__UPD = []; var from = db.from.bind(db); db.from = function (t) { var q = from(t); var up = q.update && q.update.bind(q); if (up) q.update = function (p) { window.__UPD.push({ t: t, p: p }); return up(p); }; return q; }; window.prompt = function () { return 'Busy week for the team'; }; });
  await f.page.click('#w105to [data-w105de="1"]'); await f.page.waitForTimeout(500);
  const up = await f.ev(() => window.__UPD.filter(x => x.t === 'wa_timeoff').map(x => x.p));
  ok('Decline: saves the reason', up.length === 1 && up[0].status === 'declined' && up[0].decline_reason === 'Busy week for the team', up);
  ok('No page errors (time off)', f.errs.length === 0, f.errs);
  await f.close();

  /* an HR member (the HR access profile, not on the HR access list) sees Time off */
  f = await fresh(browser, { who: 'member', width: 1366, hash: '#hrcentre/timeoff', fixture: JSON.parse(JSON.stringify(FX)), init: INIT, wait: 5000 });
  await f.page.waitForTimeout(2500);
  ok('HR member: Time off shows (wa_can_timeoff)', await f.ev(() => { var c = document.getElementById('w105to'); return !!c && !!c.offsetParent; }));
  ok('HR member: policies and the tracker stay with the HR access list', await f.ev(() => !document.getElementById('w105disc')));
  ok('No page errors (member)', f.errs.length === 0, f.errs);
  await f.close();

  /* phone */
  f = await fresh(browser, { who: 'admin', width: 390, height: 844, hash: '#hrcentre/applications', fixture: JSON.parse(JSON.stringify(FX)), init: INIT, wait: 5000 });
  await f.page.waitForTimeout(2200);
  await f.ev(() => { var b = document.getElementById('w212bell'); if (b) b.click(); }); await f.page.waitForTimeout(300);
  ok('Phone: the bell list fits', await f.ev(() => { var b = document.getElementById('w212box'); if (!b) return false; var r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= 390 && document.documentElement.scrollWidth <= 392; }));
  await shot(f, 'phone_bell');
  ok('No page errors (phone)', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw212drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(2); });
