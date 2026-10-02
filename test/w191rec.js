/* w191rec.js: wave191e, Find volunteers and the conversations, offline against the candidate (CAND=build/<file>.html).
   The Recruit stage's buttons, the sheet (servings, the five groups and their counts, filters, selecting, Review the texts with
   the wording per group and the real texts from a dry run, editing the wording without losing the cursor, Invite), the
   Conversations tab (the list, a thread with what was typed in Quo, a reply), This week's waiting texts, the Texts card's Reply,
   a phone, a staff member who cannot text. wave191i/j: "Typed in Quo" on copied texts, No reply needed, the next servings under
   the name (Coming, Add as coming, a name for an unknown number), drafts that survive a refresh. */
const { launch, fresh } = require('./boot');
const fs = require('fs');
const fx191 = require('./w191fx');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 700) : '')); } }

function fixture() {
  const fx = fx191();
  /* a second upcoming serving, to invite to two at once */
  const ev2 = Object.assign({}, fx.volunteer_events.filter(e => e.id === 900)[0], { id: 902, code: 'WA-26-92', event_date: '2026-10-16', title: null });
  fx.volunteer_events.push(ev2);
  fx.volunteer_event_summary.push(Object.assign({}, fx.volunteer_event_summary.filter(e => e.id === 900)[0], { id: 902, code: 'WA-26-92', event_date: '2026-10-16', title: null, roster_count: 2, roster_confirmed: 0, steps_done: 0 }));
  return fx;
}
const P = (o) => Object.assign({ s: 0, su: '2026-08-01', g: [] }, o);
const POOL = { today: '2026-09-25', lapsed_days: 60, regular_min: 3, mode: 'live', window_open: true, people: [
  P({ c: 1001, p: 101, n: 'Ana Novak', f: 'Ana', ph: '(514) 555-0101', g: ['never'], su: '2026-08-01' }),
  P({ c: 1002, p: 102, n: 'Bo Nguyen', f: 'Bo', g: ['never'], su: '2025-11-12' }),
  P({ c: 1003, p: 103, n: 'Cy Lafleur', f: 'Cy', ph: '(514) 555-0103', s: 6, l: '2026-05-10', top: 'cook', roles: ['cook'], g: ['lapsed'], ask: 8, no: 1 }),
  P({ c: 1004, p: 104, n: 'Di Ortiz', f: 'Di', ph: '(514) 555-0104', s: 1, l: '2026-06-14', top: 'server', g: ['once'], tx: '2026-09-23' }),
  P({ c: 1005, p: 105, n: 'Ed Lemaire', f: 'Ed', ph: '(438) 555-0105', s: 1, l: '2026-07-12', top: 'server', g: ['once', 'liked'], lk: { on: '2026-07-12', w: 'Excellent', again: 'Yes', src: 'form' }, fr: true }),
  P({ c: 1006, p: 106, n: 'Flo Ramos', f: 'Flo', ph: '(514) 555-0106', s: 8, l: '2026-09-06', top: 'driver', g: [] }),
  P({ c: 1007, p: 107, n: 'Gus Oliveira', f: 'Gus', ph: '(514) 555-0107', g: ['never'], on: [{ e: 900, st: 'Waiting For Response', r: 'server' }] }),
  P({ c: 1008, p: 108, n: 'Hal Stone', f: 'Hal', ph: '(514) 555-0108', s: 4, l: '2026-03-08', top: 'server', g: ['lapsed'], out: true }),
  P({ c: 1009, n: 'Iva Crm', f: 'Iva', ph: '(514) 555-0109', g: ['never'], su: '2026-09-01' }),
  P({ c: 1010, p: 110, n: 'Steel MacDonald', f: 'Steel', ph: '(438) 555-4539', t: true, g: ['never'] })
] };
const INBOX = [
  { ph: '5145550103', phf: '(514) 555-0103', p: 103, n: 'Cy Lafleur', at: '2026-09-25T18:40:00Z', dir: 'in', last: 'Is it still at Cabot Square?', kind: 'inbound', h: 'question', wait: true, cnt: 3, cin: 1, evs: [900] },
  { ph: '5145550101', phf: '(514) 555-0101', p: 101, n: 'Ana Novak', at: '2026-09-24T15:02:00Z', dir: 'out', last: 'Hi Ana, it’s Welfare Avenue!', kind: 'recruit', st: 'sent', cnt: 1, cin: 0, evs: [900] },
  { ph: '5145559999', phf: '(514) 555-9999', at: '2026-09-23T13:00:00Z', dir: 'in', last: 'Who is this?', kind: 'inbound', h: 'unmatched', wait: true, cnt: 1, cin: 1 }
];
/* wave191j: the next servings under the name (Cy waits on Oct 2, is not on Oct 16) */
const SERVINGS = [{ e: 900, code: 'WA-26-90', d: '2026-10-02', row: { id: 5001, role: 'cook', st: 'Waiting For Response' } }, { e: 902, code: 'WA-26-92', d: '2026-10-16' }];
const THREAD = { ph: '5145550103', p: 103, n: 'Cy Lafleur', role: 'cook', servings: SERVINGS, out: false, window_open: true, messages: [
  { id: 1, dir: 'out', kind: 'recruit', st: 'sent', body: 'Hi Cy, it’s Welfare Avenue! We miss you. You’ve served with us 6 times and we’d love to have you back on Friday, October 2. Can you join us? Reply YES or NO, or tap here: https://hub.welfareavenue.com/c/abc\nReply STOP to stop texts.', at: '2026-09-25T15:00:00Z', qid: 'ACq1', ev: 'WA-26-90' },
  { id: 2, dir: 'in', kind: 'inbound', st: 'received', h: 'question', body: 'Is it still at Cabot Square?', at: '2026-09-25T18:40:00Z', ev: 'WA-26-90' }
] };
/* an unknown number the team texted from the Quo app (copied in by sync_threads, sent_by 'Quo app') */
const THREAD2 = { ph: '5145559999', p: null, cn: null, servings: [{ e: 900, code: 'WA-26-90', d: '2026-10-02' }, { e: 902, code: 'WA-26-92', d: '2026-10-16' }], out: false, window_open: true, messages: [
  { id: 10, dir: 'out', kind: 'manual', st: 'sent', by: 'Quo app', body: 'Hi! Can you serve with us Friday?', at: '2026-09-23T12:00:00Z', qid: 'ACz1' },
  { id: 11, dir: 'in', kind: 'inbound', st: 'received', h: 'unmatched', body: 'Who is this?', at: '2026-09-23T13:00:00Z' }
] };
const QUO = { phone: '5145550103', messages: [
  { id: 'ACq1', dir: 'out', text: 'Hi Cy, it’s Welfare Avenue! ...', at: '2026-09-25T15:00:00Z', status: 'delivered' },
  { id: 'ACq2', dir: 'in', text: 'Is it still at Cabot Square?', at: '2026-09-25T18:40:00Z', status: 'received' },
  { id: 'ACq3', dir: 'out', text: 'Yes! Same place, see you there.', at: '2026-09-25T19:05:00Z', status: 'delivered' }
] };
const TPL = { never: { en: 'Hi {first}, it’s Welfare Avenue! Thanks for signing up. We’d love to have you at our serving on {dates}. Can you join us? {answer}', fr: 'Bonjour {first}, ici Welfare Avenue! Pouvez-vous venir le {dates}? {answer}' },
  lapsed: { en: 'Hi {first}, we miss you. You’ve served with us {served} times. Join us on {dates}? {answer}', fr: 'Bonjour {first}, vous nous manquez. {answer}' },
  once: { en: 'Hi {first}, thanks again for serving in {last}. Join us on {dates}? {answer}', fr: 'Bonjour {first}, merci encore. Le {dates}? {answer}' },
  liked: { en: 'Hi {first}, thank you for your kind words. Join us on {dates}? {answer}', fr: 'Bonjour {first}, merci pour vos bons mots. Le {dates}? {answer}' },
  other: { en: 'Hi {first}, we need volunteers on {dates}. {answer}', fr: 'Bonjour {first}, nous cherchons des bénévoles le {dates}. {answer}' } };
