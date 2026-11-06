// Welfare Avenue: health-check (v3, 05/11/26, wave280; v2 25/09/26)
// v3 (wave280): the job watchdog. Steel (05/11/26), after the Loom pull had failed unseen for ten days: "could you notify admins next
// time something like this isn't working". Action jobs (pg_cron wa-job-watch, every hour at :20, through call_edge) reads
// wa280_job_health(): the Loom pull's last runs, the Meet attendance sync, and every function call_edge calls (its last answers in
// pg_net). Each job's state is kept in wa_health_checks (service job:<name> or fn:<name>, with label, down_since, last_alert_at).
// When a job stops working the admins get a Slack DM from the Hub bot (and the alert channel a post, as before); while it stays down,
// the DM comes again once a day; when it works again, one more DM. The admins are hub_roles admin, or the comma list in
// app_config health_alert_to when it is set. Each alert is in change_log (entity_type health). The daily run (no action, wa-health-check
// at 11:50) checks the AI models as before and the jobs too; model alerts now reach the admins by DM as well. Links go to
// hub.welfareavenue.com (the old wa-exec-dashboard.netlify.app link is gone).
// v2: Daily model health check for the Hub. Since 25/09/26 every AI job goes
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
const HUB = 'https://hub.welfareavenue.com';
const SLACK_API = Deno.env.get('WA_SLACK_API') || 'https://slack.com/api';   // the tests point this at a mock
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

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

/* ---------- wave280: the admins, by Slack DM ---------- */
export async function alertTo(): Promise<string[]> {
  const { data: cfg } = await svc.from('app_config').select('value').eq('key', 'health_alert_to').maybeSingle();
  const set = String((cfg as Row | null)?.value || '').split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => /@/.test(x));
  if (set.length) return [...new Set(set)];
  const { data } = await svc.from('hub_roles').select('email').eq('role', 'admin');
  return [...new Set(((data || []) as Row[]).map((r) => String(r.email || '').trim().toLowerCase()).filter((x) => /@/.test(x)))];
}
async function slackIdFor(email: string, token: string): Promise<string | null> {
  const { data } = await svc.from('wa_slack_ids').select('slack_id').eq('email', email).maybeSingle();
  if ((data as Row | null)?.slack_id) return String((data as Row).slack_id);
  try {
    const res = await fetch(SLACK_API + '/users.lookupByEmail?email=' + encodeURIComponent(email), { headers: { Authorization: 'Bearer ' + token } });
    const body = await res.json();
    if (body.ok && body.user?.id) {
      await svc.from('wa_slack_ids').upsert({ email, slack_id: body.user.id, source: 'lookupByEmail', updated_at: new Date().toISOString() });
      return String(body.user.id);
    }
  } catch (_) { /* nobody by that address */ }
  return null;
}
async function dm(slackId: string, text: string, token: string): Promise<string> {
  try {
    const open = await (await fetch(SLACK_API + '/conversations.open', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ users: slackId }) })).json();
    if (!open.ok) return 'failed: ' + open.error;
    const post = await (await fetch(SLACK_API + '/chat.postMessage', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: open.channel.id, text, unfurl_links: false }) })).json();
    return post.ok ? 'sent' : 'failed: ' + post.error;
  } catch (e) { return 'failed: ' + String(e).slice(0, 120); }
}
/* every admin once (two addresses on one Slack account get one DM), then the alert channel; each outcome in change_log */
export async function alertAdmins(service: string, text: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const token = await getSecret('SLACK_BOT_TOKEN');
  const seen = new Set<string>();
  for (const email of await alertTo()) {
    if (!token) { out[email] = 'failed: no Slack bot token'; continue; }
    const id = await slackIdFor(email, token);
    if (!id) { out[email] = 'skipped: no Slack account'; continue; }
    if (seen.has(id)) { out[email] = 'skipped: same Slack account as another address'; continue; }
    seen.add(id);
    out[email] = await dm(id, text, token);
  }
  out.channel = (await postSlack(text)) ? 'posted' : 'not posted';
  await svc.from('change_log').insert({ entity_type: 'health', entity_id: service, field: 'alert', old_value: null, new_value: (text.split('\n')[0] + ' | ' + Object.entries(out).map(([k, v]) => k + ': ' + v).join('; ')).slice(0, 2000), changed_by: 'health-check' }).then(() => null, () => null);
  return out;
}

