
  /* ---------- Text settings: the mode, the test phone, what volunteers see per role ---------- */
  async function loadGuides() {
    try { var r = await db.from('volunteer_role_guides').select('*').order('role'); S.guides = (r && r.data) || []; } catch (e) { S.guides = S.guides || []; }
    return S.guides;
  }
  async function loadPhotos() {
    if (S.photos) return S.photos;
    try {
      var r = await db.from('wa_photos').select('id,title,path_thumb,path_web,orientation,scene').eq('status', 'ready').eq('usage', 'ready').not('path_web', 'is', null).order('id', { ascending: true }).limit(400);
      S.photos = (r && r.data) || [];
    } catch (e) { S.photos = []; }
    return S.photos;
  }
  async function myEmail() { try { var u = await db.auth.getUser(); return (u && u.data && u.data.user && u.data.user.email) || null; } catch (e) { return null; } }
  function guideOf(role) { return (S.guides || []).filter(function (g) { return g.role === role; })[0] || null; }
  function modeHtml(cn) {
    var m = S.mode || 'off';
    var opt = function (v, t, d) { return '<label class="' + (m === v ? 'on' : '') + '"><input type="radio" name="w171mode" value="' + v + '"' + (m === v ? ' checked' : '') + (cn.admin ? '' : ' disabled') + '><span><b>' + t + '</b><small>' + d + '</small></span></label>'; };
    return '<div class="w171h">Texts</div><div class="modes">'
      + opt('off', 'Off', 'Nothing is texted. Replies are still kept, and STOP is always honoured.')
      + opt('test', 'Test', 'Only the test phone gets texts; everyone else is held back. Use it to try the whole flow on yourself.')
      + opt('live', 'On', 'Confirmation texts go to volunteers 7 days before each serving, and YES, NO and STOP replies update the roster.')
      + '</div>' + (cn.admin ? '<div id="w171mconf"></div>' : '<p class="w171note">Only an admin can switch texts on or off.</p>');
  }
  async function settingsModal() {
    var cn = await can(); await loadCfg(true);
    openModal('<div class="w171m"><h3>Text settings</h3><p class="sub">Loading…</p></div>');
    await Promise.all([loadGuides(), loadPhotos()]);
    paintSettings(cn);
  }
  function paintSettings(cn) {
    var g = guideOf(S.set.role) || { role: S.set.role, label_en: one(S.set.role), label_fr: '', expect_en: [], expect_fr: [] };
    var pics = (S.photos || []).filter(function (p) { return p.orientation !== 'portrait' || p.id === g.photo_id || true; });
    var hook = S.cfg.quo_webhook_id ? 'Replies come back through Quo (webhook ' + String(S.cfg.quo_webhook_id).split(' ')[0] + ').' : 'Replies are not connected yet.';
    var html = '<div class="w171m"><h3>Text settings</h3><p class="sub">Volunteers get a text from the ops line, 438-808-7754, 7 days before their serving (at ' + E(S.cfg.sms_confirm_hour || 10) + ' am), with their own link to confirm. ' + E(hook) + '</p>'
      + modeHtml(cn)
      + '<label class="f">Test phone</label><input type="text" id="w171tp" value="' + E(S.cfg.sms_test_phones || '') + '"' + (cn.admin ? '' : ' disabled') + ' placeholder="438 555 0100">'
      + '<div class="w171h" style="margin-top:18px">What volunteers see after they confirm</div>'
      + '<label class="f">Role</label><select id="w171role">' + ROLES.map(function (r) { var x = guideOf(r); return '<option value="' + r + '"' + (r === S.set.role ? ' selected' : '') + '>' + E(x ? x.label_en : one(r)) + '</option>'; }).join('') + '</select>'
      + '<div class="two"><div><label class="f">Name (English)</label><input type="text" id="w171len" value="' + E(g.label_en || '') + '"></div><div><label class="f">Name (French)</label><input type="text" id="w171lfr" value="' + E(g.label_fr || '') + '"></div></div>'
      + '<label class="f">Photo (the Photo library’s ready photos)</label><div class="pics">' + pics.map(function (p) { return '<button type="button" title="' + E(p.title) + '" data-w171pic="' + p.id + '" class="' + (p.id === g.photo_id ? 'on' : '') + '" style="background-image:url(&quot;' + E(ST + (p.path_thumb || p.path_web)) + '&quot;)"></button>'; }).join('') + '</div>'
      + '<div class="two"><div><label class="f">What to expect (English, one per line)</label><textarea id="w171een">' + E((g.expect_en || []).join('\n')) + '</textarea></div><div><label class="f">What to expect (French)</label><textarea id="w171efr">' + E((g.expect_fr || []).join('\n')) + '</textarea></div></div>'
      + '<div class="two"><div><label class="f">What to bring (English)</label><input type="text" id="w171ben" value="' + E(g.bring_en || '') + '"></div><div><label class="f">What to bring (French)</label><input type="text" id="w171bfr" value="' + E(g.bring_fr || '') + '"></div></div>'
      + '<div class="two"><div><label class="f">When to arrive (English)</label><input type="text" id="w171aen" value="' + E(g.arrive_en || '') + '"></div><div><label class="f">When to arrive (French)</label><input type="text" id="w171afr" value="' + E(g.arrive_fr || '') + '"></div></div>'
      + '<div class="foot"><button class="w171btn ghost" data-w171close="1">Close</button><button class="w171btn" data-w171gsave="1"' + (guideOf(S.set.role) ? '' : ' disabled') + '>Save this role</button></div></div>';
    var mb = document.getElementById('modalBox'), back = document.getElementById('modalBack');
    if (mb && back && back.style.display === 'flex' && mb.querySelector('.w171m')) mb.innerHTML = html; else openModal(html);
    S.set.photo = g.photo_id || null;
  }
  async function saveGuide(btn) {
    var g = guideOf(S.set.role); if (!g) return;
    var v = function (id) { var el = document.getElementById(id); return el ? el.value : ''; };
    var lines = function (id) { return v(id).split('\n').map(function (s) { return s.trim(); }).filter(Boolean); };
    var row = { label_en: v('w171len').trim() || g.label_en, label_fr: v('w171lfr').trim() || g.label_fr, photo_id: S.set.photo || null,
      expect_en: lines('w171een'), expect_fr: lines('w171efr'), bring_en: v('w171ben').trim() || null, bring_fr: v('w171bfr').trim() || null,
      arrive_en: v('w171aen').trim() || null, arrive_fr: v('w171afr').trim() || null, updated_at: new Date().toISOString(), updated_by: await myEmail() };
    btn.disabled = true;
    try {
      var r = await db.from('volunteer_role_guides').update(row).eq('role', g.role);
      if (r.error) throw r.error;
      Object.assign(g, row); T('Saved: what a ' + row.label_en.toLowerCase() + ' sees');
    } catch (e) { T('Could not save: ' + String((e && e.message) || e).slice(0, 90)); }
    btn.disabled = false;
  }
  function modeAsk(v) {
    var box = document.getElementById('w171mconf'); if (!box) return;
    if (v === S.mode) { box.innerHTML = ''; return; }
    var what = { off: 'Switch texts off? Anything still queued is not sent.', test: 'Switch to test mode? Only the test phone gets texts.', live: 'Switch texts on? Volunteers on upcoming servings get their confirmation text 7 days before (anyone already inside 7 days gets it at the next quarter hour, between 8 am and 8 pm).' }[v];
    box.innerHTML = '<div class="' + (v === 'live' ? 'warn' : 'info') + '">' + E(what) + '<div class="foot" style="margin-top:8px"><button class="w171btn ghost" data-w171mno="1">Keep ' + E((MODES[S.mode] || S.mode).toLowerCase()) + '</button><button class="w171btn" data-w171mset="' + v + '">Yes, ' + (v === 'live' ? 'switch texts on' : v === 'test' ? 'use test mode' : 'switch them off') + '</button></div></div>';
  }
  async function modeSet(v, btn) {
    btn.disabled = true;
    try {
      var r = await db.rpc('wa171_sms_mode_set', { p_mode: v });
      if (r.error) throw r.error;
      S.mode = v; S.modeAt = Date.now(); T(MODES[v] + (v === 'live' ? ': volunteers will get their texts' : ''));
      var cn = await can(); paintSettings(cn); paintCard();
    } catch (e) { T('Could not switch: ' + String((e && e.message) || e).slice(0, 90)); btn.disabled = false; }
  }
  async function testPhoneSave(el) {
    var val = el.value.trim();
    try {
      var r = await db.from('app_config').update({ value: val, updated_at: new Date().toISOString() }).eq('key', 'sms_test_phones');
      if (r.error) throw r.error;
      S.cfg.sms_test_phones = val; T('Test phone saved');
    } catch (e) { T('Could not save the test phone: ' + String((e && e.message) || e).slice(0, 80)); }
  }
