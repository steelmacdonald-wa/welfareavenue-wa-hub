// Welfare Avenue: social-inbox (v2, 15/10/26, wave251; v1 09/10/26, wave225 the Content Studio)
// The Content Studio's comments inbox: comments on Welfare Avenue's own posts on Instagram, Facebook, Threads and YouTube,
// read every 10 minutes (cron wa-social-inbox) and answered from the Hub. Steel (09/10/26): the marketing team and admins
// reply, like, hide and resolve; deleting is marketing leads and admins.
// Why polling: Meta only sends live comment alerts to apps that are Live, and Instagram's need an App Review; reading every
// 10 minutes needs neither (the comments arrive within 10 minutes). Since wave250 meta-events also asks for a sync (7 days)
// when Meta reports a comment, at most once a minute.
// v2 (wave251): each sync also asks social-dms for the direct messages (dm_sync, 14 days), so the one 10-minute cron reads both.
// Auth: verify_jwt off; automation with x-wa-secret (sync), or a signed-in staff member: wa225_marketing() for reply, like,
// hide, unhide, resolve, reopen, assign and sync; wa225_publisher() for delete. Everything is written with the service key
// into social_comments (the page reads it through row security) and one change_log line per action (never the comment text).
// Actions (POST): sync {days?}, reply {id, text}, like {id}, hide {id}, unhide {id}, delete {id}, resolve {id}, reopen {id},
//   assign {id, to}, status.
// Tables: social_comments (write), social_posts and content_posts (read, to link a comment to its post), social_accounts,
// hub_settings studio_connections, change_log. Vault: META_SYSTEM_TOKEN, SOCIAL_THREADS_TOKEN, SOCIAL_YOUTUBE_CLIENT,
// SOCIAL_YOUTUBE_REFRESH. Side effects: replies, likes, hides and deletes on the platforms, as asked.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const GRAPH = 'https://graph.facebook.com/v23.0';
const THREADS = 'https://graph.threads.net/v1.0';
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
async function secretOrNull(name: string): Promise<string | null> { try { const v = await getSecret(name); return v || null; } catch (_) { return null; } }
type Me = { email: string; name: string; marketing: boolean; publisher: boolean; auto: boolean };
async function caller(req: Request): Promise<Me | null> {
  try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) return { email: 'automation', name: 'automation', marketing: true, publisher: true, auto: true }; } catch (_) { /* no */ }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = String(data?.user?.email || '').toLowerCase();
  if (!email) return null;
  const { data: ok } = await asUser.rpc('is_wa_staff'); if (ok !== true) return null;
  const { data: mk } = await asUser.rpc('wa225_marketing');
  const { data: pub } = await asUser.rpc('wa225_publisher');
  const meta = (data?.user?.user_metadata || {}) as Record<string, string>;
  return { email, name: meta.full_name || meta.name || email.split('@')[0], marketing: mk === true, publisher: pub === true, auto: false };
}
async function graph(method: 'GET' | 'POST' | 'DELETE', path: string, token: string, params: Record<string, string> = {}, base = GRAPH): Promise<Any> {
  const u = new URL(path.startsWith('http') ? path : base + (path.startsWith('/') ? path : '/' + path));
  const body = new URLSearchParams();
  for (const k of Object.keys(params)) { if (method === 'POST') body.set(k, params[k]); else u.searchParams.set(k, params[k]); }
  if (method === 'POST') body.set('access_token', token); else if (!u.searchParams.has('access_token')) u.searchParams.set('access_token', token);
  const res = await fetch(u.toString(), method === 'POST' ? { method, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() } : { method });
  const b = await res.json().catch(() => ({}));
  if (!res.ok || b.error) { const e = b.error || {}; throw new Error((e.error_user_msg || e.message || ('HTTP ' + res.status)) + (e.code ? ' (code ' + e.code + ')' : '')); }
  return b;
}
async function meta(): Promise<{ token: string; page: { id: string; token: string } | null; ig: { id: string; handle: string } | null } | null> {
  const token = await secretOrNull('META_SYSTEM_TOKEN'); if (!token) return null;
  const { data: accs } = await svc.from('social_accounts').select('*').in('platform', ['facebook', 'instagram']).in('status', ['connected', 'error']);
  const fb = ((accs || []) as Any[]).find(a => a.platform === 'facebook');
  const ig = ((accs || []) as Any[]).find(a => a.platform === 'instagram');
  let page: { id: string; token: string } | null = null;
  if (fb) { let pt = token; try { const r = await graph('GET', '/' + fb.external_id, token, { fields: 'access_token' }); pt = r.access_token || token; } catch (_) { /* already a page token */ } page = { id: String(fb.external_id), token: pt }; }
  return { token, page, ig: ig ? { id: String(ig.external_id), handle: String(ig.handle || '') } : null };
}
async function conns(): Promise<Record<string, Any>> { const { data } = await svc.from('hub_settings').select('value').eq('key', 'studio_connections').maybeSingle(); return ((data && data.value) || {}) as Record<string, Any>; }
async function googleToken(): Promise<string | null> {
  const cl = await secretOrNull('SOCIAL_YOUTUBE_CLIENT'); const rt = await secretOrNull('SOCIAL_YOUTUBE_REFRESH'); if (!cl || !rt) return null;
  const c = JSON.parse(cl);
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, refresh_token: rt, grant_type: 'refresh_token' }).toString() });
  const b = await r.json(); return b.access_token ? String(b.access_token) : null;
}

