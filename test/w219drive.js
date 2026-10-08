/* w219drive.js: wave219, Hub notifications on computers and phones. Steel (07/10/26): "if it can send in-app notifications
   on updates, I would like to do that if it's possible, especially browser use for those that are using the computer".
   His choices: mentions and assigned work, and announcements; each person chooses Hub, Slack or both; one gentle prompt.
   The browser's notification parts are fakes (the test page is not a secure origin): Notification (permission and the
   ask), PushManager, navigator.serviceWorker (register, ready, the subscription, messages). The database RPCs are kept
   in window.__WAFIX so reads see what the page saved (wa219_push_save, wa219_channel_set, and hub-push drop through
   functions.invoke).
   Checks: the head (manifest, iOS icon and metas); the service worker registered at /sw.js; the card on Home once per
   device, its words, Turn on (the permission asked once from the tap, the subscription with the Hub's key, the device
   saved with its label, the card gone, the toast), Not now (gone, and gone on the next visit), a blocked permission;
   Settings, Notifications (On, the test through hub-push with this device, Turn off, the choice of where, announcements
   through wave116j's saved list, the line about Slack, the other devices and Remove, Install); the visit that re-saves
   and subscribes again; a new key replaces an old subscription; the service worker's wa-open and wa-push; Sign out turns
   the device off before signing out; iPhone in Safari (Add to Home Screen first), the iPhone app, Edge on Windows; a
   phone width; a board viewer sees nothing; no key yet, no card; no page errors.
   Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26 16:00 Toronto). CAND=<file> tests another build. */
const path = require('path');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 600) : '')); } }

const STEEL = 'steel.macdonald@welfareavenue.com';
/* a real-looking public key (65 bytes, uncompressed P-256 point) */
const KEY = 'BOrKXcx_6oS0Wbz7J9hPXz3zZqgcYbQ6r0K3e3oVb1b8N3W8e3G2jX0p9TqN5rZx0n9X9f1d0G7k6pYfQm2bJ4U';
const KEY2 = 'BPq0' + KEY.slice(4);
function fx(o) {
  o = o || {};
  const f = loadFixture(path.join(__dirname, 'fixture.json'));
  f.app_config = (f.app_config || []).filter(r => r.key !== 'push_vapid_public');
  if (o.key !== false) f.app_config.push({ key: 'push_vapid_public', value: o.key || KEY });
  f.hub_push_subs = o.subs || [];
  f.wa_notify_prefs = o.prefs || [];
  return f;
}
const RPCS = { loop_feed: [], loop_in_now: [], wa_org_editor: true };
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const UA_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0';

