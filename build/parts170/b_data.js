  /* ---------- data: my mailbox (own rows only), and the mybox function ---------- */
  function q(p) { return Promise.resolve(p).then(function (r) { return r || { data: null }; }, function (e) { return { data: null, error: e }; }); }
  function staffish() { try { return typeof isStaff !== 'function' || isStaff(); } catch (e) { return true; } }
  function loadOwner(force) {
    if (!staffish()) { S.owner = false; return Promise.resolve(false); }
    if (S.ownerP) return S.ownerP;
    if (!force && S.owner !== null && Date.now() - S.ownerAt < 60000) return Promise.resolve(S.owner);
    S.ownerP = q(db.from('mybox_owners').select('email, name, enabled, auto_sort, days_back, archive_labels, label_notes, skip_senders, skip_words, labels, labels_at, last_sort_at, last_result, last_error').limit(1)).then(function (r) {
      var o = r && Array.isArray(r.data) && r.data[0] ? r.data[0] : null;
      S.owner = o && o.enabled ? o : false; S.ownerAt = Date.now(); S.ownerP = null;
      return S.owner;
    });
    return S.ownerP;
  }
  function loadRows(force) {
    if (!S.owner) { S.rows = []; return Promise.resolve([]); }
    if (S.rowsP) return S.rowsP;
    if (!force && S.rows && Date.now() - S.rowsAt < 30000) return Promise.resolve(S.rows);
    var since = new Date(Date.now() - 21 * 86400000).toISOString();
    S.rowsP = Promise.all([
      q(db.from('mybox_mail').select('id, gmail_id, thread_id, received_at, from_email, from_name, subject, snippet, label_id, label_name, label_conf, labelled_at, archived, team, team_conf, team_state, sent_mail_id, sent_at, reply_p, reply_state, draft_id, drafted_at, state, error').eq('skipped', false).gte('received_at', since).order('received_at', { ascending: false }).limit(300)),
      q(db.from('mybox_mail').select('id', { count: 'exact', head: true }).eq('skipped', true).gte('created_at', since))
    ]).then(function (r) {
      var rows = Array.isArray(r[0].data) ? r[0].data : (S.rows || []);
      S.rows = rows.filter(function (x) { return x.state !== 'error'; });
      S.errors = rows.filter(function (x) { return x.state === 'error'; }).length;
      S.skipped = (r[1] && typeof r[1].count === 'number') ? r[1].count : S.skipped;
      S.rowsAt = Date.now(); S.rowsP = null;
      return S.rows;
    });
    return S.rowsP;
  }
  function fnError(r) {
    return Promise.resolve().then(function () {
      if (r && r.error && r.error.context && typeof r.error.context.json === 'function') return r.error.context.json().then(function (j) { return (j && j.error) || r.error.message || ''; }, function () { return r.error.message || ''; });
      return (r && r.error && r.error.message) || (r && r.data && r.data.error) || '';
    });
  }
  /* the mybox function: resolves to the answer, or rejects with the reason in plain words */
  function fn(body) {
    return q(db.functions.invoke('mybox', { body: body })).then(function (r) {
      if (r && !r.error && r.data && !r.data.error) return r.data;
      return fnError(r).then(function (msg) { throw new Error(msg || 'The assistant did not answer just now'); });
    });
  }
  function toReply() { return (S.rows || []).filter(function (x) { return Number(x.reply_p) >= REPLY_P && !x.reply_state; }); }
  function repliedDone() { return (S.rows || []).filter(function (x) { return Number(x.reply_p) >= REPLY_P && x.reply_state; }); }
  function forTeam() { return (S.rows || []).filter(function (x) { return x.team && !x.team_state; }); }
  function teamDone() { return (S.rows || []).filter(function (x) { return x.team && x.team_state; }); }
  function sortedToday() { var t = todayIso(); return (S.rows || []).filter(function (x) { return x.labelled_at && dayOf(x.labelled_at) === t; }); }
  function rowBy(gid) { return (S.rows || []).filter(function (x) { return x.gmail_id === gid; })[0] || null; }
  function patchRow(gid, p) { var r = rowBy(gid); if (r) Object.keys(p).forEach(function (k) { r[k] = p[k]; }); }
  function teamPeople(team) {
    try { return (typeof DB_MEMBERS !== 'undefined' ? DB_MEMBERS : []).filter(function (m) { return m && m.active !== false && m.department === team && m.email; }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); }); } catch (e) { return []; }
  }

