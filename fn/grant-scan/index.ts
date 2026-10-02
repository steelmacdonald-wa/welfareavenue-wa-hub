// Welfare Avenue: grant-scan (v3, 02/10/26, wave193): the weekly grant scanner of the Fundraising app.
// Steel (01/10/26): "build out a grant tracker and scanner that looks for grants that Welfare Avenue can win" and "for new grants
// that come in they should be sent to the grants channel on slack - i just added the hub to it". His choices: a curated funder
// watchlist re-read for new calls plus an AI web-search pass, weekly, with new finds landing in Grants > Found for you; the new
// finds posted to #grants.
//
// A run is one row in fund_scan_runs and works in steps (v2: the first test run showed the function's wall clock ends a long run,
// so each step does about a minute of work in the background (EdgeRuntime.waitUntil), writes what it found, then calls
// this function again with {action: 'continue'} for the next step; a source counts as read for the run once its last_checked is
// after the run's start; one invocation lives 150 seconds). A step:
//   1. fund_sources of kind funder_page and aggregator: fetch the page, keep its text, hash it; when the text changed since the last
//      run (or was never read), the model reads it (llm route grant_extract, cheap models) and records the open or upcoming calls.
//   2. fund_sources of kind search (once no page is left, one a step): the question goes to the model with web search (llm route
//      grant_scan: DeepSeek with OpenRouter's :online plugin, Exa results, a few cents; Sonnet's own search cost $0.75 a question);
//      the pages it cites and its summary then go to the extract route, which records the calls, each with its URL.
//   3. Every call is matched to fund_funders (name and aliases) and fund_grants (same funder and program): known ones are kept as
//      'known' and not shown; a screened-out funder is dropped; repeats within the run or of the last 90 days are 'duplicate';
//      the rest are 'new' and wait in Found for you (fund_scan_finds), where a person keeps or dismisses them (fund_find_decide).
//   4. The last step: when the run was not a test and fund_settings.scanner.post_new_finds is on, one message with the new finds
//      that score at least min_fit_to_post goes to the Slack channel in the settings (#grants, C041VL0LEBG; Steel added the Hub
//      to it on 01/10/26). A test run posts nothing.
// Who: the trigger secret (the Monday cron wa-grant-scan, and the function calling itself), or a staff member who can open the
// Fundraising app (Scan now), or an admin.
// Actions (POST {action}):
//   scan {trigger?: schedule|person|test}   starts a run in the background, answers {run_id}
//   continue {run_id}                       the next step of a run (the secret only)
//   status                                  the last five runs and the count of new finds waiting
//   check {source_id}                       reads one source now and answers what the model found, writing nothing (admins)
// Never: posts anywhere but the channel in the settings; never from a test run; never writes a find's decision (people do, through
//   fund_find_decide); never calls a model directly (every call goes through the llm router).
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
const HUB = 'https://hub.welfareavenue.com';
// one invocation lives 150 seconds here (the project's wall-clock limit, measured 02/10/26): a step takes no new page after
// 55 s (a page is a 20 s fetch and a 35 s read at worst), runs at most one web search (75 s, then a 35 s read), then chains
const STEP_BUDGET_MS = 55000;    // no new page after this
const SEARCH_START_MS = 25000;   // a search starts only this early in a step
const MAX_STEPS = 24;            // a run that still has work after this many steps stops (a safety net, not a plan)
const LLM_SEARCH_MS = 75000;     // one web search
const LLM_READ_MS = 35000;       // one read of a page or an answer
const STUCK_MIN = 45;            // a run still 'running' after this long was interrupted: it is closed as an error

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
type Who = { kind: 'secret' | 'staff'; email: string | null; admin: boolean };
async function who(req: Request): Promise<Who | null> {
  const given = req.headers.get('x-wa-secret');
  if (given) { try { if (given === (await getSecret('WA_TRIGGER_SECRET'))) return { kind: 'secret', email: null, admin: true }; } catch (_) { /* no */ } }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  if (!email) return null;
  const { data: ok } = await asUser.rpc('wa_fund_ok');
  if (ok !== true) return null;
  let admin = false;
  try { const { data: a } = await asUser.rpc('is_hub_admin'); admin = a === true; } catch (_) { admin = false; }
  return { kind: 'staff', email, admin };
}

