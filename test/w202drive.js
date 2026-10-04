/* w202drive.js: wave202, the CRM's email studio (#crm/studio). Steel (03/10/26): emails like the Rally Paper ones, "for
   one-off emails and template emails going forward for both our volunteers and donors"; start from what you wrote and your
   photos (the AI puts it together) or from a template with your details; "if there's missing information, I want the hub to
   prompt the user"; templates the automations can use; one-off to a list, one-off to one person.
   Checks: the Studio tab and rail item; the front page (three ways, the four shelves with the ten starters, Ready as is, the
   recent emails, a look at a template); Tell the Hub (audience, kind, words, a Photo library photo) put together through the
   llm router (x-wa-task email_studio, the build_email tool, the words and the photo in the message), saved through
   email_studio_save; the Hub's questions and the studio's checks (a weekday that is not that date, a [bracket], a button
   with no link); answers put in by the Hub; editing (fields, the preview, add, move, copy, remove a block), Ask the Hub to
   change it and Undo; Send or save: a test, one person (Amara: mail-send send), a list (a campaign draft with the studio's
   template, opened in Campaigns with the studio card); Save as a template (its shelf); removing; Start from a template with
   details (the template and the answers go to the Hub) or filled in yourself (the checks list the brackets); Use it on a ready
   template; Build it yourself (not saved until it has a subject); a contact's Send an email (no one-offs or fill-in templates,
   the way into the studio for them); the automations' saved emails (ready ones only); a member gets the starters read only
   and can copy them; a phone; a board viewer gets no CRM; the mic on the studio's boxes; the page tour; no page errors.
   mail-send, llm, email_studio_save and email_studio_remove are faked in the page (window.__WA_INVOKE, db.rpc).
   wave203 (04/10/26), the voices: the Welfare Avenue voice code (app_config mail_voice_wa, from build/data/wa203_voice_code.md)
   in the prompt by default; My voice (the owner's writing guide through mybox's voice action) for Steel only; the Voices panel
   (read for all, edited by admins: app_config upsert and a change_log line); the choice kept with the email and its changes.
   Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26 16:00 Toronto). CAND=<file> tests another build. */
const fs = require('fs');
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
const STARTERS = require('../build/data/wa202_starters.js').rows();
const VOICE = fs.readFileSync(path.join(__dirname, '../build/data/wa203_voice_code.md'), 'utf8').trim();
const GUIDE = 'FRAMEWORK: wa-writing\nYou write as Steel MacDonald, founder of Welfare Avenue. TESTGUIDE: build then land; the colon is the joint. Hold me to it.';
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
async function shot(f, name, full) { if (SHOTS) await f.page.screenshot({ path: SHOTS + '/' + name + '.png', fullPage: !!full }); }
function C(id, full_name, o) {
  return Object.assign({ id, full_name, first_name: full_name.split(' ')[0], last_name: full_name.split(' ').slice(1).join(' '), emails: [], phones: [], primary_email: null, address: null, city: null, province: null,
    postal_code: null, country: null, language: null, kinds: ['volunteer'], tags: [], source: 'django_website_export', volunteer_id: null, member_id: null, email_status: 'unknown', email_consent: null,
    consent_source: null, consent_at: null, implied_consent_until: null, sms_opt_out: false, notes: null, last_activity_at: null, created_at: '2026-07-27T14:00:00Z', updated_at: '2026-07-27T14:00:00Z',
    created_by: 'wa150_backfill', updated_by: null, legacy_refs: {}, volunteer_roles: [], volunteer_tags: [], volunteer_organization: null, last_applied: null, volunteer_needs_review: false, in_quo: false,
    legacy_servings: 0, legacy_hours: 0, hub_servings: 0, last_serving_on: null, donation_total: 0, donation_count: 0, last_donation_at: null, org_names: [] }, o || {});
}
const T = (key, name, kind, subject, sort, o) => Object.assign({ key, name, kind, subject, preheader: 'A line for the inbox', html_body: '<h1>' + name + '</h1><p>Hi {{first_name|there}},</p>', text_body: 'Hi', vars: ['first_name'], active: true, sort,
  updated_by: null, updated_at: '2026-09-20T10:00:00Z', design: null, one_off: false, audience: null, category: null, lang: 'en', description: null, created_by: null, created_at: '2026-09-20T10:00:00Z' }, o || {});
