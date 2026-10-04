/* w205shots.js (wave205): the screenshots for the wave's report, from the offline harness (fixture w205fixture.js).
   CAND=build/<file>.html OUT=<dir> node test/w205shots.js */
const { launch, fresh } = require('./boot');
const { build } = require('./w205fixture');
const OUT = process.env.OUT || '/mnt/user-data/outputs';
const fs = require('fs'); fs.mkdirSync(OUT, { recursive: true });
const INIT = `(function(){ var sb; Object.defineProperty(window, 'supabase', { configurable: true, get: function () { return sb; }, set: function (v) { sb = v; var cc = v && v.createClient; if (!cc || cc.__w) return;
  v.createClient = function () { var c = cc.apply(this, arguments); c.channel = function () { var ch = { h: [], on: function (t, f, cb) { ch.h.push({ t: t, f: f, cb: cb }); return ch; }, subscribe: function (cb) { setTimeout(function () { cb && cb('SUBSCRIBED'); }, 10); return ch; }, track: function () { return Promise.resolve('ok'); }, untrack: function () { return Promise.resolve('ok'); }, presenceState: function () { return window.__ps || {}; }, unsubscribe: function () { return Promise.resolve('ok'); } }; window.__ch = ch; return ch; }; c.removeChannel = function () { return Promise.resolve('ok'); }; return c; }; v.createClient.__w = true; } }); })();`;
const PRES = `window.__ps = { m17: [{ mid: 17, name: 'Ian', goal: '101', field: 'goal:101:detail', at: Date.now() }], m38: [{ mid: 38, name: 'Suhaib', goal: '101', field: null, at: Date.now() }], m3: [{ mid: 3, name: 'Shima', goal: '104', field: null, at: Date.now() }] }; window.__ch.h.forEach(function (x) { if (x.t === 'presence' && x.f.event === 'sync') x.cb({}); });`;
(async () => {
  const b = await launch();
  let f = await fresh(b, { who: 'admin', width: 1920, height: 1000, hash: '#orggoals', fixture: build(), init: INIT, wait: 4500 });
  await f.ev(PRES); await f.page.waitForTimeout(300); await f.ev(() => window.scrollTo(0, 0)); await f.page.waitForTimeout(300);
  await f.page.screenshot({ path: OUT + '/w205-1-goals-desktop.png' });
  /* goal 1 open, with who is here and the comments */
  await f.ev(() => { var c = document.getElementById('w205g-101'); window.scrollTo(0, c.getBoundingClientRect().top + window.scrollY - 70); });
  await f.page.waitForTimeout(300);
  await f.page.click('[data-w205k="goal:101:why"]'); await f.page.waitForTimeout(150);
  await f.ev(() => document.querySelector('[data-w205cmtsft="101"]').click()); await f.page.waitForTimeout(500);
  await f.page.screenshot({ path: OUT + '/w205-2-goal-presence-comments.png' });
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(300);
  await f.ev(() => document.querySelector('[data-w205hist="101"]').click()); await f.page.waitForTimeout(700);
  await f.page.screenshot({ path: OUT + '/w205-3-version-history.png' });
  await f.close();
  f = await fresh(b, { who: 'admin', width: 390, hash: '#orggoals', fixture: build(), init: INIT, wait: 4500 });
  await f.ev(PRES); await f.ev(() => { var c = document.getElementById('w205g-101'); window.scrollTo(0, c.getBoundingClientRect().top + window.scrollY - 66); }); await f.page.waitForTimeout(400);
  await f.page.screenshot({ path: OUT + '/w205-4-phone.png' });
  await f.close();
  await b.close();
  console.log('shots in', OUT);
})();
