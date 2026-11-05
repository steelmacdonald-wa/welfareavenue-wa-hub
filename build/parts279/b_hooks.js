
/* ---------- wave279 Task 8: the policy reading timer and the HR board's Academy trainings count ----------
   window.wa279Pol: a required policy can be signed only 10 minutes (app_config policy_read_minutes) after it was first opened. The rule itself is
     the database's (trg_wa279_policy_read on wa_policy_signoffs); this is the page's side of it, shared by the three sign paths (Home's Set up
     your Hub in parts272/c_setup.js, the Academy's Onboarding in parts122/d_home.js, the classic training page's card in 105_wave105.seg).
     - A link with data-w279polopen="<key>" calls wa279_policy_open(key) when clicked; its {unlock_at} is kept.
     - wa279_policy_state() (the person's own opens) is read once, the first time a Sign button is drawn.
     - view(key, label, seen) says how a Sign button looks: "Sign in N min" (N = whole minutes left, rounded up) and disabled until unlock_at,
       then the page's own label. With no open recorded it is disabled, and the opens are read again when they are more than a minute old
       (an open on another device shows without a reload); they are also read again whenever the tab comes back into view. When the database could not say (the call failed or gave nothing),
       the page's old rule stands: enabled when seen (Home: opened in this tab; the Academy: always).
     - attrs(key, label, seen) marks the button (data-w279polsign) so refresh() can redraw it in place: after each answer, and every 30
       seconds while a counting button is on screen. When none is, the timer stops. A first draw asks for one redraw (0 ms) to start that
       timer; refresh() itself never asks again, so nothing else repeats.
   window.wa279Acad: "Academy trainings d of t" on each row of the HR centre's onboarding board (046_wave46.seg). t = the plan's steps that have a
     training_id or an academy_path (the policies step counts once), with the role steps (role60, role90) counted as their picks. d = the done
     ones: a step's own done flag; a pick is done when its Academy progress says so (or the whole role step is done). The picks are the role
     trainings' Academy assignments (note "Role training (60 days)" / "(90 days)", see wa279_pick_add), read in one query for every plan. */
