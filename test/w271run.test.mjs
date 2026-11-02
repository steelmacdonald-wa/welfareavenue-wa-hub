// wave271 Task 5: fn/onboard-run, proved offline on the in-memory rig (test/w271rig.mjs). Run: node --test test/w271run.test.mjs
// No live call of any kind: the database is a stub, and Google and notify are stubbed routes. Any other URL fails the call.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadFn } from './w271rig.mjs';

const URL_ = 'https://stub.supabase.test/functions/v1/onboard-run';
const NOTIFY = 'https://stub.supabase.test/functions/v1/notify';
const NOW = '2026-10-20T12:00:00Z';
const CALL = '2026-11-02T03:30:00.000Z';      // 22:30 on 01/11/26 in Toronto: the UTC date is the wrong one
const ONE = '2026-11-03T15:00:00.000Z';
const KEYS = ['roster', 'google', 'plan', 'invites', 'manager', 'hub', 'slack', 'welcome'];
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const SA = JSON.stringify({ client_email: 'hub@stub.iam', private_key: privateKey, token_uri: 'https://oauth2.googleapis.com/token' });

const candidate = (over = {}) => ({
  id: 11, name: 'Alex Tremblay', role: 'Program Coordinator', status: 'offer', email: 'alex@example.com', summary: '', notes: '', position_id: 5,
  accepted_on: '2026-10-15', offer_sent_at: '2026-10-10T12:00:00Z', member_id: null, start_date: null, practice: false, close_reason: null, ...over,
});
const flow = (over = {}) => ({ id: 21, candidate_id: 11, practice: false, status: 'waiting', manager_member_id: null, wa_email: null, call_at: null, one_on_one_at: null, onboarding_id: null, call_event_id: null, one_on_one_event_id: null, ...over });
const TEAM = [{ id: 1, name: 'Ruth Owen', email: 'ruth.owen@welfareavenue.com', active: true }, { id: 2, name: 'Sam Lee', email: 'sam.lee@welfareavenue.com', active: true }];
const SETUP = ['hrb1', 'hrb2', 'hrb3', 'hrb4', 'hrb5', 'hrb6', 'hrc1'];

async function setup({ cand = {}, fl = {}, config = {}, tables = {}, hr = true, admin = false, notifyReply, live = true } = {}) {
  const rig = await loadFn('onboard-run', {
    secrets: { GOOGLE_SA_KEY: SA },
    config: { onboard_auto_google: 'off', onboard_auto_slack: 'off', onboard_call_min: '60', onboard_one_on_one_min: '30', mail_mode: live ? 'live' : 'test', mail_test_recipients: 'tester@welfareavenue.com', ...config },
    tables: {
      hub_candidates: [candidate(cand)], hub_onboard_flows: [flow({ practice: !!cand.practice, ...fl })], hub_onboard_grids: [], hub_onboard_steps: [],
      hub_positions: [{ id: 5, title: 'Program Coordinator', dept: 'progdev', jd_url: 'https://docs.example.com/jd' }],
      team_members: TEAM, onboardings: [], hr_setup_steps: [], change_log: [], hub_events: [], ...tables,
    },
    serial: ['hr_setup_steps'],
  });
  rig.setNow(NOW);
  rig.db.setCaller({ email: 'hr.person@welfareavenue.com' });
  rig.db.onRpc('wa_is_hr', (_a, _d, w) => { assert.ok(w.jwt, 'the HR check runs as the caller'); return hr; });
  rig.db.onRpc('is_wa_admin', (_a, _d, w) => { assert.ok(w.jwt, 'the admin check runs as the caller'); return admin; });
  const assigned = [];
  rig.db.onRpc('onboarding_assign', (a, db, w) => {   // live, is_wa_staff is false for the service key (no jwt email), so this must run as the caller
    if (!w.jwt) throw new Error('Only staff can start an onboarding plan');
    assigned.push(a);
    const on = db.insert('onboardings', { member_id: a.p_member_id, person_name: 'x', assigned_by: a.p_by, started_at: a.p_start, completed_at: null });
    for (const t of SETUP) db.insert('hr_setup_steps', { onboarding_id: on.id, template_id: t, done: false });
    return on.id;
  });
  const moved = [];
  rig.db.onRpc('wa271_move_start', (a) => { moved.push(a); return null; });
  rig.db.onRpc('wa271_default_manager', () => ({ member_id: 2, name: 'Sam Lee', how: 'reports_to' }));

  const s = {
    rig, db: rig.db, assigned, moved, taken: new Set(), calReply: null,
    cal: () => rig.fetchLog.filter((e) => e.url.includes('/calendar/v3/')),
    calWrites: () => rig.fetchLog.filter((e) => e.url.includes('/calendar/v3/') && e.method !== 'GET'),
    notifies: () => rig.fetchLog.filter((e) => e.url === NOTIFY),
    gmail: () => rig.fetchLog.filter((e) => e.url.includes('gmail.googleapis.com')),
    rows: (t) => rig.db.rows(t),
    flow: () => rig.db.rows('hub_onboard_flows')[0],
    cand: () => rig.db.rows('hub_candidates')[0],
    snapshot: () => structuredClone(rig.db.tables),
    step: (k) => rig.db.rows('hub_onboard_steps').find((r) => r.step === k),
    statuses: () => Object.fromEntries(KEYS.map((k) => [k, s.step(k)?.status])),
    entry: (k) => rig.mod.STEPS.find((e) => e.key === k),
  };
  rig.fetchOn('https://oauth2.googleapis.com/token', (e) => {
    const claims = JSON.parse(Buffer.from(e.body.get('assertion').split('.')[1], 'base64url').toString());
    return { json: { access_token: 'tok:' + claims.scope + ':' + claims.sub, expires_in: 3600 } };
  });
  rig.fetchOn(NOTIFY, (e) => (notifyReply ? notifyReply(e) : { json: { outcome: Object.fromEntries([].concat(e.body.to || e.body.to_email).map((x) => [x, 'sent'])), hub: 'off' } }));
  rig.fetchOn((u) => u.includes('/calendar/v3/'), (e) => {
    if (s.calReply) { const out = s.calReply(e); if (out) return out; }
    return { json: { id: e.body?.id || e.url.split('/events/')[1]?.split('?')[0], hangoutLink: 'https://meet.example/x' } };
  });
  rig.fetchOn((u) => u.includes('admin.googleapis.com/admin/directory/v1/users/'), (e) => {
    const addr = decodeURIComponent(e.url.split('/users/')[1].split('?')[0]);
    return s.taken.has(addr) ? { json: { primaryEmail: addr } } : { status: 404, json: { error: { message: 'Resource Not Found: userKey' } } };
  });
  rig.fetchOn('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { json: { id: 'mail1' } });
  s.post = async (body, headers = { Authorization: 'Bearer user-jwt' }) => {
    const r = await rig.call(new Request(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }));
    return { status: r.status, body: await r.json() };
  };
  s.start = (over = {}) => s.post({ action: 'start', flow_id: 21, wa_email: 'alex.tremblay@welfareavenue.com', manager_member_id: 2, call_at: CALL, one_on_one_at: ONE, skip: [], ...over });
  return s;
}
const mail = (entry) => {   // the decoded MIME of a Gmail send
  const text = Buffer.from(entry.body.raw, 'base64url').toString();
  const parts = text.split('\r\n');
  const dec = (h) => { const m = /=\?UTF-8\?B\?(.*)\?=/.exec(h); return m ? Buffer.from(m[1], 'base64').toString() : h; };
  const bodies = [...text.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=]+)/g)].map((m) => Buffer.from(m[1], 'base64').toString());
  return { to: parts.find((l) => l.startsWith('To: ')).slice(4), from: parts.find((l) => l.startsWith('From: ')), subject: dec(parts.find((l) => l.startsWith('Subject: ')).slice(9)), bodies };
};

/* ---------- names ---------- */
test('suggestAddress turns a name into first.last, and a single word into nothing', async () => {
  const s = await setup();
  const f = s.rig.mod.suggestAddress;
  assert.equal(f("José O'Neil-Tremblay"), 'jose.oneil-tremblay');
  assert.equal(f('Madonna'), null);
  assert.equal(f('Marie-Ève  Côté'), 'marie-eve.cote');
  assert.equal(f('  Anne   Marie   Roy '), 'anne.roy');
  assert.equal(f('Zoë Œuvrard'), 'zoe.oeuvrard');
  assert.equal(f('D’Arcy O’Brien'), 'darcy.obrien');
  assert.equal(f(''), null);
  assert.equal(f(null), null);
  assert.equal(f('李 小龍'), null);
});

test('preview: a single-word name needs an address from HR, and nothing is written', async () => {
  const s = await setup({ cand: { name: 'Madonna' } });
  const before = s.snapshot();
  const p = await s.post({ action: 'preview', flow_id: 21 });
  assert.equal(p.status, 200);
  assert.equal(p.body.address, null);
  assert.equal(p.body.needs_address, true);
  assert.equal(p.body.address_taken, false);
  assert.deepEqual(s.snapshot(), before);
});

