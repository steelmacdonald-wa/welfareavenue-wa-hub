/* w168drive.js: wave168, photos and the brand on the fundraising events and the CRM's forms. Steel (29/09/26): "Also where
   possible add photos to our fundraising events pages, all forms in the CRM - in fact really try to enhance branding here"
   (the Hub's event pages and the website's).
   The events, the Photo library rows and the website's past fundraisers are the live rows after wa168 and wa168b (a subset of
   the photos; test/fx_w168.json). Pictures are served from the scratchpad copies of the public storage when present (IMG, SM),
   and Supabase's resized posters from the originals. Every write is caught on the page (the stub never changes the fixture).
   Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26). */
const fs = require('fs');
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
const SP = '/tmp/claude-0/-home-claude/4ca49ca1-5fe5-5291-ac38-6e2e0a16ba96/scratchpad/';
const IMG = process.env.IMG || SP + 'img';
const SM = process.env.SM || SP + 'sm';
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const X = JSON.parse(fs.readFileSync(path.join(__dirname, 'fx_w168.json'), 'utf8'));
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }
const ST = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/';

const QV = [
  { id: 'first_name', type: 'text', label: 'First name', required: true, to: 'contact.first_name' },
  { id: 'email', type: 'email', label: 'Email', required: true, to: 'contact.email' }
];
function fx() {
  const f = loadFixture();
  f.wa_photos = JSON.parse(JSON.stringify(X.wa_photos));
  f.site_events = JSON.parse(JSON.stringify(X.site_events));
  f.fund_events = JSON.parse(JSON.stringify(X.fund_events));
  f.crm_forms = [
    { id: 1, slug: 'volunteer', title: 'Volunteer with Welfare Avenue', intro: 'Welfare Avenue serves free meals in Montreal.', lang: 'en', kind: 'volunteer', status: 'draft', questions: QV, consent: { ask: false }, thank_you: 'Thank you.', settings: { volunteer_record: true, tags: [] }, cover_photo_id: null, created_at: '2026-09-28T10:00:00Z', created_by: 'wave156', updated_at: '2026-09-28T10:00:00Z', updated_by: 'wave156', published_at: null, published_by: null, closed_at: null },
    { id: 3, slug: 'newsletter', title: 'Get the Welfare Avenue newsletter', intro: 'About once a month.', lang: 'en', kind: 'newsletter', status: 'published', questions: QV, consent: { ask: true, required: true, label: 'Yes, email me the newsletter.' }, thank_you: 'You are on the list.', settings: { tags: [] }, cover_photo_id: 3, created_at: '2026-09-28T10:02:00Z', created_by: 'wave156', updated_at: '2026-09-28T10:02:00Z', updated_by: 'wave156', published_at: '2026-09-28T11:00:00Z', published_by: 'steel.macdonald@welfareavenue.com', closed_at: null }
  ];
  f.crm_form_stats_v = [{ form_id: 1, submissions: 0, last_7_days: 0, last_at: null, spam: 0, errors: 0, tests: 0 }, { form_id: 3, submissions: 0, last_7_days: 0, last_at: null, spam: 0, errors: 0, tests: 0 }];
  f.crm_form_submissions = []; f.crm_fields = f.crm_fields || [];
  return f;
}
/* the pictures: our storage from the scratchpad copies; the resized posters from the originals (or refused, to test the fallback) */
function pictures(opts) {
  opts = opts || {};
  return async page => {
    const serve = (dir, rel, route) => { const fp = path.join(dir, rel); if (fs.existsSync(fp)) return route.fulfill({ contentType: /\.png$/.test(fp) ? 'image/png' : 'image/jpeg', body: fs.readFileSync(fp) }); return route.fulfill({ status: 404, body: '' }); };
    await page.route('**/storage/v1/object/public/content-images/**', r => serve(IMG, r.request().url().split('/content-images/')[1].split('?')[0], r));
    await page.route('**/storage/v1/object/public/site-media/**', r => serve(SM, r.request().url().split('/site-media/')[1].split('?')[0], r));
    await page.route('**/storage/v1/render/image/public/site-media/**', r => opts.noResize ? r.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"resize off"}' }) : serve(SM, r.request().url().split('/site-media/')[1].split('?')[0], r));
  };
}
const spy = f => f.ev(() => {
  window.__ins = [];
  const from0 = db.from.bind(db);
  db.from = function (t) {
    const q = from0(t); const ins = q.insert, up = q.update;
    q.insert = function (p) { window.__ins.push({ t: t, op: 'insert', p: JSON.parse(JSON.stringify(p)) }); return ins.call(this, p); };
    q.update = function (p) { window.__ins.push({ t: t, op: 'update', p: JSON.parse(JSON.stringify(p)) }); return up.call(this, p); };
    return q;
  };
  return true;
});
const click = (f, s) => f.ev(x => { const el = document.querySelector(x); if (!el) return false; el.click(); return true; }, s);
const bg = el => (el && (el.style.backgroundImage || getComputedStyle(el).backgroundImage)) || '';

