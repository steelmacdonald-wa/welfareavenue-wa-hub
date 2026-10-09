  function paintDrawer() {
    var e = C.edit; var old = document.getElementById('w121dr');
    if (!e) { if (old) old.remove(); return; }
    var ro = readOnly(); var v = validate(e); var slot = bestSlot(); var pubOk = canPublish(e.platforms);
    var scroll = old ? (old.querySelector('.bd') || {}).scrollTop : 0;
    var aiHtml = '';
    if (e.aiBusy) aiHtml = '<div class="aio"><div style="cursor:default;color:var(--wa-muted)">Writing…</div></div>';
    else if (e.ai && e.ai.options) aiHtml = '<div class="aio">' + e.ai.options.map(function (o, i) { return '<div data-w121aipick="' + i + '" title="Use this caption">' + E(o.caption) + (o.note ? '<small>' + E(o.note) + '</small>' : '') + '</div>'; }).join('') + (e.ai.hashtags && e.ai.hashtags.length ? '<div class="tags" style="cursor:default;border-style:dashed">Hashtags (click to add): ' + e.ai.hashtags.map(function (h) { return '<span data-w121tag="' + E(h) + '">' + E(h) + '</span>'; }).join('') + '</div>' : '') + '</div>';
    else if (e.ai && e.ai.tailored) aiHtml = '<div class="aio"><div style="cursor:default">Captions written for ' + E(e.ai.tailored.join(', ')) + ': see Customize per platform below.</div></div>';
    var chars = e.caption.length, tags = tagsOf(e.caption).length, hc = hashCap();
    var qs = nextQueueSlot(e.platforms);
    var html = '<div class="bk" data-w121close="1"></div><aside class="pn" role="dialog" aria-label="Post">' +
      '<header><input class="ttl" id="w121title" placeholder="Name this post (only the team sees it)" value="' + E(e.title) + '"' + (ro ? ' disabled' : '') + '>' + (function () { var hs = stateOf(Object.assign({}, C.posts.filter(function (x) { return String(x.id) === String(e.id); })[0] || {}, { status: e.status, results: e.results, live: e.live, platforms: e.platforms, approval_status: e.approval_status, approval_note: e.approval_note })); return '<span class="pill ' + hs.cls + '">' + E(e.id ? hs.label : 'New') + '</span>'; })() + '<button class="x" data-w121close="1" title="Close">✕</button></header>' +
      '<div class="bd">' + apHtml(e) + resultHtml(e) + ideaBox(e) +
      '<div class="sec"><label>Where</label><div class="pls">' + PORDER.map(function (k) { var md = modeOf(k); return '<span class="tg' + (e.platforms.indexOf(k) >= 0 ? ' on' : '') + '" data-w121pl="' + k + '" title="' + E(MODE_L[md] || '') + '"><i style="background:' + PL[k].color + '">' + PL[k].short + '</i><span>' + PL[k].label + '<br><span class="md' + (md === 'reminder' ? ' rm' : '') + '">' + E({ direct: 'Direct', make: 'Via Make', drafts: 'To drafts', reminder: 'Reminder' }[md] || '') + '</span></span></span>'; }).join('') + '</div>' + valHtml(v) + '</div>' +
      '<div class="sec"><label>Photos or a video</label>' + (ro ? '' : '<div class="drop" id="w121drop">Drop photos or a video here, <a data-w121pick="1">choose files</a>, or paste. Photos become JPEGs for Instagram.<input type="file" id="w121file" multiple accept="image/*,video/mp4,video/quicktime" style="display:none"></div>') + '<div class="thumbs" id="w121thumbs">' + e.media.map(thumbHtml).join('') + '</div>' + altHtml(e) + '</div>' +
      '<div class="sec"><label>Caption</label><textarea id="w121cap" placeholder="What is this post about? Start with the line people see first."' + (ro ? ' disabled' : '') + '>' + E(e.caption) + '</textarea><div class="cc"><span><b class="' + (chars > 2200 ? 'bad' : '') + '">' + num(chars) + '</b> / 2,200 characters</span><span><b class="' + (tags > hc ? 'bad' : '') + '">' + tags + '</b> / ' + hc + ' hashtags on Instagram</span><span>' + (chars > 125 ? 'Instagram shows the first 125 before “more”' : '') + '</span></div>' +
      (ro ? '' : '<div class="ai"><button data-w121ai="write">Write it with the Hub</button><button data-w121ai="shorten">Shorten</button><button data-w121ai="hashtags">Hashtags</button><button data-w121ai="tailor" title="A caption written for each platform you picked">Tailor for each platform</button><select id="w121lang"><option value="en"' + (e.lang === 'en' ? ' selected' : '') + '>English</option><option value="fr"' + (e.lang === 'fr' ? ' selected' : '') + '>Français</option><option value="both"' + (e.lang === 'both' ? ' selected' : '') + '>Both</option></select></div>' + aiHtml + libHtml(e)) + '</div>' +
      '<div class="sec"><label>Customize per platform</label>' + variantsHtml(e, ro) + '</div>' +
      '<div class="sec"><label>First comment (optional)</label><textarea id="w225fc" style="min-height:52px" placeholder="Posted as the first comment right after the post (Instagram, Facebook; a reply on Threads): hashtags, a link, a thank-you"' + (ro ? ' disabled' : '') + '>' + E(e.first_comment || '') + '</textarea></div>' +
      '<div class="sec"><label>Link (optional)</label><input type="url" id="w121link" placeholder="https://" value="' + E(e.link_url) + '"' + (ro ? ' disabled' : '') + '><div class="w225rep" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)"><label style="display:flex;gap:6px;align-items:center;font-size:12.5px;font-weight:600"><input type="checkbox" id="w225track"' + (e.track_links ? ' checked' : '') + (ro ? ' disabled' : '') + '> Count clicks (hub.welfareavenue.com/l/ links)</label><input type="text" id="w225utm" placeholder="Campaign tag for the website (optional)" value="' + E(e.utm_campaign || '') + '"' + (ro ? ' disabled' : '') + '></div><small class="w225hint">Links in the caption, the link and the first comment become short links that count clicks and tell the website where people came from. Instagram captions keep links as written (they are not clickable there).</small></div>' +
      '<div class="sec"><label>When</label><div class="row2"><input type="date" id="w121date" value="' + E(e.date) + '"' + (ro ? ' disabled' : '') + '><input type="time" id="w121time" value="' + E(e.time) + '"' + (ro ? ' disabled' : '') + '></div>' + (ro ? '' : '<div class="qk">' + (qs ? '<button class="best" data-w225slot="1" title="The next free time in the posting schedule">Next in the queue: ' + E(niceDate(qs.date)) + ' ' + E(qs.time) + '</button>' : '') + (slot ? '<button class="best" data-w121best="1" title="From the analytics insights">Best: ' + E(slot.label) + '</button>' : '') + '<button data-w121quick="tomorrow">Tomorrow 12:00</button><button data-w121quick="nodate">No date yet</button></div>') +
      '<div class="w225rep"><select id="w225rep"' + (ro ? ' disabled' : '') + '>' + [['', 'Does not repeat'], ['week', 'Repeats every week'], ['2weeks', 'Repeats every 2 weeks'], ['month', 'Repeats every month']].map(function (x) { return '<option value="' + x[0] + '"' + (e.repeat === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>' + (e.repeat ? '<input type="number" id="w225rept" min="2" max="52" value="' + E(e.repeat_times || 4) + '" title="How many times in all"' + (ro ? ' disabled' : '') + '>' : '') + '</div>' +
      '<div class="tz">Times are in your time zone' + (tz() ? ' (' + E(tz()) + ')' : '') + '.' + (e.date ? ' ' + (pubOk ? 'Goes out at this time once scheduled (platforms that are not connected send the owner a reminder).' : 'Instagram and Facebook are in plan and confirm mode: the Hub reminds you and confirms the post once it is up.') : '') + '</div></div>' +
      '<div class="sec row2"><div><span class="lbl">Owner</span><select id="w121owner"' + (ro ? ' disabled' : '') + '>' + ownerOpts(e.owner) + '</select></div><div><span class="lbl">Campaign</span><input type="text" id="w121camp" list="w121camps" value="' + E(e.campaign) + '" placeholder="e.g. Rally Paper 2026"' + (ro ? ' disabled' : '') + '><datalist id="w121camps">' + campaigns().map(function (c) { return '<option value="' + E(c) + '">'; }).join('') + '</datalist></div></div>' +
      '<div class="sec"><label>Tags</label>' + tagsHtml(e, ro) + '</div>' +
      '<div class="sec"><label>Notes for the team</label><textarea id="w121notes" style="min-height:70px" placeholder="Brief, sources, who to tag, the photo credit"' + (ro ? ' disabled' : '') + '>' + E(e.notes) + '</textarea></div>' +
      '<div class="sec"><label>Preview</label>' + previewHtml(e) + '</div>' +
      '</div>' + footerHtml(e, v, pubOk, ro) + '</aside>';
    var d = old; if (!d) { d = document.createElement('div'); d.id = 'w121dr'; document.body.appendChild(d); }
    var focusId = document.activeElement && d.contains(document.activeElement) ? document.activeElement.id : null; var selS = null, selE = null;
    try { if (focusId) { selS = document.activeElement.selectionStart; selE = document.activeElement.selectionEnd; } } catch (x) { /* fine */ }
    d.innerHTML = html;
    var bd = d.querySelector('.bd'); if (bd && scroll) bd.scrollTop = scroll;
    if (focusId) { var f = document.getElementById(focusId); if (f) { f.focus(); try { if (selS != null) f.setSelectionRange(selS, selE); } catch (x) { /* fine */ } } }
  }
  function footerHtml(e, v, pubOk, ro) {
    if (!staff()) return '<footer><span class="ro">Read only.</span><span class="sp"></span><button class="btn mini ghost" data-w121close="1">Close</button></footer>';
    if (ro) return '<footer>' + (e.id ? '<button class="lnk" data-w121dup="1">Duplicate</button>' : '') + '<span class="sp"></span>' + (e.status === 'posted' || e.status === 'published' ? '<button class="lnk" data-w121reopen="1" title="Back to a draft (does not remove the post from the platforms)">Back to draft</button>' : '') + '<button class="btn mini ghost" data-w121close="1">Close</button></footer>';
    var bad = v.errors > 0; var hasDate = !!(e.date && e.time);
    var parts = '<footer>' + (e.id ? '<button class="lnk del" data-w121del="1">Delete</button><button class="lnk" data-w121dup="1">Duplicate</button>' + (!e.date && e.status === 'draft' && !e.bank ? '<button class="lnk" data-w136bank="1" title="Out of the calendar until a day you pick">Put in the bank</button>' : '') : '') + '<span class="sp"></span>' +
      '<button class="btn mini ghost" data-w121save="draft">Save draft</button>';
    /* wave225d: who publishes (marketing leads and admins) schedules and publishes; everyone else sends it for approval first */
    var approved = e.approval_status === 'approved';
    if (!isPub() && !approved) {
      if (e.approval_status !== 'pending') parts += '<button class="btn mini go" data-w121save="submit"' + (bad ? ' disabled title="Fix the items marked ✕ first"' : '') + '>Send for approval</button>';
      return parts + '<button class="lnk" data-w121man="1">Mark as posted</button></footer>';
    }
    if (hasDate) parts += '<button class="btn mini go" data-w121save="schedule"' + (bad ? ' disabled title="Fix the items marked ✕ first"' : '') + '>' + (pubOk ? 'Schedule' : 'Plan it') + '</button>';
    if (pubOk) parts += '<button class="btn mini pub" data-w121save="publish"' + (bad ? ' disabled title="Fix the items marked ✕ first"' : '') + '>' + (e.status === 'failed' ? 'Try again now' : 'Publish now') + '</button>';
    if (e.status !== 'draft' || hasDate || !pubOk) parts += '<button class="lnk" data-w121man="1">Mark as posted</button>';
    return parts + '</footer>';
  }
  function readForm() {
    var e = C.edit; if (!e) return;
    var g = function (id) { var x = document.getElementById(id); return x ? x.value : null; };
    var c = function (id) { var x = document.getElementById(id); return x ? !!x.checked : null; };
    var v;
    if ((v = g('w121title')) != null) e.title = v;
    if ((v = g('w121cap')) != null) e.caption = v;
    if ((v = g('w121link')) != null) e.link_url = v.trim();
    if ((v = g('w121date')) != null) e.date = v;
    if ((v = g('w121time')) != null) e.time = v;
    if ((v = g('w121owner')) != null) e.owner = v;
    if ((v = g('w121camp')) != null) e.campaign = v.trim();
    if ((v = g('w121notes')) != null) e.notes = v;
    /* wave225d */
    if ((v = g('w225fc')) != null) e.first_comment = v;
    if ((v = c('w225track')) != null) e.track_links = v;
    if ((v = g('w225utm')) != null) e.utm_campaign = v.trim();
    if ((v = g('w225rep')) != null) e.repeat = v;
    if ((v = g('w225rept')) != null) e.repeat_times = Math.max(2, Math.min(52, Number(v) || 4));
    if ((v = g('w225apnote')) != null) e.apNote = v;
    if (e.vtab && e.platforms.indexOf(e.vtab) >= 0) {
      var vv = vOf(e, e.vtab);
      if ((v = g('w225vcap')) != null) { if (String(v).trim()) vv.caption = v; else delete vv.caption; }
      if ((v = g('w225vkind')) != null) vv.kind = v;
      if ((v = g('w225vfc')) != null) { if (String(v).trim()) vv.first_comment = v; else delete vv.first_comment; }
      if ((v = g('w225vcol')) != null) vv.collaborators = String(v).split(/[\s,]+/).map(function (x) { return x.replace(/^@/, '').trim(); }).filter(Boolean).slice(0, 5);
      if ((v = g('w225vcov')) != null) { if (String(v).trim() === '') delete vv.cover_ms; else vv.cover_ms = Math.round(Number(v) * 1000) || 0; }
      if ((v = c('w225vstf')) != null) vv.share_to_feed = v;
      if ((v = g('w225vyt')) != null) vv.title = v;
      if ((v = g('w225vprv')) != null) vv.privacy = v;
      if ((v = c('w225vmfk')) != null) vv.made_for_kids = v;
    }
    if (e.altIdx != null && e.media[e.altIdx] && (v = g('w225alttext')) != null) e.media[e.altIdx].alt = v;
  }
  function rowFromEdit(e) {
    var variants = {}; Object.keys(e.variants || {}).forEach(function (k) { if (e.platforms.indexOf(k) >= 0) { var vv = Object.assign({}, e.variants[k]); Object.keys(vv).forEach(function (x) { if (vv[x] === '' || vv[x] == null) delete vv[x]; }); if (Object.keys(vv).length) variants[k] = vv; } });
    return { title: e.title.trim() || null, platforms: e.platforms.slice(), format: vids(e).length ? 'reel' : imgs(e).length > 1 ? 'carousel' : imgs(e).length ? 'post' : e.link_url ? 'link' : 'post', caption: e.caption || null, link_url: e.link_url || null,
      media: e.media.filter(function (m) { return m.url && !m.uploading; }).map(function (m) { var o = { path: m.path || null, url: m.url, mime: m.mime || null, kind: m.kind || (String(m.mime || '').indexOf('video') >= 0 ? 'video' : 'image'), w: m.w || null, h: m.h || null, size: m.size || null, dur: m.dur || null }; if (m.alt) o.alt = String(m.alt).slice(0, 1000); if (m.tags && m.tags.length) o.tags = m.tags; if (m.photo_id) o.photo_id = m.photo_id; return o; }),
      scheduled_at: e.date && e.time ? isoOf(e.date, e.time) : (e.date ? isoOf(e.date, '18:00') : null), owner: e.owner || null, campaign: e.campaign || null, notes: e.notes || null,
      variants: variants, first_comment: String(e.first_comment || '').trim() || null, tags: (e.tags || []).slice(), repeat_rule: e.repeat ? { every: e.repeat, times: e.repeat_times || 4 } : null, track_links: e.track_links !== false, utm: e.utm_campaign ? { campaign: e.utm_campaign } : null };
  }
  function saveErr(x) { var m = String((x && (x.message || x.details)) || x || ''); return /needs approval/i.test(m) ? 'A marketing lead or an admin approves this post before it is scheduled. Send it for approval.' : 'Could not save: ' + m; }
  async function saveEdit(mode) {
    readForm(); var e = C.edit; if (!e) return;
    var v = validate(e);
    if (mode !== 'draft' && v.errors) { toastS('Fix the items marked ✕ first'); paintDrawer(); return; }
    if (mode === 'schedule' && !(e.date && e.time)) { toastS('Pick a date and a time'); return; }
    if (mode === 'schedule' && isoOf(e.date, e.time) < new Date().toISOString()) { if (!confirm('That time has passed. Plan it anyway?')) return; }
    if (mode === 'publish' && !confirm('Publish to ' + e.platforms.map(function (k) { return PL[k].label; }).join(', ') + ' now?')) return;
    var row = rowFromEdit(e);
    if (mode === 'draft' || mode === 'submit') row.status = e.status === 'scheduled' && mode === 'draft' ? 'scheduled' : (e.status === 'failed' ? 'failed' : 'draft');
    if (mode === 'schedule') row.status = 'scheduled';
    if (mode === 'publish') row.status = e.status === 'failed' ? 'failed' : 'draft';
    if (mode === 'schedule' || row.status !== 'failed') row.error = null;
    C.busy = true;
    try {
      var saved;
      if (e.id) { saved = await saveRow(e.id, row); logIt(e.id, 'status', e.status, row.status); }
      else { saved = await insertRow(row); e.id = saved.id; logIt(saved.id, 'created', null, (row.title || row.caption || '').slice(0, 80)); }
      e.status = row.status; e.dirty = false;
      if (mode === 'submit') {
        var sr = await db.rpc('studio_submit', { p_id: Number(e.id), p_note: String(e.apNote || '').trim() || null });
        if (sr.error) throw sr.error;
        toastS('Sent for approval: the marketing leads and admins are told');
        await load(true); closeComposer(true); paint(); C.busy = false; return;
      }
      if (mode === 'publish') {
        toastS('Publishing…'); paintDrawer();
        var r = await fn('social-publish', { action: 'publish', post_id: e.id });
        var errs = (r.errors || []).length;
        toastS(r.status === 'published' ? ((r.reminded || []).length ? 'Published; a reminder went out for ' + r.reminded.join(', ') : 'Published') : r.status === 'publishing' ? 'The video is processing; it goes up in a few minutes' : r.status === 'needs approval' ? 'This post needs an approval first' : 'Publishing failed' + (errs ? ': ' + r.errors[0] : ''));
        await load(true);
        var p2 = C.posts.filter(function (x) { return String(x.id) === String(e.id); })[0]; if (p2) { C.edit = fromPost(p2); paintDrawer(); } else closeComposer(true);
        C.busy = false; return;
      }
      toastS(mode === 'schedule' ? (canPublish(e.platforms) ? 'Scheduled: it goes out at ' + e.time : 'Planned for ' + niceDate(e.date) + ' at ' + e.time) : 'Saved');
      closeComposer(true); paint();
    } catch (x) { toastS(saveErr(x)); }
    C.busy = false;
  }
  /* wave225d: approve or send back, by a publisher */
  async function decide(dec) {
    readForm(); var e = C.edit; if (!e || !e.id) return;
    if (dec === 'changes' && !String(e.apNote || '').trim()) { toastS('Write a note so they know what to change'); var n0 = document.getElementById('w225apnote'); if (n0) n0.focus(); return; }
    try {
      if (e.dirty) { await saveRow(e.id, rowFromEdit(e)); e.dirty = false; }
      var r = await db.rpc('studio_decide', { p_id: Number(e.id), p_decision: dec, p_note: String(e.apNote || '').trim() || null });
      if (r.error) throw r.error;
      toastS(dec === 'approve' ? (e.date ? 'Approved and scheduled' : 'Approved') : 'Sent back with your note');
      await load(true); closeComposer(true); paint();
    } catch (x) { toastS('Could not save the decision: ' + (x.message || x)); }
  }
  async function markOne(pl) {
    var e = C.edit; if (!e || !e.id) return;
    var inp = document.querySelector('#w121dr [data-w225murl="' + pl + '"]');
    try {
      await fn('social-publish', { action: 'mark_posted', post_id: e.id, platform: pl, url: inp && inp.value ? inp.value.trim() : null });
      toastS('Marked posted on ' + (PL[pl] ? PL[pl].label : pl));
      await load(true); var p2 = C.posts.filter(function (x) { return String(x.id) === String(e.id); })[0]; if (p2) { C.edit = fromPost(p2); paintDrawer(); }
    } catch (x) { toastS('Could not save: ' + (x.message || x)); }
  }
