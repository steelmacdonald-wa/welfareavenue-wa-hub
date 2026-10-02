// Welfare Avenue: grant-write (v1, 02/10/26, wave193): the grant-writing assistant of the Fundraising app.
// Steel (01/10/26): "build a tool that helps with grant writing and the approach we should take to winning grants going forward
// using industry expert knowledge from research", and "Using our past grant applications for reference on future ones". His choice:
// AI drafts from a fact base and the past applications, with the expert playbook as its rules; writers edit and export.
//
// What it drafts from, every time: the fact base (fund_facts: verified facts used as given, needs_check facts used and flagged,
// conflict facts never used as numbers), the grant and its funder (eligibility, what they fund, our history with them), the three
// to five past applications and letters closest to the questions (fund_documents, full-text search) and the standard-answer bank,
// and the playbook's writing rules and section skeletons (fund_settings.playbook). Every call goes through the llm router (route
// grant_write, Sonnet first); nothing is sent anywhere, the draft is saved in fund_drafts for the writer to edit.
// Who: a staff member who can open the Fundraising app (wa_fund_ok).
// Actions (POST {action}):
//   context {grant_id?}                                      what the assistant would use (facts by status, the documents it would cite)
//   draft {grant_id?, title?, lang?, notes?, questions: [{q, limit}], draft_id?}
//                                                            answers every question; saves a new draft (or updates draft_id); returns it
//   review {draft_id}                                        reads the draft as a reviewer would: per answer, what is weak or unsupported;
//                                                            the numbers that disagree across answers; what is missing; nothing is changed
//   fit {grant_id}                                           scores the grant's fit (the gates and the seven dimensions); saves fit,
//                                                            fit_score and gates on the grant
// Never: invents a number (a figure not in the facts becomes a [confirm: ...] placeholder), sends or submits anything, reads the
//   facts marked conflict as true.
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
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

async function staff(req: Request): Promise<{ email: string } | null> {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  if (!email) return null;
  const { data: ok } = await asUser.rpc('wa_fund_ok');
  return ok === true ? { email } : null;
}

