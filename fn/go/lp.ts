// Welfare Avenue: the link pages' shared helpers (wave230), used by linkpage and go (each deploys its own copy as lp.ts).
// No cookie and no address is kept: the network is reduced to two keyed hashes (WA_FORM_SECRET):
//   ipm     hmac('ip|' + ip), the same hash the CRM forms and the donation page keep, to credit a sign-up or a gift;
//   visitor hmac('lpv|' + month + '|' + ip + '|' + browser), a different value every month (unique and repeat visitors).
import { createClient } from 'jsr:@supabase/supabase-js@2';

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
export const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
export const svc = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
export const HUB = 'https://hub.welfareavenue.com';
// deno-lint-ignore no-explicit-any
export type Any = any;

const SECRETS: Record<string, string> = {};
export async function secret(name: string): Promise<string> {
  if (SECRETS[name]) return SECRETS[name];
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  SECRETS[name] = String(data);
  return SECRETS[name];
}
export async function hmac(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)));
  return Array.from(sig).map(b => b.toString(16).padStart(2, '0')).join('');
}
/* the visitor's address: Netlify's header first (the page and /l/ come through Netlify's proxy), then the usual ones */
export function clientIp(req: Request): string {
  return (req.headers.get('x-nf-client-connection-ip') || req.headers.get('cf-connecting-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0] || req.headers.get('x-real-ip') || '').trim();
}

export function isBot(ua: string): boolean {
  return !ua || /bot|crawl|spider|slurp|preview|facebookexternalhit|meta-externalagent|slackbot|whatsapp|linkedinbot|twitterbot|bingpreview|discordbot|telegrambot|headless|lighthouse|pingdom|uptime/i.test(ua);
}
export type UA = { device: string; os: string; browser: string; app: string };
export function parseUA(ua: string): UA {
  const u = ua || '';
  const device = /ipad|tablet|(android(?!.*mobile))/i.test(u) ? 'tablet' : /mobi|iphone|ipod|android/i.test(u) ? 'phone' : 'computer';
  const os = /iphone|ipad|ipod/i.test(u) ? 'iOS' : /android/i.test(u) ? 'Android' : /cros/i.test(u) ? 'ChromeOS' : /mac os x|macintosh/i.test(u) ? 'macOS' : /windows/i.test(u) ? 'Windows' : /linux/i.test(u) ? 'Linux' : 'Other';
  let app = '';
  if (/instagram/i.test(u)) app = 'instagram';
  else if (/barcelona|threads/i.test(u)) app = 'threads';
  else if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(u)) app = 'facebook';
  else if (/musical_ly|tiktok|BytedanceWebview|trill/i.test(u)) app = 'tiktok';
  else if (/linkedinapp/i.test(u)) app = 'linkedin';
  else if (/snapchat/i.test(u)) app = 'snapchat';
  else if (/twitter/i.test(u)) app = 'x';
  const browser = app ? ({ instagram: 'Instagram app', threads: 'Threads app', facebook: 'Facebook app', tiktok: 'TikTok app', linkedin: 'LinkedIn app', snapchat: 'Snapchat', x: 'X app' } as Record<string, string>)[app]
    : /edg\//i.test(u) ? 'Edge' : /samsungbrowser/i.test(u) ? 'Samsung Internet' : /firefox|fxios/i.test(u) ? 'Firefox' : /opr\/|opera/i.test(u) ? 'Opera'
    : /crios|chrome/i.test(u) ? 'Chrome' : /safari/i.test(u) ? 'Safari' : 'Other';
  return { device, os, browser, app };
}
/* where the visit came from: ?s=, else the app it opened in, else the referring site */
const REF: Array<[RegExp, string]> = [[/(^|\.)instagram\.com$/, 'ig'], [/(^|\.)(facebook\.com|fb\.me|fb\.com|messenger\.com)$/, 'fb'], [/(^|\.)tiktok\.com$/, 'tt'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'li'], [/(^|\.)threads\.(net|com)$/, 'th'], [/(^|\.)(youtube\.com|youtu\.be)$/, 'yt'], [/(^|\.)(t\.co|x\.com|twitter\.com)$/, 'x'],
  [/(^|\.)welfareavenue\.com$/, 'website'], [/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com)$/, 'search'], [/(mail\.google\.com|outlook\.|mail\.yahoo)/, 'email']];
