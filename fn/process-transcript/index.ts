// v13 (26/09/26): the bank. A task the meeting puts off by three months or more still comes out of the meeting, with bank_until
// (the date it should come back) and bank_reason: apply_transcript_result puts it straight in the bank, out of every board and
// count, and the daily job brings it back on its date. Banked tasks are marked in the open task list so the model does not add
// them again; unbank_task_ids brings one back when the meeting starts it now. The Slack line counts what was banked.
// Projects in the bank are left out of the project list (a new task never lands in one out of sight).
// v10 (25/09/26): every new task carries a description and a priority, relative due dates resolve from the meeting date, Jev checks the project each task landed in. v8: routed through the Hub model router (llm, task transcript_extract; Sonnet 5 first) and every extracted item gets a Jev second opinion (jevCheck).
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
8. due_date only when the transcript states or strongly implies a date, resolved to ISO with calendar_after_meeting (one line per day after the meeting, with its weekday): "by Friday" is the first Friday after the meeting, "next week" is the Friday of the following week, "end of the month" is the last day of that month, "before the event on the 12th" is the day before, "in two weeks" is meeting date plus 14 days. No date when timing is vague ("soon", "at some point").
8b. description: every new task gets 2 to 4 plain sentences a colleague could act on without having been in the meeting: what exactly needs doing, why (the context from the discussion), what done looks like, and any names, numbers, places or links mentioned. Use "- " bullets for lists of items. Never pad; never invent.
8c. priority true only when the meeting clearly treats the task as urgent or the top priority ("this has to happen this week", "top priority", "blocking"), else false.
9. subsection must be exactly one of the provided workstream names, or null.
10. mark confidential true on anything about succession, individual performance, or personnel issues.
11. Reconcile the open executive decisions list the same way: if the transcript shows a decision was made, include its id in decide_decisions with a short decided_note quoting the call that was made.
12. summary: one line, under 25 words, stating what changed, counting closures.
13. board_sensitive: set true when the transcript contains board only content: leadership departures or succession (for example a founder or co executive director stepping back or leaving), personnel performance or discipline, individual compensation, legal disputes, or anything explicitly marked board only or for the board only. When unsure, err toward true.
14. Event routing (Ops Montreal and Ops Toronto only): give every new task an event_routing value. Use "event" when the task is preparation or follow up for one of the regular biweekly Sunday serving events: volunteer confirmations and recruitment for that Sunday, cooking, groceries and supplies, packing, distribution day logistics, standard operating procedure steps. Use "adhoc" for everything else, including special one off or corporate volunteering events, partnerships, admin, marketing, and anything not tied to a regular serving Sunday. When the transcript states which serving date a task is for, set event_date to that ISO date, preferring a date listed in upcoming_serving_events; otherwise leave event_date null and the task attaches to the next serving event. For all other departments use "adhoc".
15. Project routing: the context lists the organization's projects with descriptions. Give every new task a project_id when the task clearly belongs to that project based on the project's name and description. Prefer projects from this department, but use another department's project when the task is clearly part of that named initiative (for example a marketing task promoting the flag football tournament belongs to the Flag Football 2026 project). When no project fits, use null: the task lands in the department's general list. Never invent a project_id that is not in the list. Event routed tasks (rule 14) do not need a project_id.
16. The bank: when the meeting clearly puts a piece of work off by three months or more ("in the spring", "next year", "after the gala in March", "park it until the new fiscal year", "not before January"), still add it as a new task, but set bank_until to the ISO date it should come back (the first day of the month or season named; three to six months after the meeting when the timing is vague) and bank_reason to one short line saying why it waits. It goes to the bank instead of the board and comes back on that date. Work for the next three months is never banked, and a date alone is not a reason to bank. Tasks marked "(in the bank until ...)" in the numbered open task list are already banked: never add them again; close one only with the same evidence rule; list its task_id in unbank_task_ids only when the meeting says to start it now.`;

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
        description: { type: 'string', description: '2 to 4 plain sentences: what needs doing, why, what done looks like, names, numbers, places, links from the meeting. Use "- " bullets for lists. No em dashes.' },
        priority: { type: 'boolean', description: 'True only when the meeting treats it as urgent or the top priority.' },
        status: { type: 'string' }, confidential: { type: 'boolean' },
        event_routing: { type: 'string', enum: ['event', 'adhoc'], description: 'For operations departments: "event" when the task belongs to a regular biweekly Sunday serving event, "adhoc" otherwise (including special or corporate volunteering events). Other departments: "adhoc".' },
        event_date: { type: ['string', 'null'], description: 'ISO date of the specific serving event this task is for, only when the transcript states it. Prefer a date from upcoming_serving_events. Null when unstated.' },
        project_id: { type: ['integer', 'null'], description: 'Id from the projects list this task belongs to, or null for the department general list. Only use ids from the provided projects list.' },
        bank_until: { type: ['string', 'null'], description: 'Rule 16: only when the meeting puts this work off by three months or more. The ISO date it should come back. Null for everything else.' },
        bank_reason: { type: ['string', 'null'], description: 'Rule 16: one short line on why it waits (for example "After the March gala"). Null when not banked.' } }, required: ['title', 'owner', 'flag', 'description', 'priority'] } },
      unbank_task_ids: { type: 'array', items: { type: 'integer' }, description: 'Rule 16: task_ids of tasks marked "(in the bank until ...)" that the meeting says to start now. Usually empty.' },
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
  const key = 'hub-router';
  const userContent = 'CONTEXT (current board state, JSON):\n' + JSON.stringify(context) +
    '\n\nTRANSCRIPT:\n' + transcriptText.slice(0, 30000);
  let lastErr = '';
  for (const model of MODELS) {
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'x-wa-task': 'transcript_extract',
        'x-wa-caller': 'process-transcript',
        'Content-Type': 'application/json'
      },
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

/* ---- Jev checks every extracted item against the transcript (25/09/26) ----
   OpenRouter's decision model reads the lines of the transcript that mention
   the item and answers: is this a real commitment, is the owner right, is
   the due date stated. Weak items are dropped, wrong owners corrected when
   Jev is confident, unsupported due dates cleared. Cheap (a fraction of a
   cent per transcript) and it never blocks the run: any failure keeps the
   model's output as it was. */
type JevAnswer = { type: string; choice?: string; noul?: number; score?: number; confidence?: number; probabilities?: Record<string, number> };
async function jev(state: unknown, questions: Record<string, unknown>): Promise<Record<string, JevAnswer> | null> {
  try {
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + SERVICE_KEY, 'x-wa-task': 'transcript_extract', 'x-wa-caller': 'process-transcript', 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, questions })
    });
    if (!res.ok) return null;
    const out = await res.json();
    return (out && out.answers) ? out.answers as Record<string, JevAnswer> : null;
  } catch (_) { return null; }
}
const STOP = new Set(['with', 'from', 'that', 'this', 'will', 'have', 'about', 'their', 'them', 'they', 'into', 'need', 'needs', 'make', 'send', 'follow', 'update', 'check', 'week', 'next', 'team', 'meeting']);
function excerpt(text: string, needles: string[], max = 3500): string {
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const keys = [...new Set(needles.join(' ').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !STOP.has(w)))];
  if (!keys.length) return text.slice(0, max);
  const scored = lines.map((l, i) => ({ i, s: keys.reduce((a, k) => a + (l.toLowerCase().includes(k) ? 1 : 0), 0) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 10).sort((a, b) => a.i - b.i);
  let out = ''; const seen = new Set<number>();
  for (const x of scored) {
    const bits: string[] = [];
    for (let j = Math.max(0, x.i - 1); j <= Math.min(lines.length - 1, x.i + 1); j++) { if (!seen.has(j)) { seen.add(j); bits.push(lines[j]); } }
    const chunk = bits.join('\n');
    if (out.length + chunk.length > max) break;
    out += chunk + '\n...\n';
  }
  return out || text.slice(0, max);
}
function noul(a: JevAnswer | undefined): number | null { return a && typeof a.noul === 'number' ? a.noul : null; }
type JevReport = { checked: number; dropped: string[]; owners: string[]; due_cleared: number; decisions_dropped: string[]; closes_dropped: number; skipped: boolean; projects: string[] };
type ProjRow = { id: number; name: string; description: string | null; department: string | null; parent_id: number | null };
/* the three weeks after the meeting, one line a day, so "by Thursday" resolves to the right date */
function calendarStrip(meetingDate: string | null): string[] {
  if (!meetingDate || !/^\d{4}-\d{2}-\d{2}$/.test(meetingDate)) return [];
  const out: string[] = [];
  for (let i = 0; i <= 21; i++) { const d = new Date(meetingDate + 'T12:00:00'); d.setDate(d.getDate() + i); out.push(d.toISOString().slice(0, 10) + ' ' + d.toLocaleDateString('en-CA', { weekday: 'long' }) + (i === 0 ? ' (the meeting)' : '')); }
  return out;
}
async function jevCheck(result: Record<string, unknown>, transcript: string, roster: string[], meetingLabel: string, projs: ProjRow[], dept: string, meetingDateIso: string | null): Promise<JevReport> {
  const rep: JevReport = { checked: 0, dropped: [], owners: [], due_cleared: 0, decisions_dropped: [], closes_dropped: 0, skipped: false, projects: [] };
  const tasks = Array.isArray(result.new_tasks) ? (result.new_tasks as Array<Record<string, unknown>>) : [];
  const keep: Array<Record<string, unknown>> = [];
  let failures = 0;
  for (const t of tasks.slice(0, 30)) {
    const title = String(t.title || ''); const owner = String(t.owner || ''); const due = typeof t.due_date === 'string' ? t.due_date : null;
    const ex = excerpt(transcript, [title, owner, ...(Array.isArray(t.assignees) ? t.assignees.map(String) : [])]);
    const firsts = roster.map(n => n.split(' ')[0].toLowerCase());
    const mentioned = roster.filter((n, i) => ex.toLowerCase().includes(firsts[i]));
    const cands = [...new Set([owner, ...(Array.isArray(t.assignees) ? t.assignees.map(String) : []), ...mentioned])].filter(Boolean).slice(0, 14);
    const criteria: Record<string, string> = {}; cands.forEach((c, i) => { criteria['p' + i] = c; });
    const questions: Record<string, unknown> = {
      real: { type: 'noul', instructions: 'Did someone in the meeting actually commit to doing this (an action item agreed in the conversation), rather than a passing mention, a question, an idea floated, or something already finished?' },
      owner_ok: { type: 'noul', instructions: 'According to the excerpt, is "' + owner + '" the person who took this on?' },
    };
    if (cands.length > 1) questions.owner = { type: 'choice', instructions: 'Who took this on, according to the excerpt?', criteria };
    if (due) questions.due_ok = { type: 'noul', instructions: 'Does the excerpt state or strongly imply the due date ' + due + ' for this item (a named day, "by Friday", "before the event on the 12th"), checked against the calendar given? Vague timing, or a different day than the calendar gives, does not count.' };
    /* the project it landed in: the model's pick against the department's other projects */
    const pickedP = t.project_id ? projs.find(p => Number(p.id) === Number(t.project_id)) : null;
    const pool = projs.filter(p => p.department === dept || (pickedP && p.id === pickedP.id)).slice(0, 10);
    const pcrit: Record<string, string> = { none: 'No project: the department\u2019s general list' };
    pool.forEach(p => { pcrit['pr' + p.id] = p.name + (p.description ? ': ' + String(p.description).slice(0, 120) : ''); });
    if (pool.length) questions.project = { type: 'choice', instructions: 'Which project does this task belong to? Pick "none" unless the task is clearly part of one.', criteria: pcrit };
    const ans = await jev({ meeting: meetingLabel, item: { title, owner, assignees: t.assignees || [], due_date: due, workstream: t.subsection || null }, transcript_excerpt: ex, calendar_after_meeting: due ? calendarStrip(meetingDateIso).slice(0, 15) : undefined, note: 'Names in the roster are the only valid owners.' }, questions);
    if (!ans) { failures += 1; keep.push(t); if (failures >= 3) { rep.skipped = true; keep.push(...tasks.slice(keep.length)); break; } continue; }
    rep.checked += 1;
    const real = noul(ans.real);
    if (real !== null && real < 0.3) { rep.dropped.push(title); continue; }
    const ok = noul(ans.owner_ok);
    const pick = ans.owner && ans.owner.choice ? criteria[ans.owner.choice] : null;
    if (pick && pick !== owner && ok !== null && ok < 0.4 && typeof ans.owner.confidence === 'number' && ans.owner.confidence >= 0.6 && roster.some(n => n.toLowerCase() === pick.toLowerCase())) {
      rep.owners.push(title + ': ' + owner + ' > ' + pick); t.owner = pick;
    }
    const dueOk = noul(ans.due_ok);
    if (due && dueOk !== null && dueOk < 0.3) { t.due_date = null; rep.due_cleared += 1; }
    if (ans.project && typeof ans.project.choice === 'string' && typeof ans.project.confidence === 'number' && ans.project.confidence >= 0.75) {
      const cur = t.project_id ? 'pr' + t.project_id : 'none';
      const ch = ans.project.choice;
      const probs = ans.project.probabilities || {};
      const curP = typeof probs[cur] === 'number' ? probs[cur] : 0;
      if (ch !== cur && curP < 0.25) {
        const newId = ch === 'none' ? null : Number(ch.replace('pr', ''));
        const np = newId ? projs.find(p => Number(p.id) === newId) : null;
        rep.projects.push(title + ': ' + (pickedP ? pickedP.name : 'general') + ' > ' + (np ? np.name : 'general'));
        t.project_id = newId;
      }
    }
    keep.push(t);
  }
  if (tasks.length > 30) keep.push(...tasks.slice(30));
  result.new_tasks = keep;
  if (rep.skipped) return rep;
  const decs = Array.isArray(result.new_decisions) ? (result.new_decisions as Array<Record<string, unknown>>) : [];
  const keepD: Array<Record<string, unknown>> = [];
  for (const d of decs.slice(0, 12)) {
    const title = String(d.title || '');
    const ans = await jev({ meeting: meetingLabel, decision: { title, why: d.reason_note || null, category: d.reason_category || null }, transcript_excerpt: excerpt(transcript, [title, String(d.reason_note || '')]) },
      { needs_exec: { type: 'noul', instructions: 'Does the excerpt show a call that only the co executive directors (Steel or Suhaib) can make (money, hiring, legal, strategy, partnerships, policy), rather than something the team can decide itself or has already decided?' } });
    if (!ans) { keepD.push(d); continue; }
    rep.checked += 1;
    const v = noul(ans.needs_exec);
    if (v !== null && v < 0.3) { rep.decisions_dropped.push(title); continue; }
    keepD.push(d);
  }
  if (decs.length > 12) keepD.push(...decs.slice(12));
  result.new_decisions = keepD;
  const closes = Array.isArray(result.close_tasks) ? (result.close_tasks as Array<Record<string, unknown>>) : [];
  const keepC: Array<Record<string, unknown>> = [];
  for (const c of closes.slice(0, 15)) {
    const ev = String(c.evidence || '');
    const ans = await jev({ meeting: meetingLabel, close: { task_id: c.task_id, evidence: ev }, transcript_excerpt: excerpt(transcript, [ev]) },
      { done: { type: 'noul', instructions: 'Does the excerpt show this task is finished or no longer needed? Progress, plans or "almost done" do not count.' } });
    if (!ans) { keepC.push(c); continue; }
    rep.checked += 1;
    const v = noul(ans.done);
    if (v !== null && v < 0.5) { rep.closes_dropped += 1; continue; }
    keepC.push(c);
  }
  if (closes.length > 15) keepC.push(...closes.slice(15));
  result.close_tasks = keepC;
  return rep;
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

async function processTranscript(transcriptId: number, dryRun = false) {
  const { data: tx, error } = await svc.from('transcripts').select('*').eq('id', transcriptId).single();
  if (error || !tx) throw new Error('transcript not found');
  if (!tx.body || tx.body.trim().length < 40) throw new Error('transcript body too short to process');
  const dept = deptKey(tx.department);
  if (!dept) throw new Error('unknown department: ' + tx.department);

  const [metaQ, tasksQ, decQ, rosterQ, projQ] = await Promise.all([
    svc.from('dept_meta').select('read, progress, priorities').eq('department', dept).maybeSingle(),
    svc.from('dept_tasks').select('id, title, subsection, owner, status, due_date, flag, banked_at, bank_until').eq('department', dept).eq('done', false),
    svc.from('decisions').select('id, title, area, owner').eq('done', false),
    svc.from('team_members').select('name, role').eq('department', dept).eq('active', true),
    svc.from('projects').select('id, name, description, department, parent_id, goal_id').is('banked_at', null).eq('status', 'active').order('department').order('sort'),
  ]);
  const subsections = [...new Set((tasksQ.data || []).map(t => t.subsection).filter(Boolean))];

  const openTasksNumbered = (tasksQ.data || []).map((t, i) =>
    (i + 1) + '. task_id ' + t.id + ': ' + t.title +
    ' (owner: ' + (t.owner || 'unassigned') + (t.subsection ? ', workstream: ' + t.subsection : '') + ')' +
    (t.banked_at ? ' (in the bank until ' + (t.bank_until || 'later') + ')' : '')
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
    meeting_weekday: tx.meeting_date ? new Date(tx.meeting_date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long' }) : null,
    calendar_after_meeting: calendarStrip(tx.meeting_date),
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
  // Jev second opinion on every item (see jevCheck); the roster is whatever the context lists as valid owners
  const rosterNames: string[] = [...new Set([...(Array.isArray((context as { roster?: unknown }).roster) ? ((context as { roster: Array<Record<string, unknown>> }).roster).map(m => String(m.name || '')).filter(Boolean) : []), 'Steel MacDonald', 'Steel', 'Suhaib', 'Both'])];
  const jevRep = await jevCheck(result, tx.body, rosterNames, (tx.title || 'meeting') + (tx.meeting_date ? ' (' + tx.meeting_date + ')' : ''), projRows.map(p => ({ id: p.id, name: (p.parent_id && projName.get(p.parent_id) ? projName.get(p.parent_id) + ' > ' : '') + p.name, description: p.description, department: p.department, parent_id: p.parent_id })), dept, tx.meeting_date || null);

  if (dryRun) {
    /* preview: what the model and Jev would put on the board, nothing written */
    return { dry_run: true, department: dept, model_result: result, jev: jevRep };
  }
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

  // v13: banked tasks the meeting starts now come back on the board
  const bankedIds = new Set((tasksQ.data || []).filter(t => t.banked_at).map(t => Number(t.id)));
  const unbanked: number[] = [];
  for (const raw of (Array.isArray(result.unbank_task_ids) ? result.unbank_task_ids as unknown[] : []).slice(0, 10)) {
    const id = Number(raw);
    if (!Number.isInteger(id) || !bankedIds.has(id) || closed.some(c => c.id === id)) continue;
    const { error: ubErr } = await svc.rpc('bank_unbank_do', { p_kind: 'task', p_id: id, p_why: 'the meeting started it again (' + (tx.title || 'meeting') + ')', p_by: changedBy });
    if (ubErr) console.error('unbank failed', id, ubErr); else unbanked.push(id);
  }

  // v6: count how many of this run's kept tasks landed in projects.
  const projectedCount = remainingNew.filter(t => Number.isInteger(t.project_id as number) && (t.project_id as number) > 0).length;

  const site = await siteUrl();
  const label = DEPT_LABEL[dept];
  const r = applied as Record<string, number>;
  const parts: string[] = [];
  if (r.tasks_added) parts.push(r.tasks_added + (r.tasks_added === 1 ? ' new task' : ' new tasks') + (projectedCount ? ' (' + projectedCount + ' into projects)' : ''));
  if (r.tasks_banked) parts.push(r.tasks_banked + ' banked for later');
  if (unbanked.length) parts.push(unbanked.length + ' back from the bank');
  if (routed.length) parts.push(routed.length + (routed.length === 1 ? ' serving event task' : ' serving event tasks'));
  if (closed.length) parts.push(closed.length + ' closed');
  const newDecs = (result.new_decisions as Array<Record<string, string>>) || [];
  if (r.decisions_added) {
    const cats = [...new Set(newDecs.map(d => d.reason_category).filter(Boolean))];
    parts.push(r.decisions_added + (r.decisions_added === 1 ? ' new decision' : ' new decisions') + (cats.length ? ' (' + cats.join('; ') + ')' : ''));
  }
  if (r.decisions_decided) parts.push(r.decisions_decided + ' decided');
  if (r.updates) parts.push(r.updates + (r.updates === 1 ? ' update' : ' updates'));
  let jevLine = '';
  if (jevRep.checked) {
    const bits: string[] = [];
    if (jevRep.dropped.length) bits.push(jevRep.dropped.length + ' not a firm commitment (left out: ' + jevRep.dropped.slice(0, 3).map(x => '"' + x.slice(0, 50) + '"').join(', ') + (jevRep.dropped.length > 3 ? ', ...' : '') + ')');
    if (jevRep.owners.length) bits.push(jevRep.owners.length + (jevRep.owners.length === 1 ? ' owner corrected' : ' owners corrected'));
    if (jevRep.due_cleared) bits.push(jevRep.due_cleared + (jevRep.due_cleared === 1 ? ' due date cleared' : ' due dates cleared'));
    if (jevRep.projects.length) bits.push(jevRep.projects.length + (jevRep.projects.length === 1 ? ' project corrected' : ' projects corrected'));
    if (jevRep.decisions_dropped.length) bits.push(jevRep.decisions_dropped.length + ' decision' + (jevRep.decisions_dropped.length === 1 ? '' : 's') + ' kept with the team');
    if (jevRep.closes_dropped) bits.push(jevRep.closes_dropped + ' task' + (jevRep.closes_dropped === 1 ? '' : 's') + ' left open (not proven done)');
    jevLine = '\n:mag: Jev checked ' + jevRep.checked + ' items' + (bits.length ? ': ' + bits.join(', ') : ', all held up') + '.';
  }
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
    await postSlack(':large_green_circle: *Welfare Avenue Dashboard*\n*' + label + '* updated from the ' + dateStr + ' meeting: ' + (parts.join(', ') || 'no board changes needed') + '.' + attention + eventLine + jevLine + '\n<' + site + '#team/' + dept + '|Open the ' + label + ' page>');
  }
  return { ...(applied as Record<string, unknown>), tasks_unbanked: unbanked.length, tasks_closed: closed.length, closed_tasks: closed, tasks_routed: routed.length, routed_events: [...new Set(routed.map(x => x.event.id))], tasks_projected: projectedCount, jev: jevRep };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const auth = await authorize(req);
  if (!auth.ok) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const transcriptId = Number(body.transcript_id);
  if (!transcriptId) return json({ error: 'transcript_id required' }, 400);
  if (body.dry_run === true) {
    /* synchronous preview for the build and for a future "preview before applying" button */
    try { return json(await processTranscript(transcriptId, true)); } catch (e) { return json({ error: String((e as Error).message || e).slice(0, 300) }, 500); }
  }

  const work = processTranscript(transcriptId).catch(async (e) => {
    console.error('processing failed', e);
    await svc.from('transcripts').update({ ai_summary: 'Processing failed: ' + String(e.message || e).slice(0, 200) }).eq('id', transcriptId);
  });
  // @ts-ignore EdgeRuntime is provided by the Supabase edge runtime
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) { EdgeRuntime.waitUntil(work); } else { await work; }
  return json({ accepted: true, transcript_id: transcriptId }, 202);
});
