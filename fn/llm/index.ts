// Welfare Avenue: llm (v1.5, 25/09/26)
// The Hub's model router. Every AI job in the Hub sends its request here
// unchanged (Anthropic Messages format) with an x-wa-task header naming
// the job. The router looks the job up in ai_routes, sends the request to
// OpenRouter's Anthropic-compatible endpoint with that job's primary model
// and its fallbacks (the right model for the right task: Sonnet for the
// Brain and transcripts, Haiku and GPT-5 mini for filing and short jobs,
// Kimi K2.6 for long digests, and so on), logs the call to ai_calls
// (model actually used, tokens, cost, time) and returns the Anthropic-
// format response, so every caller keeps parsing content blocks exactly
// as before. Jev (~typesafe/jev-latest, OpenRouter's decision model) is
// served through the same door: a body with {state, questions} goes to
// the Decisions API and comes back with answers and probabilities.
// Admin actions (routes, set_route, test, models) back the "AI models"
// card and need a Hub sign-in; the chat and decide paths accept the
// service role key, the trigger secret or a staff sign-in.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const OR = 'https://openrouter.ai/api';
const SITE = 'https://wa-exec-dashboard.netlify.app';
const JEV = '~typesafe/jev-latest';
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret, x-wa-task, x-wa-caller',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}

type Who = { kind: 'service' | 'secret' | 'staff'; email: string | null; admin: boolean };
async function who(req: Request): Promise<Who | null> {
  const auth = req.headers.get('Authorization') || '';
  if (auth === 'Bearer ' + SERVICE_KEY) return { kind: 'service', email: null, admin: true };
  const given = req.headers.get('x-wa-secret');
  if (given) { try { if (given === (await getSecret('WA_TRIGGER_SECRET'))) return { kind: 'secret', email: null, admin: true }; } catch (_) { /* fall through */ } }
  if (auth.startsWith('Bearer ')) {
    const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data } = await asUser.auth.getUser();
    const email = (data?.user?.email || '').toLowerCase();
    if (email.endsWith('@welfareavenue.com') || email === 'steelmacdonald@gmail.com') {
      let admin = false;
      try { const { data: a } = await asUser.rpc('is_hub_admin'); admin = a === true; } catch (_) { admin = false; }
      return { kind: 'staff', email, admin };
    }
  }
  return null;
}

type Route = { task: string; label: string; chain: string[]; jev: boolean; mode: string; max_tokens: number | null; notes?: string | null };
const routeCache: { at: number; rows: Route[] } = { at: 0, rows: [] };
async function routes(force = false): Promise<Route[]> {
  if (!force && routeCache.rows.length && Date.now() - routeCache.at < 60000) return routeCache.rows;
  const { data } = await svc.from('ai_routes').select('task,label,chain,jev,mode,max_tokens,notes').order('task');
  routeCache.rows = (data || []) as Route[]; routeCache.at = Date.now();
  return routeCache.rows;
}
async function routeFor(task: string): Promise<Route> {
  const rows = await routes();
  return rows.find(r => r.task === task) || rows.find(r => r.task === 'default') ||
    { task: 'default', label: 'Default', chain: ['anthropic/claude-sonnet-5', 'openai/gpt-5', 'moonshotai/kimi-k2.6'], jev: false, mode: 'chain', max_tokens: null };
}

type CallRow = { task: string; caller: string | null; requested_model: string; model?: string | null; ok: boolean; status?: number | null; ms: number; input_tokens?: number | null; output_tokens?: number | null; cost?: number | null; fallback_used?: boolean; error?: string | null; via?: string | null };
async function log(row: CallRow): Promise<void> {
  try { await svc.from('ai_calls').insert(row); } catch (_) { /* the log never blocks a call */ }
}
function orHeaders(key: string): Record<string, string> {
  return { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'HTTP-Referer': SITE, 'X-Title': 'Welfare Avenue Hub' };
}

