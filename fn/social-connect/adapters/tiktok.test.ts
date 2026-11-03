// wave277: TikTok health reuses a fresh access token and refreshes only near expiry (as tiktok-pull does).
import { assert, assertEquals } from 'jsr:@std/assert';
import { tiktok } from './tiktok.ts';
import type { Ctx, Platform } from './types.ts';

const P: Platform = { key: 'tiktok', label: 'TikTok', auth: 'oauth', active: true, scopes: ['user.info.basic'] };
const NOW = Date.parse('2026-11-02T12:00:00Z');

function fake(expiresAt: number) {
  const calls: { url: string; method: string; auth: string }[] = [];
  const vault: Record<string, string> = {
    SOCIAL_TIKTOK_CLIENT: JSON.stringify({ id: 'ck', secret: 'cs-123456' }),
    SOCIAL_TIKTOK_TOKEN: JSON.stringify({ access_token: 'old', refresh_token: 'r1', open_id: 'o', expires_at: expiresAt }),
  };
  const fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = String(input), method = String(init?.method || 'GET');
    calls.push({ url, method, auth: String(((init?.headers || {}) as Record<string, string>).Authorization || '') });
    const body = url.includes('/oauth/token/') ? { access_token: 'new', refresh_token: 'r2', expires_in: 86400 } : { data: { user: { open_id: 'o' } } };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  }) as typeof globalThis.fetch;
  const ctx: Ctx = {
    getSecret: (n) => vault[n] ? Promise.resolve(vault[n]) : Promise.reject(new Error('secret ' + n + ' unavailable')),
    secretOrNull: (n) => Promise.resolve(vault[n] || null),
    vaultSet: (n, v) => { vault[n] = v; return Promise.resolve(); },
    svc: { from: () => ({}), rpc: () => Promise.resolve({ data: null, error: null }) },
    now: () => NOW,
    fetch,
  };
  return { ctx, calls, vault };
}

Deno.test('tiktok health reuses the stored token when it is far from expiry', async () => {
  const { ctx, calls, vault } = fake(NOW + 3600000);
  const h = await tiktok.health(P, { status: 'connected' }, ctx);
  assertEquals(calls.filter((c) => c.method === 'POST').length, 0);
  assertEquals(calls.length, 1);
  assert(calls[0].url.startsWith('https://open.tiktokapis.com/v2/user/info/?fields=open_id'));
  assertEquals(calls[0].auth, 'Bearer old');
  assertEquals(JSON.parse(vault.SOCIAL_TIKTOK_TOKEN).refresh_token, 'r1');
  assertEquals(h.last_error, null);
});

Deno.test('tiktok health refreshes within two minutes of expiry and stores the new login', async () => {
  const { ctx, calls, vault } = fake(NOW + 60000);
  await tiktok.health(P, { status: 'connected' }, ctx);
  assertEquals(calls[0].method, 'POST');
  assertEquals(calls[1].auth, 'Bearer new');
  const t = JSON.parse(vault.SOCIAL_TIKTOK_TOKEN);
  assertEquals([t.access_token, t.refresh_token, t.expires_at], ['new', 'r2', NOW + 86400000]);
});
