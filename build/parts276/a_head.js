/* =====================================================================
   WA v276 Team availability: when can we meet? (02/11/26)
   =====================================================================
   Steel (02/11/26, spec docs/superpowers/specs/2026-11-02-team-availability-design.md): every team member enters a
   typical week of meeting availability from a Home pop-up; each team's Agenda tab shows the overlay so a leader can
   propose a slot in one click.

   - Home pop-up (#w276pop): "Your availability for <team> meetings", once per page load, for the first team
     wa_avail_due() returns, never over another window (otherOpen, the wave272 list plus #w276pop). Valid from, a
     drag-to-paint weekday grid (Monday to Sunday, 08:00 to 22:00 in 30-minute cells from app_config avail_*), a live
     hour count, the fixed note under the minimum (Save stays enabled), Save and Ask me later (a 3-day snooze).
   - Agenda tab (#team/<code>/agenda): "When can we meet?" above the agenda tool (#w276panel before #w116agHost): the
     heat map (a cell's shade = available / members with a grid; hover or tap lists names), the best slots (top three
     windows of at least 60 minutes by headcount, then fewest calendar clashes) with Propose for managers, "k of n
     entered", My availability, and Ask the team for managers.
   - Slots are weekday * 1440 + minute of the day, weekday 0 = Monday (Toronto wall time). Every read and write goes
     through the wa_avail_* RPCs (build/wa276_avail.sql); notify v18 sends meet_propose and meet_avail_ask.
   window.w276: paintAgenda, openPop, best (the pure ranking), slot, unslot, hours. */
