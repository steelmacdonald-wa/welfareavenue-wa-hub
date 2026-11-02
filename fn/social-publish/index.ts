// Welfare Avenue: social-publish (v6, 02/11/26, wave277 adapters and the registry; v5 15/10/26, wave242 the notification centre; v4 15/10/26, wave241 approvals; v3 09/10/26, wave225 the Content Studio)
// v6: each platform's publishing lives in adapters/<key>.ts (same requests as v5, now through one ctx); PUBLISHERS is a lookup.
// v6: the platform names, the platform list and each platform's caps come from the studio_platforms registry (platforms.ts),
//     active and inactive, so an old post naming an inactive platform still resolves; without the registry, v5's literals.
// v6: capabilities (capabilities.ts) adds platforms (the active ones) and caps (key to caps); each mode comes from its adapter.
// v6: LinkedIn posts two to caps.max_images photos as one multiImage post, and one video (initialize, upload the parts,
//     finalize, check twice for AVAILABLE). A video with photos, or two videos, or more photos than the caps allow, goes to
//     the reminder with the reason.
// v6 fix: a slow LinkedIn video goes through the pending pipeline like Instagram and Threads (finishPending posts it later).
// v6: publishers() adds the approvers the database counts (wa241_approvers), so an approver is a publisher here too.
// v5 (wave242): the notification centre's switches for the Content Studio kind (wa_notify_prefs.prefs.kinds.content_studio =
//   {hub, slack}) decide: Slack off means no DM whatever the devices; Hub off means no Hub notification; no entry means the
//   old rules (the channel, the disabled list).
// v4 (wave241, Steel 14/10/26: scheduling goes to approval, "sent a message to you and KK, and it's like a button, you can
//   literally just click a button to approve in Slack"): the pending notice goes to the approvers (hub_settings
//   content_studio.approvers, else the marketing leads and admins) with Approve and Send it back links into the Hub
//   (#studio/approvals?post=<id>&do=approve|back), and names the Canva design (content_posts.canva_url), the partner and a
//   LinkedIn article (format article). The decision notice names the time the post goes out.
// The Content Studio's publisher, reminder and confirmer.
// v3 (wave225, Steel 09/10/26: "Make it the most sophisticated content calendar possible"):
//   - Instagram: feed photos (alt text, people tags, location, collaborators), carousels (alt text and tags per photo), reels
//     (cover frame or cover image, share to feed, collaborators, location, audio name) and stories (photo or video).
//   - Facebook: feed posts as before, Reels (/video_reels) and Stories (/photo_stories, /video_stories).
//   - First comment on Instagram and Facebook (a reply on Threads) right after the post, per platform or shared.
//   - Per-platform captions (content_posts.variants.<platform>.caption) and the 5-hashtag cap Instagram has had since Dec 2025.
//   - Threads (graph.threads.net with the token social-connect keeps in the vault), LinkedIn (direct with the Community
//     Management token when approved, else the Make.com webhook), YouTube Shorts (resumable upload with the OAuth refresh
//     token) and TikTok (the video sent to WA's TikTok inbox as a draft). A platform with no connection gets the reminder
//     flow: at the post's time the owner gets a Hub notification and a Slack DM with the caption and the media, and marks it
//     posted in the Hub.
//   - Tracked links: http(s) links in captions become hub.welfareavenue.com/l/<code> with UTM tags (short_links; the go
//     function counts the clicks). Instagram captions are left alone (links are not clickable there).
//   - Approvals: a post that is not approved is only published for a publisher (wa225_publisher, checked as the caller);
//     approval_notify tells the publishers when a post waits and the sender when it is decided (Hub notification + Slack DM).
//   - Repeating posts: after one goes out, the next is made from content_posts.repeat_rule.
// Posting is claimed first (status draft, scheduled or failed to publishing, one conditional update) and each platform's
// result is saved as it lands, so a retry never posts twice.
// Actions (POST):
//   {action:'capabilities'}                 every connection and what it can do                     (staff)
//   {action:'publish', post_id}             publish one post now                                   (a publisher, or an approved post)
//   {action:'run'}                          due posts, reminders, pending videos, stuck posts, repeats, confirmations   (cron, x-wa-secret)
//   {action:'confirm', days?}               match calendar entries to social_posts                 (staff or automation)
//   {action:'preview', post_id}             what each platform would receive, sending nothing      (staff)
//   {action:'settings', value?}             read or save the calendar settings (Slack confirmations) (staff)
//   {action:'approval_notify', post_id, state}  from the trigger trg_wa225_approval_notify          (x-wa-secret)
//   {action:'mark_posted', post_id, platform, url?}  a person posted it by hand                    (staff)
//   {action:'remind_test', post_id}         what the reminder would say, sending nothing          (staff)
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { byKey, names, type Platform, platforms } from './platforms.ts';
import { ADAPTERS } from './adapters/index.ts';
import { type Any, type Caps, containerStatus, firstCommentOf, graph, images, kindOf, Manual, Pending, type Post, type PubCtx, rawCaption, type Targets, THREADS, videos } from './adapters/types.ts';
import { igFinish } from './adapters/instagram.ts';
import { threadsFinish, threadsTarget } from './adapters/threads.ts';
import { linkedinFinish } from './adapters/linkedin.ts';
import { capabilitiesOf } from './capabilities.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const SITE = 'https://hub.welfareavenue.com';
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
/* v6: the names, platforms and caps come from the registry (studio_platforms, active and inactive, so an old post naming an
   inactive platform still resolves); these literals stand when the registry cannot be read, so publishing never stops */