test('preview gives the page all it needs', async () => {
  const s = await setup({
    cand: { name: "José O'Neil-Tremblay" },
    tables: {
      hub_onboard_grids: [{ flow_id: 21, who: 'hire', slots: ['2026-10-25T14:00:00Z'] }, { flow_id: 21, who: 'manager', slots: ['2026-10-26T14:00:00Z'] }],
      hub_events: [
        { id: 'e1', summary: 'Team sync', start_at: '2026-10-26T15:00:00Z', end_at: '2026-10-26T16:00:00Z', status: 'confirmed', attendee_emails: ['sam.lee@welfareavenue.com'] },
        { id: 'e2', summary: 'Other people', start_at: '2026-10-26T15:00:00Z', end_at: '2026-10-26T16:00:00Z', status: 'confirmed', attendee_emails: ['someone@welfareavenue.com'] },
        { id: 'e3', summary: 'Gone', start_at: '2026-10-26T15:00:00Z', end_at: '2026-10-26T16:00:00Z', status: 'cancelled', attendee_emails: ['sam.lee@welfareavenue.com'] },
      ],
      hub_positions: [{ id: 5, title: 'Program Coordinator', dept: 'progdev', jd_url: null }],
    },
  });
  s.db.rows('hub_candidates').push(candidate({ id: 12, status: 'interview', accepted_on: null, role: 'Other role' }));
  const { status, body: p } = await s.post({ action: 'preview', flow_id: 21 });
  assert.equal(status, 200);
  assert.equal(p.address, 'jose.oneil-tremblay@welfareavenue.com');
  assert.equal(p.needs_address, false);
  assert.equal(p.address_taken, false);
  assert.deepEqual(p.manager, { member_id: 2, name: 'Sam Lee', how: 'reports_to' });
  assert.deepEqual(p.grids, { hire: ['2026-10-25T14:00:00Z'], manager: ['2026-10-26T14:00:00Z'] });
  assert.deepEqual(p.hub_events.map((e) => e.id), ['e1']);
  assert.deepEqual(p.steps.map((x) => x.key), KEYS);
  assert.equal(p.steps.find((x) => x.key === 'google').mode, 'hr_task');
  assert.equal(p.steps.find((x) => x.key === 'plan').mode, 'run');
  assert.ok(p.welcome.subject && p.welcome.text);
  assert.ok(p.warnings.some((w) => /job description/i.test(w)), 'no JD link');
  assert.ok(p.warnings.some((w) => /other application/i.test(w)), 'two applications');
  assert.deepEqual(s.rig.unregistered(), []);
});

test('preview says the address is taken, by Workspace or the roster, and warns when Google cannot be asked', async () => {
  const s = await setup();
  s.taken.add('alex.tremblay@welfareavenue.com');
  assert.equal((await s.post({ action: 'preview', flow_id: 21 })).body.address_taken, true);
  s.taken.clear();
  s.db.insert('team_members', { id: 9, name: 'Other Alex', email: 'Alex.Tremblay@welfareavenue.com', active: true });
  assert.equal((await s.post({ action: 'preview', flow_id: 21 })).body.address_taken, true);
});

test('preview still answers when the Directory check fails, with a warning', async () => {
  const s = await setup();
  s.rig.db.onRpc('get_secret', ({ secret_name }) => (secret_name === 'GOOGLE_SA_KEY' ? null : 'x'));
  const { status, body } = await s.post({ action: 'preview', flow_id: 21 });
  assert.equal(status, 200);
  assert.equal(body.address_taken, false);
  assert.ok(body.warnings.some((w) => /could not check/i.test(w)));
});

/* ---------- auth ---------- */
test('only HR or an admin gets in', async () => {
  const no = await setup({ hr: false, admin: false });
  const before = no.snapshot();
  for (const action of ['preview', 'start', 'retry', 'google_manual', 'send_grid_link', 'book_one_on_one', 'change_time', 'change_manager', 'backed_out']) {
    const r = await no.post({ action, flow_id: 21, candidate_id: 11, step: 'plan', wa_email: 'a.b@welfareavenue.com', manager_member_id: 2, call_at: CALL });
    assert.equal(r.status, 403, action);
  }
  assert.deepEqual(no.snapshot(), before);
  assert.equal(no.rig.fetchLog.length, 0);

  const out = await setup();
  out.db.setCaller(null);
  assert.equal((await out.post({ action: 'preview', flow_id: 21 }, {})).status, 401);

  const secretOnly = await setup({ hr: false });
  assert.equal((await secretOnly.post({ action: 'start', flow_id: 21 }, { 'x-wa-secret': 'trigger-secret-for-tests' })).status, 401, 'the secret does not open a person action');

  const admin = await setup({ hr: false, admin: true });
  assert.equal((await admin.post({ action: 'preview', flow_id: 21 })).status, 200);
  assert.equal((await admin.post({ action: 'nonsense' })).status, 400);
});

/* ---------- double press and refusals ---------- */
test('two Starts at once run the steps once', async () => {
  const s = await setup();
  const far = '2031-03-03T15:00:00.000Z';
  const [a, b] = await Promise.all([s.start({ call_at: far, one_on_one_at: null }), s.start({ call_at: far, one_on_one_at: null })]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal(s.rows('team_members').length, TEAM.length + 1);
  assert.equal(s.assigned.length, 1);
  assert.equal(s.notifies().length, 1);
  assert.equal(s.calWrites().length, 1);
  const third = await s.start({ call_at: far });
  assert.equal(third.status, 409);
  assert.equal(s.assigned.length, 1);
});

test('Start works from waiting and from ready, and not from anything else', async () => {
  const ready = await setup({ fl: { status: 'ready' } });
  assert.equal((await ready.start()).status, 200);
  const gone = await setup({ fl: { status: 'backed_out' } });
  assert.equal((await gone.start()).status, 409);
  assert.equal(gone.rows('hub_onboard_steps').length, 0);
});

const refusals = [
  ['a call in the past', { call_at: '2026-10-19T12:00:00Z' }],
  ['no call', { call_at: null }],
  ['a call that is not a time', { call_at: 'tomorrow' }],
  ['a 1-on-1 in the past', { one_on_one_at: '2026-10-19T12:00:00Z' }],
  ['no manager', { manager_member_id: null }],
  ['a manager not on the roster', { manager_member_id: 999 }],
  ['no address with step google on', { wa_email: '' }],
  ['an address outside the domain', { wa_email: 'alex@gmail.com' }],
  ['an address with odd characters', { wa_email: 'al ex@welfareavenue.com' }],
  ['skipping the roster', { skip: ['roster'] }],
  ['skipping a step nobody knows', { skip: ['lunch'] }],
];
for (const [name, over] of refusals) {
  test('Start refuses ' + name + ', with nothing written', async () => {
    const s = await setup();
    const before = s.snapshot();
    const r = await s.start(over);
    assert.ok(r.status >= 400 && r.status < 500, 'status ' + r.status);
    assert.ok(typeof r.body.message === 'string' && r.body.message.endsWith('.'), 'a plain sentence for HR');
    assert.deepEqual(s.snapshot(), before);
    assert.equal(s.calWrites().length + s.notifies().length + s.gmail().length, 0);
  });
}

test('Start refuses a taken address while step google is on, and accepts it once google is skipped', async () => {
  const s = await setup();
  s.taken.add('alex.tremblay@welfareavenue.com');
  const before = s.snapshot();
  const r = await s.start();
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'address_taken');
  assert.deepEqual(s.snapshot(), before);
  const ok = await s.start({ skip: ['google'] });
  assert.equal(ok.status, 200);
  assert.equal(s.step('google').status, 'skipped');
});

/* ---------- dependencies ---------- */
test('roster failing leaves every other step waiting; a retry runs them', async () => {
  const s = await setup();
  s.db.failOn('team_members', 'insert', 'the database said no');
  const r = await s.start();
  assert.equal(r.status, 200);
  assert.deepEqual(s.statuses(), { roster: 'failed', google: 'waiting', plan: 'waiting', invites: 'waiting', manager: 'waiting', hub: 'waiting', slack: 'waiting', welcome: 'waiting' });
  assert.match(s.step('roster').detail, /the database said no/);
  assert.match(s.step('plan').detail, /step 1/i);
  assert.match(s.step('hub').detail, /step 2/i);
  assert.equal(s.flow().status, 'running');
  assert.equal(s.calWrites().length + s.notifies().length, 0);
  assert.equal(s.assigned.length, 0);
  const again = await s.post({ action: 'retry', flow_id: 21, step: 'roster' });
  assert.equal(again.status, 200);
  assert.deepEqual(s.statuses(), { roster: 'done', google: 'hr_task', plan: 'done', invites: 'done', manager: 'done', hub: 'hr_task', slack: 'hr_task', welcome: 'hr_task' });
  assert.deepEqual(again.body.steps.map((x) => x.step), KEYS);
});

test('google failing holds hub and welcome while the rest run; its retry brings them through and patches the invites', async () => {
  const s = await setup({ config: { onboard_auto_google: 'on' } });
  let fail = true;
  const ran = [];
  s.entry('google').run = async () => { if (fail) throw new Error('Google said: no licence is free.'); return 'Created it.'; };
  s.entry('hub').run = async () => { ran.push('hub'); return 'Invited.'; };
  s.entry('welcome').run = async () => { ran.push('welcome'); return 'Sent.'; };
  await s.start();
  assert.deepEqual(s.statuses(), { roster: 'done', google: 'failed', plan: 'done', invites: 'done', manager: 'done', hub: 'waiting', slack: 'hr_task', welcome: 'waiting' });
  assert.equal(s.step('google').detail, 'Google said: no licence is free.');
  assert.match(s.step('welcome').detail, /step 2/i);
  const inserts = s.calWrites().filter((e) => e.method === 'POST');
  assert.equal(inserts.length, 2);
  for (const e of inserts) assert.ok(!e.body.attendees.some((a) => a.email.endsWith('alex.tremblay@welfareavenue.com')), 'personal only until the account exists');
  assert.ok(inserts[0].body.attendees.some((a) => a.email === 'alex@example.com'));
  assert.equal(s.flow().status, 'running');

  fail = false;
  const before = s.calWrites().length;
  const r = await s.post({ action: 'retry', flow_id: 21, step: 'google' });
  assert.equal(r.status, 200);
  assert.deepEqual(ran, ['hub', 'welcome']);
  assert.deepEqual([s.step('google').status, s.step('hub').status, s.step('welcome').status], ['done', 'done', 'done']);
  const patches = s.calWrites().slice(before);
  assert.equal(patches.length, 2);
  for (const e of patches) {
    assert.equal(e.method, 'PATCH');
    assert.ok(e.body.attendees.some((a) => a.email === 'alex.tremblay@welfareavenue.com'));
    assert.ok(e.body.attendees.some((a) => a.email === 'alex@example.com'));
    assert.match(e.url, /sendUpdates=all/);
  }
});

