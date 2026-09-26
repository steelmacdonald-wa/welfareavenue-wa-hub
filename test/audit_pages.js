/* audit_pages.js <who> [outdir]: walks every page in the menu (and the team pages) and records, per page,
   the masthead, the section headings, the card titles and the buttons, plus a full-page screenshot.
   Output: <outdir>/pages_<who>.json and <outdir>/shots_<who>/<page>.png. Used by the 26/09/26 audit to find repetition. */
const fs = require('fs');
const path = require('path');
const { launch, fresh } = require('./boot');
const WHO = process.argv[2] || 'admin';
const OUT = process.argv[3] || '/tmp/audit_pages';
const SHOTS = !process.env.NOSHOT;
fs.mkdirSync(path.join(OUT, 'shots_' + WHO), { recursive: true });

(async () => {
  const browser = await launch();
  const f = await fresh(browser, { who: WHO, width: 1366, height: 900 });
  const nav = await f.ev(() => {
    const out = [];
    document.querySelectorAll('#tabBar .tab[data-tab]').forEach(b => {
      const vis = !!(b.offsetParent || b.getClientRects().length) && getComputedStyle(b).display !== 'none';
      const g = b.closest('.tab-group'), row = b.closest('.w42d, .w116row, [data-w116team]');
      out.push({ id: b.getAttribute('data-tab'), label: (b.textContent || '').replace(/\s+/g, ' ').trim(), group: g ? (g.getAttribute('data-w42g') || '') : '', groupLabel: g ? ((g.querySelector('.tab-group-h') || {}).textContent || '').replace(/\s+/g, ' ').replace('▼', '').trim() : '', inTeamRow: !!row, visible: vis });
    });
    return out;
  });
  const routes = [];
  const seen = {};
  nav.filter(n => n.visible || n.inTeamRow).forEach(n => {
    let r = '#' + n.id;
    if (['opsmtl', 'progdev', 'opsto', 'marketing', 'fundraising', 'hr', 'board'].indexOf(n.id) >= 0) r = '#team/' + n.id;
    if (!seen[r]) { seen[r] = 1; routes.push({ route: r, label: n.label, group: n.groupLabel }); }
  });
  const pages = [];
  for (const r of routes) {
    await f.hash(r.route, 2200);
    const info = await f.ev(() => {
      const p = document.querySelector('main > .panel.active, main > section.panel.active') || document.querySelector('.panel.active');
      if (!p) return { panel: null };
      const txt = el => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');
      const visible = el => !!(el && (el.offsetParent || el.getClientRects().length));
      const mast = p.querySelector('.w118mast');
      const heads = [];
      p.querySelectorAll('h1, h2, h3, h4, .card-title, .w116h, legend').forEach(h => { if (visible(h)) { const t = txt(h); if (t && t.length < 140) heads.push(h.tagName.toLowerCase() + ': ' + t); } });
      const buttons = [];
      p.querySelectorAll('button, a.btn, a[data-w133go], a[href^="#"]').forEach(b => { if (visible(b)) { const t = txt(b); if (t && t.length < 60) buttons.push(t); } });
      return { panel: p.id, mast: txt(mast).slice(0, 300), heads: heads.slice(0, 120), buttons: Array.from(new Set(buttons)).slice(0, 120), height: p.scrollHeight, text: txt(p).length };
    });
    pages.push(Object.assign({}, r, info));
    if (SHOTS) { try { await f.page.screenshot({ path: path.join(OUT, 'shots_' + WHO, r.route.replace(/[#/]/g, '_') + '.png'), fullPage: true }); } catch (e) { /* fine */ } }
  }
  fs.writeFileSync(path.join(OUT, 'pages_' + WHO + '.json'), JSON.stringify({ who: WHO, nav, pages, errs: f.errs }, null, 1));
  console.log(WHO, 'nav', nav.length, 'pages', pages.length, 'errors', f.errs.length);
  await browser.close();
})();
