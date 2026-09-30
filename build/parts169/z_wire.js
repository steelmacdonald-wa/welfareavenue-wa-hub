  /* ---------- the HR centre: one pass after it changes ---------- */
  var hrQ = null;
  function decorateHr() {
    var body = document.getElementById('w46body'); if (!body || !body.querySelector('.w46sec')) return;
    if (!canAssign()) return;
    if (!S.tr && !S.catP) loadCatalog().then(soonHr);
    if (!S.cfg && !S.cfgP) loadCfg().then(soonHr);
    try { decorateMaster(); } catch (e) { /* fine */ }
    try { decorateBoard(); } catch (e) { /* fine */ }
    try { paintCards(); } catch (e) { /* fine */ }
    var bk = body.querySelector('[data-w57bulk]'), bt = 'Assign trainings (everyone, teams or people)';
    if (bk && bk.textContent !== bt) bk.textContent = bt;
  }
  function soonHr() { clearTimeout(hrQ); hrQ = setTimeout(function () { try { decorateHr(); } catch (e) { /* fine */ } }, 120); }
  function watchHr() {
    var panel = document.getElementById('hrcentre'); if (!panel || panel.dataset.w169mo) return;
    panel.dataset.w169mo = '1';
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var t = muts[i].target;
        if (t && t.closest && (t.closest('.w169card') || t.closest('.w169see') || t.closest('.w169tt') || t.closest('.w169chips'))) continue;
        soonHr(); return;
      }
    }).observe(panel, { childList: true, subtree: true });
    soonHr();
  }
  watchHr();
  if (typeof startApp === 'function') {
    var __sa169 = startApp;
    startApp = async function () { var out = await __sa169.apply(this, arguments); try { watchHr(); addTours(); } catch (e) { /* fine */ } return out; };
  }

  /* ---------- clicks, typing and choices ---------- */
  function attr(el, a) { return el ? el.getAttribute(a) : null; }
  function stop(e) { e.preventDefault(); e.stopPropagation(); }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var el;
    if ((el = t.closest('[data-w169assign]'))) { stop(e); openAssign(attr(el, 'data-w169assign') || ''); return; }
    if ((el = t.closest('[data-w57bulk]')) && canAssign()) { stop(e); openAssign(''); return; }
    if ((el = t.closest('[data-w169week]'))) { stop(e); openWeek(attr(el, 'data-w169week')); return; }
    if ((el = t.closest('[data-w169preview]'))) { stop(e); preview(attr(el, 'data-w169preview')); return; }
    if ((el = t.closest('[data-w169pvx]'))) { stop(e); endPreview(true); return; }
    if ((el = t.closest('[data-w169mineall]'))) { stop(e); S.mineAll = !S.mineAll; try { w122.paint(); } catch (x) { /* fine */ } return; }
    if ((el = t.closest('[data-w169tv]'))) { stop(e); var tab = document.querySelector('#w46body .w47tab[data-w47v="' + attr(el, 'data-w169tv') + '"]'); if (tab) { tab.click(); try { tab.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (x) { /* fine */ } } return; }
    if ((el = t.closest('[data-w169who]'))) { stop(e); var id = attr(el, 'data-w169who'); S.open[id] = !S.open[id]; paintCards(); return; }
    if ((el = t.closest('[data-w169stopask]'))) { stop(e); S.sure = Number(attr(el, 'data-w169stopask')); paintCards(); return; }
    if ((el = t.closest('[data-w169keep]'))) { stop(e); S.sure = null; paintCards(); return; }
    if ((el = t.closest('[data-w169stop]'))) { stop(e); if (!el.dataset.busy) { el.dataset.busy = '1'; stopAssign(attr(el, 'data-w169stop')); } return; }
    /* the week editor */
    if (WK) {
      if ((el = t.closest('[data-w169pic]'))) {
        stop(e); readWeek();
        var p = (S.photos || []).filter(function (x) { return String(x.id) === String(attr(el, 'data-w169pic')); })[0];
        if (p) { WK.photoId = p.id; WK.photo = p.path_web; WK.fx = p.focal_x; WK.fy = p.focal_y; }
        Array.prototype.forEach.call(document.querySelectorAll('#modalBox [data-w169pic]'), function (b) { b.classList.toggle('on', b === el); });
        paintPart('w169wprev', weekPrev()); return;
      }
      if (t.closest('#w169wsave')) { stop(e); saveWeek(); return; }
      if (t.closest('#w169wx')) { stop(e); WK = null; lift(false); try { closeModal(); } catch (x) { /* fine */ } return; }
    }
    /* the assign form */
    if (AS) {
      if ((el = t.closest('[data-w169pick]'))) {
        stop(e); var v = attr(el, 'data-w169pick'), i = AS.picks.indexOf(v);
        if (i >= 0) AS.picks.splice(i, 1); else AS.picks.push(v);
        AS.err = ''; var er = document.getElementById('w169aerr'); if (er) er.hidden = true;
        paintPart('w169awh', itemsHtml()); paintSum(); return;
      }
      if ((el = t.closest('[data-w169unpick]'))) { stop(e); var u = AS.picks.indexOf(attr(el, 'data-w169unpick')); if (u >= 0) AS.picks.splice(u, 1); paintPart('w169awh', itemsHtml()); paintSum(); return; }
      if ((el = t.closest('[data-w169aud]'))) { stop(e); readForm(); AS.aud = attr(el, 'data-w169aud'); AS.err = ''; paintForm(); return; }
      if ((el = t.closest('[data-w169due]'))) { stop(e); readForm(); AS.due = attr(el, 'data-w169due') || ''; paintForm(); return; }
      if (t.closest('#w169ago')) { stop(e); submitAssign(); return; }
      if (t.closest('#w169ax')) { stop(e); closeForm(); return; }
    }
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = e.target; if (!t || !t.matches || !t.matches('[data-w169who],[data-w169stopask],[data-w169keep],[data-w169stop]')) return;
    e.preventDefault(); t.click();
  }, true);
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t) return;
    if (AS) {
      if (t.id === 'w169aq') { AS.q = t.value; paintPart('w169awh', itemsHtml()); var w = document.getElementById('w169awh'); if (w) w.scrollTop = 0; return; }
      if (t.id === 'w169apq') { AS.pq = t.value; paintPart('w169appl', peopleHtml()); return; }
      if (t.id === 'w169anote') { AS.note = t.value; return; }
    }
    if (WK && t.closest && t.closest('#modalBox') && (t.id === 'w169wt' || t.id === 'w169wy' || t.hasAttribute('data-w169learn'))) { readWeek(); paintPart('w169wprev', weekPrev()); }
  }, true);
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t) return;
    if (AS) {
      var k;
      if ((k = attr(t, 'data-w169team'))) { var i = AS.teams.indexOf(k); if (t.checked && i < 0) AS.teams.push(k); if (!t.checked && i >= 0) AS.teams.splice(i, 1); if (t.parentElement) t.parentElement.classList.toggle('on', t.checked); paintSum(); return; }
      if ((k = attr(t, 'data-w169person'))) { var j = AS.people.indexOf(k); if (t.checked && j < 0) AS.people.push(k); if (!t.checked && j >= 0) AS.people.splice(j, 1); if (t.parentElement) t.parentElement.classList.toggle('on', t.checked); paintSum(); return; }
      if (t.id === 'w169anew') { AS.include_new = !!t.checked; paintSum(); return; }
      if (t.id === 'w169adue') { readForm(); paintForm(true); return; }
    }
    if (WK && t.id === 'w169wl') readWeek();
  }, true);

  /* ---------- the tours ---------- */
  function addTours() {
    try {
      var TT = window.w122 && window.w122.tours; if (!TT) return;
      var put = function (tour, after, step, flag) {
        var x = TT[tour]; if (!x || x[flag]) return;
        var i = -1; x.steps.forEach(function (s, k) { if (s.s === after) i = k; });
        x.steps.splice(i >= 0 ? i + 1 : x.steps.length, 0, step); x[flag] = true;
      };
      put('hrcentre', '#w46body .w47tabs || #w153rail .w153sec', { s: '#w46body .w169bar', t: 'The onboarding people see', p: 'The master onboarding is the onboarding: each week says what people see for it in the Avenue Academy (its title, photo, goals, why it matters and the lesson that opens it), and Edit what people see changes it at once. Preview what a new person sees opens the journey as it looks on day one; Journey, next to each person on the board, shows theirs.', opt: 1 }, '__w169a');
      put('hrcentre', '#w46body .w169bar', { s: '#w169cardO || #w169cardT', t: 'Assign trainings to the organization', p: 'A module or a Learning Avenue for everyone, a team or a few people, with a due date and a note. It shows at the top of their Avenue Academy, and people who join later get it too. The Training view lists every assignment: who is done, on the way, late or not started, and Stop.', opt: 1 }, '__w169b');
      put('academy', '#w122 .w122onb', { s: '#w169mine', t: 'Assigned to you', p: 'Trainings your team asked you to take, with the due date, who asked and why. Late ones come first, and a finished one stays two weeks. HR and leaders assign from Assign a training at the top, or Assign on a module or a Learning Avenue.', opt: 1 }, '__w169c');
      var nx = TT.academy && TT.academy.steps ? TT.academy.steps.filter(function (s) { return s.s === '#w122 [data-sec="next"]'; })[0] : null;
      if (nx && /assigned to you/.test(nx.p)) nx.p = 'What you started, and what is recommended for you and your team.';
    } catch (e) { /* fine */ }
  }
  addTours(); setTimeout(addTours, 1500);

  window.w169 = { can: canAssign, homeHtml: homeHtml, banner: bannerHtml, preview: preview, endPreview: endPreview, openAssign: openAssign, openWeek: openWeek,
    decorate: decorateHr, cards: paintCards, sample: SAMPLE_ID, state: function () { return S; } };
})();
