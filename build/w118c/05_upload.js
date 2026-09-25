
  /* ---------- adding photos ---------- */
  function openUpload() {
    if (!staff()) return;
    if (!P.up) P.up = { items: [], running: false };
    P.open = null; P.mode = 'upload'; P.edit = null; paintDrawer();
    try { if (location.hash !== '#photos/new') history.replaceState(null, '', '#photos/new'); } catch (e) { /* fine */ }
  }
  function uploadHtml() {
    var u = P.up || { items: [] }, items = u.items;
    var done = items.filter(function (i) { return i.state === 'done'; }).length, bad = items.filter(function (i) { return i.state === 'error'; }).length, left = items.length - done - bad;
    var review = P.rows.filter(function (p) { return p.status === 'needs_labels'; }).length;
    var h = '<div class="bk" data-w118cx="1"></div><aside class="pn" role="dialog" aria-modal="true" aria-label="Add photos">' +
      '<header><h3>Add photos</h3><button class="ib" data-w118cx="1" title="Close (Esc)" aria-label="Close">' + ic('close') + '</button></header><div class="bd">' +
      '<div class="drop" id="w118cdrop">' + ic('camera') + '<b>Drop photos here</b>or <a data-w118cchoose="1">choose files</a> (JPEG or PNG, up to 25 at a time).<br>The hub makes the three sizes, keeps the date, drops the location and camera data, and asks the AI for first labels.<input type="file" id="w118cfile" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif" style="display:none"></div>' +
      '<p class="note">Photos arrive marked <b>Needs a look</b>: open each one, fix what the AI got wrong (above all who is recognizable), set the focal point, and save. Describe people by role, not by name.</p>';
    if (items.length) {
      h += '<div class="ups">' + items.map(function (it, n) {
        var pct = it.state === 'done' || it.state === 'error' ? 100 : Math.round((it.pct || 0) * 100);
        return '<div class="it' + (it.state === 'error' ? ' err' : it.state === 'done' ? ' ok' : '') + '">' + (it.thumb ? '<img src="' + E(it.thumb) + '" alt="">' : '<span class="ph0"></span>') +
          '<div><b title="' + E(it.name) + '">' + E(it.name) + '</b><em>' + E(it.msg || '') + '</em>' + (it.state !== 'done' && it.state !== 'error' ? '<div class="bar"><i style="width:' + pct + '%"></i></div>' : '') + '</div>' +
          (it.state === 'done' && it.key ? '<a data-w118copen="' + E(it.key) + '">Check it</a>' : '') + '</div>';
      }).join('') + '</div>';
    }
    h += '</div><footer>' + (items.length ? '<span class="note" style="margin:0">' + (left ? 'Working: ' + left + ' to go' : done + ' added' + (bad ? ', ' + bad + ' could not be added' : '')) + '</span>' : '') +
      '<span class="sp"></span>' +
      (items.length && !left ? '<button type="button" class="b" data-w118cact="clearup">Clear the list</button>' : '') +
      (review ? '<button type="button" class="b go" data-w118cact="review">' + ic('check') + 'Check the labels (' + review + ')</button>' : '') +
      '</footer></aside>';
    return h;
  }
  function paintUp() { if (P.mode === 'upload') paintDrawer(); }
  function keyFor(date, season, name) {
    var b = slug(String(name || '').replace(/\.[a-z0-9]{2,5}$/i, ''));
    var digits = (b.match(/\d{3,}/g) || []).pop();
    if (!b || /^(img|dsc|dscn|dscf|pxl|mvimg|image|photo|picture|screenshot|screen-shot|whatsapp|signal|fullsizerender|p\d{6,}|\d{6,})/.test(b)) b = 'photo' + (digits ? '-' + digits.slice(-6) : '');
    var k = ((date ? date.slice(0, 7) + '-' + (season || '') : 'undated') + '-' + b).replace(/-+/g, '-').slice(0, 72).replace(/-+$/, '');
    if (!/^[a-z0-9]/.test(k)) k = 'p' + k;
    var taken = {}; P.rows.forEach(function (r) { taken[r.key] = 1; }); ((P.up && P.up.items) || []).forEach(function (i) { if (i.key) taken[i.key] = 1; });
    var out = k, n = 2; while (taken[out]) out = k + '-' + (n++);
    return out;
  }
  function addFiles(files) {
    if (!staff()) return;
    var list = Array.prototype.slice.call(files || []);
    if (!P.up) P.up = { items: [], running: false };
    var isPhoto = function (f) { return /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name || ''); };
    var ok = list.filter(isPhoto);
    if (list.length && !ok.length) { toastS('Those are not photos: JPEG or PNG please'); return; }
    list.filter(function (f) { return !isPhoto(f); }).forEach(function (f) { P.up.items.push({ name: f.name || 'file', state: 'error', msg: 'Not a photo: JPEG or PNG please' }); });
    if (ok.length > 25) { toastS('25 at a time: the first 25 are on their way'); ok = ok.slice(0, 25); }
    ok.forEach(function (f) {
      if (f.size > 40 * 1024 * 1024) { P.up.items.push({ name: f.name, state: 'error', msg: 'Over 40 MB: export a smaller copy first' }); return; }
      P.up.items.push({ file: f, name: f.name || 'photo.jpg', state: 'wait', msg: 'Waiting', pct: 0 });
    });
    paintUp();
    run();
  }
  async function run() {
    var u = P.up; if (!u || u.running) return;
    u.running = true;
    try {
      for (var i = 0; i < u.items.length; i++) {
        var it = u.items[i]; if (it.state !== 'wait') continue;
        try { await addOne(it); } catch (x) { it.state = 'error'; it.msg = String((x && x.message) || x).slice(0, 160); it.file = null; paintUp(); }
      }
    } finally { u.running = false; paintUp(); paint(); }
  }
  async function addOne(it) {
    var f = it.file;
    it.state = 'read'; it.msg = 'Reading'; it.pct = 0.05; paintUp();
    var ex = {}; try { ex = exif(await f.slice(0, 262144).arrayBuffer()); } catch (e) { ex = {}; }
    var src = URL.createObjectURL(f), img;
    try { img = await loadImg(src, false); } catch (e) { URL.revokeObjectURL(src); throw new Error(/heic|heif/i.test(f.name + f.type) ? 'This browser cannot open HEIC: export it as a JPEG (or use Safari)' : 'Could not read this image'); }
    var w0 = img.naturalWidth, h0 = img.naturalHeight;
    if (!w0 || !h0) { URL.revokeObjectURL(src); throw new Error('Could not read this image'); }
    it.msg = 'Making the sizes'; it.pct = 0.2; paintUp();
    var cFull = drawTo(img, SIZES[0][1]); URL.revokeObjectURL(src); img = null;
    var cWeb = drawTo(cFull, SIZES[1][1]), cThumb = drawTo(cWeb, SIZES[2][1]);
    var bFull = await blobOf(cFull, SIZES[0][2]), bWeb = await blobOf(cWeb, SIZES[1][2]), bThumb = await blobOf(cThumb, SIZES[2][2]);
    it.thumb = URL.createObjectURL(bThumb);
    var date = ex.date || null, season = date ? seasonOf(date) : null;
    var key = keyFor(date, season, f.name); it.key = key;
    var wf = cFull.width, hf = cFull.height;
    it.msg = 'Uploading'; it.pct = 0.4; paintUp();
    var files = [['full', bFull], ['web', bWeb], ['thumb', bThumb]], done = [];
    try {
      for (var j = 0; j < files.length; j++) {
        var path = 'photos/' + files[j][0] + '/' + key + '.jpg';
        var r = await db.storage.from(BUCKET).upload(path, files[j][1], { contentType: 'image/jpeg', cacheControl: '604800', upsert: false });
        if (r && r.error) throw new Error('Upload failed: ' + (r.error.message || r.error));
        done.push(path); it.pct = 0.4 + 0.15 * (j + 1); paintUp();
      }
      var row = {
        key: key, title: 'New photo' + (date ? ', ' + (dateOf(date).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })) : ''),
        taken_on: date, date_note: date ? 'From the camera' + (ex.time ? ', ' + ex.time : '') + '.' : 'No date in the file; add it if you know it.', season: season,
        usage: 'check', status: 'needs_labels', tags: [], partner: [], best_for: [], is_pick: false, focal_x: 0.5, focal_y: 0.5,
        orientation: wf / hf > 1.05 ? 'landscape' : wf / hf < 0.95 ? 'portrait' : 'square', width: wf, height: hf, color: avgColor(cThumb),
        path_full: done[0], path_web: done[1], path_thumb: done[2], bytes_full: bFull.size, bytes_web: bWeb.size, bytes_thumb: bThumb.size, version: 1,
        source: 'Uploaded by ' + me() + ', ' + ddmmyy() + ' (original ' + w0 + ' x ' + h0 + (ex.camera ? ', ' + ex.camera : '') + ')',
        created_by: me(), updated_by: me()
      };
      var ins = await db.from('wa_photos').insert(row).select().maybeSingle();
      if (ins.error) throw new Error(ins.error.message || String(ins.error));
      put(Object.assign({}, row, ins.data && ins.data.key ? ins.data : {}, { created_at: (ins.data && ins.data.created_at) || new Date().toISOString() }));
    } catch (x) {
      if (done.length) { try { await db.storage.from(BUCKET).remove(done); } catch (e) { /* leave it */ } }
      throw x;
    }
    try { if (typeof logChange === 'function') logChange('photo', key, 'added', null, f.name); } catch (e) { /* audit */ }
    it.file = null; it.pct = 0.85; it.msg = 'Asking the AI for first labels'; paintUp(); paint();
    try {
      var s = await suggest(byKey(key), cWeb, { file: f.name });
      var fl = s.fields, patch = { ai_suggestion: s };
      ['title', 'alt_text', 'caption', 'description', 'usage', 'usage_note', 'people', 'scene', 'branding', 'tags', 'best_for', 'focal_x', 'focal_y'].forEach(function (k) { if (fl[k] != null) patch[k] = fl[k]; });
      if (!season && fl.season && fl.season !== 'unknown') patch.season = fl.season;
      await update(key, patch, null);
      it.state = 'done'; it.msg = 'Added, with AI labels to check';
    } catch (x) {
      it.state = 'done'; it.msg = 'Added; no AI labels (' + String((x && x.message) || x).slice(0, 80) + '), label it by hand';
    }
    it.pct = 1; paintUp(); paint();
  }
