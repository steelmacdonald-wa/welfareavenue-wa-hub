// Welfare Avenue: hub-edit (v1, 07/08/26)
// The admin content-editing assistant. Takes a natural-language instruction
// from an ADMIN and translates it into a bounded list of structured content
// operations (info links, budget amounts, budget lines, AI categorisation
// guidance). It NEVER executes anything: the client shows the operations as
// a preview and, on confirm, applies them under the admin's own RLS
// permissions with a change_log entry per operation. Site CODE is out of
// scope by design: code changes go through the change-request lane and the
// tested deploy pipeline.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const FOUNDERS = ['steel.macdonald@welfareavenue.com', 'steelmacdonald@gmail.com', 'suhaib.abdillahi@welfareavenue.com'];

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}

async function adminEmail(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  if (!email) return null;
  if (FOUNDERS.includes(email)) return email;
  const { data: role } = await svc.from('hub_roles').select('role').eq('email', email).maybeSingle();
  return role?.role === 'admin' ? email : null;
}

const SYSTEM = `You are the Welfare Avenue Hub's content editor. An ADMIN gives you an instruction in plain language; you translate it into the allowed operations below. You NEVER invent content: only do what the instruction asks. If the instruction asks for anything outside the allowed operations (code changes, layout, new features, deleting transactions, changing roles, anything about people), return a single unsupported operation whose reason says the change-request lane is the way to ask for it. Never use em dashes in any text you produce.

Allowed content:
1. Important info links (the Hub's directory of links, logins and resources). You may add, update, or remove entries. The context lists current entries with their ids. Never touch a stored secret; you cannot read or write them.
2. Budgets for the CURRENT fiscal year: set the amount of a quarterly (Q1, Q2, Q3, Q4) or FY budget for an existing category, or add a brand new budget line (income or expense). Categories are listed in the context. Do not create duplicate lines.
3. AI categorisation guidance: add one clear rule the statement importer should follow.

Rules: prefer update over remove+add. For updates and removals, use the exact id from the context. Amounts are plain numbers (CAD). Keep every label and note short and clean. In summary, state in one sentence what will happen.`;

function buildTool(cats: string[]) {
  return {
    name: 'propose_operations',
    description: 'Return the structured operations that implement the instruction.',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'One sentence describing what these operations do.' },
        operations: {
          type: 'array',
          maxItems: 12,
          items: {
            type: 'object',
            properties: {
              op: { type: 'string', enum: ['add_info_link', 'update_info_link', 'remove_info_link', 'set_budget', 'add_budget_line', 'add_guidance_rule', 'unsupported'] },
              id: { type: ['integer', 'null'], description: 'info_links id for update/remove' },
              kind: { type: ['string', 'null'], description: 'info link kind, e.g. link, login, doc' },
              label: { type: ['string', 'null'] },
              url: { type: ['string', 'null'] },
              department: { type: ['string', 'null'] },
              notes: { type: ['string', 'null'] },
              period: { type: ['string', 'null'], enum: ['Q1', 'Q2', 'Q3', 'Q4', 'FY', null] },
              category: { type: ['string', 'null'], enum: cats.concat([null as unknown as string]) },
              amount: { type: ['number', 'null'] },
              line_kind: { type: ['string', 'null'], enum: ['income', 'expense', null] },
              rule: { type: ['string', 'null'], description: 'the guidance rule text' },
              reason: { type: ['string', 'null'], description: 'for unsupported: why, and that the change-request lane is the path' }
            },
            required: ['op']
          }
        }
      },
      required: ['summary', 'operations']
    }
  };
}

const MODELS = ['claude-sonnet-5', 'claude-sonnet-4-5', 'claude-sonnet-4-20250514'];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const email = await adminEmail(req);
  if (!email) return json({ error: 'admins only' }, 401);
  const body = await req.json().catch(() => ({}));
  const instruction = String(body.instruction || '').slice(0, 2000).trim();
  if (instruction.length < 5) return json({ error: 'instruction required' }, 400);

  const [links, budgets, guidance] = await Promise.all([
    svc.from('info_links').select('id, kind, label, url, department, notes').order('id').limit(200),
    svc.from('finance_budgets').select('key, kind').eq('scope', 'category').limit(200),
    svc.from('app_config').select('value').eq('key', 'finance_ai_guidance').maybeSingle(),
  ]);
  const catSet = new Set<string>(['4100 Donation', '4110 FlagPlus Football', '4200 Grants', 'Services', '5020 Purchases - COS', 'Supplies and materials - COS', '6010 Transportation fees', '6020 Meal and entertainment expenses', '6030 Subscription fees', '7035 Office expenses', '7090 Telecommunication', '7120 Publicity and Promotion', '7145 Lease payments', 'Other']);
  for (const b of (budgets.data || [])) { const k = String((b as { key?: unknown }).key || '').trim(); if (k) catSet.add(k); }
  const cats = [...catSet];

  const context = {
    info_links: links.data || [],
    budget_categories: cats,
    current_guidance: String(guidance.data?.value || '').slice(0, 3000),
    note: 'Budgets apply to the current fiscal year. Departments for info links: opsmtl, opsto, marketing, fundraising, hr, board, or null for org-wide.'
  };

  try {
    let lastErr = '';
    for (const model of MODELS) {
      /* audit 26/09/26: through the llm router */
      const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + SERVICE_KEY, 'x-wa-task': 'draft', 'x-wa-caller': 'hub-edit', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, max_tokens: 3000, temperature: 0, system: SYSTEM,
          messages: [{ role: 'user', content: 'CONTEXT:\n' + JSON.stringify(context) + '\n\nADMIN INSTRUCTION:\n' + instruction }],
          tools: [buildTool(cats)], tool_choice: { type: 'tool', name: 'propose_operations' }
        })
      });
      if (res.ok) {
        const b2 = await res.json();
        const tu = (b2.content || []).find((c: { type: string }) => c.type === 'tool_use');
        if (tu?.input) {
          try {
            await svc.from('change_log').insert({
              entity_type: 'hub_edit', entity_id: 'proposal', field: 'instruction',
              old_value: null, new_value: instruction.slice(0, 300) + ' -> ' + String((tu.input as { summary?: string }).summary || '').slice(0, 200),
              changed_by: email
            });
          } catch (_) { /* audit only */ }
          return json(tu.input);
        }
        lastErr = 'no tool_use returned';
        continue;
      }
      lastErr = res.status + ' ' + (await res.text()).slice(0, 200);
      if (res.status !== 404 && res.status !== 400) break;
    }
    return json({ error: 'assistant call failed: ' + lastErr }, 500);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 200) }, 500);
  }
});
