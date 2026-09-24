// Welfare Avenue: process-transcript (v7, 24/09/26)
// v7: Program Development is its own team (key 'progdev'). Labels renamed:
// Operations Montreal, Operations Toronto, Fundraising and Finances. deptKey
// maps the new upload labels; the old combined labels still map to Ops
// Montreal. Slack notices link to the new team page. Nothing else changed from v6.
// v6: project routing. Every new task is labeled with a project_id from the
// projects table (tasks flow into projects; projects flow into goals). The
// model receives all active projects with their descriptions as routing hints
// and assigns a project only when the task clearly belongs to it, preferring
// this department's projects but crossing departments for named initiatives
// (a marketing task promoting Flag Football belongs to Flag Football 2026).
// Unrouted tasks stay in the department's general list (project_id null). The
// RPC validates ids against active projects.
// v5: serving event task routing for operations transcripts. For Ops Montreal
// and Ops Toronto, the model labels every new task with event_routing:
// 'event' when the task is preparation or follow up for a regular biweekly
// Sunday serving event, 'adhoc' for everything else. Event tasks are inserted
// into sop_event_extras against the correct upcoming serving event. Guards: a
// board_only run routes nothing, confidential tasks stay in dept_tasks, an
// insert failure falls back to the ad hoc list, and a department with no
// upcoming serving events falls back entirely. Routed tasks are stripped from
// the RPC payload. [test] in the title skips Slack.
// v4: board_only confidentiality tier (transcript flag OR classifier).
// v3: evidence based, conservative close-out detection.
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
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const DEPT_LABEL: Record<string, string> = {
  opsmtl: 'Operations Montreal', progdev: 'Program Development', opsto: 'Operations Toronto', marketing: 'Marketing',
  fundraising: 'Fundraising and Finances', hr: 'Human Resources', board: 'Board and Governance',
};

function deptKey(d: string): string | null {
  const s = (d || '').toLowerCase();
  if (s === 'progdev' || (s.includes('program dev') && !s.includes('montreal') && !s.includes('toronto') && !s.includes('ops'))) return 'progdev';
  if (s === 'opsmtl' || s.includes('montreal')) return 'opsmtl';
  if (s === 'opsto' || s.includes('toronto')) return 'opsto';
  if (s.includes('marketing')) return 'marketing';
  if (s.includes('fundrais') || s.includes('grant')) return 'fundraising';
  if (s === 'hr' || s.includes('human')) return 'hr';
  if (s.includes('board')) return 'board';
  return null;
}

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}

async function authorize(req: Request): Promise<{ ok: boolean; who: string }> {
  try {
    const given = req.headers.get('x-wa-secret');
    if (given && given === (await getSecret('WA_TRIGGER_SECRET'))) return { ok: true, who: 'system' };
  } catch (_) { /* fall through */ }
  const authHeader = req.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data } = await asUser.auth.getUser();
    const email = (data?.user?.email || '').toLowerCase();
    if (email.endsWith('@welfareavenue.com')) return { ok: true, who: email };
  }
  return { ok: false, who: '' };
}

async function siteUrl(): Promise<string> {
  const { data } = await svc.from('app_config').select('value').eq('key', 'site_url').maybeSingle();
  return data?.value || 'https://wa-exec-dashboard.netlify.app';
}

async function postSlack(text: string) {
  try {
    const url = await getSecret('SLACK_WEBHOOK_URL');
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  } catch (e) { console.error('slack post failed', e); }
}

