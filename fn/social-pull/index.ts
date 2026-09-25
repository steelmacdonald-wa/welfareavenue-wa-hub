// Welfare Avenue: social-pull (v1, 25/09/26)
// The numbers behind Marketing > Analytics. Reads Meta (Facebook Page +
// Instagram business account) with the system user token in the vault
// (META_SYSTEM_TOKEN), Google Analytics 4 with the hub's service account
// (GOOGLE_SA_KEY, added as a Viewer on the property), and takes CSV exports
// for the platforms whose APIs need an approval first (TikTok, LinkedIn).
// Writes social_accounts, social_daily (one row per platform, day, metric)
// and social_posts; writes the weekly note with the router (task digest).
// Actions (POST):
//   {action:'status'}                          accounts, last sync, errors      (staff)
//   {action:'probe'}                           what the tokens can see          (staff)
//   {action:'connect_meta', page_id?}          add the Page and its Instagram   (staff)
//   {action:'connect_ga4', property_id}        add a GA4 property               (staff)
//   {action:'disconnect', account_id}          remove an account and its rows   (staff)
//   {action:'sync', account_id?, days?}        pull the numbers                 (staff or x-wa-secret, cron wa-social-pull)
//   {action:'import_csv', platform, rows, posts?, handle?}  CSV rows            (staff)
//   {action:'note', days?}                     the AI note                      (staff or x-wa-secret, cron wa-social-note)
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const GRAPH = 'https://graph.facebook.com/v23.0';
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Any = any;
type Account = { id: number; platform: string; external_id: string | null; handle: string | null; name: string | null; url: string | null; picture_url: string | null; status: string; last_sync_at: string | null; last_error: string | null; meta: Record<string, Any> };
const METRICS = ['followers', 'new_followers', 'unfollows', 'reach', 'views', 'video_views', 'profile_views', 'engagement', 'accounts_engaged', 'likes', 'comments', 'shares', 'saves', 'clicks', 'posts', 'sessions', 'users', 'new_users', 'pageviews', 'sessions_social'];

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
async function secretOrNull(name: string): Promise<string | null> { try { return await getSecret(name); } catch (_) { return null; } }
type Me = { email: string; name: string; admin: boolean };
async function who(req: Request): Promise<Me | null> {
  try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) return { email: 'automation', name: 'automation', admin: true }; } catch (_) { /* no */ }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  if (auth.slice(7) === SERVICE_KEY) return { email: 'automation', name: 'automation', admin: true };
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  if (!(email.endsWith('@welfareavenue.com') || email === 'steelmacdonald@gmail.com')) return null;
  let admin = false; try { const { data: a } = await asUser.rpc('is_hub_admin'); admin = a === true; } catch (_) { admin = false; }
  const meta = (data?.user?.user_metadata || {}) as Record<string, string>;
  return { email, name: meta.full_name || meta.name || email.split('@')[0], admin };
}

/* ---------- dates ---------- */
function isoDay(d: Date): string { return d.toISOString().slice(0, 10); }
function dayAgo(n: number): string { return isoDay(new Date(Date.now() - n * 86400000)); }
function unix(day: string): number { return Math.floor(new Date(day + 'T00:00:00Z').getTime() / 1000); }
function monday(): string { const d = new Date(); const dow = (d.getUTCDay() + 6) % 7; return isoDay(new Date(d.getTime() - dow * 86400000)); }

