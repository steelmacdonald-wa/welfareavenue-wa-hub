// Welfare Avenue: social-ads-manage (v1, 13/11/26, wave314)
// Steel, 13/11/26, with the Marketing API token (ads_management, ads_read, read_insights): "Please add this functional in
// content studio", then: "All of the above but only marketing leads", meaning all three of
//   - boost a published Facebook or Instagram post from the Hub (it spends real money),
//   - build a campaign in Ads Manager as PAUSED for someone to review and turn on there,
//   - pause, resume and change the budget of the campaigns that already exist.
// Who: only marketing leads (wa314_ads_lead: the named approvers, and leaders or admins in the marketing team: Ian, KK,
// Eduardo on 13/11/26). Everyone else keeps the read-only Paid card that social-ads feeds.
// Guards, all server side: the spending limits in hub_settings studio_ads_limits (a day's budget, one boost's total, how many
// days), an end date on every boost, only Welfare Avenue's own ad accounts (the business's owned ad accounts), and an
// object is only paused or changed after Meta says it belongs to one of them. A boost that fails part way deletes what it
// made, so no half-built campaign is left in Ads Manager.
// Every action is written to social_ad_actions and change_log; a launch, a resume or a budget change also DMs the other
// marketing leads on Slack (hub_settings studio_ads_limits.notify, on unless set false).
// Token: META_ADS_TOKEN, the function secret first (Edge Function secrets), else the vault. Never the read-only system token.
// Auth: verify_jwt off; a signed-in staff member who passes wa314_ads_lead, checked as the caller.
// Actions (POST):
//   check                                         the token: who it is, its permissions and when it expires; the accounts
//   campaigns {account_id?}                       each campaign with its status, budget, ad sets and last 7 days' spend
//   status {id, status: 'ACTIVE'|'PAUSED'}        pause or resume a campaign (or an ad set)
//   budget {id, daily?|lifetime?}                 a campaign's budget, or its only ad set's (dollars, not cents)
//   boost {social_post_id, account_id, goal, daily?|total?, start?, end, place, age_min?, age_max?, launch: 'paused'|'active'}
//   limits {value?}                               read (leads) or save (admins) the spending limits
//   log                                           the last 50 actions
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const GRAPH = 'https://graph.facebook.com/v23.0';
const BUSINESS_ID = '686100608981552';
const SITE = 'https://hub.welfareavenue.com';
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Any = any;
class Refused extends Error {}

/* places a boost can reach: a radius around the city, or the whole country */
const PLACES: Record<string, { label: string; geo: Any }> = {
  montreal: { label: 'Montreal, 25 km', geo: { custom_locations: [{ latitude: 45.5019, longitude: -73.5674, radius: 25, distance_unit: 'kilometer' }], location_types: ['home', 'recent'] } },
  toronto: { label: 'Toronto, 25 km', geo: { custom_locations: [{ latitude: 43.6532, longitude: -79.3832, radius: 25, distance_unit: 'kilometer' }], location_types: ['home', 'recent'] } },
  both: { label: 'Montreal and Toronto, 25 km each', geo: { custom_locations: [{ latitude: 45.5019, longitude: -73.5674, radius: 25, distance_unit: 'kilometer' }, { latitude: 43.6532, longitude: -79.3832, radius: 25, distance_unit: 'kilometer' }], location_types: ['home', 'recent'] } },
  canada: { label: 'Canada', geo: { countries: ['CA'], location_types: ['home', 'recent'] } },
};
/* what a boost is for: the campaign objective, the ad set's goal and where people land */
const GOALS: Record<string, { label: string; objective: string; optimize: string; destination?: string }> = {
  engagement: { label: 'More people engage with the post', objective: 'OUTCOME_ENGAGEMENT', optimize: 'POST_ENGAGEMENT', destination: 'ON_POST' },
  reach: { label: 'Reach as many people as possible', objective: 'OUTCOME_AWARENESS', optimize: 'REACH' },
  traffic: { label: 'Visits to the link in the post', objective: 'OUTCOME_TRAFFIC', optimize: 'LINK_CLICKS', destination: 'WEBSITE' },
};
const DEFAULT_LIMITS = { max_daily: 50, max_total: 300, max_days: 30, notify: true };

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return String(data);
}
async function adsToken(): Promise<string> {
  const env = Deno.env.get('META_ADS_TOKEN');
  if (env && env.trim()) return env.trim();
  try { return await getSecret('META_ADS_TOKEN'); } catch (_) { /* below */ }
  throw new Refused('The Meta ads token is not set yet: an admin adds META_ADS_TOKEN in Supabase (Edge Functions, Secrets).');
}
type Me = { email: string; name: string; admin: boolean };
async function caller(req: Request): Promise<Me | 'not-lead' | null> {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = String(data?.user?.email || '').toLowerCase(); if (!email) return null;
  const { data: staff } = await asUser.rpc('is_wa_staff'); if (staff !== true) return null;
  const { data: lead } = await asUser.rpc('wa314_ads_lead'); if (lead !== true) return 'not-lead';
  const { data: adm } = await asUser.rpc('is_hub_admin');
  const meta = (data?.user?.user_metadata || {}) as Record<string, string>;
  return { email, name: meta.full_name || meta.name || email.split('@')[0], admin: adm === true };
}

