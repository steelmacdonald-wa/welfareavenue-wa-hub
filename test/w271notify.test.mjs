// wave271 Task 6: notifications and reminders, proved offline on the in-memory rig (test/w271rig.mjs). Run: node --test test/w271notify.test.mjs
// Two functions side by side: notify (the three new relay events onboard_date, onboard_grid, onboard_remind) and onboard-run (the manager step,
// and the hourly action remind). Slack, hub-push and every other URL are stubs: nothing is sent anywhere, and an unregistered URL fails the call.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { loadFn } from './w271rig.mjs';

const BASE = 'https://stub.supabase.test/functions/v1/';
const NOTIFY = BASE + 'notify', RUN = BASE + 'onboard-run', PUSH = BASE + 'hub-push';
const SECRET = 'trigger-secret-for-tests';
const SERVICE = 'service-key-for-tests';
const NOW = '2026-10-20T12:00:00Z';
const HOURS = 3600000;
const CALL = '2026-11-02T03:30:00.000Z';   // 22:30 on 01/11/26 in Toronto
const ONE = '2026-11-03T15:00:00.000Z';
const HIRE = 'alex@example.com';
const HR = ['hr.one@welfareavenue.com', 'hr.two@welfareavenue.com'];

const TEAM = [
  { id: 1, name: 'Ruth Owen', email: 'ruth.owen@welfareavenue.com', active: true },
  { id: 2, name: 'Sam Lee', email: 'sam.lee@welfareavenue.com', active: true },
  { id: 3, name: 'No Mail', email: null, active: true },
];
const candidate = (over = {}) => ({ id: 11, name: 'Alex Tremblay', role: 'Program Coordinator', status: 'offer', email: HIRE, summary: '', notes: '', position_id: 5, accepted_on: '2026-10-15', offer_sent_at: '2026-10-10T12:00:00Z', member_id: null, start_date: null, practice: false, ...over });
const flow = (over = {}) => ({
  id: 21, candidate_id: 11, practice: false, status: 'waiting', manager_member_id: null, wa_email: null, call_at: null, one_on_one_at: null, group_session: null,
  call_event_id: null, one_on_one_event_id: null, onboarding_id: null, welcome_subject: null, welcome_text: null, started_by: null, started_at: null,
  created_at: '2026-10-15T12:00:00Z', updated_at: '2026-10-15T12:00:00Z', reminded_hire_at: null, reminded_manager_at: null, manager_link_sent_at: null, manager_link_member_id: null, ...over,
});

/* ---------- notify ---------- */
async function notifyWorld({ prefs = [], subs = [] } = {}) {
  const rig = await loadFn('notify', {
    secrets: { SLACK_BOT_TOKEN: 'xoxb-test', SLACK_WEBHOOK_URL: 'https://hooks.example/none' },
    config: { push_on: 'on' },
    tables: {
      team_members: TEAM, wa_slack_ids: [{ email: 'sam.lee@welfareavenue.com', slack_id: 'USAM' }, { email: HR[0], slack_id: 'UHR1' }, { email: HR[1], slack_id: 'UHR2' }],
      wa_notify_prefs: prefs, hub_push_subs: subs, hub_notifications_sent: [], change_log: [],
    },
  });
  rig.slack = () => rig.fetchLog.filter((e) => e.url === 'https://slack.com/api/chat.postMessage');
  rig.push = () => rig.fetchLog.filter((e) => e.url === PUSH);
  rig.fetchOn('https://slack.com/api/conversations.open', (e) => ({ json: { ok: true, channel: { id: 'D-' + e.body.users } } }));
  rig.fetchOn('https://slack.com/api/chat.postMessage', { json: { ok: true } });
  rig.fetchOn(PUSH, { json: { outcome: 'sent' } });
  rig.fetchOn('https://slack.com/api/users.lookupByEmail', { json: { ok: false, error: 'users_not_found' } });
  rig.fetchOn('https://slack.com/api/users.list', { json: { ok: true, members: [] } });
  rig.send = async (body, headers = { 'x-wa-secret': SECRET, Authorization: 'Bearer anon-key-for-tests' }) => {
    const r = await rig.call(new Request(NOTIFY, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }));
    return { status: r.status, body: await r.json() };
  };
  return rig;
}
const dateMsg = (over = {}) => ({ event: 'onboard_date', to_email: 'sam.lee@welfareavenue.com', url: '#hrcentre/onboarding', tag: 'onboard-date-21', title: 'Alex Tremblay starts 2026-11-01', body: 'Alex Tremblay has their onboarding call.', text: '*Alex Tremblay* has their onboarding call. <https://hub.welfareavenue.com/#hrcentre/onboarding|Open Onboarding>', ...over });

