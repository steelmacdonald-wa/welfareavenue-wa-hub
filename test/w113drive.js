/* wave113 drives: People and access module (harness-style loader, hub-invite stubbed in page) */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
const [, , ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", TAG = "steel"] = process.argv;

(async () => {
  const html = fs.readFileSync(path.join(__dirname, "../build/candidate.html"), "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fixture = fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8");
  const shots = path.join(__dirname, "shots_p113");
  fs.mkdirSync(shots, { recursive: true });

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1150 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("PAGEERROR: " + String(e).slice(0, 300)));

  await page.addInitScript(`
    (function(){
      var FIXED = new Date(${JSON.stringify(FIXED_TIME)}).getTime();
      var RealDate = Date;
      function FDate(a,b,c,d,e,f,g){
        if (!(this instanceof FDate)) return new RealDate(FIXED).toString();
        switch (arguments.length) {
          case 0: return new RealDate(FIXED);
          case 1: return new RealDate(a);
          default: return new RealDate(a,b,c,d,e,f,g);
        }
      }
      FDate.now = function(){ return FIXED; };
      FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC;
      FDate.prototype = RealDate.prototype;
      window.Date = FDate;
      window.__WA_TEST_ROLE = ${JSON.stringify(ROLE)};
      window.__WA_TEST_EMAIL = ${JSON.stringify(EMAIL)};
      window.__WA_TEST_NAME = ${JSON.stringify(NAME)};
      window.confirm = function(){ return true; };
      window.alert = function(){};
      try { localStorage.setItem('wa84tour', '1'); } catch (e) {}
      /* sign-in system: two people signed in, one invited-never-signed-in */
      window.__WA_RPCS = { wa_hub_logins: [
        { email: 'steel.macdonald@welfareavenue.com', last_sign_in_at: '2026-08-06T10:00:00Z', account_created: '2026-07-01T00:00:00Z' },
        { email: 'kahkashan.ansary@welfareavenue.com', last_sign_in_at: '2026-08-04T10:00:00Z', account_created: '2026-07-10T00:00:00Z' },
        { email: 'ahmedfakhir@welfareavenue.com', last_sign_in_at: null, account_created: '2026-08-01T00:00:00Z' }
      ] };
      window.__CALLS = [];
    })();
  `);
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") });
    if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub });
    return route.abort();
  });

  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  /* wave131: the old People and access table lives behind the classic view */
  await page.evaluate(() => { document.body.classList.add('w131classic'); });

  /* stub hub-invite in the page: record calls, answer like v2 */
  await page.evaluate(() => {
    db.functions.invoke = function (name, opts) {
      const b = (opts && opts.body) || {};
      window.__CALLS.push({ name, body: b });
      if (name !== 'hub-invite') return Promise.resolve({ data: null, error: null });
      const one = p => ({ ok: true, email: p.email, name: p.name, member_id: 999, email_sent: p.email !== 'fail@welfareavenue.com', note: p.email !== 'fail@welfareavenue.com' ? null : 'email rate limit exceeded', slack: p.email && p.email.indexOf('kahk') === 0 ? 'sent' : 'no_slack', existed: false });
      if (b.action === 'invite') return Promise.resolve({ data: one(b), error: null });
      if (b.action === 'bulk_invite') { const results = b.people.map(one); return Promise.resolve({ data: { ok: true, results, sent: results.length, failed: 0 }, error: null }); }
      if (b.action === 'link') return Promise.resolve({ data: { ok: true, link: 'https://zwnmulmnvopclzcvytce.supabase.co/auth/v1/verify?token=stub&type=magiclink', kind: 'magiclink', existing_account: true }, error: null });
      if (b.action === 'set_email') return Promise.resolve({ data: { ok: true, member_id: b.member_id, email: b.email, name: 'Roster Person' }, error: null });
      if (b.action === 'remove') return Promise.resolve({ data: { ok: true, auth_deleted: true }, error: null });
      return Promise.resolve({ data: { error: 'unknown' }, error: null });
    };
  });

  const out = { identity: TAG };
  const state = () => page.evaluate(() => {
    const card = document.getElementById("w113card");
    const chips = Array.from(document.querySelectorAll("#w113card .w113chip")).map(c => c.textContent.trim());
    const rows = Array.from(document.querySelectorAll("#w113tbl tbody tr[data-w113row]")).length;
    const removed = Array.from(document.querySelectorAll("#w113tbl2 tr[data-w113row]")).length;
    const statuses = {};
    document.querySelectorAll("#w113tbl .w113st").forEach(s => { statuses[s.className.replace('w113st ', '')] = (statuses[s.className.replace('w113st ', '')] || 0) + 1; });
    return { card: !!card, chips, rows, removed, statuses, classicHidden: (document.getElementById("w40body") || {}).style ? document.getElementById("w40body").style.display === 'none' : null, ar: !!document.getElementById("w110ar") };
  });

  await page.evaluate(() => { location.hash = "#adminpanel/people"; });
  await page.waitForTimeout(1500);
  out.admin = await state();
  await page.screenshot({ path: path.join(shots, TAG + "_1_admin.png") });

  if (out.admin.card) {
    /* filter chips + search */
    await page.click('[data-w113st="notinvited"]');
    await page.waitForTimeout(300);
    out.filterNotInvited = (await state()).rows;
    await page.click('[data-w113st="notinvited"]');
    await page.fill('#w113q', 'kahk');
    await page.waitForTimeout(500);
    out.search = await page.evaluate(() => Array.from(document.querySelectorAll("#w113tbl tbody tr[data-w113row] td:nth-child(2) b")).map(b => b.textContent));
    await page.fill('#w113q', '');
    await page.waitForTimeout(500);

    /* single invite via the modal */
    await page.click('[data-w113new]');
    await page.waitForTimeout(300);
    await page.fill('#w113n', 'Test Person');
    await page.fill('#w113e', 'test.person@welfareavenue.com');
    await page.selectOption('#w113d', 'marketing');
    await page.fill('#w113rt', 'Content tester');
    await page.screenshot({ path: path.join(shots, TAG + "_2_invite_modal.png") });
    await page.click('#w113go');
    await page.waitForTimeout(700);
    out.inviteCall = await page.evaluate(() => window.__CALLS.filter(c => c.body.action === 'invite').pop());
    out.inviteResult = await page.evaluate(() => { const m = document.querySelector('.w113modal'); return m ? m.textContent.replace(/\s+/g, ' ').slice(0, 400) : null; });
    await page.screenshot({ path: path.join(shots, TAG + "_3_invite_result.png") });
    await page.click('[data-w113copylink]');
    await page.waitForTimeout(500);
    out.linkCall = await page.evaluate(() => window.__CALLS.filter(c => c.body.action === 'link').pop());
    out.linkLine = await page.evaluate(() => (document.getElementById('w113okline') || {}).textContent);
    await page.click('[data-w113done]');
    await page.waitForTimeout(300);

    /* add a missing email inline */
    const emIn = await page.$('input[data-w113emin]');
    if (emIn) {
      const id = await emIn.getAttribute('data-w113emin');
      await emIn.fill('new.email@welfareavenue.com');
      await page.click('a[data-w113emsave="' + id + '"]');
      await page.waitForTimeout(500);
      out.setEmailCall = await page.evaluate(() => window.__CALLS.filter(c => c.body.action === 'set_email').pop());
    }

    /* bulk: select all invitable, open the bulk modal, run it */
    await page.click('#w113all');
    await page.waitForTimeout(300);
    out.selected = await page.evaluate(() => Object.keys(window.w113Debug().sel).length);
    await page.click('[data-w113bulk]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(shots, TAG + "_4_bulk_modal.png") });
    await page.click('#w113bgo');
    await page.waitForTimeout(700);
    out.bulkCall = await page.evaluate(() => { const c = window.__CALLS.filter(c => c.body.action === 'bulk_invite').pop(); return c ? { n: c.body.people.length, first: c.body.people[0] } : null; });
    out.bulkResult = await page.evaluate(() => { const m = document.querySelector('.w113modal h3'); return m ? m.textContent : null; });
    await page.screenshot({ path: path.join(shots, TAG + "_5_bulk_result.png") });
    await page.click('[data-w113done]');
    await page.waitForTimeout(300);

    /* invite by list */
    await page.click('[data-w113list]');
    await page.waitForTimeout(200);
    await page.fill('#w113paste', 'Amina Diallo, amina.diallo@welfareavenue.com\nJordan Lee <jordan.lee@welfareavenue.com>\nsam.ortiz@welfareavenue.com\nnot an email line');
    await page.click('#w113pgo');
    await page.waitForTimeout(300);
    out.listParsed = await page.evaluate(() => Array.from(document.querySelectorAll('.w113modal .w113rows div')).map(d => d.textContent.replace(/\s+/g, ' ').trim()));
    await page.click('[data-w113cancel]');
    await page.waitForTimeout(200);

    /* remove flow on a non-founder */
    const rm = await page.$('a[data-w113rm]');
    if (rm) {
      const em = await rm.getAttribute('data-w113rm');
      await rm.click();
      await page.waitForTimeout(200);
      await page.click('#w113rmgo');
      await page.waitForTimeout(500);
      out.removeCall = await page.evaluate(() => window.__CALLS.filter(c => c.body.action === 'remove').pop());
      out.removedEmail = em;
    }
    /* classic table fold toggles */
    await page.click('[data-w113fold]');
    await page.waitForTimeout(200);
    out.classicShown = await page.evaluate(() => document.getElementById('w40body').style.display !== 'none' && !!document.getElementById('w72bar'));
    await page.click('[data-w113fold]');

    /* department page button */
    await page.evaluate(() => { location.hash = "#dept/marketing"; });
    await page.waitForTimeout(900);
    out.deptBtn = await page.evaluate(() => !!document.querySelector('#marketing .wa24-links .w113dept'));
    if (out.deptBtn) {
      await page.click('#marketing .wa24-links .w113dept');
      await page.waitForTimeout(300);
      out.deptModal = await page.evaluate(() => { const d = document.getElementById('w113d'); return { deptPreset: d ? d.value : (document.querySelector('.w113lock') || {}).textContent, locked: !d }; });
      await page.screenshot({ path: path.join(shots, TAG + "_6_dept_invite.png") });
      await page.click('[data-w113cancel]');
    }
  } else {
    await page.evaluate(() => { location.hash = "#dept/marketing"; });
    await page.waitForTimeout(900);
    out.deptBtn = await page.evaluate(() => !!document.querySelector('#marketing .wa24-links .w113dept'));
    if (out.deptBtn) {
      await page.click('#marketing .wa24-links .w113dept');
      await page.waitForTimeout(300);
      out.deptModal = await page.evaluate(() => { const d = document.getElementById('w113d'); return { deptPreset: d ? d.value : (document.querySelector('.w113lock') || {}).textContent, locked: !d, access: (document.querySelectorAll('.w113lock')[1] || {}).textContent }; });
      await page.screenshot({ path: path.join(shots, TAG + "_6_dept_invite.png") });
      await page.fill('#w113n', 'Leader Invitee');
      await page.fill('#w113e', 'leader.invitee@welfareavenue.com');
      await page.click('#w113go');
      await page.waitForTimeout(600);
      out.leaderCall = await page.evaluate(() => window.__CALLS.filter(c => c.body.action === 'invite').pop());
      out.leaderResult = await page.evaluate(() => { const m = document.querySelector('.w113modal'); return m ? m.textContent.replace(/\s+/g, ' ').slice(0, 300) : null; });
      out.leaderHasLinkBtn = await page.evaluate(() => !!document.querySelector('[data-w113copylink]'));
    }
  }

  out.errors = errs;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
