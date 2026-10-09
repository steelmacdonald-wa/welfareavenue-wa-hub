  function previewHtml(e) {
    if (!e.platforms.length) return '';
    var im = imgs(e), vi = vids(e);
    var tab = e.platforms.indexOf(e.tab) >= 0 ? e.tab : e.platforms[0];
    var tabs = '<div class="pvt">' + PORDER.filter(function (k) { return e.platforms.indexOf(k) >= 0; }).map(function (k) { return '<a data-w121tab="' + k + '" class="' + (tab === k ? 'on' : '') + '">' + PL[k].label + '</a>'; }).join('') + '</div>';
    var cap = capOf(e, tab), kind = kindOf(e, tab), fc = String(((e.variants[tab] || {}).first_comment) || e.first_comment || '').trim();
    var src0 = vi.length ? (vi[0].local || vi[0].url || '') : im.length ? (im[0].local || im[0].url || '') : '';
    var mediaBox = function (ratio, maxh) { return src0 ? '<div class="mm" style="aspect-ratio:' + ratio + ';' + (maxh ? 'max-height:' + maxh + 'px;' : '') + '">' + (vi.length ? '<video src="' + E(src0) + '" muted playsinline></video>' : '<img src="' + E(src0) + '" alt="">') + '</div>' : ''; };
    var html = '';
    if (tab === 'instagram') {
      if (kind === 'story') html = '<div class="mock"><div class="mh"><span class="av">WA</span><div><b>' + E(igHandle()) + '</b><span>Story · 24 hours</span></div></div>' + (mediaBox('0.5625', 420) || '<div class="mm" style="aspect-ratio:.5625;max-height:420px;display:flex;align-items:center;justify-content:center;color:#999;font-size:12px">A photo or video goes here</div>') + '</div>';
      else {
        var r0 = vi.length ? 0.5625 : (ratioOf(im[0]) || 1); r0 = Math.max(0.8, Math.min(1.91, r0)); if (vi.length) r0 = 0.5625;
        var short = cap.length > 125 ? cap.slice(0, 125) : cap;
        var col = ((e.variants.instagram || {}).collaborators || []);
        html = '<div class="mock"><div class="mh"><span class="av">WA</span><div><b>' + E(igHandle()) + (col.length ? ' and ' + E(col.map(function (x) { return x.replace(/^@/, ''); }).join(', ')) : '') + '</b></div></div>' +
          (vi.length || im.length ? '<div class="mm" style="aspect-ratio:' + r0.toFixed(3) + ';' + (vi.length ? 'max-height:420px;' : '') + '">' + (vi.length ? '<video src="' + E(vi[0].local || vi[0].url || '') + '" muted playsinline></video>' : '<img src="' + E(im[0].local || im[0].url || '') + '" alt="">') + (!vi.length && im.length > 1 ? '<div class="dots">' + im.slice(0, 10).map(function () { return '<i></i>'; }).join('') + '</div>' : '') + '</div>' : '<div class="mm" style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;color:#999;font-size:12px">A photo or video goes here</div>') +
          '<div class="mc"><b>' + E(igHandle()) + '</b> ' + linkify(short) + (cap.length > 125 ? '<span class="more">… more</span>' : '') + '</div>' + (fc ? '<div class="mc" style="color:var(--wa-muted)"><b>' + E(igHandle()) + '</b> ' + linkify(fc) + '</div>' : '') + '</div>';
      }
    } else if (tab === 'facebook') {
      var txt = cap + (e.link_url && (im.length || vi.length) && cap.indexOf(e.link_url) < 0 ? '\n\n' + e.link_url : '');
      var grid = '';
      if (kind === 'reel' || kind === 'story') grid = mediaBox('0.5625', 420);
      else if (vi.length) grid = '<div class="mm" style="aspect-ratio:1.7778"><video src="' + E(vi[0].local || vi[0].url || '') + '" muted playsinline></video></div>';
      else if (im.length === 1) grid = '<div class="mm" style="aspect-ratio:' + Math.max(0.8, Math.min(1.91, ratioOf(im[0]) || 1)).toFixed(3) + '"><img src="' + E(im[0].local || im[0].url || '') + '" alt=""></div>';
      else if (im.length > 1) { var shown = im.slice(0, im.length >= 3 ? 3 : 2); grid = '<div class="fbg" style="grid-template-columns:' + (shown.length === 2 ? '1fr 1fr' : '2fr 1fr') + ';' + (shown.length === 3 ? 'grid-template-rows:1fr 1fr;' : '') + 'aspect-ratio:1.2">' + shown.map(function (m, i) { return '<div style="' + (shown.length === 3 && i === 0 ? 'grid-row:1 / 3;' : '') + 'overflow:hidden;position:relative"><img src="' + E(m.local || m.url || '') + '" alt="">' + (i === shown.length - 1 && im.length > shown.length ? '<div style="position:absolute;inset:0;background:rgba(0,0,0,.45);color:#FFFAF2;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700">+' + (im.length - shown.length) + '</div>' : '') + '</div>'; }).join('') + '</div>'; }
      html = '<div class="mock"><div class="mh"><span class="av">WA</span><div><b>Welfare Avenue</b><span>' + E(e.date ? niceDate(e.date) + ' at ' + (e.time || '') : 'Just now') + ' · ' + (kind === 'story' ? 'Story' : kind === 'reel' ? 'Reel' : 'Public') + '</span></div></div>' + (kind === 'story' ? '' : '<div class="mc">' + E(txt) + '</div>') + grid + (kind === 'feed' && e.link_url && !im.length && !vi.length ? '<div class="lk">' + E((e.link_url.match(/^https?:\/\/([^\/]+)/) || [])[1] || '') + '<b>' + E(e.link_url) + '</b></div>' : '') + (fc && kind !== 'story' ? '<div class="mc" style="color:var(--wa-muted)"><b>Welfare Avenue</b> ' + E(fc) + '</div>' : '') + '</div>';
    } else if (tab === 'threads') {
      html = '<div class="mock th3"><div class="mh"><span class="av">WA</span><div><b>' + E(igHandle()) + '</b><span>Threads</span></div></div><div class="mc">' + linkify(cap.length > 500 ? cap.slice(0, 500) + '…' : cap) + '</div>' + mediaBox(vi.length ? '0.8' : (Math.max(0.8, Math.min(1.91, ratioOf(im[0]) || 1)).toFixed(3))) + (fc ? '<div class="mc" style="color:var(--wa-muted)">↳ ' + E(fc) + '</div>' : '') + '</div>';
    } else if (tab === 'linkedin') {
      var lt = cap + (e.link_url && cap.indexOf(e.link_url) < 0 ? '\n\n' + e.link_url : '');
      html = '<div class="mock"><div class="mh"><span class="av">WA</span><div><b>Welfare Avenue</b><span>Nonprofit Organization · ' + E(e.date ? niceDate(e.date) : 'now') + '</span></div></div><div class="mc">' + E(lt.length > 210 ? lt.slice(0, 210) + '… see more' : lt) + '</div>' + mediaBox(vi.length ? '1.7778' : (Math.max(0.8, Math.min(1.91, ratioOf(im[0]) || 1)).toFixed(3))) + '</div>';
    } else if (tab === 'tiktok') {
      html = '<div class="mock"><div class="yt">' + (vi.length ? '<video src="' + E(vi[0].local || vi[0].url || '') + '" muted playsinline style="width:100%;height:100%;object-fit:cover"></video>' : 'A video goes here') + '</div><div class="mc"><b>@' + E(igHandle()) + '</b> ' + linkify(cap.slice(0, 150)) + '</div></div>';
    } else if (tab === 'youtube') {
      var yt = (e.variants.youtube || {}).title || e.title || cap.split('\n')[0] || '';
      html = '<div class="mock"><div class="yt">' + (vi.length ? '<video src="' + E(vi[0].local || vi[0].url || '') + '" muted playsinline style="width:100%;height:100%;object-fit:cover"></video>' : 'A vertical video goes here') + '</div><div class="mc"><b>' + E(String(yt).slice(0, 100)) + '</b><br><span style="color:var(--wa-muted)">Welfare Avenue · ' + E(((e.variants.youtube || {}).privacy) || 'public') + '</span></div></div>';
    }
    return tabs + html;
  }
  function resultHtml(e) {
    if (!e.id) return '';
    var rows = []; var p = C.posts.filter(function (x) { return String(x.id) === String(e.id); })[0] || {};
    var s = stateOf(Object.assign({}, p, { status: e.status, results: e.results, live: e.live }));
    (e.platforms || []).forEach(function (k) {
      var r = (e.results || {})[k], l = (e.live || {})[k]; var c = PL[k]; if (!c) return;
      var t;
      if (l && (l.external_id || l.url)) { var n = []; ['reach', 'views', 'likes', 'comments', 'shares', 'saves'].forEach(function (m) { if (l[m] != null) n.push(num(l[m]) + ' ' + m); }); t = '✓ Live' + (l.url ? ' (<a href="' + E(l.url) + '" target="_blank" rel="noopener">open</a>)' : '') + (n.length ? ': ' + E(n.join(', ')) : '') + '<br><span style="color:var(--wa-muted)">' + (l.matched === 'caption' ? 'Matched in the analytics by its caption' : 'Matched in the analytics') + ', ' + E(niceWhen(l.published_at)) + '</span>'; }
      else if (r && r.pending) t = c.label + ' is processing the video; it goes up within a few minutes.';
      else if (r && r.manual && !r.manual_done) {
        /* wave225d: the reminder flow for a platform the Hub cannot post to */
        var mm = (e.manualMap || {})[k] || {};
        t = '<b>Post it by hand on ' + E(c.label) + '</b><br><span style="color:var(--wa-muted)">' + E(r.why || 'Not connected') + (mm.reminded_at ? '. Reminder sent ' + E(niceWhen(mm.reminded_at)) : '') + '.</span>' +
          (staff() ? '<div class="w225man">1. <a data-w225copy="' + k + '">Copy the caption</a>' + (e.media.length ? ' and save the media (' + e.media.map(function (m, i) { return '<a href="' + E(m.url) + '" target="_blank" rel="noopener" download>' + (i + 1) + '</a>'; }).join(', ') + ')' : '') + '. 2. Post it in the ' + E(c.label) + ' app. 3. Paste the link (optional) and mark it posted.<div class="ac"><input type="url" data-w225murl="' + k + '" placeholder="' + E(c.label) + ' link (optional)"><button class="btn mini" data-w225mdone="' + k + '">Mark posted</button></div></div>' : '');
      }
      else if (r && (r.id || r.url)) t = (r.manual ? 'Posted by hand' + (((e.manualMap || {})[k] || {}).posted_by ? ' by ' + E(e.manualMap[k].posted_by) : '') : r.draft ? 'In the TikTok drafts: add sound and post it in the app' : 'Published' + (r.via === 'make' ? ' through Make' : '')) + (r.url ? ' (<a href="' + E(r.url) + '" target="_blank" rel="noopener">open</a>)' : '') + (r.first_comment ? ' · first comment added' : r.first_comment_error ? ' · <span style="color:' + FLAG + '">first comment failed: ' + E(r.first_comment_error) + '</span>' : '') + '<br><span style="color:var(--wa-muted)">Waiting for the analytics to confirm it (the morning pull).</span>';
      else if (e.status === 'published' || e.status === 'posted') t = '<span style="color:var(--wa-muted)">Not seen on ' + c.label + ' yet.</span>';
      else t = '<span style="color:var(--wa-muted)">' + (e.status === 'failed' ? 'Not published.' : 'Not posted yet.') + ' ' + E(MODE_L[modeOf(k)] || '') + '.</span>';
      rows.push('<div class="r"><i style="background:' + c.color + '">' + E(c.short) + '</i><div>' + t + '</div></div>');
    });
    var man = '';
    if (staff() && e.manual) man = '<div class="man"><span class="lbl">Mark as posted</span><span class="ro">Posted it from the platform’s own app? Paste the links if you have them; the hub matches the post in the analytics either way.</span>' + (e.platforms || []).map(function (k) { return '<input type="url" data-w121manurl="' + k + '" placeholder="' + E(PL[k].label) + ' link (optional)">'; }).join('') + '<div style="display:flex;gap:8px"><button class="btn mini" data-w121mandone="1">Mark as posted</button><button class="btn mini ghost" data-w121man="0">Cancel</button></div></div>';
    return '<div class="sec"><span class="lbl">Where it stands</span><div class="res"><div style="margin:0 0 6px"><span class="pill ' + s.cls + '">' + E(s.label) + '</span> <span class="ro">' + E(s.note || '') + '</span></div>' + rows.join('') + (e.error && e.status === 'failed' ? '<div class="err">' + E(e.error) + '</div>' : '') + man + '</div></div>';
  }
  /* wave225d: the approval, at the top of the composer */
  function apHtml(e) {
    var ap = e.approval_status || 'none', out = ['published', 'posted', 'publishing'].indexOf(e.status) >= 0;
    if (out || !staff()) return '';
    if (ap === 'pending') {
      var who0 = e.submitted_by ? String(e.submitted_by).split('@')[0] : 'Someone';
      if (isPub()) return '<div class="w225ap pending"><b>' + E(who0) + ' sent this for approval.</b>' + (e.approval_note ? E(e.approval_note) : 'Check the caption, the media and the date, then approve it or send it back with a note.') + '<textarea id="w225apnote" placeholder="A note for ' + E(who0) + ' (needed to send it back)">' + E(e.apNote || '') + '</textarea><div class="ac"><button class="btn mini ghost" data-w225decide="changes">Send it back</button><button class="btn mini go" data-w225decide="approve">Approve' + (e.date ? ' and schedule' : '') + '</button></div></div>';
      return '<div class="w225ap pending"><b>Waiting for approval.</b>A marketing lead or an admin approves it; you hear back in the Hub and on Slack. You can still edit it.</div>';
    }
    if (ap === 'changes') return '<div class="w225ap changes"><b>Changes asked.</b>' + E(e.approval_note || 'See the note from the approver.') + ' Make the changes, then send it for approval again.</div>';
    if (ap === 'approved' && !isPub()) return '<div class="w225ap approved"><b>Approved.</b>You can schedule it. Changing the caption, the media or the platforms sends it back for approval.</div>';
    if (!isPub()) return '<div class="w225ap pending" style="background:rgba(16,63,57,.05);color:var(--wa-text)"><b>Send it for approval when it is ready.</b>Marketing leads and admins approve posts before they go out.</div>';
    return '';
  }
  /* wave225d: Customize per platform */
  function variantsHtml(e, ro) {
    var pls = PORDER.filter(function (k) { return e.platforms.indexOf(k) >= 0; }); if (!pls.length) return '';
    var t = pls.indexOf(e.vtab) >= 0 ? e.vtab : pls[0]; e.vtab = t;
    var v = (e.variants || {})[t] || {}; var dis = ro ? ' disabled' : '';
    var lim = { instagram: 2200, facebook: 63206, threads: 500, linkedin: 3000, tiktok: 2200, youtube: 5000 }[t];
    var own = v.caption != null && String(v.caption).trim() !== '';
    var h = '<div class="w225vt">' + pls.map(function (k) { var vv = (e.variants || {})[k] || {}; var mark = vv.caption && String(vv.caption).trim() ? ' ✎' : ''; return '<a data-w225vtab="' + k + '" class="' + (k === t ? 'on' : '') + '">' + PL[k].label + mark + '<i>' + E({ direct: 'direct', make: 'Make', drafts: 'drafts', reminder: 'reminder' }[modeOf(k)] || '') + '</i></a>'; }).join('') + '</div><div class="w225vb">';
    h += '<span class="lbl">' + E(PL[t].label) + ' caption' + (own ? '' : ' (same as the main caption)') + '</span><textarea id="w225vcap" placeholder="Leave empty to use the main caption, or write one for ' + E(PL[t].label) + '"' + dis + ' style="min-height:80px">' + E(v.caption || '') + '</textarea><small>' + capOf(e, t).length + ' / ' + num(lim) + ' characters' + (t === 'instagram' || t === 'tiktok' ? ' · ' + tagsOf(capOf(e, t)).length + ' / ' + (t === 'instagram' ? hashCap() : 5) + ' hashtags' : '') + '</small>';
    var row = [];
    if (KINDS[t]) row.push('<div><span class="lbl">Format</span><select id="w225vkind"' + dis + '>' + KINDS[t].map(function (x) { return '<option value="' + x[0] + '"' + (kindOf(e, t) === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></div>');
    if (t === 'instagram' || t === 'facebook' || t === 'threads') row.push('<div><span class="lbl">First comment here</span><input type="text" id="w225vfc" placeholder="' + E(e.first_comment ? 'Same as the shared first comment' : 'None') + '" value="' + E(v.first_comment || '') + '"' + dis + '></div>');
    if (t === 'instagram') {
      row.push('<div><span class="lbl">Collaborators (up to 3)</span><input type="text" id="w225vcol" placeholder="@partner, @volunteer" value="' + E((v.collaborators || []).map(function (x) { return '@' + String(x).replace(/^@/, ''); }).join(', ')) + '"' + dis + '></div>');
      if (kindOf(e, t) === 'reel') { row.push('<div><span class="lbl">Cover frame (seconds in)</span><input type="number" min="0" step="0.5" id="w225vcov" value="' + E(v.cover_ms != null ? (Number(v.cover_ms) / 1000) : '') + '" placeholder="0"' + dis + '></div>'); row.push('<div><span class="lbl">Reel</span><label style="display:flex;gap:6px;align-items:center;font-size:12.5px"><input type="checkbox" id="w225vstf"' + (v.share_to_feed === false ? '' : ' checked') + dis + '> Also show it in the feed</label></div>'); }
    }
    if (t === 'youtube') {
      row.push('<div><span class="lbl">Title (100 characters)</span><input type="text" id="w225vyt" maxlength="100" value="' + E(v.title || '') + '" placeholder="' + E(e.title || 'The Short’s title') + '"' + dis + '></div>');
      row.push('<div><span class="lbl">Who sees it</span><select id="w225vprv"' + dis + '>' + [['public', 'Public'], ['unlisted', 'Unlisted'], ['private', 'Private']].map(function (x) { return '<option value="' + x[0] + '"' + ((v.privacy || 'public') === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></div>');
      row.push('<div><span class="lbl">Audience</span><label style="display:flex;gap:6px;align-items:center;font-size:12.5px"><input type="checkbox" id="w225vmfk"' + (v.made_for_kids ? ' checked' : '') + dis + '> Made for kids</label></div>');
    }
    if (row.length) h += '<div class="row">' + row.join('') + '</div>';
    var note = { tiktok: modeOf('tiktok') === 'drafts' ? 'The video lands in WA’s TikTok inbox as a draft: add trending sound and post it from the app.' : 'TikTok is not connected: the owner gets a reminder with the video and caption.', linkedin: { make: 'Posts to the LinkedIn Page through Make (text and one photo; a video comes as a reminder).', direct: 'Posts to the LinkedIn Page directly.', reminder: 'LinkedIn is not connected: the owner gets a reminder with the caption and media.' }[modeOf('linkedin')], threads: modeOf('threads') === 'direct' ? 'Posts to Threads directly; a first comment becomes a reply.' : 'Threads is not connected: the owner gets a reminder.', youtube: modeOf('youtube') === 'direct' ? 'Uploads the video as a Short.' : 'YouTube is not connected: the owner gets a reminder with the video.' }[t];
    if (note) h += '<small>' + E(note) + '</small>';
    return h + '</div>';
  }
  function tagsHtml(e, ro) {
    var all = (C.tags || []).map(function (t) { return t.name; }); (e.tags || []).forEach(function (n) { if (all.indexOf(n) < 0) all.push(n); });
    return '<div class="w225chips">' + all.map(function (n) { return '<span data-w225tag="' + E(n) + '" class="' + ((e.tags || []).indexOf(n) >= 0 ? 'on' : '') + '"><i style="background:' + E(tagColor(n)) + '"></i>' + E(n) + '</span>'; }).join('') + (ro ? '' : '<input type="text" id="w225newtag" placeholder="New tag" style="width:120px;font-size:12px;padding:4px 10px;border-radius:999px"><button class="btn mini ghost" data-w225tagadd="1">Add</button>') + '</div>';
  }
  function libHtml(e) {
    var hg = (C.lib || []).filter(function (x) { return x.kind === 'hashtags'; }), tp = (C.lib || []).filter(function (x) { return x.kind === 'template'; });
    return '<div class="w225lib">' + (hg.length ? '<select data-w225hg aria-label="Hashtag group"><option value="">+ Hashtag group</option>' + hg.map(function (x) { return '<option value="' + x.id + '">' + E(x.name) + '</option>'; }).join('') + '</select>' : '') +
      (tp.length ? '<select data-w225tpl aria-label="Template"><option value="">Start from a template</option>' + tp.map(function (x) { return '<option value="' + x.id + '">' + E(x.name) + '</option>'; }).join('') + '</select>' : '') +
      '<button class="btn mini ghost" data-w225tplsave="1" title="Keep this post’s platforms, caption, first comment and tags as a template">Save as template</button></div>';
  }
