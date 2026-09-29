/* w161page.js: the public donation page (build/give/index.html, wave161), offline. The page is served at
   https://hub.welfareavenue.com/give by route interception and the donate function is stubbed; Stripe is never reached (the
   checkout URL the stub returns is intercepted and answered with a blank page). Checks: while off, visitors are told online
   giving opens soon and ?preview=1 shows the page without taking a gift; live, it renders the amounts for once and monthly,
   the card fee is worked out as the function does it, an amount below the minimum or a tribute without a name is caught
   before anything is sent, the checkout request carries the choices (and the hidden field empty) and only after the token is
   a few seconds old, the page goes to the URL the function answers, the server's field errors come back, a refused or
   failed checkout says no payment was made, a cancelled checkout says so, the thank-you shows the first name and the notes,
   and the phone layout holds. wave161b: every load is served with the /give Content-Security-Policy from build/site/_headers
   (a violation fails the test); with pay 'embedded' the page preloads Stripe.js (a stand-in served at js.stripe.com/v3), asks
   for an embedded session, mounts Stripe's form in place with the publishable key and the client secret and stays on the
   site; Change destroys it and brings the choices back as they were; if Stripe.js cannot load, the page falls back to
   Stripe's hosted page; the embedded view fits a phone. Screenshots with SHOTS=<dir>. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PAGE = fs.readFileSync(path.join(__dirname, '..', 'build', 'give', 'index.html'), 'utf8');
/* the policy Netlify sends for /give/* (build/site/_headers) */
const HEADERS = fs.readFileSync(path.join(__dirname, '..', 'build', 'site', '_headers'), 'utf8').split('\n');
const GIVE_CSP = (HEADERS[HEADERS.indexOf('/give/*') + 1] || '').replace(/^\s*Content-Security-Policy:\s*/, '');
/* a stand-in for Stripe.js v3: records the key, the client secret, mounts and destroys, and draws a placeholder */
const FAKE_STRIPE = "window.__stripe = { pk: null, secrets: [], mounts: 0, destroyed: 0 };" +
  "window.Stripe = function (pk) { window.__stripe.pk = pk; return { initEmbeddedCheckout: function (o) { return o.fetchClientSecret().then(function (sec) { window.__stripe.secrets.push(sec);" +
  " return { mount: function (sel) { window.__stripe.mounts++; document.querySelector(sel).innerHTML = '<div data-fake-stripe style=\"height:420px;border:1px dashed #999\">Stripe form stand-in</div>'; }," +
  " destroy: function () { window.__stripe.destroyed++; var el = document.querySelector('#pay'); if (el) el.innerHTML = ''; } }; }); } }; };";
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 500) : '')); } }

const ORG = { name: 'Welfare Avenue', address: 'Welfare Avenue, 8200 av Bloomfield, Montreal QC H3N 2H9', email: 'info@welfareavenue.com', charity: '713048502RR0001' };
const CFG = (o) => Object.assign({ mode: 'live', title: 'Give to Welfare Avenue', intro: 'Every gift keeps our student volunteers serving.', amounts: { once: [25, 50, 100, 250], monthly: [10, 20, 35, 50] },
  min: 5, max: 10000, designations: ['Where it is needed most', 'Toronto'], fee: { on: true, percent: 2.9, fixed: 0.3 }, consent_label: 'Yes, send me news by email. I can unsubscribe at any time.',
  thanks: 'Thank you for standing with Welfare Avenue.', receipt_note: 'Welfare Avenue is a registered charity in Canada (713048502RR0001).', monthly_note: 'Write to info@welfareavenue.com to change it.', org: ORG, token: '1790000000.abc' }, o || {});

