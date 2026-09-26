/* w139drive.js: profile photos from Slack (wave139).
   The profile editor says where the photo comes from until you choose one; removing a photo saves avatar_url as ''
   (no photo by choice), so the daily sync leaves it alone; a Slack photo (avatars/slack/...) shows like any photo.
   usage: node test/w139drive.js */
const { launch, fresh } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 400) : '')); } }
const SLACK_URL = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/avatars/slack/37.jpg?v=abc123';
const MOCK = `(function(){
  var fx = window.__WAFIX;
  (fx.team_members || []).forEach(function (m) { if (String(m.email || '').toLowerCase() === 'steel.macdonald@welfareavenue.com') m.avatar_url = ${JSON.stringify(SLACK_URL)}; });
  window.__UPD = [];
  var t = setInterval(function(){ if (typeof db === 'undefined' || !db || !db.from || db.from.__w) return;
    var of = db.from.bind(db);
    var f = function (table) { var b = of(table); var ou = b.update.bind(b); b.update = function (p) { window.__UPD.push({ table: table, p: JSON.parse(JSON.stringify(p)) }); return ou(p); }; return b; };
    f.__w = 1; db.from = f;
  }, 5); })();`;

(async () => {
  const browser = await launch();
  const f = await fresh(browser, { who: 'admin', hash: '#mypage', init: MOCK, wait: 4500 });
  const a = await f.ev(() => { const img = document.querySelector('#w115btn img'); return { src: img ? img.getAttribute('src') : null }; });
  ok('a Slack photo shows in the profile bubble', /avatars\/slack\/37\.jpg/.test(a.src || ''), a);
  await f.ev(() => document.getElementById('w115btn').click());
  await f.page.waitForTimeout(300);
  await f.ev(() => { const b = document.querySelector('#w115menu [data-w115act="edit"]'); if (b) b.click(); });
  await f.page.waitForTimeout(500);
  const b = await f.ev(() => { const box = document.getElementById('modalBox'); return { sub: box ? (box.querySelector('.m-sub') || {}).textContent : null, rm: !!(box && box.querySelector('[data-w115rm]')) }; });
  ok('the editor says the Hub uses the Slack photo until you choose one', /Until you choose one, the Hub uses your Slack photo \(or your Google one\)\./.test(b.sub || ''), b);
  ok('the Slack photo can be removed', b.rm, b);
  await f.ev(() => document.querySelector('#modalBox [data-w115rm]').click());
  await f.page.waitForTimeout(200);
  const c = await f.ev(() => (document.getElementById('w115msg') || {}).textContent || '');
  ok('removing says it will not come back from Slack or Google', /will not fill one in from Slack or Google again/.test(c), c);
  await f.ev(() => document.getElementById('w115save').click());
  await f.page.waitForTimeout(700);
  const d = await f.ev(() => window.__UPD.filter(x => x.table === 'team_members').map(x => x.p));
  ok('saving stores no photo by choice (avatar_url is empty text, not null)', d.length === 1 && d[0].avatar_url === '', d);
  const e = await f.ev(() => { const btn = document.getElementById('w115btn'); return { img: !!(btn && btn.querySelector('img')), initials: btn ? btn.textContent.trim() : '' }; });
  ok('the bubble falls back to initials', !e.img && e.initials.length > 0, e);
  ok('no page errors', f.errs.length === 0, f.errs);
  await f.close();
  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw139drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
