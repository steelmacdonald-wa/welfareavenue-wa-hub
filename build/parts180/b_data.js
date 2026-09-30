  /* ---------- who is looking (the same rules as the database: wa180_can_post, wa180_for_me, wa180_manages) ---------- */
  function q(p) { return Promise.resolve(p).then(function (r) { return r || { data: null }; }, function (e) { return { data: null, error: e }; }); }
  function role() { try { return (typeof WA40_MINE !== 'undefined' && WA40_MINE && WA40_MINE.role) || ''; } catch (e) { return ''; } }
  function profile() { try { return (typeof WA40_MINE !== 'undefined' && WA40_MINE && WA40_MINE.profile) || ''; } catch (e) { return ''; } }
  function staff() { try { return typeof isStaff !== 'function' || isStaff(); } catch (e) { return true; } }
  function isAdmin() { return role() === 'admin'; }
  function isLeader() { var r = role(); return r === 'admin' || r === 'leader'; }
  function isHr() { var r = role(); return profile() === 'hr' && r !== 'blocked' && r !== 'viewer'; }
  function manager() { return isLeader() || isHr(); }
  function canPost() { return staff() && (isLeader() || isHr()); }
  function myEmail() { try { return lower((typeof USER !== 'undefined' && USER && USER.email) || ''); } catch (e) { return ''; } }
  function meRow() { try { return (typeof wa28Me === 'function') ? wa28Me() : null; } catch (e) { return null; } }
  function meName() { var m = meRow(); if (m && m.name) return m.name; try { return (USER && USER.name) || myEmail().split('@')[0]; } catch (e) { return myEmail().split('@')[0]; } }
  function myEmails() { var out = [myEmail()], m = meRow(); if (m && m.email) out.push(lower(m.email)); return out.filter(Boolean); }
  function members() { try { return (typeof DB_MEMBERS !== 'undefined' ? DB_MEMBERS : []).filter(function (m) { return m && m.active !== false; }); } catch (e) { return []; } }
  function myTeams() {
    var out = [], em = myEmails();
    members().forEach(function (m) { if (m.department && m.email && em.indexOf(lower(m.email)) >= 0 && out.indexOf(m.department) < 0) out.push(m.department); });
    var me = meRow(); if (me && me.department && out.indexOf(me.department) < 0) out.push(me.department);
    return out;
  }
  function postTeams() { if (isAdmin() || isHr()) return ALL_TEAMS.slice(); if (isLeader()) return myTeams().filter(function (t) { return ALL_TEAMS.indexOf(t) >= 0; }); return []; }
  function teamName(d) {
    if (d === 'exec') return 'Executive team'; if (d === 'board') return 'Board';
    try { return (window.WA_TEAMS && WA_TEAMS.label && WA_TEAMS.label[d]) || (typeof DEPT_LABEL !== 'undefined' && DEPT_LABEL[d]) || d || ''; } catch (e) { return d || ''; }
  }
  function nameFor(email) {
    var em = lower(email); if (!em) return 'Someone';
    var m = members().filter(function (x) { return lower(x.email) === em; })[0];
    return (m && m.name) || em.split('@')[0].split('.').map(function (s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }).join(' ');
  }
  function mine(a) { return myEmails().indexOf(lower(a.created_by)) >= 0; }
  function manages(a) { return manager() || mine(a); }
  function forMe(a) {
    if (mine(a)) return true;
    if (a.audience === 'everyone' || !a.audience) return staff();   /* everyone is the team: board viewers see what is for the board */
    if (a.audience === 'leaders') return isLeader();
    var t = a.teams || [], mt = myTeams();
    if (t.some(function (x) { return mt.indexOf(x) >= 0; })) return true;
    return t.indexOf('board') >= 0 && !staff();
  }
  function live(a) { return !a.expires_at || String(a.expires_at).slice(0, 10) > todayIso(); }
  function closed(a) { return !!(a.closes_at && new Date(a.closes_at).getTime() <= Date.now()); }
  function openAsk(a) { return !!(a && a.ask && !closed(a) && live(a)); }
  function answered(a) { return !!S.mine[a.id]; }
  function audienceLabel(a) {
    if (a.audience === 'leaders') return 'Leaders';
    if (a.audience === 'teams') return (a.teams || []).map(teamName).join(', ') || 'Some teams';
    return 'Everyone';
  }
  function kindOf(a) { return a.ask ? (a.ask.type === 'poll' ? 'poll' : 'form') : 'news'; }

  /* ---------- the data: the announcements this person may see, and their own answers ---------- */
  var COLS = 'id, kind, title, body, department, link, pinned, happened_at, expires_at, created_by, created_name, created_at, audience, teams, ask, anonymous, show_results, closes_at, post_slack, slack';
  function load(force) {
    if (S.listP) return S.listP;
    if (!force && S.list && Date.now() - S.listAt < 45000) return Promise.resolve(S.list);
    S.listP = Promise.all([
      q(db.from('hub_announcements').select(COLS).order('created_at', { ascending: false }).limit(80)),
      q(db.from('hub_announcement_answers').select('announcement_id, answers, updated_at').limit(500))
    ]).then(function (r) {
      if (Array.isArray(r[0].data)) S.list = r[0].data; else if (!S.list) S.list = [];
      if (Array.isArray(r[1].data)) { var m = {}; r[1].data.forEach(function (x) { m[x.announcement_id] = x.answers; }); S.mine = m; }
      S.listAt = Date.now(); S.listP = null;
      return S.list;
    });
    return S.listP;
  }
  function byId(id) { return (S.list || []).filter(function (a) { return String(a.id) === String(id); })[0] || null; }
  function loadOne(id) {
    var a = byId(id); if (a) return Promise.resolve(a);
    return q(db.from('hub_announcements').select(COLS).eq('id', Number(id)).maybeSingle()).then(function (r) {
      var x = r && r.data && !Array.isArray(r.data) ? r.data : (r && Array.isArray(r.data) ? r.data[0] : null);
      if (x) { (S.list = S.list || []).push(x); return x; }
      return null;
    });
  }
  function cleanErr(m) { return String(m || 'Something went wrong').replace(/^.*?ERROR:\s*/, '').replace(/\s*CONTEXT:[\s\S]*$/, ''); }
  function results(id, force) {
    var c = S.res[id];
    if (!force && c && Date.now() - c.__at < 20000) return Promise.resolve(c);
    return q(db.rpc('wa180_results', { p_id: Number(id) })).then(function (r) {
      var v = r && r.data; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
      if (v && v.ok) { v.__at = Date.now(); S.res[id] = v; if (v.mine) S.mine[id] = v.mine; return v; }
      return { ok: false, error: (v && v.error) || cleanErr(r && r.error && r.error.message) || 'The results did not load.' };
    });
  }
  function answer(id, answers) {
    return q(db.rpc('wa180_answer', { p_id: Number(id), p_answers: answers })).then(function (r) {
      if (r && r.error) throw new Error(cleanErr(r.error.message || r.error.details));
      var v = r && r.data; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
      if (!v || !v.ok) throw new Error('The answer did not go through. Try again.');
      S.mine[id] = v.answers || answers; S.just[id] = true;
      if (v.results && v.results.ok) { v.results.__at = Date.now(); S.res[id] = v.results; }
      return v;
    });
  }
  function patch(id, p) {
    return q(db.from('hub_announcements').update(p).eq('id', Number(id))).then(function (r) {
      if (r && r.error) throw new Error(cleanErr(r.error.message));
      var a = byId(id); if (a) Object.keys(p).forEach(function (k) { a[k] = p[k]; });
      return a;
    });
  }

