// Welfare Avenue: loom-connect (v2, 29/09/26, wave162c)
// The Loom connection for the Loom pull, through Atlassian's sign-in and approval (OAuth 2.1 with PKCE, the way Claude and other
// AI tools connect to the Atlassian Rovo MCP server). Atlassian refused the personal API token for the Welfare Avenue site
// ("cloud id isn't explicitly granted by the user") while the same account, approved this way, reads Loom.
// An admin presses Connect Loom on the Loom card (Transcript archive), signs in to Atlassian as hub@welfareavenue.com (the account
// that runs the Loom workspace and records the meetings) and approves reading Loom. The Hub keeps the lasting key (a refresh token,
// vault LOOM_OAUTH_REFRESH) and loom-pull uses it before the API token. Nothing here can write to Loom: the only scopes asked
// for are read:loom:agent-interface, read:me, read:account, email and offline_access. (v2, 29/09/26: Atlassian's sign-in step after
// Accept answers "invalid_request: Incorrect request parameters" unless the email scope is asked for too; with it, the approval
// returns a code. Found by asking for every scope and keeping only read_loom on the approval page, then narrowing to this list.)
// Auth: POST actions need an admin's Hub sign-in (or the trigger secret, for the first set-up); the GET redirect is checked by its
// state, a random single-use nonce of a pending approval under 15 minutes old, and the PKCE verifier kept for it in loom_oauth_pending. verify_jwt is off because Atlassian's redirect has no JWT.
// Actions:
//   POST {action:'start'}      -> {url}: Atlassian's approval page
//   GET  ?code=&state=         -> exchanges the code, checks the account can see the Welfare Avenue Loom, keeps the refresh token
//                                 and a short-lived access token, and sends the browser back to the Transcript archive
//                                 (?loom=connected, or ?loom=error&why=...)
//   POST {action:'status'}     -> {connected, client}
//   POST {action:'disconnect'} -> revokes the key at Atlassian and forgets it (loom_oauth_forget)
// Reads and writes: vault LOOM_OAUTH_CLIENT (the client registration, JSON), LOOM_OAUTH_REFRESH, LOOM_OAUTH_ACCESS (JSON, the access
//   token and its expiry); app_config loom_cloud_id, site_url; loom_oauth_pending; change_log.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const REDIRECT = SUPABASE_URL + '/functions/v1/loom-connect';
/* the localhost return (how desktop tools connect): the browser lands on an address nothing answers, and the admin pastes it back */
const LOCAL = 'http://localhost:53682/callback';
/* the Hub's client metadata document (OAuth Client ID Metadata Document): its address is the client id */
const CIMD_URL = SUPABASE_URL + '/functions/v1/loom-connect/client.json';
const CIMD = { client_id: CIMD_URL, client_name: 'Welfare Avenue Hub (Loom pull)', client_uri: 'https://hub.welfareavenue.com', redirect_uris: [REDIRECT], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none', scope: 'read:loom:agent-interface read:me read:account email offline_access' };
const RESOURCE = 'https://mcp.atlassian.com/v2/mcp';
const SCOPE = 'read:loom:agent-interface read:me read:account email offline_access';
const AS_FALLBACK = { authorization_endpoint: 'https://auth.atlassian.com/authorize', token_endpoint: 'https://auth.atlassian.com/oauth/token', registration_endpoint: 'https://auth.atlassian.com/VCeDsk8ZHncYF1g234fKtc4lNipbBhu3/dcr/register', revocation_endpoint: 'https://auth.atlassian.com/oauth/revoke' };
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Json = Record<string, any>;

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
async function maybeSecret(name: string): Promise<string> { try { return await getSecret(name); } catch (_) { return ''; } }
async function setSecret(name: string, value: string, note: string): Promise<void> {
  const { error } = await svc.rpc('wa_vault_set', { p_name: name, p_value: value, p_note: note });
  if (error) throw new Error('could not keep ' + name + ': ' + error.message);
}
async function config(key: string): Promise<string> {
  const { data } = await svc.from('app_config').select('value').eq('key', key).maybeSingle();
  return String(data?.value || '');
}
async function siteUrl(): Promise<string> { return (await config('site_url')) || 'https://wa-exec-dashboard.netlify.app'; }

/* the signed-in Hub admin */
async function admin(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  try { const r = await asUser.rpc('is_wa_admin'); if (r.data !== true) return null; } catch (_) { return null; }
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  if (!email) return null;
  try { const { data: tm } = await svc.from('team_members').select('name').ilike('email', email).limit(1); if (tm && tm[0] && tm[0].name) return String(tm[0].name); } catch (_) { /* the email will do */ }
  return email;
}

/* ---------- small helpers ---------- */
function b64u(bytes: Uint8Array): string { let s = ''; bytes.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64u(s: string): string { const p = s.replace(/-/g, '+').replace(/_/g, '/'); return atob(p + '==='.slice((p.length + 3) % 4)); }
function rand(n: number): string { const a = new Uint8Array(n); crypto.getRandomValues(a); return b64u(a); }
async function sha256(text: string): Promise<string> { return b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))); }
async function hmac(text: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(await getSecret('WA_TRIGGER_SECRET')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text))));
}
async function makeState(nonce: string): Promise<string> { const body = nonce + '|' + (Date.now() + 15 * 60000); return b64u(new TextEncoder().encode(body + '|' + await hmac(body))); }
async function readState(state: string): Promise<string | null> {
  try {
    const raw = unb64u(state); const i = raw.lastIndexOf('|'); if (i < 0) return null;
    const body = raw.slice(0, i), sig = raw.slice(i + 1);
    if (sig !== await hmac(body)) return null;
    const [nonce, exp] = body.split('|');
    if (!nonce || !(Number(exp) > Date.now())) return null;
    return nonce;
  } catch (_) { return null; }
}
async function back(result: string, why?: string): Promise<Response> {
  const q = '?loom=' + encodeURIComponent(result) + (why ? '&why=' + encodeURIComponent(why.slice(0, 160)) : '');
  return new Response(null, { status: 302, headers: { Location: (await siteUrl()).replace(/\/+$/, '') + '/' + q + '#transcripts' } });
}

