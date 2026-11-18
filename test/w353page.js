/* w353page.js: the send page (/o/<mgr token>?send) and the hire's simple waiting view, offline (onboard-link stubbed). Run: cd test && node w353page.js */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const PAGE = fs.readFileSync(path.join(__dirname, '..', 'build', 'o', 'index.html'), 'utf8');
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots_w353page');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('PASS ' + m); } else { fail++; console.log('FAIL ' + m); } };
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  for (const width of [390, 900]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const posts = [], errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    let sent = false;
    await page.route('**/*', async (route) => {
      const u = route.request().url();
      if (u.startsWith('https://hub.welfareavenue.com/o/')) return route.fulfill({ contentType: 'text/html', body: PAGE });
      if (u.includes('/functions/v1/onboard-link')) {
        if (route.request().method() === 'POST') { posts.push(JSON.parse(route.request().postData())); sent = true; return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, sent: true, kind: 'send' }) }); }
        const view = { kind: 'send', simple: true, name: 'Tanise St-Vil', role: 'Marketing Coordinator', accepted: true, status: sent ? 'running' : 'waiting', closed: false,
          sent_at: sent ? '2026-11-18T15:00:00Z' : null, sent_by: sent ? null : null, first_day: '2026-11-18', manager: 'Ian Odhiambo', owner: 'Steel MacDonald', from: 'steel.macdonald@welfareavenue.com',
          to: ['tanise@example.com', 'tanise.st-vil@welfareavenue.com'], access: [{ step: 'Roster profile', status: 'done' }, { step: 'Google account', status: 'done' }, { step: 'Hub access', status: 'done' }, { step: 'Google Groups', status: 'done' }, { step: 'Shared drives', status: 'hr_task' }] };
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(view) });
      }
      return route.fulfill({ status: 404, body: '' });
    });
    await page.goto('https://hub.welfareavenue.com/o/15.abcdefghijklmnopqrst?send');
    await page.waitForSelector('#send');
    const h1 = await page.textContent('h1');
    ok(/Send Tanise’s onboarding/.test(h1), width + ': heading');
    ok(await page.isVisible('#day'), width + ': first day picker');
    ok(/Shared drives \(to do by hand\)/.test(await page.textContent('#card')), width + ': access to do by hand shown');
    ok(/Ian Odhiambo and Steel MacDonald set up their first meeting/.test(await page.textContent('#card')), width + ': who sets up the meeting');
    await page.screenshot({ path: path.join(SHOTS, 'send-' + width + '.png'), fullPage: true });
    await page.dblclick('#send');
    await page.waitForSelector('#sent');
    ok(posts.length === 1 && posts[0].a === 'send' && /^\d{4}-\d{2}-\d{2}$/.test(posts[0].first_day), width + ': one POST with the first day, under a double click');
    ok(/Sent/.test(await page.textContent('h1')), width + ': sent page');
    await page.screenshot({ path: path.join(SHOTS, 'sent-' + width + '.png'), fullPage: true });
    const sw = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    ok(sw, width + ': no sideways scroll');
    const text = await page.textContent('body');
    ok(!/\bAI\b/.test(text) && !/—/.test(text), width + ': no AI, no em dash');
    ok(!errors.length, width + ': no script errors ' + errors.join(' '));
    await page.close();
  }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
