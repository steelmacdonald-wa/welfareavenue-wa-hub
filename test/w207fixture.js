/* w207fixture.js (wave207): test/w205fixture.js plus the charitable activities and the FY27 targets with their quarterly
   checkpoints, in the plan's words (as build/data/wa207_activities_fy27.sql seeds them), and the project-page data the
   live database had on 04/10/26: Survey Project (3) and Beneficiary Feedback Project (4) in Program Development, and
   project 31 made from the retired goal 19 (empty), with a few open Program Development tasks to link.
   const { build } = require('./w207fixture'); const fx = build(); */
const { build: build205 } = require('./w205fixture');
const ACTS = [
  [1, 'Build relationships with organizations, businesses and schools'], [2, 'Relieve poverty by providing basic necessities'],
  [3, 'Address food insecurity with free, healthy meals'], [4, 'Reduce isolation by building community around the meal'],
  [5, 'Increase access to resources through referrals'], [6, 'Mobilize youth and volunteers'],
  [7, 'Collaborate with other non-profits'], [8, 'Be a voice for the people we serve']];
const LINKS = [
  [1, 3, 'free, healthy meals'], [1, 4, 'community around the meal'], [1, 7, 'collaborating with DESTA, TYFPC and shelters'],
  [2, 2, 'basic necessities'], [2, 5, 'referrals, including housing organizations'], [2, 8, 'a voice for the people we serve, through feedback'],
  [3, 6, 'mobilizing youth and volunteers'], [3, 1, 'relationships with schools and universities'],
  [4, 1, 'relationships with businesses and sponsors'], [4, 7, 'joint grant applications with other non-profits'],
  [5, 6, 'youth leadership that lasts beyond one school year']];
const TARGETS = [
  [1, '3,000 meals, counted at 100% of services', 'Shima, Suhaib', ['Meal counts logged at every service', '1,500 meals; TMU Cook & Share with TYFPC (Jan)', '2,250 meals', '3,000 meals']],
  [2, 'Hygiene kits at 50% of services; first feedback round', 'Shima', ['Kit source confirmed with a partner', 'First referral partner invited (housing a priority)', 'First feedback round complete', 'Kits at 50% of services']],
  [3, '20% of volunteers return; 110 volunteers; half of applicants serve', 'Ian, Suhaib', ['7-day follow-up for every first-time volunteer', 'Recognition budget decided', 'Applicant-to-served rate at 50%', '110 volunteers; 20% return']],
  [4, '$25,000 revenue; 25 monthly donors; first grant; 2 paid summer roles', 'Suhaib, Ian', ['FY27 budget approved; donor program launched; Canada Summer Jobs applied (if the window opens)', 'Ad Grant live; 10 monthly donors; every flagship event has a lead', '2 summer roles start; first grant awarded', '$25,000; 25 monthly donors']],
  [5, 'Executive transition done; HR seat filled; Keela retired; every role written', 'Suhaib, Ian, Shima', ['Goals approved (Oct 19); Keela notice by Dec 5', 'Executive transition complete; HR seat filled', 'Every leadership role written, with hours', 'First yearly handover cycle run']]];
const DUE = ['2026-12-31', '2027-03-31', '2027-06-30', '2027-09-30'];

function build(o) {
  o = o || {};
  const fx = build205(o);
  const now = '2026-10-04T21:30:00+00:00', G = n => 100 + n;
  fx.charitable_activities = ACTS.map(a => ({ id: a[0], title: a[1], sort: a[0], source: 'CRA registration (July 2026 board deck)' }));
  let id = 500;
  fx.goal_activities = LINKS.map((l, i) => ({ id: ++id, goal_id: G(l[0]), activity_id: l[1], reason: l[2], sort: i, updated_at: now, updated_by: 'wave207 migration', archived_at: null }));
  fx.goals.forEach(g => { if (g.number === 4) g.activities_note = 'It funds all eight.'; if (g.number === 5) g.activities_note = 'It keeps all eight running.'; });
  fx.strategy_plan.push({ key: 'activities', value: { title: 'Anchored in our 8 charitable activities', intro: 'Every goal serves at least one of the eight activities registered with the CRA (July 2026 board deck). All eight are covered.' }, updated_at: now });
  fx.strategy_plan.push({ key: 'year_fy27', value: { fy: 'FY27', title: "This year's goals: FY27 (Oct 1, 2026 to Sep 30, 2027)", intro: 'Five goals for this year, each the first step on its 3-year goal. Owners report against the quarterly checkpoints at each board meeting.', note: 'The FY27 budget, the Keela notice date (by Dec 5 to beat the Dec 19 renewal) and the Canada Summer Jobs window are fixed by outside dates; the rest are our proposals for the board.' }, updated_at: now });
  fx.goal_year_targets = []; fx.goal_checkpoints = [];
  let cid = 600;
  TARGETS.forEach(t => {
    const tid = 550 + t[0];
    fx.goal_year_targets.push({ id: tid, goal_id: G(t[0]), fy: 'FY27', body: t[1], owners: t[2], sort: t[0], updated_at: now, updated_by: 'wave207 migration', archived_at: null });
    t[3].forEach((b, q) => fx.goal_checkpoints.push({ id: ++cid, target_id: tid, goal_id: G(t[0]), quarter: q + 1, due_date: DUE[q], body: b, status: 'not started', updated_at: now, updated_by: 'wave207 migration', archived_at: null }));
  });
  /* the project page: Program Development as live (04/10/26) */
  const g19 = fx.goals.find(g => g.id === 19);
  const dept = (g19 && g19.department) || 'progdev';
  fx.projects.forEach(p => { if (p.id === 3 || p.id === 4) { p.department = dept; p.goal_id = G(2); } });
  if (g19) g19.moved_to_project_id = 31;
  fx.projects.push({ id: 31, department: dept, parent_id: null, name: g19 ? g19.title : 'Implement a comprehensive beneficiary feedback system', description: 'Made from a retired goal.', status: 'active', goal_id: G(2), sort: 40, leads: [], workstream: null, milestone_id: null, checkpoint_id: null, created_at: now, updated_at: now });
  const T = (tid, title, project, extra) => fx.dept_tasks.push(Object.assign({ id: tid, department: dept, subsection: null, title, owner: 'Shima', status: 'Open', done: false, flag: false, priority: false, project_id: project, due_date: null, opened_at: '2026-09-01T12:00:00+00:00', sort: 5 }, extra || {}));
  T(9311, 'Enforce beneficiary data capture at every event (forms/QR)', 4, { subsection: 'Research and data' });
  T(9342, 'Explore beneficiary name and needs tracking system for service matching', 4);
  T(9621, 'Zachee to collect beneficiary data at Sunday events via questionnaires', 3, { subsection: 'Research and data' });
  T(9622, 'Reach out to local softball and flag football leagues for volunteer recruitment', null, { owner: 'Brianna' });
  T(9900, 'Write the feedback questionnaire for the Sunday services', 31, { done: false });
  fx.change_log = fx.change_log || [];
  fx.change_log.push({ id: 99001, entity_type: 'goal', entity_id: '19', field: 'moved_to_project', old_value: 'x', new_value: 'project 31', changed_by: 'steel.macdonald@welfareavenue.com', changed_at: '2026-10-04T20:20:58+00:00' });
  if (o.emptyProject !== false) fx.dept_tasks = fx.dept_tasks.filter(t => t.id !== 9900);
  return fx;
}
module.exports = { build, ACTS, LINKS, TARGETS, DUE };
