// Welfare Avenue: quo-events (v1, wave171, 30/09/26)
// Purpose: the Quo (OpenPhone) webhook. Every text someone sends to the ops line (438) 808-7754 lands here
//   (message.received), is filed in quo_messages (direction in) matched to the volunteer and their next serving, and
//   acted on by wa171_inbound: YES/OUI confirms, NO/NON marks Unavailable, STOP/ARRET stops texts; anything else waits
//   for a person in the event's Replies (the planned wave169b will answer questions).
// Trigger: Quo, set up by quo-send webhook_setup. Auth: verify_jwt is off; the signature is the check (the signing key
//   in the vault as QUO_WEBHOOK_SECRET). Both of Quo's formats are accepted: Standard Webhooks (webhook-id,
//   webhook-timestamp, webhook-signature "v1,<base64>", key "whsec_..." base64) and the older OpenPhone header
//   (openphone-signature "hmac;1;<timestamp>;<base64>", key base64). Deliveries older than 10 minutes are refused.
// Only texts to app_config quo_phone_number_id are filed (when Quo says which number).
// Tables: quo_messages and event_roster and crm_contacts through wa171_inbound. Side effects: after a YES or NO it asks
//   quo-send to drain, which sends the short thank-you (sms_mode decides; test mode: only the test phones).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);

async function getSecret(name: string): Promise<string | null> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) return null;
  return data as string;
}
function b64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(b: ArrayBuffer): string {
  let s = ''; const a = new Uint8Array(b);
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s);
}
async function hmac(keyBytes: Uint8Array, data: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return bytesToB64(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)));
}
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function verify(req: Request, raw: string, secret: string): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const keyStr = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try { keyBytes = b64ToBytes(keyStr); } catch (_) { keyBytes = new TextEncoder().encode(keyStr); }
  const sig = req.headers.get('webhook-signature');
  if (sig) {
    const id = req.headers.get('webhook-id') || '';
    const ts = req.headers.get('webhook-timestamp') || '';
    if (!id || !ts || Math.abs(now - Number(ts)) > 600) return false;
    const want = await hmac(keyBytes, id + '.' + ts + '.' + raw);
    return sig.split(' ').some(p => { const [v, s] = p.split(','); return v === 'v1' && !!s && same(s, want); });
  }
  const old = req.headers.get('openphone-signature');
  if (old) {
    const parts = old.split(';');
    if (parts.length < 4 || parts[0] !== 'hmac') return false;
    const ts = parts[2]; const given = parts[3];
    const tsNum = Number(ts) > 1e12 ? Math.floor(Number(ts) / 1000) : Number(ts);
    if (!tsNum || Math.abs(now - tsNum) > 600) return false;
    const want = await hmac(keyBytes, ts + '.' + raw);
    return same(given, want);
  }
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('ok', { status: 200 });
  const raw = await req.text();
  const secret = await getSecret('QUO_WEBHOOK_SECRET');
  if (!secret) return new Response('not set up', { status: 401 });
  if (!(await verify(req, raw, secret))) return new Response('bad signature', { status: 401 });
  let ev: any = {};
  try { ev = JSON.parse(raw); } catch (_) { return new Response('bad json', { status: 400 }); }

  // two shapes: the current envelope {type, data:{resource, context}} and the older {type, data:{object}}
  const type = String(ev.type || ev.object?.type || '');
  if (type !== 'message.received') return new Response(JSON.stringify({ ignored: type }), { status: 200 });
  const res = ev.data?.resource;
  const ctx = ev.data?.context;
  const obj = ev.data?.object || ev.object?.data?.object;
  const from = String((ctx && ctx.senderIdentifier) || (obj && obj.from) || '');
  const text = String((res && res.text) ?? (obj && (obj.body ?? obj.text)) ?? '');
  const qid = String((res && res.id) || (obj && obj.id) || req.headers.get('webhook-id') || ev.id || '');
  const at = String((res && res.createdAt) || (obj && obj.createdAt) || ev.createdAt || new Date().toISOString());
  const numberId = String((ctx && ctx.phoneNumberId) || (obj && obj.phoneNumberId) || '');
  if (numberId) {
    const { data: c } = await svc.from('app_config').select('value').eq('key', 'quo_phone_number_id').maybeSingle();
    if (c && c.value && c.value !== numberId) return new Response(JSON.stringify({ ignored: 'another number' }), { status: 200 });
  }
  const { data, error } = await svc.rpc('wa171_inbound', { p: { phone: from, text, quo_id: qid, at } });
  if (error) { console.error('wa171_inbound', error); return new Response('could not file', { status: 500 }); }
  if (data && data.ack) {
    const trig = await getSecret('WA_TRIGGER_SECRET');
    if (trig) {
      try {
        await fetch(SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/quo-send', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ANON_KEY, 'x-wa-secret': trig },
          body: JSON.stringify({ action: 'drain' }),
        });
      } catch (e) { console.error('drain', e); }
    }
  }
  return new Response(JSON.stringify({ ok: true, handled: data && data.handled }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
