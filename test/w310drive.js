/* w310drive.js: Campaigns in the CRM, Email insights, buttons to a form or the donation page, a form's donate button, and the
   photo albums (wave310, Soraya's review, 12/11/26). Fixture rows are made up for the test (no real people); the stub echoes
   writes and never changes the fixture; wa310_* answers come from this file.
   - The CRM rail has Campaigns (under Campaigns and giving) and Email insights (under Email); both pages draw without errors.
   - Campaigns: the list (running and planned first, Done apart), a card opens the folder; the folder shows what it is, the facts,
     the links, the forms, the posts, the gifts and the donation link; Edit the folder saves name, facts, https links, hashtags
     and post names through wa310_campaign_save, and refuses an http link before calling it. New campaign makes one.
   - Email insights: the numbers, the month table, the heat map (sent while opens are not counted), the tracking note, the plan.
   - Point it at: in a studio Button block and an automation's email, picking a form or the donation page fills the link (and
     the words when empty).
   - The form editor: the donate box shows; ticking it opens its words and campaign; the form's settings carry donate.
   - The Photo library: the albums card and "in the library" on each year.
   - Phone width: Campaigns and Email insights do not scroll sideways. No page errors.
   usage: WA_CHROME=... CAND=build/candidate.html node test/w310drive.js */
const { launch, fresh, loadFixture } = require('./boot');
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 900) : '')); } }
const QV = [{ id: 'first_name', type: 'text', label: 'First name', required: true, to: 'contact.first_name' }, { id: 'email', type: 'email', label: 'Email', required: true, to: 'contact.email' }];
const LIST = { campaigns: [
  { id: 7, name: 'Gift Basket Drive 2026', type: 'drive', year: 2026, status: 'active', goal_amount: 5000, raised: 750, forms: 8, posts: 10, links: 0, donate_key: 'gift-basket-drive' },
  { id: 9, name: 'One Bag Challenge 2026 with a very long name that keeps going to test the card wrapping', type: 'challenge', year: 2026, status: 'planned', goal_amount: null, raised: 0, forms: 0, posts: 21, links: 2 },
  { id: 2, name: 'Football Fundraiser 2025', type: 'fundraising_event', year: 2025, status: 'done', goal_amount: null, raised: 2133.08, forms: 0, posts: 0, links: 0 }
], fund_events: [{ id: 3, title: 'One Bag Challenge' }, { id: 4, title: 'Gift Basket Drive 2026' }] };
const DETAIL = {
  campaign: { id: 9, name: 'One Bag Challenge 2026', type: 'challenge', year: 2026, status: 'planned', goal_amount: null, donate_key: null, brief: 'The fundraiser that feeds the Gift Basket Drive.',
    facts: [{ label: 'Target', value: '$3,000 to $4,000' }, { label: 'What $20 to $25 does', value: 'Fills one bag' }], links: [{ label: 'The rules', url: 'https://docs.google.com/document/d/x' }, { label: 'Bad', url: 'javascript:alert(1)' }],
    hashtags: ['onebagchallenge'], post_names: ['One Bag Challenge'], fund_event_id: 3, updated_at: '2026-11-12T05:00:00Z', updated_by: 'wave310' },
  forms: [{ id: 11, slug: 'one-bag', title: 'Join the One Bag Challenge', lang: 'en', status: 'published', n: 4 }],
  posts: [{ id: 18, title: 'One Bag Challenge: team promo video', status: 'draft', approval_status: 'none' }, { id: 19, title: 'Leaders video', status: 'published', published_at: '2026-11-16T15:00:00Z' }],
  gifts: { n: 0, total: 0, last: null }, people: 0, fund_event: { id: 3, title: 'One Bag Challenge', timing: 'Nov to Dec', volunteer_on: false },
  fund_events: [{ id: 3, title: 'One Bag Challenge' }, { id: 4, title: 'Gift Basket Drive 2026' }]
};
const INS = { tracking: false, months: [{ month: '2026-11-01', sent: 119, delivered: 119, opened: 0, clicked: 0, unsubscribed: 0, bounced: 0 }, { month: '2026-10-01', sent: 62, delivered: 62, opened: 0, clicked: 0, unsubscribed: 0, bounced: 0 }],
  heat: [{ dow: 2, slot: 9, sends: 40, opens: 0 }, { dow: 0, slot: 21, sends: 3, opens: 0 }, { dow: 4, slot: 15, sends: 12, opens: 0 }] };
