// wave271 Task 2: fn/onboard-link, proved offline on the in-memory rig (test/w271rig.mjs). Run: node --test test/w271link.test.mjs
// No live call of any kind: the database is a stub and every fetch is recorded, never sent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { loadFn } from './w271rig.mjs';
import { availabilityOf, weekRows } from './w275avail.mjs';

const URL_ = 'https://stub.supabase.test/functions/v1/onboard-link';
const NOTIFY = 'https://stub.supabase.test/functions/v1/notify';
const NOW = '2026-11-01T12:00:00Z';   // 07:00 in Toronto on 01/11/26, the day the clocks go back: the whole of the first day is still ahead

const candidate = (over = {}) => ({
  id: 11, name: 'Alex Tremblay', role: 'Program Coordinator', status: 'offer', owner: 'Ruth Owen', email: 'alex@example.com',
  summary: '', notes: '', accepted_on: null, offer_respond_by: '2026-11-10', close_reason: null, practice: false, ...over,
});
const flow = (over = {}) => ({ id: 11, candidate_id: 11, practice: false, status: 'waiting', manager_member_id: 2, call_at: null, one_on_one_at: null, ...over });
const team = [{ id: 1, name: 'Ruth Owen', email: 'Ruth.Owen@welfareavenue.com' }, { id: 2, name: 'Sam Lee', email: 'sam.lee@welfareavenue.com' }];

// Without triggers the rig does not make the flow; this stands in for wa271_cand_accepted as wa275a has it: an offered flow moves to waiting, else one is made
function standInForTrigger(rig) {
  rig.db.on('hub_candidates', 'update', (n, o, db) => {
    if (o.accepted_on != null || n.accepted_on == null) return;
    const had = db.rows('hub_onboard_flows').find((f) => String(f.candidate_id) === String(n.id));
    if (had) { if (had.status === 'offered') had.status = 'waiting'; return; }
    db.insert('hub_onboard_flows', { candidate_id: n.id, practice: !!n.practice, status: 'waiting', manager_member_id: null, call_at: null, one_on_one_at: null });
  });
}
// wave271d: the hire's grid needs onboard_grid_min_hours (default 10) hours before it saves. The older tests are about the grid itself and save a few cells,
// so setup lifts the rule (0) for them; the tests of the rule itself pass rule: true and meet the default, or set the key.
async function setup({ cand = {}, flows = [], config = {}, now = NOW, notify = true, rule = false, tables = {} } = {}) {
  if (!rule && !('onboard_grid_min_hours' in config)) config = { onboard_grid_min_hours: '0', ...config };
  const rig = await loadFn('onboard-link', { config, tables: { hub_candidates: [candidate(cand)], hub_onboard_flows: flows, hub_onboard_grids: [], team_members: team, change_log: [], ...tables } });
  standInForTrigger(rig);
  rig.db.onRpc('wa275_availability_of', availabilityOf);   // wave275 (amended 02/11/26): the week from hub_team_avail, the one-off dates from the roster
  rig.setNow(now);
  if (notify) rig.fetchOn(NOTIFY, { json: { event: 'applicant', outcome: { 'ruth.owen@welfareavenue.com': 'sent' }, hub: 'off' } });
  const offer = await rig.mod.wa271Token('offer', 11);
  const mgr = await rig.mod.wa271Token('mgr', 11);
  const get = async (t) => { const r = await rig.call(new Request(URL_ + '?t=' + encodeURIComponent(t))); return { status: r.status, headers: r.headers, body: await r.json() }; };
  const post = async (body) => { const r = await rig.call(new Request(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })); return { status: r.status, body: await r.json() }; };
  return { rig, offer, mgr, get, post, db: rig.db, cand: () => rig.db.rows('hub_candidates')[0], snapshot: () => structuredClone(rig.db.tables) };
}
const toronto = (iso) => {   // the Toronto wall clock of an instant: { date, minutes }
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: p.year + '-' + p.month + '-' + p.day, minutes: Number(p.hour) * 60 + Number(p.minute) };
};
const cc = (id, key) => id + '.' + createHmac('sha256', 'candidate-confirm:' + key).update(String(id)).digest('base64url').slice(0, 20);   // candidate-confirm's own recipe
const hasBoth = (m) => m && typeof m.en === 'string' && m.en && typeof m.fr === 'string' && m.fr;

test('a GET saves nothing and gives the page what it needs', async () => {
  const s = await setup({ flows: [flow()] });
  const before = s.snapshot();
  const a = await s.get(s.offer);
  const m = await s.get(s.mgr);
  assert.deepEqual(s.snapshot(), before, 'scanner safety: no row changed');
  assert.equal(s.rig.fetchLog.length, 0);
  assert.equal(a.status, 200);
  assert.deepEqual({ ...a.body, grid: undefined }, {
    ok: true, kind: 'offer', first: 'Alex', role: 'Program Coordinator', lang: 'en', answered: '', closed: false, late: false, booked: false, callBooked: false, grid: undefined, slotsSaved: [],
    offerHours: null, hoursConfirmed: false, mode: 'grid', proposal: null, bookedTimes: null, answer: null, askAvailability: true, manager: 'Sam Lee', secondNo: null, setup: null, hoursRequired: false,   // wave275: an offer from before it has no hours and keeps the grid (wave275b: so no box is required)
  });
  assert.equal(m.body.kind, 'manager');
  assert.equal(m.body.first, 'Sam');
  assert.equal(m.body.hire, 'Alex');
  assert.equal(a.headers.get('cache-control'), 'no-store');
  assert.equal(a.headers.get('access-control-allow-origin'), 'https://hub.welfareavenue.com');
  assert.deepEqual(s.rig.unregistered(), []);
});

test('a bad, tampered or unknown link gives 404 bad_link in both languages', async () => {
  const s = await setup({ flows: [flow()] });
  const tampered = s.offer.slice(0, -1) + (s.offer.endsWith('A') ? 'B' : 'A');
  const unknownCandidate = await s.rig.mod.wa271Token('offer', 999);
  for (const t of [tampered, '', 'garbage', '11.', '11.' + 'x'.repeat(20), unknownCandidate, '11.' + s.offer.split('.')[1] + 'extra']) {
    const g = await s.get(t);
    assert.equal(g.status, 404, 'GET ' + JSON.stringify(t));
    assert.equal(g.body.error, 'bad_link');
    assert.ok(hasBoth(g.body.message));
    const p = await s.post({ t, a: 'accept' });
    assert.equal(p.status, 404);
  }
  assert.equal(s.cand().accepted_on, null);
});

test('each purpose has its own key: a mgr token is not an offer token, and candidate-confirm tokens do not cross over', async () => {
  const s = await setup({ flows: [flow()] });
  const key = s.rig.env.SUPABASE_SERVICE_ROLE_KEY;
  // candidate 11 and flow 11 share an id, so only the key tells the two tokens apart
  const asOffer = await s.post({ t: s.mgr, a: 'accept' });
  assert.equal(asOffer.status, 400);
  assert.equal(asOffer.body.error, 'wrong_link');
  assert.equal(s.cand().accepted_on, null);
  assert.equal((await s.post({ t: s.mgr, a: 'decline' })).body.error, 'wrong_link');
  assert.equal(s.cand().status, 'offer');
  // a pw token (signs id.nonce) is neither
  const pw = await s.rig.mod.wa271Token('pw', 11, 'nonce1');
  assert.equal((await s.get(pw)).status, 404, 'no pw nonce on the flow: not a link');
  // the same id, signed the candidate-confirm way, does not open this function
  const ccToken = cc(11, key);
  assert.equal((await s.get(ccToken)).status, 404);
  // and neither of ours opens candidate-confirm
  const confirm = await loadFn('candidate-confirm', { tables: { hub_candidates: [candidate()] } });
  const ask = async (t) => confirm.call(new Request('https://stub.supabase.test/functions/v1/candidate-confirm?t=' + t));
  assert.equal((await ask(ccToken)).status, 200, 'the helper really is candidate-confirm\'s recipe');
  assert.equal((await ask(s.offer)).status, 404);
  assert.equal((await ask(s.mgr)).status, 404);
});

test('Accept sets accepted_on to the Toronto date; a second Accept or a Decline shows the first answer', async () => {
  const s = await setup({ now: '2026-11-02T02:30:00Z' });   // 21:30 on 01/11/26 in Toronto, already 02/11 in UTC
  const a = await s.post({ t: s.offer, a: 'accept' });
  assert.equal(a.status, 200);
  assert.deepEqual(a.body, { ok: true, first: 'Alex', role: 'Program Coordinator', lang: 'en', answer: 'accept', answered: 'accept', repeated: false, late: false });
  assert.equal(s.cand().accepted_on, '2026-11-01');
  assert.equal(s.cand().status, 'offer', 'Accept only sets accepted_on; the trigger starts the flow');
  assert.equal(s.db.rows('hub_onboard_flows').length, 1);
  assert.deepEqual(s.db.rows('change_log').map((r) => [r.entity_type, r.entity_id, r.field, r.new_value, r.changed_by]), [['candidate', '11', 'accepted_on', '2026-11-01', 'candidate (offer link)']]);
  s.rig.setNow('2026-11-05T15:00:00Z');
  const again = await s.post({ t: s.offer, a: 'accept' });
  assert.equal(again.body.repeated, true);
  assert.equal(again.body.answer, 'accept');
  const decline = await s.post({ t: s.offer, a: 'decline' });
  assert.equal(decline.body.repeated, true);
  assert.equal(decline.body.answer, 'accept');
  assert.equal(s.cand().accepted_on, '2026-11-01', 'the first answer stands');
  assert.equal(s.cand().status, 'offer');
  assert.equal(s.rig.fetchLog.length, 0, 'no notice for an answer that changed nothing');
  assert.equal(s.db.rows('change_log').length, 1);
  assert.equal((await s.get(s.offer)).body.answered, 'accept');
});

test('a double click or a second tab makes one acceptance, one flow and one log line', async () => {
  const s = await setup();
  const both = await Promise.all([s.post({ t: s.offer, a: 'accept' }), s.post({ t: s.offer, a: 'accept' }), s.post({ t: s.offer, a: 'decline' })]);
  assert.deepEqual(both.map((r) => r.status), [200, 200, 200]);
  const fresh = both.filter((r) => r.body.repeated === false);
  assert.equal(fresh.length, 1, 'exactly one answer was taken');
  assert.equal(s.db.rows('change_log').length, 1);
  assert.equal(s.db.rows('hub_onboard_flows').length, fresh[0].body.answer === 'accept' ? 1 : 0);
  assert.ok(both.filter((r) => r.body.repeated).every((r) => r.body.answer === fresh[0].body.answer), 'the others show the first answer');
});

test('Decline closes the card, logs it and, with no owner on the card, tells the offer signer through notify', async () => {
  const s = await setup({ cand: { owner: null }, config: { offer_signer_email: 'ruth.owen@welfareavenue.com' } });
  const d = await s.post({ t: s.offer, a: 'decline' });
  assert.equal(d.status, 200);
  assert.deepEqual(d.body, { ok: true, first: 'Alex', role: 'Program Coordinator', lang: 'en', answer: 'decline', answered: 'decline', repeated: false, late: false });
  assert.equal(s.cand().status, 'declined');
  assert.equal(s.cand().close_reason, 'Declined by link');
  assert.equal(s.cand().accepted_on, null);
  assert.equal(s.db.rows('hub_onboard_flows').length, 0, 'no flow for someone who said no');
  assert.deepEqual(s.db.rows('change_log').map((r) => [r.entity_type, r.entity_id, r.field, r.old_value, r.new_value, r.changed_by]), [['candidate', '11', 'status', 'offer', 'declined (Declined by link)', 'candidate (offer link)']]);
  assert.equal(s.rig.fetchLog.length, 1);
  const n = s.rig.fetchLog[0];
  assert.equal(n.url, NOTIFY);
  assert.equal(n.method, 'POST');
  assert.equal(n.headers['x-wa-secret'], s.rig.env.WA_TRIGGER_SECRET);
  assert.equal(n.body.event, 'applicant');
  assert.equal(n.body.to_email, 'ruth.owen@welfareavenue.com');
  assert.equal(n.body.tag, 'offer-declined-11');
  assert.equal(n.body.url, '#hrcentre/applications');
  for (const k of ['text', 'title', 'body']) assert.ok(n.body[k], k);
  assert.match(n.body.text, /Alex Tremblay/);
  assert.match(n.body.text, /Program Coordinator/);
  for (const k of ['text', 'title', 'body']) assert.doesNotMatch(n.body[k], /\u2014|\bAI\b/, k + ' uses Hub words');
  // Accept after Decline, and a second Decline, change nothing and say so
  const acc = await s.post({ t: s.offer, a: 'accept' });
  assert.equal(acc.body.repeated, true);
  assert.equal(acc.body.answer, 'decline');
  assert.equal((await s.post({ t: s.offer, a: 'decline' })).body.repeated, true);
  assert.equal(s.cand().accepted_on, null);
  assert.equal(s.db.rows('hub_onboard_flows').length, 0);
  assert.equal(s.rig.fetchLog.length, 1, 'the owner is told once');
  assert.equal(s.db.rows('change_log').length, 1);
  assert.equal((await s.get(s.offer)).body.answered, 'decline');
  assert.deepEqual(s.rig.unregistered(), []);
});

test('Decline still lands when notify is down, and reaches the offer signer when nobody owns the card', async () => {
  const signerCard = { cand: { owner: null }, config: { offer_signer_email: 'valex@welfareavenue.com' } };
  const down = await setup({ notify: false, ...signerCard });
  down.rig.fetchOn(NOTIFY, { status: 500, text: 'down' });
  assert.equal((await down.post({ t: down.offer, a: 'decline' })).body.answer, 'decline');
  assert.equal(down.cand().status, 'declined');

  const unreachable = await setup({ notify: false, ...signerCard });   // nothing registered: the recorder throws
  assert.equal((await unreachable.post({ t: unreachable.offer, a: 'decline' })).body.answer, 'decline');
  assert.equal(unreachable.cand().status, 'declined');
  assert.equal(unreachable.rig.unregistered().length, 1, 'the attempt was made and logged');

  const signer = await setup({ cand: { owner: null }, config: { offer_signer_email: 'Valex@welfareavenue.com' } });
  await signer.post({ t: signer.offer, a: 'decline' });
  assert.equal(signer.rig.fetchLog[0].body.to_email, 'valex@welfareavenue.com');

  const nobody = await setup({ cand: { owner: null } });
  assert.equal((await nobody.post({ t: nobody.offer, a: 'decline' })).body.answer, 'decline');
  assert.equal(nobody.rig.fetchLog.length, 0);
});

