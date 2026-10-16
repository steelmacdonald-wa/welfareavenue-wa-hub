/* w260drive.js: wave260, train to unlock and the Dashboard for the admins. Offline against the candidate (CAND=build/<file>.html),
   with test/boot.js (stubbed Supabase, clock 25/09/26) and test/w260fx.js (the live page tours and access profiles).
   An admin (Steel), Shima (a leader named in dashboard_people), Amanda (the Fundraising lead), a member (Samson, HR profile),
   a director on the board view, phone width; the switch off and a person let through. SHOTS=<dir> saves screenshots. */
const fs = require('fs');
const { launch, fresh } = require('./boot');
const { fx260, adminRows } = require('./w260fx');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, info) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (info !== undefined ? '  ' + JSON.stringify(info).slice(0, 500) : '')); } }
const shot = async (f, n, full) => { if (SHOTS) await f.page.screenshot({ path: SHOTS + '/' + n + '.png', fullPage: !!full }); };
const st = (f) => f.ev(() => ({
  active: (document.querySelector('.panel.active') || {}).id || '', hash: location.hash,
  lock: !!document.getElementById('w260lock'), lockH: (document.querySelector('#w260lock h2') || {}).textContent || '',
  lockTxt: (document.getElementById('w260lock') || {}).innerText || '',
  hid: !!document.querySelector('.panel.active.w260hid'),
  note: (document.getElementById('w260note') || {}).innerText || '',
  ovTab: (function () { var t = document.querySelector('#tabBar .tab[data-tab="overview"]'); return !!t && t.style.display !== 'none' && getComputedStyle(t).display !== 'none'; })(),
  menuLocks: Array.from(document.querySelectorAll('.tab[data-w260lock="1"]')).map(t => t.dataset.tab),
  tour: !!document.querySelector('.w122tp'), errs: 0
}));
async function finishTour(f) {
  for (let i = 0; i < 40; i++) {
    const has = await f.ev(() => !!document.querySelector('.w122tp'));
    if (!has) return true;
    await f.ev(() => { var b = document.querySelector('.w122tp [data-w122tnext]'); if (b && b.style.opacity !== '.4') b.click(); });
    await f.page.waitForTimeout(900);
  }
  return false;
}
async function waitTour(f) { for (let i = 0; i < 20; i++) { if (await f.ev(() => !!document.querySelector('.w122tp .pop h4'))) return true; await f.page.waitForTimeout(300); } return false; }

