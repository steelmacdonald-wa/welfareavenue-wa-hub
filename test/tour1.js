/* tour1.js <key> [role email name]: run one page tour step by step and print what each step highlighted */
const fs = require("fs"); const path = require("path"); const { chromium } = require("playwright");
const [, , KEY = "chrome", ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald"] = process.argv;
const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8"), stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8"), fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; page.on("pageerror", e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(`(function(){ var FIXED = new Date("2026-08-06T12:00:00-04:00").getTime(); var RealDate = Date; function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } } FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate; window.__WA_TEST_ROLE = ${JSON.stringify(ROLE)}; window.__WA_TEST_EMAIL = ${JSON.stringify(EMAIL)}; window.__WA_TEST_NAME = ${JSON.stringify(NAME)}; window.confirm = function(){ return true; }; try { localStorage.setItem('wa84tour', '1'); } catch (e) {} })();`);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.route("**/*", route => { const url = route.request().url(); if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html }); if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") }); if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub }); return route.abort(); });
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
  await page.waitForTimeout(2000);
  const keys = KEY === "all" ? await page.evaluate(() => Object.keys(w122.tours).filter(k => w122.tourAvail(k))) : KEY.split(",");
  const summary = {};
  for (const key of keys) {
    await page.evaluate(() => { location.hash = '#training'; }); await page.waitForTimeout(900);
    await page.evaluate(k => w122.startTour(k), key);
    const rows = []; let last = -2, same = 0;
    for (let j = 0; j < 60; j++) {
      await page.waitForTimeout(350);
      const st = await page.evaluate(() => { const s = w122.state().T; if (!s) return null; const hole = document.querySelector('.w122tp .hole'); return { i: s.i, n: s.steps.length, busy: s.busy, el: !!(s.el && s.el.isConnected) && hole && !hole.classList.contains('none'), hash: location.hash, t: (document.querySelector('.w122tp .pop h4') || {}).textContent }; });
      if (!st) break;
      if (st.busy) continue;
      if (st.i === last) { if (++same > 8) { rows.push({ i: st.i, t: st.t, stuck: true }); break; } continue; }
      same = 0; last = st.i; rows.push({ i: st.i, t: st.t, el: st.el, hash: st.hash });
      if (process.env.SHOTS) await page.screenshot({ path: path.join(__dirname, "shots_p122", "tour_" + key + "_" + st.i + ".png") });
      await page.evaluate(() => { const b = document.querySelector('.w122tp [data-w122tnext]'); if (b) b.click(); });
    }
    await page.waitForTimeout(900);
    const cel = await page.evaluate(() => { const c = document.getElementById('w122cel'); const h = c ? c.querySelector('h3').textContent : null; if (c) c.remove(); return h; });
    const n = await page.evaluate(k => w122.tours[k].steps.length, key);
    const shown = rows.filter(r => r.el).length, cent = rows.filter(r => !r.el && !r.stuck).map(r => r.t), stuck = rows.filter(r => r.stuck);
    summary[key] = { n, shown, centred: cent, skipped: n - rows.filter(r => !r.stuck).length, finished: cel };
    if (process.env.DEBUG) console.log(JSON.stringify(rows));
    console.log("TOUR " + key + ": " + shown + "/" + n + " highlighted, skipped " + (n - rows.filter(r => !r.stuck).length) + (cent.length ? " | centred: " + cent.join(" / ") : "") + (stuck.length ? " | STUCK at " + stuck[0].i : "") + " -> " + cel);
  }
  fs.writeFileSync(path.join(__dirname, "shots_p122", "tours_" + ROLE + ".json"), JSON.stringify(summary, null, 1));
  console.log("errs", JSON.stringify(errs.slice(0, 6)));
  await browser.close();
})();
