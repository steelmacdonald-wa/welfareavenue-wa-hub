  /* ---------- the reply tool, the team, the settings ---------- */
  function detail(x) { return S.D[x.gmail_id] || (S.D[x.gmail_id] = { stage: 'read', answers: {}, custom: {}, note: '' }); }
  function askQuestions(x) {
    var d = detail(x); d.stage = 'asking'; d.err = null; render();
    fn({ action: 'questions', gmail_id: x.gmail_id }).then(function (r) {
      d.gist = r.gist || ''; d.questions = Array.isArray(r.questions) ? r.questions : []; d.answers = {}; d.custom = {};
      d.stage = 'questions'; render();
      if (!d.questions.length && !d.note) makeDraft(x);
    }, function (e) { d.stage = 'read'; d.err = 'It could not read the email just now: ' + e.message; render(); });
  }
  function answersOf(d) {
    return (d.questions || []).map(function (qq, i) { var a = String(d.custom[i] || '').trim() || String(d.answers[i] || '').trim(); return a ? { q: qq.q, a: a } : null; }).filter(Boolean);
  }
  function makeDraft(x) {
    var d = detail(x); d.stage = 'drafting'; d.err = null; render();
    fn({ action: 'draft', gmail_id: x.gmail_id, answers: answersOf(d), note: String(d.note || '').trim() }).then(function (r) {
      d.draft = r.body || ''; d.notes = r.notes || []; d.brackets = r.brackets || []; d.framework = r.framework || null; d.warn = null; d.bracketOk = false; d.stage = 'draft'; render();
      var ta = document.getElementById('w170body'); if (ta) { try { ta.focus(); ta.setSelectionRange(0, 0); ta.scrollTop = 0; } catch (e) { /* fine */ } }
    }, function (e) { d.stage = 'questions'; d.err = 'The reply was not written: ' + e.message; render(); });
  }
  function saveDraft(x) {
    var d = detail(x), ta = document.getElementById('w170body'); if (ta) d.draft = ta.value;
    if (!String(d.draft || '').trim()) { d.err = 'The reply is empty.'; render(); return; }
    var open = String(d.draft).match(/\[[^\]\n]{1,80}\]/g);
    /* wave201: the [brackets] check stops the first press with a note right above the button (it used to sit under the buttons,
       so the press could look like it did nothing), and the button says what a second press does */
    if (open && open.length && !d.bracketOk) { d.bracketOk = true; d.err = null; d.warn = 'There ' + (open.length === 1 ? 'is' : 'are') + ' still ' + plural(open.length, 'part', 'parts') + ' in [brackets] to fill in: ' + open.slice(0, 3).join(', ') + '. Fill ' + (open.length === 1 ? 'it' : 'them') + ' in above, or press Save it with the [brackets] to keep ' + (open.length === 1 ? 'it' : 'them') + ' in the draft.'; render(); showActs(); return; }
    d.stage = 'saving'; d.err = null; d.warn = null; render();
    fn({ action: 'save_draft', gmail_id: x.gmail_id, body: d.draft, reply_all: !!d.replyAll }).then(function (r) {
      d.saved = r; d.stage = 'saved'; d.bracketOk = false; patchRow(x.gmail_id, { reply_state: 'drafted', draft_id: r.draft_id, thread_id: r.thread_id || x.thread_id, drafted_at: r.checked_at || new Date().toISOString() }); render(); paintCard();
      T(r.updated ? 'Your draft is updated in Gmail' : 'Saved in your Gmail drafts');
    }, function (e) { d.stage = 'draft'; d.err = 'The draft was not saved: ' + e.message; render(); showActs(); });
  }
  function showActs() { var b = document.querySelector('#w170sheet [data-w170save]'); if (b && b.scrollIntoView) { try { b.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { b.scrollIntoView(); } } }
  /* wave201: Your writing guide */
  function saveGuide() {
    var g = S.guide; if (!g || g.busy) return;
    var ta = document.getElementById('w170voice'); var text = ta ? ta.value : (g.draft != null ? g.draft : g.voice);
    g.busy = true; render();
    fn({ action: 'settings', voice: String(text || '') }).then(function () {
      return fn({ action: 'voice' }).then(function (r) { S.guide = { voice: r.voice || '', framework: r.framework || '', draft: null, open: true }; render(); T('Your writing guide is saved'); });
    }, function (e) { g.busy = false; render(); T('Not saved: ' + e.message); });
  }
  function nextItem() {
    var list = listFor(S.tab).filter(function (x) { return S.tab === 'reply' ? !x.reply_state : !x.team_state; });
    var i = list.map(function (x) { return x.gmail_id; }).indexOf(S.sel);
    var nx = list[i + 1] || list[0] || null;
    S.sel = nx && nx.gmail_id !== S.sel ? nx.gmail_id : (phone() ? null : (nx ? nx.gmail_id : null));
    if (phone()) S.sel = null;
    render(); ensureDetail();
  }
  function mark(x, what) {
    var patch = what === 'reply_done' ? { reply_state: 'done' } : what === 'reply_dismiss' ? { reply_state: 'dismissed' } : what === 'team_dismiss' ? { team_state: 'dismissed' } : {};
    fn({ action: 'done', gmail_id: x.gmail_id, what: what }).then(function () {
      patchRow(x.gmail_id, patch); T(what === 'team_dismiss' ? 'Kept with you' : 'Done'); nextItem(); paintCard();
    }, function (e) { T('Not saved: ' + e.message); });
  }
  function sendToTeam(x) {
    var d = detail(x); d.team = d.team || {};
    var tm = document.getElementById('w170team'), pe = document.getElementById('w170person'), ak = document.getElementById('w170ask');
    if (tm) d.team.team = tm.value; if (pe) d.team.person = pe.value; if (ak) d.team.ask = ak.value;
    if (!String(d.team.ask || '').trim()) { d.team.err = 'Say in one line what they should do.'; render(); return; }
    d.team.sending = true; d.team.err = null; render();
    fn({ action: 'to_team', gmail_id: x.gmail_id, team: d.team.team, ask: String(d.team.ask).trim(), person: d.team.person || null }).then(function (r) {
      d.team.sending = false; d.team.sent = r; patchRow(x.gmail_id, { team: d.team.team, team_state: 'sent', sent_mail_id: r.mail_id }); render(); paintCard();
      T('Sent to ' + (TEAMS[d.team.team] || 'the team') + (r.person ? ', for ' + r.person : ''));
    }, function (e) { d.team.sending = false; d.team.err = 'Not sent: ' + e.message; render(); });
  }
  function stopPoll() { if (S.poll) { clearInterval(S.poll); S.poll = null; } }
  function startSort(action) {
    if (S.poll) return;
    var before = (S.owner && S.owner.last_sort_at) || null, t0 = Date.now();
    fn({ action: action }).then(function (r) {
      if (r && (r.fresh != null || r.result)) { loadOwner(true).then(function () { return loadRows(true); }).then(function () { render(); paintCard(); T(r.result ? 'Sorted: ' + r.result : 'Sorted'); }); return; }
      S.poll = setInterval(function () {
        loadOwner(true).then(function (o) {
          var after = o && o.last_sort_at;
          if (after && after !== before) { stopPoll(); loadRows(true).then(function () { render(); paintCard(); T(o.last_error ? 'Sorting stopped: ' + o.last_error : 'Sorted: ' + (o.last_result || 'done')); }); }
          else if (Date.now() - t0 > 150000) { stopPoll(); render(); T('Still sorting: new mail shows up here in a minute'); }
        });
      }, 4000);
      render();
    }, function (e) { stopPoll(); render(); T('Sorting did not start: ' + e.message); });
  }
  function saveSettings() {
    var st = S.set; if (!st) return;
    S.busy.set = true; render();
    fn({ action: 'settings', auto_sort: !!st.auto, days_back: Number(st.days) || 3, label_notes: st.notes, archive_labels: st.archive, skip_senders: st.senders, skip_words: st.words }).then(function () {
      S.busy.set = false; S.set = null; return loadOwner(true).then(function () { render(); paintCard(); T('Saved'); });
    }, function (e) { S.busy.set = false; render(); T('Not saved: ' + e.message); });
  }
  function setHash(tab) { var h = '#mypage/inbox' + (tab && tab !== 'reply' ? '/' + tab : ''); if ((location.hash || '') !== h) { try { history.replaceState(null, '', h); } catch (e) { /* fine */ } } }

  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var el = t.closest('[data-w170open]');
    if (el) { e.preventDefault(); var tab0 = el.getAttribute('data-w170open') || 'reply'; try { history.pushState(null, '', '#mypage/inbox' + (tab0 !== 'reply' ? '/' + tab0 : '')); } catch (x0) { /* fine */ } openSheet(tab0); return; }
    if (!t.closest('#w170sheet')) return;
    var x = S.sel ? rowBy(S.sel) : null, v;
    if ((el = t.closest('[data-w170x]'))) { e.preventDefault(); closeSheet(); return; }
    if ((el = t.closest('[data-w170go]'))) { closeSheet(true); return; }
    if ((el = t.closest('[data-w170tab]'))) { e.preventDefault(); S.tab = el.getAttribute('data-w170tab'); S.showDone = false; var l = listFor(S.tab); S.sel = !phone() && l.length ? l[0].gmail_id : null; setHash(S.tab); render(); ensureDetail(); return; }
    if ((el = t.closest('[data-w170sel]'))) { e.preventDefault(); S.sel = el.getAttribute('data-w170sel'); render(); ensureDetail(); var m = document.querySelector('#w170sheet .w170main'); if (m) m.scrollTop = 0; return; }
    if ((el = t.closest('[data-w170back]'))) { e.preventDefault(); S.sel = null; render(); return; }
    if ((el = t.closest('[data-w170done]'))) { e.preventDefault(); S.showDone = !S.showDone; render(); return; }
    if ((el = t.closest('[data-w170sort]'))) { e.preventDefault(); startSort('sort'); return; }
    if ((el = t.closest('[data-w170retry]'))) { e.preventDefault(); startSort('retry'); return; }
    if ((el = t.closest('[data-w170relabels]'))) { e.preventDefault(); el.disabled = true; fn({ action: 'labels', refresh: true }).then(function () { S.set = null; return loadOwner(true); }).then(function () { render(); T('Your folders were read again'); }, function (err) { el.disabled = false; T('Not read: ' + err.message); }); return; }
    if ((el = t.closest('[data-w170saveset]'))) { e.preventDefault(); saveSettings(); return; }
    if ((el = t.closest('[data-w170saveguide]'))) { e.preventDefault(); saveGuide(); return; }
    if ((el = t.closest('.w170guide summary')) && S.guide) { S.guide.open = !el.parentNode.open; return; }
    if ((el = t.closest('[data-w170unlabel]'))) {
      e.preventDefault(); v = el.getAttribute('data-w170unlabel'); el.disabled = true;
      fn({ action: 'unlabel', gmail_id: v }).then(function () { patchRow(v, { label_id: null, label_name: null, labelled_at: null, archived: false }); render(); paintCard(); T('The label is off'); }, function (err) { el.disabled = false; T('Not changed: ' + err.message); });
      return;
    }
    if (!x) return;
    var d = detail(x);
    if ((el = t.closest('[data-w170help]'))) { e.preventDefault(); askQuestions(x); return; }
    if ((el = t.closest('[data-w170ans]'))) { e.preventDefault(); var i = Number(el.getAttribute('data-w170ans')); v = el.getAttribute('data-v'); d.answers[i] = d.answers[i] === v ? '' : v; if (d.answers[i]) d.custom[i] = ''; render(); return; }
    if ((el = t.closest('[data-w170draft]'))) { e.preventDefault(); var nt = document.getElementById('w170note'); if (nt) d.note = nt.value; makeDraft(x); return; }
    if ((el = t.closest('[data-w170reset]'))) { e.preventDefault(); d.stage = 'read'; d.err = null; render(); return; }
    if ((el = t.closest('[data-w170redraft]'))) { e.preventDefault(); makeDraft(x); return; }
    if ((el = t.closest('[data-w170change]'))) { e.preventDefault(); var tb = document.getElementById('w170body'); if (tb) d.draft = tb.value; d.stage = d.questions ? 'questions' : 'read'; d.err = null; render(); return; }
    if ((el = t.closest('[data-w170save]'))) { e.preventDefault(); saveDraft(x); return; }
    if ((el = t.closest('[data-w170next]'))) { e.preventDefault(); nextItem(); return; }
    if ((el = t.closest('[data-w170mark]'))) { e.preventDefault(); mark(x, el.getAttribute('data-w170mark')); return; }
    if ((el = t.closest('[data-w170suggest]'))) { e.preventDefault(); var tm = document.getElementById('w170team'); d.team = d.team || {}; d.team.ask = ''; suggestAsk(x, tm ? tm.value : (x.team || 'opsmtl')); return; }
    if ((el = t.closest('[data-w170send]'))) { e.preventDefault(); sendToTeam(x); return; }
  }, true);
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#w170sheet')) return;
    var x = S.sel ? rowBy(S.sel) : null, d = x ? detail(x) : null, st = S.set;
    if (d && t.hasAttribute('data-w170own')) { var i = Number(t.getAttribute('data-w170own')); d.custom[i] = t.value; if (t.value && d.answers[i]) { d.answers[i] = ''; Array.prototype.forEach.call(t.parentNode.querySelectorAll('[data-w170ans]'), function (b) { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); }); } return; }
    if (d && t.id === 'w170note') { d.note = t.value; return; }
    if (d && t.id === 'w170body') { d.draft = t.value; d.bracketOk = false; d.warn = null; return; }
    if (t.id === 'w170voice' && S.guide) { S.guide.draft = t.value; return; }
    if (d && t.id === 'w170ask') { d.team = d.team || {}; d.team.ask = t.value; return; }
    if (st && t.hasAttribute('data-w170lnote')) { st.notes[t.getAttribute('data-w170lnote')] = t.value; return; }
    if (st && t.id === 'w170snd') { st.senders = t.value; return; }
    if (st && t.id === 'w170wrd') { st.words = t.value; return; }
  }, true);
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#w170sheet')) return;
    var x = S.sel ? rowBy(S.sel) : null, d = x ? detail(x) : null, st = S.set;
    if (d && t.id === 'w170team') { d.team = d.team || {}; var ak = document.getElementById('w170ask'); if (ak) d.team.ask = ak.value; d.team.team = t.value; d.team.person = ''; render(); return; }
    if (d && t.id === 'w170person') { d.team = d.team || {}; d.team.person = t.value; return; }
    if (d && t.hasAttribute('data-w170all')) { d.replyAll = !!t.checked; return; }
    if (st && t.id === 'w170auto') { st.auto = !!t.checked; return; }
    if (st && t.id === 'w170days') { st.days = Number(t.value) || 3; return; }
    if (st && t.hasAttribute('data-w170arch')) { var id = t.getAttribute('data-w170arch'), k = st.archive.indexOf(id); if (t.checked && k < 0) st.archive.push(id); if (!t.checked && k >= 0) st.archive.splice(k, 1); return; }
  }, true);
  document.addEventListener('keydown', function (e) { if (S.open && e.key === 'Escape' && !e.defaultPrevented) { var tag = (e.target && e.target.tagName) || ''; if (tag !== 'TEXTAREA' && tag !== 'INPUT' && tag !== 'SELECT') { e.preventDefault(); closeSheet(); } } });

  /* ---------- the address: #mypage/inbox[/team|/sorted|/settings] opens it ---------- */
  function fromHash() {
    var h = location.hash || '', m = /^#mypage\/inbox(?:\/(reply|team|sorted|settings))?$/.exec(h);
    if (m) { var tab = m[1] || 'reply'; if (!S.open) openSheet(tab); else if (S.tab !== tab) { S.tab = tab; S.sel = null; render(); } return; }
    if (S.open) closeSheet(true);
  }
  window.addEventListener('hashchange', function () { try { fromHash(); } catch (e) { /* fine */ } });

  /* ---------- Home: the card after every render ---------- */
  if (typeof renderMyPage === 'function') {
    var __rm170 = renderMyPage;
    renderMyPage = async function () {
      var r = await __rm170.apply(this, arguments);
      try { refreshCard(false); } catch (e) { /* non-fatal */ }
      return r;
    };
  }
  if (typeof startApp === 'function') {
    var __sa170 = startApp;
    startApp = async function () {
      var out = await __sa170.apply(this, arguments);
      try { addTour(); if (/^#mypage\/inbox/.test(location.hash || '')) loadOwner(false).then(function () { fromHash(); }); } catch (e) { /* fine */ }
      return out;
    };
  }
  try {
    if (typeof db !== 'undefined' && db && db.auth) db.auth.onAuthStateChange(function (evt) { if (evt === 'SIGNED_OUT') { S.owner = null; S.rows = null; S.D = {}; closeSheet(true); var c = document.getElementById('w170card'); if (c) c.remove(); } });
  } catch (e) { /* fine */ }

  /* ---------- the Home tour: a stop for the card ---------- */
  function addTour() {
    try {
      var TT = window.w122 && window.w122.tours; if (!TT || !TT.home || !TT.home.steps || TT.home.__w170) return;
      var hs = TT.home.steps, i = -1;
      hs.forEach(function (x, k) { if (x.s === '#w166lead' || x.s === '#w112wrap') i = k; });
      hs.splice(i >= 0 ? i + 1 : Math.min(2, hs.length), 0, { s: '#w170card', t: 'Your inbox', p: 'For the people whose mailbox the assistant works on: your Welfare Avenue mail sorted into your own folders, what needs your reply (the reply tool asks what it needs, writes it in your voice and saves it as a Gmail draft) and what a team should handle (sent to the team’s Hub inbox with your one-line ask).', opt: 1 });
      TT.home.__w170 = true;
    } catch (e) { /* fine */ }
  }
  addTour(); setTimeout(addTour, 1500);

  window.w170 = { open: openSheet, close: closeSheet, refresh: refreshCard, state: function () { return S; } };
})();
