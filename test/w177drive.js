/* w177drive.js: wave177, confirm your next team meeting from Home (#w177card): the next team meeting in 7 days that the
   person has not answered, Accept and I can't make it through hub-connect (switching Google Calendar on first when it is
   off), the note to tell the leader 24 hours before, the error path, and who sees nothing. Since 30/09/26 it is a pop-up
   (#w177pop): Ask me later, Escape, not over another window, back on the next visit to Home. The clock is 25/09/26 16:00.
   wave238 (14/10/26), the gate: no x, no Ask me later, no Escape; it shows on any page; every unanswered meeting is asked in
   turn; leaving Home does not close it; only a failed reply offers Try again later; it waits for the Loop's gate (#w238loop). */
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 600) : '')); } }

const ME = 'samson.jules@welfareavenue.com', LEAD = 'valex.sanon@welfareavenue.com';
const att = (email, status, organizer) => ({ name: '', email, status, optional: false, organizer: !!organizer });
function ev(id, summary, start, dept, list, extra) {
  return Object.assign({ id, calendar_id: 'hub@welfareavenue.com', recurring_event_id: null, summary, description: null, location: null, start_at: start, end_at: start.replace(/T(\d\d)/, (m, h) => 'T' + String(Number(h) + 1).padStart(2, '0')), all_day: false, status: 'confirmed',
    organizer: (list.filter(a => a.organizer)[0] || {}).email || null, attendees: list, attendee_emails: list.map(a => a.email), meet_link: 'https://meet.google.com/abc-defg-hij', html_link: 'https://www.google.com/calendar/event?eid=' + id, department: dept, updated_at: null, synced_at: null }, extra || {});
}
function fixture(events) {
  const fx = loadFixture();
  fx.hub_events = events;
  fx.hub_connections = [];
  return fx;
}
const EVENTS = () => [
  ev('past1', 'Weekly Operations Meeting', '2026-09-24T20:00:00-04:00', 'opsmtl', [att('ahmedfakhir@welfareavenue.com', 'accepted', true), att(ME, 'needsAction')]),
  ev('one1', 'Samson / Valex', '2026-09-26T10:00:00-04:00', null, [att(LEAD, 'accepted', true), att(ME, 'needsAction')]),
  ev('ops2', 'Weekly Operations Meeting', '2026-09-27T20:00:00-04:00', 'opsmtl', [att('ahmedfakhir@welfareavenue.com', 'accepted', true), att(ME, 'accepted')]),
  ev('hr1', 'Human ressources meeting', '2026-09-29T20:00:00-04:00', 'hr', [att(LEAD, 'accepted', true), att(ME, 'needsAction'), att('tuna.kaynak@welfareavenue.com', 'needsAction')]),
  ev('hr2', 'Human ressources meeting', '2026-10-06T20:00:00-04:00', 'hr', [att(LEAD, 'accepted', true), att(ME, 'needsAction')])
];
const MOCK = (mode) => {
  window.__w177 = [];
  window.w116Conn = { calendar: false, drive: false, slack: false };
  db.functions.invoke = function (name, opts) {
    const b = (opts && opts.body) || {}; window.__w177.push({ name, b });
    if (b.action === 'toggle') return Promise.resolve({ data: mode === 'toggle_fail' ? { ok: false, error: 'unauthorized_client' } : { ok: true, detail: 'Samson Jules' }, error: null });
    if (b.action === 'rsvp') return Promise.resolve({ data: { ok: true, response: b.response }, error: null });
    if (b.action === 'status') return Promise.resolve({ data: { connections: {} }, error: null });
    return Promise.resolve({ data: {}, error: null });
  };
};
const card = f => f.ev(() => { const c = document.getElementById('w177card'); return c ? { t: c.innerText, ev: c.getAttribute('data-ev'), cls: c.className, pop: !!c.closest('#w177pop'), dlg: c.getAttribute('role') === 'dialog' && c.getAttribute('aria-modal') === 'true' } : null; });
const away = async f => { await f.hash('#calendar', 1200); await f.hash('#mypage', 2600); };

