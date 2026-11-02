// wave271 Task 6: notifications and reminders, proved offline on the in-memory rig (test/w271rig.mjs). Run: node --test test/w271notify.test.mjs
// Two functions side by side: notify (the three new relay events onboard_date, onboard_grid, onboard_remind) and onboard-run (the manager step,
// and the hourly action remind). Slack, hub-push and every other URL are stubs: nothing is sent anywhere, and an unregistered URL fails the call.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync } from 'node:crypto';
import { loadFn } from './w271rig.mjs';
import { availabilityOf } from './w275avail.mjs';

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
async function runWorld({ cand = {}, fl = {}, config = {}, tables = {}, hr = true, manager = { member_id: 2, name: 'Sam Lee', how: 'reports_to' }, notifyReply, notify = null, secrets = {} } = {}) {
  const rig = await loadFn('onboard-run', {
    secrets,
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

/* ---------- wave275 Task 5: ask_manager {flow_id} (the manager is asked for times as the offer goes out) and remind on the propose path ---------- */
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const LINK_FN = BASE + 'onboard-link';
const { privateKey: KEY5 } = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const SA5 = JSON.stringify({ client_email: 'hub@stub.iam', private_key: KEY5, token_uri: 'https://oauth2.googleapis.com/token' });
const offered5 = (over = {}) => ({ status: 'offered', manager_member_id: 2, created_at: '2026-10-19T12:00:00Z', proposed_call_at: null, proposed_one_on_one_at: null, proposed_by: null, proposed_at: null, hire_answer: null, setup_ticks: {}, ...over });
function tickSet5(a, db) {   // wa275_tick_set as wa275a has it: one key merged; p_if_unset writes only while it is empty
  const f = db.rows('hub_onboard_flows').find((r) => Number(r.id) === Number(a.p_flow));
  if (!f) return false;
  const cur = f.setup_ticks && typeof f.setup_ticks === 'object' ? f.setup_ticks : {};
  if (a.p_if_unset && cur[a.p_key] != null) return false;
  f.setup_ticks = { ...cur, [a.p_key]: a.p_value ?? null };
  return true;
}
async function askWorld({ cand = {}, fl = {}, config = {}, gmailReply, ...o } = {}) {
  const w = await runWorld({ cand: { accepted_on: null, ...cand }, fl: offered5(fl), config: { mail_mode: 'live', mail_test_recipients: 'tester@welfareavenue.com', onboard_call_min: '60', onboard_one_on_one_min: '30', onboard_propose_lead_hours: '48', ...config }, secrets: { GOOGLE_SA_KEY: SA5 }, ...o });
  w.db.onRpc('wa275_tick_set', tickSet5);
  w.rig.fetchOn('https://oauth2.googleapis.com/token', { json: { access_token: 'tok', expires_in: 3600 } });
  w.rig.fetchOn(GMAIL, (e) => (gmailReply ? gmailReply(e) : { json: { id: 'mail1' } }));
  w.gmail = () => w.rig.fetchLog.filter((e) => e.url === GMAIL);
  w.ask = (headers = { 'x-wa-secret': SECRET, Authorization: 'Bearer anon-key-for-tests' }) => w.post({ action: 'ask_manager', flow_id: 21 }, headers);
  w.asks = () => w.sent.filter((m) => m.event === 'onboard_propose');
  return w;
}
const mime5 = (entry) => {   // the decoded MIME of a Gmail send: headers and the two bodies
  const raw = Buffer.from(entry.body.raw, 'base64url').toString();
  const lines = raw.split('\r\n');
  const dec = (h) => { const m = /=\?UTF-8\?B\?(.*)\?=/.exec(h); return m ? Buffer.from(m[1], 'base64').toString() : h; };
  const bodies = [...raw.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=]+)/g)].map((m) => Buffer.from(m[1], 'base64').toString());
  return { to: lines.find((l) => l.startsWith('To: ')).slice(4), from: lines.find((l) => l.startsWith('From: ')), subject: dec(lines.find((l) => l.startsWith('Subject: ')).slice(9)), text: bodies[0], html: bodies[1] };
};
const hubWords = (s) => !/—/.test(s) && !/\bAI\b/.test(s);

