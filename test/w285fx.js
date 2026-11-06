/* w285fx.js: the fixtures for the wave285 drive (test/w285drive.js), built through the same data boundary the page reads: test/boot.js's tables
   (window.__WAFIX, read by the stubbed Supabase client), its rpcs (window.__WA_RPCS: wa271_ready_list, wa275_my_cards, onboarding_lead_view) and the
   stand-ins for onboard-run (test/w271fx.js INIT, test/w275fx.js INIT275). No real person: every hire and manager is made up. The page's clock is
   Friday 25/09/26 16:00 Toronto.
   Sets (fx285(name)):
   - demo: a cohort like the live one: one offer out (the manager has not proposed times), five hires starting with their Slack channel for HR,
     Alix (the same plan shape and ticks as Alyx's live plan, onboarding 4: Weeks 1 to 4 = 24 of 41, the whole plan 24 of 53; W1 9/14, W2 9/12,
     W3 6/9, W4 0/6, 60 days 0/7, 90 days 0/5; her Academy "Your onboarding" 8 of 10), Zak (5 weeks in, nothing ticked: behind by more than a
     week), one finished this month.
   - rules: the progress rule's cases: Ada (an Academy step finished but not ticked: 2 of 3), Sam (no flow: the setup steps count: 3 of 4),
     Fay (a flow whose setup is not finished: the setup steps do not count: 0 of 3), Kofi (week 1 ended 4 days ago with 2 open: behind, not yet in
     Needs you), Alix again.
   - worst: long names and roles (Aleksandra Wiśniewska-Kowalczyk, a manager with a very long name), a long unbreakable address in a failed Google
     step, Jo (no manager, no role), a backed-out hire, Mo (a plan with no steps), Tri (3 weeks behind), Søren 李 🌱 (1 step overdue), a practice
     hire, an old-path offer, exactly one finished, the first password not set.
   - empty: nobody. one: a single offer out. forty: forty hires.
   - home: Joy (boot.js's plain member) manages Alix (a plan, the lead's card with her moments), Kim (an offer: Joy to propose times) and Lee
     (starting); the database refuses her HR's list (NOT_HR). */
const { loadFixture } = require('./boot');
const { INIT } = require('./w271fx');
const { INIT275, NOT_HR } = require('./w275fx');

