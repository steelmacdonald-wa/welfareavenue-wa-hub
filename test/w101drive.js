/* Wave101 functional drive: open a project with tasks, click Send to Slack,
   stub the project-slack fn with real-shaped fixture data, screenshot the
   modal, and exercise the send path (stubbed) to check outcome handling. */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const FIXED_TIME = "2026-08-06T12:00:00-04:00";

async function main() {
  const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 1100 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e).slice(0, 300)));

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
      window.__WA_TEST_ROLE = "staff";
      window.__WA_TEST_EMAIL = "steel.macdonald@welfareavenue.com";
      window.__WA_TEST_NAME = "Steel MacDonald";
      window.confirm = function(){ return false; };
      window.alert = function(){};
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
  await page.waitForFunction(() => {
    const g = document.getElementById("gate");
    return g && g.style.display === "none";
  }, null, { timeout: 20000 });
  await page.waitForTimeout(1200);

  /* stub the edge fn with real-shaped payloads (captured from the live fn) */
  await page.evaluate(() => {
    const realInvoke = db.functions.invoke.bind(db.functions);
    window.__W101CALLS = [];
    db.functions.invoke = async function (name, opts) {
      if (name !== "project-slack") return realInvoke(name, opts);
      const body = (opts && opts.body) || {};
      window.__W101CALLS.push(JSON.parse(JSON.stringify(body)));
      if (body.action === "channels") {
        return { data: { channels: [
          { id: "C0223LPSWRL", name: "general", is_private: false, is_member: true },
          { id: "C022NBJB57X", name: "operations-mtl", is_private: true, is_member: true },
          { id: "C02342H9ZND", name: "fundraising", is_private: true, is_member: true },
          { id: "C034TCGSMPG", name: "games", is_private: false, is_member: false }
        ] }, error: null };
      }
      if (body.action === "preview") {
        return { data: {
          text_display: "\u{1F4CB} Community Kitchen Pilot\n\nOpen tasks (9)\n\n@Ian\n• Assign photographer and videographer for Aug 23 community kitchen pilot (due 2026-08-20)  Marketing  \u{1F6A9}\n• Identify team lead for Aug 23 pilot to coordinate media and quotes (due 2026-08-20)  Marketing\n\n@Ahmed\n• Review and finalize kitchen coordinator job description for CABM posting\n• Negotiate Aug 23 kitchen venue capacity increase from 10 to 15 volunteer cooks (due 2026-08-10)\n\n@Steel\n• Assess $150 biweekly kitchen rental proposal (budget fit, alternatives)  Human Resources  \u{1F6A9}\n\nMarketing\n• Create and publish IG post for volunteer cooks for Aug 23 pilot (due 2026-08-11)  Marketing\n\nSent from the Welfare Avenue Hub by steel.macdonald@welfareavenue.com",
          unresolved: ["Marketing"], task_count: 9, project_name: "Community Kitchen Pilot"
        }, error: null };
      }
      if (body.action === "send") {
        return { data: { outcome: "sent", channel: body.channel_name }, error: null };
      }
      return { data: { error: "unknown action" }, error: null };
    };
  });

  /* find a named project with open tasks and open its page */
  await page.evaluate(() => { location.hash = "#dept/opsmtl"; });
  await page.waitForTimeout(900);
  const ref = await page.evaluate(async () => {
    await wa27Load(true);
    const withTasks = WA27_PROJECTS.filter(p => !p.archived);
    return withTasks.length ? String(withTasks[0].id) : null;
  });
  await page.evaluate(r => { location.hash = "#project/" + r; }, ref);
  await page.waitForTimeout(1200);

  const btn = await page.evaluate(() => !!document.getElementById("w101btn"));
  await page.evaluate(() => { document.getElementById("w101btn").click(); });
  await page.waitForTimeout(900);

  const modal = await page.evaluate(() => ({
    channels: document.getElementById("w101ch") ? document.getElementById("w101ch").options.length : 0,
    firstOption: document.getElementById("w101ch") ? document.getElementById("w101ch").options[0].textContent : null,
    nonMemberFlag: document.getElementById("w101ch") ? Array.from(document.getElementById("w101ch").options).some(o => o.textContent.indexOf("invite @wadashboard") >= 0) : false,
    previewHead: (document.getElementById("w101prev") || {}).textContent ? document.getElementById("w101prev").textContent.split("\n")[0] : null,
    warn: (document.getElementById("w101warn") || {}).textContent || ""
  }));

  /* type a note, confirm it splices into the preview */
  await page.fill("#w101note", "Quick push before Saturday: flag anything at risk in the thread.");
  await page.waitForTimeout(300);
  const noteLine = await page.evaluate(() => document.getElementById("w101prev").textContent.split("\n")[1]);

  fs.mkdirSync(path.join(__dirname, "shots_p15"), { recursive: true });
  await page.screenshot({ path: path.join(__dirname, "shots_p15/modal.png"), fullPage: false });

  /* send (stubbed) */
  await page.selectOption("#w101ch", { index: 1 });
  await page.evaluate(() => { document.getElementById("w101send").click(); });
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => ({
    modalOpen: document.getElementById("modalBack").style.display !== "none",
    toast: (document.getElementById("toast") || {}).textContent || "",
    calls: window.__W101CALLS
  }));

  console.log(JSON.stringify({ ref, btn, modal, noteLine, after, errors }, null, 2));
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