/* ---------- Atlassian's authorization server for the v2 MCP endpoint ---------- */
async function authServer(): Promise<Json> {
  try {
    const pr = await (await fetch('https://mcp.atlassian.com/.well-known/oauth-protected-resource/v2/mcp')).json();
    const iss = String((pr.authorization_servers || [])[0] || '');
    const u = new URL(iss);
    const meta = await (await fetch(u.origin + '/.well-known/oauth-authorization-server' + u.pathname)).json();
    if (meta && meta.authorization_endpoint && meta.token_endpoint) return meta;
  } catch (_) { /* the known endpoints */ }
  return AS_FALLBACK;
}
async function client(as: Json, local = false): Promise<Json> {
  const name = local ? 'LOOM_OAUTH_CLIENT_LOCAL' : 'LOOM_OAUTH_CLIENT';
  const want = local ? LOCAL : REDIRECT;
  const saved = await maybeSecret(name);
  if (saved) { try { const c = JSON.parse(saved); if (c.client_id && c.redirect_uri === want) return c; } catch (_) { /* register again */ } }
  const res = await fetch(String(as.registration_endpoint || AS_FALLBACK.registration_endpoint), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_name: 'Welfare Avenue Hub (Loom pull)', redirect_uris: [want], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none', scope: SCOPE }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.client_id) throw new Error('Atlassian would not register the Hub (' + res.status + '): ' + JSON.stringify(out).slice(0, 200));
  const c = { client_id: String(out.client_id), redirect_uri: want, registered_at: new Date().toISOString() };
  await setSecret(name, JSON.stringify(c), 'The Hub\'s OAuth client registration at Atlassian for the Loom pull (wave162c, loom-connect)' + (local ? ', returning to localhost' : '') + '. Public client with PKCE; no secret.');
  return c;
}
async function tokenCall(as: Json, form: Record<string, string>): Promise<Json> {
  const res = await fetch(String(as.token_endpoint || AS_FALLBACK.token_endpoint), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams(form).toString() });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.access_token) throw new Error('Atlassian said ' + res.status + ': ' + String(out.error_description || out.error || JSON.stringify(out)).slice(0, 200));
  return out;
}