const T0 = '2026-09-25';
const day = (s, n) => new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) + n * 86400000).toISOString().slice(0, 10);
const SECD = { 'WEEK 1': 7, 'WEEK 2': 14, 'WEEK 3': 21, 'WEEK 4': 28, '60 DAYS': 60, '90 DAYS': 90 };
const RANK = { 'WEEK 1': 1, 'WEEK 2': 2, 'WEEK 3': 3, 'WEEK 4': 4, '60 DAYS': 5, '90 DAYS': 6 };
/* Alyx's live plan (onboarding 4, 06/11/26): [template id, name, section, parent, training_id, academy_path, setup_covered, done] */
const TPL = [
  ['wa167w1', 'Start here: Welcome to Welfare Avenue', 'WEEK 1', null, 222, null, false, 1],
  ['wa166hub', 'The Hub', 'WEEK 1', null, null, null, false, 0],
  ['wa166hubfirst', "The Hub's first steps", 'WEEK 1', 'wa166hub', null, null, false, 0],
  ['86e1cj9gj', 'Chrome and your Welfare Avenue account', 'WEEK 1', null, null, null, true, 1],
  ['86e1cj9gp', 'Download Chrome', 'WEEK 1', '86e1cj9gj', 212, null, true, 1],
  ['86e1cj9gy', 'Google Groups', 'WEEK 1', '86e1cj9gj', null, null, true, 1],
  ['86e1cj9gh', 'Policies', 'WEEK 1', null, null, 'policies', false, 0],
  ['86e1cj9gn', "The Loop: I'm in, close the loop (every time you work)", 'WEEK 1', '86e1cj9gh', 216, null, false, 1],
  ['86e1cj9gq', 'Performance and discipline tracking', 'WEEK 1', '86e1cj9gh', 217, null, false, 1],
  ['86e1cj9h0', 'Slack', 'WEEK 1', null, null, null, false, 1],
  ['86e1cj9h3', 'Download Slack', 'WEEK 1', '86e1cj9h0', null, null, true, 1],
  ['86e1cj9h2', 'Understanding Slack, part 1', 'WEEK 1', '86e1cj9h0', 213, null, false, 1],
  ['wa166slack2', 'Understanding Slack, part 2: your profile', 'WEEK 1', '86e1cj9h0', 214, null, false, 1],
  ['86e1cj9hc', 'Slack notifications', 'WEEK 1', '86e1cj9h0', 215, null, false, 1],
  ['86e1cj9ha', 'Continuous improvement', 'WEEK 1', null, null, null, false, 0],
  ['86e1cj9he', 'Intros', 'WEEK 1', null, null, null, false, 0],
  ['86e1cj9hh', 'Loom', 'WEEK 1', null, null, null, false, 0],
  ['wa272appsetup', 'Turn on Hub notifications', 'WEEK 1', null, null, null, false, 0],
  ['wa167w2', 'Start here: Who we are', 'WEEK 2', null, 223, null, false, 1],
  ['86e1cj9h6', 'About Welfare Avenue', 'WEEK 2', null, null, null, false, 0],
  ['wa166found', 'Welfare Avenue foundations (Avenue Academy)', 'WEEK 2', null, null, 'foundations', false, 1],
  ['wa166brand', 'Our brand (Avenue Academy)', 'WEEK 2', null, null, 'branding', false, 1],
  ['wa279t205', 'Page tour: the apps', 'WEEK 2', null, 205, null, false, 1],
  ['wa279t68', 'Page tour: Org chart', 'WEEK 2', null, 68, null, false, 1],
  ['wa166work', 'Your work in the Hub', 'WEEK 2', null, 40, null, false, 1],
  ['86e1cj9h8', 'Optimizing and organizing your Slack', 'WEEK 2', null, 94, null, false, 1],
  ['wa279t119', 'A walk through our Google Drive', 'WEEK 2', null, 119, null, false, 1],
  ['86e1cj9gm', 'Your Canva folders', 'WEEK 2', null, null, null, false, 0],
  ['86e1cj9gv', 'Google Photos', 'WEEK 2', null, null, null, false, 0],
  ['86e1cj9gr', 'Setting up a meeting', 'WEEK 2', null, 115, null, false, 1],
  ['wa167w3', 'Start here: Working with your team', 'WEEK 3', null, 224, null, false, 0],
  ['wa166usehub', 'Using the Hub (Avenue Academy)', 'WEEK 3', null, null, 'hub', false, 1],
  ['86e1cj9hg', 'Mandatory volunteering', 'WEEK 3', null, null, null, false, 0],
  ['86e1cj9hm', 'Understanding Montreal programming', 'WEEK 3', '86e1cj9hg', null, null, false, 0],
  ['wa279t71', 'Page tour: Volunteering', 'WEEK 3', null, 71, null, false, 1],
  ['wa166meeting', "Find your team's meeting in the Hub", 'WEEK 3', null, null, null, false, 0],
  ['wa279t122', 'Group emails: sending as a team address', 'WEEK 3', null, 122, null, false, 1],
  ['wa279t103', 'Searching Slack like a pro', 'WEEK 3', null, 103, null, false, 1],
  ['wa279t82', 'Page tour: Calendar', 'WEEK 3', null, 82, null, false, 1],
  ['wa279t201', 'Page tour: Document finder', 'WEEK 3', null, 201, null, false, 1],
  ['wa167w4', 'Start here: Look back, look ahead', 'WEEK 4', null, 225, null, false, 0],
  ['86e1cj9ht', 'About Welfare Avenue (in depth)', 'WEEK 4', null, null, null, false, 0],
  ['86e1cj9hx', 'Charitable activities', 'WEEK 4', '86e1cj9ht', null, null, false, 0],
  ['86e1cj9hr', 'Quiz', 'WEEK 4', null, null, null, false, 0],
  ['86e1cj9hv', 'Policy quiz', 'WEEK 4', '86e1cj9hr', null, null, false, 0],
  ['86e1cj9hw', '30 day quiz', 'WEEK 4', '86e1cj9hr', null, null, false, 0],
  ['86e1cj9hz', 'Self-assessment', 'WEEK 4', null, null, null, false, 0],
  ['wa279t126', 'Member reimbursements', 'WEEK 4', null, 126, null, false, 0],
  ['86e1cj9j1', 'How charities function', '60 DAYS', null, null, null, false, 0],
  ['86e1cj9j3', 'Basics', '60 DAYS', '86e1cj9j1', null, null, false, 0],
  ['86e1cj9j4', 'Charitable receipts', '60 DAYS', '86e1cj9j1', 8, null, false, 0],
  ['wa279t121', 'The difference between a nonprofit and a charity', '60 DAYS', null, 121, null, false, 0],
  ['wa279t120', 'The board of directors: what it is and what it does', '60 DAYS', null, 120, null, false, 0],
  ['86e1cj9j6', 'Meet one of our co-executive directors', '60 DAYS', null, null, null, false, 0],
  ['wa279serving', 'Your first serving', '60 DAYS', null, null, null, false, 0],
  ['wa279role60', 'Your role trainings', '60 DAYS', null, null, 'role60', false, 0],
  ['wa279role90', 'Your role trainings', '90 DAYS', null, null, 'role90', false, 0],
  ['wa279t148', 'Meetings with external partners (our SOP)', '90 DAYS', null, 148, null, false, 0],
  ['wa279review', 'Your 90-day review', '90 DAYS', null, null, null, false, 0],
  ['wa279share', 'Share one thing you know', '90 DAYS', null, null, null, false, 0],
  ['wa279feedback', 'Tell us how onboarding went', '90 DAYS', null, null, null, false, 0],
  /* the rules set's own steps */
  ['w285a1', 'Academy module: our voice', 'WEEK 1', null, 9605, null, false, 0],
  ['w285a2', 'Meet your manager', 'WEEK 1', null, null, null, false, 0],
  ['w285a3', 'Read the volunteer handbook', 'WEEK 1', null, null, null, false, 0],
];
const HEADERS = ['wa166hub', '86e1cj9gj', '86e1cj9gh', '86e1cj9h0', '86e1cj9hg', '86e1cj9ht', '86e1cj9hr', '86e1cj9j1'];
const ALYX = TPL.filter((t) => !/^w285/.test(t[0]));
function template() {
  return TPL.map((t, i) => ({ id: t[0], name: t[1], section: t[2], parent_id: t[3], training_id: t[4], academy_path: t[5], setup_covered: t[6], sort: (i + 1) * 10, active: true, priority: null, description: '', content_pending: false }));
}

