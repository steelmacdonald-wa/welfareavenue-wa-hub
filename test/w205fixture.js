/* w205fixture.js (wave205): the test fixture with the Strategy app's data, built from build/data/wa205_seed.json (the approved
   draft) on top of test/fixture.json: the five org goals (ids 101 to 105), their owners, milestones (1001 on), paths (2001 on),
   the plan, the library, the retired tier (the fixture's goals retired and mapped as the migration does), the project links,
   a comment thread and a few history rows.
   const { build } = require('./w205fixture'); const fx = build();   node test/w205fixture.js <out.json> writes it. */
const fs = require('fs'), path = require('path');
function build(o) {
  o = o || {};
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture.json'), 'utf8'));
  const S = JSON.parse(fs.readFileSync(path.join(__dirname, '../build/data/wa205_seed.json'), 'utf8'));
  const now = '2026-10-04T15:00:00+00:00';
  const gid = {}; let mid = 1000, pid = 2000, oid = 3000;
  fx.goal_owners = []; fx.goal_milestones = []; fx.goal_paths = [];
  S.goals.forEach(g => {
    const id = 100 + g.number; gid[g.number] = id;
    fx.goals.push({ id, department: 'org', quarter: 'FY27 to FY29', title: g.title, detail: g.detail, why: g.why, measure: g.measure, baseline: g.baseline, target_fy29: g.target_fy29, target_fy31: g.target_fy31,
      status: 'not started', progress: null, due_date: '2029-09-30', source: 'wave205', sort: g.number, number: g.number, owner: g.owner_text, approval: 'draft', approved_at: null, approved_by: null,
      retired_at: null, updated_at: now, updated_by: 'wave205 migration', task_ids: [], parent_goal_id: null });
    g.owners.forEach(x => fx.goal_owners.push({ id: ++oid, goal_id: id, member_id: x.member_id, is_lead: x.is_lead, focus: x.focus, sort: x.sort, added_at: now, removed_at: null }));
    g.paths.forEach(x => fx.goal_paths.push({ id: ++pid, goal_id: id, sort: x.sort, body: x.body, updated_at: now, updated_by: 'wave205 migration', archived_at: null }));
    g.milestones.forEach(x => fx.goal_milestones.push({ id: ++mid, goal_id: id, fy: x.fy, sort: x.sort, body: x.body, status: 'not started', updated_at: now, updated_by: 'wave205 migration', archived_at: null }));
  });
  /* a little life: two milestones done, one in progress */
  const ms = (num, fy, body) => fx.goal_milestones.find(m => m.goal_id === gid[num] && m.fy === fy && m.body === body);
  if (o.lively !== false) { ms(1, 'FY27', 'Meals counted at 100% of services').status = 'in progress'; ms(5, 'FY27', 'Executive transition complete').status = 'done'; ms(4, 'FY27', 'Ad Grant live').status = 'in progress'; }
  /* retire the older tiers as the migration does */
  Object.keys(S.old_org).forEach(k => { const g = fx.goals.find(x => x.id === Number(k)); if (!g) return; const v = S.old_org[k]; Object.assign(g, { status_before_retire: g.status, status: 'archived', retired_at: now, retired_note: v[1], superseded_by: v[0] ? gid[v[0]] : null, maps_to_goal_id: v[0] ? gid[v[0]] : null }); });
  Object.keys(S.dept_map).forEach(k => { const g = fx.goals.find(x => x.id === Number(k)); if (!g) return; const n = S.dept_map[k]; Object.assign(g, { status_before_retire: g.status, status: 'archived', retired_at: now, retired_note: n ? 'Department goals are retired as a tier (wave205): this one served goal ' + n + '.' : 'Department goals are retired as a tier (wave205): no obvious fit with one of the five goals.', maps_to_goal_id: n ? gid[n] : null, moved_to_project_id: null }); });
  S.project_links.forEach(l => { const p = fx.projects.find(x => x.id === l[0]); if (!p) return; p.goal_id = gid[l[1]]; const m = l[2] ? ms(l[1], l[2], l[3]) : null; p.milestone_id = m ? m.id : null; });
  fx.strategy_plan = Object.keys(S.plan).map(k => ({ key: k, value: S.plan[k], updated_at: now }));
  fx.strategy_docs = S.docs.map((d, i) => ({ id: i + 1, title: d.title, url: d.url, group_label: d.group, doc_date: d.date, direction: d.direction, status_note: d.status, goals: d.goals, pinned: true, sort: (i + 1) * 10, archived_at: null }));
  const m1 = ms(1, 'FY27', '3,000 meals');
  fx.goal_comments = (fx.goal_comments || []).concat([
    { id: 9001, goal_id: gid[1], body: 'Can we confirm how food bags are counted at the Toronto services? @Suhaib', author: 'Shima', author_email: 'shima.butera@welfareavenue.com', parent_id: null, milestone_id: null, created_at: '2026-09-25T13:00:00+00:00', updated_at: '2026-09-25T13:00:00+00:00' },
    { id: 9002, goal_id: gid[1], body: 'Yes: one bag counts as one meal, as in the plan.', author: 'Suhaib', author_email: 'suhaib.abdillahi@welfareavenue.com', parent_id: 9001, milestone_id: null, created_at: '2026-09-25T13:20:00+00:00', updated_at: '2026-09-25T13:20:00+00:00' },
    { id: 9003, goal_id: gid[1], body: 'The kitchen portions from DESTA count toward this too.', author: 'Ian', author_email: 'ian.odhiambo@welfareavenue.com', parent_id: null, milestone_id: m1.id, created_at: '2026-09-25T15:10:00+00:00', updated_at: '2026-09-25T15:10:00+00:00' }
  ]);
  fx.goal_history = [
    { id: 7001, goal_id: gid[1], entity: 'goal', entity_id: gid[1], field: 'why', old_value: 'The meal is the mission.', new_value: S.goals[0].why, changed_by: 'shima.butera@welfareavenue.com', changed_by_name: 'Shima', changed_at: '2026-09-25T14:30:00+00:00' },
    { id: 7002, goal_id: gid[1], entity: 'milestone', entity_id: ms(1, 'FY27', 'Meals counted at 100% of services').id, field: 'status', old_value: 'not started', new_value: 'in progress', changed_by: 'shima.butera@welfareavenue.com', changed_by_name: 'Shima', changed_at: '2026-09-25T14:35:00+00:00' },
    { id: 7003, goal_id: gid[1], entity: 'project', entity_id: 24, field: 'goal_id', old_value: null, new_value: 'Community Kitchen Pilot', old_ref: null, new_ref: gid[1], changed_by: 'wave205 migration', changed_by_name: 'wave205 migration', changed_at: '2026-09-25T12:00:00+00:00' }
  ];
  /* the board profile as it is live (04/10/26): the Strategy pages decided 'all' (fixture.json is an older snapshot with 'none') */
  (fx.hub_access_profiles || []).forEach(p => { if (p.key === 'board' && p.pages) ['orggoals', 'goals', 'projects', 'goalmap'].forEach(k => { p.pages[k] = 'all'; }); });
  /* the leader the harness picks first is Shima (an owner of goals 1, 2 and 5) */
  return fx;
}
module.exports = { build };
if (require.main === module) { const out = process.argv[2] || path.join(__dirname, 'fixture_w205.json'); fs.writeFileSync(out, JSON.stringify(build())); console.log('wrote', out); }
