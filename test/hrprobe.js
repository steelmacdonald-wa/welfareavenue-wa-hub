/* probe: what is the HR centre doing over time? mutations per second, errors, screenshots */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", TAG = "steel", HASH = "#hrcentre", FILE = "../build/candidate.html"] = process.argv;
(async () => {
  const html = fs.readFileSync(path.join(__dirname, FILE), "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  const shots = path.join(__dirname, "shots_hr"); fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("PAGEERROR: " + String(e).slice(0, 400)));
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") { const t = m.text(); if (t.indexOf('ERR_FAILED') < 0) errs.push(m.type() + ": " + t.slice(0, 300)); } });
  await page.addInitScript(`(function(){ var FIXED = new Date(${JSON.stringify(FIXED_TIME)}).getTime(); var RealDate = Date; function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } } FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate; window.__WA_TEST_ROLE = ${JSON.stringify(ROLE)}; window.__WA_TEST_EMAIL = ${JSON.stringify(EMAIL)}; window.__WA_TEST_NAME = ${JSON.stringify(NAME)}; window.confirm = function(){ return false; }; window.alert = function(){}; try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa262.seen', '1'); } catch (e) {} })();`);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.route("**/*", route => { const url = route.request().url(); if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html }); if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") }); if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub }); return route.abort(); });
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  await page.evaluate(h => { location.hash = h; }, HASH);
  await page.waitForTimeout(1500);
  const out = { hash: HASH, file: FILE };
  /* count mutations inside the panel over 4 seconds, and where they come from */
  out.mutations = await page.evaluate(() => new Promise(res => { const sec = document.querySelector('.panel.active') || document.body; const counts = {}; let n = 0; const mo = new MutationObserver(ms => { ms.forEach(m => { n++; const t = m.target; const k = (t.id ? '#' + t.id : '') + '.' + String(t.className || '').split(' ').slice(0, 2).join('.'); counts[k] = (counts[k] || 0) + 1; }); }); mo.observe(sec, { childList: true, subtree: true, attributes: true, characterData: true }); setTimeout(() => { mo.disconnect(); const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12); res({ total: n, panel: sec.id, top }); }, 4000); }));
  out.active = await page.evaluate(() => (document.querySelector('.panel.active') || {}).id);
  out.hash_now = await page.evaluate(() => location.hash);
  await page.screenshot({ path: path.join(shots, TAG + '_1.png'), fullPage: false });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(shots, TAG + '_2.png'), fullPage: false });
  out.hero = await page.evaluate(() => { const h = document.getElementById('w116phero'); return h ? { display: getComputedStyle(h).display, h: h.offsetHeight, text: h.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) } : null; });
  out.tabs = await page.evaluate(() => Array.from(document.querySelectorAll('#hrcentre [data-w47v]')).map(t => t.getAttribute('data-w47v') + (t.classList.contains('on') || t.classList.contains('active') ? '*' : '')));
  out.visible_sections = await page.evaluate(() => Array.from(document.querySelectorAll('#hrcentre .w46sec, #hrcentre .w116ppeople, #hrcentre #w116ppeople')).filter(e => e.offsetParent !== null).map(e => (e.id ? '#' + e.id : '') + '.' + String(e.className).split(' ').slice(0, 2).join('.') + ' ' + e.offsetHeight + 'px'));
  out.panel_height = await page.evaluate(() => (document.getElementById('hrcentre') || {}).scrollHeight);
  out.scroll_width = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  /* click through the tabs */
  const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('#hrcentre [data-w47v]')).map(t => t.getAttribute('data-w47v')));
  out.tab_results = [];
  for (const t of tabs) {
    await page.evaluate(v => { const el = document.querySelector('#hrcentre [data-w47v="' + v + '"]'); if (el) el.click(); }, t);
    await page.waitForTimeout(900);
    const r = await page.evaluate(v => { const vis = Array.from(document.querySelectorAll('#hrcentre > * , #hrcentre .card > *')).filter(e => e.offsetParent !== null && e.offsetHeight > 40).map(e => (e.id ? '#' + e.id : '') + '.' + String(e.className).split(' ').slice(0, 2).join('.') + ':' + e.offsetHeight); return { tab: v, hash: location.hash, active: (document.querySelector('.panel.active') || {}).id, vis: vis.slice(0, 8), height: document.getElementById('hrcentre').scrollHeight }; }, t);
    out.tab_results.push(r);
    await page.screenshot({ path: path.join(shots, TAG + '_tab_' + t + '.png'), fullPage: false });
  }
  out.errors = errs;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch(e => { console.error("PROBE FAILED", e); process.exit(1); });
