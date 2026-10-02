  /* ---------- wave191m: the run (Prepare): where each driver goes, in order, with the times and Google Maps ----------
     Steel (01/10/26): the driver's itinerary and start time with the team leader "will always depend on how many cooks to
     pick up from" (3 to 6 cooks, the storage unit, the serving; after it the dishes at the Old Brewery Mission and back to the
     storage unit), and drivers need "a working google maps trajectory link of a starting point, all the stops on the way and
     how long in order to calculate their starting time". The serving-run edge function works the run out (the faster of the
     storage unit first and the cooks first, OpenStreetMap driving times) and stores it (volunteer_event_runs); the itineraries
     carry each person's part. This card shows it to the team: each driver's start, every stop with its time and the drive
     before it, the Maps link, their itinerary (a test link), after the serving, and what needs a look (a cook with no
     address, an address the map placed roughly). It works the run out again when the stops changed (the cron does too,
     every 15 minutes) or on Work it out again. Staff only (wa191_run_get). */
  var RUN = { by: {}, at: {}, busy: {}, err: {}, tried: {}, seen: {} };
  window.WA191RUN = { get: function (id) { var x = RUN.by[id]; return x && x.plan ? x.plan : null; } };
  var RUN_KIND = { both: 'Only driver', main: 'Main driver', pickup: 'Pickup driver', none: 'No driver yet' };
  function runUpcoming(ev) { return ev && ev.status !== 'cancelled' && ev.status !== 'completed' && daysTo(ev.event_date) >= 0; }
  function fmtAt(iso) { try { return new Date(iso).toLocaleString('en-CA', { timeZone: 'America/Toronto', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(/\./g, ''); } catch (e) { return ''; } }
  async function loadRun(ev, force) {
    if (!ev || !staff()) return null;
    if (!force && RUN.by[ev.id] && Date.now() - (RUN.at[ev.id] || 0) < 30000) return RUN.by[ev.id];
    try {
      var r = await db.rpc('wa191_run_get', { p_event: ev.id });
      if (r && r.error) RUN.err[ev.id] = 'Could not load the run: ' + String(r.error.message || r.error).slice(0, 120);
      else if (r && r.data) { RUN.by[ev.id] = r.data; RUN.err[ev.id] = RUN.err[ev.id] && /^Could not load/.test(RUN.err[ev.id]) ? null : RUN.err[ev.id]; }
    } catch (e) { RUN.err[ev.id] = 'Could not load the run'; }
    RUN.at[ev.id] = Date.now();
    return RUN.by[ev.id] || null;
  }
  async function planRun(ev, force) {
    if (!ev || RUN.busy[ev.id]) return;
    RUN.busy[ev.id] = true; RUN.tried[ev.id] = Date.now(); paintRun();
    try {
      var r = await db.functions.invoke('serving-run', { body: { action: 'plan', event_id: ev.id, force: !!force } });
      var d = r && r.data;
      if (r && r.error) RUN.err[ev.id] = 'Could not work it out: ' + String(r.error.message || r.error).slice(0, 120);
      else if (d && d.error) RUN.err[ev.id] = String(d.error).slice(0, 160);
      else RUN.err[ev.id] = null;
    } catch (e) { RUN.err[ev.id] = 'Could not work it out: ' + String((e && e.message) || e).slice(0, 120); }
    RUN.busy[ev.id] = false;
    await loadRun(ev, true);
    paintRun();
  }
  function runWarn(w) {
    var n = w.name || 'A cook';
    if (w.why === 'no address') return n + ': no pickup address yet. Their page asks for it; or set them to drop off.';
    if (w.why === 'address not found on the map') return n + ': the map could not find their address. Check it on their card.';
    if (w.why === 'placed by its postal code') return n + ': placed by the postal code only, so their time is approximate.';
    if (w.why === 'placed on its street, not the house') return n + ': placed on the street, not the house number, so their time may be a few minutes off.';
    return String(w.why || '');
  }
  function runCard(r, byId, tl) {
    var names = (r.drivers || []).map(function (id) { var x = byId[id]; return x ? x.person_name : null; }).filter(Boolean);
    if (!names.length) names = (r.names || []).filter(Boolean);
    var part = RUN_KIND[r.kind] || 'Driver';
    var withTl = r.with_tl ? (tl ? ', with ' + (tl.person_name || 'the team leader') + ' (team leader)' : ', with the team leader (none on the roster yet)') : '';
    var stops = r.stops || [];
    var first = stops[0] || {};
    var where = r.at === 'storage' ? 'at the storage unit' : r.at === 'serving' ? 'at the serving' : first.k === 'kitchen' ? 'at the kitchen' : first.label ? 'at ' + first.label + '’s' : 'at the first pickup';
    var h = '<div class="rn" data-w191runkind="' + E(r.kind) + '"><div class="rh"><div class="rw"><b>' + E(names.length ? names.join(', ') : 'No driver yet') + '</b><span>' + E(part + withTl) + '</span></div>'
      + '<div class="rt"><b>' + E(hm12(r.start)) + '</b><span>' + E('starts ' + where) + '</span></div></div>';
    h += '<ol class="rs">' + stops.map(function (s, i) {
      var label = s.k === 'storage' ? 'Storage unit' : s.k === 'serving' ? 'The serving' : s.k === 'kitchen' ? 'The kitchen' : (s.label || 'Cook');
      var meta = [];
      if (i && s.drive_min) meta.push(E(s.drive_min + ' min drive'));
      if (s.leave) meta.push(E('leaves ' + hm12(s.leave)));
      if (s.approx) meta.push('<em>placed roughly on the map</em>');
      return '<li><span class="t">' + E(hm12(s.arrive)) + '</span><span class="p"><b>' + E(label) + '</b>' + (s.hood ? ' <i>' + E(s.hood) + '</i>' : '')
        + (s.k !== 'serving' && s.address ? '<small>' + E(s.address) + '</small>' : '') + (meta.length ? '<small>' + meta.join(' · ') + '</small>' : '') + '</span></li>';
    }).join('') + '</ol>';
    var tok = (r.drivers || []).map(function (id) { return byId[id] && byId[id].confirm_token; }).filter(Boolean)[0] || (r.with_tl && tl && tl.confirm_token) || '';
    var foot = (stops.length > 1 ? '<span class="rl">' + E((r.total_min || 0) + ' min in all, ' + (r.drive_min || 0) + ' driving') + '</span>' : '')
      + (stops.length > 1 && /^https:\/\//.test(r.maps_url || '') ? '<a class="w191btn ghost" target="_blank" rel="noopener" href="' + E(r.maps_url) + '">Open in Google Maps</a>' : '')
      + (tok ? '<a class="w191btn quiet" target="_blank" rel="noopener" href="https://hub.welfareavenue.com/c/' + E(tok) + '?test=1&it=1">Their itinerary</a>' : '');
    return h + (foot ? '<div class="ra">' + foot + '</div>' : '') + '</div>';
  }
  function afterCard(p, byId, tl) {
    var a = p.after; if (!a || !(a.stops || []).length) return '';
    var r = (p.runs || []).filter(function (x) { return x.with_storage; })[0];
    var names = r ? (r.drivers || []).map(function (id) { var x = byId[id]; return x ? x.person_name : null; }).filter(Boolean) : [];
    var who = (names.length ? names.join(', ') : 'The driver') + (tl ? ' and ' + (tl.person_name || 'the team leader') : ' and the team leader');
    var li = function (t, b, sm) { return '<li><span class="t">' + E(hm12(t)) + '</span><span class="p"><b>' + E(b) + '</b>' + (sm ? '<small>' + E(sm) + '</small>' : '') + '</span></li>'; };
    var rows = a.stops.map(function (s) {
      if (s.k === 'serving') return li(s.leave, 'Leave the serving', 'after packing up');
      if (s.k === 'dish') return li(s.arrive, 'Old Brewery Mission: the dishes', s.drive_min + ' min drive · until ' + hm12(s.leave));
      return li(s.arrive, 'Storage unit: put away, then the inventory check', s.drive_min + ' min drive · done ' + hm12(s.leave));
    }).join('');
    return '<div class="rn after"><div class="rh"><div class="rw"><b>After the serving</b><span>' + E(who) + '</span></div><div class="rt"><b>' + E(hm12(a.end)) + '</b><span>back and locked up</span></div></div>'
      + '<ol class="rs">' + rows + '</ol>' + (/^https:\/\//.test(a.maps_url || '') ? '<div class="ra"><a class="w191btn ghost" target="_blank" rel="noopener" href="' + E(a.maps_url) + '">Open in Google Maps</a></div>' : '') + '</div>';
  }
  function runHtml(ev, D, x) {
    var busy = !!RUN.busy[ev.id], err = RUN.err[ev.id], up = runUpcoming(ev);
    var p = x && x.plan;
    var btn = up ? '<button class="w191btn ghost" data-w191run="again"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Working it out…' : 'Work it out again') + '</button>' : '';
    var h = '<h4>The run</h4>';
    if (!p) {
      return h + '<p class="w191rsub">' + (busy ? 'Working out the drivers’ run from the cooks’ addresses…' : err ? E(err) : up ? 'The Hub works out the drivers’ run from the cooks’ addresses and the drivers’ parts.' : 'No run was worked out for this serving.') + '</p>'
        + (btn && !busy ? '<div class="w191line">' + btn.replace('Work it out again', 'Work it out') + '</div>' : '');
    }
    var byId = {}; (D.roster || []).forEach(function (r) { byId[r.id] = r; });
    var tl = (D.roster || []).filter(function (r) { return lower(r.role) === 'team_leader' && !isOff(r) && !isDecl(r); })[0] || null;
    var other = p.order === 'cooks_first' ? 'storage_first' : 'cooks_first';
    var pills = [];
    if (p.order) pills.push('<span class="pill">' + E((p.order === 'cooks_first' ? 'Cooks first, then the storage unit' : 'The storage unit first, then the cooks') + (p.compared && p.compared[other] != null ? ': ' + p.compared[p.order] + ' min, against ' + p.compared[other] + ' the other way' : '')) + '</span>');
    if (p.arrive_by) pills.push('<span class="pill">Everyone at the serving by ' + E(hm12(p.arrive_by)) + '</span>');
    if (x.stale) pills.push('<span class="pill short">' + (busy ? 'The stops changed: working it out again' : 'The stops changed since it was worked out') + '</span>');
    else pills.push('<span class="pill ok">Up to date' + (x.computed_at ? ' · ' + E(fmtAt(x.computed_at)) : '') + '</span>');
    if (p.source === 'estimate') pills.push('<span class="pill short">The map service did not answer: the times are estimates</span>');
    var f = p.minutes && p.minutes.factor ? Math.round((Number(p.minutes.factor) - 1) * 100) : 0;
    h += '<p class="w191rsub">Who drives where, in what order, and when to leave. Driving times from OpenStreetMap' + (f > 0 ? ', plus ' + f + '% for traffic' : '') + '. Each driver and the team leader see their part, with the Google Maps link, on their itinerary.</p>'
      + '<div class="w191line">' + pills.join('') + btn + '</div>';
    if (err && !busy) h += '<p class="w191rerr">' + E(err) + '</p>';
    var w = p.warnings || [];
    if (w.length) h += '<div class="w191runw"><b>Needs a look</b>' + w.map(function (y) { return '<div>' + E(runWarn(y)) + '</div>'; }).join('') + '</div>';
    if (!tl) h += '<div class="w191runw"><b>No team leader yet</b><div>The run has a seat for them: add a team leader in The team.</div></div>';
    h += '<div class="w191runs">' + (p.runs || []).map(function (r) { return runCard(r, byId, tl); }).join('') + afterCard(p, byId, tl) + '</div>';
    return h;
  }
  /* each driver's start for The day card */
  function runStartFor(evId, rid, role) {
    var x = RUN.by[evId]; var p = x && x.plan; if (!p) return '';
    var r = (p.runs || []).filter(function (y) { return role === 'team_leader' ? y.with_tl : (y.drivers || []).indexOf(rid) >= 0; })[0];
    return r ? r.start : '';
  }
  function runBox() {
    var b = stageBody('prepare'); if (!b) return null;
    var box = document.getElementById('w191run');
    if (!box) { box = document.createElement('div'); box.id = 'w191run'; box.className = 'cardy w191run'; }
    var it = b.querySelector(':scope > #w174card');
    if (it) { if (it.nextElementSibling !== box) it.insertAdjacentElement('afterend', box); }
    else if (box.parentNode !== b) b.insertBefore(box, stepsBox('prepare'));
    return box;
  }
  async function paintRun() {
    var ev = curEv(), D = curD(); if (!ev || !D || !root() || !staff()) return;
    if (ev.kind && ev.kind !== 'service') return;
    var x = await loadRun(ev, false);
    if (curEv() !== ev || !root()) return;
    var box = runBox(); if (!box) return;
    var html = runHtml(ev, D, x);
    if (box.__h !== html) { box.innerHTML = html; box.__h = html; }
    /* the day card and the itinerary card follow a new run */
    var stamp = x && x.plan ? String(x.computed_at || x.plan.computed_at || '') : '';
    if (stamp && RUN.seen[ev.id] !== stamp) {
      RUN.seen[ev.id] = stamp;
      var row = S.ev && S.ev.id === ev.id ? S.ev : null;
      var dc = root().querySelector('.w191stage[data-stage="day_of"] .w191own'); if (dc) dc.innerHTML = dayCard(ev, D, row);
      var c4 = document.getElementById('w174card'); if (c4) c4.__h = '';
      try { if (window.w171 && typeof w171.paintW174 === 'function') w171.paintW174(); } catch (e) { /* fine */ }
    }
    if (runUpcoming(ev) && x && (!x.plan || x.stale) && !RUN.busy[ev.id] && Date.now() - (RUN.tried[ev.id] || 0) > 60000) planRun(ev, false);
  }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var b = t.closest('[data-w191run]'); if (!b || !b.closest('#w191run')) return;
    e.preventDefault(); e.stopPropagation();
    if (b.getAttribute('data-w191run') === 'again') planRun(curEv(), true);
  }, true);

  /* ---------- wave191n: the team leader's storage check (Wrap up), and the last check on the Inventory ----------
     After the serving the team leader checks the storage unit on their page (volunteer_inventory_submit): whether everything
     is back in its place, and each item all back, running low or missing; the Inventory's Reorder notes follow. Wrap up shows
     the check and what to restock; before it is in, what to expect and the team leader's link as a test. Staff read. */
  var INVC = { by: {}, at: {}, last: null, lastAt: 0 };
  async function loadInvCheck(ev, force) {
    if (!ev || !staff()) return null;
    if (!force && INVC.at[ev.id] && Date.now() - INVC.at[ev.id] < 30000) return INVC.by[ev.id];
    try { var r = await db.from('volunteer_inventory_checks').select('*').eq('event_id', ev.id).maybeSingle(); if (r && !r.error) INVC.by[ev.id] = r.data || null; } catch (e) { /* fine */ }
    INVC.at[ev.id] = Date.now();
    return INVC.by[ev.id] || null;
  }
  function invCardHtml(ev, D, c) {
    var tl = (D.roster || []).filter(function (r) { return lower(r.role) === 'team_leader' && !isOff(r) && !isDecl(r); })[0] || null;
    var d = daysTo(ev.event_date);
    var h = '<h4>Storage check</h4>';
    var acts = '<div class="w191line">' + (tl && tl.confirm_token ? '<a class="w191btn ghost" target="_blank" rel="noopener" href="https://hub.welfareavenue.com/c/' + E(tl.confirm_token) + '?test=1#inv">' + (c ? 'Their check (test link)' : 'The team leader’s check (test link)') + '</a>' : '') + '<button class="w191btn quiet" data-w191go="inventory">Open the Inventory</button></div>';
    if (!c) {
      h += '<p class="w191rsub">' + (d <= 0 && ev.status !== 'cancelled'
        ? 'The team leader’s check is not in yet. It opens on their page when the serving starts, for three days: whether everything is back in its place, and what is running low or missing.'
        : 'After the serving the team leader checks the storage unit on their page: whether everything is back in its place, and what is running low or missing. What to restock shows here and in the Inventory.') + '</p>';
      return h + acts;
    }
    var items = c.items || [];
    var lo = items.filter(function (x) { return x.state === 'low'; }), mi = items.filter(function (x) { return x.state === 'missing'; });
    h += '<p class="w191rsub">' + E((c.by_name || 'The team leader') + ' checked the storage unit' + (c.updated_at ? ' · ' + fmtAt(c.updated_at) : '')) + '</p>'
      + '<div class="w191line">' + (c.in_place ? '<span class="pill ok">Everything back in its place</span>' : '<span class="pill short">Not everything back in its place</span>')
      + '<span class="pill' + (lo.length ? ' short' : ' ok') + '">' + lo.length + ' running low</span><span class="pill' + (mi.length ? ' short' : ' ok') + '">' + mi.length + ' missing</span></div>';
    var row = function (x, k) { return '<div><span class="tg ' + k + '">' + (k === 'mi' ? 'Missing' : 'Running low') + '</span><b>' + E(x.item || '') + '</b>' + (x.unit ? ' <i>' + E(x.unit) + '</i>' : '') + (x.category ? ' <i>· ' + E(x.category) + '</i>' : '') + '</div>'; };
    h += lo.length || mi.length ? '<div class="w191restock"><b>To restock</b>' + mi.map(function (x) { return row(x, 'mi'); }).join('') + lo.map(function (x) { return row(x, 'lo'); }).join('') + '</div>'
      : '<p class="w191rsub" style="margin-top:8px">Nothing to restock.</p>';
    if (c.note) h += '<div class="w191ctx"><b>Their note</b><span>' + E(c.note) + '</span></div>';
    return h + acts;
  }
  function invBox() {
    var b = stageBody('wrap_up'); if (!b) return null;
    var box = document.getElementById('w191inv');
    if (!box) { box = document.createElement('div'); box.id = 'w191inv'; box.className = 'cardy w191run w191inv'; }
    var sv = b.querySelector(':scope > #w174survey');
    if (sv) { if (sv.nextElementSibling !== box) sv.insertAdjacentElement('afterend', box); }
    else if (box.parentNode !== b) b.insertBefore(box, stepsBox('wrap_up'));
    return box;
  }
  async function paintInv() {
    var ev = curEv(), D = curD(); if (!ev || !D || !root() || !staff()) return;
    if (ev.kind && ev.kind !== 'service') return;
    var c = await loadInvCheck(ev, false);
    if (curEv() !== ev || !root()) return;
    var box = invBox(); if (!box) return;
    var html = invCardHtml(ev, D, c);
    if (box.__h !== html) { box.innerHTML = html; box.__h = html; }
  }
  /* the Inventory view: the last check, above the table */
  async function invBanner() {
    try {
      if (!staff() || typeof WA_VOL_VIEW === 'undefined' || WA_VOL_VIEW !== 'inventory') return;
      var sec = document.getElementById('volunteering'); if (!sec) return;
      var wrap = sec.querySelector('.vl-tblwrap'); if (!wrap) return;
      if (!INVC.lastAt || Date.now() - INVC.lastAt > 30000) {
        INVC.lastAt = Date.now();
        var r = await db.from('volunteer_inventory_checks').select('event_id,by_name,updated_at,low,missing,in_place').order('updated_at', { ascending: false }).limit(1);
        INVC.last = r && r.data && r.data[0] ? r.data[0] : null;
      }
      var x = INVC.last; var el = document.getElementById('w191invlast');
      if (!x) { if (el) el.remove(); return; }
      var ev = null; try { (WA_VOL_EVENTS || []).forEach(function (e) { if (e.id === x.event_id) ev = e; }); } catch (e) { /* fine */ }
      var html = '<b>Last storage check</b><span>' + E((x.by_name || 'The team leader') + (ev ? ', after the serving of ' + fmtDay(ev.event_date) : '') + ' · ' + fmtAt(x.updated_at)) + '</span>'
        + '<span>' + E(x.low + ' running low, ' + x.missing + ' missing' + (x.in_place ? ', everything back in its place' : ', not everything back in its place')) + '. Their flags are in the Reorder column.</span>';
      if (!el) { el = document.createElement('div'); el.id = 'w191invlast'; el.className = 'w191ctx'; }
      if (el.__h !== html) { el.innerHTML = html; el.__h = html; }
      var anchor = sec.querySelector('#w63bar') || wrap;
      if (el.nextElementSibling !== anchor) anchor.insertAdjacentElement('beforebegin', el);
    } catch (e) { /* fine */ }
  }