/* ---------- the material ---------- */
function section(md: string, heading: RegExp, next: RegExp): string {
  const lines = md.split('\n'); let on = false; const out: string[] = [];
  for (const l of lines) {
    if (!on && heading.test(l)) { on = true; out.push(l); continue; }
    if (on && next.test(l)) break;
    if (on) out.push(l);
  }
  return out.join('\n');
}
async function playbook(): Promise<{ rules: string; sections: string; fit: string }> {
  const { data } = await svc.from('fund_settings').select('value').eq('key', 'playbook').maybeSingle();
  const md = String((data && data.value && data.value.markdown) || '');
  const rules = section(md, /^## 6\./, /^## 7\./).slice(0, 9000);
  const sections = section(md, /^## 4\./, /^## 5\./).slice(0, 16000);
  const fit = section(md, /^## 2\./, /^## 3\./).slice(0, 9000);
  return { rules, sections, fit };
}
async function facts(): Promise<Row[]> {
  const { data } = await svc.from('fund_facts').select('key, category, title, body, body_fr, source, status, sort').neq('status', 'retired').order('sort');
  return data || [];
}
function factBlock(F: Row[], lang: string): string {
  return F.map(f => '[' + f.key + '] (' + f.status.toUpperCase() + '; ' + f.category + '; source: ' + (f.source || 'unknown') + ')\n' + f.title + ': ' + ((lang === 'fr' && f.body_fr) ? f.body_fr : f.body)).join('\n\n');
}
async function grantContext(grantId: number | null): Promise<{ grant: Row | null; funder: Row | null; text: string }> {
  if (!grantId) return { grant: null, funder: null, text: 'No grant chosen: write for a general funder of community food programs.' };
  const { data: g } = await svc.from('fund_grants').select('*').eq('id', grantId).maybeSingle();
  if (!g) return { grant: null, funder: null, text: 'No grant chosen.' };
  const { data: f } = await svc.from('fund_funders').select('*').eq('id', g.funder_id).maybeSingle();
  const parts = ['Funder: ' + (f?.name || '?') + (f?.kind ? ' (' + f.kind + ', ' + (f.region || '') + ')' : ''), 'Program: ' + g.program + (g.title ? ' (our project: ' + g.title + ')' : ''), g.amount_ask ? 'Our ask: $' + g.amount_ask : '', g.deadline ? 'Deadline: ' + g.deadline + (g.deadline_note ? ' (' + g.deadline_note + ')' : '') : (g.deadline_note ? 'Deadline: ' + g.deadline_note : ''), f?.eligibility ? 'Eligibility: ' + f.eligibility : '', f?.funds_what ? 'What they fund: ' + f.funds_what : '', f?.fit_note ? 'Our fit note: ' + f.fit_note : '', f?.relationship ? 'Our history with them: ' + f.relationship : '', g.program_area ? 'What the money is for: ' + g.program_area : '', g.partner ? 'Partner: ' + g.partner : '', g.notes ? 'Notes on the grant: ' + String(g.notes).slice(0, 1500) : ''].filter(Boolean);
  return { grant: g, funder: f || null, text: parts.join('\n') };
}
async function documents(query: string, grant: Row | null, limit = 4): Promise<Row[]> {
  const out: Row[] = [];
  // the standard-answer bank first
  const { data: bank } = await svc.from('fund_documents').select('id, title, kind, doc_date, text').eq('kind', 'answers').order('doc_date', { ascending: false }).limit(1);
  (bank || []).forEach(d => out.push(d));
  if (grant) {
    const { data: same } = await svc.from('fund_documents').select('id, title, kind, doc_date, text').or('grant_id.eq.' + grant.id + ',funder_id.eq.' + grant.funder_id).in('kind', ['application', 'loi', 'letter']).order('doc_date', { ascending: false }).limit(2);
    (same || []).forEach(d => { if (!out.some(x => x.id === d.id)) out.push(d); });
  }
  const q = query.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 3).slice(0, 40).join(' ');
  if (q) {
    const { data: hits } = await svc.from('fund_documents').select('id, title, kind, doc_date, text').in('kind', ['application', 'loi', 'letter', 'answers', 'report']).textSearch('fts', q, { type: 'websearch', config: 'simple' }).limit(limit);
    (hits || []).forEach(d => { if (!out.some(x => x.id === d.id)) out.push(d); });
  }
  if (out.length < 3) {
    const { data: recent } = await svc.from('fund_documents').select('id, title, kind, doc_date, text').in('kind', ['application', 'loi']).order('doc_date', { ascending: false }).limit(3);
    (recent || []).forEach(d => { if (!out.some(x => x.id === d.id)) out.push(d); });
  }
  return out.slice(0, 5);
}
function docBlock(D: Row[]): string {
  return D.map(d => '### Document ' + d.id + ': ' + d.title + ' (' + d.kind + (d.doc_date ? ', ' + d.doc_date : '') + ')\n' + String(d.text || '').slice(0, d.kind === 'answers' ? 9000 : 6000)).join('\n\n');
}

/* ---------- the model ---------- */
// deno-lint-ignore no-explicit-any
async function call(task: string, system: string, user: string, tool: any, maxTokens: number): Promise<{ input: Row | null; cost: number; model: string; error?: string }> {
  const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
    method: 'POST', headers: { Authorization: 'Bearer ' + SERVICE_KEY, 'x-wa-task': task, 'x-wa-caller': 'grant-write', 'Content-Type': 'application/json' },
    body: JSON.stringify({ max_tokens: maxTokens, temperature: 0.3, system, messages: [{ role: 'user', content: user }], tools: [tool], tool_choice: { type: 'tool', name: tool.name } })
  });
  const text = await res.text();
  // deno-lint-ignore no-explicit-any
  let out: any = null; try { out = JSON.parse(text); } catch (_) { out = null; }
  if (!res.ok || !out || out.type === 'error') return { input: null, cost: 0, model: '', error: 'The model did not answer (' + res.status + '): ' + text.slice(0, 200) };
  // deno-lint-ignore no-explicit-any
  const tu = (out.content || []).find((b: any) => b && b.type === 'tool_use');
  return { input: tu && tu.input ? tu.input : null, cost: Number(out._wa?.cost || 0) || 0, model: String(out._wa?.model || ''), error: tu ? undefined : 'no tool call' };
}
const VOICE = 'Welfare Avenue\'s voice: plain Canadian English (or plain Quebec French when asked), credible, warm and accountable; short sentences; concrete numbers with their year; "people experiencing homelessness", "guests", "volunteers"; no em dashes (use a comma, a colon or a full stop), no buzzwords ("innovative", "dynamic", "passionate", "impactful"), no exclamation marks. Say we, our, Welfare Avenue.';
const WRITE_TOOL = {
  name: 'write_answers',
  description: 'The answers to the funder\'s questions, one per question, in order.',
  input_schema: { type: 'object', properties: {
    answers: { type: 'array', items: { type: 'object', properties: {
      q: { type: 'string', description: 'The question, as given' },
      answer: { type: 'string', description: 'The answer, within the word limit, ready to paste' },
      words: { type: 'integer' },
      facts: { type: 'array', items: { type: 'string' }, description: 'The keys of the facts used ([key])' },
      refs: { type: 'array', items: { type: 'integer' }, description: 'The ids of the past documents drawn on' },
      warnings: { type: 'array', items: { type: 'string' }, description: 'What the writer must check before sending: a needs_check fact used, a [confirm: ...] placeholder, a claim with no fact behind it, a limit that forced a cut' }
    }, required: ['q', 'answer', 'words', 'facts', 'refs', 'warnings'] } },
    consistency: { type: 'array', items: { type: 'string' }, description: 'Numbers or claims that must agree across the answers and the budget (and do or do not)' },
    reviewer_note: { type: 'string', description: 'Two sentences to the writer: the strongest point of the draft and the weakest' }
  }, required: ['answers', 'consistency', 'reviewer_note'] }
};
const REVIEW_TOOL = {
  name: 'review_answers',
  description: 'A program officer\'s review of the draft answers.',
  input_schema: { type: 'object', properties: {
    answers: { type: 'array', items: { type: 'object', properties: {
      q: { type: 'string' }, score: { type: 'integer', description: '0 to 10 as a reviewer would score it' },
      what_works: { type: 'string' }, what_is_weak: { type: 'string' }, unsupported: { type: 'array', items: { type: 'string' }, description: 'Claims and numbers with no fact or document behind them' }, suggestion: { type: 'string', description: 'The one change that would raise the score most' }
    }, required: ['q', 'score', 'what_works', 'what_is_weak', 'unsupported', 'suggestion'] } },
    consistency: { type: 'array', items: { type: 'string' } },
    missing: { type: 'array', items: { type: 'string' }, description: 'What the funder asked for that the draft does not give' },
    overall: { type: 'string', description: 'Three sentences: would this win, and why or why not' }
  }, required: ['answers', 'consistency', 'missing', 'overall'] }
};
const FIT_TOOL = {
  name: 'score_fit',
  description: 'The go/no-go screen of the playbook: the hard gates, then the seven weighted dimensions.',
  input_schema: { type: 'object', properties: {
    gates: { type: 'array', items: { type: 'object', properties: { gate: { type: 'string' }, result: { type: 'string', enum: ['pass', 'fail', 'unknown'] }, note: { type: 'string' } }, required: ['gate', 'result', 'note'] } },
    dimensions: { type: 'array', items: { type: 'object', properties: { name: { type: 'string', enum: ['eligibility', 'alignment', 'geography', 'amount', 'capacity', 'relationship', 'odds'] }, weight: { type: 'integer' }, score: { type: 'integer', description: '0 to 5' }, note: { type: 'string' } }, required: ['name', 'weight', 'score', 'note'] } },
    total: { type: 'integer', description: 'The weighted total, 0 to 100 (sum of score/5 x weight)' },
    verdict: { type: 'string', enum: ['go', 'conditional', 'no'] },
    first_step: { type: 'string', description: 'The one thing to do first (a call, a question to the program officer, a document)' },
    hours: { type: 'integer', description: 'The volunteer hours the application would take' }
  }, required: ['gates', 'dimensions', 'total', 'verdict', 'first_step', 'hours'] }
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const me = await staff(req);
  if (!me) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'context');
  try {
    const grantId = body.grant_id ? Number(body.grant_id) : null;
    if (action === 'context') {
      const F = await facts(); const ctx = await grantContext(grantId);
      const D = await documents(String(body.query || ctx.text || ''), ctx.grant, 4);
      return json({ ok: true, grant: ctx.grant, funder: ctx.funder, facts: F.map(f => ({ key: f.key, title: f.title, status: f.status, category: f.category })), documents: D.map(d => ({ id: d.id, title: d.title, kind: d.kind, doc_date: d.doc_date })) });
    }
    if (action === 'draft') {
      const qs: Array<{ q: string; limit?: number }> = Array.isArray(body.questions) ? body.questions.filter((x: Row) => x && String(x.q || '').trim()).map((x: Row) => ({ q: String(x.q).trim().slice(0, 1500), limit: x.limit ? Number(x.limit) : undefined })).slice(0, 25) : [];
      if (!qs.length) return json({ error: 'no questions' }, 400);
      const lang = body.lang === 'fr' ? 'fr' : 'en';
      const F = await facts(); const P = await playbook(); const ctx = await grantContext(grantId);
      const D = await documents(qs.map(x => x.q).join(' '), ctx.grant, 4);
      const system = 'You are Welfare Avenue\'s grant writer, drafting answers to a funder\'s questions. ' + VOICE + '\n\nHow to use the material:\n- Facts marked VERIFIED are true as written: use them, and cite their keys in facts.\n- Facts marked NEEDS_CHECK may be used, but every answer that uses one gets a warning naming it.\n- Facts marked CONFLICT hold figures the documents disagree on: never state those numbers. Write a placeholder like [confirm: total meals since 2020] and add a warning.\n- Past documents show how Welfare Avenue has answered before: reuse what fits, in today\'s words, and cite their ids in refs; never copy a number from them that the facts do not confirm (placeholder and warning instead).\n- Mirror the funder\'s vocabulary from the question and the program notes; answer exactly the question asked, in the order asked, within the word limit (a limit is a hard cap: count).\n- Lead with the answer, then the evidence; one idea per paragraph; a number in every paragraph that makes a claim; outputs and outcomes kept apart; need is a community problem, never our lack of money; the budget, the timeline and the narrative must agree.\n- Write in ' + (lang === 'fr' ? 'French (Quebec), natively, not translated' : 'English') + '.\n\nThe writing rules:\n' + P.rules + '\n\nThe section skeletons and examples:\n' + P.sections;
      const user = 'The grant:\n' + ctx.text + (body.notes ? '\n\nThe writer\'s notes: ' + String(body.notes).slice(0, 3000) : '') + '\n\nThe funder\'s questions:\n' + qs.map((x, i) => (i + 1) + '. ' + x.q + (x.limit ? ' [limit: ' + x.limit + ' words]' : '')).join('\n') + '\n\nThe fact base:\n' + factBlock(F, lang) + '\n\nPast applications and the answer bank:\n' + docBlock(D) + '\n\nAnswer every question with the tool.';
      const r = await call('grant_write', system, user, WRITE_TOOL, 8000);
      if (!r.input || r.error) return json({ error: r.error || 'no answer' }, 502);
      const answers = Array.isArray(r.input.answers) ? r.input.answers : [];
      const questions = qs.map((x, i) => { const a = answers[i] || answers.find((y: Row) => y.q === x.q) || {}; const ans = String(a.answer || ''); return { q: x.q, limit: x.limit || null, answer: ans, words: ans ? ans.trim().split(/\s+/).length : 0, facts: Array.isArray(a.facts) ? a.facts : [], refs: Array.isArray(a.refs) ? a.refs : [], warnings: Array.isArray(a.warnings) ? a.warnings : [] }; });
      const title = String(body.title || (ctx.funder ? ctx.funder.name + ': ' + (ctx.grant?.program || '') : 'Draft') + ' (' + new Date().toISOString().slice(0, 10) + ')').slice(0, 200);
      let draftId = body.draft_id ? Number(body.draft_id) : null;
      const rec = { grant_id: grantId, title, lang, questions, notes: [String(body.notes || ''), 'Consistency: ' + (Array.isArray(r.input.consistency) ? r.input.consistency.join(' | ') : ''), 'Reviewer note: ' + String(r.input.reviewer_note || '')].filter(Boolean).join('\n'), updated_by: me.email };
      if (draftId) { const { error } = await svc.from('fund_drafts').update(rec).eq('id', draftId); if (error) return json({ error: error.message }, 500); }
      else { const { data: d, error } = await svc.from('fund_drafts').insert({ ...rec, created_by: me.email }).select('id').single(); if (error || !d) return json({ error: error?.message || 'save failed' }, 500); draftId = d.id; }
      if (grantId) { await svc.from('fund_grant_log').insert({ grant_id: grantId, who: me.email, kind: 'draft', text: 'Drafted ' + questions.length + ' answer' + (questions.length > 1 ? 's' : '') + ' with the assistant (draft ' + draftId + ', ' + r.model + ').' }); if (ctx.grant && ['watching', 'found', 'screened', 'relationship'].includes(ctx.grant.stage)) await svc.from('fund_grants').update({ stage: 'drafting', updated_by: me.email }).eq('id', grantId); }
      return json({ ok: true, draft_id: draftId, title, lang, questions, consistency: r.input.consistency || [], reviewer_note: r.input.reviewer_note || '', documents: D.map(d => ({ id: d.id, title: d.title })), cost: r.cost, model: r.model });
    }
    if (action === 'review') {
      const { data: d } = await svc.from('fund_drafts').select('*').eq('id', Number(body.draft_id)).maybeSingle();
      if (!d) return json({ error: 'no such draft' }, 404);
      const F = await facts(); const P = await playbook(); const ctx = await grantContext(d.grant_id);
      const qs: Row[] = Array.isArray(d.questions) ? d.questions : [];
      const system = 'You are a program officer at a Canadian foundation reading forty applications, scoring this one against its own criteria and the rules below. Be specific and fair; quote the words you object to. ' + VOICE.replace('Welfare Avenue\'s voice', 'Write your review in plain English') + '\n\nThe rules:\n' + P.rules + '\n\nThe fit screen:\n' + P.fit;
      const user = 'The grant:\n' + ctx.text + '\n\nThe fact base (what Welfare Avenue can prove; CONFLICT facts are figures in dispute):\n' + factBlock(F, d.lang || 'en') + '\n\nThe draft answers:\n' + qs.map((x: Row, i: number) => (i + 1) + '. Q: ' + x.q + (x.limit ? ' [limit ' + x.limit + ' words]' : '') + '\nA: ' + x.answer).join('\n\n') + '\n\nReview with the tool.';
      const r = await call('grant_write', system, user, REVIEW_TOOL, 6000);
      if (!r.input || r.error) return json({ error: r.error || 'no answer' }, 502);
      if (d.grant_id) await svc.from('fund_grant_log').insert({ grant_id: d.grant_id, who: me.email, kind: 'draft', text: 'The assistant reviewed draft ' + d.id + ': ' + String(r.input.overall || '').slice(0, 300) });
      return json({ ok: true, draft_id: d.id, review: r.input, cost: r.cost, model: r.model });
    }
    if (action === 'fit') {
      if (!grantId) return json({ error: 'grant_id required' }, 400);
      const F = await facts(); const P = await playbook(); const ctx = await grantContext(grantId);
      if (!ctx.grant) return json({ error: 'no such grant' }, 404);
      const system = 'You run the go/no-go screen of a small charity\'s grants playbook. Apply the hard gates first, then score the seven dimensions 0 to 5 with the weights below (eligibility 15, alignment 20, geography 10, amount 15, capacity 15, relationship 10, odds 15), total = sum of score/5 x weight, rounded. Verdict: go at 70+, conditional 55 to 69, no under 55. Be honest: say unknown when the material does not tell you.\n\nThe screen:\n' + P.fit;
      const user = 'The grant and funder:\n' + ctx.text + '\n\nWhat we know about Welfare Avenue:\n' + factBlock(F.filter(f => ['mission', 'numbers', 'programs', 'people', 'budget', 'history'].includes(f.category)), 'en').slice(0, 14000) + '\n\nScore it with the tool.';
      const r = await call('grant_write', system, user, FIT_TOOL, 3000);
      if (!r.input || r.error) return json({ error: r.error || 'no answer' }, 502);
      const total = Math.max(0, Math.min(100, Math.round(Number(r.input.total) || 0)));
      await svc.from('fund_grants').update({ fit_score: total, fit: { dimensions: r.input.dimensions || [], verdict: r.input.verdict, first_step: r.input.first_step, hours: r.input.hours, scored_at: new Date().toISOString(), by: me.email, model: r.model }, gates: r.input.gates || [], updated_by: me.email }).eq('id', grantId);
      await svc.from('fund_grant_log').insert({ grant_id: grantId, who: me.email, kind: 'note', text: 'Fit scored ' + total + ' (' + String(r.input.verdict || '') + ') with the assistant. First step: ' + String(r.input.first_step || '').slice(0, 200) });
      return json({ ok: true, grant_id: grantId, fit_score: total, fit: r.input, cost: r.cost, model: r.model });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 400) }, 500);
  }
});
