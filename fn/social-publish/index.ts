// Welfare Avenue: social-publish (v2, 25/09/26)
// The content calendar's publisher and confirmer.
// Publishing: posts from content_posts go to the Facebook Page (/{page}/feed,
// /photos, /videos) and the Instagram business account (a container on
// /{ig}/media, then /media_publish; reels are polled, and when Instagram is
// still processing the video the cron finishes the job on its next run) with
// the Meta token in the vault (META_SYSTEM_TOKEN, which needs
// pages_manage_posts and instagram_content_publish on top of the analytics
// permissions). A post is claimed before it is sent (status draft, scheduled or
// failed to publishing, in one conditional update) and every platform's result
// is saved as soon as it lands, so a retry never posts twice.
// Confirming: published or hand-posted calendar entries are matched to the
// analytics rows in social_posts (by id, else by caption within 48 hours), and a
// planned post whose time has passed and which shows up in the analytics is
// marked posted on its own. Optional Slack confirmations (hub_settings
// content_calendar {slack_confirm, slack_channel}) announce each post once.
// Actions (POST):
//   {action:'capabilities'}                 token, granted permissions, what can be published   (staff)
//   {action:'publish', post_id}             publish one post now                                   (staff)
//   {action:'run'}                          due posts, pending reels, stuck posts, confirmations   (cron wa-social-publish, x-wa-secret, service key)
//   {action:'confirm', days?}               match calendar entries to social_posts                 (staff or automation)
//   {action:'preview', post_id}             what would be sent, without sending                    (staff)
//   {action:'settings', value?}             read or save the calendar settings                     (staff)
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const GRAPH = 'https://graph.facebook.com/v23.0';
const SITE = 'https://wa-exec-dashboard.netlify.app';
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Any = any;
type Media = { path?: string; url: string; mime?: string; kind?: string; w?: number; h?: number };
type Post = { id: number; title: string | null; platforms: string[]; format: string; caption: string | null; link_url: string | null; media: Media[]; scheduled_at: string | null; status: string; results: Record<string, Any>; live: Record<string, Any>; error: string | null; owner: string | null; published_at: string | null; updated_at: string };
class Pending extends Error { container: string; constructor(c: string) { super('Instagram is still processing the video'); this.container = c; } }

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
async function secretOrNull(name: string): Promise<string | null> { try { return await getSecret(name); } catch (_) { return null; } }
type Me = { email: string; name: string };
async function who(req: Request): Promise<Me | null> {
  try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) return { email: 'automation', name: 'automation' }; } catch (_) { /* no */ }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  if (auth.slice(7) === SERVICE_KEY) return { email: 'automation', name: 'automation' };
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  if (!(email.endsWith('@welfareavenue.com') || email === 'steelmacdonald@gmail.com')) return null;
  const meta = (data?.user?.user_metadata || {}) as Record<string, string>;
  return { email, name: meta.full_name || meta.name || email.split('@')[0] };
}

/* ---------- settings and Slack ---------- */
async function settings(): Promise<Record<string, Any>> {
  try { const { data } = await svc.from('hub_settings').select('value').eq('key', 'content_calendar').maybeSingle(); return ((data && data.value) || {}) as Record<string, Any>; } catch (_) { return {}; }
}
let CH: Record<string, string> = {};
async function slackChannel(tok: string, name: string): Promise<string | null> {
  if (CH[name]) return CH[name];
  let cursor = '';
  for (let i = 0; i < 10; i++) {
    const res = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=200' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), { headers: { Authorization: 'Bearer ' + tok } });
    const b = await res.json();
    const hit = ((b.channels || []) as Any[]).find(c => c.name === name || c.id === name);
    if (hit) {
      CH[name] = String(hit.id);
      if (!hit.is_member) { try { await fetch('https://slack.com/api/conversations.join', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: hit.id }) }); } catch (_) { /* private */ } }
      return CH[name];
    }
    cursor = b.response_metadata?.next_cursor || ''; if (!cursor) break;
  }
  return null;
}
const PNAME: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram' };
function label(p: Post): string { const t = String(p.title || '').trim() || String(p.caption || '').replace(/\s+/g, ' ').trim(); return t.length > 70 ? t.slice(0, 67) + '…' : (t || 'Post #' + p.id); }
async function announce(p: Post, lines: string[]): Promise<void> {
  try {
    if (!lines.length) return;
    const cfg = await settings(); if (!cfg.slack_confirm) return;
    const tok = await secretOrNull('SLACK_BOT_TOKEN'); if (!tok) return;
    const ch = await slackChannel(tok, String(cfg.slack_channel || 'social-media').replace(/^#/, '')); if (!ch) return;
    const text = ':white_check_mark: *' + label(p) + '*\n' + lines.join('\n') + '\n<' + SITE + '/#contentcal/' + p.id + '|Open in the content calendar>';
    await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ channel: ch, text, unfurl_links: false, unfurl_media: false }) });
  } catch (_) { /* a confirmation must never break publishing */ }
}

