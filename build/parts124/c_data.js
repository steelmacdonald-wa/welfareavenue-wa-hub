
  /* ---------- state ---------- */
  var C = {
    view: lsGet('w124view') === 'agenda' ? 'agenda' : 'month', anchor: monthStart(today()),
    layers: (function () { var o = {}; LAYERS.forEach(function (x) { o[x.k] = true; }); try { var s = JSON.parse(lsGet('w124layers') || 'null'); if (s && typeof s === 'object') Object.keys(s).forEach(function (k) { if (k in o) o[k] = !!s[k]; }); } catch (e) { /* fine */ } return o; })(),
    fund: [], goals: null, bdays: [], projects: [], boardMeets: [], loadedBase: 0, loadingBase: null,
    range: {}, meetings: [], posts: [], planned: [], vol: [], rangeKey: '', loadingRange: null,
    sheet: null, mine: null, idx: {}, scrollOnce: true
  };
  function members() { try { return (typeof DB_MEMBERS !== 'undefined' && DB_MEMBERS) || []; } catch (e) { return []; } }
  function me() {
    var email = ''; try { email = lower((typeof USER !== 'undefined' && USER && USER.email) || ''); } catch (e) { email = ''; }
    var name = ''; try { name = (typeof who === 'function') ? String(who() || '') : ''; } catch (e) { name = ''; }
    var m = members().filter(function (x) { return email && lower(x.email) === email; })[0] || null;
    return { email: email, name: name || (m && m.name) || (email ? email.split('@')[0] : ''), dept: m ? m.department : null, id: m ? m.id : null };
  }
  function role() { try { return (typeof WA40_MINE !== 'undefined' && WA40_MINE && WA40_MINE.role) || ''; } catch (e) { return ''; } }
  function staffOk() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  function boardOk() { try { return typeof MODE !== 'undefined' && MODE === 'board'; } catch (e) { return false; } }
  function isLeader() { var r = role(); return r === 'admin' || r === 'leader'; }
  function canEditFund() { if (!staffOk()) return false; if (isLeader()) return true; return me().dept === 'fundraising'; }
  function memberByEmail(em) { em = lower(em); return members().filter(function (m) { return lower(m.email) === em; })[0] || null; }
  function q(p) { return Promise.resolve(p).then(function (r) { return r || { data: null }; }, function (e) { return { data: null, error: e }; }); }

  /* ---------- the always-there data: fundraising events, goals, birthdays ---------- */
  async function loadBase(force) {
    if (C.loadingBase) return C.loadingBase;
    if (C.loadedBase && !force && Date.now() - C.loadedBase < 60000) return;
    C.loadingBase = (async function () {
      var a = await Promise.all([
        q(db.from('fund_events').select('*').order('sort').order('start_date')),
        q(db.from('hub_settings').select('value').eq('key', 'fund_goals').maybeSingle()),
        staffOk() ? q(db.from('hub_birthdays').select('*')) : Promise.resolve({ data: [] }),
        staffOk() ? q(db.from('projects').select('id, name, department, status, parent_id').eq('department', 'fundraising')) : Promise.resolve({ data: [] }),
        staffOk() || boardOk() ? q(db.from('board_meetings').select('id, meets_at, kind, title, status, agenda_url, notes_url, note').order('meets_at')) : Promise.resolve({ data: [] })
      ]);
      if (a[0].data) C.fund = a[0].data;
      C.goals = (a[1].data && a[1].data.value) || C.goals || { minimum: 10000, healthy: 15000, target: 20000, notes: [], planning: [] };
      if (a[2].data) C.bdays = a[2].data;
      if (a[3].data) C.projects = a[3].data;
      if (Array.isArray(a[4].data)) C.boardMeets = a[4].data.filter(function (m) { return m && m.meets_at && lower(m.status) !== 'cancelled'; });
      C.loadedBase = Date.now();
    })();
    try { await C.loadingBase; } finally { C.loadingBase = null; }
  }
  function hasBoard() { return C.boardMeets.length > 0; }
  function myBirthday() { var em = me().email; return C.bdays.filter(function (b) { return lower(b.email) === em; })[0] || null; }

  /* ---------- the range data: meetings, posts, servings ---------- */
  function rangeFor() {
    var from, to;
    if (C.view === 'month') { var s = monthStart(C.anchor); var dow = (s.getDay() + 6) % 7; from = addDays(s, -dow); to = addDays(from, 42); }
    else { from = monthStart(C.anchor); to = addMonths(C.anchor, 1); }
    var t = today(); var sideTo = addDays(t, 35);
    var f = from < t ? from : t, e = to > sideTo ? to : sideTo;
    return { from: from, to: to, qFrom: mk(f.getFullYear(), f.getMonth(), f.getDate(), 0), qTo: mk(e.getFullYear(), e.getMonth(), e.getDate() + 1, 0) };
  }
  async function loadRange() {
    var r = rangeFor(); var key = ymd(r.qFrom) + '/' + ymd(r.qTo);
    if (C.rangeKey === key) return;
    if (C.loadingRange && C.loadingKey === key) return C.loadingRange;
    C.loadingKey = key;
    C.loadingRange = (async function () {
      var fromIso = r.qFrom.toISOString(), toIso = r.qTo.toISOString();
      var a = await Promise.all([
        q(db.rpc('calendar_my_meetings', { p_from: fromIso, p_to: toIso })),
        staffOk() || boardOk() ? q(db.from('social_posts').select('id, platform, url, kind, caption, published_at, views, likes, comments').gte('published_at', fromIso).lt('published_at', toIso).in('platform', ['instagram', 'facebook', 'linkedin', 'tiktok']).order('published_at').limit(400)) : Promise.resolve({ data: [] }),
        staffOk() || boardOk() ? q(db.from('content_posts').select('id, title, platforms, format, scheduled_at, status, published_at, campaign, owner').gte('scheduled_at', fromIso).lt('scheduled_at', toIso).order('scheduled_at').limit(300)) : Promise.resolve({ data: [] }),
        staffOk() ? q(db.from('volunteer_events').select('id, code, event_date, title, kind, location, status, planned_meals').gte('event_date', ymd(r.qFrom)).lt('event_date', ymd(r.qTo)).order('event_date').limit(200)) : Promise.resolve({ data: [] })
      ]);
      var meet = a[0].data;
      if (!Array.isArray(meet) || a[0].error) meet = await myMeetingsFallback(fromIso, toIso);
      C.meetings = meet || [];
      C.posts = (a[1].data || []).filter(function (p) { return p.published_at && p.published_at >= fromIso && p.published_at < toIso; });
      C.planned = (a[2].data || []).filter(function (p) { return p.scheduled_at && ['published', 'live', 'cancelled', 'deleted'].indexOf(lower(p.status)) < 0; });
      C.vol = (a[3].data || []).filter(function (v) { return v.event_date && v.event_date >= ymd(r.qFrom) && v.event_date < ymd(r.qTo); });
      C.rangeKey = key;
    })();
    try { await C.loadingRange; } finally { C.loadingRange = null; }
  }
  /* before calendar_my_meetings exists (or in the offline harness): the same filter on this side */
  async function myMeetingsFallback(fromIso, toIso) {
    var res = await q(db.from('hub_events').select('*').gte('start_at', fromIso).lt('start_at', toIso).order('start_at').limit(500));
    var em = me().email; if (!em) return [];
    var keys = [em, em.split('@')[0].replace(/\./g, '') + '@' + em.split('@')[1]];
    return (res.data || []).filter(function (e) {
      var st = new Date(e.start_at).getTime(); if (!(st >= new Date(fromIso).getTime() && st < new Date(toIso).getTime())) return false;
      if (lower(e.status) === 'cancelled') return false;
      var att = (e.attendee_emails || []).map(lower);
      return keys.indexOf(lower(e.organizer)) >= 0 || att.some(function (x) { return keys.indexOf(x) >= 0; });
    });
  }

  /* ---------- items ---------- */
  function fundWhen(f) {
    var s = parseDay(f.start_date), e = parseDay(f.end_date);
    if (f.precision === 'day' && s) return e && !sameDay(s, e) ? fmtDate(s, { month: 'short', day: 'numeric' }) + ' to ' + fmtDate(e, { month: 'short', day: 'numeric', year: 'numeric' }) : fmtDate(s, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (f.precision === 'month' && s) return MONTHS[s.getMonth()] + ' ' + s.getFullYear();
    if (f.precision === 'season' && s) return (f.timing ? f.timing.replace(/\s*\(([^)]*)\)$/, '') : 'Season') + ' ' + s.getFullYear() + (/\(([^)]*)\)$/.test(f.timing || '') ? ' (' + /\(([^)]*)\)$/.exec(f.timing)[1] + ')' : '');
    if (f.precision === 'range' && s && e) { var yrs = s.getFullYear() === e.getFullYear() ? ' ' + e.getFullYear() : ''; return (f.timing ? f.timing + yrs : MONTHS[s.getMonth()].slice(0, 3) + ' ' + (yrs ? '' : s.getFullYear() + ' ') + 'to ' + MONTHS[e.getMonth()].slice(0, 3) + ' ' + e.getFullYear()); }
    return f.timing || (f.precision === 'flexible' ? 'Flexible' : 'Not yet scheduled');
  }
  function items(from, to) {
    var out = [], L = C.layers, t0 = today();
    if (L.fund) C.fund.forEach(function (f) {
      if (f.precision !== 'day' || f.status === 'cancelled') return;
      var s = parseDay(f.start_date); if (!s) return; var e = parseDay(f.end_date) || s;
      for (var d = new Date(s.getTime()); d <= e; d = addDays(d, 1)) if (d >= from && d < to) out.push({ k: 'fund', id: 'f' + f.id, ref: f, day: ymd(d), allDay: true, title: f.title, sub: f.partners || '', past: d < t0 });
    });
    if (L.meet) C.meetings.forEach(function (m) {
      var s = new Date(m.start_at); if (isNaN(s.getTime())) return;
      var local = mk(s.getFullYear(), s.getMonth(), s.getDate(), 12);
      if (local < from || local >= to) return;
      out.push({ k: 'meet', id: 'm' + m.id, ref: m, day: ymd(local), at: s, allDay: !!m.all_day, time: m.all_day ? '' : fmtTime(s), title: m.summary || 'Meeting', sub: m.location || '', past: new Date(m.end_at || m.start_at) < new Date() });
    });
    if (L.post) {
      C.posts.forEach(function (p) { var s = new Date(p.published_at); var local = mk(s.getFullYear(), s.getMonth(), s.getDate(), 12); if (local < from || local >= to) return; out.push({ k: 'post', id: 'p' + p.id, ref: p, day: ymd(local), at: s, time: fmtTime(s), title: (PLATFORM[p.platform] || p.platform) + ': ' + clip(p.caption || 'Post', 60), sub: 'Published', past: true }); });
      C.planned.forEach(function (p) { var s = new Date(p.scheduled_at); var local = mk(s.getFullYear(), s.getMonth(), s.getDate(), 12); if (local < from || local >= to) return; out.push({ k: 'post', id: 'c' + p.id, ref: p, planned: true, day: ymd(local), at: s, time: fmtTime(s), title: p.title || 'Planned post', sub: (p.status ? p.status.charAt(0).toUpperCase() + p.status.slice(1) : 'Planned') + ((p.platforms || []).length ? ' for ' + p.platforms.map(function (x) { return PLATFORM[x] || x; }).join(', ') : ''), past: s < new Date() }); });
    }
    if (L.vol) C.vol.forEach(function (v) {
      var d = parseDay(v.event_date); if (!d || d < from || d >= to) return;
      var kind = lower(v.kind || 'service');
      out.push({ k: 'vol', id: 'v' + v.id, ref: v, day: ymd(d), allDay: true, title: v.title || (kind === 'service' ? (d.getDay() === 0 ? 'Sunday serving' : 'Serving') : kind.charAt(0).toUpperCase() + kind.slice(1)) + (v.location ? ', ' + v.location : ''), sub: v.location || '', cancelled: lower(v.status) === 'cancelled', past: d < t0 });
    });
    if (L.board && hasBoard()) {
      C.boardMeets.forEach(function (m) {
        var s = new Date(m.meets_at); if (isNaN(s.getTime())) return;
        var local = mk(s.getFullYear(), s.getMonth(), s.getDate(), 12);
        if (local >= from && local < to) out.push({ k: 'board', id: 'bm' + m.id, ref: m, day: ymd(local), at: s, time: fmtTime(s), title: m.title || 'Board meeting', sub: lower(m.status) === 'tentative' ? 'Tentative' : '', past: s < new Date() });
        /* the committees meet the week before a board meeting that is still ahead */
        var due = addDays(local, -7);
        if (local >= t0 && due >= from && due < to) out.push({ k: 'board', id: 'bc' + m.id, ref: m, cm: true, day: ymd(due), allDay: true, title: 'Committee meetings due', sub: 'A week before the ' + (m.title || 'board meeting'), past: due < t0 });
      });
      /* the fiscal year ends on September 30 */
      for (var fy = from.getFullYear(); fy <= to.getFullYear(); fy++) {
        var fe = mk(fy, 8, 30, 12);
        if (fe >= from && fe < to) out.push({ k: 'board', id: 'fy' + fy, fy: fy, day: ymd(fe), allDay: true, title: 'Fiscal year ends', sub: 'FY' + fy + ' closes', past: fe < t0 });
      }
    }
    if (L.bday) C.bdays.forEach(function (b) {
      for (var y = from.getFullYear(); y <= to.getFullYear(); y++) {
        var d = mk(y, b.month - 1, b.day, 12); if (d.getMonth() !== b.month - 1) continue;
        if (d < from || d >= to) continue;
        var m = memberByEmail(b.email); var nm = m ? m.name : b.email.split('@')[0];
        out.push({ k: 'bday', id: 'b' + b.email + y, ref: b, person: m, day: ymd(d), allDay: true, title: nm + '’s birthday', sub: '', past: d < t0, mine: lower(b.email) === me().email });
      }
    });
    out.sort(function (a, b) { if (a.day !== b.day) return a.day < b.day ? -1 : 1; var ra = a.allDay ? 0 : 1, rb = b.allDay ? 0 : 1; if (ra !== rb) return ra - rb; return (a.at ? a.at.getTime() : 0) - (b.at ? b.at.getTime() : 0); });
    return out;
  }
  /* month-long, range and season fundraising events that overlap a window: the band over the grid */
  function bands(from, to) {
    if (!C.layers.fund) return [];
    return C.fund.filter(function (f) {
      if (['month', 'range', 'season'].indexOf(f.precision) < 0 || f.status === 'cancelled') return false;
      var s = parseDay(f.start_date), e = parseDay(f.end_date) || s; if (!s) return false;
      return s < to && e >= from;
    });
  }
