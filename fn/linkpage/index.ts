// Welfare Avenue: linkpage (v1, 09/10/26, wave230 link pages)
// The public link pages (hub.welfareavenue.com/links and /links/<slug>; Netlify proxies /lp here) and their weekly summary.
// Steel (09/10/26): "a linktree section of the studio with the ability to track insights on who clicking what link ... similar
// to linktree pro but much better". Insights with no cookie: the network and browser reduced to keyed hashes (lp.ts); a person
// is named only when they sign up or give (wa230_conversions).
// Auth: verify_jwt off. load is public (a live page; a draft only for preview, which records nothing); digest needs the
// trigger secret (the Monday cron).
// Actions (POST, JSON or text/plain):
//   load {slug, s?, tz?, lang?, ref?, preview?}  the page with its live blocks (schedules applied, A/B variant chosen per
//        visitor), the latest Instagram posts and upcoming events when a block asks, and the signed visit token its links
//        carry to /l/; records the view (not for bots or preview)
//   digest                                     the week's numbers to the marketing leads and admins (Hub + Slack)
// Tables: link_pages, link_page_events (insert), link_page_sources, short_links, social_posts, site_events (read).
import { svc, Any, HUB, secret, isBot, parseUA, sourceOf, hostOf, geoOf, hashes, signVisit, record, ANON_KEY, SUPABASE_URL } from './lp.ts';

const CORS: Record<string, string> = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-wa-secret, authorization, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function liveNow(b: Any, now: number): boolean {
  if (b.on === false) return false;
  if (b.start_at && new Date(b.start_at).getTime() > now) return false;
  if (b.end_at && new Date(b.end_at).getTime() <= now) return false;
  return true;
}
function pick(b: Any, key: string, fr: boolean): string { const v = fr ? (b[key + '_fr'] || b[key]) : b[key]; return v == null ? '' : String(v); }

