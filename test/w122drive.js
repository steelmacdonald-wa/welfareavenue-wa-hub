/* wave122 drive: the Training academy (onboarding section, hero, paths, library, reader for every kind, lessons and the knowledge check,
   celebrations, certificates, assign and add for leaders, person card, classic view) and the page tours (every tour, step by step).
   usage: node w122drive.js [role] [email] [name] [mode: all|tours|smoke] [width] */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", MODE = "all", WIDTH = "1366"] = process.argv;

(async () => {
  const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  const shots = path.join(__dirname, "shots_p122");
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: Number(WIDTH), height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("PAGEERROR: " + String(e).slice(0, 300)));
  page.on("console", m => { if (m.type() === "error") { const t = m.text(); if (!/ERR_FAILED|net::|Failed to load resource/.test(t)) errs.push("CONSOLE: " + t.slice(0, 300)); } });
  page.on("popup", async p => { try { await p.close(); } catch (e) { } });
  await page.addInitScript(`
    (function(){
      var FIXED = new Date(${JSON.stringify(FIXED_TIME)}).getTime();
      var RealDate = Date;
      function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } }
      FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate;
      window.__WA_TEST_ROLE = ${JSON.stringify(ROLE)}; window.__WA_TEST_EMAIL = ${JSON.stringify(EMAIL)}; window.__WA_TEST_NAME = ${JSON.stringify(NAME)};
      window.confirm = function(){ return true; }; window.alert = function(){}; window.prompt = function(){ return null; };
      try { localStorage.setItem('wa84tour', '1'); } catch (e) {}
      window.__W = [];
    })();`);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") });
    if (url.indexOf("chart.umd") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "chart.umd.min.js"), "utf8") });
    if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub });
    return route.abort();
  });
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
  await page.waitForTimeout(2200);
  /* record writes: wrap the stub's upsert/insert/update */
  await page.evaluate(() => {
    const orig = db.from.bind(db);
    db.from = function (tb) {
      const b = orig(tb);
      ['insert', 'upsert', 'update'].forEach(op => { const f = b[op]; if (f) b[op] = function (payload, opts) { window.__W.push({ tb, op, payload: JSON.parse(JSON.stringify(payload)), opts: opts || null }); return f.apply(this, arguments); }; });
      return b;
    };
  });
  const out = { role: ROLE, checks: [], tours: {}, errs };
  const check = (name, ok, info) => { out.checks.push({ name, ok: !!ok, info: info === undefined ? null : info }); console.log((ok ? "PASS " : "FAIL ") + name + (info !== undefined ? " :: " + JSON.stringify(info).slice(0, 300) : "")); };
  const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(1300); };
  const shot = async n => { await page.screenshot({ path: path.join(shots, n + ".png") }); };
  const writes = async (tb) => page.evaluate(t => window.__W.filter(w => !t || w.tb === t), tb);

  await go("#training");
  await page.waitForTimeout(1200);
  const home = await page.evaluate(() => {
    const r = document.getElementById("w122"); const tr = document.getElementById("training");
    return { root: !!r, on: tr && tr.classList.contains("w122on"), secs: r ? Array.from(r.querySelectorAll("[data-sec]")).map(s => s.getAttribute("data-sec")) : [],
      legacyHidden: tr ? Array.from(tr.children).filter(c => c.id !== "w122").every(c => getComputedStyle(c).display === "none") : null,
      nav: (document.querySelector('#tabBar .tab[data-tab="training"]') || {}).textContent || "" };
  });
  check("academy mounts and takes over the page", home.root && home.on && home.legacyHidden, home);
  if (ROLE === "board") { await finish(); return; }
  check("sections in order: onboarding first", home.secs[0] === "onboarding" && home.secs.indexOf("hero") === 1, home.secs);
  check("nav label is Training academy", /Training academy/.test(home.nav), home.nav.trim());
  await shot("d_home_top");

  if (MODE === "tours") { await runTours(); await finish(); return; }

  /* 1. the lesson: chapters, activities, knowledge check */
  const les = await page.evaluate(() => { const t = w122.A.byKey['lesson:activities']; return t ? t.id : null; });
  check("lesson:activities exists", !!les, les);
  await go("#training/t/" + les);
  let sh = await page.evaluate(() => { const s = document.querySelector("#w122sheet.on .sh"); return s ? { rail: s.querySelectorAll(".rail .ri").length, title: (s.querySelector(".cht") || {}).textContent, body: (s.querySelector(".prose") || {}).textContent.slice(0, 80) } : null; });
  check("lesson opens in the wide sheet with its chapters", sh && sh.rail >= 7, sh);
  await shot("d_lesson_ch1");
  await page.click('#w122sheet [data-w122ch="1"]'); await page.waitForTimeout(400);
  const a8 = await page.evaluate(() => document.querySelectorAll("#w122sheet .a8").length);
  check("chapter 2 shows the eight activities", a8 === 8, a8);
  await page.click('#w122sheet [data-w122a8="3"]'); await page.waitForTimeout(300);
  const open3 = await page.evaluate(() => { const c = document.querySelector('#w122sheet .a8[data-a8="3"]'); return c && c.classList.contains("open") && getComputedStyle(c.querySelector(".more")).display !== "none"; });
  check("an activity opens with how and who", open3);
  await shot("d_lesson_ch2");
  const seen = await writes("training_progress");
  check("progress records the chapters seen", seen.some(w => w.payload && w.payload.data && (w.payload.data.seen || []).length >= 1), seen.length);
  /* the knowledge check: answer every question right */
  const nch = await page.evaluate(() => (w122.A.byKey['lesson:activities'].body.chapters || []).length);
  await page.click('#w122sheet [data-w122ch="' + nch + '"]'); await page.waitForTimeout(300);
  const answers = await page.evaluate(() => w122.A.byKey['lesson:activities'].body.quiz.questions.map(q => q.c));
  for (let i = 0; i < answers.length; i++) {
    await page.click('#w122sheet [data-w122opt="' + answers[i] + '"]'); await page.waitForTimeout(150);
    if (i === 0) await shot("d_quiz_answered");
    await page.click('#w122sheet [data-w122qnext]'); await page.waitForTimeout(150);
  }
  const res = await page.evaluate(() => (document.querySelector("#w122sheet .quiz .res h3") || {}).textContent);
  check("perfect score screen", /Perfect/.test(res || ""), res);
  await page.click('#w122sheet [data-w122qfinish]'); await page.waitForTimeout(900);
  const cel1 = await page.evaluate(() => { const c = document.getElementById("w122cel"); return c ? { h: c.querySelector("h3").textContent, xp: (c.querySelector(".xp") || {}).textContent, aws: Array.from(c.querySelectorAll(".aw b")).map(b => b.textContent) } : null; });
  check("completing the lesson celebrates with XP", cel1 && /complete/i.test(cel1.h) && /XP/.test(cel1.xp || ""), cel1);
  check("perfect score badge unlocked", cel1 && cel1.aws.indexOf("Perfect score") >= 0, cel1 && cel1.aws);
  await shot("d_celebrate_lesson");
  const doneW = (await writes("training_progress")).filter(w => w.payload.training_id === les && w.payload.status === "done");
  check("lesson saved done with score 100", doneW.length && doneW[doneW.length - 1].payload.score === 100, doneW.length && doneW[doneW.length - 1].payload);
  await page.click('#w122cel .btns [data-w122celx]').catch(() => { }); await page.waitForTimeout(300);

  /* 2. the partners lesson completes the Foundations path: a certificate */
  const par = await page.evaluate(() => w122.A.byKey['lesson:partners'].id);
  await go("#training/t/" + par);
  await page.click('#w122sheet [data-w122ch="2"]'); await page.waitForTimeout(300);
  const groups = await page.evaluate(() => document.querySelectorAll("#w122sheet .pg").length);
  check("partners chapter lists the partner groups", groups >= 4, groups);
  await shot("d_partners_who");
  await page.click('#w122sheet [data-w122ch="1"]'); await page.waitForTimeout(300);
  await shot("d_partners_kinds");
  const pn = await page.evaluate(() => (w122.A.byKey['lesson:partners'].body.chapters || []).length);
  await page.click('#w122sheet [data-w122ch="' + pn + '"]'); await page.waitForTimeout(300);
  const pans = await page.evaluate(() => w122.A.byKey['lesson:partners'].body.quiz.questions.map(q => q.c));
  /* get one wrong on purpose: 5 of 6 still passes */
  for (let i = 0; i < pans.length; i++) { await page.click('#w122sheet [data-w122opt="' + (i === 2 ? (pans[i] + 1) % 3 : pans[i]) + '"]'); await page.waitForTimeout(120); await page.click('#w122sheet [data-w122qnext]'); await page.waitForTimeout(120); }
  const res2 = await page.evaluate(() => (document.querySelector("#w122sheet .quiz .res h3") || {}).textContent);
  check("5 of 6 passes", /passed/i.test(res2 || ""), res2);
  await page.click('#w122sheet [data-w122qfinish]'); await page.waitForTimeout(900);
  const cel2 = await page.evaluate(() => { const c = document.getElementById("w122cel"); return c ? { h: c.querySelector("h3").textContent, aws: Array.from(c.querySelectorAll(".aw b")).map(b => b.textContent), share: !!c.querySelector("[data-w122shareck]") } : null; });
  check("finishing the path earns the Foundations certificate", cel2 && /Certificate/.test(cel2.h) && cel2.aws.indexOf("Welfare Avenue Foundations") >= 0, cel2);
  await shot("d_celebrate_cert");
  await page.click('#w122cel [data-w122celcert]'); await page.waitForTimeout(900);
  const shout = (await writes("hub_shoutouts"));
  check("the certificate is shared as a shout-out", shout.some(w => w.payload.kind === "manual" && /Foundations/.test(w.payload.text)), shout.map(w => w.payload.text));
  const cert = await page.evaluate(() => { const c = document.querySelector("#w122sheet .w122cert"); return c ? c.textContent : null; });
  check("certificate view shows the name and the path", cert && /Steel MacDonald|Amanda|MacDonald/.test(cert) && /Foundations/.test(cert), cert && cert.slice(0, 160));
  await shot("d_certificate");
  const aw = (await writes("academy_awards")).map(w => (Array.isArray(w.payload) ? w.payload : [w.payload]).map(a => a.award)).flat();
  check("awards persisted", aw.indexOf("cert:foundations") >= 0 && aw.indexOf("badge:perfect") >= 0, aw);
  await go("#training");

  /* 3. a video, a reading and a document */
  const vid = await page.evaluate(() => { const t = w122.A.trainings.filter(t => w122.kindOf(t) === 'video' && /loom/.test(t.resource_url || ''))[0]; return t && t.id; });
  await go("#training/t/" + vid);
  const ifr = await page.evaluate(() => { const f = document.querySelector("#w122sheet .vid iframe"); return f ? f.getAttribute("src") : null; });
  check("Loom video embeds", ifr && /loom\.com\/embed\/[0-9a-f]{32}/.test(ifr), ifr);
  await shot("d_video");
  await page.click('#w122sheet [data-w122done]'); await page.waitForTimeout(800);
  const cel3 = await page.evaluate(() => !!document.getElementById("w122cel"));
  check("watching a video completes it", cel3);
  await page.click('#w122cel .btns [data-w122celx]').catch(() => { }); await page.waitForTimeout(250);
  const rid = await page.evaluate(() => { const r = w122.A.trainings.filter(t => w122.kindOf(t) === 'read'); const withTry = r.filter(t => /Try it:/.test(t.description || '')); return (withTry[0] || r[0] || {}).id; });
  await go("#training/t/" + rid);
  const rd = await page.evaluate(() => { const s = document.querySelector("#w122sheet .main"); return s ? { tryit: !!s.querySelector(".callout.try"), done: !!s.querySelector(".callout.info"), tours: s.querySelectorAll("[data-w122starttour]").length } : null; });
  const rdHasTry = await page.evaluate(id => /Try it:/.test((w122.A.byId[String(id)] || {}).description || ''), rid);
  check("a reading renders" + (rdHasTry ? " Try it and Done when, and links its page tours" : " as an article"), rd && (!rdHasTry || (rd.tryit && rd.done && rd.tours >= 1)), rd);
  await shot("d_read");
  await go("#training/t/31");
  const dc = await page.evaluate(() => { const s = document.querySelector("#w122sheet .main"); return s ? { open: !!s.querySelector('.docbox a[href]'), pv: !!s.querySelector('[data-w122preview]') } : null; });
  check("a document offers open and preview", dc && dc.open && dc.pv, dc);
  await page.click('#w122sheet [data-w122preview]'); await page.waitForTimeout(300);
  const pvf = await page.evaluate(() => { const f = document.querySelector("#w122sheet .pvw iframe"); return f ? f.getAttribute("src") : null; });
  check("the preview loads inline", !!pvf, pvf);
  const t22 = await page.evaluate(() => { const t = w122.A.byId['22']; return t ? t.id : null; });
  if (t22) {
    await go("#training/t/22");
    const pw = await page.evaluate(() => (document.querySelector("#w122sheet .main") || {}).textContent || "");
    check("passwords in descriptions are masked", !/Password:\s*[^•\s]/i.test(pw), pw.slice(0, 200));
  }
  await go("#training");

  /* 4. onboarding: a Hub first step and a policy */
  const hubBefore = await page.evaluate(() => (document.querySelector('#w122 [data-trk="hub"] .rg i') || {}).textContent);
  const hasHub = await page.$('#w122 [data-w122hub="info"]');
  if (hasHub) {
    await page.click('#w122 [data-w122hub="info"]'); await page.waitForTimeout(900);
    const hubAfter = await page.evaluate(() => (document.querySelector('#w122 [data-trk="hub"] .rg i') || {}).textContent);
    check("ticking a Hub first step updates the track", hubAfter !== hubBefore, { hubBefore, hubAfter });
    await page.click('#w122cel .btns [data-w122celx]').catch(() => { });
  } else check("Hub first steps present", false, hubBefore);
  const signBtn = await page.$('#w122 [data-w122sign]');
  if (signBtn) {
    /* wave130: the sign-off only works once the policy has been opened */
    const locked = await signBtn.evaluate(b => b.hasAttribute('data-w130lock'));
    check("the sign-off waits until the policy is opened", locked);
    const pop = page.context().waitForEvent('page', { timeout: 3000 }).catch(() => null);
    await signBtn.evaluate(b => { const a = b.closest('.it').querySelector('a.go[href]'); if (a) a.click(); });
    const pg = await pop; if (pg) { try { await pg.close(); } catch (e) { /* fine */ } }
    await page.waitForTimeout(300);
    await signBtn.click(); await page.waitForTimeout(900);
    const so = await writes("wa_policy_signoffs");
    check("signing a policy records the sign-off", so.length === 1 && !!so[0].payload.policy_key, so.map(w => w.payload));
    await page.click('#w122cel .btns [data-w122celx]').catch(() => { });
  }
  await shot("d_onboarding_after");
  const onbPlan = await page.$('#w122 [data-w122onbopen]');
  if (onbPlan) {
    await onbPlan.click(); await page.waitForTimeout(900);
    const wk = await page.evaluate(() => document.querySelectorAll("#w122sheet .onbwrap details.w37week").length);
    check("the onboarding plan opens week by week", wk >= 1, wk);
    await shot("d_onb_plan");
    await go("#training");
  }

  /* 5. leaders: assign and add */
  const lead = await page.evaluate(() => { try { return WA40_MINE && WA40_MINE.role; } catch (e) { return null; } });
  if (lead === "admin" || lead === "leader") {
    const aid = await page.evaluate(() => w122.A.trainings.filter(t => w122.kindOf(t) === 'video')[1].id);
    await go("#training/t/" + aid);
    await page.click('#w122sheet [data-w122assign]'); await page.waitForTimeout(400);
    const boxes = await page.$$('#w122sheet [data-w122pick]:not([disabled])');
    for (let i = 0; i < Math.min(2, boxes.length); i++) await boxes[i].check();
    await page.click('#w122sheet [data-w122assigngo]'); await page.waitForTimeout(700);
    const asg = (await writes("training_progress")).filter(w => w.payload.training_id === aid && w.payload.assigned_by === w.payload.assigned_by && w.payload.person_name !== 'Steel' && w.payload.assigned_by);
    check("assigning writes one row per person", asg.length === Math.min(2, boxes.length), asg.map(w => [w.payload.person_name, w.payload.status]));
    await shot("d_assign_done");
    await go("#training");
    await page.click('#w122 [data-w122add]'); await page.waitForTimeout(400);
    await page.fill('#w122sheet [data-f="title"]', 'Running a Sunday serving');
    await page.fill('#w122sheet [data-f="resource_url"]', 'https://www.loom.com/share/0123456789abcdef0123456789abcdef');
    await page.fill('#w122sheet [data-f="minutes"]', '12');
    await page.click('#w122sheet [data-w122save]'); await page.waitForTimeout(800);
    const added = (await writes("trainings")).filter(w => w.op === "insert");
    check("adding a training inserts it with its Loom id", added.length === 1 && added[0].payload.ext_id === '0123456789abcdef0123456789abcdef' && added[0].payload.kind === 'video', added.map(w => w.payload));
    await go("#training");
  }

  /* 6. library filters and search */
  await page.keyboard.press("Escape"); await page.waitForTimeout(400); await go("#training");
  await page.click('#w122 [data-w122kind="tour"]'); await page.waitForTimeout(300);
  const tl = await page.evaluate(() => Array.from(document.querySelectorAll("#w122libgrid .w122card .kd")).map(k => k.textContent.trim()));
  check("the Tours filter shows only tours", tl.length > 0 && tl.every(k => /Page tour/.test(k)), tl.slice(0, 3));
  await page.click('#w122 [data-w122kind="all"]'); await page.waitForTimeout(300);
  await page.fill('#w122 [data-w122q]', 'keela'); await page.waitForTimeout(400);
  const kl = await page.evaluate(() => document.querySelectorAll("#w122libgrid .w122card").length);
  check("search finds the Keela trainings", kl >= 5, kl);
  await page.fill('#w122 [data-w122q]', ''); await page.waitForTimeout(300);

  /* 7. a path sheet */
  await go("#training/p/foundations");
  const pv = await page.evaluate(() => ({ items: document.querySelectorAll("#w122sheet .pitem").length, cert: /Certified/.test((document.querySelector("#w122sheet .callout") || {}).textContent || "") }));
  check("the Foundations path shows its items and the certificate", pv.items === 2 && pv.cert, pv);
  await shot("d_path");
  await go("#training");

  /* 8. the person card */
  const pid = await page.evaluate(() => { try { const m = WA28_PEOPLE.filter(p => (p.email || '').toLowerCase() === (USER.email || '').toLowerCase())[0]; return m ? m.id : null; } catch (e) { return null; } });
  if (pid) {
    await go("#person/" + pid); await page.waitForTimeout(1500);
    const pk = await page.evaluate(() => { const c = document.getElementById("w122pk"); return c ? c.textContent.slice(0, 200) : null; });
    check("the person page shows the Academy card", !!pk && /Level/.test(pk), pk);
    await shot("d_person");
  }

  /* 9. classic view and back */
  await go("#training");
  await page.click('#w122 [data-w122classic="1"]'); await page.waitForTimeout(900);
  const cl = await page.evaluate(() => { const tr = document.getElementById("training"); return { on: tr.classList.contains("w122on"), bar: !!document.getElementById("w122cbar"), legacy: !!document.getElementById("w36body") && getComputedStyle(document.getElementById("w36body").closest(".card")).display !== "none" }; });
  check("classic view brings the old page back", !cl.on && cl.bar && cl.legacy, cl);
  await page.click('#w122cbar [data-w122classic="0"]'); await page.waitForTimeout(600);
  const back = await page.evaluate(() => document.getElementById("training").classList.contains("w122on"));
  check("and back to the academy", back);

  if (MODE === "all") await runTours();
  await finish();

  async function runTours() {
    const keys = await page.evaluate(() => Object.keys(w122.tours).filter(k => w122.tourAvail(k)));
    for (const k of keys) {
      await page.evaluate(() => { try { w122.endTour(true); } catch (e) { } const c = document.getElementById('w122cel'); if (c) c.remove(); });
      await go("#training"); await page.waitForTimeout(300);
      await page.evaluate(key => w122.startTour(key), k);
      const n = await page.evaluate(key => w122.tours[key].steps.length, k);
      const seen = [];
      let guard = 0, last = -1;
      await page.waitForTimeout(1600);
      while (guard++ < n + 4) {
        const st = await page.evaluate(() => { const s = w122.state().T; if (!s) return null; return { i: s.i, busy: s.busy, el: !!(s.el && s.el.isConnected), none: document.querySelector('.w122tp .hole').classList.contains('none'), t: (document.querySelector('.w122tp .pop h4') || {}).textContent }; });
        if (!st) break;
        if (st.busy) { await page.waitForTimeout(500); guard--; continue; }
        if (st.i === last) { await page.waitForTimeout(400); }
        seen.push({ i: st.i, t: st.t, el: st.el && !st.none });
        if (k === "home" && st.i === 1) await shot("d_tour_home_step");
        if (k === "team" && st.i === 3) await shot("d_tour_team_step");
        last = st.i;
        await page.evaluate(() => { const b = document.querySelector('.w122tp [data-w122tnext]'); if (b) b.click(); });
        await page.waitForTimeout(700);
      }
      await page.waitForTimeout(700);
      const cel = await page.evaluate(() => { const c = document.getElementById('w122cel'); return c ? c.querySelector('h3').textContent : null; });
      const shown = seen.filter(s => s.el).length, centred = seen.filter(s => !s.el).map(s => s.t);
      out.tours[k] = { steps: n, shown, centred, skipped: n - seen.length, finished: !!cel };
      console.log("TOUR " + k + ": " + shown + "/" + n + " highlighted, skipped " + (n - seen.length) + (centred.length ? ", centred: " + centred.join(" | ") : "") + (cel ? " -> " + cel : " (no finish)"));
      await page.evaluate(() => { const c = document.getElementById('w122cel'); if (c) c.remove(); });
    }
  }
  async function finish() {
    fs.writeFileSync(path.join(shots, "drive_" + ROLE + "_" + MODE + ".json"), JSON.stringify(out, null, 1));
    const fails = out.checks.filter(c => !c.ok);
    console.log("CHECKS " + (out.checks.length - fails.length) + "/" + out.checks.length + " passed; errors: " + errs.length);
    errs.slice(0, 12).forEach(e => console.log("  " + e));
    await browser.close();
  }
})();
