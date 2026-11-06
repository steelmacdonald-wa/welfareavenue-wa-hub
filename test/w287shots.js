/* w287shots.js: before and after screenshots for wave287 (team Overview and Tasks for Marketing, Operations Montreal and Fundraising at
   1280 and 390 wide). CAND=<candidate.html> OUT=<folder> TAG=<before|after> node test/w287shots.js
   Viewport screenshots on a tall window (full-page captures hang on the tasks page), with the wave287 fixture (test/w287fx.js). */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { fresh } = require('./boot');
const { fx287 } = require('./w287fx');
const OUT = process.env.OUT || path.join(__dirname, 'shots_w287');
const TAG = process.env.TAG || 'after';
const ONLY = process.env.ONLY || '';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await chromium.launch({ executablePath: process.env.WA_CHROME, args: ['--disable-gpu'] });
  const runs = [[1280, 1500], [390, 1700]];
  for (const [w, h] of runs) {
    const f = await fresh({ newContext: (x) => b.newContext(Object.assign({ timezoneId: 'America/Toronto' }, x)) }, { who: 'admin', width: w, height: h, hash: '#team/marketing', fixture: fx287(), wait: 5000 });
    for (const d of ['marketing', 'opsmtl', 'fundraising']) {
      for (const pg of ['overview', 'tasks']) {
        const name = TAG + '-' + d + '-' + pg + '-' + w;
        if (ONLY && name.indexOf(ONLY) < 0) continue;
        await f.hash('#team/' + d + (pg === 'tasks' ? '/tasks' : ''), 2600);
        await f.ev(() => window.scrollTo(0, 0));
        await f.page.mouse.move(w - 4, h - 4);
        await f.page.waitForTimeout(500);
        await f.page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 120000, animations: 'disabled' });
        console.log('saved', name);
      }
    }
    if (process.env.EXTRA) {
      /* worst cases for review: Program Development's goal-sentence project, a project list, the drawer, an empty list */
      const extra = [['progdev-overview', '#team/progdev', null], ['progdev-longproject', '#team/progdev/tasks', 'p31'], ['marketing-content', '#team/marketing/tasks', 'p27'], ['opsto-today', '#team/opsto/tasks', 'today']];
      for (const [n, hs, l] of extra) {
        await f.hash(hs, 2600);
        if (l) { await f.ev((x) => window.w116Board.list(x), l); await f.page.waitForTimeout(500); }
        await f.ev(() => window.scrollTo(0, 0)); await f.page.mouse.move(w - 4, h - 4); await f.page.waitForTimeout(400);
        await f.page.screenshot({ path: path.join(OUT, TAG + '-' + n + '-' + w + '.png'), timeout: 120000, animations: 'disabled' });
        console.log('saved', TAG + '-' + n + '-' + w);
      }
      await f.ev(() => { const r = document.querySelector('#w116tasks .w116r[data-tid]'); if (r) r.querySelector('.ttl').click(); }); await f.page.waitForTimeout(700);
      await f.page.screenshot({ path: path.join(OUT, TAG + '-drawer-' + w + '.png'), timeout: 120000, animations: 'disabled' });
    }
    if (f.errs.length) console.log('page errors', f.errs);
    await f.close();
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
