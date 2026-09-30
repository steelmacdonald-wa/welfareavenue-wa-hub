/* w180drive.js: wave180, announcements that lead to a poll or a short form the team answers.
   Steel (29/09/26): "I'd also like for leaders to be able ot make announcements that lead to forms or polls that our team can
   answer." His answers (30/09/26): the top of Home plus one Slack post; polls and short forms answered in the Hub, the poster
   sees the results and who has not answered; leaders post to their own team or everyone, HR and admins to anyone.
   The roster is the live team (scratchpad fx169.json); the announcements and answers are made up. The database calls
   (wa180_answer, wa180_results, the insert and updates of hub_announcements) are caught by a spy that answers as the database
   does. wave180d: where it went (the Slack post and the email), the email box on the post form, the link kept through the
   sign-in. Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26 16:00 Toronto). CAND=<file>; SHOTS=1 saves screenshots. */
const fs = require('fs');
const { launch, fresh, loadFixture } = require('./boot');
const SP = '/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/';
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 700) : '')); } }
const ROSTER = JSON.parse(fs.readFileSync(SP + 'fx169.json', 'utf8'));
const clone = o => JSON.parse(JSON.stringify(o));
const STEEL = 'steel.macdonald@welfareavenue.com';
const A = [
  { id: 101, kind: 'general', title: 'Saturday serving start time', body: 'We are moving the Saturday serving earlier in October.', audience: 'teams', teams: ['opsmtl'], ask: { type: 'poll', question: 'Which start time works for you?', options: ['9 am', '10 am', '11 am'], multi: false }, anonymous: false, show_results: true, closes_at: '2026-09-28T03:59:00Z', pinned: false, expires_at: null, created_by: STEEL, created_name: 'Steel', created_at: '2026-09-25T15:00:00Z', post_slack: true, slack: { posts: [{ team: 'opsmtl', channel: 'operations-mtl' }], errors: [], at: '2026-09-25T15:00:05Z' }, post_email: true, emailed: { state: 'sent', sent: 4, to_count: 4, failed: [], at: '2026-09-25T15:00:09Z' }, link: null, department: 'opsmtl' },
  { id: 102, kind: 'general', title: 'Gala volunteers survey', body: null, audience: 'everyone', teams: [], ask: { type: 'form', questions: [{ id: 'q1', label: 'What would you like to do at the gala?', type: 'short', required: true }, { id: 'q2', label: 'Which shift?', type: 'one', options: ['Setup', 'Evening'] }, { id: 'q3', label: 'Can you bring a friend?', type: 'yesno' }] }, anonymous: true, show_results: true, closes_at: null, pinned: false, expires_at: null, created_by: STEEL, created_name: 'Steel', created_at: '2026-09-24T14:00:00Z', post_slack: true, slack: null, post_email: true, emailed: { state: 'partly sent', sent: 27, to_count: 29, failed: ['Mary', 'Ola'], at: '2026-09-24T14:00:20Z' }, link: null, department: null },
  { id: 103, kind: 'general', title: 'Sponsor packages', body: null, audience: 'teams', teams: ['fundraising'], ask: { type: 'poll', question: 'Which tiers should we keep?', options: ['Gold', 'Silver', 'Bronze'], multi: true }, anonymous: false, show_results: true, closes_at: null, pinned: false, expires_at: null, created_by: 'amanda.zoldak@welfareavenue.com', created_name: 'Amanda', created_at: '2026-09-23T14:00:00Z', post_slack: true, slack: null, link: null, department: 'fundraising' },
  { id: 104, kind: 'general', title: 'The Hub has announcements now', body: 'Leaders can post news, polls and short forms here.', audience: 'everyone', teams: [], ask: null, anonymous: false, show_results: true, closes_at: null, pinned: true, expires_at: null, created_by: STEEL, created_name: 'Steel', created_at: '2026-09-22T14:00:00Z', post_slack: false, slack: null, link: null, department: null },
  { id: 105, kind: 'general', title: 'Leadership retreat date', body: null, audience: 'leaders', teams: [], ask: { type: 'poll', question: 'Which weekend?', options: ['Oct 17', 'Oct 24'], multi: false }, anonymous: false, show_results: true, closes_at: '2026-09-24T12:00:00Z', pinned: false, expires_at: null, created_by: STEEL, created_name: 'Steel', created_at: '2026-09-21T14:00:00Z', post_slack: true, slack: null, link: null, department: null },
  { id: 106, kind: 'general', title: 'Old news', body: null, audience: 'everyone', teams: [], ask: null, anonymous: false, show_results: true, closes_at: null, pinned: false, expires_at: '2026-09-24', created_by: STEEL, created_name: 'Steel', created_at: '2026-09-20T14:00:00Z', post_slack: false, slack: null, link: null, department: null },
  { id: 107, kind: 'general', title: 'Brand colours for the fall', body: null, audience: 'teams', teams: ['marketing'], ask: { type: 'poll', question: 'Which palette?', options: ['Green and gold', 'Cream and green'], multi: false }, anonymous: false, show_results: false, closes_at: null, pinned: false, expires_at: null, created_by: STEEL, created_name: 'Steel', created_at: '2026-09-25T12:00:00Z', post_slack: true, slack: null, link: null, department: 'marketing' }
];
function fx(answers) {
  const f = loadFixture();
  f.team_members = ROSTER.map(m => ({ id: m.id, name: m.name, email: m.email, department: m.department, active: true, role: m.role }));
  f.hub_roles = ROSTER.filter(m => m.email && m.hub_role).map(m => ({ email: m.email, role: m.hub_role, profile: m.profile, tabs: null, note: m.name }));
  f.hub_announcements = clone(A);
  f.hub_announcement_answers = clone(answers || []);
  return f;
}
/* what the database answers (window.__R180 can change mid-test); every call is kept */
const RESULTS = {
  101: { ok: true, visible: true, manage: true, anonymous: false, type: 'poll', answered: 1, closed: false, mine: null, audience: 5, missing_count: 4, missing: ['Ahmed', 'Eno Moffat', 'Ibrahim Awad', 'Mary'], rows: [{ name: 'Eleftherios Katsipis', at: '2026-09-25T15:30:00Z', answers: { choice: [1] } }], questions: [{ id: 'choice', label: 'Which start time works for you?', type: 'one', options: [{ label: '9 am', count: 0, names: [] }, { label: '10 am', count: 1, names: ['Eleftherios Katsipis'] }, { label: '11 am', count: 0, names: [] }] }] },
  102: { ok: true, visible: true, manage: true, anonymous: true, type: 'form', answered: 2, closed: false, mine: null, audience: 30, missing_count: 28, missing: null, rows: [{ name: null, at: null, answers: { q1: 'Welcome desk', q2: 1, q3: true } }, { name: null, at: null, answers: { q1: 'Photos, please', q2: 0 } }], questions: [{ id: 'q1', label: 'What would you like to do at the gala?', type: 'short', count: 2, values: [{ v: 'Welcome desk' }, { v: 'Photos, please' }] }, { id: 'q2', label: 'Which shift?', type: 'one', options: [{ label: 'Setup', count: 1 }, { label: 'Evening', count: 1 }] }, { id: 'q3', label: 'Can you bring a friend?', type: 'yesno', options: [{ label: 'Yes', count: 1 }, { label: 'No', count: 0 }] }] },
  107: { ok: true, visible: false, manage: false, mine: null, answered: 3, closed: false }
};
const INIT = `(function(){ window.__R180 = ${JSON.stringify(RESULTS)}; window.__rpc = []; window.__w = []; var _s;
  Object.defineProperty(window, 'supabase', { configurable: true, get: function () { return _s; }, set: function (v) {
    var cc = v.createClient; v.createClient = function () { var c = cc.apply(this, arguments);
      var orpc = c.rpc.bind(c);
      c.rpc = function (fn, args) {
        if (fn !== 'wa180_results' && fn !== 'wa180_answer') return orpc(fn, args);
        window.__rpc.push({ fn: fn, args: JSON.parse(JSON.stringify(args || null)) });
        var R = window.__R180 || {};
        if (fn === 'wa180_results') { var v2 = R[args.p_id]; return Promise.resolve({ data: v2 ? JSON.parse(JSON.stringify(v2)) : { ok: false, error: 'This one is not for you.' }, error: null }); }
        if (window.__ANS_ERR) return Promise.resolve({ data: null, error: { message: window.__ANS_ERR } });
        window.__MINE = (window.__MINE || JSON.parse(JSON.stringify((window.__WAFIX || {}).hub_announcement_answers || []))).filter(function (x) { return x.announcement_id !== args.p_id; }).concat([{ announcement_id: args.p_id, answers: args.p_answers, updated_at: '2026-09-25T20:00:00Z' }]);
        var res = R[args.p_id] ? JSON.parse(JSON.stringify(R[args.p_id])) : { ok: true, visible: false };
        if (res.questions && res.questions[0] && args.p_answers.choice) { res.questions[0].options.forEach(function (o, i) { if (args.p_answers.choice.indexOf(i) >= 0) o.count += 1; }); res.answered += 1; }
        res.mine = args.p_answers;
        return new Promise(function (r) { setTimeout(function () { r({ data: { ok: true, answers: args.p_answers, results: res }, error: null }); }, 60); });
      };
      var ofrom = c.from.bind(c);
      c.from = function (t) {
        if (t === 'hub_announcement_answers') {   /* the person's own answers, as the database keeps them */
          var fb = {}; ['select', 'eq', 'in', 'limit', 'order', 'gte'].forEach(function (k) { fb[k] = function () { return fb; }; });
          fb.then = function (a, r) { var rows = window.__MINE || ((window.__WAFIX || {}).hub_announcement_answers || []); return Promise.resolve({ data: JSON.parse(JSON.stringify(rows)), error: null }).then(a, r); };
          return fb;
        }
        var b = ofrom(t);
        if (t !== 'hub_announcements') return b;
        var oi = b.insert.bind(b), ou = b.update.bind(b);
        b.insert = function (row) {
          window.__w.push({ m: 'insert', row: JSON.parse(JSON.stringify(row)) });
          var res = window.__POST_ERR ? { data: null, error: { message: window.__POST_ERR } } : { data: { id: 900 + window.__w.length, created_at: '2026-09-25T20:00:00Z' }, error: null };
          var fake = { select: function () { return fake; }, single: function () { return fake; }, then: function (a, r) { return Promise.resolve(res).then(a, r); } };
          return fake;
        };
        b.update = function (p) { window.__w.push({ m: 'update', row: JSON.parse(JSON.stringify(p)) }); return ou(p); };
        return b;
      };
      return c; };
    _s = v; } }); })();`;
