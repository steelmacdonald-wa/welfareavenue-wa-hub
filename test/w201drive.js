/* w201drive.js: wave201, speak instead of typing in every AI prompt box; Your inbox's drafts checked in Gmail; the writing guide.
   Steel (03/10/26): "I'd like to use voice to text in prompts here" (he chose every AI prompt box), then "also can we make sure
   /steel-writing:wa-writing skill is used as a framework to writing emails. Could you also make sure that drafts are actually
   saved. It didn't work last time".
   The browser's SpeechRecognition is replaced by a fake that the test speaks through (window.__sr.say). The mybox function is
   caught (window.__fn) and answers as the v1.4 function does. mybox_owners and mybox_mail are made up. Uses test/boot.js
   (stubbed Supabase, clock fixed 25/09/26 16:00 Toronto). CAND=<file> to test another build. SHOTS=<dir> saves screenshots. */
const fs = require('fs');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 700) : '')); } }
const clone = o => JSON.parse(JSON.stringify(o));
const STEEL = 'steel.macdonald@welfareavenue.com';
const TH = '1a0e3b9746772700', DR = 'r5455873991214111603';   /* a real thread and draft id pair: Google's own viewUrl for them is known */
const GOOGLE_VIEW = 'https://mail.google.com/mail/?authuser=steel.macdonald@welfareavenue.com#all?compose=thread-f:1877503615568389888%2Bmsg-a:r5455873991214111603';

const OWNER = { email: STEEL, name: 'Steel MacDonald', enabled: true, auto_sort: true, days_back: 3, archive_labels: [], label_notes: {}, skip_senders: [], skip_words: [],
  labels: [{ id: 'Label_1', name: 'Accounting', examples: ['Your Netlify invoice'] }], labels_at: '2026-09-25T15:00:00Z', last_sort_at: '2026-09-25T19:49:00Z', last_result: '4 new, 3 filed', last_error: null };
