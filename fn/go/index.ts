// Welfare Avenue: go (v1, 09/10/26, wave225 the Content Studio)
// The short links: hub.welfareavenue.com/l/<code> (Netlify's _redirects proxies /l/* here) redirects to the link's address
// and counts the click. Purpose: the Content Studio's tracked links (made by social-publish for links in captions, by hand on
// the Links page, and the link-in-bio page's bio-* links).
// Auth: none (a public redirect; verify_jwt off). It only reads an active short_links row and writes one short_link_clicks
// row through wa225_click (when, the referring site's host, phone or computer, the country the host reports). No address,
// no cookie, nothing that names a person. An unknown or retired code goes to welfareavenue.com.
// Tables: short_links (read), short_link_clicks (through wa225_click).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const HOME = 'https://welfareavenue.com/';
const go = (url: string) => new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer-when-downgrade' } });

Deno.serve(async (req: Request) => {
  const u = new URL(req.url);
  const m = /\/go\/([A-Za-z0-9_-]{3,40})\/?$/.exec(u.pathname);
  const code = m ? m[1] : (u.searchParams.get('c') || '');
  if (!/^[A-Za-z0-9_-]{3,40}$/.test(code)) return go(HOME);
  const { data } = await svc.from('short_links').select('id, url, active').eq('code', code).maybeSingle();
  if (!data || !data.active || !/^https?:\/\//.test(String(data.url))) return go(HOME);
  const ua = req.headers.get('user-agent') || '';
  if (!/bot|crawl|spider|preview|facebookexternalhit|slackbot|whatsapp|linkedinbot|twitterbot|bingpreview/i.test(ua)) {
    let host: string | null = null;
    try { const r = req.headers.get('referer') || req.headers.get('x-forwarded-referer') || ''; host = r ? new URL(r).hostname.slice(0, 120) : null; } catch (_) { host = null; }
    const country = (req.headers.get('x-country') || req.headers.get('x-nf-country') || req.headers.get('cf-ipcountry') || '').slice(0, 2).toUpperCase() || null;
    const device = /mobile|iphone|android|ipad/i.test(ua) ? 'phone' : 'computer';
    try { await svc.rpc('wa225_click', { p_link: data.id, p_ref: host, p_device: device, p_country: country }); } catch (_) { /* the redirect matters more */ }
  }
  return go(String(data.url));
});
