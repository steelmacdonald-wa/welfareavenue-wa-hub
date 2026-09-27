/* w150drive.js: the Brand Guides and the hard brand knowledge check (wave150).
   The Our brand avenue is required for everyone and lists the guide, the lesson and the video in that order; the guide opens
   as a document with a Drive preview; the lesson draws colour swatches, logo and doodle pictures from Hub storage and the two
   typefaces; the knowledge check (quiz.hard) starts with an intro, shuffles every attempt, never reveals a wrong answer,
   fails at 11 of 15 with the pages to go back to, retries straight into a new order, passes at 12 with the missed answers,
   and records the score. An ordinary quiz still reveals the right answer. usage: node test/w150drive.js [--shots] */
const fs = require('fs');
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 500) : '')); } }
const SP = '/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/';
const SHOTS = process.argv.indexOf('--shots') >= 0;
const B = require('../build/data/wa150_brand.json');
const L = B.lesson, QS = L.quiz.questions;
const BY_Q = {}; QS.forEach(x => { BY_Q[x.q] = x; });

function fixture() {
  const fx = loadFixture();
  fx.academy_paths = (fx.academy_paths || []).map(p => p.key === 'branding' ? Object.assign({}, p, { required: true, dept: null, sort: 15, blurb: 'The Brand Guides, the essentials of our brand and a hard knowledge check: who we are, how we speak and how we look. For everyone.' }) : p)
    .concat([{ key: 'leading', name: 'Leading a team', title: 'Leading a team', blurb: 'Meetings.', dept: null, required: false, cert_title: 'Team Lead', color: '#6F64AB', icon: 'flag', sort: 35, active: true }]);
  fx.trainings = (fx.trainings || []).map(t => t.id === 32 ? Object.assign({}, t, { sort: 3 }) : t).concat([
    { id: 9101, key: 'doc:brand-guides', title: 'The Brand Guides (2026)', kind: 'doc', category: 'Welfare Avenue', path_group: 'Branding', description: B.guide_desc, resource_url: B.guide_url, source: 'hub', sort: 1, minutes: 25, xp: 30, active: true },
    { id: 9102, key: 'lesson:brand', title: 'Our brand: the essentials and the knowledge check', kind: 'lesson', category: 'Welfare Avenue', path_group: 'Branding', description: L.summary, source: 'hub', sort: 2, minutes: 20, xp: 75, active: true, body: L },
    { id: 9103, key: 'lesson:plain', title: 'A plain lesson', kind: 'lesson', category: 'Leadership', path_group: 'Leading a team', description: 'x', source: 'hub', sort: 1, minutes: 5, active: true,
      body: { v: 1, chapters: [{ id: 'a', t: 'One', blocks: [{ type: 'p', text: 'Hello.' }] }], quiz: { pass: 0.5, questions: [{ q: 'Two plus two?', a: ['Three', 'Four', 'Five'], c: 1, why: 'Arithmetic.' }, { q: 'One plus one?', a: ['Two', 'Three'], c: 0, why: 'Also arithmetic.' }] } } }
  ]);
  return fx;
}
const MOCK = `(function(){
  window.__UPS = [];
  var t = setInterval(function(){ if (typeof db === 'undefined' || !db || !db.from || db.from.__w) return;
    var of = db.from.bind(db);
    var f = function (table) { var b = of(table); var ou = b.upsert.bind(b); b.upsert = function (p, o) { window.__UPS.push({ table: table, p: JSON.parse(JSON.stringify(p)) }); return ou(p, o); }; return b; };
    f.__w = 1; db.from = f;
  }, 5); })();`;
