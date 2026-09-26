// Welfare Avenue: slack-connect (v3, 26/09/26, wave138)
// v3: never revokes a token the Hub's jobs also use. Slack gives a person the same user token each time they authorize
//   the app, so Steel's mention token is also SLACK_USER_TOKEN (hours-pull, slack-pull): Disconnect (and a refused
//   connection) forgets the token for mentions but only revokes it at Slack when no job uses it.
// Purpose: connect a person's own Slack account to the Hub, so the @mentions they write in the Hub reach the
//   person they mention as a DM from them (notify, event comment_mention), not from the Hub bot.
// Triggered by: the Hub's Settings (Connections, "Send @mentions as you") and Slack's OAuth redirect.
// Auth: POST actions need a Hub sign-in (a staff account that is not blocked); the GET redirect is checked by its
//   signed state (HMAC with WA_TRIGGER_SECRET, 15 minutes). verify_jwt is off because Slack's redirect has no JWT.
// Actions:
//   POST {action:'start'}      -> {url}: Slack's authorize page (user scopes chat:write, im:write) with a signed state
//   GET  ?code=&state=         -> exchanges the code, checks the Slack account's email is the Hub person's own,
//                                 keeps the user token in the vault (slack_link_save), then sends the browser back
//                                 to the Hub with ?slack=connected (or ?slack=error&why=...)
//   POST {action:'status'}     -> {connected, slack_user_id, since, ready}
//   POST {action:'disconnect'} -> forgets the token (slack_link_drop) and revokes it at Slack unless a Hub job uses it (v3)
// Reads: app_config slack_client_id and site_url; vault SLACK_CLIENT_SECRET, SLACK_BOT_TOKEN, WA_TRIGGER_SECRET.
// Writes: vault slack_user_token:<email>, slack_links, wa_slack_ids (the person's Slack id), change_log.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const REDIRECT = SUPABASE_URL + '/functions/v1/slack-connect';
const SCOPES = 'chat:write,im:write';
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
async function config(key: string): Promise<string> {
  const { data } = await svc.from('app_config').select('value').eq('key', key).maybeSingle();
  return String(data?.value || '');
}
async function siteUrl(): Promise<string> { return (await config('site_url')) || 'https://wa-exec-dashboard.netlify.app'; }
/* v3: a token the Hub's own jobs use (the same person authorizing the same app gets the same token) is never revoked here */
const SHARED_TOKENS = ['SLACK_USER_TOKEN'];
async function sharedToken(token: string): Promise<boolean> {
  for (const n of SHARED_TOKENS) { try { if ((await getSecret(n)) === token) return true; } catch (_) { /* not set */ } }
  return false;
}
async function revoke(token: string): Promise<'revoked' | 'kept' | 'failed'> {
  if (await sharedToken(token)) return 'kept';
  try { await fetch('https://slack.com/api/auth.revoke', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }); return 'revoked'; } catch (_) { return 'failed'; }
}

/* the signed-in Hub person: staff, and not blocked */
async function who(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  if (!email) return null;
  try { const s = await asUser.rpc('is_wa_staff'); if (s.data !== true) return null; } catch (_) { return null; }
  return email;
}

/* state = base64url(email|expiry|hmac) */
function b64u(bytes: Uint8Array): string { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64u(s: string): string { const p = s.replace(/-/g, '+').replace(/_/g, '/'); return atob(p + '==='.slice((p.length + 3) % 4)); }
async function hmac(text: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(await getSecret('WA_TRIGGER_SECRET')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text))));
}
async function makeState(email: string): Promise<string> {
  const body = email + '|' + (Date.now() + 15 * 60000);
  return b64u(new TextEncoder().encode(body + '|' + await hmac(body)));
}
async function readState(state: string): Promise<string | null> {
  try {
    const raw = unb64u(state); const i = raw.lastIndexOf('|'); if (i < 0) return null;
    const body = raw.slice(0, i), sig = raw.slice(i + 1);
    if (sig !== await hmac(body)) return null;
    const [email, exp] = body.split('|');
    if (!email || !(Number(exp) > Date.now())) return null;
    return email;
  } catch (_) { return null; }
}

async function back(result: string, why?: string): Promise<Response> {
  const q = '?slack=' + encodeURIComponent(result) + (why ? '&why=' + encodeURIComponent(why.slice(0, 120)) : '');
  return new Response(null, { status: 302, headers: { Location: (await siteUrl()).replace(/\/+$/, '') + '/' + q + '#mypage' } });
}

