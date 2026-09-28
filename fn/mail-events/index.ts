// Welfare Avenue: mail-events (v1, 28/09/26, wave154)
// Resend's webhook: what happened to each email the Hub sent. Verifies the Svix signature with
// RESEND_WEBHOOK_SECRET (vault, stored by mail-send webhook_setup), keeps every event once in
// crm_email_events (svix-id), and updates the send log (crm_email_sends), the contact's timeline entry
// (crm_interactions meta.status) and, on a hard bounce or a complaint, the contact's email_status, so the
// CASL rule stops the next send on its own.
// Trigger: Resend (POST). Auth: the Svix signature only (verify_jwt off; a bad or old signature is a 401).
// Events: email.sent, email.delivered, email.delivery_delayed, email.bounced, email.complained, email.opened,
//   email.clicked, email.failed. Anything else is stored and ignored.
// Tables: crm_email_events, crm_email_sends, crm_interactions, crm_contacts.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
const RANK: Record<string, number> = { queued: 0, sent: 1, delayed: 2, delivered: 3, bounced: 9, complained: 9, failed: 9, suppressed: 9 };

async function getSecret(name: string): Promise<string | null> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  return error || !data ? null : String(data);
}
function b64(bytes: Uint8Array): string { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s); }
function same(a: string, b: string): boolean { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
async function verify(secret: string, id: string, ts: string, sigHeader: string, body: string): Promise<boolean> {
  if (!id || !ts || !sigHeader) return false;
  const t = Number(ts); if (!isFinite(t) || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const raw = secret.replace(/^whsec_/, '');
  const keyBytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(id + '.' + ts + '.' + body)));
  const expected = b64(mac);
  return sigHeader.split(' ').some(part => { const [v, val] = part.split(','); return v === 'v1' && !!val && same(val, expected); });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const raw = await req.text();
  const secret = await getSecret('RESEND_WEBHOOK_SECRET');
  if (!secret) return json({ error: 'webhook secret not set' }, 503);
  const svixId = req.headers.get('svix-id') || '', svixTs = req.headers.get('svix-timestamp') || '', svixSig = req.headers.get('svix-signature') || '';
  if (!(await verify(secret, svixId, svixTs, svixSig, raw))) return json({ error: 'bad signature' }, 401);
  let ev: any; try { ev = JSON.parse(raw); } catch (_) { return json({ error: 'bad json' }, 400); }
  const type = String(ev.type || ''), d = ev.data || {}, rid = String(d.email_id || '');
  const at = String(ev.created_at || d.created_at || new Date().toISOString());
  const ins = await svc.from('crm_email_events').insert({ svix_id: svixId, type, resend_id: rid || null, payload: ev }).select('id').single();
  if (ins.error) { if (String(ins.error.code) === '23505') return json({ ok: true, duplicate: true }); return json({ error: ins.error.message }, 500); }
  if (!rid) return json({ ok: true, note: 'no email id' });
  const s = await svc.from('crm_email_sends').select('id,contact_id,status,meta,opened_at,clicked_at,delivered_at,is_test').eq('resend_id', rid).maybeSingle();
  if (!s.data) return json({ ok: true, note: 'not a Hub send' });
  const send = s.data as any;
  const patch: Record<string, unknown> = {};
  const meta = Object.assign({}, send.meta || {});
  let status: string | null = null, contactStatus: string | null = null;
  switch (type) {
    case 'email.sent': status = 'sent'; break;
    case 'email.delivered': status = 'delivered'; patch.delivered_at = at; break;
    case 'email.delivery_delayed': status = 'delayed'; meta.delayed_at = at; break;
    case 'email.bounced': {
      status = 'bounced'; patch.bounced_at = at;
      const b = d.bounce || {};
      meta.bounce = { type: b.type || null, subType: b.subType || null, message: String(b.message || '').slice(0, 400) };
      patch.error = ('bounce ' + (b.type || '') + ' ' + (b.subType || '') + ': ' + String(b.message || '')).slice(0, 400);
      if (String(b.type || '').toLowerCase() !== 'transient') contactStatus = 'bounced';
      break;
    }
    case 'email.complained': status = 'complained'; meta.complained_at = at; contactStatus = 'complained'; break;
    case 'email.opened': if (!send.opened_at) patch.opened_at = at; meta.opens = (Number(meta.opens) || 0) + 1; if (RANK[send.status] < RANK.delivered) status = 'delivered'; break;
    case 'email.clicked': {
      if (!send.clicked_at) patch.clicked_at = at;
      const links: string[] = Array.isArray(meta.clicks) ? meta.clicks : [];
      const link = String((d.click && d.click.link) || '').slice(0, 300);
      if (link && !links.includes(link)) links.push(link);
      meta.clicks = links.slice(0, 30); meta.click_count = (Number(meta.click_count) || 0) + 1;
      if (RANK[send.status] < RANK.delivered) status = 'delivered';
      break;
    }
    case 'email.failed': status = 'failed'; patch.error = String((d.failed && d.failed.reason) || d.reason || 'failed').slice(0, 400); break;
    default: return json({ ok: true, note: 'stored, not handled: ' + type });
  }
  if (status && (RANK[status] >= (RANK[send.status] || 0) || status === 'delayed')) patch.status = status;
  patch.meta = meta;
  await svc.from('crm_email_sends').update(patch).eq('id', send.id);
  const shown = String(patch.status || send.status);
  /* the timeline entry keeps its own meta (template, kind, resend id); only what happened moves */
  const it = await svc.from('crm_interactions').select('id,meta').eq('source_ref', 'send:' + send.id).maybeSingle();
  if (it.data) {
    const im = Object.assign({}, (it.data as any).meta || {}, { status: shown, opens: meta.opens || 0, clicks: meta.click_count || 0 });
    if (meta.bounce) im.bounce = meta.bounce;
    await svc.from('crm_interactions').update({ meta: im }).eq('id', (it.data as any).id);
  }
  if (contactStatus && send.contact_id && !send.is_test) {
    await svc.from('crm_contacts').update({ email_status: contactStatus, updated_at: new Date().toISOString(), updated_by: 'mail-events' }).eq('id', send.contact_id);
    await svc.from('change_log').insert({ entity_type: 'crm_contact', entity_id: String(send.contact_id), field: 'email_status', old_value: null, new_value: contactStatus + ' (Resend ' + type + ')', changed_by: 'mail-events' }).then(() => null, () => null);
  }
  return json({ ok: true, send_id: send.id, status: shown });
});
