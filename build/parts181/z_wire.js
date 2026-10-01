
  /* ---------- the tab in the HR centre ---------- */
  function setShown(on) {
    var h = document.getElementById('w181'); if (h) h.classList.toggle('on', !!on);
    if (on) { if (!A.loaded && !A.loading) { paint(); load().then(paint); } else if (A.loaded && h && !h.children.length) paint(); }
  }
  async function decorate() {
    var body = document.getElementById('w46body'); if (!body) return;
    var tabs = body.querySelector('.w47tabs'); if (!tabs) return;
    if (!(await canSee())) return;
    tabs = body.querySelector('.w47tabs'); if (!tabs) return;
    var tab = tabs.querySelector('[data-w47v="analytics"]');
    if (!tab) { tabs.insertAdjacentHTML('beforeend', '<button class="w47tab" data-w47v="analytics">Analytics</button>'); tab = tabs.querySelector('[data-w47v="analytics"]'); }
    host();
    var sub = String(location.hash || '').split('/')[1] || '';
    var want = hrOn() && String(location.hash || '').indexOf('#hrcentre') === 0 && (sub === 'analytics' || A.on);
    if (want && !tab.classList.contains('on')) { tab.click(); return; }
    setShown(tab.classList.contains('on'));
  }
  var pend = null;
  function schedule() { clearTimeout(pend); pend = setTimeout(function () { try { decorate(); } catch (e) { /* fine */ } }, 160); }
  function watch() {
    var panel = document.getElementById('hrcentre'); if (!panel || panel.dataset.w181mo) return; panel.dataset.w181mo = '1';
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) { var t = muts[i].target; if (t && t.closest && (t.closest('#w181') || (muts[i].type === 'attributes' && t.closest('.w47tab')))) continue; schedule(); return; }
    }).observe(panel, { childList: true, subtree: true });
    schedule();
  }
  if (typeof wa46Render === 'function') {
    var __r46 = wa46Render;
    wa46Render = async function () { var out = await __r46.apply(this, arguments); try { watch(); schedule(); } catch (e) { /* fine */ } return out; };
  }
  if (typeof showPanel === 'function') {
    var __sp = showPanel;
    showPanel = function (id) { var out = __sp.apply(this, arguments); try { if (id === 'hrcentre') { watch(); setTimeout(schedule, 500); } else A.on = false; } catch (e) { /* fine */ } return out; };
  }
  window.addEventListener('hashchange', function () { if (String(location.hash || '').indexOf('#hrcentre/analytics') === 0) { A.on = true; schedule(); } });

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var tb = t.closest('#w46body .w47tab');
    if (tb) { A.on = tb.getAttribute('data-w47v') === 'analytics'; setTimeout(function () { setShown(A.on); }, 0); return; }
    if (!t.closest('#w181') && !t.closest('.w181sheet')) return;
    var b = t.closest('[data-w181]');
    if (b) {
      var k = b.getAttribute('data-w181');
      if (k === 'reload') { A.err = ''; paint(); load(true).then(paint); }
      else if (k === 'csv') downloadCsv();
      else if (k === 'import') openImport();
      else if (k === 'doimport') doImport();
      else if (k === 'close' && typeof closeModal === 'function') closeModal();
      return;
    }
    var f = t.closest('[data-w181f]'); if (f) { A.f = f.getAttribute('data-w181f'); repaintPeople(); return; }
    var sv = t.closest('[data-w181save]'); if (sv) { saveLink(sv.getAttribute('data-w181save')); return; }
    var p = t.closest('[data-w181p]'); if (p) { openPerson(p.getAttribute('data-w181p')); return; }
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target; if (!t || !t.closest || (e.key !== 'Enter' && e.key !== ' ')) return;
    var p = t.closest('#w181 tr[data-w181p]'); if (p) { e.preventDefault(); openPerson(p.getAttribute('data-w181p')); }
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || t.id !== 'w181q') return;
    A.q = t.value; repaintPeople(); var q = document.getElementById('w181q'); if (q) { q.focus(); try { q.setSelectionRange(q.value.length, q.value.length); } catch (e2) { /* fine */ } }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t) return;
    if (t.id === 'w181team') { A.team = t.value; repaintPeople(); }
    else if (t.id === 'w181sort') { A.sort = t.value; repaintPeople(); }
    else if (t.id === 'w181file') readImportFile(t.files && t.files[0]);
  });

  /* ---------- the tour ---------- */
  function addTour() {
    try {
      var TT = window.w122 && window.w122.tours; if (!TT || !TT.hrcentre || TT.hrcentre.__w181) return;
      var st = TT.hrcentre.steps, i = -1;
      st.forEach(function (s, k) { if (s.s === '#w46body .w47tabs || #w153rail .w153sec') { i = k; s.p = 'People, Onboarding, Training, Recruitment, Commitment, Policies, Discipline and, for HR and admins, Analytics. On a computer they are in the menu on the left.'; } });
      st.splice(i >= 0 ? i + 1 : st.length, 0, { s: '#w181 .w181tiles || #w46body .w47tab[data-w47v="analytics"] || #w153rail .w153it[href="#hrcentre/analytics"]', t: 'Analytics', p: 'For HR and admins: who has been part of Welfare Avenue and for how long, from the roster and Slack. The team over time, each fiscal year (joined, left, joiners still here), how long people stay, Worth a look (where the roster and Slack disagree), everyone with their start and leaving dates, and Import a new Slack export.', opt: 1 });
      TT.hrcentre.__w181 = true;
    } catch (e) { /* fine */ }
  }
  addTour(); setTimeout(addTour, 1500);

  window.w181 = { state: function () { return A; }, load: load, paint: paint, can: canSee, stats: stats, series: series, byFy: byFy, look: look, parse: fromExport, windowFromName: windowFromName };
})();
