// Welfare Avenue: mail-unsubscribe (v1, 28/09/26, wave154)
// The unsubscribe link in every email the Hub sends (and the List-Unsubscribe one-click target).
// GET  ?c=<contact id>&t=<token>[&s=<send id>]  -> a small branded page asking to confirm
// POST same query (a form, or the one-click body List-Unsubscribe=One-Click) -> marks the contact
//      unsubscribed (crm_contacts.email_status), notes it on their timeline (crm_interactions, source hub)
//      and on the send (crm_email_sends.unsubscribed_at), and confirms.
// The token is HMAC-SHA256(WA_MAIL_SECRET, contact id), first 32 hex characters; mail-send makes it.
// Auth: the token only (verify_jwt off: the reader is a member of the public). No personal data is shown
// beyond a masked address. ?preview=1 shows what the page looks like without a contact.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const CREAM = '#FFFAF2', GREEN = '#103F39', INK = '#1F201E', GOLD = '#DCA527', PURPLE = '#6F64AB';
const LOGO = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/brand/logo-primary-cream-600.png';

async function getSecret(name: string): Promise<string | null> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  return error || !data ? null : String(data);
}
async function hmacHex(secret: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function esc(s: unknown): string { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)); }
function mask(email: string): string { const [u, d] = String(email || '').split('@'); if (!d) return ''; return (u.length <= 2 ? u[0] + '…' : u.slice(0, 2) + '…' + u.slice(-1)) + '@' + d; }
function page(title: string, lead: string, body: string, status = 200): Response {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} · Welfare Avenue</title>` +
    `<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">` +
    `<style>body{margin:0;background:${CREAM};font-family:'Space Grotesk','Helvetica Neue',Arial,sans-serif;color:${INK};}` +
    `.wrap{max-width:560px;margin:32px auto;padding:0 16px;}.head{background:${GREEN};border-radius:12px 12px 0 0;padding:26px 32px;}.head img{width:150px;height:auto;display:block;}` +
    `.card{background:${CREAM};border:1px solid rgba(16,63,57,.14);border-top:none;border-radius:0 0 12px 12px;padding:28px 32px 30px;}` +
    `h1{font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-weight:500;font-size:36px;line-height:1.05;text-transform:uppercase;color:${GREEN};margin:0 0 14px;}` +
    `p{font-size:16px;line-height:1.6;margin:0 0 14px;}.m{color:#5C5A56;font-size:14px;}` +
    `button{background:${GOLD};color:${GREEN};border:none;border-radius:6px;padding:14px 28px;font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-weight:600;font-size:18px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;}` +
    `a{color:${PURPLE};}.foot{margin-top:18px;font-size:12.5px;color:#5C5A56;}</style></head><body><div class="wrap">` +
    `<div class="head"><img src="${LOGO}" alt="Welfare Avenue"></div><div class="card"><h1>${esc(title)}</h1><p>${lead}</p>${body}` +
    `<div class="foot">Welfare Avenue, building pathways in our community · <a href="https://welfareavenue.com">welfareavenue.com</a></div></div></div></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  if (url.searchParams.get('preview')) return page('Email preferences', 'This is what the unsubscribe page looks like. A real link carries the contact and a signed token.', '<p class="m">Nothing to do here.</p>');
  const c = Number(url.searchParams.get('c') || 0), t = String(url.searchParams.get('t') || ''), s = Number(url.searchParams.get('s') || 0) || null;
  if (!c || !/^[0-9a-f]{32}$/.test(t)) return page('This link is not valid', 'The unsubscribe link is missing a part. Open the email again and use its unsubscribe link, or write to <a href="mailto:info@welfareavenue.com">info@welfareavenue.com</a> and we will take care of it.', '', 400);
  const secret = await getSecret('WA_MAIL_SECRET');
  if (!secret) return page('Something is off on our side', 'We could not check this link. Write to <a href="mailto:info@welfareavenue.com">info@welfareavenue.com</a> and we will unsubscribe you by hand.', '', 503);
  const expected = (await hmacHex(secret, String(c))).slice(0, 32);
  if (expected !== t) return page('This link is not valid', 'The link does not match our records. Open the email again and use its unsubscribe link, or write to <a href="mailto:info@welfareavenue.com">info@welfareavenue.com</a>.', '', 400);
  const { data: contact } = await svc.from('crm_contacts').select('id,full_name,primary_email,emails,email_status,merged_into').eq('id', c).maybeSingle();
  if (!contact) return page('Already gone', 'We have no email on file for this link any more.', '');
  const email = String((contact as any).primary_email || ((contact as any).emails || [])[0] || '');
  const already = String((contact as any).email_status || '') === 'unsubscribed';
  if (req.method === 'GET') {
    if (already) return page('You are unsubscribed', 'This address (' + esc(mask(email)) + ') no longer receives our newsletters or appeals.', '<p class="m">Confirmations and receipts you ask for still reach you. To come back one day, write to <a href="mailto:info@welfareavenue.com">info@welfareavenue.com</a>.</p>');
    return page('Unsubscribe?', 'Stop Welfare Avenue’s newsletters and appeals to ' + esc(mask(email)) + '. Confirmations and receipts you ask for still reach you.',
      '<form method="post" action="' + esc(url.pathname + url.search) + '"><button type="submit">Yes, unsubscribe me</button></form><p class="m" style="margin-top:14px">Changed your mind? Just close this page.</p>');
  }
  if (req.method !== 'POST') return json405();
  if (!already) {
    await svc.from('crm_contacts').update({ email_status: 'unsubscribed', updated_at: new Date().toISOString(), updated_by: 'mail-unsubscribe' }).eq('id', c);
    let via = 'the unsubscribe link in an email';
    if (s) {
      const { data: send } = await svc.from('crm_email_sends').select('id,subject').eq('id', s).eq('contact_id', c).maybeSingle();
      if (send) { via = 'the unsubscribe link in “' + String((send as any).subject || 'an email') + '”'; await svc.from('crm_email_sends').update({ unsubscribed_at: new Date().toISOString() }).eq('id', s); }
    }
    await svc.from('crm_interactions').insert({ contact_id: c, kind: 'email', direction: 'in', channel: 'email', subject: 'Unsubscribed from our emails', body: 'Through ' + via + '. Newsletters and appeals stop; confirmations and receipts still go out.', occurred_at: new Date().toISOString(), source: 'hub', source_ref: 'unsub:' + c + ':' + Date.now(), meta: { send_id: s, one_click: req.headers.get('content-type')?.includes('form') || false }, created_by: 'mail-unsubscribe' });
    await svc.from('change_log').insert({ entity_type: 'crm_contact', entity_id: String(c), field: 'email_status', old_value: String((contact as any).email_status || ''), new_value: 'unsubscribed (their link)', changed_by: 'mail-unsubscribe' }).then(() => null, () => null);
  }
  return page('You are unsubscribed', 'Done. ' + esc(mask(email)) + ' no longer receives our newsletters or appeals.', '<p class="m">Confirmations and receipts you ask for still reach you. Thank you for the time you gave us; the door stays open at <a href="mailto:info@welfareavenue.com">info@welfareavenue.com</a>.</p>');
});
function json405(): Response { return new Response('POST or GET', { status: 405 }); }
