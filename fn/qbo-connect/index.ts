// Welfare Avenue: qbo-connect (v4, 10/11/26, wave302). v4 (Intuit's security requirements): the access and refresh
// tokens are stored AES-256-GCM encrypted ('v1:' + iv + ciphertext); the key is QBO_TOKEN_KEY from the vault when it
// exists, otherwise derived with HKDF-SHA-256 from the vault's WA_TRIGGER_SECRET (never stored with the data); tokens
// stored before v4 are re-encrypted on first use; every response is Cache-Control: no-store.
// v3: retries a failed token or API call once (network and 5xx only;
// an expired access token is refreshed and the call tried again), and when Intuit refuses the refresh token
// (invalid_grant: disconnected from QuickBooks, or 100 days unused) the connection is marked 'reconnect' so the Hub
// asks an admin to connect again; a daily keep-alive (cron wa-qbo-keepalive) keeps the refresh token rolling.
// v2: after connecting, straight back to Finance (supabase.co serves no HTML).
// The Hub's door to Welfare Avenue's QuickBooks Online company, through WA's own Intuit app (Claude's QuickBooks
// connector is not offered to Canadian companies). OAuth 2.0: a staff member who can open Finance asks for a sign-in
// link (action 'start'), approves in Intuit, and Intuit sends them back here (GET with code, state and realmId).
// Tokens are kept in qbo_connection (service role only); the access token is refreshed as needed and the refresh
// token rotates on every refresh. 'status' reads the company and its settings (are Classes on?) so the Hub never
// turns anything on in QuickBooks without asking. Writing to QuickBooks comes in the next step, after Steel's yes.
// Vault: QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_ENV ('production' or 'sandbox'). Redirect URI to register in the
// Intuit app: https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/qbo-connect
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const SELF = 'https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/qbo-connect';
const HUB = 'https://hub.welfareavenue.com/';
const AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';
const SCOPE = 'com.intuit.quickbooks.accounting';
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const NOSTORE = { 'Cache-Control': 'no-store, no-cache', Pragma: 'no-cache' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, ...NOSTORE, 'Content-Type': 'application/json' } });

async function secret(name: string): Promise<string | null> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  return error || !data ? null : String(data);
}
async function creds() {
  const [id, sec, env] = await Promise.all([secret('QBO_CLIENT_ID'), secret('QBO_CLIENT_SECRET'), secret('QBO_ENV')]);
  if (!id || !sec) throw new Error('The Intuit app keys are not in the vault yet (QBO_CLIENT_ID, QBO_CLIENT_SECRET).');
  return { id, sec, env: env === 'sandbox' ? 'sandbox' : 'production' };
}
const apiBase = (env: string) => env === 'sandbox' ? 'https://sandbox-quickbooks.api.intuit.com' : 'https://quickbooks.api.intuit.com';

async function caller(req: Request): Promise<string | null> {
  const given = req.headers.get('x-wa-secret');
  if (given && given === (await secret('WA_TRIGGER_SECRET'))) return 'automation';
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ') || auth === 'Bearer ' + ANON_KEY) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  if (!email) return null;
  const [{ data: staff }, { data: page }] = await Promise.all([asUser.rpc('is_wa_staff'), asUser.rpc('wa_page_ok', { p_tab: 'finances' })]);
  return staff === true && page !== false ? email : null;
}

/* v4: the tokens at rest, AES-256-GCM */
let aesKey: CryptoKey | null = null;
async function tokenKey(): Promise<CryptoKey> {
  if (aesKey) return aesKey;
  const own = await secret('QBO_TOKEN_KEY');
  if (own) {
    const raw = Uint8Array.from(atob(own.trim()), c => c.charCodeAt(0));
    aesKey = await crypto.subtle.importKey('raw', raw.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt']);
  } else {
    const master = await secret('WA_TRIGGER_SECRET');
    if (!master) throw new Error('No key for the QuickBooks tokens.');
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(master), 'HKDF', false, ['deriveKey']);
    aesKey = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode('wa-hub/qbo-connect'), info: new TextEncoder().encode('qbo-token-aes-v1') }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  return aesKey;
}
const b64 = (u: Uint8Array) => { let s = ''; for (const x of u) s += String.fromCharCode(x); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function seal(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await tokenKey(), new TextEncoder().encode(plain)));
  return 'v1:' + b64(iv) + ':' + b64(ct);
}
async function unseal(stored: string | null): Promise<string | null> {
  if (!stored) return null;
  if (!stored.startsWith('v1:')) return stored;   // stored before v4: still readable, re-sealed on first use
  const [, iv, ct] = stored.split(':');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await tokenKey(), unb64(ct));
  return new TextDecoder().decode(pt);
}

