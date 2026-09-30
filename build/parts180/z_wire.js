  /* ---------- voting on a poll ---------- */
  function vote(id, picks) {
    var a = byId(id); if (!a) return;
    S.busy['v' + id] = 1; delete S.errs[id]; repaint(id);
    answer(id, { choice: picks }).then(function () {
      S.busy['v' + id] = 0; delete S.sel[id]; repaint(id); T('Thanks, your answer is in');
    }, function (e) { S.busy['v' + id] = 0; S.errs[id] = e.message; repaint(id); });
  }

  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var el, id;
    /* What's new on the Executive dashboard posts through the same form */
    if (t.closest('#w116news [data-anpost]')) { e.preventDefault(); e.stopPropagation(); openPost(); return; }
    if ((el = t.closest('[data-w180post]'))) { e.preventDefault(); openPost(); return; }
    if ((el = t.closest('[data-w180all]'))) { e.preventDefault(); openAll(); return; }
    if ((el = t.closest('[data-w180open]'))) { e.preventDefault(); openItem(el.getAttribute('data-w180open')); return; }
    if ((el = t.closest('[data-w180res]'))) { e.preventDefault(); id = el.getAttribute('data-w180res'); var ar = byId(id); if (ar) openResults(ar); return; }
    if ((el = t.closest('[data-w180form]'))) { e.preventDefault(); id = el.getAttribute('data-w180form'); var af = byId(id); if (af) openForm(af); return; }
    if ((el = t.closest('[data-w180close]'))) { e.preventDefault(); closeModal(); return; }
    if ((el = t.closest('[data-w180vote]'))) {
      e.preventDefault(); id = el.getAttribute('data-w180vote'); var a = byId(id); if (!a || S.busy['v' + id]) return;
      var i = Number(el.getAttribute('data-i'));
      if (a.ask.multi) {
        var s = S.sel[id] || (S.sel[id] = { edit: !!S.mine[id], picks: ((S.mine[id] && S.mine[id].choice) || []).slice() });
        var k = s.picks.indexOf(i); if (k >= 0) s.picks.splice(k, 1); else s.picks.push(i);
        repaint(id); return;
      }
      vote(id, [i]); return;
    }
    if ((el = t.closest('[data-w180send]'))) { e.preventDefault(); id = el.getAttribute('data-w180send'); var sp = S.sel[id]; if (sp && sp.picks.length) vote(id, sp.picks.slice().sort(function (x, y) { return x - y; })); return; }
    if ((el = t.closest('[data-w180change]'))) { e.preventDefault(); id = el.getAttribute('data-w180change'); S.sel[id] = { edit: true, picks: ((S.mine[id] && S.mine[id].choice) || []).slice() }; repaint(id); return; }
    if ((el = t.closest('[data-w180keep]'))) { e.preventDefault(); id = el.getAttribute('data-w180keep'); delete S.sel[id]; repaint(id); return; }
    /* a short form's choices */
    if ((el = t.closest('[data-w180pick]'))) {
      e.preventDefault(); var qid = el.getAttribute('data-w180pick'), ix = Number(el.getAttribute('data-i')), multi = el.getAttribute('data-multi') === '1';
      var af2 = byId(S.formId), qq = af2 && af2.ask && (af2.ask.questions || []).filter(function (x) { return x.id === qid; })[0]; if (!qq) return;
      S.formAns = S.formAns || {};
      if (qq.type === 'yesno') S.formAns[qid] = S.formAns[qid] === (ix === 0) ? undefined : (ix === 0);
      else if (multi) { var cur = Array.isArray(S.formAns[qid]) ? S.formAns[qid] : []; var kk = cur.indexOf(ix); if (kk >= 0) cur.splice(kk, 1); else cur.push(ix); S.formAns[qid] = cur.sort(function (x, y) { return x - y; }); }
      else S.formAns[qid] = S.formAns[qid] === ix ? undefined : ix;
      var fe = document.querySelector('#modalBox [data-w180ferr]'); if (fe) fe.hidden = true;
      var grp = el.parentNode, val = S.formAns[qid];
      Array.prototype.forEach.call(grp.querySelectorAll('[data-w180pick]'), function (b) {
        var j = Number(b.getAttribute('data-i')), on = qq.type === 'yesno' ? (val === true && j === 0) || (val === false && j === 1) : Array.isArray(val) ? val.indexOf(j) >= 0 : val === j;
        b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      return;
    }
    /* the answers window */
    if ((el = t.closest('[data-w180csv]'))) { e.preventDefault(); var ac = byId(el.getAttribute('data-w180csv')); if (ac) downloadCsv(ac); return; }
    if ((el = t.closest('[data-w180shut]'))) {
      e.preventDefault(); id = el.getAttribute('data-w180shut'); el.disabled = true;
      patch(id, { closes_at: new Date().toISOString() }).then(function (a2) { T('Answers are closed'); paintCard(); if (a2) openResults(a2); }, function (err) { el.disabled = false; T('Not closed: ' + err.message); });
      return;
    }
    if ((el = t.closest('[data-w180down]'))) {
      e.preventDefault(); id = el.getAttribute('data-w180down');
      if (!S.busy['down' + id]) { S.busy['down' + id] = 1; el.textContent = 'Press again to take it down'; setTimeout(function () { S.busy['down' + id] = 0; }, 6000); return; }
      S.busy['down' + id] = 0; el.disabled = true;
      patch(id, { expires_at: todayIso() }).then(function () { closeModal(); T('Taken down'); paintCard(); try { if (window.w116News && w116News.refresh) w116News.refresh(); } catch (x) { /* fine */ } }, function (err) { el.disabled = false; T('Not taken down: ' + err.message); });
      return;
    }
    /* the post form */
    if (!t.closest('#modalBox [data-w180postform]')) return;
    var d = S.draft; if (!d) return;
    if ((el = t.closest('[data-w180aud]'))) { e.preventDefault(); syncDraft(); d.audience = el.getAttribute('data-w180aud'); if (d.audience === 'teams' && !d.teams.length) { var own = postTeams(); if (own.length === 1) d.teams = [own[0]]; } redrawPost(); return; }
    if ((el = t.closest('[data-w180team]'))) { e.preventDefault(); syncDraft(); var tm = el.getAttribute('data-w180team'), ti = d.teams.indexOf(tm); if (ti >= 0) d.teams.splice(ti, 1); else d.teams.push(tm); redrawPost(); return; }
    if ((el = t.closest('[data-w180askt]'))) { e.preventDefault(); syncDraft(); d.ask = el.getAttribute('data-w180askt'); if (d.ask !== 'none' && !d.closes) d.closes = ''; redrawPost(d.ask === 'poll' ? '#w180pq' : d.ask === 'form' ? '[data-w180ql="0"]' : null); return; }
    if ((el = t.closest('[data-w180addopt]'))) { e.preventDefault(); syncDraft(); if (d.poll.options.length < 8) d.poll.options.push(''); redrawPost('[data-w180popt="' + (d.poll.options.length - 1) + '"]'); return; }
    if ((el = t.closest('[data-w180delopt]'))) { e.preventDefault(); syncDraft(); if (d.poll.options.length > 2) d.poll.options.splice(Number(el.getAttribute('data-w180delopt')), 1); redrawPost(); return; }
    if ((el = t.closest('[data-w180addq]'))) { e.preventDefault(); syncDraft(); if (d.form.questions.length < 8) d.form.questions.push({ id: 'q' + (d.form.questions.length + 1), label: '', type: 'short', required: false, options: '' }); redrawPost('[data-w180ql="' + (d.form.questions.length - 1) + '"]'); return; }
    if ((el = t.closest('[data-w180delq]'))) { e.preventDefault(); syncDraft(); if (d.form.questions.length > 1) d.form.questions.splice(Number(el.getAttribute('data-w180delq')), 1); redrawPost(); return; }
  }, true);
  document.addEventListener('input', function (e) {   /* a message about what is missing goes once they type */
    var t = e.target; if (!t || !t.closest) return;
    var f = t.closest('#modalBox [data-w180formbox], #modalBox [data-w180postform]'); if (!f) return;
    var er = f.querySelector('[data-w180ferr], [data-w180perr]'); if (er && !er.hidden) er.hidden = true;
  }, true);
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#modalBox [data-w180postform]')) return;
    var d = S.draft; if (!d) return;
    if (t.hasAttribute('data-w180qt')) { syncDraft(); var i = Number(t.getAttribute('data-w180qt')); if (d.form.questions[i]) d.form.questions[i].type = t.value; redrawPost((t.value === 'one' || t.value === 'several') ? '[data-w180qo="' + i + '"]' : null); return; }
    if (t.id === 'w180ps' || t.id === 'w180pem') { syncDraft(); redrawPost(); return; }
  }, true);
  document.addEventListener('submit', function (e) {
    var f = e.target; if (!f || !f.matches) return;
    if (f.matches('#modalBox [data-w180postform]')) { e.preventDefault(); submitPost(); return; }
    if (f.matches('#modalBox [data-w180formbox]')) { e.preventDefault(); submitForm(f.getAttribute('data-w180formbox')); return; }
  }, true);
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('#modalBox [data-w180open]')) { e.preventDefault(); openItem(e.target.getAttribute('data-w180open')); }
  });

  /* ---------- the windows share the Hub's modal: only this wave's are wide ---------- */
  if (typeof openModal === 'function') { var __om180 = openModal; openModal = function () { wide(false); return __om180.apply(this, arguments); }; }
  if (typeof closeModal === 'function') { var __cm180 = closeModal; closeModal = function () { wide(false); return __cm180.apply(this, arguments); }; }

  /* ---------- the address: #announce/<id> (the Slack post's link) and #announce/all open on Home ---------- */
  function hashId() { var m = /^#announce\/(\d+|all)$/.exec(location.hash || ''); return m ? m[1] : null; }
  function fromHash() {
    var id = hashId(); if (!id) return false;
    try { location.replace('#mypage'); } catch (e) { location.hash = '#mypage'; }   /* Home, where announcements live (fires the Hub's own routing) */
    setTimeout(function () { if (id === 'all') openAll(); else openItem(id); }, 350);
    return true;
  }
  window.addEventListener('hashchange', function () { try { fromHash(); } catch (e) { /* fine */ } });
  /* the email's (or Slack's) link through the sign-in: Google brings people back without the address, so this tab keeps it
     until the Hub opens (15 minutes at most) */
  function keepPending() { var id = hashId(); if (!id) return; try { sessionStorage.setItem('w180pend', JSON.stringify({ id: id, t: Date.now() })); } catch (e) { /* fine */ } }
  function takePending() {
    var v = null;
    try {
      var raw = sessionStorage.getItem('w180pend'); sessionStorage.removeItem('w180pend');
      var o = raw ? JSON.parse(raw) : null;
      var age = o ? Date.now() - Number(o.t || 0) : -1e12;
      if (o && /^(\d+|all)$/.test(String(o.id)) && age > -60000 && age < 15 * 60000) v = String(o.id);
    } catch (e) { /* fine */ }
    return v;
  }
  keepPending();

  /* ---------- Home: the card after every render ---------- */
  if (typeof renderMyPage === 'function') {
    var __rm180 = renderMyPage;
    renderMyPage = async function () {
      var r = await __rm180.apply(this, arguments);
      try { refreshCard(false); } catch (e) { /* non-fatal */ }
      return r;
    };
  }
  if (typeof wa40Load === 'function') {   /* the card redraws once the person's access is known */
    var __wl180 = wa40Load;
    wa40Load = async function () { var r = await __wl180.apply(this, arguments); try { if (S.list) paintCard(); } catch (e) { /* fine */ } return r; };
  }
  if (typeof startApp === 'function') {
    var __sa180 = startApp;
    startApp = async function () {
      var pend = hashId(), kept = takePending();
      if (pend) { try { history.replaceState(null, '', '#mypage'); } catch (e) { /* fine */ } }
      pend = pend || kept;
      var out = await __sa180.apply(this, arguments);
      try { addTour(); if (pend) setTimeout(function () { if (pend === 'all') openAll(); else openItem(pend); }, 600); } catch (e) { /* fine */ }
      return out;
    };
  }
  try {
    if (typeof db !== 'undefined' && db && db.auth) db.auth.onAuthStateChange(function (evt) { if (evt === 'SIGNED_OUT') { S.list = null; S.mine = {}; S.res = {}; S.sel = {}; S.draft = null; var c = document.getElementById('w180card'); if (c) c.remove(); } });
  } catch (e) { /* fine */ }

  /* ---------- the Home tour: a stop for the card ---------- */
  function addTour() {
    try {
      var TT = window.w122 && window.w122.tours; if (!TT || !TT.home || !TT.home.steps || TT.home.__w180) return;
      var hs = TT.home.steps, i = -1;
      hs.forEach(function (x, k) { if (x.s === '#mpBody .mp-chips') i = k; });
      hs.splice(i >= 0 ? i + 1 : Math.min(2, hs.length), 0, { s: '#w180card', t: 'Announcements', p: 'What your leaders, HR and the admins posted for you: news, and polls or short forms you answer right here (a tap for a poll). The totals show once you answer, when the poster shares them. Leaders, HR and admins post from here: it shows at the top of Home for the people it is for, goes once to Slack and is emailed to them.', opt: 1 });
      TT.home.__w180 = true;
    } catch (e) { /* fine */ }
  }
  addTour(); setTimeout(addTour, 1500);

  window.w180 = { refresh: refreshCard, open: openItem, all: openAll, post: openPost, state: function () { return S; } };
})();