const PNAME: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', threads: 'Threads', linkedin: 'LinkedIn', tiktok: 'TikTok', youtube: 'YouTube' };
const FALLBACK_CAPS: Caps = { text: true, images: true, max_images: 20, video: true, max_video_s: 600, comments: true, analytics: true, link_in_caption: true };
let REG: Platform[] = [];
let REGBY: Record<string, Platform> = {};
async function loadReg(): Promise<void> {
  try {
    const list = await platforms(svc, { includeInactive: true });
    if (list.length) { REG = list; REGBY = byKey(list); Object.assign(PNAME, names(list)); }
  } catch (e) { console.log('social-publish: registry unavailable: ' + String((e as Error)?.message || e)); }
}

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
async function secretOrNull(name: string): Promise<string | null> { try { return await getSecret(name); } catch (_) { return null; } }
type Me = { email: string; name: string; auto: boolean; publisher: boolean };
async function who(req: Request): Promise<Me | null> {
  try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) return { email: 'automation', name: 'automation', auto: true, publisher: true }; } catch (_) { /* no */ }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  if (auth.slice(7) === SERVICE_KEY) return { email: 'automation', name: 'automation', auto: true, publisher: true };
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  if (!email) return null;
  const { data: ok } = await asUser.rpc('is_wa_staff');
  if (ok !== true) return null;
  const { data: pub } = await asUser.rpc('wa225_publisher');
  const meta = (data?.user?.user_metadata || {}) as Record<string, string>;
  return { email, name: meta.full_name || meta.name || email.split('@')[0], auto: false, publisher: pub === true };
}

