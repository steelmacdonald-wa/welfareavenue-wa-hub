/* w213drive.js: wave213, the due-date check pop-up. Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26).
   my_due_date_check is answered by window.__WA_RPCS; confirm_due_dates calls are recorded by wrapping db.rpc.
   CAND=<file>; SHOTS=1 saves screenshots in test/shots_w213/. */
const fs = require('fs');
const path = require('path');
const { launch, fresh } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }
const SHOTS = process.env.SHOTS ? path.join(__dirname, 'shots_w213') : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
async function shot(f, name) { if (SHOTS) await f.page.screenshot({ path: path.join(SHOTS, name + '.png') }); }

const ROWS = [
  { task_id: 701, title: 'Send the September newsletter <img src=x onerror="window.__XSS=1">', department: 'marketing', owner: 'Ian', due_date: '2026-09-20', why: 'overdue', meeting_title: 'Marketing Meeting - September 16, 2026', meeting_date: '2026-09-16', next_meeting: '2026-09-30', following_meeting: '2026-10-07', suggested: '2026-09-30' },
  { task_id: 702, title: 'Book the photographer', department: 'marketing', owner: 'Ian', due_date: '2026-09-22', why: 'overdue', meeting_title: null, meeting_date: null, next_meeting: '2026-09-30', following_meeting: '2026-10-07', suggested: '2026-09-30' },
  { task_id: 703, title: 'Draft the October content calendar', department: 'marketing', owner: 'Ian', due_date: null, why: 'no_date', meeting_title: 'Marketing Meeting - September 23, 2026', meeting_date: '2026-09-23', next_meeting: '2026-09-30', following_meeting: '2026-10-07', suggested: '2026-09-30' },
  { task_id: 705, title: 'Old idea nobody owns any more', department: 'marketing', owner: 'Ian', due_date: null, why: 'no_date', meeting_title: null, meeting_date: null, next_meeting: '2026-09-30', following_meeting: '2026-10-07', suggested: '2026-09-30' },
  { task_id: 704, title: 'Plan the Rally Paper recap post', department: 'marketing', owner: 'Ian', due_date: '2026-10-02', why: 'meeting_set', meeting_title: 'Marketing Meeting - September 23, 2026', meeting_date: '2026-09-23', next_meeting: '2026-09-30', following_meeting: '2026-10-07', suggested: '2026-09-30' }
];
const WRAP = `window.__213calls = []; window.__213fail = 0; (function () { var orig = db.rpc.bind(db); db.rpc = function (fn, args) { if (fn === 'confirm_due_check') { window.__213calls.push(args); if (window.__213fail-- > 0) return Promise.resolve({ data: null, error: { message: 'network' } }); return Promise.resolve({ data: { saved: (args.p || []).length, skipped: [] }, error: null }); } return orig(fn, args); }; })();`;

