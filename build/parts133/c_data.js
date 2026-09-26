
  /* ---------- the data: org_positions and who may change them ---------- */
  function rpc(fn, args) {
    return Promise.resolve(db.rpc(fn, args || {})).then(function (r) { if (r && r.error) throw r.error; return r ? r.data : null; });
  }
  function load(force) {
    if (O.loading) return O.loading;
    if (!force && O.pos && Date.now() - O.at < 30000) return Promise.resolve(O.pos);
    O.loading = Promise.all([
      Promise.resolve(db.from('org_positions').select('*').order('sort').order('id')),
      rpc('wa_org_editor').catch(function () { return false; })
    ]).then(function (res) {
      var r = res[0];
      if (r && r.error) throw r.error;
      O.pos = (r && r.data) || [];
      O.canEdit = res[1] === true;
      O.at = Date.now(); O.err = ''; O.loading = null; O.ver++;
      return O.pos;
    }).catch(function (e) { O.loading = null; O.err = errText(e); if (!O.pos) O.pos = null; throw e; });
    return O.loading;
  }
  function errText(e) {
    var m = String((e && (e.message || e.details || e.hint)) || e || '').replace(/^.*?ERROR:\s*/, '');
    if (/only executives and admins/i.test(m)) return 'Only executives and admins can change the chart.';
    if (/reports to them/i.test(m)) return 'Someone cannot report to a person who reports to them.';
    if (/stay at the top/i.test(m)) return 'The executive directors stay at the top of the chart.';
    if (/already filled/i.test(m)) return 'That position is already filled.';
    if (/already on the chart/i.test(m)) return 'They are already on the chart.';
    if (/off the seat first/i.test(m)) return 'Take the person off the seat first.';
    if (/give the position a title/i.test(m)) return 'Give the position a title.';
    if (/fetch|network|Failed to/i.test(m)) return 'Could not reach the Hub. Nothing changed. Try again.';
    return m || 'Something went wrong. Nothing changed.';
  }

  /* ---------- reading the chart ---------- */
  function ix() {
    var byId = {}, kids = {}, seatOf = {};
    (O.pos || []).forEach(function (p) { byId[p.id] = p; if (p.member_id != null) seatOf[p.member_id] = p; });
    (O.pos || []).forEach(function (p) { var k = p.reports_to == null ? 'top' : String(p.reports_to); (kids[k] = kids[k] || []).push(p); });
    Object.keys(kids).forEach(function (k) { kids[k].sort(seatOrder); });
    return { byId: byId, kids: kids, seatOf: seatOf };
  }
  function holder(p) { return p && p.member_id != null ? memberById(p.member_id) : null; }
  function isOpen(p) { return !holder(p); }
  function seatName(p) { var m = holder(p); return m ? m.name : 'Open position'; }
  function seatTeam(p) { var m = holder(p); return (m && m.department) || p.department || ''; }
  function seatOrder(a, b) {
    var oa = isOpen(a) ? 1 : 0, ob = isOpen(b) ? 1 : 0;
    if (oa !== ob) return oa - ob;
    if ((a.sort || 100) !== (b.sort || 100)) return (a.sort || 100) - (b.sort || 100);
    return lower(seatName(a) + a.title).localeCompare(lower(seatName(b) + b.title));
  }
  function execs(X) { return (O.pos || []).filter(function (p) { return p.kind === 'exec'; }).sort(seatOrder); }
  function isExec(p) { return !!p && p.kind === 'exec'; }
  /* the seats at the head of the teams: reporting to both executive directors, or to one of them */
  function heads(X) { return (O.pos || []).filter(function (p) { return p.kind !== 'exec' && (p.reports_to == null || isExec(X.byId[p.reports_to])); }).sort(seatOrder); }
  function kidsOf(X, p) { return (X.kids[String(p.id)] || []).filter(function (k) { return O.showOpen || !isOpen(k); }); }
  /* is node inside root's part of the chart (root included) */
  function isUnder(X, node, root) { var seen = {}, cur = X.byId[node]; while (cur && !seen[cur.id]) { if (String(cur.id) === String(root)) return true; seen[cur.id] = 1; cur = cur.reports_to == null ? null : X.byId[cur.reports_to]; } return false; }
  function managerLabel(X, p) {
    if (!p) return '';
    if (p.kind === 'exec') return 'the board';
    if (p.reports_to == null) return 'the executive directors';
    var g = X.byId[p.reports_to]; return g ? (holder(g) ? holder(g).name : 'an open position (' + g.title + ')') : 'the executive directors';
  }
  function mgrShort(X, p) {
    if (!p) return '';
    if (p.kind === 'exec') return 'the board';
    if (p.reports_to == null) return 'the co-EDs';
    var g = X.byId[p.reports_to]; return g ? (holder(g) ? first(holder(g).name) : 'an open position') : 'the co-EDs';
  }
  function countUnder(X, p) { var n = 0, st = (X.kids[String(p.id)] || []).slice(), seen = {}; while (st.length) { var k = st.pop(); if (seen[k.id]) continue; seen[k.id] = 1; n++; (X.kids[String(k.id)] || []).forEach(function (c) { st.push(c); }); } return n; }
  function unplaced(X) { return members().filter(function (m) { return m.department !== 'board' && !X.seatOf[m.id]; }).sort(function (a, b) { return lower(a.name).localeCompare(lower(b.name)); }); }
  function boardPeople(X) { return members().filter(function (m) { return m.department === 'board' && !X.seatOf[m.id]; }).sort(function (a, b) { return lower(a.name).localeCompare(lower(b.name)); }); }

  /* ---------- the changes (the database checks each one and logs it) ---------- */
  async function after(msg, undo) {
    await load(true);
    paint();
    try { if (O.sheet) renderSheet(); } catch (e) { /* fine */ }
    if (msg) snack(msg, undo ? [['Undo', undo]] : []);
  }
  async function move(p, toId, dept, quiet) {
    var X = ix(), was = p.reports_to;
    await rpc('org_move', { p_id: Number(p.id), p_reports_to: toId == null ? null : Number(toId), p_department: dept || null });
    var nm = seatName(p), to = toId == null ? 'the executive directors' + (dept ? ' (' + teamShort(dept) + ')' : '') : seatName(X.byId[toId]);
    if (!quiet) await after(nm + ' now reports to ' + to + '.', function () { return move(p, was, null, true).then(function () { toastS('Moved back'); hideSnack(); }).catch(function (e) { toastS(errText(e)); }); });
    else await after(null);
  }
  async function setReports(p, ids) {
    var res = await rpc('org_set_reports', { p_id: Number(p.id), p_reports: ids.map(Number) });
    await after(null);
    toastS('Direct reports saved' + (res && res.moved_up ? ' (' + plural(res.moved_up, 'person moves', 'people move') + ' up a level)' : ''));
  }
  async function addOpening(toId, f) {
    var res = await rpc('org_add_opening', { p_reports_to: toId == null ? null : Number(toId), p_title: f.title, p_department: f.dept || null, p_status: f.status || 'open', p_note: f.note || null });
    await after(null);
    toastS('Open position added');
    return res;
  }
  async function updateSeat(p, f) {
    await rpc('org_update', { p_id: Number(p.id), p_title: f.title, p_status: f.status || null, p_note: f.note == null ? null : f.note, p_department: f.dept || null });
    var m = holder(p); if (m && f.title) m.role = f.title;
    await after(null);
    toastS('Saved');
  }
  async function fill(p, memberId) {
    var m = memberById(memberId);
    var res = await rpc('org_fill', { p_id: Number(p.id), p_member_id: Number(memberId) });
    if (m && p.title) m.role = p.title;
    await after((m ? m.name : 'They') + ' now holds ' + p.title + '.' + (res && res.left_open ? ' Their old seat is an open position now.' : ''), null);
  }
  async function place(memberId, toId, dept) {
    var m = memberById(memberId);
    var res = await rpc('org_place', { p_member_id: Number(memberId), p_reports_to: toId == null ? null : Number(toId) });
    var X = ix();
    await after((m ? m.name : 'They') + ' is on the chart, reporting to ' + (toId == null ? 'the executive directors' : seatName(X.byId[toId])) + '.', null);
    return res;
  }
  async function vacate(p) {
    var nm = seatName(p);
    await rpc('org_vacate', { p_id: Number(p.id) });
    await after(nm + ' is off the seat. ' + p.title + ' is an open position now.', null);
  }
  async function removeSeat(p) {
    var res = await rpc('org_remove', { p_id: Number(p.id) });
    O.sheet = null; closeSheet();
    await after('The open position is removed' + (res && res.moved_up ? '; ' + plural(res.moved_up, 'person moves', 'people move') + ' up a level' : '') + '.', null);
  }

  /* ---------- the undo bar ---------- */
  var SN = { acts: [] };
  function snackEl() { var el = document.getElementById('w133snack'); if (!el) { el = document.createElement('div'); el.id = 'w133snack'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); } return el; }
  function snack(text, acts) {
    var el = snackEl(); SN.acts = acts || [];
    el.innerHTML = '<span class="t">' + E(text) + '</span>' + SN.acts.map(function (a, i) { return '<button type="button" data-w133sn="' + i + '">' + E(a[0]) + '</button>'; }).join('') + '<button type="button" class="x" data-w133sn="x" aria-label="Dismiss">' + I('x') + '</button>';
    el.classList.add('on');
    clearTimeout(O.snackT); O.snackT = setTimeout(hideSnack, 10000);
  }
  function hideSnack() { var el = document.getElementById('w133snack'); if (el) el.classList.remove('on'); clearTimeout(O.snackT); }
