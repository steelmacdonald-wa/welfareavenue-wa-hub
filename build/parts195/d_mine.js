
  /* ---------- my signature: the name and titles under it, the signature drawn, uploaded or the one Steel sent ---------- */
  async function loadCert() {
    if (S.cert !== undefined) return S.cert;
    S.cert = null;
    try {
      var r = await db.from('app_config').select('value').eq('key', 'cert_signature').maybeSingle();
      var v = r && r.data ? r.data.value : null, j = typeof v === 'string' ? JSON.parse(v) : v;
      if (j && /^data:image\/png;base64,/.test(String(j.image || ''))) S.cert = { image: j.image, name: String(j.name || ''), title: String(j.title || '') };
    } catch (e) { S.cert = null; }
    return S.cert;
  }
  /* the certificate's signature is offered only to the person it belongs to */
  function certOk() {
    var c = S.cert, m = S.mine || {}, me = S.me || {}, own = lower(c && c.name);
    if (!own) return false;
    var mine = [m.name, me.name, (typeof USER !== 'undefined' && USER && USER.name) || ''].map(lower);
    return mine.indexOf(own) >= 0;
  }
  async function openMine() {
    var me = S.me || {};
    S.mine = { name: me.name || (typeof USER !== 'undefined' && USER && USER.name) || '', title: me.title || '', title_fr: me.title_fr || '', tab: me.has_signature ? 'keep' : 'draw', png: null, canvas: null };
    S.mineErr = '';
    sheet('<p class="w195muted">Loading…</p>');
    await loadCert();
    if (certOk()) { if (!me.has_signature) S.mine.tab = 'cert'; if (!S.mine.title && S.cert.title) S.mine.title = S.cert.title; }
    if (me.has_signature && !S.sigUrl) await sigImage();
    paintMine();
  }
  function paintMine() {
    var m = S.mine, me = S.me || {}; if (!m) return;
    var tabs = [];
    if (me.has_signature) tabs.push(['keep', 'Keep my signature']);
    if (certOk()) tabs.push(['cert', 'The one I sent for the certificate']);
    tabs.push(['draw', 'Draw it'], ['upload', 'Upload a picture']);
    var h = '<p class="w195k">Volunteer Manager · Sign-offs</p><h2>My signature</h2><p class="w195muted">What prints at the bottom of every letter you sign: your signature, then your name and title, then Welfare Avenue.</p>' +
      (S.mineErr ? '<div class="w195warn" role="alert">' + E(S.mineErr) + '</div>' : '') +
      '<div class="w195grid"><div><label for="w195mn">Name</label><input type="text" id="w195mn" maxlength="120" autocomplete="name" value="' + E(m.name) + '"></div>' +
      '<div><label for="w195mt">Title</label><input type="text" id="w195mt" maxlength="120" placeholder="For example Operations Lead" value="' + E(m.title) + '"></div>' +
      '<div><label for="w195mf">Title in French, for French letters (optional)</label><input type="text" id="w195mf" maxlength="120" placeholder="For example Responsable des opérations" value="' + E(m.title_fr) + '"></div></div>' +
      '<h3>Signature</h3><div class="w195tabs" role="group" aria-label="Your signature">' + tabs.map(function (x) {
        return '<button type="button" data-w195tab="' + x[0] + '"' + (m.tab === x[0] ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>' + E(x[1]) + '</button>';
      }).join('') + '</div>';
    if (m.tab === 'keep') h += '<div class="w195box">' + (S.sigUrl ? '<img class="w195big" src="' + E(S.sigUrl) + '" alt="Your saved signature">' : '<span class="w195muted">Your saved signature stays as it is.</span>') + '</div>';
    else if (m.tab === 'cert') h += '<div class="w195cert"><img src="' + E(S.cert.image) + '" alt="The signature you sent"><span class="w195muted">The signature you sent for the Avenue Academy certificate. It prints the same way on volunteer letters.</span></div>';
    else if (m.tab === 'draw') h += '<div class="w195pad" id="w195pad"><canvas aria-label="Draw your signature here"></canvas><span class="w195line"></span></div>' +
      '<div class="w195row2"><button type="button" class="w195link" data-w195clear="1">Clear</button><span class="w195muted">Sign above the line with a finger, a pen or the mouse.</span></div>';
    else h += '<div class="w195box"><label class="sr" for="w195file">A picture of your signature</label><input type="file" id="w195file" accept="image/png,image/jpeg">' +
      '<p class="w195muted">A photo or a scan of your signature on white paper works: the white around it is cleared.</p>' + (m.png ? '<img class="w195big" src="' + m.png + '" alt="Your signature, ready to save">' : '') + '</div>';
    h += '<div class="w195acts"><button type="button" class="w195btn" data-w195save="1"' + (S.mineBusy ? ' disabled' : '') + '>' + (S.mineBusy ? 'Saving…' : 'Save') + '</button>' +
      '<button type="button" class="w195btn ghost" data-w195close="1">Cancel</button></div>';
    sheet(h);
    if (m.tab === 'draw') pad();
  }
  function pad() {
    var wrap = document.getElementById('w195pad'); if (!wrap || !S.mine) return;
    var cv = wrap.querySelector('canvas'), r = cv.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.max(300, Math.round((r.width || 600) * dpr)); cv.height = Math.max(100, Math.round((r.height || 200) * dpr));
    var cx = cv.getContext('2d'), down = false, last = null;
    cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.strokeStyle = INK; cx.fillStyle = INK; cx.lineWidth = 2.6 * dpr;
    function pt(e) { var b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) * cv.width / b.width, y: (e.clientY - b.top) * cv.height / b.height }; }
    cv.addEventListener('pointerdown', function (e) { down = true; last = pt(e); try { cv.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } cx.beginPath(); cx.arc(last.x, last.y, cx.lineWidth / 2, 0, Math.PI * 2); cx.fill(); e.preventDefault(); });
    cv.addEventListener('pointermove', function (e) { if (!down) return; var p = pt(e); cx.beginPath(); cx.moveTo(last.x, last.y); cx.lineTo(p.x, p.y); cx.stroke(); last = p; e.preventDefault(); });
    function end() { down = false; last = null; }
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    S.mine.canvas = cv;
  }
  /* the drawing, cropped to its ink with a margin, at most 1200 x 600, as a PNG with a clear background */
  function trimmed(cv) {
    var w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data, x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { if (d[(y * w + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    if (x1 < 0) return null;
    var m = 12; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m);
    var cw = x1 - x0 + 1, ch = y1 - y0 + 1, s = Math.min(1, 1200 / cw, 600 / ch);
    var out = document.createElement('canvas'); out.width = Math.max(40, Math.round(cw * s)); out.height = Math.max(15, Math.round(ch * s));
    out.getContext('2d').drawImage(cv, x0, y0, cw, ch, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  }
  function fromFile(file) {
    return new Promise(function (res, rej) {
      if (!file || !/^image\/(png|jpeg)$/.test(file.type)) { rej(new Error('Choose a PNG or JPEG picture.')); return; }
      if (file.size > 8 * 1024 * 1024) { rej(new Error('That picture is over 8 MB.')); return; }
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var s = Math.min(1, 2000 / img.width, 1000 / img.height), cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(img.width * s)); cv.height = Math.max(1, Math.round(img.height * s));
          var cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, cv.width, cv.height);
          var id = cx.getImageData(0, 0, cv.width, cv.height), d = id.data;
          for (var i = 0; i < d.length; i += 4) { var l = (d[i] + d[i + 1] + d[i + 2]) / 3; if (l > 215) d[i + 3] = 0; else if (l > 160) d[i + 3] = Math.round(d[i + 3] * (215 - l) / 55); }
          cx.putImageData(id, 0, 0);
          var png = trimmed(cv); if (!png) rej(new Error('We could not find a signature in that picture.')); else res(png);
        };
        img.onerror = function () { rej(new Error('That picture could not be read.')); };
        img.src = fr.result;
      };
      fr.onerror = function () { rej(new Error('That picture could not be read.')); };
      fr.readAsDataURL(file);
    });
  }
  async function saveMine() {
    var m = S.mine; if (!m || S.mineBusy) return;
    m.name = String(m.name || '').trim(); m.title = String(m.title || '').trim(); m.title_fr = String(m.title_fr || '').trim();
    if (!m.name || !m.title) { S.mineErr = 'Your name and title print under your signature: add both.'; paintMine(); return; }
    var png = null, me = S.me || {};
    if (m.tab === 'draw') { png = m.canvas ? trimmed(m.canvas) : null; if (!png) { S.mineErr = 'Draw your signature first, or choose another way.'; paintMine(); return; } }
    else if (m.tab === 'upload') { if (!m.png) { S.mineErr = 'Choose a picture of your signature first.'; paintMine(); return; } png = m.png; }
    else if (m.tab === 'cert') png = S.cert && S.cert.image;
    else if (!me.has_signature) { S.mineErr = 'Add your signature first.'; paintMine(); return; }
    S.mineBusy = true; S.mineErr = ''; paintMine();
    var r1 = await rpc('signoff_signer_save', { p: { name: m.name, title: m.title, title_fr: m.title_fr } });
    if (r1.error) { S.mineBusy = false; S.mineErr = msgOf(r1.error); paintMine(); return; }
    if (png) {
      var r2 = await call({ action: 'signature_save', png_b64: png });
      if (!r2.ok) { S.mineBusy = false; S.mineErr = words(r2.error); paintMine(); return; }
    }
    S.mineBusy = false;
    var r3 = await rpc('signoff_signer_me'); if (!r3.error && r3.data) S.me = r3.data;
    S.sigUrl = null; closeSheet(); T('Your signature is saved');
    paint(); if (S.me && S.me.has_signature) sigImage();
    S.signers = null; loadSigners();
  }
  function mineClick(el) {
    if (!S.mine) return;
    if (el.hasAttribute('data-w195tab')) { S.mine.tab = el.getAttribute('data-w195tab'); S.mine.canvas = null; S.mineErr = ''; paintMine(); }
    else if (el.hasAttribute('data-w195clear')) { var cv = S.mine.canvas; if (cv) cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); }
    else if (el.hasAttribute('data-w195save')) saveMine();
  }
  function mineInput(t) {
    if (!S.mine) return;
    if (t.id === 'w195mn') S.mine.name = t.value;
    else if (t.id === 'w195mt') S.mine.title = t.value;
    else if (t.id === 'w195mf') S.mine.title_fr = t.value;
  }
  function mineChange(t) {
    if (!S.mine || t.id !== 'w195file') return;
    var f = t.files && t.files[0]; if (!f) return;
    fromFile(f).then(function (png) { S.mine.png = png; S.mineErr = ''; paintMine(); }, function (e) { S.mine.png = null; S.mineErr = e.message; paintMine(); });
  }