async function open(browser, url, handler, opts, how) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1100, height: 900 } }, opts || {}));
  const page = await ctx.newPage();
  const calls = [], errors = [], csp = [], stripeJs = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text().slice(0, 200)); });
  await page.route('https://hub.welfareavenue.com/give**', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', headers: { 'Content-Security-Policy': GIVE_CSP }, body: PAGE }));
  await page.route('https://js.stripe.com/**', r => { stripeJs.push(r.request().url()); return (how && how.stripe === 'fake') ? r.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_STRIPE }) : r.abort(); });
  await page.route('https://checkout.stripe.com/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>stripe stand-in</p>' }));
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', r => r.fulfill({ status: 404, body: '' }));
  await page.route('https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/donate**', async r => {
    const req = r.request();
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': 'https://hub.welfareavenue.com', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST' } });
    const call = { method: req.method(), at: Date.now(), body: req.postData() ? JSON.parse(req.postData()) : null, auth: req.headers().authorization || '' };
    calls.push(call);
    const res = await handler(call, calls);
    await r.fulfill({ status: res.status || 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': 'https://hub.welfareavenue.com' }, body: JSON.stringify(res.body) });
  });
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForTimeout(400);
  return { ctx, page, calls, errors, t0, csp, stripeJs };
}
const text = p => p.evaluate(() => document.body.innerText);
const shot = async (p, n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + '.png'), fullPage: true }); };

