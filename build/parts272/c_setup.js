
  /* ---------- Set up your Hub: the app, the notifications, the policies ----------
     Steel (02/11/26): "people should have these up until the action is complete", so the card has no Not now: each row
     stays until it is done, and the card leaves on its own once every row is. One tap does the work wherever the browser
     allows it; where it does not, the row says exactly what is in the way and what to do. On an iPhone the two steps
     have an order (Apple only allows Hub notifications from the Home Screen app), so the second waits for the first.
     Policies: the required ones a person has not signed, each with Open and Sign; a signed policy never comes back here
     (the Policies card of wave105 stays hidden on Home; the training page keeps its own). */
  var KEY_APP = 'wa272.app', KEY_TIP = 'wa272.tip', KEY_OPENED = 'wa272.opened';
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
  var S = { shown: false, pushBusy: false, pushMsg: '', pushErr: '', pols: null, polsAt: 0, polBusy: {}, polsPending: 0 };
  function appRelevant() { return !FIREFOX; }
  function allDone() { return (!appRelevant() || appDone()) && (!pushRelevant() || pushDone()) && !S.polsPending; }

  var setupCss = ''
    + '#w272setup{background:rgba(220,165,39,.13);border-radius:18px;padding:16px 18px 6px;box-sizing:border-box;font-family:' + BODY + ';color:' + INK + ';display:grid;grid-template-rows:1fr;transition:grid-template-rows 280ms ' + OUT + ',opacity 200ms ease,padding 280ms ' + OUT + ',margin 280ms ' + OUT + ';}'
    + '#w272setup > div{min-height:0;overflow:hidden;}'
    + '#w272setup.w272bye{grid-template-rows:0fr;opacity:0;padding-top:0;padding-bottom:0;}'
    + '#w272setup .hd{display:flex;align-items:baseline;justify-content:space-between;gap:10px;}'
    + '#w272setup h3{margin:0;font:500 22px/1.05 ' + HEAD + ';letter-spacing:.01em;text-transform:uppercase;color:' + GREEN + ';}'
    + '#w272setup .prog{font-size:13px;color:' + MUTED + ';font-variant-numeric:tabular-nums;}'
    + '#w272setup .why{margin:2px 0 4px;font-size:14px;color:' + MUTED + ';}'
    + '#w272setup .rw{display:grid;grid-template-rows:1fr;transition:grid-template-rows 260ms ' + OUT + ',opacity 180ms ease;}'
    + '#w272setup .rw > div{min-height:0;overflow:hidden;}'
    + '#w272setup .rw.gone{grid-template-rows:0fr;opacity:0;}'
    + '#w272setup .in{display:flex;align-items:center;gap:12px;min-height:58px;padding:8px 0;border-top:1px solid rgba(16,63,57,.12);flex-wrap:wrap;}'
    + '#w272setup .mk{flex:none;width:26px;height:26px;border-radius:50%;box-shadow:inset 0 0 0 1.75px rgba(31,32,30,.45);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:' + GREEN + ';transition:background-color 160ms ease,box-shadow 160ms ease;}'
    + '#w272setup .mk svg{width:15px;height:15px;fill:none;stroke:' + CREAM + ';stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:22;stroke-dashoffset:22;transition:stroke-dashoffset 220ms ' + OUT + ' 60ms;}'
    + '#w272setup .mk i{font-style:normal;}'
    + '#w272setup .rw.ok .mk{background:' + GREEN + ';box-shadow:none;}' + '#w272setup .rw.ok .mk i{display:none;}' + '#w272setup .rw.ok .mk svg{stroke-dashoffset:0;}'
    + '#w272setup .tt{flex:1 1 220px;min-width:0;}'
    + '#w272setup .tt b{display:block;font-weight:500;font-size:15.5px;line-height:1.3;}'
    + '#w272setup .rw.ok .tt b{color:' + MUTED + ';}'
    + '#w272setup .tt small{display:block;font-size:13px;line-height:1.4;color:' + MUTED + ';margin-top:1px;}'
    + '#w272setup .tt small.err{color:#7a4a05;}'
    + '#w272setup .act{display:flex;gap:8px;align-items:center;flex:none;flex-wrap:wrap;}'
    + '#w272setup .go,#w272tip .go{min-height:40px;padding:0 16px;border:0;border-radius:11px;background:' + GOLD + ';color:' + GREEN + ';font:600 16px/1 ' + HEAD + ';letter-spacing:.04em;text-transform:uppercase;cursor:pointer;transition:transform 120ms ' + OUT + ',opacity 120ms ease;}'
    + '#w272setup .go:active,#w272tip .go:active{transform:scale(.97);}'
    + '#w272setup .go[disabled]{opacity:.55;cursor:default;}'
    + '#w272setup .lnk{border:0;background:none;color:' + GREEN + ';font:500 14px ' + BODY + ';text-decoration:underline;text-underline-offset:3px;cursor:pointer;min-height:36px;padding:0 4px;}'
    + '#w272setup a.lnk{display:inline-flex;align-items:center;}'
    /* the small note in the corner: no scrim, takes no focus, everything behind it keeps working */
    + '#w272tip{position:fixed;z-index:9000;right:20px;bottom:96px;width:320px;max-width:calc(100vw - 32px);box-sizing:border-box;padding:16px 18px;border-radius:18px;background:' + CREAM + ';color:' + INK + ';font-family:' + BODY + ';box-shadow:0 12px 40px rgba(16,24,22,.24);transform:translateY(calc(100% + 110px));opacity:0;transition:transform 300ms ' + OUT + ',opacity 200ms ease;}'
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
    + '@media (max-width:900px){#w272tip{left:16px;right:16px;width:auto;bottom:calc(84px + env(safe-area-inset-bottom,0px));}#w272back{padding:0;align-items:flex-end;}#w272sheet{width:100%;max-height:92%;border-radius:22px 22px 0 0;}#w272setup{padding:14px 16px 4px;}}'
    + '@media (prefers-reduced-motion:reduce){#w272tip{transform:none;transition:opacity 160ms ease;}#w272setup,#w272setup .rw,#w272setup .mk,#w272setup .mk svg{transition:none;}#w272setup .go:active,#w272tip .go:active{transform:none;}}';

  /* ---------- the policies to sign (the same tables as wave105) ---------- */
  function meEmail() { try { return String((USER && USER.email) || ''); } catch (e) { return ''; } }
  function meName() { try { return (typeof WA_ME !== 'undefined' && WA_ME && WA_ME.name) || (USER && USER.name) || ''; } catch (e) { return ''; } }
  function loadPolicies(force) {
    if (!staff() || !meEmail() || typeof db === 'undefined') { S.pols = []; S.polsPending = 0; return Promise.resolve([]); }
    if (!force && S.pols && Date.now() - S.polsAt < 60000) return Promise.resolve(S.pols);
    return Promise.all([
      db.from('wa_policies').select('key,title,url,sort').eq('active', true).eq('required', true).order('sort'),
      db.from('wa_policy_signoffs').select('policy_key').eq('email', meEmail())
    ]).then(function (r) {
      var signed = {}; (((r[1] || {}).data) || []).forEach(function (s) { signed[s.policy_key] = true; });
      S.pols = (((r[0] || {}).data) || []).filter(function (p) { return !signed[p.key]; });
      S.polsAt = Date.now(); S.polsPending = S.pols.length; return S.pols;
    }).catch(function () { S.pols = S.pols || []; S.polsPending = S.pols.length; return S.pols; });
  }
  function opened(key) { try { return (JSON.parse(sessionStorage.getItem(KEY_OPENED) || '[]')).indexOf(key) >= 0; } catch (e) { return false; } }
  function markOpened(key) { try { var a = JSON.parse(sessionStorage.getItem(KEY_OPENED) || '[]'); if (a.indexOf(key) < 0) a.push(key); sessionStorage.setItem(KEY_OPENED, JSON.stringify(a)); } catch (e) { /* fine */ } }
  async function signPolicy(key, btn) {
    if (S.polBusy[key]) return; S.polBusy[key] = true; if (btn) btn.disabled = true;
    try {
      var ins = await db.from('wa_policy_signoffs').insert({ email: meEmail(), name: meName(), policy_key: key });
      if (ins && ins.error) throw ins.error;
      say('Sign-off recorded, thank you');
      S.pols = (S.pols || []).filter(function (p) { return p.key !== key; }); S.polsPending = S.pols.length;
    } catch (e) { say('Could not record the sign-off'); }
    S.polBusy[key] = false; paintSetup();
  }

  /* ---------- the rows ---------- */
  function rowApp() {
    if (!appRelevant()) return null;
    var done = appDone(), sub, act = '';
    if (standalone()) sub = 'You are using the Hub app.';
    else if (done) sub = 'Added. Open it from its icon.';
    else if (IOS) sub = 'Its own icon on your Home Screen. Under a minute.';
    else if (ANDROID) sub = 'Its own icon on your phone. Under a minute.';
    else sub = 'Its own window and icon on this computer, and on your phone too.';
    if (!done) act = (BIP ? '<button type="button" class="go" data-w219="install" data-w272s="again">Install</button><button type="button" class="lnk" data-w272s="how">On your phone</button>' : '<button type="button" class="go" data-w272s="how">Show me how</button>');
    return { k: 'app', ok: done, n: '1', t: 'Add the Hub as an app', s: sub, act: act };
  }
  function rowPush(n) {
    if (!pushRelevant()) return null;
    var s = push(), done = !!(s && s.mine), sub, act = '', err = false;
    var waitIos = IOS && !standalone();
    if (done) sub = 'On for this device. Settings, Notifications chooses what reaches you.';
    else if (S.pushBusy) sub = S.pushMsg || 'Asking your browser…';
    else if (waitIos) sub = 'Add the Hub first, then open it from its icon and turn these on there. Apple only allows them in the app.';
    else if (s && !s.supported) sub = 'This browser cannot show Hub notifications. Chrome, Edge, Firefox and Safari can.';
    else if (s && s.perm === 'denied') { sub = blockedText(); err = true; act = '<button type="button" class="go" data-w272s="recheck">Check again</button>'; }
    else if (S.pushErr) { sub = S.pushErr; err = true; act = '<button type="button" class="go" data-w272s="push">Try again</button>'; }
    else { sub = 'When someone mentions you, gives you work or posts an announcement for you.'; act = '<button type="button" class="go" data-w272s="push">Turn on</button>'; }
    return { k: 'push', ok: done, n: String(n), t: 'Turn on notifications', s: sub, err: err, act: act };
  }
  function blockedText() {
    if (IOS) return 'Notifications are blocked for the Hub app. In the ' + (IPAD ? 'iPad' : 'iPhone') + '’s Settings, open Notifications, then WA Hub, and allow them. Then come back here.';
    if (standalone()) return 'Notifications are blocked for the Hub app. Open the app’s menu at the top (⋮), choose App info or Settings, allow Notifications, then come back here.';
    return 'Notifications are blocked for the Hub in this browser. Click the icon at the left of the address bar (a lock or two sliders), set Notifications to Allow, then come back here.';
  }
  function rowsPolicies(n0) {
    return (S.pols || []).map(function (p, i) {
      var canSign = opened(p.key), busy = !!S.polBusy[p.key];
      return { k: 'pol:' + p.key, ok: false, n: String(n0 + i), t: 'Read and sign: ' + p.title, s: canSign ? 'Read it? Then sign here. HR keeps the date.' : 'Open it, read it, then sign here. HR keeps the date.',
        act: '<a class="lnk" href="' + E(p.url) + '" target="_blank" rel="noopener" data-w272pol="open" data-key="' + E(p.key) + '">Open</a><button type="button" class="go" data-w272pol="sign" data-key="' + E(p.key) + '"' + (canSign && !busy ? '' : ' disabled') + '>' + (busy ? 'Saving…' : 'Sign') + '</button>' };
    });
  }
  function rowHtml(r) {
    return '<div><div class="in"><span class="mk" aria-hidden="true"><i>' + r.n + '</i><svg viewBox="0 0 24 24"><path d="M5 12.5 10 17.5 19 7"/></svg></span><div class="tt"><b>' + E(r.t) + '</b><small' + (r.err ? ' class="err"' : '') + '>' + E(r.s) + '</small></div>' + (r.act && !r.ok ? '<div class="act">' + r.act + '</div>' : '') + '</div></div>';
  }
  function paintSetup() {
    var body = document.getElementById('mpBody'), el = document.getElementById('w272setup'), page = document.getElementById('mypage');
    var ready = staff() ? !!(push() && push().checked) : board();
    if (appDone()) { try { if (window.w112Api && window.w112Api.loaded && window.w112Api.loaded()) window.w112Api.set('app', true); } catch (e) { /* fine */ } }
    if (staff() && S.pols === null && !S.polsLoading) { S.polsLoading = true; loadPolicies(false).then(function () { S.polsLoading = false; paintSetup(); }); }
    var done = allDone();
    if (!body || !page || !ready || (done && !el)) { if (el && !done) el.remove(); return; }
    if (done) {
      /* every row done: the card says so once, then leaves */
      if (el.classList.contains('w272bye')) return;
      el.classList.add('w272bye'); el.setAttribute('aria-hidden', 'true');
      setTimeout(function () { var x = document.getElementById('w272setup'); if (x && x.classList.contains('w272bye')) x.remove(); }, 320);
      if (S.shown) { S.shown = false; say('Your Hub is set up.'); }
      return;
    }
    if (!el || el.parentNode !== body) { el = document.createElement('section'); el.id = 'w272setup'; el.setAttribute('aria-label', 'Set up your Hub'); el.innerHTML = '<div><div class="hd"><h3>Set up your Hub</h3><span class="prog"></span></div><p class="why"></p><div class="rows"></div></div>'; body.appendChild(el); }
    el.classList.remove('w272bye'); el.removeAttribute('aria-hidden'); S.shown = true;
    if (!page.classList.contains('w272')) { var h = body.querySelector(':scope > .mp-online') || body.querySelector(':scope > .mp-head'); if (h && h.nextElementSibling !== el) h.insertAdjacentElement('afterend', el); }
    var rows = [], a = rowApp(); if (a) rows.push(a);
    var p = rowPush(rows.length + 1); if (p) rows.push(p);
    rows = rows.concat(rowsPolicies(rows.length + 1));
    var doneN = rows.filter(function (r) { return r.ok; }).length;
    el.querySelector('.prog').textContent = doneN + ' of ' + rows.length + ' done';
    el.querySelector('.why').textContent = board() ? 'Quick, and it keeps the Hub one tap away.' : 'Quick. It keeps the Hub one tap away, and finishes your onboarding.';
    /* rows are kept in place, so a tick draws and a finished row closes instead of the card redrawing */
    var host = el.querySelector('.rows'), keep = {};
    rows.forEach(function (r, i) {
      keep[r.k] = 1;
      var rw = host.querySelector('.rw[data-k="' + r.k + '"]');
      if (!rw) { rw = document.createElement('div'); rw.className = 'rw'; rw.setAttribute('data-k', r.k); rw.innerHTML = rowHtml(r); host.insertBefore(rw, host.children[i] || null); rw.__h = rw.innerHTML; }
      else {
        if (host.children[i] !== rw) host.insertBefore(rw, host.children[i] || null);
        var html = rowHtml(r);
        if (rw.__h !== html) {
          var inner = rw.querySelector('.in'), tt = inner.querySelector('.tt'), act = inner.querySelector('.act');
          inner.querySelector('.mk i').textContent = r.n; tt.querySelector('b').textContent = r.t;
          var sm = tt.querySelector('small'); sm.textContent = r.s; sm.className = r.err ? 'err' : '';
          var want = r.act && !r.ok ? '<div class="act">' + r.act + '</div>' : '';
          if ((act ? act.outerHTML : '') !== want) { if (act) act.remove(); if (want) inner.insertAdjacentHTML('beforeend', want); }
          rw.__h = html;
        }
      }
      rw.classList.toggle('ok', !!r.ok); rw.classList.remove('gone');
    });
    Array.prototype.forEach.call(host.querySelectorAll('.rw'), function (rw) {
      if (keep[rw.getAttribute('data-k')]) return;
      if (rw.classList.contains('gone')) return;
      rw.classList.add('ok'); setTimeout(function () { rw.classList.add('gone'); }, 420); setTimeout(function () { rw.remove(); }, 720);
    });
  }

  /* ---------- notifications: one tap, and the result said in the row ----------
     Steel (02/11/26) got 'This browser did not start the Hub's notification helper': wave219 waits ten seconds for the
     service worker and says only that. Here the helper is checked first: the browser's own refusal, or the worker's state,
     goes in the row, with what to do about it. When the permission still has to be asked, wave219 goes first, straight
     from the tap (Safari only allows the question there), and the helper is looked at only if that fails. */
  function waitActive(reg, ms) {
    return new Promise(function (res) {
      if (reg.active) return res(reg.active);
      var done = false, t = setTimeout(function () { if (!done) { done = true; res(null); } }, ms);
      function check() { if (reg.active && !done) { done = true; clearTimeout(t); res(reg.active); } }
      var sw = reg.installing || reg.waiting; if (sw) sw.addEventListener('statechange', check);
      reg.addEventListener('updatefound', function () { var n = reg.installing; if (n) n.addEventListener('statechange', check); });
    });
  }
  async function helper() {
    if (!('serviceWorker' in navigator)) return { ok: false, why: 'This browser has no notification helper (no service workers), so Hub notifications cannot work here.' };
    var reg = null, err = '';
    try { reg = await navigator.serviceWorker.getRegistration('/'); } catch (e) { /* fine */ }
    if (!reg) { try { reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' }); } catch (e) { err = String((e && e.message) || e || 'no reason given'); } }
    if (!reg) {
      var store = /storage|cookie|insecure|invalid state|security|denied/i.test(err);
      return { ok: false, why: 'Your browser refused the Hub’s notification helper (' + err.replace(/^Failed to register a ServiceWorker[^:]*:s*/i, '').slice(0, 160) + ').' + (store ? ' Allow cookies and site data for hub.welfareavenue.com in the browser’s site settings, then reload the Hub.' : ' Reload the Hub and try again.') };
    }
    var act = await waitActive(reg, 10000);
    if (!act) { var st = reg.installing ? 'still installing' : reg.waiting ? 'waiting to start' : 'not running'; return { ok: false, why: 'The Hub’s notification helper is ' + st + ' after ten seconds. Close every Hub window, open the Hub again and try once more.' }; }
    return { ok: true };
  }
  async function turnOnPush() {
    var A = window.__wa219;
    if (!A || !A.turnOn) { S.pushErr = 'The Hub is still loading. Try again in a moment.'; paintSetup(); return; }
    if (S.pushBusy) return;
    S.pushBusy = true; S.pushErr = ''; S.pushMsg = 'Asking your browser…'; paintSetup();
    var st0 = push() || {};
    if (st0.perm === 'granted') {
      S.pushMsg = 'Starting the notification helper…'; paintSetup();
      var h0 = await helper();
      if (!h0.ok) { S.pushBusy = false; S.pushMsg = ''; S.pushErr = h0.why; paintSetup(); return; }
      S.pushMsg = 'Saving this device…'; paintSetup();
    }
    var slow = setTimeout(function () { S.pushMsg = 'Still working. If nothing happens, reload the Hub and try again.'; paintSetup(); }, 12000);
    /* wave219 says what went wrong in a toast; here it goes in the row instead */
    var said = '', t0 = window.toast, had = typeof t0 === 'function';
    if (had) window.toast = function (m) { said = String(m || ''); };
    var ok = false;
    try { ok = await A.turnOn(); } catch (e) { ok = false; said = said || String((e && e.message) || e || ''); }
    if (had) window.toast = t0;
    clearTimeout(slow); S.pushBusy = false; S.pushMsg = '';
    if (ok) { S.pushErr = ''; say('Hub notifications are on for this device.'); }
    else {
      var st = push() || {};
      S.pushErr = st.perm === 'denied' ? '' : (said && !/^Hub notifications are on/.test(said) ? said : 'That did not work. Try again, or reload the Hub and try once more.');
      /* wave219's one-line answer about the helper: look at the helper and say what is really the matter */
      if (/notification helper/.test(S.pushErr)) { try { var h1 = await helper(); if (!h1.ok) S.pushErr = h1.why; } catch (e) { /* keep */ } }
    }
    paintSetup();
  }
  async function recheck() {
    var A = window.__wa219; if (!A || !A.check) return;
    S.pushErr = ''; S.pushMsg = 'Checking…'; S.pushBusy = true; paintSetup();
    try { await A.check(); } catch (e) { /* fine */ }
    S.pushBusy = false; S.pushMsg = ''; paintSetup();
  }
  document.addEventListener('visibilitychange', function () {
    /* back from the browser's settings or the phone's: look again */
    if (document.visibilityState === 'visible' && document.getElementById('w272setup') && !S.pushBusy) { var A = window.__wa219; if (A && A.check) { Promise.resolve(A.check()).then(paintSetup, paintSetup); } }
  });
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-w272s],[data-w272pol]'); if (!b) return;
    var k = b.getAttribute('data-w272s'), pk = b.getAttribute('data-w272pol'), key = b.getAttribute('data-key');
    if (pk === 'open') { markOpened(key); setTimeout(paintSetup, 300); return; }   /* the link opens in a new tab on its own */
    if (pk === 'sign') { signPolicy(key, b); return; }
    if (k === 'how') { closeTip(); openHow(b); return; }
    if (k === 'push') { turnOnPush(); return; }
    if (k === 'recheck') { recheck(); return; }
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
     Anywhere in the Hub but Home (Home has the card), at most twice on a device and 14 days apart, only when nothing else
     is open. No scrim and no focus taken. */
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
    if (appDone() || !appRelevant() || !(staff() || board())) return;
    if (onHome()) { if (TIP.tries++ < 40) TIP.timer = setTimeout(tryTip, 20000); return; }
    var st = tipState();
    if (st.n >= 2 || (st.at && Date.now() - st.at < 14 * 86400000) || document.getElementById('w272tip')) return;
    if (otherOpen()) { if (TIP.tries++ < 40) TIP.timer = setTimeout(tryTip, 5000); return; }
    var el = document.createElement('div'); el.id = 'w272tip'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Add the Hub as an app');
    var where = IOS || ANDROID ? 'on this phone' : 'on this computer';
    el.innerHTML = '<b>Keep the Hub one tap away</b><p>Add it as an app ' + where + ': its own icon, and notifications when someone needs you.</p><div class="acts">'
      + (BIP ? '<button type="button" class="go" data-w219="install" data-w272s="again">Install</button>' : '<button type="button" class="go" data-w272s="how">Show me how</button>')
      + '<button type="button" class="no" data-w272tip="no">Not now</button></div>';
    document.body.appendChild(el);
    /* never over a button someone could want (another session saw it cover one on the serving page): if anything you can
       press sits under its corner, wait and look again */
    if (coversControl(el)) { el.remove(); if (TIP.tries++ < 40) TIP.timer = setTimeout(tryTip, 20000); return; }
    lsSet(KEY_TIP, JSON.stringify({ n: st.n + 1, at: Date.now() }));
    void el.offsetWidth; el.classList.add('on'); TIP.at = Date.now();
    /* it leaves on its own: after the first press anywhere else, or after 20 seconds */
    clearTimeout(TIP.gone); TIP.gone = setTimeout(hideTip, 20000);
  }
  function coversControl(el) {
    try {
      var r = el.getBoundingClientRect(), pts = [[r.left + 8, r.top + 8], [r.right - 8, r.top + 8], [r.left + 8, r.bottom - 8], [r.right - 8, r.bottom - 8], [(r.left + r.right) / 2, (r.top + r.bottom) / 2]];
      return pts.some(function (p) {
        return document.elementsFromPoint(p[0], p[1]).some(function (x) { return x !== el && !el.contains(x) && x.closest && !x.closest('#w272tip') && x.matches('button, a, input, select, textarea, [role=button], [tabindex]') && getComputedStyle(x).visibility !== 'hidden'; });
      });
    } catch (e) { return false; }
  }
  function hideTip() { var t = document.getElementById('w272tip'); if (!t) return; t.classList.remove('on'); setTimeout(function () { t.remove(); }, 220); }
  document.addEventListener('pointerdown', function (e) {
    var t = document.getElementById('w272tip'); if (!t || t.contains(e.target)) return;
    if (Date.now() - (TIP.at || 0) > 800) hideTip();
  }, true);
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-w272tip]'); if (!b) return;
    hideTip();
  });
  window.addEventListener('hashchange', function () { if (onHome()) closeTip(); });