test('w275 ask_manager (the trigger secret): a Slack DM through onboard_propose and an email from hub@, each with the manager\'s own link; the flow records who holds it, and onboard-link opens it in propose mode', async () => {
  const w = await askWorld();
  const r = await w.ask();
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.equal(r.body.sent, true);
  const link = 'https://hub.welfareavenue.com/o/' + mgrLink(21);
  const dm = w.asks();
  assert.equal(dm.length, 1, 'one Slack DM');
  assert.equal(dm[0].to_email, SAM);
  assert.equal(dm[0].url, '/o/' + mgrLink(21));
  assert.equal(dm[0].tag, 'onboard-propose-21');
  assert.equal(dm[0].title, 'Propose the onboarding call and the 1-on-1 for Alex Tremblay');
  assert.ok(dm[0].text.includes('<' + link + '|'), dm[0].text);
  assert.equal(w.gmail().length, 1, 'one email');
  const m = mime5(w.gmail()[0]);
  assert.equal(m.to, SAM, 'live mode: to the manager');
  assert.match(m.from, /<hub@welfareavenue\.com>$/);
  assert.equal(m.subject, 'Propose the onboarding call and the 1-on-1 for Alex Tremblay');
  assert.ok(m.text.startsWith('Hi Sam,'), m.text);
  assert.ok(m.text.includes(link), 'the text carries the link');
  assert.ok(m.html.includes('href="' + link + '"'), 'the button is the link');
  assert.match(m.text, /60 minutes/);
  assert.match(m.text, /30 minutes/);
  assert.match(m.text, /48 hours/);
  for (const s of [m.text, m.html, dm[0].text, dm[0].body, dm[0].title]) assert.ok(hubWords(s), s);
  assert.equal(w.flow().manager_link_member_id, 2);
  assert.equal(w.flow().manager_link_sent_at, '2026-10-20T12:00:00.000Z');
  assert.equal(w.flow().reminded_manager_at, null);
  assert.ok(w.rig.fetchLog.every((e) => !JSON.stringify(e.body).includes(HIRE)), 'nothing goes to the new hire');
  assert.deepEqual(w.rig.unregistered(), []);
  /* the link the manager got, read by onboard-link itself on the same database */
  const ol = await loadFn('onboard-link', {});
  ol.db.tables = w.db.tables;
  ol.db.onRpc('wa275_availability_of', availabilityOf);   // amended 02/11/26: the manager's hours are read through the function
  ol.setNow(NOW);
  const t = decodeURIComponent(new URL(link).pathname.slice(3));
  assert.equal(t, await ol.mod.wa271Token('mgr', 21), 'onboard-link\'s own token for the flow');
  const g = await ol.call(new Request(LINK_FN + '?t=' + encodeURIComponent(t)));
  const gb = await g.json();
  assert.equal(g.status, 200, JSON.stringify(gb));
  assert.equal(gb.kind, 'manager');
  assert.equal(gb.mode, 'propose');
  assert.equal(gb.notYours, undefined, 'the link is the manager\'s own (manager_link_member_id is set)');
  assert.equal(gb.first, 'Sam');
  const bad = await ol.call(new Request(LINK_FN + '?t=' + encodeURIComponent(t.slice(0, -1) + (t.endsWith('A') ? 'B' : 'A'))));
  assert.equal(bad.status, 404, 'a changed letter is refused');
  assert.deepEqual(ol.unregistered(), []);
});

test('w275 ask_manager: sent once for the same manager by the secret; HR or an admin signed in can send it again from the card; anyone else is refused', async () => {
  const w = await askWorld();
  await w.ask();
  const again = await w.ask();
  assert.equal(again.status, 200);
  assert.equal(again.body.skipped, 'already_sent');
  assert.match(again.body.reason, /already/);
  assert.equal(w.asks().length, 1);
  assert.equal(w.gmail().length, 1);
  w.rig.setNow('2026-10-21T12:00:00Z');
  const hr = await w.post({ action: 'ask_manager', flow_id: 21 });
  assert.equal(hr.status, 200, JSON.stringify(hr.body));
  assert.equal(hr.body.sent, true, 'HR re-sends from the card');
  assert.equal(w.asks().length, 2);
  assert.equal(w.gmail().length, 2);
  assert.equal(w.flow().manager_link_sent_at, '2026-10-21T12:00:00.000Z');
  const plain = await askWorld({ hr: false });
  const r = await plain.post({ action: 'ask_manager', flow_id: 21 });
  assert.equal(r.status, 403);
  assert.ok(r.body.message && hubWords(r.body.message));
  assert.equal(plain.asks().length, 0);
  assert.equal(plain.flow().manager_link_sent_at, null);
});

