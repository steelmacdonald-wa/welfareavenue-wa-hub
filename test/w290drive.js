/* w290drive.js: wave290, Your servings this year on Home, offline against the candidate (CAND=build/<file>.html).
   The card shows what wa290_home_servings says: the kicker with the end of the fiscal year, how many of the four, the bar, how
   many more, the next servings (the ones they are on say so and cannot be unticked; a partner shows), Serve or Take photos;
   nothing ticked is caught before anything is sent; Confirm sends the servings and the role to wa290_home_signup and says who
   has the dates; a server error says what happened and keeps the choice; the thank-you at four of four (no list, no button);
   no card when the database says no, when the call fails, or for a director; nothing open and on every open serving say so.
   Where: right after the Next serving card and before My tasks, full width on a computer, one column on a phone with nothing
   scrolling sideways. Keyboard: the roles move with the arrow keys; the error and the confirmation take the focus. No page errors.
   On this machine: WA_CHROME=<chromium path> CAND=build/candidate.html node test/w290drive.js (SHOTS=<dir> for pictures). */
const { launch, fresh, loadFixture } = require('./boot');
const fs = require('fs');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 700) : '')); } }

const SV = [
  { id: 900, code: 'WA-26-21', date: '2026-10-04', start: '12:00', title: 'Sunday serving', location: 'Place Émilie-Gamelin', partner: null, mine: null },
  { id: 901, code: 'WA-26-22', date: '2026-10-11', start: '12:00', title: 'Sunday serving', location: 'Place Émilie-Gamelin', partner: null, mine: { status: 'Confirmed', role: 'server', confirmed: true } },
  { id: 902, code: 'WA-26-23', date: '2026-10-18', start: '12:00', title: 'Sunday serving', location: 'Place Émilie-Gamelin', partner: 'Oberoi Financial Group', mine: null }
];
const base = (o) => Object.assign({ show: true, state: 'todo', show_from: '2025-11-15', me: { name: 'Steel', department: 'exec' }, ops: { name: 'Ahmed', title: 'Operations Lead, Montreal' },
  year: { from: '2025-10-01', to: '2026-09-30', done: 1, target: 4 }, servings: SV }, o || {});
const TODO = base();
const AFTER = base({ year: { from: '2025-10-01', to: '2026-09-30', done: 3, target: 4 }, servings: SV.map(s => s.id === 901 ? s : Object.assign({}, s, { mine: { status: 'Confirmed', role: 'photographer', confirmed: true } })) });
const THANKS = base({ state: 'thanks', until: '2026-10-02T12:00:00Z', year: { from: '2025-10-01', to: '2026-09-30', done: 4, target: 4 } });
const SIGNUP = { ok: true, dates: 'Sunday, October 4; Sunday, October 18', ops: 'Ahmed', request: 88, step: false };
const rpcs = (servings) => ({ wa_org_editor: true, is_wa_admin: true, is_wa_staff: true, wa290_home_servings: servings, wa290_home_signup: SIGNUP });

