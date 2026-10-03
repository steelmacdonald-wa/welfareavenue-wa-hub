/* w170drive.js: wave170, Your inbox (the assistant for your own mailbox) and info@ passed on in the team inbox.
   Steel (29/09/26): "I'd also like for Jev to review my steel.macdonald@welfareavenue.com emails as well and to start categorizing
   them in to my different folders, sending them to the necessary teams, and helping me draft replies in a reply tool that asks me
   questions to clarify how to respond to individuals the emailed me. It needs to use /steel-writing:steel-voice
   /steel-writing:wa-writing to make sure replies sound like me. This is a tool I'd like to roll out to others later / Also with
   info@welfareavenue.com we get a few emails there as well that needs to forwarded to the correct groups and individuals with a
   brief note of an ask of what they should take action on."
   The roster is the live team (scratchpad fx169.json, 30/09/26). mybox_owners and mybox_mail are made up (Steel's row, six emails,
   two personal ones left alone). The mybox function is caught (window.__fn) and answers as the real one does. Uses test/boot.js
   (stubbed Supabase, clock fixed 25/09/26 16:00 Toronto). CAND=<file> to test another build. SHOTS=1 saves screenshots. */
const fs = require('fs');
const { launch, fresh, loadFixture } = require('./boot');
const SP = '/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/';
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 700) : '')); } }
const ROSTER = JSON.parse(fs.readFileSync(SP + 'fx169.json', 'utf8'));
const clone = o => JSON.parse(JSON.stringify(o));
const STEEL = 'steel.macdonald@welfareavenue.com';

const OWNER = { email: STEEL, name: 'Steel MacDonald', enabled: true, auto_sort: true, days_back: 3, archive_labels: ['Label_5'], label_notes: { Label_2: 'Anything from Keela' }, skip_senders: [], skip_words: [],
  labels: [{ id: 'Label_1', name: 'Accounting', examples: ['Your Netlify invoice'] }, { id: 'Label_2', name: 'Keela', examples: ['Re: Import question'] }, { id: 'Label_3', name: 'Fundraising/Grants', examples: [] }, { id: 'Label_5', name: 'Org Emails/NPO Newsletters', examples: ['September newsletter'] }],
  labels_at: '2026-09-25T15:00:00Z', last_sort_at: '2026-09-25T19:49:00Z', last_result: '4 new, 3 filed, 1 left in the inbox', last_error: null };