const SYSTEM = `You maintain the Welfare Avenue executive status board, used by co executive directors Steel and Suhaib to run a fast growing charity across Montreal and Toronto. You read one meeting transcript and return the exact changes for that department via the tool. You do not just summarize: you act on the board, opening new work and, when the evidence is clear, closing finished work.

Rules:
1. Never use em dashes in any text you produce. Use commas, colons, parentheses, or the word "to" for ranges.
2. Executive tone: concise, specific, energetic where it counts.
3. Never invent people. Assignees must be names from the roster provided. Otter transcripts garble names (for example Suhaib can appear as Suheb). Map a spoken name to a roster name only when confident; otherwise keep the transcript spelling and it will be flagged as verify name.
4. Review the numbered open task list against the transcript, item by item, and be CONSERVATIVE about closing. Include a task in close_tasks only when the transcript clearly states the work is done, shipped, delivered, resolved, signed, hired, or explicitly no longer needed (cancelled or dropped). When in doubt, do not close: a task that is merely discussed, in progress, partially done, or planned stays open. For each closure provide evidence: a short quote or close paraphrase from the transcript that proves the task is complete, plus the exact task_id from the numbered list. Never close a task on inference alone, and never remove or rewrite existing tasks; only add or close.
5. Raise a new executive decision only when a call needs Steel or Suhaib personally. Every new decision needs reason_category and a one line reason_note. Categories: Budget or purchase; Hiring or people; Legal, risk, or governance; Strategy or direction; Partnership or external; Ethics or policy. Use a better fitting short category only if none apply. Flagged tasks (flag true) need the same two fields.
6. progress: an updated 2 to 4 sentence paragraph for the department, keeping prior content that is still true. read: only update if team mood or energy clearly shifted; otherwise null. priorities: 2 to 4 short items, or null to keep current.
7. new_updates: 1 to 3 new update entries summarizing what the meeting moved, label like "Jul 2 (Otter)".
8. due_date only when the transcript states or strongly implies a date (ISO format).
9. subsection must be exactly one of the provided workstream names, or null.
10. mark confidential true on anything about succession, individual performance, or personnel issues.
11. Reconcile the open executive decisions list the same way: if the transcript shows a decision was made, include its id in decide_decisions with a short decided_note quoting the call that was made.
12. summary: one line, under 25 words, stating what changed, counting closures.
13. board_sensitive: set true when the transcript contains board only content: leadership departures or succession (for example a founder or co executive director stepping back or leaving), personnel performance or discipline, individual compensation, legal disputes, or anything explicitly marked board only or for the board only. When unsure, err toward true.
14. Event routing (Ops Montreal and Ops Toronto only): give every new task an event_routing value. Use "event" when the task is preparation or follow up for one of the regular biweekly Sunday serving events: volunteer confirmations and recruitment for that Sunday, cooking, groceries and supplies, packing, distribution day logistics, standard operating procedure steps. Use "adhoc" for everything else, including special one off or corporate volunteering events, partnerships, admin, marketing, and anything not tied to a regular serving Sunday. When the transcript states which serving date a task is for, set event_date to that ISO date, preferring a date listed in upcoming_serving_events; otherwise leave event_date null and the task attaches to the next serving event. For all other departments use "adhoc".
15. Project routing: the context lists the organization's projects with descriptions. Give every new task a project_id when the task clearly belongs to that project based on the project's name and description. Prefer projects from this department, but use another department's project when the task is clearly part of that named initiative (for example a marketing task promoting the flag football tournament belongs to the Flag Football 2026 project). When no project fits, use null: the task lands in the department's general list. Never invent a project_id that is not in the list. Event routed tasks (rule 14) do not need a project_id.`;