const CAND = process.env.CAND || undefined;
const rpcs = (f, fn) => f.ev(x => (window.__rpc || []).filter(c => !x || c.fn === x), fn);
const writes = f => f.ev(() => window.__w || []);
async function click(f, sel, ms) { const n = await f.ev(s => { const el = document.querySelector(s); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; }, sel); await f.page.waitForTimeout(ms || 500); return n; }
async function type(f, sel, val, ev) { return f.ev(a => { const el = document.querySelector(a[0]); if (!el) return false; el.value = a[1]; el.dispatchEvent(new Event(a[2] || 'input', { bubbles: true })); return true; }, [sel, val, ev]); }
const SHOT = process.env.SHOTS ? SP + 'w180/' : null;
if (SHOT && !fs.existsSync(SHOT)) fs.mkdirSync(SHOT, { recursive: true });
async function shot(f, name, full) { if (SHOT) await f.page.screenshot({ path: SHOT + name + '.png', fullPage: !!full }); }
const card = f => f.ev(() => {
  const el = document.getElementById('w180card'); if (!el) return null;
  const body = document.getElementById('mpBody');
  return { idx: [...body.children].indexOf(el), before112: !!document.getElementById('w112wrap') && [...body.children].indexOf(el) < [...body.children].indexOf(document.getElementById('w112wrap')),
    head: el.querySelector('.w180hd').textContent, items: [...el.querySelectorAll('.w180it')].map(x => ({ id: x.getAttribute('data-w180id'), t: x.querySelector('h4').textContent, txt: x.textContent })),
    post: !!el.querySelector('[data-w180post]'), all: (el.querySelector('[data-w180all]') || {}).textContent || null };
});
const modal = f => f.ev(() => { const b = document.getElementById('modalBack'), m = document.getElementById('modalBox'); return { open: !!b && b.style.display !== 'none', wide: m.classList.contains('w180wide'), txt: m.textContent, html: m.innerHTML }; });

