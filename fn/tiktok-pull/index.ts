// Welfare Avenue: tiktok-pull (v1, 12/10/26, wave231 TikTok analytics)
// Purpose: reads Welfare Avenue's own TikTok account through the login the Content Studio keeps (social-connect) and files it
// where the Hub's Analytics already looks: the account (social_accounts, platform tiktok), a daily row per metric
// (social_daily) and every public video with its numbers (social_posts). This replaces the TikTok CSV export.
// Scopes used: user.info.basic (name, avatar), user.info.profile (username, bio, profile link, verified),
// user.info.stats (followers, following, likes, video count), video.list (the public videos and their counts).
// A scope the login does not carry is skipped, never asked for here (social-connect asks).
// Daily rows (Toronto date): followers (the count that day); new_followers, views, likes, comments, shares and engagement
// (likes + comments + shares) are the growth since the last pull of an earlier day, summed over every public video, so the
// first day after connecting has followers only. Nothing is ever posted, changed or deleted on TikTok.
// Trigger: cron wa-tiktok-pull (daily, after the morning social-pull), social-connect right after TikTok connects, and
// social-pull's sync (Analytics' Sync now). Auth: x-wa-secret (automation) or a signed-in staff member. verify_jwt off,
// checked here (the same as social-pull).
// Actions (POST): sync (default) | status. Tables: social_accounts, social_daily, social_posts, hub_settings
// studio_connections (the TikTok card's profile line), change_log. Storage: content-images/social/tiktok/<id>.jpg (covers,
// because TikTok's cover links expire). Vault: SOCIAL_TIKTOK_TOKEN (refreshed here like social-publish does),
// SOCIAL_TIKTOK_CLIENT.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const API = 'https://open.tiktokapis.com/v2';
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Any = any;

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
async function secretOrNull(name: string): Promise<string | null> { try { const v = await getSecret(name); return v ? v : null; } catch (_) { return null; } }

async function allowed(req: Request): Promise<string | null> {
  try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) return 'automation'; } catch (_) { /* no */ }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = String(data?.user?.email || '').toLowerCase();
  if (!email) return null;
  const { data: ok } = await asUser.rpc('is_wa_staff');
  return ok === true ? email : null;
}

/* the login: same refresh as social-publish (access tokens last a day, the refresh token a year) */
type Tok = { access_token: string; refresh_token: string; open_id?: string; expires_at?: number; scope?: string };
async function token(): Promise<Tok | null> {
  const raw = await secretOrNull('SOCIAL_TIKTOK_TOKEN'); const cl = await secretOrNull('SOCIAL_TIKTOK_CLIENT');
  if (!raw || !cl) return null;
  let t: Tok; let c: Any;
  try { t = JSON.parse(raw); c = JSON.parse(cl); } catch (_) { return null; }
  if (!t || !t.refresh_token) return null;
  if (t.access_token && Number(t.expires_at || 0) > Date.now() + 120000) return t;
  const r = await fetch(API + '/oauth/token/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_key: c.key || c.id, client_secret: c.secret, grant_type: 'refresh_token', refresh_token: t.refresh_token }).toString() });
  const b = await r.json().catch(() => ({}));
  if (!b.access_token) throw new Error('TikTok sign-in expired: connect TikTok again in Content Studio, Connections');
  const next: Tok = { ...t, access_token: b.access_token, refresh_token: b.refresh_token || t.refresh_token, expires_at: Date.now() + Number(b.expires_in || 86400) * 1000, scope: b.scope || t.scope };
  await svc.rpc('wa_vault_set', { p_name: 'SOCIAL_TIKTOK_TOKEN', p_value: JSON.stringify(next), p_note: 'wave225/231: TikTok login for the Content Studio (social-connect; refreshed by social-publish and tiktok-pull)' });
  return next;
}
function has(t: Tok, scope: string): boolean {
  // logins made before wave231 carry no scope list: they have basic and video.upload only
  const s = String(t.scope || 'user.info.basic,video.upload');
  return s.split(/[,\s]+/).indexOf(scope) >= 0;
}
async function api(t: Tok, path: string, init?: RequestInit): Promise<Any> {
  const r = await fetch(API + path, { ...(init || {}), headers: { Authorization: 'Bearer ' + t.access_token, 'Content-Type': 'application/json', ...((init && init.headers) || {}) } });
  const b = await r.json().catch(() => ({}));
  const code = b && b.error && b.error.code;
  if (!r.ok || (code && code !== 'ok')) throw new Error('TikTok ' + path.split('?')[0] + ': ' + String((b.error && (b.error.message || b.error.code)) || ('HTTP ' + r.status)).slice(0, 180));
  return b.data || {};
}

function torontoDay(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
const n = (v: Any) => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));