/* ---------- text helpers ---------- */
function fold(s: unknown): string { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
const STOP = new Set(['the', 'of', 'du', 'de', 'la', 'le', 'les', 'des', 'canada', 'canadian', 'foundation', 'fondation', 'inc', 'group', 'financial', 'corporation', 'company', 'limited', 'ltd', 'and', 'et', 'pour', 'for', 'a', 'to', 'via', 'program', 'programme', 'grant', 'grants', 'fund', 'fonds']);
function norm(s: unknown): string { return fold(s).replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w)).join(' '); }
function words(s: unknown): Set<string> { return new Set(norm(s).split(' ').filter(w => w.length > 2)); }
function overlap(a: Set<string>, b: Set<string>): number { if (!a.size || !b.size) return 0; let n = 0; a.forEach(w => { if (b.has(w)) n++; }); return n / Math.min(a.size, b.size); }
function htmlToText(html: string): string {
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<(nav|footer|header|aside)[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n').replace(/<[^>]+>/g, ' ');
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
  return s.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}
async function sha(s: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
}
function isoDate(s: unknown): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return isNaN(d.getTime()) ? null : m[1] + '-' + m[2] + '-' + m[3];
}
function today(): string { return new Date().toISOString().slice(0, 10); }
function money(n: unknown): string { const v = Number(n); return isFinite(v) && v > 0 ? '$' + Math.round(v).toLocaleString('en-CA') : ''; }

