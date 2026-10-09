// Welfare Avenue: go (v2, 09/10/26: wave230 link page clicks; v1 09/10/26, wave225 the Content Studio)
// The short links: hub.welfareavenue.com/l/<code> (Netlify's _redirects proxies /l/* here) redirects to the link's address
// and counts the click. Purpose: the Content Studio's tracked links (made by social-publish for links in captions, by hand on
// the Links page) and the link pages' buttons.
// v2 (wave230): a link page's buttons carry ?t=<the signed visit token>&b=<block id>; the click is also written to
// link_page_events with the page, the block, the source, the A/B variant, the device and the keyed network hashes (lp.ts).
// /l/_?t=..&b=..&to=<path or allowed address> is a link page button with no short link of its own (a CRM form, the donation
// page, an Instagram post, a social profile): only Hub paths and our own social profiles' hosts are allowed (no open redirect).
// A switched-off link goes to its fallback_url, else the page's fallback, else welfareavenue.com.
// Auth: none (a public redirect; verify_jwt off). Tables: short_links (read), short_link_clicks (through wa225_click),
// link_page_events (insert), link_pages (read, the fallback).
import { svc, Any, isBot, parseUA, geoOf, hashes, readVisit, allowedTarget, record } from './lp.ts';

const HOME = 'https://welfareavenue.com/';
const go = (url: string) => new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer-when-downgrade' } });

Deno.serve(async (req: Request) => {
  const u = new URL(req.url);
  const m = /\/go\/([A-Za-z0-9_-]{1,40})\/?$/.exec(u.pathname);
  const code = m ? m[1] : (u.searchParams.get('c') || '');
  const ua = req.headers.get('user-agent') || '';
  const bot = isBot(ua);
  const visit = u.searchParams.get('t') ? await readVisit(u.searchParams.get('t') || '') : null;
  const block = String(u.searchParams.get('b') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || null;
  let target: string | null = null, linkId: number | null = null, active = true, fallback: string | null = null;
  if (code === '_') target = allowedTarget(u.searchParams.get('to') || '');
  else if (/^[A-Za-z0-9_-]{3,40}$/.test(code)) {
    const { data } = await svc.from('short_links').select('id, url, active, fallback_url').eq('code', code).maybeSingle();
    if (data && /^https?:\/\//.test(String(data.url))) { linkId = Number(data.id); target = String(data.url); active = !!data.active; fallback = data.fallback_url || null; }
  }
  if (target && !active) {
    if (!fallback && visit) { const { data: pg } = await svc.from('link_pages').select('settings').eq('id', visit.p).maybeSingle(); fallback = (pg && pg.settings && pg.settings.fallback_url) || null; }
    target = fallback && /^https?:\/\//.test(fallback) ? fallback : null;
  }
  if (!target) return go(HOME);
  if (!bot) {
    const pu = parseUA(ua);
    const h = await hashes(req, pu);
    if (linkId && active) {
      let host: string | null = null;
      try { const r = req.headers.get('referer') || ''; host = r ? new URL(r).hostname.slice(0, 120) : null; } catch (_) { host = null; }
      try { await svc.rpc('wa225_click', { p_link: linkId, p_ref: visit ? 'link page' : host, p_device: pu.device === 'computer' ? 'computer' : 'phone', p_country: geoOf(req, visit?.tz || '').country }); } catch (_) { /* the redirect matters more */ }
    }
    if (visit && visit.p) {
      const geo = geoOf(req, visit.tz || '');
      const variant = visit.ab && block && visit.ab[block] ? visit.ab[block] : null;
      await record(req, { page_id: visit.p, kind: 'click', block_id: block, link_id: linkId, variant, src: visit.s || 'direct', src_detail: visit.sd || null, visitor: h.visitor || visit.v || null, repeat_visit: !!visit.rv, lang: visit.l || null, device: pu.device, os: pu.os, browser: pu.browser, country: geo.country, region: geo.region, city: geo.city, tz: visit.tz || null, ipm: h.ipm } as Any);
    }
  }
  return go(target);
});