async function graph(method: 'GET' | 'POST' | 'DELETE', path: string, token: string, params: Record<string, Any> = {}): Promise<Any> {
  const u = new URL(path.startsWith('http') ? path : GRAPH + path);
  const body = new URLSearchParams();
  for (const k of Object.keys(params)) {
    const v = params[k]; if (v === undefined || v === null) continue;
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    if (method === 'GET') u.searchParams.set(k, s); else body.set(k, s);
  }
  const init: RequestInit = { method, headers: { Authorization: 'Bearer ' + token } };
  if (method !== 'GET') { init.body = body.toString(); (init.headers as Record<string, string>)['Content-Type'] = 'application/x-www-form-urlencoded'; }
  const res = await fetch(u.toString(), init);
  const b = await res.json().catch(() => ({}));
  if (!res.ok || b.error) { const e = b.error || {}; throw new Error((e.error_user_title ? e.error_user_title + ': ' : '') + (e.error_user_msg || e.message || ('HTTP ' + res.status)) + (e.code ? ' (code ' + e.code + (e.error_subcode ? '/' + e.error_subcode : '') + ')' : '')); }
  return b;
}
async function all(path: string, token: string, params: Record<string, string>): Promise<Any[]> {
  const out: Any[] = []; let r = await graph('GET', path, token, params);
  for (let i = 0; i < 20; i++) { out.push(...((r.data || []) as Any[])); if (!r.paging || !r.paging.next) break; r = await graph('GET', String(r.paging.next), token); }
  return out;
}

async function limits(): Promise<typeof DEFAULT_LIMITS> {
  try { const { data } = await svc.from('hub_settings').select('value').eq('key', 'studio_ads_limits').maybeSingle(); return { ...DEFAULT_LIMITS, ...((data && data.value) || {}) }; } catch (_) { return { ...DEFAULT_LIMITS }; }
}
let ACCS: Any[] | null = null;
async function accounts(token: string): Promise<Any[]> {
  if (ACCS) return ACCS;
  const r = await all('/' + BUSINESS_ID + '/owned_ad_accounts', token, { fields: 'id,name,account_status,currency,amount_spent,spend_cap,disable_reason', limit: '50' });
  ACCS = r.filter(a => /^act_\d+$/.test(String(a.id)));
  return ACCS;
}
async function ownAccount(token: string, id: string): Promise<Any> {
  const accs = await accounts(token);
  const a = accs.find(x => String(x.id) === String(id) || String(x.id) === 'act_' + String(id));
  if (!a) throw new Refused('That ad account is not one of Welfare Avenue\'s.');
  return a;
}
/* an object (campaign or ad set) the Hub may touch: Meta says which account it is in, and that account must be ours */
async function ownObject(token: string, id: string): Promise<Any> {
  if (!/^\d{6,25}$/.test(String(id))) throw new Refused('Not a campaign id.');
  const o = await graph('GET', '/' + id, token, { fields: 'id,name,account_id,status,effective_status,daily_budget,lifetime_budget,budget_remaining' });
  const acc = await ownAccount(token, 'act_' + String(o.account_id));
  return { ...o, currency: acc.currency };
}
const cents = (dollars: number) => Math.round(Number(dollars) * 100);
const dollars = (c: Any) => c == null || c === '' ? null : Number(c) / 100;

