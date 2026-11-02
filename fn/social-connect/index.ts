// Welfare Avenue: social-connect (v3, 02/11/26, wave277 adapters, health and weekly renewal; v2.1 02/11/26, LinkedIn asks only for scopes the app holds; v2 12/10/26, wave231 TikTok analytics; v1 09/10/26, wave225 the Content Studio)
// v3: the platform list, names and scopes come from the studio_platforms registry (platforms.ts) instead of constants.
// v3: each platform's sign-in address, code exchange, renewal and health check live in adapters/ (same requests as v2.1).
// v3: LinkedIn asks for the registry's scopes and keeps the scopes it granted, the expiry and the Page as account_id.
// v3: Threads keeps an expiry 60 days out, TikTok the refresh token's expiry; every record carries handle and account_id.
// v3: status lists the active platforms and gives each connection a health computed on read (health.ts).
// v3: new action health (publishers) checks every connected platform now and writes what it found.
// v3: refresh renews and checks every connected platform; a failure marks that one in error and the rest carry on;
//     a login expiring within 7 days tells the publishers (notify, once a week) so posts keep going out.
// v3 (review fixes): the sign-in return, status and health keep working when the registry cannot be read; TikTok
//     health refreshes only when its access token is near expiry; a renewal is saved before its check runs.
// v2.1: the LinkedIn authorize URL drops r_organization_admin (the app was never granted it).
// v2: TikTok asks for the analytics scopes too, shows @username and runs the first tiktok-pull right after connecting.
// The Content Studio's Connections page: it keeps every platform login in the vault and never shows a secret back.
// Purpose: connect Threads, YouTube, TikTok and LinkedIn by their own sign-in pages (OAuth), replace the Meta system user token,
// and keep the Make.com webhook that posts to the LinkedIn Page until LinkedIn approves the direct connection.
// Auth: the page's calls need a signed-in staff member, and every change needs a publisher (wa225_publisher: admins and
// marketing leads); replacing the Meta token needs an admin. The platforms' sign-in pages come back here with a GET (no
// Supabase session), checked by the one-time state the start action saved (15 minutes). verify_jwt is off for that reason.
// Actions (POST, the page):
//   status                         what is connected, with health (no secrets), and the active platforms
//   health                         check every connected platform now, then answer as status (publishers)
//   save_app {platform, id, secret}   the app keys Steel copies from each developer console
//   start {platform}               the platform's sign-in address to open (the state is saved for the callback)
//   disconnect {platform}          forget the login (the vault value is blanked) and mark it disconnected
//   meta_token {token}             check a new Meta system user token's permissions, then put it in the vault (admins)
//   make_hook {url}                save the Make.com webhook and make the shared secret its filter checks
//   make_sample                    send Make a sample so it learns the fields (post_type sample: nothing is posted)
//   make_test {confirm:true}       a real test post on the LinkedIn Page through Make (asked first on the page)
// Actions (POST, automation with x-wa-secret): refresh (weekly cron: renew, check, warn the publishers of expiring logins)
// GET ?code&state (the platform's sign-in page): exchange the code, save the login, redirect to the Hub's Connections page.
// GET ?event=uninstall|delete (Threads' callbacks): acknowledged; delete answers Meta's confirmation format.
// Tables: hub_settings studio_connections (no secrets), studio_platforms, change_log. RPC: wa277_publishers. Vault:
// SOCIAL_<PLATFORM>_CLIENT, SOCIAL_THREADS_TOKEN, SOCIAL_YOUTUBE_REFRESH, SOCIAL_TIKTOK_TOKEN, SOCIAL_LINKEDIN_TOKEN,
// SOCIAL_MAKE_LINKEDIN_HOOK, SOCIAL_MAKE_LINKEDIN_SECRET, META_SYSTEM_TOKEN, WA_TRIGGER_SECRET.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { byKey, names, type Platform, platforms } from './platforms.ts';
import { ADAPTERS } from './adapters/index.ts';
import { type Any, clientOf, type Conn, type Ctx, type Platform as P } from './adapters/types.ts';
import { DAY, EXPIRING_DAYS, healthOf, toConn } from './health.ts';

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
const iso = (t = Date.now()) => new Date(t).toISOString();
const msg = (e: unknown) => String((e as Error)?.message || e);

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
// v3: what the adapters get (they never touch the vault, the database or the network except through this)
const ctx: Ctx = { getSecret, secretOrNull, vaultSet, svc, now: () => Date.now(), fetch: (i, init) => fetch(i, init) };
async function conns(): Promise<Record<string, Any>> {
  const { data } = await svc.from('hub_settings').select('value').eq('key', 'studio_connections').maybeSingle();
  return ((data && data.value) || {}) as Record<string, Any>;
}
async function setConn(platform: string, patch: Record<string, Any>, by: string): Promise<void> {
  const c = await conns();
  c[platform] = { ...(c[platform] || {}), ...patch };
  await svc.from('hub_settings').upsert({ key: 'studio_connections', value: c, updated_at: iso(), updated_by: by });
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

/* v3: the registry: the active platforms, the ones signed in by OAuth (with an adapter), and their names */
type Reg = { list: Platform[]; oauth: P[]; keys: string[]; by: Record<string, P>; NAME: Record<string, string> };
const NAMES: Record<string, string> = { threads: 'Threads', youtube: 'YouTube', tiktok: 'TikTok', linkedin: 'LinkedIn', make: 'Make.com', meta: 'Meta' };
async function reg(): Promise<Reg> {
  const list = await platforms(svc);
  const oauth = list.filter(p => p.auth === 'oauth' && ADAPTERS[p.key]);
  return { list, oauth, keys: oauth.map(p => p.key), by: byKey(list), NAME: { ...NAMES, ...names(list) } };
}
/* v3: without the registry (its read failed and nothing is cached) the adapters still work from a minimal platform */
async function regSafe(): Promise<Reg> {
  try { return await reg(); } catch (e) {
    console.log('social-connect: registry unavailable: ' + msg(e));
    const oauth: P[] = Object.keys(ADAPTERS).map(key => ({ key, label: NAMES[key] || key, auth: 'oauth', active: true, scopes: [] }));
    return { list: [], oauth, keys: oauth.map(p => p.key), by: Object.fromEntries(oauth.map(p => [p.key, p])), NAME: NAMES };
  }
}

/* v2: the first TikTok pull, so Analytics shows the account at once (a failure there never fails the connection) */
async function firstTikTokPull(): Promise<void> {
  try {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 30000);
    await fetch(SUPABASE_URL + '/functions/v1/tiktok-pull', { method: 'POST', signal: ctl.signal, headers: { 'x-wa-secret': await getSecret('WA_TRIGGER_SECRET'), 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync' }) });
    clearTimeout(tm);
  } catch (_) { /* the morning pull catches up */ }
}
async function finish(p: P, code: string, by: string): Promise<string> {
  const c = await clientOf(ctx, p.key); if (!c) throw new Error('save the app keys first');
  const r = await ADAPTERS[p.key].finish(p, c, code, REDIRECT, by, ctx);
  await setConn(p.key, r.conn, by);
  if (p.key === 'tiktok') await firstTikTokPull();
  return r.label;
}
/* v3: renew (refresh only) and check one platform; a failure marks it in error and never stops the others */
async function check(p: P, conn: Conn, renew: boolean, by: string): Promise<string> {
  const a = ADAPTERS[p.key];
  let r: Partial<Conn> = {};
  try {
    // a renewal is saved before the check, so a failed check never loses it (the vault already holds the new token)
    if (renew && a.refresh) { r = await a.refresh(p, conn, ctx); if (Object.keys(r).length) await setConn(p.key, r, by); }
    const h = await a.health(p, { ...conn, ...r }, ctx);
    const patch = { ...r, ...h };
    await setConn(p.key, { ...patch, health: healthOf({ ...conn, ...patch }, Date.now()) }, by);
    return p.key + ' ok';
  } catch (e) {
    await setConn(p.key, { health: 'error', last_error: msg(e).slice(0, 200), last_checked_at: iso() }, by);
    return p.key + ' failed';
  }
}
/* v3: tell the publishers about a login that lapses within 7 days (once a week per platform) */
async function warn(R: Reg): Promise<string[]> {
  const c = await conns(), now = Date.now(), out: string[] = [];
  let to: string[] | null = null;
  for (const p of R.oauth) {
    const v = c[p.key];
    if (!v || healthOf(v, now) !== 'expiring') continue;
    if (v.warned_at && now - new Date(v.warned_at).getTime() < EXPIRING_DAYS * DAY) continue;
    try {
      if (!to) { const { data, error } = await svc.rpc('wa277_publishers'); if (error) throw new Error(error.message); to = (data || []) as string[]; }
      const n = Math.max(1, Math.ceil((new Date(v.expires_at).getTime() - now) / DAY));
      const r = await fetch(SUPABASE_URL + '/functions/v1/notify', { method: 'POST', headers: { 'x-wa-secret': await getSecret('WA_TRIGGER_SECRET'), 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'connection_expiring', to, title: p.label + ' connection expires in ' + n + (n === 1 ? ' day' : ' days'), text: 'Reconnect it on the Connections page so posts keep going out.', url: '/#studio/connections', tag: 'studio-conn-' + p.key }) });
      if (!r.ok) throw new Error('notify HTTP ' + r.status);
      await setConn(p.key, { warned_at: iso(now) }, 'refresh');
      out.push(p.key + ' warned');
    } catch (e) { console.log('social-connect warn ' + p.key + ': ' + msg(e)); out.push(p.key + ' warning failed'); }
  }
  return out;
}
async function status(me: Me, R: Reg): Promise<Response> {
  const c = await conns(), now = Date.now(), out: Record<string, Any> = {};
  for (const k of Object.keys(c)) { const v = { ...(c[k] || {}) }; delete v.state; out[k] = v; }
  for (const k of R.keys) out[k] = { ...toConn(k, c[k], now), app_saved: !!(await clientOf(ctx, k)) };
  out.make = { ...(out.make || {}), saved: !!(await secretOrNull('SOCIAL_MAKE_LINKEDIN_HOOK')), secret: me.publisher ? await secretOrNull('SOCIAL_MAKE_LINKEDIN_SECRET') : null };
  out.meta = { ...(out.meta || {}), token: !!(await secretOrNull('META_SYSTEM_TOKEN')) };
  return json({ ok: true, connections: out, platforms: R.list, redirect_uri: REDIRECT, can_change: me.publisher, can_meta: me.admin });
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
    const back = (q: string) => new Response(null, { status: 302, headers: { Location: BACK + '?' + q } });
    // v3: whatever fails here, the person lands back on the Connections page with the reason
    try {
      const all = await conns();
      const platform = Object.keys(ADAPTERS).find(p => all[p] && all[p].state && all[p].state.value === state) || '';
      if (!platform) return back('error=' + encodeURIComponent('That sign-in has expired; press Connect again'));
      const st = all[platform].state;
      if (Date.now() > Number(st.exp || 0)) return back('error=' + encodeURIComponent('That sign-in took too long; press Connect again'));
      if (err || !code) { await setConn(platform, { state: null }, st.by); return back('error=' + encodeURIComponent(NAMES[platform] + ': ' + (err || 'no code came back'))); }
      const R = await regSafe();
      try {
        const what = await finish(R.by[platform] || { key: platform, label: NAMES[platform], auth: 'oauth', active: true, scopes: [] }, code, st.by);
        await log(platform, 'connected ' + R.NAME[platform] + ' (' + what + ')', st.by);
        return back('connected=' + platform);
      } catch (e) {
        await setConn(platform, { state: null, last_error: msg(e).slice(0, 200) }, st.by);
        return back('error=' + encodeURIComponent(R.NAME[platform] + ': ' + msg(e).slice(0, 160)));
      }
    } catch (e) { return back('error=' + encodeURIComponent('Connecting failed: ' + msg(e).slice(0, 160))); }
  }

  const me = await caller(req);
  if (!me) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({})) as Record<string, Any>;
  const action = String(body.action || 'status');
  try {
    if (action === 'status') return await status(me, await regSafe());
    if (action === 'refresh') {
      if (!me.auto) return json({ error: 'automation only' }, 401);
      const R = await regSafe(); const c = await conns(); const out: string[] = [];
      for (const p of R.oauth) { if (c[p.key] && c[p.key].status === 'connected') out.push(await check(p, c[p.key], true, 'refresh')); }
      out.push(...await warn(R));
      return json({ ok: true, done: out });
    }
    if (!me.publisher) return json({ error: 'Only marketing leads and admins change the connections' }, 403);
    if (action === 'health') {
      const R = await regSafe(); const c = await conns();
      for (const p of R.oauth) { if (c[p.key] && c[p.key].status === 'connected') await check(p, c[p.key], false, me.email); }
      return await status(me, R);
    }
    if (action === 'save_app') {
      const p = String(body.platform || ''); if (!ADAPTERS[p]) return json({ error: 'which platform?' }, 400);
      const id = String(body.id || '').trim(), sec = String(body.secret || '').trim();
      if (!/^[\w.\-:]{4,200}$/.test(id) || sec.length < 8 || sec.length > 300) return json({ error: 'Paste both the id and the secret as the developer console shows them' }, 400);
      await vaultSet('SOCIAL_' + p.toUpperCase() + '_CLIENT', JSON.stringify({ id, secret: sec }), 'wave225: ' + NAMES[p] + ' app keys for the Content Studio (social-connect)');
      await setConn(p, { app_id: id.slice(0, 6) + '\u2026', app_saved_at: iso(), app_saved_by: me.email }, me.email);
      await log(p, NAMES[p] + ' app keys saved', me.email);
      return json({ ok: true });
    }
    if (action === 'start') {
      const R = await reg();
      const p = String(body.platform || ''); if (R.keys.indexOf(p) < 0) return json({ error: 'which platform?' }, 400);
      const c = await clientOf(ctx, p); if (!c) return json({ error: 'Save the ' + R.NAME[p] + ' app keys first' }, 400);
      const state = rand(18);
      await setConn(p, { state: { value: state, by: me.email, exp: Date.now() + 15 * 60000 } }, me.email);
      return json({ ok: true, url: ADAPTERS[p].authorizeUrl(R.by[p], c.id, REDIRECT, state) });
    }
    if (action === 'disconnect') {
      const p = String(body.platform || '');
      const names: Record<string, string[]> = { threads: ['SOCIAL_THREADS_TOKEN'], youtube: ['SOCIAL_YOUTUBE_REFRESH'], tiktok: ['SOCIAL_TIKTOK_TOKEN'], linkedin: ['SOCIAL_LINKEDIN_TOKEN', 'SOCIAL_LINKEDIN_REFRESH'], make: ['SOCIAL_MAKE_LINKEDIN_HOOK', 'SOCIAL_MAKE_LINKEDIN_SECRET'] };
      if (!names[p]) return json({ error: 'which platform?' }, 400);
      for (const n of names[p]) { if (await secretOrNull(n)) await vaultSet(n, '', 'wave225: disconnected ' + iso().slice(0, 10)); }
      await setConn(p, { status: 'disconnected', disconnected_by: me.email, disconnected_at: iso(), state: null }, me.email);
      // v2: the TikTok analytics account stops syncing (its history stays)
      if (p === 'tiktok') { try { await svc.from('social_accounts').update({ status: 'disconnected' }).eq('platform', 'tiktok').neq('external_id', 'csv'); } catch (_) { /* none */ } }
      await log(p, (NAMES[p] || p) + ' disconnected', me.email);
      return json({ ok: true });
    }
    if (action === 'meta_token') {
      if (!me.admin) return json({ error: 'Only an admin replaces the Meta token' }, 403);
      const tok = String(body.token || '').trim();
      if (!/^[A-Za-z0-9]{40,600}$/.test(tok)) return json({ error: 'That does not look like a Meta token' }, 400);
      const chk = await metaCheck(tok);
      if (body.check_only) return json({ ok: true, ...chk });
      await vaultSet('META_SYSTEM_TOKEN', tok, 'wave120/225: the Meta system user token (hub-analytics); replaced from the Content Studio');
      await setConn('meta', { replaced_at: iso(), replaced_by: me.email, granted: chk.granted, missing: chk.missing }, me.email);
      await log('meta', 'Meta token replaced (' + chk.granted.length + ' permissions, missing: ' + (chk.missing.join(', ') || 'none') + ')', me.email);
      return json({ ok: true, ...chk });
    }
    if (action === 'make_hook') {
      const u = String(body.url || '').trim();
      if (!/^https:\/\/hook\.[a-z0-9-]+\.make\.com\/[A-Za-z0-9_-]{10,}$/.test(u)) return json({ error: 'Paste the address Make shows for the Custom webhook (it starts with https://hook.)' }, 400);
      const secret = (await secretOrNull('SOCIAL_MAKE_LINKEDIN_SECRET')) || rand(10);
      await vaultSet('SOCIAL_MAKE_LINKEDIN_HOOK', u, 'wave225: the Make.com webhook that posts to the LinkedIn Page');
      await vaultSet('SOCIAL_MAKE_LINKEDIN_SECRET', secret, 'wave225: the code the filter in the Make scenario checks');
      await setConn('make', { status: 'saved', saved_by: me.email, saved_at: iso() }, me.email);
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
      await setConn('make', action === 'make_test' ? { tested_at: iso(), tested_ok: r.ok } : { sampled_at: iso() }, me.email);
      await log('make', (action === 'make_test' ? 'test post' : 'sample') + ': HTTP ' + r.status, me.email);
      return json({ ok: r.ok, status: r.status, answer: t.slice(0, 300) });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: msg(e).slice(0, 300) }, 500);
  }
});
