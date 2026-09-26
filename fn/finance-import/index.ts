// Welfare Avenue: finance-import (v6, 07/08/26)
// v6: max_tokens raised 8000 -> 16000 for the historical bulk import (busy
// months can exceed 8000 tokens of extracted transactions). Nothing else.
// v5: (a) '4200 Grants' rule: grant deposits from governments, cities and
// foundations go to 4200 Grants / fundraising (line seeded in finance_budgets
// so it is always in the dynamic enum); (b) duplicate hardening for bulk
// historical PDF uploads: warns when a DONE statement already covers the
// same period, and reports all_duplicates when every extracted transaction
// was already in the ledger (a re-imported file), so the client can say so.
// v4: dynamic category list (finance_budgets keys) + staff guidance from
// app_config 'finance_ai_guidance' appended to the system prompt.
// v3: accepts the statement PDF itself (pdf_base64) as a native document.
// v2: duplicate detection only pairs against rows OUTSIDE the current import.
// v1: extract + allocate + fingerprint + provenance row.
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

const DEPTS = ['opsmtl', 'opsto', 'marketing', 'fundraising', 'hr', 'board', 'org'];
const BASE_CATS = ['4100 Donation', '4110 FlagPlus Football', '4200 Grants', 'Services', '5020 Purchases - COS', 'Supplies and materials - COS', '6010 Transportation fees', '6020 Meal and entertainment expenses', '6030 Subscription fees', '7035 Office expenses', '7090 Telecommunication', '7120 Publicity and Promotion', '7145 Lease payments', 'Other'];

async function loadCats(): Promise<string[]> {
  const cats = BASE_CATS.slice();
  try {
    const { data } = await svc.from('finance_budgets').select('key').eq('scope', 'category').limit(500);
    for (const row of (data || [])) {
      const k = String((row as { key?: unknown }).key || '').trim();
      if (k && cats.indexOf(k) < 0) cats.push(k);
    }
  } catch (_) { /* defaults only */ }
  return cats;
}

async function loadGuidance(): Promise<string> {
  try {
    const { data } = await svc.from('app_config').select('value').eq('key', 'finance_ai_guidance').maybeSingle();
    return String((data as { value?: unknown } | null)?.value || '').slice(0, 4000);
  } catch (_) { return ''; }
}

const SYSTEM = `You extract transactions from Welfare Avenue's bank statement and allocate each one. Welfare Avenue is a Montreal and Toronto charity serving meals to people experiencing homelessness, running biweekly Sunday serving events. You receive either raw statement text (often garbled OCR-style output) or the original PDF of a BMO business banking statement. The statement may be from a PAST year: always use the dates printed on the statement itself, never today's date.

Extraction rules:
1. Extract EVERY real transaction line. Opening balance, closing balance, closing totals, and items-processed lines are NOT transactions. Do not invent lines. If the same amount appears on the same day twice as separate lines, they are two real transactions: include both.
2. Amounts: money leaving the account (debits, purchases, sent e-Transfers, fees) is NEGATIVE. Money arriving (credits, received e-Transfers, refunds, returned merchandise, deposits) is POSITIVE. BMO lines usually show the transaction amount first and the running balance last; never use the running balance as the amount. Cross-check: the amounts you extract should walk the balance from opening to closing.
3. date: ISO YYYY-MM-DD using the statement period's month and year. A statement covers roughly one month.
4. description: a clean readable merchant or transfer description, for example "Amazon (AMZN MKTP CA)", "U-Haul storage Cremazie", "Interac e-Transfer received", "Facebook ads", "Intuit QuickBooks".
5. department: one of opsmtl, opsto, marketing, fundraising, hr, board, org. Groceries and serving event supplies default to opsmtl (Instacart, MAXI, Metro, Super C, IGA, Provigo, Costco, RONA, Canadian Tire, Dollarama) unless clearly Toronto, then opsto. Ads (FACEBK, Meta, Google Ads, Canva print) are marketing. Donation platform costs (Keela), Stripe and fundraising event costs are fundraising. Recruiting tools (LinkedIn Recruiter) are hr. Org-wide software (DigitalOcean, Loom, OpenPhone, Intuit QuickBooks, Google, Slack, Zoom, ClickUp), storage and lease (U-Haul storage, Depotium), telecom, government registrations and bank fees are org.
6. category: exactly one of the chart of accounts values provided in the tool schema. Food and grocery purchases for events (Instacart, MAXI, Costco): "5020 Purchases - COS". Event supplies and equipment: "Supplies and materials - COS". Gas, parking, Uber rides, transport: "6010 Transportation fees". Restaurant meals, Uber Eats, cafes: "6020 Meal and entertainment expenses". Software subscriptions (DigitalOcean, Loom, QuickBooks, Keela, LinkedIn, Uber One membership): "6030 Subscription fees". Office and hardware for office use: "7035 Office expenses". Phone and internet (OpenPhone): "7090 Telecommunication". Ads, promotion, print shops, Eventbrite listing costs: "7120 Publicity and Promotion". Storage units and leases (U-Haul storage, Depotium): "7145 Lease payments". Donations and personal e-Transfer income: "4100 Donation". Grant deposits from governments, cities, municipalities and foundations (for example City of Toronto, Ville de Montreal, community foundations): "4200 Grants". FlagPlus football league income: "4110 FlagPlus Football". Service revenue and Stripe payouts: "Services". Bank fees, government fees and anything else: "Other".
7. Received Interac e-Transfers and cheque deposits are income: category "4100 Donation" for individuals, "4200 Grants" when the payer is clearly a government, city or foundation, or "Services" when clearly payment for services; department fundraising unless the text clearly says otherwise. Sent e-Transfers are usually volunteer reimbursements for event food or supplies: default "5020 Purchases - COS" and opsmtl with confidence low. A cancelled e-Transfer is a POSITIVE credit reversing an earlier send.
8. confidence: "high" when the merchant clearly implies the allocation, "low" when guessing.
9. period_start and period_end: the statement period in ISO dates.
10. Never use em dashes in any text you produce.`;

