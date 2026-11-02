// wave271 Task 2: fn/onboard-link, proved offline on the in-memory rig (test/w271rig.mjs). Run: node --test test/w271link.test.mjs
// No live call of any kind: the database is a stub and every fetch is recorded, never sent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { loadFn } from './w271rig.mjs';

const URL_ = 'https://stub.supabase.test/functions/v1/onboard-link';
const NOTIFY = 'https://stub.supabase.test/functions/v1/notify';
const NOW = '2026-11-01T15:00:00Z';   // 10:00 in Toronto on 01/11/26, the day the clocks go back

const candidate = (over = {}) => ({
  id: 11, name: 'Alex Tremblay', role: 'Program Coordinator', status: 'offer', owner: 'Ruth Owen', email: 'alex@example.com',
  summary: '', notes: '', accepted_on: null, offer_respond_by: '2026-11-10', close_reason: null, practice: false, ...over,
});
const flow = (over = {}) => ({ id: 11, candidate_id: 11, practice: false, status: 'waiting', manager_member_id: 2, call_at: null, one_on_one_at: null, ...over });
const team = [{ id: 1, name: 'Ruth Owen', email: 'Ruth.Owen@welfareavenue.com' }, { id: 2, name: 'Sam Lee', email: 'sam.lee@welfareavenue.com' }];

// Without triggers the rig does not make the flow; this stands in for wa271_cand_accepted
function standInForTrigger(rig) {
  rig.db.on('hub_candidates', 'update', (n, o, db) => {
    if (o.accepted_on == null && n.accepted_on != null) db.insert('hub_onboard_flows', { candidate_id: n.id, practice: !!n.practice, status: 'waiting', manager_member_id: null, call_at: null, one_on_one_at: null });
  });
}
async function setup({ cand = {}, flows = [], config = {}, now = NOW, notify = true } = {}) {
  const rig = await loadFn('onboard-link', { config, tables: { hub_candidates: [candidate(cand)], hub_onboard_flows: flows, hub_onboard_grids: [], team_members: team, change_log: [] } });
  standInForTrigger(rig);
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
  assert.deepEqual({ ...a.body, grid: undefined }, { ok: true, kind: 'offer', first: 'Alex', role: 'Program Coordinator', lang: 'en', answered: '', closed: false, late: false, booked: false, grid: undefined, slotsSaved: [] });
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

test('Decline closes the card, logs it and tells the owner through notify', async () => {
  const s = await setup();
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
  const down = await setup({ notify: false });
  down.rig.fetchOn(NOTIFY, { status: 500, text: 'down' });
  assert.equal((await down.post({ t: down.offer, a: 'decline' })).body.answer, 'decline');
  assert.equal(down.cand().status, 'declined');

  const unreachable = await setup({ notify: false });   // nothing registered: the recorder throws
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
  for (const a of ['', 'yes', undefined]) {
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

  const eve = await setup({ cand: { accepted_on: '2026-11-01' }, flows: [flow()], now: '2026-10-31T15:00:00Z' });   // 31/10/26
  const w0 = (await eve.get(eve.offer)).body.grid;
  assert.equal(w0.days[0].date, '2026-10-31');
  assert.equal(w0.days[0].close, '2026-11-01T01:00:00Z', '21:00 on 31/10/26 in Toronto');
  assert.equal(w0.days[1].open, '2026-11-01T13:00:00Z', 'the day after the change still opens at 8:00 local');

  // today is the Toronto date even when it is already tomorrow in UTC
  const late = await setup({ cand: { accepted_on: '2026-11-01' }, flows: [flow()], now: '2026-11-02T03:30:00Z' });
  assert.equal((await late.get(late.offer)).body.grid.days[0].date, '2026-11-01');

  // a window across the spring change (14/03/27): every slot of every day is a local 8:00 to 20:30
  const spring = await setup({ cand: { accepted_on: '2027-03-01' }, flows: [flow()], now: '2027-03-10T15:00:00Z' });
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
    'yesterday': [t(slots[0], -24 * 3600000)],
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
  assert.deepEqual(first.body, { ok: true, saved: 2, slotsSaved: [slots[2], slots[4]], closed: false });
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