/* ---- Jev picks the model for a request (routes in 'jev' mode) ---- */
const PRICE: Record<string, [number, number]> = {
  'anthropic/claude-sonnet-5': [2, 10], 'anthropic/claude-haiku-4.5': [1, 5], 'openai/gpt-5': [1.25, 10], 'openai/gpt-5-mini': [0.25, 2],
  'moonshotai/kimi-k2.6': [0.6, 2.5], 'qwen/qwen3.8-flash': [0.05, 0.4], 'google/gemini-3.8-flash': [0.3, 2.5], 'z-ai/glm-5.3-flash': [0.1, 0.4], 'deepseek/deepseek-v4.1-flash': [0.15, 0.6]
};
function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(c => (c && typeof c === 'object' && typeof (c as { text?: unknown }).text === 'string') ? (c as { text: string }).text : '').join(' ');
  return '';
}
async function jevPick(task: string, route: Route, chain: string[], req: Record<string, unknown>, key: string, caller: string | null): Promise<{ model: string; confidence: number | null; why: string } | null> {
  try {
    const priced = (await models(key).catch(() => [])) as { id: string; in_per_m: number | null; out_per_m: number | null }[];
    const price = (id: string): [number, number] => { const m = priced.find(x => x.id === id); return m && m.in_per_m !== null ? [Number(m.in_per_m), Number(m.out_per_m || 0)] : (PRICE[id] || [1, 5]); };
    const msgs = Array.isArray(req.messages) ? req.messages as { role: string; content: unknown }[] : [];
    const lastUser = [...msgs].reverse().find(m => m.role === 'user');
    const inputChars = JSON.stringify(msgs).length + String(textOf(req.system)).length;
    const tools = Array.isArray(req.tools) ? (req.tools as { name?: string }[]).map(t => String(t.name || '')) : [];
    const tc = req.tool_choice as { type?: string; name?: string } | undefined;
    const ids = chain.map((_, i) => 'm' + (i + 1));
    const criteria: Record<string, string> = {};
    chain.forEach((m, i) => { const [pi, po] = price(m); criteria[ids[i]] = m + ' ($' + pi + ' in, $' + po + ' out per million tokens)'; });
    const state = {
      job: route.label, task, notes: route.notes || null,
      request: { system_excerpt: textOf(req.system).slice(0, 500), last_user_excerpt: textOf(lastUser ? lastUser.content : '').slice(0, 900), input_chars: inputChars, turns: msgs.length, tools, forced_tool: tc && tc.type === 'tool' ? tc.name : null, max_tokens: req.max_tokens },
      guidance: 'Welfare Avenue is a small charity: spend as little as possible without harming the result. Cheaper models are right for short, well specified, extraction, classification and lookup jobs. Choose a stronger model when the request needs careful reasoning, nuanced writing for people outside the team, very long context, or reliable multi-step tool use. Known from use: Kimi K2.6 is good for plain writing and summaries but tends to run out of budget on long inputs that force a structured tool call (transcripts); Sonnet and GPT-5 mini complete those reliably. Candidates are listed with their prices.'
    };
    const res = await fetch(OR + '/alpha/decisions', { method: 'POST', headers: orHeaders(key), body: JSON.stringify({ model: JEV, state, questions: { model: { type: 'choice', instructions: 'Which candidate should handle this request? Pick the cheapest one that will do it well.', criteria } } }) });
    if (!res.ok) { await log({ task, caller, requested_model: JEV, ok: false, status: res.status, ms: 0, error: 'jev pick ' + res.status + ' ' + (await res.text()).slice(0, 200), via: 'jev' }); return null; }
    const out = await res.json();
    const a = out?.answers?.model || {};
    const idx = ids.indexOf(String(a.choice || ''));
    const u = out.usage || {};
    await log({ task, caller, requested_model: JEV, model: out.model || JEV, ok: idx >= 0, status: 200, ms: 0, input_tokens: typeof u.input_tokens === 'number' ? u.input_tokens : null, output_tokens: typeof u.output_tokens === 'number' ? u.output_tokens : null, cost: typeof u.cost === 'number' ? u.cost : null, via: 'jev', error: idx >= 0 ? 'picked ' + chain[idx] : 'no pick' });
    if (idx < 0) return null;
    return { model: chain[idx], confidence: typeof a.confidence === 'number' ? a.confidence : null, why: JSON.stringify(a.probabilities || {}) };
  } catch (_) { return null; }
}