const IMGDIR = SP + 'brandimg/';
async function routeImages(page) {
  await page.route('https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/brand/**', route => {
    const fp = IMGDIR + route.request().url().split('/').pop();
    if (fs.existsSync(fp)) return route.fulfill({ contentType: 'image/png', body: fs.readFileSync(fp) });
    return route.abort();
  });
}
const readQ = () => {
  const qz = document.querySelector('#w122sheet .quiz'); if (!qz) return { none: true };
  const ops = [...qz.querySelectorAll('.op')].map(o => ({ t: (o.querySelectorAll('span')[1] || {}).textContent, l: (o.querySelector('.l') || {}).textContent, cls: o.className, dis: o.disabled }));
  return { hard: qz.classList.contains('hard'), intro: !!qz.querySelector('.intro'), introText: (qz.querySelector('.intro') || {}).textContent || '', qn: (qz.querySelector('.qn') || {}).textContent || '', qq: (qz.querySelector('.qq') || {}).textContent || '', ops,
    right: qz.querySelectorAll('.op.right').length, wrong: qz.querySelectorAll('.op.wrong').length, why: (qz.querySelector('.why') || {}).textContent || '', miss: !!qz.querySelector('.why.miss'),
    res: (qz.querySelector('.res p') || {}).textContent || '', h3: (qz.querySelector('.res h3') || {}).textContent || '', go: [...qz.querySelectorAll('.res .go li')].map(x => x.textContent),
    review: [...qz.querySelectorAll('.review .rv')].map(x => x.textContent), finish: !!qz.querySelector('[data-w122qfinish]'), retry: !!qz.querySelector('[data-w122qretry]'), src: (qz.querySelector('[data-w122pitem]') || {}).textContent || '', start: !!qz.querySelector('[data-w122qstart]') };
};
async function answer(f, wantRight) {
  const s = await f.ev(readQ);
  const meta = BY_Q[s.qq];
  if (!meta) return { err: 'unknown question', s };
  const correct = meta.a[meta.c];
  const target = wantRight ? correct : s.ops.map(o => o.t).find(t => t !== correct);
  await f.ev(t => { const b = [...document.querySelectorAll('#w122sheet .quiz .op')].find(o => (o.querySelectorAll('span')[1] || {}).textContent === t); b.click(); }, target);
  await f.page.waitForTimeout(60);
  const after = await f.ev(readQ);
  await f.ev(() => { const n = document.querySelector('#w122sheet [data-w122qnext]'); if (n) n.click(); });
  await f.page.waitForTimeout(60);
  return { q: s.qq, meta, correct, picked: target, after, opsBefore: s.ops };
}

