/* sections.js [candidate] [role email name]: list the visible sections (heading-bearing blocks) of each hub page, for writing page tours */
const fs = require("fs"); const path = require("path"); const { chromium } = require("playwright");
const [, , FILE = "../build/candidate.html", ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald"] = process.argv;
const HASHES = (process.env.HASHES || "#mypage,#team/opsmtl,#team/opsmtl/tasks,#team/opsmtl/agenda,#overview,#dashboard,#orggoals,#goals,#projects,#goalmap,#requests,#transcripts,#agendas,#hubmail,#orgchart,#training,#volunteering,#hrcentre,#finances,#contentcal,#socialstats,#create,#brain,#importantinfo,#needsme,#activity,#adminpanel").split(",");
(async () => {
  const html = fs.readFileSync(path.join(__dirname, FILE), "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; page.on("pageerror", e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(`(function(){ var FIXED = new Date("2026-08-06T12:00:00-04:00").getTime(); var RealDate = Date; function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } } FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate; window.__WA_TEST_ROLE = ${JSON.stringify(ROLE)}; window.__WA_TEST_EMAIL = ${JSON.stringify(EMAIL)}; window.__WA_TEST_NAME = ${JSON.stringify(NAME)}; window.confirm = function(){ return true; }; try { localStorage.setItem('wa84tour', '1'); } catch (e) {} })();`);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.route("**/*", route => { const url = route.request().url(); if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html }); if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") }); if (url.indexOf("chart.umd") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "chart.umd.min.js"), "utf8") }); if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub }); return route.abort(); });
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const out = {};
  for (const h of HASHES) {
    await page.evaluate(x => { location.hash = x; }, h);
    await page.waitForTimeout(2200);
    out[h] = await page.evaluate(() => {
      const p = document.querySelector('.panel.active'); if (!p) return { panel: null };
      const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 8 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
      const d = el => { const r = el.getBoundingClientRect(); return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + Array.from(el.classList).slice(0,3).join('.') : '') + '[' + Math.round(r.height) + 'x' + Math.round(r.width) + ']'; };
      const txt = el => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70);
      const rows = [];
      const walk = (el, depth) => {
        const kids = Array.from(el.children).filter(c => !/^(SCRIPT|STYLE|TEMPLATE)$/.test(c.tagName) && vis(c));
        kids.forEach(c => {
          const r = c.getBoundingClientRect();
          rows.push('  '.repeat(depth) + d(c) + ' :: ' + txt(c));
          const big = r.height > 350 && depth < 5;
          const single = kids.length === 1 && depth < 6;
          if (big || single) walk(c, depth + 1);
        });
      };
      walk(p, 0);
      return { panel: p.id, rows };
    });
  }
  fs.writeFileSync(process.env.OUT || "/tmp/sections.json", JSON.stringify(out, null, 1));
  for (const h of HASHES) { const o = out[h]; console.log("=== " + h + " -> " + o.panel); (o.rows || []).slice(0, 140).forEach(r => console.log(r)); }
  console.log("errs", JSON.stringify(errs.slice(0, 5)));
  await browser.close();
})();
