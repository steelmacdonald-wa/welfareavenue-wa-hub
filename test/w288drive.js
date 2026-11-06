/* w288drive.js: the Toronto forms and the second consent box (wave288, CRM slice 1 Phase 5a). Fixture rows are made up for the test (no real
   people); every write is recorded on the page (the stub echoes it and never changes the fixture).
   - The form editor: the old "City written on new contacts" box is gone; a Chapter select (the active chapters, or None) and a Campaign select
     (wa_campaigns, or None) are there for a volunteer form and for a newsletter; "Also ask for text consent" sits under the email permission.
   - Choosing Toronto on a volunteer form moves its serving location to Toronto; a Campaign saves its id; ticking the text box shows its words
     (the English or French default) and the preview shows the second box. Save writes settings.chapter, serving_location, campaign_id and
     consent.sms; None and an unticked box take them out again. A form that already has them opens with them chosen.
   - The public page (build/f/index.html): a form with consent.sms shows the second box under the email box and sends it as the top-level
     consent_sms (true or false); a form without it shows one box and sends consent_sms false.
   - No page errors; at phone width the editor does not scroll sideways.
   usage: node test/w288drive.js */
const { launch, fresh, loadFixture } = require('./boot');
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 900) : '')); } }
const QV = [{ id: 'first_name', type: 'text', label: 'First name', required: true, to: 'contact.first_name' }, { id: 'email', type: 'email', label: 'Email', required: true, to: 'contact.email' }];
const SMS_EN = 'Text me about volunteering. I can reply STOP at any time.';
const SMS_FR = 'Écrivez-moi par texto au sujet du bénévolat. Je peux répondre STOP en tout temps.';
const TV_SETTINGS = { chapter: 'toronto', serving_location: 'Toronto', volunteer_record: true, tags: ['toronto'], confirm: false, request: { type: 'toronto-volunteer', title: 'New Toronto volunteer' } };
function fixture() {
  const fx = loadFixture();
  fx.crm_forms = [
    { id: 1, slug: 'volunteer', title: 'Volunteer with Welfare Avenue', intro: '', lang: 'en', kind: 'volunteer', status: 'published', purpose: 'volunteers', questions: QV,
      consent: { ask: true, required: false, label: 'Yes, email me.' }, thank_you: 'Thank you.', settings: { city: 'Montreal', tags: [], volunteer_record: true, serving_location: 'Montreal' }, created_at: '2026-09-28T12:00:00Z' },
    { id: 2, slug: 'toronto-volunteer', title: 'Volunteer in Toronto', intro: '', lang: 'en', kind: 'volunteer', status: 'closed', purpose: 'volunteers', questions: QV,
      consent: { ask: true, required: false, label: 'Send me Welfare Avenue news by email. I can unsubscribe at any time.', sms: { ask: true, label: SMS_EN } }, thank_you: 'Thank you.',
      settings: Object.assign({ campaign_id: 7 }, TV_SETTINGS), created_at: '2026-09-28T12:00:00Z' },
    { id: 3, slug: 'newsletter', title: 'Get the newsletter', intro: '', lang: 'en', kind: 'newsletter', status: 'published', purpose: 'other', questions: QV,
      consent: { ask: true, required: true, label: 'Yes, email me the newsletter.' }, thank_you: 'Thank you.', settings: { tags: [] }, created_at: '2026-09-28T12:00:00Z' },
    { id: 4, slug: 'benevole-toronto', title: 'Faire du bénévolat à Toronto', intro: '', lang: 'fr', kind: 'volunteer', status: 'draft', purpose: 'volunteers', questions: QV,
      consent: { ask: true, required: false, label: 'Envoyez-moi les nouvelles de Welfare Avenue par courriel.' }, thank_you: 'Merci.', settings: Object.assign({}, TV_SETTINGS), created_at: '2026-09-28T12:00:00Z' }
  ];
  fx.crm_form_stats_v = fx.crm_forms.map(f => ({ form_id: f.id, submissions: 0, last_7_days: 0, last_at: null, spam: 0, errors: 0, tests: 0 }));
  fx.crm_form_submissions = []; fx.crm_fields = []; fx.crm_contact_fields = [];
  fx.crm_chapters = [{ code: 'montreal', name_en: 'Montreal', active: true, sort: 1 }, { code: 'toronto', name_en: 'Toronto', active: true, sort: 2 }];
  fx.wa_campaigns = [{ id: 7, name: 'Gift Basket Drive 2026', year: 2026, status: 'active' }, { id: 3, name: 'Rally Paper 2026', year: 2026, status: 'done' }];
  fx.volunteer_events = (fx.volunteer_events || []).filter(e => e.status !== 'planned');
  return fx;
}
const patch = f => f.ev(() => {
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
const setv = (f, s, v) => f.ev(([x, val]) => { const el = document.querySelector(x); if (!el) return false; el.value = val; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; }, [s, v]);
const tick = (f, s, on) => f.ev(([x, v]) => { const el = document.querySelector(x); if (!el) return false; el.checked = v; el.dispatchEvent(new Event('change', { bubbles: true })); return true; }, [s, on]);
const editor = f => f.ev(() => {
  const sel = s => { const el = document.querySelector(s); return el ? { value: el.value, options: [...el.options].map(o => o.value + '=' + o.text) } : null; };
  const sms = document.querySelector('#crm [data-w288sms="ask"]');
  return { city: !!document.querySelector('#crm [data-w156set="city"]') || /City written on new contacts/.test(document.querySelector('#crm .w154card').innerText),
    chapter: sel('#crm [data-w288set="chapter"]'), campaign: sel('#crm [data-w288set="campaign_id"]'),
    sms: sms ? { checked: sms.checked, label: sms.closest('label').innerText.trim(), after: !!sms.closest('.w156box') && !!sms.closest('.w156box').querySelector('[data-w156c="ask"]') } : null,
    words: (document.querySelector('#crm [data-w288sms="label"]') || {}).value, pv: [...document.querySelectorAll('#crm .w156pv .w156pcons')].map(x => x.innerText.trim()) };
});
const lastFormUpdate = f => f.ev(() => { const u = window.__ins.filter(x => x.t === 'crm_forms' && x.op === 'update'); return u.length ? u[u.length - 1].p : null; });

(async () => {
  const browser = await launch();
  let f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(), wait: 4000 });
  await patch(f);
  await f.hash('#crm/forms', 2400);

  /* the Montreal volunteer form: no chapter yet, the city box gone */
  await click(f, '#crm [data-w156open="1"]'); await f.page.waitForTimeout(900);
  let b = await editor(f);
  ok('the editor no longer has "City written on new contacts"', !b.city, b);
  ok('a Chapter select lists None and the active chapters, with None chosen', b.chapter && b.chapter.value === '' && b.chapter.options.join('|') === '=None|montreal=Montreal|toronto=Toronto', b.chapter);
  ok('a Campaign select lists None and the Campaigns, with None chosen', b.campaign && b.campaign.value === '' && b.campaign.options.join('|') === '=None|7=Gift Basket Drive 2026|3=Rally Paper 2026', b.campaign);
  ok('"Also ask for text consent" sits in the email permission box, unticked, with no words yet', b.sms && !b.sms.checked && b.sms.label === 'Also ask for text consent' && b.sms.after && b.words === undefined, b.sms);
  ok('the preview shows the email box only', b.pv.length === 1, b.pv);

  await setv(f, '#crm [data-w288set="chapter"]', 'toronto'); await f.page.waitForTimeout(300);
  await setv(f, '#crm [data-w288set="campaign_id"]', '7'); await f.page.waitForTimeout(300);
  await tick(f, '#crm [data-w288sms="ask"]', true); await f.page.waitForTimeout(300);
  b = await editor(f);
  ok('choosing Toronto and a Campaign keeps them chosen', b.chapter.value === 'toronto' && b.campaign.value === '7', b);
  ok('the chapter line says who joins it', /Everyone who answers joins Toronto\./.test(await f.ev(() => document.querySelector('#crm .w154card').innerText)), null);
  ok('ticking the text box shows its words, the English default', b.sms.checked && b.words === SMS_EN, b);
  ok('the preview shows the second box with those words', b.pv.length === 2 && b.pv[1] === SMS_EN, b.pv);
  await setv(f, '#crm [data-w288sms="label"]', 'Text me about servings. Reply STOP to stop.'); await f.page.waitForTimeout(600);
  b = await editor(f);
  ok('the preview follows the words as they are typed', b.pv[1] === 'Text me about servings. Reply STOP to stop.', b.pv);
  await click(f, '#crm [data-w156save]'); await f.page.waitForTimeout(1200);
  let p = await lastFormUpdate(f);
  ok('Save writes the chapter, the Toronto serving location and the Campaign id into the settings (the rest kept)', p && p.settings.chapter === 'toronto' && p.settings.serving_location === 'Toronto' && p.settings.campaign_id === 7
     && p.settings.volunteer_record === true && Array.isArray(p.settings.tags), p && p.settings);
  ok('Save writes consent.sms with its words next to the email permission', p && p.consent.ask === true && p.consent.label === 'Yes, email me.' && p.consent.sms && p.consent.sms.ask === true
     && p.consent.sms.label === 'Text me about servings. Reply STOP to stop.', p && p.consent);

  await setv(f, '#crm [data-w288set="chapter"]', ''); await f.page.waitForTimeout(300);
  await setv(f, '#crm [data-w288set="campaign_id"]', ''); await f.page.waitForTimeout(300);
  await tick(f, '#crm [data-w288sms="ask"]', false); await f.page.waitForTimeout(300);
  b = await editor(f);
  ok('unticking the text box hides its words', !b.sms.checked && b.words === undefined && b.pv.length === 1, b);
  await click(f, '#crm [data-w156save]'); await f.page.waitForTimeout(1200);
  p = await lastFormUpdate(f);
  ok('None and an unticked box take settings.chapter, campaign_id and consent.sms out again', p && !('chapter' in p.settings) && !('campaign_id' in p.settings) && !('sms' in p.consent) && p.consent.ask === true, p && { s: p.settings, c: p.consent });

  /* toronto-volunteer opens with what it has */
  await click(f, '#crm [data-w156back]'); await f.page.waitForTimeout(700);
  await click(f, '#crm [data-w156open="2"]'); await f.page.waitForTimeout(900);
  b = await editor(f);
  ok('toronto-volunteer opens with Toronto, its Campaign and the text box ticked with its words', b.chapter.value === 'toronto' && b.campaign.value === '7' && b.sms.checked && b.words === SMS_EN && b.pv.length === 2, b);
  await click(f, '#crm [data-w156save]'); await f.page.waitForTimeout(1200);
  p = await lastFormUpdate(f);
  ok('saving it unchanged keeps its settings and both boxes', p && JSON.stringify(Object.assign({}, p.settings, { tags: p.settings.tags })) === JSON.stringify(Object.assign({ campaign_id: 7 }, TV_SETTINGS))
     && p.consent.sms.label === SMS_EN, p && { s: p.settings, c: p.consent });

  /* the newsletter: the chapter and Campaign are there too; no serving location */
  await click(f, '#crm [data-w156back]'); await f.page.waitForTimeout(700);
  await click(f, '#crm [data-w156open="3"]'); await f.page.waitForTimeout(900);
  b = await editor(f);
  ok('a newsletter form has the Chapter and Campaign selects too', b.chapter && b.campaign && b.sms, b);
  await setv(f, '#crm [data-w288set="chapter"]', 'montreal'); await f.page.waitForTimeout(300);
  await click(f, '#crm [data-w156save]'); await f.page.waitForTimeout(1200);
  p = await lastFormUpdate(f);
  ok('a newsletter saves its chapter without a serving location', p && p.settings.chapter === 'montreal' && !('serving_location' in p.settings), p && p.settings);

  /* the French twin: the French default words */
  await click(f, '#crm [data-w156back]'); await f.page.waitForTimeout(700);
  await click(f, '#crm [data-w156open="4"]'); await f.page.waitForTimeout(900);
  await tick(f, '#crm [data-w288sms="ask"]', true); await f.page.waitForTimeout(300);
  b = await editor(f);
  ok('on a French form the text box starts with the French words', b.words === SMS_FR && b.pv[1] === SMS_FR, b);
  ok('no page errors in the editor', f.errs.length === 0, f.errs);

  /* phone width */
  const fp = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(), wait: 4000, width: 390 });
  await fp.hash('#crm/forms/2', 2400);
  const wide = await fp.ev(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, ch: !!document.querySelector('#crm [data-w288set="chapter"]') }));
  ok('at phone width the editor shows the selects and nothing scrolls sideways', wide.ch && wide.sw <= wide.cw + 1, wide);
  await fp.close();
  await f.close();

  /* the public page */
  const page = path.join(__dirname, '../build/f/index.html');
  for (const [label, consent, tickBoth, expectBoxes, expectSms] of [
    ['a form with the text box', { ask: true, required: false, label: 'Send me Welfare Avenue news by email. I can unsubscribe at any time.', sms: { ask: true, label: SMS_EN } }, true, 2, true],
    ['the same form, only the email box ticked', { ask: true, required: false, label: 'Send me Welfare Avenue news by email. I can unsubscribe at any time.', sms: { ask: true, label: SMS_EN } }, false, 2, false],
    ['a form without the text box', { ask: true, required: false, label: 'Yes, email me.' }, true, 1, false]]) {
    const posts = [];
    const pf = await fresh(browser, { html: fs.readFileSync(page, 'utf8'), hash: '?form=toronto-volunteer', gateOk: true, wait: 1500, fixture: fixture(), beforeGoto: async (pg) => {
      await pg.route('**/functions/v1/form-submit**', route => {
        const r = route.request();
        if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } });
        const H = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
        if (r.method() === 'GET') return route.fulfill({ status: 200, headers: H, body: JSON.stringify({ token: '1.x', org: { name: 'Welfare Avenue', address: 'Test address', email: 'info@example.org' },
          form: { slug: 'toronto-volunteer', title: 'Volunteer in Toronto', intro: '', lang: 'en', kind: 'volunteer', thank_you: 'Thank you.', cover: null,
            questions: [{ id: 'first_name', type: 'text', label: 'First name', required: true }, { id: 'email', type: 'email', label: 'Email', required: true }], consent } }) });
        posts.push(JSON.parse(r.postData() || '{}'));
        return route.fulfill({ status: 200, headers: H, body: JSON.stringify({ ok: true, thank_you: 'Thank you.' }) });
      });
    } });
    await pf.page.waitForSelector('#waf', { timeout: 8000 }).catch(() => {});
    const boxes = await pf.ev(() => [...document.querySelectorAll('.consent .choice')].map(l => ({ name: l.querySelector('input').name, text: l.innerText.trim() })));
    ok(label + ': the page shows ' + expectBoxes + ' box(es) in the consent block, the text box under the email box', boxes.length === expectBoxes && boxes[0].name === '_consent' && (expectBoxes === 1 || (boxes[1].name === '_consent_sms' && boxes[1].text === SMS_EN)), boxes);
    await setv(pf, '#q_first_name', 'Fixture'); await setv(pf, '#q_email', 'fixture.person@toronto-fixture.ca');
    await tick(pf, '#q__consent', true);
    if (tickBoth) await tick(pf, '#q__consent_sms', true);
    await click(pf, '#send'); await pf.page.waitForTimeout(800);
    ok(label + ': the answer goes with consent true and consent_sms ' + expectSms + ' at the top level', posts.length === 1 && posts[0].consent === true && posts[0].consent_sms === expectSms && posts[0].answers && posts[0].answers.email === 'fixture.person@toronto-fixture.ca', posts);
    ok(label + ': no page errors', pf.errs.length === 0, pf.errs);
    await pf.close();
  }

  await browser.close();
  console.log(out.join('\n'));
  console.log(`\nw288drive: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