test('notify takes onboard_date, onboard_grid and onboard_remind: a Slack DM, the Hub notification, and the log', async () => {
  for (const [event, url, title] of [['onboard_date', '#hrcentre/onboarding', 'Alex starts'], ['onboard_grid', '/o/21.abc', 'Mark your availability'], ['onboard_remind', '#hrcentre/onboarding', 'Still empty']]) {
    const n = await notifyWorld();
    const r = await n.send(dateMsg({ event, url, title, tag: event + '-21' }));
    assert.equal(r.status, 200, event);
    assert.deepEqual(r.body.outcome, { 'sam.lee@welfareavenue.com': 'sent' }, event);
    assert.equal(n.slack().length, 1, event);
    assert.equal(n.slack()[0].body.channel, 'D-USAM');
    assert.match(n.slack()[0].body.text, /Alex Tremblay/);
    assert.equal(n.push().length, 1, event);
    assert.equal(n.push()[0].body.kind, event);
    assert.deepEqual(n.push()[0].body.to, ['sam.lee@welfareavenue.com']);
    assert.equal(n.push()[0].body.url, url.startsWith('/') ? url : '/' + url, 'a path is kept, a hash gets its slash');
    const [logged] = n.db.rows('hub_notifications_sent');
    assert.equal(logged.kind, event);
    assert.equal(logged.outcome, 'sent');
    assert.equal(logged.ref, event + '-21');
    assert.deepEqual(n.unregistered(), []);
  }
});

test('notify onboard_date honours the person\'s switch for the kind: no Slack DM, the log says so', async () => {
  const n = await notifyWorld({ prefs: [{ email: 'sam.lee@welfareavenue.com', disabled: [], prefs: { kinds: { onboard_date: { hub: true, slack: false } } } }] });
  const r = await n.send(dateMsg());
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.outcome, { 'sam.lee@welfareavenue.com': 'opted_out' });
  assert.equal(n.slack().length, 0);
  assert.equal(n.db.rows('hub_notifications_sent')[0].outcome, 'skipped: switched off');
  assert.equal(n.push().length, 1, 'the Hub side is hub-push\'s own switch, which it reads for the kind');
});

test('notify: the old disabled list also switches off a new kind', async () => {
  const n = await notifyWorld({ prefs: [{ email: 'sam.lee@welfareavenue.com', disabled: ['onboard_grid'], prefs: {} }] });
  const r = await n.send(dateMsg({ event: 'onboard_grid' }));
  assert.deepEqual(r.body.outcome, { 'sam.lee@welfareavenue.com': 'opted_out' });
  assert.equal(n.slack().length, 0);
});

test('notify: the new kinds come from the Hub itself only; a signed-in person cannot send them, and an unknown one is still refused', async () => {
  const n = await notifyWorld();
  n.db.setCaller({ email: 'hr.person@welfareavenue.com' });
  const r = await n.send(dateMsg(), { Authorization: 'Bearer user-jwt' });
  assert.equal(r.status, 401);
  assert.equal(n.slack().length, 0);
  const bad = await n.send(dateMsg({ event: 'onboard_nope' }));
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, 'unknown event');
  const empty = await n.send(dateMsg({ text: '' }));
  assert.equal(empty.status, 400);
});

test('notify sends to several people in one call (the HR list), each through their own switch', async () => {
  const n = await notifyWorld({ prefs: [{ email: HR[1], disabled: [], prefs: { kinds: { onboard_remind: { slack: false } } } }] });
  const r = await n.send(dateMsg({ event: 'onboard_remind', to_email: undefined, to: HR }));
  assert.deepEqual(r.body.outcome, { [HR[0]]: 'sent', [HR[1]]: 'opted_out' });
  assert.deepEqual(n.push()[0].body.to, HR);
});

/* ---------- onboard-run ---------- */
async function runWorld({ cand = {}, fl = {}, config = {}, tables = {}, hr = true, manager = { member_id: 2, name: 'Sam Lee', how: 'reports_to' }, notifyReply, notify = null } = {}) {
  const rig = await loadFn('onboard-run', {
    config: { onboard_auto_google: 'off', onboard_auto_slack: 'off', onboard_remind_hours: '48', hr_notify_emails: HR.join(', '), mail_mode: 'live', ...config },
    tables: {
      hub_candidates: [candidate(cand)], hub_onboard_flows: [flow({ practice: !!cand.practice, ...fl })], hub_onboard_grids: [], hub_onboard_steps: [],
      hub_positions: [{ id: 5, title: 'Program Coordinator', dept: 'progdev', jd_url: 'https://docs.example.com/jd' }],
      team_members: structuredClone(TEAM), onboardings: [], hr_setup_steps: [], change_log: [], hub_events: [], ...tables,
    },
  });
  rig.setNow(NOW);
  rig.db.setCaller({ email: 'hr.person@welfareavenue.com' });
  rig.db.onRpc('wa_is_hr', () => hr);
  rig.db.onRpc('is_wa_admin', () => false);
  rig.db.onRpc('wa271_default_manager', (a, _d, w) => { assert.equal(w.jwt, null, 'the default manager is asked as the service key'); return manager; });
  const w = {
    rig, db: rig.db, sent: [],
    flow: () => rig.db.rows('hub_onboard_flows')[0],
    notifies: () => rig.fetchLog.filter((e) => e.url === NOTIFY),
    step: (k) => rig.db.rows('hub_onboard_steps').find((r) => r.step === k),
    snapshot: () => structuredClone(rig.db.tables),
  };
  rig.fetchOn(NOTIFY, async (e) => {
    w.sent.push(e.body);
    if (notifyReply) return notifyReply(e);
    if (!notify) return { json: { outcome: Object.fromEntries([].concat(e.body.to || e.body.to_email).map((x) => [x, 'sent'])), hub: 'off' } };
    const r = await notify.call(new Request(NOTIFY, { method: 'POST', headers: e.headers, body: JSON.stringify(e.body) }));
    rig.client();   // the call switched the globals to notify: switch them back
    return r;
  });
  w.post = async (body, headers = { Authorization: 'Bearer user-jwt' }) => {
    const r = await rig.call(new Request(RUN, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }));
    return { status: r.status, body: await r.json() };
  };
  w.remind = (headers = { 'x-wa-secret': SECRET, Authorization: 'Bearer anon-key-for-tests' }) => w.post({ action: 'remind' }, headers);
  return w;
}
const mgrLink = (id) => id + '.' + createHmac('sha256', 'onboard-mgr:' + SERVICE).update(String(id)).digest('base64url').slice(0, 20);

