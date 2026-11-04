// wave271 Task 5: fn/onboard-run, proved offline on the in-memory rig (test/w271rig.mjs). Run: node --test test/w271run.test.mjs
// No live call of any kind: the database is a stub, and Google and notify are stubbed routes. Any other URL fails the call.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { loadFn, accessRoutes } from './w271rig.mjs';
import { availabilityOf, weekRows } from './w275avail.mjs';

const URL_ = 'https://stub.supabase.test/functions/v1/onboard-run';
const NOTIFY = 'https://stub.supabase.test/functions/v1/notify';
const NOW = '2026-10-20T12:00:00Z';
const CALL = '2026-11-02T03:30:00.000Z';      // 22:30 on 01/11/26 in Toronto: the UTC date is the wrong one
const ONE = '2026-11-03T15:00:00.000Z';
const KEYS = ['roster', 'google', 'hub', 'plan', 'invites', 'manager', 'slack', 'welcome'];   // wave275: the plan's order (at Accept, then at booking)
const ALL_KEYS = [...KEYS, 'groups', 'drives', 'meeting', 'channel'];   // wave278: the access steps, after the existing ones
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
  rig.db.onRpc('wa275_availability_of', availabilityOf);   // wave275 (amended 02/11/26): the week from hub_team_avail, the one-off dates from the roster

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
    const refused = s.tokenReply && s.tokenReply(claims);   // wave278 Task 4: a test can make Google refuse a mailbox's token (delegation)
    if (refused) return refused;
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
  rig.fetchOn('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', (e) => (s.gmailReply ? s.gmailReply(e) : { json: { id: 'mail1' } }));   // wave275 Task 4: a test can make Gmail refuse
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
  assert.deepEqual(p.steps.map((x) => x.key), ALL_KEYS);
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
  assert.deepEqual(s.statuses(), { roster: 'done', google: 'hr_task', plan: 'done', invites: 'done', manager: 'done', hub: 'hr_task', slack: 'hr_task', welcome: 'done' });
  assert.match(s.step('welcome').detail, /^Sent the welcome email/, 'wave275 Task 4: the welcome needs the invites only, and goes');
  assert.deepEqual(again.body.steps.map((x) => x.step), ALL_KEYS);
});

test('google failing holds hub while the rest run (the welcome needs the invites only, wave275); its retry brings hub through and patches the invites', async () => {
  const s = await setup({ config: { onboard_auto_google: 'on' } });
  let fail = true;
  const ran = [];
  s.entry('google').run = async () => { if (fail) throw new Error('Google said: no licence is free.'); return 'Created it.'; };
  s.entry('hub').run = async () => { ran.push('hub'); return 'Invited.'; };
  s.entry('welcome').run = async () => { ran.push('welcome'); return 'Sent.'; };
  await s.start();
  assert.deepEqual(s.statuses(), { roster: 'done', google: 'failed', plan: 'done', invites: 'done', manager: 'done', hub: 'waiting', slack: 'hr_task', welcome: 'done' });
  assert.equal(s.step('google').detail, 'Google said: no licence is free.');
  assert.match(s.step('hub').detail, /step 2/i);
  assert.deepEqual(ran, ['welcome'], 'the welcome went with the rest');
  const inserts = s.calWrites().filter((e) => e.method === 'POST');
  assert.equal(inserts.length, 2);
  for (const e of inserts) assert.ok(!e.body.attendees.some((a) => a.email.endsWith('alex.tremblay@welfareavenue.com')), 'personal only until the account exists');
  assert.ok(inserts[0].body.attendees.some((a) => a.email === 'alex@example.com'));
  assert.equal(s.flow().status, 'running');

  fail = false;
  const before = s.calWrites().length;
  const r = await s.post({ action: 'retry', flow_id: 21, step: 'google' });
  assert.equal(r.status, 200);
  assert.deepEqual(ran, ['welcome', 'hub'], 'the welcome is not sent again');
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
  const next = (o) => s.rig.mod.nextSteps(KEYS.map((k) => ({ step: k, status: o[k] || 'pending' }))).filter((k) => KEYS.includes(k));   // wave278: the four access steps are proved on their own, below
  assert.deepEqual(next({}), ['roster']);
  assert.deepEqual(s.rig.mod.nextSteps([]), ['roster']);
  assert.deepEqual(next({ roster: 'failed', google: 'waiting' }), []);
  assert.deepEqual(next({ roster: 'done' }), ['google', 'plan', 'invites', 'manager', 'slack']);
  assert.deepEqual(next({ roster: 'done', google: 'done' }), ['hub', 'plan', 'invites', 'manager', 'slack']);
  assert.deepEqual(next({ roster: 'done', invites: 'done' }), ['google', 'plan', 'manager', 'slack'], 'whole-branch fix: the welcome needs the invites, and waits while the account step has not ended');
  for (const g of ['pending', 'running', 'waiting']) assert.ok(!next({ roster: 'done', google: g, invites: 'done' }).includes('welcome'), 'google ' + g + ': the welcome waits');
  for (const g of ['done', 'skipped', 'hr_task', 'failed']) assert.ok(next({ roster: 'done', google: g, invites: 'done' }).includes('welcome'), 'google ' + g + ': the welcome goes, its login paragraph decided');
  assert.ok(s.rig.mod.nextSteps([{ step: 'roster', status: 'done' }, { step: 'invites', status: 'done' }, { step: 'welcome', status: 'pending' }]).includes('welcome'), 'no google row: nothing to wait for');
  assert.deepEqual(next({ roster: 'done', google: 'hr_task', invites: 'done' }), ['plan', 'manager', 'slack', 'welcome']);
  assert.deepEqual(next({ roster: 'done', google: 'skipped', plan: 'done', invites: 'done', manager: 'done', slack: 'skipped', hub: 'waiting', welcome: 'done' }), ['hub']);
  assert.deepEqual(next({ roster: 'done', google: 'failed', plan: 'done', invites: 'done', manager: 'done', slack: 'done', hub: 'waiting', welcome: 'done' }), []);
  assert.deepEqual(next({ roster: 'done', google: 'hr_task', plan: 'done', invites: 'done', manager: 'done', slack: 'hr_task', hub: 'waiting', welcome: 'done' }), []);
  assert.deepEqual(next({ roster: 'done', google: 'done', plan: 'done', invites: 'failed', manager: 'done', slack: 'hr_task', hub: 'done', welcome: 'waiting' }), [], 'failed invites hold the welcome');
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
  assert.deepEqual(done(), ['hrb1', 'hrb6'], 'wave275 Task 4: the welcome email went, so its checklist item (hrb1) is ticked too');
  assert.equal(s.rows('hr_setup_steps').find((r) => r.template_id === 'hrb6').done_by, 'hr.person@welfareavenue.com');
  assert.ok(s.rows('hr_setup_steps').find((r) => r.template_id === 'hrb6').done_at);
  await s.post({ action: 'google_manual', flow_id: 21, wa_email: 'alex.tremblay@welfareavenue.com' });
  assert.deepEqual(done(), ['hrb1', 'hrb2', 'hrb6']);
});

