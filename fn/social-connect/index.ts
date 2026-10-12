// Welfare Avenue: social-connect (v2, 12/10/26, wave231 TikTok analytics; v1 09/10/26, wave225 the Content Studio)
// v2: TikTok asks for user.info.profile, user.info.stats and video.list beside user.info.basic and video.upload (the Hub's
// TikTok analytics, tiktok-pull), keeps the scopes TikTok granted in the vault login, shows @username on the card, and runs
// the first tiktok-pull right after connecting so Analytics has the account, its followers and its videos at once.
// The Content Studio's Connections page: it keeps every platform login in the vault and never shows a secret back.
// Purpose: connect Threads, YouTube, TikTok and LinkedIn by their own sign-in pages (OAuth), replace the Meta system user token,
// and keep the Make.com webhook that posts to the LinkedIn Page until LinkedIn approves the direct connection.
// Auth: the page's calls need a signed-in staff member, and every change needs a publisher (wa225_publisher: admins and
// marketing leads); replacing the Meta token needs an admin. The platforms' sign-in pages come back here with a GET (no
// Supabase session), checked by the one-time state the start action saved (15 minutes). verify_jwt is off for that reason.
// Actions (POST, the page):
//   status                         what is connected (no secrets)
//   save_app {platform, id, secret}   the app keys Steel copies from each developer console (threads, youtube, tiktok, linkedin)
//   start {platform}               the platform's sign-in address to open (the state is saved for the callback)
//   disconnect {platform}          forget the login (the vault value is blanked) and mark it disconnected
//   meta_token {token}             check a new Meta system user token's permissions, then put it in the vault (admins)
//   make_hook {url}                save the Make.com webhook and make the shared secret its filter checks
//   make_sample                    send Make a sample so it learns the fields (post_type sample: nothing is posted)
//   make_test {confirm:true}       a real test post on the LinkedIn Page through Make (asked first on the page)
// Actions (POST, automation with x-wa-secret): refresh (weekly cron: Threads tokens last 60 days; refreshed when older than 7)
// GET ?code&state (the platform's sign-in page): exchange the code, save the login, redirect to the Hub's Connections page.
// GET ?event=uninstall|delete (Threads' callbacks): acknowledged; delete answers Meta's confirmation format.
// Tables: hub_settings studio_connections (no secrets: status, names, ids, who connected, when), change_log. Vault:
// SOCIAL_<PLATFORM>_CLIENT, SOCIAL_THREADS_TOKEN, SOCIAL_YOUTUBE_REFRESH, SOCIAL_TIKTOK_TOKEN, SOCIAL_LINKEDIN_TOKEN,
// SOCIAL_MAKE_LINKEDIN_HOOK, SOCIAL_MAKE_LINKEDIN_SECRET, META_SYSTEM_TOKEN.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const REDIRECT = 'https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/social-connect';
const BACK = 'https://hub.welfareavenue.com/#studio/connections';
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Any = any;
const PLATFORMS = ['threads', 'youtube', 'tiktok', 'linkedin'];
const NAME: Record<string, string> = { threads: 'Threads', youtube: 'YouTube', tiktok: 'TikTok', linkedin: 'LinkedIn', make: 'Make.com', meta: 'Meta' };
// v2: what the Hub asks TikTok for (drafts plus the analytics); every one is shown in the app review's demo
const TIKTOK_SCOPES = 'user.info.basic,user.info.profile,user.info.stats,video.list,video.upload';

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
async function secretOrNull(name: string): Promise<string | null> { try { const v = await getSecret(name); return v ? v : null; } catch (_) { return null; } }
async function vaultSet(name: string, value: string, note: string): Promise<void> {
  const { error } = await svc.rpc('wa_vault_set', { p_name: name, p_value: value, p_note: note });
  if (error) throw new Error('vault: ' + error.message);
}
async function conns(): Promise<Record<string, Any>> {
  const { data } = await svc.from('hub_settings').select('value').eq('key', 'studio_connections').maybeSingle();
  return ((data && data.value) || {}) as Record<string, Any>;
}
async function setConn(platform: string, patch: Record<string, Any>, by: string): Promise<void> {
  const c = await conns();
  c[platform] = { ...(c[platform] || {}), ...patch };
  await svc.from('hub_settings').upsert({ key: 'studio_connections', value: c, updated_at: new Date().toISOString(), updated_by: by });
}
async function log(field: string, value: string, by: string): Promise<void> {
  try { await svc.from('change_log').insert({ entity_type: 'studio_connection', entity_id: field, field: 'connection', old_value: null, new_value: value.slice(0, 300), changed_by: by }); } catch (_) { /* audit */ }
}
type Me = { email: string; publisher: boolean; admin: boolean; auto: boolean };
async function caller(req: Request): Promise<Me | null> {
  try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) return { email: 'automation', publisher: true, admin: true, auto: true }; } catch (_) { /* no */ }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = String(data?.user?.email || '').toLowerCase();
  if (!email) return null;
  const { data: ok } = await asUser.rpc('is_wa_staff');
  if (ok !== true) return null;
  const { data: pub } = await asUser.rpc('wa225_publisher');
  const { data: role } = await svc.from('hub_roles').select('role').eq('email', email).maybeSingle();
  return { email, publisher: pub === true, admin: role?.role === 'admin', auto: false };
}
function rand(n = 24): string { const b = crypto.getRandomValues(new Uint8Array(n)); return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join(''); }

