/* w210drive.js: wave210, the Transcript archive shows the tasks a recent meeting made, banked or closed.
   Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26). transcript_outcomes is answered by window.__WA_RPCS.
   CAND=<file>; SHOTS=1 saves screenshots in test/shots_w210/. */
const fs = require('fs');
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }
const SHOTS = process.env.SHOTS ? path.join(__dirname, 'shots_w210') : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
async function shot(f, name, full) { if (SHOTS) await f.page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!full }); }

function fixture() {
  const FX = loadFixture();
  FX.transcripts = (FX.transcripts || []).concat([
    { id: 9901, department: 'marketing', meeting_date: '2026-09-23', title: 'Marketing Meeting - September 23, 2026', body: 'Ian: content plan.', processed: true, processed_at: '2026-09-23T20:00:00Z', created_at: '2026-09-23T19:00:00Z', ai_summary: 'Planned the October content.', board_only: false },
    { id: 9902, department: 'marketing', meeting_date: '2026-07-15', title: 'Marketing Meeting - July 15, 2026', body: 'Old.', processed: true, processed_at: '2026-07-15T20:00:00Z', created_at: '2026-07-15T19:00:00Z', ai_summary: 'An older meeting.', board_only: false },
    { id: 9903, department: 'opsmtl', meeting_date: '2026-09-20', title: 'Weekly Operations Meeting - September 20, 2026', body: 'Nothing assigned.', processed: true, processed_at: '2026-09-20T20:00:00Z', created_at: '2026-09-20T19:00:00Z', ai_summary: 'A quiet week.', board_only: false },
    { id: 9904, department: 'opsmtl', meeting_date: '2026-09-18', title: 'Loom archive recording', body: 'Archive.', processed: true, archive_only: true, created_at: '2026-09-18T19:00:00Z', ai_summary: 'Archive only.', board_only: false }
  ]);
  return FX;
}
const OUTCOMES = [
  { transcript_id: 9901, task_id: 501, kind: 'added', title: 'Draft the October content calendar <img src=x onerror="window.__XSS=1">', owner: 'Ian', due_date: '2026-10-03', done: false, banked: false, department: 'marketing', project_id: null, live: true },
  { transcript_id: 9901, task_id: 502, kind: 'added', title: 'Book the photographer', owner: 'Kahkashan', due_date: '2026-09-24', done: false, banked: false, department: 'marketing', project_id: null, live: true },
  { transcript_id: 9901, task_id: 503, kind: 'added', title: 'Post the Rally Paper recap', owner: 'Ian', due_date: null, done: true, banked: false, department: 'marketing', project_id: null, live: true },
  { transcript_id: 9901, task_id: 504, kind: 'banked', title: 'Plan the spring campaign', owner: 'Ian', due_date: '2027-02-01', done: false, banked: true, department: null, project_id: null, live: false },
  { transcript_id: 9901, task_id: 400, kind: 'closed', title: 'Send the September newsletter', owner: 'Ian', due_date: '2026-09-20', done: true, banked: false, department: 'marketing', project_id: null, live: true },
  { transcript_id: 9902, task_id: 300, kind: 'added', title: 'An old task', owner: 'Ian', due_date: '2026-07-20', done: true, banked: false, department: 'marketing', project_id: null, live: true }
];

