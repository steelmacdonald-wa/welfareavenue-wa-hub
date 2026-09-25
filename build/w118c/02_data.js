
  /* ---------- helpers ---------- */
  function E(s) { return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toastS(t) { try { toast(t); } catch (e) { /* fine */ } }
  function staff() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  function board() { try { return typeof MODE !== 'undefined' && MODE === 'board'; } catch (e) { return false; } }
  function allowed() { return staff() || board(); }
  function myEmail() { try { return String((USER && USER.email) || '').toLowerCase(); } catch (e) { return ''; } }
  function admin() {
    if (['steel.macdonald@welfareavenue.com', 'steelmacdonald@gmail.com', 'suhaib.abdillahi@welfareavenue.com'].indexOf(myEmail()) >= 0) return true;
    try { return !!(WA40_MINE && WA40_MINE.role === 'admin'); } catch (e) { return false; }
  }
  /* a page this person may open (per-person tab lists win) */
  function tabOk(id) { try { if (typeof wa40Allowed === 'function') return (wa40Allowed() || []).indexOf(id) >= 0; } catch (e) { /* fine */ } return true; }
  function me() { try { return (typeof who === 'function' && who()) || (USER && (USER.name || USER.email)) || 'Someone'; } catch (e) { return 'Someone'; } }
  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function ddmmyy(d) { d = d || new Date(); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2); }
  function dateOf(ds) { return ds ? new Date(String(ds).slice(0, 10) + 'T12:00:00') : null; }
  function niceDate(ds) { var d = dateOf(ds); if (!d || isNaN(d)) return ''; try { return d.toLocaleDateString('en-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return String(ds); } }
  function monthYear(ds) { var d = dateOf(ds); if (!d || isNaN(d)) return ''; try { return d.toLocaleDateString('en-CA', { month: 'short', year: 'numeric' }); } catch (e) { return String(ds).slice(0, 7); } }
  function seasonOf(ds) { var m = Number(String(ds || '').slice(5, 7)); if (!m) return null; return m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn'; }
  function label(list, v) { for (var i = 0; i < list.length; i++) if (list[i][0] === v) return list[i][1]; return v || ''; }
  function bytes(n) { n = Number(n); if (!n) return ''; if (n >= 1048576) return (n / 1048576).toFixed(1).replace(/\.0$/, '') + ' MB'; return Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function arr(v) {
    if (Array.isArray(v)) return v.map(function (x) { return String(x == null ? '' : x).trim(); }).filter(Boolean);
    if (typeof v === 'string') return v.split(/[,;\n]/).map(function (x) { return x.trim(); }).filter(Boolean);
    return [];
  }
  function clean(s, max) { s = String(s == null ? '' : s).replace(/\s*[\u2014\u2013]\s*/g, ', ').replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim(); return max ? s.slice(0, max) : s; }
  function slug(s) {
    s = String(s || '').toLowerCase();
    try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* old browsers */ }
    return s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function uclass(p) { return p.status === 'archived' ? 'u-arch' : p.status === 'needs_labels' ? 'u-needs' : 'u-' + (USAGE[p.usage] ? p.usage : 'check'); }
  function ulabel(p) { return p.status === 'archived' ? 'Archived' : p.status === 'needs_labels' ? 'Needs a look' : (USAGE[p.usage] || USAGE.check).label; }
  function badge(p) { return '<span class="w118cub ' + uclass(p) + '"><i></i>' + E(ulabel(p)) + '</span>'; }
  function focalCss(p) { return 'object-position:' + Math.round((p.focal_x == null ? 0.5 : p.focal_x) * 100) + '% ' + Math.round((p.focal_y == null ? 0.5 : p.focal_y) * 100) + '%;'; }
  function url(p, size) {
    if (!p) return '';
    var k = size === 'full' ? 'url_full' : size === 'thumb' ? 'url_thumb' : 'url_web';
    if (p[k]) return p[k];
    var path = p['path_' + (size || 'web')];
    return path ? BASE + path + '?v=' + (p.version || 1) : '';
  }
  function dlUrl(p, size) { var u = url(p, size); if (!u) return ''; return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'download=' + encodeURIComponent(p.key + (size === 'full' ? '' : '-' + size) + '.jpg'); }
  function hay(p) { return [p.title, p.alt_text, p.caption, p.description, p.place, p.event, p.people, p.series, p.notes, p.credit, p.key, label(SCENES, p.scene), label(SEASONS, p.season), arr(p.tags).join(' '), arr(p.partner).join(' '), String(p.taken_on || '').slice(0, 4)].join(' ').toLowerCase(); }
  function byKey(k) { for (var i = 0; i < P.rows.length; i++) if (P.rows[i].key === k) return P.rows[i]; return null; }
  function norm(r) {
    r = Object.assign({}, r);
    r.tags = arr(r.tags); r.partner = arr(r.partner); r.best_for = arr(r.best_for);
    if (r.focal_x == null) r.focal_x = 0.5; if (r.focal_y == null) r.focal_y = 0.5;
    r.status = r.status || 'ready'; r.usage = r.usage || 'check';
    ['full', 'web', 'thumb'].forEach(function (s) { if (!r['url_' + s] && r['path_' + s]) r['url_' + s] = BASE + r['path_' + s] + '?v=' + (r.version || 1); });
    return r;
  }
  /* on the same day: confirmed before new, ready before crop before consent, picks first */
  function rank(p) { var u = p.status === 'needs_labels' ? 8 : USAGE_ORDER.indexOf(p.usage); if (u < 0) u = 9; return u * 2 + (p.is_pick ? 0 : 1); }
  function sortRows(list) {
    var s = P.sort;
    return list.slice().sort(function (a, b) {
      if (s === 'added') return String(b.created_at || '').localeCompare(String(a.created_at || '')) || a.key.localeCompare(b.key);
      if (s === 'title') return String(a.title || '').localeCompare(String(b.title || ''));
      var x = a.taken_on || '', y = b.taken_on || '';
      if (x === y) return rank(a) - rank(b) || a.key.localeCompare(b.key);
      if (!x) return 1; if (!y) return -1;
      return s === 'taken_asc' ? x.localeCompare(y) : y.localeCompare(x);
    });
  }

  /* ---------- data ---------- */
  async function load(force) {
    if (P.loading) return P.loading;
    if (P.loaded && !force && Date.now() - P.at < 120000) return;
    P.loading = (async function () {
      try {
        var r = await db.from('wa_photos_list').select('*').order('taken_on', { ascending: false, nullsFirst: false }).limit(2000);
        if (r.error) throw r.error;
        P.rows = (r.data || []).map(norm); P.loaded = true; P.err = null; P.at = Date.now();
      } catch (e) { P.err = (e && e.message) || String(e); }
      P.loading = null;
    })();
    return P.loading;
  }
  function put(row) { row = norm(row); var i = P.rows.findIndex(function (x) { return x.key === row.key; }); if (i >= 0) P.rows[i] = Object.assign({}, P.rows[i], row); else P.rows.unshift(row); return byKey(row.key); }
  async function update(key, patch, what) {
    var old = byKey(key); patch = Object.assign({}, patch, { updated_by: me() });
    var r = await db.from('wa_photos').update(patch).eq('key', key).select().maybeSingle();
    if (r.error) throw r.error;
    var row = put(Object.assign({}, old || {}, r.data && r.data.key ? r.data : patch, { key: key }));
    if (what) { try { if (typeof logChange === 'function') logChange('photo', key, what.field, what.from, what.to); } catch (e) { /* audit is best effort */ } }
    return row;
  }
  function diffText(a, b, keys) {
    var from = [], to = [];
    var fmt = function (x) { if (Array.isArray(x)) return x.join(', '); if (typeof x === 'number') return String(Math.round(x * 1000) / 1000); return x == null ? '' : String(x); };
    keys.forEach(function (k) {
      var x = fmt(a[k]), y = fmt(b[k]);
      if (x !== y) { from.push(k + ': ' + x.slice(0, 80)); to.push(k + ': ' + y.slice(0, 80)); }
    });
    return { from: from.join('; ').slice(0, 900), to: to.join('; ').slice(0, 900), n: to.length };
  }

  /* ---------- images in the browser ---------- */
  function loadImg(src, cors) {
    return new Promise(function (res, rej) {
      var im = new Image(); if (cors) im.crossOrigin = 'anonymous'; im.decoding = 'async';
      im.onload = function () { res(im); }; im.onerror = function () { rej(new Error('Could not read this image')); };
      im.src = src;
    });
  }
  function drawTo(src, max) {
    var w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
    var s = Math.min(1, max / Math.max(w, h)); var cw = Math.max(1, Math.round(w * s)), ch = Math.max(1, Math.round(h * s));
    var c = document.createElement('canvas'); c.width = cw; c.height = ch;
    var x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.fillStyle = '#FFFAF2'; x.fillRect(0, 0, cw, ch); x.drawImage(src, 0, 0, cw, ch);
    return c;
  }
  function blobOf(c, q) { return new Promise(function (res, rej) { c.toBlob(function (b) { if (b) res(b); else rej(new Error('Could not make the JPEG')); }, 'image/jpeg', q); }); }
  function avgColor(c) {
    try {
      var t = document.createElement('canvas'); t.width = 12; t.height = 12; var x = t.getContext('2d'); x.drawImage(c, 0, 0, 12, 12);
      var d = x.getImageData(0, 0, 12, 12).data, r = 0, g = 0, b = 0, n = 0;
      for (var i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      var hx = function (v) { return ('0' + Math.round(v / n).toString(16)).slice(-2); };
      return ('#' + hx(r) + hx(g) + hx(b)).toUpperCase();
    } catch (e) { return null; }
  }
  /* the date (and camera) from a JPEG's EXIF block; nothing else is read or kept */
  function exif(buf) {
    var out = {};
    try {
      var v = new DataView(buf), len = v.byteLength;
      if (len < 12 || v.getUint16(0) !== 0xFFD8) return out;
      var off = 2;
      while (off + 10 < len) {
        var mk = v.getUint16(off), size = v.getUint16(off + 2);
        if (mk === 0xFFE1 && v.getUint32(off + 4) === 0x45786966) {
          var t = off + 10, le = v.getUint16(t) === 0x4949;
          var g16 = function (o) { return v.getUint16(o, le); }, g32 = function (o) { return v.getUint32(o, le); };
          var str = function (o, n) { var s = ''; for (var i = 0; i < n && o + i < len; i++) { var ch = v.getUint8(o + i); if (!ch) break; s += String.fromCharCode(ch); } return s.trim(); };
          var ifd = function (at, want) {
            var res = {}; if (t + at + 2 > len) return res; var n = g16(t + at);
            for (var i = 0; i < n && i < 400; i++) {
              var e = t + at + 2 + i * 12; if (e + 12 > len) break;
              var tag = g16(e), type = g16(e + 2), cnt = g32(e + 4);
              if (want.indexOf(tag) < 0) continue;
              if (type === 2) res[tag] = str(cnt > 4 ? t + g32(e + 8) : e + 8, Math.min(cnt, 64));
              else if (type === 3) res[tag] = g16(e + 8);
              else if (type === 4) res[tag] = g32(e + 8);
            }
            return res;
          };
          var i0 = ifd(g32(t + 4), [0x010F, 0x0110, 0x0132, 0x8769]);
          var dt = i0[0x0132];
          if (i0[0x8769]) { var ex = ifd(i0[0x8769], [0x9003, 0x9004]); dt = ex[0x9003] || ex[0x9004] || dt; }
          if (dt && /^(19[89]\d|20\d\d):[01]\d:[0-3]\d/.test(dt) && dt.slice(0, 10) !== '0000:00:00') { out.date = dt.slice(0, 10).replace(/:/g, '-'); out.time = dt.slice(11, 16); }
          var make = clean(i0[0x010F] || '', 40), model = clean(i0[0x0110] || '', 40);
          if (model) out.camera = model.toLowerCase().indexOf(make.toLowerCase().split(' ')[0]) === 0 || !make ? model : make + ' ' + model;
          return out;
        }
        if (mk === 0xFFDA || (mk & 0xFF00) !== 0xFF00) break;
        off += 2 + size;
      }
    } catch (e) { /* no date then */ }
    return out;
  }
  async function b64For(p, canvas) {
    var c = canvas;
    if (!c) { var im = await loadImg(url(p, 'web'), true); c = im; }
    var s = drawTo(c, 1024);
    var d = s.toDataURL('image/jpeg', 0.8);
    return d.slice(d.indexOf(',') + 1);
  }

  /* ---------- AI: first labels from the photo_label route ---------- */
  function normSuggestion(inp) {
    inp = inp || {}; var o = {};
    ['title', 'alt_text', 'caption', 'description', 'usage_note', 'people'].forEach(function (k) { if (inp[k] != null && String(inp[k]).trim()) o[k] = clean(inp[k], k === 'title' ? 160 : k === 'alt_text' ? 400 : 1200); });
    if (o.title) o.title = o.title.replace(/[.]+$/, '');
    if (SEASONS.some(function (s) { return s[0] === inp.season; })) o.season = inp.season;
    if (SCENES.some(function (s) { return s[0] === inp.scene; })) o.scene = inp.scene;
    if (USAGE[inp.usage]) o.usage = inp.usage;
    if (BRANDING.some(function (s) { return s[0] === inp.branding; })) o.branding = inp.branding;
    var tags = arr(inp.tags).map(function (x) { return x.toLowerCase().replace(/^#/, ''); }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).slice(0, 12);
    if (tags.length) o.tags = tags;
    var bf = arr(inp.best_for).map(function (x) { return x.toLowerCase().replace(/[\s-]+/g, '_'); }).filter(function (x, i, a) { return BEST.some(function (b) { return b[0] === x; }) && a.indexOf(x) === i; });
    if (bf.length) o.best_for = bf;
    var fx = Number(inp.focal_x), fy = Number(inp.focal_y);
    if (isFinite(fx) && isFinite(fy)) { o.focal_x = Math.min(1, Math.max(0, fx)); o.focal_y = Math.min(1, Math.max(0, fy)); }
    return o;
  }
  async function suggest(p, canvas, hints) {
    var data = await b64For(p, canvas);
    var known = [];
    if (hints && hints.file) known.push('file name ' + hints.file);
    if (p.taken_on) known.push('taken ' + niceDate(p.taken_on));
    if (p.place) known.push('place: ' + p.place);
    if (p.event) known.push('event: ' + p.event);
    if (p.series) known.push('part of the set ' + p.series);
    var body = { max_tokens: 1200, system: SPEC.system, tools: [SPEC.tool], tool_choice: { type: 'tool', name: SPEC.tool.name },
      messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: data } }, { type: 'text', text: 'Label this photo.' + (known.length ? ' What we know: ' + known.join('; ') + '.' : '') }] }] };
    var r = await db.functions.invoke('llm', { headers: { 'x-wa-task': 'photo_label', 'x-wa-caller': 'photos' }, body: body });
    if (r.error) { var m = (r.error && r.error.message) || String(r.error); if (/401|unauthor/i.test(m)) m = 'AI labels are not open to this account'; throw new Error(m); }
    var tu = ((r.data && r.data.content) || []).filter(function (c) { return c && c.type === 'tool_use'; })[0];
    if (!tu || !tu.input) throw new Error((r.data && r.data.error && r.data.error.message) || 'nothing came back');
    var o = normSuggestion(tu.input);
    if (!o.title && !o.alt_text) throw new Error('nothing usable came back');
    return { fields: o, model: (r.data._wa && r.data._wa.model) || r.data.model || null, at: new Date().toISOString() };
  }