async function load(req: Request, body: Any): Promise<Response> {
  const slug = String(body.slug || 'main').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || 'main';
  const preview = body.preview === true;
  const { data: page } = await svc.from('link_pages').select('*').eq('slug', slug).maybeSingle();
  if (!page || (page.status !== 'live' && !preview)) return json({ error: 'not_found' }, 404);
  const ua = req.headers.get('user-agent') || '';
  const pu = parseUA(ua), bot = isBot(ua);
  const tz = String(body.tz || '').slice(0, 60);
  const h = await hashes(req, pu);
  const settings = page.settings || {};
  const wantFr = body.lang === 'fr' || (body.lang !== 'en' && settings.lang !== 'en' && /^fr/i.test(String(req.headers.get('accept-language') || '')));
  const fr = wantFr && settings.lang !== 'en';
  const refHost = hostOf(body.ref ? String(body.ref) : null);
  const so = sourceOf(String(body.s || ''), refHost === 'hub.welfareavenue.com' ? '' : refHost, pu);
  const now = Date.now();
  /* A/B: half the visitors (by the monthly visitor hash) see variant b until a winner is picked */
  const bucket = h.visitor ? parseInt(h.visitor.slice(-2), 16) % 2 : Math.floor(Math.random() * 2);
  const ab: Record<string, string> = {};
  const blocks: Any[] = [];
  let needIg = 0, needEvents = 0;
  for (const b of (Array.isArray(page.blocks) ? page.blocks : [])) {
    if (!preview && !liveNow(b, now)) continue;
    let label = pick(b, 'label', fr), sub = pick(b, 'sub', fr);
    if (b.ab && b.ab.on) {
      const v = b.ab.winner === 'a' || b.ab.winner === 'b' ? b.ab.winner : (bucket ? 'b' : 'a');
      if (!b.ab.winner) ab[b.id] = v;
      if (v === 'b') { label = pick(b.ab, 'label', fr) || label; sub = pick(b.ab, 'sub', fr) || sub; }
    }
    const out: Any = { id: b.id, type: b.type, label, sub, icon: b.icon || '', featured: !!b.featured, thumb: b.thumb || '' };
    if (b.type === 'link') out.code = b.code || '';
    if (b.type === 'form') out.to = '/f/' + String((fr && b.form_fr) || b.form || '').replace(/[^a-z0-9-]/gi, '') + (fr && !b.form_fr ? '?lang=fr' : '');
    if (b.type === 'donate') out.to = '/give' + (b.campaign ? '?c=' + encodeURIComponent(String(b.campaign).slice(0, 40)) : '') + (fr ? (b.campaign ? '&' : '?') + 'lang=fr' : '');
    if (b.type === 'text' || b.type === 'header') out.text = pick(b, 'text', fr);
    if (b.type === 'youtube') out.video = String(b.video || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20);
    if (b.type === 'impact') out.stats = (Array.isArray(b.stats) ? b.stats : []).slice(0, 4).map((s: Any) => ({ n: String(s.n || '').slice(0, 20), label: fr ? (s.label_fr || s.label || '') : (s.label || '') }));
    if (b.type === 'instagram') { out.count = Math.max(3, Math.min(9, Number(b.count) || 6)); needIg = Math.max(needIg, out.count); }
    if (b.type === 'events') { out.count = Math.max(1, Math.min(6, Number(b.count) || 3)); needEvents = Math.max(needEvents, out.count); }
    blocks.push(out);
  }
  const extra: Any = {};
  if (needIg) {
    const { data } = await svc.from('social_posts').select('url, thumb_cached, thumb_url, caption, published_at, kind').eq('platform', 'instagram').not('url', 'is', null).order('published_at', { ascending: false }).limit(needIg + 3);
    extra.instagram = ((data || []) as Any[]).filter(p => (p.thumb_cached || p.thumb_url) && String(p.kind || '').toLowerCase().indexOf('story') < 0).slice(0, needIg).map(p => ({ url: p.url, img: p.thumb_cached || p.thumb_url, alt: String(p.caption || '').slice(0, 120) }));
  }
  if (needEvents) {
    const { data } = await svc.from('site_events').select('slug, title, starts_at, city, location, poster_url, ticket_url').eq('published', true).gte('starts_at', new Date().toISOString()).order('starts_at').limit(needEvents);
    extra.events = ((data || []) as Any[]).map(e => ({ title: e.title, at: e.starts_at, where: e.city || e.location || '', img: e.poster_url || null, url: e.ticket_url || ('https://welfareavenue.com/events/' + (e.slug || '')) }));
  }
  let repeat = false;
  if (!preview && !bot) {
    const geo = geoOf(req, tz);
    if (h.visitor) {
      const startToday = new Date(); startToday.setUTCHours(0, 0, 0, 0);
      const monthStart = new Date(startToday); monthStart.setUTCDate(1);
      const { count } = await svc.from('link_page_events').select('id', { count: 'exact', head: true }).eq('visitor', h.visitor).eq('kind', 'view').gte('at', monthStart.toISOString()).lt('at', startToday.toISOString());
      repeat = (count || 0) > 0;
    }
    await record(req, { page_id: page.id, kind: 'view', src: so.src, src_detail: so.detail, visitor: h.visitor, repeat_visit: repeat, lang: fr ? 'fr' : 'en', device: pu.device, os: pu.os, browser: pu.browser, country: geo.country, region: geo.region, city: geo.city, tz: tz || null, ipm: h.ipm, variant: Object.keys(ab).length ? JSON.stringify(ab).slice(0, 300) : null });
  }
  const t = preview || bot ? '' : await signVisit({ p: page.id, s: so.src, sd: so.detail, v: h.visitor, ab, l: fr ? 'fr' : 'en', tz: tz || undefined, rv: repeat });
  return json({
    page: { slug: page.slug, title: (fr && page.title_fr) || page.title, bio: (fr && page.bio_fr) || page.bio || '', avatar: page.avatar_url || '', theme: page.theme || {}, socials: page.socials || {}, seo: settings.seo || null, lang_toggle: settings.lang !== 'en' && settings.lang !== 'fr-only' },
    lang: fr ? 'fr' : 'en', blocks, ...extra, t
  });
}

