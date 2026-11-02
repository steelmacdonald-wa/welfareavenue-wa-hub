/* w271page.js: the no-login /o/<token> page (build/o/index.html), wave271 Task 4, offline.
   The onboard-link function is stubbed with page.route (no call reaches any real function); the page, the brand fonts and nothing else
   are served from disk. Run: cd test && node w271page.js        Screenshots: test/shots_w271page/ (git-ignored), or SHOTS=<dir>.
   Covered: opening makes one GET and no POST (also with ?a=accept, which only pre-focuses a button); Accept posts once under a
   double click and then shows the grid; drag selects cells on a desktop and a tap toggles on a phone (390 px), and Save posts exactly
   those instants; the days either side of the clock change (31/10/26, 02/11/26) both read 8 am to 9 pm and an 8 am cell posts 12:00Z
   then 13:00Z (the browser runs in Pacific/Auckland, so only Intl with America/Toronto can give the right labels); French (?l=fr and
   the function's lang); a closed link says to contact HR; a saved grid reloads with its cells marked; the manager's grid; the password
   stub; decline; errors; no sideways scroll at 390 px; no "AI" and no em dash on the page.
   wave271d (section 13): the hire's minimum hours, "N of M hours marked", Save disabled below it with the plain sentence, in both languages; none for the manager. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PAGE_FILE = path.join(__dirname, '..', 'build', 'o', 'index.html');
const PAGE = fs.existsSync(PAGE_FILE) ? fs.readFileSync(PAGE_FILE, 'utf8') : '<!doctype html><title>missing</title><p>build/o/index.html is missing</p>';
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots_w271page');
fs.mkdirSync(SHOTS, { recursive: true });
const FN = 'https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/onboard-link';
const TOK = '12.ABCDEFGHIJKLMNOPQRST';
const HOME = 'https://hub.welfareavenue.com/o/' + TOK;
const NOW = '2026-10-28T09:00:00-04:00';
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 500) : '')); } }

/* ---------- the stub function ---------- */
/* Fixture only: the instant of a Toronto wall clock. Toronto is UTC-4 until the night of 01/11/26 and UTC-5 after it. The page must
   never do this; it formats the instants it is given with Intl. */
const utc = (date, minutes) => { const [y, m, d] = date.split('-').map(Number); return Date.UTC(y, m - 1, d, 0, minutes) + (date < '2026-11-01' ? 4 : 5) * 3600000; };
const stamp = ms => new Date(ms).toISOString().replace('.000Z', 'Z');
function gridWindow(minHours) {   // what the function sends: the next 14 days from 28/10/26, 8 am to 9 pm, 30-minute cells, started cells left out, and the hire's minimum in hours
  const out = { start: 8, end: 21, cellMin: 30, minHours: minHours || 0, days: [], slots: [] };
  const now = Date.parse(NOW);
  for (let i = 0; i < 14; i++) {
    const date = new Date(Date.UTC(2026, 9, 28 + i)).toISOString().slice(0, 10);
    const cells = [];
    for (let min = 8 * 60; min + 30 <= 21 * 60; min += 30) { const at = utc(date, min); if (at > now) cells.push(stamp(at)); }
    if (!cells.length) continue;
    out.days.push({ date, open: cells[0], close: stamp(utc(date, 21 * 60)) });
    out.slots.push(...cells);
  }
  return out;
}
const MSG = {
  closed: { en: 'This link is no longer active. Please contact HR.', fr: "Ce lien n'est plus actif. Veuillez communiquer avec les RH." },
  bad_link: { en: 'This link does not work. Please contact HR.', fr: 'Ce lien ne fonctionne pas. Veuillez communiquer avec les RH.' },
  not_accepted: { en: 'The offer has not been accepted yet. Please accept it first, or contact HR.', fr: "L'offre n'a pas encore été acceptée. Veuillez d'abord l'accepter, ou communiquer avec les RH." },
  save: { en: 'We could not save that. Please try again, or contact HR.', fr: "Nous n'avons pas pu enregistrer. Veuillez réessayer, ou communiquer avec les RH." }
};
function makeFn(over) {
  const S = Object.assign({ kind: 'offer', first: 'Amina', role: 'Event Coordinator', lang: 'en', answered: '', closed: false, booked: false, late: false, hire: undefined, slotsSaved: [], acceptDelay: 250, postGrid: null, bad: false, callBooked: false, getFail: null, minHours: 0 }, over || {});   // minHours 0: the older sections are about the grid itself; section 13 sets the real 10
  const calls = [];
  const handler = async route => {
    const req = route.request();
    const cors = { 'Access-Control-Allow-Origin': 'https://hub.welfareavenue.com', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
    const send = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors, body: '' });
    const call = { method: req.method(), url: req.url(), body: req.postData() ? JSON.parse(req.postData()) : null };
    calls.push(call);
    if (S.bad) return send(404, { ok: false, error: 'bad_link', message: MSG.bad_link });
    if (req.method() === 'GET') {
      if (S.getFail === 'abort') return route.abort();
      if (S.getFail === '503') return send(503, { ok: false, error: 'unavailable', message: { en: 'We could not reach the server.', fr: 'Nous n\'avons pas pu joindre le serveur.' } });
      const closed = S.closed;
      return send(200, Object.assign({ ok: true, kind: S.kind, first: S.first, role: S.role, lang: S.lang, answered: S.answered, closed, late: S.late, booked: S.booked, callBooked: S.callBooked, grid: S.kind === 'password' ? null : gridWindow(S.minHours), slotsSaved: S.slotsSaved }, S.hire !== undefined ? { hire: S.hire } : {}, closed ? { message: MSG.closed } : {}));
    }
    const b = call.body || {};
    if (b.a === 'accept' || b.a === 'decline') {
      await new Promise(r => setTimeout(r, S.acceptDelay));
      const repeated = !!S.answered;
      if (!S.answered) S.answered = b.a;
      return send(200, { ok: true, first: S.first, role: S.role, lang: S.lang, answer: S.answered, answered: S.answered, repeated, late: S.late });
    }
    if (b.a === 'grid') {
      if (S.postGrid) return send(S.postGrid.status, S.postGrid.body);
      if (S.answered !== 'accept' && S.kind === 'offer') return send(409, { ok: false, error: 'not_accepted', message: MSG.not_accepted });
      S.slotsSaved = (b.slots || []).slice().sort();
      return send(200, { ok: true, saved: S.slotsSaved.length, dropped: 0, slotsSaved: S.slotsSaved, closed: false });
    }
    return send(400, { ok: false });
  };
  return { S, calls, handler };
}

