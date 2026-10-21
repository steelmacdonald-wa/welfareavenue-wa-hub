/* find_text.js <case> <width> <hash> <text> : screenshot the viewport with the element containing text scrolled into view */
const fs = require("fs"); const path = require("path"); const { chromium } = require("playwright");
const [, , CASE, WIDTH, HASH, TEXT, OUTF] = process.argv;
const C = { admin: { email: "steel.macdonald@welfareavenue.com", name: "Steel MacDonald", role: "staff" }, board: { email: "consult.tamaraangeline@gmail.com", name: "Tamara Angeline", role: "board" } }[CASE];
const T = "/root/wa-hub/test/";
const html = fs.readFileSync(T + "../build/candidate.html", "utf8"), stub = fs.readFileSync(T + "stub_supabase.js", "utf8"), gen = fs.readFileSync(T + "w129data.js", "utf8");
const fx = JSON.parse(fs.readFileSync("/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/fixture_live.json", "utf8"));
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: Number(WIDTH), height: Number(WIDTH) < 700 ? 844 : 900 }, isMobile: Number(WIDTH) < 700, hasTouch: Number(WIDTH) < 700 });
  const page = await ctx.newPage();
  await page.addInitScript(`(function(){ var FIXED = new Date("2026-09-25T16:00:00-04:00").getTime(); var RealDate = Date; function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } } FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate; window.__WA_TEST_ROLE = ${JSON.stringify(C.role)}; window.__WA_TEST_EMAIL = ${JSON.stringify(C.email)}; window.__WA_TEST_NAME = ${JSON.stringify(C.name)}; try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa262.seen', '1'); localStorage.setItem('wa112done', '1'); } catch (e) {} })();`);
  await page.addInitScript("window.__WAFIX = " + JSON.stringify(fx) + ";"); await page.addInitScript(gen);
  await page.route("**/*", route => { const url = route.request().url(); if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html }); if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub }); return route.abort(); });
  await page.goto("http://wahub.test/" + HASH, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 25000 });
  await page.waitForTimeout(3500);
  await page.evaluate(() => { document.querySelectorAll('body *').forEach(el => { const t = el.textContent || ''; const st = getComputedStyle(el); if ((st.position === 'fixed' || st.position === 'absolute') && (/STARTING A SESSION|Meet Ask the Hub/i.test(t)) && t.length < 400) el.remove(); }); });
  const found = await page.evaluate(t => { const all = Array.from(document.querySelectorAll('.panel.active *')).filter(e => e.children.length < 3 && (e.innerText || '').indexOf(t) >= 0 && e.offsetParent); const el = all[all.length - 1] || all[0]; if (!el) return false; el.scrollIntoView({ block: 'center' }); return true; }, TEXT);
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUTF });
  console.log(found ? 'found' : 'not found');
  await browser.close();
})();
