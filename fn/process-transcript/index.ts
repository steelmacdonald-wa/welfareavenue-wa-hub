// v18.2 (15/10/26, wave243): a task with no assignee named goes to its owner (assignees = [owner]), so the task shows on the
// owner's My page and in their task reminders; the 14/10 marketing meeting left most tasks with an owner and no assignee.
// v18.1 (14/10/26, wave237): Jev's due-date check sees upcoming_dates too, so a date that comes from a named event or meeting
// (the day before the Oberoi event, the next marketing meeting) holds instead of being cleared as unsupported.
// v18 (14/10/26, wave237): tasks set right. Steel, after the 14/10 marketing meeting came out with missing, doubled and wrongly
// owned tasks: "definitely make sure the tasks are set correctly", and the Hub asks a person to confirm a task only when the
// owner is unsure ("I'd rather it just be where the AI takes care of that"). What changed: the model reads the WHOLE transcript
// (it used to see the first 30,000 characters, about half of an hour-long meeting, so the last half's commitments were lost);
// the roster carries each person's nicknames (team_members.nicknames: Robert and Rob for Roberto Toto, Trish for Patricia, KK for
// Kahkashan) so a spoken name lands on the right person; the context lists the named dates ahead (serving events, fundraisers,
// team meetings in the next 45 days) so "before Sunday's Oberoi event" resolves to a date; each new task says whether its owner
// is sure (owner_sure); a task whose owner is unsure, or that is for the whole team, is marked dept_tasks.owner_unsure and the
// due-date check asks "Is this yours?" (mine / not mine) or, for the team's lead, who owns it; near-duplicates are merged
// (within the meeting, and against the tasks already open on the board: a meeting filed twice never doubles a task); content
// ideas keep the platform the meeting named (all six of the Studio's, not only Instagram and Facebook) and emails or newsletters
// are not content ideas. Meeting recaps from Read AI, Otter and the like are no longer filed (mail-pull v11): Loom only.
// v17 (29/09/26, wave165): one-on-ones only for the people speaking in them, and archive-only meetings. Steel: "1on1s should be
// confidential and not searchable by anyone except for those that are speaking in the meeting", and for the older Loom meetings
// "don't create any tasks from them just enhance the "Ask the Hub"". An archive-only meeting (transcripts.archive_only) is never
// processed (the insert trigger skips it; a direct call answers without writing). A meeting sees only the work it may share:
// open work, and for a restricted meeting the work of its own kind (a one-on-one: the work of one-on-ones among the same people),
// so nothing restricted from elsewhere leaks into what it files. A restricted meeting leaves the team's narrative (progress, mood,
// priorities) alone, routes nothing to serving events, gives no content ideas, closes and decides only work of its own kind (its
// evidence never lands on open work), and its audit rows follow it. A one-on-one is never escalated to board-only (only its
// speakers read it anyway) and posts nothing in Slack; other restricted meetings post counts without quoting what Jev dropped.
// v16 (29/09/26, wave164): Finance is its own team, apart from Fundraising (Steel: "these should be seperate"): a meeting tagged Finance
// files its tasks and updates under finance (apply_transcript_result maps it too), and Fundraising is called Fundraising. Nothing else changed.
// v15 (28/09/26, wave162): meetings the Loom pull files (added_by 'Loom pull ...') post the usual Slack line only when app_config
// loom_pull_slack is 'on'; it is off until Steel says otherwise, so a scheduled catch-up never floods the channel. Nothing else changed.
// v14 (26/09/26): content ideas. For a Marketing meeting a second pass reads the whole transcript (up to three 60,000-character
// pieces) for ideas for posts, reels, carousels, stories and series, even when nobody has committed to making them yet. Each idea
// carries an exact quote; one whose quote is not in the transcript is dropped. content_ideas_from_meeting() files them in the Content
// calendar's Ideas with the meeting they came from (an idea for three months or more away waits in the bank until six weeks before
// its date). The Slack line counts them. {action: 'ideas', transcript_id, dry_run?} runs only this pass, for older meetings, and posts
// nothing. Board-only, leadership and private meetings give no ideas. Model route: content_ideas.
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
  fundraising: 'Fundraising', finance: 'Finance', hr: 'Human Resources', board: 'Board and Governance',
};

