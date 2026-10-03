// Welfare Avenue: i18n-translate (v1, 03/10/26, wave198): keeps the Hub's French up to date.
// Steel (02/10/26): "He's also french so I'd love to make the effort in putting the entire hub in french as an option. This is for
// future recruits too." His choices: the interface, the onboarding and the Avenue Academy in French; Quebec French, vous.
//
// What it does, nightly (cron wa-i18n-translate) or when an admin asks:
//   ui       the interface text French readers saw with no translation (hub_i18n_queue), only pieces whose words are all in the live
//            build (wa198_queue_take: what people type is never sent); translated in batches with the glossary; saved in hub_i18n (auto)
//   content  the onboarding and Academy fields whose English is new or changed since their French (wa198_content_stale); saved in
//            hub_i18n_content with the English's md5, so the French is served again
// Every call to a model goes through the llm router (route i18n_fr). Nothing is sent to anyone; no Slack, no email.
// Auth: x-wa-secret (the cron) or an admin's JWT. POST {action: 'run' | 'ui' | 'content', limit?}
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
const DEADLINE_MS = 120000;   // one invocation lives 150 s on this project

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
async function allowed(req: Request): Promise<string | null> {
  const given = req.headers.get('x-wa-secret');
  if (given) { try { if (given === (await getSecret('WA_TRIGGER_SECRET'))) return 'cron'; } catch (_) { /* no */ } }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  if (!email) return null;
  const { data: a } = await asUser.rpc('is_hub_admin');
  return a === true ? email : null;
}

const GLOSSARY = `Translate interface text of the Welfare Avenue Hub (the internal web app of a youth-led Montreal charity that serves meals to people
experiencing homelessness) into Quebec French (Canada), "vous" form, warm, clear and as short as the English. Sentence case; keep ALL CAPS
if the source is all caps. Keep placeholders {0}, {1}... exactly. A non-breaking space before ":" and inside « »; no space before ; ? !
Fragments are joined with numbers or names at runtime: translate so they still read naturally.
Keep in English: Hub, The Loop, Avenue Academy, CRM, Slack, Google, Loom, Stripe, Keela, Zeffy, Canva, ClickUp, Plaud, Quo, WhatsApp,
Rally Paper, Welfare Avenue, and people's names.
Glossary: HR centre = Centre RH; Volunteer Manager = Gestion des bénévoles; Fundraising = Collecte de fonds; Finance = Finances;
Strategy = Stratégie; Admin centre = Centre d'administration; Operations Montreal = Opérations Montréal; Program Development =
Développement des programmes; Human Resources = Ressources humaines; Board (governance) = Conseil d'administration; board (tasks) =
tableau; Executive team = Équipe de direction; volunteer = bénévole; serving (Sunday meal distribution) = service; team leader = chef
d'équipe; onboarding = intégration; training = formation; shout-out = bon coup; time off = congé; sign-off = signature; task = tâche;
request = demande; meeting = réunion; email = courriel; dashboard = tableau de bord; donor/donation = donateur/don; tax receipt = reçu
fiscal; application/applicant = candidature/candidat; position = poste; interview = entrevue; grant = subvention; upload = téléverser;
Open (button) = Ouvrir; I'm in = Je commence; Close the loop = Boucler la boucle; fiscal year = exercice financier.`;
const CONTENT_RULES = `This is onboarding or training content (Markdown, or JSON as text). Keep the Markdown structure, links (translate the text,
never the URL), line breaks, and these line-start markers in English word for word: "Goal:", "Try it:", "Done when:", "Tip:", "Good to know:",
"Watch out:", "**To complete this step:**", "To complete the task:". For JSON: return valid JSON with every key unchanged, numbers, booleans,
null, URLs, ids, keys, icons and colours unchanged, quiz answer options in the same order; translate only human-readable strings.`;

type Res = { input: Record<string, unknown> | null; cost: number; error?: string };
async function ask(system: string, user: string, tool: Record<string, unknown>, maxTokens: number): Promise<Res> {
  const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
    method: 'POST', headers: { Authorization: 'Bearer ' + SERVICE_KEY, 'x-wa-task': 'i18n_fr', 'x-wa-caller': 'i18n-translate', 'Content-Type': 'application/json' },
    body: JSON.stringify({ max_tokens: maxTokens, temperature: 0.2, system, messages: [{ role: 'user', content: user }], tools: [tool], tool_choice: { type: 'tool', name: (tool as { name: string }).name } })
  });
  const text = await res.text();
  // deno-lint-ignore no-explicit-any
  let out: any = null; try { out = JSON.parse(text); } catch (_) { out = null; }
  if (!res.ok || !out || out.type === 'error') return { input: null, cost: 0, error: 'model (' + res.status + '): ' + text.slice(0, 200) };
  // deno-lint-ignore no-explicit-any
  const tu = (out.content || []).find((b: any) => b && b.type === 'tool_use');
  return { input: tu?.input || null, cost: Number(out._wa?.cost || 0) || 0, error: tu ? undefined : 'no tool call' };
}
const UI_TOOL = { name: 'save_translations', description: 'The French for each numbered string, in order.', input_schema: { type: 'object', properties: {
  items: { type: 'array', items: { type: 'object', properties: { i: { type: 'integer' }, fr: { type: ['string', 'null'], description: 'The translation, or null when it is not interface text (code, a key, a name)' } }, required: ['i', 'fr'] } }
}, required: ['items'] } };
const CONTENT_TOOL = { name: 'save_translation', description: 'The French version of the field.', input_schema: { type: 'object', properties: { fr: { type: 'string' } }, required: ['fr'] } };
const ph = (s: string) => (s.match(/\{\d+\}/g) || []).sort().join(',');

