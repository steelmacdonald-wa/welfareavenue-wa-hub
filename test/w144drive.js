/* w144drive.js: Meet attendance (wave144; since wave149 in the HR centre only: the team pages and the Board overview no
   longer show it, and the HR centre card opens each team's last eight meetings and lists the board meetings).
   The meet tables come from a snapshot of the live data (scratchpad meet_fixture.json); what the database would show each
   identity is applied here (the stub has no row level security): a team member reads their team's meetings and only their
   own rows; the person who runs a meeting reads that team's rows; a director reads the board meetings and their rows.
   usage: node test/w144drive.js */
const fs = require('fs');
const { launch, fresh, loadFixture } = require('./boot');
const SP = '/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/';
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 600) : '')); } }
const MEET = JSON.parse(fs.readFileSync(SP + 'meet_fixture.json', 'utf8'))[0];
function fixture(view) {
  const fx = loadFixture();
  let ms = MEET.meetings.slice(), rs = MEET.attendance.slice();
  if (view && view.team) { /* a team member: the team's meetings, their own rows */
    ms = ms.filter(m => m.kind === 'team' && m.department === view.team);
    const ids = new Set(ms.map(m => m.id));
    rs = rs.filter(r => ids.has(r.meeting_id) && r.person === view.email);
  }
  if (view && view.organizer) { /* the person who runs a team's meeting, a leader: that team's rows, and their own */
    const ids = new Set(ms.filter(m => m.kind === 'team' && (m.department === view.organizer || m.kind === 'leadership')).map(m => m.id));
    ms = ms.filter(m => (m.kind === 'team' && m.department === view.organizer) || m.kind === 'leadership' || m.kind === 'board');
    rs = rs.filter(r => ids.has(r.meeting_id) || r.person === view.email);
  }
  if (view && view.board) { ms = ms.filter(m => m.kind === 'board'); const ids = new Set(ms.map(m => m.id)); rs = rs.filter(r => ids.has(r.meeting_id)); }
  fx.meet_meetings = ms; fx.meet_attendance = rs;
  fx.meet_sync_state = [{ id: 1, last_run_at: '2026-09-25T18:47:00Z', last_ok: true, note: 'synced', days: 8, meetings_n: ms.length, rows_n: rs.length }];
  return fx;
}
const MOCK = `(function(){ window.__INV = [];
  var t = setInterval(function(){ if (typeof db === 'undefined' || !db || !db.functions || db.functions.__w) return;
    db.functions.invoke = function (name, opts) { window.__INV.push({ name: name, body: opts && opts.body });
      return new Promise(function (res) { setTimeout(function () { res({ data: { ok: true, summary: { meetings: 3 } }, error: null }); }, 300); }); };
    db.functions.__w = 1; }, 5); })();`;
const team = f => f.ev(() => {
  const el = document.querySelector('#w144hr .w144teamdet'), meet = null;
  if (!el) return null;
  return { after: true, cols: [...el.querySelectorAll('.w144strip .col')].map(c => c.querySelector('b').textContent + '@' + c.querySelector('small').textContent + (c.classList.contains('on') ? '*' : '')),
    lead: (el.querySelector('.lead') || {}).textContent || '', det: (el.querySelector('.w144det') || {}).textContent || '', who: [...el.querySelectorAll('.w144ppl .r')].map(r => r.querySelector('a').textContent + '=' + r.querySelector('.n').textContent),
    dots: el.querySelectorAll('.w144ppl .w144dots i').length, more: (el.querySelector('.w144ppl .more') || {}).textContent || '', nudge: (el.querySelector('.w144nudge') || {}).textContent || '', text: el.textContent };
});

