/* w285card.js: a picture of one element of a wave285 set (SET, WHO, HASH, SEL, W, OUT): the manager's Home card without the page around it. */
const { chromium } = require('playwright');
const { fresh } = require('./boot');
const { fx285 } = require('./w285fx');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--disable-gpu'] });
  const d = fx285(process.env.SET || 'home');
  const f = await fresh({ newContext: (x) => b.newContext(Object.assign({ timezoneId: 'America/Toronto' }, x)) }, { who: process.env.WHO || 'plain', width: Number(process.env.W || 1280), hash: process.env.HASH || '#mypage', fixture: d.fx, rpcs: d.rpcs, init: d.init, wait: 5000 });
  await f.hash(process.env.HASH || '#mypage', 3000);
  await f.page.mouse.move(900, 880);
  await f.page.locator(process.env.SEL || '#w285home').screenshot({ path: process.env.OUT });
  await f.close(); await b.close();
})();