/* ---------- the model, through the router ---------- */
const CALLS_TOOL = {
  name: 'record_calls',
  description: 'Record every grant, funding call, donation program or in-kind program found that a small volunteer-run Canadian charity could apply to now or in the coming months. Record nothing that is closed for good, nothing for individuals, nothing that requires paid staff when that is stated. One entry per funder and program, the twelve most relevant at most.',
  input_schema: {
    type: 'object',
    properties: {
      calls: { type: 'array', items: { type: 'object', properties: {
        funder: { type: 'string', description: 'The organization that gives the money, as it names itself' },
        program: { type: 'string', description: 'The program or call name' },
        url: { type: 'string', description: 'The page that describes it (the funder\'s own page when possible)' },
        summary: { type: 'string', description: 'Two or three sentences: what it funds, for whom, how one applies' },
        amount_min: { type: 'number' }, amount_max: { type: 'number' },
        deadline: { type: 'string', description: 'The next deadline as YYYY-MM-DD when a date is given, else empty' },
        deadline_text: { type: 'string', description: 'The deadline in words: rolling, quarterly, expected month, closed for 2026 and reopens in...' },
        eligibility: { type: 'string', description: 'Who may apply, in one or two sentences, with the exclusions that matter for us' },
        region: { type: 'string', enum: ['canada', 'quebec', 'montreal', 'ontario', 'toronto', 'international', 'other'] },
        kind: { type: 'string', enum: ['government_federal', 'government_provincial', 'municipal', 'foundation', 'community_foundation', 'corporate', 'student_fund', 'in_kind', 'network', 'other'] },
        fit_score: { type: 'integer', description: '0 to 100 for Welfare Avenue, from the profile: eligibility certainty, mission alignment (food security, homelessness, youth-led, basic needs), geography, amount against a $13,000 budget, capacity to deliver, odds' },
        fit_note: { type: 'string', description: 'One sentence: why this score, and the one thing to check first' },
        is_new_information: { type: 'boolean', description: 'true when the page or search shows a call that is open or announced now, false for general descriptions with no live call' }
      }, required: ['funder', 'program', 'summary', 'fit_score', 'fit_note'] } },
      page_note: { type: 'string', description: 'One sentence on what the page or search showed overall (for the log)' }
    },
    required: ['calls', 'page_note']
  }
};
type Call = { funder: string; program: string; url?: string; summary: string; amount_min?: number; amount_max?: number; deadline?: string; deadline_text?: string; eligibility?: string; region?: string; kind?: string; fit_score: number; fit_note: string; is_new_information?: boolean };
type Found = { calls: Call[]; note: string; cost: number; error?: string };
// deno-lint-ignore no-explicit-any
async function llm(task: string, body: Row, timeoutMs: number): Promise<{ out: any; cost: number; error?: string }> {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST', signal: ctrl.signal,
      headers: { Authorization: 'Bearer ' + SERVICE_KEY, 'x-wa-task': task, 'x-wa-caller': 'grant-scan', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    // deno-lint-ignore no-explicit-any
    let out: any = null; try { out = JSON.parse(text); } catch (_) { out = null; }
    if (!res.ok || !out || out.type === 'error') return { out: null, cost: 0, error: 'llm ' + res.status + ' ' + String(out && out.error && out.error.message ? out.error.message : text).slice(0, 200) };
    return { out, cost: Number(out._wa?.cost || out.usage?.cost || 0) || 0 };
  } catch (e) {
    return { out: null, cost: 0, error: 'llm ' + String(e && (e as Error).name === 'AbortError' ? 'timed out' : e).slice(0, 200) };
  } finally { clearTimeout(t); }
}
/* the page or answer, read into calls with the tool */
async function extract(system: string, user: string, maxTokens: number): Promise<Found> {
  const r = await llm('grant_extract', { max_tokens: maxTokens, temperature: 0.2, system, messages: [{ role: 'user', content: user }], tools: [CALLS_TOOL], tool_choice: { type: 'tool', name: 'record_calls' } }, LLM_READ_MS);
  if (r.error) return { calls: [], note: '', cost: r.cost, error: r.error };
  // deno-lint-ignore no-explicit-any
  const tu = (r.out.content || []).find((b: any) => b && b.type === 'tool_use');
  if (!tu || !tu.input) return { calls: [], note: '', cost: r.cost, error: 'no tool call' };
  const calls = Array.isArray(tu.input.calls) ? tu.input.calls.filter((c: Call) => c && c.funder && c.program) : [];
  return { calls, note: String(tu.input.page_note || ''), cost: r.cost };
}
/* a web search: the :online model (OpenRouter's web plugin, Exa results) answers in plain text and its reply carries the pages it
   drew on as citations (url, title, the cited text); the results and the answer then go to the extract route, which records the
   calls with the tool. The search model's own judgement is not trusted on its own: a small model given five snippets tends to
   answer "nothing", while the snippets name the calls. */
async function search(system: string, query: string): Promise<Found> {
  const r1 = await llm('grant_scan', {
    max_tokens: 2500, temperature: 0.2,
    system: 'You help a small Canadian charity find grants. Search the web for the question and list every grant, funding call, fund or donation program the results mention, one per paragraph: the funder, the program, the URL, the amounts, the deadline and who may apply, exactly as the results say. Say "Nothing found" only when the results mention no funding at all.',
    messages: [{ role: 'user', content: query }]
  }, LLM_SEARCH_MS);
  if (r1.error) return { calls: [], note: '', cost: r1.cost, error: r1.error };
  // deno-lint-ignore no-explicit-any
  const blocks: any[] = Array.isArray(r1.out.content) ? r1.out.content : [];
  const text = blocks.filter(b => b && b.type === 'text' && b.text).map(b => String(b.text)).join('\n').trim();
  const seen = new Set<string>();
  const cites: Array<{ url: string; title: string; text: string }> = [];
  for (const b of blocks) {
    for (const c of (Array.isArray(b?.citations) ? b.citations : [])) {
      const url = String(c?.url || '').trim(); if (!url || seen.has(url)) continue; seen.add(url);
      cites.push({ url, title: String(c?.title || ''), text: String(c?.cited_text || '').replace(/\s+/g, ' ').trim().slice(0, 1500) });
    }
  }
  if (!cites.length && (!text || /^\W*nothing found/i.test(text))) return { calls: [], note: text.slice(0, 500) || 'Nothing found', cost: r1.cost };
  const results = cites.map((c, i) => (i + 1) + '. ' + (c.title || c.url) + '\n   ' + c.url + (c.text ? '\n   ' + c.text : '')).join('\n\n');
  const r2 = await extract(system, 'A web search for the question below returned the pages listed, and a model summarized them. Record, with the tool, every funding call the pages or the summary name (the page URL as given; is_new_information is true only when a call is open or announced now; skip programs for individuals and anything closed with no next date).\n\nThe question: ' + query + '\n\nThe pages:\n\n' + results.slice(0, 24000) + (text ? '\n\nThe summary:\n\n' + text.slice(0, 8000) : ''), 4000);
  return { calls: r2.calls, note: (r2.note || text || (cites.length + ' pages read')).slice(0, 500), cost: r1.cost + r2.cost, error: r2.error };
}

