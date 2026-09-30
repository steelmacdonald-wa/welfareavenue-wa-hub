  /* ---------- data ---------- */
  function q(p) { return Promise.resolve(p).then(function (r) { return r || { data: null }; }, function (e) { return { data: null, error: e }; }); }
  /* the Academy's trainings and Learning Avenues (the Academy's own copy when it has loaded, else a light read) */
  function loadCatalog(force) {
    var A = (window.w122 && w122.A) || null;
    if (!force && A && A.trainings && A.trainings.length) { S.tr = A.trainings; S.paths = A.paths || S.paths; if (S.paths) return Promise.resolve(); }
    if (S.catP) return S.catP;
    if (!force && S.tr && S.paths && Date.now() - S.catAt < 300000) return Promise.resolve();
    S.catP = Promise.all([
      q(db.from('trainings').select('id, title, kind, path_group, minutes, category, sort, active, key, body').eq('active', true).order('sort').order('id')),
      q(db.from('academy_paths').select('key, name, title, dept, required, sort, active, color').eq('active', true).order('sort'))
    ]).then(function (r) {
      if (Array.isArray(r[0].data)) S.tr = r[0].data;
      if (Array.isArray(r[1].data)) S.paths = r[1].data;
      S.catAt = Date.now(); S.catP = null;
    });
    return S.catP;
  }
  function trById(id) { return (S.tr || []).filter(function (t) { return String(t.id) === String(id); })[0] || null; }
  function pathByKey(k) { return (S.paths || []).filter(function (p) { return p.key === k; })[0] || null; }
  function planned(t) { try { var b = typeof t.body === 'string' ? JSON.parse(t.body) : t.body; return !!(b && b.planned); } catch (e) { return false; } }
  function pathModules(p) {
    if (!p) return [];
    return (S.tr || []).filter(function (t) { return t.path_group === p.name && t.active !== false && String(t.kind || '') !== 'tour' && !planned(t); });
  }
  /* what can be assigned: any module people can finish (videos, lessons, reading, documents, SOPs); page tours are not (the
     Hub first steps cover them, and not every page is open to everyone) */
  function assignable(t) { return !!t && t.active !== false && !planned(t) && String(t.kind || '') !== 'tour'; }
  function kindOfT(t) { try { if (window.w122 && typeof w122.kindOf === 'function') return w122.kindOf(t); } catch (e) { /* fine */ } return String((t && t.kind) || 'read'); }
  var KIND_L = { video: 'Video', lesson: 'Lesson', read: 'Reading', doc: 'Document', sop: 'SOP', tour: 'Page tour' };
  function kindLabel(t) { return KIND_L[kindOfT(t)] || 'Module'; }
  function minsOf(t) { var n = Number(t && t.minutes); return n > 0 ? n : 0; }
  /* the modules an assignment of v ('t:<id>' or 'p:<key>') covers, as wa169_modules counts them */
  function modulesOf(v) {
    v = String(v || '');
    if (v.indexOf('t:') === 0) { var t = trById(v.slice(2)); return t ? [t] : []; }
    if (v.indexOf('p:') === 0) return pathModules(pathByKey(v.slice(2)));
    return [];
  }
  function titleOf(v) {
    v = String(v || '');
    if (v.indexOf('t:') === 0) { var t = trById(v.slice(2)); return t ? t.title : 'A module'; }
    var p = pathByKey(v.slice(2)); return p ? (p.title || p.name) : 'A Learning Avenue';
  }
  /* who has already finished a module (the Academy's own rows: done by name or by email) */
  function doneSet() {
    var out = {}, prog = (window.w122 && w122.A && w122.A.prog) || [];
    prog.forEach(function (p) { if (p.status === 'done') { out[String(p.training_id) + '|' + lower(p.person_name)] = 1; if (p.email) out[String(p.training_id) + '|' + lower(p.email)] = 1; } });
    return out;
  }
  /* the assignments with each person's progress (HR, leaders and admins) */
  function loadList(force) {
    if (!canAssign()) { S.list = []; return Promise.resolve([]); }
    if (S.listP) return S.listP;
    if (!force && S.list && Date.now() - S.listAt < 60000) return Promise.resolve(S.list);
    S.listP = q(db.rpc('academy_assignments_list')).then(function (r) {
      var v = r && r.data; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
      S.list = Array.isArray(v) ? v : (S.list || []); S.listAt = Date.now(); S.listP = null; return S.list;
    });
    return S.listP;
  }
  /* what people see each week (app_config.onboarding_journey), the journey's own copy when it has one */
  function loadCfg(force) {
    if (!force && S.cfg && Date.now() - S.cfgAt < 120000) return Promise.resolve(S.cfg);
    if (S.cfgP) return S.cfgP;
    S.cfgP = q(db.from('app_config').select('value').eq('key', 'onboarding_journey')).then(function (r) {
      var v = r && r.data && r.data[0] && r.data[0].value;
      if (v) { try { S.cfg = typeof v === 'string' ? JSON.parse(v) : v; } catch (e) { /* keep */ } }
      if (!S.cfg && window.w167 && typeof w167.cfg === 'function') S.cfg = w167.cfg();
      S.cfgAt = Date.now(); S.cfgP = null; return S.cfg;
    });
    return S.cfgP;
  }
  function weekCfg(section) {
    var c = S.cfg || (window.w167 && typeof w167.cfg === 'function' ? w167.cfg() : null) || {};
    var w = (c.weeks && c.weeks[section]) || null;
    if (!w && window.w167 && typeof w167.cfg === 'function') { var d = w167.cfg(); w = (d.weeks && d.weeks[section]) || null; }
    return w;
  }
  /* the Photo library's ready photos, for a week's photo */
  function loadPhotos() {
    if (S.photos) return Promise.resolve(S.photos);
    if (S.photosP) return S.photosP;
    S.photosP = q(db.from('wa_photos').select('id, title, alt_text, path_web, path_thumb, focal_x, focal_y, orientation, usage, is_pick, taken_on').eq('usage', 'ready')).then(function (r) {
      var rows = ((r && r.data) || []).filter(function (p) { return p.path_web && p.orientation !== 'portrait'; });
      rows.sort(function (a, b) { return (b.is_pick ? 1 : 0) - (a.is_pick ? 1 : 0) || String(b.taken_on || '').localeCompare(String(a.taken_on || '')); });
      S.photos = rows; S.photosP = null; return rows;
    });
    return S.photosP;
  }
  /* my assignments: the assignments that name me (readable to me) and my rows that carry them */
  function loadMine(force) {
    if (S.mineP) return S.mineP;
    if (!force && S.mine && Date.now() - S.mineAt < 60000) return Promise.resolve(S.mine);
    S.mineP = q(db.from('academy_assignments').select('*').eq('active', true)).then(function (r) {
      S.mine = Array.isArray(r && r.data) ? r.data : (S.mine || []); S.mineAt = Date.now(); S.mineP = null; return S.mine;
    });
    return S.mineP;
  }
  /* who an assignment reaches, as the database counts it (wa169_targets): active people with a sign-in; everyone leaves out the board */
  function targetsOf(aud, teamKeys, emails) {
    var ms = members();
    if (aud === 'everyone') return ms.filter(function (m) { return m.department !== 'board'; });
    if (aud === 'team') return ms.filter(function (m) { return teamKeys.indexOf(m.department) >= 0; });
    return ms.filter(function (m) { return emails.indexOf(lower(m.email)) >= 0; });
  }

