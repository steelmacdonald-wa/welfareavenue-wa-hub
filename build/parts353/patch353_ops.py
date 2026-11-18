#!/usr/bin/env python3
"""wave353: the goals ecosystem, patched onto the live Hub page.

python3 build/parts353/patch353.py <live.html> <out.html>

Each edit names an exact anchor in the live page; the script stops if an anchor is missing or not unique,
so a page that moved underneath us is never half-patched.
"""
import sys, os, hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
src, out = sys.argv[1], sys.argv[2]
page = open(src, encoding='utf-8').read()
if 'WA v353' in page:
    sys.exit('index.html already has wave353')
inner = open(os.path.join(HERE, 'w353_inner.js'), encoding='utf-8').read()
seg = open(os.path.join(HERE, 'w353_project.seg'), encoding='utf-8').read()


OPS = []
def rep(old, new, label):
    global page
    n = page.count(old)
    if n != 1:
        sys.exit('anchor %s found %d times' % (label, n))
    page = page.replace(old, new)
    OPS.append({'old': old, 'new': new, 'label': label})


# 1. load the new rows and the live numbers
rep("""      q(db.from('goal_checkpoints').select('*').order('quarter'))
    ]).then(function (r) {""",
    """      q(db.from('goal_checkpoints').select('*').order('quarter')),
      q(db.from('project_milestones').select('project_id,milestone_id')),   /* wave353 */
      q(db.from('fund_events').select('id,title,season,start_date,end_date,status,lead,partners,project_id,target_min,target_max,raised,goal_id,milestone_id')),
      q(db.from('goal_measures').select('*').order('sort')),
      q(db.from('goal_contributors').select('*').order('sort')),
      q(db.rpc('wa353_measures'))
    ]).then(function (r) {""", 'load')
rep("""      S.targets = (r[11].data || []).filter(function (t) { return !t.archived_at; }); S.checkpoints = (r[12].data || []).filter(function (c) { return !c.archived_at; });""",
    """      S.targets = (r[11].data || []).filter(function (t) { return !t.archived_at; }); S.checkpoints = (r[12].data || []).filter(function (c) { return !c.archived_at; });
      S.pm = r[13].data || []; S.events = r[14].data || []; S.measures = (r[15].data || []).filter(function (m) { return !m.archived_at; });   /* wave353 */
      S.contribs = (r[16].data || []).filter(function (c) { return !c.removed_at; }); S.mv = r[17].data || null; S.mvErr = r[17].error ? (r[17].error.message || String(r[17].error)) : null;""", 'state')

# 2. wave353's block goes in before the goal body, inside the Strategy app
rep("""  function goalBodyHtml(g) {""", inner + """  function goalBodyHtml(g) {""", 'block')

# 3. a milestone: every project moving it, its live number, its quarter
old_ms_start = page.index('  function msHtml(m, g) {')
old_ms_end = page.index('  function pathsHtml(g) {')
old_ms = page[old_ms_start:old_ms_end]
if 'function yearsHtml(g)' not in old_ms or old_ms.count('  function ') != 2:
    sys.exit('msHtml and yearsHtml are not where wave353 expects them')
page = page[:old_ms_start] + """  function msHtml(m, g) {   /* wave353: projects through project_milestones; the live number; the quarter */
    var can = canEdit(g);
    return '<div class="w205ms' + (m.status === 'done' ? ' done' : '') + '" data-w205ms="' + m.id + '"><div class="row">' + stSel('milestone', m, 'status', MS_ST) +
      ed('milestone', m, 'body', { label: m.fy + ' milestone', ph: 'Write the milestone' }) +
      (can ? '<button type="button" class="w205rm" data-w205rm="milestone:' + m.id + '" aria-label="Remove this milestone">' + I('x') + '</button>' : '') + '</div>' +
      msLive(m) + (msReached(m) && m.status !== 'done' && can ? '<button type="button" class="w353reach" data-w353done="' + m.id + '">' + I('check') + ' The number is there: mark it done</button>' : '') +
      '<div class="w205msft">' + msFootHtml(m, g) + '</div></div>';
  }
""" + page[old_ms_end:]
OPS.append({'old': old_ms, 'new': page[old_ms_start:page.index('  function pathsHtml(g) {')], 'label': 'msHtml slice'})

