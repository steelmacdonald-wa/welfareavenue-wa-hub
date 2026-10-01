  /* =====================================================================
     wave182 (30/09/26): itineraries that look like the Canva ones, sent by email and/or text, with a photo for the season.
     Steel: "could you making them look as good as the ones in Canva. I want an easy function that allows us to send them to
     our volunteers each event via email and/or text - there needs to be flexiblity. Also there should be a photo on them
     depending on the time of the year/season".
     On the event's Survey and itinerary card: an Itineraries block (who has theirs, what is scheduled, the season's photo),
     Send itineraries (pick people, text and/or email, now, the day before or a set time, a note, an update; previews of the
     text, the email and the page; a test email to yourself), Sent and scheduled (every send with what it became; cancel a
     scheduled one) and This serving's itinerary (the WhatsApp group link, the photo, the automatic day-before send and how).
     Text settings, Itineraries: the season's photos (top and foot) and what to always bring.
     The database decides who may send (wa182_send_itineraries: leaders, HR, admins) and what can go (sms_mode for texts,
     mail_mode for email); this segment never switches either.
     ===================================================================== */
  var W8 = { sends: {}, sendsAt: {}, mail: null, ev: {}, pick: null, prev: 'text' };
  var SEASONS = [['winter', 'Winter (Dec to Feb)'], ['spring', 'Spring (Mar to May)'], ['summer', 'Summer (Jun to Aug)'], ['autumn', 'Autumn (Sep to Nov)']];
  var CSS8 = ''
    + '.w182blk{margin:12px 0 4px;padding:12px;border-radius:14px;background:#1F201E;color:' + CREAM + ';position:relative;overflow:hidden}'
    + '.w182blk .bgp{position:absolute;inset:0;background:' + GREEN + ' center/cover no-repeat;opacity:.38}'
    + '.w182blk>*{position:relative}'
    + '.w182blk .ov{font:700 10.5px ' + BODY + ';letter-spacing:1.4px;text-transform:uppercase;color:' + GOLD + ';}'
    + '.w182blk h5{margin:2px 0 6px;font:700 22px ' + HEAD + ';text-transform:uppercase;letter-spacing:.3px;color:' + CREAM + ';}'
    + '.w182blk p{margin:0 0 8px;font-size:12.5px;color:rgba(255,250,242,.86);line-height:1.45}'
    + '.w182blk .w171btn.ghost{color:' + CREAM + ';border-color:rgba(255,250,242,.4)}'
    + '.w182st{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 8px}'
    + '.w182st span{font-size:11px;font-weight:700;border-radius:999px;padding:2px 9px;background:rgba(255,250,242,.14);color:' + CREAM + '}'
    + '.w182st span.ok{background:rgba(42,140,122,.55)}.w182st span.wait{background:' + GOLD + ';color:' + INK + '}'
    + '.w182m .chips{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 8px}'
    + '.w182m .chips button{border:1.5px solid rgba(16,63,57,.2);background:transparent;border-radius:999px;padding:4px 11px;font:600 12px ' + BODY + ';color:' + GREEN + ';cursor:pointer}'
    + '.w182m .grp{font:700 11px ' + BODY + ';letter-spacing:1px;text-transform:uppercase;color:' + MUTED + ';margin:10px 0 0}'
    + '.w182m .row .ch{display:flex;gap:4px;flex:none}'
    + '.w182m .row .ch i{font-style:normal;font-size:10.5px;font-weight:700;border-radius:6px;padding:1px 6px;background:rgba(16,63,57,.08);color:' + MUTED + '}'
    + '.w182m .row .ch i.on{background:rgba(42,140,122,.16);color:#1c6b5d}'
    + '.w182m .seg{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0}'
    + '.w182m .seg label{display:flex;gap:6px;align-items:center;border:1.5px solid rgba(16,63,57,.18);border-radius:999px;padding:6px 12px;font-size:13px;cursor:pointer}'
    + '.w182m .seg label.on{border-color:' + GREEN + ';background:rgba(16,63,57,.06);font-weight:700}'
    + '.w182m .seg input{accent-color:' + GREEN + '}'
    + '.w182m .tabs{display:flex;gap:4px;margin:12px 0 0;border-bottom:1.5px solid rgba(16,63,57,.12)}'
    + '.w182m .tabs button{border:0;background:transparent;padding:7px 12px;font:700 12.5px ' + BODY + ';color:' + MUTED + ';cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-1.5px}'
    + '.w182m .tabs button.on{color:' + GREEN + ';border-bottom-color:' + GOLD + '}'
    + '.w182m iframe{width:100%;height:520px;border:0;border-radius:0 0 12px 12px;background:#151614}'
    + '.w182m .sms{background:#E9E9EB;color:#111;border-radius:18px 18px 18px 4px;padding:10px 13px;font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;white-space:pre-wrap;max-width:330px;margin:12px 0;word-break:break-word}'
    + '.w182m .hist{font-size:12.5px;border-top:1px solid rgba(16,63,57,.1);padding:7px 0;display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:center}'
    + '.w182m .hist small{color:' + MUTED + ';grid-column:1/-1}'
    + '.w182m .pics button.seas{position:relative}'
    + '.w182m .sp{display:grid;grid-template-columns:110px 1fr;gap:6px 10px;align-items:center;margin:6px 0}'
    + '.w182m .sp .thumb{height:62px;border-radius:10px;background:' + GREEN + ' center/cover no-repeat}';
  if (!document.getElementById('wa182css')) { var st8 = document.createElement('style'); st8.id = 'wa182css'; st8.textContent = CSS8; document.head.appendChild(st8); }

  function seasonOf(iso) { var m = Number(String(iso || '').slice(5, 7)); return m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn'; }
  function seasonName(s) { return { winter: 'Winter', spring: 'Spring', summer: 'Summer', autumn: 'Autumn' }[s] || s; }
  function hasItin(role) { var g = (S.guides || []).filter(function (x) { return x.role === lower(role); })[0]; return !!(g && g.itinerary); }
  function photoById(id) { return (S.photos || []).filter(function (p) { return p.id === Number(id); })[0] || null; }
  async function loadMailMode() {
    if (W8.mail && Date.now() - W8.mailAt < 30000) return W8.mail;
    try { var r = await db.from('app_config').select('key,value').in('key', ['mail_mode', 'mail_test_recipients']); var c = {}; ((r && r.data) || []).forEach(function (x) { c[x.key] = x.value; }); W8.mail = c.mail_mode || 'test'; W8.tests = c.mail_test_recipients || ''; } catch (e) { W8.mail = W8.mail || 'test'; }
    W8.mailAt = Date.now(); return W8.mail;
  }
  async function loadSends(evId, force) {
    if (!evId) return [];
    if (!force && W8.sends[evId] && Date.now() - (W8.sendsAt[evId] || 0) < 25000) return W8.sends[evId];
    try { var r = await db.rpc('wa182_itinerary_status', { p_event: evId }); W8.sends[evId] = (r && r.data) || []; } catch (e) { W8.sends[evId] = W8.sends[evId] || []; }
    W8.sendsAt[evId] = Date.now(); return W8.sends[evId];
  }
  async function loadEv8(ev, force) {
    if (!force && W8.ev[ev.id]) return W8.ev[ev.id];
    try { var r = await db.from('volunteer_events').select('id,event_date,whatsapp_url,itinerary_photo_id,itinerary_auto,itinerary_channels').eq('id', ev.id).maybeSingle(); W8.ev[ev.id] = (r && r.data) || { id: ev.id }; } catch (e) { W8.ev[ev.id] = W8.ev[ev.id] || { id: ev.id }; }
    try { var lk = await db.rpc('wa182_look', { p_event: ev.id }); W8.ev[ev.id].look = (lk && lk.data) || null; } catch (e) { /* fine */ }
    return W8.ev[ev.id];
  }
  /* the latest send per person and channel that went (or will go) */
  function lastSend(evId, rid, ch) {
    return (W8.sends[evId] || []).filter(function (s) { return s.roster_id === rid && (!ch || s.channel === ch) && s.status !== 'cancelled'; })[0] || null;
  }
  function sendWord(s) {
    if (!s) return '';
    var ch = s.channel === 'email' ? 'Emailed' : 'Texted';
    if (s.status === 'scheduled') return (s.channel === 'email' ? 'Email' : 'Text') + ' scheduled ' + fmtWhen(s.send_at);
    if (s.status === 'queued') return (s.channel === 'email' ? 'Email' : 'Text') + ' on its way';
    if (s.status === 'sent') return ch + ' ' + fmtWhen(s.created_at) + (s.opened_at ? ' · opened' : '');
    if (s.status === 'skipped') return (s.channel === 'email' ? 'Email' : 'Text') + ' skipped: ' + (s.reason || '');
    if (s.status === 'failed') return (s.channel === 'email' ? 'Email' : 'Text') + ' did not go through';
    return s.status;
  }
  function personCh(r) { var em = !!(r.__email); return { text: !!phoneOf(r), email: em }; }

  /* ---------- the block on the Survey and itinerary card ---------- */
  function blockHtml(ev, D, cn) {
    var x = W8.ev[ev.id] || {}; var look = x.look || {};
    var list = (D.roster || []).filter(function (r) { return !isOff(r) && !isDecl(r) && hasItin(r.role); });
    var sent = list.filter(function (r) { var s = lastSend(ev.id, r.id); return s && (s.status === 'sent' || s.status === 'queued'); }).length;
    var sch = (W8.sends[ev.id] || []).filter(function (s) { return s.status === 'scheduled'; });
    var up = ev.event_date >= todayIso() && ev.status !== 'cancelled';
    var autoTxt = x.itinerary_auto === false ? 'Not sent automatically.' : 'Sent automatically the day before at ' + hm12((S.cfg.sms_itinerary_hour || '17') + ':00') + ' to everyone confirmed who has not had it, by ' + ({ text: 'text', email: 'email', both: 'text and email' }[x.itinerary_channels || 'both']) + '.';
    return '<div class="w182blk" id="w182blk">' + (look.hero && look.hero.path ? '<div class="bgp" style="background-image:url(&quot;' + E(ST + look.hero.path) + '&quot;)"></div>' : '')
      + '<div class="ov">Itineraries · ' + E(seasonName(look.season || seasonOf(ev.event_date))) + ' look</div><h5>' + sent + ' of ' + list.length + ' sent</h5>'
      + '<div class="w182st"><span class="' + (S.mode === 'live' ? 'ok' : 'wait') + '">Texts ' + E({ off: 'off', test: 'in test mode', live: 'on' }[S.mode] || S.mode) + '</span><span class="' + (W8.mail === 'live' ? 'ok' : 'wait') + '">Email ' + E(W8.mail === 'live' ? 'on' : 'in test mode') + '</span>'
      + (sch.length ? '<span>' + sch.length + ' scheduled</span>' : '') + (x.whatsapp_url ? '<span class="ok">WhatsApp group linked</span>' : '<span>No WhatsApp group yet</span>') + '</div>'
      + '<p>' + E(autoTxt) + ' Team leaders, drivers, servers, photographers and the Community lead get one; cooks don’t.</p>'
      + '<div class="w171btns">' + (cn.text && up ? '<button class="w171btn" data-w182send="1">Send itineraries</button>' : '')
      + '<button class="w171btn ghost" data-w182hist="1">Sent and scheduled</button>' + (cn.text || staff() ? '<button class="w171btn ghost" data-w182ev="1">This serving’s itinerary</button>' : '') + '</div></div>';
  }
  /* wave174's card, with the block under the start time; the previews open the itinerary itself */
  var __w174Html = w174Html;
  w174Html = function (ev, D, cn, rows) {
    var h = __w174Html(ev, D, cn, rows).replace(/\?test=1"/g, '?test=1&amp;it=1"');
    var at = h.indexOf('<div class="w171h">Survey</div>');
    var blk = blockHtml(ev, D, cn);
    return at > 0 ? h.slice(0, at) + blk + h.slice(at) : h + blk;
  };
  var __paintW174 = paintW174;
  paintW174 = async function () {
    var ev = curEv(); if (ev && staff()) { await Promise.all([loadSends(ev.id, false), loadEv8(ev, false), loadMailMode(), S.guides ? null : loadGuides()]); }
    var out = await __paintW174.apply(this, arguments);
    try { decorateCards(); } catch (e) { /* fine */ }
    return out;
  };
  /* roster cards: how the itinerary went */
  var __w174Tags = w174Tags;
  w174Tags = function (r, evId, dk) {
    var out = __w174Tags(r, evId, dk);
    if (isOff(r) || isDecl(r) || !hasItin(r.role)) return out;
    ['text', 'email'].forEach(function (ch) { var s = lastSend(evId, r.id, ch); if (s) out += '<span class="w171tag ' + (s.status === 'sent' ? 'ok' : s.status === 'failed' ? 'no' : s.status === 'skipped' ? 'mute' : 'wait') + '">Itinerary: ' + E(sendWord(s)) + '</span>'; });
    return out;
  };

  /* ---------- Send itineraries ---------- */
  async function emailsFor(D) {
    var ids = (D.roster || []).map(function (r) { return r.person_id; }).filter(Boolean);
    var by = {};
    if (ids.length) {
      try {
        var r = await db.from('volunteer_people').select('id,emails,contact_id').in('id', ids);
        var cids = []; ((r && r.data) || []).forEach(function (p) { by[p.id] = (p.emails || [])[0] || ''; if (p.contact_id) cids.push(p.contact_id); });
        if (cids.length) {
          var c = await db.from('crm_contacts').select('id,primary_email').in('id', cids);
          var cm = {}; ((c && c.data) || []).forEach(function (x) { cm[x.id] = x.primary_email; });
          ((r && r.data) || []).forEach(function (p) { if (p.contact_id && cm[p.contact_id]) by[p.id] = cm[p.contact_id]; });
        }
      } catch (e) { /* fine */ }
    }
    (D.roster || []).forEach(function (r) { r.__email = by[r.person_id] || (r.detail || {}).email || ''; });
  }
  function dayBefore(ev) { var d = addDays(ev.event_date, -1); var h = Number(S.cfg.sms_itinerary_hour || 17); return d + 'T' + ('0' + h).slice(-2) + ':00'; }
  function torontoIso(local) {
    /* a date and time typed in Toronto, as an ISO instant (the offset of that day) */
    var d = new Date(local + ':00Z'); if (isNaN(d)) return null;
    try { var f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d);
      var g = {}; f.forEach(function (p) { g[p.type] = p.value; });
      var asTor = Date.UTC(+g.year, +g.month - 1, +g.day, +g.hour % 24, +g.minute); var off = asTor - d.getTime();
      return new Date(d.getTime() - off).toISOString(); } catch (e) { return d.toISOString(); }
  }
  async function sendModal8() {
    var ev = curEv(), D = curD(); if (!ev || !D) return;
    openModal('<div class="w171m w182m"><h3>Send itineraries</h3><p class="sub">Loading…</p></div>');
    var x = await loadEv8(ev, true); await Promise.all([loadSends(ev.id, true), loadMailMode(), loadCfg(true), emailsFor(D), S.guides ? null : loadGuides()]);
    var list = (D.roster || []).filter(function (r) { return !isOff(r) && !isDecl(r) && hasItin(r.role) && r.confirm_token; });
    var dk = driverKinds(D);
    var groups = [['Team leaders and drivers', function (r) { return ['team_leader', 'driver'].indexOf(lower(r.role)) >= 0; }], ['Community lead', function (r) { return lower(r.role) === 'community_debrief'; }], ['Servers, photographers and the rest', function () { return true; }]];
    var seen = {};
    var rowsHtml = groups.map(function (g) {
      var rs = list.filter(function (r) { if (seen[r.id] || !g[1](r)) return false; seen[r.id] = 1; return true; });
      if (!rs.length) return '';
      return '<div class="grp">' + E(g[0]) + '</div>' + rs.map(function (r) {
        var ch = personCh(r), s = lastSend(ev.id, r.id), had = s && (s.status === 'sent' || s.status === 'queued' || s.status === 'scheduled');
        var role = lower(r.role) === 'driver' ? (KIND[dk[r.id]] || 'Driver') : one(lower(r.role));
        return '<label class="row"><input type="checkbox" data-w182pick="' + r.id + '" data-role="' + E(lower(r.role)) + '" data-conf="' + (isConf(r) ? 1 : 0) + '" data-had="' + (had ? 1 : 0) + '"' + (isConf(r) && !had && (ch.text || ch.email) ? ' checked' : '') + '>'
          + '<span class="who">' + E(r.person_name || 'Unnamed') + '<small>' + E(role) + ' · ' + (isConf(r) ? 'confirmed' : 'not confirmed yet') + (s ? ' · ' + E(sendWord(s)) : '') + '</small></span>'
          + '<span class="ch"><i class="' + (ch.text ? 'on' : '') + '" title="' + (ch.text ? 'Has a phone' : 'No phone') + '">Text</i><i class="' + (ch.email ? 'on' : '') + '" title="' + E(r.__email || 'No email') + '">Email</i></span></label>';
      }).join('');
    }).join('');
    var cooks = (D.roster || []).filter(function (r) { return !isOff(r) && !isDecl(r) && lower(r.role) === 'cook'; }).length;
    var chDef = x.itinerary_channels || 'both';
    var dbIso = dayBefore(ev); var dbPast = new Date(torontoIso(dbIso)) < new Date();
    var warn = '';
    if (S.mode !== 'live') warn += '<div class="info">' + (S.mode === 'test' ? 'Texts are in test mode: only the test phone (' + E(S.cfg.sms_test_phones || 'none set') + ') gets a text; the others are skipped.' : 'Texts are off: the text part is skipped. Email can still go.') + '</div>';
    if (W8.mail !== 'live') warn += '<div class="info">Email is in test mode: only the test addresses (' + E(W8.tests || 'none set') + ') get it; the others are skipped. An admin switches email on in the CRM’s Email tab.</div>';
    var html = '<div class="w171m w182m"><h3>Send itineraries</h3><p class="sub">' + E(fmtDay(ev.event_date, true)) + ' · each person gets their own itinerary for their role, with the ' + E(seasonName((x.look || {}).season || seasonOf(ev.event_date)).toLowerCase()) + ' photo. Texts come from the ops line; emails from info@welfareavenue.com.</p>' + warn
      + '<div class="chips"><button type="button" data-w182sel="conf">Everyone confirmed</button><button type="button" data-w182sel="new">Not sent yet</button><button type="button" data-w182sel="lead">Team leaders and drivers</button><button type="button" data-w182sel="serve">Servers and photographers</button><button type="button" data-w182sel="all">Everyone</button><button type="button" data-w182sel="none">No one</button></div>'
      + (rowsHtml || '<p>No one on this serving has an itinerary yet (cooks don’t get one).</p>')
      + (cooks ? '<p class="w171note" style="margin-top:6px">' + cooks + ' cook' + (cooks === 1 ? '' : 's') + ' not listed: cooks don’t get an itinerary (the pickup driver texts them).</p>' : '')
      + '<label class="f">How</label><div class="seg">' + [['both', 'Text and email'], ['text', 'Text only'], ['email', 'Email only']].map(function (o) { return '<label class="' + (chDef === o[0] ? 'on' : '') + '"><input type="radio" name="w182ch" value="' + o[0] + '"' + (chDef === o[0] ? ' checked' : '') + '>' + o[1] + '</label>'; }).join('') + '</div>'
      + '<p class="w171note" style="margin:2px 0 0">Text and email: each person gets whichever we have for them (both when we have both).</p>'
      + '<label class="f">When</label><div class="seg"><label class="on"><input type="radio" name="w182when" value="now" checked>Now</label>'
      + (dbPast ? '' : '<label><input type="radio" name="w182when" value="daybefore">The day before, ' + E(fmtDay(dbIso.slice(0, 10))) + ' at ' + E(hm12(dbIso.slice(11, 16))) + '</label>')
      + '<label><input type="radio" name="w182when" value="at">At a set time</label></div>'
      + '<input type="datetime-local" id="w182at" value="' + E(dbIso) + '" style="display:none;margin-top:6px;width:auto;font:14px ' + BODY + ';border:1.5px solid rgba(16,63,57,.18);border-radius:10px;padding:7px 10px;background:' + CREAM + '">'
      + '<p class="w171note" style="margin:4px 0 0">Texts go between 9 am and 7 pm Montreal time; outside those hours they wait until 9 am.</p>'
      + '<label class="f">A note to everyone (optional, in the text and the email)</label><input type="text" id="w182note" maxlength="300" placeholder="For example: it will be cold, bring a warm coat">'
      + '<label style="display:flex;gap:8px;align-items:center;font-size:13.5px;margin:10px 0 0"><input type="checkbox" id="w182upd"> This is an update (it says their itinerary has changed)</label>'
      + '<div class="tabs"><button type="button" class="on" data-w182tab="text">The text</button><button type="button" data-w182tab="email">The email</button><button type="button" data-w182tab="page">The page</button></div><div id="w182prev"><p class="w171note" style="margin:10px 0">Pick someone to see their text.</p></div>'
      + '<div class="foot"><button class="w171btn ghost" data-w171close="1">Cancel</button><button class="w171btn ghost" data-w182test="1">Send me a test email</button><button class="w171btn" data-w182go="1">Send</button></div></div>';
    var mb = document.getElementById('modalBox'); if (mb && mb.querySelector('.w182m')) mb.innerHTML = html; else openModal(html);
    W8.prev = 'text'; syncUpd(); preview();
  }
  function picked() { return Array.prototype.map.call(document.querySelectorAll('[data-w182pick]:checked'), function (c) { return Number(c.getAttribute('data-w182pick')); }); }
  function syncUpd() { var u = document.getElementById('w182upd'); if (!u || u.__touched) return; u.checked = Array.prototype.some.call(document.querySelectorAll('[data-w182pick]:checked'), function (c) { return c.getAttribute('data-had') === '1'; }); }
  function selectBy(k) {
    document.querySelectorAll('[data-w182pick]').forEach(function (c) {
      var role = c.getAttribute('data-role'), conf = c.getAttribute('data-conf') === '1', had = c.getAttribute('data-had') === '1';
      c.checked = k === 'all' ? true : k === 'none' ? false : k === 'conf' ? conf : k === 'new' ? !had : k === 'lead' ? ['team_leader', 'driver'].indexOf(role) >= 0 : ['team_leader', 'driver', 'community_debrief', 'cook'].indexOf(role) < 0;
    });
    syncUpd(); preview();
  }
  var prevT = null;
  function preview() { clearTimeout(prevT); prevT = setTimeout(previewNow, 250); }
  async function previewNow() {
    var box = document.getElementById('w182prev'); if (!box) return;
    var ids = picked(); var D = curD(); if (!D) return;
    var rid = ids[0] || ((D.roster || []).filter(function (r) { return !isOff(r) && hasItin(r.role) && r.confirm_token; })[0] || {}).id;
    if (!rid) { box.innerHTML = '<p class="w171note" style="margin:10px 0">No one to preview.</p>'; return; }
    var r = (D.roster || []).filter(function (x) { return x.id === rid; })[0] || {};
    var note = (document.getElementById('w182note') || {}).value || '', upd = !!(document.getElementById('w182upd') || {}).checked;
    var who = '<p class="w171note" style="margin:10px 0 0">As ' + E(r.person_name || 'Unnamed') + ' (' + E(one(lower(r.role))) + ') will get it' + (ids.length > 1 ? '; everyone gets their own' : '') + '.</p>';
    if (W8.prev === 'page') { box.innerHTML = who + '<p style="margin:10px 0"><a class="w171btn" style="text-decoration:none;display:inline-block" target="_blank" rel="noopener" href="https://hub.welfareavenue.com/c/' + E(r.confirm_token) + '?test=1&amp;it=1">Open ' + E(first(r.person_name)) + '’s itinerary page (test link)</a></p>'; return; }
    if (W8.prev === 'text') {
      box.innerHTML = who + '<div class="sms">Loading…</div>';
      try { var t = await db.rpc('wa182_preview_text', { p_roster: rid, p_note: note || null, p_update: upd }); if (t.error) throw t.error; var b = box.querySelector('.sms'); if (b) b.textContent = t.data || '(no text: this person has no link yet)'; }
      catch (e) { var b2 = box.querySelector('.sms'); if (b2) b2.textContent = 'Could not load the preview: ' + String((e && e.message) || e).slice(0, 90); }
      return;
    }
    box.innerHTML = who + '<p class="w171note" style="margin:6px 0">Loading the email…</p>';
    try {
      var res = await db.functions.invoke('mail-send', { body: { action: 'itinerary_preview', roster_id: rid, note: note || null, is_update: upd } });
      if (res.error) throw res.error; var d = res.data || {}; if (d.error) throw new Error(d.error);
      box.innerHTML = who + '<p class="w171note" style="margin:6px 0 0"><b>Subject:</b> ' + E(d.subject) + ' · <b>From:</b> ' + E(d.from) + '</p><iframe title="The email" sandbox="allow-popups allow-popups-to-escape-sandbox"></iframe>';
      box.querySelector('iframe').srcdoc = d.html;
    } catch (e) { box.innerHTML = who + '<p class="w171note" style="margin:10px 0">Could not load the email: ' + E(String((e && e.message) || e).slice(0, 120)) + '</p>'; }
  }
  async function sendGo8(btn) {
    var ev = curEv(); if (!ev || S.busy) return;
    var ids = picked(); if (!ids.length) { T('Tick at least one person'); return; }
    var ch = (document.querySelector('input[name="w182ch"]:checked') || {}).value || 'both';
    var wh = (document.querySelector('input[name="w182when"]:checked') || {}).value || 'now';
    var at = null;
    if (wh === 'daybefore') at = torontoIso(dayBefore(ev));
    if (wh === 'at') { var v = (document.getElementById('w182at') || {}).value; if (!v) { T('Pick a date and time'); return; } at = torontoIso(v); if (!at || new Date(at) < new Date(Date.now() - 60000)) { T('That time has passed'); return; } }
    var note = ((document.getElementById('w182note') || {}).value || '').trim();
    var upd = !!(document.getElementById('w182upd') || {}).checked;
    S.busy = true; btn.disabled = true; btn.textContent = at ? 'Scheduling…' : 'Sending…';
    try {
      var r = await db.rpc('wa182_send_itineraries', { p_event: ev.id, p_roster: ids, p_channel: ch, p_send_at: at, p_note: note || null, p_update: upd });
      if (r.error) throw r.error;
      var d = r.data || {}, tk = d.tick || {};
      var bits = [];
      if (at) bits.push((d.texts + d.emails) + ' scheduled for ' + fmtWhen(at));
      else {
        if (tk.texts) bits.push(tk.texts + ' text' + (tk.texts === 1 ? '' : 's'));
        if (tk.emails) bits.push(tk.emails + ' email' + (tk.emails === 1 ? '' : 's'));
        if (bits.length) bits = [bits.join(' and ') + ' on the way'];
        if (tk.skipped) bits.push(tk.skipped + ' skipped (see Sent and scheduled)');
        var wn = tk.waiting_for_window != null ? tk.waiting_for_window : tk.waiting_for_8am; if (wn) bits.push(wn + ' text' + (wn === 1 ? '' : 's') + ' wait for 9 am');
      }
      if (d.no_way_to_reach) bits.push(d.no_way_to_reach + ' with no phone or email');
      T(bits.join(', ') || 'Nothing to send');
      closeModal();
      setTimeout(function () { loadSends(ev.id, true).then(function () { var c = document.getElementById('w174card'); if (c) c.__h = ''; paintW174(); decorateCards(); }); }, 2500);
    } catch (e) { T('Could not send: ' + String((e && e.message) || e).slice(0, 110)); btn.disabled = false; btn.textContent = 'Send'; }
    S.busy = false;
  }
  async function sendTest8(btn) {
    var ids = picked(); var D = curD(); if (!D) return;
    var rid = ids[0] || ((D.roster || []).filter(function (r) { return !isOff(r) && hasItin(r.role) && r.confirm_token; })[0] || {}).id; if (!rid) return;
    var note = (document.getElementById('w182note') || {}).value || '', upd = !!(document.getElementById('w182upd') || {}).checked;
    btn.disabled = true; T('Sending a test email to you…');
    try {
      var res = await db.functions.invoke('mail-send', { body: { action: 'itinerary_test', roster_id: rid, note: note || null, is_update: upd } });
      if (res.error) throw res.error; var d = res.data || {}; if (d.error) throw new Error(d.error);
      T('Test email sent to ' + (d.to || 'you') + ' (as the first person you picked)');
    } catch (e) { T('Could not send the test: ' + String((e && e.message) || e).slice(0, 110)); }
    btn.disabled = false;
  }

  /* ---------- Sent and scheduled ---------- */
  async function histModal() {
    var ev = curEv(), D = curD(); if (!ev || !D) return;
    var cn = await can(); await loadSends(ev.id, true);
    var by = {}; (D.roster || []).forEach(function (r) { by[r.id] = r; });
    var rows = W8.sends[ev.id] || [];
    var html = '<div class="w171m w182m"><h3>Sent and scheduled</h3><p class="sub">' + E(fmtDay(ev.event_date, true)) + ' · every itinerary sent or waiting, newest first.</p>'
      + (rows.length ? rows.map(function (s) {
        var r = by[s.roster_id] || {};
        return '<div class="hist"><span><b>' + E(r.person_name || 'Someone') + '</b> · ' + E(s.channel === 'email' ? 'email' : 'text') + (s.is_update ? ' · update' : '') + (s.auto ? ' · automatic' : '') + '</span>'
          + (s.status === 'scheduled' && cn.text ? '<button class="w171btn ghost" data-w182cancel="' + s.id + '">Cancel</button>' : '<span class="w171tag ' + (s.status === 'sent' ? 'ok' : s.status === 'failed' ? 'no' : s.status === 'skipped' || s.status === 'cancelled' ? 'mute' : 'wait') + '" style="margin:0">' + E(s.status) + '</span>')
          + '<small>' + E(sendWord(s)) + (s.to_addr ? ' · ' + E(s.to_addr) : '') + (s.note ? ' · note: “' + E(s.note) + '”' : '') + ' · by ' + E(s.created_by || '') + '</small></div>';
      }).join('') : '<p>Nothing sent yet.</p>')
      + '<div class="foot"><button class="w171btn ghost" data-w171close="1">Close</button></div></div>';
    openModal(html);
  }
  async function cancelOne(btn) {
    var id = Number(btn.getAttribute('data-w182cancel')); btn.disabled = true;
    try { var r = await db.rpc('wa182_cancel_itineraries', { p_ids: [id] }); if (r.error) throw r.error; T(r.data ? 'Cancelled' : 'It had already gone'); histModal(); }
    catch (e) { T('Could not cancel: ' + String((e && e.message) || e).slice(0, 90)); btn.disabled = false; }
  }

  /* ---------- This serving's itinerary: WhatsApp link, photo, automatic send ---------- */
  async function evModal() {
    var ev = curEv(); if (!ev) return;
    var cn = await can(); var x = await loadEv8(ev, true); await loadPhotos();
    var season = (x.look || {}).season || seasonOf(ev.event_date);
    var pics = (S.photos || []).slice();
    W8.pick = x.itinerary_photo_id || null;
    var ch = x.itinerary_channels || 'both';
    var dis = cn.text || staff() ? '' : ' disabled';
    var html = '<div class="w171m w182m"><h3>This serving’s itinerary</h3><p class="sub">' + E(fmtDay(ev.event_date, true)) + ' · ' + E(seasonName(season)) + '</p>'
      + '<label class="f">WhatsApp group invite link</label><input type="text" id="w182wa" value="' + E(x.whatsapp_url || '') + '" placeholder="https://chat.whatsapp.com/..."' + dis + '>'
      + '<p class="w171note" style="margin:4px 0 0">It shows on every itinerary, and goes in the itinerary text and email.</p>'
      + '<label class="f">Send it automatically the day before at ' + E(hm12((S.cfg.sms_itinerary_hour || '17') + ':00')) + '</label>'
      + '<div class="seg"><label class="' + (x.itinerary_auto === false ? '' : 'on') + '"><input type="radio" name="w182auto" value="1"' + (x.itinerary_auto === false ? '' : ' checked') + dis + '>Yes</label><label class="' + (x.itinerary_auto === false ? 'on' : '') + '"><input type="radio" name="w182auto" value="0"' + (x.itinerary_auto === false ? ' checked' : '') + dis + '>No, we send it ourselves</label></div>'
      + '<div class="seg">' + [['both', 'Text and email'], ['text', 'Text only'], ['email', 'Email only']].map(function (o) { return '<label class="' + (ch === o[0] ? 'on' : '') + '"><input type="radio" name="w182ach" value="' + o[0] + '"' + (ch === o[0] ? ' checked' : '') + dis + '>' + o[1] + '</label>'; }).join('') + '</div>'
      + '<label class="f">The photo at the top</label><p class="w171note" style="margin:0 0 4px">Leave it on “The season’s photo” and it changes with the time of year (Text settings, Itineraries). Or pick one for this serving.</p>'
      + '<div class="pics"><button type="button" data-w182pic="0" class="' + (W8.pick ? '' : 'on') + '" style="background-image:url(&quot;' + E(ST + (((x.look || {}).hero || {}).path || '')) + '&quot;)" title="The season’s photo"></button>'
      + pics.map(function (p) { return '<button type="button" title="' + E(p.title) + '" data-w182pic="' + p.id + '" class="' + (p.id === W8.pick ? 'on' : '') + '" style="background-image:url(&quot;' + E(ST + (p.path_thumb || p.path_web)) + '&quot;)"></button>'; }).join('') + '</div>'
      + '<div class="foot"><button class="w171btn ghost" data-w171close="1">Cancel</button>' + (dis ? '' : '<button class="w171btn" data-w182evsave="1">Save</button>') + '</div></div>';
    openModal(html);
  }
  async function evSave(btn) {
    var ev = curEv(); if (!ev) return;
    var wa = ((document.getElementById('w182wa') || {}).value || '').trim();
    if (wa && !/^https:\/\/(chat\.whatsapp\.com|wa\.me|whatsapp\.com)\//i.test(wa)) { T('The WhatsApp link starts with https://chat.whatsapp.com/'); return; }
    var row = { whatsapp_url: wa || null, itinerary_auto: ((document.querySelector('input[name="w182auto"]:checked') || {}).value || '1') === '1',
      itinerary_channels: (document.querySelector('input[name="w182ach"]:checked') || {}).value || 'both', itinerary_photo_id: W8.pick || null };
    btn.disabled = true;
    try {
      var r = await db.from('volunteer_events').update(row).eq('id', ev.id); if (r.error) throw r.error;
      await loadEv8(ev, true); T('Saved this serving’s itinerary'); closeModal();
      var c = document.getElementById('w174card'); if (c) c.__h = ''; paintW174();
    } catch (e) { T('Could not save: ' + String((e && e.message) || e).slice(0, 90)); btn.disabled = false; }
  }

  /* ---------- Text settings, Itineraries: the season's photos and what to always bring ---------- */
  var __itinSetHtml = itinSetHtml;
  itinSetHtml = function (cn) {
    var o = W4.itin || {};
    var thumb = function (id) { var p = photoById(id); return p ? 'background-image:url(&quot;' + E(ST + (p.path_thumb || p.path_web)) + '&quot;)' : ''; };
    var h = '<div class="w171h" style="margin-top:18px">The itinerary’s look</div><p class="w171note">The photo at the top and the band at the foot change with the season of the serving (each serving can also have its own). Pick from the Photo library’s ready photos.</p>'
      + SEASONS.map(function (s) {
        return '<div class="sp"><span><b style="font-size:13px">' + E(s[1]) + '</b></span><span style="display:grid;grid-template-columns:1fr 1fr;gap:6px">'
          + ['photo', 'band'].map(function (k) { var key = k + '_' + s[0]; return '<button type="button" class="thumb" data-w182seas="' + key + '" title="' + (k === 'photo' ? 'The top photo' : 'The band at the foot') + '" style="border:0;cursor:pointer;' + thumb(o[key]) + '"></button><input type="hidden" data-w174it="' + key + '" value="' + E(o[key] || '') + '">'; }).join('')
          + '</span></div>';
      }).join('')
      + '<div id="w182seasp"></div>'
      + '<div class="two"><div><label class="f">Always bring (team leaders and drivers, English, one per line)</label><textarea data-w174it="carry_en">' + E(o.carry_en || '') + '</textarea></div><div><label class="f">Always bring (French)</label><textarea data-w174it="carry_fr">' + E(o.carry_fr || '') + '</textarea></div></div>';
    var base = __itinSetHtml(cn);
    var at = base.lastIndexOf('<div class="foot"');
    return at > 0 ? base.slice(0, at) + h + base.slice(at) : base + h;
  };
  function seasPick(btn) {
    var key = btn.getAttribute('data-w182seas'); var box = document.getElementById('w182seasp'); if (!box) return;
    var season = key.split('_')[1];
    var pics = (S.photos || []).slice().sort(function (a, b) { return (b.season === season) - (a.season === season); });
    box.innerHTML = '<label class="f">' + E(seasonName(season)) + ': ' + (key.indexOf('photo') === 0 ? 'the top photo' : 'the band at the foot') + ' (this season’s first)</label><div class="pics">' + pics.map(function (p) { return '<button type="button" title="' + E(p.title) + '" data-w182seasset="' + key + ':' + p.id + '" style="background-image:url(&quot;' + E(ST + (p.path_thumb || p.path_web)) + '&quot;)"></button>'; }).join('') + '</div><p class="w171note">Then Save the itineraries.</p>';
  }
  function seasSet(btn) {
    var v = btn.getAttribute('data-w182seasset').split(':'); var key = v[0], id = Number(v[1]);
    var inp = document.querySelector('input[data-w174it="' + key + '"]'); if (inp) inp.value = String(id);
    var th = document.querySelector('[data-w182seas="' + key + '"]'); var p = photoById(id); if (th && p) th.style.backgroundImage = 'url("' + ST + (p.path_thumb || p.path_web) + '")';
    var box = document.getElementById('w182seasp'); if (box) box.innerHTML = '';
  }
  /* the Photo library's season, for the season pickers */
  var __loadPhotos = loadPhotos;
  loadPhotos = async function () {
    if (S.photos && S.photos.__w182) return S.photos;
    try { var r = await db.from('wa_photos').select('id,title,path_thumb,path_web,orientation,scene,season').eq('status', 'ready').eq('usage', 'ready').not('path_web', 'is', null).order('id', { ascending: true }).limit(400); S.photos = (r && r.data) || []; S.photos.__w182 = true; return S.photos; }
    catch (e) { return __loadPhotos(); }
  };

  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return; var b;
    if ((b = t.closest('[data-w182send]'))) { e.preventDefault(); sendModal8(); return; }
    if ((b = t.closest('[data-w182go]'))) { e.preventDefault(); sendGo8(b); return; }
    if ((b = t.closest('[data-w182test]'))) { e.preventDefault(); sendTest8(b); return; }
    if ((b = t.closest('[data-w182sel]'))) { e.preventDefault(); selectBy(b.getAttribute('data-w182sel')); return; }
    if ((b = t.closest('[data-w182tab]'))) { e.preventDefault(); W8.prev = b.getAttribute('data-w182tab'); document.querySelectorAll('[data-w182tab]').forEach(function (x) { x.classList.toggle('on', x === b); }); previewNow(); return; }
    if ((b = t.closest('[data-w182hist]'))) { e.preventDefault(); histModal(); return; }
    if ((b = t.closest('[data-w182cancel]'))) { e.preventDefault(); cancelOne(b); return; }
    if ((b = t.closest('[data-w182ev]'))) { e.preventDefault(); evModal(); return; }
    if ((b = t.closest('[data-w182evsave]'))) { e.preventDefault(); evSave(b); return; }
    if ((b = t.closest('[data-w182pic]'))) { e.preventDefault(); W8.pick = Number(b.getAttribute('data-w182pic')) || null; document.querySelectorAll('[data-w182pic]').forEach(function (x) { x.classList.toggle('on', x === b); }); return; }
    if ((b = t.closest('[data-w182seas]'))) { e.preventDefault(); seasPick(b); return; }
    if ((b = t.closest('[data-w182seasset]'))) { e.preventDefault(); seasSet(b); return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t) return;
    if (t.hasAttribute && t.hasAttribute('data-w182pick')) { syncUpd(); preview(); return; }
    if (t.name === 'w182ch' || t.name === 'w182when' || t.name === 'w182auto' || t.name === 'w182ach') {
      document.querySelectorAll('input[name="' + t.name + '"]').forEach(function (x) { x.closest('label').classList.toggle('on', x.checked); });
      if (t.name === 'w182when') { var a = document.getElementById('w182at'); if (a) a.style.display = t.value === 'at' ? '' : 'none'; }
      return;
    }
    if (t.id === 'w182upd') { t.__touched = true; preview(); return; }
  });
  document.addEventListener('input', function (e) { if (e.target && e.target.id === 'w182note') preview(); });
