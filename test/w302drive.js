/* wave302 drive test: the redesigned Finance app with real Finance data (09/11/26), clock on 2026-11-09.
   node w302drive.js <candidate.html> <outdir> */
const path = require('path');
const fs = require('fs');
const HUB = '/home/claude/welfareavenue-wa-hub/test/';
const { launch, fresh } = require(HUB + 'boot');
const cand = process.argv[2], out = process.argv[3] || '/tmp/w302shots';
fs.mkdirSync(out, { recursive: true });
const fin = JSON.parse(fs.readFileSync(path.join(__dirname, 'fin_fixture.json'), 'utf8'));
function fixture() {
  const fx = JSON.parse(fs.readFileSync(HUB + 'fixture.json', 'utf8'));
  Object.assign(fx, JSON.parse(JSON.stringify(fin)));
  fx.dept_tasks = (fx.dept_tasks || []);
  return fx;
}
const CLOCK = `(function(){ var FIXED = new Date("2026-11-09T10:00:00-05:00").getTime(); var RealDate = Object.getPrototypeOf(new Date()).constructor; var Base = window.Date; function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } } FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate; })();`;
const CALLS = `window.__W302 = []; window.__WA_INVOKE = function (name, opts) { window.__W302.push([name, opts && opts.body]); if (name === 'finance-drive') return { data: { ok: true, apply: { applied: 1, failed: [] }, scan: { added: {} }, statements: { imported: [] } }, error: null }; if (name === 'qbo-connect') return { data: { url: 'about:blank' }, error: null }; return { data: null, error: null }; };`;

