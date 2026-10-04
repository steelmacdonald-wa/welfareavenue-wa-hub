/* w204drive.js: wave204, Soraya Tyree's review of the email studio. Undo and Redo (the bar's buttons, Cmd/Ctrl+Z, Shift+Z and
   Ctrl+Y; typing in one field is one step until a pause; the studio leaves the Ask the Hub box to the browser; the Hub's changes,
   the subject and the blocks; a new history per email; none for a read-only email), back to the step before (What you wrote,
   Your details); text without the markup (Tell the Hub's front door; pasting from a document keeps bold, links and paragraphs;
   B and Link, Cmd/Ctrl+B and K); the moving preview (a video file read in the page under the Hub's own Content-Security-Policy
   from build/site/_headers, the panel, the GIF checked frame by frame with Pillow, the upload, the card in the email, the checks,
   Undo, Remove, keepMoving, a file that is not a video, a phone). Reuses w202drive.js's fixture and fakes (stubbed Supabase,
   clock fixed 25/09/26 16:00 Toronto). CAND=<file> tests another build; OUT=<dir> keeps the GIF. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { launch, fresh } = require('./boot');
const { fixture, FAKE, text, click, setv, wait, until, SS } = require('./w202drive.js');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
async function shot(f, name, full) { if (SHOTS) await f.page.screenshot({ path: SHOTS + '/' + name + '.png', fullPage: !!full }); }
const OUT = process.env.OUT || '/tmp/w204drive';
fs.mkdirSync(OUT, { recursive: true });
/* the Hub page's policy, as Netlify serves it */
const HEADERS = fs.readFileSync(path.join(__dirname, '../build/site/_headers'), 'utf8');
const CSP = (HEADERS.match(/\n\/\n  X-Frame-Options: DENY\n  Content-Security-Policy: ([^\n]+)/) || [])[1];
/* extra fakes: the uploads, the console's policy complaints */
const FAKE204 = `(function () {
  window.__ups = [];
  /* the design without what it cost (wave204: design.ai is kept out of Undo) */
  window.__dz = function () { var d = JSON.parse(JSON.stringify(window.w202.state().d.design)); delete d.ai; return JSON.stringify(d); };
  /* the llm router reports each call's cost (_wa.cost); the studio's month (email_studio_costs) */
  var inv0 = window.__WA_INVOKE;
  window.__WA_INVOKE = function (name, opts) { var p = inv0(name, opts); if (name !== 'llm') return p; return Promise.resolve(p).then(function (r) { if (r && r.data) r.data._wa = { task: 'email_studio', model: 'anthropic/claude-sonnet-5', cost: 0.018 }; return r; }); };
  var rpc1 = db.rpc;
  db.rpc = function (fn, args) {
    if (fn === 'email_studio_costs') { window.__costRpc = (window.__costRpc || 0) + 1; return Promise.resolve({ data: { month: { since: '2026-09-01T04:00:00Z', calls: 6, cost: 0.0965 }, last_month: { calls: 2, cost: 0.031 }, d90: { calls: 8, cost: 0.1275 } }, error: null }); }
    return rpc1.call(db, fn, args);
  };
  var st0 = db.storage.from.bind(db.storage);
  db.storage.from = function (bucket) { var b = st0(bucket); var up = b.upload; b.upload = function (p, blob, o) {
    var rec = { bucket: bucket, path: p, type: (o && o.contentType) || '', size: blob && blob.size, opts: o || null }; window.__ups.push(rec);
    if (blob && blob.arrayBuffer) blob.arrayBuffer().then(function (ab) { var u = new Uint8Array(ab), s = ''; for (var i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); rec.b64 = btoa(s); });
    return up.call(b, p, blob, o); }; return b; };
  return true;
})()`;
const state = f => f.ev(() => { const s = window.w202.state(); return { view: s.view, key: s.d && s.d.key, blocks: s.d ? s.d.design.blocks.map(b => b.type) : [], past: s.hist.past.length, future: s.hist.future.length, subject: s.d && s.d.subject, msg: s.msg }; });
const btns = f => f.ev(() => ({ undo: !!document.querySelector('#crm #w204undo'), undoOn: !!document.querySelector('#crm #w204undo:not([disabled])'), redo: !!document.querySelector('#crm #w204redo'), redoOn: !!document.querySelector('#crm #w204redo:not([disabled])') }));
const blockIdx = (f, type) => f.ev(t => window.w202.state().d.design.blocks.findIndex(b => b.type === t), type);
async function openBlock(f, i) { await f.ev(i => { const s = window.w202.state(); const b = s.d.design.blocks[i]; s.open[b.id] = true; window.w202.repaint(); }, i); await wait(250); }
async function pasteHtml(f, sel, html, plain) {
  return f.ev(([s, h, p]) => { const el = document.querySelector(s); if (!el) return false; el.focus(); el.setSelectionRange(el.value.length, el.value.length);
    const dt = new DataTransfer(); dt.setData('text/html', h); dt.setData('text/plain', p); const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    const went = el.dispatchEvent(ev); return { prevented: !went, value: el.value }; }, [sel, html, plain]);
}