/* ---------- settings, Slack, Hub notifications ---------- */
async function setting(key: string): Promise<Record<string, Any>> {
  try { const { data } = await svc.from('hub_settings').select('value').eq('key', key).maybeSingle(); return ((data && data.value) || {}) as Record<string, Any>; } catch (_) { return {}; }
}
const settings = () => setting('content_calendar');
const studio = () => setting('content_studio');
const connections = () => setting('studio_connections');
const CH: Record<string, string> = {};
async function slackChannel(tok: string, name: string): Promise<string | null> {
  if (CH[name]) return CH[name];
  let cursor = '';
  for (let i = 0; i < 10; i++) {
    const res = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=200' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), { headers: { Authorization: 'Bearer ' + tok } });
    const b = await res.json();
    const hit = ((b.channels || []) as Any[]).find(c => c.name === name || c.id === name);
    if (hit) {
      CH[name] = String(hit.id);
      if (!hit.is_member) { try { await fetch('https://slack.com/api/conversations.join', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: hit.id }) }); } catch (_) { /* private */ } }
      return CH[name];
    }
    cursor = b.response_metadata?.next_cursor || ''; if (!cursor) break;
  }
  return null;
}
function label(p: Post): string { const t = String(p.title || '').trim() || String(p.caption || '').replace(/\s+/g, ' ').trim(); return t.length > 70 ? t.slice(0, 67) + '\u2026' : (t || 'Post #' + p.id); }
async function announce(p: Post, lines: string[]): Promise<void> {
  try {
    if (!lines.length) return;
    const cfg = await settings(); if (!cfg.slack_confirm) return;
    const tok = await secretOrNull('SLACK_BOT_TOKEN'); if (!tok) return;
    const ch = await slackChannel(tok, String(cfg.slack_channel || 'social-media').replace(/^#/, '')); if (!ch) return;
    const text = ':white_check_mark: *' + label(p) + '*\n' + lines.join('\n') + '\n<' + SITE + '/#contentcal/' + p.id + '|Open in the Content Studio>';
    await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ channel: ch, text, unfurl_links: false, unfurl_media: false }) });
  } catch (_) { /* a confirmation must never break publishing */ }
}
/* a person's Slack id: the Hub's map first (wa_slack_ids, as notify does), then Slack's own lookup */
async function slackIdOf(email: string, tok: string): Promise<string | null> {
  const e = String(email || '').toLowerCase(); if (!e) return null;
  try { const { data } = await svc.from('wa_slack_ids').select('slack_id').eq('email', e).maybeSingle(); if (data?.slack_id) return String(data.slack_id); } catch (_) { /* below */ }
  try {
    const r = await fetch('https://slack.com/api/users.lookupByEmail?email=' + encodeURIComponent(e), { headers: { Authorization: 'Bearer ' + tok } });
    const b = await r.json(); if (b.ok && b.user?.id) return String(b.user.id);
  } catch (_) { /* none */ }
  return null;
}
async function slackDm(email: string, text: string): Promise<string> {
  try {
    const tok = await secretOrNull('SLACK_BOT_TOKEN'); if (!tok) return 'no Slack token';
    const id = await slackIdOf(email, tok); if (!id) return 'no Slack account';
    const op = await (await fetch('https://slack.com/api/conversations.open', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ users: id }) })).json();
    if (!op.ok) return 'open failed: ' + op.error;
    const ps = await (await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ channel: op.channel.id, text, unfurl_links: false, unfurl_media: false }) })).json();
    return ps.ok ? 'sent' : 'post failed: ' + ps.error;
  } catch (e) { return 'error: ' + String(e).slice(0, 80); }
}
/* the person's own choice of Hub and Slack (wa_notify_prefs, wave219): Hub only means no Slack DM when a device is on */
async function channelOf(email: string): Promise<string> {
  try {
    const { data } = await svc.from('wa_notify_prefs').select('prefs, disabled').eq('email', email.toLowerCase()).maybeSingle();
    const off = (Array.isArray(data?.disabled) ? data?.disabled : []) as string[];
    /* v5 (wave242): the notification centre's switches for this kind win; 'hub-only' means no Slack DM whatever the devices */
    const k = ((((data?.prefs as Any) || {}).kinds || {}) as Any).content_studio;
    if (k && (typeof k.slack === 'boolean' || typeof k.hub === 'boolean')) { const sl = k.slack !== false, hb = k.hub !== false; return !sl && !hb ? 'off' : sl && hb ? 'both' : hb ? 'hub-only' : 'slack'; }
    if (off.indexOf('content_studio') >= 0) return 'off';
    return String((data?.prefs as Any)?.channel || 'both');
  } catch (_) { return 'both'; }
}
async function hasDevice(email: string): Promise<boolean> { try { const { count } = await svc.from('hub_push_subs').select('id', { count: 'exact', head: true }).eq('email', email.toLowerCase()); return (count || 0) > 0; } catch (_) { return false; } }
async function hubPush(emails: string[], title: string, body: string, url: string, tag: string): Promise<void> {
  try {
    const sec = await getSecret('WA_TRIGGER_SECRET');
    await fetch(SUPABASE_URL + '/functions/v1/hub-push', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-wa-secret': sec, Authorization: 'Bearer ' + ANON_KEY }, body: JSON.stringify({ action: 'studio', to: emails, title, body, url, tag }) });
  } catch (_) { /* best effort */ }
}
async function tell(emails: string[], title: string, body: string, url: string, tag: string, slackText: string): Promise<string[]> {
  const out: string[] = [];
  const uniq = Array.from(new Set(emails.map(e => String(e || '').toLowerCase()).filter(e => /@/.test(e))));
  const hubTo: string[] = [];
  for (const e of uniq) {
    const ch = await channelOf(e);
    if (ch === 'off') { out.push(e + ': switched off'); continue; }
    if (ch !== 'slack') hubTo.push(e);
    const hubOnly = ch === 'hub-only' || (ch === 'hub' && await hasDevice(e));
    out.push(e + ': ' + (hubOnly ? 'Hub only' : await slackDm(e, slackText)));
  }
  if (hubTo.length) await hubPush(hubTo, title, body, url, tag);
  return out;
}
async function emailOfName(name: string | null): Promise<string | null> {
  const n = String(name || '').trim(); if (!n) return null;
  if (/@/.test(n)) return n.toLowerCase();
  const { data } = await svc.from('team_members').select('name, email').eq('active', true);
  const rows = (data || []) as Array<{ name: string; email: string }>;
  const low = n.toLowerCase();
  const hit = rows.find(r => String(r.name || '').toLowerCase() === low) || rows.find(r => String(r.name || '').toLowerCase().split(' ')[0] === low.split(' ')[0]);
  return hit && hit.email ? hit.email.toLowerCase() : null;
}
/* v4 (wave241): the people pinged when a post waits; empty means every publisher */
async function approvers(): Promise<string[]> {
  try {
    const { data } = await svc.from('hub_settings').select('value').eq('key', 'content_studio').maybeSingle();
    const listed = ((((data || {}) as Any).value || {}).approvers || []) as Any[];
    const out = listed.map(x => String(x || '').trim().toLowerCase()).filter(x => /@/.test(x));
    if (out.length) return out;
  } catch (_) { /* the publishers */ }
  return publishers();
}
async function publishers(): Promise<string[]> {
  const { data: roles } = await svc.from('hub_roles').select('email, role, profile');
  const { data: team } = await svc.from('team_members').select('email, department, active');
  const mkt = new Set(((team || []) as Any[]).filter(t => t.active && t.department === 'marketing').map(t => String(t.email || '').toLowerCase()));
  const base = ((roles || []) as Any[]).filter(r => r.role === 'admin' || (r.role === 'leader' && (r.profile === 'marketing' || mkt.has(String(r.email).toLowerCase())))).map(r => String(r.email).toLowerCase()).filter(e => /@welfareavenue\.com$/.test(e));
  /* v6: plus the approvers the database counts (wa241_approvers), so an approver is a publisher here too */
  let more: string[] = [];
  try { const { data } = await svc.rpc('wa241_approvers'); more = ((data || []) as Any[]).map(e => String(e || '').trim().toLowerCase()).filter(e => /@/.test(e)); } catch (_) { /* today's set */ }
  return Array.from(new Set([...base, ...more]));
}

let TGT: Targets | null = null;
async function targets(): Promise<Targets> {
  if (TGT) return TGT;
  const token = await getSecret('META_SYSTEM_TOKEN');
  const { data: accs } = await svc.from('social_accounts').select('*').in('platform', ['facebook', 'instagram']).in('status', ['connected', 'error']);
  const fb = ((accs || []) as Any[]).filter(a => a.platform === 'facebook')[0] || null;
  const ig = ((accs || []) as Any[]).filter(a => a.platform === 'instagram')[0] || null;
  let page: Targets['page'] = null;
  if (fb) {
    let pt = token;
    try { const r = await graph(ctx, 'GET', '/' + fb.external_id, token, { fields: 'access_token,name' }); pt = r.access_token || token; } catch (_) { /* a page token already */ }
    page = { id: String(fb.external_id), name: fb.name || 'Page', token: pt };
  }
  TGT = { token, page, ig: ig ? { id: String(ig.external_id), username: ig.handle || '' } : null };
  return TGT;
}

/* ---------- the words each platform gets ---------- */
function capHashtags(s: string, max: number): string {
  let n = 0;
  return s.replace(/(^|\s)#[\p{L}\p{N}_]+/gu, (m) => { n++; return n > max ? '' : m; }).replace(/[ \t]+\n/g, '\n').trim();
}
function rid(n = 6): string { const a = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; const b = crypto.getRandomValues(new Uint8Array(n)); for (let i = 0; i < n; i++) s += a[b[i] % a.length]; return s; }
function slug(s: string): string { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); }
function withUtm(url: string, p: Post, platform: string): string {
  try {
    const u = new URL(url);
    if (!/(^|\.)welfareavenue\.com$/.test(u.hostname) && !/hub\.welfareavenue\.com$/.test(u.hostname)) return url;   /* UTM only on our own sites */
    const o = (p.utm || {}) as Record<string, string>;
    if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', o.source || platform);
    if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', o.medium || 'social');
    const camp = o.campaign || slug(p.campaign || '') || '';
    if (camp && !u.searchParams.has('utm_campaign')) u.searchParams.set('utm_campaign', camp);
    if (!u.searchParams.has('utm_content')) u.searchParams.set('utm_content', 'post-' + p.id);
    return u.toString();
  } catch (_) { return url; }
}
const LINKMAP: Record<string, string> = {};
async function shortLink(url: string, p: Post, platform: string): Promise<string> {
  if (/^https:\/\/hub\.welfareavenue\.com\/l\//.test(url)) return url;
  const key = p.id + '|' + platform + '|' + url;
  if (LINKMAP[key]) return LINKMAP[key];
  try {
    const { data: ex } = await svc.from('short_links').select('code').eq('post_id', p.id).eq('platform', platform).eq('label', url.slice(0, 300)).maybeSingle();
    let code = ex?.code as string | undefined;
    if (!code) {
      code = (slug(p.campaign || '') ? slug(p.campaign || '').slice(0, 12) + '-' : '') + rid(5);
      const ins = await svc.from('short_links').insert({ code, url: withUtm(url, p, platform), label: url.slice(0, 300), post_id: p.id, platform, campaign: p.campaign || null, created_by: 'social-publish' }).select('code').single();
      if (ins.error) throw ins.error;
    }
    LINKMAP[key] = SITE + '/l/' + code;
    return LINKMAP[key];
  } catch (_) { return withUtm(url, p, platform); }
}
async function trackLinks(text: string, p: Post, platform: string): Promise<string> {
  if (!p.track_links || platform === 'instagram' || platform === 'tiktok') return text;
  const urls = Array.from(new Set(text.match(/https?:\/\/[^\s<>"')]+/g) || []));
  let out = text;
  for (const u of urls) { const s = await shortLink(u.replace(/[.,;:!?]+$/, ''), p, platform); out = out.split(u.replace(/[.,;:!?]+$/, '')).join(s); }
  return out;
}
async function capFor(p: Post, platform: string): Promise<string> {
  let c = rawCaption(p, platform);
  if (platform === 'facebook' && p.link_url && images(p).length && c.indexOf(p.link_url) < 0) c += (c ? '\n\n' : '') + p.link_url;
  if ((platform === 'linkedin' || platform === 'threads') && p.link_url && c.indexOf(p.link_url) < 0) c += (c ? '\n\n' : '') + p.link_url;
  if (platform === 'instagram') { const cap = Number((await studio()).hashtag_cap || 5); c = capHashtags(c, cap); }
  if (platform === 'threads' && c.length > 500) c = c.slice(0, 497) + '\u2026';
  return await trackLinks(c, p, platform);
}
/* v6: what the adapters get (they never touch the vault, the database or the network except through this) */
async function vaultSet(name: string, value: string, note: string): Promise<void> { await svc.rpc('wa_vault_set', { p_name: name, p_value: value, p_note: note }); }
const ctx: PubCtx = {
  fetch: (i, init) => fetch(i, init), getSecret, secretOrNull, vaultSet, connections, capFor, trackLinks, shortLink, images, videos,
  sleep: (ms) => new Promise(res => setTimeout(res, ms)), targets: null,
};

/* ---------- saving ---------- */
async function save(id: number, patch: Record<string, Any>): Promise<void> { patch.updated_at = new Date().toISOString(); await svc.from('content_posts').update(patch).eq('id', id); }
function directOk(r: Any): boolean { return !!(r && (r.id || r.manual_done)); }
/* published when every platform is up or handed to a person (the reminder); failed otherwise, so Try again sends only what is missing */
function settle(p: Post, results: Record<string, Any>): { status: string; pending: boolean } {
  const pending = (p.platforms || []).some(pl => results[pl] && results[pl].pending);
  if (pending) return { status: 'publishing', pending: true };
  const doneAll = (p.platforms || []).length > 0 && (p.platforms || []).every(pl => results[pl] && (results[pl].id || results[pl].manual));
  return { status: doneAll ? 'published' : 'failed', pending: false };
}
function anyLive(results: Record<string, Any>): boolean { return Object.keys(results).some(k => results[k] && results[k].id); }

/* the reminder for a platform the Hub cannot post to: the owner (else the person who made it) gets a Hub notification and a Slack DM */
async function remindManual(p: Post, platform: string, why: string, dry = false): Promise<Any> {
  const to = (await emailOfName(p.owner)) || (await emailOfName(p.created_by)) || (await emailOfName(p.submitted_by));
  const cap = rawCaption(p, platform);
  const media = (p.media || []).map(m => m.url).filter(Boolean);
  const when = p.scheduled_at ? new Date(p.scheduled_at).toLocaleString('en-CA', { timeZone: 'America/Toronto', weekday: 'short', hour: 'numeric', minute: '2-digit' }) : 'now';
  const link = SITE + '/#contentcal/' + p.id;
  const slack = ':calendar: *Time to post on ' + (PNAME[platform] || platform) + ':* ' + label(p) + ' (' + when + ')\n' + why + '. Copy the caption and the media from the Hub, post it in the ' + (PNAME[platform] || platform) + ' app, then press Mark posted.\n' +
    (cap ? '>' + cap.slice(0, 600).replace(/\n/g, '\n>') + (cap.length > 600 ? '\u2026' : '') + '\n' : '') + (media.length ? media.slice(0, 4).map((u, i) => '<' + u + '|Media ' + (i + 1) + '>').join('  ') + '\n' : '') + '<' + link + '|Open it in the Content Studio>';
  if (dry) return { to, slack };
  if (!to) return { to: null, outcome: 'nobody to remind (no owner)' };
  const out = await tell([to], 'Time to post on ' + (PNAME[platform] || platform), label(p) + ': copy the caption and media, post it, then Mark posted.', '/#contentcal/' + p.id, 'studio-due-' + p.id + '-' + platform, slack);
  return { to, outcome: out.join('; ') };
}

async function publishPost(id: number, by: string, caller: Me | null): Promise<Any> {
  if (caller && !caller.auto && !caller.publisher) {
    const { data: chk } = await svc.from('content_posts').select('approval_status').eq('id', id).maybeSingle();
    if (!chk) throw new Error('post ' + id + ' not found');
    if (chk.approval_status !== 'approved') return { id, status: 'needs approval', errors: ['A marketing lead or an admin approves this post before it goes out. Send it for approval.'] };
  }
  const claim = await svc.from('content_posts').update({ status: 'publishing', error: null, updated_at: new Date().toISOString(), updated_by: by }).eq('id', id).in('status', ['draft', 'scheduled', 'failed']).select('*');
  if (claim.error) throw new Error(claim.error.message);
  const p = ((claim.data || []) as Post[])[0];
  if (!p) {
    const { data: cur } = await svc.from('content_posts').select('id,status,results').eq('id', id).maybeSingle();
    if (!cur) throw new Error('post ' + id + ' not found');
    return { id, status: cur.status, results: cur.results, note: cur.status === 'publishing' ? 'already publishing' : 'already ' + cur.status };
  }
  let t: Targets | null = null; let metaErr = '';
  if ((p.platforms || []).some(x => x === 'facebook' || x === 'instagram')) { try { t = await targets(); } catch (e) { metaErr = String((e as Error).message || e); } }
  const results: Record<string, Any> = { ...(p.results || {}) };
  const manual: Record<string, Any> = { ...(p.manual || {}) };
  const errors: string[] = []; const lines: string[] = []; const reminded: string[] = [];
  for (const platform of (p.platforms || [])) {
    if (results[platform] && (results[platform].id || results[platform].manual)) continue;
    const ad = ADAPTERS[platform];
    if (!ad) { errors.push(platform + ': not supported'); continue; }
    try {
      if ((platform === 'facebook' || platform === 'instagram') && !t) throw new Error(metaErr.indexOf('META_SYSTEM_TOKEN') >= 0 ? 'Publishing to Meta is off: the Meta token is not in the vault' : (metaErr || 'Meta is not connected'));
      const r: Any = await ad.publish(p, (REGBY[platform] && REGBY[platform].caps) || FALLBACK_CAPS, { ...ctx, targets: t });
      results[platform] = { ...r, at: new Date().toISOString() };
      lines.push('\u2022 ' + (r.draft ? 'Sent to the ' + PNAME[platform] + ' drafts (post it in the app)' : 'Published to ' + (PNAME[platform] || platform)) + ': <' + r.url + '|open>');
    } catch (e) {
      if (e instanceof Pending) { results[platform] = { pending: true, container: e.container, since: new Date().toISOString() }; }
      else if (e instanceof Manual) {
        results[platform] = { manual: true, why: e.message, at: new Date().toISOString() };
        const rm = await remindManual(p, platform, e.message);
        manual[platform] = { ...(manual[platform] || {}), reminded_at: new Date().toISOString(), reminded: rm.to || null };
        reminded.push(PNAME[platform] || platform);
      }
      else errors.push((PNAME[platform] || platform) + ': ' + String((e as Error).message || e).slice(0, 300));
    }
    await save(id, { results, manual });
  }
  const st = settle(p, results);
  const patch: Record<string, Any> = { status: st.status, results, manual, error: errors.length ? errors.join(' | ') : null, updated_by: by };
  if (anyLive(results) && !p.published_at) patch.published_at = new Date().toISOString();
  await save(id, patch);
  try { await svc.from('change_log').insert({ entity_type: 'content_post', entity_id: String(id), field: 'status', old_value: p.status, new_value: st.status + (errors.length ? ' (' + errors.length + ' problem' + (errors.length > 1 ? 's' : '') + ')' : '') + (reminded.length ? ' (reminder: ' + reminded.join(', ') + ')' : '') + (st.pending ? ' (video processing)' : ''), changed_by: by }); } catch (_) { /* audit */ }
  await announce({ ...p, results }, lines);
  if (st.status === 'published') await repeatNext(p);
  return { id, status: st.status, results, errors, pending: st.pending, reminded };
}

/* repeating posts: the next one, from the first */
async function repeatNext(p: Post): Promise<void> {
  try {
    const r = p.repeat_rule; if (!r || !r.every || !p.scheduled_at) return;
    const left = r.times == null ? null : Number(r.times) - 1;
    if (left !== null && left < 1) return;
    const d = new Date(p.scheduled_at);
    if (r.every === 'week') d.setDate(d.getDate() + 7); else if (r.every === '2weeks') d.setDate(d.getDate() + 14); else if (r.every === 'month') d.setMonth(d.getMonth() + 1); else return;
    if (r.until && d.toISOString().slice(0, 10) > String(r.until)) return;
    const root = p.repeat_of || p.id;
    const { data: ex } = await svc.from('content_posts').select('id').eq('repeat_of', root).eq('scheduled_at', d.toISOString()).maybeSingle();
    if (ex) return;
    await svc.from('content_posts').insert({
      title: p.title, platforms: p.platforms, format: p.format, caption: p.caption, link_url: p.link_url, media: p.media, scheduled_at: d.toISOString(), status: 'scheduled',
      owner: p.owner, campaign: p.campaign, notes: null, created_by: 'repeat', updated_by: 'repeat', variants: p.variants, first_comment: p.first_comment, tags: p.tags,
      approval_status: 'approved', approved_by: p.approved_by, approved_at: new Date().toISOString(), repeat_rule: { ...r, times: left }, repeat_of: root, track_links: p.track_links, utm: p.utm
    });
  } catch (_) { /* the next one can be made by hand */ }
}

/* videos still processing (Instagram reels, Threads videos) and posts stuck mid-publish */
async function finishPending(): Promise<Any[]> {
  const out: Any[] = [];
  const { data } = await svc.from('content_posts').select('*').eq('status', 'publishing').limit(20);
  const rows = (data || []) as Post[]; if (!rows.length) return out;
  let t: Targets | null = null; try { t = await targets(); } catch (_) { t = null; }
  const th = await threadsTarget(ctx);
  for (const p of rows) {
    const results: Record<string, Any> = { ...(p.results || {}) };
    const pend = Object.keys(results).filter(k => results[k] && results[k].pending);
    if (!pend.length) {
      if (Date.now() - new Date(p.updated_at).getTime() > 10 * 60000) { const st = settle(p, results); await save(p.id, { status: st.status === 'publishing' ? 'failed' : st.status, error: st.status === 'published' ? null : 'Publishing did not finish. Check the platforms before trying again.' }); out.push({ id: p.id, reset: true }); }
      continue;
    }
    const lines: string[] = []; const errors: string[] = [];
    for (const pl of pend) {
      const r = results[pl];
      try {
        if (pl === 'instagram' && t && t.ig) {
          const tok = t.page ? t.page.token : t.token;
          const s = await containerStatus(ctx, String(r.container), tok);
          if (s === 'FINISHED') { const fin = await igFinish(ctx, t.ig.id, String(r.container), tok, t.ig.username, p); results[pl] = { ...fin, at: new Date().toISOString() }; lines.push('\u2022 Published to Instagram: <' + fin.url + '|open>'); }
          else if (Date.now() - new Date(r.since || p.updated_at).getTime() > 30 * 60000) { results[pl] = { failed: true }; errors.push('Instagram: the video was still processing after 30 minutes'); }
        } else if (pl === 'threads' && th) {
          const s = await containerStatus(ctx, String(r.container), th.token, THREADS);
          if (s === 'FINISHED') { const fin = await threadsFinish(ctx, th, String(r.container), p); results[pl] = { ...fin, at: new Date().toISOString() }; lines.push('\u2022 Published to Threads: <' + fin.url + '|open>'); }
          else if (Date.now() - new Date(r.since || p.updated_at).getTime() > 30 * 60000) { results[pl] = { failed: true }; errors.push('Threads: the video was still processing after 30 minutes'); }
        } else if (pl === 'linkedin') {
          const fin = await linkedinFinish(ctx, p, String(r.container));
          if (fin) { results[pl] = { ...fin, at: new Date().toISOString() }; lines.push('\u2022 Published to LinkedIn: <' + fin.url + '|open>'); }
          else if (Date.now() - new Date(r.since || p.updated_at).getTime() > 30 * 60000) { results[pl] = { failed: true }; errors.push('LinkedIn did not finish processing the video'); }
        } else { results[pl] = { failed: true }; errors.push((PNAME[pl] || pl) + ': cannot finish without its connection'); }
      } catch (e) { results[pl] = { failed: true }; errors.push((PNAME[pl] || pl) + ': ' + String((e as Error).message || e).slice(0, 300)); }
    }
    const st = settle(p, results);
    const patch: Record<string, Any> = { status: st.status, results };
    if (errors.length) patch.error = errors.join(' | ');
    if (anyLive(results) && !p.published_at) patch.published_at = new Date().toISOString();
    await save(p.id, patch);
    await announce({ ...p, results }, lines);
    if (st.status === 'published') await repeatNext(p);
    out.push({ id: p.id, status: st.status, errors });
  }
  return out;
}

/* ---------- confirmations (unchanged from v2, all platforms the analytics hold) ---------- */
function norm(s: string): string { return String(s || '').toLowerCase().replace(/https?:\/\/\S+/g, '').replace(/[#@]/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function words(s: string): Set<string> { return new Set(norm(s).split(' ').filter(w => w.length > 3)); }
function similar(a: string, b: string): number {
  const A = words(a), B = words(b); if (A.size < 3 || !B.size) return 0;
  let inter = 0; A.forEach(w => { if (B.has(w)) inter++; });
  return inter / Math.min(A.size, B.size);
}
function liveRow(sp: Any, matched: string): Any { return { external_id: sp.external_id, url: sp.url, kind: sp.kind, published_at: sp.published_at, reach: sp.reach, views: sp.views, likes: sp.likes, comments: sp.comments, shares: sp.shares, saves: sp.saves, engagement: sp.engagement, matched, at: new Date().toISOString() }; }
function byCaption(S: Any[], platform: string, caption: string, whenMs: number): Any {
  const cands = S.filter(s => s.platform === platform && (!whenMs || Math.abs(new Date(s.published_at).getTime() - whenMs) < 48 * 3600000));
  let best: Any = null, bs = 0;
  for (const c of cands) { const sc = similar(caption, c.caption || ''); if (sc > bs) { bs = sc; best = c; } }
  return best && bs >= 0.5 ? best : null;
}
async function confirm(days: number): Promise<Any> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data: social } = await svc.from('social_posts').select('*').gte('published_at', new Date(Date.now() - (days + 2) * 86400000).toISOString());
  const S = (social || []) as Any[]; let updated = 0, autoPosted = 0; const out: Any[] = [];
  const { data: posts } = await svc.from('content_posts').select('*').in('status', ['published', 'posted', 'failed']).gte('updated_at', new Date(Date.now() - (days + 30) * 86400000).toISOString());
  for (const p of ((posts || []) as Post[])) {
    const live: Record<string, Any> = { ...(p.live || {}) }; let changed = false; const lines: string[] = [];
    for (const platform of (p.platforms || [])) {
      const rid0 = p.results && p.results[platform] && p.results[platform].id ? String(p.results[platform].id) : null;
      let hit: Any = null;
      if (rid0) hit = S.find(s => s.platform === platform && (String(s.external_id) === rid0 || String(s.external_id).split('_').pop() === rid0.split('_').pop()));
      const cap = rawCaption(p, platform);
      if (!hit && cap) { const when = new Date(p.published_at || p.scheduled_at || (p.results && p.results[platform] && p.results[platform].at) || 0).getTime(); const b = byCaption(S, platform, cap, when); if (b) hit = { ...b, _by: 'caption' }; }
      if (hit) {
        const row = liveRow(hit, hit._by || 'id');
        const old = live[platform];
        if (!old || old.external_id !== row.external_id || JSON.stringify([old.reach, old.views, old.likes, old.comments, old.shares, old.saves]) !== JSON.stringify([row.reach, row.views, row.likes, row.comments, row.shares, row.saves])) { live[platform] = { ...row, announced: old ? old.announced : false }; changed = true; }
        if (!old && !(p.results && p.results[platform] && p.results[platform].id)) { lines.push('\u2022 Live on ' + (PNAME[platform] || platform) + (row.url ? ': <' + row.url + '|open>' : '') + ' (seen in the analytics)'); live[platform].announced = true; }
      }
    }
    if (changed) { await save(p.id, { live }); updated++; out.push({ id: p.id, live: Object.keys(live) }); }
    if (lines.length) await announce(p, lines);
  }
  const cutoff = new Date(Date.now() - 15 * 60000).toISOString();
  const { data: due } = await svc.from('content_posts').select('*').in('status', ['scheduled', 'draft']).not('scheduled_at', 'is', null).lt('scheduled_at', cutoff).gte('scheduled_at', since);
  for (const p of ((due || []) as Post[])) {
    if (String(p.caption || '').trim().length < 20) continue;
    const live: Record<string, Any> = { ...(p.live || {}) }; let first: string | null = null; const lines: string[] = [];
    for (const platform of (p.platforms || [])) {
      const b = byCaption(S, platform, rawCaption(p, platform), new Date(String(p.scheduled_at)).getTime());
      if (b) { live[platform] = { ...liveRow(b, 'caption'), announced: true }; if (!first || String(b.published_at) < first) first = String(b.published_at); lines.push('\u2022 Live on ' + (PNAME[platform] || platform) + (b.url ? ': <' + b.url + '|open>' : '') + ' (posted by hand, seen in the analytics)'); }
    }
    if (first) {
      await save(p.id, { status: 'posted', live, published_at: first, error: null, updated_by: 'confirmed from the analytics' });
      try { await svc.from('change_log').insert({ entity_type: 'content_post', entity_id: String(p.id), field: 'status', old_value: p.status, new_value: 'posted (seen in the analytics)', changed_by: 'content calendar' }); } catch (_) { /* audit */ }
      await announce(p, lines);
      autoPosted++; updated++; out.push({ id: p.id, posted: Object.keys(live) });
    }
  }
  return { checked: ((posts || []).length + (due || []).length), updated, auto_posted: autoPosted, matched: out.slice(0, 50) };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const me = await who(req);
  if (!me) return json({ error: 'not allowed' }, 401);
  let body: Any = {};
  try { body = await req.json(); } catch (_) { body = {}; }
  const action = String(body.action || 'capabilities');
  await loadReg();
  try {
    if (action === 'capabilities') {
      const accounts = async () => { const { data } = await svc.from('social_accounts').select('platform,name,handle,status'); return (data || []) as Any[]; };
      return json(await capabilitiesOf({ ...ctx, accounts, settings, studio }, REG));
    }
    if (action === 'settings') {
      if (body.value && typeof body.value === 'object') {
        const cur = await settings();
        const next = { ...cur, slack_confirm: !!body.value.slack_confirm, slack_channel: String(body.value.slack_channel || cur.slack_channel || 'social-media').replace(/^#/, '').slice(0, 80) };
        const { error } = await svc.from('hub_settings').upsert({ key: 'content_calendar', value: next, updated_at: new Date().toISOString(), updated_by: me.name });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, settings: next });
      }
      return json({ ok: true, settings: await settings() });
    }
    if (action === 'preview') {
      const { data: p } = await svc.from('content_posts').select('*').eq('id', Number(body.post_id)).maybeSingle();
      if (!p) return json({ error: 'not found' }, 404);
      const post = { ...(p as Post), track_links: false } as Post;
      const out: Any = { ok: true };
      for (const k of (post.platforms || [])) out[k] = { caption: await capFor(post, k), kind: kindOf(post, k), first_comment: firstCommentOf(post, k), images: images(post).length, videos: videos(post).length };
      return json(out);
    }
    if (action === 'publish') {
      if (!body.post_id) return json({ error: 'post_id' }, 400);
      return json({ ok: true, ...(await publishPost(Number(body.post_id), me.name, me)) });
    }
    if (action === 'mark_posted') {
      const pl = String(body.platform || ''); const id = Number(body.post_id);
      const { data: p } = await svc.from('content_posts').select('*').eq('id', id).maybeSingle();
      if (!p) return json({ error: 'not found' }, 404);
      const post = p as Post;
      const results = { ...(post.results || {}) }; const manual = { ...(post.manual || {}) };
      results[pl] = { ...(results[pl] || {}), manual: true, manual_done: true, url: body.url ? String(body.url).slice(0, 500) : (results[pl] || {}).url || null, at: new Date().toISOString() };
      manual[pl] = { ...(manual[pl] || {}), posted_at: new Date().toISOString(), posted_by: me.name, url: body.url || null };
      const allDone = (post.platforms || []).every(k => results[k] && (results[k].id || results[k].manual_done));
      const patch: Any = { results, manual, updated_by: me.name };
      if (allDone) { patch.status = post.status === 'published' ? 'published' : 'posted'; if (!post.published_at) patch.published_at = new Date().toISOString(); }
      await save(id, patch);
      try { await svc.from('change_log').insert({ entity_type: 'content_post', entity_id: String(id), field: 'manual', old_value: null, new_value: 'posted by hand on ' + (PNAME[pl] || pl), changed_by: me.name }); } catch (_) { /* audit */ }
      return json({ ok: true, results, manual, status: patch.status || post.status });
    }
    if (action === 'remind_test') {
      const { data: p } = await svc.from('content_posts').select('*').eq('id', Number(body.post_id)).maybeSingle();
      if (!p) return json({ error: 'not found' }, 404);
      return json({ ok: true, plan: await remindManual(p as Post, String(body.platform || 'linkedin'), 'A test: nothing was sent', true) });
    }
    if (action === 'approval_notify') {
      if (!me.auto) return json({ error: 'automation only' }, 401);
      const { data: p } = await svc.from('content_posts').select('*').eq('id', Number(body.post_id)).maybeSingle();
      if (!p) return json({ error: 'not found' }, 404);
      const post = p as Post; const state = String(body.state || post.approval_status);
      const when = post.scheduled_at ? new Date(post.scheduled_at).toLocaleString('en-CA', { timeZone: 'America/Toronto', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'no date yet';
      const plats = (post.platforms || []).map(k => PNAME[k] || k).join(', ');
      const link = SITE + '/#studio/approvals';
      if (state === 'pending') {
        const who0 = await svc.from('team_members').select('name').eq('email', post.submitted_by || '').maybeSingle();
        const from = (who0.data && who0.data.name) || String(post.submitted_by || 'Someone').split('@')[0];
        const to = (await approvers()).filter(e => e !== String(post.submitted_by || '').toLowerCase());
        const extra = (post as Any).canva_url ? '\n<' + String((post as Any).canva_url) + '|Open the design in Canva>' : '';
        const kind = (post as Any).format === 'article' ? 'a LinkedIn article' : 'a post';
        const out = await tell(to, kind === 'a post' ? 'A post waits for your approval' : 'A LinkedIn article waits for your approval', from + ': ' + label(post) + ' (' + plats + ', ' + when + ')', '/#studio/approvals?post=' + post.id, 'studio-approval-' + post.id,
          ':raised_hand: *' + from + '* sent ' + kind + ' for approval: *' + label(post) + '* (' + plats + ', ' + when + ')' + (post.approval_note ? '\n>' + String(post.approval_note).slice(0, 300) : '') + extra
          + '\n<' + SITE + '/#studio/approvals?post=' + post.id + '&do=approve|Approve>   \u00b7   <' + SITE + '/#studio/approvals?post=' + post.id + '&do=back|Send it back>   \u00b7   <' + link + '|Open the Studio>');
        return json({ ok: true, told: out });
      }
      const to = String(post.submitted_by || '').toLowerCase();
      if (!to) return json({ ok: true, told: [] });
      const by = await svc.from('team_members').select('name').eq('email', post.approved_by || '').maybeSingle();
      const byName = (by.data && by.data.name) || String(post.approved_by || '').split('@')[0];
      const ok = state === 'approved';
      const out = await tell([to], ok ? 'Your post is approved' : 'Changes asked on your post', label(post) + (ok ? (post.scheduled_at ? ': it goes out ' + when : ': give it a date to schedule it') : ': ' + (post.approval_note || 'see the note')), '/#contentcal/' + post.id, 'studio-decided-' + post.id,
        (ok ? ':white_check_mark: *' + byName + '* approved *' + label(post) + '*' + (post.scheduled_at ? ', it goes out ' + when : '') : ':pencil2: *' + byName + '* asked for changes on *' + label(post) + '*' + (post.approval_note ? ':\n>' + String(post.approval_note).slice(0, 300) : '')) + '\n<' + SITE + '/#contentcal/' + post.id + '|Open it>');
      return json({ ok: true, told: out });
    }
    if (action === 'run') {
      if (!me.auto) return json({ error: 'automation only' }, 401);
      const now = new Date().toISOString();
      const pending = await finishPending();
      const results: Any[] = [];
      const { data: due } = await svc.from('content_posts').select('id, approval_status').eq('status', 'scheduled').lte('scheduled_at', now).gte('scheduled_at', new Date(Date.now() - 6 * 3600000).toISOString()).order('scheduled_at').limit(5);
      for (const d of ((due || []) as Any[])) {
        if (d.approval_status === 'pending' || d.approval_status === 'changes') { results.push({ id: d.id, skipped: 'waiting for approval' }); continue; }
        try { results.push(await publishPost(Number(d.id), 'scheduler', null)); } catch (e) { results.push({ id: d.id, error: String((e as Error).message || e) }); }
      }
      let confirmed: Any = null;
      try { confirmed = await confirm(14); } catch (_) { /* next run */ }
      return json({ ok: true, published: results, pending, confirmed });
    }
    if (action === 'confirm') return json({ ok: true, ...(await confirm(Math.max(1, Math.min(120, Number(body.days) || 60)))) });
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 400) }, 500);
  }
});