test('a google step finished before the plan exists is ticked once the plan does', async () => {
  const s = await setup({ config: { onboard_auto_google: 'on' } });
  s.entry('google').run = async () => 'Created it.';
  await s.start();
  assert.deepEqual(s.rows('hr_setup_steps').filter((r) => r.done).map((r) => r.template_id).sort(), ['hrb1', 'hrb2', 'hrb6']);
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
  assert.equal(n.body.url, '#mypage', 'whole-branch fix: the manager may be a plain member, so the link opens Home, where their cards are');
  assert.match(n.body.text, /\/#mypage\|Open the Hub>/);
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
test('with the settings off, google, hub and slack are HR tasks (the welcome has no switch, wave275); google_manual finishes the job', async () => {
  const s = await setup();
  const r = await s.start();
  assert.equal(r.status, 200);
  assert.deepEqual(s.statuses(), { roster: 'done', google: 'hr_task', plan: 'done', invites: 'done', manager: 'done', hub: 'hr_task', slack: 'hr_task', welcome: 'done' });
  for (const k of ['google', 'hub', 'slack']) assert.ok(s.step(k).detail, k + ' says what HR does');
  assert.match(s.step('welcome').detail, /HR will send the login details separately/, 'the welcome went, and says HR sends the login');
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
  assert.deepEqual([s.step('hub').status, s.step('welcome').status, s.step('slack').status], ['hr_task', 'done', 'hr_task'], 'hub has its own switch (onboard_auto_hub), slack no run; the welcome went at Start');
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
  assert.deepEqual([s.step('hub').status, s.step('welcome').status], ['hr_task', 'done'], 'the setting off makes hub an HR task at Start; the welcome has no switch (wave275) and needs no account');
  assert.deepEqual(ran, ['welcome']);
  await s.post({ action: 'google_manual', flow_id: 21, wa_email: 'alex.tremblay@welfareavenue.com' });
  assert.deepEqual(ran, ['welcome', 'hub'], 'hub runs once the account exists; the welcome is not sent twice');
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

test('with the settings on and no first password: google is an HR task with its reason, hub waits on it, slack (no run) is an HR task, and the welcome goes', async () => {
  const s = await setup({ config: { onboard_auto_google: 'on', onboard_auto_slack: 'on' } });
  await s.start();
  /* wave275: google, hub and welcome have runs now. With no first password in the vault google is HR's (with its reason), and hub waits on it; slack has
     no run; the welcome needs only the invites, and says HR sends the login details */
  assert.deepEqual(s.statuses(), { roster: 'done', google: 'hr_task', plan: 'done', invites: 'done', manager: 'done', hub: 'waiting', slack: 'hr_task', welcome: 'done' });
  assert.match(s.step('google').detail, /^The first password is not set in admin settings/);
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
  assert.deepEqual(on.rows('hr_setup_steps').filter((r) => r.done).map((r) => r.template_id).sort(), ['hrb1', 'hrb4', 'hrb5', 'hrb6'], 'hrb1: the welcome went (wave275)');
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
  assert.deepEqual(p.body.steps.map((x) => x.mode), ALL_KEYS.map(() => 'practice'));
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
  const link = await loadFn('onboard-link', { tables: { hub_candidates: tables.hub_candidates, hub_onboard_flows: tables.hub_onboard_flows, hub_onboard_grids: [], team_members: tables.team_members, change_log: [], hub_positions: [] } });   // wave278 Task 5: the offer GET reads the position's jd_url
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
/* the account as the Hub's own google step leaves it: done, with setup_ticks.google_made_at (an account HR made by hand gives no password: see w275 Task 4) */
const hubMade = async (s) => {
  await s.post({ action: 'google_manual', flow_id: 21, wa_email: 'alex.tremblay@welfareavenue.com' });
  s.flow().setup_ticks = { ...(s.flow().setup_ticks || {}), google_made_at: '2026-10-20T12:00:00.000Z' };
};
test('TEMPLATE: after Start the Hub\'s own text reads with the real values, in the SOP\'s order, and nothing of it is saved', async () => {
  const s = await setup({ config: { onboard_slack_join_link: 'https://join.slack.example/x', onboard_google_video: 'https://video.example/g' }, tables: { team_members: [...TEAM, HR_ROW] } });
  assert.equal((await s.start({ group_session: 'November 12', canva_link: 'https://www.canva.com/brand/join?token=a' })).status, 200);
  assert.equal(s.flow().welcome_edited, false);
  assert.equal(s.flow().welcome_subject, null, 'the Hub\'s own text is not saved, so it follows the template');
  assert.equal(s.flow().welcome_text, null);
  await hubMade(s);   // the Hub made the account: the card's copy has the login paragraph
  const before = s.snapshot();
  const w = await readWelcome(s), t = w.text;
  assert.deepEqual(s.snapshot(), before, 'reading writes nothing');
  assert.equal(w.edited, false);
  assert.equal(w.subject, 'Welcome to Welfare Avenue! Your Next Steps');
  assert.ok(t.startsWith('Dear Alex,\n\nCongratulations and welcome to the team at Welfare Avenue!\n\nWe\'re excited you\'ve accepted the Program Coordinator role within our organization.\n\n'), t);
  assert.match(t, /Your first day is Sunday, November 1, 2026, and we can't wait/, 'the Toronto date of the call, in words');
  assert.match(t, /\n1\. Your two meetings\. Both invites are in your Welfare Avenue calendar\.\n   - Your onboarding call: Sunday, November 1, 2026.*10:30.*\. Google Meet: the link is in your calendar invite\n/, 'wave278: no link saved yet by the calendar sync');
  assert.match(t, /   - Your 1-on-1 introduction with your manager, Sam Lee: Tuesday, November 3, 2026/);
  assert.doesNotMatch(t, /group onboarding session|November 12|in-person|Slack workspace|DocuSign|Contract/, 'wave278: the in-person session and the contract are not in the email');
  assert.match(t, /\n\n3\. Join the Welfare Avenue Slack with your new address: https:\/\/join\.slack\.example\/x\n   Join our Canva team: https:\/\/www\.canva\.com\/brand\/join\?token=a\n\n/, 'wave278 ruling: no setup page (a wave271 hire), so the short step 3');
  assert.doesNotMatch(t, /weekly meeting:/);
  assert.match(t, /\n2\. Sign in to your Welfare Avenue Google account at mail\.google\.com:\n   Email: alex\.tremblay@welfareavenue\.com\n   First password: \[first password\]\n   Google will ask you to change it the first time you sign in\.\n   This video shows you how to set up your Chrome profile: https:\/\/video\.example\/g\n/, 'wave275 Task 4: the login, with the placeholder kept on the card');
  assert.match(t, /\n\n4\. Your documents:\n   - Your job description: https:\/\/docs\.example\.com\/jd\. Have a look before the onboarding call\.\n   - HR will share your Drives\.\n\n/, 'wave278: no offer letter on the card, no drives added: HR shares them');
  assert.doesNotMatch(t, /personal Hub link|tick each step/i, 'a wave271 hire has no setup page: no Hub link step');
  assert.ok(t.endsWith('Looking forward to seeing all the great work you\'ll do with us!\n\nHana Rossi'), t);
  assert.equal(numbers(t), '1234');
  assert.doesNotMatch(t.replace('[first password]', ''), /\[|—|\bAI\b/, 'no marked place left but the password\'s, Hub words only');
  assert.doesNotMatch(t, /\.\./, 'one full stop after a time that ends in p.m.');
});

test('TEMPLATE: optional lines are left out and the steps renumber; no role reads as a sentence of its own', async () => {
  const s = await setup({ cand: { role: '' }, tables: { hub_positions: [{ id: 5, title: 'Program Coordinator', dept: 'progdev', jd_url: null }] } });
  await s.start({ one_on_one_at: null });
  const t = (await readWelcome(s)).text;
  assert.equal(numbers(t), '1234', 'no setup page (a wave271 hire): the short step 3');
  assert.doesNotMatch(t, /Join our Canva team/);
  assert.doesNotMatch(t, /group onboarding session/);
  assert.doesNotMatch(t, /video/i, 'no video set: its line goes');
  assert.match(t, /We're excited you've accepted our offer\./);
  assert.match(t, /Sam Lee: we'll confirm the time soon\./);
  assert.match(t, /\n3\. Join the Welfare Avenue Slack with your new address: https:\/\/welfareavenue\.slack\.com\n\n4\. /, 'the Slack default; no Canva link: its line goes');
  assert.doesNotMatch(t, /job description|offer letter/, 'wave278: no job description link and no offer letter: their lines go');
  assert.match(t, /\n4\. Your documents:\n   - HR will share your Drives\.\n/, 'the documents step keeps its Drives line');
  assert.match(t, /\n\nThe Welfare Avenue team$/, 'an HR person not on the roster: the team signs');
});

test('TEMPLATE: French, in the same order, with the French role name and natural wording', async () => {
  const s = await setup({ cand: { role: 'Operations Manager', summary: 'Français' }, tables: { team_members: [...TEAM, HR_ROW] } });
  await s.start({ group_session: '12 novembre', canva_link: 'https://www.canva.com/x' });
  await hubMade(s);
  const w = await readWelcome(s), t = w.text;
  assert.equal(w.subject, 'Bienvenue chez Welfare Avenue! Vos prochaines étapes');
  assert.ok(t.startsWith('Bonjour Alex,\n\nFélicitations et bienvenue dans l\'équipe de Welfare Avenue!\n\n'), t);
  assert.match(t, /accepté le poste de Gestionnaire des opérations au sein/, 'ROLE_FR, as on the /o/ page');
  assert.match(t, /Votre premier jour est le dimanche 1er novembre 2026,/, '1er for the first of the month');
  assert.match(t, /\n1\. Vos deux rencontres\. Les deux invitations sont dans votre calendrier Welfare Avenue\.\n   - Votre appel d'accueil : dimanche 1er novembre 2026 à 22 h 30\. Google Meet : le lien est dans votre invitation\n/);
  assert.match(t, /   - Votre rencontre individuelle de présentation avec votre gestionnaire, Sam Lee : mardi 3 novembre 2026 à /);
  assert.doesNotMatch(t, /12 novembre|séance de groupe|DocuSign|contrat/, 'wave278: none of these in the email');
  assert.match(t, /\n3\. Joignez-vous au Slack de Welfare Avenue avec votre nouvelle adresse : https:\/\/welfareavenue\.slack\.com\n   Joignez-vous à notre équipe Canva : https:\/\/www\.canva\.com\/x\n/, 'wave278 ruling, in French');
  assert.match(t, /\n2\. Connectez-vous à votre compte Google Welfare Avenue sur mail\.google\.com :\n   Adresse courriel : alex\.tremblay@welfareavenue\.com\n   Premier mot de passe : \[premier mot de passe\]\n   Google vous demandera de le changer lors de votre première connexion\.\n/);
  assert.match(t, /\n4\. Vos documents :\n   - Votre description de poste : https:\/\/docs\.example\.com\/jd\. Prenez-en connaissance avant l'appel d'accueil\.\n   - Les RH partageront vos Drives avec vous\.\n/);
  assert.match(t, /pour que votre intégration se déroule en douceur, dans un climat accueillant\./);
  assert.doesNotMatch(t, /individuellement|poste de proposé/);
  assert.equal(numbers(t), '1234');
  assert.doesNotMatch(t.replace('[premier mot de passe]', ''), /\[|—/);
  const n = await setup({ cand: { role: '', summary: 'Français' } });
  await n.start({ one_on_one_at: null });
  const u = (await readWelcome(n)).text;
  assert.match(u, /Nous sommes ravis que vous ayez accepté notre offre\./, 'no role: a sentence of its own');
  assert.equal(numbers(u), '1234');
  assert.match(u, /\n2\. Les RH vous enverront vos informations de connexion séparément\.\n/, 'no account: HR sends the login');
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
  assert.match(w.text, /Your first day is \[first day: fills in when the times are booked or at Start\]/);
  assert.match(w.text, /\n3\. Join the Welfare Avenue Slack with your new address: https:\/\/welfareavenue\.slack\.com\n   Join our Canva team: \[Canva link: fills in when the times are booked or at Start, or this line is left out\]\n/, 'wave278 ruling: a wave271 hire (no setup page) sees the short step 3');
  assert.doesNotMatch(w.text, /personal Hub link|weekly meeting:/);
  assert.match(w.text, /   Email: \[new address\]\n   First password: \[first password\]\n/, 'wave275 Task 4: the login, as places to fill');
  assert.match(w.text, /Google Meet: \[call Meet link\]\n/);
  assert.match(w.text, /   This video shows you how to set up your Chrome profile: \[Chrome setup video: fills in when the times are booked or at Start, or this line is left out\]\n/);
  assert.match(w.text, /   - Your job description: \[job description link: fills in when the times are booked or at Start, or this line is left out\]\. /);
  assert.match(w.text, /   - Your offer letter, signed when you accepted: \[offer letter link: fills in when the times are booked or at Start, or this line is left out\]\n/);
  assert.match(w.text, /   - Your Drives: \[your Drives: fills in when the times are booked or at Start\]\n/);
  assert.equal(numbers(w.text), '1234');
  assert.deepEqual(s.snapshot(), before);
  const fr = await setup({ cand: { summary: 'Français' } });
  assert.match((await fr.post({ action: 'preview', flow_id: 21 })).body.welcome.text, /\[premier jour : rempli à la réservation des rencontres ou au démarrage\]/);
  const v2 = await t4();   // a wave275 hire: the setup page and the weekly meeting, as places
  const v = (await v2.post({ action: 'preview', flow_id: 21 })).body.welcome.text;
  assert.match(v, /\n3\. Open your personal Hub link in your new Chrome profile window: \[setup page link\]\n/);
  assert.match(v, /   Your team's weekly meeting: \[weekly meeting: fills in when the times are booked or at Start, or this line is left out\]\. /);
  assert.doesNotMatch(v, /Join the Welfare Avenue Slack|Canva link/);
});

test('TEMPLATE: no password goes in the text, even with a password nonce on the flow: the card keeps [first password]', async () => {
  const s = await setup({ fl: { pw_nonce: 'SECRETNONCE', pw_expires_at: '2026-12-01T00:00:00Z' } });
  s.rig.env.ONBOARD_FIRST_PASSWORD = 'Lantern-Harbour-62';
  await s.start();
  await hubMade(s);
  const t = (await readWelcome(s)).text;
  assert.doesNotMatch(t, /SECRETNONCE|Lantern-Harbour-62|\/o\//, 'a wave271 hire gets no /o/ link here');
  assert.deepEqual(t.split('\n').filter((l) => /password/i.test(l)), ['   First password: [first password]'], 'wave275 Task 4: only the placeholder, which only the sent email fills');
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
  assert.equal(numbers(w.text), '1234', 'wave278: the short step 3 of a wave271 hire, its empty Canva line gone, from an edited text too');
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

test('TEMPLATE: a Canva link added after Start appears in a text HR saved before wave278 (its old Canva place), and goes again when it is cleared', async () => {
  const s = await setup();
  const old = 'Hello Alex!\n1. Your onboarding call: [call date and time: fills in at Start].\n2. Join our Canva team: [Canva link: fills in at Start, or this line is left out]\n3. Sign the Contract.';
  await s.start({ welcome: { subject: 'Welcome to Welfare Avenue! Your Next Steps', text: old } });
  let t = (await readWelcome(s)).text;
  assert.doesNotMatch(t, /Join our Canva team/);
  assert.equal(numbers(t), '12');
  await s.post({ action: 'set_canva_link', flow_id: 21, link: 'https://www.canva.com/new' });
  t = (await readWelcome(s)).text;
  assert.match(t, /^Hello Alex!/);
  assert.match(t, /\n2\. Join our Canva team: https:\/\/www\.canva\.com\/new\n/);
  assert.match(t, /1\. Your onboarding call: Sunday, November 1, 2026/, 'the old words of the place still fill');
  assert.equal(numbers(t), '123');
  await s.post({ action: 'set_canva_link', flow_id: 21, link: '' });
  assert.doesNotMatch((await readWelcome(s)).text, /Join our Canva team/);
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

test('TEMPLATE: the Hub\'s own text follows a change of time, 1-on-1, manager and (a wave271 hire, wave278 ruling) Canva link', async () => {
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
  assert.match(t, /\n   Join our Canva team: https:\/\/www\.canva\.com\/new\n/);
  assert.equal(numbers(t), '1234');
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
  assert.equal(s.step('slack').status, 'hr_task');   // wave275 Task 4: the welcome has a run now, so slack is the HR task here
  assert.equal(s.rows('hr_setup_steps').find((x) => x.template_id === 'hrb4').done, false);
  const r = await s.post({ action: 'task_done', flow_id: 21, step: 'slack' });
  assert.equal(r.status, 200);
  assert.equal(s.step('slack').status, 'done');
  assert.equal(s.step('slack').by, 'hr.person@welfareavenue.com');
  assert.match(s.step('slack').detail, /hr\.person@welfareavenue\.com/);
  assert.deepEqual(s.rows('hr_setup_steps').filter((x) => ['hrb4', 'hrb5'].includes(x.template_id)).map((x) => x.done), [true, true]);
  assert.ok(r.body.steps.some((x) => x.step === 'slack' && x.status === 'done'));
  const again = await s.post({ action: 'task_done', flow_id: 21, step: 'slack' });
  assert.equal(again.status, 409);
  assert.equal((await s.post({ action: 'task_done', flow_id: 21, step: 'welcome' })).body.error, 'not_hr_task', 'a welcome the Hub sent is not HR\'s to mark');
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
/* amended 02/11/26: Sam's week is the one he saved on Home (wave276, hub_team_avail); his one-off dates stay on the roster row. Spread it into tables. */
const SAM_AT = ({ weekly, except = [] }) => ({ team_members: [TEAM[0], { ...TEAM[1], availability: { except, tz: 'America/Toronto' }, availability_at: '2026-10-19T12:00:00Z' }], hub_team_avail: weekRows('Sam.Lee@welfareavenue.com', weekly) });
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
  const s = await setup({ cand, fl: { manager_member_id: 2, created_at: '2026-10-15T12:00:00Z', ...fl }, config: { hr_notify_emails: 'ruth.owen@welfareavenue.com', onboard_propose_lead_hours: '48', onboard_v2_since: '2026-10-01T00:00:00Z', onboard_manager_hours: 'on', ...config }, tables, hr, admin, notifyReply });   // whole-branch fix: on the new path (made after onboard_v2_since), as signed-in propose now requires
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
  assert.equal(n.length, 2, 'HR, and (Task 6) the manager');
  assert.deepEqual([n[1].body.event, n[1].body.to_email, n[1].body.title], ['onboard_propose', 'sam.lee@welfareavenue.com', 'HR proposed times for Alex Tremblay'], 'Task 6: HR proposed, so the manager hears it through their own kind');
  assert.match(n[1].body.body, /^hr\.person@welfareavenue\.com proposed times for Alex Tremblay \(Program Coordinator\): the onboarding call on Monday, October 26/);
  assert.ok(noDash(n[1].body.title + n[1].body.body + n[1].body.text));
  assert.equal(n[1].body.url, '#mypage', "whole-branch fix: the manager's link opens Home");
  assert.equal(n[0].body.url, '#hrcentre/onboarding', 'HR keeps Onboarding');
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
  const split = await w275({ tables: SAM_AT({ weekly: { mon: [['09:00', '10:30'], ['11:00', '12:00']] } }) });   // amended 02/11/26: cells that touch are one block now, so the gap is half an hour
  refused(await split.propose({ call_at: '2026-10-26T14:00:00Z', one_on_one_at: '2026-10-26T15:30:00Z' }), 'outside_hours', 'call');   // 10:00 to 11:00 crosses two blocks: not inside one
});

test('w275 propose: an except entry for the date replaces the weekday\'s blocks (empty: not available that day)', async () => {
  const av = { weekly: { mon: [['09:00', '17:00']], tue: [['09:00', '17:00']], sat: [['10:00', '11:30']] }, except: [{ date: '2026-10-26', free: [] }, { date: '2026-10-27', free: [['18:00', '21:00']] }], tz: 'America/Toronto' };
  const off = await w275({ tables: SAM_AT(av) });
  refused(await off.propose(), 'outside_hours', 'call');
  const evening = await w275({ tables: SAM_AT(av) });
  refused(await evening.propose({ call_at: '2026-10-27T14:00:00Z', one_on_one_at: '2026-10-27T23:00:00Z' }), 'outside_hours', 'call');   // 10:00 on a day whose except says 18:00 to 21:00
  const ok = await w275({ tables: SAM_AT(av) });
  assert.equal((await ok.propose({ call_at: '2026-10-27T22:00:00Z', one_on_one_at: '2026-10-28T00:00:00Z' })).status, 200, '18:00 and 20:00 on the except day');
  const satOk = await w275({ tables: SAM_AT(av) });
  assert.equal((await satOk.propose({ call_at: '2026-10-24T14:00:00Z', one_on_one_at: '2026-10-24T15:00:00Z' })).status, 200, 'a saved Saturday block');
});

test('w275 amended (Task 6): the manager\'s availability is read only through wa275_availability_of, with the service key: the week saved on Home is the week, a weekly left on the roster row is never read, and a read that fails saves nothing', async () => {
  const calls = [];
  const home = await w275({ tables: { team_members: [TEAM[0], { ...TEAM[1], availability: { weekly: { mon: [['09:00', '17:00']] }, except: [], tz: 'America/Toronto' } }], hub_team_avail: weekRows('sam.lee@welfareavenue.com', { sat: [['10:00', '12:00']] }) } });
  home.db.onRpc('wa275_availability_of', (a, db, w) => { calls.push({ a, jwt: w.jwt }); return availabilityOf(a, db, w); });
  refused(await home.propose(), 'outside_hours', 'call');   // Monday 10:00: only the old weekly on the roster row says Monday, and it is not read
  assert.deepEqual(calls.map((c) => [Number(c.a.p_member), c.jwt]), [[2, null]], 'read once, for the flow\'s manager, with the service key');
  const sat = await w275({ tables: { hub_team_avail: weekRows('sam.lee@welfareavenue.com', { sat: [['10:00', '12:00']] }) } });
  assert.equal((await sat.propose({ call_at: '2026-10-24T14:00:00Z', one_on_one_at: '2026-10-24T15:00:00Z' })).status, 200, 'Saturday 10:00 and 11:00: the week saved on Home');
  const broken = await w275();
  broken.db.onRpc('wa275_availability_of', () => { throw new Error('permission denied for function wa275_availability_of'); });
  const before = broken.snapshot();
  const r = await broken.propose();
  assert.equal(r.status, 503, JSON.stringify(r.body));
  assert.match(r.body.message, /availability could not be read .*permission denied.*Nothing was saved/);
  assert.deepEqual(broken.snapshot(), before);
  assert.equal(broken.rig.fetchLog.length, 0);
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

/* ---------- wave275 Task 3: accept_setup {flow_id}, book {flow_id, call_at, one_on_one_at, by}, the google and hub steps, and hub-invite's secret path ---------- */
/* NOW is Tuesday 20/10/26, 08:00 in Toronto. The flow was created after onboard_v2_since, so it is on the wave275 path. */
const SINCE = '2026-10-01T00:00:00Z';
const FIRST_PW = 'Lantern-Harbour-62';   // made up for these tests; it must never reach a table, a step detail or the console
const USERS = 'https://admin.googleapis.com/admin/directory/v1/users';
const HUB_INVITE = 'https://stub.supabase.test/functions/v1/hub-invite';
const PROPOSED = { proposed_call_at: P_CALL, proposed_one_on_one_at: P_ONE, proposed_by: 'sam.lee@welfareavenue.com', proposed_at: '2026-10-19T12:00:00.000Z' };
async function t3({ cand = {}, fl = {}, config = {}, tables, flows, pw = FIRST_PW, google, invite, notifyReply, hr = true, admin = false, manager = false } = {}) {
  const s = await w275({ cand, fl: { status: 'waiting', created_at: '2026-10-15T12:00:00Z', ...fl }, config: { onboard_v2_since: SINCE, onboard_auto_google: 'on', onboard_auto_hub: 'on', onboard_yes_lead_hours: '24', ...config }, tables, flows, notifyReply, hr, admin, manager });
  if (pw != null) s.rig.env.ONBOARD_FIRST_PASSWORD = pw;
  s.users = () => s.rig.fetchLog.filter((e) => e.url.startsWith(USERS));
  s.inserts = () => s.users().filter((e) => e.method === 'POST');
  s.invites = () => s.rig.fetchLog.filter((e) => e.url === HUB_INVITE);
  s.rig.fetchOn(USERS, (e) => {   // users.insert; the read-back GET goes to the setup's /users/<address> route
    const out = google ? google(e) : null;
    if (out) return out;
    s.taken.add(e.body.primaryEmail);
    return { json: { id: 'g1', primaryEmail: e.body.primaryEmail } };
  });
  s.rig.fetchOn(HUB_INVITE, (e) => (invite ? invite(e) : { json: { ok: true, email: e.body.email, member_id: 3, email_sent: true, hub_role: 'member' } }));
  s.planned = [];
  s.db.onRpc('wa275_plan_assign', (a, db, w) => {
    assert.equal(w.jwt, null, 'the hire\'s Yes has no sign-in: the plan is made with the service key');
    s.planned.push(a);
    const on = db.insert('onboardings', { member_id: a.p_member_id, person_name: 'x', assigned_by: a.p_by, started_at: a.p_start, completed_at: null });
    for (const t of SETUP) db.insert('hr_setup_steps', { onboarding_id: on.id, template_id: t, done: false });
    return on.id;
  });
  s.acceptSetup = () => s.post({ action: 'accept_setup', flow_id: 21 }, SECRET);
  s.book = (body = {}) => s.post({ action: 'book', flow_id: 21, call_at: P_CALL, one_on_one_at: P_ONE, by: 'hire', ...body }, SECRET);
  s.noPw = () => assert.ok(!JSON.stringify(s.db.tables).includes(FIRST_PW), 'the first password is in no table');
  return s;
}
async function quietly(fn) {   // what the function said on the console while fn ran
  const said = [], keep = {};
  for (const k of ['log', 'info', 'warn', 'error', 'debug']) { keep[k] = console[k]; console[k] = (...a) => said.push(a.map(String).join(' ')); }
  try { await fn(); } finally { Object.assign(console, keep); }
  return said.join('\n');
}

test('w275 accept_setup: roster, google and hub run at Accept; the profile is active with no start date, the card stays at offer, the account is made and read back', async () => {
  const s = await t3();
  const r = await s.acceptSetup();
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(s.statuses(), { roster: 'done', google: 'done', plan: undefined, invites: undefined, manager: undefined, hub: 'done', slack: undefined, welcome: undefined });
  const m = s.rows('team_members').at(-1);
  assert.deepEqual([m.name, m.active, m.start_source, m.start_date ?? null], ['Alex Tremblay', true, 'manual', null], 'directory-sync leaves a manual start date alone, and there is none yet');
  assert.equal(m.email, 'alex.tremblay@welfareavenue.com', 'the new address goes on the profile once the account exists');
  const c = s.cand();
  assert.deepEqual([c.status, c.member_id, c.start_date], ['offer', m.id, null], 'the card moves to Hired at booking, when day one is known');
  const f = s.flow();
  assert.equal(f.status, 'waiting');
  assert.equal(f.wa_email, 'alex.tremblay@welfareavenue.com');
  assert.equal(f.accounts_at, NOW_ISO);
  const ins = s.inserts();
  assert.equal(ins.length, 1);
  assert.equal(ins[0].url, USERS);
  assert.equal(ins[0].headers.authorization, 'Bearer tok:https://www.googleapis.com/auth/admin.directory.user:steel.macdonald@welfareavenue.com', 'acting as Steel, with the user scope');
  assert.deepEqual(ins[0].body, { primaryEmail: 'alex.tremblay@welfareavenue.com', name: { givenName: 'Alex', familyName: 'Tremblay' }, password: FIRST_PW, changePasswordAtNextLogin: true, orgUnitPath: '/' });
  const back = s.users().filter((e) => e.method === 'GET');
  assert.equal(back.length, 1, 'read back before done');
  assert.ok(back[0].url.startsWith(USERS + '/alex.tremblay%40welfareavenue.com'));
  assert.ok(s.rig.fetchLog.indexOf(back[0]) > s.rig.fetchLog.indexOf(ins[0]));
  assert.match(s.step('google').detail, /^Created alex\.tremblay@welfareavenue\.com in Google/);
  assert.match(s.step('google').detail, /change/);
  const inv = s.invites();
  assert.equal(inv.length, 1);
  assert.equal(inv[0].headers['x-wa-secret'], 'trigger-secret-for-tests');
  assert.deepEqual([inv[0].body.action, inv[0].body.email, inv[0].body.name], ['invite', 'alex.tremblay@welfareavenue.com', 'Alex Tremblay']);
  assert.equal(inv[0].body.hub_role, undefined, 'the level is hub-invite\'s to force');
  assert.match(s.step('hub').detail, /member level/);
  assert.equal(s.calWrites().length, 0, 'nothing is booked at Accept');
  assert.equal(s.gmail().length, 0, 'no proposal yet: no email to the hire');
  for (const k of ['roster', 'google', 'hub']) assert.ok(noDash(s.step(k).detail), k);
  s.noPw();
  assert.deepEqual(s.rig.unregistered(), []);
});

test('w275 accept_setup does nothing for a wave271 flow: created before onboard_v2_since, or while it is unset (James MacDonald\'s card keeps its path)', async () => {
  for (const [fl, config] of [[{ created_at: '2026-09-20T12:00:00Z' }, {}], [{}, { onboard_v2_since: '' }]]) {
    const s = await t3({ fl, config });
    const before = s.snapshot();
    const r = await s.acceptSetup();
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.skipped, 'wave271');
    assert.deepEqual(s.snapshot(), before);
    assert.equal(s.rig.fetchLog.length, 0);
  }
  const jwt = await t3();
  assert.equal((await jwt.post({ action: 'accept_setup', flow_id: 21 })).status, 403, 'a signed-in person cannot');
  assert.equal(jwt.rows('hub_onboard_steps').length, 0);
});

test('w275 accept_setup: two calls at once run each step once; times proposed before Accept are emailed to the hire once', async () => {
  const s = await t3({ fl: PROPOSED });
  const both = await Promise.all([s.acceptSetup(), s.acceptSetup()]);
  assert.deepEqual(both.map((r) => r.status), [200, 200], JSON.stringify(both.map((r) => r.body)));
  assert.equal(s.inserts().length, 1);
  assert.equal(s.invites().length, 1);
  assert.equal(s.rows('team_members').length, 3, 'one profile');
  assert.equal(s.rows('hub_onboard_steps').length, 5, 'the at-Accept rows once each (wave278: groups and drives too)');
  assert.deepEqual([s.step('roster').status, s.step('google').status, s.step('hub').status], ['done', 'done', 'done']);
  assert.equal(s.gmail().length, 1, 'the yes-or-no link');
  assert.equal(mail(s.gmail()[0]).to, 'alex@example.com');
  assert.equal(s.flow().setup_ticks.hire_times_at, NOW_ISO);
  const again = await s.acceptSetup();
  assert.equal(again.status, 200);
  assert.equal(s.inserts().length + s.gmail().length, 2, 'a later call changes nothing');
});

test('w275 google: with the first password unset or under 8 characters it is an HR task with a plain reason; Google is never asked and the rest carries on', async () => {
  for (const pw of [null, 'short7!']) {
    const s = await t3({ pw });
    const r = await s.acceptSetup();
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(s.step('google').status, 'hr_task');
    assert.match(s.step('google').detail, /^The first password is not set in admin settings/);
    assert.ok(noDash(s.step('google').detail));
    assert.equal(s.step('roster').status, 'done');
    assert.equal(s.step('hub').status, 'waiting', 'Hub access waits on the account');
    assert.match(s.step('hub').detail, /step 2, Google account/);
    assert.equal(s.users().length, 0);
    assert.equal(s.flow().wa_email, null);
    assert.equal(s.flow().accounts_at ?? null, null);
    assert.ok(!JSON.stringify(s.db.tables).includes('short7!'));
  }
});

test('w275 google: Workspace refusing (409 already exists, or no licence) is an HR task with Google\'s reason; nothing is attached to that address', async () => {
  const s = await t3({ google: () => ({ status: 409, json: { error: { code: 409, message: 'Entity already exists.' } } }) });
  const r = await s.acceptSetup();
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(s.step('google').status, 'hr_task');
  assert.match(s.step('google').detail, /^alex\.tremblay@welfareavenue\.com already exists in Google \(Google said: Entity already exists\.\)/);
  assert.equal(s.flow().wa_email, null, 'an address that may be someone else\'s mailbox is not stored');
  assert.equal(s.rows('team_members').at(-1).email, 'alex@example.com');
  assert.equal(s.step('hub').status, 'waiting');
  assert.equal(s.invites().length, 0);
  const lic = await t3({ google: () => ({ status: 412, json: { error: { code: 412, message: 'Domain user limit reached. Add licences first.' } } }) });
  await lic.acceptSetup();
  assert.equal(lic.step('google').status, 'hr_task');
  assert.match(lic.step('google').detail, /^Google did not create alex\.tremblay@welfareavenue\.com: Domain user limit reached\. Add licences first\./);
  const clash = await t3({ tables: { team_members: [...TEAM, { id: 9, name: 'Alex Tremblay Senior', email: 'alex.tremblay@welfareavenue.com', active: true }] } });
  await clash.acceptSetup();
  assert.equal(clash.step('google').status, 'hr_task');
  assert.match(clash.step('google').detail, /alex\.tremblay@welfareavenue\.com is on the roster profile of Alex Tremblay Senior/);
  assert.equal(clash.users().length, 0, 'a roster clash never reaches Google');
  const single = await t3({ cand: { name: 'Madonna' } });
  await single.acceptSetup();
  assert.equal(single.step('google').status, 'hr_task');
  assert.match(single.step('google').detail, /first\.last/);
});

test('w275 the first password never reaches a table, a step detail or the console, even when Google repeats it back', async () => {
  const s = await t3({ google: (e) => ({ status: 400, json: { error: { code: 400, message: 'Invalid password: ' + e.body.password } } }) });
  const said = await quietly(() => s.acceptSetup());
  assert.equal(s.step('google').status, 'hr_task');
  assert.ok(!s.step('google').detail.includes(FIRST_PW), s.step('google').detail);
  assert.match(s.step('google').detail, /\[first password\]/);
  s.noPw();
  assert.ok(!said.includes(FIRST_PW));
  const ok = await t3({ fl: PROPOSED });
  const said2 = await quietly(async () => { await ok.acceptSetup(); await ok.book(); });
  assert.equal(ok.step('google').status, 'done');
  ok.noPw();
  assert.ok(!said2.includes(FIRST_PW));
});

test('w275 Retry on the account step before booking: once the password is set it creates the account, and Hub access follows', async () => {
  const s = await t3({ pw: null });
  await s.acceptSetup();
  assert.equal(s.step('google').status, 'hr_task');
  s.rig.env.ONBOARD_FIRST_PASSWORD = FIRST_PW;
  const r = await s.post({ action: 'retry', flow_id: 21, step: 'google' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([s.step('google').status, s.step('hub').status], ['done', 'done']);
  assert.equal(s.step('plan'), undefined, 'the steps at booking still wait for the times');
  assert.equal(s.flow().status, 'waiting');
  assert.equal(s.flow().accounts_at, NOW_ISO);
  s.noPw();
});

test('w275 James MacDonald\'s path: a wave271 card started before the release gets its real account from Retry on the Google step', async () => {
  const s = await t3({ fl: { created_at: '2026-09-20T12:00:00Z' }, pw: null });
  assert.equal((await s.acceptSetup()).body.skipped, 'wave271');
  assert.equal((await s.start()).status, 200);
  assert.equal(s.step('google').status, 'hr_task');
  assert.equal(s.flow().status, 'running');
  s.rig.env.ONBOARD_FIRST_PASSWORD = FIRST_PW;
  const r = await s.post({ action: 'retry', flow_id: 21, step: 'google' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(s.step('google').status, 'done');
  assert.equal(s.inserts()[0].body.primaryEmail, 'alex.tremblay@welfareavenue.com', 'the address HR typed at Start');
  assert.equal(s.inserts()[0].body.changePasswordAtNextLogin, true);
  assert.equal(s.step('hub').status, 'done');
  assert.equal(s.flow().status, 'started');
  s.noPw();
});

test('w275 book (the hire\'s Yes): both meetings booked with the manager, the plan fills the start date and moves the card to Hired, and the flow is started', async () => {
  const s = await t3({ fl: PROPOSED });
  await s.acceptSetup();
  const r = await s.book();
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.equal(r.body.repeated, false);
  const f = s.flow();
  assert.deepEqual([f.call_at, f.one_on_one_at, f.hire_answer, f.hire_answered_at, f.status], [P_CALL, P_ONE, 'yes', NOW_ISO, 'started']);
  assert.deepEqual(s.statuses(), { roster: 'done', google: 'done', plan: 'done', invites: 'done', manager: 'done', hub: 'done', slack: 'hr_task', welcome: 'done' });
  assert.equal(s.planned.length, 1);
  assert.equal(s.planned[0].p_start, '2026-10-26');
  const m = s.rows('team_members').at(-1);
  assert.deepEqual([m.start_date, m.start_source], ['2026-10-26', 'manual']);
  assert.deepEqual([s.cand().status, s.cand().start_date], ['hired', '2026-10-26']);
  assert.ok(s.rows('change_log').some((l) => l.entity_type === 'candidate' && l.field === 'status' && /^hired/.test(l.new_value)));
  const ev = s.calWrites().filter((e) => e.method === 'POST');
  assert.equal(ev.length, 2, 'both events');
  for (const e of ev) {
    const to = e.body.attendees.map((a) => a.email);
    assert.ok(['alex@example.com', 'alex.tremblay@welfareavenue.com', 'sam.lee@welfareavenue.com'].every((x) => to.includes(x)), JSON.stringify(to));
    assert.ok(e.body.conferenceData, 'a Meet link');
  }
  const n = s.notifies();
  assert.ok(n.some((x) => x.body.event === 'onboard_date' && x.body.to_email === 'sam.lee@welfareavenue.com'), 'the manager step');
  const hr = n.filter((x) => x.body.event === 'onboard_answer');
  assert.equal(hr.length, 1);
  assert.deepEqual(hr[0].body.to, ['ruth.owen@welfareavenue.com']);
  assert.equal(hr[0].body.title, 'Alex Tremblay said yes to the times');
  assert.match(s.step('welcome').detail, /^Sent the welcome email to alex@example\.com/, 'wave275 Task 4: the welcome goes at booking');
  assert.ok(s.rows('change_log').some((l) => l.entity_type === 'onboard_flow' && l.field === 'call_at' && l.new_value === P_CALL));
  s.noPw();
  assert.deepEqual(s.rig.unregistered(), []);
});

test('w275 book re-checks both times: under 24 hours away, outside the manager\'s hours now, or on a hub@ meeting is stale; nothing is booked, the answer is no, the manager and HR are told', async () => {
  const sam = SAM_AT({ weekly: { mon: [['13:00', '17:00']] } });
  const meeting = { id: 'e9', summary: 'Board', attendee_emails: ['sam.lee@welfareavenue.com'], status: 'confirmed', start_at: '2026-10-26T15:45:00Z', end_at: '2026-10-26T16:15:00Z' };
  for (const [opts, at, which] of [[{}, '2026-10-25T15:00:00Z', 'call'], [{ tables: sam }, null, 'call'], [{ tables: { hub_events: [meeting] } }, null, 'one_on_one']]) {
    const s = await t3({ fl: PROPOSED, ...opts });
    await s.acceptSetup();
    if (at) s.rig.setNow(at);
    const r = await s.book();
    refused(r, 'stale', which);
    assert.equal(r.status, 409);
    assert.equal(r.body.ask_availability, true);
    const f = s.flow();
    assert.deepEqual([f.call_at, f.one_on_one_at, f.hire_answer, f.status], [null, null, 'no', 'waiting']);
    assert.equal(f.hire_answered_at ?? null, null, 'the times went stale; the hire has not said no, so their one No is still theirs');
    assert.equal(s.calWrites().length, 0);
    assert.equal(s.planned.length, 0);
    assert.equal(s.step('plan'), undefined);
    const told = s.notifies().filter((x) => x.body.event === 'onboard_answer');
    assert.equal(told.length, 1, JSON.stringify(opts));
    assert.deepEqual(told[0].body.to.slice().sort(), ['ruth.owen@welfareavenue.com', 'sam.lee@welfareavenue.com']);
    assert.match(told[0].body.title, /no longer work/);
    assert.equal(told[0].body.url, '#mypage', 'whole-branch fix: the manager and HR both open Home');
    assert.match(told[0].body.text, /\/#mypage\|Open the Hub>$/);
    assert.doesNotMatch(told[0].body.body + told[0].body.text, /hrcentre/);
  }
  const off = await t3({ fl: { ...PROPOSED, ask_availability: false }, tables: { hub_events: [meeting] } });
  const o = await off.book();
  refused(o, 'stale', 'one_on_one');
  assert.equal(o.body.ask_availability, false);
});

test('w275 book: two presses book once; a repeat is a repeat; times that are not the proposal, no proposal or a closed card are refused; a signed-in person cannot', async () => {
  const s = await t3({ fl: PROPOSED });
  await s.acceptSetup();
  const both = await Promise.all([s.book(), s.book()]);
  assert.deepEqual(both.map((r) => r.status), [200, 200], JSON.stringify(both.map((r) => r.body)));
  assert.deepEqual(both.map((r) => !!r.body.repeated).sort(), [false, true]);
  assert.equal(s.calWrites().filter((e) => e.method === 'POST').length, 2);
  assert.equal(s.planned.length, 1);
  assert.equal((await s.book()).body.repeated, true);
  assert.equal(s.calWrites().filter((e) => e.method === 'POST').length, 2);
  const signed = await s.post({ action: 'book', flow_id: 21, call_at: P_CALL, one_on_one_at: P_ONE, by: 'hire' });
  assert.deepEqual([signed.status, signed.body.repeated], [200, true], 'Task 6: signed in, book is the card\'s own path (HR here); the same times again are a repeat');
  const other = await t3({ fl: PROPOSED });
  refused(await other.book({ call_at: '2026-10-26T18:00:00Z' }), 'changed');
  assert.equal(other.flow().call_at, null);
  refused(await (await t3()).book(), 'no_proposal');
  refused(await (await t3({ fl: PROPOSED, cand: { status: 'withdrawn' } })).book(), 'closed');
  refused(await (await t3({ fl: { ...PROPOSED, hire_answer: 'no' } })).book(), 'answered');
});

test('w275 practice: accept_setup and book simulate every step and fetch nothing', async () => {
  const s = await t3({ cand: { practice: true }, fl: PROPOSED });
  assert.equal((await s.acceptSetup()).status, 200);
  const r = await s.book();
  assert.equal(r.status, 200, JSON.stringify(r.body));
  for (const k of KEYS) {
    assert.equal(s.step(k).status, 'done', k);
    assert.match(s.step(k).detail, /practice/i, k);
  }
  assert.equal(s.rig.fetchLog.length, 0);
  assert.deepEqual(s.rows('team_members').map((m) => m.id), [1, 2], 'no profile');
  assert.equal(s.cand().status, 'offer');
  assert.deepEqual([s.flow().call_at, s.flow().status], [P_CALL, 'started']);
  assert.equal(s.planned.length, 0);
});

test('w275 propose after the hire said no: the answer is cleared and the hire is emailed the new times', async () => {
  const s = await t3({ fl: { ...PROPOSED, hire_answer: 'no', hire_answered_at: '2026-10-19T13:00:00Z', setup_ticks: { hire_times_at: '2026-10-19T12:00:00Z' } } });
  const r = await s.propose({ one_on_one_at: '2026-10-26T18:00:00Z' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(s.flow().hire_answer, null);
  assert.equal(s.flow().hire_answered_at, '2026-10-19T13:00:00Z', 'kept: a second no then goes to a person');
  assert.equal(r.body.hire_emailed, true);
  assert.equal(s.gmail().length, 1);
});

test('w275 Start on a flow that ran its at-Accept steps keeps them: the account is not made twice', async () => {
  const s = await t3();
  await s.acceptSetup();
  const r = await s.start({ wa_email: 'alex.tremblay@welfareavenue.com', skip: [] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(s.inserts().length, 1);
  assert.equal(s.invites().length, 1);
  assert.deepEqual([s.step('google').status, s.step('hub').status, s.step('plan').status], ['done', 'done', 'done']);
});

/* hub-invite's secret path: the onboarding runner invites a new hire at member level, and the secret opens nothing else */
async function hubInvite(roles = []) {
  const rig = await loadFn('hub-invite', { tables: { team_members: [{ id: 3, name: 'Alex Tremblay', email: 'alex.tremblay@welfareavenue.com', active: true, department: null }], hub_roles: roles, change_log: [], app_config: [] } });
  rig.fetchOn(NOTIFY, { json: { outcome: 'no_slack' } });
  const post = async (body, headers = {}) => {
    const r = await rig.call(new Request(HUB_INVITE, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }));
    return { status: r.status, body: await r.json() };
  };
  return { rig, post, rows: (t) => rig.db.rows(t) };
}
test('w275 hub-invite: the trigger secret opens invite alone, at member level whatever is asked; a blocked person is refused and nobody is downgraded', async () => {
  const h = await hubInvite();
  const r = await h.post({ action: 'invite', email: 'alex.tremblay@welfareavenue.com', name: 'Alex Tremblay', hub_role: 'admin', send_email: false, inviter: 'hr.person@welfareavenue.com' }, SECRET);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.hub_role, 'member');
  assert.deepEqual(h.rows('hub_roles').map((x) => [x.email, x.role, x.updated_by]), [['alex.tremblay@welfareavenue.com', 'member', 'hr.person@welfareavenue.com']]);
  assert.equal(h.rows('team_members').length, 1, 'the profile the roster step made is used');
  assert.ok(h.rows('change_log').some((l) => l.field === 'invited' && /^member/.test(l.new_value) && /onboarding/.test(l.new_value)));
  for (const body of [{ action: 'remove', email: 'x.y@welfareavenue.com' }, { action: 'link', email: 'x.y@welfareavenue.com' }, { action: 'bulk_invite', people: [{ email: 'y.z@welfareavenue.com', name: 'Y Z' }] }, { action: 'set_email', member_id: 3, email: 'q.r@welfareavenue.com' }]) {
    assert.equal((await h.post(body, SECRET)).status, 403, body.action);
  }
  assert.equal((await h.post({ action: 'invite', email: 'b.c@welfareavenue.com', name: 'B C', send_email: false }, { 'x-wa-secret': 'not-the-secret' })).status, 403);
  assert.equal((await h.post({ action: 'invite', email: 'b.c@welfareavenue.com', name: 'B C', send_email: false })).status, 403);
  assert.equal(h.rows('hub_roles').length, 1);
  const blocked = await hubInvite([{ email: 'alex.tremblay@welfareavenue.com', role: 'blocked' }]);
  const b = await blocked.post({ action: 'invite', email: 'alex.tremblay@welfareavenue.com', name: 'Alex Tremblay', send_email: false }, SECRET);
  assert.equal(b.status, 400);
  assert.equal(blocked.rows('hub_roles')[0].role, 'blocked');
  const leader = await hubInvite([{ email: 'alex.tremblay@welfareavenue.com', role: 'leader' }]);
  assert.equal((await leader.post({ action: 'invite', email: 'alex.tremblay@welfareavenue.com', name: 'Alex Tremblay', send_email: false }, SECRET)).body.hub_role, 'leader', 'never downgraded');
});

/* ---------- wave275 Task 3, fix round 1 ---------- */
test('w275 fix: book answers once the times are claimed; the booking steps run after it, handed to EdgeRuntime.waitUntil (Calendar held back here)', async () => {
  const pending = [];
  globalThis.EdgeRuntime = { waitUntil: (p) => { pending.push(p); } };
  try {
    const s = await t3({ fl: PROPOSED });
    await s.acceptSetup();   // the at-Accept steps also hand nothing over: accept_setup runs inside its own request
    let release;
    const gate = new Promise((r) => { release = r; });
    s.calReply = async (e) => { await gate; return { json: { id: e.body?.id || e.url.split('/events/')[1]?.split('?')[0], hangoutLink: 'https://meet.example/x' } }; };
    const r = await s.book();
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual([r.body.ok, r.body.booked, r.body.repeated, r.body.call_at, r.body.one_on_one_at, r.body.status], [true, true, false, P_CALL, P_ONE, 'running'], 'answered while Calendar has not answered yet');
    assert.deepEqual([s.flow().call_at, s.flow().hire_answer, s.flow().status], [P_CALL, 'yes', 'running'], 'the claim is saved before the answer');
    assert.equal(s.step('welcome').status, 'pending', 'the booking rows are made; their steps have not finished');
    assert.equal(pending.length, 1);
    release();
    await Promise.all(pending);
    assert.deepEqual(s.statuses(), { roster: 'done', google: 'done', plan: 'done', invites: 'done', manager: 'done', hub: 'done', slack: 'hr_task', welcome: 'done' });
    assert.equal(s.gmail().filter((e) => /Welcome to Welfare Avenue/.test(mail(e).subject)).length, 1, 'wave275 Task 4: the welcome goes in the background with the rest');
    assert.equal(s.flow().status, 'started');
    assert.equal(s.calWrites().filter((e) => e.method === 'POST').length, 2);
    assert.equal(s.notifies().filter((x) => x.body.event === 'onboard_answer').length, 1, 'HR told after the steps');
    /* stale stays in the request: the hire still gets it, and nothing is handed over */
    const st = await t3({ fl: PROPOSED, tables: { hub_events: [{ id: 'e9', attendee_emails: ['sam.lee@welfareavenue.com'], status: 'confirmed', start_at: '2026-10-26T15:45:00Z', end_at: '2026-10-26T16:15:00Z' }] } });
    const before = pending.length;
    refused(await st.book(), 'stale', 'one_on_one');
    assert.equal(pending.length, before);
  } finally { delete globalThis.EdgeRuntime; }
});

test('w275 fix: new times clear the mark of a second No (no_again_at), so the hire answers them', async () => {
  const s = await t3({ fl: { ...PROPOSED, hire_answered_at: '2026-10-19T13:00:00Z', setup_ticks: { no_again_at: '2026-10-19T14:00:00Z', rd_profile: '2026-10-19T15:00:00Z' } } });
  const r = await s.propose({ one_on_one_at: '2026-10-26T18:00:00Z' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.warnings, []);
  assert.equal(s.flow().setup_ticks.no_again_at, null);
  assert.equal(s.flow().setup_ticks.rd_profile, '2026-10-19T15:00:00Z', 'the rundown ticks stay');
  assert.equal(s.flow().hire_answered_at, '2026-10-19T13:00:00Z');
});

/* ---------- wave275 Task 4: the welcome email (sendWelcome, the run of the step welcome) and the first password (set_first_password, first_password_state) ---------- */
/* The welcome goes out at booking, from hub@ to the personal address. It needs the invites (their Meet links) and nothing else: when the account step is
   not done, its login paragraph says HR sends the login details separately. The first password is read from the vault as the email goes, and put into
   that message only: the preview, the card's copy and the saved text keep [first password]. */
const MEET_CALL = 'https://meet.google.com/aaa-bbbb-ccc', MEET_ONE = 'https://meet.google.com/ddd-eeee-fff';
const SETUP_LINK = 'https://hub.welfareavenue.com/o/' + expectedToken(11) + '?setup';
async function t4(o = {}) {
  const s = await t3({ fl: PROPOSED, ...o });
  s.calReply = (e) => {   // each event has its own Meet link, on insert and on a read
    const id = e.body?.id || e.url.split('/events/')[1]?.split('?')[0] || '';
    return { json: { id, hangoutLink: /oneonone/.test(id) ? MEET_ONE : MEET_CALL } };
  };
  s.pwReads = 0;
  const read = s.db.handlers.get_secret;
  s.db.onRpc('get_secret', (a, db, w) => { if (a.secret_name === 'ONBOARD_FIRST_PASSWORD') s.pwReads++; return read(a, db, w); });
  s.welcomes = () => s.gmail().filter((e) => /Welcome to Welfare Avenue|Bienvenue chez Welfare Avenue/.test(mail(e).subject));
  s.card = async () => { const r = await s.post({ action: 'welcome', flow_id: 21 }); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; };
  return s;
}
const count = (text, part) => text.split(part).length - 1;

test('w275 welcome: sent at booking from hub@ (no offer sender, no owner) to both addresses, with both times, both Meet links, the login and the setup page; the password is in the outgoing message only, once', async () => {
  const s = await t4({ config: { onboard_slack_join_link: 'https://join.slack.example/wa' }, tables: { team_members: [...TEAM, HR_ROW] } });
  await s.acceptSetup();
  const pre = (await s.post({ action: 'preview', flow_id: 21 })).body.welcome.text;
  assert.match(pre, /First password: \[first password\]/, 'the preview keeps the placeholder');
  assert.ok(!pre.includes(FIRST_PW));
  s.pwReads = 0;
  const said = await quietly(() => s.book());
  assert.equal(s.step('welcome').status, 'done', s.step('welcome').detail);
  assert.equal(s.step('welcome').detail, 'Sent the welcome email to alex@example.com and alex.tremblay@welfareavenue.com from hub@welfareavenue.com; no staff copy.');
  assert.ok(noDash(s.step('welcome').detail));
  const sent = s.welcomes();
  assert.equal(sent.length, 1, 'nobody to copy: one send');
  const m = mail(sent[0]);
  assert.equal(m.to, 'alex@example.com, alex.tremblay@welfareavenue.com', 'wave278: the personal address and the new Welfare Avenue one');
  assert.match(m.from, /<hub@welfareavenue\.com>/);
  assert.equal(m.subject, 'Welcome to Welfare Avenue! Your Next Steps');
  assert.equal(m.bodies.length, 2, 'text and HTML');
  const [text, html] = m.bodies;
  for (const b of m.bodies) assert.equal(count(b, FIRST_PW), 1, 'the password once in each part of the message');
  assert.ok(!Buffer.from(sent[0].body.raw, 'base64url').toString().includes(FIRST_PW), 'the MIME carries it only encoded');
  assert.equal(s.pwReads, 1, 'read once, as the email went');
  assert.ok(text.startsWith('Dear Alex,\n\nCongratulations and welcome to the team at Welfare Avenue!'), text);
  assert.match(text, /Your first day is Monday, October 26, 2026,/);
  assert.match(text, /   - Your onboarding call: Monday, October 26, 2026 at 10:00 a\.m\. Google Meet: https:\/\/meet\.google\.com\/aaa-bbbb-ccc\n/);
  assert.match(text, /   - Your 1-on-1 introduction with your manager, Sam Lee: Monday, October 26, 2026 at 11:30 a\.m\. Google Meet: https:\/\/meet\.google\.com\/ddd-eeee-fff\n/);
  assert.match(text, /\n2\. Sign in to your Welfare Avenue Google account at mail\.google\.com:\n   Email: alex\.tremblay@welfareavenue\.com\n   First password: Lantern-Harbour-62\n   Google will ask you to change it the first time you sign in\.\n/);
  assert.ok(text.includes('\n\n3. Open your personal Hub link in your new Chrome profile window: ' + SETUP_LINK + '\n   The Hub walks you through the rest, one step at a time: '), text);
  assert.doesNotMatch(text, /weekly meeting:/, 'no weekly meeting recorded: that line goes');
  assert.match(text, /\n\n4\. Your documents:\n   - Your job description: https:\/\/docs\.example\.com\/jd\. Have a look before the onboarding call\.\n   - HR will share your Drives\.\n\n/);
  assert.doesNotMatch(text, /slack\.example|DocuSign|Canva team|   \d+\. /, 'wave278: no Slack line, no contract, no Canva step and no pasted rundown');
  assert.equal(numbers(text), '1234');
  assert.match(text, /\n\nSam Lee$/, 'no offer sender and no owner: signed by the manager, who booked the times with them');
  assert.ok(Buffer.from(sent[0].body.raw, 'base64url').toString().includes('\r\nReply-To: sam.lee@welfareavenue.com\r\n'), 'replies go to the manager');
  assert.doesNotMatch(text, /\[|—|\bAI\b/, 'every marked place filled, Hub words only');
  assert.match(html, /<a href="https:\/\/meet\.google\.com\/aaa-bbbb-ccc"/, 'links work in the HTML part');
  assert.ok(html.includes('href="' + SETUP_LINK + '"'));
  const f = s.flow();
  assert.equal(f.welcome_sent_at, NOW_ISO);
  assert.equal(f.welcome_text ?? null, null, 'the flow keeps the template, not the sent text');
  const card = await s.card();
  assert.match(card.text, /First password: \[first password\]/, 'the card\'s copy keeps the placeholder');
  assert.ok(!card.text.includes(FIRST_PW));
  assert.equal(card.sent_at, NOW_ISO);
  s.noPw();
  assert.ok(!said.includes(FIRST_PW), 'nothing on the console');
  assert.deepEqual(s.rig.unregistered(), []);
});


test('w275 welcome: Meet links saved by the calendar sync (hub_events) are used without asking Calendar again', async () => {
  const s = await t4({ tables: { hub_events: [{ id: 'onboard21call', meet_link: 'https://meet.google.com/syn-cccc-all', status: 'confirmed', attendee_emails: [] }, { id: 'onboard21oneonone', meet_link: 'https://meet.google.com/syn-oooo-one', status: 'confirmed', attendee_emails: [] }] } });
  await s.acceptSetup();
  await s.book();
  const text = mail(s.welcomes()[0]).bodies[0];
  assert.match(text, /Google Meet: https:\/\/meet\.google\.com\/syn-cccc-all/);
  assert.match(text, /Google Meet: https:\/\/meet\.google\.com\/syn-oooo-one/);
  assert.equal(s.cal().filter((e) => e.method === 'GET').length, 0);
});

test('w275 welcome: with the account step not done (an HR task, or failed), it still goes at booking, saying HR sends the login details separately; the password is not read', async () => {
  for (const [o, word] of [[{ pw: null }, 'hr_task'], [{ google: () => { throw new Error('network down'); } }, 'failed']]) {
    const s = await t4(o);
    await s.acceptSetup();
    assert.equal(s.step('google').status, word);
    s.rig.env.ONBOARD_FIRST_PASSWORD = FIRST_PW;   // set now: still not read, the account was not made with it
    s.pwReads = 0;
    const said = await quietly(() => s.book());
    assert.equal(s.step('welcome').status, 'done', s.step('welcome').detail);
    assert.match(s.step('welcome').detail, /HR will send the login details separately/);
    assert.match(s.step('welcome').detail, /send them/i, 'the detail says what HR does');
    const text = mail(s.welcomes()[0]).bodies[0];
    assert.match(text, /\n2\. HR will send your login details separately\.\n\n3\. Open your personal Hub link/);
    assert.equal(mail(s.welcomes()[0]).to, 'alex@example.com', 'wave278: no account yet, so only the personal address');
    assert.doesNotMatch(text, /First password|\[first password\]|mail\.google\.com:/);
    assert.ok(!text.includes(FIRST_PW));
    assert.equal(s.pwReads, 0, 'the vault is not read at all');
    const card = await s.card();
    assert.match(card.text, /2\. HR will send your login details separately\./, 'the card\'s copy says the same');
    s.noPw();
    assert.ok(!said.includes(FIRST_PW));
  }
  const fr = await t4({ cand: { summary: 'Français' }, pw: null });
  await fr.acceptSetup();
  await fr.book();
  const m = mail(fr.welcomes()[0]);
  assert.equal(m.subject, 'Bienvenue chez Welfare Avenue! Vos prochaines étapes');
  assert.match(m.bodies[0], /\n2\. Les RH vous enverront vos informations de connexion séparément\.\n/);
  assert.match(m.bodies[0], /Google Meet : https:\/\/meet\.google\.com\/aaa-bbbb-ccc/);
  assert.match(m.bodies[0], /\n3\. Ouvrez votre lien personnel du Hub dans la fenêtre de votre nouveau profil Chrome : https:\/\/hub\.welfareavenue\.com\/o\//);
  assert.doesNotMatch(m.bodies[0], /\[|—/);
});

test('w275 welcome: renderWelcome keeps [first password] when the account is done, and puts the sentence in its place when it is not', async () => {
  const s = await setup();
  const r = s.rig.mod.renderWelcome;
  const f = flow({ status: 'running', call_at: P_CALL, one_on_one_at: P_ONE, wa_email: 'alex.tremblay@welfareavenue.com', call_event_id: 'onboard21call', one_on_one_event_id: 'onboard21oneonone' }), c = candidate();
  const facts = { manager: 'Sam Lee', jdUrl: null, video: 'https://video.example/g', slack: 'https://welfareavenue.slack.com', hrName: 'Hana Rossi', meet: { call: null, one: null }, setupLink: null };
  const done = r(f, c, { ...facts, login: true }).text;
  assert.match(done, /First password: \[first password\]/);
  assert.match(done, /   This video shows you how to set up your Chrome profile: https:\/\/video\.example\/g/);
  assert.match(done, /Google Meet: the link is in your calendar invite/, 'no link known yet');
  assert.doesNotMatch(done, /personal Hub link/, 'no setup page: that step goes');
  assert.match(done, /   - HR will share your Drives\./, 'no drives known: HR shares them');
  const later = r(f, c, { ...facts, login: false }).text;
  assert.match(later, /\n2\. HR will send your login details separately\.\n\n3\. /, 'the whole login step, its lines under it too');
  assert.doesNotMatch(later, /password|video\.example/i);
  const draft = r({ ...f, status: 'waiting' }, c, { ...facts, draft: true, login: false }).text;
  assert.match(draft, /First password: \[first password\]/, 'before booking the brackets stay as they are');
  const edited = r({ ...f, welcome_text: 'Hi Alex.\nYour password: [first password] (change it).\nSee you.' }, c, { ...facts, login: false }).text;
  assert.equal(edited, 'Hi Alex.\nHR will send your login details separately.\nSee you.', 'in HR\'s own wording, the line with the placeholder');
});

test('w275 welcome: the password unset when it goes (after the account was made): the login paragraph says HR sends it, and the detail says why', async () => {
  const s = await t4();
  await s.acceptSetup();
  assert.equal(s.step('google').status, 'done');
  delete s.rig.env.ONBOARD_FIRST_PASSWORD;
  await s.book();
  assert.equal(s.step('welcome').status, 'done');
  assert.match(s.step('welcome').detail, /first password is not set in admin settings/);
  const text = mail(s.welcomes()[0]).bodies[0];
  assert.match(text, /\n2\. HR will send your login details separately\.\n/);
  assert.doesNotMatch(text, /\[first password\]/, 'never the placeholder in a sent email');
});

test('w275 welcome (Review Focus 5): the sent text is the saved template with HR\'s edits, filled as it goes; the saved copy keeps its brackets', async () => {
  const s = await t4();
  await s.acceptSetup();
  const pre = (await s.post({ action: 'preview', flow_id: 21 })).body.welcome;
  const text = 'A note from me, just for Alex.\n' + pre.text;
  Object.assign(s.flow(), { welcome_subject: 'Welcome aboard, Alex', welcome_text: text, welcome_edited: true });   // as Start saves HR's edits
  await s.book();
  const m = s.gmail().map(mail).find((x) => x.subject === 'Welcome aboard, Alex');
  assert.ok(m, 'sent with the subject HR saved');
  assert.ok(m.bodies[0].startsWith('A note from me, just for Alex.\nDear Alex,'), m.bodies[0]);
  assert.equal(count(m.bodies[0], FIRST_PW), 1);
  assert.match(m.bodies[0], /Google Meet: https:\/\/meet\.google\.com\/aaa-bbbb-ccc/);
  assert.doesNotMatch(m.bodies[0], /\[/);
  assert.equal(s.flow().welcome_text, text, 'what HR typed is kept as typed, placeholder and all');
  s.noPw();
});

test('w275 welcome: sent once; a second run with welcome_sent_at set says already sent and sends nothing', async () => {
  const s = await t4();
  await s.acceptSetup();
  await s.book();
  assert.equal(s.welcomes().length, 1);
  const row = s.step('welcome');
  Object.assign(row, { status: 'failed', detail: 'cut off', at: '2026-10-20T11:00:00.000Z' });
  const r = await s.post({ action: 'retry', flow_id: 21, step: 'welcome' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(s.step('welcome').status, 'done');
  assert.match(s.step('welcome').detail, /already sent/);
  assert.equal(s.welcomes().length, 1, 'nothing more went');
  assert.equal(s.flow().welcome_sent_at, NOW_ISO);
});

test('w275 welcome: Gmail refusing fails the step with Google\'s reason and gives the send back, so Retry sends it; in test mode it goes to the test inboxes', async () => {
  const s = await t4({ config: { mail_mode: 'test' } });
  s.gmailReply = (e) => (/Welcome to Welfare Avenue/.test(mail(e).subject) ? { status: 400, json: { error: { message: 'Invalid To header' } } } : null) || { json: { id: 'mail1' } };
  await s.acceptSetup();
  await s.book();
  assert.equal(s.step('welcome').status, 'failed');
  assert.match(s.step('welcome').detail, /Invalid To header/);
  assert.equal(s.flow().welcome_sent_at ?? null, null, 'the send is given back');
  s.gmailReply = null;
  const r = await s.post({ action: 'retry', flow_id: 21, step: 'welcome' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(s.step('welcome').status, 'done');
  assert.match(s.step('welcome').detail, /test mode/);
  const m = mail(s.welcomes().at(-1));
  assert.equal(m.to, 'tester@welfareavenue.com');
  assert.equal(m.subject, '[TEST, for alex@example.com, alex.tremblay@welfareavenue.com] Welcome to Welfare Avenue! Your Next Steps');
  assert.equal(count(m.bodies[0], FIRST_PW), 1);
  s.noPw();
});

test('w275 welcome: a practice flow simulates it: no fetch, no password read, nothing marked sent', async () => {
  const s = await t4({ cand: { practice: true } });
  await s.acceptSetup();
  s.pwReads = 0;
  await s.book();
  assert.equal(s.step('welcome').status, 'done');
  assert.match(s.step('welcome').detail, /practice/i);
  assert.equal(s.rig.fetchLog.length, 0);
  assert.equal(s.pwReads, 0);
  assert.equal(s.flow().welcome_sent_at ?? null, null);
});

/* set_first_password {password} and first_password_state {}: admins only, as the caller's JWT */
const NEW_PW = 'Harbour-Lantern-48';   // made up for these tests
async function vaultRig(o = {}) {
  const s = await setup({ hr: false, admin: true, ...o });
  s.vault = [];
  s.db.onRpc('wa_vault_set', (a, _d, w) => { assert.equal(w.jwt, null, 'the vault is written with the service key'); s.vault.push(a); s.rig.env[a.p_name] = a.p_value; return null; });
  return s;
}
test('w275 set_first_password (admins): kept in the vault, logged as "set" with no value, and first_password_state says when; the value is in no table, answer or console line', async () => {
  const s = await vaultRig();
  let st = await s.post({ action: 'first_password_state' });
  assert.equal(st.status, 200, JSON.stringify(st.body));
  assert.deepEqual(st.body, { set: false, set_at: null });
  let r;
  const said = await quietly(async () => { r = await s.post({ action: 'set_first_password', password: NEW_PW }); });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body, { ok: true, set: true, set_at: NOW_ISO });
  assert.equal(s.vault.length, 1);
  assert.deepEqual([s.vault[0].p_name, s.vault[0].p_value], ['ONBOARD_FIRST_PASSWORD', NEW_PW]);
  assert.ok(!String(s.vault[0].p_note).includes(NEW_PW) && s.vault[0].p_note, 'a note, without the value');
  const log = s.rows('change_log').filter((l) => l.entity_id === 'ONBOARD_FIRST_PASSWORD');
  assert.equal(log.length, 1);
  assert.deepEqual([log[0].entity_type, log[0].field, log[0].old_value, log[0].new_value, log[0].changed_by], ['app_setting', 'first password', null, 'set', 'hr.person@welfareavenue.com']);
  assert.equal(s.rows('app_config').find((x) => x.key === 'onboard_first_password_at').value, NOW_ISO);
  assert.ok(!JSON.stringify(s.db.tables).includes(NEW_PW), 'in no table');
  assert.ok(!said.includes(NEW_PW));
  st = await s.post({ action: 'first_password_state' });
  assert.deepEqual(st.body, { set: true, set_at: NOW_ISO });
  const again = await s.post({ action: 'set_first_password', password: NEW_PW + 'x' });
  assert.equal(again.status, 200);
  assert.equal(s.rows('change_log').filter((l) => l.entity_id === 'ONBOARD_FIRST_PASSWORD').length, 2, 'each change is logged');
  assert.equal(s.rows('app_config').filter((x) => x.key === 'onboard_first_password_at').length, 1, 'one setting, replaced');
});

test('w275 set_first_password refuses a short one, one without a letter or a digit, spaces at its ends or no text, in a plain sentence; nothing is kept', async () => {
  const s = await vaultRig();
  for (const password of ['Short7a', 'abcdefghij', '1234567890', ' Harbour-48 ', '', undefined, 12345678, 'a1' + 'x'.repeat(99)]) {
    const before = s.snapshot();
    const r = await s.post({ action: 'set_first_password', password });
    assert.equal(r.status, 400, JSON.stringify(password));
    assert.equal(r.body.error, 'bad_password');
    assert.match(r.body.message, /^The first password /);
    assert.match(r.body.message, /Nothing was changed\.$/);
    assert.ok(noDash(r.body.message));
    if (typeof password === 'string' && password) assert.ok(!r.body.message.includes(password.trim()), 'never echoed');
    assert.deepEqual(s.snapshot(), before);
  }
  assert.equal(s.vault.length, 0);
  assert.match((await s.post({ action: 'set_first_password', password: 'Short7a' })).body.message, /at least 8 characters/);
  assert.match((await s.post({ action: 'set_first_password', password: 'abcdefghij' })).body.message, /a letter and a digit/);
});

test('w275 set_first_password and first_password_state: HR who are not admins are refused in a plain sentence, and the trigger secret opens neither', async () => {
  const s = await vaultRig({ hr: true, admin: false });
  const before = s.snapshot();
  for (const body of [{ action: 'set_first_password', password: NEW_PW }, { action: 'first_password_state' }]) {
    const r = await s.post(body);
    assert.equal(r.status, 403, JSON.stringify(r.body));
    assert.equal(r.body.message, 'Only admins can see or set the first password.');
    const x = await s.post(body, SECRET);
    assert.equal(x.status, 401, 'the secret alone is not a sign-in');
  }
  assert.equal(s.vault.length, 0);
  assert.deepEqual(s.snapshot(), before);
});

test('w275 welcome: Start (the wave271 path) sends it once the invites are out, with HR\'s edits and the login paragraph from the account step', async () => {
  const s = await setup({ tables: { team_members: [...TEAM, HR_ROW] } });
  const p = (await s.post({ action: 'preview', flow_id: 21 })).body.welcome;
  assert.match(p.text, /\[first password\]/);
  await s.start({ welcome: { subject: p.subject, text: p.text.replace('Dear Alex,', 'Hello Alex!') } });
  assert.equal(s.step('google').status, 'hr_task', 'the setting is off here');
  assert.equal(s.step('welcome').status, 'done', s.step('welcome').detail);
  const sent = s.gmail().map(mail);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'alex@example.com');
  assert.ok(sent[0].bodies[0].startsWith('Hello Alex!'));
  assert.match(sent[0].bodies[0], /\n2\. HR will send your login details separately\.\n/);
  assert.doesNotMatch(sent[0].bodies[0], /\[/);
  assert.doesNotMatch(sent[0].bodies[0], /personal Hub link/, 'a wave271 hire\'s link shuts at booking, so no setup page');
  assert.match(sent[0].bodies[0], /\n3\. Join the Welfare Avenue Slack with your new address: https:\/\/welfareavenue\.slack\.com\n/, 'wave278 ruling: the short step 3 instead');
  assert.match(s.flow().welcome_text, /\[first password\]/, 'the saved text keeps the placeholder');
});

/* wave275 Task 4, review fixes */
test('w275 fix: an account HR made by hand gives no vault password: the email says HR sends the login details, and the vault is not read; the Hub\'s own account is marked', async () => {
  const hub = await t4();
  await hub.acceptSetup();
  assert.equal(hub.flow().setup_ticks.google_made_at, NOW_ISO, 'the google step marks the account the Hub made, and when');
  const s = await t4({ pw: null });
  await s.acceptSetup();
  assert.equal(s.step('google').status, 'hr_task');
  s.rig.env.ONBOARD_FIRST_PASSWORD = FIRST_PW;   // set now: still not the password of an account HR made
  const g = await s.post({ action: 'google_manual', flow_id: 21, wa_email: 'alex.tremblay@welfareavenue.com' });
  assert.equal(g.status, 200, JSON.stringify(g.body));
  assert.equal(s.step('google').status, 'done');
  assert.equal(s.flow().setup_ticks?.google_made_at ?? null, null, 'no mark for an account made by hand');
  s.pwReads = 0;
  await s.book();
  assert.equal(s.step('welcome').status, 'done', s.step('welcome').detail);
  assert.match(s.step('welcome').detail, /made by hand, so the Hub does not know its password/);
  const text = mail(s.welcomes()[0]).bodies[0];
  assert.match(text, /\n2\. HR will send your login details separately\.\n\n3\. /);
  assert.doesNotMatch(text, /First password|\[first password\]/);
  assert.ok(!text.includes(FIRST_PW));
  assert.equal(s.pwReads, 0, 'the vault is not read');
  assert.match((await s.card()).text, /2\. HR will send your login details separately\./);
  s.noPw();
});

test('w275 fix: the first password changed after the Hub made the account: the email does not give it; one set before is given', async () => {
  const s = await t4();
  await s.acceptSetup();
  assert.equal(s.step('google').status, 'done');
  s.rows('app_config').push({ key: 'onboard_first_password_at', value: '2026-10-20T13:00:00.000Z' });   // an admin set a new one an hour after the account was made
  s.rig.env.ONBOARD_FIRST_PASSWORD = 'Newer-Password-77';
  s.pwReads = 0;
  await s.book();
  assert.match(s.step('welcome').detail, /changed in admin settings after the Hub made the account/);
  const text = mail(s.welcomes()[0]).bodies[0];
  assert.match(text, /\n2\. HR will send your login details separately\.\n/);
  assert.ok(!text.includes(FIRST_PW) && !text.includes('Newer-Password-77'));
  assert.equal(s.pwReads, 0);
  const before = await t4({ config: { onboard_first_password_at: '2026-10-20T11:00:00.000Z' } });
  await before.acceptSetup();
  await before.book();
  assert.equal(count(mail(before.welcomes()[0]).bodies[0], FIRST_PW), 1, 'set before the account: that is its password');
});

test('w275 fix: set_first_password takes printable ASCII only, as Google does', async () => {
  const s = await vaultRig();
  for (const password of ['Mot-de-passé-48', 'Pässword-1234', 'Harbour Lantern48', 'Harbour-48-\u{1F511}x']) {
    const before = s.snapshot();
    const r = await s.post({ action: 'set_first_password', password });
    assert.equal(r.status, 400, JSON.stringify(password));
    assert.equal(r.body.message, 'The first password can use only plain letters (no accents), digits, spaces and the signs on an English keyboard (Google\'s rule). Nothing was changed.');
    assert.deepEqual(s.snapshot(), before);
  }
  assert.equal(s.vault.length, 0);
  const ok = await s.post({ action: 'set_first_password', password: 'Plain ascii-48!~' });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
});

test('w275 fix: with the invites step skipped the email names no Meet link, and keeps the times', async () => {
  const s = await setup();
  await s.start({ skip: ['invites'] });
  assert.equal(s.step('welcome').status, 'done', s.step('welcome').detail);
  const text = mail(s.gmail()[0]).bodies[0];
  assert.match(text, /\n1\. Your two meetings\.\n   - Your onboarding call: Sunday, November 1, 2026 at 10:30 p\.m\.\n/, 'wave278: no invite, so the sentence about them goes too');
  assert.match(text, /with your manager, Sam Lee: Tuesday, November 3, 2026.*\n/);
  assert.doesNotMatch(text, /Google Meet|will come with the invite|Both invites|\[/);
  const fr = await setup({ cand: { summary: 'Français' } });
  await fr.start({ skip: ['invites'] });
  assert.doesNotMatch(mail(fr.gmail()[0]).bodies[0], /Google Meet|viendra avec l'invitation|Les deux invitations|\[/);
  assert.match(mail(fr.gmail()[0]).bodies[0], /\n1\. Vos deux rencontres\.\n/);
});

test('w275 fix: the login sentence takes the place of the login lines only; other lines HR wrote under that step stay', async () => {
  const s = await setup();
  const r = s.rig.mod.renderWelcome;
  const f = flow({ status: 'running', call_at: P_CALL, one_on_one_at: P_ONE, wa_email: 'alex.tremblay@welfareavenue.com' }), c = candidate();
  const facts = { manager: 'Sam Lee', jdUrl: null, video: 'https://video.example/g', slack: 'https://welfareavenue.slack.com', hrName: 'Hana Rossi', meet: { call: null, one: null }, setupLink: null, login: false };
  const own = '2. Sign in to your Welfare Avenue Google account at mail.google.com:\n   Email: [new address]\n   First password: [first password]\n   Google will ask you to change it the first time you sign in.\n   This video shows you how: https://video.example/g\n   If you get stuck, call Sam on 555-0100.\n3. Next.';
  assert.equal(r({ ...f, welcome_text: own }, c, facts).text, '2. HR will send your login details separately.\n   If you get stuck, call Sam on 555-0100.\n3. Next.');
  const theirs = '2. Your login:\n   First password: [first password]\n   Keep it safe.\n3. Next.';
  assert.equal(r({ ...f, welcome_text: theirs }, c, facts).text, '2. Your login:\n   HR will send your login details separately.\n   Keep it safe.\n3. Next.', 'a heading HR rewrote stays');
  const onNumber = '2. Your password is [first password].\n   Keep it safe.\n3. Next.';
  assert.equal(r({ ...f, welcome_text: onNumber }, c, facts).text, '2. HR will send your login details separately.\n   Keep it safe.\n3. Next.');
  const both = '2. Your login:\n   Email: [new address], password: [first password]\n3. Next.';
  assert.equal(r({ ...f, welcome_text: both }, c, facts).text, '2. Your login:\n   HR will send your login details separately.\n3. Next.', 'a line with the placeholder becomes the sentence, even with the address on it');
});

/* ---------- wave275 Task 6: the card for HR and the manager ---------- */
/* NOW is Tuesday 20/10/26, 08:00 in Toronto. Tuesday 27/10: the call at 10:00 (14:00Z), the 1-on-1 at 11:30 (15:30Z), inside Monday to Friday 9 to 5. */
const C_CALL = '2026-10-27T14:00:00.000Z', C_ONE = '2026-10-27T15:30:00.000Z';
const SAID_NO = { ...PROPOSED, hire_answer: 'no', hire_answered_at: '2026-10-19T15:00:00.000Z' };
async function t6(opts = {}) {
  const s = await t3(opts);
  s.card = (action, body = {}) => s.post({ action, flow_id: 21, ...body });
  s.bookCard = (body = {}) => s.card('book', { call_at: C_CALL, one_on_one_at: C_ONE, ...body });
  return s;
}
function refused2(r, code, re) { assert.equal(r.body.error, code, JSON.stringify(r.body)); assert.ok(r.status >= 400); if (re) assert.match(r.body.message, re); assert.ok(noDash(r.body.message)); }

test('w275 Task 6 book from the card (HR): after the hire said no, HR picks both times; both are booked with the manager, the hire\'s own no stays theirs, and HR is told who booked', async () => {
  const s = await t6({ fl: SAID_NO });
  await s.acceptSetup();
  const r = await s.bookCard();
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.booked, r.body.repeated, r.body.call_at, r.body.one_on_one_at], [true, false, C_CALL, C_ONE]);
  const f = s.flow();
  assert.deepEqual([f.call_at, f.one_on_one_at, f.started_by], [C_CALL, C_ONE, 'sam.lee@welfareavenue.com'], 'the manager runs the call, so both invites go to them');
  assert.deepEqual([f.hire_answer, f.hire_answered_at], ['no', '2026-10-19T15:00:00.000Z'], 'the hire\'s answer is theirs: the card booking does not write a yes for them');
  assert.deepEqual(s.statuses(), { roster: 'done', google: 'done', plan: 'done', invites: 'done', manager: 'done', hub: 'done', slack: 'hr_task', welcome: 'done' });
  const ev = s.calWrites().filter((e) => e.method === 'POST');
  assert.equal(ev.length, 2, 'both invites');
  for (const e of ev) assert.ok(e.body.attendees.map((a) => a.email).includes('sam.lee@welfareavenue.com'));
  const hr = s.notifies().filter((x) => x.body.event === 'onboard_answer');
  assert.equal(hr.length, 1);
  assert.equal(hr[0].body.title, 'hr.person@welfareavenue.com booked the times for Alex Tremblay');
  assert.ok(noDash(hr[0].body.title + hr[0].body.body));
  assert.ok(s.rows('change_log').some((l) => l.entity_type === 'onboard_flow' && l.field === 'call_at' && l.new_value === C_CALL && l.changed_by === 'hr.person@welfareavenue.com'), 'by is the caller');
  assert.equal((await s.bookCard()).body.repeated, true, 'the same times again are a repeat');
  refused(await s.bookCard({ call_at: '2026-10-28T14:00:00.000Z' }), 'already_booked');
  s.noPw();
  assert.deepEqual(s.rig.unregistered(), []);
});

test('w275 Task 6 book from the card: the manager may (wa275_manager_of, as the caller); someone else is refused and nothing changes', async () => {
  const m = await t6({ fl: SAID_NO, hr: false, manager: true });
  m.db.setCaller({ email: 'sam.lee@welfareavenue.com' });
  await m.acceptSetup();
  const r = await m.bookCard();
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(m.rows('change_log').some((l) => l.field === 'call_at' && l.changed_by === 'sam.lee@welfareavenue.com'));
  assert.equal(m.notifies().find((x) => x.body.event === 'onboard_answer').body.title, 'Sam Lee booked the times for Alex Tremblay', 'their roster name');
  const x = await t6({ fl: SAID_NO, hr: false, manager: false });
  const before = x.snapshot();
  const no = await x.bookCard();
  assert.equal(no.status, 403);
  assert.match(no.body.message, /this new hire's manager/);
  assert.deepEqual(x.snapshot(), before);
  assert.equal(x.rig.fetchLog.length, 0);
});

test('w275 Task 6 book from the card: the hire\'s Yes rules (24 hours ahead, inside the manager\'s hours, no overlap, zoned times); not before Accept; a live proposal waits for the hire; already communicated books without one', async () => {
  for (const [opts, body, code, which] of [
    [{ cand: { accepted_on: null }, fl: { status: 'offered' } }, {}, 'not_accepted'],
    [{ fl: PROPOSED }, {}, 'proposal_open'],
    [{ fl: SAID_NO }, { call_at: '2026-10-27T22:00:00.000Z' }, 'outside_hours', 'call'],
    [{ fl: SAID_NO }, { call_at: '2026-10-20T18:00:00.000Z' }, 'lead_time', 'call'],
    [{ fl: SAID_NO }, { one_on_one_at: '2026-10-27T14:30:00.000Z' }, 'overlap'],
    [{ fl: SAID_NO }, { call_at: '2026-10-27T10:00' }, 'bad_time'],
    [{ fl: SAID_NO, cand: { status: 'withdrawn' } }, {}, 'closed'],
  ]) {
    const s = await t6(opts);
    const before = s.snapshot();
    refused(await s.bookCard(body), code, which);
    assert.deepEqual(s.snapshot(), before, code + ': nothing written');
    assert.equal(s.calWrites().length, 0);
  }
  const said = await t6({ fl: { ask_availability: false } });
  await said.acceptSetup();
  const r = await said.bookCard();
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(said.flow().call_at, C_CALL, 'availability already communicated and nothing proposed: HR books what the hire said');
});

test('w275 Task 6 set_ask_availability {flow_id, on}: the switch, logged; HR or the manager; a repeat changes nothing; anyone else is refused', async () => {
  const s = await t6();
  const r = await s.card('set_ask_availability', { on: false });
  assert.deepEqual([r.status, r.body.ask_availability], [200, false], JSON.stringify(r.body));
  assert.equal(s.flow().ask_availability, false);
  assert.ok(s.rows('change_log').some((l) => l.field === 'ask_availability' && l.old_value === 'ask the hire' && l.new_value === 'already communicated' && l.changed_by === 'hr.person@welfareavenue.com'));
  assert.equal((await s.card('set_ask_availability', { on: false })).body.repeated, true);
  assert.equal((await s.card('set_ask_availability', { on: 'yes' })).status, 400);
  const m = await t6({ hr: false, manager: true });
  assert.equal((await m.card('set_ask_availability', { on: false })).status, 200);
  const x = await t6({ hr: false, manager: false });
  assert.equal((await x.card('set_ask_availability', { on: false })).status, 403);
  assert.equal(x.flow().ask_availability, undefined);
});

test('w275 Task 6 grid_for {flow_id, who: hire, slots}: HR or the manager enters the hire\'s times; no 10-hour minimum for them; past cells dropped; anything off the grid refused', async () => {
  const s = await t6({ fl: { ask_availability: false } });
  const r = await s.card('grid_for', { who: 'hire', slots: ['2026-10-27T15:00:00Z', '2026-10-27T14:30:00.000Z', '2026-10-19T14:00:00Z', '2026-10-27T15:00:00Z'] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.slots, ['2026-10-27T14:30:00Z', '2026-10-27T15:00:00Z'], 'sorted, once each, as onboard-link writes them; the past cell dropped');
  const g = s.rows('hub_onboard_grids').find((x) => x.flow_id === 21 && x.who === 'hire');
  assert.deepEqual(g.slots, r.body.slots);
  assert.ok(s.rows('change_log').some((l) => l.field === 'hire_grid' && l.changed_by === 'hr.person@welfareavenue.com'));
  for (const [body, code] of [[{ who: 'manager', slots: [] }, 'bad_who'], [{ who: 'hire', slots: ['2026-10-27T15:10:00Z'] }, 'bad_slots'], [{ who: 'hire', slots: ['2026-12-27T15:00:00Z'] }, 'bad_slots'], [{ who: 'hire', slots: ['2026-10-27T15:00'] }, 'bad_slots'], [{ who: 'hire', slots: 'x' }, 'bad_slots']]) {
    const x = await s.card('grid_for', body);
    assert.equal(x.status, 400, JSON.stringify(body));
    assert.equal(x.body.error, code);
  }
  const m = await t6({ hr: false, manager: true });
  assert.equal((await m.card('grid_for', { who: 'hire', slots: ['2026-10-27T15:00:00Z'] })).status, 200, 'the manager may');
  const booked = await t6({ fl: { status: 'running', call_at: C_CALL } });
  assert.equal((await booked.card('grid_for', { who: 'hire', slots: [] })).body.error, 'already_booked');
});

test('w275 Task 6 availability_for {member_id, except}: HR sets a manager\'s one-off dates; the week is theirs to set on Home; the manager themselves cannot use it', async () => {
  const s = await t6();
  const r = await s.post({ action: 'availability_for', member_id: 2, except: [{ date: '2026-10-28', free: [['13:00', '15:00'], ['09:00', '10:00']] }, { date: '2026-10-27', free: [] }] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const want = [{ date: '2026-10-27', free: [] }, { date: '2026-10-28', free: [['09:00', '10:00'], ['13:00', '15:00']] }];
  assert.deepEqual(s.rows('team_members').find((m) => m.id === 2).availability, { except: want, tz: 'America/Toronto' });
  assert.deepEqual(r.body.availability.except, want);
  assert.equal(r.body.no_week, true, 'the answer is the whole of it, read again: no week saved on Home yet');
  assert.ok(s.rows('change_log').some((l) => l.entity_type === 'team_member' && l.field === 'availability' && l.changed_by === 'hr.person@welfareavenue.com'));
  refused2(await s.post({ action: 'availability_for', member_id: 2, weekly: { mon: [['09:00', '17:00']] }, except: [] }), 'weekly_moved', /Sam Lee sets their usual week on the Hub's Home page/);
  for (const except of [[{ date: '2026-02-30', free: [] }], [{ date: '2026-10-28', free: [['10:00', '09:00']] }], [{ date: '2026-10-28', free: [] }, { date: '2026-10-28', free: [] }], [{ date: '2026-10-28', free: [['09:07', '10:00']] }], 'x']) {
    assert.equal((await s.post({ action: 'availability_for', member_id: 2, except })).body.error, 'bad_availability', JSON.stringify(except));
  }
  assert.equal((await s.post({ action: 'availability_for', member_id: 99, except: [] })).status, 404);
  const m = await t6({ hr: false, manager: true });
  m.db.setCaller({ email: 'sam.lee@welfareavenue.com' });
  assert.equal((await m.post({ action: 'availability_for', member_id: 2, except: [] })).status, 403, 'HR and admins only');
});

test('w275 Task 6 set_welcome {flow_id, subject, text}: edits before booking are kept as typed, brackets and all, and only where they differ; refused once it went or once booked', async () => {
  const s = await t6();
  const w = await s.card('welcome');
  assert.equal(w.status, 200, JSON.stringify(w.body));
  assert.match(w.body.text, /\[first password\]/, 'before booking the template keeps its brackets');
  const mine = w.body.text.replace('Congratulations and welcome', 'A warm welcome');
  const r = await s.card('set_welcome', { subject: w.body.subject, text: mine });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const f = s.flow();
  assert.deepEqual([f.welcome_subject, f.welcome_text, f.welcome_edited], [null, mine, true], 'the subject is the Hub\'s own; the text as typed');
  assert.equal(r.body.text, mine);
  assert.equal(r.body.edited, true);
  assert.ok(s.rows('change_log').some((l) => l.field === 'welcome' && l.new_value === 'edited'));
  const back = await s.card('set_welcome', { subject: w.body.subject, text: w.body.text });
  assert.deepEqual([back.body.edited, s.flow().welcome_text, s.flow().welcome_edited], [false, null, false], 'the Hub\'s own again');
  assert.equal((await s.card('set_welcome', { subject: 'x', text: 5 })).status, 400);
  const sent = await t6({ fl: { welcome_sent_at: '2026-10-19T12:00:00Z' } });
  assert.equal((await sent.card('set_welcome', { subject: 'a', text: 'b' })).body.error, 'already_sent');
  const booked = await t6({ fl: { status: 'running', call_at: C_CALL } });
  assert.equal((await booked.card('set_welcome', { subject: 'a', text: 'b' })).body.error, 'too_late');
  const m = await t6({ hr: false, manager: true });
  assert.equal((await m.card('set_welcome', { subject: 'a', text: 'b [first password]' })).status, 200, 'the manager may');
  assert.equal(m.flow().welcome_text, 'b [first password]');
  s.noPw();
});

test('w275 Task 6 times {flow_id}: the picker\'s data, the manager\'s hours read through wa275_availability_of, their hub@ meetings with titles, other hires\' times, the hire\'s grid', async () => {
  const ev = { id: 'e1', summary: 'Board', attendee_emails: ['sam.lee@welfareavenue.com'], status: 'confirmed', start_at: '2026-10-26T14:30:00Z', end_at: '2026-10-26T15:00:00Z' };
  const other = flow({ id: 22, candidate_id: 12, manager_member_id: 2, call_at: '2026-10-28T14:00:00Z' });
  const s = await t6({ fl: SAID_NO, tables: { hub_events: [ev], hub_onboard_grids: [{ flow_id: 21, who: 'hire', slots: ['2026-10-27T14:00:00Z'] }], hub_candidates: [candidate(), candidate({ id: 12, name: 'Bo Chen' })] }, flows: [other] });
  const r = await s.card('times');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const b = r.body;
  assert.deepEqual(b.manager, { member_id: 2, name: 'Sam Lee' });
  assert.deepEqual(b.availability.weekly.mon, [['09:00', '17:00']]);
  assert.equal(b.no_week, true);
  assert.deepEqual(b.busy, [{ start: '2026-10-26T14:30:00.000Z', end: '2026-10-26T15:00:00.000Z', summary: 'Board' }]);
  assert.deepEqual(b.taken, [{ start: '2026-10-28T14:00:00.000Z', end: '2026-10-28T15:00:00.000Z' }]);
  assert.deepEqual(b.hire_slots, ['2026-10-27T14:00:00Z']);
  assert.deepEqual([b.lengths, b.lead_hours, b.yes_lead_hours, b.hire_answer, b.ask_availability, b.accepted], [{ callMin: 60, oneMin: 30 }, 48, 24, 'no', true, true]);
  assert.equal(b.proposal.call_at, P_CALL);
  const m = await t6({ hr: false, manager: true });
  assert.equal((await m.card('times')).status, 200, 'the manager may');
  const x = await t6({ hr: false, manager: false });
  assert.equal((await x.card('times')).status, 403);
});

test('w275 Task 6: a plain member who manages the hire gets the card actions only; HR\'s own actions stay HR\'s (Review Focus 4)', async () => {
  const m = await t6({ hr: false, manager: true });
  m.db.setCaller({ email: 'sam.lee@welfareavenue.com' });
  const before = m.snapshot();
  for (const body of [{ action: 'preview', flow_id: 21 }, { action: 'start', flow_id: 21 }, { action: 'set_manager', flow_id: 21, member_id: 1 }, { action: 'ask_manager', flow_id: 21 }, { action: 'google_manual', flow_id: 21, wa_email: 'a@welfareavenue.com' }, { action: 'send_grid_link', candidate_id: 11 }, { action: 'availability_for', member_id: 2, except: [] }, { action: 'set_first_password', password: 'Abcdefgh1' }]) {
    const r = await m.post(body);
    assert.equal(r.status, 403, body.action);
  }
  assert.deepEqual(m.snapshot(), before);
  assert.equal(m.rig.fetchLog.length, 0);
  assert.equal((await m.post({ action: 'welcome', flow_id: 21 })).status, 200, 'the welcome copy');
});

test('w275 Task 6 set_manager on an offered flow: allowed now; the old manager\'s propose link stops being theirs (manager_link_* cleared)', async () => {
  const s = await t6({ cand: { accepted_on: null }, fl: { status: 'offered', manager_link_member_id: 2, manager_link_sent_at: NOW_ISO } });
  const r = await s.post({ action: 'set_manager', flow_id: 21, member_id: 1 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const f = s.flow();
  assert.deepEqual([f.manager_member_id, f.manager_link_member_id, f.manager_link_sent_at], [1, null, null]);
});

/* ---------- wave275 Task 6, fix round 1: the card's own actions are for the new path only ---------- */
test('w275 Task 6 fix: on a wave271 flow (created before onboard_v2_since, nothing proposed) book, grid_for, set_welcome and set_ask_availability are refused with a plain reason, and nothing is written', async () => {
  const OLD = { created_at: '2026-09-20T12:00:00Z' };   // before SINCE, accepted, waiting, no proposal: Start is HR's way
  for (const [action, body] of [['book', { call_at: C_CALL, one_on_one_at: C_ONE }], ['grid_for', { who: 'hire', slots: ['2026-10-27T15:00:00Z'] }], ['set_welcome', { subject: 'a', text: 'b' }], ['set_ask_availability', { on: false }]]) {
    for (const who of [{}, { hr: false, manager: true }]) {
      const s = await t6({ fl: OLD, ...who });
      const before = s.snapshot();
      const r = await s.card(action, body);
      assert.equal(r.status, 409, action + ' ' + JSON.stringify(r.body));
      assert.equal(r.body.error, 'earlier_path', action);
      assert.match(r.body.message, /earlier onboarding path: use Choose times and preview, then Start onboarding/);
      assert.ok(noDash(r.body.message));
      assert.deepEqual(s.snapshot(), before, action + ': nothing written');
      assert.equal(s.rig.fetchLog.length, 0, action + ': nothing sent');
    }
  }
  const v2 = await t6({ fl: { ask_availability: false } });   // the same flow made after the release: the card books it
  await v2.acceptSetup();
  assert.equal((await v2.bookCard()).status, 200);
});

test('w275 Task 6 fix: times answers 503 when the hire\'s grid cannot be read, never an empty grid', async () => {
  const s = await t6({ fl: SAID_NO });
  s.db.failOn('hub_onboard_grids', 'select', 'grids are locked');
  const r = await s.card('times');
  assert.equal(r.status, 503, JSON.stringify(r.body));
  assert.match(r.body.message, /The new hire's times could not be read \(grids are locked\)/);
});

/* ---------- wave275 whole-branch fixes (02/11/26) ---------- */
test('w275 whole-branch I1: propose signed in (HR, or the flow\'s own manager) on a wave271 flow is refused as the earlier path, before anything is written; a flow made after the release still proposes', async () => {
  const OLD = { created_at: '2026-09-20T12:00:00Z' };   // before SINCE, waiting, nothing proposed: Start is HR's way
  for (const who of [{}, { hr: false, manager: true }]) {
    const s = await t3({ fl: OLD, ...who });
    if (who.manager) s.db.setCaller({ email: 'sam.lee@welfareavenue.com' });
    const before = s.snapshot();
    const r = await s.propose();
    assert.equal(r.status, 409, JSON.stringify(r.body));
    assert.equal(r.body.error, 'earlier_path');
    assert.match(r.body.message, /earlier onboarding path: use Choose times and preview, then Start onboarding/);
    assert.ok(noDash(r.body.message));
    assert.deepEqual(s.snapshot(), before, 'nothing written: no proposal, so the path stays wave271\'s');
    assert.equal(s.rig.fetchLog.length, 0, 'nothing sent');
  }
  const v2 = await t3();
  const r = await v2.propose();
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(v2.flow().proposed_by, 'hr.person@welfareavenue.com');
});

test('w275 whole-branch I2 (wave278): a Canva link HR saves on an accepted new-path card before booking is on the Hub page, not in the welcome email', async () => {
  const s = await t4();
  await s.acceptSetup();
  const set = await s.post({ action: 'set_canva_link', flow_id: 21, link: 'https://www.canva.com/brand/join?token=fresh-one' });
  assert.equal(set.status, 200, JSON.stringify(set.body));
  assert.equal(s.flow().canva_link, 'https://www.canva.com/brand/join?token=fresh-one');
  await s.book();
  assert.equal(s.step('welcome').status, 'done', s.step('welcome').detail);
  const text = mail(s.welcomes()[0]).bodies[0];
  assert.doesNotMatch(text, /canva\.com/, 'the Hub page shows it (onboard-link setup.canva)');
  assert.equal(numbers(text), '1234');
});

test('w275 whole-branch I4: Google\'s read-back can lag; the address and google_made_at are kept as soon as the account is made, and a read-back that answers on a later try ends done', async () => {
  const s = await t3({ google: (e) => ({ json: { id: 'g1', primaryEmail: e.body.primaryEmail } }) });   // made, but Google has not shown it yet
  assert.deepEqual(s.rig.mod.READ_BACK_WAITS, [1000, 2000, 4000], 'tried again after 1, 2 and 4 seconds');
  s.rig.mod.READ_BACK_WAITS.fill(0);   // the waits themselves, not the clock, are what this test is about
  let gets = 0;
  s.taken.has = (a) => { gets++; return gets >= 2 && a === 'alex.tremblay@welfareavenue.com'; };
  const said = await quietly(() => s.acceptSetup());
  assert.equal(s.step('google').status, 'done', s.step('google').detail);
  assert.equal(gets, 2, 'read back twice: the first missed, the second saw it');
  assert.equal(s.inserts().length, 1, 'one insert');
  assert.equal(s.flow().wa_email, 'alex.tremblay@welfareavenue.com');
  assert.ok(s.flow().setup_ticks.google_made_at, 'the Hub made it with the vault password');
  assert.equal(s.step('hub').status, 'done');
  s.noPw();
  assert.ok(!said.includes(FIRST_PW));
});

test('w275 whole-branch I4: a read-back that never answers ends the step as HR\'s (never failed, so Retry cannot ask Google for a second account), with google_made_at kept; HR\'s "I created it, continue" with the same address keeps it, another address clears it', async () => {
  const mk = async () => {
    const s = await t3({ google: (e) => ({ json: { id: 'g1', primaryEmail: e.body.primaryEmail } }) });
    s.rig.mod.READ_BACK_WAITS.fill(0);
    s.taken.has = () => false;
    return s;
  };
  const s = await mk();
  const said = await quietly(() => s.acceptSetup());
  const g = s.step('google');
  assert.equal(g.status, 'hr_task', g.detail);
  assert.match(g.detail, /^Google said it created alex\.tremblay@welfareavenue\.com, but has not shown the account yet\. Check it in Google Admin, then press "I created it, continue" on this card\.$/);
  assert.ok(noDash(g.detail));
  assert.equal(s.users().filter((e) => e.method === 'GET').length, 4, 'the read-back and three tries more');
  assert.equal(s.inserts().length, 1);
  assert.equal(s.flow().wa_email, 'alex.tremblay@welfareavenue.com', 'the address is kept, so the card offers it');
  assert.ok(s.flow().setup_ticks.google_made_at);
  s.noPw();
  assert.ok(!said.includes(FIRST_PW) && !g.detail.includes(FIRST_PW));
  const same = await s.post({ action: 'google_manual', flow_id: 21, wa_email: 'alex.tremblay@welfareavenue.com' });
  assert.equal(same.status, 200, JSON.stringify(same.body));
  assert.equal(s.step('google').status, 'done');
  assert.ok(s.flow().setup_ticks.google_made_at, 'the same account: the Hub made it with the vault password, so the welcome may give it');
  const other = await mk();
  await other.acceptSetup();
  const r = await other.post({ action: 'google_manual', flow_id: 21, wa_email: 'alex.t@welfareavenue.com' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(other.flow().setup_ticks.google_made_at ?? null, null, 'another address: HR made that one by hand, so the Hub does not know its password');
});

test('w275 whole-branch: Yes seconds after Accept, with the account step still running, sends no welcome until that step ends; then it goes with the login paragraph', async () => {
  let release, s;
  const gate = new Promise((r) => { release = r; });
  s = await t4({ google: (e) => gate.then(() => { s.taken.add(e.body.primaryEmail); return { json: { id: 'g1', primaryEmail: e.body.primaryEmail } }; }) });
  const accepting = s.acceptSetup();   // Accept: the roster step, then the Google insert waits on Google
  for (let i = 0; i < 100 && s.step('google')?.status !== 'running'; i++) await new Promise((r) => setTimeout(r, 5));
  assert.equal(s.step('google').status, 'running');
  const r = await s.book();   // the hire presses Yes now
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(s.welcomes().length, 0, 'nothing sent while the account step runs');
  assert.equal(s.flow().welcome_sent_at ?? null, null);
  assert.equal(s.step('welcome').status, 'waiting');
  assert.equal(s.step('welcome').detail, 'Waiting on step 2, Google account.');
  assert.equal(s.step('invites').status, 'done', 'the rest of the booking steps ran');
  release();
  await accepting;
  assert.equal(s.step('google').status, 'done', s.step('google').detail);
  assert.equal(s.step('welcome').status, 'done', s.step('welcome').detail);
  const sent = s.welcomes();
  assert.equal(sent.length, 1, 'sent once, when the account step ended');
  const text = mail(sent[0]).bodies[0];
  assert.match(text, /\n2\. Sign in to your Welfare Avenue Google account at mail\.google\.com:\n   Email: alex\.tremblay@welfareavenue\.com\n   First password: Lantern-Harbour-62\n/);
  assert.doesNotMatch(text, /HR will send your login details separately/);
  s.noPw();
  /* an account step that ends as HR's still lets the welcome go, with the other paragraph */
  const hr = await t4({ pw: null });
  await hr.acceptSetup();
  assert.equal(hr.step('google').status, 'hr_task');
  await hr.book();
  assert.equal(hr.step('welcome').status, 'done');
  assert.match(mail(hr.welcomes()[0]).bodies[0], /\n2\. HR will send your login details separately\.\n/);
});

test('w275 whole-branch: the template\'s marked places say they fill in when the times are booked or at Start, and a text saved with the old words still fills in', async () => {
  const s = await setup();
  const { welcome: w } = (await s.post({ action: 'preview', flow_id: 21 })).body;
  assert.match(w.text, /Your first day is \[first day: fills in when the times are booked or at Start\]/);
  assert.match(w.text, /\[offer letter link: fills in when the times are booked or at Start, or this line is left out\]/, 'wave278: the new places say the same');
  assert.doesNotMatch(w.text, /fills in at Start\]/);
  const fr = await setup({ cand: { summary: 'Français' } });
  const wf = (await fr.post({ action: 'preview', flow_id: 21 })).body.welcome.text;
  assert.match(wf, /\[premier jour : rempli à la réservation des rencontres ou au démarrage\]/);
  assert.doesNotMatch(wf, /—/);
  /* HR's text saved before this wording (wave271 is live): its brackets are still the Hub's to fill */
  const old = await t4({ fl: { ...PROPOSED, welcome_text: 'Dear Alex,\n\nYour first day is [first day: fills in at Start].\nCanva: [Canva link: fills in at Start, or this line is left out]\nManager: [manager: fills in at Start]', welcome_edited: true } });
  await old.acceptSetup();
  await old.book();
  const text = mail(old.welcomes()[0]).bodies[0];
  assert.match(text, /Your first day is Monday, October 26, 2026\./);
  assert.match(text, /\nManager: Sam Lee$/);
  assert.doesNotMatch(text, /\[|Canva/, 'the old Canva place with no link takes its line out, as before');
});

/* ---------- wave275b (03/11/26, Steel: "Can we make the availability check for onboarding optional"): onboard_manager_hours, off by default ----------
   Off (or absent, or anything but on): the manager's week is information, not a rule for times. Every other rule stays. The w275() rig sets it on, so
   the tests above are the "on" behaviour, which is today's. */
const HOURS_OFF = { onboard_manager_hours: 'off' };
const SAT_TIMES = { call_at: '2026-10-24T14:00:00Z', one_on_one_at: '2026-10-24T15:30:00Z' };   // Saturday 10:00 and 11:30 in Toronto: outside Monday to Friday 9 to 5
const dropSetting = (s, key) => { const rows = s.db.rows('app_config'); const i = rows.findIndex((r) => r.key === key); if (i >= 0) rows.splice(i, 1); };

test('w275b onboard_manager_hours off, absent or not "on": propose outside the manager\'s week is saved, and their hours are not even read; on (any case) refuses it, outside_hours', async () => {
  for (const value of ['off', '', 'yes', null]) {
    const s = await w275({ config: { onboard_manager_hours: value ?? 'on' } });
    if (value === null) dropSetting(s, 'onboard_manager_hours');
    const reads = [];
    s.db.onRpc('wa275_availability_of', (a) => { reads.push(a); throw new Error('the hours are not a rule now'); });
    const r = await s.propose(SAT_TIMES);
    assert.equal(r.status, 200, String(value) + ': ' + JSON.stringify(r.body));
    assert.equal(s.flow().proposed_call_at, '2026-10-24T14:00:00.000Z');
    assert.equal(reads.length, 0, String(value) + ': the manager\'s hours are not read');
  }
  for (const value of ['on', ' ON ']) refused(await (await w275({ config: { onboard_manager_hours: value } })).propose(SAT_TIMES), 'outside_hours', 'call');
  const mgr = await w275({ hr: false, config: HOURS_OFF });   // the mgr link relays to the same rules
  assert.equal((await mgr.asLink(SAT_TIMES)).status, 200);
});

test('w275b onboard_manager_hours off: every other rule stays (lead time, overlap, a hub@ meeting the manager is invited to, another new hire\'s times, already booked)', async () => {
  refused(await (await w275({ config: HOURS_OFF })).propose({ call_at: '2026-10-21T14:00:00Z' }), 'lead_time', 'call');
  refused(await (await w275({ config: HOURS_OFF })).propose({ call_at: '2026-10-24T14:00:00Z', one_on_one_at: '2026-10-24T14:30:00Z' }), 'overlap');
  const ev = { id: 'e1', summary: 'Board', attendee_emails: ['sam.lee@welfareavenue.com'], status: 'confirmed', start_at: '2026-10-24T14:30:00Z', end_at: '2026-10-24T15:00:00Z' };
  refused(await (await w275({ config: HOURS_OFF, tables: { hub_events: [ev] } })).propose(SAT_TIMES), 'busy', 'call');
  const other = flow({ id: 22, candidate_id: 12, manager_member_id: 2, call_at: '2026-10-24T15:00:00Z' });
  refused(await (await w275({ config: HOURS_OFF, tables: { hub_candidates: [candidate(), candidate({ id: 12, name: 'Bo Chen' })] }, flows: [other] })).propose(SAT_TIMES), 'taken', 'one_on_one');
  refused(await (await w275({ config: HOURS_OFF, fl: { call_at: P_CALL } })).propose(), 'already_booked');
});

test('w275b onboard_manager_hours off: the hire\'s Yes books times outside the manager\'s week; on, the same times are stale', async () => {
  const sam = SAM_AT({ weekly: { mon: [['13:00', '17:00']] } });   // Monday 10:00 is outside 1 to 5
  const s = await t3({ fl: PROPOSED, tables: sam, config: HOURS_OFF });
  await s.acceptSetup();
  const r = await s.book();
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([s.flow().call_at, s.flow().hire_answer], [P_CALL, 'yes']);
  const on = await t3({ fl: PROPOSED, tables: sam });
  await on.acceptSetup();
  refused(await on.book(), 'stale', 'call');
});

test('w275b onboard_manager_hours off: HR books from the card outside the manager\'s week; on, outside_hours', async () => {
  const s = await t6({ fl: SAID_NO, config: HOURS_OFF });
  await s.acceptSetup();
  const r = await s.bookCard({ call_at: '2026-10-27T22:00:00.000Z' });   // Tuesday 6 pm
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(s.flow().call_at, '2026-10-27T22:00:00.000Z');
  refused(await (await t6({ fl: SAID_NO })).bookCard({ call_at: '2026-10-27T22:00:00.000Z' }), 'outside_hours', 'call');
});

test('w275b times {flow_id}: manager_hours says whether the week limits the times; the week is still sent, for information, and a failed read of it no longer stops the picker when it is off', async () => {
  const off = await t6({ fl: SAID_NO, config: HOURS_OFF });
  const r = await off.card('times');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.manager_hours, false);
  assert.deepEqual(r.body.availability.weekly.mon, [['09:00', '17:00']], 'the week, for information');
  assert.equal(r.body.no_week, true);
  const on = await t6({ fl: SAID_NO });
  assert.equal((await on.card('times')).body.manager_hours, true);
  const absent = await t6({ fl: SAID_NO });
  dropSetting(absent, 'onboard_manager_hours');
  assert.equal((await absent.card('times')).body.manager_hours, false, 'absent is off');
  const down = await t6({ fl: SAID_NO, config: HOURS_OFF });
  down.db.onRpc('wa275_availability_of', () => { throw new Error('rig: availability is down'); });
  const d = await down.card('times');
  assert.equal(d.status, 200, JSON.stringify(d.body));
  assert.deepEqual([d.body.availability, d.body.manager_hours], [null, false]);
  assert.ok(Array.isArray(d.body.busy), 'the hub@ meetings still come');
  const downOn = await t6({ fl: SAID_NO });
  downOn.db.onRpc('wa275_availability_of', () => { throw new Error('rig: availability is down'); });
  assert.equal((await downOn.card('times')).status, 503, 'on, the hours are a rule: a failed read is still a 503');
});

/* ---------- wave278 Task 3: Google Groups and shared drives at Accept, the weekly meeting at booking, the Slack onboarding channel once they are in Slack ---------- */
/* the settings as wa278a seeds them (onboard_groups word for word), with made-up drive ids in place of "<fill at release>" */
const W8_GROUPS = '{"all": ["org@welfareavenue.com"], "leaders": ["admin@welfareavenue.com", "directors@welfareavenue.com"], "by_department": {"marketing": ["marketing@welfareavenue.com"], "fundraising": ["fundraising@welfareavenue.com", "grants@welfareavenue.com"], "opsmtl": ["operations@welfareavenue.com"], "opsto": ["operations@welfareavenue.com", "toronto@welfareavenue.com"], "outreach": ["outreach@welfareavenue.com"], "hr": ["job@welfareavenue.com"], "finance": ["finance@welfareavenue.com"], "progdev": []}}';
const W8_PLACEHOLDER_DRIVES = '{"all": ["<fill at release>"], "leaders_all_except": ["<fill at release>", "<fill at release>"], "by_department": {"marketing": ["<fill at release>"], "fundraising": ["<fill at release>"], "opsmtl": ["<fill at release>"], "opsto": ["<fill at release>", "<fill at release>"], "hr": ["<fill at release>"], "progdev": ["<fill at release>"], "finance": ["<fill at release>"]}}';
const W8_DRIVES = JSON.stringify({ all: ['d-org'], leaders_all_except: ['d-acct', 'd-board'], by_department: { marketing: ['d-mkt'], fundraising: ['d-fund'], opsmtl: ['d-ops'], opsto: ['d-ops', 'd-to'], hr: ['d-hr'], progdev: ['d-prog'], finance: ['d-acct'] } });
const W8_LIST = [{ id: 'd-org', name: 'Org\'s Files' }, { id: 'd-acct', name: 'Accounting' }, { id: 'd-board', name: 'Board of Directors' }, { id: 'd-mkt', name: 'Marketing & Web' }, { id: 'd-fund', name: 'Fundraising' }, { id: 'd-ops', name: 'Operations' }, { id: 'd-to', name: 'Toronto Branch' }, { id: 'd-hr', name: 'Human Resources' }, { id: 'd-prog', name: 'Program Development' }];
const W8_ON = {
  onboard_auto_groups: 'on', onboard_auto_drives: 'on', onboard_auto_meeting: 'on', onboard_auto_channel: 'on', onboard_leader_titles: 'director, lead, head, chief, manager',
  onboard_groups: W8_GROUPS, onboard_drives: W8_DRIVES, onboard_weekly_meetings: '{}', onboard_slack_channel_id: 'C0ONBOARD',
};
const W8_WA = 'alex.tremblay@welfareavenue.com', W8_NEW = ['groups', 'drives', 'meeting', 'channel'];
const W8_FUND = ['org@welfareavenue.com', 'fundraising@welfareavenue.com', 'grants@welfareavenue.com'];
const W8_LEAD = ['admin@welfareavenue.com', 'directors@welfareavenue.com'];
const W8_INVITE = 'https://slack.com/api/conversations.invite';
async function t8({ title = 'Grants Coordinator', dept = 'fundraising', config = {}, tables = {}, ...o } = {}) {
  const s = await t6({ ...o, config: { ...W8_ON, ...config }, tables: { hub_positions: [{ id: 5, title, dept, jd_url: 'https://docs.example.com/jd' }], ...tables } });
  s.rig.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
  s.w = accessRoutes(s.rig, { drives: structuredClone(W8_LIST) });
  s.groupAdds = () => s.rig.fetchLog.filter((e) => e.url.includes('/admin/directory/v1/groups/'));
  s.groupsAsked = () => s.groupAdds().map((e) => decodeURIComponent(e.url.split('/groups/')[1].split('/')[0]));
  s.drive = () => s.rig.fetchLog.filter((e) => e.url.includes('/drive/v3/'));
  s.perms = () => s.rig.fetchLog.filter((e) => e.url.includes('/drive/v3/files/'));
  s.permIds = () => s.perms().map((e) => decodeURIComponent(e.url.split('/files/')[1].split('/')[0]));
  s.lookups = () => s.rig.fetchLog.filter((e) => e.url.startsWith('https://slack.com/api/users.lookupByEmail'));
  s.lookedUp = () => s.lookups().map((e) => new URL(e.url).searchParams.get('email'));
  s.slackInvites = () => s.rig.fetchLog.filter((e) => e.url === W8_INVITE);
  s.slackAll = () => s.rig.fetchLog.filter((e) => e.url.startsWith('https://slack.com/'));
  s.ticks = () => s.flow().setup_ticks || {};
  s.remind = async () => { const r = await s.post({ action: 'remind' }, SECRET); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; };
  s.booked = async () => {
    assert.equal((await s.acceptSetup()).status, 200);
    const r = await s.book();
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r;
  };
  return s;
}

test('wave278 leaderOf: a word of onboard_leader_titles, whole and in any case, makes the title a leader\'s', async () => {
  const s = await setup();
  const L = (t) => s.rig.mod.leaderOf(t, 'director, lead, head, chief, manager');
  assert.equal(L('Fundraising Director'), true);
  assert.equal(L('Community Manager'), true, 'Review Focus 1: a leader by the rule; HR changes it on the card');
  assert.equal(L('Coordinator'), false);
  assert.equal(L('Head of Grants'), true);
  assert.equal(L('Program Coordinator'), false);
  assert.equal(L('Team LEAD'), true);
  assert.equal(L('Managerial Assistant'), false, 'a whole word only');
  assert.equal(L('Leadership Intern'), false);
  assert.equal(L(null), false);
  assert.equal(L(''), false);
  assert.equal(s.rig.mod.leaderOf('Director', ''), false, 'no titles, no leader');
});

test('wave278 STEPS: the four access steps follow the existing ones; groups and drives at Accept (need google), the meeting at booking, the channel later; the welcome waits for the meeting', async () => {
  const s = await setup();
  assert.deepEqual(s.rig.mod.STEPS.map((e) => e.key), ALL_KEYS);
  assert.deepEqual(W8_NEW.map((k) => [s.entry(k).at, s.entry(k).setting, s.entry(k).needs]), [
    ['accept', 'onboard_auto_groups', ['google']], ['accept', 'onboard_auto_drives', ['google']], ['booking', 'onboard_auto_meeting', ['roster']], ['later', 'onboard_auto_channel', ['roster']],
  ]);
  for (const k of W8_NEW) assert.ok(s.entry(k).task && noDash(s.entry(k).task), k);
  const all = (o) => s.rig.mod.nextSteps(ALL_KEYS.map((k) => ({ step: k, status: o[k] || 'pending' }))).filter((k) => W8_NEW.includes(k));
  assert.deepEqual(all({ roster: 'done' }), ['channel'], 'groups and drives need the account; the meeting waits while it has not ended');
  assert.deepEqual(all({ roster: 'done', google: 'done' }), W8_NEW);
  assert.deepEqual(all({ roster: 'done', google: 'hr_task' }), ['meeting', 'channel']);
  const next = (o) => s.rig.mod.nextSteps(ALL_KEYS.map((k) => ({ step: k, status: o[k] || 'pending' })));
  assert.ok(!next({ roster: 'done', google: 'done', invites: 'done' }).includes('welcome'), 'the meeting has not ended: the welcome waits for it');
  for (const m of ['done', 'hr_task', 'failed', 'skipped']) assert.ok(next({ roster: 'done', google: 'done', invites: 'done', meeting: m }).includes('welcome'), 'meeting ' + m);
});

test('wave278 groups at Accept: a fundraising member joins org@, fundraising@ and grants@ as MEMBER, as Steel with the group member scope, after the account exists; no leaders\' group', async () => {
  const s = await t8();
  const r = await s.acceptSetup();
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(s.groupsAsked(), W8_FUND);
  s.groupAdds().forEach((e, i) => {
    assert.equal(e.method, 'POST');
    assert.equal(e.url, 'https://admin.googleapis.com/admin/directory/v1/groups/' + encodeURIComponent(W8_FUND[i]) + '/members');
    assert.deepEqual(e.body, { email: W8_WA, role: 'MEMBER' });
    assert.equal(e.headers.authorization, 'Bearer tok:https://www.googleapis.com/auth/admin.directory.group.member:steel.macdonald@welfareavenue.com');
  });
  assert.ok(s.rig.fetchLog.indexOf(s.groupAdds()[0]) > s.rig.fetchLog.indexOf(s.inserts()[0]), 'after the account is made');
  assert.equal(s.step('groups').status, 'done');
  assert.match(s.step('groups').detail, /^Joining as a member\./);
  for (const g of W8_FUND) assert.ok(s.step('groups').detail.includes(g), g);
  assert.deepEqual(s.ticks().groups_added, W8_FUND, 'the rundown lists them');
  assert.equal(s.flow().leader, false);
  assert.ok(s.rows('change_log').some((l) => l.field === 'leader' && l.old_value === null && l.new_value === 'member'));
  assert.ok(noDash(s.step('groups').detail));
  assert.ok(s.flow().accounts_at, 'the account steps alone decide accounts_at');
  assert.deepEqual(s.rig.unregistered(), []);
});

test('wave278 groups: a leader (the position\'s title) also joins admin@ and directors@; the card says so', async () => {
  const s = await t8({ title: 'Fundraising Director' });
  assert.equal((await s.acceptSetup()).status, 200);
  assert.deepEqual(s.groupsAsked(), [...W8_FUND, ...W8_LEAD]);
  assert.equal(s.flow().leader, true);
  assert.equal(s.step('groups').status, 'done');
  assert.match(s.step('groups').detail, /^Joining as a leader\./);
  assert.deepEqual(s.ticks().groups_added, [...W8_FUND, ...W8_LEAD]);
  const none = await t8({ tables: { hub_positions: [] } });
  assert.equal((await none.acceptSetup()).status, 200);
  assert.equal(none.flow().leader, false, 'no position: a member');
  const set = await t8({ title: 'Fundraising Director', fl: { leader: false } });
  assert.equal((await set.acceptSetup()).status, 200);
  assert.equal(set.flow().leader, false, 'a decision already made is kept');
  assert.ok(!set.groupsAsked().includes('admin@welfareavenue.com'));
});

test('wave278 groups: a group that does not exist (404, toronto@) is reported and the step is still done; already a member (409) counts as done', async () => {
  const s = await t8({ dept: 'opsto', title: 'Operations Coordinator' });
  s.w.groups['toronto@welfareavenue.com'] = { status: 404, json: { error: { code: 404, message: 'Resource Not Found: groupKey' } } };
  s.w.groups['org@welfareavenue.com'] = { status: 409, json: { error: { code: 409, message: 'Member already exists.' } } };
  assert.equal((await s.acceptSetup()).status, 200);
  assert.deepEqual(s.groupsAsked(), ['org@welfareavenue.com', 'operations@welfareavenue.com', 'toronto@welfareavenue.com'], 'asked once each, no loop');
  assert.equal(s.step('groups').status, 'done', s.step('groups').detail);
  assert.match(s.step('groups').detail, /no Toronto group yet/);
  assert.deepEqual(s.ticks().groups_added, ['org@welfareavenue.com', 'operations@welfareavenue.com']);
  const m = await t8({ dept: 'marketing', title: 'Marketing Coordinator' });
  m.w.groups['marketing@welfareavenue.com'] = { status: 404, json: { error: { code: 404, message: 'Resource Not Found: groupKey' } } };
  assert.equal((await m.acceptSetup()).status, 200);
  assert.equal(m.step('groups').status, 'done');
  assert.match(m.step('groups').detail, /marketing@welfareavenue\.com does not exist/);
});

test('wave278 groups: any other refusal (403 on one group) ends the step as HR\'s, naming the group and Google\'s reason; the other groups are still added, once', async () => {
  const s = await t8();
  s.w.groups['grants@welfareavenue.com'] = { status: 403, json: { error: { code: 403, message: 'Not Authorized to access this resource/api' } } };
  assert.equal((await s.acceptSetup()).status, 200);
  assert.deepEqual(s.groupsAsked(), W8_FUND);
  const g = s.step('groups');
  assert.equal(g.status, 'hr_task');
  assert.match(g.detail, /grants@welfareavenue\.com/);
  assert.match(g.detail, /Not Authorized/);
  assert.match(g.detail, /^Joining as a member\./);
  assert.ok(noDash(g.detail));
  assert.deepEqual(s.ticks().groups_added, ['org@welfareavenue.com', 'fundraising@welfareavenue.com']);
});

test('wave278 drives at Accept: a member gets Org\'s Files and the department\'s drive as writer, as Steel with the drive scope, with no Drive email; the names are kept for the rundown', async () => {
  const s = await t8();
  assert.equal((await s.acceptSetup()).status, 200);
  assert.deepEqual(s.permIds(), ['d-org', 'd-fund']);
  for (const e of s.perms()) {
    assert.equal(e.method, 'POST');
    assert.equal(e.url, 'https://www.googleapis.com/drive/v3/files/' + s.permIds()[s.perms().indexOf(e)] + '/permissions?supportsAllDrives=true&sendNotificationEmail=false&useDomainAdminAccess=true', 'Steel shares as a domain admin');
    assert.deepEqual(e.body, { type: 'user', role: 'writer', emailAddress: W8_WA });
    assert.equal(e.headers.authorization, 'Bearer tok:https://www.googleapis.com/auth/drive:steel.macdonald@welfareavenue.com');
  }
  assert.equal(s.step('drives').status, 'done', s.step('drives').detail);
  assert.match(s.step('drives').detail, /Org's Files and Fundraising/);
  assert.deepEqual(s.ticks().drives_added, ['Org\'s Files', 'Fundraising']);
  assert.ok(noDash(s.step('drives').detail));
  assert.deepEqual(s.rig.unregistered(), []);
});

test('wave278 drives: a leader gets every shared drive Google lists (as a domain admin) but Accounting and Board of Directors', async () => {
  const s = await t8({ title: 'Fundraising Director' });
  assert.equal((await s.acceptSetup()).status, 200);
  const list = s.drive().filter((e) => e.method === 'GET');
  assert.equal(list.length, 1);
  assert.ok(list[0].url.startsWith('https://www.googleapis.com/drive/v3/drives?pageSize=100'));
  assert.ok(list[0].url.includes('useDomainAdminAccess=true'), 'the plain list shows only the drives Steel is in');
  assert.deepEqual([...s.permIds()].sort(), ['d-fund', 'd-hr', 'd-mkt', 'd-ops', 'd-org', 'd-prog', 'd-to']);
  assert.equal(s.step('drives').status, 'done', s.step('drives').detail);
  assert.ok(!s.ticks().drives_added.includes('Accounting') && !s.ticks().drives_added.includes('Board of Directors'));
  assert.equal(s.ticks().drives_added.length, 7);
});

test('wave278 drives: "already has access" counts as done; another refusal is HR\'s with the drive\'s name; the placeholder ids are never sent to Drive ("Drives not set up yet")', async () => {
  const s = await t8();
  s.w.permission = (id) => (id === 'd-org' ? { status: 400, json: { error: { code: 400, message: 'The user already has access to this shared drive.' } } } : null);
  assert.equal((await s.acceptSetup()).status, 200);
  assert.equal(s.step('drives').status, 'done', s.step('drives').detail);
  assert.deepEqual(s.ticks().drives_added, ['Org\'s Files', 'Fundraising']);
  const f = await t8();
  f.w.permission = (id) => (id === 'd-fund' ? { status: 403, json: { error: { code: 403, message: 'Insufficient permissions for this file.' } } } : null);
  assert.equal((await f.acceptSetup()).status, 200);
  assert.equal(f.step('drives').status, 'hr_task');
  assert.match(f.step('drives').detail, /Fundraising/);
  assert.match(f.step('drives').detail, /Insufficient permissions/);
  assert.deepEqual(f.ticks().drives_added, ['Org\'s Files']);
  const word = await t8();   // fix round 1: "already" in another refusal is not access
  word.w.permission = (id) => (id === 'd-fund' ? { status: 403, json: { error: { code: 403, message: 'This shared drive already has the most members it can have.' } } } : null);
  assert.equal((await word.acceptSetup()).status, 200);
  assert.equal(word.step('drives').status, 'hr_task', word.step('drives').detail);
  assert.deepEqual(word.ticks().drives_added, ['Org\'s Files']);
  const has = await t8();   // the words Drive uses, whatever the status
  has.w.permission = (id) => (id === 'd-fund' ? { status: 403, json: { error: { code: 403, message: 'The user already has access to this shared drive.' } } } : null);
  assert.equal((await has.acceptSetup()).status, 200);
  assert.equal(has.step('drives').status, 'done', has.step('drives').detail);
  for (const title of ['Grants Coordinator', 'Fundraising Director']) {
    const p = await t8({ title, config: { onboard_drives: W8_PLACEHOLDER_DRIVES } });
    assert.equal((await p.acceptSetup()).status, 200);
    assert.equal(p.step('drives').status, 'hr_task', title);
    assert.match(p.step('drives').detail, /Drives not set up yet/, title);
    assert.equal(p.drive().length, 0, 'nothing went to Drive');
    assert.ok(!JSON.stringify(p.rig.fetchLog.map((e) => e.url)).includes('fill'), title);
    assert.equal(p.step('groups').status, 'done', 'the groups do not wait on the drives');
  }
});

const W8_EVENTS = [
  { id: 'recfund_20261015T150000Z', recurring_event_id: 'recfund', calendar_id: 'hub@welfareavenue.com', organizer: 'ruth.owen@welfareavenue.com', summary: 'Fundraising weekly', start_at: '2026-10-15T15:00:00Z', end_at: '2026-10-15T16:00:00Z', status: 'confirmed', attendee_emails: ['ruth.owen@welfareavenue.com'] },
  { id: 'recfund_20261029T150000Z', recurring_event_id: 'recfund', calendar_id: 'hub@welfareavenue.com', organizer: 'ruth.owen@welfareavenue.com', summary: 'Fundraising weekly', start_at: '2026-10-29T15:00:00Z', end_at: '2026-10-29T16:00:00Z', status: 'confirmed', attendee_emails: ['ruth.owen@welfareavenue.com'] },
  { id: 'recfund_20261022T150000Z', recurring_event_id: 'recfund', calendar_id: 'hub@welfareavenue.com', organizer: 'ruth.owen@welfareavenue.com', summary: 'Fundraising weekly', start_at: '2026-10-22T15:00:00Z', end_at: '2026-10-22T16:00:00Z', status: 'confirmed', attendee_emails: ['ruth.owen@welfareavenue.com'] },
];
const W8_GUESTS = [{ email: 'ruth.owen@welfareavenue.com', organizer: true, responseStatus: 'accepted' }, { email: 'sam.lee@welfareavenue.com', responseStatus: 'accepted' }];
function w8Master(s, guests = W8_GUESTS) {
  s.calReply = (e) => {
    if (!e.url.includes('/events/recfund')) return null;
    if (e.method === 'GET') return { json: { id: 'recfund', summary: 'Fundraising weekly', recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=TH'], start: { dateTime: '2026-09-03T11:00:00-04:00' }, attendees: structuredClone(guests) } };
    return { json: { id: 'recfund', summary: 'Fundraising weekly', attendees: e.body.attendees } };
  };
  s.master = () => s.cal().filter((e) => e.url.includes('/events/recfund'));
}
const W8_MAPPED = { onboard_weekly_meetings: '{"fundraising": "recfund"}' };

test('wave278 meeting at booking: the hire\'s address is added to their department\'s weekly meeting on the organizer\'s calendar, as the organizer, keeping every guest; Google sends the invite', async () => {
  const s = await t8({ fl: PROPOSED, config: W8_MAPPED, tables: { hub_events: structuredClone(W8_EVENTS) } });
  w8Master(s);
  await s.booked();
  const [get, patch, ...rest] = s.master();
  assert.equal(rest.length, 0);
  assert.equal(get.method, 'GET');
  assert.equal(get.url, 'https://www.googleapis.com/calendar/v3/calendars/ruth.owen%40welfareavenue.com/events/recfund');
  assert.equal(patch.method, 'PATCH');
  assert.equal(patch.url, 'https://www.googleapis.com/calendar/v3/calendars/ruth.owen%40welfareavenue.com/events/recfund?sendUpdates=none', 'nobody is emailed: the other guests are not touched');
  assert.deepEqual(patch.body, { attendees: [...W8_GUESTS, { email: W8_WA }] }, 'the other guests are kept as they were');
  for (const e of [get, patch]) assert.equal(e.headers.authorization, 'Bearer tok:https://www.googleapis.com/auth/calendar.events:ruth.owen@welfareavenue.com');
  assert.equal(s.step('meeting').status, 'done', s.step('meeting').detail);
  assert.match(s.step('meeting').detail, /Fundraising weekly/);
  assert.match(s.step('meeting').detail, /added to the series; it shows in their Welfare Avenue calendar/);
  assert.doesNotMatch(s.step('meeting').detail, /sent them the invite/);
  assert.ok(noDash(s.step('meeting').detail));
  assert.deepEqual(s.ticks().weekly_meeting, { summary: 'Fundraising weekly', next_at: '2026-10-22T15:00:00.000Z' }, 'the next one from now');
  const sent = s.gmail().find((e) => /Welcome to Welfare Avenue/.test(mail(e).subject));
  assert.ok(sent && s.rig.fetchLog.indexOf(sent) > s.rig.fetchLog.indexOf(patch), 'the welcome goes once the meeting step has ended');
  assert.deepEqual(s.rig.unregistered(), []);

  const already = await t8({ fl: PROPOSED, config: W8_MAPPED, tables: { hub_events: structuredClone(W8_EVENTS) } });
  w8Master(already, [...W8_GUESTS, { email: 'Alex.Tremblay@welfareavenue.com', responseStatus: 'needsAction' }]);
  await already.booked();
  assert.deepEqual(already.master().map((e) => e.method), ['GET'], 'already a guest: nothing to change');
  assert.equal(already.step('meeting').status, 'done');

  const outside = await t8({ fl: PROPOSED, config: W8_MAPPED, tables: { hub_events: structuredClone(W8_EVENTS).map((e) => ({ ...e, organizer: 'someone@gmail.com' })) } });
  w8Master(outside);
  await outside.booked();
  assert.equal(outside.master()[0].url, 'https://www.googleapis.com/calendar/v3/calendars/hub%40welfareavenue.com/events/recfund', 'an organizer outside Welfare Avenue: hub@\'s calendar');
  assert.equal(outside.master()[0].headers.authorization, 'Bearer tok:https://www.googleapis.com/auth/calendar.events:hub@welfareavenue.com');
});

test('wave278 meeting: no weekly meeting set for the department is HR\'s, in a plain sentence; the welcome still goes', async () => {
  const s = await t8({ fl: PROPOSED });
  w8Master(s);
  await s.booked();
  assert.equal(s.step('meeting').status, 'hr_task');
  assert.match(s.step('meeting').detail, /no weekly meeting set for fundraising/);
  assert.ok(noDash(s.step('meeting').detail));
  assert.equal(s.master().length, 0);
  assert.equal(s.step('welcome').status, 'done');
});

test('wave278 channel: not run at booking; the hourly job looks for them by their Welfare Avenue address, then their personal one, and waits (no error) while they are not in Slack', async () => {
  const s = await t8({ fl: PROPOSED });
  await s.booked();
  assert.equal(s.step('channel').status, 'pending');
  assert.equal(s.slackAll().length, 0, 'the channel step runs from the hourly job only');
  assert.equal(s.flow().status, 'started', 'a channel step waiting for Slack leaves nothing for HR');
  await s.remind();
  assert.deepEqual(s.lookedUp(), [W8_WA, 'alex@example.com']);
  for (const e of s.lookups()) assert.equal(e.headers.authorization, 'Bearer xoxb-test-token');
  assert.equal(s.slackInvites().length, 0);
  assert.equal(s.step('channel').status, 'pending');
  assert.match(s.step('channel').detail, /waiting for them to join Slack/i);
  assert.ok(noDash(s.step('channel').detail));
  s.w.slack[W8_WA] = 'U0WA';
  await s.remind();
  const [inv] = s.slackInvites();
  assert.equal(inv.method, 'POST');
  assert.deepEqual(inv.body, { channel: 'C0ONBOARD', users: 'U0WA' });
  assert.equal(inv.headers.authorization, 'Bearer xoxb-test-token');
  assert.equal(s.step('channel').status, 'done', s.step('channel').detail);
  assert.ok(s.rows('wa_slack_ids').some((r) => r.email === W8_WA && r.slack_id === 'U0WA'), 'kept for notify, as notify keeps it');
  await s.remind();
  assert.equal(s.slackInvites().length, 1, 'done is done');
  assert.deepEqual(s.rig.unregistered(), []);
});

test('wave278 channel (Review Focus 3): someone in Slack with their personal address is found by it and invited; one already in the channel is done; a saved Slack id needs no lookup', async () => {
  const p = await t8({ fl: PROPOSED });
  p.w.slack['alex@example.com'] = 'U0ME';
  await p.booked();
  await p.remind();
  assert.deepEqual(p.lookedUp(), [W8_WA, 'alex@example.com']);
  assert.deepEqual(p.slackInvites()[0].body, { channel: 'C0ONBOARD', users: 'U0ME' });
  assert.equal(p.step('channel').status, 'done');
  const a = await t8({ fl: PROPOSED });
  a.w.slack[W8_WA] = 'U0WA';
  a.w.invite = () => ({ json: { ok: false, error: 'already_in_channel' } });
  await a.booked();
  await a.remind();
  assert.equal(a.step('channel').status, 'done', a.step('channel').detail);
  const k = await t8({ fl: PROPOSED, tables: { wa_slack_ids: [{ email: 'alex@example.com', slack_id: 'U0SAVED' }] } });
  await k.booked();
  await k.remind();
  assert.equal(k.lookups().length, 0);
  assert.deepEqual(k.slackInvites()[0].body, { channel: 'C0ONBOARD', users: 'U0SAVED' });
});

test('wave278 channel: after 14 days from Accept it is HR\'s ("has not joined Slack yet"); missing_scope names the scope; no channel id is HR\'s and asks Slack nothing', async () => {
  const s = await t8({ fl: PROPOSED });
  await s.booked();
  s.rig.setNow('2026-11-02T12:00:00Z');   // 13 days after Accept
  await s.remind();
  assert.equal(s.step('channel').status, 'pending');
  s.rig.setNow('2026-11-03T12:30:00Z');   // past 14 days
  await s.remind();
  assert.equal(s.step('channel').status, 'hr_task');
  assert.match(s.step('channel').detail, /has not joined Slack yet/);
  assert.ok(noDash(s.step('channel').detail));
  const n = s.lookups().length;
  await s.remind();
  assert.equal(s.lookups().length, n, 'HR\'s now: the hourly job stops looking');
  const m = await t8({ fl: PROPOSED });
  m.w.slack[W8_WA] = 'U0WA';
  m.w.invite = () => ({ json: { ok: false, error: 'missing_scope', needed: 'channels:manage', provided: 'chat:write,users:read,users:read.email' } });
  await m.booked();
  await m.remind();
  assert.equal(m.step('channel').status, 'hr_task');
  assert.match(m.step('channel').detail, /channels:manage/);
  const e = await t8({ fl: PROPOSED, config: { onboard_slack_channel_id: '' } });
  e.w.slack[W8_WA] = 'U0WA';
  await e.booked();
  await e.remind();
  assert.equal(e.step('channel').status, 'hr_task');
  assert.match(e.step('channel').detail, /no channel id/);
  assert.equal(e.slackAll().length, 0);
});

test('wave278: each new step with its switch off is HR\'s with its own sentence, and nothing is asked of Google or Slack', async () => {
  const off = { onboard_auto_groups: 'off', onboard_auto_drives: 'off', onboard_auto_meeting: 'off', onboard_auto_channel: 'off', ...W8_MAPPED };
  const s = await t8({ fl: PROPOSED, config: off, tables: { hub_events: structuredClone(W8_EVENTS) } });
  w8Master(s);
  await s.booked();
  await s.remind();
  for (const k of W8_NEW) {
    assert.equal(s.step(k).status, 'hr_task', k);
    assert.equal(s.step(k).detail, s.entry(k).task, k);
  }
  assert.equal(s.groupAdds().length + s.drive().length + s.slackAll().length + s.master().length, 0);
  assert.equal(s.flow().status, 'started');
});

test('wave278 practice: all four steps simulate at Accept and booking, and nothing is fetched', async () => {
  const s = await t8({ cand: { practice: true }, fl: PROPOSED, config: W8_MAPPED, tables: { hub_events: structuredClone(W8_EVENTS) } });
  await s.booked();
  await s.remind();
  for (const k of W8_NEW) {
    assert.equal(s.step(k).status, 'done', k);
    assert.match(s.step(k).detail, /practice/i, k);
  }
  assert.equal(s.rig.fetchLog.length, 0);
  assert.equal(s.flow().status, 'started');
});

test('wave278 set_leader {flow_id, leader}: the hire\'s manager may change it; the column is written and logged, and groups and drives run again (adding, never removing)', async () => {
  const s = await t8({ hr: false, manager: true });
  assert.equal((await s.acceptSetup()).status, 200);
  assert.equal(s.flow().leader, false);
  const r = await s.card('set_leader', { leader: true });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.leader, true);
  assert.equal(s.flow().leader, true);
  assert.deepEqual(s.groupsAsked(), [...W8_FUND, ...W8_FUND, ...W8_LEAD], 'the groups ran again, with the leaders\' two');
  assert.match(s.step('groups').detail, /^Joining as a leader\./);
  assert.equal(s.step('drives').status, 'done');
  assert.equal(s.permIds().length, 2 + 7, 'the drives ran again, as a leader\'s');
  assert.ok(s.rows('change_log').some((l) => l.field === 'leader' && l.old_value === 'member' && l.new_value === 'leader'));
  assert.ok(Array.isArray(r.body.steps));
  const again = await s.card('set_leader', { leader: true });
  assert.equal(again.body.repeated, true);
  assert.equal(s.groupsAsked().length, 8, 'a repeat runs nothing');
  const back = await s.card('set_leader', { leader: false });
  assert.equal(back.status, 200);
  assert.ok(back.body.warnings.some((w) => /never removes/.test(w) && /admin@welfareavenue\.com/.test(w)), JSON.stringify(back.body.warnings));
  for (const w of back.body.warnings) assert.ok(noDash(w));
  assert.equal(s.rig.fetchLog.filter((e) => e.method === 'DELETE').length, 0, 'nothing is removed');
  assert.equal((await s.card('set_leader', { leader: 'yes' })).status, 400);
  assert.deepEqual(s.rig.unregistered(), []);
});

test('wave278 recheck_access {flow_id}: groups and drives run again for HR; a plain member on another hire\'s card is refused set_leader, recheck_access and set_welcome_cc, and nothing changes', async () => {
  const s = await t8();
  assert.equal((await s.acceptSetup()).status, 200);
  s.w.groups['org@welfareavenue.com'] = { status: 409, json: { error: { code: 409, message: 'Member already exists.' } } };
  const r = await s.card('recheck_access');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(s.groupsAsked(), [...W8_FUND, ...W8_FUND]);
  assert.deepEqual(s.permIds(), ['d-org', 'd-fund', 'd-org', 'd-fund']);
  assert.deepEqual([s.step('groups').status, s.step('drives').status], ['done', 'done']);
  const x = await t8({ hr: false, manager: false });
  assert.equal((await x.acceptSetup()).status, 200);
  const before = x.snapshot(), n = x.rig.fetchLog.length;
  for (const [action, body] of [['set_leader', { leader: true }], ['recheck_access', {}], ['set_welcome_cc', { emails: ['ruth.owen@welfareavenue.com'] }]]) {
    const out = await x.card(action, body);
    assert.equal(out.status, 403, action);
    assert.ok(noDash(out.body.message));
  }
  assert.deepEqual(x.snapshot(), before);
  assert.equal(x.rig.fetchLog.length, n);
});

test('wave278 set_welcome_cc {flow_id, emails}: active staff only (lower-cased, once each), logged; anyone else is refused with nothing saved; refused once the welcome has gone', async () => {
  const s = await t8({ hr: false, manager: true });
  s.db.rows('team_members').push({ id: 9, name: 'Old Timer', email: 'old.timer@welfareavenue.com', active: false });
  const before = s.snapshot();
  for (const bad of [['alex@example.com'], ['ruth.owen@welfareavenue.com', 'nobody@welfareavenue.com'], ['old.timer@welfareavenue.com']]) {
    const r = await s.card('set_welcome_cc', { emails: bad });
    assert.equal(r.status, 400, JSON.stringify(bad));
    assert.equal(r.body.error, 'not_staff');
    assert.ok(noDash(r.body.message));
  }
  assert.equal((await s.card('set_welcome_cc', { emails: 'ruth.owen@welfareavenue.com' })).status, 400);
  assert.deepEqual(s.snapshot(), before);
  const ok = await s.card('set_welcome_cc', { emails: [' Ruth.Owen@WelfareAvenue.com ', 'sam.lee@welfareavenue.com', 'ruth.owen@welfareavenue.com'] });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual(ok.body.welcome_cc, ['ruth.owen@welfareavenue.com', 'sam.lee@welfareavenue.com']);
  assert.deepEqual(s.flow().welcome_cc, ['ruth.owen@welfareavenue.com', 'sam.lee@welfareavenue.com']);
  assert.ok(s.rows('change_log').some((l) => l.field === 'welcome_cc' && l.new_value === 'ruth.owen@welfareavenue.com, sam.lee@welfareavenue.com'));
  assert.equal((await s.card('set_welcome_cc', { emails: ['sam.lee@welfareavenue.com', 'ruth.owen@welfareavenue.com'] })).body.repeated, true, 'the same people: nothing changes');
  /* fix round 1: the welcome goes out between the read and the write (here: while the roster is checked); the write finds nothing and says so */
  const rows = s.db.rows.bind(s.db);
  s.db.rows = (t) => { if (t === 'team_members') rows('hub_onboard_flows')[0].welcome_sent_at = NOW_ISO; return rows(t); };
  const race = await s.card('set_welcome_cc', { emails: ['ruth.owen@welfareavenue.com'] });
  s.db.rows = rows;
  assert.deepEqual([race.status, race.body.error], [409, 'already_sent'], JSON.stringify(race.body));
  assert.deepEqual(s.flow().welcome_cc, ['ruth.owen@welfareavenue.com', 'sam.lee@welfareavenue.com']);
  assert.equal(s.rows('change_log').filter((l) => l.field === 'welcome_cc').length, 1, 'nothing logged for a change that did not happen');
  const late = await s.card('set_welcome_cc', { emails: [] });
  assert.equal(late.status, 409);
  assert.equal(late.body.error, 'already_sent');
  assert.deepEqual(s.flow().welcome_cc, ['ruth.owen@welfareavenue.com', 'sam.lee@welfareavenue.com']);
  assert.equal(s.rig.fetchLog.length, 0);
});

/* ---------- wave278 Task 3, fix round 1 ---------- */
test('wave278 fix: a channel step left running by a run that died (older than 10 minutes) is taken back and run by the hourly job; a fresh running one is left alone', async () => {
  const s = await t8({ fl: PROPOSED });
  await s.booked();
  const row = s.step('channel');
  Object.assign(row, { status: 'running', at: '2026-10-20T11:49:00.000Z' });   // 11 minutes before NOW
  await s.remind();
  assert.deepEqual(s.lookedUp(), [W8_WA, 'alex@example.com'], 'run again');
  assert.equal(s.step('channel').status, 'pending');
  assert.match(s.step('channel').detail, /waiting for them to join Slack/i);
  const fresh = await t8({ fl: PROPOSED });
  await fresh.booked();
  Object.assign(fresh.step('channel'), { status: 'running', at: '2026-10-20T11:55:00.000Z' });   // 5 minutes: still running somewhere
  await fresh.remind();
  assert.equal(fresh.lookups().length, 0);
  assert.equal(fresh.step('channel').status, 'running');
  const late = await t8({ fl: PROPOSED });   // the 14-day rule is reached through a stuck row too
  await late.booked();
  Object.assign(late.step('channel'), { status: 'running', at: '2026-10-20T12:00:00.000Z' });
  late.rig.setNow('2026-11-04T12:00:00Z');
  await late.remind();
  assert.equal(late.step('channel').status, 'hr_task');
  assert.match(late.step('channel').detail, /has not joined Slack yet/);
});

test('wave278 fix: the meeting left to HR for want of an address runs again once HR presses "I created it, continue"', async () => {
  const s = await t8({ fl: PROPOSED, pw: null, config: W8_MAPPED, tables: { hub_events: structuredClone(W8_EVENTS) } });   // no first password: the account step is HR's
  w8Master(s);
  await s.booked();
  assert.equal(s.step('google').status, 'hr_task');
  assert.equal(s.step('meeting').status, 'hr_task');
  assert.match(s.step('meeting').detail, /no Welfare Avenue address/);
  assert.equal(s.master().length, 0);
  const r = await s.post({ action: 'google_manual', flow_id: 21, wa_email: W8_WA });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(s.step('meeting').status, 'done', s.step('meeting').detail);
  assert.deepEqual(s.master().map((e) => e.method), ['GET', 'PATCH']);
  assert.deepEqual([s.step('groups').status, s.step('drives').status], ['done', 'done'], 'as the groups and drives do');
  const other = await t8({ fl: PROPOSED, pw: null });   // no meeting set: still HR's, for that reason, after the account
  await other.booked();
  await other.post({ action: 'google_manual', flow_id: 21, wa_email: W8_WA });
  assert.equal(other.step('meeting').status, 'hr_task');
  assert.match(other.step('meeting').detail, /no weekly meeting set for fundraising/);
});

/* ---------- wave278 Task 4: the welcome email, rewritten to the companion note (claude/04-11-26, section 1), sent as the offer's sender ---------- */
/* Nia Okafor: the offer sent by Shima Butera, the recruitment owner Ruth Owen (a roster name), HR chose five people to copy of whom only Kai Moreau
   is active staff not already copied (an inactive one, the owner again in capitals, the hire's own new address and an off-roster address). Three drives
   and the Fundraising weekly were recorded at Accept (setup_ticks). The expected texts are test/w271fx.js WELCOME_278. */
const { WELCOME_278 } = createRequire(import.meta.url)('./w271fx.js');
const SHIMA = { id: 31, name: 'Shima Butera', email: 'shima.butera@welfareavenue.com', active: true };
const KAI = { id: 32, name: 'Kai Moreau', email: 'kai.moreau@welfareavenue.com', active: true };
const GONE = { id: 33, name: 'Old Staff', email: 'old.staff@welfareavenue.com', active: false };
const NIA = { name: 'Nia Okafor', email: 'nia@example.com', offer_sent_by: 'shima.butera@welfareavenue.com', owner: 'Ruth Owen', offer_doc_url: 'https://docs.google.com/document/d/offer-nia/edit' };
const NIA_WA = 'nia.okafor@welfareavenue.com', SHIMA_AT = 'shima.butera@welfareavenue.com', HUB_AT = 'hub@welfareavenue.com';
const NIA_TICKS = { drives_added: ['Org\'s Files', 'Fundraising', 'Program Development'], weekly_meeting: { summary: 'Fundraising weekly', next_at: '2026-10-29T15:00:00.000Z' } };
const NIA_CC = ['kai.moreau@welfareavenue.com', 'old.staff@welfareavenue.com', 'RUTH.OWEN@welfareavenue.com', NIA_WA, 'someone@gmail.com'];
const NIA_NOTE = { en: '(the password is in Nia\'s copy)', fr: '(le mot de passe est dans la copie de Nia)' };
const asMailbox = (who) => 'Bearer tok:https://www.googleapis.com/auth/gmail.send:' + who;
const okMail = { json: { id: 'mail1' } };
const esc278 = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
async function t9({ cand = {}, fl = {}, config = {}, ...o } = {}) {
  const s = await t4({
    cand: { ...NIA, ...cand }, fl: { ...PROPOSED, setup_ticks: structuredClone(NIA_TICKS), welcome_cc: [...NIA_CC], ...fl },
    config: { onboard_google_video: 'https://video.example/chrome', ...config }, tables: { team_members: [...TEAM, SHIMA, KAI, GONE] }, ...o,
  });
  s.sends = () => s.welcomes().map((e) => ({ ...mail(e), auth: e.headers.authorization, raw: Buffer.from(e.body.raw, 'base64url').toString() }));
  s.booked = async () => { assert.equal((await s.acceptSetup()).status, 200); return quietly(() => s.book()); };
  return s;
}
const nia = (lang, pw) => WELCOME_278[lang].replace('<PW>', pw).replace('<SETUP>', SETUP_LINK);

test('wave278 welcome: the companion note\'s text for the fixture, from the offer\'s sender to both addresses; the staff copy to the owner and the chosen staff, without the password', async () => {
  const s = await t9();
  assert.equal((await s.acceptSetup()).status, 200);
  s.pwReads = 0;
  const said = await quietly(() => s.book());
  assert.equal(s.flow().wa_email, NIA_WA);
  assert.equal(s.step('welcome').status, 'done', s.step('welcome').detail);
  assert.equal(s.step('welcome').detail, 'Sent the welcome email to nia@example.com and nia.okafor@welfareavenue.com from shima.butera@welfareavenue.com; copied to 2 staff.');
  assert.ok(noDash(s.step('welcome').detail));
  const [hire, staff, ...more] = s.sends();
  assert.equal(more.length, 0, 'two sends: the hire\'s copy and the staff copy');
  assert.equal(hire.to, 'nia@example.com, ' + NIA_WA, 'both of the hire\'s addresses');
  assert.equal(hire.from, 'From: "Shima Butera" <shima.butera@welfareavenue.com>');
  assert.equal(hire.auth, asMailbox(SHIMA_AT), 'sent from Shima\'s own mailbox (domain-wide delegation)');
  assert.ok(hire.raw.includes('\r\nReply-To: shima.butera@welfareavenue.com\r\n'), 'replies go to the sender');
  assert.equal(hire.subject, 'Welcome to Welfare Avenue! Your Next Steps');
  assert.equal(hire.bodies[0], nia('en', FIRST_PW));
  for (const b of hire.bodies) assert.equal(count(b, FIRST_PW), 1, 'the password once in each part of the hire\'s copy');
  assert.ok(!hire.raw.includes(FIRST_PW), 'only encoded in the MIME');
  assert.equal(s.pwReads, 1);
  assert.match(hire.bodies[1], /<a href="https:\/\/docs\.google\.com\/document\/d\/offer-nia\/edit"/, 'the offer letter is a link in the HTML part');
  assert.match(hire.bodies[1], /<a href="https:\/\/drive\.google\.com\/drive\/shared-drives"/);
  assert.equal(staff.to, 'ruth.owen@welfareavenue.com, kai.moreau@welfareavenue.com', 'the owner, then the chosen staff once each; inactive, off-roster and the hire\'s own addresses left out');
  assert.equal(staff.from, hire.from);
  assert.equal(staff.auth, asMailbox(SHIMA_AT));
  assert.ok(staff.raw.includes('\r\nReply-To: shima.butera@welfareavenue.com\r\n'));
  assert.equal(staff.subject, hire.subject);
  assert.equal(staff.bodies[0], nia('en', NIA_NOTE.en), 'the same email, the password line saying where the password is');
  for (const b of staff.bodies) assert.ok(!b.includes(FIRST_PW), 'never the password in the staff copy');
  assert.ok(staff.bodies[1].includes(esc278(NIA_NOTE.en)));
  const t = hire.bodies[0];
  assert.doesNotMatch(t, /\[|—|\bAI\b|DocuSign|Contract|in-person|group onboarding|Loom|Join our Canva|Slack workspace/, 'no marked place left, no DocuSign or in-person line, Hub words only');
  assert.equal(numbers(t), '1234');
  assert.equal(count(t, '   - Your Drives: '), 3, 'one line per drive');
  assert.equal(s.flow().welcome_sent_at, NOW_ISO);
  assert.ok((await s.card()).text.includes('[first password]'), 'the card keeps the placeholder');
  s.noPw();
  assert.ok(!said.includes(FIRST_PW));
  assert.deepEqual(s.rig.unregistered(), []);
});

test('wave278 welcome: the French text for the fixture, and the French staff copy', async () => {
  const s = await t9({ cand: { role: 'Operations Manager', summary: 'Français' } });
  await s.booked();
  const [hire, staff] = s.sends();
  assert.equal(hire.subject, 'Bienvenue chez Welfare Avenue! Vos prochaines étapes');
  assert.equal(hire.bodies[0], nia('fr', FIRST_PW));
  assert.equal(staff.bodies[0], nia('fr', NIA_NOTE.fr));
  assert.ok(!staff.bodies.join('').includes(FIRST_PW));
  assert.doesNotMatch(hire.bodies[0], /\[|—|\bAI\b/);
});

test('wave278 welcomeSender: the offer\'s sender when active staff, else the recruitment owner (active, by name or email), else hub@', async () => {
  const cases = [
    [{}, { email: SHIMA_AT, fallback: false }],
    [{ offer_sent_by: ' Shima.Butera@WelfareAvenue.com ' }, { email: SHIMA_AT, fallback: false }],
    [{ offer_sent_by: null }, { email: 'ruth.owen@welfareavenue.com', fallback: false }],
    [{ offer_sent_by: 'old.staff@welfareavenue.com' }, { email: 'ruth.owen@welfareavenue.com', fallback: false }],
    [{ offer_sent_by: 'someone@gmail.com' }, { email: 'ruth.owen@welfareavenue.com', fallback: false }],
    [{ offer_sent_by: null, owner: 'kai.moreau@welfareavenue.com' }, { email: 'kai.moreau@welfareavenue.com', fallback: false }],
    [{ offer_sent_by: null, owner: ' ruth OWEN ' }, { email: 'ruth.owen@welfareavenue.com', fallback: false }],
    [{ offer_sent_by: null, owner: 'Old Staff' }, { email: HUB_AT, fallback: true }],
    [{ offer_sent_by: null, owner: 'Nobody Known' }, { email: HUB_AT, fallback: true }],
    [{ offer_sent_by: null, owner: null }, { email: HUB_AT, fallback: true }],
  ];
  for (const [cand, want] of cases) {
    const s = await t9({ cand });
    assert.deepEqual(await s.rig.mod.welcomeSender(s.cand(), s.flow()), want, JSON.stringify(cand));
  }
  const owner = await t9({ cand: { offer_sent_by: null } });
  await owner.booked();
  const [m] = owner.sends();
  assert.equal(m.auth, asMailbox('ruth.owen@welfareavenue.com'), 'no offer sender: the owner\'s mailbox');
  assert.equal(m.from, 'From: "Ruth Owen" <ruth.owen@welfareavenue.com>');
  assert.match(m.bodies[0], /\n\nRuth Owen$/, 'signed by the sender');
  assert.match(owner.step('welcome').detail, / from ruth\.owen@welfareavenue\.com; copied to 2 staff\.$/);
  const hub = await t9({ cand: { offer_sent_by: null, owner: null } });
  await hub.booked();
  const [h, hs, ...none] = hub.sends();
  assert.equal(none.length, 0);
  assert.equal(h.auth, asMailbox(HUB_AT));
  assert.equal(h.from, 'From: Welfare Avenue Hub <hub@welfareavenue.com>');
  assert.ok(h.raw.includes('\r\nReply-To: sam.lee@welfareavenue.com\r\n'), 'from hub@, replies go to the person who booked the times, as before');
  assert.match(h.bodies[0], /\n\nSam Lee$/);
  assert.equal(hs.to, 'kai.moreau@welfareavenue.com, ruth.owen@welfareavenue.com', 'no owner: the chosen staff only, in HR\'s order (Ruth is one of them)');
  assert.equal(hub.step('welcome').detail, 'Sent the welcome email to nia@example.com and nia.okafor@welfareavenue.com from hub@welfareavenue.com; copied to 2 staff.');
});

test('wave278 welcome: the sender\'s mailbox refused (no token, or Gmail says no): both copies go from hub@, Reply-To the sender, and the detail says so', async () => {
  const s = await t9();
  s.tokenReply = (claims) => (claims.sub === SHIMA_AT && /gmail/.test(claims.scope) ? { status: 401, json: { error: 'unauthorized_client' } } : null);
  await s.booked();
  assert.equal(s.step('welcome').status, 'done', s.step('welcome').detail);
  assert.equal(s.step('welcome').detail, 'Sent the welcome email to nia@example.com and nia.okafor@welfareavenue.com from hub@welfareavenue.com (the sender\'s mailbox, shima.butera@welfareavenue.com, could not send); copied to 2 staff.');
  const [hire, staff, ...more] = s.sends();
  assert.equal(more.length, 0);
  for (const m of [hire, staff]) {
    assert.equal(m.auth, asMailbox(HUB_AT));
    assert.equal(m.from, 'From: Welfare Avenue Hub <hub@welfareavenue.com>');
    assert.ok(m.raw.includes('\r\nReply-To: shima.butera@welfareavenue.com\r\n'), 'replies still go to the sender');
  }
  assert.equal(hire.bodies[0], nia('en', FIRST_PW), 'the same email, signed by the sender');
  assert.equal(staff.bodies[0], nia('en', NIA_NOTE.en));

  const g = await t9();
  g.gmailReply = (e) => (e.headers.authorization === asMailbox(SHIMA_AT) ? { status: 403, json: { error: { message: 'Delegation denied for shima.butera@welfareavenue.com' } } } : okMail);
  await g.booked();
  assert.equal(g.step('welcome').status, 'done', g.step('welcome').detail);
  assert.match(g.step('welcome').detail, /from hub@welfareavenue\.com \(the sender's mailbox, shima\.butera@welfareavenue\.com, could not send\); copied to 2 staff\.$/);
  const went = g.sends().filter((m) => m.auth === asMailbox(HUB_AT));
  assert.deepEqual(went.map((m) => m.to), ['nia@example.com, ' + NIA_WA, 'ruth.owen@welfareavenue.com, kai.moreau@welfareavenue.com']);
  assert.equal(g.sends().filter((m) => m.auth === asMailbox(SHIMA_AT)).length, 1, 'Shima\'s mailbox tried once, for the hire\'s copy');
  g.noPw();
});

test('wave278 welcome: both sends under the one welcome_sent_at claim; the hire\'s copy failing gives it back and copies nobody; a staff copy failing is a warning', async () => {
  const s = await t9();
  const claimAt = [];
  s.gmailReply = (e) => { if (/Welcome to Welfare Avenue/.test(mail(e).subject)) claimAt.push(s.flow().welcome_sent_at); return okMail; };
  await s.booked();
  assert.deepEqual(claimAt, [NOW_ISO, NOW_ISO], 'claimed before the hire\'s copy, still held for the staff copy');
  s.gmailReply = null;
  Object.assign(s.step('welcome'), { status: 'failed', detail: 'cut off' });
  const again = await s.post({ action: 'retry', flow_id: 21, step: 'welcome' });
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.match(s.step('welcome').detail, /already sent/);
  assert.equal(s.sends().length, 2, 'neither copy goes again');

  const f = await t9();
  f.gmailReply = (e) => (/Welcome to Welfare Avenue/.test(mail(e).subject) ? { status: 400, json: { error: { message: 'Invalid To header' } } } : okMail);
  await f.booked();
  assert.equal(f.step('welcome').status, 'failed');
  assert.match(f.step('welcome').detail, /Invalid To header/);
  assert.equal(f.flow().welcome_sent_at ?? null, null, 'given back, so Retry sends it');
  assert.deepEqual(f.sends().map((m) => [m.to, m.auth]), [['nia@example.com, ' + NIA_WA, asMailbox(SHIMA_AT)]], 'fix round: a 400 is not a mailbox refusal, so hub@ does not try; nobody copied');
  f.noPw();

  const w = await t9();
  w.gmailReply = (e) => (/ruth\.owen/.test(mail(e).to) ? { status: 500, json: { error: { message: 'Backend Error' } } } : okMail);
  await w.booked();
  assert.equal(w.step('welcome').status, 'done', w.step('welcome').detail);
  assert.match(w.step('welcome').detail, /^Sent the welcome email to nia@example\.com and nia\.okafor@welfareavenue\.com from shima\.butera@welfareavenue\.com; the staff copy to ruth\.owen@welfareavenue\.com, kai\.moreau@welfareavenue\.com did not go: .*Backend Error/);
  assert.ok(noDash(w.step('welcome').detail));
  assert.ok(!w.step('welcome').detail.includes(FIRST_PW));
  assert.equal(w.flow().welcome_sent_at, NOW_ISO, 'the hire has it: the claim stays');
});

test('wave278 welcome: nobody to copy sends one email; mail test mode sends both to the test inboxes, naming the real addresses; a practice flow sends nothing', async () => {
  const one = await t9({ cand: { owner: null }, fl: { welcome_cc: [] } });
  await one.booked();
  assert.equal(one.sends().length, 1);
  assert.equal(one.step('welcome').detail, 'Sent the welcome email to nia@example.com and nia.okafor@welfareavenue.com from shima.butera@welfareavenue.com; no staff copy.');

  const t = await t9({ config: { mail_mode: 'test' } });
  await t.booked();
  const [hire, staff] = t.sends();
  assert.equal(hire.to, 'tester@welfareavenue.com');
  assert.equal(hire.subject, '[TEST, for nia@example.com, nia.okafor@welfareavenue.com] Welcome to Welfare Avenue! Your Next Steps');
  assert.equal(staff.to, 'tester@welfareavenue.com');
  assert.equal(staff.subject, '[TEST, for ruth.owen@welfareavenue.com, kai.moreau@welfareavenue.com] Welcome to Welfare Avenue! Your Next Steps');
  assert.equal(count(hire.bodies[0], FIRST_PW), 1);
  assert.ok(!staff.bodies.join('').includes(FIRST_PW));
  assert.match(t.step('welcome').detail, /; copied to 2 staff, and email is in test mode, so it went only to tester@welfareavenue\.com\.$/);

  const p = await t9({ cand: { practice: true } });
  p.pwReads = 0;
  await p.booked();
  assert.equal(p.step('welcome').status, 'done');
  assert.match(p.step('welcome').detail, /practice/i);
  assert.equal(p.rig.fetchLog.length, 0, 'nothing fetched, no email');
  assert.equal(p.pwReads, 0);
  assert.equal(p.flow().welcome_sent_at ?? null, null);
});

test('wave278 welcome: a text HR saved before this release (today\'s and the older slot words, the old steps) still fills in, and empty lines still go', async () => {
  const s = await setup();
  const r = s.rig.mod.renderWelcome;
  const f = flow({ status: 'running', call_at: P_CALL, one_on_one_at: P_ONE, wa_email: NIA_WA, call_event_id: 'onboard21call', one_on_one_event_id: 'onboard21oneonone', welcome_text: [
    'Dear Nia,', 'Your first day is [first day: fills in at Start], and we can\'t wait.', 'Next Steps:',
    '1. Your meetings:', '   - Your onboarding call: [call date and time: fills in when the times are booked or at Start]. Google Meet: [call Meet link]',
    '   - A 1-on-1 with your manager, [manager: fills in at Start]: [1-on-1 date and time: fills in at Start]. Google Meet: [1-on-1 Meet link]',
    '   - Your in-person group onboarding session on [group session date: fills in when the times are booked or at Start, or this line is left out].',
    '2. Sign in to your Welfare Avenue Google account at mail.google.com:', '   Email: [new address]', '   First password: [first password]',
    '   Google will ask you to change it the first time you sign in.', '   This video shows you how: https://video.example/old',
    '3. Join our Canva team: [Canva link: fills in at Start, or this line is left out]',
    '4. Before your onboarding call, set up your computer on your own, step by step:',
    '   You can tick each step off on this page, so your manager can see where you are: [setup page link]', '   1. Add your Welfare Avenue account to Chrome.',
    'Hana Rossi'].join('\n') }), c = candidate({ name: 'Nia Okafor' });
  const facts = { manager: 'Sam Lee', jdUrl: null, video: null, slack: 'https://welfareavenue.slack.com', hrName: 'Hana Rossi', meet: { call: MEET_CALL, one: MEET_ONE }, setupLink: SETUP_LINK, login: true };
  assert.equal(r(f, c, facts).text, [
    'Dear Nia,', 'Your first day is Monday, October 26, 2026, and we can\'t wait.', 'Next Steps:',
    '1. Your meetings:', '   - Your onboarding call: Monday, October 26, 2026 at 10:00 a.m. Google Meet: ' + MEET_CALL,
    '   - A 1-on-1 with your manager, Sam Lee: Monday, October 26, 2026 at 11:30 a.m. Google Meet: ' + MEET_ONE,
    '2. Sign in to your Welfare Avenue Google account at mail.google.com:', '   Email: ' + NIA_WA, '   First password: [first password]',
    '   Google will ask you to change it the first time you sign in.', '   This video shows you how: https://video.example/old',
    '3. Before your onboarding call, set up your computer on your own, step by step:',
    '   You can tick each step off on this page, so your manager can see where you are: ' + SETUP_LINK, '   1. Add your Welfare Avenue account to Chrome.',
    'Hana Rossi'].join('\n'));
  const later = r(f, c, { ...facts, login: false }).text;
  assert.match(later, /\n2\. HR will send your login details separately\.\n3\. Before your onboarding call/, 'the old video line is still one of the login lines');
});

/* ---------- wave278 Task 4, fix round: the roster read strictly on the send path, the hire's new address never copied, hub@ only for a mailbox
   refusal, and the short step 3 of a hire with no setup page ---------- */
test('wave278 fix: a roster that cannot be read at send time stops the welcome before anything goes; the claim is given back and Retry sends it', async () => {
  const s = await t9();
  s.gmailReply = (e) => (/Welcome to Welfare Avenue/.test(mail(e).subject) ? { status: 400, json: { error: { message: 'Invalid To header' } } } : okMail);
  await s.booked();
  assert.equal(s.step('welcome').status, 'failed', 'set up: the first try failed, so Retry has something to do');
  s.gmailReply = null;
  const tried = s.sends().length;
  for (let i = 0; i < 50; i++) s.db.failOn('team_members', 'select', 'the database is resting');
  const r = await s.post({ action: 'retry', flow_id: 21, step: 'welcome' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(s.step('welcome').status, 'failed', s.step('welcome').detail);
  assert.match(s.step('welcome').detail, /could not check the roster/);
  assert.equal(s.sends().length, tried, 'nothing sent: not from hub@, not to nobody');
  assert.equal(s.flow().welcome_sent_at ?? null, null, 'the claim is given back');
  s.db.failures.length = 0;
  const again = await s.post({ action: 'retry', flow_id: 21, step: 'welcome' });
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.equal(s.step('welcome').status, 'done', s.step('welcome').detail);
  assert.equal(s.step('welcome').detail, 'Sent the welcome email to nia@example.com and nia.okafor@welfareavenue.com from shima.butera@welfareavenue.com; copied to 2 staff.');
  s.noPw();
});

test('wave278 fix: the hire\'s Welfare Avenue address never gets the staff copy, even before the account exists', async () => {
  const s = await t9({ pw: null, fl: { wa_email: NIA_WA } });
  assert.equal((await s.acceptSetup()).status, 200);
  assert.notEqual(s.step('google').status, 'done', 'no account yet');
  if (!s.rows('team_members').some((m) => String(m.email).toLowerCase() === NIA_WA && m.active)) s.rows('team_members').push({ id: 34, name: 'Nia Okafor', email: NIA_WA, active: true });   // on the roster, active, and in welcome_cc
  if (!s.flow().wa_email) s.flow().wa_email = NIA_WA;
  await quietly(() => s.book());
  const [hire, staff, ...more] = s.sends();
  assert.equal(more.length, 0);
  assert.equal(hire.to, 'nia@example.com', 'no account: the personal address only');
  assert.equal(staff.to, 'ruth.owen@welfareavenue.com, kai.moreau@welfareavenue.com', 'never the hire\'s own new address');
});

test('wave278 fix: hub@ sends only when the sender\'s mailbox is refused (no token, 401, 403); a 5xx or another 4xx from it fails the step and nothing goes twice', async () => {
  for (const [status, message] of [[503, 'Backend Error'], [400, 'Invalid To header'], [429, 'Rate limit exceeded']]) {
    const s = await t9();
    s.gmailReply = (e) => (e.headers.authorization === asMailbox(SHIMA_AT) && /Welcome to Welfare Avenue/.test(mail(e).subject) ? { status, json: { error: { message } } } : okMail);
    await s.booked();
    assert.equal(s.step('welcome').status, 'failed', status + ': ' + s.step('welcome').detail);
    assert.match(s.step('welcome').detail, new RegExp(message));
    assert.deepEqual(s.sends().map((m) => m.auth), [asMailbox(SHIMA_AT)], status + ': hub@ does not try, and nobody is copied');
    assert.equal(s.flow().welcome_sent_at ?? null, null, 'given back, so Retry sends it');
  }
  const ok = await t9();
  ok.gmailReply = (e) => (e.headers.authorization === asMailbox(SHIMA_AT) ? { status: 401, json: { error: { message: 'Invalid Credentials' } } } : okMail);
  await ok.booked();
  assert.equal(ok.step('welcome').status, 'done');
  assert.match(ok.step('welcome').detail, /from hub@welfareavenue\.com \(the sender's mailbox, shima\.butera@welfareavenue\.com, could not send\)/, '401 is a mailbox refusal');
});

test('wave278 ruling: a hire with no setup page (wave271\'s path) gets the short step 3: Slack, and Canva when the card has a link; no weekly line; EN and FR', async () => {
  const s = await setup({ config: { onboard_slack_join_link: 'https://join.slack.example/wa' }, fl: { setup_ticks: structuredClone(NIA_TICKS) } });
  await s.start({ canva_link: 'https://www.canva.com/brand/join?token=b' });
  assert.equal(s.step('welcome').status, 'done', s.step('welcome').detail);
  const t = mail(s.gmail().find((e) => /Welcome to Welfare Avenue/.test(mail(e).subject))).bodies[0];
  assert.ok(t.includes('\n\n3. Join the Welfare Avenue Slack with your new address: https://join.slack.example/wa\n   Join our Canva team: https://www.canva.com/brand/join?token=b\n\n4. Your documents:\n'), t);
  assert.doesNotMatch(t, /personal Hub link|weekly meeting|Fundraising weekly/, 'no setup page, and the weekly line stays dropped');
  assert.equal(numbers(t), '1234');
  const n = await setup({ cand: { summary: 'Français' } });
  await n.start();
  const u = mail(n.gmail().find((e) => /Bienvenue chez Welfare Avenue/.test(mail(e).subject))).bodies[0];
  assert.ok(u.includes('\n\n3. Joignez-vous au Slack de Welfare Avenue avec votre nouvelle adresse : https://welfareavenue.slack.com\n\n4. Vos documents :\n'), u);
  assert.doesNotMatch(u, /Canva|rencontre hebdomadaire de votre équipe|\[/, 'no Canva link: its line goes');
});