const RPCS = { wa_org_editor: true, is_wa_admin: true, is_wa_leader: true, wa_is_hr: false, is_wa_staff: true, wa191_autotick: { ticked: 0 }, wa191_this_week: { today: '2026-09-25', me: 'Steel', servings: [], overdue: [], unassigned: [], mine: [] }, wa191_this_week_unclosed: [] };
/* the recruit functions answer by their arguments, and every call is kept */
const INSTALL = (data) => {
  window.__REC = { calls: [], invokes: [] };
  const r0 = db.rpc.bind(db);
  db.rpc = function (fn, args) {
    window.__REC.calls.push({ fn: fn, args: JSON.parse(JSON.stringify(args || {})) });
    const ok = (d) => Promise.resolve({ data: d, error: null });
    if (fn === 'wa191_recruit_pool') return new Promise(res => setTimeout(() => res({ data: data.pool, error: null }), 120));
    if (fn === 'wa191_recruit_templates') return ok(data.tpl);
    if (fn === 'wa191_recruit_templates_save') return ok(data.tpl);
    if (fn === 'wa191_recruit_inbox') return ok(data.inbox);
    if (fn === 'wa191_recruit_thread') return ok((data.threads && data.threads[args.p_phone]) || data.thread);
    if (fn === 'wa191_text_reply') return ok({ id: 77, sends_now: true });
    if (fn === 'wa191_text_done') return ok({ done: 1 });
    if (fn === 'wa191_text_roster') return new Promise(res => setTimeout(() => res({ data: { ok: true, name: args.p_name || 'Cy Lafleur', date: args.p_event === 902 ? '2026-10-16' : '2026-10-02', added: args.p_event === 902, new_person: !!args.p_name, status: args.p_status }, error: null }), 120));
    if (fn === 'wa191_recruit_send') {
      const ppl = args.p_people || []; const evs = args.p_events || [];
      const texted = ppl.filter(p => p.contact_id !== 1008).length;
      const prev = ppl.map(p => { const x = data.pool.people.filter(y => y.c === p.contact_id)[0] || {}; const ed = ((args.p_texts || {})[p.group] || {}).en; return { n: x.n, g: p.group, text: (ed ? ed.replace('{first}', x.f) : 'Hi ' + x.f + ', it’s Welfare Avenue! Join us on ' + (evs.length > 1 ? 'October 2 or October 16' : 'Friday, October 2') + '? Reply YES or NO, or tap here: https://hub.welfareavenue.com/c/PREVIEW') + '\nReply STOP to stop texts.', chars: 160, why: p.contact_id === 1008 ? 'stopped texts (STOP)' : null }; });
      if (args.p_dry) return new Promise(res => setTimeout(() => res({ data: { dry: true, people: ppl.length, added: ppl.length * evs.length, kept: 0, texts: args.p_text ? texted : 0, opted_out: ppl.length - texted, mode: data.pool.mode, sends_now: true, previews: prev }, error: null }), 150));
      return ok({ dry: false, people: ppl.length, added: ppl.length * evs.length, kept: 0, texts: args.p_text ? texted : 0, opted_out: ppl.length - texted, no_phone: 0, new_records: ppl.filter(p => !p.person_id).length, mode: data.pool.mode, sends_now: true, batch: 'b1' });
    }
    return r0(fn, args);
  };
  const i0 = db.functions.invoke.bind(db.functions);
  db.functions.invoke = function (name, opts) { window.__REC.invokes.push({ name: name, body: opts && opts.body }); if (name === 'quo-send' && opts && opts.body && opts.body.action === 'thread') return Promise.resolve({ data: data.quo, error: null }); return i0(name, opts); };
};
const DATA = { pool: POOL, inbox: INBOX, thread: THREAD, threads: { '5145559999': THREAD2 }, quo: QUO, tpl: TPL };
const vis = (f, sel) => f.ev(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.width > 0 && r.height > 0; }, sel);
const txt = (f, sel) => f.ev(s => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const calls = (f, fn) => f.ev(n => window.__REC.calls.filter(c => c.fn === n), fn);

(async () => {
  const browser = await launch();
  try {
    /* ---------- the serving page: the Recruit stage's way in ---------- */
    let f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fixture(), rpcs: RPCS, width: 1440, wait: 5200 });
    await f.ev(INSTALL, DATA);
    const way = await f.ev(() => {
      const rec = document.querySelector('.w191stage[data-stage="recruit"]');
      return { stageBtn: !!(rec && rec.querySelector('[data-w191go="find"].gold')), conv: !!(rec && rec.querySelector('[data-w191go="conv"]')), note: rec ? rec.textContent : '',
        menu: !!document.querySelector('#w191head .menu [data-w191go="find"]'), next: (document.querySelector('#w191next') || {}).innerText || '', nextBtn: !!document.querySelector('#w191next [data-w191go="find"]') };
    });
    ok('recruit stage: Find volunteers (gold) and Conversations, with what it does', way.stageBtn && way.conv && /never came, regulars we miss/.test(way.note) && /9 am to 7 pm/.test(way.note), way);
    ok('the More menu and Next up offer Find volunteers for a short roster', way.menu && way.nextBtn && /Fill the roster/.test(way.next) && /Find volunteers looks through the CRM/.test(way.next), way.next.slice(0, 300));
    await f.page.click('#w191next [data-w191go="find"]'); await f.page.waitForTimeout(700);
    const sh = await f.ev(() => { const el = document.getElementById('w191rec'); return { open: !!el && el.classList.contains('open'), h: el ? el.querySelector('.hd h3').textContent : '', sub: el ? el.querySelector('.hd p').textContent : '', chips: Array.from(document.querySelectorAll('#w191rec [data-rev]')).map(b => b.innerText.replace(/\n/g, ' ') + (b.classList.contains('on') ? ' [on]' : '')), groups: Array.from(document.querySelectorAll('#w191rec [data-rgroup]')).map(b => b.innerText.replace(/\n/g, ' ')), noscroll: document.documentElement.classList.contains('w191noscroll') }; });
    ok('the sheet opens on People for this serving', sh.open && sh.h === 'Find volunteers' && /October 2/.test(sh.sub) && /WA-26-90/.test(sh.sub) && sh.noscroll, sh);
    ok('the servings to invite to: this one chosen, the next one offered, with confirmed counts', sh.chips.length === 2 && /\[on\]/.test(sh.chips[0]) && !/\[on\]/.test(sh.chips[1]) && /confirmed/.test(sh.chips[0]), sh.chips);
    ok('five groups with counts after the default filters (phone, not texted in 7 days, not already on)', sh.groups.join('|') === 'Never came 3|Regulars we miss 2|Came once 1|Loved it 1|Everyone 7', sh.groups);
    const pc = await calls(f, 'wa191_recruit_pool');
    ok('the pool asks for the chosen serving with 60 days and 3 servings', pc.length >= 1 && JSON.stringify(pc[pc.length - 1].args.p_events) === '[900]' && pc[pc.length - 1].args.p_lapsed_days === 60 && pc[pc.length - 1].args.p_regular_min === 3, pc);
    let rows = await f.ev(() => Array.from(document.querySelectorAll('#w191rec .rw')).map(r => r.innerText.replace(/\n/g, ' | ')));
    ok('never came: who signed up and when, the test phone marked, nobody without a phone or already on', rows.length === 3 && rows.some(r => /Ana Novak/.test(r) && /Signed up Aug 1/.test(r) && /never served/.test(r)) && rows.some(r => /Steel MacDonald/.test(r) && /Test phone/.test(r)) && !rows.some(r => /Bo Nguyen|Gus Oliveira/.test(r)), rows);
    await f.page.click('#w191rec [data-rgroup="lapsed"]'); await f.page.waitForTimeout(250);
    rows = await f.ev(() => Array.from(document.querySelectorAll('#w191rec .rw')).map(r => r.innerText.replace(/\n/g, ' | ')));
    const gn = await txt(f, '#w191rec .gn');
    ok('regulars we miss: how often and when last, STOP shown, the two numbers editable', rows.length === 2 && rows.some(r => /Cy Lafleur/.test(r) && /Served 6 times/.test(r) && /last May 10/.test(r) && /Cook/.test(r)) && rows.some(r => /Hal Stone/.test(r) && /Stopped texts/.test(r)) && /or more servings, none in the last/.test(gn), { rows, gn });
    await f.page.fill('#w191rec [data-rnum="lapsedDays"]', '90'); await f.page.dispatchEvent('#w191rec [data-rnum="lapsedDays"]', 'change'); await f.page.waitForTimeout(400);
    const pc2 = await calls(f, 'wa191_recruit_pool');
    ok('changing "none in the last 60 days" asks the CRM again', pc2[pc2.length - 1].args.p_lapsed_days === 90, pc2.map(c => c.args.p_lapsed_days));
    await f.page.click('#w191rec [data-rgroup="liked"]'); await f.page.waitForTimeout(250);
    rows = await f.ev(() => Array.from(document.querySelectorAll('#w191rec .rw')).map(r => r.innerText.replace(/\n/g, ' | ')));
    ok('loved it: the rating, when, and that they want to come again', rows.length === 1 && /Ed Lemaire/.test(rows[0]) && /Rated it Excellent/.test(rows[0]) && /wants to come again/.test(rows[0]) && /FR/.test(rows[0]), rows);
    /* filters */
    await f.page.click('#w191rec [data-rgroup="once"]'); await f.page.waitForTimeout(200);
    await f.page.uncheck('#w191rec [data-rf="notTexted"]'); await f.page.waitForTimeout(250);
    rows = await f.ev(() => Array.from(document.querySelectorAll('#w191rec .rw')).map(r => r.innerText.replace(/\n/g, ' | ')));
    ok('"not texted in 7 days" off: someone texted two days ago shows, with when', rows.length === 2 && rows.some(r => /Di Ortiz/.test(r) && /Texted 2 days ago/.test(r)), rows);
    await f.page.check('#w191rec [data-rf="notTexted"]'); await f.page.waitForTimeout(150);
    await f.page.click('#w191rec [data-rgroup="all"]'); await f.page.waitForTimeout(150);
    await f.page.fill('#w191rec [data-rq]', 'flo'); await f.page.waitForTimeout(450);
    rows = await f.ev(() => Array.from(document.querySelectorAll('#w191rec .rw')).map(r => r.innerText.replace(/\n/g, ' | ')));
    const qFocus = await f.ev(() => document.activeElement && document.activeElement.hasAttribute('data-rq'));
    ok('search finds by name and keeps the cursor in the box', rows.length === 1 && /Flo Ramos/.test(rows[0]) && /Served 8 times/.test(rows[0]) && qFocus, { rows, qFocus });
    await f.page.fill('#w191rec [data-rq]', ''); await f.page.waitForTimeout(400);
    await f.page.selectOption('#w191rec [data-rrole]', 'cook'); await f.page.waitForTimeout(250);
    rows = await f.ev(() => Array.from(document.querySelectorAll('#w191rec .rw')).map(r => r.innerText.replace(/\n/g, ' | ')));
    ok('a role narrows to the people who do it', rows.length === 1 && /Cy Lafleur/.test(rows[0]), rows);
    await f.page.selectOption('#w191rec [data-rrole]', ''); await f.page.waitForTimeout(200);
    /* select across groups, then two servings */
    await f.page.click('#w191rec [data-rgroup="never"]'); await f.page.waitForTimeout(200);
    await f.page.check('#w191rec [data-rsel="p101"]'); await f.page.check('#w191rec [data-rsel="c1009"]');
    await f.page.click('#w191rec [data-rgroup="lapsed"]'); await f.page.waitForTimeout(200);
    await f.page.check('#w191rec [data-rsel="p103"]'); await f.page.check('#w191rec [data-rsel="p108"]');
    await f.page.click('#w191rec [data-rgroup="liked"]'); await f.page.waitForTimeout(200);
    await f.page.check('#w191rec [data-rsel="p105"]'); await f.page.waitForTimeout(150);
    let foot = await txt(f, '#w191recfoot');
    ok('the footer counts the people picked across groups', /5\s*selected/.test(foot) && /Ask them as/.test(foot) && /Text them/.test(foot) && /Review the texts/.test(foot), foot);
    await f.page.click('#w191rec [data-rev="902"]'); await f.page.waitForTimeout(500);
    const pc3 = await calls(f, 'wa191_recruit_pool');
    ok('a second serving joins the invitation (the pool asked for both)', JSON.stringify(pc3[pc3.length - 1].args.p_events) === '[900,902]', pc3[pc3.length - 1].args);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/rec_list.png' });
    /* Review the texts */
    await f.page.click('#w191rec [data-rgo="compose"]'); await f.page.waitForTimeout(1300);
    const comp = await f.ev(() => ({ cards: Array.from(document.querySelectorAll('#w191rec .wc h5')).map(h => h.innerText.replace(/\n/g, ' ')), tas: Array.from(document.querySelectorAll('#w191rec [data-rtpl]')).map(t => t.getAttribute('data-rtpl')), bubbles: Array.from(document.querySelectorAll('#w191rec .pv .bub')).map(b => b.innerText), why: Array.from(document.querySelectorAll('#w191rec .pv .why')).map(b => b.innerText), foot: document.getElementById('w191recfoot').innerText, prevLine: (document.querySelector('#w191rec .prev .gn') || {}).innerText || '' }));
    ok('review: one card per group with its wording (French too where someone speaks French)', comp.cards.length === 3 && /Never came 2 people/.test(comp.cards[0]) && /Regulars we miss 2 people/.test(comp.cards[1]) && /Loved it 1 person/.test(comp.cards[2]) && comp.tas.indexOf('liked|fr') >= 0 && comp.tas.indexOf('never|fr') < 0, comp);
    ok('review: the real texts, each with a name, and why someone gets none', comp.bubbles.length === 5 && /Hi Ana/.test(comp.bubbles[0]) && /October 2 or October 16/.test(comp.bubbles[0]) && /Reply STOP to stop texts/.test(comp.bubbles[0]) && comp.why.some(w => /STOP/.test(w)), comp);
    ok('review: the footer says how many are invited and texted', /Invite 5 · send 4 texts/.test(comp.foot) && /10 added as Waiting For Response/.test(comp.prevLine), comp);
    const dry = (await calls(f, 'wa191_recruit_send')).filter(c => c.args.p_dry);
    ok('the preview is a dry run with each person, their group and the servings', dry.length >= 1 && dry[0].args.p_text === true && JSON.stringify(dry[0].args.p_events) === '[900,902]' && dry[0].args.p_people.length === 5 && dry[0].args.p_people.some(p => p.contact_id === 1009 && p.person_id === null && p.group === 'never') && dry[0].args.p_people.some(p => p.person_id === 105 && p.group === 'liked'), dry[0] && dry[0].args);
    /* edit the wording: the cursor stays and the preview follows */
    await f.page.click('#w191rec [data-rtpl="never|en"]');
    await f.page.keyboard.press('Control+End'); await f.page.keyboard.type(' See you soon!', { delay: 25 });
    await f.page.waitForTimeout(1300);
    const ed = await f.ev(() => ({ focus: document.activeElement && document.activeElement.getAttribute('data-rtpl'), val: (document.querySelector('#w191rec [data-rtpl="never|en"]') || {}).value || '', b0: (document.querySelector('#w191rec .pv .bub') || {}).innerText || '' }));
    const dry2 = (await calls(f, 'wa191_recruit_send')).filter(c => c.args.p_dry);
    ok('editing the wording keeps the cursor and the preview shows the new words', ed.focus === 'never|en' && /See you soon!$/.test(ed.val) && /See you soon!/.test(ed.b0) && dry2.length >= 2 && /See you soon!/.test(((dry2[dry2.length - 1].args.p_texts || {}).never || {}).en || ''), { ed, n: dry2.length });
    await f.page.click('#w191rec [data-rph="{last}"]'); await f.page.waitForTimeout(150);
    const ph = await f.ev(() => (document.querySelector('#w191rec [data-rtpl="never|en"]') || {}).value || '');
    ok('a placeholder chip goes where the cursor was', /See you soon!\{last\}$/.test(ph), ph.slice(-40));
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/rec_compose.png' });
    await f.page.check('#w191rec [data-rsave]');
    await f.page.click('#w191rec [data-rgo="send"]'); await f.page.waitForTimeout(900);
    const real = (await calls(f, 'wa191_recruit_send')).filter(c => !c.args.p_dry);
    const saved = await calls(f, 'wa191_recruit_templates_save');
    const done = await txt(f, '#w191recbody');
    ok('invite: the real call (not a dry run), with the edited wording saved as the default first', real.length === 1 && real[0].args.p_text === true && saved.length === 1 && /See you soon!/.test(saved[0].args.p.never.en), { real: real.length, saved: saved.length });
    ok('invite: the summary (added to both servings, texts going out, a new record for the CRM-only person)', /Invitations on their way/.test(done) && /10\s*added to Oct 2, Oct 16/.test(done) && /4\s*invitation texts going out now/.test(done) && /1\s*new volunteer record/.test(done), done.slice(0, 500));
    foot = await txt(f, '#w191recfoot');
    ok('after: see the conversations, find more, done', /See the conversations/.test(foot) && /Find more people/.test(foot) && /Done/.test(foot), foot);
    /* ---------- Conversations ---------- */
    await f.page.click('#w191rec [data-rgo="conv"]'); await f.page.waitForTimeout(500);
    const cl = await f.ev(() => ({ items: Array.from(document.querySelectorAll('#w191rec .cv')).map(b => b.innerText.replace(/\n/g, ' | ') + (b.querySelector('.dot') ? ' [wait]' : '')), badge: (document.querySelector('#w191rec [data-rtab="conv"] .badge') || {}).textContent }));
    ok('conversations: newest first, who waits for an answer marked, an unknown number by its number, the tab counts them', cl.items.length === 3 && /Cy Lafleur/.test(cl.items[0]) && /\[wait\]/.test(cl.items[0]) && /You: Hi Ana/.test(cl.items[1]) && /\(514\) 555-9999/.test(cl.items[2]) && cl.badge === '2', cl);
    await f.page.click('#w191rec [data-rconv="5145550103"]'); await f.page.waitForTimeout(700);
    const th = await f.ev(() => ({ msgs: Array.from(document.querySelectorAll('#w191rec .msgs .m')).map(m => (m.classList.contains('in') ? 'IN ' : 'OUT ') + m.innerText.replace(/\n/g, ' | ')), head: (document.querySelector('#w191rec .th') || {}).innerText || '', reply: !!document.querySelector('#w191rec [data-rreplyta]') }));
    ok('a thread: the invitation, their question, and the answer typed in the Quo app (once each)', th.msgs.length === 3 && /^OUT/.test(th.msgs[0]) && /Invitation/.test(th.msgs[0]) && /^IN/.test(th.msgs[1]) && /Cabot Square/.test(th.msgs[1]) && /^OUT/.test(th.msgs[2]) && /Typed in Quo/.test(th.msgs[2]) && /Cy Lafleur/.test(th.head) && th.reply, th);
    const inv = await f.ev(() => window.__REC.invokes.filter(i => i.name === 'quo-send'));
    ok('the Quo copy comes from quo-send thread for that number', inv.length >= 1 && inv[inv.length - 1].body.action === 'thread' && inv[inv.length - 1].body.phone === '5145550103', inv);
    await f.page.fill('#w191rec [data-rreplyta]', 'Yes, same place. See you Friday!');
    await f.page.click('#w191rec [data-rreply]'); await f.page.waitForTimeout(500);
    const rp = await calls(f, 'wa191_text_reply');
    ok('a reply goes from the ops line through the Hub (the number and the words)', rp.length === 1 && rp[0].args.p_phone === '5145550103' && rp[0].args.p_body === 'Yes, same place. See you Friday!', rp);
    /* wave191j: their servings under the name; wave191i: No reply needed */
    const pl = await f.ev(() => ({ rows: Array.from(document.querySelectorAll('#w191rec .srv .sr')).map(r => r.innerText.replace(/\n/g, ' | ')), wl: (document.querySelector('#w191rec .wl') || {}).innerText || '' }));
    ok('a thread: the next servings under the name (Coming / Can’t make it where listed, Add as coming where not)', pl.rows.length === 2 && /Fri, Oct 2/.test(pl.rows[0]) && /Cook · waiting/.test(pl.rows[0]) && /Coming/.test(pl.rows[0]) && /Can’t make it/.test(pl.rows[0]) && /Fri, Oct 16/.test(pl.rows[1]) && /not on the roster/.test(pl.rows[1]) && /Add as coming/.test(pl.rows[1]), pl);
    ok('a question the team answered in the Quo app minutes ago does not wait (before the 10-minute copy)', pl.wl === '', pl.wl);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/rec_conv.png' });
    await f.page.click('#w191rec [data-rset="900|Confirmed"]'); await f.page.waitForTimeout(500);
    await f.page.click('#w191rec [data-rset="902|Confirmed"]'); await f.page.waitForTimeout(500);
    const ro = await calls(f, 'wa191_text_roster');
    ok('Coming and Add as coming set their place from the conversation (the number, the serving, no name needed)', ro.length === 2 && ro[0].args.p_phone === '5145550103' && ro[0].args.p_event === 900 && ro[0].args.p_status === 'Confirmed' && ro[0].args.p_name === null && ro[1].args.p_event === 902 && ro[1].args.p_status === 'Confirmed', ro);
    /* an unknown number the team texted from the Quo app */
    await f.page.click('#w191rec [data-rconv="5145559999"]'); await f.page.waitForTimeout(700);
    const t2 = await f.ev(() => ({ msgs: Array.from(document.querySelectorAll('#w191rec .msgs .m')).map(m => m.innerText.replace(/\n/g, ' | ')), srn: (document.querySelector('#w191rec .srn') || {}).innerText || '', name: !!document.querySelector('#w191rec [data-rname]'), wl: (document.querySelector('#w191rec .wl') || {}).innerText || '' }));
    ok('a text copied in from the Quo app says "Typed in Quo"; an unknown number asks for a name to add them', t2.msgs.length === 2 && /Typed in Quo/.test(t2.msgs[0]) && /Not in the volunteer directory yet/.test(t2.srn) && t2.name, t2);
    ok('a conversation that waits says so, with No reply needed', /waits for an answer/.test(t2.wl) && /No reply needed/.test(t2.wl), t2.wl);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/rec_conv_unknown.png' });
    await f.page.click('#w191rec [data-rdone]'); await f.page.waitForTimeout(400);
    const dn = await calls(f, 'wa191_text_done');
    ok('No reply needed closes the conversation for that number', dn.length === 1 && dn[0].args.p_phone === '5145559999', dn);
    await f.page.click('#w191rec [data-rset="900|Confirmed"]'); await f.page.waitForTimeout(300);
    const ro2 = await calls(f, 'wa191_text_roster'); const nf = await f.ev(() => !!(document.activeElement && document.activeElement.hasAttribute('data-rname')));
    ok('without a name nothing is saved and the name box gets the focus', ro2.length === 2 && nf, { n: ro2.length, nf });
    await f.page.fill('#w191rec [data-rname]', 'Zoe Park');
    await f.page.fill('#w191rec [data-rreplyta]', 'Hi Zoe, it’s Welfare Avenue');
    await f.page.click('#w191rec [data-rgo="refreshconv"]'); await f.page.waitForTimeout(700);
    const kept = await f.ev(() => ({ ta: (document.querySelector('#w191rec [data-rreplyta]') || {}).value, nm: (document.querySelector('#w191rec [data-rname]') || {}).value }));
    ok('a reply being written and a name being typed survive a refresh', kept.ta === 'Hi Zoe, it’s Welfare Avenue' && kept.nm === 'Zoe Park', kept);
    await f.page.click('#w191rec [data-rset="900|Confirmed"]'); await f.page.waitForTimeout(500);
    const ro3 = await calls(f, 'wa191_text_roster');
    ok('with the name, Add as coming adds them (a new volunteer record)', ro3.length === 3 && ro3[2].args.p_phone === '5145559999' && ro3[2].args.p_name === 'Zoe Park' && ro3[2].args.p_event === 900, ro3[2]);
    await f.page.click('#w191rec [data-rconv="5145550103"]'); await f.page.waitForTimeout(600);
    await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(300);
    ok('Escape closes the sheet and the page scrolls again', !(await vis(f, '#w191rec .sh')) && !(await f.ev(() => document.documentElement.classList.contains('w191noscroll'))));
    /* the Texts card: Reply opens that conversation */
    const rep = await f.ev(() => { const b = document.querySelector('#w171card [data-w191conv]'); return b ? { t: b.textContent, ph: b.getAttribute('data-w191conv') } : null; });
    if (rep) {
      await f.page.evaluate(() => { const b = document.querySelector('#w171card [data-w191conv]'); b.click(); }); await f.page.waitForTimeout(800);
      const st = await f.ev(() => ({ open: document.getElementById('w191rec').classList.contains('open'), tab: (document.querySelector('#w191rec [data-rtab].on') || {}).getAttribute('data-rtab'), th: !!document.querySelector('#w191rec .thr .th') }));
      ok('the Texts card: a reply has Reply (or Open), which opens its conversation', /Reply|Open/.test(rep.t) && st.open && st.tab === 'conv' && st.th, { rep, st });
      await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(200);
    } else ok('the Texts card: a reply has Reply (or Open)', false, 'no reply button in #w171card');
    const errs1 = f.errs.slice(); await f.close();
    ok('no page errors on the serving page', errs1.length === 0, errs1);

    /* ---------- This week: texts waiting for an answer ---------- */
    f = await fresh(browser, { who: 'admin', hash: '#volunteering', fixture: fixture(), rpcs: Object.assign({}, RPCS, { wa191_recruit_inbox: INBOX }), width: 1440, wait: 5000 });
    const wk = await f.ev(() => { const b = document.querySelector('#w191week [data-w191convopen]'); return b ? b.innerText.replace(/\n/g, ' ') : ''; });
    ok('This week: "2 texts from volunteers wait for an answer"', /2 texts from volunteers wait for an answer/.test(wk), wk);
    await f.ev(INSTALL, DATA);
    await f.page.click('#w191week [data-w191convopen]'); await f.page.waitForTimeout(700);
    ok('This week: it opens the conversations', await f.ev(() => document.getElementById('w191rec').classList.contains('open') && document.querySelector('#w191rec [data-rtab="conv"]').classList.contains('on')));
    await f.close();

    /* ---------- test mode, a phone ---------- */
    f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fixture(), rpcs: RPCS, width: 390, wait: 5200 });
    await f.ev(INSTALL, Object.assign({}, DATA, { pool: Object.assign({}, POOL, { mode: 'test' }) }));
    await f.ev(() => window.w191.openRecruit({ tab: 'people', reset: true })); await f.page.waitForTimeout(900);
    const phone = await f.ev(() => { const s = document.querySelector('#w191rec .sh').getBoundingClientRect(); return { w: Math.round(s.width), h: Math.round(s.height), vw: innerWidth, over: document.querySelector('#w191rec .bd').scrollWidth - document.querySelector('#w191rec .bd').clientWidth, rows: document.querySelectorAll('#w191rec .rw').length }; });
    ok('phone: the sheet fills the screen, rows fit, nothing scrolls sideways', phone.w === phone.vw && phone.h > 700 && phone.over <= 1 && phone.rows === 3, phone);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/rec_phone.png' });
    await f.page.check('#w191rec [data-rsel="p110"]'); await f.page.click('#w191rec [data-rgo="compose"]'); await f.page.waitForTimeout(1200);
    const tm = await txt(f, '#w191recbody');
    ok('test mode: the review says only the test phone gets a text and the rest are added', /Test mode/.test(tm) && /Only the test phone gets a text/.test(tm), tm.slice(0, 300));
    await f.page.click('#w191rec [data-rx]'); await f.page.waitForTimeout(200);
    await f.ev(() => window.w191.openRecruit({ tab: 'conv' })); await f.page.waitForTimeout(700);
    await f.page.click('#w191rec [data-rconv="5145550103"]'); await f.page.waitForTimeout(800);
    const pth = await f.ev(() => ({ list: getComputedStyle(document.querySelector('#w191rec .cl')).display, thr: getComputedStyle(document.querySelector('#w191rec .thr')).display, back: getComputedStyle(document.querySelector('#w191rec .bk')).display }));
    ok('phone: a conversation takes the screen, with a way back', pth.list === 'none' && pth.thr === 'flex' && pth.back !== 'none', pth);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/rec_phone_thread.png' });
    await f.page.click('#w191rec [data-rback]'); await f.page.waitForTimeout(300);
    ok('phone: back shows the list again', await f.ev(() => getComputedStyle(document.querySelector('#w191rec .cl')).display !== 'none'));
    const errs3 = f.errs.slice(); await f.close();
    ok('no page errors on the phone', errs3.length === 0, errs3);

    /* ---------- a staff member who cannot text ---------- */
    f = await fresh(browser, { who: 'plain', hash: '#volunteering/e/900', fixture: fixture(), rpcs: Object.assign({}, RPCS, { is_wa_admin: false, is_wa_leader: false, wa_is_hr: false }), width: 1440, wait: 5200 });
    await f.ev(INSTALL, DATA);
    await f.ev(() => window.w191.openRecruit({ tab: 'people', reset: true })); await f.page.waitForTimeout(900);
    const pf = await txt(f, '#w191recfoot');
    ok('staff who cannot text: they can add people, without a text', /Added without a text/.test(pf) && !/Text them/.test(pf), pf);
    await f.ev(() => window.w191.openRecruit({ tab: 'conv' })); await f.page.waitForTimeout(500);
    await f.page.click('#w191rec [data-rconv="5145550103"]'); await f.page.waitForTimeout(700);
    const pn = await txt(f, '#w191rec .thr');
    ok('staff who cannot text: the thread reads, the reply box says who can', /Only leaders, HR and admins can reply/.test(pn) && !(await f.ev(() => !!document.querySelector('#w191rec [data-rreplyta]'))), pn.slice(-200));
    ok('staff who cannot text: they still set someone’s place on a serving, and No reply needed is not theirs', await f.ev(() => !!document.querySelector('#w191rec .srv [data-rset]') && !document.querySelector('#w191rec [data-rdone]')));
    await f.close();
  } catch (e) { fail++; console.log('FAIL crashed :: ' + (e && e.stack || e)); }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
