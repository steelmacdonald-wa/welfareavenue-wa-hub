/* w147drive.js: Google Search in Analytics (wave147), with made-up Search Console numbers (the property is not shared with
   the Hub yet). usage: node test/w147drive.js */
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 600) : '')); } }
const SITE = 'sc-domain:welfareavenue.com';
function data() {
  const daily = [];
  const end = new Date('2026-09-22T12:00:00Z');
  for (let i = 55; i >= 0; i--) { const d = new Date(end.getTime() - i * 86400000).toISOString().slice(0, 10); const recent = i < 28; daily.push({ site_url: SITE, day: d, clicks: recent ? 12 : 10, impressions: recent ? 400 : 380, ctr: recent ? 0.03 : 0.026, position: recent ? 8 : 9 }); }
  const q = ['welfare avenue', 'welfare avenue montreal', 'free meals montreal', 'volunteer montreal food', 'soup kitchen montreal', 'food bank toronto', 'charity meals sunday', 'welfareavenue', 'donate food montreal', 'volunteer toronto', 'extra query'];
  const top = q.map((k, i) => ({ site_url: SITE, kind: 'query', key: k, period_start: '2026-08-26', period_end: '2026-09-22', clicks: 60 - i * 5, impressions: 900 - i * 50, ctr: 0.05, position: 3 + i }))
    .concat(['https://welfareavenue.com/', 'https://welfareavenue.com/volunteer', 'https://www.welfareavenue.com/donate'].map((k, i) => ({ site_url: SITE, kind: 'page', key: k, period_start: '2026-08-26', period_end: '2026-09-22', clicks: 200 - i * 50, impressions: 5000, ctr: 0.04, position: 5 })));
  return { sites: [{ site_url: SITE, via: 'sa', permission: 'siteRestrictedUser', connected_at: '2026-09-24T10:00:00Z', last_sync_at: '2026-09-25T10:00:00Z', last_error: null, first_day: daily[0].day, last_day: '2026-09-22' }], daily, top };
}
function fixture(connected) {
  const fx = loadFixture(); const d = data();
  fx.search_sites = connected ? d.sites : []; fx.search_daily = connected ? d.daily : []; fx.search_top = connected ? d.top : [];
  return fx;
}
const MOCK = `(function(){ window.__INV = [];
  var t = setInterval(function(){ if (typeof db === 'undefined' || !db || !db.functions || db.functions.__w147) return;
    var prev = db.functions.invoke;
    db.functions.invoke = function (name, opts) { window.__INV.push({ name: name, body: opts && opts.body });
      if (name === 'search-console') return Promise.resolve({ data: { ok: true, sa_email: 'wa-hub-drive@example.iam.gserviceaccount.com', visible: {}, connected: [] }, error: null });
      return prev ? prev.apply(this, arguments) : Promise.resolve({ data: null, error: null }); };
    db.functions.__w147 = 1; }, 5); })();`;
const card = f => f.ev(() => { const el = document.getElementById('w147'), tiles = document.querySelector('#socialstats .w120tiles'); if (!el) return null;
  return { after: !!tiles && tiles.nextElementSibling === el, tiles: [...el.querySelectorAll('.t')].map(t => t.textContent), spark: !!el.querySelector('svg.sp polyline'), q: el.querySelectorAll('.cols > div:first-child tr').length, pages: [...el.querySelectorAll('.cols > div:last-child td.k')].map(td => td.textContent), text: el.textContent }; });

(async () => {
  const browser = await launch();
  let f = await fresh(browser, { who: 'admin', hash: '#socialstats', fixture: fixture(true), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(1800);
  let c = await card(f);
  ok('Google Search sits under the platform tiles', c && c.after, c);
  ok('clicks, appearances, click-through and position', c && c.tiles.length === 4 && /^336\+20%clicks from Google/.test(c.tiles[0]) && /^11\.2k\+5%/.test(c.tiles[1]) && /^#8\.0/.test(c.tiles[3]), c && c.tiles);
  ok('the clicks day by day', c && c.spark, c && c.spark);
  ok('the top ten searches and the pages, paths shortened', c && c.q === 10 && c.pages.join('|') === '/|/volunteer|/donate', c && [c.q, c.pages]);
  ok('what the window is', c && /The last 28 days of data, Aug 26 to Sep 22, against the 28 days before/.test(c.text), c && c.text.slice(-260));
  const tour = await f.ev(() => { const T = window.w122 && w122.tours; if (!T) return null; for (const k in T) { const s = (T[k].steps || []).map(x => x.s); const i = s.indexOf('#w147'); if (i > 0) return s[i - 1]; } return null; });
  ok('the Analytics tour has a step after the tiles', tour === '#socialstats .w120tiles', tour);
  ok('no page errors (admin, connected)', f.errs.length === 0, f.errs);
  await f.close();

  f = await fresh(browser, { who: 'admin', hash: '#socialstats', fixture: fixture(false), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(4800);
  c = await card(f);
  ok('before it is connected, staff see the one step', c && /Not connected yet/.test(c.text) && /wa-hub-drive@example\.iam\.gserviceaccount\.com/.test(c.text) && /Users and permissions/.test(c.text), c && c.text);
  ok('no page errors (admin, not connected)', f.errs.length === 0, f.errs);
  await f.close();

  f = await fresh(browser, { who: 'board', hash: '#socialstats', fixture: fixture(false), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(1800);
  const b1 = await f.ev(() => !!document.getElementById('w147'));
  ok('a director sees nothing until it is connected', b1 === false, b1);
  await f.close();
  f = await fresh(browser, { who: 'board', hash: '#socialstats', fixture: fixture(true), init: MOCK, wait: 5000 });
  await f.page.waitForTimeout(1800);
  c = await card(f);
  ok('a director sees Google Search once it is connected', c && c.tiles.length === 4, c);
  ok('no page errors (director)', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw147drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
