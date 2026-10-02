  /* =====================================================================
     wave174 (30/09/26): surveys for every role, the serving's time, and the itineraries by role.
     On the event page: a "Survey and itinerary" card under the Texts card (the start time, each role's arrival, the
     driver parts, previews of each itinerary and survey as a test link, who answered the survey, what they said:
     overall, the needs people told us about, what slowed the serving, the meal, and every answer in full); each roster
     card says "Survey answered" and, for a driver, main or pickup (leaders click it to switch). Text settings gains the
     itinerary settings (the meeting spot, the storage unit and its access, the dishwashing, the notes, the pickup lead
     time, the hour of the day-before text) and the survey questions per role (switch one off).
     ===================================================================== */
  var W4 = { resp: {}, respAt: {}, qs: null, itin: null, times: {} };
  var KIND = { main: 'Main driver', pickup: 'Pickup driver', both: 'Only driver' };
  var RUN_ADDR = [['storage_address', 'Storage unit address (for the map)'], ['serving_address', 'Serving address (for the map)'], ['dish_address', 'Dishwashing address after the serving (for the map; empty for none)']];
  var RUN_MIN = [['run_cook_min', 'Minutes at each cook', '7'], ['run_storage_min', 'Minutes loading at the storage unit', '15'], ['run_setup_min', 'At the serving this many minutes before it starts', '30'],
    ['run_serve_min', 'The serving lasts (minutes)', '105'], ['run_dish_min', 'Minutes for the dishes', '45'], ['run_close_min', 'Minutes putting away at the storage unit', '20'], ['run_drive_factor', 'Traffic factor on driving times', '1.25']];
  var ITIN_KEYS = [['meet_spot', 'Meeting spot at the serving'], ['storage_place', 'Storage unit (address and how to find it)'], ['storage_access', 'Storage access (door and locker codes; team leaders and drivers only)'],
    ['dish_place', 'Dishwashing after the serving'], ['pickup_lead_min', 'Pickup driver starts this many minutes before the serving (only until the run is worked out)'], ['audit_url', 'Audit and restock form (team leaders)']];
  var CSS4 = ''
    + '.w174card .t{display:flex;align-items:center;gap:8px;margin:4px 0 8px;flex-wrap:wrap;font-size:13px;}'
    + '.w174card .t input{width:92px;font:14px ' + BODY + ';border:1.5px solid rgba(16,63,57,.18);border-radius:10px;padding:5px 8px;background:' + CREAM + ';}'
    + '.w174roles{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:12.5px;margin:4px 0 8px;}'
    + '.w174roles b{font-family:' + HEAD + ';font-size:15px;color:' + GREEN + ';}'
    + '.w174bars{margin:4px 0 8px;}'
    + '.w174bars div{display:grid;grid-template-columns:1fr 34px;gap:6px;align-items:center;font-size:12px;margin:3px 0;}'
    + '.w174bars i{display:block;height:7px;border-radius:7px;background:rgba(16,63,57,.08);overflow:hidden;grid-column:1/-1;margin-top:-2px;}'
    + '.w174bars i s{display:block;height:100%;background:' + GOLD + ';text-decoration:none;}'
    + '.w174bars span:last-child{text-align:right;font-weight:700;}'
    + '.w174ans{border-top:1px solid rgba(16,63,57,.1);padding:10px 0;font-size:13px;}'
    + '.w174ans .h{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;margin:0 0 4px;}'
    + '.w174ans dl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:3px 12px;margin:0;}'
    + '.w174ans dt{color:' + MUTED + ';}.w174ans dd{margin:0;font-weight:600;white-space:pre-wrap;word-break:break-word;}'
    + '@media (max-width:620px){.w174ans dl{grid-template-columns:1fr;}.w174ans dd{margin-bottom:4px;}}'
    + '.w171tag[data-w174drv]{cursor:pointer;}'
    + '.w174q{display:flex;gap:8px;align-items:flex-start;padding:5px 0;border-top:1px solid rgba(16,63,57,.08);font-size:13px;}'
    + '.w174q small{display:block;color:' + MUTED + ';font-size:11.5px;}'
    + '.w174rmin{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px 12px;margin:8px 0 4px;}.w174rmin label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:' + MUTED + ';}.w174rmin input{max-width:120px;}';
  if (!document.getElementById('wa174css')) { var st4 = document.createElement('style'); st4.id = 'wa174css'; st4.textContent = CSS4; document.head.appendChild(st4); }

  function hm12(s) { var m = String(s || '').match(/^(\d{1,2}):(\d{2})/); if (!m) return String(s || ''); var h = Number(m[1]); return (h % 12 || 12) + ':' + m[2] + (h < 12 ? ' am' : ' pm'); }
  function addMin(s, n) { var m = String(s || '12:00').match(/^(\d{1,2}):(\d{2})/); var x = (Number(m[1]) * 60 + Number(m[2]) + n + 1440) % 1440; return ('0' + Math.floor(x / 60)).slice(-2) + ':' + ('0' + (x % 60)).slice(-2); }
  async function loadResp(evId, force) {
    if (!evId) return [];
    if (!force && W4.resp[evId] && Date.now() - (W4.respAt[evId] || 0) < 25000) return W4.resp[evId];
    try { var r = await db.from('volunteer_survey_responses').select('id,roster_id,role,lang,answers,submitted_at,updated_at').eq('event_id', evId); W4.resp[evId] = (r && r.data) || []; } catch (e) { W4.resp[evId] = W4.resp[evId] || []; }
    W4.respAt[evId] = Date.now();
    return W4.resp[evId];
  }
  async function loadQs(force) {
    if (W4.qs && !force) return W4.qs;
    try { var r = await db.from('volunteer_survey_questions').select('*').order('sort').order('id'); W4.qs = (r && r.data) || []; } catch (e) { W4.qs = W4.qs || []; }
    return W4.qs;
  }
  async function loadStart(ev) {
    try { var r = await db.from('volunteer_events').select('id,start_time').eq('id', ev.id).maybeSingle(); if (r && r.data) ev.start_time = String(r.data.start_time || '12:00').slice(0, 5); } catch (e) { /* fine */ }
    return ev.start_time || '12:00';
  }
  /* a driver's part, as the database decides it (wa174_driver_kind): set by hand, or the first driver main and the next pickup */
  function driverKinds(D) {
    var drv = (D.roster || []).filter(function (r) { return lower(r.role) === 'driver' && !isOff(r) && !isDecl(r); });
    var rank = function (r) { var k = (r.detail || {}).driver_role; return k === 'main' || k === 'both' ? 0 : k === 'pickup' ? 1 : 2; };
    drv.sort(function (a, b) { return rank(a) - rank(b) || (a.sort == null ? 1e9 : a.sort) - (b.sort == null ? 1e9 : b.sort) || a.id - b.id; });
    var out = {};
    drv.forEach(function (r, i) { var k = (r.detail || {}).driver_role; out[r.id] = ['main', 'pickup', 'both'].indexOf(k) >= 0 ? k : drv.length === 1 ? 'both' : i === 0 ? 'main' : 'pickup'; });
    return out;
  }
  function qOf(role, key) { return (W4.qs || []).filter(function (q) { return q.qkey === key && (q.role === role || q.role === '*'); }).sort(function (a, b) { return (a.role === '*') - (b.role === '*'); })[0]; }
  function optLabel(q, v) {
    if (v && typeof v === 'object') return 'Other: ' + v.other;
    var o = ((q && q.options) || []).filter(function (x) { return x.v === v; })[0]; return o ? o.en : String(v);
  }
  function ansText(q, v) {
    if (Array.isArray(v)) return v.map(function (x) { return optLabel(q, x); }).join(', ');
    if (q && q.kind === 'choice') return optLabel(q, v);
    if (q && q.kind === 'scale') return v + ' of ' + (q.max_v == null ? 5 : q.max_v);
    return String(v);
  }
  function tally(rows, key, qRole) {
    var c = {}, n = 0;
    rows.forEach(function (x) { var v = (x.answers || {})[key]; if (v == null) return; n++; (Array.isArray(v) ? v : [v]).forEach(function (y) { var k = y && typeof y === 'object' ? 'Other: ' + y.other : optLabel(qOf(qRole || x.role, key), y); c[k] = (c[k] || 0) + 1; }); });
    return { n: n, list: Object.keys(c).map(function (k) { return [k, c[k]]; }).sort(function (a, b) { return b[1] - a[1]; }) };
  }
  function barsHtml(title, tl, max) {
    if (!tl.n) return '';
    return '<div class="w171h">' + E(title) + ' <span style="font-weight:600;text-transform:none;letter-spacing:0">(' + tl.n + ' answered)</span></div><div class="w174bars">' + tl.list.slice(0, max || 6).map(function (p) {
      return '<div><span>' + E(p[0]) + '</span><span>' + p[1] + '</span><i><s style="width:' + Math.round(100 * p[1] / tl.n) + '%"></s></i></div>';
    }).join('') + '</div>';
  }
  function avg(rows, key) { var v = rows.map(function (x) { return (x.answers || {})[key]; }).filter(function (x) { return typeof x === 'number'; }); return v.length ? Math.round(10 * v.reduce(function (a, b) { return a + b; }, 0) / v.length) / 10 : null; }
  function w174Html(ev, D, cn, rows) {
    var st = ev.start_time || '12:00';
    var up = ev.event_date >= todayIso() && ev.status !== 'cancelled';
    var dk = driverKinds(D);
    var guides = S.guides || [];
    var g = function (r) { return guides.filter(function (x) { return x.role === r; })[0] || {}; };
    var lead = Number((W4.itin || {}).pickup_lead_min || 75);
    var roleRow = function (label, from, to) { return '<b>' + E(hm12(from)) + '</b><span>' + E(label) + (to ? ' (to ' + E(hm12(to)) + ')' : '') + '</span>'; };
    /* wave191m: with a worked-out run (the run card), the drivers' and the team leader's starts come from it */
    var run = (window.WA191RUN && typeof WA191RUN.get === 'function') ? WA191RUN.get(ev.id) : null;
    var runAt = function (r) { var f = (r.stops || [])[0] || {}; return r.at === 'storage' ? 'at the storage unit' : r.at === 'serving' ? 'at the serving' : f.k === 'kitchen' ? 'at the kitchen' : 'at the first pickup'; };
    var times = run && (run.runs || []).length ? (run.runs || []).map(function (r) {
      var who = (r.names || []).filter(Boolean).join(', ');
      return roleRow((r.kind === 'none' ? 'The driver (none yet)' : (KIND[r.kind] || 'Driver') + (who ? ' ' + who : '')) + (r.with_tl ? ' and the team leader' : '') + ' ' + runAt(r), r.start, r.end);
    }).join('')
      : roleRow('Team leader and main driver at the storage unit', addMin(st, g('team_leader').arrive_offset_min == null ? -60 : g('team_leader').arrive_offset_min))
      + roleRow('Pickup driver starts the pickups', addMin(st, -lead));
    times = times
      + roleRow('Community lead (clothing count)', addMin(st, g('community_debrief').arrive_offset_min == null ? -15 : g('community_debrief').arrive_offset_min))
      + roleRow('Serving: servers, photographers', st, addMin(st, g('server').duration_min || 120));
    var list = (D.roster || []).filter(function (r) { return !isOff(r) && !isDecl(r); });
    var conf = list.filter(isConf);
    var byId = {}; (D.roster || []).forEach(function (r) { byId[r.id] = r; });
    var answered = rows.filter(function (x) { return byId[x.roster_id]; });
    /* previews: the first person on the list per itinerary kind, as a test link (saves nothing) */
    var pv = [];
    var seen = {};
    list.forEach(function (r) {
      var role = lower(r.role); if (!r.confirm_token) return;
      var kind = role === 'driver' ? 'driver ' + (dk[r.id] || '') : role;
      if (seen[kind]) return; seen[kind] = 1;
      pv.push('<a class="w171btn ghost" style="text-decoration:none" target="_blank" rel="noopener" href="https://hub.welfareavenue.com/c/' + E(r.confirm_token) + '?test=1">' + E(role === 'driver' ? (KIND[dk[r.id]] || 'Driver') : one(role)) + '</a>');
    });
    var srv = answered.filter(function (x) { return ['server', 'team_leader', 'community_debrief', 'community_talker'].indexOf(x.role) >= 0; });
    var mealAvg = avg(answered, 'meal_rating');
    var h = '<h4>Survey and itinerary</h4>'
      + '<div class="t">Serving starts at ' + (cn.text || staff() ? '<input type="time" id="w174st" value="' + E(st) + '"' + (up ? '' : ' disabled') + '> <button class="w171btn ghost" data-w174st="1"' + (up ? '' : ' disabled') + '>Save</button>' : '<b>' + E(hm12(st)) + '</b>') + '</div>'
      + '<div class="w174roles">' + times + '</div>'
      + '<p class="w171note">Confirmed volunteers see their itinerary on their page from the day before (team leaders and drivers, servers and photographers, the Community lead; cooks have none), and get a text with it at ' + E(hm12(((S.cfg.sms_itinerary_hour || '17') + ':00'))) + ' when texts are on. After the serving, everyone confirmed gets their own survey. Previews (test links, nothing is saved):</p>'
      + (pv.length ? '<div class="w171btns">' + pv.join('') + '</div>' : '<p class="w171note">No one on the list yet.</p>')
      + '<div class="w171h">Survey</div>'
      + '<div class="w171nums" style="grid-template-columns:repeat(3,1fr)"><div><b>' + answered.length + '</b><span>answered of ' + conf.length + ' confirmed</span></div>'
      + '<div><b>' + (mealAvg == null ? '–' : mealAvg) + '</b><span>meal rating (0 to 5)</span></div>'
      + '<div><b>' + (avg(answered, 'meals') == null ? '–' : avg(answered, 'meals')) + '</b><span>meals served (team leader)</span></div></div>'
      + barsHtml('Overall', tally(answered, 'overall', '*'))
      + barsHtml('Needs people told us about', tally(srv, 'needs'), 9)
      + barsHtml('What slowed the serving', tally(answered.filter(function (x) { return (x.answers || {}).barriers; }), 'barriers'))
      + barsHtml('The meal, as servers saw it', tally(answered, 'meal_reaction', 'server'))
      + (answered.length ? '<div class="w171btns"><button class="w171btn ghost" data-w174read="1">Read every answer</button></div>' : '<p class="w171note" style="margin:0">' + (ev.event_date > todayIso() ? 'The survey opens an hour after the serving starts.' : 'No answers yet.') + '</p>');
    return h;
  }
  async function paintW174() {
    var ev = curEv(), D = curD(); var rail = document.getElementById('w119rail');
    if (!ev || !D || !rail || !staff()) return;
    var cn = await can();
    await Promise.all([loadResp(ev.id, false), loadQs(false), S.guides ? null : loadGuides(), W4.itin ? null : loadItin(), ev.start_time ? null : loadStart(ev)]);
    if (curEv() !== ev) return;
    rail = document.getElementById('w119rail'); if (!rail) return;
    var box = document.getElementById('w174card');
    if (!box) { box = document.createElement('div'); box.id = 'w174card'; box.className = 'cardy w174card'; var after = document.getElementById('w171card'); if (after && after.parentNode === rail) after.insertAdjacentElement('afterend', box); else rail.insertBefore(box, rail.firstChild); }
    var html = w174Html(ev, D, cn, W4.resp[ev.id] || []);
    /* wave191: two cards: the itinerary (Prepare) and the survey (Wrap up), so the serving page can place each in its stage */
    var mark = '<div class="w171h">Survey</div>'; var at = html.indexOf(mark);
    var h1 = at > 0 ? html.slice(0, at).replace('<h4>Survey and itinerary</h4>', '<h4>Itinerary</h4>') : html;
    var h2 = at > 0 ? '<h4>Survey</h4>' + html.slice(at + mark.length) : '';
    if (box.__h !== h1 && !(document.activeElement && document.activeElement.id === 'w174st')) { box.innerHTML = h1; box.__h = h1; }
    var box2 = document.getElementById('w174survey');
    if (!box2) { box2 = document.createElement('div'); box2.id = 'w174survey'; box2.className = 'cardy w174card w174survey'; box.insertAdjacentElement('afterend', box2); }
    if (box2.__h !== h2) { box2.innerHTML = h2; box2.__h = h2; box2.style.display = h2 ? '' : 'none'; }
  }
  /* the roster cards: survey answered, a driver's part */
  function w174Tags(r, evId, dk) {
    if (isOff(r) || isDecl(r)) return '';
    var out = '';
    if (lower(r.role) === 'driver' && dk[r.id]) out += '<span class="w171tag mute" data-w174drv="' + r.id + '" title="' + (staff() ? 'Click to switch main or pickup' : '') + '">' + E(KIND[dk[r.id]]) + '</span>';
    var a = (W4.resp[evId] || []).filter(function (x) { return x.roster_id === r.id; })[0];
    if (a) out += '<span class="w171tag ok">Survey answered · ' + E(fmtWhen(a.updated_at || a.submitted_at)) + '</span>';
    return out;
  }
  async function saveStart(btn) {
    var ev = curEv(); var el = document.getElementById('w174st'); if (!ev || !el) return;
    var v = String(el.value || '').slice(0, 5);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) { T('The time looks like 12:00'); return; }
    btn.disabled = true;
    try { var r = await db.from('volunteer_events').update({ start_time: v }).eq('id', ev.id); if (r.error) throw r.error; ev.start_time = v; T('The serving starts at ' + hm12(v)); document.getElementById('w174card').__h = ''; paintW174(); }
    catch (e) { T('Could not save: ' + String((e && e.message) || e).slice(0, 90)); btn.disabled = false; }
  }
  async function switchDriver(rid) {
    var D = curD(); if (!D) return;
    var r = (D.roster || []).filter(function (x) { return x.id === rid; })[0]; if (!r) return;
    var dk = driverKinds(D); var next = dk[rid] === 'main' ? 'pickup' : dk[rid] === 'pickup' ? 'both' : 'main';
    var detail = Object.assign({}, r.detail || {}, { driver_role: next });
    try { var res = await db.from('event_roster').update({ detail: detail }).eq('id', rid); if (res.error) throw res.error; r.detail = detail; T(first(r.person_name) + ': ' + KIND[next].toLowerCase()); decorateCards(); document.getElementById('w174card').__h = ''; paintW174(); }
    catch (e) { T('Could not switch: ' + String((e && e.message) || e).slice(0, 90)); }
  }
  function readModal() {
    var ev = curEv(), D = curD(); if (!ev || !D) return;
    var byId = {}; (D.roster || []).forEach(function (r) { byId[r.id] = r; });
    var rows = (W4.resp[ev.id] || []).filter(function (x) { return byId[x.roster_id]; });
    var html = '<div class="w171m"><h3>Survey answers</h3><p class="sub">' + E(fmtDay(ev.event_date, true)) + ' · ' + rows.length + ' answered. Staff only.</p>';
    rows.forEach(function (x) {
      var r = byId[x.roster_id]; var a = x.answers || {};
      var qs = (W4.qs || []).filter(function (q) { return (q.role === '*' || q.role === x.role) && a[q.qkey] != null; }).sort(function (p, q) { return p.sort - q.sort; });
      html += '<div class="w174ans"><div class="h"><b>' + E(r.person_name || 'Unnamed') + '</b><span class="w171tag mute" style="display:inline-block;margin:0">' + E(one(x.role)) + '</span><span style="color:' + MUTED + ';font-size:11.5px">' + E(fmtWhen(x.updated_at || x.submitted_at)) + (x.lang === 'fr' ? ' · in French' : '') + '</span></div><dl>'
        + qs.map(function (q) { return '<dt>' + E(q.label_en) + '</dt><dd>' + E(ansText(q, a[q.qkey])) + '</dd>'; }).join('') + '</dl></div>';
    });
    html += '<div class="foot"><button class="w171btn ghost" data-w171close="1">Close</button></div></div>';
    openModal(html);
  }
  /* ---------- Text settings: the itineraries and the survey questions ---------- */
  async function loadItin() {
    try { var r = await db.from('volunteer_itinerary_settings').select('key,value'); var o = {}; ((r && r.data) || []).forEach(function (x) { o[x.key] = x.value; }); W4.itin = o; } catch (e) { W4.itin = W4.itin || {}; }
    return W4.itin;
  }
  function itinSetHtml(cn) {
    var o = W4.itin || {};
    return '<div class="w171h" style="margin-top:18px">Itineraries</div>'
      + '<p class="w171note">What volunteers see on their page from the day before. The storage access shows only to team leaders and drivers.</p>'
      + ITIN_KEYS.map(function (k) { return '<label class="f">' + E(k[1]) + '</label><input type="text" data-w174it="' + k[0] + '" value="' + E(o[k[0]] || '') + '">'; }).join('')
      /* wave191m: what the drivers' run is worked out from (the serving-run function; the cron works every serving of the next 14 days out again when these change) */
      + '<div class="w171h" style="margin-top:14px">The drivers’ run</div><p class="w171note">The Hub works out each driver’s stops and times from these, with OpenStreetMap driving times. Addresses as Google Maps would find them; no door codes here.</p>'
      + RUN_ADDR.map(function (k) { return '<label class="f">' + E(k[1]) + '</label><input type="text" data-w174it="' + k[0] + '" value="' + E(o[k[0]] || '') + '">'; }).join('')
      + '<div class="w174rmin">' + RUN_MIN.map(function (k) { return '<label><span>' + E(k[1]) + '</span><input type="number" min="0" max="' + (k[0] === 'run_drive_factor' ? 3 : 240) + '" step="' + (k[0] === 'run_drive_factor' ? '0.05' : '1') + '" data-w174it="' + k[0] + '" value="' + E(o[k[0]] || '') + '" placeholder="' + E(k[2]) + '"></label>'; }).join('') + '</div>'
      + '<div class="two"><div><label class="f">Important notes (English, one per line)</label><textarea data-w174it="notes_en">' + E(o.notes_en || '') + '</textarea></div><div><label class="f">Important notes (French)</label><textarea data-w174it="notes_fr">' + E(o.notes_fr || '') + '</textarea></div></div>'
      + '<label class="f">The itinerary text goes the day before at (hour, 24 h, Toronto)</label><input type="text" id="w174ih" value="' + E(S.cfg.sms_itinerary_hour || '17') + '"' + (cn.admin ? '' : ' disabled') + ' style="max-width:120px">'
      + '<div class="foot" style="justify-content:flex-start"><button class="w171btn ghost" data-w174itsave="1">Save the itineraries</button></div>';
  }
  async function itinSave(btn) {
    var rows = Array.prototype.map.call(document.querySelectorAll('[data-w174it]'), function (el) { return { key: el.getAttribute('data-w174it'), value: el.value.trim() || null }; });
    var lead = rows.filter(function (x) { return x.key === 'pickup_lead_min'; })[0];
    if (lead && lead.value && !(Number(lead.value) >= 0 && Number(lead.value) <= 240)) { T('The pickup lead time is minutes, 0 to 240'); return; }
    var badMin = rows.filter(function (x) { return /^run_/.test(x.key) && x.key !== 'run_drive_factor' && x.value != null && !(/^\d+$/.test(x.value) && Number(x.value) <= 240); })[0];
    if (badMin) { T('The run’s minutes are whole numbers, 0 to 240'); return; }
    var fac = rows.filter(function (x) { return x.key === 'run_drive_factor'; })[0];
    if (fac && fac.value != null && !(Number(fac.value) >= 0.8 && Number(fac.value) <= 3)) { T('The traffic factor is between 0.8 and 3 (1.25 adds a quarter)'); return; }
    var au = rows.filter(function (x) { return x.key === 'audit_url'; })[0];
    if (au && au.value && !/^https:\/\//.test(au.value)) { T('The audit form link must start with https://'); return; }
    btn.disabled = true;
    try {
      var who = await myEmail(), now = new Date().toISOString();
      var r = await db.from('volunteer_itinerary_settings').upsert(rows.map(function (x) { return Object.assign(x, { updated_at: now, updated_by: who }); }));
      if (r.error) throw r.error;
      rows.forEach(function (x) { W4.itin[x.key] = x.value; });
      var hEl = document.getElementById('w174ih');
      if (hEl && !hEl.disabled && hEl.value.trim() !== String(S.cfg.sms_itinerary_hour || '17')) {
        var h = String(parseInt(hEl.value, 10));
        if (!(Number(h) >= 8 && Number(h) <= 19)) throw new Error('the hour is between 8 and 19');
        var r2 = await db.from('app_config').update({ value: h, updated_at: now }).eq('key', 'sms_itinerary_hour'); if (r2.error) throw r2.error; S.cfg.sms_itinerary_hour = h;
      }
      T('Itineraries saved');
    } catch (e) { T('Could not save: ' + String((e && e.message) || e).slice(0, 90)); }
    btn.disabled = false;
  }
  function questionsHtml() {
    var qs = (W4.qs || []).filter(function (q) { return q.role === '*' || q.role === S.set.role; });
    return '<div class="w171h" style="margin-top:18px">This role’s survey after the serving</div>'
      + '<p class="w171note">Everyone answers the common questions (how it went, feeling ready, communication, coming back) plus their role’s own. Untick a question to stop asking it.</p>'
      + qs.map(function (q) {
        return '<label class="w174q"><input type="checkbox" data-w174q="' + q.id + '"' + (q.active ? ' checked' : '') + '><span>' + E(q.label_en) + (q.required ? ' *' : '') + '<small>' + E(q.role === '*' ? 'Every role' : one(q.role)) + ' · ' + E({ choice: 'one answer', multi: 'several answers', scale: (q.min_v == null ? 0 : q.min_v) + ' to ' + (q.max_v == null ? 5 : q.max_v), number: 'a number', text: 'in their words' }[q.kind] || q.kind) + (q.options && q.options.length ? ': ' + q.options.map(function (o) { return o.en; }).join(', ') : '') + '</small></span></label>';
      }).join('');
  }
  async function qToggle(el) {
    var id = Number(el.getAttribute('data-w174q'));
    try { var r = await db.from('volunteer_survey_questions').update({ active: el.checked, updated_at: new Date().toISOString(), updated_by: await myEmail() }).eq('id', id); if (r.error) throw r.error; (W4.qs || []).forEach(function (q) { if (q.id === id) q.active = el.checked; }); T(el.checked ? 'Question back on' : 'Question off'); }
    catch (e) { el.checked = !el.checked; T('Could not save: ' + String((e && e.message) || e).slice(0, 90)); }
  }