test('step manager: through notify, the manager is told the date, the time and the hire\'s name, and the Hub link opens Onboarding', async () => {
  const notify = await notifyWorld();
  const w = await runWorld({ notify });
  const r = await w.post({ action: 'start', flow_id: 21, manager_member_id: 2, call_at: CALL, one_on_one_at: ONE, skip: ['google', 'plan', 'invites', 'hub', 'slack', 'welcome'] });
  assert.equal(r.status, 200);
  assert.equal(w.step('manager').status, 'done');
  const [n] = w.sent;
  assert.equal(n.event, 'onboard_date');
  assert.equal(n.url, '#hrcentre/onboarding');
  assert.equal(n.to_email, 'sam.lee@welfareavenue.com');
  const dm = notify.slack()[0].body.text;
  assert.match(dm, /Alex Tremblay/);
  assert.match(dm, /November 1, 2026/);
  assert.match(dm, /10:30/);
  assert.equal(notify.push()[0].body.kind, 'onboard_date');
  assert.equal(notify.push()[0].body.url, '/#hrcentre/onboarding');
  assert.equal(notify.db.rows('hub_notifications_sent')[0].kind, 'onboard_date');
  assert.deepEqual(w.rig.unregistered(), []);
  assert.deepEqual(notify.unregistered(), []);
});

test('step manager: the manager\'s own switch is honoured and the step is still done (the choice is theirs)', async () => {
  const notify = await notifyWorld({ prefs: [{ email: 'sam.lee@welfareavenue.com', disabled: [], prefs: { kinds: { onboard_date: { slack: false } } } }] });
  const w = await runWorld({ notify });
  await w.post({ action: 'start', flow_id: 21, manager_member_id: 2, call_at: CALL, one_on_one_at: ONE, skip: ['google', 'plan', 'invites', 'hub', 'slack', 'welcome'] });
  assert.equal(w.step('manager').status, 'done');
  assert.equal(notify.slack().length, 0);
  assert.equal(notify.db.rows('hub_notifications_sent')[0].outcome, 'skipped: switched off');
});

/* ---------- remind: who may call it ---------- */
test('remind: the trigger secret may run it with no signed-in person; nobody else may', async () => {
  const w = await runWorld();
  w.db.setCaller(null);
  assert.equal((await w.remind()).status, 200);
  assert.equal((await w.remind({ Authorization: 'Bearer anon-key-for-tests' })).status, 401, 'the anon key alone is no one');
  assert.equal((await w.remind({ 'x-wa-secret': 'wrong', Authorization: 'Bearer anon-key-for-tests' })).status, 401);
  w.db.setCaller({ email: 'hr.person@welfareavenue.com' });
  const asHr = await w.remind({ Authorization: 'Bearer user-jwt' });
  assert.equal(asHr.status, 403, 'a signed-in HR person cannot run the Hub\'s hourly job');
  assert.equal(asHr.body.error, 'not_allowed');
});

test('remind: the trigger secret allows only remind, nothing else', async () => {
  const w = await runWorld({ fl: { status: 'waiting' } });
  w.db.setCaller(null);   // the anon key in the header is no one
  const before = w.snapshot();
  for (const action of ['start', 'preview', 'retry', 'google_manual', 'send_grid_link', 'nope', undefined]) {
    const r = await w.post({ action, flow_id: 21, candidate_id: 11, call_at: CALL, manager_member_id: 2 }, { 'x-wa-secret': SECRET, Authorization: 'Bearer anon-key-for-tests' });
    assert.equal(r.status, 401, String(action));
    assert.equal(r.body.error, 'signed_out');
  }
  assert.deepEqual(w.snapshot(), before);
  assert.deepEqual(w.rig.fetchLog, []);
});