async function launch() {
  /* Playwright's own Chromium when it is installed (the Linux box), else the PC's Chrome or Edge. --disable-gpu: on this PC a headless
     Chrome with the GPU on hangs every screenshot. */
  const args = ['--disable-gpu'];
  const tries = [{ args }, { channel: 'chrome', args }, { channel: 'msedge', args }];
  let last;
  for (const t of tries) { try { return await chromium.launch(t); } catch (e) { last = e; } }
  throw last;
}
const FIXED = `(function(){ var FIXED = new Date(${JSON.stringify(NOW)}).getTime(); var RealDate = Date; function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } } FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate; })();`;
/* opts: width, phone, qs, fn (makeFn result), token */
async function open(browser, opts) {
  opts = opts || {};
  const phone = !!opts.phone;
  const ctx = await browser.newContext({ viewport: { width: opts.width || (phone ? 390 : 1366), height: phone ? 844 : 900 }, isMobile: phone, hasTouch: phone, timezoneId: 'Pacific/Auckland', locale: opts.locale || 'en-CA' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(FIXED);
  const fx = opts.fn || makeFn();
  const seen = [];
  await page.route('**/*', route => {
    const url = route.request().url();
    seen.push(url);
    if (url.startsWith(FN)) return fx.handler(route);
    if (url.startsWith('https://hub.welfareavenue.com/o/')) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PAGE });
    if (url.indexOf('fonts.googleapis.com/css2') >= 0) {
      const fam = [['Barlow Condensed', 'barlow-condensed'], ['Space Grotesk', 'space-grotesk']];
      const css = fam.filter(f => url.indexOf(f[0].replace(' ', '+')) >= 0).map(f => [400, 500, 600, 700].map(w => "@font-face{font-family:'" + f[0] + "';font-style:normal;font-weight:" + w + ';font-display:swap;src:url(https://fonts.gstatic.com/s/' + f[1] + '-latin-' + w + "-normal.woff2) format('woff2');}").join('')).join('');
      return route.fulfill({ contentType: 'text/css', body: css });
    }
    if (url.startsWith('https://fonts.gstatic.com/s/')) { const fp = path.join(__dirname, 'fonts', url.split('/').pop()); if (fs.existsSync(fp)) return route.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(fp) }); }
    return route.abort();   // anything else (the real network included) is refused
  });
  await page.goto('https://hub.welfareavenue.com/o/' + (opts.token === undefined ? TOK : opts.token) + (opts.qs || ''));
  await page.waitForTimeout(opts.wait || 500);
  return { ctx, page, fx, calls: fx.calls, errors, seen, gets: () => fx.calls.filter(c => c.method === 'GET'), posts: () => fx.calls.filter(c => c.method === 'POST') };
}
const text = p => p.evaluate(() => document.body.innerText);
const noScroll = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth);
const shot = async (p, name) => { await p.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true }); };
const view = async (p, name) => { await p.screenshot({ path: path.join(SHOTS, name + '.png') }); };   // what the window shows (the Save bar is sticky)
const marked = p => p.evaluate(() => Array.from(document.querySelectorAll('[data-slot][aria-pressed="true"]')).map(e => e.getAttribute('data-slot')).sort());
const cell = (p, iso) => p.locator('[data-slot="' + iso + '"]');
async function dragFrom(p, a, b) {
  const A = await cell(p, a).boundingBox(), B = await cell(p, b).boundingBox();
  await p.mouse.move(A.x + A.width / 2, A.y + A.height / 2);
  await p.mouse.down();
  await p.mouse.move((A.x + B.x) / 2 + A.width / 2, (A.y + B.y) / 2 + A.height / 2, { steps: 4 });
  await p.mouse.move(B.x + B.width / 2, B.y + B.height / 2, { steps: 4 });
  await p.mouse.up();
}