/* state: who asked and when, signed with the Hub's trigger secret, good for 15 minutes */
const enc = new TextEncoder();
function b64u(b: Uint8Array) { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64u(s: string) { const t = atob(s.replace(/-/g, '+').replace(/_/g, '/')); return new TextDecoder().decode(Uint8Array.from(t, c => c.charCodeAt(0))); }
async function hmac(msg: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode((await secret('WA_TRIGGER_SECRET')) || ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(msg))));
}
async function makeState(email: string) { const p = b64u(enc.encode(JSON.stringify({ e: email, t: Date.now(), n: crypto.randomUUID() }))); return p + '.' + (await hmac(p)); }
async function readState(s: string): Promise<{ e: string } | null> {
  const [p, sig] = (s || '').split('.');
  if (!p || !sig || sig !== (await hmac(p))) return null;
  try { const o = JSON.parse(unb64u(p)); return Date.now() - Number(o.t) < 15 * 60 * 1000 ? o : null; } catch (_) { return null; }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
class Reconnect extends Error {}
async function tokenCall(params: Record<string, string>) {
  const c = await creds();
  let last = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(TOKEN_URL, { method: 'POST', headers: { Authorization: 'Basic ' + btoa(c.id + ':' + c.sec), Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
    } catch (e) { last = 'network: ' + String((e as Error).message || e).slice(0, 120); await sleep(1500); continue; }
    const b = await res.json().catch(() => ({}));
    if (res.ok && b.access_token) return { b, env: c.env };
    last = String(b.error_description || b.error || res.status).slice(0, 200);
    if (b.error === 'invalid_grant' || res.status === 400 || res.status === 401) throw new Reconnect('Intuit token: ' + last);
    if (res.status >= 500 || res.status === 429) { await sleep(1500 * (attempt + 1)); continue; }
    break;
  }
  throw new Error('Intuit token: ' + last);
}
async function markReconnect(why: string) {
  await svc.from('qbo_connection').update({ access_token: null, access_expires_at: null, last_error: 'reconnect: ' + why.slice(0, 200), updated_at: new Date().toISOString() }).eq('id', 1);
  try { await svc.from('change_log').insert({ entity_type: 'qbo', entity_id: 'connection', field: 'needs reconnect', old_value: null, new_value: why.slice(0, 200), changed_by: 'qbo-connect' }); } catch (_) { /* audit */ }
}
async function tokenRow(b: Record<string, unknown>) {
  const now = Date.now();
  return { access_token: await seal(String(b.access_token)), access_expires_at: new Date(now + Number(b.expires_in || 3600) * 1000).toISOString(),
    refresh_token: await seal(String(b.refresh_token)), refresh_expires_at: new Date(now + Number(b.x_refresh_token_expires_in || 8640000) * 1000).toISOString(),
    last_error: null, updated_at: new Date().toISOString() };
}
async function accessToken(): Promise<{ tok: string; realm: string; env: string }> {
  const { data: row } = await svc.from('qbo_connection').select('*').eq('id', 1).maybeSingle();
  if (!row?.refresh_token || !row.realm_id) throw new Error('QuickBooks is not connected yet.');
  const refresh = await unseal(row.refresh_token);
  if (row.access_token && new Date(row.access_expires_at).getTime() - Date.now() > 60000) {
    const tok = await unseal(row.access_token);
    if (!String(row.refresh_token).startsWith('v1:') || !String(row.access_token).startsWith('v1:')) {
      await svc.from('qbo_connection').update({ access_token: await seal(String(tok)), refresh_token: await seal(String(refresh)) }).eq('id', 1);
    }
    return { tok: String(tok), realm: row.realm_id, env: row.env };
  }
  try {
    const { b } = await tokenCall({ grant_type: 'refresh_token', refresh_token: String(refresh) });
    await svc.from('qbo_connection').update(await tokenRow(b)).eq('id', 1);
    return { tok: String(b.access_token), realm: row.realm_id, env: row.env };
  } catch (e) {
    if (e instanceof Reconnect) await markReconnect((e as Error).message);
    throw e;
  }
}
async function forceRefresh() { await svc.from('qbo_connection').update({ access_expires_at: new Date(0).toISOString() }).eq('id', 1); }
async function qbo(path: string) {
  let lastErr = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const a = await accessToken();
    let res: Response;
    try {
      res = await fetch(apiBase(a.env) + '/v3/company/' + a.realm + '/' + path + (path.includes('?') ? '&' : '?') + 'minorversion=75', { headers: { Authorization: 'Bearer ' + a.tok, Accept: 'application/json' } });
    } catch (e) { lastErr = 'network: ' + String((e as Error).message || e).slice(0, 120); await sleep(1500); continue; }
    const b = await res.json().catch(() => ({}));
    if (res.ok) return b;
    lastErr = 'QuickBooks ' + res.status + ': ' + JSON.stringify(b.Fault || b).slice(0, 200);
    if (res.status === 401 && attempt === 0) { await forceRefresh(); continue; }   // the access token was refused: refresh it and try once more
    if ((res.status >= 500 || res.status === 429) && attempt === 0) { await sleep(2000); continue; }
    break;
  }
  throw new Error(lastErr);
}
async function refreshStatus() {
  const { data: row } = await svc.from('qbo_connection').select('realm_id').eq('id', 1).maybeSingle();
  const info = await qbo('companyinfo/' + row?.realm_id);
  const prefs = await qbo('preferences');
  const acc = prefs?.Preferences?.AccountingInfoPrefs || {};
  const p = { classes_per_txn: !!acc.ClassTrackingPerTxn, classes_per_line: !!acc.ClassTrackingPerTxnLine, locations: !!acc.TrackDepartments, location_label: acc.DepartmentTerminology || null,
    currency: prefs?.Preferences?.CurrencyPrefs?.HomeCurrency?.value || null, multi_currency: !!prefs?.Preferences?.CurrencyPrefs?.MultiCurrencyEnabled };
  const company = info?.CompanyInfo?.CompanyName || info?.CompanyInfo?.LegalName || null;
  await svc.from('qbo_connection').update({ company_name: company, prefs: p, updated_at: new Date().toISOString() }).eq('id', 1);
  return { connected: true, company, prefs: p };
}
function page(title: string, body: string, ok: boolean) {
  /* v2: Supabase serves function responses on supabase.co as plain text, so no HTML page here: a successful
     connection goes straight back to Finance (the Today chip then shows the company); anything else is a short
     plain-text note with the way back. */
  if (ok && title === 'QuickBooks is connected') return new Response(null, { status: 302, headers: { ...NOSTORE, Location: HUB + '#finances' } });
  const text = title + '\n\n' + body.replace(/<[^>]+>/g, '').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"') + '\n\nBack to Finance: ' + HUB + '#finances\n';
  return new Response(text, { status: ok ? 200 : 400, headers: { ...NOSTORE, 'Content-Type': 'text/plain; charset=utf-8' } });
}
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  if (req.method === 'GET') {
    if (url.searchParams.get('error')) return page('Not connected', 'QuickBooks said: ' + esc(url.searchParams.get('error') || '') + '. Nothing changed.', false);
    const code = url.searchParams.get('code');
    if (!code) return page('WA Hub and QuickBooks', 'This is the Hub&#39;s QuickBooks connection. Start it from Finance in the Hub.', true);
    const st = await readState(url.searchParams.get('state') || '');
    if (!st) return page('Link expired', 'That sign-in link is older than 15 minutes or was not made by the Hub. Start again from Finance.', false);
    const realm = url.searchParams.get('realmId') || '';
    try {
      const { b, env } = await tokenCall({ grant_type: 'authorization_code', code, redirect_uri: SELF });
      await svc.from('qbo_connection').upsert({ id: 1, env, realm_id: realm, ...(await tokenRow(b)), connected_by: st.e, connected_at: new Date().toISOString() });
      let name = '';
      try { const s = await refreshStatus(); name = s.company || ''; } catch (e) { await svc.from('qbo_connection').update({ last_error: String((e as Error).message).slice(0, 300) }).eq('id', 1); }
      try { await svc.from('change_log').insert({ entity_type: 'qbo', entity_id: realm, field: 'connected', old_value: null, new_value: name || realm, changed_by: st.e }); } catch (_) { /* audit */ }
      return page('QuickBooks is connected', 'The Hub is now connected to ' + esc(name || 'your QuickBooks company') + '. It reads only, until you approve what it may change.', true);
    } catch (e) {
      return page('Not connected', esc(String((e as Error).message || e)), false);
    }
  }
  const who = await caller(req);
  if (!who) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'status');
  try {
    if (action === 'start') {
      const c = await creds();
      const q = new URLSearchParams({ client_id: c.id, response_type: 'code', scope: SCOPE, redirect_uri: SELF, state: await makeState(who) });
      return json({ url: AUTH_URL + '?' + q.toString(), env: c.env });
    }
    if (action === 'status') {
      const { data: row } = await svc.from('qbo_connection').select('refresh_token, last_error').eq('id', 1).maybeSingle();
      if (!row?.refresh_token) return json({ connected: false, keys: !!(await secret('QBO_CLIENT_ID')) });
      if (String(row.last_error || '').startsWith('reconnect:')) return json({ connected: false, reconnect: true, why: row.last_error });
      try { return json(await refreshStatus()); }
      catch (e) { if (e instanceof Reconnect) return json({ connected: false, reconnect: true, why: String((e as Error).message) }); throw e; }
    }
    if (action === 'disconnect') {
      const { data: row } = await svc.from('qbo_connection').select('refresh_token').eq('id', 1).maybeSingle();
      if (row?.refresh_token) {
        const c = await creds();
        await fetch(REVOKE_URL, { method: 'POST', headers: { Authorization: 'Basic ' + btoa(c.id + ':' + c.sec), Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ token: await unseal(row.refresh_token) }) });
      }
      await svc.from('qbo_connection').update({ access_token: null, refresh_token: null, access_expires_at: null, refresh_expires_at: null, updated_at: new Date().toISOString() }).eq('id', 1);
      try { await svc.from('change_log').insert({ entity_type: 'qbo', entity_id: 'connection', field: 'disconnected', old_value: null, new_value: 'disconnected', changed_by: who }); } catch (_) { /* audit */ }
      return json({ connected: false });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