/* Toronto time in words, for the messages */
export function when(iso: string | null | undefined): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return '';
  return new Date(t).toLocaleString('en-CA', { timeZone: 'America/Toronto', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).replace(/\./g, '');
}
const OPEN = '\n<' + HUB + '|Open the Hub>';
export function downText(label: string, error: string | null, since: string | null, again: boolean): string {
  const s = when(since);
  return (again ? ':red_circle: *Still not working: ' + label + '.*' : ':red_circle: *' + label + ' is not working.*') + (s ? ' Since ' + s + ' (Toronto time).' : '')
    + '\nLast error: ' + String(error || 'unknown').replace(/\s+/g, ' ').slice(0, 400)
    + '\nThe Hub checks every hour, reminds you once a day while it stays down, and tells you when it works again.' + OPEN;
}
export function upText(label: string, since: string | null): string {
  const s = when(since);
  return ':large_green_circle: *' + label + ' is working again.*' + (s ? ' It had stopped since ' + s + ' (Toronto time).' : '') + OPEN;
}

/* one service's new state: what to tell the admins, if anything (a flip, or a daily reminder while down) */
export type Seen = { service: string; label: string; ok: boolean; error: string | null; since?: string | null };
export function decide(prev: Row | null, now: Seen, nowMs: number): { kind: 'down' | 'again' | 'up' | null; downSince: string | null } {
  if (!now.ok) {
    const downSince = (prev && prev.ok === false && prev.down_since) ? String(prev.down_since) : (now.since || new Date(nowMs).toISOString());
    if (!prev || prev.ok !== false) return { kind: 'down', downSince };
    const last = prev.last_alert_at ? Date.parse(String(prev.last_alert_at)) : 0;
    return { kind: nowMs - last >= 23.5 * 3600000 ? 'again' : null, downSince };
  }
  return { kind: prev && prev.ok === false ? 'up' : null, downSince: null };
}
export async function record(now: Seen): Promise<string | null> {
  const nowIso = new Date().toISOString();
  const { data: prev } = await svc.from('wa_health_checks').select('ok, down_since, last_alert_at').eq('service', now.service).maybeSingle();
  const d = decide(prev as Row | null, now, Date.now());
  const row: Row = { service: now.service, label: now.label, ok: now.ok, last_error: now.error, last_checked_at: nowIso, down_since: d.downSince };
  if (now.ok) row.last_ok_at = nowIso;
  if (d.kind) row.last_alert_at = nowIso;
  await svc.from('wa_health_checks').upsert(row, { onConflict: 'service' });
  if (!d.kind) return null;
  const text = d.kind === 'up' ? upText(now.label, (prev as Row | null)?.down_since || null) : downText(now.label, now.error, d.downSince, d.kind === 'again');
  await alertAdmins(now.service, text);
  return d.kind + ' ' + now.service;
}

const LABEL: Record<string, string> = {
  router_brain: 'The Hub model router: the Brain’s primary model (Sonnet via OpenRouter)',
  router_cheap: 'The Hub model router: the filing model (Haiku via OpenRouter)',
  jev: 'Jev (OpenRouter’s decision model)',
};

export async function jobs(): Promise<{ checked: number; alerts: string[]; error?: string }> {
  const { data, error } = await svc.rpc('wa280_job_health');
  if (error) return { checked: 0, alerts: [], error: error.message };
  const alerts: string[] = [];
  for (const j of (Array.isArray(data) ? data : []) as Row[]) {
    const a = await record({ service: String(j.service), label: String(j.label || j.service), ok: j.ok !== false, error: j.error ? String(j.error) : null, since: j.since ? String(j.since) : null });
    if (a) alerts.push(a);
  }
  return { checked: Array.isArray(data) ? data.length : 0, alerts };
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!(await authorize(req))) return json({ error: 'unauthorized' }, 401);
  const b = await req.json().catch(() => ({})) as Row;

  if (b.action === 'jobs') return json({ ok: true, jobs: await jobs() });

  const [brain, cheap, jev] = await Promise.all([
    viaRouter('brain', 'anthropic/claude-sonnet-5'),
    viaRouter('mail_triage', 'anthropic/claude-haiku-4.5'),
    viaRouter('decide'),
  ]);
  const alerts: string[] = [];
  for (const [service, r] of [['router_brain', brain], ['router_cheap', cheap], ['jev', jev]] as Array<[string, Check]>) {
    const a = await record({ service, label: LABEL[service], ok: r.ok, error: r.error });
    if (a) alerts.push(a);
  }
  /* the two old rows (anthropic direct, openrouter direct) are retired: mark them as no longer watched */
  try { await svc.from('wa_health_checks').delete().in('service', ['anthropic', 'openrouter']); } catch (_) { /* fine */ }
  const j = await jobs();
  return json({ ok: true, router_brain: brain, router_cheap: cheap, jev, alerts: alerts.concat(j.alerts), jobs: j });
}

if (!Deno.env.get('WA_FN_TEST')) Deno.serve(handler);