const PH = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/photos/';
function fixture() {
  const fx = loadFixture();
  fx.crm_contacts_v = [
    C(5001, 'Amara Okafor', { emails: ['amara.okafor@example.com'], primary_email: 'amara.okafor@example.com', kinds: ['volunteer', 'donor'], email_status: 'subscribed', email_consent: 'express', consent_source: 'the website form' }),
    C(5002, 'Élodie Gagnon', { emails: ['elodie.gagnon@example.com'], primary_email: 'elodie.gagnon@example.com', kinds: ['supporter'] }),
    C(5003, 'Steel MacDonald', { emails: ['steel.macdonald@welfareavenue.com'], primary_email: 'steel.macdonald@welfareavenue.com', kinds: ['staff'] })
  ];
  fx.crm_contacts = fx.crm_contacts_v.map(c => Object.assign({}, c));
  fx.crm_duplicates_v = []; fx.crm_volunteer_history = []; fx.crm_contact_orgs = []; fx.crm_donations = []; fx.crm_interactions = []; fx.crm_email_sends = [];
  const joy = { v: 1, blocks: [{ id: 'bj1', type: 'hero', style: 'cream', kicker: 'October', lines: ['October', 'at the Avenue'], lead: 'What we did.', doodle: 'star', accent: 'gold', moveE: true }, { id: 'bj2', type: 'text', text: 'Hi {{first_name|there}},\n\nNews.' }] };
  fx.crm_email_templates = [T('test', 'A test message', 'test', 'A test from the Welfare Avenue Hub', 1), T('welcome_volunteer', 'Welcome, new volunteer', 'transactional', 'Welcome to Welfare Avenue, {{first_name|friend}}', 10),
    T('newsletter', 'Newsletter', 'newsletter', '{{subject|News from Welfare Avenue}}', 40), T('volunteer_itinerary', 'Volunteer itinerary', 'transactional', 'Your itinerary for {{date}}', 100, { html_body: '{{body_html}}' })]
    .concat(STARTERS.map(r => Object.assign({ updated_at: '2026-09-24T10:00:00Z', created_at: '2026-09-24T10:00:00Z' }, r)))
    .concat([T('st_joyoneoff1', 'Joy’s October news', 'newsletter', 'October at Welfare Avenue', 900, { design: joy, html_body: '<p style="x">News</p>', one_off: true, created_by: 'joy.dumansi@welfareavenue.com', updated_at: '2026-09-24T15:00:00Z' })]);
  fx.crm_lists = [{ id: 71, name: 'Volunteers who served this year', description: null, kind: 'dynamic', filter: { groups: [{ all: [{ f: 'kind', op: 'is', v: 'volunteer' }] }] }, member_ids: [], created_by: 'test', created_at: '2026-09-20T10:00:00Z', updated_at: '2026-09-20T10:00:00Z' }];
  fx.crm_campaigns = []; fx.crm_campaign_stats_v = [];
  fx.crm_forms = [{ id: 1, slug: 'volunteer', title: 'Volunteer with Welfare Avenue', intro: '', lang: 'en', kind: 'volunteer', status: 'draft', questions: [], consent: { ask: true }, thank_you: '', settings: {}, created_at: '2026-09-20T10:00:00Z' }];
  fx.crm_form_stats_v = [];
  fx.crm_automations = [{ id: 1, name: 'Welcome new volunteers', description: '', status: 'draft', trigger: { kind: 'form', form_id: 1 }, steps: [{ id: 's1', type: 'send', email: 'template', template_key: 'st_welcome_volunteer', kind: 'transactional' }],
    settings: { reentry: false }, created_at: '2026-09-20T12:00:00Z', created_by: 'test', updated_at: '2026-09-20T12:00:00Z' }];
  fx.crm_automation_stats_v = [{ automation_id: 1, active: 0, done: 0, stopped: 0, errors: 0, tests: 0, last_started: null, emails_sent: 0 }]; fx.crm_automation_runs = [];
  fx.wa_photos_list = [
    { id: 9, title: 'Two volunteers plating food', alt_text: 'Two volunteers plate food side by side', caption: null, usage: 'ready', url_web: PH + 'web/plating.jpg', url_thumb: PH + 'thumb/plating.jpg', orientation: 'landscape', scene: 'volunteers', tags: ['volunteers', 'food'], season: 'autumn', is_pick: true },
    { id: 14, title: 'Winter serving under the tent', alt_text: 'Volunteers serve under the tent', caption: null, usage: 'consent', url_web: PH + 'web/winter.jpg', url_thumb: PH + 'thumb/winter.jpg', orientation: 'landscape', scene: 'serving', tags: ['winter'], season: 'winter', is_pick: false }
  ];
  fx.app_config = (fx.app_config || []).concat([{ key: 'mail_mode', value: 'test' }, { key: 'mail_test_recipients', value: 'steelmacdonald@gmail.com, steel.macdonald@welfareavenue.com' },
    { key: 'mail_voice_wa', value: JSON.stringify({ label: 'Welfare Avenue', text: VOICE, version: 1, source: 'Welfare Avenue Brand Guides v1 2026', updated_by: 'assistant (wave203 session)', updated_at: '2026-10-04T06:00:00Z' }), updated_at: '2026-10-04T06:00:00Z' }]);   /* app_config.value is text */
  fx.mybox_owners = [{ email: 'steel.macdonald@welfareavenue.com', name: 'Steel MacDonald', enabled: true }];
  fx.trainings = (fx.trainings || []).concat([{ id: 1402, key: 'tour:studio', kind: 'tour', title: 'Page tour: Email studio', category: 'Hub tours', path_group: 'Hub page tours', minutes: 2, xp: 20, active: true, sort: 42, body: { tab: 'crm', tour: 'studio' } }]);
  return fx;
}
/* the page's fakes: email_studio_save and _remove keep the fixture's templates, campaigns get an id, mail-send and the AI answer */
const FAKE = `(function () {
  var FX = window.__WAFIX, n = 0;
  window.__saves = []; window.__removes = []; window.__llm = []; window.__mail = []; window.__camps = []; window.__mybox = []; window.__cfg = []; window.__clog = [];
  var me = (window.__WA_TEST_EMAIL || 'steel.macdonald@welfareavenue.com').toLowerCase();
  var rpc0 = db.rpc.bind(db);
  db.rpc = function (fn, args) {
    if (fn === 'email_studio_save') {
      var p = JSON.parse(JSON.stringify(args.p)); window.__saves.push(p);
      var key = p.key || ('st_t' + (++n)), rows = FX.crm_email_templates, r = rows.filter(function (x) { return x.key === key; })[0];
      if (!r) { r = { key: key, created_by: me, created_at: '2026-09-25T20:00:00Z', sort: p.one_off ? 900 : 300 }; rows.push(r); }
      Object.assign(r, { name: p.name, kind: p.kind, subject: p.subject, preheader: p.preheader, html_body: p.html_body, text_body: p.text_body, design: p.design, vars: p.vars, one_off: p.one_off, audience: p.audience,
        category: p.one_off ? null : (p.category || 'other'), lang: p.lang, description: p.description, active: p.active, updated_at: '2026-09-25T20:00:' + ('0' + (window.__saves.length % 60)).slice(-2) + 'Z' });
      return new Promise(function (res) { setTimeout(function () { res({ data: { key: key, updated_at: r.updated_at, one_off: p.one_off }, error: null }); }, 20); });
    }
    if (fn === 'email_studio_remove') { window.__removes.push(args.p_key); FX.crm_email_templates = FX.crm_email_templates.filter(function (x) { return x.key !== args.p_key; }); return Promise.resolve({ data: { key: args.p_key, deleted: true, switched_off: false }, error: null }); }
    return rpc0(fn, args);
  };
  var from0 = db.from.bind(db);
  db.from = function (t) { var q = from0(t); if (t === 'crm_campaigns') { var ins = q.insert.bind(q); q.insert = function (p) { var row = Object.assign({ id: 991 }, JSON.parse(JSON.stringify(p))); window.__camps.push(row); FX.crm_campaigns.push(row); return ins(row); }; }
    if (t === 'app_config') { var up = q.upsert.bind(q); q.upsert = function (p, o) { var row = JSON.parse(JSON.stringify(p)); window.__cfg.push({ row: row, opts: o || null }); var cur = FX.app_config.filter(function (x) { return x.key === row.key; })[0]; if (cur) Object.assign(cur, row); else FX.app_config.push(row); return up(p, o); }; }
    if (t === 'change_log') { var ins2 = q.insert.bind(q); q.insert = function (p) { window.__clog.push(JSON.parse(JSON.stringify(p))); return ins2(p); }; }
    return q; };
  function A(o) { return o; }
  window.__aiAnswer = function (body) {
    var txt = body.messages[0].content[0].text;
    if (/The writer asks:/.test(txt)) return A({ subject: 'Short: Sunday needs you', preheader: 'Three servers wanted', blocks: [
      { type: 'hero', kicker: 'Sunday 11 October', lines: ['Sunday', 'needs you'], lead: 'Three servers wanted.', doodle: 'star' },
      { type: 'text', text: 'Hi {{first_name|there}},\\n\\nWe serve on Sunday 11 October.' }, { type: 'photo', photo: 0, alt: '' },
      { type: 'button', label: 'Sign up to serve', url: 'https://welfareavenue.com/volunteer/', caption: 'Two minutes' }, { type: 'signoff', closing: 'Warmly,', name: 'Steel MacDonald', role: 'Welfare Avenue' }], questions: [], notes: 'Shorter.' });
    if (/answered your questions/.test(txt)) return A({ subject: 'Sunday needs you, {{first_name|friend}}', preheader: 'Servers wanted for 11 October', blocks: [
      { type: 'hero', kicker: 'Sunday 11 October', lines: ['Sunday', 'needs you'], lead: 'We are short three servers.', doodle: 'star' },
      { type: 'text', text: 'Hi {{first_name|there}},\\n\\nWe serve on Sunday 11 October at Cabot Square, and we need three more servers.' }, { type: 'photo', photo: 0, alt: '' },
      { type: 'button', label: 'Sign up to serve', url: 'https://welfareavenue.com/volunteer/', caption: 'Two minutes' }, { type: 'signoff', closing: 'Warmly,', name: 'Steel MacDonald', role: 'Welfare Avenue' }], questions: [], notes: 'Your answers are in.' });
    if (/Fill in this template/.test(txt)) return A({ name: '11 October call-out', subject: 'Amara, can you help on Sunday 11 October?', preheader: 'We need 3 more servers for Sunday 11 October.', blocks: [
      { type: 'hero', style: 'green', kicker: 'Sunday 11 October', lines: ['We need', 'more hands'], lead: 'We are short 3 servers for Sunday 11 October.', doodle: 'star' },
      { type: 'text', text: 'Hi {{first_name|there}},\\n\\nThe first cold Sunday of the fall.' }, { type: 'details', rows: [{ label: 'When', value: 'Sunday 11 October, 11 am to 2 pm' }, { label: 'Where', value: 'Cabot Square' }] },
      { type: 'button', label: 'Sign up to serve', url: 'https://welfareavenue.com/volunteer/', caption: 'Your volunteer hours count.' }, { type: 'signoff', closing: 'Warmly,', name: 'Steel MacDonald', role: 'Welfare Avenue' }], questions: [], notes: '' });
    return A({ name: '11 October call-out', subject: 'Sunday needs you, {{first_name|friend}}', preheader: 'Servers wanted for 11 October', blocks: [
      { type: 'hero', kicker: 'Sunday 11 October', lines: ['Sunday', 'needs you'], lead: 'We are short three servers.', doodle: 'star' },
      { type: 'text', text: 'Hi {{first_name|there}},\\n\\nWe serve on Saturday 11 October at Cabot Square.' }, { type: 'photo', photo: 0, alt: '' },
      { type: 'button', label: 'Sign up to serve', url: '', caption: 'Two minutes' }, { type: 'signoff', closing: 'Warmly,', name: '[Who signs it]', role: 'Welfare Avenue' }],
      questions: [{ ask: 'Is it Saturday or Sunday 11 October?', why: '11 October 2026 is a Sunday.', hint: 'Sunday' }, { ask: 'Where should the button go?', why: 'No sign-up link was given.', hint: 'https://welfareavenue.com/volunteer/' }],
      notes: 'I kept your words and left two gaps.' });
  };
  var SET = { mail_mode: 'test', mail_from_name: 'Welfare Avenue', mail_from_email: 'info@welfareavenue.com', mail_reply_to: 'info@welfareavenue.com', mail_test_recipients: 'steelmacdonald@gmail.com, steel.macdonald@welfareavenue.com', mail_daily_cap: '100', mail_campaign_daily_cap: '80' };
  window.__WA_INVOKE = function (name, opts) {
    var b = JSON.parse(JSON.stringify((opts && opts.body) || {}));
    var later = function (v) { return new Promise(function (res) { setTimeout(function () { res(v); }, 40); }); };
    if (name === 'mybox') { window.__mybox.push(b); if (b.action === 'voice') return later({ data: { voice: ${JSON.stringify(GUIDE)}, framework: 'wa-writing' }, error: null }); return later({ data: { ok: true }, error: null }); }
    if (name === 'llm') { window.__llm.push({ headers: opts.headers, body: b }); return later({ data: { content: [{ type: 'tool_use', id: 't1', name: 'build_email', input: window.__aiAnswer(b) }] }, error: null }); }
    if (name === 'mail-send') {
      window.__mail.push(b);
      if (b.action === 'settings') return later({ data: { settings: SET, key_present: true, domain: null, admin: true, me: me, last30: {} }, error: null });
      if (b.action === 'preview') return later({ data: { subject: b.subject || 'S', preheader: '', html: '<!DOCTYPE html><html><body><p>Preview of ' + (b.template_key || '') + '</p></body></html>', text: 'x', kind: b.kind || 'newsletter', from: 'Welfare Avenue <info@welfareavenue.com>' }, error: null });
      if (b.action === 'test') return later({ data: { send_id: 401, status: 'sent', to: b.to }, error: null });
      if (b.action === 'send') return later(b.contact_id === 5001 ? { data: { send_id: 402, status: 'sent', to: 'amara.okafor@example.com', basis: 'express consent' }, error: null } : { data: { status: 'suppressed', basis: 'no consent recorded', to: 'elodie.gagnon@example.com' }, error: null });
      if (b.action === 'campaign_check') return later({ data: { audience: 3, eligible: 2, held: 1, duplicates: 0, why: { unsubscribed: 1 }, mode: 'test', per_day: 80, days: 1, usage: { room: 80 } }, error: null });
      return later({ data: { ok: true }, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  };
  return true;
})()`;
const text = (f, s) => f.ev(x => { const el = document.querySelector(x); return el ? el.innerText.replace(/\s+/g, ' ').trim() : null; }, s);
const click = (f, s) => f.ev(x => { const el = document.querySelector(x); if (!el) return false; el.click(); return true; }, s);
const setv = (f, s, v) => f.ev(([x, val]) => { const el = document.querySelector(x); if (!el) return false; el.value = val; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; }, [s, v]);
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (f, fn, arg, ms) => { try { await f.page.waitForFunction(fn, arg, { timeout: ms || 6000 }); return true; } catch (e) { return false; } };
const SS = f => f.ev(() => { const s = window.w202.state(); return { view: s.view, key: s.d && s.d.key, subject: s.d && s.d.subject, blocks: s.d ? s.d.design.blocks.map(b => b.type) : [], q: (s.questions || []).length, ro: !!s.ro, dirty: !!s.dirty, msg: s.msg, err: s.err, send: s.send ? s.send.tab : null }; });

