// Welfare Avenue: goal-sync (v3, 24/09/26)
// Two way sync between public.goals / goal_comments and the ClickUp WA GOALS
// quarterly lists. Actions via POST body {action}:
//   (none) or 'pull'  : ClickUp wins. Refresh status, due_date, title on mapped
//                       rows; insert brand new tasks from the quarterly lists;
//                       never deletes. Logs a goal_sync summary to change_log.
//                       Runs in the background and returns 202 (cron calls it
//                       with a short http timeout); pass {wait:true} to run
//                       synchronously and get the summary back.
//   'status'          : push a status change to the ClickUp task.
//   'comment'         : post a dashboard comment onto the ClickUp task.
//   'comment_edit'    : edit the mirrored ClickUp comment.
//   'comment_delete'  : delete the mirrored ClickUp comment.
// v3: the pull aborts when the goals read fails (on 13/09 an empty read made
// the sync re-insert 20 goals it already had), and every goal with a ClickUp
// id counts as known whatever its quarter or status. Archived goals are left
// alone (their status is not refreshed from ClickUp).
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

// The WA GOALS quarterly lists for the current quarter (Q4 FY2026).
const QUARTER = 'Q4 FY2026';
const QUARTER_LISTS: Array<{ id: string; name: string; dept: string }> = [
  { id: '901709456287', name: 'Q4 OP GOALS - Fiscal 2026', dept: 'progdev' },
  { id: '901709866852', name: 'Q4 FINA/FUND - Fiscal 2026', dept: 'fundraising' },
  { id: '901711864377', name: 'Q4 MARK - Fiscal 2026', dept: 'marketing' },
  { id: '901709864983', name: 'Q4 HR GOALS - FISCAL 2026', dept: 'hr' },
];

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
async function cuApi(token: string, method: string, path: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch('https://api.clickup.com/api/v2' + path, {
    method,
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 429) { await new Promise(r => setTimeout(r, 15000)); return cuApi(token, method, path, body); }
  const text = await res.text();
  try { return text ? JSON.parse(text) : {}; } catch (_) { return { raw: text }; }
}
// ClickUp due dates are epoch ms; render the calendar date in Toronto time.
function cuDate(ms: string | number | null | undefined): string | null {
  if (!ms) return null;
  const n = typeof ms === 'string' ? parseInt(ms, 10) : ms;
  if (!n || isNaN(n)) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(n));
}
const PLACEHOLDER = /^task \d+$/i;

type GoalRow = { id: number; department: string; quarter: string | null; title: string; status: string | null; due_date: string | null; sort: number | null; clickup_task_id: string | null };

async function runPull(token: string) {
  const { data: rows, error: readErr } = await svc.from('goals').select('id, department, quarter, title, status, due_date, sort, clickup_task_id');
  if (readErr) throw new Error('goals read failed: ' + readErr.message);
  const all = (rows || []) as GoalRow[];
  if (!all.length) throw new Error('goals read returned nothing; refusing to sync against an empty table');
  // every ClickUp id the hub already holds, whatever the quarter or status
  const known = new Set(all.map(g => g.clickup_task_id).filter(Boolean) as string[]);
  const goals = all.filter(g => g.quarter === QUARTER && g.status !== 'archived');
  let checked = 0, updated = 0, inserted = 0;

  for (const g of goals) {
    if (!g.clickup_task_id) continue;
    const t = await cuApi(token, 'GET', '/task/' + g.clickup_task_id);
    if (t.err || !t.id) continue;
    checked++;
    const patch: Record<string, unknown> = {};
    const cuStatus = (((t.status as Record<string, unknown>)?.status as string) || '').toLowerCase().trim();
    if (cuStatus && cuStatus !== (g.status || '').toLowerCase()) patch.status = cuStatus;
    const cuDue = cuDate(t.due_date as string | null);
    if (cuDue !== (g.due_date || null)) patch.due_date = cuDue;
    const cuName = ((t.name as string) || '').trim();
    if (cuName && cuName !== g.title) patch.title = cuName;
    if (Object.keys(patch).length) {
      patch.updated_at = new Date().toISOString();
      patch.updated_by = 'ClickUp sync';
      const { error } = await svc.from('goals').update(patch).eq('id', g.id);
      if (!error) updated++;
    }
  }

  const sortMax: Record<string, number> = {};
  for (const g of goals) sortMax[g.department] = Math.max(sortMax[g.department] || 0, g.sort || 0);
  for (const list of QUARTER_LISTS) {
    const res = await cuApi(token, 'GET', '/list/' + list.id + '/task?archived=false&include_closed=true&subtasks=false');
    for (const t of ((res.tasks || []) as Array<Record<string, unknown>>)) {
      const tid = t.id as string;
      if (!tid || known.has(tid)) continue;
      const name = ((t.name as string) || '').trim();
      if (!name || PLACEHOLDER.test(name)) continue; // skip placeholder tasks like 'Task 1'
      const sort = (sortMax[list.dept] = (sortMax[list.dept] || 0) + 1);
      const { error } = await svc.from('goals').insert({
        department: list.dept, quarter: QUARTER, title: name,
        status: (((t.status as Record<string, unknown>)?.status as string) || 'not started').toLowerCase(),
        due_date: cuDate(t.due_date as string | null),
        source: 'ClickUp ' + list.name + ' (' + list.id + ')',
        sort, clickup_task_id: tid,
        updated_at: new Date().toISOString(), updated_by: 'ClickUp sync',
      });
      if (!error) { inserted++; known.add(tid); }
    }
  }

  await svc.from('change_log').insert({
    entity_type: 'goal_sync', entity_id: new Date().toISOString().slice(0, 10), field: 'ran',
    old_value: null, new_value: checked + ' goals checked, ' + updated + ' updated, ' + inserted + ' inserted',
    changed_by: 'Goal sync',
  });
  return { checked, updated, inserted };
}