/* a minimal MCP call with the new access token, to check the account can see the Welfare Avenue Loom */
async function mcp(token: string, method: string, params: Json, sid: string, id: number): Promise<{ result: Json; sid: string }> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: 'Bearer ' + token };
  if (sid) { h['Mcp-Session-Id'] = sid; h['MCP-Protocol-Version'] = '2025-06-18'; }
  const res = await fetch(RESOURCE + '?tools=all', { method: 'POST', headers: h, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
  const text = await res.text();
  if (!res.ok) throw new Error('Atlassian answered ' + res.status + ': ' + text.replace(/\s+/g, ' ').slice(0, 160));
  let msg: Json | null = null;
  if (/event-stream/i.test(res.headers.get('content-type') || '')) {
    for (const block of text.replace(/\r\n?/g, '\n').split(/\n\n+/)) { const d = block.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n'); try { const j = JSON.parse(d); if (j.id === id) msg = j; } catch (_) { /* skip */ } }
  } else { try { msg = JSON.parse(text); } catch (_) { msg = null; } }
  if (!msg || msg.error) throw new Error('Atlassian said: ' + JSON.stringify(msg && msg.error || text).slice(0, 160));
  return { result: (msg.result || {}) as Json, sid: res.headers.get('mcp-session-id') || sid };
}
async function checkLoom(token: string): Promise<{ cloudId: string; url: string; account: string }> {
  const a = await mcp(token, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'welfare-avenue-hub-loom-connect', version: '1.0.0' } }, '', 1);
  const sid = a.sid;
  await fetch(RESOURCE + '?tools=all', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: 'Bearer ' + token, 'Mcp-Session-Id': sid, 'MCP-Protocol-Version': '2025-06-18' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) }).then((r) => r.body?.cancel()).catch(() => null);
  const text = (r: Json) => (Array.isArray(r.content) ? r.content : []).map((p: Json) => String(p.text || '')).join('');
  const res = await mcp(token, 'tools/call', { name: 'getAccessibleAtlassianResources', arguments: {} }, sid, 2);
  let sites: Json[] = [];
  try { const d = res.result.structuredContent || JSON.parse(text(res.result)); sites = ((d.data || d).resources || []) as Json[]; } catch (_) { sites = []; }
  const want = await config('loom_cloud_id');
  const site = sites.find((s) => String(s.cloudId || s.id) === want && JSON.stringify(s.products || s.scopes || '').indexOf('loom') >= 0)
    || sites.find((s) => JSON.stringify(s.products || s.scopes || '').indexOf('loom') >= 0);
  let account = '';
  try { const u = await mcp(token, 'tools/call', { name: 'atlassianUserInfo', arguments: {} }, sid, 3); const d = u.result.structuredContent || JSON.parse(text(u.result)); account = String((d.data || d).accountId || ''); } catch (_) { /* fine */ }
  return { cloudId: site ? String(site.cloudId || site.id) : '', url: site ? String(site.url || '') : '', account };
}