(async () => {
  ok('the Hub page’s policy is read from build/site/_headers and lets the page play its own blob: video', !!CSP && /media-src 'self' blob:/.test(CSP), CSP);
  const browser = await launch();
  const cand = process.env.CAND || undefined;

  /* ---------- 1. Undo and Redo ---------- */
  let f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(), candidate: cand, wait: 4000 });
  await f.ev(FAKE); await f.ev(FAKE204);
  await f.hash('#crm/studio', 2400);
  let b = await f.ev(() => ({ way: (document.querySelector('#crm .w202way[data-w202go="#crm/studio/ai"]') || {}).innerText }));
  ok('the front page says where to drop your text: Tell the Hub designs the email, no HTML needed', /Paste or write what you want to say/.test(b.way || '') && /no HTML needed/.test(b.way || ''), b);
  await click(f, '#crm [data-w202use="st_gift_thanks"]'); await wait(1600);
  let s = await state(f), bt = await btns(f);
  ok('a ready template opened with Use it: Undo and Redo in the bar, nothing to undo yet', s.view === 'edit' && bt.undo && bt.redo && !bt.undoOn && !bt.redoOn && s.past === 0, { s, bt });
  const n0 = s.blocks.length;
  await click(f, '#crm [data-w202add="quote"]'); await wait(400);
  s = await state(f); bt = await btns(f);
  ok('adding a block is a step: Undo comes on', s.blocks.length === n0 + 1 && s.past === 1 && bt.undoOn && !bt.redoOn, { s, bt });
  await click(f, '#crm #w204undo'); await wait(400);
  s = await state(f); bt = await btns(f);
  ok('Undo takes the block away again, and Redo comes on', s.blocks.length === n0 && s.blocks.indexOf('quote') < 0 && bt.redoOn && s.future === 1, { s, bt });
  await click(f, '#crm #w204redo'); await wait(400);
  s = await state(f);
  ok('Redo puts it back', s.blocks.length === n0 + 1 && s.blocks.indexOf('quote') >= 0 && s.future === 0, s);
  await f.ev(() => { if (document.activeElement) document.activeElement.blur(); });
  await f.page.keyboard.press('Control+z'); await wait(400);
  s = await state(f);
  ok('Ctrl+Z (Cmd+Z on a Mac) undoes it from the keyboard', s.blocks.indexOf('quote') < 0, s);
  await f.page.keyboard.press('Control+Shift+z'); await wait(400);
  s = await state(f);
  ok('Shift+Ctrl+Z redoes it', s.blocks.indexOf('quote') >= 0, s);
  await f.page.keyboard.press('Control+z'); await wait(300); await f.page.keyboard.press('Control+y'); await wait(400);
  s = await state(f);
  ok('Ctrl+Y redoes too (Windows)', s.blocks.indexOf('quote') >= 0 && s.future === 0, s);
  /* moving and removing are steps too */
  const qi = await blockIdx(f, 'quote');
  await click(f, '#crm [data-w202del="' + qi + '"]'); await wait(400);
  await click(f, '#crm #w204undo'); await wait(400);
  ok('removing a block, then Undo, brings it back where it was', (await blockIdx(f, 'quote')) === qi);
  /* typing: one step per burst in one field */
  const ti = await blockIdx(f, 'text');
  await openBlock(f, ti);
  const sel = '#crm textarea[data-w202f="' + ti + '.text"]';
  const before = await f.ev(s => document.querySelector(s).value, sel);
  await f.page.click(sel); await f.page.keyboard.press('End'); await f.page.keyboard.press('Control+End');
  await f.page.keyboard.type(' Thank you again.', { delay: 15 }); await wait(300);
  s = await state(f);
  const typed = await f.ev(s => document.querySelector(s).value, sel);
  ok('typing a sentence changes the text block and is one step', typed === before + ' Thank you again.' && s.past >= 1, { typed: typed.slice(-40), past: s.past });
  const pastTyped = s.past;
  await wait(1700);
  await f.page.keyboard.type(' See you soon.', { delay: 15 }); await wait(300);
  s = await state(f);
  ok('after a pause, more typing is a new step', s.past === pastTyped + 1, { past: s.past, was: pastTyped });
  await f.page.keyboard.press('Control+z'); await wait(400);
  b = await f.ev(s => ({ v: document.querySelector(s) && document.querySelector(s).value, focus: document.activeElement && document.activeElement.getAttribute('data-w202f') }), sel);
  ok('Ctrl+Z in the text field takes back the last burst only, and the cursor stays in the field', b.v === before + ' Thank you again.' && b.focus === ti + '.text', b);
  await f.page.keyboard.press('Control+z'); await wait(400);
  b = await f.ev(s => document.querySelector(s).value, sel);
  ok('a second Ctrl+Z takes back the first sentence', b === before, b.slice(-40));
  await f.page.keyboard.press('Control+Shift+z'); await wait(400);
  ok('and Shift+Ctrl+Z types it back', (await f.ev(s => document.querySelector(s).value, sel)) === before + ' Thank you again.');
  /* the subject */
  const subj0 = (await state(f)).subject;
  await setv(f, '#crm [data-w202e="subject"]', 'A brand new subject'); await wait(200);
  await click(f, '#crm #w204undo'); await wait(400);
  b = await f.ev(() => ({ s: window.w202.state().d.subject, field: document.querySelector('#crm [data-w202e="subject"]').value }));
  ok('Undo puts the subject back, in the email and in the field', b.s === subj0 && b.field === subj0, b);
  /* the Ask the Hub box keeps the browser's own undo */
  const snap0 = await f.ev(() => window.__dz());
  await f.page.click('#crm textarea[data-w202say="change"]');
  await f.page.keyboard.type('Make it warmer', { delay: 10 });
  const h0 = await state(f);
  await f.page.keyboard.press('Control+z'); await wait(300);
  b = await f.ev(() => ({ d: window.__dz(), past: window.w202.state().hist.past.length, fut: window.w202.state().hist.future.length }));
  ok('in the Ask the Hub box, Ctrl+Z is the browser’s: the email and its history are untouched', b.d === snap0 && b.past === h0.past && b.fut === h0.future, { past: b.past, was: h0.past, fut: b.fut });
  /* the Hub's change, then Undo and Redo */
  await setv(f, '#crm textarea[data-w202say="change"]', 'Make it shorter');
  await click(f, '#crm [data-w202change]');
  await until(f, () => /Changed/.test(window.w202.state().msg || ''), null, 6000); await wait(300);
  const afterAi = await f.ev(() => window.__dz());
  await click(f, '#crm #w204undo'); await wait(400);
  b = await f.ev(() => window.__dz());
  ok('Undo after Ask the Hub to change it puts the email back as it was', b === snap0, b.slice(0, 120));
  await click(f, '#crm #w204redo'); await wait(400);
  ok('Redo brings the Hub’s change back', (await f.ev(() => window.__dz())) === afterAi);
  /* Undo saves */
  const saves0 = await f.ev(() => window.__saves.length);
  await click(f, '#crm #w204undo'); await wait(3200);
  b = await f.ev(() => ({ n: window.__saves.length, last: window.__saves[window.__saves.length - 1] }));
  ok('an undone email is saved like any change', b.n > saves0 && JSON.stringify(b.last.design.blocks.map(x => x.id)) === JSON.stringify(JSON.parse(snap0).blocks.map(x => x.id)), { n: b.n, was: saves0 });
  /* another email: a new history */
  await f.hash('#crm/studio', 1000);
  await click(f, '#crm [data-w202use="st_welcome_volunteer"]'); await wait(1600);
  s = await state(f); bt = await btns(f);
  ok('another email starts with its own history (nothing to undo)', s.past === 0 && s.future === 0 && !bt.undoOn, { s, bt });
  /* a read-only email: no Undo */
  await f.hash('#crm/studio/e/st_joyoneoff1', 1500);
  b = await f.ev(() => ({ ro: window.w202.state().ro, undo: !!document.querySelector('#crm #w204undo') }));
  ok('an admin opening Joy’s email can change it, with Undo', b.ro === false && b.undo, b);
  await shot(f, '01-undo-bar');

  /* ---------- 2. Text without the markup ---------- */
  await f.hash('#crm/studio', 900);
  await click(f, '#crm [data-w202use="st_gift_thanks"]'); await wait(1500);
  const xi = await blockIdx(f, 'text');
  await openBlock(f, xi);
  const tsel = '#crm textarea[data-w202f="' + xi + '.text"]';
  b = await f.ev(s => { const t = document.querySelector(s); const lb = t.closest('label'); return { fmt: t.hasAttribute('data-w204fmt'), btns: [...lb.querySelectorAll('[data-w204fmtb]')].map(x => x.getAttribute('data-w204fmtb')), help: lb.innerText.slice(0, 160) }; }, tsel);
  ok('the text block has B and Link and says pasting keeps the formatting', b.fmt && b.btns.join(',') === 'b,link' && /Paste from a doc/.test(b.help), b);
  await f.ev(s => { const t = document.querySelector(s); t.value = 'Hi {{first_name|there}},'; t.dispatchEvent(new Event('input', { bubbles: true })); }, tsel); await wait(200);
  const GDOC = '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1"><p dir="ltr"><span style="font-weight:400;">Your gift paid for </span><span style="font-weight:700;">sixty meals</span><span style="font-weight:400;"> this month.</span></p>' +
    '<p dir="ltr"><span>Read the </span><a href="https://welfareavenue.com/impact/"><span>impact report</span></a><span>.</span></p><ul><li><p>Cooks on Saturday</p></li><li><p>Servers on Sunday</p></li></ul></b>';
  b = await pasteHtml(f, tsel, GDOC, 'Your gift paid for sixty meals this month.\nRead the impact report.\nCooks on Saturday\nServers on Sunday');
  await wait(400);
  const pasted = await f.ev(s => ({ v: document.querySelector(s).value, d: window.w202.state().d.design.blocks.find(x => x.type === 'text').text }), tsel);
  ok('pasting from a Google Doc keeps the bold, the link, the paragraphs and the points', b.prevented && /\*\*sixty meals\*\*/.test(pasted.v) && /\[impact report\]\(https:\/\/welfareavenue\.com\/impact\/\)/.test(pasted.v) && /\n\nRead the/.test(pasted.v) && /• Cooks on Saturday\n• Servers on Sunday/.test(pasted.v) && !/\*\*Your gift/.test(pasted.v) && pasted.d === pasted.v, pasted.v);
  await wait(500);
  b = await f.ev(() => document.getElementById('w202frame').getAttribute('srcdoc'));
  ok('the email shows them as bold and a link', /<strong[^>]*>sixty meals<\/strong>/.test(b) && /href="https:\/\/welfareavenue\.com\/impact\/"[^>]*>impact report<\/a>/.test(b));
  b = await pasteHtml(f, tsel, '<p>plain words only</p>', 'plain words only');
  ok('a plain paste is left to the browser', b && !b.prevented, b);
  /* B and Link */
  await f.ev(s => { const t = document.querySelector(s); t.value = 'Thank you for giving.'; t.dispatchEvent(new Event('input', { bubbles: true })); t.focus(); t.setSelectionRange(13, 20); }, tsel); await wait(200);
  await f.page.click('#crm [data-w204fmtb="b"]'); await wait(200);
  b = await f.ev(s => { const t = document.querySelector(s); return { v: t.value, sel: t.value.slice(t.selectionStart, t.selectionEnd) }; }, tsel);
  ok('B makes the selected words bold (and keeps them selected)', b.v === 'Thank you for **giving**.' && b.sel === '**giving**', b);
  await f.page.click('#crm [data-w204fmtb="b"]'); await wait(200);
  b = await f.ev(s => document.querySelector(s).value, tsel);
  ok('B again takes the bold off', b === 'Thank you for giving.', b);
  await f.ev(s => { const t = document.querySelector(s); t.focus(); t.setSelectionRange(0, 9); }, tsel);
  await f.page.click('#crm [data-w204fmtb="link"]'); await wait(200);
  b = await f.ev(s => { const t = document.querySelector(s); return { v: t.value, sel: t.value.slice(t.selectionStart, t.selectionEnd) }; }, tsel);
  ok('Link turns the words into [words](https://) with the address ready to paste', b.v === '[Thank you](https://) for giving.' && b.sel === 'https://', b);
  await f.page.keyboard.type('https://welfareavenue.com/give/'); await wait(200);
  ok('pasting the address over it finishes the link', (await f.ev(s => document.querySelector(s).value, tsel)) === '[Thank you](https://welfareavenue.com/give/) for giving.');
  await f.ev(s => { const t = document.querySelector(s); t.focus(); const i = t.value.indexOf('giving'); t.setSelectionRange(i, i + 6); }, tsel);
  await f.page.keyboard.press('Control+b'); await wait(200);
  ok('Ctrl+B (Cmd+B) does the same as B', /for \*\*giving\*\*\./.test(await f.ev(s => document.querySelector(s).value, tsel)));
  const hi = await blockIdx(f, 'hero'); await openBlock(f, hi);
  b = await f.ev(h => ({ lines: !!document.querySelector('#crm textarea[data-w202f="' + h + '.lines"]'), fmt: !!document.querySelector('#crm textarea[data-w202f="' + h + '.lines"][data-w204fmt]'), lead: !!document.querySelector('#crm textarea[data-w202f="' + h + '.lead"][data-w204fmt]') }), hi);
  ok('the headline lines get no B or Link (they are never marked); the sentence under it does', b.lines && !b.fmt && b.lead, b);
  await shot(f, '02-text-tools');
  /* Tell the Hub's box keeps a pasted link too */
  await f.hash('#crm/studio/ai', 900);
  b = await f.ev(() => (document.querySelector('#crm textarea[data-w202say="brief"]').closest('label') || {}).innerText);
  ok('Tell the Hub says to paste your text: no HTML needed', /Paste your text from a doc or an email/.test(b || '') && /No HTML needed/.test(b || ''), b);
  b = await pasteHtml(f, '#crm textarea[data-w202say="brief"]', '<p>Sign up for <a href="https://welfareavenue.com/volunteer/">Sunday</a> by Friday.</p>', 'Sign up for Sunday by Friday.');
  ok('a link pasted into Tell the Hub keeps its address for the Hub', b.prevented && /\[Sunday\]\(https:\/\/welfareavenue\.com\/volunteer\/\)/.test(b.value) && (await f.ev(() => window.w202.state().start.brief)) === b.value, b);

  /* ---------- 3. Back to the step before ---------- */
  await setv(f, '#crm textarea[data-w202say="brief"]', 'We need three more servers on Sunday 11 October at Cabot Square, 11 to 2. Sign up on the website. It is the first cold Sunday of the fall, so the line will be long, and servers plate the meals and share the table with our community.');
  await click(f, '#crm [data-w202pickstart]'); await wait(700);
  await click(f, '#crm [data-w202libpick="9"]'); await wait(400);
  await click(f, '#crm [data-w202startai]');
  await until(f, () => /^#crm\/studio\/e\/st_t/.test(location.hash), null, 8000); await wait(900);
  b = await f.ev(() => ({ back: (document.querySelector('#crm [data-w204back]') || {}).textContent, brief: window.w202.state().start.brief }));
  ok('the Hub’s draft offers What you wrote (your words are put away)', /What you wrote/.test(b.back || '') && b.brief === '', b);
  const draftKey = (await state(f)).key;
  await click(f, '#crm [data-w204back]'); await wait(900);
  b = await f.ev(() => ({ hash: location.hash, brief: (document.querySelector('#crm textarea[data-w202say="brief"]') || {}).value, photos: window.w202.state().start.photos.length, note: (document.querySelector('#crm .w154msg') || {}).textContent, kept: window.w202.state().d && window.w202.state().d.key }));
  ok('What you wrote goes back to Tell the Hub with the words and the photo', b.hash === '#crm/studio/ai' && /three more servers on Sunday 11 October/.test(b.brief || '') && b.photos === 1, b);
  ok('it says the email the Hub made is kept in Recent emails', /kept in Recent emails/.test(b.note || '') && !!draftKey, b.note);
  await f.hash('#crm/studio/tpl/st_callout', 1400);
  await setv(f, '#crm [data-w202ask="date"]', 'Sunday 11 October, 11 am to 2 pm');
  await setv(f, '#crm [data-w202ask="roles"]', '3 servers');
  await click(f, '#crm [data-w202starttpl="self"]'); await wait(1500);
  b = await f.ev(() => (document.querySelector('#crm [data-w204back]') || {}).textContent);
  ok('a template filled in yourself offers Your details', /Your details/.test(b || ''), b);
  await click(f, '#crm [data-w204back]'); await wait(1000);
  b = await f.ev(() => ({ hash: location.hash, date: (document.querySelector('#crm [data-w202ask="date"]') || {}).value, roles: (document.querySelector('#crm [data-w202ask="roles"]') || {}).value }));
  ok('Your details goes back to the call-out with the details you gave', b.hash === '#crm/studio/tpl/st_callout' && b.date === 'Sunday 11 October, 11 am to 2 pm' && b.roles === '3 servers', b);
  /* ---------- 3b. What it costs, and your content first ---------- */
  await f.hash('#crm/studio', 1200);
  b = await f.ev(() => ({ chip: (document.querySelector('#crm [data-w204costs]') || {}).innerText, intro: (document.querySelector('#crm .w202intro p') || {}).innerText, rpc: window.__costRpc || 0 }));
  ok('the front page says content first and shows What it costs with the month so far (email_studio_costs)', /Bring your content first/.test(b.intro || '') && /does not write the email for you/.test(b.intro || '') && /What it costs/.test(b.chip || '') && /9\.7¢ this month/.test(b.chip || '') && b.rpc >= 1, b);
  await click(f, '#crm [data-w204costs]'); await wait(500);
  b = await f.ev(() => { const m = document.querySelector('#crm .w204costs'); return m ? { txt: m.innerText, rows: [...m.querySelectorAll('.w204ct tr')].map(r => r.innerText.replace(/\s+/g, ' ')), spend: [...m.querySelectorAll('.w204spend b')].map(x => x.textContent) } : null; });
  ok('What it costs lists each step (about 2¢ an AI step, by hand free) and a typical email (about 5¢)', b && b.rows.some(r => /Tell the Hub.*about 2¢/.test(r)) && b.rows.some(r => /Ask the Hub to change it.*about 2¢ each time/.test(r)) && b.rows.some(r => /typical email.*about 5¢/.test(r)) && b.rows.some(r => /Build it yourself.*free/.test(r)), b && b.rows);
  ok('it shows the studio’s spend: this month, last month, 90 days', b && b.spend.join('|') === '9.7¢|3.1¢|13¢', b && b.spend);
  ok('it puts content first (bad input, bad output) and says what sending costs', b && /Your content first/.test(b.txt) && /bad input, bad output/.test(b.txt) && /Resend’s free plan covers 3,000 emails a month/.test(b.txt), b && b.txt.slice(0, 300));
  await shot(f, '07-costs');
  await f.page.keyboard.press('Escape'); await wait(300);
  ok('Escape closes What it costs', !(await f.ev(() => !!document.querySelector('#crm .w204costs'))));
  await f.hash('#crm/studio/ai', 900);
  await setv(f, '#crm textarea[data-w202say="brief"]', 'Write a newsletter about our fall servings please.'); await wait(200);
  b = await f.ev(() => ({ meter: (document.getElementById('w204meter') || {}).innerText, notyet: !!document.querySelector('#crm [data-w202startai].notyet'), pills: [...document.querySelectorAll('#crm .w204about')].map(x => x.textContent), aside: (document.querySelector('#crm .w202tips') || {}).innerText }));
  ok('Tell the Hub counts your words as you type (8 of at least 40), no date, no link; Put it together looks not ready', /Your content first: 8 words of at least 40/.test(b.meter || '') && /no date yet/.test(b.meter || '') && /no link yet/.test(b.meter || '') && b.notyet, b);
  ok('Put it together shows about 2¢, Build it myself free; the side says content first', b.pills.join('|') === 'about 2¢|free' && /your content first/i.test(b.aside || '') && /Bad input, bad output/.test(b.aside || ''), b);
  const llm0 = await f.ev(() => window.__llm.length);
  await click(f, '#crm [data-w202startai]'); await wait(300);
  b = await f.ev(() => ({ err: (document.querySelector('#crm .w152err') || {}).innerText, n: window.__llm.length }));
  ok('a one-line ask is refused before any AI call: bring your content first', /Bring your content first: write or paste at least 40 words of your own/.test(b.err || '') && /you have 8/.test(b.err || '') && b.n === llm0, b);
  await setv(f, '#crm textarea[data-w202say="brief"]', 'Thank you to everyone who served on Sunday 4 October at Cabot Square. We served a warm meal to everyone in the line, the drivers were on time, and three new volunteers stayed to pack up. The next serving is Sunday 18 October: sign up at https://welfareavenue.com/volunteer/ by Friday.'); await wait(200);
  b = await f.ev(() => ({ meter: (document.getElementById('w204meter') || {}).innerText, notyet: !!document.querySelector('#crm [data-w202startai].notyet') }));
  ok('with your content in, the meter says so, with the date and the link', /Your content is in: \d+ words/.test(b.meter || '') && /✓ a date or day/.test(b.meter || '') && /✓ a link/.test(b.meter || '') && !b.notyet, b);
  await click(f, '#crm [data-w202startai]');
  await until(f, () => /^#crm\/studio\/e\/st_t/.test(location.hash), null, 8000); await wait(900);
  b = await f.ev(() => ({ ai: window.w202.state().d.design.ai, line: (document.getElementById('w204cost') || {}).innerText, sys: (window.__llm[window.__llm.length - 1].body || {}).system || '', save: window.__saves[window.__saves.length - 1] }));
  ok('the Hub’s draft records what it cost (1 call, 1.8¢), saved with the email', b.ai && b.ai.calls === 1 && Math.abs(b.ai.cost - 0.018) < 1e-9 && b.save && b.save.design.ai && b.save.design.ai.calls === 1, b.ai);
  ok('the change box shows the email’s spend so far, with What it costs', /The Hub’s work on this email so far: 1\.8¢ \(1 call\)/.test(b.line || '') && /What it costs/.test(b.line || ''), b.line);
  ok('the prompt tells the model the writer’s content comes first and never to pad thin input', /Content: the writer's own content comes first/.test(b.sys) && /rather than padding it/.test(b.sys), b.sys.slice(0, 200));
  await setv(f, '#crm textarea[data-w202say="change"]', 'Make it shorter');
  await click(f, '#crm [data-w202change]');
  await until(f, () => /Changed/.test(window.w202.state().msg || ''), null, 6000); await wait(300);
  b = await f.ev(() => ({ ai: window.w202.state().d.design.ai, line: (document.getElementById('w204cost') || {}).innerText }));
  ok('a change adds its cost: 2 calls, 3.6¢', b.ai.calls === 2 && Math.abs(b.ai.cost - 0.036) < 1e-9 && /3\.6¢ \(2 calls\)/.test(b.line || ''), b);
  await click(f, '#crm #w204undo'); await wait(400);
  b = await f.ev(() => window.w202.state().d.design.ai);
  ok('Undo takes the change back but not what it cost (the money is spent)', b.calls === 2 && Math.abs(b.cost - 0.036) < 1e-9, b);
  await click(f, '#crm [data-w202dupe]'); await wait(1200);
  b = await f.ev(() => ({ ai: window.w202.state().d.design.ai || null, name: window.w202.state().d.name }));
  ok('a copy starts with nothing spent', b.ai === null && /\(copy\)/.test(b.name), b);
  ok('no page errors (undo, text, back, costs)', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------- 4. The moving preview, under the Hub's own policy ---------- */
  f = await fresh(browser, { who: 'admin', hash: '#mypage', fixture: fixture(), candidate: cand, wait: 4000, csp: CSP });
  const viol = []; f.page.on('console', m => { if (/Refused to load media|media-src/i.test(m.text())) viol.push(m.text().slice(0, 240)); });
  await f.ev(FAKE); await f.ev(FAKE204);
  await f.hash('#crm/studio', 2400);
  await click(f, '#crm [data-w202use="st_gift_thanks"]'); await wait(1600);
  await click(f, '#crm [data-w202add="video"]'); await wait(500);
  const vi = await blockIdx(f, 'video');
  b = await f.ev(i => { const slot = document.querySelector('#crm .w204mvslot'); return { slot: !!slot, txt: slot ? slot.innerText : '', input: !!document.querySelector('#crm input[data-w204vfile="' + i + '"]') }; }, vi);
  ok('a new video card offers a moving preview, saying why (inboxes do not play video)', b.slot && b.input && /Make one from a video file/.test(b.txt) && /do not play video inside an email/.test(b.txt), b);
  await shot(f, '03-video-card');
  /* not a video */
  await f.page.setInputFiles('#crm input[data-w204vfile="' + vi + '"]', path.join(__dirname, 'fx_1x1.png')); await wait(500);
  b = await f.ev(() => ({ mv: !!window.w202.state().mv, err: window.w202.state().err }));
  ok('a file that is not a video is refused in plain words', !b.mv && /not a video file/.test(b.err || ''), b);
  await f.page.setInputFiles('#crm input[data-w204vfile="' + vi + '"]', path.join(__dirname, 'fx_clip.webm'));
  await until(f, () => { const m = window.w202.state().mv; return m && (m.dur > 0 || m.err); }, null, 10000); await wait(400);
  b = await f.ev(() => { const m = window.w202.state().mv; return { dur: m.dur, vw: m.vw, vh: m.vh, shape: m.shape, len: m.len, start: m.start, err: m.err, modal: !!document.querySelector('#crm .w204mv'), video: !!document.querySelector('#crm .w204mv video[data-w204mvvideo]'),
    lens: [...document.querySelectorAll('#crm [data-w204mvlen]')].map(x => x.textContent), txt: document.querySelector('#crm .w204mv').innerText }; });
  ok('the video opens in the page under the Hub’s policy: its length, its size, Wide for a wide video, 3 seconds', !b.err && b.dur > 3.5 && b.dur < 4.5 && b.vw === 320 && b.vh === 180 && b.shape === 'wide' && b.len === 3 && b.modal && b.video, b);
  ok('the panel offers 2 to 4 seconds (the clip is 4), says the video is not uploaded', b.lens.join('|') === '2 seconds|3 seconds|4 seconds' && /not uploaded, only the preview/.test(b.txt), b.lens);
  await shot(f, '04-moving-panel');
  await f.ev(() => { const r = document.querySelector('#crm [data-w204mvstart]'); r.value = '1.5'; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(300);
  b = await f.ev(() => ({ start: window.w202.state().mv.start, lab: document.getElementById('w204mvt').textContent }));
  ok('the slider sets where it starts, with the times beside it', Math.abs(b.start - 1) < 0.01 && /^0:01\.0 to 0:04\.\d of 0:04\.\d$/.test(b.lab), b);
  await click(f, '#crm [data-w204mvlen="2"]'); await wait(300);
  await click(f, '#crm [data-w204mvsize="light"]'); await wait(300);
  await f.ev(() => { const r = document.querySelector('#crm [data-w204mvstart]'); r.value = '1.5'; r.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(200);
  b = await f.ev(() => { const m = window.w202.state().mv; return { len: m.len, size: m.size, start: m.start, dims: window.w202.mvDims(m.shape, m.size), note: (document.querySelector('#crm [data-w204mvsize].on') || {}).textContent }; });
  ok('Length 2 seconds and Lighter (smaller, 8 frames a second)', b.len === 2 && b.size === 'light' && Math.abs(b.start - 1.5) < 0.01 && b.dims.w === 412 && b.dims.h === 232, b);
  await click(f, '#crm [data-w204mvmake]');
  await until(f, () => { const m = window.w202.state().mv; return m && !m.busy && (m.out || m.err); }, null, 30000); await wait(300);
  b = await f.ev(() => { const m = window.w202.state().mv; return { err: m.err, out: m.out && { kb: m.out.kb, w: m.out.w, h: m.out.h, frames: m.out.frames }, img: !!document.querySelector('#crm .w204mvout'), txt: document.querySelector('#crm .w204mvr').innerText }; });
  ok('Make the preview makes 17 frames at 412 × 232 and shows it with its size', !b.err && b.out && b.out.frames === 17 && b.out.w === 412 && b.out.h === 232 && b.img && /17 frames/.test(b.txt) && /Light enough for any inbox|Fine for email/.test(b.txt), b);
  await shot(f, '05-moving-made');
  /* the GIF itself */
  const g64 = await f.ev(async () => { const m = window.w202.state().mv; const ab = await m.out.blob.arrayBuffer(); const u = new Uint8Array(ab); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); });
  const gifPath = path.join(OUT, 'moving.gif'); fs.writeFileSync(gifPath, Buffer.from(g64, 'base64'));
  let info = {};
  try { info = JSON.parse(execFileSync('python3', ['-c', 'import json,sys\nfrom PIL import Image,ImageSequence\nim=Image.open(sys.argv[1])\nd=[f.info.get("duration") for f in ImageSequence.Iterator(im)]\nim.seek(0)\nw,h=im.size\nr=round(max(16,min(w,h)*0.11))\nc=im.convert("RGB").getpixel((w//2,h//2-int(r*0.8)))\nprint(json.dumps({"n":im.n_frames,"size":im.size,"loop":im.info.get("loop"),"dur":sorted(set(d)),"centre":c}))', gifPath]).toString()); } catch (e) { info = { error: String(e).slice(0, 300) }; }
  ok('the GIF decodes: 17 frames of 412 × 232, 0.12 s each, looping, the gold play button in the middle (its gold above the green arrow)', info.n === 17 && info.size && info.size[0] === 412 && info.size[1] === 232 && info.loop === 0 && info.dur && info.dur.join() === '120' && info.centre && Math.abs(info.centre[0] - 220) < 40 && Math.abs(info.centre[1] - 165) < 40 && info.centre[2] < 90, info);
  await click(f, '#crm [data-w204mvuse]');
  await until(f, () => !window.w202.state().mv, null, 8000); await wait(500);
  b = await f.ev(i => { const bl = window.w202.state().d.design.blocks[i]; const u = window.__ups[window.__ups.length - 1] || {}; return { gif: bl.gif, gw: bl.gw, gh: bl.gh, gkb: bl.gkb, up: { bucket: u.bucket, path: u.path, type: u.type, size: u.size, cache: u.opts && u.opts.cacheControl }, slot: (document.querySelector('#crm .w204mvslot') || {}).innerText }; }, vi);
  ok('Use this preview uploads the GIF to content-images/email/ (and only the GIF)', b.up.bucket === 'content-images' && /^email\/\d{4}\/\d{2}\/[a-z0-9]+\.gif$/.test(b.up.path || '') && b.up.type === 'image/gif' && b.up.size > 1000 && (await f.ev(() => window.__ups.length)) === 1, b.up);
  ok('the card keeps the preview, its size and weight; the form shows it with Make a new one and Remove it', /content-images\/email\/.+\.gif$/.test(b.gif || '') && b.gw === 412 && b.gh === 232 && b.gkb > 0 && /Plays as soon as the email opens/.test(b.slot || '') && /Make a new one/.test(b.slot || '') && /Remove it/.test(b.slot || ''), b);
  const upB64 = await f.ev(() => (window.__ups[0] || {}).b64 || '');
  ok('the uploaded file is the GIF that was made', upB64 === g64, { up: upB64.length, made: g64.length });
  await f.ev(i => { const s = window.w202.state(); s.d.design.blocks[i].url = 'https://www.youtube.com/watch?v=abc123'; s.d.design.blocks[i].title = 'A Sunday serving'; window.w202.repaint(); }, vi);
  await wait(400);
  b = await f.ev(() => { const s = window.w202.state(); const html = window.w202.MAIL202.render(s.d.design); return { html, frame: document.getElementById('w202frame').getAttribute('srcdoc'), checks: window.w202.checks().map(c => c.lvl + ': ' + c.msg) }; });
  ok('the email carries the preview inside the card’s link, sized, with words for screen readers', /<a style="display:block;text-decoration:none;margin:4px 0 22px;" href="https:\/\/www\.youtube\.com\/watch\?v=abc123" target="_blank"><table[^>]*><tr><td align="center" style="padding:16px 16px 0;[^"]*"><img src="https:\/\/stub\.local\/storage\/content-images\/email\/[^"]+\.gif" width="412" height="232" alt="A Sunday serving \(video\)"/.test(b.html), b.html.slice(0, 600));
  ok('the preview beside the editor shows it too', /content-images\/email\/[^"]+\.gif/.test(b.frame || ''));
  ok('the checks remind the photo rule for a moving preview', b.checks.some(c => /^note: A moving preview comes from your own video/.test(c)), b.checks);
  await click(f, '#crm #w204undo'); await wait(500);
  await f.ev(() => { while (window.w202.state().hist.past.length && window.w202.state().d.design.blocks.some(b => b.type === 'video' && b.gif)) { if (!window.w202.histGo(-1)) break; } });
  await wait(400);
  b = await f.ev(i => ({ gif: (window.w202.state().d.design.blocks.find(x => x.type === 'video') || {}).gif, fut: window.w202.state().hist.future.length }), vi);
  ok('Undo goes back to the card without its preview', !b.gif && b.fut >= 1, b);
  await click(f, '#crm #w204redo'); await wait(400);
  ok('Redo brings the preview back', !!(await f.ev(() => (window.w202.state().d.design.blocks.find(x => x.type === 'video') || {}).gif)));
  const vi2 = await blockIdx(f, 'video'); await openBlock(f, vi2);
  await click(f, '#crm [data-w204mvrm="' + vi2 + '"]'); await wait(400);
  ok('Remove it takes the preview off the card', !(await f.ev(() => (window.w202.state().d.design.blocks.find(x => x.type === 'video') || {}).gif)));
  /* the Hub's changes keep it */
  b = await f.ev(() => { const from = { blocks: [{ type: 'video', url: 'https://youtu.be/a', gif: 'https://x/a.gif', gw: 528, gh: 297, gkb: 900 }, { type: 'video', url: 'https://youtu.be/b', gif: 'https://x/b.gif', gw: 400, gh: 400 }] };
    const to = { blocks: [{ type: 'text', text: 'x' }, { type: 'video', url: 'https://youtu.be/b' }, { type: 'video', url: 'https://youtu.be/c' }] };
    window.w202.keepMoving(from, to); return to.blocks.map(x => x.gif || ''); });
  ok('a Hub change keeps each card’s preview (by its link, else in order)', b.join('|') === '|https://x/b.gif|https://x/a.gif', b);
  b = await f.ev(() => window.w202.designForAi ? window.w202.designForAi({ blocks: [{ id: 'b1234', type: 'video', url: 'https://youtu.be/a', title: 'T', gif: 'https://x/a.gif', gw: 1, gh: 1, gkb: 1 }] }, []) : '');
  ok('the Hub’s AI never sees the preview', b && !/gif|gkb/.test(b) && /youtu\.be\/a/.test(b), b);
  /* a tall phone video, as MP4 (Chromium here may lack the H.264 decoder: then the plain-words message) */
  const vi3 = await blockIdx(f, 'video'); await openBlock(f, vi3);
  await f.page.setInputFiles('#crm input[data-w204vfile="' + vi3 + '"]', path.join(__dirname, 'fx_clip_tall.mp4'));
  await until(f, () => { const m = window.w202.state().mv; return m && (m.dur > 0 || m.err); }, null, 10000); await wait(300);
  b = await f.ev(() => { const m = window.w202.state().mv; return { shape: m.shape, dur: m.dur, err: m.err, txt: (document.querySelector('#crm .w204mv') || {}).innerText || '' }; });
  ok('a tall phone video (MP4) opens as Tall, or says plainly that this browser cannot read it', (b.dur > 0 && b.shape === 'tall') || /could not be read here\. An MP4 file works best/.test(b.err || ''), b);
  out.push('NOTE the MP4 clip in this Chromium: ' + (b.dur > 0 ? 'read (' + b.shape + ')' : 'not read: ' + b.err));
  await f.page.keyboard.press('Escape'); await wait(300);
  ok('Escape closes the panel', !(await f.ev(() => !!window.w202.state().mv || !!document.querySelector('#crm .w204mv'))));
  ok('no policy refusals for the video (media-src lets the page play its own blob: file)', viol.length === 0, viol);
  ok('no page errors (moving preview)', f.errs.length === 0, f.errs);
  await f.close();

  /* ---------- 5. A phone, a member, the tour ---------- */
  f = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', fixture: fixture(), candidate: cand, wait: 4000, csp: CSP });
  await f.ev(FAKE); await f.ev(FAKE204);
  await f.hash('#crm/studio', 2200);
  await click(f, '#crm [data-w202use="st_gift_thanks"]'); await wait(1500);
  await click(f, '#crm [data-w202add="video"]'); await wait(500);
  const pv = await blockIdx(f, 'video');
  await f.page.setInputFiles('#crm input[data-w204vfile="' + pv + '"]', path.join(__dirname, 'fx_clip.webm'));
  await until(f, () => { const m = window.w202.state().mv; return m && (m.dur > 0 || m.err); }, null, 10000); await wait(400);
  b = await f.ev(() => ({ over: document.documentElement.scrollWidth - window.innerWidth, hb: getComputedStyle(document.querySelector('#crm .w204hb span')).display, cols: getComputedStyle(document.querySelector('#crm .w204mvgrid')).gridTemplateColumns.split(' ').length }));
  ok('on a phone the panel is one column and fits; Undo and Redo are icons', b.over <= 1 && b.cols === 1 && b.hb === 'none', b);
  await shot(f, '06-phone-panel');
  ok('no page errors (phone)', f.errs.length === 0, f.errs);
  const tour = await f.ev(() => { const t = window.w122 && window.w122.tours.studio; return t ? { n: t.steps.length, ed: (t.steps.find(x => x.t === 'The editor') || {}).p } : null; });
  ok('the studio tour keeps eight steps; the editor step mentions the moving preview and Undo', tour && tour.n === 8 && /moving preview/.test(tour.ed || '') && /Undo and Redo/.test(tour.ed || ''), tour);
  await f.close();
  f = await fresh(browser, { who: 'member', hash: '#mypage', fixture: fixture(), candidate: cand, wait: 4000 });
  await f.ev(FAKE);
  await f.hash('#crm/studio/e/st_gift_thanks', 2600);
  b = await f.ev(() => ({ ro: window.w202 && window.w202.state().ro, undo: !!document.querySelector('#crm #w204undo'), fmt: !!document.querySelector('#crm [data-w204fmtb]'), slot: !!document.querySelector('#crm input[data-w204vfile]') }));
  ok('a member on a starter (read only) gets no Undo, no B or Link, no video upload', b.ro === true && !b.undo && !b.fmt && !b.slot, b);
  ok('no page errors (member)', f.errs.length === 0, f.errs);
  await f.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw204drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
