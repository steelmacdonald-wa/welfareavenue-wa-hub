/* wave116j drive: the header (one profile bubble, who is active, check in/out, Settings) */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", TAG = "steel", WIDTH = "1366"] = process.argv;

(async () => {
  const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  const shots = path.join(__dirname, "shots_p116j");
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: Number(WIDTH), height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("PAGEERROR: " + String(e).slice(0, 300)));
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") { const t = m.text(); if (/wave116|w116|team route/.test(t)) errs.push("CONSOLE: " + t.slice(0, 300)); } });
  await page.addInitScript(`
    (function(){
      var FIXED = new Date(${JSON.stringify(FIXED_TIME)}).getTime();
      var RealDate = Date;
      function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } }
      FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate;
      window.__WA_TEST_ROLE = ${JSON.stringify(ROLE)}; window.__WA_TEST_EMAIL = ${JSON.stringify(EMAIL)}; window.__WA_TEST_NAME = ${JSON.stringify(NAME)};
      window.confirm = function(){ return true; }; window.alert = function(){}; window.prompt = function(){ return null; };
      try { localStorage.setItem('wa84tour', '1'); } catch (e) {}
    })();
  `);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  /* presence and check-ins: three people seen just now, one of them checked in; some closed sessions this week */
  await page.addInitScript(`
    (function(){
      var F = window.__WAFIX; var now = new Date(${JSON.stringify(FIXED_TIME)}).getTime();
      var iso = function (ms) { return new Date(ms).toISOString(); };
      var us = F.user_state || []; var seen = ['ian.odhiambo@welfareavenue.com','suhaib.abdillahi@welfareavenue.com','shima.butera@welfareavenue.com'];
      us.forEach(function (u) { if (seen.indexOf(u.email) >= 0) u.last_seen_at = iso(now - 120000); });
      us.push({ email: ${JSON.stringify(EMAIL.toLowerCase())}, last_seen_at: iso(now - 1000), updated_at: iso(now - 1000) });
      F.user_state = us;
      F.hub_checkins = [
        { id: 1, email: 'ian.odhiambo@welfareavenue.com', name: 'Ian Odhiambo', department: 'marketing', started_at: iso(now - 90 * 60000), ended_at: null, minutes: null, source: 'hub' },
        { id: 2, email: 'ian.odhiambo@welfareavenue.com', name: 'Ian Odhiambo', department: 'marketing', started_at: iso(now - 26 * 3600000), ended_at: iso(now - 24 * 3600000), minutes: 120, source: 'hub' },
        { id: 3, email: 'shima.butera@welfareavenue.com', name: 'Shima Butera', department: 'opsmtl', started_at: iso(now - 8 * 86400000), ended_at: iso(now - 8 * 86400000 + 3 * 3600000), minutes: 180, source: 'hub' },
        { id: 4, email: 'suhaib.abdillahi@welfareavenue.com', name: 'Suhaib Abdillahi', department: 'fundraising', started_at: iso(now - 3 * 3600000), ended_at: iso(now - 3600000), minutes: 120, source: 'hub' }
      ];
      F.hub_connections = [];
    })();
  `);
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") });
    if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub });
    if (url.indexOf("fonts.g") >= 0 || url.indexOf("supabase.co/storage") >= 0) return route.continue();
    return route.abort();
  });
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
  await page.waitForTimeout(3000);
  const out = { identity: TAG };
  const go = async (h, ms) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(ms || 900); };
  const shot = async (n, clip) => page.screenshot(Object.assign({ path: path.join(shots, TAG + "_" + n + ".png") }, clip ? { clip } : { fullPage: false }));
  const vis = (sel) => page.evaluate(s => { const el = document.querySelector(s); if (!el) return null; const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0; }, sel);
  const modalOpen = () => page.evaluate(() => getComputedStyle(document.getElementById('modalBack')).display !== 'none');

  /* 1. identity bubble */
  out.header = await page.evaluate(() => {
    const pill = document.querySelector('.wa-toolbar .pill.w115pill');
    const txt = pill ? pill.textContent.replace(/\s+/g, ' ').trim() : null;
    const so = document.getElementById('signOutBtn');
    return { pill: !!pill, text: txt, signedInGone: !!pill && !/signed in/i.test(pill.textContent), who: (document.getElementById('whoName') || {}).textContent, caret: !!(pill && pill.querySelector('.w116jcaret')), avatar: !!document.querySelector('#w115btn .w115av, #w115btn img'), signOutHidden: so ? getComputedStyle(so).display === 'none' : null, signOutInPill: !!(so && pill && pill.contains(so)), cloudHidden: (function () { const c = document.getElementById('cloudStatus'); return c ? getComputedStyle(c).display === 'none' : null; })(), presence: !!document.getElementById('w116jpres'), presenceText: (document.getElementById('w116jpres') || {}).textContent, presenceAvatars: document.querySelectorAll('#w116jpres .w116av').length, presenceRings: document.querySelectorAll('#w116jpres .w116av.in').length, presenceTitle: (document.getElementById('w116jpres') || {}).title, ck: !!document.getElementById('w116jck'), ckText: (document.getElementById('w116jck') || {}).textContent };
  });
  await shot("1_header", { x: 0, y: 0, width: Number(WIDTH), height: 220 });

  /* 2. the menu from the pill */
  await page.click('.wa-toolbar .pill.w115pill .w116jcaret');
  await page.waitForTimeout(400);
  out.menu = await page.evaluate(() => { const m = document.getElementById('w115menu'); return { open: !!m && m.style.display !== 'none', items: m ? Array.from(m.querySelectorAll('.w115item, #signOutBtn')).map(b => b.textContent.trim()) : [], order: m ? Array.from(m.children).map(c => (c.getAttribute('data-w116j') || c.getAttribute('data-w115act') || c.id || c.className)) : [] }; });
  await shot("2_menu", { x: Math.max(0, Number(WIDTH) - 480), y: 0, width: 480, height: 420 });
  /* My profile */
  const mp = await page.$('#w115menu [data-w116j="profile"]');
  if (mp) { await mp.click(); await page.waitForTimeout(1200); out.myProfile = await page.evaluate(() => ({ hash: location.hash, panel: (document.querySelector('.panel.active') || {}).id, menuClosed: document.getElementById('w115menu').style.display === 'none', h2: (document.querySelector('#personpage h2') || {}).textContent })); }
  /* Notifications opens Settings on that tab */
  await page.click('.wa-toolbar .pill.w115pill .w116jcaret'); await page.waitForTimeout(300);
  const nt = await page.$('#w115menu [data-w116j="notifications"]');
  if (nt) { await nt.click(); await page.waitForTimeout(900); out.notifTab = { open: await modalOpen(), tab: await page.evaluate(() => (document.querySelector('.w116js .tabs a.on') || {}).textContent), boxes: await page.evaluate(() => document.querySelectorAll('.w116js [data-jev]').length), checked: await page.evaluate(() => document.querySelectorAll('.w116js [data-jev]:checked').length) }; await page.evaluate(() => closeModal()); }

  /* 3. Settings: connections */
  await page.click('.wa-toolbar .pill.w115pill .w116jcaret'); await page.waitForTimeout(300);
  const st = await page.$('#w115menu [data-w116j="settings"]');
  if (st) {
    await st.click(); await page.waitForTimeout(1000);
    out.settings = await page.evaluate(() => ({ open: getComputedStyle(document.getElementById('modalBack')).display !== 'none', tabs: Array.from(document.querySelectorAll('.w116js .tabs a')).map(a => a.textContent), on: (document.querySelector('.w116js .tabs a.on') || {}).textContent, rows: Array.from(document.querySelectorAll('.w116js .row b')).map(b => b.textContent), switches: Array.from(document.querySelectorAll('.w116js [data-jsw]')).map(s => s.getAttribute('data-jsw') + ':' + (s.classList.contains('on') ? 'on' : 'off')), subs: Array.from(document.querySelectorAll('.w116js .row .s')).map(s => s.textContent.slice(0, 90)), note: (document.querySelector('.w116js .note') || {}).textContent }));
    await shot("3_settings");
    /* flip the calendar switch (stub returns data null: the row should stay off and the modal stay whole) */
    await page.click('.w116js [data-jsw="google_calendar"]'); await page.waitForTimeout(900);
    out.switchAfter = await page.evaluate(() => ({ open: getComputedStyle(document.getElementById('modalBack')).display !== 'none', toast: (document.getElementById('toast') || {}).textContent, switches: Array.from(document.querySelectorAll('.w116js [data-jsw]')).map(s => s.getAttribute('data-jsw') + ':' + (s.classList.contains('on') ? 'on' : 'off')), still: !!document.querySelector('.w116js .tabs') }));
    /* account tab */
    await page.click('.w116js [data-jtab="account"]'); await page.waitForTimeout(400);
    out.account = await page.evaluate(() => ({ on: (document.querySelector('.w116js .tabs a.on') || {}).textContent, name: (document.querySelector('.w116js .acct b') || {}).textContent, pw: !!document.getElementById('w116jp1') && !!document.getElementById('w116jp2'), signout: !!document.querySelector('.w116js [data-jact="signout"]'), save: !!document.querySelector('.w116js [data-jact="setpw"]') }));
    await page.fill('#w116jp1', 'short'); await page.click('.w116js [data-jact="setpw"]'); await page.waitForTimeout(300);
    out.pwShort = await page.evaluate(() => (document.getElementById('toast') || {}).textContent);
    await page.fill('#w116jp1', 'longenough1'); await page.fill('#w116jp2', 'longenough2'); await page.click('.w116js [data-jact="setpw"]'); await page.waitForTimeout(300);
    out.pwMismatch = await page.evaluate(() => (document.getElementById('toast') || {}).textContent);
    await shot("4_account");
    /* hub inbox link closes the modal and routes */
    await page.click('.w116js [data-jtab="connections"]'); await page.waitForTimeout(300);
    const goInbox = await page.$('.w116js [data-jgo="#hubmail"]');
    if (goInbox) { await goInbox.click(); await page.waitForTimeout(900); out.goInbox = await page.evaluate(() => ({ hash: location.hash, modalClosed: getComputedStyle(document.getElementById('modalBack')).display === 'none' })); }
  }

  /* 4. check in / check out */
  if (out.header.ck) {
    await page.click('#w116jck'); await page.waitForTimeout(900);
    out.checkedIn = await page.evaluate(() => ({ cls: document.getElementById('w116jck').className, text: document.getElementById('w116jck').textContent.replace(/\s+/g, ' ').trim(), toast: (document.getElementById('toast') || {}).textContent, title: document.getElementById('w116jck').title }));
    await shot("5_checked_in", { x: 0, y: 0, width: Number(WIDTH), height: 220 });
    await page.click('#w116jck'); await page.waitForTimeout(900);
    out.checkedOut = await page.evaluate(() => ({ cls: document.getElementById('w116jck').className, text: document.getElementById('w116jck').textContent.replace(/\s+/g, ' ').trim(), toast: (document.getElementById('toast') || {}).textContent }));
  }

  /* 5. HR centre hours block */
  await go("#hrcentre", 1500);
  const hoursTab = await page.$('.w47tab[data-w47v="hours"]');
  if (hoursTab) { await hoursTab.click(); await page.waitForTimeout(1600); }
  out.hours = await page.evaluate(() => { const h = document.getElementById('w116jhours'); return { present: !!h, inHost: !!(h && h.closest('#w52hours')), h2: h ? (h.querySelector('h2') || {}).textContent : null, rows: h ? Array.from(h.querySelectorAll('.g > span:not(.h)')).map(x => x.textContent.replace(/\s+/g, ' ').trim()) : [], visible: !!(h && h.getClientRects().length) }; });
  if (out.hours.present) { const el = await page.$('#w116jhours'); if (el) { await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(200); await shot("6_hours"); } }

  /* 6. Home: Accept / Decline on my meetings */
  await go("#mypage", 1800);
  out.rsvp = await page.evaluate(() => ({ buttons: document.querySelectorAll('.w116rsvpb').length, first: (function () { const b = document.querySelector('.w116rsvpb'); return b ? Array.from(b.querySelectorAll('a')).map(a => a.textContent + '[' + a.title + ']') : null; })() }));
  const acc = await page.$('.w116rsvpb a[data-r]');
  if (acc) { await acc.click(); await page.waitForTimeout(900); out.rsvpClick = { modal: await modalOpen(), tab: await page.evaluate(() => (document.querySelector('.w116js .tabs a.on') || {}).textContent), toast: await page.evaluate(() => (document.getElementById('toast') || {}).textContent) }; await page.evaluate(() => closeModal()); }
  await shot("7_home_meetings");

  /* 7. presence still alive after navigation; the classic 'Cloud connected' text is nowhere */
  out.final = await page.evaluate(() => ({ cloudText: Array.from(document.querySelectorAll('.wa-toolbar .pill')).map(p => p.textContent.replace(/\s+/g, ' ').trim()), presenceCount: (document.querySelector('#w116jpres .n b') || {}).textContent }));
  out.errors = errs;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
