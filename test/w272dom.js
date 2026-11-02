/* w272dom.js: a compact outline of what Home draws, for styling (who, width from argv) */
const { launch, fresh } = require('./boot');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await launch();
  const who = process.argv[2] || 'admin', width = Number(process.argv[3] || 1366);
  const f = await fresh(browser, { who, width, hash: '#mypage' });
  await wait(3500);
  const out = await f.ev(() => {
    const sel = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
    const lines = [];
    function walk(e, d, seen) {
      if (d > 4) return;
      const k = sel(e); if (seen.has(k)) return; seen.add(k);
      const cs = getComputedStyle(e);
      lines.push('  '.repeat(d) + k + (e.children.length ? ' (' + e.children.length + ')' : '') + ' ' + Math.round(cs.fontSize.replace('px', '')) + 'px' + (e.children.length === 0 && e.textContent.trim() ? ' "' + e.textContent.trim().slice(0, 28) + '"' : ''));
      [...e.children].forEach(c => walk(c, d + 1, seen));
    }
    const page = document.getElementById('mypage');
    [...page.children].forEach(c => { lines.push('== ' + sel(c)); if (c.id === 'w105sign' || c.id === 'w105my') walk(c, 0, new Set()); });
    [...document.getElementById('mpBody').children].forEach(c => { lines.push('-- ' + sel(c) + ' display=' + getComputedStyle(c).display); walk(c, 1, new Set()); });
    return lines.join('\n');
  });
  console.log(out);
  await f.close(); await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
