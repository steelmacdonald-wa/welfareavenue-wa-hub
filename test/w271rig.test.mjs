// wave271: the rig's query stub, proved on its own because Tasks 3 to 13 build on it. Run: node --test test/w271rig.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFn } from './w271rig.mjs';

const rows = () => [
  { id: 1, name: 'Ann', email: 'ann@x.org', status: 'new', n: 5, at: '2026-11-01T10:00:00Z', tag: null },
  { id: 2, name: 'Bob', email: 'BOB@x.org', status: 'offer', n: 7, at: '2026-11-02T10:00:00Z', tag: 'a' },
  { id: 3, name: 'Cy', email: 'cy@y.org', status: 'offer', n: 9, at: '2026-11-03T10:00:00Z', tag: 'b' },
];
async function db() {
  const rig = await loadFn('onboard-link', { tables: { people: rows() }, config: { k1: 'v1' }, secrets: { WA_TRIGGER_SECRET: 's3' } });
  return { rig, c: rig.client(), people: () => rig.db.rows('people') };
}

test('reads: select, filters, order, limit, single and maybeSingle', async () => {
  const { c } = await db();
  const names = async (q) => (await q).data.map((r) => r.name);
  assert.deepEqual(await names(c.from('people').select('*')), ['Ann', 'Bob', 'Cy']);
  assert.deepEqual(await names(c.from('people').select('name').eq('status', 'offer')), ['Bob', 'Cy']);
  assert.deepEqual(await names(c.from('people').select('*').eq('id', '2')), ['Bob'], 'a string id matches a number');
  assert.deepEqual(await names(c.from('people').select('*').neq('status', 'offer')), ['Ann']);
  assert.deepEqual(await names(c.from('people').select('*').in('id', [1, 3])), ['Ann', 'Cy']);
  assert.deepEqual(await names(c.from('people').select('*').is('tag', null)), ['Ann']);
  assert.deepEqual(await names(c.from('people').select('*').not('tag', 'is', null)), ['Bob', 'Cy']);
  assert.deepEqual(await names(c.from('people').select('*').not('status', 'in', '(offer,hired)')), ['Ann']);
  assert.deepEqual(await names(c.from('people').select('*').ilike('email', 'bob@%')), ['Bob']);
  assert.deepEqual(await names(c.from('people').select('*').gte('n', 7).lte('n', 9)), ['Bob', 'Cy']);
  assert.deepEqual(await names(c.from('people').select('*').gte('at', '2026-11-02T00:00:00Z')), ['Bob', 'Cy']);
  assert.deepEqual(await names(c.from('people').select('*').or('name.eq.Ann,tag.eq.b')), ['Ann', 'Cy']);
  assert.deepEqual(await names(c.from('people').select('*').or('id.in.(1,2),n.gte.9')), ['Ann', 'Bob', 'Cy']);
  assert.deepEqual(await names(c.from('people').select('*').order('n', { ascending: false }).limit(2)), ['Cy', 'Bob']);
  assert.deepEqual((await c.from('people').select('name, n').eq('id', 1).single()).data, { name: 'Ann', n: 5 });
  assert.equal((await c.from('people').select('*').eq('id', 99).maybeSingle()).data, null);
  assert.equal((await c.from('people').select('*').eq('id', 99).single()).error.code, 'PGRST116');
  assert.equal((await c.from('people').select('*').maybeSingle()).error.code, 'PGRST116', 'two rows is an error');
  await assert.rejects(async () => c.from('people').select('*, other(x)'), /embedded/);
});

test('writes: insert, update, upsert and delete return the rows they changed only when asked', async () => {
  const { c, people } = await db();
  assert.equal((await c.from('people').insert({ name: 'Di' })).data, null);
  assert.equal(people().at(-1).id, undefined, 'a table that is not serial keeps what it is given');
  const claimed = await c.from('people').update({ status: 'hired' }).eq('id', 2).eq('status', 'offer').select('id, status');
  assert.deepEqual(claimed.data, [{ id: 2, status: 'hired' }]);
  const lost = await c.from('people').update({ status: 'hired' }).eq('id', 2).eq('status', 'offer').select('id');
  assert.deepEqual(lost.data, [], 'a claim that finds nothing returns no rows');
  assert.equal((await c.from('people').update({ n: 1 }).eq('id', 1)).data, null);
  assert.equal(people()[0].n, 1);
  await c.from('people').upsert({ id: 3, name: 'Cyd' });
  await c.from('people').upsert({ id: 4, name: 'Eve' }, { onConflict: 'id' });
  assert.deepEqual(people().map((r) => r.name), ['Ann', 'Bob', 'Cyd', 'Di', 'Eve']);
  const gone = await c.from('people').delete().eq('name', 'Di').select();
  assert.equal(gone.data.length, 1);
  assert.equal(people().length, 4);
  const kept = await c.from('people').select('*').eq('id', 1).single();
  kept.data.name = 'changed outside';
  assert.equal(people()[0].name, 'Ann', 'what you read is a copy');
});

