
  /* ---------- wiring: typed text survives a repaint, the masthead line, the disclosure, the actions ---------- */
  function hold() {
    var root = document.getElementById('w277conn'); if (!root) return;
    var vals = {}, a = document.activeElement, focus = null;
    root.querySelectorAll('input[id^="w277"]').forEach(function (el) { if (el.value) vals[el.id] = el.value; });
    if (a && root.contains(a) && a.id) focus = { id: a.id, s: a.selectionStart, e: a.selectionEnd };
    else if (a && root.contains(a) && a.hasAttribute('data-w277row')) focus = { row: a.getAttribute('data-w277row') };
    S277.held = { vals: vals, focus: focus };
    Promise.resolve().then(restore);
  }
  function restore() {
    var h = S277.held; S277.held = null; if (!h) return;
    Object.keys(h.vals).forEach(function (id) { var el = document.getElementById(id); if (el && !el.value) el.value = h.vals[id]; });
    try {
      var f = h.focus, el = f && (f.id ? document.getElementById(f.id) : document.querySelector('#w277conn [data-w277row="' + f.row + '"]'));
      if (el && document.activeElement !== el) { el.focus(); if (f.id && f.s != null && el.setSelectionRange) el.setSelectionRange(f.s, f.e); }
    } catch (e) { /* fine */ }
  }
  function mastLine() {
    var m = document.querySelector('#studio > .w118mast p');
    if (m && m.textContent !== LINE_TEXT) m.textContent = LINE_TEXT;
  }
  function page() { hold(); var html = connectHtml(); Promise.resolve().then(mastLine); return html; }

  /* one disclosure open at a time; the DOM changes in place so the height can ease */
  function setOpen(k) {
    S277.open = k || null;
    document.querySelectorAll('#w277conn [data-w277row]').forEach(function (r) {
      var key = r.getAttribute('data-w277row'), on = key === S277.open, d = document.getElementById('w277d-' + key);
      r.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (d) { d.classList.toggle('open', on); var inn = d.firstElementChild; if (inn) { if (on) inn.removeAttribute('inert'); else inn.setAttribute('inert', ''); } }
    });
  }
  function toggle(k) { setOpen(S277.open === k ? null : k); }
  function focusId(id) { setTimeout(function () { var el = document.getElementById(id); if (el) try { el.focus(); } catch (e) { /* fine */ } }, 200); }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function clear(id) { var el = document.getElementById(id); if (el) el.value = ''; }
  function copy(t) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(function () { toastS('Copied'); }, function () { toastS('Could not copy. Select it and copy by hand.'); }); return; } } catch (e) { /* below */ }
    toastS('Could not copy. Select it and copy by hand.');
  }
  async function refresh() { await loadConn(); await loadCap(); paint(); }

  /* every action, the wave225 names too ('save_app', 'start'), as '<action>|<key>' */
  async function connAct(what) {
    var parts = String(what || '').split('|'), a = parts[0], k = parts[1] || '', S = St(); if (!S) return;
    if (a === 'save_app') a = 'save_keys'; if (a === 'start') a = 'connect';
    var tag = k + ':' + a;
    try {
      if (a === 'toggle') { toggle(k); return; }
      if (a === 'open_console') return;
      if (a === 'copy_redirect') { copy(parts.slice(2).join('|') || redirect()); return; }
      if (a === 'reload') { S.conn = null; S.keys.flash = null; S.keys.metaCheck = null; await loadCap(); paint(); return; }
      if (a === 'health') {
        S277.busy[tag] = true; paint();
        var hr = await fn('social-connect', { action: 'health' });
        if (hr && hr.connections) { var keep = { can_change: S.conn.can_change, can_meta: S.conn.can_meta, redirect_uri: S.conn.redirect_uri }; Object.assign(S.conn, hr, keep); if (hr.platforms && hr.platforms.length) S.platforms = hr.platforms; }
        S277.busy[tag] = false; toastS('Checked again'); paint(); return;
      }
      if (a === 'connect' || a === 'reconnect') {
        if (k === 'meta') { setOpen('meta'); focusId('w277metatok'); return; }
        if (a === 'connect' && !connOf(k).app_saved) { setOpen(k); focusId('w277id-' + k); toastS('Save the ' + labelOf(k) + ' keys first, then Connect'); return; }
        S277.busy[tag] = true; paint();
        var s = await fn('social-connect', { action: 'start', platform: k });
        S277.busy[tag] = false;
        if (s && s.url) { location.href = s.url; return; }
        paint(); return;
      }
      if (a === 'save_keys') {
        var id = val('w277id-' + k), sec = val('w277sec-' + k); if (!id || !sec) { toastS('Paste both the ID and the secret'); return; }
        await fn('social-connect', { action: 'save_app', platform: k, id: id, secret: sec });
        clear('w277id-' + k); clear('w277sec-' + k);
        toastS('Saved in the vault'); await loadConn(); paint(); return;
      }
      if (a === 'disconnect') {
        var ok = await ask(k === 'make' ? 'Forget the Make route? LinkedIn posts go back to reminders until it is set up again.' : 'Disconnect ' + labelOf(k) + '? Posts go back to reminders until it is connected again.', k === 'make' ? 'Forget it' : 'Disconnect', true);
        if (!ok) return;
        await fn('social-connect', { action: 'disconnect', platform: k }); toastS('Disconnected'); await refresh(); return;
      }
      if (a === 'meta_check' || a === 'meta_save') {
        var tok = val('w277metatok'); if (!tok) { toastS('Paste the token first'); return; }
        S.busy.meta = true; paint();
        var r = await fn('social-connect', { action: 'meta_token', token: tok, check_only: a === 'meta_check' });
        S.keys.metaCheck = { granted: r.granted || [], missing: r.missing || [] };
        if (a === 'meta_save') { clear('w277metatok'); toastS('Replaced. ' + (r.missing && r.missing.length ? r.missing.length + ' permissions still missing' : 'Every permission is there')); S.busy.meta = false; await refresh(); return; }
        toastS(r.missing && r.missing.length ? 'Missing ' + r.missing.length + ': ' + r.missing.join(', ') : 'Every permission is there');
        S.busy.meta = false; paint(); return;
      }
      if (a === 'make_hook') {
        var u = val('w277mkhook'); if (!u) { toastS('Paste the webhook address'); return; }
        await fn('social-connect', { action: 'make_hook', url: u }); clear('w277mkhook'); toastS('Saved. Now send Make a sample'); await refresh(); return;
      }
      if (a === 'make_sample') { var m = await fn('social-connect', { action: 'make_sample' }); toastS(m && m.ok ? 'Make got the sample' : 'Make answered ' + (m && m.status) + '. Is the scenario listening?'); await loadConn(); paint(); return; }
      if (a === 'make_test') {
        if (!(await ask('This puts a real post on the Welfare Avenue LinkedIn Page: "Testing the connection between the Welfare Avenue Hub and our LinkedIn Page. Please ignore this post." Send it?', 'Send the test post'))) return;
        var t = await fn('social-connect', { action: 'make_test', confirm: true }); toastS(t && t.ok ? 'Sent. Check the LinkedIn Page in a minute.' : 'Make answered ' + (t && t.status)); await loadConn(); paint(); return;
      }
      if (a === 'test_short') {
        var c121 = W121(), pre = { title: 'Test Short from the Hub', platforms: ['youtube'], caption: 'Testing the connection between the Welfare Avenue Hub and YouTube.', variants: { youtube: { title: 'Test from the Hub', privacy: 'unlisted', kids: false } } };
        toastS('Add a short vertical video, then Publish now. It goes up unlisted.');
        if (c121 && c121.compose) c121.compose(pre); return;
      }
      if (a === 'remind_preview') {
        var x = w(), mode = function (p) { return x && x.modeOf ? x.modeOf(p) : 'reminder'; }, all = x && x.posts ? x.posts() : [];
        var cand = all.filter(function (p) { return ['draft', 'scheduled'].indexOf(p.status) >= 0 && (p.platforms || []).some(function (q) { return mode(q) === 'reminder'; }); }).sort(function (p, q) { return String(p.scheduled_at || '9').localeCompare(String(q.scheduled_at || '9')); })[0];
        if (!cand) { S.keys.remind = 'No planned post goes out by reminder. Plan one for a platform that is not connected to see the message.'; paint(); return; }
        var pl = (cand.platforms || []).filter(function (q) { return mode(q) === 'reminder'; })[0];
        var rr = await fn('social-publish', { action: 'remind_test', post_id: cand.id, platform: pl });
        var plan = (rr && rr.plan) || {}; S.keys.remind = 'To: ' + (plan.to || 'nobody (the post has no owner)') + '\n\n' + String(plan.slack || '').replace(/<([^|>]+)\|([^>]+)>/g, '$2').replace(/\*/g, ''); paint(); return;
      }
    } catch (e) { S.busy.meta = false; S277.busy = {}; toastS(e.message || String(e)); paint(); }
  }

  /* delegated on #w277conn: actions first, then the row toggle (never from a field, a link or Advanced) */
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#w277conn')) return;
    var b = t.closest('[data-w277act]');
    if (b) {
      var act = b.getAttribute('data-w277act'); if (act === 'open_console') return;
      e.preventDefault(); if (b.hasAttribute('disabled')) return;
      connAct(act + '|' + (b.getAttribute('data-w277k') || '') + (b.hasAttribute('data-w277v') ? '|' + b.getAttribute('data-w277v') : '')); return;
    }
    if (t.closest('input,textarea,select,a,details,code')) return;
    var r = t.closest('[data-w277row]'); if (r) toggle(r.getAttribute('data-w277row'));
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#w277conn')) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (t.hasAttribute('data-w277row')) { e.preventDefault(); toggle(t.getAttribute('data-w277row')); return; }
    if (t.matches('a[data-w277act][role="button"]')) { e.preventDefault(); t.click(); }
  });

  /* ---------- the interface wave225 and the tests use ---------- */
  window.w277 = {
    connectHtml: page, connAct: connAct, state: function () { return S277; }, platforms: platforms,
    ask: ask, pillOf: pillOf, healthOf: healthOf, attention: attention
  };
})();