# 4. projects at goal level are the ones moving none of its milestones; milestone footers repaint with the quarter
rep("""    var ps = projOf(g.id).filter(function (p) { return !p.milestone_id || !ms[p.milestone_id]; });""",
    """    var ps = projOf(g.id).filter(function (p) { return !(p.milestone_id && ms[p.milestone_id]) && !projMs(p.id).some(function (x) { return ms[x]; }); });   /* wave353 */""", 'projectsHtml')
rep("""      var ps = S.projects.filter(function (p) { return String(p.milestone_id) === String(m.id); });
      box.innerHTML = ps.map(projChip).join('') + cntBtn(g.id, m.id) + (canComment() ? '<button type="button" class="w205cnt" data-w205link="' + g.id + ':' + m.id + '" aria-label="Link a project to this milestone">' + I('link') + '</button>' : '');""",
    """      box.innerHTML = msFootHtml(m, g);   /* wave353 */""", 'paintProjects')

# 5. the goal: live measures under the progress; the years as bubbles with this year's quarters; Key events
rep("""    return '<div class="w205prog" data-w205prog="' + g.id + '">' + progHtml(g) + '</div>' +""",
    """    return '<div class="w205prog" data-w205prog="' + g.id + '">' + progHtml(g) + '</div>' + measuresHtml(g) +""", 'body measures')
rep("""      yearBlockHtml(g) +
      '<div class="w205h4"><h4>Milestones</h4><span style="font-size:12px;color:' + MUTED + '">By fiscal year (Oct 1 to Sep 30)</span></div>' +
      '<div class="w205years" data-w205years="' + g.id + '">' + yearsHtml(g) + '</div>' +""",
    """      '<div class="w205h4"><h4>Milestones</h4><span style="font-size:12px;color:' + MUTED + '">By fiscal year (Oct 1 to Sep 30). This year opens into its quarters.</span></div>' +
      '<div class="w205years" data-w205years="' + g.id + '">' + yearsHtml(g) + '</div>' +
      '<div data-w353evbox="' + g.id + '">' + eventsHtml(g) + '</div>' +""", 'body years')
rep("""      '<div class="w205owners" data-w205owners="' + g.id + '">' + ownersHtml(g) + '</div>' +""",
    """      '<div class="w205owners" data-w205owners="' + g.id + '">' + ownersHtml(g) + '</div>' +
      '<div class="w205owners w353contribs" data-w353contribs="' + g.id + '">' + contribHtml(g) + '</div>' +""", 'contributors')

# 6. the drawer's new kinds
rep("""    else if (st.kind === 'acts') html = actsDrawer(st);
    d.innerHTML = html;""",
    """    else if (st.kind === 'acts') html = actsDrawer(st);
    else if (st.kind === 'event') html = eventDrawer(st);   /* wave353 */
    else if (st.kind === 'contrib') html = contribDrawer(st);
    d.innerHTML = html;""", 'drawer kinds')

# 7. the link sheet: any number of milestones
rep("""      (gg ? '<div class="w205grp">The milestone (optional)</div><div class="w205pick"><label class="' + (!st.msPick ? 'on' : '') + '"><input type="radio" name="w205lm" data-w205pickm=""' + (!st.msPick ? ' checked' : '') + ' /><span class="t">The goal as a whole</span></label>' +
        msOf(gg.id).map(function (m) { return '<label class="' + (String(st.msPick) === String(m.id) ? 'on' : '') + '"><input type="radio" name="w205lm" data-w205pickm="' + m.id + '"' + (String(st.msPick) === String(m.id) ? ' checked' : '') + ' /><span class="t"><span data-w198skip>' + E(m.body) + '</span><small>' + E(m.fy) + '</small></span></label>'; }).join('') + '</div>' : '') +""",
    """      (gg ? msPickHtml(gg, st, p) : '') +   /* wave353: any number of milestones */""", 'link sheet')
