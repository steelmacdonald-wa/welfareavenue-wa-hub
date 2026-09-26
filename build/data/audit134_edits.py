#!/usr/bin/env python3
"""Audit wave134 (26/09/26): targeted fixes in older segments and parts.

Each edit is an exact replacement with an expected count, so a drifted source fails loudly
instead of being half-patched. Run once from build/: python3 data/audit134_edits.py
Then re-assemble the parts folders that changed (122, 124, 126, 127, 128, 131, 132).

Applied on 26/09/26 (a second run reports SKIP for every edit: the sources already carry them).
Refined by hand afterwards, so the sources, not this script, are the record:
- 116d strategyGroup(): with the layout on it still creates and names the Organizational goals,
  Projects and Goal alignment buttons, then returns (the layout places them);
- 073 w73Nav(): with the layout on it hides Dashboard and Create, applies the layout and returns
  (it used to dissolve the groups and drop the Admin section links);
- 084 the admin tour, 118b the check-in note ("Don't forget to check in"), 043 and 061 the
  Important info help (passwords by request), and parts122/f_tours.js the Important info tour.
"""
import os
import sys

B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

EDITS = [
    # ---- B1: esc() and escapeHtml() also escape quotes (they are used inside attribute values) ----
    ('src/000_head_base.seg',
     'function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }',
     'function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML.replace(/"/g, "&quot;").replace(/\'/g, "&#39;"); } /* audit 26/09/26: quotes too, esc() is used inside attribute values */',
     1),
    ('src/000_head_base.seg',
     'function escapeHtml(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }',
     'function escapeHtml(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML.replace(/"/g, "&quot;").replace(/\'/g, "&#39;"); }',
     1),
    # ---- dead work at boot: nothing reads clickup_weekly since wave116g ----
    ('src/000_head_base.seg',
     '    db.from("clickup_weekly").select("*").gte("week_start", new Date(Date.now() - 21 * 86400000).toISOString().slice(0, 10))\n',
     '    Promise.resolve({ data: [] }) /* audit 26/09/26: clickup_weekly is no longer read anywhere (wave116g), so it is not loaded */\n',
     1),
    # ---- B2: the public confirmation page waited for window.db, which never exists (db is a script-level let) ----
    ('src/031_wave31.seg',
     "    if (typeof window.db === 'undefined' || !window.db || !window.db.rpc) {",
     "    if (typeof db === 'undefined' || !db || !db.rpc) { /* audit 26/09/26: db is a script-level let, never on window */",
     1),
    # ---- B4: WA_NAV.register ignores a page it already has, and places a new button safely ----
    ('src/042_wave42.seg',
     "      wa42Enrol(def.id, def.gate);\n      if (!def.noRoute) this.pages.push(def);",
     "      wa42Enrol(def.id, def.gate);\n      /* audit 26/09/26: a page registered twice (wave87 did) is kept once */\n      if (!def.noRoute && !this.pages.some(function (p) { return p.id === def.id; })) this.pages.push(def);",
     1),
    ('src/042_wave42.seg',
     "        else bar.insertBefore(b, bar.querySelector('.tab[data-tab=\"adminpanel\"]') || null);",
     "        else bar.insertBefore(b, bar.querySelector(':scope > .tab[data-tab=\"adminpanel\"]') || null); /* the menu layout (wave134) may hold Admin inside a group */\n        if (window.WA_NAV && WA_NAV.layout && WA_NAV.applyLayout) setTimeout(function () { try { WA_NAV.applyLayout(); } catch (e) { /* fine */ } }, 0);",
     1),
    # ---- B3: names other waves read but wave46 kept private ----
    ('src/046_wave46.seg',
     "  var WA46 = { reqs: [], log: [], types: {}, loaded: false };",
     "  var WA46 = { reqs: [], log: [], types: {}, loaded: false };\n  window.WA46 = WA46; /* audit 26/09/26: waves 116o and 116p read it (request types, open hiring requests) */",
     1),
    ('src/046_wave46.seg',
     "  function wa46Days(a, b) {",
     "  window.wa46IsHr = wa46IsHr; /* audit 26/09/26: wave116p's canHr() asks this */\n  function wa46Days(a, b) {",
     1),
    ('src/065_wave65.seg',
     "          old_value: null, new_value: sec + (drag.parent_id ? ' (nested)' : ' (main step)'),",
     "          old_value: null, new_value: (drag.section || '') + (drag.parent_id ? ' (nested)' : ' (main step)'), /* audit 26/09/26: was an undeclared sec, so no move was logged */",
     1),
    ('src/116j_wave116j.seg',
     "(window.__waEvents || [])",
     "((window.W116 && window.W116.events) || []) /* audit 26/09/26: the events cache is W116.events */",
     1),
    ('src/116k_wave116k.seg',
     "    try { if (window.w116Onboard && window.w116Onboard.tick) window.w116Onboard.tick('profile'); } catch (e) { /* fine */ }\n",
     "    /* audit 26/09/26: the 'Check your profile' step is ticked by wave112 when you open your own page */\n",
     1),
    ('src/116q_wave116q.seg',
     "      try { if (r.closed && r.closed.length && typeof loadTasks === 'function') loadTasks(); } catch (e) { /* fine */ }",
     "      try { var shut = (r.closed || []).map(String); if (shut.length && typeof DB_TASKS !== 'undefined' && DB_TASKS) { var nowIso = new Date().toISOString(); DB_TASKS.forEach(function (t) { if (shut.indexOf(String(t.id)) >= 0) { t.done = true; t.closed_at = t.closed_at || nowIso; } }); if (typeof renderMyPage === 'function') renderMyPage(); } } catch (e) { /* fine */ } /* audit 26/09/26: there was no loadTasks; the closed tasks are marked here */",
     1),
    # ---- B4: faster boot: one team_members request for the agendas page, not eight in parallel ----
    ('src/006_wave6.seg',
     "async function waLoadLeaders() {\n  if (WA_LEADERS.length) return;\n  try {\n    var r = await db.from('team_members').select('name, department, role').eq('active', true).order('name');\n    if (!r.error) WA_LEADERS = r.data || [];\n  } catch (e) { /* offline */ }\n}",
     "var __waLeadersP = null; /* audit 26/09/26: the load in flight, shared */\nasync function waLoadLeaders() {\n  if (WA_LEADERS.length) return;\n  if (__waLeadersP) return __waLeadersP;\n  __waLeadersP = (async function () {\n    try {\n      var r = await db.from('team_members').select('name, department, role').eq('active', true).order('name');\n      if (!r.error) WA_LEADERS = r.data || [];\n    } catch (e) { /* offline */ }\n    __waLeadersP = null;\n  })();\n  return __waLeadersP;\n}",
     1),
    # ---- B4: help popup titles that still used old page names ----
    ('src/061_wave61.seg',
     "mypage: 'Home', overview: 'Decisions', dashboard: 'Dashboard', dept: 'Department pages',",
     "mypage: 'Home', overview: 'Executive dashboard', dashboard: 'Delivery numbers', dept: 'Department pages',",
     1),
    ('src/061_wave61.seg',
     "requests: 'Requests', agendas: 'Agendas', importantinfo: 'Important info', goals: 'Goals',",
     "requests: 'Requests', agendas: 'Agendas', importantinfo: 'Important info', goals: 'Department goals',",
     1),
    ('src/061_wave61.seg',
     "create: 'Create studio', finances: 'Finances', orgchart: 'Org chart', training: 'Training',",
     "create: 'Create studio', finances: 'Finances', orgchart: 'Org chart', training: 'Training academy',",
     1),
    # ---- the menu layout (wave134) is the one place that places pages: the older placement code defers ----
    ('src/116d_wave116d.seg',
     "  function strategyGroup() {\n    var bar = document.getElementById('tabBar'); if (!bar) return;",
     "  function strategyGroup() {\n    if (window.WA_NAV && WA_NAV.layout) return; /* wave134: the menu layout places these pages */\n    var bar = document.getElementById('tabBar'); if (!bar) return;",
     1),
    ('src/116d_wave116d.seg',
     "  window.w116StrategyOk = function () {\n    var bar = document.getElementById('tabBar'); if (!bar) return true;",
     "  window.w116StrategyOk = function () {\n    if (window.WA_NAV && WA_NAV.layout) return true; /* wave134 */\n    var bar = document.getElementById('tabBar'); if (!bar) return true;",
     1),
    ('src/116h_wave116h.seg',
     "  function place() {\n    try {\n      var bar = document.getElementById('tabBar'); if (!bar) return;",
     "  function place() {\n    try {\n      if (window.WA_NAV && WA_NAV.layout) return; /* wave134: the menu layout places Hub inbox */\n      var bar = document.getElementById('tabBar'); if (!bar) return;",
     1),
    ('parts124/g_wire.js',
     "  function placeTabs() {\n    try {\n      var bar = document.getElementById('tabBar'); if (!bar) return;",
     "  function placeTabs() {\n    try {\n      var bar = document.getElementById('tabBar'); if (!bar) return;\n      var LAY = !!(window.WA_NAV && WA_NAV.layout); /* wave134: the menu layout places the calendar; this keeps the Events calendar in the Fundraising row */",
     1),
    ('parts124/g_wire.js',
     "      if (cal && anchor && anchor.parentNode && anchor.nextSibling !== cal) anchor.parentNode.insertBefore(cal, anchor.nextSibling);",
     "      if (!LAY && cal && anchor && anchor.parentNode && anchor.nextSibling !== cal) anchor.parentNode.insertBefore(cal, anchor.nextSibling);",
     1),
    ('parts124/g_wire.js',
     "        else if (cal && cal.parentNode) { if (cal.nextSibling !== fe) cal.parentNode.insertBefore(fe, cal.nextSibling); fe.classList.remove('w116tool'); }",
     "        else if (!LAY && cal && cal.parentNode) { if (cal.nextSibling !== fe) cal.parentNode.insertBefore(fe, cal.nextSibling); fe.classList.remove('w116tool'); }",
     1),
    ('parts126/g_wire.js',
     "      } else {\n        var anchor = bar.querySelector('.tab[data-tab=\"overview\"]');",
     "      } else if (!(window.WA_NAV && WA_NAV.layout)) { /* wave134: the menu layout puts them in the Board group */\n        var anchor = bar.querySelector('.tab[data-tab=\"overview\"]');",
     1),
    # ---- page crumbs follow the menu groups ----
    ('src/118_wave118.seg', '"overview": ["Strategy", "Executive dashboard",', '"overview": ["Home", "Executive dashboard",', 1),
    ('src/118_wave118.seg', '"dashboard": ["Strategy", "Delivery numbers",', '"dashboard": ["Executive dashboard", "Delivery numbers",', 1),
    ('src/118_wave118.seg', '"goals": ["Strategy", "Department goals",', '"goals": ["Goals and projects", "Department goals",', 1),
    ('src/118_wave118.seg', '"requests": ["Strategy", "Requests",', '"requests": ["Requests and inbox", "Requests",', 1),
    ('src/118_wave118.seg', '"hubmail": ["Meetings", "Hub inbox",', '"hubmail": ["Requests and inbox", "Hub inbox",', 1),
    ('src/118_wave118.seg', '"needsme": ["People", "Needs me",', '"needsme": ["Home", "Needs me",', 1),
    ('src/118_wave118.seg', '"activity": ["More", "Activity",', '"activity": ["Admin", "Activity",', 1),
    ('src/118_wave118.seg', '"importantinfo": ["More", "Important info",', '"importantinfo": ["Resources", "Important info",', 1),
    ('src/118_wave118.seg', '"brain": ["More", "The Brain", "Ask across everything the Hub knows.",', '"brain": ["Goals and projects", "The Brain", "How work flows through Welfare Avenue: from a conversation to a task to a project to a goal.",', 1),
    ('src/118_wave118.seg', '"create": ["More", "Create studio",', '"create": ["Resources", "Create studio",', 1),
    # the admin sections: People and access first (it is the one most used), then security
    ('src/118_wave118.seg',
     '  var ADMIN = [\n    ["ai", "AI models", "#w116ncard", "Which model answers each job, with fallbacks and spend."],\n    ["adoption", "Adoption", "#w116rcard", "Who uses the hub and how much: sign-ins, hours, tasks closed and AI spend, daily, weekly and monthly."],\n    ["accounts", "Workspace accounts", "#w116lcard", "Google Workspace accounts, placed on the roster or set aside."],\n    ["people", "People and access", "#w113card, #w113card + .card", "Everyone on the roster, what they can see, their invitations, and the access requests."],\n    ["security", "Security and audit trail", "#w86card", "What the Hub enforces, the backups, and every change with who made it."],\n    ["change", "Change the Hub", "#w96card", "Edit content with AI, or file a build request for the pipeline."]\n  ];',
     '  var ADMIN = [ /* audit 26/09/26: People and access first; the menu shows these as the Admin group */\n    ["people", "People and access", "#w113card, #w113card + .card", "Everyone on the roster, what they can see, their invitations, and the access requests."],\n    ["security", "Security and audit trail", "#w86card", "What the Hub enforces, the backups, and every change with who made it."],\n    ["ai", "AI models", "#w116ncard", "Which model answers each job, with fallbacks and spend."],\n    ["adoption", "Adoption", "#w116rcard", "Who uses the hub and how much: sign-ins, hours, tasks closed and AI spend, daily, weekly and monthly."],\n    ["accounts", "Workspace accounts", "#w116lcard", "Google Workspace accounts, placed on the roster or set aside."],\n    ["change", "Change the Hub", "#w96card", "Edit content with AI, or file a build request for the pipeline."]\n  ];',
     1),
    ('src/116d_wave116d.seg', '<div class="w116ptop"><div class="crumb">Strategy</div><h2>Projects</h2>', '<div class="w116ptop"><div class="crumb">Goals and projects</div><h2>Projects</h2>', 1),
    ('src/116f_wave116f.seg', "panel('orggoals', 'Strategy', 'Organizational goals',", "panel('orggoals', 'Goals and projects', 'Organizational goals',", 1),
    ('src/116f_wave116f.seg', "panel('goalmap', 'Strategy', 'Goal alignment',", "panel('goalmap', 'Goals and projects', 'Goal alignment',", 1),
    ('src/116h_wave116h.seg', '<div class="w116ptop"><div class="crumb">Meetings</div><h2>Hub inbox</h2>', '<div class="w116ptop"><div class="crumb">Requests and inbox</div><h2>Hub inbox</h2>', 1),
    ('src/118c_wave118c.seg', '<div class="w116ptop"><div class="crumb">More</div><h2>Photo library</h2>', '<div class="w116ptop"><div class="crumb">Resources</div><h2>Photo library</h2>', 1),
    ('parts124/d_cal.js', "mast('calendar', bv ? 'Strategy' : 'Home', 'Calendar',", "mast('calendar', bv ? 'Board' : 'Home', 'Calendar',", 1),
    ('parts124/e_fund.js', "mast('fundevents', tabOk('fundraising') ? 'Fundraising & Finances' : 'Strategy', 'Events calendar',", "mast('fundevents', tabOk('fundraising') ? 'Fundraising & Finances' : 'Home', 'Events calendar',", 1),
    ('parts132/d_page.js', "var html = '<div class=\"crumb\">Strategy</div><h1>The bank</h1>", "var html = '<div class=\"crumb\">Goals and projects</div><h1>The bank</h1>", 1),
    # ---- the access profile editor groups pages the way the menu does ----
    ('parts127/a_head.js',
     "  var GROUPS = [\n    ['Everyday', ['mypage', 'calendar', 'requests', 'overview', 'dashboard', 'create', 'photos', 'brain', 'importantinfo']],\n    ['Strategy', ['orggoals', 'goals', 'projects', 'goalmap', 'bank']],\n    ['Teams', ['opsmtl', 'volunteering', 'progdev', 'opsto', 'marketing', 'contentcal', 'socialstats', 'fundraising', 'fundevents', 'finances', 'hr', 'hrcentre']],\n    ['Board', ['governance', 'committees', 'board']],\n    ['Meetings', ['transcripts', 'agendas', 'hubmail']],\n    ['People', ['orgchart', 'training']],\n    ['More', ['activity', 'adminpanel']]\n  ];",
     "  var GROUPS = [ /* wave134: the same groups as the menu */\n    ['Everyday', ['mypage', 'overview', 'dashboard', 'calendar']],\n    ['Departments', ['opsmtl', 'volunteering', 'progdev', 'opsto', 'marketing', 'contentcal', 'socialstats', 'fundraising', 'fundevents', 'finances', 'hr', 'hrcentre']],\n    ['Board', ['board', 'governance', 'committees']],\n    ['Goals and projects', ['orggoals', 'goals', 'projects', 'goalmap', 'brain', 'bank']],\n    ['Meetings', ['agendas', 'transcripts']],\n    ['Requests and inbox', ['requests', 'hubmail']],\n    ['People', ['orgchart', 'training']],\n    ['Resources', ['importantinfo', 'photos', 'create']],\n    ['Admin', ['adminpanel', 'activity']]\n  ];",
     1),
    ('parts131/a_head.js',
     "  var GROUPS = [\n    ['Everyday', ['mypage', 'calendar', 'requests', 'overview', 'dashboard', 'create', 'photos', 'brain', 'importantinfo']],\n    ['Strategy', ['orggoals', 'goals', 'projects', 'goalmap', 'bank']],\n    ['Teams', ['opsmtl', 'volunteering', 'progdev', 'opsto', 'marketing', 'contentcal', 'socialstats', 'fundraising', 'fundevents', 'finances', 'hr', 'hrcentre']],\n    ['Board', ['governance', 'committees', 'board']],\n    ['Meetings', ['transcripts', 'agendas', 'hubmail']],\n    ['People', ['orgchart', 'training']],\n    ['More', ['activity', 'adminpanel']]\n  ];",
     "  var GROUPS = [ /* wave134: the same groups as the menu */\n    ['Everyday', ['mypage', 'overview', 'dashboard', 'calendar']],\n    ['Departments', ['opsmtl', 'volunteering', 'progdev', 'opsto', 'marketing', 'contentcal', 'socialstats', 'fundraising', 'fundevents', 'finances', 'hr', 'hrcentre']],\n    ['Board', ['board', 'governance', 'committees']],\n    ['Goals and projects', ['orggoals', 'goals', 'projects', 'goalmap', 'brain', 'bank']],\n    ['Meetings', ['agendas', 'transcripts']],\n    ['Requests and inbox', ['requests', 'hubmail']],\n    ['People', ['orgchart', 'training']],\n    ['Resources', ['importantinfo', 'photos', 'create']],\n    ['Admin', ['adminpanel', 'activity']]\n  ];",
     1),
    # ---- Hub training: the menu step names the new groups; the Needs me button has been hidden since wave116 ----
    ('parts122/f_tours.js',
     "'Every page lives here, grouped into Departments, Meetings, Strategy and People. Departments fold open to show each team’s extra pages, like Volunteering or the Content calendar.'",
     "'Every page lives here: Home, the Executive dashboard and the Calendar at the top, then Departments, Goals and projects, Meetings, Requests and inbox, People, Resources and Admin. A department folds open to show its team’s own pages, like Volunteering or the Content calendar.'",
     1),
    ('parts122/f_tours.js',
     "      S('#needsMeBtn', 'Needs me', 'One queue of everything waiting on you: tasks due, requests to action and decisions that sit with you.', OPT),\n",
     "",
     1),
    # ---- the Executive dashboard: Coming up no longer repeats what the brief's Next up already shows ----
    ('parts128/d_render.js',
     "    return rows.sort(function (a, b) { return a.d - b.d; }).slice(0, 8);\n  }\n  function nextHtml() {",
     "    /* audit 26/09/26: skip what the brief's Next up already shows (the next board meeting, event and serving) */\n    var shown = nextItems().map(function (x) { return x.k + '|' + ymdOf(x.d) + '|' + String(x.t || '').toLowerCase(); });\n    rows = rows.filter(function (r) { return shown.indexOf(r.k + '|' + ymdOf(r.d) + '|' + String(r.t || '').replace(/ \\(all month\\)$/, '').toLowerCase()) < 0; });\n    return rows.sort(function (a, b) { return a.d - b.d; }).slice(0, 8);\n  }\n  function ymdOf(d) { try { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); } catch (e) { return ''; } }\n  function nextHtml() {",
     1),
]


def main():
    bad = 0
    for path, old, new, n in EDITS:
        p = os.path.join(B, path)
        s = open(p, encoding='utf-8').read()
        c = s.count(old)
        if c != n:
            print('SKIP (found %d, expected %d): %s :: %s' % (c, n, path, old[:70].replace('\n', ' ')))
            bad += 1
            continue
        s = s.replace(old, new)
        open(p, 'w', encoding='utf-8').write(s)
    print('%d edits, %d problems' % (len(EDITS), bad))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