(async () => {
  const browser = await chromium.launch();
  try {
    /* 1. off: visitors are told it opens soon; ?preview=1 shows it but takes no gift */
    let f = await open(browser, 'https://hub.welfareavenue.com/give', c => ({ body: CFG({ mode: 'off' }) }));
    let t = await text(f.page);
    ok('off: online giving opens soon, with the email to give today', /Online giving opens soon/i.test(t) && /info@welfareavenue\.com/.test(t) && !(await f.page.$('#give')), t.slice(0, 300));
    ok('the footer names the charity and its number', /Registered charity 713048502RR0001/.test(t) && /8200 av Bloomfield/.test(t), t.slice(-400));
    await f.ctx.close();
    f = await open(browser, 'https://hub.welfareavenue.com/give?preview=1', c => ({ body: CFG({ mode: 'off' }) }));
    await f.page.click('#go'); await f.page.waitForTimeout(300);
    t = await text(f.page);
    ok('preview: the page shows, says it is a preview, and sends nothing', /Preview\./.test(t) && /cannot take a gift until an admin puts it live/.test(t) && f.calls.filter(c => c.method === 'POST').length === 0, t.slice(0, 400));
    await shot(f.page, 'give_preview');
    await f.ctx.close();

    /* 2. live: amounts, the card fee, the checks before sending, then the checkout */
    f = await open(browser, 'https://hub.welfareavenue.com/give', (c) => {
      if (c.method === 'GET') return { body: CFG() };
      return { body: { url: 'https://checkout.stripe.com/c/pay/cs_live_TEST' } };
    });
    t = await text(f.page);
    let st = await f.page.evaluate(() => ({ amts: [...document.querySelectorAll('.amt')].map(b => b.innerText.replace(/\s+/g, ' ') + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')),
      freq: [...document.querySelectorAll('[data-freq]')].map(b => b.innerText + ':' + b.getAttribute('aria-checked')), des: [...document.querySelectorAll('#des option')].map(o => o.textContent),
      total: document.getElementById('tot').innerText, cover: document.getElementById('cover').nextElementSibling.innerText }));
    ok('live: once by default, four amounts with $50 chosen, where it goes, the total', st.freq.join(',') === 'Give once:true,Give monthly:false' && st.amts.join(',') === '$25,$50*,$100,$250' &&
      st.des.join('|') === 'Where it is needed most|Toronto' && st.total === '$50.00', st);
    ok('the card fee offer is worked out as the function does it ($1.81 on $50)', /Add \$1\.81 to help cover the card fee/.test(st.cover), st.cover);
    await f.page.click('#cover'); await f.page.waitForTimeout(100);
    ok('covering the fee makes it $51.81', (await f.page.textContent('#tot')) === '$51.81');
    await f.page.click('[data-freq="monthly"]'); await f.page.waitForTimeout(150);
    st = await f.page.evaluate(() => ({ amts: [...document.querySelectorAll('.amt')].map(b => b.innerText.replace(/\s+/g, ' ') + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')), total: document.getElementById('tot').innerText.replace(/\s+/g, ' ') }));
    ok('monthly: its own amounts ($20 chosen), a month, the fee still covered', st.amts.join(',') === '$10 a month,$20 a month*,$35 a month,$50 a month' && st.total === '$20.91 a month', st);
    await f.page.fill('#other', '3'); await f.page.waitForTimeout(80);
    await f.page.click('#go'); await f.page.waitForTimeout(250);
    t = await text(f.page);
    ok('an amount below the minimum is caught, nothing sent', /The smallest gift online is \$5\./.test(t) && f.calls.filter(c => c.method === 'POST').length === 0, t.slice(0, 600));
    await f.page.fill('#other', '42.50'); await f.page.check('#trib'); await f.page.waitForTimeout(100);
    await f.page.click('#go'); await f.page.waitForTimeout(250);
    t = await text(f.page);
    ok('a tribute without a name is caught, nothing sent', /Whose name should we record\?/.test(t) && f.calls.filter(c => c.method === 'POST').length === 0);
    await f.page.check('input[name="tk"][value="memory"]'); await f.page.fill('#tname', '  Nan  Test ');
    await f.page.selectOption('#des', 'Toronto'); await f.page.check('#consent');
    await f.page.click('#go');
    await f.page.waitForURL(/checkout\.stripe\.com/, { timeout: 8000 }).catch(() => {});
    const post = f.calls.filter(c => c.method === 'POST')[0] || {};
    const b = post.body || {};
    ok('the checkout carries the choices: monthly, $42.50, Toronto, in memory of the name, the fee, the news box, the hidden field empty',
      b.action === 'checkout' && b.frequency === 'monthly' && b.amount === 42.5 && b.designation === 'Toronto' && b.tribute_kind === 'memory' && b.tribute_name === 'Nan  Test' &&
      b.fee_cover === true && b.consent === true && b.hp === '' && b.token === '1790000000.abc' && /^Bearer /.test(post.auth), b);
    ok('sent only once the token was at least 3 seconds old', post.at - f.t0 >= 3000, { waited: post.at - f.t0 });
    ok('then on to the URL the function answered (Stripe)', /checkout\.stripe\.com\/c\/pay\/cs_live_TEST/.test(f.page.url()), f.page.url());
    ok('no page errors (checkout)', f.errors.length === 0, f.errors);
    ok('the /give policy blocks nothing the page needs', GIVE_CSP.indexOf('https://js.stripe.com') > 0 && f.csp.length === 0 && f.stripeJs.length === 0, { csp: f.csp, stripeJs: f.stripeJs });
    await f.ctx.close();

    /* 3. the server's field errors, a refusal and a failure */
    let n = 0;
    f = await open(browser, 'https://hub.welfareavenue.com/give', (c) => {
      if (c.method === 'GET') return { body: CFG() };
      n++;
      if (n === 1) return { status: 400, body: { error: 'invalid', fields: { amount: 'For a gift above $10000, please write to info@welfareavenue.com.' } } };
      if (n === 2) return { status: 429, body: { error: 'rate' } };
      return { status: 502, body: { error: 'stripe' } };
    });
    await f.page.waitForTimeout(3000);
    await f.page.click('#go'); await f.page.waitForTimeout(700);
    t = await text(f.page);
    ok('the function’s field error shows under the amount', /For a gift above \$10000/.test(t), t.slice(0, 500));
    await f.page.click('[data-amt="100"]'); await f.page.click('#go'); await f.page.waitForTimeout(700);
    ok('too many tries: wait and try again', /Too many tries from here/.test(await text(f.page)));
    await f.page.click('#go'); await f.page.waitForTimeout(700);
    ok('a failed checkout says no payment was made', /no payment was made/i.test(await text(f.page)));
    await f.ctx.close();

    /* 4. back from Stripe without paying, and the thank-you */
    f = await open(browser, 'https://hub.welfareavenue.com/give?cancelled=1', c => ({ body: CFG() }));
    ok('cancelled: no payment was made, try again', /No payment was made\. You can change anything below and try again\./.test(await text(f.page)));
    await f.ctx.close();
    f = await open(browser, 'https://hub.welfareavenue.com/give/thanks?session_id=cs_live_TESTTESTTEST', (c) => {
      if (c.method === 'POST' && c.body.action === 'thanks') return { body: { ok: true, complete: true, paid: true, waiting: false, frequency: 'monthly', amount: 20.91, currency: 'CAD', first_name: 'Amara',
        designation: 'Toronto', thanks: 'Thank you for standing with Welfare Avenue.', receipt_note: 'Welfare Avenue is a registered charity in Canada (713048502RR0001).', monthly_note: 'Write to info@welfareavenue.com to change it.', org: ORG } };
      return { status: 404, body: {} };
    });
    await f.page.waitForTimeout(400);
    t = await text(f.page);
    ok('thank-you: the name, the monthly gift, the words and the notes', /Thank you, Amara!/i.test(t) && /Your monthly gift of \$20\.91 has started\./.test(t) && /standing with Welfare Avenue/.test(t) &&
      /registered charity in Canada/.test(t) && /Write to info@welfareavenue\.com to change it\./.test(t) && f.calls[0].body.session_id === 'cs_live_TESTTESTTEST', t.slice(0, 500));
    await shot(f.page, 'give_thanks');
    await f.ctx.close();
    f = await open(browser, 'https://hub.welfareavenue.com/give/thanks?session_id=cs_live_NOPENOPENOPE', c => ({ status: 404, body: { error: 'not_found' } }));
    await f.page.waitForTimeout(300);
    ok('an unknown session: not found, without claiming a gift', /We could not find this gift/i.test(await text(f.page)));
    await f.ctx.close();

    /* 6. Stripe's form inside the page (pay 'embedded'): the donor stays on the site */
    const PK = 'pk_live_FAKEFAKEFAKE1234';
    f = await open(browser, 'https://hub.welfareavenue.com/give', (c, calls) => {
      if (c.method === 'GET') return { body: CFG({ pay: 'embedded', stripe_pk: PK }) };
      return { body: { client_secret: 'cs_live_SECRET_' + calls.filter(x => x.method === 'POST').length } };
    }, null, { stripe: 'fake' });
    t = await text(f.page);
    ok('embedded: the page says Stripe’s form opens right here, and Stripe.js loads early from js.stripe.com/v3', /Stripe’s secure payment form opens right here/.test(t) && f.stripeJs.some(u => /^https:\/\/js\.stripe\.com\/v3\/?$/.test(u)), { stripeJs: f.stripeJs, t: t.slice(-500) });
    await f.page.click('#go');
    await f.page.waitForSelector('#pay [data-fake-stripe]', { timeout: 8000 }).catch(() => {});
    let posts = f.calls.filter(c => c.method === 'POST');
    let sp = await f.page.evaluate(() => window.__stripe || {});
    ok('embedded: the checkout asks for Stripe’s form in place (once, $50)', posts.length === 1 && posts[0].body.ui === 'embedded' && posts[0].body.frequency === 'once' && posts[0].body.amount === 50, posts.map(p => p.body));
    ok('Stripe’s form is mounted in the page with the publishable key and the session’s client secret', sp.pk === PK && (sp.secrets || []).join() === 'cs_live_SECRET_1' && sp.mounts === 1, sp);
    t = await text(f.page);
    ok('the donor stays on the site, with the gift in one line and Change', f.page.url() === 'https://hub.welfareavenue.com/give' && /Your gift\s*\$50\.00/.test(t) && !!(await f.page.$('#change')) && /Welfare Avenue never sees your card number/.test(t), { url: f.page.url(), t: t.slice(0, 400) });
    await shot(f.page, 'give_embedded');
    await f.page.click('#change'); await f.page.waitForTimeout(200);
    st = await f.page.evaluate(() => ({ destroyed: (window.__stripe || {}).destroyed, form: !!document.getElementById('give'), fifty: (document.querySelector('[data-amt="50"]') || {}).getAttribute && document.querySelector('[data-amt="50"]').getAttribute('aria-pressed'), focus: document.activeElement && document.activeElement.id }));
    ok('Change: Stripe’s form is destroyed and the choices come back as they were', st.destroyed === 1 && st.form && st.fifty === 'true' && st.focus === 'go', st);
    await f.page.click('[data-freq="monthly"]'); await f.page.click('#cover'); await f.page.waitForTimeout(100);
    await f.page.click('#go');
    await f.page.waitForFunction(() => (window.__stripe || {}).mounts === 2, null, { timeout: 8000 }).catch(() => {});
    posts = f.calls.filter(c => c.method === 'POST');
    t = await text(f.page);
    ok('a second try makes a new embedded session: monthly $20 with the fee, $20.91 a month', posts.length === 2 && posts[1].body.ui === 'embedded' && posts[1].body.frequency === 'monthly' && posts[1].body.fee_cover === true &&
      /Your monthly gift\s*\$20\.91\s*a month/.test(t) && /includes \$0\.91 for the card fee/.test(t) && (await f.page.evaluate(() => window.__stripe.secrets.join())) === 'cs_live_SECRET_1,cs_live_SECRET_2', { posts: posts.map(p => p.body), t: t.slice(0, 400) });
    ok('no page errors and nothing blocked by the policy (embedded)', f.errors.length === 0 && f.csp.length === 0, { errors: f.errors, csp: f.csp });
    await f.ctx.close();

    /* 7. Stripe.js blocked (an extension, a network): the page falls back to Stripe's hosted page */
    f = await open(browser, 'https://hub.welfareavenue.com/give', (c) => {
      if (c.method === 'GET') return { body: CFG({ pay: 'embedded', stripe_pk: PK }) };
      return c.body.ui === 'embedded' ? { body: { client_secret: 'cs_live_SECRET_X' } } : { body: { url: 'https://checkout.stripe.com/c/pay/cs_live_FALLBACK' } };
    }, null, { stripe: 'block' });
    await f.page.click('#go');
    await f.page.waitForURL(/checkout\.stripe\.com/, { timeout: 9000 }).catch(() => {});
    posts = f.calls.filter(c => c.method === 'POST');
    ok('Stripe.js cannot load: a hosted session is asked for and the donor goes to Stripe’s page', posts.length === 2 && posts[0].body.ui === 'embedded' && posts[1].body.ui === undefined &&
      posts[1].body.amount === 50 && /cs_live_FALLBACK/.test(f.page.url()), { posts: posts.map(p => p.body), url: f.page.url() });
    await f.ctx.close();

    /* 8. the embedded view on a phone */
    f = await open(browser, 'https://hub.welfareavenue.com/give', (c) => (c.method === 'GET' ? { body: CFG({ pay: 'embedded', stripe_pk: PK }) } : { body: { client_secret: 'cs_live_SECRET_P' } }),
      { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }, { stripe: 'fake' });
    await f.page.click('#go');
    await f.page.waitForSelector('#pay [data-fake-stripe]', { timeout: 8000 }).catch(() => {});
    const pv = await f.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, box: Math.round(document.getElementById('pay').getBoundingClientRect().width) }));
    ok('phone: Stripe’s form gets the width it needs (at least 320 px) and nothing scrolls sideways', pv.box >= 320 && pv.sw <= pv.w + 1, pv);
    await shot(f.page, 'give_embedded_phone');
    await f.ctx.close();

    /* 5. the phone */
    f = await open(browser, 'https://hub.welfareavenue.com/give', c => ({ body: CFG() }), { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const ph = await f.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, cols: getComputedStyle(document.querySelector('.amts')).gridTemplateColumns.split(' ').length }));
    ok('phone: two amounts a row and nothing scrolls sideways', ph.cols === 2 && ph.sw <= ph.w + 1, ph);
    await shot(f.page, 'give_phone');
    ok('no page errors (phone)', f.errors.length === 0, f.errors);
    await f.ctx.close();
  } catch (e) { fail++; console.log('FAIL crashed: ' + (e && e.stack || e)); }
  await browser.close();
  console.log('\nw161page: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
