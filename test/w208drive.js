/* w208drive.js: wave208, interview transcripts on the application and their review (JD, MCC framework).
   Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26). The interviews and reviews are made up here;
   interview-review calls are answered and recorded by window.__WA_INVOKE.
   CAND=<file>; SHOTS=1 saves screenshots in test/shots_w208/. */
const fs = require('fs');
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }
const SHOTS = process.env.SHOTS ? path.join(__dirname, 'shots_w208') : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
async function shot(f, name, full) { if (SHOTS) await f.page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!full }); }

const Q = ['quick_learner', 'self_starter', 'experience', 'intelligence', 'integrity', 'energy', 'problem_solver', 'vision', 'referrals'];
function review() {
  return {
    candidate_speaker: 'Alyx Denison',
    summary: 'Alyx brings nonprofit event experience and asked sharp questions about volunteers <img src=x onerror="window.__XSS=1">.',
    strengths: [{ point: 'Directly relevant prior role', evidence: 'Event and fundraising coordinator at a nonprofit.' }, { point: 'Hands-on skill set', evidence: 'Vendors, venues, public speaking.' }, { point: 'Thoughtful questions', evidence: 'Asked about volunteer appreciation.' }],
    weaknesses: [{ point: 'Limited availability', evidence: 'Wants a light commitment during her PhD.' }, { point: 'No budgets discussed', evidence: 'Not covered.' }],
    insights: ['Motivated by community service.', 'Would push for volunteer recognition.'],
    jd_fit: { score: 3, summary: 'Relevant experience; several JD items not covered.', requirements: [{ requirement: 'Event planning experience', verdict: 'strong', evidence: 'Prior coordinator role.' }, { requirement: 'Budgets and calendar', verdict: 'not_covered', evidence: 'Not discussed.' }, { requirement: 'Volunteer management', verdict: 'partial', evidence: 'Raised retention.' }, { requirement: 'Evenings and weekends', verdict: 'gap', evidence: 'Once a week.' }] },
    mcc: { qualities: Q.map((q, i) => ({ quality: q, score: [0, 3, 4, 3, 0, 0, 3, 2, 0][i], evidence: q === 'integrity' ? 'Not covered' : 'Evidence for ' + q })), philosophies: [{ philosophy: 'iie', note: 'Integrity and energy untested.' }, { philosophy: 'referrals', note: 'No references gathered.' }, { philosophy: 'learn', note: 'Adaptable.' }], summary: 'Partly fits the profile; integrity and energy not tested.', level: 'staff', level_label: 'Directors and below (HQ)', needs: ['integrity', 'intelligence', 'energy', 'quick_learner'], profile_score: 3, covered: 1 },
    follow_ups: ['Confirm weekly availability.', 'Ask for references.'],
    next_step: 'A second conversation on budgets and availability.',
    jd: { read: 'google_doc', name: 'Event Coordinator', position: 'Event Coordinator' }
  };
}
function fixture() {
  const FX = loadFixture();
  const now = '2026-09-20T12:00:00Z';
  FX.hub_positions = [
    { id: 5, title: 'Event Coordinator', dept: 'fundraising', folder_id: 'F5', resumes_id: 'R5', jd_id: 'J5', jd_name: 'Event Coordinator', jd_url: 'https://docs.google.com/document/d/J5/edit', jd_mime: 'application/vnd.google-apps.document', older_count: 0, stage: 'interviewing', gone: false },
    { id: 7, title: 'Accountant', dept: 'fundraising', folder_id: 'F7', resumes_id: 'R7', jd_id: null, older_count: 0, stage: 'posted', gone: false }
  ];
  FX.hub_position_files = []; FX.hub_position_people = []; FX.hub_candidate_grades = []; FX.hub_candidate_calls = [];
  const cs = (FX.hub_candidates || []).filter(c => !/alyx|rim/i.test(c.name || ''));
  cs.push({ id: 9101, name: 'Alyx Denison', role: 'Event Coordinator', position_id: 5, status: 'interview', interview_at: '2026-09-10T18:00:00Z', created_at: now });
  cs.push({ id: 9102, name: 'Rim Ammar', role: 'Accountant', position_id: 7, status: 'interview', interview_at: '2026-09-12T18:00:00Z', created_at: now });
  cs.push({ id: 9103, name: 'Sam Failed', role: 'Accountant', position_id: 7, status: 'reviewing', created_at: now });
  FX.hub_candidates = cs;
  FX.transcripts = (FX.transcripts || []).concat([
    { id: 137, department: 'fundraising', meeting_date: '2026-08-10', title: 'Alyx - Event Coordinator Interview', speakers: ['Alyx Denison', 'Amanda Zoldak', 'Steel MacDonald'], source_url: 'https://www.loom.com/share/7504878a', body: 'Steel: Tell us about yourself.\nAlyx: I was the event and fundraising coordinator at a nonprofit.', board_only: false },
    { id: 78, department: 'hr', meeting_date: '2026-07-25', title: 'Rim - Accountant Interview', speakers: ['Steel MacDonald'], source_url: 'https://www.loom.com/share/e93b', body: 'Interview with Rim.', board_only: false },
    { id: 79, department: 'hr', meeting_date: '2026-07-26', title: 'Sam - Accountant Interview', speakers: [], source_url: 'https://app.plaud.ai', body: 'Short.', board_only: false }
  ]);
  FX.hub_candidate_interviews = [
    { id: 1, transcript_id: 137, candidate_id: 9101, status: 'linked', match_how: 'auto', match_note: 'Matched by full name and the position', level: 'staff', analysis: review(), analysis_status: 'done', analysis_model: 'anthropic/claude-sonnet-5', analysed_at: '2026-09-21T12:00:00Z', jd_read: 'google_doc', created_at: now },
    { id: 2, transcript_id: 78, candidate_id: null, status: 'unmatched', match_note: 'More than one applicant could be this person', suggestions: [{ id: 9102, name: 'Rim Ammar', score: 1, why: 'first name' }, { id: 999999, name: 'Gone Person', score: 1 }], created_at: now },
    { id: 3, transcript_id: 79, candidate_id: 9103, status: 'linked', match_how: 'manual', match_note: 'Linked by valex', analysis_status: 'failed', analysis_error: 'the transcript is too short to review', created_at: now }
  ];
  return FX;
}
const INVOKE = `window.__W208CALLS = []; window.__WA_INVOKE = function (name, opts) { var b = (opts && opts.body) || {}; window.__W208CALLS.push({ name: name, body: b });
  if (name === 'interview-review') { if (b.action === 'analyse') return { data: { ok: true }, error: null }; return { data: { ok: true }, error: null }; }
  if (name === 'jd-drive' && b.action === 'privacy') return { data: { link_open: false }, error: null };
  return { data: null, error: null }; };`;

