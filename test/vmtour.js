/* vmtour.js: screenshots of every Volunteer Manager screen (review aid, not a test). */
const { launch, fresh } = require('./boot');
const path = require('path');
const OUT = process.env.OUT;
const fxmod = require('./w176fx');
(async () => {
  const browser = await launch();
  for (const width of [1440, 390]) {
    const f = await fresh(browser, { who: 'admin', hash: '#volunteering', width, fixture: fxmod(), rpcs: { wa_org_editor: true, is_wa_admin: true, is_wa_leader: true, wa_is_hr: false, is_wa_staff: true }, wait: 4500 });
    for (const [name, h] of [['calendar', '#volunteering'], ['sop', '#volunteering/sop'], ['recipes', '#volunteering/recipes'], ['inventory', '#volunteering/inventory'], ['people', '#volunteering/people'], ['serving', '#volunteering/e/900']]) {
      await f.hash(h, 2500);
      await f.page.screenshot({ path: path.join(OUT, width + '_' + name + '.png'), fullPage: true });
      const t = await f.ev(() => { const m = document.querySelector('main') || document.body; return m.innerText.length; });
      console.log(width, name, 'textlen', t);
    }
    console.log('errors', f.errs);
    await f.close();
  }
  await browser.close();
})();
