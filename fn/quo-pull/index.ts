// Welfare Avenue: quo-pull (v1)
// On-demand read of recent INBOUND Quo (OpenPhone) texts from the people
// on one event's roster, so the event summary can show who replied what.
// No database writes except caching the Quo phoneNumberId in app_config.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);

const FROM_NUMBER = '+14388087754';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}

async function authorize(req: Request): Promise<boolean> {
  try {
    const given = req.headers.get('x-wa-secret');
    if (given && given === (await getSecret('WA_TRIGGER_SECRET'))) return true;
  } catch (_) { /* fall through */ }
  const authHeader = req.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data } = await asUser.auth.getUser();
    const email = (data?.user?.email || '').toLowerCase();
    if (email.endsWith('@welfareavenue.com')) return true;
  }
  return false;
}

function normPhone(p: unknown): string {
  const d = String(p || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : '';
}

async function phoneNumberId(key: string): Promise<string> {
  const { data: cfg } = await svc.from('app_config').select('value').eq('key', 'quo_phone_number_id').maybeSingle();
  if (cfg?.value) return cfg.value as string;
  const res = await fetch('https://api.openphone.com/v1/phone-numbers', {
    headers: { 'Authorization': key },
  });
  if (!res.ok) throw new Error('phone-numbers lookup failed: ' + res.status);
  const body = await res.json();
  const hit = (body.data || []).find((n: Record<string, unknown>) =>
    String(n.number || '').replace(/\D/g, '').endsWith(FROM_NUMBER.replace(/\D/g, '').slice(-10)));
  if (!hit?.id) throw new Error('Welfare Phone not found in Quo account');
  await svc.from('app_config').upsert({ key: 'quo_phone_number_id', value: hit.id as string });
  return hit.id as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!(await authorize(req))) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const eventId = Number(body.event_id);
  if (!eventId) return json({ error: 'event_id required' }, 400);
  const days = Math.min(60, Math.max(3, Number(body.days) || 30));
  const since = Date.now() - days * 86400000;

  const { data: roster, error: rErr } = await svc.from('event_roster')
    .select('person_id, person_name, role, status').eq('event_id', eventId).not('person_id', 'is', null);
  if (rErr) return json({ error: 'could not load the roster' }, 500);
  const ids = Array.from(new Set((roster || []).map(r => r.person_id))).slice(0, 80);
  if (!ids.length) return json({ replies: [], checked: 0 });

  const { data: people } = await svc.from('volunteer_people').select('id, full_name, phones').in('id', ids as number[]);
  const byId = new Map<number, { name: string; phone: string }>();
  for (const p of (people || [])) {
    const ph = ((p.phones || []) as string[]).map(normPhone).filter(Boolean)[0];
    if (ph) byId.set(p.id as number, { name: String(p.full_name || ''), phone: ph });
  }

  const key = await getSecret('QUO_API_KEY');
  const pnId = await phoneNumberId(key);

  const replies: Array<Record<string, unknown>> = [];
  let checked = 0;
  for (const [pid, info] of byId) {
    if (checked >= 60) break;
    checked += 1;
    try {
      const url = 'https://api.openphone.com/v1/messages?phoneNumberId=' + encodeURIComponent(pnId)
        + '&participants[]=' + encodeURIComponent('+1' + info.phone) + '&maxResults=6';
      const res = await fetch(url, { headers: { 'Authorization': key } });
      if (!res.ok) { await new Promise(r => setTimeout(r, 150)); continue; }
      const data = await res.json();
      const msgs = (data.data || []) as Array<Record<string, unknown>>;
      const inbound = msgs
        .filter(m => String(m.direction || '') === 'incoming')
        .map(m => ({ text: String(m.text ?? m.content ?? '').slice(0, 400), at: String(m.createdAt || '') }))
        .filter(m => m.text && m.at && new Date(m.at).getTime() >= since)
        .sort((a, b) => (a.at < b.at ? 1 : -1));
      if (inbound.length) {
        replies.push({ person_id: pid, name: info.name, phone: '+1' + info.phone, text: inbound[0].text, at: inbound[0].at, more: inbound.length - 1 });
      }
    } catch (_) { /* skip this phone */ }
    await new Promise(r => setTimeout(r, 130));
  }

  replies.sort((a, b) => (String(a.at) < String(b.at) ? 1 : -1));
  return json({ event_id: eventId, replies, checked, window_days: days });
});
