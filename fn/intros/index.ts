// Welfare Avenue: intros (v1, wave227, 09/10/26)
// Purpose: the weekly introduction. Steel: "once every week someone gets a pop-up window when they open up the hub to
// introduce them to someone that they may have not interacted with ... because of potential work or projects that they
// can work on together". Picks the week's pairs (rpc wa227_intro_plan: everyone gets one person from another team they
// have not worked with, chosen for overlapping goals, projects and roles) and writes, for each pair, why they might
// connect and a first hello, for both sides, each in the reader's language, through the llm router (task intro_note).
// Trigger: cron wa-intros (Mondays, early morning Toronto) and by hand from SQL. Auth: x-wa-secret only (verify_jwt on;
// call_edge sends the anon bearer and the secret).
// Body: {week?: 'YYYY-MM-DD' (that week's Monday), dry?: true (the plan only: no model calls, nothing written), limit?: n,
//   wait?: true (answer when written), redo?: [hub_intros ids] (rewrite the notes of rows nobody has seen yet)}
// Reads: wa227_intro_plan (open profile facts only: role, team, responsibilities, profile line, projects led, goals owned).
// Writes: hub_intros (source weekly). Side effects: none outside the Hub (no Slack, no email, no notification); the
// person sees it as a pop-up the next time they open the Hub (build/src/227_wave227.seg). Off switch: app_config intros_on.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}

/* the Monday of this week in Toronto */
function torontoMonday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const d = new Date(parts + 'T12:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

const SYSTEM = `You introduce two people who are part of Welfare Avenue, a Montreal and Toronto charity that serves meals and builds community. They have not worked together yet. You write short, warm introductions in Welfare Avenue's voice: friendly, concise, specific, human.

You are given A and B: their name, role, team, city, responsibilities, a profile line, open projects they lead and organizational goals they own, plus signals (shared goals, projects under the same goal, overlapping words in their roles).

Write four things:
1. note: for A, about B. Second person ("you"), B by first name. Two sentences, at most 45 words: who B is at Welfare Avenue in plain words, then one concrete thing the two could explore or help each other with, grounded in the facts given.
2. hello: a first message A could send B on Slack. First person, one or two sentences, at most 30 words, casual and kind, ending with an easy invitation (a quick chat or coffee). No greeting emoji needed.
3. note_back: the same introduction for B, about A (same rules as note).
4. hello_back: the same first message from B to A.

Rules:
- Only use the facts given. Never invent projects, events, numbers or history. If the facts are thin, keep it modest (a role, a team, one simple reason to say hello).
- Never mention how they were matched, data, an algorithm, "AI" or "the Hub". Never mention meetings, HR matters, pay, payroll, headcount, the board's business, money owed, or anything private. Suggest something practical about the work itself (an event, a project, a skill, a way of reaching people).
- Never use em dashes. No hashtags, no quotation marks around the text.
- Use each person's first name exactly as given in name, and their team exactly as given in team. Do not describe a team or a role in other words than the facts.
- Language: follow write_in exactly. A.write_in is the language of note and hello; B.write_in is the language of note_back and hello_back. English unless write_in says French (then Quebec French, using vous). A Montreal city or a French-looking name does not change the language.`;

const TOOL = {
  name: 'write_intro',
  description: 'Return the introduction for both people.',
  input_schema: {
    type: 'object',
    properties: {
      note: { type: 'string' }, hello: { type: 'string' },
      note_back: { type: 'string' }, hello_back: { type: 'string' },
    },
    required: ['note', 'hello', 'note_back', 'hello_back'],
  },
};

const clean = (s: unknown) => String(s || '').replace(/\s*[\u2014\u2013]\s*/g, ': ').replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').trim().slice(0, 600);

// deno-lint-ignore no-explicit-any
async function write(pair: any): Promise<{ note: string; hello: string; note_back: string; hello_back: string }> {
  const ctx = {
    A: { ...pair.me, write_in: pair.lang === 'fr' ? 'French' : 'English' },
    B: { ...pair.other, write_in: pair.other_lang === 'fr' ? 'French' : 'English' },
    signals: pair.signals,
  };
  const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + SERVICE_KEY, 'x-wa-task': 'intro_note', 'x-wa-caller': 'intros', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5', max_tokens: 700, temperature: 0.6, system: SYSTEM,
      messages: [{ role: 'user', content: 'THE TWO PEOPLE (JSON):\n' + JSON.stringify(ctx) }],
      tools: [TOOL], tool_choice: { type: 'tool', name: 'write_intro' },
    }),
  });
  if (!res.ok) throw new Error('llm ' + res.status + ' ' + (await res.text()).slice(0, 200));
  const body = await res.json();
  // deno-lint-ignore no-explicit-any
  const tu = (body.content || []).find((c: any) => c.type === 'tool_use');
  if (!tu?.input?.note) throw new Error('no introduction returned');
  return { note: clean(tu.input.note), hello: clean(tu.input.hello), note_back: clean(tu.input.note_back), hello_back: clean(tu.input.hello_back) };
}

