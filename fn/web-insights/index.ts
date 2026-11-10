// Welfare Avenue: web-insights (v2, wave306, 10/11/26; v2: clicks, scroll depth, sections seen, paths between pages)
// The website (welfareavenue.com) for the Content Studio's Results > Website: one call returns what the page draws, read
// live from Google Analytics 4 (property in social_accounts, platform ga4) through the Hub's service account
// (GOOGLE_SA_KEY, a Viewer on the property; analytics.readonly). Nothing about a visitor is stored: GA4 already reports
// totals only, and the answer is cached as totals in web_insights_cache (30 minutes when the range ends today, 6 hours
// otherwise) so repeat visits cost nothing.
// Since 10/11/26 the site counts only visitors who press Accept on its cookie banner (Quebec Law 25), and the
// Welfare Avenue events (donate_click, signup_open, form_submit, form_sent, newsletter_signup, button_click,
// contact_click, language_switch) exist from that day; earlier visits come from the old site's tag.
// Actions (POST):
//   {action:'report', from:'YYYY-MM-DD', to:'YYYY-MM-DD', fresh?}   the whole page for a range, with the period before it
//   {action:'realtime'}                                             visitors in the last 30 minutes (never cached)
// Callers: signed-in staff (is_wa_staff), or the trigger secret. Reads only; never writes to Google.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const API = 'https://analyticsdata.googleapis.com/v1beta/properties/';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
const OUR_EVENTS = ['donate_click', 'signup_open', 'form_submit', 'form_sent', 'newsletter_signup', 'button_click', 'contact_click', 'language_switch', 'link_click', 'scroll_depth', 'section_view'];
const CLICKS = ['donate_click', 'signup_open', 'contact_click', 'language_switch', 'link_click', 'button_click'];
const GA_EVENTS = ['scroll', 'click', 'form_start', 'file_download', 'video_start', 'video_complete', 'view_search_results'];

async function getSecret(name: string): Promise<string> { const { data, error } = await svc.rpc('get_secret', { secret_name: name }); if (error || !data) throw new Error('secret ' + name + ' unavailable'); return data as string; }
async function caller(req: Request): Promise<string | null> {
  try { const s = req.headers.get('x-wa-secret'); if (s && s === (await getSecret('WA_TRIGGER_SECRET'))) return 'automation'; } catch (_) { /* no */ }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  try { const r = await asUser.rpc('is_wa_staff'); if (r.data !== true) return null; } catch (_) { return null; }
  const { data } = await asUser.auth.getUser();
  return (data?.user?.email || '').toLowerCase() || null;
}