test('nextSteps follows the dependency table', async () => {
  const s = await setup();
  const next = (o) => s.rig.mod.nextSteps(KEYS.map((k) => ({ step: k, status: o[k] || 'pending' })));
  assert.deepEqual(next({}), ['roster']);
  assert.deepEqual(s.rig.mod.nextSteps([]), ['roster']);
  assert.deepEqual(next({ roster: 'failed', google: 'waiting' }), []);
  assert.deepEqual(next({ roster: 'done' }), ['google', 'plan', 'invites', 'manager', 'slack']);
  assert.deepEqual(next({ roster: 'done', google: 'done' }), ['plan', 'invites', 'manager', 'hub', 'slack', 'welcome']);
  assert.deepEqual(next({ roster: 'done', google: 'skipped', plan: 'done', invites: 'done', manager: 'done', slack: 'skipped', hub: 'waiting', welcome: 'done' }), ['hub']);
  assert.deepEqual(next({ roster: 'done', google: 'failed', plan: 'done', invites: 'done', manager: 'done', slack: 'done', hub: 'waiting', welcome: 'waiting' }), []);
  assert.deepEqual(next({ roster: 'done', google: 'hr_task', plan: 'done', invites: 'done', manager: 'done', slack: 'hr_task', hub: 'waiting', welcome: 'waiting' }), []);
});

/* ---------- retries ---------- */
test('retry reruns only that step, and a done step is refused', async () => {
  const s = await setup();
  s.rig.db.onRpc('onboarding_assign', () => { throw new Error('plan table locked'); });
  await s.start();
  assert.equal(s.step('plan').status, 'failed');
  assert.match(s.step('plan').detail, /plan table locked/);
  const calls = { cal: s.calWrites().length, notify: s.notifies().length, team: s.rows('team_members').length };
  const seen = [];
  s.rig.db.onRpc('onboarding_assign', (a, db, w) => {
    assert.ok(w.jwt);
    seen.push(a);
    return db.insert('onboardings', { member_id: a.p_member_id, started_at: a.p_start, completed_at: null }).id;
  });
  const r = await s.post({ action: 'retry', flow_id: 21, step: 'plan' });
  assert.equal(r.status, 200);
  assert.equal(seen.length, 1);
  assert.equal(s.step('plan').status, 'done');
  assert.deepEqual({ cal: s.calWrites().length, notify: s.notifies().length, team: s.rows('team_members').length }, calls);

  for (const step of ['plan', 'roster', 'invites']) {
    const d = await s.post({ action: 'retry', flow_id: 21, step });
    assert.equal(d.status, 409, step);
    assert.equal(d.body.error, 'already_done');
  }
  assert.equal(seen.length, 1);
  assert.equal((await s.post({ action: 'retry', flow_id: 21, step: 'lunch' })).status, 400);
});

test('retry refuses a step still waiting, and a flow not started', async () => {
  const s = await setup();
  assert.equal((await s.post({ action: 'retry', flow_id: 21, step: 'plan' })).status, 409);
  s.db.failOn('team_members', 'insert');
  await s.start();
  const r = await s.post({ action: 'retry', flow_id: 21, step: 'plan' });
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'still_waiting');
});

test('two retries at once run the step once', async () => {
  const s = await setup();
  s.rig.db.onRpc('onboarding_assign', () => { throw new Error('no'); });
  await s.start();
  let n = 0;
  s.rig.db.onRpc('onboarding_assign', (a, db) => { n++; return db.insert('onboardings', { member_id: a.p_member_id, completed_at: null }).id; });
  const out = await Promise.all([s.post({ action: 'retry', flow_id: 21, step: 'plan' }), s.post({ action: 'retry', flow_id: 21, step: 'plan' })]);
  assert.equal(n, 1);
  assert.deepEqual(out.map((x) => x.status).sort(), [200, 409]);
});

/* ---------- roster ---------- */
test('roster makes the profile with the call date in Toronto, and moves the candidate to hired', async () => {
  const s = await setup();
  await s.start();
  const m = s.rows('team_members').at(-1);
  assert.equal(m.name, 'Alex Tremblay');
  assert.equal(m.email, 'alex.tremblay@welfareavenue.com');
  assert.equal(m.department, 'progdev');
  assert.equal(m.role, 'Program Coordinator');
  assert.equal(m.position_id, 5);
  assert.equal(m.active, true);
  assert.equal(m.start_date, '2026-11-01', 'the Toronto date, not the UTC date');
  assert.equal(m.start_source, 'manual');
  const c = s.cand();
  assert.equal(c.status, 'hired');
  assert.equal(c.member_id, m.id);
  assert.equal(c.start_date, '2026-11-01');
  assert.equal(c.updated_by, 'hr.person@welfareavenue.com');
  assert.equal(s.flow().manager_member_id, 2);
  assert.equal(s.flow().started_by, 'hr.person@welfareavenue.com');
});

test('roster links a profile named on the card instead of making a second', async () => {
  const s = await setup({ cand: { member_id: 1 } });
  await s.start();
  assert.equal(s.rows('team_members').length, TEAM.length);
  const m = s.rows('team_members')[0];
  assert.equal(m.start_date, '2026-11-01');
  assert.equal(m.start_source, 'manual');
  assert.equal(s.cand().member_id, 1);
  assert.equal(s.cand().status, 'hired');
});

test('roster links a profile with the same email instead of making a second, whatever the case', async () => {
  const s = await setup({ cand: { email: 'RUTH.OWEN@welfareavenue.com' } });
  await s.start();
  assert.equal(s.rows('team_members').length, TEAM.length);
  assert.equal(s.cand().member_id, 1);
  assert.equal(s.rows('team_members')[0].email, 'ruth.owen@welfareavenue.com', 'a WA address on the profile stays');
});

/* ---------- plan ---------- */
test('plan calls onboarding_assign as the caller with the call date, and ticks what is finished as each step ends', async () => {
  const s = await setup();
  await s.start();
  assert.deepEqual(s.assigned, [{ p_member_id: s.cand().member_id, p_by: 'hr.person@welfareavenue.com', p_start: '2026-11-01' }]);
  const on = s.rows('onboardings')[0];
  assert.equal(s.flow().onboarding_id, on.id);
  const done = () => s.rows('hr_setup_steps').filter((r) => r.done).map((r) => r.template_id).sort();
  assert.deepEqual(done(), ['hrb6']);
  assert.equal(s.rows('hr_setup_steps').find((r) => r.template_id === 'hrb6').done_by, 'hr.person@welfareavenue.com');
  assert.ok(s.rows('hr_setup_steps').find((r) => r.template_id === 'hrb6').done_at);
  await s.post({ action: 'google_manual', flow_id: 21, wa_email: 'alex.tremblay@welfareavenue.com' });
  assert.deepEqual(done(), ['hrb2', 'hrb6']);
});

test('a google step finished before the plan exists is ticked once the plan does', async () => {
  const s = await setup({ config: { onboard_auto_google: 'on' } });
  s.entry('google').run = async () => 'Created it.';
  await s.start();
  assert.deepEqual(s.rows('hr_setup_steps').filter((r) => r.done).map((r) => r.template_id).sort(), ['hrb2', 'hrb6']);
});

test('a plan already open for the person is used and moved, not doubled', async () => {
  const s = await setup({ cand: { member_id: 1 }, tables: { onboardings: [{ id: 40, member_id: 1, completed_at: null, started_at: '2026-10-01' }] } });
  await s.start();
  assert.equal(s.assigned.length, 0);
  assert.equal(s.rows('onboardings').length, 1);
  assert.equal(s.flow().onboarding_id, 40);
  assert.deepEqual(s.moved, [{ p_onboarding: 40, p_new: '2026-11-01' }]);
});

/* ---------- invites ---------- */
test('invites use a stable id, a Meet link, the set lengths and the right people', async () => {
  const s = await setup();
  await s.start();
  const [call, one] = s.calWrites();
  assert.match(call.url, /\/calendars\/hub%40welfareavenue\.com\/events\?/);
  for (const e of [call, one]) {
    assert.match(e.url, /conferenceDataVersion=1/);
    assert.match(e.url, /sendUpdates=all/);
    assert.match(e.body.id, /^[a-v0-9]{5,}$/, 'Calendar allows only base32hex ids');
    assert.equal(e.body.conferenceData.createRequest.conferenceSolutionKey.type, 'hangoutsMeet');
    assert.equal(e.body.start.timeZone, 'America/Toronto');
  }
  assert.notEqual(call.body.id, one.body.id);
  assert.equal(call.body.start.dateTime, CALL);
  assert.equal(call.body.end.dateTime, '2026-11-02T04:30:00.000Z');
  assert.equal(one.body.end.dateTime, '2026-11-03T15:30:00.000Z');
  assert.deepEqual(call.body.attendees.map((a) => a.email).sort(), ['alex@example.com', 'hr.person@welfareavenue.com']);
  assert.deepEqual(one.body.attendees.map((a) => a.email).sort(), ['alex@example.com', 'sam.lee@welfareavenue.com']);
  assert.equal(s.flow().call_event_id, call.body.id);
  assert.equal(s.flow().one_on_one_event_id, one.body.id);
  assert.match(call.headers.authorization, /calendar\.events:hub@welfareavenue\.com/);
});