// deno-lint-ignore no-explicit-any
async function run(week: string, plan: any[]): Promise<{ written: number; failed: string[] }> {
  let written = 0; const failed: string[] = [];
  for (let i = 0; i < plan.length; i += 6) {
    const batch = plan.slice(i, i + 6);
    await Promise.all(batch.map(async (p) => {
      try {
        const t = await write(p);
        const { error } = await svc.from('hub_intros').insert({ week, member_id: p.member_id, other_id: p.other_id, source: 'weekly', note: t.note, hello: t.hello, note_back: t.note_back, hello_back: t.hello_back, signals: p.signals || {} });
        if (error) throw new Error(error.message);
        written++;
      } catch (e) { failed.push(p.member_id + ': ' + String((e as Error).message || e).slice(0, 160)); }
    }));
  }
  try {
    await svc.from('change_log').insert({ entity_type: 'intros', entity_id: week, field: 'weekly', old_value: null, new_value: written + ' introductions written' + (failed.length ? ', ' + failed.length + ' failed' : ''), changed_by: 'intros' });
  } catch (_) { /* audit only */ }
  return { written, failed };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let ok = false;
  try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) ok = true; } catch (_) { /* no */ }
  if (!ok) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const { data: cfg } = await svc.from('app_config').select('value').eq('key', 'intros_on').maybeSingle();
  if (String(cfg?.value ?? 'true').trim().toLowerCase() === 'false' && !body.dry) return json({ ok: true, off: true });
  const week = /^\d{4}-\d{2}-\d{2}$/.test(String(body.week || '')) ? String(body.week) : torontoMonday();
  const { data: plan, error } = await svc.rpc('wa227_intro_plan', { p_week: week });
  if (error) return json({ error: error.message }, 500);
  // deno-lint-ignore no-explicit-any
  let pairs = (plan || []) as any[];
  if (body.limit) pairs = pairs.slice(0, Number(body.limit));
  if (Array.isArray(body.redo) && body.redo.length) {
    const { data: rows } = await svc.from('hub_intros').select('id, member_id, other_id, signals').in('id', body.redo.map(Number)).eq('source', 'weekly');
    const done: number[] = []; const bad: string[] = [];
    for (const r of rows || []) {
      try {
        const [me, other, ppl] = await Promise.all([svc.rpc('wa227_profile', { p: r.member_id }), svc.rpc('wa227_profile', { p: r.other_id }), svc.rpc('wa227_people')]);
        // deno-lint-ignore no-explicit-any
        const lang = (id: number) => ((ppl.data || []) as any[]).find((x) => x.id === id)?.lang || 'en';
        const t = await write({ me: me.data, other: other.data, lang: lang(r.member_id), other_lang: lang(r.other_id), signals: r.signals });
        const { error: ue } = await svc.from('hub_intros').update({ note: t.note, hello: t.hello, note_back: t.note_back, hello_back: t.hello_back }).eq('id', r.id).eq('status', 'new');
        if (ue) throw new Error(ue.message);
        done.push(r.id);
      } catch (e) { bad.push(r.id + ': ' + String((e as Error).message || e).slice(0, 160)); }
    }
    return json({ ok: true, redone: done, failed: bad });
  }
  if (body.dry) return json({ ok: true, week, dry: true, pairs: pairs.map((p) => ({ a: p.me?.name, b: p.other?.name, signals: p.signals })) });
  if (body.wait) return json({ ok: true, week, planned: pairs.length, ...(await run(week, pairs)) });
  // @ts-ignore EdgeRuntime is provided by Supabase
  EdgeRuntime.waitUntil(run(week, pairs));
  return json({ ok: true, week, planned: pairs.length, started: true });
});
