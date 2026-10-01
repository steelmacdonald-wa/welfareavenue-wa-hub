  /* ---------- data: the serving's own row, the role targets, the Hub's ticks ---------- */
  async function loadEvRow(ev, force) {
    if (!ev) return null;
    if (!force && S.ev && S.ev.id === ev.id && Date.now() - S.evAt < 20000) return S.ev;
    try {
      var r = await db.from('volunteer_events').select('id,format,planned_meals,plan_note,start_time,whatsapp_url,location,status,itinerary_auto,itinerary_channels,kitchen_place,kitchen_contact').eq('id', ev.id).maybeSingle();
      if (r && r.data) { S.ev = r.data; S.evAt = Date.now(); if (r.data.format && !ev.format) ev.format = r.data.format; if (r.data.start_time && !ev.start_time) ev.start_time = r.data.start_time; }
    } catch (e) { /* fine */ }
    return S.ev && S.ev.id === ev.id ? S.ev : null;
  }
  async function loadGuides() {
    if (S.guides) return S.guides;
    try { var r = await db.from('volunteer_role_guides').select('role,target,label_en'); S.guides = (r && r.data) || []; } catch (e) { S.guides = []; }
    return S.guides;
  }
  function targets() {
    /* the database's targets (volunteer_role_guides.target, from the medians of past servings); these defaults only until they load */
    var t = { team_leader: 1, cook: 4, driver: 2, server: 8, dishwasher: 1, photographer: 1, community_debrief: 1 };
    if (S.guides && S.guides.length) { t = {}; S.guides.forEach(function (g) { if (g.target != null && Number(g.target) > 0) t[g.role] = Number(g.target); }); }
    return t;
  }
  /* the Hub ticks what it can when the page opens (once per serving per five minutes), then the steps reload */
  async function autotick(ev) {
    if (!ev || !staff() || S.ticking) return false;
    var last = S.ticked[ev.id] || 0; if (Date.now() - last < 300000) return false;
    S.ticking = true; S.ticked[ev.id] = Date.now();
    try {
      var r = await db.rpc('wa191_autotick', { p_event: ev.id });
      var d = (r && r.data) || {};
      if ((d.ticked || 0) + (d.unticked || 0) > 0) {
        var steps = await db.from('sop_event_steps').select('*').eq('event_id', ev.id);
        var D = curD(); if (D && steps && steps.data) { D.steps = steps.data; try { WA_VOL_LOADED = false; } catch (e) { /* fine */ } }
        return true;
      }
    } catch (e) { /* fine */ } finally { S.ticking = false; }
    return false;
  }

  /* ---------- the model: templates by id, leaves, stages ---------- */
  function tmap() { var m = {}; tmpl().forEach(function (t) { m[t.id] = t; }); return m; }
  function kidsOf() { var k = {}; tmpl().forEach(function (t) { if (t.parent_id) (k[t.parent_id] = k[t.parent_id] || []).push(t); }); return k; }
  function stageOfTmpl(t) { if (t.stage) return t.stage; var p = t.phase || ''; if (p === 'post_event') return 'wrap_up'; if (p === 'event_day') return 'day_of'; if (p === 'week_of' || p === 't_minus_1w') return 'prepare'; return 'recruit'; }
  function model(ev, D) {
    var TM = tmap(), K = kidsOf(); var today = todayIso();
    var cur = stageOf(ev.event_date, ev.status);
    var out = { cur: cur, curIx: STAGE_IX[cur] == null ? (cur === 'done' ? 6 : -1) : STAGE_IX[cur], stages: {}, steps: [] };
    STAGES.forEach(function (s) { out.stages[s.k] = { k: s.k, leaves: 0, done: 0, overdue: 0, hub: 0, hubDone: 0, undone: [], people: 0 }; });
    (D.steps || []).forEach(function (s) {
      var t = TM[s.template_id]; if (!t || t.active === false) return;
      var st = stageOfTmpl(t); var isParent = !!(K[t.id] && K[t.id].length) && (!t.hub_signal || t.hub_signal === 'children'); /* a container; a parent with its own signal is a step */
      var row = { s: s, t: t, stage: st, parent: isParent, hub: !!t.hub_signal, over: !s.done && s.due_date && s.due_date < today };
      out.steps.push(row);
      var g = out.stages[st]; if (!g || isParent) return;
      g.leaves++; if (s.done) g.done++; if (row.over) g.overdue++;
      if (t.hub_signal) { g.hub++; if (s.done) g.hubDone++; } else { if (!s.done) { g.undone.push(row); g.people++; } }
    });
    STAGES.forEach(function (s, i) {
      var g = out.stages[s.k];
      g.pct = g.leaves ? Math.round(g.done / g.leaves * 100) : 0;
      g.state = (g.leaves && g.done >= g.leaves) ? 'done' : s.k === cur ? 'now' : (i < out.curIx && g.leaves > g.done) ? 'late' : 'soon';
      if (cur === 'done' && g.leaves > g.done) g.state = 'late';
    });
    return out;
  }
  function stageSummary(k, g, ev, D, row) {
    var bits = [];
    if (k === 'plan') { bits.push(ev.format ? FORMATS[ev.format] || ev.format : '<em>format not set</em>'); if (row && row.planned_meals) bits.push(row.planned_meals + ' meals'); }
    if (k === 'recruit') { var c = rosterCounts(D); var short = c.short; bits.push(c.on + ' on the list' + (short.length ? ', <em>' + short.length + ' role' + (short.length === 1 ? '' : 's') + ' short</em>' : ', <span class="ok">every role filled</span>')); }
    if (k === 'confirm') { var cc = rosterCounts(D); bits.push(cc.conf + ' of ' + cc.on + ' confirmed' + (cc.wait ? ', ' + cc.wait + ' waiting' : '')); }
    if (k === 'prepare') { bits.push(row && row.whatsapp_url ? '<span class="ok">WhatsApp link set</span>' : '<em>no WhatsApp link</em>'); }
    if (k === 'wrap_up' && ev.status === 'completed') bits.push('<span class="ok">closed</span>');
    if (g.leaves) bits.push(g.done + ' of ' + g.leaves + ' steps' + (g.overdue ? ', <em>' + g.overdue + ' overdue</em>' : ''));
    return bits.join(' · ');
  }
  function rosterCounts(D) {
    var T = targets(); var list = (D.roster || []).filter(function (r) { return !isOff(r) && !isDecl(r); });
    var by = {}; list.forEach(function (r) { by[r.role || 'other'] = (by[r.role || 'other'] || 0) + 1; });
    var short = ROLE_ORDER.filter(function (r) { return (T[r] || 0) > (by[r] || 0); });
    var conf = list.filter(isConf).length;
    return { on: list.length, conf: conf, wait: list.length - conf, by: by, short: short, T: T };
  }
  function ownerOf(row) { return (row.s.owner || row.t.default_owner || '').trim(); }
