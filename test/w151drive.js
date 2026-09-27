/* w151drive.js: wave151, the news banner at the top of Home (moved from the loading screen).
   Under the greeting and above the counts; the day's news with admins' updates first; Hub links, web links in a new tab and
   nothing else as a link; a seamless loop hidden from screen readers after the first copy; hover, focus and the pause button
   stop it (the pause is remembered); reduced motion shows one item at a time; no news, no banner; a re-render keeps one
   banner; a board viewer gets none; the Home tour has a stop; a phone does not scroll sideways. usage: node test/w151drive.js [--shots] */
const { launch, fresh } = require('./boot');
const SP = '/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/';
const SHOTS = process.argv.indexOf('--shots') >= 0;
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 600) : '')); } }
const NEWS = { week: '2026-09-21', day: '2026-09-25', lines: [], news: [
  { t: 'Holiday drive sign-ups open on 1 November', link: '#fundevents' },
  { t: 'Next serving: Sunday 4 October in Montreal, 7 volunteers signed up', link: null },
  { t: 'Read the new volunteer handbook', link: 'https://example.org/handbook' },
  { t: 'A line with a link that is not allowed', link: 'javascript:alert(1)' }] };
const RM = "(function(){ var _mm = window.matchMedia; window.matchMedia = function (q) { if (/prefers-reduced-motion/.test(q)) return { matches: true, media: q, addListener: function(){}, removeListener: function(){}, addEventListener: function(){}, removeEventListener: function(){} }; return _mm.call(window, q); }; })();";
const read = () => {
  const bar = document.getElementById('w151news');
  if (!bar) return null;
  const run = bar.querySelector('.run');
  const first = [...run.children].filter(x => x.classList.contains('it'));
  const copies = [...run.querySelectorAll('.cp')];
  return { prev: bar.previousElementSibling ? bar.previousElementSibling.className : null, next: bar.nextElementSibling ? bar.nextElementSibling.className : null,
    role: bar.getAttribute('role'), aria: bar.getAttribute('aria-label'), label: (bar.querySelector('.lb') || {}).textContent, cls: bar.className,
    items: first.map(x => ({ tag: x.tagName, t: (x.querySelector('span') || {}).textContent, href: x.getAttribute('href'), target: x.getAttribute('target'), rel: x.getAttribute('rel') })),
    copies: copies.length, copyHidden: copies.every(c => c.getAttribute('aria-hidden') === 'true'), copyTab: [...run.querySelectorAll('.cp a')].every(a => a.getAttribute('tabindex') === '-1'),
    total: run.querySelectorAll('.it').length, go: run.classList.contains('go'), dur: run.style.animationDuration, play: getComputedStyle(run).animationPlayState,
    btn: (bar.querySelector('[data-w151pause]') || {}).getAttribute ? bar.querySelector('[data-w151pause]').getAttribute('aria-label') : null, on: [...bar.querySelectorAll('.run > .it.on')].map(x => x.textContent),
    count: document.querySelectorAll('#w151news').length };
};

