/* w161embed.js: the donation popup on welfareavenue.com (wave161c), offline. A stand-in for the website's donate page
   (https://welfareavenue.com/donate, served by route interception) has two Keela donate buttons exactly as the live site
   renders them, a stand-in for Keela's forms script that binds them the way Keela's does (an onclick property, re-bound by
   a page watcher), the site's analytics listener on .donate-btn, a data-wa-donate button and a link to the Hub's page, and
   loads build/give/embed.js from hub.welfareavenue.com. The Hub's page (build/give/index.html) is served with the /give
   policy from build/site/_headers, the donate function is stubbed, and Stripe.js is a stand-in. Checks: a Keela button opens
   our popup and not Keela's, while the analytics listener still hears the click; the page inside takes the embed layout
   (the photo beside the form, no band) and the popup follows its height; Stripe's form opens inside the popup; while a
   payment is open a click outside does not close it, Escape does; the close button returns focus to the button and the
   page scrolls again; the thank-you's Close closes the popup; the other two triggers open it too; another website cannot
   frame the page; on a phone the popup fills the screen and nothing scrolls sideways. Screenshots with SHOTS=<dir>. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PAGE = fs.readFileSync(path.join(__dirname, '..', 'build', 'give', 'index.html'), 'utf8');
const EMBED_JS = fs.readFileSync(path.join(__dirname, '..', 'build', 'give', 'embed.js'), 'utf8');
const EMBED_CSS = fs.readFileSync(path.join(__dirname, '..', 'build', 'give', 'embed.css'), 'utf8');
const HEADERS = fs.readFileSync(path.join(__dirname, '..', 'build', 'site', '_headers'), 'utf8').split('\n');
const GIVE_CSP = (HEADERS[HEADERS.indexOf('/give/*') + 1] || '').replace(/^\s*Content-Security-Policy:\s*/, '');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 600) : '')); } }

const ORG = { name: 'Welfare Avenue', address: 'Welfare Avenue, 8200 av Bloomfield, Montreal QC H3N 2H9', email: 'info@welfareavenue.com', charity: '713048502RR0001' };
const CFG = { mode: 'live', title: 'Give to Welfare Avenue', intro: 'Every gift keeps our student volunteers serving.', amounts: { once: [25, 50, 100, 250], monthly: [10, 20, 35, 50] },
  min: 5, max: 10000, designations: ['Where it is needed most'], fee: { on: true, percent: 2.9, fixed: 0.3 }, consent_label: 'Yes, send me news by email.',
  thanks: 'Thank you for standing with Welfare Avenue.', receipt_note: 'Welfare Avenue is a registered charity in Canada (713048502RR0001).', monthly_note: 'Write to info@welfareavenue.com.',
  org: ORG, token: '1790000000.abc', pay: 'embedded', stripe_pk: 'pk_live_FAKEFAKEFAKE1234' };
/* the website's donate page, as the live React app renders it, with Keela's popup mechanism and the analytics listener */
const SITE = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Donate</title>' +
  '<style>body{margin:0;font-family:Arial}nav{background:#2a0f3a;color:#fff;padding:20px}.keela-popup-button{background:#1f7a3a;color:#fff;border:0;padding:12px 28px;border-radius:999px;font-size:18px;margin:20px}section{height:1400px;padding:20px}</style>' +
  '<script>window.__keelaOpened = 0; window.__tracked = 0; window.KeelaForms = {};' +
  ' KeelaForms.initPopupForms = function () { for (const d of document.getElementsByClassName("keela-popup-button")) d.onclick = function () { window.__keelaOpened++; }; };' +
  ' new MutationObserver(function () { if (document.getElementsByClassName("keela-popup-button").length) KeelaForms.initPopupForms(); }).observe(document.documentElement, { childList: true, subtree: true });</script>' +
  '<script async src="https://hub.welfareavenue.com/give/embed.js"></script></head><body><nav>Home · Donate</nav><section><h1>OUR MISSION: FOOD, YOUTH ENGAGEMENT, &amp; COMMUNITY</h1>' +
  '<button class="keela-popup-button dbox-donation-button donate-btn" id="k1" data-src="https://give-can.keela.co/embed/ERKCBbEw2WicFxhch">Donate</button>' +
  '<button class="keela-popup-button dbox-donation-button donate-btn" id="k2" data-src="https://give-can.keela.co/embed/ERKCBbEw2WicFxhch">Donate</button>' +
  '<button id="wa" data-wa-donate>Give with the Hub</button> <a id="lnk" href="https://hub.welfareavenue.com/give">Give</a></section>' +
  '<script>KeelaForms.initPopupForms(); document.querySelectorAll(".donate-btn").forEach(function (a) { a.addEventListener("click", function () { window.__tracked++; }); });</script></body></html>';