test('w275 ask_manager: two calls at once send once', async () => {
  const w = await askWorld();
  const [a, b] = await Promise.all([w.ask(), w.ask()]);
  assert.deepEqual([a.status, b.status], [200, 200]);
  assert.equal(w.asks().length, 1);
  assert.equal(w.gmail().length, 1);
});

test('w275 ask_manager: a new manager (changed after the link went out) gets their own link, and their reminder clock starts again', async () => {
  const w = await askWorld({ fl: { manager_link_member_id: 2, manager_link_sent_at: '2026-10-17T12:00:00Z', reminded_manager_at: '2026-10-19T12:00:00Z', manager_member_id: 1 } });
  const r = await w.ask();
  assert.equal(r.body.sent, true, JSON.stringify(r.body));
  assert.equal(w.asks()[0].to_email, 'ruth.owen@welfareavenue.com');
  assert.equal(w.flow().manager_link_member_id, 1);
  assert.equal(w.flow().reminded_manager_at, null);
});

test('w275 ask_manager in mail test mode emails the test inboxes, marked with the manager\'s address', async () => {
  const w = await askWorld({ config: { mail_mode: 'test' } });
  await w.ask();
  const m = mime5(w.gmail()[0]);
  assert.equal(m.to, 'tester@welfareavenue.com');
  assert.ok(m.subject.startsWith('[TEST, for ' + SAM + '] '), m.subject);
});

test('w275 ask_manager on a practice flow: the link is recorded so the walkthrough link works, and nothing is fetched', async () => {
  const w = await askWorld({ cand: { practice: true } });
  const r = await w.ask();
  assert.equal(r.status, 200);
  assert.equal(r.body.practice, true);
  assert.deepEqual(w.rig.fetchLog, [], 'no notify, no Google, no Gmail');
  assert.equal(w.flow().manager_link_member_id, 2);
  assert.ok(w.flow().manager_link_sent_at);
});

test('w275 ask_manager is a quiet no-op with a reason for a flow past the asking, one with live times, or a closed card; nothing is sent', async () => {
  for (const [fl, cand, skipped] of [
    [{ status: 'running', call_at: CALL }, {}, 'not_open'],
    [{ status: 'backed_out' }, {}, 'closed'],
    [{}, { status: 'declined' }, 'closed'],
    [{}, { status: 'withdrawn' }, 'closed'],
    [{ proposed_call_at: '2026-10-26T14:00:00Z', proposed_one_on_one_at: '2026-10-26T16:00:00Z', proposed_at: '2026-10-20T10:00:00Z', proposed_by: SAM }, {}, 'proposed'],
  ]) {
    const w = await askWorld({ fl, cand });
    const before = w.snapshot();
    const r = await w.ask();
    assert.equal(r.status, 200, JSON.stringify(fl) + JSON.stringify(cand));
    assert.equal(r.body.ok, true);
    assert.equal(r.body.skipped, skipped, JSON.stringify(r.body));
    assert.ok(r.body.reason && hubWords(r.body.reason) && /\.$/.test(r.body.reason), r.body.reason);
    assert.deepEqual(w.rig.fetchLog, []);
    assert.deepEqual(w.snapshot(), before, 'nothing written');
  }
  /* times the hire said no to are spent: the manager can be asked again */
  const no = await askWorld({ fl: { status: 'waiting', proposed_call_at: '2026-10-26T14:00:00Z', proposed_one_on_one_at: '2026-10-26T16:00:00Z', proposed_at: '2026-10-20T10:00:00Z', hire_answer: 'no' }, cand: { accepted_on: '2026-10-19' } });
  assert.equal((await no.ask()).body.sent, true);
});

test('w275 ask_manager refuses, in a plain sentence, a flow with no manager, an inactive manager or one with no roster email; nothing is written', async () => {
  for (const [fl, tables, code, words] of [
    [{ manager_member_id: null }, {}, 'no_manager', /no onboarding manager/],
    [{}, { team_members: [TEAM[0], { ...TEAM[1], active: false }, TEAM[2]] }, 'manager_inactive', /Sam Lee is no longer active/],
    [{ manager_member_id: 3 }, {}, 'manager_no_email', /No Mail has no email on the roster/],
  ]) {
    const w = await askWorld({ fl, tables, manager: { member_id: null, name: null, how: 'none' } });
    const before = w.snapshot();
    const r = await w.ask();
    assert.equal(r.status, 409, code);
    assert.equal(r.body.error, code);
    assert.match(r.body.message, words);
    assert.ok(hubWords(r.body.message));
    assert.deepEqual(w.rig.fetchLog, []);
    assert.deepEqual(w.snapshot(), before);
  }
  const gone = await askWorld();
  const r = await gone.post({ action: 'ask_manager', flow_id: 99 }, { 'x-wa-secret': SECRET, Authorization: 'Bearer anon-key-for-tests' });
  assert.equal(r.status, 404);
});