/* finish an approval: the code and state from Atlassian's return; answers null when connected, or what went wrong */
async function complete(code: string, state: string): Promise<string | null> {
  const nonce = /^[A-Za-z0-9_-]{20,40}$/.test(state) ? state : (state ? await readState(state) : null);
  if (!nonce || !code) return 'The link expired. Press Connect Loom again.';
  const { data: pend } = await svc.from('loom_oauth_pending').select('*').eq('nonce', nonce).gt('created_at', new Date(Date.now() - 15 * 60000).toISOString()).maybeSingle();
  await svc.from('loom_oauth_pending').delete().eq('nonce', nonce);
  await svc.from('loom_oauth_pending').delete().lt('created_at', new Date(Date.now() - 15 * 60000).toISOString());
  if (!pend || !pend.verifier) return 'That approval was already used or is too old. Press Connect Loom again.';
  const as = await authServer();
  const [verifier, resMode, idMode] = String(pend.verifier).split('|');
  const local = idMode === 'local';
  const c = await client(as, local);
  const clientId = idMode === 'cimd' ? CIMD_URL : String(c.client_id);
  const form: Record<string, string> = { grant_type: 'authorization_code', client_id: clientId, code, redirect_uri: local ? LOCAL : REDIRECT, code_verifier: verifier };
  if (resMode !== 'nores') form.resource = RESOURCE;
  const tok = await tokenCall(as, form);
  if (!tok.refresh_token) return 'Atlassian gave no lasting key (offline access). Press Connect Loom again and approve it.';
  const seen: Json = await checkLoom(String(tok.access_token)).catch((e) => ({ cloudId: '', url: '', account: '', err: String((e as Error).message || e) }));
  if (!seen.cloudId) {
    try { await fetch(String(as.revocation_endpoint || AS_FALLBACK.revocation_endpoint), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: String(tok.refresh_token), client_id: clientId }).toString() }); } catch (_) { /* fine */ }
    return 'That Atlassian account cannot see the Welfare Avenue Loom. Sign in to Atlassian as hub@welfareavenue.com and press Connect Loom again.' + (seen.err ? ' (' + seen.err + ')' : '');
  }
  await setSecret('LOOM_OAUTH_CLIENT', JSON.stringify({ client_id: clientId, redirect_uri: local ? LOCAL : REDIRECT, registered_at: new Date().toISOString(), kind: idMode === 'cimd' ? 'metadata document' : (local ? 'registered, localhost return' : 'registered') }), 'The Hub\'s OAuth client for the Loom pull (wave162c, loom-connect): the one the lasting key belongs to. Public client with PKCE; no secret.');
  await setSecret('LOOM_OAUTH_REFRESH', String(tok.refresh_token), 'The lasting Loom key for the Loom pull (wave162c): an OAuth refresh token for hub@welfareavenue.com, read:loom:agent-interface. Rotates on use.');
  await setSecret('LOOM_OAUTH_ACCESS', JSON.stringify({ t: String(tok.access_token), exp: Date.now() + Math.max(60, Number(tok.expires_in || 3600) - 60) * 1000 }), 'A short-lived Loom access token and its expiry (wave162c).');
  if (!(await config('loom_cloud_id'))) await svc.from('app_config').update({ value: seen.cloudId, updated_at: new Date().toISOString() }).eq('key', 'loom_cloud_id');
  await svc.from('change_log').insert({ entity_type: 'loom', entity_id: 'connection', field: 'connected', old_value: null, new_value: 'Atlassian account ' + (seen.account || 'unknown') + ' on ' + (seen.url || seen.cloudId), changed_by: String(pend.who || 'an admin') });
  return null;
}

