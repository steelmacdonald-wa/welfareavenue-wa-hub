
  /* ---------- wiring ---------- */
  /* one pass after the page changes (the body observer above calls it, debounced): the Watch here buttons, the plan sheet's
     help and counts, and a finished Academy module (its celebration shows) brings the plan, the Academy and Home up to date */
  var celSeen = false;
  function afterDom() {
    try { upgrade(document); } catch (e) { /* fine */ }
    try { if (document.querySelector('#w122sheet .onbwrap:not([data-w166])')) decoratePlan(); } catch (e) { /* fine */ }
    try {
      var cel = !!document.getElementById('w122cel');
      if (cel && !celSeen) { celSeen = true; afterComplete(); } else if (!cel) celSeen = false;
    } catch (e) { /* fine */ }
  }
  /* a module or an avenue was finished: the database has ticked the plan's steps that go with it (trg_wa166_tp_onb) */
  var acQ = null;
  function afterComplete() {
    if (acQ) return acQ;
    acQ = (async function () {
      try { if (typeof wa37Load === 'function') await wa37Load(true); } catch (e) { /* offline */ }
      try { var st = window.w122 && window.w122.state ? window.w122.state() : null; if (st && st.R && st.R.mode === 'onb') replan(); } catch (e) { /* fine */ }
      try { if (window.w122 && typeof window.w122.paint === 'function') window.w122.paint(); } catch (e) { /* fine */ }
      try { if (document.getElementById('w166lead')) await refresh(true); } catch (e) { /* fine */ }
      acQ = null;
    })();
    return acQ;
  }

  /* Home: the leads' card after every render of Home (cached for a minute; ticks and help refresh it at once) */
  if (typeof renderMyPage === 'function') {
    var __rm166 = renderMyPage;
    renderMyPage = async function () {
      var r = await __rm166.apply(this, arguments);
      try { paint(); refresh(false); } catch (e) { /* non-fatal */ }
      return r;
    };
  }
  try {
    if (typeof db !== 'undefined' && db && db.auth) db.auth.onAuthStateChange(function (evt) {
      if (evt === 'SIGNED_OUT') { S.lead = null; S.at = 0; S.open = {}; var el = document.getElementById('w166lead'); if (el) el.remove(); }
    });
  } catch (e) { /* fine */ }

  /* ---------- the tours: a stop for the leads' card on Home; the Academy's onboarding stop says how Academy steps work ---------- */
  function addTour() {
    try {
      var TT = window.w122 && window.w122.tours; if (!TT) return;
      var hs = TT.home && TT.home.steps;
      if (hs && !hs.some(function (x) { return x.s === '#w166lead'; })) {
        var i = -1; hs.forEach(function (x, k) { if (x.s === '#w112wrap') i = k; });
        hs.splice(i >= 0 ? i + 1 : Math.min(2, hs.length), 0, { s: '#w166lead', t: 'Your people’s onboarding',
          p: 'Leads see each person they are onboarding: how far they are, what is late, their help requests, and the moments that are yours (introduce them, first tasks, the two-week check-in, the quizzes, the 30-day evaluation). Tick yours here; See their plan opens the whole plan.', opt: 1 });
      }
      var as = TT.academy && TT.academy.steps;
      var st = as ? as.filter(function (x) { return x.s === '#w122 .w122onb'; })[0] : null;
      if (st && String(st.p).indexOf('journey') < 0) st.p = 'Your onboarding plan, the Hub first steps and the policies to sign, in one place at the top. The plan opens as a journey, week by week; steps marked Avenue Academy tick themselves when you finish the module or the avenue, and the videos play inside the Hub.';
    } catch (e) { /* fine */ }
  }
  addTour(); setTimeout(addTour, 1500);

  /* ---------- test hook ---------- */
  window.w166 = {
    state: function () { return S; }, load: load, paint: paint, refresh: refresh, upgrade: upgrade, checklist: checklist,
    planStates: planStates, decoratePlan: decoratePlan, syncHead: syncHead, afterComplete: afterComplete,
    pathState: function (who, key) { var cx = ctxFor(who); return cx ? pathState(cx, key) : null; }
  };
})();