test('w275 ask_manager: Slack or the email alone is enough (the other is a warning); when neither reaches them the claim is given back and the hourly job tries again', async () => {
  const slackLost = await askWorld({ notifyReply: answer({ [SAM]: 'no_slack' }) });
  const a = await slackLost.ask();
  assert.equal(a.body.sent, true);
  assert.ok(a.body.warnings.some((x) => /Slack/.test(x)), JSON.stringify(a.body));
  assert.ok(slackLost.flow().manager_link_sent_at);

  const mailLost = await askWorld({ gmailReply: () => ({ status: 500, json: { error: { message: 'Backend Error' } } }) });
  const b = await mailLost.ask();
  assert.equal(b.body.sent, true);
  assert.ok(b.body.warnings.some((x) => /email/.test(x) && /Backend Error/.test(x)), JSON.stringify(b.body));

  let word = 'failed';
  const both = await askWorld({ notifyReply: (e) => answer({ [SAM]: word })(e), gmailReply: () => ({ status: 500, json: { error: { message: 'Backend Error' } } }) });
  const c = await both.ask();
  assert.equal(c.status, 502);
  assert.equal(c.body.error, 'not_sent');
  assert.match(c.body.message, /Sam Lee was not reached/);
  assert.equal(both.flow().manager_link_sent_at, null, 'given back');
  assert.equal(both.flow().manager_link_member_id, null);
  /* the hourly job sends it once something gets through */
  word = 'sent';
  const r = await both.remind();
  assert.equal(r.body.propose_links, 1, JSON.stringify(r.body));
  assert.equal(both.flow().manager_link_member_id, 2);
  assert.equal(both.asks().length, 2);
  assert.equal(both.sent.filter((m) => m.event === 'onboard_grid').length, 0, 'never the wave271 grid link');
});

test('w275 remind: 48 hours after the link with nothing proposed, the manager is reminded once and HR is told once; nothing before; the wave271 grid reminders never go', async () => {
  const w = await askWorld({ fl: { manager_link_member_id: 2, manager_link_sent_at: '2026-10-19T12:00:00Z' } });
  let r = await w.remind();   // 24 hours
  assert.equal(r.status, 200);
  assert.deepEqual(w.sent, []);
  w.rig.setNow('2026-10-21T11:00:00Z');   // 47 hours
  await w.remind();
  assert.deepEqual(w.sent, []);
  w.rig.setNow('2026-10-21T13:00:00Z');   // 49 hours
  r = await w.remind();
  const mine = w.sent.filter((m) => m.event === 'onboard_remind' && m.to_email);
  const hr = w.sent.filter((m) => m.event === 'onboard_remind' && Array.isArray(m.to));
  assert.equal(mine.length, 1);
  assert.equal(mine[0].to_email, SAM);
  assert.equal(mine[0].tag, 'onboard-remind-propose-21');
  assert.equal(mine[0].url, '/o/' + mgrLink(21));
  assert.ok(mine[0].text.includes('https://hub.welfareavenue.com/o/' + mgrLink(21)));
  assert.match(mine[0].text, /Alex Tremblay/);
  assert.equal(hr.length, 1);
  assert.deepEqual(hr[0].to, HR);
  assert.equal(hr[0].tag, 'onboard-remind-propose-hr-21');
  assert.equal(hr[0].url, '#hrcentre/onboarding');
  assert.match(hr[0].title, /Sam Lee has not proposed times for Alex Tremblay/);
  for (const m of [...mine, ...hr]) for (const s of [m.text, m.title, m.body]) assert.ok(hubWords(s), s);
  assert.equal(r.body.reminded_managers, 1);
  assert.equal(r.body.reminded_hr, 1);
  assert.equal(w.flow().reminded_manager_at, '2026-10-21T13:00:00.000Z');
  w.rig.setNow('2026-10-25T13:00:00Z');
  await w.remind();
  await w.remind();
  assert.equal(w.sent.length, 2, 'once each, however many hours pass');
  assert.equal(w.sent.filter((m) => m.event === 'onboard_grid' || /availability/i.test(m.title)).length, 0, 'none of the wave271 grid messages');
  assert.ok(w.sent.every((m) => !JSON.stringify(m).includes(HIRE)));
  assert.deepEqual(w.rig.fetchLog.filter((e) => e.url !== NOTIFY), [], 'reminders go through notify only');
});

