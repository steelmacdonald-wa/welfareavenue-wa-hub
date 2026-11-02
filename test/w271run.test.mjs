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
  assert.equal(r.body.remove.length, 4);
  assert.match(r.body.remove.find((x) => /^Roster profile/.test(x)), /Deactivate it by hand/);
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
  assert.equal(r.body.remove.length, 1, 'google, hub and slack are HR tasks that were never done; only the roster profile Start made');
  assert.match(r.body.remove[0], /^Roster profile/);
  assert.equal(none.cand().close_reason, 'Backed out after accepting');

  const skipped = await started({}, { skip: ['google', 'hub', 'slack', 'welcome'] });
  assert.deepEqual((await skipped.post({ action: 'backed_out', flow_id: 21, reason: 'x' })).body.remove.map((x) => x.split(' ')[0]), ['Roster']);

  const googleOnly = await started();
  await googleOnly.post({ action: 'google_manual', flow_id: 21, wa_email: 'alex.tremblay@welfareavenue.com' });
  const g = await googleOnly.post({ action: 'backed_out', flow_id: 21, reason: 'x' });
  assert.equal(g.body.remove.length, 2);
  assert.ok(g.body.remove.some((x) => /^Google/.test(x)) && g.body.remove.some((x) => /^Roster/.test(x)));
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