const record = f => f.ev(() => { window.__calls = []; const r0 = db.rpc.bind(db); db.rpc = function (fn, a) { window.__calls.push({ fn: fn, a: JSON.parse(JSON.stringify(a || {})) }); if (window.__fail && window.__fail[fn]) return Promise.resolve({ data: null, error: { message: window.__fail[fn] } }); return r0(fn, a); }; });
const calls = (f, fn) => f.ev(fn => (window.__calls || []).filter(c => c.fn === fn), fn);
const card = f => f.ev(() => {
  const el = document.getElementById('w290srv'); if (!el) return null;
  const r = el.getBoundingClientRect(), nx = document.getElementById('w171next'), body = document.getElementById('mpBody');
  const tasks = body && (body.querySelector(':scope > .mp-grid') || body.querySelector(':scope > #w74attn'));
  const bar = el.querySelector('.bar');
  return {
    txt: el.innerText.replace(/\s+/g, ' ').trim(), k: (el.querySelector('.k') || {}).textContent, h: (el.querySelector('h3') || {}).textContent,
    bar: bar ? { now: bar.getAttribute('aria-valuenow'), w: (bar.querySelector('i') || {}).style.width } : null,
    rows: [...el.querySelectorAll('.sv')].map(l => ({ cls: l.className, dis: l.querySelector('input').disabled, ck: l.querySelector('input').checked, t: l.innerText.replace(/\s+/g, ' ').trim() })),
    roles: [...el.querySelectorAll('.roles input')].map(i => i.value + (i.checked ? '*' : '')).join(','), go: !!el.querySelector('[data-w290go]'),
    top: r.top + scrollY, left: r.left, w: r.width, right: r.right, vw: innerWidth, bodyW: body ? body.getBoundingClientRect().width : 0,
    nextTop: nx ? nx.getBoundingClientRect().top + scrollY : null, nextBottom: nx ? nx.getBoundingClientRect().bottom + scrollY : null,
    tasksTop: tasks ? tasks.getBoundingClientRect().top + scrollY : null,
    over: document.documentElement.scrollWidth - innerWidth, focus: document.activeElement && el.contains(document.activeElement) ? document.activeElement.className || document.activeElement.tagName : null
  };
});
/* the next serving (event 23 in the fixture, 4 October) in the summary view, so the Next serving card (wave171) is on Home to sit under */
function fixture() {
  const fx = loadFixture();
  fx.volunteer_event_summary = (fx.volunteer_event_summary || []).filter(x => x.id !== 23);
  fx.volunteer_event_summary.push({ id: 23, code: 'WA-26-21', event_date: '2026-10-04', season: 'fall', location: 'Montreal', notes: null, status: 'planned', kind: 'service', title: 'Sunday serving', format: null,
    roster_confirmed: (fx.event_roster || []).filter(r => r.event_id === 23 && /confirmed/i.test(r.status || '')).length, roster_count: (fx.event_roster || []).filter(r => r.event_id === 23).length,
    roster_by_link: 0, roster_declined: 0, roster_texted: 0, steps_done: 0, steps_total: 0 });
  return fx;
}
const home = (o) => Object.assign({ who: 'admin', hash: '#mypage', width: 1366, wait: 4200, fixture: fixture() }, o);