/* wave204: w204drive.js reuses the fixture, the fakes and the helpers */
module.exports = { fixture, FAKE, text, click, setv, wait, until, SS, GUIDE, VOICE };
if (require.main === module) (async () => {
  const browser = await launch();
  const cand = process.env.CAND || undefined;

  /* ---------- 1. an admin: the front page ---------- */
  let f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(), candidate: cand, wait: 4000 });
  await f.ev(FAKE);
  await f.hash('#crm/studio', 2600);
  let b = await f.ev(() => ({
    rail: [...document.querySelectorAll('#w153rail .w153it')].map(a => a.textContent.trim() + (a.classList.contains('on') ? '*' : '')),
    tab: (document.querySelector('#crm .w152tabs button.on') || {}).textContent, root: !!document.querySelector('#crm #w202root .w202'),
    ways: [...document.querySelectorAll('#crm .w202way b')].map(x => x.textContent), shelves: [...document.querySelectorAll('#crm .w202shelf h4')].map(x => x.textContent.replace(/\s+/g, ' ').trim()),
    cards: document.querySelectorAll('#crm .w202card').length, ready: [...document.querySelectorAll('#crm .w202card')].filter(c => /Ready as is/.test(c.textContent)).map(c => c.querySelector('.w202cb b').textContent),
    recent: [...document.querySelectorAll('#crm .w202rrow')].map(r => r.innerText.replace(/\s+/g, ' ')), mic: window.w201 ? window.w201.targets : null
  }));
  ok('the CRM rail lists Studio under Email and marks it', b.rail.join('|') === 'Contacts|Partners|Possible duplicates|Sources|Lists|Forms|Gifts|Email|Studio*|Campaigns|Automations|Reports', b.rail);
  ok('the CRM marks its Studio tab and draws the studio in #w202root', /Studio/.test(b.tab || '') && b.root, b);
  ok('the front page offers three ways to start', b.ways.join('|') === 'Tell the Hub|Start from a template|Build it yourself', b.ways);
  ok('the ten starters sit on Steel’s four shelves', b.cards === 10 && b.shelves.length === 4 && /^Volunteers: welcome and serving 3/.test(b.shelves[0]) && /^Volunteers: call-outs and events 2/.test(b.shelves[1]) && /^Donors: thanks and impact 3/.test(b.shelves[2]) && /^Donors: appeals and events 2/.test(b.shelves[3]), b);
  ok('the three with nothing to fill in are Ready as is (welcome, reminder, gift thanks)', b.ready.join('|') === 'Welcome, new volunteer|Reminder before a serving|Thank you for a gift', b.ready);
  ok('the recent emails list Joy’s one-off (and no template)', b.recent.length === 1 && /Joy’s October news/.test(b.recent[0]) && /joy\.dumansi/.test(b.recent[0]), b.recent);
  ok('the shared mic knows the studio’s boxes', (b.mic || []).indexOf('[data-w202say]') >= 0, b.mic);
  await shot(f, '01-home', true);
  await click(f, '#crm [data-w202filter="donors"]'); await wait(300);
  b = await f.ev(() => ({ cards: document.querySelectorAll('#crm .w202card').length, shelves: [...document.querySelectorAll('#crm .w202shelf h4')].map(x => x.textContent.replace(/\s+\d+$/, '')) }));
  ok('Donors shows the five donor starters on their two shelves', b.cards === 5 && b.shelves.join('|') === 'Donors: thanks and impact|Donors: appeals and events', b);
  await click(f, '#crm [data-w202filter="all"]'); await wait(200);
  await click(f, '#crm [data-w202peek="st_appeal"]'); await wait(500);
  b = await f.ev(() => { const fr = document.querySelector('#crm .w202modal iframe'); return { open: !!document.querySelector('#crm .w202modal'), html: fr ? fr.getAttribute('srcdoc') : '', fill: !!document.querySelector('#crm .w202modal [data-w202fill="st_appeal"]') }; });
  ok('Look shows the appeal as it will arrive, with Fill it in', b.open && /Help us/.test(b.html) && /serve <span[^>]*>mor<img[^>]*alt="E"/i.test(b.html) && /registered charity/.test(b.html) && b.fill, { open: b.open, fill: b.fill });
  await f.page.keyboard.press('Escape'); await wait(300);
  ok('Escape closes the look', !(await f.ev(() => !!document.querySelector('#crm .w202modal'))));
  /* the voices (wave203) */
  b = await f.ev(() => ({ btn: (document.querySelector('#crm .w202intro [data-w202voices]') || {}).innerText || '' }));
  ok('the studio shows its Voices: Welfare Avenue and, for Steel, My voice', /Voices/.test(b.btn) && /Welfare Avenue/.test(b.btn) && /My voice/.test(b.btn), b);
  await click(f, '#crm .w202intro [data-w202voices]'); await wait(500);
  b = await f.ev(() => { const m = document.querySelector('#crm .w202voices'); return { open: !!m, txt: m ? ((m.querySelector('.w202vread') || {}).textContent || '') : '', edit: !!(m && m.querySelector('[data-w202vedit]')), tabs: m ? [...m.querySelectorAll('[data-w202vtab]')].map(x => x.textContent + (x.classList.contains('on') ? '*' : '')) : [] }; });
  ok('Voices opens on the Welfare Avenue voice code, with Edit for an admin', b.open && /WELFARE AVENUE VOICE CODE/.test(b.txt) && /Warmth with purpose/.test(b.txt) && b.edit && b.tabs.join('|') === 'Welfare Avenue*|My voice', { open: b.open, edit: b.edit, tabs: b.tabs, len: b.txt.length });
  await shot(f, '01b-voices');
  await click(f, '#crm [data-w202vtab="mine"]'); await wait(300);
  b = await f.ev(() => ({ txt: (document.querySelector('#crm .w202voices .w202vread') || {}).textContent || '', mb: window.__mybox.map(x => x.action) }));
  ok('My voice shows Steel’s own writing guide, read through mybox’s voice action', /TESTGUIDE/.test(b.txt) && b.mb.indexOf('voice') >= 0, b);
  await f.page.keyboard.press('Escape'); await wait(300);
  ok('Escape closes the voices', !(await f.ev(() => !!document.querySelector('#crm .w202voices'))));

  /* ---------- 2. Tell the Hub ---------- */
  await click(f, '#crm [data-w202go="#crm/studio/ai"]'); await wait(900);
  b = await f.ev(() => ({ hash: location.hash, say: !!document.querySelector('#crm textarea[data-w202say="brief"]'), aud: (document.querySelector('#crm [data-w202aud].on') || {}).textContent, kind: (document.querySelector('#crm [data-w202kind="start"]') || {}).value }));
  ok('Tell the Hub opens at #crm/studio/ai with the box, Volunteers and a call-out', b.hash === '#crm/studio/ai' && b.say && b.aud === 'Volunteers' && b.kind === 'volunteer', b);
  b = await f.ev(() => [...document.querySelectorAll('#crm [data-w202voice]')].map(x => x.textContent + (x.classList.contains('on') ? '*' : '')));
  ok('Tell the Hub offers the voices: Welfare Avenue (chosen) and My voice', b.join('|') === 'Welfare Avenue*|My voice', b);
  await click(f, '#crm [data-w202startai]'); await wait(300);
  ok('too few words: the Hub asks for your content first before calling the AI (wave204: 40 words)', /Bring your content first/.test(await text(f, '#crm .w152err') || '') && (await f.ev(() => window.__llm.length)) === 0);
  await setv(f, '#crm textarea[data-w202say="brief"]', 'We need three more servers this Saturday 11 October at Cabot Square, 11 to 2. Sign up on the website. It is the first cold Sunday of the fall and the line will be long, so we want every table covered. Servers plate the meals and share the table with our community.');
  await click(f, '#crm [data-w202pickstart]'); await wait(700);
  b = await f.ev(() => ({ cells: document.querySelectorAll('#crm .w202pcell').length, badge: (document.querySelector('#crm .w202pcell.notready em') || {}).textContent }));
  ok('the photo picker shows the Photo library, ready ones first, the others marked', b.cells === 2 && b.badge === 'consent', b);
  await click(f, '#crm [data-w202libpick="9"]'); await wait(400);
  ok('a picked photo joins the email’s photos', (await f.ev(() => window.w202.state().start.photos.length)) === 1);
  await shot(f, '02-tell');
  await click(f, '#crm [data-w202startai]');
  await until(f, () => /^#crm\/studio\/e\/st_t/.test(location.hash), null, 8000); await wait(900);
  b = await f.ev(() => { const l = window.__llm[0] || {}; const m = l.body && l.body.messages && l.body.messages[0]; return {
    task: l.headers && l.headers['x-wa-task'], caller: l.headers && l.headers['x-wa-caller'], tool: l.body && l.body.tools && l.body.tools[0].name, choice: l.body && l.body.tool_choice && l.body.tool_choice.name,
    txt: m ? m.content[0].text : '', sys: l.body && l.body.system, save: window.__saves[0], hash: location.hash }; });
  ok('the AI is asked through the llm router (email_studio, email-studio) with the build_email tool', b.task === 'email_studio' && b.caller === 'email-studio' && b.tool === 'build_email' && b.choice === 'build_email', b);
  ok('the message carries the words, the audience, the kind and the library photo by index', /three more servers this Saturday/.test(b.txt) && /Audience: Volunteers/.test(b.txt) && /A volunteer call-out/.test(b.txt) && /0: from our Photo library, "Two volunteers plating food"/.test(b.txt), b.txt);
  ok('the system prompt holds the facts rule, the voice and today (25 September 2026)', /never invent a date/.test(b.sys || '') && /No em dashes/.test(b.sys || '') && /Friday 25 September 2026/.test(b.sys || ''), (b.sys || '').slice(0, 300));
  ok('the system prompt carries the Welfare Avenue voice code (the default) and the words that hold whatever the voice', /VOICE: Welfare Avenue's house voice/.test(b.sys || '') && /Warmth with purpose/.test(b.sys || '') && /Whatever the voice/.test(b.sys || '') && !/TESTGUIDE/.test(b.sys || ''), (b.sys || '').slice(600, 900));
  ok('the draft keeps the voice it was written in (Welfare Avenue), never the voice’s text', b.save && b.save.design.voice === 'wa' && !/Warmth with purpose/.test(JSON.stringify(b.save.design)), b.save && b.save.design.voice);
  ok('the Hub checks the writer’s dates itself and tells the AI (11 October 2026 is a Sunday), the coming days are written out, and no claims the writer did not make',
    /The Hub checked the dates/.test(b.txt) && /"Saturday 11 October": 11 October 2026 is a Sunday, not a Saturday\./.test(b.txt) && /the next three weeks: Saturday 26 September, Sunday 27 September, /.test(b.sys || '') &&
    /Add no claims the writer did not make/.test(b.sys || '') && !/short reassurance/.test(b.sys || ''), { txt: b.txt.slice(-400), sys: (b.sys || '').slice(1200, 2400) });
  ok('the draft is saved through email_studio_save as a one-off call-out with its design, HTML and text', b.save && b.save.key === '' && b.save.one_off === true && b.save.kind === 'volunteer' && b.save.design.blocks.length === 5 &&
    />Sunday</.test(b.save.html_body) && /alt="E"/.test(b.save.html_body) && /plating\.jpg/.test(b.save.html_body) && /Hi \{\{first_name\|there\}\},/.test(b.save.text_body) && b.hash === '#crm/studio/e/st_t1', b.save && { key: b.save.key, one_off: b.save.one_off, kind: b.save.kind, n: b.save.design.blocks.length });
  b = await f.ev(() => ({ q: [...document.querySelectorAll('#crm .w202q [data-w202qa]')].length, notes: (document.querySelector('#crm .w202q p.m') || {}).textContent, checks: [...document.querySelectorAll('#crm .w202checks li.stop')].map(x => x.textContent),
    head: (document.querySelector('#crm .w202checks > b') || {}).textContent, frame: (document.getElementById('w202frame') || {}).getAttribute && document.getElementById('w202frame').getAttribute('srcdoc'), alt: window.w202.state().d.design.blocks[2].alt }));
  ok('the Hub’s two questions and its note show above the email', b.q === 2 && /two gaps/.test(b.notes || ''), b);
  ok('the checks stop it: Saturday 11 October is a Sunday, the [bracket], the button with no link', b.checks.some(c => /Saturday 11 October.*is a Sunday, not a Saturday/.test(c)) && b.checks.some(c => /Fill in: Who signs it/.test(c)) && b.checks.some(c => /has no link/.test(c)) && /3 things to fix/.test(b.head || ''), b.checks);
  ok('the photo keeps the library’s description, and the preview is the full email with its parts marked', b.alt === 'Two volunteers plate food side by side' && /data-w202b="0"/.test(b.frame || '') && /registered charity/.test(b.frame || '') && /Alex/.test(b.frame || ''), b.alt);
  await shot(f, '03-editor', true);

  /* the Hub puts the answers in */
  await setv(f, '#crm .w202q [data-w202qa]', 'Sunday');
  await click(f, '#crm [data-w202answers]');
  await until(f, () => window.__llm.length >= 2 && !window.w202.state().busy, null, 6000); await wait(500);
  b = await f.ev(() => ({ txt: window.__llm[1].body.messages[0].content[0].text, q: document.querySelectorAll('#crm .w202q [data-w202qa]').length, stops: document.querySelectorAll('#crm .w202checks li.stop').length, msg: (document.querySelector('#crm .w154msg') || {}).textContent }));
  ok('Put my answers in sends the email and the answers back, and the stops clear', /answered your questions/.test(b.txt) && /Is it Saturday or Sunday 11 October\? Sunday/.test(b.txt) && /"photo":0/.test(b.txt) && b.q === 0 && b.stops === 0 && /answers are in/.test(b.msg || ''), b);

  /* editing */
  await click(f, '#crm [data-w202tog="1"]'); await wait(300);
  await setv(f, '#crm textarea[data-w202f="1.text"]', 'Hi {{first_name|there}},\n\nWe serve on Sunday 11 October at Cabot Square. **Bring a friend.**');
  await wait(900);
  b = await f.ev(() => ({ frame: document.getElementById('w202frame').getAttribute('srcdoc'), dirty: window.w202.state().dirty }));
  ok('typing in a block updates the preview (bold in the brand green)', /Bring a friend\.<\/strong>/.test(b.frame) && /color:#103F39;font-weight:700;">Bring a friend/.test(b.frame), b.dirty);
  await until(f, () => window.__saves.some(x => /Bring a friend/.test(x.html_body)), null, 5000);
  ok('the change saves by itself a moment later (the key kept)', await f.ev(() => window.__saves.some(x => /Bring a friend/.test(x.html_body) && x.key === 'st_t1')));
  await click(f, '#crm [data-w202add="quote"]'); await wait(400);
  b = await SS(f);
  ok('Add a block puts a quote after the open block, open', b.blocks.join(',') === 'hero,text,quote,photo,button,signoff', b.blocks);
  await click(f, '#crm [data-w202mv="2,-1"]'); await wait(300);
  b = await SS(f); ok('a block moves up', b.blocks.join(',') === 'hero,quote,text,photo,button,signoff', b.blocks);
  await click(f, '#crm [data-w202dup="1"]'); await wait(300);
  b = await SS(f); ok('a block is copied', b.blocks.join(',') === 'hero,quote,quote,text,photo,button,signoff', b.blocks);
  await click(f, '#crm [data-w202del="1"]'); await wait(200); await click(f, '#crm [data-w202del="1"]'); await wait(300);
  b = await SS(f); ok('blocks are removed', b.blocks.join(',') === 'hero,text,photo,button,signoff', b.blocks);
  /* a click in the preview opens that block */
  await f.ev(() => { const d = document.getElementById('w202frame').contentDocument; const el = d.querySelector('[data-w202b="3"] a') || d.querySelector('[data-w202b="3"]'); el.click(); });
  await wait(500);
  ok('a click on the button in the preview opens the Button block', await f.ev(() => !!document.querySelector('#crm .w202blk.open[data-w202blk="3"]')));
  /* Ask the Hub to change it, then Undo */
  await setv(f, '#crm textarea[data-w202say="change"]', 'Make it shorter');
  await click(f, '#crm [data-w202change]');
  await until(f, () => window.__llm.length >= 3 && !window.w202.state().busy, null, 6000); await wait(400);
  b = await f.ev(() => ({ txt: window.__llm[2].body.messages[0].content[0].text, subject: window.w202.state().d.subject, undo: !!document.querySelector('#crm [data-w202undo]') }));
  ok('Ask the Hub to change it sends the instruction and the email; Undo is offered', /The writer asks: Make it shorter/.test(b.txt) && b.subject === 'Short: Sunday needs you' && b.undo, b);
  await click(f, '#crm [data-w202undo]'); await wait(400);
  ok('Undo puts the email back', (await f.ev(() => window.w202.state().d.subject)) === 'Sunday needs you, {{first_name|friend}}');

  /* ---------- 3. Send or save ---------- */
  await click(f, '#crm [data-w202sendopen]'); await wait(600);
  b = await f.ev(() => ({ tabs: [...document.querySelectorAll('#crm .w202stabs button')].map(x => x.textContent.trim()), on: (document.querySelector('#crm .w202stabs button.on') || {}).textContent }));
  ok('Send or save offers a test, one person, a list and a template', b.tabs.join('|') === 'Send me a test|One person|A list|Save as a template' && /test/.test(b.on || ''), b);
  await click(f, '#crm [data-w202dotest]');
  await until(f, () => window.__mail.some(m => m.action === 'test'), null, 5000); await wait(300);
  b = await f.ev(() => ({ call: window.__mail.filter(m => m.action === 'test')[0], msg: (document.querySelector('#crm .w202send .w154msg') || {}).textContent }));
  ok('Send me a test saves, then sends mail-send test with the studio’s template to the writer', b.call && b.call.template_key === 'st_t1' && b.call.to === 'steel.macdonald@welfareavenue.com' && /Test sent/.test(b.msg || ''), b);
  await click(f, '#crm [data-w202stab="person"]'); await wait(300);
  ok('One person warns that test mode only reaches the test recipients', /Test mode: email goes only to the test recipients/.test(await text(f, '#crm .w202send') || ''));
  await setv(f, '#crm [data-w202who]', 'amara'); await wait(300);
  await click(f, '#crm [data-w202whopick="5001"]'); await wait(300);
  b = await f.ev(() => ({ who: (document.querySelector('#crm .w202who') || {}).innerText, perm: (document.querySelector('#crm .w202perm') || {}).innerText }));
  ok('picking Amara shows her and what the permission rule says', /Amara Okafor/.test(b.who || '') && /They can get it/.test(b.perm || ''), b);
  await click(f, '#crm [data-w202doperson]');
  await until(f, () => window.__mail.some(m => m.action === 'send'), null, 5000); await wait(300);
  b = await f.ev(() => ({ call: window.__mail.filter(m => m.action === 'send')[0], msg: (document.querySelector('#crm .w202send .w154msg') || {}).textContent }));
  ok('Send it to Amara goes through mail-send send with her contact and the template', b.call && b.call.contact_id === 5001 && b.call.template_key === 'st_t1' && /Sent to amara/.test(b.msg || ''), b);
  await click(f, '#crm [data-w202stab="list"]'); await wait(300);
  await setv(f, '#crm [data-w202list]', '71'); await wait(300);
  await click(f, '#crm [data-w202docamp]');
  await until(f, () => location.hash === '#crm/campaigns/991', null, 6000); await wait(1500);
  b = await f.ev(() => ({ camp: window.__camps[0], hash: location.hash, card: (document.querySelector('#crm .w155studio') || {}).innerText, headline: !!document.querySelector('#crm [data-w155k="headline"]'), subject: (document.querySelector('#crm [data-w155k="subject"]') || {}).value }));
  ok('A list makes a campaign draft with the studio’s template, kind and subject', b.camp && b.camp.template_key === 'st_t1' && b.camp.list_id === 71 && b.camp.kind === 'volunteer' && b.camp.status === 'draft' && /Sunday needs you/.test(b.camp.subject), b.camp);
  ok('the campaign opens in Campaigns with the studio card in place of the headline, message and button', b.hash === '#crm/campaigns/991' && /designed in the email studio/.test(b.card || '') && !b.headline && /Sunday needs you/.test(b.subject || ''), b);
  await shot(f, '04-campaign');
  /* the campaign editor keeps the studio's template when it saves */
  await click(f, '#crm [data-w155cprev]'); await wait(900);
  b = await f.ev(() => window.__mail.filter(m => m.action === 'preview').pop());
  ok('the campaign’s preview asks mail-send for the studio’s template', b && b.template_key === 'st_t1' && b.vars && b.vars.studio === true && !b.vars.headline, b);

  /* save as a template */
  await f.hash('#crm/studio/e/st_t1', 1500);
  await click(f, '#crm [data-w202sendopen]'); await wait(400);
  await click(f, '#crm [data-w202stab="template"]'); await wait(300);
  await setv(f, '#crm [data-w202t="name"]', 'Sunday call-out');
  await setv(f, '#crm [data-w202t="description"]', 'When a Sunday is short of servers');
  await setv(f, '#crm [data-w202t="category"]', 'volunteers_callouts');
  await click(f, '#crm [data-w202dotpl]');
  await until(f, () => window.__saves.some(s => s.one_off === false), null, 5000); await wait(500);
  b = await f.ev(() => ({ s: window.__saves.filter(s => s.one_off === false).pop(), msg: (document.querySelector('#crm .w202send .w154msg') || {}).textContent }));
  ok('Save as a template saves it off the one-offs, on its shelf, with its name', b.s && b.s.key === 'st_t1' && b.s.category === 'volunteers_callouts' && b.s.name === 'Sunday call-out' && /automations can send it/.test(b.msg || ''), b.s && { key: b.s.key, cat: b.s.category, name: b.s.name });
  await f.hash('#crm/studio', 1500);
  b = await f.ev(() => [...document.querySelectorAll('#crm .w202shelf')].map(s => s.querySelector('h4').textContent.replace(/\s+/g, ' ') + ':' + [...s.querySelectorAll('.w202cb b')].map(x => x.textContent).join('/')));
  ok('the saved template is on the call-outs shelf', b.some(s => /^Volunteers: call-outs and events 3:.*Sunday call-out/.test(s)), b);
  /* remove it */
  await f.hash('#crm/studio/e/st_t1', 1200);
  await click(f, '#crm [data-w202rm]'); await wait(300);
  ok('Remove asks first, saying automations stop sending it', /Automations that use it stop sending it/.test(await text(f, '#crm .w202cf') || ''));
  await click(f, '#crm [data-w202delyes]'); await wait(1200);
  b = await f.ev(() => ({ rm: window.__removes, hash: location.hash, msg: (document.querySelector('#crm .w154msg') || {}).textContent }));
  ok('Yes removes it through email_studio_remove and goes back to the studio', b.rm[0] === 'st_t1' && b.hash === '#crm/studio' && /deleted/.test(b.msg || ''), b);

  /* ---------- 4. Start from a template ---------- */
  await f.hash('#crm/studio/tpl/st_callout', 1500);
  b = await f.ev(() => ({ asks: [...document.querySelectorAll('#crm [data-w202ask]')].map(x => x.getAttribute('data-w202ask')), on: (document.querySelector('#crm .w202trow.on') || {}).getAttribute && document.querySelector('#crm .w202trow.on').getAttribute('data-w202tplpick'), rows: document.querySelectorAll('#crm .w202trow').length }));
  ok('the template start lists the templates and asks the call-out’s four details', b.rows === 10 && b.on === 'st_callout' && b.asks.join(',') === 'date,roles,where,why', b);
  await setv(f, '#crm [data-w202ask="date"]', 'Sunday 11 October, 11 am to 2 pm');
  await setv(f, '#crm [data-w202ask="roles"]', '3 servers');
  await click(f, '#crm [data-w202starttpl="ai"]'); await wait(300);
  ok('wave204: with details still empty, Fill it in with the Hub asks for your content first', /Give the template your details first: 2 of 4 still empty/.test(await text(f, '#crm .w152err') || '') && (await f.ev(() => window.__llm.length)) === 3, await text(f, '#crm .w152err'));
  await setv(f, '#crm [data-w202ask="where"]', 'Cabot Square');
  await setv(f, '#crm [data-w202ask="why"]', 'The first cold Sunday of the fall, so the line will be long.');
  await click(f, '#crm [data-w202starttpl="ai"]');
  await until(f, () => /^#crm\/studio\/e\/st_t/.test(location.hash) && window.__llm.length >= 4, null, 8000); await wait(800);
  b = await f.ev(() => ({ txt: window.__llm[3].body.messages[0].content[0].text, s: window.w202.state().d, hash: location.hash }));
  ok('Fill it in with the Hub sends the template, its words and the details', /Fill in this template/.test(b.txt) && /"We need","more hands"/.test(b.txt) && /Which serving, and when\? Sunday 11 October, 11 am to 2 pm/.test(b.txt) && /3 servers/.test(b.txt), b.txt.slice(0, 400));
  ok('the filled call-out opens, remembers its template and has nothing left to fix', b.s.design.from === 'st_callout' && b.s.kind === 'volunteer' && /Sunday 11 October/.test(b.s.subject) && (await f.ev(() => window.w202.checks().filter(c => c.lvl === 'stop').length)) === 0, { from: b.s.design.from, subject: b.s.subject });
  await f.hash('#crm/studio/tpl/st_appeal', 1300);
  await click(f, '#crm [data-w202starttpl="self"]'); await wait(1500);
  b = await f.ev(() => ({ stops: window.w202.checks().filter(c => c.lvl === 'stop').map(c => c.msg), name: window.w202.state().d.name, key: window.w202.state().d.key }));
  ok('Fill it in myself copies the appeal; the checks list every bracket to fill', /^st_t/.test(b.key || '') && b.name === 'Appeal' && b.stops.some(m => /Fill in: The ask in a few words/.test(m)) && b.stops.some(m => /Fill in: Who signs it/.test(m)) && b.stops.length >= 5, b);
  /* Use it on a ready template */
  await f.hash('#crm/studio', 1200);
  await click(f, '#crm [data-w202use="st_welcome_volunteer"]'); await wait(1500);
  b = await f.ev(() => ({ d: window.w202.state().d, stops: window.w202.checks().filter(c => c.lvl === 'stop').length }));
  ok('Use it copies the welcome as a new one-off with nothing to fix', b.d.one_off === true && b.d.design.from === 'st_welcome_volunteer' && /^st_t/.test(b.d.key || '') && b.stops === 0, { key: b.d.key, stops: b.stops });
  /* Build it yourself */
  await f.hash('#crm/studio', 1200);
  const nSaves = await f.ev(() => window.__saves.length);
  await click(f, '#crm [data-w202blank]'); await wait(1200);
  b = await f.ev(() => ({ hash: location.hash, ss: (document.getElementById('w202ss') || {}).innerText, blocks: window.w202.state().d.design.blocks.map(x => x.type), saves: window.__saves.length, open: document.querySelectorAll('#crm .w202blk.open').length }));
  ok('Build it yourself starts a headline, text, a button and your sign-off, not saved until it has a subject', b.hash === '#crm/studio/e/new' && /needs a subject/.test(b.ss || '') && b.blocks.join(',') === 'hero,text,button,signoff' && b.saves === nSaves && b.open === 1, b);
  await setv(f, '#crm [data-w202e="subject"]', 'Our fall in a minute');
  await until(f, n => window.__saves.length > n, nSaves, 5000); await wait(400);
  ok('a subject lets it save', await f.ev(() => /^st_t/.test(window.w202.state().d.key || '') && /^#crm\/studio\/e\/st_t/.test(location.hash)));

  /* ---------- 5. a contact's page, the automations ---------- */
  await f.hash('#crm', 1500);
  await f.ev(() => window.w152.mailForm(5001)); await wait(1200);
  b = await f.ev(() => ({ opts: [...document.querySelectorAll('[data-w154tplsel] option')].map(o => o.value), link: (document.querySelector('[data-w202fromcontact]') || {}).getAttribute && document.querySelector('[data-w202fromcontact]').getAttribute('href') }));
  ok('a contact’s Send an email lists ready templates, never a one-off, a fill-in template or the itinerary carrier', b.opts.indexOf('st_welcome_volunteer') >= 0 && b.opts.indexOf('st_gift_thanks') >= 0 && b.opts.indexOf('st_appeal') < 0 && b.opts.indexOf('st_joyoneoff1') < 0 && b.opts.indexOf('volunteer_itinerary') < 0 && b.opts.indexOf('test') < 0 && !b.opts.some(k => /^st_t/.test(k)), b.opts);
  ok('it offers to write one in the studio for them', b.link === '#crm/studio/ai/to/5001', b.link);
  await click(f, '[data-w202fromcontact]'); await wait(1200);
  b = await f.ev(() => ({ hash: location.hash, to: window.w202.state().to, view: window.w202.state().view, sheet: window.w152.state().sheet }));
  ok('the link opens Tell the Hub for that person', b.hash === '#crm/studio/ai/to/5001' && b.to === '5001' && b.view === 'ai' && !b.sheet, b);
  await setv(f, '#crm textarea[data-w202say="brief"]', 'Thank Amara for serving three Sundays in a row and ask her to lead a table on Sunday 11 October. She knows the setup, she is calm with a long line, and the newer servers already go to her with questions, so leading a table would make it official.');
  await click(f, '#crm [data-w202startai]');
  await until(f, () => /^#crm\/studio\/e\/st_t/.test(location.hash), null, 8000); await wait(900);
  b = await f.ev(() => ({ send: window.w202.state().send, who: (document.querySelector('#crm .w202who') || {}).innerText }));
  ok('the email opens with Send or save on One person, Amara chosen', b.send && b.send.tab === 'person' && String(b.send.contact) === '5001' && /Amara Okafor/.test(b.who || ''), b.send && { tab: b.send.tab, c: b.send.contact });
  await f.hash('#crm/automations/1', 1800);
  await f.ev(() => { const el = document.querySelector('#crm [data-w196sel="0"]'); if (el) el.click(); }); await wait(500);
  b = await f.ev(() => [...((document.querySelector('#crm [data-w157si="0"] [data-w157s="_email"]') || {}).options || [])].map(o => o.value));
  ok('the automations’ saved emails: ready templates (the welcome is chosen), no fill-in template, no one-off', b.indexOf('tpl:st_welcome_volunteer') >= 0 && b.indexOf('tpl:st_serving_reminder') >= 0 && b.indexOf('tpl:st_appeal') < 0 && b.indexOf('tpl:st_joyoneoff1') < 0 && !b.some(v => /^tpl:st_t/.test(v)), b);
  /* ---------- 5b. My voice, and the house voice edited (wave203) ---------- */
  await f.hash('#crm/studio/ai', 1200);
  await click(f, '#crm [data-w202voice="mine"]'); await wait(300);
  b = await f.ev(() => { const v = document.querySelector('#crm [data-w202voice]'); return { on: [...document.querySelectorAll('#crm [data-w202voice]')].map(x => x.textContent + (x.classList.contains('on') ? '*' : '')).join('|'), note: v ? v.closest('.w155lb').innerText : '' }; });
  ok('My voice can be picked for an email Steel signs', b.on === 'Welfare Avenue|My voice*' && /Your own writing guide/.test(b.note), b);
  await shot(f, '09-myvoice');
  await setv(f, '#crm textarea[data-w202say="brief"]', 'Thank you to everyone who served on Sunday 4 October at Cabot Square. The next serving is Sunday 18 October. We served a warm meal to everyone in the line, the drivers were on time, and three new volunteers stayed to help pack up the tables at the end.');
  const n0 = await f.ev(() => window.__llm.length);
  await click(f, '#crm [data-w202startai]');
  await until(f, n => window.__llm.length > n && /^#crm\/studio\/e\/st_t/.test(location.hash) && !window.w202.state().busy, n0, 8000); await wait(800);
  b = await f.ev(n => ({ sys: window.__llm[n] ? window.__llm[n].body.system : '', save: window.__saves[window.__saves.length - 1], sel: (document.querySelector('#crm [data-w202voicesel]') || {}).value }), n0);
  ok('in My voice the Hub writes as Steel from his guide, and Welfare Avenue’s words still hold', /VOICE: write as Steel Mac[dD]onald/.test(b.sys) && /TESTGUIDE/.test(b.sys) && /Whatever the voice/.test(b.sys) && !/WELFARE AVENUE VOICE CODE/.test(b.sys), (b.sys || '').slice(500, 900));
  ok('the email keeps the choice (mine), not the guide, and the editor shows My voice', b.save && b.save.design.voice === 'mine' && !/TESTGUIDE/.test(JSON.stringify(b.save)) && b.sel === 'mine', { voice: b.save && b.save.design.voice, sel: b.sel });
  await setv(f, '#crm textarea[data-w202say="change"]', 'Make it shorter.');
  const n1 = await f.ev(() => window.__llm.length);
  await click(f, '#crm [data-w202change]');
  await until(f, n => window.__llm.length > n && !window.w202.state().busy, n1, 6000); await wait(400);
  b = await f.ev(n => ({ sys: window.__llm[n] ? window.__llm[n].body.system : '', voice: window.w202.state().d.design.voice }), n1);
  ok('Ask the Hub to change it keeps My voice', /TESTGUIDE/.test(b.sys) && b.voice === 'mine', b.voice);
  await setv(f, '#crm [data-w202voicesel]', 'wa'); await wait(400);
  ok('the editor’s Voice switches the email back to Welfare Avenue', (await f.ev(() => window.w202.state().d.design.voice)) === 'wa');
  await f.hash('#crm/studio', 1200);
  await click(f, '#crm .w202intro [data-w202voices]'); await wait(400);
  await click(f, '#crm [data-w202vedit]'); await wait(300);
  b = await f.ev(() => { const V = window.w202.voices(); return { ta: (document.querySelector('#crm [data-w202vdraft]') || {}).value || '', st: { open: V.open, editing: V.editing, tab: V.tab, wa: !!V.wa, loaded: V.loaded, view: window.w202.state().view, hash: location.hash, modal: !!document.querySelector('#crm .w202voices'), editBtn: !!document.querySelector('#crm [data-w202vedit]') } }; });
  ok('Edit puts the voice code in a box', /WELFARE AVENUE VOICE CODE/.test(b.ta), { len: b.ta.length, st: b.st });
  await setv(f, '#crm [data-w202vdraft]', b.ta + '\n\nTEST LINE: say Sunday serving, not the event.');
  await click(f, '#crm [data-w202vsave]'); await wait(700);
  b = await f.ev(() => ({ cfg: window.__cfg[window.__cfg.length - 1], log: window.__clog.filter(x => x.entity_type === 'writing_voice').pop(), read: (document.querySelector('#crm .w202voices .w202vread') || {}).textContent || '' }));
  const vv = b.cfg && typeof b.cfg.row.value === 'string' ? JSON.parse(b.cfg.row.value) : null;
  ok('Save writes the new version to app_config (mail_voice_wa, the JSON as text) and logs it', !!(b.cfg && b.cfg.row.key === 'mail_voice_wa' && vv && vv.version === 2 && /TEST LINE/.test(vv.text) && b.log && /^v2,/.test(b.log.new_value) && /TEST LINE/.test(b.read)), { cfg: b.cfg && { key: b.cfg.row.key, type: typeof b.cfg.row.value }, log: b.log });
  await click(f, '#crm [data-w202vedit]'); await wait(200);
  await setv(f, '#crm [data-w202vdraft]', 'Too short.');
  await click(f, '#crm [data-w202vsave]'); await wait(300);
  ok('a voice that is too short is refused with a reason', /very short/.test(await text(f, '#crm .w202voices .w152err') || ''));
  await click(f, '#crm [data-w202vcancel]'); await wait(200); await f.page.keyboard.press('Escape'); await wait(300);
  await f.hash('#crm/studio/ai', 1200);
  await click(f, '#crm [data-w202voice="wa"]'); await wait(200);
  await setv(f, '#crm textarea[data-w202say="brief"]', 'We need two drivers on Sunday 18 October from 9 am. Sign up on the website. Drivers pick up the cooked meals from our cooks in the morning and bring them to Cabot Square, with a short stop for the cutlery, and they are free once the food is unloaded.');
  const n2 = await f.ev(() => window.__llm.length);
  await click(f, '#crm [data-w202startai]');
  await until(f, n => window.__llm.length > n && !window.w202.state().busy, n2, 8000); await wait(500);
  b = await f.ev(n => window.__llm[n] ? window.__llm[n].body.system : '', n2);
  ok('the next email uses the edited house voice', /TEST LINE: say Sunday serving/.test(b) && /VOICE: Welfare Avenue's house voice/.test(b), b.slice(0, 200));
  const tour = await f.ev(() => ({ studio: window.w122 && window.w122.tours.studio && window.w122.tours.studio.steps.length, crm: window.w122 && window.w122.tours.crm.steps.some(s => /crm\/studio/.test(s.s || '')) }));
  ok('the page tour "studio" has its eight steps (Voices since wave203), and the CRM tour names the Studio', tour.studio === 8 && tour.crm, tour);
  ok('no page errors (admin)', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------- 6. a member: the starters read only, copied to change ---------- */
  f = await fresh(browser, { who: 'member', hash: '#mypage', fixture: fixture(), candidate: cand, wait: 4000 });
  await f.ev(FAKE);
  await f.hash('#crm/studio/e/st_appeal', 2600);
  b = await f.ev(() => ({ ro: (document.querySelector('#crm .w202ro') || {}).innerText, add: !!document.querySelector('#crm [data-w202add]'), dis: !!document.querySelector('#crm [data-w202e="subject"][disabled]'), edit: document.querySelectorAll('#crm [data-w202edit]').length }));
  ok('a member opens a starter read only (no blocks to add, the fields locked) with Copy it', /only admins change it/.test(b.ro || '') && !b.add && b.dis, b);
  await click(f, '#crm [data-w202copy]'); await wait(1500);
  b = await f.ev(() => ({ s: window.w202.state(), save: window.__saves[0] }));
  ok('Copy it makes their own editable one-off', !b.s.ro && /^st_t/.test(b.s.d.key || '') && b.s.d.name === 'Appeal (copy)' && b.save && b.save.one_off === true, { ro: b.s.ro, key: b.s.d.key, name: b.s.d.name });
  await f.hash('#crm/studio', 1400);
  b = await f.ev(() => document.querySelectorAll('#crm [data-w202edit]').length);
  ok('a member gets no Edit on the starters', b === 0, b);
  b = await f.ev(() => ({ btn: (document.querySelector('#crm .w202intro [data-w202voices]') || {}).innerText || '', mb: window.__mybox.length }));
  ok('a member without a writing guide gets Welfare Avenue only (mybox is not asked)', /Welfare Avenue/.test(b.btn) && !/My voice/.test(b.btn) && b.mb === 0, b);
  await click(f, '#crm .w202intro [data-w202voices]'); await wait(400);
  b = await f.ev(() => { const m = document.querySelector('#crm .w202voices'); return { edit: !!(m && m.querySelector('[data-w202vedit]')), txt: m ? m.innerText : '' }; });
  ok('a member reads the house voice but cannot edit it', !b.edit && /Admins look after it/.test(b.txt) && /WELFARE AVENUE VOICE CODE/.test(b.txt), { edit: b.edit });
  await f.page.keyboard.press('Escape'); await wait(200);
  await f.hash('#crm/studio/e/st_joyoneoff1', 1400);
  ok('someone else’s one-off is read only too', /joy\.dumansi|only they or an admin/.test(await text(f, '#crm .w202ro') || ''));
  ok('no page errors (member)', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------- 7. a phone ---------- */
  f = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', fixture: fixture(), candidate: cand, wait: 4000 });
  await f.ev(FAKE);
  await f.hash('#crm/studio', 2400);
  b = await f.ev(() => ({ over: document.documentElement.scrollWidth - window.innerWidth, ways: document.querySelectorAll('#crm .w202way').length, tab: !!document.querySelector('#crm .w152tabs [data-w152go="#crm/studio"]') }));
  ok('on a phone the studio fits the width, with its tab in the strip', b.over <= 1 && b.ways === 3 && b.tab, b);
  await shot(f, '05-phone-home', true);
  await f.hash('#crm/studio/e/st_gift_thanks', 1600);
  b = await f.ev(() => ({ tabs: getComputedStyle(document.querySelector('#crm .w202tabs')).display, right: getComputedStyle(document.querySelector('#crm .w202right')).display, over: document.documentElement.scrollWidth - window.innerWidth }));
  ok('the editor on a phone shows Edit and Preview tabs, the preview tucked away', b.tabs !== 'none' && b.right === 'none' && b.over <= 1, b);
  await click(f, '#crm [data-w202tab="preview"]'); await wait(500);
  b = await f.ev(() => ({ left: getComputedStyle(document.querySelector('#crm .w202left')).display, right: getComputedStyle(document.querySelector('#crm .w202right')).display }));
  ok('Preview shows the email instead of the blocks', b.left === 'none' && b.right !== 'none', b);
  await shot(f, '06-phone-preview');
  ok('no page errors (phone)', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------- 8. a board viewer ---------- */
  f = await fresh(browser, { who: 'board', hash: '#mypage', fixture: fixture(), candidate: cand, wait: 4000 });
  await f.hash('#crm/studio', 2000);
  b = await f.ev(() => ({ studio: !!document.querySelector('.w202root .w202'), txt: (document.querySelector('#crm') || {}).innerText || '' }));
  ok('a board viewer gets no studio', !b.studio, b.txt.slice(0, 200));
  ok('no page errors (board)', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw202drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