async function redirected(url: URL): Promise<Response> {
  if (url.searchParams.get('error')) return back('cancelled', url.searchParams.get('error_description') || url.searchParams.get('error') || '');
  const why = await complete(url.searchParams.get('code') || '', url.searchParams.get('state') || '');
  return why ? back('error', why) : back('connected');
}

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  if (req.method === 'GET') {
    if (/\/client\.json$/.test(url.pathname)) return new Response(JSON.stringify(CIMD), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' } });
    try { return await redirected(url); } catch (e) { return back('error', String((e as Error).message || e)); }
  }
  let who = await admin(req);
  /* the build (trigger secret) may start a connection too, for the first set-up: the approval is still the admin's own */
  if (!who) { try { const s = req.headers.get('x-wa-secret'); if (s && s === (await getSecret('WA_TRIGGER_SECRET'))) who = 'the Hub set-up'; } catch (_) { /* no */ } }
  if (!who) return json({ error: 'Admins connect Loom' }, 401);
  const body = await req.json().catch(() => ({})) as Json;
  const action = String(body.action || 'status');
  try {
    if (action === 'status') return json({ ok: true, connected: !!(await maybeSecret('LOOM_OAUTH_REFRESH')), client: !!(await maybeSecret('LOOM_OAUTH_CLIENT')) });
    if (action === 'start') {
      const as = await authServer();
      const c = await client(as);
      const verifier = rand(48), nonce = rand(24);
      const ins = await svc.from('loom_oauth_pending').insert({ nonce, verifier, who });
      if (ins.error) throw new Error('could not start: ' + ins.error.message);
      const q = new URLSearchParams({ response_type: 'code', client_id: String(c.client_id), redirect_uri: REDIRECT, scope: SCOPE, state: nonce, code_challenge: await sha256(verifier), code_challenge_method: 'S256', resource: RESOURCE, prompt: 'consent' });
      /* set-up only (trigger secret): try a variation of the request while Atlassian's requirements are found */
      const v = who === 'the Hub set-up' && body.variant && typeof body.variant === 'object' ? body.variant as Json : null;
      if (v) {
        if (typeof v.scope === 'string') q.set('scope', v.scope);
        if (v.prompt === false) q.delete('prompt');
        if (v.resource === false) q.delete('resource');
        if (typeof v.audience === 'string') q.set('audience', v.audience);
        if (v.cimd === true) q.set('client_id', CIMD_URL);
        if (v.local === true) { const cl = await client(as, true); q.set('client_id', String(cl.client_id)); q.set('redirect_uri', LOCAL); }
        await svc.from('loom_oauth_pending').update({ verifier: verifier + '|' + (v.resource === false ? 'nores' : 'res') + '|' + (v.cimd === true ? 'cimd' : (v.local === true ? 'local' : 'dcr')) }).eq('nonce', nonce);
      }
      return json({ ok: true, url: String(as.authorization_endpoint || AS_FALLBACK.authorization_endpoint) + '?' + q.toString() });
    }
    if (action === 'finish') {
      /* the localhost return: the admin pastes the address the browser landed on (http://localhost:53682/callback?code=...&state=...) */
      let u: URL; try { u = new URL(String(body.url || '').trim()); } catch (_) { return json({ ok: false, error: 'Paste the whole address from the browser, starting with http://localhost' }, 400); }
      if (u.searchParams.get('error')) return json({ ok: false, error: 'Atlassian said: ' + (u.searchParams.get('error_description') || u.searchParams.get('error')) }, 400);
      const why = await complete(u.searchParams.get('code') || '', u.searchParams.get('state') || '');
      return why ? json({ ok: false, error: why }, 400) : json({ ok: true, connected: true });
    }
    if (action === 'disconnect') {
      const refresh = await maybeSecret('LOOM_OAUTH_REFRESH');
      const c = await maybeSecret('LOOM_OAUTH_CLIENT');
      if (refresh && c) {
        try { const as = await authServer(); await fetch(String(as.revocation_endpoint || AS_FALLBACK.revocation_endpoint), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: refresh, client_id: String(JSON.parse(c).client_id) }).toString() }); } catch (_) { /* forget it anyway */ }
      }
      const { error } = await svc.rpc('loom_oauth_forget');
      if (error) throw new Error(error.message);
      await svc.from('change_log').insert({ entity_type: 'loom', entity_id: 'connection', field: 'connected', old_value: 'connected', new_value: 'disconnected', changed_by: who });
      return json({ ok: true, connected: false });
    }
    return json({ error: 'unknown action ' + action }, 400);
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message || e).slice(0, 300) }, 500);
  }
}

if (Deno.env.get('WA_FN_TEST') !== '1') Deno.serve(handler);
export { handler, readState, makeState, checkLoom };
