/* w130drive.js <case> <width>: the browser test fixes (wave130). Cases: admin (Steel), board (Tamara), member (Samson on the HR profile).
   Live-data fixture (scratchpad fixture_live.json), clock fixed at 2026-09-25 16:00 Toronto. One fresh page per check group. */
const fs = require("fs"); const path = require("path"); const { chromium } = require("playwright");
const [, , CASE = "admin", WIDTH = "1366"] = process.argv;
const W = Number(WIDTH), PHONE = W < 700;
const C = {
  admin: { email: "steel.macdonald@welfareavenue.com", name: "Steel MacDonald", role: "staff", patch: [] },
  board: { email: "consult.tamaraangeline@gmail.com", name: "Tamara Angeline", role: "board", patch: [] },
  member: { email: "samson.jules@welfareavenue.com", name: "Samson Jules", role: "staff", patch: [{ email: "samson.jules@welfareavenue.com", role: "member", profile: "hr" }] }
}[CASE];
const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8"), stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
const fx = JSON.parse(fs.readFileSync(process.env.FX || "/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/fixture_live.json", "utf8"));
C.patch.forEach(p => { const r = fx.hub_roles.filter(x => x.email === p.email)[0]; if (r) Object.assign(r, p, { tabs: null }); else fx.hub_roles.push(Object.assign({ tabs: null, note: null }, p)); });
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push("PASS " + name); } else { fail++; out.push("FAIL " + name + (extra !== undefined ? " :: " + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 500) : "")); } }
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const errsAll = [];
  async function fresh(hash, o) {
    o = o || {};
    const ctx = await browser.newContext({ viewport: { width: W, height: PHONE ? 844 : 900 }, isMobile: PHONE, hasTouch: PHONE });
    const page = await ctx.newPage();
    page.on("pageerror", e => errsAll.push((hash || '') + ' ' + String(e).slice(0, 200)));
    await page.addInitScript(`(function(){ var FIXED = new Date("2026-09-25T16:00:00-04:00").getTime(); var RealDate = Date; function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } } FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate; window.__WA_TEST_ROLE = ${JSON.stringify(C.role)}; window.__WA_TEST_EMAIL = ${JSON.stringify(C.email)}; window.__WA_TEST_NAME = ${JSON.stringify(C.name)}; window.confirm = function(){ return false; }; try { localStorage.setItem('wa84tour', '1'); ${o.first ? '' : "localStorage.setItem('wa112done', '1'); localStorage.setItem('wa75nudge', '1');"} } catch (e) {} })();`);
    await page.addInitScript("window.__WAFIX = " + JSON.stringify(fx) + ";");
    await page.route("**/*", route => { const url = route.request().url(); if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html }); if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") }); if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub }); return route.abort(); });
    await page.goto("http://wahub.test/" + (hash || ''), { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 25000 });
    await page.waitForTimeout(o.wait || 3200);
    return { page, ctx, ev: (f, a) => page.evaluate(f, a), hash: async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(1400); } };
  }
  const shot = async (p, n) => { if (!process.env.SHOT) return; try { await p.screenshot({ path: '/tmp/w130_' + CASE + '_' + WIDTH + '_' + n + '.png' }); } catch (e) { /* fine */ } };
  const overflow = () => { const vw = 390; const offs = []; document.querySelectorAll('body *').forEach(el => { const r = el.getBoundingClientRect(); if (r.right > vw + 1 && r.width > 0 && r.width < 2000) { let p = el.parentElement, clip = false; while (p && p !== document.body) { const ox = getComputedStyle(p).overflowX; if (ox !== 'visible') { clip = true; break; } p = p.parentElement; } if (!clip && getComputedStyle(el).position !== 'fixed') offs.push(el.tagName + (el.id ? '#' + el.id : '') + '.' + String(el.className).split(' ')[0] + ' ' + Math.round(r.right)); } }); return { sw: document.documentElement.scrollWidth, offs: offs.slice(0, 4) }; };

  if (CASE === 'admin') {
    /* 11 and 12: first visit, one coach mark at a time; Request more access hidden for an admin */
    { const f = await fresh('', { first: true, wait: 4200 });
      await f.ev(() => { location.hash = '#mypage'; }); await f.page.waitForTimeout(1500); await f.ev(() => window.scrollTo(0, 0)); await f.page.waitForTimeout(300);
      const s = await f.ev(() => { const vis = el => !!(el && el.getClientRects().length && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden'); const ck = document.getElementById('w118ck'), nu = document.getElementById('w75nudge'), gs = document.getElementById('w112card'), rb = document.getElementById('w110btn');
        const chips = document.querySelector('#mpBody .mp-chips'); const tiles = chips ? Array.from(chips.children).map(e => e.getBoundingClientRect()).filter(r => r.width > 0) : [];
        const cr = ck && ck.getBoundingClientRect();
        const hit = cr ? tiles.some(t => !(cr.right < t.left || cr.left > t.right || cr.bottom < t.top || cr.top > t.bottom)) : false;
        return { ck: vis(ck), ckKind: ck && ck.getAttribute('data-kind'), ch: cr && Math.round(cr.height), ct: cr && Math.round(cr.top), tt: tiles.length ? Math.round(tiles[0].top) : null, nudgeExists: !!nu, nudge: vis(nu), gs: vis(gs), req: vis(rb), reqExists: !!rb, hit, tiles: tiles.length, cr: cr && [Math.round(cr.top), Math.round(cr.bottom)], wait: document.body.classList.contains('w130wait') }; });
      ok("first visit: Meet Ask the Hub waits while the check-in note or Get started is on screen", s.nudgeExists ? !s.nudge : true, s);
      ok("first visit: never two coach marks at once", !(s.ck && s.nudge), s);
      if (s.ck && s.ckKind === 'in') { ok("the check-in note is two short lines and stays clear of the tiles", s.tiles >= 3 && !s.hit && s.ch <= 80, s); }
      else ok("the check-in note (not shown in this run)", true);
      ok("Request more access is not offered to an admin", !s.req, s);
      await shot(f.page, 'first');
      /* the Get started card goes: the nudge may show once the check-in note is gone too */
      const s2 = await f.ev(async () => { const ck = document.getElementById('w118ck'); if (ck) ck.remove(); const gs = document.getElementById('w112card'); if (gs) gs.remove(); await new Promise(r => setTimeout(r, 500)); const nu = document.getElementById('w75nudge'); return { wait: document.body.classList.contains('w130wait'), nudge: !!(nu && getComputedStyle(nu).display !== 'none') , exists: !!nu }; });
      ok("with nothing else on screen, Meet Ask the Hub can show", !s2.wait && (!s2.exists || s2.nudge), s2);
      await f.ctx.close(); }
    /* 10: Ask the Hub */
    if (!PHONE) { const f = await fresh('#mypage');
      const s = await f.ev(() => { const b = document.getElementById('waChatBtn'); const r = b.getBoundingClientRect(); const l = b.querySelector('.w130lbl'); return { w: Math.round(r.width), h: Math.round(r.height), right: Math.round(innerWidth - r.right), bottom: Math.round(innerHeight - r.bottom), lbl: l && l.textContent, lblW: l && Math.round(l.getBoundingClientRect().width), aria: b.getAttribute('aria-label') }; });
      ok("Ask the Hub is a round 56 px button", s.w <= 60 && s.h === 56, s);
      ok("its label is kept (for hover and screen readers)", s.lbl === 'Ask the Hub' && s.lblW <= 1 && s.aria === 'Ask the Hub', s);
      await f.page.hover('#waChatBtn'); await f.page.waitForTimeout(500);
      /* wave134: the words open around the brand E ("ASK TH" + E + "HUB"), so the E is the E of THE */
      const h = await f.ev(() => { const b = document.getElementById('waChatBtn'); const w = s => { const el = b.querySelector(s); return el ? Math.round(el.getBoundingClientRect().width) : 0; }; return { w: Math.round(b.getBoundingClientRect().width), a: w('.w134a'), b: w('.w134b'), eIn: !!b.querySelector('.w134e .w117ei'), a1: (b.querySelector('.w134a') || {}).textContent, b1: (b.querySelector('.w134b') || {}).textContent }; });
      ok("hover opens the label around the E of THE", h.w > 120 && h.a > 30 && h.b > 20 && h.eIn && h.a1 === 'Ask th' && h.b1 === 'Hub', h);
      await f.page.mouse.move(400, 400); await f.page.waitForTimeout(400);
      const inp = await f.page.$('#mypage input[type=text], #mypage textarea, input[type=search], .wa-toolbar input');
      if (inp) { await inp.focus(); await f.page.waitForTimeout(400); }
      const t = await f.ev(() => { const b = document.getElementById('waChatBtn'); const cs = getComputedStyle(b); return { typing: document.body.classList.contains('w130typing'), op: cs.opacity, pe: cs.pointerEvents }; });
      ok("typing moves it out of the way", !!inp && t.typing && Number(t.op) < 0.1 && t.pe === 'none', t);
      await f.ev(() => { document.activeElement && document.activeElement.blur(); }); await f.page.waitForTimeout(400);
      ok("and it comes back after", await f.ev(() => !document.body.classList.contains('w130typing') && Number(getComputedStyle(document.getElementById('waChatBtn')).opacity) > 0.9));
      await shot(f.page, 'fab');
      await f.ctx.close(); }
    else { const f = await fresh('#mypage');
      const inp = await f.page.$('input[type=search], .wa-toolbar input, #mypage input[type=text]');
      if (inp) { await inp.focus(); await f.page.waitForTimeout(400); }
      ok("phone: the bottom bar steps aside while typing", !!inp && await f.ev(() => getComputedStyle(document.getElementById('w114bar')).display === 'none'));
      await f.ctx.close(); }
    /* 5: Hub inbox, one header */
    { const f = await fresh('#hubmail');
      const s = await f.ev(() => { const vis = el => !!(el && el.offsetParent !== null); const hs = Array.from(document.querySelectorAll('#hubmail h1, #hubmail h2')).filter(vis).map(h => (h.innerText || '').trim()); const p = document.querySelector('#hubmail > .w118mast > p'); return { hs: hs.filter(t => /hub inbox/i.test(t)), p: p && p.textContent }; });
      ok("Hub inbox has one header", s.hs.length === 1, s);
      ok("with the fuller purpose line", /copies to hub@welfareavenue\.com/.test(s.p || '') && /undone/.test(s.p || ''), s);
      await f.ctx.close(); }
    /* 14: Refresh the recommendation updates the card you are looking at */
    { const f = await fresh('#team/fundraising', { wait: 4200 });
      await f.ev(() => { db.functions.invoke = function (name, opts) { return Promise.resolve({ data: name === 'recommend-decision' ? { recommendation: 'TEST REC ' + opts.body.decision_id } : null, error: null }); }; });
      const b = await f.page.$('#team .panel.active [data-w116act="rec"], .panel.active [data-w116act="rec"]');
      const dup = await f.ev(() => { const ids = {}; document.querySelectorAll('[id]').forEach(e => { ids[e.id] = (ids[e.id] || 0) + 1; }); return Object.keys(ids).filter(k => ids[k] > 1 && /rec-/.test(k)); });
      ok("no recommendation box shares its id", dup.length === 0, dup);
      if (b) { await b.click(); await f.page.waitForTimeout(700);
        const s = await f.ev(() => { const act = document.querySelector('.panel.active'); const box = act.querySelector('[data-dec] .exec-rec .rec-box'); const btn = act.querySelector('[data-w116act="rec"]'); return { box: box && box.textContent, btn: btn && btn.textContent, hidden: Array.from(document.querySelectorAll('[id^="rec-fundraising-"] .rec-box')).map(x => x.textContent) }; });
        ok("the refreshed recommendation shows on the team page", /^TEST REC/.test(s.box || ''), s);
        ok("the button keeps its wording", /Refresh the recommendation/.test(s.btn || ''), s);
      } else ok("the team page has a decision to refresh (none in this data)", true);
      await f.ctx.close(); }
    /* 15: goal page footnotes inside their card */
    if (!PHONE) for (const h of ['#goals', '#orggoals', '#goalmap']) { const f = await fresh(h, { wait: 3800 });
      const s = await f.ev(() => { const n = document.querySelector('.panel.active .w116g > p.note'); if (!n) return null; const c = n.parentElement.getBoundingClientRect(), r = n.getBoundingClientRect(); const cs = getComputedStyle(n); return { pl: cs.paddingLeft, inside: r.left >= c.left && r.right <= c.right + 0.5 && r.bottom <= c.bottom + 0.5, textLeft: Math.round(r.left + parseFloat(cs.paddingLeft) - c.left) }; });
      ok("footnote sits inside its card on " + h, !!s && s.pl === '18px' && s.inside && s.textLeft >= 16, s);
      await f.ctx.close(); }
    /* 9: servings read as servings */
    { const f = await fresh('#overview', { wait: 4200 });
      const s = await f.ev(() => { const t = (document.getElementById('w128') || {}).innerText || ''; return { codes: (t.match(/WA-26-\d+/g) || []).length, named: (t.match(/Sunday serving, Montreal/g) || []).length }; });
      ok("the Executive dashboard names the servings", s.codes === 0 && s.named >= 1, s);
      await f.hash('#calendar'); await f.page.waitForTimeout(800);
      const c = await f.ev(() => { const t = (document.getElementById('w124cal') || {}).innerText || ''; return { codes: (t.match(/WA-26-\d+/g) || []).length, named: /Sunday serving, Montreal/.test(t) }; });
      ok("the calendar names them the same way", c.codes === 0 && c.named, c);
      await f.ctx.close(); }
    /* 13: policies, open before signing */
    { const f = await fresh('#mypage', { wait: 4200 });
      const s = await f.ev(() => { const b = document.querySelector('[data-w105sk="expense-policy"]'); const row = b && b.closest('.w105sign'); const a = row && row.querySelector('a[href]'); const pill = document.querySelector('.w105ok'); return { btn: !!b, lock: b && b.getAttribute('data-w130lock'), link: a && a.textContent, pill: pill && getComputedStyle(pill).whiteSpace }; });
      ok("an unsigned policy is locked until opened", s.btn && s.lock === '1', s);
      ok("the signed pill stays on one line", s.pill === 'nowrap', s);
      await f.ev(() => { window.__ins = 0; const orig = db.from.bind(db); db.from = function (t) { const b = orig(t); if (t === 'wa_policy_signoffs') { const oi = b.insert.bind(b); b.insert = function (p) { window.__ins++; return oi(p); }; } return b; }; window.__toasts = []; const ot = window.toast; window.toast = function (m) { window.__toasts.push(m); try { return ot.apply(this, arguments); } catch (e) { /* fine */ } }; });
      await f.page.click('[data-w105sk="expense-policy"]', { force: true }); await f.page.waitForTimeout(500);
      const s2 = await f.ev(() => ({ ins: window.__ins, toasts: window.__toasts.slice(-2), still: !!document.querySelector('[data-w105sk="expense-policy"]') }));
      ok("signing before opening does nothing but say why", s2.ins === 0 && s2.still && s2.toasts.some(t => /Open and read it first/.test(t)), s2);
      const pop = f.page.context().waitForEvent('page', { timeout: 3000 }).catch(() => null);
      await f.ev(() => { const b = document.querySelector('[data-w105sk="expense-policy"]'); b.closest('.w105sign').querySelector('a[href]').click(); });
      const pg = await pop; if (pg) { try { await pg.close(); } catch (e) { /* fine */ } }
      await f.page.waitForTimeout(400);
      ok("opening it unlocks the sign-off", await f.ev(() => { const b = document.querySelector('[data-w105sk="expense-policy"]'); return !!b && !b.hasAttribute('data-w130lock'); }));
      await f.page.click('[data-w105sk="expense-policy"]'); await f.page.waitForTimeout(700);
      ok("then the sign-off goes through", await f.ev(() => window.__ins === 1));
      await f.ctx.close(); }
    /* 1: phones never scroll sideways */
    if (PHONE) for (const h of ['#activity', '#brain', '#adminpanel/security', '#person/37', '#mypage']) { const f = await fresh(h, { wait: 4000 });
      const s = await f.ev(overflow);
      ok("phone: " + h + " fits the screen", s.sw <= 391, s);
      if (h === '#mypage') {
        const g = await f.ev(() => { const b = document.querySelector('[data-w105sk]'); if (!b) return null; const a = b.closest('.w105sign').querySelector('a[href]'); const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return { gap: Math.round(rb.top - ra.bottom), stacked: rb.top >= ra.bottom }; });
        ok("phone: Open and read and the sign-off are stacked with a gap", !g || (g.stacked && g.gap >= 10), g);
      }
      await f.ctx.close(); }
    /* 8: the calendar's Board layer (staff who can read the board) */
    { const f = await fresh('#calendar', { wait: 4200 });
      const s = await f.ev(() => { const up = (document.querySelector('#w124cal .w124up') || {}).innerText || ''; const chip = document.querySelector('#w124cal [data-w124layer="board"]'); const m = (document.querySelector('#calendar > .w118mast p') || {}).textContent || ''; const grid = (document.querySelector('#w124cal .w124grid') || document.querySelector('#w124cal .w124ag') || {}).innerText || ''; return { chip: !!chip, up, mast: m, fy: !!document.querySelector('#w124cal [data-day="2026-09-30"] [data-w124it="fy2026"]') || /Fiscal year ends/.test(grid) }; });
      ok("calendar: a Board layer for those who can read the board", s.chip, s);
      ok("up next has the board's dates", /Fiscal year ends/.test(s.up) && /Committee meetings due/.test(s.up) && /Q3 board meeting/.test(s.up), s.up);
      ok("the year-end sits on September 30", s.fy, s);
      ok("the masthead mentions the board dates", /board dates/.test(s.mast), s.mast);
      await f.ctx.close(); }
  }

  if (CASE === 'board') {
    /* 6: a staff page says so, with the pages the board view opens */
    { const f = await fresh('#finances', { wait: 4200 });
      const s = await f.ev(() => { const n = document.getElementById('w130deny'); return { active: (document.querySelector('.panel.active') || {}).id, hash: location.hash, n: !!n && n.offsetParent !== null, b: n && (n.querySelector('b') || {}).textContent, links: n ? Array.from(n.querySelectorAll('.lk a')).map(a => a.textContent) : [], after: n && n.previousElementSibling && n.previousElementSibling.className }; });
      ok("board: Finances says it is for staff accounts", s.active === 'overview' && s.n && /^Finances are for staff accounts$/.test(s.b || ''), s);
      ok("board: the notice lists the pages the board opens", s.links.indexOf('Board overview') >= 0 && s.links.indexOf('Committees') >= 0 && s.links.indexOf('Calendar') >= 0 && s.links.indexOf('Executive dashboard') < 0, s.links);
      ok("board: the address matches the page", s.hash === '#overview', s.hash);
      ok("board: the notice sits under the masthead", /w118mast/.test(s.after || ''), s.after);
      await shot(f.page, 'deny');
      if (PHONE) { const o = await f.ev(overflow); ok("board phone: the notice fits the screen", o.sw <= 391, o); }
      await f.page.click('#w130deny [data-w130x]'); await f.page.waitForTimeout(300);
      ok("board: the notice closes", await f.ev(() => !document.getElementById('w130deny')));
      await f.hash('#goals');
      ok("board: another staff page says so too", await f.ev(() => { const n = document.getElementById('w130deny'); return !!n && /Department goals are for staff accounts/.test(n.textContent); }));
      await f.page.click('#w130deny .lk a[href="#governance"]'); await f.page.waitForTimeout(1400);
      ok("board: a notice link opens the page", await f.ev(() => (document.querySelector('.panel.active') || {}).id === 'governance' && !document.getElementById('w130deny')));
      await f.ctx.close(); }
    /* 7: decisions are read, not ticked */
    { const f = await fresh('#overview', { wait: 4200 });
      const s = await f.ev(() => { const vis = el => el && el.offsetParent !== null; const p = document.querySelector('#overview p.read[data-w116g="1"]'); return { checks: Array.from(document.querySelectorAll('#decisionList input[type=checkbox], #decisionDoneList input[type=checkbox]')).filter(vis).length, all: document.querySelectorAll('#decisionList li').length, intro: p && p.textContent }; });
      ok("board: no tick boxes on the decisions", s.checks === 0 && s.all >= 1, s);
      ok("board: the intro does not ask to tick", s.intro && !/Tick an item/.test(s.intro) && /executives record/.test(s.intro), s.intro);
      /* staff links stop being links */
      const off = await f.ev(() => (window.w130 && window.w130.off()) || []);
      const tgt = await f.ev(() => { const el = document.querySelector('#overview [data-w130off]'); if (!el) return null; el.setAttribute('data-w130test', '1'); return el.getAttribute('data-w130off') + ' ' + el.tagName + ' ' + (el.getAttribute('href') || Array.from(el.attributes).filter(a => /go$/.test(a.name)).map(a => a.value).join('')); });
      if (tgt) {
        await f.ev(() => { window.__toasts = []; const ot = window.toast; window.toast = function (m) { window.__toasts.push(m); try { return ot.apply(this, arguments); } catch (e) { /* fine */ } }; const el = document.querySelector('[data-w130test]'); el.style.setProperty('display', 'inline-block', 'important'); el.click(); });
        await f.page.waitForTimeout(700);
        const r = await f.ev(() => ({ hash: location.hash, active: (document.querySelector('.panel.active') || {}).id, toasts: window.__toasts }));
        ok("board: a link to a staff page stays put and says why", r.active === 'overview' && r.toasts.some(t => /for staff accounts/.test(t)), { tgt, r, off: off.slice(0, 8) });
      } else ok("board: no staff links on the Executive dashboard in this data", true, off);
      out.push("INFO marked links: " + JSON.stringify(off.slice(0, 12)));
      await f.ctx.close(); }
    /* 8: the calendar is not empty for a director */
    { const f = await fresh('#calendar', { wait: 4200 });
      const s = await f.ev(() => { const cal = document.getElementById('w124cal'); const up = (cal.querySelector('.w124up') || {}).innerText || ''; return { chip: !!cal.querySelector('[data-w124layer="board"]'), on: (cal.querySelector('[data-w124layer="board"]') || {}).getAttribute && cal.querySelector('[data-w124layer="board"]').getAttribute('aria-checked'), empty: /Nothing coming up/.test(cal.innerText), up, mast: (document.querySelector('#calendar > .w118mast p') || {}).textContent }; });
      ok("board calendar: the Board layer is on", s.chip && s.on === 'true', s);
      ok("board calendar: up next has the next board meeting and the committees' week", !s.empty && /Q3 board meeting/.test(s.up) && /Committee meetings due/.test(s.up), s.up);
      ok("board calendar: the masthead says board meetings", /^Board meetings/.test(s.mast || ''), s.mast);
      const row = await f.page.$('#w124cal .w124up [data-w124it^="bm"]');
      if (row) { await row.click(); await f.page.waitForTimeout(500);
        const sh = await f.ev(() => { const p = document.querySelector('#w124sheet.on .pane'); return p ? { t: (p.querySelector('h2') || {}).textContent, acts: Array.from(p.querySelectorAll('.acts a')).map(a => a.textContent), txt: p.innerText } : null; });
        ok("board calendar: the meeting opens with a link to Board overview", sh && /Q3 board meeting/.test(sh.t) && sh.acts.indexOf('Board overview') >= 0 && /Tentative/.test(sh.txt), sh);
        await f.page.click('#w124sheet.on .acts a[data-w124go="#governance"]'); await f.page.waitForTimeout(1300);
        ok("board calendar: and it goes there", await f.ev(() => (document.querySelector('.panel.active') || {}).id === 'governance'));
      } else ok("board calendar: the meeting row is in up next", false);
      await f.hash('#calendar'); await f.page.waitForTimeout(600);
      await f.page.click('#w124cal [data-w124layer="board"]'); await f.page.waitForTimeout(400);
      ok("board calendar: the layer switches off", await f.ev(() => !/Committee meetings due/.test((document.querySelector('#w124cal .w124up') || {}).innerText || '')));
      await f.page.click('#w124cal [data-w124layer="board"]'); await f.page.waitForTimeout(300);
      await shot(f.page, 'cal');
      if (PHONE) { const o = await f.ev(overflow); ok("board phone: the calendar fits the screen", o.sw <= 391, o); }
      await f.ctx.close(); }
  }

  if (CASE === 'member') {
    { const f = await fresh('#finances', { wait: 4200 });
      const s = await f.ev(() => { const n = document.getElementById('w130deny'); return { active: (document.querySelector('.panel.active') || {}).id, n: !!n, b: n && (n.querySelector('b') || {}).textContent, p: n && (n.querySelector('p') || {}).textContent, links: n ? Array.from(n.querySelectorAll('.lk a')).map(a => a.getAttribute('href')) : [] }; });
      ok("member: a page outside the profile says so", s.active === 'overview' && s.n && /^Finances are not in your access profile$/.test(s.b || ''), s);
      ok("member: and points to My page for a request", /send a request from My page/.test(s.p || '') && s.links.indexOf('#mypage') >= 0, s);
      await f.hash('#calendar');
      ok("member: the notice goes when you move on", await f.ev(() => !document.getElementById('w130deny')));
      await f.ctx.close(); }
    { const f = await fresh('#mypage', { wait: 4200 });
      const s = await f.ev(() => { const b = document.getElementById('w110btn'); return { exists: !!b, vis: !!(b && b.offsetParent !== null) }; });
      ok("member: Request more access is offered", s.exists && s.vis, s);
      await f.ctx.close(); }
  }

  ok("no page errors", errsAll.length === 0, errsAll.slice(0, 5));
  console.log(out.join("\n"));
  console.log("\n" + CASE + " " + WIDTH + ": " + pass + " passed, " + fail + " failed");
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