async function slackEmailOf(userId: string): Promise<string> {
  const bot = await getSecret('SLACK_BOT_TOKEN');
  const r = await fetch('https://slack.com/api/users.info?user=' + encodeURIComponent(userId), { headers: { Authorization: 'Bearer ' + bot } });
  const b = await r.json();
  return String(b?.user?.profile?.email || '').toLowerCase();
}

async function redirected(url: URL): Promise<Response> {
  if (url.searchParams.get('error')) return back('cancelled', url.searchParams.get('error') || '');
  const code = url.searchParams.get('code') || '', state = url.searchParams.get('state') || '';
  const email = await readState(state);
  if (!email || !code) return back('error', 'The link expired. Try Connect again.');
  const clientId = await config('slack_client_id');
  let secret = '';
  try { secret = await getSecret('SLACK_CLIENT_SECRET'); } catch (_) { return back('error', 'The Hub is missing the Slack app secret.'); }
  const form = new URLSearchParams({ client_id: clientId, client_secret: secret, code, redirect_uri: REDIRECT });
  const res = await fetch('https://slack.com/api/oauth.v2.access', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
  const out = await res.json();
  if (!out.ok || !out.authed_user?.access_token) return back('error', 'Slack said: ' + String(out.error || 'no user token'));
  const token = String(out.authed_user.access_token), slackId = String(out.authed_user.id || ''), scopes = String(out.authed_user.scope || '');
  /* the Slack account must be the person's own */
  const slackEmail = await slackEmailOf(slackId).catch(() => '');
  const aliases = new Set([email]);
  try { const { data: d } = await svc.from('hub_directory').select('email, aliases').ilike('email', email).maybeSingle(); ((d?.aliases || []) as string[]).forEach(a => aliases.add(String(a).toLowerCase())); } catch (_) { /* fine */ }
  if (!slackEmail || !aliases.has(slackEmail)) {
    await revoke(token);
    return back('error', 'That Slack account is ' + (slackEmail || 'not a Welfare Avenue account') + ', not ' + email + '.');
  }
  if (scopes.indexOf('chat:write') < 0 || scopes.indexOf('im:write') < 0) return back('error', 'Slack did not grant chat:write and im:write. Ask Steel to add them to the app.');
  const { error } = await svc.rpc('slack_link_save', { p_email: email, p_user_id: slackId, p_team_id: String(out.team?.id || ''), p_scopes: scopes, p_token: token });
  if (error) return back('error', 'Could not save the connection.');
  try { await svc.from('wa_slack_ids').upsert({ email, slack_id: slackId, source: 'slack-connect', updated_at: new Date().toISOString() }); } catch (_) { /* fine */ }
  return back('connected');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  if (req.method === 'GET') {
    try { return await redirected(url); } catch (e) { return back('error', String((e as Error).message || e)); }
  }
  const email = await who(req);
  if (!email) return json({ error: 'Sign in to the Hub first.' }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'status');
  const clientId = await config('slack_client_id');
  let ready = !!clientId;
  try { ready = ready && !!(await getSecret('SLACK_CLIENT_SECRET')); } catch (_) { ready = false; }
  if (action === 'status') {
    const { data } = await svc.from('slack_links').select('slack_user_id, connected_at, updated_at').eq('email', email).maybeSingle();
    return json({ ok: true, connected: !!data, slack_user_id: data?.slack_user_id || null, since: data?.connected_at || null, ready });
  }
  if (action === 'start') {
    if (!ready) return json({ ok: false, error: 'The Slack app is not set up for this yet.' });
    const u = 'https://slack.com/oauth/v2/authorize?client_id=' + encodeURIComponent(clientId) + '&user_scope=' + encodeURIComponent(SCOPES) +
      '&redirect_uri=' + encodeURIComponent(REDIRECT) + '&state=' + encodeURIComponent(await makeState(email));
    return json({ ok: true, url: u });
  }
  if (action === 'disconnect') {
    try { const t = await getSecret('slack_user_token:' + email); await revoke(t); } catch (_) { /* already gone */ }
    const { error } = await svc.rpc('slack_link_drop', { p_email: email });
    return json(error ? { ok: false, error: 'Could not forget the connection.' } : { ok: true });
  }
  return json({ error: 'unknown action' }, 400);
});
