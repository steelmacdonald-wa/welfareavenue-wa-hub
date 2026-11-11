// Welfare Avenue: form-guard (v1, wave308, 11/11/26)
// Steel (10/11/26): "what happens if our website gets attacked with a bunch of bots submitting forms?" and (11/11/26)
// "a spam alert would be good and Cloudflare Turnstile would be helpful too".
// Every 15 minutes (cron wa-form-guard) it reads crm_form_submissions (tests left out) for the last 15 and 60 minutes and
// raises an alert when the forms are hit harder than people ever hit them:
//   10+ blocked in 15 minutes, 25+ blocked in an hour, 12+ sent in 15 minutes, or 8+ from one connection in 15 minutes
//   (normal is a few a day). An alert:
//   - DMs the people in app_config form_guard_to (comma-separated emails; default Steel) from the Hub's Slack bot, with
//     the numbers, the forms hit and what the Hub did;
//   - when app_config forms_turnstile is 'auto' and a Turnstile site key is set, turns the bot check on for 24 hours
//     (forms_turnstile_until), which form-submit reads;
//   - waits an hour before alerting again unless the wave doubles (app_config form_guard_last).
// Actions (POST, x-wa-secret = WA_TRIGGER_SECRET only): {action:'check'} (the cron), {action:'dry'} (the numbers and the
// message, nothing sent or changed), {action:'test'} (sends a sample DM marked as a test). Nothing about a person is read:
// counts, form names, the connection hash count.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
const LIMITS = { blocked15: 10, blocked60: 25, sent15: 12, oneConn15: 8 };
const DEFAULT_TO = 'steel.macdonald@welfareavenue.com';

async function getSecret(name: string): Promise<string> { const { data, error } = await svc.rpc('get_secret', { secret_name: name }); if (error || !data) throw new Error('secret ' + name + ' unavailable'); return data as string; }
async function cfg(keys: string[]): Promise<Record<string, string>> {
  const { data } = await svc.from('app_config').select('key,value').in('key', keys);
  const m: Record<string, string> = {}; (data || []).forEach((r: Row) => { m[r.key] = String(r.value ?? '').replace(/^"|"$/g, ''); });
  return m;
}
async function setCfg(key: string, value: string) { await svc.from('app_config').upsert({ key, value, updated_at: new Date().toISOString() }); }

async function stats() {
  const now = Date.now(), s15 = new Date(now - 15 * 60000).toISOString(), s60 = new Date(now - 60 * 60000).toISOString();
  const { data } = await svc.from('crm_form_submissions').select('status, ip_hash, form_id, error, created_at').gte('created_at', s60).or('is_test.is.null,is_test.eq.false').limit(5000);
  const rows = (data || []) as Row[];
  const in15 = rows.filter((r) => r.created_at >= s15);
  const blocked15 = in15.filter((r) => r.status === 'spam').length, blocked60 = rows.filter((r) => r.status === 'spam').length;
  const sent15 = in15.filter((r) => r.status !== 'spam').length;
  const byIp: Record<string, number> = {}; in15.forEach((r) => { if (r.ip_hash) byIp[r.ip_hash] = (byIp[r.ip_hash] || 0) + 1; });
  const oneConn15 = Math.max(0, ...Object.values(byIp));
  const conns15 = Object.keys(byIp).length;
  const byForm: Record<string, number> = {}; in15.forEach((r) => { byForm[r.form_id] = (byForm[r.form_id] || 0) + 1; });
  const why: Record<string, number> = {}; rows.filter((r) => r.status === 'spam').forEach((r) => { const k = String(r.error || 'other'); why[k] = (why[k] || 0) + 1; });
  let forms: { title: string; n: number }[] = [];
  const ids = Object.keys(byForm).map(Number).filter(Boolean);
  if (ids.length) {
    const { data: fs } = await svc.from('crm_forms').select('id, title').in('id', ids);
    forms = (fs || []).map((f: Row) => ({ title: f.title, n: byForm[f.id] || 0 })).sort((a, b) => b.n - a.n).slice(0, 4);
  }
  const { count: day } = await svc.from('crm_form_submissions').select('id', { count: 'exact', head: true }).gte('created_at', new Date(now - 30 * 86400000).toISOString()).neq('status', 'spam').or('is_test.is.null,is_test.eq.false');
  return { blocked15, blocked60, sent15, oneConn15, conns15, forms, why, perDay: Math.round(((day || 0) / 30) * 10) / 10 };
}
function tripped(s: Row): string[] {
  const out: string[] = [];
  if (s.blocked15 >= LIMITS.blocked15) out.push(s.blocked15 + ' blocked in 15 minutes');
  if (s.blocked60 >= LIMITS.blocked60) out.push(s.blocked60 + ' blocked in the last hour');
  if (s.sent15 >= LIMITS.sent15) out.push(s.sent15 + ' sent in 15 minutes');
  if (s.oneConn15 >= LIMITS.oneConn15) out.push(s.oneConn15 + ' from one connection in 15 minutes');
  return out;
}
function message(s: Row, reasons: string[], did: string, test: boolean): string {
  const why = Object.entries(s.why as Record<string, number>).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => n + ' ' + k).join(', ');
  return (test ? ':test_tube: *Test of the form alert* (nothing is happening)\n' : '') +
    ':rotating_light: *The website forms are being hit unusually hard.* ' + reasons.join('; ') + '.\n' +
    '• Last 15 minutes: ' + s.sent15 + ' sent, ' + s.blocked15 + ' blocked, from ' + s.conns15 + ' connection' + (s.conns15 === 1 ? '' : 's') + '. Normally about ' + s.perDay + ' a day.\n' +
    (s.forms.length ? '• Forms hit: ' + s.forms.map((f: Row) => f.title + ' (' + f.n + ')').join(', ') + '\n' : '') +
    (why ? '• Blocked because: ' + why + '\n' : '') +
    '• ' + did + '\n' +
    'Look at the sign-ups in the Hub: https://hub.welfareavenue.com/#crm/forms';
}
async function slackId(tok: string, email: string): Promise<string | null> {
  const { data } = await svc.from('wa_slack_ids').select('slack_id').eq('email', email.toLowerCase()).maybeSingle();
  if (data && data.slack_id) return data.slack_id;
  const r = await fetch('https://slack.com/api/users.lookupByEmail?email=' + encodeURIComponent(email), { headers: { Authorization: 'Bearer ' + tok } });
  const j = await r.json(); return j && j.ok ? j.user.id : null;
}
async function dm(to: string[], text: string) {
  const tok = await getSecret('SLACK_BOT_TOKEN'); const out: Row[] = [];
  for (const email of to) {
    const id = await slackId(tok, email);
    if (!id) { out.push({ email, ok: false, error: 'no Slack id' }); continue; }
    const r = await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ channel: id, text, unfurl_links: false, unfurl_media: false }) });
    const j = await r.json(); out.push({ email, ok: !!j.ok, error: j.ok ? null : j.error });
  }
  return out;
}