test('a retry that meets a 409 patches the same event instead of making a second', async () => {
  const s = await setup();
  let posts = 0;
  s.calReply = (e) => {
    if (e.method === 'POST') { posts++; if (posts === 2) return { status: 500, json: { error: { message: 'Backend Error' } } }; }
    return null;
  };
  await s.start();
  assert.equal(s.step('invites').status, 'failed');
  assert.match(s.step('invites').detail, /Backend Error/);
  const firstId = s.calWrites()[0].body.id;
  const mark = s.calWrites().length;
  s.calReply = (e) => (e.method === 'POST' && e.body.id === firstId ? { status: 409, json: { error: { message: 'The requested identifier already exists.' } } } : null);
  const r = await s.post({ action: 'retry', flow_id: 21, step: 'invites' });
  assert.equal(r.status, 200);
  assert.equal(s.step('invites').status, 'done');
  const again = s.calWrites().slice(mark);
  assert.deepEqual(again.map((e) => e.method), ['POST', 'PATCH', 'POST']);
  assert.ok(again[1].url.includes('/events/' + firstId + '?'));
  assert.match(again[1].url, /conferenceDataVersion=1/);
  assert.equal(again[1].body.status, 'confirmed', 'a cancelled event with this id comes back');
  assert.equal(s.flow().call_event_id, firstId);
});

test('without a 1-on-1 only the call is booked', async () => {
  const s = await setup();
  await s.start({ one_on_one_at: null });
  assert.equal(s.calWrites().length, 1);
  assert.equal(s.step('invites').status, 'done');
  assert.match(s.step('invites').detail, /1-on-1/);
  assert.equal(s.flow().one_on_one_event_id, null);
});

test('test mode sends invites to the test inboxes only, and keeps the real address out', async () => {
  const s = await setup({ live: false });
  await s.start();
  for (const e of s.calWrites()) {
    assert.deepEqual(e.body.attendees.map((a) => a.email), ['tester@welfareavenue.com']);
    assert.match(e.body.summary, /^\[TEST, for alex@example\.com\] /);
  }
  assert.match(s.step('invites').detail, /test mode/i);
  const before = s.calWrites().length;
  await s.post({ action: 'google_manual', flow_id: 21, wa_email: 'alex.tremblay@welfareavenue.com' });
  assert.equal(s.calWrites().length, before, 'the guest list has not changed, so no update goes out');
});

test('a failed patch with the new address marks invites failed, and a retry fixes it', async () => {
  const s = await setup();
  await s.start();
  s.calReply = (e) => (e.method === 'PATCH' ? { status: 500, json: { error: { message: 'Backend Error' } } } : null);
  await s.post({ action: 'google_manual', flow_id: 21, wa_email: 'alex.tremblay@welfareavenue.com' });
  assert.equal(s.step('google').status, 'done');
  assert.equal(s.step('invites').status, 'failed');
  assert.match(s.step('invites').detail, /Backend Error/);
  s.calReply = (e) => (e.method === 'POST' ? { status: 409, json: {} } : null);
  await s.post({ action: 'retry', flow_id: 21, step: 'invites' });
  assert.equal(s.step('invites').status, 'done');
  const last = s.calWrites().at(-1);
  assert.ok(last.body.attendees.some((a) => a.email === 'alex.tremblay@welfareavenue.com'));
});