(async () => {
  const browser = await launch();
  try {
    /* 1. a computer: the card, where it sits, the picker, Confirm */
    let f = await fresh(browser, home({ rpcs: rpcs(TODO) }));
    await f.page.waitForTimeout(600);
    let c = await card(f);
    ok('the card is on Home', !!c, c);
    ok('the kicker: your servings until September 30', c && /Your servings · until September 30/i.test(c.k), c && c.k);
    ok('1 of 4 this year, the bar at a quarter', c && /1 of 4 this year/i.test(c.h) && c.bar && c.bar.now === '1' && c.bar.w === '25%', c && { h: c.h, bar: c.bar });
    ok('three more before September 30', c && /Three more before September 30\. Pick the dates that work for you\./.test(c.txt), c && c.txt.slice(0, 300));
    ok('the servings: the date, the time, the place, a partner', c && c.rows.length === 3 && /Sunday, October 4/.test(c.rows[0].t) && /12:00 pm · Place Émilie-Gamelin/.test(c.rows[0].t) && /with Oberoi Financial Group/.test(c.rows[2].t), c && c.rows);
    ok('one they are on: says so, ticked, cannot be unticked', c && /mine/.test(c.rows[1].cls) && c.rows[1].dis && c.rows[1].ck && /You’re on it/i.test(c.rows[1].t), c && c.rows[1]);
    ok('the roles: Serve (chosen) and Take photos', c && c.roles === 'server*,photographer', c && c.roles);
    ok('who gets the dates', c && /You’re confirmed right away, and Ahmed gets the dates\./.test(c.txt));
    ok('right after the Next serving card', c && (c.nextTop === null || c.top >= c.nextBottom - 1), c && { top: c.top, next: [c.nextTop, c.nextBottom] });
    ok('before My tasks', c && (c.tasksTop === null || c.top < c.tasksTop), c && { top: c.top, tasks: c.tasksTop });
    ok('full width on a computer', c && Math.abs(c.w - c.bodyW) <= 2, c && { w: c.w, body: c.bodyW });
    ok('the Next serving card is there to sit under', c && c.nextTop !== null, 'no #w171next in this fixture');
    if (SHOTS) await (await f.page.$('#w290srv')).screenshot({ path: SHOTS + '/w290_computer.png' });
    await record(f);
    await f.page.click('#w290srv [data-w290go]'); await f.page.waitForTimeout(300);
    c = await card(f);
    ok('nothing ticked: says so, takes the focus, nothing sent', c && /Choose at least one serving\./.test(c.txt) && /er/.test(c.focus || '') && (await calls(f, 'wa290_home_signup')).length === 0, c && { txt: c.txt.slice(-160), focus: c.focus });
    await f.page.check('#w290srv input[data-w290ev="900"]'); await f.page.check('#w290srv input[data-w290ev="902"]');
    c = await card(f);
    ok('ticked: the rows light up, the error goes', c && /\bon\b/.test(c.rows[0].cls) && /\bon\b/.test(c.rows[2].cls) && !/Choose at least one serving/.test(c.txt), c && c.rows.map(r => r.cls));
    /* the roles move with the arrow keys */
    await f.page.focus('#w290srv .roles input[value="server"]'); await f.page.keyboard.press('ArrowRight'); await f.page.waitForTimeout(100);
    c = await card(f);
    ok('the arrow key moves the role to Take photos', c && c.roles === 'server,photographer*' && await f.ev(() => document.querySelector('#w290srv .roles label.on').textContent === 'Take photos'), c && c.roles);
    ok('ticking does not redraw the card under the finger', await f.ev(() => document.activeElement && document.activeElement.value === 'photographer'));
    await f.page.evaluate(a => { window.__WA_RPCS.wa290_home_servings = a; }, AFTER);
    await f.page.click('#w290srv [data-w290go]'); await f.page.waitForTimeout(800);
    const s1 = await calls(f, 'wa290_home_signup');
    ok('Confirm sends the servings and the role', s1.length === 1 && JSON.stringify(s1[0].a.p_events) === '[900,902]' && s1[0].a.p_role === 'photographer' && !('p_message' in s1[0].a), s1);
    c = await card(f);
    ok('confirmed: the dates, who has them, the focus on it', c && /You’re confirmed for Sunday, October 4; Sunday, October 18\. Ahmed has the dates in the Operations Montreal inbox\./.test(c.txt) && /ok/.test(c.focus || ''), c && { txt: c.txt.slice(0, 260), focus: c.focus });
    ok('asked again: 3 of 4, one more, the new ones say so', c && /3 of 4 this year/i.test(c.h) && /One more before September 30/.test(c.txt) && c.rows.filter(r => r.dis).length === 3 && (await calls(f, 'wa290_home_servings')).length >= 1, c && { h: c.h, rows: c.rows });
    ok('on every open serving: says so, no button', c && /You’re on every open serving\. Ahmed adds the next ones soon\./.test(c.txt) && !c.go, c && c.txt.slice(-200));
    if (SHOTS) await (await f.page.$('#w290srv')).screenshot({ path: SHOTS + '/w290_confirmed.png' });
    ok('no page errors', f.errs.length === 0, f.errs);
    await f.close();

    /* 2. a server error says what happened and keeps the choice */
    f = await fresh(browser, home({ rpcs: rpcs(TODO) }));
    await f.page.waitForTimeout(600); await record(f);
    await f.ev(() => { window.__fail = { wa290_home_signup: 'ERROR:  Those servings are not open any more. Pick another one.' }; });
    await f.page.check('#w290srv input[data-w290ev="900"]');
    await f.page.click('#w290srv [data-w290go]'); await f.page.waitForTimeout(500);
    c = await card(f);
    ok('a server error: plain words, the focus on it, the choice kept', c && /Those servings are not open any more\. Pick another one\./.test(c.txt) && !/ERROR/.test(c.txt) && c.rows[0].ck && /er/.test(c.focus || '') && c.go, c && { txt: c.txt.slice(-220), focus: c.focus });
    ok('no page errors (server error)', f.errs.length === 0, f.errs);
    await f.close();

    /* 3. four of four: the thank-you */
    f = await fresh(browser, home({ rpcs: rpcs(THANKS) }));
    await f.page.waitForTimeout(600);
    c = await card(f);
    ok('four of four: thank you, the bar full, no list, no button', c && /4 of 4\. Thank you!/i.test(c.h) && c.bar && c.bar.w === '100%' && /That’s your four servings for the year\. Thank you for showing up for our community\./.test(c.txt) && c.rows.length === 0 && !c.go, c);
    if (SHOTS) await (await f.page.$('#w290srv')).screenshot({ path: SHOTS + '/w290_thanks.png' });
    await f.close();

    /* 4. nothing open */
    f = await fresh(browser, home({ rpcs: rpcs(base({ servings: [] })) }));
    await f.page.waitForTimeout(600);
    c = await card(f);
    ok('nothing open: says so, no button', c && /No servings are open right now\. Ahmed adds the next ones soon\./.test(c.txt) && !c.go && c.rows.length === 0, c && c.txt);
    await f.close();

    /* 5. no card: the database says no (Toronto, the board, before 15 November, done), the call fails, a director */
    f = await fresh(browser, home({ rpcs: rpcs({ show: false, why: 'later', show_from: '2026-11-15' }) }));
    await f.page.waitForTimeout(600);
    ok('the database says not yet: no card', !(await card(f)) && await f.ev(() => !!document.getElementById('mpBody')));
    ok('no page errors (no card)', f.errs.length === 0, f.errs);
    await f.close();
    f = await fresh(browser, home({ rpcs: rpcs(TODO), init: 'window.__WA_RPC_ERRORS = { wa290_home_servings: "Team members only" };' }));
    await f.page.waitForTimeout(600);
    ok('the call fails: no card, no error on the page', !(await card(f)) && f.errs.length === 0, f.errs);
    await f.close();
    f = await fresh(browser, home({ who: 'board', rpcs: rpcs(TODO) }));
    await f.page.waitForTimeout(800);
    ok('a director: no card', !(await card(f)));
    ok('no page errors (director)', f.errs.length === 0, f.errs);
    await f.close();

    /* 6. a phone */
    f = await fresh(browser, home({ rpcs: rpcs(TODO), width: 390 }));
    await f.page.waitForTimeout(800);
    c = await card(f);
    ok('phone: the card fits, nothing scrolls sideways', c && c.right <= c.vw + 1 && c.left >= 0 && c.over <= 1, c && { left: c.left, right: c.right, vw: c.vw, over: c.over });
    ok('phone: right after the Next serving card, before My tasks', c && (c.nextTop === null || c.top >= c.nextBottom - 1) && (c.tasksTop === null || c.top < c.tasksTop), c && { top: c.top, next: c.nextBottom, tasks: c.tasksTop });
    ok('phone: every row is at least 48px tall', await f.ev(() => [...document.querySelectorAll('#w290srv .sv')].every(r => r.getBoundingClientRect().height >= 47.5)));
    ok('phone: the button is at least 44px tall', await f.ev(() => document.querySelector('#w290srv .go').getBoundingClientRect().height >= 44));
    if (SHOTS) { await f.ev(() => document.getElementById('w290srv').scrollIntoView({ block: 'center' })); await f.page.waitForTimeout(200); await f.page.screenshot({ path: SHOTS + '/w290_phone.png' }); }
    ok('no page errors (phone)', f.errs.length === 0, f.errs);
    await f.close();
  } catch (e) { fail++; console.log('FAIL crashed :: ' + (e && e.stack || e)); }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
