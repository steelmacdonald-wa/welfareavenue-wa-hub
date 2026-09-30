/* boot.js: shared boot for audit and drive scripts.
   const { launch, fresh } = require('./boot');
   const browser = await launch();
   const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: <object>, init: '<js>' });
   f.page, f.ev(fn, arg), f.hash('#x'), f.close()
   Identities: admin (an admin), member (a member on the HR profile), leader, board (a board viewer), plain (a member on a team profile).
   The fixture defaults to test/fixture_live.json when present, else the scratchpad copy, else test/fixture.json.
   Clock fixed at 2026-09-25 16:00 Toronto; all network except the page and the stubbed libraries is blocked. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SP = '/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/';
const WHO = {
  admin: { email: 'steel.macdonald@welfareavenue.com', name: 'Steel MacDonald', role: 'staff', patch: [] },
  member: { email: 'samson.jules@welfareavenue.com', name: 'Samson Jules', role: 'staff', patch: [{ email: 'samson.jules@welfareavenue.com', role: 'member', profile: 'hr' }] },
  leader: { role: 'staff', patch: [], pick: 'leader' },
  board: { email: 'consult.tamaraangeline@gmail.com', name: 'Tamara Angeline', role: 'board', patch: [] },
  plain: { email: 'joy.dumansi@welfareavenue.com', name: 'Joy Dumansi', role: 'staff', patch: [{ email: 'joy.dumansi@welfareavenue.com', role: 'member', profile: 'marketing' }] }   /* wave169: a member with no HR or leader access */
};

function loadFixture(p) {
  const cands = [p, path.join(__dirname, 'fixture_live.json'), SP + 'fixture_live.json', path.join(__dirname, 'fixture.json')].filter(Boolean);
  for (const c of cands) { if (fs.existsSync(c)) return JSON.parse(fs.readFileSync(c, 'utf8')); }
  throw new Error('no fixture');
}

async function launch() {
  return chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
}

async function fresh(browser, o) {
  o = o || {};
  const C = Object.assign({}, WHO[o.who || 'admin']);
  const W = o.width || 1366, PHONE = W < 700;
  const html = o.html || fs.readFileSync(o.candidate || process.env.CAND || path.join(__dirname, '../build/candidate.html'), 'utf8');
  const stub = fs.readFileSync(path.join(__dirname, 'stub_supabase.js'), 'utf8');
  const fx = o.fixture || loadFixture(o.fixturePath);
  if (C.pick) { /* the first person in the fixture with that access role, and their roster name */
    const r = (fx.hub_roles || []).filter(x => x.role === C.pick)[0] || {};
    const m = (fx.team_members || []).filter(x => (x.email || '').toLowerCase() === (r.email || '').toLowerCase())[0] || {};
    C.email = r.email; C.name = m.name || r.email;
  }
  C.patch.forEach(p => { const r = (fx.hub_roles || []).filter(x => x.email === p.email)[0]; if (r) Object.assign(r, p, { tabs: null }); else (fx.hub_roles = fx.hub_roles || []).push(Object.assign({ tabs: null, note: null }, p)); });
  if (!fx.org_positions && fs.existsSync(SP + 'org_positions.json')) fx.org_positions = JSON.parse(fs.readFileSync(SP + 'org_positions.json', 'utf8'));
  const ctx = await browser.newContext({ viewport: { width: W, height: o.height || (PHONE ? 844 : 900) }, isMobile: PHONE, hasTouch: PHONE });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(`(function(){ var FIXED = new Date("2026-09-25T16:00:00-04:00").getTime(); var RealDate = Date; function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } } FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate; window.__WA_TEST_ROLE = ${JSON.stringify(C.role)}; window.__WA_TEST_EMAIL = ${JSON.stringify(C.email)}; window.__WA_TEST_NAME = ${JSON.stringify(C.name)}; window.confirm = function(){ return true; }; try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa112done', '1'); localStorage.setItem('wa75nudge', '1'); localStorage.setItem('w118bSnooze', String(FIXED + 9e9)); } catch (e) {} })();`);
  await page.addInitScript('window.__WAFIX = ' + JSON.stringify(fx) + '; window.__WA_RPCS = ' + JSON.stringify(o.rpcs || { wa_org_editor: (o.who || 'admin') === 'admin' }) + ';');
  if (o.init) await page.addInitScript(o.init);
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith('http://wahub.test/') && !url.startsWith('http://wahub.test/fonts/')) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
    if (url.indexOf('cytoscape') >= 0) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(__dirname, 'cytoscape.min.js'), 'utf8') });
    if (url.indexOf('chart.umd') >= 0 || url.indexOf('chart.js') >= 0) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(__dirname, 'chart.umd.min.js'), 'utf8') });
    if (url.indexOf('supabase-js') >= 0 || url.indexOf('@supabase') >= 0) return route.fulfill({ contentType: 'application/javascript', body: stub });
    /* the brand fonts from test/fonts (Barlow Condensed, Space Grotesk; OFL), so screenshots match production */
    if (url.indexOf('fonts.googleapis.com/css2') >= 0) {
      const fam = [['Barlow Condensed', 'barlow-condensed'], ['Space Grotesk', 'space-grotesk']];
      const css = fam.filter(f => url.indexOf(f[0].replace(' ', '+')) >= 0).map(f => [400, 500, 600, 700].map(w => "@font-face{font-family:'" + f[0] + "';font-style:normal;font-weight:" + w + ";font-display:swap;src:url(http://wahub.test/fonts/" + f[1] + '-latin-' + w + "-normal.woff2) format('woff2');}").join('')).join('');
      return route.fulfill({ contentType: 'text/css', body: css });
    }
    if (url.startsWith('http://wahub.test/fonts/')) { const fp = path.join(__dirname, 'fonts', url.split('/').pop()); if (fs.existsSync(fp)) return route.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(fp) }); }
    return route.abort();
  });
  if (o.beforeGoto) await o.beforeGoto(page);   /* wave167: extra routes (screenshots with real pictures) win over the block above */
  await page.goto('http://wahub.test/' + (o.hash || ''), { waitUntil: 'domcontentloaded' });
  if (!o.gateOk) await page.waitForFunction(() => { const g = document.getElementById('gate'); return g && g.style.display === 'none'; }, null, { timeout: 30000 });   /* wave175b: gateOk when the test expects the sign-in gate */
  await page.waitForTimeout(o.wait || 3800);
  return {
    page, ctx, errs,
    ev: (f, a) => page.evaluate(f, a),
    hash: async (h, ms) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(ms || 1300); },
    close: () => ctx.close()
  };
}

module.exports = { launch, fresh, WHO, loadFixture };
