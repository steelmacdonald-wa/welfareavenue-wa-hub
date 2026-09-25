
  /* ---------- events ---------- */
  function copyText(t, btn) {
    var ok = function () { if (btn) { var o = btn.innerHTML; btn.classList.add('done'); btn.innerHTML = ic('check') + 'Copied'; setTimeout(function () { btn.classList.remove('done'); btn.innerHTML = o; }, 1600); } else toastS('Copied'); };
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(ok, function () { legacy(); }); return; } } catch (e) { /* below */ }
    legacy();
    function legacy() { try { var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); ok(); } catch (e) { toastS('Could not copy: select the text instead'); } }
  }
  document.addEventListener('click', async function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var el;
    if ((el = t.closest('[data-w118chelp]'))) { e.preventDefault(); help(); return; }
    if ((el = t.closest('[data-w118cpick]'))) {
      e.preventDefault(); e.stopPropagation();
      var where = el.getAttribute('data-w118cpick');
      if (where === 'cd') pick({ title: 'Pick a photo for the graphic', why: 'It sits behind the words on the tile.', onPick: function (p) { cdApply(p); } });
      else if (where === 'cal') pick({ title: 'Add a photo to the post', why: 'It is added to this post like an upload.', onPick: function (p) { intoComposer(p).then(function () { toastS('Photo added to the post'); }).catch(function (x) { toastS('Could not attach the photo: ' + ((x && x.message) || x)); }); } });
      return;
    }
    if ((el = t.closest('[data-w118ccdx]'))) { e.preventDefault(); try { WA_CD_IMG = null; } catch (x) { /* fine */ } var hint = document.getElementById('cdImgHint'); if (hint) hint.textContent = CD_HINT; cdShow(null); return; }
    var pk = t.closest('#w118cpk');
    if (pk) {
      if ((el = t.closest('[data-w118cpx]'))) { if (el.tagName !== 'A') e.preventDefault(); closePick(); return; }
      if ((el = t.closest('[data-w118cpr]'))) { P.pick.ready = !P.pick.ready; paintPick(); return; }
      if ((el = t.closest('[data-w118cpp]'))) { choose(el.getAttribute('data-w118cpp')); return; }
      return;
    }
    var inPage = t.closest('#photos'), inDr = t.closest('#w118cdr');
    if (!inPage && !inDr) return;
    if (inPage) {
      if ((el = t.closest('[data-w118cop]'))) { openPhoto(el.getAttribute('data-w118cop')); return; }
      if ((el = t.closest('[data-w118cgo]'))) { openUpload(); return; }
      if ((el = t.closest('[data-w118cu]'))) { if (el.classList.contains('off')) return; P.f.usage = el.getAttribute('data-w118cu'); P.limit = 120; paint(); return; }
      if ((el = t.closest('[data-w118cs]'))) { if (el.classList.contains('off')) return; var s = el.getAttribute('data-w118cs'); P.f.season = P.f.season === s ? '' : s; P.limit = 120; paint(); return; }
      if ((el = t.closest('[data-w118cpk]'))) { if (el.classList.contains('off')) return; P.f.picks = !P.f.picks; P.limit = 120; paint(); return; }
      if ((el = t.closest('[data-w118cst]'))) { var v = el.getAttribute('data-w118cst'); P.f.status = P.f.status === v ? '' : v; if (P.f.status) P.f.usage = ''; P.limit = 120; paint(); return; }
      if ((el = t.closest('[data-w118cclr]'))) { var c = el.getAttribute('data-w118cclr'); if (c === 'all') { P.f = blankF(); } else P.f[c] = ''; paint(); return; }
      if ((el = t.closest('[data-w118cmore]'))) { P.limit += 120; paint(); return; }
      return;
    }
    /* the side panel */
    if ((el = t.closest('[data-w118cx]'))) { e.preventDefault(); if (P.mode === 'edit') { if (P.edit && P.edit.dirty && !confirm('Close without saving the label changes?')) return; closeDrawer(true); return; } closeDrawer(false); return; }
    if ((el = t.closest('[data-w118cstep]'))) { step(Number(el.getAttribute('data-w118cstep'))); return; }
    var p = byKey(P.open);
    if ((el = t.closest('[data-w118ccopy]')) && p) {
      var what = el.getAttribute('data-w118ccopy');
      copyText(what === 'alt' ? p.alt_text : what === 'caption' ? p.caption : url(p, 'web'), what === 'link' ? null : el);
      if (what === 'link') toastS('Link copied (the web size)');
      return;
    }
    if ((el = t.closest('[data-w118cuse]')) && p) { var u = el.getAttribute('data-w118cuse'); if (u === 'create') { closeDrawer(true); toCreate(p); } else toPost(p); return; }
    if ((el = t.closest('[data-w118ctag]'))) { P.f = blankF(); P.f.tag = el.getAttribute('data-w118ctag'); closeDrawer(true); paint(); return; }
    if ((el = t.closest('[data-w118cseries]'))) { P.f = blankF(); P.f.series = el.getAttribute('data-w118cseries'); P.sort = 'taken_asc'; closeDrawer(true); paint(); return; }
    if ((el = t.closest('[data-w118copen]'))) { var k = el.getAttribute('data-w118copen'), q = byKey(k); if (q) { openPhoto(k); if (q.status === 'needs_labels') startEdit(q); } return; }
    if ((el = t.closest('[data-w118cchoose]'))) { e.preventDefault(); var fi = document.getElementById('w118cfile'); if (fi) fi.click(); return; }
    if ((el = t.closest('[data-w118cbest]')) && P.edit) { readForm(); var b = el.getAttribute('data-w118cbest'), list = arr(P.edit.v.best_for); var ix = list.indexOf(b); if (ix >= 0) list.splice(ix, 1); else list.push(b); P.edit.v.best_for = list; P.edit.dirty = true; paintDrawer(); return; }
    if ((el = t.closest('[data-w118cai]'))) { e.preventDefault(); useAi(el.getAttribute('data-w118cai')); return; }
    if ((el = t.closest('[data-w118cfocal]')) && P.edit) {
      var img = el.querySelector('img'); if (!img) return;
      var r = img.getBoundingClientRect(); if (!r.width || !r.height) return;
      readForm();
      P.edit.v.focal_x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      P.edit.v.focal_y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      P.edit.dirty = true; paintDrawer(); return;
    }
    if ((el = t.closest('[data-w118cact]'))) {
      var act = el.getAttribute('data-w118cact');
      if (act === 'edit' && p) { startEdit(p); return; }
      if (act === 'cancel') { if (P.edit && P.edit.dirty && !confirm('Drop the label changes?')) return; P.mode = 'view'; P.edit = null; paintDrawer(); return; }
      if (act === 'save') { await saveEdit(); return; }
      if (act === 'suggest') { await aiEdit(); return; }
      if (act === 'clearup') { if (P.up && !P.up.running) P.up.items = []; paintDrawer(); return; }
      if (act === 'review') { P.f = blankF(); P.f.status = 'needs_labels'; P.sort = 'added'; paint(); var first = sortRows(P.rows.filter(function (x) { return x.status === 'needs_labels'; }))[0]; if (first) { openPhoto(first.key); startEdit(first); } else closeDrawer(true); return; }
      if (act === 'archive' && p) {
        if (!confirm('Archive "' + p.title + '"? It leaves the library and the pickers; you can restore it from Archived.')) return;
        try { await update(p.key, { status: 'archived' }, { field: 'status', from: p.status, to: 'archived' }); toastS('Archived'); closeDrawer(true); paint(); } catch (x) { toastS('Could not archive: ' + ((x && x.message) || x)); }
        return;
      }
      if (act === 'restore' && p) {
        var to = p.labelled_by && p.usage !== 'check' ? 'ready' : 'needs_labels';
        try { await update(p.key, { status: to }, { field: 'status', from: 'archived', to: to }); toastS('Restored'); paint(); paintDrawer(); } catch (x) { toastS('Could not restore: ' + ((x && x.message) || x)); }
        return;
      }
      if (act === 'delete' && p) {
        if (!admin()) return;
        if (!confirm('Delete "' + p.title + '" for good? The three files and the labels go, and this cannot be undone.')) return;
        try {
          var d = await db.from('wa_photos').delete().eq('key', p.key).select();
          if (d.error) throw d.error;
          if (Array.isArray(d.data) && !d.data.length) throw new Error('only a hub admin can delete');
          var paths = [p.path_full, p.path_web, p.path_thumb].filter(Boolean);
          if (paths.length) { try { await db.storage.from(BUCKET).remove(paths); } catch (x) { /* the row is gone; files can be swept later */ } }
          try { if (typeof logChange === 'function') logChange('photo', p.key, 'deleted', p.title, null); } catch (x) { /* audit */ }
          P.rows = P.rows.filter(function (x) { return x.key !== p.key; });
          closeDrawer(true); paint(); toastS('Deleted');
        } catch (x) { toastS('Could not delete: ' + ((x && x.message) || x)); }
        return;
      }
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.closest && e.target.closest('#photos [role="button"]') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.target.click(); return; }
    if (e.target && e.target.closest && e.target.closest('#w118cdr .opts [role="button"], #w118cpk [role="button"]') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.target.click(); return; }
    if (P.pick) { if (e.key === 'Escape') { e.preventDefault(); closePick(); } return; }
    if (!P.mode) return;
    var typing = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (e.key === 'Escape') { e.preventDefault(); if (P.mode === 'edit') { if (P.edit && P.edit.dirty && !confirm('Close without saving the label changes?')) return; P.mode = 'view'; P.edit = null; paintDrawer(); return; } closeDrawer(false); return; }
    if (typing) { if (P.mode === 'edit' && (e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); saveEdit(); } return; }
    if (P.mode === 'view' && e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    if (P.mode === 'view' && e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t) return;
    if (t.id === 'w118cq') { P.f.q = t.value; P.limit = 120; clearTimeout(P.qT); P.qT = setTimeout(paint, 160); return; }
    if (t.id === 'w118cpq' && P.pick) { P.pick.q = t.value; clearTimeout(P.pqT); P.pqT = setTimeout(paintPick, 140); return; }
    if (P.edit && t.closest && t.closest('#w118cdr') && t.hasAttribute('data-w118cf')) {
      P.edit.dirty = true; var k = t.getAttribute('data-w118cf'); if (P.edit.flag[k]) { P.edit.flag[k] = false; t.classList.remove('aiflag'); }
      var cnt = document.querySelector('#w118cdr [data-w118ccnt="' + k + '"]'); if (cnt) { var max = Number((cnt.textContent.split('/')[1] || '0').trim()); cnt.textContent = t.value.length + ' / ' + max; cnt.classList.toggle('bad', t.value.length > max); }
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t) return;
    if (t.id === 'w118cscene') { P.f.scene = t.value; P.limit = 120; paint(); return; }
    if (t.id === 'w118csort') { P.sort = t.value; P.limit = 120; paint(); return; }
    if (t.id === 'w118cfile') { addFiles(t.files); t.value = ''; return; }
    if (P.edit && t.closest && t.closest('#w118cdr') && t.hasAttribute('data-w118cf')) {
      P.edit.dirty = true;
      if (t.getAttribute('data-w118cf') === 'taken_on') { readForm(); if (!P.edit.v.season && P.edit.v.taken_on) { P.edit.v.season = seasonOf(P.edit.v.taken_on); paintDrawer(); } }
    }
  });
  /* drop files on the Add photos panel */
  document.addEventListener('dragover', function (e) { if (P.mode !== 'upload' || !e.target.closest || !e.target.closest('#w118cdr')) return; e.preventDefault(); var d = document.getElementById('w118cdrop'); if (d) d.classList.add('over'); });
  document.addEventListener('dragleave', function (e) { var d = document.getElementById('w118cdrop'); if (d && e.target === d) d.classList.remove('over'); });
  document.addEventListener('drop', function (e) {
    if (P.mode !== 'upload' || !e.target.closest || !e.target.closest('#w118cdr')) return;
    e.preventDefault(); var d = document.getElementById('w118cdrop'); if (d) d.classList.remove('over');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });

  /* ---------- the page in the hub: route, menu, permissions ---------- */
  async function show(h) {
    var sec = panel(); if (!sec) return;
    try { document.title = 'Photo library \u00b7 Welfare Avenue Hub'; } catch (e) { /* fine */ }
    var sub = decodeURIComponent(String(h || '').split('/').slice(1).join('/'));
    if (!P.loaded) paint();
    await load(false);
    paint();
    if (!allowed()) return;
    if (sub === 'new') { if (staff()) openUpload(); return; }
    if (sub === 'review') { P.f = blankF(); P.f.status = 'needs_labels'; P.sort = 'added'; paint(); return; }
    if (sub) { if (byKey(sub)) { if (P.open !== sub || P.mode !== 'view') openPhoto(sub, true); } else toastS('That photo is not in the library'); return; }
    if (P.mode && P.mode !== 'upload') closeDrawer(true);
  }
  function register() {
    if (!window.WA_NAV || !WA_NAV.register) return;
    var known = (WA_NAV.pages || []).some(function (p) { return p && p.id === 'photos'; });
    var bar = document.getElementById('tabBar'), has = bar && bar.querySelector('.tab[data-tab="photos"]');
    if (known && has) return;
    WA_NAV.register({ id: 'photos', label: 'Photo library', group: 'more', dot: GOLD, gate: 'member', noRoute: known, onShow: function (h) { show(h); } });
  }
  function place() {
    try {
      var bar = document.getElementById('tabBar'); if (!bar) return;
      var b = bar.querySelector('.tab[data-tab="photos"]'); if (!b) return;
      b.setAttribute('data-w118c', '1');
      var host = bar.querySelector('.tab-group[data-w42g="more"] .tab-group-p'); if (!host) return;
      var br = host.querySelector('.tab[data-tab="brain"]');
      if (br) { if (br.nextSibling !== b) host.insertBefore(b, br.nextSibling); }
      else if (b.parentNode !== host) host.appendChild(b);
      /* remember when the group shows only because of this tab (board accounts), for the harness */
      var others = false; host.querySelectorAll('.tab').forEach(function (x) { if (x !== b && x.style.display !== 'none') others = true; });
      var grp = host.closest('.tab-group'); if (grp) { if (!others) { if (grp.getAttribute('data-w118cg') !== '1') grp.setAttribute('data-w118cg', '1'); } else if (grp.hasAttribute('data-w118cg')) grp.removeAttribute('data-w118cg'); }
      /* the group header was hidden before this tab moved in (wave42 hides empty groups): show it, as wave42 would */
      var hd = grp && grp.querySelector('.tab-group-h');
      if (hd && hd.style.display === 'none' && b.style.display !== 'none') hd.style.display = '';
    } catch (e) { /* cosmetic */ }
  }
  function enrol() {
    try {
      if (typeof wa40Allowed === 'function' && !wa40Allowed.__w118c) {
        var __al = wa40Allowed;
        wa40Allowed = function () { var a = __al.apply(this, arguments) || []; if ((board() || staff()) && a.indexOf('photos') < 0) a = a.concat(['photos']); return a; };
        Object.keys(__al).forEach(function (k) { try { wa40Allowed[k] = __al[k]; } catch (e) { /* fine */ } });
        wa40Allowed.__w118c = true;
      }
    } catch (e) { /* fine */ }
  }
  var tick = null;
  function later() { if (tick) return; tick = setTimeout(function () { tick = null; place(); cdEnsure(); cdWatch(); calWatch(); teamTools(); }, 150); }
  panel();
  register();
  if (typeof startApp === 'function') {
    var __sa118c = startApp;
    startApp = async function () {
      var r = await __sa118c.apply(this, arguments);
      try {
        enrol(); panel(); register(); place();
        if (typeof wa40Enforce === 'function') wa40Enforce();
        [400, 1500, 3500].forEach(function (ms) { setTimeout(function () { register(); place(); }, ms); });
        new MutationObserver(function (muts) { for (var i = 0; i < muts.length; i++) { if (muts[i].addedNodes && muts[i].addedNodes.length) { later(); return; } } }).observe(document.body, { childList: true, subtree: true });
        var h = decodeURIComponent(location.hash || '');
        if (h === '#photos' || h.indexOf('#photos/') === 0) { try { applyHash(); } catch (e) { show(h.slice(1)); } }
      } catch (e) { console.warn('wave118c boot', e); }
      return r;
    };
  }
  window.addEventListener('hashchange', function () {
    var h = decodeURIComponent(location.hash || '');
    if (h.indexOf('#photos') !== 0 && P.mode) closeDrawer(true);
    if (h.indexOf('#photos') !== 0 && P.pick && h.indexOf('#create') !== 0 && h.indexOf('#contentcal') !== 0) closePick();
  });

  /* ---------- the public face (other waves, the harness) ---------- */
  W.pick = pick;
  W.url = url;
  W.rows = function () { return P.rows.slice(); };
  W.load = load;
  W.cleanNode = function (el) {
    var c = el.cloneNode(true);
    if (c.matches && c.matches('[data-w118c]')) return document.createElement('div');
    c.querySelectorAll('[data-w118c]').forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    /* a menu group that only showed because of the library tab hides again, as wave42 would */
    c.querySelectorAll('.tab-group').forEach(function (g) {
      var mark = g.getAttribute('data-w118cg') === '1'; g.removeAttribute('data-w118cg');
      var hd = g.querySelector('.tab-group-h'); if (!hd || hd.style.display === 'none' || !mark) return;
      var any = false; g.querySelectorAll('.tab').forEach(function (t) { if (t.style.display !== 'none') any = true; });
      if (!any) hd.style.display = 'none';
    });
    c.normalize();
    return c;
  };
  W.clean = function (el) { return W.cleanNode(el).outerHTML; };
})();