function row(o) { return Object.assign({ owner: STEEL, thread_id: null, from_email: null, from_name: null, subject: null, snippet: null, label_id: null, label_name: null, label_conf: null, labelled_at: null, archived: false, team: null, team_conf: null, team_state: null, sent_mail_id: null, sent_at: null, reply_p: 0.05, reply_state: null, draft_id: null, drafted_at: null, state: 'sorted', error: null, skipped: false, created_at: o.received_at }, o); }
const MAIL = [
  row({ id: 1, gmail_id: 'g1', thread_id: 't1', received_at: '2026-09-25T18:10:00Z', from_email: 'maria@example.org', from_name: 'Maria Lopez', subject: 'Volunteering with students in October', reply_p: 0.9 }),
  row({ id: 2, gmail_id: 'g2', thread_id: 't2', received_at: '2026-09-25T17:00:00Z', from_email: 'billing@netlify.com', from_name: 'Netlify', subject: 'Your Netlify invoice', label_id: 'Label_1', label_name: 'Accounting', label_conf: 0.97, labelled_at: '2026-09-25T19:49:00Z', team: 'finance', team_conf: 0.9 }),
  row({ id: 3, gmail_id: 'g3', thread_id: 't3', received_at: '2026-09-25T16:45:00Z', from_email: 'support@keela.co', from_name: 'Keela Support', subject: 'Re: Import question', label_id: 'Label_2', label_name: 'Keela', label_conf: 0.9, labelled_at: '2026-09-25T19:49:00Z', reply_p: 0.7, reply_state: 'drafted', draft_id: 'd1' }),
  row({ id: 4, gmail_id: 'g4', thread_id: 't4', received_at: '2026-09-25T16:30:00Z', from_email: 'lgomez@example.org', from_name: 'Laura Gomez', subject: 'Partnership conversation next week', reply_p: 0.6, team: 'progdev', team_conf: 0.8 }),
  row({ id: 5, gmail_id: 'g5', thread_id: 't5', received_at: '2026-09-23T13:00:00Z', from_email: 'news@npo.example', from_name: 'NPO News', subject: 'September newsletter', label_id: 'Label_5', label_name: 'Org Emails/NPO Newsletters', label_conf: 0.95, labelled_at: '2026-09-23T13:04:00Z', archived: true }),
  row({ id: 6, gmail_id: 'g6', received_at: '2026-09-24T10:00:00Z', state: 'error', error: 'Gmail did not answer' }),
  row({ id: 7, gmail_id: 's1', received_at: '2026-09-25T12:00:00Z', skipped: true, state: 'skipped', reply_p: null }),
  row({ id: 8, gmail_id: 's2', received_at: '2026-09-24T12:00:00Z', skipped: true, state: 'skipped', reply_p: null })
];
/* the team inbox: an info@ email passed on to a person, one filed quietly (someone on the thread), one sent on from an inbox */
const HUBMAIL = [
  { id: 501, gmail_id: 'x501', internal_date: '2026-09-25T14:00:00Z', from_email: 'rchen@example.com', from_name: 'Robert Chen', subject: 'Tax receipt for my donation', title: 'Tax receipt request for $250 donation', summary: 'A donor asks for his tax receipt.', kind: 'update', department: 'fundraising', amount: null, due_date: null, status: 'filed', filed: { type: 'info', department: 'fundraising', on_thread: null }, attachments: [], notify: { by: 'info', decision: 'notify', dm: 'Alexis', dm_state: 'sent', department: 'fundraising' }, team_state: null, assignee: 'Alexis', request_id: null, mailbox: 'info', ask: 'Send Robert Chen his tax receipt for the $250 he gave on August 14.', assignee_email: 'alexis.walter@welfareavenue.com', forwarded_by: null },
  { id: 502, gmail_id: 'x502', internal_date: '2026-09-25T13:00:00Z', from_email: 'sophia@example.com', from_name: 'Sophia V', subject: 'Re: Volunteer Available on Weekends', title: 'Sophia confirms Saturday October 10', summary: 'A volunteer confirms a shift.', kind: 'update', department: 'opsmtl', amount: null, due_date: null, status: 'filed', filed: { type: 'info', department: 'opsmtl', on_thread: 'Ahmed' }, attachments: [], notify: { by: 'info', decision: 'file', why: 'on the thread', on_thread: 'Ahmed', department: 'opsmtl' }, team_state: null, assignee: 'Ahmed', request_id: null, mailbox: 'info', ask: 'Confirm the shift time with Sophia for Saturday October 10.', assignee_email: 'ahmedfakhir@welfareavenue.com', forwarded_by: null },
  { id: 503, gmail_id: 'person:steel.macdonald:g9', internal_date: '2026-09-25T12:00:00Z', from_email: 'lgomez@example.org', from_name: 'Laura Gomez', subject: 'Partnership conversation next week', title: 'Partnership conversation next week', summary: 'Can you reply to Laura about the partnership call?', kind: 'update', department: 'progdev', amount: null, due_date: null, status: 'filed', filed: { type: 'forward', by: 'Steel MacDonald', from: 'inbox assistant' }, attachments: [], notify: { by: 'forward', decision: 'notify', channel: 'program-development', url: 'https://welfareavenue.slack.com/archives/C1/p1', department: 'progdev' }, team_state: null, assignee: 'Zachee Leonel Ngue', request_id: null, mailbox: 'person', ask: 'Can you reply to Laura about the partnership call on Tuesday?', assignee_email: 'zachee.ngue@welfareavenue.com', forwarded_by: 'Steel MacDonald' }
];
function fx(o) {
  o = o || {};
  const f = loadFixture();
  f.team_members = ROSTER.map(m => ({ id: m.id, name: m.name, email: m.email, department: m.department, active: true, role: m.role }));
  f.hub_roles = ROSTER.filter(m => m.email && m.hub_role).map(m => ({ email: m.email, role: m.hub_role, profile: m.profile, tabs: null, note: m.name }));
  f.mybox_owners = o.noOwner ? [] : [clone(OWNER)];
  f.mybox_mail = o.noOwner ? [] : clone(MAIL);
  f.hub_mail = (f.hub_mail || []).concat(clone(HUBMAIL));
  return f;
}
/* the mybox function as it answers (window.__FNR, changeable mid-test); every call is kept in window.__fn */
const FNR = {
  'mybox:open': { ok: true, main: { from: 'Maria Lopez <maria@example.org>', from_email: 'maria@example.org', to: 'Steel MacDonald <' + STEEL + '>, info@welfareavenue.com', cc: 'shima.butera@welfareavenue.com', subject: 'Volunteering with students in October', date: '2026-09-25T18:10:00Z', text: 'Hi Steel,\n\nOur Grade 11 class would love to volunteer at a Saturday serving in October. We are 12 students and 2 teachers. Which dates work?\n\nThanks,\nMaria', atts: ['permission-form.pdf'], mine: false }, history: [{ from: 'Maria Lopez', date: '2026-09-20T15:00:00Z', text: 'Hello! A quick question about volunteering.', mine: false }], later: [] },
  'mybox:questions': { ok: true, gist: 'Maria wants a Saturday in October for 12 students and 2 teachers.', questions: [{ q: 'Which Saturday can they come?', options: ['October 10', 'October 17', 'Ask them to pick'] }, { q: 'Can 14 people fit in one serving?', options: ['Yes', 'Split them over two dates'] }], answered: false },
  'mybox:draft': { ok: true, body: 'Hi Maria,\n\nThank you for thinking of us. October 10 works: please arrive at [time] at the kitchen.\n\nWarmly,\nSteel', notes: ['Check the kitchen can take 14 that day.'], brackets: ['[time]'] },
  'mybox:save_draft': { ok: true, draft_id: 'r-1', to: ['maria@example.org'], cc: [], subject: 'Re: Volunteering with students in October', url: 'https://mail.google.com/mail/u/' + encodeURIComponent(STEEL) + '/#drafts' },
  'mybox:done': { ok: true },
  'mybox:suggest_ask': { ok: true, ask: 'Can you pay the Netlify invoice before October 1?', person: null, people: [] },
  'mybox:to_team': { ok: true, mail_id: 321, team: 'progdev', person: 'Zachee Leonel Ngue' },
  'mybox:unlabel': { ok: true },
  'mybox:settings': { ok: true },
  'mybox:labels': { ok: true, labels: OWNER.labels, labels_at: '2026-09-25T20:00:00Z' },
  'mybox:sort': { accepted: true, started: '2026-09-25T20:00:00Z' },
  'mybox:retry': { accepted: true, started: '2026-09-25T20:00:00Z' }
};
const INIT = `(function(){ window.__FNR = ${JSON.stringify(FNR)}; window.__fn = []; var _s;
  Object.defineProperty(window, 'supabase', { configurable: true, get: function () { return _s; }, set: function (v) {
    var cc = v.createClient; v.createClient = function () { var c = cc.apply(this, arguments);
      c.functions.invoke = function (name, opts) { var body = (opts && opts.body) || {}; window.__fn.push({ name: name, body: JSON.parse(JSON.stringify(body)) });
        var v2 = (window.__FNR || {})[name + ':' + (body.action || '')];
        if (v2 === undefined) return Promise.resolve({ data: null, error: { message: 'no stub for ' + name + ':' + body.action } });
        if (v2 && v2.__error) return Promise.resolve({ data: null, error: { message: v2.__error } });
        return new Promise(function (r) { setTimeout(function () { r({ data: JSON.parse(JSON.stringify(v2)), error: null }); }, 60); }); };
      return c; };
    _s = v; } }); })();`;
