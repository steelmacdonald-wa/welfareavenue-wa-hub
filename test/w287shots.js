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
    if (f.errs.length) console.log('page errors', f.errs);
    await f.close();
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
