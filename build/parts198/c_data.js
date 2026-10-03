
  /* ---------- the dictionary: this browser's copy, refreshed when the Hub's changes ---------- */
  function cached() { try { var c = JSON.parse(ls('wa198dict') || 'null'); if (c && c.d) { S.d = c.d; S.v = c.v || ''; return true; } } catch (e) { /* fine */ } return false; }
  function dbOk() { try { return typeof db !== 'undefined' && db && typeof db.rpc === 'function'; } catch (e) { return false; } }
  async function refreshDict(force) {
    if (!dbOk()) return false;
    try {
      if (!force && S.d) { var vr = await db.rpc('wa198_dict_v', { p_lang: 'fr' }); if (vr && !vr.error && vr.data === S.v) return false; }
      var r = await db.rpc('wa198_dict', { p_lang: 'fr' });
      if (!r || r.error || !r.data || !r.data.d) return false;
      var fresh = !S.d; S.d = r.data.d; S.v = r.data.v || '';
      ls('wa198dict', JSON.stringify({ v: S.v, d: S.d }));
      return fresh;
    } catch (e) { return false; }
  }
  /* the onboarding and Academy content in French (only what is current) */
  var CT = { trainings: 'id', onboarding_template: 'id', academy_paths: 'key', hr_setup_template: 'id', app_config: 'key' };
  function setContent(rows) {
    var m = {}, rev = {};
    (rows || []).forEach(function (r) { var k = r.tbl + '|' + r.row_id + '|' + r.field; m[k] = r.tr; });
    S.cmap = m; S.rev = rev;
  }
  function cachedContent() { try { var c = JSON.parse(ls('wa198content') || 'null'); if (c && Array.isArray(c)) { setContent(c); return true; } } catch (e) { /* fine */ } return false; }
  async function refreshContent() {
    if (!dbOk()) return;
    try { var r = await db.rpc('wa198_content', { p_lang: 'fr' }); if (r && !r.error && Array.isArray(r.data)) { setContent(r.data); ls('wa198content', JSON.stringify(r.data)); } } catch (e) { /* fine */ }
  }
  /* the pages where this content is edited: a note says the English is the original (the French is shown; a save keeps the English
     of every field left as it was, and what is typed is saved as typed) */
  function editing() { var h = String(location.hash || ''); return /^#hrcentre\/(plan|training)/.test(h); }
  function editNote() {
    var p = document.getElementById('hrcentre'); if (!p) return;
    var n = document.getElementById('w198edit');
    if (S.lang !== 'fr' || !editing()) { if (n) n.remove(); return; }
    if (n) return;
    n = document.createElement('div'); n.id = 'w198edit'; n.className = 'notranslate';
    n.setAttribute('style', 'margin:0 0 14px;padding:10px 14px;border-radius:12px;background:rgba(220,165,39,.18);font-size:13px;line-height:1.5;color:#1F201E');
    n.innerHTML = '<b>Vous voyez la traduction fran\u00e7aise.</b> Le texte original est en anglais\u00a0: pour modifier ce contenu, passez \u00e0 l\u2019anglais (menu du compte, English), sinon ce que vous \u00e9crivez remplace l\u2019original.';
    var m = p.querySelector(':scope > .w118mast'); if (m) m.insertAdjacentElement('afterend', n); else p.insertBefore(n, p.firstChild);
  }
  function frValue(orig, tr) { if (orig && typeof orig === 'object') { try { return JSON.parse(tr); } catch (e) { return orig; } } return tr; }
  function mapRows(t, res) {
    try {
      if (S.lang !== 'fr' || !S.cmap || !res || !res.data) return res;
      var idk = CT[t], rows = Array.isArray(res.data) ? res.data : [res.data];
      rows.forEach(function (row) {
        if (!row || typeof row !== 'object' || row[idk] == null) return;
        if (t === 'app_config' && row.key !== 'onboarding_journey') return;
        Object.keys(row).forEach(function (f) {
          var k = t + '|' + row[idk] + '|' + f, tr = S.cmap[k];
          if (tr == null || row[f] == null) return;
          var v = frValue(row[f], tr);
          S.rev[t + '|' + f + '|' + (typeof v === 'object' ? JSON.stringify(v) : v)] = row[f];
          row[f] = v;
        });
      });
    } catch (e) { /* the English stays */ }
    return res;
  }
  /* a save never writes the French over the English: a value still equal to the French we showed goes back to the English */
  function unmap(t, patch) {
    if (!patch || typeof patch !== 'object' || !Object.keys(S.rev).length) return patch;
    var one = function (p) { if (!p || typeof p !== 'object') return p; Object.keys(p).forEach(function (f) { var v = p[f], k = t + '|' + f + '|' + (v && typeof v === 'object' ? JSON.stringify(v) : v); if (Object.prototype.hasOwnProperty.call(S.rev, k)) p[f] = S.rev[k]; }); return p; };
    return Array.isArray(patch) ? patch.map(one) : one(patch);
  }
  function wrapThen(b, t) {
    if (!b || typeof b.then !== 'function' || b.__w198) return b;
    var orig = b.then; b.__w198 = true;
    b.then = function (ok, bad) { return orig.call(this, function (res) { res = mapRows(t, res); return ok ? ok(res) : res; }, bad); };
    return b;
  }
  function patchDb() {
    if (!dbOk() || db.__w198) return !!(dbOk() && db.__w198);
    var from = db.from.bind(db);
    db.from = function (t) {
      var q = from(t);
      if (!CT[t] || S.lang !== 'fr') return q;
      ['select'].forEach(function (mth) { if (typeof q[mth] !== 'function') return; var o = q[mth].bind(q); q[mth] = function () { return wrapThen(o.apply(null, arguments), t); }; });
      ['update', 'upsert', 'insert'].forEach(function (mth) { if (typeof q[mth] !== 'function') return; var o = q[mth].bind(q); q[mth] = function (p) { var a = Array.prototype.slice.call(arguments); a[0] = unmap(t, p); return o.apply(null, a); }; });
      return q;
    };
    db.__w198 = true; return true;
  }
  /* what had no translation, sent now and then (at most 80 a call) */
  async function flush() {
    if (!dbOk() || S.lang !== 'fr') return;
    var keys = Object.keys(S.q).filter(function (k) { return S.q[k] === 1; }).slice(0, 80); if (!keys.length) return;
    keys.forEach(function (k) { S.q[k] = 2; });
    try { await db.rpc('wa198_seen', { p_lang: 'fr', p_keys: keys }); S.sent += keys.length; } catch (e) { /* next time */ }
  }
  /* the person's language, from the database (another device may have changed it) */
  async function syncPref() {
    var em = myEmail(); if (!dbOk() || !em) return;
    try {
      var r = await db.from('hub_user_prefs').select('lang').eq('email', em).limit(1);
      var row = r && !r.error && r.data && r.data[0];
      if (row && row.lang && row.lang !== S.lang) {
        var once = null; try { once = sessionStorage.getItem('wa198sync'); } catch (e) { /* fine */ }
        if (once === row.lang) return;
        try { sessionStorage.setItem('wa198sync', row.lang); } catch (e) { /* fine */ }
        await switchTo(row.lang, true);
      }
    } catch (e) { /* fine */ }
  }
  async function switchTo(lang, fromPref) {
    lang = lang === 'fr' ? 'fr' : 'en';
    var cover = document.createElement('div'); cover.className = 'w198busy'; cover.textContent = lang === 'fr' ? 'Passage au français…' : 'Switching to English…'; document.body.appendChild(cover);
    ls('wa198lang', lang);
    if (!fromPref) { try { var em = myEmail(); if (em && dbOk()) await db.from('hub_user_prefs').upsert({ email: em, lang: lang, updated_at: new Date().toISOString() }); } catch (e) { /* this browser keeps it */ } }
    if (lang === 'fr') { S.lang = 'fr'; await Promise.all([refreshDict(true), refreshContent()]); }
    location.reload();
  }
