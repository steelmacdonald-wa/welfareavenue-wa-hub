/* w275drive.js: wave275 Task 6, the card for HR and the manager. Offline against the candidate (CAND=<file>.html), with test/boot.js (stubbed Supabase,
   clock 25/09/26 16:00 Toronto), test/w271fx.js and test/w275fx.js (stand-ins for onboard-run; every network call is stubbed or blocked). The browser runs in
   Pacific/Auckland, so only Intl with America/Toronto gives the right labels and instants.
   Identities: admin and a member on the HR profile (every card, in HR Center > Onboarding), a plain member who manages two hires (Joy: only her own cards,
   on Home and on her team page, Review Focus 4), a leader who manages nobody, and a board viewer; 390 px. SHOTS=<dir> saves screenshots. */
const fs = require('fs');
const { chromium } = require('playwright');
const { fresh } = require('./boot');
const { fx275, rpcs275, INIT, INIT275, NOT_HR, F, MGR, AT } = require('./w275fx');
const { FLOW } = require('./w271fx');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, info) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (info !== undefined ? '  ' + JSON.stringify(info).slice(0, 700) : '')); } }
const shot = async (f, n, full) => { if (SHOTS) await f.page.screenshot({ path: SHOTS + '/' + n + '.png', fullPage: full !== false }); };
async function launch() {
  const args = ['--disable-gpu'];
  let last;
  for (const t of [{ args }, { channel: 'chrome', args }, { channel: 'msedge', args }]) { try { return await chromium.launch(t); } catch (e) { last = e; } }
  throw last;
}
const init = INIT + '\n' + INIT275;
const open = (f, h) => f.hash(h || '#hrcentre/onboarding', 1500);
const card = (id) => '[data-o271flow="' + id + '"]';
const txtOf = (f, sel) => f.ev((s) => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const calls = (f, action) => f.ev((a) => window.__O271_CALLS.filter((c) => c.name === 'onboard-run' && c.body.action === a), action);
const allCalls = (f) => f.ev(() => window.__O271_CALLS.filter((c) => c.name === 'onboard-run').map((c) => c.body.action));
const click = async (f, sel) => { await f.page.click(sel); await f.page.waitForTimeout(400); };
const press = async (f, sel) => { await f.ev((s) => document.querySelector(s).click(), sel); await f.page.waitForTimeout(400); };   // a click that a sticky header cannot catch
const fill = async (f, sel, v) => { await f.page.fill(sel, v); await f.page.waitForTimeout(80); };
const has = (f, sel) => f.ev((s) => !!document.querySelector(s), sel);
const cls = (f, sel) => f.ev((s) => { const e = document.querySelector(s); return e ? e.className : null; }, sel);
const hasScroll = (f) => f.ev(() => document.documentElement.scrollWidth > window.innerWidth + 1);
const consoleErrs = (f) => { const out = []; f.page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) out.push(m.text().slice(0, 240)); }); return out; };
const RECORD = () => { window.__O275_RPC = []; const r0 = db.rpc.bind(db); db.rpc = function (fn, a) { window.__O275_RPC.push(fn); return r0(fn, a); }; };
const rpcsCalled = (f) => f.ev(() => window.__O275_RPC || []);
const cell = (id, iso) => card(id) + ' [data-o271cell="' + iso + '"]';
const noDashNoAI = (t) => !/\u2014/.test(t) && !/\bAI\b/.test(t);

