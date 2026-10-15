// Welfare Avenue: social-ads (v1, 15/10/26, wave253)
// Steel, 14/10/26 (the Meta additions): "Ads next to organic — Marketing API read-only: ad accounts under the business,
// campaigns and insights (spend, reach, results) shown beside the organic numbers in the Studio analytics."
// Reads Welfare Avenue's Meta ad accounts (the business's owned ad accounts: act_570313852513008 and act_352486075290612 on
// 15/10/26) through the Marketing API with the vault token, campaign by campaign and day by day, into social_ad_daily, and the
// period totals (reach is not a sum of days) into hub_settings studio_ads_summary. Read-only: it never creates, changes or
// pauses an ad, and spends nothing.
// Trigger: cron wa-social-ads (daily 07:40 UTC, the last 30 days, since Meta revises a day for up to 28 days); Refresh in the
// Studio's analytics (staff).
// Auth: verify_jwt off; x-wa-secret, or a signed-in staff member (is_wa_staff) for sync and summary.
// Actions (POST): sync {days?} (1 to 90, default 30), summary (what the Studio card shows: the last 7 and 30 days, per account
//   and per campaign, from the stored totals), accounts.
// Tables: social_ad_daily (write), hub_settings studio_ads_summary (write), change_log (one line per sync with counts).
// Vault: META_SYSTEM_TOKEN (ads_read). Side effects: none outside the Hub.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const GRAPH = 'https://graph.facebook.com/v23.0';
const BUSINESS_ID = '686100608981552';
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Any = any;

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return String(data);
}
async function caller(req: Request): Promise<string | null> {
  try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) return 'automation'; } catch (_) { /* no */ }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = String(data?.user?.email || '').toLowerCase(); if (!email) return null;
  const { data: ok } = await asUser.rpc('is_wa_staff');
  return ok === true ? email : null;
}
async function graph(path: string, token: string, params: Record<string, string> = {}): Promise<Any> {
  const u = new URL(path.startsWith('http') ? path : GRAPH + path);
  for (const k of Object.keys(params)) u.searchParams.set(k, params[k]);
  const res = await fetch(u.toString(), { headers: { Authorization: 'Bearer ' + token } });
  const b = await res.json().catch(() => ({}));
  if (!res.ok || b.error) { const e = b.error || {}; throw new Error((e.error_user_msg || e.message || ('HTTP ' + res.status)) + (e.code ? ' (code ' + e.code + ')' : '')); }
  return b;
}
async function all(path: string, token: string, params: Record<string, string>): Promise<Any[]> {
  const out: Any[] = []; let r = await graph(path, token, params);
  for (let i = 0; i < 20; i++) { out.push(...((r.data || []) as Any[])); if (!r.paging || !r.paging.next) break; r = await graph(String(r.paging.next), token); }
  return out;
}

/* the action that counts as a result for a campaign's objective (Ads Manager's own "Results" column, approximately) */
const RESULT_FOR: Record<string, string[]> = {
  OUTCOME_LEADS: ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'],
  LEAD_GENERATION: ['lead', 'onsite_conversion.lead_grouped'],
  OUTCOME_TRAFFIC: ['link_click', 'landing_page_view'],
  LINK_CLICKS: ['link_click'],
  OUTCOME_ENGAGEMENT: ['onsite_conversion.messaging_conversation_started_7d', 'post_engagement', 'page_engagement'],
  POST_ENGAGEMENT: ['post_engagement'],
  PAGE_LIKES: ['like'],
  MESSAGES: ['onsite_conversion.messaging_conversation_started_7d'],
  OUTCOME_AWARENESS: [],
  REACH: [],
  BRAND_AWARENESS: [],
  VIDEO_VIEWS: ['video_view'],
  OUTCOME_SALES: ['offsite_conversion.fb_pixel_purchase', 'purchase', 'donate_total'],
};
function actionsMap(list: Any[]): Record<string, number> { const m: Record<string, number> = {}; for (const a of (list || [])) m[String(a.action_type)] = (m[String(a.action_type)] || 0) + Number(a.value || 0); return m; }
function resultOf(objective: string, acts: Record<string, number>, reach: number): { n: number; type: string } {
  const want = RESULT_FOR[objective] || [];
  for (const t of want) if (acts[t]) return { n: Math.round(acts[t]), type: t };
  if (!want.length && (objective === 'OUTCOME_AWARENESS' || objective === 'REACH' || objective === 'BRAND_AWARENESS')) return { n: reach, type: 'reach' };
  return { n: 0, type: want[0] || 'none' };
}
function ymd(d: Date): string { return d.toISOString().slice(0, 10); }