let SID = 70000;
/* a plan: the onboarding row and its steps (done: a function of the template row, or 'alyx' for her ticks) */
function planRows(onbId, mid, name, start, done, o) {
  o = o || {};
  const rows = (o.only ? TPL.filter((t) => o.only.indexOf(t[0]) >= 0) : ALYX);
  const steps = rows.map((t) => {
    const d = done === 'alyx' ? !!t[7] : typeof done === 'function' ? !!done(t) : !!done;
    return { id: SID++, onboarding_id: onbId, template_id: t[0], done: d, done_at: d ? '2026-09-24T15:00:00Z' : null, done_by: d ? name : null, due_date: day(start, SECD[t[2]]) };
  });
  return { onb: { id: onbId, member_id: mid, person_name: name, status: o.status || 'active', started_at: start, assigned_by: 'Fixture', note: null, completed_at: o.completed_at || null }, steps: o.none ? [] : steps };
}
/* the lead's card (onboarding_lead_view) for a plan: the steps in the database's order (section, the parent's sort, a header before its children) */
function leadSteps(plan) {
  const t = {}; template().forEach((x) => { t[x.id] = x; });
  return plan.steps.map((s) => { const x = t[s.template_id], p = x.parent_id ? t[x.parent_id] : null; return { s, x, rank: RANK[x.section], psort: p ? p.sort : x.sort, child: !!x.parent_id }; })
    .sort((a, b) => a.rank - b.rank || a.psort - b.psort || (a.child - b.child) || a.x.sort - b.x.sort)
    .map((r) => ({ id: r.s.id, name: r.x.name, section: r.x.section, child: r.child, done: r.s.done, due: r.s.due_date, academy: !!(r.x.training_id || r.x.academy_path), important: false }));
}