async function doStatus(token: string, body: Record<string, unknown>) {
  const goalId = body.goal_id as number;
  const status = (body.status as string) || '';
  if (!goalId || !status) return json({ ok: false, error: 'goal_id and status required' }, 400);
  const { data: g } = await svc.from('goals').select('id, status, clickup_task_id').eq('id', goalId).maybeSingle();
  if (!g || !g.clickup_task_id) return json({ ok: false, error: 'goal not mapped to ClickUp' }, 404);
  const res = await cuApi(token, 'PUT', '/task/' + g.clickup_task_id, { status });
  if (res.err) {
    const t = await cuApi(token, 'GET', '/task/' + g.clickup_task_id);
    const listId = ((t.list as Record<string, unknown>)?.id as string) || null;
    let valid: string[] = [];
    if (listId) {
      const l = await cuApi(token, 'GET', '/list/' + listId);
      valid = (((l.statuses || []) as Array<Record<string, unknown>>).map(s => s.status as string));
    }
    return json({ ok: false, error: 'status not in ClickUp list', valid });
  }
  if ((g.status || '') !== status) {
    await svc.from('goals').update({ status, updated_at: new Date().toISOString() }).eq('id', goalId);
  }
  return json({ ok: true });
}

const PREFIX = '(from WA dashboard) ';

async function doComment(token: string, body: Record<string, unknown>) {
  const goalId = body.goal_id as number, commentId = body.comment_id as number;
  const text = (body.body as string) || '', author = (body.author as string) || 'Staff';
  if (!goalId || !commentId || !text) return json({ ok: false, error: 'goal_id, comment_id, body required' }, 400);
  const { data: g } = await svc.from('goals').select('clickup_task_id').eq('id', goalId).maybeSingle();
  if (!g || !g.clickup_task_id) return json({ ok: false, error: 'goal not mapped to ClickUp' }, 404);
  const res = await cuApi(token, 'POST', '/task/' + g.clickup_task_id + '/comment', { comment_text: PREFIX + author + ': ' + text, notify_all: false });
  const cid = (res.id !== undefined && res.id !== null) ? String(res.id) : null;
  if (!cid) return json({ ok: false, error: 'clickup rejected comment' });
  await svc.from('goal_comments').update({ clickup_comment_id: cid }).eq('id', commentId);
  return json({ ok: true, clickup_comment_id: cid });
}

async function doCommentEdit(token: string, body: Record<string, unknown>) {
  const commentId = body.comment_id as number;
  const text = (body.body as string) || '';
  if (!commentId || !text) return json({ ok: false, error: 'comment_id and body required' }, 400);
  const { data: c } = await svc.from('goal_comments').select('clickup_comment_id, author').eq('id', commentId).maybeSingle();
  if (!c || !c.clickup_comment_id) return json({ ok: false, error: 'not synced' });
  const res = await cuApi(token, 'PUT', '/comment/' + c.clickup_comment_id, { comment_text: PREFIX + (c.author || 'Staff') + ': ' + text });
  if (res.err) return json({ ok: false, error: String(res.err) });
  return json({ ok: true });
}

async function doCommentDelete(token: string, body: Record<string, unknown>) {
  let cid = (body.clickup_comment_id as string) || null;
  const commentId = body.comment_id as number | undefined;
  if (!cid && commentId) {
    const { data: c } = await svc.from('goal_comments').select('clickup_comment_id').eq('id', commentId).maybeSingle();
    cid = (c?.clickup_comment_id as string) || null;
  }
  if (!cid) return json({ ok: false, error: 'not synced' });
  await cuApi(token, 'DELETE', '/comment/' + cid); // ok even if already gone
  return json({ ok: true });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!(await authorize(req))) return json({ error: 'unauthorized' }, 401);
  const token = await getSecret('CLICKUP_TOKEN');
  if (!token) return json({ ok: false, error: 'tokens_missing' });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) { /* empty body means pull */ }
  const action = (body.action as string) || 'pull';
  try {
    if (action === 'pull') {
      if (body.wait === true) {
        const out = await runPull(token);
        return json({ ok: true, ...out });
      }
      const work = runPull(token).catch(e => console.error('goal-sync pull failed', e));
      // @ts-ignore EdgeRuntime provided by the Supabase edge runtime
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) { EdgeRuntime.waitUntil(work); } else { await work; }
      return json({ accepted: true }, 202);
    }
    if (action === 'status') return await doStatus(token, body);
    if (action === 'comment') return await doComment(token, body);
    if (action === 'comment_edit') return await doCommentEdit(token, body);
    if (action === 'comment_delete') return await doCommentDelete(token, body);
    return json({ ok: false, error: 'unknown action' }, 400);
  } catch (e) {
    console.error('goal-sync failed', e);
    return json({ ok: false, error: String(e) }, 500);
  }
});