/* ---------- remind: HR about the hire's grid ---------- */
test('remind: before onboard_remind_hours nothing goes; after, HR hears about the hire\'s grid once, and the hire hears nothing', async () => {
  const w = await runWorld({ fl: { created_at: '2026-10-19T00:00:00Z' } });   // 36 hours old
  let r = await w.remind();
  assert.equal(r.status, 200);
  assert.deepEqual(w.sent.filter((m) => m.event === 'onboard_remind'), []);
  w.rig.setNow('2026-10-20T23:00:00Z');   // 47 hours
  await w.remind();
  assert.deepEqual(w.sent.filter((m) => m.event === 'onboard_remind'), []);
  w.rig.setNow('2026-10-21T01:00:00Z');   // 49 hours
  r = await w.remind();
  const hr = w.sent.filter((m) => m.event === 'onboard_remind' && Array.isArray(m.to));
  assert.equal(hr.length, 1);
  assert.deepEqual(hr[0].to, HR);
  assert.equal(hr[0].url, '#hrcentre/onboarding');
  assert.match(hr[0].text, /Alex Tremblay/);
  assert.match(hr[0].text, /availability/);
  assert.equal(hr[0].tag, 'onboard-remind-hire-21');
  assert.equal(r.body.reminded_hr, 1);
  assert.equal(w.flow().reminded_hire_at, '2026-10-21T01:00:00.000Z');
  await w.remind();
  w.rig.setNow('2026-10-25T01:00:00Z');
  await w.remind();
  assert.equal(w.sent.filter((m) => m.event === 'onboard_remind' && Array.isArray(m.to)).length, 1, 'once, however many hours pass');
  for (const m of w.sent) {
    const to = [].concat(m.to || [], m.to_email || []).map((x) => String(x).toLowerCase());
    assert.ok(!to.includes(HIRE), 'nothing goes to the new hire');
    assert.ok(!JSON.stringify(m).includes(HIRE), 'and the hire\'s personal address is not even in a message');
  }
  assert.deepEqual(w.rig.fetchLog.filter((e) => e.url !== NOTIFY), [], 'no mail, Slack or Google call comes from remind');
  assert.deepEqual(w.rig.unregistered(), []);
});

test('remind: an hour setting of its own is used (onboard_remind_hours)', async () => {
  const w = await runWorld({ config: { onboard_remind_hours: '6' }, fl: { created_at: '2026-10-20T04:00:00Z' } });   // 8 hours old
  await w.remind();
  assert.equal(w.sent.filter((m) => Array.isArray(m.to)).length, 1);
});

test('remind: the hire\'s own marks, a booked call, a practice flow, a closed card or a flow that backed out stop the HR reminder', async () => {
  const cases = [
    ['grid marked', { tables: { hub_onboard_grids: [{ flow_id: 21, who: 'hire', slots: ['2026-10-25T14:00:00Z'] }] } }],
    ['both meetings booked', { fl: { call_at: CALL, one_on_one_at: ONE, status: 'ready' } }],
    ['practice', { cand: { practice: true } }],
    ['backed out', { fl: { status: 'backed_out' } }],
    ['declined card', { cand: { status: 'declined' } }],
  ];
  for (const [label, over] of cases) {
    const w = await runWorld(over);
    const before = w.snapshot();
    await w.remind();
    assert.deepEqual(w.sent.filter((m) => Array.isArray(m.to)), [], label);
    if (label === 'practice') assert.deepEqual(w.snapshot(), before, 'a practice flow is not even marked');
  }
  const empty = await runWorld({ tables: { hub_onboard_grids: [{ flow_id: 21, who: 'hire', slots: [] }] } });
  await empty.remind();
  assert.equal(empty.sent.filter((m) => Array.isArray(m.to)).length, 1, 'a grid opened and saved with nothing marked is still empty');
});

test('remind: with no hr_notify_emails nothing is sent and nothing is marked, so the next hour tries again', async () => {
  const w = await runWorld({ config: { hr_notify_emails: '' } });
  const r = await w.remind();
  assert.equal(r.status, 200);
  assert.equal(w.sent.filter((m) => m.event === 'onboard_remind' && Array.isArray(m.to)).length, 0);
  assert.equal(w.flow().reminded_hire_at, null);
});

test('remind: when notify cannot be reached the reminder is not marked as sent, and the next hour sends it', async () => {
  let fail = true;
  const w = await runWorld({ notifyReply: () => (fail ? { status: 500, json: { error: 'boom' } } : { json: { outcome: { 'hr.one@welfareavenue.com': 'sent', 'hr.two@welfareavenue.com': 'sent' } } }) });
  const r = await w.remind();
  assert.equal(r.status, 200);
  assert.equal(r.body.reminded_hr, 0);
  assert.equal(w.flow().reminded_hire_at, null);
  fail = false;
  const again = await w.remind();
  assert.equal(again.body.reminded_hr, 1);
  assert.ok(w.flow().reminded_hire_at);
});

test('remind: two runs at once send the reminder once', async () => {
  const w = await runWorld();
  await Promise.all([w.remind(), w.remind()]);
  assert.equal(w.sent.filter((m) => m.event === 'onboard_remind' && Array.isArray(m.to)).length, 1);
});

