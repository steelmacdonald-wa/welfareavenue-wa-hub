/* w239page: the /c/ page for waves 239 and 240: the Still in? screen (a pool token: Yes / Not any more, a note, the answer
   saved through wa239_pool_answer, the second screen, French), and a photographer's content brief and album (wave240).
   Served by route interception, the database stubbed. node test/w239page.js */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const html = fs.readFileSync(path.join(__dirname, '../build/c/index.html'), 'utf8');
const GUIDE = { expect_en: ['Read the content guide before the serving.', 'Photograph the team.'], expect_fr: ['Lisez le guide.'], bring_en: 'Your camera', arrive_en: 'At the spot',
  links: [{ url: 'https://drive.google.com/file/d/x/view', when: 'before', label_en: 'Content guide', label_fr: 'Guide' }, { url: 'https://photos.app.goo.gl/EVENT123', when: 'after', label_en: 'Add your photos to the Google Photos album', label_fr: 'Ajouter vos photos' }] };
function photographer(withBrief) {
  return { ok: true, first: 'Pat', name: 'Pat Lens', role: 'photographer', role_en: 'Photographer', role_fr: 'Photographe', state: 'confirmed', confirmed_at: '2026-11-10T12:00:00Z', already: 'confirmed', event_date: '2026-11-15', location: 'Place Emile Gamelin', code: 'X', lang: 'en',
    opens_on: '2026-11-09', confirm_days: 7, details: {}, guide: GUIDE, events: [], photo: null, times: { start: '11:45', end: '14:15' }, start_time: '12:00',
    album_url: withBrief ? 'https://photos.app.goo.gl/EVENT123' : null,
    brief: withBrief ? { linkedin: 'Why does your company serve with us?', social: 'One word for today?', notes: 'A wide shot of the line\nThe team at the end', updated_by: 'ian.odhiambo@welfareavenue.com' } : null };
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const res = {}; let fails = 0;
  const ok = (n, c, g) => { res[n] = c ? 'ok' : 'FAIL ' + JSON.stringify(g); if (!c) fails++; };
  async function open(o) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage();
    const errs = [], sent = [];
    page.on('pageerror', e => errs.push(String(e)));
    if (o.lang) await page.addInitScript(l => { try { localStorage.setItem('wa_lang', l); } catch (e) {} }, o.lang);
    await page.route('**/*', route => {
      const u = route.request().url();
      if (u.startsWith('https://hub.test/c/')) return route.fulfill({ contentType: 'text/html', body: html });
      if (u.indexOf('/rpc/volunteer_confirm_get') >= 0) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(o.confirm || null) });
      if (u.indexOf('/rpc/volunteer_partner_get') >= 0) return route.fulfill({ contentType: 'application/json', body: 'null' });
      if (u.indexOf('/rpc/wa239_pool_get') >= 0) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(o.pool || null) });
      if (u.indexOf('/rpc/wa239_pool_answer') >= 0) { sent.push(JSON.parse(route.request().postData() || '{}')); return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, answer: sent[sent.length - 1].p.answer, changed: false }) }); }
      if (u.indexOf('/rpc/') >= 0) return route.fulfill({ contentType: 'application/json', body: 'null' });
      return route.abort();
    });
    await page.goto('https://hub.test/c/abcdef1234567890abcd');
    await page.waitForTimeout(1600);
    return { page, ctx, errs, sent };
  }
  const text = (o) => o.page.evaluate(() => document.getElementById('app').innerText.replace(/\s+/g, ' '));
  /* 1. the Still in? screen */
  let o = await open({ pool: { kind: 'pool', first: 'Sophia', role: 'photographer', role_en: 'Photographer', role_fr: 'Photographe', lang: 'en', answer: null } });
  let t = await text(o);
  ok('pool: the eyebrow and the greeting', (await o.page.evaluate(() => document.getElementById('ey').textContent)) === 'Still volunteering with us?' && /Hi Sophia!/i.test(t), t.slice(0, 200));
  ok('pool: says Welfare Avenue and the role', /signed up to volunteer with Welfare Avenue as a photographer/.test(t), t.slice(0, 300));
  ok('pool: Yes and Not any more, a note', (await o.page.evaluate(() => !!document.getElementById('plyes') && !!document.getElementById('plno') && !!document.getElementById('plnote'))));
  await o.page.fill('#plnote', 'Weekends only'); await o.page.click('#plyes'); await o.page.waitForTimeout(700);
  ok('pool: the answer is sent with the note', o.sent.length === 1 && o.sent[0].p_token === 'abcdef1234567890abcd' && o.sent[0].p.answer === 'yes' && o.sent[0].p.note === 'Weekends only' && o.sent[0].p.via === 'page', o.sent);
  t = await text(o);
  ok('pool: the thank-you and a way to change the answer', /Wonderful, Sophia!/.test(t) && /Changed your mind\?/.test(t) && (await o.page.evaluate(() => !!document.getElementById('plno'))), t.slice(0, 300));
  await o.page.click('#plno'); await o.page.waitForTimeout(600);
  ok('pool: changing the answer sends no', o.sent.length === 2 && o.sent[1].p.answer === 'no', o.sent);
  ok('pool: no page errors', o.errs.length === 0, o.errs);
  await o.ctx.close();
  /* 2. French, already answered no */
  o = await open({ lang: 'fr', pool: { kind: 'pool', first: 'Esther', role: 'server', role_en: 'Server', role_fr: 'Serveur', lang: 'fr', answer: 'no', answered_at: '2026-10-10T12:00:00Z' } });
  t = await text(o);
  ok('pool fr: the answered screen in French', /Bonjour Esther!/i.test(t) && /Merci de nous l’avoir dit, Esther/.test(t) && /Vous avez changé d’avis\?/.test(t) && (await o.page.evaluate(() => !!document.getElementById('plyes'))), t.slice(0, 300));
  await o.ctx.close();
  /* 3. a photographer's page with the album and the brief */
  o = await open({ confirm: photographer(true) });
  t = await text(o);
  ok('brief: the heading and the three parts', /Your content brief for this serving/i.test(t) && /Questions for LinkedIn/i.test(t) && /Why does your company serve with us\?/.test(t) && /Questions for Instagram and TikTok/i.test(t) && /One word for today\?/.test(t) && /Shots to get and notes/i.test(t) && /A wide shot of the line/.test(t), t.slice(0, 900));
  ok('brief: the album line', /This serving has its own album/.test(t), null);
  ok('brief: the album link is the serving’s', await o.page.evaluate(() => Array.from(document.querySelectorAll('#app a')).some(a => a.href === 'https://photos.app.goo.gl/EVENT123')));
  ok('brief: no page errors', o.errs.length === 0, o.errs);
  await o.ctx.close();
  /* 4. a photographer without a brief sees none */
  o = await open({ confirm: photographer(false) });
  t = await text(o);
  ok('no brief: nothing shown', !/content brief/i.test(t), t.slice(0, 200));
  await o.ctx.close();
  console.log(JSON.stringify(res, null, 1));
  console.log(fails ? 'FAILS: ' + fails : 'ALL OK', Object.keys(res).length, 'checks');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
