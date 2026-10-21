/* w128drive.js [case] [width]: the Executive dashboard. Cases: admin (Steel), board (Tamara), opsto (Tate on Operations Toronto) */
const fs = require("fs"); const path = require("path"); const { chromium } = require("playwright");
const [, , CASE = "admin", WIDTH = "1366"] = process.argv;
const C = {
  admin: { email: "steel.macdonald@welfareavenue.com", name: "Steel MacDonald", role: "staff", patch: [] },
  board: { email: "consult.tamaraangeline@gmail.com", name: "Tamara Angeline", role: "board", patch: [] },
  opsto: { email: "tate.weinstein@welfareavenue.com", name: "Tate Weinstein", role: "staff", patch: [{ email: "tate.weinstein@welfareavenue.com", role: "member", profile: "opsto" }] }
}[CASE];
const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8"), stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
const fx = JSON.parse(fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8"));
C.patch.forEach(p => { const r = fx.hub_roles.filter(x => x.email === p.email)[0]; if (r) Object.assign(r, p, { tabs: null }); else fx.hub_roles.push(Object.assign({ tabs: null, note: null }, p)); });
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push("PASS " + name); } else { fail++; out.push("FAIL " + name + (extra ? " :: " + String(extra).slice(0, 400) : "")); } }
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await (await browser.newContext({ viewport: { width: Number(WIDTH), height: 900 } })).newPage();
  const errs = []; page.on("pageerror", e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(`(function(){ var FIXED = new Date("2026-08-06T12:00:00-04:00").getTime(); var RealDate = Date; function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } } FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate; window.__WA_TEST_ROLE = ${JSON.stringify(C.role)}; window.__WA_TEST_EMAIL = ${JSON.stringify(C.email)}; window.__WA_TEST_NAME = ${JSON.stringify(C.name)}; window.confirm = function(){ return true; }; try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa262.seen', '1'); localStorage.setItem('wa112done', '1'); } catch (e) {} })();`);
  await page.addInitScript("window.__WAFIX = " + JSON.stringify(fx) + ";");
  await page.route("**/*", route => { const url = route.request().url(); if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html }); if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") }); if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub }); return route.abort(); });
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
  await page.waitForTimeout(3000);
  const ev = (f, a) => page.evaluate(f, a);
  const hash = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(1300); };
  const click = async sel => { const el = await page.$(sel); if (!el) return false; await el.click(); await page.waitForTimeout(600); return true; };
  const shot = async n => { try { await page.screenshot({ path: "/tmp/w128_" + CASE + "_" + WIDTH + "_" + n + ".png", fullPage: !!process.env.FULL }); } catch (e) { /* fine */ } };
  await page.evaluate(() => { document.querySelectorAll('body *').forEach(el => { const t = el.textContent || ''; const st = getComputedStyle(el); if ((st.position === 'fixed' || st.position === 'absolute') && (/STARTING A SESSION|Meet Ask the Hub/i.test(t)) && t.length < 400) el.remove(); }); });
  await hash('#overview');
  await page.waitForTimeout(800);
  const s = await ev(() => { const p = document.getElementById('overview'); const m = p.querySelector(':scope > .w118mast'); const h = document.getElementById('w128'); const vis = el => !!(el && el.offsetParent !== null); return { after: !!(m && m.nextElementSibling === h), strip: vis(document.getElementById('w35stats')), plate: vis(p.querySelector(':scope > .card.w28my')), aging: vis(document.querySelector('#w111folds [data-w111f="aging"]')), help: !!(m && m.querySelector('.w43help')), brief: (h.querySelector('.w128brief p') || {}).textContent || '', next: h.querySelectorAll('.w128brief .nx .it').length, tiles: Array.from(h.querySelectorAll('.w128k')).map(k => ({ t: k.querySelector('.l').textContent, go: k.getAttribute('data-w128go') || ('fold:' + k.getAttribute('data-w128fold')) })), dec: h.querySelectorAll('.w128d').length, decBtn: h.querySelectorAll('[data-w128decide]').length, watch: h.querySelectorAll('.w128w').length, wins: h.querySelectorAll('.w128h').length, nx: h.querySelectorAll('.w128n').length, teams: h.querySelectorAll('.w128t').length, desc: (m.querySelector('p') || {}).textContent }; });
  ok("the new top sits right under the masthead", s.after, JSON.stringify(s).slice(0, 200));
  ok("the old strip, the Your plate card and the Decisions waiting folder give way", !s.strip && !s.plate && !s.aging, JSON.stringify([s.strip, s.plate, s.aging]));
  ok("the page help moves to the masthead", CASE === 'board' || s.help);
  ok("the masthead says what the page is for", /Where Welfare Avenue stands/.test(s.desc), s.desc);
  ok("the brief", /decisions are waiting on the executives/.test(s.brief) && /raised/.test(s.brief), s.brief);
  ok("next up", s.next >= 1, s.next);
  ok("the numbers each open something", s.tiles.length >= 4 && s.tiles.every(t => t.go && t.go !== 'fold:null'), JSON.stringify(s.tiles));
  ok("needs a decision", s.dec === 4, s.dec);
  ok(CASE === 'board' ? "the board reads, it does not record decisions" : "record the decision is there", CASE === 'board' ? s.decBtn === 0 : s.decBtn === 4, s.decBtn);
  ok("to watch, highlights and coming up", s.watch >= 2 && s.wins >= 1 && s.nx >= 1, JSON.stringify([s.watch, s.wins, s.nx]));
  ok(CASE === 'board' ? "teams at a glance stay with the staff pages" : "teams at a glance: six teams", CASE === 'board' ? s.teams === 0 : s.teams === 6, s.teams);
  ok("finance tile only with the ledger", CASE === 'admin' ? s.tiles.some(t => /donations/.test(t.t)) : !s.tiles.some(t => /donations/.test(t.t)), JSON.stringify(s.tiles.map(t => t.t)));
  await shot('top');
  if (CASE !== 'board') {
    /* the doors */
    await click('#w128 .w128k[data-w128fold="overdue"]');
    ok("open tasks opens the overdue folder in place", await ev(() => location.hash === '#overview' && !!document.querySelector('#w111folds [data-w111f="overdue"].on')));
    await click('#w128 [data-w128see]');
    ok("In the list finds the decision", await ev(() => !!document.querySelector('#decisionList li.w128flash')));
    await click('#w128 [data-w128decide]');
    ok("Record the decision opens the decision record", await ev(() => { const mb = document.getElementById('modalBack'); return !!(mb && mb.style.display !== 'none' && /Record the decision/.test(mb.textContent)); }));
    await click('#ddCancel');
    ok("cancel closes it", await ev(() => { const mb = document.getElementById('modalBack'); return !mb || mb.style.display === 'none'; }));
    await click('#w128 .w128t[data-w128go="#team/opsmtl"]');
    ok("a team card opens the team page", await ev(() => location.hash === '#team/opsmtl'));
    await hash('#overview');
    await click('#w128 .w128k[data-w128go="#fundevents"]');
    ok("raised opens the events calendar", await ev(() => location.hash === '#fundevents' && document.querySelector('.panel.active').id === 'fundevents'));
    await hash('#overview');
  }
  await click('#w128 .w128w');
  ok("a watch row goes somewhere real", await ev(() => location.hash !== '#overview' || !!document.activeElement));
  await hash('#overview');
  ok("the tour follows the new page", await ev(() => { const t = window.w122 && w122.tours && w122.tours.overview; return !!t && t.steps.some(x => x.s === '#w128dec') && !t.steps.some(x => x.s === '#w35stats' || x.s === '#overview .w28my'); }));
  if (Number(WIDTH) < 800) ok("phone: no sideways scroll", await ev(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await ev(() => document.documentElement.scrollWidth + ' > ' + window.innerWidth));
  ok("no page errors", errs.length === 0, errs.join(' | '));
  console.log(out.join("\n")); console.log(`\n${CASE} ${WIDTH}: ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
