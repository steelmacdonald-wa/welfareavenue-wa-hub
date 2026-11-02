/* w271drive.js: wave271 Task 8, the HR Center screens. Offline against the candidate (CAND=build/<file>.html), with test/boot.js (stubbed Supabase,
   clock 25/09/26 16:00 Toronto) and test/w271fx.js (a stand-in for onboard-run; every network call is stubbed or blocked).
   The browser runs in Pacific/Auckland, so only Intl with America/Toronto can give the right wall-clock labels and instants.
   Identities: admin, a member on the HR profile, a leader the database refuses, a plain member, a board viewer; 390 px. SHOTS=<dir> saves screenshots.
   Playwright's own Chromium is used when installed, else the PC's Chrome or Edge, with --disable-gpu (see test/w271page.js). */
const fs = require('fs');
const { chromium } = require('playwright');
const { fresh } = require('./boot');
const { fx271, rpcs271, INIT, FLOW, MGR, AT } = require('./w271fx');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, info) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (info !== undefined ? '  ' + JSON.stringify(info).slice(0, 600) : '')); } }
const shot = async (f, n, full) => { if (SHOTS) await f.page.screenshot({ path: SHOTS + '/' + n + '.png', fullPage: full !== false }); };

async function launch() {
  const args = ['--disable-gpu'];
  const tries = [{ args }, { channel: 'chrome', args }, { channel: 'msedge', args }];
  let last;
  for (const t of tries) { try { const b = await chromium.launch(t); return { real: b, newContext: o => b.newContext(Object.assign({ timezoneId: 'Pacific/Auckland' }, o)), close: () => b.close() }; } catch (e) { last = e; } }
  throw last;
}
const RECORD = () => {   /* every table and column list the page asks for, and every rpc */
  window.__O271_FROM = []; window.__O271_RPC = [];
  const f0 = db.from.bind(db), r0 = db.rpc.bind(db);
  db.from = function (t) { const b = f0(t); const s0 = b.select.bind(b); b.select = function (c, o) { window.__O271_FROM.push({ t: t, c: c }); return s0(c, o); }; return b; };
  db.rpc = function (fn, a) { window.__O271_RPC.push({ fn: fn, a: a }); return r0(fn, a); };
};
const open = (f, h) => f.hash(h || '#hrcentre/onboarding', 1500);
const txt = f => f.ev(() => (document.getElementById('o271') || {}).innerText || '');
const calls = (f, action) => f.ev(a => window.__O271_CALLS.filter(c => c.body.action === a), action);
const card = fid => '[data-o271flow="' + fid + '"]';
const click = async (f, sel) => { await f.page.click(sel); await f.page.waitForTimeout(350); };
const fill = async (f, sel, v) => { await f.page.fill(sel, v); await f.page.waitForTimeout(80); };
const cellOf = (fid, iso) => card(fid) + ' [data-o271cell="' + iso + '"]';
const cls = (f, sel) => f.ev(s => { const e = document.querySelector(s); return e ? e.className : null; }, sel);
const hasScroll = f => f.ev(() => document.documentElement.scrollWidth > window.innerWidth + 1);
const consoleErrs = f => { const out = []; f.page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) out.push(m.text().slice(0, 240)); }); return out; };