(async () => {
  const browser = await launch();
  const FX = fixture();
  let f = await fresh(browser, { who: 'admin', width: 1440, hash: '#hrcentre/applications', fixture: JSON.parse(JSON.stringify(FX)), init: INVOKE, wait: 5000 });
  await f.page.waitForTimeout(1800);
  await f.ev(() => { try { w197.paintBoard(); } catch (e) { /* fine */ } });
  await f.page.waitForTimeout(400);
  const b = await f.ev(() => ({ card: (document.querySelector('#w197board [data-w197c="9101"]') || {}).textContent, fcard: (document.querySelector('#w197board [data-w197c="9103"]') || {}).textContent, bar: (document.querySelector('#w197apps [data-w208a="linklist"]') || {}).textContent, api: !!window.w208 }));
  ok('Board: w208 is loaded', b.api, b);
  ok('Board: a reviewed interview shows on the card with the JD and MCC scores', /Interview reviewed · JD 3\/5 · MCC 3\/5/.test(b.card || ''), b.card);
  ok('Board: a failed review says so on the card', /review failed/.test(b.fcard || ''), b.fcard);
  ok('Board: Interviews to link counts the unmatched ones', /Interviews to link \(1\)/.test(b.bar || ''), b.bar);
  await shot(f, 'board', false);

  /* the reviewed applicant's sheet */
  await f.page.click('#w197board [data-w197c="9101"]'); await f.page.waitForTimeout(500);
  const s = await f.ev(() => { var s = document.getElementById('w197sheet'); var t = s.textContent; return { t: t, req: Array.from(s.querySelectorAll('.w208req .w208v')).map(x => x.textContent), q: s.querySelectorAll('.w208q tr').length, need: Array.from(s.querySelectorAll('.w208q tr.need th')).map(x => x.textContent.replace(/^●\s*/, '')), first: (s.querySelector('.w208q tr th') || {}).textContent, rec: !!s.querySelector('a[href*="loom.com/share/7504878a"]'), lv: (s.querySelector('[data-w208lv="137"]') || {}).value, xss: window.__XSS === 1, img: !!s.querySelector('.w208rev img') }; });
  ok('Sheet: the interview title and how it was linked', /Alyx - Event Coordinator Interview/.test(s.t) && /linked by the Hub \(full name and the position\)/.test(s.t), s.t.slice(0, 400));
  ok('Sheet: strengths, weaknesses and insights', /Strengths/.test(s.t) && /Directly relevant prior role/.test(s.t) && /Weaknesses/.test(s.t) && /Limited availability/.test(s.t) && /Insights/.test(s.t) && /Would push for volunteer recognition/.test(s.t));
  ok('Sheet: against the JD, requirement by requirement', /Against the job description/.test(s.t) && s.req.join('|') === 'Strong|Not covered|Partly|Gap' && /Compared with Event Coordinator/.test(s.t), s.req);
  ok('Sheet: the MCC framework, nine qualities, the level\'s ones first', s.q === 9 && s.need.length === 4 && s.need.indexOf('Integrity') >= 0 && /Quick learner/.test(s.first || ''), { q: s.q, need: s.need, first: s.first });
  ok('Sheet: not covered qualities say so', /Not covered/.test(s.t));
  ok('Sheet: the level and the philosophies', s.lv === 'staff' && /The recruitment philosophies/.test(s.t) && /Integrity, intelligence, energy/.test(s.t));
  ok('Sheet: follow-ups and a suggested next step, and the decision stays with the team', /To follow up/.test(s.t) && /Suggested next step/.test(s.t) && /decision stays with the hiring team/.test(s.t));
  ok('Sheet: the recording link', s.rec);
  ok('Sheet: the review text is escaped', !s.xss && !s.img, s);
  ok('Sheet: a jump to the review at the top of the sheet, with the scores', await f.ev(() => /The interview and its review \(JD 3\/5, MCC 3\/5\)/.test((document.querySelector('#w197sheet [data-w208a="jump"]') || {}).textContent || '')));
  await f.page.click('#w197sheet [data-w208a="jump"]'); await f.page.waitForTimeout(800);
  ok('Sheet: the jump scrolls to the interview', await f.ev(() => { var o = document.querySelector('#w197sheet .w208one'); var r = o.getBoundingClientRect(); return r.top >= -2 && r.top < window.innerHeight / 2; }));
  await shot(f, 'sheet_review', false);
  await f.ev(() => { var o = document.querySelector('#w197sheet .w208q'); o && o.scrollIntoView(); }); await f.page.waitForTimeout(200);
  await shot(f, 'sheet_review_mcc', false);
  /* read the interview */
  await f.page.click('#w197sheet [data-w208a="tx"][data-t="137"]'); await f.page.waitForTimeout(600);
  ok('Sheet: Read the interview shows the transcript', await f.ev(() => /I was the event and fundraising coordinator/.test((document.querySelector('#w197sheet .w208tx') || {}).textContent || '')));
  await f.page.click('#w197sheet [data-w208a="tx"][data-t="137"]'); await f.page.waitForTimeout(300);
  ok('Sheet: Hide the interview hides it', await f.ev(() => !document.querySelector('#w197sheet .w208tx')));
  /* review again, the level */
  await f.page.click('#w197sheet [data-w208a="again"][data-t="137"]'); await f.page.waitForTimeout(600);
  ok('Review again asks interview-review to analyse', await f.ev(() => window.__W208CALLS.some(c => c.name === 'interview-review' && c.body.action === 'analyse' && c.body.transcript_id === 137 && !c.body.level)));
  await f.page.selectOption('#w197sheet [data-w208lv="137"]', 'csuite'); await f.page.waitForTimeout(600);
  ok('Changing the level reviews again for that level', await f.ev(() => window.__W208CALLS.some(c => c.body.action === 'analyse' && c.body.level === 'csuite')));
  /* unlink */
  await f.page.click('#w197sheet [data-w208a="unlink"][data-t="137"]'); await f.page.waitForTimeout(600);
  ok('Unlink asks interview-review', await f.ev(() => window.__W208CALLS.some(c => c.body.action === 'unlink' && c.body.transcript_id === 137 && !c.body.not_applicant)));
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(200);
  /* a failed review */
  await f.page.click('#w197board [data-w197c="9103"]'); await f.page.waitForTimeout(500);
  const fl = await f.ev(() => ({ t: document.getElementById('w197sheet').textContent, rec: !!document.querySelector('#w197sheet a[href="https://app.plaud.ai"]') }));
  ok('Sheet: a failed review gives the reason and Review it', /The review did not work: the transcript is too short to review/.test(fl.t) && /Review it/.test(fl.t), fl.t.slice(0, 300));
  ok('Sheet: a bare Plaud link is not offered as the recording', !fl.rec);
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(200);
  /* an applicant at Interview with no interview linked: link one from the archive */
  await f.page.click('#w197board [data-w197c="9102"]'); await f.page.waitForTimeout(500);
  const ln = await f.ev(() => ({ t: document.getElementById('w197sheet').textContent, opts: Array.from(document.querySelectorAll('#w208pick1 option')).map(o => o.textContent) }));
  ok('Sheet: no interview yet says how it links, and offers the unmatched ones', /No interview transcript linked yet/.test(ln.t) && ln.opts.some(o => /Rim - Accountant Interview/.test(o)), ln.opts);
  await f.page.selectOption('#w208pick1', '78'); await f.page.click('#w197sheet [data-w208a="linkhere"]'); await f.page.waitForTimeout(600);
  ok('Linking from the sheet asks interview-review', await f.ev(() => window.__W208CALLS.some(c => c.body.action === 'link' && c.body.transcript_id === 78 && c.body.candidate_id === 9102)));
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(200);
  /* Interviews to link */
  await f.ev(() => document.querySelector('#w197sheet') && document.querySelector('#w197sheet').classList.remove('open'));
  await f.page.click('#w197apps [data-w208a="linklist"]'); await f.page.waitForTimeout(400);
  const ll = await f.ev(() => { var p = document.getElementById('w208links'); return { open: p && p.classList.contains('open'), t: p && p.textContent, sg: Array.from(p.querySelectorAll('[data-w208link]')).map(x => x.textContent) }; });
  ok('Interviews to link: the panel lists the interview with who it could be (only current applicants)', ll.open && /Rim - Accountant Interview/.test(ll.t) && ll.sg.join('|') === 'Rim Ammar', ll);
  await shot(f, 'link_panel');
  await f.page.click('#w208links [data-w208link="78"]'); await f.page.waitForTimeout(600);
  ok('Interviews to link: a suggestion links it', await f.ev(() => window.__W208CALLS.filter(c => c.body.action === 'link' && c.body.transcript_id === 78).length === 2));
  await f.page.click('#w208links [data-w208a="notapp"][data-t="78"]').catch(() => {}); await f.page.waitForTimeout(600);
  ok('Interviews to link: Not an applicant', await f.ev(() => window.__W208CALLS.some(c => c.body.action === 'unlink' && c.body.not_applicant === true)));
  await f.page.click('#w208links [data-w208a="linkpick"][data-t="78"]').catch(() => {}); await f.page.waitForTimeout(300);
  ok('Interviews to link: Link with no applicant chosen asks for one', await f.ev(() => window.__W208CALLS.filter(c => c.body.action === 'link').length === 2));
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(200);
  ok('Interviews to link: Escape closes it', await f.ev(() => !document.getElementById('w208links').classList.contains('open')));
  ok('No page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* a phone */
  f = await fresh(browser, { who: 'admin', width: 390, height: 844, hash: '#hrcentre/applications', fixture: JSON.parse(JSON.stringify(FX)), init: INVOKE, wait: 5000 });
  await f.page.waitForTimeout(1800);
  await f.ev(() => { try { w197.openSheet(9101); } catch (e) { /* fine */ } }); await f.page.waitForTimeout(500);
  ok('Phone: the sheet with the review fits', await f.ev(() => { var p = document.querySelector('#w197sheet .pn'); var r = document.querySelector('#w197sheet .w208rev'); return p && r && p.getBoundingClientRect().width <= window.innerWidth + 1 && r.scrollWidth <= p.clientWidth + 2; }));
  ok('Phone: nothing wider than the screen', await f.ev(() => document.documentElement.scrollWidth <= window.innerWidth + 2));
  await shot(f, 'phone_review', false);
  ok('Phone: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* restricted: a row the reader cannot see is simply not there (RLS); with no rows nothing is drawn */
  const FX2 = fixture(); FX2.hub_candidate_interviews = [];
  f = await fresh(browser, { who: 'admin', width: 1366, hash: '#hrcentre/applications', fixture: FX2, init: INVOKE, wait: 5000 });
  await f.page.waitForTimeout(1600);
  await f.ev(() => { try { w197.paintBoard(); w197.openSheet(9101); } catch (e) { /* fine */ } }); await f.page.waitForTimeout(500);
  const nr = await f.ev(() => ({ bar: !!document.querySelector('[data-w208a="linklist"]'), t: document.getElementById('w197sheet').textContent }));
  ok('No interviews: no Interviews to link button; the sheet says none is linked', !nr.bar && /No interview transcript linked yet/.test(nr.t) && !/Link an interview from the archive/.test(nr.t), nr);
  ok('No interviews: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw208drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(2); });