test('w275 remind: the same for a flow whose hire has accepted (waiting) with nothing proposed; times proposed, a booked call, a closed card or a practice flow stop it', async () => {
  const late = { manager_link_member_id: 2, manager_link_sent_at: '2026-10-17T12:00:00Z' };
  /* a waiting flow is on the propose path once onboard_v2_since is set (before the release, an accepted flow with nothing proposed counts as wave271, as onboard-link has it) */
  const waiting = await askWorld({ fl: { ...late, status: 'waiting' }, cand: { accepted_on: '2026-10-18' }, config: { onboard_v2_since: '2026-10-01T00:00:00Z' } });
  await waiting.remind();
  assert.deepEqual(waiting.sent.map((m) => m.tag).sort(), ['onboard-remind-propose-21', 'onboard-remind-propose-hr-21']);
  for (const [fl, cand] of [
    [{ proposed_call_at: '2026-10-26T14:00:00Z', proposed_one_on_one_at: '2026-10-26T16:00:00Z', proposed_at: '2026-10-20T10:00:00Z' }, {}],
    [{ status: 'running', call_at: CALL, hire_answer: 'yes', proposed_at: '2026-10-20T10:00:00Z' }, {}],
    [{}, { status: 'declined' }],
    [{}, { status: 'withdrawn' }],
    [{}, { practice: true }],
  ]) {
    const w = await askWorld({ fl: { ...late, ...fl }, cand });
    const before = w.snapshot();
    await w.remind();
    assert.deepEqual(w.sent, [], JSON.stringify([fl, cand]));
    assert.deepEqual(w.snapshot(), before);
  }
});

test('w275 remind: a reminder notify could not deliver is given back, and the next hour sends it; the HR one is claimed on its own', async () => {
  let words = { [SAM]: 'failed', [HR[0]]: 'sent', [HR[1]]: 'sent' };
  const w = await askWorld({ fl: { manager_link_member_id: 2, manager_link_sent_at: '2026-10-17T12:00:00Z' }, notifyReply: (e) => answer(words)(e) });
  const r = await w.remind();
  assert.equal(r.body.reminded_managers, 0);
  assert.equal(r.body.reminded_hr, 1);
  assert.equal(w.flow().reminded_manager_at, null);
  assert.ok(r.body.skipped.some((s) => /manager reminder/.test(s)), JSON.stringify(r.body.skipped));
  words = { [SAM]: 'sent', [HR[0]]: 'sent', [HR[1]]: 'sent' };
  const again = await w.remind();
  assert.equal(again.body.reminded_managers, 1);
  assert.equal(again.body.reminded_hr, 0, 'HR was told already');
  assert.equal(w.sent.filter((m) => Array.isArray(m.to)).length, 1);
});

test('w275 remind: a propose-path flow whose link never went (or went to a manager since replaced) gets the propose link, never the grid link', async () => {
  const w = await askWorld();
  const r = await w.remind();
  assert.equal(r.body.propose_links, 1);
  assert.equal(r.body.grid_links, 0);
  assert.equal(w.asks().length, 1);
  assert.equal(w.gmail().length, 1, 'with its email');
  assert.equal(w.flow().manager_link_member_id, 2);
  await w.remind();
  assert.equal(w.asks().length, 1, 'once');
  w.flow().manager_member_id = 1;
  await w.remind();
  assert.deepEqual(w.asks().map((m) => m.to_email), [SAM, 'ruth.owen@welfareavenue.com']);
  /* a wave271 flow (created before onboard_v2_since) keeps the grid link */
  const old = await runWorld({ fl: { created_at: '2026-09-20T12:00:00Z' }, config: { onboard_v2_since: '2026-10-01T00:00:00Z' } });
  await old.remind();
  assert.equal(old.sent.filter((m) => m.event === 'onboard_grid').length, 1);
  assert.equal(old.sent.filter((m) => m.event === 'onboard_propose').length, 0);
  /* a waiting flow created after the release is on the propose path even with nothing proposed */
  const fresh = await askWorld({ fl: { status: 'waiting' }, cand: { accepted_on: '2026-10-19' }, config: { onboard_v2_since: '2026-10-01T00:00:00Z' } });
  await fresh.remind();
  assert.equal(fresh.asks().length, 1);
  assert.equal(fresh.sent.filter((m) => m.event === 'onboard_grid' || (m.event === 'onboard_remind' && /availability/.test(m.title))).length, 0);
});

