
  /* ---------- onboarding actions ---------- */
  async function afterChange() {
    var res = await evaluate({ celebrate: true });
    if (res && res.fresh && res.fresh.length) celebrate(null, res);
    paint();
  }
  function toggleHub(id) {
    var api = window.w112Api; if (!api) return;
    var on = !api.done(id);
    if (api.set(id, on) === false) { toastS('One moment, the checklist is still loading'); return; }
    setTimeout(afterChange, 30);
  }
  function hubGo(id) { var api = window.w112Api; if (api && api.go) { try { api.go(id); } catch (e) { /* fine */ } } }
  async function signPolicy(key, btn) {
    var m = me(); if (!m.email) return;
    if (btn) btn.disabled = true;
    try {
      var r = await db.from('wa_policy_signoffs').insert({ email: m.email, name: m.full || m.name, policy_key: key });
      if (r && r.error && !/duplicate|unique/i.test(String(r.error.message || ''))) throw r.error;
      A.signs[key] = nowIso();
      ['w105sign', 'w105signt'].forEach(function (id) { var el = document.getElementById(id); if (el) el.remove(); });
      toastS('Sign-off recorded, thank you');
      afterChange();
    } catch (e) { if (btn) btn.disabled = false; toastS('Could not record the sign-off'); }
  }
  async function ackStep(el) {
    var g = orgState(); if (!g.has) return;
    var tid = el.getAttribute('data-w122ack'), up = el.getAttribute('data-up');
    el.disabled = true;
    try {
      var r = await db.from('onboarding_update_acks').insert({ onboarding_id: Number(g.o.id), template_id: tid, template_updated_at: up, acked_by: (typeof who === 'function') ? who() : me().name });
      if (r && r.error) throw r.error;
      A.acks[String(tid)] = up; toastS('Noted, thanks'); paint();
    } catch (e) { el.disabled = false; toastS('Could not save the confirmation'); }
  }
  var onbQ = null;
  function onbRefresh() {
    clearTimeout(onbQ);
    onbQ = setTimeout(function () {
      if (R && R.mode === 'onb') { var sh = document.querySelector('#w122sheet .sh'); var main = sh && sh.querySelector('.main'); var top = main ? main.scrollTop : 0; renderSheet(); var m2 = document.querySelector('#w122sheet .main'); if (m2) m2.scrollTop = top; }
      afterChange();
    }, 700);
  }

  /* ---------- the Academy card on person pages ---------- */
  function personKey() { var m = decodeURIComponent(location.hash || '').match(/^#person\/(.+)$/); return m ? m[1] : null; }
  function personOf(key) {
    var pp = people(), k = String(key).toLowerCase();
    return pp.filter(function (p) { return String(p.id) === String(key); })[0] || pp.filter(function (p) { return String(p.name).toLowerCase() === k || String(p.email || '').toLowerCase() === k; })[0] || null;
  }
  function paintPerson() {
    var host = document.getElementById('w116kright'); if (!host || !staffOk()) return;
    var key = personKey(); if (!key) return;
    var p = personOf(key); if (!p) return;
    if (!A.loaded) { load().then(paintPerson); return; }
    var n = String(p.name).toLowerCase(), isMe = n === me().name.toLowerCase();
    var rows = A.prog.filter(function (r) { return String(r.person_name).toLowerCase() === n && A.byId[String(r.training_id)]; });
    var done = rows.filter(function (r) { return r.status === 'done'; }).sort(function (a, b) { return String(b.done_at || '').localeCompare(String(a.done_at || '')); });
    var todo = rows.filter(function (r) { return r.status !== 'done' && r.assigned_by; });
    var aw = A.awards.filter(function (a) { return String(a.person_name).toLowerCase() === n; });
    var certs = aw.filter(function (a) { return a.kind === 'cert'; }), badges = aw.filter(function (a) { return a.kind === 'badge'; });
    var lvN = aw.filter(function (a) { return a.kind === 'level'; }).reduce(function (mx, a) { return Math.max(mx, Number((a.meta || {}).n) || 0); }, 1), lvName = LEVELS[Math.max(0, lvN - 1)][1], lvPct = 0;
    if (isMe) { var s = stats(); lvN = s.level.n; lvName = s.level.name; lvPct = s.level.pct; }
    var sig = key + '|' + done.length + '|' + todo.length + '|' + aw.length + '|' + lvN;
    var cur = document.getElementById('w122pk');
    if (cur && cur.getAttribute('data-k') === sig && cur.parentNode === host) return;
    var html = '<div class="w116card" id="w122pk" data-k="' + E(sig) + '"><h3>Academy <a class="lnk" href="#training">' + (isMe ? 'open' : 'the academy') + '</a></h3>' +
      '<div class="lvrow"><div class="rg">' + ring(isMe ? lvPct : 100, 58, 6, GOLD, 'rgba(16,63,57,.08)') + '<b>' + lvN + '</b></div><div class="tx"><b>Level ' + lvN + ' &middot; ' + E(lvName) + '</b><span>' + plural(done.length, 'training') + ' completed' + (todo.length ? ' &middot; ' + todo.length + ' assigned' : '') + '</span></div></div>' +
      (certs.length ? '<div class="chips">' + certs.map(function (c) { return '<span class="chip">' + ic('seal') + E(c.title) + '</span>'; }).join('') + '</div>' : '') +
      (badges.length ? '<div class="bdgs">' + badges.map(function (b) { var v = awardVisual(b); return '<i title="' + E(b.title) + '" style="background:linear-gradient(135deg,' + v.color + ',' + shade(v.color) + ')">' + ic(v.icon) + '</i>'; }).join('') + '</div>' : '') +
      '<div class="ln">' + (done.length ? 'Last completed: ' + E(String(A.byId[String(done[0].training_id)].title).replace(/^Page tour:\s*/, 'Tour: ')) + (done[0].done_at ? ', ' + E(fmtShort(done[0].done_at)) : '') : 'Nothing completed yet.') + '</div></div>';
    var tmp = document.createElement('div'); tmp.innerHTML = html; var card = tmp.firstChild;
    if (cur) cur.remove();
    var tr = document.getElementById('w116ktrain');
    if (tr && tr.parentNode === host) { tr.classList.add('w122hid'); host.insertBefore(card, tr.nextSibling); } else host.appendChild(card);
  }
  var personQ = null;
  function personSoon() { if (personQ) return; personQ = setTimeout(function () { personQ = null; try { paintPerson(); } catch (e) { /* non-fatal */ } }, 450); }
  function watchPerson() {
    var pg = document.getElementById('personpage');
    if (!pg || pg.getAttribute('data-w122mo')) return;
    pg.setAttribute('data-w122mo', '1');
    new MutationObserver(function () { if (personKey()) personSoon(); }).observe(pg, { childList: true, subtree: true });
  }

  /* ---------- mounting and routing ---------- */
  function classic() { return lsGet('w122classic') === '1'; }
  function classicBar(p) {
    if (document.getElementById('w122cbar')) return;
    var b = document.createElement('div'); b.id = 'w122cbar';
    b.innerHTML = ic('sparkle') + '<span>This is the classic Training page.</span><span style="flex:1"></span><button class="w122btn sm" data-w122classic="0">Back to the Training academy</button>';
    p.insertBefore(b, p.firstChild);
  }
  function mount() {
    var p = document.getElementById('training'); if (!p) return;
    var root = document.getElementById('w122');
    if (!root) { root = document.createElement('div'); root.id = 'w122'; p.insertBefore(root, p.firstChild); }
    else if (root.parentNode !== p) p.insertBefore(root, p.firstChild);
    if (classic()) { p.classList.remove('w122on'); classicBar(p); return; }
    p.classList.add('w122on');
    var cb = document.getElementById('w122cbar'); if (cb) cb.remove();
    paint();
    if (A.loaded && Date.now() - A.loaded > 90000) load(true).then(paint);
    if (A.loaded) after();
  }
  function parseHash() { var h = decodeURIComponent(location.hash || '').replace(/^#/, ''); if (h !== 'training' && h.indexOf('training/') !== 0) return null; var p = h.split('/'); return { sub: p[1] || '', arg: p.slice(2).join('/') }; }
  function route() {
    var r = parseHash();
    if (!r) { if (sheetOpen()) closeSheet(true); return false; }
    if (!document.getElementById('training') || !staffOk()) return false;
    var act = document.querySelector('.panel.active');
    if (!act || act.id !== 'training') { try { showPanel('training'); } catch (e) { /* fine */ } }
    mount();
    var go = function () {
      if (classic() && r.sub) { lsSet('w122classic', null); mount(); }
      if (r.sub === 't' && r.arg) { if (!R || !R.t || String(R.t.id) !== String(r.arg) || R.mode !== 'view') openTraining(r.arg); }
      else if (r.sub === 'p' && r.arg) openPath(r.arg);
      else if (r.sub === 'tour' && r.arg) { try { history.replaceState(null, '', '#training'); } catch (e) { /* fine */ } startTour(r.arg); }
      else if (r.sub === 'cert' && r.arg) openCert(r.arg);
      else if (r.sub === 'onboarding') openOnb();
      else if (r.sub === 'sopnew') { try { history.replaceState(null, '', '#training'); } catch (e) { /* fine */ } openSopForm(null, r.arg || me().dept || ''); }
      else if (r.sub === 'sops') { if (sheetOpen()) closeSheet(true); setTimeout(function () { var sec = document.querySelector('#w122 [data-sec="sops"]'); if (sec) sec.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); }, 80); }
      else if (sheetOpen()) closeSheet(true);
    };
    if (A.loaded) go(); else load().then(function () { paint(); after(); go(); });
    return true;
  }
  window.addEventListener('hashchange', function () { try { route(); } catch (e) { /* non-fatal */ } try { if (personKey()) { watchPerson(); personSoon(); } } catch (e) { /* fine */ } });
  if (typeof applyHash === 'function') {
    var __ah122 = applyHash;
    applyHash = function () { var r = parseHash(); if (r && r.sub && route()) return; return __ah122.apply(this, arguments); };
  }
  if (typeof showPanel === 'function') {
    var __sp122 = showPanel;
    showPanel = function (id) {
      var out = __sp122.apply(this, arguments);
      try { if (id === 'training') setTimeout(mount, 0); else if (id === 'personpage') { setTimeout(function () { watchPerson(); personSoon(); }, 300); } } catch (e) { /* non-fatal */ }
      return out;
    };
  }
  if (typeof startApp === 'function') {
    var __sa122 = startApp;
    startApp = async function () {
      var out = await __sa122.apply(this, arguments);
      try { if (parseHash()) route(); if (personKey()) { watchPerson(); personSoon(); } } catch (e) { /* non-fatal */ }
      return out;
    };
  }

  /* ---------- events ---------- */
  var libQ = null, aQ = null;
  function paintLib() { var g = document.getElementById('w122libgrid'); if (g) g.innerHTML = libGridHtml(); }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var el;
    if ((el = t.closest('#w122cel [data-w122celx]'))) { closeCel(); return; }
    if ((el = t.closest('[data-w122celcert]'))) { var ca = el.getAttribute('data-w122celcert'); closeCel(); location.hash = '#training/cert/' + encodeURIComponent(ca); return; }
    if ((el = t.closest('[data-w122celnext]'))) { var cn = el.getAttribute('data-w122celnext'); closeCel(); location.hash = '#training/t/' + cn; return; }
    if ((el = t.closest('[data-w122celhome]'))) { closeCel(); location.hash = '#training'; return; }
    if ((el = t.closest('.w122tp [data-w122tnext]'))) { if (T && !T.busy) showStep(T.i + 1, 1); return; }
    if ((el = t.closest('.w122tp [data-w122tprev]'))) { if (T && !T.busy) showStep(T.i - 1, -1); return; }
    if ((el = t.closest('.w122tp [data-w122tx]'))) { endTour(false); return; }
    if ((el = t.closest('[data-w122tour]'))) { e.preventDefault(); startTour(el.getAttribute('data-w122tour')); return; }
    if ((el = t.closest('[data-w122starttour]'))) { startTour(el.getAttribute('data-w122starttour')); return; }
    if ((el = t.closest('[data-w122cert]'))) { location.hash = '#training/cert/' + encodeURIComponent(el.getAttribute('data-w122cert')); return; }
    var inSheet = !!t.closest('#w122sheet'), inRoot = !!t.closest('#w122');
    if (inRoot || inSheet) {
      if ((el = t.closest('[data-w122open]'))) { location.hash = '#training/t/' + el.getAttribute('data-w122open'); return; }
      if ((el = t.closest('[data-w122path]'))) { location.hash = '#training/p/' + el.getAttribute('data-w122path'); return; }
      if ((el = t.closest('[data-w122onbopen]'))) { location.hash = '#training/onboarding'; return; }
      if ((el = t.closest('[data-w122onbx]'))) { A.ui.onbOpen = el.getAttribute('data-w122onbx') === '1'; paint(); return; }
      if ((el = t.closest('[data-w122hub]'))) { toggleHub(el.getAttribute('data-w122hub')); return; }
      if ((el = t.closest('[data-w122hubgo]'))) { hubGo(el.getAttribute('data-w122hubgo')); return; }
      if ((el = t.closest('[data-w122sign]'))) { signPolicy(el.getAttribute('data-w122sign'), el); return; }
      if ((el = t.closest('[data-w122ack]'))) { ackStep(el); return; }
      if ((el = t.closest('[data-w122kind]'))) { A.ui.kind = el.getAttribute('data-w122kind'); A.ui.libN = 24; paint(); return; }
      if ((el = t.closest('[data-w122more]'))) { A.ui.libN += 24; paintLib(); return; }
      if ((el = t.closest('[data-w122add]'))) { openForm(null); return; }
      if ((el = t.closest('[data-w122welcomex]'))) { lsSet('w122welcome:' + me().email, '1'); A.welcome = 0; paint(); return; }
      if ((el = t.closest('[data-w122goto]'))) { lsSet('w122welcome:' + me().email, '1'); A.welcome = 0; paint(); var sec = document.querySelector('#w122 [data-sec="' + el.getAttribute('data-w122goto') + '"]'); if (sec) sec.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); return; }
      if ((el = t.closest('[data-w122reload]'))) { A.loaded = 0; load(true).then(paint); return; }
    }
    if ((el = t.closest('[data-w122classic]'))) {
      var on = el.getAttribute('data-w122classic') === '1';
      lsSet('w122classic', on ? '1' : null); mount();
      if (on) { try { if (typeof wa36Render === 'function') wa36Render(); } catch (x) { /* fine */ } window.scrollTo({ top: 0 }); }
      return;
    }
    if (!inSheet) return;
    if ((el = t.closest('[data-w122x]'))) { closeSheet(); return; }
    if ((el = t.closest('[data-w122pitem]'))) { location.hash = '#training/t/' + el.getAttribute('data-w122pitem'); return; }
    if (!R) return;
    if ((el = t.closest('[data-w122ch]'))) {
      var nch = Number(el.getAttribute('data-w122ch')), chs = lessonBody(R.t).chapters || [];
      R.ch = Math.max(0, Math.min(chs.length, nch));
      if (R.ch < chs.length) { markSeen(R.t, R.ch); R.quiz = null; }
      renderSheet(); return;
    }
    if ((el = t.closest('[data-w122done]'))) { el.disabled = true; complete(R.t); return; }
    if ((el = t.closest('[data-w122undone]'))) { saveProg(R.t, { status: (mine(R.t.id) || {}).assigned_by ? 'assigned' : 'started', done_at: null, pct: 50 }).then(function () { renderSheet(); paintSoon(); }); return; }
    if ((el = t.closest('[data-w122opt]'))) { if (R.quiz && R.quiz.picks[R.quiz.i] == null) { R.quiz.picks[R.quiz.i] = Number(el.getAttribute('data-w122opt')); renderSheet(); } return; }
    if ((el = t.closest('[data-w122qnext]'))) { if (R.quiz) { R.quiz.i++; renderSheet(); } return; }
    if ((el = t.closest('[data-w122qretry]'))) { var rr = mine(R.t.id) || {}; var dd = Object.assign({}, rr.data || {}); dd.quizTries = (Number(dd.quizTries) || 0) + 1; saveProg(R.t, { data: dd }); R.quiz = null; renderSheet(); return; }
    if ((el = t.closest('[data-w122qfinish]'))) {
      var sc = Number(el.getAttribute('data-w122qfinish')); var r0 = mine(R.t.id) || {}; var d0 = Object.assign({}, r0.data || {}); d0.quizTries = (Number(d0.quizTries) || 0) + 1;
      var bdy = lessonBody(R.t); d0.seen = (bdy.chapters || []).map(function (c) { return c.id; });
      el.disabled = true; complete(R.t, { score: sc, data: d0 }); return;
    }
    if ((el = t.closest('[data-w122a8]'))) { var card = el.closest('.a8'); if (card) card.classList.toggle('open'); return; }
    if ((el = t.closest('[data-w122preview]'))) { R.preview = !R.preview; renderSheet(); return; }
    if ((el = t.closest('[data-w122assign]'))) { R.mode = 'assign'; R.pick = {}; R.q = ''; renderSheet(); return; }
    if ((el = t.closest('[data-w122assignx]'))) { R.mode = 'view'; renderSheet(); return; }
    if ((el = t.closest('[data-w122assigngo]'))) { el.disabled = true; doAssign(); return; }
    if ((el = t.closest('[data-w122edit]'))) { openForm(R.t); return; }
    if ((el = t.closest('[data-w122save]'))) { saveForm(); return; }
    if ((el = t.closest('[data-w122retire]'))) { if (window.confirm('Retire this training? It disappears from the academy, and progress already recorded is kept.')) retire(); return; }
    if ((el = t.closest('[data-w122share]'))) { shareAward(el.getAttribute('data-w122share')); return; }
    if ((el = t.closest('[data-w122print]'))) { printCert(el.getAttribute('data-w122print')); return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.getAttribute) return;
    if (t.getAttribute('data-w122cat')) { A.ui.cat = t.value; A.ui.libN = 24; paint(); return; }
    if (t.getAttribute('data-w122pick') && R) { R.pick = R.pick || {}; R.pick[t.getAttribute('data-w122pick')] = t.checked; var b = document.querySelector('#w122sheet [data-w122assigngo]'); if (b) b.innerHTML = ic('check') + ' Assign to ' + Object.keys(R.pick).filter(function (k) { return R.pick[k]; }).length; return; }
    if (t.getAttribute('data-w37chk') && t.closest && t.closest('#w122sheet')) { onbRefresh(); return; }
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || !t.getAttribute) return;
    if (t.getAttribute('data-w122q')) { A.ui.q = t.value; A.ui.libN = 24; clearTimeout(libQ); libQ = setTimeout(paintLib, 140); return; }
    if (t.getAttribute('data-w122aq') && R) { R.q = t.value; clearTimeout(aQ); aQ = setTimeout(function () { if (!R || R.mode !== 'assign') return; renderSheet(); var i = document.querySelector('#w122sheet [data-w122aq]'); if (i) { i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch (x) { /* fine */ } } }, 160); return; }
  });
  document.addEventListener('keydown', function (e) {
    if (document.getElementById('w122cel')) { if (e.key === 'Escape') { closeCel(); e.preventDefault(); } return; }
    if (T) {
      if (e.key === 'Escape') { endTour(false); e.preventDefault(); return; }
      if (T.busy) return;
      if (e.key === 'ArrowRight' || (e.key === 'Enter' && !(e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)))) { showStep(T.i + 1, 1); e.preventDefault(); return; }
      if (e.key === 'ArrowLeft') { showStep(T.i - 1, -1); e.preventDefault(); return; }
      return;
    }
    if (sheetOpen() && e.key === 'Escape') { closeSheet(); e.preventDefault(); }
  });

  /* ---------- for the harness ---------- */
  window.w122 = {
    A: A, tours: TOURS, badges: BADGES, levels: LEVELS,
    state: function () { return { R: R, T: T }; },
    load: load, paint: paint, stats: stats, evaluate: evaluate, levelOf: levelOf, resolveStep: resolveStep,
    startTour: startTour, endTour: endTour, openTraining: openTraining, complete: complete, tourAvail: tourAvail, kindOf: kindOf,
    sop: { html: sopHtml, form: openSopForm, card: injectSopCard, fund: sopFundLoad, body: sopBody, phasesIn: phasesIn, phasesOut: phasesOut }
  };
})();
