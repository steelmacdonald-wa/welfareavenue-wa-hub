/* wave116l drive: Workspace accounts card in People and access */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", TAG = "steel", WIDTH = "1366"] = process.argv;

(async () => {
  const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  const shots = path.join(__dirname, "shots_p116l");
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
      try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa262.seen', '1'); } catch (e) {}
      window.__CALLS = [];
      /* the edge functions this wave talks to, answered locally */
      window.__WA_FN = function (name, body) {
        window.__CALLS.push({ name: name, body: body });
        var now = new RealDate(FIXED).toISOString(); var ago = function (d) { return new RealDate(FIXED - d * 86400000).toISOString(); };
        if (name === 'directory-sync') {
          if (body.action === 'status') return { ok: true, state: { last_sync_at: ago(0.2), last_result: { users: 31, matched: 24, queued: 2, skipped: 4, photos: 3, deactivated: ['Rami'] }, last_error: window.__DS_ERR || null }, rows: [
            { email: 'daniela.pidi@welfareavenue.com', full_name: 'Daniela Pidi', title: 'Finance lead', account_created_at: ago(3), last_login_at: ago(1), first_seen_at: ago(0.2), member_id: null, dismissed: false, skipped: false, suspended: false },
            { email: 'karan.singh@welfareavenue.com', full_name: 'Karan Singh', title: '', account_created_at: ago(30), last_login_at: ago(2), first_seen_at: ago(0.2), member_id: null, dismissed: false, skipped: false, suspended: false },
            { email: 'tuna.kaynak@welfareavenue.com', full_name: 'Tuna Kaynak', title: '', account_created_at: ago(30), last_login_at: ago(2), first_seen_at: ago(0.2), member_id: null, dismissed: false, skipped: false, suspended: false },
            { email: 'new.person@welfareavenue.com', full_name: 'New Person', title: '', account_created_at: ago(1), last_login_at: null, first_seen_at: ago(0.2), member_id: null, dismissed: !!window.__DISMISSED, skipped: false, suspended: false },
            { email: 'hub@welfareavenue.com', full_name: 'Hub', title: '', first_seen_at: ago(0.2), member_id: null, dismissed: false, skipped: true, suspended: false },
            { email: 'rami.al-siq@welfareavenue.com', full_name: 'Rami Al-Siq', first_seen_at: ago(0.2), member_id: 28, dismissed: false, skipped: false, suspended: true, deactivated_member_id: 28, deactivated_at: ago(0.2) },
            { email: 'steel.macdonald@welfareavenue.com', full_name: 'Steel MacDonald', first_seen_at: ago(0.2), member_id: 37, dismissed: false, skipped: false, suspended: false, photo_applied_at: ago(0.2) }
          ] };
          if (body.action === 'sync') return { ok: true, result: { users: 31, matched: 24, queued: 2, skipped: 4, photos: 0, deactivated: [], reactivated: [], new_in_queue: [] } };
          if (body.action === 'place') return { ok: true, member_id: body.member_id || 99, name: 'x', photo: 'applied' };
          if (body.action === 'dismiss') { window.__DISMISSED = !body.undo; return { ok: true }; }
        }
        if (name === 'hub-invite') {
          if (body.action === 'set_email') return { ok: true, member_id: body.member_id, email: body.email };
          if (body.action === 'invite') return { ok: true, email: body.email, name: body.name, member_id: 99, email_sent: !!body.send_email, note: body.send_email ? null : 'not requested', slack: 'no_slack', existed: false, hub_role: body.hub_role || 'member' };
        }
        return null;
      };
    })();
  `);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") });
    if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) {
      /* the stub, plus a functions.invoke that answers from window.__WA_FN when it knows the function */
      const patched = stub + "\n;(function(){ try { var mk = window.supabase && window.supabase.createClient; if (!mk) return; window.supabase.createClient = function () { var c = mk.apply(this, arguments); var orig = c.functions.invoke.bind(c.functions); c.functions.invoke = async function (name, opts) { var body = (opts && opts.body) || {}; var r = window.__WA_FN ? window.__WA_FN(name, body) : null; if (r) return { data: r, error: null }; return orig(name, opts); }; return c; }; } catch (e) {} })();";
      return route.fulfill({ contentType: "application/javascript", body: patched });
    }
    if (url.indexOf("fonts.g") >= 0 || url.indexOf("supabase.co/storage") >= 0) return route.continue();
    return route.abort();
  });
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
  await page.waitForTimeout(2600);
  const out = { identity: TAG };
  const go = async (h, ms) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(ms || 900); };
  const shot = async (n, full) => page.screenshot({ path: path.join(shots, TAG + "_" + n + ".png"), fullPage: !!full });
  const card = () => page.evaluate(() => { const c = document.getElementById('w116lcard'); if (!c) return { present: false }; const q = s => c.querySelector(s); const qa = s => Array.from(c.querySelectorAll(s)); const t = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : null; return { present: true, beforePeople: !!(c.nextElementSibling && c.nextElementSibling.id === 'w113card'), badge: t(q('h2 .n')), bar: t(q('.bar')), err: t(q('.err')), queue: qa('.q .r:not(.off) .who b').map(t), queueMeta: qa('.q .r:not(.off) .who span').map(t), left: t(q('.left')), dismissedLink: t(q('[data-w116l="toggledis"]')), buttons: qa('[data-w116l]').map(b => b.getAttribute('data-w116l')) }; });

  await go('#adminpanel', 2500);
  out.card = await card();
  await shot("1_card", true);

  /* place Alexis: the modal should propose the roster's Alexis (no email) */
  const place = await page.$('#w116lcard [data-w116l="place"][data-email="daniela.pidi@welfareavenue.com"]');
  if (place) {
    await place.click(); await page.waitForTimeout(500);
    out.modal = await page.evaluate(() => ({ open: getComputedStyle(document.getElementById('modalBack')).display !== 'none', title: (document.querySelector('#modalBack h3') || {}).textContent, selected: (function () { const s = document.getElementById('w116lex'); return s ? s.options[s.selectedIndex].textContent : null; })(), options: document.getElementById('w116lex') ? document.getElementById('w116lex').options.length : 0, newFormHidden: document.getElementById('w116lnew') ? getComputedStyle(document.getElementById('w116lnew')).display === 'none' : null, hint: (document.querySelector('.w116lm .hint') || {}).textContent, teams: Array.from(document.querySelectorAll('#w116ld option')).map(o => o.value) }));
    await shot("2_modal");
    await page.click('#w116lgo'); await page.waitForTimeout(1200);
    out.linked = await page.evaluate(() => ({ res: (document.querySelector('#w116lout .res') || {}).textContent, calls: window.__CALLS.filter(c => c.name !== 'directory-sync' || c.body.action !== 'status').map(c => c.name + ':' + c.body.action + (c.body.member_id ? ':' + c.body.member_id : '')) }));
    await page.evaluate(() => closeModal());
  }
  /* new person: create a profile in Program Development */
  const place2 = await page.$('#w116lcard [data-w116l="place"][data-email="new.person@welfareavenue.com"]');
  if (place2) {
    await place2.click(); await page.waitForTimeout(500);
    out.modal2 = await page.evaluate(() => ({ selected: (function () { const s = document.getElementById('w116lex'); return s ? s.value : null; })(), newFormShown: getComputedStyle(document.getElementById('w116lnew')).display !== 'none' }));
    await page.selectOption('#w116ld', 'progdev'); await page.fill('#w116lr', 'Research volunteer'); await page.selectOption('#w116lh', 'member');
    await page.evaluate(() => { window.__CALLS = []; });
    await page.click('#w116lgo'); await page.waitForTimeout(1200);
    out.created = await page.evaluate(() => ({ res: (document.querySelector('#w116lout .res') || {}).textContent, calls: window.__CALLS.filter(c => !(c.name === 'directory-sync' && c.body.action === 'status')).map(c => c.name + ':' + c.body.action + ':' + (c.body.department || '') + ':' + (c.body.role_title || '') + ':' + (c.body.send_email)) }));
    await page.evaluate(() => closeModal());
  }
  /* bulk link */
  const bulk = await page.$('#w116lcard [data-w116l="bulk"]');
  if (bulk) {
    out.bulkButton = await bulk.textContent();
    await bulk.click(); await page.waitForTimeout(500);
    out.bulk = await page.evaluate(() => Array.from(document.querySelectorAll('.w116lb .brow')).map(r => ({ who: r.querySelector('.who b').textContent, checked: r.querySelector('input').checked, disabled: r.querySelector('input').disabled, pick: r.querySelector('select') ? r.querySelector('select').options[r.querySelector('select').selectedIndex].textContent : null, warn: !!r.querySelector('.warn') })));
    await page.evaluate(() => { window.__CALLS = []; });
    await page.click('#w116lbgo'); await page.waitForTimeout(1500);
    out.bulkResult = await page.evaluate(() => ({ out: (document.getElementById('w116lbout') || {}).textContent, calls: window.__CALLS.filter(c => !(c.name === 'directory-sync' && c.body.action === 'status')).map(c => c.name + ':' + c.body.action + ':' + (c.body.member_id || '')) }));
    await shot("4_bulk");
    await page.evaluate(() => closeModal());
  }
  /* dismiss */
  const dis = await page.$('#w116lcard [data-w116l="dismiss"][data-email="new.person@welfareavenue.com"]');
  if (dis) { await dis.click(); await page.waitForTimeout(900); out.afterDismiss = await card(); const tg = await page.$('#w116lcard [data-w116l="toggledis"]'); if (tg) { await tg.click(); await page.waitForTimeout(300); out.dismissedList = await page.evaluate(() => Array.from(document.querySelectorAll('#w116lcard .q .r.off .who b')).map(b => b.textContent)); } }
  /* sync button */
  await page.click('#w116lcard [data-w116l="sync"]'); await page.waitForTimeout(1200);
  out.sync = await page.evaluate(() => ({ toast: (document.getElementById('toast') || {}).textContent }));
  /* an error from the last run shows with a clickable link */
  await page.evaluate(() => { window.__DS_ERR = 'Google /users -> 403 Admin SDK API has not been used in project 939437859037 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/admin.googleapis.com/overview?project=939437859037'; });
  await page.click('#w116lcard [data-w116l="sync"]'); await page.waitForTimeout(1200);
  out.errShown = await page.evaluate(() => ({ err: (document.querySelector('#w116lcard .err') || {}).textContent, link: !!document.querySelector('#w116lcard .err a') }));
  await shot("3_error", true);
  out.errors = errs;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