function buildTool(cats: string[]) {
  return {
    name: 'import_bank_statement',
    description: 'Return every transaction extracted from the statement with allocations.',
    input_schema: {
      type: 'object',
      properties: {
        period_start: { type: 'string', description: 'ISO date the statement period starts' },
        period_end: { type: 'string', description: 'ISO date the statement period ends' },
        transactions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', description: 'ISO YYYY-MM-DD' },
              description: { type: 'string' },
              amount: { type: 'number', description: 'Negative for money out, positive for money in' },
              department: { type: 'string', enum: DEPTS },
              category: { type: 'string', enum: cats },
              confidence: { type: 'string', enum: ['high', 'low'] }
            },
            required: ['date', 'description', 'amount', 'department', 'category', 'confidence']
          }
        }
      },
      required: ['period_start', 'period_end', 'transactions']
    }
  };
}

const MODELS = ['claude-sonnet-5', 'claude-sonnet-4-5', 'claude-sonnet-4-20250514'];

async function callAnthropic(text: string | null, pdfB64: string | null, cats: string[], guidance: string): Promise<Record<string, unknown>> {
  const key = await getSecret('ANTHROPIC_API_KEY');
  const content: unknown[] = [];
  if (pdfB64) {
    content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfB64 } });
    content.push({ type: 'text', text: 'The attached PDF is the bank statement. Extract and allocate every transaction per the rules.' });
  } else {
    content.push({ type: 'text', text: 'STATEMENT TEXT:\n' + (text || '') });
  }
  const system = SYSTEM + (guidance
    ? '\n\nOrganisation-specific categorisation guidance written by the Welfare Avenue team. When it conflicts with the default rules above, this guidance wins:\n' + guidance
    : '');
  let lastErr = '';
  for (const model of MODELS) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: 16000, temperature: 0, system,
        messages: [{ role: 'user', content }],
        tools: [buildTool(cats)], tool_choice: { type: 'tool', name: 'import_bank_statement' }
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