/* ---------- writes ---------- */
type Row = { platform: string; account_id: number | null; day: string; metric: string; value: number; source?: string };
async function putDaily(rows: Row[]): Promise<number> {
  const clean = rows.filter(r => r && /^\d{4}-\d{2}-\d{2}$/.test(r.day) && METRICS.indexOf(r.metric) >= 0 && isFinite(Number(r.value)));
  if (!clean.length) return 0;
  const seen = new Set<string>(); const uniq: Row[] = [];
  for (const r of clean) { const k = r.platform + '|' + r.account_id + '|' + r.day + '|' + r.metric; if (seen.has(k)) continue; seen.add(k); uniq.push({ ...r, value: Number(r.value), source: r.source || 'api' }); }
  for (let i = 0; i < uniq.length; i += 400) {
    const chunk = uniq.slice(i, i + 400).map(r => ({ ...r, updated_at: new Date().toISOString() }));
    const { error } = await svc.from('social_daily').upsert(chunk, { onConflict: 'platform,account_id,day,metric' });
    if (error) throw new Error('social_daily: ' + error.message);
  }
  return uniq.length;
}
type Post = { platform: string; account_id: number | null; external_id: string; url?: string | null; kind?: string | null; caption?: string | null; thumb_url?: string | null; published_at?: string | null; reach?: number | null; views?: number | null; likes?: number | null; comments?: number | null; shares?: number | null; saves?: number | null; clicks?: number | null; engagement?: number | null; raw?: Any; source?: string };
async function putPosts(posts: Post[]): Promise<number> {
  const clean = posts.filter(p => p && p.external_id);
  if (!clean.length) return 0;
  const rows = clean.map(p => ({ ...p, caption: p.caption ? String(p.caption).slice(0, 600) : null, engagement: p.engagement != null ? p.engagement : ((p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0)), source: p.source || 'api', updated_at: new Date().toISOString() }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await svc.from('social_posts').upsert(rows.slice(i, i + 200), { onConflict: 'platform,external_id' });
    if (error) throw new Error('social_posts: ' + error.message);
  }
  return rows.length;
}
async function upsertAccount(a: Partial<Account> & { platform: string; external_id: string }): Promise<Account> {
  const { data: cur } = await svc.from('social_accounts').select('*').eq('platform', a.platform).eq('external_id', a.external_id).maybeSingle();
  if (cur) {
    const patch: Record<string, Any> = { ...a, meta: { ...(cur.meta || {}), ...(a.meta || {}) } };
    const { data, error } = await svc.from('social_accounts').update(patch).eq('id', cur.id).select('*').single();
    if (error) throw new Error(error.message);
    return data as Account;
  }
  const { data, error } = await svc.from('social_accounts').insert({ status: 'connected', ...a }).select('*').single();
  if (error) throw new Error(error.message);
  return data as Account;
}
async function markSync(id: number, err: string | null): Promise<void> {
  await svc.from('social_accounts').update({ last_sync_at: new Date().toISOString(), last_error: err, status: err ? 'error' : 'connected' }).eq('id', id);
}

/* ---------- Meta ---------- */
async function graph(path: string, token: string, params: Record<string, string> = {}): Promise<Any> {
  const u = new URL(GRAPH + (path.startsWith('/') ? path : '/' + path));
  for (const k of Object.keys(params)) u.searchParams.set(k, params[k]);
  u.searchParams.set('access_token', token);
  const res = await fetch(u.toString());
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error((body.error && (body.error.message + (body.error.code ? ' (code ' + body.error.code + ')' : ''))) || ('HTTP ' + res.status));
  return body;
}
async function metaPages(token: string): Promise<Any[]> {
  const out: Any[] = [];
  let next: string | null = null;
  const first = await graph('/me/accounts', token, { fields: 'id,name,link,followers_count,picture{url},instagram_business_account{id,username,name,followers_count,media_count,profile_picture_url}', limit: '50' });
  out.push(...(first.data || [])); next = first.paging && first.paging.next ? first.paging.next : null;
  let guard = 0;
  while (next && guard++ < 5) { const r = await fetch(next); const b = await r.json(); out.push(...(b.data || [])); next = b.paging && b.paging.next ? b.paging.next : null; }
  return out;
}
async function pageToken(pageId: string, token: string): Promise<string> {
  const r = await graph('/' + pageId, token, { fields: 'access_token' });
  return r.access_token || token;
}
const FB_METRICS: Array<[string, string]> = [
  ['page_follows', 'followers'], ['page_daily_follows_unique', 'new_followers'], ['page_daily_unfollows_unique', 'unfollows'],
  ['page_post_engagements', 'engagement'], ['page_views_total', 'profile_views'],
  ['page_total_media_view_unique', 'reach'], ['page_media_view', 'views'], ['page_video_views', 'video_views'],
  ['page_impressions_unique', 'reach'],
];
async function syncFacebook(a: Account, token: string, days: number): Promise<{ rows: number; posts: number; skipped: string[] }> {
  const pt = await pageToken(a.external_id!, token);
  const since = dayAgo(days), until = dayAgo(0);
  const rows: Row[] = []; const skipped: string[] = []; const have = new Set<string>();
  for (const [m, metric] of FB_METRICS) {
    if (have.has(metric)) continue;
    try {
      const r = await graph('/' + a.external_id + '/insights', pt, { metric: m, period: 'day', since: String(unix(since)), until: String(unix(until) + 86400) });
      const vals = ((r.data || [])[0] || {}).values || [];
      let n = 0;
      for (const v of vals) { const day = String(v.end_time || '').slice(0, 10); const val = typeof v.value === 'number' ? v.value : Number(v.value); if (day && isFinite(val)) { rows.push({ platform: 'facebook', account_id: a.id, day: isoDay(new Date(new Date(day + 'T00:00:00Z').getTime() - 86400000)), metric, value: val }); n++; } }
      if (n) have.add(metric);
    } catch (e) { skipped.push(m + ': ' + String((e as Error).message).slice(0, 80)); }
  }
  // today's follower count from the Page itself when insights did not give it
  try { const p = await graph('/' + a.external_id, pt, { fields: 'followers_count,name,link,picture{url}' }); if (typeof p.followers_count === 'number') rows.push({ platform: 'facebook', account_id: a.id, day: until, metric: 'followers', value: p.followers_count }); await svc.from('social_accounts').update({ name: p.name || a.name, url: p.link || a.url, picture_url: (p.picture && p.picture.data && p.picture.data.url) || a.picture_url }).eq('id', a.id); } catch (_) { /* fine */ }
  const n = await putDaily(rows);
  // posts
  const posts: Post[] = [];
  try {
    let r: Any;
    try { r = await graph('/' + a.external_id + '/published_posts', pt, { fields: 'id,message,created_time,permalink_url,full_picture,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),insights.metric(post_total_media_view_unique,post_media_view,post_clicks)', limit: '25' }); }
    catch (_) { r = await graph('/' + a.external_id + '/published_posts', pt, { fields: 'id,message,created_time,permalink_url,full_picture,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)', limit: '25' }); }
    for (const p of (r.data || [])) {
      const ins: Record<string, number> = {};
      for (const i of ((p.insights && p.insights.data) || [])) { const v = ((i.values || [])[0] || {}).value; if (typeof v === 'number') ins[i.name] = v; }
      posts.push({ platform: 'facebook', account_id: a.id, external_id: String(p.id), url: p.permalink_url || null, kind: 'post', caption: p.message || null, thumb_url: p.full_picture || null, published_at: p.created_time || null,
        reach: ins.post_total_media_view_unique ?? null, views: ins.post_media_view ?? null, clicks: ins.post_clicks ?? null,
        likes: (p.reactions && p.reactions.summary && p.reactions.summary.total_count) || 0, comments: (p.comments && p.comments.summary && p.comments.summary.total_count) || 0, shares: (p.shares && p.shares.count) || 0, saves: null, raw: null });
    }
  } catch (e) { skipped.push('posts: ' + String((e as Error).message).slice(0, 80)); }
  const np = await putPosts(posts);
  if (np) await putDaily([{ platform: 'facebook', account_id: a.id, day: until, metric: 'posts', value: posts.filter(p => p.published_at && p.published_at >= since).length }]);
  return { rows: n, posts: np, skipped };
}
const IG_TOTAL = ['views', 'profile_views', 'accounts_engaged', 'total_interactions', 'likes', 'comments', 'shares', 'saves'];
const IG_MAP: Record<string, string> = { views: 'views', profile_views: 'profile_views', accounts_engaged: 'accounts_engaged', total_interactions: 'engagement', likes: 'likes', comments: 'comments', shares: 'shares', saves: 'saves' };
async function syncInstagram(a: Account, token: string, days: number): Promise<{ rows: number; posts: number; skipped: string[] }> {
  const ig = a.external_id!;
  const since = dayAgo(days), until = dayAgo(0);
  const rows: Row[] = []; const skipped: string[] = [];
  try { const p = await graph('/' + ig, token, { fields: 'username,name,followers_count,media_count,profile_picture_url' }); if (typeof p.followers_count === 'number') rows.push({ platform: 'instagram', account_id: a.id, day: until, metric: 'followers', value: p.followers_count }); await svc.from('social_accounts').update({ handle: p.username || a.handle, name: p.name || a.name, url: p.username ? 'https://www.instagram.com/' + p.username + '/' : a.url, picture_url: p.profile_picture_url || a.picture_url, meta: { ...(a.meta || {}), media_count: p.media_count } }).eq('id', a.id); } catch (e) { skipped.push('profile: ' + String((e as Error).message).slice(0, 80)); }
  // per-day series: reach and follower_count (new followers per day)
  for (const [m, metric] of [['reach', 'reach'], ['follower_count', 'new_followers']] as Array<[string, string]>) {
    try {
      const r = await graph('/' + ig + '/insights', token, { metric: m, period: 'day', since: String(unix(since)), until: String(unix(until) + 86400) });
      for (const v of (((r.data || [])[0] || {}).values || [])) { const day = String(v.end_time || '').slice(0, 10); const val = typeof v.value === 'number' ? v.value : Number(v.value); if (day && isFinite(val)) rows.push({ platform: 'instagram', account_id: a.id, day: isoDay(new Date(new Date(day + 'T00:00:00Z').getTime() - 86400000)), metric, value: val }); }
    } catch (e) { skipped.push(m + ': ' + String((e as Error).message).slice(0, 80)); }
  }
  // total_value metrics: one call per missing day (at most `days`, newest first)
  const { data: haveRows } = await svc.from('social_daily').select('day').eq('platform', 'instagram').eq('account_id', a.id).eq('metric', 'views').gte('day', since);
  const have = new Set<string>((haveRows || []).map((r: Any) => String(r.day)));
  let calls = 0;
  for (let i = 1; i <= days && calls < 31; i++) {
    const day = dayAgo(i);
    if (have.has(day) && i > 2) continue; // the last two days are refreshed, the rest only filled in
    calls++;
    try {
      const r = await graph('/' + ig + '/insights', token, { metric: IG_TOTAL.join(','), period: 'day', metric_type: 'total_value', since: String(unix(day)), until: String(unix(day) + 86400) });
      for (const m of (r.data || [])) { const v = m.total_value && typeof m.total_value.value === 'number' ? m.total_value.value : null; if (v != null && IG_MAP[m.name]) rows.push({ platform: 'instagram', account_id: a.id, day, metric: IG_MAP[m.name], value: v }); }
    } catch (e) { skipped.push('totals ' + day + ': ' + String((e as Error).message).slice(0, 80)); if (skipped.length > 6) break; }
  }
  const n = await putDaily(rows);
  // media with insights
  const posts: Post[] = [];
  try {
    const r = await graph('/' + ig + '/media', token, { fields: 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count', limit: '30' });
    for (const m of (r.data || [])) {
      const ins: Record<string, number> = {};
      try {
        const metrics = m.media_product_type === 'REELS' ? 'reach,views,saved,shares,total_interactions,likes,comments' : (m.media_type === 'VIDEO' ? 'reach,views,saved,shares,total_interactions' : 'reach,views,saved,shares,total_interactions');
        const ir = await graph('/' + m.id + '/insights', token, { metric: metrics });
        for (const i of (ir.data || [])) { const v = ((i.values || [])[0] || {}).value; if (typeof v === 'number') ins[i.name] = v; }
      } catch (_) { /* some media has no insights (old posts, stories) */ }
      posts.push({ platform: 'instagram', account_id: a.id, external_id: String(m.id), url: m.permalink || null, kind: (m.media_product_type || m.media_type || 'post').toLowerCase(), caption: m.caption || null, thumb_url: m.thumbnail_url || m.media_url || null, published_at: m.timestamp || null,
        reach: ins.reach ?? null, views: ins.views ?? null, likes: m.like_count ?? ins.likes ?? 0, comments: m.comments_count ?? ins.comments ?? 0, shares: ins.shares ?? null, saves: ins.saved ?? null, engagement: ins.total_interactions ?? null, raw: null });
    }
  } catch (e) { skipped.push('media: ' + String((e as Error).message).slice(0, 80)); }
  const np = await putPosts(posts);
  if (np) await putDaily([{ platform: 'instagram', account_id: a.id, day: until, metric: 'posts', value: posts.filter(p => p.published_at && p.published_at >= since).length }]);
  return { rows: n, posts: np, skipped };
}

/* ---------- Google Analytics 4 ---------- */
function b64url(bytes: Uint8Array): string { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function pemToDer(pem: string): Uint8Array { const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, ''); const raw = atob(body); const out = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out; }
async function saToken(scope: string): Promise<{ token: string; email: string }> {
  const sa = JSON.parse(await getSecret('GOOGLE_SA_KEY'));
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(enc.encode(JSON.stringify({ iss: sa.client_email, scope, aud: sa.token_uri, iat: now, exp: now + 3600 })));
  const input = header + '.' + claims;
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(input)));
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: input + '.' + b64url(sig) }) });
  const body = await res.json();
  if (!body.access_token) throw new Error('Google token: ' + String(body.error_description || body.error || 'failed'));
  return { token: body.access_token, email: sa.client_email };
}
async function saEmail(): Promise<string | null> { try { return JSON.parse(await getSecret('GOOGLE_SA_KEY')).client_email || null; } catch (_) { return null; } }
async function ga4Report(propertyId: string, token: string, body: Any): Promise<Any> {
  const res = await fetch('https://analyticsdata.googleapis.com/v1beta/properties/' + propertyId + ':runReport', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const b = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((b.error && b.error.message) || ('GA4 HTTP ' + res.status));
  return b;
}
async function syncGa4(a: Account, days: number): Promise<{ rows: number; posts: number; skipped: string[] }> {
  const { token } = await saToken('https://www.googleapis.com/auth/analytics.readonly');
  const pid = a.external_id!;
  const rows: Row[] = []; const skipped: string[] = [];
  const range = [{ startDate: days + 'daysAgo', endDate: 'yesterday' }];
  const r = await ga4Report(pid, token, { dateRanges: range, dimensions: [{ name: 'date' }], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'newUsers' }, { name: 'screenPageViews' }], limit: 400 });
  for (const row of (r.rows || [])) {
    const d = row.dimensionValues[0].value; const day = d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8);
    const v = row.metricValues.map((m: Any) => Number(m.value));
    rows.push({ platform: 'ga4', account_id: a.id, day, metric: 'sessions', value: v[0] }, { platform: 'ga4', account_id: a.id, day, metric: 'users', value: v[1] }, { platform: 'ga4', account_id: a.id, day, metric: 'new_users', value: v[2] }, { platform: 'ga4', account_id: a.id, day, metric: 'pageviews', value: v[3] });
  }
  try {
    const s = await ga4Report(pid, token, { dateRanges: range, dimensions: [{ name: 'date' }, { name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }], dimensionFilter: { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Organic Social' } } }, limit: 400 });
    for (const row of (s.rows || [])) { const d = row.dimensionValues[0].value; const day = d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8); rows.push({ platform: 'ga4', account_id: a.id, day, metric: 'sessions_social', value: Number(row.metricValues[0].value) }); }
  } catch (e) { skipped.push('channels: ' + String((e as Error).message).slice(0, 80)); }
  const n = await putDaily(rows);
  const posts: Post[] = [];
  try {
    const p = await ga4Report(pid, token, { dateRanges: range, dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }], metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 20 });
    const site = (a.meta && a.meta.site) ? String(a.meta.site).replace(/\/$/, '') : '';
    for (const row of (p.rows || [])) { const path = row.dimensionValues[0].value; posts.push({ platform: 'ga4', account_id: a.id, external_id: path, url: site ? site + path : null, kind: 'page', caption: row.dimensionValues[1].value || path, published_at: dayAgo(1) + 'T12:00:00Z', views: Number(row.metricValues[0].value), reach: Number(row.metricValues[1].value), likes: 0, comments: 0, shares: 0, engagement: 0 }); }
  } catch (e) { skipped.push('pages: ' + String((e as Error).message).slice(0, 80)); }
  const np = await putPosts(posts);
  return { rows: n, posts: np, skipped };
}

