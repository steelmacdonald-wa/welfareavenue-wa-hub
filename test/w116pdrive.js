/* wave116p/r drive: HR centre revamp (people, shout-outs, applications) and the Adoption card */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", TAG = "steel", WIDTH = "1366"] = process.argv;

(async () => {
  const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  const shots = path.join(__dirname, "shots_p116p");
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: Number(WIDTH), height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("PAGEERROR: " + String(e).slice(0, 300)));
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") { const t = m.text(); if (/wave116|w116|team route/.test(t)) errs.push("CONSOLE: " + t.slice(0, 300)); } });
  await page.addInitScript(`
    (function(){
      var FIXED = new Date(${JSON.stringify(FIXED_TIME)}).getTime();
      var RealDate = Date;
      function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } }
      FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate;
      window.__WA_TEST_ROLE = ${JSON.stringify(ROLE)}; window.__WA_TEST_EMAIL = ${JSON.stringify(EMAIL)}; window.__WA_TEST_NAME = ${JSON.stringify(NAME)};
      window.confirm = function(){ return true; }; window.alert = function(){}; window.prompt = function(){ return null; };
      try { localStorage.setItem('wa84tour', '1'); } catch (e) {}
      window.__CALLS = [];
      var ago = function (d) { return new RealDate(FIXED - d * 86400000).toISOString(); };
      window.__WA_RPCS = { hub_adoption: { today: { visitors: 6, visits: 9, hours: 12.5, checkins: 4, people_checked_in: 3, tasks_closed: 5, tasks_opened: 2, ai_calls: 40, ai_cost: 0.21, jev_calls: 18, questions: 7, transcripts: 1, emails_filed: 3, shoutouts: 2 }, week: { visitors: 14, visits: 60, hours: 84, checkins: 30, people_checked_in: 9, tasks_closed: 31, tasks_opened: 12, ai_calls: 220, ai_cost: 1.4, jev_calls: 90, questions: 40, transcripts: 5, emails_filed: 12, shoutouts: 6 }, month: { visitors: 22, visits: 240, hours: 310, checkins: 120, people_checked_in: 16, tasks_closed: 140, tasks_opened: 60, ai_calls: 900, ai_cost: 6.2, jev_calls: 400, questions: 150, transcripts: 20, emails_filed: 55, shoutouts: 20 }, days: (function(){ var out=[]; for (var i=29;i>=0;i--){ var d=new RealDate(FIXED - i*86400000); out.push({ day: d.toISOString().slice(0,10), visitors: (i*7)%9, hours: (i*3)%12, tasks_closed: (i*5)%8, ai_calls: (i*11)%40, ai_cost: ((i*13)%50)/100 }); } return out; })(), people: [ { id: 37, name: 'Steel MacDonald', email: 'steel.macdonald@welfareavenue.com', department: 'board', role: 'Co executive director', sign_ins: [ago(0.1), ago(1.2), ago(2.5)], last_active: ago(0.05), hours_30d: 41.5, tasks_closed_30d: 6, questions_30d: 22, visits_30d: 30, has_account: true }, { id: 32, name: 'Amanda Zoldak', email: 'amanda.zoldak@welfareavenue.com', department: 'marketing', role: 'Designer', sign_ins: [ago(3)], last_active: ago(3), hours_30d: 8, tasks_closed_30d: 2, questions_30d: 1, visits_30d: 4, has_account: true }, { id: 40, name: 'Quiet Person', email: 'quiet@welfareavenue.com', department: 'opsto', role: 'Volunteer', sign_ins: null, last_active: null, hours_30d: 0, tasks_closed_30d: 0, questions_30d: 0, visits_30d: 0, has_account: false } ] } };
      window.__WA_FN = function (name, body) {
        window.__CALLS.push({ name: name, body: body });
        if (name === 'llm') {
          if (body.action === 'routes') return { ok: true, jev: '~typesafe/jev-latest', routes: [
            { task: 'brain', label: 'Ask the Hub (Brain)', chain: ['anthropic/claude-sonnet-5', 'moonshotai/kimi-k2.6', 'openai/gpt-5-mini'], jev: false, mode: 'jev', notes: 'Jev picks per question.' },
            { task: 'mail_triage', label: 'Email filing', chain: ['anthropic/claude-haiku-4.5', 'openai/gpt-5-mini', 'google/gemini-3.8-flash'], jev: true, mode: 'chain', notes: 'Classifier; Jev double-checks.' },
            { task: 'decide', label: 'Jev decisions', chain: ['~typesafe/jev-latest'], jev: true, mode: 'chain', notes: 'Decisions API.' },
            { task: 'default', label: 'Anything unlabelled', chain: ['anthropic/claude-sonnet-5', 'openai/gpt-5'], jev: false, mode: 'jev', notes: '' } ],
            usage7: [ { task: 'brain', calls: 42, ok_calls: 41, avg_ms: 1800, cost: 0.61, last_at: ago(0.1), last_model: 'anthropic/claude-sonnet-5' }, { task: 'mail_triage', calls: 120, ok_calls: 120, avg_ms: 700, cost: 0.09, last_at: ago(0.5), last_model: 'anthropic/claude-haiku-4.5' } ],
            usage30: [ { task: 'brain', calls: 160, ok_calls: 158, avg_ms: 1700, cost: 2.4 }, { task: 'mail_triage', calls: 500, ok_calls: 500, avg_ms: 700, cost: 0.4 } ],
            recent: [ { created_at: ago(0.01), task: 'brain', caller: 'ask', requested_model: 'openai/gpt-5-mini', model: 'openai/gpt-5-mini', ok: true, ms: 600, cost: 0.0002, via: 'jev' }, { created_at: ago(0.02), task: 'brain', caller: 'ask', requested_model: '~typesafe/jev-latest', model: 'typesafe/jev-1.13', ok: true, ms: 0, cost: 0.00001, via: 'jev', error: 'picked openai/gpt-5-mini' }, { created_at: ago(0.3), task: 'mail_triage', caller: 'mail-pull', requested_model: 'anthropic/claude-haiku-4.5', model: null, ok: false, ms: 900, cost: null, error: 'anthropic/claude-haiku-4.5: 529 overloaded' } ] };
          if (body.action === 'models') return { ok: true, models: [ { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', in_per_m: 2, out_per_m: 10 }, { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5', in_per_m: 1, out_per_m: 5 }, { id: 'openai/gpt-5-mini', name: 'GPT-5 mini', in_per_m: 0.25, out_per_m: 2 }, { id: 'moonshotai/kimi-k2.6', name: 'Kimi K2.6', in_per_m: 0.6, out_per_m: 2.5 }, { id: 'qwen/qwen3.8-flash', name: 'Qwen 3.8 Flash', in_per_m: 0.05, out_per_m: 0.4 } ] };
          if (body.action === 'test') return { ok: true, task: body.task, model: body.task === 'decide' ? 'typesafe/jev-1.13' : 'anthropic/claude-sonnet-5', ms: 1234, cost: 0.00007, reply: 'OK' };
          if (body.action === 'set_route') { window.__ROUTE_SAVED = body; return { ok: true, route: { task: body.task, chain: body.chain, mode: body.mode } }; }
          if (body.task === 'brain_suggest') return { content: [ { type: 'tool_use', name: 'suggest_edits', input: { owner: 'Amanda Zoldak', why_owner: 'leads the flyer work', due_date: '2026-08-14', project_id: null, title: 'Print 200 flyers for the open house', tips: ['Say how many flyers and which printer.'] } } ], _wa: { model: 'anthropic/claude-haiku-4.5' } };
        }
        if (name === 'checkin-post') {
          if (body.action === 'in') return { ok: true, posted: true };
          if (body.action === 'summarise') return { ok: true, bullets: ['Finished the board deck and sent it to Tamara', 'Met Amanda about the flyers; she prints Friday'], suggest: [ { id: 501, title: 'Finish the Q2 board deck', why: 'finished the board deck' } ], open_tasks: [ { id: 502, title: 'Recover the impact report comments', owner: 'Steel' } ] };
          if (body.action === 'out') { window.__OUT = body; return { ok: true, posted: true, closed: body.close_task_ids.length ? ['Finish the Q2 board deck'] : [], minutes: 245 }; }
        }
        if (name === 'shoutouts') { if (body.action === 'add') { window.__SHOUT = body; return { ok: true, id: 99 }; } if (body.action === 'remove') return { ok: true }; }
        if (name === 'ask' && body.execute) { window.__EXEC = body.execute; return { executed: { ok: true, detail: 'Added task #1 to Marketing: ' + (body.execute.input.title || '') } }; }
        return null;
      };
    })();
  `);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.addInitScript(`(function(){ var ago = function (d) { return new Date(Date.now() - d * 86400000).toISOString(); }; window.__WAFIX.hub_shoutouts = [ { id: 1, created_at: ago(0.2), kind: 'auto', source: 'tasks', person: 'Ahmed', member_id: null, team: 'opsto', text: 'Ahmed closed 13 tasks this week, including securing drivers for upcoming events.', by: 'the hub', active: true, expires_at: ago(-9) }, { id: 2, created_at: ago(1), kind: 'manual', source: 'manual', person: 'Amanda Zoldak', member_id: 32, team: 'marketing', text: 'Amanda turned the open house flyers around in a day.', by: 'Steel MacDonald', active: true, expires_at: ago(-12) } ]; window.__WAFIX.hub_candidates = [ { id: 1, created_at: ago(0.5), name: 'Priya Nair', email: 'priya.nair@example.com', phone: '416 555 0139', role: 'Program Coordinator (Toronto)', request_id: null, source: 'email', mail_id: 13, cv_path: '13/Priya_Nair_CV.pdf', cv_name: 'Priya_Nair_CV.pdf', links: ['https://www.linkedin.com/in/priyanair-example'], summary: 'Four years coordinating youth programs in Scarborough.', status: 'new', owner: null, notes: null }, { id: 2, created_at: ago(9), name: 'Marc Tremblay', email: 'marc@example.com', phone: null, role: 'Kitchen volunteer', request_id: null, source: 'email', mail_id: 12, cv_path: null, cv_name: null, links: [], summary: 'Weekend availability.', status: 'interview', owner: 'Valex', notes: 'Second interview Friday' } ]; window.__WAFIX.hub_checkins = (window.__WAFIX.hub_checkins || []).concat([ { id: 900, email: 'steel.macdonald@welfareavenue.com', name: 'Steel MacDonald', started_at: ago(2), ended_at: ago(1.9), minutes: 150 } ]); window.__WAFIX.hub_visits = []; })();`);
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") });
    if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) {
      const patched = stub + "\n;(function(){ try { var mk = window.supabase && window.supabase.createClient; if (!mk) return; window.supabase.createClient = function () { var c = mk.apply(this, arguments); var orig = c.functions.invoke.bind(c.functions); c.functions.invoke = async function (name, opts) { var body = (opts && opts.body) || {}; var r = window.__WA_FN ? window.__WA_FN(name, body) : null; if (r) return { data: r, error: null }; return orig(name, opts); }; return c; }; } catch (e) {} })();";
      return route.fulfill({ contentType: "application/javascript", body: patched });
    }
    if (url.indexOf("fonts.g") >= 0 || url.indexOf("supabase.co/storage") >= 0) return route.continue();
    return route.abort();
  });
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
  await page.waitForTimeout(2600);
  const out = { identity: TAG };
  const go = async (h, ms) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(ms || 900); };
  const shot = async (n, full) => page.screenshot({ path: path.join(shots, TAG + "_" + n + ".png"), fullPage: !!full });


  /* 1. HR centre */
  await go('#hrcentre', 3200);
  out.hr = await page.evaluate(() => { const hero = document.getElementById('w116phero'); const tabs = Array.from(document.querySelectorAll('#w46body .w47tab')).map(t => t.textContent.trim()); return { hero: !!hero, heroTiles: hero ? Array.from(hero.querySelectorAll('.tile')).map(t => t.textContent.trim().replace(/\s+/g, ' ')) : [], tabs, peopleHidden: (document.getElementById('w116ppeople') || {}).style ? document.getElementById('w116ppeople').style.display : 'missing', candsBlock: !!document.getElementById('w116pcands'), view: (document.querySelector('#w46body .w47tab.on') || {}).textContent }; });
  await shot("1_hr_default", true);
  await page.click('#w46body .w47tab[data-w47v="people"]'); await page.waitForTimeout(700);
  out.people = await page.evaluate(() => { const p = document.getElementById('w116ppeople'); return { shown: p && p.style.display !== 'none', shouts: Array.from(document.querySelectorAll('#w116pshouts .l')).map(l => l.textContent.trim().replace(/\s+/g, ' ').slice(0, 80)), cards: document.querySelectorAll('#w116ppeople .pp').length, first: (function () { const c = document.querySelector('#w116ppeople .pp'); if (!c) return null; return { name: c.querySelector('.who b').textContent, hasImgOrInitials: !!c.querySelector('.w116av'), facts: Array.from(c.querySelectorAll('.facts div')).map(x => x.textContent.trim().replace(/\s+/g, ' ')) }; })(), teamChips: Array.from(document.querySelectorAll('#w116ppeople .tf')).map(x => x.textContent.trim()), othersHidden: Array.from(document.querySelectorAll('#w46body > .w46sec')).every(s => s.style.display === 'none') }; });
  await shot("2_people", true);
  await page.fill('#w116pq', 'aman'); await page.waitForTimeout(300);
  out.search = await page.evaluate(() => ({ cards: document.querySelectorAll('#w116ppeople .pp').length, names: Array.from(document.querySelectorAll('#w116ppeople .pp .who b')).map(b => b.textContent) }));
  await page.fill('#w116pq', ''); await page.waitForTimeout(300);
  /* post a shout-out */
  await page.evaluate(() => { const s = document.getElementById('w116psp'); const o = Array.from(s.options).find(x => /amanda/i.test(x.value)) || s.options[1]; s.value = o ? o.value : ''; }); await page.fill('#w116pst', 'Amanda got the open house flyers printed a day early.');
  await page.click('#w116psf button[type="submit"]'); await page.waitForTimeout(800);
  out.shout = await page.evaluate(() => ({ sent: window.__SHOUT, toast: (document.getElementById('toast') || {}).textContent }));
  /* start date edit (admin) */
  const es = await page.$('#w116ppeople [data-w116pes]');
  if (es) { await es.click(); await page.waitForTimeout(200); out.startEdit = await page.evaluate(() => !!document.querySelector('#w116ppeople input[type="date"][data-w116psd]')); }
  /* recruitment tab: applications */
  await page.click('#w46body .w47tab[data-w47v="recruitment"]'); await page.waitForTimeout(700);
  out.recruit = await page.evaluate(() => { const b = document.getElementById('w116pcands'); return { shown: b && b.style.display !== 'none', peopleHidden: (document.getElementById('w116ppeople') || {}).style.display, filters: Array.from(document.querySelectorAll('#w116pcands .sf')).map(x => x.textContent.trim()), cards: Array.from(document.querySelectorAll('#w116pcands .c')).map(c => ({ who: c.querySelector('.who b').textContent, stage: c.querySelector('.st').textContent, cv: !!c.querySelector('[data-w116pcv]'), owner: c.querySelector('[data-w116pco]').value })) }; });
  await shot("3_recruitment", true);
  await page.selectOption('#w116pcands [data-w116pcs="1"]', 'reviewing'); await page.waitForTimeout(600);
  out.stageChange = await page.evaluate(() => ({ toast: (document.getElementById('toast') || {}).textContent, stage: (document.querySelector('#w116pcands .c[data-cid="1"] .st') || {}).textContent }));
  await page.click('#w116pcands [data-w116pst="all"]'); await page.waitForTimeout(200);
  out.allCount = await page.evaluate(() => document.querySelectorAll('#w116pcands .c').length);
  /* 2. Adoption card */
  await go('#adminpanel/adoption', 3000);
  out.adoption = await page.evaluate(() => { const c = document.getElementById('w116rcard'); if (!c) return { present: false }; return { present: true, first: c.parentNode.firstElementChild === c, cols: Array.from(c.querySelectorAll('.pc h4')).map(h => h.textContent), big: Array.from(c.querySelectorAll('.pc')).map(p => Array.from(p.querySelectorAll('.big div')).map(d => d.textContent.trim().replace(/\s+/g, ' ')).join(' | ')), bars: c.querySelectorAll('.bars i').length, people: Array.from(c.querySelectorAll('table.pp tbody tr')).map(r => r.textContent.trim().replace(/\s+/g, ' ').slice(0, 120)) }; });
  await shot("4_adoption", true);
  await page.click('#w116rcard [data-w116rser="ai_cost"]'); await page.waitForTimeout(200);
  await page.click('#w116rcard th[data-w116rs="hours_30d"]'); await page.waitForTimeout(200);
  out.adoption2 = await page.evaluate(() => ({ series: (document.querySelector('#w116rcard .sf.on') || {}).textContent, firstPerson: (document.querySelector('#w116rcard table.pp tbody tr td.who b') || {}).textContent, visitLogged: (window.__WAFIX.hub_visits || []).length }));
  out.errors = errs;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