/* the browser's notification parts, faked; o: perm (start), answer (to the ask), push (false: no Push API), standalone, ua, sub (an existing subscription's key) */
function fakes(o) {
  o = o || {};
  return `(function(){
  var O = ${JSON.stringify(o)};
  window.__log = []; window.__asked = 0; window.__subscribes = 0; window.__unsubs = 0;
  try { var seq = JSON.parse(sessionStorage.getItem('w219seq') || '[]'); window.__seqBefore = seq; } catch (e) { window.__seqBefore = []; }
  function seqAdd(x) { try { var s = JSON.parse(sessionStorage.getItem('w219seq') || '[]'); s.push(x); sessionStorage.setItem('w219seq', JSON.stringify(s)); } catch (e) {} }
  if (O.ua) Object.defineProperty(navigator, 'userAgent', { get: function () { return O.ua; }, configurable: true });
  if (O.ua && /iPhone/.test(O.ua)) Object.defineProperty(navigator, 'maxTouchPoints', { get: function () { return 5; }, configurable: true });
  if (O.standalone) {
    Object.defineProperty(navigator, 'standalone', { get: function () { return true; }, configurable: true });
    var mm = window.matchMedia.bind(window);
    window.matchMedia = function (q) { if (/display-mode:\\s*standalone/.test(q)) return { matches: true, media: q, addListener: function(){}, removeListener: function(){}, addEventListener: function(){}, removeEventListener: function(){} }; return mm(q); };
  }
  if (O.push === false) { try { delete window.Notification; } catch (e) {} try { delete window.PushManager; } catch (e) {} return wrapDb(); }
  var perm = O.perm || 'default';
  function N() {}
  Object.defineProperty(N, 'permission', { get: function () { return perm; } });
  N.requestPermission = function (cb) { window.__asked++; perm = O.answer || 'granted'; if (cb) cb(perm); return Promise.resolve(perm); };
  window.Notification = N;
  window.PushManager = function () {};
  function b64(s) { var t = s.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; var b = atob(t), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  var cur = null, n = 0;
  function makeSub(keyBytes) {
    var ep = 'https://fcm.googleapis.com/fcm/send/dev-' + (++n);
    return { endpoint: ep, options: { applicationServerKey: keyBytes.buffer.slice(0) },
      toJSON: function () { return { endpoint: ep, keys: { p256dh: 'B' + 'A'.repeat(86), auth: 'C'.repeat(22) } }; },
      unsubscribe: function () { window.__unsubs++; seqAdd('unsubscribe'); if (cur && cur.endpoint === ep) cur = null; return Promise.resolve(true); } };
  }
  if (O.sub) cur = makeSub(b64(O.sub));
  var reg = { scope: '/', pushManager: {
    getSubscription: function () { return Promise.resolve(cur); },
    subscribe: function (opts) { window.__subscribes++; window.__subOpts = { uvo: opts.userVisibleOnly, len: new Uint8Array(opts.applicationServerKey).length, first: new Uint8Array(opts.applicationServerKey)[0] }; cur = makeSub(new Uint8Array(opts.applicationServerKey)); return Promise.resolve(cur); } } };
  var ls = [];
  var sw = { register: function (url, op) { window.__swReg = [url, op && op.scope]; return Promise.resolve(reg); }, ready: Promise.resolve(reg), controller: null,
    addEventListener: function (t, f) { if (t === 'message') ls.push(f); } };
  Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true });
  window.__swPost = function (d) { ls.forEach(function (f) { f({ data: d }); }); };
  window.__cur = function () { return cur; };
  wrapDb();
  window.__WA_INVOKE = function (name, opts) {
    var b = JSON.parse(JSON.stringify((opts && opts.body) || {})); window.__log.push({ invoke: name, body: b });
    if (window.__calls) window.__calls.push({ name: name, body: b });
    if (name === 'hub-push' && b.action === 'drop') { seqAdd('drop'); var F = window.__WAFIX, me = (window.__WA_TEST_EMAIL || '').toLowerCase(), before = (F.hub_push_subs || []).length; F.hub_push_subs = (F.hub_push_subs || []).filter(function (r) { return !(r.endpoint === b.endpoint && r.email === me); }); return { data: { ok: true, removed: before - F.hub_push_subs.length }, error: null }; }
    if (name === 'hub-push' && b.action === 'test') return { data: window.__testAnswer || { ok: true, devices: 1, sent: 1 }, error: null };
    return { data: null, error: null };
  };
  function wrapDb() {
    var _sb;
    Object.defineProperty(window, 'supabase', { configurable: true, get: function () { return _sb; }, set: function (v) {
      var cc = v.createClient;
      v.createClient = function () {
        var c = cc.apply(this, arguments);
        var rpc = c.rpc;
        c.rpc = function (fn, args) {
          if (/^wa219_/.test(fn)) {
            window.__log.push({ rpc: fn, args: JSON.parse(JSON.stringify(args || {})) });
            var F = window.__WAFIX, me = (window.__WA_TEST_EMAIL || '').toLowerCase();
            if (fn === 'wa219_push_save') { F.hub_push_subs = (F.hub_push_subs || []).filter(function (r) { return r.endpoint !== args.p_endpoint; }); F.hub_push_subs.push({ id: 900 + F.hub_push_subs.length, email: me, endpoint: args.p_endpoint, device: args.p_device, created_at: '2026-09-25T20:00:00Z', last_sent_at: null, last_error: null }); return Promise.resolve({ data: 1, error: null }); }
            if (fn === 'wa219_channel_set') { var p = (F.wa_notify_prefs || []).filter(function (r) { return r.email === me; })[0]; if (!p) { p = { email: me, disabled: [], prefs: {} }; (F.wa_notify_prefs = F.wa_notify_prefs || []).push(p); } p.prefs = Object.assign({}, p.prefs, { channel: args.p_channel }); return Promise.resolve({ data: args.p_channel, error: null }); }
          }
          return rpc.apply(this, arguments);
        };
        var from = c.from;
        c.from = function (t) { var b = from.apply(this, arguments); if (t === 'wa_notify_prefs') { var up = b.upsert.bind(b); b.upsert = function (p) { window.__log.push({ upsert: t, payload: JSON.parse(JSON.stringify(p)) }); return up(p); }; } return b; };
        var so = c.auth.signOut;
        c.auth.signOut = function () { seqAdd('signOut'); return so.apply(this, arguments); };
        return c;
      };
      _sb = v;
    } });
  }
})();`;
}
async function spyInvoke(f, answer) {
  await f.ev(a => { window.__calls = []; if (a) window.__testAnswer = a; }, answer || null);
}
const st = f => f.ev(() => window.__wa219 ? window.__wa219.state() : null);
const card = f => f.ev(() => { const c = document.getElementById('w219card'); return c ? { text: c.textContent, parent: c.parentNode && c.parentNode.id, prev: c.previousElementSibling && (c.previousElementSibling.id || c.previousElementSibling.className) } : null; });
const toastText = f => f.ev(() => { const t = document.getElementById('toast'); return t ? t.textContent : ''; });
async function openNotif(f) {
  await f.ev(() => { if (window.w116Settings) window.w116Settings('notifications'); });
  await f.page.waitForTimeout(900);
  return f.ev(() => { const s = document.getElementById('w219set'); return s ? { text: s.textContent, html: s.innerHTML } : null; });
}

