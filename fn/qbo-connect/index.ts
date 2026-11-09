// Welfare Avenue: qbo-connect (v1, 09/11/26, wave302)
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
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

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

async function tokenCall(params: Record<string, string>) {
  const c = await creds();
  const res = await fetch(TOKEN_URL, { method: 'POST', headers: { Authorization: 'Basic ' + btoa(c.id + ':' + c.sec), Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
  const b = await res.json().catch(() => ({}));
  if (!res.ok || !b.access_token) throw new Error('Intuit token: ' + String(b.error_description || b.error || res.status).slice(0, 200));
  return { b, env: c.env };
}
function tokenRow(b: Record<string, unknown>) {
  const now = Date.now();
  return { access_token: String(b.access_token), access_expires_at: new Date(now + Number(b.expires_in || 3600) * 1000).toISOString(),
    refresh_token: String(b.refresh_token), refresh_expires_at: new Date(now + Number(b.x_refresh_token_expires_in || 8640000) * 1000).toISOString(),
    last_error: null, updated_at: new Date().toISOString() };
}
async function accessToken(): Promise<{ tok: string; realm: string; env: string }> {
  const { data: row } = await svc.from('qbo_connection').select('*').eq('id', 1).maybeSingle();
  if (!row?.refresh_token || !row.realm_id) throw new Error('QuickBooks is not connected yet.');
  if (row.access_token && new Date(row.access_expires_at).getTime() - Date.now() > 60000) return { tok: row.access_token, realm: row.realm_id, env: row.env };
  const { b } = await tokenCall({ grant_type: 'refresh_token', refresh_token: row.refresh_token });
  await svc.from('qbo_connection').update(tokenRow(b)).eq('id', 1);
  return { tok: String(b.access_token), realm: row.realm_id, env: row.env };
}
async function qbo(path: string) {
  const a = await accessToken();
  const res = await fetch(apiBase(a.env) + '/v3/company/' + a.realm + '/' + path + (path.includes('?') ? '&' : '?') + 'minorversion=75', { headers: { Authorization: 'Bearer ' + a.tok, Accept: 'application/json' } });
  const b = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('QuickBooks ' + res.status + ': ' + JSON.stringify(b.Fault || b).slice(0, 200));
  return b;
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
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FFFAF2;color:#1F201E;font:16px/1.55 'Space Grotesk','Helvetica Neue',Arial,sans-serif}
main{max-width:460px;padding:32px;text-align:center}h1{font:600 34px/1.1 'Barlow Condensed','Arial Narrow',sans-serif;text-transform:uppercase;color:#103F39;margin:0 0 12px}
a{display:inline-block;margin-top:16px;padding:12px 22px;border-radius:8px;background:${ok ? '#DCA527' : '#103F39'};color:${ok ? '#103F39' : '#FFFAF2'};text-decoration:none;font-weight:600}</style></head>
<body><main><h1>${title}</h1><p>${body}</p><a href="${HUB}#finances">Back to Finance</a></main></body></html>`;
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
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
      await svc.from('qbo_connection').upsert({ id: 1, env, realm_id: realm, ...tokenRow(b), connected_by: st.e, connected_at: new Date().toISOString() });
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
      const { data: row } = await svc.from('qbo_connection').select('refresh_token').eq('id', 1).maybeSingle();
      if (!row?.refresh_token) return json({ connected: false, keys: !!(await secret('QBO_CLIENT_ID')) });
      return json(await refreshStatus());
    }
    if (action === 'disconnect') {
      const { data: row } = await svc.from('qbo_connection').select('refresh_token').eq('id', 1).maybeSingle();
      if (row?.refresh_token) {
        const c = await creds();
        await fetch(REVOKE_URL, { method: 'POST', headers: { Authorization: 'Basic ' + btoa(c.id + ':' + c.sec), Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ token: row.refresh_token }) });
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