/* ---------- Graph ---------- */
async function graph(method: 'GET' | 'POST', path: string, token: string, params: Record<string, string> = {}): Promise<Any> {
  const u = new URL(GRAPH + (path.startsWith('/') ? path : '/' + path));
  const body = new URLSearchParams();
  for (const k of Object.keys(params)) { if (method === 'GET') u.searchParams.set(k, params[k]); else body.set(k, params[k]); }
  if (method === 'GET') u.searchParams.set('access_token', token); else body.set('access_token', token);
  const res = await fetch(u.toString(), method === 'GET' ? {} : { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
  const b = await res.json().catch(() => ({}));
  if (!res.ok || b.error) { const e = b.error || {}; throw new Error((e.error_user_msg || e.message || ('HTTP ' + res.status)) + (e.code ? ' (code ' + e.code + (e.error_subcode ? '/' + e.error_subcode : '') + ')' : '')); }
  return b;
}
type Targets = { token: string; page: { id: string; name: string; token: string } | null; ig: { id: string; username: string } | null };
async function targets(): Promise<Targets> {
  const token = await getSecret('META_SYSTEM_TOKEN');
  const { data: accs } = await svc.from('social_accounts').select('*').in('platform', ['facebook', 'instagram']).in('status', ['connected', 'error']);
  const fb = ((accs || []) as Any[]).filter(a => a.platform === 'facebook')[0] || null;
  const ig = ((accs || []) as Any[]).filter(a => a.platform === 'instagram')[0] || null;
  let page: Targets['page'] = null;
  if (fb) {
    let pt = token;
    try { const r = await graph('GET', '/' + fb.external_id, token, { fields: 'access_token,name' }); pt = r.access_token || token; } catch (_) { /* a page token already */ }
    page = { id: String(fb.external_id), name: fb.name || 'Page', token: pt };
  }
  return { token, page, ig: ig ? { id: String(ig.external_id), username: ig.handle || '' } : null };
}
async function permissions(token: string): Promise<{ granted: string[]; source: string }> {
  try { const r = await graph('GET', '/me/permissions', token); return { granted: ((r.data || []) as Any[]).filter(p => p.status === 'granted').map(p => String(p.permission)), source: 'me/permissions' }; }
  catch (_) { /* a Page token has no permissions edge */ }
  try { const r = await graph('GET', '/debug_token', token, { input_token: token }); const d = r.data || {}; return { granted: (d.scopes || (d.granular_scopes || []).map((s: Any) => s.scope) || []) as string[], source: 'debug_token' }; }
  catch (_) { return { granted: [], source: 'unknown' }; }
}

/* ---------- publishing ---------- */
function images(p: Post): Media[] { return (p.media || []).filter(m => m && m.url && String(m.kind || m.mime || '').indexOf('video') < 0); }
function videos(p: Post): Media[] { return (p.media || []).filter(m => m && m.url && String(m.kind || m.mime || '').indexOf('video') >= 0); }
function capFor(p: Post, platform: string): string {
  let c = String(p.caption || '').trim();
  if (platform === 'facebook' && p.link_url && images(p).length && c.indexOf(p.link_url) < 0) c += (c ? '\n\n' : '') + p.link_url;
  return c;
}
async function publishFacebook(p: Post, t: Targets): Promise<{ id: string; url: string }> {
  if (!t.page) throw new Error('No Facebook Page connected (Analytics > Set up)');
  const pg = t.page; const msg = capFor(p, 'facebook'); const imgs = images(p); const vids = videos(p);
  let id = ''; let url = '';
  if (vids.length) {
    const r = await graph('POST', '/' + pg.id + '/videos', pg.token, { file_url: vids[0].url, description: msg, title: String(p.title || '').slice(0, 100) });
    id = String(r.id || r.post_id || ''); url = 'https://www.facebook.com/' + pg.id + '/videos/' + id;
  } else if (imgs.length === 1) {
    const r = await graph('POST', '/' + pg.id + '/photos', pg.token, { url: imgs[0].url, message: msg });
    id = String(r.post_id || r.id || ''); url = 'https://www.facebook.com/' + id;
  } else if (imgs.length > 1) {
    const ids: string[] = [];
    for (const m of imgs.slice(0, 10)) { const r = await graph('POST', '/' + pg.id + '/photos', pg.token, { url: m.url, published: 'false' }); ids.push(String(r.id)); }
    const params: Record<string, string> = { message: msg };
    ids.forEach((mid, i) => { params['attached_media[' + i + ']'] = JSON.stringify({ media_fbid: mid }); });
    const r = await graph('POST', '/' + pg.id + '/feed', pg.token, params);
    id = String(r.id || ''); url = 'https://www.facebook.com/' + id;
  } else {
    const params: Record<string, string> = { message: msg };
    if (p.link_url) params.link = p.link_url;
    if (!msg && !p.link_url) throw new Error('Nothing to post: add a caption, a link or media');
    const r = await graph('POST', '/' + pg.id + '/feed', pg.token, params);
    id = String(r.id || ''); url = 'https://www.facebook.com/' + id;
  }
  if (!id) throw new Error('Facebook returned no post id');
  return { id, url };
}
async function containerStatus(cid: string, token: string): Promise<string> {
  const r = await graph('GET', '/' + cid, token, { fields: 'status_code,status' });
  const s = String(r.status_code || '');
  if (s === 'ERROR' || s === 'EXPIRED') throw new Error('Instagram could not process the media (' + s + (r.status ? ': ' + r.status : '') + ')');
  return s;
}
async function waitContainer(cid: string, token: string, maxMs: number): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    if ((await containerStatus(cid, token)) === 'FINISHED') return true;
    await new Promise(res => setTimeout(res, 4000));
  }
  return false;
}
async function igFinish(igId: string, cid: string, tok: string, username: string): Promise<{ id: string; url: string }> {
  const pub = await graph('POST', '/' + igId + '/media_publish', tok, { creation_id: cid });
  const id = String(pub.id || '');
  if (!id) throw new Error('Instagram returned no media id');
  let url = 'https://www.instagram.com/' + (username ? username + '/' : '');
  try { const m = await graph('GET', '/' + id, tok, { fields: 'permalink' }); if (m.permalink) url = m.permalink; } catch (_) { /* fine */ }
  return { id, url };
}
async function publishInstagram(p: Post, t: Targets): Promise<{ id: string; url: string }> {
  if (!t.ig) throw new Error('No Instagram account connected (Analytics > Set up)');
  const ig = t.ig; const tok = t.page ? t.page.token : t.token; const cap = capFor(p, 'instagram'); const imgs = images(p); const vids = videos(p);
  let creation = '';
  if (vids.length) {
    const r = await graph('POST', '/' + ig.id + '/media', tok, { media_type: 'REELS', video_url: vids[0].url, caption: cap, share_to_feed: 'true' });
    creation = String(r.id);
    if (!(await waitContainer(creation, tok, 45000))) throw new Pending(creation);
  } else if (imgs.length === 1) {
    const r = await graph('POST', '/' + ig.id + '/media', tok, { image_url: imgs[0].url, caption: cap });
    creation = String(r.id);
  } else if (imgs.length > 1) {
    const kids: string[] = [];
    for (const m of imgs.slice(0, 10)) { const r = await graph('POST', '/' + ig.id + '/media', tok, { image_url: m.url, is_carousel_item: 'true' }); kids.push(String(r.id)); }
    const r = await graph('POST', '/' + ig.id + '/media', tok, { media_type: 'CAROUSEL', children: kids.join(','), caption: cap });
    creation = String(r.id);
    if (!(await waitContainer(creation, tok, 40000))) throw new Pending(creation);
  } else throw new Error('Instagram needs a photo or a video');
  return await igFinish(ig.id, creation, tok, ig.username);
}
async function save(id: number, patch: Record<string, Any>): Promise<void> { patch.updated_at = new Date().toISOString(); await svc.from('content_posts').update(patch).eq('id', id); }
/* published when every platform is up; failed (the UI says "partly published" when some are) otherwise, so Try again sends only what is missing */
function settle(p: Post, results: Record<string, Any>, _errors: string[]): { status: string; pending: boolean } {
  const pending = (p.platforms || []).some(pl => results[pl] && results[pl].pending);
  if (pending) return { status: 'publishing', pending: true };
  const doneAll = (p.platforms || []).length > 0 && (p.platforms || []).every(pl => results[pl] && results[pl].id);
  return { status: doneAll ? 'published' : 'failed', pending: false };
}
function anyLive(results: Record<string, Any>): boolean { return Object.keys(results).some(k => results[k] && results[k].id); }
async function publishPost(id: number, by: string): Promise<Any> {
  /* claim it: only one publisher at a time, and never a published post */
  const claim = await svc.from('content_posts').update({ status: 'publishing', error: null, updated_at: new Date().toISOString(), updated_by: by }).eq('id', id).in('status', ['draft', 'scheduled', 'failed']).select('*');
  if (claim.error) throw new Error(claim.error.message);
  const p = ((claim.data || []) as Post[])[0];
  if (!p) {
    const { data: cur } = await svc.from('content_posts').select('id,status,results').eq('id', id).maybeSingle();
    if (!cur) throw new Error('post ' + id + ' not found');
    return { id, status: cur.status, results: cur.results, note: cur.status === 'publishing' ? 'already publishing' : 'already ' + cur.status };
  }
  let t: Targets;
  try { t = await targets(); }
  catch (e) { const msg = String((e as Error).message || e); await save(id, { status: 'failed', error: msg.indexOf('META_SYSTEM_TOKEN') >= 0 ? 'Publishing is off: the Meta token is not in the vault yet' : msg }); return { id, status: 'failed', errors: [msg] }; }
  const results: Record<string, Any> = { ...(p.results || {}) };
  const errors: string[] = []; const lines: string[] = [];
  for (const platform of (p.platforms || [])) {
    if (results[platform] && results[platform].id) continue;
    try {
      const r = platform === 'facebook' ? await publishFacebook(p, t) : platform === 'instagram' ? await publishInstagram(p, t) : null;
      if (!r) { errors.push(platform + ': not supported'); continue; }
      results[platform] = { ...r, at: new Date().toISOString() };
      lines.push('• Published to ' + (PNAME[platform] || platform) + ': <' + r.url + '|open>');
    } catch (e) {
      if (e instanceof Pending) { results[platform] = { pending: true, container: e.container, since: new Date().toISOString() }; }
      else errors.push((PNAME[platform] || platform) + ': ' + String((e as Error).message || e).slice(0, 300));
    }
    await save(id, { results }); /* after every platform: a retry never posts twice */
  }
  const st = settle(p, results, errors);
  const patch: Record<string, Any> = { status: st.status, results, error: errors.length ? errors.join(' | ') : null, updated_by: by };
  if (anyLive(results) && !p.published_at) patch.published_at = new Date().toISOString();
  await save(id, patch);
  try { await svc.from('change_log').insert({ entity_type: 'content_post', entity_id: String(id), field: 'status', old_value: p.status, new_value: st.status + (errors.length ? ' (' + errors.length + ' problem' + (errors.length > 1 ? 's' : '') + ')' : '') + (st.pending ? ' (Instagram processing)' : ''), changed_by: by }); } catch (_) { /* audit */ }
  await announce({ ...p, results }, lines);
  return { id, status: st.status, results, errors, pending: st.pending };
}
/* reels that Instagram was still processing, and posts stuck mid-publish */
async function finishPending(): Promise<Any[]> {
  const out: Any[] = [];
  const { data } = await svc.from('content_posts').select('*').eq('status', 'publishing').limit(20);
  const rows = (data || []) as Post[]; if (!rows.length) return out;
  let t: Targets | null = null; try { t = await targets(); } catch (_) { t = null; }
  for (const p of rows) {
    const results: Record<string, Any> = { ...(p.results || {}) };
    const pend = Object.keys(results).filter(k => results[k] && results[k].pending);
    if (!pend.length) {
      if (Date.now() - new Date(p.updated_at).getTime() > 10 * 60000) { const all = (p.platforms || []).every(pl => results[pl] && results[pl].id); await save(p.id, { status: all ? 'published' : 'failed', error: all ? null : 'Publishing did not finish. Check Instagram and Facebook before trying again.' }); out.push({ id: p.id, reset: true }); }
      continue;
    }
    const lines: string[] = []; const errors: string[] = [];
    for (const pl of pend) {
      const r = results[pl];
      if (!t || !t.ig || pl !== 'instagram') { errors.push((PNAME[pl] || pl) + ': cannot finish without the Meta connection'); results[pl] = { failed: true }; continue; }
      const tok = t.page ? t.page.token : t.token;
      try {
        const s = await containerStatus(String(r.container), tok);
        if (s === 'FINISHED') { const fin = await igFinish(t.ig.id, String(r.container), tok, t.ig.username); results[pl] = { ...fin, at: new Date().toISOString() }; lines.push('• Published to Instagram: <' + fin.url + '|open>'); }
        else if (Date.now() - new Date(r.since || p.updated_at).getTime() > 30 * 60000) { results[pl] = { failed: true }; errors.push('Instagram: the video was still processing after 30 minutes'); }
      } catch (e) { results[pl] = { failed: true }; errors.push('Instagram: ' + String((e as Error).message || e).slice(0, 300)); }
    }
    const st = settle(p, results, errors);
    const patch: Record<string, Any> = { status: st.status, results };
    if (errors.length) patch.error = errors.join(' | ');
    if (anyLive(results) && !p.published_at) patch.published_at = new Date().toISOString();
    await save(p.id, patch);
    await announce({ ...p, results }, lines);
    out.push({ id: p.id, status: st.status, errors });
  }
  return out;
}

