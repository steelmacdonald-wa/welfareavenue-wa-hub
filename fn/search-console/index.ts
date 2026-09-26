// Welfare Avenue: search-console (v1, wave147, 26/09/26)
// How people find welfareavenue.com on Google, for the Analytics page. Once a day it looks for the site in Google Search
// Console, first as the Hub's service account (added as a user of the property), then as steel.macdonald@welfareavenue.com
// (domain-wide delegation, webmasters.readonly). As soon as one of them can see the site it connects on its own
// (search_sites) and reads: clicks, impressions, click-through rate and average position per day (search_daily, the last
// 90 days on the first read, then the last 10), and the top searches and pages of the last 28 days of data (search_top).
// Actions: status (what each identity can see), sync {days}. Callers: the trigger secret, or signed-in staff.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const ACTOR = 'steel.macdonald@welfareavenue.com';
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const API = 'https://searchconsole.googleapis.com/webmasters/v3';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

async function getSecret(name: string): Promise<string> { const { data, error } = await svc.rpc('get_secret', { secret_name: name }); if (error || !data) throw new Error('secret ' + name + ' unavailable'); return data as string; }
let IS_ADMIN = false;
async function caller(req: Request): Promise<string | null> {
  IS_ADMIN = false;
  try { const s = req.headers.get('x-wa-secret'); if (s && s === (await getSecret('WA_TRIGGER_SECRET'))) { IS_ADMIN = true; return 'automation'; } } catch (_) { /* no */ }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  try { const r = await asUser.rpc('is_wa_staff'); if (r.data !== true) return null; } catch (_) { return null; }
  try { const a = await asUser.rpc('is_hub_admin'); IS_ADMIN = a.data === true; } catch (_) { IS_ADMIN = false; }
  const { data } = await asUser.auth.getUser();
  return (data?.user?.email || '').toLowerCase() || null;
}