(async () => {
  const browser = await launch();
  /* ---- an admin lands on Home ---- */
  let f = await fresh(browser, { who: 'admin', hash: '#mypage', rpcs: { wa_org_editor: true, hub_reel_current: NEWS }, wait: 5000 });
  await f.page.waitForTimeout(800);
  let b = await f.ev(read);
  ok('the banner sits on Home under the greeting and above the counts', b && /mp-head/.test(b.prev || '') && /mp-chips/.test(b.next || ''), b && [b.prev, b.next]);
  ok('it is a region called News with the gold News label', b && b.role === 'region' && b.aria === 'News' && b.label === 'News', b);
  ok('the day’s news in order, admins’ updates first', b && b.items.map(x => x.t).join('|') === NEWS.news.map(x => x.t).join('|'), b && b.items);
  ok('a Hub link opens the page', b && b.items[0].tag === 'A' && b.items[0].href === '#fundevents' && !b.items[0].target, b && b.items[0]);
  ok('a web link opens in a new tab', b && b.items[2].tag === 'A' && b.items[2].href === 'https://example.org/handbook' && b.items[2].target === '_blank' && b.items[2].rel === 'noopener', b && b.items[2]);
  ok('an item without a link, or with a link that is not allowed, is plain text', b && b.items[1].tag === 'SPAN' && b.items[3].tag === 'SPAN' && b.items[3].href === null, b && [b.items[1], b.items[3]]);
  ok('it scrolls as a seamless loop (whole copies, a duration)', b && b.go && /s$/.test(b.dur || '') && b.copies >= 1 && b.total % 4 === 0 && (b.copies + 1) % 2 === 0, b);
  ok('the copies are hidden from screen readers and the keyboard', b && b.copyHidden && b.copyTab, b);
  if (SHOTS) await f.page.screenshot({ path: SP + 'w151_home_news.png' });
  /* hover pauses */
  await f.page.hover('#w151news .trk');
  await f.page.waitForTimeout(150);
  b = await f.ev(read);
  ok('hovering pauses it', b && b.play === 'paused', b && b.play);
  await f.page.mouse.move(5, 5);
  await f.page.waitForTimeout(150);
  b = await f.ev(read);
  ok('and it runs again after', b && b.play === 'running', b && b.play);
  /* the pause button */
  await f.ev(() => document.querySelector('#w151news [data-w151pause]').click());
  await f.page.waitForTimeout(150);
  b = await f.ev(read);
  const ls = await f.ev(() => localStorage.getItem('w151paused'));
  ok('the pause button stops it and says Play, remembered in this browser', b && /paused/.test(b.cls) && b.play === 'paused' && b.btn === 'Play the news' && ls === '1', [b && b.cls, b && b.play, b && b.btn, ls]);
  await f.ev(() => renderMyPage());
  await f.page.waitForTimeout(1200);
  b = await f.ev(read);
  ok('after Home redraws there is still one banner, still paused', b && b.count === 1 && /paused/.test(b.cls) && /mp-head/.test(b.prev || ''), b && [b.count, b.cls, b.prev]);
  await f.ev(() => document.querySelector('#w151news [data-w151pause]').click());
  await f.page.waitForTimeout(150);
  b = await f.ev(read);
  ok('pressing it again plays it', b && !/paused/.test(b.cls) && b.play === 'running' && b.btn === 'Pause the news', b && [b.cls, b.play, b.btn]);
  /* keyboard focus brings the item into view and holds it */
  const kf = await f.ev(() => { const a = document.querySelector('#w151news .run > a.it'); a.focus(); const run = document.querySelector('#w151news .run'); return { anim: run.style.animationName, tr: run.style.transform, active: document.activeElement === a }; });
  ok('a focused item stops the scroll and comes into view', kf.active && kf.anim === 'none' && /translateX\(/.test(kf.tr), kf);
  const kb = await f.ev(async () => { document.activeElement.blur(); await new Promise(r => setTimeout(r, 30)); const run = document.querySelector('#w151news .run'); return { anim: run.style.animation, tr: run.style.transform }; });
  ok('leaving it lets it scroll again', kb.anim === '' && kb.tr === '', kb);
  /* the link works */
  await f.ev(() => { const run = document.querySelector('#w151news .run'); run.classList.remove('go'); document.querySelector('#w151news .run > a.it').click(); });
  await f.page.waitForTimeout(900);
  const h = await f.ev(() => location.hash);
  ok('clicking a Hub link goes there', h === '#fundevents', h);
  /* the Home tour */
  const tour = await f.ev(() => { const s = (window.w122 && w122.tours && w122.tours.home && w122.tours.home.steps) || []; return s.map(x => x.s || x.sel || '').slice(0, 3); });
  ok('the Home tour stops at the news right after the greeting', tour[1] === '#w151news', tour);
  ok('no page errors (admin)', f.errs.length === 0, f.errs);
  await f.close();

  /* ---- reduced motion: one at a time ---- */
  f = await fresh(browser, { who: 'member', hash: '#mypage', rpcs: { hub_reel_current: NEWS }, init: RM, wait: 5000 });
  await f.page.waitForTimeout(600);
  b = await f.ev(read);
  ok('with reduced motion it shows one item at a time, without scrolling', b && /\bone\b/.test(b.cls) && !b.go && b.copies === 0 && b.on.length === 1, b);
  const first = b && b.on[0];
  await f.page.waitForTimeout(5400);
  b = await f.ev(read);
  ok('and moves to the next one after a few seconds', b && b.on.length === 1 && b.on[0] !== first, [first, b && b.on]);
  ok('no page errors (reduced motion)', f.errs.length === 0, f.errs);
  await f.close();

  /* ---- no news: no banner ---- */
  f = await fresh(browser, { who: 'member', hash: '#mypage', rpcs: { hub_reel_current: { week: null, day: '2026-09-25', lines: [], news: [] } }, wait: 5000 });
  await f.page.waitForTimeout(600);
  b = await f.ev(read);
  ok('with no news there is no banner', b === null, b);
  await f.close();

  /* ---- a board viewer: no Home, no banner ---- */
  f = await fresh(browser, { who: 'board', hash: '#mypage', rpcs: { hub_reel_current: NEWS }, wait: 5000 });
  await f.page.waitForTimeout(600);
  b = await f.ev(read);
  ok('a board viewer gets no banner', b === null, b);
  ok('no page errors (board)', f.errs.length === 0, f.errs);
  await f.close();

  /* ---- a phone ---- */
  f = await fresh(browser, { who: 'member', hash: '#mypage', rpcs: { hub_reel_current: NEWS }, wait: 5000, width: 390 });
  await f.page.waitForTimeout(800);
  const m = await f.ev(() => { const bar = document.getElementById('w151news'); const r = bar && bar.getBoundingClientRect(); return { has: !!bar, w: r ? Math.round(r.width) : 0, h: r ? Math.round(r.height) : 0, over: document.documentElement.scrollWidth - window.innerWidth }; });
  ok('on a phone it fits the width and the page does not scroll sideways', m.has && m.w <= 390 && m.h <= 44 && m.over <= 1, m);
  if (SHOTS) await f.page.screenshot({ path: SP + 'w151_phone_news.png' });
  ok('no page errors (phone)', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw151drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