(async () => {
  const b = await launch();
  const allErrs = [];

  /* ---------- 1. an admin, the whole way ---------- */
  {
    const f = await fresh(b, { who: 'admin', hash: '#hrcentre/onboarding', fixture: fx271(), rpcs: rpcs271(), init: INIT, wait: 5000 });
    const cons = consoleErrs(f);
    await f.ev(RECORD);
    await open(f, '#hrcentre/overview');
    ok('admin: not on the Overview page', !(await f.ev(() => { const e = document.getElementById('o271'); return !!e && e.offsetParent !== null; })));
    await open(f);
    let s = await f.ev(() => {
      const e = document.getElementById('o271'), sel = document.querySelector('#w46body [data-w46assign]'), sec = sel && sel.closest('.w46sec');
      return { has: !!e, vis: !!e && e.offsetParent !== null, h: e && (e.querySelector('h2') || {}).textContent, above: !!e && !!sec && !!(e.compareDocumentPosition(sec) & Node.DOCUMENT_POSITION_FOLLOWING), secVis: !!sec && sec.offsetParent !== null, wrapType: typeof wa46Render };
    });
    ok('admin: Ready to onboard shows', s.has && s.vis && s.h === 'Ready to onboard', s);
    ok('admin: it sits above the existing Onboarding section', s.above && s.secVis, s);
    let t = await txt(f);
    ok('card: name, role', /Amina/.test(t) && /Event Coordinator/.test(t), t.slice(0, 500));
    ok('card: name is escaped', await f.ev(() => !document.querySelector('#o271 b b') && /<b>Yusuf<\/b>/.test(document.getElementById('o271').textContent)));
    ok('NAME: no <b> element comes from the name inside her Ready card', await f.ev(sel => { const e = document.querySelector(sel); return !!e && !Array.from(e.querySelectorAll('b')).some(b => b.textContent === 'Yusuf' || b.querySelector('b')); }, card(FLOW.real)));
    ok('card: grid status', /New hire.s grid: marked/.test(t) && /Manager.s grid: not marked yet/.test(t), t.slice(0, 500));
    ok('card: late flag', /after the reply-by date/.test(t), t.slice(0, 500));
    ok('card: the other-application warning', /1 other application still open/.test(t), t.slice(0, 500));
    ok('card: the date suggested in the offer', /Oct 5/.test(t), t.slice(0, 500));
    ok('card: Send the availability link', /Send the availability link/.test(t));
    ok('card: the practice applicant is labelled', await f.ev(fid => /Practice/.test(document.querySelector('[data-o271flow="' + fid + '"]').innerText), FLOW.practice));
    await shot(f, 'admin_ready_1366');

    await click(f, card(FLOW.real) + ' [data-o271a="link"]');
    let c = await calls(f, 'send_grid_link');
    ok('Send the availability link calls send_grid_link for the candidate', c.length === 1 && c[0].body.candidate_id === 7001 && !c[0].body.accepted, c);
    ok('M5: in test mode the card does not say the link has gone out', /test mode/.test(await f.ev(s2 => document.querySelector(s2).innerText, card(FLOW.real))) && !/has gone out/.test(await f.ev(s2 => document.querySelector(s2).innerText, card(FLOW.real))));

    /* I3: offers still out, with the email-reply route */
    t = await txt(f);
    ok('I3: Offers waiting for an answer lists an offer sent with no answer, practice looking the same', /Offers waiting for an answer/i.test(t) && await f.ev(() => !!document.querySelector('[data-o271offer="7201"]') && !!document.querySelector('[data-o271offer="7202"]')) && await f.ev(() => !document.querySelector('[data-o271offer="7202"] .pr')), t.slice(0, 600));
    ok('I3: not an offer unsent, already accepted or closed', await f.ev(() => ['7203', '7204', '7205'].every(i => !document.querySelector('[data-o271offer="' + i + '"]'))));
    ok('I3: the name is escaped', await f.ev(() => !document.querySelector('[data-o271offer="7201"] b b')));
    const off = '[data-o271offer="7201"]';
    await click(f, off + ' [data-o271a="yesask"]');
    ok('I3: it asks first and calls nothing', (await calls(f, 'send_grid_link')).length === 1 && /Did Olu/.test(await f.ev(s2 => document.querySelector(s2).innerText, off)));
    await click(f, off + ' [data-o271a="yesno"]');
    ok('I3: Cancel leaves it alone', (await calls(f, 'send_grid_link')).length === 1 && await f.page.isVisible(off + ' [data-o271a="yesask"]'));
    await click(f, off + ' [data-o271a="yesask"]');
    await click(f, off + ' [data-o271a="yesgo"]');
    c = await calls(f, 'send_grid_link');
    ok('I3: confirming sends accepted: true for that candidate', c.length === 2 && c[1].body.candidate_id === 7201 && c[1].body.accepted === true, c);
    ok('I3: the card has left the offers', await f.ev(s2 => !document.querySelector(s2), off));

    /* the existing dropdown still works, and the section comes back after wave46 redraws */
    s = await f.ev(async () => {
      const sel = document.querySelector('#w46body [data-w46assign]'); const opt = Array.from(sel.options).filter(o => o.value)[0];
      sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 1500));
      return { rpc: window.__O271_RPC.filter(x => x.fn === 'onboarding_assign').length, val: opt.value };
    });
    ok('the Assign an onboarding dropdown still calls onboarding_assign', s.rpc === 1, s);
    await f.ev(() => { try { closeModal(); } catch (e) { /* none */ } });
    await f.page.waitForTimeout(700);
    s = await f.ev(() => { const e = document.getElementById('o271'), sel = document.querySelector('#w46body [data-w46assign]'), sec = sel && sel.closest('.w46sec'); return { vis: !!e && e.offsetParent !== null, above: !!e && !!sec && !!(e.compareDocumentPosition(sec) & Node.DOCUMENT_POSITION_FOLLOWING), n: document.querySelectorAll('#o271').length }; });
    ok('after the redraw Ready to onboard is back, once, above it', s.vis && s.above && s.n === 1, s);

    /* the picker */
    await click(f, card(FLOW.real) + ' [data-o271a="open"]');
    await f.page.waitForSelector(cellOf(FLOW.real, AT(9)), { timeout: 4000 });
    c = await calls(f, 'preview');
    ok('Choose times calls preview for the flow', c.length >= 1 && c[0].body.flow_id === FLOW.real, c);
    const st = card(FLOW.real) + ' [data-o271a="start"]';
    ok('Start is off with no call time', await f.page.isDisabled(st));
    t = await txt(f);
    ok('preview: address', await f.page.inputValue(card(FLOW.real) + ' [data-o271i="addr"]') === 'amina.yusuf@welfareavenue.com');
    ok('preview: manager and the rule that chose them', await f.page.inputValue(card(FLOW.real) + ' [data-o271i="mgr"]') === String(MGR.first) && /reports to/i.test(t), t.slice(0, 900));
    ok('preview: both times', /Onboarding call/.test(t) && /1-on-1/.test(t));
    ok('preview: the email is editable', await f.page.isEditable(card(FLOW.real) + ' [data-o271i="text"]') && await f.page.isEditable(card(FLOW.real) + ' [data-o271i="subj"]'));
    ok('preview: it says who sends the email (wave275 Task 4: the Hub)', /The Hub sends this one/.test(t) && !/HR sends this one for now/.test(t), t.slice(0, 1500));
    ok('preview: it says [first password] is filled in only in the email itself', /\[first password\] is filled in only in the email itself/.test(t), t.slice(0, 1500));
    ok('TEMPLATE: the preview says the bracketed places fill in at Start', /square brackets\] fills in from the times/.test(t), t.slice(0, 1500));
    ok('preview: the group session field', await f.page.isEditable(card(FLOW.real) + ' [data-o271i="group"]'));
    s = await f.ev(sel => Array.from(document.querySelectorAll(sel + ' [data-o271skip]')).map(x => ({ k: x.getAttribute('data-o271skip'), on: x.checked, off: x.disabled })), card(FLOW.real));
    ok('preview: a switch for every step, roster locked', s.length === 8 && s.every(x => x.on) && s.filter(x => x.off).map(x => x.k).join() === 'roster', s);
    ok('preview: warns when the job description link is missing', /no job description link/.test(t));
    ok('M4: preview: the department shows', /Department: progdev/.test(t), t.slice(0, 1500));

    /* grid: 8 am Monday on the Toronto clock, in a browser in Auckland */
    s = await f.ev(sel => { const g = document.querySelector(sel + ' .o271g'); return { rows: Array.from(g.querySelectorAll('tbody th')).map(x => x.textContent), head: g.querySelector('thead').innerText }; }, card(FLOW.real));
    ok('grid: rows are Toronto wall-clock labels, 8 am to 8:30 pm', s.rows[0] === '8:00 am' && s.rows[s.rows.length - 1] === '8:30 pm' && s.rows.length === 26, s.rows);
    ok('grid: the day labels are Toronto days', /Sep\s*28/.test(s.head) && /Mon/.test(s.head), s.head);
    let k = await cls(f, cellOf(FLOW.real, AT(10)));
    ok('grid, call: the hire\'s time is marked and the manager\'s is not shown', /\bh\b/.test(k) && !/\bm\b/.test(k), k);
    k = await cls(f, cellOf(FLOW.real, AT(9)));
    ok('grid, call: a hub@ meeting the hire is invited to is greyed', /\bbusy\b/.test(k), k);
    ok('grid: the greyed cell names the meeting, escaped', (await f.ev(s2 => document.querySelector(s2).title, cellOf(FLOW.real, AT(9)))).indexOf('Board <i>prep</i>') >= 0);
    await shot(f, 'admin_picker_1366');
    await click(f, card(FLOW.real) + ' [data-o271a="mode"][data-mode="one"]');
    k = await cls(f, cellOf(FLOW.real, AT(10)));
    ok('grid, 1-on-1: overlay shows where both can', /\bh\b/.test(k) && /\bm\b/.test(k), k);
    k = await cls(f, cellOf(FLOW.real, AT(12)));
    ok('grid, 1-on-1: the manager\'s own time shows', /\bm\b/.test(k) && !/\bh\b/.test(k), k);
    k = await cls(f, cellOf(FLOW.real, AT(13)));
    ok('grid, 1-on-1: the manager\'s meeting is greyed', /\bbusy\b/.test(k), k);
    await click(f, card(FLOW.real) + ' [data-o271a="mode"][data-mode="call"]');
    await click(f, cellOf(FLOW.real, AT(10)));
    ok('clicking a cell fills the call time', await f.page.inputValue(card(FLOW.real) + ' [data-o271i="call"]') === '2026-09-28T10:00', await f.page.inputValue(card(FLOW.real) + ' [data-o271i="call"]'));
    ok('Start turns on with a call time and an address', !(await f.page.isDisabled(st)));
    ok('the chosen time reads in Toronto', /Mon.*Sep.*28.*10:00/.test(await f.ev(sel => document.querySelector(sel + ' [data-o271said="call"]').textContent, card(FLOW.real))));

    /* typed time wins, in Toronto */
    await fill(f, card(FLOW.real) + ' [data-o271i="call"]', '2026-09-30T15:30');
    ok('a typed time works', !(await f.page.isDisabled(st)));
    /* the address gate */
    await fill(f, card(FLOW.real) + ' [data-o271i="addr"]', 'not an address');
    ok('Start is off with a bad address', await f.page.isDisabled(st));
    await fill(f, card(FLOW.real) + ' [data-o271i="addr"]', '');
    ok('Start is off with no address', await f.page.isDisabled(st));
    await click(f, card(FLOW.real) + ' [data-o271skip="google"]');
    ok('Start is on with no address when the Google step is off', !(await f.page.isDisabled(st)));
    await click(f, card(FLOW.real) + ' [data-o271skip="google"]');
    await fill(f, card(FLOW.real) + ' [data-o271i="addr"]', 'taken.person@welfareavenue.com');
    await f.page.dispatchEvent(card(FLOW.real) + ' [data-o271i="addr"]', 'change');
    await f.page.waitForTimeout(400);
    ok('a taken address is checked and stops Start', await f.page.isDisabled(st) && /already in use/.test(await txt(f)));
    await fill(f, card(FLOW.real) + ' [data-o271i="addr"]', 'Amina.Yusuf2@welfareavenue.com ');
    await f.page.dispatchEvent(card(FLOW.real) + ' [data-o271i="addr"]', 'change');
    await f.page.waitForTimeout(400);
    ok('changing the address clears it', !(await f.page.isDisabled(st)));

    /* C1: turning Google off for a clash empties the box, so the address can never be sent */
    await fill(f, card(FLOW.real) + ' [data-o271i="addr"]', 'dana@welfareavenue.com');
    await f.page.dispatchEvent(card(FLOW.real) + ' [data-o271i="addr"]', 'change');
    await f.page.waitForTimeout(400);
    t = await txt(f);
    ok('C1: an address on the roster names the person and stops Start', await f.page.isDisabled(st) && /roster profile of Dana Fixture/.test(t), t.slice(0, 800));
    await click(f, card(FLOW.real) + ' [data-o271skip="google"]');
    ok('C1: turning Google off for it empties the address box', await f.page.inputValue(card(FLOW.real) + ' [data-o271i="addr"]') === '');
    ok('C1: and Start is on, with nothing to send', !(await f.page.isDisabled(st)));
    await fill(f, card(FLOW.real) + ' [data-o271i="addr"]', 'taken.person@welfareavenue.com');
    await f.page.dispatchEvent(card(FLOW.real) + ' [data-o271i="addr"]', 'change');
    await f.page.waitForTimeout(400);
    ok('C1: typed again with Google off, it is emptied again', await f.page.inputValue(card(FLOW.real) + ' [data-o271i="addr"]') === '');
    await click(f, card(FLOW.real) + ' [data-o271skip="google"]');
    await fill(f, card(FLOW.real) + ' [data-o271i="addr"]', 'Amina.Yusuf2@welfareavenue.com ');
    await f.page.dispatchEvent(card(FLOW.real) + ' [data-o271i="addr"]', 'change');
    await f.page.waitForTimeout(400);

    /* I4: the dropdown saves the manager before Start, and their marks go with the old one */
    await f.page.selectOption(card(FLOW.real) + ' [data-o271i="mgr"]', String(MGR.second));
    await f.page.waitForTimeout(300);
    c = await calls(f, 'set_manager');
    ok('I4: changing the dropdown calls set_manager', c.length === 1 && c[0].body.flow_id === FLOW.real && c[0].body.member_id === MGR.second, c);
    await click(f, card(FLOW.real) + ' [data-o271a="mode"][data-mode="one"]');
    k = await cls(f, cellOf(FLOW.real, AT(12)));
    ok('I5: the other manager\'s marks are gone from the grid', !/\bm\b/.test(k), k);
    await click(f, card(FLOW.real) + ' [data-o271a="mode"][data-mode="call"]');
    await f.ev(() => { window.__O271_REFUSE = { action: 'set_manager', error: 'no_manager', message: 'Gone Person is not active on the roster. Choose someone else.' }; });
    await f.page.selectOption(card(FLOW.real) + ' [data-o271i="mgr"]', String(MGR.first));
    await f.page.waitForTimeout(300);
    ok('I4: a refusal shows, and the dropdown goes back', /is not active on the roster/.test(await txt(f)) && await f.page.inputValue(card(FLOW.real) + ' [data-o271i="mgr"]') === String(MGR.second));
    await f.page.selectOption(card(FLOW.real) + ' [data-o271i="mgr"]', String(MGR.first));
    await f.page.waitForTimeout(300);

    /* CANVA: the box in the preview, its reminder, the warning when empty, and a bad link stops Start */
    const cb = card(FLOW.real) + ' [data-o271i="canva"]', cs = card(FLOW.real) + ' [data-o271said="canva"]';
    t = await txt(f);
    ok('CANVA: the preview has the box and the reminder', await f.page.isEditable(cb) && /Fresh Canva invite link/i.test(t) && /Canva links last 30 days, so get a new one for each hire: in Canva, go to Invite people, then Get invite link, then Copy\./.test(t), t.slice(0, 1500));
    ok('CANVA: it links to Canva people settings', await f.ev(sel => !!document.querySelector(sel + ' a[href="https://www.canva.com/settings/people"]'), card(FLOW.real)));
    ok('CANVA: empty warns, and Start stays on', /No Canva link yet/.test(await f.page.innerText(cs)) && !(await f.page.isDisabled(st)));
    await fill(f, cb, 'https://evil.example/join');
    ok('CANVA: a link that is not Canva stops Start, in a sentence', await f.page.isDisabled(st) && /must start with https:\/\/www\.canva\.com\//.test(await txt(f)));
    await fill(f, cb, 'https://www.canva.com/brand/join?token=one');
    ok('CANVA: a Canva link clears the warning, and Start is on', !/No Canva link yet/.test(await f.page.innerText(cs)) && !(await f.page.isDisabled(st)));

    /* email, group session, a skipped step; a refusal is shown as it came */
    await fill(f, card(FLOW.real) + ' [data-o271i="subj"]', 'Edited subject');
    await fill(f, card(FLOW.real) + ' [data-o271i="group"]', 'Group session on Oct 8');
    await click(f, card(FLOW.real) + ' [data-o271skip="slack"]');
    await f.ev(() => { window.__O271_REFUSE = { action: 'start', error: 'past_call', message: 'The onboarding call time has already passed. Pick a new time.' }; });
    await click(f, st);
    await f.page.waitForTimeout(300);
    t = await txt(f);
    ok('a refusal from the function shows as it came', /The onboarding call time has already passed\. Pick a new time\./.test(t) && !/non-2xx/.test(t), t.slice(0, 400));
    ok('the panel keeps what HR typed after a refusal', await f.page.inputValue(card(FLOW.real) + ' [data-o271i="group"]') === 'Group session on Oct 8');

    await click(f, st);
    await f.page.waitForSelector(card(FLOW.real) + ' [data-o271a="retry"]', { timeout: 4000 });
    c = await calls(f, 'start');
    const body = c[c.length - 1].body;
    ok('Start: works without a 1-on-1', !body.one_on_one_at, body);
    ok('CANVA: Start sends the link', body.canva_link === 'https://www.canva.com/brand/join?token=one', body);
    ok('Start: the typed Toronto time is the right instant', body.call_at === new Date(Date.UTC(2026, 8, 30, 19, 30)).toISOString(), body.call_at);
    ok('Start: the address, manager, group session, skip and edited email go', body.wa_email === 'amina.yusuf2@welfareavenue.com' && body.manager_member_id === MGR.first && body.group_session === 'Group session on Oct 8' && body.skip.join() === 'slack' && body.welcome && body.welcome.subject === 'Edited subject', body);

    /* the started card */
    t = await f.ev(s2 => document.querySelector(s2).innerText, card(FLOW.real));
    ok('started: each step with its result and reason', /Roster profile/.test(t) && /Created the roster profile/.test(t) && /Calendar invites/.test(t) && /quota/.test(t) && /Slack channel/.test(t) && /Skipped by HR/.test(t), t);
    s = await f.ev(sel => Array.from(document.querySelectorAll(sel + ' [data-o271a="retry"]')).map(x => x.getAttribute('data-step')), card(FLOW.real));
    ok('started: Retry on the failed step only', s.join() === 'invites', s);
    ok('started: hr_task steps show their sentence as a to-do', /To do: Invite them to the Hub at member level/.test(t), t);
    ok('started: I created it, continue with an address box', await f.page.isVisible(card(FLOW.real) + ' [data-o271a="gmanual"]') && await f.page.inputValue(card(FLOW.real) + ' [data-o271i="gaddr"]') === 'amina.yusuf2@welfareavenue.com');
    for (const name of ['Change time', 'Change manager', 'Book the 1-on-1', 'They backed out']) ok('started: ' + name + ' is on the card', t.indexOf(name) >= 0, t);
    ok('started: it left the Ready list', await f.ev(() => document.querySelectorAll('[data-o271flow="501"]').length === 1));
    const noTagFromName = sel => f.ev(s2 => { const e = document.querySelector(s2); return !!e && /<b>Yusuf<\/b>/.test(e.textContent) && !Array.from(e.querySelectorAll('b')).some(b => b.textContent === 'Yusuf' || b.querySelector('b')); }, sel);
    ok('NAME: no <b> element comes from the name inside the started card for Amina', await noTagFromName(card(FLOW.real)));

    /* I7: what HR edited, under the welcome to-do */
    ok('I7: the edited subject, the text and the group session show under the welcome task', /Edited subject/.test(t) && /Congratulations/.test(t) && /group onboarding session on Group session on Oct 8/.test(t), t);
    c = await calls(f, 'welcome');
    ok('TEMPLATE: the card reads the email through onboard-run, filled in: no bracket left', c.some(x => x.body.flow_id === FLOW.real) && /Your first day is Wednesday, September 30, 2026/.test(t) && !/\[first day/.test(t), t);
    await f.ev(() => { window.__COPIED = null; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: x => { window.__COPIED = x; return Promise.resolve(); } } }); });
    await click(f, card(FLOW.real) + ' [data-o271a="copywelcome"]');
    s = await f.ev(() => window.__COPIED);
    ok('I7: Copy the text copies the subject and the text', /Edited subject/.test(s) && /Congratulations/.test(s) && /Group session on Oct 8/.test(s), s);
    ok('I7: the group session is in the copy once, not added again after the text', (s.match(/Group session on Oct 8/g) || []).length === 1 && !/\nGroup session: /.test(s), s);

    /* CANVA: under the welcome task: the reminder, the saved link with a copy button, and the box to replace it */
    const cv = card(FLOW.real) + ' [data-o271canva]';
    s = await f.ev(sel => document.querySelector(sel).innerText, cv);
    ok('CANVA: the card shows the reminder and the saved link', /Canva links last 30 days/.test(s) && /https:\/\/www\.canva\.com\/brand\/join\?token=one/.test(s) && !/No Canva link yet/.test(s), s);
    await click(f, cv + ' [data-o271a="copycanva"]');
    ok('CANVA: Copy the link copies the saved link', (await f.ev(() => window.__COPIED)) === 'https://www.canva.com/brand/join?token=one');
    await fill(f, cv + ' [data-o271i="ccanva"]', 'https://www.canva.com/brand/join?token=two');
    await click(f, cv + ' [data-o271a="canvasave"]');
    c = await calls(f, 'set_canva_link');
    ok('CANVA: Save the link calls set_canva_link', c.length === 1 && c[0].body.flow_id === FLOW.real && c[0].body.link === 'https://www.canva.com/brand/join?token=two', c);
    ok('CANVA: the new link shows', /token=two/.test(await f.ev(sel => document.querySelector(sel).innerText, cv)));
    await f.ev(() => { window.__O271_REFUSE = { action: 'set_canva_link', error: 'bad_canva_link', message: 'The Canva link must start with https://www.canva.com/. Copy it from Invite people in Canva, or leave it empty.' }; });
    await fill(f, cv + ' [data-o271i="ccanva"]', 'https://evil.example/');
    await click(f, cv + ' [data-o271a="canvasave"]');
    ok('CANVA: a refusal shows as it came, and the box keeps what was typed', /must start with https:\/\/www\.canva\.com\//.test(await f.ev(s2 => document.querySelector(s2).innerText, card(FLOW.real))) && await f.page.inputValue(cv + ' [data-o271i="ccanva"]') === 'https://evil.example/');
    await fill(f, cv + ' [data-o271i="ccanva"]', '');
    await click(f, cv + ' [data-o271a="canvasave"]');
    ok('CANVA: cleared, the card warns that there is no link', /No Canva link yet/.test(await f.ev(sel => document.querySelector(sel).innerText, cv)));
    ok('CANVA: no step row was added for it', await f.ev(() => !window.__WAFIX.hub_onboard_steps.some(r => /canva/i.test(r.step))));

    /* M10: a step left to HR can be marked done, but not the Google one */
    s = await f.ev(sel => Array.from(document.querySelectorAll(sel + ' [data-o271a="taskdone"]')).map(x => x.getAttribute('data-step')), card(FLOW.real));
    ok('M10: Done on hub and welcome (slack was skipped), not on google', s.slice().sort().join() === 'hub,welcome', s);
    await click(f, card(FLOW.real) + ' [data-o271a="taskdone"][data-step="hub"]');
    c = await calls(f, 'task_done');
    ok('M10: Done calls task_done for the step', c.length === 1 && c[0].body.flow_id === FLOW.real && c[0].body.step === 'hub', c);
    ok('M10: the step reads done and its button is gone', await f.ev(sel => !document.querySelector(sel + ' [data-o271a="taskdone"][data-step="hub"]'), card(FLOW.real)));
    await shot(f, 'admin_started_1366');

    await click(f, card(FLOW.real) + ' [data-o271a="retry"][data-step="invites"]');
    c = await calls(f, 'retry');
    ok('Retry sends the step', c.length === 1 && c[0].body.flow_id === FLOW.real && c[0].body.step === 'invites', c);
    ok('after Retry the step reads done, no Retry left', !(await f.ev(sel => !!document.querySelector(sel + ' [data-o271a="retry"]'), card(FLOW.real))));
    await f.ev(() => { window.__O271_REFUSE = { action: 'google_manual', error: 'address_taken', message: 'x@welfareavenue.com is on another roster profile. Check the address and try again.' }; });
    await click(f, card(FLOW.real) + ' [data-o271a="gmanual"]');
    ok('a refusal on the card shows as it came', /is on another roster profile/.test(await f.ev(s2 => document.querySelector(s2).innerText, card(FLOW.real))));
    await click(f, card(FLOW.real) + ' [data-o271a="gmanual"]');
    c = await calls(f, 'google_manual');
    ok('I created it, continue sends the address', c.length === 2 && c[1].body.wa_email === 'amina.yusuf2@welfareavenue.com', c);
    ok('the Google step is done and the button is gone', !(await f.ev(sel => !!document.querySelector(sel + ' [data-o271a="gmanual"]'), card(FLOW.real))));

    /* Book the 1-on-1, with the grid */
    await click(f, card(FLOW.real) + ' [data-o271a="act"][data-kind="book"]');
    await f.page.waitForSelector(cellOf(FLOW.real, AT(10)), { timeout: 4000 });
    ok('Book: the overlay shows both people', /\bh\b/.test(await cls(f, cellOf(FLOW.real, AT(10)))) && /\bm\b/.test(await cls(f, cellOf(FLOW.real, AT(10)))));
    await click(f, cellOf(FLOW.real, AT(10)));
    await click(f, card(FLOW.real) + ' [data-o271a="actgo"]');
    c = await calls(f, 'book_one_on_one');
    ok('Book the 1-on-1 calls book_one_on_one', c.length === 1 && c[0].body.at === AT(10), c);
    ok('M5: in test mode it says the invite went to the test inboxes', /test inboxes/.test(await f.ev(s2 => document.querySelector(s2).innerText, card(FLOW.real))));
    ok('once booked, Book is gone and the time shows', !(await f.ev(sel => !!document.querySelector(sel + ' [data-kind="book"]'), card(FLOW.real))) && /Sep.*28/.test(await f.ev(s2 => document.querySelector(s2).innerText, card(FLOW.real))));

    /* Change time */
    await click(f, card(FLOW.real) + ' [data-o271a="act"][data-kind="time"]');
    await f.page.selectOption(card(FLOW.real) + ' [data-o271i="which"]', 'call');
    await fill(f, card(FLOW.real) + ' [data-o271i="at"]', '2026-10-02T09:00');
    await click(f, card(FLOW.real) + ' [data-o271a="actgo"]');
    c = await calls(f, 'change_time');
    ok('Change time sends which and the Toronto instant', c.length === 1 && c[0].body.which === 'call' && c[0].body.at === new Date(Date.UTC(2026, 9, 2, 13, 0)).toISOString(), c);
    ok('Change time shows the warnings that came back', /was not told: they have no Slack account/.test(await f.ev(s2 => document.querySelector(s2).innerText, card(FLOW.real))));

    /* Change manager */
    await click(f, card(FLOW.real) + ' [data-o271a="act"][data-kind="manager"]');
    await f.page.selectOption(card(FLOW.real) + ' [data-o271i="member"]', String(MGR.second));
    await click(f, card(FLOW.real) + ' [data-o271a="actgo"]');
    c = await calls(f, 'change_manager');
    ok('Change manager sends the member', c.length === 1 && c[0].body.member_id === MGR.second, c);
    ok('the new manager shows', /Omar Fixture/.test(await f.ev(s2 => document.querySelector(s2).innerText, card(FLOW.real))));

    /* They backed out: nothing happens before HR confirms */
    await click(f, card(FLOW.real) + ' [data-o271a="act"][data-kind="back"]');
    c = await calls(f, 'backed_out');
    ok('They backed out asks first and calls nothing', c.length === 0 && await f.page.isVisible(card(FLOW.real) + ' [data-o271a="actgo"]'), c);
    await shot(f, 'admin_backout_1366');
    await click(f, card(FLOW.real) + ' [data-o271a="actno"]');
    ok('Cancel leaves it alone', (await calls(f, 'backed_out')).length === 0 && !(await f.ev(sel => !!document.querySelector(sel + ' [data-o271a="actgo"]'), card(FLOW.real))));
    await click(f, card(FLOW.real) + ' [data-o271a="act"][data-kind="back"]');
    await fill(f, card(FLOW.real) + ' [data-o271i="reason"]', 'Took another job');
    await click(f, card(FLOW.real) + ' [data-o271a="actgo"]');
    c = await calls(f, 'backed_out');
    t = await txt(f);
    ok('after confirming, backed_out goes with the reason', c.length === 1 && c[0].body.reason === 'Took another job', c);
    ok('the remove list and the warnings show after it', /Created for this person\. Deactivate it by hand in Roster/.test(t) && /could not be closed/.test(t), t.slice(0, 800));
    ok('the remove list is escaped', await f.ev(() => /<C1>/.test(document.getElementById('o271').textContent)));
    ok('the card has left the list', !(await f.ev(sel => !!document.querySelector(sel), card(FLOW.real))));
    ok('NAME: no <b> element comes from the name inside her backed-out card either', await noTagFromName('[data-o271backed="' + FLOW.real + '"]'));
    await shot(f, 'admin_removed_1366');
    /* D3: the list is worked out from the flow, so it is still there after a reload */
    await f.ev(() => { const s = o271.state(); s.note = {}; return o271.load(); });
    await f.page.waitForTimeout(300);
    t = await txt(f);
    ok('D3: after a reload the backed-out card still has its list', /Backed out/i.test(t) && /backed out\./.test(t) && /Created for this person/.test(t) && /<C1>/.test(await f.ev(() => document.getElementById('o271').textContent)), t.slice(0, 800));

    /* I1: They backed out on a Ready card, with a confirm */
    await click(f, card(FLOW.nomanager) + ' [data-o271a="act"][data-kind="back"]');
    ok('I1: on a Ready card it asks first, and says no invites have gone out', (await calls(f, 'backed_out')).length === 1 && /No invites have gone out/.test(await f.ev(s2 => document.querySelector(s2).innerText, card(FLOW.nomanager))));
    await click(f, card(FLOW.nomanager) + ' [data-o271a="actno"]');
    ok('I1: Cancel leaves it on the list', await f.page.isVisible(card(FLOW.nomanager) + ' [data-o271a="open"]') && (await calls(f, 'backed_out')).length === 1);
    await click(f, card(FLOW.nomanager) + ' [data-o271a="act"][data-kind="back"]');
    await click(f, card(FLOW.nomanager) + ' [data-o271a="actgo"]');
    c = await calls(f, 'backed_out');
    ok('I1: confirming calls backed_out for that flow', c.length === 2 && c[1].body.flow_id === FLOW.nomanager, c);
    t = await txt(f);
    ok('I1: it leaves the Ready list, with nothing to take out', !(await f.ev(sel => !!document.querySelector(sel), card(FLOW.nomanager))) && /Noor Single backed out\./.test(t) && /nothing to take out/.test(t), t.slice(0, 800));

    /* words, and reads */
    t = await txt(f);
    ok('no em dash and no "AI" in the section', !/\u2014/.test(t) && !/\bAI\b/.test(t));
    s = await f.ev(() => window.__O271_FROM.filter(x => x.t === 'hub_onboard_flows' || x.t === 'hub_onboard_steps'));
    ok('flows and steps are read', s.some(x => x.t === 'hub_onboard_flows') && s.some(x => x.t === 'hub_onboard_steps'), s);
    ok('never select * on flows, never pw_nonce', s.every(x => x.c && x.c.indexOf('*') < 0 && x.c.indexOf('pw_nonce') < 0), s);

    /* a clock change: instants come from Intl, either side of 01/11/26 */
    s = await f.ev(() => ({ before: o271.toInstant('2026-10-31T08:00'), after: o271.toInstant('2026-11-02T08:00'), back: o271.toLocal('2026-11-02T13:00:00.000Z'), gap: o271.toInstant('2027-03-14T02:30') }));
    ok('8 am is 12:00Z before the clock change and 13:00Z after', s.before === Date.UTC(2026, 9, 31, 12) && s.after === Date.UTC(2026, 10, 2, 13) && s.back === '2026-11-02T08:00', s);
    ok('a wall-clock time that does not exist is refused', s.gap === null, s);

    ok('admin: no console errors', cons.length === 0, cons);
    allErrs.push(...f.errs); await f.close();
  }

  /* ---------- 2. a started flow read back on a fresh page, and a stuck step ---------- */
  {
    const fx = fx271({ started: true });
    fx.hub_onboard_steps.filter(r => r.step === 'manager').forEach(r => { r.status = 'running'; r.at = '2026-09-25T15:00:00Z'; });
    fx.hub_onboard_steps.filter(r => r.step === 'plan').forEach(r => { r.status = 'running'; r.at = '2026-09-25T19:59:00Z'; });
    fx.hub_onboard_flows.push({ id: 602, candidate_id: 7101, practice: false, status: 'started', manager_member_id: MGR.first, wa_email: 'old@welfareavenue.com', call_at: '2026-06-01T14:00:00Z', one_on_one_at: null, onboarding_id: 41, started_at: '2026-06-01T12:00:00Z' });
    fx.team_members.push({ id: 9103, name: 'Gone Fixture', email: 'gone@example.invalid', active: false, department: 'hr', role: 'Lead', responsibilities: [] });
    fx.hub_onboard_flows.push({ id: 603, candidate_id: 7101, practice: false, status: 'started', manager_member_id: 9103, wa_email: null, call_at: '2026-10-01T14:00:00Z', one_on_one_at: null, onboarding_id: 42, started_at: '2026-09-25T12:00:00Z' });
    const f = await fresh(b, { who: 'admin', hash: '#hrcentre/onboarding', fixture: fx, rpcs: rpcs271({ empty: true }), init: INIT, wait: 5000 });
    await f.ev(RECORD);
    await open(f, '#hrcentre/overview'); await open(f);
    const t = await f.ev(s2 => { const e = document.querySelector(s2); return e ? e.innerText : ''; }, card(FLOW.started));
    ok('reload: a running flow has its card from named columns', /Sam Started/.test(t) && /Driver/.test(t) && /quota/.test(t) && /Dana Fixture/.test(t), t);
    ok('reload: the actions are there', ['Change time', 'Change manager', 'Book the 1-on-1', 'They backed out'].every(n => t.indexOf(n) >= 0), t);
    ok('reload: a long-finished flow is left to the Onboarding section', !(await f.ev(() => !!document.querySelector('[data-o271flow="602"]'))));
    ok('reload: a manager who has left keeps their name on the card', /Gone Fixture/.test(await f.ev(() => document.querySelector('[data-o271flow="603"]').innerText)));
    await click(f, '[data-o271flow="603"] [data-o271a="act"][data-kind="manager"]');
    ok('reload: a manager who has left is not offered', await f.ev(() => { const o = Array.from(document.querySelectorAll('[data-o271flow="603"] [data-o271i="member"] option')).map(x => x.textContent); return o.indexOf('Gone Fixture') < 0 && o.indexOf('Dana Fixture') >= 0; }));
    let s = await f.ev(sel => Array.from(document.querySelectorAll(sel + ' [data-o271a="retry"]')).map(x => x.getAttribute('data-step')), card(FLOW.started));
    ok('reload: Retry on a failed step and on a step cut off over ten minutes ago, not one running now', s.slice().sort().join() === 'invites,manager', s);
    s = await f.ev(() => window.__O271_FROM.filter(x => /hub_onboard|hub_candidates/.test(x.t)));
    ok('reload: never select *', s.length >= 3 && s.every(x => x.c && x.c.indexOf('*') < 0), s);
    allErrs.push(...f.errs); await f.close();
  }

  /* ---------- 3. a member on the HR profile, with a practice applicant ---------- */
  {
    const f = await fresh(b, { who: 'member', hash: '#hrcentre/onboarding', fixture: fx271(), rpcs: rpcs271(), init: INIT, wait: 5000 });
    await open(f);
    ok('HR member: Ready to onboard shows', await f.ev(() => { const e = document.getElementById('o271'); return !!e && e.offsetParent !== null; }));
    await click(f, card(FLOW.practice) + ' [data-o271a="open"]');
    await f.page.waitForSelector(card(FLOW.practice) + ' [data-o271skip]', { timeout: 4000 });
    let t = await f.ev(s2 => document.querySelector(s2).innerText, card(FLOW.practice));
    ok('practice: the same screens, with the label from warnings', /practice applicant/.test(t) && /simulation/.test(t), t.slice(0, 500));
    ok('practice: no manager means HR must choose, and Start stays off', /HR must choose/.test(t) && await f.page.isDisabled(card(FLOW.practice) + ' [data-o271a="start"]'), t.slice(0, 500));
    await f.page.selectOption(card(FLOW.practice) + ' [data-o271i="mgr"]', String(MGR.first));
    await fill(f, card(FLOW.practice) + ' [data-o271i="call"]', '2026-09-30T15:30');
    ok('practice: Start turns on when the manager is chosen', !(await f.page.isDisabled(card(FLOW.practice) + ' [data-o271a="start"]')));
    await click(f, card(FLOW.practice) + ' [data-o271a="start"]');
    await f.page.waitForSelector(card(FLOW.practice) + ' [data-o271a="retry"]', { timeout: 4000 });
    t = await f.ev(s2 => document.querySelector(s2).innerText, card(FLOW.practice));
    ok('practice: the started card still says practice', /Practice/.test(t), t.slice(0, 300));
    allErrs.push(...f.errs); await f.close();
  }

  /* ---------- 4. the people who must not see it ---------- */
  for (const who of ['plain', 'board']) {
    const f = await fresh(b, { who, hash: '#hrcentre/onboarding', fixture: fx271(), rpcs: rpcs271(), init: INIT, wait: 5000 });
    await f.ev(RECORD);
    await f.page.waitForTimeout(800);
    const s = await f.ev(() => ({ has: !!document.getElementById('o271'), rpc: window.__O271_RPC.filter(x => x.fn === 'wa271_ready_list').length, calls: window.__O271_CALLS.filter(c => c.name === 'onboard-run').length }));
    ok(who + ': no Ready to onboard, nothing asked for', !s.has && s.rpc === 0 && s.calls === 0, s);
    allErrs.push(...f.errs); await f.close();
  }
  /* a leader opens the HR centre, and the database says no: the section stays away */
  {
    const f = await fresh(b, { who: 'admin', hash: '#hrcentre/overview', fixture: fx271(), rpcs: rpcs271(), init: INIT, wait: 5000 });
    await f.ev(() => { const r0 = db.rpc.bind(db); db.rpc = function (fn, a) { if (fn === 'wa271_ready_list') return Promise.resolve({ data: null, error: { message: 'Only HR can see the onboarding list' } }); return r0(fn, a); }; });
    await open(f);
    ok('the database refuses: the section is not shown', await f.ev(() => { const e = document.getElementById('o271'); return !e || e.offsetParent === null; }));
    allErrs.push(...f.errs); await f.close();
  }

  /* ---------- 5. the lead's card before day one ---------- */
  {
    const person = o => Object.assign({ onboarding_id: 40, member_id: 36, name: 'New Person', department: 'hr', title: 'Driver', via: 'manager', started_at: '2026-10-05', day: 1, done: 0, total: 3, sections: [], late_count: 0, late: [], next: null, last_done_at: null, steps: [], quizzes_done: 0, lead_steps: [], help: [], academy: [] }, o);
    let f = await fresh(b, { who: 'leader', hash: '#mypage', fixture: fx271(), rpcs: rpcs271({ extra: { onboarding_lead_view: { people: [person({ starts_on: '2026-10-05' })] } } }), wait: 5000 });
    let t = await f.ev(() => (document.getElementById('w166lead') || {}).innerText || '');
    ok('lead: before the date the card says Starts on', /Starts on Oct 5/.test(t) && !/Day 1\b/.test(t), t);
    await shot(f, 'lead_starts_on', false);
    allErrs.push(...f.errs); await f.close();
    f = await fresh(b, { who: 'leader', hash: '#mypage', fixture: fx271(), rpcs: rpcs271({ extra: { onboarding_lead_view: { people: [person({ started_at: '2026-09-20', day: 6 })] } } }), wait: 5000 });
    t = await f.ev(() => (document.getElementById('w166lead') || {}).innerText || '');
    ok('lead: after the date it says Day N as before', /Day 6/.test(t) && !/Starts on/.test(t), t);
    allErrs.push(...f.errs); await f.close();
  }

  /* ---------- 6. phone width ---------- */
  {
    const f = await fresh(b, { who: 'admin', width: 390, hash: '#hrcentre/onboarding', fixture: fx271({ started: true }), rpcs: rpcs271(), init: INIT, wait: 5000 });
    await open(f);
    ok('390: the list has no sideways scroll', !(await hasScroll(f)), await f.ev(() => document.documentElement.scrollWidth));
    await shot(f, 'phone_ready_390');
    await f.ev(s => document.querySelector(s).click(), card(FLOW.real) + ' [data-o271a="open"]');
    await f.page.waitForSelector(cellOf(FLOW.real, AT(9)), { state: 'attached', timeout: 4000 });
    await f.page.waitForTimeout(300);
    ok('390: the picker has no sideways scroll', !(await hasScroll(f)), await f.ev(() => document.documentElement.scrollWidth));
    const s = await f.ev(sel => { const w = document.querySelector(sel + ' .o271gw'); return { sw: w.scrollWidth, cw: w.clientWidth, cell: document.querySelector(sel + ' .o271c').getBoundingClientRect().height }; }, card(FLOW.real));
    ok('390: the grid scrolls inside its own box', s.sw > s.cw, s);
    await shot(f, 'phone_picker_390');
    await f.ev(s2 => document.querySelector(s2).click(), card(FLOW.started) + ' [data-o271a="act"][data-kind="back"]');
    await f.page.waitForTimeout(300);
    ok('390: a started card has no sideways scroll', !(await hasScroll(f)), await f.ev(() => document.documentElement.scrollWidth));
    await f.ev(s2 => document.querySelector(s2).scrollIntoView(), card(FLOW.started));
    await f.page.waitForTimeout(200);
    await shot(f, 'phone_started_390');
    allErrs.push(...f.errs); await f.close();
  }

  /* ---------- 7. wave275 Task 4: the first password (admins only), and the welcome once the Hub has sent it ---------- */
  {
    const PW = 'Harbour-Lantern-48';   // made up for this test: it must never be in the page's HTML or text
    const htmlHas = (f, x) => f.ev(v => document.documentElement.outerHTML.indexOf(v) >= 0 || document.body.innerText.indexOf(v) >= 0, x);
    const fx = fx271({ started: true });
    fx.hub_onboard_steps.forEach(r => { if (r.step === 'welcome') { r.status = 'done'; r.detail = 'Sent the welcome email to sam@example.invalid from hub@welfareavenue.com.'; } });
    fx.hub_onboard_flows[0].welcome_sent_at = '2026-09-25T19:30:00Z';
    const f = await fresh(b, { who: 'admin', hash: '#hrcentre/onboarding', fixture: fx, rpcs: rpcs271(), init: INIT, wait: 5000 });
    await open(f, '#hrcentre/overview'); await open(f);
    let s = await f.ev(() => { const e = document.querySelector('[data-o271pwstate]'), i = document.querySelector('[data-o271i="pw"]'); return { line: e && e.innerText, type: i && i.type, value: i && i.getAttribute('value') }; });
    ok('PW: an admin sees "First password: not set" and a password box with no value in it', s.line === 'First password: not set' && s.type === 'password' && s.value === null, s);
    ok('PW: the state comes from first_password_state', (await calls(f, 'first_password_state')).length >= 1);
    await fill(f, '[data-o271i="pw"]', PW);
    await f.ev(() => window.o271.load());
    await f.page.waitForTimeout(300);
    ok('PW: what is typed survives a repaint, and is never in the page', (await f.page.inputValue('[data-o271i="pw"]')) === PW && !(await htmlHas(f, PW)));
    await click(f, '[data-o271a="pwset"]');
    const c = await calls(f, 'set_first_password');
    ok('PW: Set sends it once, to set_first_password', c.length === 1 && c[0].body.password === PW, c.length);
    s = await f.ev(() => document.querySelector('[data-o271pwstate]').innerText);
    ok('PW: the line says "set on" the date, and the box is empty again', s === 'First password: set on September 25, 2026' && (await f.page.inputValue('[data-o271i="pw"]')) === '', s);
    ok('PW: the password is nowhere in the page after Set', !(await htmlHas(f, PW)));
    await fill(f, '[data-o271i="pw"]', 'short1a');
    await click(f, '[data-o271a="pwset"]');
    s = await f.ev(() => document.querySelector('[data-o271pw]').innerText);
    ok('PW: a refusal shows its plain sentence, without the value', /needs at least 8 characters/.test(s) && !(await htmlHas(f, 'short1a')), s);
    const t = await f.ev(s2 => document.querySelector(s2).innerText, card(FLOW.started));
    ok('SENT: a welcome the Hub sent shows when it went and keeps a copy, [first password] as it is, with Copy', /Sent .*Sep.*25/.test(t) && /First password: \[first password\]/.test(t) && /stays as it is here/.test(t) && await f.page.isVisible(card(FLOW.started) + ' [data-o271a="copywelcome"]'), t);
    ok('SENT: no Done and no Canva box under a welcome that went', !(await f.ev(s2 => !!document.querySelector(s2 + ' [data-o271a="taskdone"][data-step="welcome"]') || !!document.querySelector(s2 + ' [data-o271canva]'), card(FLOW.started))));
    await shot(f, 'pw_admin_1366');
    allErrs.push(...f.errs); await f.close();
  }
  {
    const f = await fresh(b, { who: 'member', hash: '#hrcentre/onboarding', fixture: fx271(), rpcs: rpcs271(), init: INIT, wait: 5000 });
    await open(f);
    ok('PW: HR who are not admins see no first password, and the state is not asked for', !(await f.ev(() => !!document.querySelector('[data-o271pw]'))) && (await calls(f, 'first_password_state')).length === 0);
    allErrs.push(...f.errs); await f.close();
  }

  ok('no page errors anywhere', allErrs.length === 0, allErrs);
  console.log('\nw271drive: ' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