/* ---------- the sync ---------- */
async function syncAccount(a: Account, days: number): Promise<Any> {
  const started = Date.now();
  try {
    let out: { rows: number; posts: number; skipped: string[] };
    if (a.platform === 'facebook' || a.platform === 'instagram') {
      const token = await getSecret('META_SYSTEM_TOKEN');
      out = a.platform === 'facebook' ? await syncFacebook(a, token, days) : await syncInstagram(a, token, days);
    } else if (a.platform === 'ga4') out = await syncGa4(a, days);
    else return { id: a.id, platform: a.platform, skipped: 'csv platform' };
    const err = out.rows === 0 && out.posts === 0 && out.skipped.length ? out.skipped.join(' | ').slice(0, 400) : null;
    await markSync(a.id, err);
    return { id: a.id, platform: a.platform, ...out, ms: Date.now() - started };
  } catch (e) {
    const msg = String((e as Error).message || e).slice(0, 400);
    await markSync(a.id, msg);
    return { id: a.id, platform: a.platform, error: msg, ms: Date.now() - started };
  }
}

/* ---------- the note ---------- */
function fmt(n: Any): string { const v = Number(n); if (!isFinite(v)) return '0'; return v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : String(Math.round(v)); }
async function writeNote(days: number): Promise<Any> {
  const { data: ov, error } = await svc.rpc('social_overview', { p_days: days });
  if (error) throw new Error(error.message);
  const o = ov as Any;
  const lines: string[] = [];
  for (const p of Object.keys(o.totals || {})) {
    const t = o.totals[p]; const f = (o.followers || {})[p];
    const parts: string[] = [];
    if (f && f.now != null) parts.push('followers ' + fmt(f.now) + (f.then != null ? ' (' + (Number(f.now) - Number(f.then) >= 0 ? '+' : '') + fmt(Number(f.now) - Number(f.then)) + ' vs ' + days + ' days ago)' : ''));
    for (const m of ['reach', 'views', 'engagement', 'profile_views', 'sessions', 'users', 'sessions_social']) if (t[m] && t[m].cur != null) parts.push(m.replace('_', ' ') + ' ' + fmt(t[m].cur) + (t[m].prev ? ' (prev ' + fmt(t[m].prev) + ')' : ''));
    if (parts.length) lines.push(p + ': ' + parts.join(', '));
  }
  const top = (o.posts || []).slice(0, 6).map((p: Any) => p.platform + ' | ' + String(p.caption || p.kind || '').replace(/\s+/g, ' ').slice(0, 90) + ' | reach ' + fmt(p.reach) + ' views ' + fmt(p.views) + ' likes ' + fmt(p.likes) + ' comments ' + fmt(p.comments) + ' shares ' + fmt(p.shares) + ' saves ' + fmt(p.saves));
  if (!lines.length) return { skipped: 'no numbers yet' };
  const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
    method: 'POST', headers: { Authorization: 'Bearer ' + SERVICE_KEY, 'x-wa-task': 'digest', 'x-wa-caller': 'social-pull', 'Content-Type': 'application/json' },
    body: JSON.stringify({ max_tokens: 700, temperature: 0.4,
      system: 'You write the weekly social media note for the marketing team of Welfare Avenue, a charity in Montreal and Toronto. Plain, specific, warm, no em dashes, no hashtags, no exclamation marks. Three to five sentences: what moved and why it probably moved, the post that worked best and what it had, one concrete thing to try this week. Only use the numbers given; never invent.',
      messages: [{ role: 'user', content: 'Last ' + days + ' days against the ' + days + ' before:\n' + lines.join('\n') + '\n\nTop posts:\n' + (top.join('\n') || 'none') }],
      tools: [{ name: 'note', description: 'The note.', input_schema: { type: 'object', properties: { body: { type: 'string' } }, required: ['body'] } }], tool_choice: { type: 'tool', name: 'note' } })
  });
  const body = await res.json().catch(() => ({}));
  const tu = (body.content || []).find((c: Any) => c.type === 'tool_use');
  const text = tu && tu.input && tu.input.body ? String(tu.input.body).replace(/—/g, ',').trim() : '';
  if (!text) return { skipped: 'model gave nothing', status: res.status };
  const { data, error: e2 } = await svc.from('social_notes').insert({ week_start: monday(), platform: null, body: text, model: (body._wa && body._wa.model) || body.model || null }).select('*').single();
  if (e2) throw new Error(e2.message);
  return { note: data };
}

