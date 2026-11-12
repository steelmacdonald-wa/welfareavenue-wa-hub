// Welfare Avenue: clarity-insights (v1, wave310, 12/11/26)
// Microsoft Clarity (project zbcoohovt6, heat maps and visit recordings on welfareavenue.com) for the Content Studio's
// Results > Website. Clarity's Data Export API gives only the last 1 to 3 days and allows 10 calls a day, so a daily
// job (cron wa-clarity-pull) keeps one row per day in clarity_daily (totals only: Clarity never sends who a visitor is),
// and the Hub adds the days up for the range it shows.
// Token: CLARITY_TOKEN in the Vault (Clarity > Settings > Data export > Generate new API token), put there by Steel.
// Without it the Hub still shows the heat map buttons and says the numbers are not connected yet.
// Actions (POST):
//   {action:'pull'}              the last 24 hours, by page and overall (2 Clarity calls); the trigger secret only
//   {action:'summary', days}     the days added up, overall and per page (from clarity_daily; no Clarity call)
// Callers: signed-in staff (is_wa_staff) for summary, the trigger secret for pull.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const API = 'https://www.clarity.ms/export-data/api/v1/project-live-insights';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

async function secret(name: string): Promise<string | null> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  return error || !data ? null : String(data);
}
async function caller(req: Request): Promise<'automation' | 'staff' | null> {
  const s = req.headers.get('x-wa-secret');
  if (s && s === (await secret('WA_TRIGGER_SECRET'))) return 'automation';
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  try { const r = await asUser.rpc('is_wa_staff'); return r.data === true ? 'staff' : null; } catch (_) { return null; }
}

async function clarity(tok: string, dim?: string): Promise<Row[]> {
  const q = new URLSearchParams({ numOfDays: '1' });
  if (dim) q.set('dimension1', dim);
  const res = await fetch(API + '?' + q, { headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' } });
  const txt = await res.text();
  if (!res.ok) throw new Error('Clarity ' + res.status + ': ' + txt.slice(0, 200));
  const j = JSON.parse(txt || '[]');
  return Array.isArray(j) ? j : [];
}

/* Flatten Clarity's [{metricName, information:[{...}]}] into {key: {metric: {field: number}}}, key = the page path or 'all'. */
function path(u: string): string { try { const x = new URL(u); return x.pathname || '/'; } catch (_) { return String(u || '').slice(0, 200); } }
const NUMERIC = (v: unknown) => v !== null && v !== '' && !isNaN(Number(v));
function flatten(list: Row[], byUrl: boolean): Row {
  const out: Row = {};
  for (const m of list) {
    const name = String(m.metricName || '');
    if (!name) continue;
    for (const inf of (m.information || []) as Row[]) {
      const key = byUrl ? path(inf.URL || inf.Url || inf.url || '') : 'all';
      if (!key) continue;
      const slot = ((out[key] = out[key] || {})[name] = out[key][name] || {});
      for (const [k, v] of Object.entries(inf)) {
        if (/^(url|URL|Url)$/.test(k)) continue;
        if (NUMERIC(v)) slot[k] = (slot[k] || 0) + Number(v);
        else if (name === 'PopularPages' || name === 'ReferrerUrl' || name === 'Device' || name === 'Country' || name === 'Browser' || name === 'OS') {
          /* lists like popular pages and devices: keep "label -> count" */
          const lab = String(v).slice(0, 160), cnt = Number(inf.visitsCount ?? inf.sessionsCount ?? inf.totalSessionCount ?? 0) || 0;
          slot['@' + k] = slot['@' + k] || {};
          slot['@' + k][lab] = (slot['@' + k][lab] || 0) + cnt;
        }
      }
    }
  }
  return out;
}

/* Add days together. Averages (scroll depth, percentages) are weighted by that day's sessions. */
const AVG = /percentage|average|Percentage|Average/;
function addInto(acc: Row, day: Row) {
  for (const [key, metrics] of Object.entries(day || {})) {
    const a = (acc[key] = acc[key] || {});
    const w = Number((metrics as Row)?.Traffic?.totalSessionCount || 0) || 1;
    for (const [mn, fields] of Object.entries(metrics as Row)) {
      const s = (a[mn] = a[mn] || {});
      for (const [k, v] of Object.entries(fields as Row)) {
        if (k.startsWith('@')) { s[k] = s[k] || {}; for (const [lab, c] of Object.entries(v as Row)) s[k][lab] = (s[k][lab] || 0) + Number(c); continue; }
        if (AVG.test(k)) { s['_w_' + k] = (s['_w_' + k] || 0) + Number(v) * w; s['_n_' + k] = (s['_n_' + k] || 0) + w; }
        else s[k] = (s[k] || 0) + Number(v);
      }
    }
  }
}
function finish(acc: Row) {
  for (const metrics of Object.values(acc)) for (const fields of Object.values(metrics as Row)) {
    const f = fields as Row;
    for (const k of Object.keys(f)) if (k.startsWith('_w_')) { const n = k.slice(3); f[n] = f['_n_' + n] ? f[k] / f['_n_' + n] : 0; delete f[k]; delete f['_n_' + n]; }
  }
  return acc;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let body: Row = {};
  try { body = await req.json(); } catch (_) { /* empty */ }
  const who = await caller(req);
  if (!who) return json({ ok: false, error: 'not allowed' }, 401);
  const action = String(body.action || 'summary');

  if (action === 'pull') {
    if (who !== 'automation') return json({ ok: false, error: 'automation only' }, 403);
    const tok = await secret('CLARITY_TOKEN');
    if (!tok) return json({ ok: false, error: 'CLARITY_TOKEN is not in the Vault yet' });
    try {
      const [byUrl, all] = await Promise.all([clarity(tok, 'URL'), clarity(tok)]);
      const day = new Date(Date.now() - 5 * 3600 * 1000 - 12 * 3600 * 1000).toISOString().slice(0, 10);   /* Toronto, the day just finished */
      const row = { day, by_url: flatten(byUrl, true), overall: flatten(all, false), pulled_at: new Date().toISOString() };
      const { error } = await svc.from('clarity_daily').upsert(row, { onConflict: 'day' });
      if (error) throw new Error(error.message);
      return json({ ok: true, day, pages: Object.keys(row.by_url).length });
    } catch (e) { return json({ ok: false, error: String((e as Error).message || e).slice(0, 300) }); }
  }

  if (action === 'summary') {
    const days = Math.max(1, Math.min(400, Number(body.days) || 28));
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const [{ data, error }, tok] = await Promise.all([
      svc.from('clarity_daily').select('day, by_url, overall, pulled_at').gte('day', since).order('day'),
      secret('CLARITY_TOKEN'),
    ]);
    if (error) return json({ ok: false, error: error.message });
    const pages: Row = {}, overall: Row = {};
    for (const d of data || []) { addInto(pages, d.by_url); addInto(overall, d.overall); }
    return json({
      ok: true, connected: !!tok, days, from: (data || [])[0]?.day || null, to: (data || []).slice(-1)[0]?.day || null,
      day_count: (data || []).length, last_pull: (data || []).slice(-1)[0]?.pulled_at || null,
      overall: finish(overall).all || {}, pages: finish(pages),
    });
  }
  return json({ ok: false, error: 'unknown action' }, 400);
});
