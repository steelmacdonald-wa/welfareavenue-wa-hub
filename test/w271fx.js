/* w271fx.js: the fixture for the wave271 HR Center drive (test/w271drive.js). No real person: the hires and managers are made up.
   fx271(): test/fixture.json plus the rows the page reads by named columns (hub_candidates, hub_onboard_flows, hub_onboard_steps) and two managers.
   rpcs271(): what wa271_ready_list answers.
   INIT: a stateful stand-in for the onboard-run edge function, window.__WA_INVOKE, which records every call in window.__O271_CALLS and
   changes window.__WAFIX and window.__WA_RPCS the way the function changes the tables. A refusal has the shape the real supabase-js client
   gives for a non-2xx answer: error.message is its own generic sentence and error.context is the Response holding {error, message}.
   Toronto is UTC-4 on all these dates (clock fixed at 25/09/26 by boot.js). */
const { loadFixture } = require('./boot');

const AT = (h, m) => new Date(Date.UTC(2026, 8, 28, h + 4, m || 0)).toISOString();   // Monday 28/09/26, Toronto wall clock (fixture only)
const FLOW = { real: 501, practice: 502, nomanager: 503, started: 601 };
const MGR = { first: 9101, second: 9102 };

function ready() {
  return [
    { flow_id: FLOW.real, candidate_id: 7001, status: 'waiting', practice: false, name: 'Amina <b>Yusuf</b>', role: 'Event Coordinator', email: 'amina.y@example.invalid',
      accepted_on: '2026-09-22', offer_respond_by: '2026-09-20', offer_start: '2026-10-05', late: true, grids: { hire: 'marked', manager: 'none' }, call_at: null, one_on_one_at: null,
      manager_member_id: null, default_manager: { member_id: MGR.first, name: 'Dana Fixture', how: 'reports_to' }, other_open_rows: 1 },
    { flow_id: FLOW.practice, candidate_id: 7002, status: 'waiting', practice: true, name: 'Pat Practice', role: 'Practice role', email: 'pat@example.invalid',
      accepted_on: '2026-09-24', offer_respond_by: null, offer_start: null, late: false, grids: { hire: 'none', manager: 'none' }, call_at: null, one_on_one_at: null,
      manager_member_id: null, default_manager: { member_id: null, name: null, how: 'none' }, other_open_rows: 0 },
    { flow_id: FLOW.nomanager, candidate_id: 7003, status: 'ready', practice: false, name: 'Noor Single', role: 'Cook', email: 'noor@example.invalid',
      accepted_on: '2026-09-24', offer_respond_by: null, offer_start: null, late: false, grids: { hire: 'none', manager: 'none' }, call_at: null, one_on_one_at: null,
      manager_member_id: null, default_manager: { member_id: null, name: null, how: 'none' }, other_open_rows: 0 },
  ];
}

const STARTED_STEPS = [
  ['roster', 'done', 'Created the roster profile, with 2026-10-01 as the start date.'],
  ['google', 'hr_task', 'Create the account in Google, then press "I created it, continue" on this card.'],
  ['plan', 'done', 'Made the onboarding plan, with day one on 2026-10-01.'],
  ['invites', 'failed', 'Google refused the onboarding call invite: quota. Press Retry.'],
  ['manager', 'done', 'Told Dana Fixture the date and time.'],
  ['hub', 'hr_task', 'Invite them to the Hub at member level, from Roster.'],
  ['slack', 'hr_task', 'Create their onboarding channel in Slack, add the manager and HR, and post the welcome message.'],
  ['welcome', 'hr_task', 'Send the welcome email to their personal address.'],
];
function stepRows(flowId) { return STARTED_STEPS.map(s => ({ flow_id: flowId, step: s[0], status: s[1], detail: s[2], practice: false, at: '2026-09-25T19:00:00Z', by: 'hr@example.invalid' })); }