/* ---------- CSV rows ---------- */
async function importCsv(body: Any, me: Me): Promise<Any> {
  const platform = String(body.platform || '');
  if (['tiktok', 'linkedin', 'facebook', 'instagram', 'youtube'].indexOf(platform) < 0) throw new Error('platform');
  const handle = body.handle ? String(body.handle).slice(0, 80) : null;
  const { data: cur } = await svc.from('social_accounts').select('*').eq('platform', platform).order('id').limit(1).maybeSingle();
  let acc = cur as Account | null;
  if (!acc) { const { data, error } = await svc.from('social_accounts').insert({ platform, external_id: 'csv', handle, name: handle, status: 'csv', meta: { by: me.email } }).select('*').single(); if (error) throw new Error(error.message); acc = data as Account; }
  else if (handle && !acc.handle) await svc.from('social_accounts').update({ handle, name: acc.name || handle }).eq('id', acc.id);
  const rows: Row[] = (Array.isArray(body.rows) ? body.rows : []).slice(0, 5000).map((r: Any) => ({ platform, account_id: acc!.id, day: String(r.day || '').slice(0, 10), metric: String(r.metric || ''), value: Number(r.value), source: 'csv' }));
  const n = await putDaily(rows);
  const posts: Post[] = (Array.isArray(body.posts) ? body.posts : []).slice(0, 500).map((p: Any) => ({ platform, account_id: acc!.id, external_id: String(p.external_id || p.url || '').slice(0, 300), url: p.url ? String(p.url).slice(0, 500) : null, kind: p.kind ? String(p.kind).slice(0, 40) : 'post', caption: p.caption ? String(p.caption).slice(0, 600) : null, thumb_url: null, published_at: p.published_at || null, reach: p.reach != null ? Number(p.reach) : null, views: p.views != null ? Number(p.views) : null, likes: p.likes != null ? Number(p.likes) : null, comments: p.comments != null ? Number(p.comments) : null, shares: p.shares != null ? Number(p.shares) : null, saves: p.saves != null ? Number(p.saves) : null, source: 'csv' }));
  const np = await putPosts(posts);
  await svc.from('social_accounts').update({ last_sync_at: new Date().toISOString(), last_error: null, status: acc.status === 'connected' ? 'connected' : 'csv' }).eq('id', acc.id);
  return { ok: true, account_id: acc.id, rows: n, posts: np };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const me = await who(req);
  if (!me) return json({ error: 'not allowed' }, 401);
  let body: Any = {};
  try { body = await req.json(); } catch (_) { body = {}; }
  const action = String(body.action || 'status');
  try {
    if (action === 'status') {
      const { data } = await svc.from('social_accounts').select('*').order('platform');
      return json({ ok: true, accounts: data || [], meta_token: !!(await secretOrNull('META_SYSTEM_TOKEN')), sa_email: await saEmail() });
    }
    if (action === 'probe') {
      const out: Any = { ok: true, sa_email: await saEmail() };
      const token = await secretOrNull('META_SYSTEM_TOKEN');
      if (!token) out.meta = { ok: false, error: 'META_SYSTEM_TOKEN is not in the vault yet' };
      else {
        try {
          const me2 = await graph('/me', token, { fields: 'id,name' });
          const pages = await metaPages(token);
          out.meta = { ok: true, as: me2.name || me2.id, pages: pages.map(p => ({ id: p.id, name: p.name, link: p.link, followers: p.followers_count, picture: p.picture && p.picture.data && p.picture.data.url, instagram: p.instagram_business_account ? { id: p.instagram_business_account.id, username: p.instagram_business_account.username, followers: p.instagram_business_account.followers_count, media: p.instagram_business_account.media_count } : null })) };
        } catch (e) { out.meta = { ok: false, error: String((e as Error).message) }; }
      }
      const { data } = await svc.from('social_accounts').select('*').order('platform');
      out.accounts = data || [];
      return json(out);
    }
    if (action === 'connect_meta') {
      const token = await getSecret('META_SYSTEM_TOKEN');
      const pages = await metaPages(token);
      const want = body.page_id ? pages.filter(p => String(p.id) === String(body.page_id)) : pages;
      if (!want.length) return json({ error: 'no page found' + (body.page_id ? ' with id ' + body.page_id : '. Give the system user the Page in Business settings > System users > Add assets.') }, 400);
      const added: Any[] = [];
      for (const p of want) {
        const fb = await upsertAccount({ platform: 'facebook', external_id: String(p.id), name: p.name, handle: null, url: p.link || null, picture_url: (p.picture && p.picture.data && p.picture.data.url) || null, status: 'connected', meta: { by: me.email } });
        added.push(fb);
        if (p.instagram_business_account) {
          const ig = p.instagram_business_account;
          added.push(await upsertAccount({ platform: 'instagram', external_id: String(ig.id), name: ig.name || ig.username, handle: ig.username || null, url: ig.username ? 'https://www.instagram.com/' + ig.username + '/' : null, picture_url: ig.profile_picture_url || null, status: 'connected', meta: { by: me.email, page_id: String(p.id) } }));
        }
      }
      const results: Any[] = [];
      for (const a of added) results.push(await syncAccount(a as Account, Number(body.days) || 30));
      return json({ ok: true, added, results });
    }
    if (action === 'connect_ga4') {
      const pid = String(body.property_id || '').replace(/\D/g, '');
      if (!pid) return json({ error: 'property_id (the number in GA4 Admin > Property details)' }, 400);
      const acc = await upsertAccount({ platform: 'ga4', external_id: pid, name: body.name ? String(body.name).slice(0, 80) : 'Website (GA4 ' + pid + ')', handle: null, url: body.site ? String(body.site).slice(0, 200) : null, status: 'connected', meta: { by: me.email, site: body.site ? String(body.site).slice(0, 200) : null } });
      const r = await syncAccount(acc, Number(body.days) || 30);
      return json({ ok: !r.error, account: acc, result: r, sa_email: await saEmail() });
    }
    if (action === 'disconnect') {
      const id = Number(body.account_id);
      if (!id) return json({ error: 'account_id' }, 400);
      const { error } = await svc.from('social_accounts').delete().eq('id', id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    if (action === 'sync') {
      const days = Math.max(2, Math.min(90, Number(body.days) || 30));
      let q = svc.from('social_accounts').select('*').in('status', ['connected', 'error']);
      if (body.account_id) q = q.eq('id', Number(body.account_id));
      const { data } = await q;
      const results: Any[] = [];
      for (const a of ((data || []) as Account[])) results.push(await syncAccount(a, days));
      return json({ ok: true, results });
    }
    if (action === 'import_csv') return json(await importCsv(body, me));
    if (action === 'note') return json({ ok: true, ...(await writeNote(Math.max(7, Math.min(30, Number(body.days) || 7)))) });
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
