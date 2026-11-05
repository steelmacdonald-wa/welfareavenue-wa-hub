/* =====================================================================
   WA v274 Toronto Volunteers: the Toronto team's own app (05/11/26)
   =====================================================================
   Steel (05/11/26): "a volunteer manager for Toronto ... a robust, easy to use volunteer management tool for Toronto using
   Emil's design and animation skills for this new app in the hub ... It also should integrate with the CRM as well in the
   hub, like the Montreal volunteer manager does."

   Toronto runs a different kind of event from Montreal's Sunday servings: about once a month the team books a community
   kitchen (usually the Ralph Thornton Community Centre) for a time window, one crew cooks there, and the meals go to one or
   two organizations that sent a headcount and dietary needs; sometimes a second crew serves outdoors. Sama confirms people
   by hand, by email, phone or WhatsApp. This app (page #toronto) is built for that, on the same tables as Montreal, so a
   Toronto volunteer is the same CRM contact with the same servings count and history as anyone else.

   - Events (#toronto): the next event as a hero card, then the upcoming ones, then the past ones (folded). New event.
   - The event page (#toronto/e/<id>): Plan (the kitchen; who the meals go to), Crew (crews with targets, Add people from the
     Toronto pool, statuses, Take off the crew with Undo), Confirm (the counts, Called, Copy emails or phone numbers, the
     WhatsApp group link), Wrap up (meals delivered, who came, Mark this event completed).
   - Volunteers (#toronto/people): the Toronto pool from the CRM with search, Students / General, school, area and days.
   - Montreal's Volunteer Manager leaves Toronto out of its lists (the waVolLoad wrapper in z_wire.js).

   A Toronto event is volunteer_events kind 'meal', location 'Toronto' (every Montreal automation filters kind 'service').
   The data: build/data/wa274_toronto.sql (volunteer_event_recipients, wa274_crew_add, wa274_next_code, the page in every
   access profile; not applied yet: everything here works without it, saying plainly what waits for it).
   Not in this wave: sign-up forms, automatic emails or texts, recipes and groceries, Setup, page tours.
   window.w274: state, show, paint, load, loadPool, newEvent, stageOf, crewOf, pool, filterPeople, flush. */