test('the changes that need Start refuse a flow that has not been started, with nothing written', async () => {
  for (const status of ['waiting', 'ready']) {
    const s = await setup({ fl: { status, call_at: CALL, call_event_id: 'onboard21call' } });
    const before = s.snapshot();
    for (const [name, go] of Object.entries(changeActions(s))) {
      if (name === 'backed_out') continue;   // it also closes a flow that has not started
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

/* ---------- fix round 1 ---------- */
async function noPlan(over = {}) {   // Start has run, but the plan step failed: the roster step has set day one on the profile and the card
  const s = await setup(over);
  s.rig.db.onRpc('onboarding_assign', () => { throw new Error('plan is locked'); });
  assert.equal((await s.start()).status, 200);
  assert.equal(s.step('plan').status, 'failed');
  assert.equal(s.flow().onboarding_id, null);
  s.moved.length = 0;
  s.rig.fetchLog.length = 0;
  return s;
}
const member = (s) => s.rows('team_members').find((m) => m.id === s.cand().member_id);

test('change_time on the call with no plan yet still moves day one on the profile and the card', async () => {
  const s = await noPlan();
  assert.equal(member(s).start_date, '2026-11-01');
  assert.equal(s.cand().start_date, '2026-11-01');
  const r = await s.post({ action: 'change_time', flow_id: 21, which: 'call', at: NEW_CALL });
  assert.equal(r.status, 200);
  assert.equal(member(s).start_date, '2026-11-04');
  assert.equal(member(s).start_source, 'manual', 'directory-sync leaves it alone');
  assert.equal(s.cand().start_date, '2026-11-04');
  assert.equal(s.moved.length, 0, 'there is no plan to move');
  assert.equal(Date.parse(s.flow().call_at), Date.parse(NEW_CALL));
});

test('change_time with no plan puts the profile and card dates back when Google refuses', async () => {
  const s = await noPlan();
  s.calReply = () => ({ status: 403, json: { error: { message: 'Forbidden' } } });
  const r = await s.post({ action: 'change_time', flow_id: 21, which: 'call', at: NEW_CALL });
  assert.equal(r.status, 502);
  assert.equal(member(s).start_date, '2026-11-01');
  assert.equal(member(s).start_source, 'manual');
  assert.equal(s.cand().start_date, '2026-11-01');
  assert.equal(Date.parse(s.flow().call_at), Date.parse(CALL));
});

test('change_time with no plan and no roster step done touches no profile, and a 1-on-1 change never moves day one', async () => {
  const s = await noPlan();
  s.step('roster').status = 'failed';
  await s.post({ action: 'change_time', flow_id: 21, which: 'call', at: NEW_CALL });
  assert.equal(member(s).start_date, '2026-11-01');
  const t = await noPlan();
  await t.post({ action: 'change_time', flow_id: 21, which: 'one_on_one', at: NEW_ONE });
  assert.equal(member(t).start_date, '2026-11-01');
  assert.equal(t.cand().start_date, '2026-11-01');
});

for (const [name, which, id, at, ms] of [['call', 'call', 'onboard21call', NEW_CALL, 60], ['1-on-1', 'one_on_one', 'onboard21oneonone', NEW_ONE, 30]]) {
  for (const gone of [404, 410]) {
    test('change_time books the ' + name + ' again at the new time when Calendar says it is gone (' + gone + ')', async () => {
      const s = await started();
      s.calReset();
      s.calReply = (e) => (e.method === 'PATCH' ? { status: gone, json: { error: { message: 'Not Found' } } } : null);
      const r = await s.post({ action: 'change_time', flow_id: 21, which, at });
      assert.equal(r.status, 200);
      assert.equal(Date.parse(s.flow()[which === 'call' ? 'call_at' : 'one_on_one_at']), Date.parse(at));
      assert.deepEqual(s.calWrites().map((e) => e.method), ['PATCH', 'POST']);
      const post = s.calWrites()[1];
      assert.equal(post.body.id, id, 'the same event id');
      assert.match(post.url, /sendUpdates=all/);
      assert.equal(post.body.start.dateTime, at);
      assert.equal(Date.parse(post.body.end.dateTime) - Date.parse(at), ms * 60000);
      assert.equal(s.flow()[which === 'call' ? 'call_event_id' : 'one_on_one_event_id'], id);
      assert.ok(r.body.warnings.some((x) => /deleted from Calendar/.test(x) && x.endsWith('.')));
      assert.equal(s.notifies().length, 1, 'the manager is still told');
    });
  }
}

test('change_time: if booking again also fails, the time, the plan and the dates all go back', async () => {
  const s = await started();
  const before = s.snapshot();
  s.moved.length = 0;
  s.calReset();
  s.calReply = (e) => (e.method === 'PATCH' ? { status: 404, json: { error: { message: 'Not Found' } } } : { status: 500, json: { error: { message: 'Backend Error' } } });
  const r = await s.post({ action: 'change_time', flow_id: 21, which: 'call', at: NEW_CALL });
  assert.equal(r.status, 502);
  assert.match(r.body.message, /Backend Error/);
  assert.match(r.body.message, /not changed/);
  assert.doesNotMatch(r.body.message, /Press Retry/);
  assert.equal(s.flow().call_at, before.hub_onboard_flows[0].call_at);
  assert.equal(s.moved.at(-1).p_new, '2026-11-01');
  assert.equal(s.notifies().length, 0);
});

/* ---------- whole-branch review (final-findings.md) ---------- */
test('C1: Google skipped, an address on another person\'s roster profile is refused by name, and nothing changes', async () => {
  const s = await setup();
  const before = s.snapshot();
  const r = await s.start({ wa_email: 'sam.lee@welfareavenue.com', skip: ['google'] });
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'address_taken');
  assert.match(r.body.message, /Sam Lee/);
  assert.deepEqual(s.snapshot(), before, 'no start date, no link, no plan on Sam');
  assert.equal(s.calWrites().length, 0);
});

test('C1: Google skipped, the address of the profile this card already matches is kept', async () => {
  const byId = await setup({ cand: { member_id: 2 } });
  assert.equal((await byId.start({ wa_email: 'sam.lee@welfareavenue.com', skip: ['google'] })).status, 200);
  assert.equal(byId.flow().wa_email, 'sam.lee@welfareavenue.com');
  const byMail = await setup({ cand: { email: 'Sam.Lee@welfareavenue.com' } });
  assert.equal((await byMail.start({ wa_email: 'sam.lee@welfareavenue.com', skip: ['google'] })).status, 200);
  assert.equal(byMail.flow().wa_email, 'sam.lee@welfareavenue.com');
  assert.equal(byMail.cand().member_id, 2);
});

test('C1: Google skipped, a Workspace-only clash stores no address: the new profile and the invites keep to the personal one', async () => {
  const s = await setup();
  s.taken.add('alex.tremblay@welfareavenue.com');
  const r = await s.start({ skip: ['google'] });
  assert.equal(r.status, 200);
  assert.equal(s.flow().wa_email, null);
  const made = s.rows('team_members').find((m) => m.name === 'Alex Tremblay');
  assert.equal(made.email, 'alex@example.com');
  const invited = s.calWrites().flatMap((e) => (e.body.attendees || []).map((a) => a.email));
  assert.ok(invited.length && !invited.includes('alex.tremblay@welfareavenue.com'), 'that mailbox gets no invite');
});

test('C1: the preview names the person on the roster and does not offer skipping as the way out', async () => {
  const s = await setup();
  const p = (await s.post({ action: 'preview', flow_id: 21, wa_email: 'sam.lee@welfareavenue.com' })).body;
  assert.equal(p.address_taken, true);
  assert.equal(p.address_owner, 'Sam Lee');
  assert.equal(p.address_own, false);
  const w = p.warnings.find((x) => /sam\.lee@/.test(x));
  assert.match(w, /Sam Lee/);
  assert.doesNotMatch(w, /skip/i);
  s.taken.add('alex.tremblay@welfareavenue.com');
  const q = (await s.post({ action: 'preview', flow_id: 21 })).body;
  assert.equal(q.address_owner, null);
  assert.match(q.warnings.find((x) => /already in use/.test(x)), /stores no address/);
  const own = await setup({ cand: { member_id: 2 } });
  assert.equal((await own.post({ action: 'preview', flow_id: 21, wa_email: 'sam.lee@welfareavenue.com' })).body.address_own, true);
});

test('I1: Start refuses a closed card, in a plain sentence, and writes nothing', async () => {
  for (const status of ['withdrawn', 'declined']) {
    const s = await setup({ cand: { status } });
    const before = s.snapshot();
    const r = await s.start();
    assert.equal(r.status, 409, status);
    assert.equal(r.body.error, 'card_closed');
    assert.match(r.body.message, /closed/);
    assert.deepEqual(s.snapshot(), before);
    assert.equal(s.calWrites().length, 0);
  }
});

test('I1: They backed out works on waiting and ready flows: no events, the card is withdrawn, nothing to take out', async () => {
  for (const status of ['waiting', 'ready']) {
    const s = await setup({ fl: { status } });
    const r = await s.post({ action: 'backed_out', flow_id: 21, reason: 'Took another job' });
    assert.equal(r.status, 200, status);
    assert.deepEqual(r.body.remove, []);
    assert.equal(s.flow().status, 'backed_out');
    assert.equal(s.cand().status, 'withdrawn');
    assert.equal(s.cand().close_reason, 'Backed out after accepting: Took another job');
    assert.equal(s.rig.fetchLog.length, 0, 'nothing to cancel, so Google is not asked');
  }
});

test('I4: set_manager saves the manager on a waiting or ready flow, and refuses an inactive one or a flow already started', async () => {
  for (const status of ['waiting', 'ready']) {
    const s = await setup({ fl: { status } });
    const r = await s.post({ action: 'set_manager', flow_id: 21, member_id: 1 });
    assert.equal(r.status, 200, status);
    assert.equal(r.body.ok, true);
    assert.equal(s.flow().manager_member_id, 1);
    assert.equal(s.rig.fetchLog.length, 0, 'the hourly job tells them, not this');
  }
  const off = await setup({ tables: { team_members: [...TEAM, { id: 3, name: 'Gone Person', email: 'gone@welfareavenue.com', active: false }] } });
  const r = await off.post({ action: 'set_manager', flow_id: 21, member_id: 3 });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /Gone Person/);
  assert.equal(off.flow().manager_member_id, null);
  const none = await setup();
  assert.equal((await none.post({ action: 'set_manager', flow_id: 21, member_id: 99 })).status, 400);
  for (const status of ['running', 'started', 'backed_out']) {
    const late = await setup({ fl: { status } });
    assert.equal((await late.post({ action: 'set_manager', flow_id: 21, member_id: 1 })).status, 409, status);
    assert.equal(late.flow().manager_member_id, null);
  }
});

const GRIDS = () => ({ hub_onboard_grids: [{ flow_id: 21, who: 'hire', slots: ['2026-10-25T14:00:00Z'] }, { flow_id: 21, who: 'manager', slots: ['2026-10-26T14:00:00Z'] }] });
const gridOf = (s, who) => s.rows('hub_onboard_grids').find((g) => g.who === who).slots;
test('I5: at set_manager, a manager other than the one who got the link starts with a clean grid and a fresh reminder', async () => {
  const s = await setup({ fl: { manager_link_member_id: 2, manager_link_sent_at: NOW, reminded_manager_at: NOW }, tables: GRIDS() });
  assert.equal((await s.post({ action: 'set_manager', flow_id: 21, member_id: 2 })).body.cleared, false);
  assert.equal(gridOf(s, 'manager').length, 1, 'the same manager keeps their marks');
  assert.equal(s.flow().reminded_manager_at, NOW);
  const r = await s.post({ action: 'set_manager', flow_id: 21, member_id: 1 });
  assert.equal(r.body.cleared, true);
  assert.deepEqual(gridOf(s, 'manager'), []);
  assert.equal(gridOf(s, 'hire').length, 1, 'the hire keeps theirs');
  assert.equal(s.flow().reminded_manager_at, null);
  assert.equal(s.flow().manager_link_member_id, 2, 'the hourly job sees the difference and sends the new link');
});

test('I5: at Start too, and the same manager keeps their marks', async () => {
  const s = await setup({ fl: { manager_link_member_id: 2, manager_link_sent_at: NOW, reminded_manager_at: NOW }, tables: GRIDS() });
  assert.equal((await s.start({ manager_member_id: 1 })).status, 200);
  assert.deepEqual(gridOf(s, 'manager'), []);
  assert.equal(s.flow().reminded_manager_at, null);
  const same = await setup({ fl: { manager_link_member_id: 2, manager_link_sent_at: NOW, reminded_manager_at: NOW }, tables: GRIDS() });
  assert.equal((await same.start({ manager_member_id: 2 })).status, 200);
  assert.equal(gridOf(same, 'manager').length, 1);
  assert.equal(same.flow().reminded_manager_at, NOW);
});

test('I4: a practice flow writes only its flow row at set_manager', async () => {
  const s = await setup({ cand: { practice: true }, fl: { manager_link_member_id: 2 }, tables: GRIDS() });
  const before = s.snapshot();
  const r = await s.post({ action: 'set_manager', flow_id: 21, member_id: 1 });
  assert.equal(r.status, 200);
  assert.equal(r.body.practice, true);
  assert.equal(s.flow().manager_member_id, 1);
  const after = s.snapshot();
  delete before.hub_onboard_flows; delete after.hub_onboard_flows;
  assert.deepEqual(after, before);
});

test('D4: a person who backs out during a run stops it: the steps not begun end skipped, with a sentence', async () => {
  const s = await setup();
  s.db.on('hub_onboard_steps', 'update', (n, _o, db) => { if (n.step === 'roster' && n.status === 'done') db.rows('hub_onboard_flows')[0].status = 'backed_out'; });
  assert.equal((await s.start()).status, 200);
  assert.equal(s.step('roster').status, 'done');
  for (const k of KEYS.slice(1)) { assert.equal(s.step(k).status, 'skipped', k); assert.match(s.step(k).detail, /backed out/); }
  assert.equal(s.calWrites().length + s.notifies().length, 0);
  assert.equal(s.assigned.length, 0);
  assert.equal(s.flow().status, 'backed_out');
});

test('D5: the new manager hears about the invite only if it exists', async () => {
  const s = await started();
  await s.post({ action: 'change_manager', flow_id: 21, member_id: 1 });
  assert.match(s.notifies().find((e) => e.body.tag.startsWith('onboard-manager-new')).body.body, /The invite is in your calendar\./);
  assert.match(s.notifies().find((e) => e.body.tag.startsWith('onboard-manager-old')).body.body, /cancelled/);
  const f = await started();
  Object.assign(f.flow(), { one_on_one_event_id: null });
  f.calReset();
  await f.post({ action: 'change_manager', flow_id: 21, member_id: 1 });
  const body = f.notifies().find((e) => e.body.tag.startsWith('onboard-manager-new')).body.body;
  assert.doesNotMatch(body, /in your calendar/);
  assert.match(body, /has not gone out yet/);
  assert.doesNotMatch(f.notifies().find((e) => e.body.tag.startsWith('onboard-manager-old')).body.body, /cancelled/);
  const t = await started();
  Object.assign(t.flow(), { one_on_one_event_id: null });
  t.calReset();
  await t.post({ action: 'change_time', flow_id: 21, which: 'one_on_one', at: NEW_ONE });
  assert.doesNotMatch(t.notifies()[0].body.body, /The invite is updated/);
});

test('M2: the back-out list says created or already on the roster', async () => {
  const made = await started();
  assert.equal(made.flow().roster_created, true);
  const a = await made.post({ action: 'backed_out', flow_id: 21, reason: '' });
  assert.match(a.body.remove[0], /Created for this person/);
  assert.match(a.body.remove[0], /Deactivate it by hand in Roster\./);
  const linked = await started({ cand: { member_id: 2 } });
  assert.equal(linked.flow().roster_created, false);
  const b = await linked.post({ action: 'backed_out', flow_id: 21, reason: '' });
  assert.match(b.body.remove[0], /Already on the roster before/);
  assert.match(b.body.remove[0], /check whether it should stay/i);
  assert.doesNotMatch(b.body.remove[0], /Deactivate/);
});

test('M2: a retry that finds the profile an earlier try made still counts it as created', async () => {
  const s = await setup();
  s.db.failOn('hub_candidates', 'update', 'the database said no');
  await s.start();
  assert.equal(s.step('roster').status, 'failed');
  assert.equal(s.flow().roster_created, true);
  await s.post({ action: 'retry', flow_id: 21, step: 'roster' });
  assert.equal(s.step('roster').status, 'done');
  assert.equal(s.flow().roster_created, true);
});

test('M3: change_time sets the moved event back to confirmed', async () => {
  const s = await started();
  s.calReset();
  await s.post({ action: 'change_time', flow_id: 21, which: 'call', at: NEW_CALL });
  assert.equal(s.calWrites()[0].body.status, 'confirmed');
});

test('M4: the preview gives the department, and warns when it is blank', async () => {
  const s = await setup();
  const p = (await s.post({ action: 'preview', flow_id: 21 })).body;
  assert.equal(p.department, 'progdev');
  assert.ok(!p.warnings.some((w) => /department/i.test(w)));
  const none = await setup({ tables: { hub_positions: [{ id: 5, title: 'Program Coordinator', dept: null, jd_url: 'https://docs.example.com/jd' }] } });
  const q = (await none.post({ action: 'preview', flow_id: 21 })).body;
  assert.equal(q.department, null);
  assert.ok(q.warnings.some((w) => /no department/i.test(w)));
});

test('M6: google_manual on a practice flow simulates: no Google token, no roster write', async () => {
  const s = await setup({ cand: { practice: true } });
  await s.start({ skip: ['google'] });
  assert.equal(s.step('google').status, 'skipped');
  const team = structuredClone(s.rows('team_members'));
  s.rig.fetchLog.length = 0;
  const r = await s.post({ action: 'google_manual', flow_id: 21, wa_email: 'alex.tremblay@welfareavenue.com' });
  assert.equal(r.status, 200);
  assert.equal(s.step('google').status, 'done');
  assert.match(s.step('google').detail, /Practice/);
  assert.deepEqual(s.rows('team_members'), team);
  assert.equal(s.rig.fetchLog.length, 0, 'no fetch at all');
  assert.equal(s.flow().wa_email, 'alex.tremblay@welfareavenue.com');
});

test('M7: a flow and a card that disagree about practice are refused', async () => {
  const a = await setup({ cand: { practice: true }, fl: { practice: false } });
  const before = a.snapshot();
  const r = await a.start();
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'practice_mismatch');
  assert.match(r.body.message, /practice/);
  assert.deepEqual(a.snapshot(), before);
  const b = await setup({ cand: { practice: false }, fl: { practice: true } });
  assert.equal((await b.start()).body.error, 'practice_mismatch');
});

test('M9: a quote in a name reaches Slack as a quote', async () => {
  const s = await setup({ cand: { name: 'Alex "Lex" Tremblay & Co' } });
  await s.start({ wa_email: 'alex.co@welfareavenue.com' });
  const text = s.notifies().find((e) => e.body.event === 'onboard_date').body.text;
  assert.match(text, /Alex "Lex" Tremblay &amp; Co/);
  assert.doesNotMatch(text, /&quot;/);
});

/* TEMPLATE: the SOP's Onboarding Email. The text is kept with its [brackets] and filled in when it is read (action welcome). */
const HR_ROW = { id: 7, name: 'Hana Rossi', email: 'hr.person@welfareavenue.com', active: true };
const numbers = (text) => text.split('\n').filter((l) => /^\d+\. /.test(l)).map((l) => l.split('.')[0]).join('');
const readWelcome = async (s) => { const r = await s.post({ action: 'welcome', flow_id: 21 }); assert.equal(r.status, 200); return r.body; };
test('TEMPLATE: after Start the Hub\'s own text reads with the real values, in the SOP\'s order, and nothing of it is saved', async () => {
  const s = await setup({ config: { onboard_slack_join_link: 'https://join.slack.example/x', onboard_google_video: 'https://video.example/g' }, tables: { team_members: [...TEAM, HR_ROW] } });
  assert.equal((await s.start({ group_session: 'November 12', canva_link: 'https://www.canva.com/brand/join?token=a' })).status, 200);
  assert.equal(s.flow().welcome_edited, false);
  assert.equal(s.flow().welcome_subject, null, 'the Hub\'s own text is not saved, so it follows the template');
  assert.equal(s.flow().welcome_text, null);
  const before = s.snapshot();
  const w = await readWelcome(s), t = w.text;
  assert.deepEqual(s.snapshot(), before, 'reading writes nothing');
  assert.equal(w.edited, false);
  assert.equal(w.subject, 'Welcome to Welfare Avenue! Your Next Steps');
  assert.ok(t.startsWith('Dear Alex,\n\nCongratulations and welcome to the team at Welfare Avenue!\nWe\'re excited you\'ve accepted the Program Coordinator role within our organization.'), t);
  assert.match(t, /Your first day is Sunday, November 1, 2026, and we can't wait/, 'the Toronto date of the call, in words');
  assert.match(t, /Your onboarding call: Sunday, November 1, 2026.*10:30.*\. The invite is in your calendar\./);
  assert.match(t, /with your manager, Sam Lee: Tuesday, November 3, 2026/);
  assert.match(t, /group onboarding session with Sam Lee on November 12\. If you can't make it, let us know\. This step is crucial\./);
  assert.match(t, /Email: alex\.tremblay@welfareavenue\.com\. We'll share your first password with you one to one\./);
  assert.match(t, /This video shows you how: https:\/\/video\.example\/g/);
  assert.match(t, /3\. Join your Slack workspace with your new Welfare Avenue email: https:\/\/join\.slack\.example\/x/);
  assert.match(t, /4\. Join our Canva team: https:\/\/www\.canva\.com\/brand\/join\?token=a/);
  assert.match(t, /5\. Sign the Contract\. Sent via DocuSign to your personal email\./);
  assert.match(t, /6\. Review your job description.*: https:\/\/docs\.example\.com\/jd/);
  assert.ok(t.endsWith('Looking forward to seeing all the great work you\'ll do with us!\nHana Rossi'), t);
  assert.equal(numbers(t), '123456');
  assert.doesNotMatch(t, /\[|—|\bAI\b/, 'no marked place left, Hub words only');
});

test('TEMPLATE: optional lines are left out and the steps renumber; no role reads as a sentence of its own', async () => {
  const s = await setup({ cand: { role: '' }, tables: { hub_positions: [{ id: 5, title: 'Program Coordinator', dept: 'progdev', jd_url: null }] } });
  await s.start({ one_on_one_at: null });
  const t = (await readWelcome(s)).text;
  assert.equal(numbers(t), '12345', 'no Canva link: one step fewer');
  assert.doesNotMatch(t, /Canva/);
  assert.doesNotMatch(t, /group onboarding session/);
  assert.doesNotMatch(t, /video/i);
  assert.match(t, /We're excited you've accepted our offer\./);
  assert.match(t, /Sam Lee: we'll confirm the time soon\./);
  assert.match(t, /https:\/\/welfareavenue\.slack\.com/, 'the Slack default');
  assert.match(t, /4\. Sign the Contract/);
  assert.match(t, /5\. Review your job description and prepare questions to ask about it with your director\./, 'no link, and the line stays');
  assert.match(t, /\nThe Welfare Avenue team$/, 'an HR person not on the roster: the team signs');
});

test('TEMPLATE: French, in the same order, with the French role name and natural wording', async () => {
  const s = await setup({ cand: { role: 'Operations Manager', summary: 'Français' }, tables: { team_members: [...TEAM, HR_ROW] } });
  await s.start({ group_session: '12 novembre', canva_link: 'https://www.canva.com/x' });
  const w = await readWelcome(s), t = w.text;
  assert.equal(w.subject, 'Bienvenue chez Welfare Avenue! Vos prochaines étapes');
  assert.ok(t.startsWith('Bonjour Alex,\n\nFélicitations et bienvenue dans l\'équipe de Welfare Avenue!'), t);
  assert.match(t, /accepté le poste de Gestionnaire des opérations au sein/, 'ROLE_FR, as on the /o/ page');
  assert.match(t, /Votre premier jour est le dimanche 1er novembre 2026,/, '1er for the first of the month');
  assert.match(t, /Votre appel d'accueil : dimanche 1er novembre 2026 à 22 h 30\./);
  assert.match(t, /avec votre gestionnaire, Sam Lee : mardi 3 novembre 2026 à /);
  assert.match(t, /avec Sam Lee, le 12 novembre\. Si vous ne pouvez pas y être, dites-le-nous\./);
  assert.match(t, /Adresse courriel : alex\.tremblay@welfareavenue\.com\. Nous vous transmettrons votre premier mot de passe en privé\. Vous le changerez lors de votre première connexion\./);
  assert.match(t, /avec votre nouvelle adresse courriel Welfare Avenue : /);
  assert.match(t, /4\. Joignez-vous à notre équipe Canva : https:\/\/www\.canva\.com\/x/);
  assert.match(t, /5\. Signez le contrat\. Il vous est envoyé par DocuSign à votre adresse courriel personnelle\./);
  assert.match(t, /pour que votre intégration se déroule en douceur, dans un climat accueillant\./);
  assert.doesNotMatch(t, /individuellement|poste de proposé/);
  assert.equal(numbers(t), '123456');
  assert.doesNotMatch(t, /\[|—/);
  const n = await setup({ cand: { role: '', summary: 'Français' } });
  await n.start({ one_on_one_at: null });
  const u = (await readWelcome(n)).text;
  assert.match(u, /Nous sommes ravis que vous ayez accepté notre offre\./, 'no role: a sentence of its own');
  assert.equal(numbers(u), '12345');
  assert.match(u, /nous vous confirmerons l'heure bientôt/);
  assert.match(u, /L'équipe de Welfare Avenue$/);
});

test('TEMPLATE: with no manager on the roster, it says "your manager" once, in both languages', async () => {
  for (const [cand, once, twice] of [[{}, /with your manager: /, /your manager, your manager/], [{ summary: 'Français' }, /avec votre gestionnaire : /, /votre gestionnaire, votre gestionnaire/]]) {
    const s = await setup({ cand });
    await s.start();
    s.rows('team_members').splice(s.rows('team_members').findIndex((m) => m.id === 2), 1);   // the manager's row is gone
    const t = (await readWelcome(s)).text;
    assert.match(t, once);
    assert.doesNotMatch(t, twice);
  }
});

test('TEMPLATE: the preview says what fills in at Start, and writes nothing', async () => {
  const s = await setup();
  const before = s.snapshot();
  const { welcome: w } = (await s.post({ action: 'preview', flow_id: 21 })).body;
  assert.match(w.text, /Your first day is \[first day: fills in at Start\]/);
  assert.match(w.text, /\[Canva link: fills in at Start, or this line is left out\]/);
  assert.equal(numbers(w.text), '123456');
  assert.deepEqual(s.snapshot(), before);
  const fr = await setup({ cand: { summary: 'Français' } });
  assert.match((await fr.post({ action: 'preview', flow_id: 21 })).body.welcome.text, /\[premier jour : rempli au démarrage\]/);
});

test('TEMPLATE: no password goes in the text, even with a password nonce on the flow', async () => {
  const s = await setup({ fl: { pw_nonce: 'SECRETNONCE', pw_expires_at: '2026-12-01T00:00:00Z' } });
  await s.start();
  const t = (await readWelcome(s)).text;
  assert.doesNotMatch(t, /SECRETNONCE|\/o\//);
  assert.equal(t.split('\n').filter((l) => /password/i.test(l)).length, 1, 'only the sentence saying HR shares it');
  assert.match(t, /We'll share your first password with you one to one\. You'll change it the first time you sign in\./);
});

test('TEMPLATE: HR\'s edits are saved with their brackets, and read with the NEW time after change_time, their own sentences kept', async () => {
  const s = await setup();
  const p = (await s.post({ action: 'preview', flow_id: 21 })).body.welcome;
  const text = 'My own opening, just for Alex.\n' + p.text;
  await s.start({ one_on_one_at: null, welcome: { subject: 'My subject', text } });
  const f = s.flow();
  assert.equal(f.welcome_edited, true);
  assert.equal(f.welcome_subject, 'My subject');
  assert.equal(f.welcome_text, text, 'saved as typed, brackets and all');
  let w = await readWelcome(s);
  assert.equal(w.edited, true);
  assert.equal(w.subject, 'My subject');
  assert.ok(w.text.startsWith('My own opening, just for Alex.\nDear Alex,'));
  assert.match(w.text, /Your first day is Sunday, November 1, 2026/);
  assert.doesNotMatch(w.text, /\[/);
  assert.equal(numbers(w.text), '12345', 'empty Canva and group lines go from an edited text too');
  await s.post({ action: 'change_time', flow_id: 21, which: 'call', at: NEW_CALL });
  w = await readWelcome(s);
  assert.ok(w.text.startsWith('My own opening, just for Alex.\n'), 'their sentence is kept');
  assert.match(w.text, /Your first day is Wednesday, November 4, 2026/, 'the NEW call date');
  assert.match(w.text, /Your onboarding call: Wednesday, November 4, 2026.*9:30/);
  assert.doesNotMatch(w.text, /November 1, 2026/, 'nothing of the old date is left');
  await s.post({ action: 'book_one_on_one', flow_id: 21, at: NEW_ONE });
  await s.post({ action: 'change_manager', flow_id: 21, member_id: 1 });
  w = await readWelcome(s);
  assert.match(w.text, /with your manager, Ruth Owen: Thursday, November 5, 2026/);
  assert.doesNotMatch(w.text, /we'll confirm the time soon|Sam Lee/);
  assert.equal(s.flow().welcome_text, text, 'what HR typed is never rewritten');
});

test('TEMPLATE: a Canva link added after Start appears in HR\'s edited text, and goes again when it is cleared', async () => {
  const s = await setup();
  const p = (await s.post({ action: 'preview', flow_id: 21 })).body.welcome;
  await s.start({ welcome: { subject: p.subject, text: p.text.replace('Dear Alex,', 'Hello Alex!') } });
  let t = (await readWelcome(s)).text;
  assert.doesNotMatch(t, /Canva/);
  assert.equal(numbers(t), '12345');
  await s.post({ action: 'set_canva_link', flow_id: 21, link: 'https://www.canva.com/new' });
  t = (await readWelcome(s)).text;
  assert.match(t, /^Hello Alex!/);
  assert.match(t, /4\. Join our Canva team: https:\/\/www\.canva\.com\/new/);
  assert.equal(numbers(t), '123456');
  await s.post({ action: 'set_canva_link', flow_id: 21, link: '' });
  assert.doesNotMatch((await readWelcome(s)).text, /Canva/);
});

test('TEMPLATE: a subject-only edit keeps the subject and leaves the body the Hub\'s own, so it follows changes', async () => {
  const s = await setup();
  const p = (await s.post({ action: 'preview', flow_id: 21 })).body.welcome;
  await s.start({ welcome: { subject: 'Welcome aboard, Alex', text: p.text } });
  assert.equal(s.flow().welcome_subject, 'Welcome aboard, Alex');
  assert.equal(s.flow().welcome_text, null, 'an unchanged body is not saved');
  assert.equal(s.flow().welcome_edited, true);
  await s.post({ action: 'change_time', flow_id: 21, which: 'call', at: NEW_CALL });
  const w = await readWelcome(s);
  assert.equal(w.subject, 'Welcome aboard, Alex');
  assert.match(w.text, /Your first day is Wednesday, November 4, 2026/);
});

test('TEMPLATE: the Hub\'s own text follows a change of time, 1-on-1, manager and Canva link', async () => {
  const s = await started({}, { one_on_one_at: null });
  assert.match((await readWelcome(s)).text, /we'll confirm the time soon/);
  await s.post({ action: 'change_time', flow_id: 21, which: 'call', at: NEW_CALL });
  assert.match((await readWelcome(s)).text, /Your first day is Wednesday, November 4, 2026/);
  await s.post({ action: 'book_one_on_one', flow_id: 21, at: NEW_ONE });
  assert.match((await readWelcome(s)).text, /Sam Lee: Thursday, November 5, 2026/);
  await s.post({ action: 'change_manager', flow_id: 21, member_id: 1 });
  assert.match((await readWelcome(s)).text, /with your manager, Ruth Owen: /);
  await s.post({ action: 'set_canva_link', flow_id: 21, link: 'https://www.canva.com/new' });
  const t = (await readWelcome(s)).text;
  assert.match(t, /Join our Canva team: https:\/\/www\.canva\.com\/new/);
  assert.equal(numbers(t), '123456');
});

test('TEMPLATE: a practice flow reads the same, and writes nothing to read it', async () => {
  const s = await setup({ cand: { practice: true } });
  await s.start();
  const before = s.snapshot();
  s.rig.fetchLog.length = 0;
  assert.match((await readWelcome(s)).text, /Your first day is Sunday, November 1, 2026/);
  assert.deepEqual(s.snapshot(), before);
  assert.equal(s.rig.fetchLog.length, 0);
});

test('C1: a roster that cannot be read stops Start: it never lets an address through', async () => {
  for (const skip of [[], ['google']]) {
    const s = await setup();
    s.db.failOn('team_members', 'select', 'the database is resting', 1);   // the manager reads; the address check does not
    const before = s.snapshot();
    const r = await s.start({ wa_email: 'sam.lee@welfareavenue.com', skip });
    assert.equal(r.status, 503, JSON.stringify(skip));
    assert.equal(r.body.error, 'roster_check');
    assert.equal(r.body.message, 'The Hub could not check the roster. Try again.');
    assert.deepEqual(s.snapshot(), before);
  }
});

test('backed_out logs whether the flow had started', async () => {
  const before = await setup();
  await before.post({ action: 'backed_out', flow_id: 21, reason: '' });
  assert.ok(before.rows('change_log').some((r) => r.new_value === 'withdrawn (backed out before Start onboarding)'));
  const after = await started();
  await after.post({ action: 'backed_out', flow_id: 21, reason: '' });
  assert.ok(after.rows('change_log').some((r) => r.new_value === 'withdrawn (backed out after Start onboarding)'));
});

const CANVA = 'https://www.canva.com/brand/join?token=abc123';
test('CANVA: Start saves a good link, allows none, and refuses anything else with nothing written', async () => {
  const good = await setup();
  assert.equal((await good.start({ canva_link: '  ' + CANVA + ' ' })).status, 200);
  assert.equal(good.flow().canva_link, CANVA);
  const none = await setup();
  assert.equal((await none.start({ canva_link: '' })).status, 200);
  assert.equal(none.flow().canva_link, null);
  const left = await setup();
  assert.equal((await left.start()).status, 200, 'the field left out is empty too');
  assert.equal(left.flow().canva_link, null);
  for (const bad of ['http://www.canva.com/x', 'https://www.canva.com.evil.example/x', 'https://evil.example/https://www.canva.com/', 'canva.com/x', 'https://www.canva.com/a b']) {
    const s = await setup();
    const before = s.snapshot();
    const r = await s.start({ canva_link: bad });
    assert.equal(r.status, 400, bad);
    assert.equal(r.body.error, 'bad_canva_link');
    assert.match(r.body.message, /https:\/\/www\.canva\.com\//);
    assert.deepEqual(s.snapshot(), before);
    assert.equal(s.rig.fetchLog.length, 0);
  }
});

test('CANVA: the preview gives the saved link', async () => {
  const s = await setup({ fl: { canva_link: CANVA } });
  assert.equal((await s.post({ action: 'preview', flow_id: 21 })).body.canva_link, CANVA);
  const n = await setup();
  assert.equal((await n.post({ action: 'preview', flow_id: 21 })).body.canva_link, null);
});

test('CANVA: set_canva_link saves, replaces and clears on any flow that has not backed out, with the same check', async () => {
  for (const status of ['waiting', 'ready', 'running', 'started']) {
    const s = await setup({ fl: { status } });
    const r = await s.post({ action: 'set_canva_link', flow_id: 21, link: CANVA });
    assert.equal(r.status, 200, status);
    assert.equal(r.body.canva_link, CANVA);
    assert.equal(s.flow().canva_link, CANVA);
    assert.equal((await s.post({ action: 'set_canva_link', flow_id: 21, link: CANVA + 'new' })).status, 200);
    assert.equal(s.flow().canva_link, CANVA + 'new');
    const bad = await s.post({ action: 'set_canva_link', flow_id: 21, link: 'https://evil.example/' });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error, 'bad_canva_link');
    assert.equal(s.flow().canva_link, CANVA + 'new', 'a refusal keeps the saved link');
    assert.equal((await s.post({ action: 'set_canva_link', flow_id: 21, link: '' })).status, 200);
    assert.equal(s.flow().canva_link, null);
    assert.equal(s.rig.fetchLog.length, 0);
  }
  const out = await setup({ fl: { status: 'backed_out' } });
  const r = await out.post({ action: 'set_canva_link', flow_id: 21, link: CANVA });
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'backed_out');
  assert.equal(out.flow().canva_link, undefined);
  assert.equal((await out.post({ action: 'set_canva_link', flow_id: 999, link: CANVA })).status, 404);
});

test('CANVA: a practice flow writes only its own flow row, and nothing goes outside', async () => {
  const s = await setup({ cand: { practice: true } });
  await s.start({ canva_link: CANVA });
  assert.equal(s.flow().canva_link, CANVA);
  const before = s.snapshot();
  s.rig.fetchLog.length = 0;
  assert.equal((await s.post({ action: 'set_canva_link', flow_id: 21, link: CANVA + '2' })).status, 200);
  assert.equal(s.flow().canva_link, CANVA + '2');
  const after = s.snapshot();
  delete before.hub_onboard_flows; delete after.hub_onboard_flows;
  assert.deepEqual(after, before);
  assert.equal(s.rig.fetchLog.length, 0);
});

test('M10: task_done marks a step left to HR as done, with who did it, and ticks its checklist', async () => {
  const s = await started();
  assert.equal(s.step('welcome').status, 'hr_task');
  const r = await s.post({ action: 'task_done', flow_id: 21, step: 'welcome' });
  assert.equal(r.status, 200);
  assert.equal(s.step('welcome').status, 'done');
  assert.equal(s.step('welcome').by, 'hr.person@welfareavenue.com');
  assert.match(s.step('welcome').detail, /hr\.person@welfareavenue\.com/);
  assert.equal(s.rows('hr_setup_steps').find((x) => x.template_id === 'hrb1').done, true);
  assert.ok(r.body.steps.some((x) => x.step === 'welcome' && x.status === 'done'));
  const again = await s.post({ action: 'task_done', flow_id: 21, step: 'welcome' });
  assert.equal(again.status, 409);
  const g = await s.post({ action: 'task_done', flow_id: 21, step: 'google' });
  assert.equal(g.status, 400);
  assert.match(g.body.message, /I created it, continue/);
  assert.equal(s.step('google').status, 'hr_task');
  assert.equal((await s.post({ action: 'task_done', flow_id: 21, step: 'nope' })).status, 400);
  const fresh = await setup();
  assert.equal((await fresh.post({ action: 'task_done', flow_id: 21, step: 'hub' })).status, 409);
  await s.post({ action: 'backed_out', flow_id: 21, reason: '' });
  assert.equal((await s.post({ action: 'task_done', flow_id: 21, step: 'hub' })).body.error, 'backed_out');
});

/* ---------- wave275 Task 2: propose {flow_id, call_at, one_on_one_at, by} and hire_times {flow_id} ---------- */
/* NOW is Tuesday 20/10/26, 08:00 in Toronto (UTC-4). Monday 26/10/26: the call at 10:00 (14:00Z), the 1-on-1 at 11:30 (15:30Z). */
const P_CALL = '2026-10-26T14:00:00.000Z', P_ONE = '2026-10-26T15:30:00.000Z', NOW_ISO = '2026-10-20T12:00:00.000Z';
const SECRET = { 'x-wa-secret': 'trigger-secret-for-tests' };
const SAM_AT = (availability) => [TEAM[0], { ...TEAM[1], availability, availability_at: '2026-10-19T12:00:00Z' }];
const noDash = (s) => !/—/.test(s) && !/\bAI\b/.test(s);
/* the stand-in for wa275_tick_set (build/wa275a_streamlined.sql 7a, proved in test/w275sql.sql): one key merged; p_if_unset writes only while the key is empty */
function tickSet(a, db) {
  const f = db.rows('hub_onboard_flows').find((r) => Number(r.id) === Number(a.p_flow));
  if (!f) return false;
  const cur = f.setup_ticks && typeof f.setup_ticks === 'object' ? f.setup_ticks : {};
  if (a.p_if_unset && cur[a.p_key] != null) return false;
  f.setup_ticks = { ...cur, [a.p_key]: a.p_value ?? null };
  return true;
}
async function w275({ cand, fl = {}, config = {}, tables, hr = true, admin = false, manager = false, flows = [], notifyReply } = {}) {
  const s = await setup({ cand, fl: { manager_member_id: 2, ...fl }, config: { hr_notify_emails: 'ruth.owen@welfareavenue.com', onboard_propose_lead_hours: '48', ...config }, tables, hr, admin, notifyReply });
  s.db.onRpc('wa275_manager_of', (a, _d, w) => { assert.ok(w.jwt, 'the manager check runs as the caller'); assert.equal(Number(a.p_flow), 21); return manager; });
  s.db.onRpc('wa275_tick_set', (a, db, w) => { assert.equal(w.jwt, null, 'ticks are set with the service key'); return tickSet(a, db); });
  for (const f of flows) s.db.rows('hub_onboard_flows').push(f);
  s.propose = (body = {}, headers) => s.post({ action: 'propose', flow_id: 21, call_at: P_CALL, one_on_one_at: P_ONE, ...body }, headers);
  s.asLink = (body = {}) => s.propose({ by: 'manager', ...body }, SECRET);
  return s;
}
const refused = (r, code, which) => {
  assert.equal(r.body.error, code, JSON.stringify(r.body));
  assert.ok(r.status >= 400, 'a refusal is not a 200');
  assert.ok(r.body.messages && r.body.messages.en && r.body.messages.fr, 'English and French');
  assert.equal(r.body.message, r.body.messages.en);
  assert.ok(noDash(r.body.messages.en + r.body.messages.fr));
  if (which) assert.equal(r.body.which, which);
};

test('w275 propose (HR): saves the proposal, tells HR with onboard_answer, and emails the hire who accepted their yes-or-no link', async () => {
  const s = await w275();
  const r = await s.propose();
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.proposal, { call_at: P_CALL, one_on_one_at: P_ONE, by: 'hr.person@welfareavenue.com', at: NOW_ISO });
  assert.equal(r.body.hire_emailed, true);
  assert.equal(r.body.repeated, false);
  const f = s.flow();
  assert.deepEqual([f.proposed_call_at, f.proposed_one_on_one_at, f.proposed_by, f.proposed_at], [P_CALL, P_ONE, 'hr.person@welfareavenue.com', NOW_ISO]);
  assert.equal(f.call_at, null, 'a proposal books nothing');
  const n = s.notifies();
  assert.equal(n.length, 1);
  assert.equal(n[0].body.event, 'onboard_answer');
  assert.deepEqual(n[0].body.to, ['ruth.owen@welfareavenue.com']);
  assert.equal(n[0].body.title, 'hr.person@welfareavenue.com proposed times for Alex Tremblay', 'HR proposing: the proposer is named (their roster name when they have one)');
  assert.match(n[0].body.text, /proposed times for \*Alex Tremblay\* \(Program Coordinator\): the onboarding call on Monday, October 26, 2026 at 10:00 a\.m\. and the 1-on-1 on Monday, October 26, 2026 at 11:30 a\.m\./);
  assert.equal(n[0].headers['x-wa-secret'], 'trigger-secret-for-tests');
  const g = s.gmail();
  assert.equal(g.length, 1, 'the hire is emailed once');
  const m = mail(g[0]);
  assert.equal(m.to, 'alex@example.com');
  assert.ok(m.bodies.every((b) => b.includes('https://hub.welfareavenue.com/o/' + expectedToken(11))), 'the offer link, which now asks yes or no');
  assert.ok(noDash(m.subject + m.bodies.join('')));
  assert.equal(f.setup_ticks.hire_times_at, NOW_ISO, 'recorded under setup_ticks.hire_times_at');
  assert.ok(s.rows('change_log').some((l) => l.entity_type === 'onboard_flow' && l.field === 'proposed_times' && l.changed_by === 'hr.person@welfareavenue.com'));
  assert.deepEqual(s.rig.unregistered(), []);
});

test('w275 propose: the mgr link relays with the trigger secret (by manager: the manager\'s roster email); a manager JWT gets in; anyone else is refused', async () => {
  const link = await w275({ hr: false });
  const r = await link.asLink();
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(link.flow().proposed_by, 'sam.lee@welfareavenue.com');
  assert.equal(r.body.proposal.by, 'sam.lee@welfareavenue.com');
  assert.equal(link.notifies()[0].body.title, 'Sam Lee proposed times for Alex Tremblay', 'the text the controller set: <manager> proposed times for <hire>');
  const wrong = await w275({ hr: false });
  assert.equal((await wrong.propose({ by: 'manager' }, { 'x-wa-secret': 'not-the-secret' })).status, 401, 'a wrong secret is as if there were none');
  const other = await w275({ hr: false, admin: false, manager: false });
  const before = other.snapshot();
  assert.equal((await other.propose()).status, 403);
  assert.deepEqual(other.snapshot(), before);
  assert.equal(other.rig.fetchLog.length, 0);
  const mgr = await w275({ hr: false, manager: true });
  mgr.db.setCaller({ email: 'Sam.Lee@welfareavenue.com' });
  const m = await mgr.propose({ by: 'someone.else@welfareavenue.com' });
  assert.equal(m.status, 200, JSON.stringify(m.body));
  assert.equal(mgr.flow().proposed_by, 'sam.lee@welfareavenue.com', 'with a JWT, by is the caller, whatever the body says');
  const admin = await w275({ hr: false, admin: true });
  assert.equal((await admin.propose()).status, 200);
});

test('w275 propose before the hire accepted: saved and HR told, but no email to the hire yet', async () => {
  const s = await w275({ cand: { accepted_on: null }, fl: { status: 'offered' } });
  const r = await s.asLink();
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.hire_emailed, false);
  assert.equal(s.gmail().length, 0);
  assert.equal(s.notifies().length, 1);
  assert.equal(s.flow().proposed_call_at, P_CALL);
  assert.equal(s.flow().setup_ticks.hire_times_at, null, 'nothing recorded for a mail that was not sent');
});

test('w275 propose: both times at least onboard_propose_lead_hours (48) ahead, else lead_time; nothing saved, nothing sent', async () => {
  for (const [body, which] of [[{ call_at: '2026-10-21T14:00:00Z' }, 'call'], [{ one_on_one_at: '2026-10-22T11:30:00Z' }, 'one_on_one']]) {
    const s = await w275();
    const before = s.snapshot();
    const r = await s.propose(body);
    refused(r, 'lead_time', which);
    assert.match(r.body.messages.en, /48 hours/);
    assert.deepEqual(s.snapshot(), before);
    assert.equal(s.rig.fetchLog.length, 0);
  }
  const ok = await w275();
  assert.equal((await ok.propose({ one_on_one_at: '2026-10-22T13:00:00Z' })).status, 200, 'Thursday 09:00 is 49 hours ahead');
  const short = await w275({ config: { onboard_propose_lead_hours: '24' } });
  assert.equal((await short.propose({ call_at: '2026-10-21T14:00:00Z' })).status, 200, 'the setting decides');
  const bad = await w275();
  refused(await bad.propose({ call_at: 'tomorrow' }), 'bad_time');
  refused(await bad.propose({ one_on_one_at: null }), 'bad_time');
});

test('w275 propose: each meeting\'s whole span inside one availability block for that Toronto weekday (Monday to Friday 9 to 5 when none is saved)', async () => {
  const sat = await w275();
  refused(await sat.propose({ call_at: '2026-10-24T14:00:00Z' }), 'outside_hours', 'call');
  const late = await w275();
  refused(await late.propose({ call_at: '2026-10-26T20:30:00Z' }), 'outside_hours', 'call');   // 16:30 to 17:30
  const early = await w275();
  refused(await early.propose({ one_on_one_at: '2026-10-26T12:45:00Z' }), 'outside_hours', 'one_on_one');   // 08:45
  const edges = await w275();
  assert.equal((await edges.propose({ call_at: '2026-10-26T20:00:00Z', one_on_one_at: '2026-10-26T13:00:00Z' })).status, 200, '16:00 to 17:00 and 09:00 to 09:30 touch the edges of 9 to 5');
  const split = await w275({ tables: { team_members: SAM_AT({ weekly: { mon: [['09:00', '10:30'], ['10:30', '12:00']] }, except: [], tz: 'America/Toronto' }) } });
  refused(await split.propose({ call_at: '2026-10-26T14:00:00Z', one_on_one_at: '2026-10-26T15:30:00Z' }), 'outside_hours', 'call');   // 10:00 to 11:00 crosses two blocks: not inside one
});

test('w275 propose: an except entry for the date replaces the weekday\'s blocks (empty: not available that day)', async () => {
  const av = { weekly: { mon: [['09:00', '17:00']], tue: [['09:00', '17:00']], sat: [['10:00', '11:30']] }, except: [{ date: '2026-10-26', free: [] }, { date: '2026-10-27', free: [['18:00', '21:00']] }], tz: 'America/Toronto' };
  const off = await w275({ tables: { team_members: SAM_AT(av) } });
  refused(await off.propose(), 'outside_hours', 'call');
  const evening = await w275({ tables: { team_members: SAM_AT(av) } });
  refused(await evening.propose({ call_at: '2026-10-27T14:00:00Z', one_on_one_at: '2026-10-27T23:00:00Z' }), 'outside_hours', 'call');   // 10:00 on a day whose except says 18:00 to 21:00
  const ok = await w275({ tables: { team_members: SAM_AT(av) } });
  assert.equal((await ok.propose({ call_at: '2026-10-27T22:00:00Z', one_on_one_at: '2026-10-28T00:00:00Z' })).status, 200, '18:00 and 20:00 on the except day');
  const satOk = await w275({ tables: { team_members: SAM_AT(av) } });
  assert.equal((await satOk.propose({ call_at: '2026-10-24T14:00:00Z', one_on_one_at: '2026-10-24T15:00:00Z' })).status, 200, 'a saved Saturday block');
});

test('w275 propose: no overlap with a hub@ meeting the manager is invited to (cancelled ones and other people\'s do not count)', async () => {
  const ev = (over) => ({ id: 'e1', summary: 'Board', attendee_emails: ['sam.lee@welfareavenue.com'], status: 'confirmed', start_at: '2026-10-26T14:30:00Z', end_at: '2026-10-26T15:00:00Z', ...over });
  const busy = await w275({ tables: { hub_events: [ev()] } });
  const before = busy.snapshot();
  refused(await busy.propose(), 'busy', 'call');
  assert.deepEqual(busy.snapshot(), before);
  const busyOne = await w275({ tables: { hub_events: [ev({ start_at: '2026-10-26T15:45:00Z', end_at: '2026-10-26T17:00:00Z' })] } });
  refused(await busyOne.propose(), 'busy', 'one_on_one');
  for (const e of [ev({ status: 'cancelled' }), ev({ attendee_emails: ['ruth.owen@welfareavenue.com'] }), ev({ start_at: '2026-10-26T15:00:00Z', end_at: '2026-10-26T15:30:00Z' })]) {
    const s = await w275({ tables: { hub_events: [e] } });
    assert.equal((await s.propose()).status, 200, JSON.stringify(e));
  }
});

test('w275 propose: a slot booked or proposed for another hire of the same manager is refused when proposed (taken)', async () => {
  const other = (over) => ({ id: 22, candidate_id: 12, practice: false, status: 'waiting', manager_member_id: 2, call_at: null, one_on_one_at: null, proposed_call_at: null, proposed_one_on_one_at: null, ...over });
  const cand12 = (over = {}) => ({ hub_candidates: [candidate(), candidate({ id: 12, name: 'Bo Chen', email: 'bo@example.com', ...over })] });
  const cases = [
    [{ proposed_call_at: '2026-10-26T15:30:00Z' }, 'one_on_one'],    // their proposed call 11:30 to 12:30 against our 1-on-1 at 11:30
    [{ call_at: '2026-10-26T13:30:00Z' }, 'call'],                   // their booked call 09:30 to 10:30 against our call at 10:00
    [{ proposed_one_on_one_at: '2026-10-26T14:45:00Z' }, 'call'],
    [{ one_on_one_at: '2026-10-26T15:45:00Z' }, 'one_on_one'],
  ];
  for (const [over, which] of cases) {
    const s = await w275({ tables: cand12(), flows: [other(over)] });
    refused(await s.propose(), 'taken', which);
    assert.equal(s.flow().proposed_at, undefined);
  }
  for (const [over, cand] of [[{ status: 'backed_out', proposed_call_at: P_CALL }, {}], [{ manager_member_id: 1, proposed_call_at: P_CALL }, {}], [{ proposed_call_at: P_CALL }, { status: 'declined' }], [{ proposed_call_at: '2026-10-26T15:00:00Z' }, { status: 'withdrawn' }]]) {
    const s = await w275({ tables: cand12(cand), flows: [other(over)] });
    assert.equal((await s.propose()).status, 200, JSON.stringify([over, cand]));
  }
});

test('w275 propose: the two meetings must not overlap each other (overlap)', async () => {
  const s = await w275();
  refused(await s.propose({ one_on_one_at: '2026-10-26T14:30:00Z' }), 'overlap');
  const touching = await w275();
  assert.equal((await touching.propose({ one_on_one_at: '2026-10-26T15:00:00Z' })).status, 200, 'the 1-on-1 straight after the call');
});

test('w275 propose: a flow already answered yes, or with the call booked, is refused (already_booked); a closed card or a backed-out flow too', async () => {
  for (const fl of [{ hire_answer: 'yes' }, { call_at: '2026-10-28T14:00:00Z' }]) {
    const s = await w275({ fl });
    const before = s.snapshot();
    refused(await s.asLink(), 'already_booked');
    assert.deepEqual(s.snapshot(), before);
    assert.equal(s.rig.fetchLog.length, 0);
  }
  refused(await (await w275({ cand: { status: 'declined' } })).propose(), 'closed');
  refused(await (await w275({ fl: { status: 'backed_out' } })).propose(), 'closed');
  const gone = await w275();
  assert.equal((await gone.propose({ flow_id: 99 })).status, 404);
  const none = await w275({ fl: { manager_member_id: null } });
  refused(await none.propose(), 'no_manager');
  const no = await w275({ fl: { hire_answer: 'no' } });
  assert.equal((await no.propose()).status, 200, 'after a no, new times can still be proposed');
});

test('w275 propose: a double press saves once, tells HR once and emails the hire once; the same times again are a repeat', async () => {
  const s = await w275();
  const both = await Promise.all([s.asLink(), s.asLink()]);
  assert.deepEqual(both.map((r) => r.status), [200, 200], JSON.stringify(both.map((r) => r.body)));
  assert.deepEqual(both.map((r) => r.body.repeated).sort(), [false, true]);
  assert.equal(s.notifies().length, 1);
  assert.equal(s.gmail().length, 1);
  assert.equal(s.rows('change_log').filter((l) => l.field === 'proposed_times').length, 1);
  const again = await s.asLink();
  assert.equal(again.body.repeated, true);
  assert.equal(s.gmail().length, 1);
  /* a change of mind, one press at a time (two requests at once share the rig's fixed clock only until the first one ends) */
  const c = await w275();
  assert.equal((await c.asLink()).body.repeated, false);
  c.rig.setNow('2026-10-20T13:00:00Z');
  const moved = await c.asLink({ one_on_one_at: '2026-10-26T18:00:00Z' });
  assert.equal(moved.body.repeated, false, JSON.stringify(moved.body));
  assert.deepEqual(moved.body.warnings, []);
  assert.equal(moved.body.hire_emailed, true);
  assert.equal(c.flow().proposed_one_on_one_at, '2026-10-26T18:00:00.000Z');
  assert.equal(c.notifies().length, 2, 'a change is told again');
  assert.equal(c.gmail().length, 2, 'and the hire gets the new times');
  assert.equal(c.flow().setup_ticks.hire_times_at, '2026-10-20T13:00:00.000Z');
  assert.equal(c.rows('change_log').filter((l) => l.field === 'proposed_times').length, 2);
});

test('w275 propose on a practice flow saves the proposal and makes no fetch of any kind', async () => {
  const s = await w275({ cand: { practice: true } });
  const r = await s.asLink();
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.practice, true);
  assert.equal(s.flow().proposed_call_at, P_CALL);
  assert.equal(s.rig.fetchLog.length, 0);
});

test('w275 propose: HR not reached, or the hire\'s email refused, leaves the proposal saved with a warning', async () => {
  const s = await w275({ notifyReply: () => ({ status: 500, json: { error: 'down' } }) });
  const r = await s.propose();
  assert.equal(r.status, 200);
  assert.equal(s.flow().proposed_call_at, P_CALL);
  assert.ok(r.body.warnings.some((w) => /HR was not told/.test(w)), JSON.stringify(r.body.warnings));
  const nohr = await w275({ config: { hr_notify_emails: '' } });
  const r2 = await nohr.propose();
  assert.equal(r2.status, 200);
  assert.ok(r2.body.warnings.some((w) => /hr_notify_emails/.test(w)), JSON.stringify(r2.body.warnings));
  const down = await w275({ config: { mail_mode: 'test', mail_test_recipients: '' } });   // test mode with no test inboxes: deliver refuses
  const r3 = await down.propose();
  assert.equal(r3.status, 200);
  assert.equal(r3.body.hire_emailed, false);
  assert.ok(r3.body.warnings.some((w) => /was not emailed/.test(w) && /test recipients/.test(w)), JSON.stringify(r3.body.warnings));
  assert.equal(down.flow().setup_ticks.hire_times_at, null, 'a mail that was not sent gives its claim back, so hire_times can try again');
  assert.equal(down.flow().proposed_call_at, P_CALL);
});

test('w275 hire_times {flow_id}: the secret only; emails the hire once per proposal; refuses with no proposal; a practice flow sends nothing', async () => {
  const s = await w275({ cand: { accepted_on: null }, fl: { status: 'offered' } });
  await s.asLink();
  assert.equal(s.gmail().length, 0);
  s.cand().accepted_on = '2026-10-20';
  const r = await s.post({ action: 'hire_times', flow_id: 21 }, SECRET);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.equal(s.gmail().length, 1);
  assert.equal(mail(s.gmail()[0]).to, 'alex@example.com');
  assert.equal(s.flow().setup_ticks.hire_times_at, NOW_ISO);
  const again = await s.post({ action: 'hire_times', flow_id: 21 }, SECRET);
  assert.equal(again.body.skipped, 'already_sent');
  assert.equal(s.gmail().length, 1);
  assert.equal((await s.post({ action: 'hire_times', flow_id: 21 })).status, 403, 'a signed-in person cannot');
  const none = await w275();
  const n = await none.post({ action: 'hire_times', flow_id: 21 }, SECRET);
  assert.equal(n.body.error, 'no_proposal');
  assert.equal(none.gmail().length, 0);
  const unaccepted = await w275({ cand: { accepted_on: null }, fl: { proposed_call_at: P_CALL, proposed_one_on_one_at: P_ONE, proposed_at: NOW_ISO } });
  assert.equal((await unaccepted.post({ action: 'hire_times', flow_id: 21 }, SECRET)).body.error, 'not_accepted');
  const practice = await w275({ cand: { practice: true }, fl: { proposed_call_at: P_CALL, proposed_one_on_one_at: P_ONE, proposed_at: NOW_ISO } });
  const p = await practice.post({ action: 'hire_times', flow_id: 21 }, SECRET);
  assert.equal(p.body.practice, true);
  assert.equal(practice.rig.fetchLog.length, 0);
});

/* ---------- wave275 Task 2, fix round 1 ---------- */
test('w275 fix: a proposal another hire has answered (hire_answer set) no longer counts as taken; their booked times still do', async () => {
  const other = (over) => ({ id: 22, candidate_id: 12, practice: false, status: 'waiting', manager_member_id: 2, call_at: null, one_on_one_at: null, proposed_call_at: '2026-10-26T14:30:00Z', proposed_one_on_one_at: null, hire_answer: null, ...over });
  const tables = { hub_candidates: [candidate(), candidate({ id: 12, name: 'Bo Chen', email: 'bo@example.com' })] };
  refused(await (await w275({ tables, flows: [other()] })).propose(), 'taken', 'call');
  assert.equal((await (await w275({ tables, flows: [other({ hire_answer: 'no' })] })).propose()).status, 200, 'a no: that proposal is dead');
  assert.equal((await (await w275({ tables, flows: [other({ hire_answer: 'yes' })] })).propose()).status, 200, 'a yes: the proposal itself is spent');
  refused(await (await w275({ tables, flows: [other({ hire_answer: 'yes', call_at: '2026-10-26T14:30:00Z' })] })).propose(), 'taken', 'call');
});

test('w275 fix: a hire who accepts while the proposal is being saved is still emailed (the card is read again after the claim)', async () => {
  const s = await w275({ cand: { accepted_on: null }, fl: { status: 'offered' } });
  s.db.on('hub_onboard_flows', 'update', (n, o, db) => { if (n.proposed_at && !o.proposed_at) db.rows('hub_candidates')[0].accepted_on = '2026-10-20'; });   // Accept lands between the read and the claim
  const r = await s.asLink();
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.hire_emailed, true);
  assert.equal(s.gmail().length, 1);
  assert.deepEqual(r.body.warnings, []);
  const quiet = await w275({ cand: { accepted_on: null }, fl: { status: 'offered' } });
  const q = await quiet.asLink();
  assert.deepEqual(q.body.warnings, [], 'not accepted yet is a quiet no, not a warning');
});

test('w275 fix: hire_times claims the send with wa275_tick_set, so two calls at once send once; other ticks are kept; a failed write is said', async () => {
  const s = await w275({ fl: { proposed_call_at: P_CALL, proposed_one_on_one_at: P_ONE, proposed_at: NOW_ISO, setup_ticks: { gmail: true } } });
  const both = await Promise.all([s.post({ action: 'hire_times', flow_id: 21 }, SECRET), s.post({ action: 'hire_times', flow_id: 21 }, SECRET)]);
  assert.deepEqual(both.map((r) => r.status), [200, 200]);
  assert.equal(s.gmail().length, 1, 'one email');
  assert.deepEqual(both.map((r) => r.body.skipped || 'sent').sort(), ['already_sent', 'sent']);
  assert.equal(s.flow().setup_ticks.gmail, true, 'merged: the hire\'s own tick stays');
  assert.ok(s.flow().setup_ticks.hire_times_at);
  const broken = await w275({ fl: { proposed_call_at: P_CALL, proposed_one_on_one_at: P_ONE, proposed_at: NOW_ISO } });
  broken.db.onRpc('wa275_tick_set', () => { throw new Error('permission denied for function wa275_tick_set'); });
  const h = await broken.post({ action: 'hire_times', flow_id: 21 }, SECRET);
  assert.equal(h.status, 500);
  assert.equal(h.body.error, 'tick_failed');
  assert.match(h.body.message, /could not be recorded, so nothing was sent \(permission denied/);
  assert.equal(broken.gmail().length, 0);
  const p = await broken.propose();
  assert.equal(p.status, 200, 'the proposal itself is saved');
  assert.ok(p.body.warnings.some((w) => /could not be cleared \(permission denied/.test(w)), JSON.stringify(p.body.warnings));
  assert.equal(broken.gmail().length, 0);
});

test('w275 fix: propose refuses a manager with no roster email (the hub@ check needs it) and an inactive manager', async () => {
  const noMail = await w275({ tables: { team_members: [TEAM[0], { ...TEAM[1], email: null }] } });
  const r = await noMail.propose();
  refused(r, 'manager_no_email');
  assert.match(r.body.messages.en, /^Sam Lee has no email on the roster, so the Hub cannot check their calendar\./);
  assert.equal(noMail.flow().proposed_at, undefined);
  const gone = await w275({ tables: { team_members: [TEAM[0], { ...TEAM[1], active: false }] } });
  const g = await gone.asLink();
  refused(g, 'manager_inactive');
  assert.match(g.body.messages.en, /^Sam Lee is no longer active/);
  assert.equal(gone.rig.fetchLog.length, 0);
});

test('w275 fix: a time without its zone (Z or +hh:mm) is bad_time; the same instant with an offset is fine', async () => {
  for (const body of [{ call_at: '2026-10-26T14:00:00' }, { one_on_one_at: '2026-10-26T15:30' }, { call_at: '2026-10-26' }]) {
    const s = await w275();
    refused(await s.propose(body), 'bad_time');
    assert.equal(s.flow().proposed_at, undefined);
  }
  const ok = await w275();
  const r = await ok.propose({ call_at: '2026-10-26T10:00:00-04:00', one_on_one_at: '2026-10-26T11:30:00.000-04:00' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(ok.flow().proposed_call_at, P_CALL);
});