(async () => {
  const browser = await launch();
  const FX = fixture();
  const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#transcripts', fixture: JSON.parse(JSON.stringify(FX)), wait: 4500, rpcs: { wa_org_editor: true, transcript_outcomes: OUTCOMES } });
  const p = f.page;
  await p.waitForTimeout(800);
  const s = await p.evaluate(() => {
    const it = id => document.querySelector('#txList .tx-item[data-tx="' + id + '"]');
    const ln = id => { const e = it(id); const l = e && e.querySelector('.w210line'); return l ? l.textContent : null; };
    return { has: !!window.w210, since: window.w210 && w210.since, l1: ln(9901), l2: ln(9902), l3: ln(9903), l4: ln(9904), present: [9901, 9902, 9903, 9904].map(id => !!it(id)) };
  });
  ok('wave210 loaded, recent means from 2026-09-01', s.has && s.since === '2026-09-01', s);
  ok('all four transcripts listed', s.present.every(Boolean), s.present);
  ok('recent meeting: counts made, banked, closed', /3 tasks made/.test(s.l1 || '') && /1 put in the bank/.test(s.l1 || '') && /1 task closed/.test(s.l1 || ''), s.l1);
  ok('recent meeting: open and overdue', /2 still open, 1 overdue/.test(s.l1 || ''), s.l1);
  ok('older meeting (July) shows nothing', s.l2 === null, s.l2);
  ok('recent meeting with no tasks says so', /made no tasks/.test(s.l3 || ''), s.l3);
  ok('archive-only recording shows nothing', s.l4 === null, s.l4);
  await shot(f, '1_line');
  await p.click('#txList .tx-item[data-tx="9901"] [data-w210open]');
  await p.waitForTimeout(200);
  const t = await p.evaluate(() => {
    const box = document.querySelector('#txList .tx-item[data-tx="9901"] .w210box');
    if (!box) return null;
    const rows = [...box.querySelectorAll('tbody tr')].map(r => [...r.querySelectorAll('td')].map(td => td.textContent.trim()));
    return { rows, links: [...box.querySelectorAll('a')].map(a => a.getAttribute('href')), btn: document.querySelector('#txList .tx-item[data-tx="9901"] [data-w210open]').textContent, open: document.querySelector('#txList .tx-item[data-tx="9901"]').classList.contains('open'), xss: !!window.__XSS };
  });
  ok('the table opens', !!t, t);
  if (t) {
    ok('groups: made, bank, closed', t.rows.some(r => /Tasks this meeting made \(3\)/.test(r[0])) && t.rows.some(r => /bank until later \(1\)/.test(r[0])) && t.rows.some(r => /meeting closed \(1\)/.test(r[0])), t.rows);
    const row = name => t.rows.find(r => r[0].indexOf(name) >= 0) || [];
    const md = await p.evaluate(() => [...document.querySelectorAll('.w210m')].some(m => getComputedStyle(m).display !== 'none'));
    ok('desktop: the phone line stays hidden', !md);
    ok('owner and due date shown', row('Book the photographer')[1] === 'Kahkashan' && /Sep 24, 2026/.test(row('Book the photographer')[2] || ''), row('Book the photographer'));
    ok('overdue status', row('Book the photographer')[3] === 'Overdue', row('Book the photographer'));
    ok('open status', row('October content')[3] === 'Open', row('October content'));
    ok('done status', row('Rally Paper recap')[3] === 'Done', row('Rally Paper recap'));
    ok('no date shown', /no date/.test(row('Rally Paper recap')[2] || ''), row('Rally Paper recap'));
    ok('bank status with its date', /In the bank until Feb 1, 2027/.test(row('spring campaign')[3] || ''), row('spring campaign'));
    ok('closed status', row('September newsletter')[3] === 'Closed by this meeting', row('September newsletter'));
    ok('live tasks link to their drawer, the banked one does not', t.links.indexOf('#task/501') >= 0 && t.links.indexOf('#task/504') < 0, t.links);
    ok('title escaped', !t.xss && t.rows.some(r => r[0].indexOf('<img') >= 0), t.xss);
    ok('button flips, row does not toggle open', /Hide/.test(t.btn) && !t.open, t);
  }
  await shot(f, '2_table');
  await p.click('#txList .tx-item[data-tx="9901"] [data-w210open]');
  const closed = await p.evaluate(() => !document.querySelector('#txList .tx-item[data-tx="9901"] .w210box'));
  ok('the table closes again', closed);
  ok('no page errors', f.errs.length === 0, f.errs);
  await f.page.context().close();

  /* a phone */
  const g = await fresh(browser, { who: 'admin', width: 390, hash: '#transcripts', fixture: JSON.parse(JSON.stringify(FX)), wait: 4500, rpcs: { wa_org_editor: true, transcript_outcomes: OUTCOMES } });
  await g.page.waitForTimeout(800);
  await g.page.evaluate(() => { const b = document.querySelector('#txList .tx-item[data-tx="9901"] [data-w210open]'); if (b) b.click(); });
  await g.page.waitForTimeout(200);
  const ph = await g.page.evaluate(() => { const box = document.querySelector('#txList .tx-item[data-tx="9901"] .w210box'); return box ? { w: box.scrollWidth, cw: box.clientWidth, doc: document.documentElement.scrollWidth, vw: innerWidth } : null; });
  ok('phone: the table fits', ph && ph.w <= ph.cw + 1 && ph.doc <= ph.vw + 1, ph);
  const pm = await g.page.evaluate(() => { const r = [...document.querySelectorAll('#txList .tx-item[data-tx="9901"] .w210box tbody tr')].find(x => /photographer/.test(x.textContent)); const m = r && r.querySelector('.w210m'); return m ? { vis: getComputedStyle(m).display !== 'none', text: m.textContent } : null; });
  ok('phone: owner, due date and status under the title', pm && pm.vis && /Kahkashan/.test(pm.text) && /Due Sep 24, 2026/.test(pm.text) && /Overdue/.test(pm.text), pm);
  if (SHOTS) { const el = await g.page.$('#txList .tx-item[data-tx="9901"]'); if (el) await el.scrollIntoViewIfNeeded(); await shot(g, '3_phone'); }
  ok('phone: no page errors', g.errs.length === 0, g.errs);
  await g.page.context().close();

  await browser.close();
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