const TOOL = {
  name: 'apply_department_update',
  description: 'Apply the transcript findings to the department status board.',
  input_schema: {
    type: 'object',
    properties: {
      read: { type: ['string', 'null'] },
      progress: { type: ['string', 'null'] },
      priorities: { type: ['array', 'null'], items: { type: 'string' } },
      new_updates: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, text: { type: 'string' } }, required: ['label', 'text'] } },
      new_tasks: { type: 'array', items: { type: 'object', properties: {
        title: { type: 'string' }, subsection: { type: ['string', 'null'] }, owner: { type: 'string' },
        assignees: { type: 'array', items: { type: 'string' } }, due_date: { type: ['string', 'null'] },
        flag: { type: 'boolean' }, reason_category: { type: ['string', 'null'] }, reason_note: { type: ['string', 'null'] },
        status: { type: 'string' }, confidential: { type: 'boolean' },
        event_routing: { type: 'string', enum: ['event', 'adhoc'], description: 'For operations departments: "event" when the task belongs to a regular biweekly Sunday serving event, "adhoc" otherwise (including special or corporate volunteering events). Other departments: "adhoc".' },
        event_date: { type: ['string', 'null'], description: 'ISO date of the specific serving event this task is for, only when the transcript states it. Prefer a date from upcoming_serving_events. Null when unstated.' },
        project_id: { type: ['integer', 'null'], description: 'Id from the projects list this task belongs to, or null for the department general list. Only use ids from the provided projects list.' } }, required: ['title', 'owner', 'flag'] } },
      close_tasks: { type: 'array', description: 'Open tasks the transcript proves are complete or no longer needed. Be conservative: when in doubt, leave the task open.', items: { type: 'object', properties: {
        task_id: { type: 'integer', description: 'The task_id from the numbered open task list.' },
        evidence: { type: 'string', description: 'A short quote or close paraphrase from the transcript proving the task is done or no longer needed.' } },
        required: ['task_id', 'evidence'] } },
      new_decisions: { type: 'array', items: { type: 'object', properties: {
        title: { type: 'string' }, area: { type: 'string' }, suggested_move: { type: 'string' },
        owner: { type: ['string', 'null'], description: 'Steel, Suhaib, or Both' },
        reason_category: { type: 'string' }, reason_note: { type: 'string' }, confidential: { type: 'boolean' } },
        required: ['title', 'area', 'suggested_move', 'reason_category', 'reason_note'] } },
      decide_decisions: { type: 'array', items: { type: 'object', properties: { id: { type: 'integer' }, decided_note: { type: 'string' } }, required: ['id', 'decided_note'] } },
      board_sensitive: { type: 'boolean', description: 'True when the transcript contains board only content: leadership departures or succession, personnel performance or discipline, individual compensation, legal disputes, or anything explicitly marked board only. Err toward true when unsure.' },
      summary: { type: 'string' }
    },
    required: ['summary', 'new_updates', 'new_tasks', 'close_tasks', 'new_decisions', 'decide_decisions', 'board_sensitive']
  }
};

const MODELS = ['claude-sonnet-5', 'claude-sonnet-4-5', 'claude-sonnet-4-20250514'];

async function callAnthropic(context: unknown, transcriptText: string): Promise<Record<string, unknown>> {
  const key = await getSecret('ANTHROPIC_API_KEY');
  const userContent = 'CONTEXT (current board state, JSON):\n' + JSON.stringify(context) +
    '\n\nTRANSCRIPT:\n' + transcriptText.slice(0, 30000);
  let lastErr = '';
  for (const model of MODELS) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: 3500, temperature: 0.2, system: SYSTEM,
        messages: [{ role: 'user', content: userContent }],
        tools: [TOOL], tool_choice: { type: 'tool', name: 'apply_department_update' }
      })
    });
    if (res.ok) {
      const body = await res.json();
      const tu = (body.content || []).find((c: { type: string }) => c.type === 'tool_use');
      if (tu?.input) return tu.input as Record<string, unknown>;
      lastErr = 'no tool_use block returned';
      continue;
    }
    lastErr = res.status + ' ' + (await res.text()).slice(0, 300);
    if (res.status !== 404 && res.status !== 400) break;
  }
  throw new Error('Anthropic call failed: ' + lastErr);
}

type CloseItem = { task_id?: unknown; evidence?: unknown };

