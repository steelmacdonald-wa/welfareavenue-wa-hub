// wave276 Task 2: notify v18, the meet_propose and meet_avail_ask relay kinds, proved offline on the in-memory rig (test/w271rig.mjs).
// Run: node --test test/w276notify.test.mjs. Slack and hub-push are stubs: nothing is sent anywhere, and an unregistered URL fails the call.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFn } from './w271rig.mjs';

const NOTIFY = 'https://stub.supabase.test/functions/v1/notify';
const PUSH = 'https://stub.supabase.test/functions/v1/hub-push';
const SECRET = 'trigger-secret-for-tests';
const NOW = '2026-11-02T15:00:00Z';
const MGR = 'mia.manager@welfareavenue.com';
const A = 'ana.current@welfareavenue.com';
const B = 'ben.stale@welfareavenue.com';
const D = 'dee.snoozed@welfareavenue.com';
const STAFF = 'sam.staff@welfareavenue.com';

const TEAM = [
  { id: 1, name: 'Mia Manager', email: MGR, department: 'opsmtl', active: true },
  { id: 2, name: 'Ana Current', email: A, department: 'opsmtl', active: true },
  { id: 3, name: 'Ben Stale', email: 'Ben.Stale@welfareavenue.com', department: 'opsmtl', active: null },
  { id: 4, name: 'Old Hand', email: 'old.hand@welfareavenue.com', department: 'opsmtl', active: false },
  { id: 5, name: 'No Mail', email: '', department: 'opsmtl', active: true },
  { id: 6, name: 'Tara Toronto', email: 'tara@welfareavenue.com', department: 'opsto', active: true },
  { id: 7, name: 'Sam Staff', email: STAFF, department: 'opsto', active: true },
];

async function world({ team = TEAM, avail = [], asks = [] } = {}) {
  const rig = await loadFn('notify', {
    secrets: { SLACK_BOT_TOKEN: 'xoxb-test', SLACK_WEBHOOK_URL: 'https://hooks.example/none' },
    config: { push_on: 'on' },
    tables: {
      team_members: team,
      wa_slack_ids: [MGR, A, B, D, STAFF, 'tara@welfareavenue.com', 'old.hand@welfareavenue.com'].map((e, i) => ({ email: e, slack_id: 'U' + i })),
      dept_meta: [{ department: 'opsmtl', label: 'Operations Montreal' }, { department: 'opsto', label: 'Operations Toronto' }],
      hub_team_avail: avail, hub_team_avail_ask: asks,
      wa_notify_prefs: [], hub_push_subs: [], hub_notifications_sent: [], change_log: [],
    },
  });
  rig.setNow(NOW);
  rig.managerAsks = [];
  rig.db.onRpc('wa_avail_manager_of', (args, _db, who) => {
    assert.equal(who.jwt, null, 'the manager check runs as the service key');
    rig.managerAsks.push(args);
    return args.p_email === MGR && args.p_dept === 'opsmtl';
  });
  rig.slack = () => rig.fetchLog.filter((e) => e.url === 'https://slack.com/api/chat.postMessage');
  rig.dmTo = () => rig.fetchLog.filter((e) => e.url === 'https://slack.com/api/conversations.open').map((e) => e.body.users).sort();
  rig.push = () => rig.fetchLog.filter((e) => e.url === PUSH);
  rig.fetchOn('https://slack.com/api/conversations.open', (e) => ({ json: { ok: true, channel: { id: 'D-' + e.body.users } } }));
  rig.fetchOn('https://slack.com/api/chat.postMessage', { json: { ok: true } });
  rig.fetchOn(PUSH, { json: { outcome: 'sent' } });
  rig.fetchOn('https://slack.com/api/users.lookupByEmail', { json: { ok: false, error: 'users_not_found' } });
  rig.fetchOn('https://slack.com/api/users.list', { json: { ok: true, members: [] } });
  rig.asUser = (email) => { rig.db.setCaller(email ? { email } : null); return { Authorization: 'Bearer user-jwt' }; };
  rig.send = async (body, headers) => {
    const r = await rig.call(new Request(NOTIFY, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }));
    return { status: r.status, body: await r.json() };
  };
  return rig;
}
const slackIdOf = (email) => 'U' + [MGR, A, B, D, STAFF, 'tara@welfareavenue.com', 'old.hand@welfareavenue.com'].indexOf(email);

test('(a) a manager proposes a time: one DM to each other active member of the team with an email, never the caller, recipients never from the body', async () => {
  const n = await world();
  const r = await n.send({ event: 'meet_propose', dept: 'opsmtl', slot_label: 'Tuesday 5:00 p.m.', who_can: 4, who_cant: 1, to: ['tara@welfareavenue.com'], to_email: STAFF }, n.asUser(MGR));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.event, 'meet_propose');
  assert.equal(r.body.sent, 2);
  assert.deepEqual(Object.keys(r.body.outcome).sort(), [A, B]);
  assert.equal(r.body.hub, 'sent');
  assert.deepEqual(n.dmTo(), [slackIdOf(A), slackIdOf(B)].sort(), 'Ana and Ben only: not Mia (the caller), the inactive, the one with no email, another team, or the body\'s to');
  for (const m of n.slack()) {
    assert.match(m.body.text, /Tuesday 5:00 p\.m\./);
    assert.match(m.body.text, /Mia Manager is proposing Operations Montreal meetings move to Tuesday 5:00 p\.m\. 4 can make it\. Reply on Slack if that does not work\./);
    assert.doesNotMatch(m.body.text, /—/, 'no em dash');
  }
  assert.deepEqual(n.managerAsks, [{ p_email: MGR, p_dept: 'opsmtl' }]);
  const [push] = n.push();
  assert.equal(push.body.kind, 'meet_propose');
  assert.deepEqual(push.body.to.sort(), [A, B]);
  assert.equal(push.body.url, '/#team/opsmtl/agenda');
  assert.equal(push.body.title, 'A leader proposed a new meeting time for my team');
  const logged = n.db.rows('hub_notifications_sent');
  assert.equal(logged.length, 2);
  assert.ok(logged.every((x) => x.kind === 'meet_propose' && x.url === '#team/opsmtl/agenda' && x.outcome === 'sent'));
  assert.deepEqual(n.unregistered(), []);
});

