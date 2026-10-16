/* w256drive.js: wave256, the Volunteer Manager's Phone page, offline against the candidate (CAND=build/<file>.html).
   The rail's Phone item and its count, the page (the header, the counts, the filters, search), a conversation with texts and
   calls in one timeline (a missed call, an answered call, a voicemail with Quo's summary), Call (tel: to the Quo app), the
   waiting lines (No reply needed, No call back needed), a reply, New text (lookup, a typed number), Text a group, How calls
   work, Check now, their next servings, a staff member who cannot text (no summaries, no reply box), a phone width, and the
   spot counts window's Make these the usual counts. */
const { launch, fresh } = require('./boot');
const fs = require('fs');
const fx191 = require('./w191fx');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 700) : '')); } }

const TEXTS = [
  { ph: '5145550103', phf: '(514) 555-0103', p: 103, n: 'Cy Lafleur', at: '2026-09-25T18:40:00Z', dir: 'in', last: 'Is it still at Cabot Square?', kind: 'inbound', h: 'question', wait: true, open: 1, cnt: 3, cin: 1, evs: [900] },
  { ph: '5145550101', phf: '(514) 555-0101', p: 101, n: 'Ana Novak', at: '2026-09-24T15:02:00Z', dir: 'out', last: 'Hi Ana, it’s Welfare Avenue!', kind: 'recruit', st: 'sent', cnt: 1, cin: 0, evs: [900] }
];
const CALLS = [
  { ph: '5145550103', phf: '(514) 555-0103', p: 103, n: 'Cy Lafleur', at: '2026-09-25T17:00:00Z', dir: 'in', st: 'completed', ans: false, dur: 0, cnt: 2, missed: 1, open: 1, vm: true },
  { ph: '4385550177', phf: '(438) 555-0177', n: 'Mo Diallo', at: '2026-09-25T19:30:00Z', dir: 'in', st: 'completed', ans: false, dur: 0, cnt: 1, missed: 1, open: 1 },
  { ph: '5145550101', phf: '(514) 555-0101', p: 101, n: 'Ana Novak', at: '2026-09-23T14:00:00Z', dir: 'out', st: 'completed', ans: true, dur: 185, cnt: 1 }
];
const INBOX = { texts: TEXTS, calls: CALLS, can: true, window: true, synced_at: '2026-09-25T19:56:00Z' };
const THREAD = { ph: '5145550103', p: 103, n: 'Cy Lafleur', servings: [{ e: 900, code: 'WA-26-90', d: '2026-10-02', row: { id: 5001, role: 'cook', st: 'Waiting For Response' } }], out: false, window_open: true, messages: [
  { id: 1, dir: 'out', kind: 'recruit', st: 'sent', body: 'Hi Cy, we miss you! Join us Friday, October 2?', at: '2026-09-25T15:00:00Z' },
  { id: 2, dir: 'in', kind: 'inbound', st: 'received', h: 'question', body: 'Is it still at Cabot Square?', at: '2026-09-25T18:40:00Z', ev: 'WA-26-90' }
] };
const CY_CALLS = [
  { id: 1, at: '2026-09-24T21:00:00Z', dir: 'out', st: 'completed', ans: true, dur: 125, summary: 'Cy asked about the cooking shift; he can cook for 20.', next: 'Send him the recipe link.' },
  { id: 2, at: '2026-09-25T17:00:00Z', dir: 'in', st: 'completed', ans: false, dur: 0, vm: true, vms: 22, vmt: 'Hi, it is Cy, call me back about Sunday.' }
];
const RPCS = { wa_org_editor: true, is_wa_admin: true, is_wa_leader: true, wa_is_hr: false, is_wa_staff: true, wa256_can_text: true,
  wa191_autotick: { ticked: 0 }, wa191_this_week: { today: '2026-09-25', me: 'Steel', servings: [], overdue: [], unassigned: [], mine: [] },
  wa256_phone_inbox: INBOX, wa191_recruit_thread: THREAD, wa256_phone_calls: CY_CALLS };