(async () => {
  const browser = await launch();
  const results = [];
  const check = (name, ok, extra) => { results.push((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' :: ' + extra : '')); };
  for (const run of (process.env.ONLY === 'board' ? [{ who: 'board', width: 1366 }, { who: 'board', width: 390 }] : [{ who: 'admin', width: 1366 }, { who: 'admin', width: 390 }, { who: 'board', width: 1366 }])) {
    const tag = run.who + '-' + run.width;
    const f = await fresh(browser, { who: run.who, width: run.width, hash: '#finances', candidate: cand, fixture: fixture(), init: CLOCK + CALLS,
      rpcs: { wa_org_editor: run.who === 'admin', qbo_status: { connected: false, keys: true }, finance_doc_act: { id: 0 }, finance_budget_copy: 63 }, wait: 4500 });
    const p = f.page;
    await p.waitForTimeout(1500);
    const st = await f.ev(() => ({
      cur: document.querySelector('#finances .w94tab.on') && document.querySelector('#finances .w94tab.on').getAttribute('data-w94tab'),
      tabs: Array.from(document.querySelectorAll('#w94nav .w94tab')).map(b => b.getAttribute('data-w94tab') + ':' + b.textContent.trim()),
      title: (document.querySelector('#finances > .w118mast h1') || {}).textContent,
      tiles: Array.from(document.querySelectorAll('#w302today .w302tile .v')).map(x => x.textContent),
      need: Array.from(document.querySelectorAll('#w302today .w302need button')).map(b => b.innerText.replace(/\s+/g, ' ').trim()),
      pills: (function () { var x = document.getElementById('w92pills'); return x ? getComputedStyle(x).display : 'none'; })(),
      rail: Array.from(document.querySelectorAll('.w153it')).map(a => a.innerText.replace(/\s+/g, ' ').trim()),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check(tag + ' opens on Today', st.cur === 'today', JSON.stringify(st.cur));
    check(tag + ' title Today', /Today/.test(st.title || ''), st.title);
    check(tag + ' bank tile', st.tiles[0] === '$3,816.04', st.tiles.join(' | '));
    check(tag + ' pills hidden on Today', st.pills === 'none', st.pills);
    check(tag + ' no sideways scroll', st.overflow <= 1, String(st.overflow));
    results.push('     tabs: ' + st.tabs.join(', '));
    results.push('     rail: ' + st.rail.join(' / '));
    results.push('     needs: ' + st.need.join(' | '));
    await p.screenshot({ path: out + '/' + tag + '-today.png', fullPage: true });
    const secs = run.who === 'board' ? ['bank', 'budget'] : ['match', 'bank', 'budget', 'files'];
    for (const s of secs) {
      await f.ev(id => window.w302.go(id), s);
      await p.waitForTimeout(900);
      const info = await f.ev(id => { var b = document.getElementById('w302' + id); return { len: b ? b.innerText.length : -1, text: b ? b.innerText.slice(0, 220).replace(/\s+/g, ' ') : '', vis: b ? b.offsetParent !== null : false, title: (document.querySelector('#finances > .w118mast h1') || {}).textContent }; }, s);
      check(tag + ' ' + s + ' drawn', info.vis && info.len > 40, info.title + ' :: ' + info.text.slice(0, 160));
      await p.screenshot({ path: out + '/' + tag + '-' + s + '.png', fullPage: true });
    }
    if (run.who === 'admin' && run.width === 1366) {
      /* Match tabs and an action */
      await f.ev(() => window.w302.go('match', 'confirm'));
      await p.waitForTimeout(500);
      const m = await f.ev(() => ({ cards: document.querySelectorAll('#w302match .w302doc').length, lines: document.querySelectorAll('#w302match .w302doc .line').length, seg: document.querySelector('#w302match .w302seg').innerText.replace(/\s+/g, ' ') }));
      check('match confirm cards', m.cards > 0, JSON.stringify(m));
      for (const tb of ['missing', 'problems', 'waiting', 'matched']) {
        await f.ev(t => { document.querySelector('#w302match [data-w302tab="' + t + '"]').click(); }, tb);
        await p.waitForTimeout(250);
        const n = await f.ev(() => document.querySelectorAll('#w302match .w302doc').length);
        results.push('     match ' + tb + ': ' + n + ' cards');
        if (tb === 'missing') await p.screenshot({ path: out + '/admin-match-missing.png', fullPage: true });
      }
      /* pick a bank line on a missing one */
      await f.ev(() => { document.querySelector('#w302match [data-w302tab="missing"]').click(); });
      await p.waitForTimeout(200);
      await f.ev(() => { var b = document.querySelector('#w302match [data-w302pick]'); if (b) b.click(); });
      await p.waitForTimeout(600);
      const pk = await f.ev(() => document.querySelectorAll('#w302match .w302pick button').length);
      check('pick offers bank lines', pk > 0, String(pk));
      await p.screenshot({ path: out + '/admin-match-pick.png', fullPage: true });
      /* Bank: the month check */
      await f.ev(() => window.w302.go('bank'));
      await p.waitForTimeout(600);
      const bk = await f.ev(() => ({ ok: (document.querySelector('#w302bank .w302ok') || {}).innerText, rows: document.querySelectorAll('#w302bank .w302lines tbody tr').length, months: Array.from(document.querySelectorAll('#w302bank .w302months button')).map(b => b.className.trim()).join(',') }));
      check('bank reconciles', /to the cent/.test(bk.ok || ''), JSON.stringify(bk));
      await f.ev(() => { var b = document.querySelector('#w302bank [data-w302fy="2026"]'); if (b) b.click(); });
      await p.waitForTimeout(800);
      const bk2 = await f.ev(() => ({ ok: (document.querySelector('#w302bank .w302ok') || {}).innerText, rows: document.querySelectorAll('#w302bank .w302lines tbody tr').length, h: (document.querySelector('#w302bank h3') || {}).innerText }));
      check('bank FY26 Sep', bk2.rows > 0, JSON.stringify(bk2));
      await p.screenshot({ path: out + '/admin-bank-fy26.png', fullPage: true });
      /* Files: approve calls apply */
      await f.ev(() => window.w302.go('files'));
      await p.waitForTimeout(400);
      await f.ev(() => { var b = document.querySelector('#w302files [data-w302act="approve"]'); if (b) b.click(); });
      await p.waitForTimeout(2600);
      const calls = await f.ev(() => window.__W302.map(c => c[0] + ':' + (c[1] && c[1].action)));
      check('approve then apply', calls.indexOf('finance-drive:apply') >= 0, calls.join(','));
      /* older sections still there */
      for (const s of ['overview', 'txns', 'trends', 'money', 'tasks']) {
        await f.ev(id => window.w94Show(id), s);
        await p.waitForTimeout(400);
        const v = await f.ev(id => { var sh = document.querySelector('#finances .w94sec[data-w94sec="' + id + '"]'); return sh ? sh.innerText.length : -1; }, s);
        check('older section ' + s, v > 20, String(v));
      }
      await f.ev(() => window.w94Show('overview'));
      await p.waitForTimeout(400);
      await p.screenshot({ path: out + '/admin-overview.png', fullPage: false });
      /* the tour */
      const tour = await f.ev(() => { try { var T = window.w122 && window.w122.tours; return T ? Object.keys(T).length : 'no w122.tours'; } catch (e) { return String(e); } });
      results.push('     tours: ' + tour);
    }
    results.push('     page errors: ' + (f.errs.length ? f.errs.join(' || ') : 'none'));
    await f.close();
  }
  await browser.close();
  console.log(results.join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