test('(b) a signed-in person who does not manage the team gets 403 and nobody is messaged; no dept is 400', async () => {
  const n = await world();
  const r = await n.send({ event: 'meet_propose', dept: 'opsmtl', slot_label: 'Tuesday 5:00 p.m.', who_can: 4, who_cant: 1 }, n.asUser(STAFF));
  assert.equal(r.status, 403);
  assert.deepEqual(r.body, { error: 'forbidden' });
  const ask = await n.send({ event: 'meet_avail_ask', dept: 'opsmtl' }, n.asUser(STAFF));
  assert.equal(ask.status, 403);
  const none = await n.send({ event: 'meet_avail_ask' }, n.asUser(MGR));
  assert.equal(none.status, 400);
  assert.deepEqual(none.body, { error: 'dept required' });
  const out = await n.send({ event: 'meet_avail_ask', dept: 'opsmtl' }, n.asUser(null));
  assert.equal(out.status, 401, 'signed out');
  assert.equal(n.slack().length, 0);
  assert.equal(n.push().length, 0);
  assert.equal(n.db.rows('hub_notifications_sent').length, 0);
});

test('(c) meet_avail_ask messages only the members without a grid saved since the latest ask', async () => {
  const n = await world({
    team: [...TEAM, { id: 8, name: 'Dee Snoozed', email: D, department: 'opsmtl', active: true }],
    asks: [
      { id: 1, department: 'opsmtl', ask_date: '2026-10-01' },
      { id: 2, department: 'opsmtl', ask_date: '2027-01-04' },   // later than today: does not count yet
      { id: 3, department: 'opsto', ask_date: '2026-10-30' },    // another team's ask
    ],
    avail: [
      { id: 1, email: A, department: 'opsmtl', effective_from: '2026-10-05', updated_at: '2026-10-05T14:00:00Z' },              // current
      { id: 2, email: 'ben.stale@welfareavenue.com', department: 'opsmtl', effective_from: '2026-09-01', updated_at: '2026-09-01T14:00:00Z' },   // before the ask
      { id: 3, email: 'ben.stale@welfareavenue.com', department: 'opsto', effective_from: '2026-10-20', updated_at: '2026-10-20T14:00:00Z' },    // another team's grid
      { id: 4, email: D, department: 'opsmtl', effective_from: '2026-10-20', updated_at: null, snoozed_until: '2026-11-09T00:00:00Z' },        // a snooze stub, never saved
    ],
  });
  const r = await n.send({ event: 'meet_avail_ask', dept: 'opsmtl', to: [A] }, n.asUser(MGR));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.sent, 2);
  assert.deepEqual(Object.keys(r.body.outcome).sort(), [B, D]);
  assert.deepEqual(n.dmTo(), [slackIdOf(B), slackIdOf(D)].sort(), 'Ana is current and Mia is the caller');
  for (const m of n.slack()) assert.match(m.body.text, /Operations Montreal is planning meeting times\. Add your typical week in the Hub\./);
  const [push] = n.push();
  assert.equal(push.body.kind, 'meet_avail_ask');
  assert.equal(push.body.url, '/#mypage');
  assert.equal(push.body.title, 'My team needs my availability');
  assert.deepEqual(n.unregistered(), []);
});

test('(c2) meet_avail_ask with everyone current sends nothing and says so', async () => {
  const n = await world({
    team: TEAM.filter((m) => m.id !== 3),
    asks: [{ id: 1, department: 'opsmtl', ask_date: '2026-10-01' }],
    avail: [{ id: 1, email: A, department: 'opsmtl', effective_from: '2026-10-05', updated_at: '2026-10-05T14:00:00Z' }],
  });
  const r = await n.send({ event: 'meet_avail_ask', dept: 'opsmtl' }, n.asUser(MGR));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.sent, 0);
  assert.equal(n.slack().length, 0);
  assert.equal(n.push().length, 0);
});

test('(d) the x-wa-secret path still sends onboard_remind, and may send the new kinds to an explicit to', async () => {
  const n = await world();
  const secret = { 'x-wa-secret': SECRET, Authorization: 'Bearer anon-key-for-tests' };
  const r = await n.send({ event: 'onboard_remind', to_email: STAFF, text: 'An availability grid is still empty.', url: '#hrcentre/onboarding', tag: 'onboard-remind-21' }, secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.outcome, { [STAFF]: 'sent' });
  assert.equal(n.slack().length, 1);
  assert.equal(n.push()[0].body.kind, 'onboard_remind');
  const p = await n.send({ event: 'meet_propose', dept: 'opsmtl', slot_label: 'Monday noon', who_can: 3, by_name: 'Mia Manager', to: ['tara@welfareavenue.com'] }, secret);
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.deepEqual(Object.keys(p.body.outcome), ['tara@welfareavenue.com']);
  assert.equal(p.body.sent, 1);
  assert.deepEqual(n.managerAsks, [], 'the trigger secret needs no manager check');
});