rep("""    var m = unlink ? null : (st.msPick || null);
    var cp = unlink ? null : (st.cpPick || null);""",
    """    var picks = unlink ? [] : (st.msPicks || (st.msPick ? [String(st.msPick)] : [])).map(Number).filter(Boolean);   /* wave353 */
    var gPicks = picks.filter(function (x) { var mm = byId(S.milestones, x); return mm && String(mm.goal_id) === String(g); });
    var m = unlink ? null : (gPicks[0] || null);
    var cp = unlink ? null : (st.cpPick || null);""", 'doLink picks')
rep("""      return rpc('strategy_link_checkpoint', { p_project: Number(st.project), p_checkpoint: cp ? Number(cp) : null });
    }).then(function () {
      if (p) { p.goal_id = g ? Number(g) : null; p.milestone_id = m ? Number(m) : null; p.checkpoint_id = cp ? Number(cp) : null; }""",
    """      return rpc('strategy_link_checkpoint', { p_project: Number(st.project), p_checkpoint: cp ? Number(cp) : null });
    }).then(function () {
      /* wave353: every milestone it moves (the first of this goal's stays the primary link) */
      var all = unlink ? [] : (m ? [m] : []).concat(picks.filter(function (x) { return String(x) !== String(m); }));
      return rpc('strategy_link_milestones', { p_project: Number(st.project), p_milestones: all }).then(function () {
        S.pm = (S.pm || []).filter(function (r) { return String(r.project_id) !== String(st.project); }).concat(all.map(function (x) { return { project_id: Number(st.project), milestone_id: Number(x) }; }));
      }, function (x) { console.warn('wave353 milestones', x); });
    }).then(function () {
      if (p) { p.goal_id = g ? Number(g) : null; p.milestone_id = m ? Number(m) : null; p.checkpoint_id = cp ? Number(cp) : null; }""", 'doLink milestones')

# 8. a milestone added in a quarter; a milestone done is celebrated
rep("""      rpc('strategy_add', { p_entity: 'milestone', p_goal: Number(a[0]), p_fy: a[1], p_body: '' }).then(function (row) {""",
    """      rpc('strategy_add', { p_entity: 'milestone', p_goal: Number(a[0]), p_fy: a[1], p_body: '' }).then(function (row) {
        return a[2] ? rpc('strategy_milestone_meta', { p_id: Number(row.id), p_quarter: Number(a[2]), p_measure_key: null, p_target: null }).then(function (r2) { return r2 || row; }, function () { return row; }) : row;   /* wave353 */
      }).then(function (row) {""", 'add in quarter')
rep("""      if (P.e === 'milestone' && P.f === 'status') { paintProgress(g.id); var ms = byId(S.milestones, P.id), box = document.querySelector('#w205 [data-w205ms="' + P.id + '"]'); if (box && ms) box.classList.toggle('done', ms.status === 'done'); paintGlance(); }""",
    """      if (P.e === 'milestone' && P.f === 'status') { paintProgress(g.id); var ms = byId(S.milestones, P.id), box = document.querySelector('#w205 [data-w205ms="' + P.id + '"]'); if (box && ms) box.classList.toggle('done', ms.status === 'done'); paintGlance(); paintRings(g.id); if (ms && ms.status === 'done') msDone(ms); }""", 'celebrate')

# 9. events
rep("""  document.addEventListener('input', function (e) {
    var t = e.target; if (!inApp(t)) return;""",
    """  document.addEventListener('input', function (e) {
    var t = e.target; if (!inApp(t)) return;
    if (w353Input(t)) return;   /* wave353 */""", 'input')
rep("""  document.addEventListener('change', function (e) {
    var t = e.target; if (!inApp(t)) return;""",
    """  document.addEventListener('change', function (e) {
    var t = e.target; if (!inApp(t)) return;
    if (w353Change(t)) return;   /* wave353 */""", 'change')
rep("""    if ((el = t.closest('[data-w205close]'))) { closeDrawer(); return; }
    if ((el = t.closest('[data-w205go]'))) { e.preventDefault(); go(el.getAttribute('data-w205go')); return; }""",
    """    if ((el = t.closest('[data-w205close]'))) { closeDrawer(); return; }
    if (w353Click(t, e)) return;   /* wave353 */
    if ((el = t.closest('[data-w205go]'))) { e.preventDefault(); go(el.getAttribute('data-w205go')); return; }""", 'click')

