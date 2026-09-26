/* verify43.js <case> <width>: spot checks for the #43 findings, one fresh page per check */
const fs = require("fs"); const path = require("path"); const { chromium } = require("playwright");
const [, , CASE = "admin", WIDTH = "1366"] = process.argv;
const C = { admin: { email: "steel.macdonald@welfareavenue.com", name: "Steel MacDonald", role: "staff" }, board: { email: "consult.tamaraangeline@gmail.com", name: "Tamara Angeline", role: "board" } }[CASE];
const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8"), stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
const gen = fs.readFileSync(path.join(__dirname, "w129data.js"), "utf8");
const fx = JSON.parse(fs.readFileSync("/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/fixture_live.json", "utf8"));
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  async function fresh(hash, wait) {
    const ctx = await browser.newContext({ viewport: { width: Number(WIDTH), height: Number(WIDTH) < 700 ? 844 : 900 } });
    const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(String(e).slice(0, 200)));
    await page.addInitScript(`(function(){ var FIXED = new Date("2026-09-25T16:00:00-04:00").getTime(); var RealDate = Date; function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } } FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate; window.__WA_TEST_ROLE = ${JSON.stringify(C.role)}; window.__WA_TEST_EMAIL = ${JSON.stringify(C.email)}; window.__WA_TEST_NAME = ${JSON.stringify(C.name)}; window.confirm = function(){ return false; }; try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa112done', '1'); } catch (e) {} })();`);
    await page.addInitScript("window.__WAFIX = " + JSON.stringify(fx) + ";");
    await page.addInitScript(gen);
    await page.route("**/*", route => { const url = route.request().url(); if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html }); if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") }); if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub }); return route.abort(); });
    await page.goto("http://wahub.test/" + (hash || ''), { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 25000 });
    await page.waitForTimeout(wait || 3500);
    return { page, ctx, errs };
  }
  const out = {};
  const run = async (name, hash, fn, wait) => { const f = await fresh(hash, wait); try { out[name] = await f.page.evaluate(fn); } catch (e) { out[name] = 'ERR ' + e; } if (process.env.SHOT) await f.page.screenshot({ path: '/tmp/s43/v_' + CASE + '_' + WIDTH + '_' + name + '.png' }); await f.ctx.close(); };
  if (CASE === 'admin') {
    await run('tx', '#tx/124', () => { const opens = Array.from(document.querySelectorAll('[data-tx].open')).map(e => e.getAttribute('data-tx')); const t = document.querySelector('[data-tx="124"]'); const r = t && t.getBoundingClientRect(); return { opens, exists: !!t, top: r && Math.round(r.top), title: t && (t.innerText || '').slice(0, 60), all: Array.from(document.querySelectorAll('[data-tx]')).slice(0, 5).map(e => e.getAttribute('data-tx')) }; });
    await run('decision', '#decision/18', () => { const li = document.querySelector('[data-decision="18"]'); const r = li && li.getBoundingClientRect(); return { exists: !!li, top: r && Math.round(r.top), num: li && (li.innerText || '').slice(0, 40), pulse: li && li.className }; }, 1200);
    await run('hubmail', '#hubmail', () => Array.from(document.querySelectorAll('#hubmail h1, #hubmail h2')).map(h => (h.innerText || '').slice(0, 60)));
    await run('access', '#adminpanel/access', () => { const t = document.querySelector('#w127 table, #adminpanel table'); const rows = t ? Array.from(t.querySelectorAll('tbody tr')).map(r => (r.innerText || '').split('\n')[0].slice(0, 40)) : []; const box = t && t.parentElement; return { rows: rows.length, first: rows.slice(0, 3), last: rows.slice(-3), boxH: box && box.clientHeight, boxSH: box && box.scrollHeight, overflowY: box && getComputedStyle(box).overflowY }; });
    await run('reqaccess', '#mypage', () => { const b = document.getElementById('w110btn'); return { shown: !!(b && b.offsetParent) }; });
    await run('dup', '#team/fundraising', () => { const ids = {}; document.querySelectorAll('[id^="rec-"]').forEach(e => { ids[e.id] = (ids[e.id] || []).concat([(e.closest('[id]:not([id^="rec-"])') || {}).id + ' ' + (e.innerText || '').slice(0, 30)]); }); return Object.keys(ids).filter(k => ids[k].length > 1).map(k => [k, ids[k]]); });
    if (Number(WIDTH) < 700) {
      for (const h of ['#activity', '#brain', '#adminpanel/security', '#person/37']) {
        await run('over ' + h, h, () => { const vw = document.documentElement.clientWidth; const offs = []; document.querySelectorAll('body *').forEach(el => { const r = el.getBoundingClientRect(); if (r.right > vw + 1 && r.width > 0 && r.width < 2000) { let p = el.parentElement, clip = false; while (p && p !== document.body) { const ox = getComputedStyle(p).overflowX; if (ox !== 'visible') { clip = true; break; } p = p.parentElement; } if (!clip) offs.push({ el: el.tagName + (el.id ? '#' + el.id : '') + '.' + String(el.className).split(' ')[0] + ' "' + (el.innerText || '').slice(0, 30).replace(/\n/g, ' ') + '"', right: Math.round(r.right), w: Math.round(r.width) }); } }); offs.sort((a, b) => a.w - b.w); return { vw, sw: document.documentElement.scrollWidth, offs: offs.slice(0, 5) }; }, 4000);
      }
    }
  } else {
    await run('board_finances', '#finances', () => ({ active: (document.querySelector('.panel.active') || {}).id, hash: location.hash, notice: /not available|staff accounts only/i.test(document.body.innerText) }));
    await run('board_goals', '#goals', () => ({ active: (document.querySelector('.panel.active') || {}).id, hash: location.hash }));
    await run('board_writes', '#overview', () => { const vis = el => el && el.offsetParent !== null; return { decChecks: Array.from(document.querySelectorAll('#decisionList input[type=checkbox]')).filter(vis).length, addDecision: Array.from(document.querySelectorAll('#overview button, #overview a')).filter(b => vis(b) && /add decision|record the decision/i.test(b.innerText)).map(b => b.innerText.slice(0, 30)) }; });
    await run('board_gov', '#governance', () => { const vis = el => el && el.offsetParent !== null; return { adds: Array.from(document.querySelectorAll('#governance button, #governance a')).filter(b => vis(b) && /add an item|\+ add|edit|log a touchpoint/i.test(b.innerText)).map(b => b.innerText.trim().slice(0, 30)) }; });
    await run('board_committees', '#committees', () => { const vis = el => el && el.offsetParent !== null; return { adds: Array.from(document.querySelectorAll('#committees button, #committees a')).filter(b => vis(b) && /log a touchpoint|edit/i.test(b.innerText)).map(b => b.innerText.trim().slice(0, 30)) }; });
    await run('board_calendar', '#calendar', () => ({ layers: Array.from(document.querySelectorAll('#calendar [data-w124layer], #calendar .layer, #calendar label')).map(e => (e.innerText || '').trim().slice(0, 30)).filter(Boolean).slice(0, 8), upnext: ((document.querySelector('#calendar') || {}).innerText || '').match(/Nothing coming up[^.]*\./) }));
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(2); });
