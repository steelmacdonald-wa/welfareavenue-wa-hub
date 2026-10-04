/* =====================================================================
   WA v205 (04/10/26): the Strategy app rebuilt; the organizational goals edited live, Google-Doc style.
   Steel (04/10/26): a rebuilt, interactive Strategy app where the organizational goals can be edited live. His decisions:
   - "organizational goals, and departments own projects": the five FY27 to FY31 goals with their yearly milestones;
     department goals are retired as a tier (kept, archived, out of every default view, wins and comments kept; one-time
     Make it a project); each department's project links straight to an org goal, ideally to one milestone.
   - Live editing: click-to-edit with autosave on every field, milestone, target, owner and path (no edit dialog; saves as
     you type, quietly); who is on the page and which goal they are in, with other people's saves arriving without a
     refresh (Supabase Realtime: presence plus postgres_changes); a per-field check so two people never silently lose
     words ("Ian just changed this"); threaded comments on goals and milestones with @mentions (wave138's flow); every
     change in a history with Restore (goal_history, written by a database trigger).
   - "each goal's owners and admins edit; all staff read and comment; board viewers read-only": enforced in the database
     (strategy_* functions check inside; restrictive policies on goals and goal_comments); the page only mirrors it.
   - The cleanest page of the Hub: the mission at the top, the five goals as cards, the roadmap with the checkpoint and
     the FY29 gate, and the pinned Strategy Library (the Hub's first important-document flag, strategy_docs.pinned).
   The content is the approved draft's (build/data/wa205_seed.py), marked "Draft for board approval (19 Oct 2026)" until
   an admin marks the goals approved.

   Addresses (one page, 'orggoals', wave116f's, taken over): #orggoals (Goals), #orggoals/goal/<id>[/comments[/<c>]|/history],
   #orggoals/library (Strategy Library), #orggoals/retired (Retired goals). #goals (Department goals) opens Retired goals.
   The rail (parts153): Goals, Projects, Goal alignment (goals to projects, 116f), Strategy Library.
   Data: goals (org tier), goal_owners, goal_milestones, goal_paths, goal_history, goal_comments, projects.goal_id and
   milestone_id, strategy_plan, strategy_docs (wa205_strategy). Writers: strategy_save, strategy_add, strategy_remove,
   strategy_owner_set, strategy_link_project, strategy_comment_add, strategy_comment_edit, strategy_restore,
   strategy_set_approval, strategy_doc_save, strategy_retired_to_project.
   wave207 (04/10/26, same segment): each goal anchored on WA's 8 registered charitable activities (charitable_activities,
   goal_activities: chips with the reason, the at-a-glance column, the 8 activities coverage strip; strategy_activity_set),
   and this year's goals: a yearly target per goal with Q1 to Q4 checkpoints (goal_year_targets, goal_checkpoints; the
   "This year" view at the top of Goals with the current quarter, what is due next and what is overdue; checkpoint comments
   through strategy_checkpoint_comment_add; projects link to a checkpoint through strategy_link_checkpoint). g_year.js.
   ===================================================================== */