function deptKey(d: string): string | null {
  const s = (d || '').toLowerCase();
  if (s === 'progdev' || (s.includes('program dev') && !s.includes('montreal') && !s.includes('toronto') && !s.includes('ops'))) return 'progdev';
  if (s === 'opsmtl' || s.includes('montreal')) return 'opsmtl';
  if (s === 'opsto' || s.includes('toronto')) return 'opsto';
  if (s.includes('marketing')) return 'marketing';
  if (s === 'finance' || s.startsWith('financ')) return 'finance';   /* v16: before fundraising (the old tag read Finance (Fundraising & Finances)) */
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
3. Never invent people. Assignees must be names from the roster provided, written exactly as the roster writes them. Transcripts garble names (Suhaib can appear as Suheb, Steel as Sue or Steele) and people use nicknames: each roster entry lists what else the person is called (also_called), so "Robert" is the roster's "Roberto Toto" and "Trish" is "Patricia". Map a spoken name to a roster name when the nickname list, the role or the context makes it clear; otherwise keep the transcript spelling and it will be flagged as verify name.
4. Review the numbered open task list against the transcript, item by item, and be CONSERVATIVE about closing. Include a task in close_tasks only when the transcript clearly states the work is done, shipped, delivered, resolved, signed, hired, or explicitly no longer needed (cancelled or dropped). When in doubt, do not close: a task that is merely discussed, in progress, partially done, or planned stays open. For each closure provide evidence: a short quote or close paraphrase from the transcript that proves the task is complete, plus the exact task_id from the numbered list. Never close a task on inference alone, and never remove or rewrite existing tasks; only add or close.
5. Raise a new executive decision only when a call needs Steel or Suhaib personally. Every new decision needs reason_category and a one line reason_note. Categories: Budget or purchase; Hiring or people; Legal, risk, or governance; Strategy or direction; Partnership or external; Ethics or policy. Use a better fitting short category only if none apply. Flagged tasks (flag true) need the same two fields.
6. progress: an updated 2 to 4 sentence paragraph for the department, keeping prior content that is still true. read: only update if team mood or energy clearly shifted; otherwise null. priorities: 2 to 4 short items, or null to keep current.
7. new_updates: 1 to 3 new update entries summarizing what the meeting moved, label like "Jul 2 (Otter)".
8. due_date only when the transcript states or strongly implies a date, resolved to ISO with calendar_after_meeting (one line per day after the meeting, with its weekday): "by Friday" is the first Friday after the meeting, "next week" is the Friday of the following week, "end of the month" is the last day of that month, "before the event on the 12th" is the day before, "in two weeks" is meeting date plus 14 days. upcoming_dates lists the named things ahead (serving events, partner events, fundraisers, the team's meetings) with their dates: a task for one of them ("find a photographer for the Oberoi event", "the post before Sunday's collab") is due the day before that event unless the meeting says otherwise, and a task to be done "for next meeting" or "by the next marketing meeting" is due that meeting's date. "Tonight" or "today" is the meeting date; "tomorrow" is the day after. No date when timing is vague ("soon", "at some point").
8b. description: every new task gets 2 to 4 plain sentences a colleague could act on without having been in the meeting: what exactly needs doing, why (the context from the discussion), what done looks like, and any names, numbers, places or links mentioned. Use "- " bullets for lists of items. Never pad; never invent.
8c. priority true only when the meeting clearly treats the task as urgent or the top priority ("this has to happen this week", "top priority", "blocking"), else false.
9. subsection must be exactly one of the provided workstream names, or null.
10. mark confidential true on anything about succession, individual performance, or personnel issues.
11. Reconcile the open executive decisions list the same way: if the transcript shows a decision was made, include its id in decide_decisions with a short decided_note quoting the call that was made.
12. summary: one line, under 25 words, stating what changed, counting closures.
13. board_sensitive: set true when the transcript contains board only content: leadership departures or succession (for example a founder or co executive director stepping back or leaving), personnel performance or discipline, individual compensation, legal disputes, or anything explicitly marked board only or for the board only. When unsure, err toward true.
14. Event routing (Ops Montreal and Ops Toronto only): give every new task an event_routing value. Use "event" when the task is preparation or follow up for one of the regular biweekly Sunday serving events: volunteer confirmations and recruitment for that Sunday, cooking, groceries and supplies, packing, distribution day logistics, standard operating procedure steps. Use "adhoc" for everything else, including special one off or corporate volunteering events, partnerships, admin, marketing, and anything not tied to a regular serving Sunday. When the transcript states which serving date a task is for, set event_date to that ISO date, preferring a date listed in upcoming_serving_events; otherwise leave event_date null and the task attaches to the next serving event. For all other departments use "adhoc".
15. Project routing: the context lists the organization's projects with descriptions. Give every new task a project_id when the task clearly belongs to that project based on the project's name and description. Prefer projects from this department, but use another department's project when the task is clearly part of that named initiative (for example a marketing task promoting the flag football tournament belongs to the Flag Football 2026 project). When no project fits, use null: the task lands in the department's general list. Never invent a project_id that is not in the list. Event routed tasks (rule 14) do not need a project_id.
16. The bank: when the meeting clearly puts a piece of work off by three months or more ("in the spring", "next year", "after the gala in March", "park it until the new fiscal year", "not before January"), still add it as a new task, but set bank_until to the ISO date it should come back (the first day of the month or season named; three to six months after the meeting when the timing is vague) and bank_reason to one short line saying why it waits. It goes to the bank instead of the board and comes back on that date. Work for the next three months is never banked, and a date alone is not a reason to bank. Tasks marked "(in the bank until ...)" in the numbered open task list are already banked: never add them again; close one only with the same evidence rule; list its task_id in unbank_task_ids only when the meeting says to start it now.
17. Read the whole transcript to the end: the commitments made in the last ten minutes of a meeting (who finds the photographer, who sends the link, who reviews what on Friday) are tasks too. Every "I'll do X", "can you do X" that is accepted, and every "X will do Y" is a task; a question nobody answered, an idea nobody took on, or a step already done is not. One task per commitment: never two tasks for the same work, even when it was mentioned twice.
18. owner_sure: true when the transcript makes it clear who took the task on (they said they would, or were asked and agreed). false when it is a guess, when two people could own it, or when the work is for the whole team with nobody named: then give the team's director or lead as owner (the roster says who leads) and owner_sure false, and the Hub asks them who owns it. Never leave a task without an owner.`;

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
        owner_sure: { type: 'boolean', description: 'Rule 18: true when the transcript makes it clear who took this on; false for a guess, a toss-up between two people, or work for the whole team (then the owner is the team lead and the Hub asks).' },
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

/* v18: the whole transcript (an hour's meeting is 50,000 to 75,000 characters; the old 30,000 cut lost the second half) */
const TRANSCRIPT_MAX = 180000;
async function callAnthropic(context: unknown, transcriptText: string): Promise<Record<string, unknown>> {
  const key = 'hub-router';
  const text = transcriptText.length > TRANSCRIPT_MAX
    ? transcriptText.slice(0, TRANSCRIPT_MAX) + '\n[... the transcript continues; ' + (transcriptText.length - TRANSCRIPT_MAX) + ' more characters not shown ...]'
    : transcriptText;
  const userContent = 'CONTEXT (current board state, JSON):\n' + JSON.stringify(context) +
    '\n\nTRANSCRIPT (read it all, to the end):\n' + text;
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
        model, max_tokens: 6000, temperature: 0.2, system: SYSTEM,
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
async function jevCheck(result: Record<string, unknown>, transcript: string, roster: string[], meetingLabel: string, projs: ProjRow[], dept: string, meetingDateIso: string | null, upcoming: string[] = []): Promise<JevReport> {
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
    /* v18.1: a date that comes from a named event or meeting in upcoming_dates (the day before an event, the meeting's own date) holds */
    if (due) questions.due_ok = { type: 'noul', instructions: 'Does the excerpt state or strongly imply the due date ' + due + ' for this item: a named day ("by Friday", "before the event on the 12th") checked against the calendar given, or a named event, serving or meeting listed in upcoming_dates (a task for an event is due the day before it; a task for the next meeting is due on that meeting\'s date)? Vague timing ("soon", "at some point"), or a different day than the calendar gives, does not count.' };
    /* the project it landed in: the model's pick against the department's other projects */
    const pickedP = t.project_id ? projs.find(p => Number(p.id) === Number(t.project_id)) : null;
    const pool = projs.filter(p => p.department === dept || (pickedP && p.id === pickedP.id)).slice(0, 10);
    const pcrit: Record<string, string> = { none: 'No project: the department\u2019s general list' };
    pool.forEach(p => { pcrit['pr' + p.id] = p.name + (p.description ? ': ' + String(p.description).slice(0, 120) : ''); });
    if (pool.length) questions.project = { type: 'choice', instructions: 'Which project does this task belong to? Pick "none" unless the task is clearly part of one.', criteria: pcrit };
    const ans = await jev({ meeting: meetingLabel, item: { title, owner, assignees: t.assignees || [], due_date: due, workstream: t.subsection || null }, transcript_excerpt: ex, calendar_after_meeting: due ? calendarStrip(meetingDateIso).slice(0, 15) : undefined, upcoming_dates: due && upcoming.length ? upcoming.slice(0, 15) : undefined, note: 'Names in the roster are the only valid owners.' }, questions);
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

async function applyCloseTasks(result: Record<string, unknown>, dept: string, changedBy: string, boardOnly: boolean, closable?: Set<number>): Promise<Array<{ id: number; title: string }>> {
  const items = Array.isArray(result.close_tasks) ? (result.close_tasks as CloseItem[]) : [];
  const closed: Array<{ id: number; title: string }> = [];
  for (const item of items) {
    const taskId = Number(item?.task_id);
    if (!Number.isInteger(taskId) || taskId <= 0) continue;
    if (closable && !closable.has(taskId)) { console.warn('close skipped, not work this meeting may close', taskId); continue; }
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


/* ---- v14: content ideas from marketing meetings ---- */
const IDEAS_SYSTEM = `You read one Welfare Avenue marketing meeting and pull out the content ideas raised in it: ideas for social posts, reels, carousels, stories, series, campaigns or stories worth telling on Instagram, Facebook, LinkedIn or TikTok, even when nobody committed to making them yet. The Hub keeps them in the Content calendar's Ideas so good ideas are not lost.

Rules:
1. Never use em dashes. Plain, specific language.
2. Only ideas actually raised in this meeting (or this part of it). Every idea needs evidence: an exact quote of 6 to 25 words copied word for word from the transcript where the idea came up. No quote, no idea.
3. Content ideas only. Skip operational to-dos (fix the website, send the schedule, order supplies), meeting logistics, anything about a person's performance, pay or health, and ideas the meeting turned down. Emails and newsletters are not content ideas (the Email studio holds those): skip them.
4. Skip anything already listed in existing_ideas, even when worded differently. Merge near duplicates into one idea.
5. title: a short working title a teammate would recognise, 3 to 8 words (for example "Volunteer spotlight: Sunday cooks").
6. idea: 1 to 3 sentences: what the post or series is, the angle or hook, and what it needs (photos, an interview, a partner, a date).
7. format: post, reel, carousel, story, series or other. platforms: only the ones named in the meeting (a LinkedIn article is linkedin; a TikTok is tiktok; a short is youtube), else an empty list.
8. suggested_by: the roster name of the person who raised it when it is clear, else null. Otter garbles names; map a spoken name to a roster name only when confident.
9. campaign: the named campaign, event or fundraiser it belongs to, else null.
10. for_date: when the meeting ties the idea to a date, an event or a season, the ISO date it is for (resolve relative dates from the meeting date; a month or a season means its first day), else null.
11. At most 12 ideas. An empty list is a fine answer.`;

const IDEAS_TOOL = {
  name: 'save_content_ideas',
  description: 'Save the content ideas raised in this meeting to the Content calendar.',
  input_schema: {
    type: 'object',
    properties: {
      ideas: { type: 'array', items: { type: 'object', properties: {
        title: { type: 'string' },
        idea: { type: 'string', description: '1 to 3 sentences: what it is, the angle, what it needs. No em dashes.' },
        format: { type: 'string', enum: ['post', 'reel', 'carousel', 'story', 'series', 'other'] },
        platforms: { type: 'array', items: { type: 'string', enum: ['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'threads'] } },
        suggested_by: { type: ['string', 'null'] },
        campaign: { type: ['string', 'null'] },
        for_date: { type: ['string', 'null'], description: 'ISO date the idea is for, or null.' },
        evidence: { type: 'string', description: 'An exact quote of 6 to 25 words from the transcript where the idea was raised.' } },
        required: ['title', 'idea', 'evidence'] } }
    },
    required: ['ideas']
  }
};

function normText(x: string): string { return String(x || '').toLowerCase().replace(/[^a-z0-9\u00c0-\u024f]+/g, ' ').replace(/\s+/g, ' ').trim(); }
/* v18: do two task titles describe the same work? The words that carry meaning (no stop words, no plurals), then the overlap:
   three fifths of the smaller set shared, or one title inside the other. "Check assigned hub tasks for the upcoming week" and
   "Check the Hub tasks for next week" match; "Find a photographer for Sunday" and "Send Roberto last year's post" do not. */
const DUP_STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'at', 'by', 'with', 'from', 'into', 'our', 'their', 'his', 'her', 'its', 'this', 'that', 'these', 'those', 'is', 'are', 'be', 'as', 'it', 'up', 'out', 'all', 'any', 'some', 'new', 'next', 'upcoming', 'week', 'weeks', 'day', 'days', 'hub', 'team', 'meeting', 'will', 'should', 'need', 'needs', 'make', 'sure', 'get', 'do', 'via', 'about', 'after', 'before', 'over']);
function workWords(t: string): string[] {
  return [...new Set(normText(t).split(' ').filter(w => w.length > 2 && !DUP_STOP.has(w)).map(w => w.replace(/(ies)$/, 'y').replace(/(s|es|ed|ing)$/, '')))].filter(Boolean);
}
export function sameWork(a: string, b: string): boolean {
  const wa = workWords(a), wb = workWords(b);
  if (!wa.length || !wb.length) return false;
  const na = normText(a), nb = normText(b);
  if (na === nb) return true;
  if (Math.min(wa.length, wb.length) >= 4 && (na.includes(nb) || nb.includes(na))) return true;
  const sa = new Set(wa); let shared = 0; for (const w of wb) if (sa.has(w)) shared++;
  const small = Math.min(wa.length, wb.length);
  return small >= 3 ? shared / small >= 0.6 : (small === 2 ? shared === 2 : false);
}
/* an idea stands only when four consecutive words of its quote are in the transcript */
function quoted(evidence: string, transcriptNorm: string): boolean {
  const w = normText(evidence).split(' ').filter(Boolean);
  if (w.length < 4) return false;
  for (let i = 0; i + 4 <= w.length; i++) { if (transcriptNorm.includes(' ' + w.slice(i, i + 4).join(' ') + ' ')) return true; }
  return false;
}

type Idea = { title: string; idea: string; format?: string; platforms?: string[]; suggested_by?: string | null; campaign?: string | null; for_date?: string | null; evidence: string };

async function ideasPass(tx: Record<string, unknown>, roster: string[]): Promise<{ ideas: Idea[]; dropped: number; pieces: number }> {
  const body = String(tx.body || '');
  const { data: existing } = await svc.from('content_posts').select('title').not('title', 'is', null).order('id', { ascending: false }).limit(150);
  const known: string[] = (existing || []).map((r: { title: string | null }) => String(r.title || '')).filter(Boolean);
  const size = 60000, overlap = 1500;
  const pieces: string[] = [];
  for (let at = 0; at < body.length && pieces.length < 3; at += size - overlap) pieces.push(body.slice(at, at + size));
  const tNorm = ' ' + normText(body) + ' ';
  const found: Idea[] = [];
  let dropped = 0;
  for (let i = 0; i < pieces.length; i++) {
    const context = {
      meeting_title: tx.title, meeting_date: tx.meeting_date,
      meeting_weekday: tx.meeting_date ? new Date(String(tx.meeting_date) + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long' }) : null,
      part: pieces.length > 1 ? 'part ' + (i + 1) + ' of ' + pieces.length + ' of the transcript' : 'the whole transcript',
      roster, existing_ideas: known.concat(found.map(f => f.title)).slice(0, 180)
    };
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + SERVICE_KEY, 'x-wa-task': 'content_ideas', 'x-wa-caller': 'process-transcript', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-5', max_tokens: 3000, temperature: 0.2, system: IDEAS_SYSTEM,
        messages: [{ role: 'user', content: 'CONTEXT (JSON):\n' + JSON.stringify(context) + '\n\nTRANSCRIPT' + (pieces.length > 1 ? ' (' + context.part + ')' : '') + ':\n' + pieces[i] }],
        tools: [IDEAS_TOOL], tool_choice: { type: 'tool', name: 'save_content_ideas' }
      })
    });
    if (!res.ok) throw new Error('ideas pass failed: ' + res.status + ' ' + (await res.text()).slice(0, 200));
    const out = await res.json();
    const tu = (out.content || []).find((c: { type: string }) => c.type === 'tool_use');
    const list = (tu && tu.input && Array.isArray(tu.input.ideas)) ? tu.input.ideas as Idea[] : [];
    for (const it of list) {
      if (!it || !it.title || !it.idea) continue;
      if (!quoted(String(it.evidence || ''), tNorm)) { dropped++; continue; }
      const k = normText(it.title);
      if (found.some(f => normText(f.title) === k)) continue;
      found.push(it);
    }
  }
  return { ideas: found.slice(0, 15), dropped, pieces: pieces.length };
}

function ideasAllowed(tx: Record<string, unknown>): boolean {
  return tx.board_only !== true && tx.archive_only !== true && ['leadership', 'private', 'speakers'].indexOf(String(tx.visibility || '')) < 0;
}

async function saveIdeas(transcriptId: number, ideas: Idea[], by: string): Promise<{ added: number; banked: number; skipped: number }> {
  if (!ideas.length) return { added: 0, banked: 0, skipped: 0 };
  const { data, error } = await svc.rpc('content_ideas_from_meeting', { p_transcript_id: transcriptId, p_ideas: ideas, p_by: by });
  if (error) throw new Error('saving ideas failed: ' + error.message);
  const d = (data || {}) as Record<string, number>;
  return { added: Number(d.added || 0), banked: Number(d.banked || 0), skipped: Number(d.skipped || 0) };
}

/* {action: 'ideas'}: only the ideas pass, for a marketing meeting uploaded before v14; no Slack */
async function ideasOnly(transcriptId: number, dryRun: boolean) {
  const { data: tx, error } = await svc.from('transcripts').select('*').eq('id', transcriptId).single();
  if (error || !tx) throw new Error('transcript not found');
  if (deptKey(tx.department) !== 'marketing') throw new Error('content ideas come from Marketing meetings only');
  if (!ideasAllowed(tx)) return { transcript_id: transcriptId, added: 0, reason: tx.archive_only === true ? 'archive-only meeting' : 'restricted meeting' };
  const { data: team } = await svc.from('team_members').select('name').eq('department', 'marketing').eq('active', true);
  const roster = [...new Set([...(team || []).map((m: { name: string }) => m.name), 'Steel MacDonald', 'Suhaib'])];
  const pass = await ideasPass(tx, roster);
  if (dryRun) return { transcript_id: transcriptId, dry_run: true, ideas: pass.ideas, dropped_without_quote: pass.dropped, pieces: pass.pieces };
  const saved = await saveIdeas(transcriptId, pass.ideas, 'AI: ' + (tx.title || 'transcript ' + transcriptId));
  return { transcript_id: transcriptId, ...saved, dropped_without_quote: pass.dropped, pieces: pass.pieces };
}

/* v17: what a meeting may see of the boards. Open work always; a restricted meeting also the work of its own kind (a one-on-one:
   the work of one-on-ones among the same people, every one of its people being on it) */
type VisRow = { visibility?: string | null; allowed_people?: unknown };
const lowerList = (x: unknown): string[] => Array.isArray(x) ? (x as unknown[]).map((v) => String(v || '').trim().toLowerCase()).filter(Boolean) : [];
export function restrictedVis(tx: Record<string, unknown>): string {
  const v = String(tx.visibility || '');
  return ['leadership', 'private', 'speakers'].indexOf(v) >= 0 ? v : '';
}
export function seesRow(tx: Record<string, unknown>) {
  const vis = restrictedVis(tx);
  const ap = lowerList(tx.allowed_people);
  return (r: VisRow): boolean => {
    const rv = String(r.visibility || '');
    if (!rv || rv === 'department') return true;
    if (!vis || rv !== vis) return false;
    if (vis === 'speakers') { const rap = lowerList(r.allowed_people); return ap.length > 0 && ap.every((x) => rap.indexOf(x) >= 0); }
    return true;
  };
}
/* work of the meeting's own restricted kind (a restricted meeting closes and decides only these) */
export function ownKind(tx: Record<string, unknown>) {
  const vis = restrictedVis(tx); const sees = seesRow(tx);
  return (r: VisRow): boolean => !!vis && String(r.visibility || '') === vis && sees(r);
}
const bare = <T extends Record<string, unknown>>(r: T) => { const o: Record<string, unknown> = { ...r }; delete o.visibility; delete o.allowed_people; return o; };

async function processTranscript(transcriptId: number, dryRun = false) {
  const { data: tx, error } = await svc.from('transcripts').select('*').eq('id', transcriptId).single();
  if (error || !tx) throw new Error('transcript not found');
  /* v17: kept for the archive and Ask the Hub only */
  if (tx.archive_only === true) return { skipped: true, note: 'archive only: kept for the archive and Ask the Hub, not processed' };
  if (!tx.body || tx.body.trim().length < 40) throw new Error('transcript body too short to process');
  const dept = deptKey(tx.department);
  if (!dept) throw new Error('unknown department: ' + tx.department);
  const vis = restrictedVis(tx);
  const sees = seesRow(tx); const own = ownKind(tx);

  const [metaQ, tasksAll, decAll, rosterQ, projQ, datesQ] = await Promise.all([
    svc.from('dept_meta').select('read, progress, priorities').eq('department', dept).maybeSingle(),
    svc.from('dept_tasks').select('id, title, subsection, owner, status, due_date, flag, banked_at, bank_until, visibility, allowed_people').eq('department', dept).eq('done', false),
    svc.from('decisions').select('id, title, area, owner, visibility, allowed_people').eq('done', false),
    /* v18: the whole active roster with each person's nicknames; this team first, then the people in other teams (a marketing
       meeting hands work to the operations lead too), so a spoken name lands on the right person */
    svc.from('team_members').select('name, role, department, nicknames').eq('active', true).order('name'),
    svc.from('projects').select('id, name, description, department, parent_id, goal_id').is('banked_at', null).eq('status', 'active').order('department').order('sort'),
    svc.rpc('wa237_upcoming_dates', { p_dept: dept, p_from: tx.meeting_date || new Date().toISOString().slice(0, 10) }),
  ]);
  type RosterRow = { name: string; role: string | null; department: string | null; nicknames: string[] | null };
  const rosterAll = ((rosterQ.data || []) as RosterRow[]).filter(m => m.name && !/^(exec|board)$/i.test(String(m.department || '')) || /^(steel|suhaib)/i.test(String(m.name || '')));
  const rosterTeam = rosterAll.filter(m => m.department === dept);
  const rosterOthers = rosterAll.filter(m => m.department !== dept);
  const rosterEntry = (m: RosterRow) => ({ name: m.name, role: m.role || '', team: DEPT_LABEL[String(m.department || '')] || m.department || '', also_called: (m.nicknames || []).filter(Boolean) });
  const teamLead = rosterTeam.find(m => /director|co-director|lead\b|manager/i.test(String(m.role || '')) && !/co-director/i.test(String(m.role || ''))) || rosterTeam.find(m => /director|lead|manager/i.test(String(m.role || ''))) || null;
  /* v17: only the work this meeting may share (see seesRow) */
  const seenTasks = ((tasksAll.data || []) as Array<Record<string, unknown>>).filter(sees);
  const seenDecs = ((decAll.data || []) as Array<Record<string, unknown>>).filter(sees);
  const tasksQ = { data: seenTasks.map(bare) as Array<{ id: number; title: string; subsection: string | null; owner: string | null; status: string | null; due_date: string | null; flag: boolean | null; banked_at: string | null; bank_until: string | null }> };
  const decQ = { data: seenDecs.map(bare) };
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
    roster: rosterTeam.map(rosterEntry),
    other_people: rosterOthers.map(rosterEntry),
    upcoming_serving_events: upcomingEvents.map(e => e.event_date + (e.code ? ' (' + e.code + ')' : '')),
    /* v18: the named dates ahead, so a task tied to an event or a meeting gets its date (rule 8) */
    upcoming_dates: Array.isArray(datesQ.data) ? (datesQ.data as string[]).slice(0, 40) : [],
    team_lead: teamLead ? teamLead.name : null,
    projects,
    note: 'Steel MacDonald and Suhaib are the co executive directors and are always valid owners. roster lists this team (with what each person is also called); other_people are the rest of the organisation, valid owners when the meeting hands them work.'
  };

  const result = await callAnthropic(context, tx.body);
  const changedBy = 'AI: ' + (tx.title || 'transcript ' + transcriptId);
  // Jev second opinion on every item (see jevCheck); the roster is whatever the context lists as valid owners
  const rosterNames: string[] = [...new Set([...rosterAll.map(m => String(m.name || '')).filter(Boolean), 'Steel MacDonald', 'Steel', 'Suhaib', 'Both'])];
  /* v18: a nickname the model kept becomes the roster name (Robert > Roberto Toto); a name nobody has stays for the verify-name flag */
  const nickMap = new Map<string, string>();
  rosterAll.forEach(m => { (m.nicknames || []).forEach(n => { if (n) nickMap.set(String(n).toLowerCase(), m.name); }); nickMap.set(String(m.name).toLowerCase(), m.name); });
  const firstMap = new Map<string, string[]>();
  rosterAll.forEach(m => { const f = String(m.name).split(/\s+/)[0].toLowerCase(); firstMap.set(f, [...(firstMap.get(f) || []), m.name]); });
  const canon = (n: string): string => {
    const k = String(n || '').trim().toLowerCase(); if (!k) return n;
    if (nickMap.has(k)) return nickMap.get(k) as string;
    const f = firstMap.get(k.split(/\s+/)[0]); if (f && f.length === 1 && k.split(/\s+/).length === 1) return f[0];
    return n;
  };
  (Array.isArray(result.new_tasks) ? result.new_tasks as Array<Record<string, unknown>> : []).forEach(t => {
    if (typeof t.owner === 'string') t.owner = canon(t.owner);
    if (Array.isArray(t.assignees)) t.assignees = (t.assignees as unknown[]).map(a => canon(String(a)));
    /* v18.2 (wave243): a task with no assignee named goes to its owner (a roster name), so it shows on their My page and in their reminders */
    if (typeof t.owner === 'string' && t.owner.trim() && (!Array.isArray(t.assignees) || !t.assignees.length) && rosterAll.some(m => m.name === t.owner)) t.assignees = [t.owner];
  });
  const jevRep = await jevCheck(result, tx.body, rosterNames, (tx.title || 'meeting') + (tx.meeting_date ? ' (' + tx.meeting_date + ')' : ''), projRows.map(p => ({ id: p.id, name: (p.parent_id && projName.get(p.parent_id) ? projName.get(p.parent_id) + ' > ' : '') + p.name, description: p.description, department: p.department, parent_id: p.parent_id })), dept, tx.meeting_date || null, context.upcoming_dates);

  /* v18: no doubles. Two tasks for the same work in one meeting are merged (the first kept, assignees joined), and a task
     already open on the board (the same meeting filed twice, or last week's task said again) is not added again; the
     existing task gets a comment-free change_log line instead so the archive shows the meeting touched it. */
  const dupes: Array<{ title: string; same: string; existing?: number }> = [];
  {
    const seenNew: Array<Record<string, unknown>> = [];
    const open = (tasksQ.data || []).map(t => ({ id: Number(t.id), title: String(t.title || '') }));
    for (const t of (Array.isArray(result.new_tasks) ? result.new_tasks as Array<Record<string, unknown>> : [])) {
      const title = String(t.title || '');
      const twin = seenNew.find(x => sameWork(String(x.title || ''), title));
      if (twin) {
        dupes.push({ title, same: String(twin.title || '') });
        const a = new Set([...(Array.isArray(twin.assignees) ? twin.assignees.map(String) : []), ...(Array.isArray(t.assignees) ? t.assignees.map(String) : [])]);
        if (a.size) twin.assignees = [...a];
        if (!twin.due_date && t.due_date) twin.due_date = t.due_date;
        if (t.owner_sure === true && twin.owner_sure === false && String(t.owner || '') === String(twin.owner || '')) twin.owner_sure = true;
        continue;
      }
      const old = open.find(o => sameWork(o.title, title));
      if (old) { dupes.push({ title, same: old.title, existing: old.id }); continue; }
      seenNew.push(t);
    }
    result.new_tasks = seenNew;
  }

  if (dryRun) {
    /* preview: what the model and Jev would put on the board, nothing written */
    return { dry_run: true, department: dept, model_result: result, jev: jevRep, doubles_left_out: dupes };
  }
  /* v17: a one-on-one is only for its speakers already; board-only would lock out the ones not on the board */
  const boardSensitive = result.board_sensitive === true && vis !== 'speakers';
  const effectiveBoardOnly = tx.board_only === true || boardSensitive;
  if (boardSensitive && tx.board_only !== true) {
    const { error: flagErr } = await svc.from('transcripts').update({ board_only: true }).eq('id', transcriptId);
    if (flagErr) console.error('failed to set transcripts.board_only', flagErr);
  }

  const runStartIso = new Date(Date.now() - 60000).toISOString();

  /* v18: the tasks the meeting raised again get a line in the archive (nothing added) */
  for (const d of dupes.filter(x => x.existing)) {
    await svc.from('change_log').insert({ entity_type: 'dept_task', entity_id: String(d.existing), field: 'mentioned again', old_value: null, new_value: 'The meeting raised it again ("' + d.title.slice(0, 120) + '"); the task was already open, so nothing was added', changed_by: changedBy, board_only: effectiveBoardOnly }).then(() => null, () => null);
  }

  const allNew = Array.isArray(result.new_tasks) ? (result.new_tasks as Array<Record<string, unknown>>) : [];
  const routed: Array<{ event: EventRow; title: string }> = [];
  let remainingNew = allNew;
  if ((dept === 'opsmtl' || dept === 'opsto') && !effectiveBoardOnly && !vis && allNew.length && upcomingEvents.length) {
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

  const rpcPayload: Record<string, unknown> = { ...result, new_tasks: remainingNew, close_task_ids: [] };
  if (vis) {
    /* v17: a restricted meeting leaves the team's narrative alone (every member reads it) and decides only decisions of its own kind */
    delete rpcPayload.progress; delete rpcPayload.read; delete rpcPayload.priorities;
    const ownDecs = new Set(seenDecs.filter(own).map((d) => Number(d.id)));
    rpcPayload.decide_decisions = (Array.isArray(result.decide_decisions) ? result.decide_decisions as Array<Record<string, unknown>> : []).filter((d) => ownDecs.has(Number(d.id)));
  }
  const { data: applied, error: applyErr } = await svc.rpc('apply_transcript_result', {
    p_transcript_id: transcriptId, p: rpcPayload, p_changed_by: changedBy,
  });
  if (applyErr) throw new Error('apply failed: ' + applyErr.message);

  /* v18: a task whose owner the meeting left unsure (rule 18) is marked, so the due-date check asks "Is this yours?" (or asks the
     team's lead who owns it). Matched by title: apply_transcript_result inserts the title as given. */
  const unsure = remainingNew.filter(t => t.owner_sure === false && typeof t.title === 'string' && t.title.trim()).map(t => String(t.title).trim());
  let unsureCount = 0;
  if (unsure.length) {
    const { data: marked, error: markErr } = await svc.from('dept_tasks').update({ owner_unsure: true }).eq('updated_by', changedBy).gte('opened_at', runStartIso).in('title', unsure).select('id');
    if (markErr) console.error('owner_unsure mark failed', markErr); else unsureCount = (marked || []).length;
  }

  if (effectiveBoardOnly) {
    const stamps = await Promise.all([
      svc.from('dept_updates').update({ board_only: true }).eq('added_by', changedBy).gte('created_at', runStartIso),
      svc.from('dept_tasks').update({ board_only: true }).eq('updated_by', changedBy).gte('opened_at', runStartIso),
      svc.from('decisions').update({ board_only: true }).eq('raised_by', changedBy).gte('opened_at', runStartIso),
      svc.from('change_log').update({ board_only: true }).eq('changed_by', changedBy).gte('changed_at', runStartIso),
    ]);
    stamps.forEach((s, i) => { if (s.error) console.error('board_only stamp failed for table index ' + i, s.error); });
  }

  /* v17: a meeting closes only work it may see; a restricted one only work of its own kind (its evidence never lands on open work) */
  const closable = new Set(seenTasks.filter((t) => !vis || own(t)).map((t) => Number(t.id)));
  const closed = await applyCloseTasks(result, dept, changedBy, effectiveBoardOnly, closable);
  if (vis) {
    /* v17: the audit rows written after the meeting was marked processed (the closes) follow it too */
    const { error: stErr } = await svc.from('change_log').update({ visibility: vis, allowed_people: vis === 'leadership' ? null : (tx.allowed_people || null) })
      .eq('changed_by', changedBy).gte('changed_at', runStartIso).is('visibility', null);
    if (stErr) console.error('restricted audit stamp failed', stErr);
  }

  // v13: banked tasks the meeting starts now come back on the board
  const bankedIds = new Set((tasksQ.data || []).filter(t => t.banked_at).map(t => Number(t.id)));
  const unbanked: number[] = [];
  for (const raw of (Array.isArray(result.unbank_task_ids) ? result.unbank_task_ids as unknown[] : []).slice(0, 10)) {
    const id = Number(raw);
    if (!Number.isInteger(id) || !bankedIds.has(id) || closed.some(c => c.id === id)) continue;
    const { error: ubErr } = await svc.rpc('bank_unbank_do', { p_kind: 'task', p_id: id, p_why: 'the meeting started it again (' + (tx.title || 'meeting') + ')', p_by: changedBy });
    if (ubErr) console.error('unbank failed', id, ubErr); else unbanked.push(id);
  }

  // v14: content ideas from a marketing meeting go to the Content calendar (never blocks the run)
  let ideasRes: { added: number; banked: number; skipped: number; dropped?: number } | null = null;
  if (dept === 'marketing' && !effectiveBoardOnly && ideasAllowed(tx)) {
    try {
      const pass = await ideasPass(tx, rosterNames);
      const saved = await saveIdeas(transcriptId, pass.ideas, changedBy);
      ideasRes = { ...saved, dropped: pass.dropped };
    } catch (e) { console.error('content ideas pass failed', e); }
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
  if (ideasRes && ideasRes.added) parts.push(ideasRes.added + (ideasRes.added === 1 ? ' content idea' : ' content ideas') + ' for the calendar' + (ideasRes.banked ? ' (' + ideasRes.banked + ' in the bank)' : ''));
  if (r.updates) parts.push(r.updates + (r.updates === 1 ? ' update' : ' updates'));
  if (dupes.length) parts.push(dupes.length + (dupes.length === 1 ? ' double left out' : ' doubles left out'));
  if (unsureCount) parts.push(unsureCount + (unsureCount === 1 ? ' owner to confirm' : ' owners to confirm'));
  let jevLine = '';
  if (jevRep.checked) {
    const bits: string[] = [];
    if (jevRep.dropped.length) bits.push(jevRep.dropped.length + ' not a firm commitment' + (vis ? '' : ' (left out: ' + jevRep.dropped.slice(0, 3).map(x => '"' + x.slice(0, 50) + '"').join(', ') + (jevRep.dropped.length > 3 ? ', ...' : '') + ')'));
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
  /* v15 (wave162): a meeting the Loom pull filed posts its Slack line only when app_config loom_pull_slack is 'on' (off by default) */
  let loomQuiet = false;
  if (/^Loom pull/i.test(String(tx.added_by || ''))) {
    try { const { data: cfg } = await svc.from('app_config').select('value').eq('key', 'loom_pull_slack').maybeSingle(); loomQuiet = String(cfg?.value || 'off').trim().toLowerCase() !== 'on'; } catch (_) { loomQuiet = true; }
  }
  /* v17: a one-on-one posts nothing in Slack (only its speakers know it happened) */
  if (!isTest && !loomQuiet && vis !== 'speakers') {
    await postSlack(':large_green_circle: *Welfare Avenue Dashboard*\n*' + label + '* updated from the ' + dateStr + ' meeting: ' + (parts.join(', ') || 'no board changes needed') + '.' + attention + eventLine + jevLine + '\n<' + site + '#team/' + dept + '|Open the ' + label + ' page>');
  }
  return { ...(applied as Record<string, unknown>), tasks_unbanked: unbanked.length, tasks_closed: closed.length, closed_tasks: closed, tasks_routed: routed.length, routed_events: [...new Set(routed.map(x => x.event.id))], tasks_projected: projectedCount, content_ideas: ideasRes, jev: jevRep, doubles_left_out: dupes, owners_to_confirm: unsureCount };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const auth = await authorize(req);
  if (!auth.ok) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const transcriptId = Number(body.transcript_id);
  if (!transcriptId) return json({ error: 'transcript_id required' }, 400);
  if (body.action === 'ideas') {
    try { return json(await ideasOnly(transcriptId, body.dry_run === true)); } catch (e) { return json({ error: String((e as Error).message || e).slice(0, 300) }, 400); }
  }
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
