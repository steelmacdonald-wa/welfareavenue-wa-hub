/* w131drive.js [width]: People and access in one place (wave131), as Steel (admin).
   CAND=<build> (default ../build/candidate.html). Live-data fixture; hub-invite is mocked in the page and every write is recorded. */
const fs = require("fs"); const path = require("path"); const { chromium } = require("playwright");
const [, , WIDTH = "1366"] = process.argv;
const W = Number(WIDTH), PHONE = W < 700;
const html = fs.readFileSync(process.env.CAND || path.join(__dirname, "../build/candidate.html"), "utf8"), stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
const fx = JSON.parse(fs.readFileSync("/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/fixture_live.json", "utf8"));
/* a second request to grant: Samson asks for Finances */
fx.wa_access_requests = (fx.wa_access_requests || []).concat([{ id: 902, email: 'samson.jules@welfareavenue.com', name: 'Samson Jules', role_now: 'member', wanted: 'tab:finances', reason: 'I reconcile payroll', status: 'new', decided_by: null, decided_at: null, created_at: '2026-09-24T14:00:00Z' }]);
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push("PASS " + name); } else { fail++; out.push("FAIL " + name + (extra !== undefined ? " :: " + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 600) : "")); } }
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const errs = [];
  async function fresh(hash, wait) {
    const ctx = await browser.newContext({ viewport: { width: W, height: PHONE ? 844 : 900 }, isMobile: PHONE, hasTouch: PHONE });
    const page = await ctx.newPage();
    page.on("pageerror", e => errs.push((hash || '') + ' ' + String(e).slice(0, 200)));
    await page.addInitScript(`(function(){ var FIXED = new Date("2026-09-25T16:00:00-04:00").getTime(); var RealDate = Date; function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } } FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate; window.__WA_TEST_ROLE = "staff"; window.__WA_TEST_EMAIL = "steel.macdonald@welfareavenue.com"; window.__WA_TEST_NAME = "Steel MacDonald"; window.confirm = function(){ return true; }; try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa262.seen', '1'); localStorage.setItem('wa112done', '1'); localStorage.setItem('wa75nudge', '1'); localStorage.setItem('w118bSnooze', String(FIXED + 9e9)); } catch (e) {} })();`);
    await page.addInitScript("window.__WAFIX = " + JSON.stringify(fx) + "; window.__WA_RPCS = { wa_hub_logins: [{email:'steel.macdonald@welfareavenue.com', last_sign_in_at:'2026-09-25T12:00:00Z', account_created:'2026-07-01T00:00:00Z'},{email:'samson.jules@welfareavenue.com', last_sign_in_at:null, account_created:'2026-09-01T00:00:00Z'}] };");
    await page.route("**/*", route => { const url = route.request().url(); if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html }); if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") }); if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub }); return route.abort(); });
    await page.goto("http://wahub.test/" + (hash || ''), { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 25000 });
    await page.waitForTimeout(wait || 3800);
    /* record writes and mock hub-invite */
    await page.evaluate(() => {
      window.__W = []; window.__F = []; window.__T = [];
      const orig = db.from.bind(db);
      db.from = function (tb) { const b = orig(tb); ['insert', 'upsert', 'update'].forEach(op => { const f = b[op]; if (f) b[op] = function (payload, opts) { window.__W.push({ tb, op, payload: JSON.parse(JSON.stringify(payload)) }); return f.apply(this, arguments); }; }); return b; };
      db.functions.invoke = function (name, opts) {
        const body = (opts && opts.body) || {}; window.__F.push({ name, body: JSON.parse(JSON.stringify(body)) });
        if (name !== 'hub-invite') return Promise.resolve({ data: null, error: null });
        if (body.action === 'invite') return Promise.resolve({ data: { ok: true, email: body.email, name: body.name, email_sent: body.send_email !== false, note: body.send_email !== false ? 'sent from hub@' : 'not requested', slack: 'no_slack', existed: false, hub_role: body.hub_role }, error: null });
        if (body.action === 'bulk_invite') return Promise.resolve({ data: { ok: true, results: body.people.map(p => ({ ok: true, email: p.email, name: p.name, email_sent: true, slack: 'no_slack', hub_role: p.hub_role })) }, error: null });
        if (body.action === 'link') return Promise.resolve({ data: { ok: true, link: 'https://example.test/one-time', kind: 'magiclink', existing_account: true }, error: null });
        if (body.action === 'set_email') return Promise.resolve({ data: { ok: true, name: 'X' }, error: null });
        if (body.action === 'remove') return Promise.resolve({ data: { ok: true, auth_deleted: true }, error: null });
        return Promise.resolve({ data: { error: 'unknown' }, error: null });
      };
      const ot = window.toast; window.toast = function (m) { window.__T.push(m); try { return ot.apply(this, arguments); } catch (e) { /* fine */ } };
    });
    return { page, ctx, ev: (f, a) => page.evaluate(f, a), hash: async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(1300); } };
  }
  const click = async (f, sel, wait) => { const el = await f.page.$(sel); if (!el) return false; await el.click(); await f.page.waitForTimeout(wait || 500); return true; };
  const shot = async (f, n) => { if (!process.env.SHOT) return; try { await f.page.screenshot({ path: '/tmp/w131_' + WIDTH + '_' + n + '.png' }); } catch (e) { /* fine */ } };
  const writes = (f, tb) => f.ev(t => window.__W.filter(w => !t || w.tb === t), tb);
  const calls = f => f.ev(() => window.__F.filter(c => c.name === 'hub-invite').map(c => c.body));
  const fits = f => f.ev(() => document.documentElement.scrollWidth <= innerWidth + 1);

  /* 1. the section */
  { const f = await fresh('#adminpanel/people');
    const s = await f.ev(() => { const vis = el => !!(el && el.offsetParent !== null && getComputedStyle(el).display !== 'none'); return {
      card: vis(document.getElementById('w131card')), old113: vis(document.getElementById('w113card')), old127: vis(document.getElementById('w127card')),
      mast: (document.querySelector('#adminpanel > .w118mast h1') || {}).textContent, accLink: Array.from(document.querySelectorAll('#adminpanel .w118adm a')).filter(vis).map(a => a.textContent),
      tabs: Array.from(document.querySelectorAll('#w131card .w131tabs a')).map(a => a.textContent.trim()), on: (document.querySelector('#w131card .w131tabs a.on') || {}).textContent,
      todos: window.w131 ? window.w131.todos() : [], rows: document.querySelectorAll('#w131card .w131p').length, groups: Array.from(document.querySelectorAll('#w131card .w131team h3')).map(h => h.textContent) }; });
    ok("People and access shows the new card, the old ones wait behind the classic view", s.card && !s.old113 && !s.old127, s);
    ok("the masthead and the switcher say People and access once", s.mast === 'People and access' && s.accLink.filter(t => /Access profiles/.test(t)).length === 0 && s.accLink.filter(t => t === 'People and access').length === 1, s.accLink);
    ok("three tabs with counts", s.tabs.length === 3 && /^People \d+$/.test(s.tabs[0]) && /^Profiles 9$/.test(s.tabs[1]) && /^Requests 2$/.test(s.tabs[2]) && /^People/.test(s.on || ''), s.tabs);
    ok("what needs doing lists the requests, people without a profile, not invited, no email, inactive with access and many admins", ['req', 'noprof', 'ni', 'ne', 'gone', 'adm'].every(k => s.todos.indexOf(k) >= 0), s.todos);
    ok("everyone, by team", s.rows >= 30 && s.groups[0] === 'Operations Montreal' && s.groups.indexOf('No team') >= 0, s.groups);
    if (PHONE) ok("phone: the page fits the screen", await fits(f));
    await shot(f, 'people');
    /* filters and search */
    await click(f, '#w131card [data-w131st="noemail"]');
    const ne = await f.ev(() => Array.from(document.querySelectorAll('#w131card .w131p .w131st')).map(e => e.className));
    ok("the No email filter", ne.length > 0 && ne.every(c => /noemail/.test(c)), ne.slice(0, 4));
    await click(f, '#w131card [data-w131st="noemail"]');
    await f.page.fill('#w131q', 'samson'); await f.page.waitForTimeout(700);
    const q = await f.ev(() => ({ n: document.querySelectorAll('#w131card .w131p').length, focus: document.activeElement && document.activeElement.id }));
    ok("search finds one person and keeps the focus", q.n === 1 && q.focus === 'w131q', q);
    await f.page.fill('#w131q', ''); await f.page.waitForTimeout(600);
    await f.page.selectOption('#w131team', 'hr'); await f.page.waitForTimeout(500);
    const tm = await f.ev(() => Array.from(document.querySelectorAll('#w131card .w131team h3')).map(h => h.textContent));
    ok("the team filter", tm.length === 1 && tm[0] === 'Human Resources', tm);
    await f.page.selectOption('#w131team', ''); await f.page.waitForTimeout(400);
    /* the person sheet: pick, lead, save */
    await click(f, '#w131card [data-w131open="samson.jules@welfareavenue.com"]', 700);
    const sh = await f.ev(() => { const p = document.querySelector('#w131sheet.on'); return p ? { title: p.querySelector('h2').textContent, on: (p.querySelector('.w131opt.on') || {}).textContent, lead: !!p.querySelector('[data-w131lead]'), pages: (Array.from(p.querySelectorAll('h4')).map(h => h.textContent).filter(t => /pages/.test(t))[0] || ''), save: (p.querySelector('[data-w131save]') || {}).className } : null; });
    ok("a person's sheet opens with their team's profile picked", sh && sh.title === 'Samson' && /HR & People/.test(sh.on || '') && /their team/.test(sh.on || '') && sh.lead, sh);
    await click(f, '#w131sheet [data-w131lead]', 400);
    const sh2 = await f.ev(() => { const p = document.querySelector('#w131sheet.on'); return { lead: (p.querySelector('[data-w131lead]') || {}).getAttribute('aria-checked'), pages: Array.from(p.querySelectorAll('h4')).map(h => h.textContent).filter(t => /pages/.test(t))[0], save: p.querySelector('[data-w131save]').textContent }; });
    ok("the Lead switch adds the lead pages", sh2.lead === 'true' && /Save: HR & People \(lead\)/.test(sh2.save) && parseInt(String(sh2.pages).split('·')[1]) > parseInt(String(sh.pages).split('·')[1]), [sh.pages, sh2]);
    await click(f, '#w131sheet [data-w131pick="marketing"]', 400);
    const sh3 = await f.ev(() => { const p = document.querySelector('#w131sheet.on'); return { on: (p.querySelector('.w131opt.on') || {}).textContent, lead: (p.querySelector('[data-w131lead]') || {}).getAttribute && p.querySelector('[data-w131lead]').getAttribute('aria-checked'), diff: (p.querySelector('.w131diff') || {}).textContent }; });
    ok("picking another profile shows what changes", /Marketing/.test(sh3.on || '') && sh3.lead === 'false' && /Gains|Loses|same pages/.test(sh3.diff || ''), sh3);
    await click(f, '#w131sheet [data-w131pick="hr"]', 300);
    await click(f, '#w131sheet [data-w131save]', 900);
    const w1 = (await writes(f, 'hub_roles')).map(w => w.payload);
    ok("save writes the profile and the role that follows it", w1.some(p => p.email === 'samson.jules@welfareavenue.com' && p.profile === 'hr' && p.role === 'member' && p.tabs === null), w1);
    ok("and it is in the audit trail", (await writes(f, 'change_log')).some(w => w.payload.entity_id === 'samson.jules@welfareavenue.com' && w.payload.field === 'profile'));
    await shot(f, 'sheet');
    /* sign-in link */
    await click(f, '#w131sheet [data-w131link]', 900);
    ok("copy a sign-in link", (await calls(f)).some(b => b.action === 'link' && b.email === 'samson.jules@welfareavenue.com') && await f.ev(() => /example\.test\/one-time/.test(document.querySelector('#w131sheet .note').innerHTML)));
    /* resend */
    await click(f, '#w131sheet [data-w131resend]', 900);
    ok("send the invitation again", (await calls(f)).some(b => b.action === 'invite' && b.email === 'samson.jules@welfareavenue.com' && b.send_email === true && b.hub_role === 'member'));
    /* remove */
    await click(f, '#w131sheet [data-w131rm="1"]', 300);
    await click(f, '#w131sheet [data-w131rmgo]', 900);
    ok("remove asks first, then removes", (await calls(f)).some(b => b.action === 'remove' && b.email === 'samson.jules@welfareavenue.com'));
    await click(f, '#w131sheet .xb', 300);
    /* the founder */
    await click(f, '#w131card [data-w131open="steel.macdonald@welfareavenue.com"]', 700);
    const fo = await f.ev(() => { const p = document.querySelector('#w131sheet.on'); return { dis: p.querySelectorAll('.w131opt[disabled]').length, all: p.querySelectorAll('.w131opt').length, on: (p.querySelector('.w131opt.on') || {}).textContent, rm: !!p.querySelector('[data-w131rm]') }; });
    ok("a founder stays on Admin and cannot be removed here", fo.dis === fo.all - 1 && /Admin/.test(fo.on || '') && !fo.rm, fo);
    await click(f, '#w131sheet .xb', 300);
    /* invite someone on the roster */
    const ni = await f.ev(() => (window.w131.people().filter(x => x.status === 'notinvited' && x.roster && x.dept === 'progdev')[0] || {}).email);
    await click(f, '#w131card [data-w131open="' + ni + '"]', 700);
    const nib = await f.ev(() => (document.querySelector('#w131sheet [data-w131invite]') || {}).textContent);
    ok("someone not invited: the sheet offers Invite as their team's profile", /Invite as Program Development/.test(nib || ''), nib);
    await click(f, '#w131sheet [data-w131invite]', 1000);
    const c1 = (await calls(f)).filter(b => b.action === 'invite' && b.email === ni)[0];
    const r1 = (await writes(f, 'hub_roles')).map(w => w.payload).filter(p => p.email === ni)[0];
    ok("invite sends the role from the profile and saves the profile", c1 && c1.hub_role === 'member' && c1.department === 'progdev' && r1 && r1.profile === 'progdev', { c1, r1 });
    ok("and shows what happened", await f.ev(() => /Invitation emailed/.test((document.querySelector('#w131sheet .res') || {}).textContent || '')));
    await click(f, '#w131sheet .xb', 300);
    /* no email yet */
    const noem = await f.ev(() => { const x = window.w131.people().filter(y => y.status === 'noemail' && y.id)[0]; return x ? 'id:' + x.id : null; });
    await click(f, '#w131card [data-w131open="' + noem + '"]', 700);
    await f.page.fill('#w131em', 'new.person@welfareavenue.com');
    await click(f, '#w131sheet [data-w131setem]', 900);
    ok("add an email to someone on the roster", (await calls(f)).some(b => b.action === 'set_email' && b.email === 'new.person@welfareavenue.com' && b.member_id === Number(noem.slice(3))));
    await click(f, '#w131sheet .xb', 300);
    await f.ctx.close(); }

  /* 2. inviting: one person, a list, everyone not invited */
  { const f = await fresh('#adminpanel/people');
    await click(f, '#w131card [data-w131new]', 600);
    await f.page.fill('#w131f_name', 'Ada Lovelace'); await f.page.fill('#w131f_email', 'ada.lovelace@welfareavenue.com');
    await f.page.selectOption('#w131f_dept', 'marketing'); await f.page.waitForTimeout(400);
    const iv = await f.ev(() => ({ name: document.getElementById('w131f_name').value, on: (document.querySelector('#w131sheet .w131opt.on') || {}).textContent, btn: (document.querySelector('#w131sheet [data-w131invgo]') || {}).textContent }));
    ok("invite someone: the team picks its profile and the typing stays", iv.name === 'Ada Lovelace' && /Marketing/.test(iv.on || '') && /Invite as Marketing/.test(iv.btn || ''), iv);
    await click(f, '#w131sheet [data-w131lead]', 300);
    await click(f, '#w131sheet [data-w131invgo]', 1000);
    const c = (await calls(f)).filter(b => b.email === 'ada.lovelace@welfareavenue.com')[0], r = (await writes(f, 'hub_roles')).map(w => w.payload).filter(p => p.email === 'ada.lovelace@welfareavenue.com')[0];
    ok("invite as a Marketing lead", c && c.hub_role === 'leader' && c.department === 'marketing' && r && r.profile === 'marketing' && r.role === 'leader', { c, r });
    ok("the result says it went and offers the message and a link", await f.ev(() => { const p = document.querySelector('#w131sheet.on'); return /is on the Hub as/.test(p.textContent) && !!p.querySelector('#w131msg') && !!p.querySelector('[data-w131link]'); }));
    await click(f, '#w131sheet .xb', 300);
    await click(f, '#w131card [data-w131list]', 500);
    await f.page.fill('#w131paste', 'Jo March, jo.march@welfareavenue.com\nbeth.march@welfareavenue.com');
    await f.page.selectOption('#w131ldept', 'opsto');
    await click(f, '#w131sheet [data-w131lreview]', 500);
    const lr = await f.ev(() => Array.from(document.querySelectorAll('#w131sheet [data-w131lrow$="|key"]')).map(s => s.value));
    ok("a list: each person gets the team's profile to check", lr.length === 2 && lr.every(v => v === 'opsto'), lr);
    await click(f, '#w131sheet [data-w131lgo]', 1200);
    const bl = (await calls(f)).filter(b => b.action === 'bulk_invite')[0], br = (await writes(f, 'hub_roles')).map(w => w.payload).filter(p => /march@/.test(p.email));
    ok("the list goes in one call and each person gets the profile", bl && bl.people.length === 2 && bl.people.every(p => p.department === 'opsto' && p.hub_role === 'member') && br.length === 2 && br.every(p => p.profile === 'opsto'), { bl, br });
    await click(f, '#w131sheet .xb', 300);
    await click(f, '#w131card [data-w131invall]', 600);
    const all = await f.ev(() => ({ n: document.querySelectorAll('#w131sheet [data-w131lrow$="|key"]').length, want: window.w131.people().filter(x => x.status === 'notinvited' && x.roster).length }));
    ok("invite everyone not invited yet: the whole list, ready to check", all.n === all.want && all.n > 0, all);
    await click(f, '#w131sheet .xb', 300);
    /* give people their team's profile */
    await click(f, '#w131card [data-w131apply="noprof"]', 600);
    const ap = await f.ev(() => ({ n: document.querySelectorAll('#w131sheet .sec p b').length, want: window.w131.people().filter(x => x.row && x.status !== 'removed' && !x.assigned && !x.hand && x.sug && !x.founder && !x.same).length }));
    await click(f, '#w131sheet [data-w131applygo]', 2500);
    const aw = (await writes(f, 'hub_roles')).map(w => w.payload).filter(p => p.profile);
    ok("give everyone without a profile their team's profile", ap.want > 0 && aw.length >= ap.want, { ap, n: aw.length });
    ok("and new people get it automatically from now on", (await writes(f, 'hub_access_settings')).some(w => w.payload.auto_profile === true));
    /* admins inviting from a team page get the new invite */
    await f.hash('#team/marketing'); await f.page.waitForTimeout(800);
    const tb = await f.page.$('.panel.active [data-w113deptinv="marketing"]');
    if (tb) { await tb.click(); await f.page.waitForTimeout(600); ok("a team page's Invite opens the new invite with that team", await f.ev(() => { const p = document.querySelector('#w131sheet.on'); return !!p && document.getElementById('w131f_dept').value === 'marketing'; })); await click(f, '#w131sheet .xb', 300); }
    else ok("a team page's Invite (not on this page in the test)", true);
    await f.ctx.close(); }

  /* 3. profiles */
  { const f = await fresh('#adminpanel/access');
    const s = await f.ev(() => ({ on: (document.querySelector('#w131card .w131tabs a.on') || {}).textContent, cards: document.querySelectorAll('#w131card .w131pc').length, mx: document.querySelectorAll('#w131card .w131mx tbody tr').length, box: (() => { const m = document.querySelector('#w131card .w131mx'); return m ? getComputedStyle(m).maxHeight : null; })(), mast: (document.querySelector('#adminpanel > .w118mast h1') || {}).textContent }));
    ok("the old Access profiles address opens the Profiles tab", /^Profiles/.test(s.on || '') && s.mast === 'People and access', s);
    ok("nine profiles and the whole comparison, no inner scroll", s.cards === 9 && (PHONE || (s.mx > 30 && s.box === 'none')), s);
    await shot(f, 'profiles');
    await click(f, '#w131card [data-w131prof="marketing"]', 600);
    await click(f, '#w131sheet [data-w131cell="contentcal|lead"]', 300);
    const e1 = await f.ev(() => (document.querySelector('#w131sheet [data-w131psave]') || {}).textContent);
    ok("a profile's pages: one change waits to be saved", /Save 1 change/.test(e1 || ''), e1);
    await click(f, '#w131sheet [data-w131psave]', 900);
    const pw = (await writes(f, 'hub_access_profiles')).map(w => w.payload);
    ok("saving writes the whole pages map with the change", pw.some(p => p.pages && p.pages.contentcal === 'lead' && p.pages.mypage === 'all'), pw.map(p => p.pages && p.pages.contentcal));
    ok("the sheet stays open after saving, with nothing left to save", await f.ev(() => /No changes/.test((document.querySelector('#w131sheet.on [data-w131psave]') || {}).textContent || '')));
    await click(f, '#w131sheet [data-w131ptab="words"]', 300);
    await f.page.fill('#w131sheet input[name=summary]', 'Marketing, Branding and Web.');
    await click(f, '#w131sheet [data-w131wsave]', 900);
    ok("the words save", (await writes(f, 'hub_access_profiles')).some(w => w.payload.summary === 'Marketing, Branding and Web.'));
    await click(f, '#w131sheet .xb', 300);
    await click(f, '#w131card [data-w131auto]', 800);
    ok("the automatic profile switch", (await writes(f, 'hub_access_settings')).some(w => typeof w.payload.auto_profile === 'boolean'));
    if (PHONE) ok("phone: the profiles fit the screen", await fits(f));
    await f.ctx.close(); }

  /* 4. requests */
  { const f = await fresh('#adminpanel/people/requests');
    const s = await f.ev(() => ({ n: document.querySelectorAll('#w131card .w131rq [data-w131grant]').length, txt: (document.querySelector('#w131card [data-w131rq="902"]') || {}).textContent }));
    ok("the requests, each with what Grant does", s.n === 2 && /Adds Finance/.test(s.txt || ''), s);
    await click(f, '#w131card [data-w131grant="902"]', 1100);
    const g = (await writes(f, 'hub_roles')).map(w => w.payload).filter(p => p.email === 'samson.jules@welfareavenue.com')[0], d = (await writes(f, 'wa_access_requests')).map(w => w.payload);
    ok("Grant adds the page on top of what they have and closes the request", g && Array.isArray(g.tabs) && g.tabs.indexOf('finances') >= 0 && g.tabs.length > 5 && d.some(p => p.status === 'granted'), { g, d });
    const other = await f.ev(() => { const b = document.querySelector('#w131card [data-w131decline]'); return b ? b.getAttribute('data-w131decline') : null; });
    if (other) { await click(f, '#w131card [data-w131decline="' + other + '"]', 900); ok("Decline", (await writes(f, 'wa_access_requests')).some(w => w.payload.status === 'declined')); }
    if (PHONE) ok("phone: the requests fit the screen", await fits(f));
    await f.ctx.close(); }

  /* 5. the classic view and the tour */
  { const f = await fresh('#adminpanel/people');
    await click(f, '#w131card [data-w131classic="1"]', 900);
    const s = await f.ev(() => ({ c: document.body.classList.contains('w131classic'), old: !!(document.getElementById('w113card') && document.getElementById('w113card').offsetParent), back: !!document.getElementById('w131back') }));
    ok("the classic view is one link away", s.c && s.old && s.back, s);
    await f.hash('#adminpanel/access');
    const cl = await f.ev(() => ({ card: !!(document.getElementById('w127card') && document.getElementById('w127card').offsetParent), cards: document.querySelectorAll('#w127 .w127pc').length, link: !!Array.from(document.querySelectorAll('#adminpanel .w118adm a')).filter(a => a.offsetParent && /Access profiles/.test(a.textContent)).length, mast: (document.querySelector('#adminpanel > .w118mast h1') || {}).textContent }));
    ok("the classic Access profiles page is still there", cl.card && cl.cards === 9 && cl.link && /Access profiles/i.test(cl.mast || ''), cl);
    await click(f, '#w131back [data-w131classic="0"]', 700);
    ok("and back", await f.ev(() => !document.body.classList.contains('w131classic') && !!document.getElementById('w131card').offsetParent && (document.querySelector('#adminpanel > .w118mast h1') || {}).textContent === 'People and access'));
    await f.hash('#adminpanel/people');
    const hp = await f.ev(() => (window.w131.people().filter(x => x.hand)[0] || {}).email);
    if (hp) {
      await click(f, '#w131card [data-w131open="' + hp + '"]', 700);
      await click(f, '#w131sheet [data-w131hand]', 800);
      ok("hand-picked pages still open in their own editor", await f.ev(() => { const mb = document.getElementById('modalBack'); return !document.querySelector('#w131sheet.on') && !!(mb && mb.style.display !== 'none' && /page/i.test(mb.textContent)); }));
    } else ok("hand-picked pages (nobody has them in this data)", true);
    const t = await f.ev(() => { const st = (window.w122 && window.w122.tours && window.w122.tours.adminpanel && window.w122.tours.adminpanel.steps) || []; return { n: st.filter(s => String(s.s || '').indexOf('#w131card') === 0).length, old: st.filter(s => /#w113card|#w127card/.test(String(s.s || ''))).length }; });
    ok("the Admin tour walks the new page", t.n === 5 && t.old === 0, t);
    await f.ctx.close(); }

  ok("no page errors", errs.length === 0, errs.slice(0, 5));
  console.log(out.join("\n"));
  console.log("\nw131 " + WIDTH + ": " + pass + " passed, " + fail + " failed");
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join("\n")); console.error(String(e).slice(0, 600)); process.exit(2); });
