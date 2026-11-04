/* w275fx.js: the fixture for the wave275 card drive (test/w275drive.js), on top of test/w271fx.js. No real person: everyone is made up.
   fx275(): fx271() plus the hires on the new path (offered, proposed, said no, times moved, started), their flow and step rows for HR's direct reads, and
   Joy Dumansi (boot.js's plain member) on the roster as the manager of two of them.
   rpcs275(o): wa271_ready_list (HR's list: wave271's rows and the new ones) and wa275_my_cards (o.mine: the rows the signed-in person manages).
   INIT275: runs after w271fx's INIT and answers the card's new onboard-run actions (times, propose, book, set_ask_availability, grid_for, availability_for,
   set_welcome, ask_manager, welcome on the new path, set_manager on an offered flow), recording each in window.__O271_CALLS and changing
   window.__WA_RPCS the way the function changes the tables. Toronto is UTC-4 on these dates; the page's clock is fixed at Friday 25/09/26 16:00. */
const { fx271, rpcs271, INIT, FLOW, MGR, AT } = require('./w271fx');

const JOY = { id: 9104, name: 'Joy Dumansi', email: 'joy.dumansi@welfareavenue.com' };   // boot.js's plain member (a member on the marketing profile)
const F = { said: 701, offered: 702, proposed: 703, moved: 704, old: 705, fresh: 706, loose: 707, started: 711 };
const DAY = (d, h, m) => new Date(Date.UTC(2026, 8, d, h + 4, m || 0)).toISOString();   // a September day, Toronto wall clock

function row(o) {
  return Object.assign({
    flow_id: 0, candidate_id: 0, status: 'waiting', practice: false, name: '', role: 'Writer', email: 'x@example.invalid', accepted_on: '2026-09-21', offer_respond_by: null, offer_start: null, late: false,
    grids: { hire: 'none', manager: 'none' }, call_at: null, one_on_one_at: null, manager_member_id: MGR.first, manager_name: 'Dana Fixture', default_manager: null, other_open_rows: 0,
    offer_hours: 6, hours_confirmed_at: '2026-09-21T14:00:00Z', proposed_call_at: null, proposed_one_on_one_at: null, proposed_by: null, proposed_at: null, hire_answer: null, hire_answered_at: null,
    ask_availability: true, setup_ticks: {}, welcome_sent_at: null, accounts_at: null, manager_availability_at: '2026-09-10T12:00:00Z', manager_no_week: false, manager_week_stale: false,
    offer_sent_at: '2026-09-20T15:00:00Z', created_at: '2026-09-20T15:00:00Z', propose_path: true, member_id: null, wa_email: null, canva_link: null, roster_created: null, slack_channel_id: null,
    onboarding_id: null, group_session: null, started_at: null, updated_at: '2026-09-21T14:00:00Z', steps: [],
  }, o);
}
const STEP = (flow, step, status, detail) => ({ flow_id: flow, step, status, detail, practice: false, at: '2026-09-25T18:00:00Z' });
function rows275() {
  return {
    said: row({ flow_id: F.said, candidate_id: 7301, name: 'James <b>Hire</b>', role: 'Driver', email: 'james@example.invalid', manager_member_id: JOY.id, manager_name: JOY.name,
      proposed_call_at: AT(10), proposed_one_on_one_at: AT(11, 30), proposed_by: JOY.email, proposed_at: '2026-09-21T15:00:00Z', hire_answer: 'no', hire_answered_at: '2026-09-22T15:00:00Z',
      grids: { hire: 'marked', manager: 'none' }, setup_ticks: { accept_setup_at: '2026-09-21T14:00:00Z', hire_times_at: '2026-09-21T15:00:00Z', rd_profile: '2026-09-22T12:00:00Z' },
      steps: [STEP(F.said, 'google', 'hr_task', 'The first password is not set in admin settings, so the Hub did not make the account.'), STEP(F.said, 'hub', 'waiting', null), STEP(F.said, 'roster', 'done', 'Created the roster profile.')] }),
    offered: row({ flow_id: F.offered, candidate_id: 7302, status: 'offered', name: 'Lina Offered', email: 'lina@example.invalid', accepted_on: null, hours_confirmed_at: null, manager_no_week: true, manager_week_stale: true, manager_availability_at: null }),
    proposed: row({ flow_id: F.proposed, candidate_id: 7303, name: 'Nia Proposed', email: 'nia@example.invalid', proposed_call_at: DAY(30, 10), proposed_one_on_one_at: DAY(31, 10) /* Thursday 1 October */, proposed_by: 'samson.jules@welfareavenue.com', proposed_at: '2026-09-24T15:00:00Z' }),
    moved: row({ flow_id: F.moved, candidate_id: 7304, name: 'Kim Moved', email: 'kim@example.invalid', proposed_call_at: AT(9), proposed_one_on_one_at: AT(14), proposed_by: 'dana@example.invalid', proposed_at: '2026-09-23T15:00:00Z', hire_answer: 'no', hire_answered_at: null, manager_week_stale: true }),
    /* wave275b: made after wa275b (already communicated, the manager's hours off, no week saved), and an Accept without the optional hours box */
    fresh: row({ flow_id: F.fresh, candidate_id: 7306, status: 'offered', name: 'Tess Fresh', email: 'tess@example.invalid', accepted_on: null, hours_confirmed_at: null, ask_availability: false, manager_hours: false, manager_no_week: true, manager_week_stale: true, manager_availability_at: null }),
    loose: row({ flow_id: F.loose, candidate_id: 7307, name: 'Uma Loose', email: 'uma@example.invalid', hours_confirmed_at: null, manager_hours: false, manager_week_stale: true }),
    old: row({ flow_id: F.old, candidate_id: 7305, name: 'Wren Earlier', email: 'wren@example.invalid', manager_member_id: JOY.id, manager_name: JOY.name, propose_path: false, offer_hours: null, created_at: '2026-08-20T15:00:00Z' }),   // a wave271 flow Joy manages
    started: row({ flow_id: F.started, candidate_id: 7311, status: 'running', name: 'Ola Started', email: 'ola@example.invalid', manager_member_id: JOY.id, manager_name: JOY.name, call_at: DAY(29, 10), one_on_one_at: DAY(29, 11),
      wa_email: 'ola.started@welfareavenue.com', roster_created: true, member_id: 8311, onboarding_id: 51, started_at: '2026-09-24T15:00:00Z', welcome_sent_at: '2026-09-24T16:00:00Z',
      setup_ticks: { rd_profile: '2026-09-24T17:00:00Z', rd_hub: '2026-09-24T17:05:00Z', rd_slack: '2026-09-24T17:10:00Z', hire_times_at: 'x', accept_setup_at: 'x', google_made_at: 'x', no_manager_told_at: 'x', propose_hr_reminded_at: 'x' },
      steps: ['roster', 'google', 'hub', 'plan', 'invites', 'manager', 'welcome'].map((k) => STEP(F.started, k, 'done', 'Done: ' + k + '.')).concat([STEP(F.started, 'slack', 'hr_task', 'Create their onboarding channel in Slack.')]) }),
  };
}

