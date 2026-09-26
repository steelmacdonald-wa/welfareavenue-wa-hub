// Welfare Avenue: clickup-pull (v2)
// Weekly ClickUp snapshot per department: open task status counts, tasks
// created this week, tasks completed this week. Movement is the delta between
// weekly snapshots, shown on the dashboard. Folder to department mapping
// lives in clickup_sources ('split-mtl-to' splits by list name).
// v2: 'closed this week' now counts date_done (custom done-type statuses like
// 'done', 'completed / achieved', 'complete') in addition to ClickUp's native
// date_closed. The team marks work done with custom statuses, which never set
// date_closed, so v1 always reported 0 completed.
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
const DEPT_LABEL: Record<string, string> = { opsmtl: 'Ops Montreal', opsto: 'Ops Toronto', marketing: 'Marketing', fundraising: 'Fundraising and Grants', hr: 'HR', board: 'Board' };

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
async function postSlack(text: string) {
  try {
    const url = await getSecret('SLACK_WEBHOOK_URL');
    if (!url) return;
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  } catch (e) { console.error('slack post failed', e); }
}
async function cuApi(token: string, path: string): Promise<Record<string, unknown>> {
  const res = await fetch('https://api.clickup.com/api/v2' + path, { headers: { Authorization: token } });
  if (res.status === 429) { await new Promise(r => setTimeout(r, 15000)); return cuApi(token, path); }
  return await res.json();
}
function weekStartStr(epochMs: number): string {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
  const parts: Record<string, string> = {};
  f.formatToParts(new Date(epochMs)).forEach(p => { parts[p.type] = p.value; });
  const wdMap: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const dayUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day) - (wdMap[parts.weekday] ?? 0) * 86400000;
  return new Date(dayUtc).toISOString().slice(0, 10);
}

async function runPull() {
  const token = await getSecret('CLICKUP_TOKEN');
  if (!token) { console.warn('clickup-pull: no token'); return; }

  const week = weekStartStr(Date.now());
  const weekMs = new Date(week + 'T00:00:00-04:00').getTime();
  const { data: sources } = await svc.from('clickup_sources').select('*').eq('enabled', true).not('department', 'is', null);

  type Agg = { created: number; closed: number; statuses: Record<string, number> };
  const agg: Record<string, Agg> = {};
  const bump = (dept: string): Agg => (agg[dept] = agg[dept] || { created: 0, closed: 0, statuses: {} });
  let listsRead = 0;

  for (const src of (sources || []) as Array<{ id: string; department: string }>) {
    const fl = await cuApi(token, '/folder/' + src.id + '/list?archived=false');
    const lists = (fl.lists || []) as Array<{ id: string; name: string }>;
    for (const list of lists) {
      let dept = src.department;
      if (dept === 'split-mtl-to') {
        dept = /toronto|tchc|haven|(^|[^a-z])to([^a-z]|$)/i.test(list.name || '') ? 'opsto' : 'opsmtl';
      }
      const a = bump(dept);
      /* open tasks: status counts */
      const open = await cuApi(token, '/list/' + list.id + '/task?archived=false&subtasks=true&page=0');
      for (const t of (open.tasks || []) as Array<{ status?: { status?: string } }>) {
        const s = (t.status?.status || 'open').toLowerCase();
        a.statuses[s] = (a.statuses[s] || 0) + 1;
      }
      /* recently updated incl. closed: created and completed this week.
         Completion = native date_closed OR date_done (custom done-type status). */
      const recent = await cuApi(token, '/list/' + list.id + '/task?archived=false&subtasks=true&include_closed=true&date_updated_gt=' + weekMs + '&page=0');
      for (const t of (recent.tasks || []) as Array<{ date_created?: string; date_closed?: string | null; date_done?: string | null }>) {
        if (t.date_created && parseInt(t.date_created, 10) >= weekMs) a.created++;
        const doneRaw = t.date_closed || t.date_done;
        if (doneRaw && parseInt(doneRaw, 10) >= weekMs) a.closed++;
      }
      listsRead++;
    }
  }

  let rows = 0;
  for (const [dept, a] of Object.entries(agg)) {
    const { error } = await svc.from('clickup_weekly').upsert({
      department: dept, week_start: week,
      created_n: a.created, closed_n: a.closed,
      status_counts: a.statuses, updated_at: new Date().toISOString()
    });
    if (!error) rows++;
  }

  await svc.from('change_log').insert({
    entity_type: 'clickup_pull', entity_id: week, field: 'ran',
    old_value: null, new_value: listsRead + ' lists read, ' + rows + ' department snapshots',
    changed_by: 'ClickUp pull'
  });
  const lines = Object.entries(agg).map(([d, a]) => '  • ' + (DEPT_LABEL[d] || d) + ': ' + a.closed + ' closed, ' + a.created + ' created this week');
  if (lines.length) await postSlack(':large_green_circle: *Welfare Avenue Dashboard*\nClickUp snapshot (week of ' + week + '):\n' + lines.join('\n'));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!(await authorize(req))) return json({ error: 'unauthorized' }, 401);
  const token = await getSecret('CLICKUP_TOKEN');
  if (!token) return json({ error: 'tokens_missing' });
  const work = runPull().catch(e => console.error('clickup-pull failed', e));
  // @ts-ignore EdgeRuntime provided by the Supabase edge runtime
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) { EdgeRuntime.waitUntil(work); } else { await work; }
  return json({ accepted: true }, 202);
});