/* ---------- Slack ---------- */
async function slackPost(channel: string, text: string): Promise<{ ok: boolean; ts?: string; error?: string }> {
  const token = await getSecret('SLACK_BOT_TOKEN');
  const res = await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ channel, text, unfurl_links: false, unfurl_media: false }) });
  const b = await res.json();
  return b.ok ? { ok: true, ts: String(b.ts) } : { ok: false, error: String(b.error || res.status) };
}

/* ---------- the system prompt ---------- */
function systemPrompt(profile: string): string {
  return 'You help a small Canadian charity find grants. Read what you are given and record, with the tool, every funding call it could realistically apply to now or in the coming months. The charity\'s profile: ' + profile
    + '\nRules: record only what the text or the search actually shows (never invent a program or a deadline); give the funder\'s own page as the URL; dates as YYYY-MM-DD only when the text gives the date; score the fit honestly against the profile (eligibility first: a program that requires paid staff, prior Quebec government funding, a children-only or sport-only mandate, or an Ontario base scores under 40); record closed calls only when they recur and say when they reopen; skip programs for individuals, loans and paid services; at most twelve calls per source, the most relevant first. Today is ' + today() + '.';
}

/* ---------- a step of a run ---------- */
async function step(runId: number): Promise<void> {
  const t0 = Date.now();
  const errors: Array<{ where: string; error: string }> = [];
  let cost = 0, pagesChecked = 0, pagesChanged = 0, searches = 0;
  const found: Array<Call & { source_id: number; source_kind: string }> = [];
  const done = new Set<number>();
  let total = 0;
  try {
    const { data: run } = await svc.from('fund_scan_runs').select('*').eq('id', runId).maybeSingle();
    if (!run || run.status !== 'running') return;
    const stepNo = Number(run.steps || 0) + 1;
    await svc.from('fund_scan_runs').update({ steps: stepNo }).eq('id', runId);
    const trigger = String(run.trigger || 'schedule');
    const startedMs = new Date(run.started_at).getTime();
    const { data: setRow } = await svc.from('fund_settings').select('value').eq('key', 'scanner').maybeSingle();
    const S: Row = (setRow && setRow.value) || {};
    const profile = String(S.profile || 'Welfare Avenue is a small volunteer-run registered charity in Montreal (with a Toronto program) serving free meals to people experiencing homelessness.');
    const system = systemPrompt(profile);
    /* the work left in this run: the active sources not read since it started */
    const { data: sources } = await svc.from('fund_sources').select('*').eq('active', true).order('kind').order('id');
    const todo: Row[] = (sources || []).filter(s => !s.last_checked || new Date(s.last_checked).getTime() < startedMs);
    total = todo.length;
    const pages = todo.filter(s => s.kind !== 'search'), qs = todo.filter(s => s.kind === 'search');
    const over = () => Date.now() - t0 > STEP_BUDGET_MS;
    const mark = async (s: Row, upd: Row) => {
      const { error } = await svc.from('fund_sources').update(upd).eq('id', s.id);
      if (error) errors.push({ where: s.name, error: 'could not record the check: ' + error.message }); else done.add(s.id);
    };
    /* 1. the pages, four at a time */
    let idx = 0;
    const one = async (): Promise<void> => {
      while (idx < pages.length && !over()) {
        const s = pages[idx++];
        pagesChecked++;
        const upd: Row = { last_checked: new Date().toISOString(), last_error: null, updated_by: 'grant-scan' };
        try {
          const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
          let res: Response;
          try { res = await fetch(s.url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WelfareAvenueHub/1.0; +https://welfareavenue.com)', Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5' }, redirect: 'follow' }); } finally { clearTimeout(t); }
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const ct = res.headers.get('content-type') || '';
          const raw = (await res.text()).slice(0, 400000);
          const text = /html|xml/i.test(ct) || /<html/i.test(raw.slice(0, 2000)) ? htmlToText(raw) : raw.replace(/\s+/g, ' ');
          const body = text.slice(0, 60000);
          const h = await sha(body);
          if (h === s.last_hash) { await mark(s, upd); continue; }
          pagesChanged++;
          upd.last_hash = h; upd.last_changed = new Date().toISOString();
          if (body.length < 200) { upd.last_summary = 'The page had almost no text (' + body.length + ' characters); it may need a browser.'; await mark(s, upd); continue; }
          const r = await extract(system, 'Source: ' + s.name + (s.url ? ' (' + s.url + ')' : '') + (s.notes ? '\nWhat we know about it: ' + s.notes : '') + '\n\nThe page text:\n\n' + body.slice(0, 40000), 4000);
          cost += r.cost;
          if (r.error) { upd.last_error = r.error; errors.push({ where: s.name, error: r.error }); }
          else { upd.last_summary = (r.note || '').slice(0, 500); r.calls.forEach(c => found.push({ ...c, url: c.url || s.url, source_id: s.id, source_kind: s.kind })); }
        } catch (e) {
          upd.last_error = String(e && (e as Error).name === 'AbortError' ? 'timed out after 20s' : e).slice(0, 300); errors.push({ where: s.name, error: upd.last_error });
        }
        await mark(s, upd);
      }
    };
    await Promise.all(Array.from({ length: 4 }, one));
    /* 2. one web search a step, once every page is read and the step is still young */
    if (idx >= pages.length && qs.length && Date.now() - t0 < SEARCH_START_MS) {
      for (const s of qs.slice(0, 1)) {
        searches++;
        const upd: Row = { last_checked: new Date().toISOString(), last_error: null, updated_by: 'grant-scan' };
        const r = await search(system, String(s.query || s.name));
        cost += r.cost;
        if (r.error) { upd.last_error = r.error; errors.push({ where: s.name, error: r.error }); }
        else { upd.last_summary = (r.note || '').slice(0, 500); upd.last_changed = new Date().toISOString(); r.calls.forEach(c => found.push({ ...c, source_id: s.id, source_kind: 'search' })); }
        await mark(s, upd);
      }
    }
    /* 3. match and keep what this step found */
    let newN = 0, knownN = 0;
    if (found.length) {
      const { data: funders } = await svc.from('fund_funders').select('id, name, aliases, screened_out, url');
      const { data: grants } = await svc.from('fund_grants').select('id, funder_id, program, stage, deadline');
      const since = new Date(Date.now() - 90 * 86400000).toISOString();
      const { data: recent } = await svc.from('fund_scan_finds').select('funder_name, program, url, status').gte('created_at', since);
      const FN: Row[] = funders || [], GR: Row[] = grants || [], RC: Row[] = recent || [];
      const funderKeys = FN.map(f => ({ f, keys: [norm(f.name)].concat((f.aliases || []).map((a: string) => norm(a))).filter(Boolean) }));
      const matchFunder = (name: string): Row | null => {
        const n = norm(name); if (!n) return null;
        const nw = words(name);
        let best: Row | null = null, score = 0;
        for (const fk of funderKeys) {
          for (const k of fk.keys) {
            if (k === n) return fk.f;
            const o = (k.length > 4 && (n.includes(k) || k.includes(n))) ? 0.9 : overlap(words(k), nw);
            if (o > score) { score = o; best = fk.f; }
          }
        }
        return score >= 0.75 ? best : null;
      };
      const seen = new Map<string, number>();
      const rows: Row[] = [];
      for (const c of found) {
        const dl = isoDate(c.deadline);
        const key = norm(c.funder) + '|' + norm(c.program);
        let status = 'new'; let fid: number | null = null; let gid: number | null = null;
        const mf = matchFunder(c.funder);
        if (mf) {
          fid = mf.id;
          if (mf.screened_out) status = 'known';
          else {
            const pw = words(c.program);
            const mine = GR.filter(x => x.funder_id === mf.id);
            const g = mine.map(x => ({ x, o: overlap(words(x.program), pw) })).sort((a, b) => b.o - a.o)[0];
            if (g && (g.o >= 0.5 || (dl && g.x.deadline === dl))) { gid = g.x.id; status = 'known'; }
            else if (mine.length === 1 && pw.size <= 3) { gid = mine[0].id; status = 'known'; }
          }
        }
        if (status === 'new') {
          if (seen.has(key)) status = 'duplicate';
          else if (RC.some(r => norm(r.funder_name) + '|' + norm(r.program) === key || (c.url && r.url && r.url === c.url))) status = 'duplicate';
        }
        seen.set(key, 1);
        if (status === 'new') newN++; else knownN++;
        rows.push({ run_id: runId, funder_name: String(c.funder).slice(0, 200), program: String(c.program || '').slice(0, 300), url: c.url ? String(c.url).slice(0, 600) : null, summary: String(c.summary || '').slice(0, 1500), amount_min: isFinite(Number(c.amount_min)) && c.amount_min != null ? Number(c.amount_min) : null, amount_max: isFinite(Number(c.amount_max)) && c.amount_max != null ? Number(c.amount_max) : null, deadline: dl, deadline_text: c.deadline_text ? String(c.deadline_text).slice(0, 200) : null, eligibility: c.eligibility ? String(c.eligibility).slice(0, 800) : null, region: c.region || null, kind: c.kind || null, fit_score: Math.max(0, Math.min(100, Math.round(Number(c.fit_score) || 0))), fit_note: c.fit_note ? String(c.fit_note).slice(0, 500) : null, matched_funder_id: fid, matched_grant_id: gid, status, raw: { source_id: c.source_id, source_kind: c.source_kind, is_new_information: c.is_new_information !== false, step: stepNo } });
      }
      for (let i = 0; i < rows.length; i += 50) { const { error } = await svc.from('fund_scan_finds').insert(rows.slice(i, i + 50)); if (error) errors.push({ where: 'finds', error: error.message }); }
    }
    /* 4. the run's counters */
    const { data: cur } = await svc.from('fund_scan_runs').select('*').eq('id', runId).maybeSingle();
    const C: Row = cur || run;
    const errs = (Array.isArray(C.errors) ? C.errors : []).concat(errors).slice(0, 40);
    const patch: Row = { pages_checked: Number(C.pages_checked || 0) + pagesChecked, pages_changed: Number(C.pages_changed || 0) + pagesChanged, searches: Number(C.searches || 0) + searches, found_new: Number(C.found_new || 0) + newN, found_known: Number(C.found_known || 0) + knownN, cost: Math.round((Number(C.cost || 0) + cost) * 10000) / 10000, errors: errs };
    const left = todo.filter(s => !done.has(s.id)).length;
    if (left > 0 && stepNo < MAX_STEPS) {
      await svc.from('fund_scan_runs').update(patch).eq('id', runId);
      try {
        const secret = await getSecret('WA_TRIGGER_SECRET');
        const res = await fetch(SUPABASE_URL + '/functions/v1/grant-scan', { method: 'POST', headers: { Authorization: 'Bearer ' + ANON_KEY, 'x-wa-secret': secret, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'continue', run_id: runId }) });
        if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
        return;
      } catch (e) {
        await svc.from('fund_scan_runs').update({ finished_at: new Date().toISOString(), status: 'error', errors: errs.concat([{ where: 'next step', error: String(e).slice(0, 300) }]).slice(0, 40), summary: 'The run stopped after step ' + stepNo + ': the next step could not start (' + String(e).slice(0, 120) + ').' }).eq('id', runId);
        return;
      }
    }
    /* 5. the last step: what the whole run found, the Slack post, the record */
    const { data: all } = await svc.from('fund_scan_finds').select('funder_name, program, url, amount_min, amount_max, deadline, deadline_text, fit_score, status').eq('run_id', runId);
    const finds: Row[] = all || [];
    const fresh = finds.filter(r => r.status === 'new');
    let slackTs: string | null = null, slackCh: string | null = null;
    const minFit = Number(S.min_fit_to_post || 55);
    const toPost = fresh.filter(r => Number(r.fit_score) >= minFit).sort((a, b) => Number(b.fit_score) - Number(a.fit_score)).slice(0, 12);
    if (trigger !== 'test' && S.post_new_finds !== false && S.slack_channel && toPost.length) {
      const lines = toPost.map(r => '• *' + r.funder_name + '*: ' + (r.program || 'grant') + (r.amount_max ? ' (up to ' + money(r.amount_max) + ')' : r.amount_min ? ' (from ' + money(r.amount_min) + ')' : '') + (r.deadline ? ', deadline ' + r.deadline : r.deadline_text ? ', ' + r.deadline_text : '') + ' · fit ' + r.fit_score + (r.url ? ' · <' + r.url + '|the call>' : ''));
      const more = fresh.length - toPost.length;
      const text = 'The grant scanner found ' + fresh.length + ' new ' + (fresh.length === 1 ? 'opportunity' : 'opportunities') + ' this week' + (more > 0 ? ' (the ' + toPost.length + ' best below)' : '') + ':\n' + lines.join('\n') + '\nKeep or dismiss each one in the Hub: <' + HUB + '/#fund/grants/found|Fundraising, Grants, Found for you>.';
      const p = await slackPost(String(S.slack_channel), text);
      if (p.ok) { slackTs = p.ts || null; slackCh = String(S.slack_channel); } else errs.push({ where: 'slack', error: p.error || 'failed' });
    }
    const knownAll = finds.length - fresh.length;
    const unread = left > 0 ? left : 0;
    const summary = patch.pages_checked + ' pages checked, ' + patch.pages_changed + ' changed, ' + patch.searches + ' searches; ' + fresh.length + ' new, ' + knownAll + ' already known or repeated'
      + (slackTs ? '; posted to Slack' : trigger === 'test' ? '; a test, nothing posted' : fresh.length ? '; nothing posted (the settings, or no find scored ' + minFit + ')' : '')
      + (errs.length ? '; ' + errs.length + ' problem' + (errs.length > 1 ? 's' : '') : '') + (unread ? '; ' + unread + ' source' + (unread > 1 ? 's' : '') + ' left unread after ' + stepNo + ' steps' : stepNo > 1 ? '; ' + stepNo + ' steps' : '') + '.';
    const worked = patch.pages_checked + patch.searches;
    const status = unread ? 'partial' : !errs.length ? 'ok' : worked > errs.length ? 'partial' : 'error';
    await svc.from('fund_scan_runs').update({ ...patch, errors: errs.slice(0, 40), finished_at: new Date().toISOString(), status, summary, slack_ts: slackTs, slack_channel: slackCh }).eq('id', runId);
    await svc.from('fund_settings').update({ value: { ...S, last_run: { id: runId, at: new Date().toISOString(), new: fresh.length, known: knownAll, status } }, updated_by: 'grant-scan' }).eq('key', 'scanner');
    try { await svc.from('change_log').insert({ entity_type: 'fund_scan', entity_id: String(runId), field: 'run', old_value: trigger, new_value: summary, changed_by: 'grant-scan' }); } catch (_) { /* audit */ }
  } catch (e) {
    await svc.from('fund_scan_runs').update({ finished_at: new Date().toISOString(), status: 'error', errors: errors.concat([{ where: 'run', error: String(e).slice(0, 400) }]).slice(0, 40), summary: 'The run failed: ' + String(e).slice(0, 200) }).eq('id', runId);
  }
}
function background(p: Promise<void>): void {
  // deno-lint-ignore no-explicit-any
  const ER = (globalThis as any).EdgeRuntime;
  if (ER && typeof ER.waitUntil === 'function') ER.waitUntil(p); else p.catch(() => { /* logged in the run */ });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const me = await who(req);
  if (!me) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'status');
  try {
    if (action === 'status') {
      const { data: runs } = await svc.from('fund_scan_runs').select('*').order('started_at', { ascending: false }).limit(5);
      const { count } = await svc.from('fund_scan_finds').select('id', { count: 'exact', head: true }).eq('status', 'new');
      return json({ ok: true, runs: runs || [], waiting: count || 0 });
    }
    if (action === 'scan') {
      /* a run still 'running' long after it started was interrupted: close it, so it does not block the next */
      await svc.from('fund_scan_runs').update({ status: 'error', finished_at: new Date().toISOString(), summary: 'The run stopped without finishing (the function was interrupted).' }).eq('status', 'running').lt('started_at', new Date(Date.now() - STUCK_MIN * 60000).toISOString());
      const { data: running } = await svc.from('fund_scan_runs').select('id, started_at').eq('status', 'running').limit(1);
      if (running && running.length) return json({ ok: false, error: 'A scan is already running (run ' + running[0].id + ').', run_id: running[0].id }, 409);
      const trigger = me.kind === 'secret' ? (body.trigger === 'test' ? 'test' : 'schedule') : (body.trigger === 'test' && me.admin ? 'test' : 'person');
      const { data: r, error } = await svc.from('fund_scan_runs').insert({ trigger, by_email: me.email, status: 'running' }).select('id').single();
      if (error || !r) return json({ error: 'could not start: ' + (error?.message || '') }, 500);
      background(step(r.id));
      return json({ ok: true, run_id: r.id, trigger });
    }
    if (action === 'continue') {
      if (me.kind !== 'secret') return json({ error: 'the scanner only' }, 403);
      const runId = Number(body.run_id);
      const { data: run } = await svc.from('fund_scan_runs').select('id, status, steps').eq('id', runId).maybeSingle();
      if (!run) return json({ error: 'no such run' }, 404);
      if (run.status !== 'running') return json({ ok: false, error: 'the run is ' + run.status }, 409);
      background(step(runId));
      return json({ ok: true, run_id: runId, step: Number(run.steps || 0) + 1 });
    }
    if (action === 'check') {
      if (!me.admin) return json({ error: 'admins only' }, 403);
      const { data: s } = await svc.from('fund_sources').select('*').eq('id', Number(body.source_id)).maybeSingle();
      if (!s) return json({ error: 'no such source' }, 404);
      const { data: setRow } = await svc.from('fund_settings').select('value').eq('key', 'scanner').maybeSingle();
      const system = systemPrompt(String((setRow?.value || {}).profile || ''));
      if (s.kind === 'search') { const r = await search(system, String(s.query || s.name)); return json({ ok: !r.error, source: s.name, ...r }); }
      const res = await fetch(s.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WelfareAvenueHub/1.0; +https://welfareavenue.com)' } });
      const text = htmlToText((await res.text()).slice(0, 400000)).slice(0, 40000);
      const r = await extract(system, 'Source: ' + s.name + '\n\n' + text, 4000);
      return json({ ok: !r.error, source: s.name, chars: text.length, ...r });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 400) }, 500);
  }
});
