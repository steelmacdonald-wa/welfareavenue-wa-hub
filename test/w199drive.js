/* w199drive.js: wave199, Positions from the HR drive and Applications linked to them.
   Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26). The positions, their files and the people who
   hold them are made up here; jd-drive calls are answered and recorded by window.__WA_INVOKE.
   CAND=<file>; SHOTS=1 saves screenshots in test/shots_w199/. */
const fs = require('fs');
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }
const SHOTS = process.env.SHOTS ? path.join(__dirname, 'shots_w199') : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
async function shot(f, name, full) { if (SHOTS) await f.page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!full }); }

function fixture() {
  const FX = loadFixture();
  const ahmed = (FX.team_members || []).filter(m => /^ahmed/i.test(m.name || ''))[0] || (FX.team_members || [])[0];
  const now = '2026-09-20T12:00:00Z';
  FX.hub_positions = [
    { id: 1, title: 'Operations Manager', dept: 'opsmtl', folder_id: 'F1', resumes_id: 'R1', jd_id: 'J1', jd_name: 'Operations Manager - Job Description', jd_url: 'https://docs.google.com/document/d/J1/edit', jd_modified: now, older_count: 0, stage: 'interviewing', gone: false, synced_at: now },
    { id: 2, title: 'Volunteer Relations Coordinator', dept: 'opsmtl', folder_id: 'F2', resumes_id: 'R2', jd_id: 'J2', jd_name: 'Volunteer Relations Coordinator - Job Description', jd_url: 'https://docs.google.com/document/d/J2/edit', jd_modified: now, older_count: 0, stage: 'closed', gone: false },
    { id: 3, title: 'Outreach Assistant', dept: 'fundraising', folder_id: 'F3', resumes_id: 'R3', older_id: 'O3', jd_id: 'J3', jd_name: 'Outreach Assistant', jd_url: 'https://docs.google.com/document/d/J3/edit', jd_modified: now, older_count: 2, stage: 'closed', gone: false },
    { id: 4, title: 'Logistics Manager', dept: 'opsmtl', folder_id: 'F4', resumes_id: 'R4', jd_id: null, older_count: 0, stage: 'posted', gone: false },
    { id: 5, title: 'Event Coordinator', dept: 'fundraising', folder_id: 'F5', resumes_id: 'R5', jd_id: 'J5', jd_name: 'Event Coordinator', jd_url: 'https://docs.google.com/document/d/J5/edit', older_count: 0, stage: 'filled', gone: false },
    { id: 6, title: 'Gone Position', dept: 'hr', folder_id: 'F6', stage: 'requested', gone: true }
  ];
  FX.hub_position_files = [
    { id: 11, position_id: 1, kind: 'resume', file_id: 'CV1', name: 'Resume - Ahmed Fakhir.pdf', url: 'https://drive.google.com/file/d/CV1/view', created_time: now, member_id: ahmed ? ahmed.id : null, gone: false },
    { id: 12, position_id: 4, kind: 'resume', file_id: 'CV2', name: 'Kiana’s resume.pdf', url: 'https://drive.google.com/file/d/CV2/view', created_time: now, gone: false },
    { id: 13, position_id: 3, kind: 'old_jd', file_id: 'OJ1', name: 'Outreach Assistant Job Description.docx', url: 'https://drive.google.com/file/d/OJ1/view', modified_time: '2023-06-06T00:00:00Z', gone: false },
    { id: 14, position_id: null, kind: 'resume', file_id: 'CV3', name: 'cv.AncaBordeianu.pdf', url: 'https://drive.google.com/file/d/CV3/view', created_time: now, gone: false }
  ];
  FX.hub_position_people = ahmed ? [
    { id: 21, position_id: 2, member_id: ahmed.id, since: '2025-08-02', until: null, note: 'His first role here' },
    { id: 22, position_id: 1, member_id: ahmed.id, since: '2026-02-01', until: null }
  ] : [];
  if (ahmed) ahmed.position_id = 1;
  FX.app_config = (FX.app_config || []).concat([{ key: 'jd_drive_sync', value: { at: '2026-09-25T19:55:00Z', positions: 5, files: 4 } }]);
  const cs = FX.hub_candidates || [];
  cs.forEach((c, i) => { if (/operations manager/i.test(c.role || '')) c.position_id = 1; });
  if (!cs.some(c => c.position_id === 1)) cs.push({ id: 9001, name: 'Test Candidate', role: 'Operations Manager', position_id: 1, status: 'new', created_at: now });
  cs.push({ id: 9002, name: 'Unlinked Person', role: 'Some Old Role', status: 'new', created_at: now });
  FX.hub_candidates = cs;
  FX.hub_candidate_grades = [{ id: 501, candidate_id: 9002, grader_email: 'valex.sanon@welfareavenue.com', grader_name: 'Valex', stars: 4, note: 'Strong on scheduling', stage: 'new', updated_at: now }, { id: 502, candidate_id: 9002, grader_email: 'natasha.sharp@welfareavenue.com', grader_name: 'Natasha', stars: 5, stage: 'new', updated_at: now }];
  return { FX, ahmed };
}
const INVOKE = `window.__W199CALLS = []; window.__W199LINK = false; window.__WA_INVOKE = function (name, opts) { var b = (opts && opts.body) || {}; window.__W199CALLS.push({ name: name, body: b }); if (name !== 'jd-drive') return { data: null, error: null };
  if (b.action === 'privacy') return { data: { link_open: window.__W199LINK }, error: null };
  if (b.action === 'sync') return { data: { ok: true, positions: 5, files: 4, made: [], tidied: [], added: [] }, error: null };
  if (b.action === 'create_position') return { data: { ok: true, position: { id: 77, title: b.title, dept: b.dept, stage: b.stage } }, error: null };
  if (b.action === 'upload') return { data: { ok: true, file: { id: 'NEW' }, candidate_id: 9100 }, error: null };
  if (b.action === 'move_file') return { data: { ok: true }, error: null };
  return { data: { error: 'unknown' }, error: null }; };`;

