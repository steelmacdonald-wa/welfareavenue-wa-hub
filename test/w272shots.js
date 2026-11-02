/* w272shots.js: screenshots of Home further down the page */
const path = require('path'); const { launch, fresh } = require('./boot');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await launch(); const out = process.env.WA_SHOTS;
  for (const [who, width, ys] of [['admin', 1366, [850, 1700]], ['plain', 390, [700, 1500, 2300]]]) {
    const f = await fresh(browser, { who, width, hash: '#mypage' }); await wait(3500);
    await f.ev(() => { document.querySelector('[data-w262home]').click(); });
    await wait(400);
    for (const y of ys) { await f.ev(y => window.scrollTo(0, y), y); await wait(300); await f.page.screenshot({ path: path.join(out, `${who}_${width}_y${y}.png`) }); }
    await f.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