/* created_at: before automatic setup began (V2) unless said otherwise: an existing member, so their plan's setup steps count */
const V2 = '2026-09-01T00:00:00Z', BEFORE = '2026-07-01T12:00:00Z', AFTER = '2026-09-20T12:00:00Z';
const MEMBER = (id, name, dept, role, email, made) => ({ id, name, email: email || name.toLowerCase().replace(/[^a-z]+/g, '.') + '@example.invalid', active: true, department: dept, role, responsibilities: [], created_at: made === 'none' ? null : (made || BEFORE) });
const STEP = (flow, step, status, detail) => ({ flow_id: flow, step, status, detail: detail || null, practice: false, at: '2026-09-25T18:00:00Z', by: 'hr@example.invalid' });
const ALL = ['roster', 'google', 'hub', 'plan', 'invites', 'manager', 'welcome', 'groups', 'drives', 'meeting'];
function startedSteps(flow, over) { return ALL.map((k) => STEP(flow, k, (over && over[k] && over[k][0]) || 'done', (over && over[k] && over[k][1]) || 'Done.')).concat([STEP(flow, 'slack', (over && over.slack && over.slack[0]) || 'hr_task', 'Create their onboarding channel in Slack, add the manager and HR, and post the welcome message.'), STEP(flow, 'channel', 'pending', 'waiting for them to join Slack')]); }
const RD = ['google', 'chrome', 'bookmarks', 'drive', 'groups', 'hub', 'slack', 'canva', 'academy', 'jd', 'weekly', 'phone'];
const TICKS = (n) => { const o = {}; RD.slice(0, n).forEach((k) => { o['rd_' + k] = '2026-09-24T17:00:00Z'; }); return o; };
/* a row of wa271_ready_list / wa275_my_cards (the shape of wa275_flow_row) */
function row(o) {
  return Object.assign({
    flow_id: 0, candidate_id: 0, status: 'waiting', practice: false, name: '', role: '', email: 'x@example.invalid', accepted_on: '2026-09-22', offer_respond_by: null, offer_start: null, late: false,
    grids: { hire: 'none', manager: 'none' }, call_at: null, one_on_one_at: null, manager_member_id: null, manager_name: null, default_manager: null, other_open_rows: 0,
    offer_hours: 6, hours_confirmed_at: null, proposed_call_at: null, proposed_one_on_one_at: null, proposed_by: null, proposed_at: null, hire_answer: null, hire_answered_at: null,
    ask_availability: true, setup_ticks: {}, welcome_sent_at: null, accounts_at: null, manager_availability_at: '2026-09-10T12:00:00Z', manager_no_week: false, manager_week_stale: false,
    offer_sent_at: '2026-09-21T15:00:00Z', created_at: '2026-09-21T15:00:00Z', propose_path: true, member_id: null, wa_email: null, canva_link: null, roster_created: null, slack_channel_id: null,
    onboarding_id: null, group_session: null, started_at: null, updated_at: '2026-09-22T14:00:00Z', steps: [], leader: null, welcome_cc: [], offer_sent_by: null, owner_email: null,
  }, o);
}

function base(o) {
  const fx = JSON.parse(JSON.stringify(loadFixture()));
  fx.onboardings = o && o.keepSteel ? (fx.onboardings || []) : [];
  fx.onboarding_steps = [];
  fx.onboarding_template = template();
  fx.hr_setup_steps = []; fx.onboarding_help = [];
  fx.hub_candidates = (fx.hub_candidates || []).filter((c) => c.status !== 'offer' && c.status !== 'hired');
  fx.hub_onboard_flows = []; fx.hub_onboard_steps = [];
  fx.org_positions = [];
  fx.team_members = (fx.team_members || []).filter((m) => !/joy\.dumansi/i.test(m.email || ''));
  fx.team_members.push(MEMBER(9104, 'Joy Dumansi', 'marketing', 'Coordinator', 'joy.dumansi@welfareavenue.com', o && o.joyNew ? '2026-09-15T12:00:00Z' : BEFORE));
  fx.app_config = (fx.app_config || []).filter((x) => x.key !== 'onboard_v2_since').concat([{ key: 'onboard_v2_since', value: V2 }]);
  /* the Academy: "Your onboarding" (10 trainings) for Alix's Academy tab, and one more for the rules set */
  fx.academy_paths = (fx.academy_paths || []).concat([{ id: 9701, key: 'firstweek', name: 'Your onboarding', title: 'Your onboarding', active: true, required: true, sort: 0, dept: null }]);
  fx.trainings = (fx.trainings || []).concat(Array.from({ length: 10 }, (_, i) => ({ id: 9601 + i, title: 'Your onboarding ' + (i + 1), path_group: 'Your onboarding', active: true, kind: 'video', category: 'Onboarding', minutes: 5, sort: 900 + i, body: null, source: 'hub' })));
  return fx;
}
function addPlan(fx, P) { fx.onboardings.push(P.onb); fx.onboarding_steps = fx.onboarding_steps.concat(P.steps); return P; }
function addStarted(fx, o) {
  /* a flow Start (or Book) began: the page reads it from the tables, as wave271 does */
  fx.hub_candidates.push({ id: o.cand, name: o.name, role: o.role || '', email: o.email || 'hire' + o.cand + '@example.invalid', status: 'hired', practice: !!o.practice, member_id: o.mid });
  fx.hub_onboard_flows.push(Object.assign({ id: o.flow, candidate_id: o.cand, practice: !!o.practice, status: o.status || 'started', manager_member_id: o.mgr || null, wa_email: o.wa_email || null, call_at: o.call_at || '2026-09-29T23:00:00Z',
    one_on_one_at: o.one || '2026-09-30T14:00:00Z', group_session: null, onboarding_id: o.onb || null, started_at: '2026-09-24T15:00:00Z', roster_created: true, created_at: '2026-09-20T15:00:00Z', setup_ticks: TICKS(o.ticks || 0),
    welcome_sent_at: '2026-09-24T16:00:00Z', proposed_at: '2026-09-22T15:00:00Z', leader: false, updated_at: o.updated_at || '2026-09-24T15:00:00Z', slack_channel_id: o.slack || null }, o.extra || {}));
  fx.hub_onboard_steps = fx.hub_onboard_steps.concat(o.steps || startedSteps(o.flow));
  if (o.mid) { fx.team_members.push(MEMBER(o.mid, o.name, o.dept || 'progdev', o.role || null, o.wa_email || null, o.made || AFTER)); }
}
function pos(fx, id, mid, title, reportsTo) { fx.org_positions.push({ id, member_id: mid, title, department: null, reports_to: reportsTo || null, kind: 'role', status: 'filled', note: null, sort: id }); }