const FAKE_STRIPE = "window.__stripe = { pk: null, secrets: [], mounts: 0 };" +
  "window.Stripe = function (pk) { window.__stripe.pk = pk; return { initEmbeddedCheckout: function (o) { return o.fetchClientSecret().then(function (sec) { window.__stripe.secrets.push(sec);" +
  " return { mount: function (sel) { window.__stripe.mounts++; document.querySelector(sel).innerHTML = '<div data-fake-stripe style=\"height:620px;border:1px dashed #999\">Stripe form stand-in</div>'; }, destroy: function () {} }; }); } }; };";

async function open(browser, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 860 } }, opts || {}));
  const page = await ctx.newPage();
  const errors = [], csp = [], calls = [], keela = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text().slice(0, 200)); });
  await ctx.route('https://welfareavenue.com/**', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: SITE }));
  await ctx.route('https://evil.example/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<iframe id="f" src="https://hub.welfareavenue.com/give/?embed=1" style="width:600px;height:500px"></iframe>' }));
  await ctx.route('https://give-can.keela.co/**', r => { keela.push(r.request().url()); return r.fulfill({ status: 200, contentType: 'text/html', body: 'keela' }); });
  await ctx.route('https://hub.welfareavenue.com/give/embed.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: EMBED_JS }));
  await ctx.route('https://hub.welfareavenue.com/give/embed.css', r => r.fulfill({ status: 200, contentType: 'text/css', body: EMBED_CSS }));
  await ctx.route(/^https:\/\/hub\.welfareavenue\.com\/give(\/(?!embed\.(js|css))[^?#]*)?([?#].*)?$/, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', headers: { 'Content-Security-Policy': GIVE_CSP }, body: PAGE }));
  await ctx.route('https://js.stripe.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_STRIPE }));
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('https://fonts.gstatic.com/**', r => r.fulfill({ status: 404, body: '' }));
  await ctx.route('https://zwnmulmnvopclzcvytce.supabase.co/storage/**', r => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#6a7"/></svg>' }));
  await ctx.route('https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/donate**', async r => {
    const req = r.request();
    const cors = { 'Access-Control-Allow-Origin': 'https://hub.welfareavenue.com', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    calls.push({ method: req.method(), body });
    let res = { body: CFG };
    if (body && body.action === 'checkout') res = { body: { client_secret: 'cs_live_SECRET_' + calls.filter(c => c.body && c.body.action === 'checkout').length } };
    if (body && body.action === 'thanks') res = { body: { ok: true, complete: true, paid: true, waiting: false, frequency: 'once', amount: 50, currency: 'CAD', first_name: 'Amara', designation: '', thanks: CFG.thanks, receipt_note: CFG.receipt_note, monthly_note: '', org: ORG } };
    await r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(res.body) });
  });
  await page.goto('https://welfareavenue.com/donate');
  await page.waitForTimeout(500);
  return { ctx, page, errors, csp, calls, keela };
}
const giveFrame = p => p.frames().find(f => /^https:\/\/hub\.welfareavenue\.com\/give/.test(f.url()));
const pop = p => p.evaluate(() => { const b = document.querySelector('.wa-dn-back'); if (!b) return null; const f = b.querySelector('iframe'); const r = b.querySelector('.wa-dn-box').getBoundingClientRect();
  return { src: f.getAttribute('src'), allow: f.getAttribute('allow'), fh: Math.round(f.getBoundingClientRect().height), bw: Math.round(r.width), bh: Math.round(r.height), wait: !!b.querySelector('.wa-dn-wait'), overflow: document.documentElement.style.overflow, focus: document.activeElement && (document.activeElement.className || document.activeElement.tagName) }; });
const shot = async (p, n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + '.png') }); };

(async () => {
  const browser = await chromium.launch();
  try {
    /* 1. a Keela donate button opens our popup, not Keela's */
    let f = await open(browser);
    await f.page.click('#k1');
    await f.page.waitForSelector('.wa-dn-back iframe', { timeout: 5000 }).catch(() => {});
    await f.page.waitForFunction(() => !document.querySelector('.wa-dn-wait'), null, { timeout: 8000 }).catch(() => {});
    let st = await pop(f.page);
    let site = await f.page.evaluate(() => ({ keela: window.__keelaOpened, tracked: window.__tracked }));
    ok('a Keela donate button opens the Hub’s popup (the donation page with ?embed=1, payments allowed), not Keela’s', !!st && st.src === 'https://hub.welfareavenue.com/give/?embed=1' && /payment/.test(st.allow) && site.keela === 0 && f.keela.length === 0, { st, site, keela: f.keela });
    ok('the site’s own click listener (analytics) still hears the click', site.tracked === 1, site);
    let fr = giveFrame(f.page);
    let inside = fr ? await fr.evaluate(() => ({ embed: document.documentElement.classList.contains('embed'), band: getComputedStyle(document.querySelector('.band')).display, photo: getComputedStyle(document.getElementById('ephoto')).display,
      bg: document.getElementById('ephoto').style.backgroundImage, h1: (document.querySelector('h1') || {}).textContent, efoot: (document.getElementById('efoot') || {}).textContent || '' })) : null;
    ok('inside, the page takes the embed layout: the photo beside the form, no band, a short footer with the charity number', !!inside && inside.embed && inside.band === 'none' && inside.photo === 'block' && /2024-07-summer-volunteer-team/.test(inside.bg) &&
      /Give to Welfare Avenue/i.test(inside.h1) && /Registered charity 713048502RR0001/.test(inside.efoot), inside);
    ok('the popup follows the page’s height (no loading cover left, within the window), locks the page behind and holds the focus', !!st && !st.wait && st.fh >= 360 && st.fh <= 860 - 48 && st.overflow === 'hidden' && /wa-dn-x/.test(st.focus), st);
    await shot(f.page, 'embed_open');

    /* 2. Stripe's form inside the popup; outside clicks wait while it is open; Escape closes */
    await fr.click('#go');
    await fr.waitForSelector('#pay [data-fake-stripe]', { timeout: 8000 }).catch(() => {});
    const posts = f.calls.filter(c => c.body && c.body.action === 'checkout');
    ok('Continue opens Stripe’s form inside the popup (an embedded session)', posts.length === 1 && posts[0].body.ui === 'embedded' && !!(await fr.$('#pay [data-fake-stripe]')) && !!(await fr.$('#change')), posts.map(p => p.body));
    await f.page.waitForTimeout(800);
    st = await pop(f.page);
    ok('with the form open the popup grows to the window and the page inside scrolls', !!st && st.fh === 860 - 48, st);
    await shot(f.page, 'embed_paying');
    const tall = st.fh;
    await fr.click('#change'); await f.page.waitForTimeout(900);
    st = await pop(f.page);
    const formH = await fr.evaluate(() => Math.ceil(document.getElementById('app').getBoundingClientRect().height));
    ok('Change: the popup goes back to the form’s own height, up to the window (it does not keep the payment’s height)', !!st && Math.abs(st.fh - Math.min(formH, 860 - 48)) <= 2, { st, formH, tall });
    await fr.click('#go');
    await fr.waitForSelector('#pay [data-fake-stripe]', { timeout: 8000 }).catch(() => {});
    await f.page.waitForTimeout(500);
    await f.page.mouse.click(8, 8); await f.page.waitForTimeout(250);
    ok('while a payment is open, a click outside does not close the popup', !!(await pop(f.page)));
    await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(250);
    st = await f.page.evaluate(() => ({ open: !!document.querySelector('.wa-dn-back'), overflow: document.documentElement.style.overflow, focus: document.activeElement && document.activeElement.id }));
    ok('Escape closes it; the page scrolls again and the focus is back on the Donate button', !st.open && st.overflow === '' && st.focus === 'k1', st);

    /* 3. the close button; a click outside before paying; the other triggers */
    await f.page.click('#k2'); await f.page.waitForSelector('.wa-dn-x', { timeout: 5000 });
    await f.page.click('.wa-dn-x'); await f.page.waitForTimeout(200);
    st = await f.page.evaluate(() => ({ open: !!document.querySelector('.wa-dn-back'), focus: document.activeElement && document.activeElement.id, keela: window.__keelaOpened, tracked: window.__tracked }));
    ok('the close button closes it and gives the focus back; Keela stayed out of it', !st.open && st.focus === 'k2' && st.keela === 0 && st.tracked === 2, st);
    await f.page.click('#wa'); await f.page.waitForTimeout(600);
    await f.page.mouse.click(8, 8); await f.page.waitForTimeout(250);
    const byData = !(await pop(f.page));
    await f.page.click('#lnk'); await f.page.waitForTimeout(600);
    st = await pop(f.page);
    ok('a data-wa-donate button and a link to the Hub’s page open it too (and a click outside closes it before paying)', byData && !!st && f.page.url() === 'https://welfareavenue.com/donate', { byData, st, url: f.page.url() });

    /* 4. the thank-you inside the popup, and its Close */
    await f.page.waitForFunction(() => !document.querySelector('.wa-dn-wait'), null, { timeout: 8000 }).catch(() => {});
    fr = giveFrame(f.page);
    await fr.goto('https://hub.welfareavenue.com/give/thanks?session_id=cs_live_TESTTESTTEST');
    await fr.waitForSelector('#closepop', { timeout: 6000 }).catch(() => {});
    const thanks = await fr.evaluate(() => ({ text: document.body.innerText, embed: document.documentElement.classList.contains('embed') }));
    ok('after the payment the thank-you shows inside the popup, with Close', thanks.embed && /Thank you, Amara!/i.test(thanks.text) && !!(await fr.$('#closepop')), thanks.text.slice(0, 200));
    await shot(f.page, 'embed_thanks');
    await fr.click('#closepop'); await f.page.waitForTimeout(250);
    ok('Close on the thank-you closes the popup', !(await pop(f.page)));
    ok('no page errors and nothing blocked by the policies (website and popup)', f.errors.length === 0 && f.csp.length === 0, { errors: f.errors, csp: f.csp });
    await f.ctx.close();

    /* 5. another website cannot frame the donation page */
    f = await open(browser);
    await f.page.goto('https://evil.example/');
    await f.page.waitForTimeout(1500);
    const blocked = await f.page.evaluate(() => { try { return !!document.getElementById('f').contentDocument; } catch (e) { return 'cross-origin'; } });
    const evilFrame = f.page.frames().find(x => x !== f.page.mainFrame());
    let rendered = false; try { rendered = evilFrame ? await evilFrame.evaluate(() => !!document.getElementById('app')) : false; } catch (e) { rendered = false; }
    ok('another website cannot show the donation page in a frame (frame-ancestors)', rendered === false && f.csp.some(m => /frame-ancestors/.test(m)), { rendered, blocked, url: evilFrame && evilFrame.url(), csp: f.csp.slice(0, 2) });
    await f.ctx.close();

    /* 6. the phone */
    f = await open(browser, { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
    await f.page.click('#k1');
    await f.page.waitForFunction(() => document.querySelector('.wa-dn-back') && !document.querySelector('.wa-dn-wait'), null, { timeout: 8000 }).catch(() => {});
    st = await pop(f.page);
    fr = giveFrame(f.page);
    const ph = fr ? await fr.evaluate(() => ({ photo: getComputedStyle(document.getElementById('ephoto')).display, sw: document.documentElement.scrollWidth, w: innerWidth })) : null;
    ok('phone: the popup fills the screen, the photo steps aside, nothing scrolls sideways', !!st && st.bw === 390 && st.fh === 780 && !!ph && ph.photo === 'none' && ph.sw <= ph.w + 1, { st, ph });
    await shot(f.page, 'embed_phone');
    ok('no page errors (phone)', f.errors.length === 0, f.errors);
    await f.ctx.close();
  } catch (e) { fail++; console.log('FAIL crashed: ' + (e && e.stack || e)); }
  await browser.close();
  console.log('\nw161embed: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