async function cacheCover(id: string, url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.length < 200 || bytes.length > 4 * 1024 * 1024) return null;
    const path = 'social/tiktok/' + id.replace(/[^\w-]/g, '') + '.jpg';
    const up = await svc.storage.from('content-images').upload(path, bytes, { contentType: r.headers.get('content-type') || 'image/jpeg', upsert: true });
    if (up.error) return null;
    return SUPABASE_URL + '/storage/v1/object/public/content-images/' + path;
  } catch (_) { return null; }
}

async function sync(by: string): Promise<Any> {
  const t = await token();
  if (!t) return { ok: true, skipped: 'TikTok is not connected' };
  const out: Any = { ok: true, scopes: t.scope || 'user.info.basic,video.upload' };
  const today = torontoDay();

  /* 1. the profile and the counts */
  const fields = ['open_id', 'avatar_url', 'display_name'];
  if (has(t, 'user.info.profile')) fields.push('username', 'bio_description', 'profile_deep_link', 'profile_web_link', 'is_verified');
  if (has(t, 'user.info.stats')) fields.push('follower_count', 'following_count', 'likes_count', 'video_count');
  const u = ((await api(t, '/user/info/?fields=' + fields.join(','))).user || {}) as Any;
  const openId = String(u.open_id || t.open_id || '');
  if (!openId) throw new Error('TikTok sent no account id');

  const { data: prevAcct } = await svc.from('social_accounts').select('id, meta').eq('platform', 'tiktok').eq('external_id', openId).maybeSingle();
  const meta: Any = { ...((prevAcct && prevAcct.meta) || {}) };
  const handle = u.username ? String(u.username) : (meta.profile && meta.profile.username) || null;
  const acctRow: Any = {
    platform: 'tiktok', external_id: openId, handle, name: u.display_name || 'TikTok',
    url: u.profile_web_link || (handle ? 'https://www.tiktok.com/@' + handle : null), picture_url: u.avatar_url || null,
    status: 'connected', last_sync_at: new Date().toISOString(), last_error: null,
  };
  const profile = {
    username: handle, bio: u.bio_description ?? (meta.profile && meta.profile.bio) ?? null, verified: u.is_verified ?? null,
    web_link: u.profile_web_link || null, deep_link: u.profile_deep_link || null,
    followers: n(u.follower_count), following: n(u.following_count), likes_total: n(u.likes_count), video_count: n(u.video_count),
  };
  meta.profile = profile; meta.by = by; meta.source = 'TikTok API (tiktok-pull)';
  const { data: acct, error: aErr } = await svc.from('social_accounts').upsert({ ...acctRow, meta }, { onConflict: 'platform,external_id' }).select('id').single();
  if (aErr || !acct) throw new Error('saving the account: ' + (aErr && aErr.message));
  const accountId = acct.id as number;

  /* 2. the public videos (newest first, up to 400) */
  let videos: Any[] = [];
  if (has(t, 'video.list')) {
    const vf = 'id,create_time,cover_image_url,share_url,video_description,title,duration,view_count,like_count,comment_count,share_count';
    let cursor: number | undefined; let more = true; let pages = 0;
    while (more && pages < 20) {
      const d = await api(t, '/video/list/?fields=' + vf, { method: 'POST', body: JSON.stringify(cursor ? { max_count: 20, cursor } : { max_count: 20 }) });
      videos = videos.concat((d.videos || []) as Any[]);
      more = !!d.has_more && d.cursor != null; cursor = d.cursor; pages++;
    }
    const rows = videos.map(v => {
      const likes = n(v.like_count), comments = n(v.comment_count), shares = n(v.share_count);
      return {
        platform: 'tiktok', account_id: accountId, external_id: String(v.id), url: v.share_url || null, kind: 'video',
        caption: String(v.video_description || v.title || '').slice(0, 4000) || null, thumb_url: v.cover_image_url || null,
        published_at: v.create_time ? new Date(Number(v.create_time) * 1000).toISOString() : null,
        views: n(v.view_count), likes, comments, shares, engagement: (likes || 0) + (comments || 0) + (shares || 0),
        raw: { duration: v.duration ?? null, title: v.title || null, source: 'TikTok API' }, source: 'api', updated_at: new Date().toISOString(),
      };
    });
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await svc.from('social_posts').upsert(rows.slice(i, i + 100), { onConflict: 'platform,external_id' });
      if (error) throw new Error('saving the videos: ' + error.message);
    }
    out.videos = rows.length;
    /* covers: TikTok's links expire, so keep a copy like the Meta thumbnails (30 a run) */
    const { data: need } = await svc.from('social_posts').select('id, external_id, thumb_url').eq('platform', 'tiktok').is('thumb_cached', null).not('thumb_url', 'is', null).limit(30);
    let cached = 0;
    for (const p of (need || []) as Any[]) {
      const url = await cacheCover(String(p.external_id), String(p.thumb_url));
      await svc.from('social_posts').update(url ? { thumb_cached: url, thumb_cached_at: new Date().toISOString(), thumb_error: null } : { thumb_error: 'cover not cached ' + today }).eq('id', p.id);
      if (url) cached++;
    }
    out.covers = cached;
  }

  /* 3. the day's rows: followers that day, and growth since the last pull of an earlier day */
  const totals = {
    followers: profile.followers,
    views: videos.length ? videos.reduce((s, v) => s + (n(v.view_count) || 0), 0) : null,
    likes: videos.length ? videos.reduce((s, v) => s + (n(v.like_count) || 0), 0) : null,
    comments: videos.length ? videos.reduce((s, v) => s + (n(v.comment_count) || 0), 0) : null,
    shares: videos.length ? videos.reduce((s, v) => s + (n(v.share_count) || 0), 0) : null,
  };
  const snap = meta.snap && meta.snap.day ? meta.snap : null;
  const base = snap && snap.day < today ? snap : (meta.base && meta.base.day < today ? meta.base : null);
  const daily: Any[] = [];
  const put = (metric: string, value: number | null) => { if (value != null && isFinite(value)) daily.push({ platform: 'tiktok', account_id: accountId, day: today, metric, value, source: 'api', updated_at: new Date().toISOString() }); };
  put('followers', totals.followers);
  if (base) {
    const d = (k: 'followers' | 'views' | 'likes' | 'comments' | 'shares') => (totals[k] != null && base[k] != null ? Math.max(0, Number(totals[k]) - Number(base[k])) : null);
    put('new_followers', d('followers'));
    put('views', d('views')); put('likes', d('likes')); put('comments', d('comments')); put('shares', d('shares'));
    const l = d('likes'), c = d('comments'), s = d('shares');
    if (l != null || c != null || s != null) put('engagement', (l || 0) + (c || 0) + (s || 0));
  }
  if (daily.length) {
    const { error } = await svc.from('social_daily').upsert(daily, { onConflict: 'platform,account_id,day,metric' });
    if (error) throw new Error('saving the day: ' + error.message);
  }
  meta.base = base; meta.snap = { day: today, ...totals };
  await svc.from('social_accounts').update({ meta }).eq('id', accountId);
  out.day = today; out.daily = daily.map(x => x.metric); out.followers = totals.followers; out.username = handle;

  /* 4. the Connections card's profile line (no secrets) */
  try {
    const { data: hs } = await svc.from('hub_settings').select('value').eq('key', 'studio_connections').maybeSingle();
    const c = ((hs && hs.value) || {}) as Any;
    if (c.tiktok && c.tiktok.status === 'connected') {
      c.tiktok = { ...c.tiktok, name: (u.display_name || c.tiktok.name || 'TikTok') + (handle ? ' (@' + handle + ')' : ''), username: handle, avatar_url: u.avatar_url || null, verified: profile.verified, bio: profile.bio, profile_url: acctRow.url, followers: profile.followers, videos: profile.video_count, pulled_at: new Date().toISOString() };
      await svc.from('hub_settings').upsert({ key: 'studio_connections', value: c, updated_at: new Date().toISOString(), updated_by: 'tiktok-pull' });
    }
  } catch (_) { /* the card only */ }

  try { await svc.from('change_log').insert({ entity_type: 'social_sync', entity_id: 'tiktok', field: 'pull', old_value: null, new_value: ('TikTok pulled: ' + (out.videos ?? 0) + ' videos, followers ' + (totals.followers ?? 'n/a') + ', rows ' + daily.length).slice(0, 300), changed_by: by }); } catch (_) { /* audit */ }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const by = await allowed(req);
  if (!by) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({})) as Record<string, Any>;
  const action = String(body.action || 'sync');
  try {
    if (action === 'status') {
      const raw = await secretOrNull('SOCIAL_TIKTOK_TOKEN');
      let scope = null; try { scope = raw ? (JSON.parse(raw).scope || 'user.info.basic,video.upload') : null; } catch (_) { /* none */ }
      const { data } = await svc.from('social_accounts').select('handle, name, status, last_sync_at, last_error').eq('platform', 'tiktok').maybeSingle();
      return json({ ok: true, connected: !!raw, scopes: scope, account: data || null });
    }
    if (action !== 'sync') return json({ error: 'unknown action' }, 400);
    return json(await sync(by));
  } catch (e) {
    const msg = String((e as Error).message || e).slice(0, 300);
    try { await svc.from('social_accounts').update({ status: 'error', last_error: msg, last_sync_at: new Date().toISOString() }).eq('platform', 'tiktok'); } catch (_) { /* no row yet */ }
    try { await svc.from('change_log').insert({ entity_type: 'social_sync', entity_id: 'tiktok', field: 'pull', old_value: null, new_value: ('TikTok pull failed: ' + msg).slice(0, 300), changed_by: by }); } catch (_) { /* audit */ }
    return json({ ok: false, error: msg }, 500);
  }
});