function fx285(name) {
  const fx = base({ keepSteel: name === 'demo', joyNew: false }), ready = [], extra = {};
  const tp = (fx.training_progress = fx.training_progress || []);
  const MG = { sima: 9801, vera: 9802, amina: 9803, ahmet: 9804 };
  [[MG.sima, 'Sima Hale', 'progdev', 'Program Development Lead'], [MG.vera, 'Vera Lund', 'hr', 'HR Lead'], [MG.amina, 'Amina Dorr', 'fundraising', 'Director of Fundraising'], [MG.ahmet, 'Ahmet Fakir', 'opsmtl', 'Operations lead']]
    .forEach((m) => fx.team_members.push(MEMBER(m[0], m[1], m[2], m[3])));
  pos(fx, 9701, MG.sima, 'Program Development Lead'); pos(fx, 9703, MG.amina, 'Director of Fundraising');
  let pw = { set: true, set_at: '2026-09-01T12:00:00Z' };
  const alix = () => {
    fx.team_members.push(MEMBER(9811, 'Alix Denby', 'fundraising', 'Fundraising', 'alix.denby@example.invalid'));
    pos(fx, 9711, 9811, 'Fundraising Associate', 9703);
    addPlan(fx, planRows(701, 9811, 'Alix Denby', '2026-09-23', 'alyx'));
    for (let i = 0; i < 10; i++) tp.push({ id: 99000 + i, training_id: 9601 + i, person_name: 'Alix Denby', email: 'alix.denby@example.invalid', status: i < 8 ? 'done' : 'assigned', done_at: i < 8 ? '2026-09-24T12:00:00Z' : null });
  };
  if (name === 'demo' || name === 'rules') alix();
  if (name === 'demo') {
    ready.push(row({ flow_id: 801, candidate_id: 8801, status: 'offered', name: 'Samir Aubert', role: 'Kitchen Coordinator', accepted_on: null, offer_sent_at: '2026-09-22T15:00:00Z', manager_member_id: MG.sima, manager_name: 'Sima Hale' }));
    fx.hub_candidates.push({ id: 8801, name: 'Samir Aubert', role: 'Kitchen Coordinator', email: 'samir@example.invalid', status: 'offer', practice: false, offer_sent_at: '2026-09-22T15:00:00Z', accepted_on: null });
    [['Rana Bouchard', 'HR Consultant', MG.vera, 7], ['Alban Hu', 'Director of Fundraising', MG.amina, 0], ['Adele Yordan', 'Operations Manager', MG.sima, 2], ['Vasu Gadi', 'Program Development Co-Lead', MG.sima, 1], ['Soren Fieldman', 'Operations Assistant', MG.ahmet, 0]]
      .forEach((h, i) => {
        addPlan(fx, planRows(711 + i, 9821 + i, h[0], '2026-09-29', false));
        addStarted(fx, { flow: 811 + i, cand: 8811 + i, mid: 9821 + i, name: h[0], role: h[1], mgr: h[2], ticks: h[3], onb: 711 + i, wa_email: h[0].toLowerCase().replace(' ', '.') + '@welfareavenue.com' });
      });
    fx.team_members.push(MEMBER(9812, 'Zak Leon', 'progdev', 'Community team lead', 'zak.leon@example.invalid'));
    pos(fx, 9712, 9812, 'Community team lead', 9701);
    addPlan(fx, planRows(702, 9812, 'Zak Leon', '2026-08-20', false));
    fx.onboarding_help = [{ id: 7701, onboarding_id: 701, step_name: 'Loom', note: 'I cannot find the Loom invite', status: 'open', created_at: '2026-09-24T15:00:00Z' }];
    fx.team_members.push(MEMBER(9813, 'Fin Ished', 'marketing', 'Writer'));
    addPlan(fx, planRows(703, 9813, 'Fin Ished', '2026-06-10', true, { status: 'completed', completed_at: '2026-09-10T15:00:00Z' }));
  }
  if (name === 'rules') {
    fx.team_members.push(MEMBER(9815, 'Ada Academy', 'marketing', 'Writer', 'ada@example.invalid'));
    addPlan(fx, planRows(705, 9815, 'Ada Academy', '2026-09-22', (t) => t[0] === 'w285a2', { only: ['w285a1', 'w285a2', 'w285a3'] }));
    tp.push({ id: 99100, training_id: 9605, person_name: 'Ada Academy', email: 'ada@example.invalid', status: 'done', done_at: '2026-09-24T12:00:00Z' });
    fx.team_members.push(MEMBER(9816, 'Sam Setup', 'marketing', 'Writer'));
    addPlan(fx, planRows(706, 9816, 'Sam Setup', '2026-09-22', false, { only: ['86e1cj9gj', '86e1cj9gp', '86e1cj9gy', '86e1cj9h3', 'w285a3'] }));
    addPlan(fx, planRows(716, 9817, 'Fay Flow', '2026-09-21', false, { only: ['86e1cj9gj', '86e1cj9gp', '86e1cj9gy', 'w285a3'] }));
    addStarted(fx, { flow: 816, cand: 8816, mid: 9817, name: 'Fay Flow', role: 'Writer', mgr: MG.vera, ticks: 5, onb: 716, call_at: '2026-09-21T14:00:00Z', steps: startedSteps(816, { slack: ['done'] }) });
    /* never complete early (review finding 1): every row ticked but the setup steps, and one step left that the drive ticks */
    const allBut = (open) => (t) => !(t[6] && HEADERS.indexOf(t[0]) < 0) && t[0] !== open;
    fx.team_members.push(MEMBER(9818, 'Hana Hire', 'marketing', 'Writer', 'hana@example.invalid', '2026-09-10T12:00:00Z'));   /* made after automatic setup began, no flow in memory */
    addPlan(fx, planRows(718, 9818, 'Hana Hire', '2026-09-12', allBut('86e1cj9hh')));
    addPlan(fx, planRows(719, 9819, 'Otto Oldflow', '2026-08-12', allBut('86e1cj9hh')));
    addStarted(fx, { flow: 819, cand: 8819, mid: 9819, name: 'Otto Oldflow', role: 'Writer', mgr: MG.vera, ticks: 3, onb: 719, call_at: '2026-08-12T14:00:00Z', made: '2026-09-02T12:00:00Z', steps: startedSteps(819, { slack: ['done'] }) });   /* call 44 days ago: wave271 drops it */
    /* the hire's own view (Joy, an existing member): every real step ticked but week 1's lesson, which she finished in the Academy; headers and setup
       steps open in the table. Complete only once her training_progress is loaded */
    const real = (skip) => (t) => HEADERS.indexOf(t[0]) < 0 && !t[6] && skip.indexOf(t[0]) < 0;
    addPlan(fx, planRows(720, 9104, 'Joy Dumansi', '2026-09-16', real(['wa167w1'])));
    tp.push({ id: 99300, training_id: 222, person_name: 'Joy Dumansi', email: 'joy.dumansi@welfareavenue.com', status: 'done', done_at: '2026-09-24T12:00:00Z' });
    /* completing with headers and setup steps open in the table: Cara (an existing member) has every real step but one ticked */
    fx.team_members.push(MEMBER(9821, 'Cara Complete', 'marketing', 'Writer', 'cara@example.invalid'));
    addPlan(fx, planRows(721, 9821, 'Cara Complete', '2026-09-12', real(['86e1cj9hh'])));
    /* a flow more than 30 days past its call whose roster profile has no created_at: the cover is unknown */
    addPlan(fx, planRows(722, 9822, 'Uma Unknown', '2026-08-12', (t) => !(t[6] && HEADERS.indexOf(t[0]) < 0)));
    addStarted(fx, { flow: 822, cand: 8822, mid: 9822, name: 'Uma Unknown', role: 'Writer', mgr: MG.vera, ticks: 3, onb: 722, call_at: '2026-08-12T14:00:00Z', made: 'none', steps: startedSteps(822, { slack: ['done'] }) });
    fx.team_members.push(MEMBER(9814, 'Kofi Late', 'marketing', 'Writer'));
    let k = 0;
    addPlan(fx, planRows(704, 9814, 'Kofi Late', '2026-09-14', (t) => t[2] !== 'WEEK 1' ? false : (HEADERS.indexOf(t[0]) >= 0 || t[3] || ++k > 2)));
  }
  if (name === 'worst') {
    pw = { set: false, set_at: null };
    const MAX = 9831; fx.team_members.push(MEMBER(MAX, 'Maximiliano Fernández-Castellanos de la Vega y Montenegro', 'progdev', 'Program Development Lead'));
    ready.push(row({ flow_id: 831, candidate_id: 8831, name: 'Aleksandra Wiśniewska-Kowalczyk', role: 'Program Development Co-Lead and Community Partnerships Coordinator (Montréal and Toronto)', manager_member_id: MAX, manager_name: 'Maximiliano Fernández-Castellanos de la Vega y Montenegro',
      proposed_at: '2026-09-23T15:00:00Z', proposed_call_at: '2026-09-29T14:00:00Z', proposed_one_on_one_at: '2026-09-29T15:00:00Z', proposed_by: 'x@example.invalid', email: 'aleksandra.wisniewska-kowalczyk@example.invalid' }));
    fx.hub_candidates.push({ id: 8831, name: 'Aleksandra Wiśniewska-Kowalczyk', role: 'Program Development Co-Lead', email: 'a@example.invalid', status: 'offer', practice: false, offer_sent_at: '2026-09-21T15:00:00Z', accepted_on: '2026-09-22' });
    const LONG = 'bartholomew.fitzgerald@northwind-industries-holdings.example.com';
    addStarted(fx, { flow: 832, cand: 8832, mid: 9832, name: 'Bartholomew Fitzgerald-Northwind', role: 'Operations Assistant', mgr: MG.ahmet, ticks: 1, wa_email: LONG,
      steps: startedSteps(832, { google: ['failed', 'Google refused ' + LONG + ': that address is already taken. Choose another address, or press Retry.'], plan: ['waiting'] }) });
    fx.team_members.push(MEMBER(9833, 'Jo', null, null, 'jo@example.invalid'));
    addPlan(fx, planRows(733, 9833, 'Jo', '2026-09-24', 'alyx'));
    addStarted(fx, { flow: 834, cand: 8834, mid: 9834, name: 'Wes Backout', role: 'Driver', mgr: MG.vera, status: 'backed_out', updated_at: '2026-09-20T15:00:00Z', wa_email: 'wes.backout@welfareavenue.com', steps: startedSteps(834, { slack: ['done'] }) });
    fx.team_members.push(MEMBER(9835, 'Mo Zero', 'marketing', 'Designer'));
    addPlan(fx, planRows(735, 9835, 'Mo Zero', '2026-09-20', false, { none: true }));
    fx.team_members.push(MEMBER(9836, 'Tri Weeks', 'opsmtl', 'Cook'));
    pos(fx, 9736, 9836, 'Cook', 9701);
    addPlan(fx, planRows(736, 9836, 'Tri Weeks', '2026-08-10', false));
    fx.team_members.push(MEMBER(9837, 'Søren 李 🌱 Ødegård', 'marketing', 'Photographer'));
    let one = 0;
    addPlan(fx, planRows(737, 9837, 'Søren 李 🌱 Ødegård', '2026-09-10', (t) => t[2] === 'WEEK 1' ? !(t[3] === null && HEADERS.indexOf(t[0]) < 0 && ++one === 1) : t[2] === 'WEEK 2'));
    ready.push(row({ flow_id: 838, candidate_id: 8838, name: 'Pat Practice', role: 'Practice role', practice: true, propose_path: false, status: 'waiting', grids: { hire: 'marked', manager: 'none' }, default_manager: { member_id: MG.vera, name: 'Vera Lund', how: 'reports_to' } }));
    fx.hub_candidates.push({ id: 8839, name: 'Olu Offerson', role: 'Writer', email: 'olu@example.invalid', status: 'offer', practice: false, offer_sent_at: '2026-09-20T15:00:00Z', accepted_on: null });
    fx.team_members.push(MEMBER(9840, 'Una Done', 'marketing', 'Writer'));
    addPlan(fx, planRows(740, 9840, 'Una Done', '2026-06-10', true, { status: 'completed', completed_at: '2026-09-05T15:00:00Z' }));
  }
  if (name === 'one') ready.push(row({ flow_id: 851, candidate_id: 8851, status: 'offered', name: 'Ona Single', role: 'Cook', accepted_on: null, manager_member_id: MG.ahmet, manager_name: 'Ahmet Fakir', offer_sent_at: '2026-09-25T13:00:00Z' }));
  if (name === 'forty') {
    for (let i = 0; i < 35; i++) {
      const mid = 9900 + i, nm = 'Person ' + String(i + 1).padStart(2, '0') + ' ' + ['Abara', 'Bennett-Lowe', 'Castillo', 'Diallo', 'Eriksen', 'Fontaine', 'Gupta'][i % 7];
      fx.team_members.push(MEMBER(mid, nm, ['marketing', 'opsmtl', 'progdev', 'fundraising', 'hr'][i % 5], ['Writer', 'Cook', 'Driver', 'Coordinator', 'Designer'][i % 5]));
      pos(fx, 9800 + i, mid, 'Member', i % 2 ? 9701 : 9703);
      const start = day(T0, -((i * 3) % 85));
      addPlan(fx, planRows(900 + i, mid, nm, start, (t) => ((i + t[0].length) % 3) === 0));
    }
    for (let i = 0; i < 5; i++) {
      addPlan(fx, planRows(950 + i, 9950 + i, 'Starter ' + (i + 1), '2026-09-29', false));
      addStarted(fx, { flow: 960 + i, cand: 8960 + i, mid: 9950 + i, name: 'Starter ' + (i + 1), role: 'Volunteer Coordinator', mgr: MG.sima, ticks: i * 2, onb: 950 + i });
    }
  }
  if (name === 'home') {
    alix();
    tp.push({ id: 99200, training_id: 224, person_name: 'Alix Denby', email: 'alix.denby@example.invalid', status: 'done', done_at: '2026-09-24T12:00:00Z' });   /* week 3's lesson, finished, not ticked */
    fx.team_members.push(MEMBER(9861, 'Lee Starter', 'marketing', 'Designer', 'lee@example.invalid'));
    addPlan(fx, planRows(761, 9861, 'Lee Starter', '2026-09-29', false));
  }
  const homeRows = name === 'home' ? [
    row({ flow_id: 861, candidate_id: 8861, status: 'offered', name: 'Kim Newhire', role: 'Writer', accepted_on: null, manager_member_id: 9104, manager_name: 'Joy Dumansi', offer_sent_at: '2026-09-23T15:00:00Z' }),
    row({ flow_id: 862, candidate_id: 8862, status: 'running', name: 'Lee Starter', role: 'Designer', member_id: 9861, onboarding_id: 761, manager_member_id: 9104, manager_name: 'Joy Dumansi', call_at: '2026-09-29T14:00:00Z', one_on_one_at: '2026-09-29T15:00:00Z',
      setup_ticks: TICKS(3), welcome_sent_at: '2026-09-24T16:00:00Z', steps: startedSteps(862) }),
  ] : [];
  const lead = name === 'home' ? (() => {
    const p = fx.onboarding_steps.filter((s) => s.onboarding_id === 701);
    return { people: [{ onboarding_id: 701, member_id: 9811, name: 'Alix Denby', email: 'alix.denby@example.invalid', department: 'fundraising', title: 'Fundraising Associate', via: 'reports to you', avatar_url: null, started_at: '2026-09-23', day: 3, starts_on: null,
      done: 26, total: 61, sections: [], late_count: 0, late: [], next: null, last_done_at: null, steps: leadSteps({ steps: p }), quizzes_done: 0, help: [],
      lead_steps: [{ id: 5101, name: 'Introduce them to the team', description: '', due: '2026-09-26', done: false }, { id: 5102, name: 'Give them a first task', description: '', due: '2026-09-30', done: false }, { id: 5103, name: 'The two-week check-in', description: '', due: '2026-10-07', done: false }],
      academy: [{ key: 'firstweek', title: 'Your onboarding', done: 8, total: 10, complete: false }], help: [{ id: 7702, step: 'Loom', note: 'The Loom invite never came', at: '2026-09-24T15:00:00Z' }] }] };
  })() : { people: [] };
  const rpcs = { wa271_ready_list: ready, wa275_my_cards: homeRows, onboarding_lead_view: lead, onboarding_assign: 4242, wa_org_editor: false, wa279_my_hires: [] };
  const init = INIT + '\n' + INIT275 + '\nwindow.__O271_PW = ' + JSON.stringify(pw) + ';' + (name === 'home' ? '\n' + NOT_HR : '');
  return { fx, rpcs, init, extra };
}

module.exports = { fx285, TPL, HEADERS, T0 };
