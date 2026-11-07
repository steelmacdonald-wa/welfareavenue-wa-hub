// wave292, 07/11/26: the summary pass (design "03 email history", 5.9). After the mail_interactions batch is applied, mail-history's summarise runs
// one pass over the run's contacts: crm_insight_input (their email lines only: date, direction, cleaned subject, one line, topic), the
// mail_history_insight route, crm_insight_save. It shares the run's spend and cap (wa289_spend) and resumes where it stopped (wa292_summary_todo
// lists only contacts with no summary or a stale one). Refresh on a profile (mail-history's insight) runs the same three steps for one contact.
// A person with one email gets a line without a model. The model never sees a body or a left-out thread. No Deno or Node globals here: everything
// outside comes in through deps (the tests wire it to PGlite and a fake router). Never logs or returns an address, subject, line or summary.
import { clip, cutAtContact, TOPICS } from './mail_rules.ts';

export type SummaryDeps = {
  // deno-lint-ignore no-explicit-any
  rpc: (fn: string, args: Record<string, unknown>) => Promise<any>;
  // deno-lint-ignore no-explicit-any
  router: (task: string, body: Record<string, unknown>) => Promise<{ out: any; cost: number }>;
  now: () => number;
};

export const RELATIONSHIP_TOOL = {
  name: 'relationship',
  description: 'A short record of Welfare Avenue\'s relationship with one person, from the one-line notes of their emails.',
  input_schema: {
    type: 'object', required: ['topics', 'summary'],
    properties: {
      topics: { type: 'array', items: { type: 'string', enum: TOPICS }, maxItems: 9 },
      open_item: { type: ['string', 'null'], description: 'Anything still open (a question not answered, a promised follow-up), in plain words; null when nothing is open.' },
      summary: { type: 'string', description: 'The relationship in two or three plain sentences.' },
    },
  },
};
export const SUMMARY_SYSTEM = [
  'You write a short record of Welfare Avenue\'s relationship with one person for the charity\'s CRM, from one-line notes of the emails between them (Welfare Avenue serves people in need in Montreal and Toronto).',
  'summary: two or three plain sentences, at most 600 characters: who they are to Welfare Avenue, what they wrote about and how it went. open_item: anything still open, at most 300 characters, or null.',
  'Use only the notes. No quotes, no links, no email addresses, no phone numbers, no other person named, nothing about health, family, money a person owes or a private situation. Never use em dashes. Never mention AI.',
].join('\n');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** 2021-03-12 -> 12 Mar 2021 */
export function dayText(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1] : '';
}

type Row = { date: string; direction: string; mailbox: string; subject: string | null; line: string | null; topic: string | null };

/** The no-model line for a person with one email (5.9). */
export function oneEmail(row: Row): string {
  const line = cutAtContact(row.line || row.subject || '').text;
  return clip('One email, ' + dayText(row.date) + (line ? ': ' + line : '.'), 600);
}
/** The no-model fallback when the model's answer is refused twice: counts and dates only. */
export function countsOnly(rows: Row[], count: number): string {
  const first = rows.length ? dayText(rows[0].date) : '', last = rows.length ? dayText(rows[rows.length - 1].date) : '';
  return count + ' emails' + (first && last ? ', ' + first + ' to ' + last : '') + '.';
}

export function promptOf(rows: Row[]): string {
  return rows.map(r => r.date + ' ' + (r.direction === 'out' ? 'from Welfare Avenue' : 'from them') + (r.topic ? ' [' + r.topic + ']' : '') + ': '
    + clip(r.subject || '', 120) + ' | ' + clip(r.line || '', 160)).join('\n');
}

/** M10: enums must match, lengths are capped, a link, address or phone cuts the text before it. Null when nothing usable is left. */
export function validateSummary(raw: unknown): { value: { topics: string[]; open_item: string | null; summary: string } | null; cuts: number } {
  let cuts = 0;
  // deno-lint-ignore no-explicit-any
  const r = raw as any;
  if (!r || typeof r !== 'object') return { value: null, cuts };
  const topics = Array.isArray(r.topics) ? [...new Set(r.topics.map(String))].filter(t => TOPICS.includes(t as string)).slice(0, 9) as string[] : [];
  const s = cutAtContact(String(r.summary || '').replace(/\s*\u2014\s*/g, ', ')); if (s.cut) cuts++;
  const summary = clip(s.text, 600);
  let open_item: string | null = null;
  if (r.open_item != null && String(r.open_item).trim()) { const o = cutAtContact(String(r.open_item).replace(/\s*\u2014\s*/g, ', ')); if (o.cut) cuts++; open_item = clip(o.text, 300) || null; }
  if (summary.length < 3) return { value: null, cuts };
  return { value: { topics, open_item, summary }, cuts };
}

