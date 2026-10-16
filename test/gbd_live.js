// Live checks beyond the drive pages: the site's ordinary Donate button is unchanged, the language switch, the events card,
// and Stripe's form mounting for a drive gift (a session is created and left unpaid; it is expired afterwards from SQL).
const { chromium } = require('playwright');
const SHOTS = process.argv[2];
(async () => {
  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
  const out = {};
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage(); const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror ' + e.message));
  // 1. the ordinary Donate button on /donate/ (no campaign): as before
  await page.goto('https://welfareavenue.com/donate/?v=' + Date.now(), { waitUntil: 'load' });
  await page.click('#give [data-wa-donate]');
  let f = await (await page.waitForSelector('.wa-dn-box iframe')).contentFrame();
  await f.waitForSelector('#give');
  out.plain = { src: await page.$eval('.wa-dn-box iframe', e => e.getAttribute('src')), h1: await f.$eval('h1', e => e.textContent), freq: !!(await f.$('[data-freq="monthly"]')), lock: !!(await f.$('.lockdes')) };
  await page.screenshot({ path: SHOTS + '/plain-donate-popup.png' });
  await page.keyboard.press('Escape');
  // 2. the language switch on the drive page
  await page.goto('https://welfareavenue.com/gift-basket-drive/?v=' + Date.now(), { waitUntil: 'load' });
  await Promise.all([page.waitForNavigation(), page.click('header a.lang')]);
  out.langSwitch = page.url();
  await Promise.all([page.waitForNavigation(), page.click('header a.lang')]);
  out.langBack = page.url();
  // 3. the events page card
  await page.goto('https://welfareavenue.com/events/?v=' + Date.now(), { waitUntil: 'load' }); await page.waitForTimeout(1500);
  const card = await page.$('#fundraisers a[href="/gift-basket-drive/"]');
  out.eventsLink = !!card;
  if (card) { await card.scrollIntoViewIfNeeded(); await page.waitForTimeout(800); await (await page.$('#fundraisers')).screenshot({ path: SHOTS + '/events-fundraisers.png' }); }
  // 4. Stripe's form for a drive gift (nothing paid)
  await page.goto('https://welfareavenue.com/gift-basket-drive/?v=' + Date.now(), { waitUntil: 'load' });
  await page.click('.hero [data-wa-donate]');
  f = await (await page.waitForSelector('.wa-dn-box iframe')).contentFrame();
  await f.waitForSelector('#give');
  await page.waitForTimeout(3500); // the token must be at least 3 s old
  await f.click('#go');
  const mounted = await f.waitForSelector('iframe[src*="stripe.com"], iframe[name*="embedded-checkout"], iframe[title*="Stripe" i]', { timeout: 25000 }).then(() => true).catch(() => false);
  out.stripeMounted = mounted;
  out.payLine = await f.$eval('#app', e => e.innerText.slice(0, 200)).catch(() => null);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: SHOTS + '/drive-stripe-form.png' });
  out.errs = errs.filter(e => !/stripe\.(com|network)/.test(e));
  out.stripeNoise = errs.length - out.errs.length;
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