test('serial ids, composite upsert keys, trigger stand-ins, forced failures, rpc, secrets and the caller', async () => {
  const { rig, c } = await db();
  const log = [];
  rig.db.on('change_log', 'insert', (n) => log.push(n.id));
  await c.from('change_log').insert([{ field: 'a' }, { field: 'b' }]);
  assert.deepEqual(rig.db.rows('change_log').map((r) => r.id), [1, 2]);
  assert.deepEqual(log, [1, 2]);
  await c.from('grids').upsert({ flow_id: 1, who: 'hire', slots: ['x'] }, { onConflict: 'flow_id,who' });
  await c.from('grids').upsert({ flow_id: 1, who: 'hire', slots: ['y'] }, { onConflict: 'flow_id,who' });
  await c.from('grids').upsert({ flow_id: 1, who: 'manager', slots: [] }, { onConflict: 'flow_id,who' });
  assert.deepEqual(rig.db.rows('grids').map((r) => r.who + ':' + r.slots.join()), ['hire:y', 'manager:']);
  const seen = [];
  rig.db.on('people', 'update', (n, o) => seen.push([o.status, n.status]));
  await c.from('people').update({ status: 'hired' }).eq('id', 1);
  assert.deepEqual(seen, [['new', 'hired']]);
  rig.db.failOn('people', 'update', 'disk full');
  assert.equal((await c.from('people').update({ n: 0 }).eq('id', 1)).error.message, 'disk full');
  assert.equal((await c.from('people').update({ n: 0 }).eq('id', 1)).error, null, 'one shot');
  assert.equal((await c.rpc('nothing')).error.message, 'rig: rpc nothing is not registered');
  rig.db.onRpc('double', ({ x }) => x * 2);
  assert.equal((await c.rpc('double', { x: 4 })).data, 8);
  rig.db.onRpc('boom', () => { throw new Error('nope'); });
  assert.equal((await c.rpc('boom')).error.message, 'nope');
  assert.equal((await c.rpc('get_secret', { secret_name: 'WA_TRIGGER_SECRET' })).data, 's3');
  assert.equal((await c.from('app_config').select('value').eq('key', 'k1').single()).data.value, 'v1');
  assert.equal((await c.auth.getUser()).data.user, null);
  rig.db.setCaller({ id: 'u1', email: 'hr@welfareavenue.com' });
  assert.equal((await c.auth.getUser()).data.user.email, 'hr@welfareavenue.com');
});

test('fetch: registered URLs answer and are logged, anything else throws and is flagged; the clock is fixed during a call only', async () => {
  const { rig } = await db();
  rig.fetchOn('https://api.test/a', (e) => ({ json: { got: e.body } }));
  rig.fetchOn(/other\.test/, { status: 202, text: 'ok' });
  const a = await fetch('https://api.test/a', { method: 'POST', headers: { 'X-Thing': '1' }, body: JSON.stringify({ n: 1 }) });
  assert.deepEqual(await a.json(), { got: { n: 1 } });
  assert.equal((await fetch('https://other.test/x')).status, 202);
  await assert.rejects(fetch('https://nope.test/'), /unregistered/);
  assert.deepEqual(rig.fetchLog.map((e) => [e.method, e.url, e.matched]), [['POST', 'https://api.test/a', true], ['GET', 'https://other.test/x', true], ['GET', 'https://nope.test/', false]]);
  assert.equal(rig.fetchLog[0].headers['x-thing'], '1');
  assert.equal(rig.unregistered().length, 1);
  rig.setNow('2030-01-01T00:00:00Z');
  const r = await rig.call(new Request('https://stub.supabase.test/functions/v1/onboard-link?t=bad'));
  assert.equal(r.status, 404);
  assert.ok(Date.now() < Date.parse('2030-01-01T00:00:00Z'), 'the real clock is back after the call');
});
