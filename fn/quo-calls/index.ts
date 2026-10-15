// Welfare Avenue: quo-calls (v1, wave256, 15/10/26)
// Purpose: the ops line's calls (438) 808-7754 in the Hub. Quo's API reads calls but cannot place one, so the Hub's Call
//   buttons open the Quo app (tel:) and this function copies what happened (missed, answered, voicemail, Quo's call
//   summary when the plan makes one) into quo_calls, where the Volunteer Manager's Phone page shows it beside the texts.
// Trigger: cron wa-quo-calls (every 10 minutes, trigger secret); a leader, HR person or admin pressing Check now.
// Auth: the trigger secret, or a signed-in leader, HR person or admin (as quo-send).
// Actions:
//   'sync'   the calls on the ops line since the last sync (two days back again, for summaries that arrive late; 30 days
//            on the first run), at most 8 pages of 50, upserted on quo_id. Never places a call, never sends anything.
//   'probe'  admins or the secret: one page of the API, for checking the key reaches calls.
// Tables: quo_calls (upsert), app_config (read quo_phone_number_id; write quo_calls_synced_at). Side effects: none.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const FROM_NUMBER = '+14388087754';
const API = 'https://api.quo.com';
const VER = '2026-03-30';

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
async function cfg(key: string): Promise<string> {
  const { data } = await svc.from('app_config').select('value').eq('key', key).maybeSingle();
  return String((data && data.value) || '');
}
type Who = { ok: boolean; who: string; system: boolean; admin: boolean };
async function authorize(req: Request): Promise<Who> {
  try {
    const given = req.headers.get('x-wa-secret');
    if (given && given === (await getSecret('WA_TRIGGER_SECRET'))) return { ok: true, who: 'system', system: true, admin: true };
  } catch (_) { /* fall through */ }
  const h = req.headers.get('Authorization') || '';
  if (h.startsWith('Bearer ')) {
    const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: h } } });
    const { data } = await asUser.auth.getUser();
    const email = (data?.user?.email || '').toLowerCase();
    if (!email) return { ok: false, who: '', system: false, admin: false };
    const [a, l, r] = await Promise.all([asUser.rpc('is_wa_admin'), asUser.rpc('is_wa_leader'), asUser.rpc('wa_is_hr')]);
    if (a.data === true || l.data === true || r.data === true) return { ok: true, who: email, system: false, admin: a.data === true };
  }
  return { ok: false, who: '', system: false, admin: false };
}
function digits(p: unknown): string { const d = String(p || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; }
function txt(x: unknown, n = 4000): string | null {
  if (x == null) return null;
  if (typeof x === 'string') return x.slice(0, n) || null;
  if (Array.isArray(x)) return x.map((y) => typeof y === 'string' ? y : (y && (y.text || y.content || y.summary)) || '').filter(Boolean).join('\n').slice(0, n) || null;
  if (typeof x === 'object') { const o = x as Record<string, unknown>; return txt(o.text ?? o.summary ?? o.content ?? o.transcript ?? null, n); }
  return String(x).slice(0, n);
}
async function page(key: string, pn: string, since: string, after: string | null): Promise<{ ok: boolean; status: number; body: any }> {
  const q = new URLSearchParams();
  q.set('phoneNumberId', pn); q.set('createdAt[gte]', since); q.set('limit', '50');
  q.append('include', 'summary'); q.append('include', 'voicemail');
  if (after) q.set('after', after);
  const res = await fetch(API + '/calls?' + q.toString(), { headers: { 'Authorization': key, 'Quo-Api-Version': VER } });
  let b: any = null; try { b = await res.json(); } catch (_) { b = null; }
  return { ok: res.ok, status: res.status, body: b };
}
function rowOf(c: any): Record<string, unknown> | null {
  if (!c || !c.id) return null;
  const parts: any[] = Array.isArray(c.participants) ? c.participants : [];
  const other = parts.map((p: any) => (p && (p.phoneNumber || p.number)) || (typeof p === 'string' ? p : '')).filter((n: string) => n && digits(n) !== digits(FROM_NUMBER))[0] || '';
  const dir = String(c.direction || '') === 'incoming' ? 'in' : 'out';
  const vm = c.voicemail || null;
  const sm = c.summary || null;
  return {
    quo_id: String(c.id), phone: other || null, ph: digits(other) || null, direction: dir,
    status: c.status ? String(c.status) : null, duration: Number.isFinite(Number(c.duration)) ? Math.round(Number(c.duration)) : null,
    answered_at: c.answeredAt || null, completed_at: c.completedAt || null, created_at: c.createdAt || new Date().toISOString(),
    quo_user: c.answeredBy || c.initiatedBy || c.actorId || null, ai_handled: c.aiHandled ? true : false,
    summary: sm ? txt(sm.summary ?? sm, 4000) : null, next_steps: sm ? txt(sm.nextSteps ?? sm.next_steps ?? null, 2000) : null,
    voicemail_text: vm ? txt(vm.transcript ?? vm.transcription ?? vm.text ?? null, 4000) : null,
    voicemail_seconds: vm && Number.isFinite(Number(vm.duration)) ? Math.round(Number(vm.duration)) : null,
    has_voicemail: !!vm, synced_at: new Date().toISOString(),
  };
}
async function sync(): Promise<Record<string, unknown>> {
  const key = await getSecret('QUO_API_KEY');
  const pn = await cfg('quo_phone_number_id');
  if (!pn) return { error: 'app_config quo_phone_number_id is not set' };
  const last = await cfg('quo_calls_synced_at');
  const startedAt = new Date().toISOString();
  const since = last ? new Date(new Date(last).getTime() - 2 * 86400000).toISOString() : new Date(Date.now() - 30 * 86400000).toISOString();
  let after: string | null = null, pages = 0, seen = 0, saved = 0; let err: string | null = null;
  while (pages < 8) {
    let r = await page(key, pn, since, after);
    if (r.status === 429) { await new Promise((ok) => setTimeout(ok, 2000)); r = await page(key, pn, since, after); }
    if (!r.ok) { err = 'quo ' + r.status + ' ' + JSON.stringify(r.body || {}).slice(0, 200); break; }
    pages++;
    const list: any[] = (r.body && r.body.data) || [];
    seen += list.length;
    const rows = list.map(rowOf).filter(Boolean) as Record<string, unknown>[];
    if (rows.length) {
      const { error, count } = await svc.from('quo_calls').upsert(rows, { onConflict: 'quo_id', count: 'exact' });
      if (error) { err = 'save: ' + error.message; break; }
      saved += count || rows.length;
    }
    after = (r.body && (r.body.nextCursor || r.body.next_cursor)) || null;
    if (!after || !list.length) break;
  }
  if (!err) await svc.from('app_config').upsert({ key: 'quo_calls_synced_at', value: startedAt, updated_at: startedAt });
  return { since, pages, seen, saved, error: err };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const auth = await authorize(req);
  if (!auth.ok) return json({ error: 'Only leaders, HR and admins can check the calls.' }, 403);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'sync');
  try {
    if (action === 'probe') {
      if (!auth.admin) return json({ error: 'admins only' }, 403);
      const key = await getSecret('QUO_API_KEY');
      const pn = await cfg('quo_phone_number_id');
      const r = await page(key, pn, new Date(Date.now() - 30 * 86400000).toISOString(), null);
      const d: any[] = (r.body && r.body.data) || [];
      return json({ status: r.status, ok: r.ok, count: d.length, next: r.body && r.body.nextCursor, keys: d[0] ? Object.keys(d[0]) : [], sample: d[0] ? rowOf(d[0]) : null, error: r.ok ? null : JSON.stringify(r.body).slice(0, 400) });
    }
    if (action === 'sync') return json(await sync());
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
