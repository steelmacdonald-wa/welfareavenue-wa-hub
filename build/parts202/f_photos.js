  /* ---------- photos: the Photo library (ready ones first) or an upload, made light for email ----------
     An upload is shrunk in the browser (1200 px at most, JPEG) and stored in the public content-images bucket under
     email/<year>/<month>/, so every inbox can load it; a small copy stays in memory for the Hub's AI to look at. */
  var LIBCOLS = 'id,title,alt_text,caption,usage,url_web,url_thumb,orientation,scene,tags,season,is_pick';
  function loadLibrary() {
    if (SS.lib || SS.libBusy) return Promise.resolve(SS.lib);
    SS.libBusy = true;
    return Promise.resolve(db.from('wa_photos_list').select(LIBCOLS).limit(400)).then(function (r) {
      SS.libBusy = false;
      var rows = ((r && r.data) || []).filter(function (p) { return p && (p.url_web || p.url_thumb); });
      var rank = function (p) { return (p.usage === 'ready' ? 0 : p.usage === 'crop' ? 1 : 2) * 10 + (p.is_pick ? 0 : 1); };
      SS.lib = rows.sort(function (a, b) { return rank(a) - rank(b) || (Number(b.id) - Number(a.id)); });
      return SS.lib;
    }, function () { SS.libBusy = false; SS.lib = []; return SS.lib; });
  }
  function libMatch(p, q) {
    if (!q) return true;
    var hay = lower([p.title, p.alt_text, p.caption, p.scene, p.season, (p.tags || []).join(' ')].join(' '));
    return q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
  }
  function fromLib(p) { return { src: p.url_web || p.url_thumb, thumb: p.url_thumb || p.url_web, alt: str(p.alt_text || p.title).slice(0, 200), title: p.title || '', lib: 'photo:' + p.id, usage: p.usage || null, caption: '' }; }
  function readImage(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { res({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('This photo could not be read here: use a JPG or PNG.')); };
      img.src = url;
    });
  }
  function shrink(img, max, q) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, s = Math.min(1, max / Math.max(w, h));
    var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
    var g = c.getContext('2d'); g.fillStyle = CREAM; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    return { canvas: c, w: c.width, h: c.height, q: q };
  }
  function toBlob(sh) { return new Promise(function (res) { sh.canvas.toBlob(function (b) { res(b); }, 'image/jpeg', sh.q); }); }
  async function uploadPhoto(file) {
    if (!file || !/^image\//.test(file.type || 'image/')) throw new Error('That is not a photo.');
    if (file.size > 25 * 1024 * 1024) throw new Error('That photo is over 25 MB.');
    var r = await readImage(file);
    try {
      var big = shrink(r.img, 1200, 0.82), small = shrink(r.img, 512, 0.7);
      var blob = await toBlob(big);
      var now = new Date(), path = 'email/' + now.getFullYear() + '/' + ('0' + (now.getMonth() + 1)).slice(-2) + '/' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4) + '.jpg';
      var up = await db.storage.from('content-images').upload(path, blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' });
      if (up && up.error) throw new Error('The upload did not go through: ' + msgOf(up.error));
      var pub = db.storage.from('content-images').getPublicUrl(path);
      var src = pub && pub.data && pub.data.publicUrl;
      if (!src) throw new Error('The upload did not give back a link.');
      var data = small.canvas.toDataURL('image/jpeg', 0.7).split(',')[1] || '';
      return { src: src, thumb: src, alt: '', title: str(file.name).replace(/\.[a-z0-9]+$/i, ''), lib: null, usage: null, caption: '', data: data.length < 400000 ? data : '' };
    } finally { try { URL.revokeObjectURL(r.url); } catch (e) { /* fine */ } }
  }
  /* the picker: where the chosen photo goes is SS.pick ({to: 'start'} or {to: 'block', i, k}) */
  function pickerHtml() {
    var p = SS.pick; if (!p) return '';
    var lib = SS.lib, q = lower(SS.libQ);
    var grid = !lib ? busyHtml('Loading the Photo library…') : (function () {
      var rows = lib.filter(function (x) { return libMatch(x, q); }).slice(0, 120);
      if (!rows.length) return '<p class="m">No photo matches “' + E(SS.libQ) + '”.</p>';
      return '<div class="w202pgrid" data-w198skip>' + rows.map(function (x) {
        var ready = x.usage === 'ready';
        return '<button class="w202pcell' + (ready ? '' : ' notready') + '" data-w202libpick="' + E(x.id) + '" title="' + E(x.title || '') + '"><img src="' + E(x.url_thumb || x.url_web) + '" alt="' + E(x.alt_text || x.title || '') + '" loading="lazy">' +
          '<span>' + E(x.title || '') + '</span>' + (ready ? '' : '<em>' + E(x.usage || 'check') + '</em>') + '</button>';
      }).join('') + '</div>';
    })();
    return '<div class="w202modal" role="dialog" aria-modal="true" aria-label="Choose a photo"><div class="w202mbox">' +
      '<div class="w202mh"><h3>' + I('image') + ' Choose a photo</h3><button class="w202x" data-w202pickx aria-label="Close">' + I('x') + '</button></div>' +
      '<div class="w202prow"><label class="w202upl w152btn ghost">' + I('upload') + ' Upload ' + (p.to === 'start' ? 'photos' : 'a photo') + '<input type="file" accept="image/*"' + (p.to === 'start' ? ' multiple' : '') + ' data-w202file="pick" hidden></label>' +
      '<input class="w152in" data-w202libq placeholder="Search the Photo library: volunteers, food, winter…" value="' + E(SS.libQ) + '" aria-label="Search the Photo library"></div>' +
      (SS.uploads ? busyHtml('Uploading ' + plural(SS.uploads, 'photo', 'photos') + '…') : '') +
      '<p class="m w202pnote">Ready photos first: our volunteers, food and setups, no close-ups of the people we serve. A photo marked otherwise needs a check before it goes out.</p>' + grid + '</div></div>';
  }
  function photoChosen(ph) {
    var p = SS.pick; if (!p || !ph) return;
    if (p.to === 'start') { if (SS.start.photos.length < 6) SS.start.photos.push(ph); }
    else if (p.to === 'block' && SS.d) {
      var b = SS.d.design.blocks[p.i]; if (!b) return;
      var tgt = b.type === 'photos' ? (b.items[p.k] = b.items[p.k] || { src: '', alt: '', caption: '' }) : b;
      tgt.src = ph.src; tgt.alt = ph.alt || tgt.alt || ''; if (ph.lib) tgt.lib = ph.lib; else delete tgt.lib; if (ph.usage) tgt.usage = ph.usage; else delete tgt.usage;
      changed(true);
    }
  }
  async function uploadFiles(files, to) {
    files = Array.prototype.slice.call(files || [], 0, to === 'start' ? Math.max(0, 6 - SS.start.photos.length) : 1);
    if (!files.length) return;
    SS.uploads = files.length; SS.err = ''; paint();
    for (var i = 0; i < files.length; i++) {
      try {
        var ph = await uploadPhoto(files[i]);
        if (to === 'start-direct') SS.start.photos.push(ph); else photoChosen(ph);
      } catch (e) { SS.err = msgOf(e); }
      SS.uploads = Math.max(0, SS.uploads - 1);
    }
    SS.pick = null;
    paint();
  }
