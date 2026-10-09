/* w220drive.js: wave220, phone numbers on the Hub profile. Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26).
   wa220_member_phone and wa220_set_member_phone are answered (and recorded) by wrapping db.rpc before the person page opens.
   CAND=<file>; SHOTS=1 saves screenshots in test/shots_w220/. */
const fs = require('fs');
const path = require('path');
const { launch, fresh } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }
const SHOTS = process.env.SHOTS ? path.join(__dirname, 'shots_w220') : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
async function shot(f, name) { if (SHOTS) await f.page.screenshot({ path: path.join(SHOTS, name + '.png') }); }

/* phones by roster id; set echoes like the database: the new number first, the others kept */
function wrap(book) {
  return `window.__220calls = []; window.__220book = ${JSON.stringify(book)}; (function () { var orig = db.rpc.bind(db); db.rpc = function (fn, args) {
    if (fn === 'wa220_member_phone') { window.__220calls.push(['get', args]); var b = window.__220book[String(args.p_member)]; return Promise.resolve({ data: b ? [b] : [], error: null }); }
    if (fn === 'wa220_set_member_phone') { window.__220calls.push(['set', args]); var b2 = window.__220book[String(args.p_member)];
      if (!b2 || !b2.can_edit) return Promise.resolve({ data: null, error: { message: 'only the person, HR, leaders and admins change a team phone' } });
      var d = function (p) { return String(p || '').replace(/\\D/g, '').slice(-10); };
      var rest = (b2.phones || []).slice(1).filter(function (p) { return d(p) !== d(args.p_phone); });
      b2.phones = args.p_phone ? [args.p_phone].concat(rest) : rest; return Promise.resolve({ data: b2.phones.slice(), error: null }); }
    return orig(fn, args); }; })();`;
}
async function open(f, id) { await f.hash('#mypage', 600); await f.hash('#person/' + id, 2600); }
function read(p) {
  return p.evaluate(() => {
    const sec = document.querySelector('section#personpage:not([data-w116kdecoy])');
    const meta = sec && sec.querySelector('.w116khead .meta');
    const els = meta ? meta.querySelectorAll('.w220ph') : [];
    const el = els[0];
    if (!el) return { n: 0, meta: !!meta };
    const tel = el.querySelector('a[href^="tel:"]'), sms = el.querySelector('a[href^="sms:"]');
    return { n: els.length, mode: el.getAttribute('data-w220'), text: el.textContent.replace(/\s+/g, ' ').trim(), tel: tel && tel.getAttribute('href'), sms: sms && sms.getAttribute('href'),
      edit: !!el.querySelector('[data-w220edit]'), input: (el.querySelector('[data-w220in]') || {}).value, err: (el.querySelector('.w220err') || {}).textContent || '',
      afterMail: !!(el.previousElementSibling && /^mailto:/.test(el.previousElementSibling.getAttribute('href') || '')) };
  });
}