test('a closed card gives closed:true and saves nothing; a late Accept still works and says late', async () => {
  for (const cand of [{ status: 'withdrawn' }, { status: 'declined', close_reason: 'Not a fit' }]) {
    const s = await setup({ cand });
    const before = s.snapshot();
    const g = await s.get(s.offer);
    assert.equal(g.body.closed, true);
    assert.ok(hasBoth(g.body.message));
    for (const a of ['accept', 'decline']) {
      const p = await s.post({ t: s.offer, a });
      assert.equal(p.status, 200);
      assert.equal(p.body.closed, true);
      assert.equal(p.body.repeated, undefined);
    }
    assert.equal((await s.post({ t: s.offer, a: 'grid', slots: [] })).body.closed, true);
    assert.deepEqual(s.snapshot(), before);
    assert.equal(s.rig.fetchLog.length, 0);
  }
  const late = await setup({ now: '2026-11-12T15:00:00Z' });   // respond-by was 10/11/26
  assert.equal((await late.get(late.offer)).body.late, true);
  const a = await late.post({ t: late.offer, a: 'accept' });
  assert.equal(a.body.answer, 'accept');
  assert.equal(a.body.late, true);
  assert.equal(late.cand().accepted_on, '2026-11-12');
  assert.equal((await late.get(late.offer)).body.late, true);
  const onTime = await setup({ now: '2026-11-10T20:00:00Z' });   // the day itself is not late
  assert.equal((await onTime.post({ t: onTime.offer, a: 'accept' })).body.late, false);
});

test('a bad action is refused and the password action waits for Task 10', async () => {
  const s = await setup({ flows: [flow()] });
  const before = s.snapshot();
  for (const a of ['', 'maybe', undefined]) {   // wave275 made 'yes' an action of its own
    const r = await s.post({ t: s.offer, a });
    assert.equal(r.status, 400);
    assert.equal(r.body.error, 'answer');
  }
  const pw = await s.post({ t: s.offer, a: 'password' });
  assert.equal(pw.body.error, 'not_yet');
  assert.deepEqual(s.snapshot(), before);
  const put = await s.rig.call(new Request(URL_, { method: 'PUT' }));
  assert.equal(put.status, 405);
  const opt = await s.rig.call(new Request(URL_, { method: 'OPTIONS' }));
  assert.equal(opt.headers.get('access-control-allow-origin'), 'https://hub.welfareavenue.com');
});

test('the grid window starts today in Toronto and keeps wall-clock times across the clock change', async () => {
  const day1 = await setup({ cand: { accepted_on: '2026-11-01' }, flows: [flow()], now: NOW });   // 01/11/26
  const w1 = (await day1.get(day1.offer)).body.grid;
  assert.deepEqual([w1.start, w1.end, w1.cellMin, w1.days.length], [8, 21, 30, 14]);
  assert.equal(w1.days[0].date, '2026-11-01');
  assert.equal(w1.days[0].close, '2026-11-02T02:00:00Z', '21:00 on 01/11/26 in Toronto');
  assert.equal(w1.days[0].open, '2026-11-01T13:00:00Z');
  assert.equal(w1.slots.length, 14 * 26);

  const eve = await setup({ cand: { accepted_on: '2026-11-01' }, flows: [flow()], now: '2026-10-31T11:00:00Z' });   // 07:00 on 31/10/26
  const w0 = (await eve.get(eve.offer)).body.grid;
  assert.equal(w0.days[0].date, '2026-10-31');
  assert.equal(w0.days[0].close, '2026-11-01T01:00:00Z', '21:00 on 31/10/26 in Toronto');
  assert.equal(w0.days[1].open, '2026-11-01T13:00:00Z', 'the day after the change still opens at 8:00 local');

  // today is the Toronto date even when it is already tomorrow in UTC (20:10 on 01/11/26 here: one cell of the day is left)
  const late = await setup({ cand: { accepted_on: '2026-11-01' }, flows: [flow()], now: '2026-11-02T01:10:00Z' });
  const wl = (await late.get(late.offer)).body.grid;
  assert.equal(wl.days[0].date, '2026-11-01');
  assert.equal(wl.days[0].open, '2026-11-02T01:30:00Z');

  // a window across the spring change (14/03/27): every slot of every day is a local 8:00 to 20:30
  const spring = await setup({ cand: { accepted_on: '2027-03-01' }, flows: [flow()], now: '2027-03-10T12:00:00Z' });
  const w2 = (await spring.get(spring.offer)).body.grid;
  assert.ok(w2.days.some((d) => d.date === '2027-03-14') && w2.days.some((d) => d.date === '2027-03-13'));
  const wall = w2.slots.map(toronto);
  assert.equal(new Set(wall.map((x) => x.date)).size, 14);
  for (const x of wall) assert.ok(x.minutes >= 480 && x.minutes <= 20 * 60 + 30 && x.minutes % 30 === 0, JSON.stringify(x));
  for (const d of w2.days) assert.deepEqual(wall.filter((x) => x.date === d.date).map((x) => x.minutes), Array.from({ length: 26 }, (_, i) => 480 + i * 30));
  assert.equal(w2.days.find((d) => d.date === '2027-03-14').open, '2027-03-14T12:00:00Z', '8:00 EDT');
  assert.equal(w2.days.find((d) => d.date === '2027-03-13').open, '2027-03-13T13:00:00Z', '8:00 EST');
});

test('the window comes from app_config, and a nonsense value falls back to the default', async () => {
  const cfg = await setup({ cand: { accepted_on: '2026-11-01' }, flows: [flow()], config: { onboard_grid_days: '3', onboard_grid_start: '9', onboard_grid_end: '17', onboard_grid_cell_min: '60' } });
  const g = (await cfg.get(cfg.offer)).body.grid;
  assert.deepEqual([g.start, g.end, g.cellMin, g.days.length, g.slots.length], [9, 17, 60, 3, 24]);
  const bad = await setup({ cand: { accepted_on: '2026-11-01' }, flows: [flow()], config: { onboard_grid_days: 'many', onboard_grid_start: '22', onboard_grid_end: '7', onboard_grid_cell_min: '0' } });
  const d = (await bad.get(bad.offer)).body.grid;
  assert.deepEqual([d.start, d.end, d.cellMin, d.days.length], [8, 21, 30, 14]);
});

test('grid POST: slots outside the window, off the cell boundary, malformed or over 2000 are refused', async () => {
  const s = await setup({ cand: { accepted_on: '2026-11-01' }, flows: [flow()] });
  const { slots } = (await s.get(s.offer)).body.grid;
  const keep = [slots[0], slots[5]];
  assert.equal((await s.post({ t: s.offer, a: 'grid', slots: keep })).body.ok, true);
  const stored = () => s.db.rows('hub_onboard_grids').map((r) => [r.flow_id, r.who, r.slots.map((x) => new Date(x).toISOString())]);
  const good = stored();
  const t = (iso, ms) => new Date(Date.parse(iso) + ms).toISOString().replace('.000Z', 'Z');
  const bads = {
    'before the window opens (07:30 local)': [t(slots[0], -30 * 60000)],
    'at the closing time itself (21:00 local)': [t(slots[25], 30 * 60000)],
    'a bygone slot that is not on a cell': [t(slots[0], -24 * 3600000 + 10 * 60000)],
    'after the last day': [t(slots[slots.length - 1], 24 * 3600000)],
    'ten minutes off a cell': [t(slots[3], 10 * 60000)],
    'a second off a cell': [t(slots[3], 1000)],
    'not a time': ['soon'],
    'not a string': [12345, null],
    'one bad among good ones': [slots[1], t(slots[2], 60000)],
  };
  for (const [why, list] of Object.entries(bads)) {
    const r = await s.post({ t: s.offer, a: 'grid', slots: list });
    assert.equal(r.status, 400, why);
    assert.equal(r.body.error, 'bad_slots', why);
    assert.ok(hasBoth(r.body.message));
  }
  for (const odd of [undefined, 'all', { a: 1 }]) assert.equal((await s.post({ t: s.offer, a: 'grid', slots: odd })).body.error, 'bad_slots');
  const many = await s.post({ t: s.offer, a: 'grid', slots: Array.from({ length: 2001 }, () => slots[0]) });
  assert.equal(many.status, 400);
  assert.equal(many.body.error, 'too_many_slots');
  assert.deepEqual(stored(), good, 'a refused save leaves what was there');
  const exactly = await s.post({ t: s.offer, a: 'grid', slots: Array.from({ length: 2000 }, () => slots[0]) });
  assert.equal(exactly.status, 200, '2000 entries are allowed');
  assert.deepEqual(stored()[0][2].map((x) => x.replace('.000Z', 'Z')), [slots[0]], 'repeats collapse to one');
});

test('a valid grid POST replaces the set and can be repeated; the manager has their own row', async () => {
  const s = await setup({ cand: { accepted_on: '2026-11-01' }, flows: [flow()] });
  const { slots } = (await s.get(s.offer)).body.grid;
  const first = await s.post({ t: s.offer, a: 'grid', slots: [slots[4], slots[2]] });
  assert.equal(first.status, 200);
  assert.deepEqual(first.body, { ok: true, saved: 2, dropped: 0, slotsSaved: [slots[2], slots[4]], closed: false });
  const rows = () => s.db.rows('hub_onboard_grids');
  assert.equal(rows().length, 1);
  assert.deepEqual([rows()[0].flow_id, rows()[0].who], [11, 'hire']);
  const second = await s.post({ t: s.offer, a: 'grid', slots: [slots[10], slots[11], slots[12]] });
  assert.equal(second.body.saved, 3);
  assert.equal(rows().length, 1, 'replaced, not added');
  assert.deepEqual(rows()[0].slots.map((x) => new Date(x).toISOString().replace('.000Z', 'Z')), [slots[10], slots[11], slots[12]]);
  assert.deepEqual((await s.get(s.offer)).body.slotsSaved, [slots[10], slots[11], slots[12]]);
  assert.equal((await s.post({ t: s.offer, a: 'grid', slots: [] })).body.saved, 0, 'opened and saved with nothing marked');
  assert.deepEqual(rows()[0].slots, []);

  const m = await s.post({ t: s.mgr, a: 'grid', slots: [slots[30]] });
  assert.equal(m.body.saved, 1);
  assert.deepEqual(rows().map((r) => r.who).sort(), ['hire', 'manager']);
  assert.deepEqual((await s.get(s.mgr)).body.slotsSaved, [slots[30]]);
  assert.deepEqual((await s.get(s.offer)).body.slotsSaved, [], 'each person sees only their own');
});

const EN10 = 'Please mark at least 10 hours in total, so your manager has a few times to choose from.';
const FR10 = 'Veuillez indiquer au moins 10 heures en tout, pour que votre gestionnaire ait quelques plages au choix.';

test('wave271d: the hire\'s grid needs 10 hours (20 cells) to save: 19 cells are refused in both languages, 20 are saved', async () => {
  const s = await setup({ rule: true, cand: { accepted_on: '2026-11-01' }, flows: [flow()] });
  const g = (await s.get(s.offer)).body.grid;
  assert.equal(g.minHours, 10, 'GET tells the page the minimum');
  assert.equal(g.cellMin, 30);
  const few = await s.post({ t: s.offer, a: 'grid', slots: g.slots.slice(0, 19) });
  assert.equal(few.status, 400);
  assert.equal(few.body.ok, false);
  assert.equal(few.body.error, 'too_few_slots');
  assert.equal(few.body.message.en, EN10);
  assert.equal(few.body.message.fr, FR10);
  for (const m of [EN10, FR10]) assert.doesNotMatch(m, /—|–|AI|IA/);
  assert.equal(s.db.rows('hub_onboard_grids').length, 0, 'a refused save writes nothing');
  const enough = await s.post({ t: s.offer, a: 'grid', slots: g.slots.slice(0, 20) });
  assert.equal(enough.status, 200);
  assert.deepEqual([enough.body.ok, enough.body.saved, enough.body.dropped], [true, 20, 0]);
  assert.equal(s.db.rows('hub_onboard_grids')[0].slots.length, 20);
  // repeats collapse before the count: 40 entries that are 19 different cells are still 19 cells
  const dup = await s.post({ t: s.offer, a: 'grid', slots: [...g.slots.slice(20, 39), ...g.slots.slice(20, 39)] });
  assert.equal(dup.body.error, 'too_few_slots');
  assert.equal(s.db.rows('hub_onboard_grids')[0].slots.length, 20, 'a refused save leaves what was there');
  // clearing the grid is a save of nothing, so it is refused too
  assert.equal((await s.post({ t: s.offer, a: 'grid', slots: [] })).body.error, 'too_few_slots');
});

test('wave271d: the manager\'s grid has no minimum', async () => {
  const s = await setup({ rule: true, cand: { accepted_on: '2026-11-01' }, flows: [flow()] });
  const { slots } = (await s.get(s.mgr)).body.grid;
  const m = await s.post({ t: s.mgr, a: 'grid', slots: [slots[3], slots[9]] });
  assert.equal(m.status, 200);
  assert.deepEqual([m.body.ok, m.body.saved], [true, 2]);
  assert.equal((await s.post({ t: s.mgr, a: 'grid', slots: [] })).body.saved, 0);
  assert.deepEqual(s.db.rows('hub_onboard_grids').map((r) => r.who), ['manager']);
});