async function doUi(limit: number, until: number) {
  const { data: rows, error } = await svc.rpc('wa198_queue_take', { p_n: limit });
  if (error) return { error: error.message };
  const list = (rows || []) as { en: string }[];
  let saved = 0, cost = 0; const errors: string[] = [];
  for (let k = 0; k < list.length && Date.now() < until; k += 60) {
    const batch = list.slice(k, k + 60);
    const r = await ask(GLOSSARY, batch.map((x, i) => i + '\t' + x.en).join('\n'), UI_TOOL, 8000);
    cost += r.cost; if (!r.input) { errors.push(r.error || 'no answer'); continue; }
    const items = ((r.input.items || []) as { i: number; fr: string | null }[]);
    const up = items.filter(it => it && typeof it.fr === 'string' && it.fr.trim() && batch[it.i] && ph(batch[it.i].en) === ph(it.fr as string) && it.fr !== batch[it.i].en)
      .map(it => ({ lang: 'fr', en: batch[it.i].en, tr: (it.fr as string).trim(), kind: 'auto', updated_at: new Date().toISOString() }));
    if (up.length) { const { error: e2 } = await svc.from('hub_i18n').upsert(up, { onConflict: 'lang,en', ignoreDuplicates: true }); if (e2) errors.push(e2.message); else saved += up.length; }
    const nulls = items.filter(it => it && it.fr == null && batch[it.i]).map(it => batch[it.i].en);
    if (nulls.length) await svc.from('hub_i18n_queue').update({ skip: true }).eq('lang', 'fr').in('en', nulls);
  }
  return { taken: list.length, saved, cost: Math.round(cost * 1000) / 1000, errors };
}
async function doContent(limit: number, until: number) {
  const { data: rows, error } = await svc.rpc('wa198_content_stale', { p_n: limit });
  if (error) return { error: error.message };
  let saved = 0, cost = 0; const errors: string[] = [];
  for (const r of (rows || []) as { tbl: string; row_id: string; field: string; val: string; src_md5: string }[]) {
    if (Date.now() > until) break;
    const isJson = r.field === 'body' || r.field === 'value';
    const a = await ask(GLOSSARY + '\n\n' + CONTENT_RULES, (isJson ? 'JSON:\n' : 'Text:\n') + r.val, CONTENT_TOOL, 16000);
    cost += a.cost; const fr = a.input && typeof a.input.fr === 'string' ? (a.input.fr as string) : null;
    if (!fr) { errors.push(r.tbl + ' ' + r.row_id + ' ' + r.field + ': ' + (a.error || 'no answer')); continue; }
    if (isJson) { try { JSON.parse(fr); } catch (_) { errors.push(r.tbl + ' ' + r.row_id + ': not JSON'); continue; } }
    const { error: e2 } = await svc.from('hub_i18n_content').upsert({ lang: 'fr', tbl: r.tbl, row_id: r.row_id, field: r.field, src_md5: r.src_md5, tr: fr, updated_at: new Date().toISOString() }, { onConflict: 'lang,tbl,row_id,field' });
    if (e2) errors.push(e2.message); else saved++;
  }
  return { stale: (rows || []).length, saved, cost: Math.round(cost * 1000) / 1000, errors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const who = await allowed(req);
  if (!who) return json({ error: 'not allowed' }, 401);
  let body: { action?: string; limit?: number } = {};
  try { body = await req.json(); } catch (_) { body = {}; }
  const until = Date.now() + DEADLINE_MS, action = body.action || 'run';
  const out: Record<string, unknown> = { action, by: who };
  if (action === 'ui' || action === 'run') out.ui = await doUi(Math.min(Number(body.limit) || 300, 400), action === 'run' ? Date.now() + 60000 : until);
  if (action === 'content' || action === 'run') out.content = await doContent(Math.min(Number(body.limit) || 30, 100), until);
  try { await svc.from('change_log').insert({ entity_type: 'i18n', entity_id: 'i18n-translate', field: action, old_value: null, new_value: JSON.stringify(out).slice(0, 900), changed_by: 'i18n-translate' }); } catch (_) { /* audit */ }
  return json(out);
});