/* ---------- the sign-in pages ---------- */
async function client(platform: string): Promise<{ id: string; secret: string } | null> {
  const raw = await secretOrNull('SOCIAL_' + platform.toUpperCase() + '_CLIENT');
  if (!raw) return null;
  try { const c = JSON.parse(raw); return c.id && c.secret ? c : (c.key && c.secret ? { id: c.key, secret: c.secret } : null); } catch (_) { return null; }
}
function authorizeUrl(platform: string, id: string, state: string): string {
  const r = encodeURIComponent(REDIRECT), s = encodeURIComponent(state);
  if (platform === 'threads') return 'https://threads.net/oauth/authorize?client_id=' + encodeURIComponent(id) + '&redirect_uri=' + r + '&scope=threads_basic,threads_content_publish,threads_manage_replies,threads_read_replies,threads_manage_insights,threads_manage_mentions,threads_delete&response_type=code&state=' + s;
  if (platform === 'youtube') return 'https://accounts.google.com/o/oauth2/v2/auth?client_id=' + encodeURIComponent(id) + '&redirect_uri=' + r + '&response_type=code&access_type=offline&prompt=consent&include_granted_scopes=true&scope=' + encodeURIComponent('https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl') + '&state=' + s;
  if (platform === 'tiktok') return 'https://www.tiktok.com/v2/auth/authorize/?client_key=' + encodeURIComponent(id) + '&scope=' + TIKTOK_SCOPES + '&response_type=code&redirect_uri=' + r + '&state=' + s;
  if (platform === 'linkedin') return 'https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=' + encodeURIComponent(id) + '&redirect_uri=' + r + '&state=' + s + '&scope=' + encodeURIComponent('w_organization_social r_organization_social rw_organization_admin r_organization_admin');
  throw new Error('unknown platform');
}
async function form(url: string, params: Record<string, string>): Promise<Any> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() });
  const b = await r.json().catch(() => ({}));
  if (!r.ok || b.error) throw new Error(String(b.error_description || (b.error && (b.error.message || b.error)) || ('HTTP ' + r.status)).slice(0, 200));
  return b;
}
/* v2: the first TikTok pull, so Analytics shows the account at once (a failure there never fails the connection) */
async function firstTikTokPull(): Promise<void> {
  try {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 30000);
    await fetch(SUPABASE_URL + '/functions/v1/tiktok-pull', { method: 'POST', signal: ctl.signal, headers: { 'x-wa-secret': await getSecret('WA_TRIGGER_SECRET'), 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync' }) });
    clearTimeout(tm);
  } catch (_) { /* the morning pull catches up */ }
}
async function finish(platform: string, code: string, by: string): Promise<string> {
  const c = await client(platform); if (!c) throw new Error('save the app keys first');
  if (platform === 'threads') {
    const short = await form('https://graph.threads.net/oauth/access_token', { client_id: c.id, client_secret: c.secret, grant_type: 'authorization_code', redirect_uri: REDIRECT, code });
    const ll = await (await fetch('https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=' + encodeURIComponent(c.secret) + '&access_token=' + encodeURIComponent(short.access_token))).json();
    const tok = String(ll.access_token || short.access_token);
    const me = await (await fetch('https://graph.threads.net/v1.0/me?fields=id,username,name&access_token=' + encodeURIComponent(tok))).json();
    await vaultSet('SOCIAL_THREADS_TOKEN', tok, 'wave225: the Threads login for the Content Studio (60 days, refreshed weekly by social-connect)');
    await setConn('threads', { status: 'connected', user_id: String(me.id || short.user_id || ''), username: me.username || '', name: me.name || me.username || 'Threads', connected_by: by, connected_at: new Date().toISOString(), refreshed_at: new Date().toISOString(), state: null }, by);
    return '@' + (me.username || '');
  }
  if (platform === 'youtube') {
    const t = await form('https://oauth2.googleapis.com/token', { client_id: c.id, client_secret: c.secret, code, grant_type: 'authorization_code', redirect_uri: REDIRECT });
    if (!t.refresh_token) throw new Error('Google sent no refresh token: remove the app at myaccount.google.com/permissions and connect again');
    const ch = await (await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers: { Authorization: 'Bearer ' + t.access_token } })).json();
    const item = (ch.items || [])[0] || {};
    await vaultSet('SOCIAL_YOUTUBE_REFRESH', String(t.refresh_token), 'wave225: the YouTube login for the Content Studio (refresh token)');
    await setConn('youtube', { status: 'connected', channel_id: item.id || '', name: (item.snippet && item.snippet.title) || 'YouTube', handle: (item.snippet && item.snippet.customUrl) || '', connected_by: by, connected_at: new Date().toISOString(), state: null }, by);
    return (item.snippet && item.snippet.title) || 'the channel';
  }
  if (platform === 'tiktok') {
    const t = await form('https://open.tiktokapis.com/v2/oauth/token/', { client_key: c.id, client_secret: c.secret, code, grant_type: 'authorization_code', redirect_uri: REDIRECT });
    const scope = String(t.scope || 'user.info.basic,video.upload');
    const fields = 'open_id,display_name,avatar_url' + (scope.indexOf('user.info.profile') >= 0 ? ',username' : '');
    const u = await (await fetch('https://open.tiktokapis.com/v2/user/info/?fields=' + fields, { headers: { Authorization: 'Bearer ' + t.access_token } })).json();
    const user = (u.data && u.data.user) || {};
    await vaultSet('SOCIAL_TIKTOK_TOKEN', JSON.stringify({ access_token: t.access_token, refresh_token: t.refresh_token, open_id: t.open_id, scope, expires_at: Date.now() + Number(t.expires_in || 86400) * 1000 }), 'wave225/231: the TikTok login for the Content Studio (drafts to the inbox, and the analytics)');
    const label = (user.display_name || 'TikTok') + (user.username ? ' (@' + user.username + ')' : '');
    await setConn('tiktok', { status: 'connected', open_id: t.open_id || '', name: label, username: user.username || null, scopes: scope, connected_by: by, connected_at: new Date().toISOString(), state: null }, by);
    await firstTikTokPull();
    return label;
  }
  if (platform === 'linkedin') {
    const t = await form('https://www.linkedin.com/oauth/v2/accessToken', { grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: c.id, client_secret: c.secret });
    const H = { Authorization: 'Bearer ' + t.access_token, 'Linkedin-Version': '202609', 'X-Restli-Protocol-Version': '2.0.0' };
    const acl = await (await fetch('https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED', { headers: H })).json();
    const org = ((acl.elements || [])[0] || {}).organization || '';
    await vaultSet('SOCIAL_LINKEDIN_TOKEN', String(t.access_token), 'wave225: the LinkedIn Community Management login (60 days; reconnect when it lapses)');
    if (t.refresh_token) await vaultSet('SOCIAL_LINKEDIN_REFRESH', String(t.refresh_token), 'wave225: LinkedIn refresh token (365 days)');
    await setConn('linkedin', { status: 'connected', mode: 'direct', org_urn: org, name: 'Welfare Avenue (LinkedIn)', connected_by: by, connected_at: new Date().toISOString(), expires_at: new Date(Date.now() + Number(t.expires_in || 5184000) * 1000).toISOString(), state: null }, by);
    return org ? 'the Page ' + org.split(':').pop() : 'LinkedIn (no Page admin role found)';
  }
  throw new Error('unknown platform');
}