function fx275() {
  const fx = fx271();
  fx.team_members = fx.team_members.filter((m) => m.id !== JOY.id && String(m.email || '').toLowerCase() !== JOY.email);
  fx.team_members.push({ id: JOY.id, name: JOY.name, email: JOY.email, active: true, department: 'marketing', role: 'Coordinator', responsibilities: [] });
  fx.team_members = fx.team_members.filter((m) => String(m.email || '').toLowerCase() !== 'samson.jules@welfareavenue.com');
  fx.team_members.push({ id: 9105, name: 'Samson Jules', email: 'samson.jules@welfareavenue.com', active: true, department: 'hr', role: 'HR', responsibilities: [] });   // boot.js's HR member, who proposed Nia's times
  const R = rows275();
  fx.hub_candidates = fx.hub_candidates.concat([
    { id: 7301, name: 'James <b>Hire</b>', role: 'Driver', email: 'james@example.invalid', status: 'offer', practice: false, offer_sent_at: '2026-09-20T15:00:00Z', accepted_on: '2026-09-21' },
    { id: 7302, name: 'Lina Offered', role: 'Writer', email: 'lina@example.invalid', status: 'offer', practice: false, offer_sent_at: '2026-09-20T15:00:00Z', accepted_on: null },
    { id: 7303, name: 'Nia Proposed', role: 'Writer', email: 'nia@example.invalid', status: 'offer', practice: false, offer_sent_at: '2026-09-20T15:00:00Z', accepted_on: '2026-09-21' },
    { id: 7304, name: 'Kim Moved', role: 'Writer', email: 'kim@example.invalid', status: 'offer', practice: false, offer_sent_at: '2026-09-20T15:00:00Z', accepted_on: '2026-09-21' },
    { id: 7306, name: 'Tess Fresh', role: 'Writer', email: 'tess@example.invalid', status: 'offer', practice: false, offer_sent_at: '2026-09-20T15:00:00Z', accepted_on: null },
    { id: 7307, name: 'Uma Loose', role: 'Writer', email: 'uma@example.invalid', status: 'offer', practice: false, offer_sent_at: '2026-09-20T15:00:00Z', accepted_on: '2026-09-21' },
    { id: 7311, name: 'Ola Started', role: 'Writer', email: 'ola@example.invalid', status: 'hired', practice: false, member_id: 8311 },
  ]);
  /* HR reads a started flow from the tables, as wave271 does */
  const st = R.started;
  fx.hub_onboard_flows.push({ id: st.flow_id, candidate_id: st.candidate_id, practice: false, status: 'running', manager_member_id: JOY.id, wa_email: st.wa_email, call_at: st.call_at, one_on_one_at: st.one_on_one_at,
    group_session: null, onboarding_id: 51, started_at: st.started_at, roster_created: true, created_at: st.created_at, setup_ticks: st.setup_ticks, welcome_sent_at: st.welcome_sent_at, proposed_at: '2026-09-21T15:00:00Z' });
  fx.hub_onboard_steps = fx.hub_onboard_steps.concat(st.steps.map((r) => Object.assign({ by: 'hr@example.invalid' }, r)));
  return fx;
}
function rpcs275(o) {
  o = o || {};
  const R = rows275();
  const base = rpcs271(o);
  base.wa271_ready_list = base.wa271_ready_list.concat([R.said, R.offered, R.proposed, R.moved], (o.extra || []).map((k) => R[k]));   // extra: wave275b's rows
  base.wa275_my_cards = (o.mine || []).map((k) => R[k]);
  return base;
}