/* ---------- remind: the manager's grid link, and the manager's reminder ---------- */
test('remind: the manager\'s grid link goes once when the default manager is unambiguous, with a signed link', async () => {
  const w = await runWorld({ fl: { created_at: '2026-10-20T11:00:00Z' } });
  const r = await w.remind();
  const links = w.sent.filter((m) => m.event === 'onboard_grid');
  assert.equal(links.length, 1);
  assert.equal(r.body.grid_links, 1);
  assert.equal(links[0].to_email, 'sam.lee@welfareavenue.com');
  assert.ok(links[0].text.includes('https://hub.welfareavenue.com/o/' + mgrLink(21)), 'the text carries the manager\'s own link');
  assert.equal(links[0].url, '/o/' + mgrLink(21));
  assert.match(links[0].text, /Alex Tremblay/);
  assert.equal(links[0].tag, 'onboard-grid-21');
  assert.equal(w.flow().manager_link_member_id, 2);
  assert.equal(w.flow().manager_link_sent_at, '2026-10-20T12:00:00.000Z');
  await w.remind();
  w.rig.setNow('2026-10-30T12:00:00Z');
  await w.remind();
  assert.equal(w.sent.filter((m) => m.event === 'onboard_grid').length, 1, 'sent once');
  assert.ok(w.sent.every((m) => !JSON.stringify(m).includes(HIRE)));
});

test('remind: no default manager and none confirmed means no link; HR confirming one sends it', async () => {
  const w = await runWorld({ manager: { member_id: null, name: null, how: 'none' } });
  await w.remind();
  assert.equal(w.sent.filter((m) => m.event === 'onboard_grid').length, 0);
  w.flow().manager_member_id = 1;   // HR confirmed Ruth
  await w.remind();
  const links = w.sent.filter((m) => m.event === 'onboard_grid');
  assert.equal(links.length, 1);
  assert.equal(links[0].to_email, 'ruth.owen@welfareavenue.com');
  await w.remind();
  assert.equal(w.sent.filter((m) => m.event === 'onboard_grid').length, 1);
});

test('remind: HR confirming a different manager after the link went out sends the link to the new manager, once', async () => {
  const w = await runWorld();
  await w.remind();   // Sam, by default
  w.flow().manager_member_id = 1;   // HR picks Ruth
  await w.remind();
  await w.remind();
  const to = w.sent.filter((m) => m.event === 'onboard_grid').map((m) => m.to_email);
  assert.deepEqual(to, ['sam.lee@welfareavenue.com', 'ruth.owen@welfareavenue.com']);
  assert.equal(w.flow().manager_link_member_id, 1);
  assert.equal(w.flow().reminded_manager_at, null);
});

test('remind: a manager with no email is skipped and tried again later, not marked', async () => {
  const w = await runWorld({ manager: { member_id: 3, name: 'No Mail', how: 'reports_to' } });
  const r = await w.remind();
  assert.equal(r.status, 200);
  assert.equal(w.sent.filter((m) => m.event === 'onboard_grid').length, 0);
  assert.equal(w.flow().manager_link_sent_at, null);
});

test('remind: the manager is reminded about their grid after onboard_remind_hours from the link, once; their marks stop it', async () => {
  const w = await runWorld({ fl: { created_at: '2026-10-20T11:00:00Z' } });
  await w.remind();   // the link, at NOW
  w.rig.setNow('2026-10-22T11:00:00Z');   // 47 hours later
  await w.remind();
  assert.equal(w.sent.filter((m) => m.event === 'onboard_remind' && m.to_email).length, 0);
  w.rig.setNow('2026-10-22T13:00:00Z');   // 49 hours
  const r = await w.remind();
  const mine = w.sent.filter((m) => m.event === 'onboard_remind' && m.to_email);
  assert.equal(mine.length, 1);
  assert.equal(r.body.reminded_managers, 1);
  assert.equal(mine[0].to_email, 'sam.lee@welfareavenue.com');
  assert.ok(mine[0].text.includes('https://hub.welfareavenue.com/o/' + mgrLink(21)));
  assert.equal(mine[0].url, '/o/' + mgrLink(21));
  assert.equal(mine[0].tag, 'onboard-remind-manager-21');
  assert.equal(w.flow().reminded_manager_at, '2026-10-22T13:00:00.000Z');
  w.rig.setNow('2026-10-30T13:00:00Z');
  await w.remind();
  assert.equal(w.sent.filter((m) => m.event === 'onboard_remind' && m.to_email).length, 1, 'once');

  const marked = await runWorld({ fl: { created_at: '2026-10-20T11:00:00Z' } });
  await marked.remind();
  marked.db.rows('hub_onboard_grids').push({ flow_id: 21, who: 'manager', slots: ['2026-10-25T14:00:00Z'] });
  marked.rig.setNow('2026-10-25T13:00:00Z');
  await marked.remind();
  assert.equal(marked.sent.filter((m) => m.event === 'onboard_remind' && m.to_email).length, 0, 'a marked grid needs no reminder');
});

test('remind: once the 1-on-1 is booked the manager hears nothing more', async () => {
  const w = await runWorld({ fl: { status: 'started', call_at: CALL, one_on_one_at: ONE } });
  await w.remind();
  assert.equal(w.sent.filter((m) => m.event === 'onboard_grid' || (m.event === 'onboard_remind' && m.to_email)).length, 0);
});

test('remind: a practice flow sends nothing and writes nothing', async () => {
  const w = await runWorld({ cand: { practice: true } });
  const before = w.snapshot();
  const r = await w.remind();
  assert.equal(r.status, 200);
  assert.deepEqual(w.sent, []);
  assert.deepEqual(w.snapshot(), before);
  assert.deepEqual(w.rig.fetchLog, []);
});

