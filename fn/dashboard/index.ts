// Welfare Avenue Executive Dashboard: stable entry point.
// Supabase does not render HTML on the shared *.supabase.co domain, so this
// endpoint 302-redirects to wherever the site is hosted (app_config.site_url).
// Slack deep links all point here, so hosting can move without breaking them.
import { createClient } from 'jsr:@supabase/supabase-js@2';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const SELF = SUPABASE_URL + '/functions/v1/dashboard';

Deno.serve(async (req: Request) => {
  const { data } = await svc.from('app_config').select('value').eq('key', 'site_url').maybeSingle();
  const target = (data && data.value) || '';
  const url = new URL(req.url);
  if (target && target.indexOf('/functions/v1/dashboard') < 0 && target.startsWith('http')) {
    return new Response(null, { status: 302, headers: { Location: target + (url.hash || '') } });
  }
  return new Response(
    'Welfare Avenue Executive Dashboard\n\nThe dashboard is built and waiting for its web address.\nFinish the go-live steps in GO-LIVE.md (host the index.html file, then this link will forward there automatically).',
    { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  );
});