async function audit(me: Me, action: string, account: string | null, object: string | null, detail: Any, ok: boolean, error: string | null): Promise<void> {
  try { await svc.from('social_ad_actions').insert({ by_email: me.email, by_name: me.name, action, account_id: account, object_id: object, detail, ok, error }); } catch (_) { /* audit */ }
  if (ok) { try { await svc.from('change_log').insert({ entity_type: 'social_ads', entity_id: object || account || BUSINESS_ID, field: action, old_value: detail && detail.before != null ? JSON.stringify(detail.before).slice(0, 300) : null, new_value: JSON.stringify(detail && detail.after != null ? detail.after : detail).slice(0, 500), changed_by: me.email }); } catch (_) { /* audit */ } }
}

/* the other marketing leads hear about money moving (Slack DM, the Hub's map of Slack ids first) */
async function leads(): Promise<string[]> {
  try { const { data } = await svc.rpc('wa314_ads_leads'); return ((data || []) as Any[]).map(x => String(x || '').toLowerCase()).filter(e => /@/.test(e)); } catch (_) { return []; }
}
async function slackDm(email: string, text: string): Promise<void> {
  try {
    const tok = await getSecret('SLACK_BOT_TOKEN');
    let id: string | null = null;
    try { const { data } = await svc.from('wa_slack_ids').select('slack_id').eq('email', email).maybeSingle(); if (data?.slack_id) id = String(data.slack_id); } catch (_) { /* lookup */ }
    if (!id) { const r = await (await fetch('https://slack.com/api/users.lookupByEmail?email=' + encodeURIComponent(email), { headers: { Authorization: 'Bearer ' + tok } })).json(); if (r.ok) id = String(r.user.id); }
    if (!id) return;
    const op = await (await fetch('https://slack.com/api/conversations.open', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ users: id }) })).json();
    if (!op.ok) return;
    await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ channel: op.channel.id, text, unfurl_links: false, unfurl_media: false }) });
  } catch (_) { /* a notice never stops the action */ }
}
async function tellLeads(me: Me, text: string): Promise<void> {
  const lim = await limits(); if (lim.notify === false) return;
  for (const e of await leads()) if (e !== me.email) await slackDm(e, text + '\n<' + SITE + '/#studio/ads|Open Paid in the Content Studio>');
}
const money = (v: number, cur: string) => (cur === 'CAD' ? '$' : '') + Number(v).toFixed(2).replace(/\.00$/, '') + (cur && cur !== 'CAD' ? ' ' + cur : '');

/* ---------- check ---------- */
async function check(): Promise<Any> {
  const token = await adsToken();
  const out: Any = { ok: true };
  try { const me = await graph('GET', '/me', token, { fields: 'id,name' }); out.who = me.name || me.id; } catch (e) { out.who_error = String((e as Error).message); }
  try { const p = await graph('GET', '/me/permissions', token); out.granted = ((p.data || []) as Any[]).filter(x => x.status === 'granted').map(x => String(x.permission)); } catch (_) { out.granted = []; }
  try {
    const d = (await graph('GET', '/debug_token', token, { input_token: token })).data || {};
    out.valid = d.is_valid !== false; out.app = d.application || null; out.type = d.type || null;
    out.expires_at = d.expires_at ? new Date(Number(d.expires_at) * 1000).toISOString() : null;   /* 0 means it never expires */
    out.data_access_expires_at = d.data_access_expires_at ? new Date(Number(d.data_access_expires_at) * 1000).toISOString() : null;
    if (!out.granted.length && Array.isArray(d.scopes)) out.granted = d.scopes;
  } catch (e) { out.debug_error = String((e as Error).message).slice(0, 200); }
  out.can_manage = out.granted.indexOf('ads_management') >= 0;
  try { out.accounts = (await accounts(token)).map(a => ({ id: a.id, name: a.name, currency: a.currency, status: a.account_status, spend_cap: dollars(a.spend_cap), lifetime_spend: dollars(a.amount_spent) })); } catch (e) { out.accounts_error = String((e as Error).message).slice(0, 200); }
  try { const { data } = await svc.from('social_accounts').select('platform, external_id, name, handle').in('platform', ['facebook', 'instagram']); out.pages = data || []; } catch (_) { out.pages = []; }
  out.limits = await limits();
  out.places = Object.keys(PLACES).map(k => ({ key: k, label: PLACES[k].label }));
  out.goals = Object.keys(GOALS).map(k => ({ key: k, label: GOALS[k].label }));
  return out;
}