async function applyCloseTasks(result: Record<string, unknown>, dept: string, changedBy: string, boardOnly: boolean): Promise<Array<{ id: number; title: string }>> {
  const items = Array.isArray(result.close_tasks) ? (result.close_tasks as CloseItem[]) : [];
  const closed: Array<{ id: number; title: string }> = [];
  for (const item of items) {
    const taskId = Number(item?.task_id);
    if (!Number.isInteger(taskId) || taskId <= 0) continue;
    const evidence = String(item?.evidence || '').slice(0, 600);
    const { data: task, error: fetchErr } = await svc.from('dept_tasks')
      .select('id, title, done, department').eq('id', taskId).maybeSingle();
    if (fetchErr || !task) { console.warn('close skipped, task not found', taskId); continue; }
    if (task.done !== false || task.department !== dept) {
      console.warn('close skipped, task not open in this department', taskId);
      continue;
    }
    const nowIso = new Date().toISOString();
    const { error: updErr } = await svc.from('dept_tasks')
      .update({ done: true, closed_at: nowIso, updated_at: nowIso, updated_by: changedBy, reason_note: evidence || null })
      .eq('id', taskId).eq('done', false);
    if (updErr) { console.error('close update failed', taskId, updErr); continue; }
    const { error: logErr } = await svc.from('change_log').insert({
      entity_type: 'task', entity_id: String(taskId), field: 'done',
      old_value: 'false', new_value: 'true (closed from transcript)', changed_by: changedBy,
      board_only: boardOnly,
    });
    if (logErr) console.error('change_log insert failed for closed task', taskId, logErr);
    closed.push({ id: taskId, title: task.title });
  }
  return closed;
}

type EventRow = { id: number; code: string | null; event_date: string; status: string | null; location: string | null; kind: string | null };

async function loadUpcomingServingEvents(dept: string, fromDate: string): Promise<EventRow[]> {
  const { data, error } = await svc.from('volunteer_events')
    .select('id, code, event_date, status, location, kind')
    .eq('kind', 'service')
    .neq('status', 'cancelled')
    .gte('event_date', fromDate)
    .order('event_date', { ascending: true })
    .limit(8);
  if (error || !data) { if (error) console.error('upcoming events load failed', error); return []; }
  return (data as EventRow[]).filter(e => {
    const l = (e.location || '').toLowerCase();
    return dept === 'opsto' ? l.includes('toronto') : (l === '' || l.includes('montreal'));
  });
}

function pickEvent(events: EventRow[], hint: unknown): EventRow | null {
  if (!events.length) return null;
  const h = typeof hint === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(hint) ? hint : null;
  if (h) {
    const exact = events.find(e => e.event_date === h);
    if (exact) return exact;
    const ht = Date.parse(h + 'T12:00:00Z');
    let best: EventRow | null = null;
    let bestDiff = Infinity;
    for (const e of events) {
      const d = Math.abs(Date.parse(e.event_date + 'T12:00:00Z') - ht);
      if (d < bestDiff) { bestDiff = d; best = e; }
    }
    if (best && bestDiff <= 10 * 86400000) return best;
  }
  return events[0];
}