(async () => {
  const browser = await launch();
  /* ---- a member ---- */
  let f = await fresh(browser, { who: 'member', hash: '#training', fixture: fixture(), init: MOCK, wait: 5000 });
  await routeImages(f.page);
  await f.page.waitForTimeout(600);
  const a = await f.ev(() => {
    const card = [...document.querySelectorAll('.w122path')].find(x => (x.querySelector('h3') || {}).textContent === 'Our brand');
    return { card: !!card, chips: card ? [...card.querySelectorAll('.chip')].map(c => c.textContent) : [], mine: card ? !!card.closest('.w122paths') : false, blurb: card ? (card.querySelector('.pb2 p') || {}).textContent : '' };
  });
  ok('Our brand is among the member’s avenues, marked Required, 3 items', a.card && a.chips.indexOf('Required') >= 0 && a.chips.indexOf('3 items') >= 0, a);
  ok('the avenue carries the new blurb', /Brand Guides, the essentials of our brand and a hard knowledge check/.test(a.blurb), a);
  await f.hash('#training/p/branding', 900);
  const b = await f.ev(() => [...document.querySelectorAll('#w122sheet .pitems .pitem b')].map(x => x.textContent));
  ok('the avenue lists the guide, the lesson, then the video', b.length === 3 && b[0] === 'The Brand Guides (2026)' && /^Our brand: the essentials/.test(b[1]) && b[2] === 'Brand Refresh Video', b);

  /* the guide */
  await f.hash('#training/t/9101', 900);
  const c = await f.ev(() => { const sh = document.querySelector('#w122sheet .sh'); const open = [...sh.querySelectorAll('a.w122btn')].find(x => /Open the document/.test(x.textContent)); return { open: open ? open.getAttribute('href') : null, prev: !!sh.querySelector('[data-w122preview]'), li: sh.querySelectorAll('.prose li').length, done: /Done when/.test(sh.textContent), assets: !!sh.querySelector('.prose a[href*="1HqAE-FHO2HRPvzpjhz8aGJpZLAbjIH8y"]') }; });
  ok('the guide opens as a document: Drive link, Preview here, the reading guide and Done when', c.open === B.guide_url && c.prev && c.li === 8 && c.done && c.assets, c);
  await f.ev(() => document.querySelector('#w122sheet [data-w122preview]').click());
  await f.page.waitForTimeout(300);
  const d = await f.ev(() => (document.querySelector('#w122sheet .pvw iframe') || {}).src || null);
  ok('Preview here embeds the Drive preview of the PDF', d === 'https://drive.google.com/file/d/1gsd-eXAFfzJeblbMiIUJ0a2YoPeOkPay/preview', d);

  /* the lesson: chapter one and How we look */
  await f.hash('#training/t/9102', 900);
  const e = await f.ev(() => { const sh = document.querySelector('#w122sheet .sh'); return { chs: [...sh.querySelectorAll('.rail .ri')].map(x => x.textContent), callout: (sh.querySelector('.callout.warn') || {}).textContent || '' }; });
  ok('the lesson has 8 chapters and the knowledge check', e.chs.length === 9 && /Knowledge check/.test(e.chs[8]), e.chs);
  ok('chapter one explains the knowledge check (15, 5 from the guide, 12 to pass)', /15 questions/.test(e.callout) && /5 on details that are only in the Brand Guides/.test(e.callout) && /12 right to pass/.test(e.callout), e.callout);
  await f.ev(() => document.querySelector('#w122sheet [data-w122ch="5"]').click());
  await f.page.waitForTimeout(900);
  const g = await f.ev(() => {
    const sh = document.querySelector('#w122sheet .sh');
    const sw = [...sh.querySelectorAll('.w150sw .sw')].map(x => ({ n: x.querySelector('b').textContent, bg: getComputedStyle(x).backgroundColor, fg: getComputedStyle(x).color }));
    const figs = [...sh.querySelectorAll('.w150fig img')].map(i => ({ src: i.getAttribute('src'), w: i.naturalWidth }));
    const ty = [...sh.querySelectorAll('.w150ty .ty .sm')].map(x => getComputedStyle(x).fontFamily);
    return { title: (sh.querySelector('.cht') || {}).textContent, sw, figs, ty };
  });
  ok('How we look shows five named swatches in the brand colours', g.sw.length === 5 && g.sw.map(x => x.n).join(',') === 'Dignity,Community,Ground,Possibility,Action' && g.sw[1].bg === 'rgb(16, 63, 57)' && g.sw[4].bg === 'rgb(220, 165, 39)', g.sw);
  ok('light swatches take green text, dark ones cream', g.sw[0].fg === 'rgb(16, 63, 57)' && g.sw[1].fg === 'rgb(255, 250, 242)', g.sw.map(x => x.fg));
  ok('the three logos load from Hub storage', g.figs.length === 3 && g.figs.every(x => /content-images\/brand\/logo-/.test(x.src) && x.w > 0), g.figs);
  ok('the typefaces are drawn in Barlow Condensed and Space Grotesk', g.ty.length === 2 && /Barlow Condensed/.test(g.ty[0]) && /Space Grotesk/.test(g.ty[1]), g.ty);
  if (SHOTS) await f.page.screenshot({ path: SP + 'w150_look.png' });
  await f.ev(() => document.querySelector('#w122sheet [data-w122ch="6"]').click());
  await f.page.waitForTimeout(700);
  const h = await f.ev(() => { const sh = document.querySelector('#w122sheet .sh'); return { figs: sh.querySelectorAll('.w150fig figure').length, steps: sh.querySelectorAll('.steps .s').length }; });
  ok('Doodles and the E that moves: four doodles, the E, three steps', h.figs === 5 && h.steps === 3, h);
  if (SHOTS) await f.page.screenshot({ path: SP + 'w150_extras.png' });

  /* the knowledge check */
  await f.ev(() => document.querySelector('#w122sheet [data-w122ch="8"]').click());
  await f.page.waitForTimeout(500);
  const i1 = await f.ev(readQ);
  ok('the check opens on an intro: 15 questions, 12 to pass, answers only after passing', i1.hard && i1.intro && i1.start && /15 questions/.test(i1.introText) && /You need 12 right to pass/.test(i1.introText) && /once you pass/.test(i1.introText), i1);
  ok('the intro offers the guide', /Open The Brand Guides \(2026\)/.test(i1.src), i1.src);
  if (SHOTS) await f.page.screenshot({ path: SP + 'w150_intro.png' });
  await f.ev(() => document.querySelector('#w122sheet [data-w122qstart]').click());
  await f.page.waitForTimeout(300);
  /* attempt 1: wrong, then eleven right, then three wrong: 11 of 15 */
  const plan1 = [false].concat(Array(11).fill(true), Array(3).fill(false));
  const r1 = [];
  for (let k = 0; k < 15; k++) { r1.push(await answer(f, plan1[k])); }
  ok('every question on screen is one of the fifteen', r1.every(x => x.meta), r1.filter(x => !x.meta).map(x => x.q));
  ok('attempt one asked all fifteen once', new Set(r1.map(x => x.q)).size === 15, r1.map(x => x.q));
  const w = r1[0].after;
  ok('a wrong pick is marked, the right answer is not revealed', w.wrong === 1 && w.right === 0 && w.miss, w);
  ok('a wrong pick names the page to check and hides the answer', w.why.indexOf('Check ' + r1[0].meta.hint) >= 0 && w.why.indexOf(r1[0].correct) < 0 && /shown once you pass/.test(w.why), w.why);
  const rt = r1[1].after;
  ok('a right pick is marked and explained', rt.right === 1 && rt.wrong === 0 && rt.why.indexOf('Right. ' + r1[1].meta.why) === 0, rt);
  const letters = r1.map(x => x.opsBefore.map(o => o.t).indexOf(x.correct));
  ok('answers are shuffled (the right one is not always A)', new Set(letters).size > 1, letters);
  const f1 = await f.ev(readQ);
  ok('11 of 15 fails: score, the 12 needed, the pages to go back to, no answers', /Almost there/.test(f1.h3) && /11 of 15 right\. You need 12 to pass\./.test(f1.res) && f1.go.length >= 1 && f1.review.length === 0 && f1.retry && !f1.finish, f1);
  const missedHints = [...new Set(r1.filter((x, k) => !plan1[k]).map(x => x.meta.hint))];
  ok('the pages listed are exactly those of the missed questions', f1.go.length === missedHints.length && missedHints.every(hh => f1.go.indexOf(hh) >= 0), { go: f1.go, missedHints });
  if (SHOTS) await f.page.screenshot({ path: SP + 'w150_fail.png' });
  await f.ev(() => document.querySelector('#w122sheet [data-w122qretry]').click());
  await f.page.waitForTimeout(300);
  const i2 = await f.ev(readQ);
  ok('Try again goes straight to question 1, no intro', !i2.intro && /Question 1 of 15/.test(i2.qn), i2);
  /* attempt 2: twelve right, three wrong */
  const plan2 = Array(12).fill(true).concat(Array(3).fill(false));
  const r2 = [];
  for (let k = 0; k < 15; k++) { r2.push(await answer(f, plan2[k])); }
  ok('the new attempt comes in a new order', r2.map(x => x.q).join('|') !== r1.map(x => x.q).join('|'));
  const p2 = await f.ev(readQ);
  ok('12 of 15 passes, with Complete the lesson', /You passed/.test(p2.h3) && /12 of 15 right\./.test(p2.res) && p2.finish, p2);
  const missed2 = r2.filter((x, k) => !plan2[k]);
  ok('after passing, the three missed questions show their answers and why', p2.review.length === 3 && missed2.every(x => p2.review.some(t => t.indexOf(x.q) >= 0 && t.indexOf(x.correct) >= 0 && t.indexOf(x.meta.why) >= 0)), p2.review);
  if (SHOTS) await f.page.screenshot({ path: SP + 'w150_pass.png' });
  await f.ev(() => { window.__UPS.length = 0; document.querySelector('#w122sheet [data-w122qfinish]').click(); });
  await f.page.waitForTimeout(1200);
  const up = await f.ev(() => window.__UPS.filter(x => x.table === 'training_progress').map(x => x.p));
  const last = up.filter(p => p.training_id === 9102).pop() || {};
  ok('completing records done with the score of 80 and two tries', last.status === 'done' && last.score === 80 && last.data && last.data.quizTries === 2, last);
  /* the classic view cannot mark a hard-check lesson done; ordinary items still can be */
  const cv = await f.ev(async () => { try { await wa36Load(true); } catch (x) { /* fine */ } window.__UPS.length = 0; await wa36SetMine(9102, true); const a1 = window.__UPS.filter(x => x.table === 'training_progress').length; window.__UPS.length = 0; await wa36SetMine(9101, true); const a2 = window.__UPS.filter(x => x.table === 'training_progress').length; return { a1, a2 }; });
  ok('the classic view cannot mark the brand lesson done, and still marks the guide done', cv.a1 === 0 && cv.a2 === 1, cv);
  ok('no page errors (member)', f.errs.length === 0, f.errs);

  /* an ordinary quiz still reveals the right answer */
  await f.hash('#training/t/9103', 900);
  await f.ev(() => document.querySelector('#w122sheet [data-w122ch="1"]').click());
  await f.page.waitForTimeout(300);
  const n0 = await f.ev(readQ);
  ok('an ordinary quiz starts at once, without the intro', !n0.hard && !n0.intro && n0.qq === 'Two plus two?', n0);
  await f.ev(() => [...document.querySelectorAll('#w122sheet .quiz .op')].find(o => /Three/.test(o.textContent)).click());
  await f.page.waitForTimeout(200);
  const n1 = await f.ev(readQ);
  ok('an ordinary quiz still reveals the right answer on a wrong pick', n1.right === 1 && n1.wrong === 1 && /Not quite\. Arithmetic\./.test(n1.why), n1);
  await f.close();

  /* ---- phone ---- */
  f = await fresh(browser, { who: 'member', hash: '#training/t/9102', fixture: fixture(), init: MOCK, wait: 5000, width: 390 });
  await routeImages(f.page);
  await f.ev(() => { const b = document.querySelector('#w122sheet [data-w122ch="5"]'); if (b) b.click(); });
  await f.page.waitForTimeout(900);
  const m = await f.ev(() => { const main = document.querySelector('#w122sheet .main'); const sw = document.querySelector('#w122sheet .w150sw'); return { over: main ? main.scrollWidth - main.clientWidth : -1, cols: sw ? getComputedStyle(sw).gridTemplateColumns.split(' ').length : 0 }; });
  ok('on a phone the swatches sit two across and nothing scrolls sideways', m.cols === 2 && m.over <= 1, m);
  if (SHOTS) await f.page.screenshot({ path: SP + 'w150_phone.png', fullPage: false });
  ok('no page errors (phone)', f.errs.length === 0, f.errs);
  await f.close();

  /* ---- the board ---- */
  f = await fresh(browser, { who: 'board', hash: '#training', fixture: fixture(), init: MOCK, wait: 5000 });
  const bd = await f.ev(() => ({ cards: document.querySelectorAll('.w122path').length, msg: ((document.querySelector('#w122') || {}).textContent || '').indexOf('available to staff accounts') >= 0 }));
  ok('a board viewer account has no Academy, so nothing is required of it', bd.cards === 0 && bd.msg, bd);
  ok('no page errors (board)', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw150drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