test('remind: end to end through notify, the HR list and the manager get their Slack DMs and the hire gets none', async () => {
  const notify = await notifyWorld();
  const w = await runWorld({ notify });
  await w.remind();
  w.rig.setNow('2026-10-23T12:00:00Z');
  await w.remind();
  const dms = notify.slack().map((e) => e.body.channel).sort();
  assert.deepEqual(dms, ['D-UHR1', 'D-UHR2', 'D-USAM', 'D-USAM'], 'each of the two HR people once, the manager twice (the link, then the reminder)');
  assert.deepEqual(notify.db.rows('hub_notifications_sent').map((r) => r.kind).sort(), ['onboard_grid', 'onboard_remind', 'onboard_remind', 'onboard_remind']);
  assert.deepEqual(w.rig.unregistered(), []);
  assert.deepEqual(notify.unregistered(), []);
  assert.ok(notify.fetchLog.every((e) => !JSON.stringify(e).includes(HIRE)));
});

test('remind: when the flows query fails (for example wa271b not applied yet) the job says so with a 500, not a quiet ok', async () => {
  const w = await runWorld();
  w.db.failOn('hub_onboard_flows', 'select', 'column hub_onboard_flows.manager_link_member_id does not exist');
  const r = await w.remind();
  assert.equal(r.status, 500);
  assert.equal(r.body.ok, false);
  assert.match(r.body.message, /manager_link_member_id/);
  assert.equal(w.sent.length, 0);
  const again = await w.remind();   // the failure was a one-off: the next hour runs as normal
  assert.equal(again.status, 200);
  assert.equal(again.body.ok, true);
});

/* ---------- fix round 1: a 200 from notify is not "delivered" ---------- */
const SAM = 'sam.lee@welfareavenue.com';
const answer = (outcome, hub = 'off') => () => ({ json: { outcome, hub } });   // notify's answer: HTTP 200 and a word for each person
const linksSent = (w) => w.sent.filter((m) => m.event === 'onboard_grid').length;

for (const lost of ['failed', 'no_slack', 'no_email']) {
  test('remind: the manager link is given back when notify says ' + lost + ', listed in skipped, and the next hour sends it', async () => {
    let word = lost;
    const w = await runWorld({ notifyReply: (e) => answer({ [SAM]: word })(e) });
    const r = await w.remind();
    assert.equal(r.body.grid_links, 0);
    assert.equal(w.flow().manager_link_sent_at, null);
    assert.equal(w.flow().manager_link_member_id, null);
    assert.equal(r.body.skipped.filter((s) => s.includes('grid link') && s.includes(SAM)).length, 1, JSON.stringify(r.body.skipped));
    word = 'sent';
    const again = await w.remind();
    assert.equal(again.body.grid_links, 1);
    assert.ok(w.flow().manager_link_sent_at);
    assert.equal(linksSent(w), 2, 'tried twice, delivered once');
    await w.remind();
    assert.equal(linksSent(w), 2, 'and then it stops');
  });

  test('remind: the HR reminder is given back when notify says ' + lost + ' for everyone, and the next hour retries', async () => {
    let word = lost;
    const w = await runWorld({ fl: { manager_member_id: 3 }, notifyReply: (e) => answer(Object.fromEntries(HR.map((h) => [h, word])))(e) });
    const r = await w.remind();
    assert.equal(r.body.reminded_hr, 0);
    assert.equal(w.flow().reminded_hire_at, null);
    assert.ok(r.body.skipped.some((s) => s.includes('HR reminder') && s.includes(HR[0]) && s.includes(HR[1])), JSON.stringify(r.body.skipped));
    word = 'sent';
    assert.equal((await w.remind()).body.reminded_hr, 1);
    assert.ok(w.flow().reminded_hire_at);
  });

  test('remind: the manager reminder is given back when notify says ' + lost + ', and the next hour retries', async () => {
    let word = 'sent';
    const w = await runWorld({ fl: { created_at: '2026-10-20T11:00:00Z', manager_link_sent_at: '2026-10-17T12:00:00Z', manager_link_member_id: 2 }, notifyReply: (e) => answer({ [SAM]: word })(e) });
    word = lost;
    const r = await w.remind();
    assert.equal(r.body.reminded_managers, 0);
    assert.equal(w.flow().reminded_manager_at, null);
    assert.ok(r.body.skipped.some((s) => s.includes('manager reminder') && s.includes(SAM)), JSON.stringify(r.body.skipped));
    word = 'sent';
    assert.equal((await w.remind()).body.reminded_managers, 1);
    assert.ok(w.flow().reminded_manager_at);
  });
}

test('remind: opted_out is their own choice: handled, marked, and never retried', async () => {
  const w = await runWorld({ fl: { created_at: '2026-10-15T12:00:00Z' }, notifyReply: (e) => answer(Object.fromEntries([].concat(e.body.to || e.body.to_email).map((x) => [x, 'opted_out'])))(e) });
  const r = await w.remind();
  assert.equal(r.body.grid_links, 1);
  assert.equal(r.body.reminded_hr, 1);
  assert.ok(w.flow().manager_link_sent_at && w.flow().reminded_hire_at);
  assert.deepEqual(r.body.skipped, []);
  const before = w.sent.length;
  await w.remind();
  assert.equal(w.sent.length, before, 'nothing is sent again');
});

