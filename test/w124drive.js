/* w124drive.js [role email name width]: drive the master calendar, the fundraising events calendar and birthdays */
const fs = require("fs"); const path = require("path"); const { chromium } = require("playwright");
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", WIDTH = "1366"] = process.argv;
const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8"), stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8"), fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push("PASS " + name); } else { fail++; out.push("FAIL " + name + (extra ? " :: " + String(extra).slice(0, 300) : "")); } }
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await (await browser.newContext({ viewport: { width: Number(WIDTH), height: 900 } })).newPage();
  const errs = []; page.on("pageerror", e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(`(function(){ var FIXED = new Date("2026-08-06T12:00:00-04:00").getTime(); var RealDate = Date; function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } } FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate; window.__WA_TEST_ROLE = ${JSON.stringify(ROLE)}; window.__WA_TEST_EMAIL = ${JSON.stringify(EMAIL)}; window.__WA_TEST_NAME = ${JSON.stringify(NAME)}; window.confirm = function(){ return true; }; try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa112done', '1'); } catch (e) {} })();`);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.route("**/*", route => { const url = route.request().url(); if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html }); if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") }); if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub }); return route.abort(); });
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const ev = f => page.evaluate(f);
  const hash = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(900); };
  const click = async sel => { const el = await page.$(sel); if (!el) return false; await el.click(); await page.waitForTimeout(450); return true; };
  const staff = await ev(() => typeof isStaff === 'function' && isStaff());

  /* the menu */
  const nav = await ev(() => { const bar = document.getElementById('tabBar'); const cal = bar && bar.querySelector('.tab[data-tab="calendar"]'); const home = bar && bar.querySelector('.tab[data-tab="mypage"]'); const homeOn = !!(home && home.style.display !== 'none'); const ov = bar && bar.querySelector('.tab[data-tab="overview"]'); const fe = bar && bar.querySelector('.tab[data-tab="fundevents"]'); return { cal: !!cal, homeOn: homeOn, afterHome: !!(cal && home && home.nextElementSibling === cal), afterOverview: !!(cal && ov && (ov.nextElementSibling === cal || (bar.querySelector('.tab[data-tab="committees"]') && bar.querySelector('.tab[data-tab="committees"]').nextElementSibling === cal && bar.querySelector('.tab[data-tab="governance"]') === ov.nextElementSibling))), calShown: !!(cal && cal.style.display !== 'none'), fe: !!fe, feShown: !!(fe && fe.style.display !== 'none'), feInFund: !!(fe && fe.closest('.w42sub') && fe.closest('.w42d') && fe.closest('.w42d').querySelector('.tab[data-tab="fundraising"]')), feAfterCal: !!(fe && cal && cal.nextElementSibling === fe) }; });
  ok(nav.homeOn ? "Calendar tab right after Home" : "Calendar tab after Overview and the board pages (no Home)", nav.cal && nav.calShown && (nav.homeOn ? nav.afterHome : nav.afterOverview), JSON.stringify(nav));
  if (staff) ok("Events calendar tab in Fundraising & Finances", nav.fe && nav.feShown && nav.feInFund, JSON.stringify(nav));
  else ok("Events calendar tab right after the calendar (board)", nav.fe && nav.feShown && nav.feAfterCal, JSON.stringify(nav));

  /* the calendar */
  await hash('#calendar');
  await page.waitForTimeout(800);
  const c1 = await ev(() => ({ active: document.querySelector('.panel.active').id, title: (document.querySelector('#w124cal .w124bar h2') || {}).textContent, cells: document.querySelectorAll('#w124cal .w124cell').length, chips: document.querySelectorAll('#w124cal .w124chip').length, today: !!document.querySelector('#w124cal .w124cell.today'), mast: (document.querySelector('#calendar > .w118mast h1') || {}).textContent }));
  ok("calendar opens on this month", c1.active === 'calendar' && c1.title === 'August 2026' && (c1.cells === 35 || c1.cells === 42) && c1.today, JSON.stringify(c1));
  ok("masthead", c1.mast === 'Calendar', c1.mast);
  ok(staff ? "five layers for staff" : "three layers for board viewers", c1.chips === (staff ? 5 : 3), c1.chips);
  const meets = await ev(() => w124.state().meetings.map(m => m.summary + '|' + m.id));
  if (EMAIL.startsWith('steel')) ok("only my meetings (Steel)", meets.length === 3 && !meets.some(x => /Marketing Meeting/.test(x)) && !meets.some(x => /w124meet2/.test(x)), JSON.stringify(meets));
  if (EMAIL.startsWith('amanda')) ok("only my meetings (Amanda)", meets.length === 2 && meets.some(x => /w124meet2/.test(x)), JSON.stringify(meets));
  const band = await ev(() => Array.from(document.querySelectorAll('#w124cal .w124band a')).map(a => a.textContent));
  ok("month-long events in the band", band.some(t => /Thrift Fashion Show/.test(t)) && band.some(t => /JMCC/.test(t)), JSON.stringify(band));
  const pills = await ev(() => { const o = {}; document.querySelectorAll('#w124cal .w124ev').forEach(e => { const id = e.getAttribute('data-w124it'); o[id[0]] = (o[id[0]] || 0) + 1; }); return o; });
  ok("pills from every layer", pills.f >= 2 && pills.m >= 1 && pills.p >= 1 && (!staff || (pills.v >= 1 && pills.b >= 1)), JSON.stringify(pills));
  /* a meeting */
  await click('#w124cal .w124ev[data-w124it^="m"]');
  const ms = await ev(() => ({ on: document.getElementById('w124sheet') && document.getElementById('w124sheet').classList.contains('on'), txt: (document.querySelector('#w124sheet .pane') || {}).textContent || '', join: !!document.querySelector('#w124sheet a[href*="meet.google.com"]') }));
  ok("meeting sheet with Join", ms.on && ms.join, JSON.stringify(ms).slice(0, 200));
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  ok("Escape closes the sheet", await ev(() => !document.getElementById('w124sheet').classList.contains('on')));
  /* the band opens the event */
  await click('#w124cal .w124band a');
  ok("band opens the fundraising event", await ev(() => /Thrift Fashion Show|JMCC/.test((document.querySelector('#w124sheet h2') || {}).textContent || '')));
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  /* layers */
  if (staff) {
    await click('#w124cal [data-w124layer="bday"]');
    const off = await ev(() => ({ n: document.querySelectorAll('#w124cal .w124ev[data-w124it^="b"]').length, ls: localStorage.getItem('w124layers') }));
    ok("switching birthdays off", off.n === 0 && /"bday":false/.test(off.ls || ''), JSON.stringify(off));
    await click('#w124cal [data-w124layer="bday"]');
  }
  /* navigation and the agenda */
  await click('#w124cal [data-w124nav="1"]');
  ok("next month", await ev(() => document.querySelector('#w124cal .w124bar h2').textContent === 'September 2026'));
  await click('#w124cal [data-w124nav="0"]');
  ok("today", await ev(() => document.querySelector('#w124cal .w124bar h2').textContent === 'August 2026'));
  await click('#w124cal [data-w124view="agenda"]');
  const ag = await ev(() => ({ days: document.querySelectorAll('#w124cal .w124agd').length, today: !!document.querySelector('#w124cal .w124agd.today') }));
  ok("agenda view", ag.days >= 4 && ag.today, JSON.stringify(ag));
  await click('#w124cal [data-w124view="month"]');
  await hash('#calendar/2026-12');
  ok("deep link to a month", await ev(() => document.querySelector('#w124cal .w124bar h2').textContent === 'December 2026'));
  await hash('#calendar/2026-08');

  /* birthdays */
  if (staff) {
    await click('#w124cal [data-w124bday]');
    const bf = await ev(() => !!document.querySelector('#w124sheet form[data-w124bform]'));
    ok("birthday form opens", bf);
    await click('#w124sheet button[type="submit"]');
    ok("birthday form checks the fields", await ev(() => /Pick the month/.test((document.querySelector('#w124sheet [data-w124berr]') || {}).textContent || '')));
    await page.selectOption('#w124sheet select[name="month"]', '2');
    await page.selectOption('#w124sheet select[name="day"]', '30');
    await click('#w124sheet button[type="submit"]');
    ok("impossible days are refused", await ev(() => /February has 29 days/.test((document.querySelector('#w124sheet [data-w124berr]') || {}).textContent || '')));
    await page.selectOption('#w124sheet select[name="month"]', '8');
    await page.selectOption('#w124sheet select[name="day"]', '20');
    await page.check('#w124sheet input[name="share"][value="team"]');
    await click('#w124sheet button[type="submit"]');
    const mine = await ev(() => { const em = (typeof USER !== 'undefined' && USER.email || '').toLowerCase(); return w124.state().bdays.filter(b => b.email === em)[0] || null; });
    ok("birthday saved", mine && mine.month === 8 && mine.day === 20 && mine.share === 'team', JSON.stringify(mine));
    ok("it shows on the calendar", await ev(() => !!document.querySelector('#w124cal .w124cell[data-day="2026-08-20"] .w124ev[data-w124it^="b"]')));
    /* the profile pill */
    const myId = await ev(() => { const em = (typeof USER !== 'undefined' && USER.email || '').toLowerCase(); const m = (DB_MEMBERS || []).filter(x => (x.email || '').toLowerCase() === em)[0]; return m ? m.id : null; });
    if (myId) {
      await hash('#person/' + myId);
      await page.waitForTimeout(1200);
      ok("my profile shows my birthday", await ev(() => /August 20/.test((document.querySelector('#personpage .w124bpill') || {}).textContent || '')));
    }
    await hash('#person/17');
    await page.waitForTimeout(1200);
    if (!EMAIL.startsWith('ian')) ok("someone else's profile shows theirs", await ev(() => /August 14/.test((document.querySelector('#personpage .w124bpill') || {}).textContent || '')) && await ev(() => !document.querySelector('#personpage .w124bpill[data-w124bday]')));
  }

  /* the fundraising events calendar */
  await hash('#fundevents');
  await page.waitForTimeout(700);
  const f1 = await ev(() => ({ active: document.querySelector('.panel.active').id, seasons: Array.from(document.querySelectorAll('#w124fund .w124season h3')).map(h => h.textContent), cards: document.querySelectorAll('#w124fund .w124fe').length, lanes: document.querySelectorAll('#w124fund .w124lane a').length, ideas: document.querySelectorAll('#w124fund .w124ideas a').length, big: (document.querySelector('#w124fund .w124goals .big') || {}).textContent, add: document.querySelectorAll('#w124fund [data-w124fadd]').length }));
  ok("events page: seasons, cards, strip, ideas", f1.active === 'fundevents' && f1.seasons.length === 5 && f1.cards >= 7 && f1.lanes >= 5 && f1.ideas === 2, JSON.stringify(f1));
  ok("goals card", /\$0/.test(f1.big || ''), f1.big);
  const canEdit = await ev(() => { if (!(typeof isStaff === 'function' && isStaff())) return false; const r = (typeof WA40_MINE !== 'undefined' && WA40_MINE && WA40_MINE.role) || ''; if (r === 'admin' || r === 'leader') return true; const em = (typeof USER !== 'undefined' && USER.email || '').toLowerCase(); const m = (DB_MEMBERS || []).filter(x => (x.email || '').toLowerCase() === em)[0]; return !!(m && m.department === 'fundraising'); });
  ok(canEdit ? "leaders and the fundraising team can add events" : "everyone else cannot add", canEdit ? f1.add === 5 : f1.add === 0, f1.add + ' canEdit=' + canEdit);
  await click('#w124fund .w124fe[data-w124fund="6"]');
  ok("event sheet", await ev(() => /St\. Patrick/.test((document.querySelector('#w124sheet h2') || {}).textContent || '')));
  if (!canEdit) ok("no edit button without edit rights", await ev(() => !document.querySelector('#w124sheet [data-w124fedit]')));
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  await click('#w124fund .w124fe[data-w124fund="6"]');
  if (canEdit) {
    await click('#w124sheet [data-w124fedit]');
    ok("edit form", await ev(() => !!document.querySelector('#w124sheet form[data-w124fform="6"]')));
    await page.fill('#w124sheet input[name="title"]', "St. Patrick's Party at Reggie's (with Casa X)");
    await click('#w124sheet button[type="submit"]');
    ok("edit saved", await ev(() => w124.state().fund.filter(f => f.id === 6)[0].title === "St. Patrick's Party at Reggie's (with Casa X)"));
    await click('#w124fund [data-w124fadd="spring-2027"]');
    await page.fill('#w124sheet input[name="title"]', 'Golf tournament');
    await page.selectOption('#w124sheet select[name="precision"]', 'month');
    await page.fill('#w124sheet input[name="m1"]', '2027-05');
    await page.fill('#w124sheet input[name="target_min"]', '5000');
    await click('#w124sheet button[type="submit"]');
    const add = await ev(() => { const f = w124.state().fund.filter(x => x.title === 'Golf tournament')[0]; return f ? { s: f.start_date, e: f.end_date, season: f.season, t: f.target_min, p: f.precision } : null; });
    ok("event added", add && add.s === '2027-05-01' && add.e === '2027-05-31' && add.season === 'spring-2027' && add.t === 5000 && add.p === 'month', JSON.stringify(add));
    ok("the new card shows", await ev(() => Array.from(document.querySelectorAll('#w124fund .w124fe h4')).some(h => h.textContent === 'Golf tournament')));
    await click('#w124fund .w124fe[data-w124fund="1"]');
    await click('#w124sheet [data-w124fdone]');
    await page.fill('#w124sheet input[name="raised"]', '2800');
    await page.fill('#w124sheet textarea[name="result_note"]', '13 teams, 78 players.');
    await click('#w124sheet button[type="submit"]');
    const done = await ev(() => { const f = w124.state().fund.filter(x => x.id === 1)[0]; return { st: f.status, r: f.raised, n: f.result_note }; });
    ok("result recorded", done.st === 'done' && done.r === 2800 && done.n === '13 teams, 78 players.', JSON.stringify(done));
    const leader = await ev(() => ['admin', 'leader'].indexOf((WA40_MINE || {}).role) >= 0);
    if (leader) {
      await click('#w124fund .w124ideas a');
      await click('#w124sheet [data-w124fedit]');
      await click('#w124sheet [data-w124fdel]');
      ok("leaders can delete", await ev(() => document.querySelectorAll('#w124fund .w124ideas a').length === 1));
    }
  }
  if (staff) {
    /* the team page pill */
    await hash('#team/fundraising');
    await page.waitForTimeout(1200);
    ok("Events calendar pill on the Fundraising team page", await ev(() => !!document.querySelector('#team .w116seg [data-w116go="#fundevents"]')));
  }
  const e2 = errs.filter(e => !/ERR_FAILED|Failed to fetch|NetworkError/.test(e));
  ok("no page errors", e2.length === 0, JSON.stringify(e2.slice(0, 4)));
  console.log(out.join("\n"));
  console.log("RESULT " + pass + " passed, " + fail + " failed (" + ROLE + " " + EMAIL + ")");
  await browser.close();
})();