test('wave271d: onboard_grid_min_hours sets the minimum; 0 lifts it; nonsense falls back to 10; the cell length counts', async () => {
  const lifted = await setup({ rule: true, cand: { accepted_on: '2026-11-01' }, flows: [flow()], config: { onboard_grid_min_hours: '0' } });
  const lg = (await lifted.get(lifted.offer)).body.grid;
  assert.equal(lg.minHours, 0);
  assert.equal((await lifted.post({ t: lifted.offer, a: 'grid', slots: [lg.slots[0]] })).body.saved, 1, '0 means no minimum');
  assert.equal((await lifted.post({ t: lifted.offer, a: 'grid', slots: [] })).body.saved, 0);

  const four = await setup({ rule: true, cand: { accepted_on: '2026-11-01' }, flows: [flow()], config: { onboard_grid_min_hours: '4', onboard_grid_cell_min: '60' } });
  const fg = (await four.get(four.offer)).body.grid;
  assert.deepEqual([fg.minHours, fg.cellMin], [4, 60]);
  const short = await four.post({ t: four.offer, a: 'grid', slots: fg.slots.slice(0, 3) });
  assert.equal(short.body.error, 'too_few_slots');
  assert.equal(short.body.message.en, 'Please mark at least 4 hours in total, so your manager has a few times to choose from.');
  assert.equal(short.body.message.fr, 'Veuillez indiquer au moins 4 heures en tout, pour que votre gestionnaire ait quelques plages au choix.');
  assert.equal((await four.post({ t: four.offer, a: 'grid', slots: fg.slots.slice(0, 4) })).body.saved, 4, 'four one-hour cells are four hours');

  const one = await setup({ rule: true, cand: { accepted_on: '2026-11-01' }, flows: [flow()], config: { onboard_grid_min_hours: '1' } });
  const og = (await one.get(one.offer)).body.grid;
  const none = await one.post({ t: one.offer, a: 'grid', slots: [og.slots[0]] });
  assert.equal(none.body.message.en, 'Please mark at least 1 hour in total, so your manager has a few times to choose from.');
  assert.equal(none.body.message.fr, 'Veuillez indiquer au moins 1 heure en tout, pour que votre gestionnaire ait quelques plages au choix.');
  assert.equal((await one.post({ t: one.offer, a: 'grid', slots: og.slots.slice(0, 2) })).body.saved, 2);

  for (const bad of ['lots', '-1', '41', '2.5', '', ' ']) {
    const b = await setup({ rule: true, cand: { accepted_on: '2026-11-01' }, flows: [flow()], config: { onboard_grid_min_hours: bad } });
    assert.equal((await b.get(b.offer)).body.grid.minHours, 10, JSON.stringify(bad) + ' falls back to 10');
  }
  const top = await setup({ rule: true, cand: { accepted_on: '2026-11-01' }, flows: [flow()], config: { onboard_grid_min_hours: '40' } });
  assert.equal((await top.get(top.offer)).body.grid.minHours, 40, '40 is the largest allowed');
});

test('wave271d: cells that have started since are dropped before the count', async () => {
  const s = await setup({ rule: true, cand: { accepted_on: '2026-11-01' }, flows: [flow()], now: '2026-11-01T15:00:00Z' });   // 10:00 on 01/11/26
  const g = (await s.get(s.offer)).body.grid;
  const stale = '2026-11-01T13:00:00Z';   // 08:00 today: started
  const refused = await s.post({ t: s.offer, a: 'grid', slots: [stale, ...g.slots.slice(0, 19)] });   // 20 entries, 19 still ahead
  assert.equal(refused.status, 400);
  assert.equal(refused.body.error, 'too_few_slots');
  assert.equal(s.db.rows('hub_onboard_grids').length, 0);
  const saved = await s.post({ t: s.offer, a: 'grid', slots: [stale, ...g.slots.slice(0, 20)] });
  assert.deepEqual([saved.status, saved.body.saved, saved.body.dropped], [200, 20, 1]);
  assert.equal(saved.body.slotsSaved.includes(stale), false);
  // a bad slot is still bad_slots, before the count
  assert.equal((await s.post({ t: s.offer, a: 'grid', slots: ['2026-11-01T15:40:00Z'] })).body.error, 'bad_slots');
});

test('the grid closes once both meetings are booked (the manager\'s once the 1-on-1 is), and before Accept it is refused', async () => {
  const early = await setup({ flows: [] });   // not accepted yet
  const slot = (await early.get(early.offer)).body.grid.slots[0];
  const r = await early.post({ t: early.offer, a: 'grid', slots: [slot] });
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'not_accepted');
  assert.equal(early.db.rows('hub_onboard_grids').length, 0);

  const s = await setup({ cand: { accepted_on: '2026-11-01' }, flows: [flow({ call_at: '2026-11-04T15:00:00Z' })] });
  const { slots } = (await s.get(s.offer)).body.grid;
  assert.equal((await s.post({ t: s.offer, a: 'grid', slots: [slots[0]] })).body.saved, 1, 'the call is booked but the 1-on-1 is not: still open');
  s.db.rows('hub_onboard_flows')[0].one_on_one_at = '2026-11-05T15:00:00Z';
  const before = s.snapshot();
  const g = await s.get(s.offer);
  assert.equal(g.body.closed, true);
  assert.equal(g.body.booked, true);
  const shut = await s.post({ t: s.offer, a: 'grid', slots: [slots[7]] });
  assert.equal(shut.status, 200);
  assert.equal(shut.body.closed, true);
  assert.equal(shut.body.booked, true);
  assert.equal((await s.post({ t: s.mgr, a: 'grid', slots: [slots[7]] })).body.closed, true);
  assert.deepEqual(s.snapshot(), before);

  const mgrOnly = await setup({ cand: { accepted_on: '2026-11-01' }, flows: [flow({ one_on_one_at: '2026-11-05T15:00:00Z' })] });
  assert.equal((await mgrOnly.get(mgrOnly.mgr)).body.closed, true);
  assert.equal((await mgrOnly.get(mgrOnly.offer)).body.closed, false, 'the hire still has the call to book');
});

test('a grid link for a backed-out flow gives closed:true and saves nothing', async () => {
  const s = await setup({ cand: { accepted_on: '2026-11-01' }, flows: [flow({ status: 'backed_out' })] });
  const before = s.snapshot();
  for (const t of [s.offer, s.mgr]) {
    const g = await s.get(t);
    assert.equal(g.status, 200);
    assert.equal(g.body.closed, true);
    assert.ok(hasBoth(g.body.message));
    const p = await s.post({ t, a: 'grid', slots: [g.body.grid.slots[0]] });
    assert.equal(p.body.closed, true);
    assert.equal(p.body.saved, undefined);
  }
  assert.deepEqual(s.snapshot(), before);
});

test('a password link is recognised by its nonce and a GET never uses it up', async () => {
  const s = await setup({ cand: { accepted_on: '2026-11-01' }, flows: [flow({ pw_nonce: 'nonce1', pw_expires_at: '2026-11-08T15:00:00Z', pw_used_at: null })] });
  const pw = await s.rig.mod.wa271Token('pw', 11, 'nonce1');
  const before = s.snapshot();
  const g = await s.get(pw);
  assert.equal(g.body.kind, 'password');
  assert.equal(g.body.first, 'Alex');
  assert.equal(g.body.closed, false);
  assert.equal(g.body.grid, null);
  assert.deepEqual(s.snapshot(), before);
  assert.equal((await s.get(await s.rig.mod.wa271Token('pw', 11, 'other'))).status, 404, 'the wrong nonce is not a link');
  assert.equal((await s.post({ t: pw, a: 'accept' })).body.error, 'wrong_link');
  s.db.rows('hub_onboard_flows')[0].pw_used_at = '2026-11-02T15:00:00Z';
  assert.equal((await s.get(pw)).body.closed, true);
  await assert.rejects(s.rig.mod.wa271Token('pw', 11), /nonce/);
});

test('every message is in English and French and uses Hub words', async () => {
  const s = await setup({ cand: { status: 'withdrawn' }, flows: [flow()] });
  const seen = [];
  seen.push((await s.get('nope')).body);
  seen.push((await s.get(s.offer)).body);
  seen.push((await s.post({ t: s.mgr, a: 'accept' })).body);
  seen.push((await s.post({ t: s.offer, a: 'zzz' })).body);
  seen.push((await s.post({ t: s.offer, a: 'grid', slots: 'x' })).body);
  for (const b of seen) {
    assert.ok(hasBoth(b.message), JSON.stringify(b));
    for (const m of [b.message.en, b.message.fr]) assert.doesNotMatch(m, /\u2014|\u2013|\bAI\b|\bIA\b/);
  }
  assert.match(seen[1].message.en, /HR/);
  assert.match(seen[1].message.fr, /RH/);
});

test('past cells are not offered: a cell that has started is gone from the window, and a day with none left drops out', async () => {
  const s = await setup({ cand: { accepted_on: '2026-11-01' }, flows: [flow()], now: '2026-11-01T15:00:00Z' });   // 10:00 on 01/11/26
  const g = (await s.get(s.offer)).body.grid;
  assert.equal(g.days[0].date, '2026-11-01');
  assert.equal(g.days[0].open, '2026-11-01T15:30:00Z', 'the first day opens at the next cell, 10:30');
  assert.equal(g.days[0].close, '2026-11-02T02:00:00Z');
  assert.equal(g.slots[0], '2026-11-01T15:30:00Z');
  assert.equal(g.slots.length, 14 * 26 - 5, '08:00 to 10:00 have started');
  assert.equal(g.slots.includes('2026-11-01T15:00:00Z'), false, 'a cell starting right now has started');
  // marking only a cell that has started saves nothing and says so
  const past = await s.post({ t: s.offer, a: 'grid', slots: ['2026-11-01T13:00:00Z'] });
  assert.equal(past.status, 200);
  assert.deepEqual([past.body.saved, past.body.dropped, past.body.slotsSaved], [0, 1, []]);
  const mixed = await s.post({ t: s.offer, a: 'grid', slots: ['2026-11-01T13:00:00Z', g.slots[0]] });
  assert.deepEqual([mixed.body.saved, mixed.body.dropped, mixed.body.slotsSaved], [1, 1, [g.slots[0]]]);
  // after the last cell of the day the day is gone
  s.rig.setNow('2026-11-02T01:40:00Z');   // 20:40
  const next = (await s.get(s.offer)).body;
  assert.equal(next.grid.days[0].date, '2026-11-02');
  assert.equal(next.grid.days.length, 13, 'the window still ends 14 days after today (01/11), so it is one day shorter');
  assert.deepEqual(next.slotsSaved, [], 'the saved cell is behind us');
});

test('a return visit on a later day: old slots are not shown, and echoing them back saves instead of looping on bad_slots', async () => {
  const s = await setup({ cand: { accepted_on: '2026-11-01' }, flows: [flow()] });   // 07:00 on 01/11/26
  const day1 = (await s.get(s.offer)).body.grid.slots;
  const [monday, tuesday, wednesday] = [day1[0], day1[26 + 4], day1[52 + 8]];   // 01/11, 02/11 and 03/11
  assert.equal((await s.post({ t: s.offer, a: 'grid', slots: [monday, tuesday, wednesday] })).body.saved, 3);
  s.rig.setNow('2026-11-03T12:00:00Z');   // 07:00 on 03/11: day 3 of the offer
  const back = (await s.get(s.offer)).body;
  assert.equal(back.grid.days[0].date, '2026-11-03');
  assert.deepEqual(back.slotsSaved, [wednesday], 'only what is still ahead');
  const fresh = back.grid.slots[10];
  // a page that sends everything it ever held, plus a new pick
  const echo = await s.post({ t: s.offer, a: 'grid', slots: [monday, tuesday, wednesday, fresh] });
  assert.equal(echo.status, 200);
  assert.deepEqual([echo.body.saved, echo.body.dropped], [2, 2]);
  assert.deepEqual(echo.body.slotsSaved, [wednesday, fresh]);
  assert.deepEqual(s.db.rows('hub_onboard_grids')[0].slots.map((x) => new Date(x).toISOString().replace('.000Z', 'Z')), [wednesday, fresh], 'the stale ones are gone from the row');
  // and a page that echoes exactly what GET gave it
  const again = await s.post({ t: s.offer, a: 'grid', slots: (await s.get(s.offer)).body.slotsSaved });
  assert.equal(again.body.saved, 2);
  assert.equal(again.body.dropped, 0);
  // off the cell boundary stays an error, even for a time that is in the past
  for (const off of ['2026-11-01T13:10:00Z', '2026-11-03T13:10:00Z', '2026-11-01T13:00:30Z']) {
    const r = await s.post({ t: s.offer, a: 'grid', slots: [wednesday, off] });
    assert.equal(r.body.error, 'bad_slots', off);
  }
  assert.equal((await s.post({ t: s.offer, a: 'grid', slots: [wednesday, '2026-12-30T14:00:00Z'] })).body.error, 'bad_slots', 'beyond the end of the window');
});

/* ---------- whole-branch review (final-findings.md) ---------- */
test('I2: an accepted card later closed shuts both links: contact HR, and nothing saved', async () => {
  for (const cand of [{ status: 'withdrawn', accepted_on: '2026-10-20' }, { status: 'declined', accepted_on: '2026-10-20', close_reason: 'Changed their mind' }]) {
    const s = await setup({ cand, flows: [flow()] });
    const before = s.snapshot();
    for (const t of [s.offer, s.mgr]) {
      const g = await s.get(t);
      assert.equal(g.body.closed, true, cand.status);
      assert.match(g.body.message.en, /contact HR/);
      const p = await s.post({ t, a: 'grid', slots: [] });
      assert.equal(p.body.closed, true);
      assert.equal(p.body.saved, undefined);
    }
    const a = await s.post({ t: s.offer, a: 'accept' });
    assert.equal(a.body.closed, true, 'no "Thank you" on a closed card');
    assert.deepEqual(s.snapshot(), before);
  }
});

test('I2: a hired card stays open for grids until booked, and someone who declined by link still sees their answer', async () => {
  const hired = await setup({ cand: { status: 'hired', accepted_on: '2026-10-20' }, flows: [flow()] });
  assert.equal((await hired.get(hired.offer)).body.closed, false);
  assert.equal((await hired.get(hired.mgr)).body.closed, false);
  const no = await setup({ cand: { status: 'declined', close_reason: 'Declined by link' }, flows: [flow()] });
  const g = await no.get(no.offer);
  assert.equal(g.body.closed, false);
  assert.equal(g.body.answered, 'decline');
  assert.equal((await no.get(no.mgr)).body.closed, true, 'the manager has nothing to do on that card');
  assert.equal((await no.post({ t: no.offer, a: 'grid', slots: [] })).body.closed, true);
});