(async () => {
  const browser = await launch();
  try {
    /* 1. a member with an unanswered team meeting */
    let f = await fresh(browser, { who: 'member', hash: '#mypage', fixture: fixture(EVENTS()), wait: 4500 });
    await f.ev(MOCK, 'ok'); await f.ev(() => window.w177.refresh(true)); await f.page.waitForTimeout(400);
    let c = await card(f);
    ok('Home asks about the next team meeting they have not answered (not the past one, the 1:1 or the one they accepted)', c && c.ev === 'hr1' && /Human ressources meeting/i.test(c.t) && /Your next team meeting/i.test(c.t), c);
    ok('it says when, with the Meet link', c && /Tuesday, September 29 at 8:00 pm/.test(c.t) && /Meet link/.test(c.t), c && c.t);
    ok('two choices: Accept and I can\'t make it', c && /Accept/.test(c.t) && /I can.t make it/.test(c.t) && !/Maybe/.test(c.t), c && c.t);
    ok('the note: tell the leader (the organizer) at least 24 hours before', c && /let Valex know at least 24 hours before/.test(c.t) && !/less than 24 hours/.test(c.t), c && c.t);
    ok('with Calendar off, the card says answering switches it on', c && /switches on Google Calendar for the Hub/.test(c.t), c && c.t);
    ok('it is a pop-up over Home (a dialog), not a section of the page', c && c.pop && c.dlg && await f.ev(() => !document.getElementById('mpBody').contains(document.getElementById('w177card')) && getComputedStyle(document.getElementById('w177pop')).position === 'fixed'), c);
    ok('Accept has the focus', await f.ev(() => document.activeElement && document.activeElement.getAttribute('data-w177') === 'accepted'));
    await f.page.click('#w177card [data-w177="accepted"]'); await f.page.waitForTimeout(500);
    let calls = await f.ev(() => window.__w177);
    ok('Accept switches Google Calendar on, then accepts that meeting as them', calls.length >= 2 && calls[0].b.action === 'toggle' && calls[0].b.provider === 'google_calendar' && calls[0].b.enabled === true && calls[1].b.action === 'rsvp' && calls[1].b.event_id === 'hr1' && calls[1].b.response === 'accepted', calls);
    c = await card(f);
    ok('then: See you there, accepted on Google Calendar', c && /See you there/i.test(c.t) && /Accepted on your Google Calendar/.test(c.t), c && c.t);
    await f.page.waitForTimeout(6500);
    c = await card(f);
    ok('then it closes by itself and asks the next unanswered team meeting right away (wave238)', c && c.ev === 'hr2' && !/See you there/.test(c.t), c);
    ok('no x and no Ask me later on the card (wave238)', c && !/Ask me later/.test(c.t) && await f.ev(() => !document.querySelector('#w177card .x, #w177card button.later')), c && c.t);
    await f.page.click('#w177card [data-w177="declined"]'); await f.page.waitForTimeout(500);
    calls = await f.ev(() => window.__w177);
    ok('I can\'t make it declines on Google Calendar (no second switch-on)', calls.filter(x => x.b.action === 'toggle').length === 1 && calls[calls.length - 1].b.action === 'rsvp' && calls[calls.length - 1].b.event_id === 'hr2' && calls[calls.length - 1].b.response === 'declined', calls);
    c = await card(f);
    ok('then: please also let Valex know, 24 hours before', c && /Please also let Valex know/.test(c.t) && /24 hours before/.test(c.t) && c.cls === 'dec', c);
    await f.page.waitForTimeout(6500);
    ok('a decline stays open so they read the note', !!(await card(f)));
    await f.page.click('#w177card [data-w177close].yes'); await f.page.waitForTimeout(400);
    ok('Close closes it', !(await card(f)));
    await away(f);
    ok('nothing left to answer: no pop-up', !(await card(f)));
    ok('no page errors', f.errs.length === 0, f.errs);
    await f.close();

    /* 1b. wave238: no way out (Escape, a click outside, leaving Home), never on top of another window, and it shows on any page */
    f = await fresh(browser, { who: 'member', hash: '#mypage', fixture: fixture(EVENTS()), wait: 4500 });
    await f.ev(MOCK, 'ok'); await f.ev(() => window.w177.refresh(true)); await f.page.waitForTimeout(400);
    ok('it is up', (await card(f) || {}).ev === 'hr1');
    await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(300);
    ok('Escape does nothing', (await card(f) || {}).ev === 'hr1');
    await f.page.mouse.click(5, 5); await f.page.waitForTimeout(300);
    ok('a click outside does nothing', (await card(f) || {}).ev === 'hr1');
    await f.hash('#calendar', 1500);
    ok('leaving Home does not close it', (await card(f) || {}).ev === 'hr1');
    await f.ev(() => window.w177.close());
    await f.ev(() => { openModal('<p>another window</p>'); }); await f.hash('#mypage', 2600); await f.page.waitForTimeout(4500);
    ok('not on top of another window', !(await card(f)));
    await f.ev(() => closeModal()); await f.page.waitForTimeout(2600);
    ok('once that window closes, it shows', (await card(f) || {}).ev === 'hr1');
    ok('no page errors (gate)', f.errs.length === 0, f.errs);
    await f.close();
    /* 1c. wave238: on a page that is not Home, a moment after the start */
    f = await fresh(browser, { who: 'member', hash: '#calendar', fixture: fixture(EVENTS()), wait: 4500 });
    await f.ev(MOCK, 'ok'); await f.page.waitForTimeout(5500);
    ok('it shows on the Calendar page too (any page, after the start)', (await card(f) || {}).ev === 'hr1', await card(f));
    /* the Loop's gate first */
    await f.ev(() => window.w177.close());
    await f.ev(() => { var g = document.createElement('div'); g.id = 'w238loop'; g.innerHTML = '<div class="box" role="dialog" aria-modal="true" style="width:300px;height:100px"></div>'; g.style.cssText = 'position:fixed;inset:0;z-index:2147483100'; document.body.appendChild(g); });
    await f.ev(() => window.w177.refresh(true)); await f.page.waitForTimeout(2600);
    ok('it waits while the Loop\'s Welcome back gate is up', !(await card(f)));
    await f.ev(() => document.getElementById('w238loop').remove()); await f.page.waitForTimeout(2600);
    ok('and shows once that gate is answered', (await card(f) || {}).ev === 'hr1');
    await f.close();

    /* 2. switching Calendar on fails: the reason and a link to answer in Google Calendar */
    f = await fresh(browser, { who: 'member', hash: '#mypage', fixture: fixture(EVENTS()), wait: 4500 });
    await f.ev(MOCK, 'toggle_fail'); await f.ev(() => window.w177.refresh(true)); await f.page.waitForTimeout(400);
    await f.page.click('#w177card [data-w177="accepted"]'); await f.page.waitForTimeout(500);
    c = await card(f);
    calls = await f.ev(() => window.__w177);
    ok('if Calendar cannot be switched on: no reply sent, the card says so and links to Google Calendar', c && c.ev === 'hr1' && /could not be switched on/.test(c.t) && /Answer in Google Calendar/.test(c.t) && !calls.some(x => x.b.action === 'rsvp'), { c, calls });
    ok('only then: Try again later (wave238)', c && /Try again later/.test(c.t), c && c.t);
    await f.page.click('#w177card button.later'); await f.page.waitForTimeout(600);
    ok('Try again later closes it for this visit', !(await card(f)));
    await f.close();

    /* 3. less than 24 hours away: message them now; Calendar already on: no switch-on line and no toggle */
    const soon = EVENTS().filter(e => e.id !== 'hr1' && e.id !== 'hr2');
    soon.push(ev('hr0', 'Human ressources meeting', '2026-09-26T09:00:00-04:00', 'hr', [att(LEAD, 'accepted', true), att(ME, 'needsAction')]));
    f = await fresh(browser, { who: 'member', hash: '#mypage', fixture: fixture(soon), wait: 4500 });
    await f.ev(MOCK, 'ok'); await f.ev(() => { window.w116Conn.calendar = true; return window.w177.refresh(true); }); await f.page.waitForTimeout(400);
    c = await card(f);
    ok('under 24 hours: tomorrow, and message the leader now', c && c.ev === 'hr0' && /Tomorrow at 9:00 am/.test(c.t) && /less than 24 hours away, so message them now/.test(c.t), c && c.t);
    ok('Calendar already on: no switch-on line', c && !/switches on Google Calendar/.test(c.t));
    await f.page.click('#w177card [data-w177="accepted"]'); await f.page.waitForTimeout(500);
    calls = await f.ev(() => window.__w177);
    ok('Calendar already on: straight to the reply', calls.length === 1 && calls[0].b.action === 'rsvp', calls);
    await f.close();

    /* 4. the organizer, and someone with everything answered, see nothing */
    const led = EVENTS().map(e => e.id === 'hr1' || e.id === 'hr2' ? Object.assign(e, { attendees: e.attendees.map(a => a.email === ME ? Object.assign({}, a, { organizer: true, status: 'needsAction' }) : Object.assign({}, a, { organizer: false })), organizer: ME }) : e);
    f = await fresh(browser, { who: 'member', hash: '#mypage', fixture: fixture(led), wait: 4500 });
    await f.ev(MOCK, 'ok'); await f.ev(() => window.w177.refresh(true)); await f.page.waitForTimeout(400);
    ok('the organizer of the meeting is not asked', !(await card(f)));
    await f.close();
    f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(EVENTS()), wait: 4500 });
    await f.ev(MOCK, 'ok'); await f.ev(() => window.w177.refresh(true)); await f.page.waitForTimeout(400);
    ok('someone not invited sees nothing', !(await card(f)));
    await f.close();

    /* 5. the phone */
    f = await fresh(browser, { who: 'member', width: 390, hash: '#mypage', fixture: fixture(EVENTS()), wait: 4500 });
    await f.ev(MOCK, 'ok'); await f.ev(() => window.w177.refresh(true)); await f.page.waitForTimeout(400);
    ok('phone: the card shows, no sideways scroll', !!(await card(f)) && await f.ev(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await f.ev(() => [document.documentElement.scrollWidth, window.innerWidth]));
    if (process.env.SHOTS) await f.page.screenshot({ path: process.env.SHOTS + '/w177-phone.png' });
    await f.close();
  } finally { await browser.close(); }
  console.log('\nw177drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