(async () => {
  const b = await launch();
  const allErrs = [];

  /* ---------- 1. an admin ---------- */
  {
    const f = await fresh(b, { who: 'admin', hash: '#overview', fixture: fx260(), gate: true, rpcs: { wa_org_editor: true, wa260_page_tours: adminRows(), wa260_gate_set: { ok: true } } });
    let s = await st(f);
    ok('admin: the Dashboard opens', s.active === 'overview' && !s.lock && !s.note, s);
    ok('admin: the Dashboard is in the menu', s.ovTab, s);
    ok('admin: no lock anywhere in the menu', s.menuLocks.length === 0, s.menuLocks);
    await f.hash('#calendar', 1200); s = await st(f);
    ok('admin: a page with a tour opens without its tour', s.active === 'calendar' && !s.lock, s);
    await f.hash('#adminpanel/tours', 1800);
    s = await f.ev(() => ({ card: !!document.getElementById('w260card'), vis: (function () { var c = document.getElementById('w260card'); return !!c && c.offsetParent !== null; })(), txt: (document.getElementById('w260card') || {}).innerText || '',
      nav: Array.from(document.querySelectorAll('#adminpanel nav.w118adm a')).map(a => a.textContent), others: Array.from(document.querySelectorAll('#adminpanel > .card')).filter(c => c.id !== 'w260card' && c.offsetParent !== null).length }));
    ok('admin: Admin has a Page tours section', s.nav.indexOf('Page tours') >= 0, s.nav);
    ok('admin: Page tours shows the card alone', s.vis && s.others === 0, s);
    ok('admin: the switch, the Dashboard people and the let-through list', /Train to unlock is on/.test(s.txt) && /Who opens the Executive dashboard/.test(s.txt) && /Shima/.test(s.txt) && /Let someone through/.test(s.txt), s.txt.slice(0, 400));
    ok('admin: the count and person x tour', /3 of 3/.test(s.txt) && /people \(admins aside\) will see at least one lock/.test(s.txt) && /Amanda/.test(s.txt) && /1 of 4 toured/.test(s.txt), s.txt.slice(0, 900));
    await shot(f, 'admin_page_tours', true);
    /* turning it off goes through wa260_gate_set */
    await f.ev(() => { window.__C260 = []; const r0 = db.rpc.bind(db); db.rpc = function (fn, a) { window.__C260.push({ fn: fn, a: a }); return r0(fn, a); }; });
    await f.ev(() => document.querySelector('#w260card [data-w260set="gate"]').click());
    await f.page.waitForTimeout(700);
    s = await f.ev(() => ({ calls: window.__C260, txt: (document.getElementById('w260card') || {}).innerText || '' }));
    ok('admin: Turn it off calls wa260_gate_set and says off', s.calls.some(c => c.fn === 'wa260_gate_set' && c.a.p_key === 'page_gate' && c.a.p_value === 'off') && /Train to unlock is off/.test(s.txt), s.calls);
    await f.ev(() => document.querySelector('#w260card [data-w260ex-one="amanda.zoldak@welfareavenue.com"]').click());
    await f.page.waitForTimeout(700);
    s = await f.ev(() => window.__C260.filter(c => c.fn === 'wa260_gate_set').map(c => c.a));
    ok('admin: Let through adds the person to page_gate_exempt', s.some(a => a.p_key === 'page_gate_exempt' && JSON.stringify(a.p_value) === '["amanda.zoldak@welfareavenue.com"]'), s);
    allErrs.push(...f.errs); await f.close();
  }

  /* ---------- 2. Shima: the Dashboard, behind its tour ---------- */
  {
    const f = await fresh(b, { who: 'shima', hash: '#mypage', fixture: fx260(), gate: true });
    let s = await st(f);
    ok('Shima: the Dashboard is in her menu', s.ovTab, s);
    ok('Shima: Home is never locked', s.active === 'mypage' && !s.lock, s);
    ok('Shima: the Dashboard has a lock in the menu', s.menuLocks.indexOf('overview') >= 0, s.menuLocks);
    await f.hash('#overview', 1500); s = await st(f);
    ok('Shima: #overview shows the lock card, not the page', s.active === 'overview' && s.lock && s.hid && s.lockH === 'Executive dashboard', s);
    ok('Shima: the card says the tour and its length', /Take the 3-minute tour to unlock it/.test(s.lockTxt) && /Start the tour/.test(s.lockTxt) && /Back to Home/.test(s.lockTxt), s.lockTxt);
    await shot(f, 'shima_dashboard_locked');
    await f.ev(() => document.querySelector('#w260lock [data-w260start]').click());
    const running = await waitTour(f); s = await st(f);
    ok('Shima: Start the tour shows the page and runs its tour', running && s.active === 'overview' && !s.lock && !s.hid && s.tour, s);
    await shot(f, 'shima_tour_running');
    await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(600); s = await st(f);
    ok('Shima: leaving the tour midway locks the page again', s.lock && s.hid && !s.tour, s);
    await f.ev(() => document.querySelector('#w260lock [data-w260start]').click());
    await waitTour(f);
    const done = await finishTour(f); await f.page.waitForTimeout(700); s = await st(f);
    ok('Shima: finishing the tour unlocks the Dashboard', done && s.active === 'overview' && !s.lock && !s.hid, s);
    const rec = await f.ev(() => { const t = w122.A.byKey['tour:overview']; return { done: w122.isDone(t.id) }; });
    ok('Shima: the tour is recorded as done (as from the Academy)', rec.done, rec);
    await f.ev(() => { var c = document.getElementById('w122cel'); if (c) c.remove(); });
    await f.hash('#mypage', 900); await f.hash('#overview', 1200); s = await st(f);
    ok('Shima: the Dashboard stays open afterwards', s.active === 'overview' && !s.lock && s.menuLocks.indexOf('overview') < 0, s);
    allErrs.push(...f.errs); await f.close();
  }

  /* ---------- 3. Amanda: no Dashboard; pages locked until toured ---------- */
  {
    const f = await fresh(b, { who: 'amanda', hash: '#mypage', fixture: fx260(), gate: true });
    let s = await st(f);
    ok('Amanda: no Dashboard in the menu', !s.ovTab, s);
    ok('Amanda: toured Requests is open, Calendar is locked in the menu', s.menuLocks.indexOf('requests') < 0 && s.menuLocks.indexOf('calendar') >= 0 && s.menuLocks.indexOf('mypage') < 0 && s.menuLocks.indexOf('training') < 0, s.menuLocks);
    for (const h of ['#overview', '#decisions', '#dashboard']) {
      await f.hash(h, 1400); s = await st(f);
      ok('Amanda: ' + h + ' lands on Home with the line', s.active === 'mypage' && /The Dashboard is for the admins\./.test(s.note) && !s.lock && s.hash === '#mypage', s);
    }
    await shot(f, 'amanda_dashboard_refused');
    await f.hash('#requests', 1200); s = await st(f);
    ok('Amanda: the note goes once she moves on; Requests is open', s.active === 'requests' && !s.note && !s.lock, s);
    await f.hash('#calendar', 1300); s = await st(f);
    ok('Amanda: Calendar shows its lock card', s.active === 'calendar' && s.lock && s.lockH === 'Calendar' && /2-minute tour/.test(s.lockTxt), s);
    await shot(f, 'amanda_calendar_locked');
    await f.ev(() => document.querySelector('#tabBar .tab[data-tab="requests"]').click()); await f.page.waitForTimeout(900);
    await f.ev(() => document.querySelector('#tabBar .tab[data-tab="calendar"]').click()); await f.page.waitForTimeout(1100); s = await st(f);
    ok('Amanda: a locked menu item still opens (to the card)', s.active === 'calendar' && s.lock, s);
    await f.hash('#team/fundraising', 1600); s = await st(f);
    ok('Amanda: her team page is locked with the team name', s.lock && s.lockH === 'Fundraising', s);
    await f.hash('#training', 1300); s = await st(f);
    ok('Amanda: the Avenue Academy is never locked', s.active === 'training' && !s.lock, s);
    const acad = await f.ev(() => Array.from(document.querySelectorAll('#w122 [data-w122tour]')).map(x => x.getAttribute('data-w122tour')));
    ok('Amanda: the Academy lists no Dashboard tours', acad.length > 5 && acad.indexOf('overview') < 0 && acad.indexOf('dashboard') < 0, acad);
    await f.hash('#person/27', 1300); s = await st(f);
    ok('Amanda: a person page is never locked', !s.lock, s);
    /* the Calendar tour from the card, to the end */
    await f.hash('#calendar', 1300);
    await f.ev(() => document.querySelector('#w260lock [data-w260start]').click()); await waitTour(f);
    const fin = await finishTour(f); await f.page.waitForTimeout(800);
    await f.ev(() => { var c = document.getElementById('w122cel'); if (c) c.remove(); });
    s = await st(f);
    ok('Amanda: after the Calendar tour the page and its menu item are open', fin && !s.lock && s.menuLocks.indexOf('calendar') < 0, s);
    /* a decision found in search opens its team page, not the Dashboard */
    const dec = await f.ev(() => { var d = (DB_DECISIONS || []).filter(x => x && x.area && /fund/i.test(x.area))[0]; return d ? String(d.id) : null; });
    if (dec) {
      await f.hash('#decision/' + dec, 2200); s = await st(f);
      ok('Amanda: a decision link opens the team page', /^#team\/fundraising/.test(s.hash) && !s.note, s);
    } else ok('Amanda: a decision link opens the team page (no Fundraising decision in the fixture, skipped)', true);
    /* the Home chip still goes to her team's decisions (wave258) */
    await f.hash('#mypage', 1500);
    const chip = await f.ev(() => { var c = document.querySelector('#mpBody .mp-chip[data-mphash="#overview"]'); return c ? { k: c.getAttribute('data-w258chip'), t: c.textContent } : null; });
    ok('Amanda: the open decisions chip counts her team, not the Dashboard', chip && chip.k === 'dec' && /Fundraising/.test(chip.t), chip);
    allErrs.push(...f.errs); await f.close();
  }

  /* ---------- 4. a member ---------- */
  {
    const f = await fresh(b, { who: 'member', hash: '', fixture: fx260(), gate: true });
    let s = await st(f);
    ok('member: an empty address lands on Home, no line', s.active === 'mypage' && !s.note && !s.lock, s);
    ok('member: no Dashboard in the menu', !s.ovTab, s);
    await f.hash('#overview', 1400); s = await st(f);
    ok('member: #overview lands on Home with the line', s.active === 'mypage' && /The Dashboard is for the admins\./.test(s.note), s);
    await f.hash('#hrcentre', 1800); s = await st(f);
    ok('member: an app page (HR centre) is locked', s.active === 'hrcentre' && s.lock && s.lockH === 'HR centre', s);
    await shot(f, 'member_hrcentre_locked');
    allErrs.push(...f.errs); await f.close();
  }

  /* ---------- 5. the switch off; a person let through ---------- */
  {
    const f = await fresh(b, { who: 'amanda', hash: '#calendar', fixture: fx260({ gate: false }), gate: true });
    let s = await st(f);
    ok('switch off: no lock card, no menu locks', s.active === 'calendar' && !s.lock && s.menuLocks.length === 0, s);
    await f.hash('#overview', 1300); s = await st(f);
    ok('switch off: the Dashboard rule still holds', s.active === 'mypage' && /The Dashboard is for the admins\./.test(s.note), s);
    allErrs.push(...f.errs); await f.close();
    const g = await fresh(b, { who: 'amanda', hash: '#calendar', fixture: fx260({ exempt: ['amanda.zoldak@welfareavenue.com'] }), gate: true });
    s = await st(g);
    ok('let through: Amanda opens Calendar without its tour', s.active === 'calendar' && !s.lock && s.menuLocks.length === 0, s);
    allErrs.push(...g.errs); await g.close();
    const h = await fresh(b, { who: 'amanda', hash: '#overview', fixture: fx260({ dash: ['shima.butera@welfareavenue.com', 'amanda.zoldak@welfareavenue.com'] }), gate: true });
    s = await st(h);
    ok('dashboard_people: adding Amanda opens the Dashboard for her (behind its tour)', s.ovTab && s.active === 'overview' && s.lock, s);
    allErrs.push(...h.errs); await h.close();
  }

  /* ---------- 6. a director (board view) ---------- */
  {
    const f = await fresh(b, { who: 'board', hash: '', fixture: fx260(), gate: true });
    let s = await st(f);
    ok('board: lands on the Board overview, not the Dashboard', s.active === 'governance' && !s.ovTab, s);
    ok('board: directors are not asked for tours (they cannot read the Academy)', !s.lock && s.menuLocks.length === 0, s);
    await f.hash('#overview', 1500); s = await st(f);
    ok('board: #overview lands on the Board overview with the line', s.active === 'governance' && /The Dashboard is for the admins\./.test(s.note), s);
    await shot(f, 'board_refused');
    allErrs.push(...f.errs); await f.close();
  }

  /* ---------- 7. phone width ---------- */
  {
    const f = await fresh(b, { who: 'amanda', width: 390, hash: '#calendar', fixture: fx260(), gate: true });
    let s = await st(f);
    const w = await f.ev(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, btn: (function () { var x = document.querySelector('#w260lock .w260go'); if (!x) return null; var r = x.getBoundingClientRect(); return { l: r.left, r: r.right }; })() }));
    ok('phone: the lock card fits, no sideways scroll', s.lock && w.sw <= w.cw + 1 && w.btn && w.btn.l >= 0 && w.btn.r <= 390, { s, w });
    await shot(f, 'phone_calendar_locked');
    await f.hash('#overview', 1400); s = await st(f);
    ok('phone: #overview lands on Home with the line', s.active === 'mypage' && /The Dashboard is for the admins\./.test(s.note), s);
    await shot(f, 'phone_dashboard_refused');
    allErrs.push(...f.errs); await f.close();
  }

  ok('no page errors', allErrs.length === 0, allErrs);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
