
  /* ---------- data ---------- */
  /* who may text (leaders, HR, admins) and switch texts (admins): asked once a minute, the database decides anyway */
  async function can() {
    if (S.can && Date.now() - S.canAt < 60000) return S.can;
    var out = { admin: false, text: false };
    try {
      var r = await Promise.all([db.rpc('is_wa_admin'), db.rpc('is_wa_leader'), db.rpc('wa_is_hr')]);
      out.admin = !!(r[0] && r[0].data === true);
      out.text = out.admin || !!(r[1] && r[1].data === true) || !!(r[2] && r[2].data === true);
    } catch (e) { /* offline: nothing extra */ }
    S.can = out; S.canAt = Date.now();
    return out;
  }
  async function loadCfg(force) {
    if (!force && S.mode && Date.now() - S.modeAt < 30000) return S.cfg;
    try {
      var r = await db.from('app_config').select('key,value').in('key', ['sms_mode', 'sms_test_phones', 'sms_confirm_days', 'sms_confirm_hour', 'quo_webhook_id', 'sms_survey_url', 'sms_survey_roles', 'sms_survey_hour']);
      var c = {}; ((r && r.data) || []).forEach(function (x) { c[x.key] = x.value; });
      S.cfg = c; S.mode = c.sms_mode || 'off'; S.modeAt = Date.now();
    } catch (e) { S.mode = S.mode || 'off'; }
    return S.cfg;
  }
  async function loadMsgs(evId, force) {
    if (!evId) return [];
    if (!force && S.msgs[evId] && Date.now() - (S.msgsAt[evId] || 0) < 25000) return S.msgs[evId];
    try {
      var r = await db.from('quo_messages').select('id,roster_id,person_id,direction,kind,status,handled,body,phone,error,created_at,sent_at').eq('event_id', evId).order('created_at', { ascending: false }).limit(300);
      S.msgs[evId] = (r && r.data) || [];
    } catch (e) { S.msgs[evId] = S.msgs[evId] || []; }
    S.msgsAt[evId] = Date.now();
    return S.msgs[evId];
  }
  /* the last confirmation text per roster row */
  function lastText(evId, rid) {
    var m = (S.msgs[evId] || []).filter(function (x) { return x.roster_id === rid && x.direction === 'out' && (x.kind === 'confirm' || x.kind === 'manual'); });
    return m[0] || null;
  }
  function replies(evId) { return (S.msgs[evId] || []).filter(function (x) { return x.direction === 'in'; }); }
  function curEv() { var ev = null; try { (WA_VOL_EVENTS || []).forEach(function (e) { if (e.id === WA_VOL_EVENT) ev = e; }); } catch (e) { /* fine */ } return ev; }
  function curD() { try { return (WA_VOL_DETAIL && WA_VOL_DETAIL.id === WA_VOL_EVENT) ? WA_VOL_DETAIL : null; } catch (e) { return null; } }
  function onEvent() { try { var s = document.getElementById('volunteering'); return typeof WA_VOL_VIEW !== 'undefined' && WA_VOL_VIEW === 'event' && !!s && s.classList.contains('active') && !!document.getElementById('w119'); } catch (e) { return false; } }
  function counts(roster, evId) {
    var list = (roster || []).filter(function (r) { return !isOff(r); });
    var c = { list: list.length, conf: 0, bytext: 0, decl: 0, texted: 0, waiting: 0, nophone: 0 };
    list.forEach(function (r) {
      if (isConf(r)) { c.conf++; if (r.confirm_status === 'confirmed') c.bytext++; }
      else if (isDecl(r)) c.decl++;
      else {
        c.waiting++;
        var t = evId ? lastText(evId, r.id) : null;
        if (t && t.status === 'sent') c.texted++;
        if (!phoneOf(r)) c.nophone++;
      }
    });
    return c;
  }
  /* the date the automatic confirmation goes (7 days before, 10 am) */
  function autoDay(ev) {
    var days = Number(S.cfg.sms_confirm_days || 7), hour = Number(S.cfg.sms_confirm_hour || 10);
    return { day: addDays(ev.event_date, -days), hour: hour };
  }
