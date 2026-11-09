  /* ======================= Filters on the Contacts page (wave295, 07/11/26) =======================
     Steel, 07/11/26: the CRM could not find people by the fields in their contacts. A Filters button beside the quick menus opens a builder
     with the Lists engine's groups (the same condition rows as the Lists page: h_campaigns.js condHtml, groupsHtml, condEvent, condClick).
     The database answers (crm_filter_contacts, wave295 SQL, the same engine as crm_list_preview), and the list narrows to those ids together
     with the quick menus and search, which stay as they were. Active conditions show as chips under the bar; the filter lives in the address
     (#crm/f/<filter>) so a reload or a shared link keeps it; Save as a list hands it to the Lists page; a saved live list opens as a view. */
  var FB = { open: false, draft: null, applied: null, ids: null, busy: false, err: '', prev: null, pT: null, tok: 0, anim: false, msg: '', note: '' };
  function fbClone(x) { return JSON.parse(JSON.stringify(x)); }
  function fbDraft() { return FB.draft; }
  /* the applied groups that hold at least one condition */
  function fbGroups() { return (FB.applied || []).filter(function (g) { return g.all && g.all.length; }); }
  function fbOn() { return fbGroups().length > 0; }
  function fbCount() { return fbGroups().reduce(function (n, g) { return n + g.all.length; }, 0); }
  /* the address: #crm/f/ and the filter as base64url of its JSON (UTF-8, so a tag with an accent survives) */
  function fbEncode(groups) { try { return btoa(unescape(encodeURIComponent(JSON.stringify(groups)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); } catch (e) { return ''; } }
  /* wave295 fix round 1: a link is read fail closed. Only known fields, their own operators and plain values of the right shape come through;
     anything else (an unknown field, a list where one value is meant, an object, a blank value, too much of anything) is left out and counted,
     so the page can say so. Nothing from a link reaches the database unless it would also be accepted from the builder. */
  function fbDecode(s) {
    try {
      s = String(s || ''); if (s.length > 8000) return null;
      var b = s.replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '=';
      var g = JSON.parse(decodeURIComponent(escape(atob(b))));
      if (!Array.isArray(g)) return null;
      var out = [], dropped = Math.max(0, g.length - 20);
      g.slice(0, 20).forEach(function (x) {
        if (!x || typeof x !== 'object' || !Array.isArray(x.all)) { dropped++; return; }
        var all = [];
        dropped += Math.max(0, x.all.length - 30);
        x.all.slice(0, 30).forEach(function (k) { var c = fbCond(k); if (c) all.push(c); else dropped++; });
        if (all.length) out.push({ all: all });
      });
      return { groups: out, dropped: dropped };
    } catch (e) { return null; }
  }
  var FIELD_OPS = ['set', 'empty', 'is', 'any', 'contains', 'before', 'after'];
  function fbCond(k) {
    if (!k || typeof k !== 'object' || Array.isArray(k) || typeof k.f !== 'string' || !knownField(k.f) || typeof k.op !== 'string') return null;
    var c = { f: k.f, op: k.op };
    if (k.f === 'field') { if (typeof k.key !== 'string' || !FKEY.test(k.key)) return null; c.key = k.key; }
    var v = k.v;
    if (Array.isArray(v)) {
      var listOk = k.f === 'kind' || k.f === 'role' || k.f === 'tag' || (k.f === 'field' && (k.op === 'is' || k.op === 'any'));
      if (!listOk || v.length > 100 || !v.every(function (x) { return typeof x === 'string' && x.length <= 200; })) return null;
      c.v = v.filter(function (x) { return x.trim(); });
    } else if (typeof v === 'string' || typeof v === 'number') { if (String(v).length > 200) return null; c.v = String(v); }
    else if (v != null) return null;
    if ((k.f === 'field' ? FIELD_OPS : defOf(c).ops).indexOf(c.op) < 0) return null;
    if (k.f === 'field') { if (FIELD_OPS.indexOf(c.op) > 1 && !vals(c).filter(function (x) { return x.trim(); }).length) return null; }
    else if (!condReady(c)) return null;
    return c;
  }
  function fbHash() { return fbOn() ? '#crm/f/' + fbEncode(fbGroups()) : '#crm'; }
  function fbSyncHash() {
    if (S.ui.tab !== 'contacts') return;
    var h = location.hash || '';
    if (!(h === '' || h === '#crm' || /^#crm\/f\//.test(h))) return;
    var want = fbHash();
    if (h !== want) { try { history.replaceState(null, '', want); } catch (e) { /* fine */ } }
  }
  /* the database's answer: rows of {id} (or bare ids) */
  function fbIds(r) { var m = {}; ((r && r.data) || []).forEach(function (x) { var id = typeof x === 'object' && x !== null ? (x.id != null ? x.id : x.crm_filter_contacts) : x; if (id != null) m[String(id)] = 1; }); return m; }
  function fbPlain(err) {
    var m = String((err && (err.message || err.msg)) || err || '');
    if (/crm_filter_contacts/.test(m) && /(does not exist|not find|could not find|schema cache)/i.test(m)) return 'the filters are not in the database yet';
    if (/permission denied|42501/i.test(m)) return 'you do not have the right to filter the contacts';
    if (/timeout|canceling statement/i.test(m)) return 'it took too long; try fewer conditions';
    return m.replace(/\.$/, '') || 'no answer came back';
  }
  function fbRun(groups) { return Promise.resolve(db.rpc('crm_filter_contacts', { p_filter: { groups: groups } })); }
  /* narrow the list to what these groups select; on an error the list stays as it was */
  function fbApply(groups, o) {
    o = o || {};
    /* fail closed: conditions are never dropped on the way to the database (a saved list opened as a view, with a condition the page cannot use,
       would otherwise show more people than the list holds); nothing changes and the reason shows */
    var given = (groups || []).filter(function (g) { return g && g.all && g.all.length; }), why = given.length ? groupsWhy(given) : '';
    if (why) { FB.err = 'these conditions cannot be used (' + why.replace(/\.$/, '') + ')'; FB.msg = ''; paint(); return Promise.resolve(); }
    var clean = cleanGroups(groups).filter(function (g) { return g.all.length; });
    var before = { applied: FB.applied, ids: FB.ids };
    FB.err = ''; FB.msg = '';
    FB.note = o.note || '';
    var tok = ++FB.tok;   /* every apply, Clear included, outdates the runs still on their way (a late answer or error never puts an old filter back) */
    if (!clean.length) { FB.applied = null; FB.ids = null; FB.busy = false; S.ui.show = 60; fbSyncHash(); paint(); return Promise.resolve(); }
    FB.applied = clean; S.ui.show = 60;
    if (o.ids) { FB.ids = o.ids; FB.busy = false; fbSyncHash(); paint(); return Promise.resolve(); }
    FB.busy = true; fbSyncHash(); paint();
    return fbRun(clean).then(function (r) {
      if (tok !== FB.tok) return;
      FB.busy = false;
      if (r && r.error) { FB.applied = before.applied; FB.ids = before.ids; FB.err = fbPlain(r.error); fbSyncHash(); paint(); return; }
      FB.ids = fbIds(r); paint();
    }, function (e) { if (tok !== FB.tok) return; FB.busy = false; FB.applied = before.applied; FB.ids = before.ids; FB.err = fbPlain(e); fbSyncHash(); paint(); });
  }
  /* the builder's own count while it is being edited (debounced, the latest answer wins) */
  /* why Show cannot be used yet ('' when it can; no condition at all is "Show everyone", which clears) and why Save as a list cannot */
  function fbApplyWhy() { var d = FB.draft || []; return d.some(function (g) { return g.all && g.all.length; }) ? groupsWhy(d) : ''; }
  function fbSaveWhy() { return groupsWhy(FB.draft || []); }
  function fbPreviewSoon() {
    var groups = cleanGroups(FB.draft || []).filter(function (g) { return g.all.length; }), token = JSON.stringify(groups);
    if (fbApplyWhy()) { clearTimeout(FB.pT); FB.prev = { token: token, why: fbApplyWhy() }; fbPaintPrev(); return; }
    if (FB.prev && FB.prev.token === token && !FB.prev.err) return;   /* the same question is already asked or answered */
    clearTimeout(FB.pT);
    if (!groups.length) { FB.prev = { token: token, none: true }; fbPaintPrev(); return; }
    FB.prev = { token: token, busy: true, ids: FB.prev && FB.prev.ids }; fbPaintPrev();
    FB.pT = setTimeout(function () {
      fbRun(groups).then(function (r) {
        if (!FB.prev || FB.prev.token !== token) return;
        FB.prev = r && r.error ? { token: token, err: fbPlain(r.error) } : { token: token, ids: fbIds(r) };
        fbPaintPrev();
      }, function (e) { if (FB.prev && FB.prev.token === token) { FB.prev = { token: token, err: fbPlain(e) }; fbPaintPrev(); } });
    }, 300);
  }
  /* how many of the database's people also pass the quick menus and search */
  function fbQuickCount(ids) { return (S.contacts || []).filter(function (c) { return ids[String(c.id)] && quickOk(c); }).length; }
  function fbPrevHtml() {
    var p = FB.prev;
    if (p && p.why) return '<span class="m">' + E(p.why) + '</span>';
    if (!p || p.none) return '<span class="m">No condition yet: everyone shows.</span>';
    if (p.err) return '<span class="w152err">The count did not come back: ' + E(p.err) + '.</span>';
    if (!p.ids) return '<span class="m">Counting…</span>';
    var n = fbQuickCount(p.ids);
    return '<b class="' + (p.busy ? 'w295stale' : '') + '">' + plural(n, 'person matches', 'people match') + '</b>' + (S.ui.kind || S.ui.role || S.ui.act || S.ui.perm || S.ui.q ? '<span class="m"> with the menus and search above</span>' : '');
  }
  function fbApplyLabel() {
    var p = FB.prev;
    if (p && p.why) return 'Show the people';
    if (!p || p.none) return 'Show everyone';
    if (p.ids && !p.busy && !p.err) { var n = fbQuickCount(p.ids); return n === 1 ? 'Show 1 person' : 'Show ' + n.toLocaleString('en-CA') + ' people'; }
    return 'Show the people';
  }
  function fbPaintPrev() {
    var el = document.querySelector('#crm [data-w295prev]'); if (el) el.innerHTML = fbPrevHtml();
    var b = document.querySelector('#crm [data-w295apply]'); if (b) { b.textContent = fbApplyLabel(); b.disabled = !!fbApplyWhy(); }
    var sv = document.querySelector('#crm [data-w295save]'); if (sv) sv.disabled = !!fbSaveWhy();
    var w = document.querySelector('#crm [data-w295savewhy]'); if (w) w.textContent = !fbApplyWhy() && fbSaveWhy() ? 'Save as a list: ' + fbSaveWhy() : '';
  }
  function fbListsHtml() {
    var ls = (S.lists || []).filter(function (l) { return l.kind === 'dynamic' && l.filter && Array.isArray(l.filter.groups); });
    if (!ls.length) return '';
    return '<label class="w295lp"><span>Open a saved list</span><select class="w152sel" data-w295list aria-label="Open a saved live list as a view"><option value="">Choose a live list</option>' +
      ls.map(function (l) { return '<option value="' + E(l.id) + '">' + E(l.name) + '</option>'; }).join('') + '</select></label>';
  }
  function fbPanelHtml() {
    var anim = FB.anim; FB.anim = false;
    return '<section class="w295fb' + (anim ? ' w295in' : '') + '" id="w295fb" role="region" aria-labelledby="w295fbh">' +
      '<div class="w295fbt"><div><h3 id="w295fbh">Filters</h3><p class="m">A person shows when they match every condition in a group. With two groups or more, matching any one group is enough.</p></div>' + fbListsHtml() + '</div>' +
      groupsHtml(FB.draft, 'w295') +
      '<div class="w295fbf" aria-live="polite"><div class="w295cnt" data-w295prev>' + fbPrevHtml() + '</div>' +
      '<div class="w295acts"><button class="w152btn" data-w295apply' + (fbApplyWhy() ? ' disabled' : '') + '>' + E(fbApplyLabel()) + '</button><button class="w152btn ghost" data-w295save' + (fbSaveWhy() ? ' disabled' : '') + '>' + I('list') + ' Save as a list</button><button class="w152btn ghost" data-w295close>Close</button></div></div>' +
      '<div class="w295why" data-w295savewhy role="status">' + (!fbApplyWhy() && fbSaveWhy() ? E('Save as a list: ' + fbSaveWhy()) : '') + '</div>' +
      '<p class="m w295keys">Escape closes the filters.</p></section>';
  }
  function fbChipsHtml() {
    if (!fbOn()) return '';
    var gs = fbGroups();
    return '<div class="w295chips" role="list" aria-label="Filters in use">' + gs.map(function (g, gi) {
      return (gi ? '<span class="w295orc" role="listitem">or</span>' : '') + g.all.map(function (k, ci) {
        var w = condWords(k);
        return '<span class="w295chip" role="listitem"><span class="w295cw">' + E(w) + '</span><button class="w295cx" data-w295rm="' + gi + '.' + ci + '" aria-label="Remove the filter: ' + E(w) + '">' + I('x') + '</button></span>';
      }).join('');
    }).join('') + '<button class="w152mini" data-w295edit>' + I('edit') + ' Change</button><button class="w152mini" data-w295clear>' + I('x') + ' Clear filters</button></div>';
  }
  function fbButtonHtml() {
    var n = fbCount();
    return '<button class="w152btn soft w295btn" data-w295open aria-expanded="' + (FB.open ? 'true' : 'false') + '" aria-controls="w295fb">' + I('list') + ' Filters' + (n ? ' <em aria-label="' + n + ' in use">' + n + '</em>' : '') + '</button>';
  }
  function fbOpen(viaPointer) {
    FB.open = true; FB.anim = !!viaPointer;
    FB.draft = fbOn() ? fbClone(fbGroups()) : [{ all: [newCond('tag')] }];
    FB.prev = null;
    var need = [];
    if (!S.cfields) need.push(load('cfields'));
    if (!S.lists) need.push(load('lists'));
    paint();
    focusSoon('#w295fb [data-w295cf]');
    fbPreviewSoon();
    if (need.length) Promise.all(need).then(function () { if (FB.open && S.ui.tab === 'contacts') paint(); });
  }
  function fbClose() { FB.open = false; FB.prev = null; clearTimeout(FB.pT); paint(); focusSoon('[data-w295open]'); }
  /* a saved live list into the builder, shown at once */
  function fbOpenList(id) {
    var l = listById(id); if (!l || !l.filter || !Array.isArray(l.filter.groups)) return;
    var g = fbClone(l.filter.groups).map(function (x) { return { all: Array.isArray(x.all) ? x.all : [] }; });
    if (!g.length) g = [{ all: [] }];
    FB.draft = g; FB.prev = null;
    FB.msg = '“' + l.name + '” is open as a view. Changing the conditions here does not change the list.';
    fbApply(g).then(function () { if (!FB.err) FB.msg = '“' + l.name + '” is open as a view. Changing the conditions here does not change the list.'; paint(); });
  }
  function fbRemove(at) {
    var a = atOf(at), gs = fbClone(fbGroups()), flat = 0;
    if (!gs[a.g]) return;
    for (var i = 0; i < a.g; i++) flat += gs[i].all.length;
    flat += a.c;   /* the chip that follows takes the focus */
    gs[a.g].all.splice(a.c, 1);
    gs = gs.filter(function (g) { return g.all.length; });
    if (FB.open) FB.draft = gs.length ? fbClone(gs) : [{ all: [] }];
    fbApply(gs).then(function () {
      var all = document.querySelectorAll('#crm [data-w295rm]'), next = all[Math.min(flat, all.length - 1)];
      if (next) next.focus(); else focusSoon('[data-w295open]');
    });
  }
  /* the address on arrival: #crm/f/<filter> */
  function fbFromHash(token) {
    var r = fbDecode(token);
    if (!r || !r.groups.length) { FB.err = 'the filter in this link could not be read, so it is not used'; FB.note = ''; return; }
    var g = r.groups, note = r.dropped ? (r.dropped === 1 ? 'A condition in this link was not understood and is left out.' : r.dropped + ' conditions in this link were not understood and are left out.') : '';
    if (!note && JSON.stringify(cleanGroups(g).filter(function (x) { return x.all.length; })) === JSON.stringify(fbGroups())) return;
    if (!S.cfields) load('cfields').then(function () { if (S.ui.tab === 'contacts') paint(); });
    fbApply(g, { note: note });
  }
  var FOCUS_NEXT = '';   /* a place for the focus the next time the page is drawn with it (Save as a list: the list's name) */
  /* move the focus once the page is drawn again (keyboard users keep their place) */
  function focusSoon(sel) {
    if (!sel) return;
    setTimeout(function () { var el = document.querySelector(/^#|^\[/.test(sel) && sel.indexOf('#crm') !== 0 && sel.indexOf('#w295') !== 0 ? '#crm ' + sel : sel); if (el && el.focus) el.focus(); }, 0);
  }
  /* keep the focus and the tag lists' scroll when a builder is drawn again */
  function keepUi(fn) {
    var a = document.activeElement, keep = null;
    if (a && a.attributes && a.closest && a.closest('#crm')) {
      for (var i = 0; i < a.attributes.length; i++) {
        var nm = a.attributes[i].name;
        if (/^data-w(295|155)(cf|co|cv|ck|tq|and|or|gx|alias|list|apply|save|close|open|edit|clear|f)$/.test(nm)) { keep = { nm: nm, v: a.attributes[i].value, val: a.type === 'checkbox' ? a.value : null, s: a.selectionStart, e: a.selectionEnd }; break; }
      }
    }
    var scr = {};
    [].forEach.call(document.querySelectorAll('#crm .w295tl'), function (el) { var at = el.getAttribute('data-w295tl') || el.getAttribute('data-w155tl'); scr[(el.hasAttribute('data-w295tl') ? 'a' : 'b') + at] = el.scrollTop; });
    fn();
    [].forEach.call(document.querySelectorAll('#crm .w295tl'), function (el) { var at = el.getAttribute('data-w295tl') || el.getAttribute('data-w155tl'), k = (el.hasAttribute('data-w295tl') ? 'a' : 'b') + at; if (scr[k]) el.scrollTop = scr[k]; });
    if (FOCUS_NEXT) { var fe = document.querySelector('#crm ' + FOCUS_NEXT); if (fe) { FOCUS_NEXT = ''; fe.focus(); return; } }
    if (keep) {
      var sel = '#crm [' + keep.nm + '="' + keep.v.replace(/"/g, '\\"') + '"]' + (keep.val != null ? '[value="' + keep.val.replace(/"/g, '\\"') + '"]' : '');
      var el = null; try { el = document.querySelector(sel); } catch (e) { el = null; }
      if (el && el !== document.activeElement) { el.focus({ preventScroll: true }); try { if (keep.s != null && el.setSelectionRange) el.setSelectionRange(keep.s, keep.e); } catch (e) { /* fine */ } }
    }
  }

  /* ---------- wiring ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target, el; if (!t || !t.closest || !t.closest('.w152root')) return;
    if ((el = t.closest('[data-w295view]'))) {
      e.preventDefault();
      var id = el.getAttribute('data-w295view');
      FB.open = false; S.ui.tab = 'contacts';
      go('#crm');
      setTimeout(function () { fbOpenList(id); }, 0);
      return;
    }
    if ((el = t.closest('[data-w295open]'))) { e.preventDefault(); if (FB.open) fbClose(); else fbOpen(e.detail > 0); return; }
    if ((el = t.closest('[data-w295edit]'))) { e.preventDefault(); if (!FB.open) fbOpen(e.detail > 0); else focusSoon('#w295fb [data-w295cf]'); return; }
    if ((el = t.closest('[data-w295close]'))) { e.preventDefault(); fbClose(); return; }
    if ((el = t.closest('[data-w295clear]'))) { e.preventDefault(); FB.msg = ''; if (FB.open) FB.draft = [{ all: [] }]; FB.prev = null; fbApply([]); focusSoon('[data-w295open]'); return; }
    if ((el = t.closest('[data-w295rm]'))) { e.preventDefault(); fbRemove(el.getAttribute('data-w295rm')); return; }
    if ((el = t.closest('[data-w295apply]')) && FB.open) {
      e.preventDefault();
      if (fbApplyWhy()) { fbPaintPrev(); return; }
      var groups = cleanGroups(FB.draft).filter(function (g) { return g.all.length; }), p = FB.prev;
      FB.open = false;
      var ids = p && p.ids && !p.busy && !p.err && p.token === JSON.stringify(groups) ? p.ids : null;
      fbApply(FB.draft, { ids: ids }).then(function () { focusSoon('[data-w295open]'); });
      return;
    }
    if ((el = t.closest('[data-w295save]')) && FB.open) {
      e.preventDefault();
      if (fbSaveWhy()) { fbPaintPrev(); return; }
      /* what the builder shows is what the list gets; the Contacts list itself stays as it was (nothing runs while the Lists page opens) */
      LC.edit = { id: null, name: '', description: 'From the Contacts filters', groups: groupsFromFilters(cleanGroups(FB.draft).filter(function (g) { return g.all.length; })) }; LC.prev = null; LC.msg = ''; LC.err = '';
      FB.open = false;
      FOCUS_NEXT = '[data-w155f="name"]';   /* once the Lists page is drawn */
      go('#crm/lists');
      return;
    }
    if (FB.open && FB.draft) { var cc = condClick(FB.draft, 'w295', t); if (cc) { e.preventDefault(); fbPreviewSoon(); paint(); focusSoon(cc.focus); return; } }
  });
  function fbField(e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#w295fb')) return;
    if (t.hasAttribute('data-w295list')) { if (e.type === 'change' && t.value) fbOpenList(t.value); return; }
    if (t.hasAttribute('data-w295tq')) {
      if (e.type !== 'input') return;
      var at = t.getAttribute('data-w295tq'), a = atOf(at); TQ['w295' + at] = t.value;
      var tl = document.querySelector('#crm [data-w295tl="' + at + '"]'); if (tl && FB.draft[a.g]) tl.innerHTML = tagListHtml(FB.draft[a.g].all[a.c], at, 'w295');
      return;
    }
    var r = condEvent(FB.draft, 'w295', t, e.type);
    if (r) { fbPreviewSoon(); if (r === 'paint') paint(); }
  }
  document.addEventListener('input', fbField);
  document.addEventListener('change', fbField);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !FB.open || S.ui.tab !== 'contacts') return;
    var t = e.target;
    if (t && t.tagName === 'INPUT' && t.type === 'search' && t.value && t.hasAttribute('data-w295tq')) return;   /* Escape first empties a tag search box */
    if (document.getElementById('w152sheet') && document.getElementById('w152sheet').contains(t)) return;
    e.preventDefault(); fbClose();
  });
  var css295 = document.createElement('style'); css295.id = 'w295css';
  css295.textContent = ''
    + '.w295btn em{font-style:normal;background:' + GREEN + ';color:' + CREAM + ';border-radius:999px;padding:1px 7px;font-size:11.5px;font-variant-numeric:tabular-nums;}'
    + '.w295fb{background:var(--wa-card,' + CREAM + ');border-radius:16px;box-shadow:' + SH1 + ';padding:16px;margin:12px 0 4px;}'
    + '.w295fb.w295in{animation:w295in 180ms cubic-bezier(.23,1,.32,1);}@keyframes w295in{from{opacity:0;transform:translateY(-6px);}}'
    + '.w295fbt{display:flex;gap:12px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;margin-bottom:12px;}.w295fbt h3{margin:0 0 2px;font-size:16px;}.w295fbt p{margin:0;font-size:13px;max-width:62ch;}'
    + '.w295lp{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:var(--wa-muted,' + MUTED + ');min-width:0;max-width:100%;}.w295lp .w152sel{max-width:100%;width:260px;flex:none;}'
    + '.w295fbf{display:flex;gap:10px 16px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid rgba(16,63,57,.08);}'
    + '.w295cnt{font-size:14px;min-height:1.4em;font-variant-numeric:tabular-nums;}.w295stale{opacity:.6;}.w295acts{display:flex;gap:6px;flex-wrap:wrap;}'
    + '.w295keys{margin:8px 0 0;font-size:12px;}@media (hover:none){.w295keys{display:none;}}'
    + '@media (min-width:701px){.w155c.w295wide>.w152mini{grid-column:4;}}.w155c .w295val{grid-column:1/-1;min-width:0;}.w155c .w295help{grid-column:1/-1;font-size:12px;}'
    + '.w295opts{display:flex;flex-wrap:wrap;gap:6px;}.w295opts.col{flex-direction:column;flex-wrap:nowrap;gap:2px;}'
    + '.w295opt{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(16,63,57,.14);border-radius:10px;padding:6px 10px;font-size:13px;cursor:pointer;min-width:0;max-width:100%;background:var(--wa-card,' + CREAM + ');}'
    + '.w295opt span{min-width:0;overflow-wrap:anywhere;}.w295opt em{font-style:normal;color:var(--wa-muted,' + MUTED + ');font-size:12px;font-variant-numeric:tabular-nums;margin-left:auto;padding-left:6px;white-space:nowrap;}'
    + '.w295opt:has(input:checked){border-color:' + GREEN + ';background:rgba(16,63,57,.06);}.w295opt input{margin:0;accent-color:' + GREEN + ';flex:none;}.w295opt:focus-within{outline:2px solid ' + GOLD + ';outline-offset:1px;}'
    + '.w295opts.col .w295opt{border-color:transparent;background:none;border-radius:8px;}.w295opts.col .w295opt:has(input:checked){background:rgba(16,63,57,.06);}'
    + '.w295tp{display:flex;flex-direction:column;gap:6px;}.w295tp .w152in{width:100%;box-sizing:border-box;}.w295tl{max-height:220px;overflow:auto;overscroll-behavior:contain;border:1px solid rgba(16,63,57,.1);border-radius:10px;padding:4px;}'
    + '.w295al{display:flex;flex-direction:column;gap:4px;padding:4px;}.w295alias{all:unset;cursor:pointer;font-size:13px;padding:6px 8px;border-radius:8px;background:rgba(220,165,39,.15);overflow-wrap:anywhere;}.w295alias:focus-visible{outline:2px solid ' + GOLD + ';}'
    + '.w295none{padding:8px;}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}'
    + '.w295chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:10px 0 2px;}'
    + '.w295chip{display:inline-flex;align-items:center;gap:2px;max-width:100%;border-radius:14px;background:rgba(16,63,57,.08);color:' + GREEN + ';font-size:12.5px;font-weight:600;padding:3px 3px 3px 11px;line-height:1.35;}'
    + '.w295cw{min-width:0;overflow-wrap:anywhere;}.w295cx{border:none;background:none;color:inherit;cursor:pointer;border-radius:999px;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;flex:none;transition:transform 120ms cubic-bezier(.23,1,.32,1),background-color 150ms ease-out;}'
    + '.w295cx svg{width:13px;height:13px;}.w295cx:focus-visible{outline:2px solid ' + GOLD + ';outline-offset:1px;}.w295cx:active{transform:scale(.95);}'
    + '@media (hover:hover) and (pointer:fine){.w295cx:hover{background:rgba(16,63,57,.12);}.w295opt:hover{border-color:rgba(16,63,57,.3);}.w295alias:hover{background:rgba(220,165,39,.25);}}'
    + '.w295orc{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:' + PURPLE + ';}'
    + '.w295why{font-size:12.5px;color:var(--wa-muted,' + MUTED + ');min-height:0;margin-top:6px;}.w295why:empty{display:none;}'
    + '.w295msg{margin:8px 0 0;font-size:13px;}.w295err{margin:8px 0 0;padding:10px 12px;border-radius:12px;background:rgba(179,64,47,.08);color:' + FLAG + ';font-size:13px;font-weight:600;}'
    + '@media (max-width:560px){.w155c{grid-template-columns:minmax(0,1fr) auto;}.w155c>select:first-child{grid-column:1;grid-row:1;}.w155c>.w152mini{grid-column:2;grid-row:1;}.w155c>*:not(:first-child):not(.w152mini){grid-column:1/-1;}'
    + '.w295fb{padding:12px;}.w295lp,.w295lp .w152sel{width:100%;}.w295acts{width:100%;}.w295acts .w152btn{flex:1 1 auto;justify-content:center;}}'
    + '@media (prefers-reduced-motion:reduce){.w295fb.w295in{animation:none;}.w295cx:active{transform:none;}}';
  document.head.appendChild(css295);
