
  /* ---------- person pages: the birthday pill ---------- */
  function personId() { var h = decodeURIComponent(location.hash || '').replace(/^#/, '').split('/'); return h[0] === 'person' && h[1] ? h[1] : null; }
  var pillBusy = false;
  function personPill() {
    if (pillBusy || !staffOk()) return;
    var sec = document.querySelector('section#personpage:not([data-w116kdecoy])'); if (!sec || !sec.classList.contains('active')) return;
    var meta = sec.querySelector('.w116khead .meta'); if (!meta) return;
    var id = personId(), m0 = me();
    var m = id ? members().filter(function (x) { return String(x.id) === String(id); })[0] : members().filter(function (x) { return lower(x.email) === m0.email; })[0];
    if (!m) return;
    var self = lower(m.email) === m0.email && !!m0.email;
    var b = C.bdays.filter(function (x) { return lower(x.email) === lower(m.email); })[0];
    var html = b ? '<button type="button" class="w124bpill"' + (self ? ' data-w124bday="1" title="Change your birthday"' : '') + '>' + I('cake') + E(MONTHS[b.month - 1] + ' ' + b.day) + '</button>' : (self ? '<button type="button" class="w124bpill add" data-w124bday="1">' + I('cake') + 'Add your birthday</button>' : '');
    var cur = meta.querySelector('.w124bpill');
    var sig = (m.id || '') + '|' + html;
    if (cur && cur.getAttribute('data-sig') === sig) return;
    pillBusy = true;
    try { if (cur) cur.remove(); if (html) { meta.insertAdjacentHTML('beforeend', html); var nb = meta.querySelector('.w124bpill'); if (nb) nb.setAttribute('data-sig', sig); } } finally { pillBusy = false; }
  }
  var ppT = null;
  function watchPerson() {
    var sec = document.querySelector('section#personpage:not([data-w116kdecoy])'); if (!sec || sec.__w124obs) return;
    sec.__w124obs = true;
    try { new MutationObserver(function () { if (pillBusy) return; clearTimeout(ppT); ppT = setTimeout(personPill, 80); }).observe(sec, { childList: true, subtree: true }); } catch (e) { /* fine */ }
  }

  /* ---------- menus: Calendar under Home, Events calendar in Fundraising ---------- */
  function placeTabs() {
    try {
      var bar = document.getElementById('tabBar'); if (!bar) return;
      var LAY = !!(window.WA_NAV && WA_NAV.layout); /* wave134: the menu layout places the calendar; this keeps the Events calendar in the Fundraising row */
      /* after Home; the board has no Home, so after Overview */
      var cal = bar.querySelector('.tab[data-tab="calendar"]'), home = bar.querySelector('.tab[data-tab="mypage"]');
      /* for the board (no Home): after the board pages (wave126 puts them right after Overview), else after Overview */
      var ov0 = bar.querySelector('.tab[data-tab="overview"]'), cm0 = bar.querySelector('.tab[data-tab="committees"]');
      var anchor = home && home.style.display !== 'none' ? home : (cm0 && ov0 && cm0.parentNode === ov0.parentNode && cm0.style.display !== 'none' ? cm0 : (ov0 || home));
      if (!LAY && cal && anchor && anchor.parentNode && anchor.nextSibling !== cal) anchor.parentNode.insertBefore(cal, anchor.nextSibling);
      var fe = bar.querySelector('.tab[data-tab="fundevents"]');
      if (fe) {
        /* inside Fundraising when that page is yours; otherwise (the board) right after the calendar */
        var fr = bar.querySelector('.tab[data-tab="fundraising"]'); var row = fr && fr.closest ? fr.closest('.w42d') : null; var sub = row ? row.querySelector('.w42sub') : null;
        if (sub && tabOk('fundraising')) { if (fe.parentNode !== sub) { var fin = sub.querySelector('.tab[data-tab="finances"]'); if (fin) sub.insertBefore(fe, fin); else sub.appendChild(fe); } fe.classList.add('w116tool'); }
        else if (!LAY && cal && cal.parentNode) { if (cal.nextSibling !== fe) cal.parentNode.insertBefore(fe, cal.nextSibling); fe.classList.remove('w116tool'); }
        fe.style.display = tabOk('fundevents') ? '' : 'none';
      }
      if (cal) cal.style.display = tabOk('calendar') ? '' : 'none';
    } catch (e) { /* fine */ }
  }
  function tabOk(id) { try { return typeof wa40Allowed !== 'function' || (wa40Allowed() || []).indexOf(id) >= 0; } catch (e) { return true; } }
  var navT = null;
  function watchNav() {
    var bar = document.getElementById('tabBar'); if (!bar || bar.__w124obs) return;
    bar.__w124obs = true;
    try { new MutationObserver(function () { if (navT) return; navT = setTimeout(function () { navT = null; placeTabs(); }, 150); }).observe(bar, { childList: true, subtree: true }); } catch (e) { /* fine */ }
  }
  function teamPill() {
    try {
      var h = decodeURIComponent(location.hash || ''); if (h.indexOf('#team/fundraising') !== 0) return;
      var seg = document.querySelector('#team .w116seg'); if (!seg || seg.querySelector('[data-w116go="#fundevents"]')) return;
      var a = document.createElement('a'); a.setAttribute('data-w116go', '#fundevents'); a.textContent = 'Events calendar';
      var fin = seg.querySelector('[data-w116go="#finances"]'); if (fin) seg.insertBefore(a, fin); else seg.appendChild(a);
    } catch (e) { /* fine */ }
  }
  var tpT = null;
  function watchTeam() {
    var sec = document.getElementById('team'); if (!sec || sec.__w124obs) return;
    sec.__w124obs = true;
    try { new MutationObserver(function () { clearTimeout(tpT); tpT = setTimeout(teamPill, 60); }).observe(sec, { childList: true, subtree: true }); } catch (e) { /* fine */ }
  }
  /* people with their own tab list (hub_roles.tabs: 3 admins and 2 leaders today) never had these two pages on it:
     everyone signed in gets the calendar, and whoever can see Fundraising or Finances (or the board) gets the events calendar */
  function enrolAllowed() {
    try {
      if (typeof wa40Allowed !== 'function' || wa40Allowed.__w124) return;
      var __al = wa40Allowed;
      wa40Allowed = function () {
        var a = __al.apply(this, arguments) || [];
        if (role() === 'blocked') return a;
        var add = [];
        if ((staffOk() || boardOk()) && a.indexOf('calendar') < 0) add.push('calendar');
        if ((a.indexOf('fundraising') >= 0 || a.indexOf('finances') >= 0 || boardOk()) && a.indexOf('fundevents') < 0) add.push('fundevents');
        return add.length ? a.concat(add) : a;
      };
      Object.keys(__al).forEach(function (k) { try { wa40Allowed[k] = __al[k]; } catch (e) { /* fine */ } });
      wa40Allowed.__w124 = true;
    } catch (e) { /* fine */ }
  }
  function register() {
    enrolAllowed();
    if (!window.WA_NAV || typeof WA_NAV.register !== 'function') return;
    if (!WA_NAV.pages.some(function (p) { return p.id === 'calendar'; })) WA_NAV.register({ id: 'calendar', label: 'Calendar', dot: GOLD, gate: 'viewer', onShow: function (h) { routeCal(h); } });
    if (!WA_NAV.pages.some(function (p) { return p.id === 'fundevents'; })) WA_NAV.register({ id: 'fundevents', label: 'Events calendar', dot: '#C8961F', gate: 'viewer', onShow: function (h) { routeFund(h); } });
    placeTabs(); watchNav();
  }

  /* ---------- routes ---------- */
  function routeCal(h) {
    var p = String(h || '').split('/');
    if (/^\d{4}-\d{2}$/.test(p[1] || '')) { C.anchor = mk(Number(p[1].slice(0, 4)), Number(p[1].slice(5)) - 1, 1, 12); }
    if (p[1] === 'agenda' || p[2] === 'agenda') { C.view = 'agenda'; C.scrollOnce = true; }
    if (p[1] === 'month' || p[2] === 'month') C.view = 'month';
    try { document.title = 'Calendar · Welfare Avenue Hub'; } catch (e) { /* fine */ }
    calShow();
  }
  function routeFund(h) {
    var p = String(h || '').split('/');
    try { document.title = 'Events calendar · Welfare Avenue Hub'; } catch (e) { /* fine */ }
    try { var fe = document.querySelector('#tabBar .tab[data-tab="fundevents"]'); var row = fe && fe.closest ? fe.closest('.w42d') : null; if (row) row.classList.add('w116open', 'w116act'); } catch (e) { /* fine */ }
    fundShow(p[1] || '');
  }
  function repaintAll() {
    if (onCal()) calPaint();
    if (onFund()) fundPaint();
    personPill();
  }

  /* ---------- events ---------- */
  function go(h) { closeSheet(); if (location.hash === h) { try { applyHash(); } catch (e) { /* fine */ } } else location.hash = h; }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var el, inSheet = !!t.closest('#w124sheet'), inCal = !!t.closest('#w124cal'), inFund = !!t.closest('#w124fund'), inPerson = !!t.closest('#personpage');
    if (!inSheet && !inCal && !inFund && !(inPerson && t.closest('.w124bpill'))) return;
    if ((el = t.closest('[data-w124close]'))) { closeSheet(); return; }
    if ((el = t.closest('[data-w124go]'))) { e.preventDefault(); go(el.getAttribute('data-w124go')); return; }
    if ((el = t.closest('[data-w124bday]'))) { e.preventDefault(); openBdayForm(); return; }
    if ((el = t.closest('[data-w124bdel]'))) { deleteBday(); return; }
    if ((el = t.closest('[data-w124fedit]'))) { openFundForm(fundById(el.getAttribute('data-w124fedit'))); return; }
    if ((el = t.closest('[data-w124fdone]'))) { openFundForm(fundById(el.getAttribute('data-w124fdone')), null, true); return; }
    if ((el = t.closest('[data-w124fdel]'))) { deleteFund(el.getAttribute('data-w124fdel')); return; }
    if ((el = t.closest('[data-w124fadd]'))) { openFundForm(null, el.getAttribute('data-w124fadd')); return; }
    if ((el = t.closest('[data-w124fund]'))) { openFund(fundById(el.getAttribute('data-w124fund'))); return; }
    if ((el = t.closest('[data-w124person]'))) { go('#person/' + el.getAttribute('data-w124person')); return; }
    if (inCal) {
      if ((el = t.closest('[data-w124it]'))) { openItem(calItemById(el.getAttribute('data-w124it'))); return; }
      if ((el = t.closest('[data-w124nav]'))) { var n = Number(el.getAttribute('data-w124nav')); C.anchor = n === 0 ? monthStart(today()) : addMonths(C.anchor, n); if (n === 0) C.scrollOnce = true; calPaint(); loadRange().then(function () { if (onCal()) calPaint(); }); return; }
      if ((el = t.closest('[data-w124view]'))) { C.view = el.getAttribute('data-w124view'); lsSet('w124view', C.view); C.scrollOnce = true; calPaint(); loadRange().then(function () { if (onCal()) calPaint(); }); return; }
      if ((el = t.closest('[data-w124layer]'))) { var k = el.getAttribute('data-w124layer'); C.layers[k] = !C.layers[k]; lsSet('w124layers', JSON.stringify(C.layers)); calPaint(); return; }
      if ((el = t.closest('[data-w124day]'))) { C.view = 'agenda'; C.scrollOnce = true; calPaint(); var dd = document.getElementById('w124d' + el.getAttribute('data-w124day')); if (dd) dd.scrollIntoView({ block: 'center' }); return; }
    }
  });
  document.addEventListener('change', function (e) { var t = e.target; if (t && t.matches && t.matches('#w124sheet select[name=precision]')) syncDates(); });
  document.addEventListener('submit', function (e) {
    var f = e.target; if (!f || !f.closest || !f.closest('#w124sheet')) return;
    e.preventDefault();
    if (f.hasAttribute('data-w124fform')) saveFund(f);
    else if (f.hasAttribute('data-w124bform')) saveBday(f);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && C.sheet) { e.preventDefault(); closeSheet(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('#w124cal [data-w124it], #w124cal [data-w124layer], #w124fund .w124fe, #w124cal .w124row[data-w124fund]')) { e.preventDefault(); e.target.click(); }
  });
  window.addEventListener('hashchange', function () {
    if (C.sheet) closeSheet();
    try { if (personId() !== null || location.hash === '#mypage') { watchPerson(); if (!C.loadedBase) loadBase().then(personPill); else setTimeout(personPill, 120); } } catch (e) { /* fine */ }
    try { if ((location.hash || '').indexOf('#team/fundraising') === 0) { watchTeam(); setTimeout(teamPill, 120); } } catch (e) { /* fine */ }
  });
  if (typeof showPanel === 'function') {
    var __sp124 = showPanel;
    showPanel = function (id) {
      var out = __sp124.apply(this, arguments);
      try {
        if (id === 'personpage') { setTimeout(function () { watchPerson(); if (!C.loadedBase) loadBase().then(personPill); else personPill(); }, 250); }
        if (id === 'team') { watchTeam(); setTimeout(teamPill, 120); }
        if (id !== 'calendar' && id !== 'fundevents' && C.sheet) closeSheet();
      } catch (e) { /* fine */ }
      return out;
    };
  }
  if (typeof startApp === 'function') {
    var __sa124 = startApp;
    startApp = async function () {
      var out = await __sa124.apply(this, arguments);
      try {
        register(); watchTeam();
        [400, 1500, 3500].forEach(function (ms) { setTimeout(placeTabs, ms); });
        var h = decodeURIComponent(location.hash || '').replace(/^#/, '');
        if (h.split('/')[0] === 'calendar') { showPanel('calendar'); routeCal(h); }
        else if (h.split('/')[0] === 'fundevents') { showPanel('fundevents'); routeFund(h); }
        else if (h.split('/')[0] === 'person') { watchPerson(); loadBase().then(personPill); }
        if (h.indexOf('team/fundraising') === 0) setTimeout(teamPill, 300);
      } catch (e) { console.warn('wave124 boot', e); }
      return out;
    };
  }

  /* ---------- test hook ---------- */
  window.w124 = { state: function () { return C; }, items: items, bands: bands, load: loadBase, range: loadRange, cal: calPaint, fund: fundPaint, openFund: openFund, openItem: openItem, bday: openBdayForm, close: closeSheet };
})();
