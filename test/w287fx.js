/* w287fx.js: the fixture for the wave287 drive and screenshots (test/w287drive.js, test/w287shots.js).
   A copy of test/fixture.json shaped the way wa287a_projects.sql leaves the data: projects.is_general (one per team), projects.workstream,
   the six new projects (General Finance, Bills and receipts, Organizational structure, Content, General Program Development, Community
   team), Survey Project and Beneficiary Feedback Project in Program Development, and enough tasks per team to show overdue, due today, this
   week, later, no date, flagged, done, a subtask, sub-projects, a cross-team project, a task with no project, a long title and a long
   project name. The page's clock (test/boot.js) is Friday 25/09/26 16:00 Toronto. Every person is the fixture's own; no real data is added.
   fx287() returns a fresh object each time; EXPECT(fx, dept, me) computes the sidebar counts the drive checks, with the page's own rules. */
const { loadFixture } = require('./boot');

const TODAY = '2026-09-25';
const day = (n) => new Date(Date.UTC(2026, 8, 25) + n * 86400000).toISOString().slice(0, 10);
const NEW_PROJECTS = [
  [24, 'finance', 'General Finance', null, true, null],
  [25, 'finance', 'Bills and receipts', 'Bills and receipts', false, null],
  [26, 'hr', 'Organizational structure', 'Organizational structure', false, null],
  [27, 'marketing', 'Content', 'Content', false, ['Joy', 'Ian']],
  [28, 'progdev', 'General Program Development', null, true, null],
  [29, 'progdev', 'Community team', 'Community team', false, null],
  [31, 'progdev', 'Implement a comprehensive beneficiary feedback system by August 30, 2026, collecting input from at least 200 people we serve across all programs', null, false, null],
  [32, 'opsmtl', 'Volunteer Relations', null, false, ['Ahmed']],
  [33, 'opsmtl', 'Community Kitchen Pilot', null, false, ['Mary']]
];
const WS = { 5: 'Branding', 6: 'Website', 15: 'Digital advertising and Google Ads', 18: 'General', 3: 'Research and data', 4: 'Beneficiary programs', 8: 'Onboarding and recruitment', 9: 'Onboarding and recruitment', 2: 'Fundraising events', 23: 'Grants', 1: 'Donor program' };
const GENERAL = [16, 17, 18, 19, 20, 21];

/* [id, dept, project, title, due (days from today or null), owner, extra] */
const TASKS = [
  /* Marketing */
  [5001, 'marketing', 27, 'Draft the October newsletter', -2, 'Joy', { assignees: [22, 17], comments: 2 }],
  [5002, 'marketing', 27, 'Post the serving recap reel', 0, 'Andrea', {}],
  [5003, 'marketing', 5, 'Approve the new logo lockups', 1, 'Ian', { flag: true, reason_note: 'Two options; Steel picks one' }],
  [5004, 'marketing', 6, 'Update the volunteer page copy on the website', 5, 'Kahkashan', { status: 'In progress' }],
  [5005, 'marketing', 15, 'Set up conversion tracking for Ad Grants', 20, 'Robert', {}],
  [5006, 'marketing', 13, 'Promo graphics for the Gift Basket Drive', 3, 'Soraya', {}],
  [5007, 'marketing', 19, 'Check the brand colours in Canva', null, 'Steel', {}],
  [5008, 'marketing', 27, 'Write the captions for the volunteer spotlight series, one per week until the end of the year, with the quotes the volunteers sent in after the September servings', null, 'Patricia', { status: 'Waiting' }],
  [5009, 'marketing', 27, 'Publish the September newsletter', -6, 'Joy', { done: true, closed: '2026-09-20' }],
  [5010, 'marketing', 5, 'Refresh the LinkedIn banner', null, 'Ian', { done: true, closed: '2026-09-10' }],
  [5011, 'marketing', null, 'A task saved before wave287, with no project', 9, 'Alejandra', { subsection: 'Branding' }],
  [5012, 'marketing', 27, 'Collect three partner quotes', -1, 'Joy', { parent: 5001 }],
  /* Operations Montreal */
  [5101, 'opsmtl', 32, 'Confirm the Saturday serving roster', 0, 'Ahmed', { assignees: [1, 5] }],
  [5102, 'opsmtl', 18, 'Order food for the 3 October serving', -3, 'Terry', { flag: true, comments: 1 }],
  [5103, 'opsmtl', 33, 'Book the health inspection for the kitchen pilot', 7, 'Mary', {}],
  [5104, 'opsmtl', 32, 'Thank-you texts to last week’s volunteers', -4, 'Ahmed', { done: true, closed: '2026-09-21' }],
  [5105, 'opsmtl', 18, 'Count the storage room inventory', null, 'Steel', {}],
  [5106, 'opsmtl', 3, 'Ask the people we serve about the hot meals', 12, 'Mary', {}],
  [5107, 'opsmtl', 33, 'Kitchen pilot: list the equipment we still need', 2, 'Terry', { status: 'Blocked' }],
  /* Fundraising */
  [5201, 'fundraising', 12, 'Book the field for Flag Football', -1, 'Daniela', { subsection: 'Fundraising events' }],
  [5202, 'fundraising', 11, 'Draft the Rally Paper route map', 4, 'Cindy', { subsection: 'Fundraising events' }],
  [5203, 'fundraising', 13, 'First outreach list of gift basket sponsors', 0, 'Daniela', { subsection: 'Fundraising events' }],
  [5204, 'fundraising', 1, 'Thank-you calls to September donors', 15, 'Daniela', { flag: true, subsection: 'Donor program' }],
  [5205, 'fundraising', 20, 'Update the fundraising tracker', null, 'Cindy', {}],
  [5206, 'fundraising', 23, 'Submit the Montreal foundation report', 5, 'Suhaib', { subsection: 'Grants' }],
  [5207, 'fundraising', 2, 'Pick the date for the spring gala', 30, 'Steel', { subsection: 'Fundraising events' }],
  /* Program Development */
  [5301, 'progdev', 3, 'Clean the survey answers from September', -5, 'Shima', {}],
  [5302, 'progdev', 29, 'Meet the two community leads in Saint-Michel', 6, 'Ola', {}],
  [5303, 'progdev', 28, 'Write the program development one-pager', null, 'Brianna', {}],
  /* Human Resources */
  [5401, 'hr', 26, 'Update the org chart after the fall cohort', 3, 'Valex', {}],
  [5402, 'hr', 8, 'Welcome pack for the October starters', -2, 'Natasha', {}],
  /* Operations Toronto, Board, Finance */
  [5501, 'opsto', 16, 'Find a second serving location in Toronto', 10, 'Tate', {}],
  [5601, 'board', 21, 'Circulate the October board pack', 8, 'Steel', {}],
  [5701, 'finance', 25, 'File the September receipts', -1, 'Steel', {}],
  [5702, 'finance', 24, 'Close the books for the quarter', 6, 'Steel', {}]
];

