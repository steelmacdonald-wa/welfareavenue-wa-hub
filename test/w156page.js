/* w156page.js: the public form page (build/f/index.html, wave156), offline. The page is served at
   https://hub.welfareavenue.com/f/<slug> by route interception and the form-submit function is stubbed: a published
   form renders (questions, choices, the serving dates, the consent box and the charity's address), a missing answer is
   caught before anything is sent, the server's field errors come back under the right question, a hidden-field check
   is sent empty, a success shows the thank-you, an expired token reloads and keeps the answers, a draft shows "not
   available", a closed form says so, and the phone layout holds. Screenshots with SHOTS=<dir>. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PAGE = fs.readFileSync(path.join(__dirname, '..', 'build', 'f', 'index.html'), 'utf8');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 400) : '')); } }

const FORM = {
  slug: 'volunteer', title: 'Volunteer with Welfare Avenue', lang: 'en', kind: 'volunteer', thank_you: 'Thank you for signing up to serve.',
  intro: 'Welfare Avenue serves free, home-cooked meals in Montreal.',
  questions: [
    { id: 'first_name', type: 'text', label: 'First name', required: true, help: '', options: [] },
    { id: 'email', type: 'email', label: 'Email', required: true, help: '', options: [] },
    { id: 'phone', type: 'phone', label: 'Phone', required: true, help: 'We text the week of a serving.', options: [] },
    { id: 'roles', type: 'multi', label: 'How would you like to help?', required: true, help: '', options: [{ v: 'server', l: 'Serving food' }, { v: 'cook', l: 'Cooking' }] },
    { id: 'dates', type: 'serving_dates', label: 'Which Sundays can you serve?', required: false, help: '', options: [{ v: '23', l: 'Sunday 4 October 2026' }, { v: '24', l: 'Sunday 18 October 2026' }] },
    { id: 'photos', type: 'yes_no', label: 'Photos on social media?', required: true, help: '', options: [] },
    { id: 'comments', type: 'long_text', label: 'Anything else?', required: false, help: '', options: [] }
  ],
  consent: { ask: true, required: false, label: 'Yes, Welfare Avenue can email me news. I can unsubscribe at any time.' }
};
const ORG = { name: 'Welfare Avenue', address: 'Welfare Avenue, 8200 av Bloomfield, Montreal QC H3N 2H9', email: 'info@welfareavenue.com', charity: '713048502RR0001' };

async function open(browser, slug, handler, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1100, height: 900 } }, opts || {}));
  const page = await ctx.newPage();
  const calls = [];
  page.on('pageerror', e => calls.push({ pageerror: String(e) }));
  await page.route('https://hub.welfareavenue.com/f/**', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PAGE }));
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', r => r.fulfill({ status: 404, body: '' }));
  await page.route('https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/form-submit**', async r => {
    const req = r.request();
    const call = { method: req.method(), url: req.url(), headers: req.headers(), body: req.postData() ? JSON.parse(req.postData()) : null };
    calls.push(call);
    const res = await handler(call, calls);
    await r.fulfill({ status: res.status || 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': 'https://hub.welfareavenue.com' }, body: JSON.stringify(res.body) });
  });
  await page.goto('https://hub.welfareavenue.com/f/' + slug);
  return { ctx, page, calls };
}
const text = p => p.evaluate(() => document.body.innerText);

(async () => {
  const browser = await chromium.launch();
  try {
    /* 1. a published form, a missing answer, the server's field error, then a success */
    let posts = 0;
    let f = await open(browser, 'volunteer', (c) => {
      if (c.method === 'GET') return { body: { form: FORM, org: ORG, token: '1790000000.abc' } };
      posts++;
      if (posts === 1) return { status: 400, body: { error: 'invalid', fields: { phone: 'Please enter a phone number we can reach.' } } };
      return { body: { ok: true, thank_you: 'Thank you for signing up to serve.' } };
    });
    await f.page.waitForSelector('#waf');
    let b = await f.page.evaluate(() => ({ h1: document.querySelector('h1').innerText, q: document.querySelectorAll('#waf [data-q]').length, dates: document.querySelectorAll('input[name="dates"]').length,
      consent: !!document.querySelector('input[name="_consent"]'), consentChecked: document.querySelector('input[name="_consent"]').checked, hp: !!document.querySelector('.hp input[name="website"]'),
      title: document.title, lockup: !!document.querySelector('svg.lockup'), foot: document.getElementById('foot').innerText }));
    ok('the published form renders: title, 7 questions, two dates, the consent box unticked, the hidden field, the lockup', b.h1.toUpperCase().indexOf('VOLUNTEER WITH') >= 0 && b.q === 8 && b.dates === 2 && b.consent && !b.consentChecked && b.hp && b.lockup, b);
    ok('the footer names the charity, its number, the address and the email', /713048502RR0001/.test(b.foot) && /8200 av Bloomfield/.test(b.foot) && /info@welfareavenue.com/.test(b.foot), b.foot);
    ok('the GET sends the publishable key and the slug', f.calls[0].method === 'GET' && /slug=volunteer/.test(f.calls[0].url) && /^Bearer /.test(f.calls[0].headers.authorization || '') && !!f.calls[0].headers.apikey);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/form_desktop.png', fullPage: true });
    await f.page.click('#send');
    b = await f.page.evaluate(() => ({ errs: Array.from(document.querySelectorAll('.err')).map(e => e.closest('[data-q]').getAttribute('data-q')), banner: (document.querySelector('.banner') || {}).innerText, focus: document.activeElement && document.activeElement.id }));
    ok('an empty send is caught on the page: first name, email, phone, roles and photos marked, focus on the first', JSON.stringify(b.errs) === JSON.stringify(['first_name', 'email', 'phone', 'roles', 'photos']) && /check the answers/.test(b.banner || '') && b.focus === 'q_first_name', b);
    ok('nothing was sent for the empty form', f.calls.filter(c => c.method === 'POST').length === 0);
    await f.page.fill('#q_first_name', 'Amara');
    await f.page.fill('#q_email', 'amara@example.com');
    await f.page.fill('#q_phone', '514 555 0100');
    await f.page.check('input[name="roles"][value="cook"]');
    await f.page.check('input[name="dates"][value="24"]');
    await f.page.check('input[name="photos"][value="yes"]');
    await f.page.fill('#q_comments', 'Happy to help');
    await f.page.check('input[name="_consent"]');
    await f.page.click('#send');
    await f.page.waitForFunction(() => document.querySelector('.err'));
    b = await f.page.evaluate(() => ({ errs: Array.from(document.querySelectorAll('.err')).map(e => e.closest('[data-q]').getAttribute('data-q')), kept: document.getElementById('q_first_name').value, consent: document.querySelector('input[name="_consent"]').checked, cook: document.querySelector('input[name="roles"][value="cook"]').checked }));
    ok('the server\'s field error comes back under the phone, and the answers are kept', JSON.stringify(b.errs) === JSON.stringify(['phone']) && b.kept === 'Amara' && b.consent && b.cook, b);
    const post = f.calls.filter(c => c.method === 'POST')[0];
    ok('the POST carries the slug, the token, the answers by question id, the consent and an empty hidden field', post && post.body.slug === 'volunteer' && post.body.token === '1790000000.abc' && post.body.consent === true && post.body.hp === '' &&
      post.body.answers.first_name === 'Amara' && JSON.stringify(post.body.answers.roles) === '["cook"]' && JSON.stringify(post.body.answers.dates) === '["24"]' && post.body.answers.photos === 'yes', post && post.body);
    await f.page.fill('#q_phone', '514 555 0101');
    await f.page.click('#send');
    await f.page.waitForSelector('.done');
    b = await f.page.evaluate(() => document.querySelector('.done').innerText);
    ok('a success shows the thank-you', /Thank you for signing up to serve/.test(b), b);
    ok('no page errors', !f.calls.some(c => c.pageerror), f.calls.filter(c => c.pageerror));
    await f.ctx.close();

    /* 2. an expired token: the page fetches a new one and keeps the answers */
    let gets = 0; posts = 0;
    f = await open(browser, 'volunteer', (c) => {
      if (c.method === 'GET') { gets++; return { body: { form: FORM, org: ORG, token: 'tok' + gets } }; }
      posts++;
      return posts === 1 ? { status: 400, body: { error: 'expired' } } : { body: { ok: true, thank_you: 'Thanks again.' } };
    });
    await f.page.waitForSelector('#waf');
    await f.page.fill('#q_first_name', 'Sam'); await f.page.fill('#q_email', 'sam@example.com'); await f.page.fill('#q_phone', '5145550102');
    await f.page.check('input[name="roles"][value="server"]'); await f.page.check('input[name="photos"][value="no"]');
    await f.page.click('#send');
    await f.page.waitForFunction(() => /refreshed/.test((document.querySelector('.banner') || {}).innerText || ''));
    b = await f.page.evaluate(() => ({ kept: document.getElementById('q_first_name').value, server: document.querySelector('input[name="roles"][value="server"]').checked }));
    ok('an expired token reloads the form, says so and keeps the answers', gets === 2 && b.kept === 'Sam' && b.server, { gets, b });
    await f.page.click('#send');
    await f.page.waitForSelector('.done');
    const second = f.calls.filter(c => c.method === 'POST')[1];
    ok('the second send uses the new token', second && second.body.token === 'tok2', second && second.body);
    await f.ctx.close();

    /* 3. a draft or unknown form, and a closed one */
    f = await open(browser, 'newsletter', () => ({ status: 404, body: { error: 'not_found' } }));
    await f.page.waitForFunction(() => /not available/i.test(document.body.innerText));
    ok('a draft or unknown form shows "not available" and no form', !(await f.page.$('#waf')));
    await f.ctx.close();
    f = await open(browser, 'old-form', () => ({ body: { closed: true, title: 'Old form', lang: 'fr', org: ORG } }));
    await f.page.waitForFunction(() => /fermé/i.test(document.body.innerText));
    ok('a closed French form says so in French', /Ce formulaire est fermé/i.test(await text(f.page)) && (await f.page.evaluate(() => document.documentElement.lang)) === 'fr');
    await f.ctx.close();

    /* 4. the phone layout */
    f = await open(browser, 'volunteer', (c) => c.method === 'GET' ? { body: { form: FORM, org: ORG, token: 't' } } : { body: { ok: true } }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await f.page.waitForSelector('#waf');
    b = await f.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, btn: document.getElementById('send').getBoundingClientRect().height, inputH: document.getElementById('q_first_name').getBoundingClientRect().height }));
    ok('the phone layout has no sideways scroll and roomy controls', b.sw <= b.w && b.btn >= 44 && b.inputH >= 40, b);
    if (SHOTS) await f.page.screenshot({ path: SHOTS + '/form_phone.png', fullPage: true });
    await f.ctx.close();
  } catch (e) { fail++; console.log('FAIL crashed: ' + (e && e.stack || e)); }
  await browser.close();
  console.log('\nw156page: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