function row(o) { return Object.assign({ owner: STEEL, thread_id: null, from_email: null, from_name: null, subject: null, snippet: null, label_id: null, label_name: null, label_conf: null, labelled_at: null, archived: false, team: null, team_conf: null, team_state: null, sent_mail_id: null, sent_at: null, reply_p: 0.05, reply_state: null, draft_id: null, drafted_at: null, state: 'sorted', error: null, skipped: false, created_at: o.received_at }, o); }
const MAIL = [
  row({ id: 1, gmail_id: 'g1', thread_id: '1a0f00000000aaaa', received_at: '2026-09-25T18:10:00Z', from_email: 'kathryn@example.ca', from_name: 'Kathryn Westoll', subject: 'E-introduction', reply_p: 0.9 }),
  row({ id: 3, gmail_id: 'g3', thread_id: TH, received_at: '2026-09-25T16:45:00Z', from_email: 'support@example.com', from_name: 'Support', subject: 'Re: Ticket', reply_p: 0.7, reply_state: 'drafted', draft_id: DR, drafted_at: '2026-09-25T15:19:00Z' })
];
function fx() { const f = loadFixture(); f.mybox_owners = [clone(OWNER)]; f.mybox_mail = clone(MAIL); return f; }
const GUIDE = 'FRAMEWORK: wa-writing (Steel\'s Welfare Avenue executive voice), with steel-voice underneath.\n\nYou write as Steel.';
const FNR = {
  'mybox:open': { ok: true, main: { from: 'Kathryn Westoll <kathryn@example.ca>', from_email: 'kathryn@example.ca', to: 'Marcello <m@example.org>, Steel <' + STEEL + '>', cc: '', subject: 'E-introduction', date: '2026-09-25T18:10:00Z', text: 'Hi Marcello, I wanted to e-introduce you to Steel.', atts: [], mine: false }, history: [], later: [] },
  'mybox:questions': { ok: true, gist: 'Kathryn introduced Steel to Marcello.', questions: [{ q: 'Propose a call, or wait for Marcello?', options: ['Propose a call', 'Wait for Marcello'] }, { q: 'Anything specific to offer?', options: ['Volunteers', 'Food'] }], answered: false },
  'mybox:draft': { ok: true, body: 'Hi Marcello,\n\nGood to meet you, and thank you, Kathryn, for the introduction.\n\nWould [day] work for a call?\n\nWarmly,\nSteel', notes: [], brackets: ['[day]'], framework: { name: 'wa-writing', reader: 'first contact', register: 'standard email', revised: false } },
  'mybox:save_draft': { ok: true, draft_id: 'r-77', thread_id: '1a0f00000000aaaa', to: ['m@example.org'], cc: [], subject: 'Re: E-introduction', updated: false, checked_at: '2026-09-25T20:01:00Z', url: 'https://mail.google.com/mail/?authuser=' + STEEL + '#all?compose=thread-f:1877422893212035754%2Bmsg-a:r-77', drafts_url: 'https://mail.google.com/mail/?authuser=' + STEEL + '#drafts' },
  'mybox:voice': { ok: true, voice: GUIDE, framework: 'wa-writing' },
  'mybox:settings': { ok: true },
  'mybox:done': { ok: true }
};
const FAKE_SR = `(function(){ window.__sr = { inst: [], cur: null, idx: 0 };
  function FakeSR(){ this.lang = ''; this.continuous = false; this.interimResults = false; this.started = false; window.__sr.inst.push(this); }
  FakeSR.prototype.start = function(){ this.started = true; window.__sr.cur = this; window.__sr.idx = 0; window.__sr.res = []; };
  FakeSR.prototype.stop = function(){ var s = this; s.started = false; setTimeout(function(){ if (s.onend) s.onend(); }, 10); };
  FakeSR.prototype.abort = FakeSR.prototype.stop;
  /* say(text, final): the current result changes; a final one fixes it and the next words start a new result */
  window.__sr.say = function (text, fin) { var S = window.__sr, s = S.cur; if (!s || !s.started) return false; var r = [{ transcript: text }]; r.isFinal = !!fin; S.res[S.idx] = r; s.onresult({ resultIndex: S.idx, results: S.res.slice() }); if (fin) S.idx++; return true; };
  window.__sr.end = function () { var s = window.__sr.cur; if (s) { s.started = false; if (s.onend) s.onend(); } };
  window.__sr.fail = function (er) { var s = window.__sr.cur; if (s && s.onerror) s.onerror({ error: er }); };
  window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR; })();`;
const NO_SR = `(function(){ try { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; } catch (e) {} window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; })();`;
const STUB = `(function(){ window.__FNR = ${JSON.stringify(FNR)}; window.__fn = []; var _s;
  Object.defineProperty(window, 'supabase', { configurable: true, get: function () { return _s; }, set: function (v) {
    var cc = v.createClient; v.createClient = function () { var c = cc.apply(this, arguments);
      c.functions.invoke = function (name, opts) { var body = (opts && opts.body) || {}; window.__fn.push({ name: name, body: JSON.parse(JSON.stringify(body)) });
        var v2 = (window.__FNR || {})[name + ':' + (body.action || '')];
        if (v2 === undefined) return Promise.resolve({ data: null, error: { message: 'no stub for ' + name + ':' + body.action } });
        if (v2 && v2.__error) return Promise.resolve({ data: null, error: { message: v2.__error } });
        return new Promise(function (r) { setTimeout(function () { r({ data: JSON.parse(JSON.stringify(v2)), error: null }); }, 60); }); };
      return c; };
    _s = v; } }); })();`;