test('D1: a read that fails is a 503 in both languages, never a bad link', async () => {
  const cases = [
    ['hub_candidates', (s) => s.offer], ['hub_onboard_flows', (s) => s.offer], ['hub_onboard_flows', (s) => s.mgr],
    ['app_config', (s) => s.offer], ['hub_onboard_grids', (s) => s.offer],
  ];
  for (const [table, tok] of cases) {
    const s = await setup({ flows: [flow()] });
    s.db.failOn(table, 'select', 'the database is resting');
    const g = await s.get(tok(s));
    assert.equal(g.status, 503, table);
    assert.equal(g.body.error, 'unavailable');
    assert.ok(hasBoth(g.body.message));
    assert.doesNotMatch(JSON.stringify(g.body), /resting/, 'the database\'s words stay inside');
  }
  const p = await setup({ cand: { accepted_on: '2026-10-20' }, flows: [flow()] });
  p.db.failOn('app_config', 'select', 'x');
  const r = await p.post({ t: p.offer, a: 'grid', slots: [] });
  assert.equal(r.status, 503);
  assert.equal(p.db.rows('hub_onboard_grids').length, 0);
});

test('D6: telling the owner has a time limit, so a hung notify cannot hold the answer', async () => {
  const s = await setup({ cand: { owner: null }, config: { offer_signer_email: 'valex@welfareavenue.com' } });
  await s.post({ t: s.offer, a: 'decline' });
  assert.ok(s.rig.fetchLog[0].signal instanceof AbortSignal);
});

test('M1: a default manager\'s first link greets them by name, before anyone has confirmed them', async () => {
  const s = await setup({ flows: [flow({ manager_member_id: null, manager_link_member_id: 1 })] });
  assert.equal((await s.get(s.mgr)).body.first, 'Ruth');
});

test('M8: Decline on a card with an owner leaves the telling to the stage-move trigger, so they get one message', async () => {
  const s = await setup();
  await s.post({ t: s.offer, a: 'decline' });
  assert.equal(s.rig.fetchLog.length, 0);
  const none = await setup({ cand: { owner: null }, config: { offer_signer_email: 'valex@welfareavenue.com' } });
  await none.post({ t: none.offer, a: 'decline' });
  assert.equal(none.rig.fetchLog.length, 1);
});

test('M11: the hire\'s link says when the call is booked, so the page can word what remains', async () => {
  const s = await setup({ cand: { accepted_on: '2026-10-20' }, flows: [flow({ call_at: '2026-11-20T15:00:00Z' })] });
  const g = await s.get(s.offer);
  assert.equal(g.body.callBooked, true);
  assert.equal(g.body.closed, false);
  const n = await setup({ cand: { accepted_on: '2026-10-20' }, flows: [flow()] });
  assert.equal((await n.get(n.offer)).body.callBooked, false);
});

/* ---------- wave275 Task 2: the mgr link proposes times and edits availability ---------- */
/* NOW is Sunday 01/11/26, 07:00 in Toronto (UTC-5 from 02:00 that night). Wednesday 04/11/26: the call at 10:00 (15:00Z), the 1-on-1 at 11:30 (16:30Z). */
const RUN = 'https://stub.supabase.test/functions/v1/onboard-run';
const W_CALL = '2026-11-04T15:00:00.000Z', W_ONE = '2026-11-04T16:30:00.000Z';
const DEFAULT_AV = { weekly: { mon: [['09:00', '17:00']], tue: [['09:00', '17:00']], wed: [['09:00', '17:00']], thu: [['09:00', '17:00']], fri: [['09:00', '17:00']] }, except: [], tz: 'America/Toronto' };
const EXC = { except: [], tz: 'America/Toronto' };   // amended 02/11/26: what the mgr link saves is the one-off dates only; the week comes from Home (wave276)
const offered = (over = {}) => flow({ status: 'offered', created_at: '2026-10-30T12:00:00Z', manager_link_member_id: 2, proposed_call_at: null, proposed_one_on_one_at: null, proposed_by: null, proposed_at: null, hire_answer: null, ...over });   // the Hub sent this link to Sam (2)
const tickSet = (a, db) => {   // the stand-in for wa275_tick_set, as in test/w271run.test.mjs
  const f = db.rows('hub_onboard_flows').find((r) => Number(r.id) === Number(a.p_flow));
  if (!f) return false;
  const cur = f.setup_ticks && typeof f.setup_ticks === 'object' ? f.setup_ticks : {};
  if (a.p_if_unset && cur[a.p_key] != null) return false;
  f.setup_ticks = { ...cur, [a.p_key]: a.p_value ?? null };
  return true;
};
const SAM = (over = {}) => ({ id: 2, name: 'Sam Lee', email: 'sam.lee@welfareavenue.com', active: true, ...over });
const relayOk = (over = {}) => ({ json: { ok: true, repeated: false, proposal: { call_at: W_CALL, one_on_one_at: W_ONE, by: 'sam.lee@welfareavenue.com', at: '2026-11-01T12:00:00.000Z' }, hire_emailed: false, warnings: ['HR was not told: hr_notify_emails is empty.'], ...over } });

test('w275 GET (mgr link, offered flow): mode propose, no proposal, the default availability marked stale, busy times, lengths and lead; nothing saved, no fetch', async () => {
  const events = [
    { id: 'e1', summary: 'Board meeting', attendee_emails: ['sam.lee@welfareavenue.com'], status: 'confirmed', start_at: '2026-11-03T15:00:00Z', end_at: '2026-11-03T16:00:00Z' },
    { id: 'e2', summary: 'Cancelled', attendee_emails: ['sam.lee@welfareavenue.com'], status: 'cancelled', start_at: '2026-11-03T17:00:00Z', end_at: '2026-11-03T18:00:00Z' },
    { id: 'e3', summary: 'Not Sam', attendee_emails: ['ruth.owen@welfareavenue.com'], status: 'confirmed', start_at: '2026-11-03T17:00:00Z', end_at: '2026-11-03T18:00:00Z' },
    { id: 'e4', summary: 'Too far', attendee_emails: ['sam.lee@welfareavenue.com'], status: 'confirmed', start_at: '2026-11-25T15:00:00Z', end_at: '2026-11-25T16:00:00Z' },
    { id: 'e5', summary: 'Past', attendee_emails: ['sam.lee@welfareavenue.com'], status: 'confirmed', start_at: '2026-10-30T15:00:00Z', end_at: '2026-10-30T16:00:00Z' },
  ];
  const other = offered({ id: 22, candidate_id: 12, proposed_call_at: '2026-11-05T15:00:00Z', proposed_one_on_one_at: '2026-11-05T17:00:00Z' });
  const s = await setup({ cand: { accepted_on: null }, flows: [offered(), other], tables: { hub_events: events, hub_candidates: [candidate({ accepted_on: null }), candidate({ id: 12, name: 'Bo Chen' })] } });
  const before = s.snapshot();
  const g = await s.get(s.mgr);
  assert.deepEqual(s.snapshot(), before, 'scanner safety: a GET saves nothing');
  assert.equal(s.rig.fetchLog.length, 0);
  assert.equal(g.status, 200);
  const b = g.body;
  assert.equal(b.kind, 'manager');
  assert.equal(b.mode, 'propose');
  assert.equal(b.first, 'Sam');
  assert.equal(b.hire, 'Alex');
  assert.equal(b.proposal, null);
  assert.deepEqual(b.availability, DEFAULT_AV);
  assert.equal(b.availabilityAt, null);
  assert.equal(b.availabilityStale, true);
  assert.equal(b.noWeek, true, 'amended 02/11/26: no week saved on Home yet, so the page sends Sam there');
  assert.equal(b.exceptAt, null);
  assert.deepEqual(b.lengths, { callMin: 60, oneMin: 30 });
  assert.equal(b.leadHours, 48);
  assert.equal(b.hireAccepted, false);
  assert.equal(b.hireAnswer, null);
  assert.deepEqual(b.busy, [
    { start: '2026-11-03T15:00:00Z', end: '2026-11-03T16:00:00Z' },
    { start: '2026-11-05T15:00:00Z', end: '2026-11-05T16:00:00Z', taken: true },
    { start: '2026-11-05T17:00:00Z', end: '2026-11-05T17:30:00Z', taken: true },
  ], 'no meeting title ever leaves over the no-login link');
  assert.doesNotMatch(JSON.stringify(b), /Board meeting/);
  assert.ok(b.grid && b.grid.slots.length > 0, 'the window gives the page its cells');
});

test('w275 GET (amended 02/11/26): the week Sam saved on Home with his one-off dates, read through wa275_availability_of; stale after his team asks again; a proposal; mode grid for a wave271 flow (before onboard_v2_since, or with no proposal and no release time)', async () => {
  const av = { weekly: { tue: [['18:00', '21:00']] }, except: [{ date: '2026-11-11', free: [] }], tz: 'America/Toronto' };
  const reads = [];
  const home = { team_members: [team[0], SAM({ availability: { weekly: { mon: [['06:00', '07:00']] }, except: av.except, tz: 'America/Toronto' }, availability_at: '2026-10-20T12:00:00Z' })], hub_team_avail: weekRows('sam.lee@welfareavenue.com', av.weekly, { at: '2026-10-03T12:00:00Z' }) };
  const fresh = await setup({ flows: [offered({ proposed_call_at: W_CALL, proposed_one_on_one_at: W_ONE, proposed_by: 'sam.lee@welfareavenue.com', proposed_at: '2026-10-31T12:00:00Z' })], tables: home });
  fresh.db.onRpc('wa275_availability_of', (a, db, w) => { reads.push([Number(a.p_member), w.jwt]); return availabilityOf(a, db, w); });
  const g = (await fresh.get(fresh.mgr)).body;
  assert.deepEqual(g.availability, av, 'the week from Home, the dates from the roster row; a weekly left on the roster row is never read');
  assert.deepEqual(reads, [[2, null]], 'one read, for Sam, with the service key');
  assert.equal(g.availabilityAt, '2026-10-03T12:00:00Z', 'when the week was saved');
  assert.equal(g.exceptAt, '2026-10-20T12:00:00Z', 'when the dates were saved');
  assert.equal(g.availabilityStale, false, 'no ask since he saved it: current, however old (no 30-day rule now)');
  assert.equal(g.noWeek, false);
  assert.deepEqual(g.proposal, { call_at: '2026-11-04T15:00:00Z', one_on_one_at: '2026-11-04T16:30:00Z', by: 'sam.lee@welfareavenue.com', at: '2026-10-31T12:00:00Z' }, 'instants written as the grid\'s cells are');
  const old = await setup({ flows: [offered()], tables: { ...home, hub_team_avail_ask: [{ id: 1, department: 'progdev', ask_date: '2026-10-26', set_by: 'wave276' }] } });
  assert.equal((await old.get(old.mgr)).body.availabilityStale, true, 'his team asked again on 26/10 and he has not saved since: stale');
  const later = await setup({ flows: [offered()], tables: { ...home, hub_team_avail_ask: [{ id: 1, department: 'progdev', ask_date: '2026-11-20', set_by: 'wave276' }] } });
  assert.equal((await later.get(later.mgr)).body.availabilityStale, false, 'an ask dated later does not count yet');
  const v1 = await setup({ cand: { accepted_on: '2026-10-20' }, flows: [flow({ created_at: '2026-10-20T12:00:00Z' })] });
  const g1 = (await v1.get(v1.mgr)).body;
  assert.equal(g1.mode, 'grid', 'no release time yet, accepted, nothing proposed: the wave271 grid');
  assert.equal(g1.proposal, undefined);
  const before = await setup({ cand: { accepted_on: '2026-10-20' }, flows: [flow({ created_at: '2026-10-20T12:00:00Z' })], config: { onboard_v2_since: '2026-10-25T00:00:00Z' } });
  assert.equal((await before.get(before.mgr)).body.mode, 'grid', 'created before the release keeps its path');
  const after = await setup({ cand: { accepted_on: '2026-10-28' }, flows: [flow({ created_at: '2026-10-26T12:00:00Z' })], config: { onboard_v2_since: '2026-10-25T00:00:00Z' } });
  assert.equal((await after.get(after.mgr)).body.mode, 'propose', 'created after the release: the new path even once accepted');
  const yes = await setup({ cand: { accepted_on: '2026-10-28' }, flows: [offered({ status: 'waiting', hire_answer: 'yes', proposed_at: '2026-10-31T12:00:00Z', proposed_call_at: W_CALL, proposed_one_on_one_at: W_ONE })] });
  const gy = (await yes.get(yes.mgr)).body;
  assert.equal(gy.hireAnswer, 'yes');
  assert.equal(gy.hireAccepted, true);
});

test('w275 POST availability (amended 02/11/26): the one-off dates only, saved on the manager\'s roster row as {except, tz} with availability_at now; the answer is the whole of it read again (the week from Home)', async () => {
  const s = await setup({ flows: [offered()], tables: { team_members: [team[0], SAM()], hub_team_avail: weekRows('sam.lee@welfareavenue.com', { tue: [['18:00', '21:00']] }, { at: '2026-10-03T12:00:00Z' }) } });
  const ex = { except: [{ date: '2026-11-12', free: [['18:00', '20:30'], ['09:00', '10:00']] }, { date: '2026-11-11', free: [] }] };
  const r = await s.post({ t: s.mgr, a: 'availability', availability: ex });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const dates = [{ date: '2026-11-11', free: [] }, { date: '2026-11-12', free: [['09:00', '10:00'], ['18:00', '20:30']] }];
  assert.deepEqual(r.body, { ok: true, availability: { weekly: { tue: [['18:00', '21:00']] }, except: dates, tz: 'America/Toronto' }, availabilityAt: '2026-10-03T12:00:00Z', availabilityStale: false, noWeek: false, exceptAt: '2026-11-01T12:00:00Z' });
  const row = s.db.rows('team_members').find((m) => m.id === 2);
  assert.deepEqual(row.availability, { except: dates, tz: 'America/Toronto' }, 'dates in order, blocks in order, tz added, no week stored');
  assert.equal(row.availability_at, '2026-11-01T12:00:00.000Z');
  assert.equal(s.db.rows('team_members').find((m) => m.id === 1).availability, undefined, 'nobody else\'s row');
  assert.equal(s.rig.fetchLog.length, 0);
  const g = (await s.get(s.mgr)).body;
  assert.deepEqual(g.availability.except, dates);
  assert.deepEqual(g.availability.weekly, { tue: [['18:00', '21:00']] });
});

