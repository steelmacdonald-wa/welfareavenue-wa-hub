// wave277, 02/11/26: what every social-connect adapter receives and returns.
// Platform is the part of the registry row (platforms.ts) the adapters read. It is declared here, not imported, because
// platforms.ts only sits beside index.ts once deployed; the full registry Platform is assignable to it.
// deno-lint-ignore no-explicit-any
export type Any = any;

export type Platform = { key: string; label: string; auth: string; scopes: string[]; active: boolean };

export type Conn = {
  status?: string;
  mode?: string;
  name?: string;
  handle?: string;
  account_id?: string;
  scopes_granted?: string[];
  connected_by?: string;
  connected_at?: string;
  expires_at?: string | null;
  last_checked_at?: string;
  last_error?: string | null;
  health?: 'ok' | 'expiring' | 'expired' | 'error' | 'not_connected';
  warned_at?: string | null;
  [k: string]: unknown;
};

// Loose on purpose, like platforms.ts: index.ts passes its service-role client.
export type SupabaseClient = { from(table: string): Any; rpc(fn: string, args?: Record<string, unknown>): Any };

export type Ctx = {
  getSecret(n: string): Promise<string>;
  secretOrNull(n: string): Promise<string | null>;
  vaultSet(n: string, v: string, note: string): Promise<void>;
  svc: SupabaseClient;
  now(): number;
  fetch: typeof fetch;
};

export type Adapter = {
  authorizeUrl(p: Platform, id: string, redirect: string, state: string): string;
  finish(p: Platform, c: { id: string; secret: string }, code: string, redirect: string, by: string, ctx: Ctx): Promise<{ label: string; conn: Partial<Conn> }>;
  refresh?(p: Platform, conn: Conn, ctx: Ctx): Promise<Partial<Conn>>;
  health(p: Platform, conn: Conn, ctx: Ctx): Promise<Partial<Conn>>;
};

export const DAY = 86400000;
export const iso = (t: number) => new Date(t).toISOString();

// the form POST every token exchange uses (unchanged from v2.1, now through ctx.fetch)
export async function form(ctx: Ctx, url: string, params: Record<string, string>): Promise<Any> {
  const r = await ctx.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() });
  const b = await r.json().catch(() => ({}));
  if (!r.ok || b.error) throw new Error(String(b.error_description || (b.error && (b.error.message || b.error)) || ('HTTP ' + r.status)).slice(0, 200));
  return b;
}

// a health call: any non-2xx throws with the status and the first 160 characters of the answer
export async function must(ctx: Ctx, url: string, init?: RequestInit): Promise<Any> {
  const r = await ctx.fetch(url, init);
  const t = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + t.slice(0, 160));
  try { return JSON.parse(t); } catch (_) { return {}; }
}

// the client keys saved by save_app (older TikTok saves used key instead of id)
export async function clientOf(ctx: Ctx, key: string): Promise<{ id: string; secret: string } | null> {
  const raw = await ctx.secretOrNull('SOCIAL_' + key.toUpperCase() + '_CLIENT');
  if (!raw) return null;
  try { const c = JSON.parse(raw); return c.id && c.secret ? c : (c.key && c.secret ? { id: c.key, secret: c.secret } : null); } catch (_) { return null; }
}

export const checked = (ctx: Ctx): Partial<Conn> => ({ last_checked_at: iso(ctx.now()), last_error: null });
