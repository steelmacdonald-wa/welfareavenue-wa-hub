/* w141drive.js: planned trainings in the Avenue Academy (wave141, the Slack training lists).
   A training whose body says planned is hidden from learners (paths, library, the older training surfaces); inside
   its Learning Avenue a leader sees a Planned trainings block with Add the content, which opens the edit form;
   saving a link publishes it (body.planned false, filled_by). usage: node test/w141drive.js */
const fs = require('fs');
const path = require('path');
const { launch, fresh } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 400) : '')); } }
const SP = '/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/';
function fixture() {
  const p = [path.join(__dirname, 'fixture_live.json'), SP + 'fixture_live.json', path.join(__dirname, 'fixture.json')].filter(x => fs.existsSync(x))[0];
  const fx = JSON.parse(fs.readFileSync(p, 'utf8'));
  fx.academy_paths = (fx.academy_paths || []).concat([{ key: 'tools', name: 'Your tools and accounts', title: 'Tools and accounts', blurb: 'Slack, Google, OpenPhone.', dept: null, required: false, cert_title: 'Tools Ready', color: '#3A6EA5', icon: 'grid', sort: 25, active: true }]);
  fx.trainings = (fx.trainings || []).concat([
    { id: 9001, key: 'slack:general:0', title: 'Organising your Slack', kind: 'video', resource_url: 'https://www.loom.com/share/e0cc78e19a8c4efda8a830d66b4a14fa', ext_id: 'e0cc78e19a8c4efda8a830d66b4a14fa', source: 'loom', path_group: 'Your tools and accounts', category: 'Tools', minutes: 5, sort: 100, active: true, body: { from: 'Slack training list: General Trainings' } },
    { id: 9002, key: 'slack:general:38', title: 'Quick texts in OpenPhone', kind: 'read', path_group: 'Your tools and accounts', category: 'Tools', description: 'Creating and using saved replies in OpenPhone.', sort: 800, active: true, body: { planned: true, note: 'Creating and using saved replies in OpenPhone.' } },
    { id: 9003, key: 'slack:general:39', title: 'A walk through our Google Drive', kind: 'read', path_group: 'Your tools and accounts', category: 'Tools', description: 'Where things live across the shared drives.', sort: 800, active: true, body: { planned: true, note: 'Where things live across the shared drives.' } },
  ]);
  return fx;
}
const MOCK = `(function(){
  window.__UPD = [];
  var t = setInterval(function(){ if (typeof db === 'undefined' || !db || !db.from || db.from.__w) return;
    var of = db.from.bind(db);
    var f = function (table) { var b = of(table); var ou = b.update.bind(b); b.update = function (p) { window.__UPD.push({ table: table, p: JSON.parse(JSON.stringify(p)) }); return ou(p); }; return b; };
    f.__w = 1; db.from = f;
  }, 5); })();`;

(async () => {
  const browser = await launch();
  /* a leader (Steel is an admin) */
  let f = await fresh(browser, { who: 'admin', hash: '#training/p/tools', fixture: fixture(), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(800);
  const a = await f.ev(() => {
    const sh = document.querySelector('#w122sheet .sh') || document;
    const items = [...sh.querySelectorAll('.pitems .pitem b')].map(b => b.textContent);
    const plan = sh.querySelector('.w141plan');
    return { items, plan: !!plan, planned: plan ? [...plan.querySelectorAll('.w141pl b')].map(b => b.textContent) : [], count: plan ? (plan.querySelector('h3 i') || {}).textContent : null, note: plan ? (plan.querySelector('.w141pl .tx span') || {}).textContent : null, btns: plan ? plan.querySelectorAll('[data-w141fill]').length : 0 };
  });
  ok('the avenue lists only the published training', a.items.length === 1 && a.items[0] === 'Organising your Slack', a);
  ok('a leader sees the Planned trainings block with both planned items', a.plan && a.planned.length === 2 && a.count === '2', a);
  ok('each planned item says what it is and has Add the content', /Creating and using saved replies|Where things live/.test(a.note || '') && a.btns === 2, a);
  await f.ev(() => { const b = [...document.querySelectorAll('[data-w141fill]')].find(x => x.getAttribute('data-w141fill') === '9002'); b.click(); });
  await f.page.waitForTimeout(500);
  const b = await f.ev(() => { const sh = document.querySelector('#w122sheet .sh'); const t = sh && sh.querySelector('[data-f="title"]'); return { form: !!t, title: t ? t.value : null, path: (sh.querySelector('[data-f="path_group"]') || {}).value || null }; });
  ok('Add the content opens the edit form for that training', b.form && b.title === 'Quick texts in OpenPhone' && b.path === 'Your tools and accounts', b);
  await f.ev(() => { const sh = document.querySelector('#w122sheet .sh'); sh.querySelector('[data-f="kind"]').value = 'video'; sh.querySelector('[data-f="resource_url"]').value = 'https://www.loom.com/share/0123456789abcdef0123456789abcdef'; sh.querySelector('[data-w122save]').click(); });
  await f.page.waitForTimeout(900);
  const c = await f.ev(() => window.__UPD.filter(x => x.table === 'trainings').map(x => x.p));
  ok('saving with a link publishes it (planned false, who filled it)', c.length === 1 && c[0].body && c[0].body.planned === false && c[0].body.filled_by && c[0].resource_url && c[0].kind === 'video', c);
  await f.hash('#training');
  await f.page.waitForTimeout(500);
  await f.hash('#training/p/tools');
  await f.page.waitForTimeout(700);
  const d = await f.ev(() => { const sh = document.querySelector('#w122sheet .sh') || document; return { items: [...sh.querySelectorAll('.pitems .pitem b')].map(b => b.textContent), planned: [...sh.querySelectorAll('.w141plan .w141pl b')].map(b => b.textContent) }; });
  ok('the filled training joins the avenue and leaves the planned block', d.items.indexOf('Quick texts in OpenPhone') >= 0 && d.planned.length === 1 && d.planned[0] === 'A walk through our Google Drive', d);
  const e = await f.ev(async () => { try { await wa36Load(true); } catch (x) { return { err: String(x) }; } return { planned: WA36_TRAININGS.filter(t => t.id === 9003).length, video: WA36_TRAININGS.filter(t => t.id === 9001).length }; });
  ok('the older training surfaces never list a planned training', e.planned === 0 && e.video === 1, e);
  ok('no page errors (leader)', f.errs.length === 0, f.errs);
  await f.close();
  /* a member: no planned block, nothing planned in the library */
  f = await fresh(browser, { who: 'member', hash: '#training/p/tools', fixture: fixture(), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(800);
  const g = await f.ev(() => { const sh = document.querySelector('#w122sheet .sh') || document; return { items: [...sh.querySelectorAll('.pitems .pitem b')].map(b => b.textContent), plan: !!document.querySelector('.w141plan') }; });
  ok('a member sees the published training and no planned block', g.items.length === 1 && !g.plan, g);
  await f.hash('#training');
  await f.page.waitForTimeout(700);
  const h = await f.ev(() => { const txt = (document.querySelector('#training') || document.body).textContent; return { quick: txt.indexOf('Quick texts in OpenPhone') >= 0, drive: txt.indexOf('A walk through our Google Drive') >= 0, slack: txt.indexOf('Organising your Slack') >= 0 }; });
  ok('the library never shows a planned training to a member', !h.quick && !h.drive, h);
  ok('no page errors (member)', f.errs.length === 0, f.errs);
  await f.close();
  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw141drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