function fingerprintOf(date: string, amount: number, desc: string): string {
  const norm = String(desc || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return date + '|' + amount.toFixed(2) + '|' + norm;
}

type Txn = { date?: unknown; description?: unknown; amount?: unknown; department?: unknown; category?: unknown; confidence?: unknown };

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const auth = await authorize(req);
  if (!auth.ok) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const text = String(body.statement_text || '').slice(0, 80000);
  let pdf = String(body.pdf_base64 || '');
  const filename = String(body.filename || 'pasted statement').slice(0, 200);
  // accept a data URL or raw base64
  const comma = pdf.indexOf(',');
  if (pdf.startsWith('data:')) pdf = comma >= 0 ? pdf.slice(comma + 1) : '';
  pdf = pdf.replace(/\s+/g, '');
  if (pdf && !/^[A-Za-z0-9+/=]+$/.test(pdf)) return json({ error: 'pdf_base64 is not valid base64' }, 400);
  if (pdf.length > 16_000_000) return json({ error: 'PDF too large (about 12MB max)' }, 400);
  if (!pdf && text.trim().length < 60) return json({ error: 'statement_text or pdf_base64 required' }, 400);

  const { data: stmt, error: stErr } = await svc.from('finance_statements')
    .insert({ filename, uploaded_by: auth.who, status: 'processing', summary: pdf ? 'PDF import: ' + filename : text.slice(0, 180) })
    .select('id').single();
  if (stErr || !stmt) return json({ error: 'could not create statement row' }, 500);
  const stmtId = stmt.id as number;

  try {
    const [cats, guidance] = await Promise.all([loadCats(), loadGuidance()]);
    const result = await callAnthropic(pdf ? null : text, pdf || null, cats, guidance);
    const txns = Array.isArray(result.transactions) ? (result.transactions as Txn[]) : [];
    let imported = 0, dups = 0, skipped = 0;
    for (const t of txns) {
      const date = typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : null;
      const amount = typeof t.amount === 'number' && isFinite(t.amount) ? Math.round(t.amount * 100) / 100 : null;
      const desc = String(t.description || '').slice(0, 300).trim();
      if (!date || amount === null || !desc) { skipped += 1; continue; }
      const dept = DEPTS.indexOf(String(t.department)) >= 0 ? String(t.department) : 'org';
      const cat = cats.indexOf(String(t.category)) >= 0 ? String(t.category) : 'Other';
      const fp = fingerprintOf(date, amount, desc);
      let dupOf: number | null = null;
      const { data: existing } = await svc.from('finance_transactions')
        .select('id, statement_id').eq('fingerprint', fp).order('id', { ascending: true }).limit(5);
      for (const ex of (existing || [])) {
        if (ex.statement_id !== stmtId) { dupOf = ex.id as number; break; }
      }
      const { error: insErr } = await svc.from('finance_transactions').insert({
        txn_date: date, description: desc, amount, department: dept, category: cat,
        source: 'statement', statement_id: stmtId,
        allocated_by: 'AI (' + String(t.confidence || 'low') + ' confidence)',
        duplicate_of: dupOf, fingerprint: fp,
      });
      if (insErr) { console.error('txn insert failed', insErr); skipped += 1; continue; }
      if (dupOf !== null) dups += 1; else imported += 1;
    }
    const ps = typeof result.period_start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(result.period_start) ? result.period_start : null;
    const pe = typeof result.period_end === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(result.period_end) ? result.period_end : null;

    // duplicate hardening: same-period earlier statements + all-duplicates outcome
    let periodWarning: string | null = null;
    if (ps && pe) {
      const { data: overlap } = await svc.from('finance_statements')
        .select('id, filename').eq('status', 'done').neq('id', stmtId)
        .lte('period_start', pe).gte('period_end', ps).limit(3);
      if (overlap && overlap.length) {
        periodWarning = 'A statement covering this period was already imported (' +
          overlap.map((o: { filename?: string }) => o.filename || 'statement').join(', ').slice(0, 150) + ')';
      }
    }
    const allDup = (imported === 0 && dups > 0);
    const summaryBits = [(pdf ? 'PDF import: ' : 'Text import: ') + filename];
    if (allDup) summaryBits.push('ALL ' + dups + ' transactions were already in the ledger (re-import, excluded from totals)');
    else if (periodWarning) summaryBits.push(periodWarning);
    await svc.from('finance_statements').update({
      period_start: ps, period_end: pe, txn_count: imported + dups, dup_count: dups, status: 'done',
      summary: summaryBits.join('. ').slice(0, 300),
    }).eq('id', stmtId);
    return json({ statement_id: stmtId, imported, duplicates: dups, skipped, period_start: ps, period_end: pe, all_duplicates: allDup, period_warning: periodWarning });
  } catch (e) {
    const msg = String((e as Error).message || e).slice(0, 250);
    await svc.from('finance_statements').update({ status: 'failed', summary: 'Failed: ' + msg }).eq('id', stmtId);
    return json({ error: msg, statement_id: stmtId }, 500);
  }
});
