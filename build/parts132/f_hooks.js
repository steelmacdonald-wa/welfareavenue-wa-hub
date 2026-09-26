
  /* ---------- the task drawer: Move to the bank ---------- */
  function drawerTaskId() {
    var hs = document.querySelectorAll('#w116dr .w116drh span');
    for (var i = 0; i < hs.length; i++) { var m = String(hs[i].textContent || '').match(/#(\d+)/); if (m) return Number(m[1]); }
    return null;
  }
  function injectDrawer() {
    var dr = document.getElementById('w116dr'); if (!dr || !dr.classList.contains('open')) return;
    var ft = dr.querySelector('.w116drf'); if (!ft) return;
    var id = drawerTaskId(), t = id ? taskById(id) : null;
    var cur = ft.querySelector('[data-w132bank]');
    var want = !!(t && !t.done && Number(t.id) > 0 && canWork());
    if (cur && (!want || cur.getAttribute('data-w132bank') !== String(t.id))) { cur.remove(); cur = null; }
    if (!want || cur) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'w132drb'; b.setAttribute('data-w132bank', String(t.id));
    b.title = 'For work that cannot start for three months or more: it leaves every board and comes back on its date';
    b.innerHTML = I('vault') + 'Move to the bank';
    var del = ft.querySelector('.warn'); if (del) ft.insertBefore(b, del); else ft.appendChild(b);
  }
  var drObs = null;
  function watchDrawer() {
    var dr = document.getElementById('w116dr');
    if (dr && !dr.__w132) {
      dr.__w132 = true;
      try { new MutationObserver(function () { injectDrawer(); }).observe(dr, { childList: true, attributes: true, attributeFilter: ['class'] }); } catch (e) { /* fine */ }
      injectDrawer();
    }
    if (!dr && !drObs) {
      /* the drawer is made the first time a task opens */
      try { drObs = new MutationObserver(function () { if (document.getElementById('w116dr')) { drObs.disconnect(); drObs = null; watchDrawer(); } }); drObs.observe(document.body, { childList: true }); } catch (e) { /* fine */ }
    }
  }

  /* ---------- the project page: Move the project to the bank ---------- */
  function projectRef() { var h = decodeURIComponent(location.hash || '').replace(/^#/, ''); if (h.indexOf('project/') !== 0) return null; return h.split('/')[1] || null; }
  function injectProject() {
    var sec = document.getElementById('projectpage'); if (!sec) return;
    var ref = projectRef();
    var cur = sec.querySelector('.w132pbar');
    var p = ref && ref !== 'general' ? projById(ref) : null;
    var want = !!(p && (p.status || 'active') === 'active' && !isGeneralList(p) && canWork() && leadsProject(p));
    if (cur && (!want || cur.getAttribute('data-p') !== String(p.id))) { cur.remove(); cur = null; }
    if (!want || cur) return;
    var card = sec.querySelector('.card'); if (!card) return;
    var anchor = card.querySelector('.w27-desc') || card.querySelector('h2'); if (!anchor) return;
    var bar = document.createElement('div'); bar.className = 'w132pbar'; bar.setAttribute('data-p', String(p.id));
    bar.innerHTML = '<button type="button" class="w132btn" data-w132bankproj="' + E(p.id) + '">' + I('vault') + 'Move the project to the bank</button><span>For a project that cannot move for three months or more. It comes back with everything in it.</span>';
    anchor.insertAdjacentElement('afterend', bar);
  }
  var pjT = null;
  function watchProject() {
    var sec = document.getElementById('projectpage'); if (!sec || sec.__w132) return;
    sec.__w132 = true;
    try { new MutationObserver(function () { clearTimeout(pjT); pjT = setTimeout(injectProject, 60); }).observe(sec, { childList: true, subtree: true }); } catch (e) { /* fine */ }
  }
  function projectCounts(p) {
    var ids = [String(p.id)]; projects().forEach(function (x) { if (String(x.parent_id) === String(p.id)) ids.push(String(x.id)); });
    var open = tasks().filter(function (t) { return !t.done && ids.indexOf(String(t.project_id)) >= 0; });
    return { subs: ids.length - 1, count: open.length };
  }

  /* ---------- a team's overview page: In the bank ---------- */
  function teamRoute() {
    var h = decodeURIComponent(location.hash || '').replace(/^#/, ''); var p = h.split('/');
    if (p[0] !== 'team' || !p[1] || teams().indexOf(p[1]) < 0) return null;
    if (p[2] && p[2] !== 'overview') return null;
    return p[1];
  }
  var cardBusy = false;
  function cardHtml(d) {
    var c = teamCounts(d);
    var rows = c.back.slice(0, 3).map(function (x) { var dd = dayOfIso(x.at); return '<div class="w132trow back"><span>' + E(x.title) + '</span><em>back ' + E(dd ? fmtShort(dd) : '') + '</em></div>'; })
      .concat(c.list.slice(0, Math.max(0, 4 - Math.min(3, c.back.length))).map(function (x) { var dd = parseDay(x.until); return '<div class="w132trow"><span>' + (x.kind === 'project' ? 'Project: ' : x.kind === 'idea' ? 'Content idea: ' : '') + E(x.title) + '</span><em>' + E(dd ? fmtShort(dd) : '') + '</em></div>'; }));
    var sum = [];
    if (c.list.length) sum.push('<b>' + plural(c.list.length, 'item', 'items') + '</b> waiting' + (c.projects ? ' (' + plural(c.projects, 'project', 'projects') + ')' : ''));
    if (c.back.length) sum.push('<b>' + c.back.length + '</b> back in the last two weeks');
    return '<div class="w116card w132tcard" id="w132tcard" data-d="' + E(d) + '" data-v="' + B.ver + '"><h3>In the bank <span class="lnk" data-w132goto="#bank/' + E(d) + '">open the bank</span></h3>'
      + '<p class="w132tsum">' + sum.join(' · ') + '. Work that waits three months or more, back on its own date.</p>' + rows.join('') + '</div>';
  }
  function injectCard(force) {
    if (cardBusy) return;
    var d = teamRoute();
    var cur = document.getElementById('w132tcard');
    if (!d || !staffOk() || !tabOk('bank')) { if (cur) cur.remove(); return; }
    var hostEl = document.getElementById('w116host'); if (!hostEl) return;
    var cols = hostEl.querySelectorAll('.w116grid > .w116col'); if (!cols.length) return;
    var col = cols[cols.length - 1];
    if (!B.data) { if (!B.loading) load().then(function () { injectCard(true); }); return; }
    var c = teamCounts(d);
    if (!c.list.length && !c.back.length) { if (cur) cur.remove(); return; }
    if (cur && !force && cur.getAttribute('data-d') === d && cur.parentNode === col && cur.getAttribute('data-v') === String(B.ver)) return;
    cardBusy = true;
    try { if (cur) cur.remove(); col.insertAdjacentHTML('beforeend', cardHtml(d)); } finally { cardBusy = false; }
    if (Date.now() - B.at > 60000 && !B.loading) load(true).then(function () { injectCard(true); });
  }
  var cardT = null;
  function watchTeam() {
    var sec = document.getElementById('team'); if (!sec || sec.__w132) return;
    sec.__w132 = true;
    try { new MutationObserver(function () { if (cardBusy) return; clearTimeout(cardT); cardT = setTimeout(function () { injectCard(false); }, 60); }).observe(sec, { childList: true, subtree: true }); } catch (e) { /* fine */ }
  }

  /* ---------- the menu: Strategy > The bank ---------- */
  function register() {
    if (!window.WA_NAV || typeof WA_NAV.register !== 'function') return;
    if (!WA_NAV.pages.some(function (p) { return p.id === 'bank'; })) WA_NAV.register({ id: 'bank', label: 'The bank', group: 'strategy', dot: VAULT, gate: 'member', onShow: function (h) { route(h); } });
    placeTab();
  }
  /* after the five strategy pages, whatever rebuilt the group */
  function placeTab() {
    try {
      var bar = document.getElementById('tabBar'); if (!bar) return;
      var b = bar.querySelector('.tab[data-tab="bank"]'); if (!b) return;
      var host = bar.querySelector('.tab-group[data-w42g="strategy"] .tab-group-p'); if (!host) return;
      if (b.parentNode !== host || host.lastElementChild !== b) host.appendChild(b);
    } catch (e) { /* fine */ }
  }
