// Welfare Avenue: health-check (v2, 25/09/26)
// Daily model health check for the Hub. Since 25/09/26 every AI job goes
// through the Hub model router (llm) to OpenRouter, so this checks what
// the Hub actually depends on: the router answering with the Brain's
// primary model (Sonnet through OpenRouter), a cheap model (the filing
// route), and Jev (the decision model). Results are upserted into
// wa_health_checks per service; a Slack alert (SLACK_WEBHOOK_URL) is
// posted ONLY on a state change (down, or back up), never on a steady
// day. Triggered by pg_cron (wa-health-check) via call_edge with the
// x-wa-secret, or by a signed-in staff member.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function getSecret(name: string): Promise<string | null> {
  const { data } = await svc.rpc('get_secret', { secret_name: name });
  return (data as string) || null;
}
async function authorize(req: Request): Promise<boolean> {
  try {
    const given = req.headers.get('x-wa-secret');
    if (given && given === (await getSecret('WA_TRIGGER_SECRET'))) return true;
  } catch (_) { /* fall through */ }
  const authHeader = req.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data } = await asUser.auth.getUser();
    if ((data?.user?.email || '').toLowerCase().endsWith('@welfareavenue.com')) return true;
  }
  return false;
}

type Check = { ok: boolean; error: string | null; model?: string | null; ms?: number | null };
async function viaRouter(task: string, model?: string): Promise<Check> {
  try {
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST', headers: { Authorization: 'Bearer ' + SERVICE_KEY, 'x-wa-caller': 'health-check', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test', task, ...(model ? { model } : {}) })
    });
    if (!res.ok) return { ok: false, error: 'router ' + res.status + ' ' + (await res.text()).slice(0, 200) };
    const out = await res.json();
    if (out.ok) return { ok: true, error: null, model: out.model || null, ms: out.ms || null };
    return { ok: false, error: String(out.error || 'no answer').slice(0, 300), model: out.model || null, ms: out.ms || null };
  } catch (e) { return { ok: false, error: String(e).slice(0, 200) }; }
}

async function postSlack(text: string): Promise<boolean> {
  try {
    const url = await getSecret('SLACK_WEBHOOK_URL');
    if (!url) return false;
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    return r.ok;
  } catch (_) { return false; }
}

const LABEL: Record<string, string> = {
  router_brain: 'Hub model router: the Brain’s primary model (Sonnet via OpenRouter)',
  router_cheap: 'Hub model router: the filing model (Haiku via OpenRouter)',
  jev: 'Jev (OpenRouter’s decision model)',
};

async function runCheck(service: string, result: Check): Promise<string | null> {
  const nowIso = new Date().toISOString();
  const { data: prev } = await svc.from('wa_health_checks').select('ok').eq('service', service).maybeSingle();
  const flipped = prev ? prev.ok !== result.ok : result.ok === false; // first-ever check only alerts if it starts down
  await svc.from('wa_health_checks').upsert({
    service, ok: result.ok, last_error: result.error,
    last_ok_at: result.ok ? nowIso : undefined,
    last_checked_at: nowIso
  }, { onConflict: 'service' });
  if (!flipped) return null;
  if (result.ok) return ':large_green_circle: *' + LABEL[service] + ' is back up.* Verified with a live test call from the Hub health check.';
  return ':red_circle: *' + LABEL[service] + ' is down.* ' + (result.error || 'unknown error').slice(0, 300) + '\nThe Hub will keep checking daily and post here again once it recovers.';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!(await authorize(req))) return json({ error: 'unauthorized' }, 401);

  const [brain, cheap, jev] = await Promise.all([
    viaRouter('brain', 'anthropic/claude-sonnet-5'),
    viaRouter('mail_triage', 'anthropic/claude-haiku-4.5'),
    viaRouter('decide'),
  ]);
  const msgs = await Promise.all([runCheck('router_brain', brain), runCheck('router_cheap', cheap), runCheck('jev', jev)]);
  /* the two old rows (anthropic direct, openrouter direct) are retired: mark them as no longer watched */
  try { await svc.from('wa_health_checks').delete().in('service', ['anthropic', 'openrouter']); } catch (_) { /* fine */ }
  const lines = msgs.filter((l): l is string => !!l);
  let posted = false;
  if (lines.length) posted = await postSlack(lines.join('\n\n') + '\n<https://wa-exec-dashboard.netlify.app/#overview|Open the Hub>');
  return json({ ok: true, router_brain: brain, router_cheap: cheap, jev, alerted: lines.length > 0, posted });
});
