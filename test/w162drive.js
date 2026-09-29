/* w162drive.js: wave162, the Loom card at the top of the Transcript archive (admins only).
   The last pull and the next one; the counts; what needs a look (File it with a team and who sees it, Skip); the latest from
   Loom with how each was filed; Pull now (started, busy); the states before and after the key (no pull yet, no key, refused,
   a problem); nothing for a member; the tour stop; the Add a transcript text; a phone. usage: node test/w162drive.js [--shots] */
const { launch, fresh } = require('./boot');
const SP = '/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/';
const SHOTS = process.argv.indexOf('--shots') >= 0;
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 600) : '')); } }
const id = (c) => c.repeat(32);
const LAST = { id: 3, started_at: '2026-09-25T11:30:05+00:00', finished_at: '2026-09-25T11:31:40+00:00', why: 'schedule', status: 'ok', seen: 9, filed: 3, needs_look: 2, skipped: 1, waiting: 1, errors: 0, note: null };
const STATUS = {
  since: '2026-09-02', next_run: '2026-09-28T11:30:00+00:00', scheduled: true, last: LAST, last_ok: LAST, runs: [LAST],
  counts: { filed: 7, needs_look: 2, waiting: 1, skipped: 3, personal: 1 },
  look: [
    { loom_id: id('a'), title: 'Board Meeting - September 2026', recorded_at: '2026-09-20T15:00:00Z', meeting_date: '2026-09-20', duration_s: 5400, speakers: ['Steel MacDonald', 'Suhaib Abdillahi', 'Board Member One', 'Board Member Two', 'Board Member Three'], status: 'needs_look', reason: 'A board meeting: an admin decides where it goes', department: null, url: 'https://www.loom.com/share/' + id('a') },
    { loom_id: id('b'), title: 'Ahmed / Shima / Steel - September 10, 2026', recorded_at: '2026-09-10T15:00:00Z', meeting_date: '2026-09-10', duration_s: 1800, speakers: ['Ahmed Fakhir', 'Shima Butera', 'Steel MacDonald'], status: 'needs_look', reason: 'Which team it belongs to is unclear', department: null, url: 'https://www.loom.com/share/' + id('b') }
  ],
  recent: [
    { loom_id: id('c'), title: 'Weekly Operations Meeting - September 22, 2026', meeting_date: '2026-09-22', duration_s: 3120, speakers: ['Ahmed Fakhir', 'Eno Moffat'], status: 'filed', visibility: 'department', department: 'opsmtl', transcript_id: 170, reason: 'Team meeting, so everyone sees it', url: 'https://www.loom.com/share/' + id('c') },
    { loom_id: id('d'), title: 'Ian x Robert 1on1', meeting_date: '2026-09-21', duration_s: 2400, speakers: ['Ian Odhiambo', 'Robert Smith'], status: 'filed', visibility: 'private', allowed_people: ['Ahmed', 'Amanda', 'Ian', 'Kahkashan', 'Robert', 'Shima'], department: 'marketing', transcript_id: 171, reason: 'Not a team meeting, so it is confidential to the people in it and the leaders', url: 'https://www.loom.com/share/' + id('d') },
    { loom_id: id('e'), title: 'Leadership Strategy & Discussion - September 14, 2026', meeting_date: '2026-09-14', status: 'filed', visibility: 'leadership', department: 'Leadership meeting', transcript_id: 172, reason: 'Leadership meeting, so the leaders see it', url: 'https://www.loom.com/share/' + id('e') },
    { loom_id: id('f'), title: 'Website walkthrough', meeting_date: '2026-09-13', status: 'skipped', reason: 'One person speaking: a recording, not a meeting', speakers: ['Ian Odhiambo'], url: 'https://www.loom.com/share/' + id('f') },
    { loom_id: id('1'), title: 'Marketing Meeting - September 26, 2026', meeting_date: '2026-09-26', status: 'waiting', attempts: 2, reason: 'Loom has no transcript for it yet; the next pull tries again', url: 'https://www.loom.com/share/' + id('1') },
    { loom_id: id('2'), title: 'Human resources meeting - September 8, 2026', meeting_date: '2026-09-08', status: 'filed', visibility: 'department', department: 'hr', transcript_id: 168, reason: 'Team meeting, so everyone sees it' },
    { loom_id: id('3'), title: 'Program Development Meeting - September 7, 2026', meeting_date: '2026-09-07', status: 'filed', visibility: 'department', department: 'progdev', transcript_id: 167, reason: 'Team meeting, so everyone sees it' }
  ]
};
const read = () => {
  const c = document.getElementById('w162loom');
  if (!c) return null;
  const rows = [...c.querySelectorAll('.row')].map(r => ({ id: r.getAttribute('data-w162row'), chip: (r.querySelector('.chip') || {}).textContent, t: (r.querySelector('.t') || {}).textContent, s: [...r.querySelectorAll('.s')].map(x => x.textContent), acts: [...r.querySelectorAll('.acts a, .acts button')].map(x => x.textContent.trim()), open: (r.querySelector('a[href^="#tx/"]') || {}).getAttribute ? r.querySelector('a[href^="#tx/"]').getAttribute('href') : null }));
  const sec = document.getElementById('transcripts');
  return { prev: c.previousElementSibling ? c.previousElementSibling.className : null, next: c.nextElementSibling ? (c.nextElementSibling.querySelector('h2') || {}).textContent : null, inSection: c.parentElement === sec,
    when: (c.querySelector('.when') || {}).textContent, whenBad: !!c.querySelector('.when.bad'), tiles: [...c.querySelectorAll('.tile')].map(t => t.textContent.trim()), heads: [...c.querySelectorAll('h4')].map(h => h.textContent),
    rows, more: (c.querySelector('[data-w162more]') || {}).textContent || null, foot: (c.querySelector('.foot') || {}).textContent, pull: (c.querySelector('[data-w162pull]') || {}).textContent, pullDisabled: !!(c.querySelector('[data-w162pull]') || {}).disabled,
    forms: c.querySelectorAll('[data-w162form]').length };
};
const HOOK = `(function(){ window.__rpcLog = []; window.__fnLog = []; window.__fnReply = null; var t = setInterval(function(){ if (typeof db === 'undefined' || !db || !db.rpc) return; clearInterval(t);
  var o = db.rpc.bind(db); db.rpc = function (fn, args) { window.__rpcLog.push([fn, args]); if (fn === 'loom_video_decide') return Promise.resolve({ data: { loom_id: args.p_loom_id, status: 'skipped' }, error: null }); return o(fn, args); };
  db.functions.invoke = function (name, opts) { window.__fnLog.push([name, (opts && opts.body) || {}]); var r = window.__fnReply ? window.__fnReply(name, (opts && opts.body) || {}) : { data: null, error: null }; return Promise.resolve(r); };
}, 20); })();`;