/* ---------- the weekly summary ---------- */
async function publishers(): Promise<string[]> {
  const { data: roles } = await svc.from('hub_roles').select('email, role, profile');
  const { data: team } = await svc.from('team_members').select('email, department, active');
  const mkt = new Set(((team || []) as Any[]).filter(t => t.active && t.department === 'marketing').map(t => String(t.email || '').toLowerCase()));
  return ((roles || []) as Any[]).filter(r => r.role === 'admin' || (r.role === 'leader' && (r.profile === 'marketing' || mkt.has(String(r.email).toLowerCase())))).map(r => String(r.email).toLowerCase()).filter(e => /@welfareavenue\.com$/.test(e));
}
async function slackDm(email: string, text: string): Promise<string> {
  try {
    const tok = await secret('SLACK_BOT_TOKEN');
    let id: string | null = null;
    const { data } = await svc.from('wa_slack_ids').select('slack_id').eq('email', email).maybeSingle(); if (data?.slack_id) id = String(data.slack_id);
    if (!id) { const b = await (await fetch('https://slack.com/api/users.lookupByEmail?email=' + encodeURIComponent(email), { headers: { Authorization: 'Bearer ' + tok } })).json(); if (b.ok) id = b.user.id; }
    if (!id) return 'no Slack account';
    const op = await (await fetch('https://slack.com/api/conversations.open', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ users: id }) })).json();
    if (!op.ok) return 'open failed';
    const ps = await (await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ channel: op.channel.id, text, unfurl_links: false, unfurl_media: false }) })).json();
    return ps.ok ? 'sent' : 'post failed';
  } catch (e) { return 'error ' + String(e).slice(0, 60); }
}
async function digest(dry: boolean): Promise<Any> {
  const { data: cfg } = await svc.from('app_config').select('value').eq('key', 'link_pages_digest').maybeSingle();
  if (cfg && String(cfg.value) === 'off') return { skipped: 'switched off' };
  const since = new Date(Date.now() - 7 * 86400000), before = new Date(Date.now() - 14 * 86400000);
  const { data: ev } = await svc.from('link_page_events').select('page_id, at, kind, block_id, src, visitor').gte('at', before.toISOString()).eq('is_test', false).limit(50000);
  const rows = (ev || []) as Any[];
  const cur = rows.filter(r => new Date(r.at) >= since), prev = rows.filter(r => new Date(r.at) < since);
  const views = cur.filter(r => r.kind === 'view').length, clicks = cur.filter(r => r.kind === 'click').length;
  const pViews = prev.filter(r => r.kind === 'view').length;
  if (!views && !pViews) return { skipped: 'no visits' };
  const visitors = new Set(cur.filter(r => r.kind === 'view' && r.visitor).map(r => r.visitor)).size;
  const { data: pages } = await svc.from('link_pages').select('id, slug, title, blocks');
  const blockLabel = (pid: number, bid: string) => { const p = ((pages || []) as Any[]).find(x => x.id === pid); const b = p && (p.blocks || []).find((x: Any) => x.id === bid); return b ? (b.label || b.type) : bid; };
  const count = (list: Any[], key: (r: Any) => string) => { const m: Record<string, number> = {}; list.forEach(r => { const k = key(r); m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const topLinks = count(cur.filter(r => r.kind === 'click'), r => blockLabel(r.page_id, r.block_id)).slice(0, 3);
  const topSrc = count(cur.filter(r => r.kind === 'view'), r => r.src || 'direct').slice(0, 3);
  const { data: conv } = await svc.rpc('wa230_conversions', { p_days: 7 });
  const signups = ((conv || []) as Any[]).filter(c => c.kind === 'form').length, gifts = ((conv || []) as Any[]).filter(c => c.kind === 'donation' && c.completed).length;
  const ch = pViews ? Math.round((views - pViews) / pViews * 100) : null;
  const ctr = views ? Math.round(clicks / views * 100) : 0;
  const title = 'Link pages, last 7 days';
  const line = views + ' views (' + visitors + ' people' + (ch != null ? ', ' + (ch >= 0 ? '+' : '') + ch + '% on the week before' : '') + '), ' + clicks + ' clicks (' + ctr + '%)' + (signups || gifts ? ', ' + signups + ' sign-up' + (signups === 1 ? '' : 's') + (gifts ? ' and ' + gifts + ' gift' + (gifts === 1 ? '' : 's') : '') : '');
  const slack = ':link: *Link pages, last 7 days*\n' + line + '\n' + (topLinks.length ? 'Most clicked: ' + topLinks.map(x => x[0] + ' (' + x[1] + ')').join(', ') + '\n' : '') + (topSrc.length ? 'Visits from: ' + topSrc.map(x => x[0] + ' (' + x[1] + ')').join(', ') + '\n' : '') + '<' + HUB + '/#studio/pages/insights|Open the insights>';
  const to = await publishers();
  if (dry) return { to, slack };
  const out: string[] = [];
  for (const e of to) {
    const { data: p } = await svc.from('wa_notify_prefs').select('prefs, disabled').eq('email', e).maybeSingle();
    const off = (Array.isArray(p?.disabled) ? p?.disabled : []) as string[];
    if (off.indexOf('content_studio') >= 0) { out.push(e + ': off'); continue; }
    const chn = String((p?.prefs as Any)?.channel || 'both');
    if (chn !== 'hub') out.push(e + ': ' + await slackDm(e, slack));
  }
  try { await fetch(SUPABASE_URL + '/functions/v1/hub-push', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-wa-secret': await secret('WA_TRIGGER_SECRET'), Authorization: 'Bearer ' + ANON_KEY }, body: JSON.stringify({ action: 'studio', to, title, body: line, url: '/#studio/pages/insights', tag: 'link-pages-week' }) }); } catch (_) { /* best effort */ }
  try { await svc.from('change_log').insert({ entity_type: 'link_pages', entity_id: 'digest', field: 'sent', old_value: null, new_value: line.slice(0, 280), changed_by: 'linkpage' }); } catch (_) { /* audit */ }
  return { ok: true, told: out, line };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const raw = await req.text();
  if (raw.length > 4000) return json({ error: 'too_large' }, 413);
  let body: Any = {}; try { body = JSON.parse(raw || '{}'); } catch (_) { return json({ error: 'bad_json' }, 400); }
  const action = String(body.action || 'load');
  try {
    if (action === 'load') return await load(req, body);
    if (action === 'digest') {
      const given = req.headers.get('x-wa-secret') || '';
      if (!given || given !== await secret('WA_TRIGGER_SECRET')) return json({ error: 'unauthorized' }, 401);
      return json(await digest(body.dry === true));
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 200) }, 500);
  }
});