function fixture() {
  const fx = loadFixture();
  fx.crm_forms = [
    { id: 1, slug: 'volunteer', title: 'Volunteer with Welfare Avenue', intro: '', lang: 'en', kind: 'volunteer', status: 'published', purpose: 'volunteers', questions: QV, consent: { ask: true, required: false, label: 'Yes, email me.' }, thank_you: 'Thank you.', settings: { tags: [] }, created_at: '2026-09-28T12:00:00Z' },
    { id: 2, slug: 'paniers-benevole', title: 'Bénévolat : paniers cadeaux', intro: '', lang: 'fr', kind: 'volunteer', status: 'published', purpose: 'volunteers', questions: QV, consent: { ask: true, required: false, label: 'Oui.' }, thank_you: 'Merci.', settings: { tags: [] }, created_at: '2026-09-28T12:00:00Z' }
  ];
  fx.crm_form_stats_v = fx.crm_forms.map(f => ({ form_id: f.id, submissions: 0, last_7_days: 0, last_at: null, spam: 0, errors: 0, tests: 0 }));
  fx.crm_form_submissions = []; fx.crm_fields = []; fx.crm_contact_fields = [];
  fx.crm_chapters = [{ code: 'montreal', name_en: 'Montreal', active: true, sort: 1 }];
  fx.wa_campaigns = [{ id: 7, name: 'Gift Basket Drive 2026', year: 2026, status: 'active' }];
  fx.app_config = (fx.app_config || []).concat([{ key: 'donate_mode', value: 'live' }, { key: 'donate_campaigns', value: { 'gift-basket-drive': { name: 'Holiday Gift Basket Drive 2026', open: true, goal: 5000 } } }]);
  fx.wa_photo_albums = [{ id: 1, label: 'Oberoi serving', url: 'https://photos.app.goo.gl/abc', taken_on: '2026-11-01', note: null }];
  return fx;
}
const rpcPatch = `(function(){ var t = setInterval(function(){ if (typeof db === 'undefined' || !db || !db.rpc || db.__w310) return; var o = db.rpc.bind(db); window.__rpc = [];
  db.rpc = function (fn, a) { window.__rpc.push({ fn: fn, a: a ? JSON.parse(JSON.stringify(a)) : null });
    if (fn === 'wa310_campaigns') return Promise.resolve({ data: a && a.p_id ? ${JSON.stringify(DETAIL)} : ${JSON.stringify(LIST)}, error: null });
    if (fn === 'wa310_mail_insights') return Promise.resolve({ data: ${JSON.stringify(INS)}, error: null });
    if (fn === 'wa310_campaign_save') return Promise.resolve({ data: { ok: true, id: (a && a.p && a.p.id) || 99 }, error: null });
    return o(fn, a); };
  db.__w310 = true; clearInterval(t); }, 20); })();`;
const ev = (f, fn, a) => f.ev(fn, a);
const click = (f, s) => f.ev(x => { const el = document.querySelector(x); if (!el) return false; el.click(); return true; }, s);
const setv = (f, s, v) => f.ev(([x, val]) => { const el = document.querySelector(x); if (!el) return false; el.value = val; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; }, [s, v]);
const wide = f => f.ev(() => { const d = document.documentElement; return d.scrollWidth - d.clientWidth; });

