// wave277, 02/11/26: test for the shared platform registry.
import { assertEquals } from 'jsr:@std/assert';
import { platforms } from './platforms.ts';

function fakeSvc(rows: () => unknown[]) {
  return {
    from(_table: string) {
      return {
        select(_cols: string) {
          return { order: (_col: string) => Promise.resolve({ data: rows(), error: null }) };
        },
      };
    },
  };
}

Deno.test('platforms caches for the ttl and sorts', async () => {
  let calls = 0;
  const svc = fakeSvc(() => { calls++; return [{ key: 'b', sort: 2, active: true }, { key: 'a', sort: 1, active: true }, { key: 'c', sort: 3, active: false }]; });
  const a = await platforms(svc as any, { ttlMs: 1000 }); const b = await platforms(svc as any, { ttlMs: 1000 });
  assertEquals(a.map(p => p.key), ['a', 'b']); assertEquals(calls, 1); assertEquals(b.length, 2);
  const all = await platforms(svc as any, { ttlMs: 0, includeInactive: true }); assertEquals(all.length, 3);
});