(async () => {
  const b = await launch();
  const allErrs = [], allCons = [];
  const go = async (o) => {
    const f = await fresh({ newContext: (x) => b.newContext(Object.assign({ timezoneId: 'Pacific/Auckland' }, x)) }, Object.assign({ fixture: fx275(), init, wait: 5000 }, o));
    f.cons = consoleErrs(f);
    return f;
  };
  const done = async (f) => { allErrs.push(...f.errs); allCons.push(...f.cons); await f.close(); };

  /* ---------- 1. an admin: every card on the new path, in HR Center > Onboarding ---------- */
  {
    const f = await go({ who: 'admin', hash: '#hrcentre/onboarding', rpcs: rpcs275() });
    await open(f, '#hrcentre/overview'); await open(f);
    ok('admin: the four cards on the new path show, with the wave271 cards', await has(f, card(F.said)) && await has(f, card(F.offered)) && await has(f, card(F.proposed)) && await has(f, card(F.moved)) && await has(f, card(FLOW.real)));
    ok('admin: a wave271 card keeps its own buttons', /Choose times and preview/.test(await txtOf(f, card(FLOW.real))));
    ok('admin: an offered flow is a card, not also an offer waiting for an answer', !(await has(f, '[data-o271offer="7302"]')));
    let t = await txtOf(f, card(F.offered) + ' [data-o275state]');
    ok('offered: "Offer sent 20 Sep, 6 hours a week; waiting for the manager\'s times"', t === 'Offer sent 20 Sep, 6 hours a week; waiting for the manager\'s times', t);
    t = await txtOf(f, card(F.proposed) + ' [data-o275state]');
    ok('proposed: "Proposed by Samson Jules: Wed 30 Sep 10 am and Thu 1 Oct 10 am; waiting for Nia"', /^Proposed by Samson Jules: Wed 30 Sep 10 am and Thu 1 Oct 10 am; waiting for Nia$/.test(t.split('\n').pop()), t);
    t = await txtOf(f, card(F.said) + ' [data-o275state]');
    ok('said no: "James said no to the times", and the grid is theirs to book from', /James said no to the times/.test(t) && /their times are on their grid/.test(t), t);
    t = await txtOf(f, card(F.moved) + ' [data-o275state]');
    ok('a stale Yes: "the times moved; Kim is marking their availability" (not "said no")', /The times moved; Kim is marking their availability/.test(t) && !/said no/.test(t), t);
    t = await txtOf(f, card(F.said));
    ok('accepted: the hours confirmed, the manager, the steps with their results and reasons', /Accepted 21 Sep, 6 hours a week confirmed/.test(t) && /Manager: Joy Dumansi/.test(t) && /The first password is not set in admin settings/.test(t) && /Roster profile/.test(t), t.slice(0, 900));
    ok('the rundown: "1 of 9 setup steps done" (only rd_ ticks count)', /1 of 9 setup steps done/.test(await txtOf(f, card(F.said) + ' [data-o275ticks]')));
    ok('the name is escaped', await f.ev((s) => !document.querySelector(s + ' b b') && /<b>Hire<\/b>/.test(document.querySelector(s).textContent), card(F.said)));
    t = await txtOf(f, card(F.offered) + ' [data-o275mgr]');
    ok('no week saved: the card says the manager has not set their week on Home', /has not set their week on the Hub's Home page yet/.test(t) && /Monday to Friday, 9 to 5/.test(t), t);
    ok('the switch shows "ask the hire" on', /\bon\b/.test(await cls(f, card(F.said) + ' [data-o275a="ask"][data-on="1"]')));
    ok('the started card on the new path shows the rundown: 3 of 9 (the Hub\'s own ticks do not count)', /3 of 9 setup steps done/.test(await txtOf(f, card(F.started) + ' [data-o275ticks]')));
    ok('admin: the first password field is still there', await has(f, '[data-o271pw]'));
    await shot(f, 'w275-admin-cards-1366');

    /* propose from the card: the manager's week over the window, hub@ meetings greyed */
    await click(f, card(F.offered) + ' [data-o275a="open"][data-kind="propose"]');
    await f.page.waitForSelector(cell(F.offered, AT(10)), { timeout: 4000 });
    let c = await calls(f, 'times');
    ok('Propose times reads the picker\'s data through times (not preview)', c.length === 1 && c[0].body.flow_id === F.offered && (await calls(f, 'preview')).length === 0, c);
    ok('the picker: the manager\'s hours are shaded in the call pick, the hub@ meeting is greyed and named', /\bm\b/.test(await cls(f, cell(F.offered, AT(10)))) && !/\bm\b/.test(await cls(f, cell(F.offered, AT(8)))) && /\bbusy\b/.test(await cls(f, cell(F.offered, AT(13)))) && (await f.ev((s) => document.querySelector(s).title, cell(F.offered, AT(13)))).indexOf('Team <i>sync</i>') >= 0);
    ok('the picker: another new hire\'s time and a time too soon are greyed', /\bbusy\b/.test(await cls(f, cell(F.offered, AT(15)))) && /\bbusy\b/.test(await cls(f, cell(F.offered, new Date(Date.UTC(2026, 8, 26, 14)).toISOString()))));
    await press(f, cell(F.offered, AT(10)));
    ok('a cell fills the call time, read in Toronto', await f.page.inputValue(card(F.offered) + ' [data-o275i="call"]') === '2026-09-28T10:00' && /Mon.*Sep.*28.*10:00/.test(await txtOf(f, card(F.offered) + ' [data-o275said="call"]')));
    await press(f, card(F.offered) + ' [data-o275a="mode"][data-mode="one"]');
    await press(f, cell(F.offered, AT(11, 30)));
    ok('the 1-on-1 pick', await f.page.inputValue(card(F.offered) + ' [data-o275i="one"]') === '2026-09-28T11:30');
    await shot(f, 'w275-propose-1366');
    await press(f, card(F.offered) + ' [data-o275a="go"]');
    c = await calls(f, 'propose');
    ok('Propose these times calls propose with both instants', c.length === 1 && c[0].body.flow_id === F.offered && c[0].body.call_at === AT(10) && c[0].body.one_on_one_at === AT(11, 30), c);
    t = await txtOf(f, card(F.offered));
    ok('after it: the card says it was proposed, and by whom', /The times are proposed/.test(t) && /Proposed by Steel: Mon 28 Sep 10 am and Mon 28 Sep 11:30 am; waiting for Lina to accept the offer/.test(t), t.slice(0, 900));

    /* already communicated: the switch, then HR enters the hire's times */
    await press(f, card(F.said) + ' [data-o275a="ask"][data-on="0"]');
    c = await calls(f, 'set_ask_availability');
    ok('the switch calls set_ask_availability off', c.length === 1 && c[0].body.flow_id === F.said && c[0].body.on === false, c);
    ok('the switch now shows already communicated', /\bon\b/.test(await cls(f, card(F.said) + ' [data-o275a="ask"][data-on="0"]')) && /already communicated/.test(await txtOf(f, card(F.said) + ' [data-o275state]')));
    await press(f, card(F.said) + ' [data-o275a="open"][data-kind="gridfor"]');
    await f.page.waitForSelector(card(F.said) + ' [data-o275cell="' + AT(10) + '"]', { timeout: 4000 });
    ok('Enter their availability: the hire\'s marks so far are on', /\bon\b/.test(await cls(f, card(F.said) + ' [data-o275cell="' + AT(10) + '"]')));
    await press(f, card(F.said) + ' [data-o275cell="' + AT(14) + '"]');
    await press(f, card(F.said) + ' [data-o275cell="' + AT(10) + '"]');
    await press(f, card(F.said) + ' [data-o275a="go"]');
    c = await calls(f, 'grid_for');
    ok('Save their times calls grid_for for the hire, with what is marked (one cell is fine: no 10-hour minimum for HR)', c.length === 1 && c[0].body.who === 'hire' && c[0].body.slots.indexOf(AT(14)) >= 0 && c[0].body.slots.indexOf(AT(10)) < 0 && c[0].body.slots.length === 5, c);

    /* book from the hire's grid */
    await press(f, card(F.said) + ' [data-o275a="open"][data-kind="bookg"]');
    await f.page.waitForSelector(cell(F.said, AT(14)), { timeout: 4000 });
    ok('Book: the hire\'s times are marked over the manager\'s hours', /\bh\b/.test(await cls(f, cell(F.said, AT(14)))) && /\bm\b/.test(await cls(f, cell(F.said, AT(14)))));
    await press(f, cell(F.said, AT(14)));
    await press(f, card(F.said) + ' [data-o275a="mode"][data-mode="one"]');
    await press(f, cell(F.said, AT(11)));
    await press(f, card(F.said) + ' [data-o275a="go"]');
    c = await calls(f, 'book');
    ok('Book these times calls book with both instants', c.length === 1 && c[0].body.flow_id === F.said && c[0].body.call_at === AT(14) && c[0].body.one_on_one_at === AT(11), c);
    ok('after booking the card leaves the list of cards to answer', !(await has(f, '[data-o271flow="' + F.said + '"] [data-o275state]')));

    /* the manager's exceptions, set by HR */
    await press(f, card(F.offered) + ' [data-o275a="open"][data-kind="exc"]');
    await f.page.waitForSelector(card(F.offered) + ' [data-o275x="adddate"]', { timeout: 4000 });
    await press(f, card(F.offered) + ' [data-o275x="adddate"]');
    await fill(f, card(F.offered) + ' [data-o275xi="date"][data-x="0"]', '2026-09-30');
    await press(f, card(F.offered) + ' [data-o275x="adddate"]');
    await fill(f, card(F.offered) + ' [data-o275xi="date"][data-x="1"]', '2026-10-01');
    await press(f, card(F.offered) + ' [data-o275x="addblk"][data-x="1"]');
    await fill(f, card(F.offered) + ' [data-o275xi="from"][data-x="1"][data-b="0"]', '13:00');
    await fill(f, card(F.offered) + ' [data-o275xi="to"][data-x="1"][data-b="0"]', '15:30');
    await shot(f, 'w275-exceptions-1366');
    await press(f, card(F.offered) + ' [data-o275a="go"]');
    c = await calls(f, 'availability_for');
    ok('Set Dana\'s exceptions calls availability_for with the dates, and no week', c.length === 1 && c[0].body.member_id === MGR.first && JSON.stringify(c[0].body.except) === JSON.stringify([{ date: '2026-09-30', free: [] }, { date: '2026-10-01', free: [['13:00', '15:30']] }]) && !('weekly' in c[0].body), c);
    ok('the panel names the manager', /Dana/.test(await txtOf(f, card(F.offered))));

    /* the welcome editor, before booking */
    await press(f, card(F.offered) + ' [data-o275a="open"][data-kind="welcome"]');
    await f.page.waitForSelector(card(F.offered) + ' [data-o275i="wtext"]', { timeout: 4000 });
    ok('the editor opens on the email as it reads now, brackets kept', /\[first password\]/.test(await f.page.inputValue(card(F.offered) + ' [data-o275i="wtext"]')) && /square brackets/.test(await txtOf(f, card(F.offered))));
    await fill(f, card(F.offered) + ' [data-o275i="wtext"]', 'Dear Lina,\n\nA warm welcome. Your first day is [first day: fills in at Start].\n   First password: [first password]');
    await press(f, card(F.offered) + ' [data-o275a="go"]');
    c = await calls(f, 'set_welcome');
    ok('Save the email calls set_welcome with the text as typed', c.length === 1 && c[0].body.flow_id === F.offered && /A warm welcome/.test(c[0].body.text) && /\[first password\]/.test(c[0].body.text) && c[0].body.subject === 'Welcome to Welfare Avenue! Your Next Steps', c);
    ok('it says it is saved', /The welcome email is saved/.test(await txtOf(f, card(F.offered))));

    /* change the manager of an offered flow, and ask the new one */
    await press(f, card(F.proposed) + ' [data-o275a="open"][data-kind="mgr"]');
    await f.page.selectOption(card(F.proposed) + ' [data-o275i="member"]', String(MGR.second));
    await press(f, card(F.proposed) + ' [data-o275a="go"]');
    ok('Change manager on a card before booking: set_manager, then the new manager is asked for times', (await calls(f, 'set_manager')).some((x) => x.body.flow_id === F.proposed && x.body.member_id === MGR.second) && (await calls(f, 'ask_manager')).some((x) => x.body.flow_id === F.proposed));

    t = await f.ev(() => document.getElementById('o271').innerText);
    ok('Hub words in the section: no em dash, no "AI"', noDashNoAI(t));
    ok('admin: no sideways scroll at 1366', !(await hasScroll(f)));
    ok('admin: no console errors', f.cons.length === 0, f.cons);
    await done(f);
  }

  /* ---------- 2. a member on the HR profile: the same cards, and their own hire on Home as a short line ---------- */
  {
    const f = await go({ who: 'member', hash: '#hrcentre/onboarding', rpcs: rpcs275({ mine: ['proposed'] }) });
    await open(f);
    ok('HR member: the cards on the new path show', await has(f, card(F.offered)) && await has(f, card(F.said)));
    ok('HR member: Set the manager\'s exceptions is HR\'s, so it is offered', await has(f, card(F.offered) + ' [data-o275a="open"][data-kind="exc"]'));
    await open(f, '#mypage');
    await f.page.waitForTimeout(800);
    const t = await txtOf(f, '#o275mine');
    ok('HR member on Home: "Your new hires" lists their own hire with a link to Onboarding, not a second card', /Your new hires/.test(t) && /Nia Proposed/.test(t) && await has(f, '#o275mine a[href="#hrcentre/onboarding"]') && !(await has(f, '#o275mine [data-o271flow]')), t);
    ok('HR member: no console errors', f.cons.length === 0, f.cons);
    await done(f);
  }

  /* ---------- 3. a plain member who manages two hires: only her own cards, on Home and her team page ---------- */
  {
    const f = await go({ who: 'plain', hash: '#mypage', rpcs: rpcs275({ mine: ['said', 'started', 'old'] }), init: init + '\n' + NOT_HR });
    await f.ev(RECORD);
    await open(f, '#mypage');
    await f.page.waitForTimeout(1200);
    let t = await txtOf(f, '#o275mine');
    ok('Joy on Home: "Your new hires" with her two hires', /Your new hires/.test(t) && /James/.test(t) && /Ola Started/.test(t), t.slice(0, 500));
    ok('Joy: no other card (Review Focus 4)', !(await has(f, card(F.offered))) && !(await has(f, card(F.proposed))) && !(await has(f, card(F.moved))) && !(await has(f, card(FLOW.real))));
    await f.ev(() => window.o271.load());   // a reload, recorded (the first load ran before the recorder)
    await f.page.waitForTimeout(400);
    let rp = await rpcsCalled(f);
    ok('Joy: the database refused her HR\'s list (Only HR), so her cards come from wa275_my_cards', await f.ev(() => window.o275.state().hrList) === false && rp.indexOf('wa275_my_cards') >= 0, rp);
    t = await txtOf(f, card(F.old));
    ok('Joy: a wave271 hire\'s card keeps HR\'s own buttons off (no availability link, no preview), and They backed out stays', /Wren Earlier/.test(t) && !(await has(f, card(F.old) + ' [data-o271a="link"]')) && !(await has(f, card(F.old) + ' [data-o271a="open"]')) && await has(f, card(F.old) + ' [data-o271a="act"][data-kind="back"]'), t);
    ok('Joy: no Set exceptions and no Change manager before booking (HR\'s)', !(await has(f, card(F.said) + ' [data-o275a="open"][data-kind="exc"]')) && !(await has(f, card(F.said) + ' [data-o275a="open"][data-kind="mgr"]')));
    ok('Joy: the started card with its rundown, 3 of 9', /3 of 9 setup steps done/.test(await txtOf(f, card(F.started) + ' [data-o275ticks]')));
    ok('Joy: no first password field', !(await has(f, '[data-o271pw]')));
    ok('Joy: the Google step says what HR does, without the HR button I created it, continue', /The first password is not set/.test(await txtOf(f, card(F.said))) && !(await has(f, card(F.said) + ' [data-o271a="gmanual"]')));
    await shot(f, 'w275-joy-home-1366');
    /* she books from her hire's grid */
    await press(f, card(F.said) + ' [data-o275a="open"][data-kind="bookg"]');
    await f.page.waitForSelector(cell(F.said, AT(10)), { timeout: 4000 });
    await press(f, cell(F.said, AT(10)));
    await press(f, card(F.said) + ' [data-o275a="mode"][data-mode="one"]');
    await press(f, cell(F.said, AT(12)));
    await press(f, card(F.said) + ' [data-o275a="go"]');
    let c = await calls(f, 'book');
    ok('Joy books from the card', c.length === 1 && c[0].body.flow_id === F.said && c[0].body.call_at === AT(10) && c[0].body.one_on_one_at === AT(12), c);
    /* and changes a time on the started one */
    await press(f, card(F.started) + ' [data-o271a="act"][data-kind="time"]');
    await f.page.waitForTimeout(500);
    ok('Change time opens without HR\'s preview (the picker reads times)', (await calls(f, 'preview')).length === 0 && (await calls(f, 'times')).some((x) => x.body.flow_id === F.started) && !/Only HR/.test(await txtOf(f, card(F.started))));
    await fill(f, card(F.started) + ' [data-o271i="at"]', '2026-09-30T10:00');
    await press(f, card(F.started) + ' [data-o271a="actgo"]');
    c = await calls(f, 'change_time');
    ok('Joy changes the call time', c.length === 1 && c[0].body.flow_id === F.started && c[0].body.which === 'call', c);
    ok('Joy: only card actions were called', (await allCalls(f)).every((a) => ['times', 'book', 'welcome', 'change_time', 'retry', 'set_ask_availability', 'grid_for', 'set_welcome', 'propose'].indexOf(a) >= 0), await allCalls(f));
    /* her team page */
    await open(f, '#team/marketing');
    await f.page.waitForTimeout(1500);
    ok('Joy\'s team page shows "Your new hires" too', /Your new hires/.test(await txtOf(f, '#w116host')) && await has(f, '#w116host #o275mine'));
    ok('one copy of her cards in the page', await f.ev((s) => document.querySelectorAll(s).length, card(F.started)) === 1);
    ok('Joy: no console errors', f.cons.length === 0, f.cons);
    await done(f);
  }

  /* ---------- 4. a leader who manages nobody, and a board viewer: nothing ---------- */
  for (const who of ['leader', 'board']) {
    const f = await go({ who, hash: '#mypage', rpcs: rpcs275(), init: init + '\n' + NOT_HR });
    await open(f, '#mypage');
    await f.page.waitForTimeout(800);
    ok(who + ': no "Your new hires", no card, nothing asked of onboard-run', !(await has(f, '#o275mine')) && !(await has(f, '[data-o271flow]')) && (await allCalls(f)).length === 0, await allCalls(f));
    ok(who + ': no console errors', f.cons.length === 0, f.cons);
    await done(f);
  }

  /* ---------- 4b. review fix: the database, not the menu profile, decides who gets HR's list ----------
     A leader is not on the hr profile (surelyHr() is false for them). In the fixture the leader cannot open HR Center > Onboarding (that page follows the
     role's tabs), so this is checked on the loader itself, on the page: with the database giving them HR's list (as wa_is_hr does for someone in
     wa_hr_access) the loader keeps it; with the database refusing it, they get their own hires. */
  {
    const f = await go({ who: 'leader', hash: '#mypage', rpcs: rpcs275({ mine: ['proposed'] }) });
    await open(f, '#mypage');
    await f.page.waitForTimeout(800);
    await f.ev(() => window.o271.load());
    await f.page.waitForTimeout(500);
    const s = await f.ev(() => { const S = window.o275.state(); return { hrList: S.hrList, mine: !!S.mine, denied: S.denied, ready: S.ready.map((x) => x.flow_id), profileHr: window.o271.surelyHr() }; });
    ok("a leader the database gives HR's list to (wa_hr_access, not the hr profile) keeps HR's whole list, as before wave275", s.profileHr === false && s.hrList === true && !s.mine && !s.denied && [F.said, F.offered, F.proposed, F.moved, FLOW.real].every((id) => s.ready.indexOf(id) >= 0), s);
    ok('on Home they see their own hire as a short line, not a second card', /Nia Proposed/.test(await txtOf(f, '#o275mine')) && !(await has(f, '#o275mine [data-o271flow]')));
    ok('wa_hr_access leader: no console errors', f.cons.length === 0, f.cons);
    await done(f);
  }
  {
    const f = await go({ who: 'leader', hash: '#mypage', rpcs: rpcs275({ mine: ['proposed'] }), init: init + '\n' + NOT_HR });
    await open(f, '#mypage');
    await f.page.waitForTimeout(800);
    await f.ev(() => window.o271.load());
    await f.page.waitForTimeout(500);
    const s = await f.ev(() => { const S = window.o275.state(); return { hrList: S.hrList, mine: !!S.mine, ready: S.ready.map((x) => x.flow_id) }; });
    ok("the same leader refused HR's list (Only HR) gets their own hire only, as a card", s.hrList === false && s.mine && s.ready.length === 1 && s.ready[0] === F.proposed && await has(f, '#o275mine ' + card(F.proposed)), s);
    await done(f);
  }

  /* ---------- 5. 390 px ---------- */
  {
    const f = await go({ who: 'plain', width: 390, hash: '#mypage', rpcs: rpcs275({ mine: ['said', 'started'] }), init: init + '\n' + NOT_HR });
    await open(f, '#mypage');
    await f.page.waitForTimeout(1200);
    ok('390, Joy on Home: no sideways scroll', !(await hasScroll(f)), await f.ev(() => document.documentElement.scrollWidth));
    await press(f, card(F.said) + ' [data-o275a="open"][data-kind="bookg"]');
    await f.page.waitForSelector(cell(F.said, AT(10)), { state: 'attached', timeout: 4000 });
    await f.page.waitForTimeout(300);
    ok('390: the picker has no sideways scroll; its grid scrolls in its own box', !(await hasScroll(f)) && await f.ev((s) => { const w = document.querySelector(s + ' .o271gw'); return w.scrollWidth > w.clientWidth; }, card(F.said)));
    await f.ev((s) => document.querySelector(s).scrollIntoView(), card(F.said));
    await shot(f, 'w275-joy-book-390', false);
    await done(f);
  }
  {
    const f = await go({ who: 'admin', width: 390, hash: '#hrcentre/onboarding', rpcs: rpcs275() });
    await open(f);
    ok('390, admin: the cards have no sideways scroll', !(await hasScroll(f)), await f.ev(() => document.documentElement.scrollWidth));
    await press(f, card(F.offered) + ' [data-o275a="open"][data-kind="exc"]');
    await press(f, card(F.offered) + ' [data-o275x="adddate"]');
    await press(f, card(F.offered) + ' [data-o275x="addblk"][data-x="0"]');
    ok('390: the exceptions editor fits', !(await hasScroll(f)));
    await press(f, card(F.offered) + ' [data-o275a="cancel"]');
    await press(f, card(F.offered) + ' [data-o275a="open"][data-kind="welcome"]');
    await f.page.waitForTimeout(300);
    ok('390: the welcome editor fits', !(await hasScroll(f)));
    await f.ev((s) => document.querySelector(s).scrollIntoView(), card(F.offered));
    await shot(f, 'w275-admin-390', false);
    await done(f);
  }

  ok('no page errors anywhere', allErrs.length === 0, allErrs);
  ok('no console errors anywhere', allCons.length === 0, allCons);
  console.log('\nw275drive: ' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