test('w275 POST availability: a weekly key is refused in both languages (set your week on Home), and anything the Task 1 rule refuses is a 400 bad_availability; nothing is saved', async () => {
  const bad = [
    { except: [{ date: '2026-11-11', free: [['09:00', '24:30']] }] }, { except: [{ date: '2026-11-11', free: [['24:00', '25:00']] }] }, { except: [{ date: '2026-11-11', free: [['09:07', '10:00']] }] },
    { except: [{ date: '2026-11-11', free: [['10:00', '10:00']] }] }, { except: [{ date: '2026-11-11', free: [['11:00', '10:00']] }] }, { except: [{ date: '2026-11-11', free: [['9:00', '10:00']] }] },
    { except: [{ date: '2026-11-11', free: ['09:00', '10:00'] }] }, { except: [{ date: '2026-11-11', free: [['09:00', '10:00', '11:00']] }] }, { except: [], extra: 1 }, { except: [], tz: 'Europe/Paris' },
    { except: [{ date: '2026-02-30', free: [] }] }, { except: [{ date: '2026-11-11' }] }, { except: [{ date: '2026-11-11', free: [], note: 'x' }] },
    { except: [{ date: '2026-11-11', free: [] }, { date: '2026-11-11', free: [] }] }, { except: {} }, null, 'mon 9 to 5', [],
    { except: [{ date: '2026-11-11', free: Array.from({ length: 13 }, (_, i) => [String(i).padStart(2, '0') + ':00', String(i).padStart(2, '0') + ':30']) }] },
  ];
  const s = await setup({ flows: [offered()], tables: { team_members: [team[0], SAM()] } });
  const before = s.snapshot();
  for (const availability of bad) {
    const r = await s.post({ t: s.mgr, a: 'availability', availability });
    assert.equal(r.status, 400, JSON.stringify(availability));
    assert.equal(r.body.error, 'bad_availability');
    assert.ok(hasBoth(r.body.message));
  }
  for (const availability of [{ weekly: {} }, DEFAULT_AV, { weekly: { mon: [['09:00', '17:00']] }, except: [] }]) {
    const r = await s.post({ t: s.mgr, a: 'availability', availability });
    assert.equal(r.status, 400, JSON.stringify(availability));
    assert.equal(r.body.error, 'weekly_moved');
    assert.ok(hasBoth(r.body.message));
    assert.match(r.body.message.en, /Home page, at hub\.welfareavenue\.com\. Here you can only add or remove one-off dates\./);
    assert.ok(!/\u2014/.test(r.body.message.en + r.body.message.fr) && !/\bAI\b/.test(r.body.message.en));
  }
  assert.deepEqual(s.snapshot(), before);
  assert.equal((await s.post({ t: s.offer, a: 'availability', availability: EXC })).body.error, 'wrong_link', 'the hire\'s link cannot set the manager\'s hours');
  const gone = await setup({ flows: [offered({ status: 'backed_out' })], tables: { team_members: [team[0], SAM()] } });
  const g = await gone.post({ t: gone.mgr, a: 'availability', availability: EXC });
  assert.equal(g.body.closed, true);
  assert.equal(gone.db.rows('team_members')[1].availability, undefined);
  const nobody = await setup({ flows: [offered({ manager_member_id: null, manager_link_member_id: null })] });
  assert.equal((await nobody.post({ t: nobody.mgr, a: 'availability', availability: EXC })).body.error, 'no_manager');
});

test('w275 POST propose: relays to onboard-run with the trigger secret and by manager, and gives the page the proposal', async () => {
  const s = await setup({ flows: [offered()], notify: false });
  s.rig.fetchOn(RUN, relayOk());
  const r = await s.post({ t: s.mgr, a: 'propose', call_at: W_CALL, one_on_one_at: W_ONE });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body, { ok: true, repeated: false, proposal: { call_at: W_CALL, one_on_one_at: W_ONE, by: 'sam.lee@welfareavenue.com', at: '2026-11-01T12:00:00.000Z' }, hireEmailed: false });
  assert.equal(s.rig.fetchLog.length, 1);
  const e = s.rig.fetchLog[0];
  assert.equal(e.url, RUN);
  assert.equal(e.method, 'POST');
  assert.equal(e.headers['x-wa-secret'], 'trigger-secret-for-tests');
  assert.equal(e.headers.authorization, 'Bearer anon-key-for-tests');
  assert.deepEqual(e.body, { action: 'propose', flow_id: 11, call_at: W_CALL, one_on_one_at: W_ONE, by: 'manager' });
  assert.ok(e.signal instanceof AbortSignal, 'a time limit');
  assert.equal(s.db.rows('hub_onboard_flows')[0].proposed_at, null, 'onboard-link writes nothing itself: the rules and the save are onboard-run\'s');
});

test('w275 POST propose: onboard-run\'s refusals reach the page in both languages; a run that cannot answer is a 503; the wrong link or a closed one never relays', async () => {
  const s = await setup({ flows: [offered()], notify: false });
  s.rig.fetchOn(RUN, { status: 409, json: { error: 'taken', message: 'The onboarding call clashes.', messages: { en: 'The onboarding call clashes.', fr: 'L’appel d’accueil tombe en même temps.' }, which: 'call' } });
  const r = await s.post({ t: s.mgr, a: 'propose', call_at: W_CALL, one_on_one_at: W_ONE });
  assert.equal(r.status, 409);
  assert.deepEqual(r.body, { ok: false, error: 'taken', message: { en: 'The onboarding call clashes.', fr: 'L’appel d’accueil tombe en même temps.' }, which: 'call' });
  const down = await setup({ flows: [offered()], notify: false });
  down.rig.fetchOn(RUN, () => { throw new Error('connection refused'); });
  const d = await down.post({ t: down.mgr, a: 'propose', call_at: W_CALL, one_on_one_at: W_ONE });
  assert.equal(d.status, 503);
  assert.equal(d.body.error, 'unavailable');
  assert.ok(hasBoth(d.body.message));
  const odd = await setup({ flows: [offered()], notify: false });
  odd.rig.fetchOn(RUN, { status: 500, json: { error: 'failed', message: 'something inside' } });
  const o = await odd.post({ t: odd.mgr, a: 'propose', call_at: W_CALL, one_on_one_at: W_ONE });
  assert.equal(o.status, 503);
  assert.doesNotMatch(JSON.stringify(o.body), /something inside/);
  for (const [fl, tok, want] of [[offered(), 'offer', 'wrong_link'], [offered({ status: 'backed_out' }), 'mgr', 'closed'], [flow({ created_at: '2026-10-20T12:00:00Z' }), 'mgr', 'wrong_link']]) {
    const x = await setup({ cand: { accepted_on: '2026-10-20' }, flows: [fl], notify: false });
    const p = await x.post({ t: x[tok], a: 'propose', call_at: W_CALL, one_on_one_at: W_ONE });
    assert.equal(want === 'closed' ? (p.body.closed ? 'closed' : p.body.error) : p.body.error, want, JSON.stringify(p.body));
    assert.equal(x.rig.fetchLog.length, 0);
  }
});

test('w275 integration: the mgr link and the real onboard-run on one database save the proposal, tell HR and, once accepted, email the hire', async () => {
  const config = { hr_notify_emails: 'ruth.owen@welfareavenue.com', onboard_propose_lead_hours: '48', onboard_call_min: '60', onboard_one_on_one_min: '30', mail_mode: 'live' };
  const s = await setup({ cand: { accepted_on: null }, flows: [offered()], config, notify: false, tables: { team_members: [team[0], SAM()], hub_events: [] } });
  const { generateKeyPairSync } = await import('node:crypto');
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const run = await loadFn('onboard-run', { secrets: { GOOGLE_SA_KEY: JSON.stringify({ client_email: 'hub@stub.iam', private_key: privateKey, token_uri: 'https://oauth2.googleapis.com/token' }) } });
  run.db.tables = s.db.tables;   // one database for both functions
  run.db.onRpc('wa275_tick_set', tickSet);
  run.db.onRpc('wa275_availability_of', availabilityOf);
  run.setNow(NOW);
  run.fetchOn(NOTIFY, (e) => ({ json: { outcome: Object.fromEntries([].concat(e.body.to || e.body.to_email).map((x) => [x, 'sent'])), hub: 'off' } }));
  run.fetchOn('https://oauth2.googleapis.com/token', { json: { access_token: 'tok', expires_in: 3600 } });
  run.fetchOn('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { json: { id: 'mail1' } });
  s.rig.fetchOn(RUN, (e) => run.call(new Request(RUN, { method: 'POST', headers: e.headers, body: JSON.stringify(e.body) })));
  const r = await s.post({ t: s.mgr, a: 'propose', call_at: W_CALL, one_on_one_at: W_ONE });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.hireEmailed, false, 'not accepted yet');
  const f = s.db.rows('hub_onboard_flows')[0];
  assert.deepEqual([f.proposed_call_at, f.proposed_one_on_one_at, f.proposed_by], [W_CALL, W_ONE, 'sam.lee@welfareavenue.com']);
  assert.equal(run.fetchLog.filter((x) => x.url === NOTIFY).length, 1, 'HR told once');
  assert.equal(run.fetchLog.filter((x) => x.url.includes('gmail')).length, 0);
  const taken = await s.post({ t: s.mgr, a: 'propose', call_at: '2026-11-04T14:00:00Z', one_on_one_at: W_ONE });
  assert.equal(taken.status, 200, 'the manager may change their own times');
  /* the hire accepts later: Task 3 calls hire_times; here, the same secret action by hand */
  s.db.rows('hub_candidates')[0].accepted_on = '2026-11-01';
  const h = await run.call(new Request(RUN, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-wa-secret': 'trigger-secret-for-tests', Authorization: 'Bearer anon-key-for-tests' }, body: JSON.stringify({ action: 'hire_times', flow_id: 11 }) }));
  assert.equal(h.status, 200);
  assert.equal(run.fetchLog.filter((x) => x.url.includes('gmail')).length, 1, 'the hire is emailed their yes-or-no link');
  const refused = await s.post({ t: s.mgr, a: 'propose', call_at: '2026-11-02T15:00:00Z', one_on_one_at: W_ONE });
  assert.equal(refused.status, 409);
  assert.equal(refused.body.error, 'lead_time');
  assert.ok(hasBoth(refused.body.message));
  assert.deepEqual(s.rig.unregistered(), []);
  assert.deepEqual(run.unregistered(), []);
});

test('w275 POST propose on a practice flow: the one relay, and onboard-run makes no fetch of its own', async () => {
  const s = await setup({ cand: { practice: true }, flows: [offered({ practice: true })], notify: false, tables: { team_members: [team[0], SAM()] } });
  const run = await loadFn('onboard-run', {});
  run.db.tables = s.db.tables;
  run.db.onRpc('wa275_tick_set', tickSet);
  run.db.onRpc('wa275_availability_of', availabilityOf);
  run.setNow(NOW);
  s.rig.fetchOn(RUN, (e) => run.call(new Request(RUN, { method: 'POST', headers: e.headers, body: JSON.stringify(e.body) })));
  const r = await s.post({ t: s.mgr, a: 'propose', call_at: W_CALL, one_on_one_at: W_ONE });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.practice, true);
  assert.equal(s.rig.fetchLog.length, 1);
  assert.equal(run.fetchLog.length, 0);
  assert.equal(s.db.rows('hub_onboard_flows')[0].proposed_call_at, W_CALL);
});

/* ---------- wave275 Task 2, fix round 1: a mgr link is the manager's only while the Hub last sent it to them ---------- */
const NOT_YOURS_EN = 'This link is no longer yours; a new link is on its way to the right person.';
test('w275 fix: the manager changed (manager_member_id is not who got the link): GET shows nothing of theirs, and neither POST writes or relays', async () => {
  const av = { weekly: { tue: [['18:00', '21:00']] }, except: [], tz: 'America/Toronto' };
  const s = await setup({ flows: [offered({ manager_member_id: 2, manager_link_member_id: 1 })], notify: false,
    tables: { team_members: [{ ...team[0], active: true }, SAM({ availability: av, availability_at: '2026-10-30T12:00:00Z' })], hub_events: [{ id: 'e1', summary: 'Board meeting', attendee_emails: ['sam.lee@welfareavenue.com'], status: 'confirmed', start_at: '2026-11-03T15:00:00Z', end_at: '2026-11-03T16:00:00Z' }] } });
  const before = s.snapshot();
  const g = (await s.get(s.mgr)).body;
  assert.equal(g.notYours, true);
  assert.equal(g.message.en, NOT_YOURS_EN);
  assert.ok(hasBoth(g.message));
  for (const k of ['availability', 'busy', 'proposal', 'availabilityAt']) assert.equal(g[k], undefined, 'no ' + k + ' for the old holder');
  const a = await s.post({ t: s.mgr, a: 'availability', availability: EXC });
  assert.equal(a.status, 409);
  assert.equal(a.body.error, 'not_yours');
  assert.deepEqual(a.body.message, { en: NOT_YOURS_EN, fr: 'Ce lien n\'est plus le vôtre; un nouveau lien est en route vers la bonne personne.' });
  const p = await s.post({ t: s.mgr, a: 'propose', call_at: W_CALL, one_on_one_at: W_ONE });
  assert.equal(p.status, 409);
  assert.equal(p.body.error, 'not_yours');
  assert.deepEqual(s.snapshot(), before, 'neither Sam\'s hours nor Ruth\'s were written');
  assert.equal(s.rig.fetchLog.length, 0, 'nothing relayed to onboard-run');
});

test('w275 fix: a cleared manager_link_member_id (change_manager resets it) refuses both POSTs until the new link goes out', async () => {
  const s = await setup({ flows: [offered({ manager_link_member_id: null })], notify: false, tables: { team_members: [team[0], SAM()] } });
  const before = s.snapshot();
  assert.equal((await s.get(s.mgr)).body.notYours, true);
  assert.equal((await s.post({ t: s.mgr, a: 'availability', availability: EXC })).body.error, 'not_yours');
  assert.equal((await s.post({ t: s.mgr, a: 'propose', call_at: W_CALL, one_on_one_at: W_ONE })).body.error, 'not_yours');
  assert.deepEqual(s.snapshot(), before);
  assert.equal(s.rig.fetchLog.length, 0);
  /* the hourly job sends the new link: the same token works again for the manager it was sent to */
  s.db.rows('hub_onboard_flows')[0].manager_link_member_id = 2;
  assert.equal((await s.post({ t: s.mgr, a: 'availability', availability: EXC })).status, 200);
  /* a default manager with no manager_member_id: the link holder is the manager */
  const d = await setup({ flows: [offered({ manager_member_id: null, manager_link_member_id: 2 })], notify: false, tables: { team_members: [team[0], SAM()] } });
  assert.equal((await d.post({ t: d.mgr, a: 'availability', availability: EXC })).status, 200);
});

test('w275 fix: a wave271 grid link (mode grid) cannot set anyone\'s availability', async () => {
  const s = await setup({ cand: { accepted_on: '2026-10-20' }, flows: [flow({ created_at: '2026-10-20T12:00:00Z', manager_link_member_id: 2 })], tables: { team_members: [team[0], SAM()] } });
  const r = await s.post({ t: s.mgr, a: 'availability', availability: EXC });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'wrong_link');
  assert.equal(s.db.rows('team_members')[1].availability, undefined);
});