(function () {
  'use strict';
  if (window.__wa274) return; window.__wa274 = true;
  var PURPLE = '#6F64AB';   /* Toronto's accent: the Hub purple (brand Possibility purple) */
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var OUT = 'cubic-bezier(.23,1,.32,1)', DRAWER = 'cubic-bezier(.32,.72,0,1)', MOVE = 'cubic-bezier(.77,0,.175,1)';

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lower(s) { return String(s == null ? '' : s).toLowerCase().trim(); }
  function fold(s) { try { return lower(s).normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { return lower(s); } }
  function num(v, d) { if (v === null || v === undefined || v === '') return d; var n = Number(v); return isFinite(n) ? n : d; }
  function msgOf(e) { return String((e && (e.message || e.details || e.hint)) || e || 'unknown error'); }
  var NF = null;
  function nf(n) { try { NF = NF || new Intl.NumberFormat('en-CA'); var v = Number(n); return isFinite(v) ? NF.format(v) : String(n); } catch (e) { return String(n); } }   /* break274: 1,999 and 2,000, not 1999 */
  function plural(n, one, many) { return nf(n) + ' ' + (Number(n) === 1 ? one : (many || one + 's')); }
  function staffOk() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  function boardMode() { try { return typeof MODE !== 'undefined' && MODE === 'board'; } catch (e) { return false; } }
  function me() {
    try { if (typeof USER !== 'undefined' && USER && USER.email) return lower(USER.email); } catch (e) { /* fine */ }
    try { if (typeof SESSION !== 'undefined' && SESSION && SESSION.user && SESSION.user.email) return lower(SESSION.user.email); } catch (e) { /* fine */ }
    return 'staff';
  }
  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function audit(id, field, oldV, newV) {   /* the audit trail: best effort, never in the way of a save */
    try { if (typeof logChange === 'function' && String(oldV == null ? '' : oldV) !== String(newV == null ? '' : newV)) logChange('volunteer_event', id, field, oldV, newV); } catch (e) { /* fine */ }
  }

  /* ---------- dates: plain days, counted in Toronto ---------- */
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  function todayIso() {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    catch (e) { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  }
  function dParse(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)) : null; }
  function daysTo(iso) { var a = dParse(iso), b = dParse(todayIso()); return a && b ? Math.round((a.getTime() - b.getTime()) / 864e5) : null; }
  function fmtDay(iso) { var d = dParse(iso); if (!d) return ''; var s = DOW[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; if (String(d.getUTCFullYear()) !== todayIso().slice(0, 4)) s += ' ' + d.getUTCFullYear(); return s; }
  function hm(t) { var m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : ''; }
  function rel(n) { if (n == null) return ''; if (n === 0) return 'today'; if (n === 1) return 'tomorrow'; if (n === -1) return 'yesterday'; return n > 0 ? 'in ' + n + ' days' : -n + ' days ago'; }
  function stamp(iso) {   /* a moment, said in Toronto time: "Fri 25 Sep, 16:00" */
    var d = iso ? new Date(iso) : null; if (!d || isNaN(d.getTime())) return '';
    try {
      var p = {}; new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
      return p.weekday.replace(/\.$/, '') + ' ' + p.day + ' ' + p.month.replace(/\.$/, '') + ', ' + p.hour + ':' + p.minute;
    } catch (e) { return DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ', ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  }

  /* ---------- the stages: Plan, Crew, Confirm, Wrap up (from the date; a completed event is wrapped up) ---------- */
  var STAGES = [['plan', 'Plan'], ['crew', 'Crew'], ['confirm', 'Confirm'], ['wrap', 'Wrap up']];
  function stageOf(ev) {
    if (!ev) return 'plan';
    if (lower(ev.status) === 'completed') return 'wrap';
    var d = daysTo(ev.event_date);
    if (d == null) return 'plan';
    if (d < 0) return 'wrap';
    if (d <= 2) return 'confirm';
    if (d <= 10) return 'crew';
    return 'plan';
  }
  function stageIdx(k) { for (var i = 0; i < STAGES.length; i++) if (STAGES[i][0] === k) return i; return 0; }
  function stageLabel(k) { return STAGES[stageIdx(k)][1]; }

  /* ---------- the crews: the shared role keys, labelled the Toronto way ---------- */
  var ROLES = [['team_leader', 'Lead', 1], ['cook', 'Kitchen crew', 4], ['server', 'Serving crew', 4], ['driver', 'Delivery', 1], ['photographer', 'Photos', 0]];
  var ROLE_IN = { team_leader: 'the lead', cook: 'the kitchen crew', server: 'the serving crew', driver: 'delivery', photographer: 'photos' };
  function roleLabel(k) { for (var i = 0; i < ROLES.length; i++) if (ROLES[i][0] === k) return ROLES[i][1]; var s = String(k || 'Other').replace(/_/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); }
  function roleIn(k) { return ROLE_IN[k] || lower(roleLabel(k)); }

  /* ---------- the pool's rule (the same on the server's answer and in the browser) ---------- */
  var TAGS = ['toronto', 'toronto volunteer', 'toronto student'];
  var GTA = ['toronto', 'mississauga', 'brampton', 'scarborough', 'north york', 'etobicoke', 'east york', 'york', 'markham', 'vaughan', 'richmond hill', 'oakville', 'pickering', 'ajax'];
  var AREAS = ['Downtown Toronto', 'Midtown (Yonge-Eglinton)', 'North York', 'East York', 'York', 'Etobicoke', 'Scarborough'];
  var FKEYS = ['gta_area', 'days_available', 'age_16_plus', 'photo_consent'];

  /* ---------- state ---------- */
  var S = {
    loaded: false, loading: null, evErr: null, rosterErr: null,
    events: [], roster: [], rec: [], recOk: true,
    pool: null, poolBusy: null, poolErr: null, byCid: {}, byVid: {}, orgs: {},
    view: 'events', evId: null, key: '', fresh: true, pastOpen: false,
    f: { q: '', kind: 'all', school: '', area: '', days: [], sort: 'newest' },
    scope: 'all', waEdit: false, confirmRec: null, confirmDone: false, err: {},
    pend: {}, snackT: null
  };
  function evById(id) { for (var i = 0; i < S.events.length; i++) if (String(S.events[i].id) === String(id)) return S.events[i]; return null; }
  function rowById(id) { for (var i = 0; i < S.roster.length; i++) if (String(S.roster[i].id) === String(id)) return S.roster[i]; return null; }
  function rowsOf(evId) { return S.roster.filter(function (r) { return String(r.event_id) === String(evId) && !S.pend[r.id]; }); }
  function recsOf(evId) { return S.rec.filter(function (r) { return String(r.event_id) === String(evId); }).sort(function (a, b) { return num(a.sort, 0) - num(b.sort, 0) || num(a.id, 0) - num(b.id, 0); }); }
  function isTo(e) { return !!e && lower(e.kind) === 'meal' && /toronto/i.test(String(e.location || '')); }
  function titleOf(e) { return (e && String(e.title || '').trim()) || 'Free meal event'; }
  function isOpen(e) { var s = lower(e && e.status); return s !== 'completed' && s !== 'cancelled'; }

  /* a roster row's state: yes (confirmed), wait, no (can't come), off (taken off elsewhere) */
  function stOf(r) {
    var s = lower(r && r.status), c = lower(r && r.confirm_status);
    if (s === 'cancelled') return 'off';
    if (s === 'unavailable' || s === 'declined') return 'no';
    if (s === 'confirmed') return 'yes';
    if (c === 'declined') return 'no';
    if (c === 'confirmed') return 'yes';
    return 'wait';
  }
  var ST_LABEL = { yes: 'Confirmed', wait: 'Waiting', no: 'Can’t come', off: 'Off the crew' };

  /* the crews of an event: each role's target (spot_counts first, else the defaults) and its people */
  function targetsOf(ev) {
    var sc = (ev && ev.spot_counts && typeof ev.spot_counts === 'object') ? ev.spot_counts : {};
    var out = {}; ROLES.forEach(function (r) { var v = num(sc[r[0]], null); out[r[0]] = v == null ? r[2] : Math.max(0, Math.round(v)); });
    return out;
  }
  function crewOf(ev) {
    if (!ev) return [];
    var t = targetsOf(ev), rows = rowsOf(ev.id).filter(function (r) { return stOf(r) !== 'off'; });
    var keys = ROLES.map(function (r) { return r[0]; });
    rows.forEach(function (r) { if (keys.indexOf(r.role) < 0) keys.push(r.role); });
    return keys.map(function (k) {
      var ppl = rows.filter(function (r) { return r.role === k; }).sort(function (a, b) { return num(a.sort, 0) - num(b.sort, 0) || num(a.id, 0) - num(b.id, 0); });
      var yes = ppl.filter(function (r) { return stOf(r) === 'yes'; }).length, wait = ppl.filter(function (r) { return stOf(r) === 'wait'; }).length;
      return { role: k, label: roleLabel(k), target: t[k] == null ? 0 : t[k], people: ppl, yes: yes, wait: wait, no: ppl.length - yes - wait };
    }).filter(function (c) { return c.target > 0 || c.people.length > 0; });
  }
  function totals(crews) {
    var o = { yes: 0, wait: 0, no: 0, target: 0, filled: 0 };
    crews.forEach(function (c) { o.yes += c.yes; o.wait += c.wait; o.no += c.no; o.target += c.target; o.filled += Math.min(c.target, c.yes + c.wait); });
    return o;
  }
