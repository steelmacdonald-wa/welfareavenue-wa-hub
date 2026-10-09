
  /* ---------- the side panel: one photo ---------- */
  function drawerEl() { var d = document.getElementById('w118cdr'); if (!d) { d = document.createElement('div'); d.id = 'w118cdr'; d.setAttribute('data-w118c', '1'); document.body.appendChild(d); } return d; }
  function neighbours() { var list = shown(); var i = list.findIndex(function (x) { return x.key === P.open; }); return { list: list, i: i }; }
  function openPhoto(key, fromRoute) {
    var p = byKey(key); if (!p) { toastS('That photo is not in the library'); return; }
    P.open = key; P.mode = 'view'; P.edit = null; paintDrawer();
    if (!fromRoute) { try { history.replaceState(null, '', '#photos/' + encodeURIComponent(key)); } catch (e) { /* fine */ } }
  }
  function closeDrawer(force) {
    if (!P.mode) return;
    if (!force && P.mode === 'edit' && P.edit && P.edit.dirty && !confirm('Close without saving the label changes?')) return;
    if (!force && P.mode === 'upload' && P.up && P.up.running) toastS('Still adding photos in the background');
    P.open = null; P.mode = null; P.edit = null;
    var d = document.getElementById('w118cdr'); if (d) d.remove();
    try { if (/^#photos\/./.test(location.hash)) history.replaceState(null, '', '#photos'); } catch (e) { /* fine */ }
  }
  function step(dir) {
    if (P.mode !== 'view') return;
    var n = neighbours(); if (n.i < 0) return;
    var nx = n.list[n.i + dir]; if (nx) openPhoto(nx.key);
  }
  function copyBox(lbl, text, key, sub) {
    return '<div class="sec"><div class="lbl">' + E(lbl) + (sub ? ' <small>' + E(sub) + '</small>' : '') + '</div><div class="copy"><p' + (text ? '' : ' class="none"') + '>' + (text ? E(text) : 'Not written yet.') + '</p>' + (text ? '<button type="button" data-w118ccopy="' + key + '">' + ic('copy') + 'Copy</button>' : '') + '</div></div>';
  }
  function fact(dt, dd) { return dd ? '<dt>' + E(dt) + '</dt><dd>' + dd + '</dd>' : ''; }
  function viewHtml(p) {
    var st = staff(), n = neighbours(), u = USAGE[p.usage] || USAGE.check;
    var useTitle = p.status === 'archived' ? 'Archived' : p.status === 'needs_labels' ? 'Needs a look' : u.long;
    var useText = p.status === 'archived' ? 'Hidden from the library. ' + (st ? 'Restore it to use it again.' : '') : p.status === 'needs_labels' ? 'New, with first labels from the Hub that nobody has confirmed yet. ' + (p.usage && p.usage !== 'check' ? 'The Hub thinks: ' + u.long.toLowerCase() + '.' : '') : u.tip;
    var h = '<div class="bk" data-w118cx="1"></div><aside class="pn" role="dialog" aria-modal="true" aria-label="' + E(p.title) + '">' +
      '<header><h3 title="' + E(p.title) + '">' + E(p.title) + '</h3>' + (n.i >= 0 ? '<span class="ct">' + (n.i + 1) + ' of ' + n.list.length + '</span>' : '') +
      '<button class="ib" data-w118cstep="-1" title="Previous (left arrow)" aria-label="Previous photo"' + (n.i > 0 ? '' : ' disabled') + '>' + ic('left') + '</button>' +
      '<button class="ib" data-w118cstep="1" title="Next (right arrow)" aria-label="Next photo"' + (n.i >= 0 && n.i < n.list.length - 1 ? '' : ' disabled') + '>' + ic('right') + '</button>' +
      '<button class="ib" data-w118cx="1" title="Close (Esc)" aria-label="Close">' + ic('close') + '</button></header>' +
      '<div class="bd">' +
      '<figure class="hero" style="margin:0 0 14px;background:' + E(p.color || '#d9d6cc') + '"><span class="fw"><img src="' + E(url(p, 'web')) + '" alt="' + E(p.alt_text || p.title) + '"></span></figure>' +
      '<div class="use ' + uclass(p) + '"><b>' + E(useTitle) + '</b>' + E(useText) + (p.usage_note ? '<p>' + E(p.usage_note) + '</p>' : '') + '</div>' +
      '<div class="acts">' +
      (st && p.status !== 'archived' && tabOk('create') ? '<button type="button" class="pri" data-w118cuse="create">' + ic('brush') + 'Use in the Create studio</button>' : '') +
      (st && p.status !== 'archived' && typeof window.w121Compose === 'function' && tabOk('contentcal') ? '<button type="button" class="pri" data-w118cuse="post">' + ic('calendar') + 'Use in a post</button>' : '') +
      '<button type="button" data-w118ccopy="link">' + ic('link') + 'Copy the link</button>' +
      '<a href="' + E(dlUrl(p, 'web')) + '" download>' + ic('download') + 'Download</a>' +
      '</div>' +
      copyBox('Alt text', p.alt_text, 'alt', 'for screen readers, paste it in the alt text field') +
      copyBox('Caption', p.caption, 'caption', 'a starting line for a post or a report') +
      (p.description ? '<div class="sec"><div class="lbl">About this photo</div><p class="desc">' + E(p.description) + '</p></div>' : '') +
      '<div class="sec"><div class="lbl">Download</div><div class="dl">' + SIZES.map(function (s) {
        var w = p.width, hh = p.height, big = Math.max(w || 0, hh || 0), sc = big ? Math.min(1, s[1] / big) : 0;
        var dims = s[0] === 'full' && w ? w + ' x ' + hh : sc ? Math.round(w * sc) + ' x ' + Math.round(hh * sc) : '';
        return '<a href="' + E(dlUrl(p, s[0])) + '" download title="' + E(s[4]) + '">' + ic('download') + E(s[3]) + ' <span>' + E([dims, bytes(p['bytes_' + s[0]])].filter(Boolean).join(', ')) + '</span></a>';
      }).join('') + '</div><div class="dlh">Full for print and big screens, Web for posts, the website and decks, Thumbnail for emails. No location or camera data in any of them.</div></div>' +
      (arr(p.tags).length ? '<div class="sec"><div class="lbl">Tags</div><div class="tags">' + arr(p.tags).map(function (t) { return '<span data-w118ctag="' + E(t) + '" title="Show every photo tagged ' + E(t) + '">' + E(t) + '</span>'; }).join('') + '</div></div>' : '') +
      '<div class="sec"><div class="lbl">Details</div><dl class="facts">' +
      fact('Taken', p.taken_on ? E(niceDate(p.taken_on)) + (p.date_note ? '<small>' + E(p.date_note) + '</small>' : '') : (p.date_note ? E(p.date_note) : 'Date unknown')) +
      fact('Season', E(label(SEASONS, p.season))) +
      fact('Place', E(p.place || '')) +
      fact('Event', E(p.event || '')) +
      fact('Scene', E(label(SCENES, p.scene))) +
      fact('People', E(p.people || '')) +
      fact('Partners', E(arr(p.partner).join(', '))) +
      fact('Branding', E(label(BRANDING, p.branding))) +
      fact('Set', p.series ? '<a data-w118cseries="' + E(p.series) + '">' + E(p.series) + '</a> <small>' + P.rows.filter(function (x) { return x.series === p.series && x.status !== 'archived'; }).length + ' photos in this set</small>' : '') +
      fact('Best for', arr(p.best_for).length ? '<span class="tags">' + arr(p.best_for).map(function (b) { return '<span class="bf">' + E(label(BEST, b)) + '</span>'; }).join('') + '</span>' : '') +
      fact('Size', p.width ? E(p.width + ' x ' + p.height + ' px') + (p.orientation ? ', ' + E(p.orientation) : '') : '') +
      fact('Credit', E(p.credit || '')) +
      fact('Notes', E(p.notes || '')) +
      fact('Source', E(p.source || '')) +
      fact('Labels', E(p.labelled_by || '') + (p.updated_by && p.updated_by !== p.labelled_by ? '<small>Last change by ' + E(p.updated_by) + '</small>' : '')) +
      fact('File name', '<code>' + E(p.key) + '.jpg</code>') +
      '</dl></div>' +
      '</div>';
    var foot = '';
    if (st) {
      foot = '<footer>' +
        (p.status === 'archived' ? '<button type="button" class="b" data-w118cact="restore">' + ic('restore') + 'Restore</button>' : '<button type="button" class="b go" data-w118cact="edit">' + ic('pen') + (p.status === 'needs_labels' ? 'Check the labels' : 'Edit the labels') + '</button>') +
        '<span class="sp"></span>' +
        (p.status === 'archived' ? (admin() ? '<button type="button" class="lnk del" data-w118cact="delete">' + ic('trash') + 'Delete for good</button>' : '') : '<button type="button" class="lnk" data-w118cact="archive">' + ic('archive') + 'Archive</button>') +
        '</footer>';
    }
    return h + foot + '</aside>';
  }

  /* ---------- editing the labels ---------- */
  var FIELDS = ['title', 'alt_text', 'caption', 'description', 'usage', 'usage_note', 'people', 'taken_on', 'date_note', 'season', 'place', 'event', 'scene', 'series', 'tags', 'partner', 'branding', 'best_for', 'is_pick', 'focal_x', 'focal_y', 'credit', 'notes'];
  function startEdit(p) {
    var v = {}; FIELDS.forEach(function (k) { v[k] = Array.isArray(p[k]) ? p[k].slice() : p[k]; });
    P.mode = 'edit'; P.edit = { key: p.key, v: v, dirty: false, ai: null, aiBusy: false, aiErr: null, flag: {} };
    if (p.status === 'needs_labels' && p.ai_suggestion && p.ai_suggestion.fields) { P.edit.ai = p.ai_suggestion; }
    paintDrawer();
  }
  function val(k) { var v = P.edit.v[k]; return v == null ? '' : v; }
  function aiHint(k) {
    var e = P.edit; if (!e || !e.ai || !e.ai.fields || e.ai.fields[k] == null) return '';
    if (k === 'focal_x') {
      var ax = Number(e.ai.fields.focal_x), ay = Number(e.ai.fields.focal_y);
      if (Math.abs(Number(e.v.focal_x) - ax) < 0.01 && Math.abs(Number(e.v.focal_y) - ay) < 0.01) return '';
      return '<div class="aih">' + ic('sparkle') + '<span>The Hub suggests: the main subject sits ' + Math.round(ax * 100) + '% across and ' + Math.round(ay * 100) + '% down</span><a data-w118cai="focal_x">Use this</a></div>';
    }
    var s = e.ai.fields[k], cur = e.v[k];
    var same = Array.isArray(s) ? arr(cur).join('|') === s.join('|') : String(cur == null ? '' : cur) === String(s);
    if (same) return '';
    var shownV = Array.isArray(s) ? s.map(function (x) { return k === 'best_for' ? label(BEST, x) : x; }).join(' \u00b7 ') : k === 'usage' ? USAGE[s].label : k === 'season' ? label(SEASONS, s) : k === 'scene' ? label(SCENES, s) : k === 'branding' ? label(BRANDING, s) : String(s);
    return '<div class="aih">' + ic('sparkle') + '<span>The Hub suggests: ' + E(shownV) + '</span><a data-w118cai="' + k + '">Use this</a></div>';
  }
  function inp(k, lab, opts) {
    opts = opts || {};
    var id = 'w118cf-' + k, v = val(k), fl = P.edit.flag[k] ? ' aiflag' : '';
    var cnt = opts.max ? '<span class="cnt' + (String(v).length > opts.max ? ' bad' : '') + '" data-w118ccnt="' + k + '">' + String(v).length + ' / ' + opts.max + '</span>' : '';
    var field;
    if (opts.area) field = '<textarea id="' + id + '" data-w118cf="' + k + '" class="' + fl + '" rows="' + (opts.rows || 2) + '" placeholder="' + E(opts.ph || '') + '">' + E(v) + '</textarea>';
    else if (opts.select) field = '<select id="' + id + '" data-w118cf="' + k + '" class="' + fl + '">' + (opts.blank ? '<option value="">' + E(opts.blank) + '</option>' : '') + opts.select.map(function (o) { return '<option value="' + E(o[0]) + '"' + (String(v) === String(o[0]) ? ' selected' : '') + '>' + E(o[1]) + '</option>'; }).join('') + '</select>';
    else field = '<input type="' + (opts.date ? 'date' : 'text') + '" id="' + id + '" data-w118cf="' + k + '" class="' + fl + '" value="' + E(Array.isArray(v) ? v.join(', ') : v) + '" placeholder="' + E(opts.ph || '') + '">';
    return '<div class="' + (opts.full ? 'full' : '') + '"><label class="fl" for="' + id + '">' + E(lab) + cnt + '</label>' + field + (opts.hint ? '<div class="hint">' + E(opts.hint) + '</div>' : '') + aiHint(k) + '</div>';
  }
  function cropsHtml(p) {
    var fx = Number(val('focal_x') || 0.5), fy = Number(val('focal_y') || 0.5), pos = 'object-position:' + Math.round(fx * 100) + '% ' + Math.round(fy * 100) + '%;';
    return '<div class="crops">' + CROPS.map(function (c) { var hgt = 86, wd = Math.round(hgt * c[1]); return '<div><div class="cv" style="width:' + wd + 'px;height:' + hgt + 'px;background:' + E(p.color || '#ddd') + '"><img src="' + E(url(p, 'thumb')) + '" alt="" style="' + pos + '"></div>' + E(c[0]) + '</div>'; }).join('') + '</div>';
  }
  function editHtml(p) {
    var e = P.edit, fx = Number(val('focal_x') || 0.5), fy = Number(val('focal_y') || 0.5);
    var h = '<div class="bk" data-w118cx="1"></div><aside class="pn" role="dialog" aria-modal="true" aria-label="Edit the labels">' +
      '<header><h3>' + (p.status === 'needs_labels' ? 'Check the labels' : 'Edit the labels') + '</h3><button class="ib" data-w118cx="1" title="Close (Esc)" aria-label="Close">' + ic('close') + '</button></header><div class="bd">' +
      '<figure class="hero pickable" style="margin:0 0 8px;background:' + E(p.color || '#d9d6cc') + '"><span class="fw" data-w118cfocal="1"><img src="' + E(url(p, 'web')) + '" alt="' + E(p.alt_text || p.title) + '" draggable="false"><span class="fm" style="left:' + (fx * 100) + '%;top:' + (fy * 100) + '%"></span></span></figure>' +
      '<p class="note" style="margin:0 0 6px">' + ic('target') + ' Click the photo on the main subject: every crop keeps that point in view.</p>' + cropsHtml(p) + aiHint('focal_x') +
      '<div style="height:16px"></div>' +
      (e.aiBusy ? '<div class="busy"><i></i>Looking at the photo...</div>' : '') +
      (e.aiErr ? '<div class="use u-consent" style="margin:0 0 14px"><b>No suggestion from the Hub</b>' + E(e.aiErr) + '</div>' : '') +
      (e.ai && e.ai.fields && !e.aiBusy ? '<div class="use u-check" style="margin:0 0 14px"><b>The Hub\u2019s suggestion' + (e.ai.model ? ' (' + E(String(e.ai.model).replace(/^[a-z-]+\//, '')) + ')' : '') + '</b>Fields the Hub would change show a purple note: Use this takes it. <a data-w118cai="*" style="font-weight:800;cursor:pointer;text-decoration:underline">Use every suggestion</a></div>' : '') +
      '<div class="fs"><h4>What it shows</h4><div class="fg">' +
      inp('title', 'Title', { full: true, ph: 'A few words, no date' }) +
      inp('alt_text', 'Alt text', { full: true, area: true, max: 250, ph: 'Who (by role) and what is visible, and where', hint: 'Read aloud by screen readers. One sentence; describe people by role, not by name.' }) +
      inp('caption', 'Caption', { full: true, area: true, ph: 'One warm line about the moment' }) +
      inp('description', 'Description', { full: true, area: true, rows: 3, ph: 'Two or three sentences for the library' }) +
      '</div></div>' +
      '<div class="fs"><h4>Can we use it</h4><div class="fg">' +
      inp('usage', 'Cleared for', { select: USAGE_ORDER.map(function (u) { return [u, USAGE[u].label + ': ' + USAGE[u].long.toLowerCase()]; }) }) +
      inp('people', 'People in it', { ph: 'Three volunteers in green vests' }) +
      inp('usage_note', 'Why', { full: true, area: true, ph: 'Who is recognizable, what to crop, whose consent we have', hint: 'When someone gives consent, set it to Ready and note who agreed and when.' }) +
      '</div></div>' +
      '<div class="fs"><h4>When and where</h4><div class="fg">' +
      inp('taken_on', 'Taken on', { date: true }) +
      inp('season', 'Season', { select: SEASONS, blank: 'Not set' }) +
      inp('date_note', 'About the date', { full: true, ph: 'From the camera; or roughly, from the event' }) +
      inp('place', 'Place', { ph: 'Montreal' }) +
      inp('event', 'Event', { ph: 'Sunday serving' }) +
      inp('scene', 'Scene', { select: SCENES, blank: 'Not set' }) +
      inp('series', 'Set', { ph: 'serving-2024-10', hint: 'Photos from the same moment share a set name.' }) +
      '</div></div>' +
      '<div class="fs"><h4>Finding it</h4><div class="fg">' +
      inp('tags', 'Tags', { full: true, ph: 'volunteers, tent, summer', hint: 'Separate with commas.' }) +
      inp('partner', 'Partners in view', { ph: 'VCSA' }) +
      inp('branding', 'Branding', { select: BRANDING, blank: 'Not set' }) +
      '<div class="full"><label class="fl">Best for</label><div class="opts">' + BEST.map(function (b) { return '<span data-w118cbest="' + b[0] + '" class="' + (arr(val('best_for')).indexOf(b[0]) >= 0 ? 'on' : '') + '" role="button" tabindex="0">' + E(b[1]) + '</span>'; }).join('') + '</div>' + aiHint('best_for') + '</div>' +
      '<div class="full"><label class="ck"><input type="checkbox" data-w118cf="is_pick"' + (val('is_pick') ? ' checked' : '') + '> One of our picks (the best of a set, first choice for decks and posts)</label></div>' +
      '</div></div>' +
      '<div class="fs"><h4>Credit and notes</h4><div class="fg">' +
      inp('credit', 'Credit', { ph: 'Photographer, if we should credit one' }) +
      inp('notes', 'Notes', { area: true, ph: 'Anything the next person should know' }) +
      '</div></div>' +
      '</div><footer>' +
      '<button type="button" class="b" data-w118cact="cancel">Cancel</button>' +
      '<button type="button" class="b ai" data-w118cact="suggest"' + (e.aiBusy ? ' disabled' : '') + '>' + ic('sparkle') + (e.ai ? 'Ask the Hub again' : 'Suggest with the Hub') + '</button>' +
      '<span class="sp"></span>' +
      '<button type="button" class="b go" data-w118cact="save">' + ic('check') + (p.status === 'needs_labels' ? (P.rows.filter(function (x) { return x.status === 'needs_labels' && x.key !== p.key; }).length ? 'Save and next' : 'Save and confirm') : 'Save') + '</button>' +
      '</footer></aside>';
    return h;
  }
  function readForm() {
    var e = P.edit; if (!e) return;
    document.querySelectorAll('#w118cdr [data-w118cf]').forEach(function (el) {
      var k = el.getAttribute('data-w118cf');
      if (k === 'is_pick') { e.v[k] = !!el.checked; return; }
      var v = el.value;
      if (k === 'tags') e.v[k] = arr(v).map(function (x) { return x.toLowerCase(); });
      else if (k === 'partner') e.v[k] = arr(v);
      else e.v[k] = v;
    });
  }
  function paintDrawer() {
    if (!P.mode) return;
    var d = drawerEl(), bd = d.querySelector('.bd'), scroll = bd ? bd.scrollTop : 0, prevMode = d.getAttribute('data-mode'), prevKey = d.getAttribute('data-key');
    if (P.mode === 'upload') { d.innerHTML = uploadHtml(); }
    else {
      var p = byKey(P.open); if (!p) { closeDrawer(true); return; }
      d.innerHTML = P.mode === 'edit' ? editHtml(p) : viewHtml(p);
    }
    var same = prevMode === P.mode && prevKey === String(P.open);
    d.setAttribute('data-mode', P.mode); d.setAttribute('data-key', String(P.open));
    var nb = d.querySelector('.bd'); if (nb && same) nb.scrollTop = scroll;
    if (!same) { var f = d.querySelector(P.mode === 'edit' ? '#w118cf-title' : '.ib[data-w118cx]'); if (f) try { f.focus({ preventScroll: true }); } catch (x) { /* fine */ } }
  }
  async function saveEdit() {
    readForm();
    var e = P.edit, p = byKey(e && e.key); if (!e || !p) return;
    var v = e.v, title = clean(v.title, 160);
    if (!title) { toastS('Give the photo a title'); return; }
    if (String(v.alt_text || '').length > 400) { toastS('Alt text stops at 400 characters'); return; }
    var patch = {
      title: title, alt_text: clean(v.alt_text, 400) || null, caption: clean(v.caption) || null, description: clean(v.description) || null,
      usage: USAGE[v.usage] ? v.usage : 'check', usage_note: clean(v.usage_note) || null, people: clean(v.people) || null,
      taken_on: /^\d{4}-\d{2}-\d{2}$/.test(String(v.taken_on || '')) ? v.taken_on : null, date_note: clean(v.date_note) || null,
      season: v.season || null, place: clean(v.place) || null, event: clean(v.event) || null, scene: v.scene || null,
      series: slug(v.series) || null, tags: arr(v.tags), partner: arr(v.partner), branding: v.branding || null, best_for: arr(v.best_for),
      is_pick: !!v.is_pick, focal_x: Math.round(Number(v.focal_x || 0.5) * 1000) / 1000, focal_y: Math.round(Number(v.focal_y || 0.5) * 1000) / 1000,
      credit: clean(v.credit) || null, notes: clean(v.notes) || null
    };
    if (!patch.season && patch.taken_on) patch.season = seasonOf(patch.taken_on);
    var wasNew = p.status === 'needs_labels';
    if (wasNew && patch.usage === 'check' && !confirm('It is still marked Not checked. Save it that way?')) return;
    var d = diffText(p, patch, FIELDS);
    if (!d.n && !wasNew) { P.mode = 'view'; P.edit = null; paintDrawer(); toastS('No changes'); return; }
    patch.labelled_by = me() + ', ' + ddmmyy();
    if (wasNew) patch.status = 'ready';
    var btn = document.querySelector('#w118cdr [data-w118cact="save"]'); if (btn) btn.disabled = true;
    try {
      await update(p.key, patch, { field: wasNew ? 'labels confirmed' : 'labels', from: d.from, to: d.to });
      toastS(wasNew ? 'Labels confirmed' : 'Labels saved');
      paint();
      if (wasNew) {
        var nx = sortRows(P.rows.filter(function (x) { return x.status === 'needs_labels'; }))[0];
        if (nx) { openPhoto(nx.key); startEdit(nx); return; }
        if (P.f.status === 'needs_labels') { P.f.status = ''; paint(); }
      }
      P.mode = 'view'; P.edit = null; paintDrawer();
    } catch (x) { if (btn) btn.disabled = false; toastS('Could not save: ' + ((x && x.message) || x)); }
  }
  async function aiEdit() {
    readForm();
    var e = P.edit, p = byKey(e && e.key); if (!e || !p || e.aiBusy) return;
    e.aiBusy = true; e.aiErr = null; paintDrawer();
    try {
      var s = await suggest(Object.assign({}, p, { taken_on: e.v.taken_on || p.taken_on, place: e.v.place, event: e.v.event, series: e.v.series }), null, null);
      if (P.edit !== e) return;
      e.ai = s;
      /* fill what is empty or still the upload default; everything else waits for Use this */
      var f = s.fields, filled = [];
      Object.keys(f).forEach(function (k) {
        if (k === 'focal_x' || k === 'focal_y') return;
        var cur = e.v[k], empty = cur == null || cur === '' || (Array.isArray(cur) && !cur.length) || (k === 'usage' && cur === 'check') || (k === 'title' && /^New photo\b/.test(String(cur)));
        if (empty) { e.v[k] = Array.isArray(f[k]) ? f[k].slice() : f[k]; e.flag[k] = true; filled.push(k); }
      });
      if (f.focal_x != null && Number(e.v.focal_x) === 0.5 && Number(e.v.focal_y) === 0.5) { e.v.focal_x = f.focal_x; e.v.focal_y = f.focal_y; }
      e.dirty = e.dirty || filled.length > 0;
      try { await db.from('wa_photos').update({ ai_suggestion: s }).eq('key', p.key); p.ai_suggestion = s; } catch (x) { /* the form still has it */ }
    } catch (x) { if (P.edit === e) e.aiErr = String((x && x.message) || x).slice(0, 200); }
    if (P.edit === e) { e.aiBusy = false; paintDrawer(); }
  }
  function useAi(k) {
    var e = P.edit; if (!e || !e.ai || !e.ai.fields) return;
    readForm();
    var f = e.ai.fields, keys = k === '*' ? Object.keys(f) : k === 'focal_x' ? ['focal_x', 'focal_y'] : [k];
    keys.forEach(function (x) { if (f[x] == null) return; e.v[x] = Array.isArray(f[x]) ? f[x].slice() : f[x]; e.flag[x] = true; });
    e.dirty = true; paintDrawer();
  }
