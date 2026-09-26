// Welfare Avenue: quo-sync (v1)
// Links volunteer_people rows to Quo (OpenPhone) contacts by phone number.
// Pages through the Quo contacts API with the vault QUO_API_KEY, normalizes
// phone numbers to their last 10 digits, and matches against the phones array
// on volunteer_people. A contact whose phone maps to exactly one person links
// that person (quo_contact_id, quo_synced_at). Phones shared by more than one
// person are counted as ambiguous and skipped (those rows already carry
// needs_review from the import). Links pointing at contacts that no longer
// exist in Quo are cleared. Returns sync stats as JSON.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);

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

type QuoContact = {
  id: string;
  defaultFields?: {
    firstName?: string | null;
    lastName?: string | null;
    phoneNumbers?: Array<{ value?: string | null }>;
  };
};

function norm(p: unknown): string {
  const d = String(p || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : d;
}

async function sync() {
  const key = await getSecret('QUO_API_KEY');
  const contacts: QuoContact[] = [];
  let pageToken: string | null = null;
  let guard = 0;
  do {
    const u = new URL('https://api.openphone.com/v1/contacts');
    u.searchParams.set('maxResults', '50');
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const res = await fetch(u.toString(), { headers: { Authorization: key } });
    if (!res.ok) throw new Error('quo contacts ' + res.status + ' ' + (await res.text()).slice(0, 200));
    const body = await res.json();
    contacts.push(...((body.data || []) as QuoContact[]));
    pageToken = body.nextPageToken || null;
    guard += 1;
  } while (pageToken && guard < 100);

  const { data: people, error } = await svc.from('volunteer_people').select('id, full_name, phones, quo_contact_id');
  if (error) throw error;
  type Person = { id: number; full_name: string; phones: string[] | null; quo_contact_id: string | null };
  const byPhone = new Map<string, Person[]>();
  for (const p of (people || []) as Person[]) {
    for (const ph of (p.phones || [])) {
      const k = norm(ph);
      if (!k) continue;
      if (!byPhone.has(k)) byPhone.set(k, []);
      const arr = byPhone.get(k)!;
      if (!arr.some(x => x.id === p.id)) arr.push(p);
    }
  }

  const quoIds = new Set(contacts.map(c => c.id));
  let matched = 0, updated = 0, ambiguous = 0, quoOnly = 0;
  const quoOnlySample: string[] = [];
  const nowIso = new Date().toISOString();
  const linkedPeople = new Set<number>();

  for (const c of contacts) {
    const phones = (c.defaultFields?.phoneNumbers || []).map(x => norm(x?.value)).filter(Boolean);
    const hits = new Map<number, Person>();
    for (const ph of phones) (byPhone.get(ph) || []).forEach(p => hits.set(p.id, p));
    if (!hits.size) {
      quoOnly += 1;
      const n = ((c.defaultFields?.firstName || '') + ' ' + (c.defaultFields?.lastName || '')).trim();
      if (n && quoOnlySample.length < 40) quoOnlySample.push(n);
      continue;
    }
    if (hits.size > 1) { ambiguous += 1; continue; }
    const person = [...hits.values()][0];
    matched += 1;
    linkedPeople.add(person.id);
    if (person.quo_contact_id !== c.id) {
      const { error: uErr } = await svc.from('volunteer_people')
        .update({ quo_contact_id: c.id, quo_synced_at: nowIso }).eq('id', person.id);
      if (uErr) console.error('link update failed', person.id, uErr); else updated += 1;
    }
  }

  // Clear links to contacts that no longer exist in Quo.
  let cleared = 0;
  for (const p of (people || []) as Person[]) {
    if (p.quo_contact_id && !quoIds.has(p.quo_contact_id) && !linkedPeople.has(p.id)) {
      const { error: cErr } = await svc.from('volunteer_people')
        .update({ quo_contact_id: null, quo_synced_at: nowIso }).eq('id', p.id);
      if (cErr) console.error('link clear failed', p.id, cErr); else cleared += 1;
    }
  }

  const peopleTotal = (people || []).length;
  return {
    quo_contacts: contacts.length,
    people_total: peopleTotal,
    matched_contacts: matched,
    people_linked: linkedPeople.size,
    links_written: updated,
    links_cleared: cleared,
    ambiguous_phone: ambiguous,
    quo_only: quoOnly,
    quo_only_sample: quoOnlySample,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!(await authorize(req))) return json({ error: 'unauthorized' }, 401);
  try {
    const stats = await sync();
    return json(stats);
  } catch (e) {
    console.error('quo-sync failed', e);
    return json({ error: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