function fx271(o) {
  o = o || {};
  const fx = JSON.parse(JSON.stringify(loadFixture()));
  fx.team_members = (fx.team_members || []).filter(m => m.id !== MGR.first && m.id !== MGR.second);
  fx.team_members.push({ id: MGR.first, name: 'Dana Fixture', email: 'dana@example.invalid', active: true, department: 'hr', role: 'Lead', responsibilities: [] });
  fx.team_members.push({ id: MGR.second, name: 'Omar Fixture', email: 'omar@example.invalid', active: true, department: 'hr', role: 'Lead', responsibilities: [] });
  fx.hub_candidates = (fx.hub_candidates || []).concat([
    { id: 7001, name: 'Amina <b>Yusuf</b>', role: 'Event Coordinator', email: 'amina.y@example.invalid', status: 'offer', practice: false },
    { id: 7002, name: 'Pat Practice', role: 'Practice role', email: 'pat@example.invalid', status: 'offer', practice: true },
    { id: 7003, name: 'Noor Single', role: 'Cook', email: 'noor@example.invalid', status: 'offer', practice: false },
    { id: 7101, name: 'Sam Started', role: 'Driver', email: 'sam@example.invalid', status: 'hired', practice: false },
  ]);
  fx.hub_onboard_flows = [];
  fx.hub_onboard_steps = [];
  if (o.started) {
    fx.hub_onboard_flows.push({ id: FLOW.started, candidate_id: 7101, practice: false, status: 'running', manager_member_id: MGR.first, wa_email: null, call_at: '2026-10-01T14:00:00Z', one_on_one_at: null, group_session: null, onboarding_id: 40, started_at: null });
    fx.hub_onboard_steps = stepRows(FLOW.started);
  }
  return fx;
}
function rpcs271(o) {
  o = o || {};
  return Object.assign({ wa271_ready_list: o.empty ? [] : ready(), onboarding_assign: 77, wa_org_editor: false }, o.extra || {});
}

