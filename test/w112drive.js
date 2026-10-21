/* wave112 drives: getting-started checklist (harness-style loader) */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", TAG = "steel"] = process.argv;

(async () => {
  const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  const shots = path.join(__dirname, "shots_p112");
  fs.mkdirSync(shots, { recursive: true });

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("PAGEERROR: " + String(e).slice(0, 300)));

  await page.addInitScript(`
    (function(){
      var FIXED = new Date(${JSON.stringify(FIXED_TIME)}).getTime();
      var RealDate = Date;
      function FDate(a,b,c,d,e,f,g){
        if (!(this instanceof FDate)) return new RealDate(FIXED).toString();
        switch (arguments.length) {
          case 0: return new RealDate(FIXED);
          case 1: return new RealDate(a);
          default: return new RealDate(a,b,c,d,e,f,g);
        }
      }
      FDate.now = function(){ return FIXED; };
      FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC;
      FDate.prototype = RealDate.prototype;
      window.Date = FDate;
      window.__WA_TEST_ROLE = ${JSON.stringify(ROLE)};
      window.__WA_TEST_EMAIL = ${JSON.stringify(EMAIL)};
      window.__WA_TEST_NAME = ${JSON.stringify(NAME)};
      window.confirm = function(){ return true; };
      window.alert = function(){};
      try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa262.seen', '1'); } catch (e) {}
    })();
  `);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") });
    if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub });
    return route.abort();
  });

  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
  await page.waitForTimeout(1500);

  const out = { identity: TAG };
  const state = () => page.evaluate(() => {
    const c = document.getElementById("w112card");
    return {
      card: !!c,
      pill: !!document.getElementById("w112pill"),
      count: c ? (c.querySelector(".w112count") || {}).textContent : null,
      done: c ? Array.from(c.querySelectorAll(".w112step.done input")).map(i => i.getAttribute("data-w112cb")) : [],
      steps: c ? Array.from(c.querySelectorAll(".w112step input")).map(i => i.getAttribute("data-w112cb")) : [],
      toast: (document.getElementById("toast") || {}).textContent || ""
    };
  });

  await page.evaluate(() => { location.hash = "#mypage"; });
  await page.waitForTimeout(1200);
  out.fresh = await state();
  out.debug = await page.evaluate(() => (window.w112Debug ? window.w112Debug() : null));
  await page.screenshot({ path: path.join(shots, TAG + "_1_fresh.png") });

  if (out.fresh.card) {
    /* auto: Important info */
    if (out.fresh.steps.indexOf("info") >= 0) {
      await page.evaluate(() => { location.hash = "#importantinfo"; });
      await page.waitForTimeout(700);
      out.infoToast = (await state()).toast;
    }
    /* auto: own department */
    if (out.fresh.steps.indexOf("dept") >= 0) {
      await page.evaluate(() => { const d = WA_ME && WA_ME.department; location.hash = "#dept/" + (d || "opsmtl"); });
      await page.waitForTimeout(700);
    }
    /* auto: ask the Hub (open via the card button, then send) */
    await page.evaluate(() => { location.hash = "#mypage"; });
    await page.waitForTimeout(900);
    const ask = await page.$('[data-w112go="brain"]');
    if (ask) {
      await ask.click();
      await page.waitForTimeout(300);
      out.brainPrefill = await page.evaluate(() => { const i = document.getElementById("w38in") || document.getElementById("wacInput"); return i ? i.value : null; });
      await page.keyboard.press("Enter");
      await page.waitForTimeout(700);
      await page.evaluate(() => { const b = document.getElementById("waChatBtn"); const p = document.getElementById("waChatPanel"); if (b && p && p.style.display === "flex") b.click(); });
    }
    await page.evaluate(() => { location.hash = "#mypage"; });
    await page.waitForTimeout(900);
    out.afterAuto = await state();
    await page.screenshot({ path: path.join(shots, TAG + "_2_after_auto.png") });

    /* manual tick + untick */
    await page.click('#w112card input[data-w112cb="task"]');
    await page.waitForTimeout(300);
    out.manualTask = (await state()).done;
    await page.click('#w112card input[data-w112cb="task"]');
    await page.waitForTimeout(300);
    out.manualUntick = (await state()).done;

    /* auto: task via toggleTask (first open task, in memory) */
    await page.evaluate(async () => { const t = DB_TASKS.find(x => !x.done); if (t) await toggleTask(t.id, true); });
    await page.waitForTimeout(500);
    out.afterToggle = (await state()).done;

    /* hide for now then show */
    await page.click("[data-w112hide]");
    await page.waitForTimeout(200);
    out.hidden = await state();
    await page.screenshot({ path: path.join(shots, TAG + "_3_hidden_pill.png") });
    await page.click("[data-w112open]");
    await page.waitForTimeout(200);

    /* profile: finish the last step and see completion */
    const hasProfile = (await state()).steps.indexOf("profile") >= 0;
    if (hasProfile) {
      const myId = await page.evaluate(() => window.w112Debug().myId);
      out.myId = myId;
      if (myId) {
        await page.evaluate(id => { location.hash = "#person/" + id; }, myId);
        await page.waitForTimeout(900);
      } else {
        await page.click('#w112card input[data-w112cb="profile"]');
      }
    }
    await page.evaluate(() => { location.hash = "#mypage"; });
    await page.waitForTimeout(1000);
    out.complete = await page.evaluate(() => {
      const c = document.getElementById("w112card");
      return { card: !!c, all: !!(c && c.classList.contains("w112all")), text: c ? c.querySelector("h3").textContent : null, row: window.w112Debug().row };
    });
    await page.screenshot({ path: path.join(shots, TAG + "_4_complete.png") });
    const close = await page.$("[data-w112close]");
    if (close) { await close.click(); await page.waitForTimeout(200); }
    out.afterClose = await state();
  }

  out.errors = errs;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