Deno.serve(async (req) => {
  try {
    const given = req.headers.get('x-wa-secret') || '';
    if (!given || given !== (await getSecret('WA_TRIGGER_SECRET'))) return json({ error: 'not allowed' }, 401);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'check');
    const c = await cfg(['form_guard_to', 'form_guard_last', 'forms_turnstile', 'turnstile_site_key']);
    const to = (c.form_guard_to || DEFAULT_TO).split(',').map((x) => x.trim().toLowerCase()).filter((x) => /@welfareavenue\.com$/.test(x));
    const s = await stats();
    const reasons = tripped(s);
    const canTs = !!(c.turnstile_site_key || '').trim(), mode = (c.forms_turnstile || 'off').trim();
    const did = mode === 'on' ? 'The bot check (Cloudflare Turnstile) is already on for every form.'
      : mode === 'auto' && canTs ? 'The Hub turned the bot check (Cloudflare Turnstile) on for 24 hours.'
      : 'The bot check is not set up yet, so only the hidden field, the form pass and the limits are stopping them.';
    if (action === 'dry') return json({ ok: true, stats: s, reasons, would_send: reasons.length ? message(s, reasons, did, false) : null, to });
    if (action === 'test') return json({ ok: true, sent: await dm(to, message(s, reasons.length ? reasons : ['this is a test'], did, true)) });
    if (!reasons.length) return json({ ok: true, quiet: true, stats: s });
    let last: Row = {}; try { last = JSON.parse(c.form_guard_last || '{}'); } catch (_) { last = {}; }
    const total = s.blocked15 + s.sent15, recent = last.at && Date.now() - Date.parse(last.at) < 3600000;
    if (recent && total < 2 * (Number(last.total) || 0)) return json({ ok: true, held: 'alerted within the hour', stats: s });
    if (mode === 'auto' && canTs) await setCfg('forms_turnstile_until', new Date(Date.now() + 24 * 3600000).toISOString());
    const sent = await dm(to, message(s, reasons, did, false));
    await setCfg('form_guard_last', JSON.stringify({ at: new Date().toISOString(), total, reasons }));
    await svc.from('change_log').insert({ entity_type: 'form_guard', entity_id: 'alert', field: 'reasons', old_value: null, new_value: reasons.join('; ').slice(0, 300), changed_by: 'form-guard' });
    return json({ ok: true, alerted: true, reasons, sent, stats: s });
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