(async () => {
  const browser = await launch();
  const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#home', wait: 4500, rpcs: { wa_org_editor: true, my_due_date_check: ROWS } });
  const p = f.page;
  await p.waitForTimeout(2500);
  const a = await p.evaluate(() => { const el = document.getElementById('w213pop'); if (!el) return null; return {
    title: el.querySelector('h2').textContent, lead: el.querySelector('.lead').textContent, heads: [...el.querySelectorAll('h3')].map(h => h.textContent),
    rows: [...el.querySelectorAll('[data-w213row]')].map(r => ({ id: r.getAttribute('data-w213row'), t: r.querySelector('.t').textContent, m: r.querySelector('.m').textContent, date: (r.querySelector('input[type=date]') || {}).value, chips: [...r.querySelectorAll('.chip')].map(c => c.textContent + (c.classList.contains('on') ? '*' : '')), seg: [...r.querySelectorAll('.seg button')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')) })),
    save: el.querySelector('[data-w213save]').textContent, later: !!el.querySelector('[data-w213later]'), close: !!el.querySelector('[aria-label=Close], .x'), modal: el.querySelector('[role=dialog]').getAttribute('aria-modal'), xss: !!window.__XSS }; });
  ok('the pop-up opens on arriving', !!a, a);
  if (a) {
    ok('title and what is asked', a.title === 'Check your due dates' && /2 overdue, 2 with no due date, 1 dated by a meeting/.test(a.lead) && /mark it done, put it in the task bank for later, or discard it/.test(a.lead), a.lead);
    ok('three groups in order', a.heads.join('|') === 'Overdue: done, or push to a realistic date|No due date yet|Dates a meeting set: do they make sense?', a.heads);
    const r1 = a.rows.find(r => r.id === '701'), r3 = a.rows.find(r => r.id === '703'), r4 = a.rows.find(r => r.id === '704');
    ok('overdue: was due, where it came from, Done / Still open (open picked), pushed to the next meeting', r1 && /was due Sep 20/.test(r1.m) && /from Marketing Meeting - September 16, 2026/.test(r1.m) && r1.seg.join('|') === 'Keep, push to*|Done|To the bank|Discard' && r1.date === '2026-09-30' && /^Next meeting/.test(r1.chips[0]) && /\*$/.test(r1.chips[0]), r1);
    ok('no date: the best guess filled in, the four choices', r3 && r3.date === '2026-09-30' && r3.seg.join('|') === 'Keep*|Done|To the bank|Discard', r3);
    ok('a date the meeting set stays as set', r4 && r4.date === '2026-10-02' && /the meeting set Oct 2/.test(r4.m), r4);
    ok('no way to close it: no x, no Try again later yet, modal', !a.close && !a.later && a.modal === 'true', a);
    ok('titles escaped', !a.xss && /<img/.test(r1.t), a.xss);
    ok('Save names what will happen', a.save === 'Save: 5 dates', a.save);
  }
  await shot(f, '1_pop');
  /* Escape and a click outside do nothing */
  await p.keyboard.press('Escape');
  await p.mouse.click(5, 5);
  await p.waitForTimeout(200);
  ok('Escape and a click outside leave it open', await p.evaluate(() => !!document.getElementById('w213pop')));
  /* change things: 701 done, 702 following, 703 a typed date */
  await p.evaluate(WRAP);
  await p.click('[data-w213act="701"][data-a="done"]');
  await p.click('[data-w213row="702"] .chip:nth-of-type(2)');
  await p.evaluate(() => { const i = document.querySelector('[data-w213date="703"]'); i.value = '2026-10-10'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  const b = await p.evaluate(() => ({ r1: !!document.querySelector('[data-w213row="701"].isdone') && !document.querySelector('[data-w213date="701"]'), d2: document.querySelector('[data-w213date="702"]').value, d3: document.querySelector('[data-w213date="703"]').value }));
  ok('Done hides the date; Following sets the one after; a typed date sticks', b.r1 && b.d2 === '2026-10-07' && b.d3 === '2026-10-10', b);
  await p.click('[data-w213act="704"][data-a="bank"]');
  await p.click('[data-w213act="705"][data-a="discard"]');
  const bk = await p.evaluate(() => ({ until: (document.querySelector('[data-w213bank="704"]') || {}).value, noDue: !document.querySelector('[data-w213date="704"]'), disc: !!document.querySelector('[data-w213row="705"].a-discard') && /deleted/.test(document.querySelector('[data-w213row="705"] .hint').textContent), save: document.querySelector('[data-w213save]').textContent }));
  ok('To the bank asks for the day it comes back (3 months out); Discard warns it is deleted', bk.until === '2026-12-24' && bk.noDue && bk.disc, bk);
  ok('Save says what will happen', bk.save === 'Save: 2 dates, 1 done, 1 to the bank, 1 discarded', bk.save);
  await shot(f, '2_edited');
  /* a past date is refused */
  await p.evaluate(() => { const i = document.querySelector('[data-w213date="702"]'); i.value = '2026-09-01'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.click('[data-w213save]');
  await p.waitForTimeout(200);
  const c = await p.evaluate(() => ({ err: (document.querySelector('#w213pop .err') || {}).textContent, calls: window.__213calls.length, open: !!document.getElementById('w213pop') }));
  ok('a past date is refused before saving', /already past/.test(c.err || '') && c.calls === 0 && c.open, c);
  await p.evaluate(() => { const i = document.querySelector('[data-w213date="702"]'); i.value = '2026-10-07'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  /* a failed save keeps it open and then offers Try again later */
  await p.evaluate(() => { window.__213fail = 1; });
  await p.click('[data-w213save]');
  await p.waitForTimeout(300);
  const d = await p.evaluate(() => ({ err: (document.querySelector('#w213pop .err') || {}).textContent, later: !!document.querySelector('[data-w213later]'), open: !!document.getElementById('w213pop') }));
  ok('a failed save says so, stays open, and only then offers Try again later', /did not save/.test(d.err || '') && d.later && d.open, d);
  await p.click('[data-w213save]');
  await p.waitForTimeout(400);
  const e = await p.evaluate(() => ({ open: !!document.getElementById('w213pop'), last: window.__213calls[window.__213calls.length - 1], toast: (document.getElementById('toast') || {}).textContent }));
  ok('Save sends each task: done, dates, discard, bank', e.last && JSON.stringify(e.last.p) === JSON.stringify([{ id: 701, action: 'done' }, { id: 702, due: '2026-10-07' }, { id: 703, due: '2026-10-10' }, { id: 705, action: 'discard' }, { id: 704, action: 'bank', until: '2026-12-24' }]), e.last);
  ok('then closes and says what was saved', !e.open && /Saved: 2 due dates, 1 done, 1 to the bank, 1 discarded\./.test(e.toast || ''), e);
  ok('no page errors', f.errs.length === 0, f.errs);
  await f.page.context().close();

  /* nothing to check: no pop-up */
  const g = await fresh(browser, { who: 'admin', width: 1366, hash: '#home', wait: 4500, rpcs: { wa_org_editor: true, my_due_date_check: [] } });
  await g.page.waitForTimeout(2500);
  ok('nothing to check: no pop-up', await g.page.evaluate(() => !document.getElementById('w213pop')));
  await g.page.context().close();

  /* a phone */
  const h = await fresh(browser, { who: 'admin', width: 390, hash: '#home', wait: 4500, rpcs: { wa_org_editor: true, my_due_date_check: ROWS } });
  await h.page.waitForTimeout(2500);
  const ph = await h.page.evaluate(() => { const d = document.querySelector('#w213pop .dlg'); return d ? { w: d.getBoundingClientRect().width, vw: innerWidth, doc: document.documentElement.scrollWidth, save: !!document.querySelector('#w213pop [data-w213save]').getBoundingClientRect().height } : null; });
  ok('phone: full width, no sideways scroll, Save in reach', ph && ph.w <= ph.vw && ph.doc <= ph.vw + 1 && ph.save, ph);
  await shot(h, '3_phone');
  ok('phone: no page errors', h.errs.length === 0, h.errs);
  await h.page.context().close();

  await browser.close();
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