const CAND = process.env.CAND || undefined;
const SHOT = process.env.SHOTS || null;
if (SHOT && !fs.existsSync(SHOT)) fs.mkdirSync(SHOT, { recursive: true });
async function shot(f, name) { if (SHOT) await f.page.screenshot({ path: SHOT + '/' + name + '.png' }); }
const calls = (f, action) => f.ev(a => (window.__fn || []).filter(c => c.name === 'mybox' && (!a || c.body.action === a)), action);
async function click(f, sel, ms) { const n = await f.ev(s => { const el = document.querySelector(s); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; }, sel); await f.page.waitForTimeout(ms || 450); return n; }
async function say(f, text, fin, ms) { const r = await f.ev(a => window.__sr.say(a[0], a[1]), [text, !!fin]); await f.page.waitForTimeout(ms || 120); return r; }
const val = (f, sel) => f.ev(s => { const el = document.querySelector(s); return el ? el.value : null; }, sel);
/* where the mic of a box is, and whether it sits on the box (over its corner) or beside it */
const micOf = (f, sel) => f.ev(s => {
  const el = document.querySelector(s); if (!el) return { box: false };
  const key = el.id ? '#' + el.id : null;
  const all = [...document.querySelectorAll('[data-w201mic]')];
  const b = key ? all.find(x => x.getAttribute('data-w201mic') === key) : (el.nextElementSibling && (el.nextElementSibling.querySelector ? (el.nextElementSibling.matches('[data-w201mic]') ? el.nextElementSibling : el.nextElementSibling.querySelector('[data-w201mic]')) : null));
  if (!b) return { box: true, mic: false };
  const r = el.getBoundingClientRect(), m = b.getBoundingClientRect();
  return { box: true, mic: true, on: b.classList.contains('on'), pressed: b.getAttribute('aria-pressed'), label: b.getAttribute('aria-label'), text: b.textContent,
    inside: m.left >= r.left - 1 && m.right <= r.right + 1 && m.top >= r.top - 1 && m.bottom <= r.bottom + 1, beside: m.left >= r.right - 2,
    visible: m.width > 0 && m.height > 0 && getComputedStyle(b).visibility !== 'hidden', box_h: Math.round(r.height), mic_w: Math.round(m.width) };
}, sel);
const micClick = (f, sel) => f.ev(s => {
  const el = document.querySelector(s); if (!el) return false;
  const key = el.id ? '#' + el.id : null;
  const all = [...document.querySelectorAll('[data-w201mic]')];
  const b = key ? all.find(x => x.getAttribute('data-w201mic') === key) : (el.nextElementSibling && (el.nextElementSibling.matches('[data-w201mic]') ? el.nextElementSibling : el.nextElementSibling.querySelector('[data-w201mic]')));
  if (!b) return false; b.click(); return true;
}, sel);