/** One contact: input, the route (or no model), save. Returns counts only. */
/** onCost (eh-292 fix 2): called after every router call with that call's cost, so the run's spend is recorded call by call (a later failure
 *  loses nothing); it returns true when the run must stop (paused or at its cap), and then no further call is made for this contact. */
export async function summariseContact(deps: SummaryDeps, contactId: number, by: string, onCost?: (usd: number) => Promise<boolean>): Promise<{ saved: boolean; model: string; cost: number; rejected: number; calls: number; stopped: boolean }> {
  const input = await deps.rpc('crm_insight_input', { p_contact: contactId });
  const rows: Row[] = (input && input.rows) || [];
  const count = Number((input && input.count) || 0);
  if (!count || !rows.length) return { saved: false, model: 'none', cost: 0, rejected: 0, calls: 0, stopped: false };
  if (count === 1) {
    await deps.rpc('crm_insight_save', { p_contact: contactId, p_row: { summary: oneEmail(rows[0]), topics: rows[0].topic ? [rows[0].topic] : [], model: 'none', cost: 0 }, p_by: by });
    return { saved: true, model: 'none', cost: 0, rejected: 0, calls: 0, stopped: false };
  }
  let cost = 0, rejected = 0, calls = 0, stopped = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await deps.router('mail_history_insight', { max_tokens: 900, temperature: 0, system: SUMMARY_SYSTEM,
      messages: [{ role: 'user', content: count + ' emails in all; the latest ' + rows.length + ' notes, oldest first:\n' + promptOf(rows) }],
      tools: [RELATIONSHIP_TOOL], tool_choice: { type: 'tool', name: 'relationship' } });
    calls++; cost += res.cost || 0;
    if (onCost && (await onCost(res.cost || 0))) stopped = true;
    // deno-lint-ignore no-explicit-any
    const tu = ((res.out && res.out.content) || []).find((c: any) => c && c.type === 'tool_use');
    const v = validateSummary(tu ? tu.input : null);
    if (v.value) {
      const model = clip(String((res.out && res.out.model) || 'mail_history_insight'), 120);
      try {
        await deps.rpc('crm_insight_save', { p_contact: contactId, p_row: { ...v.value, model, cost }, p_by: by });
        return { saved: true, model, cost, rejected, calls, stopped };
      } catch (_) { /* the database refused it (a check the code missed): try once more, then the counts line */ }
    }
    rejected++;
    if (stopped) break;   // paused or at the cap: no second call; the counts line below costs nothing
  }
  await deps.rpc('crm_insight_save', { p_contact: contactId, p_row: { summary: countsOnly(rows, count), topics: [], model: 'none', cost }, p_by: by });
  return { saved: true, model: 'none', cost, rejected, calls, stopped };
}

/** One step of a run's pass, within a budget: summarise the next contacts, add each cost to the run's spend, stop at the cap. Counts only. */
export async function summaryStep(deps: SummaryDeps, run: number, budgetMs = 100000, by = 'Email history'): Promise<Record<string, unknown>> {
  const deadline = deps.now() + budgetMs;
  // eh-289 I5: the routes are checked at every step
  const problems = await deps.rpc('wa289_ready', {});
  if (Array.isArray(problems) && problems.length) {
    await deps.rpc('wa289_pause', { p_run: run, p_on: true, p_by: 'mail-history (not ready)' });
    return { error: 'not ready', paused: true };
  }
  // eh-292 fix 2: nothing is spent while the run is paused or its spend has reached the cap
  const gate0 = await deps.rpc('wa292_summary_gate', { p_run: run });
  if (gate0 && gate0.stop) return { paused: true, stopped: 'paused or at the cap', summarised: 0, calls: 0 };
  if (!(await deps.rpc('wa289_lease', { p_run: run }))) return { busy: true };
  let done = 0, rejected = 0, calls = 0, paused = false, finished = false;
  try {
    while (deps.now() < deadline) {
      const todo: number[] = (await deps.rpc('wa292_summary_todo', { p_run: run, p_limit: 10 })) || [];
      if (!todo.length) { await deps.rpc('wa292_summary_done', { p_run: run }); finished = true; break; }
      for (const id of todo) {
        if (deps.now() >= deadline) break;
        const gate = await deps.rpc('wa292_summary_gate', { p_run: run });   // before each contact: a Pause or the cap stops the pass here
        if (gate && gate.stop) { paused = true; break; }
        const r = await summariseContact(deps, Number(id), by, async (usd: number) => {
          const spend = await deps.rpc('wa289_spend', { p_run: run, p_mailbox: null, p_usd: usd });
          return !!(spend && spend.paused);
        });
        done++; rejected += r.rejected; calls += r.calls;
        if (r.stopped) { paused = true; break; }
      }
      if (paused) break;
    }
  } finally {
    if (!finished) await deps.rpc('wa289_scan_set', { p_run: run, p_mailbox: null, p_patch: { release: true } });
  }
  return { summarised: done, rejected, calls, paused, finished };
}
