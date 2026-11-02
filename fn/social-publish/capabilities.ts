// wave277, 02/11/26: what can publish where (the capabilities action, moved from social-publish v5 index.ts).
// The Meta block (token, permissions, accounts) is as in v5. Every other platform's mode comes from its adapter's modeOf,
// and can is "mode is not reminder", as in v5. New: platforms (the active registry rows) and caps (key to caps, every row).
// A mode is given for every registry key, active or not, and for every adapter, so a post naming an inactive platform
// still resolves; with no registry (an empty list) the adapters alone give today's six.
import { ADAPTERS } from './adapters/index.ts';
import { type Any, type Caps, graph, type Platform, type PubCtx } from './adapters/types.ts';

export type CapCtx = PubCtx & {
  accounts(): Promise<Any[]>;
  settings(): Promise<Record<string, Any>>;
  studio(): Promise<Record<string, Any>>;
};

export async function permissions(ctx: PubCtx, token: string): Promise<{ granted: string[]; source: string }> {
  try { const r = await graph(ctx, 'GET', '/me/permissions', token); return { granted: ((r.data || []) as Any[]).filter(p => p.status === 'granted').map(p => String(p.permission)), source: 'me/permissions' }; }
  catch (_) { /* a Page token has no permissions edge */ }
  try { const r = await graph(ctx, 'GET', '/debug_token', token, { input_token: token }); const d = r.data || {}; return { granted: (d.scopes || (d.granular_scopes || []).map((s: Any) => s.scope) || []) as string[], source: 'debug_token' }; }
  catch (_) { return { granted: [], source: 'unknown' }; }
}

export async function capabilitiesOf(ctx: CapCtx, platformsList: Platform[]): Promise<Any> {
  const token = await ctx.secretOrNull('META_SYSTEM_TOKEN');
  const accs = await ctx.accounts();
  const conn = await ctx.connections();
  const out: Any = { ok: true, token: !!token, accounts: accs || [], granted: [], can: {}, mode: {}, missing: [], source: null, settings: await ctx.settings(), studio: await ctx.studio(), connections: {} };
  const keys = Array.from(new Set([...platformsList.map(p => p.key), ...Object.keys(ADAPTERS)]));
  for (const k of keys) out.can[k] = false;
  if (token) {
    const perms = await permissions(ctx, token);
    out.granted = perms.granted; out.source = perms.source;
    const has = (x: string) => perms.granted.indexOf(x) >= 0;
    const fbAcc = (accs || []).some((a: Any) => a.platform === 'facebook');
    const igAcc = (accs || []).some((a: Any) => a.platform === 'instagram');
    out.can.facebook = fbAcc && (perms.source === 'unknown' ? true : has('pages_manage_posts'));
    out.can.instagram = igAcc && (perms.source === 'unknown' ? true : has('instagram_content_publish'));
    out.comments = { facebook: perms.source === 'unknown' ? null : has('pages_manage_engagement') && has('pages_read_user_content'), instagram: perms.source === 'unknown' ? null : has('instagram_manage_comments') };
    const want = ['pages_manage_posts', 'pages_manage_engagement', 'pages_read_user_content', 'pages_read_engagement', 'pages_show_list', 'read_insights', 'business_management', 'instagram_basic', 'instagram_content_publish', 'instagram_manage_comments', 'instagram_manage_insights'];
    if (perms.source !== 'unknown') out.missing = want.filter(x => !has(x));
    out.accounts_missing = [!fbAcc ? 'facebook' : null, !igAcc ? 'instagram' : null].filter(Boolean);
  }
  const mctx: PubCtx = { ...ctx, metaCan: { facebook: !!out.can.facebook, instagram: !!out.can.instagram } };
  for (const k of keys) {
    const ad = ADAPTERS[k];
    out.mode[k] = ad ? await ad.modeOf((conn[k] || {}), mctx) : 'reminder';
    if (k !== 'facebook' && k !== 'instagram') out.can[k] = out.mode[k] !== 'reminder';
  }
  for (const k of Object.keys(conn)) { const c = { ...(conn[k] || {}) }; delete c.state; out.connections[k] = c; }
  out.platforms = platformsList.filter(p => p.active);
  const caps: Record<string, Caps> = {};
  for (const p of platformsList) caps[p.key] = p.caps;
  out.caps = caps;
  return out;
}