test('remind: a Hub notification that reached a device counts as reached; one that reached none does not', async () => {
  const hubOnly = await runWorld({ notifyReply: (e) => answer({ [SAM]: 'no_slack' }, SAM + ': sent to 1 device')(e) });
  assert.equal((await hubOnly.remind()).body.grid_links, 1);
  assert.ok(hubOnly.flow().manager_link_sent_at);
  const two = await runWorld({ notifyReply: (e) => answer({ [SAM]: 'failed' }, 'someone.else@welfareavenue.com: sent to 1 device; ' + SAM + ': sent to 2 devices')(e) });
  assert.equal((await two.remind()).body.grid_links, 1, 'found among several people in the Hub answer');
  const none = await runWorld({ notifyReply: (e) => answer({ [SAM]: 'no_slack' }, SAM + ': sent to 0 devices, 1 failed (410)')(e) });
  assert.equal((await none.remind()).body.grid_links, 0);
  assert.equal(none.flow().manager_link_sent_at, null);
  const noDevice = await runWorld({ notifyReply: (e) => answer({ [SAM]: 'no_slack' }, SAM + ': no device')(e) });
  assert.equal((await noDevice.remind()).body.grid_links, 0);
  const hubOnlyChoice = await runWorld({ notifyReply: (e) => answer({ [SAM]: 'hub_only' })(e) });
  assert.equal((await hubOnlyChoice.remind()).body.grid_links, 1, 'hub_only is a Hub delivery by their own choice');
});

test('remind: HR with several recipients is handled when at least one was reached or opted out, and not when none were', async () => {
  const cases = [
    [{ [HR[0]]: 'sent', [HR[1]]: 'no_slack' }, true],
    [{ [HR[0]]: 'no_email', [HR[1]]: 'sent_channel' }, true],
    [{ [HR[0]]: 'opted_out', [HR[1]]: 'failed' }, true],
    [{ [HR[0]]: 'opted_out', [HR[1]]: 'opted_out' }, true],
    [{ [HR[0]]: 'no_slack', [HR[1]]: 'failed' }, false],
    [{}, false],
  ];
  for (const [outcome, handled] of cases) {
    const w = await runWorld({ fl: { manager_member_id: 3 }, notifyReply: answer(outcome) });
    const r = await w.remind();
    assert.equal(r.body.reminded_hr, handled ? 1 : 0, JSON.stringify(outcome));
    assert.equal(!!w.flow().reminded_hire_at, handled, JSON.stringify(outcome));
    if (handled && Object.values(outcome).includes('no_slack')) assert.ok(r.body.skipped.some((s) => s.includes(HR[1]) || s.includes(HR[0])), 'the one missed is named');
  }
});

test('step manager: nobody reached makes the step failed, with a sentence HR can act on; Retry then works', async () => {
  let word = 'no_slack';
  const w = await runWorld({ notifyReply: (e) => answer({ [SAM]: word })(e) });
  await w.post({ action: 'start', flow_id: 21, manager_member_id: 2, call_at: CALL, one_on_one_at: ONE, skip: ['google', 'plan', 'invites', 'hub', 'slack', 'welcome'] });
  assert.equal(w.step('manager').status, 'failed');
  assert.equal(w.step('manager').detail, 'Sam Lee was not told: they have no Slack account and no Hub notifications on. Tell them yourself, or press Retry.');
  word = 'sent';
  const r = await w.post({ action: 'retry', flow_id: 21, step: 'manager' });
  assert.equal(r.status, 200);
  assert.equal(w.step('manager').status, 'done');
  assert.equal(w.step('manager').detail, 'Told Sam Lee the date and time.');
});

test('step manager: each way of not being reached is a failed step; a Hub delivery is reached', async () => {
  for (const [word, hub, status] of [['failed', 'off', 'failed'], ['no_email', 'off', 'failed'], ['', 'off', 'failed'], ['no_slack', SAM + ': sent to 1 device', 'done'], ['hub_only', 'off', 'done'], ['sent_channel', 'off', 'done']]) {
    const w = await runWorld({ notifyReply: answer(word ? { [SAM]: word } : {}, hub) });
    await w.post({ action: 'start', flow_id: 21, manager_member_id: 2, call_at: CALL, one_on_one_at: ONE, skip: ['google', 'plan', 'invites', 'hub', 'slack', 'welcome'] });
    assert.equal(w.step('manager').status, status, word + ' / ' + hub);
    if (status === 'failed') assert.match(w.step('manager').detail, /Sam Lee was not told: .* Tell them yourself, or press Retry[.]$/);
  }
});

test('step manager: opted_out is done, and the detail says their switch is off', async () => {
  const w = await runWorld({ notifyReply: answer({ [SAM]: 'opted_out' }) });
  await w.post({ action: 'start', flow_id: 21, manager_member_id: 2, call_at: CALL, one_on_one_at: ONE, skip: ['google', 'plan', 'invites', 'hub', 'slack', 'welcome'] });
  assert.equal(w.step('manager').status, 'done');
  assert.match(w.step('manager').detail, /Sam Lee was not messaged: their switch for this notification is off/);
});