async function accounts(token: string): Promise<Any[]> {
  const r = await all('/' + BUSINESS_ID + '/owned_ad_accounts', token, { fields: 'id,name,account_status,currency,amount_spent', limit: '50' });
  return r.filter(a => /^act_\d+$/.test(String(a.id)));
}
async function sync(days: number): Promise<Any> {
  const token = await getSecret('META_SYSTEM_TOKEN');
  const accs = await accounts(token);
  const until = new Date(); const since = new Date(Date.now() - (days - 1) * 86400000);
  const range = JSON.stringify({ since: ymd(since), until: ymd(until) });
  const out: Any = { accounts: [], rows: 0 };
  const summary: Any = { at: new Date().toISOString(), accounts: [] as Any[] };
  for (const a of accs) {
    const objectives: Record<string, string> = {};
    try { for (const c of await all('/' + a.id + '/campaigns', token, { fields: 'id,name,objective,status,effective_status', limit: '200' })) objectives[String(c.id)] = String(c.objective || ''); } catch (_) { /* fine: objective stays unknown */ }
    const rows = await all('/' + a.id + '/insights', token, { level: 'campaign', time_increment: '1', time_range: range, fields: 'campaign_id,campaign_name,objective,spend,impressions,reach,clicks,actions', limit: '500' });
    const up = rows.map(r => {
      const objective = String(r.objective || objectives[String(r.campaign_id)] || '');
      const acts = actionsMap(r.actions || []); const reach = Number(r.reach || 0);
      const res = resultOf(objective, acts, reach);
      return { account_id: String(a.id), campaign_id: String(r.campaign_id), day: String(r.date_start), campaign_name: r.campaign_name || null, objective: objective || null, currency: a.currency || null,
        spend: Number(r.spend || 0), impressions: Number(r.impressions || 0), reach, clicks: Number(r.clicks || 0), results: res.n, result_type: res.type, actions: acts, fetched_at: new Date().toISOString() };
    });
    for (let i = 0; i < up.length; i += 200) { const { error } = await svc.from('social_ad_daily').upsert(up.slice(i, i + 200), { onConflict: 'account_id,campaign_id,day' }); if (error) throw new Error('store: ' + error.message); }
    out.rows += up.length;
    // period totals straight from Meta (reach is people, not a sum)
    const totals: Any = { id: a.id, name: a.name, currency: a.currency, status: a.account_status, lifetime_spend: Number(a.amount_spent || 0) / 100 };
    for (const [k, preset] of [['last7', 'last_7d'], ['last30', 'last_30d'], ['last90', 'last_90d']] as Array<[string, string]>) {
      try {
        const t = await graph('/' + a.id + '/insights', token, { date_preset: preset, fields: 'spend,impressions,reach,clicks,actions' });
        const d = (t.data || [])[0] || {};
        const camps = await all('/' + a.id + '/insights', token, { level: 'campaign', date_preset: preset, fields: 'campaign_id,campaign_name,objective,spend,impressions,reach,clicks,actions', limit: '200' });
        totals[k] = { spend: Number(d.spend || 0), impressions: Number(d.impressions || 0), reach: Number(d.reach || 0), clicks: Number(d.clicks || 0),
          results: camps.reduce((s: number, c: Any) => s + resultOf(String(c.objective || objectives[String(c.campaign_id)] || ''), actionsMap(c.actions || []), Number(c.reach || 0)).n, 0),
          campaigns: camps.map((c: Any) => { const obj = String(c.objective || objectives[String(c.campaign_id)] || ''); const r = resultOf(obj, actionsMap(c.actions || []), Number(c.reach || 0));
            return { id: c.campaign_id, name: c.campaign_name, objective: obj, spend: Number(c.spend || 0), reach: Number(c.reach || 0), impressions: Number(c.impressions || 0), clicks: Number(c.clicks || 0), results: r.n, result_type: r.type }; }) };
      } catch (e) { totals[k] = { error: String((e as Error).message || e).slice(0, 160) }; }
    }
    summary.accounts.push(totals);
    out.accounts.push({ id: a.id, name: a.name, rows: up.length });
  }
  await svc.from('hub_settings').upsert({ key: 'studio_ads_summary', value: summary, updated_at: new Date().toISOString(), updated_by: 'social-ads' });
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const who = await caller(req);
  if (!who) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({})) as Any;
  const action = String(body.action || 'summary');
  try {
    if (action === 'summary') { const { data } = await svc.from('hub_settings').select('value, updated_at').eq('key', 'studio_ads_summary').maybeSingle(); return json({ ok: true, summary: data ? data.value : null }); }
    if (action === 'accounts') { const token = await getSecret('META_SYSTEM_TOKEN'); return json({ ok: true, accounts: await accounts(token) }); }
    if (action === 'sync') {
      const r = await sync(Math.max(1, Math.min(90, Number(body.days) || 30)));
      try { await svc.from('change_log').insert({ entity_type: 'social_ads', entity_id: BUSINESS_ID, field: 'sync', old_value: null, new_value: r.rows + ' campaign-days from ' + r.accounts.length + ' ad accounts', changed_by: who }); } catch (_) { /* audit */ }
      return json({ ok: true, ...r });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
