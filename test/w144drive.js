/* w144drive.js: Meet attendance (wave144) on the team pages, in the HR centre and on the Board overview.
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
  const el = document.getElementById('w144team'), meet = document.getElementById('w116meet');
  if (!el) return null;
  return { after: !!meet && meet.nextElementSibling === el, cols: [...el.querySelectorAll('.w144strip .col')].map(c => c.querySelector('b').textContent + '@' + c.querySelector('small').textContent + (c.classList.contains('on') ? '*' : '')),
    lead: (el.querySelector('.lead') || {}).textContent || '', det: (el.querySelector('.w144det') || {}).textContent || '', who: [...el.querySelectorAll('.w144ppl .r')].map(r => r.querySelector('a').textContent + '=' + r.querySelector('.n').textContent),
    dots: el.querySelectorAll('.w144ppl .w144dots i').length, more: (el.querySelector('.w144ppl .more') || {}).textContent || '', nudge: (el.querySelector('.w144nudge') || {}).textContent || '', text: el.textContent };
});

(async () => {
  const browser = await launch();
  /* Steel, an admin: the Marketing page */
  let f = await fresh(browser, { who: 'admin', hash: '#team/marketing', fixture: fixture(null), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(1200);
  let c = await team(f);
  ok('the attendance card sits under Upcoming meetings', c && c.after, c);
  ok('six meetings, the last with no call', c && c.cols.length === 6 && /^no call@Sep 23/.test(c.cols[5]) && c.cols[0] === '3/8@Aug 19', c && c.cols);
  ok('the latest meeting with a call is open', c && c.cols[4] === '5/8@Sep 16*' && /Sep 16/.test(c.det) && /5 of 8 of the team came/.test(c.det) && /Came: /.test(c.det), c && [c.cols, c.det]);
  ok('the average over the meetings with a call', c && /Over the last 6 meetings \(5 with a call\), 48% of the team came on average/.test(c.lead), c && c.lead);
  ok('who comes: the team with a dot per meeting', c && c.who.length === 8 && c.dots === 48 && c.who.every(w => /=(\d+ of \d+|–)$/.test(w)), c && [c.who, c.dots]);
  ok('the others invited are folded into one line', c && /^Also invited: Steel \(\d of \d\)/.test(c.more), c && c.more);
  await f.ev(() => document.querySelector('#w144team [data-w144m*="20260909"]').click());
  await f.page.waitForTimeout(200);
  c = await team(f);
  ok('clicking a meeting shows that day', c && /Sep 9/.test(c.det) && /5 of 8 of the team came/.test(c.det) && /Not on the call: /.test(c.det) && c.cols[3] === '5/8@Sep 9*', c && [c.det, c.cols]);
  await f.ev(() => document.querySelector('#w144team [data-w144more]').click());
  await f.page.waitForTimeout(200);
  c = await team(f);
  ok('Show lists the others invited with their dots', c && c.who.length === 9 && /Hide the others invited/.test(c.text), c && c.who);
  const tip = await f.ev(() => { document.querySelector('#w144team [data-w144help]').click(); const n = document.querySelector('#w144team [data-w144note]'); return n && !n.hidden ? n.textContent : ''; });
  ok('from Google Meet explains how it is counted', /three minutes on the call/.test(tip) && /notetakers are left out/.test(tip), tip);
  const tour = await f.ev(() => { const T = window.w122 && w122.tours && w122.tours.team; if (!T) return null; const s = T.steps.map(x => x.s); const i = s.indexOf('#w144team'); return { i, prev: s[i - 1] }; });
  ok('the team page tour has a step after Upcoming meetings', tour && tour.i > 0 && tour.prev === '#w116meet', tour);
  await f.hash('#team/opsto', 1500);
  c = await team(f);
  ok('a team with no meeting on the hub calendar says how to add it (admins)', c && /invites hub@welfareavenue.com/.test(c.text), c && c.text);
  await f.hash('#team/progdev', 1500);
  c = await team(f);
  ok('the card follows the team page', c && c.cols.length === 4 && /Aug 31/.test(c.det), c && [c.cols, c.det]);
  ok('no page errors (admin, team pages)', f.errs.length === 0, f.errs);

  /* the HR centre */
  await f.hash('#hrcentre', 1800);
  const hr = await f.ev(() => {
    const el = document.getElementById('w144hr'); if (!el) return null;
    return { rows: [...el.querySelectorAll('.w144tbl tbody tr')].map(r => [...r.cells].map(td => td.textContent.trim()).filter(Boolean).join(' ')), lead: el.querySelectorAll('.w144list')[0] ? [...el.querySelectorAll('.w144list')[0].querySelectorAll('li')].map(l => l.textContent) : [],
      text: el.textContent, btn: !!el.querySelector('[data-w144sync]') };
  });
  ok('the HR centre card lists every team', hr && hr.rows.length === 6 && hr.rows.some(r => /^Operations Toronto No team meeting/.test(r)) && hr.rows.some(r => /^Marketing \d of \d \d+%/.test(r)), hr && hr.rows);
  ok('the leadership meetings, newest first', hr && hr.lead.length === 4 && /came/.test(hr.lead[0]), hr && hr.lead);
  ok('worth a check-in is there', hr && /Worth a check-in/.test(hr.text) && /(Missed their own team|No one has missed)/.test(hr.text), hr && hr.text.slice(0, 300));
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

  /* the Board overview */
  await f.hash('#governance', 1800);
  const gov = await f.ev(() => ({ last: (document.querySelector('#w126gov .w126meet .w144att') || {}).textContent || '', dirs: [...document.querySelectorAll('#w126gov .w126dir')].map(d => d.getAttribute('data-w126dir') + ':' + ((d.querySelector('.w144b:not([hidden])') || {}).textContent || '')) }));
  ok('the last board meeting says how many directors came', gov.last === '5 of 6 directors came', gov);
  ok('each director shows their board meetings', gov.dirs.some(x => x === '4:Board meetings: 1 of 2') && gov.dirs.some(x => x === '1:Board meetings: 2 of 2'), gov.dirs);
  ok('no page errors (admin)', f.errs.length === 0, f.errs);
  await f.close();

  /* a team member (Samson, HR): the counts and his own attendance, nobody else's */
  f = await fresh(browser, { who: 'member', hash: '#team/hr', fixture: fixture({ team: 'hr', email: 'samson.jules@welfareavenue.com' }), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(1200);
  c = await team(f);
  ok('a team member sees the counts', c && c.cols.length === 8 && /of the team came on average/.test(c.lead), c && [c.cols, c.lead]);
  ok('and their own attendance', c && /You came to \d+ of the \d+ you were invited to/.test(c.lead), c && c.lead);
  ok('but not who came', c && c.who.length === 0 && !/Came: /.test(c.det) && !c.nudge, c && [c.who, c.det]);
  const hrM = await f.ev(() => { location.hash = '#hrcentre'; return new Promise(r => setTimeout(() => r(!!document.getElementById('w144hr')), 1200)); });
  ok('no HR centre card for a team member', hrM === false, hrM);
  ok('no page errors (member)', f.errs.length === 0, f.errs);
  await f.close();

  /* the person who runs Program Development's meeting (Shima, a leader) */
  f = await fresh(browser, { who: 'leader', hash: '#team/progdev', fixture: fixture({ organizer: 'progdev', email: 'shima.butera@welfareavenue.com' }), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(1200);
  c = await team(f);
  ok('the person who runs the meeting sees who came', c && c.who.length >= 3 && /Came: /.test(c.det), c && [c.who, c.det]);
  ok('two meetings with no call are marked', c && c.cols.filter(x => /^no call/.test(x)).length === 2, c && c.cols);
  ok('no page errors (leader)', f.errs.length === 0, f.errs);
  await f.close();

  /* a director (Tamara): the board decorations */
  f = await fresh(browser, { who: 'board', hash: '#governance', fixture: fixture({ board: true }), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(1500);
  const gb = await f.ev(() => ({ last: (document.querySelector('#w126gov .w126meet .w144att') || {}).textContent || '', mine: ((document.querySelector('#w126gov .w126dir[data-w126dir="4"] .w144b') || {}).textContent || '') }));
  ok('a director sees how many directors came to the last meeting', gb.last === '5 of 6 directors came', gb);
  ok('and their own board meetings', gb.mine === 'Board meetings: 1 of 2', gb);
  ok('no page errors (director)', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw144drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