(async () => {
  const browser = await launch();

  /* ---------- 1. Steel (admin) on Home ---------- */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx([]), wait: 5200, candidate: CAND, init: INIT });
    await f.page.waitForTimeout(1500);
    let c = await card(f);
    ok('1.1 no page errors', f.errs.length === 0, f.errs);
    ok('1.2 the card is at the top of Home, before the getting-started list', c && c.idx >= 0 && c.idx <= 4 && (c.before112 || !(await f.ev(() => !!document.getElementById('w112wrap')))), c && { idx: c.idx, before112: c.before112 });
    ok('1.3 the header: Announcements, 3 to answer, Post an announcement', c && /^Announcements3 to answer/.test(c.head) && c.post, c && c.head);
    ok('1.4 pinned first, then what waits on an answer (newest first); taken down and other teams\' stay off', c && c.items.map(i => i.id).join() === '104,101,107', c && c.items.map(i => i.id));
    ok('1.5 See all announcements counts every one Steel may see', c && c.all === 'See all announcements (7)', c && c.all);
    const i101 = c.items.find(i => i.id === '101') || {};
    ok('1.6 a poll shows its question and choices, who it is for, when it closes', /Operations Montreal/.test(i101.txt) && /Which start time works for you\?/.test(i101.txt) && /Closes/.test(i101.txt) && /9 am10 am11 am/.test(i101.txt), i101.txt);
    const tour = await f.ev(() => { const t = window.w122 && window.w122.tours && window.w122.tours.home; return t ? t.steps.map(s => s.s) : null; });
    ok('1.7 the Home tour has a stop for the card', tour && tour.indexOf('#w180card') > 0 && tour[tour.indexOf('#w180card') - 1] === '#mpBody .mp-chips', tour);
    await shot(f, 's1_card');

    /* ---------- 2. a poll, with a tap ---------- */
    await click(f, '#w180card [data-w180vote="101"][data-i="1"]', 700);
    const v1 = await rpcs(f, 'wa180_answer');
    c = await card(f);
    const it = await f.ev(() => { const x = document.querySelector('#w180card [data-w180id="101"]'); return { bars: [...x.querySelectorAll('.w180bar')].map(b => b.querySelector('.l').textContent), me: [...x.querySelectorAll('.w180bar.me')].length, done: (x.querySelector('.w180done') || {}).textContent, names: (x.querySelector('.w180names') || {}).textContent, see: (x.querySelector('[data-w180res]') || {}).textContent }; });
    ok('2.1 a tap sends the answer', v1.length === 1 && v1[0].args.p_id === 101 && JSON.stringify(v1[0].args.p_answers) === '{"choice":[1]}', v1);
    ok('2.2 then the totals show, with his choice marked', it.bars.length === 3 && /10 am you/.test(it.bars[1]) && /2 · 100%/.test(it.bars[1]) && it.me === 1 && /You chose 10 am · Change my answer/.test(it.done || ''), it);
    ok('2.3 the poster sees who chose what and how many answered', /Eleftherios Katsipis/.test(it.names || '') && it.see === 'See the answers (2 of 5)', it);
    ok('2.4 the count drops to 2 to answer', c && /^Announcements2 to answer/.test(c.head), c && c.head);
    await click(f, '#w180card [data-w180change="101"]', 400);
    await click(f, '#w180card [data-w180vote="101"][data-i="0"]', 700);
    const v2 = await rpcs(f, 'wa180_answer');
    ok('2.5 Change my answer, then another tap, changes it', v2.length === 2 && JSON.stringify(v2[1].args.p_answers) === '{"choice":[0]}', v2);
    await shot(f, 's2_voted');

    /* ---------- 3. a short form ---------- */
    await click(f, '#w180card [data-w180all]', 900);
    let m = await modal(f);
    ok('3.1 See all: every announcement, newest first, with where each stands', m.open && m.wide && /Everything posted, newest first/.test(m.txt) && (m.html.match(/data-w180open=/g) || []).length === 7 && /Taken down/.test(m.txt) && /To answer/.test(m.txt), m.txt.slice(0, 300));
    await click(f, '#modalBox [data-w180open="102"]', 900);
    m = await modal(f);
    const qs = await f.ev(() => [...document.querySelectorAll('#modalBox .w180ans')].map(x => x.querySelector('label').textContent));
    ok('3.2 an unanswered form opens to answer: its questions, which are required, anonymous said plainly', m.open && !m.wide && qs.length === 3 && /What would you like to do at the gala\?\*/.test(qs[0]) && /optional/.test(qs[1]) && /Anonymous: Steel sees the totals, not who answered what\./.test(m.txt), { qs, txt: m.txt.slice(0, 200) });
    await click(f, '#modalBox [data-w180formbox] button[type=submit]', 400);
    m = await modal(f);
    ok('3.3 a required question left empty is pointed out, nothing sent', /Please answer: What would you like to do at the gala\?/.test(m.txt) && (await rpcs(f, 'wa180_answer')).length === 2, m.txt.slice(-200));
    await type(f, '#modalBox [data-w180q="q1"]', 'Welcome desk');
    await click(f, '#modalBox [data-w180pick="q2"][data-i="1"]', 200);
    await click(f, '#modalBox [data-w180pick="q3"][data-i="0"]', 200);
    await shot(f, 's3_form');
    await click(f, '#modalBox [data-w180formbox] button[type=submit]', 800);
    const v3 = await rpcs(f, 'wa180_answer');
    m = await modal(f);
    ok('3.4 the answers go in, typed as the database checks them', v3.length === 3 && v3[2].args.p_id === 102 && JSON.stringify(v3[2].args.p_answers) === JSON.stringify({ q1: 'Welcome desk', q2: 1, q3: true }) && !m.open, v3[2]);

    /* ---------- 4. the answers ---------- */
    await click(f, '#w180card [data-w180res="101"]', 900);
    m = await modal(f);
    const r1 = await f.ev(() => ({ prog: (document.querySelector('#modalBox .w180prog') || {}).textContent, miss: (document.querySelector('#modalBox details.w180miss') || {}).textContent, btns: [...document.querySelectorAll('#modalBox .w180foot button')].map(b => b.textContent) }));
    ok('4.1 See the answers: how many of how many, the totals with names, who has not answered', m.open && m.wide && /1 of 5 answered/.test(r1.prog || '') && /4 not answered yet/.test(r1.miss || '') && /Eno Moffat/.test(r1.miss || '') && /Eleftherios Katsipis/.test(m.txt), r1);
    ok('4.2 the poster can download the answers, close the answers and take it down', r1.btns.join('|') === 'Download the answers (CSV)|Close the answers now|Take it down|Close', r1.btns);
    const sent1 = await f.ev(() => { const e = document.querySelector('#modalBox .w180sent'); return e ? { t: e.textContent, warn: e.classList.contains('warn') } : null; });
    ok('4.8 (wave180d) See the answers says where it went: the Slack post and the email', sent1 && sent1.t === 'Posted in #operations-mtl · Emailed to 4 people' && !sent1.warn, sent1);
    await f.ev(() => { window.__csv = null; const o = URL.createObjectURL; URL.createObjectURL = function (b) { b.text().then(t => { window.__csv = t; }); return o.call(URL, b); }; });
    await click(f, '#modalBox [data-w180csv="101"]', 500);
    const csv = await f.ev(() => window.__csv);
    ok('4.3 the CSV: a row per person, with the choice as words', csv && /Name,Answered,Which start time works for you\?/.test(csv) && /Eleftherios Katsipis,2026-09-25 15:30,10 am/.test(csv), csv);
    await click(f, '#modalBox [data-w180shut="101"]', 700);
    let w = await writes(f);
    ok('4.4 Close the answers now sets when they closed', w.length === 1 && w[0].m === 'update' && /^2026-09-25T20:00/.test(w[0].row.closes_at || ''), w);
    await click(f, '#modalBox [data-w180down="101"]', 300);
    w = await writes(f);
    const t1 = await f.ev(() => (document.querySelector('#modalBox [data-w180down]') || {}).textContent);
    ok('4.5 Take it down asks for a second press first', w.length === 1 && t1 === 'Press again to take it down', { w, t1 });
    await click(f, '#modalBox [data-w180down="101"]', 700);
    w = await writes(f); c = await card(f);
    ok('4.6 then it comes down (off Home today)', w.length === 2 && w[1].row.expires_at === '2026-09-25' && c.items.every(i => i.id !== '101'), { w, items: c.items.map(i => i.id) });
    await click(f, '#w180card [data-w180all]', 900);
    await click(f, '#modalBox [data-w180open="102"]', 900);
    m = await modal(f);
    ok('4.7 an anonymous form: the totals and the text answers, no names, a count of who has not answered', m.open && m.wide && /2 of 30 answered/.test(m.txt) && /Welcome desk/.test(m.txt) && /28 people have not answered yet\. It is anonymous, so the names stay hidden\./.test(m.txt) && !/w180names/.test(m.html), m.txt.slice(0, 400));
    const sent2 = await f.ev(() => { const e = document.querySelector('#modalBox .w180sent'); return e ? { t: e.textContent, warn: e.classList.contains('warn') } : null; });
    ok('4.9 (wave180d) an email that did not reach everyone says who it missed', sent2 && sent2.t === 'Slack: on its way · Emailed to 27 of 29 people; not to Mary, Ola' && sent2.warn, sent2);
    await f.ev(() => closeModal());
    await f.ev(() => w180.open(104)); await f.page.waitForTimeout(700);
    const sent3 = await f.ev(() => ({ open: !!document.querySelector('#modalBox .w180m'), line: !!document.querySelector('#modalBox .w180sent') }));
    ok('4.10 (wave180d) news posted before the email existed shows no email line', sent3.open && !sent3.line, sent3);
    await f.ev(() => closeModal());
    await shot(f, 's4_results');

    /* ---------- 5. posting ---------- */
    await click(f, '#w180card [data-w180post]', 600);
    m = await modal(f);
    const seg = await f.ev(() => [...document.querySelectorAll('#modalBox [data-w180aud]')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '') + (b.disabled ? '!' : '')));
    ok('5.1 Post an announcement: the form, for everyone by default (an admin)', m.open && /Post an announcement/.test(m.txt) && seg.join('|') === 'Everyone*|The leaders|Some teams' && /Post it once in Slack too, in #general/.test(m.txt), seg);
    const em1 = await f.ev(() => ({ on: !!(document.getElementById('w180pem') || {}).checked, lab: ((document.getElementById('w180pem') || {}).closest && document.getElementById('w180pem').closest('label').textContent) || '', sub: (document.querySelector('#modalBox .w180m .sub') || {}).textContent }));
    ok('5.9 (wave180d) Email it to them too is on by default, and the form says so', em1.on && em1.lab === ' Email it to them too, from hub@welfareavenue.com (replies come to you)' && /for the people it is for, goes once to Slack and is emailed to them\./.test(em1.sub || ''), em1);
    await click(f, '#modalBox [data-w180postform] button[type=submit]', 300);
    ok('5.2 no headline, no post', /Give it a headline\./.test((await modal(f)).txt) && (await writes(f)).length === 2, '');
    await type(f, '#w180pt', 'Pick the October serving times');
    await type(f, '#w180pb', 'Two teams, one vote.');
    await click(f, '#modalBox [data-w180aud="teams"]', 300);
    const teams = await f.ev(() => [...document.querySelectorAll('#modalBox [data-w180team]')].map(b => b.textContent));
    ok('5.3 an admin can pick any team, and what is typed stays', teams.length === 9 && teams.indexOf('Executive team') >= 0 && teams.indexOf('Board') >= 0 && (await f.ev(() => document.getElementById('w180pt').value)) === 'Pick the October serving times', teams);
    await click(f, '#modalBox [data-w180team="opsmtl"]', 200);
    await click(f, '#modalBox [data-w180team="progdev"]', 200);
    await click(f, '#modalBox [data-w180askt="poll"]', 300);
    await type(f, '#w180pq', 'Which Saturday time?');
    await type(f, '#modalBox [data-w180popt="0"]', '9 am');
    await click(f, '#modalBox [data-w180postform] button[type=submit]', 300);
    ok('5.4 a poll needs two choices', /A poll needs at least two choices\./.test((await modal(f)).txt), '');
    await type(f, '#modalBox [data-w180popt="1"]', '10 am');
    await click(f, '#modalBox [data-w180addopt]', 300);
    await type(f, '#modalBox [data-w180popt="2"]', '11 am');
    await f.ev(() => { const x = document.getElementById('w180pm'); x.checked = true; });
    await type(f, '#w180pc', '2026-10-02', 'change');
    const where = await f.ev(() => { const x = document.getElementById('w180ps'); return x && x.closest('label') ? x.closest('label').textContent : null; });
    ok('5.5 the Slack line says where it goes', /each team’s channel/.test(where || ''), where);
    await shot(f, 's5_post');
    await f.ev(() => { window.__toasts = []; const ot = window.toast; window.toast = function (m) { window.__toasts.push(String(m)); return ot && ot.apply(this, arguments); }; });
    await click(f, '#modalBox [data-w180postform] button[type=submit]', 800);
    w = await writes(f);
    const ins = w.filter(x => x.m === 'insert')[0];
    ok('5.6 Post it writes the announcement as the database checks it', ins && ins.row.title === 'Pick the October serving times' && ins.row.body === 'Two teams, one vote.' && ins.row.audience === 'teams' && JSON.stringify(ins.row.teams) === '["opsmtl","progdev"]'
      && JSON.stringify(ins.row.ask) === JSON.stringify({ type: 'poll', question: 'Which Saturday time?', options: ['9 am', '10 am', '11 am'], multi: true }) && ins.row.post_slack === true && ins.row.created_by === STEEL && ins.row.anonymous === false && ins.row.show_results === true
      && ins.row.closes_at === '2026-10-03T03:59:00.000Z' && ins.row.post_email === true, ins && ins.row);
    const toasts1 = await f.ev(() => window.__toasts || []);
    ok('5.10 (wave180d) the toast says where it went: Slack and email', toasts1.indexOf('Posted, and on its way to each team’s channel and by email') >= 0, toasts1);
    c = await card(f); m = await modal(f);
    ok('5.7 it closes and shows on Home at once, after the pinned one', !m.open && c.items[0].id === '104' && c.items[1] && c.items[1].id === '903', c.items.map(i => i.id));
    /* wave180d: unticked, it is not emailed */
    await click(f, '#w180card [data-w180post]', 600);
    await type(f, '#w180pt', 'Slack only, please');
    await f.ev(() => { const x = document.getElementById('w180pem'); x.checked = false; x.dispatchEvent(new Event('change', { bubbles: true })); });
    await f.page.waitForTimeout(250);
    const em2 = await f.ev(() => ({ on: !!(document.getElementById('w180pem') || {}).checked, sub: (document.querySelector('#modalBox .w180m .sub') || {}).textContent, title: (document.getElementById('w180pt') || {}).value }));
    ok('5.11 (wave180d) unticked: the form says Slack only, and what is typed stays', !em2.on && /for the people it is for, and goes once to Slack\./.test(em2.sub || '') && em2.title === 'Slack only, please', em2);
    await click(f, '#modalBox [data-w180postform] button[type=submit]', 800);
    w = await writes(f);
    const ins2 = w.filter(x => x.m === 'insert')[1];
    const toasts2 = await f.ev(() => window.__toasts || []);
    ok('5.12 (wave180d) then the row says no email, and the toast says Slack only', ins2 && ins2.row.post_email === false && ins2.row.post_slack === true && toasts2.indexOf('Posted, and on its way to #general') >= 0, { row: ins2 && ins2.row, toasts2 });
    ok('5.8 no page errors (Steel)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* ---------- 6b. (wave180d) the email's link through the sign-in: Google brings people back without the address ---------- */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx([]), wait: 5200, candidate: CAND, init: INIT + "\n;try { sessionStorage.setItem('w180pend', JSON.stringify({ id: '102', t: Date.now() - 60000 })); } catch (e) {}" });
    await f.page.waitForTimeout(1500);
    const m = await modal(f);
    const left = await f.ev(() => { try { return sessionStorage.getItem('w180pend'); } catch (e) { return 'x'; } });
    ok('6.5 (wave180d) after the sign-in, the link it came in on opens (once)', m.open && /Gala volunteers survey/.test(m.txt) && left === null, { open: m.open, left });
    ok('6.6 (wave180d) no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx([]), wait: 5200, candidate: CAND, init: INIT + "\n;try { sessionStorage.setItem('w180pend', JSON.stringify({ id: '102', t: Date.now() - 20 * 60000 })); } catch (e) {}" });
    await f.page.waitForTimeout(1500);
    const m = await modal(f);
    ok('6.7 (wave180d) an address kept longer than 15 minutes ago is dropped', !m.open, m.txt.slice(0, 80));
    await f.close();
  }

  /* ---------- 6. the Slack link opens it; What's new posts through the same form ---------- */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#announce/102', fixture: fx([]), wait: 5200, candidate: CAND, init: INIT });
    await f.page.waitForTimeout(1500);
    const m = await modal(f);
    ok('6.1 #announce/102 lands on Home with the form open', m.open && /Gala volunteers survey/.test(m.txt) && /Send my answers/.test(m.txt) && (await f.ev(() => location.hash)) === '#mypage', { open: m.open, hash: await f.ev(() => location.hash) });
    await f.ev(() => closeModal());
    await f.hash('#overview', 1500);
    const btn = await f.ev(() => !!document.querySelector('#w116news [data-anpost]'));
    if (btn) {
      await click(f, '#w116news [data-anpost]', 600);
      const m2 = await modal(f);
      ok('6.2 Post on What\'s new opens the same form', m2.open && !!(await f.ev(() => document.querySelector('#modalBox [data-w180postform]'))), m2.txt.slice(0, 120));
    } else ok('6.2 Post on What\'s new opens the same form', false, 'no post button on What\'s new');
    await f.ev(() => closeModal());
    await f.hash('#announce/all', 1500);
    const m3 = await modal(f);
    ok('6.3 #announce/all opens them all', m3.open && (m3.html.match(/data-w180open=/g) || []).length === 7, m3.txt.slice(0, 100));
    ok('6.4 no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* ---------- 7. Joy (a marketing member): what is for her, answering, no posting ---------- */
  {
    const f = await fresh(browser, { who: 'plain', width: 1366, hash: '#mypage', fixture: fx([{ announcement_id: 102, answers: { q1: 'Photos, please', q2: 0 }, updated_at: '2026-09-24T16:00:00Z' }]), wait: 5200, candidate: CAND, init: INIT });
    await f.page.waitForTimeout(1500);
    let c = await card(f);
    ok('7.1 she sees what is for her: everyone, and her team; not other teams\', not the leaders\'', c && c.items.map(i => i.id).join() === '104,107,102' && !c.post && c.all === null, c && { items: c.items.map(i => i.id), post: c.post, all: c.all });
    ok('7.2 the count: 1 to answer (the form is answered)', c && /^Announcements1 to answer/.test(c.head), c && c.head);
    const i102 = c.items.find(i => i.id === '102') || {};
    ok('7.3 the form she answered: You answered, Change my answers, See the totals', /You answered · Change my answers · See the totals/.test(i102.txt || ''), i102.txt);
    await click(f, '#w180card [data-w180vote="107"][data-i="0"]', 800);
    const it = await f.ev(() => { const x = document.querySelector('#w180card [data-w180id="107"]'); return { bars: x.querySelectorAll('.w180bar').length, txt: x.textContent, see: !!x.querySelector('[data-w180res]') }; });
    ok('7.4 a poll whose totals the poster keeps: her answer, no totals, no See the answers', it.bars === 0 && /You chose Green and gold/.test(it.txt) && /Steel keeps the totals for now\./.test(it.txt) && !it.see, it);
    await f.ev(() => { window.__ANS_ERR = 'It closed on September 25.'; });
    await click(f, '#w180card [data-w180change="107"]', 300);
    await click(f, '#w180card [data-w180vote="107"][data-i="1"]', 800);
    const e1 = await f.ev(() => (document.querySelector('#w180card [data-w180id="107"] .w180err') || {}).textContent);
    ok('7.5 a refused answer says why', e1 === 'It closed on September 25.', e1);
    await f.ev(() => { window.__ANS_ERR = null; });
    await f.ev(() => { try { closeModal(); } catch (e) {} });
    await f.ev(() => { const r = JSON.parse(JSON.stringify(window.__R180[102])); r.manage = false; delete r.audience; delete r.missing_count; delete r.missing; delete r.rows; window.__R180[102] = r; });   /* as the database answers Joy */
    await f.ev(() => w180.open(102)); await f.page.waitForTimeout(900);
    const js = await f.ev(() => ({ open: !!document.querySelector('#modalBox .w180m'), line: !!document.querySelector('#modalBox .w180sent'), slackEmail: /Emailed|Slack/.test((document.getElementById('modalBox') || {}).textContent || '') }));
    ok('7.7 (wave180d) Joy does not see where it went (the poster, leaders, HR and admins do)', js.open && !js.line && !js.slackEmail, js);
    ok('7.6 no page errors (Joy)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* ---------- 8. a leader posts to their own team; HR to any team ---------- */
  {
    const f = await fresh(browser, { who: 'leader', width: 1366, hash: '#mypage', fixture: fx([]), wait: 5200, candidate: CAND, init: INIT });
    await f.page.waitForTimeout(1200);
    const me = await f.ev(() => ({ role: WA40_MINE && WA40_MINE.role, dept: (wa28Me() || {}).department }));
    await click(f, '#w180card [data-w180post]', 600);
    const seg = await f.ev(() => [...document.querySelectorAll('#modalBox [data-w180aud]')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')));
    const tms = await f.ev(() => [...document.querySelectorAll('#modalBox [data-w180team]')].map(b => b.getAttribute('data-w180team') + (b.classList.contains('on') ? '*' : '')));
    ok('8.1 a leader: My team by default, only their own team, and everyone or the leaders', me.role === 'leader' && seg.join('|') === 'Everyone|The leaders|My team*' && tms.join() === me.dept + '*', { me, seg, tms });
    await f.ev(() => { window.__POST_ERR = 'new row violates row-level security policy for table "hub_announcements"'; });
    await type(f, '#w180pt', 'Team huddle moves to Thursday');
    await click(f, '#modalBox [data-w180postform] button[type=submit]', 700);
    const m = await modal(f);
    ok('8.2 a post the database refuses says who can post to whom', m.open && /Leaders post to everyone, the leaders or their own team; HR and admins to anyone\./.test(m.txt), m.txt.slice(-200));
    ok('8.3 no page errors (leader)', f.errs.length === 0, f.errs);
    await f.close();
  }
  {
    const f = await fresh(browser, { who: 'member', width: 1366, hash: '#mypage', fixture: fx([]), wait: 5200, candidate: CAND, init: INIT });
    await f.page.waitForTimeout(1200);
    const hasPost = await f.ev(() => !!document.querySelector('#w180card [data-w180post]'));
    await click(f, '#w180card [data-w180post]', 600);
    await click(f, '#modalBox [data-w180aud="teams"]', 300);
    const tms = await f.ev(() => [...document.querySelectorAll('#modalBox [data-w180team]')].length);
    ok('8.4 HR (Samson) posts to any team', hasPost && tms === 9, { hasPost, tms });
    ok('8.5 no page errors (HR)', f.errs.length === 0, f.errs);
    await f.close();
  }
  {
    const f = await fresh(browser, { who: 'board', width: 1366, hash: '#mypage', fixture: fx([]), wait: 5200, candidate: CAND, init: INIT });
    await f.page.waitForTimeout(1200);
    const c = await card(f);
    ok('8.6 a board viewer: no team announcements, no posting', !c, c);
    ok('8.7 no page errors (board)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* ---------- 9. phones ---------- */
  {
    const f = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', fixture: fx([]), wait: 5200, candidate: CAND, init: INIT });
    await f.page.waitForTimeout(1500);
    const c = await f.ev(() => { const el = document.getElementById('w180card'); return el ? { r: Math.round(el.getBoundingClientRect().right), opts: [...el.querySelectorAll('.w180opt')].map(b => Math.round(b.getBoundingClientRect().right)), sw: document.scrollingElement.scrollWidth } : null; });
    ok('9.1 the card fits a phone', c && c.r <= 390 && c.opts.every(x => x <= 390) && c.sw <= 392, c);
    await shot(f, 's9_phone_card');
    await click(f, '#w180card [data-w180post]', 600);
    await click(f, '#modalBox [data-w180askt="form"]', 400);
    const p = await f.ev(() => { const m = document.getElementById('modalBox'); const r = m.getBoundingClientRect(); return { w: Math.round(r.width), l: Math.round(r.left), sw: m.scrollWidth, cw: m.clientWidth }; });
    ok('9.2 the post form fits a phone', p.w <= 390 && p.l >= 0 && p.sw <= p.cw + 1, p);
    await shot(f, 's9_phone_post');
    ok('9.3 no page errors on phones', f.errs.length === 0, f.errs);
    await f.close();
  }

  console.log(out.join('\n'));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
