// Welfare Avenue: hr-notify (v1, 06/10/26, wave212)
// Valex (06/10/26): "notify Valex and Samson when someone asks for time off". A new time-off request (wa_timeoff, status
// requested; trigger trg_wa212_timeoff) is sent by Slack DM, from the Hub bot, to the people in app_config
// hr_notify_emails (default Valex and Samson), with the dates, the type, the note and a link to the HR centre's Time off.
// The requester is never DMed here. Auth: the trigger secret only.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const HUB = 'https://hub.welfareavenue.com';
const CATS: Record<string, string> = { vacation: 'Vacation', school_break: 'School break', sick: 'Mental health / sick', bereavement: 'Bereavement', religious: 'Religious holiday', wedding: 'Wedding', other: 'Other' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
async function slack(tok: string, method: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const r = await fetch('https://slack.com/api/' + method, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) });
  return await r.json();
}
async function dm(tok: string, email: string, text: string): Promise<string> {
  let uid: string | null = null;
  try { const { data } = await svc.from('wa_slack_ids').select('slack_id').ilike('email', email).maybeSingle(); uid = (data as { slack_id?: string } | null)?.slack_id || null; } catch (_) { uid = null; }
  if (!uid) { const r = await fetch('https://slack.com/api/users.lookupByEmail?email=' + encodeURIComponent(email), { headers: { Authorization: 'Bearer ' + tok } }); const b = await r.json(); uid = b?.user?.id || null; }
  if (!uid) return 'no slack account';
  const o = await slack(tok, 'conversations.open', { users: uid }); const ch = (o.channel as { id?: string } | undefined)?.id; if (!ch) return String(o.error || 'no dm');
  const p = await slack(tok, 'chat.postMessage', { channel: ch, text, unfurl_links: false }); return p.ok ? 'sent' : String(p.error || 'refused');
}
function d(s: string): string { try { return new Date(s + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }); } catch (_) { return s; } }

Deno.serve(async (req) => {
  try {
    const secret = await getSecret('WA_TRIGGER_SECRET');
    if (req.headers.get('x-wa-secret') !== secret) return json({ error: 'not allowed' }, 401);
    const b = await req.json().catch(() => ({}));
    if (b.action !== 'timeoff_requested') return json({ error: 'unknown action' }, 400);
    const { data: t } = await svc.from('wa_timeoff').select('*').eq('id', Number(b.id)).maybeSingle();
    if (!t || t.status !== 'requested') return json({ ok: true, skipped: 'not a request' });
    const { data: cfg } = await svc.from('app_config').select('value').eq('key', 'hr_notify_emails').maybeSingle();
    const to = String((cfg as { value?: string } | null)?.value || 'valex.sanon@welfareavenue.com,samson.jules@welfareavenue.com').split(/[,\s]+/).map(x => x.trim().toLowerCase()).filter(Boolean).filter(x => x !== String(t.email || '').toLowerCase());
    const text = ':palm_tree: *' + t.name + '* asked for time off: ' + (CATS[t.category] || t.category) + ', ' + d(t.start_date) + (t.end_date !== t.start_date ? ' to ' + d(t.end_date) : '') + ' (' + t.days + (Number(t.days) === 1 ? ' day' : ' days') + ').' + (t.note ? '\n_' + String(t.note).slice(0, 300) + '_' : '') + '\n<' + HUB + '/#hrcentre/timeoff|Approve or decline in the HR centre>';
    const tok = await getSecret('SLACK_BOT_TOKEN');
    const out: Record<string, string> = {};
    for (const e of to.slice(0, 6)) out[e] = await dm(tok, e, text);
    try { await svc.from('change_log').insert({ entity_type: 'timeoff', entity_id: String(t.id), field: 'notified', old_value: null, new_value: Object.entries(out).map(([k, v]) => k + ': ' + v).join('; '), changed_by: 'hr-notify' }); } catch (_) { /* audit */ }
    return json({ ok: true, sent: out });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
