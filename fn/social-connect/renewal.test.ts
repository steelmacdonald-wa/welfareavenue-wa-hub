// wave277 final review: the weekly renewal keeps going past a failure, keeps a renewal when its check fails,
// and warns the publishers once through notify with the headers notify needs.
import { assert, assertEquals } from 'jsr:@std/assert';
import { check, type RenewCtx, warn } from './renewal.ts';
import type { Adapter, Any, Ctx, Platform } from './adapters/types.ts';

const NOW = Date.parse('2026-11-02T12:00:00Z');
const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString();
const P = (key: string, label: string): Platform => ({ key, label, auth: 'oauth', active: true, scopes: [] });

function rig(adapters: Record<string, Adapter>, store: Record<string, Any>) {
  const posts: { url: string; headers: Record<string, string>; body: Any }[] = [];
  const fetch = ((input: string | URL | Request, init?: RequestInit) => {
    posts.push({ url: String(input), headers: (init?.headers || {}) as Record<string, string>, body: JSON.parse(String(init?.body || '{}')) });
    return Promise.resolve(new Response('{"ok":true}', { status: 200 }));
  }) as typeof globalThis.fetch;
  const actx = { now: () => NOW } as unknown as Ctx;
  const rc: RenewCtx = {
    adapters, actx,
    conns: () => Promise.resolve(store),
    setConn: (k, patch) => { store[k] = { ...(store[k] || {}), ...patch }; return Promise.resolve(); },
    publishers: () => Promise.resolve(['ian@welfareavenue.com', 'kk@welfareavenue.com']),
    getSecret: (n) => Promise.resolve(n === 'WA_TRIGGER_SECRET' ? 'trig-secret' : ''),
    fetch, now: () => NOW, supabaseUrl: 'https://x.supabase.co', anonKey: 'anon-key',
  };
  return { rc, posts, store };
}
const noop = { authorizeUrl: () => '', finish: () => Promise.reject(new Error('no')) };

Deno.test('check: a failing adapter marks that record error and the loop carries on to the next platform', async () => {
  const bad: Adapter = { ...noop, health: () => Promise.reject(new Error('fetch failed for https://graph.threads.net/x?access_token=SECRETTOKEN&y=1')) };
  const good: Adapter = { ...noop, health: () => Promise.resolve({ last_checked_at: iso(NOW), last_error: null }) };
  const store: Record<string, Any> = { threads: { status: 'connected' }, linkedin: { status: 'connected' } };
  const { rc } = rig({ threads: bad, linkedin: good }, store);
  const out: string[] = [];
  for (const p of [P('threads', 'Threads'), P('linkedin', 'LinkedIn')]) out.push(await check(rc, p, store[p.key], true, 'refresh'));
  assertEquals(out, ['threads failed', 'linkedin ok']);
  assertEquals(store.threads.health, 'error');
  assert(!String(store.threads.last_error).includes('SECRETTOKEN'));
  assert(String(store.threads.last_error).includes('access_token=redacted'));
  assertEquals(store.linkedin.health, 'ok');
});

Deno.test('check: a successful refresh is saved even when the health call then throws', async () => {
  const exp = iso(NOW + 60 * DAY);
  const a: Adapter = { ...noop, refresh: () => Promise.resolve({ expires_at: exp, refreshed_at: iso(NOW) }), health: () => Promise.reject(new Error('HTTP 500')) };
  const store: Record<string, Any> = { threads: { status: 'connected', expires_at: iso(NOW + 2 * DAY) } };
  const { rc } = rig({ threads: a }, store);
  assertEquals(await check(rc, P('threads', 'Threads'), store.threads, true, 'refresh'), 'threads failed');
  assertEquals(store.threads.expires_at, exp);
  assertEquals(store.threads.refreshed_at, iso(NOW));
  assertEquals(store.threads.health, 'error');
});

Deno.test('warn: an expiring record never warned gets exactly one notify POST with the headers and fields', async () => {
  const store: Record<string, Any> = { linkedin: { status: 'connected', expires_at: iso(NOW + 6 * DAY), warned_at: null } };
  const { rc, posts } = rig({}, store);
  assertEquals(await warn(rc, [P('linkedin', 'LinkedIn')]), ['linkedin warned']);
  assertEquals(posts.length, 1);
  const r = posts[0];
  assertEquals(r.url, 'https://x.supabase.co/functions/v1/notify');
  assertEquals(r.headers['x-wa-secret'], 'trig-secret');
  assertEquals(r.headers.Authorization, 'Bearer anon-key');
  assertEquals(Object.keys(r.body).sort(), ['event', 'tag', 'text', 'title', 'to', 'url']);
  assertEquals(r.body.event, 'connection_expiring');
  assertEquals(r.body.to, ['ian@welfareavenue.com', 'kk@welfareavenue.com']);
  assertEquals(r.body.title, 'LinkedIn connection expires in 6 days');
  assert(r.body.text.includes('LinkedIn'));
  assert(r.body.text.includes('6 days'));
  assert(r.body.text.includes('<https://hub.welfareavenue.com/#studio/connections|Open Connections>'));
  assertEquals(r.body.url, '/#studio/connections');
  assertEquals(r.body.tag, 'studio-conn-linkedin');
  assertEquals(store.linkedin.warned_at, iso(NOW));
});

Deno.test('warn: one day reads 1 day; a record warned 3 days ago gets no notify', async () => {
  const store: Record<string, Any> = {
    threads: { status: 'connected', expires_at: iso(NOW + DAY - 1000) },
    linkedin: { status: 'connected', expires_at: iso(NOW + 5 * DAY), warned_at: iso(NOW - 3 * DAY) },
  };
  const { rc, posts } = rig({}, store);
  assertEquals(await warn(rc, [P('threads', 'Threads'), P('linkedin', 'LinkedIn')]), ['threads warned']);
  assertEquals(posts.length, 1);
  assert(posts[0].body.text.startsWith('Threads connection expires in 1 day. '));
});
