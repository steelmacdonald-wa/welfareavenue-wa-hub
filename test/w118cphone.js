/* wave118c phone screenshots (390 x 844) */
const fs = require("fs"); const path = require("path"); const { chromium } = require("playwright");
const [, , CAND, OUT] = process.argv;
(async () => {
  const html = fs.readFileSync(CAND, "utf8"), stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8"), fixture = (function () { const fx = JSON.parse(fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8")); const ph = JSON.parse(fs.readFileSync(path.join(__dirname, "fixture_photos.json"), "utf8")); fx.wa_photos_list = ph.wa_photos_list; fx.wa_photos = ph.wa_photos; return JSON.stringify(fx); })();
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; page.on("pageerror", e => errs.push(String(e)));
  await page.addInitScript("window.__WA_TEST_ROLE='staff';window.__WA_TEST_EMAIL='steel.macdonald@welfareavenue.com';window.__WA_TEST_NAME='Steel MacDonald';window.confirm=function(){return true;};try{localStorage.setItem('wa84tour','1');localStorage.setItem('w118bSnooze',String(Date.now()+86400000));}catch(e){}");
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.route("**/*", r => { const u = r.request().url(); if (u.startsWith("http://wahub.test/")) return r.fulfill({ contentType: "text/html", body: html }); if (u.indexOf("supabase-js") >= 0 || u.indexOf("@supabase") >= 0) return r.fulfill({ contentType: "application/javascript", body: stub }); if (u.indexOf("fonts.g") >= 0 || u.indexOf("supabase.co/storage") >= 0) return r.continue(); return r.abort(); });
  await page.goto("http://wahub.test/"); await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 }); await page.waitForTimeout(2500);
  const shot = n => page.screenshot({ path: path.join(OUT, n + ".png") });
  await page.evaluate(() => { location.hash = "#photos"; }); await page.waitForTimeout(2200); await shot("p1_page");
  await page.evaluate(() => window.scrollTo(0, 700)); await page.waitForTimeout(900); await shot("p2_grid");
  const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, vw: window.innerWidth }));
  console.log("horizontal scroll:", w.doc > w.vw ? "YES " + JSON.stringify(w) : "none");
  await page.evaluate(() => { location.hash = "#photos/2022-02-winter-volunteer-group-b"; }); await page.waitForTimeout(1800); await shot("p3_drawer");
  await page.evaluate(() => { const b = document.querySelector('#w118cdr .bd'); if (b) b.scrollTop = 900; }); await page.waitForTimeout(400); await shot("p4_details");
  await page.evaluate(() => { const b = document.querySelector('#w118cdr [data-w118cact="edit"]'); if (b) b.click(); }); await page.waitForTimeout(900); await shot("p5_edit");
  await page.evaluate(() => { location.hash = "#photos/new"; }); await page.waitForTimeout(1200); await shot("p6_add");
  await page.evaluate(() => { window.__wa118c.pick({ title: "Pick a photo for the graphic" }); }); await page.waitForTimeout(1500); await shot("p7_picker");
  console.log("errors", errs.length, errs.slice(0, 3)); await browser.close();
})();
