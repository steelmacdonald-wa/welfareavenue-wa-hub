// wave277 Task 5: notify v19, the connection_expiring relay kind from social-connect (trigger secret only), proved offline on the in-memory rig (test/w271rig.mjs).
// Run: node --test test/w277notify.test.mjs. Slack and hub-push are stubs: nothing is sent anywhere, and an unregistered URL fails the call.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFn } from './w271rig.mjs';

const NOTIFY = 'https://stub.supabase.test/functions/v1/notify';
const PUSH = 'https://stub.supabase.test/functions/v1/hub-push';
const SECRET = 'trigger-secret-for-tests';
const A = 'ana.publisher@welfareavenue.com';
const B = 'ben.publisher@welfareavenue.com';
const OUTSIDER = 'someone@gmail.com';

async function world() {
  const rig = await loadFn('notify', {
    secrets: { SLACK_BOT_TOKEN: 'xoxb-test', SLACK_WEBHOOK_URL: 'https://hooks.example/none' },
    config: { push_on: 'on' },
    tables: {
      team_members: [], dept_meta: [],
      wa_slack_ids: [A, B].map((e, i) => ({ email: e, slack_id: 'U' + i })),
      wa_notify_prefs: [], hub_push_subs: [], hub_notifications_sent: [], change_log: [],
    },
  });
  rig.setNow('2026-11-02T15:00:00Z');
  rig.slack = () => rig.fetchLog.filter((e) => e.url === 'https://slack.com/api/chat.postMessage');
  rig.push = () => rig.fetchLog.filter((e) => e.url === PUSH);
  rig.fetchOn('https://slack.com/api/conversations.open', (e) => ({ json: { ok: true, channel: { id: 'D-' + e.body.users } } }));
  rig.fetchOn('https://slack.com/api/chat.postMessage', { json: { ok: true } });
  rig.fetchOn(PUSH, { json: { outcome: 'sent' } });
  rig.fetchOn('https://slack.com/api/users.lookupByEmail', { json: { ok: false, error: 'users_not_found' } });
  rig.fetchOn('https://slack.com/api/users.list', { json: { ok: true, members: [] } });
  rig.send = async (body, headers) => {
    const r = await rig.call(new Request(NOTIFY, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }));
    return { status: r.status, body: await r.json() };
  };
  return rig;
}
const secret = { 'x-wa-secret': SECRET, Authorization: 'Bearer anon-key-for-tests' };
const call = { event: 'connection_expiring', to: [A, B, OUTSIDER], title: 'LinkedIn connection expires in 6 days', text: 'Reconnect it on the Connections page so posts keep going out.', url: '/#studio/connections', tag: 'studio-conn-linkedin' };

test('connection_expiring: a Slack DM and a Hub notification to each welfareavenue.com publisher, never an outside address', async () => {
  const n = await world();
  const r = await n.send(call, secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.event, 'connection_expiring');
  assert.deepEqual(Object.keys(r.body.outcome).sort(), [A, B]);
  assert.equal(r.body.hub, 'sent');
  assert.equal(n.slack().length, 2);
  const [push] = n.push();
  assert.equal(push.body.kind, 'connection_expiring');
  assert.deepEqual(push.body.to.sort(), [A, B]);
  assert.equal(push.body.title, 'LinkedIn connection expires in 6 days');
  assert.equal(push.body.url, '/#studio/connections');
  assert.equal(push.body.tag, 'studio-conn-linkedin');
  assert.ok(n.db.rows('hub_notifications_sent').every((x) => x.kind === 'connection_expiring'));
  assert.deepEqual(n.unregistered(), []);
});

test('connection_expiring: the default title applies, and a call with no staff recipient or no text is refused', async () => {
  const n = await world();
  const t = await n.send({ ...call, title: undefined }, secret);
  assert.equal(t.status, 200, JSON.stringify(t.body));
  assert.equal(n.push()[0].body.title, 'A social connection is about to expire');
  const none = await n.send({ ...call, to: [OUTSIDER] }, secret);
  assert.deepEqual(none.body, { error: 'to and text required' });
  const notext = await n.send({ ...call, text: '' }, secret);
  assert.deepEqual(notext.body, { error: 'to and text required' });
});

test('connection_expiring: without the trigger secret it is 401', async () => {
  const n = await world();
  const r = await n.send(call, {});
  assert.equal(r.status, 401);
  assert.equal(n.slack().length, 0);
});
