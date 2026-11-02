
  /* ---------- Set up your Hub: the app and the notifications ----------
     Encouraged, never forced: nothing here blocks anything, Not now is always there, and one tap does the work wherever the
     browser allows it. On an iPhone the two steps have an order (Apple only allows Hub notifications from the Home Screen
     app), so the second waits for the first and says why. */
  var KEY_APP = 'wa272.app', KEY_HIDE = 'wa272.setup', KEY_TIP = 'wa272.tip';
  var UA = navigator.userAgent || '';
  var IPAD = /iPad/.test(UA) || (/Macintosh/.test(UA) && (navigator.maxTouchPoints || 0) > 1);
  var IOS = IPAD || /iPhone|iPod/.test(UA), ANDROID = /Android/.test(UA);
  var FIREFOX = /Firefox\//.test(UA) && !IOS && !ANDROID;
  var BIP = false;
  window.addEventListener('beforeinstallprompt', function (e) { BIP = true; try { e.preventDefault(); } catch (x) { /* fine */ } paintSetup(); });   /* wave219 keeps the event; data-w219="install" fires it */
  window.addEventListener('appinstalled', function () { lsSet(KEY_APP, '1'); BIP = false; paintSetup(); closeTip(); });
  function standalone() { try { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; } catch (e) { return false; } }
  function appDone() { return standalone() || lsGet(KEY_APP) === '1'; }
  function push() { try { return window.__wa219 && window.__wa219.state ? window.__wa219.state() : null; } catch (e) { return null; } }
  function pushRelevant() { return staff(); }
  function pushDone() { var s = push(); return !!(s && s.mine); }
  function allDone() {
    if (FIREFOX) return !pushRelevant() || pushDone();
    return appDone() && (!pushRelevant() || pushDone());
  }
  var setupCss = ''
    + '#w272setup{background:rgba(220,165,39,.12);border:1px solid rgba(220,165,39,.5);border-radius:20px;padding:14px 18px;box-sizing:border-box;font-family:' + BODY + ';color:' + INK + ';}'
    + '#w272setup .hd{display:flex;align-items:center;justify-content:space-between;gap:10px;}'
    + '#w272setup h3{margin:0;font:500 24px/1.1 ' + HEAD + ';text-transform:uppercase;color:' + GREEN + ';}'
    + '#w272setup .why{margin:2px 0 4px;font-size:14px;color:rgba(31,32,30,.72);}'
    + '#w272setup .lnk{border:0;background:none;color:' + GREEN + ';font:500 14px ' + BODY + ';text-decoration:underline;text-underline-offset:3px;cursor:pointer;min-height:36px;padding:0 4px;flex:none;}'
    + '#w272setup .rw{display:flex;align-items:center;gap:12px;min-height:56px;padding:8px 0;border-top:1px solid rgba(16,63,57,.12);flex-wrap:wrap;}'
    + '#w272setup .mk{flex:none;width:26px;height:26px;border-radius:50%;box-shadow:inset 0 0 0 1.75px rgba(31,32,30,.5);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:' + GREEN + ';}'
    + '#w272setup .rw.ok .mk{background:' + GREEN + ';color:' + CREAM + ';box-shadow:none;}'
    + '#w272setup .tt{flex:1 1 200px;min-width:0;}'
    + '#w272setup .tt b{display:block;font-weight:500;font-size:15.5px;line-height:1.3;}'
    + '#w272setup .tt small{display:block;font-size:13px;line-height:1.35;color:rgba(31,32,30,.72);margin-top:1px;}'
    + '#w272setup .go,#w272tip .go{flex:none;min-height:40px;padding:0 16px;border:0;border-radius:11px;background:' + GOLD + ';color:' + GREEN + ';font:600 16px/1 ' + HEAD + ';letter-spacing:.5px;text-transform:uppercase;cursor:pointer;transition:transform 120ms cubic-bezier(.23,1,.32,1);}'
    + '#w272setup .go:active,#w272tip .go:active{transform:scale(.97);}'
    + '#w272setup .go[disabled]{opacity:.6;cursor:default;}'
    + '#w272restore{border:1px solid rgba(16,63,57,.25);background:' + CREAM + ';color:' + GREEN + ';border-radius:999px;padding:5px 14px;font:700 12.5px ' + BODY + ';cursor:pointer;}'
    /* the small note in the corner: no scrim, takes no focus, and everything behind it keeps working */
    + '#w272tip{position:fixed;z-index:9000;right:20px;bottom:96px;width:320px;max-width:calc(100vw - 32px);box-sizing:border-box;padding:16px 18px;border-radius:18px;background:' + CREAM + ';color:' + INK + ';font-family:' + BODY + ';box-shadow:0 12px 40px rgba(16,24,22,.24);transform:translateY(calc(100% + 28px));opacity:0;transition:transform 300ms cubic-bezier(.23,1,.32,1),opacity 200ms ease;}'
    + '#w272tip.on{transform:none;opacity:1;}'
    + '#w272tip b{display:block;font:500 22px/1.05 ' + HEAD + ';text-transform:uppercase;color:' + GREEN + ';}'
    + '#w272tip p{margin:5px 0 12px;font-size:14px;line-height:1.4;}'
    + '#w272tip .acts{display:flex;align-items:center;gap:6px;}'
    + '#w272tip .no{border:0;background:none;color:' + GREEN + ';font:500 14px ' + BODY + ';cursor:pointer;min-height:40px;padding:0 10px;}'
    /* the how-to window */
    + '#w272back{position:fixed;inset:0;z-index:99970;background:rgba(16,24,22,.45);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;}'
    + '#w272sheet{width:min(460px,100%);max-height:100%;overflow-y:auto;overscroll-behavior:contain;background:' + CREAM + ';border-radius:22px;padding:16px 18px 20px;box-sizing:border-box;font-family:' + BODY + ';color:' + INK + ';box-shadow:0 18px 50px rgba(0,0,0,.3);}'
    + '#w272sheet .top{display:flex;align-items:center;justify-content:space-between;gap:10px;}'
    + '#w272sheet h2{margin:0;font:500 28px/1.05 ' + HEAD + ';text-transform:uppercase;color:' + GREEN + ';}'
    + '#w272sheet .x{flex:none;width:38px;height:38px;border:0;border-radius:50%;background:rgba(16,63,57,.1);color:' + GREEN + ';font-size:20px;line-height:1;cursor:pointer;}'
    + '#w272sheet .seg{display:flex;gap:2px;background:rgba(16,63,57,.09);border-radius:12px;padding:3px;margin:12px 0 14px;}'
    + '#w272sheet .seg button{flex:1;min-height:38px;border:0;border-radius:9px;background:none;font:500 14px ' + BODY + ';color:' + GREEN + ';cursor:pointer;}'
    + '#w272sheet .seg button[aria-pressed="true"]{background:' + GREEN + ';color:' + CREAM + ';}'
    + '#w272sheet button:focus-visible{outline:2px solid ' + GOLD + ';outline-offset:2px;}'
    + '#w272sheet h3{margin:14px 0 2px;font-size:15px;font-weight:700;color:' + GREEN + ';}'
    + '#w272sheet p{margin:0 0 6px;font-size:14.5px;line-height:1.45;}'
    + '#w272sheet .ft{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid rgba(16,63,57,.12);}'
    + '#w272sheet .addr{font-weight:500;user-select:all;}'
    + '#w272sheet .dn{min-height:40px;padding:0 16px;border:0;border-radius:11px;background:rgba(16,63,57,.1);color:' + GREEN + ';font:500 14px ' + BODY + ';cursor:pointer;}'
    + '@media (max-width:900px){#w272tip{left:16px;right:16px;width:auto;bottom:calc(84px + env(safe-area-inset-bottom,0px));}#w272back{padding:0;align-items:flex-end;}#w272sheet{width:100%;max-height:92%;border-radius:22px 22px 0 0;}}'
    + '@media (prefers-reduced-motion:reduce){#w272tip{transform:none;transition:opacity 160ms ease;}#w272setup .go,#w272tip .go{transition:none;}#w272setup .go:active,#w272tip .go:active{transform:none;}}';

  function appRow() {
    if (FIREFOX) return '';
    var done = appDone(), sub, act = '';
    if (standalone()) sub = 'You are using the Hub app.';
    else if (done) sub = 'Added. Open it from its icon.';
    else if (IOS) sub = 'Its own icon on your Home Screen. It takes under a minute.';
    else if (ANDROID) sub = 'Its own icon on your phone. It takes under a minute.';
    else sub = 'Its own window and icon on this computer, and on your phone too.';
    if (!done) act = BIP ? '<button type="button" class="go" data-w219="install" data-w272s="again">Install</button>' : '<button type="button" class="go" data-w272s="how">Show me how</button>';
    return '<div class="rw' + (done ? ' ok' : '') + '"><span class="mk" aria-hidden="true">' + (done ? '&#10003;' : '1') + '</span><div class="tt"><b>Add the Hub as an app</b><small>' + E(sub) + '</small></div>' + act
      + (!done && BIP ? '<button type="button" class="lnk" data-w272s="how">On your phone</button>' : '') + '</div>';
  }
  function pushRow() {
    if (!pushRelevant()) return '';
    var s = push(), done = !!(s && s.mine), sub, act = '';
    var waitIos = IOS && !standalone();
    if (done) sub = 'On for this device. You choose what reaches you in Settings, Notifications.';
    else if (waitIos) sub = 'Add the Hub first, then open it from its icon and turn these on there. Apple only allows them in the app.';
    else if (s && s.perm === 'denied') sub = 'This browser is blocking them. Settings, Notifications shows how to allow them.';
    else if (s && !s.supported) sub = 'This browser cannot show Hub notifications. Chrome, Edge, Firefox and Safari can.';
    else { sub = 'When someone mentions you, gives you work or posts an announcement for you.'; act = '<button type="button" class="go" data-w219="on" data-w272s="again"' + (s && s.key ? '' : ' disabled') + '>Turn on</button>'; }
    return '<div class="rw' + (done ? ' ok' : '') + '"><span class="mk" aria-hidden="true">' + (done ? '&#10003;' : (FIREFOX ? '1' : '2')) + '</span><div class="tt"><b>Turn on notifications</b><small>' + E(sub) + '</small></div>' + act + '</div>';
  }
  var S = { shown: false, finished: false };
  function paintSetup() {
    var body = document.getElementById('mpBody'), el = document.getElementById('w272setup');
    var page = document.getElementById('mypage');
    var hide = lsGet(KEY_HIDE) === 'hide', done = allDone(), ready = staff() ? !!(push() && push().checked) : board();
    /* the app's only home on a person's list: wave112's Get started step ticks itself */
    if (appDone()) { try { if (window.w112Api && window.w112Api.loaded && window.w112Api.loaded()) window.w112Api.set('app', true); } catch (e) { /* fine */ } }
    var restore = document.getElementById('w272restore'), bar = document.getElementById('w262homebar');
    if (hide && !done && bar) { if (!restore || restore.parentNode !== bar) { restore = document.createElement('button'); restore.type = 'button'; restore.id = 'w272restore'; restore.textContent = 'Set up your Hub'; restore.setAttribute('data-w272s', 'show'); bar.appendChild(restore); } }
    else if (restore) restore.remove();
    if (!body || !page || hide || done || !ready) {
      if (el) el.remove();
      if (S.shown && done && !hide) { S.shown = false; say('Your Hub is set up.'); }
      return;
    }
    if (!el || el.parentNode !== body) { el = document.createElement('section'); el.id = 'w272setup'; el.setAttribute('aria-label', 'Set up your Hub'); body.appendChild(el); }
    S.shown = true;
    /* classic look: where the older order applies, it sits under the greeting */
    if (!page.classList.contains('w272')) { var h = body.querySelector(':scope > .mp-online') || body.querySelector(':scope > .mp-head'); if (h && h.nextElementSibling !== el) h.insertAdjacentElement('afterend', el); }
    var html = '<div class="hd"><h3>Set up your Hub</h3><button type="button" class="lnk" data-w272s="hide">Not now</button></div><p class="why">Optional, and quick. It keeps the Hub one tap away.</p>' + appRow() + pushRow();
    if (el.__h !== html) { el.innerHTML = html; el.__h = html; }
  }
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-w272s]'); if (!b) return;
    var k = b.getAttribute('data-w272s');
    if (k === 'how') { closeTip(); openHow(b); return; }
    if (k === 'hide') { lsSet(KEY_HIDE, 'hide'); paintSetup(); say('It waits under Show everything on Home.'); return; }
    if (k === 'show') { lsSet(KEY_HIDE, null); paintSetup(); return; }
    if (k === 'again') { [800, 3000, 8000].forEach(function (ms) { setTimeout(paintSetup, ms); }); closeTip(); return; }
  });

  /* ---------- the how-to window ---------- */
  var H = { from: null, film: null };
  function compHtml() {
    return (BIP ? '<p><button type="button" class="dn" data-w219="install" data-w272s="again">Install the Hub on this computer</button></p>' : '')
      + '<h3>In Chrome</h3><p>At the top right, choose More (⋮), then Cast, save, and share, then Install page as app. You may also see Install at the right of the address bar.</p>'
      + '<h3>In Edge</h3><p>Choose Settings and more (···), then Apps, then Install this site as an app.</p>'
      + '<h3>In Safari on a Mac</h3><p>From the menu bar, choose File, then Add to Dock.</p>'
      + '<h3>In Firefox</h3><p>Firefox does not add sites as apps on a computer. Notifications still work there.</p>';
  }
  function showTab(k) {
    var box = document.getElementById('w272how'), seg = document.querySelectorAll('#w272sheet .seg button');
    if (!box) return;
    if (H.film) { H.film.stop(); H.film = null; }
    seg.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-w272tab') === k)); });
    box.className = ''; box.innerHTML = '';
    if (k === 'computer') { box.innerHTML = compHtml(); return; }
    var host = document.createElement('div'); box.appendChild(host); H.film = window.w272howto(host, k);
  }
  function closeHow() {
    var bk = document.getElementById('w272back'); if (!bk) return;
    if (H.film) { H.film.stop(); H.film = null; }
    bk.remove(); document.removeEventListener('keydown', escHow, true);
    if (H.from && H.from.isConnected && H.from.focus) { try { H.from.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
  }
  function escHow(e) { if (e.key === 'Escape') { e.stopPropagation(); closeHow(); } }
  function openHow(from) {
    closeHow(); H.from = from || document.activeElement; hwStyle();
    var bk = document.createElement('div'); bk.id = 'w272back';
    bk.innerHTML = '<div id="w272sheet" role="dialog" aria-modal="true" aria-labelledby="w272howt"><div class="top"><h2 id="w272howt">Add the Hub as an app</h2><button type="button" class="x" aria-label="Close" data-w272h="close">&times;</button></div>'
      + '<div class="seg" role="group" aria-label="Your device"><button type="button" data-w272tab="iphone">iPhone</button><button type="button" data-w272tab="android">Android</button><button type="button" data-w272tab="computer">Computer</button></div>'
      + '<div id="w272how"></div>'
      + '<div class="ft"><span>On your phone, open <span class="addr">hub.welfareavenue.com</span></span><button type="button" class="dn" data-w272h="added">I added it</button></div></div>';
    document.body.appendChild(bk);
    bk.addEventListener('click', function (e) {
      if (e.target === bk) { closeHow(); return; }
      var t = e.target.closest && e.target.closest('[data-w272tab],[data-w272h]'); if (!t) return;
      if (t.hasAttribute('data-w272tab')) { showTab(t.getAttribute('data-w272tab')); return; }
      if (t.getAttribute('data-w272h') === 'added') { lsSet(KEY_APP, '1'); closeHow(); paintSetup(); say('Thanks. The Hub is on your list of apps.'); return; }
      closeHow();
    });
    document.addEventListener('keydown', escHow, true);
    showTab(IOS ? 'iphone' : ANDROID ? 'android' : 'computer');
    var x = bk.querySelector('.x'); if (x) x.focus({ preventScroll: true });
  }

  /* ---------- the small note ----------
     At most twice on a device, 14 days apart, only on Home, only when nothing else is open. No scrim and no focus taken. */
  var TIP = { timer: null, tries: 0 };
  function tipState() { var o = null; try { o = JSON.parse(lsGet(KEY_TIP) || 'null'); } catch (e) { o = null; } return o || { n: 0, at: 0 }; }
  function otherOpen() {
    if (!document.documentElement.classList.contains('wa-ready')) return true;
    if (document.getElementById('w272back') || document.getElementById('w213pop') || document.getElementById('w262new')) return true;
    var vis = function (el) { if (!el) return false; var c = getComputedStyle(el); return c.display !== 'none' && c.visibility !== 'hidden' && el.getBoundingClientRect().width > 0; };
    if (vis(document.getElementById('w238loop')) || vis(document.getElementById('w177pop')) || vis(document.getElementById('w227'))) return true;
    if (document.querySelector('.w122tp')) return true;
    return Array.prototype.some.call(document.querySelectorAll('[aria-modal="true"]'), vis);
  }
  function closeTip() { var t = document.getElementById('w272tip'); if (t) t.remove(); }
  function tryTip() {
    clearTimeout(TIP.timer);
    if (appDone() || FIREFOX || !(staff() || board()) || !onHome()) return;
    var st = tipState();
    if (st.n >= 2 || (st.at && Date.now() - st.at < 14 * 86400000) || document.getElementById('w272tip')) return;
    if (otherOpen()) { if (TIP.tries++ < 40) TIP.timer = setTimeout(tryTip, 5000); return; }
    lsSet(KEY_TIP, JSON.stringify({ n: st.n + 1, at: Date.now() }));
    var el = document.createElement('div'); el.id = 'w272tip'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Add the Hub as an app');
    var where = IOS || ANDROID ? 'on this phone' : 'on this computer';
    el.innerHTML = '<b>Keep the Hub one tap away</b><p>Add it as an app ' + where + ': its own icon, and notifications when someone needs you.</p><div class="acts">'
      + (BIP ? '<button type="button" class="go" data-w219="install" data-w272s="again">Install</button>' : '<button type="button" class="go" data-w272s="how">Show me how</button>')
      + '<button type="button" class="no" data-w272tip="no">Not now</button></div>';
    document.body.appendChild(el); void el.offsetWidth; el.classList.add('on');
  }
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-w272tip]'); if (!b) return;
    var t = document.getElementById('w272tip'); if (!t) return;
    t.classList.remove('on'); setTimeout(function () { t.remove(); }, 220);
  });
  window.addEventListener('hashchange', function () { if (!onHome()) closeTip(); });
