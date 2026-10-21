/* w123drive.js [role email name width]: drive the wave123 Requests page and the team inbox card through their flows */
const fs = require("fs"); const path = require("path"); const { chromium } = require("playwright");
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", WIDTH = "1366"] = process.argv;
const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8"), stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8"), fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push("PASS " + name); } else { fail++; out.push("FAIL " + name + (extra ? " :: " + String(extra).slice(0, 300) : "")); } }
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await (await browser.newContext({ viewport: { width: Number(WIDTH), height: 900 } })).newPage();
  const errs = []; page.on("pageerror", e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(`(function(){ var FIXED = new Date("2026-08-06T12:00:00-04:00").getTime(); var RealDate = Date; function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } } FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate; window.__WA_TEST_ROLE = ${JSON.stringify(ROLE)}; window.__WA_TEST_EMAIL = ${JSON.stringify(EMAIL)}; window.__WA_TEST_NAME = ${JSON.stringify(NAME)}; window.confirm = function(){ return true; }; try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa262.seen', '1'); localStorage.setItem('wa112done', '1'); } catch (e) {} })();`);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.route("**/*", route => { const url = route.request().url(); if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html }); if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") }); if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub }); return route.abort(); });
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const staff = await page.evaluate(() => typeof isStaff === 'function' && isStaff());
  const hash = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(700); };
  const ev = f => page.evaluate(f);
  const click = async sel => { const el = await page.$(sel); if (!el) return false; await el.click(); await page.waitForTimeout(450); return true; };

  await hash("#requests");
  if (!staff) {
    const r = await ev(() => ({ on: !!document.querySelector('#requests.w123on'), w: !!document.getElementById('w123'), txt: (document.getElementById('reqBody') || {}).textContent || '' }));
    ok("non-staff: no takeover", !r.on && !r.w, JSON.stringify(r));
    ok("non-staff: staff-only message", /staff accounts only/i.test(r.txt), r.txt.slice(0, 120));
  } else {
    const home = await ev(() => ({ on: !!document.querySelector('#requests.w123on'), tiles: document.querySelectorAll('#w123 .w123team').length, nav: document.querySelectorAll('#w123 .w123seg a').length, sug: document.querySelectorAll('#w123 .w123row.sug').length, mast: (document.querySelector('#requests > .w118mast > p') || {}).textContent || '', old: getComputedStyle(document.querySelector('#requests > .card') || document.body).display }));
    ok("takeover on", home.on);
    ok("seven team tiles", home.tiles === 7, home.tiles);
    ok("nav tabs", home.nav >= 3, home.nav);
    ok("meeting suggestions listed", home.sug >= 1, home.sug);
    ok("masthead text", /follow it through to done/.test(home.mast), home.mast);
    ok("old card hidden", home.old === 'none', home.old);

    /* search */
    await page.fill('#w123 [data-w123q]', 'flyer');
    await page.waitForTimeout(300);
    const s1 = await ev(() => ({ rows: Array.from(document.querySelectorAll('#w123qres .w123type b')).map(b => b.textContent), tiles: (document.getElementById('w123tiles') || {}).style ? document.getElementById('w123tiles').style.display : '?' }));
    ok("search finds printing and design", s1.rows.some(t => /Printing/.test(t)) && s1.rows.some(t => /Design/.test(t)), JSON.stringify(s1.rows));
    ok("search hides the tiles", s1.tiles === 'none', s1.tiles);
    await page.fill('#w123 [data-w123q]', 'zzzzqqq');
    await page.waitForTimeout(300);
    ok("search with no match explains", await ev(() => /Nothing matches/.test((document.getElementById('w123qres') || {}).textContent || '')));
    await page.fill('#w123 [data-w123q]', '');
    await page.waitForTimeout(300);
    ok("clearing search shows tiles", await ev(() => document.getElementById('w123tiles').style.display === ''));

    /* team, need, form */
    await click('#w123 [data-w123team="marketing"]');
    const t2 = await ev(() => ({ h: location.hash, rows: document.querySelectorAll('#w123 .w123types .w123type').length, other: !!document.querySelector('#w123 .w123type[data-w123type="other"]') }));
    ok("team step", t2.h === '#requests/new/marketing' && t2.rows >= 6 && t2.other, JSON.stringify(t2));
    await click('#w123 .w123type[data-w123type="design-request"]');
    const f1 = await ev(() => ({ h: location.hash, form: !!document.querySelector('#w123 form[data-w123form="design-request"]'), aside: (document.querySelector('#w123 .w123aside') || {}).textContent || '' }));
    ok("form step", f1.h === '#requests/new/marketing/design-request' && f1.form, JSON.stringify(f1).slice(0, 200));
    ok("aside names the channel", /#social-media/.test(f1.aside), f1.aside.slice(0, 160));
    await click('#w123 [data-w123send]');
    const f2 = await ev(() => ({ err: (document.querySelector('#w123 [data-w123err]') || {}).textContent || '', bad: document.querySelectorAll('#w123 form .bad').length }));
    ok("empty submit is caught", /Fill in/.test(f2.err) && f2.bad >= 3, JSON.stringify(f2));
    await page.fill('#w123ft', 'Poster for the harvest supper');
    await page.fill('#w123 form [name="f0"]', 'Poster, 11x17');
    await page.fill('#w123 form [name="f1"]', 'Harvest supper on October 4, new brand colours.');
    await page.fill('#w123 form [name="f3"]', '2026-08-20');
    await page.check('#w123 form [name="__urgent"]');
    /* the draft survives going back and forth */
    await hash('#requests/new/marketing');
    await hash('#requests/new/marketing/design-request');
    ok("draft kept", await ev(() => document.getElementById('w123ft').value === 'Poster for the harvest supper'));
    await click('#w123 [data-w123send]');
    await page.waitForTimeout(600);
    const sent = await ev(() => { const R = w123.state(); const r = R.reqs[0]; return { h: location.hash, done: !!document.querySelector('#w123 .w123done'), txt: (document.querySelector('#w123 .w123done h2') || {}).textContent, r: { title: r.title, d: r.department, prio: r.priority, need: r.needed_by, email: r.requested_email, src: r.source, det: r.details, type: r.type_key } }; });
    ok("sent screen", sent.done && /Sent to/.test(sent.txt || ''), JSON.stringify(sent).slice(0, 200));
    ok("hash moved to sent", /^#requests\/sent\//.test(sent.h), sent.h);
    ok("request row", sent.r.title === 'Poster for the harvest supper' && sent.r.d === 'marketing' && sent.r.prio === 'urgent' && sent.r.need === '2026-08-20' && sent.r.src === 'requests' && sent.r.type === 'design-request', JSON.stringify(sent.r));
    ok("requested_email set", sent.r.email === EMAIL.toLowerCase(), sent.r.email);
    ok("details by label", sent.r.det && sent.r.det['Item to design'] === 'Poster, 11x17', JSON.stringify(sent.r.det));

    /* the sheet */
    await click('#w123 .w123done [data-w123go^="#requests/r/"]');
    await page.waitForTimeout(500);
    const sh = await ev(() => ({ on: document.getElementById('w123sheet').classList.contains('on'), h2: (document.querySelector('#w123sheet h2') || {}).textContent, steps: document.querySelectorAll('#w123sheet .w123steps .st').length, h: location.hash }));
    ok("sheet opens on the request", sh.on && sh.h2 === 'Poster for the harvest supper' && sh.steps >= 3, JSON.stringify(sh));
    await page.selectOption('#w123sheet select[data-w123st]', { index: 1 });
    await page.waitForTimeout(400);
    const st1 = await ev(() => { const R = w123.state(); return R.reqs[0].status; });
    ok("status changes", st1 && st1.toLowerCase() === 'received', st1);
    await page.selectOption('#w123sheet select[data-w123as]', 'Ian');
    await page.waitForTimeout(400);
    ok("assign", await ev(() => w123.state().reqs[0].assignee === 'Ian'));
    await page.fill('#w123sheet textarea[data-w123note]', 'Can you use the gold version of the logo?');
    await click('#w123sheet [data-w123addnote]');
    await page.waitForTimeout(400);
    ok("note added to the timeline", await ev(() => /gold version of the logo/.test(document.querySelector('#w123sheet .w123tl').textContent)));
    await click('#w123sheet [data-w123done]');
    ok("mark done", await ev(() => w123.state().reqs[0].done === true && !!document.querySelector('#w123sheet [data-w123reopen]')));
    await click('#w123sheet [data-w123reopen]');
    ok("reopen", await ev(() => w123.state().reqs[0].done === false));
    await click('#w123sheet .w123steps .st:last-child');
    ok("last step marks done", await ev(() => w123.state().reqs[0].done === true));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const cl = await ev(() => ({ on: document.getElementById('w123sheet').classList.contains('on'), h: location.hash }));
    ok("Escape closes and restores the hash", !cl.on && !/\/r\//.test(cl.h), JSON.stringify(cl));

    /* my requests */
    await hash('#requests/mine');
    const mine = await ev(() => ({ rows: Array.from(document.querySelectorAll('#w123 .w123row .t')).map(t => t.textContent) }));
    ok("my requests lists it", mine.rows.includes('Poster for the harvest supper'), JSON.stringify(mine.rows).slice(0, 200));

    /* general request */
    await hash('#requests/new/progdev/other');
    await page.fill('#w123ft', 'Survey results for the impact report');
    await page.fill('#w123fw', 'The spring survey results, by city.');
    await click('#w123 [data-w123send]');
    await page.waitForTimeout(500);
    const g = await ev(() => { const r = w123.state().reqs[0]; return { t: r.title, type: r.type_key, det: r.details }; });
    ok("general request", g.t === 'Survey results for the impact report' && g.type === null && g.det['What is needed'] === 'The spring survey results, by city.', JSON.stringify(g));

    /* team inbox */
    await hash('#requests/team/marketing');
    const inb = await ev(() => ({ r: document.querySelectorAll('#w123 .w123list [data-w123r]').length, m: document.querySelectorAll('#w123 .w123list [data-w123m]').length, s: document.querySelectorAll('#w123 .w123list [data-w123s]').length, chip: !!document.querySelector('#w123 .w123chip.on') }));
    ok("inbox has requests, emails and suggestions", inb.r >= 2 && inb.m >= 1 && inb.s >= 1 && inb.chip, JSON.stringify(inb));
    await click('#w123 [data-w123tmk="m"]');
    ok("emails filter", await ev(() => document.querySelectorAll('#w123 .w123list [data-w123r], #w123 .w123list [data-w123s]').length === 0 && document.querySelectorAll('#w123 .w123list [data-w123m]').length >= 1));
    await click('#w123 [data-w123tmk="s"]');
    ok("suggestions filter", await ev(() => document.querySelectorAll('#w123 .w123list [data-w123s]').length >= 1 && document.querySelectorAll('#w123 .w123list [data-w123m]').length === 0));
    await click('#w123 [data-w123tmk="all"]');
    await click('#w123 .w123list [data-w123m="6"]');
    await page.waitForTimeout(500);
    const ms = await ev(() => ({ on: document.getElementById('w123sheet').classList.contains('on'), jev: (document.querySelector('#w123sheet .w123jevbox') || {}).textContent || '', h: location.hash }));
    ok("email sheet with Jev's call", ms.on && /Jev pinged/.test(ms.jev) && ms.h === '#requests/m/6', JSON.stringify(ms).slice(0, 200));
    await click('#w123sheet [data-w123mbody]');
    await page.waitForTimeout(400);
    ok("email body loads", await ev(() => /co-branded flyer/.test((document.querySelector('#w123sheet') || {}).textContent)));
    await click('#w123sheet [data-w123mconv]');
    await page.waitForTimeout(700);
    const cv = await ev(() => { const R = w123.state(); const m = R.mail.filter(x => x.id === 6)[0]; const r = R.reqs[0]; return { state: m.team_state, rid: m.request_id, src: r.source, mail: r.mail_id, by: r.requested_by, email: r.requested_email, h: location.hash, h2: (document.querySelector('#w123sheet h2') || {}).textContent }; });
    ok("make it a request", cv.state === 'request' && cv.src === 'email' && cv.mail === 6 && cv.by === 'Dana (YMCA)' && cv.email === null, JSON.stringify(cv));
    ok("the request opens", /^#requests\/r\//.test(cv.h) && /YMCA/.test(cv.h2 || ''), JSON.stringify(cv));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);

    /* suggestions */
    await hash('#requests/team/marketing');
    const before = await ev(() => w123.state().sugs.length);
    await click('#w123 .w123list [data-w123sacc]');
    await page.waitForTimeout(600);
    const acc = await ev(() => { const R = w123.state(); const r = R.reqs[0]; return { n: R.sugs.length, src: r.source, by: r.requested_by, det: r.details }; });
    ok("accept a suggestion", acc.n === before - 1 && acc.src === 'meeting' && /^Meeting AI \(accepted by /.test(acc.by) && acc.det && acc.det['From the meeting'], JSON.stringify(acc).slice(0, 240));
    await click('#w123 .w123list [data-w123sx]');
    await page.waitForTimeout(400);
    ok("dismiss a suggestion", await ev(() => w123.state().sugs.length) === before - 2);

    /* the team page card */
    await hash('#team/marketing');
    await page.waitForTimeout(1200);
    const card = await ev(() => { const c = document.getElementById('w123tcard'); const col = document.querySelector('#w116host .w116grid > .w116col'); return { c: !!c, first: !!(c && col && col.firstElementChild === c), rows: c ? c.querySelectorAll('.w123row').length : 0, sum: c ? (c.querySelector('.w123tsum') || {}).textContent : '' }; });
    ok("team inbox card on the overview", card.c && card.first && card.rows >= 1 && card.rows <= 5, JSON.stringify(card));
    const h0 = await ev(() => location.hash);
    await click('#w123tcard [data-w123r]');
    await page.waitForTimeout(500);
    const inPlace = await ev(() => ({ on: document.getElementById('w123sheet').classList.contains('on'), h: location.hash, team: document.querySelector('.panel.active').id }));
    ok("card rows open in place", inPlace.on && inPlace.h === h0 && inPlace.team === 'team', JSON.stringify(inPlace));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    ok("closing keeps the team page", await ev(() => location.hash) === h0);
    /* the card survives a re-render of the team page */
    await ev(() => { if (window.w116Route) window.w116Route(); });
    await page.waitForTimeout(900);
    ok("card comes back after a re-render", await ev(() => !!document.getElementById('w123tcard')));
    await hash('#team/marketing/tasks');
    await page.waitForTimeout(800);
    ok("no card on the tasks page", await ev(() => !document.getElementById('w123tcard')));

    /* time off */
    await hash('#requests/new/hr/time-off');
    await click('#w123 [data-w123timeoff]');
    await page.waitForTimeout(500);
    ok("time off opens its own form", await ev(() => /Request time off/i.test((document.querySelector('.modal.open, .modal-bg.open, #modal, .m-wrap') || document.body).textContent)));
    await ev(() => { try { closeModal(); } catch (e) {} });

    /* deep link to a request that did not post */
    await hash('#requests/r/12');
    await page.waitForTimeout(600);
    const dl = await ev(() => ({ on: document.getElementById('w123sheet').classList.contains('on'), slk: (document.querySelector('#w123sheet .w123slk') || {}).textContent || '', repost: !!document.querySelector('#w123sheet [data-w123repost]') }));
    ok("deep link shows the Slack problem", dl.on && /Not posted/.test(dl.slk) && dl.repost, JSON.stringify(dl));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);

    /* all requests and settings (leaders) */
    const leader = await ev(() => { try { return ['admin', 'leader'].indexOf(WA40_MINE.role) >= 0; } catch (e) { return false; } });
    await hash('#requests/all');
    const all = await ev(() => ({ v: w123.state().view, rows: document.querySelectorAll('#w123 .w123list [data-w123r]').length }));
    ok(leader ? "all requests for leaders" : "all requests falls back for members", leader ? (all.v === 'all' && all.rows >= 3) : all.v === 'mine', JSON.stringify(all));
    await hash('#requests/settings');
    await page.waitForTimeout(600);
    const st = await ev(() => ({ v: w123.state().view, rows: document.querySelectorAll('#w123 .w123set').length, dis: !!document.querySelector('#w123 [data-w123cfgch][disabled]'), save: !!document.querySelector('#w123 [data-w123save]') }));
    if (leader) {
      ok("settings rows", st.v === 'settings' && st.rows === 7, JSON.stringify(st));
      const admin = await ev(() => WA40_MINE.role === 'admin');
      if (admin) {
        await page.fill('#w123 [data-w123cfgch="opsto"]', 'general-toronto');
        await ev(() => { const i = document.querySelector('#w123 [data-w123cfgch="opsto"]'); i.dispatchEvent(new Event('change', { bubbles: true })); });
        await page.selectOption('#w123 [data-w123cfgem="marketing"]', 'always');
        await click('#w123 [data-w123save]');
        await page.waitForTimeout(500);
        const cfg = await ev(() => w123.state().cfg);
        ok("settings save", cfg.channels.opsto.join(',') === 'general-toronto' && cfg.email_mode.marketing === 'always', JSON.stringify(cfg).slice(0, 200));
      } else ok("settings read-only for leaders", st.dis && !st.save, JSON.stringify(st));
    } else ok("settings hidden for members", st.v !== 'settings', JSON.stringify(st));

    /* keyboard: a row opens with Enter */
    await hash('#requests/mine');
    await page.focus('#w123 .w123row[data-w123r]');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    ok("Enter opens a row", await ev(() => document.getElementById('w123sheet').classList.contains('on')));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);

    /* the Hub inbox page keeps working */
    if (leader) {
      await hash('#hubmail');
      await page.waitForTimeout(1500);
      ok("Hub inbox page renders", await ev(() => document.querySelectorAll('#w116mailhost .w116mr').length >= 1));
    }
  }
  const e2 = errs.filter(e => !/ERR_FAILED|Failed to fetch|NetworkError/.test(e));
  ok("no page errors", e2.length === 0, JSON.stringify(e2.slice(0, 4)));
  console.log(out.join("\n"));
  console.log("RESULT " + pass + " passed, " + fail + " failed (" + ROLE + " " + EMAIL + ")");
  await browser.close();
})();
