
  /* ---------- paint ---------- */
  function hostEl() {
    var panel = document.getElementById('overview'); if (!panel) return null;
    var h = document.getElementById('w128');
    if (!h) { h = document.createElement('div'); h.id = 'w128'; }
    var mast = panel.querySelector(':scope > .w118mast');
    var want = mast ? mast.nextSibling : panel.firstChild;
    if (h.parentNode !== panel || (mast && mast.nextElementSibling !== h)) panel.insertBefore(h, want);
    panel.classList.add('w128on');
    tidy(panel);
    return h;
  }
  /* the help button leaves the old "Your plate" card for the masthead */
  function tidy(panel) {
    try {
      var help = panel.querySelector('.card.w28my .w43help, .card.w28my [data-w43help]');
      var mast = panel.querySelector(':scope > .w118mast');
      if (help && mast && !mast.querySelector('.w43help')) mast.appendChild(help);
      var all = document.getElementById('decisionList'); var card = all && all.closest ? all.closest('.card') : null;
      if (card && !card.id) card.id = 'w128all';
    } catch (e) { /* cosmetic */ }
  }
  function paint() {
    var h = hostEl(); if (!h) return;
    var html = briefHtml() + tilesHtml()
      + '<div class="w128row">' + decHtml() + watchHtml() + '</div>'
      + '<div class="w128row">' + winsHtml() + nextHtml() + '</div>'
      + teamsHtml();
    if (h.__h !== html) { h.innerHTML = html; h.__h = html; }
  }
  async function show() {
    paint();
    await load();
    if (onOverview()) paint();
  }

  /* ---------- the doors ---------- */
  function scrollTo(el) { if (el && el.scrollIntoView) { try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { el.scrollIntoView(); } } }
  function openFold(k) {
    var b = document.querySelector('#w111folds [data-w111f="' + k + '"]');
    if (!b) { location.hash = k === 'numbers' ? '#dashboard' : '#overview'; return; }
    if (!b.classList.contains('on')) b.click();
    setTimeout(function () { scrollTo(document.getElementById('w111folds')); }, 60);
  }
  function seeDecision(ref) {
    var li = document.querySelector('#decisionList li[data-decision="' + ref + '"]');
    if (!li) { scrollTo(document.getElementById('w128all') || document.getElementById('decisionList')); return; }
    scrollTo(li); li.classList.remove('w128flash'); void li.offsetWidth; li.classList.add('w128flash');
  }
  function decide(ref) {
    var dec = null; try { dec = (typeof getDecisions === 'function' ? getDecisions() : []).filter(function (d) { return String(d.ref) === String(ref); })[0]; } catch (e) { dec = null; }
    if (!dec || typeof decideModal !== 'function') { seeDecision(ref); return; }
    decideModal(dec, { checked: false });
  }
  function go(h) {
    if (!h) return;
    if (h.indexOf('#team/') === 0) { var d = h.split('/')[1]; if (!tabOk(d)) return; }
    else { var root = h.replace(/^#/, '').split('/')[0]; if (root && root !== 'person' && root !== 'project' && !tabOk(root) && ['volunteering', 'importantinfo'].indexOf(root) < 0) { try { toast('That page is not in your access profile'); } catch (e) { /* fine */ } return; } }
    location.hash = h;
  }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#w128')) return;
    var el;
    if ((el = t.closest('[data-w128decide]'))) { e.preventDefault(); decide(el.getAttribute('data-w128decide')); return; }
    if ((el = t.closest('[data-w128see]'))) { e.preventDefault(); seeDecision(el.getAttribute('data-w128see')); return; }
    if ((el = t.closest('[data-w128all]'))) { e.preventDefault(); scrollTo(document.getElementById('w128all') || document.getElementById('decisionList')); return; }
    if ((el = t.closest('[data-w128fold]'))) { e.preventDefault(); openFold(el.getAttribute('data-w128fold')); return; }
    if ((el = t.closest('[data-w128go]'))) {
      e.preventDefault();
      var h = el.getAttribute('data-w128go');
      if (h === '#overview/decisions') { scrollTo(document.getElementById('w128all') || document.getElementById('decisionList')); return; }
      go(h); return;
    }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('#w128 [role=button]')) { e.preventDefault(); e.target.click(); }
  });

  /* ---------- the tour follows the new page ---------- */
  function tour() {
    try {
      var W = window.w122; if (!W || !W.tours || !W.tours.overview || W.tours.overview.__w128) return;
      var OPT = { opt: 1 };
      var S = function (sel, tt, p, o) { var x = { s: sel, t: tt, p: p }; if (o) Object.keys(o).forEach(function (k) { x[k] = o[k]; }); return x; };
      W.tours.overview.steps = [
        S('#overview > .w118mast', 'The executive view', 'Where Welfare Avenue stands: the calls waiting on the executives, what is going well, what to watch and what is coming.'),
        S('#w128 .w128brief', 'The brief', 'Two or three sentences built from the Hub’s data, and what is next: the board meeting, the next fundraising event and the next serving.', OPT),
        S('#w128 .w128kpis', 'The numbers', 'Each number opens the page that explains it. Open tasks opens the overdue folder right here. Our fiscal year runs October 1 to September 30.', OPT),
        S('#w128dec', 'Needs a decision', 'The oldest calls first, with who decides, the suggested move and the recommendation. Record the decision here or find it in the full list.', OPT),
        S('#w128 .w128watch', 'To watch', 'What could slip: old decisions, events without a result, overdue work, quiet teams, delayed goals and board items at risk.', OPT),
        S('#w128 .w128wins', 'Highlights', 'Event results, shout-outs, goals closed and work finished lately.', OPT),
        S('#w128 .w128next', 'Coming up', 'The next six weeks: the year-end, board meetings, the committee deadline, events and servings.', OPT),
        S('#w128 .w128teams', 'Teams at a glance', 'Each team’s open and overdue work, what closed lately and when it last had a meeting on the Hub. Open a card for the team page.', OPT),
        S('#w116news', 'What’s new', 'Major announcements and changes since you last looked.', OPT),
        S('#w111folds', 'Folders', 'Overdue tasks and the delivery numbers, folded away until you open them.', OPT),
        S('#decisionList', 'Every executive decision', 'The full list with filters by category and by who decides. Tick one to record what was decided.', OPT),
        S('#overview .add-row', 'Add a decision', 'Anyone can raise a call that needs an executive.', OPT),
        S('#decDoneWrap', 'Decided', 'Every decision made, with its note, stays here for the record.', OPT)
      ];
      W.tours.overview.__w128 = true;
    } catch (e) { /* fine */ }
  }
  tour();

  /* ---------- wiring ---------- */
  if (typeof showPanel === 'function') {
    var __sp128 = showPanel;
    showPanel = function (id) {
      var out = __sp128.apply(this, arguments);
      try { if (id === 'overview') setTimeout(show, 20); } catch (e) { /* fine */ }
      return out;
    };
  }
  function wrapDecisions() {
    try {
      if (typeof renderDecisions !== 'function' || renderDecisions.__w128) return;
      var inner = renderDecisions;
      renderDecisions = function () { var out = inner.apply(this, arguments); try { if (onOverview()) { X.loaded = 0; setTimeout(show, 30); } } catch (e) { /* fine */ } return out; };
      Object.keys(inner).forEach(function (k) { try { renderDecisions[k] = inner[k]; } catch (e) { /* fine */ } });
      renderDecisions.__w128 = true;
    } catch (e) { /* fine */ }
  }
  window.w128 = { state: function () { return X; }, paint: paint, load: load, show: show, brief: briefText, watch: watchRows, wins: winsRows, next: nextRows, team: teamStats };
  if (typeof startApp === 'function') {
    var __sa128 = startApp;
    startApp = async function () {
      var out = await __sa128.apply(this, arguments);
      try { wrapDecisions(); tour(); if (onOverview()) show(); } catch (e) { console.warn('wave128 boot', e); }
      return out;
    };
  }
})();