(function () {
  'use strict';
  if (window.__wa276) return; window.__wa276 = true;

  var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var W276 = {
    cfg: { start: 480, end: 1320, cellMin: 30, minHours: 10 },
    cfgLoaded: null,     /* the app_config read, once */
    popped: false,       /* the Home pop-up opens at most once per page load */
    agenda: { dept: null, tok: 0, view: null, busy: null, refused: {} },
    DAYS: DAYS, DAYS_SHORT: DAYS_SHORT
  };

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function say(m) { try { if (typeof toast === 'function') toast(m); } catch (e) { /* fine */ } }
  function isoToday() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function myEmail() { try { return String((typeof USER !== 'undefined' && USER && USER.email) || '').toLowerCase(); } catch (e) { return ''; } }
  function teamLabel(code) {
    try { var T = window.WA_TEAMS; if (T && T.labels && T.labels[code]) return T.labels[code]; } catch (e) { /* fine */ }
    try { if (typeof DEPT_LABEL !== 'undefined' && DEPT_LABEL[code]) return DEPT_LABEL[code]; } catch (e) { /* fine */ }
    return String(code || '');
  }
  function onHome() { var h = String(location.hash || ''); return !h || h === '#' || /^#mypage(\/|$)/.test(h); }

  /* ---------- the pure helpers (test/w276pure.test.mjs) ---------- */
  function slot(di, min) { return Number(di) * 1440 + Number(min); }
  function unslot(n) { n = Number(n); return { di: Math.floor(n / 1440), min: n % 1440 }; }
  function uniq(slots) { var seen = {}, out = []; (slots || []).forEach(function (s) { s = Number(s); if (isFinite(s) && !seen[s]) { seen[s] = 1; out.push(s); } }); return out.sort(function (a, b) { return a - b; }); }
  function hours(slots, cellMin) { return uniq(slots).length * (Number(cellMin) || 30) / 60; }
  function hoursText(h) { var r = Math.round(h * 10) / 10; return (r === 1 ? '1 hour' : String(r) + ' hours'); }
  /* 17:00 -> "5:00 p.m." */
  function clock(min) {
    min = Number(min) % 1440; var h = Math.floor(min / 60), m = min % 60;
    return (h % 12 || 12) + ':' + ('0' + m).slice(-2) + ' ' + (h < 12 ? 'a.m.' : 'p.m.');
  }
  function clockHour(min) { var h = Math.floor((Number(min) % 1440) / 60); return (h % 12 || 12) + ' ' + (h < 12 ? 'a.m.' : 'p.m.'); }
  /* {di, start, end} -> "Tuesday 5:00 p.m. to 6:30 p.m." (no full stop: notify ends the sentence) */
  function windowLabel(w) { return DAYS[w.di] + ' ' + clock(w.start) + ' to ' + clock(w.end); }

  /* The best windows: for each starting cell, grow the window a cell at a time while someone stays available for all
     of it; each time the group shrinks (or the run ends) and the window is at least 60 minutes, it is a candidate with
     that group. Ranked by headcount, then fewest calendar clashes (the sum over the team's clashes inside the window),
     then the longer window, then the earlier one; the top three that do not overlap win.
     members: [{email, name, slots}], clashes: [{email, slot}] -> [{di, start, end, who:[emails], names, n, clash}] */
  function best(members, cellMin, clashes) {
    cellMin = Number(cellMin) || 30;
    var need = Math.max(1, Math.ceil(60 / cellMin));
    var list = (members || []).filter(function (m) { return m && (m.slots || []).length; });
    var by = {}, cl = {};
    list.forEach(function (m, i) { uniq(m.slots).forEach(function (s) { (by[s] = by[s] || []).push(i); }); });
    (clashes || []).forEach(function (c) { var s = Number(c && c.slot); if (isFinite(s)) cl[s] = (cl[s] || 0) + 1; });
    var cands = [];
    Object.keys(by).map(Number).sort(function (a, b) { return a - b; }).forEach(function (s0) {
      var di = Math.floor(s0 / 1440), who = by[s0].slice(), len = 1, clash = cl[s0] || 0, s = s0;
      for (;;) {
        var nx = s + cellMin;
        var nxWho = (Math.floor(nx / 1440) === di && by[nx]) ? who.filter(function (i) { return by[nx].indexOf(i) >= 0; }) : [];
        if (len >= need && nxWho.length < who.length) {
          cands.push({ di: di, start: s0 % 1440, end: s0 % 1440 + len * cellMin, idx: who.slice(), n: who.length, clash: clash, len: len });
        }
        if (!nxWho.length) break;
        who = nxWho; s = nx; len++; clash += cl[s] || 0;
      }
    });
    cands.sort(function (a, b) { return (b.n - a.n) || (a.clash - b.clash) || (b.len - a.len) || ((a.di * 1440 + a.start) - (b.di * 1440 + b.start)); });
    var out = [];
    for (var k = 0; k < cands.length && out.length < 3; k++) {
      var c = cands[k];
      if (out.some(function (o) { return o.di === c.di && o.start < c.end && c.start < o.end; })) continue;
      out.push({
        di: c.di, start: c.start, end: c.end, n: c.n, clash: c.clash,
        who: c.idx.map(function (i) { return String(list[i].email || '').toLowerCase(); }),
        names: c.idx.map(function (i) { return list[i].name || list[i].email || ''; })
      });
    }
    return out;
  }

  /* ---------- wave272's otherOpen, copied, plus this wave's pop-up ---------- */
  function otherOpen() {
    if (!document.documentElement.classList.contains('wa-ready')) return true;
    if (document.getElementById('w272back') || document.getElementById('w213pop') || document.getElementById('w262new') || document.getElementById('w276pop')) return true;
    var vis = function (el) { if (!el) return false; var c = getComputedStyle(el); return c.display !== 'none' && c.visibility !== 'hidden' && el.getBoundingClientRect().width > 0; };
    if (vis(document.getElementById('w238loop')) || vis(document.getElementById('w177pop')) || vis(document.getElementById('w227'))) return true;
    if (document.querySelector('.w122tp')) return true;
    return Array.prototype.some.call(document.querySelectorAll('[aria-modal="true"]'), vis);
  }

  /* ---------- app_config avail_* (read once; the defaults stand when a key is missing) ---------- */
  function loadCfg() {
    if (W276.cfgLoaded) return W276.cfgLoaded;
    W276.cfgLoaded = (async function () {
      try {
        var r = await db.from('app_config').select('key, value').in('key', ['avail_grid_start', 'avail_grid_end', 'avail_cell_min', 'avail_min_hours']);
        var map = { avail_grid_start: 'start', avail_grid_end: 'end', avail_cell_min: 'cellMin', avail_min_hours: 'minHours' };
        ((r && r.data) || []).forEach(function (x) { var n = Number(x.value); if (map[x.key] && isFinite(n) && n >= 0 && (n > 0 || x.key === 'avail_grid_start' || x.key === 'avail_min_hours')) W276.cfg[map[x.key]] = n; });
      } catch (e) { /* the defaults stand */ }
      return W276.cfg;
    })();
    return W276.cfgLoaded;
  }
  /* wa_avail_team carries the same settings: the server's copy wins for that team */
  function cfgFrom(t) {
    var c = W276.cfg, o = { start: c.start, end: c.end, cellMin: c.cellMin, minHours: c.minHours };
    if (t) {
      if (isFinite(Number(t.start)) && t.start != null) o.start = Number(t.start);
      if (isFinite(Number(t.end)) && Number(t.end) > 0) o.end = Number(t.end);
      if (isFinite(Number(t.cell_min)) && Number(t.cell_min) > 0) o.cellMin = Number(t.cell_min);
      if (isFinite(Number(t.min_hours)) && t.min_hours != null) o.minHours = Number(t.min_hours);
    }
    return o;
  }
  function rpcData(r) { if (r && r.error) throw r.error; return r ? r.data : null; }