/* ---------- wave275 Task 5, fix round 1 ---------- */
test('w275 fix: after the hire said no to proposed times, remind sends neither the manager\'s "not proposed" reminder nor the HR notice', async () => {
  const w = await askWorld({ fl: { status: 'waiting', manager_link_member_id: 2, manager_link_sent_at: '2026-10-15T12:00:00Z', proposed_call_at: '2026-10-26T14:00:00Z', proposed_one_on_one_at: '2026-10-26T16:00:00Z', proposed_at: '2026-10-16T10:00:00Z', proposed_by: SAM, hire_answer: 'no' }, cand: { accepted_on: '2026-10-15' } });
  const before = w.snapshot();
  const r = await w.remind();
  assert.equal(r.status, 200);
  assert.deepEqual(w.sent, [], 'the manager heard of the no through onboard_answer and answers from the card');
  assert.deepEqual(w.snapshot(), before);
  assert.deepEqual(w.rig.fetchLog, []);
});

test('w275 fix: a propose-path flow with no active onboarding manager (none, inactive, or no roster email): HR is told once that the card needs one', async () => {
  for (const [o, words] of [
    [{ fl: { manager_member_id: null }, manager: { member_id: null, name: null, how: 'none' } }, /Alex Tremblay \(Program Coordinator\) has no onboarding manager, so nobody can be asked/],
    [{ tables: { team_members: [TEAM[0], { ...TEAM[1], active: false }, TEAM[2]] } }, /has Sam Lee as onboarding manager, who is no longer active on the roster/],
    [{ fl: { manager_member_id: 3 } }, /has No Mail as onboarding manager, who has no email on the roster/],
  ]) {
    const w = await askWorld(o);
    const r = await w.remind();
    assert.equal(w.sent.length, 1, JSON.stringify(o));
    const m = w.sent[0];
    assert.equal(m.event, 'onboard_remind');
    assert.deepEqual(m.to, HR);
    assert.equal(m.tag, 'onboard-no-manager-21');
    assert.equal(m.url, '#hrcentre/onboarding');
    assert.equal(m.title, 'Alex Tremblay needs an onboarding manager');
    assert.match(m.body, words);
    assert.match(m.body, /Choose a manager on their card in Onboarding\.$/);
    for (const s of [m.text, m.title, m.body]) assert.ok(hubWords(s), s);
    assert.equal(r.body.reminded_hr, 1);
    assert.ok(w.flow().setup_ticks.no_manager_told_at);
    w.rig.setNow('2026-10-21T12:00:00Z');
    await w.remind();
    await w.remind();
    assert.equal(w.sent.length, 1, 'once');
    assert.deepEqual(w.rig.fetchLog.filter((e) => e.url !== NOTIFY), []);
  }
  /* not reached: the mark is given back and the next hour tries again */
  let word = 'failed';
  const lost = await askWorld({ fl: { manager_member_id: null }, manager: { member_id: null, name: null, how: 'none' }, notifyReply: (e) => answer(Object.fromEntries(HR.map((h) => [h, word])))(e) });
  const a = await lost.remind();
  assert.equal(a.body.reminded_hr, 0);
  assert.equal(lost.flow().setup_ticks.no_manager_told_at, null);
  assert.ok(a.body.skipped.some((s) => /HR notice not delivered/.test(s)), JSON.stringify(a.body.skipped));
  word = 'sent';
  assert.equal((await lost.remind()).body.reminded_hr, 1);
  /* no HR list: nothing sent, nothing marked */
  const nobody = await askWorld({ fl: { manager_member_id: null }, manager: { member_id: null, name: null, how: 'none' }, config: { hr_notify_emails: '' } });
  await nobody.remind();
  assert.deepEqual(nobody.sent, []);
  assert.equal(nobody.flow().setup_ticks.no_manager_told_at, undefined);
});