const APPSRC: Record<string, string> = { instagram: 'ig', facebook: 'fb', tiktok: 'tt', linkedin: 'li', threads: 'th', snapchat: 'snap', x: 'x' };
export function sourceOf(s: string, refHost: string, ua: UA): { src: string; detail: string | null } {
  const given = String(s || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
  if (given.length >= 2) return { src: given, detail: refHost || (ua.app ? ua.app + ' app' : null) };
  if (ua.app && APPSRC[ua.app]) return { src: APPSRC[ua.app], detail: 'opened in the ' + ua.app + ' app' };
  if (refHost) { for (const [re, code] of REF) if (re.test(refHost)) return { src: code, detail: refHost }; return { src: 'web', detail: refHost }; }
  return { src: 'direct', detail: null };
}
export function hostOf(u: string | null): string {
  try { return u ? new URL(u).hostname.toLowerCase().replace(/^www\./, '').slice(0, 120) : ''; } catch (_) { return ''; }
}
/* the city and country Netlify's proxy reports (x-nf-geo), else the country headers, else the browser's time zone */
export function geoOf(req: Request, tz: string): { country: string | null; region: string | null; city: string | null } {
  let country: string | null = null, region: string | null = null, city: string | null = null;
  try {
    const g = req.headers.get('x-nf-geo');
    if (g) {
      const j = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(g), c => c.charCodeAt(0))));
      city = j.city ? String(j.city).slice(0, 60) : null;
      country = j.country && j.country.code ? String(j.country.code).slice(0, 2).toUpperCase() : null;
      region = j.subdivision && (j.subdivision.name || j.subdivision.code) ? String(j.subdivision.name || j.subdivision.code).slice(0, 60) : null;
    }
  } catch (_) { /* below */ }
  if (!country) { const c = (req.headers.get('x-country') || req.headers.get('x-nf-country') || req.headers.get('cf-ipcountry') || '').slice(0, 2).toUpperCase(); country = /^[A-Z]{2}$/.test(c) && c !== 'XX' ? c : null; }
  if (!region && tz) {
    const T: Record<string, [string, string]> = { 'America/Toronto': ['CA', 'Eastern Canada'], 'America/Montreal': ['CA', 'Quebec'], 'America/Vancouver': ['CA', 'British Columbia'], 'America/Edmonton': ['CA', 'Alberta'],
      'America/Winnipeg': ['CA', 'Manitoba'], 'America/Halifax': ['CA', 'Atlantic Canada'], 'America/Moncton': ['CA', 'New Brunswick'], 'America/St_Johns': ['CA', 'Newfoundland'], 'America/Regina': ['CA', 'Saskatchewan'],
      'America/New_York': ['US', 'US Eastern'], 'America/Chicago': ['US', 'US Central'], 'America/Denver': ['US', 'US Mountain'], 'America/Los_Angeles': ['US', 'US Pacific'], 'Europe/Paris': ['FR', 'France'], 'Europe/London': ['GB', 'United Kingdom'] };
    const hit = T[tz]; if (hit) { region = hit[1]; if (!country) country = hit[0]; }
  }
  return { country, region, city };
}
export async function hashes(req: Request, ua: UA): Promise<{ ipm: string | null; visitor: string | null }> {
  const ip = clientIp(req); if (!ip) return { ipm: null, visitor: null };
  const k = await secret('WA_FORM_SECRET');
  const month = new Date().toISOString().slice(0, 7);
  return { ipm: (await hmac(k, 'ip|' + ip)).slice(0, 24), visitor: (await hmac(k, 'lpv|' + month + '|' + ip + '|' + ua.os + '|' + ua.browser)).slice(0, 16) };
}
/* the visit token the page carries into its links: page, source, visitor, A/B variants, language, time zone (signed) */
export type Visit = { p: number; s: string; sd?: string | null; v: string | null; ab?: Record<string, string>; l?: string; tz?: string; rv?: boolean };
function b64u(s: string): string { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64u(s: string): string { let t = s.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; return decodeURIComponent(escape(atob(t))); }
export async function signVisit(v: Visit): Promise<string> {
  const body = b64u(JSON.stringify(v));
  return body + '.' + (await hmac(await secret('WA_FORM_SECRET'), 'lpt|' + body)).slice(0, 20);
}
export async function readVisit(t: string): Promise<Visit | null> {
  try {
    const [body, sig] = String(t || '').split('.');
    if (!body || !sig || body.length > 1500) return null;
    if ((await hmac(await secret('WA_FORM_SECRET'), 'lpt|' + body)).slice(0, 20) !== sig) return null;
    return JSON.parse(unb64u(body)) as Visit;
  } catch (_) { return null; }
}
/* the places a link page may send people without a short link of their own (no open redirect) */
export function allowedTarget(to: string): string | null {
  const t = String(to || '').trim();
  if (/^\/(?!\/)[A-Za-z0-9_\-/.?=&%#~+]*$/.test(t)) return HUB + t;
  try {
    const u = new URL(t);
    if (u.protocol !== 'https:') return null;
    if (/(^|\.)(welfareavenue\.com|instagram\.com|facebook\.com|tiktok\.com|linkedin\.com|threads\.net|threads\.com|youtube\.com|youtu\.be|x\.com|twitter\.com)$/i.test(u.hostname)) return u.toString();
  } catch (_) { /* no */ }
  return null;
}
export async function record(req: Request, row: Record<string, Any>): Promise<void> {
  try { await svc.from('link_page_events').insert(row); } catch (_) { /* the visit matters more */ }
}
