
  /* ---------- routing ---------- */
  function parse() {
    var h = decodeURIComponent(location.hash || '').replace(/^#/, '');
    if (h !== 'requests' && h.indexOf('requests/') !== 0) return null;
    var p = h.split('/');
    return { v: p[1] || '', a: p[2] || '', b: p[3] || '' };
  }
  function route() {
    var r = parse();
    if (!r) { if (R.sheet && !R.sheet.inPlace) closeSheet(true); return false; }
    if (!document.getElementById('requests') || !staffOk()) return false;
    var act = document.querySelector('.panel.active');
    if (!act || act.id !== 'requests') { try { showPanel('requests'); } catch (e) { /* fine */ } }
    mount();
    var v = r.v;
    if (v === '' || v === 'new') {
      R.view = 'new'; R.nw.sent = null;
      R.nw.d = T.order.indexOf(r.a) >= 0 ? r.a : null;
      R.nw.type = R.nw.d && r.b ? r.b : null;
    } else if (v === 'sent') { R.view = 'new'; }
    else if (v === 'mine') R.view = 'mine';
    else if (v === 'team') { R.view = 'team'; if (T.order.indexOf(r.a) >= 0) R.tm.d = r.a; }
    else if (v === 'all') R.view = isLeader() ? 'all' : 'mine';
    else if (v === 'settings') { R.view = isLeader() ? 'settings' : 'new'; R.cfgDraft = null; R.bot = null; }
    else if (v !== 'r' && v !== 'm') R.view = 'new';
    var first = !R.shown; R.shown = true;
    var run = function () {
      if (v === 'sent') { var s = findReq(r.a); if (s) R.nw.sent = s; else { R.nw.sent = null; } }
      if (v === 'new' && R.nw.d && R.nw.type && R.nw.type !== 'other') { var t = typeOf(R.nw.type); if (!t || t.department !== R.nw.d) { if (t) R.nw.d = t.department; else R.nw.type = null; } }
      if (v === 'm') { var m = findMail(r.a); if (m && (first || R.view !== 'team')) { R.view = 'team'; R.tm.d = m.department; } }
      if (v === 'r' && first) { var rq = findReq(r.a); if (rq) { if (isMine(rq)) R.view = 'mine'; else if (allowedTeams().indexOf(rq.department) >= 0) { R.view = 'team'; R.tm.d = rq.department; } } }
      if (v === 'r' || v === 'm') { if (!R.sheet || R.sheet.id !== String(r.a) || R.sheet.k !== v) openSheet(v, r.a, false); }
      else if (R.sheet && !R.sheet.inPlace) closeSheet(true);
      paint();
      if (v !== 'r' && v !== 'm') { try { var top = document.getElementById('requests'); if (top && top.getBoundingClientRect().top < -40) top.scrollIntoView({ block: 'start' }); } catch (e) { /* fine */ } }
    };
    if (R.loaded) { run(); if (now() - R.loaded > 60000) load(true).then(function () { if (onPage()) paint(); injectCard(true); }); }
    else { paint(); load().then(run); }
    return true;
  }
  window.addEventListener('hashchange', function () {
    try { route(); } catch (e) { /* non-fatal */ }
    try { if (teamRoute()) { watchTeam(); setTimeout(function () { injectCard(false); }, 60); } } catch (e) { /* fine */ }
  });
  if (typeof applyHash === 'function') {
    var __ah123 = applyHash;
    applyHash = function () { var r = parse(); if (r && route()) return; return __ah123.apply(this, arguments); };
  }
  if (typeof showPanel === 'function') {
    var __sp123 = showPanel;
    showPanel = function (id) {
      var out = __sp123.apply(this, arguments);
      try {
        if (id === 'requests') setTimeout(function () { if (!parse()) { R.view = R.view || 'new'; } if (mount()) { if (R.loaded) paint(); else { paint(); load().then(paint); } } }, 0);
        else if (id === 'team') { watchTeam(); setTimeout(function () { injectCard(false); }, 80); }
        else if (id === 'hubmail') { watchHubmail(); setTimeout(hubmailChips, 900); }
        if (id !== 'requests' && R.sheet && !R.sheet.inPlace) closeSheet(true);
      } catch (e) { /* non-fatal */ }
      return out;
    };
  }
  if (typeof renderRequestsModule === 'function') {
    var __rrm123 = renderRequestsModule;
    renderRequestsModule = function () { if (staffOk() && document.getElementById('requests')) { paintSoon(); return; } return __rrm123.apply(this, arguments); };
  }
  if (typeof startApp === 'function') {
    var __sa123 = startApp;
    startApp = async function () {
      var out = await __sa123.apply(this, arguments);
      try {
        if (staffOk()) {
          watchTeam(); watchHubmail();
          if (parse()) route();
          else load().then(function () { injectCard(true); });
          if (teamRoute()) setTimeout(function () { injectCard(false); }, 300);
        }
      } catch (e) { /* non-fatal */ }
      return out;
    };
  }

  /* ---------- the form ---------- */
  function formData(form) {
    var o = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox') o[el.name] = el.checked; else o[el.name] = el.value;
    });
    return o;
  }
  function saveDraft(form) { var key = form.getAttribute('data-d') + ':' + form.getAttribute('data-w123form'); R.nw.drafts[key] = formData(form); }
  async function submitForm(form) {
    var d = form.getAttribute('data-d'), key = form.getAttribute('data-w123form');
    var t = key === 'other' ? null : typeOf(key);
    var v = formData(form), fields = fieldsOf(t), missing = [], firstBad = null;
    form.querySelectorAll('.bad').forEach(function (el) { el.classList.remove('bad'); });
    var mark = function (name, label) { var el = form.querySelector('[name="' + name + '"]'); if (el) { el.classList.add('bad'); if (!firstBad) firstBad = el; } missing.push(label); };
    var title = String(v.title || '').trim();
    if (!title) mark('title', 'a title');
    fields.forEach(function (f, i) { if (f.required && !String(v['f' + i] || '').trim()) mark('f' + i, f.label.toLowerCase()); });
    if (!t && !String(v.__what || '').trim()) mark('__what', 'what you need');
    var err = form.querySelector('[data-w123err]');
    if (missing.length) {
      if (err) { err.style.display = ''; err.textContent = 'Fill in ' + missing.join(', ') + '.'; }
      if (firstBad) { try { firstBad.focus(); } catch (e) { /* fine */ } }
      return;
    }
    var details = {}, needed = null;
    fields.forEach(function (f, i) {
      var val = String(v['f' + i] || '').trim(); if (!val) return;
      if (f.type === 'url' && !/^[a-z]+:\/\//i.test(val) && /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(val)) val = 'https://' + val;
      details[f.label] = val;
      if (f.type === 'date' && DATE_KEYS.test(f.name || '') && !needed) needed = val;
    });
    if (!t) details['What is needed'] = String(v.__what || '').trim();
    if (String(v.__more || '').trim()) details['Anything else'] = String(v.__more).trim();
    if (!needed && v.__needed) needed = v.__needed;
    var btn = form.querySelector('[data-w123send]'); if (btn) { btn.disabled = true; btn.innerHTML = 'Sending…'; }
    try {
      var saved = await createRequest({ d: d, type: t, title: title, details: details, needed: needed || null, urgent: !!v.__urgent });
      delete R.nw.drafts[d + ':' + key];
      R.nw.sent = saved; sentWatch = null;
      try { history.replaceState(null, '', '#requests/sent/' + saved.id); } catch (e) { /* fine */ }
      paint();
      injectCard(true);
    } catch (e) {
      if (btn) { btn.disabled = false; btn.innerHTML = I('arrow') + 'Send to ' + E(teamShort(d)); }
      if (err) { err.style.display = ''; err.textContent = 'It did not send: ' + String((e && e.message) || e).slice(0, 160) + '. Nothing was lost; try again.'; }
    }
  }

  /* ---------- events ---------- */
  function go(h) { if (location.hash === h) { route(); injectCard(true); } else location.hash = h; }
  function curReq() { return R.sheet && R.sheet.k === 'r' ? findReq(R.sheet.id) : null; }
  function curMail() { return R.sheet && R.sheet.k === 'm' ? findMail(R.sheet.id) : null; }
  document.addEventListener('click', async function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var el;
    var inSheet = !!t.closest('#w123sheet'), inRoot = !!t.closest('#w123'), inCard = !!t.closest('.w123tcard');
    if (!inSheet && !inRoot && !inCard) return;
    if ((el = t.closest('[data-w123close]'))) { closeSheet(false); return; }
    if ((el = t.closest('[data-w123go]'))) { e.preventDefault(); var h = el.getAttribute('data-w123go'); if (inSheet && !/^#requests\/(r|m)\//.test(h)) closeSheet(true); go(h); return; }
    if ((el = t.closest('[data-w123sacc]'))) { var s1 = R.sugs.filter(function (x) { return String(x.id) === el.getAttribute('data-w123sacc'); })[0]; if (s1) { el.disabled = true; el.textContent = 'Filing…'; await acceptSug(s1); } return; }
    if ((el = t.closest('[data-w123sx]'))) { var s2 = R.sugs.filter(function (x) { return String(x.id) === el.getAttribute('data-w123sx'); })[0]; if (s2) await dismissSug(s2); return; }
    if ((el = t.closest('[data-w123r]'))) { var rid = el.getAttribute('data-w123r'); if (inCard) openSheet('r', rid, true); else go('#requests/r/' + rid); return; }
    if ((el = t.closest('[data-w123m]'))) { var mid = el.getAttribute('data-w123m'); if (inCard) openSheet('m', mid, true); else go('#requests/m/' + mid); return; }
    if ((el = t.closest('[data-w123openm]'))) { var om = el.getAttribute('data-w123openm'); if (R.sheet && R.sheet.inPlace) openSheet('m', om, true); else go('#requests/m/' + om); return; }
    if (inRoot) {
      if ((el = t.closest('[data-w123team]'))) { go('#requests/new/' + el.getAttribute('data-w123team')); return; }
      if ((el = t.closest('[data-w123type]'))) { go('#requests/new/' + (el.getAttribute('data-d') || R.nw.d) + '/' + el.getAttribute('data-w123type')); return; }
      if ((el = t.closest('[data-w123timeoff]'))) { if (typeof window.w105ReqModal === 'function') window.w105ReqModal(); else go('#mypage'); return; }
      if ((el = t.closest('[data-w123mineall]'))) { R.mineAll = true; paint(); return; }
      if ((el = t.closest('[data-w123tms]'))) { R.tm.state = el.getAttribute('data-w123tms'); paint(); return; }
      if ((el = t.closest('[data-w123tmk]'))) { R.tm.kind = el.getAttribute('data-w123tmk'); paint(); return; }
      if ((el = t.closest('[data-w123alls]'))) { R.all.state = el.getAttribute('data-w123alls'); paint(); return; }
      if ((el = t.closest('[data-w123test]'))) {
        var dd = el.getAttribute('data-w123test'); el.disabled = true; el.textContent = 'Sending…';
        try { var tr = await fx({ action: 'test', department: dd }); toastS('Test posted in #' + tr.channel); el.textContent = 'Sent to #' + tr.channel; }
        catch (x) { toastS('The test did not post'); el.disabled = false; el.textContent = 'Send a test'; alertLine(el, String(x.message || x)); }
        return;
      }
      if ((el = t.closest('[data-w123save]'))) { await saveCfg(); return; }
      if ((el = t.closest('[data-w123cfgreset]'))) { R.cfgDraft = null; paint(); return; }
    }
    if (inSheet) {
      var r = curReq(), m = curMail();
      if ((el = t.closest('[data-w123setst]')) && r) { await setStatus(r, el.getAttribute('data-w123setst')); return; }
      if ((el = t.closest('[data-w123done]')) && r) { await setDone(r, true); return; }
      if ((el = t.closest('[data-w123reopen]')) && r) { await setDone(r, false); return; }
      if ((el = t.closest('[data-w123addnote]')) && r) {
        var ta = document.querySelector('#w123sheet textarea[data-w123note]'); var txt = ta ? ta.value.trim() : '';
        if (!txt) { if (ta) ta.focus(); return; }
        el.disabled = true;
        var ok = await addNote(r, txt);
        if (ok && ta) ta.value = '';
        el.disabled = false; renderSheet();
        return;
      }
      if ((el = t.closest('[data-w123repost]')) && r) {
        el.textContent = 'Posting…';
        try { var rp = await fx({ action: 'repost', request_id: r.id }); if (rp && rp.ts) { r.slack = { channel: rp.channel, channel_id: rp.channel_id, ts: rp.ts, url: rp.url, at: rp.at }; toastS('Posted in #' + rp.channel); } else if (rp && rp.skipped) toastS(cap(rp.skipped)); }
        catch (x) { r.slack = Object.assign({}, r.slack || {}, { error: String(x.message || x) }); toastS('It did not post'); }
        renderSheet(); return;
      }
      if ((el = t.closest('[data-w123mdone]')) && m) { await mailSet(m, { state: 'done' }); toastS('Marked handled'); return; }
      if ((el = t.closest('[data-w123mopen]')) && m) { await mailSet(m, { state: 'open' }); toastS('Back in the open inbox'); return; }
      if ((el = t.closest('[data-w123mconv]')) && m) {
        el.disabled = true; el.textContent = 'Creating…';
        try { var nr = await convertMail(m); toastS('It is a request now, posted to the team'); if (R.sheet && R.sheet.inPlace) openSheet('r', nr.id, true); else go('#requests/r/' + nr.id); }
        catch (x) { el.disabled = false; toastS('Could not make it a request'); }
        return;
      }
      if ((el = t.closest('[data-w123mbody]')) && m) { loadBody(m.id); return; }
    }
  });
  function alertLine(el, msg) { var p = el.closest('.w123set'); if (!p) return; var s = p.querySelector('.no, .ok'); if (s) { s.className = 'no'; s.textContent = msg; } }
  document.addEventListener('change', async function (e) {
    var t = e.target; if (!t || !t.closest) return;
    if (t.closest('#w123sheet')) {
      var r = curReq(), m = curMail();
      if (t.matches('[data-w123st]') && r) { await setStatus(r, t.value); return; }
      if (t.matches('[data-w123as]') && r) { await assign(r, t.value); return; }
      if (t.matches('[data-w123mas]') && m) { if (t.value) await mailSet(m, { assignee: t.value }); else await mailSet(m, { clear: true }); toastS(t.value ? 'Now with ' + t.value : 'Unassigned'); return; }
    }
    if (!t.closest('#w123')) return;
    if (t.matches('[data-w123tmme]')) { R.tm.mine = t.checked; paint(); return; }
    if (t.matches('[data-w123alld]')) { R.all.d = t.value; paint(); return; }
    var c = R.cfgDraft;
    if (c && t.matches('[data-w123cfgch]')) { c.channels[t.getAttribute('data-w123cfgch')] = String(t.value || '').split(/[,\s]+/).map(function (x) { return x.replace(/^#/, '').trim(); }).filter(Boolean); return; }
    if (c && t.matches('[data-w123cfgem]')) { var dm = t.getAttribute('data-w123cfgem'); if (t.value === 'jev') delete c.email_mode[dm]; else c.email_mode[dm] = t.value; return; }
    if (c && t.matches('[data-w123cfg]')) { c[t.getAttribute('data-w123cfg')] = t.checked; return; }
    var form = t.closest('form[data-w123form]'); if (form) saveDraft(form);
  });
  var qT = null, aT = null;
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#w123')) return;
    if (t.matches('[data-w123q]')) {
      R.nw.q = t.value;
      clearTimeout(qT);
      qT = setTimeout(function () { var res = document.getElementById('w123qres'), tiles = document.getElementById('w123tiles'); if (res) res.innerHTML = searchHtml(R.nw.q); if (tiles) tiles.style.display = R.nw.q.trim() ? 'none' : ''; }, 90);
      return;
    }
    if (t.matches('[data-w123allq]')) { R.all.q = t.value; clearTimeout(aT); aT = setTimeout(function () { var box = document.getElementById('w123allrows'); if (!box) return; var keep = R.all.q; paint(); var inp = document.querySelector('#w123 [data-w123allq]'); if (inp) { inp.focus(); try { inp.setSelectionRange(keep.length, keep.length); } catch (x) { /* fine */ } } }, 160); return; }
    var form = t.closest('form[data-w123form]');
    if (form) { saveDraft(form); if (t.classList.contains('bad') && String(t.value || '').trim()) t.classList.remove('bad'); }
  });
  document.addEventListener('submit', function (e) {
    var form = e.target && e.target.closest ? e.target.closest('form[data-w123form]') : null;
    if (!form) return;
    e.preventDefault();
    submitForm(form);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && R.sheet) { e.preventDefault(); closeSheet(false); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('#w123 [data-w123r], #w123 [data-w123m], .w123tcard [data-w123r], .w123tcard [data-w123m], #w123 .w123seg a[data-w123go], #w123 .w123gear')) { e.preventDefault(); e.target.click(); return; }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.target && e.target.matches && e.target.matches('#w123sheet textarea[data-w123note]')) { e.preventDefault(); var b = document.querySelector('#w123sheet [data-w123addnote]'); if (b) b.click(); }
  });

  /* ---------- settings ---------- */
  async function saveCfg() {
    if (!isAdmin() || !R.cfgDraft) return;
    var c = R.cfgDraft;
    var value = { channels: c.channels, post_requests: !!c.post_requests, thread_updates: !!c.thread_updates, dm_requester: !!c.dm_requester, email_mode: c.email_mode || {} };
    var r = await q(db.from('hub_settings').upsert({ key: 'team_inbox', value: value, updated_at: new Date().toISOString(), updated_by: me().name }));
    if (r.error) { toastS('Could not save the settings'); return; }
    try { await db.from('change_log').insert({ entity_type: 'hub_settings', entity_id: 'team_inbox', field: 'updated', old_value: null, new_value: JSON.stringify(value).slice(0, 400), changed_by: me().name }); } catch (e) { /* audit */ }
    R.cfg = cfgOf(value); R.cfgDraft = null; R.bot = null; bump();
    toastS('Saved. Checking the channels again');
    paint();
  }

  /* ---------- test hook ---------- */
  window.w123 = {
    state: function () { return R; }, load: load, paint: paint, route: route, open: openSheet, close: closeSheet,
    items: teamItems, card: injectCard, counts: counts, me: me
  };
})();