/* ---------- Google: the service account itself, or Steel through delegation ---------- */
function b64url(bytes: Uint8Array): string { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function pemToDer(pem: string): Uint8Array { const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, ''); const raw = atob(body); const out = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out; }
const TOK: Record<string, { v: string; exp: number }> = {};
let SA_EMAIL = '';
async function token(via: 'sa' | 'steel'): Promise<string> {
  if (TOK[via] && Date.now() < TOK[via].exp - 120000) return TOK[via].v;
  const sa = JSON.parse(await getSecret('GOOGLE_SA_KEY'));
  SA_EMAIL = sa.client_email || '';
  const now = Math.floor(Date.now() / 1000), enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const c: Row = { iss: sa.client_email, scope: SCOPE, aud: sa.token_uri, iat: now, exp: now + 3600 };
  if (via === 'steel') c.sub = ACTOR;
  const claims = b64url(enc.encode(JSON.stringify(c)));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(header + '.' + claims)));
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: header + '.' + claims + '.' + b64url(sig) }) });
  const body = await res.json();
  if (!body.access_token) throw new Error('Google refused the token (' + via + '): ' + String(body.error_description || body.error || res.status).slice(0, 160));
  TOK[via] = { v: body.access_token, exp: Date.now() + 3500 * 1000 };
  return TOK[via].v;
}
async function call(via: 'sa' | 'steel', path: string, body?: unknown): Promise<Row> {
  const res = await fetch(API + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + (await token(via)), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const txt = await res.text(); let j: Row = {}; try { j = txt ? JSON.parse(txt) : {}; } catch (_) { j = { raw: txt.slice(0, 200) }; }
  if (!res.ok) throw new Error('Search Console ' + res.status + ': ' + String(j?.error?.message || txt).slice(0, 200));
  return j;
}
async function sites(via: 'sa' | 'steel'): Promise<Row[]> {
  const j = await call(via, '/sites');
  return ((j.siteEntry || []) as Row[]).filter((s) => s.permissionLevel && s.permissionLevel !== 'siteUnverifiedUser');
}
/* the Welfare Avenue property, exactly: the domain property first, then the website */
const OURS = ['sc-domain:welfareavenue.com', 'https://welfareavenue.com/', 'https://www.welfareavenue.com/', 'http://welfareavenue.com/', 'http://www.welfareavenue.com/'];
function pick(list: Row[]): Row | null {
  for (const u of OURS) { const s = list.find((x) => String(x.siteUrl).toLowerCase() === u); if (s) return s; }
  return null;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

async function status() {
  const out: Row = {};
  for (const via of ['sa', 'steel'] as const) {
    try { out[via] = { ok: true, sites: (await sites(via)).map((s) => ({ site: s.siteUrl, permission: s.permissionLevel })) }; }
    catch (e) { out[via] = { ok: false, error: String((e as Error).message).slice(0, 200) }; }
  }
  const { data } = await svc.from('search_sites').select('*');
  /* which properties each identity sees is for admins and the automation; staff get the email for the setup line */
  return IS_ADMIN ? { ok: true, sa_email: SA_EMAIL || null, visible: out, connected: data || [] } : { ok: true, sa_email: SA_EMAIL || null, connected: (data || []).map((x: Row) => ({ site_url: x.site_url, last_sync_at: x.last_sync_at })) };
}

async function sync(days: number) {
  let { data: cur } = await svc.from('search_sites').select('*').limit(1).maybeSingle();
  if (!cur) {
    /* not connected yet: connect on its own as soon as a site is visible */
    for (const via of ['sa', 'steel'] as const) {
      try { const s = pick(await sites(via)); if (s) { const row = { site_url: s.siteUrl, via, permission: s.permissionLevel }; await svc.from('search_sites').upsert(row); cur = row as Row; break; } } catch (_) { /* try the next */ }
    }
    if (!cur) return { ok: true, connected: false, note: 'No Welfare Avenue site is visible in Search Console yet. Add ' + (SA_EMAIL || 'the Hub service account') + ' as a user of the property (Settings, Users and permissions, Add user, Restricted).' };
    days = Math.max(days, 90);
  }
  const site = cur.site_url as string, via = (cur.via || 'sa') as 'sa' | 'steel';
  const enc = encodeURIComponent(site);
  try {
    const end = new Date(Date.now() - 86400000), start = new Date(end.getTime() - (days - 1) * 86400000);
    const d = await call(via, '/sites/' + enc + '/searchAnalytics/query', { startDate: iso(start), endDate: iso(end), dimensions: ['date'], rowLimit: 1000, type: 'web' });
    const rows = ((d.rows || []) as Row[]).map((r) => ({ site_url: site, day: r.keys[0], clicks: r.clicks || 0, impressions: r.impressions || 0, ctr: r.ctr ?? null, position: r.position ?? null }));
    if (rows.length) { const { error } = await svc.from('search_daily').upsert(rows, { onConflict: 'site_url,day' }); if (error) throw new Error(error.message); }
    /* the top searches and pages over the last 28 days that have data */
    const { data: last } = await svc.from('search_daily').select('day').eq('site_url', site).order('day', { ascending: false }).limit(1);
    const lastDay = last && last[0] ? String(last[0].day) : iso(end);
    const from = iso(new Date(new Date(lastDay + 'T12:00:00Z').getTime() - 27 * 86400000));
    const top: Row[] = [];
    for (const kind of ['query', 'page'] as const) {
      const t = await call(via, '/sites/' + enc + '/searchAnalytics/query', { startDate: from, endDate: lastDay, dimensions: [kind], rowLimit: 25, type: 'web' });
      for (const r of (t.rows || []) as Row[]) top.push({ site_url: site, kind, key: String(r.keys[0]).slice(0, 500), period_start: from, period_end: lastDay, clicks: r.clicks || 0, impressions: r.impressions || 0, ctr: r.ctr ?? null, position: r.position ?? null });
    }
    await svc.from('search_top').delete().eq('site_url', site);
    if (top.length) { const { error } = await svc.from('search_top').insert(top); if (error) throw new Error(error.message); }
    const { data: first } = await svc.from('search_daily').select('day').eq('site_url', site).order('day', { ascending: true }).limit(1);
    await svc.from('search_sites').update({ last_sync_at: new Date().toISOString(), last_error: null, first_day: first && first[0] ? first[0].day : null, last_day: lastDay }).eq('site_url', site);
    return { ok: true, connected: true, site, via, days: rows.length, top: top.length };
  } catch (e) {
    const msg = String((e as Error).message || e).slice(0, 300);
    await svc.from('search_sites').update({ last_sync_at: new Date().toISOString(), last_error: msg }).eq('site_url', site);
    return { ok: false, connected: true, site, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const who = await caller(req);
  if (!who) return json({ error: 'not allowed' }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'status');
  try {
    if (action === 'status') { try { await token('sa'); } catch (_) { /* email only */ } return json(await status()); }
    if (action === 'sync') { try { await token('sa'); } catch (_) { /* fine */ } return json(await sync(Math.max(3, Math.min(480, Number(body.days) || 10)))); }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 400) }, 500);
  }
});
