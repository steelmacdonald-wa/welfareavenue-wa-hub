/* w285peek.js: a quick look at one wave285 set (SET=demo|rules|worst|empty|one|forty|home, W=width, HASH=...), printing the page's text and any errors. */
const { chromium } = require('playwright');
const { fresh } = require('./boot');
const { fx285 } = require('./w285fx');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--disable-gpu'] });
  const set = process.env.SET || 'demo', d = fx285(set);
  const f = await fresh({ newContext: (x) => b.newContext(Object.assign({ timezoneId: 'America/Toronto' }, x)) }, { who: process.env.WHO || 'admin', width: Number(process.env.W || 1280), hash: process.env.HASH || '#hrcentre/onboarding', fixture: d.fx, rpcs: d.rpcs, init: d.init, wait: 5000 });
  const cons = []; f.page.on('console', (m) => { if (m.type() === 'error') cons.push(m.text().slice(0, 300)); });
  if (!process.env.HASH) { await f.hash('#hrcentre/overview', 1200); await f.hash('#hrcentre/onboarding', 2500); } else await f.hash(process.env.HASH, 2500);
  console.log(await f.ev((s) => { const e = document.querySelector(s); return e ? e.innerText : '(none ' + s + ')'; }, process.env.SEL || '#w285'));
  if (process.env.OPEN) { await f.ev((k) => document.querySelector('[data-w285open="' + k + '"]').click(), process.env.OPEN); await f.page.waitForTimeout(800);
    for (const t of (process.env.TABS || 'ov').split(',')) { await f.ev((x) => { const b2 = document.querySelector('#w285pan [data-w285tab="' + x + '"]'); if (b2) b2.click(); }, t); await f.page.waitForTimeout(700); console.log('--- panel ' + t + '\n' + await f.ev(() => document.querySelector('#w285pan .pn').innerText)); } }
  if (process.env.SHOT) await f.page.screenshot({ path: process.env.SHOT, fullPage: true });
  console.log('ERRORS', JSON.stringify(f.errs.concat(cons)));
  await f.close(); await b.close();
})();