/* in-page: the stand-in for onboard-run */
const INIT = `(function(){
  var CALLS = window.__O271_CALLS = [];
  function refuse(error, message, status) {
    return { data: null, error: { name: 'FunctionsHttpError', message: 'Edge Function returned a non-2xx status code', context: new Response(JSON.stringify({ error: error, message: message }), { status: status || 409, headers: { 'Content-Type': 'application/json' } }) } };
  }
  function flow(id) { return (window.__WAFIX.hub_onboard_flows || []).filter(function (f) { return String(f.id) === String(id); })[0]; }
  function steps(id) { return (window.__WAFIX.hub_onboard_steps || []).filter(function (r) { return String(r.flow_id) === String(id); }).map(function (r) { return { step: r.step, status: r.status, detail: r.detail, practice: r.practice, at: r.at, by: r.by }; }); }
  function setStep(id, key, status, detail) { (window.__WAFIX.hub_onboard_steps || []).forEach(function (r) { if (String(r.flow_id) === String(id) && r.step === key) { r.status = status; r.detail = detail; r.at = new Date().toISOString(); } }); }
  var KEYS = ['roster', 'google', 'plan', 'invites', 'manager', 'hub', 'slack', 'welcome'];
  var LABEL = { roster: 'Roster profile', google: 'Google account', plan: 'Onboarding plan', invites: 'Calendar invites', manager: 'Tell the manager', hub: 'Hub access', slack: 'Slack channel', welcome: 'Welcome email' };
  var MODE = { roster: 'run', google: 'hr_task', plan: 'run', invites: 'run', manager: 'run', hub: 'hr_task', slack: 'hr_task', welcome: 'hr_task' };
  var H = function (h, m) { return new Date(Date.UTC(2026, 8, 28, h + 4, m || 0)).toISOString(); };
  function hireSlots() { var o = []; for (var h = 8; h < 12; h++) { o.push(H(h)); o.push(H(h, 30)); } return o; }
  function mgrSlots() { var o = []; for (var h = 10; h < 14; h++) { o.push(H(h)); o.push(H(h, 30)); } return o; }
  function preview(b) {
    var taken = b.wa_email === 'taken.person@welfareavenue.com';
    var practice = String(b.flow_id) === '502', noman = String(b.flow_id) === '503';
    var address = b.wa_email || (noman ? null : practice ? 'pat.practice@welfareavenue.com' : String(b.flow_id) === '601' ? 'sam.started@welfareavenue.com' : 'amina.yusuf@welfareavenue.com');
    var warnings = ['The position has no job description link, so the welcome email leaves that line out.'];
    if (taken) warnings.unshift(address + ' is already in use. Change the address, or skip the Google account step.');
    if (!address) warnings.unshift('This name does not fit first.last, so HR must type the address.');
    if (practice) warnings.push('This is a practice applicant: the run is a simulation and nothing real changes.');
    return { address: address, address_taken: taken, needs_address: !address,
      manager: practice || noman ? { member_id: null, name: null, how: 'none' } : { member_id: 9101, name: 'Dana Fixture', how: 'reports_to' },
      grids: { hire: hireSlots(), manager: mgrSlots() },
      hub_events: [
        { id: 'e1', summary: 'Board <i>prep</i>', start_at: H(9), end_at: H(10), who: ['hire'] },
        { id: 'e2', summary: 'Team sync', start_at: H(13), end_at: H(13, 30), who: ['manager'] }
      ],
      steps: KEYS.map(function (k) { return { key: k, label: LABEL[k], needs: k === 'roster' ? [] : ['roster'], mode: practice ? 'practice' : MODE[k], status: null, detail: null }; }),
      welcome: { subject: 'Welcome to Welfare Avenue! Your Next Steps', text: 'Hi Amina,\\n\\nCongratulations.' },
      warnings: warnings };
  }
  window.__WA_INVOKE = function (name, opts) {
    var b = (opts && opts.body) || {};
    CALLS.push({ name: name, body: JSON.parse(JSON.stringify(b)) });
    if (name !== 'onboard-run') return { data: null, error: null };
    if (window.__O271_REFUSE && window.__O271_REFUSE.action === b.action) { var x = window.__O271_REFUSE; window.__O271_REFUSE = null; return refuse(x.error, x.message); }
    var fx = window.__WAFIX;
    switch (b.action) {
      case 'preview': return { data: preview(b), error: null };
      case 'send_grid_link': return { data: { ok: true }, error: null };
      case 'start': {
        var f = { id: b.flow_id, candidate_id: b.flow_id === 501 ? 7001 : b.flow_id === 502 ? 7002 : 7003, practice: b.flow_id === 502, status: 'running', manager_member_id: b.manager_member_id, wa_email: b.wa_email || null,
          call_at: b.call_at, one_on_one_at: b.one_on_one_at || null, group_session: b.group_session || null, onboarding_id: 41, started_at: null };
        fx.hub_onboard_flows.push(f);
        window.__WA_RPCS.wa271_ready_list = window.__WA_RPCS.wa271_ready_list.filter(function (r) { return r.flow_id !== b.flow_id; });
        var skip = b.skip || [];
        var rows = [['roster', 'done', 'Created the roster profile.'], ['google', 'hr_task', 'Create the account in Google, then press "I created it, continue" on this card.'], ['plan', 'done', 'Made the onboarding plan.'],
          ['invites', 'failed', 'Google refused the onboarding call invite: quota. Press Retry.'], ['manager', 'done', 'Told Dana Fixture the date and time.'], ['hub', 'hr_task', 'Invite them to the Hub at member level, from Roster.'],
          ['slack', 'hr_task', 'Create their onboarding channel in Slack.'], ['welcome', 'hr_task', 'Send the welcome email to their personal address.']];
        rows.forEach(function (r) { var off = skip.indexOf(r[0]) >= 0; fx.hub_onboard_steps.push({ flow_id: b.flow_id, step: r[0], status: off ? 'skipped' : r[1], detail: off ? 'Skipped by HR in the preview.' : r[2], practice: b.flow_id === 502, at: new Date().toISOString(), by: 'hr@example.invalid' }); });
        return { data: { steps: steps(b.flow_id) }, error: null };
      }
      case 'retry': setStep(b.flow_id, b.step, 'done', 'The onboarding call is booked.'); return { data: { steps: steps(b.flow_id) }, error: null };
      case 'google_manual': setStep(b.flow_id, 'google', 'done', 'HR created ' + b.wa_email + ' in Google.'); flow(b.flow_id).wa_email = b.wa_email; return { data: { steps: steps(b.flow_id) }, error: null };
      case 'book_one_on_one': flow(b.flow_id).one_on_one_at = b.at; return { data: { ok: true, one_on_one_at: b.at, invited: ['x@example.invalid'], mode: 'test' }, error: null };
      case 'change_time': if (b.which === 'call') flow(b.flow_id).call_at = b.at; else flow(b.flow_id).one_on_one_at = b.at; return { data: { ok: true, which: b.which, at: b.at, warnings: ['Dana Fixture was not told: they have no Slack account. Tell them yourself.'] }, error: null };
      case 'change_manager': flow(b.flow_id).manager_member_id = b.member_id; return { data: { ok: true, manager: { member_id: b.member_id, name: 'Omar Fixture' }, warnings: [] }, error: null };
      case 'backed_out': flow(b.flow_id).status = 'backed_out'; return { data: { ok: true, remove: ['Roster profile: the Hub leaves it as it is. Deactivate it by hand in Roster.', 'Slack onboarding channel <C1>: archive it.'], warnings: ['The onboarding plan could not be closed: boom. Close it by hand in Onboarding.'] }, error: null };
    }
    return refuse('unknown_action', 'The Hub does not know that action. Reload the page.', 400);
  };
})();`;

module.exports = { fx271, rpcs271, INIT, FLOW, MGR, AT };
