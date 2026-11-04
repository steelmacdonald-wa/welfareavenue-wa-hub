// wave279 Task 6: notify v21, the three relayed onboarding kinds from the daily onboarding job (trigger secret only), proved offline on the in-memory rig (test/w271rig.mjs).
// Run: node --test test/w279notify.test.mjs. Slack and hub-push are stubs: nothing is sent anywhere, and an unregistered URL fails the call.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFn } from './w271rig.mjs';

const NOTIFY = 'https://stub.supabase.test/functions/v1/notify';
const PUSH = 'https://stub.supabase.test/functions/v1/hub-push';
const SECRET = 'trigger-secret-for-tests';
const P = 'pat.hire@welfareavenue.com';

async function world(prefs = []) {
  const rig = await loadFn('notify', {
    secrets: { SLACK_BOT_TOKEN: 'xoxb-test', SLACK_WEBHOOK_URL: 'https://hooks.example/none' },
    config: { push_on: 'on' },
    tables: {
      team_members: [], dept_meta: [],
      wa_slack_ids: [{ email: P, slack_id: 'U1' }],
      wa_notify_prefs: prefs, hub_push_subs: [], hub_notifications_sent: [], change_log: [],
    },
  });
  rig.setNow('2026-11-04T15:00:00Z');
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
const KINDS = [
  ['onboard_behind', '#mypage', "Onboarding: you're behind"],
  ['onboard_behind_lead', '#hrcentre/onboarding', 'Onboarding: a hire is behind'],
  ['onboard_role_pick', '#hrcentre/onboarding', 'Onboarding: pick role trainings'],
];
const payload = (event, url, title) => ({ event, to_email: P, url, tag: event + '-1', title, body: 'Plain body for ' + event, text: ':bell: Text for ' + event });

for (const [event, url, title] of KINDS) {
  test(event + ': a Slack DM to to_email and a Hub notification with its title and url', async () => {
    const n = await world();
    const r = await n.send(payload(event, url, title), secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.event, event);
    assert.deepEqual(Object.keys(r.body.outcome), [P]);
    assert.equal(r.body.hub, 'sent');
    assert.equal(n.slack().length, 1);
    assert.match(JSON.stringify(n.slack()[0].body), new RegExp('Text for ' + event));
    const [push] = n.push();
    assert.equal(push.body.kind, event);
    assert.deepEqual(push.body.to, [P]);
    assert.equal(push.body.title, title);
    assert.equal(push.body.url, '/' + url);
    assert.equal(push.body.tag, event + '-1');
    assert.deepEqual(n.unregistered(), []);
  });

  test(event + ': the fallback title and url apply when the call has none', async () => {
    const n = await world();
    const r = await n.send({ ...payload(event, url, title), title: undefined, url: undefined }, secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(n.push()[0].body.title, title);
    assert.equal(n.push()[0].body.url, '/' + url);
  });

  test(event + ': a person who switched Slack off for the kind gets no DM; without the secret it is 401', async () => {
    const n = await world([{ email: P, disabled: [], prefs: { kinds: { [event]: { slack: false } } } }]);
    const r = await n.send(payload(event, url, title), secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(n.slack().length, 0);
    assert.notEqual(r.body.outcome[P], 'sent');
    const bad = await n.send(payload(event, url, title), {});
    assert.equal(bad.status, 401);
  });
}
