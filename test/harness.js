/* WA Hub per-page offline harness.
   Usage: node harness.js <candidate.html> <outdir> [role] [email] [name]
   Renders every .panel[id] of the candidate build against the fixture-backed
   supabase stub with a frozen clock and seeded Math.random, and writes:
     <outdir>/pages/<id>.html   (serialized DOM of that page element)
     <outdir>/chrome.html       (body chrome with page interiors removed)
     <outdir>/report.json       (page list, sizes, console + page errors)
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const FIXED_TIME = "2026-08-06T12:00:00-04:00";

async function main() {
  const [candidate, outdir, role = "staff",
    email = "steel.macdonald@welfareavenue.com",
    name = "Steel MacDonald"] = process.argv.slice(2);
  if (!candidate || !outdir) {
    console.error("usage: node harness.js <candidate.html> <outdir> [role] [email] [name]");
    process.exit(2);
  }
  const html = fs.readFileSync(candidate, "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  fs.mkdirSync(path.join(outdir, "pages"), { recursive: true });

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 2200 } });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 500)); });
  page.on("pageerror", e => consoleErrors.push("PAGEERROR: " + String(e).slice(0, 500)));

  // Determinism + identity + fixture, before any page script runs.
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
      FDate.parse = RealDate.parse;
      FDate.UTC = RealDate.UTC;
      FDate.prototype = RealDate.prototype;
      window.Date = FDate;
      var seed = 42;
      Math.random = function(){
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
      window.__WA_TEST_ROLE = ${JSON.stringify(role)};
      window.__WA_TEST_EMAIL = ${JSON.stringify(email)};
      window.__WA_TEST_NAME = ${JSON.stringify(name)};
      window.confirm = function(){ return false; };
      window.alert = function(){};
      window.prompt = function(){ return null; };
    })();
  `);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");

  // Serve the candidate; stub the supabase CDN; kill all other network.
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith("http://wahub.test/")) {
      return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    }
    if (url.indexOf("cytoscape") >= 0) {
      return route.fulfill({ contentType: "application/javascript", body: require("fs").readFileSync(require("path").join(__dirname, "cytoscape.min.js"), "utf8") });
    }
    if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) {
      return route.fulfill({ contentType: "application/javascript", body: stub });
    }
    return route.abort();
  });

  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });

  // Wait for boot: gate hidden (MODE is a script-scoped let, not on window).
  await page.waitForFunction(() => {
    const g = document.getElementById("gate");
    return g && g.style.display === "none";
  }, null, { timeout: 20000 });
  await page.waitForTimeout(1200);

  const settle = async () => {
    await page.waitForTimeout(500);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  };

  const ids = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".panel[id]")).map(e => e.id));

  const report = { candidate: path.resolve(candidate), role, email, ids, pages: {}, errors: [] };

  for (const id of ids) {
    await page.evaluate(h => { location.hash = "#" + h; }, id);
    await settle();
    const snap = await page.evaluate(pid => {
      const el = document.getElementById(pid);
      return el ? el.outerHTML : "<missing/>";
    }, id);
    fs.writeFileSync(path.join(outdir, "pages", id + ".html"), snap);
    report.pages[id] = { bytes: Buffer.byteLength(snap) };
  }

  // Parameterized pages: first project and first team member person page.
  const fix = JSON.parse(fixture);
  const extras = [];
  if (fix.projects && fix.projects.length) extras.push(["project_first", "project/" + fix.projects[0].id, "projectpage"]);
  if (fix.team_members && fix.team_members.length) {
    const tm = fix.team_members.slice().sort((a, b) => (a.id > b.id ? 1 : -1))[0];
    extras.push(["person_first", "person/" + encodeURIComponent(tm.name || tm.email || tm.id), null]);
  }
  for (const [label, hash, pid] of extras) {
    await page.evaluate(h => { location.hash = "#" + h; }, hash);
    await settle();
    const snap = await page.evaluate(p => {
      const el = p ? document.getElementById(p) : document.querySelector(".panel.active");
      return el ? el.outerHTML : "<missing/>";
    }, pid);
    fs.writeFileSync(path.join(outdir, "pages", label + ".html"), snap);
    report.pages[label] = { bytes: Buffer.byteLength(snap) };
  }

  // Chrome snapshot: body with page interiors stripped (nav, header, chat, footer).
  const chrome = await page.evaluate(() => {
    const b = document.body.cloneNode(true);
    b.querySelectorAll(".panel[id]").forEach(e => { e.innerHTML = ""; });
    b.querySelectorAll("script").forEach(e => e.remove());
    return b.outerHTML;
  });
  fs.writeFileSync(path.join(outdir, "chrome.html"), chrome);
  report.errors = consoleErrors;
  fs.writeFileSync(path.join(outdir, "report.json"), JSON.stringify(report, null, 2));

  console.log("pages: " + ids.length + "  errors: " + consoleErrors.length);
  console.log(ids.join(" "));
  if (consoleErrors.length) console.log(consoleErrors.slice(0, 10).join("\n---\n"));
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