/* ---- chat: Anthropic Messages in, Anthropic Messages out ---- */
async function chat(task: string, caller: string | null, body: Record<string, unknown>, key: string, only?: string): Promise<Response> {
  const route = await routeFor(task);
  let chain = (only ? [only] : (route.chain || [])).filter(m => m && !m.startsWith('~typesafe/'));
  if (!chain.length) chain.push('anthropic/claude-sonnet-5');
  const req: Record<string, unknown> = { ...body };
  const wanted = String(req.model || '');
  delete req.model;
  if (!req.max_tokens) req.max_tokens = 1024;
  if (route.max_tokens && Number(req.max_tokens) > route.max_tokens) req.max_tokens = route.max_tokens;
  const streaming = req.stream === true;
  const baseMax = Number(req.max_tokens);
  let via: string = only ? 'test' : 'chain';
  let pick: { model: string; confidence: number | null; why: string } | null = null;
  if (!only && route.mode === 'jev' && chain.length > 1) {
    pick = await jevPick(task, route, chain, req, key, caller);
    if (pick && chain.includes(pick.model)) { chain = [pick.model, ...chain.filter(m => m !== pick!.model)]; via = 'jev'; }
  }
  let lastErr = '';
  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    const fallbacks = chain.slice(i + 1, i + 4);
    // reasoning models (GPT-5, Kimi, Gemini, Qwen) spend output tokens thinking before they answer: keep the
    // thinking short (the Hub's jobs are extraction, filing and writing) and give the answer headroom
    const anthropic = model.startsWith('anthropic/');
    const maxTokens = anthropic ? baseMax : baseMax + 4096;
    const extra: Record<string, unknown> = {};
    if (!anthropic && req.reasoning === undefined && req.thinking === undefined) extra.reasoning = { effort: 'low' };
    const t0 = Date.now();
    let res: Response;
    try {
      res = await fetch(OR + '/v1/messages', { method: 'POST', headers: orHeaders(key), body: JSON.stringify({ ...req, ...extra, model, max_tokens: maxTokens, ...(fallbacks.length ? { fallbacks: fallbacks.map(m => ({ model: m })) } : {}) }) });
    } catch (e) {
      lastErr = model + ': ' + String(e).slice(0, 200);
      await log({ task, caller, requested_model: model, ok: false, ms: Date.now() - t0, error: lastErr, fallback_used: i > 0 });
      continue;
    }
    if (res.ok && streaming) {
      const ms = Date.now() - t0;
      await log({ task, caller, requested_model: model, model, ok: true, status: res.status, ms, fallback_used: i > 0, error: 'stream (usage not recorded)', via });
      return new Response(res.body, { status: 200, headers: { ...CORS, 'Content-Type': res.headers.get('Content-Type') || 'text/event-stream' } });
    }
    const text = await res.text();
    const ms = Date.now() - t0; // the body is the slow part: measure after it arrived
    if (res.ok) {
      // deno-lint-ignore no-explicit-any
      let out: any;
      try { out = JSON.parse(text); } catch (_) { lastErr = model + ': unreadable reply'; await log({ task, caller, requested_model: model, ok: false, status: res.status, ms, error: lastErr, fallback_used: i > 0 }); continue; }
      if (out && out.type === 'error') {
        lastErr = model + ': ' + String(out.error?.message || 'error').slice(0, 300);
        await log({ task, caller, requested_model: model, ok: false, status: res.status, ms, error: lastErr, fallback_used: i > 0 });
        continue;
      }
      const used = String(out.model || model);
      const u = out.usage || {};
      // deno-lint-ignore no-explicit-any
      const blocks = (out.content || []) as any[];
      const tc = req.tool_choice as { type?: string } | undefined;
      const wantTool = !!tc && (tc.type === 'tool' || tc.type === 'any');
      const toolBlock = blocks.find(b => b && b.type === 'tool_use');
      const cut = out.stop_reason === 'max_tokens';
      const emptyTool = toolBlock && (!toolBlock.input || (typeof toolBlock.input === 'object' && !Object.keys(toolBlock.input).length));
      if ((wantTool && !toolBlock) || emptyTool || (cut && (wantTool || !blocks.some(b => b && b.type === 'text' && b.text)))) {
        lastErr = model + ': ' + (cut ? 'cut off at max_tokens' : 'no usable tool call') + ' (stop ' + String(out.stop_reason) + ')';
        await log({ task, caller, requested_model: model, model: used, ok: false, status: res.status, ms, input_tokens: typeof u.input_tokens === 'number' ? u.input_tokens : null, output_tokens: typeof u.output_tokens === 'number' ? u.output_tokens : null, cost: typeof u.cost === 'number' ? u.cost : null, error: lastErr, fallback_used: i > 0, via });
        continue;
      }
      await log({ task, caller, requested_model: model, model: used, ok: true, status: res.status, ms,
        input_tokens: typeof u.input_tokens === 'number' ? u.input_tokens : null, output_tokens: typeof u.output_tokens === 'number' ? u.output_tokens : null,
        cost: typeof u.cost === 'number' ? u.cost : null, fallback_used: i > 0 || (used !== model && !used.startsWith(model)), via });
      out._wa = { task, model: used, ms, cost: typeof u.cost === 'number' ? u.cost : null, attempt: i + 1, wanted: wanted || null, via, pick: pick ? { model: pick.model, confidence: pick.confidence } : null };
      return json(out);
    }
    lastErr = model + ': ' + res.status + ' ' + text.slice(0, 300);
    await log({ task, caller, requested_model: model, ok: false, status: res.status, ms, error: lastErr.slice(0, 500), fallback_used: i > 0 });
    if (res.status === 401 || res.status === 402) break; // account problem: other models will not help
  }
  return json({ type: 'error', error: { type: 'router_error', message: 'No model answered for task ' + task + '. Last: ' + lastErr } }, 502);
}

