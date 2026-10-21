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
  const shots = path.join(__dirname, "shots_p116j2");
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
      /* hub-connect answered locally: Slack unresolved until the person picks */
      window.__WA_FN = function (name, body) {
        window.__CALLS.push({ name: name, body: body });
        if (name === 'hub-connect') {
          if (body.action === 'status') return { ok: true, email: 'steel.macdonald@welfareavenue.com', connections: window.__SLACK ? { slack: { provider: 'slack', enabled: true, external_id: window.__SLACK.id, external_name: window.__SLACK.name, meta: { handle: window.__SLACK.handle }, last_ok_at: new Date().toISOString() } } : {} };
          if (body.action === 'toggle' && body.provider === 'slack') return { ok: false, pick: true, error: 'No Slack account matches steel.macdonald@welfareavenue.com by email or name. Choose your account from the list.' };
          if (body.action === 'toggle') return { ok: true, detail: 'x' };
          if (body.action === 'slack_users') return { ok: true, users: [{ id: 'U02308AHH9N', name: 'Steel MacDonald', handle: 'steel', title: 'Founder' }, { id: 'U0A7DF871FS', name: 'Ian Odhiambo', handle: 'ian.odhiambo', title: '' }, { id: 'U0AQEHR4E31', name: 'Suhaib Abdillahi', handle: 'suhaib', title: 'Co-ED' }] };
          if (body.action === 'slack_pick') { window.__SLACK = { id: body.slack_id, name: 'Steel MacDonald', handle: 'steel' }; return { ok: true, slack: window.__SLACK }; }
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

  /* open Settings from the profile menu, flip the Slack switch: the picker appears */
  await page.click('.wa-toolbar .pill.w115pill .w116jcaret'); await page.waitForTimeout(300);
  await page.click('#w115menu [data-w116j="settings"]'); await page.waitForTimeout(1000);
  out.before = await page.evaluate(() => ({ slackSub: (document.querySelector('.w116js .row .s') || {}).textContent, pickLink: !!document.querySelector('.w116js [data-jslackpick="1"]'), picker: !!document.getElementById('w116jspick') }));
  await page.click('.w116js [data-jsw="slack"]'); await page.waitForTimeout(1200);
  out.afterToggle = await page.evaluate(() => ({ toast: (document.getElementById('toast') || {}).textContent, picker: !!document.getElementById('w116jspick'), rows: Array.from(document.querySelectorAll('#w116jspick .list a b')).map(b => b.textContent) }));
  await shot("1_picker");
  await page.fill('#w116jsq', 'suh'); await page.waitForTimeout(300);
  out.filtered = await page.evaluate(() => Array.from(document.querySelectorAll('#w116jspick .list a b')).map(b => b.textContent));
  await page.fill('#w116jsq', 'steel'); await page.waitForTimeout(300);
  await page.click('#w116jspick .list a[data-jslackid="U02308AHH9N"]'); await page.waitForTimeout(1200);
  out.afterPick = await page.evaluate(() => ({ toast: (document.getElementById('toast') || {}).textContent, picker: !!document.getElementById('w116jspick'), slackSub: (document.querySelector('.w116js .row .s') || {}).textContent, sw: (document.querySelector('.w116js [data-jsw="slack"]') || {}).className, calls: window.__CALLS.filter(c => c.name === 'hub-connect').map(c => c.body.action + (c.body.slack_id ? ':' + c.body.slack_id : '')) }));
  await shot("2_connected");
  out.errors = errs;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
