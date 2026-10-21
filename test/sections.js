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
  await page.addInitScript(`(function(){ var FIXED = new Date("2026-08-06T12:00:00-04:00").getTime(); var RealDate = Date; function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } } FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate; window.__WA_TEST_ROLE = ${JSON.stringify(ROLE)}; window.__WA_TEST_EMAIL = ${JSON.stringify(EMAIL)}; window.__WA_TEST_NAME = ${JSON.stringify(NAME)}; window.confirm = function(){ return true; }; try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa262.seen', '1'); } catch (e) {} })();`);
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
      const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
      const sel = el => { const parts = []; let e = el; while (e && e !== p) { let s = e.tagName.toLowerCase(); if (e.id) { parts.unshift('#' + e.id); return parts.join(' > '); } const cls = Array.from(e.classList).filter(c => !/^(on|active|open|hide|show)$/.test(c)).slice(0, 2); if (cls.length) s += '.' + cls.join('.'); parts.unshift(s); e = e.parentElement; } return '#' + p.id + ' > ' + parts.join(' > '); };
      const rows = [];
      p.querySelectorAll('h1,h2,h3,h4,summary,.w116crumb,.w118mast').forEach(hd => {
        if (!vis(hd)) return;
        const box = hd.closest('.card,.w116card,details,section,.w118mast,.w119sec,.w120card,.w121card,[class*="card"]') || hd.parentElement;
        const r = box.getBoundingClientRect();
        const t = (hd.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70);
        if (!t) return;
        rows.push({ tag: hd.tagName.toLowerCase(), t, box: sel(box), hsel: sel(hd), y: Math.round(r.top + scrollY), h: Math.round(r.height), w: Math.round(r.width) });
      });
      return { panel: p.id, rows };
    });
  }
  fs.writeFileSync(process.env.OUT || "/tmp/sections.json", JSON.stringify(out, null, 1));
  for (const h of HASHES) { const o = out[h]; console.log("=== " + h + " -> " + o.panel); (o.rows || []).slice(0, 40).forEach(r => console.log("  " + r.tag + " | " + r.t + " | " + r.box + " | y" + r.y + " h" + r.h + " w" + r.w)); }
  console.log("errs", JSON.stringify(errs.slice(0, 5)));
  await browser.close();
})();