/* ---- decide: Jev, OpenRouter's decision model ---- */
async function decide(task: string, caller: string | null, body: Record<string, unknown>, key: string): Promise<Response> {
  const model = String(body.model || JEV);
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(OR + '/alpha/decisions', { method: 'POST', headers: orHeaders(key), body: JSON.stringify({ model, state: body.state, questions: body.questions }) });
  } catch (e) {
    const err = String(e).slice(0, 300);
    await log({ task, caller, requested_model: model, ok: false, ms: Date.now() - t0, error: err });
    return json({ error: 'Jev unreachable: ' + err }, 502);
  }
  const ms = Date.now() - t0;
  const text = await res.text();
  if (!res.ok) {
    await log({ task, caller, requested_model: model, ok: false, status: res.status, ms, error: (res.status + ' ' + text).slice(0, 500) });
    return json({ error: 'Jev ' + res.status + ': ' + text.slice(0, 300) }, 502);
  }
  // deno-lint-ignore no-explicit-any
  let out: any; try { out = JSON.parse(text); } catch (_) { return json({ error: 'Jev: unreadable reply' }, 502); }
  const u = out.usage || {};
  await log({ task, caller, requested_model: model, model: out.model || model, ok: true, status: 200, ms,
    input_tokens: typeof u.input_tokens === 'number' ? u.input_tokens : null, output_tokens: typeof u.output_tokens === 'number' ? u.output_tokens : null, cost: typeof u.cost === 'number' ? u.cost : null });
  out._wa = { task, model: out.model || model, ms, cost: typeof u.cost === 'number' ? u.cost : null };
  return json(out);
}