(async () => {
  const browser = await launch();
  let f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(), wait: 4000, init: rpcPatch });
  /* the rail */
  await f.hash('#crm/folders', 2600);
  const rail = await ev(f, () => [...document.querySelectorAll('#w153rail [data-w153go]')].map(a => a.getAttribute('data-w153go') + '=' + a.innerText.trim()));
  ok('rail: Campaigns', rail.some(x => /^#crm\/folders=Campaigns/.test(x)), rail);
  ok('rail: Email insights', rail.some(x => /^#crm\/insights=Email insights/.test(x)), rail);
  /* the list */
  const list = await ev(f, () => { const r = document.getElementById('w310'); return r ? { cards: [...r.querySelectorAll('.card b')].map(b => b.innerText), done: [...r.querySelectorAll('h3')].some(h => /done/i.test(h.textContent)), bar: !!r.querySelector('.card .bar i'), txt: r.innerText.slice(0, 400), h1: (document.querySelector('#crm .w118mast h1') || {}).textContent } : null; });
  ok('list: drawn', list && list.cards.length === 3, list);
  ok('list: running first, Done apart', list && /Gift Basket/.test(list.cards[0]) && list.done, list);
  ok('list: goal bar', list && list.bar, list);
  ok('list: masthead says Campaigns', list && list.h1 === 'Campaigns', list);
  /* new campaign */
  await click(f, '#w310 [data-w310new]'); await f.page.waitForTimeout(300);
  await click(f, '#w310 [data-w310create]'); await f.page.waitForTimeout(200);
  const nerr = await ev(f, () => (document.querySelector('#w310 .err') || {}).textContent || '');
  ok('new: a name is needed', /name/.test(nerr), nerr);
  await setv(f, '#w310nn', 'Après-Ski 2027'); await setv(f, '#w310nt', 'fundraising_event'); await setv(f, '#w310ng', '1500');
  await click(f, '#w310 [data-w310create]'); await f.page.waitForTimeout(900);
  const made = await ev(f, () => (window.__rpc || []).filter(x => x.fn === 'wa310_campaign_save').pop());
  ok('new: saved through wa310_campaign_save', made && made.a.p.name === 'Après-Ski 2027' && made.a.p.type === 'fundraising_event' && made.a.p.goal_amount === 1500, made);
  ok('new: opens the new folder', /#crm\/folders\/99/.test(await ev(f, () => location.hash)), await ev(f, () => location.hash));
  /* the folder */
  await f.hash('#crm/folders/9', 1500);
  const det = await ev(f, () => { const r = document.getElementById('w310'); return r ? { txt: r.innerText, links: [...r.querySelectorAll('a[target=_blank]')].map(a => a.getAttribute('href')), facts: r.querySelectorAll('dl.facts dt').length, tags: [...r.querySelectorAll('.chip')].map(c => c.innerText) } : null; });
  ok('folder: what it is', det && /feeds the Gift Basket Drive/.test(det.txt), det && det.txt.slice(0, 300));
  ok('folder: facts', det && det.facts === 2, det);
  ok('folder: only https links shown', det && det.links.indexOf('https://docs.google.com/document/d/x') >= 0 && !det.links.some(h => /^javascript/i.test(h)), det && det.links);
  ok('folder: hashtag', det && det.tags.indexOf('#onebagchallenge') >= 0, det && det.tags);
  ok('folder: form with its live link', det && det.links.indexOf('https://hub.welfareavenue.com/f/one-bag') >= 0, det && det.links);
  ok('folder: posts', det && /team promo video/.test(det.txt) && /Out /.test(det.txt), det && det.txt.slice(0, 900));
  ok('folder: no donation key says so', det && /needed most/.test(det.txt), det && det.txt.slice(-500));
  /* edit */
  await click(f, '#w310 [data-w310edit]'); await f.page.waitForTimeout(300);
  await setv(f, '#w310 [data-w310f="links.1.url"]', 'http://example.com');
  await click(f, '#w310 [data-w310save]'); await f.page.waitForTimeout(300);
  const e1 = await ev(f, () => ({ err: (document.querySelector('#w310 .err') || {}).textContent || '', saves: (window.__rpc || []).filter(x => x.fn === 'wa310_campaign_save').length }));
  ok('edit: an http link is refused on the page', /https/.test(e1.err) && e1.saves === 1, e1);
  await setv(f, '#w310 [data-w310f="links.1.url"]', 'https://www.canva.com/design/x');
  await setv(f, '#w310 [data-w310f="links.1.label"]', 'Canva designs');
  await click(f, '#w310 [data-w310add="facts"]'); await f.page.waitForTimeout(200);
  await setv(f, '#w310 [data-w310f="facts.2.label"]', 'Launch'); await setv(f, '#w310 [data-w310f="facts.2.value"]', 'Week of 16 November');
  await setv(f, '#w310 [data-w310k="hashtags"]', '#onebagchallenge #WelfareAvenue');
  await click(f, '#w310 [data-w310save]'); await f.page.waitForTimeout(900);
  const sv = await ev(f, () => (window.__rpc || []).filter(x => x.fn === 'wa310_campaign_save').pop());
  ok('edit: saved', sv && sv.a.p.id === 9 && sv.a.p.facts.length === 3 && sv.a.p.links.length === 2 && sv.a.p.links[1].url === 'https://www.canva.com/design/x', sv);
  ok('edit: hashtags without #', sv && JSON.stringify(sv.a.p.hashtags) === '["onebagchallenge","WelfareAvenue"]', sv && sv.a.p.hashtags);
  ok('edit: back to the folder', await ev(f, () => !document.querySelector('#w310 [data-w310ed]')));
  /* insights */
  await f.hash('#crm/insights', 1800);
  const ins = await ev(f, () => { const r = document.getElementById('w310'); return r ? { txt: r.innerText, kpis: r.querySelectorAll('.kpi').length, heat: r.querySelectorAll('table.heat td').length, rows: r.querySelectorAll('table.t tbody tr').length, plan: r.querySelectorAll('ol.plan li').length, note: !!r.querySelector('.note'), h1: (document.querySelector('#crm .w118mast h1') || {}).textContent } : null; });
  ok('insights: numbers', ins && ins.kpis === 5 && /181/.test(ins.txt), ins && ins.txt.slice(0, 300));
  ok('insights: months', ins && ins.rows === 2, ins);
  ok('insights: heat map 6x7', ins && ins.heat === 42, ins);
  ok('insights: tracking note', ins && ins.note && /Resend/.test(ins.txt), ins);
  ok('insights: send-time plan', ins && ins.plan === 4, ins);
  ok('insights: masthead', ins && ins.h1 === 'Email insights', ins);
  /* Point it at: a studio Button block and an automation email (the pickers in place, as blockForm and stepBody draw them) */
  const pick = await ev(f, () => new Promise(res => {
    const box = document.createElement('div'); box.className = 'w202bf';
    box.innerHTML = '<input data-w202f="3.label" value=""><input data-w202f="3.url" value="">' + window.w310.btnPick(3);
    const st = document.createElement('div'); st.className = 'w157step';
    st.innerHTML = '<input data-w157s="cta_label" value="Keep"><input data-w157s="cta_url" value="">' + window.w310.ctaPick();
    document.body.appendChild(box); document.body.appendChild(st);
    setTimeout(() => {
      const s1 = box.querySelector('select'), s2 = st.querySelector('select');
      const opts = [...s1.options].map(o => o.value);
      s1.value = 'form:paniers-benevole'; s1.dispatchEvent(new Event('change', { bubbles: true }));
      s2.value = 'give:gift-basket-drive'; s2.dispatchEvent(new Event('change', { bubbles: true }));
      const r = { opts: opts, url: box.querySelector('[data-w202f="3.url"]').value, label: box.querySelector('[data-w202f="3.label"]').value, cta: st.querySelector('[data-w157s="cta_url"]').value, ctal: st.querySelector('[data-w157s="cta_label"]').value };
      box.remove(); st.remove(); res(r);
    }, 900);
  }));
  ok('pick: forms and donations listed', pick.opts.indexOf('give:') >= 0 && pick.opts.indexOf('give:gift-basket-drive') >= 0 && pick.opts.indexOf('form:volunteer') >= 0, pick.opts);
  ok('pick: a studio button goes to the form, words filled', pick.url === 'https://hub.welfareavenue.com/f/paniers-benevole' && pick.label === 'Remplir le formulaire', pick);
  ok('pick: an automation button goes to the drive’s donation page, own words kept', pick.cta === 'https://hub.welfareavenue.com/give?c=gift-basket-drive' && pick.ctal === 'Keep', pick);
  /* the form editor's donate box */
  await f.hash('#crm/forms/1', 2200);
  let fd = await ev(f, () => { const b = document.querySelector('#crm [data-w310fd]'); return b ? { txt: b.innerText, on: b.querySelector('[data-w310fdk="on"]').checked } : null; });
  ok('form: donate box', fd && /donate button/.test(fd.txt) && !fd.on, fd);
  await ev(f, () => { const c = document.querySelector('#crm [data-w310fdk="on"]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await f.page.waitForTimeout(400);
  await setv(f, '#crm [data-w310fdk="campaign"]', 'gift-basket-drive');
  fd = await ev(f, () => { const st = window.w310.state(); const b = document.querySelector('#crm [data-w310fd]'); return { words: !!b.querySelector('[data-w310fdk="label"]'), camp: [...b.querySelectorAll('[data-w310fdk="campaign"] option')].map(o => o.value) }; });
  ok('form: ticked shows its words and campaigns', fd.words && fd.camp.indexOf('gift-basket-drive') >= 0, fd);
  /* saving the form keeps the donate button in its settings */
  await f.ev(() => { window.__ins = []; const from0 = db.from.bind(db); db.from = function (t) { const q = from0(t); const up = q.update; q.update = function (p) { window.__ins.push({ t: t, p: JSON.parse(JSON.stringify(p)) }); return up.call(this, p); }; return q; }; });
  await click(f, '#crm [data-w156save]'); await f.page.waitForTimeout(900);
  const fu = await f.ev(() => (window.__ins || []).filter(x => x.t === 'crm_forms').pop());
  ok('form: Save writes settings.donate', fu && fu.p.settings && fu.p.settings.donate && fu.p.settings.donate.on === true && fu.p.settings.donate.campaign === 'gift-basket-drive', fu);
  /* the photo library */
  await f.hash('#photos', 2600);
  const ph = await ev(f, () => { const a = document.querySelector('.w310al'); const g = [...document.querySelectorAll('#photos .grp span, .w118chost .grp span')].map(s => s.innerText); return { al: a ? a.innerText : null, album: a ? [...a.querySelectorAll('.als a')].map(x => x.getAttribute('href')) : [], g: g.slice(0, 3) }; });
  ok('photos: albums card', ph.al && /Google Photos/.test(ph.al) && ph.album.indexOf('https://photos.app.goo.gl/abc') >= 0, ph);
  ok('photos: "in the library"', !ph.g.length || ph.g.every(x => /in the library/.test(x)), ph.g);
  ok('no page errors (desktop)', f.errs.length === 0, f.errs);
  await f.close();
  /* the public form page: the donate button on the thank-you */
  const fpage = fs.readFileSync(path.join(__dirname, '../build/f/index.html'), 'utf8');
  for (const [label, donate, expect] of [['with a donate button', { label: 'Give to the drive', url: 'https://hub.welfareavenue.com/give?c=gift-basket-drive' }, 'https://hub.welfareavenue.com/give?c=gift-basket-drive'],
    ['without one', null, null], ['with a link that is not ours', { label: 'Bad', url: 'https://evil.example/give' }, null]]) {
    const pf = await fresh(browser, { html: fpage, hash: '?form=volunteer', gateOk: true, wait: 1500, fixture: fixture(), beforeGoto: async (pg) => {
      await pg.route('**/functions/v1/form-submit**', route => {
        const r = route.request(); const H = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
        if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } });
        if (r.method() === 'GET') return route.fulfill({ status: 200, headers: H, body: JSON.stringify({ token: '1.x', org: { name: 'Welfare Avenue', address: 'Test address', email: 'info@example.org' },
          form: Object.assign({ slug: 'volunteer', title: 'Volunteer', intro: '', lang: 'en', kind: 'volunteer', thank_you: 'Thank you.', cover: null, consent: { ask: false },
            questions: [{ id: 'first_name', type: 'text', label: 'First name', required: true }, { id: 'email', type: 'email', label: 'Email', required: true }] }, donate ? { donate } : {}) }) });
        return route.fulfill({ status: 200, headers: H, body: JSON.stringify({ ok: true, thank_you: 'Thank you.' }) });
      });
    } });
    await pf.page.waitForSelector('#waf', { timeout: 8000 }).catch(() => {});
    await setv(pf, '#q_first_name', 'Fixture'); await setv(pf, '#q_email', 'fixture.person@example.ca');
    await click(pf, '#send'); await pf.page.waitForTimeout(900);
    const g = await pf.ev(() => { const a = document.querySelector('.done a.give'); return a ? a.getAttribute('href') : null; });
    ok('public form ' + label + ': ' + (expect ? 'the button goes to our donation page' : 'no donate button'), g === expect, g);
    ok('public form ' + label + ': no page errors', pf.errs.length === 0, pf.errs);
    await pf.close();
  }
  /* a member on the marketing profile, and the phone */
  f = await fresh(browser, { who: 'plain', width: 390, hash: '#mypage', fixture: fixture(), wait: 4000, init: rpcPatch });
  await f.hash('#crm/folders', 2600);
  const p1 = await ev(f, () => !!document.getElementById('w310'));
  ok('phone: Campaigns drawn for a member', p1);
  ok('phone: Campaigns does not scroll sideways', (await wide(f)) <= 1, await wide(f));
  await f.hash('#crm/folders/9', 1500);
  ok('phone: the folder does not scroll sideways', (await wide(f)) <= 1, await wide(f));
  await f.hash('#crm/insights', 1600);
  ok('phone: insights does not scroll sideways', (await wide(f)) <= 1, await wide(f));
  ok('no page errors (phone)', f.errs.length === 0, f.errs);
  await f.close();
  await browser.close();
  console.log(out.join('\n'));
  console.log(pass + ' of ' + (pass + fail) + ' passed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
