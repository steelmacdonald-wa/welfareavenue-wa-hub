
  /* ---------- the data: Toronto events (volunteer_events kind 'meal', location Toronto), their crews and who the meals go to ---------- */
  var EV_COLS = 'id,code,event_date,start_time,title,location,kind,status,notes,plan_note,planned_meals,kitchen_place,kitchen_contact,kitchen_shift,whatsapp_url,spot_counts';
  var RO_COLS = 'id,event_id,person_id,person_name,role,status,confirm_status,confirmed_at,notes,detail,sort';
  function missingFn(e) { var s = String((e && (e.code || '')) + ' ' + msgOf(e)); return /PGRST202|PGRST205|42883|42P01|could not find|does not exist|schema cache/i.test(s); }
  async function loadEvents(force) {
    if (S.loading && !force) return S.loading;
    S.loading = (async function () {
      try {
        var r = await db.from('volunteer_events').select(EV_COLS).eq('kind', 'meal').order('event_date', { ascending: true });
        if (r && r.error) throw r.error;
        S.events = ((r && r.data) || []).filter(isTo);
        S.evErr = null;
      } catch (e) { S.evErr = msgOf(e); console.warn('wave274 events', e); }
      var ids = S.events.map(function (e) { return e.id; });
      if (ids.length) {
        var rr = await Promise.all([
          db.from('event_roster').select(RO_COLS).in('event_id', ids).order('sort', { ascending: true }),
          db.from('volunteer_event_recipients').select('*').in('event_id', ids).order('sort', { ascending: true })
        ].map(function (q) { return Promise.resolve(q).then(function (x) { return x; }, function (e) { return { error: e }; }); }));
        if (rr[0] && rr[0].error) { S.rosterErr = msgOf(rr[0].error); }
        else { S.rosterErr = null; S.roster = ((rr[0] && rr[0].data) || []).filter(function (x) { return x && ids.some(function (i) { return String(i) === String(x.event_id); }); }); }
        if (rr[1] && rr[1].error) { S.recOk = false; S.rec = []; }
        else { S.recOk = true; S.rec = ((rr[1] && rr[1].data) || []).filter(function (x) { return x && ids.some(function (i) { return String(i) === String(x.event_id); }); }); }
      } else {
        S.roster = []; S.rec = [];
        try { var p = await db.from('volunteer_event_recipients').select('id').limit(1); S.recOk = !(p && p.error); } catch (e) { S.recOk = false; }
      }
      S.loaded = true;
      reindexPool();
    })();
    try { await S.loading; } finally { S.loading = null; }
  }
  /* one event's crew again (after an add the server made) */
  async function reloadRoster(evId) {
    try {
      var r = await db.from('event_roster').select(RO_COLS).eq('event_id', evId).order('sort', { ascending: true });
      if (r && r.error) throw r.error;
      var fresh = ((r && r.data) || []).filter(function (x) { return String(x.event_id) === String(evId); });
      S.roster = S.roster.filter(function (x) { return String(x.event_id) !== String(evId); }).concat(fresh);
      reindexPool();
    } catch (e) { console.warn('wave274 roster', e); }
  }

  /* ---------- the Toronto pool: the CRM's people in Toronto ----------
     Tagged toronto / toronto volunteer / toronto student, or living in the GTA, or on a Toronto crew. The server is asked for
     each, and the same rule is applied again here (the browser's word is what the page shows). */
  var C_COLS = 'id,full_name,first_name,last_name,primary_email,emails,phones,city,tags,kinds,volunteer_id,org_id,merged_into,created_at,last_activity_at,source';
  function torontoVids() { var v = {}; S.roster.forEach(function (r) { if (r.person_id != null) v[String(r.person_id)] = 1; }); return v; }
  function inPool(c, vids) {
    if (!c || c.merged_into != null) return false;
    if ((c.tags || []).some(function (t) { return TAGS.indexOf(lower(t)) >= 0; })) return true;
    if (GTA.indexOf(lower(c.city)) >= 0) return true;
    return c.volunteer_id != null && !!vids[String(c.volunteer_id)];
  }
  function jv(v) {
    if (typeof v === 'string') { var t = v.trim(); if (/^[\[{"]/.test(t)) { try { return jv(JSON.parse(t)); } catch (e) { return v; } } return v; }
    if (v && typeof v === 'object' && !Array.isArray(v)) { if ('value' in v) return jv(v.value); if ('values' in v) return jv(v.values); }
    return v;
  }
  function asText(v) { v = jv(v); if (v == null) return ''; if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(', '); if (typeof v === 'object') return String(v.label || v.name || ''); return String(v).trim(); }
  function asList(v) {
    v = jv(v); if (v == null || v === '') return [];
    if (Array.isArray(v)) { var o = []; v.forEach(function (x) { asList(x).forEach(function (y) { o.push(y); }); }); return o; }
    if (typeof v === 'object') return [asText(v)].filter(Boolean);
    return String(v).split(/[,;\n\/|]+|\s+and\s+/i).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function asBool(v) { v = jv(v); if (typeof v === 'boolean') return v; var s = lower(asText(v)); if (!s) return null; return /^(yes|y|true|oui|1|i am|agree)/.test(s); }
  var DAYK = { mon: 0, lun: 0, tue: 1, mar: 1, wed: 2, mer: 2, thu: 3, jeu: 3, fri: 4, ven: 4, sat: 5, sam: 5, sun: 6, dim: 6 };
  function daysOf(v) {
    var on = [false, false, false, false, false, false, false];
    asList(v).forEach(function (s) {
      var f = fold(s);
      if (/weekend|fin de semaine/.test(f)) { on[5] = on[6] = true; return; }
      if (/weekday|semaine/.test(f)) { for (var i = 0; i < 5; i++) on[i] = true; return; }
      if (/^(any|all|every|flexible|tous|toutes)/.test(f)) { for (var j = 0; j < 7; j++) on[j] = true; return; }
      var k = DAYK[f.slice(0, 3)]; if (k != null) on[k] = true;
    });
    return on;
  }
  function areaOf(c, raw) {
    var a = asText(raw); if (a) return a;
    var city = lower(c.city); for (var i = 0; i < AREAS.length; i++) if (lower(AREAS[i]) === city) return AREAS[i];
    return c.city ? String(c.city).trim() : '';
  }
  function chunks(a, n) { var o = []; for (var i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }
  async function q(p) { try { var r = await p; if (r && r.error) throw r.error; return (r && r.data) || []; } catch (e) { throw e; } }
  async function loadPool(force) {
    if (S.pool && !force) return S.pool;
    if (S.poolBusy) return S.poolBusy;
    S.poolBusy = (async function () {
      try {
        if (!S.loaded) await loadEvents();
        var vids = torontoVids(), vlist = Object.keys(vids).map(Number).filter(function (n) { return isFinite(n); });
        var tagq = TAGS.concat(TAGS.map(function (t) { return t.replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }));
        var asks = [
          db.from('crm_contacts').select(C_COLS).is('merged_into', null).overlaps('tags', tagq).limit(3000),
          db.from('crm_contacts').select(C_COLS).is('merged_into', null).or(GTA.map(function (c) { return 'city.ilike."' + c + '"'; }).join(',')).limit(3000)
        ];
        chunks(vlist, 150).forEach(function (part) { asks.push(db.from('crm_contacts').select(C_COLS).in('volunteer_id', part).limit(3000)); });
        var got = await Promise.all(asks.map(q));
        var by = {};
        got.forEach(function (rows) { rows.forEach(function (c) { if (c && c.id != null && !by[c.id]) by[c.id] = c; }); });
        var list = Object.keys(by).map(function (k) { return by[k]; }).filter(function (c) { return inPool(c, vids); });
        /* schools, and the answers (area, days, age, consent) */
        var orgIds = list.map(function (c) { return c.org_id; }).filter(function (x, i, a) { return x != null && a.indexOf(x) === i; });
        var orgs = {}, fields = {}, vals = [];
        try { if (orgIds.length) (await q(db.from('volunteer_orgs').select('id,name,short').in('id', orgIds))).forEach(function (o) { orgs[o.id] = o; }); } catch (e) { console.warn('wave274 schools', e); }
        try {
          var fs = await q(db.from('crm_fields').select('id,key').in('key', FKEYS));
          fs.forEach(function (f) { if (FKEYS.indexOf(f.key) >= 0) fields[f.id] = f.key; });
          var fids = Object.keys(fields).map(Number);
          if (fids.length && list.length) {
            var parts = await Promise.all(chunks(list.map(function (c) { return c.id; }), 150).map(function (ids) { return q(db.from('crm_contact_fields').select('contact_id,field_id,value').in('field_id', fids).in('contact_id', ids)); }));
            parts.forEach(function (p) { vals = vals.concat(p); });
          }
        } catch (e) { console.warn('wave274 answers', e); }
        var ans = {};
        vals.forEach(function (v) { var k = fields[v.field_id]; if (!k) return; (ans[v.contact_id] = ans[v.contact_id] || {})[k] = v.value; });
        S.orgs = orgs;
        S.pool = list.map(function (c) { return person(c, ans[c.id] || {}); });
        S.poolErr = null;
      } catch (e) { S.poolErr = msgOf(e); S.pool = S.pool || []; console.warn('wave274 pool', e); }
      reindexPool();
      return S.pool;
    })();
    try { return await S.poolBusy; } finally { S.poolBusy = null; }
  }
  function person(c, a) {
    var tags = (c.tags || []).map(lower), org = c.org_id != null ? S.orgs[c.org_id] : null;
    var student = c.org_id != null || tags.indexOf('toronto student') >= 0;
    var emails = [c.primary_email].concat(c.emails || []).filter(function (x, i, l) { return x && l.indexOf(x) === i; });
    /* break274: a contact with no name is shown by its email (or phone), so two of them in a list can be told apart */
    var name = String(String(c.full_name || '').trim() || [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || emails[0] || (c.phones || [])[0] || 'No name').trim();
    return {
      id: c.id, c: c, name: name, email: emails[0] || '', phone: (c.phones || [])[0] || '',
      student: student, school: org ? String(org.short || org.name || '') : '', schoolName: org ? String(org.name || org.short || '') : '', schoolId: org ? org.id : null,
      area: areaOf(c, a.gta_area), days: daysOf(a.days_available), age16: asBool(a.age_16_plus), photo: asBool(a.photo_consent),
      created: c.created_at || '', evs: [], count: 0, last: '', next: ''
    };
  }
  /* each person's Toronto events, and the maps from a roster row to its person */
  function reindexPool() {
    S.byCid = {}; S.byVid = {};
    (S.pool || []).forEach(function (p) { S.byCid[p.id] = p; if (p.c.volunteer_id != null) S.byVid[String(p.c.volunteer_id)] = p; p.evs = []; });
    var t = todayIso();
    S.roster.forEach(function (r) {
      if (stOf(r) === 'off' || S.pend[r.id]) return;
      var p = personOf(r), e = evById(r.event_id); if (!p || !e) return;
      p.evs.push({ ev: e, row: r });
    });
    (S.pool || []).forEach(function (p) {
      var ds = p.evs.filter(function (x) { return lower(x.ev.status) !== 'cancelled'; }).map(function (x) { return String(x.ev.event_date); }).sort();
      p.count = ds.length;
      var past = ds.filter(function (d) { return d < t; }), fut = ds.filter(function (d) { return d >= t; });
      p.last = past.length ? past[past.length - 1] : ''; p.next = fut.length ? fut[0] : '';
    });
  }
  function personOf(r) {
    if (!r) return null;
    var cid = r.detail && r.detail.contact_id;
    return (cid != null && S.byCid[cid]) || (r.person_id != null && S.byVid[String(r.person_id)]) || null;
  }
  function onEvent(p, evId) {
    return S.roster.some(function (r) { return String(r.event_id) === String(evId) && !S.pend[r.id] && stOf(r) !== 'off' && ((r.detail && String(r.detail.contact_id) === String(p.id)) || (p.c.volunteer_id != null && String(r.person_id) === String(p.c.volunteer_id))); });
  }
  function contactOfRow(r) {
    var p = personOf(r), d = (r && r.detail) || {};
    return { email: (p && p.email) || d.email || '', phone: (p && p.phone) || d.phone || '' };
  }

  /* ---------- writes (each one optimistic, put back with a plain sentence when it fails) ---------- */
  async function must(p) { var r = await p; if (r && r.error) throw r.error; return r; }
  function nextCodeLocal(date) {
    var yy = String(date || todayIso()).slice(2, 4), n = 0, re = new RegExp('^TO-' + yy + '-(\\d+)$');
    S.events.forEach(function (e) { var m = re.exec(String(e.code || '')); if (m) n = Math.max(n, Number(m[1])); });
    return 'TO-' + yy + '-' + (n + 1);
  }
  async function nextCode(date) {
    try {
      var r = await db.rpc('wa274_next_code', { p_date: date });
      if (r && !r.error && typeof r.data === 'string' && /^TO-\d{2}-\d+$/.test(r.data)) return r.data;
    } catch (e) { /* the SQL is not applied yet */ }
    return nextCodeLocal(date);
  }
  async function createEvent(f) {
    var row = { code: await nextCode(f.event_date), event_date: f.event_date, start_time: f.start_time || '10:00', title: f.title || 'Free meal event', location: 'Toronto', kind: 'meal', status: 'planned',
      notes: f.notes || null, planned_meals: f.planned_meals, kitchen_place: f.kitchen_place || null, kitchen_shift: f.kitchen_shift || null };
    var r = await must(db.from('volunteer_events').insert(row).select(EV_COLS).single());
    var made = (r && r.data && r.data.id != null) ? r.data : null;
    if (!made) { await loadEvents(true); made = S.events.filter(function (e) { return e.code === row.code; })[0] || null; }
    else if (!evById(made.id)) S.events.push(Object.assign({}, row, made));
    try { if (typeof logChange === 'function') logChange('volunteer_event', made ? made.id : row.code, 'created', null, row.code + ' ' + row.title + ' on ' + row.event_date); } catch (e) { /* fine */ }
    return made;
  }
  async function saveEvent(ev, patch) {
    var old = {}; Object.keys(patch).forEach(function (k) { old[k] = ev[k]; });
    Object.assign(ev, patch);
    try { await must(db.from('volunteer_events').update(patch).eq('id', ev.id)); }
    catch (e) { Object.assign(ev, old); throw e; }
    Object.keys(patch).forEach(function (k) { audit(ev.id, k, old[k] && typeof old[k] === 'object' ? JSON.stringify(old[k]) : old[k], patch[k] && typeof patch[k] === 'object' ? JSON.stringify(patch[k]) : patch[k]); });
  }
  var ST_PATCH = {
    yes: function () { return { status: 'Confirmed', confirm_status: 'confirmed', confirmed_at: new Date().toISOString() }; },
    no: function () { return { status: 'Unavailable', confirm_status: 'declined' }; },
    wait: function () { return { status: 'TBD', confirm_status: null }; }
  };
  async function setStatus(r, st) {
    var patch = ST_PATCH[st](), old = { status: r.status, confirm_status: r.confirm_status, confirmed_at: r.confirmed_at };
    Object.assign(r, patch);
    try { await must(db.from('event_roster').update(patch).eq('id', r.id)); }
    catch (e) { Object.assign(r, old); throw e; }
    try { if (typeof logChange === 'function' && old.status !== patch.status) logChange('event_roster', r.id, 'status', old.status, patch.status); } catch (e) { /* fine */ }
  }
  async function setCalled(r, on) {
    var d = Object.assign({}, r.detail || {}), old = r.detail;
    if (on) { d.called_at = new Date().toISOString(); d.called_by = me(); } else { delete d.called_at; delete d.called_by; }
    r.detail = d;
    try { await must(db.from('event_roster').update({ detail: d }).eq('id', r.id)); }
    catch (e) { r.detail = old; throw e; }
  }
  /* a person onto a crew: the database function first (it gives a contact a volunteer record when it has none) */
  async function crewAdd(ev, p, role) {
    var res = null;
    try {
      var r = await db.rpc('wa274_crew_add', { p_event: ev.id, p_contact: p.id, p_role: role });
      if (r && r.error && !missingFn(r.error)) return { ok: false, err: msgOf(r.error) };
      if (r && !r.error && r.data && r.data.ok) res = r.data;
    } catch (e) { if (!missingFn(e)) return { ok: false, err: msgOf(e) }; }
    if (res) {
      if (res.person_id != null && p.c.volunteer_id == null) p.c.volunteer_id = res.person_id;
      if (!res.already && res.roster_id != null && !rowById(res.roster_id)) {
        S.roster.push({ id: res.roster_id, event_id: ev.id, person_id: res.person_id, person_name: p.name, role: role, status: 'TBD', confirm_status: null, confirmed_at: null, notes: null, sort: 9999,
          detail: { source: 'toronto', contact_id: p.id, added_by: me(), email: p.email || null, phone: p.phone || null } });
      } else if (res.already && !rowById(res.roster_id)) await reloadRoster(ev.id);
      return { ok: true, already: !!res.already };
    }
    /* the database update is not applied yet: a person with a volunteer record goes straight onto the crew */
    if (p.c.volunteer_id == null) return { ok: false, needs: true };
    if (onEvent(p, ev.id)) return { ok: true, already: true };
    var row = { event_id: ev.id, person_id: p.c.volunteer_id, person_name: p.c.full_name || p.name, role: role, status: 'TBD', detail: { source: 'toronto', contact_id: p.id } };
    try {
      var ins = await must(db.from('event_roster').insert(row).select(RO_COLS).single());
      var got = ins && ins.data;
      if (got && got.id != null) S.roster.push(Object.assign({ confirm_status: null, confirmed_at: null, notes: null, sort: 9999 }, row, got));
      else await reloadRoster(ev.id);
      return { ok: true, already: false };
    } catch (e) { return { ok: false, err: msgOf(e) }; }
  }
  /* who the meals go to */
  async function saveRecipient(ev, id, f) {
    if (id) {
      var r = S.rec.filter(function (x) { return String(x.id) === String(id); })[0]; if (!r) throw new Error('That organization is not on this event any more.');
      var old = Object.assign({}, r);
      Object.assign(r, f);
      try { await must(db.from('volunteer_event_recipients').update(f).eq('id', r.id)); } catch (e) { Object.keys(r).forEach(function (k) { delete r[k]; }); Object.assign(r, old); throw e; }
      return r;
    }
    var row = Object.assign({ event_id: ev.id, sort: recsOf(ev.id).reduce(function (m, x) { return Math.max(m, num(x.sort, 0)); }, 0) + 1 }, f);
    var ins = await must(db.from('volunteer_event_recipients').insert(row).select('*').single());
    var got = ins && ins.data;
    if (got && got.id != null) { S.rec.push(Object.assign({}, row, got)); return got; }
    var re = await db.from('volunteer_event_recipients').select('*').eq('event_id', ev.id).order('sort', { ascending: true });
    if (re && !re.error) S.rec = S.rec.filter(function (x) { return String(x.event_id) !== String(ev.id); }).concat((re.data || []).filter(function (x) { return String(x.event_id) === String(ev.id); }));
    return row;
  }
  async function removeRecipient(id) {
    var r = S.rec.filter(function (x) { return String(x.id) === String(id); })[0]; if (!r) return;
    var keep = S.rec.slice();
    S.rec = S.rec.filter(function (x) { return x !== r; });
    try { await must(db.from('volunteer_event_recipients').delete().eq('id', r.id)); } catch (e) { S.rec = keep; throw e; }
  }
  /* taking someone off the crew waits 5 seconds for Undo, then deletes the row */
  function takeOff(r, onDone) {
    if (!r || S.pend[r.id]) return;
    var p = { row: r, t: null, done: onDone };
    p.t = setTimeout(function () { commitOff(r.id); }, 5000);
    S.pend[r.id] = p;
    reindexPool();
  }
  async function commitOff(id) {
    var p = S.pend[id]; if (!p) return;
    clearTimeout(p.t); p.t = null;
    try {
      await must(db.from('event_roster').delete().eq('id', id));
      S.roster = S.roster.filter(function (x) { return String(x.id) !== String(id); });
      delete S.pend[id];
      try { if (typeof logChange === 'function') logChange('event_roster', id, 'removed', (p.row.person_name || '') + ' (' + p.row.role + ')', null); } catch (e) { /* fine */ }
      reindexPool();
      if (p.done) p.done(null);
    } catch (e) { delete S.pend[id]; reindexPool(); if (p.done) p.done(e); }
  }
  function undoOff(id) { var p = S.pend[id]; if (!p) return false; clearTimeout(p.t); delete S.pend[id]; reindexPool(); return true; }
  function flushOff() { Object.keys(S.pend).forEach(function (id) { if (S.pend[id] && S.pend[id].t) commitOff(id); }); }
