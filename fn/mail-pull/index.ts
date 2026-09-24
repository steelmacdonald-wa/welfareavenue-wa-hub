// Welfare Avenue: mail-pull (v1, 24/09/26)
// Reads the hub@welfareavenue.com inbox through the service account with
// Google Workspace domain-wide delegation (client id 107460787452614031265,
// scopes gmail.readonly + calendar.readonly). v1 is the probe: it proves the
// delegation works and shows what the inbox holds. The ingestion actions
// (invoices -> Finances, Loom/Otter summaries -> transcripts, cc'd threads ->
// updates) follow once Steel has seen the probe.
// Actions (POST {action}):
//   'probe'  : profile + label count + the newest messages (subject, from, date)
// Auth: staff JWT or x-wa-secret (cron via public.call_edge).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const HUB = 'hub@welfareavenue.com';
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
async function staffEmail(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  return email.endsWith('@welfareavenue.com') || email === 'steelmacdonald@gmail.com' ? email : null;
}

/* ---- delegated Google token: the service account acts as hub@ ---- */
function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const raw = atob(body);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
let TOKEN: { value: string; exp: number } | null = null;
async function delegatedToken(): Promise<{ token: string; sa: string }> {
  const sa = JSON.parse(await getSecret('GOOGLE_SA_KEY'));
  if (TOKEN && Date.now() < TOKEN.exp - 60000) return { token: TOKEN.value, sa: sa.client_email };
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(enc.encode(JSON.stringify({
    iss: sa.client_email,
    sub: HUB,
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    aud: sa.token_uri,
    iat: now, exp: now + 3600
  })));
  const signingInput = header + '.' + claims;
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(signingInput)));
  const assertion = signingInput + '.' + b64url(sig);
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
  });
  const body = await res.json();
  if (!body.access_token) throw new Error('delegation failed: ' + JSON.stringify(body).slice(0, 300));
  TOKEN = { value: body.access_token, exp: Date.now() + (body.expires_in || 3600) * 1000 };
  return { token: TOKEN.value, sa: sa.client_email };
}
async function gmail(token: string, path: string): Promise<any> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me' + path, { headers: { Authorization: 'Bearer ' + token } });
  const b = await res.json().catch(() => null);
  if (!res.ok) throw new Error('gmail ' + path + ' -> ' + res.status + ' ' + JSON.stringify(b).slice(0, 200));
  return b;
}
function hdr(msg: any, name: string): string {
  const hs = (msg && msg.payload && msg.payload.headers) || [];
  const h = hs.find((x: any) => String(x.name).toLowerCase() === name.toLowerCase());
  return h ? String(h.value) : '';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let caller = await staffEmail(req);
  if (!caller) {
    try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) caller = 'automation'; } catch (_) { /* no */ }
  }
  if (!caller) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'probe');
  try {
    if (action === 'probe') {
      const { token, sa } = await delegatedToken();
      const profile = await gmail(token, '/profile');
      const labels = await gmail(token, '/labels');
      const list = await gmail(token, '/messages?maxResults=' + Math.min(25, Number(body.max || 12)) + '&q=' + encodeURIComponent(String(body.q || '')));
      const ids = (list.messages || []).map((m: any) => m.id);
      const rows: any[] = [];
      for (const id of ids) {
        const m = await gmail(token, '/messages/' + id + '?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Date');
        rows.push({ id, date: hdr(m, 'Date'), from: hdr(m, 'From'), to: hdr(m, 'To'), cc: hdr(m, 'Cc'), subject: hdr(m, 'Subject'), snippet: String(m.snippet || '').slice(0, 160), labels: m.labelIds || [], attachments: ((m.payload && m.payload.parts) || []).filter((p: any) => p.filename).length });
      }
      return json({ ok: true, as: HUB, service_account: sa, email: profile.emailAddress, messages_total: profile.messagesTotal, threads_total: profile.threadsTotal, labels: (labels.labels || []).map((l: any) => l.name), newest: rows });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 500) }, 500);
  }
});