async function processTranscript(transcriptId: number) {
  const { data: tx, error } = await svc.from('transcripts').select('*').eq('id', transcriptId).single();
  if (error || !tx) throw new Error('transcript not found');
  if (!tx.body || tx.body.trim().length < 40) throw new Error('transcript body too short to process');
  const dept = deptKey(tx.department);
  if (!dept) throw new Error('unknown department: ' + tx.department);

  const [metaQ, tasksQ, decQ, rosterQ, projQ] = await Promise.all([
    svc.from('dept_meta').select('read, progress, priorities').eq('department', dept).maybeSingle(),
    svc.from('dept_tasks').select('id, title, subsection, owner, status, due_date, flag').eq('department', dept).eq('done', false),
    svc.from('decisions').select('id, title, area, owner').eq('done', false),
    svc.from('team_members').select('name, role').eq('department', dept).eq('active', true),
    svc.from('projects').select('id, name, description, department, parent_id, goal_id').eq('status', 'active').order('department').order('sort'),
  ]);
  const subsections = [...new Set((tasksQ.data || []).map(t => t.subsection).filter(Boolean))];

  const openTasksNumbered = (tasksQ.data || []).map((t, i) =>
    (i + 1) + '. task_id ' + t.id + ': ' + t.title +
    ' (owner: ' + (t.owner || 'unassigned') + (t.subsection ? ', workstream: ' + t.subsection : '') + ')'
  ).join('\n');

  const upcomingEvents = (dept === 'opsmtl' || dept === 'opsto')
    ? await loadUpcomingServingEvents(dept, tx.meeting_date || new Date().toISOString().slice(0, 10))
    : [];

  // v6: project catalog with parent names resolved, as routing hints.
  const projRows = (projQ.data || []) as Array<{ id: number; name: string; description: string | null; department: string; parent_id: number | null; goal_id: number | null }>;
  const projName = new Map<number, string>(projRows.map(p => [p.id, p.name]));
  const projects = projRows.map(p => ({
    project_id: p.id,
    department: p.department,
    name: (p.parent_id && projName.get(p.parent_id) ? projName.get(p.parent_id) + ' > ' : '') + p.name,
    description: p.description || '',
  }));

  const context = {
    department: dept,
    department_label: DEPT_LABEL[dept],
    meeting_title: tx.title, meeting_date: tx.meeting_date,
    overview: metaQ.data || {},
    workstreams: subsections,
    open_tasks: tasksQ.data || [],
    open_tasks_numbered_list: openTasksNumbered,
    open_executive_decisions: decQ.data || [],
    roster: rosterQ.data || [],
    upcoming_serving_events: upcomingEvents.map(e => e.event_date + (e.code ? ' (' + e.code + ')' : '')),
    projects,
    note: 'Steel MacDonald and Suhaib are the co executive directors and are always valid owners.'
  };

  const result = await callAnthropic(context, tx.body);
  const changedBy = 'AI: ' + (tx.title || 'transcript ' + transcriptId);

  const boardSensitive = result.board_sensitive === true;
  const effectiveBoardOnly = tx.board_only === true || boardSensitive;
  if (boardSensitive && tx.board_only !== true) {
    const { error: flagErr } = await svc.from('transcripts').update({ board_only: true }).eq('id', transcriptId);
    if (flagErr) console.error('failed to set transcripts.board_only', flagErr);
  }

  const runStartIso = new Date(Date.now() - 60000).toISOString();

  const allNew = Array.isArray(result.new_tasks) ? (result.new_tasks as Array<Record<string, unknown>>) : [];
  const routed: Array<{ event: EventRow; title: string }> = [];
  let remainingNew = allNew;
  if ((dept === 'opsmtl' || dept === 'opsto') && !effectiveBoardOnly && allNew.length && upcomingEvents.length) {
    const keep: Array<Record<string, unknown>> = [];
    for (const t of allNew) {
      const isEvent = t.event_routing === 'event' && t.confidential !== true;
      const target = isEvent ? pickEvent(upcomingEvents, t.event_date) : null;
      if (!isEvent || !target) { keep.push(t); continue; }
      const detail = 'From "' + (tx.title || 'operations meeting') + '"' +
        (tx.meeting_date ? ' (' + tx.meeting_date + ')' : '') +
        (t.reason_note ? '. ' + String(t.reason_note) : '');
      const { error: exErr } = await svc.from('sop_event_extras').insert({
        event_id: target.id,
        title: String(t.title || '').slice(0, 300),
        detail: detail.slice(0, 600),
        owner: String(t.owner || '') || null,
        due_date: (typeof t.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date)) ? t.due_date : null,
        done: false,
        source: 'transcript',
        transcript_id: transcriptId,
      });
      if (exErr) { console.error('event extra insert failed, falling back to ad hoc', exErr); keep.push(t); continue; }
      routed.push({ event: target, title: String(t.title || '') });
    }
    remainingNew = keep;
  }

  const rpcPayload = { ...result, new_tasks: remainingNew, close_task_ids: [] };
  const { data: applied, error: applyErr } = await svc.rpc('apply_transcript_result', {
    p_transcript_id: transcriptId, p: rpcPayload, p_changed_by: changedBy,
  });
  if (applyErr) throw new Error('apply failed: ' + applyErr.message);

  if (effectiveBoardOnly) {
    const stamps = await Promise.all([
      svc.from('dept_updates').update({ board_only: true }).eq('added_by', changedBy).gte('created_at', runStartIso),
      svc.from('dept_tasks').update({ board_only: true }).eq('updated_by', changedBy).gte('opened_at', runStartIso),
      svc.from('decisions').update({ board_only: true }).eq('raised_by', changedBy).gte('opened_at', runStartIso),
      svc.from('change_log').update({ board_only: true }).eq('changed_by', changedBy).gte('changed_at', runStartIso),
    ]);
    stamps.forEach((s, i) => { if (s.error) console.error('board_only stamp failed for table index ' + i, s.error); });
  }

  const closed = await applyCloseTasks(result, dept, changedBy, effectiveBoardOnly);

  // v6: count how many of this run's kept tasks landed in projects.
  const projectedCount = remainingNew.filter(t => Number.isInteger(t.project_id as number) && (t.project_id as number) > 0).length;

  const site = await siteUrl();
  const label = DEPT_LABEL[dept];
  const r = applied as Record<string, number>;
  const parts: string[] = [];
  if (r.tasks_added) parts.push(r.tasks_added + (r.tasks_added === 1 ? ' new task' : ' new tasks') + (projectedCount ? ' (' + projectedCount + ' into projects)' : ''));
  if (routed.length) parts.push(routed.length + (routed.length === 1 ? ' serving event task' : ' serving event tasks'));
  if (closed.length) parts.push(closed.length + ' closed');
  const newDecs = (result.new_decisions as Array<Record<string, string>>) || [];
  if (r.decisions_added) {
    const cats = [...new Set(newDecs.map(d => d.reason_category).filter(Boolean))];
    parts.push(r.decisions_added + (r.decisions_added === 1 ? ' new decision' : ' new decisions') + (cats.length ? ' (' + cats.join('; ') + ')' : ''));
  }
  if (r.decisions_decided) parts.push(r.decisions_decided + ' decided');
  if (r.updates) parts.push(r.updates + (r.updates === 1 ? ' update' : ' updates'));
  const dateStr = tx.meeting_date ? new Date(tx.meeting_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'recent';
  const attention = newDecs.some(d => /budget|legal/i.test(d.reason_category || '')) ? '\n:small_orange_diamond: A Budget or Legal item needs executive attention.' : '';
  let eventLine = '';
  if (routed.length) {
    const byEvent = new Map<number, { event: EventRow; n: number }>();
    routed.forEach(x => { const cur = byEvent.get(x.event.id); if (cur) cur.n += 1; else byEvent.set(x.event.id, { event: x.event, n: 1 }); });
    const bits = [...byEvent.values()].map(v =>
      v.n + ' to the <' + site + '#volunteering/e/' + v.event.id + '|' + v.event.event_date + ' serving event>');
    eventLine = '\n:spiral_calendar_pad: Event tasks routed: ' + bits.join(', ') + '.';
  }
  const isTest = /\[test\]/i.test(tx.title || '');
  if (!isTest) {
    await postSlack(':large_green_circle: *Welfare Avenue Dashboard*\n*' + label + '* updated from the ' + dateStr + ' meeting: ' + (parts.join(', ') || 'no board changes needed') + '.' + attention + eventLine + '\n<' + site + '#team/' + dept + '|Open the ' + label + ' page>');
  }
  return { ...(applied as Record<string, unknown>), tasks_closed: closed.length, closed_tasks: closed, tasks_routed: routed.length, routed_events: [...new Set(routed.map(x => x.event.id))], tasks_projected: projectedCount };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const auth = await authorize(req);
  if (!auth.ok) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const transcriptId = Number(body.transcript_id);
  if (!transcriptId) return json({ error: 'transcript_id required' }, 400);

  const work = processTranscript(transcriptId).catch(async (e) => {
    console.error('processing failed', e);
    await svc.from('transcripts').update({ ai_summary: 'Processing failed: ' + String(e.message || e).slice(0, 200) }).eq('id', transcriptId);
  });
  // @ts-ignore EdgeRuntime is provided by the Supabase edge runtime
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) { EdgeRuntime.waitUntil(work); } else { await work; }
  return json({ accepted: true, transcript_id: transcriptId }, 202);
});
