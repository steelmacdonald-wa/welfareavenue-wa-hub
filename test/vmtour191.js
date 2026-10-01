/* vmtour191.js: screenshots of the Volunteer Manager after wave191 (review aid). OUT=<dir> CAND=build/w191.html */
const { launch, fresh } = require('./boot');
const path = require('path');
const OUT = process.env.OUT;
const fx = require('./w191fx');
(async () => {
  const browser = await launch();
  for (const width of [1440, 390]) {
    const f = await fresh(browser, { who: 'admin', hash: '#volunteering', width, fixture: fx(), rpcs: { wa_org_editor: true, is_wa_admin: true, is_wa_leader: true, wa_is_hr: false, is_wa_staff: true, wa191_autotick: { ticked: 0, unticked: 0 },
      wa191_this_week: { today: '2026-09-25', me: 'Steel', servings: [{ id: 900, code: 'WA-26-90', date: '2026-10-02', title: 'Sunday serving', format: null, status: 'planned', stage: 'confirm', days: 7, on_list: 5, confirmed: 2, target: 22, steps_total: 63, steps_done: 6, overdue: 9, unassigned: 3, hub_waiting: 29, next: { step_id: 5001, name: 'Location Specific Requirements', owner: 'Ahmed', due: '2026-09-18', stage: 'plan' } }],
        overdue: [{ step_id: 5001, event_id: 900, code: 'WA-26-90', date: '2026-10-02', name: 'Location Specific Requirements', owner: 'Ahmed', due: '2026-09-18', stage: 'plan' }, { step_id: 5023, event_id: 900, code: 'WA-26-90', date: '2026-10-02', name: 'Briefing Call with Team Leader', owner: 'Eleftherios Katsipis', due: '2026-09-18', stage: 'confirm' }],
        unassigned: [{ step_id: 5047, event_id: 900, code: 'WA-26-90', date: '2026-10-02', name: 'Review & Distribution', due: '2026-09-29', stage: 'prepare' }], mine: [] } }, wait: 5000 });
    for (const [name, h] of [['calendar', '#volunteering'], ['serving', '#volunteering/e/900'], ['sop', '#volunteering/sop']]) {
      await f.hash(h, 3200);
      await f.page.screenshot({ path: path.join(OUT, width + '_' + name + '.png'), fullPage: true });
      console.log(width, name, 'height', await f.ev(() => document.documentElement.scrollHeight), 'textlen', await f.ev(() => (document.querySelector('main') || document.body).innerText.length));
    }
    console.log('errors', f.errs);
    await f.close();
  }
  await browser.close();
})();