(async () => {
  const browser = await launch();
  const book = {
    17: { contact_id: 450, phones: ['450-626-0389'], can_edit: true },
    34: { contact_id: 441, phones: [], can_edit: true },
    1: { contact_id: 449, phones: ['514-560-9726', '(438) 000-1111'], can_edit: false }
  };

  /* an admin: show, edit, save, check, cancel, add */
  const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', wait: 4200 });
  const p = f.page;
  await p.evaluate(wrap(book));
  await open(f, 17);
  let a = await read(p);
  ok('the number shows once in the header, after the email', a.n === 1 && a.mode === 'show' && /450-626-0389/.test(a.text) && a.afterMail, a);
  ok('Call and Text links dial the digits', a.tel === 'tel:4506260389' && a.sms === 'sms:4506260389', a);
  ok('Edit is offered when the database says so', a.edit, a);
  await shot(f, 'admin_show');
  await p.click('#personpage [data-w220edit]'); await p.waitForTimeout(200);
  a = await read(p);
  ok('Edit opens an input with the number', a.mode === 'edit' && a.input === '450-626-0389', a);
  ok('the input has focus', await p.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-w220in')));
  await p.fill('#personpage [data-w220in]', 'call me'); await p.click('#personpage [data-w220save]'); await p.waitForTimeout(300);
  a = await read(p);
  ok('a non-number is refused on the page, nothing sent', /does not look like a phone number/.test(a.err) && !(await p.evaluate(() => window.__220calls.some(c => c[0] === 'set'))), a);
  await p.fill('#personpage [data-w220in]', '514-111-2222'); await p.press('#personpage [data-w220in]', 'Enter'); await p.waitForTimeout(700);
  a = await read(p);
  const sets = await p.evaluate(() => window.__220calls.filter(c => c[0] === 'set'));
  ok('Enter saves through wa220_set_member_phone', sets.length === 1 && sets[0][1].p_member === 17 && sets[0][1].p_phone === '514-111-2222', sets);
  ok('the new number shows', a.mode === 'show' && /514-111-2222/.test(a.text) && a.tel === 'tel:5141112222', a);
  ok('the toast says the CRM and Volunteer Manager follow', await p.evaluate(() => /Phone saved/.test(document.body.innerText)));
  await p.click('#personpage [data-w220edit]'); await p.waitForTimeout(150); await p.press('#personpage [data-w220in]', 'Escape'); await p.waitForTimeout(200);
  a = await read(p);
  ok('Escape cancels', a.mode === 'show' && /514-111-2222/.test(a.text), a);
  await p.evaluate(() => { wa33Person('17'); }); await p.waitForTimeout(2600);
  a = await read(p);
  ok('a redraw of the page keeps one number, fresh from the database', a.n === 1 && /514-111-2222/.test(a.text), a);
  await open(f, 34);
  a = await read(p);
  ok('no number yet: Add a phone number', a.n === 1 && a.mode === 'add' && /Add a phone number/.test(a.text), a);
  await p.click('#personpage [data-w220edit]'); await p.waitForTimeout(150);
  await p.fill('#personpage [data-w220in]', '514-690-7338'); await p.click('#personpage [data-w220save]'); await p.waitForTimeout(700);
  a = await read(p);
  ok('adding saves and shows it', a.mode === 'show' && /514-690-7338/.test(a.text), a);
  await open(f, 1);
  a = await read(p);
  ok('another person: no Edit when the database says no; other numbers counted', a.n === 1 && !a.edit && /514-560-9726/.test(a.text) && /\+1 more in the CRM/.test(a.text), a);
  await open(f, 9);
  a = await read(p);
  ok('no row (not staff, or nothing to show): nothing drawn', a.n === 0 && a.meta, a);
  ok('admin: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  /* a board viewer: the database returns no row, so nothing shows */
  const g = await fresh(browser, { who: 'board', width: 1366, hash: '#mypage', wait: 4200 });
  await g.page.evaluate(wrap({}));
  await open(g, 17);
  a = await read(g.page);
  ok('board viewer: no number', a.n === 0, a);
  ok('board: no page errors', g.errs.length === 0, g.errs);
  await g.close();

  /* a phone */
  const h = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', wait: 4200 });
  await h.page.evaluate(wrap(book));
  await open(h, 17);
  a = await read(h.page);
  ok('phone width: the number shows', a.n === 1 && /450-626-0389/.test(a.text), a);
  await h.page.click('#personpage [data-w220edit]'); await h.page.waitForTimeout(200);
  const wide = await h.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, r: (document.querySelector('#personpage [data-w220in]') || { getBoundingClientRect: () => ({}) }).getBoundingClientRect() }));
  ok('phone width: editing fits, no sideways scroll', wide.sw <= wide.iw && wide.r.right <= wide.iw, wide);
  await shot(h, 'phone_edit');
  ok('phone: no page errors', h.errs.length === 0, h.errs);
  await h.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