/* ---------- confirmations ---------- */
function norm(s: string): string { return String(s || '').toLowerCase().replace(/https?:\/\/\S+/g, '').replace(/[#@]/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function words(s: string): Set<string> { return new Set(norm(s).split(' ').filter(w => w.length > 3)); }
function similar(a: string, b: string): number {
  const A = words(a), B = words(b); if (A.size < 3 || !B.size) return 0;
  let inter = 0; A.forEach(w => { if (B.has(w)) inter++; });
  return inter / Math.min(A.size, B.size);
}
function liveRow(sp: Any, matched: string): Any { return { external_id: sp.external_id, url: sp.url, kind: sp.kind, published_at: sp.published_at, reach: sp.reach, views: sp.views, likes: sp.likes, comments: sp.comments, shares: sp.shares, saves: sp.saves, engagement: sp.engagement, matched, at: new Date().toISOString() }; }
function byCaption(S: Any[], platform: string, caption: string, whenMs: number): Any {
  const cands = S.filter(s => s.platform === platform && (!whenMs || Math.abs(new Date(s.published_at).getTime() - whenMs) < 48 * 3600000));
  let best: Any = null, bs = 0;
  for (const c of cands) { const sc = similar(caption, c.caption || ''); if (sc > bs) { bs = sc; best = c; } }
  return best && bs >= 0.5 ? best : null;
}
async function confirm(days: number): Promise<Any> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data: social } = await svc.from('social_posts').select('*').gte('published_at', new Date(Date.now() - (days + 2) * 86400000).toISOString()).in('platform', ['facebook', 'instagram']);
  const S = (social || []) as Any[]; let updated = 0, autoPosted = 0; const out: Any[] = [];
  /* 1. published from here or marked posted by hand: attach the live numbers */
  const { data: posts } = await svc.from('content_posts').select('*').in('status', ['published', 'posted', 'failed']).gte('updated_at', new Date(Date.now() - (days + 30) * 86400000).toISOString());
  for (const p of ((posts || []) as Post[])) {
    const live: Record<string, Any> = { ...(p.live || {}) }; let changed = false; const lines: string[] = [];
    for (const platform of (p.platforms || [])) {
      const rid = p.results && p.results[platform] && p.results[platform].id ? String(p.results[platform].id) : null;
      let hit: Any = null;
      if (rid) hit = S.find(s => s.platform === platform && (String(s.external_id) === rid || String(s.external_id).split('_').pop() === rid.split('_').pop()));
      if (!hit && p.caption) { const when = new Date(p.published_at || p.scheduled_at || (p.results && p.results[platform] && p.results[platform].at) || 0).getTime(); const b = byCaption(S, platform, p.caption, when); if (b) hit = { ...b, _by: 'caption' }; }
      if (hit) {
        const row = liveRow(hit, hit._by || 'id');
        const old = live[platform];
        if (!old || old.external_id !== row.external_id || JSON.stringify([old.reach, old.views, old.likes, old.comments, old.shares, old.saves]) !== JSON.stringify([row.reach, row.views, row.likes, row.comments, row.shares, row.saves])) { live[platform] = { ...row, announced: old ? old.announced : false }; changed = true; }
        if (!old && !(p.results && p.results[platform] && p.results[platform].id)) { lines.push('• Live on ' + (PNAME[platform] || platform) + (row.url ? ': <' + row.url + '|open>' : '') + ' (seen in the analytics)'); live[platform].announced = true; }
      }
    }
    if (changed) { await save(p.id, { live }); updated++; out.push({ id: p.id, live: Object.keys(live) }); }
    if (lines.length) await announce(p, lines);
  }
  /* 2. planned posts whose time has passed: when they show up in the analytics, they were posted */
  const cutoff = new Date(Date.now() - 15 * 60000).toISOString();
  const { data: due } = await svc.from('content_posts').select('*').in('status', ['scheduled', 'draft']).not('scheduled_at', 'is', null).lt('scheduled_at', cutoff).gte('scheduled_at', since);
  for (const p of ((due || []) as Post[])) {
    if (String(p.caption || '').trim().length < 20) continue;
    const live: Record<string, Any> = { ...(p.live || {}) }; let first: string | null = null; const lines: string[] = [];
    for (const platform of (p.platforms || [])) {
      const b = byCaption(S, platform, String(p.caption), new Date(String(p.scheduled_at)).getTime());
      if (b) { live[platform] = { ...liveRow(b, 'caption'), announced: true }; if (!first || String(b.published_at) < first) first = String(b.published_at); lines.push('• Live on ' + (PNAME[platform] || platform) + (b.url ? ': <' + b.url + '|open>' : '') + ' (posted by hand, seen in the analytics)'); }
    }
    if (first) {
      await save(p.id, { status: 'posted', live, published_at: first, error: null, updated_by: 'confirmed from the analytics' });
      try { await svc.from('change_log').insert({ entity_type: 'content_post', entity_id: String(p.id), field: 'status', old_value: p.status, new_value: 'posted (seen in the analytics)', changed_by: 'content calendar' }); } catch (_) { /* audit */ }
      await announce(p, lines);
      autoPosted++; updated++; out.push({ id: p.id, posted: Object.keys(live) });
    }
  }
  return { checked: ((posts || []).length + (due || []).length), updated, auto_posted: autoPosted, matched: out.slice(0, 50) };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const me = await who(req);
  if (!me) return json({ error: 'not allowed' }, 401);
  let body: Any = {};
  try { body = await req.json(); } catch (_) { body = {}; }
  const action = String(body.action || 'capabilities');
  try {
    if (action === 'capabilities') {
      const token = await secretOrNull('META_SYSTEM_TOKEN');
      const { data: accs } = await svc.from('social_accounts').select('platform,name,handle,status').in('platform', ['facebook', 'instagram']);
      const out: Any = { ok: true, token: !!token, accounts: accs || [], granted: [], can: { facebook: false, instagram: false }, missing: [], source: null, settings: await settings() };
      if (token) {
        const perms = await permissions(token);
        out.granted = perms.granted; out.source = perms.source;
        const has = (p: string) => perms.granted.indexOf(p) >= 0;
        const fbAcc = (accs || []).some((a: Any) => a.platform === 'facebook');
        const igAcc = (accs || []).some((a: Any) => a.platform === 'instagram');
        /* unknown source (a Page token): assume yes and let the first publish tell */
        out.can.facebook = fbAcc && (perms.source === 'unknown' ? true : has('pages_manage_posts'));
        out.can.instagram = igAcc && (perms.source === 'unknown' ? true : has('instagram_content_publish'));
        if (fbAcc && perms.source !== 'unknown' && !has('pages_manage_posts')) out.missing.push('pages_manage_posts');
        if (igAcc && perms.source !== 'unknown' && !has('instagram_content_publish')) out.missing.push('instagram_content_publish');
        out.accounts_missing = [!fbAcc ? 'facebook' : null, !igAcc ? 'instagram' : null].filter(Boolean);
      }
      return json(out);
    }
    if (action === 'settings') {
      if (body.value && typeof body.value === 'object') {
        const cur = await settings();
        const next = { ...cur, slack_confirm: !!body.value.slack_confirm, slack_channel: String(body.value.slack_channel || cur.slack_channel || 'social-media').replace(/^#/, '').slice(0, 80) };
        const { error } = await svc.from('hub_settings').upsert({ key: 'content_calendar', value: next, updated_at: new Date().toISOString(), updated_by: me.name });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, settings: next });
      }
      return json({ ok: true, settings: await settings() });
    }
    if (action === 'preview') {
      const { data: p } = await svc.from('content_posts').select('*').eq('id', Number(body.post_id)).maybeSingle();
      if (!p) return json({ error: 'not found' }, 404);
      const post = p as Post;
      return json({ ok: true, facebook: { caption: capFor(post, 'facebook'), images: images(post).length, videos: videos(post).length, link: post.link_url }, instagram: { caption: capFor(post, 'instagram'), images: images(post).length, videos: videos(post).length, kind: videos(post).length ? 'reel' : images(post).length > 1 ? 'carousel' : images(post).length ? 'image' : 'none' } });
    }
    if (action === 'publish') {
      if (!body.post_id) return json({ error: 'post_id' }, 400);
      return json({ ok: true, ...(await publishPost(Number(body.post_id), me.name)) });
    }
    if (action === 'run') {
      const now = new Date().toISOString();
      const pending = await finishPending();
      const token = await secretOrNull('META_SYSTEM_TOKEN');
      const results: Any[] = [];
      if (token) {
        const { data: due } = await svc.from('content_posts').select('id').eq('status', 'scheduled').lte('scheduled_at', now).gte('scheduled_at', new Date(Date.now() - 6 * 3600000).toISOString()).order('scheduled_at').limit(5);
        for (const d of ((due || []) as Any[])) { try { results.push(await publishPost(Number(d.id), 'scheduler')); } catch (e) { results.push({ id: d.id, error: String((e as Error).message || e) }); } }
      }
      let confirmed: Any = null;
      try { confirmed = await confirm(14); } catch (_) { /* next run */ }
      return json({ ok: true, publishing: !!token, published: results, pending, confirmed });
    }
    if (action === 'confirm') return json({ ok: true, ...(await confirm(Math.max(1, Math.min(120, Number(body.days) || 60)))) });
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 400) }, 500);
  }
});
