// Welfare Avenue: site (v1, 22/07/26)
// Serves the assembled dashboard HTML from the site_files table with an
// explicit text/html content type. Netlify proxies to this endpoint via a
// _redirects rewrite, so every site_files update is live within minutes and
// the storage CDN's content-type quirk is bypassed entirely. The page shell
// is public by design; all data behind it is locked by RLS and Google
// sign-in.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);

let cache: { html: string; at: number } | null = null;
const TTL_MS = 60000;

Deno.serve(async (_req: Request) => {
  try {
    if (!cache || Date.now() - cache.at > TTL_MS) {
      const { data, error } = await svc.from('site_files')
        .select('part, content').eq('path', 'index.html')
        .order('part', { ascending: true });
      if (error || !data || !data.length) {
        return new Response('Site content unavailable, try again shortly.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
      cache = { html: data.map((r: { content: string }) => r.content).join(''), at: Date.now() };
    }
    return new Response(cache.html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=120',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (e) {
    return new Response('Site error: ' + String(e), { status: 500, headers: { 'Content-Type': 'text/plain' } });
  }
});
