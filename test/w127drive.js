/* w127drive.js [case] [width]: access profiles. Cases: admin (Steel), opsto (Tate on Operations Toronto), mktlead (Kahkashan, Marketing lead),
   board (Tamara, a board viewer), classic (Tate with no profile: nothing changes) */
const fs = require("fs"); const path = require("path"); const { chromium } = require("playwright");
const [, , CASE = "admin", WIDTH = "1366"] = process.argv;
const C = {
  admin: { email: "steel.macdonald@welfareavenue.com", name: "Steel MacDonald", role: "staff", patch: [] },
  opsto: { email: "tate.weinstein@welfareavenue.com", name: "Tate Weinstein", role: "staff", patch: [{ email: "tate.weinstein@welfareavenue.com", role: "member", profile: "opsto" }] },
  mktlead: { email: "kahkashan.ansary@welfareavenue.com", name: "Kahkashan Ansary", role: "staff", patch: [{ email: "kahkashan.ansary@welfareavenue.com", role: "leader", profile: "marketing" }] },
  board: { email: "consult.tamaraangeline@gmail.com", name: "Tamara Angeline", role: "board", patch: [] },
  classic: { email: "tate.weinstein@welfareavenue.com", name: "Tate Weinstein", role: "staff", patch: [] }
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
  await page.waitForTimeout(3200);
  /* wave131 moved Access profiles into People and access; the old card lives behind the classic view */
  if (process.env.CLASSIC) await page.evaluate(() => { document.body.classList.add('w131classic'); });
  const ev = (f, a) => page.evaluate(f, a);
  const hash = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(1200); };
  const click = async sel => { const el = await page.$(sel); if (!el) return false; await el.click(); await page.waitForTimeout(450); return true; };
  const shot = async n => { try { await page.screenshot({ path: "/tmp/w127_" + CASE + "_" + WIDTH + "_" + n + ".png", fullPage: !!process.env.FULL }); } catch (e) { /* fine */ } };
  const allowed = () => ev(() => (wa40Allowed() || []).slice().sort());
  const shown = () => ev(() => Array.from(document.querySelectorAll('#tabBar .tab')).filter(t => t.style.display !== 'none' && t.offsetParent !== null || (t.style.display !== 'none' && t.closest('.w42sub'))).map(t => t.dataset.tab).filter(Boolean).sort());
  const phone = Number(WIDTH) < 800;

  async function mine(expectTitle) {
    await ev(() => w127.open());
    await page.waitForTimeout(500);
    const s = await ev(() => ({ on: document.getElementById('w127sheet').classList.contains('on'), kk: (document.querySelector('#w127sheet .kk') || {}).textContent, t: (document.querySelector('#w127sheet h2') || {}).textContent, body: (document.querySelector('#w127sheet .pb') || {}).textContent || '' }));
    ok("Your access: " + expectTitle, s.on && s.kk === 'Your access' && s.t === expectTitle, JSON.stringify(s).slice(0, 300));
    await shot('mine');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    return s;
  }

  if (CASE === 'admin') {
    /* the profile menu has the item */
    if (!phone) {
      await click('#w115btn');
      const item = await ev(() => !!document.querySelector('#w115menu [data-w127mine]'));
      ok("the profile menu has Your access", item);
      if (item) { await click('#w115menu [data-w127mine]'); await page.waitForTimeout(600); ok("it opens the sheet", await ev(() => document.getElementById('w127sheet').classList.contains('on') && /Admin/.test(document.querySelector('#w127sheet h2').textContent))); await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
    }
    await hash('#adminpanel/access');
    await page.waitForTimeout(800);
    const a = await ev(() => { const h = document.getElementById('w127'); const nav = Array.from(document.querySelectorAll('#adminpanel nav.w118adm a')).map(x => x.textContent); return { nav, on: (document.querySelector('#adminpanel nav.w118adm a.on') || {}).textContent, mast: (document.querySelector('#adminpanel > .w118mast h1') || {}).textContent, vis: !!(document.getElementById('w127card') && document.getElementById('w127card').offsetParent), cards: h.querySelectorAll('.w127pc').length, heads: h.querySelectorAll('.w127tbl thead th').length, rows: h.querySelectorAll('.w127tbl tbody tr[data-w127row]').length, top: (h.querySelector('.w127stat') || {}).textContent || '', ppl: h.querySelectorAll('.w127ppl tbody tr').length, chips: Array.from(h.querySelectorAll('.w127chips a')).map(x => x.textContent), others: Array.from(document.querySelectorAll('#adminpanel > .card')).filter(c => c.id !== 'w127card' && c.offsetParent).map(c => c.id) }; });
    ok("Admin has an Access profiles section after People and access", a.nav.indexOf('Access profiles') === a.nav.indexOf('People and access') + 1 && a.on === 'Access profiles', JSON.stringify(a.nav));
    ok("only the Access profiles card shows", a.vis && a.others.length === 0, JSON.stringify(a.others));
    ok("nine profile cards", a.cards === 9, a.cards);
    ok("the table: nine profiles, every page", a.heads === 10 && a.rows >= 35, a.heads + ' / ' + a.rows);
    ok("where it stands: only the admins, nobody else's access changed", /\d+of \d+ people on a profile/.test(a.top) && /Admins count as the Admin profile/.test(a.top) && /Nobody else has a profile yet/.test(a.top), a.top.slice(0, 200));
    ok("the proposal lists people", a.ppl >= 4 && /Proposed changes/.test(a.chips[0]), JSON.stringify(a.chips));
    await shot('access');
    const cards = await ev(() => Array.from(document.querySelectorAll('#w127 .w127pc')).map(c => ({ id: c.id, t: c.querySelector('h3').textContent, n: c.querySelector('.w127nums').textContent, out: c.querySelector('.w127out').textContent })));
    const mk = cards.filter(c => c.id === 'w127pc-marketing')[0] || {}, fu = cards.filter(c => c.id === 'w127pc-fundraising')[0] || {}, bo = cards.filter(c => c.id === 'w127pc-board')[0] || {}, ad = cards.filter(c => c.id === 'w127pc-admin')[0] || {};
    ok("Marketing: leaves out Finances and the Hub inbox, leads get more", /Finances/.test(mk.out) && /Hub inbox/.test(mk.out) && /Leads also get/.test(mk.out) && /Agendas/.test(mk.out), JSON.stringify(mk));
    ok("Fundraising opens Finances", !/Leaves out:.*Finances/.test(fu.out), fu.out);
    ok("Board: eight pages", /^8 pages/.test(bo.n), bo.n);
    ok("Admin leaves nothing out", /Nothing is left out/.test(ad.out), ad.out);
    /* change a cell, undo */
    await click('#w127 [data-w127cell="marketing|finances"]');
    const c1 = await ev(() => ({ v: document.querySelector('#w127 [data-w127cell="marketing|finances"]').innerHTML, bar: (document.querySelector('#w127 .w127save') || {}).textContent || '' }));
    ok("click a cell: Finances for Marketing becomes everyone, not saved yet", /class="all"/.test(c1.v) && /1 change not saved yet/.test(c1.bar), JSON.stringify(c1));
    await click('#w127 [data-w127cell="marketing|finances"]');
    ok("click again: leads only", await ev(() => /Leads/.test(document.querySelector('#w127 [data-w127cell="marketing|finances"]').textContent)));
    await click('#w127 [data-w127undo]');
    ok("undo", await ev(() => !document.querySelector('#w127 .w127save') && /class="none"/.test(document.querySelector('#w127 [data-w127cell="marketing|finances"]').innerHTML)));
    ok("Admin's column cannot be changed", await ev(() => !document.querySelector('#w127 [data-w127cell^="admin|"]')));
    /* save the matrix (the stub accepts the write) */
    await click('#w127 [data-w127cell="opsto|contentcal"]');
    await click('#w127 [data-w127save]');
    await page.waitForTimeout(700);
    ok("save for everyone", await ev(() => !document.querySelector('#w127 .w127save')));
    /* a profile sheet */
    await click('#w127 [data-w127prof="fundraising"]');
    const ps = await ev(() => ({ t: (document.querySelector('#w127sheet h2') || {}).textContent, body: (document.querySelector('#w127sheet .pb') || {}).textContent || '', off: Array.from(document.querySelectorAll('#w127sheet .w127tags span.off')).map(s => s.textContent), lead: Array.from(document.querySelectorAll('#w127sheet .w127tags span.lead')).map(s => s.textContent) }));
    ok("a profile's sheet: its pages, what the database adds, who has it", ps.t === 'Fundraising & Finances' && /What the database adds/.test(ps.body) && /Finances:/.test(ps.body) && ps.off.indexOf('Hub inbox') >= 0 && ps.lead.some(x => /Agendas/.test(x)), JSON.stringify(ps).slice(0, 400));
    await shot('profile');
    await click('#w127sheet [data-w127pedit]');
    ok("edit the words", await ev(() => !!document.querySelector('#w127sheet form[data-w127form="fundraising"] textarea[name=can]') && /Add and update fundraising events/.test(document.querySelector('#w127sheet textarea[name=can]').value)));
    await page.fill('#w127sheet input[name=label]', '');
    await click('#w127sheet [data-w127psave]');
    ok("a name is required", await ev(() => /Give the profile a name/.test(document.querySelector('#w127sheet .err').textContent)));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    /* the proposal */
    const pr = await ev(() => Array.from(document.querySelectorAll('#w127 .w127ppl tbody tr')).map(r => r.textContent));
    ok("Kahkashan: Marketing (lead), loses Finances and the Hub inbox", pr.some(t => /Kahkashan/.test(t) && /Marketing \(lead\)/.test(t) && /Loses .*Finances/.test(t) && /Hub inbox/.test(t)), JSON.stringify(pr.filter(t => /Kahkashan/.test(t))));
    ok("Tate: Operations Toronto, when he first signs in", pr.some(t => /Tate/.test(t) && /Operations Toronto/.test(t) && /first sign in/.test(t)), JSON.stringify(pr.filter(t => /Tate/.test(t))));
    const look = await ev(() => Array.from(document.querySelectorAll('#w127 .w127warn')).map(w => w.textContent));
    ok("worth a look: too many admins", look.some(t => /people are admins/.test(t)), JSON.stringify(look).slice(0, 400));
    await click('#w127 [data-w127apply="kahkashan.ansary@welfareavenue.com"]');
    const ap = await ev(() => ({ t: (document.querySelector('#w127sheet h2') || {}).textContent, body: (document.querySelector('#w127sheet .pb') || {}).textContent || '', auto: !!document.querySelector('#w127sheet input[name=auto]') }));
    ok("apply one: the preview", ap.t === 'Kahkashan' && /Marketing \(lead\)/.test(ap.body) && /Loses/.test(ap.body) && ap.auto, JSON.stringify(ap).slice(0, 300));
    await click('#w127sheet [data-w127doapply]');
    await page.waitForTimeout(900);
    ok("apply: done (the stub keeps the fixture as it was)", await ev(() => !document.getElementById('w127sheet').classList.contains('on')));
    await click('#w127 [data-w127applyall]');
    const all = await ev(() => ({ t: (document.querySelector('#w127sheet h2') || {}).textContent, n: document.querySelectorAll('#w127sheet .chg > div').length }));
    ok("apply the whole proposal: the preview lists everyone", /people/.test(all.t) && all.n >= 4, JSON.stringify(all));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await click('#w127 [data-w127f="all"]');
    ok("the Everyone filter", await ev(() => document.querySelectorAll('#w127 .w127ppl tbody tr').length > 20));
    const ev2 = await ev(() => Array.from(document.querySelectorAll('#w127 .w127ppl tbody tr')).map(r => r.textContent));
    ok("people without an email: no access until they have one", ev2.some(t => /Kellian/.test(t) && /Needs an email/.test(t)), JSON.stringify(ev2.filter(t => /Kellian/.test(t))));
    /* People and access: the Access column */
    await hash('#adminpanel/people');
    await page.waitForTimeout(900);
    const pa = await ev(() => { const s = document.querySelector('#w113tbl select[data-w127acc="steel.macdonald@welfareavenue.com"]'); const k = document.querySelector('#w113tbl select[data-w127acc="kahkashan.ansary@welfareavenue.com"]'); return { s: s ? s.value : null, k: k ? k.value : null, groups: s ? Array.from(s.querySelectorAll('optgroup')).map(g => g.label) : [], n: document.querySelectorAll('#w113tbl select[data-w127acc]').length, classic: document.querySelectorAll('#w113tbl select[data-w40r]').length }; });
    ok("People and access: the Access column picks a profile", pa.n > 5 && pa.classic === 0 && pa.s === 'r:admin' && pa.k === 'r:leader' && pa.groups[0] === 'Access profiles', JSON.stringify(pa));
    await shot('people');
    /* the admin tour stops at the profiles */
    ok("the Admin tour has a stop for access profiles", await ev(() => { const t = window.w122 && w122.tours && w122.tours.adminpanel; return !!t && t.steps.some(s => (s.s === '#w127card' || s.s === '#w131card .w131pgrid') && s.hash === '#adminpanel/access'); }));
    await mine('Admin');
  }

  if (CASE === 'opsto') {
    const a = await allowed();
    const want = ['calendar', 'create', 'dashboard', 'fundevents', 'fundraising', 'goalmap', 'goals', 'hr', 'importantinfo', 'marketing', 'mypage', 'opsmtl', 'opsto', 'orgchart', 'orggoals', 'overview', 'photos', 'progdev', 'projects', 'requests', 'team', 'training', 'transcripts', 'volunteering', 'brain', 'bank'].sort();
    ok("Operations Toronto: exactly the profile's pages", JSON.stringify(a) === JSON.stringify(want), JSON.stringify(a));
    const s = await shown();
    ok("the menu hides what the profile leaves out", ['finances', 'contentcal', 'socialstats', 'agendas', 'hubmail', 'activity', 'hrcentre', 'governance', 'committees', 'board', 'adminpanel'].every(t => s.indexOf(t) < 0) && s.indexOf('opsto') >= 0 && s.indexOf('calendar') >= 0, JSON.stringify(s));
    await hash('#finances');
    ok("a page outside the profile goes back to the dashboard", await ev(() => document.querySelector('.panel.active').id !== 'finances'));
    await hash('#adminpanel/access');
    ok("no Admin", await ev(() => document.querySelector('.panel.active').id !== 'adminpanel'));
    ok("the ledger tile is hidden", await ev(() => document.body.classList.contains('w127nofin')));
    const m = await mine('Operations Toronto');
    ok("Your access: not in your profile lists Finances", /Not in your profile/.test(m.body) && /Finances/.test(m.body.split('Not in your profile')[1] || ''), m.body.slice(-300));
    await hash('#team/opsto');
    ok("the team page still opens", await ev(() => document.querySelector('.panel.active').id === 'team'));
  }

  if (CASE === 'mktlead') {
    const a = await allowed();
    ok("Marketing lead: the lead pages", ['contentcal', 'socialstats', 'agendas', 'activity', 'hrcentre', 'governance', 'committees', 'board'].every(t => a.indexOf(t) >= 0) && ['finances', 'hubmail', 'adminpanel'].every(t => a.indexOf(t) < 0), JSON.stringify(a));
    const s = await shown();
    ok("the HR centre shows for a lead through the profile", s.indexOf('hrcentre') >= 0, JSON.stringify(s));
    await hash('#hrcentre');
    ok("and opens (not the HR-list refusal)", await ev(() => document.querySelector('.panel.active').id === 'hrcentre' && !document.getElementById('w52denied')));
    ok("the ledger tile is hidden", await ev(() => document.body.classList.contains('w127nofin')));
    await mine('Marketing (lead)');
  }

  if (CASE === 'board') {
    const a = await allowed();
    const want = ['calendar', 'committees', 'contentcal', 'fundevents', 'governance', 'overview', 'photos', 'socialstats'].sort();
    ok("a board viewer: the Board member profile, the same pages as before", JSON.stringify(a) === JSON.stringify(want), JSON.stringify(a));
    await mine('Board member');
  }

  if (CASE === 'classic') {
    const a = await allowed();
    ok("no profile: the classic member pages", a.indexOf('finances') < 0 && a.indexOf('contentcal') >= 0 && a.indexOf('socialstats') >= 0 && a.indexOf('opsto') >= 0, JSON.stringify(a));
    ok("the ledger tile is not touched", await ev(() => !document.body.classList.contains('w127nofin')));
    await mine('Classic access: member');
  }

  if (phone && CASE === 'admin') {
    await hash('#adminpanel/access');
    await page.waitForTimeout(700);
    ok("phone: no sideways scroll", await ev(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await ev(() => document.documentElement.scrollWidth + ' > ' + window.innerWidth));
    await shot('phone');
  }
  ok("no page errors", errs.length === 0, errs.join(' | '));
  console.log(out.join("\n")); console.log(`\n${CASE} ${WIDTH}: ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