/* ---- admin: the AI models card ---- */
const modelCache: { at: number; rows: unknown[] } = { at: 0, rows: [] };
const VENDORS = ['anthropic/', 'openai/', 'moonshotai/', 'qwen/', 'google/', 'z-ai/', 'deepseek/', 'x-ai/', 'mistralai/', 'meta-llama/'];
async function models(key: string): Promise<unknown[]> {
  if (modelCache.rows.length && Date.now() - modelCache.at < 600000) return modelCache.rows;
  const res = await fetch(OR + '/v1/models', { headers: orHeaders(key) });
  if (!res.ok) return modelCache.rows;
  const body = await res.json();
  // deno-lint-ignore no-explicit-any
  const rows = ((body.data || []) as any[]).filter(m => VENDORS.some(v => String(m.id).startsWith(v)) && !/:free$|:beta$|:thinking$/.test(String(m.id)))
    .map(m => ({ id: m.id, name: m.name, context: m.context_length || null, in_per_m: m.pricing ? Math.round(Number(m.pricing.prompt) * 1e6 * 100) / 100 : null, out_per_m: m.pricing ? Math.round(Number(m.pricing.completion) * 1e6 * 100) / 100 : null }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  modelCache.rows = rows; modelCache.at = Date.now();
  return rows;
}
const MODEL_ID = /^[~a-z0-9._-]+\/[a-z0-9._:-]+$/i;
async function admin(action: string, body: Record<string, unknown>, me: Who, key: string): Promise<Response> {
  if (action === 'routes') {
    const [rows, u7, u30] = await Promise.all([routes(true), svc.rpc('ai_usage', { days: 7 }), svc.rpc('ai_usage', { days: 30 })]);
    const { data: recent } = await svc.from('ai_calls').select('created_at,task,caller,requested_model,model,ok,ms,cost,error,fallback_used').order('created_at', { ascending: false }).limit(40);
    return json({ ok: true, routes: rows, usage7: u7.data || [], usage30: u30.data || [], recent: recent || [], jev: JEV });
  }
  if (action === 'models') return json({ ok: true, models: await models(key) });
  if (action === 'set_route') {
    if (!me.admin) return json({ error: 'Only Hub admins can change routes.' }, 403);
    const task = String(body.task || '').trim().toLowerCase();
    if (!/^[a-z0-9_]{2,40}$/.test(task)) return json({ error: 'Task names are lower-case letters, digits and underscores.' }, 400);
    const chain = (Array.isArray(body.chain) ? body.chain : []).map(x => String(x).trim()).filter(Boolean);
    if (!chain.length || chain.length > 6) return json({ error: 'Give one to six model ids.' }, 400);
    const bad = chain.filter(m => !MODEL_ID.test(m));
    if (bad.length) return json({ error: 'Not a model id: ' + bad.join(', ') }, 400);
    const prev = (await routes(true)).find(r => r.task === task);
    const row: Record<string, unknown> = { task, chain, updated_at: new Date().toISOString(), updated_by: me.email || me.kind };
    if (typeof body.label === 'string' && body.label.trim()) row.label = body.label.trim().slice(0, 80);
    else if (!prev) row.label = task;
    if (typeof body.notes === 'string') row.notes = body.notes.trim().slice(0, 300);
    if (typeof body.jev === 'boolean') row.jev = body.jev;
    if (body.max_tokens === null || typeof body.max_tokens === 'number') row.max_tokens = body.max_tokens;
    const { error } = await svc.from('ai_routes').upsert(row, { onConflict: 'task' });
    if (error) return json({ error: error.message }, 500);
    try { await svc.from('change_log').insert({ entity_type: 'ai_route', entity_id: task, field: 'chain', old_value: prev ? prev.chain.join(' > ') : null, new_value: chain.join(' > '), changed_by: me.email || me.kind }); } catch (_) { /* audit */ }
    routeCache.at = 0;
    return json({ ok: true, route: (await routes(true)).find(r => r.task === task) });
  }
  if (action === 'delete_route') {
    if (!me.admin) return json({ error: 'Only Hub admins can change routes.' }, 403);
    const task = String(body.task || '').trim().toLowerCase();
    if (task === 'default' || task === 'decide') return json({ error: 'That route stays.' }, 400);
    await svc.from('ai_routes').delete().eq('task', task);
    routeCache.at = 0;
    return json({ ok: true });
  }
  if (action === 'test') {
    const task = String(body.task || 'default');
    if (task === 'decide') {
      const r = await decide(task, 'test', { state: 'The Hub is checking that Jev answers.', questions: { alive: { type: 'noul', instructions: 'Is the Hub checking that Jev answers?' } } }, key);
      const out = await r.json();
      return json({ ok: r.ok, task, model: out?._wa?.model || JEV, ms: out?._wa?.ms || null, cost: out?._wa?.cost ?? null, answer: out?.answers?.alive ?? null, error: out?.error || null }, 200);
    }
    const only = typeof body.model === 'string' && MODEL_ID.test(body.model) ? body.model : undefined;
    const r = await chat(task, 'test', { max_tokens: 64, temperature: 0, messages: [{ role: 'user', content: 'Reply with the single word OK.' }] }, key, only);
    const out = await r.json();
    // deno-lint-ignore no-explicit-any
    const textOut = ((out?.content || []) as any[]).filter(c => c.type === 'text').map(c => c.text).join(' ').trim();
    return json({ ok: r.ok, task, model: out?._wa?.model || null, ms: out?._wa?.ms || null, cost: out?._wa?.cost ?? null, reply: textOut || null, error: out?.error?.message || null }, 200);
  }
  return json({ error: 'unknown action' }, 400);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const me = await who(req);
  if (!me) return json({ error: 'unauthorized' }, 401);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch (_) { return json({ error: 'JSON body expected' }, 400); }
  let key: string;
  try { key = await getSecret('OPENROUTER_API_KEY'); } catch (_) { return json({ type: 'error', error: { type: 'router_error', message: 'OPENROUTER_API_KEY is not set' } }, 500); }
  const task = String(req.headers.get('x-wa-task') || body.task || 'default').toLowerCase().replace(/[^a-z0-9_:]/g, '').slice(0, 40) || 'default';
  const caller = (req.headers.get('x-wa-caller') || (typeof body.caller === 'string' ? body.caller : null) || (me.kind === 'staff' ? 'hub:' + me.email : null));
  const action = typeof body.action === 'string' ? body.action : null;
  if (action) {
    if (me.kind === 'staff' || me.admin) return admin(action, body, me, key);
    return json({ error: 'unauthorized' }, 401);
  }
  if (body.questions && typeof body.questions === 'object' && !body.messages) return decide(task, caller, body, key);
  if (!Array.isArray(body.messages)) return json({ type: 'error', error: { type: 'invalid_request', message: 'messages[] expected (Anthropic Messages format) or {state, questions} for a decision' } }, 400);
  delete body.task; delete body.caller;
  return chat(task, caller, body, key);
});
