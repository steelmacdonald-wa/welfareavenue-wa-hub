
  /* ---------- who is on the Hub now (wave12's presence) ---------- */
  function loadOnline() {
    try {
      if (typeof waLoadPresence !== 'function' || typeof waOnlineEmails !== 'function') return Promise.resolve();
      return Promise.resolve(waLoadPresence()).then(function () { var on = {}; (waOnlineEmails() || []).forEach(function (r) { if (r && r.email) on[lower(r.email)] = 1; }); O.online = on; }).catch(function () { /* fine */ });
    } catch (e) { return Promise.resolve(); }
  }

  /* ---------- showing the chart ---------- */
  function onPage() { var s = document.getElementById('orgchart'); return !!(s && s.classList.contains('active')); }
  var pendingOpen = null;
  function show() {
    if (!staffOk()) return;
    hostEl();
    if (!O.pos) paint();
    load(!O.pos || Date.now() - O.at > 30000).then(function () {
      paint();
      loadOnline().then(function () { if (onPage()) paint(); });
      if (pendingOpen != null) { var mid = pendingOpen; pendingOpen = null; openFor(mid); }
    }).catch(function () {
      /* the chart could not load: the roster view stays */
      var h = document.getElementById('w133'); if (h) h.innerHTML = '<div class="w133err">' + E(O.err || 'The chart could not load.') + ' The team list below is the roster.</div>';
      oldCard(false);
    });
  }
  function openFor(mid) {
    var X = ix(), seat = X.seatOf[mid];
    if (seat) openSheet({ kind: 'seat', id: seat.id }); else if (memberById(mid)) openSheet({ kind: 'member', mid: Number(mid) });
    try { var el = document.querySelector('#w133 [data-w133m="' + mid + '"]'); if (el) el.scrollIntoView({ block: 'center' }); } catch (e) { /* fine */ }
  }
  if (typeof renderOrgChart === 'function') {
    var __roc133 = renderOrgChart;
    renderOrgChart = async function () {
      var out;
      try { out = await __roc133.apply(this, arguments); } catch (e) { /* the old chart is only the fallback */ }
      try { show(); } catch (e) { console.warn('wave133 chart', e); }
      return out;
    };
  }
  if (typeof applyHash === 'function') {
    var __ah133 = applyHash;
    applyHash = function () {
      var h = decodeURIComponent(location.hash || '').replace(/^#/, '');
      var m = /^orgchart\/(\d+)$/.exec(h);
      if (m) { pendingOpen = Number(m[1]); try { showPanel('orgchart'); renderOrgChart(); } catch (e) { /* fine */ } return; }
      return __ah133.apply(this, arguments);
    };
  }

  /* ---------- a person's page: who they report to ---------- */
  function personLine() {
    try {
      var h = decodeURIComponent(location.hash || '').replace(/^#/, ''), mm = /^person\/(\d+)/.exec(h); if (!mm) return;
      var head = document.querySelector('#personpage .w116khead'); if (!head) return;
      var mid = Number(mm[1]);
      var cur = head.querySelector('.w133pline');
      if (cur && cur.getAttribute('data-m') === String(mid) && cur.getAttribute('data-v') === String(O.ver)) return;
      if (!O.pos) { if (!O.loading && staffOk()) load(false).then(personLine).catch(function () { /* fine */ }); return; }
      var X = ix(), seat = X.seatOf[mid], m = memberById(mid);
      if (!m || m.department === 'board' && !seat) { if (cur) cur.remove(); return; }
      var bits = [];
      if (seat) {
        if (seat.kind === 'exec') bits.push('Reports to the board');
        else if (seat.reports_to == null) bits.push('Reports to the executive directors');
        else { var g = X.byId[seat.reports_to], gm = holder(g); bits.push('Reports to ' + (gm ? '<a data-w133go="#person/' + E(gm.id) + '">' + E(gm.name) + '</a>' : 'an open position (' + E(g ? g.title : '') + ')')); }
        var ks = (X.kids[String(seat.id)] || []).slice().sort(seatOrder);
        var ppl = ks.filter(function (k) { return !isOpen(k); }), op = ks.length - ppl.length;
        if (ppl.length) bits.push(plural(ppl.length, 'direct report', 'direct reports') + ': ' + ppl.slice(0, 5).map(function (k) { var km = holder(k); return '<a data-w133go="#person/' + E(km.id) + '">' + E(km.name) + '</a>'; }).join(', ') + (ppl.length > 5 ? ' and ' + (ppl.length - 5) + ' more' : ''));
        if (op) bits.push(plural(op, 'open position', 'open positions') + ' under them');
      } else bits.push('Not placed on the org chart yet');
      bits.push('<a data-w133go="#orgchart/' + E(mid) + '">See on the org chart</a>');
      var html = bits.join(' · ');
      if (!cur) { cur = document.createElement('div'); cur.className = 'w133pline'; var onb = head.querySelector('#w116konb'); if (onb) onb.insertAdjacentElement('afterend', cur); else { var tx = head.children[1] || head; tx.appendChild(cur); } }
      cur.setAttribute('data-m', String(mid)); cur.setAttribute('data-v', String(O.ver)); cur.innerHTML = html;
    } catch (e) { /* fine */ }
  }
  var plT = null;
  function watchPerson() {
    var sec = document.getElementById('personpage'); if (!sec || sec.__w133) return;
    sec.__w133 = true;
    try { new MutationObserver(function () { clearTimeout(plT); plT = setTimeout(personLine, 80); }).observe(sec, { childList: true, subtree: true }); } catch (e) { /* fine */ }
  }

  /* ---------- events ---------- */
  function go(h) { closeSheet(); if (location.hash === h) { try { applyHash(); } catch (e) { /* fine */ } } else location.hash = h; }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var el;
    if ((el = t.closest('#w133snack [data-w133sn]'))) { var k = el.getAttribute('data-w133sn'); if (k === 'x') { hideSnack(); return; } var a = SN.acts[Number(k)]; hideSnack(); if (a && a[1]) a[1](); return; }
    if ((el = t.closest('.w133pline [data-w133go]'))) { e.preventDefault(); go(el.getAttribute('data-w133go')); return; }
    var inSheet = !!t.closest('#w133sheet'), inPage = !!t.closest('#w133');
    if (!inSheet && !inPage) return;
    if ((el = t.closest('[data-w133go]'))) { e.preventDefault(); go(el.getAttribute('data-w133go')); return; }
    if (inSheet) {
      if ((el = t.closest('[data-w133close]'))) { closeSheet(); return; }
      if ((el = t.closest('[data-w133sts]'))) { O.sheet.status = el.getAttribute('data-w133sts'); el.parentNode.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === el); }); return; }
      if ((el = t.closest('[data-w133do]'))) { sheetDo(el.getAttribute('data-w133do')); return; }
      if ((el = t.closest('[data-w133addunder]'))) { var X0 = ix(), up0 = X0.byId[el.getAttribute('data-w133addunder')]; O.sheet = { kind: 'new', under: Number(el.getAttribute('data-w133addunder')), dept: up0 ? (seatTeam(up0) === 'board' ? '' : seatTeam(up0)) : '' }; renderSheet(true); return; }
      if ((el = t.closest('.who[data-w133p]'))) { O.sheet = { kind: 'seat', id: Number(el.getAttribute('data-w133p')) }; renderSheet(true); return; }
      return;
    }
    /* the page */
    if ((el = t.closest('[data-w133arr]'))) { O.arrange = !O.arrange; paint(); if (!O.arrange) hideSnack(); return; }
    if ((el = t.closest('[data-w133team]'))) { O.team = el.getAttribute('data-w133team'); paint(); return; }
    if ((el = t.closest('[data-w133exp]'))) { O.expand[el.getAttribute('data-w133exp')] = 1; paint(); return; }
    if ((el = t.closest('[data-w133addunder]'))) { e.stopPropagation(); var X1 = ix(), up1 = X1.byId[el.getAttribute('data-w133addunder')]; openSheet({ kind: 'new', under: Number(el.getAttribute('data-w133addunder')), dept: up1 ? (seatTeam(up1) === 'board' ? '' : seatTeam(up1)) : '' }); return; }
    if ((el = t.closest('[data-w133addteam]'))) { var d = el.getAttribute('data-w133addteam'); openSheet({ kind: 'new', under: null, dept: d || O.team || '' }); return; }
    if ((el = t.closest('.w133c[data-w133p]'))) { openSheet({ kind: 'seat', id: Number(el.getAttribute('data-w133p')) }); return; }
    if ((el = t.closest('.w133bchip[data-w133m]'))) { openSheet({ kind: 'member', mid: Number(el.getAttribute('data-w133m')) }); return; }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && O.sheet) { e.preventDefault(); closeSheet(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('#w133 .w133c[role=button], #w133sheet .who[role=button]')) { e.preventDefault(); e.target.click(); }
  });
  var qT = null;
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t) return;
    if (t.id === 'w133q') { O.q = t.value; clearTimeout(qT); qT = setTimeout(function () { O.scrollHit = true; paint(); }, 160); return; }
    if (t.id === 'w133pq' && O.sheet) { O.sheet.pq = t.value; var X = ix(), p = X.byId[O.sheet.id]; var box = document.getElementById('w133picks'); if (p && box) box.innerHTML = pickList(X, p); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t) return;
    if (t.id === 'w133open') { O.showOpen = !!t.checked; paint(); return; }
    if (t.matches && t.matches('#w133picks input[data-w133pick]') && O.sheet) { O.sheet.sel = O.sheet.sel || {}; O.sheet.sel[t.getAttribute('data-w133pick')] = !!t.checked; }
  });
  window.addEventListener('hashchange', function () {
    if (O.sheet) closeSheet();
    if (O.arrange && !/^#orgchart/.test(location.hash || '')) { O.arrange = false; hideSnack(); }
    setTimeout(personLine, 200);
  });
  if (typeof showPanel === 'function') {
    var __sp133 = showPanel;
    showPanel = function (id) { var out = __sp133.apply(this, arguments); try { if (id === 'personpage') { watchPerson(); setTimeout(personLine, 250); } } catch (e) { /* fine */ } return out; };
  }
  if (typeof startApp === 'function') {
    var __sa133 = startApp;
    startApp = async function () {
      var out = await __sa133.apply(this, arguments);
      try { watchPerson(); var h = decodeURIComponent(location.hash || '').replace(/^#/, ''); if (/^orgchart\/\d+$/.test(h)) applyHash(); if (/^person\//.test(h)) setTimeout(personLine, 600); } catch (e) { console.warn('wave133 boot', e); }
      return out;
    };
  }

  /* ---------- the page tour (wave122's engine; trainings row tour:orgchart) ---------- */
  function addTours() {
    try {
      var W = window.w122; if (!W || !W.tours) return;
      var OPT = { opt: 1 };
      var S = function (sel, t, p, o) { var x = { s: sel, t: t, p: p }; if (o) Object.keys(o).forEach(function (k) { x[k] = o[k]; }); return x; };
      W.tours.orgchart = { tab: 'orgchart', icon: 'people', hash: '#orgchart', steps: [
        S('#orgchart > .w118mast', 'Who reports to whom', 'The live chart: the board, the executive directors, then every team with its leads and the people who report to them.'),
        S('#w133 .w133bar', 'Find anyone', 'Search for a name, show one team, and show or hide the open positions.', OPT),
        S('#w133 .w133board', 'The board', 'The directors. The executive directors report to the board.', OPT),
        S('#w133 .w133exec', 'The executive directors', 'Day-to-day leadership. Each team’s leads report to them.', OPT),
        S('#w133 .w133team', 'A team', 'Its leads first, then everyone nested under the person they report to. The number on a card is how many report to that person. Click anyone for their reporting line and profile.', OPT),
        S('#w133 .w133c.open', 'An open position', 'A seat waiting for someone: open, hiring or on hold, with a note. Ask HR to recruit from it.', OPT),
        S('#w133 [data-w133arr]', 'Rearrange', 'Executives and admins drag people onto the person they report to, choose direct reports, add open positions and fill them. Every move can be undone.', OPT)
      ] };
    } catch (e) { /* fine */ }
  }
  addTours();

  /* ---------- test hook ---------- */
  window.w133 = { state: function () { return O; }, load: load, paint: paint, open: openSheet, close: closeSheet, ix: ix, plan: plan, doPlan: doPlan, line: personLine };
})();