(async () => {
  const browser = await launch();
  try {
    /* 0. the source */
    ok('page source exists', fs.existsSync(PAGE_FILE));
    ok('no em dash and no "AI" in the page', !/—/.test(PAGE) && !/\bAI\b/.test(PAGE));
    ok('head: noindex, no-referrer, viewport, brand tokens', /<meta name="robots" content="noindex">/.test(PAGE) && /<meta name="referrer" content="no-referrer">/.test(PAGE) && /name="viewport"/.test(PAGE) && /--green: #103F39/.test(PAGE) && /--cream: #FFFAF2/.test(PAGE) && /Barlow\+Condensed/.test(PAGE) && /Space\+Grotesk/.test(PAGE));

    /* 1. opening: one GET, no POST, even with ?a=accept; the button is only pre-focused */
    let f = await open(browser);
    let t = await text(f.page);
    ok('open: one GET and no POST', f.gets().length === 1 && f.posts().length === 0, f.calls.map(c => c.method));
    ok('open: the GET carries the token', /[?&]t=12\.ABCDEFGHIJKLMNOPQRST/.test(f.gets()[0].url));
    ok('open: greeting, role, Accept and Decline', /Hi Amina/.test(t) && /Event Coordinator/.test(t) && (await f.page.locator('[data-act="accept"]').count()) === 1 && (await f.page.locator('[data-act="decline"]').count()) === 1, t.slice(0, 300));
    ok('open: no grid before Accept', (await f.page.locator('[data-slot]').count()) === 0);
    ok('open: no sideways scroll', await noScroll(f.page));
    await shot(f.page, 'offer-desktop-en');
    ok('open: nothing blocked or failed (no page errors)', f.errors.length === 0, f.errors);
    ok('open: only the page, the function and the fonts were requested', f.seen.every(u => /^https:\/\/(hub\.welfareavenue\.com\/o\/|zwnmulmnvopclzcvytce\.supabase\.co\/functions\/v1\/onboard-link|fonts\.googleapis\.com|fonts\.gstatic\.com)/.test(u)), f.seen);
    await f.ctx.close();

    f = await open(browser, { qs: '?a=accept' });
    ok('?a=accept on open: one GET, no POST (it only pre-focuses)', f.gets().length === 1 && f.posts().length === 0, f.calls.map(c => c.method));
    ok('?a=accept: Accept is focused and marked, still no answer', await f.page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-act') === 'accept' && document.querySelector('[data-act="accept"]').classList.contains('pre')));
    await f.page.waitForTimeout(600);
    ok('?a=accept: still no POST after waiting', f.posts().length === 0);
    await f.ctx.close();
    f = await open(browser, { qs: '?a=decline' });
    ok('?a=decline on open: no POST, Decline is the marked one', f.posts().length === 0 && await f.page.evaluate(() => document.querySelector('[data-act="decline"]').classList.contains('pre') && !document.querySelector('[data-act="accept"]').classList.contains('pre')));
    ok('?a=decline: highlighted only, it does not take the focus', await f.page.evaluate(() => document.activeElement !== document.querySelector('[data-act="decline"]')));
    await f.page.keyboard.press('Enter');
    await f.page.waitForTimeout(200);
    ok('?a=decline: a stray Enter declines nothing', f.posts().length === 0);
    await f.ctx.close();

    /* 2. Accept under a double click, then the grid (desktop) */
    f = await open(browser);
    await f.page.locator('[data-act="accept"]').dblclick();
    await f.page.waitForSelector('[data-slot]', { timeout: 5000 });
    ok('accept: exactly one POST under a double click', f.posts().length === 1 && f.posts()[0].body.a === 'accept' && f.posts()[0].body.t === TOK, f.posts());
    ok('accept: then the grid (a second GET gives the window)', (await f.page.locator('[data-slot]').count()) > 300 && f.gets().length === 2, f.calls.map(c => c.method));
    t = await text(f.page);
    ok('grid: asks for times and names Toronto time', /Toronto/.test(t) && /Save/.test(t), t.slice(0, 500));
    ok('grid desktop: every day is a column, the page does not scroll sideways', (await f.page.locator('[data-day-head]').count()) === 14 && await noScroll(f.page));
    await shot(f.page, 'grid-desktop-empty');

    /* 3. drag selects (desktop), a drag from a marked cell clears, Save posts exactly those instants */
    await dragFrom(f.page, '2026-10-29T12:00:00Z', '2026-10-30T12:30:00Z');
    let m = await marked(f.page);
    ok('drag: a block of cells over two days is marked', JSON.stringify(m) === JSON.stringify(['2026-10-29T12:00:00Z', '2026-10-29T12:30:00Z', '2026-10-30T12:00:00Z', '2026-10-30T12:30:00Z']), m);
    await dragFrom(f.page, '2026-10-29T12:30:00Z', '2026-10-30T12:30:00Z');
    m = await marked(f.page);
    ok('drag from a marked cell clears the block', JSON.stringify(m) === JSON.stringify(['2026-10-29T12:00:00Z', '2026-10-30T12:00:00Z']), m);
    ok('no POST while selecting', f.posts().length === 1);
    ok('count says 2 times', /2/.test(await f.page.locator('#count').innerText()));
    await shot(f.page, 'grid-desktop-selected'); await view(f.page, 'grid-desktop-selected-window');
    await f.page.locator('[data-act="save"]').click();
    await f.page.waitForSelector('#saved:not(.hide)', { timeout: 4000 });
    const g1 = f.posts().filter(c => c.body.a === 'grid');
    ok('save: one grid POST with exactly those instants', g1.length === 1 && g1[0].body.t === TOK && JSON.stringify(g1[0].body.slots) === JSON.stringify(['2026-10-29T12:00:00Z', '2026-10-30T12:00:00Z']), g1.map(c => c.body));
    ok('save: confirmation shown', /Saved/i.test(await f.page.locator('#saved').innerText()));
    ok('save: no errors', f.errors.length === 0, f.errors);
    await f.ctx.close();

    /* 4. the clock change: 31/10/26 (UTC-4) and 02/11/26 (UTC-5) both read 8 am to 9 pm */
    f = await open(browser, { fn: makeFn({ answered: 'accept' }) });
    const h31 = await f.page.locator('[data-day-head="2026-10-31"]').innerText(), h02 = await f.page.locator('[data-day-head="2026-11-02"]').innerText();
    ok('DST: 31/10 reads 8 am to 9 pm', /8(:00)?\s*a\.m\./.test(h31) && /9(:00)?\s*p\.m\./.test(h31), h31);
    ok('DST: 02/11 reads 8 am to 9 pm', /8(:00)?\s*a\.m\./.test(h02) && /9(:00)?\s*p\.m\./.test(h02), h02);
    const a31 = await cell(f.page, '2026-10-31T12:00:00Z').getAttribute('aria-label'), a02 = await cell(f.page, '2026-11-02T13:00:00Z').getAttribute('aria-label');
    ok('DST: the 12:00Z cell is 8:00 a.m. on 31/10 and the 13:00Z cell is 8:00 a.m. on 02/11 (browser timezone is Auckland)', /8:00\s*a\.m\./.test(a31) && /8:00\s*a\.m\./.test(a02) && /31/.test(a31) && /\b2\b/.test(a02), [a31, a02]);
    ok('DST: 20:30 on 31/10 is 00:30Z next day, on 02/11 it is 01:30Z next day', /8:30\s*p\.m\./.test(await cell(f.page, '2026-11-01T00:30:00Z').getAttribute('aria-label')) && /8:30\s*p\.m\./.test(await cell(f.page, '2026-11-03T01:30:00Z').getAttribute('aria-label')));
    ok('DST: 13:00Z on 31/10 is 9:00 a.m. (a plain 8 am + offset guess would be wrong), and 12:00Z on 02/11 is not a cell at all', /9:00\s*a\.m\./.test(await cell(f.page, '2026-10-31T13:00:00Z').getAttribute('aria-label')) && (await cell(f.page, '2026-11-02T12:00:00Z').count()) === 0);
    await cell(f.page, '2026-10-31T12:00:00Z').click();
    await cell(f.page, '2026-11-02T13:00:00Z').click();
    await f.page.locator('[data-act="save"]').click();
    await f.page.waitForSelector('#saved:not(.hide)', { timeout: 4000 });
    const g2 = f.posts().filter(c => c.body.a === 'grid');
    ok('DST: an 8 am cell posts 12:00Z on 31/10 and 13:00Z on 02/11', g2.length === 1 && JSON.stringify(g2[0].body.slots) === JSON.stringify(['2026-10-31T12:00:00Z', '2026-11-02T13:00:00Z']), g2.map(c => c.body));
    await f.ctx.close();

    /* 5. a saved grid reloads with its cells marked */
    const saved = ['2026-10-29T12:00:00Z', '2026-10-29T12:30:00Z', '2026-11-02T13:00:00Z'];
    f = await open(browser, { fn: makeFn({ answered: 'accept', slotsSaved: saved }) });
    m = await marked(f.page);
    ok('saved grid: those cells are marked on load, no POST', JSON.stringify(m) === JSON.stringify(saved) && f.posts().length === 0, m);
    ok('saved grid: the count says 3', /3/.test(await f.page.locator('#count').innerText()));
    await f.ctx.close();

    /* 6. the phone (390 px): day chips, a tap toggles, Save posts exactly those */
    f = await open(browser, { phone: true });
    ok('phone: offer view has no sideways scroll', await noScroll(f.page));
    await shot(f.page, 'offer-phone-en');
    await f.page.locator('[data-act="accept"]').tap();
    await f.page.waitForSelector('[data-slot]', { timeout: 5000 });
    ok('phone: accept posted once', f.posts().length === 1);
    ok('phone: grid has no sideways scroll', await noScroll(f.page));
    await f.page.locator('[data-day="2026-10-29"]').tap();
    ok('phone: one day shows at a time', (await f.page.locator('[data-slot]:visible').count()) === 26, await f.page.locator('[data-slot]:visible').count());
    await cell(f.page, '2026-10-29T12:00:00Z').tap();
    await cell(f.page, '2026-10-29T13:30:00Z').tap();
    await cell(f.page, '2026-10-29T14:00:00Z').tap();
    await cell(f.page, '2026-10-29T14:00:00Z').tap();   // a second tap clears it
    await f.page.locator('[data-day="2026-10-30"]').tap();
    await cell(f.page, '2026-10-30T12:00:00Z').tap();
    m = await marked(f.page);
    ok('phone: taps toggle, across days', JSON.stringify(m) === JSON.stringify(['2026-10-29T12:00:00Z', '2026-10-29T13:30:00Z', '2026-10-30T12:00:00Z']), m);
    ok('phone: the day chips show how many are marked', /1/.test(await f.page.locator('[data-day="2026-10-30"]').innerText()) && /2/.test(await f.page.locator('[data-day="2026-10-29"]').innerText()));
    ok('phone: no sideways scroll with cells shown', await noScroll(f.page));
    await shot(f.page, 'grid-phone-selected'); await view(f.page, 'grid-phone-selected-window');
    await f.page.locator('[data-act="save"]').tap();
    await f.page.waitForSelector('#saved:not(.hide)', { timeout: 4000 });
    const g3 = f.posts().filter(c => c.body.a === 'grid');
    ok('phone: Save posts exactly those instants', g3.length === 1 && JSON.stringify(g3[0].body.slots) === JSON.stringify(['2026-10-29T12:00:00Z', '2026-10-29T13:30:00Z', '2026-10-30T12:00:00Z']), g3.map(c => c.body));
    ok('phone: no sideways scroll after save', await noScroll(f.page));
    await shot(f.page, 'grid-phone-saved');
    await f.ctx.close();

    /* 7. French: ?l=fr, and the function's lang when there is no ?l */
    f = await open(browser, { qs: '?l=fr' });
    t = await text(f.page);
    ok('?l=fr: French offer view', /Bonjour Amina/.test(t) && /Accepter/.test(t) && /Refuser/.test(t) && await f.page.evaluate(() => document.documentElement.lang === 'fr'), t.slice(0, 300));
    ok('?l=fr: French role name', /Coordonnateur/.test(t));
    await shot(f.page, 'offer-desktop-fr');
    await f.ctx.close();
    f = await open(browser, { fn: makeFn({ lang: 'fr' }), locale: 'en-CA' });
    ok('no ?l: the function\'s lang (fr) is used', /Bonjour Amina/.test(await text(f.page)));
    await f.ctx.close();
    f = await open(browser, { qs: '?l=en', fn: makeFn({ lang: 'fr' }) });
    ok('?l=en wins over the function\'s lang', /Hi Amina/.test(await text(f.page)));
    await f.ctx.close();
    f = await open(browser, { qs: '?l=fr', fn: makeFn({ answered: 'accept' }), phone: true });
    t = await text(f.page);
    ok('French grid: instructions and Toronto time, times as 8 h 00', /Enregistrer/.test(t) && /Toronto/.test(t) && /8\s*h\s*00/.test(await cell(f.page, '2026-10-29T12:00:00Z').getAttribute('aria-label')), t.slice(0, 400));
    ok('French grid: no sideways scroll', await noScroll(f.page));
    await shot(f.page, 'grid-phone-fr');
    const link = f.page.locator('#lang a');
    await link.click();
    await f.page.waitForTimeout(150);
    ok('language toggle: back to English without another GET', /Save/.test(await text(f.page)) && f.gets().length === 1 && /l=en/.test(f.page.url()), f.page.url());
    await f.ctx.close();

    /* 8. closed: the contact HR message, nothing to press */
    f = await open(browser, { fn: makeFn({ closed: true }) });
    t = await text(f.page);
    ok('closed: says to contact HR, no buttons, no grid', /contact HR/i.test(t) && (await f.page.locator('button').count()) === 0 && (await f.page.locator('[data-slot]').count()) === 0, t.slice(0, 300));
    ok('closed: no POST', f.posts().length === 0);
    await shot(f.page, 'closed-desktop');
    await f.ctx.close();
    f = await open(browser, { fn: makeFn({ closed: true, booked: true }), qs: '?l=fr', phone: true });
    t = await text(f.page);
    ok('closed (French, booked): contact HR in French, no sideways scroll', /communiquer avec les RH/.test(t) && await noScroll(f.page), t);
    await shot(f.page, 'closed-phone-fr');
    await f.ctx.close();

    /* 9. decline, repeated answers, late */
    f = await open(browser, { fn: makeFn({}) });
    await f.page.locator('[data-act="decline"]').click();
    await f.page.waitForSelector('#declined', { timeout: 4000 });
    ok('decline: one POST decline, then the thank-you without a grid', f.posts().length === 1 && f.posts()[0].body.a === 'decline' && (await f.page.locator('[data-slot]').count()) === 0 && /Thank you, Amina/.test(await text(f.page)));
    await shot(f.page, 'declined-desktop');
    await f.ctx.close();
    f = await open(browser, { fn: makeFn({ answered: 'decline' }) });
    ok('already declined: shows the first answer, no buttons', /declin/i.test(await text(f.page)) && (await f.page.locator('[data-act]').count()) === 0 && f.posts().length === 0);
    await f.ctx.close();
    f = await open(browser, { fn: makeFn({ answered: 'accept', late: true }) });
    ok('late accept: grid with a calm note', (await f.page.locator('[data-slot]').count()) > 0 && /reply-by date/i.test(await text(f.page)));
    await f.ctx.close();

    /* 10. the manager's link: straight to the grid, no Accept */
    f = await open(browser, { fn: makeFn({ kind: 'manager', first: 'Marc', hire: 'Amina', lang: 'en' }) });
    t = await text(f.page);
    ok('manager: grid without Accept, names the hire', (await f.page.locator('[data-slot]').count()) > 0 && (await f.page.locator('[data-act="accept"]').count()) === 0 && /Marc/.test(t) && /Amina/.test(t) && /1-on-1/.test(t), t.slice(0, 400));
    await cell(f.page, '2026-10-29T14:00:00Z').click();
    await f.page.locator('[data-act="save"]').click();
    await f.page.waitForSelector('#saved:not(.hide)', { timeout: 4000 });
    const g4 = f.posts();
    ok('manager: Save posts a grid answer', g4.length === 1 && g4[0].body.a === 'grid' && JSON.stringify(g4[0].body.slots) === JSON.stringify(['2026-10-29T14:00:00Z']), g4.map(c => c.body));
    await shot(f.page, 'manager-desktop');
    await f.ctx.close();

    /* 11. the password stub, a bad link, and a refused save */
    f = await open(browser, { fn: makeFn({ kind: 'password' }), phone: true });
    t = await text(f.page);
    ok('password: a "not ready yet" view, nothing to press, no sideways scroll', /not ready yet/i.test(t) && (await f.page.locator('[data-act]').count()) === 0 && await noScroll(f.page), t);
    await f.ctx.close();
    f = await open(browser, { fn: makeFn({ bad: true }), qs: '?l=fr' });
    ok('bad link: the function\'s message in French', /communiquer avec les RH/.test(await text(f.page)));
    await f.ctx.close();
    f = await open(browser, { token: '' });
    ok('no token: a bad-link message, no GET', f.gets().length === 0 && /contact HR/i.test(await text(f.page)));
    await f.ctx.close();
    f = await open(browser, { fn: makeFn({ answered: 'accept', postGrid: { status: 500, body: { ok: false, error: 'save', message: MSG.save } } }) });
    await cell(f.page, '2026-10-29T14:00:00Z').click();
    await f.page.locator('[data-act="save"]').click();
    await f.page.waitForSelector('#err:not(.hide)', { timeout: 4000 });
    ok('refused save: the message shows and the choices stay', /could not save/i.test(await f.page.locator('#err').innerText()) && JSON.stringify(await marked(f.page)) === JSON.stringify(['2026-10-29T14:00:00Z']));
    await f.ctx.close();
    f = await open(browser, { fn: makeFn({ answered: 'accept', postGrid: { status: 200, body: { ok: true, closed: true, booked: true, message: MSG.closed } } }) });
    await cell(f.page, '2026-10-29T14:00:00Z').click();
    await f.page.locator('[data-act="save"]').click();
    await f.page.waitForSelector('[data-slot]', { state: 'detached', timeout: 4000 });
    ok('save on a closed link: the contact HR message replaces the grid', /contact HR/i.test(await text(f.page)));
    await f.ctx.close();

    /* 12. keyboard: a cell is a button, Space toggles it */
    f = await open(browser, { fn: makeFn({ answered: 'accept' }) });
    await cell(f.page, '2026-10-29T15:00:00Z').focus();
    await f.page.keyboard.press('Space');
    ok('keyboard: Space toggles a cell', JSON.stringify(await marked(f.page)) === JSON.stringify(['2026-10-29T15:00:00Z']));
    await f.page.keyboard.press('Enter');
    ok('keyboard: Enter toggles it back', (await marked(f.page)).length === 0);
    await f.ctx.close();

    /* the server cannot answer: not a bad link, and a retry works */
    for (const [how, label] of [['abort', 'network failure'], ['503', 'a 503']]) {
      const fn = makeFn({ getFail: how });
      f = await open(browser, { fn });
      t = await text(f.page);
      ok(label + ': says it could not reach the server, not that the link is bad', /could not reach the server/i.test(t) && !/does not work/i.test(t), t.slice(0, 300));
      fn.S.getFail = null;
      await f.page.locator('#retry').click();
      await f.page.waitForSelector('[data-act="accept"]', { timeout: 4000 });
      ok(label + ': Try again loads the page', /Hi Amina/.test(await text(f.page)));
      await f.ctx.close();
    }
    f = await open(browser, { fn: makeFn({ getFail: 'abort' }), qs: '?l=fr' });
    t = await text(f.page);
    ok('network failure, in French', /joindre le serveur/.test(t) && /Réessayer/.test(t), t.slice(0, 300));
    await f.ctx.close();
    {
      const fn = makeFn();
      f = await open(browser, { fn });
      fn.S.getFail = 'abort';
      await f.page.locator('[data-act="accept"]').click();
      await f.page.waitForSelector('#retry', { timeout: 4000 });
      t = await text(f.page);
      ok('a failed read after a saved Accept says it was saved', /answer is saved/i.test(t) && /accepted the offer/i.test(t) && !/does not work/i.test(t), t.slice(0, 300));
      ok('and the answer went once', f.posts().filter(c => c.body.a === 'accept').length === 1);
      fn.S.getFail = null;
      await f.page.locator('#retry').click();
      await f.page.waitForSelector('[data-slot]', { state: 'attached', timeout: 4000 });
      ok('Try again goes on to the grid', (await f.page.locator('[data-slot]').count()) > 0);
      await f.ctx.close();
    }

    /* the call is booked and the 1-on-1 is not: the words say what remains */
    f = await open(browser, { fn: makeFn({ answered: 'accept' }) });
    ok('nothing booked: two meetings', /two meetings/.test(await text(f.page)));
    await f.ctx.close();
    f = await open(browser, { fn: makeFn({ answered: 'accept', callBooked: true }) });
    t = await text(f.page);
    ok('call booked: only the 1-on-1 remains', !/two meetings/.test(t) && /onboarding call is booked/.test(t) && /1-on-1 with your manager/.test(t), t.slice(0, 400));
    await f.ctx.close();
    f = await open(browser, { fn: makeFn({ answered: 'accept', callBooked: true }), qs: '?l=fr' });
    t = await text(f.page);
    ok('call booked, in French', !/deux rencontres/.test(t) && /appel d.accueil est fixé/.test(t), t.slice(0, 400));
    await f.ctx.close();

    /* 13. wave271d: the hire's grid needs grid.minHours hours (10 here: 20 cells of 30 minutes) before Save is enabled; the manager's has no minimum */
    const A29 = '2026-10-29T';   // 8:00 a.m. on 29/10 is 12:00Z (UTC-4); 17:00 is 21:00Z
    const need = p => p.locator('#minmsg').isVisible();
    const mark = (p, list) => p.evaluate(l => l.forEach(i => document.querySelector('[data-slot="' + i + '"]').click()), list);   // a click on each cell (the sticky Save bar hides the lower rows from a mouse drag)
    const run = n => { const a = []; for (let i = 0; i < n; i++) a.push(A29 + (12 + Math.floor(i / 2)) + ':' + (i % 2 ? '30' : '00') + ':00Z'); return a; };
    f = await open(browser, { fn: makeFn({ answered: 'accept', minHours: 10 }) });
    ok('min hours: nothing marked reads "0 of 10 hours marked"', (await f.page.locator('#count').innerText()).trim() === '0 of 10 hours marked', await f.page.locator('#count').innerText());
    ok('min hours: Save is disabled and the sentence says why', await f.page.locator('#save').isDisabled() && await need(f.page) && (await f.page.locator('#minmsg').innerText()).trim() === 'Please mark at least 10 hours in total, so your manager has a few times to choose from.', await f.page.locator('#minmsg').innerText());
    ok('min hours: Save points at the sentence', await f.page.locator('#save').getAttribute('aria-describedby') === 'minmsg');
    await shot(f.page, 'min-hours-empty');
    await mark(f.page, run(19));   // 19 cells, 9.5 hours
    ok('min hours: 19 cells are marked', (await marked(f.page)).length === 19, (await marked(f.page)).length);
    ok('min hours: 19 cells read "9.5 of 10 hours marked", Save still disabled, sentence still shown', (await f.page.locator('#count').innerText()).trim() === '9.5 of 10 hours marked' && await f.page.locator('#save').isDisabled() && await need(f.page), await f.page.locator('#count').innerText());
    await f.page.locator('#save').click({ force: true, timeout: 1500 }).catch(() => {});
    ok('min hours: pressing a disabled Save sends nothing', f.posts().length === 0, f.posts());
    await mark(f.page, [A29 + '21:30:00Z']);
    ok('min hours: 20 cells read "10 of 10 hours marked"', (await f.page.locator('#count').innerText()).trim() === '10 of 10 hours marked', await f.page.locator('#count').innerText());
    ok('min hours: Save is enabled and the sentence is hidden', await f.page.locator('#save').isEnabled() && !(await need(f.page)));
    await shot(f.page, 'min-hours-met'); await view(f.page, 'min-hours-met-window');
    await f.page.locator('#save').click();
    await f.page.waitForSelector('#saved:not(.hide)', { timeout: 4000 });
    const g5 = f.posts().filter(c => c.body.a === 'grid');
    ok('min hours: Save posts the 20 instants', g5.length === 1 && g5[0].body.slots.length === 20, g5.map(c => c.body.slots.length));
    ok('min hours: Save is enabled again after saving', await f.page.locator('#save').isEnabled());
    await mark(f.page, [A29 + '21:30:00Z']);   // 19 again
    ok('min hours: clearing one cell disables Save and brings the sentence back', await f.page.locator('#save').isDisabled() && await need(f.page) && /^9\.5 of 10/.test(await f.page.locator('#count').innerText()));
    await f.page.locator('#clear').click();
    ok('min hours: Clear all goes back to 0 of 10', (await f.page.locator('#count').innerText()).trim() === '0 of 10 hours marked' && await f.page.locator('#save').isDisabled());
    ok('min hours: no page errors', f.errors.length === 0, f.errors);
    await f.ctx.close();

    /* a saved grid that is under the minimum still needs topping up; one at the minimum opens with Save enabled */
    f = await open(browser, { fn: makeFn({ answered: 'accept', minHours: 10, slotsSaved: run(4) }) });
    ok('min hours: a saved 2 hours reads "2 of 10 hours marked" with Save disabled', (await f.page.locator('#count').innerText()).trim() === '2 of 10 hours marked' && await f.page.locator('#save').isDisabled() && await need(f.page), await f.page.locator('#count').innerText());
    await f.ctx.close();
    f = await open(browser, { fn: makeFn({ answered: 'accept', minHours: 10, slotsSaved: run(20) }) });
    ok('min hours: a saved 10 hours opens with Save enabled and no sentence', await f.page.locator('#save').isEnabled() && !(await need(f.page)) && /^10 of 10/.test(await f.page.locator('#count').innerText()));
    await f.ctx.close();

    /* a minimum of 1 says "hour" */
    f = await open(browser, { fn: makeFn({ answered: 'accept', minHours: 1 }) });
    ok('min hours: a minimum of 1 says "hour"', /at least 1 hour in total/.test(await f.page.locator('#minmsg').innerText()) && (await f.page.locator('#count').innerText()).trim() === '0 of 1 hour marked', await f.page.locator('#count').innerText());
    await f.ctx.close();

    /* 0 means no minimum: the old count, Save always on, no sentence */
    f = await open(browser, { fn: makeFn({ answered: 'accept', minHours: 0 }) });
    ok('min hours 0: the plain count, Save enabled, no sentence', await f.page.locator('#save').isEnabled() && !(await need(f.page)) && /No times marked/.test(await f.page.locator('#count').innerText()), await f.page.locator('#count').innerText());
    await f.ctx.close();

    /* the manager: the function may carry the figure, the page ignores it */
    f = await open(browser, { fn: makeFn({ kind: 'manager', first: 'Marc', hire: 'Amina', minHours: 10 }) });
    ok('manager: no minimum: plain count, Save enabled, no sentence', await f.page.locator('#save').isEnabled() && !(await need(f.page)) && !/hours marked/.test(await f.page.locator('#count').innerText()), await f.page.locator('#count').innerText());
    await cell(f.page, A29 + '14:00:00Z').click();
    await f.page.locator('#save').click();
    await f.page.waitForSelector('#saved:not(.hide)', { timeout: 4000 });
    ok('manager: one cell saves', f.posts().length === 1 && f.posts()[0].body.slots.length === 1, f.posts().map(c => c.body));
    await f.ctx.close();

    /* French */
    f = await open(browser, { qs: '?l=fr', fn: makeFn({ answered: 'accept', minHours: 10 }) });
    ok('min hours (French): "0 heure sur 10 indiquées", the sentence, Save disabled', (await f.page.locator('#count').innerText()).trim() === '0 heure sur 10 indiquées' && await f.page.locator('#save').isDisabled()
      && (await f.page.locator('#minmsg').innerText()).trim() === 'Veuillez indiquer au moins 10 heures en tout, pour que votre gestionnaire ait quelques plages au choix.', [await f.page.locator('#count').innerText(), await f.page.locator('#minmsg').innerText()]);
    await mark(f.page, run(19));
    ok('min hours (French): 19 cells read "9,5 heures sur 10 indiquées"', (await f.page.locator('#count').innerText()).trim() === '9,5 heures sur 10 indiquées', await f.page.locator('#count').innerText());
    await mark(f.page, [A29 + '21:30:00Z']);
    ok('min hours (French): 20 cells read "10 heures sur 10 indiquées", Save enabled, sentence hidden', (await f.page.locator('#count').innerText()).trim() === '10 heures sur 10 indiquées' && await f.page.locator('#save').isEnabled() && !(await need(f.page)));
    await shot(f.page, 'min-hours-fr');
    await f.page.locator('#lang a').click();
    await f.page.waitForTimeout(150);
    ok('min hours: the language toggle keeps the marks and rewords the count', (await f.page.locator('#count').innerText()).trim() === '10 of 10 hours marked' && (await marked(f.page)).length === 20 && f.gets().length === 1);
    await f.ctx.close();

    /* the phone: the sentence and the count fit without sideways scroll */
    f = await open(browser, { phone: true, fn: makeFn({ answered: 'accept', minHours: 10 }) });
    ok('min hours (phone): sentence shown, no sideways scroll', await need(f.page) && await noScroll(f.page));
    await view(f.page, 'min-hours-phone-window');
    await f.ctx.close();

    /* the function refusing with too_few_slots (a page that was out of date): its sentence shows and the marks stay */
    f = await open(browser, { fn: makeFn({ answered: 'accept', minHours: 0, postGrid: { status: 400, body: { ok: false, error: 'too_few_slots', message: { en: 'Please mark at least 10 hours in total, so your manager has a few times to choose from.', fr: 'Veuillez indiquer au moins 10 heures en tout, pour que votre gestionnaire ait quelques plages au choix.' } } } }) });
    await cell(f.page, A29 + '14:00:00Z').click();
    await f.page.locator('#save').click();
    await f.page.waitForSelector('#err:not(.hide)', { timeout: 4000 });
    ok('too_few_slots from the function: its message shows and the marks stay', /at least 10 hours/.test(await f.page.locator('#err').innerText()) && (await marked(f.page)).length === 1 && await f.page.locator('#save').isEnabled());
    await f.ctx.close();
  } catch (e) { fail++; console.log('FAIL exception ' + (e && e.stack || e)); }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
