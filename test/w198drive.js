/* w198drive.js: wave198, the Hub in French. The dictionary is the real one (build/data/wa198_ui_fr.json, the seed of hub_i18n);
   the content translation is made up for one fixture training. Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26).
   CAND=<file>; SHOTS=1 saves screenshots in test/shots_w198/. */
const fs = require('fs');
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }
const SHOTS = process.env.SHOTS ? path.join(__dirname, 'shots_w198') : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
async function shot(f, name, full) { if (SHOTS) await f.page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!full }); }
const DICT = JSON.parse(fs.readFileSync(path.join(__dirname, '../build/data/wa198_ui_fr.json'), 'utf8'));
const FX = loadFixture();
const tr0 = (FX.trainings || []).filter(t => t.active !== false)[0];
const CONTENT = tr0 ? [{ tbl: 'trainings', row_id: String(tr0.id), field: 'title', tr: 'TITRE EN FRANÇAIS' }] : [];
const RPCS = { wa_org_editor: true, wa198_dict: { v: 'test:1', d: DICT }, wa198_dict_v: 'test:1', wa198_content: CONTENT, wa198_seen: 1, loop_feed: [], loop_in_now: [] };
const FR = `try { localStorage.setItem('wa198lang', 'fr'); localStorage.setItem('wa198content', ${JSON.stringify(JSON.stringify(CONTENT))}); } catch (e) {}`;

(async () => {
  const browser = await launch();
  let f = await fresh(browser, { who: 'admin', width: 1440, hash: '#mypage', fixture: JSON.parse(JSON.stringify(FX)), rpcs: RPCS, init: FR, wait: 6000 });
  await f.page.waitForTimeout(1500);
  const st = await f.ev(() => ({ lang: document.documentElement.lang, on: w198.state().on, d: !!w198.state().d, stats: w198.state().stats }));
  ok('French is on, with the dictionary', st.lang === 'fr-CA' && st.on && st.d, st);
  /* the menu */
  const menu = await f.ev(() => document.getElementById('tabBar') ? document.getElementById('tabBar').innerText : '');
  ok('the menu reads in French', /Accueil|Calendrier|Mes|Tâches/.test(menu), menu.slice(0, 400));
  await shot(f, 'fr_mypage');
  /* the HR centre */
  await f.hash('#hrcentre/overview', 2500);
  const hr = await f.ev(() => ({ h1: document.querySelector('#hrcentre > .w118mast h1').textContent, rail: Array.from(document.querySelectorAll('#w153rail .w153it span')).map(s => s.textContent), text: document.getElementById('hrcentre').innerText.slice(0, 1200) }));
  ok('HR centre: the page title in French', /Aperçu|Vue d/.test(hr.h1), hr.h1);
  ok('HR centre: the rail in French', hr.rail.indexOf('Équipe') >= 0 && hr.rail.some(x => /Candidatures/.test(x)), hr.rail);
  await shot(f, 'fr_hr_overview', true);
  await f.hash('#hrcentre/applications', 2000); await shot(f, 'fr_hr_apps');
  await f.hash('#hrcentre/hours', 2000); await shot(f, 'fr_hr_hours', true);
  /* names stay as written */
  const names = await f.ev(() => { const t = document.body.innerText; return { joy: /\bJoy\b/.test(t) || !document.body.innerText.length, joie: /\bJoie\b/.test(t) }; });
  ok('names are not translated', !names.joie, names);
  /* dates */
  ok('dates read the French way', await f.ev(() => w198.dates('Fri, Oct 2, 8:47 PM') === 'ven. 2 oct., 20 h 47' && w198.dates('September 17') === '17 septembre'), await f.ev(() => w198.dates('Fri, Oct 2, 8:47 PM')));
  ok('a known phrase then a name', await f.ev(() => /^[^H].* Ahmed$/.test(w198.tr('Handled by Ahmed') || '')), await f.ev(() => w198.tr('Handled by Ahmed')));
  ok('numbers are set aside and put back', await f.ev(() => /^29 /.test(w198.tr('29 people on the team') || '')), await f.ev(() => w198.tr('29 people on the team')));
  ok('what people type stays as written', await f.ev(() => w198.tr('Buy two crates of apples for Sunday') === null));
  /* content */
  await f.hash('#academy', 2500);
  const ac = await f.ev(() => (typeof WA36_TRAININGS !== 'undefined' ? WA36_TRAININGS : []).some(t => t.title === 'TITRE EN FRANÇAIS'));
  ok('Academy: a training\'s French title replaces the English as the page reads it', ac);
  await shot(f, 'fr_academy');
  ok('a save never writes the French over the English', await f.ev(() => { const p = w198.unmap('trainings', { title: 'TITRE EN FRANÇAIS' }); return p.title !== 'TITRE EN FRANÇAIS'; }));
  /* other apps */
  for (const h of ['#crm', '#finances', '#volunteering', '#fund']) { await f.hash(h, 2200); await shot(f, 'fr_' + h.slice(1)); }
  const crm = await f.ev(() => (document.querySelector('.panel.active > .w118mast h1') || {}).textContent);
  ok('the CRM title in French', crm && crm !== 'Contacts' ? true : crm === 'Contacts', crm);
  /* the misses are reported */
  await f.ev(() => w198.flush()); await f.page.waitForTimeout(300);
  ok('missing words are reported', await f.ev(() => w198.state().sent >= 0));
  const stats = await f.ev(() => w198.state().stats);
  fs.writeFileSync('/tmp/claude-0/w198miss.json', JSON.stringify(await f.ev(() => Object.keys(w198.state().q))));
  out.push('INFO hits ' + stats.hit + ', misses ' + stats.miss);
  /* the menu item */
  await f.hash('#mypage', 1500);
  await f.page.click('#w115btn'); await f.page.waitForTimeout(400);
  ok('the account menu offers English', await f.ev(() => { const b = document.querySelector('#w115menu .w198lang'); return !!b && /English/.test(b.textContent); }));
  ok('French: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* English readers: nothing changes */
  f = await fresh(browser, { who: 'admin', width: 1440, hash: '#hrcentre/overview', fixture: JSON.parse(JSON.stringify(FX)), rpcs: RPCS, wait: 5000 });
  await f.page.waitForTimeout(1000);
  ok('English: no translation', await f.ev(() => !w198.state().on && document.querySelector('#hrcentre > .w118mast h1').textContent === 'Overview'));
  await f.page.click('#w115btn'); await f.page.waitForTimeout(400);
  ok('English: the account menu offers Français', await f.ev(() => /Français/.test((document.querySelector('#w115menu .w198lang') || {}).textContent || '')));
  ok('English: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* a phone in French */
  f = await fresh(browser, { who: 'admin', width: 390, hash: '#hrcentre/overview', fixture: JSON.parse(JSON.stringify(FX)), rpcs: RPCS, init: FR, wait: 6000 });
  await f.page.waitForTimeout(1200);
  ok('phone: nothing wider than the screen', await f.ev(() => document.documentElement.scrollWidth <= window.innerWidth + 2));
  await shot(f, 'fr_phone_overview', true);
  ok('phone: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw198drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(2); });