(async () => {
  const browser = await launch();
  /* ---- an admin opens the Transcript archive ---- */
  let f = await fresh(browser, { who: 'admin', hash: '#transcripts', rpcs: { wa_org_editor: true, loom_pull_status: STATUS }, init: HOOK, wait: 5000 });
  await f.page.waitForTimeout(900);
  let b = await f.ev(read);
  ok('the Loom card sits at the top of the Transcript archive, after the masthead and before Add a transcript', b && b.inSection && /w118mast/.test(b.prev || '') && /Add a transcript/.test(b.next || ''), b && [b.prev, b.next]);
  ok('it says when the last pull ran, what it did and when the next one is', b && /Last pull Friday, September 25 at 7:30 AM: 3 meetings filed, 2 need a look, 1 waiting for its transcript, 1 skipped\. Next pull: Monday, September 28 at 7:30 AM\./.test(b.when || ''), b && b.when);
  ok('the counts since the start date', b && b.tiles.join('|') === '7filed since Sep 2|2need a look|1waiting for Loom|3skipped', b && b.tiles);
  ok('Needs a look comes first, then the latest from Loom', b && b.heads.join('|') === 'Needs a look|Latest from Loom', b && b.heads);
  const board = b && b.rows.find(r => r.id === 'a'.repeat(32));
  ok('a recording that needs a look: its reason, date, length and speakers, File it and Skip', board && board.chip === 'Needs a look' && /A board meeting: an admin decides where it goes/.test(board.s.join(' ')) && /Sep 20 · 1 h/.test(board.s[0]) && /Steel MacDonald, Suhaib Abdillahi, Board Member One, Board Member Two and 1 more/.test(board.s[0]) && board.acts.join('|') === 'Loom|File it|Skip', board);
  const ops = b && b.rows.find(r => r.id === 'c'.repeat(32));
  ok('a team meeting shows Everyone, its team and opens in the archive', ops && ops.chip === 'Everyone' && /Operations Montreal\. Team meeting, so everyone sees it/.test(ops.s.join(' ')) && ops.open === '#tx/170' && ops.acts.indexOf('File it') < 0, ops);
  const one = b && b.rows.find(r => r.id === 'd'.repeat(32));
  ok('a one-on-one shows Confidential with how many people', one && /^Confidential · 6$/.test(one.chip), one && one.chip);
  const lead = b && b.rows.find(r => r.id === 'e'.repeat(32));
  ok('a leadership meeting shows Leaders', lead && lead.chip === 'Leaders' && lead.s.indexOf('Leadership meeting, so the leaders see it') >= 0, lead);
  const solo = b && b.rows.find(r => r.id === 'f'.repeat(32));
  ok('a skipped recording can still be filed', solo && solo.chip === 'Skipped' && solo.acts.join('|') === 'Loom|File it', solo);
  ok('six of the latest show, with Show all', b && b.rows.filter(r => !/^[ab]+$/.test(r.id)).length === 6 && b.more === 'Show all 7', b && [b.rows.length, b.more]);
  ok('the note says what is filed how, the personal recordings left out, that Loom is only read and that it is not connected yet', b && /weekly team meetings are filed for everyone/.test(b.foot) && /1 personal recording was left out; nothing about them is kept/.test(b.foot) && /only reads Loom, as hub@welfareavenue\.com/.test(b.foot) && /Not connected through Atlassian yet\./.test(b.foot), b && b.foot);
  ok('not connected: a Connect Loom button beside Pull now', await f.ev(() => { const x = document.querySelector('#w162loom .hd [data-w162connect]'); return !!x && /Connect Loom/.test(x.textContent); }));
  if (SHOTS) await f.page.screenshot({ path: SP + 'w162_card.png', fullPage: false });
  await f.ev(() => document.querySelector('[data-w162more]').click());
  await f.page.waitForTimeout(150);
  b = await f.ev(read);
  ok('Show all shows the seven', b && b.rows.length === 9 && b.more === 'Show fewer', b && [b.rows.length, b.more]);
  /* File it */
  await f.ev(() => document.querySelector('[data-w162row="' + 'b'.repeat(32) + '"] [data-w162file]').click());
  await f.page.waitForTimeout(150);
  let form = await f.ev(() => { const x = document.querySelector('[data-w162form]'); return x && { team: x.querySelector('[data-w162team]').value, teams: [...x.querySelectorAll('[data-w162team] option')].map(o => o.textContent), vis: [...x.querySelectorAll('[data-w162vis] option')].map(o => o.value + ':' + o.textContent), v: x.querySelector('[data-w162vis]').value }; });
  ok('File it opens a form: the team (no board; Finance too) and who sees it, confidential first, a one-on-one next', form && form.team === '' && form.teams.length === 9 && form.teams.indexOf('Finance') > 0 && form.teams.indexOf('Leadership meeting') > 0 && !form.teams.some(t => /board/i.test(t)) && form.v === 'private' && form.vis.join('|') === 'private:Confidential: the people in it and the leaders|speakers:One-on-one: only the people speaking in it|leadership:Leaders only|department:Everyone', form); /* wave165: Finance, and a one-on-one for its speakers */
  await f.ev(() => document.querySelector('[data-w162save]').click());
  await f.page.waitForTimeout(200);
  let fl = await f.ev(() => window.__fnLog.slice());
  let tt = await f.ev(() => (document.getElementById('toast') || {}).textContent);
  ok('without a team it asks for one and files nothing', fl.length === 0 && /Pick the team it belongs to/.test(tt || ''), [fl, tt]);
  await f.ev(() => { window.__fnReply = (n, body) => body.action === 'file' ? { data: { ok: true, transcript_id: 180, already: false }, error: null } : { data: null, error: null };
    const x = document.querySelector('[data-w162form]'); x.querySelector('[data-w162team]').value = 'opsmtl'; x.querySelector('[data-w162vis]').value = 'private'; x.querySelector('[data-w162save]').click(); });
  await f.page.waitForTimeout(600);
  fl = await f.ev(() => window.__fnLog.slice());
  tt = await f.ev(() => (document.getElementById('toast') || {}).textContent);
  b = await f.ev(read);
  ok('filing sends the Loom id, the team and who sees it to loom-pull', fl.length === 1 && fl[0][0] === 'loom-pull' && JSON.stringify(fl[0][1]) === JSON.stringify({ action: 'file', loom_id: 'b'.repeat(32), department: 'opsmtl', visibility: 'private' }), fl);
  ok('then says so, closes the form and reloads the card', /Filed\. The team page updates in a few minutes\./.test(tt || '') && b.forms === 0 && (await f.ev(() => window.__rpcLog.filter(x => x[0] === 'loom_pull_status').length)) >= 2, [tt, b.forms]);
  /* a refusal from the function is shown */
  await f.ev(() => { window.__fnReply = () => ({ data: null, error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({ ok: false, error: 'That recording looks personal, so the Hub leaves it out' }) } } });
    document.querySelector('[data-w162row="' + 'a'.repeat(32) + '"] [data-w162file]').click(); });
  await f.page.waitForTimeout(150);
  await f.ev(() => { const x = document.querySelector('[data-w162form]'); x.querySelector('[data-w162team]').value = 'Leadership meeting'; x.querySelector('[data-w162save]').click(); });
  await f.page.waitForTimeout(600);
  fl = await f.ev(() => window.__fnLog.slice());
  tt = await f.ev(() => (document.getElementById('toast') || {}).textContent);
  ok('Leadership meeting with Confidential is filed for the leaders', fl.length === 2 && fl[1][1].department === 'Leadership meeting' && fl[1][1].visibility === 'leadership', fl[1]);
  ok('a refusal is shown in plain words and the form stays', /Not filed: That recording looks personal/.test(tt || '') && (await f.ev(() => document.querySelectorAll('[data-w162form]').length)) === 1, tt);
  await f.ev(() => document.querySelector('[data-w162cancel]').click());
  await f.page.waitForTimeout(120);
  ok('Cancel closes the form', (await f.ev(() => document.querySelectorAll('[data-w162form]').length)) === 0);
  /* Skip */
  await f.ev(() => document.querySelector('[data-w162row="' + 'b'.repeat(32) + '"] [data-w162skip]').click());
  await f.page.waitForTimeout(400);
  const sk = await f.ev(() => window.__rpcLog.filter(x => x[0] === 'loom_video_decide'));
  tt = await f.ev(() => (document.getElementById('toast') || {}).textContent);
  ok('Skip asks loom_video_decide and says it can be filed later', sk.length === 1 && sk[0][1].p_loom_id === 'b'.repeat(32) && sk[0][1].p_action === 'skip' && /Skipped/.test(tt || ''), [sk, tt]);
  /* Pull now */
  await f.ev(() => { window.__fnReply = (n, body) => body.action === 'sync' ? { data: { ok: true, accepted: true, run: 4 }, error: null } : { data: null, error: null }; });
  await f.ev(() => document.querySelector('[data-w162pull]').click());
  await f.page.waitForTimeout(250);
  b = await f.ev(read);
  fl = await f.ev(() => window.__fnLog.slice());
  tt = await f.ev(() => (document.getElementById('toast') || {}).textContent);
  ok('Pull now starts a pull and says it is pulling', fl[fl.length - 1][1].action === 'sync' && b.pullDisabled && /Pulling/.test(b.pull) && /Pulling from Loom now/.test(b.when) && /Pulling from Loom\. The list updates/.test(tt || ''), [fl[fl.length - 1], b.pull, b.when, tt]);
  await f.ev(() => { window.__WA_RPCS.loom_pull_status = Object.assign({}, window.__WA_RPCS.loom_pull_status, { last: { id: 4, started_at: '2026-09-25T20:00:00+00:00', why: 'pull now (Steel)', status: 'ok', filed: 2, needs_look: 0, skipped: 0, waiting: 0, errors: 0 } }); });
  await f.page.waitForTimeout(8800);
  b = await f.ev(read);
  tt = await f.ev(() => (document.getElementById('toast') || {}).textContent);
  ok('when the pull ends the card shows it and the button comes back', b && !b.pullDisabled && /Pull now/.test(b.pull) && /\(pull now \(Steel\)\): 2 meetings filed\./.test(b.when) && /Loom: 2 meetings filed/.test(tt || ''), b && [b.pull, b.when, tt]);
  /* busy */
  await f.ev(() => { window.__fnReply = () => ({ data: null, error: { message: 'non-2xx', context: { json: async () => ({ ok: false, busy: true, error: 'A pull is already running' }) } } }); document.querySelector('[data-w162pull]').click(); });
  await f.page.waitForTimeout(500);
  tt = await f.ev(() => (document.getElementById('toast') || {}).textContent);
  b = await f.ev(read);
  ok('a pull already running is said so and the button comes back', /A pull is already running/.test(tt || '') && !b.pullDisabled, [tt, b.pullDisabled]);
  /* the tour stop and the upload text */
  const tour = await f.ev(() => { const s = (window.w122 && w122.tours && w122.tours.transcripts && w122.tours.transcripts.steps) || []; return s.map(x => x.s).slice(0, 3); });
  ok('the Transcript archive tour stops at the Loom card after the masthead', tour[0] === '#transcripts > .w118mast' && tour[1] === '#w162loom', tour);
  /* the Add a transcript line about Loom (wave162d, applied once the first pull worked, 29/09/26) */
  const up = await f.ev(() => { const h = [...document.querySelectorAll('#transcripts .card h2')].find((x) => /Add a transcript/.test(x.textContent)); const p = h && h.parentElement.querySelector('p.read'); return p ? p.textContent : null; });
  ok('Add a transcript says meetings on the Hub’s Loom account come in by themselves on Monday, Wednesday and Friday mornings', /Meetings recorded on the Hub’s Loom account \(hub@welfareavenue\.com\) come in by themselves on Monday, Wednesday and Friday mornings, so there is no need to paste those\./.test(up || ''), up);
  /* and the Loom row in Settings, Connections */
  await f.ev(() => window.w116Settings('connections'));
  await f.page.waitForTimeout(1200);
  const lrow = await f.ev(() => { const r = Array.from(document.querySelectorAll('.w116js .row')).find((x) => /Loom, Otter, Plaud/.test((x.querySelector('b') || {}).textContent || '')); return r ? (r.querySelector('.s') || {}).textContent : null; });
  ok('Settings, Connections: the Loom row says Loom meetings come in by themselves and Otter and Plaud come in by upload or email', /come in by themselves on Monday, Wednesday and Friday mornings\. Otter and Plaud reach the hub through the Transcript Archive upload or by cc'ing hub@ on the summary email\./.test(lrow || ''), lrow);
  await f.ev(() => { if (typeof closeModal === 'function') closeModal(); });
  ok('no page errors (admin)', f.errs.length === 0, f.errs);
  await f.close();

  /* ---- the states around the key ---- */
  const states = [
    [{ since: '2026-09-02', next_run: '2026-09-30T11:30:00+00:00', scheduled: true, last: null, counts: {}, look: [], recent: [] }, /No pull has run yet\. Next pull: Wednesday, September 30 at 7:30 AM\./, false, 'before the first pull'],
    [{ since: '2026-09-02', next_run: '2026-09-30T11:30:00+00:00', scheduled: true, last: { status: 'no_key', started_at: '2026-09-28T23:40:00Z' }, counts: {}, look: [], recent: [] }, /Loom is not connected yet\. Press Connect Loom, sign in to Atlassian as hub@welfareavenue\.com/, true, 'not connected'],
    [{ since: '2026-09-02', next_run: '2026-09-30T11:30:00+00:00', scheduled: true, last: { status: 'refused', started_at: '2026-09-28T11:30:00Z', note: 'The Loom connection has lapsed' }, counts: {}, look: [], recent: [] }, /Atlassian refused the Loom connection on Monday, September 28 at 7:30 AM \(The Loom connection has lapsed\)\. Press Connect Loom and approve it again/, true, 'a refused connection'],
    [{ since: '2026-09-02', next_run: null, scheduled: false, last: { status: 'error', started_at: '2026-09-28T11:30:00Z', note: 'Atlassian did not answer tools/call within 45 seconds' }, counts: {}, look: [], recent: [] }, /hit a problem: Atlassian did not answer tools\/call within 45 seconds\. It tries again at the next pull\. The schedule is not on yet\./, true, 'a problem, schedule off']
  ];
  for (const [st, re, bad, name] of states) {
    f = await fresh(browser, { who: 'admin', hash: '#transcripts', rpcs: { wa_org_editor: true, loom_pull_status: st }, wait: 4500 });
    await f.page.waitForTimeout(700);
    b = await f.ev(read);
    ok('the card says it: ' + name, b && re.test(b.when || '') && b.whenBad === bad && b.heads.length === 0, b && [b.when, b.whenBad]);
    ok('no page errors (' + name + ')', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* ---- connected: no button, the note says since when ---- */
  f = await fresh(browser, { who: 'admin', hash: '#transcripts', rpcs: { wa_org_editor: true, loom_pull_status: Object.assign({}, STATUS, { connected: true, connected_at: '2026-09-28T23:50:00Z' }) }, wait: 4500 });
  await f.page.waitForTimeout(700);
  b = await f.ev(read);
  ok('connected: no Connect Loom button, and the note says since when with connect again', b && !(await f.ev(() => !!document.querySelector('#w162loom .hd [data-w162connect]'))) && /Connected through Atlassian since Sep 28 \(connect again\)\./.test(b.foot), b && b.foot);
  await f.close();

  /* ---- Connect Loom opens Atlassian's approval ---- */
  f = await fresh(browser, { who: 'admin', hash: '#transcripts', rpcs: { wa_org_editor: true, loom_pull_status: STATUS }, init: HOOK, wait: 4500 });
  await f.page.waitForTimeout(700);
  await f.ev(() => { window.__fnReply = (n, body) => n === 'loom-connect' && body.action === 'start' ? { data: { ok: true, url: 'http://wahub.test/?atl=approve#transcripts' }, error: null } : { data: null, error: null }; document.querySelector('[data-w162connect]').click(); });
  await f.page.waitForTimeout(2500);
  const went = await f.page.url();
  ok('Connect Loom asks loom-connect to start and goes to the approval page it returns', /\?atl=approve#transcripts$/.test(went), went);
  await f.close();

  /* ---- back from Atlassian ---- */
  for (const [q, re, name] of [['?loom=connected', /Loom is connected\. The next pull uses it\./, 'connected'], ['?loom=error&why=That%20Atlassian%20account%20cannot%20see%20the%20Welfare%20Avenue%20Loom', /Loom was not connected: That Atlassian account cannot see the Welfare Avenue Loom/, 'an error'], ['?loom=cancelled&why=access_denied', /Connecting Loom was cancelled/, 'cancelled']]) {
    f = await fresh(browser, { who: 'admin', hash: q + '#transcripts', rpcs: { wa_org_editor: true, loom_pull_status: STATUS }, wait: 3000 });
    await f.page.waitForTimeout(2600);
    const back = await f.ev(() => ({ toast: (document.getElementById('toast') || {}).textContent, url: location.search + location.hash }));
    ok('back from Atlassian (' + name + '): it says so and tidies the address', re.test(back.toast || '') && back.url === '#transcripts', back);
    ok('no page errors (back, ' + name + ')', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* ---- a member: no card, no call ---- */
  f = await fresh(browser, { who: 'member', hash: '#transcripts', rpcs: { loom_pull_status: STATUS }, init: HOOK, wait: 4500 });
  await f.page.waitForTimeout(700);
  b = await f.ev(read);
  const calls = await f.ev(() => window.__rpcLog.filter(x => x[0] === 'loom_pull_status').length);
  ok('a member sees no Loom card and the Hub does not ask for it', b === null && calls === 0, [b, calls]);
  ok('no page errors (member)', f.errs.length === 0, f.errs);
  await f.close();

  /* ---- a phone ---- */
  f = await fresh(browser, { who: 'admin', hash: '#transcripts', rpcs: { wa_org_editor: true, loom_pull_status: STATUS }, wait: 5000, width: 390 });
  await f.page.waitForTimeout(800);
  await f.ev(() => { const x = document.querySelector('[data-w162row="' + 'a'.repeat(32) + '"] [data-w162file]'); if (x) x.click(); });
  await f.page.waitForTimeout(200);
  const m = await f.ev(() => { const c = document.getElementById('w162loom'); const r = c && c.getBoundingClientRect(); const sel = c && c.querySelector('[data-w162vis]'); const sr = sel && sel.getBoundingClientRect(); return { has: !!c, w: r ? Math.round(r.width) : 0, over: document.documentElement.scrollWidth - window.innerWidth, selRight: sr ? Math.round(sr.right) : 0 }; });
  ok('on a phone the card and its form fit and the page does not scroll sideways', m.has && m.w <= 390 && m.over <= 1 && m.selRight <= 390, m);
  if (SHOTS) await f.page.screenshot({ path: SP + 'w162_phone.png', fullPage: false });
  ok('no page errors (phone)', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw162drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