test('step manager through the real notify: a manager with no Slack account and no device is a failed step', async () => {
  const notify = await notifyWorld();
  notify.db.rows('wa_slack_ids').splice(0, notify.db.rows('wa_slack_ids').length, { email: HR[0], slack_id: 'UHR1' });   // Sam has no Slack row, and Slack cannot find them
  const w = await runWorld({ notify });
  await w.post({ action: 'start', flow_id: 21, manager_member_id: 2, call_at: CALL, one_on_one_at: ONE, skip: ['google', 'plan', 'invites', 'hub', 'slack', 'welcome'] });
  assert.equal(w.step('manager').status, 'failed');
  assert.match(w.step('manager').detail, /Sam Lee was not told: they have no Slack account and no Hub notifications on/);
  assert.equal(notify.slack().length, 0);
});

test('remind: when the manager row was deleted (member id null) the link goes to the manager now named, once', async () => {
  const w = await runWorld({ fl: { manager_link_sent_at: '2026-10-17T12:00:00Z', manager_link_member_id: null, reminded_manager_at: '2026-10-19T12:00:00Z' } });
  const r = await w.remind();
  assert.equal(r.body.grid_links, 1);
  assert.equal(w.flow().manager_link_member_id, 2);
  assert.equal(w.flow().reminded_manager_at, null, 'their reminder starts again');
  assert.equal(linksSent(w), 1);
  await w.remind();
  assert.equal(linksSent(w), 1, 'once');
});

/* ---------- whole-branch review (final-findings.md): I1 ---------- */
test('I1: remind leaves alone a closed card, and anyone before Start who already has an open plan', async () => {
  const old = '2026-10-10T12:00:00Z';
  const told = (w) => w.rig.fetchLog.filter((e) => e.url === NOTIFY).length;
  for (const status of ['withdrawn', 'declined']) {
    const w = await runWorld({ cand: { status }, fl: { created_at: old } });
    await w.remind();
    assert.equal(told(w), 0, status);
  }
  for (const cand of [{ member_id: 1 }, { email: 'Ruth.Owen@welfareavenue.com' }]) {
    const w = await runWorld({ cand, fl: { created_at: old }, tables: { onboardings: [{ id: 7, member_id: 1, completed_at: null }] } });
    await w.remind();
    assert.equal(told(w), 0, JSON.stringify(cand));
  }
  const done = await runWorld({ cand: { member_id: 1 }, fl: { created_at: old }, tables: { onboardings: [{ id: 7, member_id: 1, completed_at: '2026-01-01T00:00:00Z' }] } });
  await done.remind();
  assert.ok(told(done) > 0, 'a finished plan does not count');
});

test('I1: a flow already started keeps its reminders: its own plan is not a reason to stop', async () => {
  const w = await runWorld({ cand: { member_id: 1 }, fl: { status: 'started', onboarding_id: 7, manager_member_id: 2, call_at: CALL, created_at: '2026-10-10T12:00:00Z' }, tables: { onboardings: [{ id: 7, member_id: 1, completed_at: null }] } });
  await w.remind();
  assert.ok(w.rig.fetchLog.filter((e) => e.url === NOTIFY).length > 0);
});

/* ---------- wave275 Task 2: the three new relay kinds ---------- */
test('w275: notify takes onboard_propose, onboard_answer and onboard_ready like onboard_date: the Slack DM, the Hub notification and the log', async () => {
  for (const [event, url] of [['onboard_propose', '/o/21.abc'], ['onboard_answer', '#hrcentre/onboarding'], ['onboard_ready', '#hrcentre/onboarding']]) {
    const n = await notifyWorld();
    const r = await n.send(dateMsg({ event, url, title: 'Sam Lee proposed times for Alex Tremblay', tag: event + '-21' }));
    assert.equal(r.status, 200, event);
    assert.deepEqual(r.body.outcome, { 'sam.lee@welfareavenue.com': 'sent' }, event);
    assert.equal(n.slack().length, 1, event);
    assert.equal(n.push().length, 1, event);
    assert.equal(n.push()[0].body.kind, event);
    assert.equal(n.push()[0].body.url, url.startsWith('/') ? url : '/' + url);
    assert.equal(n.db.rows('hub_notifications_sent')[0].kind, event);
    assert.deepEqual(n.unregistered(), []);
  }
  const list = await notifyWorld({ prefs: [{ email: HR[1], disabled: [], prefs: { kinds: { onboard_answer: { slack: false } } } }] });
  const r = await list.send(dateMsg({ event: 'onboard_answer', to_email: undefined, to: HR, url: undefined, title: undefined }));
  assert.deepEqual(r.body.outcome, { [HR[0]]: 'sent', [HR[1]]: 'opted_out' }, 'the HR list, each through their own switch');
  assert.equal(list.push()[0].body.url, '/#hrcentre/onboarding', 'the default page');
  assert.ok(list.push()[0].body.title, 'a default title');
  const signedIn = await notifyWorld();
  signedIn.db.setCaller({ email: 'hr.person@welfareavenue.com' });
  assert.equal((await signedIn.send(dateMsg({ event: 'onboard_propose' }), { Authorization: 'Bearer user-jwt' })).status, 401, 'the Hub itself only');
});
