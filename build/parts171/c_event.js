
  /* ---------- the event page ---------- */
  function statusTag(r, evId) {
    if (isOff(r)) return '';
    var c = r.confirm || {};
    if (isConf(r)) {
      if (r.confirm_status === 'confirmed') return '<span class="w171tag ok">✓ ' + (c.via === 'reply' ? 'Replied YES' : 'Confirmed by text link') + (r.confirmed_at ? ' · ' + E(fmtWhen(r.confirmed_at)) : '') + '</span>';
      return '';
    }
    if (isDecl(r)) {
      if (r.confirm_status === 'declined') return '<span class="w171tag no">Can’t make it ' + (c.via === 'reply' ? '(replied NO)' : '(text link)') + (r.confirmed_at ? ' · ' + E(fmtWhen(r.confirmed_at)) : '') + '</span>';
      return '';
    }
    var t = lastText(evId, r.id);
    if (!t && r.signup_noticed_at) return '<span class="w171tag mute">Told they are signed up · ' + E(fmtWhen(r.signup_noticed_at)) + '</span>';
    if (t && t.status === 'sent') return '<span class="w171tag wait">Texted ' + E(fmtWhen(t.sent_at || t.created_at)) + ' · no answer yet</span>';
    if (t && t.status === 'queued') return '<span class="w171tag wait">Text queued</span>';
    if (t && t.status === 'failed') return '<span class="w171tag no" title="' + E(t.error || '') + '">The text did not go through</span>';
    if (!phoneOf(r)) return '<span class="w171tag mute">No phone number</span>';
    return '';
  }
  /* wave172: what the volunteer told us on their page (the recipe, donations, the car, how photos come back) and the survey */
  var SHARE = { album: 'the Google Photos album', drive: 'the Drive folder', email: 'email' };
  function recipeName(id) { var x = (S.recipes || []).filter(function (r) { return r.id === id; })[0]; return x ? x.name : 'recipe ' + id; }
  function detailTags(r, evId) {
    if (isOff(r) || isDecl(r)) return '';
    var c = r.confirm || {}, out = [];
    if (r.recipe_id && lower(r.role) === 'cook') out.push('Cooking: ' + recipeName(r.recipe_id));
    if (lower(r.role) === 'cook' && c.cook_location === 'home' && c.neighbourhood) out.push('Pickup: ' + c.neighbourhood + (c.address ? ' \u00b7 ' + c.address : ''));
    if (lower(r.role) === 'cook' && c.cook_location === 'drop off') out.push('Drops off' + (c.stay_to_serve === true ? ' \u00b7 staying to serve' : c.stay_to_serve === false ? ' \u00b7 not staying' : ''));
    if (c.donations) out.push('Bringing to donate: ' + c.donations);
    if (c.vehicle || c.model) out.push('Car: ' + [c.vehicle, c.model].filter(Boolean).join(' '));
    if (c.photos_share) out.push('Photos by ' + (SHARE[c.photos_share] || c.photos_share));
    var sv = (S.msgs[evId] || []).filter(function (x) { return x.roster_id === r.id && x.kind === 'survey' && x.direction === 'out' && x.status === 'sent'; })[0];
    if (sv) out.push('Survey texted ' + fmtWhen(sv.sent_at || sv.created_at));
    var iv = (S.msgs[evId] || []).filter(function (x) { return x.roster_id === r.id && x.kind === 'itinerary' && x.direction === 'out' && x.status === 'sent'; })[0];
    if (iv) out.push('Itinerary texted ' + fmtWhen(iv.sent_at || iv.created_at));
    return out.map(function (x) { return '<span class="w171tag mute">' + E(x) + '</span>'; }).join('');
  }
  function tagFor(r, evId) { var D = curD(); return statusTag(r, evId) + detailTags(r, evId) + (D ? w174Tags(r, evId, driverKinds(D)) : '') + w175Tags(r); }
  function decorateCards() {
    var D = curD(); var ev = curEv(); if (!D || !ev) return;
    var by = {}; (D.roster || []).forEach(function (r) { by[String(r.id)] = r; });
    document.querySelectorAll('#w119 [data-w119card]').forEach(function (el) {
      var r = by[el.getAttribute('data-w119card')]; if (!r) return;
      var html = tagFor(r, ev.id);
      var olds = el.querySelectorAll('.w171tag');
      var cur = Array.prototype.map.call(olds, function (x) { return x.outerHTML; }).join('');
      if (cur === html) return;
      Array.prototype.forEach.call(olds, function (x) { x.remove(); });
      if (html) el.insertAdjacentHTML('beforeend', html);
    });
  }
  function decorateMast() {
    var ev = curEv(), D = curD(); var meta = document.querySelector('#w119 .mast .meta'); if (!ev || !D || !meta) return;
    var c = counts(D.roster, ev.id);
    var fmt = ev.format ? FORMATS[ev.format] || ev.format : '';
    var up = ev.event_date >= todayIso() && ev.status !== 'cancelled';
    var html = (up || fmt ? '<span class="w171pill' + (fmt ? '' : ' gold') + '"' + (staff() ? ' data-w171fmt="1" title="Set the format"' : '') + '>' + E(fmt || 'Format not set') + '</span>' : '')
      + (c.list ? '<span class="w171pill">' + c.conf + ' of ' + c.list + ' confirmed' + (c.bytext ? ' · ' + c.bytext + ' by text' : '') + '</span>' : '');
    var box = meta.querySelector('.w171m1');
    if (!box) { box = document.createElement('span'); box.className = 'w171m1'; box.style.display = 'contents'; meta.appendChild(box); }
    if (box.__h !== html) { box.innerHTML = html; box.__h = html; }
  }
  function repHtml(m, D) {
    var r = m.roster_id ? (D.roster || []).filter(function (x) { return x.id === m.roster_id; })[0] : null;
    var who = r ? first(r.person_name) + ' (' + one(r.role) + ')' : 'Someone not on this roster';
    var h = { confirmed: ['ok', 'Confirmed'], declined: ['no', 'Can’t make it'], opted_out: ['no', 'Stopped texts'], opted_in: ['ok', 'Texts back on'], question: ['wait', 'Needs an answer'], stored: ['mute', 'Kept (texts off)'], unmatched: ['mute', 'Unknown number'] }[m.handled] || ['mute', m.handled || ''];
    return '<div class="w171rep"><div class="h"><b>' + E(who) + '</b><span>' + E(fmtWhen(m.created_at)) + '</span><span class="w171tag ' + h[0] + '" style="display:inline-block;margin:0">' + E(h[1]) + '</span></div><p>' + E(m.body) + '</p></div>';
  }
  function cardHtml(ev, D, cn) {
    var c = counts(D.roster, ev.id);
    var mode = S.mode || 'off';
    var up = ev.event_date > todayIso() && ev.status !== 'cancelled' && ev.status !== 'completed';
    var ad = autoDay(ev);
    var note;
    if (!up) note = 'This serving is over, so no more confirmation texts go out.';
    else if (mode === 'off') note = 'Texts are off: nothing goes out until an admin switches them on in Text settings.';
    else if (mode === 'test') note = 'Test mode: only the test phone gets texts. Everyone else is held back.';
    else note = (ad.day > todayIso() ? 'Confirmation texts go automatically on ' + fmtDay(ad.day, true) + ' at ' + ad.hour + ' am' : 'Confirmation texts go automatically, 8 am to 8 pm') + ' to everyone not yet confirmed. Anyone added later gets theirs right away; someone added more than 7 days out first gets a text saying they are signed up, with a link to add it to their calendar.' + ' The day before, confirmed volunteers get their itinerary; after the serving, their survey' + (String(S.cfg.sms_survey_roles || '*').trim() === '*' ? '' : ' (' + String(S.cfg.sms_survey_roles).split(',').map(function (x) { return one(x.trim()).toLowerCase(); }).join(', ') + ')') + '.';
    var reps = replies(ev.id).slice(0, 6);
    return '<h4>Texts <span class="mode ' + E(mode) + '">' + E(MODES[mode] || mode) + '</span></h4>'
      + '<div class="w171nums"><div><b>' + c.conf + '</b><span>confirmed of ' + c.list + '</span></div><div><b>' + c.bytext + '</b><span>by text</span></div><div><b>' + c.waiting + '</b><span>waiting' + (c.texted ? ', ' + c.texted + ' texted' : '') + '</span></div><div><b>' + c.decl + '</b><span>can’t make it</span></div></div>'
      + '<p class="w171note">' + E(note) + (c.nophone && up ? ' ' + c.nophone + ' on the list ' + (c.nophone === 1 ? 'has' : 'have') + ' no phone number.' : '') + '</p>'
      + '<div class="w171btns">'
      + (cn.text && up ? '<button class="w171btn" data-w171send="1"' + (mode === 'off' ? ' disabled title="Texts are off"' : '') + '>Text to confirm</button>' : '')
      + (cn.admin && up && (D.roster || []).length ? '<button class="w171btn ghost" data-w171test="1">Send me a test</button>' : '')
      + '<button class="w171btn ghost" data-w171set="1">Text settings</button></div>'
      + '<div class="w171h">Replies</div>' + (reps.length ? reps.map(function (m) { return repHtml(m, D); }).join('') : '<p class="w171note" style="margin:0">No texts back yet. YES and NO update the roster by themselves; anything else shows here for the team.</p>');
  }
  async function loadRecipes() {
    if (S.recipes) return S.recipes;
    try { var r = await db.from('recipes').select('id,name').order('sort'); S.recipes = (r && r.data) || []; } catch (e) { S.recipes = []; }
    return S.recipes;
  }
  async function paintCard() {
    var ev = curEv(), D = curD(); var rail = document.getElementById('w119rail');
    if (!ev || !D || !rail || !staff()) return;
    var cn = await can(); await loadCfg(false); await loadMsgs(ev.id, false); await loadRecipes(); await loadAccounts(false);
    if (curEv() !== ev) return;
    rail = document.getElementById('w119rail'); if (!rail) return;
    var box = document.getElementById('w171card');
    if (!box) { box = document.createElement('div'); box.id = 'w171card'; box.className = 'cardy w171card'; rail.insertBefore(box, rail.firstChild); }
    var html = cardHtml(ev, D, cn);
    if (box.__h !== html) { box.innerHTML = html; box.__h = html; }
    decorateCards(); decorateMast();
    paintW174();
  }

  /* ---------- Text to confirm ---------- */
  function sendModal() {
    var ev = curEv(), D = curD(); if (!ev || !D) return;
    var rows = (D.roster || []).filter(function (r) { return !isOff(r) && !isConf(r) && !isDecl(r); });
    var html = '<div class="w171m"><h3>Text to confirm</h3><p class="sub">' + E(fmtDay(ev.event_date, true)) + ' · each person gets their own link to confirm their spot, from the ops line.</p>';
    if (S.mode === 'test') html += '<div class="info">Test mode: only the test phone gets a text. The others are held back until texts are on.</div>';
    if (!rows.length) html += '<p>Everyone on this serving has answered. Nothing to send.</p>';
    rows.forEach(function (r) {
      var t = lastText(ev.id, r.id); var ph = phoneOf(r);
      var sent = t && (t.status === 'sent' || t.status === 'queued');
      html += '<label class="row"><input type="checkbox" data-w171pick="' + r.id + '"' + (ph && !sent ? ' checked' : '') + (ph ? '' : ' disabled') + '><span class="who">' + E(r.person_name || 'Unnamed') + '<small>' + E(one(r.role)) + ' · ' + (ph ? (sent ? 'texted ' + E(fmtWhen(t.sent_at || t.created_at)) + ' (not sent twice)' : 'not texted yet') : 'no phone number') + '</small></span></label>';
    });
    if (rows.length) html += '<div class="prev">Hi <first name>, it’s Welfare Avenue! You’re on the list as a <role> for our serving on ' + E(fmtDay(ev.event_date, true)) + '. Please confirm here: hub.welfareavenue.com/c/… (or reply YES or NO). Reply STOP to stop texts.</div><p class="w171note">Someone whose contact says French gets it in French. Anyone already texted for this serving is not texted again.</p>';
    html += '<div class="foot"><button class="w171btn ghost" data-w171close="1">Cancel</button>' + (rows.length ? '<button class="w171btn" data-w171go="1">Send the texts</button>' : '') + '</div></div>';
    openModal(html);
  }
  async function sendGo(btn) {
    var ev = curEv(); if (!ev || S.busy) return;
    var ids = Array.prototype.map.call(document.querySelectorAll('[data-w171pick]:checked'), function (c) { return Number(c.getAttribute('data-w171pick')); });
    if (!ids.length) { T('Tick at least one person'); return; }
    S.busy = true; btn.disabled = true; btn.textContent = 'Sending…';
    try {
      var r = await db.rpc('wa171_text_to_confirm', { p_event: ev.id, p_roster: ids });
      if (r.error) throw r.error;
      var d = r.data || {};
      var bits = [];
      if (d.queued) bits.push(d.queued + ' text' + (d.queued === 1 ? '' : 's') + ' on the way');
      if (d.held_by_test_mode) bits.push(d.held_by_test_mode + ' held back by test mode');
      if (d.already_texted) bits.push(d.already_texted + ' already texted');
      if (d.no_phone) bits.push(d.no_phone + ' with no phone');
      if (d.opted_out) bits.push(d.opted_out + ' stopped texts');
      if (d.reason) bits.push(d.reason);
      T(bits.join(', ') || 'Nothing to send');
      closeModal();
      setTimeout(function () { loadMsgs(ev.id, true).then(paintCard); }, 2500);
    } catch (e) { T('Could not send: ' + String((e && e.message) || e).slice(0, 90)); btn.disabled = false; btn.textContent = 'Send the texts'; }
    S.busy = false;
  }
  async function sendTest() {
    var ev = curEv(), D = curD(); if (!ev || !D || S.busy) return;
    var r = (D.roster || []).filter(function (x) { return !isOff(x); })[0] || (D.roster || [])[0]; if (!r) return;
    S.busy = true; T('Sending the test to the test phone…');
    try {
      var res = await db.functions.invoke('quo-send', { body: { action: 'test_confirm', roster_id: r.id } });
      if (res.error) throw res.error;
      var d = res.data || {};
      if (d.error) throw new Error(d.error);
      var okN = (d.results || []).filter(function (x) { return x.ok; }).length;
      T(okN ? 'Test sent (as ' + first(r.person_name) + '’s text). Its link saves nothing.' : 'The test did not go through: ' + String(((d.results || [])[0] || {}).error || '').slice(0, 80));
      loadMsgs(ev.id, true);
    } catch (e) { T('Could not send the test: ' + String((e && e.message) || e).slice(0, 90)); }
    S.busy = false;
  }

  /* ---------- the format ---------- */
  function fmtModal() {
    var ev = curEv(); if (!ev) return;
    var f = ev.format || '';
    var raw = S.evRaw && S.evRaw.id === ev.id ? S.evRaw : {};
    var html = '<div class="w171m"><h3>How the food is made</h3><p class="sub">' + E(fmtDay(ev.event_date, true)) + ' · the confirm page and the itineraries follow this.</p>'
      + '<div class="modes">'
      + '<label class="' + (f === 'home_cooked' ? 'on' : '') + '"><input type="radio" name="w171f" value="home_cooked"' + (f === 'home_cooked' ? ' checked' : '') + '><span><b>Home-cooked</b><small>Cooks cook at home; the pickup driver collects the food on the way (the standard since 2023).</small></span></label>'
      + '<label class="' + (f === 'community_kitchen' ? 'on' : '') + '"><input type="radio" name="w171f" value="community_kitchen"' + (f === 'community_kitchen' ? ' checked' : '') + '><span><b>Community kitchen</b><small>Volunteers cook together at a kitchen in the morning and serve later.</small></span></label></div>'
      + '<div id="w171kit" style="' + (f === 'community_kitchen' ? '' : 'display:none') + '">'
      + '<label class="f">Kitchen (name and address)</label><input type="text" id="w171kp" value="' + E(raw.kitchen_place || '') + '" placeholder="La Poubelle Magnifique, 1221 Rue Crescent">'
      + '<div class="two"><div><label class="f">Cooking shift</label><input type="text" id="w171ks" value="' + E(raw.kitchen_shift || '') + '" placeholder="9:00 to 12:30"></div>'
      + '<div><label class="f">Kitchen contact (a name)</label><input type="text" id="w171kc" value="' + E(raw.kitchen_contact || '') + '" placeholder="Shima"></div></div>'
      + '<label class="f">Ingredients (when and where they arrive, fridge space)</label><input type="text" id="w171ki" value="' + E(raw.ingredients_note || '') + '"></div>'
      + '<div class="foot"><button class="w171btn ghost" data-w171close="1">Cancel</button><button class="w171btn" data-w171fsave="1">Save</button></div></div>';
    openModal(html);
  }
  async function loadRaw(ev) {
    try { var r = await db.from('volunteer_events').select('id,format,kitchen_place,kitchen_shift,kitchen_contact,ingredients_note').eq('id', ev.id).maybeSingle(); S.evRaw = (r && r.data) || null; } catch (e) { S.evRaw = null; }
  }
  async function fmtSave(btn) {
    var ev = curEv(); if (!ev) return;
    var pick = document.querySelector('input[name="w171f"]:checked');
    if (!pick) { T('Choose home-cooked or community kitchen'); return; }
    var v = function (id) { var el = document.getElementById(id); return el ? el.value.trim() || null : null; };
    var row = { format: pick.value };
    if (pick.value === 'community_kitchen') { row.kitchen_place = v('w171kp'); row.kitchen_shift = v('w171ks'); row.kitchen_contact = v('w171kc'); row.ingredients_note = v('w171ki'); }
    btn.disabled = true;
    try {
      var r = await db.from('volunteer_events').update(row).eq('id', ev.id);
      if (r.error) throw r.error;
      ev.format = row.format; if (S.evRaw && S.evRaw.id === ev.id) Object.assign(S.evRaw, row);
      T('Saved: ' + FORMATS[row.format]);
      closeModal(); decorateMast();
    } catch (e) { T('Could not save: ' + String((e && e.message) || e).slice(0, 90)); btn.disabled = false; }
  }

  /* ---------- the page refreshes itself while it is open, so a tap on a phone shows up here ---------- */
  function rosterSig(rows) { return (rows || []).map(function (r) { return r.id + ':' + (r.status || '') + ':' + (r.confirm_status || '') + ':' + (r.confirmed_at || '') + ':' + (r.recipe_id || '') + ':' + JSON.stringify(r.confirm || {}); }).sort().join('|'); }
  async function tick() {
    if (document.hidden || !onEvent() || S.busy) return;
    var ev = curEv(), D = curD(); if (!ev || !D) return;
    try {
      var r = await db.from('event_roster').select('id,status,confirm_status,confirmed_at,confirm,recipe_id,signup_noticed_at').eq('event_id', ev.id);
      var rows = (r && r.data) || [];
      await loadMsgs(ev.id, true); await loadResp(ev.id, true);
      if (rosterSig(rows) !== rosterSig(D.roster)) {
        var by = {}; rows.forEach(function (x) { by[x.id] = x; });
        var changed = false;
        D.roster.forEach(function (x) { var n = by[x.id]; if (n && rosterSig([n]) !== rosterSig([x])) { Object.assign(x, n); changed = true; } });
        if (rows.length !== D.roster.length) { if (typeof waVolLoadEvent === 'function') { await waVolLoadEvent(ev.id); changed = true; } }
        if (changed) {
          ev.roster_confirmed = (curD().roster || []).filter(function (x) { return lower(x.status) === 'confirmed'; }).length;
          if (typeof waVolRenderEvent === 'function') waVolRenderEvent();
          return;
        }
      }
      paintCard();
    } catch (e) { /* offline: try again next time */ }
  }