function fx287() {
  const fx = JSON.parse(JSON.stringify(loadFixture()));
  fx.projects.forEach((p) => {
    p.is_general = GENERAL.indexOf(Number(p.id)) >= 0;
    if (WS[p.id]) p.workstream = WS[p.id];
    if (p.id === 3 || p.id === 4) p.department = 'progdev';
  });
  NEW_PROJECTS.forEach(([id, d, name, ws, gen, leads], i) => fx.projects.push({ id, name, sort: 10 + i, status: 'active', goal_id: null, parent_id: null, created_at: '2026-11-06T12:00:00+00:00', department: d, updated_at: '2026-11-06T12:00:00+00:00', description: null, leads, workstream: ws, is_general: gen }));
  fx.projects.filter((p) => p.id === 2).forEach((p) => { p.leads = ['Daniela', 'Cindy']; });
  fx.projects.filter((p) => p.id === 5).forEach((p) => { p.leads = ['Ian']; });
  fx.task_assignees = fx.task_assignees || []; fx.task_comments = fx.task_comments || [];
  TASKS.forEach(([id, d, pid, title, due, owner, x]) => {
    const done = !!x.done;
    fx.dept_tasks.push({ id, done, flag: !!x.flag, sort: id, owner, title, status: done ? 'Done' : (x.status || 'Open'), due_date: due == null ? null : day(due), priority: false, closed_at: done ? x.closed + 'T15:00:00+00:00' : null, opened_at: '2026-09-01T12:00:00+00:00', board_only: false, department: d, project_id: pid, subsection: x.subsection || null, updated_at: done ? x.closed + 'T15:00:00+00:00' : '2026-09-20T12:00:00+00:00', updated_by: 'Steel MacDonald', visibility: null, reason_note: x.reason_note || null, confidential: false, allowed_people: null, reason_category: null, parent_task_id: x.parent || null, description: null });
    (x.assignees || []).forEach((m) => fx.task_assignees.push({ task_id: id, member_id: m }));
    for (let c = 0; c < (x.comments || 0); c++) fx.task_comments.push({ id: id * 10 + c, task_id: id, body: 'Comment ' + (c + 1) + ' on this task', author: 'Steel MacDonald', source: 'manual', created_at: '2026-09-2' + c + 'T12:00:00+00:00' });
  });
  return fx;
}

/* the page's rules, for the drive's expected counts */
function generalOf(fx, d) { return fx.projects.filter((p) => p.department === d && p.is_general)[0] || null; }
function effPid(fx, t) { const p = t.project_id ? fx.projects.filter((x) => Number(x.id) === Number(t.project_id))[0] : null; if (p) return Number(p.id); const g = generalOf(fx, t.department); return g ? Number(g.id) : 0; }
function EXPECT(fx, d, meName, meId, rows) {
  rows = rows || fx.dept_tasks.filter((t) => t.department === d);
  const open = rows.filter((t) => !t.done);
  const mine = (t) => String(t.owner || '').toLowerCase() === meName.toLowerCase() || String(t.owner || '').toLowerCase() === meName.split(' ')[0].toLowerCase() || fx.task_assignees.some((a) => Number(a.task_id) === Number(t.id) && Number(a.member_id) === Number(meId));
  const out = { today: open.filter((t) => t.due_date && t.due_date <= TODAY).length, scheduled: open.filter((t) => t.due_date).length, all: open.length, flagged: open.filter((t) => t.flag).length, mine: open.filter(mine).length, completed: rows.filter((t) => t.done).length, projects: {} };
  open.forEach((t) => { const k = effPid(fx, t); out.projects[k] = (out.projects[k] || 0) + 1; });
  return out;
}

module.exports = { fx287, EXPECT, effPid, generalOf, TODAY, day };
