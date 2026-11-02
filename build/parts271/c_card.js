
  /* ---------- a started card ---------- */
  function stepHtml(f, key, label, n) {
    var r = (f.steps || []).filter(function (x) { return x.step === key; })[0];
    if (!r) return '<li><div class="ttl">' + n + '. ' + E(label) + '</div></li>';
    var status = r.status, id = f.id;
    var stuck = (status === 'running' || status === 'pending') && Date.now() - Date.parse(r.at) >= STALE_MS;
    var tagClass = status === 'done' ? 'ok' : status === 'failed' ? 'no' : status === 'hr_task' ? 'hr' : '';
    var h = '<li><div class="ttl">' + n + '. ' + E(label) + ' <span class="o271tag ' + tagClass + '">' + E(WORD[status] || status) + '</span>' + (r.practice ? '<span class="o271tag pr">Practice</span>' : '') + '</div>';
    if (r.detail) h += '<div class="dt' + (status === 'failed' ? ' fail' : '') + '">' + (status === 'hr_task' ? 'To do: ' : '') + E(r.detail) + '</div>';
    if (status === 'failed' || stuck) h += '<div class="row"><button type="button" class="o271b" data-o271a="retry" data-f="' + E(id) + '" data-step="' + E(key) + '"' + (S.busy['r' + id + key] ? ' disabled' : '') + '>Retry</button></div>';
    if (key === 'google' && (status === 'hr_task' || status === 'failed')) {
      h += '<div class="row"><input type="text" autocomplete="off" aria-label="The address you created" placeholder="first.last@welfareavenue.com" data-o271i="gaddr" data-f="' + E(id) + '" value="' + E(gaddrOf(f)) + '">'
        + '<button type="button" class="o271b pri" data-o271a="gmanual" data-f="' + E(id) + '"' + (S.busy['g' + id] ? ' disabled' : '') + '>I created it, continue</button></div>';
    }
    return h + '</li>';
  }
  function gaddrOf(f) { if (S.gaddr && S.gaddr[f.id] != null) return S.gaddr[f.id]; return f.wa_email || ''; }
  function nameOf(id) { var p = S.people.filter(function (x) { return String(x.id) === String(id); })[0]; return p ? p.name : 'Not chosen'; }
  function panelHtml(f, A) {
    var id = f.id, g = A.g, h = '<div class="o271pn">', busy = S.busy['a' + id];
    if (A.kind === 'back') {
      h += '<div class="o271ln"><b>Did ' + E(f.name) + ' back out?</b> This cancels their invites, closes the onboarding and moves the card to Withdrawn. It removes nothing from Google, Slack or the Hub: you get a list of what to take out by hand.</div>'
        + '<label class="o271f">Why (optional)</label><input type="text" data-o271i="reason" data-f="' + E(id) + '" value="' + E(A.reason || '') + '">'
        + '<div class="o271btns"><button type="button" class="o271b dngp" data-o271a="actgo" data-f="' + E(id) + '"' + (busy ? ' disabled' : '') + '>Yes, they backed out</button><button type="button" class="o271b" data-o271a="actno" data-f="' + E(id) + '">Cancel</button></div>';
    } else if (A.kind === 'manager') {
      h += '<label class="o271f">New manager</label><select data-o271i="member" data-f="' + E(id) + '">' + memberOptions(A.member) + '</select>'
        + '<div class="o271ln">The Hub moves the 1-on-1 invite to them and tells both managers.</div>'
        + '<div class="o271btns"><button type="button" class="o271b pri" data-o271a="actgo" data-f="' + E(id) + '"' + (busy || !A.member ? ' disabled' : '') + '>Change manager</button><button type="button" class="o271b" data-o271a="actno" data-f="' + E(id) + '">Cancel</button></div>';
    } else {
      var isBook = A.kind === 'book', mode = isBook ? 'one' : (A.which === 'one_on_one' ? 'one' : 'call');
      if (!isBook) {
        h += '<label class="o271f">Which meeting</label><select data-o271i="which" data-f="' + E(id) + '"><option value="call"' + (mode === 'call' ? ' selected' : '') + '>Onboarding call</option>' + (f.one_on_one_at ? '<option value="one_on_one"' + (mode === 'one' ? ' selected' : '') + '>1-on-1</option>' : '') + '</select>';
      }
      if (g) h += '<div style="margin-top:8px">' + gridHtml(g) + '</div>';
      h += '<label class="o271f">' + (isBook ? '1-on-1' : 'New time') + ' (Toronto time)</label><input type="datetime-local" data-o271i="at" data-f="' + E(id) + '" value="' + E(A.at || '') + '">'
        + '<div class="o271ln">' + (isBook ? 'The invite goes out as soon as you book it.' : (mode === 'call' ? 'Google tells the guests, the manager is told, and the plan\'s dates move with it.' : 'Google tells the guests and the manager is told.')) + '</div>'
        + '<div class="o271btns"><button type="button" class="o271b pri" data-o271a="actgo" data-f="' + E(id) + '"' + (busy || !A.at ? ' disabled' : '') + '>' + (isBook ? 'Book the 1-on-1' : 'Change time') + '</button><button type="button" class="o271b" data-o271a="actno" data-f="' + E(id) + '">Cancel</button></div>';
    }
    return h + '</div>';
  }
  function startedCard(f) {
    var id = f.id, A = S.act[id], acting = A && A.kind;
    return '<div class="o271cd" data-o271flow="' + E(id) + '">'
      + '<div class="o271top"><b>' + E(f.name) + '</b><span>' + E(f.role || '') + '</span>' + (f.practice ? '<i class="o271tag pr" style="font-style:normal">Practice</i>' : '') + '<i class="o271tag" style="font-style:normal">' + (f.status === 'started' ? 'Started' : 'Under way') + '</i></div>'
      + '<div class="o271ln">Onboarding call: ' + E(f.call_at ? whenText(f.call_at) : 'not set') + '</div>'
      + '<div class="o271ln">1-on-1: ' + E(f.one_on_one_at ? whenText(f.one_on_one_at) : 'not booked yet') + '</div>'
      + '<div class="o271ln">Manager: ' + E(nameOf(f.manager_member_id)) + (f.wa_email ? ' &middot; Address: ' + E(f.wa_email) : '') + '</div>'
      + noteHtml(id)
      + '<ol class="o271st">' + STEPS.map(function (s, i) { return stepHtml(f, s[0], s[1], i + 1); }).join('') + '</ol>'
      + '<div class="o271btns">'
      + '<button type="button" class="o271b" data-o271a="act" data-kind="time" data-f="' + E(id) + '"' + (acting === 'time' ? ' disabled' : '') + '>Change time</button>'
      + '<button type="button" class="o271b" data-o271a="act" data-kind="manager" data-f="' + E(id) + '"' + (acting === 'manager' ? ' disabled' : '') + '>Change manager</button>'
      + (f.one_on_one_at ? '' : '<button type="button" class="o271b" data-o271a="act" data-kind="book" data-f="' + E(id) + '"' + (acting === 'book' ? ' disabled' : '') + '>Book the 1-on-1</button>')
      + '<button type="button" class="o271b dng" data-o271a="act" data-kind="back" data-f="' + E(id) + '"' + (acting === 'back' ? ' disabled' : '') + '>They backed out</button>'
      + '</div>'
      + (A ? panelHtml(f, A) : '')
      + '</div>';
  }
  function flowOf(id) { return S.started.filter(function (x) { return String(x.id) === String(id); })[0]; }

  /* ---------- the changes ---------- */
  async function openAct(id, kind) {
    var f = flowOf(id); if (!f) return;
    delete S.note[id];
    var A = S.act[id] = { kind: kind, at: '', member: '', which: 'call', reason: '', g: null };
    paint();
    if (kind !== 'book' && kind !== 'time') return;
    /* the marks and meetings for the picker. Typing a time works without them */
    try {
      var pv = await run('preview', { flow_id: Number(id) });
      if (S.act[id] !== A) return;
      A.g = newGrid('a' + id, pv, kind === 'book' ? 'one' : 'call');
      paint();
    } catch (e) { if (S.act[id] === A) { S.note[id] = { err: e.message }; paint(); } }
  }
  async function actGo(id) {
    var A = S.act[id], f = flowOf(id); if (!A || !f || S.busy['a' + id]) return;
    var at = null;
    if (A.kind === 'book' || A.kind === 'time') {
      at = isoOf(A.at);
      if (!at) { S.note[id] = { err: 'That time does not exist on the Toronto clock. Pick another.' }; paint(); return; }
    }
    S.busy['a' + id] = true; paint();
    try {
      var note = { ok: 'Done.' };
      if (A.kind === 'book') { await run('book_one_on_one', { flow_id: Number(id), at: at }); note.ok = 'The 1-on-1 is booked and the invite has gone out.'; }
      else if (A.kind === 'time') { var r = await run('change_time', { flow_id: Number(id), which: A.which, at: at }); note = { ok: 'The time has changed.', warnings: r.warnings || [] }; }
      else if (A.kind === 'manager') { var m = await run('change_manager', { flow_id: Number(id), member_id: Number(A.member) }); note = { ok: 'The manager has changed.', warnings: m.warnings || [] }; }
      else {
        var b = await run('backed_out', { flow_id: Number(id), reason: A.reason || '' });
        S.out.push({ name: f.name, remove: b.remove || [], warnings: b.warnings || [] });
        delete S.note[id];
        note = null;
      }
      delete S.act[id];
      if (note) S.note[id] = note;
      delete S.busy['a' + id];
      await load();
    } catch (e) { delete S.busy['a' + id]; S.note[id] = { err: e.message }; toast(e.message); paint(); }
  }
  async function retry(id, step) {
    var key = 'r' + id + step; if (S.busy[key]) return;
    S.busy[key] = true; delete S.note[id]; paint();
    try { await run('retry', { flow_id: Number(id), step: step }); delete S.busy[key]; await load(); }
    catch (e) { delete S.busy[key]; S.note[id] = { err: e.message }; toast(e.message); paint(); }
  }
  async function googleManual(id) {
    var f = flowOf(id); if (!f || S.busy['g' + id]) return;
    S.busy['g' + id] = true; delete S.note[id]; paint();
    try {
      await run('google_manual', { flow_id: Number(id), wa_email: String(gaddrOf(f)).trim().toLowerCase() });
      delete S.busy['g' + id]; if (S.gaddr) delete S.gaddr[id];
      await load();
    } catch (e) { delete S.busy['g' + id]; S.note[id] = { err: e.message }; toast(e.message); paint(); }
  }
  async function sendLink(id, candidate) {
    if (S.busy['l' + id]) return;
    S.busy['l' + id] = true; delete S.note[id]; paint();
    try { await run('send_grid_link', { candidate_id: Number(candidate) }); S.note[id] = { ok: 'The availability link has gone out.' }; toast('Link sent'); }
    catch (e) { S.note[id] = { err: e.message }; toast(e.message); }
    delete S.busy['l' + id]; paint();
  }

  /* ---------- the section ---------- */
  function outHtml() {
    return S.out.map(function (o, i) {
      return '<div class="o271out"><div class="o271ln"><b>' + E(o.name) + ' backed out.</b> Take these out by hand:</div>'
        + (o.remove.length ? '<ul>' + o.remove.map(function (r) { return '<li>' + E(r) + '</li>'; }).join('') + '</ul>' : '<div class="o271ln">Nothing was made for them, so there is nothing to take out.</div>')
        + o.warnings.map(warnBox).join('')
        + '<div class="o271btns"><button type="button" class="o271b" data-o271a="outok" data-i="' + i + '">Done</button></div></div>';
    }).join('');
  }
  function paint() {
    var el = document.getElementById('o271'); if (!el) return;
    var panel = document.getElementById('hrcentre');
    if (S.denied) {
      el.innerHTML = ''; el.setAttribute('data-w197s', 'none'); el.classList.remove('w197on');
      return;
    }
    var active = document.activeElement, keep = active && el.contains(active) && active.getAttribute && active.getAttribute('data-o271i');
    var keepFlow = keep ? active.getAttribute('data-f') : '', sel = keep && active.selectionStart != null ? [active.selectionStart, active.selectionEnd] : null;
    var html = '<h2>Ready to onboard</h2><p class="o271sub">Everyone who has accepted an offer. Pick the times, check the preview, then press Start onboarding.</p>' + outHtml();
    if (S.err) html += '<div class="o271err">' + E(S.err) + '</div>';
    if (!S.loaded) html += '<p class="o271sub">Loading...</p>';
    else if (!S.ready.length && !S.started.length) html += '<p class="o271sub">Nobody is waiting to be onboarded.</p>';
    html += S.ready.map(readyCard).join('');
    if (S.started.length) html += '<h3 class="o271h">Onboarding started</h3>' + S.started.map(startedCard).join('');
    /* each grid keeps its scroll through a repaint */
    var scrolls = {}; Array.prototype.forEach.call(el.querySelectorAll('[data-o271grid]'), function (b) { scrolls[b.getAttribute('data-o271grid')] = b.scrollLeft; });
    el.innerHTML = html;
    Array.prototype.forEach.call(el.querySelectorAll('[data-o271grid]'), function (b) { var v = scrolls[b.getAttribute('data-o271grid')]; if (v) b.scrollLeft = v; });
    if (keep) {
      var again = el.querySelector('[data-o271i="' + keep + '"][data-f="' + keepFlow + '"]');
      if (again) { try { again.focus(); if (sel) again.setSelectionRange(sel[0], sel[1]); } catch (e) { /* not a text box */ } }
    }
    if (panel && panel.getAttribute('data-w197') === 'onboarding') el.classList.add('w197on');
  }
  function onbSection() { var a = document.querySelector('#w46body > .w46sec [data-w46assign]'); return a ? a.closest('.w46sec') : null; }
  function onPage() { var p = document.getElementById('hrcentre'); return (p && p.getAttribute('data-w197') === 'onboarding') || /^#hrcentre\/onboarding(\?|$)/.test(String(location.hash || '')); }
  function install() {
    var body = document.getElementById('w46body'); if (!body || !hrPage()) return;
    var sec = onbSection(); if (!sec) return;   /* still loading, or a page redraw is on its way */
    var el = document.getElementById('o271');
    if (el && el.parentNode === body && el.nextElementSibling === sec) return;
    if (!el) {
      el = document.createElement('div'); el.id = 'o271'; el.className = 'o271 w197card w197blk'; el.setAttribute('data-w197s', S.denied ? 'none' : 'onboarding');
    }
    body.insertBefore(el, sec);
    paint();
    if (onPage() && !S.loaded) load();
  }
  function arrive() { install(); if (document.getElementById('o271') && onPage()) load(); }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var cell = t.closest('[data-o271cell]');
    if (cell) {
      var g = gridOf(cell.getAttribute('data-g')); if (!g) return;
      var key = cell.getAttribute('data-g'), id = key.slice(1), local = toLocal(cell.getAttribute('data-o271cell'));
      if (key.charAt(0) === 'a') {
        var A = S.act[id]; if (A) { A.at = local; g.vals[g.mode] = local; refreshGrid(g); var box = document.querySelector('[data-o271flow="' + id + '"] [data-o271i="at"]'); if (box) box.value = local; var go = document.querySelector('[data-o271flow="' + id + '"] [data-o271a="actgo"]'); if (go) go.disabled = false; }
      } else {
        g.vals[g.mode] = local; refreshGrid(g);
        var inp = document.querySelector('[data-o271flow="' + id + '"] [data-o271i="' + g.mode + '"]'); if (inp) inp.value = local;
        liveUpdate(id);
      }
      return;
    }
    var b = t.closest('[data-o271a]'); if (!b || b.disabled) return;
    var a = b.getAttribute('data-o271a'), f = b.getAttribute('data-f');
    if (a === 'link') { sendLink(f, b.getAttribute('data-cand')); return; }
    if (a === 'open') { var x = S.ready.filter(function (r) { return String(r.flow_id) === String(f); })[0]; if (x) openPick(x); return; }
    if (a === 'mode') { var P = S.pick[f]; if (P) { P.g.mode = b.getAttribute('data-mode'); paint(); } return; }
    if (a === 'start') { start(f); return; }
    if (a === 'retry') { retry(f, b.getAttribute('data-step')); return; }
    if (a === 'gmanual') { googleManual(f); return; }
    if (a === 'act') { openAct(f, b.getAttribute('data-kind')); return; }
    if (a === 'actgo') { actGo(f); return; }
    if (a === 'actno') { delete S.act[f]; paint(); return; }
    if (a === 'outok') { S.out.splice(Number(b.getAttribute('data-i')), 1); paint(); return; }
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || !t.getAttribute) return;
    var k = t.getAttribute('data-o271i'), id = t.getAttribute('data-f'); if (!k || !id) return;
    var P = S.pick[id], A = S.act[id];
    if (k === 'gaddr') { S.gaddr = S.gaddr || {}; S.gaddr[id] = t.value; return; }
    if (A && k === 'reason') { A.reason = t.value; return; }
    if (A && k === 'at') {
      A.at = t.value;
      if (A.g) { A.g.vals[A.g.mode] = t.value; refreshGrid(A.g); }
      var go = document.querySelector('[data-o271flow="' + id + '"] [data-o271a="actgo"]'); if (go) go.disabled = !A.at;
      return;
    }
    if (!P) return;
    if (k === 'call' || k === 'one') { P.g.vals[k] = t.value; refreshGrid(P.g); liveUpdate(id); return; }
    if (k === 'addr') { P.addr = t.value; liveUpdate(id); return; }
    if (k === 'group') { P.group = t.value; return; }
    if (k === 'subj') { P.subject = t.value; return; }
    if (k === 'text') { P.text = t.value; return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.getAttribute) return;
    var skip = t.getAttribute('data-o271skip'), k = t.getAttribute('data-o271i'), id = t.getAttribute('data-f');
    if (skip && S.pick[id]) { S.pick[id].skip[skip] = !t.checked; liveUpdate(id); return; }
    if (!k || !id) return;
    var P = S.pick[id], A = S.act[id];
    if (k === 'addr' && P) { P.addr = t.value; recheckAddress(id); return; }
    if (k === 'mgr' && P) {
      P.managerId = t.value;
      var changed = String(P.managerId) !== String(P.pv.manager && P.pv.manager.member_id);
      if (changed !== P.g.hideManager) { P.g.hideManager = changed; paint(); } else liveUpdate(id);
      return;
    }
    if (k === 'member' && A) { A.member = t.value; paint(); return; }
    if (k === 'which' && A) {
      A.which = t.value; A.at = '';
      if (A.g) { A.g.mode = t.value === 'one_on_one' ? 'one' : 'call'; A.g.vals = { call: '', one: '' }; }
      paint();
    }
  });

  /* ---------- wiring: the section stays above the Onboarding section whenever wave46 redraws ---------- */
  function arm(tries) {
    var panel = document.getElementById('hrcentre');
    if (!panel) { if ((tries || 0) < 40) setTimeout(function () { arm((tries || 0) + 1); }, 800); return; }
    if (panel.dataset.o271mo) return;
    panel.dataset.o271mo = '1';
    new MutationObserver(function () { try { install(); } catch (e) { /* the next redraw */ } }).observe(panel, { childList: true, subtree: true });
    /* wave197 can change page without a hashchange (replaceState): its page attribute says when Onboarding opens */
    new MutationObserver(function (list) { if (list.some(function (m) { return m.oldValue !== 'onboarding'; }) && panel.getAttribute('data-w197') === 'onboarding') { try { arrive(); } catch (e) { /* the next redraw */ } } }).observe(panel, { attributes: true, attributeFilter: ['data-w197'], attributeOldValue: true });
    arrive();
  }
  if (typeof startApp === 'function') {
    var __sa271 = startApp;
    startApp = async function () { var out = await __sa271.apply(this, arguments); try { arm(0); } catch (e) { /* non-fatal */ } return out; };
  }
  window.addEventListener('hashchange', function () { if (onPage()) setTimeout(arrive, 120); });

  /* ---------- test hook ---------- */
  window.o271 = { load: load, toInstant: toInstant, toLocal: toLocal, wall: wall, state: function () { return S; } };
})();
