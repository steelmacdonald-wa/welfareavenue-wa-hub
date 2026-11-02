// wave277: the LinkedIn adapter asks for the registry's six scopes and keeps what LinkedIn granted.
import { assert, assertEquals } from 'jsr:@std/assert';
import { linkedin } from './linkedin.ts';
import type { Ctx, Platform } from './types.ts';

const SIX = ['w_organization_social', 'r_organization_social', 'rw_organization_admin', 'r_organization_social_feed', 'w_organization_social_feed', 'r_organization_followers'];
const P: Platform = { key: 'linkedin', label: 'LinkedIn', auth: 'oauth', active: true, scopes: SIX };
const REDIRECT = 'https://example.supabase.co/functions/v1/social-connect';

type Call = { url: string; method: string; headers: Record<string, string>; body: string };
function fakeCtx(answers: Record<string, unknown>, now = Date.now()) {
  const calls: Call[] = [];
  const vault: Record<string, string> = {};
  const fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: String(init?.method || 'GET'), headers: (init?.headers || {}) as Record<string, string>, body: String(init?.body || '') });
    const key = Object.keys(answers).find((k) => url.startsWith(k));
    if (!key) return Promise.resolve(new Response('{"message":"no fake for ' + url + '"}', { status: 404 }));
    return Promise.resolve(new Response(JSON.stringify(answers[key]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }) as typeof globalThis.fetch;
  const ctx: Ctx = {
    getSecret: (n: string) => vault[n] ? Promise.resolve(vault[n]) : Promise.reject(new Error('secret ' + n + ' unavailable')),
    secretOrNull: (n: string) => Promise.resolve(vault[n] || null),
    vaultSet: (n: string, v: string) => { vault[n] = v; return Promise.resolve(); },
    svc: { from: () => ({}), rpc: () => Promise.resolve({ data: null, error: null }) },
    now: () => now,
    fetch,
  };
  return { ctx, calls, vault };
}

Deno.test('linkedin authorizeUrl asks for the six registry scopes and the redirect', () => {
  const u = linkedin.authorizeUrl(P, 'client-1', REDIRECT, 'st4te');
  assert(u.startsWith('https://www.linkedin.com/oauth/v2/authorization?'), u);
  assert(u.includes('scope=' + encodeURIComponent(SIX.join(' '))), u);
  assert(u.includes('redirect_uri=' + encodeURIComponent(REDIRECT)), u);
  assert(u.includes('client_id=client-1'), u);
  assert(u.includes('state=st4te'), u);
});

Deno.test('linkedin finish stores granted scopes, expiry and the Page as account_id', async () => {
  const now = Date.now();
  const { ctx, calls, vault } = fakeCtx({
    'https://www.linkedin.com/oauth/v2/accessToken': { access_token: 't', expires_in: 5184000, scope: 'w_organization_social r_organization_social' },
    'https://api.linkedin.com/rest/organizationAcls': { elements: [{ organization: 'urn:li:organization:1' }] },
  }, now);
  const r = await linkedin.finish(P, { id: 'client-1', secret: 'sec-123456' }, 'the-code', REDIRECT, 'steel@example.com', ctx);

  assertEquals(r.conn.scopes_granted, ['w_organization_social', 'r_organization_social']);
  assertEquals(r.conn.account_id, 'urn:li:organization:1');
  assertEquals(r.conn.org_urn, 'urn:li:organization:1');
  assertEquals(r.conn.status, 'connected');
  assertEquals(r.conn.mode, 'direct');
  assertEquals(r.conn.connected_by, 'steel@example.com');
  const exp = new Date(String(r.conn.expires_at)).getTime();
  assert(Math.abs(exp - (now + 60 * 86400000)) < 60000, 'expires_at ' + r.conn.expires_at);
  assertEquals(r.label, 'the Page 1');

  // the token exchange is the same form POST as v2.1
  assertEquals(calls[0].method, 'POST');
  assertEquals(calls[0].headers['Content-Type'], 'application/x-www-form-urlencoded');
  assertEquals(Object.fromEntries(new URLSearchParams(calls[0].body)), { grant_type: 'authorization_code', code: 'the-code', redirect_uri: REDIRECT, client_id: 'client-1', client_secret: 'sec-123456' });
  // the ACL read carries the token and the two LinkedIn headers
  assertEquals(calls[1].url, 'https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED');
  assertEquals(calls[1].headers, { Authorization: 'Bearer t', 'Linkedin-Version': '202609', 'X-Restli-Protocol-Version': '2.0.0' });
  // the token lands in the vault, never in the record
  assertEquals(vault.SOCIAL_LINKEDIN_TOKEN, 't');
  assert(!JSON.stringify(r.conn).includes('"t"'), 'no token in the record');
});

Deno.test('linkedin finish splits granted scopes on spaces or commas and drops empties', async () => {
  const { ctx } = fakeCtx({
    'https://www.linkedin.com/oauth/v2/accessToken': { access_token: 't', expires_in: 5184000, scope: ' w_organization_social,r_organization_social  rw_organization_admin, ' },
    'https://api.linkedin.com/rest/organizationAcls': { elements: [] },
  });
  const r = await linkedin.finish(P, { id: 'client-1', secret: 'sec-123456' }, 'c', REDIRECT, 'x', ctx);
  assertEquals(r.conn.scopes_granted, ['w_organization_social', 'r_organization_social', 'rw_organization_admin']);
});

Deno.test('linkedin health reads the ACL with the stored token and throws on a non-2xx', async () => {
  const { ctx, calls } = fakeCtx({ 'https://api.linkedin.com/rest/organizationAcls': { elements: [] } });
  await ctx.vaultSet('SOCIAL_LINKEDIN_TOKEN', 'tok', '');
  const h = await linkedin.health(P, { status: 'connected' }, ctx);
  assertEquals(calls[0].headers.Authorization, 'Bearer tok');
  assertEquals(typeof h.last_checked_at, 'string');
  assertEquals(h.last_error, null);

  const bad = fakeCtx({});
  await bad.ctx.vaultSet('SOCIAL_LINKEDIN_TOKEN', 'tok', '');
  let msg = '';
  try { await linkedin.health(P, { status: 'connected' }, bad.ctx); } catch (e) { msg = (e as Error).message; }
  assert(msg.includes('404'), msg);
});