const CAND = process.env.CAND || undefined;
const calls = (f, action) => f.ev(a => (window.__fn || []).filter(c => c.name === 'mybox' && (!a || c.body.action === a)), action);
async function click(f, sel, ms) { const n = await f.ev(s => { const el = document.querySelector(s); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; }, sel); await f.page.waitForTimeout(ms || 500); return n; }
async function type(f, sel, val, ev) { return f.ev(a => { const el = document.querySelector(a[0]); if (!el) return false; el.value = a[1]; el.dispatchEvent(new Event(a[2] || 'input', { bubbles: true })); return true; }, [sel, val, ev]); }
const SHOT = process.env.SHOTS ? SP + 'w170/' : null;
if (SHOT && !fs.existsSync(SHOT)) fs.mkdirSync(SHOT, { recursive: true });
async function shot(f, name) { if (SHOT) await f.page.screenshot({ path: SHOT + name + '.png' }); }
const sheet = f => f.ev(() => {
  const s = document.getElementById('w170sheet'); if (!s) return null;
  const q = x => s.querySelector(x), qa = x => [...s.querySelectorAll(x)];
  return { on: s.classList.contains('on'), sel: s.classList.contains('sel'), lock: document.documentElement.classList.contains('w170lock'), hash: location.hash,
    tabs: qa('.w170tabs button').map(b => ({ t: b.textContent, on: b.classList.contains('on') })), items: qa('.w170it').map(b => ({ g: b.getAttribute('data-w170sel'), on: b.classList.contains('on'), dim: b.classList.contains('dim'), txt: b.textContent })),
    head: (q('.w170mh') || {}).textContent || '', gmail: (q('.w170mh a.w170lnk') || {}).href || '', mail: (q('.w170mail') || {}).textContent || '', hist: (q('.w170hist summary') || {}).textContent || '',
    tool: (q('.w170tool') || {}).textContent || '', err: (q('.w170err') || {}).textContent || '', main: (q('.w170main') || {}).textContent || '', status: (q('.w170hd .st') || {}).textContent || '', empty: (q('.w170list .w170empty') || {}).textContent || '' };
});