(async () => {
  const browser = await launch();

  /* ---------- 1. Your inbox: the reply tool's boxes ---------- */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(), wait: 5200, candidate: CAND, init: STUB + FAKE_SR });
    await f.page.waitForTimeout(1000);
    ok('1.0 the mic is on (the browser can listen), with its boxes', await f.ev(() => !!(window.w201 && window.w201.supported && window.w201.targets.length >= 12)), await f.ev(() => window.w201 && window.w201.targets));
    await click(f, '#w170card [data-w170open="reply"]', 1100);
    const head = await f.ev(() => { const a = document.querySelector('#w170sheet .w170mh a.w170lnk'); return a ? a.href : null; });
    ok('1.1 Open in Gmail names his account (authuser), so another signed-in Gmail does not open', head === 'https://mail.google.com/mail/?authuser=steel.macdonald@welfareavenue.com#all/1a0f00000000aaaa', head);
    await click(f, '#w170sheet [data-w170help]', 900);
    const m0 = await micOf(f, '#w170sheet [data-w170own="0"]'), m1 = await micOf(f, '#w170sheet [data-w170own="1"]'), mn = await micOf(f, '#w170note');
    ok('1.2 a mic sits inside each "Or in your own words" box', m0.mic && m0.inside && m0.visible && m1.mic && m1.inside, { m0, m1 });
    ok('1.3 a mic sits inside the "Anything else to say" box, idle', mn.mic && mn.inside && !mn.on && mn.pressed === 'false' && mn.label === 'Speak instead of typing', mn);
    await shot(f, 'w201_1_questions');

    /* speak into Anything else */
    await micClick(f, '#w170note'); await f.page.waitForTimeout(150);
    const st = await f.ev(() => ({ s: window.w201.state(), cur: !!(window.__sr.cur && window.__sr.cur.started), lang: window.__sr.cur && window.__sr.cur.lang, cont: window.__sr.cur && window.__sr.cur.continuous, interim: window.__sr.cur && window.__sr.cur.interimResults }));
    ok('1.4 tapping the mic starts listening in English (his Hub language), continuous, with words as he speaks', st.cur && st.lang === 'en-CA' && st.cont === true && st.interim === true && st.s && st.s.key === '#w170note', st);
    const mon = await micOf(f, '#w170note');
    ok('1.5 the mic shows it is listening (pressed, "Listening")', mon.on && mon.pressed === 'true' && /Listening/.test(mon.text) && mon.label === 'Listening: tap to stop', mon);
    await shot(f, 'w201_2_listening');
    await say(f, 'thank Kathryn for', false);
    const v1 = await val(f, '#w170note');
    ok('1.6 words appear in the box while he speaks (capitalised at the start)', v1 === 'Thank Kathryn for', v1);
    await say(f, 'thank Kathryn for the introduction', true);
    await say(f, ' and offer Tuesday', false);
    const v2 = await val(f, '#w170note');
    ok('1.7 finished words stay and new ones follow', v2 === 'Thank Kathryn for the introduction and offer Tuesday', v2);
    await micClick(f, '#w170note'); await f.page.waitForTimeout(150);
    const off = await micOf(f, '#w170note');
    ok('1.8 tapping again stops listening', !off.on && off.pressed === 'false' && (await f.ev(() => window.w201.state())) === null, off);

    /* speak into an own-words box, then a tap on an answer redraws the questions mid-sentence */
    await micClick(f, '#w170sheet [data-w170own="1"]'); await f.page.waitForTimeout(150);
    await say(f, 'a few volunteers for', true);
    await click(f, '#w170sheet [data-w170ans="0"][data-v="Propose a call"]', 350);   /* render(): the boxes are drawn anew */
    await say(f, ' the Saturday servings', false);
    const vo = await val(f, '#w170sheet [data-w170own="1"]'), mo = await micOf(f, '#w170sheet [data-w170own="1"]');
    ok('1.9 the box is found again after the page redraws it: the words keep landing, the mic still shows listening', vo === 'A few volunteers for the Saturday servings' && mo.on, { vo, mo });
    await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(300);
    const sheetOn = await f.ev(() => { const s = document.getElementById('w170sheet'); return !!(s && s.classList.contains('on')); });
    ok('1.10 Esc stops listening and leaves the inbox open', sheetOn && (await f.ev(() => window.w201.state())) === null, sheetOn);

    /* what was said is what the reply tool sends */
    await click(f, '#w170sheet [data-w170draft]', 900);
    const dr = await calls(f, 'draft');
    ok('1.11 Write my reply sends the spoken note and the spoken answer', dr.length === 1 && dr[0].body.note === 'Thank Kathryn for the introduction and offer Tuesday' && JSON.stringify(dr[0].body.answers) === JSON.stringify([{ q: 'Propose a call, or wait for Marcello?', a: 'Propose a call' }, { q: 'Anything specific to offer?', a: 'A few volunteers for the Saturday servings' }]), dr[0] && dr[0].body);

    /* the draft: wa-writing named, the mic on the reply, the [brackets] note on the button, the save checked */
    const fw = await f.ev(() => (document.querySelector('#w170sheet .w170fw') || {}).textContent || '');
    ok('2.1 the draft says it was written with wa-writing, for whom and in which register', fw === 'Written with wa-writing. Reader: first contact. Register: standard email.', fw);
    const mb = await micOf(f, '#w170body');
    ok('2.2 a mic sits inside the reply box', mb.mic && mb.inside && mb.visible, mb);
    await f.ev(() => { const t = document.getElementById('w170body'); t.focus(); t.setSelectionRange(t.value.length, t.value.length); });
    await micClick(f, '#w170body'); await f.page.waitForTimeout(120);
    await say(f, 'see you soon', true); await micClick(f, '#w170body'); await f.page.waitForTimeout(120);
    const body = await val(f, '#w170body');
    ok('2.3 speaking into the reply adds at the end, after a space', /Steel see you soon$/.test(body) || /Steel\s+see you soon$/.test(body), body.slice(-40));
    await f.ev(() => { const t = document.getElementById('w170body'); t.value = t.value.replace(/\s*see you soon$/, ''); t.dispatchEvent(new Event('input', { bubbles: true })); });
    await click(f, '#w170sheet [data-w170save]', 400);
    const w = await f.ev(() => { const s = document.querySelector('#w170sheet .w170tool'); const warn = s.querySelector('.w170warn'), btn = s.querySelector('[data-w170save]'), acts = s.querySelector('.w170acts');
      return { warn: warn ? warn.textContent : null, before: !!(warn && acts && (warn.compareDocumentPosition(acts) & Node.DOCUMENT_POSITION_FOLLOWING)), btn: btn && btn.textContent, err: (s.querySelector('.w170err') || {}).textContent || null }; });
    ok('2.4 the first Save stops on the [brackets], with the note right above the button and the button saying what a second press does', w.warn && /still 1 part in \[brackets\] to fill in: \[day\]/.test(w.warn) && w.before && w.btn === 'Save it with the [brackets]' && (await calls(f, 'save_draft')).length === 0, w);
    await shot(f, 'w201_3_brackets');
    await click(f, '#w170sheet [data-w170save]', 900);
    const sv = await calls(f, 'save_draft');
    const sd = await f.ev(() => { const s = document.querySelector('#w170sheet .w170tool'); const a = [...s.querySelectorAll('.w170acts a')]; return { ok: (s.querySelector('.w170ok') || {}).textContent || '', links: a.map(x => [x.textContent, x.href]) }; });
    ok('2.5 the second press saves to Gmail', sv.length === 1 && sv[0].body.gmail_id === 'g1' && /Would \[day\] work/.test(sv[0].body.body), sv);
    ok('2.6 saved says the Hub read it back from Gmail, in his account', /Saved in your Gmail drafts, in the thread, to m@example\.org\./.test(sd.ok) && /The Hub read it back from Gmail: it is there, in steel\.macdonald@welfareavenue\.com/.test(sd.ok), sd.ok);
    ok('2.7 Open the draft in Gmail opens that draft; All your drafts names his account', sd.links.length === 2 && sd.links[0][0] === 'Open the draft in Gmail' && sd.links[0][1] === FNR['mybox:save_draft'].url && sd.links[1][1] === 'https://mail.google.com/mail/?authuser=steel.macdonald@welfareavenue.com#drafts', sd.links);
    await shot(f, 'w201_4_saved');

    /* an email with a draft from before: the link opens that draft, in Google's own link format */
    await click(f, '#w170sheet [data-w170done]', 400);
    await click(f, '#w170sheet [data-w170sel="g3"]', 900);
    const old = await f.ev(() => { const a = [...document.querySelectorAll('#w170sheet .w170tool .w170ok a')].find(x => x.textContent === 'Open the draft'); return a ? a.href : null; });
    ok('2.8 a draft saved earlier opens itself: the same link Google gives for that draft', old === GOOGLE_VIEW, old);

    /* Settings: Your writing guide */
    await click(f, '#w170sheet [data-w170tab="settings"]', 900);
    const g = await f.ev(() => { const s = document.querySelector('#w170sheet .w170set'); const h = [...s.querySelectorAll('h4')].map(x => x.textContent); const det = s.querySelector('.w170guide'); return { h, p: det ? det.previousElementSibling.textContent : '', open: det && det.open, sum: det && det.querySelector('summary').textContent }; });
    ok('3.1 Settings shows Your writing guide and names its framework', g.h.indexOf('Your writing guide') >= 0 && /Yours: wa-writing\./.test(g.p) && g.open === false && /Read or change the guide \(\d+ words\)/.test(g.sum), g);
    ok('3.2 the guide is read through mybox (only the owner)', (await calls(f, 'voice')).length === 1);
    await click(f, '#w170sheet .w170guide summary', 300);
    const mg = await micOf(f, '#w170voice');
    ok('3.3 opened, the guide shows, with a mic', (await val(f, '#w170voice')) === GUIDE && mg.mic && mg.inside, mg);
    await f.ev(g0 => { const t = document.getElementById('w170voice'); t.value = g0 + '\nSign off Warmly.'; t.dispatchEvent(new Event('input', { bubbles: true })); }, GUIDE);
    await click(f, '#w170sheet [data-w170saveguide]', 900);
    const sg = (await calls(f, 'settings')).pop();
    ok('3.4 Save the guide sends it through mybox settings, then reads it again', sg && sg.body.voice === GUIDE + '\nSign off Warmly.' && (await calls(f, 'voice')).length === 2, sg && sg.body);
    await shot(f, 'w201_5_guide');
    ok('1.99 no page errors in the inbox', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* ---------- 4. the other prompt boxes ---------- */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(), wait: 5200, candidate: CAND, init: STUB + FAKE_SR });
    await f.page.waitForTimeout(800);
    const opened = await click(f, '#waChatBtn', 600);
    const ma = await micOf(f, '#w38in');
    ok('4.1 Ask the Hub gets its mic back, beside the box in its row', opened && ma.mic && ma.visible && ma.beside, { opened, ma });
    await micClick(f, '#w38in'); await f.page.waitForTimeout(120);
    await say(f, 'what is blocking the kitchen pilot', true);
    await micClick(f, '#w38in'); await f.page.waitForTimeout(120);
    ok('4.2 speaking into Ask the Hub fills the question', (await val(f, '#w38in')) === 'What is blocking the kitchen pilot', await val(f, '#w38in'));
    await shot(f, 'w201_6_ask');
    /* every other box, mounted the way its page draws it */
    const others = await f.ev(() => {
      ['cdBrief', 'w96in', 'w96rin', 'w90gtext', 'w53purpose', 'w192say'].forEach(id => { let e; while ((e = document.getElementById(id))) e.remove(); });
      [...document.querySelectorAll('[data-w193wnotes]')].forEach(e => e.remove());
      const host = document.createElement('div'); host.id = 'w201probe'; host.style.cssText = 'position:fixed;left:20px;top:80px;width:520px;background:#FFFAF2;z-index:99;padding:10px';
      host.innerHTML = '<textarea id="cdBrief" rows="3"></textarea><textarea id="w96in" rows="2"></textarea><textarea id="w96rin" rows="2"></textarea><textarea id="w90gtext" rows="3"></textarea><textarea id="w53purpose"></textarea><textarea data-w193wnotes="1"></textarea><textarea id="w192say"></textarea>';
      document.body.appendChild(host); return true; });
    await f.page.waitForTimeout(300);
    const res = {};
    for (const s of ['#cdBrief', '#w96in', '#w96rin', '#w90gtext', '#w53purpose', '[data-w193wnotes]', '#w192say']) res[s] = await micOf(f, s);
    ok('4.3 the content drafter, Suggest a change, Finance guidance, the agenda purpose and the grant writer notes each get a mic', ['#cdBrief', '#w96in', '#w96rin', '#w90gtext', '#w53purpose', '[data-w193wnotes]'].every(s => res[s].mic && res[s].inside), res);
    ok('4.4 The Loop keeps its own Speak button (no second mic)', !res['#w192say'].mic, res['#w192say']);
    /* the layout does not move: the holder takes no room */
    const lay = await f.ev(() => { const a = document.getElementById('w96in'), b = document.getElementById('w96rin'); return Math.round(b.getBoundingClientRect().top - a.getBoundingClientRect().bottom); });
    ok('4.5 the boxes keep their spacing (the mic takes no room)', lay >= 0 && lay <= 8, lay);
    /* a box that goes away while listening stops the listening */
    await micClick(f, '#cdBrief'); await f.page.waitForTimeout(100);
    await f.ev(() => document.getElementById('w201probe').remove());
    await f.page.waitForTimeout(2600);
    ok('4.6 when the box is gone for good, listening stops', (await f.ev(() => window.w201.state())) === null && (await f.ev(() => document.querySelectorAll('.w201h').length)) >= 0);
    /* the microphone refused */
    await micClick(f, '#w38in'); await f.page.waitForTimeout(100);
    await f.ev(() => window.__sr.fail('not-allowed')); await f.ev(() => window.__sr.end()); await f.page.waitForTimeout(200);
    const t = await f.ev(() => [...document.querySelectorAll('.toast, #toast, .wa-toast')].map(x => x.textContent).join(' | '));
    ok('4.7 a refused microphone says how to allow it, and the mic goes back to idle', /Allow the microphone/.test(t) && !(await micOf(f, '#w38in')).on, t);
    ok('4.99 no page errors', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* ---------- 5. French, phone, no speech in the browser ---------- */
  {
    const f = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', fixture: fx(), wait: 5600, candidate: CAND, init: STUB + FAKE_SR + `try{localStorage.setItem('wa198lang','fr');}catch(e){}` });
    await f.page.waitForTimeout(800);
    await click(f, '#w170card [data-w170open="reply"]', 1000);
    await click(f, '#w170sheet [data-w170sel="g1"]', 900);
    await click(f, '#w170sheet [data-w170help]', 900);
    const mp = await micOf(f, '#w170note');
    ok('5.1 on a phone the mic sits inside the box too', mp.mic && mp.inside && mp.visible, mp);
    await micClick(f, '#w170note'); await f.page.waitForTimeout(120);
    const lg = await f.ev(() => ({ hub: window.w198 && window.w198.state && window.w198.state().lang, sr: window.__sr.cur && window.__sr.cur.lang }));
    ok('5.2 in French the mic listens in Quebec French', lg.hub !== 'fr' || lg.sr === 'fr-CA', lg);
    await f.ev(() => window.w201.stop()); await f.page.waitForTimeout(150);
    const idle = await micOf(f, '#w170note');
    ok('5.4 stopped, the mic is idle again', !idle.on && idle.pressed === 'false', idle);
    const bg = await f.ev(() => { const b = [...document.querySelectorAll('[data-w201mic]')].find(x => x.getAttribute('data-w201mic') === '#w170note'); return b ? [b.className, getComputedStyle(b).backgroundColor, document.activeElement === b] : null; });
    out.push('INFO phone mic after stop: ' + JSON.stringify(bg));
    await shot(f, 'w201_7_phone');
    ok('5.98 no page errors on a phone', f.errs.length === 0, f.errs);
    await f.close();
    const g = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(), wait: 5200, candidate: CAND, init: STUB + NO_SR });
    await g.page.waitForTimeout(600);
    await click(g, '#w170card [data-w170open="reply"]', 1000);
    await click(g, '#w170sheet [data-w170help]', 900);
    ok('5.3 a browser that cannot listen (Firefox) shows no mic at all', (await g.ev(() => document.querySelectorAll('[data-w201mic]').length)) === 0 && (await g.ev(() => window.w201 && window.w201.supported)) === false);
    ok('5.99 no page errors without speech', g.errs.length === 0, g.errs);
    await g.close();
  }

  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
