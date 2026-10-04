  /* ---------- wave204 (04/10/26): the moving preview. Soraya Tyree's review: "something we discussed in last week's marketing
     meeting was the possibility of having a video that plays in the email so people don't have to click on anything." Gmail and
     Outlook do not play video inside an email (Apple Mail is about the only one that does), but they play an animated picture.
     So the video card can carry a moving preview: a few silent seconds of the writer's own video, read here in the browser
     (frames from the file at 10 or 8 a second, cropped to the shape picked, our gold play button drawn on), made into an animated
     GIF (GIF204) and uploaded to content-images/email/ like a photo. It plays as soon as the email opens (Outlook on Windows
     shows its first frame) and a tap opens the full video, with sound, at the card's link. The video file never leaves the
     computer. The Hub page's Content-Security-Policy allows media from blob: URLs for this (build/site/_headers). ---------- */
  var MV = { std: { delay: 10, px: 157000, fps: 10 }, light: { delay: 12, px: 96000, fps: 8 } }, MV_LEN = [2, 3, 4, 5];
  function mvDims(shape, size) {
    var ar = shape === 'square' ? 1 : shape === 'tall' ? 0.8 : 16 / 9, px = (MV[size] || MV.std).px;
    var w = Math.min(MAIL202.W, Math.round(Math.sqrt(px * ar))), h = Math.round(w / ar);
    return { w: w - (w % 2), h: h - (h % 2) };
  }
  function mvShapeFor(w, h) { var a = h ? w / h : 1.7; return a > 1.25 ? 'wide' : a < 0.85 ? 'tall' : 'square'; }
  function mvTime(t) { t = Math.max(0, Number(t) || 0); var m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 9.95 ? '0' : '') + s.toFixed(1); }
  function mvSpan(M) { return mvTime(M.start) + ' to ' + mvTime(Math.min(M.dur, M.start + M.len)) + ' of ' + mvTime(M.dur); }
  function kbText(kb) { kb = Number(kb) || 0; return kb >= 1000 ? (kb / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(kb)) + ' KB'; }
  function mvVideo(url) {
    return new Promise(function (res, rej) {
      var v = document.createElement('video'), done = false, tm;
      var fin = function (err) { if (done) return; done = true; clearTimeout(tm); v.onloadeddata = null; v.onerror = null; if (err) rej(err); else res(v); };
      tm = setTimeout(function () { fin(new Error('The video took too long to open. Try a shorter clip, or an MP4 file.')); }, 20000);
      v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.onloadeddata = function () { fin(null); };
      v.onerror = function () { fin(new Error('This video could not be read here. An MP4 file works best, in Chrome or Safari.')); };
      v.src = url;
    });
  }
  function mvSeek(v, t) {
    return new Promise(function (res) {
      var done = false, tm, fin = function () { if (done) return; done = true; clearTimeout(tm); v.removeEventListener('seeked', fin); res(); };
      tm = setTimeout(fin, 4000);
      v.addEventListener('seeked', fin);
      try { v.currentTime = t; } catch (e) { fin(); }
    });
  }
  /* our gold play button, drawn on every frame (so even Outlook's first frame says "video") */
  function mvBadge(g, w, h) {
    var r = Math.round(Math.max(16, Math.min(w, h) * 0.11)), cx = Math.round(w / 2), cy = Math.round(h / 2), s = r * 0.46;
    g.save();
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = 'rgba(220,165,39,0.95)'; g.fill();
    g.beginPath(); g.moveTo(cx - s * 0.62, cy - s); g.lineTo(cx - s * 0.62, cy + s); g.lineTo(cx + s * 0.95, cy); g.closePath(); g.fillStyle = GREEN; g.fill();
    g.restore();
  }
  function mvFree(M) {
    if (!M) return;
    if (M.out) { try { URL.revokeObjectURL(M.out.url); } catch (e) { /* fine */ } }
    try { URL.revokeObjectURL(M.url); } catch (e) { /* fine */ }
  }
  function closeMoving() { mvFree(SS.mv); SS.mv = null; }
  function mvStale() { var M = SS.mv; if (M && M.out) { try { URL.revokeObjectURL(M.out.url); } catch (e) { /* fine */ } M.out = null; } }
  async function openMoving(i, file) {
    if (!file || !SS.d || SS.ro) return;
    var b = SS.d.design.blocks[i]; if (!b || b.type !== 'video') return;
    if (!/^video\//i.test(file.type || '') && !/\.(mp4|m4v|mov|webm|ogv)$/i.test(str(file.name))) { SS.err = 'That is not a video file. Use an MP4 (or a MOV or WebM).'; paint(); return; }
    closeMoving();
    var M = SS.mv = { id: b.id, name: str(file.name) || 'Your video', url: URL.createObjectURL(file), dur: 0, vw: 0, vh: 0, start: 0, len: 3, shape: 'wide', size: 'std', busy: '', prog: 0, err: '', out: null };
    SS.err = ''; paint();
    try {
      var v = await mvVideo(M.url);
      if (!isFinite(v.duration)) await mvSeek(v, 1e6);   /* some recordings only learn their length at the end */
      if (SS.mv !== M) return;
      M.dur = isFinite(v.duration) ? v.duration : 0; M.vw = v.videoWidth; M.vh = v.videoHeight;
      if (!M.dur || !M.vw) throw new Error('This video has no picture the Hub can read. Try an MP4 file.');
      M.shape = mvShapeFor(M.vw, M.vh);
      M.len = M.dur >= 3 ? 3 : Math.max(0.5, Math.floor(M.dur * 10) / 10);
      M.start = M.dur > M.len + 2 ? 1 : 0;
      try { v.removeAttribute('src'); v.load(); } catch (e) { /* fine */ }
    } catch (e) { if (SS.mv === M) M.err = msgOf(e); }
    if (SS.mv === M) paint();
  }
  function mvProg(M, pct) { M.prog = pct; var el = document.getElementById('w204mvprog'); if (el) el.textContent = pct + '%'; }
  async function makeMoving() {
    var M = SS.mv; if (!M || M.busy || !M.dur) return;
    mvStale();
    var cfg = MV[M.size] || MV.std, dm = mvDims(M.shape, M.size), n = Math.max(2, Math.round(M.len * 100 / cfg.delay));
    M.busy = 'Making the moving preview…'; M.prog = 0; M.err = ''; paint();
    try {
      var v = await mvVideo(M.url);
      if (SS.mv !== M) return;
      var c = document.createElement('canvas'); c.width = dm.w; c.height = dm.h;
      var g = c.getContext('2d', { willReadFrequently: true });
      var vw = v.videoWidth, vh = v.videoHeight, ar = dm.w / dm.h, sw, sh, sx, sy;
      if (vw / vh > ar) { sh = vh; sw = vh * ar; sx = (vw - sw) / 2; sy = 0; } else { sw = vw; sh = vw / ar; sx = 0; sy = (vh - sh) / 2; }
      var frames = [], end = Math.max(0, (isFinite(v.duration) ? v.duration : M.dur) - 0.04);
      for (var k = 0; k < n; k++) {
        await mvSeek(v, Math.min(end, M.start + k * cfg.delay / 100));
        if (SS.mv !== M) return;
        g.fillStyle = GREEN; g.fillRect(0, 0, dm.w, dm.h);
        g.drawImage(v, sx, sy, sw, sh, 0, 0, dm.w, dm.h);
        mvBadge(g, dm.w, dm.h);
        frames.push(g.getImageData(0, 0, dm.w, dm.h).data);
        mvProg(M, Math.round((k + 1) / n * 70));
      }
      try { v.removeAttribute('src'); v.load(); } catch (e) { /* fine */ }
      var bytes = await GIF204.encode(frames, dm.w, dm.h, cfg.delay, { keep: [[220, 165, 39], [16, 63, 57], [255, 250, 242]], onProg: function (p) { mvProg(M, 70 + Math.round(p * 30)); }, yield: function () { return new Promise(function (r) { setTimeout(r, 0); }); } });
      if (SS.mv !== M) return;
      var blob = new Blob([bytes], { type: 'image/gif' });
      M.out = { blob: blob, url: URL.createObjectURL(blob), kb: Math.max(1, Math.round(blob.size / 1024)), w: dm.w, h: dm.h, frames: n, secs: M.len };
    } catch (e) { M.err = msgOf(e); }
    M.busy = ''; paint();
  }
  async function useMoving() {
    var M = SS.mv; if (!M || !M.out || M.busy || !SS.d) return;
    var b = SS.d.design.blocks.filter(function (x) { return x.id === M.id; })[0];
    if (!b || b.type !== 'video') { closeMoving(); paint(); return; }
    M.busy = 'Uploading the preview…'; M.err = ''; paint();
    try {
      var now = new Date(), path = 'email/' + now.getFullYear() + '/' + ('0' + (now.getMonth() + 1)).slice(-2) + '/' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4) + '.gif';
      var up = await db.storage.from('content-images').upload(path, M.out.blob, { contentType: 'image/gif', upsert: false, cacheControl: '31536000' });
      if (up && up.error) throw new Error('The upload did not go through: ' + msgOf(up.error));
      var pub = db.storage.from('content-images').getPublicUrl(path), src = pub && pub.data && pub.data.publicUrl;
      if (!src) throw new Error('The upload did not give back a link.');
      if (SS.mv !== M) return;
      b.gif = src; b.gw = M.out.w; b.gh = M.out.h; b.gkb = M.out.kb;
      closeMoving(); SS.open[b.id] = true;
      T('The moving preview is in the email');
      changed(true);
    } catch (e) { if (SS.mv === M) { M.busy = ''; M.err = msgOf(e); paint(); } }
  }
  /* the slot in the video card's form */
  function movingSlot(i, b) {
    var has = !!str(b.gif).trim();
    return '<div class="w204mvslot">' + (has ? '<img src="' + E(b.gif) + '" alt="The moving preview">' : '<div class="w202noimg">' + I('film') + '</div>') +
      '<div class="w204mvtx"><b>Moving preview</b><span class="m">' + (has ? 'Plays as soon as the email opens' + (b.gkb ? ' (' + kbText(b.gkb) + ')' : '') + '. A tap opens the full video at the link.'
        : 'Inboxes like Gmail and Outlook do not play video inside an email, but they play a moving picture: a few silent seconds of your video that start as soon as the email opens. A tap opens the full video, with sound, at the link.') + '</span>' +
      '<span class="w202slb"><label class="w152btn sm' + (has ? ' ghost' : '') + '">' + I('upload') + (has ? ' Make a new one' : ' Make one from a video file') + '<input type="file" accept="video/*,.mp4,.mov,.m4v,.webm" data-w204vfile="' + i + '" hidden></label>' +
      (has ? '<button class="w152btn sm ghost" data-w204mvrm="' + i + '">' + I('x') + ' Remove it</button>' : '') + '</span></div></div>';
  }
  function movingHtml() {
    var M = SS.mv; if (!M) return '';
    var body;
    if (!M.dur) body = M.err ? '<div class="w152err">' + E(M.err) + '</div><div class="w154acts"><button class="w152btn ghost" data-w204mvx>Close</button></div>' : busyHtml('Opening the video…');
    else {
      var maxStart = Math.max(0, M.dur - M.len), dm = mvDims(M.shape, M.size), cfg = MV[M.size] || MV.std, dis = M.busy ? ' disabled' : '';
      var lens = MV_LEN.filter(function (l) { return l <= M.dur + 0.05; }); if (!lens.length) lens = [M.len];
      var left = '<div class="w204mvl"><video class="w204mvv" data-w204mvvideo src="' + E(M.url) + '" muted playsinline controls preload="auto" aria-label="Your video"></video>' +
        '<label class="w155lb">Start at <span class="m" id="w204mvt">' + E(mvSpan(M)) + '</span><input type="range" class="w204range" data-w204mvstart min="0" max="' + maxStart.toFixed(1) + '" step="0.1" value="' + Math.min(M.start, maxStart).toFixed(1) + '"' + dis + ' aria-label="Where the preview starts"></label>' +
        '<div class="w154acts"><button class="w152btn sm ghost" data-w204mvhere' + dis + '>Start where the video is paused</button></div>' +
        '<div class="w155lb">Length ' + segHtml('data-w204mvlen', lens.map(function (l) { return [String(l), l + ' seconds']; }), String(M.len)) + '</div>' +
        '<div class="w155lb">Shape ' + segHtml('data-w204mvshape', [['wide', 'Wide'], ['square', 'Square'], ['tall', 'Tall']], M.shape) + '</div>' +
        '<div class="w155lb">Size ' + segHtml('data-w204mvsize', [['std', 'Standard'], ['light', 'Lighter']], M.size) + '<span class="m">' + dm.w + ' × ' + dm.h + ' pixels, ' + cfg.fps + ' frames a second. Lighter loads faster on a phone.</span></div></div>';
      var right;
      if (M.busy) right = '<div class="w204mvwait">' + busyHtml(M.busy) + '<p class="m" id="w204mvprog" aria-live="polite">' + (M.prog ? M.prog + '%' : '') + '</p></div>';
      else if (M.out) {
        var kb = M.out.kb;
        right = '<img class="w204mvout" src="' + E(M.out.url) + '" alt="The moving preview" width="' + M.out.w + '">' +
          '<p class="m"><b>' + kbText(kb) + '</b> · ' + M.out.frames + ' frames · ' + M.out.w + ' × ' + M.out.h + '. ' + (kb > 2500 ? 'Heavy for a phone on data: try Lighter, or fewer seconds.' : kb > 1500 ? 'Fine for email; Lighter would load faster.' : 'Light enough for any inbox.') + '</p>' +
          (M.err ? '<div class="w152err">' + E(M.err) + '</div>' : '') +
          '<div class="w154acts"><button class="w152btn" data-w204mvuse>' + I('check') + ' Use this preview</button><button class="w152btn ghost" data-w204mvmake>Make it again</button></div>';
      } else right = '<div class="w204mvph">' + I('film') + '<p class="m">Pick where it starts and how long it runs, then make it. It takes a few seconds, here on your computer: your video is not uploaded, only the preview.</p>' +
        (M.err ? '<div class="w152err">' + E(M.err) + '</div>' : '') + '<button class="w152btn" data-w204mvmake>' + I('spark') + ' Make the preview</button></div>';
      body = '<div class="w204mvgrid">' + left + '<div class="w204mvr">' + right + '</div></div>';
    }
    return '<div class="w202modal" role="dialog" aria-modal="true" aria-label="Moving preview"><div class="w202mbox w204mv">' +
      '<div class="w202mh"><h3>' + I('film') + ' Moving preview</h3><button class="w202x" data-w204mvx aria-label="Close"' + (M.busy ? ' disabled' : '') + '>' + I('x') + '</button></div>' +
      '<p class="m" data-w198skip><b>' + E(M.name) + '</b>. A few silent seconds that play as soon as the email opens, with our gold play button on top; a tap opens the full video at the card’s link.</p>' + body + '</div></div>';
  }
  /* after a paint, the video in the panel shows where the preview starts */
  function movingAfterPaint() {
    var M = SS.mv, v = M && SS.root && SS.root.querySelector('[data-w204mvvideo]'); if (!v) return;
    var set = function () { try { if (Math.abs(v.currentTime - M.start) > 0.05) v.currentTime = M.start; } catch (e) { /* fine */ } };
    if (v.readyState >= 1) set(); else v.addEventListener('loadedmetadata', set, { once: true });
  }
  /* the Hub's changes keep a card's moving preview: matched by the link, else by order */
  function keepMoving(from, to) {
    var olds = ((from && from.blocks) || []).filter(function (b) { return b && b.type === 'video' && str(b.gif).trim(); });
    if (!olds.length || !to) return to;
    var used = [];
    (to.blocks || []).filter(function (b) { return b && b.type === 'video' && !str(b.gif).trim(); }).forEach(function (b) {
      var free = olds.filter(function (o) { return used.indexOf(o) < 0; });
      var m = free.filter(function (o) { return str(o.url).trim() && str(o.url).trim() === str(b.url).trim(); })[0] || free[0];
      if (!m) return; used.push(m);
      b.gif = m.gif; if (m.gw) b.gw = m.gw; if (m.gh) b.gh = m.gh; if (m.gkb) b.gkb = m.gkb;
    });
    return to;
  }