/* ---------- Meta: a new system user token ---------- */
const META_WANT = ['pages_manage_posts', 'pages_manage_engagement', 'pages_read_user_content', 'pages_read_engagement', 'pages_show_list', 'pages_manage_metadata', 'read_insights', 'business_management', 'instagram_basic', 'instagram_content_publish', 'instagram_manage_comments', 'instagram_manage_insights'];
async function metaCheck(token: string): Promise<{ granted: string[]; missing: string[]; name: string }> {
  const me = await (await fetch('https://graph.facebook.com/v23.0/me?fields=id,name&access_token=' + encodeURIComponent(token))).json();
  if (me.error) throw new Error('Meta did not accept that token: ' + String(me.error.message || '').slice(0, 160));
  let granted: string[] = [];
  const p = await (await fetch('https://graph.facebook.com/v23.0/me/permissions?access_token=' + encodeURIComponent(token))).json();
  if (!p.error) granted = ((p.data || []) as Any[]).filter(x => x.status === 'granted').map(x => String(x.permission));
  return { granted, missing: META_WANT.filter(x => granted.indexOf(x) < 0), name: String(me.name || '') };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);

  /* the platforms come back here */
  if (req.method === 'GET' || (req.method === 'POST' && url.searchParams.get('event'))) {
    const ev = url.searchParams.get('event');
    if (ev === 'uninstall') return json({ ok: true });
    if (ev === 'delete') { const code = rand(8); await log('threads', 'Threads asked for data deletion (' + code + ')', 'threads'); return json({ url: 'https://welfareavenue.com/data-deletion/', confirmation_code: code }); }
    const state = url.searchParams.get('state') || '', code = url.searchParams.get('code') || '';
    const err = url.searchParams.get('error_description') || url.searchParams.get('error') || '';
    const all = await conns();
    const platform = PLATFORMS.find(p => all[p] && all[p].state && all[p].state.value === state) || '';
    const back = (q: string) => new Response(null, { status: 302, headers: { Location: BACK + '?' + q } });
    if (!platform) return back('error=' + encodeURIComponent('That sign-in has expired; press Connect again'));
    const st = all[platform].state;
    if (Date.now() > Number(st.exp || 0)) return back('error=' + encodeURIComponent('That sign-in took too long; press Connect again'));
    if (err || !code) { await setConn(platform, { state: null }, st.by); return back('error=' + encodeURIComponent(NAME[platform] + ': ' + (err || 'no code came back'))); }
    try {
      const what = await finish(platform, code, st.by);
      await log(platform, 'connected ' + NAME[platform] + ' (' + what + ')', st.by);
      return back('connected=' + platform);
    } catch (e) {
      await setConn(platform, { state: null, last_error: String((e as Error).message).slice(0, 200) }, st.by);
      return back('error=' + encodeURIComponent(NAME[platform] + ': ' + String((e as Error).message).slice(0, 160)));
    }
  }

  const me = await caller(req);
  if (!me) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({})) as Record<string, Any>;
  const action = String(body.action || 'status');
  try {
    if (action === 'status') {
      const c = await conns(); const out: Record<string, Any> = {};
      for (const k of Object.keys(c)) { const v = { ...(c[k] || {}) }; delete v.state; out[k] = v; }
      for (const p of PLATFORMS) { out[p] = { ...(out[p] || {}), app_saved: !!(await client(p)) }; }
      out.make = { ...(out.make || {}), saved: !!(await secretOrNull('SOCIAL_MAKE_LINKEDIN_HOOK')), secret: me.publisher ? await secretOrNull('SOCIAL_MAKE_LINKEDIN_SECRET') : null };
      out.meta = { ...(out.meta || {}), token: !!(await secretOrNull('META_SYSTEM_TOKEN')) };
      return json({ ok: true, connections: out, redirect_uri: REDIRECT, can_change: me.publisher, can_meta: me.admin });
    }
    if (action === 'refresh') {
      if (!me.auto) return json({ error: 'automation only' }, 401);
      const c = await conns(); const out: string[] = [];
      const th = await secretOrNull('SOCIAL_THREADS_TOKEN');
      if (th && c.threads && c.threads.status === 'connected' && Date.now() - new Date(c.threads.refreshed_at || 0).getTime() > 7 * 86400000) {
        const r = await (await fetch('https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=' + encodeURIComponent(th))).json();
        if (r.access_token) { await vaultSet('SOCIAL_THREADS_TOKEN', String(r.access_token), 'wave225: the Threads login (refreshed)'); await setConn('threads', { refreshed_at: new Date().toISOString(), last_error: null }, 'refresh'); out.push('threads refreshed'); }
        else { await setConn('threads', { last_error: 'refresh failed: ' + JSON.stringify(r.error || r).slice(0, 160) }, 'refresh'); out.push('threads failed'); }
      }
      return json({ ok: true, done: out });
    }
    if (!me.publisher) return json({ error: 'Only marketing leads and admins change the connections' }, 403);
    if (action === 'save_app') {
      const p = String(body.platform || ''); if (PLATFORMS.indexOf(p) < 0) return json({ error: 'which platform?' }, 400);
      const id = String(body.id || '').trim(), sec = String(body.secret || '').trim();
      if (!/^[\w.\-:]{4,200}$/.test(id) || sec.length < 8 || sec.length > 300) return json({ error: 'Paste both the id and the secret as the developer console shows them' }, 400);
      await vaultSet('SOCIAL_' + p.toUpperCase() + '_CLIENT', JSON.stringify({ id, secret: sec }), 'wave225: ' + NAME[p] + ' app keys for the Content Studio (social-connect)');
      await setConn(p, { app_id: id.slice(0, 6) + '…', app_saved_at: new Date().toISOString(), app_saved_by: me.email }, me.email);
      await log(p, NAME[p] + ' app keys saved', me.email);
      return json({ ok: true });
    }
    if (action === 'start') {
      const p = String(body.platform || ''); if (PLATFORMS.indexOf(p) < 0) return json({ error: 'which platform?' }, 400);
      const c = await client(p); if (!c) return json({ error: 'Save the ' + NAME[p] + ' app keys first' }, 400);
      const state = rand(18);
      await setConn(p, { state: { value: state, by: me.email, exp: Date.now() + 15 * 60000 } }, me.email);
      return json({ ok: true, url: authorizeUrl(p, c.id, state) });
    }
    if (action === 'disconnect') {
      const p = String(body.platform || '');
      const names: Record<string, string[]> = { threads: ['SOCIAL_THREADS_TOKEN'], youtube: ['SOCIAL_YOUTUBE_REFRESH'], tiktok: ['SOCIAL_TIKTOK_TOKEN'], linkedin: ['SOCIAL_LINKEDIN_TOKEN', 'SOCIAL_LINKEDIN_REFRESH'], make: ['SOCIAL_MAKE_LINKEDIN_HOOK', 'SOCIAL_MAKE_LINKEDIN_SECRET'] };
      if (!names[p]) return json({ error: 'which platform?' }, 400);
      for (const n of names[p]) { if (await secretOrNull(n)) await vaultSet(n, '', 'wave225: disconnected ' + new Date().toISOString().slice(0, 10)); }
      await setConn(p, { status: 'disconnected', disconnected_by: me.email, disconnected_at: new Date().toISOString(), state: null }, me.email);
      // v2: the TikTok analytics account stops syncing (its history stays)
      if (p === 'tiktok') { try { await svc.from('social_accounts').update({ status: 'disconnected' }).eq('platform', 'tiktok').neq('external_id', 'csv'); } catch (_) { /* none */ } }
      await log(p, NAME[p] + ' disconnected', me.email);
      return json({ ok: true });
    }
    if (action === 'meta_token') {
      if (!me.admin) return json({ error: 'Only an admin replaces the Meta token' }, 403);
      const tok = String(body.token || '').trim();
      if (!/^[A-Za-z0-9]{40,600}$/.test(tok)) return json({ error: 'That does not look like a Meta token' }, 400);
      const chk = await metaCheck(tok);
      if (body.check_only) return json({ ok: true, ...chk });
      await vaultSet('META_SYSTEM_TOKEN', tok, 'wave120/225: the Meta system user token (hub-analytics); replaced from the Content Studio');
      await setConn('meta', { replaced_at: new Date().toISOString(), replaced_by: me.email, granted: chk.granted, missing: chk.missing }, me.email);
      await log('meta', 'Meta token replaced (' + chk.granted.length + ' permissions, missing: ' + (chk.missing.join(', ') || 'none') + ')', me.email);
      return json({ ok: true, ...chk });
    }
    if (action === 'make_hook') {
      const u = String(body.url || '').trim();
      if (!/^https:\/\/hook\.[a-z0-9-]+\.make\.com\/[A-Za-z0-9_-]{10,}$/.test(u)) return json({ error: 'Paste the address Make shows for the Custom webhook (it starts with https://hook.)' }, 400);
      const secret = (await secretOrNull('SOCIAL_MAKE_LINKEDIN_SECRET')) || rand(10);
      await vaultSet('SOCIAL_MAKE_LINKEDIN_HOOK', u, 'wave225: the Make.com webhook that posts to the LinkedIn Page');
      await vaultSet('SOCIAL_MAKE_LINKEDIN_SECRET', secret, 'wave225: the code the filter in the Make scenario checks');
      await setConn('make', { status: 'saved', saved_by: me.email, saved_at: new Date().toISOString() }, me.email);
      await log('make', 'Make webhook saved', me.email);
      return json({ ok: true, secret });
    }
    if (action === 'make_sample' || action === 'make_test') {
      const hook = await secretOrNull('SOCIAL_MAKE_LINKEDIN_HOOK'); if (!hook) return json({ error: 'Save the Make webhook first' }, 400);
      if (action === 'make_test' && body.confirm !== true) return json({ error: 'confirm' }, 400);
      const secret = (await secretOrNull('SOCIAL_MAKE_LINKEDIN_SECRET')) || '';
      const payload = action === 'make_sample'
        ? { secret, text: 'A sample from the Welfare Avenue Hub so Make learns the fields. Nothing is posted.', image_url: 'https://hub.welfareavenue.com/icons/hub-512.png', post_type: 'sample', post_id: 0 }
        : { secret, text: 'Testing the connection between the Welfare Avenue Hub and our LinkedIn Page. Please ignore this post.', image_url: '', post_type: 'text', post_id: 0 };
      const r = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const t = await r.text();
      await setConn('make', action === 'make_test' ? { tested_at: new Date().toISOString(), tested_ok: r.ok } : { sampled_at: new Date().toISOString() }, me.email);
      await log('make', (action === 'make_test' ? 'test post' : 'sample') + ': HTTP ' + r.status, me.email);
      return json({ ok: r.ok, status: r.status, answer: t.slice(0, 300) });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