/* ---------- campaigns ---------- */
async function campaigns(accountId?: string): Promise<Any> {
  const token = await adsToken();
  const accs = accountId ? [await ownAccount(token, accountId)] : await accounts(token);
  const out: Any[] = [];
  for (const a of accs) {
    const list = await all('/' + a.id + '/campaigns', token, {
      fields: 'id,name,objective,status,effective_status,daily_budget,lifetime_budget,budget_remaining,start_time,stop_time,created_time,adsets.limit(10){id,name,status,effective_status,daily_budget,lifetime_budget,start_time,end_time},insights.date_preset(last_7d){spend,reach,impressions}',
      effective_status: JSON.stringify(['ACTIVE', 'PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'IN_PROCESS', 'WITH_ISSUES', 'PENDING_REVIEW', 'DISAPPROVED', 'PREAPPROVED', 'PENDING_BILLING_INFO']),
      limit: '100',
    });
    for (const c of list) {
      const ins = ((c.insights && c.insights.data) || [])[0] || {};
      out.push({
        id: c.id, name: c.name, account_id: a.id, account: a.name, currency: a.currency, objective: c.objective, status: c.status, effective_status: c.effective_status,
        daily: dollars(c.daily_budget), lifetime: dollars(c.lifetime_budget), remaining: dollars(c.budget_remaining), start: c.start_time || null, stop: c.stop_time || null, created: c.created_time,
        adsets: ((c.adsets && c.adsets.data) || []).map((s: Any) => ({ id: s.id, name: s.name, status: s.status, effective_status: s.effective_status, daily: dollars(s.daily_budget), lifetime: dollars(s.lifetime_budget), start: s.start_time || null, end: s.end_time || null })),
        spend7: Number(ins.spend || 0), reach7: Number(ins.reach || 0),
      });
    }
  }
  out.sort((x, y) => (x.status === 'ACTIVE' ? 0 : 1) - (y.status === 'ACTIVE' ? 0 : 1) || String(y.created).localeCompare(String(x.created)));
  return { ok: true, campaigns: out, limits: await limits(), at: new Date().toISOString() };
}

/* ---------- pause and resume ---------- */
async function setStatus(me: Me, id: string, status: string): Promise<Any> {
  if (status !== 'ACTIVE' && status !== 'PAUSED') throw new Refused('Status is ACTIVE or PAUSED.');
  const token = await adsToken();
  const o = await ownObject(token, id);
  await graph('POST', '/' + id, token, { status });
  const after = await graph('GET', '/' + id, token, { fields: 'status,effective_status' });
  await audit(me, status === 'ACTIVE' ? 'resume' : 'pause', 'act_' + o.account_id, id, { name: o.name, before: o.status, after: after.status }, true, null);
  if (status === 'ACTIVE') await tellLeads(me, ':arrow_forward: *' + me.name + '* turned on the ad campaign *' + o.name + '*' + (o.daily_budget ? ' (' + money(dollars(o.daily_budget) || 0, o.currency) + ' a day)' : o.lifetime_budget ? ' (' + money(dollars(o.lifetime_budget) || 0, o.currency) + ' in all)' : '') + '.');
  return { ok: true, id, name: o.name, status: after.status, effective_status: after.effective_status };
}

/* ---------- budgets ---------- */
async function setBudget(me: Me, id: string, daily: number | null, lifetime: number | null): Promise<Any> {
  if ((daily == null) === (lifetime == null)) throw new Refused('Give a daily budget or a total budget, not both.');
  const lim = await limits();
  const v = Number(daily != null ? daily : lifetime);
  if (!(v > 0)) throw new Refused('The budget must be more than zero.');
  if (daily != null && v > lim.max_daily) throw new Refused('The most a day is ' + money(lim.max_daily, 'CAD') + ' (the Hub\'s limit). Ask Steel to raise it.');
  if (lifetime != null && v > lim.max_total) throw new Refused('The most for one campaign is ' + money(lim.max_total, 'CAD') + ' (the Hub\'s limit). Ask Steel to raise it.');
  const token = await adsToken();
  let o = await ownObject(token, id);
  let target = o;
  /* a campaign without its own budget: its budget is on the ad set, and only one ad set can be changed for it */
  if (o.daily_budget == null && o.lifetime_budget == null) {
    const sets = await all('/' + id + '/adsets', token, { fields: 'id,name,daily_budget,lifetime_budget,status', limit: '20' });
    if (sets.length === 1) target = { ...sets[0], account_id: o.account_id, currency: o.currency };
    else if (sets.length > 1) throw new Refused('This campaign has ' + sets.length + ' ad sets with their own budgets: change them in Ads Manager.');
  }
  const has = target.daily_budget != null ? 'daily' : target.lifetime_budget != null ? 'lifetime' : null;
  if (has && ((has === 'daily') !== (daily != null))) throw new Refused('This one has a ' + (has === 'daily' ? 'daily' : 'total') + ' budget: change that, or switch it in Ads Manager.');
  const before = has === 'daily' ? dollars(target.daily_budget) : dollars(target.lifetime_budget);
  await graph('POST', '/' + target.id, token, daily != null ? { daily_budget: String(cents(v)) } : { lifetime_budget: String(cents(v)) });
  await audit(me, 'budget', 'act_' + o.account_id, String(target.id), { name: o.name, kind: daily != null ? 'daily' : 'lifetime', before, after: v }, true, null);
  if (before == null || v > before) await tellLeads(me, ':moneybag: *' + me.name + '* set the ' + (daily != null ? 'daily' : 'total') + ' budget of *' + o.name + '* to *' + money(v, o.currency) + '*' + (before != null ? ' (was ' + money(before, o.currency) + ')' : '') + '.');
  o = target;
  return { ok: true, id: String(target.id), name: o.name, before, after: v, kind: daily != null ? 'daily' : 'lifetime' };
}

/* ---------- boost a published post ---------- */
function ymd(d: Date): string { return d.toISOString().slice(0, 10); }
async function boost(me: Me, b: Any): Promise<Any> {
  const lim = await limits();
  const goal = GOALS[String(b.goal || 'engagement')]; if (!goal) throw new Refused('Unknown goal.');
  const place = PLACES[String(b.place || 'montreal')]; if (!place) throw new Refused('Unknown place.');
  const launch = b.launch === 'active' ? 'ACTIVE' : 'PAUSED';
  const daily = b.daily != null && b.daily !== '' ? Number(b.daily) : null;
  const total = b.total != null && b.total !== '' ? Number(b.total) : null;
  if ((daily == null) === (total == null)) throw new Refused('Give a daily budget or a total budget.');
  const start = b.start ? new Date(String(b.start)) : new Date(Date.now() + 10 * 60000);
  const end = b.end ? new Date(String(b.end)) : null;
  if (!end || isNaN(end.getTime())) throw new Refused('Every boost needs an end date.');
  if (isNaN(start.getTime())) throw new Refused('The start date is not a date.');
  if (start.getTime() < Date.now() - 3600000) throw new Refused('The start is in the past.');
  const days = Math.ceil((end.getTime() - start.getTime()) / 86400000);
  if (days < 1) throw new Refused('The end must be at least a day after the start.');
  if (days > lim.max_days) throw new Refused('A boost runs at most ' + lim.max_days + ' days (the Hub\'s limit).');
  if (daily != null && (!(daily >= 1) || daily > lim.max_daily)) throw new Refused('A day\'s budget is between $1 and ' + money(lim.max_daily, 'CAD') + ' (the Hub\'s limit).');
  const most = daily != null ? daily * days : Number(total);
  if (total != null && !(total >= days)) throw new Refused('The total must be at least $1 a day.');
  if (most > lim.max_total) throw new Refused('This boost could spend up to ' + money(most, 'CAD') + '; the most for one boost is ' + money(lim.max_total, 'CAD') + ' (the Hub\'s limit).');
  const ageMin = Math.max(18, Math.min(65, Number(b.age_min) || 18)), ageMax = Math.max(ageMin, Math.min(65, Number(b.age_max) || 65));

  const { data: sp } = await svc.from('social_posts').select('id, platform, external_id, caption, url, published_at').eq('id', Number(b.social_post_id)).maybeSingle();
  if (!sp) throw new Refused('That post is not in the Hub\'s analytics yet.');
  if (sp.platform !== 'facebook' && sp.platform !== 'instagram') throw new Refused('Only Facebook and Instagram posts can be boosted.');
  if (goal.optimize === 'LINK_CLICKS' && sp.platform === 'instagram') throw new Refused('Instagram captions have no clickable link: choose engagement or reach.');
  const { data: accs } = await svc.from('social_accounts').select('platform, external_id').in('platform', ['facebook', 'instagram']);
  const pageId = String(((accs || []) as Any[]).find(a => a.platform === 'facebook')?.external_id || '');
  const igId = String(((accs || []) as Any[]).find(a => a.platform === 'instagram')?.external_id || '');
  if (!pageId) throw new Refused('No Facebook Page is connected in the Content Studio.');

  const token = await adsToken();
  const acc = await ownAccount(token, String(b.account_id || ''));
  if (Number(acc.account_status) !== 1) throw new Refused('The ad account ' + (acc.name || acc.id) + ' is not active in Meta (status ' + acc.account_status + ').');
  const cap = String(sp.caption || '').replace(/\s+/g, ' ').trim().slice(0, 50) || ('post ' + sp.id);
  const name = 'Hub boost: ' + cap + ' (' + ymd(start) + ')';
  const made: string[] = [];
  const detail: Any = { post: sp.id, platform: sp.platform, goal: b.goal, place: b.place, daily, total, start: start.toISOString(), end: end.toISOString(), launch, most, currency: acc.currency };
  try {
    const camp = await graph('POST', '/' + acc.id + '/campaigns', token, {
      name, objective: goal.objective, status: launch, special_ad_categories: [], buying_type: 'AUCTION', is_adset_budget_sharing_enabled: false,
    });
    made.push(String(camp.id));
    const targeting: Any = { geo_locations: place.geo, age_min: ageMin, age_max: ageMax, publisher_platforms: [sp.platform], targeting_automation: { advantage_audience: 0 } };
    if (sp.platform === 'facebook') targeting.facebook_positions = ['feed'];
    else targeting.instagram_positions = ['stream', 'explore'];
    const setParams: Any = {
      name: name.replace('Hub boost', 'Ad set'), campaign_id: camp.id, billing_event: 'IMPRESSIONS', optimization_goal: goal.optimize, bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      start_time: start.toISOString(), end_time: end.toISOString(), targeting, status: 'ACTIVE',
    };
    if (daily != null) setParams.daily_budget = String(cents(daily)); else setParams.lifetime_budget = String(cents(Number(total)));
    if (goal.destination) setParams.destination_type = goal.destination;
    if (goal.objective === 'OUTCOME_ENGAGEMENT') setParams.promoted_object = { page_id: pageId };
    const set = await graph('POST', '/' + acc.id + '/adsets', token, setParams);
    let creative: Any;
    if (sp.platform === 'facebook') {
      const storyId = String(sp.external_id).indexOf('_') > 0 ? String(sp.external_id) : pageId + '_' + String(sp.external_id);
      creative = await graph('POST', '/' + acc.id + '/adcreatives', token, { name: name.replace('Hub boost', 'Creative'), object_story_id: storyId });
    } else {
      if (!igId) throw new Refused('No Instagram account is connected in the Content Studio.');
      const base: Any = { name: name.replace('Hub boost', 'Creative'), object_id: pageId, source_instagram_media_id: String(sp.external_id) };
      try { creative = await graph('POST', '/' + acc.id + '/adcreatives', token, { ...base, instagram_user_id: igId }); }
      catch (e) { if (/instagram_user_id/i.test(String((e as Error).message))) creative = await graph('POST', '/' + acc.id + '/adcreatives', token, { ...base, instagram_actor_id: igId }); else throw e; }
    }
    const ad = await graph('POST', '/' + acc.id + '/ads', token, { name: name.replace('Hub boost', 'Ad'), adset_id: set.id, creative: { creative_id: creative.id }, status: 'ACTIVE' });
    detail.campaign_id = camp.id; detail.adset_id = set.id; detail.ad_id = ad.id; detail.creative_id = creative.id;
    await audit(me, launch === 'ACTIVE' ? 'boost_live' : 'boost_paused', acc.id, String(camp.id), detail, true, null);
    const cur = acc.currency || 'CAD';
    const spendLine = daily != null ? money(daily, cur) + ' a day for ' + days + ' days (up to ' + money(most, cur) + ')' : money(Number(total), cur) + ' over ' + days + ' days';
    await tellLeads(me, (launch === 'ACTIVE' ? ':rocket: *' + me.name + '* boosted a ' : ':pause_button: *' + me.name + '* built a paused boost for a ') + (sp.platform === 'facebook' ? 'Facebook' : 'Instagram') + ' post: _' + cap + '_\n' + spendLine + ', ' + place.label + ', ages ' + ageMin + '-' + ageMax + (launch === 'ACTIVE' ? '. Meta reviews it before it runs.' : '. It stays off until someone turns it on.') + (sp.url ? '\n<' + sp.url + '|The post>' : ''));
    return { ok: true, campaign_id: camp.id, adset_id: set.id, ad_id: ad.id, status: launch, most, days, name, ads_manager: 'https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=' + String(acc.id).replace('act_', '') + '&selected_campaign_ids=' + camp.id };
  } catch (e) {
    /* undo what was made, so Ads Manager is not left with a half-built boost */
    for (const id of made.reverse()) { try { await graph('DELETE', '/' + id, token); } catch (_) { /* best effort */ } }
    await audit(me, 'boost_failed', acc.id, made[0] || null, detail, false, String((e as Error).message).slice(0, 400));
    throw e;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const me = await caller(req);
  if (!me) return json({ error: 'unauthorized' }, 401);
  if (me === 'not-lead') return json({ error: 'Only marketing leads can manage ads.' }, 403);
  const body = await req.json().catch(() => ({})) as Any;
  const action = String(body.action || 'check');
  try {
    if (action === 'check') return json(await check());
    if (action === 'campaigns') return json(await campaigns(body.account_id ? String(body.account_id) : undefined));
    if (action === 'status') return json(await setStatus(me, String(body.id || ''), String(body.status || '')));
    if (action === 'budget') return json(await setBudget(me, String(body.id || ''), body.daily != null && body.daily !== '' ? Number(body.daily) : null, body.lifetime != null && body.lifetime !== '' ? Number(body.lifetime) : null));
    if (action === 'boost') return json(await boost(me, body));
    if (action === 'limits') {
      if (body.value && typeof body.value === 'object') {
        if (!me.admin) return json({ error: 'Only an admin changes the limits.' }, 403);
        const v = body.value, cur = await limits();
        const next = { max_daily: Math.max(1, Math.min(1000, Number(v.max_daily) || cur.max_daily)), max_total: Math.max(1, Math.min(10000, Number(v.max_total) || cur.max_total)), max_days: Math.max(1, Math.min(90, Number(v.max_days) || cur.max_days)), notify: v.notify !== false };
        await svc.from('hub_settings').upsert({ key: 'studio_ads_limits', value: next, updated_at: new Date().toISOString(), updated_by: me.email });
        await audit(me, 'limits', null, null, { before: cur, after: next }, true, null);
        return json({ ok: true, limits: next });
      }
      return json({ ok: true, limits: await limits() });
    }
    if (action === 'log') { const { data } = await svc.from('social_ad_actions').select('*').order('at', { ascending: false }).limit(50); return json({ ok: true, log: data || [] }); }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    const msg = String((e as Error).message || e).slice(0, 400);
    if (!(e instanceof Refused) && (action === 'status' || action === 'budget')) await audit(me, action + '_failed', null, String(body.id || ''), { body: { ...body, action: undefined } }, false, msg);
    return json({ error: msg }, e instanceof Refused ? 400 : 500);
  }
});