test('w275 fix: GET leaves out another hire\'s proposal once that hire has answered; their booked times stay', async () => {
  const other = offered({ id: 22, candidate_id: 12, hire_answer: 'no', proposed_call_at: '2026-11-05T15:00:00Z', proposed_one_on_one_at: '2026-11-05T17:00:00Z', one_on_one_at: '2026-11-06T15:00:00Z' });
  const s = await setup({ flows: [offered(), other], tables: { hub_candidates: [candidate({ accepted_on: null }), candidate({ id: 12, name: 'Bo Chen' })] } });
  assert.deepEqual((await s.get(s.mgr)).body.busy, [{ start: '2026-11-06T15:00:00Z', end: '2026-11-06T15:30:00Z', taken: true }]);
});

/* ---------- wave275 Task 3: the hire's side of the offer link (Accept with hours, Yes or No, the setup rundown) ---------- */
/* The flow below was created after onboard_v2_since, so the offer link is on the wave275 path (mode propose). */
const V2CFG = { onboard_v2_since: '2026-10-01T00:00:00Z' };
const withProposal = { proposed_call_at: W_CALL, proposed_one_on_one_at: W_ONE, proposed_by: 'sam.lee@welfareavenue.com', proposed_at: '2026-10-31T12:00:00Z' };
async function hire({ cand = {}, fl = {}, config = {}, tables = {}, run } = {}) {
  const s = await setup({ cand: { accepted_on: '2026-10-31', offer_hours: 6, ...cand }, flows: [offered({ status: 'waiting', ...fl })], config: { ...V2CFG, hr_notify_emails: 'ruth.owen@welfareavenue.com', onboard_require_hours: 'on', onboard_manager_hours: 'on', ...config }, notify: false, tables: { team_members: [team[0], SAM()], hub_events: [], ...tables } });
  s.tells = [];
  s.rig.fetchOn(NOTIFY, (e) => { s.tells.push(e.body); return { json: { outcome: {}, hub: 'off' } }; });
  s.relays = [];
  s.rig.fetchOn(RUN, (e) => { s.relays.push(e); return run ? run(e) : { json: { ok: true } }; });
  s.db.onRpc('wa275_tick_set', tickSet);
  s.flow = () => s.db.rows('hub_onboard_flows')[0];
  return s;
}
/* onboard-link hands the at-Accept setup to the runtime (EdgeRuntime.waitUntil) so the hire's answer returns at once; the tests hold the promises */
async function withBackground(fn) {
  const pending = [];
  globalThis.EdgeRuntime = { waitUntil: (p) => { pending.push(p); } };
  try { return await fn(pending); } finally { delete globalThis.EdgeRuntime; }
}

test('w275 GET (offer link): the hours, the proposal with the manager, the answer and the setup rundown with its ticks; nothing saved, no fetch', async () => {
  const s = await hire({ fl: { ...withProposal, setup_ticks: { hire_times_at: '2026-10-31T12:00:00Z', rd_profile: '2026-10-31T13:00:00Z' } } });
  const before = s.snapshot();
  const g = (await s.get(s.offer)).body;
  assert.deepEqual(s.snapshot(), before, 'scanner safety');
  assert.equal(s.rig.fetchLog.length, 0);
  assert.equal(g.mode, 'propose');
  assert.deepEqual([g.offerHours, g.hoursConfirmed, g.answer, g.askAvailability, g.manager, g.bookedTimes, g.closed], [6, false, null, true, 'Sam Lee', null, false]);
  assert.deepEqual(g.proposal, { call_at: '2026-11-04T15:00:00Z', one_on_one_at: '2026-11-04T16:30:00Z' });
  assert.ok(Array.isArray(g.setup.steps) && g.setup.steps.length >= 8, 'the rundown from the SOP');
  for (const st of g.setup.steps) {
    assert.ok(/^[a-z_]+$/.test(st.key) && hasBoth(st.title) && hasBoth(st.body), JSON.stringify(st));
    assert.ok(!/—|\bAI\b/.test(JSON.stringify(st)), st.key);
  }
  assert.deepEqual(Object.keys(g.setup.ticks).sort(), g.setup.steps.map((x) => x.key).sort());
  assert.equal(g.setup.ticks.profile, true);
  assert.equal(Object.values(g.setup.ticks).filter(Boolean).length, 1, 'hire_times_at is not a rundown tick');
  const q = await s.rig.call(new Request(URL_ + '?t=' + encodeURIComponent(s.offer) + '&setup=1'));
  const qs = await q.json();
  assert.deepEqual(qs.setup, g.setup, 'GET ?setup gives the rundown');
  const none = await hire();
  assert.equal((await none.get(none.offer)).body.proposal, null, 'no proposal yet: the page says we are choosing the times');
  const unaccepted = await hire({ cand: { accepted_on: null }, fl: { status: 'offered', ...withProposal } });
  const u = (await unaccepted.get(unaccepted.offer)).body;
  assert.equal(u.setup, null, 'no rundown before Accept');
  assert.equal(u.answered, '');
  assert.equal(u.offerHours, 6);
});

test('w275 GET after the Yes: the closing page and the rundown stay open, with the booked times; the grid is shut', async () => {
  const s = await hire({ cand: { status: 'hired' }, fl: { ...withProposal, hire_answer: 'yes', call_at: W_CALL, one_on_one_at: W_ONE, status: 'started' } });
  const g = (await s.get(s.offer)).body;
  assert.equal(g.closed, false);
  assert.equal(g.answer, 'yes');
  assert.deepEqual(g.bookedTimes, { call_at: '2026-11-04T15:00:00Z', one_on_one_at: '2026-11-04T16:30:00Z' });
  assert.ok(g.setup);
  const grid = await s.post({ t: s.offer, a: 'grid', slots: [] });
  assert.equal(grid.body.closed, true);
  assert.equal(grid.body.booked, true);
  const v1 = await setup({ cand: { accepted_on: '2026-10-20' }, flows: [flow({ call_at: W_CALL, one_on_one_at: W_ONE })] });
  assert.equal((await v1.get(v1.offer)).body.closed, true, 'a wave271 link still closes once both are booked');
});

test('w275 Accept with hours: refused without hours_ok (hours_required, both languages, nothing saved); with it, hours_confirmed_at is set and accept_setup is asked once, without waiting for it', async () => {
  await withBackground(async (pending) => {
    let release;
    const gate = new Promise((r) => { release = r; });
    const s = await hire({ cand: { accepted_on: null }, fl: { status: 'offered' }, run: async () => { await gate; return { json: { ok: true } }; } });
    const before = s.snapshot();
    for (const extra of [{}, { hours_ok: 'yes' }, { hours_ok: 1 }]) {
      const no = await s.post({ t: s.offer, a: 'accept', ...extra });
      assert.equal(no.status, 400, JSON.stringify(extra));
      assert.equal(no.body.error, 'hours_required');
      assert.ok(hasBoth(no.body.message));
      assert.match(no.body.message.en, /6 hours a week/);
      assert.match(no.body.message.fr, /6 heures par semaine/);
    }
    assert.deepEqual(s.snapshot(), before);
    assert.equal(s.rig.fetchLog.length, 0);
    const both = await Promise.all([s.post({ t: s.offer, a: 'accept', hours_ok: true }), s.post({ t: s.offer, a: 'accept', hours_ok: true })]);
    assert.deepEqual(both.map((r) => r.status), [200, 200], 'the answer came back while onboard-run had not answered yet');
    assert.deepEqual(both.map((r) => r.body.repeated).sort(), [false, true]);
    const c = s.cand();
    assert.equal(c.accepted_on, '2026-11-01');
    assert.equal(c.hours_confirmed_at, '2026-11-01T12:00:00.000Z');
    assert.equal(s.flow().status, 'waiting');
    release();
    await Promise.all(pending);
    assert.equal(s.relays.length, 1, 'accept_setup is asked once');
    assert.deepEqual(s.relays[0].body, { action: 'accept_setup', flow_id: 11 });
    assert.equal(s.relays[0].headers['x-wa-secret'], 'trigger-secret-for-tests');
    assert.equal(s.relays[0].headers.authorization, 'Bearer anon-key-for-tests');
    const decline = await hire({ cand: { accepted_on: null }, fl: { status: 'offered' } });
    assert.equal((await decline.post({ t: decline.offer, a: 'decline' })).body.answer, 'decline', 'Decline needs no hours');
  });
});

