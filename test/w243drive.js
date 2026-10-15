/* w243drive.js: wave243, the Learning Avenue "The Content Studio" in the Avenue Academy (academy_paths studio, trainings
   lesson:studio). Checks: the Avenue shows on the Academy page for a marketing member and an admin; the lesson opens in
   the wide sheet with its ten chapters; every chapter paints (cards, steps, stages, callouts, lists); the knowledge check
   answered right ends on the perfect score; the progress is saved; no page errors.
   Uses test/boot.js with the live rows copied into test/fx_w243.json. CAND=build/candidate.html node test/w243drive.js */
const path = require('path');
const fs = require('fs');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 600) : '')); } }
function fx() {
  const f = loadFixture(path.join(__dirname, 'fixture.json'));
  const add = JSON.parse(fs.readFileSync(path.join(__dirname, 'fx_w243.json'), 'utf8'));
  f.academy_paths = (f.academy_paths || []).filter(p => p.key !== 'studio').concat(add.academy_paths);
  f.trainings = (f.trainings || []).filter(t => t.key !== 'lesson:studio').concat(add.trainings);
  return f;
}
const INIT = `window.__W = []; (function(){ var _sb; Object.defineProperty(window, 'supabase', { configurable: true, get: function () { return _sb; }, set: function (v) { var cc = v.createClient; v.createClient = function () { var c = cc.apply(this, arguments); var of = c.from.bind(c); c.from = function (t) { var b = of(t); ['insert', 'update', 'upsert'].forEach(function (m) { var o = b[m]; b[m] = function (p) { window.__W.push([t, m, p === undefined ? null : JSON.parse(JSON.stringify(p))]); return o.call(b, p); }; }); return b; }; return c; }; _sb = v; } }); })();`;

(async () => {
  const browser = await launch();
  const cand = process.env.CAND || path.join(__dirname, '../build/candidate.html');
  try {
    for (const who of ['plain', 'admin']) {
      const f = await fresh(browser, { who, width: 1366, hash: '#training', fixture: fx(), rpcs: { loop_feed: [], loop_in_now: [], wa_org_editor: who === 'admin' }, candidate: cand, init: INIT, wait: 4000 });
      const p = f.page;
      await p.waitForTimeout(1200);
      const home = await f.ev(() => { const r = document.getElementById('w122'); return { root: !!r, text: r ? r.innerText.replace(/\s+/g, ' ') : '', has: !!(window.w122 && w122.A && w122.A.byKey && w122.A.byKey['lesson:studio']) }; });
      ok('[' + who + '] the Academy lists The Content Studio and knows the lesson', home.root && /The Content Studio/.test(home.text) && home.has, { root: home.root, has: home.has, sample: home.text.slice(0, 120) });
      const id = await f.ev(() => (w122.A.byKey['lesson:studio'] || {}).id);
      await f.hash('#training/t/' + id, 1500);
      const sh = await f.ev(() => { const s = document.querySelector('#w122sheet.on .sh'); return s ? { rail: s.querySelectorAll('.rail .ri').length, title: (s.querySelector('.cht') || {}).textContent, prose: (s.querySelector('.prose') || {}).innerText || '' } : null; });
      ok('[' + who + '] the lesson opens with its ten chapters and the knowledge check in the rail', !!sh && sh.rail >= 10 && /What the Content Studio is/.test(sh.title || ''), sh && { rail: sh.rail, title: sh.title });
      ok('[' + who + '] chapter 1 paints the six cards', !!sh && /Plan/.test(sh.prose) && /Measure/.test(sh.prose) && (await f.ev(() => document.querySelectorAll('#w122sheet .cards .c').length)) === 6, sh && sh.prose.slice(0, 160));
      /* every chapter paints without an error */
      const n = await f.ev(() => (w122.A.byKey['lesson:studio'].body.chapters || []).length);
      let bad = [];
      for (let i = 1; i < n; i++) {
        await p.click('#w122sheet [data-w122ch="' + i + '"]'); await p.waitForTimeout(250);
        const t = await f.ev(() => ({ title: (document.querySelector('#w122sheet .cht') || {}).textContent, len: ((document.querySelector('#w122sheet .prose') || {}).innerText || '').length }));
        if (!t.title || t.len < 120) bad.push(i + ':' + JSON.stringify(t));
      }
      ok('[' + who + '] chapters 2 to 10 paint (steps, stages, callouts, lists)', bad.length === 0, bad);
      const appr = await f.ev(() => { const s = document.querySelector('#w122sheet'); return s ? s.innerText.replace(/\s+/g, ' ') : ''; });
      /* the knowledge check */
      await p.click('#w122sheet [data-w122ch="' + n + '"]'); await p.waitForTimeout(300);
      const answers = await f.ev(() => w122.A.byKey['lesson:studio'].body.quiz.questions.map(q => q.c));
      ok('[' + who + '] seven questions', answers.length === 7, answers.length);
      for (let i = 0; i < answers.length; i++) {
        await p.click('#w122sheet [data-w122opt="' + answers[i] + '"]'); await p.waitForTimeout(120);
        await p.click('#w122sheet [data-w122qnext]'); await p.waitForTimeout(120);
      }
      const res = await f.ev(() => (document.querySelector('#w122sheet .quiz .res h3') || {}).textContent);
      ok('[' + who + '] every answer right: the perfect score screen', /Perfect/.test(res || ''), res);
      await p.click('#w122sheet [data-w122qfinish]').catch(() => {}); await p.waitForTimeout(900);
      const done = await f.ev(id => (window.__W || []).filter(w => w[0] === 'training_progress' && w[2] && w[2].training_id === id && w[2].status === 'done'), id);
      ok('[' + who + '] the lesson is saved done with score 100', done.length > 0 && done[done.length - 1][2].score === 100, done.length && done[done.length - 1][2]);
      ok('[' + who + '] the Studio page never says AI', !/\bAI\b/.test(appr), (appr.match(/.{30}\bAI\b.{30}/) || [])[0]);
      ok('[' + who + '] no page errors', f.errs.length === 0, f.errs);
      await f.close();
    }
  } catch (e) { fail++; out.push('FAIL (exception) ' + String(e && e.stack || e).slice(0, 800)); }
  console.log(out.join('\n'));
  console.log('w243drive: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