test('a French hire gets a French invite', async () => {
  const s = await setup({ cand: { role: 'Co-responsable des bénévoles' } });
  await s.start();
  assert.match(s.calWrites()[0].body.summary, /^Appel d'accueil : /);
});

test('invites fail with a reason when the card has no personal email', async () => {
  const s = await setup({ cand: { email: null } });
  await s.start();
  assert.equal(s.step('invites').status, 'failed');
  assert.match(s.step('invites').detail, /personal email/);
});

/* ---------- manager ---------- */
test('manager sends onboard_date through notify with the trigger secret', async () => {
  const s = await setup();
  await s.start();
  const [n] = s.notifies();
  assert.equal(n.body.event, 'onboard_date');
  assert.equal(n.body.to_email, 'sam.lee@welfareavenue.com');
  assert.equal(n.body.url, '#hrcentre/onboarding');
  assert.match(n.body.text, /Alex Tremblay/);
  assert.match(n.body.text, /November 1, 2026/);
  assert.equal(n.headers['x-wa-secret'], 'trigger-secret-for-tests');
  assert.equal(s.step('manager').status, 'done');
});

test('a non-OK notify is a failed step with the reason', async () => {
  const s = await setup({ notifyReply: () => ({ status: 400, json: { error: 'unknown event' } }) });
  await s.start();
  assert.equal(s.step('manager').status, 'failed');
  assert.match(s.step('manager').detail, /unknown event/);
});

test('a manager with no email is a failed step that says what to do', async () => {
  const s = await setup({ tables: { team_members: [{ id: 2, name: 'Sam Lee', email: null, active: true }] } });
  await s.start({ one_on_one_at: null });
  assert.equal(s.step('manager').status, 'failed');
  assert.match(s.step('manager').detail, /Sam Lee has no email/);
});

/* ---------- the build 1 settings ---------- */
test('with the settings off, google, hub, welcome and slack are HR tasks; google_manual finishes the job', async () => {
  const s = await setup();
  const r = await s.start();
  assert.equal(r.status, 200);
  assert.deepEqual(s.statuses(), { roster: 'done', google: 'hr_task', plan: 'done', invites: 'done', manager: 'done', hub: 'hr_task', slack: 'hr_task', welcome: 'hr_task' });
  for (const k of ['google', 'hub', 'slack', 'welcome']) assert.ok(s.step(k).detail, k + ' says what HR does');
  assert.equal(s.flow().status, 'running', 'the card keeps its "I created it, continue" button');
  for (const e of s.calWrites()) assert.ok(!e.body.attendees.some((a) => a.email === 'alex.tremblay@welfareavenue.com'), 'no account yet, so the personal address alone');

  const bad = await s.post({ action: 'google_manual', flow_id: 21, wa_email: 'nope' });
  assert.equal(bad.status, 400);
  const before = s.calWrites().length;
  const g = await s.post({ action: 'google_manual', flow_id: 21, wa_email: 'Alex.T@welfareavenue.com' });
  assert.equal(g.status, 200);
  assert.equal(s.step('google').status, 'done');
  assert.equal(s.flow().wa_email, 'alex.t@welfareavenue.com');
  assert.equal(s.rows('team_members').at(-1).email, 'alex.t@welfareavenue.com');
  assert.deepEqual([s.step('hub').status, s.step('welcome').status, s.step('slack').status], ['hr_task', 'hr_task', 'hr_task'], 'no run yet: tasks 10, 11 and 13');
  const patches = s.calWrites().slice(before);
  assert.deepEqual(patches.map((e) => e.method), ['PATCH', 'PATCH']);
  for (const e of patches) assert.ok(e.body.attendees.some((a) => a.email === 'alex.t@welfareavenue.com'));
  assert.equal(s.flow().status, 'started');
  assert.ok(s.flow().started_at);
  const twice = await s.post({ action: 'google_manual', flow_id: 21, wa_email: 'alex.t@welfareavenue.com' });
  assert.equal(twice.status, 409);
});

test('google_manual runs a step that has since been given a run, even with the setting off', async () => {
  const s = await setup();
  const ran = [];
  s.entry('hub').run = async () => { ran.push('hub'); return 'Invited.'; };
  s.entry('welcome').run = async () => { ran.push('welcome'); return 'Sent.'; };
  await s.start();
  assert.deepEqual([s.step('hub').status, s.step('welcome').status], ['hr_task', 'hr_task'], 'the setting off makes them HR tasks at Start');
  assert.deepEqual(ran, []);
  await s.post({ action: 'google_manual', flow_id: 21, wa_email: 'alex.tremblay@welfareavenue.com' });
  assert.deepEqual(ran, ['hub', 'welcome']);
  assert.deepEqual([s.step('hub').status, s.step('welcome').status], ['done', 'done']);
});

test('google_manual refuses an address another roster profile holds, and a flow not started or a step still waiting', async () => {
  const s = await setup();
  assert.equal((await s.post({ action: 'google_manual', flow_id: 21, wa_email: 'a.b@welfareavenue.com' })).status, 409);
  await s.start();
  const r = await s.post({ action: 'google_manual', flow_id: 21, wa_email: 'sam.lee@welfareavenue.com' });
  assert.equal(r.status, 409);
  assert.equal(s.step('google').status, 'hr_task');
  const w = await setup();
  w.db.failOn('team_members', 'insert');
  await w.start();
  assert.equal((await w.post({ action: 'google_manual', flow_id: 21, wa_email: 'a.b@welfareavenue.com' })).status, 409);
});

test('with the settings on, an entry with no run is still an HR task', async () => {
  const s = await setup({ config: { onboard_auto_google: 'on', onboard_auto_slack: 'on' } });
  await s.start();
  assert.deepEqual(s.statuses(), { roster: 'done', google: 'hr_task', plan: 'done', invites: 'done', manager: 'done', hub: 'hr_task', slack: 'hr_task', welcome: 'hr_task' });
});

test('a step given a run is held back by its setting when it is off, and runs when it is on', async () => {
  const off = await setup();
  let n = 0;
  off.entry('slack').run = async () => { n++; return 'Made the channel.'; };
  await off.start();
  assert.equal(off.step('slack').status, 'hr_task');
  assert.equal(n, 0);
  const on = await setup({ config: { onboard_auto_slack: 'on' } });
  on.entry('slack').run = async () => 'Made the channel.';
  await on.start();
  assert.equal(on.step('slack').status, 'done');
  assert.deepEqual(on.rows('hr_setup_steps').filter((r) => r.done).map((r) => r.template_id).sort(), ['hrb4', 'hrb5', 'hrb6']);
});

/* ---------- skip ---------- */
test('any step but roster can be skipped, and what needs only that step is not held', async () => {
  const s = await setup();
  const r = await s.start({ skip: ['google', 'plan', 'invites', 'manager', 'hub', 'slack', 'welcome'] });
  assert.equal(r.status, 200);
  assert.deepEqual(s.statuses(), { roster: 'done', google: 'skipped', plan: 'skipped', invites: 'skipped', manager: 'skipped', hub: 'skipped', slack: 'skipped', welcome: 'skipped' });
  assert.equal(s.assigned.length, 0);
  assert.equal(s.calWrites().length + s.notifies().length, 0);
  assert.equal(s.flow().status, 'started');

  const g = await setup();
  await g.start({ skip: ['google'], wa_email: '' });
  assert.equal(g.step('google').status, 'skipped');
  assert.equal(g.step('hub').status, 'hr_task');
  assert.equal(g.rows('team_members').at(-1).email, 'alex@example.com', 'no address given: the personal one, until HR adds it');
  assert.equal(g.flow().status, 'started');
});

test('with google skipped, the address HR gave goes on the invites', async () => {
  const s = await setup();
  await s.start({ skip: ['google'] });
  assert.ok(s.calWrites()[0].body.attendees.some((a) => a.email === 'alex.tremblay@welfareavenue.com'));
});

/* ---------- practice ---------- */
test('practice: every step done and marked, no fetch, no real rows', async () => {
  const s = await setup({ cand: { practice: true, name: 'Madonna' }, hr: true });
  const before = s.snapshot();
  s.entry('google').run = async () => { throw new Error('a practice run must never reach a real step'); };
  const r = await s.start();
  assert.equal(r.status, 200);
  for (const k of KEYS) {
    assert.equal(s.step(k).status, 'done', k);
    assert.equal(s.step(k).practice, true, k);
    assert.match(s.step(k).detail, /practice/i);
  }
  assert.equal(s.rig.fetchLog.length, 0);
  assert.deepEqual(s.rows('team_members'), before.team_members);
  assert.deepEqual(s.rows('onboardings'), []);
  assert.deepEqual(s.rows('hub_candidates'), before.hub_candidates);
  assert.deepEqual(s.rows('hr_setup_steps'), []);
  assert.deepEqual(s.rows('change_log'), []);
  assert.equal(s.assigned.length, 0);
  assert.equal(s.flow().status, 'started');
});

test('practice preview asks nobody outside', async () => {
  const s = await setup({ cand: { practice: true } });
  const p = await s.post({ action: 'preview', flow_id: 21 });
  assert.equal(p.status, 200);
  assert.equal(s.rig.fetchLog.length, 0);
  assert.deepEqual(p.body.steps.map((x) => x.mode), KEYS.map(() => 'practice'));
});

/* ---------- send_grid_link ---------- */
const expectedToken = (id) => id + '.' + createHmac('sha256', 'onboard-offer:service-key-for-tests').update(String(id)).digest('base64url').slice(0, 20);

test('send_grid_link mails the offer link from hub@, in live mode to the person', async () => {
  const s = await setup({ cand: { accepted_on: null } });
  const r = await s.post({ action: 'send_grid_link', candidate_id: 11 });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  const [g] = s.gmail();
  const m = mail(g);
  assert.match(m.to, /alex@example\.com/);
  assert.match(m.from, /hub@welfareavenue\.com/);
  for (const b of m.bodies) assert.ok(b.includes('https://hub.welfareavenue.com/o/' + expectedToken(11)), 'the link is in every part');
  assert.match(g.headers.authorization, /gmail\.send:hub@welfareavenue\.com/);
  assert.equal(s.cand().accepted_on, null, 'not confirmed, so not accepted');
});

test('send_grid_link sets accepted_on only when HR confirms, and once', async () => {
  const s = await setup({ cand: { accepted_on: null } });
  const r = await s.post({ action: 'send_grid_link', candidate_id: 11, accepted: true });
  assert.equal(r.status, 200);
  assert.equal(s.cand().accepted_on, '2026-10-20');
  assert.equal(s.rows('change_log').filter((x) => x.field === 'accepted_on').length, 1);
  s.rig.setNow('2026-10-22T12:00:00Z');
  await s.post({ action: 'send_grid_link', candidate_id: 11, accepted: true });
  assert.equal(s.cand().accepted_on, '2026-10-20', 'the first date stands');
  assert.equal(s.rows('change_log').filter((x) => x.field === 'accepted_on').length, 1);
  assert.equal(s.gmail().length, 2);
});

test('send_grid_link in test mode goes to the test inboxes, marked', async () => {
  const s = await setup({ live: false });
  await s.post({ action: 'send_grid_link', candidate_id: 11 });
  const m = mail(s.gmail()[0]);
  assert.match(m.to, /tester@welfareavenue\.com/);
  assert.doesNotMatch(m.to, /alex@example/);
  assert.match(m.subject, /^\[TEST, for alex@example\.com\] /);
});

test('send_grid_link in test mode with nobody to send to fails and says so', async () => {
  const s = await setup({ live: false, config: { mail_test_recipients: '' } });
  const r = await s.post({ action: 'send_grid_link', candidate_id: 11 });
  assert.equal(r.status, 502);
  assert.match(r.body.message, /test recipients/);
  assert.equal(s.gmail().length, 0);
});

test('send_grid_link for practice sends nothing', async () => {
  const s = await setup({ cand: { practice: true } });
  const r = await s.post({ action: 'send_grid_link', candidate_id: 11 });
  assert.equal(r.status, 200);
  assert.equal(r.body.practice, true);
  assert.equal(s.rig.fetchLog.length, 0);
});

test('send_grid_link writes French to a French hire, with accents intact', async () => {
  const s = await setup({ cand: { role: 'Co-responsable des bénévoles', name: 'Élise Côté' } });
  await s.post({ action: 'send_grid_link', candidate_id: 11 });
  const m = mail(s.gmail()[0]);
  assert.match(m.subject, /disponibilités/);
  assert.match(m.bodies[0], /Bonjour Élise/);
});

test('send_grid_link refuses when no offer is out, the card is closed or there is no email; Google failing is a reason', async () => {
  const none = await setup({ cand: { offer_sent_at: null, accepted_on: null } });
  assert.equal((await none.post({ action: 'send_grid_link', candidate_id: 11 })).status, 409);
  const closed = await setup({ cand: { status: 'declined' } });
  assert.equal((await closed.post({ action: 'send_grid_link', candidate_id: 11 })).status, 409);
  const noEmail = await setup({ cand: { email: '' } });
  assert.equal((await noEmail.post({ action: 'send_grid_link', candidate_id: 11 })).status, 409);
  const unknown = await setup();
  assert.equal((await unknown.post({ action: 'send_grid_link', candidate_id: 999 })).status, 404);
  for (const s of [none, closed, noEmail, unknown]) assert.equal(s.gmail().length, 0);
});

/* ---------- never a secret, never the wrong words ---------- */
test('a broken Google key fails the step without showing any of it', async () => {
  const s = await setup();
  s.rig.db.onRpc('get_secret', ({ secret_name }) => (secret_name === 'GOOGLE_SA_KEY' ? '{"private_key": "SECRETSECRET' : 'trigger-secret-for-tests'));
  await s.start();
  assert.equal(s.step('invites').status, 'failed');
  assert.doesNotMatch(JSON.stringify(s.rows('hub_onboard_steps')), /SECRETSECRET/);
});

test('the source keeps to the Hub words', () => {
  const src = readFileSync(new URL('../fn/onboard-run/index.ts', import.meta.url), 'utf8');
  assert.equal(src.includes('\u2014'), false, 'no em dash');
  assert.doesNotMatch(src, /\bAI\b/);
  assert.match(src, /^\/\/ Welfare Avenue: onboard-run \(v1, /);
  assert.equal(JSON.parse(readFileSync(new URL('../fn/onboard-run/meta.json', import.meta.url), 'utf8')).verify_jwt, true);
});

test('nothing in a full run went to a URL nobody registered', async () => {
  const s = await setup();
  await s.start();
  await s.post({ action: 'google_manual', flow_id: 21, wa_email: 'alex.tremblay@welfareavenue.com' });
  assert.deepEqual(s.rig.unregistered(), []);
});

/* ---------- Task 7: changes after Start ---------- */
const NEW_CALL = '2026-11-04T14:30:00.000Z';   // 09:30 on 04/11/26 in Toronto
const NEW_ONE = '2026-11-05T15:00:00.000Z';
const EVENTS = 'https://www.googleapis.com/calendar/v3/calendars/hub%40welfareavenue.com/events/';
async function started(over = {}, start = {}) {   // Start has run: both invites booked, Sam Lee the manager
  const s = await setup(over);
  const r = await s.start(start);
  assert.equal(r.status, 200);
  s.calReset = () => { s.rig.fetchLog.length = 0; };
  return s;
}
const changeActions = (s) => ({
  book_one_on_one: () => s.post({ action: 'book_one_on_one', flow_id: 21, at: NEW_ONE }),
  change_time: () => s.post({ action: 'change_time', flow_id: 21, which: 'call', at: NEW_CALL }),
  change_manager: () => s.post({ action: 'change_manager', flow_id: 21, member_id: 1 }),
  backed_out: () => s.post({ action: 'backed_out', flow_id: 21, reason: 'Took another job' }),
});

test('book_one_on_one after Start sends the invite then, to the hire and the manager', async () => {
  const s = await started({}, { one_on_one_at: null });
  assert.equal(s.flow().one_on_one_at, null);
  assert.equal(s.flow().one_on_one_event_id, null);
  s.calReset();
  const r = await s.post({ action: 'book_one_on_one', flow_id: 21, at: NEW_ONE });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(Date.parse(s.flow().one_on_one_at), Date.parse(NEW_ONE));
  assert.equal(s.flow().one_on_one_event_id, 'onboard21oneonone');
  const [w, ...rest] = s.calWrites();
  assert.equal(rest.length, 0, 'one calendar write');
  assert.equal(w.method, 'POST');
  assert.match(w.url, /\/events\?conferenceDataVersion=1&sendUpdates=all$/);
  assert.equal(w.body.id, 'onboard21oneonone');
  assert.deepEqual(w.body.attendees.map((a) => a.email).sort(), ['alex@example.com', 'sam.lee@welfareavenue.com']);
  assert.equal(w.body.start.dateTime, NEW_ONE);
  assert.equal(w.body.end.dateTime, '2026-11-05T15:30:00.000Z');
  assert.match(w.body.summary, /^1-on-1: Alex Tremblay and Sam Lee$/);
  assert.match(s.step('invites').detail, /1-on-1/);
  assert.doesNotMatch(s.step('invites').detail, /still to book/, 'the card no longer says it is still to book');
  assert.deepEqual(s.rig.unregistered(), []);
});

test('book_one_on_one in mail test mode keeps the invite to the test inboxes', async () => {
  const s = await started({ live: false }, { one_on_one_at: null });
  s.calReset();
  assert.equal((await s.post({ action: 'book_one_on_one', flow_id: 21, at: NEW_ONE })).status, 200);
  const [w] = s.calWrites();
  assert.deepEqual(w.body.attendees.map((a) => a.email), ['tester@welfareavenue.com']);
  assert.match(w.body.summary, /^\[TEST, for alex@example\.com\] 1-on-1: /);
});

test('book_one_on_one refuses a 1-on-1 already booked, a past or unreadable time, and a manager who cannot be invited', async () => {
  const booked = await started();
  const before = booked.snapshot();
  booked.calReset();
  const again = await booked.post({ action: 'book_one_on_one', flow_id: 21, at: NEW_ONE });
  assert.equal(again.status, 409);
  assert.match(again.body.message, /already booked/);
  assert.deepEqual(booked.snapshot(), before);
  assert.equal(booked.calWrites().length, 0);

  const s = await started({}, { one_on_one_at: null });
  const snap = s.snapshot();
  s.calReset();
  for (const at of ['2026-10-19T12:00:00Z', 'soon', '', null, undefined]) {
    const r = await s.post({ action: 'book_one_on_one', flow_id: 21, at });
    assert.equal(r.status, 400, String(at));
    assert.ok(r.body.message.endsWith('.'));
  }
  const sam = () => s.rows('team_members').find((m) => m.id === 2);
  sam().email = null;
  const noMail = await s.post({ action: 'book_one_on_one', flow_id: 21, at: NEW_ONE });
  assert.equal(noMail.status, 409);
  assert.match(noMail.body.message, /no email/);
  sam().email = 'sam.lee@welfareavenue.com';
  sam().active = false;
  assert.equal((await s.post({ action: 'book_one_on_one', flow_id: 21, at: NEW_ONE })).status, 409);
  sam().active = true;
  assert.deepEqual(s.snapshot(), snap);
  assert.equal(s.calWrites().length, 0);
});

test('book_one_on_one: two presses book once, and a Google refusal leaves it unbooked', async () => {
  const s = await started({}, { one_on_one_at: null });
  s.calReset();
  const [a, b] = await Promise.all([s.post({ action: 'book_one_on_one', flow_id: 21, at: NEW_ONE }), s.post({ action: 'book_one_on_one', flow_id: 21, at: NEW_ONE })]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal(s.calWrites().length, 1);

  const f = await started({}, { one_on_one_at: null });
  f.calReset();
  f.calReply = (e) => (e.method === 'POST' ? { status: 500, json: { error: { message: 'Backend Error' } } } : null);
  const r = await f.post({ action: 'book_one_on_one', flow_id: 21, at: NEW_ONE });
  assert.equal(r.status, 502);
  assert.match(r.body.message, /Backend Error/);
  assert.doesNotMatch(r.body.message, /Press Retry/, 'there is no Retry button for this');
  assert.ok(r.body.message.endsWith('.'));
  assert.equal(f.flow().one_on_one_at, null, 'not marked as booked');
  assert.equal(f.flow().one_on_one_event_id, null);
});

test('change_time on the 1-on-1 patches the same event, tells the guests through Google and re-notifies the manager', async () => {
  const s = await started();
  s.moved.length = 0;
  s.calReset();
  const r = await s.post({ action: 'change_time', flow_id: 21, which: 'one_on_one', at: NEW_ONE });
  assert.equal(r.status, 200);
  assert.equal(Date.parse(s.flow().one_on_one_at), Date.parse(NEW_ONE));
  const [w, ...rest] = s.calWrites();
  assert.equal(rest.length, 0);
  assert.equal(w.method, 'PATCH');
  assert.equal(w.url, EVENTS + 'onboard21oneonone?sendUpdates=all');
  assert.equal(w.body.start.dateTime, NEW_ONE);
  assert.equal(w.body.end.dateTime, '2026-11-05T15:30:00.000Z', 'the 30 minute 1-on-1');
  assert.equal(w.body.start.timeZone, 'America/Toronto');
  assert.deepEqual(w.body.attendees.map((a) => a.email).sort(), ['alex@example.com', 'sam.lee@welfareavenue.com']);
  assert.equal(s.moved.length, 0, 'the 1-on-1 does not move day one');
  const [n] = s.notifies();
  assert.equal(s.notifies().length, 1);
  assert.equal(n.body.event, 'onboard_date');
  assert.equal(n.body.to_email, 'sam.lee@welfareavenue.com');
  assert.match(n.body.body, /1-on-1/);
  assert.match(n.body.body, /November 5, 2026/);
  assert.deepEqual(s.rig.unregistered(), []);
});

test('change_time on the call moves the plan, the event and the manager, and uses the Toronto date', async () => {
  const s = await started();
  const onb = s.flow().onboarding_id;
  assert.ok(onb);
  s.moved.length = 0;
  s.calReset();
  const r = await s.post({ action: 'change_time', flow_id: 21, which: 'call', at: NEW_CALL });
  assert.equal(r.status, 200);
  assert.equal(Date.parse(s.flow().call_at), Date.parse(NEW_CALL));
  assert.deepEqual(s.moved, [{ p_onboarding: onb, p_new: '2026-11-04' }]);
  const [w] = s.calWrites();
  assert.equal(s.calWrites().length, 1);
  assert.equal(w.url, EVENTS + 'onboard21call?sendUpdates=all');
  assert.equal(w.body.end.dateTime, '2026-11-04T15:30:00.000Z', 'the 60 minute call');
  const [n] = s.notifies();
  assert.equal(n.body.to_email, 'sam.lee@welfareavenue.com');
  assert.match(n.body.title, /2026-11-04/);
  assert.equal(s.rows('change_log').some((x) => x.entity_type === 'onboard_flow' && x.field === 'call_at'), true, 'the change is logged');
});

test('change_time near the clock change keeps the Toronto date of the instant', async () => {
  const s = await started();
  s.moved.length = 0;
  await s.post({ action: 'change_time', flow_id: 21, which: 'call', at: '2026-11-08T03:30:00.000Z' });   // 22:30 on 07/11/26 in Toronto
  assert.equal(s.moved[0].p_new, '2026-11-07');
});

test('change_time refuses a past time, the same time, a missing booking, a bad choice and a bad time, with nothing written', async () => {
  const s = await started({}, { one_on_one_at: null });
  const before = s.snapshot();
  s.moved.length = 0;
  s.calReset();
  const cases = [
    [{ which: 'call', at: '2026-10-19T12:00:00Z' }, 400, /passed/],
    [{ which: 'call', at: CALL }, 400, /already the time/],
    [{ which: 'call', at: 'whenever' }, 400, /time/],
    [{ which: 'call' }, 400, /time/],
    [{ which: 'one_on_one', at: NEW_ONE }, 409, /not booked yet/],
    [{ which: 'lunch', at: NEW_ONE }, 400, /call or the 1-on-1/],
    [{ at: NEW_ONE }, 400, /call or the 1-on-1/],
  ];
  for (const [over, status, re] of cases) {
    const r = await s.post({ action: 'change_time', flow_id: 21, ...over });
    assert.equal(r.status, status, JSON.stringify(over));
    assert.match(r.body.message, re, JSON.stringify(over));
    assert.ok(r.body.message.endsWith('.'));
  }
  assert.deepEqual(s.snapshot(), before);
  assert.equal(s.calWrites().length + s.notifies().length, 0);
  assert.equal(s.moved.length, 0);
});

test('change_time in mail test mode keeps the invites to the test inboxes', async () => {
  const s = await started({ live: false });
  s.calReset();
  await s.post({ action: 'change_time', flow_id: 21, which: 'one_on_one', at: NEW_ONE });
  const [w] = s.calWrites();
  assert.deepEqual(w.body.attendees.map((a) => a.email), ['tester@welfareavenue.com']);
});

test('change_time: when Google refuses, the time and the plan dates go back and HR is told', async () => {
  const s = await started();
  const onb = s.flow().onboarding_id;
  const callBefore = s.flow().call_at;
  s.moved.length = 0;
  s.calReset();
  s.calReply = () => ({ status: 403, json: { error: { message: 'Forbidden' } } });
  const r = await s.post({ action: 'change_time', flow_id: 21, which: 'call', at: NEW_CALL });
  assert.equal(r.status, 502);
  assert.match(r.body.message, /Forbidden/);
  assert.match(r.body.message, /not changed/);
  assert.ok(r.body.message.endsWith('.'));
  assert.equal(s.flow().call_at, callBefore);
  assert.deepEqual(s.moved, [{ p_onboarding: onb, p_new: '2026-11-04' }, { p_onboarding: onb, p_new: '2026-11-01' }], 'moved, then moved back');
  assert.equal(s.notifies().length, 0, 'the manager hears nothing about a change that did not happen');
});

test('change_time: the plan failing to move changes nothing and never reaches Google', async () => {
  const s = await started();
  const callBefore = s.flow().call_at;
  s.calReset();
  s.rig.db.onRpc('wa271_move_start', () => { throw new Error('plan is locked'); });
  const r = await s.post({ action: 'change_time', flow_id: 21, which: 'call', at: NEW_CALL });
  assert.equal(r.status, 500);
  assert.match(r.body.message, /plan is locked/);
  assert.equal(s.flow().call_at, callBefore);
  assert.equal(s.calWrites().length, 0);
});

test('change_time: two presses at once move it once; a manager who was not reached is a warning, not a failure', async () => {
  const s = await started();
  s.calReset();
  const [a, b] = await Promise.all([
    s.post({ action: 'change_time', flow_id: 21, which: 'one_on_one', at: NEW_ONE }),
    s.post({ action: 'change_time', flow_id: 21, which: 'one_on_one', at: NEW_ONE }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal(s.calWrites().length, 1);
  assert.equal(s.notifies().length, 1);

  const n = await started({ notifyReply: () => ({ json: { outcome: { 'sam.lee@welfareavenue.com': 'no_slack' }, hub: 'off' } }) });
  const w = await n.post({ action: 'change_time', flow_id: 21, which: 'one_on_one', at: NEW_ONE });
  assert.equal(w.status, 200);
  assert.equal(Date.parse(n.flow().one_on_one_at), Date.parse(NEW_ONE));
  assert.ok(w.body.warnings.some((x) => /Sam Lee was not told/.test(x) && x.endsWith('.')), JSON.stringify(w.body));
});

test('change_manager moves the 1-on-1 to the new attendee and tells both managers', async () => {
  const s = await started();
  Object.assign(s.rows('hub_onboard_flows')[0], { manager_link_sent_at: '2026-10-21T12:00:00Z', manager_link_member_id: 2, reminded_manager_at: '2026-10-23T12:00:00Z' });
  s.calReset();
  const r = await s.post({ action: 'change_manager', flow_id: 21, member_id: 1 });
  assert.equal(r.status, 200);
  assert.equal(s.flow().manager_member_id, 1);
  assert.equal(s.flow().manager_link_sent_at, null);
  assert.equal(s.flow().manager_link_member_id, null);
  assert.equal(s.flow().reminded_manager_at, null);
  const [w] = s.calWrites();
  assert.equal(s.calWrites().length, 1);
  assert.equal(w.method, 'PATCH');
  assert.equal(w.url, EVENTS + 'onboard21oneonone?sendUpdates=all');
  assert.deepEqual(w.body.attendees.map((a) => a.email).sort(), ['alex@example.com', 'ruth.owen@welfareavenue.com']);
  assert.match(w.body.summary, /^1-on-1: Alex Tremblay and Ruth Owen$/);
  const sent = Object.fromEntries(s.notifies().map((n) => [n.body.to_email, n.body]));
  assert.deepEqual(Object.keys(sent).sort(), ['ruth.owen@welfareavenue.com', 'sam.lee@welfareavenue.com']);
  for (const b of Object.values(sent)) assert.equal(b.event, 'onboard_date');
  assert.match(sent['ruth.owen@welfareavenue.com'].body, /You are now their manager/);
  assert.match(sent['sam.lee@welfareavenue.com'].body, /Ruth Owen/);
  assert.equal(s.rows('change_log').find((x) => x.entity_type === 'onboard_flow' && x.field === 'manager_member_id').new_value, '1');
});

test('change_manager before the 1-on-1 is booked touches no invite, and the new manager gets a fresh grid', async () => {
  const s = await started({ tables: { hub_onboard_grids: [{ flow_id: 21, who: 'manager', slots: ['2026-11-03T15:00:00Z'] }, { flow_id: 21, who: 'hire', slots: ['2026-11-03T16:00:00Z'] }] } }, { one_on_one_at: null });
  Object.assign(s.rows('hub_onboard_flows')[0], { manager_link_sent_at: '2026-10-21T12:00:00Z', manager_link_member_id: 2 });
  s.calReset();
  const r = await s.post({ action: 'change_manager', flow_id: 21, member_id: 1 });
  assert.equal(r.status, 200);
  assert.equal(s.calWrites().length, 0, 'no 1-on-1, so no invite to move');
  assert.equal(s.flow().manager_link_sent_at, null, 'the hourly job sends the new manager their link');
  assert.deepEqual(s.rows('hub_onboard_grids').find((g) => g.who === 'manager').slots, [], 'the old manager\'s marks are not carried over');
  assert.deepEqual(s.rows('hub_onboard_grids').find((g) => g.who === 'hire').slots, ['2026-11-03T16:00:00Z'], 'the hire\'s marks stay');
  assert.equal(s.notifies().length, 2);
  assert.match(s.notifies().find((n) => n.body.to_email === 'ruth.owen@welfareavenue.com').body.body, /link/);
});

test('change_manager refuses the same person, someone off the roster, someone inactive or without an email', async () => {
  const s = await started();
  const before = s.snapshot();
  s.calReset();
  const ruth = () => s.rows('team_members').find((m) => m.id === 1);
  const cases = [
    [{ member_id: 2 }, /already the manager/, () => {}],
    [{ member_id: 999 }, /roster/, () => {}],
    [{ member_id: null }, /roster/, () => {}],
    [{ member_id: 1 }, /not active/, () => { ruth().active = false; }],
    [{ member_id: 1 }, /no email/, () => { ruth().active = true; ruth().email = null; }],
  ];
  for (const [over, re, prep] of cases) {
    prep();
    const r = await s.post({ action: 'change_manager', flow_id: 21, ...over });
    assert.equal(r.status >= 400 && r.status < 500, true, JSON.stringify(over));
    assert.match(r.body.message, re);
    assert.ok(r.body.message.endsWith('.'));
  }
  ruth().email = 'ruth.owen@welfareavenue.com';
  assert.deepEqual(s.snapshot(), before);
  assert.equal(s.calWrites().length + s.notifies().length, 0);
});

test('change_manager: when Google refuses, the old manager stays and nobody is told; two presses change it once', async () => {
  const f = await started();
  Object.assign(f.rows('hub_onboard_flows')[0], { manager_link_sent_at: '2026-10-21T12:00:00Z', manager_link_member_id: 2 });
  f.calReset();
  f.calReply = () => ({ status: 500, json: { error: { message: 'Backend Error' } } });
  const r = await f.post({ action: 'change_manager', flow_id: 21, member_id: 1 });
  assert.equal(r.status, 502);
  assert.match(r.body.message, /Backend Error/);
  assert.equal(f.flow().manager_member_id, 2);
  assert.equal(f.flow().manager_link_sent_at, '2026-10-21T12:00:00Z', 'the old link record is back');
  assert.equal(f.flow().manager_link_member_id, 2);
  assert.equal(f.notifies().length, 0);

  const s = await started();
  s.calReset();
  const [a, b] = await Promise.all([s.post({ action: 'change_manager', flow_id: 21, member_id: 1 }), s.post({ action: 'change_manager', flow_id: 21, member_id: 1 })]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal(s.calWrites().length, 1);
  assert.equal(s.notifies().length, 2);
});

test('backed_out cancels both events, closes the onboarding and the flow, withdraws the card, and lists what to remove without removing it', async () => {
  const s = await started();
  await s.post({ action: 'google_manual', flow_id: 21, wa_email: 'alex.tremblay@welfareavenue.com' });
  s.rows('hub_onboard_flows')[0].slack_channel_id = 'C0NEW';
  Object.assign(s.step('hub'), { status: 'done' });
  const onb = s.flow().onboarding_id;
  const rowCounts = Object.fromEntries(Object.entries(s.snapshot()).map(([k, v]) => [k, v.length]));
  s.calReset();
  const r = await s.post({ action: 'backed_out', flow_id: 21, reason: 'Took another job' });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(s.flow().status, 'backed_out');
  const w = s.calWrites();
  assert.deepEqual(w.map((e) => e.method), ['PATCH', 'PATCH'], 'cancelled, never deleted');
  assert.deepEqual(w.map((e) => e.url).sort(), [EVENTS + 'onboard21call?sendUpdates=all', EVENTS + 'onboard21oneonone?sendUpdates=all']);
  for (const e of w) assert.equal(e.body.status, 'cancelled');
  assert.equal(s.rig.fetchLog.some((e) => e.method === 'DELETE'), false);
  const o = s.rows('onboardings').find((x) => x.id === onb);
  assert.equal(o.status, 'completed');
  assert.ok(o.completed_at, 'closed the way the Hub closes a plan');
  assert.equal(s.cand().status, 'withdrawn');
  assert.equal(s.cand().close_reason, 'Backed out after accepting: Took another job');
  assert.equal(r.body.remove.length, 3);
  assert.match(r.body.remove.find((x) => /Google/.test(x)), /alex\.tremblay@welfareavenue\.com/);
  assert.ok(r.body.remove.some((x) => /Slack/.test(x) && /C0NEW/.test(x)));
  assert.ok(r.body.remove.some((x) => /Hub access/.test(x)));
  for (const x of r.body.remove) assert.ok(x.endsWith('.'));
  const after = Object.fromEntries(Object.entries(s.snapshot()).map(([k, v]) => [k, v.length]));
  for (const [k, n] of Object.entries(rowCounts)) assert.ok(after[k] >= n, k + ' lost rows');
  assert.equal(s.notifies().length + s.gmail().length, 0);
  assert.deepEqual(s.rig.unregistered(), []);
});

test('backed_out names only what this flow made', async () => {
  const none = await started();
  const r = await none.post({ action: 'backed_out', flow_id: 21, reason: '' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.remove, [], 'google, hub and slack are HR tasks that were never done');
  assert.equal(none.cand().close_reason, 'Backed out after accepting');

  const skipped = await started({}, { skip: ['google', 'hub', 'slack', 'welcome'] });
  assert.deepEqual((await skipped.post({ action: 'backed_out', flow_id: 21, reason: 'x' })).body.remove, []);

  const googleOnly = await started();
  await googleOnly.post({ action: 'google_manual', flow_id: 21, wa_email: 'alex.tremblay@welfareavenue.com' });
  const g = await googleOnly.post({ action: 'backed_out', flow_id: 21, reason: 'x' });
  assert.equal(g.body.remove.length, 1);
  assert.match(g.body.remove[0], /Google/);
});

test('backed_out: two presses cancel once; a Google refusal leaves the flow open, an invite already gone does not', async () => {
  const s = await started();
  s.calReset();
  const [a, b] = await Promise.all([s.post({ action: 'backed_out', flow_id: 21, reason: 'x' }), s.post({ action: 'backed_out', flow_id: 21, reason: 'x' })]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal(s.calWrites().length, 2);
  assert.equal(s.rows('change_log').filter((x) => x.entity_type === 'candidate' && /backed out/i.test(x.new_value || '')).length, 1);

  const f = await started();
  f.calReset();
  f.calReply = () => ({ status: 500, json: { error: { message: 'Backend Error' } } });
  const r = await f.post({ action: 'backed_out', flow_id: 21, reason: 'x' });
  assert.equal(r.status, 502);
  assert.match(r.body.message, /Backend Error/);
  assert.match(r.body.message, /still open/);
  assert.ok(r.body.message.endsWith('.'));
  assert.equal(f.flow().status, 'running', 'the claim is given back');
  assert.equal(f.cand().status, 'hired');
  assert.equal(f.rows('onboardings')[0].completed_at, null);

  const gone = await started();
  gone.calReset();
  gone.calReply = () => ({ status: 410, json: { error: { message: 'Resource has been deleted' } } });
  const ok = await gone.post({ action: 'backed_out', flow_id: 21, reason: 'x' });
  assert.equal(ok.status, 200);
  assert.equal(gone.flow().status, 'backed_out');
});

test('backed_out: a plan that will not close is a warning, and the rest still happened', async () => {
  const s = await started();
  s.db.failOn('onboardings', 'update', 'plan is locked');
  const r = await s.post({ action: 'backed_out', flow_id: 21, reason: 'x' });
  assert.equal(r.status, 200);
  assert.equal(s.flow().status, 'backed_out');
  assert.equal(s.cand().status, 'withdrawn');
  assert.ok(r.body.warnings.some((x) => /plan could not be closed/.test(x) && /plan is locked/.test(x) && x.endsWith('.')), JSON.stringify(r.body));
});

test('after backed_out, Retry and the manual Google step refuse, and nothing can change', async () => {
  const s = await started();
  await s.post({ action: 'backed_out', flow_id: 21, reason: 'x' });
  const before = s.snapshot();
  s.calReset();
  const tries = [
    s.post({ action: 'retry', flow_id: 21, step: 'invites' }),
    s.post({ action: 'retry', flow_id: 21, step: 'google' }),
    s.post({ action: 'google_manual', flow_id: 21, wa_email: 'alex.tremblay@welfareavenue.com' }),
    s.post({ action: 'start', flow_id: 21, wa_email: 'alex.tremblay@welfareavenue.com', manager_member_id: 2, call_at: CALL }),
    ...Object.values(changeActions(s)).map((go) => go()),
  ];
  for (const r of await Promise.all(tries)) {
    assert.equal(r.status, 409);
    assert.ok(r.body.message.endsWith('.'));
  }
  assert.deepEqual(s.snapshot(), before);
  assert.equal(s.calWrites().length + s.notifies().length + s.gmail().length, 0);
  assert.match((await s.post({ action: 'change_time', flow_id: 21, which: 'call', at: NEW_CALL })).body.message, /backed out/);
  assert.match((await s.post({ action: 'retry', flow_id: 21, step: 'invites' })).body.message, /backed out/);
  assert.match((await s.post({ action: 'google_manual', flow_id: 21, wa_email: 'alex.tremblay@welfareavenue.com' })).body.message, /backed out/);
});

test('the four changes refuse a flow that has not been started, with nothing written', async () => {
  for (const status of ['waiting', 'ready']) {
    const s = await setup({ fl: { status, call_at: CALL, call_event_id: 'onboard21call' } });
    const before = s.snapshot();
    for (const go of Object.values(changeActions(s))) {
      const r = await go();
      assert.equal(r.status, 409, status);
      assert.match(r.body.message, /Start onboarding/);
      assert.ok(r.body.message.endsWith('.'));
    }
    assert.deepEqual(s.snapshot(), before);
    assert.equal(s.rig.fetchLog.length, 0);
  }
  const s = await setup();
  assert.equal((await s.post({ action: 'change_time', flow_id: 999, which: 'call', at: NEW_CALL })).status, 404);
});

test('the changes work whether the flow is running or started', async () => {
  for (const status of ['running', 'started']) {
    const s = await started();
    s.rows('hub_onboard_flows')[0].status = status;
    assert.equal((await s.post({ action: 'change_time', flow_id: 21, which: 'call', at: NEW_CALL })).status, 200, status);
    assert.equal((await s.post({ action: 'change_manager', flow_id: 21, member_id: 1 })).status, 200, status);
    assert.equal(s.flow().status, status, 'the status is left as it was');
    assert.equal((await s.post({ action: 'backed_out', flow_id: 21, reason: 'x' })).status, 200, status);
    assert.equal(s.flow().status, 'backed_out');
  }
});

test('a practice flow changes only its own row: no Calendar, no notify, no roster, no plan, no card', async () => {
  const mk = async (start = {}) => {
    const s = await setup({ cand: { practice: true } });
    assert.equal((await s.start(start)).status, 200);
    s.rig.fetchLog.length = 0;
    return s;
  };
  const others = (s) => { const t = s.snapshot(); delete t.hub_onboard_flows; delete t.hub_onboard_steps; return t; };

  const book = await mk({ one_on_one_at: null });
  let frozen = others(book);
  assert.equal((await book.post({ action: 'book_one_on_one', flow_id: 21, at: NEW_ONE })).status, 200);
  assert.equal(Date.parse(book.flow().one_on_one_at), Date.parse(NEW_ONE));
  assert.deepEqual(others(book), frozen);
  assert.equal(book.rig.fetchLog.length, 0);

  const time = await mk();
  time.moved.length = 0;
  frozen = others(time);
  assert.equal((await time.post({ action: 'change_time', flow_id: 21, which: 'call', at: NEW_CALL })).status, 200);
  assert.equal((await time.post({ action: 'change_time', flow_id: 21, which: 'one_on_one', at: NEW_ONE })).status, 200);
  assert.equal(Date.parse(time.flow().call_at), Date.parse(NEW_CALL));
  assert.equal(time.moved.length, 0);
  assert.deepEqual(others(time), frozen);
  assert.equal(time.rig.fetchLog.length, 0);

  const mgr = await mk();
  frozen = others(mgr);
  assert.equal((await mgr.post({ action: 'change_manager', flow_id: 21, member_id: 1 })).status, 200);
  assert.equal(mgr.flow().manager_member_id, 1);
  assert.deepEqual(others(mgr), frozen);
  assert.equal(mgr.rig.fetchLog.length, 0);

  const out = await mk();
  frozen = others(out);
  const r = await out.post({ action: 'backed_out', flow_id: 21, reason: 'x' });
  assert.equal(r.status, 200);
  assert.equal(out.flow().status, 'backed_out');
  assert.deepEqual(r.body.remove, []);
  assert.deepEqual(others(out), frozen);
  assert.equal(out.rig.fetchLog.length, 0);
});

test('after backed_out the grid and password links of onboard-link are closed', async () => {
  const s = await started();
  await s.post({ action: 'backed_out', flow_id: 21, reason: 'x' });
  const tables = structuredClone(s.snapshot());
  tables.hub_candidates[0].status = 'hired';   // so that only the flow shuts the links
  tables.hub_candidates[0].accepted_on = '2026-10-15';
  Object.assign(tables.hub_onboard_flows[0], { pw_nonce: 'nonce1', pw_expires_at: '2026-12-01T00:00:00Z', pw_used_at: null });
  const link = await loadFn('onboard-link', { tables: { hub_candidates: tables.hub_candidates, hub_onboard_flows: tables.hub_onboard_flows, hub_onboard_grids: [], team_members: tables.team_members, change_log: [] } });
  link.setNow(NOW);
  const get = async (t) => (await link.call(new Request('https://stub.supabase.test/functions/v1/onboard-link?t=' + encodeURIComponent(t)))).json();
  const post = async (body) => (await link.call(new Request('https://stub.supabase.test/functions/v1/onboard-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))).json();
  const before = structuredClone(link.db.tables);
  for (const t of [await link.mod.wa271Token('offer', 11), await link.mod.wa271Token('mgr', 21)]) {
    assert.equal((await get(t)).closed, true);
    assert.equal((await post({ t, a: 'grid', slots: [] })).closed, true);
  }
  assert.equal((await get(await link.mod.wa271Token('pw', 21, 'nonce1'))).closed, true, 'the password link');
  assert.deepEqual(link.db.tables, before);
});