(function () {
  if (window.wa279Pol) return;
  var P = { st: null, at: 0, load: null, fail: false, unk: {}, tick: null, soon: null };
  var TICK = 30000, STALE = 60000;
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function client() { try { return (typeof db !== 'undefined' && db && typeof db.rpc === 'function') ? db : null; } catch (e) { return null; } }
  function when(x) { var t = Date.parse(x); return isNaN(t) ? null : t; }
  function loadState() {
    if (P.load) return P.load;
    var d = client(); if (!d) { P.fail = true; return Promise.resolve(); }
    P.load = Promise.resolve(d.rpc('wa279_policy_state')).then(function (r) {
      if (!r || r.error || !r.data || typeof r.data !== 'object') throw (r && r.error) || new Error('no answer');
      var m = P.st || {};
      Object.keys(r.data).forEach(function (k) { var u = when(r.data[k] && r.data[k].unlock_at); if (u !== null) { m[k] = u; delete P.unk[k]; } });
      P.st = m; P.fail = false;
    }).catch(function () { P.fail = true; }).then(function () { P.load = null; P.at = Date.now(); refresh(); });
    return P.load;
  }
  function open(key) {
    var d = client(); if (!d || !key) return Promise.resolve();
    return Promise.resolve(d.rpc('wa279_policy_open', { p_key: key })).then(function (r) {
      var u = when(r && !r.error && r.data && r.data.unlock_at);
      if (u === null) throw (r && r.error) || new Error('no answer');
      P.st = P.st || {}; P.st[key] = u; delete P.unk[key];
    }).catch(function () { P.unk[key] = true; }).then(refresh);
  }
  /* minutes left (0 = unlocked), 'none' (no open recorded, or not known yet) or 'unknown' (the database could not say) */
  function left(key) {
    if (P.unk[key]) return 'unknown';
    if (P.st && Object.prototype.hasOwnProperty.call(P.st, key)) return Math.max(0, Math.ceil((P.st[key] - Date.now()) / 60000));
    if (P.fail) return 'unknown';
    return 'none';
  }
  /* inRefresh: called by refresh(), which must not ask for another redraw (the 30 second tick is the only timer that repeats) */
  function view(key, label, seen, inRefresh) {
    if (!P.load && !P.fail && (!P.st || (left(key) === 'none' && Date.now() - P.at > STALE))) loadState();
    var n = left(key), v;
    if (typeof n === 'number') v = n > 0 ? { dis: true, txt: 'Sign in ' + n + ' min', wait: true } : { dis: false, txt: label };
    else if (n === 'unknown') v = { dis: !seen, txt: label };
    else v = { dis: true, txt: label };
    if (v.wait && !inRefresh) later();
    return v;
  }
  function attrs(key, label, seen) { return ' data-w279polsign="' + E(key) + '" data-w279ok="' + E(label) + '"' + (seen ? ' data-w279seen="1"' : ''); }
  function opened(key) { return typeof left(key) === 'number'; }
  function later() { if (!P.soon) P.soon = setTimeout(function () { P.soon = null; refresh(); }, 0); }
  function refresh() {
    var live = false, any = false;
    [].forEach.call(document.querySelectorAll('[data-w279polsign]'), function (b) {
      any = true;
      if (b.getAttribute('aria-busy') === 'true') return;
      var v = view(b.getAttribute('data-w279polsign'), b.getAttribute('data-w279ok') || 'Sign', b.getAttribute('data-w279seen') === '1', true);
      if (b.textContent !== v.txt) b.textContent = v.txt;
      b.disabled = v.dis;
      if (v.wait && b.getClientRects().length) live = true;
    });
    if (live && !P.tick) P.tick = setInterval(refresh, TICK);
    else if (!live && P.tick) { clearInterval(P.tick); P.tick = null; }
    /* wave130's "open it first" lock on the Academy and wave105 buttons looks again (it steps aside when the database keeps the opens) */
    if (any && window.w130 && typeof window.w130.paint === 'function') { try { window.w130.paint(); } catch (e) { /* fine */ } }
  }
  /* a refused sign-off: read the opens again, so the count is the database's */
  function reload() { if (P.load) return P.load; return loadState(); }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('[data-w279polopen]');
    if (a) open(a.getAttribute('data-w279polopen'));
  }, true);
  window.addEventListener('hashchange', function () { setTimeout(refresh, 400); });
  /* back in view: the opens may have changed on another device, so read them again (loadState redraws when they arrive) */
  document.addEventListener('visibilitychange', function () { if (document.visibilityState !== 'visible') return; refresh(); if (document.querySelector('[data-w279polsign]')) reload(); });
  window.wa279Pol = { view: view, attrs: attrs, opened: opened, open: open, refresh: refresh, reload: reload, left: left, ticking: function () { return !!P.tick; } };

  /* ---------- the HR board's Academy trainings count ---------- */
  var A = { picks: null, at: 0, load: null };
  var NOTE = { 'Role training (60 days)': 'role60', 'Role training (90 days)': 'role90' };
  function loadPicks() {
    if (A.load) return A.load;
    if (typeof db === 'undefined' || !db || typeof db.from !== 'function') return Promise.resolve();
    A.load = Promise.resolve(db.from('academy_assignments').select('id,training_id,member_ids,note,training_progress(status)')
      .eq('active', true).in('note', Object.keys(NOTE))).then(function (r) {
      if (r && r.error) throw r.error;
      var m = {};
      ((r && r.data) || []).forEach(function (a) {
        var k = NOTE[a.note]; if (!k) return;
        var done = (a.training_progress || []).some(function (p) { return p && p.status === 'done'; });
        (a.member_ids || []).forEach(function (mid) { var x = m[String(mid)] = m[String(mid)] || { role60: [], role90: [] }; x[k].push({ training_id: a.training_id, done: done }); });
      });
      A.picks = m;
    }).catch(function () { A.picks = A.picks || {}; }).then(function () { A.at = Date.now(); A.load = null; fill(); });
    return A.load;
  }
  function count(onbId) {
    var W = (typeof WA37 !== 'undefined' && WA37) || null; if (!W || !A.picks) return null;
    var onb = (W.onbs || []).filter(function (o) { return String(o.id) === String(onbId); })[0]; if (!onb) return null;
    var tpl = {}; (W.tmpl || []).forEach(function (t) { tpl[String(t.id)] = t; });
    var mine = A.picks[String(onb.member_id)] || { role60: [], role90: [] }, d = 0, t = 0;
    (W.steps || []).forEach(function (s) {
      if (String(s.onboarding_id) !== String(onbId)) return;
      var tp = tpl[String(s.template_id)]; if (!tp || !(tp.training_id || tp.academy_path)) return;
      if (tp.academy_path === 'role60' || tp.academy_path === 'role90') {
        var ps = mine[tp.academy_path] || [];
        t += ps.length; d += s.done ? ps.length : ps.filter(function (p) { return p.done; }).length;
        return;
      }
      t++; if (s.done) d++;
    });
    return { done: d, total: t };
  }
  function acadText(onbId) {
    if (!A.picks || Date.now() - A.at > 60000) loadPicks();
    var c = count(onbId);
    return c && c.total ? 'Academy trainings ' + c.done + ' of ' + c.total : '';
  }
  function fill() {
    [].forEach.call(document.querySelectorAll('[data-w279acad]'), function (el) { var t = acadText(el.getAttribute('data-w279acad')); if (el.textContent !== t) el.textContent = t; });
  }
  (function () {
    if (document.getElementById('w279hookcss')) return;
    var st = document.createElement('style'); st.id = 'w279hookcss';
    st.textContent = '[data-w279acad]:empty{display:none;}';
    document.head.appendChild(st);
  })();
  window.wa279Acad = { text: acadText, count: count, fill: fill, load: loadPicks };
})();