(async () => {
  const browser = await launch();

  /* ---------- 1. Home: the card ---------- */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(), wait: 5200, candidate: CAND, init: INIT });
    await f.page.waitForTimeout(1200);
    const c = await f.ev(() => {
      const el = document.getElementById('w170card'), body = document.getElementById('mpBody');
      if (!el) return null;
      return { inBody: !!body && el.parentNode === body, idx: [...body.children].indexOf(el), prev: el.previousElementSibling ? (el.previousElementSibling.id || el.previousElementSibling.className) : null,
        h3: el.querySelector('h3').textContent, tiles: [...el.querySelectorAll('.w170tiles button')].map(b => ({ n: b.querySelector('b').textContent, l: b.querySelector('span').textContent, hot: b.classList.contains('hot'), open: b.getAttribute('data-w170open') })),
        foot: el.querySelector('.w170foot span').textContent, btn: el.querySelector('.w170foot button').getAttribute('data-w170open') };
    });
    ok('1.1 no page errors on Home', f.errs.length === 0, f.errs);
    ok('1.2 the card is on Home, near the top', c && c.inBody && c.idx >= 0 && c.idx <= 5 && c.h3 === 'Your inbox', c);
    ok('1.3 the tiles count to reply, for a team and sorted today', c && JSON.stringify(c.tiles.map(t => [t.n, t.l, t.hot, t.open])) === JSON.stringify([['2', 'to reply', true, 'reply'], ['2', 'for a team', false, 'team'], ['2', 'sorted today', false, 'sorted']]), c && c.tiles);
    ok('1.4 the footer says when it last sorted and the schedule', c && c.foot === 'Sorted 11 min ago · every 15 minutes' && c.btn === 'reply', c);
    const tour = await f.ev(() => { const t = window.w122 && window.w122.tours && window.w122.tours.home; return t ? t.steps.map(s => s.s) : null; });
    ok('1.5 the Home tour has a stop for the card, after the onboarding lead card', tour && tour.indexOf('#w170card') >= 0 && ['#w166lead', '#w112wrap'].indexOf(tour[tour.indexOf('#w170card') - 1]) >= 0, tour);
    await shot(f, 's1_card');

    /* ---------- 2. the assistant: To reply ---------- */
    await click(f, '#w170card [data-w170open="reply"]', 900);
    let s = await sheet(f);
    ok('2.1 the tile opens the assistant full screen at #mypage/inbox', s && s.on && s.lock && s.hash === '#mypage/inbox', s && { on: s.on, lock: s.lock, hash: s.hash });
    ok('2.2 four tabs, To reply on, with the counts', s && JSON.stringify(s.tabs.map(t => [t.t, t.on])) === JSON.stringify([['To reply2', true], ['For a team2', false], ['Sorted', false], ['Settings', false]]), s && s.tabs);
    ok('2.3 the list has the two waiting on a reply, newest first, the first open', s && s.items.length === 2 && s.items[0].g === 'g1' && s.items[1].g === 'g4' && s.items[0].on && /Maria Lopez/.test(s.items[0].txt) && /Volunteering with students/.test(s.items[0].txt), s && s.items);
    const op = await calls(f, 'open');
    ok('2.4 opening an email reads it through the mybox function', op.length === 1 && op[0].name === 'mybox' && op[0].body.gmail_id === 'g1', op);
    ok('2.5 the email shows, with the thread and the attachment', s && /Our Grade 11 class/.test(s.mail) && /Attachments: permission-form\.pdf/.test(s.mail) && s.hist === 'Earlier in the thread (1)', s && { mail: s.mail.slice(0, 80), hist: s.hist });
    ok('2.6 Open in Gmail goes to the thread in his mailbox', s && s.gmail === 'https://mail.google.com/mail/?authuser=steel.macdonald@welfareavenue.com#all/t1'   /* wave201: the account by authuser */, s && s.gmail);
    ok('2.7 the reply tool offers Help me reply, I replied already, No reply needed', s && /Help me reply/.test(s.tool) && /I replied already/.test(s.tool) && /No reply needed/.test(s.tool) && /nothing is sent for you/.test(s.tool), s && s.tool);
    const dealt = await f.ev(() => (document.querySelector('#w170sheet [data-w170done]') || {}).textContent || '');
    ok('2.8 the ones dealt with can be shown', dealt === 'Show the ones you dealt with (1)', dealt);
    await shot(f, 's2_reply');

    /* ---------- 3. the reply tool: questions, the draft, the Gmail draft ---------- */
    await click(f, '#w170sheet [data-w170help]', 700);
    s = await sheet(f);
    const qs = await f.ev(() => [...document.querySelectorAll('#w170sheet .w170q')].map(q => ({ q: q.querySelector('.qq').textContent, opts: [...q.querySelectorAll('[data-w170ans]')].map(b => b.textContent), own: !!q.querySelector('[data-w170own]') })));
    ok('3.1 Help me reply asks its questions, with the gist', (await calls(f, 'questions')).length === 1 && /What they want: Maria wants a Saturday/.test(s.tool) && qs.length === 2 && qs[0].opts.join('|') === 'October 10|October 17|Ask them to pick' && qs.every(q => q.own), qs);
    await click(f, '#w170sheet [data-w170ans="0"][data-v="October 10"]', 300);
    await type(f, '#w170sheet [data-w170own="1"]', 'Yes, all 14 in one serving');
    await type(f, '#w170note', 'Thank her teachers too');
    const on0 = await f.ev(() => [...document.querySelectorAll('#w170sheet [data-w170ans="0"]')].map(b => b.classList.contains('on') + ':' + b.getAttribute('aria-pressed')));
    ok('3.2 an answer is picked with a tap', on0.join(',') === 'true:true,false:false,false:false', on0);
    await click(f, '#w170sheet [data-w170draft]', 700);
    const dr = await calls(f, 'draft');
    ok('3.3 Write my reply sends the answers and the note', dr.length === 1 && JSON.stringify(dr[0].body.answers) === JSON.stringify([{ q: 'Which Saturday can they come?', a: 'October 10' }, { q: 'Can 14 people fit in one serving?', a: 'Yes, all 14 in one serving' }]) && dr[0].body.note === 'Thank her teachers too', dr);
    const dv = await f.ev(() => ({ body: (document.getElementById('w170body') || {}).value, notes: [...document.querySelectorAll('#w170sheet .w170notes li')].map(l => l.textContent), all: !!document.querySelector('#w170sheet [data-w170all]') }));
    ok('3.4 the draft is shown to change, with what to fill in before sending', /October 10 works/.test(dv.body || '') && dv.notes.join('|') === 'Fill in [time]|Check the kitchen can take 14 that day.', dv);
    ok('3.5 reply to everyone is offered when others are on the email', dv.all, dv);
    await shot(f, 's3_draft');
    await click(f, '#w170sheet [data-w170save]', 400);
    s = await sheet(f);
    ok('3.6 a part still in [brackets] is pointed out before saving', (await calls(f, 'save_draft')).length === 0 && /There is still 1 part in \[brackets\] to fill in: \[time\]\. Fill it in above, or press Save it with the \[brackets\]/.test(await f.ev(() => (document.querySelector('#w170sheet .w170warn') || {}).textContent || '')), await f.ev(() => (document.querySelector('#w170sheet .w170warn') || {}).textContent || ''));   /* wave201: the note sits above the button */
    await click(f, '#w170sheet [data-w170save]', 700);
    const sv = await calls(f, 'save_draft');
    s = await sheet(f);
    ok('3.7 Save as a Gmail draft saves the text as it stands (not sent)', sv.length === 1 && sv[0].body.gmail_id === 'g1' && /October 10 works/.test(sv[0].body.body) && sv[0].body.reply_all === false && /Saved in your Gmail drafts, in the thread, to maria@example\.org\.The Hub read it back from Gmail: it is there, in steel\.macdonald@welfareavenue\.com\. Read it once more and send it from Gmail\./.test(s.tool), { sv, tool: s.tool });
    const after = await f.ev(() => ({ tab: document.querySelector('#w170sheet .w170tabs button').textContent, tile: document.querySelector('#w170card .w170tiles b').textContent, items: [...document.querySelectorAll('#w170sheet .w170it')].map(b => b.getAttribute('data-w170sel')), dealt: (document.querySelector('#w170sheet [data-w170done]') || {}).textContent }));
    ok('3.8 the counts follow (To reply 1, the Home tile 1); it moves to the ones dealt with', after.tab === 'To reply1' && after.tile === '1' && after.items.join() === 'g4' && after.dealt === 'Show the ones you dealt with (2)', after);
    await click(f, '#w170sheet [data-w170next]', 700);
    s = await sheet(f);
    ok('3.9 Next email opens the next one waiting', s.items.filter(i => i.on).map(i => i.g).join() === 'g4' && (await calls(f, 'open')).slice(-1)[0].body.gmail_id === 'g4', s.items);

    /* ---------- 4. No reply needed ---------- */
    await click(f, '#w170sheet [data-w170mark="reply_dismiss"]', 700);
    const dn = await calls(f, 'done');
    s = await sheet(f);
    ok('4.1 No reply needed is saved and the list is clear', dn.length === 1 && dn[0].body.what === 'reply_dismiss' && dn[0].body.gmail_id === 'g4' && s.items.length === 0 && /Nothing waiting on you/.test(s.empty), { dn, items: s.items, empty: s.empty });
    await click(f, '#w170sheet [data-w170done]', 400);
    s = await sheet(f);
    ok('4.2 the ones dealt with come back, dimmed', s.items.length === 3 && s.items.every(i => i.dim), s.items.map(i => i.g + ':' + i.dim));

    /* ---------- 5. For a team ---------- */
    await click(f, '#w170sheet [data-w170tab="team"]', 900);
    s = await sheet(f);
    ok('5.1 the For a team tab: its address, the two for a team, the first open', s.hash === '#mypage/inbox/team' && s.items.map(i => i.g).join() === 'g2,g4' && s.items[0].on && /Finance/.test(s.items[0].txt), { hash: s.hash, items: s.items });
    const sa = await calls(f, 'suggest_ask');
    const t1 = await f.ev(() => ({ ask: (document.getElementById('w170ask') || {}).value, team: (document.getElementById('w170team') || {}).value, people: [...document.querySelectorAll('#w170person option')].map(o => o.textContent) }));
    ok('5.2 the assistant writes a first line for the team it thinks of', sa.length === 1 && sa[0].body.gmail_id === 'g2' && sa[0].body.team === 'finance' && t1.ask === 'Can you pay the Netlify invoice before October 1?' && t1.team === 'finance' && t1.people.join('|') === 'The whole team', { sa, t1 });
    await f.ev(() => { window.__FNR['mybox:suggest_ask'] = { ok: true, ask: 'Can you reply to Laura about the partnership call on Tuesday?', person: 'zachee.ngue@welfareavenue.com', people: [] }; });
    await click(f, '#w170sheet [data-w170sel="g4"]', 900);
    const t2 = await f.ev(() => ({ ask: (document.getElementById('w170ask') || {}).value, team: (document.getElementById('w170team') || {}).value, person: (document.getElementById('w170person') || {}).value, people: [...document.querySelectorAll('#w170person option')].map(o => o.textContent) }));
    ok('5.3 a person on the team can be picked (the live Program Development team)', t2.team === 'progdev' && t2.person === 'zachee.ngue@welfareavenue.com' && t2.people.join('|') === 'The whole team|Brianna|Ola|Shima|Zachee Leonel Ngue' && /Laura about the partnership/.test(t2.ask), t2);
    await type(f, '#w170team', 'fundraising', 'change'); await f.page.waitForTimeout(300);
    const t3 = await f.ev(() => ({ person: (document.getElementById('w170person') || {}).value, people: [...document.querySelectorAll('#w170person option')].map(o => o.textContent), ask: (document.getElementById('w170ask') || {}).value, send: (document.querySelector('#w170sheet [data-w170send]') || {}).textContent }));
    ok('5.4 changing the team keeps the line and lists that team', t3.person === '' && t3.people.join('|') === 'The whole team|Alexis|Alyx Denison|Amanda|Jemeela' && /Laura about the partnership/.test(t3.ask) && t3.send === 'Send to Fundraising', t3);
    await type(f, '#w170ask', '   ');
    await click(f, '#w170sheet [data-w170send]', 400);
    s = await sheet(f);
    ok('5.5 an empty line is not sent', (await calls(f, 'to_team')).length === 0 && /Say in one line what they should do\./.test(s.tool), s.tool);
    await type(f, '#w170team', 'progdev', 'change'); await f.page.waitForTimeout(250);
    await type(f, '#w170person', 'zachee.ngue@welfareavenue.com', 'change');
    await type(f, '#w170ask', 'Can you reply to Laura about the partnership call on Tuesday?');
    await click(f, '#w170sheet [data-w170send]', 700);
    const tt = await calls(f, 'to_team');
    s = await sheet(f);
    const go = await f.ev(() => (document.querySelector('#w170sheet [data-w170go]') || {}).getAttribute ? document.querySelector('#w170sheet [data-w170go]').getAttribute('href') : null);
    ok('5.6 Send puts it in the team\'s Hub inbox with the line, for the person', tt.length === 1 && tt[0].body.gmail_id === 'g4' && tt[0].body.team === 'progdev' && tt[0].body.person === 'zachee.ngue@welfareavenue.com' && tt[0].body.ask === 'Can you reply to Laura about the partnership call on Tuesday?', tt);
    ok('5.7 it says where it went and who heard, with a link to it', /In Program Development’s Hub inbox, with your ask\. Zachee Leonel Ngue got a Slack message about it\./.test(s.tool) && go === '#requests/m/321', { tool: s.tool, go });
    ok('5.8 For a team now counts 1', s.tabs[1].t === 'For a team1', s.tabs);
    await shot(f, 's5_team');
    await click(f, '#w170sheet [data-w170sel="g2"]', 600);
    await click(f, '#w170sheet [data-w170mark="team_dismiss"]', 700);
    const dn2 = await calls(f, 'done');
    s = await sheet(f);
    ok('5.9 Not for a team keeps it with him', dn2.length === 2 && dn2[1].body.what === 'team_dismiss' && dn2[1].body.gmail_id === 'g2' && s.tabs[1].t === 'For a team', { dn2, tabs: s.tabs });

    /* ---------- 6. Sorted ---------- */
    await click(f, '#w170sheet [data-w170tab="sorted"]', 700);
    const so = await f.ev(() => {
      const m = document.querySelector('#w170sheet .w170main');
      return { full: m.classList.contains('full'), list: !!document.querySelector('#w170sheet .w170list'), hash: location.hash, chips: [...m.querySelectorAll('.w170sum .w170chip')].map(c => c.textContent), days: [...m.querySelectorAll('.w170day')].map(d => d.textContent),
        rows: [...m.querySelectorAll('.w170row')].map(r => r.textContent), last: (m.querySelector('p') || {}).textContent || '' };
    });
    ok('6.1 Sorted: full width, its address, the summary (personal mail left alone, one to try again)', so.full && !so.list && so.hash === '#mypage/inbox/sorted' && JSON.stringify(so.chips) === JSON.stringify(['3 filed in folders', '2 left in the inbox', '2 personal emails left alone', '1 could not be sorted Try again']), so);
    ok('6.2 by day, with the folder and out of the inbox', so.days.join('|') === 'Today|Wednesday, September 23' && so.rows.some(r => /NPO News.*Org Emails\/NPO Newsletters, out of the inbox/.test(r)) && so.rows.some(r => /Maria Lopez.*No folder.*Reply: draft saved/.test(r)), so);
    ok('6.3 the last run is said plainly', /Last run: 4 new, 3 filed, 1 left in the inbox\./.test(so.last), so.last);
    await click(f, '#w170sheet [data-w170unlabel="g2"]', 600);
    const ul = await calls(f, 'unlabel');
    const so2 = await f.ev(() => [...document.querySelectorAll('#w170sheet .w170sum .w170chip')].map(c => c.textContent));
    ok('6.4 Take the label off', ul.length === 1 && ul[0].body.gmail_id === 'g2' && so2[0] === '2 filed in folders', { ul, so2 });
    await shot(f, 's6_sorted');

    /* ---------- 7. Settings ---------- */
    await click(f, '#w170sheet [data-w170tab="settings"]', 700);
    const st = await f.ev(() => ({ auto: document.getElementById('w170auto').checked, days: document.getElementById('w170days').value, labs: [...document.querySelectorAll('#w170sheet .w170lab')].map(l => ({ n: l.querySelector('b').textContent, note: l.querySelector('input[type=text]').value, arch: l.querySelector('input[type=checkbox]').checked })), read: document.querySelector('#w170sheet [data-w170relabels]').parentNode.textContent, hash: location.hash }));
    ok('7.1 Settings: the schedule, the look back, his folders with notes and out of the inbox', st.hash === '#mypage/inbox/settings' && st.auto && st.days === '3' && st.labs.length === 4 && st.labs[1].note === 'Anything from Keela' && st.labs[3].arch && !st.labs[0].arch && /Read 5 h ago/.test(st.read), st);
    await type(f, '#w170auto', null, 'change'); await f.ev(() => { const a = document.getElementById('w170auto'); a.checked = false; a.dispatchEvent(new Event('change', { bubbles: true })); });
    await type(f, '#w170days', '5', 'change');
    await type(f, '#w170sheet [data-w170lnote="Label_1"]', 'Invoices and receipts');
    await f.ev(() => { const a = document.querySelector('#w170sheet [data-w170arch="Label_3"]'); a.checked = true; a.dispatchEvent(new Event('change', { bubbles: true })); });
    await type(f, '#w170snd', 'newsletter@example.org');
    await click(f, '#w170sheet [data-w170saveset]', 700);
    const ss = await calls(f, 'settings');
    ok('7.2 Save sends the schedule, the notes, the folders out of the inbox and the never-read list', ss.length === 1 && ss[0].body.auto_sort === false && ss[0].body.days_back === 5 && ss[0].body.label_notes.Label_1 === 'Invoices and receipts' && ss[0].body.label_notes.Label_2 === 'Anything from Keela' && JSON.stringify(ss[0].body.archive_labels) === JSON.stringify(['Label_5', 'Label_3']) && ss[0].body.skip_senders === 'newsletter@example.org', ss);
    await click(f, '#w170sheet [data-w170relabels]', 600);
    const rl = await calls(f, 'labels');
    ok('7.3 Read my folders again', rl.length === 1 && rl[0].body.refresh === true, rl);
    await shot(f, 's7_settings');

    /* ---------- 8. Check now, then close ---------- */
    await click(f, '#w170sheet [data-w170sort]', 500);
    s = await sheet(f);
    const sb = await f.ev(() => { const b = document.querySelector('#w170sheet [data-w170sort]'); return { t: b.textContent, d: b.disabled }; });
    ok('8.1 Check now sorts, and says so while it runs', (await calls(f, 'sort')).length === 1 && sb.t === 'Sorting…' && sb.d && s.status === 'Sorting your new mail…', { sb, status: s.status });
    await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(400);
    s = await sheet(f);
    const pl = await f.ev(() => window.w170.state().poll);
    ok('8.2 Escape closes it: back to #mypage, the page scrolls again, the check stops', s && !s.on && !s.lock && s.hash === '#mypage' && pl === null, { on: s && s.on, lock: s && s.lock, hash: s && s.hash, pl });
    ok('8.3 no page errors through it all', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* ---------- 9. the address opens it at load ---------- */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage/inbox/settings', fixture: fx(), wait: 5200, candidate: CAND, init: INIT });
    await f.page.waitForTimeout(1200);
    const s = await sheet(f);
    ok('9.1 #mypage/inbox/settings opens the assistant on Settings', s && s.on && s.tabs.find(t => t.on) && s.tabs.find(t => t.on).t === 'Settings' && /Sort new mail into my folders every 15 minutes/.test(s.main), s && { on: s.on, tabs: s.tabs });
    await f.hash('#mypage/inbox/team', 900);
    const s2 = await sheet(f);
    ok('9.2 changing the address changes the tab', s2.tabs.find(t => t.on).t === 'For a team2', s2.tabs);
    await f.hash('#calendar', 900);
    const s3 = await sheet(f);
    ok('9.3 leaving for another page closes it', s3 && !s3.on && !s3.lock, s3 && { on: s3.on, lock: s3.lock });
    ok('9.4 no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* ---------- 10. not on for everyone ---------- */
  {
    const f = await fresh(browser, { who: 'plain', width: 1366, hash: '#mypage', fixture: fx({ noOwner: true }), wait: 5200, candidate: CAND, init: INIT });
    await f.page.waitForTimeout(1000);
    const card = await f.ev(() => !!document.getElementById('w170card'));
    ok('10.1 a member whose mailbox it does not work on sees no card', !card, card);
    await f.hash('#mypage/inbox', 1200);
    const s = await sheet(f);
    ok('10.2 and the address says it is not on for their mailbox', s && s.on && /Not on for your mailbox/.test(s.main + (await f.ev(() => document.getElementById('w170sheet').textContent))), s);
    ok('10.3 nothing was asked of the mybox function', (await calls(f)).length === 0, await calls(f));
    ok('10.4 no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }
  {
    const f = await fresh(browser, { who: 'board', width: 1366, hash: '#mypage', fixture: fx(), wait: 5200, candidate: CAND, init: INIT });
    await f.page.waitForTimeout(1000);
    const card = await f.ev(() => !!document.getElementById('w170card'));
    ok('10.5 a board viewer sees no card', !card, card);
    ok('10.6 no page errors (board)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* ---------- 11. phones ---------- */
  {
    const f = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', fixture: fx(), wait: 5200, candidate: CAND, init: INIT });
    await f.page.waitForTimeout(1200);
    const c = await f.ev(() => { const el = document.getElementById('w170card'); return el ? { r: Math.round(el.getBoundingClientRect().right), tiles: [...el.querySelectorAll('.w170tiles button')].map(b => Math.round(b.getBoundingClientRect().right)), sw: document.scrollingElement.scrollWidth } : null; });
    ok('11.1 the card fits a phone', c && c.r <= 390 && c.tiles.length === 3 && c.tiles.every(x => x <= 390) && c.sw <= 392, c);
    await shot(f, 's11_phone_card');
    await click(f, '#w170card [data-w170open="reply"]', 900);
    const p1 = await f.ev(() => { const s = document.getElementById('w170sheet'), l = s.querySelector('.w170list'), m = s.querySelector('.w170main'); return { list: l && getComputedStyle(l).display !== 'none', main: m && getComputedStyle(m).display !== 'none', sel: s.classList.contains('sel'), w: Math.round(s.querySelector('.w170sh').getBoundingClientRect().width) }; });
    ok('11.2 on a phone the list comes first, full width', p1.list && !p1.main && !p1.sel && p1.w === 390, p1);
    await shot(f, 's11_phone_list');
    await click(f, '#w170sheet [data-w170sel="g1"]', 800);
    const p2 = await f.ev(() => { const s = document.getElementById('w170sheet'), l = s.querySelector('.w170list'), m = s.querySelector('.w170main'), b = s.querySelector('[data-w170back]'); return { list: getComputedStyle(l).display !== 'none', main: getComputedStyle(m).display !== 'none', back: b && getComputedStyle(b).display !== 'none', sw: m.scrollWidth, cw: m.clientWidth }; });
    ok('11.3 an email opens on its own with a Back button, nothing sideways', !p2.list && p2.main && p2.back && p2.sw <= p2.cw + 1, p2);
    await shot(f, 's11_phone_mail');
    await click(f, '#w170sheet [data-w170back]', 500);
    const p3 = await f.ev(() => { const s = document.getElementById('w170sheet'); return getComputedStyle(s.querySelector('.w170list')).display !== 'none'; });
    ok('11.4 Back goes to the list', p3, p3);
    await click(f, '#w170sheet [data-w170tab="settings"]', 600);
    const p4 = await f.ev(() => { const m = document.querySelector('#w170sheet .w170main'); const t = document.querySelector('#w170sheet .w170tabs'); return { sw: m.scrollWidth, cw: m.clientWidth, tabsR: Math.round(t.getBoundingClientRect().right) }; });
    ok('11.5 Settings fits a phone', p4.sw <= p4.cw + 1 && p4.tabsR <= 390, p4);
    await shot(f, 's11_phone_settings');
    ok('11.6 no page errors on phones', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* ---------- 12. the team inbox: info@ passed on, filed quietly, sent on from an inbox ---------- */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#requests/team/fundraising', fixture: fx(), wait: 5200, candidate: CAND, init: INIT });
    await f.page.waitForTimeout(1200);
    const r = await f.ev(() => { const el = document.querySelector('#w123 .w123row[data-w123m="501"]'); return el ? { s: (el.querySelector('.s') || {}).textContent, pill: (el.querySelector('.w123pill.jev') || {}).textContent } : null; });
    ok('12.1 in the team inbox an info@ email shows what to do first, and who heard', r && r.s === 'To do: Send Robert Chen his tax receipt for the $250 he gave on August 14. (info@)' && r.pill === 'Sent to Alexis', r);
    await f.hash('#requests/m/501', 1200);
    const m1 = await f.ev(() => { const s = document.getElementById('w123sheet'); const b = [...s.querySelectorAll('.blk')].map(x => x.textContent); return { what: b.find(x => /^What to do/.test(x)) || null, did: b.find(x => /^What the Hub did/.test(x)) || null, jev: (s.querySelector('.w123jevbox b') || {}).textContent }; });
    ok('12.2 the email says what to do, that the Hub wrote it, and who it went to', m1.what === 'What to doSend Robert Chen his tax receipt for the $250 he gave on August 14.Sent to info@; the Hub wrote this line and passed it to Alexis.' && m1.jev === 'Sent to Alexis on Slack', m1);
    ok('12.3 What the Hub did: passed on, nothing emailed', m1.did === 'What the Hub didSent to info@ and passed on to Alexis with what to do. Nothing was emailed.', m1.did);
    await f.hash('#requests/m/502', 1200);
    const m2 = await f.ev(() => { const s = document.getElementById('w123sheet'); const b = [...s.querySelectorAll('.blk')].map(x => x.textContent); return { what: b.find(x => /^What to do/.test(x)) || null, did: b.find(x => /^What the Hub did/.test(x)) || null, jev: (s.querySelector('.w123jevbox b') || {}).textContent }; });
    ok('12.4 someone on the thread already: filed quietly, and it says why', m2.jev === 'Filed quietly: Ahmed is already on the email' && m2.did === 'What the Hub didSent to info@. Ahmed is already on the email, so it was filed here without a ping.' && /Sent to info@; the Hub wrote this line\. Ahmed is already on the email\./.test(m2.what || ''), m2);
    await f.hash('#requests/m/503', 1200);
    const m3 = await f.ev(() => { const s = document.getElementById('w123sheet'); const b = [...s.querySelectorAll('.blk')].map(x => x.textContent); return { what: b.find(x => /^What to do/.test(x)) || null, did: b.find(x => /^What the Hub did/.test(x)) || null, jev: (s.querySelector('.w123jevbox b') || {}).textContent }; });
    ok('12.5 sent on from an inbox: his line, who it is for, the channel', /Can you reply to Laura about the partnership call on Tuesday\?From Steel MacDonald, who sent it on from their inbox, for Zachee Leonel Ngue\./.test(m3.what || '') && m3.jev === 'Posted in #program-development' && m3.did === 'What the Hub didSent to the team by Steel MacDonald from their inbox.', m3);
    ok('12.6 no page errors in the team inbox', f.errs.length === 0, f.errs);
    await f.close();
  }

  console.log(out.join('\n'));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
