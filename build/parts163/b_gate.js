
  /* ---------- the menu stays out of sight until it is whole ---------- */
  var css = ''
    + 'html:not(.w163nav) nav.wa-nav > *:not(.w114brand){visibility:hidden !important;}'
    + 'nav.wa-nav #tabBar,nav.wa-nav #w153rail,nav.wa-nav #w153dock{transition:opacity .18s ease;}'
    + 'html:not(.w163nav) nav.wa-nav #tabBar,html:not(.w163nav) nav.wa-nav #w153rail,html:not(.w163nav) nav.wa-nav #w153dock{opacity:0;}'
    + '@media (prefers-reduced-motion: reduce){nav.wa-nav #tabBar,nav.wa-nav #w153rail,nav.wa-nav #w153dock{transition:none !important;}}';
  if (!document.getElementById('wa163css')) { var st = document.createElement('style'); st.id = 'wa163css'; st.textContent = css; document.head.appendChild(st); }

  function markReady(why) {
    if (G.ready) return;
    G.ready = true; G.why = why; G.at = Math.round((function () { try { return performance.now(); } catch (e) { return Date.now(); } })() - G.t0);
    try { document.documentElement.classList.add('w163nav'); } catch (e) { /* fine */ }
    try { document.dispatchEvent(new CustomEvent('wa163nav', { detail: { why: why } })); } catch (e) { /* fine */ }
    /* from now on, count what still moves (the tests read it; nothing should) */
    try {
      var bar = document.getElementById('tabBar');
      var moved = function (n) { return n && n.nodeType === 1 && n.classList && (n.classList.contains('tab') || n.classList.contains('tab-group') || n.classList.contains('w42d')); };
      if (bar) new MutationObserver(function (list) { list.forEach(function (m) { if (m.type !== 'childList') return; if (Array.prototype.some.call(m.addedNodes, moved) || Array.prototype.some.call(m.removedNodes, moved)) G.after++; }); }).observe(bar, { childList: true, subtree: true });   /* a page moving in or out (a count badge is not a move) */
    } catch (e) { /* fine */ }
  }
  /* the last wave has run: apply the layout one final time, then show the menu once it has been still for a moment */
  function settle(why) {
    if (G.ready || G.settling) return;
    G.settling = true;
    try { if (window.WA_NAV && WA_NAV.applyLayout) WA_NAV.applyLayout(); } catch (e) { /* fine */ }
    var bar = document.getElementById('tabBar');
    if (!bar) { markReady(why + ', no menu'); return; }
    var now = function () { try { return performance.now(); } catch (e) { return Date.now(); } };
    var start = now(), last = now();
    var mo = new MutationObserver(function () { last = now(); });
    try { mo.observe(bar, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] }); } catch (e) { /* fine */ }
    (function check() {
      if (G.ready) { mo.disconnect(); return; }
      if (now() - last >= 140 || now() - start > 2500) { mo.disconnect(); markReady(why); return; }
      setTimeout(check, 40);
    })();
  }
  if (typeof startApp === 'function') {
    var __sa163 = startApp;
    startApp = async function () {
      /* directors (the board view) open no apps: wave153 leaves Partners in their menu (wave134 puts it in Organization) */
      try { if (typeof MODE !== 'undefined' && MODE === 'board') document.documentElement.classList.add('w163dir'); } catch (e) { /* fine */ }
      try { return await __sa163.apply(this, arguments); }
      finally { try { settle('the Hub started'); } catch (e) { markReady('the Hub started (settle failed)'); } }
    };
  }
  /* if the Hub never finishes starting (a request that hangs), the menu shows anyway */
  setTimeout(function () { markReady('failsafe'); }, 20000);