(async () => {
  const browser = await launch();
  /* Steel, an admin: no attendance on the team pages any more */
  let f = await fresh(browser, { who: 'admin', hash: '#team/marketing', fixture: fixture(null), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(1200);
  const onTeam = await f.ev(() => ({ card: !!document.getElementById('w144team'), meet: !!document.getElementById('w116meet') }));
  ok('a team page has no attendance card (wave149), even for an admin', onTeam.meet && !onTeam.card, onTeam);
  const tour = await f.ev(() => { const T = window.w122 && w122.tours && w122.tours.team; return T ? T.steps.map(x => x.s).indexOf('#w144team') : null; });
  ok('the team page tour has no attendance step', tour === -1, tour);

  /* the HR centre */
  await f.hash('#hrcentre', 1800);
  const hr = await f.ev(() => {
    const el = document.getElementById('w144hr'); if (!el) return null;
    return { rows: [...el.querySelectorAll('.w144tbl tbody tr')].map(r => [...r.cells].map(td => td.textContent.trim()).filter(Boolean).join(' ')), lead: el.querySelectorAll('.w144list')[0] ? [...el.querySelectorAll('.w144list')[0].querySelectorAll('li')].map(l => l.textContent) : [],
      board: el.querySelectorAll('.w144list')[1] ? [...el.querySelectorAll('.w144list')[1].querySelectorAll('li')].map(l => l.textContent) : [], text: el.textContent, btn: !!el.querySelector('[data-w144sync]') };
  });
  ok('the HR centre card lists every team', hr && hr.rows.length === 6 && hr.rows.some(r => /^Operations Toronto No team meeting/.test(r)) && hr.rows.some(r => /^Marketing \d of \d \d+%/.test(r)), hr && hr.rows);
  ok('the leadership meetings, newest first', hr && hr.lead.length === 4 && /came/.test(hr.lead[0]), hr && hr.lead);
  ok('the board meetings: the last one and each director over twelve months', hr && /5 of 6 directors came/.test(hr.board[0] || '') && hr.board.some(x => /1 of 2 in the last twelve months/.test(x)) && hr.board.some(x => /2 of 2 in the last twelve months/.test(x)), hr && hr.board);
  ok('worth a check-in is there', hr && /Worth a check-in/.test(hr.text) && /(Missed their own team|No one has missed)/.test(hr.text), hr && hr.text.slice(0, 300));
  /* a team's last eight meetings, opened from the card */
  await f.ev(() => [...document.querySelectorAll('#w144hr [data-w144team]')].filter(a => /^Marketing/.test(a.textContent))[0].click());
  await f.page.waitForTimeout(300);
  let c = await team(f);
  ok('six meetings, the last with no call', c && c.cols.length === 6 && /^no call@Sep 23/.test(c.cols[5]) && c.cols[0] === '3/8@Aug 19', c && c.cols);
  ok('the latest meeting with a call is open', c && c.cols[4] === '5/8@Sep 16*' && /Sep 16/.test(c.det) && /5 of 8 of the team came/.test(c.det) && /Came: /.test(c.det), c && [c.cols, c.det]);
  ok('the average over the meetings with a call', c && /Over the last 6 meetings \(5 with a call\), 48% of the team came on average/.test(c.lead), c && c.lead);
  ok('who comes: the team with a dot per meeting', c && c.who.length === 8 && c.dots === 48 && c.who.every(w => /=(\d+ of \d+|–)$/.test(w)), c && [c.who, c.dots]);
  ok('the others invited are folded into one line', c && /^Also invited: Steel \(\d of \d\)/.test(c.more), c && c.more);
  await f.ev(() => document.querySelector('#w144hr [data-w144m*="20260909"]').click());
  await f.page.waitForTimeout(200);
  c = await team(f);
  ok('clicking a meeting shows that day', c && /Sep 9/.test(c.det) && /5 of 8 of the team came/.test(c.det) && /Not on the call: /.test(c.det) && c.cols[3] === '5/8@Sep 9*', c && [c.det, c.cols]);
  await f.ev(() => document.querySelector('#w144hr [data-w144more]').click());
  await f.page.waitForTimeout(200);
  c = await team(f);
  ok('Show lists the others invited with their dots', c && c.who.length === 9 && /Hide the others invited/.test(c.text), c && c.who);
  await f.ev(() => [...document.querySelectorAll('#w144hr [data-w144team]')].filter(a => /^Operations Toronto/.test(a.textContent))[0].click());
  await f.page.waitForTimeout(300);
  c = await team(f);
  ok('a team with no meeting on the hub calendar says how to add it', c && /invites hub@welfareavenue.com/.test(c.text), c && c.text);
  await f.ev(() => document.querySelector('#w144hr [data-w144lm]').click());
  await f.page.waitForTimeout(200);
  const lm = await f.ev(() => [...document.querySelectorAll('#w144hr .w144list')[0].querySelectorAll('li')].length);
  ok('a leadership meeting opens to who came', lm === 5, lm);
  await f.ev(() => document.querySelector('[data-w144sync]').click());
  await f.page.waitForTimeout(100);
  const busy = await f.ev(() => { const b = document.querySelector('[data-w144sync]'); return b ? { dis: b.disabled, t: b.textContent } : null; });
  ok('Refresh now waits while it reads', busy && busy.dis && /Refreshing/.test(busy.t), busy);
  await f.page.waitForTimeout(900);
  const inv = await f.ev(() => window.__INV);
  ok('Refresh now asks meet-attendance for the last two weeks', inv.length === 1 && inv[0].name === 'meet-attendance' && inv[0].body.action === 'sync' && inv[0].body.days === 14, inv);
  const tourHr = await f.ev(() => { const T = window.w122 && w122.tours && w122.tours.hrcentre; if (!T) return null; const s = T.steps.map(x => x.s); const i = s.indexOf('#w144hr'); return { i, prev: s[i - 1] }; });
  ok('the HR centre tour has a step after Scope of work', tourHr && tourHr.i > 0 && tourHr.prev === '#w103scope', tourHr);

  /* the Board overview: nothing about attendance */
  await f.hash('#governance', 1800);
  const gov = await f.ev(() => ({ gov: !!document.getElementById('w126gov'), att: document.querySelectorAll('#w126gov .w144att, #w126gov .w144b').length }));
  ok('the Board overview shows no attendance (wave149)', gov.gov && gov.att === 0, gov);
  ok('no page errors (admin)', f.errs.length === 0, f.errs);
  await f.close();

  /* a team member (Samson, HR): nothing on the team page, no HR centre card */
  f = await fresh(browser, { who: 'member', hash: '#team/hr', fixture: fixture({ team: 'hr', email: 'samson.jules@welfareavenue.com' }), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(1200);
  const m1 = await f.ev(() => !!document.getElementById('w144team'));
  ok('a team member sees no attendance on the team page', m1 === false, m1);
  const hrM = await f.ev(() => { location.hash = '#hrcentre'; return new Promise(r => setTimeout(() => r(!!document.getElementById('w144hr')), 1200)); });
  ok('no HR centre card for a team member', hrM === false, hrM);
  ok('no page errors (member)', f.errs.length === 0, f.errs);
  await f.close();

  /* the person who runs Program Development's meeting (a leader): nothing on the team page */
  f = await fresh(browser, { who: 'leader', hash: '#team/progdev', fixture: fixture({ organizer: 'progdev', email: 'shima.butera@welfareavenue.com' }), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(1200);
  const l1 = await f.ev(() => !!document.getElementById('w144team'));
  ok('the person who runs the meeting sees no attendance card on the team page', l1 === false, l1);
  ok('no page errors (leader)', f.errs.length === 0, f.errs);
  await f.close();

  /* a director: no board decorations */
  f = await fresh(browser, { who: 'board', hash: '#governance', fixture: fixture({ board: true }), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(1500);
  const gb = await f.ev(() => document.querySelectorAll('#w126gov .w144att, #w126gov .w144b').length);
  ok('a director sees no attendance on the Board overview', gb === 0, gb);
  ok('no page errors (director)', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw144drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