# 10. after a paint: the first count of the headline numbers
rep("""    paintPresence(); growSoon();
    try { document.title = (S.view === 'library'""",
    """    paintPresence(); growSoon(); w353After();
    try { document.title = (S.view === 'library'""", 'paint after')

# 11. the page tour
rep("""        T('#w205 .w205goal .w207yb', 'This year\\u2019s target', 'The goal\\u2019s target for this fiscal year, who reports on it, and its Q1 to Q4 checkpoints. Owners set each checkpoint\\u2019s status (not started, on track, at risk, done) and its due date; the speech bubble holds its comments and the link icon ties a project to it.', OPT),
        T('#w205 .w205goal .w205years', 'Milestones by year', 'Each fiscal year\\u2019s milestones with their status (tap the circle). The projects serving a milestone sit under it; the speech bubble is its own comments.', OPT),
        T('#w205 .w205goal [data-w205projs]', 'Projects serving the goal', 'Teams link their projects here, to the goal or to one milestone. Link a project picks the project and the milestone.', OPT),""",
    """        T('#w205 .w205goal [data-w353contribs]', 'Contributors', 'The leads whose teams carry the goal. They comment and link work; the owners and admins edit the goal.', OPT),
        T('#w205 .w205goal .w353meas', 'Live measures', 'The numbers behind the goal, counted by the Hub from the Volunteer Manager, the CRM, social media and the Fundraising app. The dark tile is the headline; a bar shows the way to this year\\u2019s target, and hovering a number says how it is counted. Count again reads them fresh.', OPT),
        T('#w205 .w205goal .w353ybs', 'Milestones by year', 'FY27, FY28 and FY29, each ring filling as its milestones get done. Tap a year to open it. FY31 shows only when you ask for it.', OPT),
        T('#w205 .w205goal .w207yb', 'This year\\u2019s target', 'This year opens into its target, who reports on it, and its four quarters: each quarter\\u2019s checkpoint and the milestones due in it. Owners set statuses and move a milestone to its quarter; a milestone the Hub can count shows its live number, and says so when the number is there.', OPT),
        T('#w205 .w205goal [data-w353evbox]', 'Key events', 'The fundraising events and drives that feed the goal, each with its target and what it has raised. Link an event from the Fundraising app; the link icon changes what it feeds.', OPT),
        T('#w205 .w205goal [data-w205projs]', 'Projects serving the goal', 'Teams link their projects here, to the goal and to any number of its milestones. A project\\u2019s progress is the milestones it reaches.', OPT),""", 'tour')

# 12. the test hook
rep("""    open: openDrawer, close: closeDrawer, progress: progress, key: key, live: function () { return { live: S.live, channel: !!S.channel }; }
  };""",
    """    open: openDrawer, close: closeDrawer, progress: progress, key: key, live: function () { return { live: S.live, channel: !!S.channel }; },
    w353: { years: yearsHtml, measures: measuresHtml, events: eventsHtml, celebrate: celebrate, reached: msReached, state: function () { return W353; } }   /* wave353 */
  };""", 'hook')

# 13. the header line names the wave; the project page segment goes in before wave110 (which stays last)
rep("""   WA v205 (04/10/26): the Strategy app rebuilt; the organizational goals edited live, Google-Doc style.""",
    """   WA v205 (04/10/26): the Strategy app rebuilt; the organizational goals edited live, Google-Doc style.
   WA v353 (18/11/26, edited in place): live measures, year bubbles with this year's quarters, Key events, contributors,
   projects moving many milestones, a milestone reached celebrated (see wave353's block before goalBodyHtml).""", 'header')
rep("""/* =====================================================================
   WA v110 boot veil + self-provisioning + access requests (08/08/26)""",
    seg + """/* =====================================================================
   WA v110 boot veil + self-provisioning + access requests (08/08/26)""", 'segment')

for bad in ['—', '– ']:
    pass
open(out, 'w', encoding='utf-8').write(page)
print('ok', len(page), hashlib.md5(page.encode('utf-8')).hexdigest())

import json
json.dump(OPS, open('/tmp/w353ops.json','w'))
