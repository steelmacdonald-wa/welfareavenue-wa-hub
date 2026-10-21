
  /* ---------- wiring ---------- */
  if (!document.getElementById('wa262css')) {
    var st = document.createElement('style'); st.id = 'wa262css'; st.textContent = homeCss + newCss + navCss; document.head.appendChild(st);
  }
  registerTour();
  if (typeof startApp === 'function') {
    var __sa262 = startApp;
    startApp = async function () {
      var r = await __sa262.apply(this, arguments);
      try { registerTour(); applyHome(); navWire(); } catch (e) { console.warn('wave262 boot', e); }
      N.timer = setTimeout(tryNew, 2500);
      return r;
    };
  }
  window.addEventListener('hashchange', function () {
    /* the pop-up belongs to Home: leaving Home puts it away (unseen), so it comes back on Home */
    if (!onHome() && document.getElementById('w262new')) { var el = document.getElementById('w262new'); el.remove(); document.removeEventListener('keydown', escNew, true); N.shown = false; }
    if (onHome()) { try { applyHome(); } catch (e) { /* fine */ } if (!N.shown && !seen()) { N.tries = Math.min(N.tries, 150); clearTimeout(N.timer); N.timer = setTimeout(tryNew, 1200); } } });

  /* ---------- test hook ---------- */
  window.w262 = { nav: navMatches, navWire: navWire, home: applyHome, homeAll: homeAll, show: showNew, close: closeNew, tryNew: tryNew, seen: seen, summary: summary, steps: tourSteps, state: function () { return N; } };
})();
