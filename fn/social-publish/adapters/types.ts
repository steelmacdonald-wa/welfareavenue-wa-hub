// wave277, 02/11/26: what every social-publish adapter receives and returns, and the post helpers index.ts shares.
// Platform and Caps are the part of the registry row (platforms.ts) the adapters read. They are declared here, not imported,
// because platforms.ts only sits beside index.ts once deployed; the full registry Platform is assignable to them.
// Manual and Pending are defined once, here; index.ts imports them.
// deno-lint-ignore no-explicit-any
export type Any = any;

export type Caps = { text: boolean; images: boolean; max_images: number; video: boolean; max_video_s: number; comments: boolean; analytics: boolean; link_in_caption: boolean };
export type Platform = { key: string; label: string; caps: Caps; active: boolean };

// copied from social-connect/adapters/types.ts (functions cannot import each other)
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

export type Media = { path?: string; url: string; mime?: string; kind?: string; w?: number; h?: number; dur?: number; alt?: string; tags?: Array<{ username: string; x: number; y: number }> };
export type Post = {
  id: number; title: string | null; platforms: string[]; format: string; caption: string | null; link_url: string | null; media: Media[];
  scheduled_at: string | null; status: string; results: Record<string, Any>; live: Record<string, Any>; error: string | null; owner: string | null;
  published_at: string | null; updated_at: string; campaign: string | null; variants: Record<string, Any>; first_comment: string | null; tags: string[];
  approval_status: string; submitted_by: string | null; approved_by: string | null; approval_note: string | null; repeat_rule: Any; repeat_of: number | null;
  track_links: boolean; utm: Any; manual: Record<string, Any>; created_by: string | null;
};

export class Pending extends Error { container: string; constructor(c: string) { super('still processing the video'); this.container = c; } }
export class Manual extends Error { constructor(m: string) { super(m); } }

export type Targets = { token: string; page: { id: string; name: string; token: string } | null; ig: { id: string; username: string } | null };

export type Result = { id: string; url: string; pending?: boolean; via?: string; [k: string]: unknown };

// what the adapters get: they never touch the vault, the database or the network except through this
export type PubCtx = {
  fetch: typeof fetch;
  getSecret(n: string): Promise<string>;
  secretOrNull(n: string): Promise<string | null>;
  vaultSet(n: string, v: string, note: string): Promise<void>;
  connections(): Promise<Record<string, Any>>;
  capFor(p: Post, platform: string): Promise<string>;
  trackLinks(text: string, p: Post, platform: string): Promise<string>;
  shortLink(url: string, p: Post, platform: string): Promise<string>;
  images(p: Post): Media[];
  videos(p: Post): Media[];
  sleep(ms: number): Promise<void>;
  // Meta: resolved once per post by publishPost (null when the Meta token is missing)
  targets: Targets | null;
  // Meta: what capabilities found the token can do (the Meta adapters' modeOf reads it)
  metaCan?: Record<string, boolean>;
};

export type Publisher = {
  publish(p: Post, caps: Caps, ctx: PubCtx): Promise<Result>;
  modeOf(conn: Conn, ctx: PubCtx): Promise<string>;
};

export const GRAPH = 'https://graph.facebook.com/v23.0';
export const THREADS = 'https://graph.threads.net/v1.0';

/* ---------- Graph (unchanged from v5, now through ctx.fetch) ---------- */
export async function graph(ctx: { fetch: typeof fetch }, method: 'GET' | 'POST' | 'DELETE', path: string, token: string, params: Record<string, string> = {}, base = GRAPH): Promise<Any> {
  const u = new URL(base + (path.startsWith('/') ? path : '/' + path));
  const body = new URLSearchParams();
  for (const k of Object.keys(params)) { if (method === 'POST') body.set(k, params[k]); else u.searchParams.set(k, params[k]); }
  if (method === 'POST') body.set('access_token', token); else u.searchParams.set('access_token', token);
  const res = await ctx.fetch(u.toString(), method === 'POST' ? { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() } : { method });
  const b = await res.json().catch(() => ({}));
  if (!res.ok || b.error) { const e = b.error || {}; throw new Error((e.error_user_msg || e.message || ('HTTP ' + res.status)) + (e.code ? ' (code ' + e.code + (e.error_subcode ? '/' + e.error_subcode : '') + ')' : '')); }
  return b;
}
export async function containerStatus(ctx: { fetch: typeof fetch }, cid: string, token: string, base = GRAPH): Promise<string> {
  const r = await graph(ctx, 'GET', '/' + cid, token, { fields: base === GRAPH ? 'status_code,status' : 'status,error_message' }, base);
  const s = String(r.status_code || r.status || '');
  if (s === 'ERROR' || s === 'EXPIRED') throw new Error('could not process the media (' + s + (r.status && r.status !== s ? ': ' + r.status : '') + (r.error_message ? ': ' + r.error_message : '') + ')');
  return s;
}
export async function waitContainer(ctx: { fetch: typeof fetch }, cid: string, token: string, maxMs: number, base = GRAPH): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    if ((await containerStatus(ctx, cid, token, base)) === 'FINISHED') return true;
    await new Promise(res => setTimeout(res, 4000));
  }
  return false;
}

/* ---------- the post's parts (pure, unchanged from v5) ---------- */
export function images(p: Post): Media[] { return (p.media || []).filter(m => m && m.url && String(m.kind || m.mime || '').indexOf('video') < 0); }
export function videos(p: Post): Media[] { return (p.media || []).filter(m => m && m.url && String(m.kind || m.mime || '').indexOf('video') >= 0); }
export function V(p: Post, platform: string): Record<string, Any> { return ((p.variants || {})[platform] || {}) as Record<string, Any>; }
export function kindOf(p: Post, platform: string): string { const k = String(V(p, platform).kind || ''); if (k) return k; if (platform === 'instagram' && videos(p).length) return 'reel'; return 'feed'; }
export function rawCaption(p: Post, platform: string): string { const v = V(p, platform); return String((v.caption != null && String(v.caption).trim() !== '' ? v.caption : p.caption) || '').trim(); }
export function firstCommentOf(p: Post, platform: string): string { const v = V(p, platform); return String((v.first_comment != null && String(v.first_comment).trim() !== '' ? v.first_comment : p.first_comment) || '').trim(); }