/* ---------- reading ---------- */
type Row = { platform: string; external_id: string; media_external_id: string | null; parent_external_id: string | null; author_name: string | null; author_handle: string | null; author_id: string | null; text: string | null; commented_at: string | null; like_count: number | null; from_us: boolean; hidden: boolean; permalink: string | null; raw?: Any };
async function linkPosts(rows: Row[]): Promise<Map<string, { sp: number | null; cp: number | null }>> {
  const keys = Array.from(new Set(rows.map(r => r.platform + '|' + r.media_external_id).filter(k => !/\|null$/.test(k))));
  const out = new Map<string, { sp: number | null; cp: number | null }>();
  if (!keys.length) return out;
  const ids = keys.map(k => k.split('|')[1]);
  const { data: sp } = await svc.from('social_posts').select('id, platform, external_id').in('external_id', ids.concat(ids.map(i => i.split('_').pop() || i)));
  const { data: cp } = await svc.from('content_posts').select('id, results').in('status', ['published', 'posted', 'failed', 'publishing']).gte('updated_at', new Date(Date.now() - 120 * 86400000).toISOString());
  for (const k of keys) {
    const [pl, mid] = k.split('|');
    const s = ((sp || []) as Any[]).find(x => x.platform === pl && (String(x.external_id) === mid || String(x.external_id).split('_').pop() === mid.split('_').pop()));
    const c = ((cp || []) as Any[]).find(x => x.results && x.results[pl] && x.results[pl].id && (String(x.results[pl].id) === mid || String(x.results[pl].id).split('_').pop() === mid.split('_').pop()));
    out.set(k, { sp: s ? Number(s.id) : null, cp: c ? Number(c.id) : null });
  }
  return out;
}
async function store(rows: Row[]): Promise<{ added: number; updated: number }> {
  if (!rows.length) return { added: 0, updated: 0 };
  const links = await linkPosts(rows);
  let added = 0, updated = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { data: ex } = await svc.from('social_comments').select('id, platform, external_id, status, like_count, hidden, text').in('external_id', batch.map(r => r.external_id));
    const have = new Map(((ex || []) as Any[]).map(e => [e.platform + '|' + e.external_id, e]));
    const fresh: Any[] = [];
    for (const r of batch) {
      const k = r.platform + '|' + r.external_id; const l = links.get(r.platform + '|' + r.media_external_id) || { sp: null, cp: null };
      const e = have.get(k);
      if (!e) { fresh.push({ ...r, social_post_id: l.sp, content_post_id: l.cp, status: r.from_us ? 'resolved' : (r.hidden ? 'hidden' : 'open'), fetched_at: new Date().toISOString() }); continue; }
      if (e.like_count !== r.like_count || e.hidden !== r.hidden || e.text !== r.text) {
        await svc.from('social_comments').update({ like_count: r.like_count, hidden: r.hidden, text: r.text, updated_at: new Date().toISOString(), status: r.hidden && e.status === 'open' ? 'hidden' : e.status }).eq('id', e.id); updated++;
      }
    }
    if (fresh.length) { const ins = await svc.from('social_comments').insert(fresh); if (!ins.error) added += fresh.length; }
  }
  /* our replies close the comment they answer */
  const ours = rows.filter(r => r.from_us && r.parent_external_id);
  for (const r of ours) await svc.from('social_comments').update({ status: 'resolved', replied_at: r.commented_at, updated_at: new Date().toISOString() }).eq('platform', r.platform).eq('external_id', r.parent_external_id!).eq('status', 'open');
  return { added, updated };
}
async function readInstagram(m: { token: string; page: { id: string; token: string } | null; ig: { id: string; handle: string } | null }, days: number): Promise<Row[]> {
  if (!m.ig) return [];
  const tok = m.page ? m.page.token : m.token; const since = Date.now() - days * 86400000; const rows: Row[] = [];
  const media = await graph('GET', '/' + m.ig.id + '/media', tok, { fields: 'id,permalink,timestamp,comments_count', limit: '50' });
  for (const md of ((media.data || []) as Any[])) {
    if (new Date(md.timestamp).getTime() < since) continue;
    if (!md.comments_count) continue;
    const cs = await graph('GET', '/' + md.id + '/comments', tok, { fields: 'id,text,timestamp,username,like_count,hidden,from{id,username},replies{id,text,timestamp,username,like_count,hidden,from{id,username}}', limit: '50' });
    for (const c of ((cs.data || []) as Any[])) {
      const u = c.username || (c.from && c.from.username) || '';
      rows.push({ platform: 'instagram', external_id: String(c.id), media_external_id: String(md.id), parent_external_id: null, author_name: u, author_handle: u, author_id: c.from ? String(c.from.id || '') : null, text: c.text || '', commented_at: c.timestamp || null, like_count: c.like_count ?? null, from_us: !!m.ig.handle && u.toLowerCase() === m.ig.handle.toLowerCase(), hidden: !!c.hidden, permalink: md.permalink || null });
      for (const rp of (((c.replies && c.replies.data) || []) as Any[])) {
        const ru = rp.username || (rp.from && rp.from.username) || '';
        rows.push({ platform: 'instagram', external_id: String(rp.id), media_external_id: String(md.id), parent_external_id: String(c.id), author_name: ru, author_handle: ru, author_id: rp.from ? String(rp.from.id || '') : null, text: rp.text || '', commented_at: rp.timestamp || null, like_count: rp.like_count ?? null, from_us: !!m.ig.handle && ru.toLowerCase() === m.ig.handle.toLowerCase(), hidden: !!rp.hidden, permalink: md.permalink || null });
      }
    }
  }
  return rows;
}
async function readFacebook(m: { token: string; page: { id: string; token: string } | null }, days: number): Promise<Row[]> {
  if (!m.page) return [];
  const pg = m.page; const rows: Row[] = [];
  const since = Math.floor((Date.now() - days * 86400000) / 1000);
  const posts = await graph('GET', '/' + pg.id + '/posts', pg.token, { fields: 'id,permalink_url,created_time,comments.summary(true).limit(0)', since: String(since), limit: '50' });
  for (const p of ((posts.data || []) as Any[])) {
    const n = p.comments && p.comments.summary ? Number(p.comments.summary.total_count || 0) : 0;
    if (!n) continue;
    const cs = await graph('GET', '/' + p.id + '/comments', pg.token, { fields: 'id,message,created_time,from,like_count,is_hidden,parent{id},permalink_url', filter: 'stream', limit: '100' });
    for (const c of ((cs.data || []) as Any[])) {
      const from = c.from || {};
      rows.push({ platform: 'facebook', external_id: String(c.id), media_external_id: String(p.id), parent_external_id: c.parent ? String(c.parent.id) : null, author_name: from.name || null, author_handle: null, author_id: from.id ? String(from.id) : null, text: c.message || '', commented_at: c.created_time || null, like_count: c.like_count ?? null, from_us: String(from.id || '') === pg.id, hidden: !!c.is_hidden, permalink: c.permalink_url || p.permalink_url || null });
    }
  }
  return rows;
}
async function readThreads(days: number): Promise<Row[]> {
  const tok = await secretOrNull('SOCIAL_THREADS_TOKEN'); const c = (await conns()).threads || {};
  if (!tok || !c.user_id) return [];
  const rows: Row[] = []; const since = Date.now() - days * 86400000;
  const th = await graph('GET', '/' + c.user_id + '/threads', tok, { fields: 'id,permalink,timestamp', limit: '30' }, THREADS);
  for (const t of ((th.data || []) as Any[])) {
    if (new Date(t.timestamp).getTime() < since) continue;
    const rp = await graph('GET', '/' + t.id + '/conversation', tok, { fields: 'id,text,username,timestamp,hide_status,replied_to{id},permalink', reverse: 'false' }, THREADS);
    for (const r of ((rp.data || []) as Any[])) {
      const u = String(r.username || '');
      rows.push({ platform: 'threads', external_id: String(r.id), media_external_id: String(t.id), parent_external_id: r.replied_to && String(r.replied_to.id) !== String(t.id) ? String(r.replied_to.id) : null, author_name: u, author_handle: u, author_id: null, text: r.text || '', commented_at: r.timestamp || null, like_count: null, from_us: !!c.username && u.toLowerCase() === String(c.username).toLowerCase(), hidden: String(r.hide_status || '') === 'HIDDEN', permalink: r.permalink || t.permalink || null });
    }
  }
  return rows;
}
async function readYouTube(days: number): Promise<Row[]> {
  const c = (await conns()).youtube || {}; if (!c.channel_id) return [];
  const tok = await googleToken(); if (!tok) return [];
  const rows: Row[] = []; const since = Date.now() - days * 86400000;
  const r = await (await fetch('https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&maxResults=100&allThreadsRelatedToChannelId=' + encodeURIComponent(c.channel_id), { headers: { Authorization: 'Bearer ' + tok } })).json();
  for (const t of ((r.items || []) as Any[])) {
    const top = t.snippet.topLevelComment; const s = top.snippet;
    if (new Date(s.publishedAt).getTime() < since) continue;
    rows.push({ platform: 'youtube', external_id: String(top.id), media_external_id: String(t.snippet.videoId || ''), parent_external_id: null, author_name: s.authorDisplayName || null, author_handle: s.authorDisplayName || null, author_id: s.authorChannelId ? String(s.authorChannelId.value || '') : null, text: s.textOriginal || '', commented_at: s.publishedAt, like_count: s.likeCount ?? null, from_us: !!(s.authorChannelId && s.authorChannelId.value === c.channel_id), hidden: s.moderationStatus === 'heldForReview', permalink: 'https://www.youtube.com/watch?v=' + t.snippet.videoId + '&lc=' + top.id });
    for (const rp of (((t.replies && t.replies.comments) || []) as Any[])) {
      const q = rp.snippet;
      rows.push({ platform: 'youtube', external_id: String(rp.id), media_external_id: String(t.snippet.videoId || ''), parent_external_id: String(top.id), author_name: q.authorDisplayName || null, author_handle: q.authorDisplayName || null, author_id: q.authorChannelId ? String(q.authorChannelId.value || '') : null, text: q.textOriginal || '', commented_at: q.publishedAt, like_count: q.likeCount ?? null, from_us: !!(q.authorChannelId && q.authorChannelId.value === c.channel_id), hidden: false, permalink: 'https://www.youtube.com/watch?v=' + t.snippet.videoId + '&lc=' + rp.id });
    }
  }
  return rows;
}
async function sync(days: number): Promise<Any> {
  const out: Any = { ok: true, platforms: {} };
  const m = await meta();
  const jobs: Array<[string, () => Promise<Row[]>]> = [];
  if (m) { jobs.push(['instagram', () => readInstagram(m, days)]); jobs.push(['facebook', () => readFacebook(m, days)]); }
  jobs.push(['threads', () => readThreads(days)]); jobs.push(['youtube', () => readYouTube(days)]);
  for (const [pl, fn] of jobs) {
    try { const rows = await fn(); const s = await store(rows); out.platforms[pl] = { read: rows.length, ...s }; }
    catch (e) { out.platforms[pl] = { error: String((e as Error).message || e).slice(0, 200) }; }
  }
  try { await svc.from('hub_settings').upsert({ key: 'studio_inbox_sync', value: { at: new Date().toISOString(), result: out.platforms }, updated_at: new Date().toISOString(), updated_by: 'social-inbox' }); } catch (_) { /* fine */ }
  /* wave251: the direct messages, read by social-dms */
  if (days >= 14) {
    try {
      const sec = await getSecret('WA_TRIGGER_SECRET');
      const r = await fetch(SUPABASE_URL + '/functions/v1/social-dms', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-wa-secret': sec, Authorization: 'Bearer ' + ANON_KEY }, body: JSON.stringify({ action: 'dm_sync', days: 14 }) });
      const b = await r.json().catch(() => ({})); out.messages = r.ok ? b.messages : { error: String(b.error || r.status) };
    } catch (e) { out.messages = { error: String((e as Error).message || e).slice(0, 200) }; }
  }
  return out;
}

/* ---------- acting ---------- */
async function act(action: string, c: Any, me: Me, body: Any): Promise<Any> {
  const pl = String(c.platform);
  const m = (pl === 'instagram' || pl === 'facebook') ? await meta() : null;
  const pageTok = m ? (m.page ? m.page.token : m.token) : '';
  if ((pl === 'instagram' || pl === 'facebook') && !m) throw new Error('Meta is not connected');
  const now = new Date().toISOString();
  if (action === 'reply') {
    const text = String(body.text || '').trim(); if (!text) throw new Error('Write the reply first');
    if (text.length > 2000) throw new Error('Replies stop at 2,000 characters');
    let newId = '';
    if (pl === 'instagram') { const r = await graph('POST', '/' + c.external_id + '/replies', pageTok, { message: text }); newId = String(r.id || ''); }
    else if (pl === 'facebook') { const r = await graph('POST', '/' + c.external_id + '/comments', pageTok, { message: text }); newId = String(r.id || ''); }
    else if (pl === 'threads') {
      const tok = await getSecret('SOCIAL_THREADS_TOKEN'); const cn = (await conns()).threads || {};
      const r = await graph('POST', '/' + cn.user_id + '/threads', tok, { media_type: 'TEXT', text, reply_to_id: c.external_id }, THREADS);
      await new Promise(res => setTimeout(res, 2000));
      const p = await graph('POST', '/' + cn.user_id + '/threads_publish', tok, { creation_id: String(r.id) }, THREADS); newId = String(p.id || '');
    } else if (pl === 'youtube') {
      const tok = await googleToken(); if (!tok) throw new Error('YouTube is not connected');
      const r = await fetch('https://www.googleapis.com/youtube/v3/comments?part=snippet', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ snippet: { parentId: c.parent_external_id || c.external_id, textOriginal: text } }) });
      const b = await r.json(); if (!r.ok) throw new Error('YouTube: ' + ((b.error && b.error.message) || r.status)); newId = String(b.id || '');
    } else throw new Error('Replies on ' + pl + ' are not connected yet');
    await svc.from('social_comments').update({ status: 'resolved', replied_at: now, replied_by: me.name, reply_text: text, updated_at: now }).eq('id', c.id);
    if (newId) await svc.from('social_comments').insert({ platform: pl, external_id: newId, media_external_id: c.media_external_id, parent_external_id: c.external_id, social_post_id: c.social_post_id, content_post_id: c.content_post_id, author_name: 'Welfare Avenue', author_handle: null, text, commented_at: now, from_us: true, status: 'resolved', replied_by: me.name, permalink: c.permalink });
    return { ok: true, id: newId };
  }
  if (action === 'like') {
    if (pl !== 'facebook') throw new Error((pl === 'instagram' ? 'Instagram' : pl) + ' does not let apps like comments; like it in the app');
    await graph('POST', '/' + c.external_id + '/likes', pageTok);
    await svc.from('social_comments').update({ liked_by_us: true, updated_at: now }).eq('id', c.id);
    return { ok: true };
  }
  if (action === 'hide' || action === 'unhide') {
    const h = action === 'hide';
    if (pl === 'instagram') await graph('POST', '/' + c.external_id, pageTok, { hide: h ? 'true' : 'false' });
    else if (pl === 'facebook') await graph('POST', '/' + c.external_id, pageTok, { is_hidden: h ? 'true' : 'false' });
    else if (pl === 'threads') { const tok = await getSecret('SOCIAL_THREADS_TOKEN'); await graph('POST', '/' + c.external_id + '/manage_reply', tok, { hide: h ? 'true' : 'false' }, THREADS); }
    else if (pl === 'youtube') { const tok = await googleToken(); if (!tok) throw new Error('YouTube is not connected'); const r = await fetch('https://www.googleapis.com/youtube/v3/comments/setModerationStatus?id=' + encodeURIComponent(c.external_id) + '&moderationStatus=' + (h ? 'heldForReview' : 'published'), { method: 'POST', headers: { Authorization: 'Bearer ' + tok } }); if (!r.ok) throw new Error('YouTube: HTTP ' + r.status); }
    else throw new Error('Not connected');
    await svc.from('social_comments').update({ hidden: h, status: h ? 'hidden' : 'open', updated_at: now }).eq('id', c.id);
    return { ok: true };
  }
  if (action === 'delete') {
    if (!me.publisher) throw new Error('Only marketing leads and admins delete comments');
    if (pl === 'instagram' || pl === 'facebook') await graph('DELETE', '/' + c.external_id, pageTok);
    else if (pl === 'threads') { const tok = await getSecret('SOCIAL_THREADS_TOKEN'); await graph('POST', '/' + c.external_id + '/manage_reply', tok, { hide: 'true' }, THREADS); }
    else if (pl === 'youtube') { const tok = await googleToken(); if (!tok) throw new Error('YouTube is not connected'); const r = await fetch('https://www.googleapis.com/youtube/v3/comments/setModerationStatus?id=' + encodeURIComponent(c.external_id) + '&moderationStatus=rejected', { method: 'POST', headers: { Authorization: 'Bearer ' + tok } }); if (!r.ok) throw new Error('YouTube: HTTP ' + r.status); }
    await svc.from('social_comments').update({ status: 'deleted', hidden: true, updated_at: now }).eq('id', c.id);
    return { ok: true };
  }
  if (action === 'resolve' || action === 'reopen') { await svc.from('social_comments').update({ status: action === 'resolve' ? 'resolved' : 'open', updated_at: now }).eq('id', c.id); return { ok: true }; }
  if (action === 'assign') { await svc.from('social_comments').update({ assigned_to: String(body.to || '').slice(0, 120) || null, updated_at: now }).eq('id', c.id); return { ok: true }; }
  throw new Error('unknown action');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const me = await caller(req);
  if (!me) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({})) as Any;
  const action = String(body.action || 'status');
  try {
    if (action === 'status') { const { data } = await svc.from('hub_settings').select('value').eq('key', 'studio_inbox_sync').maybeSingle(); return json({ ok: true, last: data ? data.value : null, can_reply: me.marketing, can_delete: me.publisher }); }
    if (!me.marketing) return json({ error: 'The comments inbox is for the marketing team and admins' }, 403);
    if (action === 'sync') return json(await sync(Math.max(1, Math.min(90, Number(body.days) || 45))));
    const id = Number(body.id); if (!id) return json({ error: 'which comment?' }, 400);
    const { data: c } = await svc.from('social_comments').select('*').eq('id', id).maybeSingle();
    if (!c) return json({ error: 'not found' }, 404);
    const r = await act(action, c, me, body);
    try { await svc.from('change_log').insert({ entity_type: 'social_comment', entity_id: String(id), field: action, old_value: c.status, new_value: action + ' on ' + c.platform, changed_by: me.name }); } catch (_) { /* audit */ }
    return json(r);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
