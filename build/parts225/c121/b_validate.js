  function validate(e) {
    /* wave225d: one list per platform, plus the shared one */
    var out = { all: [], p: {}, errors: 0 };
    function L(k) { return out.p[k] = out.p[k] || []; }
    function err(list, t) { list.push({ t: t, k: 'e' }); out.errors++; } function warn(list, t) { list.push({ t: t, k: 'w' }); } function ok(list, t) { list.push({ t: t, k: 'k' }); }
    var im = imgs(e), vi = vids(e), cap = hashCap();
    if (!e.platforms.length) err(out.all, 'Pick at least one platform.');
    if ((e.media || []).some(function (m) { return m.uploading; })) err(out.all, 'Wait for the uploads to finish.');
    e.platforms.forEach(function (k) {
      var l = L(k), c = capOf(e, k), kind = kindOf(e, k), md = modeOf(k), nm = PL[k] ? PL[k].label : k, dur = vi[0] && vi[0].dur;
      if (k === 'instagram') {
        if (kind === 'story') { if (!im.length && !vi.length) err(l, 'An Instagram story needs a photo or a video.'); else ok(l, 'Instagram: a story (' + (vi.length ? 'the video' : 'the first photo') + ').'); if (vi.length && dur > 60) warn(l, 'Stories longer than 60 seconds are cut.'); }
        else if (kind === 'reel' || (vi.length && !im.length)) { if (!vi.length) err(l, 'An Instagram reel needs a video.'); else if (dur != null && (dur < 3 || dur > 900)) err(l, 'Reels run from 3 seconds to 15 minutes; this video is ' + Math.round(dur) + ' seconds.'); else ok(l, 'Instagram: a reel' + (dur ? ' (' + Math.round(dur) + ' s)' : '') + '.'); if (im.length) warn(l, 'A reel uses the video only; the photos stay off Instagram.'); }
        else if (!im.length && !vi.length) err(l, 'Instagram needs a photo or a video.');
        else {
          if (im.length > 10) err(l, 'Instagram takes up to 10 photos in a carousel.');
          var r0 = ratioOf(im[0]);
          if (r0 != null && !igRatioOk(r0)) err(l, 'The first photo is ' + ratioLabel(r0) + '; Instagram takes 4:5 to 1.91:1. Crop it below.');
          else if (im.length > 1 && im.some(function (m) { var r = ratioOf(m); return r != null && Math.abs(r - r0) > 0.03; })) warn(l, 'Instagram crops every photo in a carousel to the first one’s shape (' + ratioLabel(r0) + ').');
          if (!l.filter(function (x) { return x.k === 'e'; }).length) ok(l, 'Instagram: ' + (im.length > 1 ? 'a carousel of ' + im.length : 'one photo') + (r0 ? ', ' + ratioLabel(r0) : '') + '.');
          if (im.some(function (m) { return !m.alt; })) warn(l, 'Add alt text to each photo (Alt on the photo) so people using screen readers know what it shows.');
        }
        if (kind !== 'story') {
          if (c.length > 2200) err(l, 'Instagram captions stop at 2,200 characters (' + c.length + ' now).');
          if (tagsOf(c).length > cap) err(l, 'Instagram takes ' + cap + ' hashtags a post since December 2025 (' + tagsOf(c).length + ' now).');
          if ((c.match(/(^|\s)@[\w.]+/g) || []).length > 20) err(l, 'Instagram allows 20 @mentions.');
          if (e.link_url && c.indexOf('bio') < 0) warn(l, 'Links in Instagram captions are not clickable; say “link in bio”.');
        }
        var col = ((e.variants.instagram || {}).collaborators || []); if (col.length > 3) err(l, 'Instagram takes up to 3 collaborators.');
      } else if (k === 'facebook') {
        if (kind === 'reel') { if (!vi.length) err(l, 'A Facebook Reel needs a video.'); else if (dur != null && (dur < 3 || dur > 90)) err(l, 'Facebook Reels run from 3 to 90 seconds; this video is ' + Math.round(dur) + '.'); else ok(l, 'Facebook: a Reel.'); }
        else if (kind === 'story') { if (!im.length && !vi.length) err(l, 'A Facebook story needs a photo or a video.'); else ok(l, 'Facebook: a story.'); }
        else if (!c.trim() && !e.link_url && !im.length && !vi.length) err(l, 'Facebook needs words, a link or media.');
        else ok(l, 'Facebook: ' + (vi.length ? 'a video' : im.length > 1 ? im.length + ' photos' : im.length ? 'a photo' : e.link_url ? 'a link post' : 'a text post') + (e.link_url && (im.length || vi.length) ? ' with the link in the text' : '') + '.');
        if (kind === 'feed' && im.length > 10) warn(l, 'Facebook gets the first 10 photos.');
      } else if (k === 'threads') {
        if (c.length > 500) err(l, 'Threads posts stop at 500 characters (' + c.length + ' now). Write a shorter one under Customize.');
        if (!c.trim() && !im.length && !vi.length) err(l, 'Threads needs words or media.');
        if (im.length > 20) err(l, 'Threads takes up to 20 photos.');
        if (!out.p[k].length) ok(l, 'Threads: ' + (vi.length ? 'a video' : im.length > 1 ? 'a carousel of ' + im.length : im.length ? 'a photo' : 'a text post') + '.');
      } else if (k === 'linkedin') {
        if (c.length > 3000) err(l, 'LinkedIn posts stop at 3,000 characters.');
        if (!c.trim() && !im.length && !vi.length) err(l, 'LinkedIn needs words or media.');
        if (md === 'make' && vi.length) warn(l, 'Make sends text and photos; a LinkedIn video comes to you as a reminder to post by hand.');
        if (md === 'make' && im.length > 1) warn(l, 'Make sends the first photo only.');
        if (!out.p[k].some(function (x) { return x.k !== 'k'; })) ok(l, 'LinkedIn: ' + (vi.length ? 'a video' : im.length ? 'a photo' : 'a text post') + '.');
      } else if (k === 'tiktok') {
        if (!vi.length) warn(l, im.length ? 'TikTok photo posts come to you as a reminder to post in the app.' : 'TikTok needs a video.');
        if (vi.length && dur != null && dur > 600) err(l, 'TikTok videos run up to 10 minutes.');
        if (vi.length) ok(l, md === 'drafts' ? 'TikTok: the video lands in WA’s TikTok drafts; add sound and post it in the app.' : 'TikTok: a video.');
        if (tagsOf(c).length > 5) warn(l, 'TikTok works best with 3 to 5 hashtags.');
      } else if (k === 'youtube') {
        if (!vi.length) err(l, 'A YouTube Short needs a video.');
        else if (dur != null && dur > 180) err(l, 'Shorts run up to 3 minutes; this video is ' + Math.round(dur) + ' seconds.');
        else { var r = ratioOf(vi[0]); if (r != null && r > 1.01) warn(l, 'Shorts are vertical or square; this video is wide.'); ok(l, 'YouTube: a Short.'); }
        var yt = (e.variants.youtube || {}).title || e.title; if (!String(yt || '').trim()) warn(l, 'Give the Short a title (Customize, YouTube), or the post’s name is used.');
      }
      if (md === 'reminder') warn(l, nm + ' is not connected: at the post’s time the owner gets a reminder to post it by hand.');
    });
    /* the old names some waves read */
    out.ig = out.p.instagram || []; out.fb = out.p.facebook || [];
    return out;
  }
  function valHtml(v) {
    var rows = v.all.slice(); PORDER.forEach(function (k) { (v.p[k] || []).forEach(function (x) { rows.push(x); }); });
    return rows.length ? '<div class="val">' + rows.map(function (x) { return '<div class="' + x.k + '">' + (x.k === 'e' ? '✕ ' : x.k === 'w' ? '! ' : '✓ ') + E(x.t) + '</div>'; }).join('') + '</div>' : '';
  }
  function thumbHtml(m, i) {
    var r = ratioOf(m); var isV = String(m.kind || m.mime || '').indexOf('video') >= 0; var bad = !isV && r != null && !igRatioOk(r) && C.edit && C.edit.platforms.indexOf('instagram') >= 0;
    return '<div class="th" draggable="' + (readOnly() ? 'false' : 'true') + '" data-w121mi="' + i + '">' + (isV ? '<video src="' + E(m.local || m.url || '') + '" muted preload="metadata"></video>' : '<img src="' + E(m.local || m.url || '') + '" alt="' + E(m.alt || '') + '">') +
      (r ? '<span class="rt' + (bad ? ' bad' : '') + '">' + E(isV ? (m.dur ? Math.round(m.dur) + ' s' : 'video') : ratioLabel(r)) + '</span>' : '') + (i === 0 && C.edit && C.edit.media.length > 1 ? '<span class="n1">cover</span>' : '') +
      (readOnly() ? '' : '<button class="rm" data-w121mrm="' + i + '" title="Remove">✕</button>') + (m.uploading ? '<div class="up">Uploading…</div>' : '') +
      (!isV && !m.uploading ? '<button class="altb' + (m.alt ? ' ok' : '') + '" data-w225alt="' + i + '" title="Alt text and people tags">' + (m.alt ? 'ALT ✓' : 'ALT') + ((m.tags || []).length ? ' · ' + m.tags.length + '@' : '') + '</button>' : '') +
      (!isV && !readOnly() && !m.uploading ? '<div class="crop">' + [['0.8', '4:5'], ['1', '1:1'], ['1.91', '1.91'], ['0.5625', '9:16']].map(function (c) { return '<button data-w121crop="' + i + '" data-r="' + c[0] + '" title="Crop to ' + c[1] + '">' + c[1] + '</button>'; }).join('') + '</div>' : '<div class="meta">' + (m.size ? num(m.size / 1024) + ' KB' : '') + '</div>') + '</div>';
  }
  /* wave225d: alt text and people tags for one photo */
  function altHtml(e) {
    var i = e.altIdx; if (i == null) return ''; var m = e.media[i]; if (!m || String(m.kind || m.mime || '').indexOf('video') >= 0) return '';
    var ro = readOnly();
    return '<div class="w225alt"><div class="pic" data-w225pic="' + i + '"><img src="' + E(m.local || m.url || '') + '" alt="">' + (m.tags || []).map(function (t) { return '<b style="left:' + (t.x * 100).toFixed(1) + '%;top:' + (t.y * 100).toFixed(1) + '%">@' + E(t.username) + '</b>'; }).join('') + '</div>' +
      '<div><span class="lbl">Alt text (photo ' + (i + 1) + ')</span><textarea id="w225alttext" maxlength="1000" placeholder="What the photo shows, for people using screen readers: who, what, where."' + (ro ? ' disabled' : '') + '>' + E(m.alt || '') + '</textarea>' +
      (ro ? '' : '<div class="w225lib"><button class="btn mini ghost" data-w225altai="' + i + '"' + (e.altBusy ? ' disabled' : '') + '>' + (e.altBusy ? 'Writing…' : 'Write it with the Hub') + '</button></div>') +
      '<span class="lbl" style="margin-top:10px">Tag people on Instagram</span>' + (ro ? '' : '<input type="text" id="w225tagname" placeholder="@username, then click the photo where they are">') +
      '<div class="tgs">' + (m.tags || []).map(function (t, j) { return '<span data-w225untag="' + j + '" title="Remove">@' + E(t.username) + ' ✕</span>'; }).join('') + '</div>' +
      '<small class="w225hint">Tags go to Instagram with the photo. Facebook and LinkedIn get the alt text too.</small>' +
      '<div class="w225lib"><button class="btn mini ghost" data-w225altx="1">Done</button></div></div></div>';
  }