/* the database refusing HR's list for a person who is not HR (wa271_ready_list raises 'Only HR ...' for them) */
const NOT_HR = 'window.__WA_RPC_ERRORS = { wa271_ready_list: "Only HR can see the onboarding list" };';

/* in-page: the stand-in for the card's new onboard-run actions, after w271fx's INIT */
const INIT275 = `(function(){
  var base = window.__WA_INVOKE, CALLS = window.__O271_CALLS;
  var H = function (d, h, m) { return new Date(Date.UTC(2026, 8, d, h + 4, m || 0)).toISOString(); };
  var DEF = { mon: [['09:00', '17:00']], tue: [['09:00', '17:00']], wed: [['09:00', '17:00']], thu: [['09:00', '17:00']], fri: [['09:00', '17:00']] };
  window.__O275 = { grids: {}, welcome: {}, except: {} };
  function rows() { return (window.__WA_RPCS.wa271_ready_list || []).concat(window.__WA_RPCS.wa275_my_cards || []); }
  function each(id, fn) { rows().forEach(function (r) { if (String(r.flow_id) === String(id)) fn(r); }); }
  function one(id) { return rows().filter(function (r) { return String(r.flow_id) === String(id); })[0]; }
  function ok(d) { return { data: d, error: null }; }
  function refuse(error, message, status) { return { data: null, error: { name: 'FunctionsHttpError', message: 'Edge Function returned a non-2xx status code', context: new Response(JSON.stringify({ error: error, message: message }), { status: status || 409, headers: { 'Content-Type': 'application/json' } }) } }; }
  var NEW = ['times', 'propose', 'book', 'set_ask_availability', 'grid_for', 'availability_for', 'set_welcome', 'ask_manager'];
  window.__WA_INVOKE = function (name, opts) {
    var b = (opts && opts.body) || {}, x = b.flow_id != null ? one(b.flow_id) : null;
    var mine = name === 'onboard-run' && (NEW.indexOf(b.action) >= 0 || (x && (b.action === 'welcome' || b.action === 'set_manager' || b.action === 'set_canva_link')) || (b.action === 'retry' && x));
    if (!mine) return base(name, opts);
    CALLS.push({ name: name, body: JSON.parse(JSON.stringify(b)) });
    if (window.__O271_REFUSE && window.__O271_REFUSE.action === b.action) { var z = window.__O271_REFUSE; window.__O271_REFUSE = null; return refuse(z.error, z.message); }
    switch (b.action) {
      case 'times': return ok({ manager: { member_id: x.manager_member_id, name: x.manager_name }, availability: { weekly: DEF, except: window.__O275.except[x.manager_member_id] || [], tz: 'America/Toronto' },
        availability_at: x.manager_availability_at, stale: !!x.manager_week_stale, no_week: !!x.manager_no_week, except_at: null,
        busy: [{ start: H(28, 13), end: H(28, 14), summary: 'Team <i>sync</i>' }], taken: [{ start: H(28, 15), end: H(28, 16) }],
        hire_slots: window.__O275.grids[x.flow_id] || (x.grids.hire === 'marked' ? [H(28, 10), H(28, 10, 30), H(28, 11), H(28, 11, 30), H(28, 12)] : []),
        lengths: { callMin: 60, oneMin: 30 }, lead_hours: 48, yes_lead_hours: 24,
        proposal: x.proposed_at ? { call_at: x.proposed_call_at, one_on_one_at: x.proposed_one_on_one_at, by: x.proposed_by, at: x.proposed_at } : null,
        hire_answer: x.hire_answer, ask_availability: x.ask_availability !== false, accepted: !!x.accepted_on, manager_hours: x.manager_hours !== false });
      case 'propose': {
        var at = new Date().toISOString();
        each(b.flow_id, function (r) { r.proposed_call_at = b.call_at; r.proposed_one_on_one_at = b.one_on_one_at; r.proposed_by = window.__WA_TEST_EMAIL; r.proposed_at = at; r.hire_answer = null; });
        return ok({ ok: true, repeated: false, proposal: { call_at: b.call_at, one_on_one_at: b.one_on_one_at, by: window.__WA_TEST_EMAIL, at: at }, hire_emailed: !!x.accepted_on, warnings: [] });
      }
      case 'book': {
        each(b.flow_id, function (r) { r.status = 'running'; r.call_at = b.call_at; r.one_on_one_at = b.one_on_one_at; r.steps = r.steps.concat(['plan', 'invites', 'manager', 'slack', 'welcome'].map(function (k) { return { flow_id: r.flow_id, step: k, status: 'pending', detail: null, practice: false, at: new Date().toISOString() }; })); });
        window.__WA_RPCS.wa271_ready_list = window.__WA_RPCS.wa271_ready_list.filter(function (r) { return String(r.flow_id) !== String(b.flow_id); });
        return ok({ ok: true, booked: true, repeated: false, call_at: b.call_at, one_on_one_at: b.one_on_one_at, status: 'running' });
      }
      case 'set_ask_availability': each(b.flow_id, function (r) { r.ask_availability = b.on; }); return ok({ ok: true, ask_availability: b.on });
      case 'grid_for': window.__O275.grids[b.flow_id] = b.slots; each(b.flow_id, function (r) { r.grids = { hire: b.slots.length ? 'marked' : 'none', manager: 'none' }; }); return ok({ ok: true, saved: b.slots.length, slots: b.slots });
      case 'availability_for': window.__O275.except[b.member_id] = b.except; return ok({ ok: true, availability: { weekly: DEF, except: b.except, tz: 'America/Toronto' }, availability_at: null, stale: true, no_week: true, except_at: new Date().toISOString() });
      case 'set_welcome': window.__O275.welcome[b.flow_id] = { subject: b.subject, text: b.text }; return ok({ ok: true, edited: true, subject: b.subject, text: b.text });
      case 'welcome': { var w = window.__O275.welcome[b.flow_id]; return ok(w ? { subject: w.subject, text: w.text, edited: true, sent_at: null } : { subject: 'Welcome to Welfare Avenue! Your Next Steps', text: 'Dear ' + String(x.name).split(' ')[0] + ',\\n\\nYour first day is [first day: fills in at Start].\\n   First password: [first password]', edited: false, sent_at: x.welcome_sent_at || null }); }
      case 'set_manager': each(b.flow_id, function (r) { r.manager_member_id = b.member_id; r.manager_name = String(b.member_id) === '9102' ? 'Omar Fixture' : 'Dana Fixture'; }); return ok({ ok: true, cleared: true });
      case 'set_canva_link': each(b.flow_id, function (r) { r.canva_link = b.link || null; }); return ok({ ok: true, canva_link: b.link || null });
      case 'ask_manager': return ok({ ok: true, sent: true, to: 'omar@example.invalid', manager: 'Omar Fixture', warnings: [] });
      case 'retry': each(b.flow_id, function (r) { r.steps.forEach(function (s) { if (s.step === b.step) { s.status = 'done'; s.detail = 'Done on Retry.'; } }); }); return ok({ steps: x.steps });
    }
    return refuse('unknown_action', 'The Hub does not know that action. Reload the page.', 400);
  };
})();`;

module.exports = { fx275, rpcs275, INIT, INIT275, NOT_HR, F, JOY, MGR, AT, DAY };
