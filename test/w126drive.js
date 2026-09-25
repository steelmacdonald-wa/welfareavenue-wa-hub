/* w126drive.js [role email name width]: drive the board overview (three jobs, directors) and the committees */
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
  await page.waitForTimeout(2800);
  const ev = (f, a) => page.evaluate(f, a);
  const hash = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(1100); };
  const click = async sel => { const el = await page.$(sel); if (!el) return false; await el.click(); await page.waitForTimeout(450); return true; };
  const role = await ev(() => (typeof WA40_MINE !== 'undefined' && WA40_MINE || {}).role || '');
  const board = await ev(() => typeof MODE !== 'undefined' && MODE === 'board');
  const leader = role === 'admin' || role === 'leader';
  const sees = leader || board;
  const director = await ev(() => { const em = (typeof USER !== 'undefined' && USER.email || '').toLowerCase(); return (window.__WAFIX.board_members || []).some(m => m.status === 'active' && (m.emails || []).indexOf(em) >= 0); });

  /* the menu */
  const nav = await ev(() => { const bar = document.getElementById('tabBar'); const g = bar.querySelector('.tab[data-tab="governance"]'), c = bar.querySelector('.tab[data-tab="committees"]'); const br = bar.querySelector('.tab[data-tab="board"]'); const sub = br && br.closest('.w42d') && br.closest('.w42d').querySelector('.w42sub'); const ov = bar.querySelector('.tab[data-tab="overview"]'); return { g: !!g, gShown: !!(g && g.style.display !== 'none'), cShown: !!(c && c.style.display !== 'none'), inBoardRow: !!(g && sub && g.parentNode === sub && sub.firstElementChild === g && g.nextElementSibling === c), afterOverview: !!(g && ov && ov.nextElementSibling === g && g.nextElementSibling === c), teamPage: sub ? Array.from(sub.querySelectorAll('a')).map(a => a.textContent).join('|') : '' }; });
  if (!sees) ok("no board pages for a member", !nav.gShown && !nav.cShown, JSON.stringify(nav));
  else if (board) ok("board viewers: the pages after the Executive dashboard", nav.gShown && nav.cShown && nav.afterOverview, JSON.stringify(nav));
  else ok("the pages lead the Board & Governance menu", nav.gShown && nav.cShown && nav.inBoardRow && /Team page/.test(nav.teamPage), JSON.stringify(nav));

  if (!sees) {
    await hash('#governance');
    ok("a member cannot open the board overview", await ev(() => { const a = document.querySelector('.panel.active'); return !a || a.id !== 'governance' || /for directors, board advisers and leaders/.test((document.getElementById('w126gov') || {}).textContent || ''); }));
  } else {
    if (!board && Number(WIDTH) >= 800) {
      await click('#tabBar .tab[data-tab="board"]');
      await page.waitForTimeout(900);
      ok("the Board & Governance row opens the board overview", await ev(() => location.hash === '#governance' && document.querySelector('.panel.active').id === 'governance'));
    } else await hash('#governance');
    await page.waitForTimeout(900);
    const g = await ev(() => { const h = document.getElementById('w126gov'); const t = s => (h.querySelector(s) || {}).textContent || ''; return { mast: (document.querySelector('#governance > .w118mast h1') || {}).textContent, seg: Array.from(h.querySelectorAll('.w126seg a')).map(a => a.textContent), meet: t('.w126meet'), jobs: h.querySelectorAll('.w126job').length, ren: Array.from(h.querySelectorAll('.w126ren div')).map(d => d.textContent), fin: t('.w126fin'), steps3: h.querySelectorAll('.w126steps3 > div').length, goals: h.querySelectorAll('.w126goal').length, dirs: h.querySelectorAll('.w126dir').length, you: t('.w126dir .me') }; });
    ok("the masthead and the section switcher", g.mast === 'Board overview' && g.seg[0] === 'Overview' && g.seg[1] === 'Committees', JSON.stringify(g.seg));
    ok("the next meeting, the committee deadline, the last minutes, the strategy session", /Q3 board meeting/.test(g.meet) && /October 19/.test(g.meet) && /In 74 days/.test(g.meet) && /October 12/.test(g.meet) && /July 22, 2026/.test(g.meet) && /minutes/.test(g.meet) && /To schedule/.test(g.meet), g.meet);
    ok("three jobs", g.jobs === 3);
    ok("terms and renewals", g.ren.length === 5 && g.ren.some(r => /Kellian.*Renewal due Q3 2026/.test(r)) && g.ren.some(r => /Mohamed.*Term to Q2 2027/.test(r)), JSON.stringify(g.ren));
    ok("the finances", /came in/.test(g.fin) && /went out/.test(g.fin) && /net/.test(g.fin), g.fin);
    ok("the strategy steps and the organizational goals", g.steps3 === 3 && g.goals === 3, g.steps3 + '/' + g.goals);
    const seeDirs = leader && role === 'admin' || board || director;
    if (seeDirs) {
      ok("every director, with you marked", g.dirs === 6 && (director ? g.you === 'You' : true), g.dirs + ' ' + g.you);
      const d = await ev(() => Array.from(document.querySelectorAll('#w126gov .w126dir')).map(c => c.textContent));
      ok("each director's progress", d.some(t => /Kellian Debargis/.test(t) && /1 logged this cycle, 1 recommendation/.test(t) && /3 of 4/.test(t)) && d.some(t => /Tamara/.test(t) && /1 logged this cycle/.test(t)) && d.some(t => /Mohamed Ashr/.test(t) && /Nothing logged this cycle/.test(t)), JSON.stringify(d).slice(0, 300));
    } else ok("leaders do not see each director's progress", g.dirs === 0 && g.seg.indexOf('Directors') < 0, JSON.stringify(g.seg));
    /* done items */
    await click('#w126job-steward [data-w126done]');
    ok("show what is done", await ev(() => document.querySelectorAll('#w126job-steward .w126it.done').length === 1));
    await click('#w126job-steward [data-w126done]');
    ok("and hide it", await ev(() => document.querySelectorAll('#w126job-steward .w126it.done').length === 0));
    /* an item */
    await click('#w126job-fiduciary .w126it');
    const editable = await ev(() => !!document.querySelector('#w126sheet form[data-w126iform]'));
    ok(director || leader ? "items open for update" : "items open read-only", (director || leader) ? editable : !editable && !!document);
    if (editable) {
      await click('#w126sheet [data-w126st="in_progress"]');
      await click('#w126sheet [data-w126isave]');
      await page.waitForTimeout(500);
      ok("the item moves", await ev(() => { const it = w126.state().data.items.filter(i => /financial disclosures/.test(i.title))[0]; return it && it.status === 'in_progress' && /In progress/.test(document.querySelector('#w126job-fiduciary .w126it').textContent); }));
      await click('#w126job-strategy [data-w126newitem]');
      await page.fill('#w126sheet input[name=title]', 'Book the strategy session venue');
      await page.fill('#w126sheet input[name=owner]', 'Kellian');
      await click('#w126sheet [data-w126isave]');
      await page.waitForTimeout(500);
      ok("add an item", await ev(() => Array.from(document.querySelectorAll('#w126job-strategy .w126it b')).some(b => b.textContent === 'Book the strategy session venue')));
    } else { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
    /* a director */
    if (seeDirs) {
      await click('#w126gov .w126dir[data-w126dir="4"]');
      const ds = await ev(() => ({ on: document.getElementById('w126sheet').classList.contains('on'), t: (document.querySelector('#w126sheet h2') || {}).textContent, body: (document.querySelector('#w126sheet .pb') || {}).textContent || '', edit: !!document.querySelector('#w126sheet [data-w126medit]') }));
      ok("a director's sheet", ds.on && /Tamara/.test(ds.t) && /Operations/.test(ds.body) && /Volunteer turnout/.test(ds.body), JSON.stringify(ds).slice(0, 200));
      if (role === 'admin') {
        ok("admins can edit the seat and term", ds.edit);
        await click('#w126sheet [data-w126medit]');
        await page.fill('#w126sheet input[name=renewal]', 'Q2 2027');
        await page.fill('#w126sheet input[name=renewal_due]', '2027-06-30');
        await click('#w126sheet [data-w126msave]');
        await page.waitForTimeout(500);
        ok("the term changes", await ev(() => Array.from(document.querySelectorAll('#w126gov .w126ren div')).some(d => /Tamara.*Term to Q2 2027/.test(d.textContent))));
      } else { ok("no seat editing without admin", !ds.edit); await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
    }

    /* the committees */
    await click('#w126gov .w126seg a[data-w126go="#committees"]');
    await page.waitForTimeout(1000);
    const c = await ev(() => { const h = document.getElementById('w126com'); return { active: document.querySelector('.panel.active').id, how: h.querySelectorAll('.w126how > div').length, cyc: (h.querySelector('.w126cyc') || {}).textContent || '', cards: Array.from(h.querySelectorAll('.w126com')).map(x => x.querySelector('h3').textContent + ':' + x.querySelector('.ch .w126st').textContent), parts: h.querySelectorAll('.w126part').length, log: h.querySelectorAll('[data-w126log]').length, strat: !!h.querySelector('.w126strat .dark') }; });
    ok("the committees page", c.active === 'committees' && c.how === 4 && /July 22/.test(c.cyc) && /October 19/.test(c.cyc) && /October 12/.test(c.cyc) && c.strat, JSON.stringify(c).slice(0, 300));
    ok("four committees and where each stands", c.cards.join() === 'Fundraising:3 of 4 this cycle,HR & People:1 of 4 this cycle,Operations:2 of 4 this cycle,Fiduciary:1 of 4 this cycle', JSON.stringify(c.cards));
    ok(seeDirs ? "each director's part" : "no per-director rows for leaders", seeDirs ? c.parts === 4 : c.parts === 0, c.parts);
    ok(director || role === 'admin' ? "directors can log" : "only directors log", (director || role === 'admin') ? c.log === 4 : c.log === 0, c.log);
    if (director || role === 'admin') {
      const key = board ? 'operations' : 'people';
      await click('#w126com-' + key + ' [data-w126log]');
      ok("the log form", await ev(() => !!document.querySelector('#w126sheet form[data-w126logform]') && document.querySelectorAll('#w126sheet .kinds input').length === 5));
      await click('#w126sheet [data-w126logsave]');
      ok("it asks for what was learned", await ev(() => /Write what you learned/.test((document.querySelector('#w126sheet .err') || {}).textContent || '')));
      await page.check('#w126sheet input[name=kind][value="' + (board ? 'external' : 'internal') + '"]');
      await page.fill('#w126sheet input[name=with_whom]', board ? 'A logistics manager' : 'Valex');
      await page.fill('#w126sheet textarea[name=summary]', 'Onboarding takes too long; the first shift should come sooner.');
      await click('#w126sheet [data-w126logsave]');
      await page.waitForTimeout(700);
      const after = await ev(k => { const card = document.getElementById('w126com-' + k); return { st: card.querySelector('.ch .w126st').textContent, log: card.querySelector('.w126log').textContent, part: (card.querySelector('.w126part') || {}).textContent || '' }; }, key);
      ok("the touchpoint counts", after.st === (board ? '3 of 4 this cycle' : '2 of 4 this cycle') && /Onboarding takes too long/.test(after.log), JSON.stringify(after).slice(0, 300));
      if (director) ok("it shows under the director", /1 (internal touchpoint|external working session)/.test(after.part), after.part);
      /* change it */
      await click('#w126com-' + key + ' .w126lg');
      await click('#w126sheet [data-w126tpedit]');
      await page.fill('#w126sheet textarea[name=recommendation]', 'Start new volunteers within two weeks.');
      await click('#w126sheet [data-w126logsave]');
      await page.waitForTimeout(600);
      ok("change your own entry", await ev(k => w126.state().data.touchpoints.some(t => t.committee === k && t.recommendation === 'Start new volunteers within two weeks.'), key));
      ok("a recommendation completes the cycle step", await ev(k => w126.steps(w126.state().data.committees.filter(c => c.key === k)[0])[3].done, key));
    }
    /* editing a committee */
    const canEditC = await ev(() => !!document.querySelector('#w126com [data-w126cedit]'));
    if (leader || board) {
      ok(leader ? "leaders edit committees" : "the chair edits their committee", leader ? canEditC : await ev(() => !!document.querySelector('#w126com-operations [data-w126cedit]') && !document.querySelector('#w126com-fundraising [data-w126cedit]')));
      const ck = leader ? 'fundraising' : 'operations';
      await click('#w126com-' + ck + ' [data-w126cedit]');
      await page.check('#w126sheet input[name=chair_confirmed]');
      await click('#w126sheet [data-w126csave]');
      await page.waitForTimeout(600);
      ok("confirming the chair drops the proposed tag", await ev(k => !/proposed/.test(document.querySelector('#w126com-' + k + ' .w126ros').textContent), ck));
    }
    /* the meeting */
    if (leader) {
      await hash('#governance');
      await click('#w126gov .w126meet [data-w126meet]');
      await page.fill('#w126sheet input[name=date]', '2026-10-20');
      await page.selectOption('#w126sheet select[name=status]', 'scheduled');
      await click('#w126sheet [data-w126meetsave]');
      await page.waitForTimeout(700);
      const m = await ev(() => ({ meet: document.querySelector('#w126gov .w126meet').textContent, iso: w126.cycle().next && w126.cycle().next.meets_at }));
      ok("reschedule the board meeting", /Tuesday, October 20, 6pm/.test(m.meet) && !/tentative/.test(m.meet) && /October 13/.test(m.meet) && /2026-10-20T18:00:00-04:00/.test(m.iso || ''), JSON.stringify(m));
    }
    /* deep links, the team page pills, Escape */
    await hash('#committees/operations');
    await page.waitForTimeout(600);
    ok("a deep link to a committee", await ev(() => { const el = document.getElementById('w126com-operations'); const r = el.getBoundingClientRect(); return r.top < 300 && r.top > -50; }));
    if (!board) {
      await hash('#team/board/tasks');
      await page.waitForTimeout(1300);
      ok("the team page links back to the board pages", await ev(() => !!document.querySelector('#team .w116seg [data-w126go="#governance"]') && !!document.querySelector('#team .w116seg [data-w126go="#committees"]')));
    }
    await hash('#committees');
    await click('#w126com .w126lg');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    ok("Escape closes the sheet", await ev(() => !document.getElementById('w126sheet') || !document.getElementById('w126sheet').classList.contains('on')));
  }
  const e2 = errs.filter(e => !/ERR_FAILED|Failed to fetch|NetworkError/.test(e));
  ok("no page errors", e2.length === 0, JSON.stringify(e2.slice(0, 4)));
  console.log(out.join("\n"));
  console.log("RESULT " + pass + " passed, " + fail + " failed (" + ROLE + " " + EMAIL + " " + WIDTH + ")");
  await browser.close();
})();