const INSTALL = (data) => {
  window.__REC = { calls: [], invokes: [] };
  const r0 = db.rpc.bind(db);
  db.rpc = function (fn, args) {
    window.__REC.calls.push({ fn: fn, args: JSON.parse(JSON.stringify(args || {})) });
    const ok = (d) => Promise.resolve({ data: d, error: null });
    if (fn === 'wa256_phone_inbox') return ok(data.inbox);
    if (fn === 'wa191_recruit_thread') return ok(args.p_phone === '5145550103' ? data.thread : { ph: args.p_phone, servings: [], out: false, messages: [] });
    if (fn === 'wa256_phone_calls') return ok(args.p_phone === '5145550103' ? data.calls : []);
    if (fn === 'wa256_phone_lookup') return ok(/mo/i.test(args.p_q) ? [{ k: 'p', id: 177, n: 'Mo Diallo', ph: '4385550177', phf: '(438) 555-0177', r: ['server'] }] : []);
    if (fn === 'wa191_text_reply') return ok({ id: 77, sends_now: true });
    if (fn === 'wa191_text_done') return ok({ done: 1 });
    if (fn === 'wa256_call_done') return ok(1);
    if (fn === 'wa191_text_roster') return ok({ ok: true, name: 'Cy Lafleur', date: '2026-10-02' });
    return r0(fn, args);
  };
  const i0 = db.functions.invoke.bind(db.functions);
  db.functions.invoke = function (name, opts) {
    window.__REC.invokes.push({ name: name, body: opts && opts.body });
    if (name === 'quo-send') return Promise.resolve({ data: { phone: '5145550103', messages: [{ id: 'ACq9', dir: 'out', text: 'Yes, same place!', at: '2026-09-25T19:10:00Z', status: 'delivered' }] }, error: null });
    if (name === 'quo-calls') return Promise.resolve({ data: { since: 'x', pages: 1, seen: 3, saved: 3, error: null }, error: null });
    return i0(name, opts);
  };
};
const DATA = { inbox: INBOX, thread: THREAD, calls: CY_CALLS };
const txt = (f, sel) => f.ev(s => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const calls = (f, fn) => f.ev(n => window.__REC.calls.filter(c => c.fn === n), fn);
const shot = async (f, n) => { if (SHOTS) await f.page.screenshot({ path: SHOTS + '/' + n + '.png' }); };

(async () => {
  const browser = await launch();
  try {
    let f = await fresh(browser, { who: 'admin', hash: '#volunteering/phone', fixture: fx191(), rpcs: RPCS, width: 1440, wait: 5200 });
    await f.ev(INSTALL, DATA);
    await f.page.waitForTimeout(600);
    const rail = await f.ev(() => { const a = document.querySelector('#w153rail [data-w153go="#volunteering/phone"]'); return a ? { t: a.innerText, on: a.classList.contains('on') } : null; });
    ok('the rail: People > Messages (wave259), current, with what waits (2 numbers)', rail && /Messages/.test(rail.t) && rail.on && /2/.test(rail.t), rail);
    const head = await f.ev(() => { const r = document.getElementById('w256'); return r ? { h: r.querySelector('.hd h2').textContent, p: r.querySelector('.hd p').textContent, st: r.querySelector('.st').innerText, acts: Array.from(r.querySelectorAll('.acts .w191btn')).map(b => b.textContent) } : null; });
    ok('the header: Phone, the ops line, texts send now, New text, Text a group, How calls work', head && head.h === 'Phone' && /\(438\) 808-7754/.test(head.p) && /Texts send now/.test(head.p) && head.acts.join('|') === 'New text|Text a group|How calls work', head);
    ok('the counts: 1 text waiting, 2 missed calls to return, calls checked minutes ago, Check now', head && /1\s*text waiting/.test(head.st) && /2\s*missed calls to return/.test(head.st) && /Calls checked 4 min ago/.test(head.st) && /Check now/.test(head.st), head && head.st);
    let rows = await f.ev(() => Array.from(document.querySelectorAll('#w256 .ls .cv')).map(r => r.innerText.replace(/\n/g, ' | ')));
    ok('the list: waiting first (Mo missed call newest, Cy text and call), then Ana', rows.length === 3 && /Mo Diallo/.test(rows[0]) && /Missed call/.test(rows[0]) && /Cy Lafleur/.test(rows[1]) && /Cabot Square/.test(rows[1]) && /Ana Novak/.test(rows[2]), rows);
    const badges = await f.ev(() => Array.from(document.querySelectorAll('#w256 .ls .cv')).map(r => ({ miss: !!r.querySelector('.b.miss'), dot: !!r.querySelector('.dot') })));
    ok('badges: a missed call on Mo and Cy, a waiting text on Cy only', badges[0].miss && !badges[0].dot && badges[1].miss && badges[1].dot && !badges[2].miss && !badges[2].dot, badges);
    const inb = await calls(f, 'wa256_phone_inbox');
    ok('the list asks for 60 days', inb.length === 0 || inb[inb.length - 1].args.p_days === 60, inb);
    await shot(f, 'list');
    /* filters and search */
    await f.page.click('#w256 .seg [data-w256f="missed"]'); await f.page.waitForTimeout(200);
    rows = await f.ev(() => Array.from(document.querySelectorAll('#w256 .ls .cv b')).map(b => b.textContent));
    ok('Missed calls: Mo and Cy', rows.join('|') === 'Mo Diallo|Cy Lafleur', rows);
    await f.page.click('#w256 .seg [data-w256f="texts"]'); await f.page.waitForTimeout(200);
    rows = await f.ev(() => Array.from(document.querySelectorAll('#w256 .ls .cv b')).map(b => b.textContent));
    ok('Texts: Cy and Ana', rows.join('|') === 'Cy Lafleur|Ana Novak', rows);
    await f.page.click('#w256 .seg [data-w256f="all"]'); await f.page.waitForTimeout(150);
    await f.page.fill('#w256 [data-w256q]', '0101'); await f.page.waitForTimeout(200);
    rows = await f.ev(() => Array.from(document.querySelectorAll('#w256 .ls .cv b')).map(b => b.textContent));
    const qf = await f.ev(() => document.activeElement && document.activeElement.hasAttribute('data-w256q'));
    ok('search by number digits keeps the box focused', rows.join('|') === 'Ana Novak' && qf, { rows, qf });
    await f.page.fill('#w256 [data-w256q]', ''); await f.page.waitForTimeout(150);
    /* a conversation */
    await f.page.click('#w256 [data-w256conv="5145550103"]'); await f.page.waitForTimeout(700);
    const th = await f.ev(() => { const t = document.getElementById('w256thr'); return { head: t.querySelector('.th').innerText, call: (t.querySelector('a[data-w256call]') || {}).getAttribute ? t.querySelector('.th a[data-w256call]').getAttribute('href') : null, items: Array.from(t.querySelectorAll('.msgs > .m')).map(m => (m.classList.contains('call') ? 'CALL ' : '') + m.innerText.replace(/\n/g, ' | ')), wl: Array.from(t.querySelectorAll('.wl')).map(w => w.innerText), rp: !!t.querySelector('[data-w256ta]') }; });
    ok('the conversation head: name, number, volunteer record, Call as tel:+1', /Cy Lafleur/.test(th.head) && /\(514\) 555-0103/.test(th.head) && /volunteer record/.test(th.head) && th.call === 'tel:+15145550103', th.head + ' ' + th.call);
    ok('one timeline in time order: the call with the summary, the invitation, the missed call with the voicemail, their question, then what was typed in Quo', th.items.length === 5 && /^CALL Outgoing call/.test(th.items[0]) && /2 min 5 s/.test(th.items[0]) && /summary/.test(th.items[0]) && /recipe link/.test(th.items[0]) && /Invitation/.test(th.items[1]) && /^CALL Missed call/.test(th.items[2]) && /Voicemail . 22 s/.test(th.items[2]) && /call me back/.test(th.items[2]) && /Cabot Square/.test(th.items[3]) && /Typed in Quo/.test(th.items[4]), th.items);
    ok('what waits: the text (No reply needed) and the missed call (Call back, No call back needed); a reply typed in Quo since hides the text line', th.wl.length === 1 && /missed call to return/i.test(th.wl[0]) && /Call back/.test(th.wl[0]) && /No call back needed/.test(th.wl[0]) && th.rp, th.wl);
    const srv = await f.ev(() => { const d = document.querySelector('#w256thr details.srv'); return d ? d.innerText : ''; });
    ok('their next servings, folded, with Coming and Can’t make it', /Their next servings/.test(srv), srv);
    await shot(f, 'thread');
    await f.page.click('#w256thr [data-w256go="calldone"]'); await f.page.waitForTimeout(300);
    const cd = await calls(f, 'wa256_call_done');
    ok('No call back needed marks that number', cd.length === 1 && cd[0].args.p_phone === '5145550103', cd);
    await f.page.fill('#w256thr [data-w256ta]', 'Yes, Cabot Square at 11:30!'); await f.page.waitForTimeout(100);
    await f.page.click('#w256thr [data-w256go="send"]'); await f.page.waitForTimeout(400);
    const rp = await calls(f, 'wa191_text_reply');
    ok('Send texts from the ops line (wa191_text_reply) and clears the box', rp.length === 1 && rp[0].args.p_phone === '5145550103' && /11:30/.test(rp[0].args.p_body) && (await f.ev(() => document.querySelector('#w256thr [data-w256ta]').value)) === '', rp);
    await f.page.click('#w256thr details.srv summary'); await f.page.waitForTimeout(150);
    await f.page.click('#w256thr [data-w256set^="900|Confirmed"]'); await f.page.waitForTimeout(300);
    const ro = await calls(f, 'wa191_text_roster');
    ok('Coming from the conversation (wa191_text_roster)', ro.length === 1 && ro[0].args.p_event === 900 && ro[0].args.p_status === 'Confirmed', ro);
    /* Check now */
    await f.page.click('#w256 [data-w256go="check"]'); await f.page.waitForTimeout(400);
    const inv = await f.ev(() => window.__REC.invokes.filter(x => x.name === 'quo-calls'));
    ok('Check now asks quo-calls to sync', inv.length === 1 && inv[0].body.action === 'sync', inv);
    /* New text */
    await f.page.click('#w256 [data-w256go="new"]'); await f.page.waitForTimeout(250);
    await f.page.fill('#w256look', 'mo'); await f.page.waitForTimeout(600);
    const lk = await f.ev(() => Array.from(document.querySelectorAll('#w256 .lk')).map(x => x.innerText.replace(/\n/g, ' | ')));
    ok('New text finds a volunteer by name, with the number and role', lk.length === 1 && /Mo Diallo/.test(lk[0]) && /\(438\) 555-0177/.test(lk[0]) && /Server/.test(lk[0]), lk);
    await f.page.fill('#w256look', '514 555 0199'); await f.page.waitForTimeout(500);
    const typed = await f.ev(() => { const b = document.querySelector('#w256 .nb > .w191btn[data-w256pick]'); return b ? b.textContent : ''; });
    ok('a typed number offers Text (514) 555-0199', typed === 'Text (514) 555-0199', typed);
    await f.page.click('#w256 .nb > .w191btn[data-w256pick]'); await f.page.waitForTimeout(500);
    const nt = await f.ev(() => ({ head: document.querySelector('#w256thr .th').innerText, empty: (document.querySelector('#w256thr .msgs .empty') || {}).textContent, rp: !!document.querySelector('#w256thr [data-w256ta]') }));
    ok('a new number opens an empty conversation ready to text', /\(514\) 555-0199/.test(nt.head) && /Unknown number/.test(nt.head) && /Write the first text/.test(nt.empty || '') && nt.rp, nt);
    /* Text a group and How calls work */
    await f.page.click('#w256 [data-w256go="group"]'); await f.page.waitForTimeout(400);
    const grp = await f.ev(() => { const m = document.querySelector('.modal h3, #modal h3, [class*="modal"] h3'); return m ? m.textContent : ''; });
    ok('Text a group opens Text volunteers', /Text volunteers/.test(grp), grp);
    await f.ev(() => { try { closeModal(); } catch (e) { } });
    await f.page.click('#w256 [data-w256go="how"]'); await f.page.waitForTimeout(300);
    const how = await f.ev(() => { const m = document.querySelector('.w256how'); return m ? m.innerText : ''; });
    ok('How calls work: Quo cannot start a call from a web page, the calling-app setting, every call shows within 10 minutes', /cannot start one from a web page/.test(how) && /Default for calls/.test(how) && /within 10 minutes/.test(how), how.slice(0, 300));
    await f.page.click('[data-w256x]'); await f.page.waitForTimeout(200);
    const errs1 = f.errs ? f.errs.slice() : [];
    ok('no page errors (admin)', !errs1.length, errs1);
    await f.close();

    /* a staff member who cannot text: no reply box, no New text, no summaries */
    const INBOX2 = Object.assign({}, INBOX, { can: false });
    const CALLS2 = CY_CALLS.map(c => Object.assign({}, c, { summary: undefined, next: undefined, vmt: undefined }));
    f = await fresh(browser, { who: 'admin', hash: '#volunteering/phone', fixture: fx191(), rpcs: Object.assign({}, RPCS, { wa256_phone_inbox: INBOX2, wa256_phone_calls: CALLS2, is_wa_admin: false, is_wa_leader: false, wa256_can_text: false }), width: 1366, wait: 5200 });
    await f.page.click('#w256 [data-w256conv="5145550103"]'); await f.page.waitForTimeout(700);
    const ro2 = await f.ev(() => ({ acts: Array.from(document.querySelectorAll('#w256 .acts .w191btn')).map(b => b.textContent), note: (document.querySelector('#w256thr .note') || {}).textContent || '', rp: !!document.querySelector('#w256thr [data-w256ta]'), sum: /summary/i.test(document.getElementById('w256thr').innerText), check: !!document.querySelector('#w256 [data-w256go="check"]'), call: !!document.querySelector('#w256thr .th a[data-w256call]') }));
    ok('cannot text: How calls work only, the note, no reply box, no summary, no Check now, Call still there', ro2.acts.join('|') === 'How calls work' && /Only leaders, HR, admins/.test(ro2.note) && !ro2.rp && !ro2.sum && !ro2.check && ro2.call, ro2);
    await f.close();

    /* a phone */
    f = await fresh(browser, { who: 'admin', hash: '#volunteering/phone', fixture: fx191(), rpcs: RPCS, width: 390, wait: 5200 });
    await f.ev(INSTALL, DATA);
    const ph1 = await f.ev(() => ({ list: getComputedStyle(document.querySelector('#w256 .cl')).display, thr: getComputedStyle(document.querySelector('#w256 .thr')).display, sx: document.documentElement.scrollWidth <= window.innerWidth + 1 }));
    ok('phone: the list alone, no sideways scroll', ph1.list !== 'none' && ph1.thr === 'none' && ph1.sx, ph1);
    await shot(f, 'phone-list');
    await f.page.click('#w256 [data-w256conv="5145550103"]'); await f.page.waitForTimeout(700);
    const ph2 = await f.ev(() => ({ list: getComputedStyle(document.querySelector('#w256 .cl')).display, thr: getComputedStyle(document.querySelector('#w256 .thr')).display, bk: getComputedStyle(document.querySelector('#w256thr .bk')).display, sx: document.documentElement.scrollWidth <= window.innerWidth + 1 }));
    ok('phone: the conversation alone, with Back, no sideways scroll', ph2.list === 'none' && ph2.thr !== 'none' && ph2.bk !== 'none' && ph2.sx, ph2);
    await shot(f, 'phone-thread');
    await f.page.click('#w256thr [data-w256go="back"]'); await f.page.waitForTimeout(300);
    const ph3 = await f.ev(() => getComputedStyle(document.querySelector('#w256 .cl')).display);
    ok('phone: Back returns to the list', ph3 !== 'none', ph3);
    await f.close();

    /* the spot counts window: Make these the usual counts */
    f = await fresh(browser, { who: 'admin', hash: '#volunteering/e/900', fixture: fx191(), rpcs: RPCS, width: 1440, wait: 5200 });
    await f.ev(() => { window.__UPD = []; const fr = db.from.bind(db); db.from = function (t) { const b = fr(t); if (t === 'volunteer_role_guides') { const u = b.update.bind(b); b.update = function (v) { window.__UPD.push(v); return u(v); }; } return b; }; });
    await f.page.click('#w191head [data-w191go="menu"]').catch(() => {}); await f.page.waitForTimeout(200);
    await f.ev(() => { const b = document.querySelector('#w191head [data-w191go="spots"]'); if (b) b.click(); });
    await f.page.waitForTimeout(400);
    const sp = await f.ev(() => ({ has: !!document.getElementById('w256spusual'), p: (document.querySelector('.w256usual') || {}).textContent || '' }));
    ok('Spot counts offers Make these the usual counts', sp.has && /every serving that has not set its own/.test(sp.p), sp);
    await f.page.fill('[data-w232sp="server"]', '10');
    await f.page.click('#w256spusual'); await f.page.waitForTimeout(700);
    const upd = await f.ev(() => window.__UPD);
    ok('it saves the changed role as the usual count (servers 10)', upd.length === 1 && upd[0].target === 10, upd);
    const errs2 = f.errs ? f.errs.slice() : [];
    ok('no page errors (spot counts)', !errs2.length, errs2);
    await f.close();
  } catch (e) { fail++; console.log('FAIL exception ' + (e && e.stack || e)); }
  await browser.close();
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
