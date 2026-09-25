/* w125drive.js [role email name width]: drive the SOPs (academy kind sop, the team cards, the events calendar links) */
const fs = require("fs"); const path = require("path"); const { chromium } = require("playwright");
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", WIDTH = "1366"] = process.argv;
const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8"), stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8"), fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push("PASS " + name); } else { fail++; out.push("FAIL " + name + (extra ? " :: " + String(extra).slice(0, 300) : "")); } }
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await (await browser.newContext({ viewport: { width: Number(WIDTH), height: 900 } })).newPage();
  const errs = []; page.on("pageerror", e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(`(function(){ var FIXED = new Date("2026-08-06T12:00:00-04:00").getTime(); var RealDate = Date; function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } } FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate; window.__WA_TEST_ROLE = ${JSON.stringify(ROLE)}; window.__WA_TEST_EMAIL = ${JSON.stringify(EMAIL)}; window.__WA_TEST_NAME = ${JSON.stringify(NAME)}; window.confirm = function(){ return true; }; try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa112done', '1'); } catch (e) {} })();`);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.route("**/*", route => { const url = route.request().url(); if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html }); if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") }); if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub }); return route.abort(); });
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const ev = f => page.evaluate(f);
  const hash = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(1100); };
  const click = async sel => { const el = await page.$(sel); if (!el) return false; await el.click(); await page.waitForTimeout(500); return true; };
  const staff = await ev(() => typeof isStaff === 'function' && isStaff());
  const leader = await ev(() => ['admin', 'leader'].indexOf((typeof WA40_MINE !== 'undefined' && WA40_MINE || {}).role) >= 0);

  if (!staff) {
    await hash('#team/board');
    ok("board viewers get no SOP card", await ev(() => !document.getElementById('w122sopcard')));
    await hash('#training');
    ok("board viewers stay out of the academy", await ev(() => { const a = document.querySelector('.panel.active'); return !a || a.id !== 'training' || !document.querySelector('#w122 [data-sec="sops"]'); }));
  } else {
    /* the academy home */
    await hash('#training');
    await page.waitForTimeout(1200);
    const home = await ev(() => ({ sec: !!document.querySelector('#w122 [data-sec="sops"]'), tiles: document.querySelectorAll('#w122 .w122sopt').length, next: Array.from(document.querySelectorAll('#w122 .w122sopt em')).map(e => e.textContent), write: !!document.querySelector('#w122 [data-sec="sops"] [data-w122sopnew]'), order: Array.from(document.querySelectorAll('#w122 [data-sec]')).map(s => s.getAttribute('data-sec')) }));
    ok("Our SOPs on the academy home", home.sec && home.tiles === 6, JSON.stringify(home));
    ok("SOPs sit after the paths, before the tours", home.order.indexOf('sops') > home.order.indexOf('paths') && home.order.indexOf('sops') < home.order.indexOf('tours'), JSON.stringify(home.order));
    ok("tiles show the next event", home.next.some(t => /Flag Football 2026/.test(t)), JSON.stringify(home.next));
    await click('#w122 [data-w122kind="sop"]');
    ok("the library filter for SOPs", await ev(() => document.querySelectorAll('#w122libgrid .w122card').length === 6));
    await click('#w122 [data-w122kind="all"]');

    /* reading one */
    await click('#w122 .w122sopt[data-w122open="900"]');
    await page.waitForTimeout(800);
    const r = await ev(() => { const s = document.querySelector('#w122sheet .sh'); const q = x => s.querySelectorAll(x).length; return { hash: location.hash, kind: (s.querySelector('.kd') || {}).textContent, h2: (s.querySelector('.hd h2') || {}).textContent, glance: q('.w122sop .glance > div'), eds: q('.w122sop .ed'), roles: q('.w122sop .ro'), phases: q('.w122sop .ph'), steps: q('.w122sop .ph li'), dayof: q('#w122sop-dayof li'), lessons: q('#w122sop-lessons li'), todo: q('.w122sop .todo li'), links: Array.from(s.querySelectorAll('.w122sop .lnks a')).map(a => a.getAttribute('href')), next: Array.from(s.querySelectorAll('.w122sop .sopnext .ev b')).map(b => b.textContent), toc: q('.w122sop .toc button'), done: !!s.querySelector('[data-w122done]') }; });
    ok("the SOP opens with its title", /#training\/t\/900/.test(r.hash) && /SOP/.test(r.kind) && r.h2 === 'Flag Football tournament', JSON.stringify(r).slice(0, 200));
    ok("every section renders", r.glance === 6 && r.eds === 3 && r.roles === 7 && r.phases === 7 && r.steps === 28 && r.dayof === 7 && r.lessons === 10 && r.todo === 3 && r.toc >= 6, JSON.stringify(r));
    ok("documents are safe links", r.links.length === 7 && r.links.every(u => /^https:\/\//.test(u)), JSON.stringify(r.links));
    ok("the events calendar events it serves", r.next.indexOf('Flag Football 2026') >= 0, JSON.stringify(r.next));
    await click('#w122sheet [data-w122sopjump="phases"]');
    await page.waitForTimeout(700);
    ok("the contents jump to a section", await ev(() => document.querySelector('#w122sheet .main').scrollTop > 400));
    await click('#w122sheet [data-w122done]');
    await page.waitForTimeout(900);
    ok("I have read it", await ev(() => { const c = document.getElementById('w122cel'); if (c) { const x = c.querySelector('[data-w122celx]'); if (x) x.click(); } const s = document.querySelector('#w122sheet .ft'); return /Completed/.test(s ? s.textContent : '') || (typeof w122 !== 'undefined' && w122.A.prog.some(p => String(p.training_id) === '900' && p.status === 'done')); }));
    await page.waitForTimeout(400);

    /* editing it */
    const canEdit = await ev(() => !!document.querySelector('#w122sheet [data-w122sopedit]'));
    if (leader) {
      ok("leaders can edit", canEdit);
      await click('#w122sheet .hd [data-w122sopedit]');
      const f = await ev(() => { const s = document.querySelector('#w122sheet .sh'); const v = k => (s.querySelector('[data-sf="' + k + '"]') || {}).value || ''; return { form: !!s.querySelector('.w122sopf'), title: v('title'), phases: v('phases'), glance: v('glance'), teams: Array.from(s.querySelectorAll('[data-sfteam]:checked')).map(i => i.value) }; });
      ok("the form fills from the SOP", f.form && f.title === 'Flag Football tournament' && /^## 5 months out \(March\) \| Lock the partner and the date/.test(f.phases) && /^When: /.test(f.glance) && f.teams.join() === 'marketing,fundraising', JSON.stringify(f).slice(0, 300));
      const rt = await ev(() => { const t = w122.A.byId['900']; const b = w122.sop.body(t); const again = w122.sop.phasesIn(w122.sop.phasesOut(b.phases)); return JSON.stringify(again) === JSON.stringify(b.phases); });
      ok("step by step survives a round trip", rt);
      await page.fill('#w122sheet [data-sf="title"]', 'Flag Football tournament (MFL)');
      await page.fill('#w122sheet [data-sf="lessons"]', await ev(() => document.querySelector('#w122sheet [data-sf="lessons"]').value + '\nBook the storage unit pickup the week before.'));
      await click('#w122sheet [data-w122sopsave]');
      await page.waitForTimeout(900);
      const sv = await ev(() => { const t = w122.A.byId['900']; const b = w122.sop.body(t); return { title: t.title, lessons: b.lessons.length, phases: b.phases.length, glance: b.glance.length, h2: (document.querySelector('#w122sheet .hd h2') || {}).textContent, mode: (w122.state().R || {}).mode }; });
      ok("the edit is saved and shown", sv.title === 'SOP: Flag Football tournament (MFL)' && sv.lessons === 11 && sv.phases === 7 && sv.glance === 6 && sv.h2 === 'Flag Football tournament (MFL)' && sv.mode === 'view', JSON.stringify(sv));
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);

      /* writing a new one */
      await hash('#training');
      await click('#w122 [data-sec="sops"] [data-w122sopnew]');
      await page.waitForTimeout(600);
      ok("Write an SOP opens the form", await ev(() => !!document.querySelector('#w122sheet .w122sopf') && !document.querySelector('#w122sheet [data-sf="title"]').value));
      await click('#w122sheet [data-w122sopsave]');
      ok("a title is required", await ev(() => !!document.querySelector('#w122sheet .w122sopf')));
      await page.fill('#w122sheet [data-sf="title"]', 'Onboarding a new volunteer');
      await ev(() => { document.querySelectorAll('#w122sheet [data-sfteam]').forEach(i => { i.checked = i.value === 'hr'; }); });
      await page.fill('#w122sheet [data-sf="description"]', 'From the first message to the first shift.');
      await page.fill('#w122sheet [data-sf="phases"]', '## The first day | Say hello\n- Send the welcome message\n- Add them to the volunteer chat\n\n## The first week | The first shift\n- Pair them with a regular');
      await click('#w122sheet [data-w122sopsave]');
      await page.waitForTimeout(1000);
      const nw = await ev(() => { const t = w122.A.trainings.filter(x => x.title === 'SOP: Onboarding a new volunteer')[0]; return t ? { kind: t.kind, depts: w122.sop.body(t).depts, phases: w122.sop.body(t).phases.map(p => p.when + '/' + p.title + '/' + p.steps.length), key: t.key, open: (document.querySelector('#w122sheet .hd h2') || {}).textContent } : null; });
      ok("the new SOP is added and opens", nw && nw.kind === 'sop' && nw.depts.join() === 'hr' && nw.phases.join() === 'The first day/Say hello/2,The first week/The first shift/1' && /^sop:onboarding-a-new-volunteer-/.test(nw.key) && nw.open === 'Onboarding a new volunteer', JSON.stringify(nw));
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    } else {
      ok("no edit without edit rights", !canEdit);
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    }

    /* the team cards */
    await hash('#team/fundraising');
    await page.waitForTimeout(1500);
    const tc = await ev(() => { const c = document.getElementById('w122sopcard'); if (!c) return null; const col = c.parentNode; const prev = c.previousElementSibling; return { rows: c.querySelectorAll('.w122soprow').length, afterProjects: !!(prev && /^projects/i.test((prev.querySelector('h3') || {}).textContent || '')), col2: col === document.querySelectorAll('#w116host .w116grid > .w116col')[1], write: !!c.querySelector('[data-w122sopnew]') }; });
    ok("Our SOPs on the Fundraising overview", tc && tc.rows === 6 && tc.afterProjects && tc.col2, JSON.stringify(tc));
    await hash('#team/marketing');
    await page.waitForTimeout(1300);
    ok("Marketing sees its two", await ev(() => { const c = document.getElementById('w122sopcard'); return !!c && c.getAttribute('data-d') === 'marketing' && c.querySelectorAll('.w122soprow').length === 2; }));
    await hash('#team/hr');
    await page.waitForTimeout(1300);
    const hrRows = await ev(() => { const c = document.getElementById('w122sopcard'); return c && c.getAttribute('data-d') === 'hr' ? c.querySelectorAll('.w122soprow').length : -1; });
    ok(leader ? "HR shows the new one" : "HR has none yet", hrRows === (leader ? 1 : 0), hrRows);
    await hash('#team/fundraising');
    await page.waitForTimeout(1300);
    await click('#w122sopcard .w122soprow[data-w122sopgo="902"]');
    await page.waitForTimeout(900);
    ok("a card row opens the SOP", await ev(() => /#training\/t\/902/.test(location.hash) && /Gift Basket Drive/.test((document.querySelector('#w122sheet .hd h2') || {}).textContent || '')));
    /* from the SOP to the events calendar and back */
    await click('#w122sheet .sopnext .ev');
    await page.waitForTimeout(1300);
    ok("the SOP links to its event", await ev(() => /#fundevents\/4/.test(location.hash) && /Gift Basket Drive 2026/.test((document.querySelector('#w124sheet h2') || {}).textContent || '')));
    await click('#w124sheet a[data-w124go^="#training/t/"]');
    await page.waitForTimeout(1300);
    ok("the event links back to its SOP", await ev(() => /#training\/t\/902/.test(location.hash) && /Gift Basket Drive/.test((document.querySelector('#w122sheet .hd h2') || {}).textContent || '')));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  }
  const e2 = errs.filter(e => !/ERR_FAILED|Failed to fetch|NetworkError/.test(e));
  ok("no page errors", e2.length === 0, JSON.stringify(e2.slice(0, 4)));
  console.log(out.join("\n"));
  console.log("RESULT " + pass + " passed, " + fail + " failed (" + ROLE + " " + EMAIL + " " + WIDTH + ")");
  await browser.close();
})();