/* ---------- Google: the service account ---------- */
function b64url(bytes: Uint8Array): string { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function pemToDer(pem: string): Uint8Array { const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, ''); const raw = atob(body); const out = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out; }
let TOK: { v: string; exp: number } | null = null;
async function token(): Promise<string> {
  if (TOK && Date.now() < TOK.exp - 120000) return TOK.v;
  const sa = JSON.parse(await getSecret('GOOGLE_SA_KEY'));
  const now = Math.floor(Date.now() / 1000), enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(enc.encode(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: sa.token_uri, iat: now, exp: now + 3600 })));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(header + '.' + claims)));
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: header + '.' + claims + '.' + b64url(sig) }) });
  const body = await res.json();
  if (!body.access_token) throw new Error('Google refused the token: ' + String(body.error_description || body.error || res.status).slice(0, 160));
  TOK = { v: body.access_token, exp: Date.now() + 3500 * 1000 };
  return TOK.v;
}
async function ga(pid: string, method: string, body: unknown): Promise<Row> {
  const res = await fetch(API + pid + ':' + method, { method: 'POST', headers: { Authorization: 'Bearer ' + (await token()), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const txt = await res.text(); let j: Row = {}; try { j = txt ? JSON.parse(txt) : {}; } catch (_) { j = { raw: txt.slice(0, 200) }; }
  if (!res.ok) throw new Error('Google Analytics ' + res.status + ': ' + String(j?.error?.message || txt).slice(0, 220));
  return j;
}
async function property(): Promise<{ pid: string; site: string | null }> {
  const { data } = await svc.from('social_accounts').select('external_id, url, meta').eq('platform', 'ga4').eq('status', 'connected').order('id').limit(1);
  const a = (data || [])[0];
  if (!a) throw new Error('No website is connected (Connections > Google Analytics)');
  return { pid: String(a.external_id), site: a.url || (a.meta && a.meta.site) || null };
}

/* ---------- reports ---------- */
const M = (n: string) => ({ name: n });
const D = (n: string) => ({ name: n });
function rows(r: Row): Row[] {
  const dh = (r.dimensionHeaders || []).map((h: Row) => h.name), mh = (r.metricHeaders || []).map((h: Row) => h.name);
  return ((r.rows || []) as Row[]).map((x) => {
    const o: Row = {};
    (x.dimensionValues || []).forEach((v: Row, i: number) => { o[dh[i]] = v.value; });
    (x.metricValues || []).forEach((v: Row, i: number) => { o[mh[i]] = Number(v.value); });
    return o;
  });
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
function prevRange(from: string, to: string): [string, string] {
  const a = new Date(from + 'T00:00:00Z'), b = new Date(to + 'T00:00:00Z');
  const days = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  const pb = new Date(a.getTime() - 86400000), pa = new Date(pb.getTime() - (days - 1) * 86400000);
  return [iso(pa), iso(pb)];
}
const NOT_SET = /^\(not set\)$|^\(none\)$|^$/;

async function report(from: string, to: string): Promise<Row> {
  const { pid, site } = await property();
  const [pf, pt] = prevRange(from, to);
  const cur = [{ startDate: from, endDate: to, name: 'cur' }], both = [{ startDate: from, endDate: to, name: 'cur' }, { startDate: pf, endDate: pt, name: 'prev' }];
  const TOT = ['totalUsers', 'newUsers', 'sessions', 'engagedSessions', 'engagementRate', 'userEngagementDuration', 'averageSessionDuration', 'screenPageViews', 'eventCount'].map(M);
  const ourFilter = { filter: { fieldName: 'eventName', inListFilter: { values: OUR_EVENTS.concat(GA_EVENTS) } } };
  const batchA = [
    { dateRanges: both, metrics: TOT },
    { dateRanges: cur, dimensions: [D('date')], metrics: ['totalUsers', 'sessions', 'engagedSessions', 'screenPageViews'].map(M), orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 400 },
    { dateRanges: both, dimensions: [D('sessionDefaultChannelGroup')], metrics: ['sessions', 'engagedSessions', 'totalUsers', 'userEngagementDuration'].map(M), limit: 30 },
    { dateRanges: cur, dimensions: [D('sessionSource'), D('sessionMedium')], metrics: ['sessions', 'engagedSessions', 'totalUsers'].map(M), orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 15 },
    { dateRanges: cur, dimensions: [D('sessionCampaignName'), D('sessionSource')], metrics: ['sessions', 'engagedSessions', 'totalUsers'].map(M), orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 20 }
  ];
  const batchB = [
    { dateRanges: cur, dimensions: [D('landingPage')], metrics: ['sessions', 'engagedSessions', 'userEngagementDuration', 'totalUsers', 'keyEvents'].map(M), orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 15 },
    { dateRanges: cur, dimensions: [D('pagePath'), D('pageTitle')], metrics: ['screenPageViews', 'totalUsers', 'userEngagementDuration'].map(M), orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 25 },
    { dateRanges: both, dimensions: [D('eventName')], metrics: ['eventCount', 'totalUsers', 'eventValue'].map(M), dimensionFilter: ourFilter, limit: 40 },
    { dateRanges: cur, dimensions: [D('deviceCategory')], metrics: ['totalUsers', 'sessions', 'engagementRate'].map(M), limit: 10 },
    { dateRanges: cur, dimensions: [D('newVsReturning')], metrics: ['totalUsers', 'sessions'].map(M), limit: 5 }
  ];
  const batchC = [
    { dateRanges: cur, dimensions: [D('city'), D('country')], metrics: ['totalUsers', 'sessions'].map(M), orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }], limit: 12 },
    { dateRanges: cur, dimensions: [D('customEvent:donate_campaign')], metrics: ['eventCount', 'totalUsers', 'eventValue'].map(M), dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: 'donate_click' } } }, limit: 20 },
    { dateRanges: cur, dimensions: [D('eventName'), D('customEvent:form')], metrics: ['eventCount', 'totalUsers'].map(M), dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: ['signup_open', 'form_submit', 'form_sent', 'newsletter_signup'] } } }, limit: 40 },
    { dateRanges: cur, dimensions: [D('date'), D('eventName')], metrics: [M('eventCount')], dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: ['donate_click', 'form_sent', 'newsletter_signup'] } } }, limit: 1200 },
    { dateRanges: cur, dimensions: [D('linkUrl')], metrics: ['eventCount', 'totalUsers'].map(M), dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: 'click' } } }, orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }], limit: 12 }
  ];
  const run = async (reqs: Row[]) => {
    try { return { ok: true, list: (await ga(pid, 'batchRunReports', { requests: reqs })).reports || [] }; }
    catch (e) {
      // one bad report (a custom dimension Google has not taken in yet) fails the batch: run them one by one
      const list = await Promise.all(reqs.map(async (q) => { try { return await ga(pid, 'runReport', q); } catch (x) { return { error: String((x as Error).message || x).slice(0, 200) }; } }));
      return { ok: false, list, err: String((e as Error).message || e).slice(0, 200) };
    }
  };
  const batchD = [
    { dateRanges: cur, dimensions: [D('eventName'), D('customEvent:click_text'), D('customEvent:click_area'), D('pagePath')], metrics: ['eventCount', 'totalUsers'].map(M), dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: CLICKS } } }, orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }], limit: 60 },
    { dateRanges: cur, dimensions: [D('pagePath'), D('customEvent:scroll_pct')], metrics: [M('totalUsers')], dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: 'scroll_depth' } } }, limit: 200 },
    { dateRanges: cur, dimensions: [D('pagePath'), D('customEvent:section')], metrics: [M('totalUsers')], dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: 'section_view' } } }, orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }], limit: 200 },
    { dateRanges: cur, dimensions: [D('pageReferrer'), D('pagePath')], metrics: [M('screenPageViews')], dimensionFilter: { filter: { fieldName: 'pageReferrer', stringFilter: { matchType: 'CONTAINS', value: 'welfareavenue.com' } } }, orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 60 },
    { dateRanges: cur, dimensions: [D('pagePath')], metrics: [M('totalUsers')], orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }], limit: 40 }
  ];
  const [A, B, C, Dd] = await Promise.all([run(batchA), run(batchB), run(batchC), run(batchD)]);
  const pathOf = (u: string) => { try { return new URL(u).pathname; } catch (_) { return u; } };
  const err = (r: Row) => (r && r.error) ? r.error : null;
  const split = (rs: Row[]) => ({ cur: rs.filter((x) => !x.dateRange || x.dateRange === 'cur').map((x) => { const y = { ...x }; delete y.dateRange; return y; }), prev: rs.filter((x) => x.dateRange === 'prev').map((x) => { const y = { ...x }; delete y.dateRange; return y; }) });
  const totals = split(rows(A.list[0] || {}));
  const out: Row = {
    ok: true, property: pid, site, from, to, prev: { from: pf, to: pt }, made_at: new Date().toISOString(),
    consent_since: '2026-11-10', events_since: '2026-11-10',
    totals: { cur: totals.cur[0] || null, prev: totals.prev[0] || null },
    daily: rows(A.list[1] || {}).map((r) => ({ day: r.date.slice(0, 4) + '-' + r.date.slice(4, 6) + '-' + r.date.slice(6, 8), users: r.totalUsers, sessions: r.sessions, engaged: r.engagedSessions, views: r.screenPageViews })),
    channels: split(rows(A.list[2] || {})),
    sources: rows(A.list[3] || {}),
    campaigns: rows(A.list[4] || {}).filter((r) => !NOT_SET.test(r.sessionCampaignName) && !/^\((direct|organic|referral|cross-network)\)$/.test(r.sessionCampaignName)),
    landing: rows(B.list[0] || {}).filter((r) => !NOT_SET.test(r.landingPage)),
    pages: rows(B.list[1] || {}),
    events: split(rows(B.list[2] || {})),
    devices: rows(B.list[3] || {}),
    returning: rows(B.list[4] || {}),
    places: rows(C.list[0] || {}).filter((r) => !NOT_SET.test(r.city)),
    donate: rows(C.list[1] || {}).map((r) => ({ campaign: NOT_SET.test(r['customEvent:donate_campaign']) ? 'general' : r['customEvent:donate_campaign'], clicks: r.eventCount, people: r.totalUsers, value: r.eventValue })),
    forms: rows(C.list[2] || {}).map((r) => ({ event: r.eventName, form: NOT_SET.test(r['customEvent:form']) ? null : r['customEvent:form'], count: r.eventCount, people: r.totalUsers })),
    actions_daily: rows(C.list[3] || {}).map((r) => ({ day: r.date.slice(0, 4) + '-' + r.date.slice(4, 6) + '-' + r.date.slice(6, 8), event: r.eventName, count: r.eventCount })),
    outbound: rows(C.list[4] || {}).filter((r) => !NOT_SET.test(r.linkUrl)),
    clicks: rows(Dd.list[0] || {}).map((r) => ({ event: r.eventName, text: NOT_SET.test(r['customEvent:click_text']) ? null : r['customEvent:click_text'], area: NOT_SET.test(r['customEvent:click_area']) ? null : r['customEvent:click_area'], page: r.pagePath, count: r.eventCount, people: r.totalUsers })),
    scroll: rows(Dd.list[1] || {}).map((r) => ({ page: r.pagePath, pct: Number(r['customEvent:scroll_pct']) || 0, people: r.totalUsers })).filter((r) => r.pct),
    sections: rows(Dd.list[2] || {}).map((r) => ({ page: r.pagePath, section: r['customEvent:section'], people: r.totalUsers })).filter((r) => !NOT_SET.test(r.section || '')),
    paths: rows(Dd.list[3] || {}).map((r) => ({ from: pathOf(r.pageReferrer), to: r.pagePath, views: r.screenPageViews })).filter((r) => r.from !== r.to),
    page_people: rows(Dd.list[4] || {}).map((r) => ({ page: r.pagePath, people: r.totalUsers })),
    errors: [A, B, C, Dd].flatMap((b) => b.list.map(err).filter(Boolean))
  };
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const who = await caller(req);
    if (!who) return json({ error: 'staff only' }, 401);
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'report';
    if (action === 'realtime') {
      const { pid } = await property();
      const r = await ga(pid, 'runRealtimeReport', { dimensions: [D('unifiedScreenName')], metrics: [M('activeUsers')], limit: 10 });
      const list = rows(r);
      return json({ ok: true, active: list.reduce((s, x) => s + (x.activeUsers || 0), 0), pages: list });
    }
    if (action !== 'report') return json({ error: 'unknown action' }, 400);
    const today = iso(new Date());
    const re = /^\d{4}-\d{2}-\d{2}$/;
    let from = String(body.from || ''), to = String(body.to || '');
    if (!re.test(to)) to = today;
    if (!re.test(from)) { const d = new Date(to + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 27); from = iso(d); }
    if (from > to) [from, to] = [to, from];
    const key = 'report:' + from + ':' + to;
    const ttl = to >= today ? 30 * 60000 : 6 * 3600000;
    if (!body.fresh) {
      const c = await svc.from('web_insights_cache').select('body, made_at').eq('key', key).maybeSingle();
      if (c.data && Date.now() - new Date(c.data.made_at).getTime() < ttl) return json({ ...c.data.body, cached: true });
    }
    const out = await report(from, to);
    await svc.from('web_insights_cache').upsert({ key, body: out, made_at: out.made_at });
    return json(out);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