(async () => {
  const browser = await launch();
  const cand = process.env.CAND || path.join(__dirname, '../build/candidate.html');
  try {
    /* 1. the first visit on a computer: the head, the worker, the card */
    {
      const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(), rpcs: RPCS, candidate: cand, init: fakes({}) });
      await f.page.waitForTimeout(800);
      const head = await f.ev(() => ({ man: (document.querySelector('link[rel="manifest"]') || {}).getAttribute && document.querySelector('link[rel="manifest"]').getAttribute('href'),
        touch: Array.from(document.querySelectorAll('link[rel="apple-touch-icon"]')).map(l => l.getAttribute('href')),
        cap: (document.querySelector('meta[name="apple-mobile-web-app-capable"]') || {}).content, title: (document.querySelector('meta[name="apple-mobile-web-app-title"]') || {}).content,
        theme: (document.querySelector('meta[name="theme-color"]') || {}).content }));
      ok('the page links the app manifest', head.man === '/manifest.webmanifest', head);
      ok('the iOS icon is the real file', head.touch.length >= 1 && head.touch.every(h => h === '/icons/apple-touch-180.png'), head.touch);
      ok('iOS reads it as an app named WA Hub', head.cap === 'yes' && head.title === 'WA Hub', head);
      ok('the theme colour stays Community green', String(head.theme || '').toLowerCase() === '#103f39', head.theme);
      ok('the service worker is registered at /sw.js for the whole Hub', JSON.stringify(await f.ev(() => window.__swReg)) === JSON.stringify(['/sw.js', '/']), await f.ev(() => window.__swReg));
      const c = await card(f);
      ok('Home asks once: Get Hub notifications on this computer?', !!c && /Get Hub notifications on this computer\?/.test(c.text), c);
      ok('the card says what pops up', !!c && /mentions you, gives you work or posts an announcement/.test(c.text), c && c.text);
      ok('the card sits in Home, near the top', !!c && c.parent === 'mpBody', c);
      ok('nothing was asked before the tap', (await f.ev(() => window.__asked)) === 0);
      await f.ev(() => document.querySelector('#w219card [data-w219="on"]').click());
      await f.page.waitForTimeout(700);
      const s = await st(f);
      ok('Turn on asks the browser once', (await f.ev(() => window.__asked)) === 1);
      const so = await f.ev(() => window.__subOpts);
      ok('the subscription uses the Hub\'s key, visible notifications only', so && so.uvo === true && so.len === 65 && so.first === 4, so);
      const saved = (await f.ev(() => window.__log)).filter(x => x.rpc === 'wa219_push_save');
      ok('the device is saved once, with its keys and label', saved.length === 1 && /^https:\/\/fcm\.googleapis\.com\//.test(saved[0].args.p_endpoint) && saved[0].args.p_p256dh.length === 87 && saved[0].args.p_auth.length === 22 && /^Chrome on Linux$/.test(saved[0].args.p_device), saved);
      ok('this device is now on for Steel', s && s.mine === true && s.perm === 'granted', s);
      ok('the card is gone', !(await card(f)));
      ok('the toast says it is on for this computer', /Hub notifications are on for this computer\./.test(await toastText(f)), await toastText(f));
      const ls = await f.ev(e => ({ on: localStorage.getItem('w219on:' + e), ask: localStorage.getItem('w219ask') }), STEEL);
      ok('this browser remembers it (for this person) and never asks again', ls.on === '1' && ls.ask === 'done', ls);

      /* Settings, Notifications */
      await spyInvoke(f);
      const set = await openNotif(f);
      ok('Settings, Notifications shows this device On', !!set && /Hub notifications on this computer/.test(set.text) && /On\. Mentions, work for you and announcements pop up here\./.test(set.text), set && set.text);
      ok('with Send me a test and Turn off', !!set && /Send me a test/.test(set.text) && /Turn off/.test(set.text));
      const ch = await f.ev(() => { const r = document.querySelector('#w219set input[name="w219ch"]:checked'); return r ? r.value : null; });
      ok('where: In the Hub and on Slack by default', ch === 'both', ch);
      const ann = await f.ev(() => { const a = document.querySelector('#w219set [data-jev="announcement"]'); return a ? a.checked : null; });
      ok('new announcements are on by default', ann === true, ann);
      const what = await f.ev(() => { const n = document.querySelector('.w116js .w219what'); return n ? n.textContent : null; });
      ok('wave116j\'s list now says it covers both', !!what && /^Which of these reach you\. On Slack they come to your DMs/.test(what), what);
      const order = await f.ev(() => { const t = document.querySelector('.w116js .tabs'); return t && t.nextElementSibling && t.nextElementSibling.id; });
      ok('the device block comes first under the tabs', order === 'w219set', order);
      await f.ev(() => document.querySelector('#w219set [data-w219="test"]').click());
      await f.page.waitForTimeout(500);
      const calls = (await f.ev(() => window.__calls)).filter(c => c.name === 'hub-push');
      ok('Send me a test asks hub-push for this device only', calls.length === 1 && calls[0].name === 'hub-push' && calls[0].body.action === 'test' && /fcm\.googleapis\.com/.test(calls[0].body.endpoint || ''), calls);
      ok('and says it is on its way', /Sent\. It should pop up on this computer in a moment\./.test(await toastText(f)), await toastText(f));
      await f.ev(() => { const r = document.querySelector('#w219set input[value="hub"]'); r.click(); });
      await f.page.waitForTimeout(500);
      const chs = (await f.ev(() => window.__log)).filter(x => x.rpc === 'wa219_channel_set');
      ok('In the Hub only is saved through wa219_channel_set', chs.length === 1 && chs[0].args.p_channel === 'hub', chs);
      ok('and the toast says so', /now arrive in the Hub only/.test(await toastText(f)), await toastText(f));
      const ch2 = await f.ev(() => { const r = document.querySelector('#w219set input[name="w219ch"]:checked'); return r ? r.value : null; });
      ok('the choice stays chosen', ch2 === 'hub', ch2);
      await f.ev(() => { const a = document.querySelector('#w219set [data-jev="announcement"]'); a.click(); });
      await f.page.waitForTimeout(500);
      const ups = (await f.ev(() => window.__log)).filter(x => x.upsert === 'wa_notify_prefs');
      ok('announcements off is saved in the person\'s list (wave116j)', ups.length >= 1 && (ups[ups.length - 1].payload.disabled || []).indexOf('announcement') >= 0 && ups[ups.length - 1].payload.email === STEEL, ups);
      /* reopen: the state is read again */
      await f.ev(() => { if (typeof closeModal === 'function') closeModal(); });
      const set2 = await openNotif(f);
      const again = await f.ev(() => ({ ch: (document.querySelector('#w219set input[name="w219ch"]:checked') || {}).value, ann: (document.querySelector('#w219set [data-jev="announcement"]') || {}).checked }));
      ok('reopened, Settings reads the saved choice', again.ch === 'hub', again);
      ok('Hub only with a device on says Slack stays quiet', !!set2 && /Slack stays quiet for these while a device of yours has Hub notifications on/.test(set2.text), set2 && set2.text);
      /* Turn off */
      await f.ev(() => document.querySelector('#w219set [data-w219="off"]').click());
      await f.page.waitForTimeout(700);
      const drops = (await f.ev(() => window.__log)).filter(x => x.invoke === 'hub-push' && x.body.action === 'drop').map(x => ({ args: { p_endpoint: x.body.endpoint } }));
      ok('Turn off removes this device through hub-push and unsubscribes', drops.length === 1 && /fcm\.googleapis\.com/.test(drops[0].args.p_endpoint) && (await f.ev(() => window.__unsubs)) === 1, drops);
      const set3 = await f.ev(() => document.getElementById('w219set').textContent);
      ok('Settings then says Off, with Turn on', /Off\. Turn them on/.test(set3) && /Turn on/.test(set3), set3);
      ok('Hub only with no device says Slack keeps bringing them', /None of your devices has Hub notifications on yet, so Slack keeps bringing them/.test(set3), set3);
      ok('Off is remembered for this person', (await f.ev(e => localStorage.getItem('w219on:' + e), STEEL)) === null);
      ok('no page errors (computer)', f.errs.length === 0, f.errs);
      await f.close();
    }

    /* 2. Not now: the card goes and stays gone */
    {
      const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(), rpcs: RPCS, candidate: cand, init: fakes({}) });
      await f.page.waitForTimeout(600);
      ok('the card shows on a fresh device', !!(await card(f)));
      await f.ev(() => document.querySelector('#w219card [data-w219="later"]').click());
      await f.page.waitForTimeout(400);
      ok('Not now hides it', !(await card(f)));
      ok('Not now asks nothing', (await f.ev(() => window.__asked)) === 0);
      ok('and points to Settings', /any time in Settings, Notifications/.test(await toastText(f)), await toastText(f));
      ok('it is remembered on this device', (await f.ev(() => localStorage.getItem('w219ask'))) === 'no');
      await f.hash('#tasks', 600); await f.hash('#mypage', 1200);
      ok('back on Home, no card', !(await card(f)));
      await f.close();
      const g = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(), rpcs: RPCS, candidate: cand, init: fakes({}) + 'try { localStorage.setItem("w219ask", "no"); } catch (e) {}' });
      await g.page.waitForTimeout(600);
      ok('the next visit does not ask again', !(await card(g)));
      const set = await openNotif(g);
      ok('Settings still offers Turn on', !!set && /Turn on/.test(set.text), set && set.text);
      await g.close();
    }

    /* 3. the browser's answer is Block */
    {
      const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(), rpcs: RPCS, candidate: cand, init: fakes({ answer: 'denied' }) });
      await f.page.waitForTimeout(600);
      await f.ev(() => document.querySelector('#w219card [data-w219="on"]').click());
      await f.page.waitForTimeout(600);
      ok('blocked: nothing is subscribed or saved', (await f.ev(() => window.__subscribes)) === 0 && !(await f.ev(() => window.__log)).some(x => x.rpc === 'wa219_push_save'));
      ok('blocked: the toast says so', /blocked for the Hub in this browser/.test(await toastText(f)), await toastText(f));
      ok('blocked: the card goes', !(await card(f)));
      const set = await openNotif(f);
      ok('blocked: Settings says how to allow them', !!set && /set Notifications to Allow, then reload the Hub/.test(set.text) && !/Turn on/.test(set.text), set && set.text);
      await f.close();
    }

    /* 4. a returning visit: saved again, and subscribed again when the browser dropped it; a new key replaces the old */
    {
      const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(), rpcs: RPCS, candidate: cand,
        init: fakes({ perm: 'granted' }) + 'try { localStorage.setItem("w219on:' + STEEL + '", "1"); localStorage.setItem("w219ask", "done"); } catch (e) {}' });
      await f.page.waitForTimeout(1200);
      const saves = (await f.ev(() => window.__log)).filter(x => x.rpc === 'wa219_push_save');
      ok('a dropped subscription is made again on the visit, without asking', (await f.ev(() => window.__subscribes)) === 1 && (await f.ev(() => window.__asked)) === 0, await f.ev(() => [window.__subscribes, window.__asked]));
      ok('and saved for Steel', saves.length === 1, saves);
      ok('no card for a device that is on', !(await card(f)));
      await f.close();
      const g = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx({ key: KEY2 }), rpcs: RPCS, candidate: cand,
        init: fakes({ perm: 'granted', sub: KEY }) + 'try { localStorage.setItem("w219on:' + STEEL + '", "1"); } catch (e) {}' });
      await g.page.waitForTimeout(1200);
      ok('a subscription made with an old key is replaced', (await g.ev(() => window.__unsubs)) === 1 && (await g.ev(() => window.__subscribes)) === 1, await g.ev(() => [window.__unsubs, window.__subscribes]));
      ok('the replacement is saved', (await g.ev(() => window.__log)).filter(x => x.rpc === 'wa219_push_save').length === 1);
      /* someone else's turn on this browser: no flag for them, nothing re-saved */
      await g.close();
      const h = await fresh(browser, { who: 'plain', width: 1366, hash: '#mypage', fixture: fx(), rpcs: RPCS, candidate: cand,
        init: fakes({ perm: 'granted', sub: KEY }) + 'try { localStorage.setItem("w219on:' + STEEL + '", "1"); } catch (e) {}' });
      await h.page.waitForTimeout(1200);
      ok('another person on the same browser does not take the device over by visiting', (await h.ev(() => window.__log)).filter(x => x.rpc === 'wa219_push_save').length === 0);
      const hc = await card(h);
      ok('they are offered their own Turn on', !!hc && /Get Hub notifications/.test(hc.text), hc);
      await h.close();
    }

    /* 5. the service worker's messages; other devices; Install; Sign out */
    {
      const subs = [{ id: 31, email: STEEL, endpoint: 'https://web.push.apple.com/abc', device: 'The Hub app on iPhone', created_at: '2026-09-20T12:00:00Z', last_sent_at: null, last_error: null }];
      const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx({ subs }), rpcs: RPCS, candidate: cand,
        init: fakes({ perm: 'granted' }) + 'try { localStorage.setItem("w219on:' + STEEL + '", "1"); sessionStorage.removeItem("w219seq"); } catch (e) {}' });
      await f.page.waitForTimeout(1200);
      await f.ev(() => { window.__pushes = []; window.addEventListener('wa-push', e => window.__pushes.push(e.detail)); window.__swPost({ type: 'wa-push', tag: 'task-194', url: '/#task/194' }); });
      ok('a push while the Hub is open fires wa-push', JSON.stringify(await f.ev(() => window.__pushes)) === JSON.stringify([{ tag: 'task-194', url: '/#task/194' }]), await f.ev(() => window.__pushes));
      await f.ev(() => window.__swPost({ type: 'wa-open', url: location.origin + '/#task/194' }));
      await f.page.waitForTimeout(300);
      ok('a notification click opens its link in the open Hub', (await f.ev(() => location.hash)) === '#task/194', await f.ev(() => location.hash));
      await f.ev(() => window.__swPost({ type: 'wa-open', url: 'https://example.com/#evil' }));
      await f.page.waitForTimeout(200);
      ok('a link to another site is ignored', (await f.ev(() => location.hash)) === '#task/194');
      await f.hash('#mypage', 900);
      await f.ev(() => { const ev = new Event('beforeinstallprompt'); ev.prompt = () => { window.__prompted = (window.__prompted || 0) + 1; }; ev.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(ev); });
      const set = await openNotif(f);
      ok('other devices are listed', !!set && /Your other devices with Hub notifications/.test(set.text) && /The Hub app on iPhone/.test(set.text), set && set.text);
      ok('Install shows where the browser offers it', !!set && /Install the Hub as an app/.test(set.text), set && set.text);
      await f.ev(() => document.querySelector('#w219set [data-w219="install"]').click());
      await f.page.waitForTimeout(400);
      ok('Install opens the browser\'s own prompt', (await f.ev(() => window.__prompted)) === 1);
      ok('then says it is installed', /The Hub is installed on this computer/.test(await f.ev(() => document.getElementById('w219set').textContent)));
      await f.ev(() => document.querySelector('#w219set [data-w219rm="https://web.push.apple.com/abc"]').click());
      await f.page.waitForTimeout(600);
      const rm = (await f.ev(() => window.__log)).filter(x => x.invoke === 'hub-push' && x.body.action === 'drop').map(x => ({ args: { p_endpoint: x.body.endpoint } }));
      ok('Remove takes another device off through hub-push', rm.length === 1 && rm[0].args.p_endpoint === 'https://web.push.apple.com/abc', rm);
      ok('and it leaves the list', !/The Hub app on iPhone/.test(await f.ev(() => document.getElementById('w219set').textContent)));
      /* Sign out: this device off first */
      await f.ev(() => { if (typeof closeModal === 'function') closeModal(); sessionStorage.removeItem('w219seq'); signOutAll(); });
      await f.page.waitForTimeout(2500);
      const seq = await f.ev(() => window.__seqBefore || []);   /* read by the fakes on the reload, before this scenario's init clears it */
      ok('Sign out turns this device off, then signs out', JSON.stringify(seq.slice(0, 3)) === JSON.stringify(['drop', 'unsubscribe', 'signOut']), seq);
      ok('no page errors (messages, devices, sign out)', f.errs.length === 0, f.errs);
      await f.close();
    }

    /* 6. iPhone in Safari: Add to Home Screen first; the iPhone app; Edge on Windows */
    {
      const f = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', fixture: fx(), rpcs: RPCS, candidate: cand, init: fakes({ push: false, ua: UA_IPHONE }) });
      await f.page.waitForTimeout(800);
      const c = await card(f);
      ok('iPhone in Safari: the card says Add to Home Screen first', !!c && /Hub notifications on your iPhone/.test(c.text) && /tap Share, then Add to Home Screen/.test(c.text) && /Got it/.test(c.text), c);
      ok('iPhone in Safari: no Turn on there', !(await f.ev(() => document.querySelector('#w219card [data-w219="on"]'))));
      const wide = await f.ev(() => document.documentElement.scrollWidth);
      ok('iPhone: no sideways scroll', wide <= 390, wide);
      await f.ev(() => document.querySelector('#w219card [data-w219="later"]').click());
      await f.page.waitForTimeout(300);
      ok('iPhone: Got it hides it', !(await card(f)));
      const set = await openNotif(f);
      ok('iPhone in Safari: Settings says the same', !!set && /Add the Hub to your Home Screen first/.test(set.text), set && set.text);
      ok('no page errors (iPhone Safari)', f.errs.length === 0, f.errs);
      await f.close();
      const g = await fresh(browser, { who: 'admin', width: 390, hash: '#mypage', fixture: fx(), rpcs: RPCS, candidate: cand, init: fakes({ ua: UA_IPHONE, standalone: true }) });
      await g.page.waitForTimeout(800);
      const gc = await card(g);
      ok('the iPhone app: Get Hub notifications on this phone?', !!gc && /Get Hub notifications on this phone\?/.test(gc.text), gc);
      await g.ev(() => document.querySelector('#w219card [data-w219="on"]').click());
      await g.page.waitForTimeout(700);
      const sv = (await g.ev(() => window.__log)).filter(x => x.rpc === 'wa219_push_save');
      ok('the iPhone app saves itself as The Hub app on iPhone', sv.length === 1 && sv[0].args.p_device === 'The Hub app on iPhone', sv);
      const box = await g.ev(() => { const b = document.querySelector('#w219card'); return b ? b.getBoundingClientRect().width : 0; });
      const set2 = await openNotif(g);
      ok('the iPhone app: Settings says You are using the Hub app', !!set2 && /You are using the Hub app\./.test(set2.text), set2 && set2.text);
      ok('phone: Settings has no sideways scroll', (await g.ev(() => document.documentElement.scrollWidth)) <= 390);
      ok('no page errors (iPhone app)', g.errs.length === 0, g.errs);
      await g.close();
      const h = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx(), rpcs: RPCS, candidate: cand, init: fakes({ ua: UA_EDGE }) });
      await h.page.waitForTimeout(700);
      await h.ev(() => document.querySelector('#w219card [data-w219="on"]').click());
      await h.page.waitForTimeout(700);
      const hv = (await h.ev(() => window.__log)).filter(x => x.rpc === 'wa219_push_save');
      ok('Edge on Windows is labelled so', hv.length === 1 && hv[0].args.p_device === 'Edge on Windows', hv);
      await h.close();
    }

    /* 7. who sees nothing: a board viewer; nobody before the key exists */
    {
      const f = await fresh(browser, { who: 'board', width: 1366, hash: '#mypage', fixture: fx(), rpcs: RPCS, candidate: cand, init: fakes({}) });
      await f.page.waitForTimeout(900);
      ok('a board viewer gets no card', !(await card(f)));
      ok('a board viewer: no worker registered', !(await f.ev(() => window.__swReg)));
      await f.close();
      const g = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', fixture: fx({ key: false }), rpcs: RPCS, candidate: cand, init: fakes({}) });
      await g.page.waitForTimeout(800);
      ok('before the Hub has its key, no card', !(await card(g)));
      const set = await openNotif(g);
      ok('and Settings says it is being set up', !!set && /being set up/.test(set.text), set && set.text);
      ok('no page errors (board, no key)', g.errs.length === 0, g.errs);
      await g.close();
    }
  } catch (e) {
    ok('the run finished', false, String(e && e.stack || e));
  }
  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
