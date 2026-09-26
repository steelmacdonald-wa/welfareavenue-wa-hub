/* w138shots.js: screenshots of the @mention picker, the hint and Settings (desktop and phone). usage: node test/w138shots.js <outdir> */
const { launch, fresh } = require('./boot');
const OUT = process.argv[2] || '/tmp';
(async () => {
  const browser = await launch();
  for (const W of [1366, 390]) {
    const f = await fresh(browser, { who: 'admin', width: W, hash: '#team/marketing/tasks', wait: 4500, init: `window.__WAFIX.slack_links = [];` });
    await f.ev(() => window.w116Board.open(90001)); await f.page.waitForTimeout(1200);
    await f.page.focus('#w116cmtx'); await f.page.keyboard.type('Can you check the caption before Friday @j', { delay: 10 }); await f.page.waitForTimeout(400);
    await f.ev(() => { const t = document.getElementById('w116cmtx'); t.scrollIntoView({ block: 'center' }); });
    await f.page.waitForTimeout(300);
    await f.page.screenshot({ path: OUT + '/1_picker_' + W + '.png' });
    await f.page.keyboard.press('Enter'); await f.page.keyboard.type('please', { delay: 10 }); await f.page.waitForTimeout(700);
    await f.page.screenshot({ path: OUT + '/2_hint_' + W + '.png' });
    await f.ev(() => { document.getElementById('w116cmtx').value = ''; window.w116Board.closeDrawer(); });
    await f.ev(() => window.w116Settings('connections')); await f.page.waitForTimeout(900);
    await f.page.screenshot({ path: OUT + '/3_settings_' + W + '.png' });
    await f.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
