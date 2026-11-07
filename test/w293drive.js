/* w293drive.js: wave293's drive (design 11.6: threads group, filters, Open in Gmail only for Steel, no Delete on email items, the Relationship
   card with Refresh through window.__WA_INVOKE, the Insights tab's three sections from a stubbed overview, admin, CRM member, board viewer,
   390 px). The checks live in test/crm1ui_email_worst.js; this runs its demo and one sets at 1366 and 390 px with every job.
   Invented people only (test/w293fx.js). usage: node test/w293drive.js */
const { spawnSync } = require('child_process');
const path = require('path');
const r = spawnSync(process.execPath, [path.join(__dirname, 'crm1ui_email_worst.js')], {
  env: Object.assign({}, process.env, { WA_DATA: process.env.WA_DATA || 'demo,one', WIDTHS: process.env.WIDTHS || '1366,390', JOBS: 'profile,member,insights,roles' }),
  stdio: 'inherit'
});
process.exit(r.status == null ? 1 : r.status);