(function () {
  if (window.__wa205) return; window.__wa205 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GROUND = '#1F201E', PURPLE = '#6F64AB', GOLD = '#DCA527', MUTED = '#797773', FLAG = '#B3402F', TEAL = '#2A8C7A';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var FYS = ['FY27', 'FY28', 'FY29', 'FY31'];
  var FY_LABEL = { FY27: 'Oct 2026 to Sep 2027', FY28: 'Oct 2027 to Sep 2028', FY29: 'Oct 2028 to Sep 2029', FY30: 'Oct 2029 to Sep 2030', FY31: 'Oct 2030 to Sep 2031' };
  var GOAL_ST = ['not started', 'in progress', 'on track', 'at risk', 'delayed', 'done'];
  var MS_ST = ['not started', 'in progress', 'done', 'at risk', 'carried forward'];
  var ST_LABEL = { 'not started': 'Not started', 'in progress': 'In progress', 'on track': 'On track', 'at risk': 'At risk', 'delayed': 'Delayed', 'done': 'Done', 'carried forward': 'Carried forward' };
  var FIELD_LABEL = { title: 'the title', detail: 'the SMART statement', why: 'Why', measure: 'the headline measure', baseline: 'the baseline', target_fy29: 'the FY29 target', target_fy31: 'the FY31 target', status: 'the status', due_date: 'the due date', progress: 'progress', approval: 'board approval', retired_at: 'retired', body: 'the text', fy: 'the year', archived_at: 'removed', added: 'added', removed: 'removed', is_lead: 'the lead', focus: 'the focus', goal_id: 'the goal link', milestone_id: 'the milestone link', reason: 'the reason', owners: 'the owners', activities_note: 'the note on the activities', checkpoint_id: 'the checkpoint link' };
  var CP_ST = ['not started', 'on track', 'at risk', 'done'];   /* wave207: a quarterly checkpoint's status */
  var SAVE_MS = 800;

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lower(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function str(v) { return v == null ? '' : String(v); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* fine */ } }
  function toastS(m) { try { if (typeof toast === 'function') toast(m); } catch (e) { /* fine */ } }
  function byId(list, id) { for (var i = 0; i < list.length; i++) { if (String(list[i].id) === String(id)) return list[i]; } return null; }
  function clip(s, n) { s = str(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function fmtDay(d) { if (!d) return ''; try { var x = new Date(String(d).length <= 10 ? String(d) + 'T12:00:00' : d); return x.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return String(d); } }
  function fmtWhen(ts) {
    if (!ts) return '';
    try {
      var d = new Date(ts), now = new Date(), diff = (now - d) / 1000;
      if (diff < 45) return 'just now';
      if (diff < 3600) return Math.round(diff / 60) + ' min ago';
      var t = d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
      if (d.toDateString() === now.toDateString()) return 'today ' + t;
      return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) + ' ' + t;
    } catch (e) { return ''; }
  }
  function I(n) {
    var P = {
      plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', chat: '<path d="M4 5.5h16v10H9l-5 4z"/>',
      clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.1 1.1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.1-1.1"/>',
      star: '<path d="M12 3.5 14.6 9l6 .6-4.5 4 1.3 5.9L12 16.6l-5.4 2.9 1.3-5.9-4.5-4 6-.6z"/>', pin: '<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>',
      search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>', chev: '<path d="m6 9 6 6 6-6"/>', ext: '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M17.5 13.5v4.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V8A1.5 1.5 0 0 1 6 6.5h4.5"/>',
      undo: '<path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', flag: '<path d="M6 21V3.5"/><path d="M6 4.5h11l-2.3 4.2L17 13H6"/>',
      box: '<path d="m12 3.5 8 4v9l-8 4-8-4v-9z"/><path d="m4 7.5 8 4 8-4M12 11.5v9"/>', doc: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z"/><path d="M14 3.5V8h4M9.5 12.5h5M9.5 16h5"/>',
      archive: '<rect x="4" y="4.5" width="16" height="4" rx="1"/><path d="M5.5 8.5V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V8.5M10 12.5h4"/>', people: '<circle cx="9" cy="9" r="3"/><path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5"/><circle cx="17" cy="9.5" r="2.4"/><path d="M15.8 14.6c2.4.1 4 1.5 4.6 4.4"/>'
    };
    return '<svg class="w205i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || P.star) + '</svg>';
  }

  /* ---------- who ---------- */
  function members() { try { return (typeof DB_MEMBERS !== 'undefined' && DB_MEMBERS) || []; } catch (e) { return []; } }
  function memberById(id) { return byId(members(), id); }
  function memberByEmail(em) { em = lower(em); if (!em) return null; return members().filter(function (m) { return lower(m.email) === em; })[0] || null; }
  function nameOf(email) { var m = memberByEmail(email); return m ? m.name : (email ? String(email).split('@')[0] : 'Someone'); }
  function myEmail() { try { return lower(typeof USER !== 'undefined' && USER && USER.email); } catch (e) { return ''; } }
  function me() { var em = myEmail(), m = memberByEmail(em); var name = ''; try { name = (typeof USER !== 'undefined' && USER && USER.name) || ''; } catch (e) { name = ''; } return { email: em, name: (m && m.name) || name || em.split('@')[0], id: m ? m.id : null, avatar_url: m ? m.avatar_url : null }; }
  function role() { try { return (typeof WA40_MINE !== 'undefined' && WA40_MINE && WA40_MINE.role) || ''; } catch (e) { return ''; } }
  function boardMode() { try { return typeof MODE !== 'undefined' && MODE === 'board'; } catch (e) { return false; } }
  function staffOk() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  function isAdmin() { return staffOk() && role() === 'admin'; }
  function isLeader() { var r = role(); return staffOk() && (r === 'admin' || r === 'leader'); }
  /* the database decides (wa205_can_comment, wa205_can_edit); the page mirrors it so nobody types into a box that will refuse */
  function canComment() { return staffOk() && !boardMode() && role() !== 'viewer' && role() !== 'blocked'; }
  function isOwner(g) { var em = myEmail(); if (!g || !em) return false; return S.owners.some(function (o) { if (String(o.goal_id) !== String(g.id) || o.removed_at) return false; var m = memberById(o.member_id); return m && lower(m.email) === em; }); }
  function canEdit(g) { return !!g && !g.retired_at && canComment() && (isAdmin() || isOwner(g)); }
  function readOnlyWhy() {
    if (boardMode() || role() === 'viewer') return 'You are reading the goals as a board viewer.';
    if (!staffOk()) return 'Sign in with a Welfare Avenue account to work on the goals.';
    return 'Each goal’s owners and the admins edit it; you can comment and link projects.';
  }

  /* ---------- state ---------- */
  var S = {
    loaded: 0, loading: null, err: null,
    goals: [], retired: [], owners: [], milestones: [], paths: [], comments: [], projects: [], plan: {}, docs: [], wins: {},
    acts: [], gacts: [], targets: [], checkpoints: [],   /* wave207: charitable activities, goal_activities, goal_year_targets, goal_checkpoints */
    view: 'goals', goalId: null, sub: '', subId: null,
    base: {}, dirty: {}, timers: {}, inflight: {}, conflict: {}, savedAt: {}, errors: {},
    presence: [], channel: null, live: false, focus: { goal: null, field: null }, stale: {},
    drawer: null, libQ: '', libAll: false, folded: {}, flash: {}, lastSaveBy: {}
  };
  try { var f0 = JSON.parse(lsGet('w205folded') || '{}'); if (f0 && typeof f0 === 'object') S.folded = f0; } catch (e) { /* fine */ }