(async () => {
  const browser = await launch();
  try {
    /* 1. the Events calendar: the cards */
    let f = await fresh(browser, { who: 'admin', width: 1366, hash: '#fundevents', fixture: fx(), wait: 5200, beforeGoto: pictures() });
    await f.page.waitForTimeout(900);
    let b = await f.ev(() => {
      const card = id => { const c = document.querySelector('#w124fund .w124fe[data-w124fund="' + id + '"]'); if (!c) return null; const cv = c.querySelector('.w168cv'); return cv ? { first: c.firstElementChild === cv, bg: cv.style.backgroundImage, pos: cv.style.backgroundPosition, lb: (cv.querySelector('.lb') || {}).textContent || '', poster: cv.classList.contains('poster'), brand: cv.classList.contains('brand'), e: !!cv.querySelector('img.e[src$="brand/e-large-gold-600.png"]'), s: (cv.querySelector('img.s') || { getAttribute: () => '' }).getAttribute('src').split('/').pop(), img: (cv.querySelector('img') || { getAttribute: () => null }).getAttribute('src'), orig: (cv.querySelector('img') || { getAttribute: () => null }).getAttribute('data-w168orig') } : 'none'; };
      return { ff26: card(1), ff27: card(13), gift: card(4), onebag: card(3), stpat: card(6), cook: card(9), sports: card(11), rally: card(2), jmcc: card(5), ideaCovers: document.querySelectorAll('#w124fund .w124ideas .w168cv').length };
    });
    ok('Flag Football 2026 (done): its own celebration photo, the small size, no edition label', b.ff26 && b.ff26.first && /photos\/thumb\/2026-08-flag-football-celebration\.jpg/.test(b.ff26.bg) && b.ff26.lb === '' && b.ff26.pos === '50% 50%', b.ff26);
    ok('Flag Football 2027: last summer\'s team photo, labelled The 2026 edition', b.ff27 && /2026-08-flag-football-team-photo\.jpg/.test(b.ff27.bg) && b.ff27.lb === 'The 2026 edition', b.ff27);
    ok('Gift Basket Drive 2026: last December\'s crew, The 2025 edition (the year from the photo\'s series)', b.gift && /2025-12-gift-baskets-the-crew\.jpg/.test(b.gift.bg) && b.gift.lb === 'The 2025 edition', b.gift);
    ok('events with past fundraisers like them show the latest poster, resized, with the original to fall back on', b.stpat && b.stpat.poster && /\/render\/image\/public\/site-media\/events\/fundraising\/fundraisers-82568da6a122fd63b7b2\.png\?width=480/.test(b.stpat.img) && /\/object\/public\/site-media\/.+fundraisers-82568da6a122fd63b7b2\.png$/.test(b.stpat.orig) && b.stpat.lb === 'From March 2023'
      && b.cook && /img-0905\.jpg/.test(b.cook.img) && b.cook.lb === 'From December 2024' && b.onebag && /img-1350\.jpg/.test(b.onebag.img) && b.onebag.lb === 'From June 2023' && b.sports && b.sports.lb === 'From December 2023', { stpat: b.stpat, cook: b.cook, onebag: b.onebag, sports: b.sports });
    ok('events with no picture yet get the brand\'s green band with the E that moves and a doodle (one per event); ideas stay chips', b.rally && b.rally.brand && b.rally.e && b.rally.s === 'doodle-heart-purple.png' && b.jmcc && b.jmcc.brand && b.jmcc.e && b.jmcc.s === 'doodle-flowers-gold.png' && b.ideaCovers === 0, { rally: b.rally, jmcc: b.jmcc, ideas: b.ideaCovers });
    if (SHOTS) { await f.ev(() => document.querySelector('#w124fund .w124evs').scrollIntoView()); await f.page.waitForTimeout(700); await f.page.screenshot({ path: SHOTS + '/w168_cards.png' }); }

    /* 2. an event's page: Flag Football 2027 */
    await click(f, '#w124fund .w124fe[data-w124fund="13"]'); await f.page.waitForTimeout(700);
    b = await f.ev(() => {
      const p = document.querySelector('#w124sheet .pane'); if (!p) return null;
      const hero = p.querySelector('.w168hero'), h2 = p.querySelector('h2');
      const secs = [...p.querySelectorAll('.w168sec')].map(s => ({ h: s.querySelector('b').textContent, n: s.querySelectorAll('.w168g, .w168pp').length, items: [...s.querySelectorAll('.w168pp')].map(x => x.innerText.replace(/\s+/g, ' ')) }));
      return { hero: hero && { bg: hero.style.backgroundImage, label: (hero.querySelector('.lb') || {}).textContent, star: !!hero.querySelector('img.d[src$="brand/doodle-star-gold.png"]'), role: hero.getAttribute('role'), aria: hero.getAttribute('aria-label'), beforeH2: !!(h2 && (hero.compareDocumentPosition(h2) & Node.DOCUMENT_POSITION_FOLLOWING)) }, h2: h2 && h2.textContent, secs };
    });
    ok('its page opens on the photo (full web size) with a gold star, before the title, labelled Photo: the 2026 edition', b && b.hero && /photos\/web\/2026-08-flag-football-team-photo\.jpg/.test(b.hero.bg) && b.hero.star && b.hero.beforeH2 && b.hero.label === 'Photo: the 2026 edition' && b.hero.role === 'img' && /A team on the field/.test(b.hero.aria || '') && b.h2 === 'Flag Football 2027', b);
    ok('Photos from the 2026 edition: the seven ready photos of the series', b && b.secs[0] && b.secs[0].h === 'Photos from the 2026 edition' && b.secs[0].n === 7, b && b.secs);
    ok('A past fundraiser like it: the FlagPlus tournament, December 2023', b && b.secs[1] && b.secs[1].h === 'A past fundraiser like it' && b.secs[1].n === 1 && /FlagPlus Football Charity Tournament\s*December 2023/.test(b.secs[1].items[0]), b && b.secs);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/w168_event_page.png' });
    /* full size */
    await click(f, '#w124sheet .w168g'); await f.page.waitForTimeout(400);
    b = await f.ev(() => { const lb = document.getElementById('w168lb'); return lb ? { src: lb.querySelector('img').getAttribute('src'), alt: lb.querySelector('img').alt, role: lb.getAttribute('role'), close: !!lb.querySelector('button[aria-label="Close"]'), sheet: document.getElementById('w124sheet').classList.contains('on') } : null; });
    ok('a photo opens full size over everything, with a Close button', b && /photos\/web\/2026-08-flag-football-/.test(b.src) && b.role === 'dialog' && b.close && b.sheet, b);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/w168_lightbox.png' });
    await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(300);
    b = await f.ev(() => ({ lb: !!document.getElementById('w168lb'), sheet: document.getElementById('w124sheet').classList.contains('on') }));
    ok('Escape closes the photo and leaves the event\'s page open', !b.lb && b.sheet, b);
    await click(f, '#w124sheet .w168pp'); await f.page.waitForTimeout(400);
    b = await f.ev(() => { const lb = document.getElementById('w168lb'); return lb ? lb.querySelector('img').getAttribute('src') : null; });
    ok('a past fundraiser\'s poster opens at its original size', /\/object\/public\/site-media\/events\/fundraising\/green-brown-simple-big-gaming-football-instagram-post\.png$/.test(b || ''), b);
    await click(f, '#w168lb'); await f.page.waitForTimeout(300);
    ok('a click closes it', await f.ev(() => !document.getElementById('w168lb')));

    /* 3. St. Patrick's: the poster opens the page, the three nights at Reggie's in order */
    await f.ev(() => w124.close()); await click(f, '#w124fund .w124fe[data-w124fund="6"]'); await f.page.waitForTimeout(700);
    b = await f.ev(() => { const p = document.querySelector('#w124sheet .pane'); const h = p.querySelector('.w168hero'); return { poster: h && h.classList.contains('poster') && h.tagName, img: h && h.querySelector('img').getAttribute('src'), full: h && h.getAttribute('data-w168full'), label: h && (h.querySelector('.lb') || {}).textContent, alt: h && h.querySelector('img').alt, past: [...p.querySelectorAll('.w168pp b')].map(x => x.textContent), head: [...p.querySelectorAll('.w168sec > b')].map(x => x.textContent) }; });
    ok('no photo of its own: the page opens on the latest poster (resized to 900), named and dated, and opens full size', b.poster === 'BUTTON' && /render\/image\/public\/.+fundraisers-82568da6a122fd63b7b2\.png\?width=900/.test(b.img) && /object\/public\/.+fundraisers-82568da6a122fd63b7b2\.png$/.test(b.full) && b.label === "Reggie's St. Patty's Party, March 2023" && b.alt === b.label, b);
    ok('Past fundraisers like it: the three nights at Reggie\'s, oldest first', b.head.join('|') === 'Past fundraisers like it' && b.past.join('|') === "Party for A Good Cause!|Party for a Good Cause - Second Edition|Reggie's St. Patty's Party", b);

    /* an event with no picture yet: the brand's band, and for the people who edit, how to add one */
    await f.ev(() => w124.close()); await click(f, '#w124fund .w124fe[data-w124fund="2"]'); await f.page.waitForTimeout(600);
    b = await f.ev(() => { const p = document.querySelector('#w124sheet .pane'); const h = p.querySelector('.w168hero'); return { brand: !!(h && h.classList.contains('brand')), e: !!(h && h.querySelector('img.e')), hint: (p.querySelector('.w168hint') || {}).textContent || '', secs: p.querySelectorAll('.w168sec').length }; });
    ok('Rally Paper 2026 (no picture yet): the brand\'s band, and how to add a photo', b.brand && b.e && /Edit the event to choose one from the Photo library/.test(b.hint) && b.secs === 0, b);

    /* 4. editing: the cover, the photos shown, the past fundraisers */
    await spy(f);
    await f.ev(() => w124.close()); await click(f, '#w124fund .w124fe[data-w124fund="13"]'); await f.page.waitForTimeout(600);
    await click(f, '#w124sheet [data-w124fedit="13"]'); await f.page.waitForTimeout(600);
    b = await f.ev(() => { const fm = document.querySelector('#w124sheet form'); const th = [...fm.querySelectorAll('.w168pick [data-w168pick]')]; return { n: th.length, none: th[0].getAttribute('data-w168pick') === '' && th[0].textContent === 'None', first: th[1] && th[1].getAttribute('data-w168pick'), on: th.filter(x => x.classList.contains('on')).map(x => x.getAttribute('data-w168pick')), hidden: fm.querySelector('input[name=cover_photo_id]').value, series: fm.querySelector('select[name=photo_series]').value, seriesOpts: [...fm.querySelectorAll('select[name=photo_series] option')].map(o => o.textContent), past: [...fm.querySelectorAll('input[name=past_site]')].length, checked: [...fm.querySelectorAll('input[name=past_site]:checked')].map(x => x.value), portrait: th.some(x => /2026-08-flag-football-referee/.test(x.style.backgroundImage)), consent: th.some(x => /serving-handoff|serving-line/.test(x.style.backgroundImage)) }; });
    ok('the form picks a cover from the ready photos (no portraits, nothing waiting for consent or a crop), the current one first and chosen', b.n === 18 && b.none && b.first === '107' && b.on.join() === '107' && b.hidden === '107' && !b.portrait && !b.consent, b);
    ok('the photos shown: the series, with how many ready photos each has', b.series === 'flag-football-2026' && b.seriesOpts.indexOf('flag-football-2026 (7)') >= 0 && b.seriesOpts.indexOf('gift-baskets-2025 (5)') >= 0 && b.seriesOpts[0] === 'None', b.seriesOpts);
    ok('past fundraisers like it: the website\'s twelve, the FlagPlus tournament ticked', b.past === 12 && b.checked.join() === '7', b);
    await click(f, '#w124sheet [data-w168pick="105"]'); await f.page.waitForTimeout(200);
    await f.ev(() => { const fm = document.querySelector('#w124sheet form'); fm.querySelector('input[name=past_site][value="3"]').checked = true; });
    b = await f.ev(() => ({ hidden: document.querySelector('#w124sheet input[name=cover_photo_id]').value, on: [...document.querySelectorAll('#w124sheet .w168pick .on')].map(x => x.getAttribute('data-w168pick')) }));
    ok('choosing another photo marks it', b.hidden === '105' && b.on.join() === '105', b);
    await click(f, '#w124sheet form button[type=submit]'); await f.page.waitForTimeout(900);
    b = await f.ev(() => window.__ins.filter(x => x.t === 'fund_events' && x.op === 'update').pop());
    ok('Save writes the cover, the series and the past fundraisers (in the archive\'s order)', b && b.p.cover_photo_id === 105 && b.p.photo_series === 'flag-football-2026' && JSON.stringify(b.p.past_site_events) === '[3,7]' && b.p.title === 'Flag Football 2027', b);
    /* the result of a finished event does not touch its photos */
    await f.ev(() => w124.close()); await click(f, '#w124fund .w124fe[data-w124fund="4"]'); await f.page.waitForTimeout(600);
    await click(f, '#w124sheet [data-w124fdone="4"]'); await f.page.waitForTimeout(600);
    ok('Record the result shows no photo picker', await f.ev(() => !document.querySelector('#w124sheet .w168form')));
    await f.ev(() => { document.querySelector('#w124sheet input[name=raised]').value = '1500'; });
    await click(f, '#w124sheet form button[type=submit]'); await f.page.waitForTimeout(900);
    b = await f.ev(() => window.__ins.filter(x => x.t === 'fund_events' && x.op === 'update').pop());
    ok('and saving the result leaves the photos alone', b && b.p.status === 'done' && b.p.raised === 1500 && !('cover_photo_id' in b.p) && !('photo_series' in b.p) && !('past_site_events' in b.p), b);
    /* when the library did not load, nothing is lost */
    await f.ev(() => { const C = w124.state(); C.photos = []; C.siteEv = []; w124.close(); });
    await click(f, '#w124fund .w124fe[data-w124fund="13"]'); await f.page.waitForTimeout(500);
    await click(f, '#w124sheet [data-w124fedit="13"]'); await f.page.waitForTimeout(500);
    b = await f.ev(() => { const fm = document.querySelector('#w124sheet form'); return { series: fm.querySelector('select[name=photo_series]').value, past: !!fm.querySelector('[data-w168past]'), hidden: fm.querySelector('input[name=cover_photo_id]').value }; });
    await click(f, '#w124sheet form button[type=submit]'); await f.page.waitForTimeout(900);
    const saved = await f.ev(() => window.__ins.filter(x => x.t === 'fund_events' && x.op === 'update').pop());
    ok('if the Photo library did not load, Save keeps the cover and the series and leaves the past fundraisers alone', b.series === 'flag-football-2026' && !b.past && b.hidden === '105' && saved.p.cover_photo_id === 105 && saved.p.photo_series === 'flag-football-2026' && !('past_site_events' in saved.p), { b, saved: saved && saved.p });   /* 105: what the save above left on the event */
    ok('no page errors (the events)', f.errs.length === 0, f.errs);
    await f.close();

    /* 5. a board member sees the photos; the posters fall back to the originals when resizing does not answer */
    f = await fresh(browser, { who: 'board', width: 1366, hash: '#fundevents', fixture: fx(), wait: 5200, beforeGoto: pictures({ noResize: true }) });
    await f.page.waitForTimeout(1500);
    b = await f.ev(() => ({ covers: document.querySelectorAll('#w124fund .w168cv:not(.brand)').length, hint: (document.querySelector('#w124fund .w124fe[data-w124fund="2"]').click(), !!document.querySelector('#w124sheet .w168hint')), band: !!document.querySelector('#w124sheet .w168hero.brand'), stpat: (document.querySelector('#w124fund .w124fe[data-w124fund="6"] .w168cv img') || { getAttribute: () => null }).getAttribute('src'), orig: (document.querySelector('#w124fund .w124fe[data-w124fund="6"] .w168cv img') || { getAttribute: () => 'x' }).getAttribute('data-w168orig'), edit: !!document.querySelector('#w124fund [data-w124fadd]') }));
    ok('a board member sees the photos on the cards (and cannot edit; no hint to add a photo)', b.covers === 7 && !b.edit && b.band && !b.hint, b);
    ok('a resized poster that does not answer gives way to the original', /\/object\/public\/site-media\/events\/fundraising\/fundraisers-82568da6a122fd63b7b2\.png$/.test(b.stpat || '') && b.orig === null, b);
    ok('no page errors (board)', f.errs.length === 0, f.errs);
    await f.close();

    /* 6. the CRM's forms: the cover photo and the branded preview */
    f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(), wait: 4200, beforeGoto: pictures() });
    await spy(f);
    await f.hash('#crm/forms/1', 2600);
    await f.page.waitForTimeout(800);
    const formState = () => f.ev(() => {
      const box = document.querySelector('#crm .w168cov'), band = document.querySelector('#crm .w156pv .w156band');
      return { now: box && (box.querySelector('.w168now b') || {}).textContent, m: box && (box.querySelector('.w168now .m') || {}).textContent, useDef: !!(box && box.querySelector('.w168now [data-w168cov=""]')), thumbs: box ? box.querySelectorAll('.w168grid .w168th').length : 0, on: box ? [...box.querySelectorAll('.w168grid .w168th.on')].map(x => x.getAttribute('data-w168cov')) : [],
        band: band && { bg: band.style.backgroundImage, pos: band.style.backgroundPosition, lockup: (band.querySelector('.w168top img') || { getAttribute: () => null }).getAttribute('src'), star: !!band.querySelector('.w168star'), ey: (band.querySelector('.w168ey') || {}).textContent, t: (band.querySelector('.w156t') || {}).textContent } };
    });
    b = await formState();
    ok('a form without its own cover shows the default for its kind (a volunteer form: two volunteers plating)', b.now === 'Two volunteers plating food, autumn 2024' && b.m === 'The default for a volunteer form' && !b.useDef && b.on.join() === '9', b);
    ok('the picker lists the ready landscape photos of the Photo library', b.thumbs === 17, b.thumbs);
    ok('the preview opens like the public page: the photo, the logo, a gold star, what it is for and the title', b.band && /photos\/web\/2024-10-autumn-volunteers-plating\.jpg/.test(b.band.bg) && b.band.pos === '42% 45%' && /brand\/logo-lockup-cream-600\.png$/.test(b.band.lockup) && b.band.star && b.band.ey === 'Volunteer with us' && b.band.t === 'Volunteer with Welfare Avenue', b.band);
    if (SHOTS) { await f.ev(() => document.querySelector('#crm .w168cov').scrollIntoView({ block: 'center' })); await f.page.waitForTimeout(400); await f.page.screenshot({ path: SHOTS + '/w168_form_editor.png' }); }
    await click(f, '#crm .w168grid [data-w168cov="58"]'); await f.page.waitForTimeout(500);
    b = await formState();
    ok('choosing a photo: Chosen for this form, Use the default, and the preview follows', b.now === 'The crew behind the table, October 2023' && b.m === 'Chosen for this form' && b.useDef && b.on.join() === '58' && /2023-10-autumn-crew-behind-the-table\.jpg/.test(b.band.bg), b);
    await f.ev(() => { const el = document.querySelector('#crm [data-w156k="title"]'); el.value = 'Serve with us'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await f.page.waitForTimeout(700);
    b = await formState();
    ok('the preview\'s title follows the typing', b.band && b.band.t === 'Serve with us', b.band);
    await f.ev(() => { const el = document.querySelector('#crm [data-w156k="lang"]'); el.value = 'fr'; el.dispatchEvent(new Event('change', { bubbles: true })); });
    await f.page.waitForTimeout(600);
    b = await formState();
    ok('in French it says Bénévolat', b.band && b.band.ey === 'Bénévolat', b.band);
    await click(f, '#crm [data-w156save]'); await f.page.waitForTimeout(1200);
    b = await f.ev(() => window.__ins.filter(x => x.t === 'crm_forms' && x.op === 'update').pop());
    ok('Save writes the cover with the form', b && b.p.cover_photo_id === 58 && b.p.title === 'Serve with us' && b.p.lang === 'fr', b && b.p);
    await click(f, '#crm .w168now [data-w168cov=""]'); await f.page.waitForTimeout(500);
    b = await formState();
    ok('Use the default goes back to the kind\'s photo', b.m === 'The default for a volunteer form' && b.on.join() === '9' && !b.useDef, b);
    await f.hash('#crm/forms/3', 1800);
    b = await formState();
    ok('the newsletter form shows its own cover (salads and grapes) and says Stay in touch', b.now === 'Salads and grapes ready for a serving' && b.m === 'Chosen for this form' && b.band && b.band.ey === 'Stay in touch', b);
    ok('no page errors (forms)', f.errs.length === 0, f.errs);
    await f.close();

    /* 7. the leads' card shows the new person's photo (from the Hub's storage only) */
    const LIVE = {}; JSON.parse(fs.readFileSync(SP + 'fx166.json', 'utf8')).forEach(r => { LIVE[r.k] = r.v; });
    const view = JSON.parse(JSON.stringify(LIVE.lead_view_amanda));
    view.people[0].avatar_url = ST + 'avatars/slack/test-alyx.jpg';
    const other = JSON.parse(JSON.stringify(view.people[0])); other.onboarding_id = 99; other.member_id = 999; other.name = 'Test Person'; other.avatar_url = 'https://example.com/x.jpg'; view.people.push(other);
    f = await fresh(browser, { who: 'leader', width: 1366, hash: '#mypage', fixture: fx(), wait: 5000, rpcs: { onboarding_lead_view: view } });
    await f.page.waitForTimeout(600);
    b = await f.ev(() => [...document.querySelectorAll('#w166lead .w166av')].map(a => ({ bg: a.style.background || a.style.backgroundImage, text: a.textContent })));
    ok('the leads\' card shows the person\'s photo from the Hub\'s storage; any other address gets the initials', b.length >= 2 && /avatars\/slack\/test-alyx\.jpg/.test(b[0].bg) && b[0].text === '' && !/example\.com/.test(b[1].bg) && b[1].text === 'TP', b);
    ok('no page errors (the leads\' card)', f.errs.length === 0, f.errs);
    await f.close();

    /* 8. on a phone */
    f = await fresh(browser, { who: 'admin', width: 390, hash: '#fundevents', fixture: fx(), wait: 5200, beforeGoto: pictures() });
    await f.page.waitForTimeout(800);
    await click(f, '#w124fund .w124fe[data-w124fund="13"]'); await f.page.waitForTimeout(700);
    b = await f.ev(() => { const h = document.querySelector('#w124sheet .w168hero'); const r = h.getBoundingClientRect(); const pane = document.querySelector('#w124sheet .pane'); return { h: Math.round(r.height), right: r.right, w: window.innerWidth, sw: document.documentElement.scrollWidth, paneSw: pane.scrollWidth, paneW: pane.clientWidth }; });
    ok('on a phone the event\'s page fits: a shorter photo, no sideways scroll', b.h === 160 && b.right <= b.w && b.sw <= b.w && b.paneSw <= b.paneW + 1, b);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/w168_event_phone.png' });
    await click(f, '#w124sheet .w168g'); await f.page.waitForTimeout(400);
    b = await f.ev(() => { const i = document.querySelector('#w168lb img'); const r = i.getBoundingClientRect(); return { right: r.right, w: window.innerWidth }; });
    ok('and a photo full size fits the screen', b.right <= b.w, b);
    ok('no page errors (phone)', f.errs.length === 0, f.errs);
    await f.close();
  } catch (e) { fail++; out.push('FAIL crashed: ' + (e && e.stack || e)); }
  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