test('w275 an offer from before wave275 (no offer_hours) accepts without hours_ok, and a wave271 flow asks onboard-run nothing', async () => {
  await withBackground(async (pending) => {
    const s = await setup({ flows: [] });
    const r = await s.post({ t: s.offer, a: 'accept' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.answer, 'accept');
    assert.equal(s.cand().hours_confirmed_at, undefined);
    await Promise.all(pending);
    assert.equal(s.rig.fetchLog.length, 0);
    const g = (await s.get(s.offer)).body;
    assert.deepEqual([g.offerHours, g.hoursConfirmed, g.mode], [null, false, 'grid']);
  });
});

test('w275 Yes relays book with the proposed times and by hire; stale comes back as stale (the page shows the grid); a repeat or a wave271 link books nothing', async () => {
  const s = await hire({ fl: withProposal, run: () => ({ json: { ok: true, repeated: false, call_at: '2026-11-04T15:00:00.000Z', one_on_one_at: '2026-11-04T16:30:00.000Z', steps: [] } }) });
  const r = await s.post({ t: s.offer, a: 'yes' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body, { ok: true, answer: 'yes', repeated: false, bookedTimes: { call_at: '2026-11-04T15:00:00Z', one_on_one_at: '2026-11-04T16:30:00Z' } });
  assert.equal(s.relays.length, 1);
  assert.deepEqual(s.relays[0].body, { action: 'book', flow_id: 11, call_at: '2026-11-04T15:00:00Z', one_on_one_at: '2026-11-04T16:30:00Z', by: 'hire' });
  assert.equal(s.relays[0].headers['x-wa-secret'], 'trigger-secret-for-tests');
  assert.ok(s.relays[0].signal instanceof AbortSignal, 'a time limit');
  assert.equal(s.flow().hire_answer, null, 'onboard-link writes nothing itself: the re-check and the booking are onboard-run\'s');
  const stale = await hire({ fl: withProposal, run: () => ({ status: 409, json: { error: 'stale', which: 'call', message: 'Those times no longer work.', messages: { en: 'Those times no longer work.', fr: 'Ces heures ne conviennent plus.' }, ask_availability: true } }) });
  const st = await stale.post({ t: stale.offer, a: 'yes' });
  assert.equal(st.status, 409);
  assert.deepEqual(st.body, { ok: false, stale: true, error: 'stale', message: { en: 'Those times no longer work.', fr: 'Ces heures ne conviennent plus.' }, askAvailability: true, which: 'call' });
  const down = await hire({ fl: withProposal, run: () => { throw new Error('connection refused'); } });
  const d = await down.post({ t: down.offer, a: 'yes' });
  assert.equal(d.status, 503);
  assert.ok(hasBoth(d.body.message));
  const done = await hire({ fl: { ...withProposal, hire_answer: 'yes', call_at: W_CALL, one_on_one_at: W_ONE } });
  const again = await done.post({ t: done.offer, a: 'yes' });
  assert.deepEqual([again.status, again.body.repeated, again.body.answer], [200, true, 'yes']);
  assert.equal(done.relays.length, 0);
  const none = await hire();
  const n = await none.post({ t: none.offer, a: 'yes' });
  assert.deepEqual([n.status, n.body.error], [409, 'no_proposal']);
  assert.ok(hasBoth(n.body.message));
  assert.equal(none.relays.length, 0);
  const v1 = await setup({ cand: { accepted_on: '2026-10-20' }, flows: [flow({ created_at: '2026-10-20T12:00:00Z' })] });
  assert.equal((await v1.post({ t: v1.offer, a: 'yes' })).body.error, 'wrong_link');
  assert.equal((await s.post({ t: s.mgr, a: 'yes' })).body.error, 'wrong_link');
  const early = await hire({ cand: { accepted_on: null }, fl: { status: 'offered', ...withProposal } });
  assert.equal((await early.post({ t: early.offer, a: 'yes' })).body.error, 'not_accepted');
});

test('w275 No records the answer once, tells the manager and HR (onboard_answer), and says whether the hire is asked for their times', async () => {
  const s = await hire({ fl: withProposal });
  const both = await Promise.all([s.post({ t: s.offer, a: 'no' }), s.post({ t: s.offer, a: 'no' })]);
  assert.deepEqual(both.map((r) => r.status), [200, 200], JSON.stringify(both.map((r) => r.body)));
  assert.deepEqual(both.map((r) => r.body.repeated).sort(), [false, true]);
  assert.ok(both.every((r) => r.body.answer === 'no' && r.body.askAvailability === true));
  const f = s.flow();
  assert.deepEqual([f.hire_answer, f.hire_answered_at, f.call_at], ['no', '2026-11-01T12:00:00.000Z', null]);
  assert.equal(s.tells.length, 1);
  assert.equal(s.tells[0].event, 'onboard_answer');
  assert.deepEqual(s.tells[0].to.slice().sort(), ['ruth.owen@welfareavenue.com', 'sam.lee@welfareavenue.com']);
  assert.equal(s.tells[0].title, 'Alex Tremblay said no to the times');
  assert.ok(!/—|\bAI\b/.test(JSON.stringify(s.tells[0])));
  assert.equal(s.relays.length, 0);
  assert.ok(s.db.rows('change_log').some((l) => l.entity_type === 'onboard_flow' && l.field === 'hire_answer' && l.new_value === 'no'));
  const quiet = await hire({ fl: { ...withProposal, ask_availability: false } });
  const q = await quiet.post({ t: quiet.offer, a: 'no' });
  assert.equal(q.body.askAvailability, false, 'already communicated: the page shows the closing view, no grid');
  assert.match(quiet.tells[0].body, /in touch/);
  const practice = await hire({ cand: { practice: true }, fl: { ...withProposal, practice: true } });
  assert.equal((await practice.post({ t: practice.offer, a: 'no' })).body.answer, 'no');
  assert.equal(practice.rig.fetchLog.length, 0, 'practice tells nobody');
  const none = await hire();
  assert.equal((await none.post({ t: none.offer, a: 'no' })).body.error, 'no_proposal');
});

test('w275 a second No (after new times) is refused as answered: a person will be in touch, and the manager is told once', async () => {
  const s = await hire({ fl: { ...withProposal, hire_answered_at: '2026-10-31T15:00:00Z' } });
  const r = await s.post({ t: s.offer, a: 'no' });
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'answered');
  assert.ok(hasBoth(r.body.message));
  assert.match(r.body.message.en, /will be in touch/);
  assert.equal(s.flow().hire_answer, null, 'nothing recorded as a no');
  assert.equal(s.tells.length, 1);
  assert.ok(s.tells[0].to.includes('sam.lee@welfareavenue.com'));
  assert.match(s.tells[0].title, /again/);
  await s.post({ t: s.offer, a: 'no' });
  assert.equal(s.tells.length, 1, 'told once');
  assert.ok(s.flow().setup_ticks.no_again_at, 'the card can show it');
});

test('w275 after a No the hire\'s grid keeps the 10-hour minimum', async () => {
  const s = await hire({ fl: { ...withProposal, hire_answer: 'no', hire_answered_at: '2026-11-01T11:00:00Z' }, config: { onboard_grid_min_hours: '10' } });
  const g = (await s.get(s.offer)).body;
  assert.equal(g.answer, 'no');
  assert.equal(g.grid.minHours, 10);
  const r19 = await s.post({ t: s.offer, a: 'grid', slots: g.grid.slots.slice(0, 19) });
  assert.equal(r19.status, 400);
  assert.equal(r19.body.error, 'too_few_slots');
  const r20 = await s.post({ t: s.offer, a: 'grid', slots: g.grid.slots.slice(0, 20) });
  assert.equal(r20.status, 200, JSON.stringify(r20.body));
  assert.equal(r20.body.saved, 20);
});

test('w275 whole-branch I3: GET (offer link, propose path) gives managerFree, the grid cells where the manager is free (their week and one-off dates, minus hub@ meetings they are invited to), with no meeting title or detail', async () => {
  const events = [
    { id: 'e1', summary: 'Board meeting', attendee_emails: ['sam.lee@welfareavenue.com'], status: 'confirmed', start_at: '2026-11-03T15:00:00Z', end_at: '2026-11-03T16:00:00Z' },
    { id: 'e2', summary: 'Called off', attendee_emails: ['sam.lee@welfareavenue.com'], status: 'cancelled', start_at: '2026-11-03T17:00:00Z', end_at: '2026-11-03T18:00:00Z' },
    { id: 'e3', summary: 'Not Sam', attendee_emails: ['ruth.owen@welfareavenue.com'], status: 'confirmed', start_at: '2026-11-03T18:00:00Z', end_at: '2026-11-03T19:00:00Z' },
  ];
  const except = [{ date: '2026-11-04', free: [] }, { date: '2026-11-07', free: [['18:00', '20:00']] }];   // not free Wednesday; free one Saturday evening
  const said = { ...withProposal, hire_answer: 'no', hire_answered_at: '2026-11-01T11:00:00Z' };
  const s = await hire({ fl: said, config: { onboard_grid_min_hours: '10' }, tables: { team_members: [team[0], SAM({ availability: { except, tz: 'America/Toronto' }, availability_at: '2026-10-20T12:00:00Z' })], hub_events: events } });
  const before = s.snapshot();
  const g = (await s.get(s.offer)).body;
  assert.deepEqual(s.snapshot(), before, 'scanner safety');
  assert.equal(s.rig.fetchLog.length, 0);
  assert.ok(Array.isArray(g.managerFree), JSON.stringify(g.managerFree));
  const free = new Set(g.managerFree), slots = new Set(g.grid.slots);
  assert.ok(g.managerFree.every((x) => slots.has(x)), 'cells of the grid only');
  for (const [at, want, why] of [
    ['2026-11-02T15:00:00Z', true, 'Monday 10 am, inside 9 to 5 (no week saved on Home: the default)'],
    ['2026-11-02T21:30:00Z', true, 'Monday 4:30 pm, the last cell before 5'],
    ['2026-11-02T22:00:00Z', false, 'Monday 5 pm'],
    ['2026-11-02T13:00:00Z', false, 'Monday 8 am'],
    ['2026-11-03T15:00:00Z', false, 'Tuesday 10 am, a hub@ meeting Sam is invited to'],
    ['2026-11-03T15:30:00Z', false, 'Tuesday 10:30 am, the same meeting'],
    ['2026-11-03T16:00:00Z', true, 'Tuesday 11 am, after it'],
    ['2026-11-03T17:00:00Z', true, 'a cancelled meeting does not count'],
    ['2026-11-03T18:00:00Z', true, 'a meeting Sam is not invited to does not count'],
    ['2026-11-04T15:00:00Z', false, 'Wednesday: a one-off date with no free time'],
    ['2026-11-07T15:00:00Z', false, 'Saturday morning'],
    ['2026-11-07T23:00:00Z', true, 'Saturday 6 pm: a one-off date with free time'],
  ]) {
    assert.ok(slots.has(at), at + ' is a cell');
    assert.equal(free.has(at), want, at + ': ' + why);
  }
  assert.doesNotMatch(JSON.stringify(g), /Board meeting|Called off|Not Sam/, 'nothing about the meetings leaves over the no-login link');
  assert.equal(g.busy, undefined);
  assert.equal(g.grid.minHours, 10, 'the 10-hour minimum stays');
  /* the read fails: the grid shows without greys, and the page says nothing */
  const down = await hire({ fl: said });
  down.db.onRpc('wa275_availability_of', () => { throw new Error('rig: availability is down'); });
  const d = await down.get(down.offer);
  assert.equal(d.status, 200, JSON.stringify(d.body));
  assert.equal(d.body.managerFree, null);
  assert.ok(d.body.grid.slots.length > 0);
  assert.doesNotMatch(JSON.stringify(d.body), /availability is down/);
  const ev = await hire({ fl: said });
  ev.db.failOn('hub_events', 'select', 'events are locked');
  assert.equal((await ev.get(ev.offer)).body.managerFree, null, 'nor when the meetings cannot be read');
  /* a wave271 offer link (grid mode) and the manager's own link have none */
  const old = await setup({ cand: { accepted_on: '2026-10-20' }, flows: [flow()], config: V2CFG });
  const o = (await old.get(old.offer)).body;
  assert.equal(o.mode, 'grid');
  assert.equal(o.managerFree, undefined);
  assert.equal((await s.get(s.mgr)).body.managerFree, undefined);
});

test('w275 whole-branch round 2: a manager free for less than the hire\'s minimum over the window gives no mask, so the hire can always reach it; free for that much or more, the mask', async () => {
  const said = { ...withProposal, hire_answer: 'no', hire_answered_at: '2026-11-01T11:00:00Z' };
  const weekOf = (weekly) => ({ team_members: [team[0], SAM()], hub_team_avail: weekRows('sam.lee@welfareavenue.com', weekly, { at: '2026-10-25T12:00:00Z' }) });
  /* the window is 1 to 14 November: two Tuesdays. 9 to 12 on Tuesdays is 6 hours, under the 10 the hire must mark */
  const sparse = await hire({ fl: said, config: { onboard_grid_min_hours: '10' }, tables: weekOf({ tue: [['09:00', '12:00']] }) });
  const g = (await sparse.get(sparse.offer)).body;
  assert.equal(g.grid.minHours, 10);
  assert.equal(g.managerFree, null, 'no greys: the grid shows as before');
  const r = await sparse.post({ t: sparse.offer, a: 'grid', slots: g.grid.slots.slice(0, 20) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.saved, 20, 'the hire reaches the minimum');
  /* exactly the minimum (9 to 2 on two Tuesdays, 10 hours) and more: the mask */
  for (const [blk, n] of [[['09:00', '14:00'], 20], [['09:00', '15:00'], 24]]) {
    const s = await hire({ fl: said, config: { onboard_grid_min_hours: '10' }, tables: weekOf({ tue: [blk] }) });
    const b = (await s.get(s.offer)).body;
    assert.ok(Array.isArray(b.managerFree), JSON.stringify(blk));
    assert.equal(b.managerFree.length, n, JSON.stringify(blk) + ': half-hour cells on the two Tuesdays');
  }
  /* the minimum is the setting the server enforces (too_few_slots), not a fixed 10 */
  const six = await hire({ fl: said, config: { onboard_grid_min_hours: '6' }, tables: weekOf({ tue: [['09:00', '12:00']] }) });
  assert.equal((await six.get(six.offer)).body.managerFree.length, 12, 'a 6-hour minimum: 6 free hours are enough for the mask');
});

test('w275 whole-branch: the manager and HR told of a No get a link to the Hub\'s Home (a manager who is a plain member cannot open HR Center)', async () => {
  const s = await hire({ fl: withProposal });
  await s.post({ t: s.offer, a: 'no' });
  assert.equal(s.tells.length, 1);
  assert.equal(s.tells[0].url, '#mypage');
  assert.match(s.tells[0].text, /<https:\/\/hub\.welfareavenue\.com\/#mypage\|Open the Hub>$/);
  assert.doesNotMatch(JSON.stringify(s.tells[0]), /hrcentre/);
});

test('w275 setup_tick saves a rundown tick under its own key, is idempotent, can be undone, and refuses unknown keys and other links', async () => {
  const s = await hire({ fl: { setup_ticks: { hire_times_at: '2026-10-31T12:00:00Z' } } });
  const r = await s.post({ t: s.offer, a: 'setup_tick', key: 'profile', done: true });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.equal(r.body.ticks.profile, true);
  assert.equal(Object.values(r.body.ticks).filter(Boolean).length, 1);
  assert.equal(s.flow().setup_ticks.rd_profile, '2026-11-01T12:00:00.000Z');
  assert.equal(s.flow().setup_ticks.hire_times_at, '2026-10-31T12:00:00Z', 'merged, never rewritten');
  s.rig.setNow('2026-11-01T13:00:00Z');
  const again = await s.post({ t: s.offer, a: 'setup_tick', key: 'profile', done: true });
  assert.equal(again.body.ticks.profile, true);
  assert.equal(s.flow().setup_ticks.rd_profile, '2026-11-01T12:00:00.000Z', 'a second tick keeps the first time');
  const off = await s.post({ t: s.offer, a: 'setup_tick', key: 'profile', done: false });
  assert.equal(off.body.ticks.profile, false);
  assert.equal(s.flow().setup_ticks.rd_profile, null);
  for (const body of [{ key: 'nope', done: true }, { key: 'profile', done: 'yes' }, { key: 'hire_times_at', done: true }, { done: true }]) {
    const b = await s.post({ t: s.offer, a: 'setup_tick', ...body });
    assert.equal(b.status, 400, JSON.stringify(body));
    assert.ok(hasBoth(b.body.message));
  }
  assert.equal((await s.post({ t: s.mgr, a: 'setup_tick', key: 'profile', done: true })).body.error, 'wrong_link');
  const before = await hire({ cand: { accepted_on: null }, fl: { status: 'offered' } });
  assert.equal((await before.post({ t: before.offer, a: 'setup_tick', key: 'profile', done: true })).body.error, 'not_accepted');
  const gone = await hire({ fl: { status: 'backed_out' } });
  assert.equal((await gone.post({ t: gone.offer, a: 'setup_tick', key: 'profile', done: true })).body.closed, true);
  assert.equal(s.rig.fetchLog.length, 0);
});

test('w275 integration (practice): Accept with hours runs accept_setup, Yes runs book, on one database; onboard-run fetches nothing', async () => {
  await withBackground(async (pending) => {
    let run;
    const s = await hire({ cand: { accepted_on: null, practice: true }, fl: { status: 'offered', practice: true, ...withProposal }, run: (e) => run.call(new Request(RUN, { method: 'POST', headers: e.headers, body: JSON.stringify(e.body) })) });
    run = await loadFn('onboard-run', {});
    run.db.tables = s.db.tables;
    run.db.onRpc('wa275_tick_set', tickSet);
    run.db.onRpc('wa275_availability_of', availabilityOf);
    run.setNow(NOW);
    const a = await s.post({ t: s.offer, a: 'accept', hours_ok: true });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    await Promise.all(pending);
    const steps = () => Object.fromEntries(s.db.rows('hub_onboard_steps').map((r) => [r.step, r.status]));
    assert.deepEqual(steps(), { roster: 'done', google: 'done', hub: 'done', groups: 'done', drives: 'done' });   // wave278: groups and drives at Accept too
    const y = await s.post({ t: s.offer, a: 'yes' });
    assert.equal(y.status, 200, JSON.stringify(y.body));
    assert.equal(y.body.answer, 'yes');
    await Promise.all(pending);   // fix round 1: book runs its steps after its answer
    const f = s.flow();
    assert.deepEqual([f.call_at, f.hire_answer, f.status], [W_CALL, 'yes', 'started']);
    assert.equal(Object.values(steps()).filter((x) => x === 'done').length, 12, 'wave278: the four access steps simulate too');
    assert.equal(run.fetchLog.length, 0);
    assert.deepEqual(s.rig.fetchLog.map((e) => e.body.action), ['accept_setup', 'book'], 'the two relays, and nothing else');
    const g = (await s.get(s.offer)).body;
    assert.equal(g.closed, false);
    assert.equal(g.answer, 'yes');
  });
});

/* ---------- wave275 Task 3, fix round 1 ---------- */
test('w275 fix: a Yes on times that went stale does not use up the hire\'s one No: new times, then No, is a first no, told once and not "again"', async () => {
  const meeting = { id: 'e9', summary: 'Board', attendee_emails: ['sam.lee@welfareavenue.com'], status: 'confirmed', start_at: '2026-11-04T16:45:00Z', end_at: '2026-11-04T17:15:00Z' };
  let run;
  const s = await hire({ fl: withProposal, config: { onboard_propose_lead_hours: '48', onboard_yes_lead_hours: '24', onboard_call_min: '60', onboard_one_on_one_min: '30', mail_mode: 'live' }, tables: { hub_events: [meeting] },
    run: (e) => run.call(new Request(RUN, { method: 'POST', headers: e.headers, body: JSON.stringify(e.body) })) });
  const { generateKeyPairSync } = await import('node:crypto');
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  run = await loadFn('onboard-run', { secrets: { GOOGLE_SA_KEY: JSON.stringify({ client_email: 'hub@stub.iam', private_key: privateKey, token_uri: 'https://oauth2.googleapis.com/token' }) } });
  run.db.tables = s.db.tables;
  run.db.onRpc('wa275_tick_set', tickSet);
  run.db.onRpc('wa275_availability_of', availabilityOf);
  run.setNow(NOW);
  const runTells = [];
  run.fetchOn(NOTIFY, (e) => { runTells.push(e.body); return { json: { outcome: Object.fromEntries([].concat(e.body.to || e.body.to_email).map((x) => [x, 'sent'])), hub: 'off' } }; });
  run.fetchOn('https://oauth2.googleapis.com/token', { json: { access_token: 'tok', expires_in: 3600 } });
  run.fetchOn('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { json: { id: 'mail1' } });
  const yes = await s.post({ t: s.offer, a: 'yes' });
  assert.equal(yes.status, 409, JSON.stringify(yes.body));
  assert.equal(yes.body.stale, true);
  assert.deepEqual([s.flow().hire_answer, s.flow().hire_answered_at ?? null], ['no', null], 'the proposal is spent; the hire has not said no');
  assert.equal(runTells.filter((x) => /no longer work/.test(x.title)).length, 1, 'the manager and HR heard the times went stale');
  s.db.tables.hub_events = [];   // the manager's calendar clears, and they propose again (Thursday 05/11, 10:00 and 11:30)
  const p = await s.post({ t: s.mgr, a: 'propose', call_at: '2026-11-05T15:00:00Z', one_on_one_at: '2026-11-05T16:30:00Z' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(s.flow().hire_answer, null);
  const no = await s.post({ t: s.offer, a: 'no' });
  assert.equal(no.status, 200, JSON.stringify(no.body));
  assert.deepEqual([no.body.answer, no.body.repeated], ['no', false]);
  assert.deepEqual([s.flow().hire_answer, s.flow().hire_answered_at], ['no', '2026-11-01T12:00:00.000Z']);
  assert.equal(s.tells.length, 1, 'told once');
  assert.equal(s.tells[0].title, 'Alex Tremblay said no to the times', 'a first no, not "again"');
  assert.ok(!s.flow().setup_ticks?.no_again_at);
  assert.deepEqual(s.rig.unregistered(), []);
  assert.deepEqual(run.unregistered(), []);
});

test('w275 fix: GET after a second No gives secondNo (a person will be in touch, both languages) instead of the times to answer again; new times clear it', async () => {
  const s = await hire({ fl: { ...withProposal, hire_answered_at: '2026-10-31T15:00:00Z' } });
  assert.equal((await s.get(s.offer)).body.secondNo, null);
  assert.equal((await s.post({ t: s.offer, a: 'no' })).body.error, 'answered');
  const before = s.snapshot();
  const g = (await s.get(s.offer)).body;
  assert.deepEqual(s.snapshot(), before, 'scanner safety');
  assert.ok(hasBoth(g.secondNo));
  assert.match(g.secondNo.en, /A person from Welfare Avenue will be in touch/);
  assert.deepEqual([g.answer, g.bookedTimes], [null, null]);
  s.flow().setup_ticks.no_again_at = null;   // what propose does with new times
  assert.equal((await s.get(s.offer)).body.secondNo, null);
  const booked = await hire({ fl: { ...withProposal, hire_answer: 'yes', call_at: W_CALL, one_on_one_at: W_ONE, setup_ticks: { no_again_at: '2026-10-31T16:00:00Z' } } });
  assert.equal((await booked.get(booked.offer)).body.secondNo, null, 'once booked, the closing page wins');
});

test('w275 Task 6 fix: POST availability whose read-back fails still answers ok: the dates are saved, with a warning in both languages', async () => {
  const s = await setup({ flows: [offered()], tables: { team_members: [team[0], SAM()] } });
  s.db.onRpc('wa275_availability_of', () => { throw new Error('read locked'); });
  const r = await s.post({ t: s.mgr, a: 'availability', availability: { except: [{ date: '2026-11-11', free: [] }] } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.saved, { except: [{ date: '2026-11-11', free: [] }], tz: 'America/Toronto' });
  assert.ok(hasBoth(r.body.warning) && /Your dates are saved/.test(r.body.warning.en));
  assert.deepEqual(s.db.rows('team_members').find((m) => m.id === 2).availability, { except: [{ date: '2026-11-11', free: [] }], tz: 'America/Toronto' });
});

/* ---------- wave275b (03/11/26, Steel: "Can we make the availability check for onboarding optional"): onboard_require_hours and onboard_manager_hours,
   off by default (absent, or anything but "on", is off). The hire() rig sets both on, so the tests above are the "on" behaviour, which is today's. ---------- */
const dropSetting = (s, key) => { const rows = s.db.rows('app_config'); const i = rows.findIndex((r) => r.key === key); if (i >= 0) rows.splice(i, 1); };

test('w275b onboard_require_hours off, absent or not "on": Accept needs no box; ticked, hours_confirmed_at is set; not ticked, it stays empty; GET says hoursRequired false', async () => {
  await withBackground(async (pending) => {
    for (const value of ['off', 'yes', null]) {
      const s = await hire({ cand: { accepted_on: null }, fl: { status: 'offered' }, config: { onboard_require_hours: value ?? 'on' } });
      if (value === null) dropSetting(s, 'onboard_require_hours');
      const g = (await s.get(s.offer)).body;
      assert.deepEqual([g.offerHours, g.hoursRequired], [6, false], String(value));
      const r = await s.post({ t: s.offer, a: 'accept' });
      assert.equal(r.status, 200, String(value) + ': ' + JSON.stringify(r.body));
      assert.deepEqual([r.body.answer, r.body.repeated], ['accept', false]);
      const c = s.cand();
      assert.equal(c.accepted_on, '2026-11-01');
      assert.equal(c.hours_confirmed_at ?? null, null, 'the box was not ticked: nothing confirmed');
      assert.doesNotMatch(c.notes, /confirming/, 'the note does not say they confirmed the hours');
    }
    const ticked = await hire({ cand: { accepted_on: null }, fl: { status: 'offered' }, config: { onboard_require_hours: 'off' } });
    const t = await ticked.post({ t: ticked.offer, a: 'accept', hours_ok: true });
    assert.equal(t.status, 200, JSON.stringify(t.body));
    assert.equal(ticked.cand().hours_confirmed_at, '2026-11-01T12:00:00.000Z', 'ticked: confirmed');
    assert.match(ticked.cand().notes, /confirming at least 6 hours a week/);
    assert.equal((await ticked.get(ticked.offer)).body.hoursConfirmed, true);
    const loose = await hire({ cand: { accepted_on: null }, fl: { status: 'offered' }, config: { onboard_require_hours: 'off' } });
    assert.equal((await loose.post({ t: loose.offer, a: 'accept', hours_ok: 'yes' })).status, 200);
    assert.equal(loose.cand().hours_confirmed_at ?? null, null, 'only hours_ok: true confirms');
    await Promise.all(pending);
  });
});

test('w275b onboard_require_hours on (any case): today\'s rule, 400 hours_required without the box; GET says hoursRequired true; an offer with no hours never needs it', async () => {
  for (const value of ['on', ' On ']) {
    const s = await hire({ cand: { accepted_on: null }, fl: { status: 'offered' }, config: { onboard_require_hours: value } });
    assert.equal((await s.get(s.offer)).body.hoursRequired, true);
    const before = s.snapshot();
    const no = await s.post({ t: s.offer, a: 'accept' });
    assert.deepEqual([no.status, no.body.error], [400, 'hours_required']);
    assert.ok(hasBoth(no.body.message));
    assert.deepEqual(s.snapshot(), before);
  }
  const old = await setup({ flows: [], config: { onboard_require_hours: 'on' } });
  const g = (await old.get(old.offer)).body;
  assert.deepEqual([g.offerHours, g.hoursRequired], [null, false], 'no hours on the offer: nothing to require');
});

test('w275b onboard_manager_hours: the mgr page GET says managerHours (on true; off, absent or anything else false) and still sends the week for information', async () => {
  for (const [value, want] of [['on', true], [' ON ', true], ['off', false], ['maybe', false], [null, false]]) {
    const s = await setup({ flows: [offered()], config: { onboard_manager_hours: value ?? 'on' }, tables: { team_members: [team[0], SAM()] } });
    if (value === null) dropSetting(s, 'onboard_manager_hours');
    const g = (await s.get(s.mgr)).body;
    assert.equal(g.mode, 'propose');
    assert.equal(g.managerHours, want, String(value));
    assert.deepEqual(g.availability.weekly.mon, [['09:00', '17:00']], 'the week, for information');
    assert.equal(g.noWeek, true);
  }
});

test('w275b onboard_manager_hours off: the hire\'s No grid greys only the hub@ meetings the manager is invited to (not their week, not their one-off dates); the minimum still decides whether there is a mask', async () => {
  const events = [
    { id: 'e1', summary: 'Board meeting', attendee_emails: ['sam.lee@welfareavenue.com'], status: 'confirmed', start_at: '2026-11-03T15:00:00Z', end_at: '2026-11-03T16:00:00Z' },
    { id: 'e2', summary: 'Called off', attendee_emails: ['sam.lee@welfareavenue.com'], status: 'cancelled', start_at: '2026-11-03T17:00:00Z', end_at: '2026-11-03T18:00:00Z' },
  ];
  const except = [{ date: '2026-11-04', free: [] }];
  const said = { ...withProposal, hire_answer: 'no', hire_answered_at: '2026-11-01T11:00:00Z' };
  const s = await hire({ fl: said, config: { onboard_grid_min_hours: '10', onboard_manager_hours: 'off' }, tables: { team_members: [team[0], SAM({ availability: { except, tz: 'America/Toronto' }, availability_at: '2026-10-20T12:00:00Z' })], hub_events: events } });
  const g = (await s.get(s.offer)).body;
  assert.ok(Array.isArray(g.managerFree), JSON.stringify(g.managerFree));
  assert.equal(g.managerHours, false, 'the page words its legend from it: the greys are hub@ meetings');
  const free = new Set(g.managerFree);
  for (const [at, want, why] of [
    ['2026-11-02T15:00:00Z', true, 'Monday 10 am'],
    ['2026-11-02T13:00:00Z', true, 'Monday 8 am, before 9: the week is not a rule'],
    ['2026-11-02T22:00:00Z', true, 'Monday 5 pm, after 5'],
    ['2026-11-07T15:00:00Z', true, 'Saturday morning'],
    ['2026-11-04T15:00:00Z', true, 'Wednesday, a one-off date with no free time: dates are not a rule either'],
    ['2026-11-03T15:00:00Z', false, 'Tuesday 10 am, a hub@ meeting Sam is invited to'],
    ['2026-11-03T15:30:00Z', false, 'the same meeting'],
    ['2026-11-03T17:00:00Z', true, 'a cancelled meeting does not count'],
  ]) assert.equal(free.has(at), want, at + ': ' + why);
  assert.equal(g.managerFree.length, g.grid.slots.length - 2, 'every cell but the meeting\'s two');
  assert.doesNotMatch(JSON.stringify(g), /Board meeting|Called off/, 'nothing about the meetings leaves over the no-login link');
  const reads = [];
  s.db.onRpc('wa275_availability_of', (a) => { reads.push(a); throw new Error('not a rule now'); });
  assert.ok(Array.isArray((await s.get(s.offer)).body.managerFree), 'off, the hours are not read, so a failed read changes nothing');
  assert.equal(reads.length, 0);
  /* with no meetings at all, nothing is greyed: no mask, the grid shows as it always did */
  const none = await hire({ fl: said, config: { onboard_grid_min_hours: '10', onboard_manager_hours: 'off' } });
  const n = (await none.get(none.offer)).body;
  assert.ok(n.managerFree === null || n.managerFree.length === n.grid.slots.length, 'nothing greyed');
  /* on: the week greys again (today's rule) */
  const on = await hire({ fl: said, config: { onboard_grid_min_hours: '10', onboard_manager_hours: 'on' }, tables: { team_members: [team[0], SAM()], hub_events: events } });
  const og = (await on.get(on.offer)).body;
  assert.equal(new Set(og.managerFree).has('2026-11-02T13:00:00Z'), false, 'on: Monday 8 am is greyed');
  assert.equal(og.managerHours, true);
});