(async () => {
  const browser = await launch();
  const { FX, ahmed } = fixture();
  let f = await fresh(browser, { who: 'admin', width: 1440, hash: '#hrcentre/positions', fixture: JSON.parse(JSON.stringify(FX)), init: INVOKE, wait: 5000 });
  await f.page.waitForTimeout(1500);
  const pg = await f.ev(() => ({ h1: (document.querySelector('#hrcentre > .w118mast h1') || {}).textContent, host: !!document.getElementById('w199pos'), vis: (function () { var h = document.getElementById('w199pos'); return !!h && h.offsetHeight > 0; })(), cards: Array.from(document.querySelectorAll('#w199pos .w199card b')).map(b => b.textContent), heads: Array.from(document.querySelectorAll('#w199pos .w199dh')).map(h => h.textContent), old: Array.from(document.querySelectorAll('#hrcentre [data-w197s~="oldpositions"]')).filter(e => e.offsetHeight > 0).length, calls: window.__W199CALLS.map(c => c.body.action) }));
  ok('Positions: the title', pg.h1 === 'Positions', pg.h1);
  ok('Positions: the page is drawn and visible', pg.host && pg.vis, pg);
  ok('Positions: Hiring now shows only roles being hired for', pg.cards.indexOf('Operations Manager') >= 0 && pg.cards.indexOf('Logistics Manager') >= 0 && pg.cards.indexOf('Outreach Assistant') < 0 && pg.cards.indexOf('Event Coordinator') < 0, pg.cards);
  ok('Positions: grouped by department', pg.heads.some(h => /Operations Montreal/.test(h)), pg.heads);
  ok('Positions: a gone folder is not shown', pg.cards.indexOf('Gone Position') < 0);
  ok('Positions: the old hiring-request list is on no page', pg.old === 0, pg.old);
  ok('Positions: the privacy check is asked once', pg.calls.filter(c => c === 'privacy').length === 1, pg.calls);
  await shot(f, 'positions_hiring', true);
  /* all positions */
  await f.page.click('#w199pos [data-w199a="all"]'); await f.page.waitForTimeout(300);
  const all = await f.ev(() => Array.from(document.querySelectorAll('#w199pos .w199card b')).map(b => b.textContent));
  ok('Positions: All positions shows every role', all.length === 5 && all.indexOf('Outreach Assistant') >= 0, all);
  await f.page.selectOption('#w199dept', 'fundraising'); await f.page.waitForTimeout(300);
  const fu = await f.ev(() => Array.from(document.querySelectorAll('#w199pos .w199card b')).map(b => b.textContent));
  ok('Positions: the department filter', fu.length === 2 && fu.every(t => /Outreach|Event/.test(t)), fu);
  await f.page.selectOption('#w199dept', ''); await f.page.waitForTimeout(200);
  await shot(f, 'positions_all', true);
  /* a position's sheet */
  await f.page.click('#w199pos [data-w199open="3"]'); await f.page.waitForTimeout(400);
  const sh = await f.ev(() => { var s = document.getElementById('w197sheet'); return { open: s && s.classList.contains('open'), h: s && s.querySelector('h3').textContent, jd: !!(s && s.querySelector('a[href*="J3"]')), older: s && /2 older versions|1 older version/.test(s.textContent), on: s && (s.querySelector('[data-w199st].on') || {}).textContent }; });
  ok('Sheet: opens with the title', sh.open && sh.h === 'Outreach Assistant', sh);
  ok('Sheet: the job description link', sh.jd, sh);
  ok('Sheet: the older versions', sh.older, sh);
  ok('Sheet: the stage', sh.on === 'Not hiring', sh);
  await shot(f, 'sheet_outreach');
  await f.page.click('#w197sheet [data-w199st="posted"]'); await f.page.waitForTimeout(400);
  ok('Sheet: a stage change saves and redraws', await f.ev(() => (document.querySelector('#w197sheet [data-w199st].on') || {}).textContent === 'Job posted' && w199.state().pos.filter(p => p.id === 3)[0].stage === 'posted'));
  await f.page.click('#w197sheet [data-w199a="shut"]'); await f.page.waitForTimeout(200);
  /* Ahmed: the people in a role, and his history */
  if (ahmed) {
    await f.page.click('#w199pos [data-w199open="1"]'); await f.page.waitForTimeout(400);
    const om = await f.ev((n) => { var s = document.getElementById('w197sheet'); return { txt: s.textContent, cv: !!s.querySelector('a[href*="CV1"]'), member: /on the team/.test(s.textContent) }; }, ahmed.name);
    ok('Sheet: Ahmed holds Operations Manager since Feb', om.txt.indexOf(ahmed.name) >= 0 && /since/.test(om.txt), om.txt.slice(0, 400));
    ok('Sheet: his CV in Drive, marked as on the team', om.cv && om.member, om);
    await shot(f, 'sheet_opsmanager');
    await f.page.click('#w197sheet [data-w199a="shut"]'); await f.page.waitForTimeout(200);
    await f.page.click('#w199pos [data-w199open="2"]'); await f.page.waitForTimeout(400);
    ok('Sheet: Ahmed in Volunteer Relations Coordinator, earlier (he holds Operations Manager now)', await f.ev((n) => { var s = document.getElementById('w197sheet'); return s.textContent.indexOf(n) >= 0 && /earlier, from Aug 2, 2025/.test(s.textContent) && !s.querySelector('[data-w199end]'); }, ahmed.name));
    await f.page.click('#w197sheet [data-w199a="shut"]'); await f.page.waitForTimeout(200);
  }
  /* a CV in Drive with nobody: add to Applications */
  await f.page.click('#w199pos [data-w199open="4"]'); await f.page.waitForTimeout(400);
  ok('Sheet: no JD yet is said', await f.ev(() => /No job description yet/.test(document.getElementById('w197sheet').textContent)));
  await f.ev(() => { window.__W199INS = []; var from = db.from.bind(db); db.from = function (t) { var q = from(t); var ins = q.insert && q.insert.bind(q); if (ins) q.insert = function (p) { window.__W199INS.push({ t: t, p: p }); return ins(p); }; return q; }; });
  await f.page.click('#w197sheet [data-w199add="CV2"]'); await f.page.waitForTimeout(500);
  const ins = await f.ev(() => window.__W199INS.filter(x => x.t === 'hub_candidates').map(x => x.p)[0]);
  ok('Sheet: Add to Applications makes an application from the CV', ins && ins.name === 'Kiana' && ins.position_id === 4 && ins.status === 'new' && ins.drive_file_id === 'CV2', ins);
  await f.page.click('#w197sheet [data-w199a="shut"]'); await f.page.waitForTimeout(200);
  /* upload refused when the folder is open to anyone */
  /* new position */
  await f.page.click('#w199pos [data-w199a="new"]'); await f.page.waitForTimeout(300);
  await f.page.fill('#w199nt', 'Volunteer Coordinator'); await f.page.selectOption('#w199nd', 'hr');
  await f.page.click('#w197sheet [data-w199ns="posted"]'); await f.page.click('#w197sheet [data-w199a="create"]'); await f.page.waitForTimeout(600);
  const np = await f.ev(() => window.__W199CALLS.filter(c => c.body.action === 'create_position').map(c => c.body)[0]);
  ok('New position: asks jd-drive with title, department and stage', np && np.title === 'Volunteer Coordinator' && np.dept === 'hr' && np.stage === 'posted', np);
  await f.page.click('#w197sheet [data-w199a="shut"]').catch(() => {}); await f.page.waitForTimeout(200);
  /* sync */
  await f.page.click('#w199pos [data-w199a="sync"]'); await f.page.waitForTimeout(600);
  ok('Sync with Drive asks jd-drive', await f.ev(() => window.__W199CALLS.some(c => c.body.action === 'sync')));
  /* unsorted */
  ok('Unsorted Resumes are counted', await f.ev(() => /1 CV in Unsorted Resumes/.test(document.getElementById('w199pos').textContent)));
  /* Applications: positions on the board and in the sheet */
  await f.hash('#hrcentre/applications', 2000);
  const ap = await f.ev(() => ({ opts: Array.from(document.querySelectorAll('#w197role option')).map(o => o.textContent), card: Array.from(document.querySelectorAll('#w197board .w197cand .r')).map(r => r.textContent) }));
  ok('Applications: the filter lists positions', ap.opts[0] === 'Every position' && ap.opts.indexOf('Operations Manager') >= 0 && ap.opts.indexOf('Some Old Role') >= 0, ap.opts);
  ok('Applications: cards show the position', ap.card.some(t => /^Operations Manager/.test(t)), ap.card.slice(0, 5));
  const v = await f.ev(() => { var o = Array.from(document.querySelectorAll('#w197role option')).filter(x => x.textContent === 'Operations Manager')[0]; return o && o.value; });
  await f.page.selectOption('#w197role', v); await f.page.waitForTimeout(300);
  ok('Applications: filtering by a position', await f.ev(() => { var r = Array.from(document.querySelectorAll('#w197board .w197cand .r')).map(x => x.textContent); return r.length > 0 && r.every(t => /^Operations Manager/.test(t)); }));
  const cid = await f.ev(() => (document.querySelector('#w197board .w197cand') || {}).getAttribute && document.querySelector('#w197board .w197cand').getAttribute('data-w197c'));
  await f.page.click('#w197board .w197cand'); await f.page.waitForTimeout(400);
  const cs = await f.ev(() => { var s = document.getElementById('w197sheet'); var sel = s.querySelector('#w199pos1'); return { sel: !!sel, val: sel && sel.value, groups: sel ? Array.from(sel.querySelectorAll('optgroup')).map(g => g.label) : [], jd: !!s.querySelector('a[href*="J1"]'), pos: !!s.querySelector('[data-w199open="1"]') }; });
  ok('Applications sheet: the position select, by department', cs.sel && cs.val === '1' && cs.groups.indexOf('Operations Montreal') >= 0, cs);
  ok('Applications sheet: the JD and the position', cs.jd && cs.pos, cs);
  await shot(f, 'apps_sheet');
  await f.page.selectOption('#w199pos1', '4'); await f.page.waitForTimeout(500);
  ok('Applications sheet: changing the position saves position and role', await f.ev((id) => { var c = w197.state().cands.filter(x => String(x.id) === String(id))[0]; return c && c.position_id === 4 && c.role === 'Logistics Manager'; }, cid));
  await f.page.click('#w197sheet [data-w199open="4"]'); await f.page.waitForTimeout(400);
  ok('Applications sheet: The position opens its sheet', await f.ev(() => document.querySelector('#w197sheet h3').textContent === 'Logistics Manager'));
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(200);
  /* grades: each person, 1 to 5 stars */
  await f.page.selectOption('#w197role', ''); await f.page.waitForTimeout(300);
  const g1 = await f.ev(() => { var card = document.querySelector('#w197board [data-w197c="9002"]'); return card && (card.querySelector('.w199st') || {}).textContent; });
  ok('Grades: the card shows the average and how many graded', g1 === '\u2605 4.5 (2)', g1);
  await f.page.click('#w197board [data-w197c="9002"]'); await f.page.waitForTimeout(400);
  const g2 = await f.ev(() => { var s = document.getElementById('w197sheet'); return { stars: s.querySelectorAll('.w199star').length, others: Array.from(s.querySelectorAll('.w199glist li')).map(li => li.textContent) }; });
  ok('Grades: the sheet has your five stars and the others\' grades with names', g2.stars === 5 && g2.others.some(t => /Valex/.test(t) && /Strong on scheduling/.test(t)) && g2.others.some(t => /Natasha/.test(t)), g2);
  await f.page.click('#w197sheet .w199star[data-n="2"]'); await f.page.waitForTimeout(500);
  const g3 = await f.ev(() => ({ on: document.querySelectorAll('#w197sheet .w199star.on').length, note: !!document.getElementById('w199gnote'), card: (document.querySelector('#w197board [data-w197c="9002"] .w199st') || {}).textContent, mine: w199.state().grades.filter(g => g.candidate_id === 9002 && /steel/.test(g.grader_email))[0] }));
  ok('Grades: your grade saves, the stars light and the average updates', g3.on === 2 && g3.note && g3.card === '\u2605 3.7 (3)' && g3.mine && g3.mine.stars === 2, g3);
  await shot(f, 'grade_sheet');
  await f.page.click('#w197sheet .w199star[data-n="2"]'); await f.page.waitForTimeout(500);
  ok('Grades: the same star again clears your grade', await f.ev(() => document.querySelectorAll('#w197sheet .w199star.on').length === 0 && (document.querySelector('#w197board [data-w197c="9002"] .w199st') || {}).textContent === '\u2605 4.5 (2)'));
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(200);
  await f.page.check('#w199sortg'); await f.page.waitForTimeout(300);
  ok('Grades: Best graded first puts graded cards on top', await f.ev(() => { var col = document.querySelector('#w197board [data-w197col="new"]'); var first = col && col.querySelector('.w197cand'); return first && first.getAttribute('data-w197c') === '9002'; }));
  await shot(f, 'grade_board', true);
  await f.page.uncheck('#w199sortg'); await f.page.waitForTimeout(200);

  /* interviews: a day and a time */
  await f.page.selectOption('#w197role', ''); await f.page.waitForTimeout(300);
  const ivc = await f.ev(() => { var c = w197.state().cands.filter(x => x.status !== 'interview' && x.status !== 'hired')[0]; return c && c.id; });
  await f.ev((id) => w197.moveTo(id, 'interview'), ivc); await f.page.waitForTimeout(500);
  const iv1 = await f.ev(() => { var s = document.getElementById('w197sheet'), i = document.getElementById('w199iv'); return { open: s && s.classList.contains('open'), field: !!i, need: i && i.classList.contains('need'), focus: document.activeElement === i, pill: Array.from(document.querySelectorAll('#w197board [data-w197col="interview"] .w199ivno')).length }; });
  ok('Interview: moving a card there opens its sheet on the day and time', iv1.open && iv1.field && iv1.need && iv1.focus, iv1);
  ok('Interview: a card with no time says so', iv1.pill >= 1, iv1);
  await f.page.fill('#w199iv', '2026-09-29T14:30'); await f.page.dispatchEvent('#w199iv', 'change'); await f.page.waitForTimeout(500);
  const iv2 = await f.ev((id) => { var c = w197.state().cands.filter(x => String(x.id) === String(id))[0]; var card = document.querySelector('#w197board [data-w197c="' + id + '"]'); return { at: c && c.interview_at, txt: card && card.textContent }; }, ivc);
  ok('Interview: the day and time are saved and shown on the card', iv2.at && new Date(iv2.at).getHours() === 14 && /Interview Tue, Sep 29/.test(iv2.txt || ''), iv2);
  await shot(f, 'interview_card', true);
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(200);
  ok('No page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* the folder open to anyone: the warning shows */
  f = await fresh(browser, { who: 'admin', width: 1440, hash: '#hrcentre/positions', fixture: JSON.parse(JSON.stringify(FX)), init: INVOKE + ' window.__W199LINK = true;', wait: 5000 });
  await f.page.waitForTimeout(1200);
  ok('Privacy: the warning when the folder is open to anyone with the link', await f.ev(() => !!document.querySelector('#w199pos .w199warn')));
  await shot(f, 'privacy_warning');
  await f.close();

  /* French */
  const DICT = JSON.parse(fs.readFileSync(path.join(__dirname, '../build/data/wa198_ui_fr.json'), 'utf8'));
  f = await fresh(browser, { who: 'admin', width: 1440, hash: '#hrcentre/positions', fixture: JSON.parse(JSON.stringify(FX)), rpcs: { wa_org_editor: true, wa198_dict: { v: 't', d: DICT }, wa198_dict_v: 't', wa198_content: [], wa198_seen: 1 }, init: INVOKE + " try { localStorage.setItem('wa198lang','fr'); } catch (e) {}", wait: 6000 });
  await f.page.waitForTimeout(1500);
  ok('French: the page still draws, names untouched', await f.ev(() => !!document.querySelector('#w199pos .w199card') && /Operations Manager|Logistics Manager/.test(document.getElementById('w199pos').textContent)));
  ok('French: no page errors', f.errs.length === 0, f.errs);
  await shot(f, 'fr_positions');
  await f.close();

  /* a phone */
  f = await fresh(browser, { who: 'admin', width: 390, hash: '#hrcentre/positions', fixture: JSON.parse(JSON.stringify(FX)), init: INVOKE, wait: 5000 });
  await f.page.waitForTimeout(1200);
  ok('Phone: nothing wider than the screen', await f.ev(() => document.documentElement.scrollWidth <= window.innerWidth + 2));
  await f.page.click('#w199pos [data-w199open="1"]'); await f.page.waitForTimeout(400);
  ok('Phone: the sheet fits', await f.ev(() => { var p = document.querySelector('#w197sheet .pn'); return p && p.getBoundingClientRect().width <= window.innerWidth + 1; }));
  await shot(f, 'phone_sheet');
  ok('Phone: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* an HR member (Samson) sees it; a plain member does not reach the HR centre's data */
  f = await fresh(browser, { who: 'member', width: 1366, hash: '#hrcentre/positions', fixture: JSON.parse(JSON.stringify(FX)), init: INVOKE, wait: 5000 });
  await f.page.waitForTimeout(1000);
  ok('HR member: Positions draws', await f.ev(() => !!document.querySelector('#w199pos .w199card')));
  ok('HR member: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw199drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(2); });
